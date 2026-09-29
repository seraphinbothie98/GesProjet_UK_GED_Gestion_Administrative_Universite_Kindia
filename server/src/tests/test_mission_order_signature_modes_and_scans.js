const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

function request(pathUrl, options = {}, token) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: pathUrl,
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
    if (options.body) {
      if (Buffer.isBuffer(options.body)) {
        req.write(options.body);
      } else {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
    }
    req.end();
  });
}

function buildMultipartBody(fields, files, boundary) {
  const chunks = [];
  
  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  for (const file of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
    chunks.push(file.buffer);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 TEST COMPLET : MODES DE SIGNATURE & SCAN ORDRE DE MISSION');
  console.log('======================================================\n');

  // Users:
  // SC: id 108 (service SC)
  // SG: id 113 (service SG)
  // Admin: id 1
  const scToken = jwt.sign({ userId: 108, tokenVersion: 1 }, JWT_SECRET);
  const sgToken = jwt.sign({ userId: 113, tokenVersion: 1 }, JWT_SECRET);
  const adminToken = jwt.sign({ userId: 1, tokenVersion: 1 }, JWT_SECRET);

  console.log('1. TEST CRÉATION OM - MODE A (MANUSCRIT)...');
  const createModeARes = await request('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      missionary_name: 'Dr. Mamadou Diallo',
      missionary_role: 'Enseignant-Chercheur',
      destination: 'Mamou',
      object_of_mission: 'Mission d’évaluation académique',
      departure_date: '2026-10-01',
      return_date: '2026-10-05',
      transport_mode: 'Transport en commun',
      signature_mode: 'MANUSCRIPT'
    }
  }, scToken);

  assert.strictEqual(createModeARes.status, 201, `Création OM Manuscrit échouée: ${JSON.stringify(createModeARes.data)}`);
  const omAId = createModeARes.data.id;
  console.log(`   -> OM créé avec ID: ${omAId}, Référence: ${createModeARes.data.reference}`);

  const getOmARes = await request(`/api/missions/${omAId}`, {}, scToken);
  assert.strictEqual(getOmARes.status, 200);
  const omA = getOmARes.data.data;
  console.log(`   -> Mode: ${omA.signature_mode}, Statut: ${omA.status}`);
  assert.strictEqual(omA.signature_mode, 'MANUSCRIPT');
  assert.strictEqual(omA.status, 'EN ATTENTE DE SIGNATURE MANUSCRITE');

  console.log('\n2. VÉRIFICATION FILTRAGE /to-sign (L’OM manuscrit ne doit PAS polluer la boîte de signature électronique du SG)...');
  const toSignRes = await request('/api/missions/to-sign', {}, sgToken);
  assert.strictEqual(toSignRes.status, 200);
  const isInElectronicInbox = (toSignRes.data || []).some(m => m.id === omAId);
  assert.strictEqual(isInElectronicInbox, false, 'L’OM manuscrit ne doit pas figurer dans /to-sign électronique du SG');
  console.log('   -> OK : OM manuscrit absent de la boîte électronique du SG.');

  console.log('\n3. TEST MARQUAGE "SIGNÉ MANUSCRIT" PAR LE SC...');
  const markSignedRes = await request(`/api/missions/${omAId}/mark-manuscript-signed`, {
    method: 'POST'
  }, scToken);
  assert.strictEqual(markSignedRes.status, 200, `Erreur marquage signé manuscrit: ${JSON.stringify(markSignedRes.data)}`);
  console.log(`   -> OK : Statut après signature physique : ${markSignedRes.data.status}`);
  assert.strictEqual(markSignedRes.data.status, 'SIGNÉ MANUSCRITEMENT – EN ATTENTE DE NUMÉRISATION');

  console.log('\n4. TEST IMPORT DU SCAN DU DOCUMENT SIGNÉ & CACHETÉ PAR LE SC...');
  const dummyScanBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 595 842]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n162\n%%EOF');
  
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const multipartBody = buildMultipartBody(
    { notes: 'Scan physique avec signature manuscrite du SG et cachet officiel' },
    [{ fieldname: 'scanned_file', filename: `scan_om_${omAId}.pdf`, contentType: 'application/pdf', buffer: dummyScanBuffer }],
    boundary
  );

  const uploadRes = await request(`/api/missions/${omAId}/upload-signed-scan`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBody.length
    },
    body: multipartBody
  }, scToken);

  assert.strictEqual(uploadRes.status, 200, `Upload scan échoué: ${JSON.stringify(uploadRes.data)}`);
  console.log(`   -> OK : Scan importé avec succès!`);
  console.log(`   -> Nouveau Statut: ${uploadRes.data.status}`);
  console.log(`   -> Fichier Scanné: ${uploadRes.data.pdf_url}`);
  assert.strictEqual(uploadRes.data.status, 'NUMÉRISÉ – RETOUR AU SECRÉTARIAT CENTRAL');

  console.log('\n5. TEST CHANGEMENT DE MODE (BASCULE VERS ÉLECTRONIQUE ET INVERSEMENT)...');
  const omSwitchRes = await request('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      missionary_name: 'Dr. Aissatou Camara',
      destination: 'Conakry',
      object_of_mission: 'Colloque International',
      departure_date: '2026-11-01',
      return_date: '2026-11-03',
      transport_mode: 'Transport en commun',
      signature_mode: 'MANUSCRIPT'
    }
  }, scToken);
  const omSwitchId = omSwitchRes.data.id;
  
  const switchRes = await request(`/api/missions/${omSwitchId}/signature-mode`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: { signature_mode: 'ELECTRONIC' }
  }, scToken);
  assert.strictEqual(switchRes.status, 200);
  assert.strictEqual(switchRes.data.signature_mode, 'ELECTRONIC');
  assert.strictEqual(switchRes.data.status, 'EN ATTENTE DE SIGNATURE');
  console.log('   -> OK : Bascule réussie vers mode ÉLECTRONIQUE avec statut EN ATTENTE DE SIGNATURE.');

  console.log('\n6. TEST MODE B (ÉLECTRONIQUE) - SIGNATURE ÉLECTRONIQUE PAR LE SG...');
  const signRes = await request(`/api/missions/${omSwitchId}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      reason: 'Validation et signature officielle',
      notes: 'Signé électroniquement en mission'
    }
  }, sgToken);
  assert.strictEqual(signRes.status, 200, `Signature électronique échouée: ${JSON.stringify(signRes.data)}`);
  console.log(`   -> OK : OM signé électroniquement par le SG. Message: ${signRes.data.message || 'Succès'}`);

  console.log('\n7. TEST REMISE AU DEMANDEUR (PAR LE SC)...');
  const deliverRes = await request(`/api/missions/${omAId}/deliver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { recipient_name: 'Dr. Mamadou Diallo' }
  }, scToken);
  assert.strictEqual(deliverRes.status, 200);
  console.log('   -> OK : OM remis au bénéficiaire.');

  console.log('\n8. TEST ARCHIVAGE FINAL PAR LE SECRÉTARIAT CENTRAL (SC)...');
  const scArchiveRes = await request(`/api/documents/${omAId}/archive`, {
    method: 'POST'
  }, scToken);
  assert.strictEqual(scArchiveRes.status, 200, `Archivage SC échoué: ${JSON.stringify(scArchiveRes.data)}`);
  console.log('   -> OK : Archivage final exécuté avec succès par le Secrétariat Central.');

  console.log('\n======================================================');
  console.log('✅ TOUS LES TESTS DES MODES A ET B ONT RÉUSSI AVEC SUCCÈS !');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ ERREUR LORS DES TESTS:', err);
  process.exit(1);
});
