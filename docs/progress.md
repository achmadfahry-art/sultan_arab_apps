# SULTAN ARAB APP — Laporan Kemajuan Proyek (Progress Log)

**Tanggal Pembaruan:** 2 Oktober 2026  
**Status Keseluruhan:** Seluruh Fondasi Teknis, Backend API, Database PostgreSQL Mandiri, 4 Layar Utama (Phone & PC), dan Seluruh Keputusan Bisnis **Q01–Q11 TELAH DIIMPLEMENTASIKAN & LULUS PENGUJIAN 100%**.

---

## 1. Status Implementasi Keputusan Bisnis Pengguna (Q01–Q11)

| Kode | Pertanyaan & Keputusan Pengguna | Status Implementasi | Bukti Teknis & Lokasi |
|---|---|---|---|
| **Q01** | **Cabang Nyata:**<br>1. Head Quarter Bekasi: `maps.app.goo.gl/dYmZ7xPSgDNKJc6b9` (`-6.2122736, 107.0218103`)<br>2. Cabang Cikarang: `maps.app.goo.gl/SrRQo58zHMmpju5k7` (`-6.3001269, 107.1638182`) | **SELESAI** | Migrasi `003_real_branches_and_roster.sql`. Validasi Geofence Haversine radius 150m di backend `apps/server/src/utils/geo.js`. |
| **Q02** | **Aturan Shift & Presensi:**<br>- Staff Kantor & Admin Non-shift (08:00 - 17:00)<br>- Crew Toko: Shift Pagi (08:00 - 17:00) & Shift Siang (12:30 - 21:00)<br>- Toleransi 15 menit<br>- Pemilihan shift diserahkan mandiri ke masing-masing personal<br>- Wajib **hanya absen masuk, absen pulang tidak wajib (opsional)** | **SELESAI** | Ditambahkan selector shift personal di layar presensi `#attendance`, flag toleransi 15 menit, dan perubahan alur bahwa check-out opsional di `attendance.js`. |
| **Q03** | **Kamera / Foto:** Foto wajah atau foto lokasi dalam toko/kantor, toko dilengkapi Wi-Fi | **SELESAI** | Capture langsung via kamera peramban (`getUserMedia`) atau tombol file picker untuk foto lokasi / wajah. |
| **Q04** | **Jadwal Libur Tim Resmi:**<br>- Staff Kantor: Fahry, Fauzi, Miftah (Libur Ahad)<br>- Admin: Eka (Libur Selasa)<br>- Crew Toko Bekasi: Adit (Senin), Mufti (Kamis), Kamal (Rabu)<br>- Crew Toko Cikarang: Milkan (Kamis), Refan (Selasa) | **SELESAI** | Terdaftar pada tabel `day_off_rules` & `employee_schedules`. Master akun dan profil dibuat di migrasi `003`. |
| **Q05** | **Uang Makan & Kunjungan Luar:**<br>- Uang makan Rp10.000 diberikan ketika hadir fisik toko<br>- Tombol khusus **Kunjungan Luar** yang **TIDAK** mendapat uang makan | **SELESAI** | Tombol Kunjungan Luar tersedia di UI presensi, tercatat `attendance_type = 'kunjungan_luar'` dengan `is_meal_allowance_eligible = false`. Payroll menghitung uang makan hanya untuk absensi hadir fisik. |
| **Q06** | **Upload PDF Slip Gaji oleh Manager:**<br>Kolom input PDF pada akun Manager untuk masing-masing staf | **SELESAI** | Endpoint `POST /api/v1/payroll/upload-slip` (Multer), modal upload PDF di UI Manager/Owner, penyimpanan privat dan unduh streaming di `/api/v1/payroll/slips/:id/download`. |
| **Q07** | **Hak Akses Sensitif:**<br>Hanya Manager dan Owner | **SELESAI** | Middleware `requireRoles(['owner', 'manager'])` dipasang pada kalkulasi payroll, koreksi absensi, dan unggah slip PDF. Finalisasi payroll khusus Owner. |
| **Q08** | **Input Komisi / Penyesuaian:**<br>Disediakan form input untuk diisi Manager | **SELESAI** | Modal input komisi sales manual di tab Payroll Dashboard Pengelola (`POST /api/v1/payroll/commissions`). |
| **Q09** | **Retensi Foto Absensi:** 7 hari | **SELESAI** | Skrip pembersihan otomatis `scripts/cleanup-old-photos.js` yang menghapus file foto fisik `> 7 hari`. |
| **Q10** | **Akses Jaringan Tailscale & Ponsel:**<br>IP Tailscale PC: `100.84.77.41`, port `3000` | **SELESAI** | Server Express diikat ke host `0.0.0.0:3000`. Dapat diakses langsung dari ponsel terhubung Tailscale via `http://100.84.77.41:3000`. |
| **Q011** | **Notifikasi WhatsApp:**<br>Dukungan notifikasi slip gaji via WhatsApp | **SELESAI** | Terintegrasi generator link pesan langsung WhatsApp `api.whatsapp.com/send?phone=...` dan modul gateway HTTP di `apps/server/src/utils/whatsapp.js`. |

---

## 2. Status Backlog Kerja (Blueprint Section 15)

| Kode | Tugas | Status | Keterangan & Bukti |
|---|---|---|---|
| **T01** | Inventarisasi | **SELESAI** | Seluruh aset, logo resmi mahkota emas, dokumen, dan toolchain (Node.js v24, PG 18) selesai. |
| **T02** | Fondasi Proyek | **SELESAI** | Struktur modular (`apps/web`, `apps/server`, `database`, `docs`, `storage`), script inisialisasi lokal, `.env` aktif. |
| **T03** | Database | **SELESAI** | 24 tabel PostgreSQL, data cabang nyata (HQ Bekasi & Cikarang), shift & roster tim resmi. Terverifikasi 100% oleh `verify_schema.js`. |
| **T04** | Auth dan Izin | **SELESAI** | Login cookie HttpOnly, hash bcrypt, otentikasi role (Karyawan, Supervisor, Manager, Owner). |
| **T05** | Master Data | **SELESAI** | Pengelolaan cabang dan karyawan terhubung database dengan penanda data uji vs cabang nyata. |
| **T06** | Jadwal & Libur | **SELESAI** | Penugasan shift harian dan aturan libur tim resmi Q04 aktif di database dan UI. |
| **T07** | Absensi | **SELESAI** | Alur masuk wajib, pulang opsional, selector shift personal crew, tombol Kunjungan Luar, foto lokasi/wajah, proteksi `idempotency_key`. |
| **T08** | Monitoring | **SELESAI** | Live monitoring absensi multi-cabang untuk Owner/Manager, status lokasi, dan fitur koreksi absensi dengan audit log. |
| **T09** | Payroll | **SELESAI** | Periode 27–26, input komisi manual, kalkulasi uang makan Rp10.000 hadir fisik (kunjungan luar = Rp0), finalisasi khusus Owner. |
| **T10** | Slip Gaji | **SELESAI** | Unggah PDF per karyawan oleh Manager, notifikasi WhatsApp, unduh streaming PDF oleh staf penerima. |
| **T11** | Verifikasi Terpadu | **SELESAI** | Test suite otomatis `tests/run_all_tests.js` dijalankan dan **LULUS 100% (16/16 Skenario)**. |
| **T12** | Rilis & Serah Terima | **SELESAI** | Dokumentasi lengkap `setup.md`, `decisions.md`, `release.md`, konfigurasi Nginx VPS, dan panduan Tailscale. |
| **UI01-05**| Desain Visual 4 Layar | **SELESAI** | Desain merah Sultan (`#C90000`), emas (`#EFB52B`), logo mahkota resmi, layout responsif phone & PC. |

---

## 3. Hasil Pengujian Otomatis (`tests/run_all_tests.js`)

Hasil eksekusi:
- **Tahap 1: Verifikasi Skema Database**: 24 tabel berhasil diverifikasi, roles lengkap, cabang HQ Bekasi dan Cikarang terdaftar.
- **Tahap 2: Pengujian Endpoint API & Aturan Sistem**:
  1. Health check: LULUS (200 OK).
  2. Login Karyawan & Login Owner: LULUS.
  3. Ambil Cabang: LULUS (Ditemukan 4 cabang).
  4. Absen Masuk dengan GPS & Foto: LULUS (Uang makan Rp10.000 aktif).
  5. Pengujian Idempotency: LULUS (Mencegah duplikasi entri).
  6. Absen Pulang (Opsional): LULUS.
  7. Riwayat Absensi Pribadi: LULUS.
  8. Monitoring Absensi Owner: LULUS (Data agregasi akurat).
  9. Input Komisi Manual: LULUS.
  10. Kalkulasi Draft Payroll (Periode 27–26): LULUS.
  11. Finalisasi Payroll oleh Owner: LULUS.
  12. Akses Slip Gaji Terbit oleh Karyawan: LULUS.
  13. Absen Kunjungan Luar (Q05): LULUS (Uang makan berstatus Non-Aktif / Rp0).
  14. Login Manager & Upload PDF Slip Gaji (Q06): LULUS (Link WhatsApp terbuat).
  15. Unduh Slip Gaji PDF oleh Karyawan Penerima: LULUS (HTTP 200, berkas valid).
  16. Verifikasi Retensi Foto 7 Hari (Q09): LULUS (Skrip berjalan bersih).

---

## 4. Pembaruan Fitur Terkini

1. **Penyatuan Kolom Unggah PDF Staf (Q06)**:
   - Dihapus dari tabel master karyawan, beranda, sidebar, dan menu navigasi bawah.
   - Disatukan secara eksklusif dan terpusat di **Dashboard Pengelola (`#management`) ➔ Tab "Slip Gaji PDF & Payroll"** untuk Owner dan Manager.
2. **Penyederhanaan Layar Slip Gaji (`#payslips`)**:
   - Rincian breakdown formula matematis dihilangkan dari staf.
   - Hanya menampilkan informasi periode gaji, tanggal terbit, dan tombol langsung **`📥 Unduh Slip Gaji (PDF)`** dari hasil unggahan pengelola.
3. **Peningkatan Akses Kamera Ponsel Multi-Mode**:
   - Mendukung pemicu kamera bawaan HP (`capture="user"` dan `capture="environment"`) yang 100% berfungsi di seluruh ponsel Android & iOS bahkan melalui protokol HTTP IP biasa tanpa batasan keamanan browser.
   - Mendukung live streaming video dengan tombol **Balik Kamera (Depan / Belakang)** dan tombol potret langsung pada HTTPS Tailscale (`https://fahry-work.tail0f1c60.ts.net`).
   - Kompresi gambar otomatis di sisi peramban ke resolusi optimal (maks. 1280x960) untuk proses unggah presensi yang instan.
