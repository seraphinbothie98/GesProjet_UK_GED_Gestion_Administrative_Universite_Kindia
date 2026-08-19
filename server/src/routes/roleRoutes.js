const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/roles - List all roles with permission lists
router.get('/', authenticateToken, async (req, res) => {
  try {
    const roles = await db.all('SELECT * FROM roles ORDER BY id ASC');
    for (const r of roles) {
      const perms = await db.all(
        `SELECT p.code, p.category, p.description FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [r.id]
      );
      r.permissions = perms;
    }
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des rôles.' });
  }
});

// GET /api/roles/permissions - List all available system permissions
router.get('/permissions', authenticateToken, async (req, res) => {
  try {
    const permissions = await db.all('SELECT * FROM permissions ORDER BY category, code');
    res.json(permissions);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des permissions.' });
  }
});

// POST /api/roles - Create custom role
router.post('/', authenticateToken, requirePermission('roles.create'), async (req, res) => {
  const { code, name, description, permission_codes } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Le code et le nom du rôle sont requis.' });
  }

  try {
    const roleRes = await db.run(
      'INSERT INTO roles (code, name, description, is_custom) VALUES (?, ?, ?, 1)',
      [code.toUpperCase(), name, description || '']
    );
    const roleId = roleRes.lastID;

    if (Array.isArray(permission_codes)) {
      for (const pCode of permission_codes) {
        const perm = await db.get('SELECT id FROM permissions WHERE code = ?', [pCode]);
        if (perm) {
          await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, perm.id]);
        }
      }
    }

    await logAuditAction(req.user.id, 'CREATE', 'ROLE', roleId, req, { code, name });
    res.status(201).json({ success: true, id: roleId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création du rôle.' });
  }
});

module.exports = router;
