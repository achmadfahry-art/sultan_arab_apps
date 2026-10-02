const fs = require('fs');
const path = require('path');
const db = require('../apps/server/src/db');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.resolve(__dirname, '../storage');
const RETENTION_DAYS = 7; // Sesuai keputusan Q09

async function cleanupOldPhotos() {
  console.log(`[Retensi Foto] Memeriksa foto absensi lebih lama dari ${RETENTION_DAYS} hari...`);
  try {
    const res = await db.query(`
      SELECT id, photo_path, server_time 
      FROM attendance_events 
      WHERE server_time < CURRENT_TIMESTAMP - INTERVAL '${RETENTION_DAYS} days' 
        AND photo_path IS NOT NULL;
    `);

    console.log(`[Retensi Foto] Ditemukan ${res.rows.length} foto kedaluwarsa.`);
    let deletedCount = 0;

    for (const row of res.rows) {
      const fullPath = path.join(UPLOAD_ROOT, row.photo_path);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          deletedCount++;
        } catch (e) {
          console.warn(`[Retensi Foto Warning] Gagal hapus file: ${fullPath}`, e.message);
        }
      }
      // Update record di database agar path dikosongkan/ditandai diarsipkan
      await db.query(`UPDATE attendance_events SET photo_path = NULL WHERE id = $1`, [row.id]);
    }

    console.log(`[Retensi Foto Selesai] Berhasil membersihkan ${deletedCount} berkas foto lawas.`);
  } catch (err) {
    console.error('[Retensi Foto Error]', err.message);
  } finally {
    process.exit(0);
  }
}

cleanupOldPhotos();
