const db = require('../database/db');
const { logAuditAction } = require('./audit');

/**
 * Generates SQL WHERE clause snippet and parameters to enforce ABAC Document & Archive Visibility.
 * Rule: STRICT DENY BY DEFAULT.
 * - Private archives of one department/service are NOT visible to other departments or automatically to SC.
 * - SC only sees documents produced by SC, transmitted to SC for archiving, or institutional acts.
 * - Faculty level can see scope 'FACULTE' from its child departments.
 */
function buildABACDocumentFilter(user) {
  const userRole = user.role_code;
  const userSId = Number(user.service_id) || -1;
  const userId = Number(user.id) || -1;

  // 0. ADMINISTRATOR FULL AUDIT & SUPERVISION ACCESS (Rule 16: No arbitrary service locking)
  if (userRole === 'ADMINISTRATEUR') {
    return {
      sql: '1=1',
      params: []
    };
  }

  const isSC = userRole === 'AGENT_SC' || userRole === 'AGENT_SECRÉTARIAT_CENTRAL' || user.service_code === 'SC';
  const isSG = userRole === 'SECRÉTAIRE_GÉNÉRAL' || user.service_code === 'SG';
  const isFacultyHead = user.function_title && (user.function_title.toLowerCase().includes('doyen') || user.function_title.toLowerCase().includes('vice-doyen'));

  // 1. ACTIVE / CIRCUIT DOCUMENTS ACCESS (When not archived)
  const activeCircuitClause = `(
    d.status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'TRASHED') AND (
      d.created_by = ${userId}
      OR d.current_service_id = ${userSId}
      OR d.current_user_id = ${userId}
      OR d.originating_service_id = ${userSId}
      ${isSG ? "OR d.document_type = 'MISSION_ORDER'" : ""}
      OR (d.authorized_signatory_role = '${userRole}')
      OR EXISTS (
        SELECT 1 FROM document_transfers dt 
        WHERE dt.document_id = d.id 
        AND (dt.from_service_id = ${userSId} OR dt.to_service_id = ${userSId} OR dt.from_user_id = ${userId} OR dt.to_user_id = ${userId})
      )
      OR EXISTS (
        SELECT 1 FROM dispatch_recipients dr 
        WHERE dr.document_id = d.id 
        AND dr.service_id = ${userSId}
        AND dr.tenant_id = 'UNIVERSITE_KINDIA'
      )
    )
  )`;

  // 2. ARCHIVED DOCUMENTS ACCESS (When status IN ('ARCHIVED', 'ARCHIVÉ'))
  // Rule: Strict isolated archive spaces
  let archiveClause = '';

  if (isSC) {
    // Secrétariat Central ONLY sees:
    // a) Documents produced/owned by SC
    // b) Documents transmitted to SC for central archiving
    // c) Central or Institutional documents
    // d) Explicitly shared in archive_shares
    archiveClause = `(
      d.status IN ('ARCHIVED', 'ARCHIVÉ') AND (
        d.owner_service_id = ${userSId}
        OR d.originating_service_id = ${userSId}
        OR d.created_by = ${userId}
        OR d.is_central_archived = 1
        OR d.transmitted_to_sc_for_archive = 1
        OR d.archive_scope IN ('CENTRAL', 'INSTITUTIONNEL')
        OR EXISTS (
          SELECT 1 FROM archive_shares ash 
          WHERE ash.document_id = d.id AND ash.target_service_id = ${userSId}
        )
      )
    )`;
  } else {
    // Other Services / Departments / Faculties:
    // a) Documents owned by their service
    // b) Documents produced by their service
    // c) Documents created by the user
    // d) Institutional documents (archive_scope = 'INSTITUTIONNEL')
    // e) Faculty scope: if user is in faculty, can see child department archives with scope 'FACULTE'
    // f) Explicitly shared in archive_shares
    archiveClause = `(
      d.status IN ('ARCHIVED', 'ARCHIVÉ') AND (
        d.owner_service_id = ${userSId}
        OR d.originating_service_id = ${userSId}
        OR d.created_by = ${userId}
        OR d.archive_scope = 'INSTITUTIONNEL'
        ${isFacultyHead ? `OR (
          d.archive_scope = 'FACULTE' AND EXISTS (
            SELECT 1 FROM services child_s WHERE child_s.id = d.owner_service_id AND child_s.parent_id = ${userSId}
          )
        )` : ''}
        OR EXISTS (
          SELECT 1 FROM archive_shares ash 
          WHERE ash.document_id = d.id AND ash.target_service_id = ${userSId}
        )
      )
    )`;
  }

  // 0. INTER-SERVICE CONFIDENTIAL TRANSMISSIONS (Strict Closed Circuit)
  const interServiceClause = `(
    d.is_inter_service_transmission = 1 AND EXISTS (
      SELECT 1 FROM service_transmissions st 
      WHERE st.document_id = d.id 
      AND (st.from_service_id = ${userSId} OR st.to_service_id = ${userSId})
    )
  )`;

  const combinedSql = `(
    ${interServiceClause} 
    OR (
      COALESCE(d.is_inter_service_transmission, 0) = 0 
      AND (${activeCircuitClause} OR ${archiveClause})
    )
  )`;

  return {
    sql: combinedSql,
    params: []
  };
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

    // System administrator has administrative audit access
    if (user.role_code === 'ADMINISTRATEUR') {
      req.document = doc;
      if (doc.status === 'ARCHIVED' || doc.status === 'ARCHIVÉ') {
        await logAuditAction(user.id, 'ADMIN_ACCESS_ARCHIVE', 'DOCUMENT', docId, req, {
          reference: doc.reference,
          owner_service_id: doc.owner_service_id,
          archive_scope: doc.archive_scope
        });
      }
      return next();
    }

    const { sql } = buildABACDocumentFilter(user);
    const accessible = await db.get(
      `SELECT d.id FROM documents d WHERE d.id = ? AND ${sql}`,
      [docId]
    );

    if (!accessible) {
      // Audit security rejection
      await logAuditAction(user.id, 'SECURITY_DENIED_ACCESS', 'DOCUMENT', docId, req, {
        reference: doc.reference,
        status: doc.status,
        owner_service_id: doc.owner_service_id,
        user_service_id: user.service_id
      });

      return res.status(403).json({
        error: 'ACCÈS REFUSÉ (Deny by Default) : Ce document ou cette archive ne relève pas du périmètre autorisé de votre service.'
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
