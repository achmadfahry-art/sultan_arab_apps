const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const db = require('../apps/server/src/db');
const { resolveCutoffPeriod } = require('../apps/server/src/utils/recap');

function requestRaw(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        buffer: Buffer.concat(chunks)
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('--- TEST CUT-OFF 27..26, TANGGAL RINCIAN, ANALISA & PDF REKAP ---');

  // 1. Unit check resolveCutoffPeriod
  const novPeriod = resolveCutoffPeriod(2026, 11);
  assert.strictEqual(novPeriod.startDate, '2026-10-27');
  assert.strictEqual(novPeriod.endDate, '2026-11-26');
  const janPeriod = resolveCutoffPeriod(2026, 1);
  assert.strictEqual(janPeriod.startDate, '2025-12-27');
  assert.strictEqual(janPeriod.endDate, '2026-01-26');

  // 2. Cek nama cabang Kantor Pusat hasil migrasi 009
  const brRes = await db.query(`SELECT name FROM branches WHERE code = 'HQ-BKS'`);
  assert.strictEqual(brRes.rows[0]?.name, 'Kantor Pusat', 'Nama cabang HQ-BKS harus Kantor Pusat');

  // 3. Siapkan token owner + data sesi uji di tanggal 27 Okt & 26 Nov
  const ownerRes = await db.query(`
    SELECT u.id FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.code IN ('owner', 'manager') LIMIT 1;
  `);
  const ownerId = ownerRes.rows[0].id;
  const token = 'test-recap-pdf-' + Date.now();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour');`,
    [ownerId, tokenHash]
  );

  const empRes = await db.query(`SELECT id FROM employees WHERE active = true LIMIT 1`);
  const empId = empRes.rows[0]?.id;
  const branchRes = await db.query(`SELECT id FROM branches WHERE code = 'HQ-BKS' LIMIT 1`);
  const branchId = branchRes.rows[0]?.id;
  const shiftRes = await db.query(`SELECT id FROM shifts LIMIT 1`);
  const shiftId = shiftRes.rows[0]?.id;

  let testSess1 = null;
  let testSess2 = null;
  try {
    if (empId && branchId && shiftId) {
      const ex1 = await db.query(
        `SELECT id FROM attendance_sessions WHERE employee_id = $1 AND work_date = '2026-10-27' LIMIT 1`,
        [empId]
      );
      if (ex1.rows.length === 0) {
        const s1 = await db.query(
          `INSERT INTO attendance_sessions (employee_id, branch_id, shift_id, work_date, status, attendance_type, is_meal_allowance_eligible)
           VALUES ($1, $2, $3, '2026-10-27', 'present', 'hadir', true) RETURNING id;`,
          [empId, branchId, shiftId]
        );
        testSess1 = s1.rows[0]?.id || null;
      }

      const ex2 = await db.query(
        `SELECT id FROM attendance_sessions WHERE employee_id = $1 AND work_date = '2026-11-26' LIMIT 1`,
        [empId]
      );
      if (ex2.rows.length === 0) {
        const s2 = await db.query(
          `INSERT INTO attendance_sessions (employee_id, branch_id, shift_id, work_date, status, attendance_type, is_meal_allowance_eligible)
           VALUES ($1, $2, $3, '2026-11-26', 'late', 'hadir', true) RETURNING id;`,
          [empId, branchId, shiftId]
        );
        testSess2 = s2.rows[0]?.id || null;
      }
    }

    const headers = { Cookie: `sultan_token=${token}` };
    const jsonResp = await requestRaw({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/monthly-recap?year=2026&month=11',
      method: 'GET',
      headers
    });
    assert.strictEqual(jsonResp.status, 200);
    const data = JSON.parse(jsonResp.buffer.toString('utf8'));
    assert.strictEqual(data.period.startDate, '2026-10-27');
    assert.strictEqual(data.period.endDate, '2026-11-26');
    assert.ok(data.analytics && Array.isArray(data.analytics.insights) && data.analytics.insights.length > 0);
    assert.ok(typeof data.analytics.on_time_rate_pct === 'number');

    const empRec = data.recap.find(r => r.employee_id === empId);
    assert.ok(empRec && empRec.daily_records.length > 0, 'Karyawan uji harus memiliki rincian harian');
    assert.ok(empRec.daily_records[0].work_date && empRec.daily_records[0].date_formatted, 'Setiap rincian wajib memiliki tanggal');
    assert.ok(typeof empRec.analysis_note === 'string' && empRec.analysis_note.length > 0);

    const pdfResp = await requestRaw({
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/attendance/monthly-recap/pdf?year=2026&month=11',
      method: 'GET',
      headers
    });
    assert.strictEqual(pdfResp.status, 200);
    assert.ok((pdfResp.headers['content-type'] || '').includes('application/pdf'));
    const pdfStr = pdfResp.buffer.toString('latin1');
    assert.ok(pdfStr.startsWith('%PDF-1.4'), 'PDF harus dimulai dengan header %PDF-1.4');
    assert.ok(pdfStr.includes('%%EOF'), 'PDF harus diakhiri dengan %%EOF');
    assert.ok(pdfStr.includes('27 Okt 2026 - 26 Nov 2026'), 'PDF harus memuat rentang cut-off 27..26');
    console.log(`PDF size: ${pdfResp.buffer.length} bytes — VALID!`);
    console.log('>>> TEST REKAP CUT-OFF, TANGGAL RINCIAN, ANALISA & PDF BERHASIL 100% <<<');
  } finally {
    if (testSess1) await db.query('DELETE FROM attendance_sessions WHERE id = $1', [testSess1]);
    if (testSess2) await db.query('DELETE FROM attendance_sessions WHERE id = $1', [testSess2]);
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
    await db.pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
