/**
 * Automated Verification Script for Universal Mission Request Access Control
 * Université de Kindia (UK-GED)
 *
 * Scenarios tested:
 * TEST 1: Chef de service with UK-GED account -> access granted & request attached.
 * TEST 2: Driver (Chauffeur) with valid matricule without UK-GED account -> access granted & request attached.
 * TEST 3: Security agent (Agent de sécurité) with valid matricule without UK-GED account -> access granted & request attached.
 * TEST 4: Non-existent matricule or inactive worker -> access blocked & no mission request created + claim flow tested.
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

async function runTests() {
  console.log('================================================================');
  console.log(' UK-GED - TESTS DU CONTRÔLE D’ACCÈS UNIVERSEL AUX MISSIONS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Chef de service avec compte UK-GED
    // -------------------------------------------------------------------------
    console.log('--- TEST 1 : Chef de service avec compte UK-GED (UK-DAF-005) ---');
    
    // 1.1 Step: Verify matricule without password -> asks for password
    const t1_step1 = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-DAF-005'
    });
    console.log('  1.1 Vérification matricule sans mot de passe :', t1_step1.status, t1_step1.data.code || (t1_step1.data.requires_password ? 'REQUIRES_PASSWORD (OK)' : ''));
    assert.strictEqual(t1_step1.status, 200);
    assert.strictEqual(t1_step1.data.has_account, true);
    assert.strictEqual(t1_step1.data.requires_password, true);

    // 1.2 Step: Verify with wrong password -> 401
    const t1_step2 = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-DAF-005',
      password: 'WrongPassword999!'
    });
    console.log('  1.2 Vérification avec mauvais mot de passe :', t1_step2.status, t1_step2.data.code);
    assert.strictEqual(t1_step2.status, 401);
    assert.strictEqual(t1_step2.data.code, 'INVALID_PASSWORD');

    // 1.3 Step: Verify with correct password -> authenticated JWT
    const t1_step3 = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-DAF-005',
      password: 'Daf123!'
    });
    console.log('  1.3 Authentification réussie :', t1_step3.status, t1_step3.data.identification_mode);
    assert.strictEqual(t1_step3.status, 200);
    assert.strictEqual(t1_step3.data.authenticated, true);
    assert.strictEqual(t1_step3.data.identification_mode, 'UK_GED_ACCOUNT');
    assert.ok(t1_step3.data.token);

    const dafToken = t1_step3.data.token;

    // 1.4 Step: Create mission request using authenticated token
    const t1_step4 = await httpRequest('/mission-requests', 'POST', {
      applicant_matricule: 'UK-DAF-005',
      destination: 'Conakry - Ministère du Budget',
      object_of_mission: 'Validation du budget trimestriel de l’Université',
      start_date: '2026-09-01',
      end_date: '2026-09-05',
      transport_means: 'VÉHICULE OFFICIEL',
      applicant_phone: '+224 622 55 66 77'
    }, {
      'Authorization': `Bearer ${dafToken}`
    });
    console.log('  1.4 Création de la demande d’ordre de mission :', t1_step4.status, t1_step4.data.reference);
    assert.strictEqual(t1_step4.status, 201);
    assert.ok(t1_step4.data.reference && t1_step4.data.reference.length > 3);

    // Check DB record
    const t1_db = await db.get('SELECT * FROM mission_order_requests WHERE reference = ?', [t1_step4.data.reference]);
    assert.strictEqual(t1_db.identification_mode, 'UK_GED_ACCOUNT');
    assert.strictEqual(t1_db.user_id, 5);
    assert.strictEqual(t1_db.applicant_matricule, 'UK-DAF-005');
    console.log('  -> TEST 1 RÉUSSI : Chef de service authentifié et rattaché avec succès !\n');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 2: Chauffeur avec matricule valide sans compte UK-GED
    // -------------------------------------------------------------------------
    console.log('--- TEST 2 : Chauffeur sans compte UK-GED (UK-CHAUFF-001) ---');
    
    const t2_step1 = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-CHAUFF-001'
    });
    console.log('  2.1 Vérification matricule Chauffeur :', t2_step1.status, t2_step1.data.worker ? `${t2_step1.data.worker.first_name} ${t2_step1.data.worker.last_name} (${t2_step1.data.worker.function_title})` : '');
    assert.strictEqual(t2_step1.status, 200);
    assert.strictEqual(t2_step1.data.has_account, false);
    assert.strictEqual(t2_step1.data.authenticated, true);
    assert.strictEqual(t2_step1.data.requires_password, false);
    assert.strictEqual(t2_step1.data.identification_mode, 'STAFF_MATRICULE');
    assert.strictEqual(t2_step1.data.worker.is_driver, 1);
    assert.ok(t2_step1.data.verification_token);

    const chauffeurToken = t2_step1.data.verification_token;

    // 2.2 Step: Submit mission request with verification_token
    const t2_step2 = await httpRequest('/mission-requests/public', 'POST', {
      verification_token: chauffeurToken,
      applicant_matricule: 'UK-CHAUFF-001',
      destination: 'Mamou',
      object_of_mission: 'Transport officiel de la mission d’inspection rectorale',
      start_date: '2026-09-10',
      end_date: '2026-09-12',
      transport_means: 'VÉHICULE OFFICIEL',
      applicant_phone: '+224 622 11 22 33'
    });
    console.log('  2.2 Soumission demande Chauffeur :', t2_step2.status, t2_step2.data.reference);
    assert.strictEqual(t2_step2.status, 201);
    assert.ok(t2_step2.data.reference && t2_step2.data.reference.length > 3);

    const t2_db = await db.get('SELECT * FROM mission_order_requests WHERE reference = ?', [t2_step2.data.reference]);
    assert.strictEqual(t2_db.identification_mode, 'STAFF_MATRICULE');
    assert.strictEqual(t2_db.user_id, null);
    assert.strictEqual(t2_db.applicant_last_name, 'CAMARA');
    assert.strictEqual(t2_db.applicant_first_names, 'Mamadouba');
    assert.strictEqual(t2_db.applicant_function, 'Chauffeur de l’Université');
    console.log('  -> TEST 2 RÉUSSI : Chauffeur identifié sans compte et demande correctement rattachée !\n');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 3: Agent de sécurité avec matricule valide sans compte UK-GED
    // -------------------------------------------------------------------------
    console.log('--- TEST 3 : Agent de sécurité sans compte UK-GED (UK-SEC-001) ---');

    const t3_step1 = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-SEC-001'
    });
    console.log('  3.1 Vérification matricule Sécurité :', t3_step1.status, t3_step1.data.worker ? `${t3_step1.data.worker.first_name} ${t3_step1.data.worker.last_name} (${t3_step1.data.worker.function_title})` : '');
    assert.strictEqual(t3_step1.status, 200);
    assert.strictEqual(t3_step1.data.has_account, false);
    assert.strictEqual(t3_step1.data.identification_mode, 'STAFF_MATRICULE');
    assert.strictEqual(t3_step1.data.worker.last_name, 'BANGOURA');

    const secToken = t3_step1.data.verification_token;

    const t3_step2 = await httpRequest('/mission-requests/public', 'POST', {
      verification_token: secToken,
      applicant_matricule: 'UK-SEC-001',
      destination: 'Conakry - Ambassade',
      object_of_mission: 'Escorte et sécurisation de documents confidentiels',
      start_date: '2026-09-15',
      end_date: '2026-09-16',
      transport_means: 'VÉHICULE OFFICIEL',
      applicant_phone: '+224 620 44 55 66'
    });
    console.log('  3.2 Soumission demande Agent de sécurité :', t3_step2.status, t3_step2.data.reference);
    assert.strictEqual(t3_step2.status, 201);
    
    const t3_db = await db.get('SELECT * FROM mission_order_requests WHERE reference = ?', [t3_step2.data.reference]);
    assert.strictEqual(t3_db.identification_mode, 'STAFF_MATRICULE');
    assert.strictEqual(t3_db.user_id, null);
    assert.strictEqual(t3_db.applicant_last_name, 'BANGOURA');
    assert.strictEqual(t3_db.applicant_first_names, 'Sekou');
    assert.strictEqual(t3_db.applicant_function, 'Agent de Sécurité et Gardiennage');
    console.log('  -> TEST 3 RÉUSSI : Agent de sécurité identifié et demande correctement rattachée !\n');
    passed++;

    // -------------------------------------------------------------------------
    // TEST 4: Matricule Inexistant ou Travailleur Inactif
    // -------------------------------------------------------------------------
    console.log('--- TEST 4 : Personne non reconnue ou travailleur inactif ---');

    // 4.1 Non-existent matricule check
    const t4_unknown = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-INVALIDE-999'
    });
    console.log('  4.1 Vérification matricule non reconnu :', t4_unknown.status, t4_unknown.data.code);
    assert.strictEqual(t4_unknown.status, 404);
    assert.strictEqual(t4_unknown.data.code, 'MATRICULE_NOT_FOUND');

    // 4.2 Attempt to submit public request with non-existent matricule -> blocked
    const t4_fakeSubmit = await httpRequest('/mission-requests/public', 'POST', {
      applicant_matricule: 'UK-INVALIDE-999',
      destination: 'Faux Lieu',
      object_of_mission: 'Demande non autorisée',
      start_date: '2026-09-20',
      end_date: '2026-09-22',
      applicant_phone: '+224 600 00 00 00'
    });
    console.log('  4.2 Tentative soumission matricule inconnu :', t4_fakeSubmit.status, t4_fakeSubmit.data.error);
    assert.strictEqual(t4_fakeSubmit.status, 403);

    // Verify NO mission request was created in DB for this fake matricule
    const fakeCount = await db.get('SELECT count(*) as c FROM mission_order_requests WHERE applicant_matricule = "UK-INVALIDE-999"');
    assert.strictEqual(fakeCount.c, 0);

    // 4.3 Inactive worker check
    await db.run("INSERT OR REPLACE INTO staff (matricule, nom, prenoms, fonction, status) VALUES ('UK-INACTIF-001', 'Test', 'Inactif', 'Agent', 'INACTIF')");
    const t4_inactive = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-INACTIF-001'
    });
    console.log('  4.3 Vérification travailleur inactif :', t4_inactive.status, t4_inactive.data.code);
    assert.strictEqual(t4_inactive.status, 403);
    assert.strictEqual(t4_inactive.data.code, 'WORKER_INACTIVE');

    // 4.4 Option: "Demander la vérification de mon matricule" (Signalement RH/SC)
    const t4_claim = await httpRequest('/mission-requests/claim-matricule', 'POST', {
      matricule: 'UK-INVALIDE-999',
      last_name: 'INCONNU',
      first_names: 'Jean',
      function_title: 'Nouveau Travailleur',
      service_name: 'Patrimoine',
      phone: '+224 629 99 88 77',
      notes: 'Je viens d’être recruté et mon matricule n’est pas encore dans l’application.'
    });
    console.log('  4.4 Signalement de matricule non reconnu :', t4_claim.status, t4_claim.data.success);
    assert.strictEqual(t4_claim.status, 201);
    assert.strictEqual(t4_claim.data.success, true);

    const claimDb = await db.get('SELECT * FROM matricule_verification_claims WHERE matricule = "UK-INVALIDE-999"');
    assert.ok(claimDb);
    assert.strictEqual(claimDb.status, 'PENDING');

    console.log('  -> TEST 4 RÉUSSI : Blocage strict des personnes non reconnues/inactives et signalement enregistré !\n');
    passed++;

    console.log('================================================================');
    console.log(` RÉSULTAT GLOBAL : ${passed}/4 TESTS PASSÉS AVEC SUCCÈS ! (100%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('❌ ÉCHEC DU TEST :', err);
    process.exit(1);
  }
}

runTests();
