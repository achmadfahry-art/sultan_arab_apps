# SULTAN ARAB APP — Panduan Setup & Menjalankan Lokal

Dokumen ini menjelaskan langkah demi langkah untuk menjalankan aplikasi **SULTAN ARAB APP** (Backend Express, Frontend Full Web Responsif Ponsel/PC, dan PostgreSQL Mandiri) pada komputer lokal, serta persiapan pemindahan ke VPS.

---

## 1. Prasyarat Sistem

1. **Node.js**: Versi 20+ (Telah terverifikasi pada Node.js v24.19.0).
2. **PostgreSQL**: Versi 16+ (Telah terverifikasi pada PostgreSQL 18.3).
3. **OS**: Windows (pengembangan lokal saat ini) atau Linux Ubuntu/Debian (untuk VPS kelak).

---

## 2. Struktur Proyek

```text
sultan_arab_apps/
├── apps/
│   ├── server/           # Backend Express, Auth, REST API v1, Middleware
│   └── web/              # Frontend Full Web (HTML5, Modern CSS, SPA JS, Assets)
├── database/
│   ├── data/             # Cluster data PostgreSQL lokal mandiri
│   ├── migrations/       # Migrasi SQL (001_initial_schema, 002_seed_test_data)
│   └── tests/            # Verifikasi integritas skema database
├── deploy/               # Konfigurasi Nginx, reverse proxy VPS & HTTPS
├── docs/
│   ├── decisions.md      # Keputusan arsitektur & status pertanyaan Q01-Q11
│   ├── progress.md       # Status backlog T01-T12 & hasil pengujian
│   ├── setup.md          # Panduan ini
│   └── release.md        # Panduan backup, restore & migrasi VPS
├── scripts/              # Script otomatis (init-local-db, start, migrate, seed)
├── storage/              # Direktori privat (attendance-photos, payslips)
├── tests/                # Test suite otomatis (run_all_tests.js, verify_api.js)
├── .env.example          # Template konfigurasi tanpa rahasia
├── .env                  # Konfigurasi lokal aktif
├── fulus.md              # Acuan kebutuhan bisnis
└── blueprint_fulu.md     # Panduan teknis implementasi
```

---

## 3. Langkah Menjalankan Aplikasi Secara Lokal

### Langkah 1: Instal Dependensi
```bash
npm install
```

### Langkah 2: Inisialisasi & Jalankan PostgreSQL Mandiri Lokal
Aplikasi menyediakan database PostgreSQL lokal mandiri yang terisolasi di port **5433** (sehingga tidak bentrok dengan instalasi lain di port 5432):
```bash
# Inisialisasi cluster database (jika belum ada)
node scripts/init-local-db.js

# Menjalankan database server lokal
node scripts/start-local-db.js
```
*Catatan:* Pada Windows, database dapat dijalankan di background dengan `node scripts/start-local-db.js` atau via service.

### Langkah 3: Jalankan Migrasi & Data Uji
```bash
# Membuat database sultan_arab_app dan menjalankan skema + data uji
npm run db:migrate
```

### Langkah 4: Jalankan Server Aplikasi & Web
```bash
npm start
# Atau mode development (auto-reload):
npm run dev
```

Server akan aktif di:
👉 **`http://localhost:3000`**

Buka tautan tersebut di peramban (browser) PC atau ponsel Anda.

---

## 4. Akun Login untuk Pengujian & Operasional

### A. Akun Tim Operasional Resmi (Sesuai Q04)
Semua akun dibuat dengan password standar: `<username>123` (dapat diubah nanti).

| Nama | Role / Posisi | Username | Password | Penugasan Cabang | Jadwal Libur Resmi |
|---|---|---|---|---|---|
| **Fauzi** | Manager & Staff | `fauzi` | `fauzi123` | Head Quarter Bekasi | Ahad |
| **Fahry** | Staff Kantor | `fahry` | `fahry123` | Head Quarter Bekasi | Ahad |
| **Miftah** | Staff Kantor | `miftah` | `miftah123` | Head Quarter Bekasi | Ahad |
| **Eka** | Admin | `eka` | `eka123` | Head Quarter Bekasi | Selasa |
| **Adit** | Crew Toko | `adit` | `adit123` | Head Quarter Bekasi | Senin |
| **Mufti** | Crew Toko | `mufti` | `mufti123` | Head Quarter Bekasi | Kamis |
| **Kamal** | Crew Toko | `kamal` | `kamal123` | Head Quarter Bekasi | Rabu |
| **Milkan** | Crew Toko | `milkan` | `milkan123` | Cabang Cikarang | Kamis |
| **Refan** | Crew Toko | `refan` | `refan123` | Cabang Cikarang | Selasa |
| **Owner** | Owner | `owner` | `owner123` | Semua Cabang | - |

### B. Akun Cepat Pengujian (Data Uji)
- `ahmad` / `ahmad123` (Karyawan)
- `siti` / `siti123` (Karyawan)
- `manager` / `manager123` (Manager)
- `supervisor` / `spv123` (Supervisor)

*Tips:* Pada layar login telah disediakan tombol cepat (quick switch) untuk berpindah role dengan satu klik selama masa pengujian.

---

## 5. Menjalankan Pengujian Otomatis

Untuk memastikan database dan seluruh endpoint API bekerja sesuai blueprint dan keputusan Q01–Q11:
```bash
npm test
```
Script pengujian memverifikasi 24 tabel database, login, validasi GPS Haversine radius 150m, presensi masuk & pulang, presensi kunjungan luar (tanpa uang makan), upload slip PDF oleh Manager, link reminder WhatsApp, pengunduhan slip PDF oleh staf, serta retensi foto 7 hari.

---

## 6. Akses dari Handphone via Tailscale (Q10)

Aplikasi dapat diakses langsung oleh perangkat apa pun di jaringan Tailscale:
1. Pastikan aplikasi Tailscale aktif dan terhubung di Handphone Anda.
2. Buka peramban (Chrome / Safari) pada Handphone.
3. Gunakan salah satu alamat berikut:
   - ⭐ **HTTPS Resmi (Rekomendasi Terbaik untuk Kamera Live Streaming):**
     👉 **`https://fahry-work.tail0f1c60.ts.net`**
   - **HTTP IP Langsung:**
     👉 **`http://100.84.77.41:3000`**
4. Aplikasi SULTAN ARAB APP akan langsung tampil dengan antarmuka ponsel responsif.

---

## 7. Penggunaan Kamera & GPS di Ponsel

1. **Akses Kamera Multi-Mode**:
   - **Akses Kamera Bawaan HP (100% Berfungsi di Segala Kondisi):**
     Tersedia tombol **"📸 Buka Kamera HP Sekarang"**, **"🤳 Kamera Depan (Selfie)"**, dan **"🏪 Kamera Belakang (Toko)"**. Tombol ini langsung memicu aplikasi kamera bawaan Android / iOS untuk mengambil foto wajah atau toko secara jernih, bahkan saat diakses lewat HTTP IP biasa tanpa batasan keamanan browser.
   - **Live Viewfinder (Pratinjau Video Langsung):**
     Otomatis aktif saat diakses melalui `localhost` atau alamat HTTPS Tailscale **`https://fahry-work.tail0f1c60.ts.net`**. Dilengkapi tombol **"🔄 Balik Kamera"** untuk berganti antara kamera depan dan belakang.
   - Foto otomatis dioptimalkan ukurannya oleh sistem sehingga pengiriman data absen sangat cepat dan hemat kuota.
2. **Presensi Mandiri (Q02)**: Crew toko dapat memilih shift (Pagi 08:00–17:00 atau Siang 12:30–21:00) secara mandiri saat absen masuk.
3. **Kunjungan Luar (Q05)**: Gunakan tombol **"Kunjungan Luar"** jika sedang bertugas di luar toko (tidak mendapat uang makan Rp10.000).
4. **Pusat Unggah Slip Gaji PDF Pengelola (Q06 & Q07)**:
   - Fitur unggah PDF telah **disatukan di satu tempat**: **Dashboard Pengelola (`#management`) ➔ Tab "Slip Gaji PDF & Payroll"** (hanya untuk Manager & Owner).
   - Manager/Owner dapat mengunggah berkas PDF untuk tiap-tiap nama staf dan langsung mengirimkan notifikasi via tautan WhatsApp (Q011).
5. **Layar Slip Gaji Karyawan (`#payslips`)**:
   - Tampilan bersih **hanya menyediakan tombol unduhan berkas PDF resmi saja** dari unggahan pengelola. Tidak ada rincian/kalkulasi formula matematis yang membingungkan staf.


