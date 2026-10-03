/**
 * SULTAN ARAB APP — Pembersihan Berkas Yatim (Orphan Files)
 * Menghapus berkas foto absensi & slip PDF di folder storage/ yang tidak lagi
 * direferensikan oleh database (mis. setelah penghapusan data uji).
 *
 * Pemakaian:
 *   node scripts/cleanup-orphan-files.js          -> hanya menampilkan daftar (dry run)
 *   node scripts/cleanup-orphan-files.js --apply  -> benar-benar menghapus
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const STORAGE_ROOT = path.resolve(__dirname, '..', 'storage');
const APPLY = process.argv.includes('--apply');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/sultan_arab_app'
});

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    if (entry.name === '.gitkeep') return [];
    return [full];
  });
}

const normalize = p => path.resolve(STORAGE_ROOT, p.replace(/^storage[\\/]/, '')).toLowerCase();

async function main() {
  const refs = new Set();
  const photos = await pool.query(`SELECT photo_path FROM attendance_events WHERE photo_path IS NOT NULL`);
  photos.rows.forEach(r => refs.add(normalize(r.photo_path)));
  const slips = await pool.query(`SELECT pdf_path, storage_path FROM payslips`);
  slips.rows.forEach(r => {
    if (r.pdf_path) refs.add(path.resolve(r.pdf_path).toLowerCase());
    if (r.pdf_path) refs.add(normalize(r.pdf_path));
    if (r.storage_path) refs.add(normalize(r.storage_path));
  });

  const candidates = [
    ...listFiles(path.join(STORAGE_ROOT, 'attendance-photos')),
    ...listFiles(path.join(STORAGE_ROOT, 'payslips'))
  ];
  const orphans = candidates.filter(f => !refs.has(path.resolve(f).toLowerCase()));

  console.log(`[Orphan] Total berkas: ${candidates.length}, direferensikan: ${candidates.length - orphans.length}, yatim: ${orphans.length}`);
  orphans.forEach(f => console.log(`  ${APPLY ? 'HAPUS' : 'akan dihapus'}: ${path.relative(STORAGE_ROOT, f)}`));

  if (APPLY) {
    orphans.forEach(f => fs.unlinkSync(f));
    console.log('[Orphan] Selesai menghapus berkas yatim.');
  } else if (orphans.length) {
    console.log('[Orphan] Dry run. Jalankan dengan --apply untuk menghapus.');
  }
  await pool.end();
}

main().catch(err => {
  console.error('[Orphan Error]', err.message);
  process.exit(1);
});
