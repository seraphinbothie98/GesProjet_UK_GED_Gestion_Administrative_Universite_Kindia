const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { UPLOAD_DIR } = require('../config/constants');
const { authenticateToken } = require('../middleware/auth');
const onlyofficeDocumentService = require('../services/onlyofficeDocumentService');

const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || 'uk_ged_onlyoffice_secret_2026';

// GET /api/documents/:id/onlyoffice/config - Generate ONLYOFFICE session configuration
router.get('/:id/onlyoffice/config', authenticateToken, async (req, res) => {
  const documentId = parseInt(req.params.id);
  const user = req.user;

  try {
    const sessionData = await onlyofficeDocumentService.buildDocumentSessionConfig(documentId, user, req);
    res.json(sessionData);
  } catch (err) {
    console.error('ONLYOFFICE config error:', err);
    res.status(err.status || 400).json({ error: err.message });
  }
});

// GET /api/documents/:id/onlyoffice/file - Serve file for ONLYOFFICE Document Server
router.get('/:id/onlyoffice/file', async (req, res) => {
  const documentId = parseInt(req.params.id);
  const token = req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Token d’accès manquant.' });
  }

  try {
    const decoded = jwt.verify(token, ONLYOFFICE_JWT_SECRET);
    if (decoded.documentId !== documentId || decoded.purpose !== 'ONLYOFFICE_DOC_ACCESS') {
      return res.status(403).json({ error: 'Token non autorisé pour ce document.' });
    }

    const document = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!document || !document.file_path) {
      return res.status(404).json({ error: 'Fichier du document introuvable.' });
    }

    const filePath = path.isAbsolute(document.file_path) 
      ? document.file_path 
      : path.join(UPLOAD_DIR, document.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier physique introuvable sur le serveur.' });
    }

    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error('ONLYOFFICE file access error:', err);
    res.status(403).json({ error: 'Token invalide ou expiré.' });
  }
});

// POST /api/documents/:id/onlyoffice/callback - Receive ONLYOFFICE save notifications
router.post('/:id/onlyoffice/callback', async (req, res) => {
  const documentId = parseInt(req.params.id);
  const token = req.query.token;
  let body = req.body;

  // If token is provided in query, verify it
  if (token) {
    try {
      const decoded = jwt.verify(token, ONLYOFFICE_JWT_SECRET);
      if (decoded.documentId !== documentId) {
        return res.status(403).json({ error: 1, message: 'Token de callback invalide pour ce document.' });
      }
    } catch (err) {
      return res.status(403).json({ error: 1, message: 'Token de callback expiré ou invalide.' });
    }
  }

  // If body is signed in JWT by ONLYOFFICE, decode it
  if (body.token) {
    try {
      body = jwt.verify(body.token, ONLYOFFICE_JWT_SECRET);
    } catch (err) {
      console.warn('ONLYOFFICE body token verification failed:', err.message);
    }
  }

  try {
    const result = await onlyofficeDocumentService.handleCallback(documentId, body, req);
    res.json(result);
  } catch (err) {
    console.error('ONLYOFFICE callback processing error:', err);
    res.json({ error: 1, message: err.message });
  }
});

// GET /api/documents/:id/onlyoffice/lock-status - Check current editing lock status
router.get('/:id/onlyoffice/lock-status', authenticateToken, async (req, res) => {
  const documentId = parseInt(req.params.id);
  try {
    const lock = await db.get(`
      SELECT l.*, u.first_name, u.last_name, u.email
      FROM document_editing_locks l
      JOIN users u ON l.user_id = u.id
      WHERE l.document_id = ? AND l.expires_at > CURRENT_TIMESTAMP
    `, [documentId]);

    if (!lock) {
      return res.json({ locked: false });
    }

    res.json({
      locked: true,
      isCurrentUser: lock.user_id === req.user.id,
      lockedBy: `${lock.first_name} ${lock.last_name}`,
      lockedAt: lock.locked_at,
      expiresAt: lock.expires_at
    });
  } catch (err) {
    console.error('Lock status error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification du verrou.' });
  }
});

// POST /api/documents/:id/onlyoffice/unlock - Release editing lock explicitly
router.post('/:id/onlyoffice/unlock', authenticateToken, async (req, res) => {
  const documentId = parseInt(req.params.id);
  try {
    await onlyofficeDocumentService.releaseEditingLock(documentId, req.user);
    res.json({ success: true, message: 'Verrou d’édition libéré.' });
  } catch (err) {
    console.error('Unlock error:', err);
    res.status(500).json({ error: 'Erreur lors de la libération du verrou.' });
  }
});

module.exports = router;
