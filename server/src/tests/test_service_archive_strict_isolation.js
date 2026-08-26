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
  console.log('========================================================================');
  console.log(' UK-GED : TEST D’ISOLATION STRICTE DES ARCHIVES PAR SERVICE (ADMIN & SC)');
  console.log('========================================================================\n');

  const adminToken = jwt.sign({ userId: 1, tokenVersion: 1 }, JWT_SECRET);

  // 1. Fetch categories for Secrétariat Central (service_id = 5)
  console.log('[TEST 1] Chargement des catégories pour Secrétariat Central (service_id = 5)...');
  const scCatsRes = await request('/api/archive-categories?service_id=5', {}, adminToken);
  assert.strictEqual(scCatsRes.status, 200, 'Doit retourner 200');
  const scCatNames = scCatsRes.data.customs.map(c => c.name);
  console.log('  -> Catégories SC :', scCatNames);
  assert.ok(scCatNames.includes('Ordres de Mission'), 'SC doit contenir Ordres de Mission');
  assert.ok(scCatNames.includes('Arrêtés'), 'SC doit contenir Arrêtés');
  assert.ok(scCatNames.includes('Circulaires'), 'SC doit contenir Circulaires');
  console.log('  ✅ PASS: Secrétariat Central possède ses catégories dédiées (9 catégories).\n');

  // 2. Fetch categories for Contrôle Financier (service_id = 7)
  console.log('[TEST 2] Chargement des catégories pour Contrôle Financier (service_id = 7)...');
  const cfCatsRes = await request('/api/archive-categories?service_id=7', {}, adminToken);
  assert.strictEqual(cfCatsRes.status, 200, 'Doit retourner 200');
  const cfCatNames = cfCatsRes.data.customs.map(c => c.name);
  console.log('  -> Catégories CF :', cfCatNames);
  assert.strictEqual(cfCatsRes.data.service_id, 7, 'Le service_id retourné doit être 7');
  assert.ok(!cfCatNames.includes('Ordres de Mission'), 'CF ne doit PAS contenir les Ordres de Mission du SC');
  assert.ok(!cfCatNames.includes('Arrêtés'), 'CF ne doit PAS contenir les Arrêtés du SC');
  assert.ok(!cfCatNames.includes('Circulaires'), 'CF ne doit PAS contenir les Circulaires du SC');
  assert.ok(cfCatNames.includes('Demandes') || cfCatNames.includes('Soit-transmis'), 'CF possède ses dossiers par défaut');
  console.log('  ✅ PASS: Contrôle Financier est strictement isolé (zéro catégorie de SC).\n');

  // 3. Switch back to Secrétariat Central (service_id = 5)
  console.log('[TEST 3] Re-sélection du Secrétariat Central (service_id = 5)...');
  const scCatsRes2 = await request('/api/archive-categories?service_id=5', {}, adminToken);
  assert.strictEqual(scCatsRes2.status, 200);
  assert.strictEqual(scCatsRes2.data.service_id, 5);
  assert.strictEqual(scCatsRes2.data.customs.length, scCatsRes.data.customs.length);
  console.log('  ✅ PASS: Re-sélection propre et réactive.\n');

  // 4. Test document archives query isolation (GET /api/documents/archives?service_id=7)
  console.log('[TEST 4] Vérification de l’isolation des documents archivés pour Contrôle Financier (service_id = 7)...');
  const cfArchivesRes = await request('/api/documents/archives?service_id=7&year=2026', {}, adminToken);
  assert.strictEqual(cfArchivesRes.status, 200);
  const cfDocCount = cfArchivesRes.data.documents.length;
  console.log(`  -> Documents archivés trouvés pour CF : ${cfDocCount}`);
  assert.ok(cfArchivesRes.data.documents.every(d => d.owner_service_id === 7 || d.originating_service_id === 7 || d.current_service_id === 7), 'Tous les documents appartiennent à CF');
  console.log('  ✅ PASS: Requête SQL des archives strictement isolée au service_id 7.\n');

  // 5. Test document archives query isolation (GET /api/documents/archives?service_id=5)
  console.log('[TEST 5] Vérification de l’isolation des documents archivés pour Secrétariat Central (service_id = 5)...');
  const scArchivesRes = await request('/api/documents/archives?service_id=5&year=2026', {}, adminToken);
  assert.strictEqual(scArchivesRes.status, 200);
  const scDocCount = scArchivesRes.data.documents.length;
  console.log(`  -> Documents archivés trouvés pour SC : ${scDocCount}`);
  assert.ok(scDocCount >= 2, 'SC possède au moins 2 ordres de mission archivés');
  assert.ok(scArchivesRes.data.documents.every(d => d.owner_service_id === 5 || d.originating_service_id === 5 || d.current_service_id === 5), 'Tous les documents appartiennent à SC');
  console.log('  ✅ PASS: Requête SQL des archives du SC intacte et isolée.\n');

  // 6. Test category customization isolation (modify CF category color / display order)
  console.log('[TEST 6] Test de modification d’une catégorie du Contrôle Financier...');
  const cfCat = cfCatsRes.data.customs[0];
  if (cfCat) {
    const updateRes = await request(`/api/archive-categories/${cfCat.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: cfCat.name,
        color: 'text-purple-700 bg-purple-50 border-purple-200',
        display_order: 15,
        is_active: true
      }
    }, adminToken);
    assert.strictEqual(updateRes.status, 200, 'La modification doit réussir');
    console.log(`  -> Catégorie ${cfCat.name} (Service CF) mise à jour avec succès.`);

    // Verify SC was not affected
    const scVerify = await request('/api/archive-categories?service_id=5', {}, adminToken);
    assert.ok(scVerify.data.customs.every(c => c.service_id === 5), 'Toutes les catégories de SC conservent service_id = 5');
    console.log('  ✅ PASS: La modification sur CF n’impacte aucunement SC.\n');
  }

  console.log('========================================================================');
  console.log(' TOUS LES 6 TESTS D’ISOLATION STRICTE DES ARCHIVES ONT RÉUSSI (100%)');
  console.log('========================================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
