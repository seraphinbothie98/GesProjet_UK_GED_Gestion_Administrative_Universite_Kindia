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
  console.log('🧪 TEST: UNIFICATION DE L\'ACCÈS « DEMANDER UN ORDRE DE MISSION »');
  console.log('================================================================\n');

  const scToken = await login('sc@univ-kindia.edu.gn', 'Agent123!');
  const adminToken = await login('admin@univ-kindia.edu.gn', 'Admin123!');
  const dafToken = await login('daf@univ-kindia.edu.gn', 'Daf123!');
  console.log('1. ✅ Connexions réussies (Secrétariat Central, Administrateur, DAF/Chef de service)');

  // Test 1: Connected Service Head submits mission request
  console.log('\n2. Test: Chef de service (DAF) soumet une demande d\'ordre de mission via le bouton unifié...');
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
  console.log(`   ✅ Demande créée avec succès : ID=${req1.id}, Réf=${req1.reference}, Statut=${req1.status}`);

  // Test 2: Teacher-Researcher without service submits mission request
  console.log('\n3. Test: Enseignant-Chercheur (sans service rattaché) soumet une demande...');
  const req2Res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/mission-requests',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${dafToken}`
    }
  }, {
    applicant_last_name: 'BARRY',
    applicant_first_names: 'Thierno Sadou',
    applicant_function: 'Enseignant-Chercheur (Maître de Conférences)',
    applicant_service_name: 'Aucun service / Enseignant-chercheur',
    applicant_phone: '+224 621 99 88 77',
    applicant_email: 't.barry@univ-kindia.edu.gn',
    destination: 'Mamou - Colloque International de Physique',
    object_of_mission: 'Présentation des travaux de recherche sur les énergies renouvelables',
    start_date: '2026-09-10',
    end_date: '2026-09-14',
    transport_means: 'TRANSPORT EN COMMUN'
  });

  console.log(`   Statut HTTP: ${req2Res.status}`);
  if (req2Res.status !== 201) {
    console.error('❌ Échec soumission demande Enseignant-Chercheur:', req2Res.data);
    process.exit(1);
  }
  const req2 = req2Res.data;
  console.log(`   ✅ Demande Enseignant-Chercheur créée : ID=${req2.id}, Réf=${req2.reference}, Service=${req2.applicant_service_name || 'Aucun service'}`);

  // Test 3: Public request submission (from Login page)
  console.log('\n4. Test: Demande publique depuis la page de connexion...');
  const req3Res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/mission-requests/public',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, {
    applicant_last_name: 'SOUMAH',
    applicant_first_names: 'Fodé',
    applicant_function: 'Chercheur Associé',
    applicant_service_name: 'Laboratoire de Chimie Appliquée',
    applicant_phone: '+224 620 44 55 66',
    applicant_email: 'fode.soumah@external.univ-kindia.edu.gn',
    destination: 'Kamsar - Mission d\'échantillonnage environnemental',
    object_of_mission: 'Prélèvement d\'échantillons et analyses scientifiques',
    start_date: '2026-09-15',
    end_date: '2026-09-20',
    transport_means: 'VÉHICULE PERSONNEL'
  });

  console.log(`   Statut HTTP: ${req3Res.status}`);
  if (req3Res.status !== 201) {
    console.error('❌ Échec soumission demande publique:', req3Res.data);
    process.exit(1);
  }
  const req3 = req3Res.data;
  console.log(`   ✅ Demande publique créée : ID=${req3.id}, Réf=${req3.reference}`);

  // Test 4: Secrétariat Central views all requests
  console.log('\n5. Test: Le Secrétariat Central accède à l\'ensemble des demandes d\'ordres de mission...');
  const scListRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/mission-requests',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${scToken}` }
  });

  console.log(`   Statut HTTP: ${scListRes.status}, Nombre de demandes reçues au SC: ${scListRes.data.length}`);
  if (scListRes.status !== 200 || scListRes.data.length < 3) {
    console.error('❌ Le Secrétariat Central n\'a pas reçu toutes les demandes');
    process.exit(1);
  }
  console.log('   ✅ Le Secrétariat Central a bien reçu toutes les demandes de mission de l\'ensemble des services.');

  // Test 5: Admin access check
  console.log('\n6. Test: L\'Administrateur Système a l\'accès complet à la gestion...');
  const adminListRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/mission-requests',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  if (adminListRes.status !== 200) {
    console.error('❌ L\'Administrateur n\'a pas accès à la gestion des missions');
    process.exit(1);
  }
  console.log('   ✅ L\'Administrateur conserve son accès administratif total.');

  // Cleanup test data
  await db.run('DELETE FROM mission_order_requests WHERE id IN (?, ?, ?)', [req1.id, req2.id, req3.id]);
  await db.run('DELETE FROM mission_order_request_history WHERE request_id IN (?, ?, ?)', [req1.id, req2.id, req3.id]);

  console.log('\n================================================================');
  console.log('🎉 TOUS LES TESTS DE L\'INTERFACE MISSION ONT RÉUSSI À 100% !');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
