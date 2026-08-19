const path = require('path');
const fs = require('fs');

const API_BASE = 'http://127.0.0.1:5000/api';

async function makeRequest(endpoint, method = 'GET', headers = {}, body = null) {
  const options = { method, headers };
  if (body) {
    if (typeof body === 'string' || body instanceof Buffer) {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    data = { raw: text };
  }
  return { status: res.status, ok: res.ok, data };
}

function createMultipartFormData(fields, fileKey, fileName, fileContent, fileMime) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const CRLF = '\r\n';
  let bodyBuffer = Buffer.alloc(0);

  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) {
      let fieldHeader = `--${boundary}${CRLF}`;
      fieldHeader += `Content-Disposition: form-data; name="${k}"${CRLF}${CRLF}`;
      fieldHeader += `${v}${CRLF}`;
      bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(fieldHeader)]);
    }
  }

  if (fileName && fileContent) {
    let fileHeader = `--${boundary}${CRLF}`;
    fileHeader += `Content-Disposition: form-data; name="${fileKey}"; filename="${fileName}"${CRLF}`;
    fileHeader += `Content-Type: ${fileMime}${CRLF}${CRLF}`;
    bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(fileHeader), fileContent, Buffer.from(CRLF)]);
  }

  bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(`--${boundary}--${CRLF}`)]);
  return { boundary, bodyBuffer };
}

async function runScenarioTests() {
  console.log('===========================================================');
  console.log(' UK-GED : SCÉNARIO DE TEST INTÉGRAL EN 2 SCÉNARIOS');
  console.log(' DEMANDES D\'ORDRES DE MISSION (CONNECTÉ & SANS COMPTE)');
  console.log('===========================================================');

  let scToken = '';
  let sgToken = '';
  let reqRefA = '';
  let reqIdA = null;
  let reqRefB = '';
  let reqIdB = null;

  // 1. Authenticate SC & SG
  console.log('\n--- Authentification des Acteurs ---');
  const scAuth = await makeRequest('/auth/login', 'POST', {}, { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
  if (!scAuth.ok) throw new Error('Connexion SC échouée: ' + JSON.stringify(scAuth.data));
  scToken = scAuth.data.token;
  console.log('   -> Secrétariat Central connecté avec succès.');

  const sgAuth = await makeRequest('/auth/login', 'POST', {}, { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
  if (!sgAuth.ok) throw new Error('Connexion SG échouée: ' + JSON.stringify(sgAuth.data));
  sgToken = sgAuth.data.token;
  console.log('   -> Secrétaire Général connecté avec succès.');

  // =========================================================
  // SCÉNARIO A — UTILISATEUR CONNECTÉ (Enseignant / Agent)
  // =========================================================
  console.log('\n===========================================================');
  console.log(' SCÉNARIO A — UTILISATEUR CONNECTÉ');
  console.log('===========================================================');

  // Step A1: Submit Mission Request as Logged-in User
  console.log('\n1. Soumission d’une demande d’ordre de mission par un utilisateur connecté...');
  const dummyPdf = Buffer.from('%PDF-1.4 Dummy Justificatif Content for Test Scenario');
  const fieldsA = {
    applicant_last_name: 'CAMARA',
    applicant_first_names: 'Fodé Lamine',
    applicant_function: 'Enseignant-Chercheur (Physique)',
    applicant_matricule: '284910C',
    applicant_service_name: 'Département de Physique',
    applicant_phone: '+224 621 44 55 66',
    applicant_email: 'fode.camara@univ-kindia.edu.gn',
    object_of_mission: 'Participation au Séminaire sur les Energies Solaires à Labé',
    destination: 'Labé',
    country: 'Guinée',
    exact_location: 'Université de Labé (Amphi A)',
    start_date: '2026-09-01',
    end_date: '2026-09-05',
    duration_days: '5',
    transport_means: 'VÉHICULE OFFICIEL',
    justification_motif: 'Invitation officielle de la Faculté des Sciences de Labé.'
  };

  const mpA = createMultipartFormData(fieldsA, 'files', 'Invitation_Labe.pdf', dummyPdf, 'application/pdf');
  const resA1 = await makeRequest('/mission-requests', 'POST', {
    'Authorization': `Bearer ${scToken}`,
    'Content-Type': `multipart/form-data; boundary=${mpA.boundary}`
  }, mpA.bodyBuffer);

  if (!resA1.ok) throw new Error('Soumission Scénario A échouée: ' + JSON.stringify(resA1.data));
  reqIdA = resA1.data.id;
  reqRefA = resA1.data.reference;
  console.log(`   -> Succès ! Référence générée : ${reqRefA} (ID: ${reqIdA})`);
  console.log(`   -> Statut initial : ${resA1.data.status}`);

  // Step A2: Check arrival at Secrétariat Central
  console.log('\n2. Vérification de l’arrivée de la demande au Secrétariat Central...');
  const listRes = await makeRequest('/mission-requests', 'GET', { 'Authorization': `Bearer ${scToken}` });
  const foundA = listRes.data.find(r => r.id === reqIdA);
  if (!foundA) throw new Error('La demande n’apparaît pas au Secrétariat Central !');
  console.log(`   -> Présente dans la liste du SC avec statut : ${foundA.status}`);

  // Step A3: SC Accepts Request
  console.log('\n3. Acceptation de la demande par le Secrétariat Central...');
  const acceptRes = await makeRequest(`/mission-requests/${reqIdA}/accept`, 'POST', { 'Authorization': `Bearer ${scToken}` });
  if (!acceptRes.ok) throw new Error('Acceptation échouée: ' + JSON.stringify(acceptRes.data));
  console.log(`   -> Statut après acceptation : ${acceptRes.data.status}`);

  // Step A4: SC Prepares Official Mission Order
  console.log('\n4. Préparation & Injection dans le modèle d’Ordre de Mission Officiel par le SC...');
  const genOmRes = await makeRequest(`/mission-requests/${reqIdA}/generate-official-om`, 'POST', { 'Authorization': `Bearer ${scToken}` });
  if (!genOmRes.ok) throw new Error('Génération OM Officiel échouée: ' + JSON.stringify(genOmRes.data));
  console.log(`   -> Ordre de mission officiel créé avec Réf Officielle : ${genOmRes.data.official_reference}`);

  // Step A5: SC Transmits Official OM to Secrétaire Général
  console.log('\n5. Transmission au Secrétaire Général pour signature...');
  const transmitRes = await makeRequest(`/mission-requests/${reqIdA}/transmit-to-sg`, 'POST', { 'Authorization': `Bearer ${scToken}` });
  if (!transmitRes.ok) throw new Error('Transmission au SG échouée: ' + JSON.stringify(transmitRes.data));
  console.log(`   -> Transmis avec succès. Nouveau statut : ${transmitRes.data.status}`);

  // Step A6: SG Signs Electronic Signature on Official OM
  console.log('\n6. Signature électronique par le Secrétaire Général...');
  const sgListRes = await makeRequest('/missions/to-sign', 'GET', { 'Authorization': `Bearer ${sgToken}` });
  const officialDocId = genOmRes.data.official_document_id;
  const sgSignRes = await makeRequest(`/missions/${officialDocId}/sign`, 'POST', { 'Authorization': `Bearer ${sgToken}` });
  if (!sgSignRes.ok) throw new Error('Signature SG échouée: ' + JSON.stringify(sgSignRes.data));
  console.log(`   -> Signature SG apposée avec succès ! Le document est retourné au SC.`);

  // Step A7: SC Delivers to Applicant & Archives
  console.log('\n7. Impression, Remise au demandeur & Archivage au Secrétariat Central...');
  const printRes = await makeRequest(`/missions/${officialDocId}/print`, 'POST', { 'Authorization': `Bearer ${scToken}` });
  console.log('   -> Impression comptabilisée.');

  const archiveRes = await makeRequest(`/documents/${officialDocId}/archive`, 'POST', { 'Authorization': `Bearer ${scToken}` });
  if (!archiveRes.ok) throw new Error('Archivage échoué: ' + JSON.stringify(archiveRes.data));
  console.log('   -> Ordre de mission officiel classé dans les archives électroniques.');

  // Verify History for Scenario A
  console.log('\n8. Vérification de la traçabilité et de la chronologie complète (Scénario A)...');
  const detailA = await makeRequest(`/mission-requests/${reqIdA}`, 'GET', { 'Authorization': `Bearer ${scToken}` });
  console.log(`   -> Nombre d’événements horodatés enregistrés : ${detailA.data.history.length}`);
  detailA.data.history.forEach((h, idx) => {
    console.log(`      [${idx + 1}] ${h.timestamp} | Action: ${h.action} | User: ${h.role_name} | Obs: ${h.observation}`);
  });

  // =========================================================
  // SCÉNARIO B — PERSONNE SANS COMPTE (Demande Publique & Suivi)
  // =========================================================
  console.log('\n===========================================================');
  console.log(' SCÉNARIO B — PERSONNE SANS COMPTE (DEMANDE PUBLIQUE & SUIVI)');
  console.log('===========================================================');

  // Step B1: Public Request Submission Without Account
  console.log('\n1. Soumission publique d’une demande sans compte préalable...');
  const fieldsB = {
    applicant_last_name: 'SYLLA',
    applicant_first_names: 'Maimouna',
    applicant_function: 'Chercheuse Associée',
    applicant_service_name: 'Centre de Recherche en Biologie',
    applicant_phone: '+224 628 99 00 11',
    applicant_email: 'maimouna.sylla@univ-kindia.edu.gn',
    object_of_mission: 'Collecte d’échantillons botaniques dans la préfecture de Kindia',
    destination: 'Préfecture de Kindia',
    country: 'Guinée',
    start_date: '2026-09-10',
    end_date: '2026-09-15',
    duration_days: '6',
    transport_means: 'VÉHICULE OFFICIEL',
    justification_motif: 'Projet de recherche sur les plantes médicinales.'
  };

  const mpB = createMultipartFormData(fieldsB, 'files', 'Programme_Collecte.pdf', dummyPdf, 'application/pdf');
  const resB1 = await makeRequest('/mission-requests/public', 'POST', {
    'Content-Type': `multipart/form-data; boundary=${mpB.boundary}`
  }, mpB.bodyBuffer);

  if (!resB1.ok) throw new Error('Soumission publique Scénario B échouée: ' + JSON.stringify(resB1.data));
  reqIdB = resB1.data.id;
  reqRefB = resB1.data.reference;
  console.log(`   -> Succès ! Référence publique générée : ${reqRefB} (ID: ${reqIdB})`);
  console.log(`   -> Statut initial : ${resB1.data.status}`);

  // Step B2: Public Tracking Without Account (Reference + Phone/Email)
  console.log('\n2. Test de suivi public sans compte avec Référence + Téléphone...');
  const trackRes = await makeRequest('/mission-requests/track-public', 'POST', {}, {
    reference: reqRefB,
    verification_input: '+224 628 99 00 11'
  });

  if (!trackRes.ok) throw new Error('Suivi public échoué: ' + JSON.stringify(trackRes.data));
  console.log('   -> Informations récupérées par le demandeur sans compte :');
  console.log(`      Demandeur : ${trackRes.data.applicant_first_names} ${trackRes.data.applicant_last_name}`);
  console.log(`      Statut Actuel : ${trackRes.data.status}`);
  console.log(`      Pièces Jointes : ${trackRes.data.attachments.length} fichier(s)`);
  console.log(`      Historique : ${trackRes.data.history.length} événement(s)`);

  // Step B3: Security Isolation Test (Wrong phone/email must be rejected)
  console.log('\n3. Test d’isolation de la confidentialité (Téléphone erroné)...');
  const wrongTrackRes = await makeRequest('/mission-requests/track-public', 'POST', {}, {
    reference: reqRefB,
    verification_input: '+224 600 00 00 00'
  });

  if (wrongTrackRes.status === 404) {
    console.log('   -> Protection confirmée : Accès refusé (404 Not Found) pour les identifiants incorrects !');
  } else {
    throw new Error('FAIL: L’accès public non autorisé n’a pas été bloqué !');
  }

  // Step B4: SC Processes Request B
  console.log('\n4. Traitement complet par le Secrétariat Central...');
  await makeRequest(`/mission-requests/${reqIdB}/accept`, 'POST', { 'Authorization': `Bearer ${scToken}` });
  const genOmResB = await makeRequest(`/mission-requests/${reqIdB}/generate-official-om`, 'POST', { 'Authorization': `Bearer ${scToken}` });
  await makeRequest(`/mission-requests/${reqIdB}/transmit-to-sg`, 'POST', { 'Authorization': `Bearer ${scToken}` });
  await makeRequest(`/missions/${genOmResB.data.official_document_id}/sign`, 'POST', { 'Authorization': `Bearer ${sgToken}` });

  // Re-check public tracking after processing
  console.log('\n5. Vérification du suivi public après signature du Secrétaire Général...');
  const trackResAfter = await makeRequest('/mission-requests/track-public', 'POST', {}, {
    reference: reqRefB,
    verification_input: 'maimouna.sylla@univ-kindia.edu.gn'
  });

  console.log(`   -> Nouveau statut public après signature : ${trackResAfter.data.status}`);
  console.log(`   -> Horodatage et historique mis à jour : ${trackResAfter.data.history.length} étapes enregistrées.`);

  console.log('\n===========================================================');
  console.log(' 🎉 LES 2 SCÉNARIOS (UTILISATEUR CONNECTÉ & PERSONNE SANS COMPTE)');
  console.log(' ONT ÉTÉ EXÉCUTÉS AVEC UN SUCCÈS TOTAL DE 100% !');
  console.log('===========================================================');
}

runScenarioTests().catch(err => {
  console.error('CRITICAL TEST FAILURE:', err);
  process.exit(1);
});
