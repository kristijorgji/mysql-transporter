module.exports = {
    sourceConConfig: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE
    },
    destConConfig: {
        host: process.env.DEST_DB_HOST,
        port: process.env.DEST_DB_PORT,
        user: process.env.DEST_DB_USERNAME,
        password: process.env.DEST_DB_PASSWORD,
        database: process.env.DEST_DB_DATABASE
    },
}
