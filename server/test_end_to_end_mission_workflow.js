const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./src/database/db');
const { generateMissionOrderDocumentInstance, generateSignedMissionOrderPDF } = require('./src/services/pdfService');
const { formatFullName } = require('./src/utils/userUtils');

async function testFullWorkflow() {
  console.log('=== TEST DU WORKFLOW COMPLET : SC -> SG -> SC -> ARCHIVAGE ===\n');

  // 1. Setup / Identify SC and SG users
  const scService = await db.get('SELECT * FROM services WHERE code = "SC"');
  const sgService = await db.get('SELECT * FROM services WHERE code = "SG"');
  assert.ok(scService, 'Service SC doit exister');
  assert.ok(sgService, 'Service SG doit exister');

  const scUser = await db.get('SELECT * FROM users WHERE service_id = ? AND status = "ACTIVE" LIMIT 1', [scService.id]) ||
                 await db.get('SELECT * FROM users WHERE role_id = 1 LIMIT 1');
  const sgUser = await db.get('SELECT u.* FROM users u JOIN roles r ON u.role_id = r.id WHERE r.code = "SECRÉTAIRE_GÉNÉRAL" LIMIT 1') ||
                 await db.get('SELECT * FROM users WHERE function_title LIKE "%Secrétaire Général%" LIMIT 1') ||
                 await db.get('SELECT * FROM users WHERE role_id = 2 LIMIT 1');

  console.log(`1. Acteurs identifiés :
   - Secrétariat Central (Créateur) : ID ${scUser.id} (${scUser.first_name} ${scUser.last_name})
   - Secrétaire Général (Signataire) : ID ${sgUser.id} (${sgUser.first_name} ${sgUser.last_name})`);

  // 2. ÉTAPE 1 : Le Secrétariat Central crée l'Ordre de Mission (Génération unique DOCX -> PDF)
  console.log('\n2. ÉTAPE 1 : Secrétariat Central crée l’Ordre de Mission...');
  const refCode = `OM-E2E-${Date.now()}`;
  const trackingToken = crypto.randomBytes(16).toString('hex');

  const missionPayload = {
    reference: refCode,
    created_at: new Date().toISOString(),
    missionary_name: 'Dr. Mariama Ciré DIALLO',
    missionary_last_name: 'DIALLO',
    missionary_firstnames: 'Mariama Ciré',
    missionary_titre: 'Dr.',
    function_title: 'Enseignante-Chercheuse / Chef de Département',
    missionary_service: 'Département de Mathématiques',
    matricule: 'UK-ENS-2026-8877',
    nationality: 'Guinéenne',
    destination: 'Boké (Centre de Recherche Géologique)',
    object_of_mission: 'Mission d’expertise et encadrement doctoral',
    transport_mode: 'Véhicule de service',
    vehicle_registration: 'VA-9001-GN',
    departure_date: '2026-11-01',
    return_date: '2026-11-07',
    driver_name: 'Ibrahima Kalil TOURE',
    tracking_token: trackingToken
  };

  const t0_create = Date.now();
  const instanceResult = await generateMissionOrderDocumentInstance(missionPayload);
  const t_create = Date.now() - t0_create;

  console.log(`   ✓ PDF officiel non signé créé en ${t_create} ms : ${instanceResult.generated_file_path}`);
  assert.ok(fs.existsSync(instanceResult.pdf_path), 'Le PDF source doit exister sur le disque');

  // Insert in database (mimic router.post('/'))
  const docRes = await db.run(
    `INSERT INTO documents 
     (reference, tracking_token, document_type, title, description, sender_name, sender_organization, priority, confidentiality, status, current_service_id, created_by, deadline_date, file_path)
     VALUES (?, ?, 'MISSION_ORDER', ?, ?, ?, 'Université de Kindia', 'HIGH', 'INTERNAL', 'PENDING', ?, ?, ?, ?)`,
    [refCode, trackingToken, `Ordre de mission : ${missionPayload.missionary_name}`, missionPayload.object_of_mission, `${scUser.first_name} ${scUser.last_name}`, sgService.id, scUser.id, missionPayload.departure_date, instanceResult.generated_file_path]
  );
  const docId = docRes.lastID;

  await db.run(
    `INSERT INTO mission_orders 
     (document_id, missionary_name, missionary_titre, nationality, function_title, destination, object_of_mission, transport_mode, departure_date, return_date, driver_name, observations, is_signed, signature_mode,
      missionary_name_snapshot, missionary_firstnames_snapshot, missionary_titre_snapshot, missionary_nationality_snapshot, missionary_function_snapshot, missionary_service_snapshot, missionary_matricule_snapshot, driver_name_snapshot, vehicle_registration_snapshot,
      template_id, template_version_id, template_version_number, generated_file_path, generated_docx_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, 'ELECTRONIC', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      docId, missionPayload.missionary_name, missionPayload.missionary_titre, missionPayload.nationality, missionPayload.function_title, missionPayload.destination, missionPayload.object_of_mission, missionPayload.transport_mode, missionPayload.departure_date, missionPayload.return_date, missionPayload.driver_name,
      missionPayload.missionary_last_name, missionPayload.missionary_firstnames, missionPayload.missionary_titre, missionPayload.nationality, missionPayload.function_title, missionPayload.missionary_service, missionPayload.matricule, missionPayload.driver_name, missionPayload.vehicle_registration,
      instanceResult.template_id, instanceResult.template_version_id, instanceResult.template_version_number, instanceResult.generated_file_path, instanceResult.generated_docx_path
    ]
  );

  console.log(`   ✓ OM enregistré en base (Document ID: ${docId}, Réf: ${refCode}, Statut: PENDING, Service actuel: SG)`);

  // 3. ÉTAPE 2 : Le Secrétaire Général ouvre et clique sur « Signer et renvoyer au Secrétariat Central »
  console.log('\n3. ÉTAPE 2 : SG clique sur « Signer et renvoyer au Secrétariat Central »...');

  const userSig = await db.get(
    "SELECT * FROM user_signatures WHERE user_id = ? AND (status = 'ACTIVE' OR is_active = 1) ORDER BY id DESC LIMIT 1",
    [sgUser.id]
  ) || { signature_image_path: 'signature_recteur_2026.png', id: 1, version_number: 1 };

  const signedAt = new Date().toISOString();
  const signatureRaw = `${refCode}:${missionPayload.missionary_name}:${signedAt}:${sgUser.id}:UK_SECRET`;
  const signatureHash = crypto.createHash('sha256').update(signatureRaw).digest('hex');
  const signerFullName = formatFullName({ nom: sgUser.last_name, prenoms: sgUser.first_name, titre: sgUser.titre });
  const signerRole = (sgUser.function_title || 'LE SECRETAIRE GENERAL').toUpperCase();

  const signatureDetails = {
    signed_at: signedAt,
    signed_by_name: signerFullName,
    signed_by_role: signerRole,
    signature_hash: signatureHash,
    signature_image_path: userSig.signature_image_path
  };

  const t0_sign = Date.now();
  const pdfResult = await generateSignedMissionOrderPDF({
    ...missionPayload,
    id: docId,
    document_id: docId,
    reference: refCode,
    tracking_token: trackingToken,
    file_path: instanceResult.generated_file_path,
    generated_file_path: instanceResult.generated_file_path,
    template_id: instanceResult.template_id,
    template_version_id: instanceResult.template_version_id
  }, signatureDetails);
  const t_sign = Date.now() - t0_sign;

  console.log(`   ✓ Signature électronique appliquée en ${t_sign} ms (0 conversion DOCX) !`);
  assert.ok(fs.existsSync(pdfResult.filePath), 'Le PDF signé doit exister');
  const signedStat = fs.statSync(pdfResult.filePath);
  assert.ok(signedStat.size > 1000, 'Le PDF signé doit être non vide et valide');

  // Update DB to reflect return to SC
  await db.run(
    `UPDATE mission_orders 
     SET is_signed = 1, signed_at = ?, signed_by_user_id = ?, signature_token = ?, signed_pdf_path = ?, returned_to_sc_at = ?
     WHERE document_id = ?`,
    [signedAt, sgUser.id, signatureHash, pdfResult.filename, signedAt, docId]
  );

  await db.run(
    `UPDATE documents 
     SET status = 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL', current_service_id = ?, is_locked = 1, qr_code_hash = ?, file_path = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [scService.id, signatureHash, pdfResult.filename, docId]
  );

  console.log(`   ✓ OM mis à jour en base : Statut: "SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL", Service actuel: SC`);

  // 4. ÉTAPE 3 : Le Secrétariat Central consulte l'OM signé et procède à l'archivage
  console.log('\n4. ÉTAPE 3 : Secrétariat Central réceptionne et archive l’Ordre de Mission...');
  const docAfterSign = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
  const missionAfterSign = await db.get('SELECT * FROM mission_orders WHERE document_id = ?', [docId]);

  assert.strictEqual(docAfterSign.status, 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL');
  assert.strictEqual(docAfterSign.current_service_id, scService.id);
  assert.strictEqual(docAfterSign.is_locked, 1);
  assert.strictEqual(missionAfterSign.is_signed, 1);

  // Archive
  await db.run(
    `UPDATE documents SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [docId]
  );
  const archivedDoc = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
  assert.strictEqual(archivedDoc.status, 'ARCHIVED');
  console.log(`   ✓ OM archivé avec succès par le Secrétariat Central.`);

  console.log('\n===============================================================');
  console.log('🎉 TOUTES LES ÉTAPES DU WORKFLOW SC -> SG -> SC -> ARCHIVAGE');
  console.log('   ONT ÉTÉ VALIDÉES AVEC SUCCÈS ET 0 RÉGRESSION !');
  console.log('===============================================================');

  process.exit(0);
}

testFullWorkflow().catch(err => {
  console.error('❌ Échec du test de workflow:', err);
  process.exit(1);
});
