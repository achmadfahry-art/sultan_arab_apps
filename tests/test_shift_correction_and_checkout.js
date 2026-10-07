const http = require('http');
const crypto = require('crypto');
const db = require('../apps/server/src/db');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('=== TEST KOREKSI JADWAL SHIFT & ABSEN PULANG (KAMERA & GPS) ===\n');

  // 1. Get Owner user for session
  const ownerRes = await db.query(`
    SELECT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.code IN ('owner', 'manager') LIMIT 1;
  `);
  const ownerId = ownerRes.rows[0].id;
  const token = 'test-token-shift-adj-' + Date.now();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour');`,
    [ownerId, tokenHash]
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `sultan_token=${token}`
  };

  const testCode = 'TEST-SHIFT-' + Date.now().toString(36).toUpperCase();
  let createdEmpId = null;
  let testUserId = null;
  let empTokenHash = null;

  try {
    // 2. Buat karyawan uji
    const empRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/employees',
      method: 'POST',
      headers: authHeaders
    }, {
      employee_code: testCode,
      name: 'Staf Uji Shift & Pulang',
      phone: '081288887777',
      job_title: 'Crew Toko Uji',
      day_off: 'Ahad',
      is_test_data: true
    });
    createdEmpId = empRes.data.employee.id;
    console.log(`1. Karyawan uji berhasil dibuat: ${testCode} (ID: ${createdEmpId})`);

    // Dapatkan user_id karyawan untuk login karyawan
    const userQuery = await db.query(`SELECT user_id FROM employees WHERE id = $1`, [createdEmpId]);
    testUserId = userQuery.rows[0].user_id;

    // Buat token session karyawan uji
    const empToken = 'test-token-emp-' + Date.now();
    empTokenHash = crypto.createHash('sha256').update(empToken).digest('hex');
    await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour');`,
      [testUserId, empTokenHash]
    );

    const empAuthHeaders = {
      'Content-Type': 'application/json',
      'Cookie': `sultan_token=${empToken}`
    };

    // 3. Lakukan Absen Masuk Karyawan
    const shiftPagiRes = await db.query(`SELECT id, name FROM shifts WHERE name ILIKE '%pagi%' LIMIT 1`);
    const shiftPagiId = shiftPagiRes.rows[0].id;
    const branchRes = await db.query(`SELECT id FROM branches LIMIT 1`);
    const branchId = branchRes.rows[0].id;

    const checkInRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/check-in',
      method: 'POST',
      headers: empAuthHeaders
    }, {
      branch_id: branchId,
      shift_id: shiftPagiId,
      attendance_type: 'hadir',
      latitude: -6.2122736,
      longitude: 107.0218103,
      accuracy_m: 10,
      photo_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
      device_time: new Date().toISOString(),
      idempotency_key: `IN-${testCode}-${Date.now()}`
    });
    console.log(`2. Absen Masuk karyawan berhasil: Status ${checkInRes.status}, Shift Awal: ${shiftPagiRes.rows[0].name}`);
    if (checkInRes.status !== 201) throw new Error('Check-in failed');

    // 4. Periksa Monitoring (Harus tampil di monitoring pengelola)
    const monRes1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/monitoring',
      method: 'GET',
      headers: authHeaders
    });
    const monRecord1 = monRes1.data.records.find(r => r.employee_id === createdEmpId);
    console.log(`3. Monitoring sebelum koreksi:`);
    console.log(`   - Shift Terdeteksi: ${monRecord1?.shift_name}`);
    console.log(`   - Jam Masuk: ${monRecord1?.check_in_time}`);
    console.log(`   - Jam Pulang: ${monRecord1?.check_out_time || '(Belum Pulang)'}`);
    if (!monRecord1?.shift_name.toLowerCase().includes('pagi')) {
      throw new Error('Monitoring does not show initial shift pagi!');
    }

    // 5. TEST FITUR 1: Koreksi Jadwal Shift oleh Manager/Owner
    // Cari shift lain, misal Shift Lembur
    const shiftLemburRes = await db.query(`SELECT id, name FROM shifts WHERE name ILIKE '%lembur%' LIMIT 1`);
    const shiftLemburId = shiftLemburRes.rows[0].id;

    const adjRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/adjustments',
      method: 'POST',
      headers: authHeaders
    }, {
      session_id: monRecord1.session_id,
      employee_id: createdEmpId,
      new_shift_id: shiftLemburId,
      new_status: 'present',
      reason: 'Koreksi jadwal shift: Staf ditugaskan lembur operasional hari ini'
    });
    console.log(`4. Koreksi jadwal shift dieksekusi: Status ${adjRes.status}, Pesan: ${adjRes.data.message}`);
    if (adjRes.status !== 200 || !adjRes.data.success) throw new Error('Adjustment shift failed');

    // Periksa monitoring setelah koreksi
    const monRes2 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/monitoring',
      method: 'GET',
      headers: authHeaders
    });
    const monRecord2 = monRes2.data.records.find(r => r.employee_id === createdEmpId);
    console.log(`5. Monitoring setelah koreksi:`);
    console.log(`   - Shift Terkini: ${monRecord2?.shift_name}`);
    if (!monRecord2?.shift_name.toLowerCase().includes('lembur')) {
      throw new Error('Shift was not updated to Lembur in monitoring!');
    }
    console.log('   >>> FITUR 1: Koreksi Jadwal Shift di Monitoring BERHASIL 100%! <<<');

    // 6. TEST FITUR 2: Absen Pulang (Hanya Kamera dan GPS yang aktif)
    const checkOutRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/check-out',
      method: 'POST',
      headers: empAuthHeaders
    }, {
      // TIDAK ADA branch_id, shift_id, atau attendance_type (Hanya GPS & Kamera!)
      latitude: -6.2122736,
      longitude: 107.0218103,
      accuracy_m: 8,
      photo_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
      device_time: new Date().toISOString(),
      idempotency_key: `OUT-${testCode}-${Date.now()}`
    });
    console.log(`6. Absen Pulang (Hanya Kamera & GPS): Status ${checkOutRes.status}, Pesan: ${checkOutRes.data.message}`);
    if (checkOutRes.status !== 201 || !checkOutRes.data.success) {
      throw new Error('Check-out failed');
    }

    // Periksa monitoring setelah pulang
    const monRes3 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/monitoring',
      method: 'GET',
      headers: authHeaders
    });
    const monRecord3 = monRes3.data.records.find(r => r.employee_id === createdEmpId);
    console.log(`7. Monitoring setelah absen pulang:`);
    console.log(`   - Jam Masuk : ${monRecord3?.check_in_time}`);
    console.log(`   - Jam Pulang: ${monRecord3?.check_out_time}`);
    if (!monRecord3?.check_out_time) {
      throw new Error('Check-out time missing in monitoring!');
    }
    console.log('   >>> FITUR 2: Absen Pulang (Kamera & GPS) BERHASIL 100%! <<<');

    console.log('\n===============================================================');
    console.log(' KESIMPULAN: SELURUH PENGUJIAN SHIFT KOREKSI & PULANG LULUS 100%');
    console.log('===============================================================');
  } finally {
    // Cleanup
    if (createdEmpId) {
      await db.query(`DELETE FROM employees WHERE id = $1`, [createdEmpId]);
      console.log(`8. Cleanup test employee ${testCode} berhasil.`);
    }
    if (tokenHash) await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
    if (empTokenHash) await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [empTokenHash]);
  }
}

run().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
