const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const db = require('../apps/server/src/db');
const { resolveCutoffPeriod } = require('../apps/server/src/utils/recap');

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
  console.log('--- TEST KOREKSI ABSEN REKAP BULANAN (CUT-OFF 27..26, TIPE, STATUS, SHIFT) ---');

  const actorRes = await db.query(`
    SELECT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.code IN ('manager', 'owner')
    ORDER BY CASE WHEN r.code = 'manager' THEN 0 ELSE 1 END
    LIMIT 1;
  `);
  assert.ok(actorRes.rows.length > 0, 'Harus ada minimal 1 user owner/manager');
  const actorId = actorRes.rows[0].id;

  const token = 'test-recap-adj-' + Date.now();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour');`,
    [actorId, tokenHash]
  );

  const empRes = await db.query(`SELECT id FROM employees WHERE active = true LIMIT 1`);
  const empId = empRes.rows[0].id;
  const shiftsRes = await db.query(`SELECT id FROM shifts LIMIT 2`);
  const shift1 = shiftsRes.rows[0].id;
  const shift2 = (shiftsRes.rows[1] || shiftsRes.rows[0]).id;

  const period = resolveCutoffPeriod();
  const testDate = period.startDate;
  const prevSess = await db.query(
    `SELECT * FROM attendance_sessions WHERE employee_id = $1 AND work_date = $2`,
    [empId, testDate]
  );
  const hadPrevSess = prevSess.rows.length > 0;
  let createdSessionId = null;

  const headers = { Cookie: `sultan_token=${token}` };

  try {
    // 1. Koreksi / input tanggal di hari awal cut-off berjalan (kunjungan_luar + late)
    const res1 = await requestJson({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/adjustments',
      method: 'POST',
      headers
    }, {
      session_id: hadPrevSess ? prevSess.rows[0].id : null,
      employee_id: empId,
      work_date: testDate,
      new_shift_id: shift1,
      new_status: 'late',
      new_attendance_type: 'kunjungan_luar',
      reason: 'Uji koreksi kunjungan luar di cut-off berjalan'
    });
    assert.strictEqual(res1.status, 200, `Harusnya 200, dapat ${res1.status}: ${JSON.stringify(res1.data)}`);

    const after1 = await db.query(
      `SELECT * FROM attendance_sessions WHERE employee_id = $1 AND work_date = $2`,
      [empId, testDate]
    );
    assert.strictEqual(after1.rows.length, 1);
    if (!hadPrevSess) createdSessionId = after1.rows[0].id;
    assert.strictEqual(after1.rows[0].attendance_type, 'kunjungan_luar');
    assert.strictEqual(after1.rows[0].status, 'late');
    assert.strictEqual(after1.rows[0].is_meal_allowance_eligible, false);

    // 2. Cek refleksi langsung di GET /monthly-recap
    const recap1 = await requestJson({
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1/attendance/monthly-recap?year=${period.year}&month=${period.month}`,
      method: 'GET',
      headers
    });
    assert.strictEqual(recap1.status, 200);
    const empRec1 = recap1.data.recap.find(r => r.employee_id === empId);
    const dayRec1 = empRec1.daily_records.find(d => d.work_date === testDate);
    assert.ok(dayRec1, 'Catatan tanggal koreksi harus muncul di monthly-recap');
    assert.strictEqual(dayRec1.attendance_type, 'kunjungan_luar');
    assert.strictEqual(dayRec1.status, 'late');
    assert.strictEqual(dayRec1.shift_id, shift1);
    assert.strictEqual(dayRec1.uang_makan, 0);

    // 3. Edit ulang ke hadir + present + shift2
    const res2 = await requestJson({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/adjustments',
      method: 'POST',
      headers
    }, {
      session_id: after1.rows[0].id,
      new_shift_id: shift2,
      new_status: 'present',
      new_attendance_type: 'hadir',
      reason: 'Uji ubah kembali ke hadir toko tepat waktu'
    });
    assert.strictEqual(res2.status, 200);

    const recap2 = await requestJson({
      hostname: 'localhost',
      port: 3000,
      path: `/api/v1/attendance/monthly-recap?year=${period.year}&month=${period.month}`,
      method: 'GET',
      headers
    });
    const empRec2 = recap2.data.recap.find(r => r.employee_id === empId);
    const dayRec2 = empRec2.daily_records.find(d => d.work_date === testDate);
    assert.strictEqual(dayRec2.attendance_type, 'hadir');
    assert.strictEqual(dayRec2.status, 'present');
    assert.strictEqual(dayRec2.shift_id, shift2);
    assert.strictEqual(dayRec2.uang_makan, 10000);

    // 4. Tolak tanggal di luar periode cut-off berjalan
    const outOfRange = await requestJson({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/adjustments',
      method: 'POST',
      headers
    }, {
      employee_id: empId,
      work_date: '2025-01-10',
      new_shift_id: shift1,
      new_status: 'present',
      new_attendance_type: 'hadir',
      reason: 'Harus ditolak karena di luar cut-off berjalan'
    });
    assert.strictEqual(outOfRange.status, 400);

    // 5. Tolak tanggal masa depan
    const tomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const futureRes = await requestJson({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/adjustments',
      method: 'POST',
      headers
    }, {
      employee_id: empId,
      work_date: tomorrow,
      new_shift_id: shift1,
      new_status: 'present',
      new_attendance_type: 'hadir',
      reason: 'Harus ditolak karena tanggal masa depan'
    });
    assert.strictEqual(futureRes.status, 400);

    console.log('>>> TEST KOREKSI REKAP CUT-OFF 27..26 BERHASIL 100% <<<');
  } finally {
    if (createdSessionId) {
      await db.query('DELETE FROM attendance_adjustments WHERE session_id = $1', [createdSessionId]);
      await db.query('DELETE FROM attendance_sessions WHERE id = $1', [createdSessionId]);
      await db.query('DELETE FROM work_schedules WHERE employee_id = $1 AND work_date = $2', [empId, testDate]);
    } else if (hadPrevSess) {
      const orig = prevSess.rows[0];
      await db.query(
        `UPDATE attendance_sessions SET shift_id = $1, status = $2, attendance_type = $3, is_meal_allowance_eligible = $4 WHERE id = $5`,
        [orig.shift_id, orig.status, orig.attendance_type, orig.is_meal_allowance_eligible, orig.id]
      );
    }
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    await db.pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
