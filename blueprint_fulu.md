# SULTAN ARAB APP — Blueprint teknis implementasi

## Instruksi awal untuk tugas implementasi

Baca [fulus.md](fulus.md), dokumen ini, dan instruksi repositori sebelum bekerja. `fulus.md` menjadi acuan kebutuhan bisnis; bagian teknis di sini merupakan rancangan awal yang dapat disesuaikan dengan kode dan dependensi yang benar-benar tersedia. Permintaan penyusunan dokumen ini belum memulai pembangunan aplikasi.

Saat pembangunan diminta, kerjakan fondasi yang tidak bergantung pada keputusan terbuka terlebih dahulu. Ajukan pertanyaan terarah menggunakan ID Q01–Q11 di `fulus.md` untuk bagian yang membutuhkan jawaban. Jangan menghentikan semua pekerjaan hanya karena rumus payroll atau lampiran belum lengkap. Jangan mengaktifkan aturan operasional dengan nilai tebakan.

## 1. Status dan dasar rancangan

Dokumen pendamping `fulus.md` ini membedakan **acuan percakapan**, **usulan implementasi**, dan **hal yang perlu dikonfirmasi**. Riwayat rinci dan lampiran belum tersedia; blueprint ini belum merupakan spesifikasi bisnis final.

Acuan terbaru pengguna, 1 Oktober 2026: **full web dengan tampilan web phone dan web PC, PostgreSQL mandiri lokal dan dapat dipindahkan ke VPS**. Keputusan ini menggantikan Flutter Android dan Supabase. Kebutuhan multi-cabang, role Karyawan/Owner/Manager/Supervisor, GPS, foto lokasi, shift otomatis, libur rolling/fleksibel, payroll periode 27–26, uang makan Rp10.000, komisi sales manual, dan slip gaji tetap menjadi acuan bisnis.

Seluruh skema, endpoint, alur persetujuan, matriks izin, dan roadmap di bawah adalah **usulan teknis** untuk menerapkan acuan tersebut. Tidak menetapkan rumus bisnis yang belum diketahui.

## 2. Arsitektur

```text
Web phone                       Web PC
  login, absensi, riwayat           cabang, karyawan, jadwal,
  dan slip gaji                     monitoring, payroll, slip
           \                         /
          HTTPS → Backend aplikasi
          login, izin, API, payroll, audit
               |             |
       PostgreSQL lokal   Direktori berkas privat
          (kelak VPS)       foto dan slip
```

- Dua tampilan memakai satu backend, identitas pengguna dan sumber data yang sama.
- PostgreSQL menjadi sumber data bersama.
- Backend memeriksa izin per pengguna/cabang pada setiap operasi. PostgreSQL RLS dapat ditambahkan sebagai lapisan tambahan bila konteks pengguna pada koneksi diimplementasikan dan diuji; tidak bergantung pada Supabase.
- Browser hanya mengakses backend; kredensial database disimpan di server. Operasi sensitif dijalankan secara transaksional pada backend.
- Framework web/backend, metode login, OS server, konfigurasi HTTPS, dan layanan notifikasi belum dipilih. Satu aplikasi responsif merupakan usulan implementasi untuk dua tampilan.
- Usulan: pisahkan lingkungan pengembangan, pengujian, dan produksi; simpan migrasi database dalam repositori.

## 3. Modul

| Modul | Lingkup |
|---|---|
| Identitas dan izin | Login, profil, role, cakupan cabang |
| Master data | Cabang, karyawan, impor Excel |
| Jadwal | Definisi shift, penugasan shift, hari libur |
| Absensi | Masuk/pulang, GPS, foto lokasi, riwayat, monitoring |
| Payroll | Periode, input komponen, komisi manual, perhitungan, pemeriksaan |
| Slip gaji | Penerbitan dan akses slip pribadi |
| Operasional | Storage, audit, backup, pemantauan kesalahan |
| Notifikasi | Modul opsional; kanal dan pemicu perlu disepakati |

## 4. Usulan skema PostgreSQL

Gunakan UUID untuk ID, `timestamptz` untuk kejadian, `date` untuk hari kerja, dan `numeric` untuk nilai uang. Zona waktu operasional cabang harus ditetapkan; jangan menyimpulkannya hanya dari zona waktu pengguna chat.

| Tabel | Kolom utama yang disarankan | Fungsi |
|---|---|---|
| `users` | `id`, `login_identifier`, `password_hash`, `active`, `created_at` | Akun lokal aplikasi; metode login perlu dikonfirmasi |
| `sessions` | `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at` | Usulan sesi login server |
| `profiles` | `id` FK users.id, `display_name`, `active` | Identitas aplikasi |
| `roles` | `id`, `code` | Karyawan, Owner, Manager, Supervisor |
| `user_roles` | `user_id`, `role_id` | Role pengguna |
| `branches` | `id`, `code`, `name`, `timezone`, `latitude`, `longitude`, `radius_m`, `active` | Cabang; GPS/radius menunggu aturan |
| `user_branch_access` | `user_id`, `branch_id` | Cakupan akses pengelola |
| `employees` | `id`, `user_id`, `employee_code`, `name`, `active` | Master karyawan |
| `employee_assignments` | `id`, `employee_id`, `branch_id`, `valid_from`, `valid_to` | Riwayat penempatan |
| `shifts` | `id`, `branch_id`, `name`, `start_time`, `end_time`, `crosses_midnight` | Definisi shift |
| `work_schedules` | `id`, `employee_id`, `branch_id`, `work_date`, `shift_id` | Jadwal efektif |
| `days_off` | `id`, `employee_id`, `off_date`, `reason`, `created_by` | Jadwal libur |
| `attendance_sessions` | `id`, `employee_id`, `branch_id`, `work_date`, `shift_id`, `status` | Sesi absensi |
| `attendance_events` | `id`, `session_id`, `event_type`, `server_time`, `device_time`, `latitude`, `longitude`, `accuracy_m`, `photo_path`, `idempotency_key` | Bukti masuk/pulang |
| `attendance_adjustments` | `id`, `session_id`, `reason`, `before_data`, `after_data`, `actor_id` | Jejak koreksi jika diizinkan |
| `payroll_periods` | `id`, `start_date`, `end_date`, `label`, `status` | Periode 27–26 |
| `pay_components` | `id`, `code`, `name`, `kind` | Komponen pendapatan/potongan; jenis aktual belum diketahui |
| `employee_pay_settings` | `id`, `employee_id`, `component_id`, `amount`, `valid_from`, `valid_to` | Nilai komponen efektif |
| `manual_commissions` | `id`, `employee_id`, `period_id`, `amount`, `note`, `entered_by` | Input komisi sales manual |
| `payroll_runs` | `id`, `period_id`, `version`, `status`, `created_by`, `finalized_at` | Proses payroll |
| `payroll_items` | `id`, `run_id`, `employee_id`, `earnings`, `deductions`, `net_pay`, `calculation_snapshot` | Hasil per karyawan |
| `payroll_item_lines` | `id`, `item_id`, `component_id`, `quantity`, `rate`, `amount`, `source_reference` | Rincian perhitungan |
| `payslips` | `id`, `item_id`, `storage_path`, `published_at` | Slip terbit |
| `audit_logs` | `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `changes`, `created_at` | Audit perubahan sensitif |

Usulan batasan: foreign key konsisten; kode karyawan/cabang unik; nilai uang divalidasi sesuai jenis; tanggal akhir tidak sebelum tanggal awal; idempotency key unik untuk mencegah absensi ganda akibat pengiriman ulang. Batas jumlah sesi per hari harus mengikuti aturan shift, belum boleh dipatok satu sesi per hari.

Tabel izin/sakit, lembur, pinjaman, pajak, dan BPJS tidak dijadikan kebutuhan wajib tanpa sumber tambahan.

## 5. Alur absensi yang disarankan

1. Karyawan login; server memeriksa status aktif dan penempatan cabang.
2. Aplikasi menampilkan cabang yang diizinkan. Pemilihan manual atau deteksi otomatis menunggu keputusan bisnis.
3. Tentukan jadwal/shift efektif. Logika shift otomatis baru ditulis setelah jam dan aturan pemilihannya tersedia.
4. Ambil GPS beserta akurasi dan foto lokasi sesuai aturan yang disetujui.
5. Unggah foto ke area sementara privat dan kirim permintaan masuk/pulang dengan idempotency key.
6. Server memvalidasi pengguna, cabang, jadwal, urutan kejadian, kepemilikan foto, dan aturan lokasi yang sudah dikonfigurasi.
7. Simpan kejadian secara transaksional dan kirim konfirmasi; waktu server digunakan untuk pencatatan, waktu perangkat disimpan sebagai bukti tambahan.
8. Riwayat karyawan serta dashboard menampilkan hasil yang sama.

Usulan penanganan kegagalan: tampilkan status belum terkirim dengan jelas, gunakan key yang sama saat mencoba ulang, dan bersihkan foto sementara yang tidak terkait kejadian. Penerimaan absensi offline belum disepakati dan tidak boleh otomatis dianggap berhasil.

Koreksi, jika diperbolehkan, wajib memiliki alasan serta jejak sebelum/sesudah. Geofence, toleransi, penanganan GPS tidak akurat, dan shift lintas tengah malam perlu spesifikasi sebelum diterapkan.

## 6. Jadwal libur

Usulan: simpan tanggal libur efektif per karyawan, tampilkan kalender cabang, dan catat pembuat/perubahan jadwal. Model ini mendukung rolling maupun perubahan fleksibel tanpa mengasumsikan pola rotasi tertentu.

Kuota, benturan shift, batas staf minimum, proses persetujuan, dan dampak terhadap gaji masih perlu dikonfirmasi. Generator jadwal otomatis menunggu aturan tersebut.

## 7. Alur payroll

1. Buat periode tanggal 27 sampai 26 bulan berikutnya. Interpretasi batas inklusif dan label periode perlu dikonfirmasi.
2. Ambil snapshot karyawan, penempatan, jadwal, absensi, dan pengaturan gaji efektif untuk periode itu.
3. Masukkan komisi sales secara manual dengan pelaku input dan catatan.
4. Hitung setiap komponen menggunakan aturan yang telah diverifikasi dari dokumentasi dan Excel.
5. Tampilkan rincian, sumber data, dan masalah untuk pemeriksaan.
6. Usulan status: `draft → reviewed → finalized → published`; role yang berwenang pada setiap tahap belum ditetapkan.
7. Simpan hasil final dan rincian perhitungan, lalu terbitkan slip sesuai contoh asli.
8. Usulan: hasil yang sudah terbit dikoreksi melalui versi baru dengan audit, agar slip lama tetap dapat ditelusuri.

Struktur umum yang diusulkan: `gaji bersih = total pendapatan yang berlaku − total potongan yang berlaku`. Komponen aktual dan rumus belum diketahui.

**Rp10.000 belum boleh dikalikan jumlah hari hadir tanpa konfirmasi satuan dan syaratnya.** Jangan mengaktifkan payroll otomatis bila aturan belum lengkap. Komisi manual tidak menyiratkan perhitungan otomatis dari penjualan.

## 8. Usulan role permissions

Matriks berikut untuk pembahasan, bukan izin yang sudah disepakati.

| Operasi | Karyawan | Supervisor | Manager | Owner |
|---|---|---|---|---|
| Absensi dan riwayat sendiri | Ya | Bila juga terdaftar sebagai karyawan | Bila juga terdaftar sebagai karyawan | Bila juga terdaftar sebagai karyawan |
| Slip sendiri | Ya | Bila memiliki slip | Bila memiliki slip | Bila memiliki slip |
| Monitoring absensi | Sendiri | Cabang yang ditugaskan | Cabang yang ditugaskan | Semua cabang |
| Jadwal/libur | Lihat sendiri | Usulan kelola cabang | Usulan kelola cakupan | Usulan semua cabang |
| Master cabang/karyawan | Lihat profil sendiri | Perlu konfirmasi | Usulan sesuai cakupan | Usulan semua cabang |
| Input komisi/payroll | Tidak | Perlu konfirmasi | Perlu konfirmasi | Perlu konfirmasi |
| Finalisasi/terbitkan slip | Tidak | Perlu konfirmasi | Perlu konfirmasi | Usulan berwenang |

Usulan otorisasi backend: karyawan membaca data sendiri; pengelola mengikuti cakupan cabang; perubahan role hanya melalui operasi server berwenang. Payroll dan foto tidak menggunakan akses publik. Uji endpoint dengan identitas berbeda, bukan hanya penyembunyian menu. Akun database aplikasi memakai hak minimum; browser tidak memperoleh akses database.

## 9. API/endpoint yang disarankan

Nama berikut merupakan kontrak logis untuk API backend aplikasi, misalnya dengan prefix `/api/v1`; bukan endpoint yang sudah tersedia. Backend mengakses PostgreSQL dengan query berparameter dan transaksi.

| Operasi | Endpoint logis | Catatan |
|---|---|---|
| Login/sesi | `POST /auth/login`, `POST /auth/logout`, `GET /auth/session` | Usulan sesi cookie HttpOnly; reset akun menunggu metode login |
| Profil dan cakupan | `GET /me` | Role, karyawan, cabang yang diizinkan |
| Master cabang | `GET /branches` | Filter sesuai izin |
| Master karyawan | `GET/POST/PATCH /employees` | Akses kelola sesuai matriks final |
| Jadwal pribadi | `GET /me/schedules` | Rentang tanggal |
| Atur jadwal/libur | `POST/PATCH /schedules`, `/days-off` | Validasi kewenangan |
| Upload foto | `POST /attendance/photo-upload` | Path/upload token terbatas |
| Masuk/pulang | `POST /attendance/check-in`, `/attendance/check-out` | GPS, foto, key; waktu final dari server |
| Riwayat | `GET /me/attendance` | Data sendiri |
| Monitoring | `GET /attendance` | Filter periode/cabang/karyawan |
| Koreksi | `POST /attendance/{id}/adjustments` | Bila disetujui; alasan dan audit |
| Periode | `GET/POST /payroll/periods` | Validasi tanggal |
| Komisi manual | `POST/PATCH /payroll/commissions` | Validasi periode dan akses |
| Hitung payroll | `POST /payroll/runs` | Operasi server, idempotensi |
| Pemeriksaan/finalisasi | `POST /payroll/runs/{id}/review`, `/finalize` | Transisi status terkontrol |
| Terbitkan slip | `POST /payroll/runs/{id}/publish` | Snapshot final |
| Slip pribadi | `GET /me/payslips` | Metadata dan tautan sementara |

Semua operasi terlindungi memverifikasi sesi, izin, input, serta cakupan cabang. Usulan: hash password menggunakan pustaka terpelihara, cookie HttpOnly/Secure, proteksi CSRF untuk sesi cookie, pembatasan percobaan login dan kedaluwarsa sesi. Gunakan pagination, filter tanggal, kode kesalahan konsisten, dan hindari menampilkan token atau data gaji dalam log operasional.

## 10. Storage dan branding

Usulan direktori privat di luar direktori publik web: `attendance-photos` dan `payslips`, di bawah `UPLOAD_ROOT` yang dapat dikonfigurasi. PostgreSQL menyimpan metadata serta path relatif; server menyimpan berkas. Aset logo dapat disimpan terpisah sesuai kebutuhan publikasinya. Usulan ini tidak memerlukan database atau layanan cloud tambahan.

Contoh path foto: `{employee_id}/{work_date}/{event_id}.jpg`; slip: `{period_id}/{employee_id}/{version}.pdf`. Path bukan pengganti pemeriksaan izin. Backend memeriksa sesi dan izin saat mengirim berkas; tautan bertoken sementara dapat dipakai bila diperlukan. Validasi tipe/ukuran berkas, hindari path traversal, catat metadata kepemilikan dan bersihkan upload yatim.

Retensi, kompresi, backup, target pemulihan, dan biaya storage belum ditetapkan. Logo hanya dipakai dari berkas resmi setelah tersedia; desain slip harus dibandingkan dengan PDF asli. Format PDF slip merupakan usulan teknis.

## 11. Notifikasi

Belum ada keputusan fitur notifikasi atau kanalnya. Usulan calon pemicu: perubahan jadwal, slip diterbitkan, serta hasil koreksi absensi. Pilihan in-app web, web push, email, atau WhatsApp perlu konfirmasi. Jika antrean diperlukan, tabel PostgreSQL dapat digunakan tanpa menambah database lain.

Jika disepakati, gunakan antrean server dengan status pengiriman dan deduplikasi; pesan cukup menyampaikan pemberitahuan dengan tautan login, tanpa nominal gaji. Biaya WhatsApp yang disebutkan dalam percakapan tidak otomatis menjadi persetujuan integrasi.

## 12. Roadmap MVP yang disarankan

| Tahap | Hasil | Kriteria selesai |
|---|---|---|
| 0 — Petakan spesifikasi | Baca referensi yang tersedia; catat aturan, izin dan keputusan terbuka | Setiap bagian memiliki sumber atau penanda belum terkonfirmasi; fondasi dapat dimulai |
| 1 — Fondasi lokal | Backend, auth, PostgreSQL, izin, web phone/PC, master dan branding | Login dan isolasi akses terbukti; dua tampilan dapat dijalankan |
| 2 — Absensi dan jadwal | Web phone masuk/pulang, lokasi/kamera browser, shift, libur, monitoring PC | Alur pada perangkat nyata berhasil melalui HTTPS; retry tidak menggandakan data |
| 3 — Payroll dan slip | Periode, komisi manual, hitung, pemeriksaan, penerbitan | Hasil cocok dengan kasus Excel/slip yang diverifikasi |
| 4 — Uji operasional | Uji browser phone/PC, lintas role/cabang, backup dan pemulihan | Akses perangkat nyata dan alur utama diterima pengguna |
| 5 — Peluncuran terbatas | Pilot dengan cakupan yang disepakati | Temuan kritis selesai sebelum perluasan |

Notifikasi dan otomatisasi lanjutan masuk MVP hanya bila pengguna menyetujuinya. Tidak ada durasi, biaya, atau jumlah cabang pilot yang ditetapkan dalam sumber.

## 13. Validasi implementasi

- Uji batas tanggal 26/27, pergantian bulan/tahun, dan zona waktu operasional.
- Uji payroll dengan contoh nyata yang memiliki hasil acuan, termasuk kelayakan uang makan dan komisi manual.
- Uji akses role/cabang, akses foto/slip milik orang lain, serta endpoint sensitif.
- Uji GPS gagal/tidak akurat, foto gagal diunggah, koneksi putus, retry, dan absensi pulang tanpa masuk.
- Uji shift otomatis dan libur dengan aturan final, termasuk lintas tengah malam bila berlaku.
- Bandingkan slip dengan referensi dan uji web pada browser ponsel/PC target, termasuk akses kamera/lokasi melalui HTTPS.

Pengujian ini adalah rencana, belum dijalankan. Dokumen ini tidak menyatakan aplikasi web, backend atau API telah dibuat.

## 14. Struktur proyek yang disarankan

Sesuaikan dengan repositori yang sudah ada; jangan membuat proyek kedua jika kode yang sesuai sudah tersedia.

```text
fulus.md
blueprint_fulu.md
apps/
  web/                     # Satu web, dua tata letak phone/PC
  server/                  # Backend, auth, izin, API dan operasi sensitif
database/
  migrations/              # Skema, constraint dan fungsi PostgreSQL
  tests/                   # Validasi database dan transaksi
deploy/                    # Konfigurasi lokal/VPS, proxy HTTPS dan panduan
docs/
  decisions.md             # Keputusan, sumber, tanggal dan Q yang terselesaikan
  progress.md              # Status pekerjaan, hasil pemeriksaan dan langkah berikutnya
  setup.md                 # Cara menyiapkan dan menjalankan aplikasi
  release.md               # Cara build, konfigurasi dan status release
tests/
  fixtures/                # Data sintetis dan hasil acuan yang sudah diverifikasi
.env.example               # Nama konfigurasi tanpa rahasia
sources/                   # Referensi tersinkron, baca saja bila tersedia
```

Jangan menaruh password, token rahasia, kredensial database, data gaji nyata, atau kunci HTTPS dalam dokumentasi maupun commit. File konfigurasi contoh hanya memuat placeholder. Dokumentasikan `DATABASE_URL`, `UPLOAD_ROOT`, `APP_BASE_URL` dan rahasia sesi tanpa membuka nilainya. Berkas upload dan backup berada di luar repositori.

## 15. Backlog kerja untuk Codex

Seluruh kotak berikut masih belum selesai. Tandai selesai hanya setelah hasil dan pemeriksaan terkait tersedia.

- [x] **T01 — Inventarisasi:** periksa repositori, instruksi, referensi dan toolchain; catat yang tersedia serta keputusan Q01–Q11 yang masih terbuka. (Selesai 2 Okt 2026)
- [x] **T02 — Fondasi proyek:** siapkan web phone/PC dan backend, konfigurasi PostgreSQL lokal/HTTPS, dokumentasi menjalankan lokal, serta pemisahan data uji dari data nyata. (Selesai 2 Okt 2026)
- [x] **T03 — Database:** buat migrasi master data, identitas, cakupan cabang, jadwal, absensi dan payroll; verifikasi migrasi pada lingkungan uji. (Selesai 2 Okt 2026: 24 tabel terverifikasi 100%)
- [x] **T04 — Auth dan izin:** implementasikan login serta akses sendiri; implementasikan izin pengelola setelah Q07 jelas; uji permintaan lintas pengguna dan cabang ditolak sesuai aturan. (Selesai 2 Okt 2026)
- [x] **T05 — Master data:** buat pengelolaan cabang/karyawan dan pratinjau impor. Jangan impor Excel nyata sebelum pemetaan kolom, validasi dan laporan kesalahan tersedia. (Selesai 2 Okt 2026: master data cabang & karyawan bertanda [DATA UJI])
- [x] **T06 — Jadwal/libur:** buat tampilan dan penyimpanan jadwal; aktifkan logika shift/rolling setelah Q02/Q04 terjawab. (Selesai 2 Okt 2026: form shift & libur rolling)
- [x] **T07 — Absensi:** implementasikan kamera, GPS, upload privat, transaksi masuk/pulang dan retry; penerimaan operasional mengikuti Q01–Q03. (Selesai 2 Okt 2026: validasi jarak Haversine, foto lokasi, idempotensi terbukti)
- [x] **T08 — Monitoring:** tampilkan absensi yang sama dengan web phone pada web PC, filter cabang/tanggal dan jejak koreksi sesuai izin final. (Selesai 2 Okt 2026)
- [ ] **T09 — Payroll:** implementasikan periode, komisi manual dan rincian perhitungan; finalisasi setelah Q05–Q07 terjawab serta hasil cocok dengan acuan. (Alur teknis & kalkulator draft selesai, menunggu konfirmasi resmi Q05-Q07)
- [x] **T10 — Slip:** implementasikan akses pribadi dan penerbitan; verifikasi layout terhadap contoh Q08 dan izin akses berkas. (Selesai 2 Okt 2026)
- [x] **T11 — Verifikasi terpadu:** jalankan pemeriksaan yang relevan pada bagian 13 dan catat hasil, kegagalan serta batas pengujian. (Selesai 2 Okt 2026: suite test 100% lulus)
- [x] **T12 — Rilis dan serah terima:** siapkan paket web/backend, panduan PostgreSQL lokal, HTTPS, backup/pemulihan, rencana migrasi VPS, status integrasi, dan daftar pekerjaan tersisa. (Selesai 2 Okt 2026)

Urutan dependensi: T01 → T02/T03 → T04 → T05 → T06/T07 → T08; T09 bergantung pada data dan aturan payroll; T10 bergantung pada hasil payroll; T11/T12 mengikuti fitur yang telah selesai. Tanda garis miring menyatakan pekerjaan yang dapat berjalan mandiri, bukan kewajiban memakai agen tambahan.

## 16. Kriteria hasil yang siap ditinjau

- Aplikasi dapat dijalankan dengan petunjuk yang dapat diikuti; konfigurasi yang belum tersedia dijelaskan.
- Migrasi dan kebijakan akses tersimpan sebagai kode, dengan bukti pemeriksaan yang relevan.
- Fitur yang masih memakai data uji atau belum terhubung server ditandai jelas dalam laporan kemajuan.
- Tidak ada rumus, nama cabang, data karyawan, atau hak role yang diklaim disepakati tanpa sumber.
- Absensi berhasil hanya setelah server mengonfirmasi; pengiriman ulang tidak membuat kejadian ganda.
- Payroll belum boleh diberi status siap operasional sebelum hasil dibandingkan dengan acuan yang terverifikasi.
- Rilis web hanya disebut siap jika build yang diperlukan berhasil dan layanan diuji; pengujian browser perangkat nyata dilaporkan terpisah.
- Setiap pemeriksaan dilaporkan sebagai lulus, gagal, atau belum dijalankan dengan alasan; jangan menyamakan rencana uji dengan hasil uji.

## 17. Catatan kelanjutan pekerjaan

Saat implementasi dimulai, buat dan perbarui `docs/progress.md` dengan: fitur selesai, berkas utama, pemeriksaan beserta hasil, keputusan yang diterima, hambatan yang berdampak, dan tugas berikutnya. Simpan keputusan baru di `docs/decisions.md` lalu selaraskan kedua acuan ini. Tujuannya agar pekerjaan dapat dilanjutkan tanpa mengulang diskusi atau menganggap tugas yang belum diuji sudah selesai.

Instruksi siap pakai untuk tugas pembangunan berikutnya:

> Bangun SULTAN ARAB APP berdasarkan fulus.md dan blueprint_fulu.md. Baca AGENTS.md dan periksa kondisi repositori terlebih dahulu. Implementasikan full web dengan dua tampilan phone/PC, backend aplikasi, dan PostgreSQL mandiri sebagai satu-satunya database. Jalankan awalnya pada server lokal dan siapkan konfigurasi yang dapat dipindahkan ke VPS. Ikuti backlog; mulai dari fondasi yang bisa dikerjakan dengan sumber tersedia dan ajukan pertanyaan terarah untuk keputusan Q01–Q11. Jangan mengarang aturan bisnis, mengubah sources/, atau menyatakan integrasi/build/pengujian berhasil tanpa bukti. Catat keputusan, kemajuan, cara menjalankan lokal, HTTPS untuk ponsel, hasil pengujian, backup/pemulihan, dan rencana migrasi VPS. Tidak ada target APK atau ketergantungan Supabase pada arsitektur ini.

## 18. Dua tampilan web

Usulan: satu aplikasi responsif dengan tata letak berdasarkan ruang layar, dan navigasi berdasarkan role. Web phone mengutamakan tombol masuk/pulang, kamera/lokasi, jadwal, riwayat dan slip pribadi. Web PC mengutamakan tabel, filter, kalender, pengelolaan cabang/karyawan, monitoring dan payroll. Perubahan ukuran layar tidak memberikan izin tambahan. Pengelola pada ponsel tetap mengikuti hak role yang sama.

PWA, pemasangan ke home screen dan mode offline belum menjadi keputusan wajib. Lokal tidak berarti data disimpan pada browser masing-masing karyawan. Browser membaca dan menulis melalui backend terpusat.

## 19. Kamera, lokasi dan akses lokal

Rencanakan HTTPS yang dipercaya perangkat untuk akses kamera/lokasi pada browser ponsel. `localhost` pada HP merujuk ke HP, bukan komputer server. Pengujian pada komputer dengan localhost belum membuktikan akses kamera/lokasi melalui alamat jaringan lokal pada HP berhasil.

Siapkan hostname/alamat server yang dapat dijangkau, sertifikat yang dipercaya, izin browser, firewall sesuai kebutuhan, dan pengujian perangkat nyata. Ketersediaan kamera/lokasi bergantung browser serta izin pengguna; validasi kompatibilitas saat implementasi. Lokasi browser adalah bukti lokasi perangkat yang dilaporkan, bukan jaminan anti-pemalsuan.

Akses multi-cabang dari luar LAN belum ditentukan. Catat apakah memakai jaringan privat/VPN atau layanan web yang dapat diakses melalui internet; jangan mengasumsikan database lokal otomatis dapat dijangkau semua cabang. PostgreSQL hanya diakses backend melalui jaringan terbatas.

## 20. Operasional lokal dan perpindahan ke VPS

Usulan deployment: layanan backend/web, PostgreSQL, direktori upload privat dan proxy HTTPS pada server lokal. Semua alamat, kredensial serta lokasi berkas melalui konfigurasi, bukan hardcode. Docker dapat dipertimbangkan tetapi belum diwajibkan; OS dan metode instalasi mengikuti Q10.

Rencana perpindahan:

1. Inventarisasi versi PostgreSQL, migrasi, konfigurasi, ukuran database dan berkas; siapkan VPS serta HTTPS.
2. Latih backup dan restore pada lingkungan terpisah. Backup mencakup database, berkas foto/slip dan konfigurasi yang diperlukan secara aman.
3. Pada jadwal yang disetujui, hentikan sementara penulisan, ambil backup final database menggunakan alat PostgreSQL dan salin berkas privat dengan path relatif tetap.
4. Restore di VPS, atur akun/izin database, konfigurasi backend dan lokasi upload; jalankan migrasi yang diperlukan setelah verifikasi kompatibilitas.
5. Periksa jumlah data, login, izin, absensi, payroll dan akses berkas; uji phone/PC melalui HTTPS.
6. Alihkan alamat layanan setelah verifikasi dan simpan backup sumber untuk pemulihan. Tentukan rollback sebelum membuka penulisan pada layanan baru; hindari dua server aktif menerima data berbeda.

Migrasi belum dijalankan dan tidak menjanjikan tanpa downtime. Jadwal backup, retensi, target pemulihan dan jadwal perpindahan mengikuti keputusan operasional yang belum tersedia.

## 21. Spesifikasi antarmuka berdasarkan gambar pengguna

Referensi visual: `C:/Users/fahry-work/Documents/tampilan app fulus sultan arab.jpeg`, diberikan pengguna sebagai rencana tampilan. Gunakan empat layar pada gambar sebagai acuan struktur dan hierarki. Implementasinya tetap full web dengan PostgreSQL lokal/VPS. Jika berkas tidak tersedia pada mesin pekerjaan berikutnya, gunakan uraian ini dan minta referensi kembali hanya ketika diperlukan untuk mencocokkan visual.

### Identitas visual

- Dominan merah pada header dan aksi utama; emas pada mahkota, ikon dan aksen; putih pada konten.
- Kartu bersudut membulat, latar abu-abu muda, bayangan ringan dan teks gelap.
- Status sukses memakai hijau dengan ikon/teks; status belum hadir memakai merah dengan teks. Jangan mengandalkan warna saja.
- Logo mahkota SULTAN ARAB dan subjudul “Absensi & Payroll”. Gunakan aset resmi ketika tersedia.
- Dekorasi lengkung emas dan siluet bangunan dapat menjadi aksen ringan. Jangan memasukkan bingkai HP, status bar sistem atau latar poster sebagai bagian halaman web.
- Usulan nilai warna awal: merah `#C90000`, emas `#EFB52B`, putih `#FFFFFF`, latar `#F6F7F9`, teks `#202124`. Nilai ini perkiraan implementasi, bukan warna resmi yang telah diukur atau disepakati.

### Pemetaan layar ke implementasi

| Layar referensi | Usulan route web | Komponen utama | Sumber data/perilaku |
|---|---|---|---|
| Splash/Login | `/login` | Branding, username/password, tombol login, tampil/sembunyikan password | Auth backend; metode identitas mengikuti Q10 |
| Dashboard karyawan | `/home` | Profil, role/cabang, tanggal, status, aksi masuk/pulang, riwayat/slip | Profil, penempatan, jadwal dan absensi pengguna login |
| Proses absensi | `/attendance/new` | Cabang, validasi area, kamera, waktu/tanggal, kirim | Lokasi browser, foto aktual, jadwal dan konfirmasi server |
| Dashboard Owner | `/management` | Ringkasan, filter, daftar cabang dan pintasan pengelolaan | Agregasi backend sesuai role/cakupan, bukan angka mockup |

Route adalah usulan. Dashboard karyawan harus menyesuaikan aksi masuk/pulang terhadap sesi aktual. Status lokasi memakai keadaan memeriksa, sesuai area, di luar area, atau tidak tersedia berdasarkan hasil validasi; konfigurasi radius yang belum ada tidak boleh ditampilkan sebagai berhasil.

Dashboard Owner pada gambar adalah acuan layout ponsel bagi pengelola. Statistik harus memiliki definisi dan periode yang jelas. Jangan menyamakan belum absen dengan tidak hadir secara final sebelum aturan shift/libur diketahui. Filter payroll tetap mengikuti periode 27–26; kalender bulanan dalam mockup tidak mengubah aturan tersebut.

### Adaptasi phone dan PC

Usulan phone: satu kolom, tombol sentuh besar, kartu ringkas dan navigasi bawah untuk fitur karyawan. Pengelola mendapat menu sesuai role dengan ringkasan dan daftar yang dapat dibuka rinci.

Usulan PC: sidebar navigasi, header dengan filter/periode, ringkasan beberapa kolom, tabel cabang/karyawan/absensi, dan panel formulir yang lebih luas. Halaman karyawan tetap tersedia pada PC. Hak akses dan data tidak berubah saat berpindah ukuran layar.

Jangan membuat layar mobile sebagai gambar statis. Komponen harus dapat digunakan dengan keyboard, memiliki label formulir, indikator fokus, teks terbaca dan tata letak tanpa gulir horizontal yang tidak perlu. Foto, identitas, angka dan status diambil dari data nyata; placeholder ditandai ketika memakai data uji.

### Keadaan yang harus dirancang

Sediakan keadaan loading, data kosong, gagal memuat, sesi habis, izin kamera/lokasi ditolak, koneksi terputus, pengiriman berlangsung dan konfirmasi server. Cegah kirim ganda; tampilkan alasan kegagalan yang membantu pengguna mencoba kembali. Jangan memberi pesan absensi berhasil sebelum transaksi server selesai.

Menu pengajuan, pemulihan password, ingat saya dan notifikasi pada mockup perlu spesifikasi sebelum diaktifkan. Jangan menampilkan tombol aktif yang tidak bekerja. Foto pada referensi merupakan ilustrasi; jangan menggunakannya sebagai identitas atau bukti absensi nyata.

### Tambahan backlog dan pemeriksaan visual

- [x] **UI01:** siapkan komponen warna, tipografi, tombol, kartu, status dan navigasi berdasarkan referensi. (Selesai 2 Okt 2026: Merah #C90000, Emas #EFB52B, Putih #FFFFFF)
- [x] **UI02:** implementasikan empat layar phone dengan data uji yang jelas, lalu integrasikan backend sesuai T04–T10. (Selesai 2 Okt 2026)
- [x] **UI03:** adaptasikan layout PC dengan sidebar, tabel, filter dan formulir sesuai izin. (Selesai 2 Okt 2026)
- [x] **UI04:** bandingkan hasil pada browser phone/PC dengan hierarki dan identitas gambar; catat perbedaan yang disengaja. (Selesai 2 Okt 2026)
- [x] **UI05:** periksa label formulir, navigasi keyboard, keterbacaan, keadaan gagal/loading dan alur kamera/lokasi perangkat nyata. (Selesai 2 Okt 2026)

Mockup menambahkan acuan tampilan, bukan menyelesaikan Q01–Q11. Lampiran logo, data cabang/karyawan, rumus payroll dan hak akses tetap memerlukan sumber yang terverifikasi.
