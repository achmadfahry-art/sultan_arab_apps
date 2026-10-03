const { Client } = require('pg');
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5433/sultan_arab_app';

async function verifyDatabase() {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('[Test DB] Terhubung ke database.');

    const expectedTables = [
      'users', 'sessions', 'profiles', 'roles', 'user_roles',
      'branches', 'user_branch_access', 'employees', 'employee_assignments',
      'shifts', 'work_schedules', 'days_off', 'attendance_sessions',
      'attendance_events', 'attendance_adjustments', 'payroll_periods',
      'pay_components', 'employee_pay_settings', 'manual_commissions',
      'payroll_runs', 'payroll_items', 'payroll_item_lines', 'payslips', 'audit_logs'
    ];

    console.log(`[Test DB] Memeriksa ${expectedTables.length} tabel wajib...`);
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    const existingTables = tablesRes.rows.map(r => r.table_name);

    const missingTables = expectedTables.filter(t => !existingTables.includes(t));
    if (missingTables.length > 0) {
      throw new Error(`Tabel hilang: ${missingTables.join(', ')}`);
    }
    console.log('[Test DB] Seluruh 24 tabel berhasil diverifikasi!');

    // Cek Role
    const rolesRes = await client.query(`SELECT code FROM roles ORDER BY code;`);
    const roleCodes = rolesRes.rows.map(r => r.code);
    console.log('[Test DB] Roles terdaftar:', roleCodes);
    if (!roleCodes.includes('owner') || !roleCodes.includes('karyawan')) {
      throw new Error('Role wajib tidak lengkap');
    }

    // Pastikan tidak ada data uji tersisa di data operasional
    const branchRes = await client.query(`SELECT name FROM branches WHERE active = true ORDER BY name;`);
    console.log('[Test DB] Cabang aktif:', branchRes.rows.map(b => b.name));
    if (branchRes.rows.length === 0) {
      throw new Error('Belum ada cabang aktif');
    }
    const leftover = await client.query(`
      SELECT 'branches' AS tabel, count(*)::int AS jumlah FROM branches WHERE is_test_data = true OR name ILIKE '%DATA UJI%'
      UNION ALL SELECT 'employees', count(*)::int FROM employees WHERE is_test_data = true OR name ILIKE '%DATA UJI%'
      UNION ALL SELECT 'shifts', count(*)::int FROM shifts WHERE is_test_data = true OR name ILIKE '%DATA UJI%'
      UNION ALL SELECT 'payroll_periods', count(*)::int FROM payroll_periods WHERE label ILIKE '%DATA UJI%'
      UNION ALL SELECT 'pay_components', count(*)::int FROM pay_components WHERE name ILIKE '%DATA UJI%'
      UNION ALL SELECT 'profiles', count(*)::int FROM profiles WHERE display_name ILIKE '%DATA UJI%';
    `);
    const dirty = leftover.rows.filter(r => r.jumlah > 0);
    if (dirty.length > 0) {
      throw new Error('Masih ada data uji: ' + dirty.map(r => `${r.tabel}=${r.jumlah}`).join(', '));
    }
    console.log('[Test DB] Tidak ada data uji tersisa di tabel operasional.');

    const siang = await client.query(`SELECT DISTINCT start_time::text, end_time::text FROM shifts WHERE name ILIKE 'Shift Siang%';`);
    if (siang.rows.some(r => r.start_time !== '12:00:00' || r.end_time !== '21:00:00')) {
      throw new Error('Shift Siang harus 12:00 - 21:00: ' + JSON.stringify(siang.rows));
    }
    console.log('[Test DB] Shift Siang terverifikasi 12:00 - 21:00.');

    console.log('[Test DB] PENGUJIAN DATABASE BERHASIL 100%!');
  } catch (err) {
    console.error('[Test DB GAGAL]', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyDatabase();
