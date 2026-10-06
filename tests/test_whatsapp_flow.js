const http = require('http');
const db = require('../apps/server/src/db');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runTest() {
  console.log('=== TEST EMPLOYEE WHATSAPP & SLIP NOTIFICATION ===');

  // 1. Login as owner (fauzi / password sultan123 or from DB)
  // Let's get an owner session token directly
  const ownerRes = await db.query(`
    SELECT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.code = 'owner' LIMIT 1;
  `);
  const ownerId = ownerRes.rows[0].id;
  
  const token = 'test-token-owner-' + Date.now();
  const crypto = require('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour');`,
    [ownerId, tokenHash]
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `sultan_token=${token}`
  };

  // 2. Test create employee with phone
  const testEmpCode = 'TEST-EMP-' + Math.floor(Math.random() * 10000);
  const testPhone = '089876543210';
  const postRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/employees',
    method: 'POST',
    headers: authHeaders
  }, JSON.stringify({
    employee_code: testEmpCode,
    name: 'Karyawan Uji WA',
    phone: testPhone,
    job_title: 'Crew Toko Uji',
    is_test_data: true
  }));

  console.log('1. POST /api/v1/employees status:', postRes.status);
  if (postRes.status !== 201 || !postRes.data.success) {
    throw new Error('Failed to create employee: ' + JSON.stringify(postRes.data));
  }
  const createdEmpId = postRes.data.employee.id;
  console.log('   Employee created with phone:', postRes.data.employee.phone);

  // 3. Test GET /api/v1/employees
  const getEmpRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/employees',
    method: 'GET',
    headers: authHeaders
  });
  const foundInEmp = getEmpRes.data.employees.find(e => e.id === createdEmpId);
  console.log('2. GET /api/v1/employees phone:', foundInEmp ? foundInEmp.phone : 'NOT FOUND');
  if (!foundInEmp || foundInEmp.phone !== testPhone) {
    throw new Error('Phone mismatch in GET /api/v1/employees');
  }

  // 4. Test GET /api/v1/payroll/staff-slips
  const slipsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/payroll/staff-slips',
    method: 'GET',
    headers: authHeaders
  });
  const foundInSlips = slipsRes.data.staff.find(s => s.employee_id === createdEmpId);
  console.log('3. GET /api/v1/payroll/staff-slips for new employee:');
  console.log('   Phone in slips:', foundInSlips ? foundInSlips.phone : 'NOT FOUND');
  console.log('   WhatsApp link:', foundInSlips ? foundInSlips.whatsAppReminderLink : 'NOT FOUND');
  if (!foundInSlips || !foundInSlips.whatsAppReminderLink || !foundInSlips.whatsAppReminderLink.includes('6289876543210')) {
    throw new Error('WhatsApp link missing or invalid in staff-slips');
  }

  // 5. Test PATCH /api/v1/employees/:id/phone
  const updatedPhone = '081233334444';
  const patchRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/v1/employees/${createdEmpId}/phone`,
    method: 'PATCH',
    headers: authHeaders
  }, JSON.stringify({ phone: updatedPhone }));

  console.log('4. PATCH /api/v1/employees/:id/phone status:', patchRes.status);
  if (patchRes.status !== 200 || !patchRes.data.success) {
    throw new Error('Failed to patch phone: ' + JSON.stringify(patchRes.data));
  }

  // 6. Verify updated phone in staff-slips
  const slipsRes2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/v1/payroll/staff-slips',
    method: 'GET',
    headers: authHeaders
  });
  const foundInSlips2 = slipsRes2.data.staff.find(s => s.employee_id === createdEmpId);
  console.log('5. GET /api/v1/payroll/staff-slips after phone update:');
  console.log('   Updated Phone:', foundInSlips2.phone);
  console.log('   Updated WA link:', foundInSlips2.whatsAppReminderLink);
  if (!foundInSlips2.whatsAppReminderLink.includes('6281233334444')) {
    throw new Error('Updated WA link does not reflect new phone');
  }

  // Cleanup
  await db.query(`DELETE FROM employees WHERE id = $1`, [createdEmpId]);
  await db.query(`DELETE FROM users WHERE id = $1`, [postRes.data.employee.user_id]);
  await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [tokenHash]);

  console.log('\n>>> SEMUA TES WHATSAPP & SLIP NOTIFIKASI BERHASIL 100%! <<<\n');
  process.exit(0);
}

runTest().catch(e => {
  console.error('TEST FAILED:', e);
  process.exit(1);
});
