# SULTAN ARAB APP — Catatan Keputusan Teknis & Arsitektur

Dokumen ini mencatat seluruh keputusan arsitektur, pilihan teknis, dan pemetaan status terhadap daftar pertanyaan terbuka **Q01–Q11** sesuai arahan pada [fulus.md](../fulus.md) dan [blueprint_fulu.md](../blueprint_fulu.md).

---

## 1. Keputusan Utama yang Diterapkan (2 Oktober 2026)

| No | Topik | Keputusan | Dasar Acuan |
|---|---|---|---|
| 1 | **Arsitektur Aplikasi** | Full Web Responsif (Web Phone & Web PC) dalam satu basis kode SPA terpadu. Port 3000. | Keputusan Pengguna 1 Oktober 2026 di `fulus.md` Bagian 2. Menggantikan Flutter & Supabase. |
| 2 | **Database** | PostgreSQL Mandiri Lokal (Port 5433 untuk cluster mandiri terisolasi, portabel ke VPS). Skema 24 tabel sesuai blueprint. | `fulus.md` Bagian 2 & `blueprint_fulu.md` Bagian 4. |
| 3 | **Backend** | Node.js + Express. Menyediakan API v1, session auth cookie HttpOnly, role authorization, Haversine GPS validator, dan audit log. | `blueprint_fulu.md` Bagian 2 & 9. |
| 4 | **Penyimpanan Berkas** | Direktori privat server `storage/attendance-photos` dan `storage/payslips` di luar public web. Path relatif disimpan di database. | `blueprint_fulu.md` Bagian 10. |
| 5 | **Identitas Visual** | Warna Merah Sultan (`#C90000`), Emas (`#EFB52B`), Putih (`#FFFFFF`), Latar (`#F6F7F9`). Logo resmi Mahkota Sultan Arab diintegrasikan dari `C:/Users/fahry-work/Documents/Sultan Arab/logo sultan arab.jpg`. | Mockup pengguna di `tampilan app fulus sultan arab.jpeg` & `fulus.md` Bagian 9. |
| 6 | **Pencegahan Duplikasi** | Menggunakan `idempotency_key` pada setiap transaksi absen masuk dan pulang. | `blueprint_fulu.md` Bagian 5 & 16. |
| 7 | **Pembersihan Data Uji** | Seluruh data cabang sintetis, data karyawan sintetis (Ahmad & Siti), serta nominal gaji uji telah dihapus permanen melalui migrasi `004_remove_test_data_and_shift_update.sql`. Basis data kini murni memuat entitas operasional resmi. | Permintaan pengguna 3 Okt 2026. |

---

## 2. Keputusan Resmi Bisnis yang Telah Diterapkan (Berdasarkan Jawaban Q01 – Q11)

| ID | Topik Keputusan | Status | Keputusan & Implementasi Teknis |
|---|---|---|---|
| **Q01** | Cabang & Koordinat GPS | **DITETAPKAN & AKTIF** | 1. **Head Quarter Bekasi (Pusat Grosir)**: (Lat `-6.2122736`, Lon `107.0218103`).<br>2. **Cabang Cikarang**: (Lat `-6.3001269`, Lon `107.1638182`). Radius geofence default 150 meter.<br>3. **Dukungan Tambah Cabang**: Disediakan tombol interaktif `+ Cabang` pada dashboard pengelola lengkap dengan input koordinat, alamat, radius, dan pembuatan shift otomatis. |
| **Q02** | Jam Shift & Presensi | **DITETAPKAN & AKTIF** | - **Staff Kantor & Admin**: Non-shift (08:00 – 17:00).<br>- **Crew Toko**: Shift Pagi (08:00 – 17:00) & Shift Siang (**12:00 – 21:00**).<br>- Toleransi keterlambatan 15 menit.<br>- **Pemilihan shift diserahkan mandiri ke masing-masing personal crew** di form presensi.<br>- **Wajib hanya absen masuk; absen pulang tidak wajib (opsional)**. |
| **Q03** | Foto & Bukti Kehadiran | **DITETAPKAN & AKTIF** | Foto wajah atau foto lokasi dalam toko/kantor via kamera atau upload foto. Toko dilengkapi fasilitas Wi-Fi. |
| **Q04** | Jadwal Libur Tim Resmi | **DITETAPKAN & AKTIF** | - **Staff Kantor**: Fahry, Fauzi, Miftah (Libur Ahad).<br>- **Admin**: Eka (Libur Selasa).<br>- **Crew Toko Bekasi**: Adit (Senin), Mufti (Kamis), Kamal (Rabu).<br>- **Crew Toko Cikarang**: Milkan (Kamis), Refan (Selasa).<br>Tercatat pada tabel `day_off_rules` dan `employee_schedules`. |
| **Q05** | Uang Makan & Kunjungan Luar | **DITETAPKAN & AKTIF** | - Uang makan Rp10.000 hanya diberikan jika hadir fisik toko (`attendance_type = 'hadir'`).<br>- Disediakan tombol khusus **Kunjungan Luar** (`attendance_type = 'kunjungan_luar'`) yang **TIDAK mendapat uang makan**. |
| **Q06** | Slip Gaji (Upload PDF) | **DITETAPKAN & AKTIF** | Pada akun Manager/Owner disediakan formulir/tombol upload PDF slip gaji untuk masing-masing staf. Berkas PDF disimpan aman di direktori privat server dan diunduh langsung oleh staf penerima. |
| **Q07** | Batasan Hak Akses | **DITETAPKAN & AKTIF** | Hanya **Manager (Fauzi) dan Owner** yang memiliki akses administratif sensitif (kalkulasi draft payroll, upload PDF slip gaji staf, input komisi manual, dan koreksi absensi). Finalisasi resmi dilakukan oleh Owner. |
| **Q08** | Input Komisi / Penyesuaian | **DITETAPKAN & AKTIF** | Disediakan form input modal di dashboard Manager/Owner untuk input komisi penjualan atau penyesuaian nominal sebelum payroll difinalisasi. |
| **Q09** | Retensi Foto Absensi | **DITETAPKAN & AKTIF** | Masa retensi foto ditetapkan **7 hari**. Skrip pembersihan `scripts/cleanup-old-photos.js` disediakan untuk menghapus file fisik foto yang melewati 7 hari. |
| **Q10** | Akses Tailscale & Ponsel | **DITETAPKAN & AKTIF** | Server Express berjalan pada host `0.0.0.0:3000` dan dapat diakses dari PC maupun HP yang terhubung ke Tailscale di alamat `http://100.84.77.41:3000`. |
| **Q011** | Notifikasi WhatsApp | **DITETAPKAN & AKTIF** | Tersedia tautan pesan langsung WhatsApp (`api.whatsapp.com/send?phone=...`) untuk mengingatkan staf saat slip PDF diterbitkan, serta modul HTTP gateway untuk integrasi pihak ketiga. |

