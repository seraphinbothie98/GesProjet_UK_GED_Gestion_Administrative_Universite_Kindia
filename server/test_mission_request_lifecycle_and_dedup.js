/**
 * Automated Verification Script for Mission Request Lifecycle, Dashboard Sync & Anti-Duplicate
 * Université de Kindia (UK-GED)
 *
 * Scenarios tested:
 * Cas 1 : Créer une demande d'ordre de mission -> elle apparaît dans les demandes reçues et dans les dossiers actifs.
 * Cas 2 : Le Secrétariat Central accepte la demande -> elle disparaît immédiatement des dossiers actifs du SC.
 * Cas 3 : La demande passe à « Demande acceptée » / OM créé -> elle disparaît de « Derniers Documents & Orientations » pour le SC.
 * Cas 4 : La demande est traitée / OM créé -> le bouton « Créer l’ordre de mission » ne doit plus être disponible.
 * Cas 5 : Un ordre de mission existe déjà -> toute tentative de création d'un deuxième OM à partir de la même demande est bloquée (409).
 * Cas 6 : L'OM est transmis au Secrétaire Général -> il apparaît dans l'espace de travail / boîte à signer du SG.
 * Cas 7 : Vérifier que le workflow complet fonctionne sans doublon et que l'historique et les données sont intégralement conservés.
 */

const assert = require('assert');
const path = require('path');
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
  console.log(' UK-GED - TESTS DU CYCLE DE VIE DES DEMANDES D’OM & ANTI-DOUBLON');
  console.log('================================================================\n');

  let passed = 0;

  try {
    // 0. Auth tokens
    const scToken = await login('sc@univ-kindia.edu.gn', 'Agent123!');
    const sgToken = await login('sg@univ-kindia.edu.gn', 'Sg123!');
    const dafToken = await login('daf@univ-kindia.edu.gn', 'Daf123!');

    // -------------------------------------------------------------------------
    // CAS 1 : Créer une demande d'ordre de mission
    // -------------------------------------------------------------------------
    console.log('--- CAS 1 : Création de la demande d’ordre de mission ---');
    const dafVerify = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-DAF-005',
      password: 'Daf123!'
    });
    assert.strictEqual(dafVerify.status, 200);
    const applicantToken = dafVerify.data.token;

    const createReq = await httpRequest('/mission-requests', 'POST', {
      applicant_matricule: 'UK-DAF-005',
      destination: 'Conakry - Ministère Enseignement Supérieur',
      object_of_mission: 'Session de cadrage budgétaire 2026',
      start_date: '2026-10-01',
      end_date: '2026-10-05',
      transport_means: 'VÉHICULE DE SERVICE',
      applicant_phone: '+224 622 99 88 77'
    }, {
      'Authorization': `Bearer ${applicantToken}`
    });

    console.log('  1.1 Création demande :', createReq.status, createReq.data.reference, 'ID:', createReq.data.id);
    assert.strictEqual(createReq.status, 201);
    const reqId = createReq.data.id;
    const reqRef = createReq.data.reference;

    // Check dashboard SC before acceptance -> must appear in active dossiers
    const scDash1 = await httpRequest('/reports/dashboard', 'GET', null, {
      'Authorization': `Bearer ${scToken}`
    });
    assert.strictEqual(scDash1.status, 200);
    const foundInDash1 = (scDash1.data.recent_activity || []).some(item => item.reference === reqRef);
    console.log('  1.2 Présence dans "Derniers Documents & Orientations" (SC) :', foundInDash1 ? 'OUI (OK)' : 'NON');
    assert.strictEqual(foundInDash1, true);
    console.log('  -> CAS 1 RÉUSSI : La nouvelle demande apparaît dans les dossiers actifs du SC !\n');
    passed++;

    // -------------------------------------------------------------------------
    // CAS 2 : Le Secrétariat Central accepte la demande
    // -------------------------------------------------------------------------
    console.log('--- CAS 2 : Acceptation de la demande par le Secrétariat Central ---');
    const acceptRes = await httpRequest(`/mission-requests/${reqId}/accept`, 'POST', {}, {
      'Authorization': `Bearer ${scToken}`
    });
    console.log('  2.1 Acceptation demande :', acceptRes.status, acceptRes.data.message);
    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.data.status, 'DEMANDE ACCEPTÉE');

    // Check dashboard SC after acceptance -> must disappear immediately from SC active dossiers
    const scDash2 = await httpRequest('/reports/dashboard', 'GET', null, {
      'Authorization': `Bearer ${scToken}`
    });
    const foundInDash2 = (scDash2.data.recent_activity || []).some(item => item.reference === reqRef);
    console.log('  2.2 Présence dans "Derniers Documents & Orientations" après acceptation :', foundInDash2 ? 'ENCORE VISIBLE (ERREUR)' : 'DISPARU (OK)');
    assert.strictEqual(foundInDash2, false);
    console.log('  -> CAS 2 RÉUSSI : La demande acceptée a disparu immédiatement des dossiers actifs du SC !\n');
    passed++;

    // -------------------------------------------------------------------------
    // CAS 3 & 4 : Transformation en OM officiel & disparition du bouton créer
    // -------------------------------------------------------------------------
    console.log('--- CAS 3 & 4 : Établissement de l’Ordre de Mission Officiel & Rapprochement ---');
    const createOM = await httpRequest('/missions', 'POST', {
      linked_request_id: reqId,
      missionary_name: 'CAMARA',
      missionary_firstnames: 'Ousmane',
      nationality: 'Guinéenne',
      function_title: 'Directeur Administratif et Financier (DAF)',
      destination: 'Conakry - Ministère Enseignement Supérieur',
      object_of_mission: 'Session de cadrage budgétaire 2026',
      transport_mode: 'Véhicule de service',
      departure_date: '2026-10-01',
      return_date: '2026-10-05',
      driver_option: 'SELF',
      observations: 'Ordre de mission issu de la demande validée'
    }, {
      'Authorization': `Bearer ${scToken}`
    });

    console.log('  3.1 Création OM officiel :', createOM.status, 'Réf OM:', createOM.data.reference, 'Doc ID:', createOM.data.id);
    assert.strictEqual(createOM.status, 201);
    const docId = createOM.data.id;
    const omRef = createOM.data.reference;

    // Verify in DB that request is linked with docId and status updated
    const reqDb = await db.get('SELECT * FROM mission_order_requests WHERE id = ?', [reqId]);
    console.log('  3.2 Liaison DB vérifiée :', 'official_document_id =', reqDb.official_document_id, 'statut =', reqDb.status);
    assert.strictEqual(reqDb.official_document_id, docId);
    assert.strictEqual(reqDb.status, 'EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL');

    // Check active requests endpoint: with view=active, this request must NOT appear anymore
    const activeReqs = await httpRequest('/mission-requests?view=active', 'GET', null, {
      'Authorization': `Bearer ${scToken}`
    });
    const inActiveList = (activeReqs.data || []).some(r => r.id === reqId);
    console.log('  4.1 Présence dans les demandes à traiter (view=active) :', inActiveList ? 'OUI (ERREUR)' : 'NON (SORTIE OK)');
    assert.strictEqual(inActiveList, false);

    console.log('  -> CAS 3 & 4 RÉUSSIS : OM officiel généré et demande retirée des tâches en attente !\n');
    passed++;

    // -------------------------------------------------------------------------
    // CAS 5 : Blocage strict de toute tentative de création d'un doublon
    // -------------------------------------------------------------------------
    console.log('--- CAS 5 : Tentative de création d’un doublon d’ordre de mission ---');
    
    // Attempt 1 via /api/missions with same linked_request_id
    const duplicateAttempt1 = await httpRequest('/missions', 'POST', {
      linked_request_id: reqId,
      missionary_name: 'CAMARA Ousmane',
      destination: 'Conakry',
      object_of_mission: 'Doublon frauduleux',
      departure_date: '2026-10-01',
      return_date: '2026-10-05'
    }, {
      'Authorization': `Bearer ${scToken}`
    });
    console.log('  5.1 Tentative création doublon via /missions :', duplicateAttempt1.status, duplicateAttempt1.data.error);
    assert.strictEqual(duplicateAttempt1.status, 409);

    // Attempt 2 via /api/mission-requests/:id/generate-official-om
    const duplicateAttempt2 = await httpRequest(`/mission-requests/${reqId}/generate-official-om`, 'POST', {}, {
      'Authorization': `Bearer ${scToken}`
    });
    console.log('  5.2 Tentative création doublon via /generate-official-om :', duplicateAttempt2.status, duplicateAttempt2.data.error);
    assert.strictEqual(duplicateAttempt2.status, 409);

    console.log('  -> CAS 5 RÉUSSI : Toute tentative de création de doublon est strictement bloquée (409 Conflict) !\n');
    passed++;

    // -------------------------------------------------------------------------
    // CAS 6 : Transmission au SG & Présence dans la boîte à signer du SG
    // -------------------------------------------------------------------------
    console.log('--- CAS 6 : Présence dans la boîte à signer du Secrétaire Général ---');
    const sgToSign = await httpRequest('/missions/to-sign', 'GET', null, {
      'Authorization': `Bearer ${sgToken}`
    });
    assert.strictEqual(sgToSign.status, 200);
    const inSgBox = (sgToSign.data || []).some(m => m.document_id === docId || m.reference === omRef);
    console.log('  6.1 Présence dans la boîte à signer du SG (/missions/to-sign) :', inSgBox ? 'OUI (OK)' : 'NON (ERREUR)');
    assert.strictEqual(inSgBox, true);

    const sgDash = await httpRequest('/reports/dashboard', 'GET', null, {
      'Authorization': `Bearer ${sgToken}`
    });
    console.log('  6.2 Indicateur missions_to_sign du SG :', sgDash.data.sg ? sgDash.data.sg.missions_to_sign : 0);
    assert.ok(sgDash.data.sg && sgDash.data.sg.missions_to_sign >= 1);

    console.log('  -> CAS 6 RÉUSSI : L’ordre de mission est présent dans l’espace de travail du Secrétaire Général !\n');
    passed++;

    // -------------------------------------------------------------------------
    // CAS 7 : Traçabilité & Historique complets sans suppression de données
    // -------------------------------------------------------------------------
    console.log('--- CAS 7 : Vérification de la traçabilité intégrale et conservation des données ---');
    
    // Check request detail
    const reqDetail = await httpRequest(`/mission-requests/${reqId}`, 'GET', null, {
      'Authorization': `Bearer ${scToken}`
    });
    assert.strictEqual(reqDetail.status, 200);
    assert.strictEqual(reqDetail.data.id, reqId);
    assert.strictEqual(reqDetail.data.official_document_id, docId);
    assert.ok(reqDetail.data.history && reqDetail.data.history.length >= 3);
    console.log('  7.1 Nombre d’événements d’historique enregistrés :', reqDetail.data.history.length);
    reqDetail.data.history.forEach((h, i) => {
      console.log(`      [Étape ${i+1}] ${h.action} (${h.previous_status || 'INIT'} -> ${h.new_status}) : ${h.observation}`);
    });

    console.log('  -> CAS 7 RÉUSSI : Traçabilité et historique conservés sans aucune suppression de données !\n');
    passed++;

    console.log('================================================================');
    console.log(` RÉSULTAT GLOBAL : ${passed}/6 CAS DE TESTS PASSÉS AVEC SUCCÈS ! (100%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('❌ ÉCHEC DU TEST :', err);
    process.exit(1);
  }
}

runTests();
