const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/sultan_arab_app'
});

async function main() {
  const q = async (label, sql) => {
    const r = await pool.query(sql);
    console.log(`\n== ${label} (${r.rowCount}) ==`);
    console.table(r.rows);
  };
  await q('branches', `SELECT id, code, name, is_test_data FROM branches ORDER BY code`);
  await q('employees', `SELECT id, employee_code, name, is_test_data FROM employees ORDER BY employee_code`);
  await q('users', `SELECT u.id, u.login_identifier, p.display_name FROM users u LEFT JOIN profiles p ON p.id=u.id ORDER BY 2`);
  await q('shifts', `SELECT id, name, start_time, end_time, is_test_data FROM shifts ORDER BY name`);
  await q('pay_components', `SELECT code, name FROM pay_components`);
  await q('payroll_periods', `SELECT id, label FROM payroll_periods`);
  await q('attendance_sessions count by test emp', `SELECT e.is_test_data, count(*) FROM attendance_sessions s JOIN employees e ON e.id=s.employee_id GROUP BY 1`);
  await q('restrict refs', `SELECT t, actor, count(*) FROM (
    SELECT 'adjust' t, actor_id::text actor FROM attendance_adjustments
    UNION ALL SELECT 'commission', entered_by::text FROM manual_commissions
    UNION ALL SELECT 'run_created', created_by::text FROM payroll_runs
    UNION ALL SELECT 'run_final', finalized_by::text FROM payroll_runs WHERE finalized_by IS NOT NULL) x GROUP BY 1,2`);
  await q('commissions', `SELECT e.name, c.amount, c.note FROM manual_commissions c JOIN employees e ON e.id=c.employee_id`);
  await q('payslips', `SELECT p.id, e.name, p.period_id, p.original_filename, p.pdf_path IS NOT NULL has_pdf, p.item_id IS NOT NULL has_item FROM payslips p LEFT JOIN employees e ON e.id=p.employee_id`);
  await q('days_off', `SELECT e.name, count(*) FROM days_off d JOIN employees e ON e.id=d.employee_id GROUP BY 1`);
  await q('audit', `SELECT count(*) FROM audit_logs`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
