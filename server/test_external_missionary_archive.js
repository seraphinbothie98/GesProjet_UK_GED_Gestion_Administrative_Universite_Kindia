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

async function runTest() {
  console.log('================================================================');
  console.log('🧪 TEST: MODULE ARCHIVES — INTÉGRATION ORDRES DE MISSION EXTERNES');
  console.log('================================================================\n');

  // 1. Login as Admin and SC
  const adminToken = await login('admin@univ-kindia.edu.gn', 'Admin123!');
  console.log('1. ✅ Admin authentifié');

  // 2. Nettoyage initial
  console.log('\n2. Nettoyage complet initial des données de test...');
  await apiCall({
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
    reason: 'Initialisation test archives',
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

  // 3. Create an External Missionary directly in DB to test the full lifecycle
  console.log('\n3. Enregistrement d\'un missionnaire externe avec ordre de mission...');
  const insertRes = await db.run(
    `INSERT INTO external_missionaries (
      reference, last_name, first_names, nationality, function_title,
      origin_institution, mission_order_ref, object_of_mission, location_of_mission,
      original_document_path, arrival_date, signed_at, departure_date, status
    ) VALUES (
      'MEX/UK/2026/000001', 'DIALLO', 'Mamadou Bhoye', 'Guinéenne', 'Enseignant-Chercheur',
      'Université Gamal Abdel Nasser de Conakry (UGANC)', 'OM/UGANC/2026/089',
      'Évaluation des programmes de master en Sciences et Technologies', 'Kindia',
      'test_om.pdf', datetime('now', '-3 days'), datetime('now', '-2 days'), datetime('now', '-1 day'), 'ARCHIVÉ'
    )`
  );
  const extId = insertRes.lastID;
  console.log(`   ✅ Missionnaire externe créé et archivé : ID=${extId}, Réf=MEX/UK/2026/000001`);

  // 4. Fetch Archived External Missionaries via API
  console.log('\n4. Récupération des missionnaires archivés via GET /api/external-missionaries?status=ARCHIVÉ...');
  const extRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/external-missionaries?status=ARCHIV%C3%89',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  console.log(`   Statut API: ${extRes.status}, Nombre retourné: ${extRes.data.length}`);
  if (extRes.data.length !== 1 || extRes.data[0].reference !== 'MEX/UK/2026/000001') {
    console.error('❌ ÉCHEC: L\'ordre de mission externe archivé n\'a pas été récupéré correctement !');
    process.exit(1);
  }
  console.log(`   ✅ Réf: ${extRes.data[0].reference}, Nom: ${extRes.data[0].last_name} ${extRes.data[0].first_names}, Institution: ${extRes.data[0].origin_institution}`);

  // 5. Create a standard internal document and archive it
  console.log('\n5. Création d\'un document interne standard (Décret) et archivage...');
  const insertDoc = await db.run(
    `INSERT INTO documents (
      reference, tracking_token, document_type, title, sender_name, current_service_id, created_by, status
    ) VALUES (
      'UK/DECRET/2026/0001', 'tok_decret_1', 'DECRET', 'Décret portant nomination des doyens de facultés', 'Présidence', 1, 1, 'ARCHIVED'
    )`
  );
  console.log(`   ✅ Décret archivé créé: ID=${insertDoc.lastID}, Réf=UK/DECRET/2026/0001`);

  // 6. Query all documents to simulate frontend folder categorization
  console.log('\n6. Simulation du calcul des dossiers dans Archives 2026 :');
  const standardDocsRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/documents?status=ARCHIVED',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  const standardDocs = standardDocsRes.data || [];
  const extDocs = extRes.data || [];

  const allArchivedCount = standardDocs.length + extDocs.length;
  const decretCount = standardDocs.filter(d => d.document_type === 'DECRET').length;
  const internalOmCount = standardDocs.filter(d => d.document_type === 'MISSION_ORDER').length;
  const externalOmCount = extDocs.length;

  console.log(`   📁 Toutes les Archives 2026 : ${allArchivedCount} (Attendu: 2)`);
  console.log(`   📁 Décrets                  : ${decretCount} (Attendu: 1)`);
  console.log(`   📁 Ordres de mission (interne): ${internalOmCount} (Attendu: 0)`);
  console.log(`   📁 Ordres de mission externes: ${externalOmCount} (Attendu: 1)`);

  if (allArchivedCount !== 2 || decretCount !== 1 || internalOmCount !== 0 || externalOmCount !== 1) {
    console.error('❌ ÉCHEC: Les compteurs des dossiers ne correspondent pas aux données réelles !');
    process.exit(1);
  }

  console.log('   ✅ Succès: Les catégories sont parfaitement isolées et les compteurs sont dynamiques et exacts.');

  // 7. Cleanup test data
  console.log('\n7. Nettoyage final...');
  await db.run('DELETE FROM external_missionaries WHERE id = ?', [extId]);
  await db.run('DELETE FROM documents WHERE id = ?', [insertDoc.lastID]);

  console.log('\n================================================================');
  console.log('🎉 TEST DU DOSSIER « ORDRES DE MISSION EXTERNES » RÉUSSI À 100% !');
  console.log('================================================================');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
