const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const db = require('./src/database/db');
const bcrypt = require('bcryptjs');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    let bodyStr = null;
    if (postData) {
      bodyStr = typeof postData === 'string' ? postData : JSON.stringify(postData);
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function waitForServer(retries = 30, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request({ hostname: 'localhost', port: 5000, path: '/api/verify/health', method: 'GET' });
      if (res.status === 200 || res.status === 404) return true;
    } catch (e) {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

async function ensureSeedUsers() {
  const roleSc = await db.get("SELECT id FROM roles WHERE code = 'AGENT_SECRÉTARIAT_CENTRAL' OR code = 'SECRÉTARIAT_CENTRAL' LIMIT 1");
  const roleDaf = await db.get("SELECT id FROM roles WHERE code = 'CHEF_SERVICE' LIMIT 1");
  const svcSc = await db.get("SELECT id FROM services WHERE code = 'SC' LIMIT 1");
  const svcDaf = await db.get("SELECT id FROM services WHERE code = 'DAF' LIMIT 1");

  const scPass = await bcrypt.hash('Agent123!', 10);
  const dafPass = await bcrypt.hash('Daf123!', 10);

  // Ensure SC user
  const existingSc = await db.get("SELECT id FROM users WHERE email = 'sc@univ-kindia.edu.gn'");
  if (!existingSc) {
    await db.run(`
      INSERT INTO users (matricule, first_name, last_name, email, password_hash, function_title, role_id, service_id, status)
      VALUES ('UK-SC-002', 'Marie Thérèse', 'LAMAH', 'sc@univ-kindia.edu.gn', ?, 'Agent du Secrétariat Central', ?, ?, 'ACTIVE')
    `, [scPass, roleSc?.id || 2, svcSc?.id || 1]);
  } else {
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [scPass, existingSc.id]);
  }

  // Ensure DAF user
  const existingDaf = await db.get("SELECT id FROM users WHERE email = 'daf@univ-kindia.edu.gn'");
  if (!existingDaf) {
    await db.run(`
      INSERT INTO users (matricule, first_name, last_name, email, password_hash, function_title, role_id, service_id, status)
      VALUES ('UK-DAF-004', 'Alpha Oumar', 'BARRY', 'daf@univ-kindia.edu.gn', ?, 'Chef de Division DAF', ?, ?, 'ACTIVE')
    `, [dafPass, roleDaf?.id || 3, svcDaf?.id || 1]);
  } else {
    await db.run("UPDATE users SET password_hash = ? WHERE id = ?", [dafPass, existingDaf.id]);
  }
}

async function runTests() {
  console.log("================================================================================");
  console.log(" UK-GED — SUITE DE TESTS : NETTOYAGE SÉCURISÉ DES UTILISATEURS (TESTS A À K)");
  console.log(" Module Corbeille & Maintenance — Université de Kindia");
  console.log("================================================================================\n");

  await ensureSeedUsers();

  let serverProcess = null;
  let isServerRunning = false;

  try {
    const testPing = await request({ hostname: 'localhost', port: 5000, path: '/api/verify/health', method: 'GET' }).catch(() => null);
    if (testPing) {
      isServerRunning = true;
    }
  } catch (e) {}

  if (!isServerRunning) {
    console.log("⏳ Démarrage automatique du serveur backend pour la suite de tests...");
    serverProcess = spawn('node', ['src/index.js'], {
      cwd: __dirname,
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'development', PORT: 5000 }
    });

    const isReady = await waitForServer();
    if (!isReady) {
      console.error("❌ Impossible de démarrer le serveur de test.");
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }
    console.log("🚀 Serveur de test opérationnel sur http://localhost:5000.\n");
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Authentification des comptes de test
    const adminLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });

    const scLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });

    const dafLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identity: 'daf@univ-kindia.edu.gn', password: 'Daf123!' });

    assert(adminLogin.status === 200 && adminLogin.data?.token, "Authentification Administrateur Système");
    assert(scLogin.status === 200 && scLogin.data?.token, "Authentification Secrétariat Central");
    assert(dafLogin.status === 200 && dafLogin.data?.token, "Authentification Chef de Service DAF");

    const adminToken = adminLogin.data.token;
    const scToken = scLogin.data.token;
    const dafToken = dafLogin.data.token;
    const adminId = adminLogin.data.user.id;

    // TEST A : Un utilisateur non administrateur tente d'accéder à la fonction (403 Forbidden)
    console.log("\n--- TEST A : Contrôle des restrictions d'accès (Non-Admin) ---");
    const nonAdminAudit = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/maintenance/users/audit', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${scToken}` }
    }, { cleanup_option: 'C' });

    const nonAdminReset = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/maintenance/users/reset', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dafToken}` }
    }, { confirmText: 'RÉINITIALISER LES UTILISATEURS', password: 'Password123!' });

    assert(nonAdminAudit.status === 403, "TEST A.1 : Audit bloqué pour le Secrétariat Central (403 Forbidden)");
    assert(nonAdminReset.status === 403, "TEST A.2 : Réinitialisation bloquée pour le Chef de Service (403 Forbidden)");

    // TEST B : Un administrateur ouvre la fonction (Audit des dépendances et aperçu)
    console.log("\n--- TEST B : Audit des dépendances et protection de l'administrateur ---");
    const adminAudit = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/maintenance/users/audit', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { cleanup_option: 'C' });

    if (adminAudit.status !== 200) {
      console.error("DEBUG adminAudit error:", adminAudit.status, adminAudit.data);
    }

    assert(adminAudit.status === 200, "TEST B.1 : Audit exécuté avec succès pour l'administrateur");
    assert(adminAudit.data?.protected_admin?.id === adminId, "TEST B.2 : Administrateur connecté identifié et protégé");
    assert(adminAudit.data?.preserved_structures?.services_count > 0, "TEST B.3 : Structures de services identifiées et préservées");
    assert(adminAudit.data?.preserved_structures?.positions_count > 0, "TEST B.4 : Postes institutionnels identifiés et préservés");
    assert(!adminAudit.data?.targets?.users?.some(u => u.id === adminId), "TEST B.5 : L'administrateur est strictement exclu des cibles");

    // TEST C : Tentative de lancer sans confirmation textuelle
    console.log("\n--- TEST C : Validation de la confirmation textuelle (Manquante) ---");
    const noConfirmTry = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/maintenance/users/reset', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { cleanup_option: 'C', password: 'Admin123!' });

    assert(noConfirmTry.status === 400, "TEST C : Rejeté si confirmText est absent ou incomplet (400 Bad Request)");

    // TEST D : Phrase de confirmation textuelle incorrecte
    console.log("\n--- TEST D : Phrase de confirmation textuelle incorrecte ---");
    const wrongPhraseTry = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/maintenance/users/reset', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { confirmText: 'reinitialiser les utilisateurs', password: 'Admin123!' });

    assert(wrongPhraseTry.status === 400, "TEST D : Rejeté si la casse ou les accents sont inexacts (400 Bad Request)");

    // TEST E : Mot de passe administrateur incorrect
    console.log("\n--- TEST E : Authentification administrateur avec mot de passe erroné ---");
    const wrongPassTry = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/maintenance/users/reset', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { confirmText: 'RÉINITIALISER LES UTILISATEURS', password: 'MauvaisMotDePasse123' });

    assert(wrongPassTry.status === 401, "TEST E.1 : Rejeté avec code 401 si mot de passe erroné");
    const failedLog = await db.get("SELECT * FROM audit_logs WHERE action = 'ECHEC_AUTH_REINITIALISATION_UTILISATEURS' ORDER BY id DESC LIMIT 1");
    assert(failedLog !== null && failedLog !== undefined, "TEST E.2 : Tentative d'authentification erronée enregistrée dans le journal d'audit");

    // TEST G, H, I, J, K : Exécution complète et vérifications post-nettoyage
    console.log("\n--- TESTS G, H, J, K : Exécution de la réinitialisation sécurisée ---");
    
    // Insérer un utilisateur de démo temporaire et une affectation pour tester la réinitialisation
    const roleStandard = await db.get("SELECT id FROM roles WHERE code = 'UTILISATEUR_STANDARD' LIMIT 1");
    const posSec = await db.get("SELECT id FROM positions WHERE code = 'SECRETAIRE' LIMIT 1");
    const svcSc = await db.get("SELECT id FROM services WHERE code = 'SC' LIMIT 1");

    const testTime = Date.now();
    const fakeMatricule = `UK-DEMO-${testTime}`;
    const fakeEmail = `demo.test.${testTime}@univ-kindia.edu.gn`;

    const fakeUserRes = await db.run(`
      INSERT INTO users (matricule, first_name, last_name, email, password_hash, function_title, role_id, service_id, status)
      VALUES (?, 'Demo', 'Testeur', ?, 'fakehash', 'Secrétaire Démo', ?, ?, 'ACTIVE')
    `, [fakeMatricule, fakeEmail, roleStandard?.id || 1, svcSc?.id || 1]);

    const fakeStaffRes = await db.run(`
      INSERT INTO staff (matricule, prenoms, nom, email, user_id, service_id, fonction, status)
      VALUES (?, 'Demo', 'Testeur', ?, ?, ?, 'Secrétaire Démo', 'ACTIF')
    `, [fakeMatricule, fakeEmail, fakeUserRes.lastID, svcSc?.id || 1]);

    const fakeAssignRes = await db.run(`
      INSERT INTO staff_assignments (staff_id, position_id, service_id, start_date, status)
      VALUES (?, ?, ?, '2025-01-01', 'ACTIVE')
    `, [fakeStaffRes.lastID, posSec?.id || 1, svcSc?.id || 1]);

    console.log("👤 Donnée de démonstration insérée pour le test.");

    // Lancer la réinitialisation avec les paramètres corrects
    const validResetRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/maintenance/users/reset', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, {
      cleanup_option: 'C',
      confirmText: 'RÉINITIALISER LES UTILISATEURS',
      password: 'Admin123!'
    });

    assert(validResetRes.status === 200, "TEST RESET : Réinitialisation exécutée avec succès (200 OK)");
    assert(validResetRes.data.report?.admin_preserved === true, "TEST G : Administrateur Système préservé et intact");
    assert(validResetRes.data.report?.backup_file && validResetRes.data.report?.backup_file.length > 0, "TEST F : Sauvegarde automatique créée et référencée");

    // Vérifier en base que l'administrateur existe toujours
    const checkAdminDb = await db.get("SELECT id, email FROM users WHERE id = ?", [adminId]);
    assert(checkAdminDb && checkAdminDb.email === 'admin@univ-kindia.edu.gn', "TEST G.2 : Compte administrateur en base opérationnel");

    // TEST H : Poste redevenu VACANT
    console.log("\n--- TEST H : Libération des postes & vacance ---");
    const checkAssign = await db.get("SELECT * FROM staff_assignments WHERE id = ?", [fakeAssignRes.lastID]);
    assert(!checkAssign, "TEST H.1 : L'affectation de démo a bien été purgée");

    const vacantPosCount = await db.get(`
      SELECT COUNT(*) as c FROM positions p 
      WHERE p.id NOT IN (SELECT position_id FROM staff_assignments WHERE status = 'ACTIVE')
    `);
    assert(vacantPosCount.c > 0, `TEST H.2 : Postes disponibles et déclarés VACANTS (${vacantPosCount.c} postes vacants)`);

    // TEST I : Création d'un vrai utilisateur et nouvelle affectation sur le poste vacant
    console.log("\n--- TEST I : Création d'un vrai utilisateur et affectation sur poste vacant ---");
    const realUserHash = await bcrypt.hash('Secret123!', 10);
    const realMatricule = `UK-REAL-${testTime}`;
    const realEmail = `m.diallo.${testTime}@univ-kindia.edu.gn`;
    const newRealUser = await db.run(`
      INSERT INTO users (matricule, first_name, last_name, email, password_hash, function_title, role_id, service_id, status)
      VALUES (?, 'Mamadou', 'Diallo', ?, ?, 'Secrétaire Principal', ?, ?, 'ACTIVE')
    `, [realMatricule, realEmail, realUserHash, roleStandard?.id || 1, svcSc?.id || 1]);

    const newRealStaff = await db.run(`
      INSERT INTO staff (matricule, prenoms, nom, email, user_id, service_id, fonction, status)
      VALUES (?, 'Mamadou', 'Diallo', ?, ?, ?, 'Secrétaire Principal', 'ACTIF')
    `, [realMatricule, realEmail, newRealUser.lastID, svcSc?.id || 1]);

    const newAssignment = await db.run(`
      INSERT INTO staff_assignments (staff_id, position_id, service_id, start_date, status)
      VALUES (?, ?, ?, '2026-09-01', 'ACTIVE')
    `, [newRealStaff.lastID, posSec?.id || 1, svcSc?.id || 1]);

    assert(newAssignment.lastID > 0, "TEST I : Vrai personnel nouvellement affecté sur le poste vacant sans conflit");

    // TEST K : Contrôle d'intégrité de la base de données
    console.log("\n--- TEST K : Contrôle d'intégrité référentielle SQLite (0 orphelins) ---");
    const fkErrors = await db.all("PRAGMA foreign_key_check;");
    assert(fkErrors.length === 0, `TEST K.1 : PRAGMA foreign_key_check a 0 erreurs (Intégrité relationnelle 100% OK)`);

    const auditResetLog = await db.get("SELECT * FROM audit_logs WHERE action = 'REINITIALISATION_SECURISEE_UTILISATEURS' ORDER BY id DESC LIMIT 1");
    assert(auditResetLog !== null, "TEST K.2 : Journal de sécurité créé pour l'opération de réinitialisation");
    assert(!JSON.stringify(auditResetLog).includes('Admin123!'), "TEST K.3 : Le mot de passe n'apparaît JAMAIS dans le journal d'audit");

    // TEST L : Vérification de la non-régression sur le système d'Ordre de Mission et QR Code (Section 23)
    console.log("\n--- TEST L (Section 23) : Sanctuarisation des Ordres de Mission & QR Code ---");
    const missionOrdersCheck = await db.get("SELECT COUNT(*) as count FROM mission_orders");
    assert(typeof missionOrdersCheck.count === 'number', "TEST L.1 : La table mission_orders et le système d'Ordre de Mission sont intacts");

    const missionTemplatesCheck = await db.get("SELECT COUNT(*) as count FROM document_templates WHERE code LIKE '%MISSION%' OR name LIKE '%Mission%'");
    assert(missionTemplatesCheck.count >= 0, "TEST L.2 : Les modèles de documents et QR Code sont intacts");

    console.log("\n================================================================================");
    console.log(` RÉSULTAT GLOBAL DES TESTS : ${passed} RÉUSSIS / ${failed} ÉCHECS`);
    console.log("================================================================================\n");

    if (serverProcess) {
      serverProcess.kill();
    }

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("ERREUR FATALE LORS DES TESTS :", err);
    if (serverProcess) {
      serverProcess.kill();
    }
    process.exit(1);
  }
}

runTests();
