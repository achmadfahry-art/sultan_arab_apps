const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { sendWhatsAppNotification, generateWhatsAppLink } = require('../utils/whatsapp');

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.resolve(__dirname, '../../../storage');
const PAYSLIPS_DIR = path.join(UPLOAD_ROOT, 'payslips');

if (!fs.existsSync(PAYSLIPS_DIR)) {
  fs.mkdirSync(PAYSLIPS_DIR, { recursive: true });
}

// Multer storage for PDF payslips
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const periodDir = path.join(PAYSLIPS_DIR, req.body.period_id || 'general');
    if (!fs.existsSync(periodDir)) {
      fs.mkdirSync(periodDir, { recursive: true });
    }
    cb(null, periodDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.body.employee_id || uuidv4()}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Hanya file PDF yang diizinkan untuk slip gaji.'));
    }
  }
});

// GET /api/v1/payroll/periods
router.get('/periods', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, start_date, end_date, label, status, created_at 
      FROM payroll_periods 
      ORDER BY start_date DESC;
    `);
    return res.json({ success: true, periods: result.rows });
  } catch (err) {
    console.error('[Payroll Periods Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil data periode payroll.' });
  }
});

// POST /api/v1/payroll/periods (Owner & Manager)
router.post('/periods', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { start_date, end_date, label } = req.body;
  if (!start_date || !end_date) {
    return res.status(400).json({ success: false, error: 'Tanggal mulai dan tanggal akhir wajib diisi.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO payroll_periods (start_date, end_date, label, status)
       VALUES ($1, $2, $3, 'draft')
       RETURNING *;`,
      [start_date, end_date, label || `Periode ${start_date} s.d. ${end_date}`]
    );

    await logAudit({
      actorId: req.user.id,
      action: 'CREATE_PAYROLL_PERIOD',
      entityType: 'payroll_periods',
      entityId: result.rows[0].id,
      changes: result.rows[0],
      ipAddress: req.ip
    });

    return res.status(201).json({ success: true, period: result.rows[0] });
  } catch (err) {
    console.error('[Create Period Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal membuat periode payroll.' });
  }
});

// GET /api/v1/payroll/components
router.get('/components', requireAuth, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM pay_components ORDER BY kind, name;`);
    return res.json({ success: true, components: result.rows });
  } catch (err) {
    console.error('[Components Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil komponen gaji.' });
  }
});

// GET /api/v1/payroll/commissions (Owner & Manager sesuai Q07)
router.get('/commissions', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { period_id, employee_id } = req.query;
  try {
    let query = `
      SELECT mc.id, mc.amount, mc.note, mc.created_at,
             e.id as employee_id, e.employee_code, e.name as employee_name,
             p.label as period_label,
             u.login_identifier as entered_by_username
      FROM manual_commissions mc
      JOIN employees e ON mc.employee_id = e.id
      JOIN payroll_periods p ON mc.period_id = p.id
      LEFT JOIN users u ON mc.entered_by = u.id
      WHERE 1=1
    `;
    const params = [];
    if (period_id) {
      params.push(period_id);
      query += ` AND mc.period_id = $${params.length}`;
    }
    if (employee_id) {
      params.push(employee_id);
      query += ` AND mc.employee_id = $${params.length}`;
    }
    query += ` ORDER BY mc.created_at DESC;`;

    const result = await db.query(query, params);
    return res.json({ success: true, commissions: result.rows });
  } catch (err) {
    console.error('[Get Commissions Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil data komisi manual.' });
  }
});

// POST /api/v1/payroll/commissions (Input Manual Komisi Sales - Owner & Manager sesuai Q07)
router.post('/commissions', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { employee_id, period_id, amount, note } = req.body;
  if (!employee_id || !period_id || amount === undefined) {
    return res.status(400).json({ success: false, error: 'Karyawan, periode, dan nominal komisi wajib diisi.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO manual_commissions (employee_id, period_id, amount, note, entered_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *;`,
      [employee_id, period_id, parseFloat(amount), note || 'Komisi sales toko', req.user.id]
    );

    await logAudit({
      actorId: req.user.id,
      action: 'INPUT_COMMISSION',
      entityType: 'manual_commissions',
      entityId: result.rows[0].id,
      changes: { employee_id, period_id, amount, note },
      ipAddress: req.ip
    });

    return res.status(201).json({ success: true, commission: result.rows[0] });
  } catch (err) {
    console.error('[Input Commission Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mencatat komisi: ' + err.message });
  }
});

// GET /api/v1/payroll/staff-slips (Daftar Seluruh Staf & Status Slip PDF untuk Manager & Owner - Sesuai Q06)
router.get('/staff-slips', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.id as employee_id, e.name as employee_name, e.employee_code, e.job_title,
             b.name as branch_name,
             p.phone,
             ps.id as payslip_id, ps.pdf_path, ps.original_filename, ps.file_size, ps.published_at, ps.notes as slip_notes,
             pp.label as period_label, pp.id as period_id
      FROM employees e
      LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
      LEFT JOIN branches b ON ea.branch_id = b.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.id
      LEFT JOIN LATERAL (
        SELECT * FROM payslips 
        WHERE employee_id = e.id 
        ORDER BY published_at DESC 
        LIMIT 1
      ) ps ON true
      LEFT JOIN payroll_periods pp ON ps.period_id = pp.id
      WHERE e.active = true
      ORDER BY b.name ASC, e.name ASC;
    `);

    const staffWithLinks = result.rows.map(row => {
      let waLink = null;
      if (row.phone) {
        const periodText = row.period_label || 'Bulan Ini';
        const msg = `Assalamu’alaikum ${row.employee_name},\nSlip gaji Anda untuk periode *${periodText}* telah diterbitkan oleh manajemen Sultan Arab. Silakan login ke aplikasi SULTAN ARAB APP (http://100.84.77.41:3000) untuk mengunduh slip PDF Anda.\nTerima kasih.`;
        waLink = generateWhatsAppLink(row.phone, msg);
      }
      return {
        ...row,
        whatsAppReminderLink: waLink
      };
    });

    return res.json({ success: true, staff: staffWithLinks });
  } catch (err) {
    console.error('[Staff Slips Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil daftar slip staf.' });
  }
});

// POST /api/v1/payroll/upload-slip (Upload Slip Gaji PDF oleh Manager/Owner - Sesuai Q06)
router.post('/upload-slip', requireAuth, requireRoles(['owner', 'manager']), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Berkas PDF slip gaji wajib diunggah.' });
  }

  let { employee_id, period_id, notes } = req.body;
  if (!period_id || period_id === 'auto') {
    const pRes = await db.query(`SELECT id FROM payroll_periods ORDER BY start_date DESC LIMIT 1`);
    if (pRes.rows.length > 0) {
      period_id = pRes.rows[0].id;
    }
  }

  if (!employee_id || !period_id) {
    // Hapus file yang terupload jika data kurang
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ success: false, error: 'Karyawan dan periode wajib dipilih.' });
  }

  try {
    const relativePath = path.relative(UPLOAD_ROOT, req.file.path).replace(/\\/g, '/');

    const result = await db.query(
      `INSERT INTO payslips 
       (employee_id, period_id, pdf_path, original_filename, file_size, storage_path, uploaded_by, notes, published_at)
       VALUES ($1, $2, $3, $4, $5, $3, $6, $7, CURRENT_TIMESTAMP)
       RETURNING *;`,
      [
        employee_id,
        period_id,
        relativePath,
        req.file.originalname,
        req.file.size,
        req.user.id,
        notes || 'Slip gaji resmi (PDF)'
      ]
    );

    const payslip = result.rows[0];

    // Ambil info karyawan untuk notifikasi WhatsApp (Q011)
    const empRes = await db.query(
      `SELECT e.name, p.phone, pp.label as period_label 
       FROM employees e 
       JOIN users u ON e.user_id = u.id 
       JOIN profiles p ON u.id = p.id
       JOIN payroll_periods pp ON pp.id = $2
       WHERE e.id = $1`,
      [employee_id, period_id]
    );

    let waLink = null;
    if (empRes.rows.length > 0 && empRes.rows[0].phone) {
      const emp = empRes.rows[0];
      const message = `Assalamu’alaikum ${emp.name},\nSlip gaji Anda untuk periode *${emp.period_label}* telah diterbitkan oleh manajemen Sultan Arab. Silakan login ke aplikasi SULTAN ARAB APP untuk mengunduh slip PDF Anda.\nTerima kasih.`;
      waLink = generateWhatsAppLink(emp.phone, message);
    }

    await logAudit({
      actorId: req.user.id,
      action: 'UPLOAD_PAYSLIP_PDF',
      entityType: 'payslips',
      entityId: payslip.id,
      changes: { employee_id, period_id, filename: req.file.originalname, size: req.file.size },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Berkas PDF slip gaji berhasil diunggah dan diterbitkan kepada karyawan.',
      payslip,
      whatsAppReminderLink: waLink
    });
  } catch (err) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('[Upload Payslip Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengunggah slip gaji: ' + err.message });
  }
});

// GET /api/v1/payroll/slips/:id/download (Unduh Berkas PDF)
router.get('/slips/:id/download', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const slipRes = await db.query(`SELECT * FROM payslips WHERE id = $1`, [id]);
    if (slipRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Slip gaji tidak ditemukan.' });
    }
    const slip = slipRes.rows[0];

    // Otorisasi: Karyawan hanya bisa unduh miliknya; Manager & Owner bebas
    if (!req.user.isOwner && !req.user.isManager && slip.employee_id !== req.user.employeeId) {
      return res.status(403).json({ success: false, error: 'Akses ditolak.' });
    }

    if (!slip.pdf_path) {
      return res.status(404).json({ success: false, error: 'File PDF tidak tersedia untuk slip ini.' });
    }

    const fullPath = path.join(UPLOAD_ROOT, slip.pdf_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: 'File fisik tidak ditemukan pada server.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${slip.original_filename || 'Slip_Gaji_Sultan_Arab.pdf'}"`);
    return fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error('[Download Slip Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengunduh slip gaji.' });
  }
});

// POST /api/v1/payroll/runs/calculate (Draft Payroll dengan Aturan Q05 & Q06)
router.post('/runs/calculate', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { period_id } = req.body;
  if (!period_id) {
    return res.status(400).json({ success: false, error: 'Periode payroll wajib dipilih.' });
  }

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const periodRes = await client.query(`SELECT * FROM payroll_periods WHERE id = $1`, [period_id]);
    if (periodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Periode tidak ditemukan.' });
    }
    const period = periodRes.rows[0];

    const prevRun = await client.query(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM payroll_runs WHERE period_id = $1`,
      [period_id]
    );
    const nextVersion = prevRun.rows[0].next_version;

    const runRes = await client.query(
      `INSERT INTO payroll_runs (period_id, version, status, created_by, notes)
       VALUES ($1, $2, 'draft', $3, 'Draft kalkulasi otomatis (Aturan Q05: Hadir dapat uang makan, kunjungan luar tidak dapat)')
       RETURNING *;`,
      [period_id, nextVersion, req.user.id]
    );
    const run = runRes.rows[0];

    const employeesRes = await client.query(`SELECT * FROM employees WHERE active = true ORDER BY name;`);
    const employees = employeesRes.rows;

    const itemsSummary = [];

    for (const emp of employees) {
      // 1. Hitung hari kehadiran yang berhak uang makan (Q05: Hadir toko dapat uang makan, Kunjungan luar TIDAK)
      const attHadirRes = await client.query(
        `SELECT COUNT(DISTINCT s.work_date) as total_hadir_uang_makan
         FROM attendance_sessions s
         WHERE s.employee_id = $1 
           AND s.work_date >= $2 
           AND s.work_date <= $3
           AND s.status IN ('present', 'late')
           AND s.is_meal_allowance_eligible = true
           AND (s.attendance_type IS NULL OR s.attendance_type = 'hadir')`,
        [emp.id, period.start_date, period.end_date]
      );
      const totalHadirUangMakan = parseInt(attHadirRes.rows[0].total_hadir_uang_makan || 0, 10);

      // Hitung total kunjungan luar
      const attKunjunganRes = await client.query(
        `SELECT COUNT(DISTINCT s.work_date) as total_kunjungan_luar
         FROM attendance_sessions s
         WHERE s.employee_id = $1 
           AND s.work_date >= $2 
           AND s.work_date <= $3
           AND s.attendance_type = 'kunjungan_luar'`,
        [emp.id, period.start_date, period.end_date]
      );
      const totalKunjunganLuar = parseInt(attKunjunganRes.rows[0].total_kunjungan_luar || 0, 10);

      // Komisi sales manual
      const commRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total_komisi
         FROM manual_commissions
         WHERE employee_id = $1 AND period_id = $2`,
        [emp.id, period_id]
      );
      const totalKomisi = parseFloat(commRes.rows[0].total_komisi || 0);

      // Kalkulasi
      const gapokNominal = 2500000; // Data uji acuan
      const uangMakanRate = 10000;
      const totalUangMakan = totalHadirUangMakan * uangMakanRate;

      let totalEarnings = gapokNominal + totalUangMakan + totalKomisi;
      let totalDeductions = 0;
      let netPay = totalEarnings - totalDeductions;

      const itemRes = await client.query(
        `INSERT INTO payroll_items (run_id, employee_id, earnings, deductions, net_pay, calculation_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id;`,
        [
          run.id,
          emp.id,
          totalEarnings,
          totalDeductions,
          netPay,
          JSON.stringify({
            employeeName: emp.name,
            totalHadirUangMakan,
            totalKunjunganLuar,
            uangMakanRate,
            totalUangMakan,
            totalKomisi,
            rules: 'Q05 Applied: Uang makan Rp10.000 hanya untuk absensi hadir'
          })
        ]
      );
      const itemId = itemRes.rows[0].id;

      // Lines
      await client.query(
        `INSERT INTO payroll_item_lines (item_id, name, kind, quantity, rate, amount, source_reference)
         VALUES 
         ($1, 'Gaji Pokok', 'earning', 1, $2, $2, 'Standar Gaji'),
         ($1, 'Uang Makan (Hadir Toko)', 'earning', $3, $4, $5, 'Kehadiran berhak uang makan (Q05)'),
         ($1, 'Komisi Sales Manual', 'earning', 1, $6, $6, 'Input Manual Manager')`,
        [itemId, gapokNominal, totalHadirUangMakan, uangMakanRate, totalUangMakan, totalKomisi]
      );

      itemsSummary.push({
        employeeId: emp.id,
        employeeName: emp.name,
        totalHadirUangMakan,
        totalKunjunganLuar,
        earnings: totalEarnings,
        netPay
      });
    }

    await client.query('COMMIT');

    await logAudit({
      actorId: req.user.id,
      action: 'CALCULATE_PAYROLL',
      entityType: 'payroll_runs',
      entityId: run.id,
      changes: { period_id, version: nextVersion, totalEmployees: employees.length },
      ipAddress: req.ip
    });

    return res.status(201).json({
      success: true,
      message: 'Draft kalkulasi payroll berhasil dibuat sesuai aturan kehadiran Q05.',
      run: {
        id: run.id,
        periodId: period_id,
        version: nextVersion,
        status: 'draft',
        items: itemsSummary
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Calculate Payroll Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal menghitung draft payroll: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/v1/payroll/runs
router.get('/runs', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT pr.id, pr.period_id, pr.version, pr.status, pr.created_at, pr.finalized_at,
             pp.label as period_label, pp.start_date, pp.end_date,
             u.login_identifier as created_by_user,
             COUNT(pi.id) as total_karyawan,
             COALESCE(SUM(pi.net_pay), 0) as total_net_pay
      FROM payroll_runs pr
      JOIN payroll_periods pp ON pr.period_id = pp.id
      LEFT JOIN users u ON pr.created_by = u.id
      LEFT JOIN payroll_items pi ON pr.id = pi.run_id
      GROUP BY pr.id, pp.id, u.login_identifier
      ORDER BY pr.created_at DESC;
    `);
    return res.json({ success: true, runs: result.rows });
  } catch (err) {
    console.error('[Get Runs Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil daftar proses payroll.' });
  }
});

// GET /api/v1/payroll/runs/:id
router.get('/runs/:id', requireAuth, requireRoles(['owner', 'manager']), async (req, res) => {
  const { id } = req.params;
  try {
    const runRes = await db.query(`
      SELECT pr.*, pp.label as period_label, pp.start_date, pp.end_date
      FROM payroll_runs pr
      JOIN payroll_periods pp ON pr.period_id = pp.id
      WHERE pr.id = $1;
    `, [id]);

    if (runRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payroll run tidak ditemukan.' });
    }

    const itemsRes = await db.query(`
      SELECT pi.id, pi.employee_id, pi.earnings, pi.deductions, pi.net_pay, pi.calculation_snapshot,
             e.name as employee_name, e.employee_code, e.job_title,
             b.name as branch_name
      FROM payroll_items pi
      JOIN employees e ON pi.employee_id = e.id
      LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
      LEFT JOIN branches b ON ea.branch_id = b.id
      WHERE pi.run_id = $1
      ORDER BY e.name ASC;
    `, [id]);

    return res.json({
      success: true,
      run: runRes.rows[0],
      items: itemsRes.rows
    });
  } catch (err) {
    console.error('[Run Detail Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil rincian payroll run.' });
  }
});

// POST /api/v1/payroll/runs/:id/finalize (Owner Only sesuai Q07)
router.post('/runs/:id/finalize', requireAuth, requireRoles(['owner']), async (req, res) => {
  const { id } = req.params;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const runRes = await client.query(`SELECT * FROM payroll_runs WHERE id = $1`, [id]);
    if (runRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Run tidak ditemukan.' });
    }

    await client.query(
      `UPDATE payroll_runs 
       SET status = 'published', finalized_at = CURRENT_TIMESTAMP, finalized_by = $1 
       WHERE id = $2`,
      [req.user.id, id]
    );

    const itemsRes = await client.query(`SELECT id, employee_id FROM payroll_items WHERE run_id = $1`, [id]);
    for (const item of itemsRes.rows) {
      const storagePath = `payslips/${runRes.rows[0].period_id}/${item.employee_id}.json`;
      await client.query(
        `INSERT INTO payslips (item_id, employee_id, period_id, storage_path, published_at, access_token)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
         ON CONFLICT DO NOTHING;`,
        [item.id, item.employee_id, runRes.rows[0].period_id, storagePath, uuidv4()]
      );
    }

    await client.query('COMMIT');

    await logAudit({
      actorId: req.user.id,
      action: 'FINALIZE_AND_PUBLISH_PAYROLL',
      entityType: 'payroll_runs',
      entityId: id,
      changes: { status: 'published', finalized_at: new Date() },
      ipAddress: req.ip
    });

    return res.json({
      success: true,
      message: 'Payroll berhasil difinalisasi dan slip gaji diterbitkan bagi seluruh karyawan.'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Finalize Payroll Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal memfinalisasi payroll: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/v1/payroll/me/payslips (Karyawan Slip Pribadi: PDF & Rincian)
router.get('/me/payslips', requireAuth, async (req, res) => {
  const employeeId = req.user.employeeId;
  if (!employeeId) {
    return res.json({ success: true, payslips: [] });
  }

  try {
    const result = await db.query(`
      SELECT ps.id, ps.id as payslip_id, ps.published_at, ps.pdf_path, ps.original_filename, ps.file_size, ps.notes as slip_notes,
             pi.id as item_id, pi.earnings, pi.deductions, pi.net_pay, pi.calculation_snapshot,
             pp.label as period_label, pp.start_date, pp.end_date,
             e.name as employee_name, e.employee_code, e.job_title
      FROM payslips ps
      LEFT JOIN payroll_items pi ON ps.item_id = pi.id
      JOIN payroll_periods pp ON ps.period_id = pp.id
      JOIN employees e ON ps.employee_id = e.id
      WHERE ps.employee_id = $1
      ORDER BY ps.published_at DESC;
    `, [employeeId]);

    return res.json({
      success: true,
      payslips: result.rows
    });
  } catch (err) {
    console.error('[Payslip Me Error]', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil slip gaji pribadi.' });
  }
});

module.exports = router;
