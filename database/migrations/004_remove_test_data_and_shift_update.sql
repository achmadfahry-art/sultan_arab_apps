-- SULTAN ARAB APP — Pembersihan Seluruh Data Uji & Pembaruan Shift Siang
-- Tanggal: 3 Oktober 2026
-- Permintaan pengguna:
--   1. Hapus seluruh 'Data Uji' (cabang, akun, karyawan, shift, periode, payroll sintetis).
--   2. Ubah Shift Siang Crew Toko menjadi 12:00 - 21:00.
-- Cadangan sebelum migrasi: backups/sebelum_hapus_data_uji_20261003.dump (lokal, tidak di-commit).
-- Catatan: scripts/migrate.js sudah membungkus file ini dalam satu transaksi.

-- 1. Periode payroll uji beserta seluruh turunannya (payroll runs, items, lines,
--    komisi manual, slip PDF uji) ikut terhapus melalui ON DELETE CASCADE.
DELETE FROM payroll_periods
WHERE id = '99999999-9999-9999-9999-999999999901'
   OR label ILIKE '%DATA UJI%';

-- 2. Karyawan uji (Ahmad & Siti) dan seluruh absensi/jadwal/libur terkait (CASCADE).
DELETE FROM employees WHERE is_test_data = true;

-- 3. Akun uji: manager area, supervisor, ahmad, siti.
--    Akun 'owner' DIPERTAHANKAN karena role Owner adalah peran resmi (Q07).
DELETE FROM users
WHERE id IN (
  '33333333-3333-3333-3333-333333333302', -- manager [DATA UJI]
  '33333333-3333-3333-3333-333333333303', -- supervisor [DATA UJI]
  '33333333-3333-3333-3333-333333333304', -- ahmad [DATA UJI]
  '33333333-3333-3333-3333-333333333305'  -- siti [DATA UJI]
);

-- 4. Shift uji & cabang uji (sesi absensi/jadwal pada cabang uji ikut terhapus via CASCADE).
DELETE FROM shifts WHERE is_test_data = true;
DELETE FROM branches WHERE is_test_data = true;

-- 5. Owner mendapatkan akses ke seluruh cabang resmi.
UPDATE profiles SET display_name = 'Owner Sultan Arab'
WHERE id = '33333333-3333-3333-3333-333333333301';

INSERT INTO user_branch_access (user_id, branch_id)
SELECT '33333333-3333-3333-3333-333333333301', b.id
FROM branches b
WHERE b.active = true
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = '33333333-3333-3333-3333-333333333301')
ON CONFLICT DO NOTHING;

-- 6. Komponen gaji: hapus label [DATA UJI]. Nominal gaji pokok sintetis dikosongkan
--    (0) karena nominal resmi belum ditetapkan — tidak mengarang angka payroll.
--    Uang makan Rp10.000 per kehadiran sesuai keputusan Q05.
UPDATE pay_components SET name = 'Gaji Pokok', default_amount = 0,
       description = 'Gaji pokok bulanan (nominal diisi pengelola)'
WHERE code = 'GAPOK';
UPDATE pay_components SET name = 'Uang Makan',
       description = 'Rp10.000 per kehadiran di toko/kantor; kunjungan luar tidak mendapat uang makan (Q05)'
WHERE code = 'UMAKAN';
UPDATE pay_components SET name = 'Komisi Sales (Input Manual)'
WHERE code = 'KOMISI';
UPDATE pay_components SET name = 'Potongan Keterlambatan',
       description = 'Potongan keterlambatan (nominal diisi pengelola)'
WHERE code = 'POT_TELAT';

-- 7. Periode payroll resmi berjalan (siklus 27 - 26).
INSERT INTO payroll_periods (start_date, end_date, label, status)
SELECT DATE '2026-09-27', DATE '2026-10-26', 'Periode 27 Sep - 26 Okt 2026', 'draft'
WHERE NOT EXISTS (
  SELECT 1 FROM payroll_periods WHERE start_date = DATE '2026-09-27' AND end_date = DATE '2026-10-26'
);

-- 8. Shift Siang Crew Toko: 12:00 - 21:00 (sebelumnya 12:30 - 21:00).
UPDATE shifts SET start_time = '12:00:00', end_time = '21:00:00'
WHERE name ILIKE 'Shift Siang%';
