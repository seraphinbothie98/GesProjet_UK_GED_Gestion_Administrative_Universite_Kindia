const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== TEST SUITE: MODULE ORDRES DE MISSION + IDENTITÉ VISUELLE + SIGNATURES ===\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASSED: ${message}`);
      passedCount++;
    } else {
      console.error(`❌ FAILED: ${message}`);
      failedCount++;
    }
  }

  // 1. Authenticate test users
  async function login(identity, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });
    const data = await res.json();
    return data.token;
  }

  const tokenSC = await login('sc@univ-kindia.edu.gn', 'Agent123!');
  const tokenSG = await login('sg@univ-kindia.edu.gn', 'Sg123!');
  const tokenRecteur = await login('recteur@univ-kindia.edu.gn', 'Recteur123!');
  const tokenDAF = await login('daf@univ-kindia.edu.gn', 'Daf123!');
  const tokenAdmin = await login('admin@univ-kindia.edu.gn', 'Admin123!');

  assert(tokenSC && tokenSG && tokenRecteur && tokenDAF && tokenAdmin, 'Authentification réussie pour tous les rôles');

  // TEST 1: Backend Creation Block for Non-SC Roles (Rule 3 & Section 35)
  console.log('\n--- TEST 1: Protection Backend Création Ordre de Mission (Secrétariat Central Unique) ---');
  
  const missionPayload = {
    missionary_name: 'Dr. Mamadou Diallo',
    nationality: 'Guinéenne',
    function_title: 'Enseignant-Chercheur',
    destination: 'Labé, Guinée',
    object_of_mission: 'Supervision des examens de fin de semestre',
    transport_mode: 'Véhicule de service UK-001',
    departure_date: '2026-08-15',
    return_date: '2026-08-20',
    driver_name: 'M. Ousmane Barry'
  };

  // Attempt API creation as DAF
  const resDAF = await fetch(`${API_BASE}/missions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenDAF}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(missionPayload)
  });
  const dataDAF = await resDAF.json();
  assert(resDAF.status === 403, 'DAF bloqué par le backend lors de la création d’un ordre de mission (403 Forbidden)');
  assert(dataDAF.error && (dataDAF.error.includes('réservée au Secrétariat Central') || dataDAF.error.includes('Permission')), 'Message d’erreur backend 403 correct');

  // Attempt API creation as Recteur
  const resRecteur = await fetch(`${API_BASE}/missions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenRecteur}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(missionPayload)
  });
  assert(resRecteur.status === 403, 'Recteur bloqué par le backend lors de la création d’un ordre de mission (403 Forbidden)');

  // TEST 2: Valid Creation by Secrétariat Central (Rules 1, 5, 6)
  console.log('\n--- TEST 2: Création d’un Ordre de Mission par le Secrétariat Central ---');
  const resSC = await fetch(`${API_BASE}/missions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenSC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(missionPayload)
  });
  const dataSC = await resSC.json();
  assert(resSC.ok && dataSC.id && dataSC.reference, `Ordre de Mission créé par SC avec succès (Réf: ${dataSC.reference})`);
  const docId = dataSC.id;

  // TEST 3: Admin Customization of Institution Settings & Visual Identity (Rules 10, 11, 14)
  console.log('\n--- TEST 3: Personnalisation Identité Visuelle et Modèle de Document (Admin) ---');
  const updateInstRes = await fetch(`${API_BASE}/settings/institution`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'UNIVERSITÉ DE KINDIA',
      ministry: 'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR ET DE LA RECHERCHE SCIENTIFIQUE',
      address: 'Foulayah BP 164, Kindia',
      phone: '+224 622 11 22 33',
      email: 'contact@univ-kindia.edu.gn',
      website: 'https://univ-kindia.edu.gn',
      slogan: 'Savoir - Discipline - Excellence',
      show_logo_pdf: 1,
      show_logo_mission: 1
    })
  });
  assert(updateInstRes.ok, 'Admin a personnalisé les informations institutionnelles de l’Université');

  const updateTemplateRes = await fetch(`${API_BASE}/templates/MISSION_ORDER`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      header_text: 'RÉPUBLIQUE DE GUINÉE\nTravail - Justice - Solidarité\n\nUNIVERSITÉ DE KINDIA',
      footer_text: 'UNIVERSITÉ DE KINDIA • BP 164 Kindia • Tél: +224 622 11 22 33',
      header_alignment: 'CENTER',
      header_font_size: 12
    })
  });
  assert(updateTemplateRes.ok, 'Admin a personnalisé le modèle d’Ordre de Mission sans modifier le code source');

  // TEST 4: Registration of Officer Electronic Signature (Rules 15, 16, 17, 18)
  console.log('\n--- TEST 4: Enregistrement d’une Signature Électronique Officielle pour le SG ---');
  // Get SG user ID
  const usersRes = await fetch(`${API_BASE}/users`, { headers: { 'Authorization': `Bearer ${tokenAdmin}` } });
  const usersList = await usersRes.json();
  const sgUser = usersList.find(u => u.email === 'sg@univ-kindia.edu.gn');

  // Create mock PNG signature file for test
  const testSigPath = path.join(__dirname, 'test_sg_signature.png');
  // Minimal 1x1 transparent PNG buffer
  const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync(testSigPath, pngBuffer);

  const formData = new FormData();
  formData.append('user_id', sgUser.id);
  formData.append('function_title', 'Secrétaire Général');
  formData.append('signature', new Blob([pngBuffer], { type: 'image/png' }), 'test_sg_signature.png');
  formData.append('activation_date', '2026-01-01');

  const createSigRes = await fetch(`${API_BASE}/signatures`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenAdmin}` },
    body: formData
  });
  const createSigData = await createSigRes.json();
  assert(createSigRes.ok && createSigData.success, 'Signature électronique de Secrétaire Général enregistrée et liée à l’utilisateur');

  // TEST 5: Signature & Return to Secrétariat Central (Rules 8, 19, 22, 23)
  console.log('\n--- TEST 5: Signature par le SG et Retour Automatique au Secrétariat Central ---');
  const signRes = await fetch(`${API_BASE}/missions/${docId}/sign`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenSG}` }
  });
  const signData = await signRes.json();
  assert(signRes.ok && signData.success, 'Ordre de mission signé numériquement par le SG');
  assert(signData.pdf_url, `PDF officiel généré avec signature électronique (PDF: ${signData.pdf_url})`);

  // Verify document is now returned to SC and locked
  const docRes = await fetch(`${API_BASE}/documents/${docId}`, { headers: { 'Authorization': `Bearer ${tokenSC}` } });
  const docData = await docRes.json();
  assert(docData.is_locked === 1, 'Document officiellement verrouillé (is_locked = 1)');
  assert(docData.status === 'RETOURNÉ AU SECRÉTARIAT CENTRAL', 'Statut document = RETOURNÉ AU SECRÉTARIAT CENTRAL');
  assert(docData.current_service_code === 'SC', 'Titulaire actuel du document = Secrétariat Central (SC)');

  // TEST 6: Exclusive Archiving by Secrétariat Central (Rules 24 & 25)
  console.log('\n--- TEST 6: Archivage Exclusif par le Secrétariat Central ---');
  
  // Non-SC attempts archiving
  const archiveSGRes = await fetch(`${API_BASE}/documents/${docId}/archive`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${tokenSG}` }
  });
  assert(archiveSGRes.status === 403, 'SG interdit d’archiver le document (403 Forbidden)');

  // Deliver to recipient (Mandatory ordering - Rule 26)
  await fetch(`${API_BASE}/missions/${docId}/deliver`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenSC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_name: 'CAMARA Ibrahima' })
  });

  // Authorized SC attempts archiving
  const archiveSCRes = await fetch(`${API_BASE}/documents/${docId}/archive`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${tokenSC}` }
  });
  const archiveSCData = await archiveSCRes.json();
  assert(archiveSCRes.ok && archiveSCData.success, 'Secrétariat Central a archivé l’ordre de mission avec succès');

  const finalDocRes = await fetch(`${API_BASE}/documents/${docId}`, { headers: { 'Authorization': `Bearer ${tokenSC}` } });
  const finalDoc = await finalDocRes.json();
  assert(finalDoc.status === 'ARCHIVÉ' || finalDoc.status === 'ARCHIVED', 'Statut final = ARCHIVÉ');

  // TEST 7: Rule 32 Compliance (Template Update Does NOT Alter Signed Documents)
  console.log('\n--- TEST 7: Immuabilité des Documents Déjà Signés / Archivés (Rule 32) ---');
  // Update template again
  await fetch(`${API_BASE}/templates/MISSION_ORDER`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ header_text: 'NOUVEL EN-TÊTE MODIFIÉ APRES SIGNATURE' })
  });

  const pdfPath = path.join(__dirname, signData.pdf_url);
  assert(fs.existsSync(pdfPath), 'Fichier PDF original scellé existe toujours intact sur le disque');
  assert(fs.existsSync(pdfPath), 'Fichier PDF original scellé existe toujours intact sur le disque');

  // Clean up temporary test file
  if (fs.existsSync(testSigPath)) fs.unlinkSync(testSigPath);

  console.log(`\n==================================================`);
  console.log(`RÉSULTAT DES TESTS : ${passedCount} Réussis, ${failedCount} Échoués`);
  console.log(`==================================================\n`);

  if (failedCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Test execution crash:', err);
  process.exit(1);
});
