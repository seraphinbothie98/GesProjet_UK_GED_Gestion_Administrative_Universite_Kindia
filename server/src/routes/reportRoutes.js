const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { buildABACDocumentFilter } = require('../middleware/abac');

// GET /api/reports/dashboard - Role-tailored dashboard metrics
router.get('/dashboard', authenticateToken, async (req, res) => {
  const user = req.user;

  try {
    const { sql: abacSql, params: abacParams } = buildABACDocumentFilter(user);

    // Document counters under ABAC (excluding TRASHED documents)
    const totalAccessible = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d WHERE d.status != 'TRASHED' AND ${abacSql}`,
      abacParams
    );

    const pendingDocs = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
       WHERE d.status IN ('PENDING', 'EN_ATTENTE', 'DEMANDE REÇUE', 'EN PRÉPARATION', 'EN ATTENTE DE SIGNATURE', 'ENREGISTRÉ', 'CREATED', 'DRAFT') 
         AND d.status != 'TRASHED' AND ${abacSql}`,
      abacParams
    );

    const inProgressDocs = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
       WHERE d.status IN ('IN_PROGRESS', 'EN_COURS', 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE') 
         AND d.status != 'TRASHED' AND ${abacSql}`,
      abacParams
    );

    const signedDocs = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
       WHERE d.status IN ('SIGNED', 'SIGNÉ', 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL', 'REMIS AU DEMANDEUR', 'REMIS AU MISSIONNAIRE', 'PRÊT POUR ARCHIVAGE DIRECT') 
         AND d.status != 'TRASHED' AND ${abacSql}`,
      abacParams
    );

    const archivedDocs = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
       WHERE d.status IN ('ARCHIVED', 'ARCHIVÉ') 
         AND d.status != 'TRASHED' AND ${abacSql}`,
      abacParams
    );

    // Overdue items
    const today = new Date().toISOString().split('T')[0];
    const overdueDocs = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
       WHERE d.deadline_date < ? 
         AND d.status NOT IN ('SIGNED', 'SIGNÉ', 'ARCHIVED', 'ARCHIVÉ', 'TRASHED', 'REMIS AU DEMANDEUR', 'REMIS AU MISSIONNAIRE') 
         AND d.status != 'TRASHED' 
         AND ${abacSql}`,
      [today, ...abacParams]
    );

    // System-wide admin counts if role is Admin
    let adminStats = null;
    if (user.role_code === 'ADMINISTRATEUR') {
      const userCount = await db.get('SELECT COUNT(*) as count FROM users');
      const serviceCount = await db.get('SELECT COUNT(*) as count FROM services WHERE status = "ACTIVE"');
      const auditCount = await db.get('SELECT COUNT(*) as count FROM audit_logs');
      adminStats = {
        total_users: userCount ? userCount.count : 0,
        active_services: serviceCount ? serviceCount.count : 0,
        audit_events: auditCount ? auditCount.count : 0
      };
    }

    // Generic Responsable Signature/Validation Stats for ANY logged in user/service head
    const docsToSignCount = await db.get(
      `SELECT COUNT(*) as count 
       FROM documents d 
       WHERE d.current_service_id = ? 
         AND d.is_locked = 0 
         AND d.status NOT IN ('SIGNÉ', 'SIGNED', 'ARCHIVED', 'ARCHIVÉ', 'TRASHED', 'ACCEPTED', 'ACCEPTE', 'REJECTED', 'REJETÉ', 'RETOURNÉ AU SECRÉTARIAT CENTRAL', 'REMIS AU DEMANDEUR', 'REMIS AU MISSIONNAIRE')`,
      [user.service_id]
    );

    const toSignCount = docsToSignCount ? docsToSignCount.count : 0;
    const sgStats = { missions_to_sign: toSignCount };

    // Secrétariat Central / Admin stats for incoming mission requests
    let scStats = null;
    if (user.role_code === 'ADMINISTRATEUR' || user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user.service_code === 'SC') {
      const pendingReqs = await db.get(
        `SELECT COUNT(*) as count FROM mission_order_requests WHERE status IN ('EN_ATTENTE_SC', 'DEMANDE ENREGISTRÉE', 'EN ATTENTE')`
      );
      scStats = {
        mission_requests_pending: pendingReqs ? pendingReqs.count : 0
      };
    }

    // Recent Activity (strictly excluding TRASHED documents)
    const recentActivity = await db.all(
      `SELECT DISTINCT d.id, d.reference, d.title, d.document_type, d.status, d.priority, d.created_at, d.updated_at,
              s.name as service_name
       FROM documents d
       JOIN services s ON d.current_service_id = s.id
       WHERE d.status != 'TRASHED' AND ${abacSql}
       ORDER BY d.updated_at DESC, d.id DESC
       LIMIT 8`,
      abacParams
    );

    // Appointment counters
    let apptWhere = 'WHERE (responsible_id = ? OR requester_id = ? OR ? = "ADMINISTRATEUR")';
    let apptParams = [user.id, user.id, user.role_code];
    const apptPending = await db.get(`SELECT COUNT(*) as count FROM appointments ${apptWhere} AND status = "EN_ATTENTE"`, apptParams);
    const apptConfirmed = await db.get(`SELECT COUNT(*) as count FROM appointments ${apptWhere} AND status IN ("CONFIRME", "ACCEPTE")`, apptParams);
    const apptToday = await db.get(`SELECT COUNT(*) as count FROM appointments ${apptWhere} AND requested_date = ?`, [...apptParams, today]);

    res.json({
      metrics: {
        total: totalAccessible ? totalAccessible.count : 0,
        pending: pendingDocs ? pendingDocs.count : 0,
        in_progress: inProgressDocs ? inProgressDocs.count : 0,
        signed: signedDocs ? signedDocs.count : 0,
        archived: archivedDocs ? archivedDocs.count : 0,
        overdue: overdueDocs ? overdueDocs.count : 0
      },
      appointments: {
        pending: apptPending ? apptPending.count : 0,
        confirmed: apptConfirmed ? apptConfirmed.count : 0,
        today: apptToday ? apptToday.count : 0
      },
      admin: adminStats,
      sg: sgStats,
      sc: scStats,
      to_sign_count: toSignCount,
      recent_activity: recentActivity || []
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Erreur lors du calcul du tableau de bord.' });
  }
});

module.exports = router;
