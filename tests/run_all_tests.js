const { execFileSync } = require('child_process');
const path = require('path');

console.log('===========================================================');
console.log(' SULTAN ARAB APP — Suite Pengujian Lengkap & Verifikasi');
console.log('===========================================================\n');

try {
  console.log('--- TAHAP 1: PENGUJIAN SKEMA & INTEGRITAS DATABASE ---');
  const dbTest = execFileSync('node', [path.resolve(__dirname, '../database/tests/verify_schema.js')], {
    encoding: 'utf8'
  });
  console.log(dbTest);

  console.log('--- TAHAP 2: PENGUJIAN API & ATURAN SISTEM ---');
  const apiTest = execFileSync('node', [path.resolve(__dirname, 'verify_api.js')], {
    encoding: 'utf8'
  });
  console.log('--- TAHAP 3: PENGUJIAN WHATSAPP & SLIP NOTIFIKASI ---');
  const waTest = execFileSync('node', [path.resolve(__dirname, 'test_whatsapp_flow.js')], {
    encoding: 'utf8'
  });
  console.log(waTest);

  console.log('\n>>> KESIMPULAN: SELURUH PENGUJIAN OTOMATIS LULUS 100% <<<');
} catch (err) {
  console.error('[Pengujian Gagal]', err.message);
  if (err.stdout) console.log(err.stdout);
  if (err.stderr) console.error(err.stderr);
  process.exit(1);
}
