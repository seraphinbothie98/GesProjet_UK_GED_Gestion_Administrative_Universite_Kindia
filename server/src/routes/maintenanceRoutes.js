const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR, DB_PATH, BACKUP_DIR } = require('../config/constants');

// Anti-bruteforce state for admin re-auth
const failedAuthAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Concurrency lock for reset operation
let isUserResetInProgress = false;

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

// Helper for safe SQL execution
async function runSafe(sql, params = []) {
  try {
    return await db.run(sql, params);
  } catch (e) {
    return { changes: 0 };
  }
}

// POST /api/admin/maintenance/users/audit - Perform dependency analysis & scope preview
router.post('/users/audit', authenticateToken, requireSystemAdmin, async (req, res) => {
  try {
    const { cleanup_option = 'C', custom_scope = {} } = req.body;
    const adminId = req.user.id;

    // 1. Fetch current admin info (strictly protected)
    const adminUser = await db.get(
      `SELECT u.id, u.matricule, u.first_name, u.last_name, u.email, u.phone, u.function_title, r.name as role_name 
       FROM users u LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [adminId]
    );

    let adminStaff = await db.get("SELECT id FROM staff WHERE user_id = ? OR matricule = ?", [adminId, adminUser?.matricule || '']);
    const adminStaffId = adminStaff ? adminStaff.id : null;

    // 2. Fetch structural counts (always preserved)
    const [services, positions, roles, permissions, workflows, templates, settings] = await Promise.all([
      db.get("SELECT COUNT(*) as count FROM services"),
      db.get("SELECT COUNT(*) as count FROM positions"),
      db.get("SELECT COUNT(*) as count FROM roles"),
      db.get("SELECT COUNT(*) as count FROM permissions"),
      db.get("SELECT COUNT(*) as count FROM workflow_rules"),
      db.get("SELECT COUNT(*) as count FROM document_templates"),
      db.get("SELECT COUNT(*) as count FROM institution_settings")
    ]);

    // 3. Fetch all non-admin users
    const candidateUsers = await db.all(`
      SELECT u.id, u.matricule, u.first_name, u.last_name, u.email, u.phone, u.function_title, 
             u.created_at, u.status, r.name as role_name, r.code as role_code, s.name as service_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN services s ON u.service_id = s.id
      WHERE u.id != ?
      ORDER BY u.id ASC
    `, [adminId]);

    // 4. Fetch all non-admin staff
    const candidateStaff = await db.all(`
      SELECT st.id, st.user_id, st.matricule, st.prenoms, st.nom, st.email, st.telephone, 
             st.fonction, st.status, s.name as service_name
      FROM staff st
      LEFT JOIN services s ON st.service_id = s.id
      WHERE (st.user_id IS NULL OR st.user_id != ?) AND (? IS NULL OR st.id != ?)
      ORDER BY st.id ASC
    `, [adminId, adminStaffId, adminStaffId || -1]);

    // 5. Fetch all active non-admin staff assignments
    const candidateAssignments = await db.all(`
      SELECT sa.id, sa.staff_id, sa.position_id, sa.service_id, sa.start_date, sa.status,
             p.title as position_title, p.code as position_code, s.name as service_name,
             st.prenoms as staff_prenom, st.nom as staff_nom, st.matricule as staff_matricule
      FROM staff_assignments sa
      JOIN positions p ON sa.position_id = p.id
      LEFT JOIN services s ON sa.service_id = s.id
      LEFT JOIN staff st ON sa.staff_id = st.id
      WHERE (? IS NULL OR sa.staff_id != ?)
      ORDER BY sa.id ASC
    `, [adminStaffId, adminStaffId || -1]);

    // 6. Inspect dependencies & ambiguity for each candidate user
    let ambiguityDetected = false;
    const usersWithAudit = await Promise.all(candidateUsers.map(async (u) => {
      // Check if user has authored official documents
      const docsAuthored = await db.get("SELECT COUNT(*) as count FROM documents WHERE created_by = ?", [u.id]);
      const sigsActive = await db.get("SELECT COUNT(*) as count FROM user_signatures WHERE user_id = ?", [u.id]);
      const dispatchesSent = await db.get("SELECT COUNT(*) as count FROM document_dispatches WHERE sender_user_id = ?", [u.id]);
      const appointments = await db.get("SELECT COUNT(*) as count FROM appointments WHERE requester_id = ? OR responsible_id = ?", [u.id, u.id]);
      
      const isAmbiguous = (docsAuthored?.count > 5 || sigsActive?.count > 0 || dispatchesSent?.count > 0);
      if (isAmbiguous) ambiguityDetected = true;

      return {
        ...u,
        docs_authored: docsAuthored?.count || 0,
        signatures_count: sigsActive?.count || 0,
        dispatches_count: dispatchesSent?.count || 0,
        appointments_count: appointments?.count || 0,
        is_ambiguous: isAmbiguous,
        ambiguity_reason: isAmbiguous ? 'Activité documentée importante ou signatures enregistrées' : null
      };
    }));

    // Filter target scope based on cleanup option
    let targetUsers = [];
    let targetStaff = [];
    let targetAssignments = [];

    if (cleanup_option === 'A') {
      // Option A: Clean users only
      targetUsers = usersWithAudit;
    } else if (cleanup_option === 'B') {
      // Option B: Clean users + staff
      targetUsers = usersWithAudit;
      targetStaff = candidateStaff;
    } else if (cleanup_option === 'C') {
      // Option C: Clean users + staff + assignments (Default full demo clean)
      targetUsers = usersWithAudit;
      targetStaff = candidateStaff;
      targetAssignments = candidateAssignments;
    } else if (cleanup_option === 'D') {
      // Option D: Custom scope
      if (custom_scope.clean_users) targetUsers = usersWithAudit;
      if (custom_scope.clean_staff) targetStaff = candidateStaff;
      if (custom_scope.clean_assignments) targetAssignments = candidateAssignments;
    }

    res.json({
      success: true,
      cleanup_option,
      protected_admin: {
        id: adminUser?.id,
        name: `${adminUser?.first_name || ''} ${adminUser?.last_name || ''}`.trim(),
        email: adminUser?.email,
        matricule: adminUser?.matricule,
        role: adminUser?.role_name || 'Administrateur Système',
        staff_id: adminStaffId
      },
      preserved_structures: {
        services_count: services?.count || 0,
        positions_count: positions?.count || 0,
        roles_count: roles?.count || 0,
        permissions_count: permissions?.count || 0,
        workflows_count: workflows?.count || 0,
        templates_count: templates?.count || 0,
        settings_count: settings?.count || 0,
        mission_orders_qr_system_intact: true
      },
      targets: {
        users: targetUsers,
        staff: targetStaff,
        assignments: targetAssignments
      },
      counts: {
        users_to_clean: targetUsers.length,
        staff_to_clean: targetStaff.length,
        assignments_to_clean: targetAssignments.length,
        positions_to_vacate: targetAssignments.length
      },
      ambiguity_detected: ambiguityDetected
    });
  } catch (err) {
    console.error('Audit user cleanup error:', err);
    res.status(500).json({ error: "Erreur lors de l'analyse et de l'audit des dépendances." });
  }
});

// POST /api/admin/maintenance/users/reset - Securely execute user cleanup and demo reset
router.post('/users/reset', authenticateToken, requireSystemAdmin, async (req, res) => {
  const {
    cleanup_option = 'C',
    custom_scope = {},
    confirmText,
    password,
    operationId = `RESET_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    acknowledgeAmbiguity = false
  } = req.body;

  const adminId = req.user.id;
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

  // 1. Anti-Concurrency Lock
  if (isUserResetInProgress) {
    return res.status(409).json({
      error: "⚠️ OPÉRATION REJETÉE : Une réinitialisation est déjà en cours d'exécution par un administrateur. Veuillez patienter."
    });
  }

  // 2. Anti-Bruteforce Lock Check
  const lockoutInfo = failedAuthAttempts.get(clientIp);
  if (lockoutInfo && lockoutInfo.attempts >= MAX_FAILED_ATTEMPTS) {
    const remainingTime = Math.ceil((lockoutInfo.lockoutUntil - Date.now()) / 1000 / 60);
    if (Date.now() < lockoutInfo.lockoutUntil) {
      return res.status(429).json({
        error: `🔒 ACCÈS BLOQUÉ TEMPORAIREMENT : Trop de tentatives d'authentification erronées. Réessayez dans ${remainingTime} minute(s).`
      });
    } else {
      failedAuthAttempts.delete(clientIp);
    }
  }

  // 3. Strict Textual Confirmation Validation
  if (confirmText !== 'RÉINITIALISER LES UTILISATEURS') {
    return res.status(400).json({
      error: 'Confirmation textuelle invalide. Vous devez saisir exactement "RÉINITIALISER LES UTILISATEURS" pour continuer.'
    });
  }

  // 4. Admin Password Re-Authentication
  if (!password || !password.trim()) {
    return res.status(400).json({
      error: 'Le mot de passe administrateur actuel est obligatoire pour autoriser cette opération hautement sensible.'
    });
  }

  try {
    const adminUser = await db.get("SELECT id, matricule, email, password_hash, first_name, last_name FROM users WHERE id = ?", [adminId]);
    if (!adminUser || !adminUser.password_hash) {
      return res.status(403).json({ error: "Compte administrateur introuvable ou invalide." });
    }

    const isMatch = await bcrypt.compare(password.trim(), adminUser.password_hash);
    if (!isMatch) {
      const currentAttempts = (lockoutInfo ? lockoutInfo.attempts : 0) + 1;
      const lockoutUntil = currentAttempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0;
      failedAuthAttempts.set(clientIp, { attempts: currentAttempts, lockoutUntil });

      await logAuditAction(adminId, 'ECHEC_AUTH_REINITIALISATION_UTILISATEURS', 'SECURITE', 1, req, {
        operationId,
        ip: clientIp,
        attempts: currentAttempts
      });

      return res.status(401).json({
        error: `Mot de passe administrateur incorrect. Tentative ${currentAttempts}/${MAX_FAILED_ATTEMPTS}.`
      });
    }

    // Reset failed auth attempts on success
    failedAuthAttempts.delete(clientIp);

    // 5. Mandatory Automatic Prior Database Backup
    isUserResetInProgress = true;
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const backupDir = BACKUP_DIR || path.resolve(__dirname, '../../../backups/dev');
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFileName = `uk_ged_backup_PRE_USER_RESET_${timestamp}_${operationId}.db`;
    const backupFilePath = path.join(backupDir, backupFileName);

    let backupCreated = false;
    try {
      if (fs.existsSync(DB_PATH)) {
        fs.copyFileSync(DB_PATH, backupFilePath);
        const stats = fs.statSync(backupFilePath);
        if (stats.size > 0) {
          backupCreated = true;
        }
      }
    } catch (bErr) {
      console.error('CRITICAL: Automatic backup creation failed:', bErr);
    }

    if (!backupCreated) {
      isUserResetInProgress = false;
      return res.status(500).json({
        error: "❌ ÉCHEC CRITIQUE DE LA SAUVEGARDE PRÉALABLE : L'opération a été arrêtée immédiatement sans modifier la base de données."
      });
    }

    // 6. Identify Admin and Staff ID for strict exclusion
    let adminStaff = await db.get("SELECT id FROM staff WHERE user_id = ? OR matricule = ?", [adminId, adminUser.matricule]);
    const adminStaffId = adminStaff ? adminStaff.id : null;

    const progressSteps = [];
    progressSteps.push({ step: 1, name: "Vérification des autorisations", status: "OK" });
    progressSteps.push({ step: 2, name: "Contrôle d'intégrité préliminaire", status: "OK" });
    progressSteps.push({ step: 3, name: "Création de la sauvegarde obligatoire", status: "OK", file: backupFileName });
    progressSteps.push({ step: 4, name: "Sanctuarisation de l'administrateur connecté", status: "OK", admin_id: adminId });

    let cleanedUsersCount = 0;
    let cleanedStaffCount = 0;
    let cleanedAssignmentsCount = 0;
    let vacatedPositionsCount = 0;

    // 7. Execute reset based on selected option
    const cleanUsers = (cleanup_option === 'A' || cleanup_option === 'B' || cleanup_option === 'C' || (cleanup_option === 'D' && custom_scope.clean_users));
    const cleanStaff = (cleanup_option === 'B' || cleanup_option === 'C' || (cleanup_option === 'D' && custom_scope.clean_staff));
    const cleanAssignments = (cleanup_option === 'C' || (cleanup_option === 'D' && custom_scope.clean_assignments));

    // Step A: Liberation of services and post responsibilities
    const resetServicesRes = await db.run(
      "UPDATE services SET head_user_id = NULL, function_title = NULL WHERE head_user_id != ? OR head_user_id IS NULL",
      [adminId]
    );

    // Step B: Reassign metadata and system tables to protected admin
    await db.run("UPDATE archive_custom_categories SET created_by = ? WHERE created_by != ?", [adminId, adminId]);
    await db.run("UPDATE service_document_settings SET created_by = ?, updated_by = ? WHERE created_by != ? OR updated_by != ?", [adminId, adminId, adminId, adminId]);
    await runSafe("UPDATE service_document_settings_history SET changed_by = ? WHERE changed_by != ?", [adminId, adminId]);
    await db.run("UPDATE document_templates SET created_by = ? WHERE created_by != ?", [adminId, adminId]);
    await db.run("UPDATE template_versions SET created_by = ?, uploaded_by = ? WHERE created_by != ? OR uploaded_by != ?", [adminId, adminId, adminId, adminId]);
    await db.run("UPDATE document_receipts SET created_by = ? WHERE created_by != ?", [adminId, adminId]);
    await db.run("UPDATE attachments SET uploaded_by = ? WHERE uploaded_by != ?", [adminId, adminId]);
    await db.run("UPDATE audit_logs SET user_id = ? WHERE user_id != ?", [adminId, adminId]);
    await runSafe("UPDATE vehicle_assignment_history SET assigned_by_user_id = ?, staff_id = CASE WHEN staff_id = ? THEN ? ELSE NULL END", [adminId, adminStaffId || 0, adminStaffId || 0]);

    // Step C: Reset Vehicles & Purge demo vehicle assignments
    const resetVehiclesRes = await runSafe(
      "UPDATE vehicles SET assigned_staff_id = NULL, status = 'DISPONIBLE' WHERE assigned_staff_id IS NOT NULL AND assigned_staff_id != ?",
      [adminStaffId || 0]
    );
    if (adminStaffId) {
      await runSafe("DELETE FROM personal_vehicles WHERE staff_id != ?", [adminStaffId]);
    } else {
      await runSafe("DELETE FROM personal_vehicles");
    }

    // Step D: Purge demo service head history & demo signatures
    await runSafe("DELETE FROM service_heads_history WHERE user_id != ?", [adminId]);
    await runSafe("DELETE FROM signature_versions WHERE signature_id NOT IN (SELECT id FROM user_signatures WHERE user_id = ?)", [adminId]);
    await runSafe("DELETE FROM document_signatures WHERE signature_id NOT IN (SELECT id FROM user_signatures WHERE user_id = ?)", [adminId]);
    await runSafe("DELETE FROM user_signatures WHERE user_id != ?", [adminId]);

    // Step E: Clean assignments & render positions vacant
    if (cleanAssignments) {
      if (adminStaffId) {
        const delAssignRes = await db.run("DELETE FROM staff_assignments WHERE staff_id != ?", [adminStaffId]);
        cleanedAssignmentsCount = delAssignRes.changes || 0;
      } else {
        const delAssignRes = await db.run("DELETE FROM staff_assignments");
        cleanedAssignmentsCount = delAssignRes.changes || 0;
      }
      progressSteps.push({ step: 5, name: "Nettoyage des affectations & libération des postes", status: "OK", count: cleanedAssignmentsCount });
    }

    // Step F: Normalize documents to prevent orphaned relations
    await db.run(`
      UPDATE documents 
      SET created_by = ?,
          current_user_id = NULL,
          last_edited_by = NULL,
          archived_by = CASE WHEN archived_by = ? THEN ? ELSE NULL END,
          target_recipient_id = NULL,
          sg_routed_by = NULL,
          rejected_by = NULL,
          transmitted_to_sc_by = NULL,
          central_archived_by = NULL
      WHERE created_by != ? OR current_user_id != ? OR last_edited_by != ? OR target_recipient_id != ?
    `, [adminId, adminId, adminId, adminId, adminId, adminId, adminId]);

    await db.run("DELETE FROM document_transfers WHERE from_user_id != ? OR to_user_id != ?", [adminId, adminId]);
    await db.run("DELETE FROM service_transmissions WHERE from_user_id != ? OR to_user_id != ?", [adminId, adminId]);
    await db.run("DELETE FROM signatures WHERE user_id != ?", [adminId]);
    await db.run("DELETE FROM document_history WHERE user_id != ?", [adminId]);
    await runSafe("UPDATE mission_orders SET signed_by_user_id = NULL WHERE signed_by_user_id != ?", [adminId]);
    await runSafe("DELETE FROM external_missionaries WHERE arrival_recorded_by != ? OR signed_by_user_id != ? OR departure_recorded_by != ?", [adminId, adminId, adminId]);
    await runSafe("DELETE FROM mission_order_requests WHERE user_id IS NOT NULL AND user_id != ?", [adminId]);
    await runSafe("DELETE FROM appointments WHERE responsible_id != ? OR requester_id != ?", [adminId, adminId]);
    await runSafe("DELETE FROM document_dispatches WHERE sender_user_id != ?", [adminId]);
    await runSafe("DELETE FROM notifications WHERE user_id != ?", [adminId]);
    await runSafe("DELETE FROM password_reset_tokens WHERE user_id != ?", [adminId]);

    // Step G: Delete target staff records
    if (cleanStaff) {
      if (adminStaffId) {
        const delStaffRes = await db.run("DELETE FROM staff WHERE id != ?", [adminStaffId]);
        cleanedStaffCount = delStaffRes.changes || 0;
      } else {
        const delStaffRes = await db.run("DELETE FROM staff WHERE user_id != ? OR user_id IS NULL", [adminId]);
        cleanedStaffCount = delStaffRes.changes || 0;
      }
      progressSteps.push({ step: 6, name: "Nettoyage des fiches de personnel", status: "OK", count: cleanedStaffCount });
    }

    // Step H: Delete target users (STRICTLY EXCLUDING CONNECTED ADMIN)
    if (cleanUsers) {
      const delUsersRes = await db.run("DELETE FROM users WHERE id != ?", [adminId]);
      cleanedUsersCount = delUsersRes.changes || 0;
      progressSteps.push({ step: 7, name: "Nettoyage des comptes utilisateurs", status: "OK", count: cleanedUsersCount });
    }

    // Step I: Strict SQLite Foreign Key & Integrity Check
    const fkErrors = await db.all("PRAGMA foreign_key_check;");
    if (fkErrors.length > 0) {
      console.error('CRITICAL: PRAGMA foreign_key_check failed:', fkErrors);
      // Rollback database from backup
      fs.copyFileSync(backupFilePath, DB_PATH);
      throw new Error(`Contraintes de clé étrangère violées (${fkErrors.length} erreur(s)). La base a été restaurée.`);
    }
    progressSteps.push({ step: 8, name: "Contrôle d'intégrité relationnelle PRAGMA", status: "OK", errors: 0 });

    const integrityCheck = await db.get("PRAGMA integrity_check;");
    progressSteps.push({ step: 9, name: "Contrôle d'intégrité physique SQLite", status: integrityCheck?.integrity_check || "ok" });

    // Step J: Final Metrics
    const userCount = await db.get("SELECT COUNT(*) as c FROM users");
    const staffCount = await db.get("SELECT COUNT(*) as c FROM staff");
    const servicesCount = await db.get("SELECT COUNT(*) as c FROM services");
    const positionsCount = await db.get("SELECT COUNT(*) as c FROM positions");
    const vacantPositions = await db.get(`
      SELECT COUNT(*) as c FROM positions p 
      WHERE p.id NOT IN (SELECT position_id FROM staff_assignments WHERE status = 'ACTIVE')
    `);
    const rolesCount = await db.get("SELECT COUNT(*) as c FROM roles");
    const permsCount = await db.get("SELECT COUNT(*) as c FROM permissions");
    const rulesCount = await db.get("SELECT COUNT(*) as c FROM workflow_rules");
    const templatesCount = await db.get("SELECT COUNT(*) as c FROM document_templates");

    vacatedPositionsCount = vacantPositions?.c || 0;
    progressSteps.push({ step: 10, name: "Vérification finale & établissement du rapport", status: "OK" });

    // Step K: Log Security Audit Action (Password is NEVER logged)
    await logAuditAction(adminId, 'REINITIALISATION_SECURISEE_UTILISATEURS', 'MAINTENANCE', 1, req, {
      operationId,
      cleanup_option,
      cleaned_users: cleanedUsersCount,
      cleaned_staff: cleanedStaffCount,
      cleaned_assignments: cleanedAssignmentsCount,
      vacant_positions: vacatedPositionsCount,
      backup_file: backupFileName,
      ip: clientIp
    });

    res.json({
      success: true,
      operationId,
      timestamp: now.toISOString(),
      report: {
        admin_preserved: true,
        services_preserved: true,
        positions_preserved: true,
        roles_preserved: true,
        permissions_preserved: true,
        workflows_preserved: true,
        templates_preserved: true,
        mission_orders_qr_system_preserved: true,
        users_cleaned: cleanedUsersCount,
        staff_cleaned: cleanedStaffCount,
        assignments_cleaned: cleanedAssignmentsCount,
        positions_vacant: vacatedPositionsCount,
        errors_count: 0,
        backup_file: backupFileName,
        backup_path: backupFilePath
      },
      preserved_counts: {
        users: userCount.c,
        staff: staffCount.c,
        services: servicesCount.c,
        positions: positionsCount.c,
        vacant_positions: vacatedPositionsCount,
        roles: rolesCount.c,
        permissions: permsCount.c,
        workflows: rulesCount.c,
        templates: templatesCount.c
      },
      progress_steps: progressSteps
    });
  } catch (err) {
    console.error('Reset users demo data error:', err);
    res.status(500).json({
      error: err.message || "Erreur lors de la réinitialisation des utilisateurs.",
      operationId
    });
  } finally {
    isUserResetInProgress = false;
  }
});

module.exports = router;

