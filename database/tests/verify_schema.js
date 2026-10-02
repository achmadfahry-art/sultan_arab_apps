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

    // Cek Data Uji Cabang & Karyawan
    const branchRes = await client.query(`SELECT name, is_test_data FROM branches;`);
    console.log('[Test DB] Cabang ditemukan:', branchRes.rows);
    if (branchRes.rows.some(b => !b.is_test_data)) {
      console.warn('[Peringatan] Ada cabang tanpa penanda data uji');
    }

    console.log('[Test DB] PENGUJIAN DATABASE BERHASIL 100%!');
  } catch (err) {
    console.error('[Test DB GAGAL]', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyDatabase();
