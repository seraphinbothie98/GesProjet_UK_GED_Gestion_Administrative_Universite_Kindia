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
  console.log(' UK-GED : TEST SUPPRESSION D’UTILISATEURS ET NETTOYAGE DES DOUBLONS');
  console.log('================================================================================\n');

  const adminToken = jwt.sign({ userId: 1, role_code: 'ADMINISTRATEUR', tokenVersion: 1 }, JWT_SECRET);
  const ts = Date.now();

  // 1. Create a temporary test user
  console.log('[TEST 1] Création d’un utilisateur de test temporaire...');
  const createRes = await request('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      matricule: `MAT-DEL-${ts}`,
      first_name: 'Utilisateur',
      last_name: 'A_SUPPRIMER',
      email: `temp.del.${ts}@univ-kindia.edu.gn`,
      phone: '+224 600 00 00 00',
      function_title: 'Agent Temporaire',
      service_id: 5,
      role_id: 2,
      password: 'Password123!'
    }
  }, adminToken);

  assert.strictEqual(createRes.status, 201);
  const targetId = createRes.data.id;
  console.log(`  -> Utilisateur créé avec ID = ${targetId}`);

  // Verify presence in users and staff
  const staffBefore = await db.get('SELECT id FROM staff WHERE user_id = ?', [targetId]);
  assert.ok(staffBefore, 'La fiche staff correspondante existe');

  // 2. Try deleting super admin (id = 1) -> must be rejected
  console.log('[TEST 2] Tentative de suppression du compte administrateur racine (ID 1)...');
  const delAdminRes = await request('/api/users/1', { method: 'DELETE' }, adminToken);
  assert.strictEqual(delAdminRes.status, 400, 'Doit refuser la suppression de l’administrateur racine');
  console.log('  ✅ PASS: Rejet sécurisé de la suppression du compte racine.\n');

  // 3. Delete the target user
  console.log('[TEST 3] Suppression de l’utilisateur de test (ID ' + targetId + ')...');
  const delRes = await request(`/api/users/${targetId}`, { method: 'DELETE' }, adminToken);
  assert.strictEqual(delRes.status, 200, 'La suppression doit retourner 200');
  console.log('  -> Message retourné :', delRes.data.message);

  // 4. Verify user is removed from users table
  const userAfter = await db.get('SELECT id FROM users WHERE id = ?', [targetId]);
  assert.strictEqual(userAfter, undefined, 'L’utilisateur ne doit plus exister dans users');

  // 5. Verify staff entry is removed or cleaned up
  const staffAfter = await db.get('SELECT id FROM staff WHERE user_id = ?', [targetId]);
  assert.strictEqual(staffAfter, undefined, 'La fiche staff liée ne doit plus exister');
  console.log('  ✅ PASS: Nettoyage complet dans users et staff.\n');

  // 6. Clean up existing inactive test duplicates from database if any
  console.log('[TEST 6] Nettoyage des doublons de test inactifs (MAT-OO-B-*, MAT-OO-A-*)...');
  const testUsers = await db.all('SELECT id, first_name, last_name, matricule FROM users WHERE matricule LIKE "MAT-OO-%"');
  for (const tu of testUsers) {
    const r = await request(`/api/users/${tu.id}`, { method: 'DELETE' }, adminToken);
    assert.strictEqual(r.status, 200);
    console.log(`  -> Doublon supprimé : ${tu.first_name} ${tu.last_name} (${tu.matricule})`);
  }

  console.log('\n================================================================================');
  console.log(' TOUS LES TESTS DE SUPPRESSION D’UTILISATEUR ONT RÉUSSI AVEC SUCCÈS (100%)');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
