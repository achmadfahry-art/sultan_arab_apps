const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PG_BIN_DIR = process.env.PG_BIN_DIR || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const DATA_DIR = path.resolve(__dirname, '..', 'database', 'data');
const LOG_FILE = path.resolve(__dirname, '..', 'database', 'pg_server.log');
const pgCtlPath = path.join(PG_BIN_DIR, 'pg_ctl.exe');

let dbPort = '5433';
if (process.env.DATABASE_URL) {
  const match = process.env.DATABASE_URL.match(/:(\d+)\//);
  if (match) dbPort = match[1];
}

console.log(`[DB Start] Memeriksa status PostgreSQL mandiri pada port ${dbPort}...`);

try {
  const status = execFileSync(pgCtlPath, ['status', '-D', DATA_DIR], { encoding: 'utf8' });
  if (status.includes('server is running')) {
    console.log('[DB Start] PostgreSQL lokal mandiri sudah berjalan.');
    process.exit(0);
  }
} catch (e) {
  // Not running, proceed
}

console.log(`[DB Start] Menjalankan server PostgreSQL lokal mandiri...`);

const child = spawn(pgCtlPath, [
  'start',
  '-D', DATA_DIR,
  '-l', LOG_FILE,
  '-o', `-p ${dbPort}`
], {
  detached: true,
  stdio: 'ignore'
});

child.unref();

// Wait up to 5 seconds to verify it is running
let attempts = 0;
const interval = setInterval(() => {
  attempts++;
  try {
    const status = execFileSync(pgCtlPath, ['status', '-D', DATA_DIR], { encoding: 'utf8' });
    if (status.includes('server is running')) {
      clearInterval(interval);
      console.log(`[DB Start] PostgreSQL lokal mandiri BERHASIL aktif pada port ${dbPort}!`);
      process.exit(0);
    }
  } catch (err) {
    if (attempts >= 10) {
      clearInterval(interval);
      console.error('[DB Start] Waktu habis menunggu PostgreSQL menyala. Periksa log di database/pg_server.log');
      process.exit(1);
    }
  }
}, 500);
