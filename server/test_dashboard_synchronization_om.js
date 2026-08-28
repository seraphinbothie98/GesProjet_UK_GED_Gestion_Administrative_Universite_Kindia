const http = require('http');
const assert = require('assert');
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

async function runValidationSuite() {
  console.log('========================================================================');
  console.log('🧪 VALIDATION SYNCHRONISATION TABLEAU DE BORD & DERNIERS DOCUMENTS');
  console.log('========================================================================\n');

  try {
    await db.run("UPDATE users SET status = 'ACTIVE' WHERE email = 'ec1@univ-kindia.edu.gn'");
    const adminToken = await login('admin@univ-kindia.edu.gn', 'Admin123!');
    const scToken = await login('sc@univ-kindia.edu.gn', 'Agent123!');
    const sgToken = await login('sg@univ-kindia.edu.gn', 'Sg123!');
    const ecToken = await login('ec1@univ-kindia.edu.gn', 'Ec123!');
    const dafToken = await login('daf@univ-kindia.edu.gn', 'Daf123!');

    console.log('1. ✅ Connexions établies pour SC, SG, EC, DAF, Admin');

    // TEST 1 : Ordre de Mission Interne (Création & Visibilité immédiate)
    console.log('\n--- TEST 1 : Création d’une demande d’Ordre de Mission interne ---');
    
    // Récupérer l'état initial du dashboard SC
    const dashBefore = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const initialOmCount = dashBefore.body.sc?.pending_internal_missions || 0;
    const initialTotalCount = dashBefore.body.sc?.pending_processing || 0;

    // Création de la demande d'ordre de mission interne par l'enseignant-chercheur
    const omRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/mission-requests',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ecToken}`
      }
    }, {
      applicant_last_name: 'Diallo',
      applicant_first_names: 'Mamadou',
      applicant_function: 'Maître de Conférences',
      applicant_service_name: 'Faculté des Sciences',
      applicant_phone: '+224 622 00 11 22',
      applicant_email: 'ec1@univ-kindia.edu.gn',
      object_of_mission: 'Participation au Colloque International de Géologie',
      destination: 'Labé (Guinée)',
      start_date: '2026-09-01',
      end_date: '2026-09-05',
      duration_days: 5,
      transport_means: 'VÉHICULE OFFICIEL',
      justification_motif: 'Présentation des travaux de recherche'
    });

    assert.strictEqual(omRes.status, 201, `Erreur création OM interne: ${JSON.stringify(omRes.body)}`);
    const omReqId = omRes.body.id;
    const omReqRef = omRes.body.reference;
    console.log(`✅ Demande d'OM interne créée avec succès. Réf: ${omReqRef} (ID: ${omReqId})`);

    // Vérification Dashboard SC
    const dashAfterSC = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });

    const newOmCount = dashAfterSC.body.sc?.pending_internal_missions || 0;
    const newTotalCount = dashAfterSC.body.sc?.pending_processing || 0;
    const recentActivitySC = dashAfterSC.body.recent_activity || [];

    console.log(`   - "OM Internes en Attente" : ${initialOmCount} -> ${newOmCount}`);
    console.log(`   - "Total en Traitement"     : ${initialTotalCount} -> ${newTotalCount}`);
    assert.strictEqual(newOmCount, initialOmCount + 1, 'Le compteur "OM Internes en Attente" doit augmenter de 1');
    assert.strictEqual(newTotalCount, initialTotalCount + 1, 'Le compteur "Total en Traitement" doit augmenter de 1');

    // Vérifier présence dans "Derniers Documents & Orientations"
    const foundOMInRecent = recentActivitySC.find(item => item.reference === omReqRef);
    assert(foundOMInRecent, `L'ordre de mission ${omReqRef} DOIT apparaître dans "Derniers Documents & Orientations" !`);
    console.log('✅ Dossier présent dans "Derniers Documents & Orientations" :', {
      reference: foundOMInRecent.reference,
      title: foundOMInRecent.title,
      type_category: foundOMInRecent.type_category,
      sender_name: foundOMInRecent.sender_name,
      service_name: foundOMInRecent.service_name,
      current_responsible: foundOMInRecent.current_responsible,
      status: foundOMInRecent.status,
      last_action: foundOMInRecent.last_action,
      next_action: foundOMInRecent.next_action
    });

    // Vérifier dashboard de l'enseignant-chercheur créateur
    const dashAfterEC = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${ecToken}` }
    });
    const foundOMInEC = (dashAfterEC.body.recent_activity || []).find(item => item.reference === omReqRef);
    assert(foundOMInEC, 'Le demandeur EC doit également voir sa demande active dans son tableau de bord');
    console.log(`✅ Demandeur EC voit également son dossier actif : ${foundOMInEC.reference}`);

    // TEST 2 : Ordre de Mission Externe
    console.log('\n--- TEST 2 : Création et visibilité d’un Ordre de Mission externe ---');
    const extRef = `UK/SG/EXT-OM/2026/${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    const fsService = await db.get('SELECT id, name FROM services WHERE code = "FS" OR code = "FDS" LIMIT 1');
    const sgService = await db.get('SELECT id, name FROM services WHERE code = "SG" LIMIT 1');

    const extInsertRes = await db.run(
      `INSERT INTO external_missionaries 
       (reference, last_name, first_names, function_title, origin_institution, mission_order_ref, object_of_mission, location_of_mission, host_service_id, current_service_id, original_document_path, arrival_date, arrival_recorded_at, arrival_recorded_by, status, created_at, updated_at)
       VALUES (?, 'Bah', 'Ibrahima', 'Professeur Invité', 'Université de Dakar', 'OM-UCAD-2026-88', 'Expertise pédagogique Masters', 'Kindia', ?, ?, 'dummy.pdf', ?, ?, 1, 'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG', ?, ?)`,
      [extRef, fsService.id, sgService.id, nowIso, nowIso, nowIso, nowIso]
    );
    const extId = extInsertRes.lastID;

    const dashExt = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const foundExt = (dashExt.body.recent_activity || []).find(item => item.reference === extRef);
    assert(foundExt, `L'OM externe ${extRef} DOIT apparaître dans "Derniers Documents & Orientations" !`);
    console.log(`✅ OM externe présent dans le tableau : ${foundExt.reference} (Statut: ${foundExt.status})`);

    // TEST 3 : Passage à Archivé (Disparition de Derniers Documents & Orientations)
    console.log('\n--- TEST 3 : Archivage du dossier et disparition du tableau ---');
    // Archiver l'OM externe
    await db.run('UPDATE external_missionaries SET status = "ARCHIVÉ", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [extId]);
    
    const dashAfterArchive = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const foundExtAfterArchive = (dashAfterArchive.body.recent_activity || []).find(item => item.reference === extRef);
    assert.strictEqual(foundExtAfterArchive, undefined, 'Le dossier archivé NE DOIT PLUS apparaître dans "Derniers Documents & Orientations"');
    console.log(`✅ Dossier archivé exclu avec succès de "Derniers Documents & Orientations"`);

    // TEST 4 : Réorientation et non-duplication
    console.log('\n--- TEST 4 : Réorientation d’un courrier et unicité ---');
    const incRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/documents/incoming',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${scToken}`
      }
    }, {
      title: 'Facture et bordereau de livraison fournitures',
      sender_name: 'Fournisseur Alpha',
      sender_organization: 'Bureautique Guinée',
      priority: 'NORMAL',
      reception_date: '2026-08-27',
      instruction: 'À orienter vers la DAF'
    });
    const docId = incRes.body.id;
    const docRef = incRes.body.reference;

    // Orienter vers DAF
    const dafService = await db.get('SELECT id, name FROM services WHERE code = "DAF" LIMIT 1');
    await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/workflow/orient',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${scToken}`
      }
    }, {
      document_id: docId,
      to_service_id: dafService.id,
      motif: 'Pour engagement comptable',
      instruction: 'Veuillez procéder à la liquidation'
    });

    const dashOrient = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const matchingDocs = (dashOrient.body.recent_activity || []).filter(item => item.reference === docRef);
    assert.strictEqual(matchingDocs.length, 1, 'Il ne doit y avoir aucun doublon du document dans le tableau');
    assert.strictEqual(matchingDocs[0].service_name, dafService.name, 'Le service responsable doit être à jour');
    console.log(`✅ Document orienté vers [${matchingDocs[0].service_name}] sans doublon (Occurrences : ${matchingDocs.length})`);

    // TEST 5 : Cohérence des indicateurs vs Tableau
    console.log('\n--- TEST 5 : Vérification de non-incohérence globale ---');
    const finalDash = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });

    const totalProcessing = finalDash.body.sc?.pending_processing;
    const tableItemsCount = finalDash.body.recent_activity?.length || 0;
    console.log(`   - "Total en Traitement" : ${totalProcessing}`);
    console.log(`   - "Dossiers dans le tableau" : ${tableItemsCount}`);
    assert(tableItemsCount > 0, 'Le tableau doit contenir les dossiers actifs');
    assert(totalProcessing > 0, 'Les indicateurs de dossiers actifs doivent être cohérents');

    console.log('\n========================================================================');
    console.log('🎉 TOUS LES TESTS SONT VALIDES ET LE TABLEAU EST PARFAITEMENT SYNCHRONISÉ !');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('\n❌ ÉCHEC DU TEST DE VALIDATION :', err);
    process.exit(1);
  }
}

runValidationSuite();
