const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { calculateDistanceMeters } = require('../utils/geo');
const { logAudit } = require('../utils/audit');
const { buildMonthlyRecapData, resolveCutoffPeriod, normalizeDateStr, isEmployeeDayOff } = require('../utils/recap');
const { generateMonthlyRecapPdf } = require('../utils/pdf');

const OVERTIME_RATES = { 0: 0, 1: 15000, 2: 30000, 3: 50000, 4: 65000 };
function getOvertimePay(hours) {
  const h = Number(hours);
  return Object.prototype.hasOwnProperty.call(OVERTIME_RATES, h) ? OVERTIME_RATES[h] : null;
}

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

// Helper Tanggal & Waktu WIB (Asia/Jakarta, UTC+7)
function getJakartaDateStr(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function getJakartaMinutes(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(d);
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return hour * 60 + minute;
}

// POST /api/v1/attendance/check-in
router.post('/check-in', requireAuth, async (req, res) => {
  const {
    branch_id,
    shift_id,
    attendance_type, // 'hadir' atau 'kunjungan_luar'
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

  // Tipe Absensi: 'kunjungan_luar' vs 'hadir'
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

  // Cek Shift & Toleransi Terlambat 15 Menit
  let initialStatus = 'present';
  let chosenShiftId = shift_id || null;
  if (chosenShiftId) {
    const shiftRes = await db.query(`SELECT * FROM shifts WHERE id = $1`, [chosenShiftId]);
    if (shiftRes.rows.length > 0) {
      const shift = shiftRes.rows[0];
      const [sh, sm] = shift.start_time.split(':').map(Number);
      const shiftStartMinutes = sh * 60 + sm;
      const currentMinutes = getJakartaMinutes(new Date());

      // Toleransi 15 menit
      if (currentMinutes > shiftStartMinutes + 15) {
        initialStatus = 'late'; // Terlambat
      }
    }
  }

  const eventId = uuidv4();
  const workDate = getJakartaDateStr();
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
      // Validasi ketat: Cegah absen masuk ulang di hari yang sama
      const existingCheckIn = await client.query(
        `SELECT id, server_time FROM attendance_events WHERE session_id = $1 AND event_type = 'check_in' LIMIT 1`,
        [sessionId]
      );
      if (existingCheckIn.rows.length > 0) {
        await client.query('ROLLBACK');
        const inTimeStr = new Date(existingCheckIn.rows[0].server_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        return res.status(400).json({
          success: false,
          error: `Anda sudah melakukan absen masuk hari ini pada pukul ${inTimeStr} WIB. Anda tidak dapat melakukan absen masuk lagi pada hari yang sama.`
        });
      }

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

// POST /api/v1/attendance/check-out (Opsional / Tidak Wajib)
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

  const workDate = getJakartaDateStr();

  const sessionRes = await db.query(
    `SELECT id, branch_id, status FROM attendance_sessions WHERE employee_id = $1 AND work_date = $2`,
    [employeeId, workDate]
  );

  let targetBranchId = branch_id;
  if (!targetBranchId && sessionRes.rows.length > 0 && sessionRes.rows[0].branch_id) {
    targetBranchId = sessionRes.rows[0].branch_id;
  }
  if (!targetBranchId && req.user.assignedBranchId) {
    targetBranchId = req.user.assignedBranchId;
  }
  if (!targetBranchId) {
    const assignRes = await db.query(
      `SELECT branch_id FROM employee_assignments WHERE employee_id = $1 AND is_primary = true LIMIT 1`,
      [employeeId]
    );
    if (assignRes.rows.length > 0) {
      targetBranchId = assignRes.rows[0].branch_id;
    } else {
      const firstBranch = await db.query(`SELECT id FROM branches ORDER BY name ASC LIMIT 1`);
      if (firstBranch.rows.length > 0) targetBranchId = firstBranch.rows[0].id;
    }
  }

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

    // Validasi ketat: Cegah absen pulang ulang jika sudah absen pulang
    const existingCheckOut = await db.query(
      `SELECT id, server_time FROM attendance_events WHERE session_id = $1 AND event_type = 'check_out' LIMIT 1`,
      [sessionId]
    );
    if (existingCheckOut.rows.length > 0) {
      const outTimeStr = new Date(existingCheckOut.rows[0].server_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      return res.status(400).json({
        success: false,
        error: `Anda sudah melakukan absen pulang hari ini pada pukul ${outTimeStr} WIB. Absensi hari ini telah lengkap dan tidak dapat dilakukan lagi.`
      });
    }

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
    const today = getJakartaDateStr();

    const todayRes = await db.query(`
      SELECT s.id, s.work_date, s.status, s.attendance_type, s.is_meal_allowance_eligible,
             s.overtime_hours, s.overtime_pay, s.overtime_note,
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
             s.overtime_hours, s.overtime_pay, s.overtime_note,
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

    const empMetaRes = await db.query(
      `SELECT COALESCE(day_off, 'Ahad') as day_off FROM employees WHERE id = $1 LIMIT 1`,
      [employeeId]
    );
    const dayOffName = empMetaRes.rows[0]?.day_off || 'Ahad';
    const specificOffRes = await db.query(
      `SELECT 1 FROM days_off WHERE employee_id = $1 AND off_date = $2 LIMIT 1`,
      [employeeId, today]
    );
    const isScheduledOff = isEmployeeDayOff(today, dayOffName, specificOffRes.rows.length > 0 ? new Set([today]) : null);
    const todaySess = todayRes.rows.length > 0 ? todayRes.rows[0] : null;
    const isDayOffToday = Boolean(
      (todaySess && todaySess.status === 'off') ||
      (isScheduledOff && !todaySess)
    );

    return res.json({
      success: true,
      todaySession: todaySess,
      todayDayOff: {
        isScheduledOff,
        isDayOffToday,
        dayOffName
      },
      history: historyRes.rows
    });
  } catch (err) {
    console.error('[Attendance Me Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil riwayat absensi.' });
  }
});

// GET /api/v1/attendance/monitoring (Owner & Manager)
router.get('/monitoring', requireAuth, requireRoles(['owner', 'manager', 'supervisor']), async (req, res) => {
  const { date, branch_id } = req.query;
  const targetDate = date || getJakartaDateStr();

  try {
    let query = `
      SELECT s.id as session_id, s.work_date, s.status as session_status, s.attendance_type, s.is_meal_allowance_eligible,
             s.overtime_hours, s.overtime_pay, s.overtime_note,
             e.id as employee_id, e.employee_code, e.name as employee_name, e.job_title,
             COALESCE(e.day_off, 'Ahad') as day_off,
             COALESCE(s.branch_id, b.id) as branch_id, b.name as branch_name,
             COALESCE(s.shift_id, ws.shift_id) as shift_id,
             COALESCE(sh.name, wsh.name, 'Non-Shift') as shift_name,
             COALESCE(sh.start_time, wsh.start_time) as shift_start,
             COALESCE(sh.end_time, wsh.end_time) as shift_end,
             MIN(CASE WHEN ev.event_type = 'check_in' THEN ev.server_time END) as check_in_time,
             MAX(CASE WHEN ev.event_type = 'check_out' THEN ev.server_time END) as check_out_time,
             BOOL_AND(ev.is_within_radius) as is_location_valid
      FROM employees e
      LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
      LEFT JOIN branches b ON ea.branch_id = b.id
      LEFT JOIN attendance_sessions s ON e.id = s.employee_id AND s.work_date = $1
      LEFT JOIN shifts sh ON s.shift_id = sh.id
      LEFT JOIN work_schedules ws ON e.id = ws.employee_id AND ws.work_date = $1
      LEFT JOIN shifts wsh ON ws.shift_id = wsh.id
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
      GROUP BY s.id, e.id, b.id, s.branch_id, s.shift_id, ws.shift_id, sh.name, wsh.name, sh.start_time, wsh.start_time, sh.end_time, wsh.end_time
      ORDER BY b.name ASC, e.name ASC;
    `;

    const result = await db.query(query, params);
    const specificOffRes = await db.query(
      `SELECT employee_id FROM days_off WHERE off_date = $1`,
      [targetDate]
    );
    const specificOffSet = new Set(specificOffRes.rows.map(d => d.employee_id));

    const records = result.rows.map(r => {
      const empSpecific = specificOffSet.has(r.employee_id) ? new Set([targetDate]) : null;
      const isScheduledOff = isEmployeeDayOff(targetDate, r.day_off, empSpecific);
      const isDayOff = r.session_status === 'off' || (isScheduledOff && !r.session_status && !r.check_in_time);
      const isOverriddenToWork = Boolean(isScheduledOff && (r.session_status === 'present' || r.session_status === 'late'));
      return {
        ...r,
        is_day_off: isDayOff,
        is_scheduled_off: isScheduledOff,
        is_overridden_to_work: isOverriddenToWork,
        effective_status: r.session_status || (isDayOff ? 'off' : 'unrecorded')
      };
    });

    const totalKaryawan = records.length;
    const hadir = records.filter(r => r.check_in_time !== null).length;
    const pulang = records.filter(r => r.check_out_time !== null).length;
    const kunjunganLuar = records.filter(r => r.attendance_type === 'kunjungan_luar').length;
    const libur = records.filter(r => r.is_day_off && !r.check_in_time).length;
    const belumAbsen = Math.max(0, totalKaryawan - hadir - libur);

    return res.json({
      success: true,
      date: targetDate,
      summary: {
        totalKaryawan,
        hadir,
        pulang,
        kunjunganLuar,
        libur,
        belumAbsen
      },
      records
    });
  } catch (err) {
    console.error('[Monitoring Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil data monitoring absensi.' });
  }
});

// POST /api/v1/attendance/overtime (Karyawan mencatat lembur harian: 1-4 jam, 1x/hari, tidak untuk kunjungan luar)
router.post('/overtime', requireAuth, async (req, res) => {
  let employeeId = req.user.employeeId;
  if (!employeeId) {
    const empLookup = await db.query(`SELECT id FROM employees WHERE user_id = $1 LIMIT 1`, [req.user.id]);
    if (empLookup.rows.length > 0) employeeId = empLookup.rows[0].id;
    else return res.status(403).json({ success: false, error: 'Akun tidak terhubung ke karyawan.' });
  }

  const hoursNum = Number(req.body.hours);
  const note = req.body.note ? String(req.body.note).trim() : '';
  if (![1, 2, 3, 4].includes(hoursNum)) {
    return res.status(400).json({ success: false, error: 'Durasi lembur harus dipilih antara 1, 2, 3, atau 4 jam.' });
  }
  if (!note) {
    return res.status(400).json({ success: false, error: 'Keterangan pekerjaan tambahan wajib diisi.' });
  }

  const workDate = getJakartaDateStr();
  try {
    const sessRes = await db.query(
      `SELECT id, attendance_type, status, overtime_hours FROM attendance_sessions WHERE employee_id = $1 AND work_date = $2 LIMIT 1`,
      [employeeId, workDate]
    );
    if (sessRes.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Harap lakukan absen masuk terlebih dahulu sebelum mencatat lembur.' });
    }
    const sess = sessRes.rows[0];
    if (sess.attendance_type === 'kunjungan_luar') {
      return res.status(400).json({ success: false, error: 'Kunjungan luar tidak memerlukan pencatatan lembur.' });
    }
    if (sess.status === 'off') {
      return res.status(400).json({ success: false, error: 'Status hari ini tercatat libur.' });
    }
    if ((sess.overtime_hours || 0) > 0) {
      return res.status(400).json({ success: false, error: 'Lembur hari ini sudah tercatat (maksimal 1x input per hari).' });
    }

    const pay = getOvertimePay(hoursNum);
    const upd = await db.query(
      `UPDATE attendance_sessions
       SET overtime_hours = $1, overtime_pay = $2, overtime_note = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING id, overtime_hours, overtime_pay, overtime_note`,
      [hoursNum, pay, note, sess.id]
    );

    await logAudit({
      actorId: req.user.id,
      action: 'RECORD_OVERTIME',
      entityType: 'attendance_sessions',
      entityId: sess.id,
      changes: { work_date: workDate, overtime_hours: hoursNum, overtime_pay: pay, overtime_note: note },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Lembur ${hoursNum} jam (Rp ${pay.toLocaleString('id-ID')}) berhasil dicatat.`,
      overtime: upd.rows[0]
    });
  } catch (err) {
    console.error('[Overtime Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mencatat lembur hari ini.' });
  }
});

// POST /api/v1/attendance/adjustments (Owner & Manager only, semua cabang)
router.post('/adjustments', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { session_id, employee_id, work_date, branch_id, new_shift_id, new_status, new_attendance_type, new_overtime_hours, new_overtime_note, reason } = req.body;
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, error: 'Alasan koreksi wajib diisi untuk catatan audit.' });
  }
  if (!session_id && (!employee_id || !work_date)) {
    return res.status(400).json({ success: false, error: 'Session ID atau Karyawan dan Tanggal wajib disertakan.' });
  }

  const allowedStatuses = new Set(['present', 'late', 'incomplete', 'off']);
  const allowedTypes = new Set(['hadir', 'kunjungan_luar']);
  if (new_status && !allowedStatuses.has(new_status)) {
    return res.status(400).json({ success: false, error: 'Status kehadiran tidak valid.' });
  }
  if (new_attendance_type && !allowedTypes.has(new_attendance_type)) {
    return res.status(400).json({ success: false, error: 'Tipe kehadiran tidak valid.' });
  }
  const hasOvertimeHours = new_overtime_hours !== undefined && new_overtime_hours !== null && new_overtime_hours !== '';
  let parsedOvertimeHours = null;
  if (hasOvertimeHours) {
    parsedOvertimeHours = Number(new_overtime_hours);
    if (getOvertimePay(parsedOvertimeHours) === null) {
      return res.status(400).json({ success: false, error: 'Jam lembur harus 0, 1, 2, 3, atau 4 jam.' });
    }
  }

  const currentCutoff = resolveCutoffPeriod();
  const isWithinCurrentCutoff = (dateStr) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
    return dateStr >= currentCutoff.startDate && dateStr <= currentCutoff.endDate && dateStr <= currentCutoff.todayStr;
  };

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    let activeSessionId = session_id;
    let beforeData = {};
    let empId = employee_id;
    let targetDate = normalizeDateStr(work_date) || currentCutoff.todayStr;
    let targetBranchId = branch_id;
    let afterData = {};

    if (activeSessionId) {
      const sessionRes = await client.query(`SELECT * FROM attendance_sessions WHERE id = $1`, [activeSessionId]);
      if (sessionRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Sesi absensi tidak ditemukan.' });
      }
      beforeData = sessionRes.rows[0];
      empId = beforeData.employee_id;
      targetDate = normalizeDateStr(beforeData.work_date);
      targetBranchId = beforeData.branch_id;
    }

    if (!isWithinCurrentCutoff(targetDate)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Koreksi hanya diizinkan pada periode cut-off berjalan (${currentCutoff.startLabel} s.d. ${currentCutoff.endLabel}, maksimal hari ini).`
      });
    }

    if (!activeSessionId) {
      const existing = await client.query(
        `SELECT * FROM attendance_sessions WHERE employee_id = $1 AND work_date = $2`,
        [empId, targetDate]
      );
      if (existing.rows.length > 0) {
        activeSessionId = existing.rows[0].id;
        beforeData = existing.rows[0];
      }
    }

    if (activeSessionId) {
      const effectiveStatus = new_status || beforeData.status;
      const effectiveType = new_attendance_type || beforeData.attendance_type || 'hadir';
      const effectiveShiftId = new_shift_id || beforeData.shift_id;
      const mealEligible = effectiveType === 'hadir' && (effectiveStatus === 'present' || effectiveStatus === 'late');
      const effectiveOvertimeHours = (effectiveType === 'kunjungan_luar' || effectiveStatus === 'off')
        ? 0
        : (hasOvertimeHours ? parsedOvertimeHours : (beforeData.overtime_hours || 0));
      const effectiveOvertimePay = getOvertimePay(effectiveOvertimeHours) || 0;
      const effectiveOvertimeNote = effectiveOvertimeHours === 0
        ? null
        : (new_overtime_note !== undefined ? (String(new_overtime_note).trim() || null) : beforeData.overtime_note);

      const updatedRes = await client.query(
        `UPDATE attendance_sessions
         SET status = $1,
             shift_id = $2,
             attendance_type = $3,
             is_meal_allowance_eligible = $4,
             overtime_hours = $5,
             overtime_pay = $6,
             overtime_note = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 RETURNING *`,
        [effectiveStatus, effectiveShiftId, effectiveType, mealEligible, effectiveOvertimeHours, effectiveOvertimePay, effectiveOvertimeNote, activeSessionId]
      );
      afterData = { ...updatedRes.rows[0], adjusted_by: req.user.id };
    } else {
      if (!targetBranchId) {
        const empAssign = await client.query(
          `SELECT branch_id FROM employee_assignments WHERE employee_id = $1 AND is_primary = true LIMIT 1`,
          [empId]
        );
        targetBranchId = empAssign.rows.length > 0 ? empAssign.rows[0].branch_id : null;
        if (!targetBranchId) {
          const firstBranch = await client.query(`SELECT id FROM branches LIMIT 1`);
          targetBranchId = firstBranch.rows[0]?.id;
        }
      }
      const effectiveStatus = new_status || 'present';
      const effectiveType = new_attendance_type || 'hadir';
      const mealEligible = effectiveType === 'hadir' && (effectiveStatus === 'present' || effectiveStatus === 'late');
      const effectiveOvertimeHours = (effectiveType === 'kunjungan_luar' || effectiveStatus === 'off')
        ? 0
        : (hasOvertimeHours ? parsedOvertimeHours : 0);
      const effectiveOvertimePay = getOvertimePay(effectiveOvertimeHours) || 0;
      const effectiveOvertimeNote = effectiveOvertimeHours === 0
        ? null
        : (new_overtime_note ? String(new_overtime_note).trim() : null);

      const insertRes = await client.query(
        `INSERT INTO attendance_sessions (employee_id, branch_id, work_date, shift_id, status, attendance_type, is_meal_allowance_eligible, overtime_hours, overtime_pay, overtime_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *;`,
        [empId, targetBranchId, targetDate, new_shift_id || null, effectiveStatus, effectiveType, mealEligible, effectiveOvertimeHours, effectiveOvertimePay, effectiveOvertimeNote]
      );
      activeSessionId = insertRes.rows[0].id;
      beforeData = { shift_id: null, status: null, attendance_type: null, overtime_hours: 0, overtime_pay: 0 };
      afterData = { ...insertRes.rows[0], adjusted_by: req.user.id };
    }

    // Selalu sinkronkan ke work_schedules agar jadwal shift tercatat konsisten
    if (new_shift_id && empId && targetDate) {
      await client.query(`
        INSERT INTO work_schedules (employee_id, branch_id, work_date, shift_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (employee_id, work_date)
        DO UPDATE SET shift_id = EXCLUDED.shift_id, branch_id = COALESCE(EXCLUDED.branch_id, work_schedules.branch_id);
      `, [empId, targetBranchId, targetDate, new_shift_id]);
    }

    // Catat ke attendance_adjustments
    await client.query(
      `INSERT INTO attendance_adjustments (session_id, reason, before_data, after_data, actor_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [activeSessionId, String(reason).trim(), JSON.stringify(beforeData), JSON.stringify(afterData), req.user.id]
    );

    await client.query('COMMIT');

    await logAudit({
      actorId: req.user.id,
      action: 'ADJUST_ATTENDANCE_SHIFT',
      entityType: 'attendance_sessions',
      entityId: activeSessionId,
      changes: { before: beforeData, after: afterData, reason: String(reason).trim(), new_shift_id, new_status, new_attendance_type },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Koreksi jadwal shift & absensi berhasil disimpan ke database beserta jejak audit.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Adjustment Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal melakukan koreksi jadwal shift / absensi.' });
  } finally {
    client.release();
  }
});

// GET /api/v1/attendance/monthly-recap (Rekapitulasi & Analisa Kehadiran Staf Per Periode Cut-Off 27..26)
router.get('/monthly-recap', requireAuth, requireRoles(['owner', 'manager', 'supervisor']), async (req, res) => {
  try {
    const data = await buildMonthlyRecapData({
      rawYear: req.query.year,
      rawMonth: req.query.month,
      rawPeriod: req.query.period,
      branchId: req.query.branch_id || null,
      user: req.user
    });
    return res.json(data);
  } catch (err) {
    console.error('[Monthly Recap Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal memproses rekap bulanan staf: ' + err.message });
  }
});

// GET /api/v1/attendance/monthly-recap/pdf (Download PDF Rekap & Analisa Bulanan)
router.get('/monthly-recap/pdf', requireAuth, requireRoles(['owner', 'manager', 'supervisor']), async (req, res) => {
  try {
    const branchId = req.query.branch_id || null;
    const data = await buildMonthlyRecapData({
      rawYear: req.query.year,
      rawMonth: req.query.month,
      rawPeriod: req.query.period,
      branchId,
      user: req.user
    });

    let branchLabel = 'Semua Cabang';
    if (branchId) {
      const brRes = await db.query('SELECT name FROM branches WHERE id = $1 LIMIT 1', [branchId]);
      if (brRes.rows.length > 0) branchLabel = brRes.rows[0].name;
    }

    const pdfBuffer = generateMonthlyRecapPdf(data, branchLabel);
    const monthStr = String(data.period.month).padStart(2, '0');
    const filename = `rekap-absensi-${data.period.year}-${monthStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[Monthly Recap PDF Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal membuat PDF rekap bulanan: ' + err.message });
  }
});

module.exports = router;
