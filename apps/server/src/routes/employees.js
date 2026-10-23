const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.resolve(__dirname, '../../../storage');
const AVATARS_DIR = path.join(UPLOAD_ROOT, 'avatars');

function saveAvatarBase64(base64Data, prefix = 'emp') {
  if (!base64Data) return null;
  try {
    const cleanData = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanData, 'base64');
    if (!fs.existsSync(AVATARS_DIR)) {
      fs.mkdirSync(AVATARS_DIR, { recursive: true });
    }
    const filename = `${prefix}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}.jpg`;
    const fullPath = path.join(AVATARS_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    return `/storage/avatars/${filename}`;
  } catch (err) {
    console.error('[Save Employee Avatar Error]', err.message);
    return null;
  }
}

// GET /api/v1/employees
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.id, e.user_id, e.employee_code, e.name, e.job_title, e.hire_date, e.active, e.is_test_data,
             COALESCE(e.photo_url, p.avatar_url) as photo_url,
             COALESCE(e.photo_url, p.avatar_url) as avatar_url,
             COALESCE(e.phone, p.phone) as phone,
             COALESCE(e.day_off, 'Ahad') as day_off,
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
      GROUP BY e.id, ea.branch_id, b.name, b.code, u.login_identifier, p.phone, p.avatar_url, e.day_off, e.photo_url
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
  const { employee_code, name, job_title, hire_date, branch_id, is_test_data, phone, day_off, photo_base64, custom_username, custom_password } = req.body;
  if (!employee_code || !name) {
    return res.status(400).json({ success: false, error: 'Kode karyawan dan nama wajib diisi.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const cleanPhone = phone ? phone.trim() : null;
    const cleanDayOff = day_off ? day_off.trim() : 'Ahad';
    const cleanCode = employee_code.trim();
    const cleanName = name.trim();

    // Simpan foto jika dilampirkan
    const photoUrl = photo_base64 ? saveAvatarBase64(photo_base64, `emp_${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`) : null;

    // 1. Buat akun user dan profile otomatis agar staf baru bisa login & direset password
    let newUserId = null;
    const rawUsername = (custom_username && custom_username.trim()) || cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    const baseUsername = rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const uCheck = await client.query('SELECT id FROM users WHERE LOWER(login_identifier) = LOWER($1)', [baseUsername]);
    let username = baseUsername;
    if (uCheck.rows.length > 0) {
      if (custom_username && custom_username.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: `Nama akun/username '${custom_username.trim()}' sudah digunakan oleh staf lain. Silakan pilih username berbeda.` });
      }
      username = `${baseUsername}_${Math.floor(100 + Math.random() * 900)}`;
    }

    const plainPassword = (custom_password && custom_password.trim().length >= 6) ? custom_password.trim() : 'sultan123';
    const defaultPasswordHash = await bcrypt.hash(plainPassword, 10);
    const userRes = await client.query(
      `INSERT INTO users (login_identifier, password_hash, active)
       VALUES ($1, $2, true)
       RETURNING id;`,
      [username, defaultPasswordHash]
    );
    newUserId = userRes.rows[0].id;

    // Profile
    await client.query(
      `INSERT INTO profiles (id, display_name, phone, avatar_url, active)
       VALUES ($1, $2, $3, $4, true);`,
      [newUserId, cleanName, cleanPhone, photoUrl]
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
      `INSERT INTO employees (user_id, employee_code, name, job_title, hire_date, is_test_data, phone, day_off, photo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *;`,
      [newUserId, cleanCode, cleanName, job_title || 'Crew Toko', hire_date || new Date(), is_test_data === true, cleanPhone, cleanDayOff, photoUrl]
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
      changes: { employee_code, name, branch_id, phone: cleanPhone, day_off: cleanDayOff, username },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      employee: newEmp,
      username,
      initialPassword: plainPassword
    });
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

// PATCH /api/v1/employees/:id/day-off (Owner & Manager)
router.patch('/:id/day-off', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { day_off } = req.body;
  if (!day_off || !day_off.trim()) {
    return res.status(400).json({ success: false, error: 'Jadwal hari libur wajib dipilih.' });
  }
  const cleanDayOff = day_off.trim();

  try {
    const empRes = await db.query(
      `UPDATE employees SET day_off = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;`,
      [cleanDayOff, req.params.id]
    );
    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan.' });
    }
    const emp = empRes.rows[0];

    await logAudit({
      actorId: req.user.id,
      action: 'UPDATE_EMPLOYEE_DAY_OFF',
      entityType: 'employees',
      entityId: emp.id,
      changes: { day_off: cleanDayOff },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Jadwal libur berhasil diperbarui.', employee: emp });
  } catch (err) {
    console.error('[Update Day Off Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui jadwal libur: ' + err.message });
  }
});

// PATCH /api/v1/employees/:id/name (Owner & Manager)
router.patch('/:id/name', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { name, job_title } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Nama karyawan wajib diisi.' });
  }
  const cleanName = name.trim();
  const cleanJob = job_title && job_title.trim() ? job_title.trim() : null;

  try {
    const empLookup = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (empLookup.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan.' });
    }
    const emp = empLookup.rows[0];

    const empRes = await db.query(
      `UPDATE employees 
       SET name = $1, 
           job_title = COALESCE($2, job_title), 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING *;`,
      [cleanName, cleanJob, req.params.id]
    );
    const updatedEmp = empRes.rows[0];

    if (updatedEmp.user_id) {
      await db.query(
        `UPDATE profiles SET display_name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [cleanName, updatedEmp.user_id]
      );
    }

    await logAudit({
      actorId: req.user.id,
      action: 'UPDATE_EMPLOYEE_NAME',
      entityType: 'employees',
      entityId: updatedEmp.id,
      changes: { oldName: emp.name, newName: cleanName, job_title: updatedEmp.job_title },
      ipAddress: req.ip
    });

    return res.json({ success: true, message: 'Nama karyawan berhasil diperbarui.', employee: updatedEmp });
  } catch (err) {
    console.error('[Update Name Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui nama karyawan: ' + err.message });
  }
});

// DELETE /api/v1/employees/:id (Owner & Manager)
router.delete('/:id', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { id } = req.params;

  try {
    const empRes = await db.query(`
      SELECT e.*, ARRAY_AGG(r.code) as roles
      FROM employees e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE e.id = $1
      GROUP BY e.id;
    `, [id]);

    if (empRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan.' });
    }

    const emp = empRes.rows[0];

    // Keamanan 1: Tidak boleh menghapus akun diri sendiri
    if (emp.user_id && emp.user_id === req.user.id) {
      return res.status(400).json({ success: false, error: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    }

    // Keamanan 2: Akun Owner tidak dapat dihapus oleh siapa pun
    if (emp.roles && emp.roles.includes('owner')) {
      return res.status(403).json({ success: false, error: 'Akun Owner tidak dapat dihapus.' });
    }

    // Keamanan 3: Manager tidak dapat menghapus sesama Manager atau Owner
    if (!req.user.isOwner && emp.roles && (emp.roles.includes('manager') || emp.roles.includes('owner'))) {
      return res.status(403).json({ success: false, error: 'Hanya Owner yang berhak menghapus akun Manager.' });
    }

    // Cek apakah karyawan memiliki riwayat kehadiran atau payroll
    const attCountRes = await db.query('SELECT count(*)::int as count FROM attendance_sessions WHERE employee_id = $1;', [id]);
    const payCountRes = await db.query('SELECT count(*)::int as count FROM payroll_items WHERE employee_id = $1;', [id]);
    const attCount = attCountRes.rows[0]?.count || 0;
    const payCount = payCountRes.rows[0]?.count || 0;
    const hasHistory = (attCount > 0 || payCount > 0);

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      if (hasHistory) {
        // Soft delete: Nonaktifkan karyawan & akun user agar rekam jejak keuangan dan presensi masa lampau tetap utuh
        await client.query('UPDATE employees SET active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1;', [id]);
        if (emp.user_id) {
          await client.query('UPDATE users SET active = false WHERE id = $1;', [emp.user_id]);
        }
        // Bersihkan jadwal yang belum berjalan (masa depan)
        await client.query('DELETE FROM work_schedules WHERE employee_id = $1 AND work_date >= CURRENT_DATE;', [id]);
        await client.query('DELETE FROM employee_assignments WHERE employee_id = $1;', [id]);
      } else {
        // Belum pernah ada riwayat presensi/payroll: Hapus permanen (seluruh relasi assignments, schedules, days_off cascade otomatis)
        await client.query('DELETE FROM employees WHERE id = $1;', [id]);
        if (emp.user_id) {
          await client.query('DELETE FROM users WHERE id = $1;', [emp.user_id]);
        }
      }

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    await logAudit({
      actorId: req.user.id,
      action: 'DELETE_EMPLOYEE',
      entityType: 'employees',
      entityId: emp.id,
      changes: {
        name: emp.name,
        employee_code: emp.employee_code,
        method: hasHistory ? 'soft_delete (deactivated)' : 'hard_delete'
      },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Karyawan ${emp.name} berhasil dihapus dari daftar.`
    });
  } catch (err) {
    console.error('[Delete Employee Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal menghapus karyawan: ' + err.message });
  }
});

// PATCH /api/v1/employees/:id/photo (Owner & Manager)
router.patch('/:id/photo', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { photo_base64 } = req.body;
  if (!photo_base64) {
    return res.status(400).json({ success: false, error: 'Foto tidak boleh kosong.' });
  }

  try {
    const empLookup = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (empLookup.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan.' });
    }
    const emp = empLookup.rows[0];

    const photoUrl = saveAvatarBase64(photo_base64, `emp_${emp.employee_code.toLowerCase().replace(/[^a-z0-9]/g, '')}`);
    if (!photoUrl) {
      return res.status(500).json({ success: false, error: 'Gagal menyimpan file foto karyawan.' });
    }

    const empRes = await db.query(
      `UPDATE employees SET photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *;`,
      [photoUrl, req.params.id]
    );
    const updatedEmp = empRes.rows[0];

    if (updatedEmp.user_id) {
      await db.query(
        `UPDATE profiles SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`,
        [photoUrl, updatedEmp.user_id]
      );
    }

    await logAudit({
      actorId: req.user.id,
      action: 'UPDATE_EMPLOYEE_PHOTO',
      entityType: 'employees',
      entityId: updatedEmp.id,
      changes: { photo_url: photoUrl },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Foto karyawan berhasil diperbarui.',
      photo_url: photoUrl,
      employee: updatedEmp
    });
  } catch (err) {
    console.error('[Update Employee Photo Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui foto karyawan: ' + err.message });
  }
});

// DELETE /api/v1/employees/:id/photo (Owner & Manager)
router.delete('/:id/photo', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  try {
    const empLookup = await db.query('SELECT * FROM employees WHERE id = $1', [req.params.id]);
    if (empLookup.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Karyawan tidak ditemukan.' });
    }
    const emp = empLookup.rows[0];

    await db.query(
      `UPDATE employees SET photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
      [req.params.id]
    );

    if (emp.user_id) {
      await db.query(
        `UPDATE profiles SET avatar_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
        [emp.user_id]
      );
    }

    await logAudit({
      actorId: req.user.id,
      action: 'DELETE_EMPLOYEE_PHOTO',
      entityType: 'employees',
      entityId: emp.id,
      changes: { photo_url: null },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Foto karyawan berhasil dihapus.'
    });
  } catch (err) {
    console.error('[Delete Employee Photo Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal menghapus foto karyawan: ' + err.message });
  }
});

module.exports = router;
