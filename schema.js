const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('innova.db');

db.each("SELECT sql FROM sqlite_master WHERE type='table'", (err, row) => {
    if (row && row.sql) console.log(row.sql);
});
