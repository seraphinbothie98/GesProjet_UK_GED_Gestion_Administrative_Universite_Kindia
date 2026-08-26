const assert = require('assert');
const http = require('http');

const PORT = 5000;

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (data) headers['Content-Length'] = Buffer.byteLength(postData);

    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: `/api${path}`,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(postData);
    req.end();
  });
}

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('🧪 TEST SUITE : TRANSMISSION INTER-SERVICES & WORKFLOW CONFIDENTIEL');
  console.log('================================================================\n');

  // 1. Authenticate users
  console.log('--- 1. AUTHENTIFICATION DES ACTEURS ---');
  const loginA = await request('POST', '/auth/login', { identity: 'chef_info@univ-kindia.edu.gn', password: 'Chef123!' });
  const tokenA = loginA.body.token;
  const userA = loginA.body.user;
  console.log(`✅ Service A (Expéditeur) : ${userA.first_name} ${userA.last_name} (${userA.service_name}, ID: ${userA.service_id})`);

  const loginB = await request('POST', '/auth/login', { identity: 'doyen_fs@univ-kindia.edu.gn', password: 'Doyen123!' });
  const tokenB = loginB.body.token;
  const userB = loginB.body.user;
  console.log(`✅ Service B (Destinataire) : ${userB.first_name} ${userB.last_name} (${userB.service_name}, ID: ${userB.service_id})`);

  const loginC = await request('POST', '/auth/login', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
  const tokenC = loginC.body.token;
  const userC = loginC.body.user;
  console.log(`✅ Service C (Tiers non autorisé) : ${userC.first_name} ${userC.last_name} (${userC.service_name}, ID: ${userC.service_id})`);

  // 2. Service A creates a document
  console.log('\n--- 2. SERVICE A CRÉE UN DOCUMENT & LE TRANSMET AU SERVICE B ---');
  const db = require('../database/db');
  const docNumber = `UK/FS_INFO/2026/TEST_${Date.now().toString().slice(-4)}`;
  const insertDocRes = await db.run(`
    INSERT INTO documents (
      reference, title, document_type, status, confidentiality, priority,
      created_by, current_service_id, originating_service_id, file_path
    ) VALUES (?, ?, 'SOIT_TRANSMIS', 'DRAFT', 'CONFIDENTIEL', 'NORMAL', ?, ?, ?, 'uploads/dev/test_rapport.pdf')
  `, [docNumber, 'Rapport Annuel Pédagogique Informatique 2026', userA.id, userA.service_id, userA.service_id]);

  const docId = insertDocRes.lastID;
  assert(docId, 'Le document doit être créé');
  console.log(`✅ Document créé : ${docNumber} (ID: ${docId})`);

  // Create Transmission A -> B
  const transmitRes = await request('POST', '/transmissions', {
    document_id: docId,
    to_service_id: userB.service_id,
    subject: 'Transmission Rapport Pédagogique INFO 2026 pour Signature',
    instruction: 'Merci d’examiner et d’apposer votre signature pour validation.',
    requires_signature: 1
  }, tokenA);

  assert.strictEqual(transmitRes.status, 201, 'La transmission doit être créée (201)');
  const transmissionId = transmitRes.body.transmissionId;
  const transmissionNumber = transmitRes.body.transmissionNumber;
  console.log(`✅ Transmission créée avec succès : ${transmissionNumber} (ID: ${transmissionId})`);

  // 3. Strict Confidentiality Verification for Service C (Tiers)
  console.log('\n--- 3. TEST D’ÉTANCHÉITÉ ABSOLUE : SERVICE C TENTE D’ACCÉDER ---');
  const cAccess = await request('GET', `/transmissions/${transmissionId}`, null, tokenC);
  assert.strictEqual(cAccess.status, 403, 'Service C doit recevoir une erreur 403 Forbidden sur la transmission');
  console.log(`✅ Sécurité OK : Service C bloqué avec 403 Forbidden : "${cAccess.body.error}"`);

  const cDocAccess = await request('GET', `/documents/${docId}`, null, tokenC);
  assert.strictEqual(cDocAccess.status, 403, 'Service C doit être bloqué sur l’accès direct au document (403)');
  console.log(`✅ Sécurité OK : Service C bloqué sur l’accès direct au document (403 Deny by Default)`);

  const cInbox = await request('GET', `/transmissions/inbox?search=${transmissionNumber}`, null, tokenC);
  assert.strictEqual(cInbox.body.length, 0, 'La recherche de Service C ne doit rien retourner');
  console.log(`✅ Sécurité OK : 0 résultat dans les recherches de Service C`);

  // 4. Service B checks inbox & acknowledges
  console.log('\n--- 4. SERVICE B REÇOIT LE COURRIER & ACCUSE RÉCEPTION ---');
  const bInbox = await request('GET', '/transmissions/inbox', null, tokenB);
  const foundInB = bInbox.body.find(t => t.id === transmissionId);
  assert(foundInB, 'Le courrier doit apparaître dans la boîte de réception de Service B');
  console.log(`✅ Courrier présent dans la boîte reçue de Service B (Statut: ${foundInB.status})`);

  const ackRes = await request('POST', `/transmissions/${transmissionId}/acknowledge`, { comments: 'Bien reçu par le Doyenné' }, tokenB);
  assert.strictEqual(ackRes.status, 200, 'Accusé de réception OK');
  console.log(`✅ Réception accusée -> Statut : ${ackRes.body.status}`);

  // 5. Service B requests a modification
  console.log('\n--- 5. SERVICE B DEMANDE UNE MODIFICATION ---');
  const modRes = await request('POST', `/transmissions/${transmissionId}/request-modification`, {
    reason: 'Veuillez ajouter l’annexe financière détaillée en page 4.'
  }, tokenB);
  assert.strictEqual(modRes.status, 200);
  console.log(`✅ Demande de modification envoyée -> Statut : ${modRes.body.status}`);

  // Service A submits updated version
  console.log('\n--- 6. SERVICE A TRANSMET LA NOUVELLE VERSION CORRIGÉE ---');
  const newVerRes = await request('POST', `/transmissions/${transmissionId}/submit-new-version`, {
    new_file_name: 'Rapport_Pedagogique_INFO_2026_v2.pdf',
    change_notes: 'Annexe financière ajoutée selon vos instructions.'
  }, tokenA);
  assert.strictEqual(newVerRes.status, 200);
  console.log(`✅ Version corrigée transmise -> Version v${newVerRes.body.version}, Statut: ${newVerRes.body.status}`);

  // 7. Service B Approves & Signs Electronically
  console.log('\n--- 7. SERVICE B APPROUVE & SIGNE ÉLECTRONIQUEMENT (RETOUR AUTOMATIQUE) ---');
  const appRes = await request('POST', `/transmissions/${transmissionId}/approve`, { comments: 'Document parfait' }, tokenB);
  assert.strictEqual(appRes.status, 200);
  console.log(`✅ Document approuvé -> Statut : ${appRes.body.status}`);

  const signRes = await request('POST', `/transmissions/${transmissionId}/sign`, {
    comments: 'Signature officielle apposée.'
  }, tokenB);
  if (signRes.status !== 200) {
    console.error('❌ Erreur signRes:', signRes.status, signRes.body);
  }
  assert.strictEqual(signRes.status, 200);
  assert.strictEqual(signRes.body.status, 'RETOURNE', 'Le statut doit basculer automatiquement à RETOURNE');
  console.log(`✅ Document signé par ${signRes.body.signer} -> Retour automatique déclenché (Statut: RETOURNE)`);

  // 8. Service A checks returned mail
  console.log('\n--- 8. SERVICE A CONSULTE SES COURRIERS RETOURNÉS & ARCHIVE ---');
  const aReturned = await request('GET', '/transmissions/returned', null, tokenA);
  const foundReturned = aReturned.body.find(t => t.id === transmissionId);
  assert(foundReturned, 'Le document signé doit être présent dans les courriers retournés de Service A');
  console.log(`✅ Document signé reçu dans l’espace retourné de Service A (Signataire: ${foundReturned.signer_first_name} ${foundReturned.signer_last_name})`);

  // Service A archives the transmission
  const archRes = await request('POST', `/transmissions/${transmissionId}/archive`, { comments: 'Archivé au département' }, tokenA);
  assert.strictEqual(archRes.status, 200);
  console.log(`✅ Courrier archivé avec succès (Statut: ${archRes.body.status})`);

  // 9. Verify full confidential timeline
  console.log('\n--- 9. VÉRIFICATION DU TIMELINE CONFIDENTIEL SCIELLÉ ---');
  const finalDetails = await request('GET', `/transmissions/${transmissionId}`, null, tokenA);
  console.log(`Timeline des événements (${finalDetails.body.history.length} étapes) :`);
  finalDetails.body.history.forEach((h, i) => {
    console.log(`  ${i + 1}. [${h.action}] ${h.action_label} - ${h.comments || ''}`);
  });

  assert(finalDetails.body.history.length >= 6, 'L’historique doit contenir toutes les étapes du cycle complet');

  console.log('\n================================================================');
  console.log('🎉 TOUS LES TESTS DU WORKFLOW CONFIDENTIEL SONT VALIDÉS À 100% !');
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('❌ Échec du test:', err);
  process.exit(1);
});
