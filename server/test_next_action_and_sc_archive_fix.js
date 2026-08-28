/**
 * Verification test for:
 * 1. Prochaine action = "Prêt pour l'archivage" for signed mission orders returned to SC
 * 2. Ability for Secrétariat Central to directly archive via [ARCHIVER AUX ARCHIVES CENTRALES]
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

async function runTest() {
  console.log('================================================================');
  console.log(' UK-GED - TEST DE LA PROCHAINE ACTION ET ARCHIVAGE PAR LE SC');
  console.log('================================================================\n');

  try {
    const dafAuth = await login('daf@univ-kindia.edu.gn', 'Daf123!');
    const scAuth = await login('sc@univ-kindia.edu.gn', 'Agent123!');
    const sgAuth = await login('sg@univ-kindia.edu.gn', 'Sg123!');

    // 1. Demandeur creates mission request
    const dafVerify = await httpRequest('/mission-requests/verify-applicant', 'POST', {
      matricule: 'UK-DAF-005',
      password: 'Daf123!'
    });
    const applicantToken = dafVerify.data.token;

    const reqRes = await httpRequest('/mission-requests', 'POST', {
      applicant_matricule: 'UK-DAF-005',
      destination: 'Labé - Mission de contrôle',
      object_of_mission: 'Supervision des examens',
      start_date: '2026-09-10',
      end_date: '2026-09-15',
      transport_means: 'VÉHICULE DE SERVICE',
      applicant_phone: '+224 622 99 88 77'
    }, {
      'Authorization': `Bearer ${applicantToken}`
    });
    assert.strictEqual(reqRes.status, 201);
    const requestId = reqRes.data.id;
    const ref = reqRes.data.reference;
    console.log(`  1. Demande d’OM créée : ID ${requestId}, Réf: ${ref}`);

    // 2. SC accepts & prepares official mission order
    await httpRequest(`/mission-requests/${requestId}/accept`, 'POST', {}, {
      'Authorization': `Bearer ${scAuth.token}`
    });

    const createOM = await httpRequest('/missions', 'POST', {
      linked_request_id: requestId,
      missionary_name: 'KOUROUMA',
      missionary_firstnames: 'Dr Sidiki',
      nationality: 'Guinéenne',
      function_title: 'Enseignant-Chercheur',
      destination: 'Labé - Mission de contrôle',
      object_of_mission: 'Supervision des examens',
      transport_mode: 'Véhicule de service',
      departure_date: '2026-09-10',
      return_date: '2026-09-15',
      driver_option: 'SELF',
      observations: 'Ordre officiel pour signature'
    }, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(createOM.status, 201);
    const docId = createOM.data.id;
    console.log(`  2. Ordre de mission officiel établi : Doc ID ${docId}, Réf: ${ref}`);

    // 3. SG signs and auto-returns to SC
    const signRes = await httpRequest(`/missions/${docId}/sign`, 'POST', {}, {
      'Authorization': `Bearer ${sgAuth.token}`
    });
    assert.strictEqual(signRes.status, 200);
    console.log(`  3. SG a signé et renvoyé au SC : Statut = SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL`);

    // 4. Check dashboard list: Column PROCHAINE ACTION must be "Prêt pour l'archivage"
    const dashRes = await httpRequest('/reports/dashboard', 'GET', null, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(dashRes.status, 200);

    const docInDash = (dashRes.data.recent_activity || []).find(d => d.id === docId || d.reference === ref);
    console.log(`  4. Dashboard pour le SC :`);
    console.log(`     • Document Réf       : ${docInDash?.reference}`);
    console.log(`     • Statut             : ${docInDash?.status}`);
    console.log(`     • Prochaine Action   : "${docInDash?.next_action}"`);

    assert.strictEqual(
      docInDash?.next_action, 
      "Prêt pour l'archivage", 
      `La colonne Prochaine Action doit être "Prêt pour l'archivage", reçu: "${docInDash?.next_action}"`
    );
    console.log(`  -> SUCCÈS : La colonne Prochaine Action affiche bien "Prêt pour l'archivage" !`);

    // 5. SC Agent clicks [ARCHIVER AUX ARCHIVES CENTRALES] (calls PUT /documents/:id/archive)
    const archiveRes = await httpRequest(`/documents/${docId}/archive`, 'PUT', {}, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    console.log(`  5. Résultat archivage SC (PUT /documents/:id/archive) :`, archiveRes.status, archiveRes.data.message);
    assert.strictEqual(archiveRes.status, 200);

    const docArchived = await db.get('SELECT status, reference, is_locked FROM documents WHERE id = ?', [docId]);
    assert.strictEqual(docArchived.status, 'ARCHIVED');
    console.log(`  -> SUCCÈS : L'agent du Secrétariat Central a archivé avec succès le document signé !`);

    console.log('\n================================================================');
    console.log(' TOUS LES TESTS SONT VALIDÉS AVEC SUCCÈS (100%) !');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ ÉCHEC DU TEST :', err);
    process.exit(1);
  }
}

runTest();
