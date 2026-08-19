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
  console.log('🧪 TEST: ENREGISTREMENT ET VALIDATION DE L\'ARCHIVAGE DIRECT');
  console.log('================================================================\n');

  const scToken = await login('sc@univ-kindia.edu.gn', 'Agent123!');
  console.log('1. ✅ Agent Secrétariat Central authentifié');

  // Test 1: Try invalid direct archive with COURRIER_ENTRANT
  console.log('\n2. Test: Tentative d\'archivage direct avec type invalide (COURRIER_ENTRANT)...');
  const invalidRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/documents/incoming',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scToken}`
    }
  }, {
    title: 'Note de service',
    official_type: 'COURRIER_ENTRANT',
    processing_mode: 'DIRECT_ARCHIVE',
    sender_name: 'Direction',
    reception_date: '2026-08-15'
  });

  console.log(`   Statut HTTP retourné: ${invalidRes.status}`);
  console.log(`   Message d'erreur: ${invalidRes.data.error}`);
  if (invalidRes.status !== 400) {
    console.error('❌ ÉCHEC: Le serveur aurait dû rejeter COURRIER_ENTRANT pour l\'archivage direct');
    process.exit(1);
  }
  console.log('   ✅ Rejet contrôlé conforme.');

  // Test 2: Valid direct archive with NOTE_SERVICE
  console.log('\n3. Test: Archivage direct valide avec NOTE_SERVICE...');
  const validRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/documents/incoming',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scToken}`
    }
  }, {
    title: 'Note de service relative au calendrier académique',
    official_type: 'NOTE_SERVICE',
    processing_mode: 'DIRECT_ARCHIVE',
    sender_name: 'Secrétariat Général',
    sender_organization: 'Université de Kindia',
    reception_date: '2026-08-15',
    priority: 'URGENT'
  });

  console.log(`   Statut HTTP: ${validRes.status}`);
  if (validRes.status !== 201) {
    console.error('❌ ÉCHEC de l\'enregistrement direct:', validRes.data);
    process.exit(1);
  }

  const doc = validRes.data;
  console.log(`   ✅ Document créé avec succès : ID=${doc.id}, Réf=${doc.reference}, Statut=${doc.status}`);

  // Test 3: Verify document status and target service
  const docInDb = await db.get('SELECT * FROM documents WHERE id = ?', [doc.id]);
  console.log(`   Vérification BDD: Type=${docInDb.document_type}, Statut=${docInDb.status}, Mode=${docInDb.processing_mode}`);
  if (docInDb.status !== 'PRÊT POUR ARCHIVAGE DIRECT' || docInDb.document_type !== 'NOTE_SERVICE') {
    console.error('❌ Données enregistrées incorrectes');
    process.exit(1);
  }

  // Cleanup test doc
  await db.run('DELETE FROM documents WHERE id = ?', [doc.id]);
  await db.run('DELETE FROM incoming_mails WHERE document_id = ?', [doc.id]);

  console.log('\n================================================================');
  console.log('🎉 TOUS LES TESTS D\'ARCHIVAGE DIRECT ONT RÉUSSI AVEC SUCCÈS !');
  console.log('================================================================');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
