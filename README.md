# 👑 SULTAN ARAB APP

<div align="center">
  <img src="apps/web/assets/logo_sultan_arab.jpg" alt="Logo Sultan Arab" width="120" style="border-radius: 50%; border: 3px solid #EFB52B; box-shadow: 0 4px 14px rgba(0,0,0,0.15);" />
  
  <h3>Sistem Absensi Multi-Cabang & Payroll Mandiri</h3>
  <p><strong>Aplikasi Full-Web Responsif (Ponsel & PC) dengan PostgreSQL Mandiri, Geofencing GPS Haversine, Kamera Presensi, dan Distribusi Slip Gaji PDF Resmi.</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Node.js-v20+-339933?logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/PostgreSQL-v18+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Architecture-Full--Web%20SPA-C90000" alt="Architecture" />
    <img src="https://img.shields.io/badge/Tests-16%2F16%20Passing-brightgreen" alt="Tests" />
    <img src="https://img.shields.io/badge/Status-Production%20Ready-EFB52B" alt="Status" />
  </p>
</div>

---

## 📌 Sekilas Proyek

**SULTAN ARAB APP** adalah aplikasi manajemen operasional absensi dan payroll karyawan multi-cabang yang dibangun khusus untuk operasional **Sultan Arab**. Aplikasi ini menggabungkan fleksibilitas penggunaan pada peramban ponsel (*mobile browser*) staf toko dan tampilan desktop luas untuk pengelola (*Manager & Owner*).

Sistem ini dirancang tanpa ketergantungan pihak ketiga yang mengikat (database mandiri PostgreSQL), siap berjalan di lingkungan server lokal, dan dapat dipindahkan (*lift-and-shift*) ke VPS Linux publik.

---

## 🌟 Fitur Utama & Keputusan Bisnis (Q01–Q11)

### 🏢 1. Multi-Cabang & Validasi Lokasi Geofencing (Q01)
- Mendukung cabang aktif:
  - **Head Quarter Bekasi (Pusat Grosir)**: Titik koordinat resmi dengan radius 150 meter.
  - **Cabang Cikarang**: Titik koordinat resmi dengan radius 150 meter.
- **Tombol `+ Cabang` Dinamis**: Pengelola (Owner/Manager) dapat menambahkan cabang baru langsung lewat dashboard pengelola lengkap dengan input koordinat / Google Maps, dan shift crew toko otomatis terbit.
- Perhitungan jarak akurat menggunakan formula **Haversine** di sisi server untuk memvalidasi presensi staf.

### ⏰ 2. Shift Mandiri & Toleransi Keterlambatan (Q02)
- Staf kantor dan admin bekerja dengan jam kerja reguler (**08:00 – 17:00 WIB**).
- Crew toko memilih shift kerja secara mandiri saat absen masuk:
  - **Shift Pagi**: 08:00 – 17:00 WIB
  - **Shift Siang**: 12:00 – 21:00 WIB
- Toleransi keterlambatan **15 menit** otomatis diperhitungkan sistem.
- **Wajib hanya absen masuk**, absen pulang bersifat fleksibel/opsional.

### 📸 3. Kamera Multi-Mode & Optimasi Otomatis (Q03)
- **Live Stream Viewfinder**: Pratinjau langsung kamera dengan fitur balik kamera depan (*selfie*) dan belakang (*toko*) pada koneksi aman HTTPS.
- **Pemicu Kamera Bawaan HP**: Dukungan pemicu kamera bawaan Android & iOS (`capture="user"` / `capture="environment"`) yang 100% berfungsi lancar di peramban HP bahkan lewat jaringan HTTP IP tanpa terblokir izin browser.
- **Auto-Kompresi**: Foto beresolusi tinggi otomatis dioptimalkan ke resolusi optimal (maks. 1280x960 piksel, ~150KB) sebelum diunggah sehingga proses absen instan dan hemat kuota.

### 🍱 4. Uang Makan & Kunjungan Luar (Q05)
- **Uang makan Rp10.000** hanya diberikan jika staf hadir secara fisik di area toko/kantor.
- Disediakan tombol **"Kunjungan Luar"** bagi staf yang bertugas di luar toko: absen berhasil tercatat tanpa batasan radius, namun **tidak mendapatkan uang makan**.

### 📄 5. Pusat Unggah Slip Gaji PDF Pengelola (Q06 & Q07)
- Disediakan khusus di **Dashboard Pengelola (`#management`) ➔ Tab "Slip Gaji PDF & Payroll"** untuk **Manager (Fauzi)** dan **Owner**.
- Manager/Owner dapat mengunggah berkas PDF untuk masing-masing nama staf, mengganti berkas, dan langsung mengirimkan notifikasi via WhatsApp.

### 📥 6. Unduhan Slip Gaji Staf Bersih (Tanpa Rincian Rumit)
- Layar **Slip Gaji (`#payslips`)** untuk karyawan/staf didesain sangat bersih: hanya menampilkan periode gaji, tanggal terbit, dan tombol utama **`📥 Unduh Slip Gaji (PDF)`**.
- Tidak ada kalkulasi matematis membingungkan bagi staf—dokumen resmi PDF dari pengelola menjadi satu-satunya acuan.

### 📲 7. Integrasi Notifikasi WhatsApp (Q011)
- Tautan pesan instan WhatsApp (`api.whatsapp.com/send?phone=...`) otomatis tersedia setelah berkas slip PDF staf diunggah oleh pengelola.

### 🛡️ 8. Anti Duplikasi & Retensi Foto 7 Hari (Q09)
- Proteksi idempotency token mencegah pencatatan presensi ganda akibat penekanan tombol berulang.
- Skrip retensi otomatis `scripts/cleanup-old-photos.js` membersihkan berkas foto lawas yang melewati 7 hari untuk menghemat ruang penyimpanan.

### 🌐 9. Akses Jaringan Lokal & Tailscale (Q10)
- Aplikasi diikat ke `0.0.0.0:3000` dan dapat diakses dari mana saja melalui Tailscale:
  - ⭐ **HTTPS Resmi (Rekomendasi Kamera Live):** 
  - **HTTP IP Langsung:** `http://100.84.77.41:3000`

---

## 👥 Roster & Akun Pengguna Resmi (Q04)

Semua akun terdaftar menggunakan kata sandi bawaan: 

| Nama | Role / Jabatan | Username | Penugasan Cabang | Hari Libur Tetap |
|---|---|---|---|---|
| **Fauzi** | **Manager & Staff** | `fauzi` | Head Quarter Bekasi | Ahad |
| **Fahry** | Staff Kantor | `fahry` | Head Quarter Bekasi | Ahad |
| **Miftah** | Staff Kantor | `miftah` | Head Quarter Bekasi | Ahad |
| **Eka** | Admin | `eka` | Head Quarter Bekasi | Selasa |
| **Adit** | Crew Toko | `adit` | Head Quarter Bekasi | Senin |
| **Mufti** | Crew Toko | `mufti` | Head Quarter Bekasi | Kamis |
| **Kamal** | Crew Toko | `kamal` | Head Quarter Bekasi | Rabu |
| **Milkan** | Crew Toko | `milkan` | Cabang Cikarang | Kamis |
| **Refan** | Crew Toko | `refan` | Cabang Cikarang | Selasa |
| **Owner** | **Owner Sultan Arab** | `owner` | Seluruh Cabang | - |

---

## 🏗️ Struktur Direktori Proyek

```text
sultan_arab_apps/
├── apps/
│   ├── server/           # Backend Express, REST API v1, Middleware Auth & CORS
│   │   └── src/          # Routes (auth, attendance, branches, employees, payroll, schedules)
│   └── web/              # Frontend Full Web SPA (HTML5, Vanilla JS, CSS Design System)
│       └── assets/       # Aset grafis & Logo Sultan Arab
├── database/
│   ├── migrations/       # Skema DDL & Seed (001_initial_schema, 002_seed, 003_roster)
│   └── tests/            # Script verifikasi 24 tabel database
├── deploy/               # Konfigurasi reverse proxy Nginx untuk VPS Linux
├── docs/                 # Dokumentasi proyek (setup.md, decisions.md, progress.md, release.md)
├── scripts/              # Script otomatisasi database, retensi foto, dan role switcher
├── storage/              # Direktori privat (attendance-photos, payslips PDF)
└── tests/                # Test suite otomatis komprehensif (run_all_tests.js, verify_api.js)
```

---

## 🚀 Panduan Memulai Cepat (Quick Start)

### 1. Prasyarat
- **Node.js**: Versi 20 ke atas.
- **PostgreSQL**: Versi 16 ke atas (port lokal: `5433` atau `5432`).

### 2. Kloning Repositori
```bash
git clone https://github.com/achmadfahry-art/sultan_arab_apps.git
cd sultan_arab_apps
```

### 3. Pasang Dependensi
```bash
npm install
```

### 4. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Sesuaikan `DATABASE_URL` dengan kredensial PostgreSQL Anda:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/sultan_arab_app
PORT=3000
SESSION_SECRET=sultan_arab_secret_key_development_2026
```

### 5. Jalankan Migrasi Database
```bash
node scripts/migrate.js
```

### 6. Jalankan Server
```bash
npm start
# atau
node apps/server/src/index.js
```
Aplikasi dapat dibuka di browser:
👉 **`http://localhost:3000`**

---

## 🧪 Pengujian Otomatis (Automated Testing)

Proyek ini dilengkapi test suite terpadu yang memverifikasi 24 tabel database, aturan presensi, perhitungan payroll, akses slip gaji, dan otentikasi peran:

```bash
node tests/run_all_tests.js
```

**Hasil Pengujian:**
- ✅ **Tahap 1: Verifikasi Skema**: 24 tabel wajib dan integritas relasi lolos 100%.
- ✅ **Tahap 2: Pengujian Endpoint API**: 16/16 skenario pengujian bisnis lolos 100%.

---

## 📖 Dokumentasi Terkait

- 📘 [Panduan Instalasi & Pengoperasian Lengkap](docs/setup.md)
- 📗 [Catatan Keputusan Bisnis Q01–Q11](docs/decisions.md)
- 📙 [Log Kemajuan & Verifikasi](docs/progress.md)
- 📕 [Panduan Backup & Rilis VPS](docs/release.md)

---

## 📄 Lisensi & Hak Cipta
Hak Cipta © 2026 **Sultan Arab**. Seluruh hak cipta dilindungi undang-undang.
Dikelola oleh Tim Pengembang Sultan Arab.
