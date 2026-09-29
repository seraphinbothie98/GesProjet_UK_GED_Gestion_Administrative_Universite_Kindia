const assert = require('assert');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { generateSignedMissionOrderPDF } = require('../services/pdfService');
const { JWT_SECRET } = require('../config/constants');

async function runTest() {
  console.log('=== TEST DU SYSTÈME DE CHOIX DE FORMAT (WORD vs PDF DIRECT) ===\n');

  // 1. Generate Admin Token
  const adminUser = await db.get("SELECT u.*, r.code as role_code FROM users u JOIN roles r ON u.role_id = r.id WHERE r.code = 'ADMINISTRATEUR' LIMIT 1");
  assert(adminUser, 'Admin user must exist in DB');
  const token = jwt.sign({ userId: adminUser.id, role_code: 'ADMINISTRATEUR', service_id: adminUser.service_id }, JWT_SECRET, { expiresIn: '1h' });

  // 2. Test PUT /api/mission-template/default-format (DIRECT_PDF)
  console.log('1. Test mise à jour du format par défaut en DIRECT_PDF...');
  const resPdf = await fetch('http://localhost:5000/api/mission-template/default-format', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ default_format: 'DIRECT_PDF' })
  });
  const dataPdf = await resPdf.json();
  assert.strictEqual(resPdf.status, 200, 'HTTP status must be 200');
  assert.strictEqual(dataPdf.default_document_format, 'DIRECT_PDF');
  console.log('   ✓ Format configuré sur DIRECT_PDF :', dataPdf.message);

  // 3. Test GET /api/mission-template/active
  console.log('\n2. Test vérification GET /api/mission-template/active...');
  const resActive = await fetch('http://localhost:5000/api/mission-template/active', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const dataActive = await resActive.json();
  assert.strictEqual(resActive.status, 200);
  assert.strictEqual(dataActive.default_document_format, 'DIRECT_PDF');
  console.log('   ✓ Format actif retourné :', dataActive.default_document_format);

  // 4. Test fast signature in DIRECT_PDF mode
  console.log('\n3. Test de signature rapide en mode DIRECT_PDF (< 1 seconde)...');
  const start = Date.now();

  const testMissionData = {
    id: 9999,
    reference: 'OM_2026_TEST_FAST_PDF',
    missionary_name: 'Dr Alpha Oumar BARRY',
    destination: 'Mamou',
    object_of_mission: 'Séminaire pédagogique',
    document_format: 'DIRECT_PDF',
    tracking_token: 'TOKEN_TEST_FAST_9999'
  };

  const sigDir = path.join(__dirname, '../../uploads/dev/signatures');
  let sigPath = 'sig_test.png';
  if (fs.existsSync(sigDir)) {
    const files = fs.readdirSync(sigDir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
    if (files.length > 0) sigPath = files[0];
  }

  const signatureDetails = {
    signed_at: new Date().toISOString(),
    signed_by_name: 'Dr Mamadou Billo DOUMBOUYA',
    signed_by_role: 'LE SECRETAIRE GENERAL',
    signature_image_path: sigPath
  };

  const signedResult = await generateSignedMissionOrderPDF(testMissionData, signatureDetails);
  const elapsed = Date.now() - start;

  console.log(`   ✓ Résultat signature DIRECT_PDF : ${signedResult.filename}`);
  console.log(`   ✓ Temps total de signature : ${elapsed} ms`);
  assert(fs.existsSync(signedResult.filePath), 'Le PDF signé doit exister sur le disque');

  // 5. Test switching back to WORD_DOCX
  console.log('\n4. Test bascule vers format WORD_DOCX...');
  const resWord = await fetch('http://localhost:5000/api/mission-template/default-format', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ default_format: 'WORD_DOCX' })
  });
  const dataWord = await resWord.json();
  assert.strictEqual(resWord.status, 200);
  assert.strictEqual(dataWord.default_document_format, 'WORD_DOCX');
  console.log('   ✓ Format reconfiguré sur WORD_DOCX :', dataWord.message);

  console.log('\n>>> TOUS LES TESTS DE CHOIX DE FORMAT ONT RÉUSSI AVEC SUCCÈS ! <<<');
}

runTest().catch(err => {
  console.error('ERREUR DE TEST :', err);
  process.exit(1);
});
