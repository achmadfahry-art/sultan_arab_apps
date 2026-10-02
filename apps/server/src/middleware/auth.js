const crypto = require('crypto');
const db = require('../db');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function authenticate(req, res, next) {
  try {
    let token = req.cookies ? req.cookies.sultan_token : null;
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const tokenHash = hashToken(token);
    const sessionRes = await db.query(
      `SELECT s.id as session_id, s.user_id, s.expires_at,
              u.login_identifier, u.active as user_active,
              p.display_name, p.phone, p.avatar_url
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.id
       WHERE s.token_hash = $1 
         AND s.revoked_at IS NULL 
         AND s.expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );

    if (sessionRes.rows.length === 0) {
      req.user = null;
      return next();
    }

    const row = sessionRes.rows[0];
    if (!row.user_active) {
      req.user = null;
      return next();
    }

    // Fetch user roles
    const rolesRes = await db.query(
      `SELECT r.code 
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [row.user_id]
    );
    const roles = rolesRes.rows.map(r => r.code);

    // Fetch employee data if linked
    const empRes = await db.query(
      `SELECT e.id, e.employee_code, e.name, e.job_title,
              ea.branch_id, b.name as branch_name, b.code as branch_code
       FROM employees e
       LEFT JOIN employee_assignments ea ON e.id = ea.employee_id AND ea.is_primary = true
       LEFT JOIN branches b ON ea.branch_id = b.id
       WHERE e.user_id = $1 AND e.active = true
       LIMIT 1`,
      [row.user_id]
    );
    const employee = empRes.rows.length > 0 ? empRes.rows[0] : null;

    // Fetch branch access for managers/supervisors
    const branchAccessRes = await db.query(
      `SELECT branch_id FROM user_branch_access WHERE user_id = $1`,
      [row.user_id]
    );
    const branchAccess = branchAccessRes.rows.map(b => b.branch_id);

    req.user = {
      id: row.user_id,
      sessionId: row.session_id,
      loginIdentifier: row.login_identifier,
      displayName: row.display_name,
      phone: row.phone,
      avatarUrl: row.avatar_url,
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
    };

    next();
  } catch (err) {
    console.error('[Auth Error]', err);
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Harap login terlebih dahulu.',
      code: 'UNAUTHORIZED'
    });
  }
  next();
}

function requireRoles(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Harap login terlebih dahulu.' });
    }
    const hasRole = req.user.roles.some(r => allowedRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: 'Akses ditolak. Anda tidak memiliki wewenang untuk aksi ini.',
        code: 'FORBIDDEN'
      });
    }
    next();
  };
}

module.exports = {
  hashToken,
  authenticate,
  requireAuth,
  requireRoles
};
