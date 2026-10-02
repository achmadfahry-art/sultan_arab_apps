const db = require('../db');

async function logAudit({ actorId, action, entityType, entityId, changes, ipAddress }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorId || null, action, entityType, entityId ? String(entityId) : null, changes ? JSON.stringify(changes) : null, ipAddress || null]
    );
  } catch (err) {
    console.error('[Audit Log Error]', err.message);
  }
}

module.exports = { logAudit };
