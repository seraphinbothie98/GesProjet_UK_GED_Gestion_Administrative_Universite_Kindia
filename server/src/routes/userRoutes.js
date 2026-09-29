const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR } = require('../config/constants');
const accountSecurityService = require('../services/accountSecurityService');
const { checkExistingChefDeService, syncServiceChefAssignment } = require('../services/serviceHeadHelper');
const assignmentService = require('../services/assignmentService');

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
    const userId = req.params?.id || req.body?.user_id || 'user';
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

// GET /api/users - List all users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const permissions = user.permissions || [];
    const isAllowed = user.role_code === 'ADMIN' || 
      permissions.some(p => ['users.read', 'signatures.manage', 'signatures.read', 'templates.manage'].includes(p));

    if (!isAllowed) {
      return res.status(403).json({ error: 'Permission refusée pour la liste des utilisateurs.' });
    }

    const users = await db.all(
      `SELECT u.id, u.matricule, u.first_name, u.last_name, COALESCE(u.titre, 'M.') as titre, u.email, u.phone, u.function_title, u.photo_path,
              u.service_id, u.role_id, u.status, u.last_login, u.created_at,
              s.name as service_name, s.code as service_code, r.name as role_name, r.code as role_code
       FROM users u
       LEFT JOIN services s ON u.service_id = s.id
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.id DESC`
    );
    res.json(users);
  } catch (err) {
    console.error('Fetch users list error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs.' });
  }
});

// POST /api/users - Create a new user
router.post('/', authenticateToken, requirePermission('users.create'), async (req, res) => {
  const { matricule, first_name, last_name, titre, email, phone, function_title, service_id, role_id, password, photo_path } = req.body;

  if (!matricule || !first_name || !last_name || !email || !service_id || !role_id || !password) {
    return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires.' });
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE email = ? OR matricule = ?', [email.trim(), matricule.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Un utilisateur avec cet email ou ce matricule existe déjà.' });
    }

    // Verify Chef de Service uniqueness
    const selectedRole = await db.get('SELECT code FROM roles WHERE id = ?', [role_id]);
    const isDesignatedChef = selectedRole?.code === 'CHEF_SERVICE' || selectedRole?.code === 'RESPONSABLE_SERVICE' || (function_title && (function_title.toLowerCase().trim().startsWith('chef de service') || function_title.toLowerCase().trim().startsWith('responsable de service') || function_title.toLowerCase().trim().startsWith('chef du service')));

    if (isDesignatedChef && service_id) {
      const existingChef = await checkExistingChefDeService(service_id);
      if (existingChef) {
        return res.status(400).json({
          error: `Enregistrement refusé : Le service « ${existingChef.service_name || 'sélectionné'} » possède déjà un Chef de Service actif (${existingChef.first_name} ${existingChef.last_name}). Un service ne peut avoir qu'un seul Chef de Service à la fois.`
        });
      }
    }

    const cleanTitre = titre ? titre.trim() : 'M.';
    const cleanPhotoPath = photo_path ? photo_path.split('?')[0].trim() : null;
    const hash = await bcrypt.hash(password, 10);
    const userUid = accountSecurityService.generateUserUid();
    const result = await db.run(
      `INSERT INTO users (user_uid, matricule, first_name, last_name, titre, email, phone, function_title, photo_path, service_id, role_id, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [userUid, matricule.trim(), first_name.trim(), last_name.trim(), cleanTitre, email.trim(), phone || '', function_title.trim(), cleanPhotoPath, service_id, role_id, hash]
    );

    const userId = result.lastID;

    // Automatic Synchronization with Staff Directory (Module Personnel)
    let staffIdToAssign = null;
    const existingStaff = await db.get('SELECT id FROM staff WHERE user_id = ? OR matricule = ? OR (email != "" AND LOWER(email) = LOWER(?))', [userId, matricule.trim(), email.trim()]);
    if (existingStaff) {
      staffIdToAssign = existingStaff.id;
      await db.run(
        `UPDATE staff 
         SET user_id = ?, matricule = ?, nom = ?, prenoms = ?, titre = ?, fonction = ?, photo_path = ?, service_id = ?, telephone = ?, email = ?, status = 'ACTIF', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, matricule.trim(), last_name.trim().toUpperCase(), first_name.trim(), cleanTitre, function_title.trim(), cleanPhotoPath, service_id, phone || '', email.trim(), existingStaff.id]
      );
    } else {
      const insRes = await db.run(
        `INSERT INTO staff (user_id, matricule, nom, prenoms, titre, nationality, fonction, photo_path, service_id, telephone, email, status, is_driver)
         VALUES (?, ?, ?, ?, ?, 'Guinéenne', ?, ?, ?, ?, ?, 'ACTIF', 0)`,
        [userId, matricule.trim(), last_name.trim().toUpperCase(), first_name.trim(), cleanTitre, function_title.trim(), cleanPhotoPath, service_id, phone || '', email.trim()]
      );
      staffIdToAssign = insRes.lastID;
    }

    // Dynamic position registration & initial staff assignment
    try {
      if (staffIdToAssign && function_title) {
        let posFound = await db.get('SELECT id FROM positions WHERE LOWER(title) = LOWER(?) OR LOWER(code) = LOWER(?)', [function_title.trim(), function_title.trim()]);
        let posId = null;
        if (posFound) {
          posId = posFound.id;
        } else {
          const posCode = 'POS_' + function_title.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 25) + '_' + Date.now().toString().slice(-4);
          const posRes = await db.run(
            `INSERT INTO positions (code, title, category, is_unique, service_id, status) VALUES (?, ?, 'ADMINISTRATIF', 0, ?, 'ACTIVE')`,
            [posCode, function_title.trim(), service_id ? Number(service_id) : null]
          );
          posId = posRes.lastID;
        }
        if (posId) {
          await assignmentService.assignStaffToPosition({
            staffId: staffIdToAssign,
            positionId: posId,
            serviceId: service_id ? Number(service_id) : null,
            fonction: function_title.trim(),
            motive: 'Affectation initiale compte utilisateur',
            createdByUserId: req.user.id
          });
        }
      }
    } catch (assignErr) {
      console.warn('User create assignment warning:', assignErr.message);
    }

    // Automatically apply as Chef de Service in Services module if designated and vacant
    if (isDesignatedChef && service_id) {
      await syncServiceChefAssignment({
        serviceId: Number(service_id),
        userId: userId,
        fonctionTitle: function_title.trim(),
        isChef: true
      });
    }

    await logAuditAction(req.user.id, 'CREATE', 'USER', userId, req, { email, matricule, user_uid: userUid, is_chef: isDesignatedChef, photo_path: cleanPhotoPath });

    res.status(201).json({ success: true, id: userId, user_uid: userUid, photo_path: cleanPhotoPath });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l’utilisateur.' });
  }
});

// PUT /api/users/:id/status - Enable/Disable User
router.put('/:id/status', authenticateToken, requirePermission('users.disable'), async (req, res) => {
  const { status } = req.body;
  const userId = req.params.id;

  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }

  try {
    await db.run('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, userId]);
    
    // Synchronize status in staff directory
    const staffStatus = status === 'INACTIVE' ? 'INACTIF' : 'ACTIF';
    await db.run('UPDATE staff SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [staffStatus, userId]);

    await logAuditAction(req.user.id, 'UPDATE_STATUS', 'USER', userId, req, { newStatus: status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut.' });
  }
});

// POST /api/users/:id/reset-password - Admin Reset Password (generates temporary password and revokes sessions)
router.post('/:id/reset-password', authenticateToken, async (req, res) => {
  const userId = req.params.id;
  const { custom_temp_password } = req.body;

  try {
    const result = await accountSecurityService.adminResetPassword(
      req.user,
      userId,
      { customTempPassword: custom_temp_password },
      req
    );
    res.json(result);
  } catch (err) {
    console.error('Admin reset password error:', err);
    res.status(err.status || 400).json({ error: err.message });
  }
});

// Backward-compatible PUT /api/users/:id/reset-password
router.put('/:id/reset-password', authenticateToken, async (req, res) => {
  const userId = req.params.id;
  const { new_password } = req.body;

  try {
    const result = await accountSecurityService.adminResetPassword(
      req.user,
      userId,
      { customTempPassword: new_password },
      req
    );
    res.json(result);
  } catch (err) {
    console.error('Admin reset password error:', err);
    res.status(err.status || 400).json({ error: err.message });
  }
});

// POST /api/users/:id/revoke-sessions - Revoke user active sessions
router.post('/:id/revoke-sessions', authenticateToken, async (req, res) => {
  const userId = req.params.id;
  const user = req.user;

  const canManage = user.permissions?.includes('users.manage_sessions') || 
                    user.permissions?.includes('users.update') || 
                    user.role_code === 'ADMINISTRATEUR';

  if (!canManage) {
    return res.status(403).json({ error: 'Permission insuffisante pour révoquer les sessions.' });
  }

  try {
    const result = await accountSecurityService.revokeSessions(userId, user, req);
    res.json(result);
  } catch (err) {
    console.error('Revoke sessions error:', err);
    res.status(500).json({ error: 'Erreur lors de la révocation des sessions.' });
  }
});

// GET /api/users/:id/security-info - Get user security status (without password)
router.get('/:id/security-info', authenticateToken, async (req, res) => {
  const userId = req.params.id;
  try {
    const info = await accountSecurityService.getSecurityInfo(userId);
    res.json(info);
  } catch (err) {
    console.error('Fetch security info error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des informations de sécurité.' });
  }
});

// PUT /api/users/:id - Full User & Chef de Service Update with Field-by-Field Audit Log
router.put('/:id', authenticateToken, async (req, res) => {
  const userId = req.params.id;

  // Authorization check: user must have users.manage_service_heads OR users.update OR be ADMINISTRATEUR
  const canManage = req.user.permissions.includes('users.manage_service_heads') || 
                    req.user.permissions.includes('users.update') || 
                    req.user.role_code === 'ADMINISTRATEUR';

  if (!canManage) {
    return res.status(403).json({ error: 'Permission insuffisante (users.manage_service_heads ou users.update requise).' });
  }

  const { matricule, first_name, last_name, titre, email, phone, function_title, service_id, role_id, status, is_chef_service, photo_path } = req.body;

  try {
    const existing = await db.get(
      `SELECT u.*, s.name as service_name, r.name as role_name, r.code as role_code 
       FROM users u 
       JOIN services s ON u.service_id = s.id 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [userId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    // Check email / matricule collision if changed
    if (email && email !== existing.email) {
      const emailDup = await db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (emailDup) return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre compte.' });
    }
    if (matricule && matricule !== existing.matricule) {
      const matDup = await db.get('SELECT id FROM users WHERE matricule = ? AND id != ?', [matricule, userId]);
      if (matDup) return res.status(400).json({ error: 'Ce matricule est déjà attribué.' });
    }

    const updatedFirstName = first_name !== undefined ? first_name : existing.first_name;
    const updatedLastName = last_name !== undefined ? last_name : existing.last_name;
    const updatedTitre = titre !== undefined ? (titre ? titre.trim() : 'M.') : (existing.titre || 'M.');
    const updatedMatricule = matricule !== undefined ? matricule : existing.matricule;
    const updatedEmail = email !== undefined ? email : existing.email;
    const updatedPhone = phone !== undefined ? phone : existing.phone;
    const updatedFunction = function_title !== undefined ? function_title : existing.function_title;
    const updatedServiceId = service_id !== undefined ? parseInt(service_id) : existing.service_id;
    const updatedRoleId = role_id !== undefined ? parseInt(role_id) : existing.role_id;
    const updatedStatus = status !== undefined ? status : existing.status;
    const updatedPhotoPath = photo_path !== undefined ? (photo_path ? photo_path.split('?')[0].trim() : null) : existing.photo_path;

    // Verify Chef de Service uniqueness
    const selectedRole = await db.get('SELECT code FROM roles WHERE id = ?', [updatedRoleId]);
    const isDesignatedChef = selectedRole?.code === 'CHEF_SERVICE' || selectedRole?.code === 'RESPONSABLE_SERVICE' || (updatedFunction && (updatedFunction.toLowerCase().trim().startsWith('chef de service') || updatedFunction.toLowerCase().trim().startsWith('responsable de service')));

    if (isDesignatedChef && updatedServiceId) {
      const existingChef = await checkExistingChefDeService(updatedServiceId, userId);
      if (existingChef) {
        return res.status(400).json({
          error: `Modification refusée : Le service « ${existingChef.service_name || 'sélectionné'} » possède déjà un Chef de Service actif (${existingChef.first_name} ${existingChef.last_name}). Un service ne peut avoir qu'un seul Chef de Service à la fois.`
        });
      }
    }

    // Track field diffs for audit logging
    const changes = [];
    const labelsMap = {
      first_name: 'Prénom',
      last_name: 'Nom',
      titre: 'Titre / Grade',
      matricule: 'Matricule',
      email: 'Email professionnel',
      phone: 'Téléphone',
      function_title: 'Fonction',
      service_id: 'Service',
      role_id: 'Rôle RBAC',
      status: 'Statut du compte',
      photo_path: 'Photo de profil'
    };

    if (updatedFirstName !== existing.first_name) changes.push({ field: labelsMap.first_name, old_val: existing.first_name, new_val: updatedFirstName });
    if (updatedLastName !== existing.last_name) changes.push({ field: labelsMap.last_name, old_val: existing.last_name, new_val: updatedLastName });
    if (updatedTitre !== existing.titre) changes.push({ field: labelsMap.titre, old_val: existing.titre, new_val: updatedTitre });
    if (updatedMatricule !== existing.matricule) changes.push({ field: labelsMap.matricule, old_val: existing.matricule, new_val: updatedMatricule });
    if (updatedEmail !== existing.email) changes.push({ field: labelsMap.email, old_val: existing.email, new_val: updatedEmail });
    if (updatedPhone !== existing.phone) changes.push({ field: labelsMap.phone, old_val: existing.phone || 'Aucun', new_val: updatedPhone || 'Aucun' });
    if (updatedFunction !== existing.function_title) changes.push({ field: labelsMap.function_title, old_val: existing.function_title, new_val: updatedFunction });
    if (updatedPhotoPath !== existing.photo_path) changes.push({ field: labelsMap.photo_path, old_val: existing.photo_path || 'Aucune', new_val: updatedPhotoPath || 'Aucune' });

    if (updatedServiceId !== existing.service_id) {
      const oldSrv = await db.get('SELECT name FROM services WHERE id = ?', [existing.service_id]);
      const newSrv = await db.get('SELECT name FROM services WHERE id = ?', [updatedServiceId]);
      changes.push({ field: labelsMap.service_id, old_val: oldSrv ? oldSrv.name : existing.service_id, new_val: newSrv ? newSrv.name : updatedServiceId });
    }

    if (updatedRoleId !== existing.role_id) {
      const oldRole = await db.get('SELECT name FROM roles WHERE id = ?', [existing.role_id]);
      const newRole = await db.get('SELECT name FROM roles WHERE id = ?', [updatedRoleId]);
      changes.push({ field: labelsMap.role_id, old_val: oldRole ? oldRole.name : existing.role_id, new_val: newRole ? newRole.name : updatedRoleId });
    }

    if (updatedStatus !== existing.status) changes.push({ field: labelsMap.status, old_val: existing.status, new_val: updatedStatus });

    // Update database record
    await db.run(
      `UPDATE users 
       SET matricule = ?, first_name = ?, last_name = ?, titre = ?, email = ?, phone = ?, function_title = ?, photo_path = ?, service_id = ?, role_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [updatedMatricule, updatedFirstName, updatedLastName, updatedTitre, updatedEmail, updatedPhone, updatedFunction, updatedPhotoPath, updatedServiceId, updatedRoleId, updatedStatus, userId]
    );

    // Automatic Synchronization with Staff Directory (Module Personnel)
    let staffIdToAssign = null;
    const staffStatus = updatedStatus === 'INACTIVE' ? 'INACTIF' : 'ACTIF';
    const existingStaff = await db.get('SELECT id FROM staff WHERE user_id = ? OR matricule = ? OR (email != "" AND LOWER(email) = LOWER(?))', [userId, updatedMatricule, updatedEmail]);
    if (existingStaff) {
      staffIdToAssign = existingStaff.id;
      await db.run(
        `UPDATE staff 
         SET user_id = ?, matricule = ?, nom = ?, prenoms = ?, titre = ?, fonction = ?, photo_path = ?, service_id = ?, telephone = ?, email = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, updatedMatricule, updatedLastName.trim().toUpperCase(), updatedFirstName.trim(), updatedTitre, updatedFunction, updatedPhotoPath, updatedServiceId, updatedPhone || '', updatedEmail, staffStatus, existingStaff.id]
      );
    } else {
      const insRes = await db.run(
        `INSERT INTO staff (user_id, matricule, nom, prenoms, titre, nationality, fonction, photo_path, service_id, telephone, email, status, is_driver)
         VALUES (?, ?, ?, ?, ?, 'Guinéenne', ?, ?, ?, ?, ?, ?, 0)`,
        [userId, updatedMatricule, updatedLastName.trim().toUpperCase(), updatedFirstName.trim(), updatedTitre, updatedFunction, updatedPhotoPath, updatedServiceId, updatedPhone || '', updatedEmail, staffStatus]
      );
      staffIdToAssign = insRes.lastID;
    }

    // Dynamic position registration & staff assignment update
    try {
      if (staffIdToAssign && updatedFunction) {
        let posFound = await db.get('SELECT id FROM positions WHERE LOWER(title) = LOWER(?) OR LOWER(code) = LOWER(?)', [updatedFunction.trim(), updatedFunction.trim()]);
        let posId = null;
        if (posFound) {
          posId = posFound.id;
        } else {
          const posCode = 'POS_' + updatedFunction.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 25) + '_' + Date.now().toString().slice(-4);
          const posRes = await db.run(
            `INSERT INTO positions (code, title, category, is_unique, service_id, status) VALUES (?, ?, 'ADMINISTRATIF', 0, ?, 'ACTIVE')`,
            [posCode, updatedFunction.trim(), updatedServiceId ? Number(updatedServiceId) : null]
          );
          posId = posRes.lastID;
        }
        if (posId) {
          await assignmentService.assignStaffToPosition({
            staffId: staffIdToAssign,
            positionId: posId,
            serviceId: updatedServiceId ? Number(updatedServiceId) : null,
            fonction: updatedFunction,
            motive: 'Mise à jour compte utilisateur',
            createdByUserId: req.user.id
          });
        }
      }
    } catch (assignErr) {
      console.warn('User update assignment warning:', assignErr.message);
    }

    // If marked as Chef de service or assigned Chef de Service role, update service head_user_id and history
    const targetRole = await db.get('SELECT code FROM roles WHERE id = ?', [updatedRoleId]);
    const finalIsChef = is_chef_service === true || is_chef_service === 'true' || is_chef_service === 1 || is_chef_service === '1' ||
      (targetRole && (targetRole.code === 'CHEF_SERVICE' || targetRole.code === 'RESPONSABLE_SERVICE')) ||
      (updatedFunction && (updatedFunction.toLowerCase().trim().startsWith('chef de service') || updatedFunction.toLowerCase().trim().startsWith('responsable de service') || updatedFunction.toLowerCase().trim().startsWith('chef du service')));

    await syncServiceChefAssignment({
      serviceId: updatedServiceId ? Number(updatedServiceId) : null,
      userId: userId,
      fonctionTitle: updatedFunction,
      isChef: finalIsChef,
      previousServiceId: existing.service_id ? Number(existing.service_id) : null,
      previousUserId: userId
    });

    // Log detailed audit event for each modified field
    const targetUserName = `Chef de service ${existing.service_name} (${updatedFirstName} ${updatedLastName})`;
    for (const change of changes) {
      await logAuditAction(req.user.id, 'Modification utilisateur', 'USER', userId, req, {
        target_user: targetUserName,
        user_matricule: updatedMatricule,
        field: change.field,
        old_value: change.old_val,
        new_value: change.new_val
      });
    }

    res.json({
      success: true,
      message: 'Utilisateur mis à jour avec succès.',
      changesCount: changes.length,
      changes,
      photo_path: updatedPhotoPath
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l’utilisateur.' });
  }
});

// POST /api/users/:id/photo - Upload a profile photo for any user (Admin or Account Owner)
router.post('/:id/photo', authenticateToken, uploadAvatar.single('photo'), async (req, res) => {
  const userId = req.params.id;
  const canManage = req.user.role_code === 'ADMINISTRATEUR' || 
                    req.user.permissions?.includes('users.update') || 
                    req.user.permissions?.includes('users.manage_service_heads') ||
                    String(req.user.id) === String(userId);

  if (!canManage) {
    return res.status(403).json({ error: 'Permission refusée pour modifier la photo de cet utilisateur.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner un fichier image valide.' });
  }

  try {
    const user = await db.get('SELECT id, first_name, last_name, matricule, photo_path FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    const photoUrl = `/uploads/avatars/${req.file.filename}`;

    // Clean up previous custom photo file if it was in avatars directory
    if (user.photo_path && user.photo_path.startsWith('/uploads/avatars/')) {
      const oldFilename = path.basename(user.photo_path);
      const oldFilePath = path.join(avatarsDir, oldFilename);
      if (fs.existsSync(oldFilePath)) {
        try { fs.unlinkSync(oldFilePath); } catch (e) {}
      }
    }

    await db.run('UPDATE users SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [photoUrl, userId]);
    await db.run('UPDATE staff SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? OR (matricule = ? AND matricule != "")', [photoUrl, userId, user.matricule]);

    await logAuditAction(req.user.id, 'UPLOAD_USER_PHOTO', 'USER', userId, req, {
      user_name: `${user.first_name} ${user.last_name}`,
      photo_url: photoUrl
    });

    res.json({
      success: true,
      message: 'Photo de profil mise à jour avec succès.',
      photo_url: photoUrl
    });
  } catch (err) {
    console.error('Upload user photo error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de la photo de profil.' });
  }
});

// DELETE /api/users/:id/photo - Delete profile photo for any user
router.delete('/:id/photo', authenticateToken, async (req, res) => {
  const userId = req.params.id;
  const canManage = req.user.role_code === 'ADMINISTRATEUR' || 
                    req.user.permissions?.includes('users.update') || 
                    req.user.permissions?.includes('users.manage_service_heads') ||
                    String(req.user.id) === String(userId);

  if (!canManage) {
    return res.status(403).json({ error: 'Permission refusée pour supprimer la photo de cet utilisateur.' });
  }

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

    await logAuditAction(req.user.id, 'DELETE_USER_PHOTO', 'USER', userId, req, {
      user_name: `${user.first_name} ${user.last_name}`
    });

    res.json({
      success: true,
      message: 'Photo de profil supprimée avec succès.'
    });
  } catch (err) {
    console.error('Delete user photo error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la photo.' });
  }
});

// DELETE /api/users/:id - Delete user account and synchronized staff entry
router.delete('/:id', authenticateToken, async (req, res) => {
  const targetUserId = parseInt(req.params.id);

  // Authorization check
  const canDelete = req.user.role_code === 'ADMINISTRATEUR' || 
                    req.user.permissions?.includes('users.delete') || 
                    req.user.permissions?.includes('users.manage_service_heads');

  if (!canDelete) {
    return res.status(403).json({ error: 'Permission refusée pour la suppression d’un compte utilisateur.' });
  }

  // Safety checks
  if (targetUserId === Number(req.user.id)) {
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte administrateur actuellement connecté.' });
  }

  if (targetUserId === 1) {
    return res.status(400).json({ error: 'Le compte administrateur principal système ne peut pas être supprimé.' });
  }

  try {
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    await db.run('PRAGMA foreign_keys = OFF');

    // 1. Clean up references to staff in vehicles and mission orders
    const staffIds = (await db.all('SELECT id FROM staff WHERE user_id = ? OR (matricule = ? AND matricule != "")', [targetUserId, targetUser.matricule])).map(s => s.id);
    if (staffIds.length > 0) {
      const placeholders = staffIds.map(() => '?').join(',');
      await db.run(`UPDATE vehicles SET assigned_staff_id = NULL WHERE assigned_staff_id IN (${placeholders})`, staffIds).catch(() => {});
      await db.run(`UPDATE mission_orders SET staff_id = NULL WHERE staff_id IN (${placeholders})`, staffIds).catch(() => {});
      await db.run(`DELETE FROM staff_assignments WHERE staff_id IN (${placeholders})`, staffIds).catch(() => {});
    }

    // 2. Remove or clean up synchronized staff directory entry
    await db.run('DELETE FROM staff WHERE user_id = ? OR (matricule = ? AND matricule != "")', [targetUserId, targetUser.matricule]);

    // 3. Unassign service head and close head history
    await db.run('UPDATE services SET head_user_id = NULL WHERE head_user_id = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE service_heads_history SET is_current = 0, end_date = CURRENT_DATE WHERE user_id = ? AND is_current = 1', [targetUserId]).catch(() => {});

    // 4. Clean up user signatures, notifications, delegations
    await db.run('DELETE FROM user_signatures WHERE user_id = ?', [targetUserId]).catch(() => {});
    await db.run('DELETE FROM notifications WHERE user_id = ?', [targetUserId]).catch(() => {});
    await db.run('DELETE FROM delegations WHERE delegator_user_id = ? OR delegatee_user_id = ?', [targetUserId, targetUserId]).catch(() => {});
    await db.run('DELETE FROM appointment_availabilities WHERE user_id = ?', [targetUserId]).catch(() => {});
    await db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [targetUserId]).catch(() => {});
    await db.run('DELETE FROM document_editing_locks WHERE user_id = ?', [targetUserId]).catch(() => {});

    // 5. Nullify document references and history/audit links
    await db.run('UPDATE documents SET current_user_id = NULL WHERE current_user_id = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE documents SET created_by = NULL WHERE created_by = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE documents SET archived_by = NULL WHERE archived_by = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE documents SET archived_by_id = NULL WHERE archived_by_id = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE documents SET central_archived_by = NULL WHERE central_archived_by = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE documents SET transmitted_to_sc_by = NULL WHERE transmitted_to_sc_by = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE documents SET last_edited_by = NULL WHERE last_edited_by = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE documents SET sg_routed_by = NULL WHERE sg_routed_by = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE documents SET target_recipient_id = NULL WHERE target_recipient_id = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE document_history SET user_id = NULL WHERE user_id = ?', [targetUserId]).catch(() => {});
    await db.run('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?', [targetUserId]).catch(() => {});

    // 6. Delete the user record
    await db.run('DELETE FROM users WHERE id = ?', [targetUserId]);

    await db.run('PRAGMA foreign_keys = ON');

    // 7. Audit log
    await logAuditAction(req.user.id, 'DELETE_USER', 'USER', targetUserId, req, {
      deleted_matricule: targetUser.matricule,
      deleted_name: `${targetUser.first_name} ${targetUser.last_name}`,
      deleted_email: targetUser.email,
      deleted_service_id: targetUser.service_id
    });

    res.json({
      success: true,
      message: `Compte utilisateur ${targetUser.first_name} ${targetUser.last_name} supprimé avec succès.`
    });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de l’utilisateur.' });
  }
});

module.exports = router;
