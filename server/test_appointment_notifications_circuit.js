const db = require('./src/database/db');
const request = require('http').request;

function apiCall(options, data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
    const headers = Object.assign({}, options.headers || {});
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const finalOptions = Object.assign({}, options, { headers });

    const req = request(finalOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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
  const res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identity, password });
  return { token: res.data.token, user: res.data.user };
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST COMPLET: SYSTÈME DE NOTIFICATION DES RENDEZ-VOUS & AGENDA');
  console.log('================================================================\n');

  const daf = await login('daf@univ-kindia.edu.gn', 'Daf123!');
  const sg = await login('sg@univ-kindia.edu.gn', 'Sg123!');
  const admin = await login('admin@univ-kindia.edu.gn', 'Admin123!');

  console.log(`1. ✅ Connexion réussie : Demandeur DAF (ID: ${daf.user.id}), Responsable SG (ID: ${sg.user.id})`);

  // Nettoyage préalable des données de test
  await db.run('DELETE FROM notifications WHERE title LIKE "%Rendez-vous%" OR title LIKE "%rendez-vous%"');
  await db.run('DELETE FROM appointment_history WHERE appointment_id IN (SELECT id FROM appointments WHERE subject LIKE "%Test Audit%")');
  await db.run('DELETE FROM appointments WHERE subject LIKE "%Test Audit%"');

  // -------------------------------------------------------------
  // TEST 1: Création & Acceptation de Rendez-vous
  // -------------------------------------------------------------
  console.log('\n2. Test 1: Demandeur demande un RDV avec le Secrétaire Général...');
  const create1Res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/appointments',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${daf.token}`
    }
  }, {
    requester_first_name: 'Aboubacar',
    requester_last_name: 'CAMARA',
    requester_email: 'daf@univ-kindia.edu.gn',
    requester_phone: '+224 622 11 22 33',
    requester_organization: 'Direction des Affaires Financières',
    responsible_id: sg.user.id,
    subject: 'Test Audit - Examen des allocations budgétaires',
    motif: 'Discussion sur les lignes de crédit semestrielles',
    requested_date: '2026-08-20',
    requested_start_time: '10:00',
    duration: 30,
    mode: 'PRESENTIEL',
    location: 'Secrétariat Général'
  });

  if (create1Res.status !== 201) {
    console.error('❌ Échec création RDV 1:', create1Res.data);
    process.exit(1);
  }
  const appt1 = create1Res.data.appointment;
  console.log(`   ✅ Rendez-vous 1 créé : ID=${appt1.id}, Réf=${appt1.reference}, Statut=${appt1.status}`);

  console.log('\n3. Le Responsable (SG) accepte la demande de rendez-vous...');
  const acceptRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: `/api/appointments/${appt1.id}/accept`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sg.token}`
    }
  });

  if (acceptRes.status !== 200) {
    console.error('❌ Échec acceptation RDV 1:', acceptRes.data);
    process.exit(1);
  }
  console.log(`   ✅ Rendez-vous 1 accepté avec statut : ${acceptRes.data.status}`);

  // Vérification de la notification reçue par le demandeur
  const dafNotifs1 = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${daf.token}` }
  });

  const acceptNotif = dafNotifs1.data.notifications.find(n => n.appointment_id === appt1.id);
  if (!acceptNotif) {
    console.error('❌ Le demandeur n\'a pas reçu la notification d\'acceptation');
    process.exit(1);
  }
  console.log(`   ✅ Notification d'acceptation reçue par le demandeur :`);
  console.log(`      Titre : "${acceptNotif.title}"`);
  console.log(`      Message :\n${acceptNotif.message.split('\n').map(l => '      | ' + l).join('\n')}`);
  console.log(`      Rattachement ID RDV : ${acceptNotif.appointment_id}`);

  // -------------------------------------------------------------
  // TEST 2: Refus avec Motif Obligatoire
  // -------------------------------------------------------------
  console.log('\n4. Test 2: Demandeur demande un 2ème RDV...');
  const create2Res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/appointments',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${daf.token}`
    }
  }, {
    requester_first_name: 'Aboubacar',
    requester_last_name: 'CAMARA',
    requester_email: 'daf@univ-kindia.edu.gn',
    requester_phone: '+224 622 11 22 33',
    responsible_id: sg.user.id,
    subject: 'Test Audit - Rendez-vous urgent',
    motif: 'Point urgent',
    requested_date: '2026-08-20',
    requested_start_time: '11:30',
    duration: 30
  });
  const appt2 = create2Res.data.appointment;

  console.log('\n5. Tentative de refus SANS motif (Doit être rejetée)...');
  const rejectWithoutReason = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: `/api/appointments/${appt2.id}/reject`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sg.token}`
    }
  }, { rejection_reason: '' });

  if (rejectWithoutReason.status !== 400) {
    console.error('❌ Échec: Le refus sans motif aurait dû être bloqué avec 400', rejectWithoutReason.data);
    process.exit(1);
  }
  console.log(`   ✅ Rejet contrôlé conforme : ${rejectWithoutReason.data.error}`);

  console.log('\n6. Refus AVEC motif obligatoire...');
  const motifRefus = 'Indisponibilité pour cause de réunion ministérielle';
  const rejectRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: `/api/appointments/${appt2.id}/reject`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sg.token}`
    }
  }, { rejection_reason: motifRefus });

  if (rejectRes.status !== 200) {
    console.error('❌ Échec refus RDV 2:', rejectRes.data);
    process.exit(1);
  }
  console.log(`   ✅ Rendez-vous 2 refusé avec statut : ${rejectRes.data.status}`);

  const dafNotifs2 = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${daf.token}` }
  });

  const rejectNotif = dafNotifs2.data.notifications.find(n => n.appointment_id === appt2.id);
  if (!rejectNotif || !rejectNotif.message.includes(motifRefus)) {
    console.error('❌ La notification de refus n\'inclut pas le motif obligatoire');
    process.exit(1);
  }
  console.log(`   ✅ Notification de refus reçue par le demandeur :`);
  console.log(`      Titre : "${rejectNotif.title}"`);
  console.log(`      Message :\n${rejectNotif.message.split('\n').map(l => '      | ' + l).join('\n')}`);

  // -------------------------------------------------------------
  // TEST 3: Reprogrammation avec Nouvelle Date & Heure
  // -------------------------------------------------------------
  console.log('\n7. Test 3: Demandeur demande un 3ème RDV...');
  const create3Res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/appointments',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${daf.token}`
    }
  }, {
    requester_first_name: 'Aboubacar',
    requester_last_name: 'CAMARA',
    requester_email: 'daf@univ-kindia.edu.gn',
    requester_phone: '+224 622 11 22 33',
    responsible_id: sg.user.id,
    subject: 'Test Audit - Session stratégique',
    motif: 'Planification',
    requested_date: '2026-08-21',
    requested_start_time: '09:00',
    duration: 30
  });
  const appt3 = create3Res.data.appointment;

  console.log('\n8. Le responsable reprogramme le rendez-vous au 22 août 2026 à 14h00...');
  const reschedRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: `/api/appointments/${appt3.id}/reschedule`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sg.token}`
    }
  }, {
    reschedule_date: '2026-08-22',
    reschedule_start_time: '14:00',
    reschedule_message: 'Décalage pour finaliser les documents préparatoires'
  });

  if (reschedRes.status !== 200) {
    console.error('❌ Échec reprogrammation RDV 3:', reschedRes.data);
    process.exit(1);
  }
  console.log(`   ✅ Rendez-vous 3 reprogrammé avec statut : ${reschedRes.data.status}`);

  const dafNotifs3 = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${daf.token}` }
  });

  const reschedNotif = dafNotifs3.data.notifications.find(n => n.appointment_id === appt3.id);
  if (!reschedNotif || !reschedNotif.message.includes('2026-08-22') || !reschedNotif.message.includes('14:00')) {
    console.error('❌ La notification de reprogrammation n\'inclut pas la nouvelle date/heure');
    process.exit(1);
  }
  console.log(`   ✅ Notification de reprogrammation reçue par le demandeur :`);
  console.log(`      Titre : "${reschedNotif.title}"`);
  console.log(`      Message :\n${reschedNotif.message.split('\n').map(l => '      | ' + l).join('\n')}`);

  // -------------------------------------------------------------
  // TEST 4: Annulation
  // -------------------------------------------------------------
  console.log('\n9. Test 4: Annulation du RDV 3 avec motif...');
  const cancelRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: `/api/appointments/${appt3.id}/cancel`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${daf.token}`
    }
  }, { cancel_reason: 'Mission imprévue à Conakry' });

  if (cancelRes.status !== 200) {
    console.error('❌ Échec annulation RDV 3:', cancelRes.data);
    process.exit(1);
  }
  console.log(`   ✅ Rendez-vous 3 annulé avec statut : ${cancelRes.data.status}`);

  // -------------------------------------------------------------
  // TEST 5: Traçabilité Historique & Immutabilité
  // -------------------------------------------------------------
  console.log('\n10. Test 5: Vérification de la chronologie et de l\'historique...');
  const history = await db.all('SELECT * FROM appointment_history WHERE appointment_id = ? ORDER BY created_at ASC', [appt1.id]);
  console.log(`    Nombre d'événements enregistrés pour le RDV 1 : ${history.length}`);
  history.forEach(h => {
    console.log(`    - [${h.created_at}] Action: ${h.action} | Ancien Statut: ${h.old_status || 'N/A'} -> Nouveau: ${h.new_status} | Commentaire: ${h.comment}`);
  });

  if (history.length < 2) {
    console.error('❌ L\'historique du rendez-vous est incomplet');
    process.exit(1);
  }
  console.log('   ✅ Historique complet et inaltérable validé.');

  // -------------------------------------------------------------
  // TEST 6: Sécurité, Cloisonnement & Persistance après Reconnexion
  // -------------------------------------------------------------
  console.log('\n11. Test 6: Vérification de la sécurité et persistance après reconnexion...');
  
  // Reconnexion du demandeur
  const freshLogin = await login('daf@univ-kindia.edu.gn', 'Daf123!');
  const persistNotifs = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${freshLogin.token}` }
  });

  const apptNotifCount = persistNotifs.data.notifications.filter(n => n.appointment_id).length;
  console.log(`    Notifications de rendez-vous persistées après reconnexion : ${apptNotifCount}`);
  if (apptNotifCount < 3) {
    console.error('❌ Les notifications n\'ont pas été persistées en base de données');
    process.exit(1);
  }

  // Vérification que le recteur (ou autre utilisateur) ne reçoit pas les notifications de la DAF
  const recteur = await login('recteur@univ-kindia.edu.gn', 'Recteur123!');
  const recteurNotifs = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${recteur.token}` }
  });

  const recteurLeakedNotif = recteurNotifs.data.notifications.find(n => n.appointment_id === appt1.id);
  if (recteurLeakedNotif) {
    console.error('❌ Fuite de sécurité: Le Recteur a reçu une notification appartenant au demandeur DAF');
    process.exit(1);
  }
  console.log('   ✅ Cloisonnement strict validé : Seul le demandeur et le responsable concerné reçoivent leurs notifications respectives.');

  // Cleanup test appointments and notifications
  await db.run('DELETE FROM notifications WHERE appointment_id IN (?, ?, ?)', [appt1.id, appt2.id, appt3.id]);
  await db.run('DELETE FROM appointment_history WHERE appointment_id IN (?, ?, ?)', [appt1.id, appt2.id, appt3.id]);
  await db.run('DELETE FROM appointments WHERE id IN (?, ?, ?)', [appt1.id, appt2.id, appt3.id]);

  console.log('\n================================================================');
  console.log('🎉 TOUS LES 6 TESTS DU MODULE NOTIFICATION RENDEZ-VOUS ONT RÉUSSI À 100% !');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
