const http = require('http');

async function apiCall(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            resolve({ statusCode: res.statusCode, ok: false, error: parsed.error, data: parsed });
          } else {
            resolve({ statusCode: res.statusCode, ok: true, data: parsed });
          }
        } catch (e) {
          resolve({ statusCode: res.statusCode, ok: res.statusCode < 400, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTestSuite() {
  console.log('=================================================================================');
  console.log(' RUNNING UK-GED NEW FEATURES & TRACKING TEST SUITE (10 TEST CASES)');
  console.log('=================================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(` ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 0. Authenticate test accounts
    const adminRes = await apiCall('/auth/login', 'POST', { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });
    const adminToken = adminRes.data.token;

    const scRes = await apiCall('/auth/login', 'POST', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
    const scToken = scRes.data.token;

    const sgRes = await apiCall('/auth/login', 'POST', { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
    const sgToken = sgRes.data.token;

    const recRes = await apiCall('/auth/login', 'POST', { identity: 'recteur@univ-kindia.edu.gn', password: 'Recteur123!' });
    const recToken = recRes.data.token;

    const services = (await apiCall('/services', 'GET', null, adminToken)).data;
    const sgService = services.find(s => s.code === 'SG');
    const recteurService = services.find(s => s.code === 'RECT');
    const dafService = services.find(s => s.code === 'DAF');

    // Create a new document for testing tracking
    const newMail = await apiCall('/documents/incoming', 'POST', {
      title: 'Demande de partenariat et financement UK 2026',
      description: 'Dossier confidentiel de subvention recherche',
      sender_name: 'Fondation Kindia',
      sender_organization: 'Kindia Org',
      reception_date: '2026-08-10',
      priority: 'HIGH',
      target_service_id: sgService ? sgService.id : 4,
      instruction: 'Pour examen initial par le Secrétariat Général'
    }, scToken);

    if (!newMail.ok) {
      console.error('Création courrier entrant échouée :', newMail);
    }

    const docId = newMail.data?.id;
    const docRef = newMail.data?.reference;

    console.log(`Document de test créé : ${docRef} (ID: ${docId})\n`);

    // TEST 1 — Recherche par référence valide
    console.log('[Test 1] Recherche de document par référence valide...');
    const t1 = await apiCall(`/tracking/document/${encodeURIComponent(docRef)}`, 'GET');
    assert(
      t1.ok && t1.data.found === true && t1.data.reference === docRef && t1.data.current_level === 'Secrétariat Général',
      `Document trouvé avec référence ${docRef}, Niveau actuel: ${t1.data?.current_level}`
    );

    // TEST 2 — Mauvaise référence
    console.log('\n[Test 2] Recherche par mauvaise référence (UK/SC/CE/9999/999999)...');
    const t2 = await apiCall('/tracking/document/UK%2FSC%2FCE%2F9999%2F999999', 'GET');
    const errStr2 = t2.error || (t2.data && t2.data.error) || '';
    assert(
      !t2.ok && t2.statusCode === 404 && errStr2.includes('introuvable'),
      'La mauvaise référence renvoie un 404 sans faire de fuite d\'information'
    );

    // TEST 3 — Scan QR Code valide
    console.log('\n[Test 3] Scan QR Code avec référence/URL...');
    const t3 = await apiCall('/tracking/scan', 'POST', { qr_data: docRef });
    assert(
      t3.ok && t3.data.found === true && t3.data.reference === docRef,
      `QR Code scanné avec succès pour le document ${docRef}`
    );

    // TEST 4 — QR Code invalide
    console.log('\n[Test 4] Scan QR Code invalide...');
    const t4 = await apiCall('/tracking/scan', 'POST', { qr_data: 'INVALID_QR_CODE_123' });
    const errStr4 = t4.error || (t4.data && t4.data.error) || '';
    assert(
      !t4.ok && t4.statusCode === 404 && errStr4.includes('invalide'),
      'Scan de QR Code invalide renvoie une erreur appropriée'
    );

    // TEST 5 — Protection des informations confidentielles
    console.log('\n[Test 5] Vérification de la protection des données confidentielles...');
    const t5 = t1.data;
    const leakPDF = t5.signed_pdf_path || t5.attachments || t5.internal_notes || t5.created_by_user || t5.current_user_name;
    assert(
      leakPDF === undefined,
      'L\'API de suivi public NE CONTIENT AUCUNE donnée confidentielle (Pas de PDF, pas de PJ, pas de commentaires internes)'
    );

    // TEST 6 — Changement de niveau (SG -> Recteur)
    console.log('\n[Test 6] Orientation du SG vers le Recteur (Changement de niveau)...');
    await apiCall('/workflow/orient', 'POST', {
      document_id: docId,
      to_service_id: recteurService.id,
      motif: 'Pour avis',
      instruction: 'Transmis au Recteur pour arbitrage'
    }, sgToken);

    const t6 = await apiCall(`/tracking/document/${encodeURIComponent(docRef)}`, 'GET');
    assert(
      t6.ok && t6.data.current_level === 'Recteur',
      `Mise à jour automatique du niveau dans le suivi public : Niveau = ${t6.data?.current_level}`
    );

    // TEST 7 — Rejet avec motif obligatoire (Rejet par le Recteur)
    console.log('\n[Test 7] Tentative de Rejet sans motif (doit échouer) puis avec motif...');
    const rejectNoMotif = await apiCall('/workflow/reject', 'POST', { document_id: docId, motif: '' }, recToken);
    assert(!rejectNoMotif.ok, 'Le rejet sans motif est bloqué par le système');

    const rejectWithMotif = await apiCall('/workflow/reject', 'POST', {
      document_id: docId,
      motif: 'Budget prévisionnel insuffisant pour la première phase.'
    }, recToken);
    assert(rejectWithMotif.ok, 'Le rejet avec motif obligatoire a réussi');

    const t7 = await apiCall(`/tracking/document/${encodeURIComponent(docRef)}`, 'GET');
    assert(
      t7.ok && t7.data.status_code === 'REJECTED' && t7.data.is_rejected === true,
      `Statut du suivi public mis à jour après rejet : ${t7.data?.status_label}`
    );

    // TEST 8 — Acceptation de document par le SG
    console.log('\n[Test 8] Acceptation d’un document par le Secrétaire Général...');
    const doc2 = await apiCall('/documents/incoming', 'POST', {
      title: 'Accord de coopération académique Kindia 2026',
      sender_name: 'Université Partner',
      reception_date: '2026-08-10',
      target_service_id: sgService.id
    }, scToken);
    const doc2Ref = doc2.data.reference;
    const doc2Id = doc2.data.id;

    const acceptRes = await apiCall('/workflow/accept', 'POST', { document_id: doc2Id, remarks: 'Conforme aux textes réglementaires.' }, sgToken);
    assert(acceptRes.ok, 'L\'action d\'acceptation par le SG s\'est exécutée avec succès');

    const t8 = await apiCall(`/tracking/document/${encodeURIComponent(doc2Ref)}`, 'GET');
    assert(
      t8.ok && t8.data.status_code === 'ACCEPTED',
      `Le suivi public affiche le statut : ${t8.data?.status_label}`
    );

    // TEST 9 — Sécurité API : API de suivi en lecture seule
    console.log('\n[Test 9] Sécurité : Tentative de modification via l\'API de suivi public...');
    const t9 = await apiCall(`/tracking/document/${encodeURIComponent(docRef)}`, 'PUT', { status: 'ACCEPTED' });
    assert(
      !t9.ok && t9.statusCode === 405,
      'L\'API de suivi public rejette les requêtes d\'écriture (Read-Only 405 Method Not Allowed)'
    );

    // TEST 10 — Administrateur : Gestion des Chefs de Service & Audit Log
    console.log('\n[Test 10] Administrateur : Modification d\'un Chef de Service & Audit Log...');
    const usersList = (await apiCall('/users', 'GET', null, adminToken)).data;
    const dafUser = usersList.find(u => u.service_code === 'DAF') || usersList[0];

    const newTitle = 'Chef de Division Financière ' + Math.floor(Math.random() * 1000);
    const updateChefRes = await apiCall(`/users/${dafUser.id}`, 'PUT', {
      function_title: newTitle,
      is_chef_service: true
    }, adminToken);

    assert(
      updateChefRes.ok && updateChefRes.data.changesCount > 0,
      `Chef de service modifié avec succès par l'Admin (${updateChefRes.data?.changesCount} champs tracés)`
    );

    const auditLogs = (await apiCall('/audit', 'GET', null, adminToken)).data;
    const chefAudit = auditLogs.find(a => a.action === 'Modification utilisateur');
    assert(
      chefAudit !== undefined,
      'Une entrée explicite de journal d\'audit (Modification utilisateur) a été enregistrée champ par champ !'
    );

    console.log('\n=================================================================================');
    console.log(` RESULTATS DE LA SUITE DE TESTS : ${passed} PASSED / ${failed} FAILED`);
    console.log('=================================================================================\n');

  } catch (err) {
    console.error('❌ ERREUR DURANT L\'EXECUTION DU TEST SUITE :', err);
  }
}

runTestSuite();
