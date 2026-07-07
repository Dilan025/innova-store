const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function replaceQuestionMarks(query) {
    let count = 1;
    let newQuery = query.replace(/\?/g, () => `$${count++}`);
    return newQuery;
}

class DB {
    constructor() {
        this.queue = [];
        this.isSerializing = false;
        this.isRunning = false;
    }

    serialize(callback) {
        this.isSerializing = true;
        callback();
        this.isSerializing = false;
        this.runQueue();
    }

    runQueue() {
        if (this.queue.length === 0) {
            this.isRunning = false;
            return;
        }
        this.isRunning = true;
        const task = this.queue.shift();

        pool.query(task.pgSql, task.params || [])
            .then(res => {
                const lastID = (res.rows && res.rows.length > 0 && res.rows[0].id) ? res.rows[0].id : null;
                const context = { changes: res.rowCount, lastID: lastID };
                if (task.callback) task.callback.call(context, null);
                this.runQueue();
            })
            .catch(err => {
                console.error("DB RUN ERROR:", err.message, "\\n", task.pgSql);
                if (task.callback) task.callback.call({ changes: 0, lastID: null }, err);
                this.runQueue();
            });
    }

    prepare(sql) {
        return {
            run: (...params) => {
                this.run(sql, params);
            },
            finalize: () => {}
        };
    }

    run(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        let pgSql = sql;
        if (/INTEGER PRIMARY KEY AUTOINCREMENT/i.test(pgSql)) {
            pgSql = pgSql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
        }
        if (/DATETIME DEFAULT CURRENT_TIMESTAMP/i.test(pgSql)) {
            pgSql = pgSql.replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
        }
        if (/DATETIME/i.test(pgSql)) {
            pgSql = pgSql.replace(/DATETIME/gi, 'TIMESTAMP');
        }
        if (/REAL DEFAULT 0/i.test(pgSql)) {
            pgSql = pgSql.replace(/REAL DEFAULT 0/gi, 'NUMERIC DEFAULT 0');
        }

        pgSql = replaceQuestionMarks(pgSql);
        
        if (/^\s*INSERT\s+INTO/i.test(pgSql) && !/RETURNING/i.test(pgSql)) {
            pgSql += ' RETURNING id';
        }

        if (/^PRAGMA /i.test(pgSql)) {
            if (callback) callback.call({ changes: 0, lastID: null }, null);
            return;
        }

        if (this.isSerializing || this.isRunning) {
            this.queue.push({ pgSql, params, callback });
            if (!this.isRunning && !this.isSerializing) {
                this.runQueue();
            }
            return;
        }

        pool.query(pgSql, params || [])
            .then(res => {
                const lastID = (res.rows && res.rows.length > 0 && res.rows[0].id) ? res.rows[0].id : null;
                const context = { changes: res.rowCount, lastID: lastID };
                if (callback) callback.call(context, null);
            })
            .catch(err => {
                console.error("DB RUN ERROR:", err.message, pgSql);
                if (callback) callback.call({ changes: 0, lastID: null }, err);
            });
    }

    get(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        let pgSql = replaceQuestionMarks(sql);
        
        pool.query(pgSql, params || [])
            .then(res => {
                if (callback) callback(null, res.rows.length > 0 ? res.rows[0] : undefined);
            })
            .catch(err => {
                console.error("DB GET ERROR:", err.message, pgSql);
                if (callback) callback(err, null);
            });
    }

    all(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        if (/^PRAGMA table_info/i.test(sql)) {
            if (callback) callback(null, null);
            return;
        }

        let pgSql = replaceQuestionMarks(sql);

        pool.query(pgSql, params || [])
            .then(res => {
                if (callback) callback(null, res.rows);
            })
            .catch(err => {
                console.error("DB ALL ERROR:", err.message, pgSql);
                if (callback) callback(err, null);
            });
    }
}

module.exports = new DB();
