const mysql = require('mysql');
const TABLE = 'places';

module.exports = {
    formLastInsertedCursor: (row) => row.created_at,
    select: (lastCursor, limit) => {
        return `SELECT * from ${TABLE} ${buildWhereClause(lastCursor)} ORDER BY created_at ASC LIMIT ${limit}`;
    } ,
    count: (lastCursor) => {
        return `SELECT count(*) as count from ${TABLE} ${buildWhereClause(lastCursor)} ORDER BY created_at ASC`;
    },
}

function buildWhereClause(lastCursor) {
    let whereClause = '';
    if (lastCursor) {
        whereClause = `where created_at > ${mysql.escape(lastCursor)}`;
    }

    return whereClause;
}
