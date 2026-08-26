/**
 * Automated Test Suite: User Account Security, Credentials & Administrative Reset
 * Tests self-service identifier updates, password policy, session revocation,
 * immutable technical UID preservation, forgot password tokens, and audit trails.
 */

const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const accountSecurityService = require('../services/accountSecurityService');
const { JWT_SECRET } = require('../config/constants');

async function runTests() {
  console.log('=== DÉBUT DES TESTS : SÉCURITÉ DES COMPTES ET IDENTIFIANTS UK-GED ===\n');

  // Setup test users
  const adminUser = await db.get(`
    SELECT u.*, r.code as role_code, s.code as service_code 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    LEFT JOIN services s ON u.service_id = s.id 
    WHERE r.code = 'ADMINISTRATEUR'
    LIMIT 1
  `);

  assert(adminUser, 'Admin user must exist');
  adminUser.permissions = ['users.reset_password', 'users.manage_sessions', 'users.update'];

  // Create a dedicated test user
  const initialPassword = 'UserInitial123!';
  const initialHash = await bcrypt.hash(initialPassword, 10);
  const testUserUid = accountSecurityService.generateUserUid();
  const testMatricule = `MAT-SEC-${Date.now()}`;
  const testEmail = `agent.sec.${Date.now()}@univ-kindia.edu.gn`;

  const chefRole = await db.get("SELECT id, code FROM roles WHERE code = 'CHEF_SERVICE'");
  const srv = await db.get("SELECT id, code FROM services WHERE code = 'SC'");

  const insertRes = await db.run(`
    INSERT INTO users (user_uid, matricule, first_name, last_name, email, phone, function_title, service_id, role_id, password_hash, status, token_version)
    VALUES (?, ?, 'Sékou', 'Camara', ?, '+224622000000', 'Chef de Section', ?, ?, ?, 'ACTIVE', 1)
  `, [testUserUid, testMatricule, testEmail, srv.id, chefRole.id, initialHash]);

  const testUserId = insertRes.lastID;
  console.log(`[TEST SETUP] Utilisateur de test créé (ID: ${testUserId}, UID: ${testUserUid}, Matricule: ${testMatricule})`);

  // Create a document linked to this user to test immutable relation preservation
  const docRes = await db.run(`
    INSERT INTO documents (reference, title, document_type, status, created_by, current_user_id, current_service_id)
    VALUES (?, 'Document Test Identifiant Immuable', 'LETTRE', 'DRAFT', ?, ?, ?)
  `, [`DOC-SEC-${Date.now()}`, testUserId, testUserId, srv.id]);
  const docId = docRes.lastID;

  const mockReq = { headers: { 'user-agent': 'TestRunner/1.0' }, socket: { remoteAddress: '127.0.0.1' } };

  // ----------------------------------------------------
  // TEST 1: Password Strength Validator
  // ----------------------------------------------------
  console.log('\n--- 1. Validation de la Politique de Mots de Passe ---');
  const weak1 = accountSecurityService.validatePasswordStrength('short');
  assert.strictEqual(weak1.valid, false, 'Doit rejeter un mot de passe de moins de 8 caractères');

  const weak2 = accountSecurityService.validatePasswordStrength('alllowercase123!');
  assert.strictEqual(weak2.valid, false, 'Doit rejeter sans majuscule');

  const weak3 = accountSecurityService.validatePasswordStrength('ALLUPPERCASE123!');
  assert.strictEqual(weak3.valid, false, 'Doit rejeter sans minuscule');

  const weak4 = accountSecurityService.validatePasswordStrength('NoSpecialChar123');
  assert.strictEqual(weak4.valid, false, 'Doit rejeter sans caractère spécial');

  const strong = accountSecurityService.validatePasswordStrength('Kindia@2026!Sec');
  assert.strictEqual(strong.valid, true, 'Doit accepter un mot de passe conforme');
  console.log('✓ Politique de sécurité des mots de passe validée.');

  // ----------------------------------------------------
  // TEST 2: Self-Service Password Change
  // ----------------------------------------------------
  console.log('\n--- 2. Modification du Mot de Passe en Libre-Service ---');
  // Fails with wrong current password
  let errCatched = false;
  try {
    await accountSecurityService.changePassword(testUserId, 'WrongPass123!', 'NewKindiaPass@2026!', mockReq);
  } catch (err) {
    errCatched = true;
  }
  assert(errCatched, 'Doit échouer avec un mauvais mot de passe actuel');

  // Succeeds with correct current password
  const newPass = 'MyNewKindiaSecret@2026!';
  const changeRes = await accountSecurityService.changePassword(testUserId, initialPassword, newPass, mockReq);
  assert(changeRes.success, 'La modification du mot de passe doit réussir');
  assert(changeRes.token, 'Doit renvoyer un nouveau token JWT rafraîchi');

  // Verify bcrypt hash matches new password
  const updatedUserDb = await db.get('SELECT password_hash, token_version FROM users WHERE id = ?', [testUserId]);
  const isMatchNew = await bcrypt.compare(newPass, updatedUserDb.password_hash);
  assert(isMatchNew, 'Le nouveau hash bcrypt doit correspondre');
  assert.strictEqual(updatedUserDb.token_version, 2, 'token_version doit être incrémenté à 2');
  console.log('✓ Modification libre-service du mot de passe validée avec incrémentation du token_version.');

  // ----------------------------------------------------
  // TEST 3: Self-Service Identifier Change & Immutable Data Preservation
  // ----------------------------------------------------
  console.log('\n--- 3. Modification de l’Identifiant & Préservation des Relations ---');
  const newMatricule = `MAT-MODIFIED-${Date.now()}`;
  const newEmail = `sekou.camara.new.${Date.now()}@univ-kindia.edu.gn`;

  const idChangeRes = await accountSecurityService.updateIdentifier(
    testUserId,
    newPass,
    { newEmail, newMatricule },
    mockReq
  );
  assert(idChangeRes.success, 'La modification de l’identifiant doit réussir');
  assert.strictEqual(idChangeRes.user.matricule, newMatricule, 'Le matricule doit être mis à jour');
  assert.strictEqual(idChangeRes.user.email, newEmail, 'L’email doit être mis à jour');

  // Verify internal immutable technical UID and relations remain intact
  const verifyUser = await db.get('SELECT id, user_uid, matricule, email FROM users WHERE id = ?', [testUserId]);
  assert.strictEqual(verifyUser.id, testUserId, 'L’identifiant primaire technique id doit être strictement identique');
  assert.strictEqual(verifyUser.user_uid, testUserUid, 'L’identifiant unique user_uid doit être strictement immuable');

  // Check document association
  const docCheck = await db.get('SELECT created_by, current_user_id FROM documents WHERE id = ?', [docId]);
  assert.strictEqual(docCheck.created_by, testUserId, 'Le créateur du document reste associé à l’utilisateur');
  assert.strictEqual(docCheck.current_user_id, testUserId, 'Le détenteur du document reste associé à l’utilisateur');
  console.log('✓ Préservation intégrale des identifiants immuables et des documents après modification d’identifiant.');

  // ----------------------------------------------------
  // TEST 4: Forgot Password Flow (Generic response + Token verification)
  // ----------------------------------------------------
  console.log('\n--- 4. Procédure "Mot de passe oublié" & Jeton Sécurisé ---');
  const forgotRes = await accountSecurityService.requestPasswordReset(newEmail, mockReq);
  assert(forgotRes.success, 'La demande de réinitialisation doit réussir');
  assert(forgotRes.resetToken, 'En environnement de test, le token temporaire est généré');

  // Non-existent email gives same generic message (anti-enumeration)
  const fakeForgot = await accountSecurityService.requestPasswordReset('fake.nonexistent@univ-kindia.edu.gn', mockReq);
  assert.strictEqual(fakeForgot.success, true);
  assert.strictEqual(fakeForgot.resetToken, undefined, 'Pas de token pour utilisateur inexistant');

  // Execute reset with valid token
  const postResetPass = 'ResetKindiaSecurePass@2026!';
  const resetExecRes = await accountSecurityService.verifyAndResetPassword(forgotRes.resetToken, postResetPass, mockReq);
  assert(resetExecRes.success, 'La réinitialisation par jeton doit réussir');

  // Re-using token must fail
  let reuseFailed = false;
  try {
    await accountSecurityService.verifyAndResetPassword(forgotRes.resetToken, 'AnotherPass@123!', mockReq);
  } catch (err) {
    reuseFailed = true;
  }
  assert(reuseFailed, 'Un jeton de réinitialisation déjà utilisé doit être rejeté');
  console.log('✓ Flux "Mot de passe oublié" validé avec jeton à usage unique.');

  // ----------------------------------------------------
  // TEST 5: Administrative Reset Password
  // ----------------------------------------------------
  console.log('\n--- 5. Réinitialisation par l’Administrateur & Mot de Passe Temporaire ---');
  const adminResetRes = await accountSecurityService.adminResetPassword(adminUser, testUserId, {}, mockReq);
  assert(adminResetRes.success, 'Le reset admin doit réussir');
  assert(adminResetRes.temporaryPassword, 'Un mot de passe temporaire doit être généré');

  // Verify target user state
  const targetUserDb = await db.get('SELECT must_change_password, token_version FROM users WHERE id = ?', [testUserId]);
  assert.strictEqual(targetUserDb.must_change_password, 1, 'must_change_password doit être activé à 1');
  console.log(`✓ Réinitialisation admin validée (Mot de passe temporaire: ${adminResetRes.temporaryPassword}).`);

  // ----------------------------------------------------
  // TEST 6: First Login Forced Password Change
  // ----------------------------------------------------
  console.log('\n--- 6. Changement Obligatoire lors de la Première Connexion ---');
  const permanentPass = 'FinalKindiaPermanent@2026!';
  const forceRes = await accountSecurityService.forceChangeTemporaryPassword(
    testUserId,
    adminResetRes.temporaryPassword,
    permanentPass,
    mockReq
  );
  assert(forceRes.success, 'Le forçage de mot de passe doit réussir');

  const finalUserDb = await db.get('SELECT must_change_password FROM users WHERE id = ?', [testUserId]);
  assert.strictEqual(finalUserDb.must_change_password, 0, 'must_change_password doit être réinitialisé à 0');
  console.log('✓ Forçage de mot de passe à la première connexion validé.');

  // ----------------------------------------------------
  // TEST 7: Session Invalidation & Token Revocation
  // ----------------------------------------------------
  console.log('\n--- 7. Invalidation des Sessions Actives & Révocation de Tokens ---');
  const currentTokenVersion = (await db.get('SELECT token_version FROM users WHERE id = ?', [testUserId])).token_version;
  
  // Create an old JWT with an outdated token_version
  const outdatedJwt = jwt.sign(
    { userId: testUserId, roleCode: 'CHEF_SERVICE', tokenVersion: currentTokenVersion - 1 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Simulate token revocation
  await accountSecurityService.revokeSessions(testUserId, adminUser, mockReq);
  const latestTokenVersion = (await db.get('SELECT token_version FROM users WHERE id = ?', [testUserId])).token_version;
  assert(latestTokenVersion > currentTokenVersion, 'Le token_version doit avoir augmenté');
  console.log('✓ Révocation globale des sessions validée.');

  // ----------------------------------------------------
  // TEST 8: Zero Plaintext Passwords in Audit Logs
  // ----------------------------------------------------
  console.log('\n--- 8. Vérification de l’Intégrité du Journal d’Audit ---');
  const logs = await db.all('SELECT * FROM audit_logs WHERE user_id = ? OR (entity_type = "USER" AND entity_id = ?)', [testUserId, testUserId]);
  assert(logs.length > 0, 'Des traces d’audit doivent avoir été enregistrées');

  for (const log of logs) {
    const detailsStr = log.metadata || '';
    assert(!detailsStr.includes(initialPassword), 'Le mot de passe initial ne doit jamais apparaître en clair dans les logs');
    assert(!detailsStr.includes(newPass), 'Le mot de passe modifié ne doit jamais apparaître en clair dans les logs');
    assert(!detailsStr.includes(permanentPass), 'Le mot de passe permanent ne doit jamais apparaître en clair dans les logs');
  }
  console.log(`✓ ${logs.length} entrées d'audit vérifiées : AUCUN mot de passe en clair dans le journal.`);

  console.log('\n======================================================');
  console.log('TOUS LES TESTS DE SÉCURITÉ DES COMPTES ONT RÉUSSI (8/8) !');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ ÉCHEC DU TEST :', err);
  process.exit(1);
});
