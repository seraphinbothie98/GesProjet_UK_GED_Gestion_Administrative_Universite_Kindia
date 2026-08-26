const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const accountSecurityService = require('../services/accountSecurityService');
const { logAuditAction } = require('../middleware/audit');

// GET /api/account/me - Current user full account details and security status
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const securityInfo = await accountSecurityService.getSecurityInfo(user.id);
    
    res.json({
      user: {
        ...user,
        user_uid: securityInfo.user_uid,
        must_change_password: securityInfo.must_change_password,
        password_changed_at: securityInfo.password_changed_at,
        token_version: securityInfo.token_version
      }
    });
  } catch (err) {
    console.error('Fetch account profile error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement du profil.' });
  }
});

// PUT /api/account/profile - Update personal profile information
router.put('/profile', authenticateToken, async (req, res) => {
  const { phone, function_title } = req.body;
  const user = req.user;

  try {
    const updates = [];
    const params = [];

    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }
    if (function_title !== undefined) {
      updates.push('function_title = ?');
      params.push(function_title);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(user.id);

    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    await logAuditAction(user.id, 'UPDATE_PROFILE', 'USER', user.id, req, { phone, function_title });

    const updated = await db.get(
      `SELECT u.id, u.user_uid, u.matricule, u.first_name, u.last_name, u.email, u.phone, u.function_title,
              u.service_id, u.role_id, u.status, s.name as service_name, r.name as role_name, r.code as role_code
       FROM users u
       LEFT JOIN services s ON u.service_id = s.id
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [user.id]
    );

    res.json({ success: true, message: 'Profil mis à jour avec succès.', user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil.' });
  }
});

// PUT /api/account/identifier - Change login identifier (matricule / email) with current password
router.put('/identifier', authenticateToken, async (req, res) => {
  const { current_password, new_email, new_matricule } = req.body;
  const user = req.user;

  try {
    const result = await accountSecurityService.updateIdentifier(
      user.id,
      current_password,
      { newEmail: new_email, newMatricule: new_matricule },
      req
    );
    res.json(result);
  } catch (err) {
    console.error('Update identifier error:', err);
    res.status(err.status || 400).json({ error: err.message });
  }
});

// PUT /api/account/password - Change user password
router.put('/password', authenticateToken, async (req, res) => {
  const { current_password, new_password } = req.body;
  const user = req.user;

  try {
    const result = await accountSecurityService.changePassword(
      user.id,
      current_password,
      new_password,
      req
    );
    res.json(result);
  } catch (err) {
    console.error('Change password error:', err);
    res.status(err.status || 400).json({ error: err.message });
  }
});

// POST /api/account/revoke-other-sessions - Revoke other active sessions
router.post('/revoke-other-sessions', authenticateToken, async (req, res) => {
  const user = req.user;
  try {
    const result = await accountSecurityService.revokeSessions(user.id, user, req);
    
    // Re-issue a fresh token for current session with the new token_version
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');
    const newToken = jwt.sign(
      { userId: user.id, roleCode: user.role_code, tokenVersion: result.tokenVersion },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Toutes les autres sessions actives ont été déconnectées.',
      token: newToken
    });
  } catch (err) {
    console.error('Revoke sessions error:', err);
    res.status(500).json({ error: 'Erreur lors de la déconnexion des sessions.' });
  }
});

module.exports = router;
