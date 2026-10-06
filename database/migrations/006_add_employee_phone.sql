-- ========================================================
-- Migrasi 006: Tambah kolom phone pada tabel employees
-- Mendukung nomor WhatsApp staf saat input karyawan baru
-- ========================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Sinkronisasi nomor telepon awal dari profiles ke employees jika ada
UPDATE employees e
SET phone = p.phone
FROM users u
JOIN profiles p ON u.id = p.id
WHERE e.user_id = u.id AND e.phone IS NULL AND p.phone IS NOT NULL;
