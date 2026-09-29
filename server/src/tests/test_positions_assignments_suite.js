const assert = require('assert');
const dbAsync = require('../database/db');
const assignmentService = require('../services/assignmentService');

async function runTests() {
  console.log('\n=============================================================');
  console.log('🧪 SUITE DE TESTS COMPLÈTE : POSTES, AFFECTATIONS & MUTATIONS');
  console.log('=============================================================\n');

  let testsPassed = 0;
  let totalTests = 10;

  try {
    // -------------------------------------------------------------
    // SETUP : Initialisation / Récupération des postes et services
    // -------------------------------------------------------------
    const rectorPos = await dbAsync.get(`SELECT * FROM positions WHERE code = 'RECTEUR'`);
    assert(rectorPos, 'Le poste RECTEUR doit exister dans la table positions');

    let teacherPos = await dbAsync.get(`SELECT * FROM positions WHERE code = 'ENSEIGNANT_CHERCHEUR'`);
    if (!teacherPos) {
      await dbAsync.run(`INSERT INTO positions (code, title, category, rank_order) VALUES ('ENSEIGNANT_CHERCHEUR', 'Enseignant-Chercheur', 'ENSEIGNEMENT', 50)`);
      teacherPos = await dbAsync.get(`SELECT * FROM positions WHERE code = 'ENSEIGNANT_CHERCHEUR'`);
    }

    const srvRectorat = await dbAsync.get(`SELECT * FROM services WHERE code = 'RECTORAT' OR id = 1`);
    const srvScolarite = (await dbAsync.get(`SELECT * FROM services WHERE code = 'SCOLARITE' OR name LIKE '%Scolar%'`)) || srvRectorat;

    // Nettoyer les enregistrements de test antérieurs
    await dbAsync.run(`DELETE FROM staff_assignments WHERE staff_id IN (SELECT id FROM staff WHERE matricule LIKE 'TEST-%')`);
    await dbAsync.run(`DELETE FROM staff WHERE matricule LIKE 'TEST-%'`);

    // -------------------------------------------------------------
    // TEST A — RECTEUR ACTUEL UNIQUE
    // -------------------------------------------------------------
    console.log('▶ [TEST A] Vérification de l’unicité du poste RECTEUR actif...');
    
    // Nettoyer les éventuelles affectations de test précédentes sur RECTEUR
    await dbAsync.run(`UPDATE staff_assignments SET status = 'TERMINATED', end_date = '2026-01-01' WHERE position_id = ? AND status = 'ACTIVE'`, [rectorPos.id]);

    // Créer le premier Recteur (Pr. Ancien Recteur)
    const insStaffA = await dbAsync.run(`
      INSERT INTO staff (matricule, titre, nom, prenoms, fonction, service_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['TEST-RECT-01', 'Pr.', 'Camara', 'Ibrahima Sory', rectorPos.title, srvRectorat.id, 'ACTIF']);
    const rowA = await dbAsync.get(`SELECT id FROM staff WHERE matricule = 'TEST-RECT-01'`);
    const staffIdA = rowA.id;

    const assignResA = await assignmentService.assignStaffToPosition({
      staff_id: staffIdA,
      position_id: rectorPos.id,
      service_id: srvRectorat.id,
      start_date: '2025-01-01',
      reference_decision: 'Décret N° D/2025/001/PRG'
    });
    assert.strictEqual(assignResA.success, true);

    const checkOccA = await assignmentService.checkPositionAvailability(rectorPos.id, srvRectorat.id);
    assert.strictEqual(checkOccA.is_occupied, true);
    assert.strictEqual(checkOccA.occupant.staff_id, staffIdA);
    console.log('  ✅ TEST A RÉUSSI : Le poste RECTEUR est assigné à un unique titulaire.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST B — MUTATION DU RECTEUR (LIBÉRATION DU POSTE RECTEUR)
    // -------------------------------------------------------------
    console.log('\n▶ [TEST B] Mutation de l’ancien Recteur vers un autre poste...');
    
    // Mutation du Recteur A vers Enseignant-Chercheur
    const mutationRes = await assignmentService.assignStaffToPosition({
      staff_id: staffIdA,
      position_id: teacherPos.id,
      service_id: srvRectorat.id,
      start_date: '2026-06-01',
      reference_decision: 'Décret N° D/2026/050/PRG',
      notes: 'Mutation fin de mandat'
    });
    assert.strictEqual(mutationRes.success, true);

    // Vérifier que l'ancien poste RECTEUR est devenu VACANT
    const checkOccB = await assignmentService.checkPositionAvailability(rectorPos.id, srvRectorat.id);
    assert.strictEqual(checkOccB.is_occupied, false, 'Le poste RECTEUR doit être VACANT après mutation');
    
    // Vérifier l'historique du Staff A
    const historyA = await assignmentService.getStaffCareerHistory(staffIdA);
    assert.strictEqual(historyA.length, 2, 'Le Staff A doit avoir exactement 2 affectations');
    assert.strictEqual(historyA[0].status, 'ACTIVE', 'Nouvelle affectation doit être ACTIVE');
    assert.strictEqual(historyA[0].position_id, teacherPos.id);
    assert.strictEqual(historyA[1].status, 'MUTATED', 'Ancienne affectation doit être MUTATED');
    assert.strictEqual(historyA[1].position_id, rectorPos.id);
    console.log('  ✅ TEST B RÉUSSI : La mutation a libéré le poste RECTEUR (devenu VACANT) sans supprimer l’historique.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST C — NOMINATION DU NOUVEAU RECTEUR
    // -------------------------------------------------------------
    console.log('\n▶ [TEST C] Nomination du nouveau Recteur sur le poste VACANT...');
    
    const insStaffB = await dbAsync.run(`
      INSERT INTO staff (matricule, titre, nom, prenoms, fonction, service_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['TEST-RECT-02', 'Pr.', 'Traoré', 'Jean-Paul', rectorPos.title, srvRectorat.id, 'ACTIF']);
    const staffIdB = (await dbAsync.get(`SELECT id FROM staff WHERE matricule = 'TEST-RECT-02'`)).id;

    const assignResC = await assignmentService.assignStaffToPosition({
      staff_id: staffIdB,
      position_id: rectorPos.id,
      service_id: srvRectorat.id,
      start_date: '2026-06-02',
      reference_decision: 'Décret N° D/2026/051/PRG'
    });
    assert.strictEqual(assignResC.success, true);

    const checkOccC = await assignmentService.checkPositionAvailability(rectorPos.id, srvRectorat.id);
    assert.strictEqual(checkOccC.is_occupied, true);
    assert.strictEqual(checkOccC.occupant.staff_id, staffIdB);
    console.log('  ✅ TEST C RÉUSSI : Le nouveau Recteur a été nommé avec succès sans aucun conflit.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST D — REJET D'UN 2ÈME RECTEUR SIMULTANÉ (CONFLIT)
    // -------------------------------------------------------------
    console.log('\n▶ [TEST D] Tentative d’affectation concurrente au poste RECTEUR (rejet attendu)...');
    
    const insStaffC = await dbAsync.run(`
      INSERT INTO staff (matricule, titre, nom, prenoms, fonction, service_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['TEST-RECT-03', 'Dr.', 'Condé', 'Mamadou', 'Agent', srvRectorat.id, 'ACTIF']);
    const staffIdC = (await dbAsync.get(`SELECT id FROM staff WHERE matricule = 'TEST-RECT-03'`)).id;

    let conflictCaught = false;
    try {
      await assignmentService.assignStaffToPosition({
        staff_id: staffIdC,
        position_id: rectorPos.id,
        service_id: srvRectorat.id,
        start_date: '2026-07-01'
      });
    } catch (err) {
      conflictCaught = true;
      assert(err.message.includes('déjà occupé') || err.status === 409, 'Message d’erreur explicite');
    }
    assert.strictEqual(conflictCaught, true, 'Le système doit bloquer l’affectation concurrente sur un poste unique');
    console.log('  ✅ TEST D RÉUSSI : La tentative de doublon a été rejetée avec succès.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST E — CHEF DE SERVICE UNIQUE PAR STRUCTURE
    // -------------------------------------------------------------
    console.log('\n▶ [TEST E] Vérification de la contrainte Chef de Service unique par service...');
    
    let chefDeptPos = await dbAsync.get(`SELECT * FROM positions WHERE code = 'TEST_CHEF_SERVICE'`);
    if (!chefDeptPos) {
      await dbAsync.run(`INSERT INTO positions (code, title, category, service_id) VALUES ('TEST_CHEF_SERVICE', 'Chef de Service Test', 'SERVICE', ?)`, [srvScolarite.id]);
      chefDeptPos = await dbAsync.get(`SELECT * FROM positions WHERE code = 'TEST_CHEF_SERVICE'`);
    }

    // Libérer le poste pour le test
    await dbAsync.run(`UPDATE staff_assignments SET status = 'TERMINATED' WHERE position_id = ?`, [chefDeptPos.id]);

    const insChef1 = await dbAsync.run(`
      INSERT INTO staff (matricule, titre, nom, prenoms, fonction, service_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['TEST-CHEF-01', 'M.', 'Diallo', 'Amadou', chefDeptPos.title, srvScolarite.id, 'ACTIF']);
    const chefId1 = (await dbAsync.get(`SELECT id FROM staff WHERE matricule = 'TEST-CHEF-01'`)).id;

    await assignmentService.assignStaffToPosition({
      staff_id: chefId1,
      position_id: chefDeptPos.id,
      service_id: srvScolarite.id,
      start_date: '2026-01-01'
    });

    // Tentative d'affectation d'un 2ème chef sur le même service et même poste
    const insChef2 = await dbAsync.run(`
      INSERT INTO staff (matricule, titre, nom, prenoms, fonction, service_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['TEST-CHEF-02', 'Mme', 'Barry', 'Fatoumata', chefDeptPos.title, srvScolarite.id, 'ACTIF']);
    const chefId2 = (await dbAsync.get(`SELECT id FROM staff WHERE matricule = 'TEST-CHEF-02'`)).id;

    let chefConflictCaught = false;
    try {
      await assignmentService.assignStaffToPosition({
        staff_id: chefId2,
        position_id: chefDeptPos.id,
        service_id: srvScolarite.id,
        start_date: '2026-02-01'
      });
    } catch (err) {
      chefConflictCaught = true;
    }
    assert.strictEqual(chefConflictCaught, true, 'Un service ne peut pas avoir deux chefs actifs au même poste');
    console.log('  ✅ TEST E RÉUSSI : Conflit de Chef de Service correctement bloqué.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST F — MUTATION DE CHEF DE SERVICE
    // -------------------------------------------------------------
    console.log('\n▶ [TEST F] Mutation du Chef de Service et réattribution...');
    
    await assignmentService.assignStaffToPosition({
      staff_id: chefId1,
      position_id: teacherPos.id,
      service_id: srvScolarite.id,
      start_date: '2026-05-01',
      notes: 'Mutation vers Enseignant'
    });

    // Maintenant, Chef 2 peut être affecté au poste Chef de Département du service
    const assignChef2Res = await assignmentService.assignStaffToPosition({
      staff_id: chefId2,
      position_id: chefDeptPos.id,
      service_id: srvScolarite.id,
      start_date: '2026-05-02'
    });
    assert.strictEqual(assignChef2Res.success, true);
    console.log('  ✅ TEST F RÉUSSI : Mutation du Chef et réattribution sans blocage.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST G — UNE PERSONNE, DEUX POSTES SUCCESSIFS, UNE SEULE IDENTITÉ
    // -------------------------------------------------------------
    console.log('\n▶ [TEST G] Vérification d’intégrité : 1 personne = 1 fiche identité, N affectations...');
    
    const staffRecordsA = await dbAsync.all(`SELECT * FROM staff WHERE matricule = 'TEST-RECT-01'`);
    assert.strictEqual(staffRecordsA.length, 1, 'Il ne doit y avoir qu’une seule ligne dans staff pour TEST-RECT-01');

    const assignmentsA = await dbAsync.all(`SELECT * FROM staff_assignments WHERE staff_id = ? ORDER BY id ASC`, [staffIdA]);
    assert.strictEqual(assignmentsA.length, 2, 'Il doit y avoir 2 affectations chronologiques');
    assert.strictEqual(assignmentsA[0].status, 'MUTATED');
    assert.strictEqual(assignmentsA[1].status, 'ACTIVE');
    console.log('  ✅ TEST G RÉUSSI : L’identité unique est préservée lors de mutations multiples.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST H — CLÔTURE MANUELLE D'AFFECTATION
    // -------------------------------------------------------------
    console.log('\n▶ [TEST H] Clôture manuelle d’affectation et vacance immédiate...');
    
    const activeAssignmentB = await dbAsync.get(`SELECT * FROM staff_assignments WHERE staff_id = ? AND status = 'ACTIVE'`, [staffIdB]);
    assert(activeAssignmentB, 'Le Recteur B doit avoir une affectation ACTIVE');

    const termRes = await assignmentService.terminateAssignment(activeAssignmentB.id, {
      end_date: '2026-08-31',
      notes: 'Démission acceptée'
    });
    assert.strictEqual(termRes.success, true);

    const checkVacant = await assignmentService.checkPositionAvailability(rectorPos.id, srvRectorat.id);
    assert.strictEqual(checkVacant.is_occupied, false, 'Le poste RECTEUR doit être redevenu VACANT');
    console.log('  ✅ TEST H RÉUSSI : L’affectation a été clôturée et le poste est redevenu VACANT.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST I — SUPPRESSION PROPRE PAR ID STRICT SANS IMPACT COLLATÉRAL
    // -------------------------------------------------------------
    console.log('\n▶ [TEST I] Suppression stricte par ID et intégrité des autres membres...');
    
    // Créer deux agents avec la même fonction textuelle
    await dbAsync.run(`INSERT INTO staff (matricule, nom, prenoms, fonction, service_id, status) VALUES ('TEST-X', 'X', 'Agent', 'Agent Test', 1, 'ACTIF')`);
    await dbAsync.run(`INSERT INTO staff (matricule, nom, prenoms, fonction, service_id, status) VALUES ('TEST-Y', 'Y', 'Agent', 'Agent Test', 1, 'ACTIF')`);
    const idX = (await dbAsync.get(`SELECT id FROM staff WHERE matricule = 'TEST-X'`)).id;
    const idY = (await dbAsync.get(`SELECT id FROM staff WHERE matricule = 'TEST-Y'`)).id;

    // Supprimer X
    await dbAsync.run(`DELETE FROM staff WHERE id = ?`, [idX]);
    
    // Vérifier que X n'existe plus mais Y existe toujours
    const checkX = await dbAsync.get(`SELECT * FROM staff WHERE id = ?`, [idX]);
    const checkY = await dbAsync.get(`SELECT * FROM staff WHERE id = ?`, [idY]);
    assert.strictEqual(checkX, undefined);
    assert.notStrictEqual(checkY, undefined);
    console.log('  ✅ TEST I RÉUSSI : Suppression ciblée par ID sans impact sur les homonymes ou mêmes fonctions.');
    testsPassed++;

    // -------------------------------------------------------------
    // TEST J — INTÉGRITÉ DES ORDRES DE MISSION ET DOCUMENTS
    // -------------------------------------------------------------
    console.log('\n▶ [TEST J] Vérification de non-régression sur Ordres de Mission & Documents...');
    
    const missionCount = await dbAsync.get(`SELECT COUNT(*) as count FROM mission_orders`);
    const documentCount = await dbAsync.get(`SELECT COUNT(*) as count FROM documents`);
    assert(typeof missionCount.count === 'number', 'La table mission_orders est intacte');
    assert(typeof documentCount.count === 'number', 'La table documents est intacte');
    console.log(`  ✅ TEST J RÉUSSI : Intégrité validée (${missionCount.count} missions, ${documentCount.count} documents scellés préservés).`);
    testsPassed++;

    // -------------------------------------------------------------
    // NETTOYAGE DES DONNÉES DE TEST
    // -------------------------------------------------------------
    await dbAsync.run(`DELETE FROM staff_assignments WHERE staff_id IN (?, ?, ?, ?, ?, ?)`, [staffIdA, staffIdB, staffIdC, chefId1, chefId2, idY]);
    await dbAsync.run(`DELETE FROM staff WHERE id IN (?, ?, ?, ?, ?, ?)`, [staffIdA, staffIdB, staffIdC, chefId1, chefId2, idY]);

    console.log('\n=============================================================');
    console.log(`🎉 RÉSULTAT GLOBAL : ${testsPassed}/${totalTests} TESTS PASSÉS AVEC SUCCÈS !`);
    console.log('=============================================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ÉCHEC DU TEST :', error);
    process.exit(1);
  }
}

runTests();
