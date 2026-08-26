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
  console.log(' UK-GED : VALIDATION STRICTE DES ARCHIVES PAR SERVICE & ARCHIVES CENTRALES');
  console.log('================================================================================\n');

  const adminToken = jwt.sign({ userId: 1, role_code: 'ADMINISTRATEUR', tokenVersion: 1 }, JWT_SECRET);
  // Secrétariat Central Agent token (User 2 or 5, service_id = 5)
  const scToken = jwt.sign({ userId: 2, role_code: 'AGENT_SECRÉTARIAT_CENTRAL', service_id: 5, service_code: 'SC', tokenVersion: 1 }, JWT_SECRET);
  // Contrôle Financier Agent token (service_id = 7)
  const cfToken = jwt.sign({ userId: 7, role_code: 'CHEF_SERVICE', service_id: 7, service_code: 'CF', tokenVersion: 1 }, JWT_SECRET);
  // Faculté des Sciences Agent token (service_id = 28)
  const fsToken = jwt.sign({ userId: 28, role_code: 'CHEF_SERVICE', service_id: 28, service_code: 'FSS', tokenVersion: 1 }, JWT_SECRET);

  const ts = Date.now();

  // --------------------------------------------------------------------------
  // SETUP : Création / Archivage de documents dans 3 services distincts
  // --------------------------------------------------------------------------
  console.log('[SETUP] Insertion de documents d’archives pour 3 services distincts (SC, CF, FS)...');

  // Document 1 : Secrétariat Central (Service 5)
  const scDocRef = `SC-ARCH-${ts}`;
  const scDocRes = await db.run(
    `INSERT INTO documents (
      reference, title, document_type, document_category, archive_category,
      owner_service_id, originating_service_id, current_service_id,
      created_by, status, archive_scope, is_central_archived, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [scDocRef, 'Arrivée Officielle SC', 'COURRIER_ENTRANT', 'OFFICIAL', 'Arrivée', 5, 5, 5, 1, 'ARCHIVED', 'CENTRAL', 1]
  );
  const scDocId = scDocRes.lastID;

  // Document 2 : Contrôle Financier (Service 7)
  const cfDocRef = `CF-ARCH-${ts}`;
  const cfDocRes = await db.run(
    `INSERT INTO documents (
      reference, title, document_type, document_category, archive_category,
      owner_service_id, originating_service_id, current_service_id,
      created_by, status, archive_scope, is_central_archived, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [cfDocRef, 'Demande d’Engagement CF', 'DEMANDE', 'OFFICIAL', 'Demandes', 7, 7, 7, 1, 'ARCHIVED', 'PRIVE_SERVICE', 0]
  );
  const cfDocId = cfDocRes.lastID;

  // Document 3 : Faculté des Sciences (Service 28)
  const fsDocRef = `FS-ARCH-${ts}`;
  const fsDocRes = await db.run(
    `INSERT INTO documents (
      reference, title, document_type, document_category, archive_category,
      owner_service_id, originating_service_id, current_service_id,
      created_by, status, archive_scope, is_central_archived, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [fsDocRef, 'Note de Service Faculté FS', 'NOTE_SERVICE', 'OFFICIAL', 'Notes de Service', 28, 28, 28, 1, 'ARCHIVED', 'PRIVE_SERVICE', 0]
  );
  const fsDocId = fsDocRes.lastID;

  console.log(`  -> Documents insérés : SC(#${scDocId}), CF(#${cfDocId}), FS(#${fsDocId})\n`);

  // --------------------------------------------------------------------------
  // TEST A : Secrétariat Central (Service 5)
  // --------------------------------------------------------------------------
  console.log('[TEST A] Vérification des archives du Secrétariat Central (Service 5)...');
  const scArchives = await request('/api/documents/archives?service_id=5', {}, adminToken);
  assert.strictEqual(scArchives.status, 200);
  assert.ok(scArchives.data.documents.some(d => d.id === scDocId), 'Le document SC doit être présent dans les archives du SC');
  assert.ok(!scArchives.data.documents.some(d => d.id === cfDocId), 'Le document CF ne doit PAS être dans les archives du SC');
  assert.ok(!scArchives.data.documents.some(d => d.id === fsDocId), 'Le document FS ne doit PAS être dans les archives du SC');
  console.log('  ✅ PASS Test A: Archives du Secrétariat Central isolées avec succès.\n');

  // --------------------------------------------------------------------------
  // TEST B : Contrôle Financier (Service 7)
  // --------------------------------------------------------------------------
  console.log('[TEST B] Vérification des archives du Contrôle Financier (Service 7)...');
  const cfArchives = await request('/api/documents/archives?service_id=7', {}, adminToken);
  assert.strictEqual(cfArchives.status, 200);
  assert.ok(cfArchives.data.documents.some(d => d.id === cfDocId), 'Le document CF doit être présent dans les archives du CF');
  assert.ok(!cfArchives.data.documents.some(d => d.id === scDocId), 'Le document SC ne doit PAS fuiter dans les archives du CF');
  assert.ok(!cfArchives.data.documents.some(d => d.id === fsDocId), 'Le document FS ne doit PAS fuiter dans les archives du CF');
  console.log('  ✅ PASS Test B: Archives du Contrôle Financier isolées avec succès.\n');

  // --------------------------------------------------------------------------
  // TEST C : Faculté des Sciences (Service 28)
  // --------------------------------------------------------------------------
  console.log('[TEST C] Vérification des archives de la Faculté des Sciences (Service 28)...');
  const fsArchives = await request('/api/documents/archives?service_id=28', {}, adminToken);
  assert.strictEqual(fsArchives.status, 200);
  assert.ok(fsArchives.data.documents.some(d => d.id === fsDocId), 'Le document FS doit être présent dans les archives de la Faculté');
  assert.ok(!fsArchives.data.documents.some(d => d.id === scDocId), 'Le document SC ne doit PAS fuiter dans la Faculté');
  assert.ok(!fsArchives.data.documents.some(d => d.id === cfDocId), 'Le document CF ne doit PAS fuiter dans la Faculté');
  console.log('  ✅ PASS Test C: Archives de la Faculté des Sciences isolées avec succès.\n');

  // --------------------------------------------------------------------------
  // TEST D : Sélection dynamique des services par l’Administrateur
  // --------------------------------------------------------------------------
  console.log('[TEST D] Test du sélecteur dynamique Admin (SC ➔ CF ➔ FS ➔ SC)...');
  const switch1 = await request('/api/documents/archives?service_id=5', {}, adminToken);
  const switch2 = await request('/api/documents/archives?service_id=7', {}, adminToken);
  const switch3 = await request('/api/documents/archives?service_id=28', {}, adminToken);

  assert.strictEqual(switch1.data.service_id, 5);
  assert.strictEqual(switch2.data.service_id, 7);
  assert.strictEqual(switch3.data.service_id, 28);
  assert.notDeepStrictEqual(switch1.data.documents.map(d=>d.id), switch2.data.documents.map(d=>d.id));
  assert.notDeepStrictEqual(switch2.data.documents.map(d=>d.id), switch3.data.documents.map(d=>d.id));
  console.log('  ✅ PASS Test D: Le sélecteur de service pilote 100% dynamiquement les requêtes sans résidu.\n');

  // --------------------------------------------------------------------------
  // TEST E : Archives Centrales (Vue agrégée consolidée avec propriétaire)
  // --------------------------------------------------------------------------
  console.log('[TEST E] Test de consultation des Archives Centrales (Scope Central / Institutional)...');
  const centralArchives = await request('/api/documents/archives?scope=CENTRAL', {}, adminToken);
  assert.strictEqual(centralArchives.status, 200);
  assert.ok(centralArchives.data.documents.some(d => d.id === scDocId), 'Le document SC versé aux archives centrales doit être présent');
  const foundScDoc = centralArchives.data.documents.find(d => d.id === scDocId);
  assert.ok(foundScDoc.owner_service_name || foundScDoc.owner_service_id, 'Le service propriétaire doit être renseigné');
  console.log('  ✅ PASS Test E: Archives Centrales agrègent les documents versés avec service propriétaire distinct.\n');

  // --------------------------------------------------------------------------
  // TEST F : Clic sur catégorie et chargement des documents
  // --------------------------------------------------------------------------
  console.log('[TEST F] Test de filtrage par catégorie spécifique (ex: DEMANDE)...');
  const catFilterRes = await request('/api/documents/archives?service_id=7&category=DEMANDE', {}, adminToken);
  assert.strictEqual(catFilterRes.status, 200);
  assert.ok(catFilterRes.data.documents.length >= 1, 'La catégorie DEMANDE doit charger le document correspondant');
  assert.strictEqual(catFilterRes.data.documents[0].id, cfDocId);

  // Test consultation directe du document par son ID
  const singleDocRes = await request(`/api/documents/${cfDocId}`, {}, adminToken);
  assert.strictEqual(singleDocRes.status, 200);
  assert.strictEqual(singleDocRes.data.id, cfDocId);
  assert.strictEqual(singleDocRes.data.reference, cfDocRef);
  console.log('  ✅ PASS Test F: Chargement garanti des documents au clic sur une catégorie et par ID direct.\n');

  console.log('================================================================================');
  console.log(' TOUS LES TESTS DE VALIDATION DES ARCHIVES ONT RÉUSSI AVEC SUCCÈS (100%)');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
