const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');
const { authenticateToken } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { identity, password } = req.body;

  if (!identity || !password) {
    return res.status(400).json({ error: 'Identifiant (email ou matricule) et mot de passe requis.' });
  }

  try {
    const user = await db.get(
      `SELECT u.*, COALESCE(NULLIF(u.titre, ''), st.titre, 'M.') as titre, 
              s.name as service_name, s.code as service_code, r.code as role_code, r.name as role_name
       FROM users u
       LEFT JOIN staff st ON (st.user_id = u.id OR (u.matricule IS NOT NULL AND st.matricule = u.matricule))
       LEFT JOIN services s ON u.service_id = s.id
       JOIN roles r ON u.role_id = r.id
       WHERE (u.email = ? OR u.matricule = ?)`,
      [identity, identity]
    );

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Compte désactivé. Veuillez contacter le Secrétariat Général.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    // Update last_login
    await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Fetch user permissions
    const permissions = await db.all(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [user.role_id]
    );
    const permList = permissions.map(p => p.code);

    const token = jwt.sign(
      { userId: user.id, roleCode: user.role_code, tokenVersion: user.token_version || 1 },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await logAuditAction(user.id, 'LOGIN', 'USER', user.id, req);

    res.json({
      token,
      user: {
        id: user.id,
        user_uid: user.user_uid,
        matricule: user.matricule,
        first_name: user.first_name,
        last_name: user.last_name,
        titre: user.titre || 'M.',
        email: user.email,
        phone: user.phone,
        function_title: user.function_title,
        photo_path: user.photo_path || null,
        service_id: user.service_id,
        service_name: user.service_name,
        service_code: user.service_code,
        role_id: user.role_id,
        role_code: user.role_code,
        role_name: user.role_name,
        must_change_password: user.must_change_password === 1,
        permissions: permList
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion.' });
  }
});

const accountSecurityService = require('../services/accountSecurityService');

// POST /api/auth/forgot-password - Request password recovery (anti-enumeration)
router.post('/forgot-password', async (req, res) => {
  const { identity } = req.body;
  try {
    const result = await accountSecurityService.requestPasswordReset(identity, req);
    res.json(result);
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/reset-password - Reset password using secure token
router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body;
  try {
    const result = await accountSecurityService.verifyAndResetPassword(token, new_password, req);
    res.json(result);
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/force-change-password - Change temporary password on first login
router.post('/force-change-password', authenticateToken, async (req, res) => {
  const { current_temp_password, new_password } = req.body;
  const user = req.user;
  try {
    const result = await accountSecurityService.forceChangeTemporaryPassword(
      user.id,
      current_temp_password,
      new_password,
      req
    );
    res.json(result);
  } catch (err) {
    console.error('Force change password error:', err);
    res.status(err.status || 400).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/quick-accounts - Return currently configured active institutional accounts
router.get('/quick-accounts', async (req, res) => {
  try {
    // 1. Recteur (Priority: Position RECTEUR assignment -> Role RECTEUR -> default)
    const rector = (await db.get(`
      SELECT u.id, u.email, u.first_name, u.last_name, COALESCE(NULLIF(u.titre, ''), st.titre, 'Pr') as titre, p.title as pos_title
      FROM positions p
      JOIN staff_assignments sa ON p.id = sa.position_id AND sa.status = 'ACTIVE'
      JOIN staff st ON sa.staff_id = st.id
      JOIN users u ON st.user_id = u.id
      WHERE (p.code = 'RECTEUR' OR p.title LIKE '%Recteur%') AND u.status = 'ACTIVE'
      LIMIT 1
    `)) || (await db.get(`
      SELECT u.id, u.email, u.first_name, u.last_name, COALESCE(NULLIF(u.titre, ''), st.titre, 'Pr') as titre, 'Recteur' as pos_title
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN staff st ON st.user_id = u.id
      WHERE r.code = 'RECTEUR' AND u.status = 'ACTIVE'
      LIMIT 1
    `));

    // 2. Secrétaire Général
    const sg = (await db.get(`
      SELECT u.id, u.email, u.first_name, u.last_name, COALESCE(NULLIF(u.titre, ''), st.titre, 'Dr') as titre, p.title as pos_title
      FROM positions p
      JOIN staff_assignments sa ON p.id = sa.position_id AND sa.status = 'ACTIVE'
      JOIN staff st ON sa.staff_id = st.id
      JOIN users u ON st.user_id = u.id
      WHERE (p.code = 'SECRETARIAT_GENERAL' OR p.code = 'SG' OR p.title LIKE '%Secrétaire Général%') AND u.status = 'ACTIVE'
      LIMIT 1
    `)) || (await db.get(`
      SELECT u.id, u.email, u.first_name, u.last_name, COALESCE(NULLIF(u.titre, ''), st.titre, 'Dr') as titre, 'Secrétaire Général' as pos_title
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN staff st ON st.user_id = u.id
      WHERE (r.code = 'SECRÉTAIRE_GÉNÉRAL' OR r.code = 'SECRETARIAT_GENERAL') AND u.status = 'ACTIVE'
      LIMIT 1
    `));

    // 3. Secrétariat Central
    const sc = (await db.get(`
      SELECT u.id, u.email, u.first_name, u.last_name, COALESCE(NULLIF(u.titre, ''), st.titre, 'M.') as titre, p.title as pos_title
      FROM positions p
      JOIN staff_assignments sa ON p.id = sa.position_id AND sa.status = 'ACTIVE'
      JOIN staff st ON sa.staff_id = st.id
      JOIN users u ON st.user_id = u.id
      WHERE (p.code LIKE '%SECRETARIAT_CENTRAL%' OR p.code = 'SC') AND u.status = 'ACTIVE'
      LIMIT 1
    `)) || (await db.get(`
      SELECT u.id, u.email, u.first_name, u.last_name, COALESCE(NULLIF(u.titre, ''), st.titre, 'M.') as titre, 'Secrétariat Central' as pos_title
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN staff st ON st.user_id = u.id
      WHERE (r.code = 'SECRÉTARIAT_CENTRAL' OR r.code = 'AGENT_SECRÉTARIAT_CENTRAL' OR u.service_id = 1) AND u.status = 'ACTIVE'
      LIMIT 1
    `));

    // 4. Administrateur Système
    const admin = await db.get(`
      SELECT u.id, u.email, u.first_name, u.last_name, COALESCE(u.titre, 'M.') as titre, 'Administrateur Système' as pos_title
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.code = 'ADMINISTRATEUR' AND u.status = 'ACTIVE'
      LIMIT 1
    `);

    res.json({
      success: true,
      accounts: {
        sc: sc ? { email: sc.email, name: `${sc.titre ? `${sc.titre} ` : ''}${sc.first_name} ${sc.last_name}`.trim(), label: '1. Secrétariat Central', title: sc.pos_title } : { email: 'sc@univ-kindia.edu.gn', label: '1. Secrétariat Central' },
        sg: sg ? { email: sg.email, name: `${sg.titre ? `${sg.titre} ` : ''}${sg.first_name} ${sg.last_name}`.trim(), label: '2. Secrétaire Général', title: sg.pos_title } : { email: 'sg@univ-kindia.edu.gn', label: '2. Secrétaire Général' },
        recteur: rector ? { email: rector.email, name: `${rector.titre ? `${rector.titre} ` : ''}${rector.first_name} ${rector.last_name}`.trim(), label: '3. Recteur', title: rector.pos_title } : { email: 'recteur@univ-kindia.edu.gn', label: '3. Recteur' },
        admin: admin ? { email: admin.email, name: `${admin.titre ? `${admin.titre} ` : ''}${admin.first_name} ${admin.last_name}`.trim(), label: '4. Administrateur', title: admin.pos_title } : { email: 'admin@univ-kindia.edu.gn', label: '4. Administrateur' }
      }
    });
  } catch (err) {
    console.error('Fetch quick accounts error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des comptes préconfigurés.' });
  }
});

module.exports = router;
