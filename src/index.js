const envFile = `.env.${process.env.ENVIRONMENT}`;
const csv = require('csv');

require('dotenv').config({
        path: envFile,
    }
);

if (!process.env.hasOwnProperty('DB_HOST')) {
    throw new Error(`${envFile} probably does not exist`);
}

const fs = require('fs');
const {connect} = require("./mysql-utils");
const sourceQueries = require('./queries/source-queries');
const destQueries = require('./queries/dest-queries');
const {sourceConConfig, destConConfig} = require("./configs");

const logger = require('pino')({
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: {
        colorize: true,
        translateTime: true,
        ignore: 'pid,hostname'
    }
});

const hrstart = process.hrtime();

const argv = require('yargs')
    .usage('Usage: $0 <command> [options]')
    .example('$0 --inputPath logs/', 'Parse the logs and  set into storage')
    .describe('batchSize', 'The number of rows to insert in one go')
    .help('h')
    .alias('h', 'help')
    .epilog('@kristijorgji - 2021')
    .argv;

const STATE_FILE = `state.${process.env.ENVIRONMENT}.json`;

const BATCH_SIZE = argv.batchSize || 2500;
const MAX_ROWS_TO_BE_TRANSFERED = null;

logger.info(`Starting`);

let sourceCon, destCon;
(async function () {
    destCon = await connect(logger, destConConfig);
    if (Object.keys(sourceQueries).length > 0 && (sourceQueries.enabled === undefined ? true : false) === true) {
        sourceCon = await connect(logger, sourceConConfig);
        await startTransfer();
    }
    await startDestJobs(destCon);

    if (sourceCon) {
        sourceCon.destroy();
    }
    if (destCon) {
        destCon.destroy();
    }
}());

let insertedRowsIntoDb = 0;
let totalRowsLeftToMigrate = -1;
let lastInsertedCursor = -1;
let last = null;

async function startTransfer() {
    if (fs.existsSync(STATE_FILE)) {
        lastInsertedCursor = JSON.parse(fs.readFileSync(STATE_FILE)).lastInsertedCursor;
        logger.debug(`Found state file, will start from lastInsertedCursor=${lastInsertedCursor}`);
    }

    totalRowsLeftToMigrate = await count(lastInsertedCursor === -1 ? undefined : lastInsertedCursor);

    do {
        last = null;
        const result = await select(BATCH_SIZE + 1, lastInsertedCursor === -1 ? undefined : lastInsertedCursor);

        if (result.length > BATCH_SIZE) {
            last = result.pop();
        }

        const batchLength = result.length;

        const r = await insertBatch(result);
        insertedRowsIntoDb += r.affectedRows;
        logger.debug(
            `${r.affectedRows} records inserted. Total ${insertedRowsIntoDb} / ${totalRowsLeftToMigrate} (${Math.round((insertedRowsIntoDb / totalRowsLeftToMigrate) * 100)}%) inserted`
        );
        reportElapsed();

        lastInsertedCursor = sourceQueries.formLastInsertedCursor(result[batchLength - 1]);
        saveState(false);
    } while (last !== null && (MAX_ROWS_TO_BE_TRANSFERED === null || insertedRowsIntoDb < MAX_ROWS_TO_BE_TRANSFERED));

    reportBeforeEnd();
}

async function startDestJobs(conn) {
    if (Object.prototype.hasOwnProperty.call(destQueries, 'fromSource')) {
        await handleFromSourceJobs(conn);
        logger.info('Finished all dest jobs')
        reportElapsed();
    }
}

async function handleFromSourceJobs(conn) {
    for (const job of destQueries.fromSource) {
        const r = await handleFromSourceJob(conn, job);
        logger.debug(`[Finished][${job.name}] affected ${r.processed} entries from total source records of ${r.sourceLinesCount}`);
        reportElapsed();
    }
}

async function handleFromSourceJob(conn, job) {
    return new Promise((resolve, reject) => {
        let records = [];
        let processed = 0;
        let sourceLinesCount = 0;
        if (Object.prototype.hasOwnProperty.call(job, 'csv')) {
            csv.parse(
                fs.readFileSync(job.csv),
                {
                    trim: true,
                    skip_empty_lines: true
                })
                .on('readable', async function () {
                    let record
                    while (record = this.read()) {
                        records.push(record)
                        if (records.length === (job.batchSize || 100)) {
                            await handleRecords(conn, job, records);
                            records = [];
                        }
                    }
                }).on('end', async function () {
                if (records.length > 0) {
                    await handleRecords(conn, job, records);
                }
                resolve({
                    processed: processed,
                    sourceLinesCount: sourceLinesCount,
                });
            });
        }

        async function handleRecords(conn, job, records) {
            const sql = job.sql(records);
            const recordsLength = records.length;
            sourceLinesCount += recordsLength;

            return new Promise((hrresolve, hrreject) => {
                conn.query(sql, function (err, result) {
                    if (err) {
                        hrreject(err);
                    } else {
                        const affected = result.affectedRows;
                        processed += affected;
                        logger.debug(
                            `${affected} affected records from batch of ${recordsLength}. Total affected ${processed}`
                        );
                        reportElapsed();
                        hrresolve();
                    }
                });
            })
        }
    })
}

function select(limit, lastCursor) {
    const sql = sourceQueries.select(lastCursor, limit);
    return new Promise((resolve, reject) => {
        sourceCon.query(sql, function (err, result) {
            if (err) {
                reject(err);
            }

            resolve(result);
        });
    });
}

function count(lastCursor) {
    const sql = sourceQueries.count(lastCursor);
    return new Promise((resolve, reject) => {
        sourceCon.query(sql, function (err, result) {
            if (err) {
                reject(err);
            }

            resolve(result[0].count);
        });
    });
}

function insertBatch(batch) {
    return new Promise(function (resolve, reject) {
        const sql = destQueries.insert(batch);
        destCon.query(sql, function (err, result) {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

function snooze(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('SIGINT', function () {
    logger.warn('Caught interrupt signal, saving state');
    saveState(true);
    reportBeforeEnd();
    process.exit();
});

function saveState(onClose) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
        lastInsertedCursor: lastInsertedCursor,
        insertedRowsIntoDb: insertedRowsIntoDb,
        totalRowsLeftToMigrate: totalRowsLeftToMigrate,
    }))
}

function reportBeforeEnd() {
    logger.info('Total Rows inserted to mysql', insertedRowsIntoDb);
    reportElapsed();
}

function reportElapsed() {
    const hrend = process.hrtime(hrstart);
    logger.info('Total Execution time (hr): %ds %dms', hrend[0], hrend[1] / 1000000);
}
