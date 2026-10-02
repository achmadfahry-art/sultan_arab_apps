const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PG_BIN_DIR = process.env.PG_BIN_DIR || 'C:\\Program Files\\PostgreSQL\\18\\bin';
const DATA_DIR = path.resolve(__dirname, '..', 'database', 'data');
const initDbPath = path.join(PG_BIN_DIR, 'initdb.exe');

console.log('[DB Init] Memeriksa direktori data PostgreSQL lokal...');
console.log('Target data directory:', DATA_DIR);

if (!fs.existsSync(initDbPath)) {
  console.error(`[DB Init Error] initdb.exe tidak ditemukan di: ${initDbPath}`);
  console.error('Silakan set PG_BIN_DIR di .env ke folder bin PostgreSQL Anda.');
  process.exit(1);
}

if (fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
  console.log('[DB Init] Cluster data PostgreSQL lokal sudah ada di:', DATA_DIR);
  process.exit(0);
}

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log('[DB Init] Menjalankan initdb...');
  const res = execFileSync(initDbPath, [
    '-D', DATA_DIR,
    '-U', 'postgres',
    '-A', 'trust',
    '-E', 'UTF8'
  ], { encoding: 'utf8' });

  console.log(res);
  console.log('[DB Init] Berhasil menginisialisasi cluster data PostgreSQL mandiri lokal!');
} catch (err) {
  console.error('[DB Init Error] Gagal menginisialisasi database:', err.message);
  if (err.stderr) console.error(err.stderr);
  process.exit(1);
}
