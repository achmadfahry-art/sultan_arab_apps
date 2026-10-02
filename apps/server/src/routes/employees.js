const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// GET /api/v1/employees
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.id, e.user_id, e.employee_code, e.name, e.job_title, e.hire_date, e.active, e.is_test_data,
             ea.branch_id, b.name as branch_name, b.code as branch_code,
             u.login_identifier,
             ARRAY_AGG(r.code) as roles
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
      LEFT JOIN branches b ON ea.branch_id = b.id
      WHERE e.active = true
      GROUP BY e.id, ea.branch_id, b.name, b.code, u.login_identifier
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
  const { employee_code, name, job_title, hire_date, branch_id, is_test_data } = req.body;
  if (!employee_code || !name) {
    return res.status(400).json({ success: false, error: 'Kode karyawan dan nama wajib diisi.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const empRes = await client.query(
      `INSERT INTO employees (employee_code, name, job_title, hire_date, is_test_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [employee_code.trim(), name.trim(), job_title || 'Crew Toko', hire_date || new Date(), is_test_data !== undefined ? is_test_data : true]
    );
    const newEmp = empRes.rows[0];

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
      changes: { employee_code, name, branch_id },
      ipAddress: req.ip
    });

    return res.status(201).json({ success: true, employee: newEmp });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Create Employee Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal menambah karyawan: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
