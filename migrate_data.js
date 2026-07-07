const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db_sqlite = new sqlite3.Database('./innova.db');

const tables = [
    'usuarios', 'productos', 'categorias', 'configuracion',
    'cupones', 'puntos_lealtad', 'historial_puntos',
    'pedidos', 'pedido_items', 'movimientos_stock', 'resenas'
];

async function migrateData() {
    console.log("Iniciando migración de datos de SQLite a PostgreSQL...");

    for (const table of tables) {
        console.log(`Migrando tabla: ${table}...`);
        
        const rows = await new Promise((resolve, reject) => {
            db_sqlite.all(`SELECT * FROM ${table}`, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        if (rows.length === 0) {
            console.log(`Tabla ${table} vacía, saltando.`);
            continue;
        }

        for (const row of rows) {
            const columns = Object.keys(row);
            const values = Object.values(row);
            
            // Reemplazar valores booleanos o vacíos que en SQLite son 0/1 a Postgres si es necesario
            // Por ahora asumo que Postgres acepta el mismo tipo de dato que SQLite
            
            const colNames = columns.join(', ');
            let placeholders = '';
            let count = 1;
            for (let i = 0; i < columns.length; i++) {
                placeholders += `$${count++}, `;
            }
            placeholders = placeholders.slice(0, -2); // quitar última coma

            const sql = `INSERT INTO ${table} (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
            
            try {
                await pool.query(sql, values);
            } catch (err) {
                if (!err.message.includes("unique constraint") && !err.message.includes("syntax error at or near \"ON CONFLICT\"")) {
                    console.error(`Error insertando en ${table}:`, err.message);
                } else if (err.message.includes("syntax error at or near \"ON CONFLICT\"")) {
                   // Fallback para Postgres cuando ON CONFLICT falla porque no hay un constraint obvio definido
                   const sqlNoConflict = `INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`;
                   try {
                       await pool.query(sqlNoConflict, values);
                   } catch (err2) {
                       if (!err2.message.includes("duplicate key")) {
                           console.error(`Error insertando en ${table} (sin conflicto):`, err2.message);
                       }
                   }
                }
            }
        }
        
        // Sincronizar secuencias
        try {
            await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), coalesce(max(id),0) + 1, false) FROM ${table};`);
        } catch (err) {
             console.error(`No se pudo sincronizar ID para ${table}:`, err.message);
        }

        console.log(`Tabla ${table} migrada exitosamente (${rows.length} registros).`);
    }

    console.log("¡Migración completada!");
    process.exit(0);
}

migrateData().catch(err => {
    console.error("Error en migración:", err);
    process.exit(1);
});
