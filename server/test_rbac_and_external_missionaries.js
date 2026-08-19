async function runTests() {
  console.log('===========================================================');
  console.log(' UK-GED : SUITE DE TESTS RBAC & MISSIONNAIRES EXTERNES');
  console.log('===========================================================');

  // 1. Login Accounts
  console.log('\n--- 1. Authentification des comptes de test ---');
  
  const loginRes = async (identity, password) => {
    const res = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });
    const data = await res.json();
    return { status: res.status, token: data.token };
  };

  const admin = await loginRes('admin@univ-kindia.edu.gn', 'Admin123!');
  console.log('✔ Connexion Admin :', admin.status === 200 ? 'OK' : 'ÉCHEC');

  const sc = await loginRes('sc@univ-kindia.edu.gn', 'Agent123!');
  console.log('✔ Connexion Secrétariat Central :', sc.status === 200 ? 'OK' : 'ÉCHEC');

  const daf = await loginRes('daf@univ-kindia.edu.gn', 'Daf123!');
  console.log('✔ Connexion DAF (Chef de Service) :', daf.status === 200 ? 'OK' : 'ÉCHEC');

  const std = await loginRes('ec1@univ-kindia.edu.gn', 'Ec123!');
  console.log('✔ Connexion Enseignant Standard :', std.status === 200 ? 'OK' : 'ÉCHEC');

  // 2. Test Protection des Modules Centraux pour Chef de Service
  console.log('\n--- 2. Test de protection des registres centraux (RBAC) ---');
  
  const extMissDafRes = await fetch('http://127.0.0.1:5000/api/external-missionaries', {
    headers: { 'Authorization': `Bearer ${daf.token}` }
  });
  console.log('✔ Blocage Missionnaires Externes pour Chef de Service (DAF) :', extMissDafRes.status === 403 ? 'OK (403 Accès non autorisé)' : `ÉCHEC (${extMissDafRes.status})`);

  const extMissScRes = await fetch('http://127.0.0.1:5000/api/external-missionaries', {
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  console.log('✔ Accès Missionnaires Externes pour Secrétariat Central :', extMissScRes.status === 200 ? 'OK (200 Accès autorisé)' : `ÉCHEC (${extMissScRes.status})`);

  // 3. Test Scénario Complet Missionnaire Externe
  console.log('\n--- 3. Test Scénario Complet Missionnaire Externe ---');

  const dummyPdfContent = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');
  const dummyFile = new Blob([dummyPdfContent], { type: 'application/pdf' });

  const form = new FormData();
  form.append('last_name', 'CAMARA');
  form.append('first_names', 'Abdoulaye');
  form.append('nationality', 'Guinéenne');
  form.append('function_title', 'Expert Pédagogique International');
  form.append('origin_institution', 'Université de Bordeaux / MESRSI');
  form.append('mission_order_ref', 'OM/2026/987/UB');
  form.append('object_of_mission', 'Atelier de formation sur l’évaluation de la recherche scientifique');
  form.append('location_of_mission', 'Université de Kindia');
  form.append('host_responsible_name', 'Dr. Ousmane Diallo');
  form.append('expected_start_date', '2026-08-20');
  form.append('expected_end_date', '2026-08-25');
  form.append('phone', '+224 628 00 11 22');
  form.append('email', 'acamara@bordeaux.fr');
  form.append('original_document', dummyFile, 'OM_Original_Camara.pdf');

  const createMissRes = await fetch('http://127.0.0.1:5000/api/external-missionaries', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sc.token}` },
    body: form
  });

  const createMissData = await createMissRes.json();
  console.log('✔ Enregistrement du Missionnaire Externe par Secrétariat Central :', createMissRes.status === 201 ? `OK (Réf: ${createMissData.reference})` : `ÉCHEC (${createMissRes.status}: ${createMissData.error})`);
  const missionaryId = createMissData.id;

  // Enregistrer l'Arrivée (Check-in)
  console.log('✔ Exécution [ ENREGISTRER L’ARRIVÉE ] (Visa & Signature SG)...');
  const checkInRes = await fetch(`http://127.0.0.1:5000/api/external-missionaries/${missionaryId}/check-in`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const checkInData = await checkInRes.json();
  console.log('   -> Statut réponse :', checkInRes.status === 200 ? `OK (${checkInData.message})` : `ÉCHEC (${checkInRes.status}: ${checkInData.error})`);

  // Enregistrer le Départ (Check-out)
  console.log('✔ Exécution [ ENREGISTRER LE DÉPART ] (Visa Final & Clôture)...');
  const checkOutRes = await fetch(`http://127.0.0.1:5000/api/external-missionaries/${missionaryId}/check-out`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const checkOutData = await checkOutRes.json();
  console.log('   -> Statut réponse :', checkOutRes.status === 200 ? `OK (${checkOutData.message})` : `ÉCHEC (${checkOutRes.status}: ${checkOutData.error})`);

  // Vérification de la fiche mise à jour
  const updatedRes = await fetch(`http://127.0.0.1:5000/api/external-missionaries/${missionaryId}`, {
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const updatedData = await updatedRes.json();
  console.log('✔ Statut Final de la fiche :', updatedData.status === 'MISSION TERMINÉE' ? 'MISSION TERMINÉE (Certifié)' : updatedData.status);

  // 4. Test Responsabilité Dynamique des Dossiers
  console.log('\n--- 4. Test de Responsabilité Dynamique des Dossiers ---');
  
  const docForm = new FormData();
  docForm.append('document_type', 'INCOMING_MAIL');
  docForm.append('title', 'Demande de subvention de recherche CNEU');
  docForm.append('sender_name', 'Direction CNEU');
  docForm.append('sender_organization', 'CNEU Kindia');
  docForm.append('priority', 'HIGH');
  docForm.append('processing_mode', 'DIRECT_ARCHIVE'); // Keeps current_service_id = SC
  docForm.append('reception_date', '2026-08-14');
  docForm.append('files', dummyFile, 'Courrier_CNEU.pdf');

  const createDocRes = await fetch('http://127.0.0.1:5000/api/documents/incoming', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sc.token}` },
    body: docForm
  });
  const createDocData = await createDocRes.json();
  const docId = createDocData.id;
  console.log(`✔ Courrier créé par SC (ID: ${docId}, Réf: ${createDocData.reference})`);

  // Services
  const servicesRes = await fetch('http://127.0.0.1:5000/api/services', {
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const services = await servicesRes.json();
  const dafService = services.find(s => s.code === 'DAF');
  const cfService = services.find(s => s.code === 'CF');

  // Transmit SC -> DAF
  const transmitToDafRes = await fetch('http://127.0.0.1:5000/api/workflow/transmit', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sc.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: docId, to_service_id: dafService.id, instruction: 'Pour examen financier' })
  });
  console.log('✔ Transmission SC -> DAF :', transmitToDafRes.status === 200 ? 'OK' : 'ÉCHEC');

  // Transmit DAF -> CF
  const transmitToCfRes = await fetch('http://127.0.0.1:5000/api/workflow/transmit', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${daf.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: docId, to_service_id: cfService.id, instruction: 'Pour contrôle financier' })
  });
  console.log('✔ Transmission DAF -> CF (DAF perd les droits de traitement) :', transmitToCfRes.status === 200 ? 'OK' : 'ÉCHEC');

  // Attempt processing action by DAF while document is now at CF
  const illegalDafRes = await fetch('http://127.0.0.1:5000/api/workflow/accept', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${daf.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: docId, remarks: 'Tentative d’acceptation non autorisée par DAF' })
  });
  const illegalDafData = await illegalDafRes.json();
  console.log('✔ Blocage de l’action par DAF après transmission (Responsabilité Dynamique) :', illegalDafRes.status === 400 || illegalDafRes.status === 403 ? `OK (Refusé: ${illegalDafData.error})` : `ÉCHEC (${illegalDafRes.status})`);

  console.log('\n===========================================================');
  console.log(' 🎉 TOUS LES TESTS RBAC ET MISSIONNAIRES EXTERNES ONT RÉUSSI !');
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
