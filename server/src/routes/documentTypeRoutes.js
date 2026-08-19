const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/document-types - List all document types and their direct archive eligibility
router.get('/', authenticateToken, async (req, res) => {
  try {
    const types = await db.all('SELECT * FROM document_type_configs ORDER BY category ASC, label ASC');
    res.json(types);
  } catch (err) {
    console.error('Fetch document types error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des types de documents.' });
  }
});

// PUT /api/document-types/:code - Toggle or update direct archive setting for a document type
router.put('/:code', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  const { code } = req.params;
  const { allow_direct_archive } = req.body;

  if (allow_direct_archive === undefined) {
    return res.status(400).json({ error: 'Champ allow_direct_archive obligatoire.' });
  }

  try {
    const existing = await db.get('SELECT * FROM document_type_configs WHERE code = ?', [code]);
    if (!existing) {
      return res.status(404).json({ error: 'Type de document non trouvé.' });
    }

    const allowValue = allow_direct_archive ? 1 : 0;
    await db.run(
      'UPDATE document_type_configs SET allow_direct_archive = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?',
      [allowValue, code]
    );

    await logAuditAction(req.user.id, 'UPDATE_DOC_TYPE', 'SETTINGS', 0, req, {
      code,
      label: existing.label,
      allow_direct_archive: allowValue
    });

    res.json({ success: true, message: `Configuration du type de document [${existing.label}] mise à jour avec succès.` });
  } catch (err) {
    console.error('Update document type error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du type de document.' });
  }
});

module.exports = router;
