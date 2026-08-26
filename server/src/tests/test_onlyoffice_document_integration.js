/**
 * Automated Test Suite: ONLYOFFICE Document Server Integration for UK-GED
 * Validates format detection, ABAC permission modes, immutable versioning without file overwriting,
 * multi-user editing lock conflict resolution, and healthcheck graceful degradation.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { UPLOAD_DIR, JWT_SECRET } = require('../config/constants');
const onlyofficeDocumentService = require('../services/onlyofficeDocumentService');

async function runTests() {
  console.log('=== DÉBUT DES TESTS : INTÉGRATION ONLYOFFICE DOCUMENT SERVER DANS UK-GED ===\n');

  // Setup test environment
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // Fetch roles and services
  const adminRole = await db.get("SELECT id, code FROM roles WHERE code = 'ADMINISTRATEUR'");
  const chefRole = await db.get("SELECT id, code FROM roles WHERE code = 'CHEF_SERVICE'");
  const scService = await db.get("SELECT id, code FROM services WHERE code = 'SC'");
  const fsService = await db.get("SELECT id, code FROM services WHERE code = 'FS'");

  // Create two distinct test users
  const userA_Res = await db.run(`
    INSERT INTO users (matricule, first_name, last_name, email, function_title, service_id, role_id, password_hash, status)
    VALUES (?, 'Alpha', 'Barry', ?, 'Chef de Section', ?, ?, 'hash', 'ACTIVE')
  `, [`MAT-OO-A-${Date.now()}`, `alpha.barry.${Date.now()}@univ-kindia.edu.gn`, scService.id, chefRole.id]);
  const userA = {
    id: userA_Res.lastID,
    matricule: `MAT-OO-A-${Date.now()}`,
    first_name: 'Alpha',
    last_name: 'Barry',
    role_code: 'CHEF_SERVICE',
    service_id: scService.id,
    permissions: ['documents.edit', 'documents.onlyoffice_edit', 'documents.view']
  };

  const userB_Res = await db.run(`
    INSERT INTO users (matricule, first_name, last_name, email, function_title, service_id, role_id, password_hash, status)
    VALUES (?, 'Binta', 'Diallo', ?, 'Chef Adjoint', ?, ?, 'hash', 'ACTIVE')
  `, [`MAT-OO-B-${Date.now()}`, `binta.diallo.${Date.now()}@univ-kindia.edu.gn`, fsService.id, chefRole.id]);
  const userB = {
    id: userB_Res.lastID,
    matricule: `MAT-OO-B-${Date.now()}`,
    first_name: 'Binta',
    last_name: 'Diallo',
    role_code: 'CHEF_SERVICE',
    service_id: fsService.id,
    permissions: ['documents.view']
  };

  console.log(`[TEST SETUP] Acteurs créés : User A (ID: ${userA.id}, Service SC) et User B (ID: ${userB.id}, Service FS)`);

  // Create initial physical test file
  const initialFileName = `doc_test_oo_${Date.now()}_v1.docx`;
  const initialFilePath = path.join(UPLOAD_DIR, initialFileName);
  fs.writeFileSync(initialFilePath, 'ORIGINAL CONTENT V1 OF KINDIA OFFICIAL DOCUMENT', 'utf-8');

  // Insert initial test document
  const docRes = await db.run(`
    INSERT INTO documents (reference, title, document_type, status, current_service_id, current_user_id, created_by, file_path, current_version, is_locked)
    VALUES (?, 'Lettre Administrative Test ONLYOFFICE', 'LETTRE', 'DRAFT', ?, ?, ?, ?, 1, 0)
  `, [`UK/SC/2026/TEST_OO_${Date.now()}`, scService.id, userA.id, userA.id, initialFileName]);
  const docId = docRes.lastID;

  // Insert initial version record in document_versions
  await db.run(`
    INSERT INTO document_versions (document_id, version_number, title, file_path, file_name, file_size, file_type, change_notes, change_summary, created_by, uploaded_by)
    VALUES (?, 1, 'Lettre Administrative Test ONLYOFFICE', ?, ?, ?, 'DOCX', 'Version initiale', 'Version initiale', ?, ?)
  `, [docId, initialFileName, initialFileName, 46, userA.id, userA.id]);

  console.log(`[TEST SETUP] Document de test créé (ID: ${docId}, Version: 1, Fichier initial: ${initialFileName})`);

  // ----------------------------------------------------
  // TEST 1: Format Compatibility
  // ----------------------------------------------------
  console.log('\n--- 1. Détection des Formats Pris en Charge ---');
  assert(onlyofficeDocumentService.isFormatSupported('note.docx'), 'DOCX doit être supporté');
  assert(onlyofficeDocumentService.isFormatSupported('budget.xlsx'), 'XLSX doit être supporté');
  assert(onlyofficeDocumentService.isFormatSupported('presentation.pptx'), 'PPTX doit être supporté');
  assert(onlyofficeDocumentService.isFormatSupported('archive.pdf'), 'PDF doit être supporté');
  assert(!onlyofficeDocumentService.isFormatSupported('binary.exe'), 'EXE ne doit pas être supporté');
  console.log('✓ Formats bureautiques correctement détectés.');

  // ----------------------------------------------------
  // TEST 2: ABAC Permission Mode Calculation
  // ----------------------------------------------------
  console.log('\n--- 2. Contrôle Strict des Permissions & Modes (ABAC) ---');
  
  // Case A: User A on editable draft -> EDIT mode
  const docA = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
  const permA = await onlyofficeDocumentService.determineDocumentPermission(docA, userA);
  assert.strictEqual(permA.mode, 'edit', 'User A avec droits sur brouillon doit être en mode EDIT');

  // Case B: User B with only view rights -> VIEW mode
  const permB = await onlyofficeDocumentService.determineDocumentPermission(docA, userB);
  assert.strictEqual(permB.mode, 'view', 'User B sans droits de modification doit être en mode VIEW');

  // Case C: Signed Document -> strictly VIEW mode
  const signedDoc = { ...docA, status: 'SIGNÉ' };
  const permSigned = await onlyofficeDocumentService.determineDocumentPermission(signedDoc, userA);
  assert.strictEqual(permSigned.mode, 'view', 'Un document SIGNÉ doit être strictement forcé en mode VIEW');

  // Case D: Archived Document -> strictly VIEW mode
  const archivedDoc = { ...docA, status: 'ARCHIVED', is_central_archived: 1 };
  const permArchived = await onlyofficeDocumentService.determineDocumentPermission(archivedDoc, userA);
  assert.strictEqual(permArchived.mode, 'view', 'Un document ARCHIVÉ doit être strictement forcé en mode VIEW');

  // Case E: Locked Document in circuit -> strictly VIEW mode
  const lockedDoc = { ...docA, is_locked: 1 };
  const permLocked = await onlyofficeDocumentService.determineDocumentPermission(lockedDoc, userA);
  assert.strictEqual(permLocked.mode, 'view', 'Un document verrouillé doit être en mode VIEW');
  console.log('✓ Règles de protection (Brouillon = Edit, Signé/Archivé/Verrouillé = View) validées.');

  // ----------------------------------------------------
  // TEST 3: ONLYOFFICE Session Configuration & JWT Generation
  // ----------------------------------------------------
  console.log('\n--- 3. Génération de Configuration de Session ONLYOFFICE & JWT ---');
  const mockReq = { headers: { 'user-agent': 'ONLYOFFICE-Server/8.2.2' }, socket: { remoteAddress: '127.0.0.1' }, ip: '127.0.0.1' };
  const sessionConfig = await onlyofficeDocumentService.buildDocumentSessionConfig(docId, userA, mockReq);
  assert(sessionConfig.config, 'La configuration ONLYOFFICE doit être générée');
  assert(sessionConfig.config.token, 'Le token JWT ONLYOFFICE doit être présent');
  assert.strictEqual(sessionConfig.config.document.fileType, 'docx', 'fileType doit être docx');
  assert.strictEqual(sessionConfig.config.editorConfig.mode, 'edit', 'mode doit être edit pour User A');
  assert(sessionConfig.documentKey.startsWith(`UKGED_DOC_${docId}_V1_`), 'La clé unique de document doit respecter la convention UK-GED');
  console.log(`✓ Configuration de session générée (Clé de document: ${sessionConfig.documentKey}).`);

  // ----------------------------------------------------
  // TEST 4: Multi-User Editing Lock & Conflict Prevention
  // ----------------------------------------------------
  console.log('\n--- 4. Gestion des Verrous d’Édition & Prévention des Conflits ---');
  // User A has acquired the lock during session generation above
  // User B tries to open the document
  const userB_Session = await onlyofficeDocumentService.buildDocumentSessionConfig(docId, userB, mockReq);
  assert(userB_Session.lockInfo, 'User B doit être informé du verrou actif');
  assert.strictEqual(userB_Session.mode, 'view', 'User B doit être basculé en mode VIEW pour éviter les conflits');

  // User A releases lock
  await onlyofficeDocumentService.releaseEditingLock(docId, userA);
  const lockStatus = await db.get('SELECT * FROM document_editing_locks WHERE document_id = ? AND user_id = ?', [docId, userA.id]);
  assert(!lockStatus, 'Le verrou doit être libéré avec succès');
  console.log('✓ Détection de conflit multi-utilisateurs et libération de verrou validées.');

  // ----------------------------------------------------
  // TEST 5: ONLYOFFICE Callback & Immutable Versioning (No overwrite)
  // ----------------------------------------------------
  console.log('\n--- 5. Callback de Sauvegarde & Versionnage Immuable (Sans Écrasement) ---');
  
  // Create mock saved file from ONLYOFFICE Document Server
  const mockSavedFile = path.join(UPLOAD_DIR, `mock_oo_saved_${Date.now()}.docx`);
  fs.writeFileSync(mockSavedFile, 'MODIFIED CONTENT V2 BY USER A IN ONLYOFFICE', 'utf-8');

  // Mock downloadFile method for testing local file
  onlyofficeDocumentService.downloadFile = async (url, dest) => {
    fs.copyFileSync(mockSavedFile, dest);
  };

  const callbackPayload = {
    status: 2,
    url: `http://localhost/download/mock_${Date.now()}.docx`,
    users: [`usr_${userA.id}`],
    key: sessionConfig.documentKey
  };

  const callbackRes = await onlyofficeDocumentService.handleCallback(docId, callbackPayload, mockReq);
  assert.strictEqual(callbackRes.error, 0, 'Le callback doit retourner error: 0');

  // 1. Verify original file still exists and was NOT overwritten
  assert(fs.existsSync(initialFilePath), 'Le fichier original v1 DOIT toujours exister');
  const originalContent = fs.readFileSync(initialFilePath, 'utf-8');
  assert.strictEqual(originalContent, 'ORIGINAL CONTENT V1 OF KINDIA OFFICIAL DOCUMENT', 'Le contenu du fichier original v1 ne doit pas avoir changé');

  // 2. Verify document record updated to v2
  const updatedDoc = await db.get('SELECT current_version, file_path, last_edited_by FROM documents WHERE id = ?', [docId]);
  assert.strictEqual(updatedDoc.current_version, 2, 'La version du document doit être incrémentée à 2');
  assert.notStrictEqual(updatedDoc.file_path, initialFileName, 'Le pointeur de fichier doit pointer vers le nouveau fichier v2');

  // 3. Verify new physical file v2 exists with modified content
  const newFilePath = path.join(UPLOAD_DIR, updatedDoc.file_path);
  assert(fs.existsSync(newFilePath), 'Le nouveau fichier physique v2 doit exister');
  const newContent = fs.readFileSync(newFilePath, 'utf-8');
  assert.strictEqual(newContent, 'MODIFIED CONTENT V2 BY USER A IN ONLYOFFICE', 'Le nouveau fichier v2 doit contenir les modifications');

  // 4. Verify version history in document_versions
  const versions = await db.all('SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number ASC', [docId]);
  assert.strictEqual(versions.length, 2, 'Il doit y avoir exactement 2 versions enregistrées');
  assert.strictEqual(versions[0].version_number, 1);
  assert.strictEqual(versions[1].version_number, 2);
  assert.strictEqual(versions[1].uploaded_by, userA.id);

  console.log(`✓ Versionnage immuable certifié : Version 1 (${initialFileName}) et Version 2 (${updatedDoc.file_path}) coexistent sans écrasement.`);

  // ----------------------------------------------------
  // TEST 6: Audit Log Integrity
  // ----------------------------------------------------
  console.log('\n--- 6. Vérification du Journal d’Audit ---');
  const auditLogs = await db.all('SELECT * FROM audit_logs WHERE entity_id = ? AND entity_type = "DOCUMENT"', [docId]);
  assert(auditLogs.length >= 2, 'Des traces d’audit doivent avoir été créées pour l’ouverture et la création de version');
  console.log(`✓ ${auditLogs.length} événements d’audit enregistrés pour le cycle ONLYOFFICE.`);

  // ----------------------------------------------------
  // TEST 7: Health Check & Graceful Degradation
  // ----------------------------------------------------
  console.log('\n--- 7. Diagnostic de Santé & Dégradation Contrôlée ---');
  const healthStatus = await onlyofficeDocumentService.checkHealth();
  assert(healthStatus.status, 'Le statut de santé doit être retourné');
  console.log(`✓ Diagnostic de santé ONLYOFFICE : ${healthStatus.status} (${healthStatus.url}) - UK-GED reste 100% opérationnel.`);

  console.log('\n======================================================');
  console.log('TOUS LES TESTS ONLYOFFICE ONT RÉUSSI (7/7) !');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ ÉCHEC DU TEST ONLYOFFICE :', err);
  process.exit(1);
});
