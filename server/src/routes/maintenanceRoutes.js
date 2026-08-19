const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR } = require('../config/constants');

// Middleware to ensure user is System Administrator (Section 14)
function requireSystemAdmin(req, res, next) {
  if (!req.user || req.user.role_code !== 'ADMINISTRATEUR') {
    return res.status(403).json({
      error: "ACCÈS REFUSÉ : Cette opération d’administration avancée est réservée exclusivement à l'Administrateur Système."
    });
  }
  next();
}

// GET /api/admin/maintenance/status - Fetch Database Maintenance Status & Counts (Section 8, 10, 11)
router.get('/status', authenticateToken, requireSystemAdmin, async (req, res) => {
  try {
    const [
      incoming, outgoing, missions, archived, trashed, attachments, history, appointments,
      users, services, roles, permissions, signatures, settings, templates
    ] = await Promise.all([
      db.get("SELECT COUNT(*) as count FROM documents WHERE document_type = 'INCOMING_MAIL' AND status != 'TRASHED'"),
      db.get("SELECT COUNT(*) as count FROM documents WHERE document_type = 'OUTGOING_MAIL' AND status != 'TRASHED'"),
      db.get("SELECT COUNT(*) as count FROM documents WHERE document_type = 'MISSION_ORDER' AND status != 'TRASHED'"),
      db.get("SELECT COUNT(*) as count FROM documents WHERE status IN ('ARCHIVED', 'ARCHIVÉ') AND status != 'TRASHED'"),
      db.get("SELECT COUNT(*) as count FROM documents WHERE status = 'TRASHED'"),
      db.get("SELECT COUNT(*) as count FROM attachments"),
      db.get("SELECT COUNT(*) as count FROM document_history"),
      db.get("SELECT COUNT(*) as count FROM appointments"),
      db.get("SELECT COUNT(*) as count FROM users"),
      db.get("SELECT COUNT(*) as count FROM services"),
      db.get("SELECT COUNT(*) as count FROM roles"),
      db.get("SELECT COUNT(*) as count FROM permissions"),
      db.get("SELECT COUNT(*) as count FROM user_signatures"),
      db.get("SELECT COUNT(*) as count FROM institution_settings"),
      db.get("SELECT COUNT(*) as count FROM document_templates")
    ]);

    const env = process.env.NODE_ENV || 'development';

    res.json({
      environment: env,
      is_production: env === 'production',
      counts: {
        incoming: incoming?.count || 0,
        outgoing: outgoing?.count || 0,
        missions: missions?.count || 0,
        archived: archived?.count || 0,
        trashed: trashed?.count || 0,
        attachments: attachments?.count || 0,
        history: history?.count || 0,
        appointments: appointments?.count || 0
      },
      protected_counts: {
        users: users?.count || 0,
        services: services?.count || 0,
        roles: roles?.count || 0,
        permissions: permissions?.count || 0,
        signatures: signatures?.count || 0,
        settings: settings?.count || 0,
        templates: templates?.count || 0
      }
    });
  } catch (err) {
    console.error('Fetch maintenance status error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du statut de maintenance.' });
  }
});

// POST /api/admin/maintenance/backup - Create JSON Database Backup Snapshot (Section 12)
router.post('/backup', authenticateToken, requireSystemAdmin, async (req, res) => {
  try {
    const [
      documents, attachments, transfers, history, auditLogs,
      users, services, settings, templates
    ] = await Promise.all([
      db.all("SELECT * FROM documents"),
      db.all("SELECT * FROM attachments"),
      db.all("SELECT * FROM document_transfers"),
      db.all("SELECT * FROM document_history"),
      db.all("SELECT * FROM audit_logs"),
      db.all("SELECT id, matricule, first_name, last_name, email, phone, function_title, personnel_category, academic_structure, service_id, role_id, status FROM users"),
      db.all("SELECT * FROM services"),
      db.all("SELECT * FROM institution_settings"),
      db.all("SELECT * FROM document_templates")
    ]);

    const backupPayload = {
      app: 'UK-GED Kindia',
      created_at: new Date().toISOString(),
      created_by: `${req.user.first_name} ${req.user.last_name} (${req.user.email})`,
      environment: process.env.NODE_ENV || 'development',
      data: {
        documents,
        attachments,
        transfers,
        history,
        auditLogs,
        users,
        services,
        settings,
        templates
      }
    };

    await logAuditAction(req.user.id, 'CREATE_DATABASE_BACKUP', 'SYSTEM', 1, req, { backup_timestamp: backupPayload.created_at });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="uk_ged_backup_${Date.now()}.json"`);
    res.send(JSON.stringify(backupPayload, null, 2));
  } catch (err) {
    console.error('Database backup error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la sauvegarde.' });
  }
});

// POST /api/admin/maintenance/cleanup - Perform Selective Test Data Cleanup (Section 8, 9, 10, 11, 12)
router.post('/cleanup', authenticateToken, requireSystemAdmin, async (req, res) => {
  const { 
    confirmText, reason,
    clean_incoming_test, clean_outgoing_test, clean_missions_test,
    clean_archived_test, clean_trashed_test, clean_attachments_test, clean_history_test,
    clean_notifications_test, clean_appointments_test
  } = req.body;

  if (confirmText !== 'NETTOYER') {
    return res.status(400).json({
      error: 'Veuillez saisir exactement "NETTOYER" pour confirmer le nettoyage des données.'
    });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({
      error: 'Le motif du nettoyage est obligatoire pour le journal d’audit.'
    });
  }

  try {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      return res.status(403).json({
        error: '⚠️ OPÉRATION BLOQUÉE : Le nettoyage massif des données de test est strictement désactivé en environnement de PRODUCTION.'
      });
    }

    let deletedDocsCount = 0;
    let deletedFilesCount = 0;

    // Collect document IDs to clean based on selections
    let docTypesToClean = [];
    if (clean_incoming_test) docTypesToClean.push("'INCOMING_MAIL'", "'COURRIER_ENTRANT'");
    if (clean_outgoing_test) docTypesToClean.push("'OUTGOING_MAIL'", "'SOIT_TRANSMIS'", "'COURRIER_SORTANT'", "'DECRET'", "'ARRETE'", "'NOTE_SERVICE'", "'DECISION'", "'CIRCULAIRE'", "'PROCES_VERBAL'");
    if (clean_missions_test) docTypesToClean.push("'MISSION_ORDER'");

    let whereConditions = [];
    if (docTypesToClean.length > 0) whereConditions.push(`document_type IN (${docTypesToClean.join(',')})`);
    if (clean_archived_test) whereConditions.push(`status IN ('ARCHIVED', 'ARCHIVÉ', 'PRÊT POUR ARCHIVAGE DIRECT')`);
    if (clean_trashed_test) whereConditions.push(`status = 'TRASHED'`);

    if (whereConditions.length > 0) {
      const targetDocs = await db.all(`SELECT id FROM documents WHERE ${whereConditions.join(' OR ')}`);
      const targetIds = targetDocs.map(d => d.id);

      if (targetIds.length > 0) {
        // Delete physical attachment files for target documents
        const atts = await db.all(`SELECT file_path FROM attachments WHERE document_id IN (${targetIds.join(',')})`);
        for (const att of atts) {
          if (att.file_path) {
            const fullPath = path.join(UPLOAD_DIR, path.basename(att.file_path));
            if (fs.existsSync(fullPath)) {
              try { fs.unlinkSync(fullPath); deletedFilesCount++; } catch (e) {}
            }
          }
        }

        // Delete database extension records
        await db.run(`DELETE FROM attachments WHERE document_id IN (${targetIds.join(',')})`);
        await db.run(`DELETE FROM incoming_mails WHERE document_id IN (${targetIds.join(',')})`);
        await db.run(`DELETE FROM outgoing_mails WHERE document_id IN (${targetIds.join(',')})`);
        await db.run(`DELETE FROM mission_orders WHERE document_id IN (${targetIds.join(',')})`);
        await db.run(`DELETE FROM document_transfers WHERE document_id IN (${targetIds.join(',')})`);
        await db.run(`DELETE FROM document_history WHERE document_id IN (${targetIds.join(',')})`);
        await db.run(`DELETE FROM signatures WHERE document_id IN (${targetIds.join(',')})`);
        await db.run(`DELETE FROM notifications WHERE document_id IN (${targetIds.join(',')})`);
        await db.run(`UPDATE mission_order_requests SET official_document_id = NULL WHERE official_document_id IN (${targetIds.join(',')})`);
        const delResult = await db.run(`DELETE FROM documents WHERE id IN (${targetIds.join(',')})`);
        deletedDocsCount = delResult.changes || 0;
      }
    }

    if (clean_missions_test) {
      await db.run("DELETE FROM mission_order_request_attachments");
      await db.run("DELETE FROM mission_order_request_history");
      await db.run("DELETE FROM mission_order_requests");
      await db.run("DELETE FROM external_missionary_history");
      await db.run("DELETE FROM external_missionaries");
    }

    if (clean_archived_test) {
      await db.run("DELETE FROM external_missionary_history WHERE missionary_id IN (SELECT id FROM external_missionaries WHERE status IN ('ARCHIVÉ', 'ARCHIVED'))");
      await db.run("DELETE FROM external_missionaries WHERE status IN ('ARCHIVÉ', 'ARCHIVED')");
    }

    if (clean_history_test) {
      await db.run("DELETE FROM document_history");
      await db.run("DELETE FROM external_missionary_history");
    }

    if (clean_notifications_test) {
      await db.run("DELETE FROM notifications");
    }

    if (clean_appointments_test) {
      await db.run("DELETE FROM appointment_history");
      await db.run("DELETE FROM appointments");
    }

    await logAuditAction(req.user.id, 'NETTOYAGE_DONNÉES_TEST', 'MAINTENANCE', 1, req, {
      reason,
      deleted_documents: deletedDocsCount,
      deleted_files: deletedFilesCount,
      options: { clean_incoming_test, clean_outgoing_test, clean_missions_test, clean_archived_test, clean_trashed_test, clean_attachments_test, clean_notifications_test, clean_history_test, clean_appointments_test }
    });

    res.json({
      success: true,
      message: `Nettoyage des données de test réussi. ${deletedDocsCount} document(s) et ${deletedFilesCount} fichier(s) physique(s) supprimés.`,
      deleted_documents: deletedDocsCount,
      deleted_files: deletedFilesCount
    });
  } catch (err) {
    console.error('Cleanup test data error:', err);
    res.status(500).json({ error: 'Erreur lors du nettoyage de la base de données.' });
  }
});

module.exports = router;
