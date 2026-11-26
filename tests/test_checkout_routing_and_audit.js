const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const vm = require('vm');
const db = require('../apps/server/src/db');

const PORT = process.env.PORT || 3000;

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

function testFrontendRoutingAndAuditMarkup() {
  const appJsPath = path.resolve(__dirname, '../apps/web/app.js');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  // Extract parseHashRoute function and execute in isolated VM
  const match = appJs.match(/function parseHashRoute\([\s\S]*?\n\}/);
  assert(match, 'parseHashRoute harus didefinisikan di apps/web/app.js');

  const sandbox = { URLSearchParams, window: { location: { hash: '' } } };
  vm.runInNewContext(match[0], sandbox);
  const parseHashRoute = sandbox.parseHashRoute;

  const rOut = parseHashRoute('#attendance?mode=out');
  assert.strictEqual(rOut.route, '#attendance');
  assert.strictEqual(rOut.params.get('mode'), 'out');

  const rIn = parseHashRoute('#attendance?mode=in');
  assert.strictEqual(rIn.route, '#attendance');
  assert.strictEqual(rIn.params.get('mode'), 'in');

  const rPlain = parseHashRoute('#attendance');
  assert.strictEqual(rPlain.route, '#attendance');
  assert.strictEqual(rPlain.params.get('mode'), null);

  const rUpload = parseHashRoute('#upload-slip');
  assert.strictEqual(rUpload.route, '#management');
  assert.strictEqual(rUpload.isUploadSlip, true);

  // Verify both Absen Pulang paths target #attendance?mode=out and renderAttendance uses parseHashRoute
  assert(appJs.includes('href="#attendance?mode=out"'), 'Tautan Absen Pulang harus mengarah ke #attendance?mode=out');
  assert(appJs.includes("parseHashRoute(window.location.hash).params.get('mode') === 'out'"), 'renderAttendance harus membaca mode dari parseHashRoute');

  // Verify contrast fix for clock-in note
  assert(appJs.includes('class="clockin-recorded-note"') && appJs.includes('color: #065F46'), 'Catatan jam masuk harus memakai teks gelap kontras tinggi');

  // Verify accessibility & history filter markers
  assert(appJs.includes('aria-current="page"'), 'Menu aktif harus ditandai aria-current="page"');
  assert(appJs.includes('<a href="#attendance" class="quick-card">'), 'Pintasan Beranda harus berupa elemen tautan <a>');
  assert(appJs.includes('min-width: 36px; min-height: 36px;'), 'Tombol tampilkan kata sandi harus >= 24x24px');
  assert(appJs.includes('id="history-period-filter"') && appJs.includes('id="history-date-filter"'), 'Riwayat Absensi harus memiliki filter periode & tanggal');
  assert(appJs.includes('Catatan Uji / Tes') && appJs.includes('Resmi • Berlaku'), 'Slip gaji harus membedakan status resmi dan catatan tes');

  console.log('1. Verifikasi parseHashRoute, jalur Absen Pulang, kontras, aksesibilitas, dan filter Riwayat: LULUS');
}

async function testCheckoutFlowAndOptionalRule() {
  const ownerRes = await db.query(`
    SELECT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.code IN ('owner', 'manager') LIMIT 1;
  `);
  const ownerId = ownerRes.rows[0].id;
  const ownerToken = 'test-token-audit-owner-' + Date.now();
  const ownerTokenHash = crypto.createHash('sha256').update(ownerToken).digest('hex');
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour');`,
    [ownerId, ownerTokenHash]
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `sultan_token=${ownerToken}`
  };

  const testCode = 'TEST-AUDIT-' + Date.now().toString(36).toUpperCase();
  let createdEmpId = null;
  let empUserId = null;
  let empTokenHash = null;

  try {
    const empRes = await request({
      hostname: 'localhost', port: PORT, path: '/api/v1/employees', method: 'POST', headers: authHeaders
    }, {
      employee_code: testCode,
      name: 'Staf Uji Regresi Pulang',
      phone: '081299990001',
      job_title: 'Crew Uji',
      day_off: 'Ahad',
      is_test_data: true
    });
    assert.strictEqual(empRes.status, 201, 'Gagal membuat karyawan uji');
    createdEmpId = empRes.data.employee.id;

    const uRes = await db.query(`SELECT user_id FROM employees WHERE id = $1`, [createdEmpId]);
    empUserId = uRes.rows[0].user_id;

    const empToken = 'test-token-audit-emp-' + Date.now();
    empTokenHash = crypto.createHash('sha256').update(empToken).digest('hex');
    await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour');`,
      [empUserId, empTokenHash]
    );
    const empHeaders = {
      'Content-Type': 'application/json',
      'Cookie': `sultan_token=${empToken}`
    };

    const shiftRes = await db.query(`SELECT id FROM shifts WHERE name ILIKE '%pagi%' LIMIT 1`);
    const branchRes = await db.query(`SELECT id FROM branches LIMIT 1`);
    const shiftId = shiftRes.rows[0].id;
    const branchId = branchRes.rows[0].id;

    // Clock in
    const inRes = await request({
      hostname: 'localhost', port: PORT, path: '/api/v1/attendance/check-in', method: 'POST', headers: empHeaders
    }, {
      branch_id: branchId,
      shift_id: shiftId,
      attendance_type: 'kunjungan_luar',
      latitude: -6.2122736,
      longitude: 107.0218103,
      accuracy_m: 10,
      photo_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      device_time: new Date().toISOString(),
      idempotency_key: `IN-${testCode}-${Date.now()}`
    });
    assert.strictEqual(inRes.status, 201, `Absen masuk uji harus berhasil: ${JSON.stringify(inRes.data)}`);

    // Verify todaySession shows check_in and no check_out
    const meAtt = await request({
      hostname: 'localhost', port: PORT, path: '/api/v1/attendance/me', method: 'GET', headers: empHeaders
    });
    assert.strictEqual(meAtt.status, 200);
    const events = meAtt.data.todaySession?.events || [];
    assert(events.some(e => e.event_type === 'check_in'), 'Harus ada event check_in');
    assert(!events.some(e => e.event_type === 'check_out'), 'Belum boleh ada check_out sebelum aksi eksplisit');

    // Explicit clock-out
    const outRes = await request({
      hostname: 'localhost', port: PORT, path: '/api/v1/attendance/check-out', method: 'POST', headers: empHeaders
    }, {
      branch_id: branchId,
      attendance_type: 'kunjungan_luar',
      latitude: -6.2122736,
      longitude: 107.0218103,
      accuracy_m: 10,
      photo_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      device_time: new Date().toISOString(),
      idempotency_key: `OUT-${testCode}-${Date.now()}`
    });
    assert.strictEqual(outRes.status, 201, `Absen pulang eksplisit harus berhasil: ${JSON.stringify(outRes.data)}`);
    console.log('2. Verifikasi API alur absen masuk -> belum pulang -> absen pulang eksplisit: LULUS');
  } finally {
    if (createdEmpId) {
      await db.query(`DELETE FROM attendance_events WHERE session_id IN (SELECT id FROM attendance_sessions WHERE employee_id = $1)`, [createdEmpId]);
      await db.query(`DELETE FROM attendance_sessions WHERE employee_id = $1`, [createdEmpId]);
      await db.query(`DELETE FROM employees WHERE id = $1`, [createdEmpId]);
    }
    if (empUserId) {
      await db.query(`DELETE FROM sessions WHERE user_id = $1`, [empUserId]);
      await db.query(`DELETE FROM user_roles WHERE user_id = $1`, [empUserId]);
      await db.query(`DELETE FROM users WHERE id = $1`, [empUserId]);
    }
    await db.query(`DELETE FROM sessions WHERE token_hash = $1`, [ownerTokenHash]);
  }
}

async function run() {
  console.log('=== TEST REGRESI TEMUAN AUDIT & ALUR ABSEN PULANG ===');
  testFrontendRoutingAndAuditMarkup();
  await testCheckoutFlowAndOptionalRule();
  console.log('>>> TEST REGRESI SELESAI: 100% LULUS <<<');
  process.exit(0);
}

run().catch(err => {
  console.error('[GAGAL]', err);
  process.exit(1);
});
