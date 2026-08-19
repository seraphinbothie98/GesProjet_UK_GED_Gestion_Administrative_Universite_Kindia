const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
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
            resolve({ error: parsed.error || 'Request failed', statusCode: res.statusCode, data: parsed });
          } else {
            resolve({ data: parsed, statusCode: res.statusCode });
          }
        } catch (e) {
          resolve({ raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runDirectArchiveTestSuite() {
  console.log('========================================================================');
  console.log(' UK-GED : VALIDATION AUTOMATISÉE DÉDIÉE DE L’ARCHIVAGE DIRECT (PATH B)');
  console.log('========================================================================\n');

  try {
    // 0. Login accounts
    console.log('🔑 Authentification des comptes de test...');
    const scAuth = await request('POST', '/auth/login', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
    const sgAuth = await request('POST', '/auth/login', { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
    const adminAuth = await request('POST', '/auth/login', { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });

    if (scAuth.error) throw new Error(`Échec connexion SC : ${scAuth.error}`);
    if (sgAuth.error) throw new Error(`Échec connexion SG : ${sgAuth.error}`);
    if (adminAuth.error) throw new Error(`Échec connexion Admin : ${adminAuth.error}`);

    const scToken = scAuth.data.token;
    const sgToken = sgAuth.data.token;
    const adminToken = adminAuth.data.token;

    console.log('   ✓ Authentification réussie (SC, SG, Admin).\n');

    // TEST 1: Fetch document type configurations
    console.log('📌 TEST 1: Récupération des types de documents configurés...');
    const typesRes = await request('GET', '/document-types', null, scToken);
    if (typesRes.error) {
      throw new Error(`Erreur lors de la récupération des types : ${typesRes.error}`);
    }
    if (!Array.isArray(typesRes.data)) {
      throw new Error(`Réponse inattendue pour types : ${JSON.stringify(typesRes)}`);
    }
    const decretConfig = typesRes.data.find(t => t.code === 'DECRET');
    if (!decretConfig || decretConfig.allow_direct_archive !== 1) {
      throw new Error("Configuration initiale invalide pour le type 'DECRET'");
    }
    console.log('   ✓ Types de documents chargés. Décret autorisé pour archivage direct.\n');

    // TEST 2: Register official document with DIRECT_ARCHIVE mode at Secrétariat Central
    console.log('📌 TEST 2: Enregistrement d\'un Décret officiel en mode ARCHIVAGE DIRECT (Path B)...');
    const incomingRes = await request('POST', '/documents/incoming', {
      processing_mode: 'DIRECT_ARCHIVE',
      official_type: 'DECRET',
      title: 'Décret N°2026/045 portant nomination administrative',
      description: 'Nomination des responsables de chaires de recherche',
      sender_name: 'Présidence de la République',
      sender_organization: 'Secrétariat Général du Gouvernement',
      reception_date: '2026-08-11',
      document_date: '2026-08-10',
      has_external_signature: true,
      external_signatory_name: 'Son Excellence le Président de la République',
      external_signature_date: '2026-08-10'
    }, scToken);

    if (incomingRes.error) throw new Error(incomingRes.error);
    const docId = incomingRes.data.id;
    const ref = incomingRes.data.reference;
    console.log(`   ✓ Décret enregistré avec succès! Référence : ${ref} (ID: ${docId})\n`);

    // TEST 3: Verify document holder remains Secrétariat Central (SG is NOT assigned)
    console.log('📌 TEST 3: Vérification que le détenteur reste le Secrétariat Central (sans transmission auto à SG)...');
    const docDetailRes = await request('GET', `/documents/${docId}`, null, scToken);
    const docData = docDetailRes.data;
    if (docData.current_service_code !== 'SC') {
      throw new Error(`Détenteur incorrect : attendu 'SC', obtenu '${docData.current_service_code}'`);
    }
    if (docData.processing_mode !== 'DIRECT_ARCHIVE') {
      throw new Error(`Mode de traitement incorrect : attendu 'DIRECT_ARCHIVE', obtenu '${docData.processing_mode}'`);
    }
    console.log(`   ✓ Détenteur vérifié : ${docData.current_service_name} (Mode: ${docData.processing_mode})\n`);

    // TEST 4: Attempt direct archiving by non-SC role (Secrétaire Général - Should fail)
    console.log('📌 TEST 4: Tentative d\'archivage direct par le Secrétaire Général (Devrait être REFUSÉ)...');
    const sgArchiveRes = await request('PUT', `/documents/${docId}/archive-direct`, null, sgToken);
    if (!sgArchiveRes.error) {
      throw new Error("L'archivage direct par le SG aurait dû être refusé !");
    }
    console.log(`   ✓ Bloqué avec succès pour le SG ! Error: "${sgArchiveRes.error}"\n`);

    // TEST 5: Direct Archiving by authorized Secrétariat Central Agent
    console.log('📌 TEST 5: Archivage direct par l\'agent du Secrétariat Central...');
    const scArchiveRes = await request('PUT', `/documents/${docId}/archive-direct`, null, scToken);
    if (scArchiveRes.error) throw new Error(scArchiveRes.error);
    console.log(`   ✓ Archivage direct réussi par le SC ! Message : "${scArchiveRes.data.message}"\n`);

    // TEST 6: Check archived document status and history timeline
    console.log('📌 TEST 6: Vérification du statut ARCHIVÉ et de l\'historique...');
    const archivedDocRes = await request('GET', `/documents/${docId}`, null, scToken);
    const archivedData = archivedDocRes.data;
    if (archivedData.status !== 'ARCHIVED') {
      throw new Error(`Statut invalide : attendu 'ARCHIVED', obtenu '${archivedData.status}'`);
    }
    console.log(`   ✓ Statut vérifié : ${archivedData.status}`);
    console.log(`   ✓ Historique conservé : ${archivedData.history.length} étapes enregistrées.\n`);

    // TEST 7: Admin disables direct archiving for a type and verifies rejection
    console.log('📌 TEST 7: Désactivation de l\'archivage direct par l\'Administrateur pour le type DEMANDE_ADMIN...');
    const toggleOffRes = await request('PUT', '/document-types/DEMANDE_ADMIN', { allow_direct_archive: 0 }, adminToken);
    if (toggleOffRes.error) throw new Error(toggleOffRes.error);
    
    const tryRejectedDirectRes = await request('POST', '/documents/incoming', {
      processing_mode: 'DIRECT_ARCHIVE',
      official_type: 'DEMANDE_ADMIN',
      title: 'Demande administrative spéciale',
      sender_name: 'Service Enseignement',
      reception_date: '2026-08-11'
    }, scToken);

    if (!tryRejectedDirectRes.error) {
      throw new Error("L'enregistrement en archivage direct d'un type désactivé aurait dû être rejeté !");
    }
    console.log(`   ✓ Inscription bloquée avec succès pour type désactivé ! Error: "${tryRejectedDirectRes.error}"\n`);

    // TEST 8: Re-enable type config
    console.log('📌 TEST 8: Réactivation par l\'Administrateur...');
    await request('PUT', '/document-types/DEMANDE_ADMIN', { allow_direct_archive: 1 }, adminToken);
    console.log('   ✓ Configuration réactivée avec succès.\n');

    // TEST 9: Regression check for Path A (Normal Workflow)
    console.log('📌 TEST 9: Test de régression du mode normal (Path A)...');
    const normalDocRes = await request('POST', '/documents/incoming', {
      processing_mode: 'NORMAL',
      title: 'Courrier de demande budgétaire annuelle',
      sender_name: 'Faculté des Sciences',
      reception_date: '2026-08-11'
    }, scToken);
    if (normalDocRes.error) throw new Error(normalDocRes.error);

    const normalDocId = normalDocRes.data.id;
    const normalDetail = await request('GET', `/documents/${normalDocId}`, null, scToken);
    if (normalDetail.data.current_service_code !== 'SG') {
      throw new Error("Le mode normal aurait dû orienter vers le SG !");
    }
    console.log(`   ✓ Mode normal fonctionnel. Transmis au SG avec succès.\n`);

    console.log('========================================================================');
    console.log(' 🎉 SUCCÈS TOTAL : TOUS LES TESTS DE L\'ARCHIVAGE DIRECT ONT RÉUSSI !');
    console.log('========================================================================\n');
  } catch (err) {
    console.error('\n❌ ÉCHEC DE LA VALIDATION DU TEST :', err);
    process.exit(1);
  }
}

runDirectArchiveTestSuite();
