-- ========================================================
-- Migrasi 008: Tambah kolom photo_url pada tabel employees
-- Sinkronisasi avatar_url profiles dan photo_url employees
-- ========================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Sinkronisasi awal: jika profiles sudah punya avatar_url, copy ke employees
UPDATE employees e
SET photo_url = p.avatar_url
FROM users u
JOIN profiles p ON u.id = p.id
WHERE e.user_id = u.id AND e.photo_url IS NULL AND p.avatar_url IS NOT NULL;

-- Sebaliknya, jika employees sudah ada photo_url tapi profiles belum, sync ke profiles
UPDATE profiles p
SET avatar_url = e.photo_url
FROM employees e
WHERE e.user_id = p.id AND p.avatar_url IS NULL AND e.photo_url IS NOT NULL;
