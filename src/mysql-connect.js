const mysql = require('mysql');

module.exports = {
    connect(logger) {
        return new Promise((resolve, reject) => {
            const sourceCon = mysql.createConnection({
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE
            });

            const destCon = mysql.createConnection({
                host: process.env.DEST_DB_HOST,
                port: process.env.DEST_DB_PORT,
                user: process.env.DEST_DB_USERNAME,
                password: process.env.DEST_DB_PASSWORD,
                database: process.env.DEST_DB_DATABASE
            });

            sourceCon.connect(function (err) {
                if (err) {
                    reject(err);
                }
                logger.debug("Connected to mysql source!");
                destCon.connect(function (err) {
                    if (err) {
                        reject(err);
                    }
                    logger.debug("Connected to mysql destination!");
                    resolve([sourceCon, destCon]);
                });
            });
        })
    }
}
