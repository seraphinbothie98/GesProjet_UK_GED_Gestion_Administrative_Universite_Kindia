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

async function login(email, password) {
  const res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identity: email, password });
  if (res.status !== 200) {
    console.error('Login failed:', res.status, res.data);
    throw new Error('Login failed: ' + JSON.stringify(res.data));
  }
  return res.data.token;
}

async function runTest() {
  console.log('================================================================');
  console.log('🧪 TEST: SYNCHRONISATION DU TABLEAU DE BORD AVEC LES DONNÉES RÉELLES');
  console.log('================================================================\n');

  // 1. Login as Admin and SC
  const adminToken = await login('admin@univ-kindia.edu.gn', 'Admin123!');
  console.log('1. ✅ Admin authentifié, token exists:', !!adminToken);

  // 2. Perform total cleanup of test data
  console.log('\n2. Nettoyage complet de la base de données via maintenance...');
  const cleanRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/admin/maintenance/cleanup',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    confirmText: 'NETTOYER',
    reason: 'Test de vidage complet et synchronisation tableau de bord',
    clean_incoming_test: true,
    clean_outgoing_test: true,
    clean_missions_test: true,
    clean_archived_test: true,
    clean_trashed_test: true,
    clean_attachments_test: true,
    clean_notifications_test: true,
    clean_history_test: true,
    clean_appointments_test: true
  });
  console.log('   Clean response status:', cleanRes.status, 'data:', cleanRes.data);
  console.log('   Result:', cleanRes.data.message);

  // 3. Query Dashboard
  console.log('\n3. Vérification du tableau de bord après vidage complet...');
  const dashRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/dashboard',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const dash = dashRes.data;
  console.log('   Metrics:', JSON.stringify(dash.metrics));
  console.log('   Recent activity count:', dash.recent_activity.length);
  console.log('   Appointments:', JSON.stringify(dash.appointments));
  console.log('   To sign count:', dash.to_sign_count);

  if (dash.metrics.total !== 0 || dash.metrics.pending !== 0 || dash.recent_activity.length !== 0) {
    console.error('❌ ÉCHEC: Le tableau de bord affiche encore des données après vidage !');
    process.exit(1);
  }
  console.log('   ✅ Succès: Tous les compteurs sont à 0 et la liste récente est vide.');

  // 4. Create a test incoming mail
  console.log('\n4. Création d\'un document test...');
  const createDocRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/documents/incoming',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    title: 'Note de service officielle de test',
    official_type: 'NOTE_SERVICE',
    confidentiality: 'PUBLIC',
    priority: 'URGENT',
    sender_name: 'Direction Générale',
    sender_organization: 'Université de Kindia',
    description: 'Test de synchronisation temps réel'
  });

  if (createDocRes.status !== 201) {
    console.error('Document creation failed:', createDocRes.status, createDocRes.data);
    throw new Error('Create document failed');
  }

  const newDocId = createDocRes.data.id;
  const newDocRef = createDocRes.data.reference;
  console.log(`   Document créé: ID=${newDocId}, Réf=${newDocRef}`);

  // 5. Query Dashboard again
  console.log('\n5. Vérification de l\'apparition immédiate sur le tableau de bord...');
  const dashRes2 = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/dashboard',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('   Metrics après création:', JSON.stringify(dashRes2.data.metrics));
  console.log('   Recent activity:', dashRes2.data.recent_activity.map(d => `${d.reference} - ${d.title}`));

  if (dashRes2.data.metrics.total !== 1 || dashRes2.data.recent_activity.length !== 1) {
    console.error('❌ ÉCHEC: Le document créé n\'est pas synchronisé dans le tableau de bord !');
    process.exit(1);
  }
  console.log('   ✅ Succès: Le document apparaît immédiatement dans le tableau de bord (Total = 1).');

  // 6. Move Document to Trash (Soft delete)
  console.log('\n6. Déplacement du document vers la Corbeille (Suppression logique)...');
  const trashRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/${newDocId}/trash`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    reason: 'Suppression test pour validation'
  });
  console.log('   Trash result:', trashRes.data.message);

  // 7. Query Dashboard after trash
  console.log('\n7. Vérification de la disparition immédiate du document supprimé du tableau de bord...');
  const dashRes3 = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/dashboard',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('   Metrics après corbeille:', JSON.stringify(dashRes3.data.metrics));
  console.log('   Recent activity count:', dashRes3.data.recent_activity.length);

  if (dashRes3.data.metrics.total !== 0 || dashRes3.data.recent_activity.length !== 0) {
    console.error('❌ ÉCHEC: Le document en corbeille apparaît encore dans le tableau de bord !');
    process.exit(1);
  }
  console.log('   ✅ Succès: Le document en corbeille a disparu immédiatement du tableau de bord (Total = 0).');

  // 8. Clean trash permanently
  console.log('\n8. Nettoyage définitif de la corbeille...');
  const permDelRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: `/api/documents/${newDocId}/permanent`,
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    reason: 'Destruction définitive de test',
    confirmText: 'SUPPRIMER'
  });
  console.log('   Permanent delete result:', permDelRes.data.message);

  // 9. Final Dashboard Check
  const dashFinal = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/dashboard',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('\n9. État final du tableau de bord:', JSON.stringify(dashFinal.data.metrics));
  console.log('   Recent activity count:', dashFinal.data.recent_activity.length);

  console.log('\n================================================================');
  console.log('🎉 TOUS LES TESTS DE SYNCHRONISATION ET DE VIDAGE ONT RÉUSSI !');
  console.log('================================================================');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
