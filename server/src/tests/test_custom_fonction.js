const assert = require('assert');
const db = require('../database/db');
const assignmentService = require('../services/assignmentService');

async function testCustomFonction() {
  console.log('🧪 TEST: Vérification de la saisie manuelle du Poste / Fonction officielle');
  
  // 1. Create a dummy staff with custom fonction
  const matricule = 'TEST-CUST-' + Date.now();
  const customFonction = 'Directeur des Systèmes d’Information';
  
  const ins = await db.run(
    'INSERT INTO staff (matricule, nom, prenoms, titre, fonction, status) VALUES (?, ?, ?, ?, ?, ?)',
    [matricule, 'TESTNOM', 'TestPrenom', 'M.', customFonction, 'ACTIF']
  );
  const staffId = ins.lastID;
  
  // 2. Call assignStaffToPosition with custom fonction
  const defPos = await db.get("SELECT id FROM positions WHERE code = 'AGENT_ADMINISTRATIF' LIMIT 1");
  await assignmentService.assignStaffToPosition({
    staffId,
    positionId: defPos.id,
    fonction: customFonction,
    motive: 'Test custom fonction'
  });
  
  // 3. Verify in staff table
  const staffAfter = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
  console.log('  Staff fonction enregistré:', staffAfter.fonction);
  assert.strictEqual(staffAfter.fonction, customFonction, 'La fonction personnalisée doit être conservée');
  
  // 4. Update with a new custom fonction
  const updatedFonction = 'Responsable Cellule Assurance Qualité';
  await assignmentService.assignStaffToPosition({
    staffId,
    positionId: defPos.id,
    fonction: updatedFonction,
    motive: 'Mise à jour fiche personnel'
  });
  
  const staffUpdated = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
  console.log('  Staff fonction mis à jour:', staffUpdated.fonction);
  assert.strictEqual(staffUpdated.fonction, updatedFonction, 'La nouvelle fonction personnalisée doit être conservée');

  // Clean up
  await db.run('DELETE FROM staff_assignments WHERE staff_id = ?', [staffId]);
  await db.run('DELETE FROM staff WHERE id = ?', [staffId]);

  console.log('✅ TEST RÉUSSI : La fonction saisie manuellement est conservée et n’est plus écrasée par "Agent Administratif" !');
}

testCustomFonction().catch(err => {
  console.error('❌ Erreur de test:', err);
  process.exit(1);
});
