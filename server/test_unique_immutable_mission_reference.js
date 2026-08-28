/**
 * Automated Verification Script for Unique Immutable Reference System for Mission Orders
 * Université de Kindia (UK-GED)
 *
 * Règle métier : « La référence est attribuée une seule fois à la demande initiale
 * et devient la référence officielle de tout le dossier. La création de l'ordre de mission
 * ne doit JAMAIS générer une nouvelle référence. »
 */

const assert = require('assert');
const db = require('./src/database/db');
const request = require('http');

const BASE_URL = 'http://localhost:5000/api';

async function httpRequest(urlPath, method = 'GET', body = null, headers = {}) {
  const url = new URL(`${BASE_URL}${urlPath}`);
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = request.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            resolve({ status: res.statusCode, data: parsed, headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, raw: rawData });
          }
        });
      }
    );

    req.on('error', (e) => reject(e));
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(identity, password) {
  const res = await httpRequest('/auth/login', 'POST', { identity, password });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Login failed for ${identity}: ${JSON.stringify(res.data)}`);
  }
  return res.data.token;
}

async function runTests() {
  console.log('================================================================');
  console.log(' UK-GED - TESTS DE LA RÉFÉRENCE UNIQUE & IMMUABLE DES MISSIONS');
  console.log('================================================================\n');

  let passed = 0;

  try {
    const scToken = await login('sc@univ-kindia.edu.gn', 'Agent123!');
    const sgToken = await login('sg@univ-kindia.edu.gn', 'Sg123!');

    // -------------------------------------------------------------------------
    // TEST 1 : Créer une demande d'ordre de mission
    // -------------------------------------------------------------------------
    console.log('--- TEST 1 : Création de la demande initiale ---');
    const authVerify = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-DAF-005',
      password: 'Daf123!'
    });
    assert.strictEqual(authVerify.status, 200);
    const applicantToken = authVerify.data.token;

    const createReq = await httpRequest('/mission-requests', 'POST', {
      applicant_matricule: 'UK-DAF-005',
      destination: 'Conakry - Primature & Ministère du Budget',
      object_of_mission: 'Conférence annuelle de planification budgétaire',
      start_date: '2026-11-10',
      end_date: '2026-11-15',
      transport_means: 'Véhicule de service'
    }, {
      'Authorization': `Bearer ${applicantToken}`
    });

    console.log('  1.1 Demande créée :', createReq.status, 'ID:', createReq.data.id, 'RÉF:', createReq.data.reference);
    assert.strictEqual(createReq.status, 201);
    const reqId = createReq.data.id;
    const initialReference = createReq.data.reference;
    assert.ok(initialReference && initialReference.length > 5);

    console.log(`  -> Référence initiale attribuée : ${initialReference}`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 2 : Accepter la demande depuis le Secrétariat Central
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2 : Acceptation par le Secrétariat Central ---');
    const acceptRes = await httpRequest(`/mission-requests/${reqId}/accept`, 'POST', {}, {
      'Authorization': `Bearer ${scToken}`
    });
    console.log('  2.1 Demande acceptée :', acceptRes.status, acceptRes.data.message);
    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.data.status, 'DEMANDE ACCEPTÉE');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 3 : Créer l'Ordre de Mission officiel -> Même référence exacte !
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3 : Création de l’Ordre de Mission officiel ---');
    const createOM = await httpRequest('/missions', 'POST', {
      linked_request_id: reqId,
      missionary_name: 'CAMARA',
      missionary_firstnames: 'Ousmane',
      nationality: 'Guinéenne',
      function_title: 'Directeur Administratif et Financier',
      destination: 'Conakry - Primature & Ministère du Budget',
      object_of_mission: 'Conférence annuelle de planification budgétaire',
      transport_mode: 'Véhicule de service',
      departure_date: '2026-11-10',
      return_date: '2026-11-15',
      driver_option: 'SELF',
      observations: 'Mission officielle prioritaire'
    }, {
      'Authorization': `Bearer ${scToken}`
    });

    console.log('  3.1 Création OM :', createOM.status, 'ID:', createOM.data.id, 'RÉF:', createOM.data.reference);
    assert.strictEqual(createOM.status, 201);
    const officialDocId = createOM.data.id;
    const officialOmRef = createOM.data.reference;

    console.log(`  3.2 COMPARAISON DES RÉFÉRENCES :`);
    console.log(`      • Référence Demande initiale : ${initialReference}`);
    console.log(`      • Référence Ordre officiel   : ${officialOmRef}`);
    assert.strictEqual(officialOmRef, initialReference, 'La référence de l’ordre de mission officiel doit être STRICTEMENT IDENTIQUE à celle de la demande !');

    // Check in database
    const docInDb = await db.get('SELECT reference FROM documents WHERE id = ?', [officialDocId]);
    const reqInDb = await db.get('SELECT reference, official_document_id FROM mission_order_requests WHERE id = ?', [reqId]);
    const moInDb = await db.get('SELECT request_id FROM mission_orders WHERE document_id = ?', [officialDocId]);

    console.log('  3.3 Vérification DB :');
    console.log(`      • documents.reference               = ${docInDb.reference}`);
    console.log(`      • mission_order_requests.reference  = ${reqInDb.reference}`);
    console.log(`      • mission_order_requests.doc_id     = ${reqInDb.official_document_id}`);
    console.log(`      • mission_orders.request_id         = ${moInDb.request_id}`);

    assert.strictEqual(docInDb.reference, initialReference);
    assert.strictEqual(reqInDb.reference, initialReference);
    assert.strictEqual(reqInDb.official_document_id, officialDocId);
    assert.strictEqual(moInDb.request_id, reqId);
    console.log('  -> TEST 3 RÉUSSI : Réf unique et immuable conservée dans toute la base de données !');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 4 : Transmettre au Secrétaire Général (Boîte à signer)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4 : Transmission au SG & Consultation de la boîte à signer ---');
    const sgInbox = await httpRequest('/missions/to-sign', 'GET', null, {
      'Authorization': `Bearer ${sgToken}`
    });
    assert.strictEqual(sgInbox.status, 200);
    const sgMission = (sgInbox.data || []).find(m => m.document_id === officialDocId);
    assert.ok(sgMission, 'L’OM doit être présent dans la boîte à signer du Secrétaire Général');
    console.log(`  4.1 Référence vue par le SG dans sa boîte à signer : ${sgMission.reference}`);
    assert.strictEqual(sgMission.reference, initialReference);
    console.log('  -> TEST 4 RÉUSSI : Référence identique dans l’espace du Secrétaire Général !');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 5 : Signature et Archivage -> Référence toujours identique
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5 : Signature par le SG et Archivage ---');
    const signRes = await httpRequest(`/missions/${officialDocId}/sign`, 'POST', {
      signature_code: 'Sg123!'
    }, {
      'Authorization': `Bearer ${sgToken}`
    });
    assert.strictEqual(signRes.status, 200);
    console.log('  5.1 Document signé avec succès.');

    // 5.2 Delivery to applicant
    const deliverRes = await httpRequest(`/missions/${officialDocId}/deliver`, 'POST', {
      recipient_name: 'CAMARA Ousmane (DAF)'
    }, {
      'Authorization': `Bearer ${scToken}`
    });
    console.log('  5.2 Document remis au demandeur :', deliverRes.status, deliverRes.data.message);
    assert.strictEqual(deliverRes.status, 200);

    const archiveRes = await httpRequest(`/documents/${officialDocId}/archive`, 'PUT', {}, {
      'Authorization': `Bearer ${scToken}`
    });
    console.log('  5.3 Document archivé :', archiveRes.status, archiveRes.data);
    assert.strictEqual(archiveRes.status, 200);

    const docArchived = await db.get('SELECT reference, status FROM documents WHERE id = ?', [officialDocId]);
    console.log(`  5.3 Référence aux archives : ${docArchived.reference} (Statut: ${docArchived.status})`);
    assert.strictEqual(docArchived.reference, initialReference);
    console.log('  -> TEST 5 RÉUSSI : Référence identique lors de la signature et de l’archivage !');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 6 : Tentative de création d'un deuxième OM -> Rejet immédiat 409
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6 : Protection anti-doublon et anti-nouvelle référence ---');
    const dupRes = await httpRequest('/missions', 'POST', {
      linked_request_id: reqId,
      missionary_name: 'CAMARA Ousmane',
      destination: 'Conakry',
      object_of_mission: 'Doublon frauduleux',
      departure_date: '2026-11-10',
      return_date: '2026-11-15'
    }, {
      'Authorization': `Bearer ${scToken}`
    });
    console.log('  6.1 Résultat tentative doublon :', dupRes.status, dupRes.data.error);
    assert.strictEqual(dupRes.status, 409);
    console.log('  -> TEST 6 RÉUSSI : Création de doublon bloquée avec code 409 !');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 7 : Vérification publique et QR Code par la référence unique
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7 : Vérification publique & QR Code ---');
    const verifyRes = await httpRequest(`/verify/${encodeURIComponent(initialReference)}`, 'GET');
    console.log('  7.1 Vérification publique :', verifyRes.status, 'Titre:', verifyRes.data.title, 'Statut:', verifyRes.data.current_status);
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.data.valid, true);
    assert.strictEqual(verifyRes.data.reference, initialReference);

    const trackRes = await httpRequest(`/tracking/document/${encodeURIComponent(initialReference)}`, 'GET');
    console.log('  7.2 Suivi public :', trackRes.status, 'Statut:', trackRes.data.status_label);
    assert.strictEqual(trackRes.status, 200);
    assert.strictEqual(trackRes.data.reference, initialReference);

    console.log('  -> TEST 7 RÉUSSI : La vérification et le suivi public utilisent la même référence unique !');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 8 : Création via /api/mission-requests/:id/generate-official-om
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8 : Test de référence avec la route /generate-official-om ---');
    const createReq2 = await httpRequest('/mission-requests', 'POST', {
      applicant_matricule: 'UK-DAF-005',
      destination: 'Kindia - Centre de Recherche',
      object_of_mission: 'Audit interne de gestion',
      start_date: '2026-12-01',
      end_date: '2026-12-03',
      transport_means: 'Véhicule de service'
    }, {
      'Authorization': `Bearer ${applicantToken}`
    });
    assert.strictEqual(createReq2.status, 201);
    const req2Id = createReq2.data.id;
    const req2Ref = createReq2.data.reference;

    const prepRes = await httpRequest(`/mission-requests/${req2Id}/generate-official-om`, 'POST', {}, {
      'Authorization': `Bearer ${scToken}`
    });
    console.log('  8.1 Préparation OM direct :', prepRes.status, 'Doc ID:', prepRes.data.official_document_id, 'Réf:', prepRes.data.official_reference);
    assert.strictEqual(prepRes.status, 200);

    const doc2InDb = await db.get('SELECT reference FROM documents WHERE id = ?', [prepRes.data.official_document_id]);
    console.log(`  8.2 Référence Demande 2: ${req2Ref} === Référence OM généré: ${doc2InDb.reference}`);
    assert.strictEqual(doc2InDb.reference, req2Ref);
    console.log('  -> TEST 8 RÉUSSI : Route /generate-official-om hérite aussi de la référence unique !');
    passed++;

    console.log('\n================================================================');
    console.log(` RÉSULTAT GLOBAL : ${passed}/8 TESTS PASSÉS AVEC SUCCÈS ! (100%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('❌ ÉCHEC DU TEST :', err);
    process.exit(1);
  }
}

runTests();
