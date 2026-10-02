const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// GET /api/v1/schedules/shifts
router.get('/shifts', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.id, s.branch_id, s.name, s.start_time, s.end_time, s.crosses_midnight, s.is_test_data,
             b.name as branch_name
      FROM shifts s
      LEFT JOIN branches b ON s.branch_id = b.id
      ORDER BY s.start_time ASC;
    `);
    return res.json({ success: true, shifts: result.rows });
  } catch (err) {
    console.error('[Shifts Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil data shift.' });
  }
});

// GET /api/v1/schedules/me
router.get('/me', requireAuth, async (req, res) => {
  if (!req.user.employeeId) {
    return res.json({ success: true, schedules: [], daysOff: [] });
  }

  try {
    const schedulesRes = await db.query(`
      SELECT ws.id, ws.work_date, ws.shift_id,
             s.name as shift_name, s.start_time, s.end_time,
             b.name as branch_name
      FROM work_schedules ws
      LEFT JOIN shifts s ON ws.shift_id = s.id
      LEFT JOIN branches b ON ws.branch_id = b.id
      WHERE ws.employee_id = $1 AND ws.work_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY ws.work_date ASC;
    `, [req.user.employeeId]);

    const daysOffRes = await db.query(`
      SELECT id, off_date, reason
      FROM days_off
      WHERE employee_id = $1 AND off_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY off_date ASC;
    `, [req.user.employeeId]);

    return res.json({
      success: true,
      schedules: schedulesRes.rows,
      daysOff: daysOffRes.rows
    });
  } catch (err) {
    console.error('[Schedules Me Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil jadwal pribadi.' });
  }
});

// POST /api/v1/schedules (Owner, Manager, Supervisor)
router.post('/', requireAuth, requireRoles(['owner', 'manager', 'supervisor']), async (req, res) => {
  const { employee_id, branch_id, work_date, shift_id } = req.body;
  if (!employee_id || !branch_id || !work_date) {
    return res.status(400).json({ success: false, error: 'Data jadwal belum lengkap.' });
  }

  try {
    const resSchedule = await db.query(`
      INSERT INTO work_schedules (employee_id, branch_id, work_date, shift_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_id, work_date)
      DO UPDATE SET branch_id = EXCLUDED.branch_id, shift_id = EXCLUDED.shift_id
      RETURNING *;
    `, [employee_id, branch_id, work_date, shift_id || null]);

    await logAudit({
      actorId: req.user.id,
      action: 'SET_SCHEDULE',
      entityType: 'work_schedules',
      entityId: resSchedule.rows[0].id,
      changes: { employee_id, branch_id, work_date, shift_id },
      ipAddress: req.ip
    });

    return res.json({ success: true, schedule: resSchedule.rows[0] });
  } catch (err) {
    console.error('[Set Schedule Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal menyimpan jadwal.' });
  }
});

// POST /api/v1/schedules/days-off (Owner, Manager, Supervisor)
router.post('/days-off', requireAuth, requireRoles(['owner', 'manager', 'supervisor']), async (req, res) => {
  const { employee_id, off_date, reason } = req.body;
  if (!employee_id || !off_date) {
    return res.status(400).json({ success: false, error: 'Karyawan dan tanggal libur wajib diisi.' });
  }

  try {
    const resDayOff = await db.query(`
      INSERT INTO days_off (employee_id, off_date, reason, created_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_id, off_date)
      DO UPDATE SET reason = EXCLUDED.reason
      RETURNING *;
    `, [employee_id, off_date, reason || 'Libur Rutin Rolling', req.user.id]);

    await logAudit({
      actorId: req.user.id,
      action: 'SET_DAY_OFF',
      entityType: 'days_off',
      entityId: resDayOff.rows[0].id,
      changes: { employee_id, off_date, reason },
      ipAddress: req.ip
    });

    return res.json({ success: true, dayOff: resDayOff.rows[0] });
  } catch (err) {
    console.error('[Set Day Off Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal menyimpan jadwal libur.' });
  }
});

module.exports = router;
