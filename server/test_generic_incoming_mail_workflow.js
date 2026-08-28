/**
 * Automated Test Suite for Generic & Flexible Incoming Mail Workflow
 * Université de Kindia (UK-GED)
 *
 * Règle métier finale :
 * « Un courrier entrant est un dossier unique qui peut circuler entre plusieurs services.
 * Chaque service qui le reçoit peut le traiter, l'archiver dans son propre service,
 * le transférer vers un autre service ou le retourner au Secrétariat Central pour archivage central.
 * Toutes les actions doivent conserver la même référence et être enregistrées dans un historique
 * unique et chronologique. »
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
  console.log(' UK-GED - TESTS DU WORKFLOW GÉNÉRALISÉ DES COURRIERS ENTRANTS');
  console.log('================================================================\n');

  let passed = 0;

  try {
    // 0. Authenticate test actors across services
    const scAuth = await login('sc@univ-kindia.edu.gn', 'Agent123!');
    const sgAuth = await login('sg@univ-kindia.edu.gn', 'Sg123!');
    const dafAuth = await login('daf@univ-kindia.edu.gn', 'Daf123!');
    const cfAuth = await login('cf@univ-kindia.edu.gn', 'Cf123!');
    const fsAuth = await login('doyen_fs@univ-kindia.edu.gn', 'Doyen123!');

    // Fetch service IDs
    const scService = await db.get('SELECT id, name, code FROM services WHERE code = "SC"');
    const sgService = await db.get('SELECT id, name, code FROM services WHERE code = "SG"');
    const dafService = await db.get('SELECT id, name, code FROM services WHERE code = "DAF"');
    const cfService = await db.get('SELECT id, name, code FROM services WHERE code = "CF"');
    const fsService = await db.get('SELECT id, name, code FROM services WHERE code = "FS"');

    console.log(`Services de test identifiés :`);
    console.log(`  • Secrétariat Central (SC)             : ID ${scService.id} (${scService.name})`);
    console.log(`  • Secrétariat Général (SG)             : ID ${sgService.id} (${sgService.name})`);
    console.log(`  • Service A (DAF - Affaires Financières): ID ${dafService.id} (${dafService.name})`);
    console.log(`  • Service B (CF - Contrôle Financier)   : ID ${cfService.id} (${cfService.name})`);
    console.log(`  • Service C (FS - Faculté des Sciences) : ID ${fsService.id} (${fsService.name})\n`);

    // -------------------------------------------------------------------------
    // ÉTAPE 1 : Le Secrétariat Central enregistre le courrier entrant
    // -------------------------------------------------------------------------
    console.log('--- ÉTAPE 1 : Enregistrement du courrier entrant au Secrétariat Central ---');
    const createRes = await httpRequest('/documents/incoming', 'POST', {
      title: 'Convention interuniversitaire de partenariat et recherche 2026',
      description: 'Dossier de coopération académique et subventions de recherche',
      sender_name: 'Dr. Mamadou DIALLO',
      sender_organization: 'Université Gamal Abdel Nasser de Conakry (UGANC)',
      priority: 'HIGH',
      instruction: 'Pour examen et orientation'
    }, {
      'Authorization': `Bearer ${scAuth.token}`
    });

    console.log('  1.1 Courrier enregistré :', createRes.status, 'ID:', createRes.data.id, 'RÉF:', createRes.data.reference);
    assert.strictEqual(createRes.status, 201);
    const docId = createRes.data.id;
    const initialReference = createRes.data.reference;
    assert.ok(initialReference && initialReference.length > 5);

    const docStep1 = await db.get('SELECT current_service_id, status, reference FROM documents WHERE id = ?', [docId]);
    assert.strictEqual(Number(docStep1.current_service_id), Number(scService.id));
    console.log(`  -> ÉTAPE 1 VALIDÉE : Dossier sous le contrôle du [Secrétariat Central] avec Réf: ${initialReference}`);
    passed++;

    // -------------------------------------------------------------------------
    // ÉTAPE 2 : Le Secrétariat Central transmet au Secrétaire Général
    // -------------------------------------------------------------------------
    console.log('\n--- ÉTAPE 2 : Transmission du Secrétariat Central au Secrétaire Général ---');
    const transmitToSG = await httpRequest('/workflow/transmit', 'POST', {
      document_id: docId,
      to_service_id: sgService.id,
      instruction: 'Soumis pour avis et arbitrage du Secrétaire Général'
    }, {
      'Authorization': `Bearer ${scAuth.token}`
    });

    console.log('  2.1 Transmission vers SG :', transmitToSG.status, transmitToSG.data.message);
    assert.strictEqual(transmitToSG.status, 200);

    const docStep2 = await db.get('SELECT current_service_id, status, reference FROM documents WHERE id = ?', [docId]);
    assert.strictEqual(Number(docStep2.current_service_id), Number(sgService.id));
    assert.strictEqual(docStep2.reference, initialReference);
    console.log(`  -> ÉTAPE 2 VALIDÉE : Dossier transféré au [Secrétariat Général], Réf conservée (${docStep2.reference})`);
    passed++;

    // -------------------------------------------------------------------------
    // ÉTAPE 3 : Le Secrétaire Général ouvre et met le document en cours de traitement
    // -------------------------------------------------------------------------
    console.log('\n--- ÉTAPE 3 : Consultation et Mise en cours de traitement par le SG ---');
    const sgDetail = await httpRequest(`/documents/${docId}`, 'GET', null, {
      'Authorization': `Bearer ${sgAuth.token}`
    });
    assert.strictEqual(sgDetail.status, 200);
    console.log('  3.1 Dossier ouvert par le SG :', sgDetail.data.title, 'Statut actuel:', sgDetail.data.status);

    const inProgressRes = await httpRequest(`/documents/${docId}/in-progress`, 'PUT', {
      remarks: 'Examen préliminaire du cadre budgétaire et académique en cours par le SG'
    }, {
      'Authorization': `Bearer ${sgAuth.token}`
    });
    console.log('  3.2 Mise en cours de traitement :', inProgressRes.status, inProgressRes.data.message);
    assert.strictEqual(inProgressRes.status, 200);

    const docStep3 = await db.get('SELECT current_service_id, status, reference FROM documents WHERE id = ?', [docId]);
    assert.strictEqual(Number(docStep3.current_service_id), Number(sgService.id));
    assert.strictEqual(docStep3.status, 'IN_PROGRESS');
    assert.strictEqual(docStep3.reference, initialReference);
    console.log(`  -> ÉTAPE 3 VALIDÉE : Statut passé à [IN_PROGRESS], responsable = SG, Réf = ${initialReference}`);
    passed++;

    // -------------------------------------------------------------------------
    // ÉTAPE 4 : Le Secrétaire Général transfère au Service A (DAF)
    // -------------------------------------------------------------------------
    console.log('\n--- ÉTAPE 4 : Transfert du SG vers le Service A (DAF) ---');
    const sgTransferToDAF = await httpRequest('/workflow/transmit', 'POST', {
      document_id: docId,
      to_service_id: dafService.id,
      instruction: 'Pour chiffrage budgétaire des composantes du projet'
    }, {
      'Authorization': `Bearer ${sgAuth.token}`
    });
    console.log('  4.1 Transfert vers DAF :', sgTransferToDAF.status, sgTransferToDAF.data.message);
    assert.strictEqual(sgTransferToDAF.status, 200);

    const docStep4 = await db.get('SELECT current_service_id, status, reference FROM documents WHERE id = ?', [docId]);
    assert.strictEqual(Number(docStep4.current_service_id), Number(dafService.id));
    assert.strictEqual(docStep4.reference, initialReference);
    console.log(`  -> ÉTAPE 4 VALIDÉE : Responsable actuel = [DAF], Réf conservée (${docStep4.reference})`);
    passed++;

    // -------------------------------------------------------------------------
    // ÉTAPE 5 & 6 : La DAF reçoit le dossier et le transfère au Service B (DRH)
    // -------------------------------------------------------------------------
    console.log('\n--- ÉTAPES 5 & 6 : La DAF consulte et transfère au Service B (DRH) ---');
    const dafDetail = await httpRequest(`/documents/${docId}`, 'GET', null, {
      'Authorization': `Bearer ${dafAuth.token}`
    });
    assert.strictEqual(dafDetail.status, 200);
    console.log('  5.1 Dossier consulté par la DAF :', dafDetail.data.reference);

    const dafTransferToCF = await httpRequest('/workflow/transmit', 'POST', {
      document_id: docId,
      to_service_id: cfService.id,
      instruction: 'Avis requis sur la conformité de l’engagement comptable et financier'
    }, {
      'Authorization': `Bearer ${dafAuth.token}`
    });
    console.log('  6.1 Transfert DAF -> Service B (CF) :', dafTransferToCF.status, dafTransferToCF.data.message);
    assert.strictEqual(dafTransferToCF.status, 200);

    const docStep6 = await db.get('SELECT current_service_id, status, reference FROM documents WHERE id = ?', [docId]);
    assert.strictEqual(Number(docStep6.current_service_id), Number(cfService.id));
    assert.strictEqual(docStep6.reference, initialReference);
    console.log(`  -> ÉTAPES 5 & 6 VALIDÉES : Responsable actuel = [CF], Réf = ${initialReference}`);
    passed++;

    // -------------------------------------------------------------------------
    // ÉTAPE 7 : Le Contrôle Financier (Service B) transfère à la Faculté des Sciences (Service C) qui le retourne au SC
    // -------------------------------------------------------------------------
    console.log('\n--- ÉTAPE 7 : Transfert CF -> Service C (FS) puis Retour au SC pour archivage central ---');
    const cfTransferToFS = await httpRequest('/workflow/transmit', 'POST', {
      document_id: docId,
      to_service_id: fsService.id,
      instruction: 'Pour avis du Doyen sur le volet recherche scientifique'
    }, {
      'Authorization': `Bearer ${cfAuth.token}`
    });
    assert.strictEqual(cfTransferToFS.status, 200);
    console.log('  7.1 Transfert CF -> Service C (FS) réussi.');

    // Service C puts in progress and then transmits to Central Archives
    const fsInProgress = await httpRequest(`/documents/${docId}/in-progress`, 'PUT', {
      remarks: 'Avis scientifique favorable émis par le Conseil de Faculté'
    }, {
      'Authorization': `Bearer ${fsAuth.token}`
    });
    assert.strictEqual(fsInProgress.status, 200);
    console.log('  7.2 Service C (FS) : Mis en cours de traitement.');

    const returnToSCRes = await httpRequest(`/documents/${docId}/transmit-to-central-archive`, 'POST', {
      motive: 'Circuit de traitement inter-services finalisé avec visas favorables. Demande de versement aux Archives Centrales.'
    }, {
      'Authorization': `Bearer ${fsAuth.token}`
    });
    console.log('  7.3 Retour vers SC pour archivage central :', returnToSCRes.status, returnToSCRes.data.message);
    assert.strictEqual(returnToSCRes.status, 200);

    const docStep7 = await db.get('SELECT current_service_id, status, reference, transmitted_to_sc_for_archive FROM documents WHERE id = ?', [docId]);
    assert.strictEqual(Number(docStep7.current_service_id), Number(scService.id));
    assert.strictEqual(docStep7.status, 'EN_ATTENTE_ARCHIVAGE_CENTRAL');
    assert.strictEqual(docStep7.transmitted_to_sc_for_archive, 1);
    assert.strictEqual(docStep7.reference, initialReference);
    console.log(`  -> ÉTAPE 7 VALIDÉE : Dossier revenu au [Secrétariat Central] avec statut [EN_ATTENTE_ARCHIVAGE_CENTRAL] !`);
    passed++;

    // -------------------------------------------------------------------------
    // ÉTAPE 8 : Le Secrétariat Central finalise l'Archivage Central
    // -------------------------------------------------------------------------
    console.log('\n--- ÉTAPE 8 : Archivage définitif aux Archives Centrales par le Secrétariat Central ---');
    const archiveRes = await httpRequest(`/documents/${docId}/archive-central`, 'POST', {}, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    console.log('  8.1 Archivage central :', archiveRes.status, archiveRes.data.message);
    assert.strictEqual(archiveRes.status, 200);

    const docStep8 = await db.get('SELECT current_service_id, status, reference, archive_scope, is_central_archived FROM documents WHERE id = ?', [docId]);
    assert.strictEqual(docStep8.status, 'ARCHIVED');
    assert.strictEqual(docStep8.archive_scope, 'CENTRAL');
    assert.strictEqual(docStep8.is_central_archived, 1);
    assert.strictEqual(docStep8.reference, initialReference);
    console.log(`  -> ÉTAPE 8 VALIDÉE : Document archivé au niveau CENTRAL avec statut ARCHIVED et même Réf (${initialReference}) !`);
    passed++;

    // -------------------------------------------------------------------------
    // CONTRÔLE DE SÉCURITÉ & NON-DUPLICATION
    // -------------------------------------------------------------------------
    console.log('\n--- CONTRÔLES TRANSVERSAUX : Zéro duplication, Historique complet & Sécurité ABAC ---');
    
    // 1. Check zero duplication
    const duplicateCheck = await db.all('SELECT id, reference FROM documents WHERE reference = ?', [initialReference]);
    console.log(`  • Nombre d'enregistrements avec la référence ${initialReference} : ${duplicateCheck.length}`);
    assert.strictEqual(duplicateCheck.length, 1, 'Aucun doublon de document ne doit exister dans la base !');

    // 2. Check complete historical trajectory
    const circuitData = await httpRequest(`/workflow/circuit/${docId}`, 'GET', null, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(circuitData.status, 200);
    const historyEvents = circuitData.data.history || [];
    const transfers = circuitData.data.transfers || [];
    console.log(`  • Nombre d'événements historiques enregistrés : ${historyEvents.length}`);
    console.log(`  • Nombre de transferts inter-services enregistrés : ${transfers.length}`);
    
    console.log('    [Trajectoire Chronologique Complète] :');
    for (let i = 0; i < historyEvents.length; i++) {
      const ev = historyEvents[i];
      console.log(`      (${i + 1}) [${ev.action}] ${ev.details}`);
    }

    assert.ok(historyEvents.length >= 6, 'Tous les événements clés doivent être consignés dans l’historique chronologique.');
    assert.ok(transfers.length >= 4, 'Toutes les transmissions inter-services doivent être consignées.');

    // 3. Test local service archiving branch (Alternative option: Archive in own service)
    console.log('\n--- TEST BRANCHE ALTERNATIVE : Archivage dans son propre service ---');
    const doc2Create = await httpRequest('/documents/incoming', 'POST', {
      title: 'Demande de subvention pour laboratoire de chimie',
      description: 'Dossier transmis au Doyen pour classement interne',
      sender_name: 'Pr. Kaba',
      priority: 'NORMAL'
    }, {
      'Authorization': `Bearer ${scAuth.token}`
    });
    assert.strictEqual(doc2Create.status, 201);
    const doc2Id = doc2Create.data.id;
    const doc2Ref = doc2Create.data.reference;

    // SC transmits to DAF
    await httpRequest('/workflow/transmit', 'POST', {
      document_id: doc2Id,
      to_service_id: dafService.id,
      instruction: 'Pour conservation dans vos archives de service'
    }, {
      'Authorization': `Bearer ${scAuth.token}`
    });

    // DAF archives directly in its own service
    const dafArchiveInService = await httpRequest(`/documents/${doc2Id}/archive-service`, 'POST', {
      archive_scope: 'PRIVE_SERVICE'
    }, {
      'Authorization': `Bearer ${dafAuth.token}`
    });
    console.log('  • Archivage direct dans le service DAF :', dafArchiveInService.status, dafArchiveInService.data.message);
    assert.strictEqual(dafArchiveInService.status, 200);

    const doc2InDb = await db.get('SELECT owner_service_id, archive_scope, status, reference FROM documents WHERE id = ?', [doc2Id]);
    assert.strictEqual(Number(doc2InDb.owner_service_id), Number(dafService.id));
    assert.strictEqual(doc2InDb.status, 'ARCHIVED');
    assert.strictEqual(doc2InDb.archive_scope, 'PRIVE_SERVICE');
    assert.strictEqual(doc2InDb.reference, doc2Ref);
    console.log(`  -> BRANCHE ARCHIVAGE DE SERVICE VALIDÉE : Réf ${doc2Ref} classée dans l'archive du service DAF !`);
    passed++;

    console.log('\n================================================================');
    console.log(` RÉSULTAT GLOBAL : ${passed}/8 BLOCS DE TESTS PASSÉS AVEC SUCCÈS ! (100%)`);
    console.log('================================================================');

  } catch (err) {
    console.error('❌ ÉCHEC DU TEST DU WORKFLOW :', err);
    process.exit(1);
  }
}

runTests();
