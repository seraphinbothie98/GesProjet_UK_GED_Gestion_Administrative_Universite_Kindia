const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// GET /api/audit - Fetch immutable audit logs
router.get('/', authenticateToken, requirePermission('audit.read'), async (req, res) => {
  try {
    const logs = await db.all(
      `SELECT al.*, u.first_name, u.last_name, u.email, u.matricule, s.name as service_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       LEFT JOIN services s ON u.service_id = s.id
       ORDER BY al.timestamp DESC
       LIMIT 200`
    );
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des journaux d’audit.' });
  }
});

module.exports = router;
