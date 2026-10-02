-- SULTAN ARAB APP — Data Awal & Data Uji Sintetis
-- PERINGATAN: Seluruh data cabang, nominal gaji, dan karyawan di bawah ini merupakan DATA UJI (Sintetis).
-- Belum merupakan data operasional yang disepakati (Menunggu jawaban Q01-Q11).

-- 1. Roles
INSERT INTO roles (id, code, name, description) VALUES
('11111111-1111-1111-1111-111111111101', 'owner', 'Owner', 'Pemilik usaha, akses penuh ke semua cabang dan payroll'),
('11111111-1111-1111-1111-111111111102', 'manager', 'Manager', 'Pengelola operasional cabang dan penugasan jadwal'),
('11111111-1111-1111-1111-111111111103', 'supervisor', 'Supervisor', 'Pengawas harian toko dan monitoring absensi'),
('11111111-1111-1111-1111-111111111104', 'karyawan', 'Karyawan', 'Staf pelaksana, absensi, riwayat, dan slip gaji pribadi')
ON CONFLICT (code) DO NOTHING;

-- 2. Test Branches (Data Uji)
INSERT INTO branches (id, code, name, timezone, latitude, longitude, radius_m, address, active, is_test_data) VALUES
('22222222-2222-2222-2222-222222222201', 'BR-BDH', '[DATA UJI] Cabang Bekasi Duta Harapan', 'Asia/Jakarta', -6.2168000, 107.0125000, 150, 'Jl. Duta Harapan Raya No. 12, Bekasi Utara', true, true),
('22222222-2222-2222-2222-222222222202', 'BR-CKR', '[DATA UJI] Cabang Cikarang Jababeka', 'Asia/Jakarta', -6.3082000, 107.1643000, 150, 'Ruko Thamrin Blvd Blok B No. 5, Cikarang Baru', true, true)
ON CONFLICT (code) DO NOTHING;

-- 3. Users & Profiles (Data Uji)
-- Password owner: owner123
-- Password manager: manager123
-- Password supervisor: spv123
-- Password ahmad: ahmad123
-- Password siti: siti123

INSERT INTO users (id, login_identifier, password_hash, active) VALUES
('33333333-3333-3333-3333-333333333301', 'owner', '$2a$10$6gKSRxTTw0OriHjeFfy9jO61WVN94UCHzi4RtEyWHgvaMwyLXLplm', true),
('33333333-3333-3333-3333-333333333302', 'manager', '$2a$10$EgU8Ig6g5mdAepQf2apJWeWjXkuLrshdm40KZeatLWDa2ul0oUqjm', true),
('33333333-3333-3333-3333-333333333303', 'supervisor', '$2a$10$E4vdVr2X/PMaEtEsMiOf2ejUVQJ/NIk1Ci/qiGRWcP0XF8X.iMtkO', true),
('33333333-3333-3333-3333-333333333304', 'ahmad', '$2a$10$aM/zpNU425AX2FeqiescYuzrhYj.qONr3K6wNeep20hOPSvpBmeiG', true),
('33333333-3333-3333-3333-333333333305', 'siti', '$2a$10$FVNmkupfysPVf03Wz8.QIe4U5.I8pm.5aNE1c5AUz6QibFAHfmEvS', true)
ON CONFLICT (login_identifier) DO NOTHING;

INSERT INTO profiles (id, display_name, phone, active) VALUES
('33333333-3333-3333-3333-333333333301', 'Bapak Owner Sultan Arab', '081200000001', true),
('33333333-3333-3333-3333-333333333302', 'Manager Area [DATA UJI]', '081200000002', true),
('33333333-3333-3333-3333-333333333303', 'Supervisor Toko [DATA UJI]', '081200000003', true),
('33333333-3333-3333-3333-333333333304', 'Ahmad (Crew Toko)', '081200000004', true),
('33333333-3333-3333-3333-333333333305', 'Siti (Kasir Toko)', '081200000005', true)
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

-- 4. User Roles Mapping
INSERT INTO user_roles (user_id, role_id) VALUES
('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101'), -- Owner
('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111102'), -- Manager
('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111103'), -- Supervisor
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111104'), -- Karyawan Ahmad
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111104')  -- Karyawan Siti
ON CONFLICT DO NOTHING;

-- 5. Branch Access Mapping
INSERT INTO user_branch_access (user_id, branch_id) VALUES
('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201'),
('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222202'),
('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201'),
('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202'),
('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201')
ON CONFLICT DO NOTHING;

-- 6. Employees Master (Data Uji)
INSERT INTO employees (id, user_id, employee_code, name, job_title, hire_date, active, is_test_data) VALUES
('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333304', 'SA-EMP-001', 'Ahmad [DATA UJI]', 'Crew Toko', '2026-01-01', true, true),
('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333305', 'SA-EMP-002', 'Siti [DATA UJI]', 'Kasir Toko', '2026-02-01', true, true)
ON CONFLICT (employee_code) DO NOTHING;

-- 7. Employee Assignments
INSERT INTO employee_assignments (id, employee_id, branch_id, valid_from, is_primary) VALUES
('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222201', '2026-01-01', true),
('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222202', '2026-02-01', true)
ON CONFLICT DO NOTHING;

-- 8. Test Shifts
INSERT INTO shifts (id, branch_id, name, start_time, end_time, crosses_midnight, is_test_data) VALUES
('66666666-6666-6666-6666-666666666601', '22222222-2222-2222-2222-222222222201', 'Shift Pagi [DATA UJI]', '08:00:00', '16:00:00', false, true),
('66666666-6666-6666-6666-666666666602', '22222222-2222-2222-2222-222222222201', 'Shift Siang [DATA UJI]', '13:00:00', '21:00:00', false, true)
ON CONFLICT DO NOTHING;

-- 9. Work Schedules (Jadwal Hari Ini untuk Ahmad)
INSERT INTO work_schedules (id, employee_id, branch_id, work_date, shift_id) VALUES
('77777777-7777-7777-7777-777777777701', '44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222201', CURRENT_DATE, '66666666-6666-6666-6666-666666666601'),
('77777777-7777-7777-7777-777777777702', '44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222202', CURRENT_DATE, '66666666-6666-6666-6666-666666666601')
ON CONFLICT (employee_id, work_date) DO NOTHING;

-- 10. Pay Components (Komponen Gaji)
INSERT INTO pay_components (id, code, name, kind, is_fixed, default_amount, description) VALUES
('88888888-8888-8888-8888-888888888801', 'GAPOK', 'Gaji Pokok [DATA UJI]', 'earning', true, 2500000, 'Gaji pokok bulanan acuan'),
('88888888-8888-8888-8888-888888888802', 'UMAKAN', 'Uang Makan [DATA UJI: Rp10.000]', 'earning', false, 10000, 'Uang makan per kehadiran (syarat kelayakan menunggu Q05)'),
('88888888-8888-8888-8888-888888888803', 'KOMISI', 'Komisi Sales [Input Manual]', 'earning', false, 0, 'Komisi penjualan dari input manual supervisor/manager'),
('88888888-8888-8888-8888-888888888804', 'POT_TELAT', 'Potongan Keterlambatan [DATA UJI]', 'deduction', false, 0, 'Potongan terlambat (rumus menunggu konfirmasi Q06)')
ON CONFLICT (code) DO NOTHING;

-- 11. Test Payroll Period (Periode 27 - 26)
INSERT INTO payroll_periods (id, start_date, end_date, label, status) VALUES
('99999999-9999-9999-9999-999999999901', '2026-03-27', '2026-04-26', 'Periode 27 Mar - 26 Apr 2026 [DATA UJI]', 'draft')
ON CONFLICT DO NOTHING;
