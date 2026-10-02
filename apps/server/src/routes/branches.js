const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// GET /api/v1/branches
router.get('/', requireAuth, async (req, res) => {
  try {
    let query = `SELECT id, code, name, timezone, latitude, longitude, radius_m, address, active, is_test_data FROM branches WHERE active = true`;
    const params = [];

    // Jika bukan owner, batasi ke cabang yang diizinkan jika terdaftar
    if (!req.user.isOwner && req.user.accessibleBranchIds && req.user.accessibleBranchIds.length > 0) {
      query += ` AND id = ANY($1)`;
      params.push(req.user.accessibleBranchIds);
    }

    query += ` ORDER BY name ASC;`;
    const result = await db.query(query, params);

    return res.json({
      success: true,
      branches: result.rows
    });
  } catch (err) {
    console.error('[Branches Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil data cabang.' });
  }
});

// POST /api/v1/branches (Owner & Manager only)
router.post('/', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { code, name, timezone, latitude, longitude, radius_m, address, is_test_data } = req.body;
  if (!code || !name) {
    return res.status(400).json({ success: false, error: 'Kode dan nama cabang wajib diisi.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO branches (code, name, timezone, latitude, longitude, radius_m, address, is_test_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *;`,
      [
        code.trim().toUpperCase(),
        name.trim(),
        timezone || 'Asia/Jakarta',
        latitude || null,
        longitude || null,
        radius_m || 100,
        address || '',
        is_test_data !== undefined ? is_test_data : true
      ]
    );

    const newBranch = result.rows[0];
    await logAudit({
      actorId: req.user.id,
      action: 'CREATE_BRANCH',
      entityType: 'branches',
      entityId: newBranch.id,
      changes: newBranch,
      ipAddress: req.ip
    });

    return res.status(201).json({ success: true, branch: newBranch });
  } catch (err) {
    console.error('[Create Branch Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal membuat cabang baru: ' + err.message });
  }
});

module.exports = router;
