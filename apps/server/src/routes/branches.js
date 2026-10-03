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
  const { code, name, timezone, latitude, longitude, radius_m, address } = req.body;
  if (!code || !String(code).trim() || !name || !String(name).trim()) {
    return res.status(400).json({ success: false, error: 'Kode dan nama cabang wajib diisi.' });
  }

  const lat = latitude === '' || latitude === null || latitude === undefined ? null : Number(latitude);
  const lon = longitude === '' || longitude === null || longitude === undefined ? null : Number(longitude);
  if ((lat === null) !== (lon === null)) {
    return res.status(400).json({ success: false, error: 'Latitude dan longitude harus diisi berpasangan.' });
  }
  if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180)) {
    return res.status(400).json({ success: false, error: 'Koordinat tidak valid. Latitude -90..90, longitude -180..180.' });
  }
  const radius = radius_m === '' || radius_m === undefined || radius_m === null ? 150 : parseInt(radius_m, 10);
  if (!Number.isInteger(radius) || radius < 10 || radius > 5000) {
    return res.status(400).json({ success: false, error: 'Radius harus antara 10 dan 5000 meter.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO branches (code, name, timezone, latitude, longitude, radius_m, address, is_test_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING *;`,
      [
        String(code).trim().toUpperCase(),
        String(name).trim(),
        timezone || 'Asia/Jakarta',
        lat,
        lon,
        radius,
        address ? String(address).trim() : ''
      ]
    );
    const newBranch = result.rows[0];

    // Shift Crew Toko resmi (Q02) otomatis tersedia di cabang baru.
    await client.query(
      `INSERT INTO shifts (branch_id, name, start_time, end_time, crosses_midnight, is_test_data) VALUES
       ($1, 'Shift Pagi (Crew Toko)', '08:00:00', '17:00:00', false, false),
       ($1, 'Shift Siang (Crew Toko)', '12:00:00', '21:00:00', false, false);`,
      [newBranch.id]
    );

    // Pengelola pembuat cabang langsung mendapat akses ke cabang tersebut.
    await client.query(
      `INSERT INTO user_branch_access (user_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [req.user.id, newBranch.id]
    );
    await client.query('COMMIT');

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
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Kode cabang sudah digunakan. Gunakan kode lain.' });
    }
    console.error('[Create Branch Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal membuat cabang baru.' });
  } finally {
    client.release();
  }
});

module.exports = router;
