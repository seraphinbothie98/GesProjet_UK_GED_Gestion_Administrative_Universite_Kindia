const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/services - List all 30 services with counts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const services = await db.all(
      `SELECT s.*, 
              u.first_name as head_first_name, u.last_name as head_last_name, u.email as head_email,
              (SELECT COUNT(*) FROM users WHERE service_id = s.id) as user_count,
              (SELECT COUNT(*) FROM documents WHERE current_service_id = s.id AND status != 'TRASHED') as document_count
       FROM services s
       LEFT JOIN users u ON s.head_user_id = u.id
       ORDER BY s.name ASC`
    );
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des services.' });
  }
});

// POST /api/services - Add a new service
router.post('/', authenticateToken, requirePermission('services.create'), async (req, res) => {
  const { code, name, head_user_id } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Le code et le nom du service sont requis.' });
  }

  try {
    const existing = await db.get('SELECT id FROM services WHERE code = ?', [code]);
    if (existing) {
      return res.status(400).json({ error: 'Un service avec ce code existe déjà.' });
    }

    const resDb = await db.run(
      'INSERT INTO services (code, name, head_user_id, status) VALUES (?, ?, ?, "ACTIVE")',
      [code.toUpperCase(), name, head_user_id || null]
    );

    await logAuditAction(req.user.id, 'CREATE', 'SERVICE', resDb.lastID, req, { code, name });
    res.status(201).json({ success: true, id: resDb.lastID });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la création du service.' });
  }
});

// PUT /api/services/:id - Update a service
router.put('/:id', authenticateToken, requirePermission('services.update'), async (req, res) => {
  const { name, head_user_id, status } = req.body;
  const serviceId = req.params.id;

  try {
    await db.run(
      'UPDATE services SET name = ?, head_user_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, head_user_id || null, status || 'ACTIVE', serviceId]
    );

    await logAuditAction(req.user.id, 'UPDATE', 'SERVICE', serviceId, req, { name, status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour du service.' });
  }
});

module.exports = router;
