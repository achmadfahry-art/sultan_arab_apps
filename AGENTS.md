# Panduan Pengembangan Agen — SULTAN ARAB APP

## 1. Aturan Dasar Pengembangan
- **Acuan Utama:** `fulus.md` (kebutuhan bisnis) dan `blueprint_fulu.md` (panduan teknis).
- **Arsitektur:** Full Web (Web Phone & Web PC), backend Node.js Express, PostgreSQL mandiri.
- **Jangan Mengubah `sources/`:** Seluruh berkas di folder `sources/` bersifat baca saja.
- **Pemisahan Data Uji:** Seluruh data dummy/mockup wajib memiliki tag `[DATA UJI]` dan flag `is_test_data = true`.
- **Aturan Bisnis Belum Sah:** Jangan mengarang rumus payroll, data koordinat cabang, atau hak akses role sebelum dikonfirmasi lewat daftar **Q01–Q11**.
- **Dokumentasi Wajib Diperbarui:**
  - Kemajuan & hasil pengujian: `docs/progress.md`
  - Keputusan arsitektur & status Q01–Q11: `docs/decisions.md`
  - Cara setup & menjalankan: `docs/setup.md`
  - Rilis & migrasi VPS: `docs/release.md`

## 2. Cara Menjalankan & Verifikasi
- Menjalankan PostgreSQL lokal mandiri: `node scripts/start-local-db.js`
- Menjalankan migrasi database: `npm run db:migrate`
- Menjalankan backend server: `npm start` (Port 3000)
- Menjalankan seluruh pengujian otomatis: `npm test`
