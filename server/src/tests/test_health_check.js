const assert = require('assert');
const http = require('http');

async function testHealthCheck() {
  console.log('\n🧪 [TEST] Démarrage du test du endpoint /api/health...');

  const options = {
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/health',
    method: 'GET'
  };

  const data = await new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });

  console.log(`  -> Status code : ${data.statusCode}`);
  console.log(`  -> Health body :`, JSON.stringify(data.body, null, 2));

  assert.strictEqual(data.statusCode, 200, 'Health check doit retourner 200 OK');
  assert.strictEqual(data.body.status, 'HEALTHY', 'Le statut global doit être HEALTHY');
  assert.strictEqual(data.body.components.database.status, 'HEALTHY', 'La base doit être HEALTHY');
  assert.strictEqual(data.body.components.storage.status, 'HEALTHY', 'Le stockage doit être HEALTHY');
  assert.strictEqual(data.body.components.migrations.up_to_date, true, 'Les migrations doivent être à jour');

  console.log('✅ [TEST PASSÉ] Endpoint /api/health entièrement conforme et fonctionnel !\n');
}

testHealthCheck().catch(err => {
  console.error('❌ [TEST ÉCHOUÉ] Erreur lors du test de santé:', err.message);
  process.exit(1);
});
