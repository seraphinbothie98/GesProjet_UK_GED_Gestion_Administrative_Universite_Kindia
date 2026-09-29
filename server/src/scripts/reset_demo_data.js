/**
 * Script de Réinitialisation Sécurisée des Données de Démonstration (UK-GED)
 * Université de Kindia
 *
 * Ce script :
 * 1. Effectue une sauvegarde complète horodatée de la base de données SQLite.
 * 2. Conserve STRICTEMENT le compte et la fiche de l'Administrateur Système.
 * 3. Conserve 100% de la structure : services, postes, rôles, permissions, workflows, templates, paramètres, QR Code.
 * 4. Nettoie les données de démonstration (utilisateurs, personnels, affectations démo, signatures démo).
 * 5. Rend tous les postes institutionnels VACANTS pour la saisie des vraies données.
 * 6. Vérifie l'intégrité référentielle complète (PRAGMA foreign_key_check).
 */

const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { DB_PATH, BACKUP_DIR } = require('../config/constants');

async function resetDemoData(options = {}) {
  console.log('================================================================');
  console.log('  UK-GED — RÉINITIALISATION SÉCURISÉE DES DONNÉES DE DÉMO      ');
  console.log('  Université de Kindia                                          ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // ÉTAPE 1 : SAUVEGARDE COMPLÈTE HORODATÉE
  // -------------------------------------------------------------
  console.log('--- ÉTAPE 1 : CRÉATION DE LA SAUVEGARDE PRÉALABLE ---');
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backupDir = BACKUP_DIR || path.resolve(__dirname, '../../../backups/dev');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFileName = `uk_ged_backup_PRE_RESET_${timestamp}.db`;
  const backupFilePath = path.join(backupDir, backupFileName);

  if (fs.existsSync(DB_PATH)) {
    fs.copyFileSync(DB_PATH, backupFilePath);
    console.log(`✅ Sauvegarde créée avec succès : ${backupFilePath}`);
  } else {
    throw new Error(`Fichier de base de données introuvable à l'emplacement : ${DB_PATH}`);
  }

  // -------------------------------------------------------------
  // ÉTAPE 2 : IDENTIFICATION & PROTECTION DE L'ADMINISTRATEUR
  // -------------------------------------------------------------
  console.log('\n--- ÉTAPE 2 : IDENTIFICATION DE L’ADMINISTRATEUR MAÎTRE ---');
  const adminRole = await db.get("SELECT id FROM roles WHERE code = 'ADMINISTRATEUR'");
  const adminUser = await db.get(
    "SELECT id, matricule, email, first_name, last_name FROM users WHERE email = 'admin@univ-kindia.edu.gn' OR role_id = ? ORDER BY id ASC LIMIT 1",
    [adminRole ? adminRole.id : 1]
  );

  if (!adminUser) {
    throw new Error("❌ ERREUR CRITIQUE : Compte Administrateur introuvable ! Opération annulée.");
  }

  const adminId = adminUser.id;
  console.log(`🔒 Administrateur Maître protégé : ID=${adminId}, Email=${adminUser.email}, Nom=${adminUser.first_name} ${adminUser.last_name}`);

  let adminStaff = await db.get("SELECT id FROM staff WHERE user_id = ?", [adminId]);
  let adminStaffId = adminStaff ? adminStaff.id : null;
  if (!adminStaffId) {
    adminStaff = await db.get("SELECT id FROM staff WHERE matricule = ?", [adminUser.matricule]);
    adminStaffId = adminStaff ? adminStaff.id : null;
  }
  console.log(`🔒 Fiche Personnel Administrateur protégée : ID=${adminStaffId || 'Créée/Associée'}`);

  // -------------------------------------------------------------
  // ÉTAPE 3 : RÉINITIALISATION DES STRUCTURES & AFFECTATIONS
  // -------------------------------------------------------------
  console.log('\n--- ÉTAPE 3 : LIBÉRATION DES SERVICES & POSTES (VACANCE) ---');
  
  // 3a. Réinitialisation des responsables de services vers VACANT (NULL)
  const resetServicesRes = await db.run(
    "UPDATE services SET head_user_id = NULL, function_title = NULL WHERE head_user_id != ? OR head_user_id IS NULL",
    [adminId]
  );
  console.log(`✅ ${resetServicesRes.changes} services réinitialisés (responsables déclarés VACANTS).`);

  // 3b. Réassignation des métadonnées système globales vers l'Administrateur
  await db.run("UPDATE archive_custom_categories SET created_by = ? WHERE created_by != ?", [adminId, adminId]);
  await db.run("UPDATE service_document_settings SET created_by = ?, updated_by = ? WHERE created_by != ? OR updated_by != ?", [adminId, adminId, adminId, adminId]);
  await db.run("UPDATE service_document_settings_history SET changed_by = ? WHERE changed_by != ?", [adminId, adminId]);
  await db.run("UPDATE document_templates SET created_by = ? WHERE created_by != ?", [adminId, adminId]);
  await db.run("UPDATE template_versions SET created_by = ?, uploaded_by = ? WHERE created_by != ? OR uploaded_by != ?", [adminId, adminId, adminId, adminId]);
  await db.run("UPDATE document_receipts SET created_by = ? WHERE created_by != ?", [adminId, adminId]);
  await db.run("UPDATE attachments SET uploaded_by = ? WHERE uploaded_by != ?", [adminId, adminId]);
  await db.run("UPDATE audit_logs SET user_id = ? WHERE user_id != ?", [adminId, adminId]);
  await db.run("UPDATE vehicle_assignment_history SET assigned_by_user_id = ?, staff_id = CASE WHEN staff_id = ? THEN ? ELSE NULL END", [adminId, adminStaffId || 0, adminStaffId || 0]);

  // 3c. Remise à disposition des véhicules de service
  const resetVehiclesRes = await db.run(
    "UPDATE vehicles SET assigned_staff_id = NULL, status = 'DISPONIBLE' WHERE assigned_staff_id IS NOT NULL AND assigned_staff_id != ?",
    [adminStaffId || 0]
  );
  console.log(`✅ ${resetVehiclesRes.changes} véhicules remis à l'état DISPONIBLE.`);

  // 3d. Nettoyage des véhicules personnels des personnels démo
  if (adminStaffId) {
    await db.run("DELETE FROM personal_vehicles WHERE staff_id != ?", [adminStaffId]);
  } else {
    await db.run("DELETE FROM personal_vehicles");
  }

  // 3e. Purge de l'historique des responsables démo
  await db.run("DELETE FROM service_heads_history WHERE user_id != ?", [adminId]);

  // 3f. Purge des signatures électroniques démo
  await db.run("DELETE FROM signature_versions WHERE signature_id NOT IN (SELECT id FROM user_signatures WHERE user_id = ?)", [adminId]);
  await db.run("DELETE FROM document_signatures WHERE signature_id NOT IN (SELECT id FROM user_signatures WHERE user_id = ?)", [adminId]);
  await db.run("DELETE FROM user_signatures WHERE user_id != ?", [adminId]);
  console.log('✅ Signatures et versions de démonstration purgées.');

  // 3g. Purge des affectations démo -> Tous les postes deviennent VACANTS
  if (adminStaffId) {
    const delAssignRes = await db.run("DELETE FROM staff_assignments WHERE staff_id != ?", [adminStaffId]);
    console.log(`✅ ${delAssignRes.changes} affectations démo supprimées. Tous les postes sont désormais VACANTS.`);
  } else {
    const delAssignRes = await db.run("DELETE FROM staff_assignments");
    console.log(`✅ ${delAssignRes.changes} affectations démo supprimées. Tous les postes sont désormais VACANTS.`);
  }

  // -------------------------------------------------------------
  // ÉTAPE 4 : NORMALISATION DES DOCUMENTS & CIRCUITS
  // -------------------------------------------------------------
  console.log('\n--- ÉTAPE 4 : NORMALISATION DES CIRCUITS DE DOCUMENTS ---');
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

  // -------------------------------------------------------------
  // ÉTAPE 5 : SUPPRESSION CIBLÉE DES PERSONNELS & UTILISATEURS DÉMO
  // -------------------------------------------------------------
  console.log('\n--- ÉTAPE 5 : SUPPRESSION DES COMPTES & PERSONNELS DE DÉMONSTRATION ---');
  if (adminStaffId) {
    const delStaffRes = await db.run("DELETE FROM staff WHERE id != ?", [adminStaffId]);
    console.log(`✅ ${delStaffRes.changes} fiches de personnel de démonstration supprimées.`);
  } else {
    const delStaffRes = await db.run("DELETE FROM staff WHERE user_id != ? OR user_id IS NULL", [adminId]);
    console.log(`✅ ${delStaffRes.changes} fiches de personnel de démonstration supprimées.`);
  }

  const delUsersRes = await db.run("DELETE FROM users WHERE id != ?", [adminId]);
  console.log(`✅ ${delUsersRes.changes} comptes utilisateurs de démonstration supprimés.`);

  // -------------------------------------------------------------
  // ÉTAPE 6 : CONTRÔLE D'INTÉGRITÉ RÉFÉRENTIELLE STRICT
  // -------------------------------------------------------------
  console.log('\n--- ÉTAPE 6 : VÉRIFICATION D’INTÉGRITÉ BASE DE DONNÉES ---');
  const fkErrors = await db.all("PRAGMA foreign_key_check;");
  if (fkErrors.length === 0) {
    console.log('✅ PRAGMA foreign_key_check : 0 ERREURS ! Toutes les contraintes relationnelles sont respectées.');
  } else {
    console.error('❌ ERREURS DE CLÉ ÉTRANGÈRE DÉTECTÉES :', fkErrors);
    throw new Error('Échec du contrôle d’intégrité référentielle.');
  }

  const integrityCheck = await db.get("PRAGMA integrity_check;");
  console.log(`✅ PRAGMA integrity_check : ${integrityCheck.integrity_check || 'ok'}`);

  // -------------------------------------------------------------
  // ÉTAPE 7 : BILAN & COMPTEURS FINAUX
  // -------------------------------------------------------------
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

  console.log('\n================================================================');
  console.log('  BILAN FINAL DE LA RÉINITIALISATION (UK-GED)                   ');
  console.log('================================================================');
  console.log(`👤 Utilisateurs conservés     : ${userCount.c} (Administrateur Maître)`);
  console.log(`📋 Fiches Personnel conservées: ${staffCount.c} (Administrateur)`);
  console.log(`🏢 Services conservés         : ${servicesCount.c} (100% de la structure)`);
  console.log(`🎯 Postes/Fonctions conservés : ${positionsCount.c} (100% des postes)`);
  console.log(`🟢 Postes rendus VACANTS      : ${vacantPositions.c} (Prêts pour affectation)`);
  console.log(`🔑 Rôles système conservés    : ${rolesCount.c} (100% des rôles)`);
  console.log(`🛡️  Permissions conservées     : ${permsCount.c} (100% des droits)`);
  console.log(`🔄 Règles de workflow         : ${rulesCount.c} (Circuits préservés)`);
  console.log(`📄 Modèles de documents       : ${templatesCount.c} (Templates préservés)`);
  console.log('================================================================\n');
  console.log('🎉 UK-GED est maintenant prêt pour la saisie des vraies données de l’Université de Kindia !');

  return {
    success: true,
    backupFilePath,
    metrics: {
      users: userCount.c,
      staff: staffCount.c,
      services: servicesCount.c,
      positions: positionsCount.c,
      vacantPositions: vacantPositions.c,
      roles: rolesCount.c,
      permissions: permsCount.c,
      workflows: rulesCount.c,
      templates: templatesCount.c
    }
  };
}

async function runSafe(sql, params = []) {
  try {
    return await db.run(sql, params);
  } catch (e) {
    // Table or column may not exist in all configurations
    return { changes: 0 };
  }
}

if (require.main === module) {
  resetDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Erreur lors de la réinitialisation :', err);
      process.exit(1);
    });
}

module.exports = resetDemoData;
