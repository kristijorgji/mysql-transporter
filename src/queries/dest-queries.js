const mysql = require('mysql');
const TABLE = 'places';

module.exports = {
    insert: (batch) => `insert into ${TABLE} (id, parent_id, address, latitude, longitude, other, created_at) VALUES ${batch.map(
        r => `(${e(r.id)}, ${e(r.email)}, ${e(a(r.address))}, ${e(r.latitude)}, ${e(r.longitude)}, ${e(r.other)}, ${e(r.created_at)})`)
        .join(',')
    }`
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
