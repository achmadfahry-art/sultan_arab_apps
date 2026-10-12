# PANDUAN DEPLOYMENT PRODUKSI & AKSES PUBLIK (CLOUDFLARE TUNNEL)
**SULTAN ARAB APP — Sistem Presensi, Manajemen Karyawan & Payroll**

Dokumen ini mencatat seluruh informasi arsitektur jaringan, server produksi lokal, kredensial akses, konfigurasi Cloudflare Tunnel, serta Standar Operasional Prosedur (SOP) untuk revisi fitur/tampilan dan penambahan aplikasi baru di masa depan.

---

## 1. Identitas Domain & Akses Publik

* **Domain Utama**: `sultanarab.store` (Dibeli di Hostinger)
* **URL Aplikasi Resmi**: **`https://absen.sultanarab.store`**
* **Pengelola DNS & CDN**: Cloudflare (Paket Free)
  * Nameserver 1: `lia.ns.cloudflare.com`
  * Nameserver 2: `neil.ns.cloudflare.com`
* **Keamanan SSL / HTTPS**: Otomatis melalui Cloudflare Universal SSL. Seluruh request dari browser ponsel dan PC dienkripsi HTTPS sehingga sensor kamera (selfie presensi) dan GPS (geolokasi cabang) diizinkan oleh browser.

---

## 2. Spesifikasi Komputer Server Lokal

Aplikasi dan basis data berjalan secara mandiri pada perangkat fisik lokal di cabang:

* **Nama Komputer (Hostname)**: `sultanarab-server` (identitas fisik: `LAPTOP-0D0R5FD2`)
* **Sistem Operasi**: Windows 11 / Windows 10 (x64)
* **Alamat Jaringan Privat (Tailscale)**: `100.86.176.62`
* **Akses SSH Remote**:
  * Host: `100.86.176.62`
  * Port: `22`
  * User: `darmawan store`
  * Password: `bismillah`
* **Direktori Aplikasi**: `C:\sultan_arab_apps`
* **Repositori Git**: `https://github.com/achmadfahry-art/sultan_arab_apps.git`
* **Basis Data**: PostgreSQL 18
  * Port: `5432` (Lokal)
  * Nama Database: `sultan_arab_app`
  * User DB: `postgres`
* **Service Aplikasi Otomatis**:
  * Dikelola oleh **Windows Scheduled Task**: `SultanArabApp`
  * Script eksekusi: `C:\sultan_arab_apps\start_server.bat`
  * Log server: `C:\sultan_arab_apps\server.log`
  * Port internal: `http://localhost:3000`
* **Keamanan Daya & Perilaku Fisik (Power Policy)**:
  * **Tombol Power Fisik**: `Do Nothing` (Nilai `0` — jika terpencet tidak sengaja, server **tidak akan mati/sleep**).
  * **Tutup Layar (Lid Close)**: `Do Nothing` (Nilai `0` — layar aman ditutup tanpa membuat server mati).
  * **Sleep / Standby Timeout**: `Never Sleep` (Nilai `0 detik` — server tidak pernah masuk mode tidur).

---

## 3. Konfigurasi Cloudflare Tunnel (Zero Trust)

Koneksi dari internet publik (`https://absen.sultanarab.store`) ke laptop server (`localhost:3000`) dihubungkan melalui **Cloudflare Tunnel (cloudflared)** tanpa perlu IP Publik Statis maupun Port Forwarding.

* **Nama Tunnel**: `sultan-arab-tunnel`
* **Tunnel ID**: `8423fd94-6e66-4ed2-b0d2-080b3d68f0a4`
* **Token Tunnel**:
  ```text
  eyJhIjoiZmFjNDNlZTU3MmVmYTQ5YThjMWI5OThkZWRkMWE0ZjMiLCJ0IjoiODQyM2ZkOTQtNmU2Ni00ZWQyLWIwZDItMDgwYjNkNjhmMGE0IiwicyI6Ik56Z3dPV0UwTURNdFpESXlPQzAwTlRrNUxUaGtaakF0TmpoaFlXUmtZV1EzWWpJNCJ9
  ```
* **Executable di Server**: `C:\cloudflared\cloudflared.exe`
* **Service Name**: `Cloudflared` (Windows Service, StartType: Automatic)
* **Routing Public Hostname**:
  * Subdomain: `absen`
  * Domain: `sultanarab.store`
  * Service Type: `HTTP`
  * Service URL: `localhost:3000`

---

## 4. Konfigurasi Lingkungan (`.env`) di Server Produksi

Berkas konfigurasi di `C:\sultan_arab_apps\.env`:
```ini
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://absen.sultanarab.store
DATABASE_URL=postgresql://postgres@localhost:5432/sultan_arab_app
UPLOAD_ROOT=./storage
SESSION_SECRET=sultan_arab_secret_production_2026
SESSION_MAX_AGE_MS=86400000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://100.86.176.62:3000,http://100.84.77.41:3000,https://100.86.176.62:3000,https://absen.sultanarab.store
```

---

## 5. SOP Pemeliharaan & Prosedur Revisi Fitur / Tampilan

Jika ada pembaruan kode (revisi frontend, penambahan fitur API, atau migrasi database):

### A. Alur Update Kode & Rilis ke Produksi
1. Lakukan pengembangan dan pengujian di komputer dev lokal (`d:\Antigravity_project\sultan_arab_apps`).
2. Commit dan push perubahan ke GitHub:
   ```bash
   git add .
   git commit -m "feat/fix: deskripsi pembaruan"
   git push origin main
   ```
3. Hubungkan ke server produksi via SSH (`100.86.176.62`) lalu jalankan:
   ```powershell
   # 1. Masuk ke folder aplikasi dan tarik kode terbaru
   cd C:\sultan_arab_apps
   git pull origin main

   # 2. Jika ada dependensi baru:
   npm install --production

   # 3. Jika ada migrasi database SQL baru:
   npm run db:migrate

   # 4. Restart aplikasi agar kode baru aktif:
   Stop-Process -Name node -Force -ErrorAction SilentlyContinue
   Start-ScheduledTask -TaskName SultanArabApp
   ```

### B. Prosedur Backup Berkala
* **Backup Database**:
  ```powershell
  & "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -p 5432 -F c -b -v -f "C:\sultan_arab_apps\backups\sultan_arab_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump" sultan_arab_app
  ```
* **Backup Direktori Storage (Foto Bukti & Slip Gaji)**:
  Arsipkan folder `C:\sultan_arab_apps\storage` secara berkala ke flashdisk atau cloud drive.

---

## 6. Panduan Menambahkan Aplikasi Baru di Masa Depan

Jika suatu saat ingin membuat aplikasi baru (misal: POS Kasir, E-commerce, Inventory, atau Dashboard Owner):

1. **Gunakan Port Berbeda di Komputer yang Sama**:
   * Contoh:
     * Sultan Arab App Presensi: Port `3000`
     * Aplikasi Kasir / POS: Port `4000`
     * Dashboard Reporting: Port `5000`
2. **Tidak Perlu Pasang Cloudflared Baru!**:
   * Cloudflared service yang sudah terpasang dapat melayani banyak subdomain sekaligus.
3. **Cukup Tambah Route di Cloudflare Dashboard**:
   * Buka Cloudflare Zero Trust -> **Networks** -> **Tunnels** -> Pilih `sultan-arab-tunnel`.
   * Klik **Configure** -> Tab **Public Hostnames** -> Klik **Add a public hostname**:
     * Subdomain: `kasir` (atau nama aplikasi baru)
     * Domain: `sultanarab.store`
     * Type: `HTTP`
     * URL: `localhost:4000` (sesuai port aplikasi baru)
   * Klik **Save hostname**.
   * Aplikasi baru otomatis langsung dapat diakses di `https://kasir.sultanarab.store` ber-HTTPS resmi!
