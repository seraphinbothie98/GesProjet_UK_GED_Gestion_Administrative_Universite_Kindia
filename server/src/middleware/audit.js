const db = require('../database/db');

/**
 * Logs important actions into the immutable audit_logs table
 */
async function logAuditAction(userId, action, entityType, entityId, req, metadata = {}) {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1') : 'SYSTEM';
    await db.run(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || null, action, entityType, entityId || null, ipAddress, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('Audit logging error:', err);
  }
}

module.exports = { logAuditAction };
