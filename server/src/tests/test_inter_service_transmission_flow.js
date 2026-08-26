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
  console.log(' UK-GED : TEST TRANSMISSION INTER-SERVICES AVEC CRÉATION DE DOCUMENT');
  console.log('================================================================================\n');

  // Token for Secrétariat Central (user 2, service 5)
  const scToken = jwt.sign({ userId: 2, service_id: 5, role_code: 'AGENT_SC', permissions: ['documents.create', 'transmissions.create'] }, JWT_SECRET);
  // Token for Contrôle Financier (user 6, service 7)
  const cfToken = jwt.sign({ userId: 6, service_id: 7, role_code: 'CHEF_SERVICE', permissions: ['transmissions.view'] }, JWT_SECRET);

  const ts = Date.now();

  // 1. Create a document via /api/documents/administrative (what api.createDocument calls)
  console.log('[TEST 1] Création du document administratif via /api/documents/administrative...');
  const docRes = await request('/api/documents/administrative', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      title: `Bordereau Transmission Test ${ts}`,
      document_type: 'SOIT_TRANSMIS',
      document_category: 'SOIT_TRANSMIS',
      confidentiality: 'CONFIDENTIEL_INTER_SERVICES',
      description: 'Document test pour transmission inter-services',
      action: 'SUBMIT'
    }
  }, scToken);

  assert.strictEqual(docRes.status, 201, 'La création du document doit retourner 201');
  const createdDocId = docRes.data.id;
  console.log(`  -> Document créé avec succès : ID=${createdDocId}, Réf=${docRes.data.reference}`);

  // 2. Create transmission via /api/transmissions
  console.log('\n[TEST 2] Création de la transmission inter-services (SC ➔ CF)...');
  const transRes = await request('/api/transmissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      document_id: createdDocId,
      to_service_id: 7, // Contrôle Financier
      subject: `Transmission inter-services test ${ts}`,
      instruction: 'Prière de viser et retourner le document',
      confidentiality_level: 'CONFIDENTIEL_INTER_SERVICES',
      requires_signature: 1
    }
  }, scToken);

  assert.strictEqual(transRes.status, 201, 'La transmission doit retourner 201');
  const transmissionId = transRes.data.transmissionId;
  console.log(`  -> Transmission créée avec succès : ID=${transmissionId}, Réf=${transRes.data.transmissionNumber}`);

  // 3. Verify transmission in sender's sent items
  console.log('\n[TEST 3] Vérification dans la boîte des transmissions envoyées (SC)...');
  const sentRes = await request('/api/transmissions/sent', {}, scToken);
  assert.strictEqual(sentRes.status, 200);
  const sentTrans = (sentRes.data.transmissions || sentRes.data || []).find(t => t.id === transmissionId);
  assert.ok(sentTrans, 'La transmission doit être listée dans les envois du SC');
  console.log('  ✅ PASS: Présente dans la boîte d’envoi du service émetteur.');

  // 4. Verify transmission in recipient's inbox
  console.log('\n[TEST 4] Vérification dans la boîte de réception du destinataire (CF)...');
  const inboxRes = await request('/api/transmissions/inbox', {}, cfToken);
  assert.strictEqual(inboxRes.status, 200);
  const inboxTrans = (inboxRes.data.transmissions || inboxRes.data || []).find(t => t.id === transmissionId);
  assert.ok(inboxTrans, 'La transmission doit être reçue dans la boîte du Contrôle Financier');
  console.log('  ✅ PASS: Reçue avec succès par le Contrôle Financier.');

  console.log('\n================================================================================');
  console.log(' TOUS LES TESTS DE TRANSMISSION INTER-SERVICES ONT RÉUSSI AVEC SUCCÈS (100%)');
  console.log('================================================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
