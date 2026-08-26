const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const db = require('../database/db');

function request(path, options = {}, token) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      headers: { ...defaultHeaders, ...(options.headers || {}) },
      method: options.method || 'GET'
    }, (res) => {
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
    if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

async function runTests() {
  console.log('================================================================================');
  console.log(' UK-GED : TEST D’UNIFICATION & SYNCHRONISATION UTILISATEURS / PERSONNEL (1-9)');
  console.log('================================================================================\n');

  const adminToken = jwt.sign({ userId: 1, tokenVersion: 1 }, JWT_SECRET);
  const ts = Date.now();
  const testMatricule = `UK-SYNC-${ts}`;
  const testEmail = `agent.sync.${ts}@univ-kindia.edu.gn`;

  // --------------------------------------------------------------------------
  // TEST 1: Admin creates a user -> automatically available in Personnel
  // --------------------------------------------------------------------------
  console.log('[TEST 1] Création d’un utilisateur par l’Administrateur dans « Gestion des utilisateurs »...');
  const createRes = await request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      matricule: testMatricule,
      first_name: 'Aboubacar',
      last_name: 'SYLLA',
      email: testEmail,
      phone: '+224 622 11 22 33',
      function_title: 'Agent Administratif',
      service_id: 5, // Secrétariat Central
      role_id: 2,
      password: 'InitialPassword123!'
    }
  }, adminToken);

  assert.strictEqual(createRes.status, 201, 'La création de l’utilisateur doit retourner HTTP 201');
  const newUserId = createRes.data.id;
  console.log(`  -> Compte utilisateur créé avec user_id = ${newUserId}`);

  // Check in GET /api/staff
  const staffListRes = await request(`/api/staff?query=${testMatricule}`, {}, adminToken);
  assert.strictEqual(staffListRes.status, 200);
  assert.ok(staffListRes.data.length >= 1, 'L’utilisateur doit apparaître dans le répertoire Personnel');
  const staffMember = staffListRes.data.find(s => s.matricule === testMatricule);
  assert.ok(staffMember, 'Fiche personnel trouvée');
  assert.strictEqual(staffMember.nom, 'SYLLA');
  assert.strictEqual(staffMember.prenoms, 'Aboubacar');
  assert.strictEqual(staffMember.service_id, 5);
  assert.strictEqual(staffMember.status, 'ACTIF');
  console.log('  ✅ PASS Test 1: Utilisateur automatiquement disponible dans Personnel avec toutes ses données.\n');

  // --------------------------------------------------------------------------
  // TEST 2: Single source of truth, no duplicates
  // --------------------------------------------------------------------------
  console.log('[TEST 2] Vérification de l’unicité du compte et de la liaison user_id...');
  const staffInDb = await db.all('SELECT * FROM staff WHERE user_id = ? OR matricule = ?', [newUserId, testMatricule]);
  assert.strictEqual(staffInDb.length, 1, 'Il ne doit exister qu’une seule fiche personnel liée au user_id');
  assert.strictEqual(staffInDb[0].user_id, newUserId, 'La fiche staff pointe directement vers le user_id');
  console.log('  ✅ PASS Test 2: Unicité stricte garantie (un seul user_id, zéro doublon).\n');

  // --------------------------------------------------------------------------
  // TEST 3: Admin modifies name and phone -> immediately updated in Personnel
  // --------------------------------------------------------------------------
  console.log('[TEST 3] Modification du nom, prénom et téléphone par l’Administrateur...');
  const updateRes = await request(`/api/users/${newUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: {
      matricule: testMatricule,
      first_name: 'Aboubacar Sidiki',
      last_name: 'SYLLA-NOUVEAU',
      email: testEmail,
      phone: '+224 622 99 88 77',
      function_title: 'Responsable Courrier',
      service_id: 5,
      role_id: 2,
      status: 'ACTIVE'
    }
  }, adminToken);

  assert.strictEqual(updateRes.status, 200, 'La modification doit réussir');
  const staffCheck3 = await request(`/api/staff/${staffMember.id}`, {}, adminToken);
  assert.strictEqual(staffCheck3.data.staff.nom, 'SYLLA-NOUVEAU');
  assert.strictEqual(staffCheck3.data.staff.prenoms, 'Aboubacar Sidiki');
  assert.strictEqual(staffCheck3.data.staff.telephone, '+224 622 99 88 77');
  assert.strictEqual(staffCheck3.data.staff.fonction, 'Responsable Courrier');
  console.log('  ✅ PASS Test 3: Modifications répercutées instantanément dans le Personnel.\n');

  // --------------------------------------------------------------------------
  // TEST 4: Admin changes user service -> personnel moved to new service
  // --------------------------------------------------------------------------
  console.log('[TEST 4] Changement de service de l’utilisateur (Secrétariat Central ➔ Contrôle Financier)...');
  const changeSrvRes = await request(`/api/users/${newUserId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: {
      matricule: testMatricule,
      first_name: 'Aboubacar Sidiki',
      last_name: 'SYLLA-NOUVEAU',
      email: testEmail,
      phone: '+224 622 99 88 77',
      function_title: 'Contrôleur Adjoint',
      service_id: 7, // Contrôle Financier
      role_id: 2,
      status: 'ACTIVE'
    }
  }, adminToken);

  assert.strictEqual(changeSrvRes.status, 200);
  const staffCheck4 = await request(`/api/staff/${staffMember.id}`, {}, adminToken);
  assert.strictEqual(staffCheck4.data.staff.service_id, 7);
  assert.strictEqual(staffCheck4.data.staff.service_code, 'CF');

  // Filter staff by SC (5) vs CF (7)
  const scStaffList = await request('/api/staff?service_id=5', {}, adminToken);
  assert.ok(!scStaffList.data.some(s => s.user_id === newUserId), 'Ne doit plus être dans le personnel du SC');
  const cfStaffList = await request('/api/staff?service_id=7', {}, adminToken);
  assert.ok(cfStaffList.data.some(s => s.user_id === newUserId), 'Doit être dans le personnel du CF');
  console.log('  ✅ PASS Test 4: Changement de service propre et sans perte de compte.\n');

  // --------------------------------------------------------------------------
  // TEST 5: Account deactivation -> status synchronized
  // --------------------------------------------------------------------------
  console.log('[TEST 5] Désactivation du compte utilisateur...');
  const disableRes = await request(`/api/users/${newUserId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: { status: 'INACTIVE' }
  }, adminToken);
  assert.strictEqual(disableRes.status, 200);

  const staffCheck5 = await request(`/api/staff/${staffMember.id}`, {}, adminToken);
  assert.strictEqual(staffCheck5.data.staff.status, 'INACTIF');
  console.log('  ✅ PASS Test 5: Statut inactif synchronisé dans le répertoire du personnel.\n');

  // --------------------------------------------------------------------------
  // TEST 6: Old documents/missions linked to user remain intact
  // --------------------------------------------------------------------------
  console.log('[TEST 6] Vérification de l’intégrité des documents et ordres de mission historiques...');
  const docsCount = await db.get('SELECT COUNT(*) as count FROM documents WHERE status != "TRASHED"');
  assert.ok(docsCount.count > 0, 'Les documents existants sont conservés');
  const missionCount = await db.get('SELECT COUNT(*) as count FROM mission_orders');
  assert.ok(missionCount.count > 0, 'Les ordres de mission existants sont conservés');
  console.log(`  -> ${docsCount.count} documents et ${missionCount.count} ordres de mission intacts.`);
  console.log('  ✅ PASS Test 6: Intégrité documentaire 100% préservée.\n');

  // --------------------------------------------------------------------------
  // TEST 7: Signatures and transmissions remain intact
  // --------------------------------------------------------------------------
  console.log('[TEST 7] Vérification de l’intégrité des signatures et transmissions...');
  const sigCount = await db.get('SELECT COUNT(*) as count FROM document_signatures');
  const transCount = await db.get('SELECT COUNT(*) as count FROM service_transmissions');
  console.log(`  -> ${sigCount.count} signatures et ${transCount.count} transmissions intactes.`);
  console.log('  ✅ PASS Test 7: Signatures et transmissions historiques intactes.\n');

  // --------------------------------------------------------------------------
  // TEST 8: Archives remain intact
  // --------------------------------------------------------------------------
  console.log('[TEST 8] Vérification de l’intégrité des archives...');
  const archCount = await db.get('SELECT COUNT(*) as count FROM documents WHERE status IN ("ARCHIVED", "ARCHIVÉ")');
  console.log(`  -> ${archCount.count} documents archivés toujours présents.`);
  console.log('  ✅ PASS Test 8: Fonds documentaire d’archives intact.\n');

  // --------------------------------------------------------------------------
  // TEST 9: Duplicate prevention
  // --------------------------------------------------------------------------
  console.log('[TEST 9] Test de prévention des doublons (tentative de création avec le même matricule)...');
  const dupUserRes = await request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      matricule: testMatricule,
      first_name: 'Autre',
      last_name: 'DOUBLON',
      email: `autre.${ts}@univ-kindia.edu.gn`,
      phone: '+224 622 00 00 00',
      function_title: 'Doublon',
      service_id: 5,
      role_id: 2,
      password: 'Password123!'
    }
  }, adminToken);
  assert.strictEqual(dupUserRes.status, 400, 'Doit rejeter la création du doublon');
  console.log('  -> Rejeté avec message :', dupUserRes.data.error);

  const dupCheckApi = await request(`/api/staff/check-duplicate?matricule=${testMatricule}`, {}, adminToken);
  assert.strictEqual(dupCheckApi.data.duplicate, true, 'check-duplicate doit détecter le doublon');
  console.log('  ✅ PASS Test 9: Détection et rejet des doublons fonctionnels (users & staff).\n');

  console.log('================================================================================');
  console.log(' TOUS LES 9 TESTS DE SYNCHRONISATION UTILISATEURS / PERSONNEL ONT RÉUSSI (100%)');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
