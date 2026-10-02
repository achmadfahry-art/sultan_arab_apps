const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { hashToken, requireAuth } = require('../middleware/auth');
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

    return res.json({
      success: true,
      message: 'Login berhasil.',
      token: rawToken,
      user: {
        id: user.id,
        loginIdentifier: user.login_identifier,
        displayName: user.display_name || user.login_identifier,
        roles
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

module.exports = router;
