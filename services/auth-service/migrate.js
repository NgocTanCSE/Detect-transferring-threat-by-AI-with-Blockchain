const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  // Ensure migration tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    
    if (rows.length === 0) {
      console.log(`[MIGRATOR] Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`[MIGRATOR] Successfully executed ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[MIGRATOR] Failed to execute ${file}:`, err.message);
        process.exit(1);
      } finally {
        client.release();
      }
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('[MIGRATOR] All migrations completed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('[MIGRATOR] Migration error:', err.message);
      process.exit(1);
    });
}

module.exports = runMigrations;
