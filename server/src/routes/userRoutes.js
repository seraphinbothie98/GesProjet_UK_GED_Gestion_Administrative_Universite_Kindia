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
    const existing = await db.get('SELECT id FROM users WHERE email = ? OR matricule = ?', [email, matricule]);
    if (existing) {
      return res.status(400).json({ error: 'Un utilisateur avec cet email ou ce matricule existe déjà.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO users (matricule, first_name, last_name, email, phone, function_title, service_id, role_id, password_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [matricule, first_name, last_name, email, phone || '', function_title, service_id, role_id, hash]
    );

    await logAuditAction(req.user.id, 'CREATE', 'USER', result.lastID, req, { email, matricule });

    res.status(201).json({ success: true, id: result.lastID });
  } catch (err) {
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
    await logAuditAction(req.user.id, 'UPDATE_STATUS', 'USER', userId, req, { newStatus: status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut.' });
  }
});

// PUT /api/users/:id/reset-password - Reset password
router.put('/:id/reset-password', authenticateToken, requirePermission('users.update'), async (req, res) => {
  const { new_password } = req.body;
  const userId = req.params.id;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' });
  }

  try {
    const hash = await bcrypt.hash(new_password, 10);
    await db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [hash, userId]);
    await logAuditAction(req.user.id, 'RESET_PASSWORD', 'USER', userId, req);
    res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe.' });
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

module.exports = router;
