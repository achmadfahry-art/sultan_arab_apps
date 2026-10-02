# SULTAN ARAB APP — Panduan Rilis, Backup, dan Migrasi ke VPS

Dokumen ini memuat prosedur operasional standar untuk mencadangkan data (backup), memulihkan (restore), serta memindahkan aplikasi dan database **SULTAN ARAB APP** dari server lokal ke Virtual Private Server (VPS).

---

## 1. Prosedur Backup Data Lokal

Sistem memiliki dua komponen data yang wajib dibackup:
1. **Database PostgreSQL**: Berisi akun, tabel absensi, jadwal, komponen payroll, dan riwayat audit.
2. **Direktori Berkas Privat (`storage/`)**: Berisi foto bukti absensi masuk/pulang dan arsip slip gaji.

### Script Backup Database:
```bash
# Membuat dump SQL terkompresi
pg_dump -h localhost -p 5433 -U postgres -F c -b -v -f "sultan_arab_backup_$(date +%Y%m%d_%H%M%S).dump" sultan_arab_app
```

### Script Backup Direktori Berkas Foto & Slip:
```bash
# Mengarsipkan folder storage
tar -czvf "sultan_arab_storage_$(date +%Y%m%d_%H%M%S).tar.gz" storage/
```

---

## 2. Prosedur Restore (Pemulihan)

### Restore Database pada Server Baru:
```bash
# 1. Buat database baru jika belum ada
createdb -h localhost -U postgres sultan_arab_app

# 2. Pulihkan struktur dan data
pg_restore -h localhost -U postgres -d sultan_arab_app -v "nama_file_backup.dump"
```

### Restore Berkas Foto & Slip:
```bash
# Ekstrak arsip ke direktori proyek
tar -xzvf "sultan_arab_storage_xxxx.tar.gz" -C ./
```

---

## 3. Panduan Deployment ke VPS (Ubuntu / Debian)

### Langkah 1: Persiapan Server VPS
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git postgresql postgresql-contrib nginx

# Pasang Node.js v20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Langkah 2: Setup Database PostgreSQL VPS
```bash
sudo -u postgres psql
# Di dalam prompt PostgreSQL:
CREATE USER sultan_user WITH PASSWORD 'GantiDenganPasswordSangatKuat2026!';
CREATE DATABASE sultan_arab_app OWNER sultan_user;
GRANT ALL PRIVILEGES ON DATABASE sultan_arab_app TO sultan_user;
\q
```

### Langkah 3: Deploy Aplikasi & Jalankan Migrasi
```bash
cd /var/www
git clone <url_repo> sultan_arab_apps
cd sultan_arab_apps
npm install --production

# Konfigurasi .env produksi
cp .env.example .env
nano .env
# Ubah DATABASE_URL menjadi:
# DATABASE_URL=postgresql://sultan_user:GantiDenganPasswordSangatKuat2026!@localhost:5432/sultan_arab_app

# Jalankan migrasi skema
npm run db:migrate
```

### Langkah 4: Setup Systemd Service (Agar Aplikasi Berjalan Otomatis)
Buat berkas `/etc/systemd/system/sultan-arab.service`:
```ini
[Unit]
Description=SULTAN ARAB APP Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/sultan_arab_apps
ExecStart=/usr/bin/node apps/server/src/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/var/www/sultan_arab_apps/.env

[Install]
WantedBy=multi-user.target
```

Aktifkan service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable sultan-arab
sudo systemctl start sultan-arab
sudo systemctl status sultan-arab
```

### Langkah 5: Setup Nginx & HTTPS (SSL Gratis dengan Certbot)
Salin berkas konfigurasi dari `deploy/nginx_vps.conf` ke `/etc/nginx/sites-available/sultan-arab.conf`:
```bash
sudo ln -s /etc/nginx/sites-available/sultan-arab.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Pasang SSL gratis Let's Encrypt
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d absensi.sultanarab.com
```

Dengan langkah di atas, aplikasi dapat diakses dengan domain ber-HTTPS resmi, sehingga akses kamera ponsel dan GPS berjalan lancar bagi seluruh karyawan toko di semua cabang.
