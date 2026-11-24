# Changelog — SULTAN ARAB APP

Semua perubahan penting per rilis versi aplikasi absensi & payroll (`https://absen.sultanarab.store`).

---

## [v1.3.0] — 2026-11-24
### Rilis Produksi (`vps-sultanarab` — PM2 `sultan-app`)
- **Fitur Lembur Berbasis Jam (`1–4` Jam) & Peniadaan `Shift Lembur` Baru (`010_overtime_hourly.sql`):**
  - Menambahkan kolom `overtime_hours` (`0–4`), `overtime_pay`, dan `overtime_note` pada `attendance_sessions` (data historis `Shift Lembur` lama tetap utuh).
  - Menonaktifkan `Shift Lembur` dari pilihan dropdown shift baru (`GET /api/v1/schedules/shifts` & pembuatan cabang baru di `branches.js`).
  - Menambahkan endpoint **`POST /api/v1/attendance/overtime`** bagi karyawan setelah absen masuk toko (`hadir`, maksimal `1x/hari`, ditolak untuk `kunjungan_luar`) dengan tarif baku: `1` jam = **Rp 15.000**, `2` jam = **Rp 30.000**, `3` jam = **Rp 50.000**, `4` jam = **Rp 65.000**.
  - Menambahkan tombol **`+ CATAT LEMBUR (1-4 JAM)`** di Beranda Karyawan (samping tombol Absen Pulang / status absen selesai).
  - Memperbarui `POST /api/v1/attendance/adjustments`, Rekap Bulanan, Modal Rincian, dan PDF (`recap.js`, `pdf.js`, `app.js`) untuk mendukung koreksi jam lembur (`0–4`) oleh `owner`/`manager` serta menampilkan total jam & upah lembur.

---

## [v1.2.1] — 2026-11-24
### Rilis Produksi (`vps-sultanarab` — PM2 `sultan-app`)
- **Edit Absensi Rekap Bulanan (Cut-Off `27–26` Berjalan):**
  - `POST /api/v1/attendance/adjustments` mendukung pembaruan **Tipe Kehadiran** (`hadir` / `kunjungan_luar`), **Status** (`present`, `late`, `incomplete`, `off`), dan **Shift**, serta otomatis memperbarui kelayakan uang makan (`is_meal_allowance_eligible`) dan mencatat jejak audit (`attendance_adjustments` + `audit_logs`).
  - Pembatasan tanggal wajib berada pada **periode cut-off `27–26` berjalan** (maksimal hari ini WIB); tanggal lampau di luar cut-off atau masa depan ditolak (`400`).
  - Akses khusus **`owner`** dan **`manager`** untuk seluruh cabang.
  - UI **Rekap Bulanan $\rightarrow$ Rincian Kehadiran** menampilkan tombol **`Edit`** per tanggal dan **`+ Koreksi / Input Tanggal`** untuk periode cut-off berjalan; status `off` dan `incomplete` ditampilkan akurat dan tidak dihitung durasi shift kerja.
  - Penambahan test otomatis [test_recap_cutoff_adjustment.js](tests/test_recap_cutoff_adjustment.js).

---

## [v1.2.0] — 2026-11-21
### Rilis Produksi (`vps-sultanarab` — PM2 `sultan-app`)
- **Perubahan Penamaan & Migrasi Cabang (`009_rename_headquarter_to_kantor_pusat.sql`):**
  - Mengubah penamaan cabang `HQ-BKS` dari `Head Quarter Bekasi (Pusat Grosir)` menjadi **`Kantor Pusat`** di database dan fallback frontend.
  - Mengubah label tombol dan modal konfirmasi **`Kurang Karyawan`** menjadi **`Hapus Karyawan`**.
- **Rekap Bulanan Cut-Off Tanggal `27` Bulan Sebelumnya s.d. `26` Bulan Ini (`apps/server/src/utils/recap.js`):**
  - Mengubah periode rekap bulanan dan perhitungan total hari libur agar mengikuti siklus tanggal `27` bulan lalu s.d. `26` bulan berjalan (mis. periode November = `27 Okt 2026 – 26 Nov 2026`).
  - Menetapkan default filter periode otomatis berdasarkan tanggal Asia/Jakarta (`>= 27` otomatis mengarah ke siklus bulan berikutnya).
- **Rincian Kehadiran Bertanggal Per Karyawan:**
  - Memperbaiki mismatch field `date` vs `work_date` pada API `daily_records`, menambahkan format tanggal Indonesia lengkap (`Sen, 18 Nov 2026`), jam masuk/pulang WIB, serta indikator status analisa per karyawan.
- **Analisa Rekap Bulanan & Tombol Download PDF (`apps/server/src/utils/pdf.js`):**
  - Menambahkan perhitungan analisa tim (`on_time_rate_pct`, rata-rata hadir & jam kerja, distribusi shift Pagi/Siang/Lembur, sorotan hadir tertinggi/terlambat/lembur terbanyak, dan ringkasan poin otomatis) serta panel **`Analisa Rekap Bulanan`** di UI.
  - Menambahkan endpoint **`GET /api/v1/attendance/monthly-recap/pdf`** (generator PDF 1.4 pure-Node tanpa dependensi tambahan) dan tombol **`Download PDF`** di halaman Rekap Bulanan.
- **Pembaruan Dokumentasi Produksi (`docs/production_cloudflare_deployment.md`, `README.md`, `docs/decisions.md`, `docs/progress.md`):**
  - Memperbarui rujukan server produksi ke **`vps-sultanarab`** (`VM-0-3-ubuntu`, PM2 `sultan-app`, PostgreSQL 18, Cloudflare Tunnel `cloudflared.service`) serta menghapus kredensial/token mentah dari dokumen.

---

> Rilis sebelumnya (`v1.0.0` pada `23 Okt 2026`, `v1.1.0` pada `23 Okt 2026`, `v1.1.1` & timezone fix pada `23–27 Okt 2026`) tercatat dalam riwayat commit Git branch `main`; snapshot tagging resmi dimulai pada **`v1.2.0`**.
