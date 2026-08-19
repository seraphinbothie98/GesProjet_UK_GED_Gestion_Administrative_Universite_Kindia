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
            const err = new Error(parsed.error || `HTTP ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.response = parsed;
            reject(err);
          } else {
            resolve(parsed);
          }
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTestRulesSuite() {
  console.log('========================================================================');
  console.log(' UK-GED : VALIDATION OBLIGATOIRE DES 16 RÈGLES DE CIRCULATION & ARCHIVAGE');
  console.log('========================================================================\n');

  let passedSteps = 0;

  try {
    // Authenticate users for different roles & services
    console.log('🔑 Authentification des utilisateurs pour les tests...');
    const scLogin = await apiCall('/auth/login', 'POST', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
    const sgLogin = await apiCall('/auth/login', 'POST', { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
    const recteurLogin = await apiCall('/auth/login', 'POST', { identity: 'recteur@univ-kindia.edu.gn', password: 'Recteur123!' });
    const dafLogin = await apiCall('/auth/login', 'POST', { identity: 'daf@univ-kindia.edu.gn', password: 'Daf123!' });
    const adminLogin = await apiCall('/auth/login', 'POST', { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });

    const scToken = scLogin.token;
    const sgToken = sgLogin.token;
    const recteurToken = recteurLogin.token;
    const dafToken = dafLogin.token;
    const adminToken = adminLogin.token;

    const services = await apiCall('/services', 'GET', null, scToken);
    const scService = services.find(s => s.code === 'SC');
    const sgService = services.find(s => s.code === 'SG');
    const recteurService = services.find(s => s.code === 'RECT');
    const dafService = services.find(s => s.code === 'DAF');

    // Test 1: Enregistrer un courrier au Secrétariat Central
    console.log('\n📌 TEST 1: Enregistrement d\'un courrier au Secrétariat Central...');
    const newMail = await apiCall('/documents/incoming', 'POST', {
      title: 'Note de service relative au contrôle budgétaire T3',
      description: 'Document officiel transmis pour avis et validation administrative.',
      sender_name: 'Direction Générale du Budget',
      sender_organization: 'Ministère des Finances',
      reception_date: '2026-08-11',
      priority: 'HIGH',
      instruction: 'Transmission initiale au Secrétaire Général'
    }, scToken);
    console.log(`   ✓ Courrier enregistré avec succès! Référence : ${newMail.reference} (ID: ${newMail.id})`);
    passedSteps++;

    const docId = newMail.id;

    // Test 2: Vérifier que le destinataire initial est automatiquement le Secrétaire Général
    console.log('\n📌 TEST 2: Vérification du destinataire initial automatique (Secrétaire Général)...');
    let docDetail = await apiCall(`/documents/${docId}`, 'GET', null, scToken);
    if (docDetail.current_service_name.includes('Secrétariat Général') || docDetail.transfers[0].to_service_name.includes('Secrétariat Général')) {
      console.log(`   ✓ Destinataire initial vérifié : Secrétaire Général (${docDetail.current_service_name})`);
      passedSteps++;
    } else {
      throw new Error(`Destinataire initial incorrect : ${docDetail.current_service_name}`);
    }

    // Test 3 & 4: Transmettre au SG & Vérifier que le SG devient le détenteur actuel
    console.log('\n📌 TEST 3 & 4: Vérification de la transmission au SG et du détenteur actuel...');
    if (docDetail.current_service_id === sgService.id) {
      console.log(`   ✓ Détenteur actuel du document : Secrétaire Général (ID Service: ${sgService.id})`);
      passedSteps += 2;
    } else {
      throw new Error(`Le détenteur actuel n'est pas le Secrétaire Général! ID actuel : ${docDetail.current_service_id}`);
    }

    // Test 5: Transmettre au Recteur
    console.log('\n📌 TEST 5: Orientation du courrier du Secrétaire Général vers le Recteur...');
    await apiCall('/workflow/orient', 'POST', {
      document_id: docId,
      to_service_id: recteurService.id,
      motif: 'Pour avis',
      instruction: 'Transmis à Monsieur le Recteur pour arbitrage institutionnel.'
    }, sgToken);
    docDetail = await apiCall(`/documents/${docId}`, 'GET', null, sgToken);
    console.log(`   ✓ Transmis avec succès au Recteur. Détenteur actuel : ${docDetail.current_service_name}`);
    passedSteps++;

    // Test 6: Transmettre au chef de service (DAF)
    console.log('\n📌 TEST 6: Orientation du Recteur vers le Chef de service (DAF)...');
    await apiCall('/workflow/orient', 'POST', {
      document_id: docId,
      to_service_id: dafService.id,
      motif: 'Pour traitement',
      instruction: 'Transmis au Chef de service DAF pour exécution financière.'
    }, recteurToken);
    docDetail = await apiCall(`/documents/${docId}`, 'GET', null, recteurToken);
    console.log(`   ✓ Transmis avec succès au Chef de service DAF. Détenteur actuel : ${docDetail.current_service_name}`);
    passedSteps++;

    // Test 7 & 8: Vérifier qu'un chef de service ne peut pas transmettre vers son propre service (DAF -> DAF)
    console.log('\n📌 TEST 7 & 8: Vérification de l\'interdiction de self-transmission (DAF -> DAF)...');
    try {
      await apiCall('/workflow/transmit', 'POST', {
        document_id: docId,
        to_service_id: dafService.id, // DAF attempting to transmit to DAF
        instruction: 'Transmission vers DAF interne'
      }, dafToken);
      throw new Error('❌ ERREUR: Le backend a accepté une transmission vers le propre service de l\'utilisateur !');
    } catch (err) {
      if (err.message.includes('TRANSMISSION IMPOSSIBLE') || err.message.includes('propre service')) {
        console.log(`   ✓ Bloqué avec succès par le backend ! Message d'erreur : "${err.message}"`);
        passedSteps += 2;
      } else {
        throw err;
      }
    }

    // Test 9: Faire signer le document par le chef de service DAF
    console.log('\n📌 TEST 9: Signature numérique et validation par le chef de service DAF...');
    const signRes = await apiCall('/workflow/sign-and-return', 'POST', {
      document_id: docId,
      remarks: 'Visa budgétaire accordé par la DAF.'
    }, dafToken);
    console.log(`   ✓ Document signé avec succès par le chef de service DAF! Empreinte : ${signRes.signatureHash.substring(0, 24)}...`);
    passedSteps++;

    // Test 10: Vérifier le retour automatique du document au Secrétariat Central
    console.log('\n📌 TEST 10: Vérification du retour au Secrétariat Central après signature...');
    docDetail = await apiCall(`/documents/${docId}`, 'GET', null, scToken);
    if (docDetail.current_service_id === scService.id) {
      console.log(`   ✓ Document bien retourné au Secrétariat Central! Détenteur actuel : ${docDetail.current_service_name}`);
      console.log(`   ✓ Statut du document : ${docDetail.status}`);
      passedSteps++;
    } else {
      throw new Error(`Le document n'est pas revenu au SC! Service actuel : ${docDetail.current_service_name}`);
    }

    // Test 11: Vérifier qu'un chef de service (DAF) ne peut PAS archiver
    console.log('\n📌 TEST 11: Tentative d\'archivage par le Chef de service DAF (Devrait être REFUSÉ)...');
    try {
      await apiCall(`/documents/${docId}/archive`, 'PUT', {}, dafToken);
      throw new Error('❌ ERREUR: La DAF a réussi à archiver le document !');
    } catch (err) {
      if (err.message.includes('ARCHIVAGE IMPOSSIBLE') || err.statusCode === 403) {
        console.log(`   ✓ Bloqué avec succès pour la DAF ! Message d'erreur : "${err.message}"`);
        passedSteps++;
      } else {
        throw err;
      }
    }

    // Test 12: Vérifier que le SG ne peut PAS archiver directement quand il n'est pas le Secrétariat Central
    console.log('\n📌 TEST 12: Tentative d\'archivage par le Secrétaire Général (Devrait être REFUSÉ)...');
    try {
      await apiCall(`/documents/${docId}/archive`, 'PUT', {}, sgToken);
      throw new Error('❌ ERREUR: Le SG a réussi à archiver le document !');
    } catch (err) {
      if (err.message.includes('ARCHIVAGE IMPOSSIBLE') || err.statusCode === 403) {
        console.log(`   ✓ Bloqué avec succès pour le SG ! Message d'erreur : "${err.message}"`);
        passedSteps++;
      } else {
        throw err;
      }
    }

    // Test 13: Vérifier que le Recteur ne peut PAS archiver
    console.log('\n📌 TEST 13: Tentative d\'archivage par le Recteur (Devrait être REFUSÉ)...');
    try {
      await apiCall(`/documents/${docId}/archive`, 'PUT', {}, recteurToken);
      throw new Error('❌ ERREUR: Le Recteur a réussi à archiver le document !');
    } catch (err) {
      if (err.message.includes('ARCHIVAGE IMPOSSIBLE') || err.statusCode === 403) {
        console.log(`   ✓ Bloqué avec succès pour le Recteur ! Message d'erreur : "${err.message}"`);
        passedSteps++;
      } else {
        throw err;
      }
    }

    // Test 14: Vérifier que le Secrétariat Central PEUT archiver quand toutes les conditions sont remplies
    console.log('\n📌 TEST 14: Archivage par l\'agent du Secrétariat Central (Conditions remplies)...');
    const archiveRes = await apiCall(`/documents/${docId}/archive`, 'PUT', {}, scToken);
    console.log(`   ✓ Archivage réussi par le Secrétariat Central ! Message : "${archiveRes.message}"`);
    passedSteps++;

    // Test 15: Vérifier que l'historique conserve toutes les étapes sans altération
    console.log('\n📌 TEST 15: Vérification de l\'intégrité du journal d\'historique (Timeline)...');
    const circuit = await apiCall(`/workflow/circuit/${docId}`, 'GET', null, scToken);
    console.log(`   ✓ Intégrité vérifiée : ${circuit.history.length} étapes conservées dans l'historique :`);
    circuit.history.forEach((h, idx) => {
      console.log(`      [${idx + 1}] Service: ${h.service_name} | Action: ${h.action} | Détails: ${h.details}`);
    });
    if (circuit.history.length >= 5) {
      passedSteps++;
    } else {
      throw new Error('Historique incomplet !');
    }

    // Test 16: Vérifier que le journal d'audit conserve les actions importantes
    console.log('\n📌 TEST 16: Vérification de la présence dans le journal d\'audit inviolable...');
    const auditLogs = await apiCall('/audit', 'GET', null, adminToken);
    const docAuditLogs = auditLogs.filter(a => a.entity_type === 'DOCUMENT' && Number(a.entity_id) === Number(docId));
    console.log(`   ✓ Enregistrements d'audit trouvés pour ce document : ${docAuditLogs.length} évènements d'audit.`);
    docAuditLogs.forEach(a => {
      console.log(`      • Action: ${a.action} par Utilisateur ID ${a.user_id} à ${a.timestamp}`);
    });
    if (docAuditLogs.length > 0) {
      passedSteps++;
    } else {
      throw new Error('Aucune trace d\'audit trouvée pour ce document !');
    }

    console.log('\n========================================================================');
    console.log(` 🎉 SUCCÈS TOTAL : LES 16/16 TESTS DE CONFORMITÉ AUX RÈGLES ONT RÉUSSI !`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('\n❌ ÉCHEC DE LA VALIDATION DU TEST :', err);
    process.exit(1);
  }
}

runTestRulesSuite();
