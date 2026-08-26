const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const documentTypeService = require('../services/documentTypeService');

// GET /api/document-types/creatable - List only document types the user is authorized to create
router.get('/creatable', authenticateToken, async (req, res) => {
  try {
    const types = await documentTypeService.getCreatableDocumentTypesForUser(req.user);
    res.json(types);
  } catch (err) {
    console.error('Fetch creatable document types error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des types de documents autorisés.' });
  }
});

// GET /api/document-types - List all document types
router.get('/', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role_code === 'ADMINISTRATEUR';
    const query = isAdmin 
      ? 'SELECT * FROM document_type_configs ORDER BY display_order ASC, label ASC'
      : 'SELECT * FROM document_type_configs WHERE is_active = 1 ORDER BY display_order ASC, label ASC';
    const types = await db.all(query);
    res.json(types);
  } catch (err) {
    console.error('Fetch document types error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des types de documents.' });
  }
});

// GET /api/document-types/:code/permissions - Get permissions matrix for a document type (Admin)
router.get('/:code/permissions', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  try {
    const matrix = await documentTypeService.getPermissionsMatrix(req.params.code);
    res.json(matrix);
  } catch (err) {
    console.error('Fetch permissions matrix error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/document-types/:code/permissions - Update permissions matrix for a document type (Admin)
router.post('/:code/permissions', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  try {
    const { rules } = req.body;
    const result = await documentTypeService.updatePermissions(req.params.code, rules, req.user, req);
    res.json(result);
  } catch (err) {
    console.error('Update permissions error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/document-types - Create a new document type (Admin)
router.post('/', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  try {
    const newType = await documentTypeService.createDocumentType(req.body, req.user, req);
    res.status(201).json(newType);
  } catch (err) {
    console.error('Create document type error:', err);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/document-types/:code - Update document type (Admin)
router.put('/:code', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  try {
    const updated = await documentTypeService.updateDocumentType(req.params.code, req.body, req.user, req);
    res.json(updated);
  } catch (err) {
    console.error('Update document type error:', err);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/document-types/:code - Safe logical deactivation of document type (Admin)
router.delete('/:code', authenticateToken, requirePermission('settings.manage'), async (req, res) => {
  try {
    const result = await documentTypeService.deactivateDocumentType(req.params.code, req.user, req);
    res.json(result);
  } catch (err) {
    console.error('Deactivate document type error:', err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
