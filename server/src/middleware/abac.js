const db = require('../database/db');

/**
 * Generates SQL WHERE clause snippet and parameters to enforce ABAC Document Visibility Rule (Section 3).
 * Rule: High rank DOES NOT automatically grant visibility unless the document was transmitted/oriented to that service/user, created by them, or involved in transfer history.
 */
function buildABACDocumentFilter(user) {
  // Administrateur, Secrétariat Central (SC) or users with central archive permissions get full registry/archive access
  const isCentralAdminOrSC = 
    user.role_code === 'ADMINISTRATEUR' || 
    user.role_code === 'AGENT_SC' || 
    user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || 
    user.service_code === 'SC' ||
    (user.permissions && (user.permissions.includes('archives.view') || user.permissions.includes('documents.archive_direct')));

  if (isCentralAdminOrSC) {
    return {
      sql: '1=1',
      params: []
    };
  }

  const isExecutiveSigner = 
    user.role_code === 'SECRÉTAIRE_GÉNÉRAL' || 
    user.role_code === 'RECTEUR' ||
    (user.permissions && user.permissions.includes('mission.sign'));

  const sql = `(
    d.created_by = ? 
    OR d.current_service_id = ? 
    OR d.current_user_id = ?
    OR d.status = 'ARCHIVED'
    ${isExecutiveSigner ? "OR d.document_type = 'MISSION_ORDER'" : ""}
    OR EXISTS (
      SELECT 1 FROM document_transfers dt 
      WHERE dt.document_id = d.id 
      AND (dt.from_service_id = ? OR dt.to_service_id = ? OR dt.from_user_id = ? OR dt.to_user_id = ?)
    )
    OR EXISTS (
      SELECT 1 FROM dispatch_recipients dr 
      WHERE dr.document_id = d.id 
      AND dr.service_id = ?
      AND dr.tenant_id = 'UNIVERSITE_KINDIA'
    )
  )`;

  const params = [
    user.id,
    user.service_id || -1,
    user.id,
    user.service_id || -1,
    user.service_id || -1,
    user.id,
    user.id,
    user.service_id || -1
  ];

  return { sql, params };
}

/**
 * Middleware checking document single access by ID with ABAC enforcement
 */
async function verifyDocumentAccess(req, res, next) {
  const docId = req.params.id || req.params.documentId;
  const user = req.user;

  if (!docId) {
    return res.status(400).json({ error: 'ID du document manquant.' });
  }

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) {
      return res.status(404).json({ error: 'Document non trouvé.' });
    }

    if (user.role_code === 'ADMINISTRATEUR') {
      req.document = doc;
      return next();
    }

    const { sql, params } = buildABACDocumentFilter(user);
    const accessible = await db.get(
      `SELECT d.id FROM documents d WHERE d.id = ? AND ${sql}`,
      [docId, ...params]
    );

    if (!accessible) {
      return res.status(403).json({
        error: 'Accès refusé. Ce document n’a pas été transmis à votre service et vous n’y avez pas accès.'
      });
    }

    req.document = doc;
    next();
  } catch (err) {
    console.error('ABAC verification error:', err);
    res.status(500).json({ error: 'Erreur lors du contrôle de sécurité ABAC.' });
  }
}

module.exports = { buildABACDocumentFilter, verifyDocumentAccess };
