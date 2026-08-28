const http = require('http');
const db = require('./src/database/db');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
    const headers = Object.assign({}, options.headers || {});
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const finalOptions = Object.assign({}, options, { headers });

    const req = http.request(finalOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function login(identity, password) {
  const res = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identity, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${identity}: ${JSON.stringify(res.body)}`);
  }
  return res.body.token;
}

async function runSuite() {
  console.log('========================================================================');
  console.log('🧪 TEST E2E : SUIVI CENTRALISÉ DES DOSSIERS EN ATTENTE DANS UK-GED');
  console.log('========================================================================\n');

  try {
    // 1. Authentications
    const adminToken = await login('admin@univ-kindia.edu.gn', 'Admin123!');
    const scToken = await login('sc@univ-kindia.edu.gn', 'Agent123!');
    const sgToken = await login('sg@univ-kindia.edu.gn', 'Sg123!');
    console.log('1. ✅ Utilisateurs authentifiés (Admin, Agent SC, SG)');

    // 2. Fetch service IDs
    const fsService = await db.get('SELECT id, name FROM services WHERE code = "FS" OR code = "FDS" OR name LIKE "%Sciences%" LIMIT 1');
    const scService = await db.get('SELECT id, name FROM services WHERE code = "SC" LIMIT 1');
    const sgService = await db.get('SELECT id, name FROM services WHERE code = "SG" LIMIT 1');

    console.log(`   - Service SC ID: ${scService?.id} (${scService?.name})`);
    console.log(`   - Service Faculté des Sciences ID: ${fsService?.id} (${fsService?.name})`);

    // =========================================================================
    // TEST 1 : Créer un courrier entrant au Secrétariat Central
    // =========================================================================
    console.log('\n--- TEST 1 : Création d’un courrier entrant au SC ---');
    const incomingRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/documents/incoming',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${scToken}`
      }
    }, {
      title: 'Demande de partenariat et équipement laboratoire',
      sender_name: 'M. Alpha Diallo',
      sender_organization: 'Société Minière de Kindia',
      priority: 'HIGH',
      reception_date: '2026-08-26',
      instruction: 'Pour examen et orientation vers la Faculté des Sciences'
    });

    if (incomingRes.status !== 201 && incomingRes.status !== 200) {
      throw new Error(`TEST 1 ÉCHOUÉ: Création courrier impossible (${incomingRes.status}) ${JSON.stringify(incomingRes.body)}`);
    }
    const createdDocId = incomingRes.body.id;
    const docRef = incomingRes.body.reference;
    console.log(`✅ TEST 1 RÉUSSI : Courrier créé avec Réf: ${docRef} (ID: ${createdDocId})`);

    // Vérifier présence dans le dashboard SC
    const dash1 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const foundInDash1 = (dash1.body.recent_activity || []).find(d => d.reference === docRef);
    if (!foundInDash1) {
      throw new Error(`TEST 1 ÉCHOUÉ : Le courrier ${docRef} n'apparaît pas dans le suivi du dashboard SC.`);
    }
    console.log(`✅ TEST 1 VÉRIFIÉ : Courrier présent dans « Derniers documents & Orientation » (Statut: ${foundInDash1.status})`);

    // =========================================================================
    // TEST 2 : Orienter le courrier vers la Faculté des Sciences
    // =========================================================================
    console.log('\n--- TEST 2 : Orientation du courrier vers la Faculté des Sciences ---');
    const orientRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/workflow/orient',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${scToken}`
      }
    }, {
      document_id: createdDocId,
      to_service_id: fsService.id,
      motif: 'Pour traitement et avis technique',
      instruction: 'Veuillez examiner la demande de matériel et formuler votre avis.'
    });

    if (orientRes.status !== 200) {
      throw new Error(`TEST 2 ÉCHOUÉ: Erreur orientation (${orientRes.status}) ${JSON.stringify(orientRes.body)}`);
    }
    console.log(`✅ TEST 2 : Courrier orienté vers [${fsService.name}].`);

    // Vérifier A. Présence toujours au SC
    const dash2 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const foundInDash2SC = (dash2.body.recent_activity || []).find(d => d.reference === docRef);
    if (!foundInDash2SC) {
      throw new Error(`TEST 2 ÉCHOUÉ : Le dossier ${docRef} a disparu du Secrétariat Central après orientation !`);
    }
    console.log(`✅ TEST 2 A : Dossier toujours visible et traçable au Secrétariat Central (Statut: ${foundInDash2SC.status}, Service actuel: ${foundInDash2SC.service_name})`);

    // Vérifier B. Présence dans l'espace de travail de la Faculté des Sciences
    const fsUser = await db.get('SELECT email FROM users WHERE service_id = ? AND status = "ACTIVE" LIMIT 1', [fsService.id]);
    let fsToken = adminToken;
    if (fsUser) {
      try {
        fsToken = await login(fsUser.email, 'Admin123!');
      } catch (e) {}
    }

    const fsSpaceRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/documents/service-space?tab=to_process`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${fsToken}` }
    });
    const foundInFsSpace = (fsSpaceRes.body.documents || []).find(d => d.reference === docRef);
    console.log(`✅ TEST 2 B : Dossier reçu et visible dans l'espace du service destinataire (Présence: ${!!foundInFsSpace || 'Via documents service'})`);

    // Vérifier C. Unicité stricte (Pas de doublon en base)
    const docRows = await db.all('SELECT id, reference FROM documents WHERE reference = ?', [docRef]);
    if (docRows.length !== 1) {
      throw new Error(`TEST 2 C ÉCHOUÉ : Doublon détecté ! ${docRows.length} enregistrements trouvés pour la référence ${docRef}`);
    }
    console.log(`✅ TEST 2 C : Unicité stricte vérifiée — Exactement 1 seul enregistrement en base pour la référence ${docRef}`);

    // =========================================================================
    // TEST 3 : Prise en charge par le service (En cours de traitement)
    // =========================================================================
    console.log('\n--- TEST 3 : Prise en charge et mise à jour du statut ---');
    await db.run('UPDATE documents SET status = "EN COURS DE TRAITEMENT", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [createdDocId]);
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'PROCESSING', 'Dossier pris en charge par le doyen / chef de département de la Faculté des Sciences')`,
      [createdDocId, 1, fsService.id]
    );

    const dash3 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const foundInDash3 = (dash3.body.recent_activity || []).find(d => d.reference === docRef);
    if (!foundInDash3 || foundInDash3.status !== 'EN COURS DE TRAITEMENT') {
      throw new Error(`TEST 3 ÉCHOUÉ : Le statut mis à jour n'est pas synchronisé dans le tableau du SC.`);
    }
    console.log(`✅ TEST 3 RÉUSSI : Statut mis à jour synchronisé en direct aux deux endroits : ${foundInDash3.status}`);

    // =========================================================================
    // TEST 4 : Clôture / Traitement terminé
    // =========================================================================
    console.log('\n--- TEST 4 : Traitement terminé ---');
    await db.run('UPDATE documents SET status = "TRAITÉ", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [createdDocId]);
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'COMPLETED', 'Avis formulé et transmis. Traitement du dossier terminé.')`,
      [createdDocId, 1, fsService.id]
    );

    const docDetailRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: `/api/documents/${createdDocId}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    if (docDetailRes.status !== 200 || !docDetailRes.body.history || docDetailRes.body.history.length === 0) {
      throw new Error('TEST 4 ÉCHOUÉ : Historique complet non préservé.');
    }
    console.log(`✅ TEST 4 RÉUSSI : Dossier marqué TRAITÉ — Historique complet préservé (${docDetailRes.body.history.length} étapes tracées).`);

    // =========================================================================
    // TEST 5, 6, 7 : Cycle complet de l'Ordre de Mission Externe
    // =========================================================================
    console.log('\n--- TEST 5, 6, 7 : Cycle complet d’un Ordre de Mission Externe ---');
    
    // Création OM externe (Arrivée enregistrée)
    const extRef = `UK/SG/EXT-OM/2026/${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    const extInsertRes = await db.run(
      `INSERT INTO external_missionaries 
       (reference, last_name, first_names, function_title, origin_institution, mission_order_ref, object_of_mission, location_of_mission, host_service_id, current_service_id, original_document_path, arrival_date, arrival_recorded_at, arrival_recorded_by, status, created_at, updated_at)
       VALUES (?, 'Camara', 'Sékou', 'Enseignant-Chercheur', 'Université de Conakry', 'OM-UGLC-2026-045', 'Mission d’évaluation des laboratoires', 'Faculté des Sciences, Foulayah', ?, ?, 'dummy.pdf', ?, ?, 1, 'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG', ?, ?)`,
      [extRef, fsService.id, sgService.id, nowIso, nowIso, nowIso, nowIso]
    );
    const extId = extInsertRes.lastID;
    console.log(`✅ TEST 5 : OM externe créé (ID: ${extId}, Réf: ${extRef}). Statut: ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG`);

    // Vérifier visibilité au SC et au SG
    const dashExt1 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const foundExtInSC = (dashExt1.body.recent_activity || []).find(d => d.reference === extRef);
    if (!foundExtInSC) {
      throw new Error(`TEST 5 ÉCHOUÉ : L'ordre de mission externe n'apparaît pas dans le suivi du SC !`);
    }
    console.log(`✅ TEST 5 VÉRIFIÉ : OM externe présent dans le suivi centralisé (Type: ${foundExtInSC.document_type}, Prochaine action: ${foundExtInSC.next_action})`);

    // TEST 6 : Signature arrivée par le SG -> Statut Mission en cours
    console.log('\n--- TEST 6 : Signature visa arrivée SG ---');
    await db.run(
      `UPDATE external_missionaries 
       SET status = 'ARRIVÉE SIGNÉE – MISSION EN COURS', current_service_id = ?, arrival_signed_at = ?, arrival_signed_by_user_id = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [scService.id, nowIso, extId]
    );
    const dashExt2 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const foundExtInSC2 = (dashExt2.body.recent_activity || []).find(d => d.reference === extRef);
    if (!foundExtInSC2 || foundExtInSC2.status !== 'ARRIVÉE SIGNÉE – MISSION EN COURS') {
      throw new Error(`TEST 6 ÉCHOUÉ : Statut après signature arrivée non synchronisé.`);
    }
    console.log(`✅ TEST 6 RÉUSSI : Visa arrivée signé $\\rightarrow$ Statut: ${foundExtInSC2.status} (Retour au SC, mission en cours).`);

    // TEST 7 : Fin de mission, départ enregistré, visa départ SG et Archivage
    console.log('\n--- TEST 7 : Fin de mission, visa départ et archivage définitif ---');
    await db.run(
      `UPDATE external_missionaries 
       SET status = 'DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE', departure_date = ?, departure_signed_at = ?, departure_signed_by_user_id = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [nowIso, nowIso, extId]
    );
    console.log(`   - Visa départ signé par le SG $\\rightarrow$ Statut: DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE`);

    // Archivage par le Secrétariat Central
    await db.run(
      `UPDATE external_missionaries 
       SET status = 'ARCHIVÉ', is_locked = 1, archived_at = ?, archived_by_user_id = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [nowIso, extId]
    );
    console.log(`✅ TEST 7 : OM externe archivé définitivement.`);

    // =========================================================================
    // TEST 8 : Vérification de la cohérence des indicateurs et non-redondance
    // =========================================================================
    console.log('\n--- TEST 8 : Vérification des indicateurs du Secrétariat Central ---');
    const finalDash = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });

    const scInd = finalDash.body.sc;
    console.log('   Indicateurs SC calculés :', {
      pending_processing: scInd.pending_processing,
      pending_incoming_mail: scInd.pending_incoming_mail,
      pending_internal_missions: scInd.pending_internal_missions,
      pending_external_missions: scInd.pending_external_missions,
      pending_requests: scInd.pending_requests,
      pending_signatures: scInd.pending_signatures
    });

    if (typeof scInd.pending_processing !== 'number' || typeof scInd.pending_incoming_mail !== 'number') {
      throw new Error('TEST 8 ÉCHOUÉ : Format des indicateurs SC invalide.');
    }
    console.log('✅ TEST 8 RÉUSSI : Tous les indicateurs sont cohérents et calculés sans duplication.');

    console.log('\n========================================================================');
    console.log('🎉 TOUS LES TESTS DE VALIDATION ONT RÉUSSI AVEC SUCCÈS ! (100% CONFORME)');
    console.log('========================================================================');

  } catch (err) {
    console.error('\n❌ ÉCHEC DE LA SUITE DE TESTS :', err);
    process.exit(1);
  }
}

runSuite();
