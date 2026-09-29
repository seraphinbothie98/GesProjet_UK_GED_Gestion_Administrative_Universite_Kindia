/**
 * Suite de Tests de Non-Régression Post-Réinitialisation (UK-GED)
 * Vérification des 8 critères imposés après réinitialisation des données de démo
 */

const assert = require('assert');
const bcrypt = require('bcryptjs');
const db = require('../database/db');

async function runPostResetTests() {
  console.log('================================================================');
  console.log('  TESTS DE NON-RÉGRESSION POST-RÉINITIALISATION (UK-GED)       ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 8;

  // -------------------------------------------------------------
  // TEST 1 : ADMINISTRATEUR PROTÉGÉ ET OPÉRATIONNEL
  // -------------------------------------------------------------
  console.log('▶ Test 1 : Vérification de l’Administrateur Maître...');
  const admin = await db.get(`
    SELECT u.*, r.code as role_code, r.name as role_name 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    WHERE u.email = 'admin@univ-kindia.edu.gn'
  `);
  assert(admin, "Le compte administrateur doit exister.");
  assert.strictEqual(admin.role_code, 'ADMINISTRATEUR', "Le rôle doit être ADMINISTRATEUR.");
  assert.strictEqual(admin.status, 'ACTIVE', "Le statut doit être ACTIVE.");
  console.log(`  ✅ Administrateur validé : ${admin.email} (ID: ${admin.id}, Nom: ${admin.first_name} ${admin.last_name})`);
  passed++;

  // -------------------------------------------------------------
  // TEST 2 : SERVICES PRÉSERVÉS (100% DE LA STRUCTURE)
  // -------------------------------------------------------------
  console.log('\n▶ Test 2 : Vérification de la présence intégrale des services...');
  const services = await db.all("SELECT id, code, name, status FROM services WHERE status = 'ACTIVE'");
  assert(services.length >= 30, `Les services doivent être conservés (trouvé : ${services.length}).`);
  const serviceCodes = services.map(s => s.code);
  assert(serviceCodes.includes('RECT'), "Service RECT (Rectorat) manquant.");
  assert(serviceCodes.includes('SG'), "Service SG (Secrétariat Général) manquant.");
  assert(serviceCodes.includes('SC'), "Service SC (Secrétariat Central) manquant.");
  assert(serviceCodes.includes('DAF'), "Service DAF manquant.");
  assert(serviceCodes.includes('FS'), "Faculté des Sciences manquante.");
  console.log(`  ✅ ${services.length} services et structures confirmés présents et actifs.`);
  passed++;

  // -------------------------------------------------------------
  // TEST 3 : POSTES PRÉSENTS ET VACANTS
  // -------------------------------------------------------------
  console.log('\n▶ Test 3 : Vérification de la vacance des postes institutionnels...');
  const positions = await db.all("SELECT * FROM positions");
  assert(positions.length >= 25, `Les postes doivent être conservés (trouvé : ${positions.length}).`);
  
  const occupiedPositions = await db.all(`
    SELECT DISTINCT position_id FROM staff_assignments WHERE status = 'ACTIVE'
  `);
  const vacantCount = positions.length - occupiedPositions.length;
  console.log(`  ✅ ${positions.length} postes répertoriés, ${vacantCount} postes déclarés VACANTS et prêts.`);
  assert(vacantCount >= 20, "La grande majorité des postes doit être vacante.");
  passed++;

  // -------------------------------------------------------------
  // TEST 4 : CRÉATION D’UN NOUVEAU PERSONNEL RÉEL & AFFECTATION
  // -------------------------------------------------------------
  console.log('\n▶ Test 4 : Création d’un personnel réel et affectation au poste vacant...');
  const testStaffMatricule = 'UK-SC-REAL-001';
  // Nettoyage préalable si relance
  await db.run("DELETE FROM staff_assignments WHERE staff_id IN (SELECT id FROM staff WHERE matricule = ?)", [testStaffMatricule]);
  await db.run("DELETE FROM staff WHERE matricule = ?", [testStaffMatricule]);
  await db.run("DELETE FROM users WHERE matricule = ?", [testStaffMatricule]);

  const scService = await db.get("SELECT id FROM services WHERE code = 'SC'");
  const scPoste = await db.get("SELECT id FROM positions WHERE code = 'CHEF_SERVICE_SECRETARIAT_CENTRAL' OR code = 'SECRETAIRE' LIMIT 1");

  const staffInsert = await db.run(`
    INSERT INTO staff (matricule, nom, prenoms, fonction, service_id, telephone, email, status)
    VALUES (?, 'DIALLO', 'Mariama Ciré', 'Secrétaire Principale', ?, '+224621998877', 'mariama.diallo@univ-kindia.edu.gn', 'ACTIF')
  `, [testStaffMatricule, scService.id]);
  const newStaffId = staffInsert.lastID;

  // Création de l'affectation sur le poste
  const assignInsert = await db.run(`
    INSERT INTO staff_assignments (staff_id, position_id, service_id, start_date, status, motive, created_by)
    VALUES (?, ?, ?, '2026-09-19', 'ACTIVE', 'Première affectation officielle', ?)
  `, [newStaffId, scPoste.id, scService.id, admin.id]);
  assert(assignInsert.lastID, "L'affectation doit réussir sans erreur.");
  console.log(`  ✅ Nouveau personnel créé (ID: ${newStaffId}) et affecté au poste ID ${scPoste.id} avec succès.`);
  passed++;

  // -------------------------------------------------------------
  // TEST 5 : COMPTE UTILISATEUR & ATTRIBUTION DE RÔLE RBAC
  // -------------------------------------------------------------
  console.log('\n▶ Test 5 : Création du compte utilisateur et vérification du rôle...');
  const scRole = await db.get("SELECT id FROM roles WHERE code = 'AGENT_SECRÉTARIAT_CENTRAL' OR code LIKE '%SECRETARIAT_CENTRAL%' LIMIT 1");
  const hashedPass = await bcrypt.hash('MotDePasseReel2026!', 10);

  const userInsert = await db.run(`
    INSERT INTO users (matricule, first_name, last_name, email, phone, function_title, service_id, role_id, password_hash, status)
    VALUES (?, 'Mariama Ciré', 'DIALLO', 'mariama.diallo@univ-kindia.edu.gn', '+224621998877', 'Secrétaire Principale', ?, ?, ?, 'ACTIVE')
  `, [testStaffMatricule, scService.id, scRole.id, hashedPass]);
  const newUserId = userInsert.lastID;

  // Liaison Staff <-> User
  await db.run("UPDATE staff SET user_id = ? WHERE id = ?", [newUserId, newStaffId]);

  const createdUser = await db.get(`
    SELECT u.*, r.code as role_code, s.code as service_code 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    JOIN services s ON u.service_id = s.id 
    WHERE u.id = ?
  `, [newUserId]);

  assert.strictEqual(createdUser.role_code, 'AGENT_SECRÉTARIAT_CENTRAL');
  assert.strictEqual(createdUser.service_code, 'SC');
  console.log(`  ✅ Compte utilisateur créé (ID: ${newUserId}), rôle RBAC '${createdUser.role_code}' assigné.`);
  passed++;

  // -------------------------------------------------------------
  // TEST 6 : VÉRIFICATION DES PERMISSIONS DE L'ESPACE UTILISATEUR
  // -------------------------------------------------------------
  console.log('\n▶ Test 6 : Contrôle des permissions associées au rôle...');
  const userPermissions = await db.all(`
    SELECT p.code 
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
  `, [scRole.id]);

  assert(userPermissions.length > 0, "L'utilisateur doit posséder des permissions attribuées à son rôle.");
  const permCodes = userPermissions.map(p => p.code);
  assert(permCodes.includes('documents.create') || permCodes.includes('incoming_mail.create') || permCodes.includes('documents.read'), "Permissions documents attendues.");
  console.log(`  ✅ L'utilisateur possède ${userPermissions.length} permissions effectives pour son espace.`);
  passed++;

  // -------------------------------------------------------------
  // TEST 7 : INTÉGRITÉ DES WORKFLOWS & TEMPLATES
  // -------------------------------------------------------------
  console.log('\n▶ Test 7 : Intégrité des règles de cheminement et des modèles de documents...');
  const workflows = await db.all("SELECT * FROM workflow_rules WHERE is_active = 1");
  assert(workflows.length >= 4, "Les règles de workflow doivent être actives.");

  const templates = await db.all("SELECT * FROM document_templates WHERE is_active = 1");
  assert(templates.length >= 15, "Les modèles de documents doivent être disponibles.");
  console.log(`  ✅ ${workflows.length} règles de workflow et ${templates.length} modèles de documents opérationnels.`);
  passed++;

  // -------------------------------------------------------------
  // TEST 8 : CONTRÔLE D'INTÉGRITÉ RELATIONNELLE GLOBALE (ZERO ORPHANS)
  // -------------------------------------------------------------
  console.log('\n▶ Test 8 : Contrôle d’intégrité référentielle globale (0 contraintes violées)...');
  const fkCheck = await db.all("PRAGMA foreign_key_check;");
  assert.strictEqual(fkCheck.length, 0, `Aucune violation de clé étrangère autorisée (trouvé : ${JSON.stringify(fkCheck)})`);

  const orphanStaff = await db.all("SELECT * FROM staff WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)");
  assert.strictEqual(orphanStaff.length, 0, "Aucun staff orphelin.");

  const orphanAssignments = await db.all("SELECT * FROM staff_assignments WHERE staff_id NOT IN (SELECT id FROM staff)");
  assert.strictEqual(orphanAssignments.length, 0, "Aucune affectation orpheline.");

  console.log('  ✅ Intégrité globale confirmée : 0 clé étrangère violée, 0 orphelins, base saine.');
  passed++;

  console.log('\n================================================================');
  console.log(`  RÉSULTAT DES TESTS : ${passed} / ${total} RÉUSSIS AVEC SUCCÈS !`);
  console.log('================================================================\n');

  return { success: true, passed, total };
}

if (require.main === module) {
  runPostResetTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Échec des tests de non-régression :', err);
      process.exit(1);
    });
}

module.exports = runPostResetTests;
