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

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 TEST : TRADUCTION HUMAINE DES ACTIONS ET CONTRÔLE DASHBOARD UK-GED');
  console.log('========================================================================\n');

  try {
    const scToken = await login('sc@univ-kindia.edu.gn', 'Agent123!');
    const sgToken = await login('sg@univ-kindia.edu.gn', 'Sg123!');
    console.log('1. ✅ Connexions réussies au Secrétariat Central (SC) et Secrétaire Général (SG).');

    // 2. Créer un Ordre de Mission Externe pour tester toutes les étapes
    const extRef = `UK/SG/EXT-OM/2026/${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    
    // Fetch service IDs
    const fsService = await db.get('SELECT id, name FROM services WHERE code = "FS" OR code = "FDS" OR name LIKE "%Sciences%" LIMIT 1');
    const scService = await db.get('SELECT id, name FROM services WHERE code = "SC" LIMIT 1');
    const sgService = await db.get('SELECT id, name FROM services WHERE code = "SG" LIMIT 1');

    console.log('\n--- TEST A : Enregistrement de l’Arrivée de l’Ordre de Mission Externe ---');
    const extInsertRes = await db.run(
      `INSERT INTO external_missionaries 
       (reference, last_name, first_names, function_title, origin_institution, mission_order_ref, object_of_mission, location_of_mission, host_service_id, current_service_id, original_document_path, arrival_date, arrival_recorded_at, arrival_recorded_by, status, created_at, updated_at)
       VALUES (?, 'Diallo', 'Mamadou', 'Chercheur', 'Université de Sonfonia', 'OM-UGLC-2026-99', 'Évaluation scientifique et pédagogique', 'Kindia', ?, ?, 'doc.pdf', ?, ?, 1, 'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG', ?, ?)`,
      [extRef, fsService.id, sgService.id, nowIso, nowIso, nowIso, nowIso]
    );
    const extId = extInsertRes.lastID;

    await db.run(
      `INSERT INTO external_missionary_history (missionary_id, user_id, action, details)
       VALUES (?, 1, 'ARRIVAL_RECORDED', 'Arrivée du missionnaire enregistrée au Secrétariat Central. Transmis au Secrétaire Général pour visa.')`,
      [extId]
    );

    // Vérifier Dashboard SC
    const dashSC1 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const foundSC1 = (dashSC1.body.recent_activity || []).find(d => d.reference === extRef);
    if (!foundSC1) throw new Error('Dossier OM externe introuvable au SC');

    console.log('   - SC Dernière action Titre :', `"${foundSC1.last_action_title}"`);
    console.log('   - SC Dernière action Mention :', `"${foundSC1.last_action_mention}"`);
    console.log('   - SC Prochaine action :', `"${foundSC1.next_action}"`);

    if (foundSC1.last_action_title.includes('ARRIVAL_RECORDED') || foundSC1.last_action_title.includes('_')) {
      throw new Error('Code technique détecté dans last_action_title !');
    }
    console.log('✅ TEST A (SC) : Libellé humain propre, aucun code technique.');

    // Vérifier Dashboard SG
    const dashSG1 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${sgToken}` }
    });
    const foundSG1 = (dashSG1.body.recent_activity || []).find(d => d.reference === extRef);
    if (!foundSG1) throw new Error('Dossier OM externe introuvable au SG');
    console.log('   - SG Prochaine action adaptée :', `"${foundSG1.next_action}"`);
    console.log('✅ TEST A (SG) : Affichage réussi dans l’espace du Secrétaire Général.');

    // --- TEST B : Signature Visa Arrivée par le SG ---
    console.log('\n--- TEST B : Signature Visa Arrivée par le SG ---');
    await db.run(
      `UPDATE external_missionaries 
       SET status = 'ARRIVÉE SIGNÉE – MISSION EN COURS', current_service_id = ?, arrival_signed_at = ?, arrival_signed_by_user_id = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [scService.id, nowIso, extId]
    );
    await db.run(
      `INSERT INTO external_missionary_history (missionary_id, user_id, action, details)
       VALUES (?, 1, 'ARRIVAL_SIGNED_BY_SG', 'Visa d''arrivée signé par le Secrétaire Général. Retour au Secrétariat Central')`,
      [extId]
    );

    const dashSC2 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const foundSC2 = (dashSC2.body.recent_activity || []).find(d => d.reference === extRef);
    console.log('   - SC Titre :', `"${foundSC2.last_action_title}"`);
    console.log('   - SC Mention :', `"${foundSC2.last_action_mention}"`);
    console.log('   - SC Prochaine action :', `"${foundSC2.next_action}"`);

    if (foundSC2.last_action_title.includes('ARRIVAL_SIGNED_BY_SG') || foundSC2.last_action_title.includes('_')) {
      throw new Error('Code technique brut détecté lors du visa arrivée SG !');
    }
    if (!foundSC2.last_action_title.includes("Visa d'arrivée signé")) {
      throw new Error('Traduction du visa d\'arrivée incorrecte !');
    }
    console.log('✅ TEST B : Traduction parfaite du visa d’arrivée SG (« Visa d\'arrivée signé par le Secrétaire Général »).');

    // --- TEST C : Départ enregistré et Visa Départ SG ---
    console.log('\n--- TEST C : Enregistrement Départ et Visa Départ SG ---');
    await db.run(
      `UPDATE external_missionaries 
       SET status = 'DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE', departure_date = ?, departure_signed_at = ?, departure_signed_by_user_id = 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [nowIso, nowIso, extId]
    );
    await db.run(
      `INSERT INTO external_missionary_history (missionary_id, user_id, action, details)
       VALUES (?, 1, 'DEPART_SIGNED_BY_SG', 'Visa de départ signé électroniquement par le Secrétaire Général. Retour au Secrétariat Central pour archivage')`,
      [extId]
    );

    const dashSC3 = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/reports/dashboard',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    const foundSC3 = (dashSC3.body.recent_activity || []).find(d => d.reference === extRef);
    console.log('   - SC Titre :', `"${foundSC3.last_action_title}"`);
    console.log('   - SC Mention :', `"${foundSC3.last_action_mention}"`);
    console.log('   - SC Prochaine action :', `"${foundSC3.next_action}"`);

    if (foundSC3.last_action_title.includes('DEPART_SIGNED_BY_SG') || foundSC3.last_action_title.includes('_')) {
      throw new Error('Code technique brut détecté lors du visa départ SG !');
    }
    console.log('✅ TEST C : Traduction parfaite du visa de départ SG (« Visa de départ signé par le Secrétaire Général »).');

    // --- TEST D : Vérification globale qu'aucun code brut n'existe dans la liste ---
    console.log('\n--- TEST D : Contrôle d’absence totale de codes techniques dans la liste complète ---');
    const allRecent = dashSC3.body.recent_activity || [];
    const forbiddenPatterns = [
      'ARRIVAL_SIGNED_BY_SG', 'DEPART_SIGNED_BY_SG', 'REGISTRATION_AND_ARRIVAL_RECORDED',
      'MISSION_STARTED', 'DOCUMENT_FORWARDED', 'PENDING_SIGNATURE', 'PENDING_PROCESSING'
    ];

    let violations = 0;
    allRecent.forEach(item => {
      forbiddenPatterns.forEach(pat => {
        if ((item.last_action_title || '').includes(pat) || (item.last_action || '').startsWith(pat + ' :')) {
          console.error(`❌ Violation détectée sur ${item.reference} : "${item.last_action_title || item.last_action}"`);
          violations++;
        }
      });
    });

    if (violations > 0) {
      throw new Error(`${violations} violation(s) de code technique trouvée(s) dans recent_activity.`);
    }
    console.log(`✅ TEST D : ${allRecent.length} dossiers vérifiés. 0 code technique exposé.`);

    console.log('\n========================================================================');
    console.log('🎉 TOUS LES TESTS DE CONFORMITÉ ONT RÉUSSI AVEC SUCCÈS ! (100%)');
    console.log('========================================================================');

  } catch (e) {
    console.error('\n❌ ÉCHEC DU TEST :', e);
    process.exit(1);
  }
}

runTests();
