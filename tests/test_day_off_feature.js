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
  console.log('--- TEST FITUR HARI LIBUR & DATABASE ---');

  // Bersihkan test artifact sebelumnya
  await db.query(`DELETE FROM employees WHERE employee_code LIKE 'TEST-LIBUR-%'`);

  // Buat sesi test manager/owner
  const ownerRes = await db.query(`
    SELECT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.code IN ('owner', 'manager') LIMIT 1;
  `);
  const ownerId = ownerRes.rows[0].id;
  const token = 'test-token-dayoff-' + Date.now();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour');`,
    [ownerId, tokenHash]
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `sultan_token=${token}`
  };

  const testCode = 'TEST-LIBUR-' + Date.now().toString(36).toUpperCase();
  let createdId = null;

  try {
    // 1. Get Employees
    const empRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/employees',
      method: 'GET',
      headers: authHeaders
    });
    console.log(`1. GET /api/v1/employees -> status ${empRes.status}, count: ${empRes.data.employees?.length}`);
    const sampleEmp = empRes.data.employees.find(e => e.day_off);
    console.log(`   Sample Emp: ${sampleEmp?.name}, Code: ${sampleEmp?.employee_code}, Libur: ${sampleEmp?.day_off}`);
    if (!sampleEmp?.day_off) throw new Error('day_off field missing in employee response!');

    // 2. Create New Employee with day_off
    const postRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/employees',
      method: 'POST',
      headers: authHeaders
    }, {
      employee_code: testCode,
      name: 'Test Karyawan Libur',
      phone: '081299998888',
      job_title: 'Tester',
      day_off: 'Kamis',
      is_test_data: true
    });
    console.log(`2. POST /api/v1/employees (with day_off: Kamis) -> status ${postRes.status}, id: ${postRes.data.employee?.id}`);
    createdId = postRes.data.employee.id;
    if (postRes.data.employee.day_off !== 'Kamis') throw new Error('Created employee does not have day_off: Kamis');

    // 3. Update day_off via PATCH
    const patchRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1/employees/${createdId}/day-off`,
      method: 'PATCH',
      headers: authHeaders
    }, {
      day_off: 'Jumat'
    });
    console.log(`3. PATCH /api/v1/employees/${createdId}/day-off -> status ${patchRes.status}, updated: ${patchRes.data.employee?.day_off}`);
    if (patchRes.data.employee?.day_off !== 'Jumat') throw new Error('Updated employee does not have day_off: Jumat');

    // 4. Test Monthly Recap API
    const recapRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/monthly-recap?month=2026-10',
      method: 'GET',
      headers: authHeaders
    });
    console.log(`4. GET /api/v1/attendance/monthly-recap -> status ${recapRes.status}`);
    const summary = recapRes.data.summary;
    console.log(`   Recap Summary Grand Libur: ${summary.grandLibur}`);
    const recapItem = recapRes.data.recap.find(r => r.employee_id === createdId);
    console.log(`   Test Emp Libur di Bulan Okt 2026: ${recapItem?.totalLibur} hari (Libur Rutin: ${recapItem?.day_off})`);
    if (typeof recapItem?.totalLibur !== 'number' || recapItem?.totalLibur <= 0) {
      throw new Error('totalLibur is not calculated properly in recap!');
    }

    console.log('\n>>> SEMUA UJI HARI LIBUR & DATABASE BERHASIL 100% <<<');
  } finally {
    if (createdId) {
      await db.query('DELETE FROM employees WHERE id = $1', [createdId]);
      console.log(`5. Cleanup test employee ${testCode} berhasil.`);
    }
    await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);
  }
}

run().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
