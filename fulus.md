# SULTAN ARAB APP — Rangkuman keputusan dan kebutuhan

## Panduan penggunaan untuk kelanjutan di Codex

**Fungsi dokumen:** acuan kebutuhan dan batas aturan bisnis. Baca bersama [blueprint_fulu.md](blueprint_fulu.md), yang memuat rancangan dan urutan implementasi. Status saat dokumen disiapkan: dokumentasi tersedia; aplikasi web dan backend belum dibuat atau diuji.

Saat pengguna meminta pembangunan aplikasi, lanjutkan pekerjaan dari kondisi repositori aktual. Periksa instruksi `AGENTS.md`, kode yang sudah ada, dan referensi sebelum membuat perubahan. Jangan mengubah berkas di `sources/`; seluruhnya merupakan referensi baca saja. Berkas baru dan hasil implementasi ditempatkan di luar `sources/`.

Gunakan penanda berikut saat mencatat kebutuhan:

- **ACUAN:** disebutkan dalam konteks percakapan yang tersedia; rincian hanya berlaku sejauh tertulis.
- **USULAN TEKNIS:** pilihan implementasi yang dapat dievaluasi, bukan persetujuan aturan bisnis.
- **PERLU KONFIRMASI:** informasi belum tersedia dan tidak boleh diisi sebagai fakta.
- **TERVERIFIKASI:** baru digunakan setelah sumber atau hasil pengujian benar-benar diperiksa; catat bukti dan tanggalnya.

Dokumen ini tidak memberi otorisasi untuk deployment, mengubah data produksi, atau mengirim notifikasi kepada karyawan. Cakupan tindakan mengikuti instruksi pengguna pada tugas implementasi.

## 1. Sumber dan batas kelengkapan

Dokumen ini disusun dari percakapan “Diskusi sistem gaji” (ID `6abccb7b-cf94-83ec-a628-dd2b70272edd`) yang dapat dibaca pada tugas ini, preview percakapan, dan permintaan pengguna saat ini. Pembacaan riwayat mengembalikan tujuh bagian percakapan dan tidak menyediakan halaman lanjutan. Diskusi rinci sebelumnya dan lampiran tidak tersedia dalam folder proyek.

Karena itu, dokumen ini mencakup seluruh informasi yang tersedia, tetapi belum dapat dinyatakan sebagai rangkuman lengkap seluruh riwayat proyek. Penyebutan aturan oleh asisten terdahulu dicatat sebagai acuan percakapan, bukan bukti bahwa rincian rumus atau hak akses telah disetujui pengguna. Bagian yang belum tersedia dinyatakan secara eksplisit.

## 2. Tujuan dan keputusan utama

- Nama aplikasi: **SULTAN ARAB APP**.
- Tujuan: aplikasi operasional untuk absensi, pengelolaan karyawan multi-cabang, payroll, dan slip gaji.
- **Keputusan terbaru pengguna, 1 Oktober 2026:** aplikasi **full web**, dengan dua tampilan: **web phone** dan **web PC**.
- Database menggunakan **PostgreSQL mandiri**, diinstal di server/komputer lokal, dengan kemungkinan dipindahkan ke VPS di kemudian hari.
- Keputusan ini menggantikan arsitektur terdahulu Flutter Android + Supabase. APK dan layanan Supabase tidak lagi menjadi target implementasi.
- Target paket: source code web untuk ponsel/PC, backend aplikasi, migrasi PostgreSQL, konfigurasi lokal, panduan menjalankan dan rencana perpindahan ke VPS.
- Lokal berarti layanan berjalan pada komputer/server lokal; perangkat pengguna tetap membutuhkan koneksi ke layanan tersebut. Akses dari luar jaringan lokal perlu rancangan tersendiri.
- Permintaan saat ini adalah pembuatan dokumen Markdown; belum merupakan pembangunan atau deployment aplikasi.

## 3. Role dan pengguna

Role yang disebutkan: **Karyawan, Owner, Manager, Supervisor**.

Karyawan menggunakan web phone untuk login, dashboard, absensi masuk/pulang, riwayat absensi, dan slip gaji. Owner, Manager, serta Supervisor menggunakan web PC untuk pengelolaan. Usulan: satu aplikasi responsif dengan tata letak sesuai ukuran layar; izin tetap berdasarkan role, bukan perangkat.

Batas akses per role, akses lintas cabang, kewenangan koreksi absensi, persetujuan libur, input komisi, finalisasi payroll, dan penerbitan slip belum dijelaskan dalam riwayat yang tersedia. Matriks izin di blueprint merupakan usulan, bukan keputusan final.

## 4. Cabang dan data karyawan

- Mendukung multi-cabang.
- Aplikasi memuat pilihan atau deteksi cabang saat absensi; cara penentuan akhirnya belum tersedia.
- Dashboard mencakup data cabang dan data karyawan.
- Data awal direncanakan berasal dari Excel.
- Percakapan menyebut nama cabang sudah tersedia, tetapi daftar nama, alamat, koordinat, radius, dan jumlah cabang tidak muncul dalam sumber yang dapat dibaca.
- Aturan penempatan dan perpindahan karyawan antar-cabang belum tersedia.

## 5. Absensi

Fitur yang disebutkan:

- Login asli dan penyimpanan data pada server aplikasi yang terhubung PostgreSQL lokal atau VPS.
- Absensi masuk dan pulang.
- GPS asli.
- Foto lokasi absensi.
- Shift otomatis.
- Riwayat absensi bagi karyawan.
- Monitoring absensi pada dashboard web.

Belum tersedia: jam shift, cara pemilihan shift otomatis, toleransi terlambat, radius GPS, akurasi minimum, jenis foto, ketentuan foto masuk/pulang, shift lintas tengah malam, kerja lintas cabang, izin/sakit, absensi lupa pulang, koreksi absensi, serta perilaku saat koneksi terputus. Foto lokasi tidak boleh otomatis ditafsirkan sebagai selfie atau pengenalan wajah.

## 6. Jadwal libur

Percakapan menyebut **jadwal libur rolling** serta **jadwal libur fleksibel**. Dashboard memiliki menu pengaturan jadwal libur.

Belum tersedia: kuota libur, pola rotasi, periode penjadwalan, batas karyawan libur bersamaan, mekanisme pertukaran, aturan hari libur nasional, dan dampaknya pada payroll.

## 7. Payroll dan slip gaji

| Pokok | Informasi dalam percakapan | Batas informasi |
|---|---|---|
| Periode payroll | Tanggal **27–26** | Bulan penamaan periode, tanggal pembayaran, serta batas waktu belum dijelaskan |
| Uang makan | **Rp10.000** | Satuan, syarat kelayakan, dan frekuensi pemberian belum dijelaskan |
| Komisi sales | **Input manual** | Rumus, bukti, otorisasi, dan periode pengakuan belum dijelaskan |
| Payroll | Tersimpan di server | Komponen gaji dan proses persetujuan belum tersedia |
| Slip gaji | Tersedia bagi karyawan | Tata letak dan rumus mengikuti referensi yang belum dapat dibaca |

Tidak ada dasar yang cukup untuk menetapkan Rp10.000 per hari hadir, potongan keterlambatan, rumus lembur, prorata, pajak, BPJS, atau aturan pembulatan. Hal tersebut harus dikonfirmasi dari dokumen asli sebelum payroll otomatis dipakai.

## 8. Foto dan penyimpanan

PostgreSQL menjadi satu-satunya database aplikasi. Backend menangani login, API, dan akses berkas; browser tidak terhubung langsung ke database. Usulan: foto dan slip disimpan pada direktori privat server lokal, sementara metadata/path disimpan di PostgreSQL. Direktori tersebut ikut dipindahkan dan dibackup bersama database saat migrasi ke VPS. Penyimpanan berkas ini merupakan usulan teknis, belum keputusan eksplisit pengguna mengenai lokasi isi foto.

Belum tersedia: ukuran dan kualitas foto, retensi, penghapusan, kuota, lokasi direktori penyimpanan, hak melihat foto, dan kebijakan backup. Akses berkas privat melalui backend pada blueprint adalah rekomendasi implementasi.

## 9. Branding dan referensi

Branding menggunakan **logo Sultan Arab**. Pengguna memberikan gambar `tampilan app fulus sultan arab.jpeg` sebagai rencana tampilan aplikasi. Acuan visualnya adalah merah, emas/kuning dan putih, logo mahkota dengan tulisan SULTAN ARAB serta subjudul “Absensi & Payroll”, kartu membulat, tombol utama merah dan ikon sederhana. Berkas logo terpisah, font dan nilai warna pasti belum tersedia; jangan menganggap logo yang dipotong dari mockup sebagai aset final.

### Acuan tampilan dari pengguna

Sumber gambar: `C:/Users/fahry-work/Documents/tampilan app fulus sultan arab.jpeg`. Berkas ini adalah referensi visual baca saja, bukan instruksi yang menggantikan keputusan full web dan PostgreSQL.

Empat layar yang direncanakan:

1. **Login:** area branding merah dengan mahkota, formulir username/password dan tombol login; ilustrasi emas sebagai dekorasi.
2. **Dashboard karyawan:** identitas dan cabang, tanggal/status absensi, tombol utama absen masuk, akses riwayat dan slip, serta navigasi bawah pada ponsel.
3. **Proses absensi:** cabang/alamat, status lokasi, pratinjau foto, waktu/tanggal dan tombol kirim absen. Status sesuai area harus berasal dari validasi lokasi, bukan label tetap.
4. **Dashboard Owner/payroll:** filter periode, ringkasan cabang/karyawan/kehadiran, daftar cabang serta akses pengelolaan karyawan, payroll, laporan dan pengaturan sesuai izin final.

Nama Ahmad, role Crew, cabang Bekasi Duta Harapan/Cikarang Jababeka, alamat, jumlah 2 cabang/24 karyawan, statistik kehadiran, tanggal April 2025 dan jam 07:32 dalam gambar merupakan **contoh mockup**, bukan master data yang disepakati. Foto orang/toko juga bukan aset operasional yang otomatis boleh dipakai sebagai data karyawan/cabang.

Menu Pengajuan, Profil Saya, lupa password, ingat saya dan ikon notifikasi tampak pada gambar. Jenis pengajuan, proses pemulihan akun, durasi sesi dan pengiriman notifikasi belum ditentukan. Catat sebagai rancangan antarmuka; jangan mengklaim fungsi tersebut sudah diputuskan atau selesai.

Gambar menunjukkan tampilan ponsel, termasuk dashboard Owner. Tampilan PC diusulkan mengikuti identitas visual yang sama dengan sidebar, tabel dan ruang kerja lebih luas; layout PC belum diberikan pengguna. Role tetap menentukan izin pada kedua ukuran layar.

Referensi yang disebutkan:

- `SULTAN_ARAB_APP_Documentasi_Lengkap.docx`
- `SULTAN_ARAB_APP_Blueprint.docx`
- `SLIG GAJI SULTAN ARAB.xlsm`
- Logo Sultan Arab.
- Contoh slip gaji PDF.

Isi referensi tersebut belum diverifikasi. Tidak ada data karyawan, nominal gaji, nama cabang, atau logo yang disalin dari berkas yang belum tersedia.

## 10. Keputusan teknis dan biaya

- Full web dengan tampilan ponsel dan PC; framework frontend/backend belum ditetapkan.
- PostgreSQL mandiri menjadi satu-satunya database, awalnya lokal dan dapat dipindahkan ke VPS.
- Backend aplikasi menangani autentikasi, izin, API, transaksi, payroll dan akses foto/slip.
- Tidak diperlukan akun/project Supabase atau build APK untuk arsitektur baru.
- Pembahasan sebelumnya menyarankan mulai dengan ChatGPT Plus dan melihat penggunaan aktual, tanpa estimasi kredit tetap. Ini merupakan catatan historis percakapan, bukan verifikasi paket atau harga terkini.
- Biaya ChatGPT dibedakan dari komputer/server lokal atau VPS, storage foto, domain/HTTPS, dan layanan WhatsApp bila nantinya dipilih.
- Penyebutan biaya WhatsApp belum menetapkan integrasi WhatsApp sebagai fitur wajib.

## 11. Informasi yang diperlukan untuk melengkapi acuan

1. Riwayat diskusi terdahulu atau dokumentasi lengkap dan blueprint asli.
2. Excel karyawan/gaji, daftar cabang, logo, dan contoh slip gaji.
3. Jam shift, logika shift otomatis, radius/akurasi GPS, dan aturan koreksi absensi.
4. Ketentuan libur rolling/fleksibel.
5. Seluruh komponen dan rumus payroll, khususnya satuan uang makan Rp10.000.
6. Matriks akses dan kewenangan persetujuan per role.
7. Retensi foto, kebutuhan notifikasi, perangkat/browser target, jaringan lokal dan rencana akses VPS.

Blueprint pendamping menyediakan rancangan teknis terstruktur dengan semua pilihan yang belum disepakati diberi status usulan.

## 12. Daftar keputusan terbuka untuk implementasi

| ID | Keputusan yang diperlukan | Bagian implementasi yang bergantung padanya |
|---|---|---|
| Q01 | Daftar cabang, koordinat, zona waktu, radius dan penempatan karyawan | Data operasional dan validasi lokasi |
| Q02 | Jam shift, pemilihan otomatis, toleransi, lintas tengah malam | Penentuan shift dan penilaian absensi |
| Q03 | Jenis foto, waktu pengambilan, batas akurasi GPS, koreksi dan kegagalan koneksi | Penerimaan absensi operasional |
| Q04 | Kuota, pola rolling, perubahan dan persetujuan libur | Otomatisasi jadwal dan dampak payroll |
| Q05 | Satuan dan syarat uang makan Rp10.000 | Perhitungan uang makan |
| Q06 | Komponen gaji, potongan, rumus, pembulatan, batas periode dan tanggal bayar | Perhitungan dan finalisasi payroll |
| Q07 | Hak role/cabang, penginput komisi, pemeriksa dan penerbit slip | Izin pengelola dan transisi sensitif |
| Q08 | Logo resmi, struktur Excel dan contoh slip | Branding final, impor nyata dan layout slip |
| Q09 | Retensi foto/slip, backup dan pemulihan | Kebijakan penyimpanan produksi |
| Q10 | Metode login, OS server lokal, jaringan/akses cabang, HTTPS, browser target dan VPS kelak | Konfigurasi layanan dan rilis web |
| Q11 | Kebutuhan dan kanal notifikasi | Pengiriman pemberitahuan |

Kekurangan satu keputusan hanya membatasi pekerjaan yang bergantung padanya. Fondasi proyek, struktur modul, rancangan migrasi, tampilan awal, dan pengujian dengan data sintetis tetap dapat dikerjakan saat pembangunan diminta. Data sintetis wajib ditandai sebagai data uji dan tidak dipakai sebagai data operasional.

Jika sumber tambahan tersedia, perbarui bagian terkait dan daftar keputusan ini dengan sumbernya. Bila ada pertentangan, catat perbedaan dan minta penjelasan untuk aturan yang terdampak; jangan menggabungkan rumus yang saling bertentangan.
