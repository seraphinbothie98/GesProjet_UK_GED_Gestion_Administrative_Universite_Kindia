const db = require('./src/database/db');
const request = require('http').request;

function apiCall(options, data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
    const headers = Object.assign({}, options.headers || {});
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const finalOptions = Object.assign({}, options, { headers });

    const req = request(finalOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function login(identity, password) {
  const res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identity, password });
  return res.data.token;
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST: FLUX COMPLET DES DEMANDES DE MISSION VERS LE SECRÉTARIAT CENTRAL');
  console.log('================================================================\n');

  const scToken = await login('sc@univ-kindia.edu.gn', 'Agent123!');
  const dafToken = await login('daf@univ-kindia.edu.gn', 'Daf123!');
  console.log('1. ✅ Connexions réussies (Secrétariat Central, Chef de service DAF)');

  // Test 1: Connected Service User submits mission request
  console.log('\n2. Test: Chef de service (DAF) soumet une demande d\'ordre de mission...');
  const req1Res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/mission-requests',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dafToken}`
    }
  }, {
    applicant_last_name: 'CAMARA',
    applicant_first_names: 'Aboubacar',
    applicant_function: 'Directeur des Affaires Financières',
    applicant_service_name: 'Direction des Affaires Financières (DAF)',
    applicant_phone: '+224 622 11 22 33',
    applicant_email: 'daf@univ-kindia.edu.gn',
    destination: 'Conakry - Ministère du Budget',
    object_of_mission: 'Défense du budget annuel de l\'Université de Kindia',
    start_date: '2026-09-01',
    end_date: '2026-09-05',
    transport_means: 'VÉHICULE OFFICIEL'
  });

  console.log(`   Statut HTTP: ${req1Res.status}`);
  if (req1Res.status !== 201) {
    console.error('❌ Échec soumission demande DAF:', req1Res.data);
    process.exit(1);
  }
  const req1 = req1Res.data;
  console.log(`   ✅ Demande 1 créée : ID=${req1.id}, Réf=${req1.reference}, Statut=${req1.status}, Destination=${req1.destination_service_name}`);

  // Test 2: Public request from Login page
  console.log('\n3. Test: Enseignant / Chercheur soumet une demande publique sans compte (Login page)...');
  const req2Res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/mission-requests/public',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    applicant_last_name: 'DIALLO',
    applicant_first_names: 'Alpha Mamadou',
    applicant_function: 'Enseignant-Chercheur en Mathématiques',
    applicant_service_name: 'Aucun service / Enseignant-chercheur',
    applicant_phone: '+224 628 77 66 55',
    applicant_email: 'alpha.diallo@univ-kindia.edu.gn',
    destination: 'Labé - Université de Labé',
    object_of_mission: 'Jury de soutenance de thèses de doctorat',
    start_date: '2026-09-12',
    end_date: '2026-09-16',
    transport_means: 'TRANSPORT EN COMMUN'
  });

  console.log(`   Statut HTTP: ${req2Res.status}`);
  if (req2Res.status !== 201) {
    console.error('❌ Échec soumission demande publique:', req2Res.data);
    process.exit(1);
  }
  const req2 = req2Res.data;
  console.log(`   ✅ Demande 2 créée : ID=${req2.id}, Réf=${req2.reference}, Statut=${req2.status}, Destination=${req2.destination_service_name}`);

  // Test 3: Database Verification of Destination Service and Status
  console.log('\n4. Test: Vérification en base de données du service destinataire et du statut...');
  const dbReq1 = await db.get('SELECT * FROM mission_order_requests WHERE id = ?', [req1.id]);
  const dbReq2 = await db.get('SELECT * FROM mission_order_requests WHERE id = ?', [req2.id]);

  console.log(`   BDD Demande 1 -> Dest ID: ${dbReq1.destination_service_id}, Dest Nom: ${dbReq1.destination_service_name}, Statut: ${dbReq1.status}`);
  console.log(`   BDD Demande 2 -> Dest ID: ${dbReq2.destination_service_id}, Dest Nom: ${dbReq2.destination_service_name}, Statut: ${dbReq2.status}`);

  if (dbReq1.destination_service_id !== 5 || dbReq1.status !== 'EN_ATTENTE_SC' ||
      dbReq2.destination_service_id !== 5 || dbReq2.status !== 'EN_ATTENTE_SC') {
    console.error('❌ Échec: Les demandes ne sont pas correctement liées au service SC (id: 5) ou le statut n\'est pas EN_ATTENTE_SC');
    process.exit(1);
  }
  console.log('   ✅ Validé: Les 2 demandes sont associées au Secrétariat Central (ID: 5) avec le statut EN_ATTENTE_SC.');

  // Test 4: Notification Verification for SC Agent
  console.log('\n5. Test: Vérification des notifications créées pour l\'agent du Secrétariat Central...');
  const notifs = await db.all('SELECT * FROM notifications WHERE user_id = 2 AND type = "MISSION_REQUEST" ORDER BY created_at DESC LIMIT 2');
  console.log(`   Notifications trouvées pour SC (ID: 2) : ${notifs.length}`);
  if (notifs.length < 2) {
    console.error('❌ Les notifications n\'ont pas été enregistrées pour le SC');
    process.exit(1);
  }
  console.log(`   Dernière notification : "${notifs[0].title}" - ${notifs[0].message}`);
  console.log('   ✅ Validé: Le Secrétariat Central a bien reçu les notifications en temps réel.');

  // Test 5: Dashboard live counter check for SC
  console.log('\n6. Test: Vérification du compteur de demandes sur le tableau de bord du Secrétariat Central...');
  const dashRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/dashboard',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${scToken}` }
  });

  console.log(`   Statut HTTP Dashboard: ${dashRes.status}`);
  console.log(`   Compteur SC Demandes en attente: ${dashRes.data?.sc?.mission_requests_pending}`);
  if (!dashRes.data?.sc || dashRes.data.sc.mission_requests_pending < 2) {
    console.error('❌ Le compteur de demandes en attente du SC est incorrect sur le dashboard');
    process.exit(1);
  }
  console.log('   ✅ Validé: Le tableau de bord du SC affiche correctement les demandes en attente.');

  // Test 6: Secrétariat Central In-Box List
  console.log('\n7. Test: Le Secrétariat Central récupère les demandes reçues via GET /api/mission-requests...');
  const scListRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/mission-requests',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${scToken}` }
  });

  const scRequests = scListRes.data;
  const foundReq1 = scRequests.find(r => r.id === req1.id);
  const foundReq2 = scRequests.find(r => r.id === req2.id);

  if (!foundReq1 || !foundReq2) {
    console.error('❌ Les demandes créées ne figurent pas dans la liste reçue par le SC');
    process.exit(1);
  }
  console.log(`   ✅ Validé: Les 2 demandes sont bien présentes dans la boîte de réception du SC (Total reçues: ${scRequests.length}).`);

  // Test 7: Secrétariat Central converts request into official mission order
  console.log('\n8. Test: Le Secrétariat Central crée l\'ordre de mission officiel à partir de la demande...');
  const genOmRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: `/api/mission-requests/${req1.id}/generate-official-om`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scToken}`
    }
  });

  console.log(`   Statut HTTP Génération OM: ${genOmRes.status}`);
  if (genOmRes.status !== 200) {
    console.error('❌ Échec génération ordre de mission officiel:', genOmRes.data);
    process.exit(1);
  }
  console.log(`   ✅ Ordre de mission officiel créé : Doc ID=${genOmRes.data.official_document_id}, Réf Officielle=${genOmRes.data.official_reference}, Nouveau Statut=${genOmRes.data.status}`);

  // Test 8: Transmit to SG for signature
  console.log('\n9. Test: Transmission de l\'ordre de mission officiel au Secrétaire Général...');
  const transmitRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: `/api/mission-requests/${req1.id}/transmit-to-sg`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scToken}`
    }
  });

  console.log(`   Statut HTTP Transmission SG: ${transmitRes.status}`);
  if (transmitRes.status !== 200) {
    console.error('❌ Échec transmission SG:', transmitRes.data);
    process.exit(1);
  }
  console.log(`   ✅ Ordre transmis au SG pour signature numérique.`);

  // Cleanup test data
  await db.run('UPDATE mission_order_requests SET official_document_id = NULL WHERE id IN (?, ?)', [req1.id, req2.id]);
  await db.run('DELETE FROM mission_orders WHERE document_id = ?', [genOmRes.data.official_document_id]);
  await db.run('DELETE FROM documents WHERE id = ?', [genOmRes.data.official_document_id]);
  await db.run('DELETE FROM mission_order_requests WHERE id IN (?, ?)', [req1.id, req2.id]);
  await db.run('DELETE FROM mission_order_request_history WHERE request_id IN (?, ?)', [req1.id, req2.id]);
  await db.run('DELETE FROM notifications WHERE user_id = 2 AND type = "MISSION_REQUEST"');

  console.log('\n================================================================');
  console.log('🎉 TOUS LES 8 TESTS DU WORKFLOW SECRÉTARIAT CENTRAL ONT RÉUSSI À 100% !');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
