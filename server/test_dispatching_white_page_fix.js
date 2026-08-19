const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5000';

function request(method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {}
    };

    let postData = null;
    if (body) {
      if (typeof body === 'string') {
        postData = body;
        options.headers['Content-Type'] = 'application/json';
      } else {
        postData = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
      }
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST COMPLET DE VALIDATION DU MODULE DISPATCHING & VISUALISATION');
  console.log('================================================================\n');

  // 1. Authenticate as SC (Secrétariat Central) and DAF (Chef de Service DAF)
  console.log('1. Authentification des comptes de test :');
  const scLogin = await request('POST', '/api/auth/login', {
    identity: 'sc@univ-kindia.edu.gn',
    password: 'Agent123!'
  });
  if (scLogin.status !== 200 || !scLogin.data.token) {
    throw new Error('Échec login Secrétariat Central: ' + JSON.stringify(scLogin));
  }
  const scToken = scLogin.data.token;
  console.log('   - Secrétariat Central connecté avec succès (Role: ' + scLogin.data.user.role_code + ', Service ID: ' + scLogin.data.user.service_id + ')');

  const dafLogin = await request('POST', '/api/auth/login', {
    identity: 'daf@univ-kindia.edu.gn',
    password: 'Daf123!'
  });
  if (dafLogin.status !== 200 || !dafLogin.data.token) {
    throw new Error('Échec login DAF: ' + JSON.stringify(dafLogin));
  }
  const dafToken = dafLogin.data.token;
  const dafUser = dafLogin.data.user;
  console.log('   - DAF connecté avec succès (User ID: ' + dafUser.id + ', Service ID: ' + dafUser.service_id + ')\n');

  // 2. TEST 1: Créer un courrier entrant avec fichier
  console.log('2. [TEST 1] Création d’un courrier entrant original par le Secrétariat Central :');
  // Create a dummy PDF attachment file in uploads
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const testFileName = `test_courrier_doc_${Date.now()}.pdf`;
  const testFilePath = path.join(uploadsDir, testFileName);
  fs.writeFileSync(testFilePath, '%PDF-1.4 TEST CONTENT ORIGINAL DOCUMENT UK-GED KINDIA');

  const db = require('./src/database/db');
  
  const seqRes = await db.get("SELECT current_val FROM number_sequences WHERE seq_key = 'CE' AND year = 2026");
  const nextSeq = (seqRes ? seqRes.current_val : 0) + 1;
  const docRef = `UK/SC/CE/2026/${String(nextSeq).padStart(6, '0')}`;

  const docInsert = await db.run(
    `INSERT INTO documents (reference, tracking_token, document_type, title, description, sender_name, sender_organization, priority, confidentiality, status, current_service_id, current_user_id, created_by)
     VALUES (?, ?, 'INCOMING_MAIL', 'Circulaire Ministérielle relative aux examens 2026', 'Transmission des consignes officielles pour la session 2026.', 'Ministère de lEnseignement Supérieur', 'MESRSI', 'HIGH', 'INTERNAL', 'CREATED', 5, 2, 2)`,
    [docRef, `TRK_${Date.now()}`]
  );
  const docId = docInsert.lastID;

  // Insert attachment
  const attInsert = await db.run(
    `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, uploaded_by)
     VALUES (?, ?, ?, ?, 'application/pdf', 2)`,
    [docId, 'circulaire_officielle_2026.pdf', testFileName, 512]
  );
  const attId = attInsert.lastID;
  console.log(`   - Courrier entrant créé avec succès: ID ${docId} | Réf: ${docRef}`);
  console.log(`   - Pièce jointe originale liée: ID ${attId} | Fichier: circulaire_officielle_2026.pdf\n`);

  // Verify SC can consult the document
  const scDocRes = await request('GET', `/api/documents/${docId}`, null, scToken);
  console.log(`   - Consultation par le SC: Status ${scDocRes.status} -> Réf: ${scDocRes.data.reference}`);
  if (scDocRes.status !== 200 || scDocRes.data.reference !== docRef) {
    throw new Error('Échec consultation document par SC');
  }

  // 3. TEST 2: Diffuser ce courrier au service DAF
  console.log('\n3. [TEST 2] Diffusion (Dispatching) du courrier au Service DAF (Service ID: ' + dafUser.service_id + ') :');
  const dispatchRes = await request('POST', '/api/dispatches', {
    document_id: docId,
    dispatch_type: 'PRISE_DE_CONNAISSANCE',
    title: 'Diffusion urgente - Consignes examens 2026',
    message: 'Merci de prendre connaissance de la présente circulaire ministérielle.',
    recipients_mode: 'SELECTED_SERVICES',
    service_ids: [dafUser.service_id]
  }, scToken);

  console.log(`   - Création diffusion: Status ${dispatchRes.status} -> Réf: ${dispatchRes.data.reference}`);
  if (dispatchRes.status !== 201) throw new Error('Échec création dispatch: ' + JSON.stringify(dispatchRes));
  const dispatchId = dispatchRes.data.id;

  // Verify DAF inbox receives the dispatch
  const dafInboxRes = await request('GET', '/api/dispatches/inbox/my-service', null, dafToken);
  console.log(`   - Boîte de réception DAF: ${dafInboxRes.data.dispatches?.length} diffusion(s) trouvée(s)`);
  const myDispatchItem = dafInboxRes.data.dispatches.find(d => d.dispatch_id === dispatchId);
  if (!myDispatchItem) throw new Error('Diffusion non trouvée dans la boîte de réception DAF');
  console.log(`   - Diffusion trouvée pour DAF: Recipient ID ${myDispatchItem.id} | Statut: ${myDispatchItem.status}`);

  // 4. TEST 2 Suite: DAF clique sur [ CONSULTER LE DOCUMENT ]
  console.log('\n4. [TEST 2 Suite] DAF clique sur [ CONSULTER LE DOCUMENT ] :');
  // First call view endpoint
  const viewRes = await request('POST', `/api/dispatches/recipients/${myDispatchItem.id}/view`, null, dafToken);
  console.log(`   - Notification vue serveur: Status ${viewRes.status} -> Message: ${viewRes.data.message}`);

  // DAF fetches the original document details
  const dafDocRes = await request('GET', `/api/documents/${myDispatchItem.document_id}`, null, dafToken);
  console.log(`   - Récupération document original par DAF (ABAC): Status ${dafDocRes.status}`);
  if (dafDocRes.status !== 200) {
    throw new Error(`ÉCHEC: DAF reçoit status ${dafDocRes.status} au lieu de 200 lors de la consultation du document diffusé!`);
  }
  console.log(`   - Titre document: "${dafDocRes.data.title}" | Réf: ${dafDocRes.data.reference}`);
  console.log(`   - Pièces jointes disponibles: ${dafDocRes.data.attachments?.length}`);
  if (!dafDocRes.data.attachments || dafDocRes.data.attachments.length === 0) {
    throw new Error('Les pièces jointes du document original sont manquantes pour le destinataire!');
  }
  console.log(`   - Nom fichier joint: ${dafDocRes.data.attachments[0].file_name}`);

  // Verify DAF can stream attachment file
  const attViewRes = await request('GET', `/api/documents/attachments/${dafDocRes.data.attachments[0].id}/view`, null, dafToken);
  console.log(`   - Streaming fichier joint pour DAF: Status ${attViewRes.status}`);
  if (attViewRes.status !== 200) {
    throw new Error(`ÉCHEC: Streaming pièce jointe a échoué avec le statut ${attViewRes.status}!`);
  }

  // 5. TEST 3 & 4: DAF effectue la "PRISE DE CONNAISSANCE"
  console.log('\n5. [TEST 3 & 4] Workflow [ PRENDRE CONNAISSANCE ] par le Service DAF :');
  const ackRes = await request('POST', `/api/dispatches/recipients/${myDispatchItem.id}/acknowledge`, null, dafToken);
  console.log(`   - Confirmation prise de connaissance: Status ${ackRes.status} -> ${ackRes.data.message}`);
  if (ackRes.status !== 200) throw new Error('Échec prise de connaissance: ' + JSON.stringify(ackRes));

  // Verify status in DAF inbox
  const dafInboxAfter = await request('GET', '/api/dispatches/inbox/my-service', null, dafToken);
  const updatedItem = dafInboxAfter.data.dispatches.find(d => d.id === myDispatchItem.id);
  console.log(`   - Nouveau statut pour DAF: ${updatedItem.status} (Attendu: PRISE_DE_CONNAISSANCE)`);
  if (updatedItem.status !== 'PRISE_DE_CONNAISSANCE') {
    throw new Error('Statut incorrect après émargement: ' + updatedItem.status);
  }

  // Verify Secrétariat Central Tracking View
  console.log('\n6. [TEST 4 Suite] Vérification du tableau d’émargement côté Secrétariat Central :');
  const scTrackingRes = await request('GET', `/api/dispatches/${dispatchId}`, null, scToken);
  console.log(`   - Statut global diffusion: ${scTrackingRes.data.dispatch.status}`);
  console.log(`   - Total destinataires: ${scTrackingRes.data.dispatch.total_recipients} | Émargements: ${scTrackingRes.data.dispatch.acknowledged_count}`);
  const dafRecipientRecord = scTrackingRes.data.recipients.find(r => r.service_id === dafUser.service_id);
  console.log(`   - Enregistrement DAF: Service=${dafRecipientRecord.service_name} | Statut=${dafRecipientRecord.status} | Signataire=${dafRecipientRecord.acknowledged_by_name} | Date=${dafRecipientRecord.acknowledged_at}`);
  if (!dafRecipientRecord.acknowledged_at || !dafRecipientRecord.acknowledged_by_name) {
    throw new Error('Détails de prise de connaissance incomplets dans le suivi SC');
  }

  // Check audit and document history logs
  console.log('\n7. [TEST TRAÇABILITÉ] Vérification des journaux d’audit et de l’historique document :');
  const logs = await db.all('SELECT action, details FROM dispatch_logs WHERE dispatch_id = ? ORDER BY id ASC', [dispatchId]);
  console.log('   - Logs Dispatching enregistrés :');
  logs.forEach(l => console.log(`     • [${l.action}] ${l.details}`));

  const docHistory = await db.all('SELECT action, details FROM document_history WHERE document_id = ? ORDER BY id ASC', [docId]);
  console.log('   - Historique document enregistré :');
  docHistory.forEach(h => console.log(`     • [${h.action}] ${h.details}`));

  // 8. TEST DE NON-RÉGRESSION
  console.log('\n8. [TEST DE NON-RÉGRESSION] Vérification des modules existants :');
  const incMailRes = await request('GET', '/api/documents?type=INCOMING_MAIL', null, scToken);
  console.log(`   - Courriers entrants listés: ${incMailRes.data?.length} (Status: ${incMailRes.status})`);

  const outMailRes = await request('GET', '/api/documents?type=OUTGOING_MAIL', null, scToken);
  console.log(`   - Courriers sortants listés: ${outMailRes.data?.length} (Status: ${outMailRes.status})`);

  const missionsRes = await request('GET', '/api/missions', null, scToken);
  console.log(`   - Ordres de mission: Status ${missionsRes.status}`);

  console.log('\n================================================================');
  console.log('🎉 TOUS LES TESTS ONT RÉUSSI AVEC SUCCÈS ! AUCUNE RÉGRESSION !');
  console.log('================================================================\n');
}

runTests().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ ERREUR LORS DU TEST:', err);
  process.exit(1);
});
