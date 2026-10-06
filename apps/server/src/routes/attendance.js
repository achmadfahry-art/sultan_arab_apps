const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { calculateDistanceMeters } = require('../utils/geo');
const { logAudit } = require('../utils/audit');

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.resolve(__dirname, '../../../storage');
const PHOTOS_DIR = path.join(UPLOAD_ROOT, 'attendance-photos');

// Helper to save base64 image securely
function saveBase64Photo(base64Data, employeeId, workDate, eventId) {
  if (!base64Data) return null;
  try {
    const cleanData = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanData, 'base64');
    
    const targetDir = path.join(PHOTOS_DIR, String(employeeId), String(workDate));
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const relativePath = path.join('attendance-photos', String(employeeId), String(workDate), `${eventId}.jpg`);
    const fullPath = path.join(UPLOAD_ROOT, relativePath);
    fs.writeFileSync(fullPath, buffer);
    return relativePath.replace(/\\/g, '/');
  } catch (err) {
    console.error('[Save Photo Error]', err.message);
    return null;
  }
}

// POST /api/v1/attendance/check-in
router.post('/check-in', requireAuth, async (req, res) => {
  const {
    branch_id,
    shift_id,
    attendance_type, // 'hadir' atau 'kunjungan_luar' (Q05)
    latitude,
    longitude,
    accuracy_m,
    photo_base64,
    device_time,
    notes,
    idempotency_key
  } = req.body;

  if (!idempotency_key) {
    return res.status(400).json({ success: false, error: 'Idempotency key wajib disertakan.' });
  }

  // Idempotency check: jika key sudah terdaftar, kembalikan data yang ada
  const existingEvent = await db.query(
    `SELECT e.*, s.work_date, s.status as session_status, s.attendance_type, s.is_meal_allowance_eligible
     FROM attendance_events e
     JOIN attendance_sessions s ON e.session_id = s.id
     WHERE e.idempotency_key = $1`,
    [idempotency_key]
  );
  if (existingEvent.rows.length > 0) {
    return res.json({
      success: true,
      message: 'Permintaan absen sudah tercatat sebelumnya (idempotent).',
      event: existingEvent.rows[0],
      isDuplicate: true
    });
  }

  let employeeId = req.user.employeeId;
  if (!employeeId) {
    const empLookup = await db.query(`SELECT id FROM employees WHERE user_id = $1 LIMIT 1`, [req.user.id]);
    if (empLookup.rows.length > 0) {
      employeeId = empLookup.rows[0].id;
    } else {
      return res.status(403).json({ success: false, error: 'Akun Anda tidak terhubung dengan data karyawan.' });
    }
  }

  // Validasi Cabang
  let targetBranchId = branch_id || req.user.assignedBranchId;
  if (!targetBranchId) {
    const defaultBranch = await db.query(`SELECT id FROM branches WHERE active = true ORDER BY is_test_data ASC LIMIT 1`);
    if (defaultBranch.rows.length > 0) targetBranchId = defaultBranch.rows[0].id;
  }

  const branchRes = await db.query(`SELECT * FROM branches WHERE id = $1`, [targetBranchId]);
  const branch = branchRes.rows[0] || {};

  // Tipe Absensi (Q05): 'kunjungan_luar' vs 'hadir'
  const isKunjunganLuar = attendance_type === 'kunjungan_luar';
  const isMealEligible = !isKunjunganLuar; // Kunjungan Luar TIDAK dapat uang makan

  // Hitung Jarak GPS
  let distanceM = null;
  let isWithinRadius = false;
  if (isKunjunganLuar) {
    isWithinRadius = true; // Kunjungan luar bebas geofence toko
  } else if (latitude && longitude && branch.latitude && branch.longitude) {
    distanceM = calculateDistanceMeters(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(branch.latitude),
      parseFloat(branch.longitude)
    );
    isWithinRadius = distanceM !== null && distanceM <= (branch.radius_m || 150);
  }

  // Cek Shift & Toleransi Terlambat 15 Menit (Q02)
  let initialStatus = 'present';
  let chosenShiftId = shift_id || null;
  if (chosenShiftId) {
    const shiftRes = await db.query(`SELECT * FROM shifts WHERE id = $1`, [chosenShiftId]);
    if (shiftRes.rows.length > 0) {
      const shift = shiftRes.rows[0];
      const now = new Date();
      const [sh, sm] = shift.start_time.split(':').map(Number);
      const shiftStartMinutes = sh * 60 + sm;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Toleransi 15 menit
      if (currentMinutes > shiftStartMinutes + 15) {
        initialStatus = 'late'; // Terlambat
      }
    }
  }

  const eventId = uuidv4();
  const workDate = new Date().toISOString().split('T')[0];
  const photoPath = saveBase64Photo(photo_base64, employeeId, workDate, eventId);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Cek atau buat attendance_session untuk hari ini
    let sessionRes = await client.query(
      `SELECT id, status FROM attendance_sessions WHERE employee_id = $1 AND work_date = $2`,
      [employeeId, workDate]
    );

    let sessionId;
    if (sessionRes.rows.length === 0) {
      const createSession = await client.query(
        `INSERT INTO attendance_sessions 
         (employee_id, branch_id, work_date, shift_id, status, attendance_type, is_meal_allowance_eligible, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id;`,
        [
          employeeId,
          targetBranchId,
          workDate,
          chosenShiftId,
          initialStatus,
          isKunjunganLuar ? 'kunjungan_luar' : 'hadir',
          isMealEligible,
          notes || (isKunjunganLuar ? 'Kunjungan Luar Toko/Kantor' : 'Absen Hadir Toko')
        ]
      );
      sessionId = createSession.rows[0].id;
    } else {
      sessionId = sessionRes.rows[0].id;
      await client.query(
        `UPDATE attendance_sessions 
         SET shift_id = COALESCE($1, shift_id), 
             status = $2, 
             attendance_type = $3, 
             is_meal_allowance_eligible = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [chosenShiftId, initialStatus, isKunjunganLuar ? 'kunjungan_luar' : 'hadir', isMealEligible, sessionId]
      );
    }

    // Insert attendance event
    const eventRes = await client.query(
      `INSERT INTO attendance_events 
       (id, session_id, event_type, attendance_type, device_time, latitude, longitude, accuracy_m, distance_m, is_within_radius, photo_path, idempotency_key)
       VALUES ($1, $2, 'check_in', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *;`,
      [
        eventId,
        sessionId,
        isKunjunganLuar ? 'kunjungan_luar' : 'hadir',
        device_time ? new Date(device_time) : new Date(),
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        accuracy_m ? parseFloat(accuracy_m) : null,
        distanceM,
        isWithinRadius,
        photoPath,
        idempotency_key
      ]
    );

    await client.query('COMMIT');

    const recordedEvent = eventRes.rows[0];
    await logAudit({
      actorId: req.user.id,
      action: isKunjunganLuar ? 'CHECK_IN_KUNJUNGAN_LUAR' : 'CHECK_IN',
      entityType: 'attendance_events',
      entityId: recordedEvent.id,
      changes: { isWithinRadius, distanceM, isKunjunganLuar, isMealEligible, branchName: branch.name },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: isKunjunganLuar
        ? 'Absen Kunjungan Luar berhasil dicatat (Tidak mendapat uang makan).'
        : (initialStatus === 'late'
            ? 'Absen masuk berhasil dicatat (Status: Terlambat > 15 menit).'
            : 'Absen masuk berhasil dicatat oleh server! Uang makan Rp10.000 aktif.'),
      event: recordedEvent,
      branch: {
        id: branch.id,
        name: branch.name,
        radius_m: branch.radius_m
      },
      status: initialStatus,
      isKunjunganLuar,
      isMealAllowanceEligible: isMealEligible,
      locationValidation: {
        distanceMeters: distanceM,
        radiusMeters: branch.radius_m || 150,
        isWithinRadius
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Check-In Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mencatat absen masuk: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/v1/attendance/check-out (Opsional / Tidak Wajib sesuai Q02)
router.post('/check-out', requireAuth, async (req, res) => {
  const {
    branch_id,
    latitude,
    longitude,
    accuracy_m,
    photo_base64,
    device_time,
    idempotency_key
  } = req.body;

  if (!idempotency_key) {
    return res.status(400).json({ success: false, error: 'Idempotency key wajib disertakan.' });
  }

  // Idempotency check
  const existingEvent = await db.query(
    `SELECT * FROM attendance_events WHERE idempotency_key = $1`,
    [idempotency_key]
  );
  if (existingEvent.rows.length > 0) {
    return res.json({
      success: true,
      message: 'Permintaan absen pulang sudah tercatat sebelumnya (idempotent).',
      event: existingEvent.rows[0],
      isDuplicate: true
    });
  }

  let employeeId = req.user.employeeId;
  if (!employeeId) {
    const empLookup = await db.query(`SELECT id FROM employees WHERE user_id = $1 LIMIT 1`, [req.user.id]);
    if (empLookup.rows.length > 0) employeeId = empLookup.rows[0].id;
    else return res.status(403).json({ success: false, error: 'Akun tidak terhubung ke karyawan.' });
  }

  const workDate = new Date().toISOString().split('T')[0];
  const targetBranchId = branch_id || req.user.assignedBranchId;

  const sessionRes = await db.query(
    `SELECT id, status FROM attendance_sessions WHERE employee_id = $1 AND work_date = $2`,
    [employeeId, workDate]
  );

  let sessionId;
  if (sessionRes.rows.length === 0) {
    const createSession = await db.query(
      `INSERT INTO attendance_sessions (employee_id, branch_id, work_date, status)
       VALUES ($1, $2, $3, 'incomplete')
       RETURNING id;`,
      [employeeId, targetBranchId, workDate]
    );
    sessionId = createSession.rows[0].id;
  } else {
    sessionId = sessionRes.rows[0].id;
    await db.query(`UPDATE attendance_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [sessionId]);
  }

  const branchRes = await db.query(`SELECT * FROM branches WHERE id = $1`, [targetBranchId]);
  const branch = branchRes.rows[0] || {};
  let distanceM = null;
  let isWithinRadius = false;
  if (latitude && longitude && branch.latitude && branch.longitude) {
    distanceM = calculateDistanceMeters(
      parseFloat(latitude),
      parseFloat(longitude),
      parseFloat(branch.latitude),
      parseFloat(branch.longitude)
    );
    isWithinRadius = distanceM !== null && distanceM <= (branch.radius_m || 150);
  }

  const eventId = uuidv4();
  const photoPath = saveBase64Photo(photo_base64, employeeId, workDate, eventId);

  const eventRes = await db.query(
    `INSERT INTO attendance_events 
     (id, session_id, event_type, device_time, latitude, longitude, accuracy_m, distance_m, is_within_radius, photo_path, idempotency_key)
     VALUES ($1, $2, 'check_out', $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *;`,
    [
      eventId,
      sessionId,
      device_time ? new Date(device_time) : new Date(),
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      accuracy_m ? parseFloat(accuracy_m) : null,
      distanceM,
      isWithinRadius,
      photoPath,
      idempotency_key
    ]
  );

  await logAudit({
    actorId: req.user.id,
    action: 'CHECK_OUT',
    entityType: 'attendance_events',
    entityId: eventId,
    changes: { isWithinRadius, distanceM },
    ipAddress: req.ip
  });

  return res.status(201).json({
    success: true,
    message: 'Absen pulang berhasil dicatat oleh server! (Catatan: Pulang bersifat opsional)',
    event: eventRes.rows[0],
    locationValidation: {
      distanceMeters: distanceM,
      radiusMeters: branch.radius_m || 150,
      isWithinRadius
    }
  });
});

// GET /api/v1/attendance/me
router.get('/me', requireAuth, async (req, res) => {
  const employeeId = req.user.employeeId;
  if (!employeeId) {
    return res.json({ success: true, todaySession: null, history: [] });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const todayRes = await db.query(`
      SELECT s.id, s.work_date, s.status, s.attendance_type, s.is_meal_allowance_eligible,
             b.name as branch_name, sh.name as shift_name,
             json_agg(json_build_object(
               'id', e.id,
               'event_type', e.event_type,
               'attendance_type', e.attendance_type,
               'server_time', e.server_time,
               'device_time', e.device_time,
               'is_within_radius', e.is_within_radius,
               'photo_path', e.photo_path
             ) ORDER BY e.server_time ASC) as events
      FROM attendance_sessions s
      LEFT JOIN branches b ON s.branch_id = b.id
      LEFT JOIN shifts sh ON s.shift_id = sh.id
      LEFT JOIN attendance_events e ON s.id = e.session_id
      WHERE s.employee_id = $1 AND s.work_date = $2
      GROUP BY s.id, b.name, sh.name;
    `, [employeeId, today]);

    const historyRes = await db.query(`
      SELECT s.id, s.work_date, s.status, s.attendance_type, s.is_meal_allowance_eligible,
             b.name as branch_name, sh.name as shift_name,
             MIN(CASE WHEN e.event_type = 'check_in' THEN e.server_time END) as check_in_time,
             MAX(CASE WHEN e.event_type = 'check_out' THEN e.server_time END) as check_out_time,
             COUNT(e.id) as total_events
      FROM attendance_sessions s
      LEFT JOIN branches b ON s.branch_id = b.id
      LEFT JOIN shifts sh ON s.shift_id = sh.id
      LEFT JOIN attendance_events e ON s.id = e.session_id
      WHERE s.employee_id = $1
      GROUP BY s.id, b.name, sh.name
      ORDER BY s.work_date DESC
      LIMIT 30;
    `, [employeeId]);

    return res.json({
      success: true,
      todaySession: todayRes.rows.length > 0 ? todayRes.rows[0] : null,
      history: historyRes.rows
    });
  } catch (err) {
    console.error('[Attendance Me Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil riwayat absensi.' });
  }
});

// GET /api/v1/attendance/monitoring (Owner & Manager sesuai Q07)
router.get('/monitoring', requireAuth, requireRoles(['owner', 'manager', 'supervisor']), async (req, res) => {
  const { date, branch_id } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    let query = `
      SELECT s.id as session_id, s.work_date, s.status as session_status, s.attendance_type, s.is_meal_allowance_eligible,
             e.id as employee_id, e.employee_code, e.name as employee_name, e.job_title,
             b.id as branch_id, b.name as branch_name,
             sh.name as shift_name,
             MIN(CASE WHEN ev.event_type = 'check_in' THEN ev.server_time END) as check_in_time,
             MAX(CASE WHEN ev.event_type = 'check_out' THEN ev.server_time END) as check_out_time,
             BOOL_AND(ev.is_within_radius) as is_location_valid
      FROM employees e
      LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
      LEFT JOIN branches b ON ea.branch_id = b.id
      LEFT JOIN attendance_sessions s ON e.id = s.employee_id AND s.work_date = $1
      LEFT JOIN shifts sh ON s.shift_id = sh.id
      LEFT JOIN attendance_events ev ON s.id = ev.session_id
      WHERE e.active = true
    `;
    const params = [targetDate];

    if (branch_id) {
      query += ` AND (b.id = $2 OR s.branch_id = $2)`;
      params.push(branch_id);
    } else if (!req.user.isOwner && req.user.accessibleBranchIds && req.user.accessibleBranchIds.length > 0) {
      query += ` AND b.id = ANY($2)`;
      params.push(req.user.accessibleBranchIds);
    }

    query += `
      GROUP BY s.id, e.id, b.id, sh.name
      ORDER BY b.name ASC, e.name ASC;
    `;

    const result = await db.query(query, params);

    const totalKaryawan = result.rows.length;
    const hadir = result.rows.filter(r => r.check_in_time !== null).length;
    const kunjunganLuar = result.rows.filter(r => r.attendance_type === 'kunjungan_luar').length;
    const belumAbsen = totalKaryawan - hadir;

    return res.json({
      success: true,
      date: targetDate,
      summary: {
        totalKaryawan,
        hadir,
        kunjunganLuar,
        belumAbsen
      },
      records: result.rows
    });
  } catch (err) {
    console.error('[Monitoring Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil data monitoring absensi.' });
  }
});

// POST /api/v1/attendance/adjustments (Owner & Manager only sesuai Q07)
router.post('/adjustments', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { session_id, reason, new_status } = req.body;
  if (!session_id || !reason) {
    return res.status(400).json({ success: false, error: 'Session ID dan alasan koreksi wajib diisi.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const sessionRes = await client.query(`SELECT * FROM attendance_sessions WHERE id = $1`, [session_id]);
    if (sessionRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Sesi absensi tidak ditemukan.' });
    }
    const beforeData = sessionRes.rows[0];

    await client.query(
      `UPDATE attendance_sessions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [new_status || 'present', session_id]
    );

    const afterData = { ...beforeData, status: new_status || 'present', adjusted_by: req.user.id };

    await client.query(
      `INSERT INTO attendance_adjustments (session_id, reason, before_data, after_data, actor_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [session_id, reason, JSON.stringify(beforeData), JSON.stringify(afterData), req.user.id]
    );

    await client.query('COMMIT');

    await logAudit({
      actorId: req.user.id,
      action: 'ADJUST_ATTENDANCE',
      entityType: 'attendance_sessions',
      entityId: session_id,
      changes: { before: beforeData, after: afterData, reason },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Koreksi absensi berhasil dicatat beserta jejak audit.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Adjustment Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal melakukan koreksi absensi.' });
  } finally {
    client.release();
  }
});

// GET /api/v1/attendance/monthly-recap (Rekapitulasi Kehadiran Staf Per Bulan)
router.get('/monthly-recap', requireAuth, requireRoles(['owner', 'manager', 'supervisor']), async (req, res) => {
  const now = new Date();
  const year = parseInt(req.query.year, 10) || now.getFullYear();
  const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);
  const branch_id = req.query.branch_id || null;

  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  try {
    let empQuery = `
      SELECT e.id as employee_id, e.employee_code, e.name as employee_name, e.job_title,
             b.id as branch_id, b.name as branch_name
      FROM employees e
      LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
      LEFT JOIN branches b ON ea.branch_id = b.id
      WHERE e.active = true
    `;
    const empParams = [];
    if (branch_id) {
      empQuery += ` AND b.id = $1`;
      empParams.push(branch_id);
    } else if (!req.user.isOwner && req.user.accessibleBranchIds && req.user.accessibleBranchIds.length > 0) {
      empQuery += ` AND b.id = ANY($1)`;
      empParams.push(req.user.accessibleBranchIds);
    }
    empQuery += ` ORDER BY b.name ASC, e.name ASC`;

    const employeesRes = await db.query(empQuery, empParams);
    const employees = employeesRes.rows;

    let attQuery = `
      SELECT s.id as session_id, s.employee_id, s.work_date, s.status, s.attendance_type, s.is_meal_allowance_eligible,
             sh.id as shift_id, sh.name as shift_name, sh.start_time as shift_start, sh.end_time as shift_end,
             MIN(CASE WHEN ev.event_type = 'check_in' THEN ev.server_time END) as check_in_time,
             MAX(CASE WHEN ev.event_type = 'check_out' THEN ev.server_time END) as check_out_time,
             BOOL_AND(ev.is_within_radius) as is_location_valid
      FROM attendance_sessions s
      LEFT JOIN shifts sh ON s.shift_id = sh.id
      LEFT JOIN attendance_events ev ON s.id = ev.session_id
      WHERE s.work_date >= $1 AND s.work_date <= $2
      GROUP BY s.id, sh.id
      ORDER BY s.work_date ASC
    `;
    const attRes = await db.query(attQuery, [startDate, endDate]);
    const allSessions = attRes.rows;

    const sessionsByEmp = {};
    for (const s of allSessions) {
      if (!sessionsByEmp[s.employee_id]) {
        sessionsByEmp[s.employee_id] = [];
      }
      sessionsByEmp[s.employee_id].push(s);
    }

    const recap = employees.map(emp => {
      const empSessions = sessionsByEmp[emp.employee_id] || [];

      let totalHadirFisik = 0;
      let totalKunjunganLuar = 0;
      let totalLembur = 0;
      let totalShiftPagi = 0;
      let totalShiftSiang = 0;
      let totalTerlambat = 0;
      let totalUangMakan = 0;
      let totalMenitKerja = 0;

      const dailyRecords = empSessions.map(s => {
        const isHadir = (s.status === 'present' || s.status === 'late') && (s.attendance_type === 'hadir' || !s.attendance_type);
        const isKunjungan = s.attendance_type === 'kunjungan_luar';
        const isLembur = s.shift_name && /lembur/i.test(s.shift_name);
        const isPagi = s.shift_name && /pagi/i.test(s.shift_name);
        const isSiang = s.shift_name && /siang/i.test(s.shift_name);

        if (isHadir) totalHadirFisik++;
        if (isKunjungan) totalKunjunganLuar++;
        if (isLembur) totalLembur++;
        if (isPagi) totalShiftPagi++;
        if (isSiang) totalShiftSiang++;
        if (s.status === 'late') totalTerlambat++;
        if (s.is_meal_allowance_eligible && isHadir) totalUangMakan += 10000;

        let durasiMenit = 0;
        if (s.check_in_time && s.check_out_time) {
          const diffMs = new Date(s.check_out_time) - new Date(s.check_in_time);
          durasiMenit = Math.max(0, Math.round(diffMs / 60000));
        } else if (isLembur) {
          durasiMenit = 13 * 60;
        } else if (isPagi || isSiang) {
          durasiMenit = 9 * 60;
        }
        totalMenitKerja += durasiMenit;

        return {
          session_id: s.session_id,
          date: s.work_date,
          status: s.status,
          attendance_type: s.attendance_type || 'hadir',
          shift_name: s.shift_name || '-',
          is_lembur: Boolean(isLembur),
          check_in_time: s.check_in_time,
          check_out_time: s.check_out_time,
          uang_makan: (s.is_meal_allowance_eligible && isHadir) ? 10000 : 0,
          durasi_menit: durasiMenit
        };
      });

      const item = {
        employee_id: emp.employee_id,
        employee_code: emp.employee_code,
        employee_name: emp.employee_name,
        job_title: emp.job_title || 'Staff',
        branch_id: emp.branch_id,
        branch_name: emp.branch_name || '-',
        total_kehadiran: totalHadirFisik + totalKunjunganLuar,
        total_hadir_fisik: totalHadirFisik,
        total_kunjungan_luar: totalKunjunganLuar,
        total_lembur: totalLembur,
        total_shift_pagi: totalShiftPagi,
        total_shift_siang: totalShiftSiang,
        total_terlambat: totalTerlambat,
        total_uang_makan: totalUangMakan,
        total_jam_kerja: Math.round(totalMenitKerja / 60),
        daily_records: dailyRecords,
        // CamelCase aliases
        totalHadirFisik: totalHadirFisik,
        totalKunjunganLuar: totalKunjunganLuar,
        totalLembur: totalLembur,
        totalTerlambat: totalTerlambat,
        totalUangMakan: totalUangMakan,
        totalJamKerja: Math.round(totalMenitKerja / 60),
        dailyRecords: dailyRecords
      };
      return item;
    });

    const monthNames = [
      '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const grandTotal = {
      totalKaryawan: recap.length,
      totalEmployees: recap.length,
      grandHadir: recap.reduce((acc, r) => acc + r.total_hadir_fisik, 0),
      totalHadirFisik: recap.reduce((acc, r) => acc + r.total_hadir_fisik, 0),
      grandKunjungan: recap.reduce((acc, r) => acc + r.total_kunjungan_luar, 0),
      totalKunjunganLuar: recap.reduce((acc, r) => acc + r.total_kunjungan_luar, 0),
      grandLembur: recap.reduce((acc, r) => acc + r.total_lembur, 0),
      totalLembur: recap.reduce((acc, r) => acc + r.total_lembur, 0),
      grandTerlambat: recap.reduce((acc, r) => acc + r.total_terlambat, 0),
      totalTerlambat: recap.reduce((acc, r) => acc + r.total_terlambat, 0),
      grandUangMakan: recap.reduce((acc, r) => acc + r.total_uang_makan, 0),
      totalUangMakan: recap.reduce((acc, r) => acc + r.total_uang_makan, 0)
    };

    return res.json({
      success: true,
      period: {
        year,
        month,
        month_name: monthNames[month] || `Bulan ${month}`,
        label: `${monthNames[month] || `Bulan ${month}`} ${year}`,
        start_date: startDate,
        startDate: startDate,
        end_date: endDate,
        endDate: endDate,
        days_in_month: lastDay
      },
      summary: grandTotal,
      recap
    });
  } catch (err) {
    console.error('[Monthly Recap Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal memproses rekap bulanan staf: ' + err.message });
  }
});

module.exports = router;
