const envFile = `.env.${process.env.ENVIRONMENT}`;
require('dotenv').config({
        path: envFile,
    }
);

if (!process.env.hasOwnProperty('DB_HOST')) {
    throw new Error(`${envFile} probably does not exist`);
}

const fs = require('fs');
const {connect} = require("./mysql-connect");
const sourceQueries = require('./queries/source-queries');
const destQueries = require('./queries/dest-queries');

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

logger.info(`Starting with batch size of ${BATCH_SIZE}`);

let sourceCon, destCon;
(async function () {
    [sourceCon, destCon] = await connect(logger);
    start();
}());

let insertedRowsIntoDb = 0;
let totalRowsLeftToMigrate = -1;
let lastInsertedCursor = -1;
let last = null;

async function start() {
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

    sourceCon.destroy();
    destCon.destroy();

    reportBeforeEnd();
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
