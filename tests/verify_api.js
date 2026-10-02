const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, path, body = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
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
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json, cookie: cookieVal });
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

async function runApiTests() {
  console.log('[API Test] Memulai Pengujian Endpoint API SULTAN ARAB APP...\n');

  // 1. Health check
  console.log('1. Health check...');
  const health = await request('GET', '/api/health');
  if (health.status !== 200 || health.data.status !== 'ok') {
    throw new Error('Health check gagal: ' + JSON.stringify(health));
  }
  console.log('   OK! Server aktif:', health.data.appName);

  // 2. Login Ahmad (Karyawan)
  console.log('2. Login Karyawan (Ahmad)...');
  const loginAhmad = await request('POST', '/api/v1/auth/login', {
    login_identifier: 'ahmad',
    password: 'ahmad123'
  });
  if (loginAhmad.status !== 200 || !loginAhmad.data.success) {
    throw new Error('Login Ahmad gagal: ' + JSON.stringify(loginAhmad.data));
  }
  const ahmadCookie = loginAhmad.cookie;
  console.log('   OK! Token didapatkan untuk role:', loginAhmad.data.user.roles);

  // 3. Login Owner
  console.log('3. Login Owner...');
  const loginOwner = await request('POST', '/api/v1/auth/login', {
    login_identifier: 'owner',
    password: 'owner123'
  });
  if (loginOwner.status !== 200 || !loginOwner.data.success) {
    throw new Error('Login Owner gagal: ' + JSON.stringify(loginOwner.data));
  }
  const ownerCookie = loginOwner.cookie;
  console.log('   OK! Token didapatkan untuk Owner:', loginOwner.data.user.displayName);

  // 4. GET Branches
  console.log('4. Mengambil daftar cabang...');
  const branchesRes = await request('GET', '/api/v1/branches', null, ahmadCookie);
  if (branchesRes.status !== 200 || !branchesRes.data.success) {
    throw new Error('Ambil cabang gagal');
  }
  const branches = branchesRes.data.branches;
  console.log(`   OK! Ditemukan ${branches.length} cabang.`);
  const branch1 = branches[0];

  // 5. Check-In Absen Masuk Ahmad
  console.log('5. Melakukan Absen Masuk (Check-In)...');
  const idempotencyKey = 'TEST-KEY-' + Date.now();
  const checkInRes = await request('POST', '/api/v1/attendance/check-in', {
    branch_id: branch1.id,
    latitude: branch1.latitude || -6.2168,
    longitude: branch1.longitude || 107.0125,
    accuracy_m: 10,
    device_time: new Date().toISOString(),
    idempotency_key: idempotencyKey,
    photo_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
  }, ahmadCookie);

  if (checkInRes.status !== 201 || !checkInRes.data.success) {
    throw new Error('Check-in gagal: ' + JSON.stringify(checkInRes.data));
  }
  console.log('   OK! Check-in berhasil dicatat:', checkInRes.data.message);
  console.log('   Validasi Lokasi:', checkInRes.data.locationValidation);

  // 6. Idempotency Test (Kirim ulang key yang sama)
  console.log('6. Menguji Idempotency (Kirim ulang key yang sama)...');
  const duplicateRes = await request('POST', '/api/v1/attendance/check-in', {
    branch_id: branch1.id,
    idempotency_key: idempotencyKey
  }, ahmadCookie);
  if (!duplicateRes.data.isDuplicate) {
    throw new Error('Idempotency gagal: server tidak mendeteksi duplikat');
  }
  console.log('   OK! Server berhasil mendeteksi idempotency & mencegah entri ganda.');

  // 7. Check-Out Absen Pulang
  console.log('7. Melakukan Absen Pulang (Check-Out)...');
  const checkOutKey = 'TEST-OUT-' + Date.now();
  const checkOutRes = await request('POST', '/api/v1/attendance/check-out', {
    branch_id: branch1.id,
    latitude: branch1.latitude || -6.2168,
    longitude: branch1.longitude || 107.0125,
    accuracy_m: 12,
    device_time: new Date().toISOString(),
    idempotency_key: checkOutKey
  }, ahmadCookie);

  if (checkOutRes.status !== 201 || !checkOutRes.data.success) {
    throw new Error('Check-out gagal: ' + JSON.stringify(checkOutRes.data));
  }
  console.log('   OK! Check-out berhasil dicatat:', checkOutRes.data.message);

  // 8. Riwayat Absensi Pribadi
  console.log('8. Mengambil Riwayat Absensi Pribadi...');
  const meAtt = await request('GET', '/api/v1/attendance/me', null, ahmadCookie);
  if (!meAtt.data.todaySession || meAtt.data.todaySession.events.length < 2) {
    throw new Error('Riwayat absensi tidak lengkap');
  }
  console.log('   OK! Sesi hari ini memiliki', meAtt.data.todaySession.events.length, 'kejadian.');

  // 9. Monitoring Absensi oleh Owner
  console.log('9. Monitoring Absensi oleh Owner...');
  const monitorRes = await request('GET', '/api/v1/attendance/monitoring', null, ownerCookie);
  if (monitorRes.status !== 200 || !monitorRes.data.success) {
    throw new Error('Monitoring gagal');
  }
  console.log('   OK! Ringkasan Monitoring:', monitorRes.data.summary);

  // 10. Hitung Draft Payroll oleh Owner
  console.log('10. Menghitung Draft Payroll (Periode 27-26)...');
  const periodsRes = await request('GET', '/api/v1/payroll/periods', null, ownerCookie);
  const period = periodsRes.data.periods[0];

  // Input komisi manual dulu untuk Ahmad
  const empList = await request('GET', '/api/v1/employees', null, ownerCookie);
  const empAhmad = empList.data.employees.find(e => e.employee_code === 'SA-EMP-001');

  await request('POST', '/api/v1/payroll/commissions', {
    employee_id: empAhmad.id,
    period_id: period.id,
    amount: 150000,
    note: 'Komisi penjualan kurma dan zaitun [DATA UJI]'
  }, ownerCookie);

  const calcRes = await request('POST', '/api/v1/payroll/runs/calculate', {
    period_id: period.id
  }, ownerCookie);

  if (calcRes.status !== 201 || !calcRes.data.success) {
    throw new Error('Kalkulasi payroll gagal: ' + JSON.stringify(calcRes.data));
  }
  console.log('   OK! Draft Payroll berhasil dihitung. Versi:', calcRes.data.run.version);
  console.log('   Rincian Item Karyawan:', calcRes.data.run.items);

  // 11. Finalisasi Payroll oleh Owner
  console.log('11. Finalisasi Payroll dan Penerbitan Slip...');
  const finalizeRes = await request('POST', `/api/v1/payroll/runs/${calcRes.data.run.id}/finalize`, null, ownerCookie);
  if (finalizeRes.status !== 200 || !finalizeRes.data.success) {
    throw new Error('Finalisasi gagal: ' + JSON.stringify(finalizeRes.data));
  }
  console.log('   OK!', finalizeRes.data.message);

  // 13. Absen Masuk Kunjungan Luar (Q05: Tidak Dapat Uang Makan)
  console.log('13. Menguji Absen Kunjungan Luar (Q05: Tidak dapat uang makan)...');
  const luarKey = 'TEST-LUAR-' + Date.now();
  const luarRes = await request('POST', '/api/v1/attendance/check-in', {
    branch_id: branch1.id,
    latitude: -6.1754, // Luar kantor/toko
    longitude: 106.8272,
    accuracy_m: 15,
    attendance_type: 'kunjungan_luar',
    device_time: new Date().toISOString(),
    idempotency_key: luarKey,
    photo_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
  }, ahmadCookie);

  if (luarRes.status !== 201 || !luarRes.data.success) {
    throw new Error('Check-in kunjungan luar gagal: ' + JSON.stringify(luarRes.data));
  }
  if (luarRes.data.isMealAllowanceEligible !== false) {
    throw new Error('Validasi uang makan gagal: kunjungan luar tidak boleh mendapat uang makan');
  }
  console.log('   OK! Kunjungan luar tercatat. Uang makan status:', luarRes.data.isMealAllowanceEligible ? 'Aktif' : 'Non-Aktif (Sesuai Aturan Q05)');

  // 14. Login Manager (Fauzi) & Upload PDF Slip Gaji (Q06 & Q07)
  console.log('14. Login Manager (Fauzi) & Upload PDF Slip Gaji (Q06)...');
  const loginManager = await request('POST', '/api/v1/auth/login', {
    login_identifier: 'fauzi',
    password: 'fauzi123'
  });
  if (loginManager.status !== 200 || !loginManager.data.success) {
    throw new Error('Login Manager Fauzi gagal: ' + JSON.stringify(loginManager.data));
  }
  const managerCookie = loginManager.cookie;
  console.log('   OK! Token didapatkan untuk Manager:', loginManager.data.user.displayName);

  // Ambil data Eka untuk menerima slip PDF
  const empEka = empList.data.employees.find(e => e.name === 'Eka');
  if (!empEka) throw new Error('Data karyawan Eka tidak ditemukan');

  // Buat dummy PDF buffer & FormData
  const dummyPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');
  const formData = new FormData();
  formData.append('employee_id', empEka.id);
  formData.append('period_id', period.id);
  formData.append('notes', 'Slip Gaji Resmi Periode 27-26 (PDF)');
  formData.append('file', new Blob([dummyPdfBuffer], { type: 'application/pdf' }), 'slip_gaji_eka_2026.pdf');

  const uploadRes = await fetch(`${BASE_URL}/api/v1/payroll/upload-slip`, {
    method: 'POST',
    headers: { 'Cookie': managerCookie },
    body: formData
  });
  const uploadJson = await uploadRes.json();
  if (uploadRes.status !== 201 || !uploadJson.success) {
    throw new Error('Upload PDF slip gagal: ' + JSON.stringify(uploadJson));
  }
  console.log('   OK! PDF Slip Gaji berhasil diunggah oleh Manager. Payslip ID:', uploadJson.payslip.id);
  console.log('   Link Notifikasi WhatsApp (Q011):', uploadJson.whatsAppReminderLink);

  // 15. Karyawan (Eka) Login dan Mengunduh PDF Slip
  console.log('15. Karyawan (Eka) Login & Mengunduh Berkas Slip PDF...');
  const loginEka = await request('POST', '/api/v1/auth/login', {
    login_identifier: 'eka',
    password: 'eka123'
  });
  const ekaCookie = loginEka.cookie;
  const ekaSlips = await request('GET', '/api/v1/payroll/me/payslips', null, ekaCookie);
  if (ekaSlips.status !== 200 || ekaSlips.data.payslips.length === 0) {
    throw new Error('Slip gaji untuk Eka tidak ditemukan');
  }
  const ekaSlip = ekaSlips.data.payslips[0];
  console.log('   OK! Slip Eka ditemukan:', ekaSlip.original_filename, `(${ekaSlip.file_size} bytes)`);

  const slipDownloadId = ekaSlip.payslip_id || ekaSlip.id;
  const downloadRes = await fetch(`${BASE_URL}/api/v1/payroll/slips/${slipDownloadId}/download`, {
    headers: { 'Cookie': ekaCookie }
  });
  if (downloadRes.status !== 200) {
    throw new Error('Unduh slip PDF gagal: HTTP ' + downloadRes.status);
  }
  const pdfBytes = await downloadRes.arrayBuffer();
  console.log('   OK! Berkas PDF berhasil diunduh. Ukuran:', pdfBytes.byteLength, 'bytes');

  // 16. Verifikasi Retensi Foto 7 Hari (Q09)
  console.log('16. Menjalankan Skrip Retensi Foto 7 Hari (Q09)...');
  const { execSync } = require('child_process');
  const cleanupOutput = execSync('node scripts/cleanup-old-photos.js', { encoding: 'utf8' });
  console.log('   OK! Output Pembersihan Foto:\n', cleanupOutput.trim().split('\n').map(l => '     ' + l).join('\n'));

  console.log('\n======================================================');
  console.log(' SELURUH PENGUJIAN API & ATURAN SISTEM BERHASIL 100%!');
  console.log('======================================================');
}

runApiTests().catch(err => {
  console.error('\n[PENGUJIAN GAGAL]:', err.message);
  process.exit(1);
});

