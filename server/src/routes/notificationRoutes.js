const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/notifications - List notifications for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await db.all(
      `SELECT n.*, 
              d.reference as doc_reference, d.title as doc_title,
              a.reference as appt_reference, a.subject as appt_subject, a.status as appt_status
       FROM notifications n
       LEFT JOIN documents d ON n.document_id = d.id
       LEFT JOIN appointments a ON n.appointment_id = a.id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    const unreadCount = await db.get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({ notifications, unread_count: unreadCount ? unreadCount.count : 0 });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des notifications.' });
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du marquage de la notification.' });
  }
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
  }
});

module.exports = router;
