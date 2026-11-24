const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const db = require('../apps/server/src/db');
const { getJakartaDateStr, resolveCutoffPeriod } = require('../apps/server/src/utils/recap');

function requestJson(options, bodyObj = null) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    if (body) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      };
    }
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (_) { parsed = raw; }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function run() {
  console.log('--- TEST FITUR LEMBUR PER JAM (1-4 JAM, 1x/HARI, TANPA KUNJUNGAN LUAR) ---');

  const staffRes = await db.query(`
    SELECT u.id as user_id, e.id as employee_id, ea.branch_id
    FROM users u
    JOIN employees e ON e.user_id = u.id
    LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
    WHERE e.active = true
    LIMIT 1;
  `);
  assert.ok(staffRes.rows.length > 0, 'Harus ada user yang terhubung ke employee');
  const { user_id: staffUserId, employee_id: empId, branch_id: branchId } = staffRes.rows[0];

  const ownerRes = await db.query(`
    SELECT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.code IN ('owner', 'manager') LIMIT 1;
  `);
  const ownerId = ownerRes.rows[0].id;

  const staffToken = 'test-ot-staff-' + Date.now();
  const ownerToken = 'test-ot-owner-' + Date.now();
  const staffHash = crypto.createHash('sha256').update(staffToken).digest('hex');
  const ownerHash = crypto.createHash('sha256').update(ownerToken).digest('hex');

  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour'), ($3, $4, NOW() + INTERVAL '1 hour');`,
    [staffUserId, staffHash, ownerId, ownerHash]
  );

  const staffHeaders = { Cookie: `sultan_token=${staffToken}` };
  const ownerHeaders = { Cookie: `sultan_token=${ownerToken}` };
  const todayStr = getJakartaDateStr();
  const shiftRes = await db.query(`SELECT id FROM shifts WHERE name NOT ILIKE '%lembur%' LIMIT 1`);
  const shiftId = shiftRes.rows[0].id;

  const existingToday = await db.query(
    `SELECT * FROM attendance_sessions WHERE employee_id = $1 AND work_date = $2`,
    [empId, todayStr]
  );
  let createdSessionId = null;

  try {
    // 1. Pastikan Shift Lembur tidak muncul lagi di GET /schedules/shifts
    const shiftsResp = await requestJson({
      hostname: '127.0.0.1', port: 3000, path: '/api/v1/schedules/shifts', method: 'GET', headers: staffHeaders
    });
    assert.strictEqual(shiftsResp.status, 200);
    const hasLemburShift = shiftsResp.data.shifts.some(s => /lembur/i.test(s.name));
    assert.strictEqual(hasLemburShift, false, 'Shift Lembur tidak boleh muncul di pilihan shift baru');

    // 2. Jika belum ada sesi hari ini, buat sesi kunjungan_luar -> harus ditolak lembur
    if (existingToday.rows.length === 0) {
      const noCheckIn = await requestJson({
        hostname: '127.0.0.1', port: 3000, path: '/api/v1/attendance/overtime', method: 'POST', headers: staffHeaders
      }, { hours: 1, note: 'Belum absen masuk' });
      assert.strictEqual(noCheckIn.status, 400);

      const ins = await db.query(
        `INSERT INTO attendance_sessions (employee_id, branch_id, work_date, shift_id, status, attendance_type, is_meal_allowance_eligible)
         VALUES ($1, $2, $3, $4, 'present', 'kunjungan_luar', false) RETURNING id;`,
        [empId, branchId, todayStr, shiftId]
      );
      createdSessionId = ins.rows[0].id;

      const kunjRes = await requestJson({
        hostname: '127.0.0.1', port: 3000, path: '/api/v1/attendance/overtime', method: 'POST', headers: staffHeaders
      }, { hours: 2, note: 'Coba lembur saat kunjungan luar' });
      assert.strictEqual(kunjRes.status, 400);

      // Ubah ke hadir toko agar bisa uji input lembur
      await db.query(`UPDATE attendance_sessions SET attendance_type = 'hadir', is_meal_allowance_eligible = true, overtime_hours = 0, overtime_pay = 0 WHERE id = $1`, [createdSessionId]);
    } else {
      await db.query(`UPDATE attendance_sessions SET attendance_type = 'hadir', overtime_hours = 0, overtime_pay = 0, overtime_note = NULL WHERE id = $1`, [existingToday.rows[0].id]);
    }

    // 3. Input lembur 3 jam -> Rp 50.000
    const ot3 = await requestJson({
      hostname: '127.0.0.1', port: 3000, path: '/api/v1/attendance/overtime', method: 'POST', headers: staffHeaders
    }, { hours: 3, note: 'Packing kiriman partai besar' });
    assert.strictEqual(ot3.status, 200, `Harusnya 200, dapat ${ot3.status}: ${JSON.stringify(ot3.data)}`);
    assert.strictEqual(ot3.data.overtime.overtime_hours, 3);
    assert.strictEqual(ot3.data.overtime.overtime_pay, 50000);

    // 4. Input kedua di hari yang sama -> harus ditolak 400
    const otDup = await requestJson({
      hostname: '127.0.0.1', port: 3000, path: '/api/v1/attendance/overtime', method: 'POST', headers: staffHeaders
    }, { hours: 1, note: 'Coba input kedua kali' });
    assert.strictEqual(otDup.status, 400);

    // 5. Pengelola koreksi ke 4 jam -> Rp 65.000 & cek di monthly-recap + PDF
    const targetSessId = createdSessionId || existingToday.rows[0].id;
    const adj4 = await requestJson({
      hostname: '127.0.0.1', port: 3000, path: '/api/v1/attendance/adjustments', method: 'POST', headers: ownerHeaders
    }, {
      session_id: targetSessId,
      new_overtime_hours: 4,
      new_overtime_note: 'Tambahan menjadi 4 jam penuh',
      reason: 'Koreksi jam lembur oleh owner'
    });
    assert.strictEqual(adj4.status, 200);

    const period = resolveCutoffPeriod();
    const recapResp = await requestJson({
      hostname: '127.0.0.1', port: 3000, path: `/api/v1/attendance/monthly-recap?year=${period.year}&month=${period.month}`, method: 'GET', headers: ownerHeaders
    });
    assert.strictEqual(recapResp.status, 200);
    const empRec = recapResp.data.recap.find(r => r.employee_id === empId);
    const dayRec = empRec.daily_records.find(d => d.work_date === todayStr);
    assert.strictEqual(dayRec.overtime_hours, 4);
    assert.strictEqual(dayRec.overtime_pay, 65000);
    assert.ok(empRec.total_overtime_pay >= 65000);

    console.log('>>> TEST FITUR LEMBUR PER JAM BERHASIL 100% <<<');
  } finally {
    if (createdSessionId) {
      await db.query('DELETE FROM attendance_adjustments WHERE session_id = $1', [createdSessionId]);
      await db.query('DELETE FROM attendance_sessions WHERE id = $1', [createdSessionId]);
    } else if (existingToday.rows.length > 0) {
      const orig = existingToday.rows[0];
      await db.query(
        `UPDATE attendance_sessions SET attendance_type = $1, overtime_hours = $2, overtime_pay = $3, overtime_note = $4 WHERE id = $5`,
        [orig.attendance_type, orig.overtime_hours || 0, orig.overtime_pay || 0, orig.overtime_note || null, orig.id]
      );
    }
    await db.query('DELETE FROM sessions WHERE token_hash IN ($1, $2)', [staffHash, ownerHash]);
    await db.pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
