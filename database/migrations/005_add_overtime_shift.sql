-- ========================================================
-- Migrasi 005: Penambahan Shift Lembur (08:00 - 21:00)
-- Sesuai kebutuhan operasional Sultan Arab
-- ========================================================

-- Tambahkan Shift Lembur untuk semua cabang yang ada jika belum ada
INSERT INTO shifts (branch_id, name, start_time, end_time, crosses_midnight, is_test_data)
SELECT b.id, 'Shift Lembur', '08:00:00', '21:00:00', false, false
FROM branches b
WHERE NOT EXISTS (
    SELECT 1 FROM shifts s 
    WHERE s.branch_id = b.id AND s.name = 'Shift Lembur'
);
