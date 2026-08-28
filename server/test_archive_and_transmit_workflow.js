/**
 * Automated Verification Suite for « ARCHIVER ET TRANSMETTRE » Workflow
 * Université de Kindia (UK-GED)
 *
 * Tests 1 to 10 strictly conforming to the user specifications (Section 17).
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
  console.log(' UK-GED - TESTS DU WORKFLOW « ARCHIVER ET TRANSMETTRE »');
  console.log('================================================================\n');

  let passed = 0;

  try {
    // 0. Authenticate test actors across services
    const scAuth = await login('sc@univ-kindia.edu.gn', 'Agent123!');
    const sgAuth = await login('sg@univ-kindia.edu.gn', 'Sg123!');
    const dafAuth = await login('daf@univ-kindia.edu.gn', 'Daf123!');
    const cfAuth = await login('cf@univ-kindia.edu.gn', 'Cf123!');

    const scService = await db.get('SELECT id, name, code FROM services WHERE code = "SC"');
    const sgService = await db.get('SELECT id, name, code FROM services WHERE code = "SG"');
    const dafService = await db.get('SELECT id, name, code FROM services WHERE code = "DAF"');
    const cfService = await db.get('SELECT id, name, code FROM services WHERE code = "CF"');

    console.log(`Acteurs de test identifiés :`);
    console.log(`  • Secrétariat Central (SC)             : ID ${scService.id}`);
    console.log(`  • Secrétaire Général (SG)              : ID ${sgService.id}`);
    console.log(`  • Service A (DAF - Affaires Financières): ID ${dafService.id}`);
    console.log(`  • Service B (CF - Contrôle Financier)   : ID ${cfService.id}\n`);

    // -------------------------------------------------------------------------
    // TEST 1 : Secrétariat Central enregistre un courrier -> Transmission automatique au SG
    // -------------------------------------------------------------------------
    console.log('--- TEST 1 : Enregistrement SC & Transmission Automatique au SG ---');
    const doc1Res = await httpRequest('/documents/incoming', 'POST', {
      title: 'Convention tripartite de formation doctorale 2026',
      description: 'Dossier de coopération académique',
      sender_name: 'Recteur UGANC',
      sender_organization: 'Université Gamal Abdel Nasser de Conakry',
      priority: 'HIGH'
    }, {
      'Authorization': `Bearer ${scAuth.token}`
    });

    assert.strictEqual(doc1Res.status, 201);
    const doc1Id = doc1Res.data.id;
    const doc1Ref = doc1Res.data.reference;
    console.log(`  1.1 Courrier enregistré avec succès : ID ${doc1Id}, Réf: ${doc1Ref}`);

    const doc1InDb = await db.get('SELECT current_service_id, status, reference FROM documents WHERE id = ?', [doc1Id]);
    assert.strictEqual(Number(doc1InDb.current_service_id), Number(sgService.id), 'Le responsable actuel doit être automatiquement le SG !');
    assert.strictEqual(doc1InDb.status, 'TRANSMIS', 'Le statut initial doit être TRANSMIS vers le SG !');
    console.log(`  -> TEST 1 RÉUSSI : Courrier Réf ${doc1Ref} automatiquement transmis au SG (responsable = SG) !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 2 : Secrétaire Général reçoit le courrier dans son compte
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2 : Réception du courrier dans le compte du Secrétaire Général ---');
    const sgDocView = await httpRequest(`/documents/${doc1Id}`, 'GET', null, {
      'Authorization': `Bearer ${sgAuth.token}`
    });
    assert.strictEqual(sgDocView.status, 200);
    assert.strictEqual(Number(sgDocView.data.current_service_id), Number(sgService.id));
    console.log(`  2.1 Document ouvert par le SG : ${sgDocView.data.title}`);
    console.log(`  -> TEST 2 RÉUSSI : Courrier visible et consultable par le Secrétaire Général !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 3 : Option A - Le Secrétaire Général choisit « Archiver dans mon service »
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3 : Option A - Secrétaire Général archive dans son service ---');
    const sgArchiveRes = await httpRequest(`/documents/${doc1Id}/archive-service`, 'POST', {
      archive_scope: 'PRIVE_SERVICE'
    }, {
      'Authorization': `Bearer ${sgAuth.token}`
    });
    assert.strictEqual(sgArchiveRes.status, 200);
    console.log(`  3.1 Action archivage service : ${sgArchiveRes.status} ${sgArchiveRes.data.message}`);

    const doc1Archived = await db.get('SELECT owner_service_id, archive_scope, status, reference FROM documents WHERE id = ?', [doc1Id]);
    assert.strictEqual(doc1Archived.status, 'ARCHIVED');
    assert.strictEqual(doc1Archived.archive_scope, 'PRIVE_SERVICE');
    assert.strictEqual(Number(doc1Archived.owner_service_id), Number(sgService.id));
    assert.strictEqual(doc1Archived.reference, doc1Ref);
    console.log(`  -> TEST 3 RÉUSSI : Courrier classé dans les archives du Secrétariat Général (Statut = ARCHIVED) !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 4 : Le Secrétaire Général reçoit un autre courrier et choisit « Transmettre à Service A (DAF) »
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4 : Option B - Secrétaire Général transmet un nouveau courrier à Service A (DAF) ---');
    const doc2Res = await httpRequest('/documents/incoming', 'POST', {
      title: 'Devis acquisition équipements informatiques pour les laboratoires',
      description: 'Dossier budgétaire pour imputation financière',
      sender_name: 'Fournisseur Alpha SARL',
      priority: 'NORMAL'
    }, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(doc2Res.status, 201);
    const doc2Id = doc2Res.data.id;
    const doc2Ref = doc2Res.data.reference;

    // SG transmits to Service A (DAF)
    const sgTransmitRes = await httpRequest('/workflow/transmit', 'POST', {
      document_id: doc2Id,
      to_service_id: dafService.id,
      instruction: 'Pour traitement budgétaire et engagement des dépenses'
    }, {
      'Authorization': `Bearer ${sgAuth.token}`
    });
    assert.strictEqual(sgTransmitRes.status, 200);
    console.log(`  4.1 Transmission SG -> DAF : ${sgTransmitRes.data.message}`);

    const doc2AfterSG = await db.get('SELECT current_service_id, status, reference FROM documents WHERE id = ?', [doc2Id]);
    assert.strictEqual(Number(doc2AfterSG.current_service_id), Number(dafService.id));
    assert.strictEqual(doc2AfterSG.reference, doc2Ref);
    console.log(`  -> TEST 4 RÉUSSI : Dossier transmis de SG vers Service A (DAF) avec succès !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 5 : Service A reçoit le courrier et devient le responsable actuel
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5 : Réception et prise en charge par Service A (DAF) ---');
    const dafDocView = await httpRequest(`/documents/${doc2Id}`, 'GET', null, {
      'Authorization': `Bearer ${dafAuth.token}`
    });
    assert.strictEqual(dafDocView.status, 200);
    assert.strictEqual(Number(dafDocView.data.current_service_id), Number(dafService.id));
    console.log(`  5.1 Document consulté par la DAF : Réf ${dafDocView.data.reference}`);
    console.log(`  -> TEST 5 RÉUSSI : Service A (DAF) est bien le responsable actuel du dossier !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 6 : Service A (DAF) transmet à Service B (CF - Contrôle Financier)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6 : Service A (DAF) transmet à Service B (CF) ---');
    const dafTransmitToCF = await httpRequest('/workflow/transmit', 'POST', {
      document_id: doc2Id,
      to_service_id: cfService.id,
      instruction: 'Pour visa de conformité financière préalable'
    }, {
      'Authorization': `Bearer ${dafAuth.token}`
    });
    assert.strictEqual(dafTransmitToCF.status, 200);
    console.log(`  6.1 Transmission DAF -> CF : ${dafTransmitToCF.data.message}`);

    const doc2AfterDAF = await db.get('SELECT current_service_id, status, reference FROM documents WHERE id = ?', [doc2Id]);
    assert.strictEqual(Number(doc2AfterDAF.current_service_id), Number(cfService.id));
    assert.strictEqual(doc2AfterDAF.reference, doc2Ref);
    console.log(`  -> TEST 6 RÉUSSI : Dossier transmis à Service B (CF), nouveau responsable = CF !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 7 : Service B retourne le courrier au Secrétariat Central pour archivage
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7 : Option C - Service B retourne au Secrétariat Central pour archivage central ---');
    const returnToSCRes = await httpRequest(`/documents/${doc2Id}/transmit-to-central-archive`, 'POST', {
      motive: 'Visas financiers et budgétaires apposés. Dossier clôturé à verser aux Archives Centrales.'
    }, {
      'Authorization': `Bearer ${cfAuth.token}`
    });
    assert.strictEqual(returnToSCRes.status, 200);
    console.log(`  7.1 Retour vers SC : ${returnToSCRes.data.message}`);

    const doc2Returned = await db.get('SELECT current_service_id, status, reference, transmitted_to_sc_for_archive FROM documents WHERE id = ?', [doc2Id]);
    assert.strictEqual(Number(doc2Returned.current_service_id), Number(scService.id));
    assert.strictEqual(doc2Returned.status, 'EN_ATTENTE_ARCHIVAGE_CENTRAL');
    assert.strictEqual(doc2Returned.transmitted_to_sc_for_archive, 1);
    assert.strictEqual(doc2Returned.reference, doc2Ref);
    console.log(`  -> TEST 7 RÉUSSI : Dossier retourné au Secrétariat Central (Statut = EN_ATTENTE_ARCHIVAGE_CENTRAL) !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 8 : Secrétariat Central archive aux Archives Centrales
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8 : Secrétariat Central archive définitivement aux Archives Centrales ---');
    const scArchiveCentralRes = await httpRequest(`/documents/${doc2Id}/archive-central`, 'POST', {}, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(scArchiveCentralRes.status, 200);
    console.log(`  8.1 Archivage central : ${scArchiveCentralRes.data.message}`);

    const doc2CentralArchived = await db.get('SELECT status, archive_scope, is_central_archived, reference FROM documents WHERE id = ?', [doc2Id]);
    assert.strictEqual(doc2CentralArchived.status, 'ARCHIVED');
    assert.strictEqual(doc2CentralArchived.archive_scope, 'CENTRAL');
    assert.strictEqual(doc2CentralArchived.is_central_archived, 1);
    assert.strictEqual(doc2CentralArchived.reference, doc2Ref);
    console.log(`  -> TEST 8 RÉUSSI : Document versé aux Archives Centrales (Statut = ARCHIVED, Scope = CENTRAL) !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 9 : Vérification de la référence unique et immuable pendant tout le parcours
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9 : Vérification de l’immuabilité stricte de la référence ---');
    const docDetail = await httpRequest(`/documents/${doc2Id}`, 'GET', null, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(docDetail.status, 200);
    console.log(`  • Référence initiale attribuée : ${doc2Ref}`);
    console.log(`  • Référence finale dans l'API   : ${docDetail.data.reference}`);
    assert.strictEqual(docDetail.data.reference, doc2Ref, 'La référence ne doit jamais changer au cours du circuit !');
    console.log(`  -> TEST 9 RÉUSSI : La référence ${doc2Ref} est restée 100% identique sur les 6 étapes du circuit !`);
    passed++;

    // -------------------------------------------------------------------------
    // TEST 10 : Vérifier qu’aucune copie n’a été créée (Zéro duplication)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10 : Vérification de non-duplication des documents ---');
    const duplicateList = await db.all('SELECT id, reference FROM documents WHERE reference = ?', [doc2Ref]);
    console.log(`  • Nombre d’enregistrements avec la référence ${doc2Ref} : ${duplicateList.length}`);
    assert.strictEqual(duplicateList.length, 1, 'Aucune copie du document ne doit être créée lors des transmissions !');
    console.log(`  -> TEST 10 RÉUSSI : Un seul et unique dossier existe en base de données !`);
    passed++;

    console.log('\n================================================================');
    console.log(` RÉSULTAT GLOBAL : ${passed}/10 TESTS PASSÉS AVEC SUCCÈS ! (100%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('❌ ÉCHEC DU TEST « ARCHIVER ET TRANSMETTRE » :', err);
    process.exit(1);
  }
}

runTests();
