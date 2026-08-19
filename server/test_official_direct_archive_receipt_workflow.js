const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5000';

function request(method, pathUrl, body = null, token = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers }
    };

    let postData = null;
    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        postData = body;
      } else {
        postData = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
      }
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function createMultipartBody(fields, files) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let chunks = [];

  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  for (const file of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.name}"\r\nContent-Type: ${file.mime}\r\n\r\n`));
    chunks.push(file.content);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const bodyBuffer = Buffer.concat(chunks);

  return {
    boundary,
    body: bodyBuffer,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': bodyBuffer.length
    }
  };
}

async function runDirectArchiveReceiptValidation() {
  console.log('========================================================================');
  console.log('🏛️ VALIDATION DU REÇU OFFICIEL ET ARCHIVAGE DIRECT UK-GED');
  console.log('========================================================================\n');

  const db = require('./src/database/db');

  // Authenticate
  const scLogin = await request('POST', '/api/auth/login', {
    identity: 'sc@univ-kindia.edu.gn',
    password: 'Agent123!'
  });
  if (scLogin.status !== 200 || !scLogin.data.token) throw new Error('Échec login SC');
  const scToken = scLogin.data.token;
  console.log('1. Authentification Secrétariat Central (SC) réussie.');

  const samplePdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n182\n%%EOF');

  // =========================================================================
  // TEST A: COURRIER ENTRANT NORMAL
  // =========================================================================
  console.log('\n2. [TEST A] Enregistrement d’un courrier entrant classique :');
  const normalMp = createMultipartBody({
    processing_mode: 'NORMAL',
    title: 'Demande de convention interuniversitaire 2026',
    sender_name: 'Université Gamal Abdel Nasser de Conakry (UGANC)',
    priority: 'NORMAL',
    instruction: 'Pour étude et avis du Recteur'
  }, [
    { field: 'files', name: 'demande_uganc.pdf', mime: 'application/pdf', content: samplePdf }
  ]);

  const normalRes = await request('POST', '/api/documents/incoming', normalMp.body, scToken, normalMp.headers);
  console.log(`   - Création Courrier Normal : Status ${normalRes.status} | ID: ${normalRes.data.id}`);
  if (normalRes.status !== 201 || !normalRes.data.receipt) {
    throw new Error('Échec génération reçu pour courrier normal: ' + JSON.stringify(normalRes));
  }
  console.log(`   - Référence : ${normalRes.data.reference}`);
  console.log(`   - Reçu N° : ${normalRes.data.receipt.receipt_number}`);
  console.log(`   - QR Code généré : ${normalRes.data.receipt.qr_code_data ? 'OUI (Data URL valide)' : 'NON'}`);
  console.log('   ✅ Test A réussi : Le reçu du courrier entrant normal est intact et fonctionnel.');

  // =========================================================================
  // TEST B: DOCUMENT OFFICIEL À ARCHIVER DIRECTEMENT
  // =========================================================================
  console.log('\n3. [TEST B] Enregistrement d’un document officiel à archiver directement :');
  const directMp = createMultipartBody({
    processing_mode: 'DIRECT_ARCHIVE',
    official_type: 'DECRET',
    title: 'Décret D/2026/095 portant nomination des doyens de facultés',
    sender_name: 'Présidence de la République de Guinée',
    priority: 'HIGH',
    instruction: 'Pour archivage officiel permanent'
  }, [
    { field: 'files', name: 'decret_doyens_2026.pdf', mime: 'application/pdf', content: samplePdf }
  ]);

  const directRes = await request('POST', '/api/documents/incoming', directMp.body, scToken, directMp.headers);
  console.log(`   - Création Document Officiel : Status ${directRes.status} | ID: ${directRes.data.id}`);
  if (directRes.status !== 201 || !directRes.data.receipt) {
    throw new Error('Échec création document officiel direct: ' + JSON.stringify(directRes));
  }

  const docId = directRes.data.id;
  const ref = directRes.data.reference;
  const receipt = directRes.data.receipt;

  console.log(`   - Référence Officielle : ${ref}`);
  console.log(`   - Numéro de Reçu : ${receipt.receipt_number}`);
  console.log(`   - QR Code : ${receipt.qr_code_data ? 'OUI (Généré)' : 'NON'}`);
  console.log(`   - URL Vérification : ${receipt.verification_url}`);

  // Contrôle direct en base de données
  const docInDb = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
  console.log(`   - Statut en base : ${docInDb.status} (Attendu: ARCHIVED)`);
  console.log(`   - Mode de traitement : ${docInDb.processing_mode} (Attendu: DIRECT_ARCHIVE)`);
  if (docInDb.status !== 'ARCHIVED' || docInDb.processing_mode !== 'DIRECT_ARCHIVE') {
    throw new Error('Le document n\'a pas été archivé directement en base.');
  }

  // Vérification de la non-duplication
  const docCount = await db.get('SELECT COUNT(*) as c FROM documents WHERE reference = ?', [ref]);
  console.log(`   - Nombre de documents en base pour la référence : ${docCount.c} (Attendu: 1)`);
  if (docCount.c !== 1) {
    throw new Error('Doublon détecté pour la référence !');
  }

  // Vérification du PDF du reçu officiel
  console.log('\n4. [TEST STREAMING REÇU PDF & QR CODE] :');
  const pdfRes = await request('GET', `/api/receipts/${receipt.id}/pdf`);
  console.log(`   - GET /api/receipts/${receipt.id}/pdf : Status ${pdfRes.status} (Content-Type: ${pdfRes.headers['content-type']})`);
  if (pdfRes.status !== 200 || !pdfRes.headers['content-type'].includes('application/pdf')) {
    throw new Error('Échec streaming du PDF du reçu.');
  }
  console.log('   ✅ Le PDF du reçu officiel est généré et téléchargeable.');

  // Vérification de la persistance après rechargement
  console.log('\n5. [TEST PERSISTANCE & RECHARGE REÇU] :');
  const fetchReceiptRes = await request('GET', `/api/receipts/document/${docId}`, null, scToken);
  console.log(`   - GET /api/receipts/document/${docId} : Status ${fetchReceiptRes.status}`);
  if (fetchReceiptRes.status !== 200 || !fetchReceiptRes.data.receipt) {
    throw new Error('Échec récupération du reçu existant.');
  }
  if (fetchReceiptRes.data.receipt.receipt_number !== receipt.receipt_number) {
    throw new Error('Le numéro de reçu a changé après réouverture !');
  }
  console.log(`   - Numéro Reçu persistant : ${fetchReceiptRes.data.receipt.receipt_number}`);
  console.log(`   - Référence persistante : ${fetchReceiptRes.data.receipt.document_reference}`);
  console.log(`   - Statut persistant : ${fetchReceiptRes.data.receipt.document_status}`);
  console.log('   ✅ Persistance 100% validée sans duplication.');

  console.log('\n========================================================================');
  console.log('🎉 VALIDATION COMPLÈTE DU WORKFLOW ET DU REÇU OFFICIEL RÉUSSIE (100%) !');
  console.log('========================================================================\n');
}

runDirectArchiveReceiptValidation().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ ERREUR LORS DE LA VALIDATION:', err);
  process.exit(1);
});
