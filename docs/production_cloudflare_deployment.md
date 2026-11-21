# PANDUAN DEPLOYMENT PRODUKSI & AKSES PUBLIK (CLOUDFLARE TUNNEL)
**SULTAN ARAB APP — Sistem Presensi, Manajemen Karyawan & Payroll**

Dokumen ini mencatat arsitektur jaringan, server produksi aktif di **`vps-sultanarab`**, konfigurasi Cloudflare Tunnel, serta Standar Operasional Prosedur (SOP) rilis dan backup.

> [!NOTE] Pembaruan Arsitektur (`21 Nov 2026`)
> Produksi resmi telah dipindahkan dari workstation/laptop toko Windows lama (`sultanarab-server` / `100.86.176.62` / `C:\sultan_arab_apps`) ke **`vps-sultanarab`** (`VM-0-3-ubuntu` Linux 24/7). Jangan deploy ke host Windows lama tersebut.

---

## 1. Identitas Domain & Akses Publik

* **Domain Utama**: `sultanarab.store` (Hostinger DNS dikelola via Cloudflare)
* **URL Aplikasi Resmi**: **`https://absen.sultanarab.store`**
* **Keamanan SSL / HTTPS**: Otomatis melalui Cloudflare Tunnel + Universal SSL. Seluruh request browser ponsel/PC terenkripsi HTTPS sehingga kamera presensi dan GPS cabang berjalan lancar.

---

## 2. Spesifikasi Server Produksi Aktif (`vps-sultanarab`)

* **Hostname**: `VM-0-3-ubuntu` (SSH alias: `vps-sultanarab`)
* **Sistem Operasi**: Ubuntu Linux (Cloud VPS 24/7)
* **Alamat Jaringan Privat (Tailscale)**: `100.121.167.83`
* **Akses SSH Remote**:
  * Alias: `ssh vps-sultanarab` (user `ubuntu`, kunci SSH `~/.ssh/id_ed25519`)
* **Direktori Aplikasi**: `/home/ubuntu/sultan_arab_apps`
* **Repositori Git**: `https://github.com/achmadfahry-art/sultan_arab_apps.git` (branch `main`)
* **Basis Data**: PostgreSQL 18 (`postgresql.service`)
  * Port lokal: `5432`
  * Nama Database: `sultan_arab_app`
  * Konfigurasi koneksi disimpan di `/home/ubuntu/sultan_arab_apps/.env` (`DATABASE_URL`, jangan ditulis ke dokumen/Git)
* **Process Manager**: **PM2**
  * Nama proses: `sultan-app`
  * Entry point: `/home/ubuntu/sultan_arab_apps/apps/server/src/index.js` (port internal `3000`)
  * Log: `/home/ubuntu/.pm2/logs/sultan-app-out-0.log` & `sultan-app-error-0.log`

---

## 3. Konfigurasi Cloudflare Tunnel

Trafik publik `https://absen.sultanarab.store` diteruskan oleh service systemd **`cloudflared.service`** di `vps-sultanarab`:
* **Executable & Unit**: `/usr/bin/cloudflared --no-autoupdate tunnel run --token-file /etc/cloudflared/token`
* **Status & Kelola**: `sudo systemctl status cloudflared`
* **Routing Public Hostname**:
  * `absen.sultanarab.store` $\rightarrow$ `http://localhost:3000` (terpisah dari `sultanarab.id` yang dilayani container `woo_wordpress`).

---

## 4. Konfigurasi Lingkungan (`.env`) di Server Produksi

Lokasi file privat di server: `/home/ubuntu/sultan_arab_apps/.env` (lihat struktur variabel di [`.env.example`](../.env.example), nilai rahasia tetap berada hanya di server).

---

## 5. SOP Deploy Update ke Produksi (`vps-sultanarab`)

### A. Alur Rilis & Update Kode
1. Kembangkan dan uji di komputer dev (`d:\Antigravity_project\sultan_arab_apps`).
2. Commit dan push perubahan ke GitHub:
   ```bash
   git add .
   git commit -m "feat/fix: deskripsi pembaruan"
   git push origin main
   ```
3. Masuk ke `vps-sultanarab`, backup database, tarik kode terbaru, jalankan migrasi, lalu restart PM2:
   ```bash
   ssh vps-sultanarab
   cd /home/ubuntu/sultan_arab_apps
   mkdir -p backups
   set -a; source .env; set +a
   pg_dump "$DATABASE_URL" -Fc -f "backups/pre_deploy_$(date +%Y%m%d_%H%M%S).dump"
   git pull origin main
   npm install --production   # jika ada perubahan dependensi di package.json
   npm run db:migrate         # jika ada file baru di database/migrations/
   pm2 restart sultan-app
   pm2 list
   ```
4. Verifikasi endpoint produksi:
   ```bash
   curl -s https://absen.sultanarab.store/api/health
   ```

### B. Prosedur Backup Berkala
* **Backup Database**:
  ```bash
  set -a; source /home/ubuntu/sultan_arab_apps/.env; set +a
  pg_dump "$DATABASE_URL" -Fc -f "/home/ubuntu/sultan_arab_apps/backups/sultan_arab_$(date +%Y%m%d_%H%M%S).dump"
  ```
* **Backup Direktori Storage (Foto Bukti & Slip Gaji)**:
  ```bash
  tar -czf "/home/ubuntu/sultan_arab_apps/backups/storage_$(date +%Y%m%d_%H%M%S).tar.gz" -C /home/ubuntu/sultan_arab_apps storage
  ```

---

## 6. Menambahkan Subdomain / Aplikasi Baru di Tunnel yang Sama

1. Jalankan aplikasi baru di port internal berbeda (mis. `4000`, `5000`).
2. Tambahkan *Public Hostname* baru pada tunnel yang dikelola `cloudflared.service` di Cloudflare Zero Trust Dashboard ke `http://localhost:<port>` — tidak perlu memasang daemon `cloudflared` baru.
