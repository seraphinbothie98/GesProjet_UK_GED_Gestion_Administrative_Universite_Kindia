const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const accountSecurityService = require('../services/accountSecurityService');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR } = require('../config/constants');

const avatarsDir = path.join(UPLOAD_DIR, 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const userId = req.user?.id || 'account';
    cb(null, `avatar_${userId}_${Date.now()}_${Math.round(Math.random() * 1000)}${ext}`);
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier invalide. Seules les images (JPG, PNG, WEBP, GIF) sont acceptées.'), false);
    }
  }
});

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

// POST /api/account/photo - Upload profile photo for current user
router.post('/photo', authenticateToken, uploadAvatar.single('photo'), async (req, res) => {
  const userId = req.user.id;
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner un fichier image valide.' });
  }

  try {
    const user = await db.get('SELECT id, first_name, last_name, matricule, photo_path FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    const photoUrl = `/uploads/avatars/${req.file.filename}`;

    if (user.photo_path && user.photo_path.startsWith('/uploads/avatars/')) {
      const oldFilename = path.basename(user.photo_path);
      const oldFilePath = path.join(avatarsDir, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        try { fs.unlinkSync(oldFilePath); } catch (e) {}
      }
    }

    await db.run('UPDATE users SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [photoUrl, userId]);
    await db.run('UPDATE staff SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? OR (matricule = ? AND matricule != "")', [photoUrl, userId, user.matricule]);

    await logAuditAction(userId, 'UPLOAD_MY_PHOTO', 'USER', userId, req, { photo_url: photoUrl });

    res.json({
      success: true,
      message: 'Photo de profil mise à jour avec succès.',
      photo_url: photoUrl
    });
  } catch (err) {
    console.error('Upload account photo error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de votre photo de profil.' });
  }
});

// DELETE /api/account/photo - Delete current user's profile photo
router.delete('/photo', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const user = await db.get('SELECT id, first_name, last_name, matricule, photo_path FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    if (user.photo_path && user.photo_path.startsWith('/uploads/avatars/')) {
      const oldFilename = path.basename(user.photo_path);
      const oldFilePath = path.join(avatarsDir, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        try { fs.unlinkSync(oldFilePath); } catch (e) {}
      }
    }

    await db.run('UPDATE users SET photo_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
    await db.run('UPDATE staff SET photo_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? OR (matricule = ? AND matricule != "")', [userId, user.matricule]);

    await logAuditAction(userId, 'DELETE_MY_PHOTO', 'USER', userId, req);

    res.json({
      success: true,
      message: 'Photo de profil supprimée.'
    });
  } catch (err) {
    console.error('Delete account photo error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de votre photo.' });
  }
});

// PUT /api/account/profile - Update personal profile information
router.put('/profile', authenticateToken, async (req, res) => {
  const { phone, function_title, titre } = req.body;
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
    if (titre !== undefined) {
      updates.push('titre = ?');
      params.push(titre ? titre.trim() : 'M.');
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(user.id);

    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    // Sync titre & phone to staff if linked
    if (titre !== undefined || phone !== undefined) {
      const staffUpdates = [];
      const staffParams = [];
      if (titre !== undefined) {
        staffUpdates.push('titre = ?');
        staffParams.push(titre ? titre.trim() : 'M.');
      }
      if (phone !== undefined) {
        staffUpdates.push('telephone = ?');
        staffParams.push(phone);
      }
      staffUpdates.push('updated_at = CURRENT_TIMESTAMP');
      staffParams.push(user.id);
      await db.run(`UPDATE staff SET ${staffUpdates.join(', ')} WHERE user_id = ?`, staffParams);
    }

    await logAuditAction(user.id, 'UPDATE_PROFILE', 'USER', user.id, req, { phone, function_title, titre });

    const updated = await db.get(
      `SELECT u.id, u.user_uid, u.matricule, u.first_name, u.last_name, COALESCE(u.titre, 'M.') as titre, u.email, u.phone, u.function_title, u.photo_path,
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
