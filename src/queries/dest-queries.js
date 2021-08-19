const mysql = require('mysql');
const TABLE = 'places';

module.exports = {
    insert: (batch) => `insert into ${TABLE} (id, parent_id, address, latitude, longitude, other, created_at) VALUES ${batch.map(
        r => `(${e(r.id)}, ${e(r.email)}, ${e(a(r.address))}, ${e(r.latitude)}, ${e(r.longitude)}, ${e(r.other)}, ${e(r.created_at)})`)
        .join(',')
    }`,
    fromSource: [
        {
            name: 'read from csv and update',
            csv: 'build/example.csv',
            batchSize: 250,
            sql: (batch) => `update IGNORE places set place = ${e('ny')} where email in (${batch.map(el => e(el[1])).join(',')})`,
        }
    ],
}

function e(v) {
    return mysql.escape(v);
}

function a(address) {
    return JSON.stringify({
        sq: address,
        en: address,
    });
}
