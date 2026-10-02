const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5433/sultan_arab_app';

async function runMigrations() {
  console.log('[Migrasi] Menghubungkan ke PostgreSQL...');
  
  // Parse target database name
  const urlObj = new URL(dbUrl);
  const targetDb = urlObj.pathname.replace('/', '') || 'sultan_arab_app';
  
  // Connect to default 'postgres' database first to ensure target db exists
  urlObj.pathname = '/postgres';
  const rootClient = new Client({ connectionString: urlObj.toString() });
  
  try {
    await rootClient.connect();
    const checkDb = await rootClient.query(`SELECT 1 FROM pg_database WHERE datname = $1;`, [targetDb]);
    if (checkDb.rows.length === 0) {
      console.log(`[Migrasi] Membuat database "${targetDb}"...`);
      await rootClient.query(`CREATE DATABASE "${targetDb}";`);
      console.log(`[Migrasi] Database "${targetDb}" berhasil dibuat.`);
    } else {
      console.log(`[Migrasi] Database "${targetDb}" sudah ada.`);
    }
  } catch (err) {
    console.warn('[Migrasi Info] Root connection note:', err.message);
  } finally {
    await rootClient.end();
  }

  // Connect to target database
  const targetClient = new Client({ connectionString: dbUrl });
  try {
    await targetClient.connect();
    console.log(`[Migrasi] Terhubung ke database target: "${targetDb}"`);

    // Create migrations tracker table
    await targetClient.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.resolve(__dirname, '..', 'database', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const check = await targetClient.query(`SELECT 1 FROM _migrations WHERE filename = $1;`, [file]);
      if (check.rows.length > 0) {
        console.log(`[Migrasi] Lewati (sudah diterapkan): ${file}`);
        continue;
      }

      console.log(`[Migrasi] Menerapkan: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await targetClient.query('BEGIN');
      try {
        await targetClient.query(sql);
        await targetClient.query(`INSERT INTO _migrations (filename) VALUES ($1);`, [file]);
        await targetClient.query('COMMIT');
        console.log(`[Migrasi] SUKSES: ${file}`);
      } catch (sqlErr) {
        await targetClient.query('ROLLBACK');
        console.error(`[Migrasi GAGAL] pada file ${file}:`, sqlErr.message);
        throw sqlErr;
      }
    }

    console.log('[Migrasi] Seluruh migrasi database selesai dengan sukses!');
  } catch (err) {
    console.error('[Migrasi Error]', err.message);
    process.exit(1);
  } finally {
    await targetClient.end();
  }
}

runMigrations();
