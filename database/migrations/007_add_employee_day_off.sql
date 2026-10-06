-- ========================================================
-- Migrasi 007: Tambah kolom day_off pada tabel employees
-- Mendukung penentuan jadwal libur staf otomatis & dinamis
-- ========================================================

ALTER TABLE employees ADD COLUMN IF NOT EXISTS day_off VARCHAR(50) DEFAULT 'Ahad';

-- Inisialisasi jadwal libur karyawan eksisting sesuai roster resmi (Q04)
UPDATE employees SET day_off = 'Ahad' WHERE employee_code IN ('SA-STF-01', 'SA-STF-02', 'SA-STF-03');
UPDATE employees SET day_off = 'Selasa' WHERE employee_code = 'SA-ADM-01';
UPDATE employees SET day_off = 'Senin' WHERE employee_code = 'SA-CRW-01';
UPDATE employees SET day_off = 'Kamis' WHERE employee_code = 'SA-CRW-02';
UPDATE employees SET day_off = 'Rabu' WHERE employee_code = 'SA-CRW-03';
UPDATE employees SET day_off = 'Kamis' WHERE employee_code = 'SA-CRW-04';
UPDATE employees SET day_off = 'Selasa' WHERE employee_code = 'SA-CRW-05';
UPDATE employees SET day_off = 'Ahad' WHERE day_off IS NULL;
