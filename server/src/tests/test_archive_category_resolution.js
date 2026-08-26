const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

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
  console.log('--- TEST : Résolution des catégories d’archives UK-GED ---');
  const scToken = jwt.sign({ userId: 2, tokenVersion: 1 }, JWT_SECRET);

  // 1. Get archives for SC
  const archivesRes = await request('/api/documents/archives?year=2026', {}, scToken);
  assert.strictEqual(archivesRes.status, 200, 'GET /archives must return 200');
  
  const missionCat = archivesRes.data.categories_summary.find(c => c.label === 'Ordres de Mission' || c.code.includes('MISSION'));
  assert.ok(missionCat, 'Category Ordres de Mission must exist');
  assert.ok(missionCat.count >= 2, `Ordres de Mission count must be at least 2, got ${missionCat.count}`);

  const nonClasseCat = archivesRes.data.categories_summary.find(c => c.code === 'NON_CLASSE');
  assert.ok(nonClasseCat, 'Category Non classés must exist');
  console.log('  ✅ PASS: Compteur Ordres de mission correct =', missionCat.count);
  console.log('  ✅ PASS: Compteur Non classés correct =', nonClasseCat.count);

  // 2. Filter by Ordres de Mission category
  const filteredRes = await request(`/api/documents/archives?category=${missionCat.code}&year=2026`, {}, scToken);
  assert.strictEqual(filteredRes.status, 200);
  assert.ok(filteredRes.data.documents.length >= 2, 'Filtered documents must contain the archived mission orders');
  assert.ok(filteredRes.data.documents.every(d => d.document_type === 'MISSION_ORDER' || d.title.toLowerCase().includes('mission')), 'All returned documents are mission orders');
  console.log('  ✅ PASS: Filtrage par catégorie Ordres de Mission retourne les documents archivés');

  console.log('\n======================================================');
  console.log(' TOUS LES TESTS DE CATÉGORISATION D’ARCHIVES ONT RÉUSSI');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
