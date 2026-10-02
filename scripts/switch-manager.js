const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/sultan_arab_app'
});

async function main() {
  const managerRoleId = '11111111-1111-1111-1111-111111111102';
  const fahryUserId = 'dddddddd-dddd-dddd-dddd-dddddddd0001';
  const fauziUserId = 'dddddddd-dddd-dddd-dddd-dddddddd0002';
  const hqBranchId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const ckrBranchId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  // 1. Remove manager role from Fahry
  await pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [fahryUserId, managerRoleId]);
  await pool.query("UPDATE employees SET job_title = 'Staff Kantor' WHERE user_id = $1", [fahryUserId]);

  // 2. Add manager role to Fauzi
  await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fauziUserId, managerRoleId]);
  await pool.query("UPDATE employees SET job_title = 'Staff Kantor / Manager' WHERE user_id = $1", [fauziUserId]);

  // 3. Ensure branch access for Fauzi
  await pool.query('INSERT INTO user_branch_access (user_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fauziUserId, hqBranchId]);
  await pool.query('INSERT INTO user_branch_access (user_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fauziUserId, ckrBranchId]);

  console.log('Successfully switched manager to Fauzi in PostgreSQL database!');

  const check = await pool.query(`
    SELECT u.login_identifier, p.display_name, e.job_title, array_agg(r.code) as roles
    FROM users u
    JOIN profiles p ON p.id = u.id
    LEFT JOIN employees e ON e.user_id = u.id
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.login_identifier IN ('fahry', 'fauzi')
    GROUP BY u.login_identifier, p.display_name, e.job_title
  `);
  console.log('Current roles:', check.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
