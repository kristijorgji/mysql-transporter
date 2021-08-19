const mysql = require('mysql');

module.exports = {
    connect(logger, config) {
        return new Promise((resolve, reject) => {
            const con = mysql.createConnection(config);

            con.connect(function (err) {
                if (err) {
                    reject(err);
                }
                logger.debug(`Connected to mysql ${config.host}`);
                resolve(con);
            });
        })
    },
}
