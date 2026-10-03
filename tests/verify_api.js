const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BASE_URL = 'http://localhost:3000';
const STORAGE_ROOT = path.resolve(__dirname, '..', 'storage');

/*
 * Pengujian API memakai FIXTURE SEMENTARA yang dibuat di awal dan dihapus
 * kembali di akhir (try/finally), sehingga tidak ada data uji yang tertinggal
 * di database operasional dan tidak bergantung pada kata sandi akun asli.
 */
const RUN_ID = Date.now().toString(36);
const FIX = {
  password: crypto.randomBytes(12).toString('hex'),
  employeeLogin: `zz_uji_karyawan_${RUN_ID}`,
  managerLogin: `zz_uji_pengelola_${RUN_ID}`,
  employeeCode: `ZZ-UJI-${RUN_ID}`.toUpperCase(),
  branchCode: `ZZ-UJI-CBG-${RUN_ID}`.toUpperCase(),
  ids: { users: [], employeeId: null, periodId: null, branchIds: [] }
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres@localhost:5433/sultan_arab_app'
});

function request(method, urlPath, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers['Cookie'] = cookie;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let setCookie = res.headers['set-cookie'];
        let cookieVal = null;
        if (setCookie) {
          const match = setCookie[0].match(/sultan_token=[^;]+/);
          if (match) cookieVal = match[0];
        }
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), cookie: cookieVal });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, cookie: cookieVal });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function createUser(login, displayName, roleCode, hash) {
  const u = await pool.query(
    `INSERT INTO users (login_identifier, password_hash, active) VALUES ($1, $2, true) RETURNING id`,
    [login, hash]
  );
  const userId = u.rows[0].id;
  FIX.ids.users.push(userId);
  await pool.query(`INSERT INTO profiles (id, display_name, active) VALUES ($1, $2, true)`, [userId, displayName]);
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE code = $2`,
    [userId, roleCode]
  );
  return userId;
}

async function setupFixtures() {
  const hash = await bcrypt.hash(FIX.password, 10);
  const branch = await pool.query(`SELECT id FROM branches WHERE active = true ORDER BY code LIMIT 1`);
  if (!branch.rows.length) throw new Error('Tidak ada cabang aktif untuk pengujian.');
  FIX.branchId = branch.rows[0].id;

  const empUserId = await createUser(FIX.employeeLogin, 'ZZ Uji Karyawan (sementara)', 'karyawan', hash);
  await createUser(FIX.managerLogin, 'ZZ Uji Pengelola (sementara)', 'owner', hash);

  const emp = await pool.query(
    `INSERT INTO employees (user_id, employee_code, name, job_title, hire_date, active, is_test_data)
     VALUES ($1, $2, 'ZZ Uji Karyawan (sementara)', 'Crew Toko', CURRENT_DATE, true, true) RETURNING id`,
    [empUserId, FIX.employeeCode]
  );
  FIX.ids.employeeId = emp.rows[0].id;
  await pool.query(
    `INSERT INTO employee_assignments (employee_id, branch_id, valid_from, is_primary) VALUES ($1, $2, CURRENT_DATE, true)`,
    [FIX.ids.employeeId, FIX.branchId]
  );

  const period = await pool.query(
    `INSERT INTO payroll_periods (start_date, end_date, label, status)
     VALUES (CURRENT_DATE - 3, CURRENT_DATE + 3, $1, 'draft') RETURNING id`,
    [`ZZ Periode Uji Otomatis ${RUN_ID}`]
  );
  FIX.ids.periodId = period.rows[0].id;
}

async function teardownFixtures() {
  const { employeeId, periodId, users, branchIds } = FIX.ids;
  try {
    if (periodId) await pool.query(`DELETE FROM payroll_periods WHERE id = $1`, [periodId]);
    if (employeeId) await pool.query(`DELETE FROM employees WHERE id = $1`, [employeeId]);
    if (branchIds.length) await pool.query(`DELETE FROM branches WHERE id = ANY($1)`, [branchIds]);
    if (users.length) await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [users]);
  } catch (err) {
    console.error('[Teardown] Gagal menghapus fixture database:', err.message);
  }
  for (const dir of [
    employeeId && path.join(STORAGE_ROOT, 'attendance-photos', employeeId),
    periodId && path.join(STORAGE_ROOT, 'payslips', periodId)
  ].filter(Boolean)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('   [Teardown] Fixture sementara dihapus — database operasional bersih.');
}

async function login(loginId) {
  const res = await request('POST', '/api/v1/auth/login', { login_identifier: loginId, password: FIX.password });
  if (res.status !== 200 || !res.data.success) {
    throw new Error(`Login ${loginId} gagal: ` + JSON.stringify(res.data));
  }
  return res;
}

async function runApiTests() {
  console.log('[API Test] Memulai Pengujian Endpoint API SULTAN ARAB APP...\n');

  // 1. Health check
  console.log('1. Health check...');
  const health = await request('GET', '/api/health');
  if (health.status !== 200 || health.data.status !== 'ok') {
    throw new Error('Health check gagal: ' + JSON.stringify(health));
  }
  console.log('   OK! Server aktif:', health.data.appName);

  // 2. Login karyawan sementara
  console.log('2. Login Karyawan (fixture sementara)...');
  const loginEmp = await login(FIX.employeeLogin);
  const empCookie = loginEmp.cookie;
  console.log('   OK! Token didapatkan untuk role:', loginEmp.data.user.roles);

  // 3. Login pengelola sementara (role owner)
  console.log('3. Login Pengelola (fixture sementara, role owner)...');
  const loginMgr = await login(FIX.managerLogin);
  const mgrCookie = loginMgr.cookie;
  console.log('   OK! Token didapatkan untuk:', loginMgr.data.user.displayName);

  // 4. GET Branches
  console.log('4. Mengambil daftar cabang...');
  const branchesRes = await request('GET', '/api/v1/branches', null, empCookie);
  if (branchesRes.status !== 200 || !branchesRes.data.success) {
    throw new Error('Ambil cabang gagal');
  }
  const branches = branchesRes.data.branches;
  if (branches.some(b => b.is_test_data || /DATA UJI/i.test(b.name))) {
    throw new Error('Masih ada cabang data uji: ' + JSON.stringify(branches.map(b => b.name)));
  }
  console.log(`   OK! Ditemukan ${branches.length} cabang resmi.`);
  const branch1 = branches.find(b => b.id === FIX.branchId) || branches[0];

  // 5. Check-In
  console.log('5. Melakukan Absen Masuk (Check-In)...');
  const idempotencyKey = 'TEST-KEY-' + Date.now();
  const checkInRes = await request('POST', '/api/v1/attendance/check-in', {
    branch_id: branch1.id,
    latitude: branch1.latitude,
    longitude: branch1.longitude,
    accuracy_m: 10,
    device_time: new Date().toISOString(),
    idempotency_key: idempotencyKey,
    photo_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
  }, empCookie);
  if (checkInRes.status !== 201 || !checkInRes.data.success) {
    throw new Error('Check-in gagal: ' + JSON.stringify(checkInRes.data));
  }
  console.log('   OK! Check-in berhasil dicatat:', checkInRes.data.message);

  // 6. Idempotency
  console.log('6. Menguji Idempotency (Kirim ulang key yang sama)...');
  const duplicateRes = await request('POST', '/api/v1/attendance/check-in', {
    branch_id: branch1.id,
    idempotency_key: idempotencyKey
  }, empCookie);
  if (!duplicateRes.data.isDuplicate) {
    throw new Error('Idempotency gagal: server tidak mendeteksi duplikat');
  }
  console.log('   OK! Server mendeteksi idempotency & mencegah entri ganda.');

  // 7. Check-Out
  console.log('7. Melakukan Absen Pulang (Check-Out)...');
  const checkOutRes = await request('POST', '/api/v1/attendance/check-out', {
    branch_id: branch1.id,
    latitude: branch1.latitude,
    longitude: branch1.longitude,
    accuracy_m: 12,
    device_time: new Date().toISOString(),
    idempotency_key: 'TEST-OUT-' + Date.now()
  }, empCookie);
  if (checkOutRes.status !== 201 || !checkOutRes.data.success) {
    throw new Error('Check-out gagal: ' + JSON.stringify(checkOutRes.data));
  }
  console.log('   OK! Check-out berhasil dicatat:', checkOutRes.data.message);

  // 8. Riwayat
  console.log('8. Mengambil Riwayat Absensi Pribadi...');
  const meAtt = await request('GET', '/api/v1/attendance/me', null, empCookie);
  if (!meAtt.data.todaySession || meAtt.data.todaySession.events.length < 2) {
    throw new Error('Riwayat absensi tidak lengkap');
  }
  console.log('   OK! Sesi hari ini memiliki', meAtt.data.todaySession.events.length, 'kejadian.');

  // 9. Monitoring
  console.log('9. Monitoring Absensi oleh Pengelola...');
  const monitorRes = await request('GET', '/api/v1/attendance/monitoring', null, mgrCookie);
  if (monitorRes.status !== 200 || !monitorRes.data.success) {
    throw new Error('Monitoring gagal');
  }
  console.log('   OK! Ringkasan Monitoring:', monitorRes.data.summary);

  // 10. Payroll draft pada periode sementara
  console.log('10. Menghitung Draft Payroll (periode sementara)...');
  const commRes = await request('POST', '/api/v1/payroll/commissions', {
    employee_id: FIX.ids.employeeId,
    period_id: FIX.ids.periodId,
    amount: 150000,
    note: 'Komisi pengujian otomatis'
  }, mgrCookie);
  if (!commRes.data.success) throw new Error('Input komisi gagal: ' + JSON.stringify(commRes.data));

  const calcRes = await request('POST', '/api/v1/payroll/runs/calculate', { period_id: FIX.ids.periodId }, mgrCookie);
  if (calcRes.status !== 201 || !calcRes.data.success) {
    throw new Error('Kalkulasi payroll gagal: ' + JSON.stringify(calcRes.data));
  }
  console.log('   OK! Draft Payroll berhasil dihitung. Versi:', calcRes.data.run.version);

  // 11. Finalisasi
  console.log('11. Finalisasi Payroll...');
  const finalizeRes = await request('POST', `/api/v1/payroll/runs/${calcRes.data.run.id}/finalize`, null, mgrCookie);
  if (finalizeRes.status !== 200 || !finalizeRes.data.success) {
    throw new Error('Finalisasi gagal: ' + JSON.stringify(finalizeRes.data));
  }
  console.log('   OK!', finalizeRes.data.message);

  // 12. Kunjungan luar (Q05)
  console.log('12. Menguji Absen Kunjungan Luar (Q05: Tidak dapat uang makan)...');
  const luarRes = await request('POST', '/api/v1/attendance/check-in', {
    branch_id: branch1.id,
    latitude: -6.1754,
    longitude: 106.8272,
    accuracy_m: 15,
    attendance_type: 'kunjungan_luar',
    device_time: new Date().toISOString(),
    idempotency_key: 'TEST-LUAR-' + Date.now(),
    photo_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
  }, empCookie);
  if (luarRes.status !== 201 || !luarRes.data.success) {
    throw new Error('Check-in kunjungan luar gagal: ' + JSON.stringify(luarRes.data));
  }
  if (luarRes.data.isMealAllowanceEligible !== false) {
    throw new Error('Validasi uang makan gagal: kunjungan luar tidak boleh mendapat uang makan');
  }
  console.log('   OK! Kunjungan luar tercatat tanpa uang makan (Sesuai Q05).');

  // 13. Upload slip PDF (Q06)
  console.log('13. Pengelola Mengunggah PDF Slip Gaji (Q06)...');
  const dummyPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');
  const formData = new FormData();
  formData.append('employee_id', FIX.ids.employeeId);
  formData.append('period_id', FIX.ids.periodId);
  formData.append('notes', 'Slip pengujian otomatis');
  formData.append('file', new Blob([dummyPdfBuffer], { type: 'application/pdf' }), 'slip_uji_otomatis.pdf');

  const uploadRes = await fetch(`${BASE_URL}/api/v1/payroll/upload-slip`, {
    method: 'POST',
    headers: { 'Cookie': mgrCookie },
    body: formData
  });
  const uploadJson = await uploadRes.json();
  if (uploadRes.status !== 201 || !uploadJson.success) {
    throw new Error('Upload PDF slip gagal: ' + JSON.stringify(uploadJson));
  }
  console.log('   OK! PDF Slip Gaji berhasil diunggah. Payslip ID:', uploadJson.payslip.id);

  // 14. Karyawan mengunduh slip
  console.log('14. Karyawan Mengunduh Berkas Slip PDF...');
  const slips = await request('GET', '/api/v1/payroll/me/payslips', null, empCookie);
  const pdfSlip = (slips.data.payslips || []).find(s => s.pdf_path);
  if (slips.status !== 200 || !pdfSlip) {
    throw new Error('Slip gaji PDF untuk karyawan tidak ditemukan');
  }
  const downloadRes = await fetch(`${BASE_URL}/api/v1/payroll/slips/${pdfSlip.payslip_id || pdfSlip.id}/download`, {
    headers: { 'Cookie': empCookie }
  });
  if (downloadRes.status !== 200) {
    throw new Error('Unduh slip PDF gagal: HTTP ' + downloadRes.status);
  }
  const pdfBytes = await downloadRes.arrayBuffer();
  console.log('   OK! Berkas PDF berhasil diunduh. Ukuran:', pdfBytes.byteLength, 'bytes');

  // 15. Tambah cabang (+ Cabang) oleh pengelola
  console.log('15. Menambah Cabang Baru via tombol "+ Cabang"...');
  const forbidden = await request('POST', '/api/v1/branches', { code: 'X', name: 'X' }, empCookie);
  if (forbidden.status !== 403) throw new Error('Karyawan biasa seharusnya tidak boleh menambah cabang (HTTP ' + forbidden.status + ')');
  const invalid = await request('POST', '/api/v1/branches', { code: FIX.branchCode, name: 'Uji', latitude: 200, longitude: 10 }, mgrCookie);
  if (invalid.status !== 400) throw new Error('Koordinat tidak valid seharusnya ditolak (HTTP ' + invalid.status + ')');
  const created = await request('POST', '/api/v1/branches', {
    code: FIX.branchCode,
    name: 'ZZ Cabang Uji Otomatis',
    address: 'Alamat uji',
    latitude: -6.25,
    longitude: 107.05,
    radius_m: 150
  }, mgrCookie);
  if (created.status !== 201 || !created.data.success) {
    throw new Error('Tambah cabang gagal: ' + JSON.stringify(created.data));
  }
  FIX.ids.branchIds.push(created.data.branch.id);
  if (created.data.branch.is_test_data !== false) throw new Error('Cabang baru harus tercatat sebagai data resmi');
  const dup = await request('POST', '/api/v1/branches', { code: FIX.branchCode, name: 'Duplikat' }, mgrCookie);
  if (dup.status !== 409) throw new Error('Kode cabang duplikat seharusnya ditolak (HTTP ' + dup.status + ')');
  const shiftRes = await request('GET', '/api/v1/schedules/shifts', null, mgrCookie);
  const newShifts = shiftRes.data.shifts.filter(s => s.branch_id === created.data.branch.id);
  const siang = newShifts.find(s => /siang/i.test(s.name));
  if (newShifts.length !== 2 || !siang || siang.start_time.slice(0, 5) !== '12:00') {
    throw new Error('Shift otomatis cabang baru tidak sesuai: ' + JSON.stringify(newShifts));
  }
  console.log('   OK! Cabang dibuat + shift Pagi (08:00) & Siang (12:00) otomatis; validasi 400/403/409 berjalan.');

  // 16. Retensi foto (Q09)
  console.log('16. Menjalankan Skrip Retensi Foto 7 Hari (Q09)...');
  const { execSync } = require('child_process');
  const cleanupOutput = execSync('node scripts/cleanup-old-photos.js', { encoding: 'utf8', cwd: path.resolve(__dirname, '..') });
  console.log('   OK! Output Pembersihan Foto:\n', cleanupOutput.trim().split('\n').map(l => '     ' + l).join('\n'));

  // 17. Ubah Password Mandiri (Perorangan)
  console.log('17. Menguji Ubah Password Mandiri (Change Password)...');
  const wrongOld = await request('POST', '/api/v1/auth/change-password', {
    current_password: 'wrongpassword',
    new_password: 'newSecretPass123',
    confirm_password: 'newSecretPass123'
  }, empCookie);
  if (wrongOld.status !== 400 || wrongOld.data.success) {
    throw new Error('Password lama yang salah seharusnya ditolak (HTTP ' + wrongOld.status + ')');
  }

  const mismatch = await request('POST', '/api/v1/auth/change-password', {
    current_password: FIX.password,
    new_password: 'newSecretPass123',
    confirm_password: 'differentPassword'
  }, empCookie);
  if (mismatch.status !== 400 || mismatch.data.success) {
    throw new Error('Konfirmasi password beda seharusnya ditolak (HTTP ' + mismatch.status + ')');
  }

  const changeOk = await request('POST', '/api/v1/auth/change-password', {
    current_password: FIX.password,
    new_password: 'newSecretPass123',
    confirm_password: 'newSecretPass123'
  }, empCookie);
  if (changeOk.status !== 200 || !changeOk.data.success) {
    throw new Error('Ubah password mandiri gagal: ' + JSON.stringify(changeOk.data));
  }
  // Revert back
  await request('POST', '/api/v1/auth/change-password', {
    current_password: 'newSecretPass123',
    new_password: FIX.password,
    confirm_password: FIX.password
  }, empCookie);
  console.log('   OK! Validasi password lama, konfirmasi cocok, dan perubahan mandiri berhasil.');

  // 18. Reset Password oleh Pengelola (Preventif lupa password)
  console.log('18. Menguji Reset Password oleh Pengelola (Preventif)...');
  const empTriesReset = await request('POST', '/api/v1/auth/reset-password', {
    user_id: FIX.ids.users[0],
    new_password: 'anyPassword123'
  }, empCookie);
  if (empTriesReset.status !== 403) {
    throw new Error('Karyawan biasa seharusnya dilarang mereset password (HTTP ' + empTriesReset.status + ')');
  }

  const mgrResetOk = await request('POST', '/api/v1/auth/reset-password', {
    user_id: FIX.ids.users[0],
    new_password: 'sultanReset123'
  }, mgrCookie);
  if (mgrResetOk.status !== 200 || !mgrResetOk.data.success) {
    throw new Error('Pengelola reset password karyawan gagal: ' + JSON.stringify(mgrResetOk.data));
  }
  console.log('   OK! Reset password karyawan oleh pengelola berhasil & hak akses dibatasi.');

  console.log('\n======================================================');
  console.log(' SELURUH PENGUJIAN API & ATURAN SISTEM BERHASIL 100%!');
  console.log('======================================================');
}

(async () => {
  let failed = false;
  try {
    await setupFixtures();
    await runApiTests();
  } catch (err) {
    failed = true;
    console.error('\n[PENGUJIAN GAGAL]:', err.message);
  } finally {
    await teardownFixtures();
    await pool.end();
  }
  if (failed) process.exit(1);
})();
