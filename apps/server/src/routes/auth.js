const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { hashToken, requireAuth, requireRoles } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  const { login_identifier, password } = req.body;
  if (!login_identifier || !password) {
    return res.status(400).json({ success: false, error: 'Username dan password wajib diisi.' });
  }

  try {
    const userRes = await db.query(
      `SELECT u.id, u.login_identifier, u.password_hash, u.active,
              p.display_name, p.phone, p.avatar_url
       FROM users u
       LEFT JOIN profiles p ON u.id = p.id
       WHERE LOWER(u.login_identifier) = LOWER($1);`,
      [login_identifier.trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Username atau password tidak sesuai.' });
    }

    const user = userRes.rows[0];
    if (!user.active) {
      return res.status(403).json({ success: false, error: 'Akun Anda dinonaktifkan. Hubungi pengelola.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Username atau password tidak sesuai.' });
    }

    // Generate session token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const sessionRes = await db.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       RETURNING id;`,
      [user.id, tokenHash, expiresAt]
    );

    // Get user roles
    const rolesRes = await db.query(
      `SELECT r.code FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1`,
      [user.id]
    );
    const roles = rolesRes.rows.map(r => r.code);

    // Set HttpOnly cookie
    res.cookie('sultan_token', rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });

    await logAudit({
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'users',
      entityId: user.id,
      changes: { login_identifier: user.login_identifier },
      ipAddress: req.ip
    });

    // Fetch employee data if linked
    const empRes = await db.query(
      `SELECT e.id, e.employee_code, e.name, e.job_title,
              ea.branch_id, b.name as branch_name, b.code as branch_code
       FROM employees e
       LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
       LEFT JOIN branches b ON ea.branch_id = b.id
       WHERE e.user_id = $1 AND e.active = true
       LIMIT 1`,
      [user.id]
    );
    const employee = empRes.rows.length > 0 ? empRes.rows[0] : null;

    // Fetch branch access for managers/supervisors
    const branchAccessRes = await db.query(
      `SELECT branch_id FROM user_branch_access WHERE user_id = $1`,
      [user.id]
    );
    const branchAccess = branchAccessRes.rows.map(b => b.branch_id);

    return res.json({
      success: true,
      message: 'Login berhasil.',
      token: rawToken,
      user: {
        id: user.id,
        sessionId: sessionRes.rows[0].id,
        loginIdentifier: user.login_identifier,
        displayName: user.display_name || user.login_identifier,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        roles,
        isOwner: roles.includes('owner'),
        isManager: roles.includes('manager'),
        isSupervisor: roles.includes('supervisor'),
        isKaryawan: roles.includes('karyawan'),
        employeeId: employee ? employee.id : null,
        employeeCode: employee ? employee.employee_code : null,
        employeeName: employee ? employee.name : null,
        jobTitle: employee ? employee.job_title : null,
        assignedBranchId: employee ? employee.branch_id : null,
        assignedBranchName: employee ? employee.branch_name : null,
        accessibleBranchIds: branchAccess
      }
    });
  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat login.' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  try {
    if (req.user && req.user.sessionId) {
      await db.query(
        `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [req.user.sessionId]
      );
    }
    res.clearCookie('sultan_token');
    return res.json({ success: true, message: 'Logout berhasil.' });
  } catch (err) {
    console.error('[Logout Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal logout.' });
  }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

// POST /api/v1/auth/change-password (Mandiri perorangan)
router.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password, confirm_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ success: false, error: 'Password saat ini dan password baru wajib diisi.' });
  }

  if (new_password.trim().length < 6) {
    return res.status(400).json({ success: false, error: 'Password baru minimal harus 6 karakter.' });
  }

  if (confirm_password && new_password !== confirm_password) {
    return res.status(400).json({ success: false, error: 'Konfirmasi password baru tidak cocok.' });
  }

  try {
    const userRes = await db.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User tidak ditemukan.' });
    }

    const isMatch = await bcrypt.compare(current_password, userRes.rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Password saat ini tidak sesuai.' });
    }

    const newHash = await bcrypt.hash(new_password.trim(), 10);
    await db.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newHash, req.user.id]
    );

    await logAudit({
      actorId: req.user.id,
      action: 'CHANGE_PASSWORD',
      entityType: 'users',
      entityId: req.user.id,
      changes: { note: 'Pengguna mengubah password mandiri' },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Password berhasil diubah. Silakan gunakan password baru untuk login berikutnya.'
    });
  } catch (err) {
    console.error('[Change Password Error]', err);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat mengubah password.' });
  }
});

// POST /api/v1/auth/reset-password (Pengelola: Owner & Manager)
router.post('/reset-password', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { user_id, new_password } = req.body;

  if (!user_id) {
    return res.status(400).json({ success: false, error: 'ID user yang akan direset wajib disertakan.' });
  }

  const passToSet = (new_password && new_password.trim().length >= 6) ? new_password.trim() : 'sultan123';

  try {
    const targetRes = await db.query(
      `SELECT u.id, u.login_identifier, COALESCE(ARRAY_AGG(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = $1
       GROUP BY u.id, u.login_identifier`,
      [user_id]
    );

    if (targetRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Akun user target tidak ditemukan.' });
    }

    const targetUser = targetRes.rows[0];
    const targetRoles = targetUser.roles || [];

    // Authorization checks:
    // 1. Manager tidak boleh mereset password Owner
    if (targetRoles.includes('owner') && !req.user.isOwner) {
      return res.status(403).json({
        success: false,
        error: 'Akses ditolak. Hanya Owner yang berhak mereset password akun Owner.'
      });
    }

    // 2. Manager tidak boleh mereset sesama Manager
    if (targetRoles.includes('manager') && !req.user.isOwner && req.user.id !== targetUser.id) {
      return res.status(403).json({
        success: false,
        error: 'Akses ditolak. Hanya Owner yang berhak mereset password sesama Manager.'
      });
    }

    const newHash = await bcrypt.hash(passToSet, 10);
    await db.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newHash, targetUser.id]
    );

    // Invalidate active sessions target user
    await db.query(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`,
      [targetUser.id]
    );

    await logAudit({
      actorId: req.user.id,
      action: 'RESET_PASSWORD',
      entityType: 'users',
      entityId: targetUser.id,
      changes: {
        target_login: targetUser.login_identifier,
        reset_by: req.user.loginIdentifier
      },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: `Password akun "${targetUser.login_identifier}" berhasil direset menjadi "${passToSet}". Sesi login aktif telah dicabut.`
    });
  } catch (err) {
    console.error('[Reset Password Error]', err);
    return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat mereset password.' });
  }
});

module.exports = router;
