const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PG_BIN_DIR = process.env.PG_BIN_DIR || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const DATA_DIR = path.resolve(__dirname, '..', 'database', 'data');
const pgCtlPath = path.join(PG_BIN_DIR, 'pg_ctl.exe');

try {
  console.log('[DB Stop] Menghentikan PostgreSQL lokal mandiri...');
  const res = execFileSync(pgCtlPath, ['stop', '-D', DATA_DIR, '-m', 'fast'], { encoding: 'utf8' });
  console.log(res);
} catch (err) {
  console.log('[DB Stop] PostgreSQL lokal sudah berhenti atau tidak aktif.');
}
