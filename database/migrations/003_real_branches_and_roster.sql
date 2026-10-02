-- SULTAN ARAB APP — Migrasi Data Nyata & Pembaruan Aturan Bisnis (Q01 - Q11)
-- Tanggal: 2 Oktober 2026

-- 1. Penambahan Kolom pada Sesi Absensi & Slip Gaji
ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS attendance_type VARCHAR(50) DEFAULT 'hadir', -- 'hadir' atau 'kunjungan_luar'
ADD COLUMN IF NOT EXISTS is_meal_allowance_eligible BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE attendance_events
ADD COLUMN IF NOT EXISTS attendance_type VARCHAR(50) DEFAULT 'hadir';

-- Tambahkan kolom upload PDF langsung pada tabel payslips
ALTER TABLE payslips
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES payroll_periods(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS pdf_path TEXT,
ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255),
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Jadikan item_id nullable agar manager bisa upload slip PDF langsung per employee & period
ALTER TABLE payslips ALTER COLUMN item_id DROP NOT NULL;

-- 2. Master Cabang Resmi (Q01)
-- Cabang 1: Head Quarter di Bekasi: https://maps.app.goo.gl/dYmZ7xPSgDNKJc6b9 (Lat: -6.2122736, Lon: 107.0218103)
-- Cabang 2: Cabang Cikarang: https://maps.app.goo.gl/SrRQo58zHMmpju5k7 (Lat: -6.3001269, Lon: 107.1638182)

INSERT INTO branches (id, code, name, timezone, latitude, longitude, radius_m, address, active, is_test_data) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HQ-BKS', 'Head Quarter Bekasi (Pusat Grosir)', 'Asia/Jakarta', -6.2122736, 107.0218103, 150, 'Jl. Duta Harapan / Bekasi (Head Quarter Sultan Arab)', true, false),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CBG-CKR', 'Cabang Cikarang', 'Asia/Jakarta', -6.3001269, 107.1638182, 150, 'Sultan Arab Cikarang', true, false)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  radius_m = EXCLUDED.radius_m,
  is_test_data = false;

-- 3. Shift Resmi (Q02)
-- Staff kantor & Admin: Non-Shift (08:00 - 17:00)
-- Crew Toko: Shift Pagi (08:00 - 17:00), Shift Siang (12:30 - 21:00)
-- Toleransi 15 menit
INSERT INTO shifts (id, branch_id, name, start_time, end_time, crosses_midnight, is_test_data) VALUES
('cccccccc-cccc-cccc-cccc-cccccccc0001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Non-Shift (Staff & Admin)', '08:00:00', '17:00:00', false, false),
('cccccccc-cccc-cccc-cccc-cccccccc0002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Shift Pagi (Crew Toko)', '08:00:00', '17:00:00', false, false),
('cccccccc-cccc-cccc-cccc-cccccccc0003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Shift Siang (Crew Toko)', '12:30:00', '21:00:00', false, false),
('cccccccc-cccc-cccc-cccc-cccccccc0004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Shift Pagi (Crew Toko)', '08:00:00', '17:00:00', false, false),
('cccccccc-cccc-cccc-cccc-cccccccc0005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Shift Siang (Crew Toko)', '12:30:00', '21:00:00', false, false)
ON CONFLICT DO NOTHING;

-- 4. Akun Pengguna & Profil Tim Resmi (Q04)
-- Default password: nama123 (contoh: fahry123, eka123, adit123, dll)
INSERT INTO users (id, login_identifier, password_hash, active) VALUES
('dddddddd-dddd-dddd-dddd-dddddddd0001', 'fahry', '$2a$10$hSSGS1.xD//Z9PCSxgKDmeuXkV99AKF9a6XgopqtvGZF3baqPnQqa', true),
('dddddddd-dddd-dddd-dddd-dddddddd0002', 'fauzi', '$2a$10$05gGn9TXDmMy0Mqlz2MSTOhMBwKH/RBJnIy6r3E6D1lFxCUDDcsoi', true),
('dddddddd-dddd-dddd-dddd-dddddddd0003', 'miftah', '$2a$10$rRtXd6JlvFFUNrWXTQvveO2TlOQGhVe1Phb0Pb3NLBLVQx/lCIG8K', true),
('dddddddd-dddd-dddd-dddd-dddddddd0004', 'eka', '$2a$10$T9MszeMrOIDQ/M8wOHV6weCpaN3g.grRjqJKtVMcMHbQW.Vt3oHN.', true),
('dddddddd-dddd-dddd-dddd-dddddddd0005', 'adit', '$2a$10$TD9HpVF.kZbUDk.zpZf29u1gjzwuGvArbCMrHa5n/BWeJQbZw/wTC', true),
('dddddddd-dddd-dddd-dddd-dddddddd0006', 'mufti', '$2a$10$HOOPfOVLTKzkoIBXwhy9k.PrihZO7NOZY1rMWq8OP77jkHYw9Icza', true),
('dddddddd-dddd-dddd-dddd-dddddddd0007', 'kamal', '$2a$10$hNIsg/0JFZykLqNdUcerQO4RvY7iFE2JrR2E93rppo4zjbIcKQyp.', true),
('dddddddd-dddd-dddd-dddd-dddddddd0008', 'milkan', '$2a$10$8fBwitbndSSZL6wUKtU.S.GzfjqHADEvawVbkgga4DXjUFd2DTxqi', true),
('dddddddd-dddd-dddd-dddd-dddddddd0009', 'refan', '$2a$10$ArBRyHl3xw2TtwwxxvgEge7e5p0rIy03Ta.NE84OKlcnzr4jH.2HG', true)
ON CONFLICT (login_identifier) DO NOTHING;

INSERT INTO profiles (id, display_name, phone, active) VALUES
('dddddddd-dddd-dddd-dddd-dddddddd0001', 'Fahry', '081234567801', true),
('dddddddd-dddd-dddd-dddd-dddddddd0002', 'Fauzi', '081234567802', true),
('dddddddd-dddd-dddd-dddd-dddddddd0003', 'Miftah', '081234567803', true),
('dddddddd-dddd-dddd-dddd-dddddddd0004', 'Eka', '081234567804', true),
('dddddddd-dddd-dddd-dddd-dddddddd0005', 'Adit', '081234567805', true),
('dddddddd-dddd-dddd-dddd-dddddddd0006', 'Mufti', '081234567806', true),
('dddddddd-dddd-dddd-dddd-dddddddd0007', 'Kamal', '081234567807', true),
('dddddddd-dddd-dddd-dddd-dddddddd0008', 'Milkan', '081234567808', true),
('dddddddd-dddd-dddd-dddd-dddddddd0009', 'Refan', '081234567809', true)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- 5. Penugasan Role (Fauzi sebagai Manager & Staff, lainnya Karyawan)
-- Manager: 11111111-1111-1111-1111-111111111102
-- Karyawan: 11111111-1111-1111-1111-111111111104
INSERT INTO user_roles (user_id, role_id) VALUES
('dddddddd-dddd-dddd-dddd-dddddddd0001', '11111111-1111-1111-1111-111111111104'), -- Fahry: Karyawan / Staff Kantor
('dddddddd-dddd-dddd-dddd-dddddddd0002', '11111111-1111-1111-1111-111111111102'), -- Fauzi: Manager
('dddddddd-dddd-dddd-dddd-dddddddd0002', '11111111-1111-1111-1111-111111111104'), -- Fauzi: Karyawan juga
('dddddddd-dddd-dddd-dddd-dddddddd0003', '11111111-1111-1111-1111-111111111104'),
('dddddddd-dddd-dddd-dddd-dddddddd0004', '11111111-1111-1111-1111-111111111104'),
('dddddddd-dddd-dddd-dddd-dddddddd0005', '11111111-1111-1111-1111-111111111104'),
('dddddddd-dddd-dddd-dddd-dddddddd0006', '11111111-1111-1111-1111-111111111104'),
('dddddddd-dddd-dddd-dddd-dddddddd0007', '11111111-1111-1111-1111-111111111104'),
('dddddddd-dddd-dddd-dddd-dddddddd0008', '11111111-1111-1111-1111-111111111104'),
('dddddddd-dddd-dddd-dddd-dddddddd0009', '11111111-1111-1111-1111-111111111104')
ON CONFLICT DO NOTHING;

-- Berikan hak akses cabang ke Manager Fauzi
INSERT INTO user_branch_access (user_id, branch_id) VALUES
('dddddddd-dddd-dddd-dddd-dddddddd0002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('dddddddd-dddd-dddd-dddd-dddddddd0002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT DO NOTHING;

-- 6. Master Karyawan Resmi & Penempatan Cabang
INSERT INTO employees (id, user_id, employee_code, name, job_title, hire_date, active, is_test_data) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0001', 'dddddddd-dddd-dddd-dddd-dddddddd0001', 'SA-STF-01', 'Fahry', 'Staff Kantor', '2026-01-01', true, false),
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0002', 'dddddddd-dddd-dddd-dddd-dddddddd0002', 'SA-STF-02', 'Fauzi', 'Staff Kantor / Manager', '2026-01-01', true, false),
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0003', 'dddddddd-dddd-dddd-dddd-dddddddd0003', 'SA-STF-03', 'Miftah', 'Staff Kantor', '2026-01-01', true, false),
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0004', 'dddddddd-dddd-dddd-dddd-dddddddd0004', 'SA-ADM-01', 'Eka', 'Admin', '2026-01-01', true, false),
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0005', 'dddddddd-dddd-dddd-dddd-dddddddd0005', 'SA-CRW-01', 'Adit', 'Crew Toko Bekasi', '2026-01-01', true, false),
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0006', 'dddddddd-dddd-dddd-dddd-dddddddd0006', 'SA-CRW-02', 'Mufti', 'Crew Toko Bekasi', '2026-01-01', true, false),
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0007', 'dddddddd-dddd-dddd-dddd-dddddddd0007', 'SA-CRW-03', 'Kamal', 'Crew Toko Bekasi', '2026-01-01', true, false),
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0008', 'dddddddd-dddd-dddd-dddd-dddddddd0008', 'SA-CRW-04', 'Milkan', 'Crew Toko Cikarang', '2026-01-01', true, false),
('eeeeeeee-eeee-eeee-eeee-eeeeeeee0009', 'dddddddd-dddd-dddd-dddd-dddddddd0009', 'SA-CRW-05', 'Refan', 'Crew Toko Cikarang', '2026-01-01', true, false)
ON CONFLICT (employee_code) DO NOTHING;

-- Penempatan Cabang (Bekasi & Cikarang)
INSERT INTO employee_assignments (id, employee_id, branch_id, valid_from, is_primary) VALUES
('ffffffff-ffff-ffff-ffff-ffffffff0001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-01', true),
('ffffffff-ffff-ffff-ffff-ffffffff0002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-01', true),
('ffffffff-ffff-ffff-ffff-ffffffff0003', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-01', true),
('ffffffff-ffff-ffff-ffff-ffffffff0004', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-01', true),
('ffffffff-ffff-ffff-ffff-ffffffff0005', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-01', true),
('ffffffff-ffff-ffff-ffff-ffffffff0006', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-01', true),
('ffffffff-ffff-ffff-ffff-ffffffff0007', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-01-01', true),
('ffffffff-ffff-ffff-ffff-ffffffff0008', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0008', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-01-01', true),
('ffffffff-ffff-ffff-ffff-ffffffff0009', 'eeeeeeee-eeee-eeee-eeee-eeeeeeee0009', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-01-01', true)
ON CONFLICT DO NOTHING;
