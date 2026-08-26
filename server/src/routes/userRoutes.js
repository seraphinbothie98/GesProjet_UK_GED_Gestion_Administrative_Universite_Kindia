const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

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
      `SELECT u.id, u.matricule, u.first_name, u.last_name, u.email, u.phone, u.function_title,
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
  const { matricule, first_name, last_name, email, phone, function_title, service_id, role_id, password } = req.body;

  if (!matricule || !first_name || !last_name || !email || !service_id || !role_id || !password) {
    return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires.' });
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE email = ? OR matricule = ?', [email.trim(), matricule.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'Un utilisateur avec cet email ou ce matricule existe déjà.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const userUid = accountSecurityService.generateUserUid();
    const result = await db.run(
      `INSERT INTO users (user_uid, matricule, first_name, last_name, email, phone, function_title, service_id, role_id, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [userUid, matricule.trim(), first_name.trim(), last_name.trim(), email.trim(), phone || '', function_title.trim(), service_id, role_id, hash]
    );

    const userId = result.lastID;

    // Automatic Synchronization with Staff Directory (Module Personnel)
    const existingStaff = await db.get('SELECT id FROM staff WHERE user_id = ? OR matricule = ? OR (email != "" AND LOWER(email) = LOWER(?))', [userId, matricule.trim(), email.trim()]);
    if (existingStaff) {
      await db.run(
        `UPDATE staff 
         SET user_id = ?, matricule = ?, nom = ?, prenoms = ?, fonction = ?, service_id = ?, telephone = ?, email = ?, status = 'ACTIF', updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, matricule.trim(), last_name.trim().toUpperCase(), first_name.trim(), function_title.trim(), service_id, phone || '', email.trim(), existingStaff.id]
      );
    } else {
      await db.run(
        `INSERT INTO staff (user_id, matricule, nom, prenoms, nationality, fonction, service_id, telephone, email, status, is_driver)
         VALUES (?, ?, ?, ?, 'Guinéenne', ?, ?, ?, ?, 'ACTIF', 0)`,
        [userId, matricule.trim(), last_name.trim().toUpperCase(), first_name.trim(), function_title.trim(), service_id, phone || '', email.trim()]
      );
    }

    await logAuditAction(req.user.id, 'CREATE', 'USER', userId, req, { email, matricule, user_uid: userUid });

    res.status(201).json({ success: true, id: userId, user_uid: userUid });
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

const accountSecurityService = require('../services/accountSecurityService');

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

  const { matricule, first_name, last_name, email, phone, function_title, service_id, role_id, status, is_chef_service } = req.body;

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
    const updatedMatricule = matricule !== undefined ? matricule : existing.matricule;
    const updatedEmail = email !== undefined ? email : existing.email;
    const updatedPhone = phone !== undefined ? phone : existing.phone;
    const updatedFunction = function_title !== undefined ? function_title : existing.function_title;
    const updatedServiceId = service_id !== undefined ? parseInt(service_id) : existing.service_id;
    const updatedRoleId = role_id !== undefined ? parseInt(role_id) : existing.role_id;
    const updatedStatus = status !== undefined ? status : existing.status;

    // Track field diffs for audit logging
    const changes = [];
    const labelsMap = {
      first_name: 'Prénom',
      last_name: 'Nom',
      matricule: 'Matricule',
      email: 'Email professionnel',
      phone: 'Téléphone',
      function_title: 'Fonction',
      service_id: 'Service',
      role_id: 'Rôle RBAC',
      status: 'Statut du compte'
    };

    if (updatedFirstName !== existing.first_name) changes.push({ field: labelsMap.first_name, old_val: existing.first_name, new_val: updatedFirstName });
    if (updatedLastName !== existing.last_name) changes.push({ field: labelsMap.last_name, old_val: existing.last_name, new_val: updatedLastName });
    if (updatedMatricule !== existing.matricule) changes.push({ field: labelsMap.matricule, old_val: existing.matricule, new_val: updatedMatricule });
    if (updatedEmail !== existing.email) changes.push({ field: labelsMap.email, old_val: existing.email, new_val: updatedEmail });
    if (updatedPhone !== existing.phone) changes.push({ field: labelsMap.phone, old_val: existing.phone || 'Aucun', new_val: updatedPhone || 'Aucun' });
    if (updatedFunction !== existing.function_title) changes.push({ field: labelsMap.function_title, old_val: existing.function_title, new_val: updatedFunction });

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
       SET matricule = ?, first_name = ?, last_name = ?, email = ?, phone = ?, function_title = ?, service_id = ?, role_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [updatedMatricule, updatedFirstName, updatedLastName, updatedEmail, updatedPhone, updatedFunction, updatedServiceId, updatedRoleId, updatedStatus, userId]
    );

    // Automatic Synchronization with Staff Directory (Module Personnel)
    const staffStatus = updatedStatus === 'INACTIVE' ? 'INACTIF' : 'ACTIF';
    const existingStaff = await db.get('SELECT id FROM staff WHERE user_id = ? OR matricule = ? OR (email != "" AND LOWER(email) = LOWER(?))', [userId, updatedMatricule, updatedEmail]);
    if (existingStaff) {
      await db.run(
        `UPDATE staff 
         SET user_id = ?, matricule = ?, nom = ?, prenoms = ?, fonction = ?, service_id = ?, telephone = ?, email = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [userId, updatedMatricule, updatedLastName.trim().toUpperCase(), updatedFirstName.trim(), updatedFunction, updatedServiceId, updatedPhone || '', updatedEmail, staffStatus, existingStaff.id]
      );
    } else {
      await db.run(
        `INSERT INTO staff (user_id, matricule, nom, prenoms, nationality, fonction, service_id, telephone, email, status, is_driver)
         VALUES (?, ?, ?, ?, 'Guinéenne', ?, ?, ?, ?, ?, 0)`,
        [userId, updatedMatricule, updatedLastName.trim().toUpperCase(), updatedFirstName.trim(), updatedFunction, updatedServiceId, updatedPhone || '', updatedEmail, staffStatus]
      );
    }

    // If marked as Chef de service or assigned Chef de Service role, update service head_user_id
    const targetRole = await db.get('SELECT code FROM roles WHERE id = ?', [updatedRoleId]);
    if (is_chef_service || (targetRole && targetRole.code === 'CHEF_SERVICE')) {
      await db.run('UPDATE services SET head_user_id = ? WHERE id = ?', [userId, updatedServiceId]);
    }

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
      changes
    });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l’utilisateur.' });
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
    }

    // 2. Remove or clean up synchronized staff directory entry
    await db.run('DELETE FROM staff WHERE user_id = ? OR (matricule = ? AND matricule != "")', [targetUserId, targetUser.matricule]);

    // 3. Unassign service head if this user was head
    await db.run('UPDATE services SET head_user_id = NULL WHERE head_user_id = ?', [targetUserId]);

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
