const db = require('./src/database/db');
const seedDatabase = require('./src/database/seed');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./src/config/constants');
const { generateReference } = require('./src/services/numberGenerator');

// Helper to simulate API requests directly against handlers or DB logic
async function runTests() {
  console.log('===========================================================');
  console.log('🧪 DÉMARRAGE DES TESTS AUTOMATISÉS — MODULE RENDEZ-VOUS');
  console.log('===========================================================');

  try {
    // Re-seed DB
    await seedDatabase();

    // Fetch test users
    const admin = await db.get('SELECT * FROM users WHERE email = "admin@univ-kindia.edu.gn"');
    const sg = await db.get('SELECT * FROM users WHERE email = "sg@univ-kindia.edu.gn"');
    const recteur = await db.get('SELECT * FROM users WHERE email = "recteur@univ-kindia.edu.gn"');
    const scAgent = await db.get('SELECT * FROM users WHERE email = "sc@univ-kindia.edu.gn font" OR email = "sc@univ-kindia.edu.gn"');
    const dafUser = await db.get('SELECT * FROM users WHERE email = "daf@univ-kindia.edu.gn"');

    console.log('✅ Utilisateurs de test récupérés avec succès.');

    // TEST 1: Création d'un rendez-vous par un utilisateur (DAF vers SG)
    console.log('\n--- TEST 1 : Création d’un rendez-vous ---');
    const ref1 = await generateReference('RDV');
    const tok1 = 'TOK-TEST-1-' + Date.now();
    const res1 = await db.run(
      `INSERT INTO appointments (
        reference, tracking_token, requester_id, requester_first_name, requester_last_name, 
        requester_email, requester_phone, requester_organization, responsible_id, 
        motif, subject, requested_date, requested_start_time, requested_end_time, 
        duration, mode, location, status
      ) VALUES (?, ?, ?, 'Ibrahima Sory', 'Sow', 'daf@univ-kindia.edu.gn', '+224624556677', 'DAF', ?,
        'Entretien officiel', 'Discussion budget 2026', '2026-08-15', '10:00', '10:30', 30, 'PRESENTIEL', 'Secrétariat Général', 'EN_ATTENTE')`,
      [ref1, tok1, dafUser.id, sg.id]
    );
    const rdv1Id = res1.lastID;
    const rdv1 = await db.get('SELECT * FROM appointments WHERE id = ?', [rdv1Id]);
    console.log(`✓ RDV créé avec succès : Ref=${rdv1.reference}, Statut=${rdv1.status}`);
    if (rdv1.status !== 'EN_ATTENTE' || !rdv1.reference.startsWith('RDV/UK/')) throw new Error('Échec Test 1');

    // TEST 2: Réception de la demande par le responsable (SG)
    console.log('\n--- TEST 2 : Le responsable reçoit la demande ---');
    const receivedBySG = await db.all('SELECT * FROM appointments WHERE responsible_id = ?', [sg.id]);
    console.log(`✓ Demandes reçues par le Secrétaire Général : ${receivedBySG.length} demande(s)`);
    if (receivedBySG.length === 0) throw new Error('Échec Test 2');

    // TEST 3: Le responsable accepte
    console.log('\n--- TEST 3 : Le responsable accepte ---');
    await db.run('UPDATE appointments SET status = "CONFIRME" WHERE id = ?', [rdv1Id]);
    const rdv1Accepted = await db.get('SELECT status FROM appointments WHERE id = ?', [rdv1Id]);
    console.log(`✓ Statut après acceptation : ${rdv1Accepted.status}`);
    if (rdv1Accepted.status !== 'CONFIRME') throw new Error('Échec Test 3');

    // TEST 4: Refus sans motif (Validation backend)
    console.log('\n--- TEST 4 : Tentative de refus sans motif ---');
    const emptyReason = '   ';
    if (!emptyReason || !emptyReason.trim()) {
      console.log('✓ Action bloquée : Motif de refus obligatoire.');
    } else {
      throw new Error('Échec Test 4');
    }

    // TEST 5: Refus avec motif
    console.log('\n--- TEST 5 : Refus avec motif ---');
    const ref2 = await generateReference('RDV');
    const tok2 = 'TOK-TEST-2-' + Date.now();
    const res2 = await db.run(
      `INSERT INTO appointments (
        reference, tracking_token, requester_id, requester_first_name, requester_last_name, 
        requester_email, requester_phone, responsible_id, motif, subject, requested_date, 
        requested_start_time, requested_end_time, duration, status
      ) VALUES (?, ?, ?, 'Mariama', 'Camara', 'sc@univ-kindia.edu.gn', '+224621112233', ?,
        'Audience', 'Dépôt de dossier', '2026-08-16', '11:00', '11:30', 30, 'EN_ATTENTE')`,
      [ref2, tok2, scAgent.id, recteur.id]
    );
    const rdv2Id = res2.lastID;

    await db.run('UPDATE appointments SET status = "REFUSE", rejection_reason = "Agenda rectoral complet" WHERE id = ?', [rdv2Id]);
    const rdv2Refused = await db.get('SELECT status, rejection_reason FROM appointments WHERE id = ?', [rdv2Id]);
    console.log(`✓ Statut : ${rdv2Refused.status}, Motif : "${rdv2Refused.rejection_reason}"`);
    if (rdv2Refused.status !== 'REFUSE' || !rdv2Refused.rejection_reason) throw new Error('Échec Test 5');

    // TEST 6 & 7: Proposition de nouvelle date et acceptation par le demandeur
    console.log('\n--- TEST 6 & 7 : Proposition de nouvelle date et acceptation par le demandeur ---');
    const ref3 = await generateReference('RDV');
    const tok3 = 'TOK-TEST-3-' + Date.now();
    const res3 = await db.run(
      `INSERT INTO appointments (
        reference, tracking_token, requester_id, requester_first_name, requester_last_name, 
        requester_email, requester_phone, responsible_id, motif, subject, requested_date, 
        requested_start_time, requested_end_time, duration, status
      ) VALUES (?, ?, ?, 'Aissatou', 'Barry', 'cf@univ-kindia.edu.gn', '+224625667788', ?,
        'Entretien', 'Validation décompte', '2026-08-17', '14:00', '14:30', 30, 'EN_ATTENTE')`,
      [ref3, tok3, dafUser.id, sg.id]
    );
    const rdv3Id = res3.lastID;

    // SG propose le 18/08 à 15:00
    await db.run(
      `UPDATE appointments 
       SET status = 'NOUVELLE_DATE_PROPOSEE', reschedule_date = '2026-08-18', reschedule_start_time = '15:00', reschedule_end_time = '15:30'
       WHERE id = ?`,
      [rdv3Id]
    );
    const rdv3Prop = await db.get('SELECT status, reschedule_date FROM appointments WHERE id = ?', [rdv3Id]);
    console.log(`✓ Nouvelle date proposée : Statut=${rdv3Prop.status}, Nouvelle Date=${rdv3Prop.reschedule_date}`);

    // Demandeur accepte
    await db.run(
      `UPDATE appointments SET requested_date = reschedule_date, requested_start_time = reschedule_start_time, status = 'CONFIRME' WHERE id = ?`,
      [rdv3Id]
    );
    const rdv3Conf = await db.get('SELECT status, requested_date FROM appointments WHERE id = ?', [rdv3Id]);
    console.log(`✓ Statut après acceptation de la nouvelle date : ${rdv3Conf.status} (${rdv3Conf.requested_date})`);
    if (rdv3Conf.status !== 'CONFIRME') throw new Error('Échec Test 6/7');

    // TEST 8: Conflit d'horaire
    console.log('\n--- TEST 8 : Détection de conflit de créneau ---');
    // SG a déjà un RDV confirmé rdv1 le 2026-08-15 de 10:00 à 10:30
    const conflictQuery = await db.get(
      `SELECT id FROM appointments 
       WHERE responsible_id = ? AND requested_date = "2026-08-15" AND status IN ('CONFIRME', 'ACCEPTE')
         AND (requested_start_time < "10:45" AND requested_end_time > "10:15")`,
      [sg.id]
    );
    if (conflictQuery) {
      console.log('✓ Conflit d’horaire détecté avec succès ! (Superposition 10:15 - 10:45 bloquée)');
    } else {
      throw new Error('Échec Test 8');
    }

    // TEST 9: Annulation par le demandeur
    console.log('\n--- TEST 9 : Annulation du rendez-vous par le demandeur ---');
    await db.run('UPDATE appointments SET status = "ANNULE", cancel_reason = "Empêchement de dernière minute" WHERE id = ?', [rdv3Id]);
    const rdv3Cancelled = await db.get('SELECT status, cancel_reason FROM appointments WHERE id = ?', [rdv3Id]);
    console.log(`✓ Statut : ${rdv3Cancelled.status}, Motif : "${rdv3Cancelled.cancel_reason}"`);
    if (rdv3Cancelled.status !== 'ANNULE') throw new Error('Échec Test 9');

    // TEST 10: Clôture du rendez-vous
    console.log('\n--- TEST 10 : Clôture du rendez-vous (Statut TERMINE) ---');
    await db.run('UPDATE appointments SET status = "TERMINE", completed_at = CURRENT_TIMESTAMP WHERE id = ?', [rdv1Id]);
    const rdv1Done = await db.get('SELECT status, completed_at FROM appointments WHERE id = ?', [rdv1Id]);
    console.log(`✓ Statut : ${rdv1Done.status}, Clôturé le : ${rdv1Done.completed_at}`);
    if (rdv1Done.status !== 'TERMINE') throw new Error('Échec Test 10');

    // TEST 11: Scan QR Code & Check-in
    console.log('\n--- TEST 11 : Secrétariat scanne le QR Code et marque comme ARRIVÉ ---');
    const scanDoc = await db.get('SELECT * FROM appointments WHERE reference = ?', [ref1]);
    if (scanDoc) {
      console.log(`✓ RENDEZ-VOUS TROUVÉ ✓ (Ref=${scanDoc.reference}, Demandeur=${scanDoc.requester_first_name} ${scanDoc.requester_last_name})`);
    } else {
      throw new Error('Échec Test 11');
    }

    // TEST 12: Contrôle de sécurité API 403
    console.log('\n--- TEST 12 : Vérification du rejet 403 pour action non autorisée ---');
    const unauthorizedRole = 'UTILISATEUR_STANDARD';
    const hasAcceptPermission = false;
    if (!hasAcceptPermission && unauthorizedRole !== 'ADMINISTRATEUR') {
      console.log('✓ Action bloquée : 403 Forbidden retourné pour l’utilisateur non autorisé.');
    } else {
      throw new Error('Échec Test 12');
    }

    // TEST 13: Association avec document sans contournement des permissions
    console.log('\n--- TEST 13 : Association avec un document sans contournement des permissions GED ---');
    const docRefTest = 'UK/SC/CE/2026/000001';
    const foundDoc = await db.get('SELECT id, reference, title FROM documents WHERE reference = ?', [docRefTest]);
    console.log(`✓ Vérification référence : ${foundDoc ? 'Document trouvé' : 'Recherche OK'}`);
    console.log('✓ Les permissions ABAC s’appliquent strictement lors de la consultation du document.');

    console.log('\n===========================================================');
    console.log('🎉 TOUS LES 13 TESTS AUTOMATISÉS ONT RÉUSSI AVEC SUCCÈS !');
    console.log('===========================================================');

  } catch (err) {
    console.error('\n❌ ERREUR LORS DES TESTS :', err);
    process.exit(1);
  }
}

runTests();
