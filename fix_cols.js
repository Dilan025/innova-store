const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
    try {
        await pool.query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS descuento_aplicado NUMERIC DEFAULT 0');
        await pool.query('ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cupon_codigo TEXT');
        await pool.query('ALTER TABLE productos ADD COLUMN IF NOT EXISTS descripcion TEXT');
        
        // Fix cupones
        await pool.query('ALTER TABLE cupones ADD COLUMN IF NOT EXISTS usos INTEGER DEFAULT 0');
        await pool.query('ALTER TABLE cupones ADD COLUMN IF NOT EXISTS max_usos INTEGER DEFAULT 0');
        
        console.log("Columnas arregladas.");
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}

fix();
