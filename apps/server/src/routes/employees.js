const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// GET /api/v1/employees
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.id, e.user_id, e.employee_code, e.name, e.job_title, e.hire_date, e.active, e.is_test_data,
             COALESCE(e.phone, p.phone) as phone,
             ea.branch_id, b.name as branch_name, b.code as branch_code,
             u.login_identifier,
             ARRAY_AGG(r.code) as roles
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
      LEFT JOIN branches b ON ea.branch_id = b.id
      WHERE e.active = true
      GROUP BY e.id, ea.branch_id, b.name, b.code, u.login_identifier, p.phone
      ORDER BY e.name ASC;
    `);

    return res.json({
      success: true,
      employees: result.rows
    });
  } catch (err) {
    console.error('[Employees Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil data karyawan.' });
  }
});

// POST /api/v1/employees (Owner & Manager only)
router.post('/', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { employee_code, name, job_title, hire_date, branch_id, is_test_data, phone } = req.body;
  if (!employee_code || !name) {
    return res.status(400).json({ success: false, error: 'Kode karyawan dan nama wajib diisi.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const cleanPhone = phone ? phone.trim() : null;

    // 1. Buat akun user dan profile otomatis agar staf baru bisa login & direset password
    let newUserId = null;
    const baseUsername = employee_code.toLowerCase().replace(/[^a-z0-9]/g, '');
    const uCheck = await client.query('SELECT id FROM users WHERE LOWER(login_identifier) = LOWER($1)', [baseUsername]);
    let username = baseUsername;
    if (uCheck.rows.length > 0) {
      username = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;
    }

    const defaultPasswordHash = await bcrypt.hash('sultan123', 10);
    const userRes = await client.query(
      `INSERT INTO users (login_identifier, password_hash, active)
       VALUES ($1, $2, true)
       RETURNING id;`,
      [username, defaultPasswordHash]
    );
    newUserId = userRes.rows[0].id;

    // Profile
    await client.query(
      `INSERT INTO profiles (id, display_name, phone, active)
       VALUES ($1, $2, $3, true);`,
      [newUserId, name.trim(), cleanPhone]
    );

    // Role karyawan
    const roleRes = await client.query(`SELECT id FROM roles WHERE code = 'karyawan'`);
    if (roleRes.rows.length > 0) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [newUserId, roleRes.rows[0].id]
      );
    }

    if (branch_id) {
      await client.query(
        `INSERT INTO user_branch_access (user_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [newUserId, branch_id]
      );
    }

    // 2. Insert ke employees
    const empRes = await client.query(
      `INSERT INTO employees (user_id, employee_code, name, job_title, hire_date, is_test_data, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *;`,
      [newUserId, employee_code.trim(), name.trim(), job_title || 'Crew Toko', hire_date || new Date(), is_test_data === true, cleanPhone]
    );
    const newEmp = empRes.rows[0];

    // 3. Insert assignment cabang primer
    if (branch_id) {
      await client.query(
        `INSERT INTO employee_assignments (employee_id, branch_id, valid_from, is_primary)
         VALUES ($1, $2, CURRENT_DATE, true);`,
        [newEmp.id, branch_id]
      );
    }

    await client.query('COMMIT');

    await logAudit({
      actorId: req.user.id,
      action: 'CREATE_EMPLOYEE',
      entityType: 'employees',
      entityId: newEmp.id,
      changes: { employee_code, name, branch_id, phone: cleanPhone, username },
      ipAddress: req.ip
    });

    return res.status(201).json({ success: true, employee: newEmp, username });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Create Employee Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal menambah karyawan: ' + err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/v1/employees/:id/phone (Owner & Manager)
router.patch('/:id/phone', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { phone } = req.body;
  if (!phone || !phone.trim()) {
    return res.status(400).json({ success: false, error: 'Nomor telepon/WhatsApp wajib diisi.' });
  }
  const cleanPhone = phone.trim();

  try {
    const empRes = await db.query(
      `UPDATE employees SET phone = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;`,
      [cleanPhone, req.params.id]
    );
    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan.' });
    }
    const emp = empRes.rows[0];

    if (emp.user_id) {
      await db.query(
        `UPDATE profiles SET phone = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [cleanPhone, emp.user_id]
      );
    }

    await logAudit({
      actorId: req.user.id,
      action: 'UPDATE_EMPLOYEE_PHONE',
      entityType: 'employees',
      entityId: emp.id,
      changes: { phone: cleanPhone },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Nomor WhatsApp berhasil diperbarui.', employee: emp });
  } catch (err) {
    console.error('[Update Phone Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui nomor WhatsApp: ' + err.message });
  }
});

module.exports = router;
