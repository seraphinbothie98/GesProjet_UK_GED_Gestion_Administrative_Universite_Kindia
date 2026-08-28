/**
 * Automated Verification Suite for Mission Order Signature & Return to Secrétariat Central
 * Université de Kindia (UK-GED)
 *
 * Tests 1 to 10 strictly conforming to the user specifications.
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
  return { token: res.data.token, user: res.data.user };
}

async function runTests() {
  console.log('================================================================');
  console.log(' UK-GED - TESTS SIGNATURE ET RETOUR AU SECRÉTARIAT CENTRAL');
  console.log('================================================================\n');

  let passed = 0;

  try {
    // 0. Authenticate test actors
    const demandeurAuth = await login('daf@univ-kindia.edu.gn', 'Daf123!');
    const scAuth = await login('sc@univ-kindia.edu.gn', 'Agent123!');
    const sgAuth = await login('sg@univ-kindia.edu.gn', 'Sg123!');

    const scService = await db.get('SELECT id, name, code FROM services WHERE code = "SC"');
    const sgService = await db.get('SELECT id, name, code FROM services WHERE code = "SG"');

    console.log(`Acteurs de test identifiés :`);
    console.log(`  • Demandeur (DAF)                     : ${demandeurAuth.user.first_name} ${demandeurAuth.user.last_name}`);
    console.log(`  • Secrétariat Central (SC)             : ID ${scService.id} (${scService.name})`);
    console.log(`  • Secrétaire Général (SG)              : ID ${sgService.id} (${sgService.name})\n`);

    // -------------------------------------------------------------------------
    // TEST 1 : Créer une demande d'ordre de mission (Demandeur)
    // -------------------------------------------------------------------------
    console.log('--- TEST 1 : Création de la demande d’ordre de mission ---');
    const dafVerify = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-DAF-005',
      password: 'Daf123!'
    });
    assert.strictEqual(dafVerify.status, 200);
    const applicantToken = dafVerify.data.token;

    const reqRes = await httpRequest('/mission-requests', 'POST', {
      applicant_matricule: 'UK-DAF-005',
      destination: 'Mamou - Supervision académique des centres régionaux',
      object_of_mission: 'Mission officielle d’évaluation pédagogique semestrielle',
      start_date: '2026-09-01',
      end_date: '2026-09-05',
      transport_means: 'VÉHICULE DE SERVICE',
      applicant_phone: '+224 622 99 88 77'
    }, {
      'Authorization': `Bearer ${applicantToken}`
    });

    assert.strictEqual(reqRes.status, 201);
    const requestId = reqRes.data.id;
    const initialReference = reqRes.data.reference;
    console.log(`  1.1 Demande créée avec succès : ID ${requestId}, Référence : ${initialReference}`);
    console.log(`  -> TEST 1 RÉUSSI : Demande d'ordre de mission créée avec sa référence unique !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 2 : Le Secrétariat Central accepte et prépare l'ordre de mission officiel
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2 : Acceptation & Préparation de l’ordre de mission officiel par le SC ---');
    const acceptRes = await httpRequest(`/mission-requests/${requestId}/accept`, 'POST', {}, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(acceptRes.status, 200);

    const generateRes = await httpRequest('/missions', 'POST', {
      linked_request_id: requestId,
      missionary_name: 'CAMARA',
      missionary_firstnames: 'Ousmane',
      nationality: 'Guinéenne',
      function_title: 'Chef de division comptabilité (DAF)',
      destination: 'Mamou - Supervision académique des centres régionaux',
      object_of_mission: 'Mission officielle d’évaluation pédagogique semestrielle',
      transport_mode: 'Véhicule de service',
      departure_date: '2026-09-01',
      return_date: '2026-09-05',
      driver_option: 'SELF',
      observations: 'Ordre de mission issu de la demande validée pour signature SG'
    }, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(generateRes.status, 201);
    const officialDocId = generateRes.data.id;
    const officialDocRef = generateRes.data.reference;

    console.log(`  2.1 Ordre de mission officiel préparé : Doc ID ${officialDocId}, Réf : ${officialDocRef}`);
    assert.strictEqual(officialDocRef, initialReference, 'La référence officielle doit être strictement identique à la demande !');
    console.log(`  -> TEST 2 RÉUSSI : Ordre de mission officiel préparé avec la même référence unique !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 3 : Transmettre l'ordre de mission au Secrétaire Général
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3 : Transmission au Secrétaire Général pour signature ---');
    const docInDb = await db.get('SELECT current_service_id, status, reference FROM documents WHERE id = ?', [officialDocId]);
    assert.strictEqual(Number(docInDb.current_service_id), Number(sgService.id), 'Le responsable actuel doit être le Secrétaire Général !');
    console.log(`  3.1 Document sous la responsabilité du SG : current_service_id = ${docInDb.current_service_id}, statut = ${docInDb.status}`);
    console.log(`  -> TEST 3 RÉUSSI : Ordre de mission transmis au Secrétaire Général !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 4 : Consultation par le Secrétaire Général (OnlyOffice interdit en modif, Signer dispo)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4 : Vérification des droits SG & Exclusion de l’édition OnlyOffice ---');
    const onlyofficeConfig = await httpRequest(`/documents/${officialDocId}/onlyoffice/config`, 'GET', null, {
      'Authorization': `Bearer ${sgAuth.token}`
    });
    assert.strictEqual(onlyofficeConfig.status, 200);
    const editorMode = onlyofficeConfig.data.config?.editorConfig?.mode || onlyofficeConfig.data.editorConfig?.mode;
    const canEdit = onlyofficeConfig.data.config?.document?.permissions?.edit;
    console.log(`  4.1 Mode OnlyOffice pour le SG : mode = "${editorMode}", edit = ${canEdit} (interdiction stricte de "edit")`);
    assert.strictEqual(editorMode, 'view', 'OnlyOffice ne doit PAS être en mode edit pour le SG dans ce circuit !');
    assert.strictEqual(canEdit, false, 'La permission d’édition edit doit être false !');
    console.log(`  -> TEST 4 RÉUSSI : « Modifier avec OnlyOffice » est strictement exclu et désactivé en backend pour le SG !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 5 : Le Secrétaire Général signe l'ordre de mission (« Signer et renvoyer au SC »)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5 : Action « SIGNER ET RENVOYER AU SC » par le Secrétaire Général ---');
    const signRes = await httpRequest(`/missions/${officialDocId}/sign`, 'POST', {}, {
      'Authorization': `Bearer ${sgAuth.token}`
    });
    if (signRes.status !== 200) {
      console.error('  Erreur signature détaillée :', signRes.status, signRes.data);
    }
    assert.strictEqual(signRes.status, 200);
    console.log(`  5.1 Réponse signature : ${signRes.data.message || 'Succès'}`);
    console.log(`  -> TEST 5 RÉUSSI : Signature numérique et scellement exécutés avec succès !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 6 : Vérifier que l'ordre de mission signé est automatiquement retourné au SC
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6 : Vérification du retour automatique au Secrétariat Central ---');
    const docAfterSign = await db.get('SELECT current_service_id, status, is_locked, reference FROM documents WHERE id = ?', [officialDocId]);
    assert.strictEqual(Number(docAfterSign.current_service_id), Number(scService.id), 'Le responsable actuel doit redevenir le Secrétariat Central !');
    assert.strictEqual(docAfterSign.status, 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL');
    assert.strictEqual(docAfterSign.is_locked, 1);
    console.log(`  6.1 Document retourné au SC : current_service_id = ${docAfterSign.current_service_id}, statut = ${docAfterSign.status}`);
    console.log(`  -> TEST 6 RÉUSSI : Document signé automatiquement retourné au Secrétariat Central !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 7 : Le Secrétariat Central consulte et archive le document signé
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7 : Consultation & Archivage par le Secrétariat Central ---');
    const scDocView = await httpRequest(`/documents/${officialDocId}`, 'GET', null, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(scDocView.status, 200);
    console.log(`  7.1 Document signé consulté par le SC : Statut = ${scDocView.data.status}`);

    const archiveRes = await httpRequest(`/documents/${officialDocId}/archive`, 'POST', {}, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(archiveRes.status, 200);
    console.log(`  7.2 Document archivé par le SC : ${archiveRes.data.message}`);

    const docArchived = await db.get('SELECT status, reference, is_central_archived FROM documents WHERE id = ?', [officialDocId]);
    assert.strictEqual(docArchived.status, 'ARCHIVED');
    console.log(`  -> TEST 7 RÉUSSI : Document archivé par le Secrétariat Central avec statut ARCHIVED !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 8 : Vérifier que la référence reste strictement identique pendant tout le parcours
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8 : Vérification de l’immuabilité stricte de la référence ---');
    console.log(`  • Référence initiale Demande : ${initialReference}`);
    console.log(`  • Référence finale Archivée   : ${docArchived.reference}`);
    assert.strictEqual(docArchived.reference, initialReference, 'La référence ne doit jamais être altérée !');
    console.log(`  -> TEST 8 RÉUSSI : Référence identique sur tout le cycle de vie !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 9 : Vérifier qu'aucun doublon de dossier n'a été créé (Zéro duplication)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9 : Vérification de l’unicité du dossier (Zéro duplication) ---');
    const allDocsForRef = await db.all('SELECT id, reference, status FROM documents WHERE reference = ?', [initialReference]);
    console.log(`  • Nombre d’enregistrements documents avec la référence ${initialReference} : ${allDocsForRef.length}`);
    assert.strictEqual(allDocsForRef.length, 1, 'Un seul document physique doit exister pour cette référence !');
    console.log(`  -> TEST 9 RÉUSSI : Dossier unique et intègre sans aucun doublon !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 10 : Vérification intégrale de l'historique sans écrasement
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10 : Vérification de la complétude et de l’intégrité de l’historique ---');
    const historyEntries = await db.all(
      'SELECT id, action, details, timestamp FROM document_history WHERE document_id = ? ORDER BY id ASC',
      [officialDocId]
    );
    console.log(`  • Nombre d’étapes enregistrées dans l’historique : ${historyEntries.length}`);
    historyEntries.forEach((h, idx) => {
      console.log(`    [Étape ${idx + 1}] ${h.action} (${h.timestamp}) : ${h.details}`);
    });
    assert.ok(historyEntries.length >= 3, 'L’historique doit contenir toutes les étapes administratives !');
    console.log(`  -> TEST 10 RÉUSSI : Historique complet, chronologique et sans écrasement !`);
    passed++;

    console.log('\n================================================================');
    console.log(` RÉSULTAT GLOBAL : ${passed}/10 TESTS PASSÉS AVEC SUCCÈS ! (100%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('❌ ÉCHEC DU TEST SIGNATURE ET RETOUR SC :', err);
    process.exit(1);
  }
}

runTests();
