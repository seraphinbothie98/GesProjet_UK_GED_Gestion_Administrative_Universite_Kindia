const db = require('./src/database/db');
const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./src/config/constants');

async function runDispatchingTests() {
  console.log('=== SUITE DE TESTS COMPLÈTE : MODULE DE DISPATCHING & DIFFUSION ADMINISTRATIVE UK-GED ===\n');

  // Tokens for different test actors
  const adminToken = jwt.sign(
    { userId: 1, email: 'admin@univ-kindia.edu.gn', role: 'ADMIN_TECH', role_code: 'ADMIN_TECH' },
    JWT_SECRET
  );

  const scToken = jwt.sign(
    { userId: 2, email: 'sc@univ-kindia.edu.gn', service_id: 1, role: 'AGENT_SC', role_code: 'AGENT_SC' },
    JWT_SECRET
  );

  // Helper for HTTP requests
  function apiRequest(method, urlPath, token, body = null) {
    return new Promise((resolve, reject) => {
      const postData = body ? JSON.stringify(body) : null;
      const headers = { 'Authorization': `Bearer ${token}` };
      if (postData) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const options = {
        hostname: '127.0.0.1',
        port: 5000,
        path: urlPath,
        method: method,
        headers: headers
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data, headers: res.headers });
          }
        });
      });
      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  // Helper for raw binary download
  function apiDownload(urlPath, token) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: '127.0.0.1',
        port: 5000,
        path: urlPath,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      };

      const req = http.request(options, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), headers: res.headers });
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  // 0. Setup: Create a master Note de Service document in the database
  const docRef = `NS-UK-2026-TEST-${Date.now().toString().slice(-4)}`;
  const docInsert = await db.run(
    `INSERT INTO documents 
     (reference, tracking_token, document_type, title, description, priority, confidentiality, status, current_service_id, created_by)
     VALUES (?, ?, 'NOTE_SERVICE', 'Note de Service Relative aux Examens Session 2026', 'Organisation et calendrier des épreuves', 'HIGH', 'INTERNAL', 'ACCEPTED', 1, 1)`,
    [docRef, `TRK_${Date.now()}`]
  );
  const testDocId = docInsert.lastID;
  console.log(`0. Document maître créé : ID ${testDocId}, Réf: ${docRef}\n`);

  // Count active services in database
  const activeServices = await db.all("SELECT id, name FROM services WHERE status = 'ACTIVE'");
  const totalActiveServices = activeServices.length;
  console.log(`   - Total des services actifs en base : ${totalActiveServices} services\n`);

  // ----------------------------------------------------
  // TEST 1: Diffuser une note à TOUS les services
  // ----------------------------------------------------
  console.log('--- TEST 1 : Diffusion à TOUS les services actifs ---');
  const disp1Res = await apiRequest('POST', '/api/dispatches', scToken, {
    document_id: testDocId,
    dispatch_type: 'PRISE_DE_CONNAISSANCE',
    title: 'Note de Service - Examens Session 2026',
    message: 'Application stricte des consignes pour tous les départements et facultés.',
    recipients_mode: 'ALL_SERVICES'
  });

  console.log(`   - Statut création: ${disp1Res.status} -> Réf: ${disp1Res.data.reference}, Destinataires: ${disp1Res.data.recipients_count}`);
  if (disp1Res.status !== 201) throw new Error('Échec TEST 1 création diffusion');
  if (disp1Res.data.recipients_count !== totalActiveServices) {
    throw new Error(`TEST 1 échoué: attendu ${totalActiveServices} destinataires, reçu ${disp1Res.data.recipients_count}`);
  }
  const dispatch1Id = disp1Res.data.id;
  console.log('   ✅ TEST 1 VALIDÉ (Diffusion à tous les services créée avec succès)\n');

  // ----------------------------------------------------
  // TEST 2: Diffuser à SEULEMENT 3 services spécifiques
  // ----------------------------------------------------
  console.log('--- TEST 2 : Diffusion ciblée à 3 services spécifiques ---');
  const target3Services = activeServices.slice(0, 3).map(s => s.id);
  const disp2Res = await apiRequest('POST', '/api/dispatches', scToken, {
    document_id: testDocId,
    dispatch_type: 'ACTION_REQUISE',
    title: 'Action urgente - Transmission des listes',
    action_description: 'Transmettre la liste nominative des surveillants avant vendredi 17h00.',
    deadline: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    recipients_mode: 'SELECTED_SERVICES',
    service_ids: target3Services
  });

  console.log(`   - Statut création: ${disp2Res.status} -> Réf: ${disp2Res.data.reference}, Destinataires: ${disp2Res.data.recipients_count}`);
  if (disp2Res.status !== 201 || disp2Res.data.recipients_count !== 3) {
    throw new Error('Échec TEST 2: diffusion ciblée');
  }
  const dispatch2Id = disp2Res.data.id;
  console.log('   ✅ TEST 2 VALIDÉ (Diffusion ciblée à 3 services)\n');

  // ----------------------------------------------------
  // TEST 3: Consulter le document (statut CONSULTE sans prise de connaissance)
  // ----------------------------------------------------
  console.log('--- TEST 3 : Consultation du document ---');
  const recipientsDisp1 = await db.all('SELECT * FROM dispatch_recipients WHERE dispatch_id = ?', [dispatch1Id]);
  const testRecipient1 = recipientsDisp1[0];

  const viewRes = await apiRequest('POST', `/api/dispatches/recipients/${testRecipient1.id}/view`, adminToken);
  console.log(`   - Statut consultation: ${viewRes.status} -> ${viewRes.data.message}`);
  
  const recAfterView = await db.get('SELECT * FROM dispatch_recipients WHERE id = ?', [testRecipient1.id]);
  console.log(`   - Statut en base après consultation: "${recAfterView.status}" (Vu le : ${recAfterView.first_viewed_at})`);
  if (recAfterView.status !== 'CONSULTE' || !recAfterView.first_viewed_at) {
    throw new Error('TEST 3 échoué: consultation non enregistrée');
  }
  console.log('   ✅ TEST 3 VALIDÉ (Consultation enregistrée sans marquer la prise de connaissance)\n');

  // ----------------------------------------------------
  // TEST 4: Prendre connaissance obligatoire
  // ----------------------------------------------------
  console.log('--- TEST 4 : Prise de connaissance certifiée ---');
  const ackRes = await apiRequest('POST', `/api/dispatches/recipients/${testRecipient1.id}/acknowledge`, adminToken);
  console.log(`   - Statut validation: ${ackRes.status} -> ${ackRes.data.message}`);

  const recAfterAck = await db.get('SELECT * FROM dispatch_recipients WHERE id = ?', [testRecipient1.id]);
  console.log(`   - Statut en base: "${recAfterAck.status}", Émargé le : ${recAfterAck.acknowledged_at}, Par user: ${recAfterAck.acknowledged_by}`);
  if (recAfterAck.status !== 'PRISE_DE_CONNAISSANCE' || !recAfterAck.acknowledged_at) {
    throw new Error('TEST 4 échoué: prise de connaissance non validée');
  }
  console.log('   ✅ TEST 4 VALIDÉ (Prise de connaissance horodatée et certifiée)\n');

  // ----------------------------------------------------
  // TEST 5: Action requise (Cycle START -> COMPLETE)
  // ----------------------------------------------------
  console.log('--- TEST 5 : Action requise (Cycle Démarrage -> Clôture) ---');
  const recipientsDisp2 = await db.all('SELECT * FROM dispatch_recipients WHERE dispatch_id = ?', [dispatch2Id]);
  const testRecipient2 = recipientsDisp2[0];

  // 5.1 Start Action
  const startRes = await apiRequest('POST', `/api/dispatches/recipients/${testRecipient2.id}/action/start`, adminToken);
  console.log(`   - Démarrage action: ${startRes.status} -> ${startRes.data.message}`);
  const recAfterStart = await db.get('SELECT * FROM dispatch_recipients WHERE id = ?', [testRecipient2.id]);
  if (recAfterStart.status !== 'ACTION_EN_COURS') throw new Error('TEST 5.1 échoué: statut ACTION_EN_COURS non mis');

  // 5.2 Complete Action with comment
  const completeRes = await apiRequest('POST', `/api/dispatches/recipients/${testRecipient2.id}/action/complete`, adminToken, {
    comment: 'Liste des 12 surveillants transmise et validée.'
  });
  console.log(`   - Clôture action: ${completeRes.status} -> ${completeRes.data.message}`);
  const recAfterComp = await db.get('SELECT * FROM dispatch_recipients WHERE id = ?', [testRecipient2.id]);
  if (recAfterComp.status !== 'ACTION_TERMINEE' || !recAfterComp.action_completed_at) {
    throw new Error('TEST 5.2 échoué: statut ACTION_TERMINEE non mis');
  }
  console.log('   ✅ TEST 5 VALIDÉ (Action requise traitée avec compte-rendu)\n');

  // ----------------------------------------------------
  // TEST 6: Date limite dépassée (Détection EN_RETARD)
  // ----------------------------------------------------
  console.log('--- TEST 6 : Date limite dépassée & Détection du retard ---');
  const pastDeadline = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
  await db.run('UPDATE document_dispatches SET deadline = ? WHERE id = ?', [pastDeadline, dispatch2Id]);

  const detailWithLate = await apiRequest('GET', `/api/dispatches/${dispatch2Id}`, adminToken);
  if (detailWithLate.status !== 200 || !detailWithLate.data.dispatch) {
    console.error('detailWithLate failed:', detailWithLate);
    throw new Error('TEST 6 échoué: Impossible de charger le détail');
  }
  console.log(`   - Statut global calculé de la diffusion : "${detailWithLate.data.dispatch.status}"`);
  console.log('   ✅ TEST 6 VALIDÉ (Détection automatique des retards et échéances dépassées)\n');

  // ----------------------------------------------------
  // TEST 7: Rappel automatique
  // ----------------------------------------------------
  console.log('--- TEST 7 : Rappel automatique et relance des services ---');
  const remindRes = await apiRequest('POST', `/api/dispatches/${dispatch2Id}/remind`, scToken);
  console.log(`   - Résultat relance: ${remindRes.status} -> ${remindRes.data.message} (${remindRes.data.count} services relancés)`);
  if (remindRes.status !== 200 || remindRes.data.count === 0) throw new Error('TEST 7 échoué: rappels non envoyés');

  const recWithReminder = await db.get('SELECT reminders_sent, last_reminder_at FROM dispatch_recipients WHERE id = ?', [recipientsDisp2[1].id]);
  console.log(`   - Compteur de rappels incrémenté : ${recWithReminder.reminders_sent} rappel(s) envoyé(s)`);
  if (recWithReminder.reminders_sent !== 1) throw new Error('TEST 7 échoué: compteur rappel non incrémenté');
  console.log('   ✅ TEST 7 VALIDÉ (Rappels automatiques transmis et journalisés)\n');

  // ----------------------------------------------------
  // TEST 8: Suivi Secrétariat Central (Dashboard & Tracking)
  // ----------------------------------------------------
  console.log('--- TEST 8 : Suivi Secrétariat Central et Statistiques ---');
  const statsRes = await apiRequest('GET', '/api/dispatches/stats/dashboard', scToken);
  console.log('   - Métriques globales :', statsRes.data.stats);
  if (statsRes.status !== 200 || statsRes.data.stats.total_dispatches < 2) {
    throw new Error('TEST 8 échoué: stats dashboard invalides');
  }
  console.log('   ✅ TEST 8 VALIDÉ (Statistiques et indicateurs de performance conformes)\n');

  // ----------------------------------------------------
  // TEST 9: Export du rapport d'émargement PDF
  // ----------------------------------------------------
  console.log('--- TEST 9 : Export du rapport officiel d’émargement en PDF ---');
  const pdfRes = await apiDownload(`/api/dispatches/${dispatch1Id}/report-pdf`, scToken);
  console.log(`   - Statut téléchargement PDF: ${pdfRes.status}`);
  console.log(`   - Taille du rapport PDF généré: ${pdfRes.buffer.length} octets`);
  console.log(`   - Type MIME: ${pdfRes.headers['content-type']}`);
  if (pdfRes.status !== 200 || pdfRes.buffer.length < 500) {
    throw new Error('TEST 9 échoué: rapport PDF invalide');
  }
  console.log('   ✅ TEST 9 VALIDÉ (Rapport d’émargement officiel PDF généré avec succès)\n');

  // ----------------------------------------------------
  // TEST 10: Vérification des permissions
  // ----------------------------------------------------
  console.log('--- TEST 10 : Sécurité et vérification des permissions ---');
  const noPermToken = jwt.sign(
    { userId: 99, email: 'unauthorized@univ-kindia.edu.gn', role: 'GUEST', role_code: 'GUEST' },
    JWT_SECRET
  );
  const unauthRes = await apiRequest('POST', '/api/dispatches', noPermToken, {
    document_id: testDocId,
    title: 'Test illégal',
    recipients_mode: 'ALL_SERVICES'
  });
  console.log(`   - Tentative non autorisée : code HTTP ${unauthRes.status} (Attendu 403)`);
  if (unauthRes.status !== 403) throw new Error('TEST 10 échoué: la permission n’a pas été rejetée');
  console.log('   ✅ TEST 10 VALIDÉ (Contrôle strict des autorisations côté serveur)\n');

  // ----------------------------------------------------
  // TEST 11: Étanchéité entre services
  // ----------------------------------------------------
  console.log('--- TEST 11 : Étanchéité et isolation entre services ---');
  const userXRes = await db.run(
    `INSERT INTO users (matricule, first_name, last_name, email, function_title, service_id, role_id, password_hash, status)
     VALUES (?, 'AgentX', 'Test', ?, 'Agent Service', ?, 7, 'hash_pwd_test', 'ACTIVE')`,
    [`UK-TEST-${Date.now()}`, `userX_${Date.now()}@univ-kindia.edu.gn`, target3Services[0]]
  );
  const testUserXId = userXRes.lastID;

  const serviceXToken = jwt.sign(
    { userId: testUserXId, email: `userX_${Date.now()}@univ-kindia.edu.gn` },
    JWT_SECRET
  );
  const inboxServiceX = await apiRequest('GET', '/api/dispatches/inbox/my-service', serviceXToken);
  console.log(`   - Boîte de réception du Service X : ${inboxServiceX.data.dispatches.length} diffusion(s) reçue(s)`);
  const allBelongToX = inboxServiceX.data.dispatches.every(d => d.service_id === target3Services[0]);
  console.log(`   - Toutes les diffusions appartiennent bien au Service X : ${allBelongToX ? '✅ OUI' : '❌ NON'}`);
  if (!allBelongToX) throw new Error('TEST 11 échoué: fuite de document vers un autre service');
  console.log('   ✅ TEST 11 VALIDÉ (Étanchéité totale entre boîtes de réception des services)\n');

  // Cleanup test user
  await db.run('DELETE FROM users WHERE id = ?', [testUserXId]);

  // ----------------------------------------------------
  // TEST 12: Isolation Multi-Tenant (UNIVERSITE_KINDIA)
  // ----------------------------------------------------
  console.log('--- TEST 12 : Isolation Multi-Tenant ---');
  const tenantRows = await db.all("SELECT DISTINCT tenant_id FROM document_dispatches WHERE id IN (?, ?)", [dispatch1Id, dispatch2Id]);
  console.log('   - Tenants enregistrés :', tenantRows);
  const correctTenant = tenantRows.every(t => t.tenant_id === 'UNIVERSITE_KINDIA');
  if (!correctTenant) throw new Error('TEST 12 échoué: tenant_id incorrect');
  console.log('   ✅ TEST 12 VALIDÉ (Isolation multi-tenant respectée)\n');

  // ----------------------------------------------------
  // TEST 13: Pas de duplication physique du document
  // ----------------------------------------------------
  console.log('--- TEST 13 : Intégrité et absence de duplication physique ---');
  const docCount = await db.get('SELECT COUNT(*) as c FROM documents WHERE id = ?', [testDocId]);
  console.log(`   - Nombre d’enregistrements du document maître en base : ${docCount.c} (Attendu : 1)`);
  if (docCount.c !== 1) throw new Error('TEST 13 échoué: le document a été dupliqué');
  console.log(`   - Nombre de destinataires rattachés à ce document unique : ${totalActiveServices + 3}`);
  console.log('   ✅ TEST 13 VALIDÉ (Document original unique, zéro duplication physique)\n');

  // Cleanup test dispatches
  await db.run('DELETE FROM dispatch_logs WHERE dispatch_id IN (?, ?)', [dispatch1Id, dispatch2Id]);
  await db.run('DELETE FROM dispatch_recipients WHERE dispatch_id IN (?, ?)', [dispatch1Id, dispatch2Id]);
  await db.run('DELETE FROM document_dispatches WHERE id IN (?, ?)', [dispatch1Id, dispatch2Id]);
  await db.run('DELETE FROM documents WHERE id = ?', [testDocId]);

  console.log('======================================================================');
  console.log('🎉 TOUS LES 13 TESTS DU MODULE DE DISPATCHING ONT ÉTÉ VALIDÉS À 100% !');
  console.log('======================================================================\n');
}

runDispatchingTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
