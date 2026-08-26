const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const transmissionService = require('../services/transmissionService');
const { authenticateToken } = require('../middleware/auth');
const { UPLOAD_DIR } = require('../config/constants');

// Multer for upload of new document version or signatures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(UPLOAD_DIR, 'signatures');
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `trans_sig_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({ storage });

// POST /api/transmissions - Create & send inter-service transmission
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { document_id, to_service_id, to_user_id, subject, instruction, confidentiality_level, requires_signature } = req.body;
    
    if (!req.user.service_id) {
      return res.status(400).json({ error: "Votre compte utilisateur n'est rattaché à aucun service pour émettre une transmission." });
    }

    const result = await transmissionService.createTransmission({
      documentId: document_id,
      fromUserId: req.user.id,
      fromServiceId: req.user.service_id,
      toServiceId: to_service_id,
      toUserId: to_user_id || null,
      subject,
      instruction,
      confidentialityLevel: confidentiality_level || 'CONFIDENTIEL_INTER_SERVICES',
      requiresSignature: requires_signature !== undefined ? requires_signature : 1,
      req
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Create transmission error:', err);
    res.status(err.status || 400).json({ error: err.message || 'Erreur lors de la création de la transmission.' });
  }
});

// GET /api/transmissions/sent - Get sent transmissions for user's service
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const serviceId = req.user.service_id;
    if (!serviceId) return res.json([]);

    const { search, status, limit, offset } = req.query;
    const list = await transmissionService.getSent(serviceId, {
      search,
      status,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });

    res.json(list);
  } catch (err) {
    console.error('Get sent transmissions error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des courriers envoyés.' });
  }
});

// GET /api/transmissions/inbox - Get received transmissions for user's service
router.get('/inbox', authenticateToken, async (req, res) => {
  try {
    const serviceId = req.user.service_id;
    if (!serviceId) return res.json([]);

    const { search, status, limit, offset } = req.query;
    const list = await transmissionService.getInbox(serviceId, {
      search,
      status,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });

    res.json(list);
  } catch (err) {
    console.error('Get inbox transmissions error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des courriers reçus.' });
  }
});

// GET /api/transmissions/returned - Get returned transmissions for user's service
router.get('/returned', authenticateToken, async (req, res) => {
  try {
    const serviceId = req.user.service_id;
    if (!serviceId) return res.json([]);

    const { search, limit, offset } = req.query;
    const list = await transmissionService.getReturned(serviceId, {
      search,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });

    res.json(list);
  } catch (err) {
    console.error('Get returned transmissions error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des courriers retournés.' });
  }
});

// GET /api/transmissions/:id - Get transmission details (Strict Confidentiality)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const details = await transmissionService.getDetails(req.params.id, req.user, req);
    res.json(details);
  } catch (err) {
    console.error('Get transmission details error:', err);
    res.status(err.status || 403).json({ error: err.message || 'Accès refusé à cette transmission.' });
  }
});

// POST /api/transmissions/:id/acknowledge - Acknowledge reception (Service B)
router.post('/:id/acknowledge', authenticateToken, async (req, res) => {
  try {
    const { comments } = req.body;
    const result = await transmissionService.acknowledge(req.params.id, req.user, { comments }, req);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// POST /api/transmissions/:id/request-modification - Request change with reason (Service B)
router.post('/:id/request-modification', authenticateToken, async (req, res) => {
  try {
    const { reason, comments } = req.body;
    const result = await transmissionService.requestModification(req.params.id, req.user, { reason, comments }, req);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// POST /api/transmissions/:id/submit-new-version - Submit updated version (Service A)
router.post('/:id/submit-new-version', authenticateToken, async (req, res) => {
  try {
    const { new_file_path, new_file_name, new_file_size, change_notes } = req.body;
    const result = await transmissionService.submitNewVersion(req.params.id, req.user, {
      newFilePath: new_file_path,
      newFileName: new_file_name,
      newFileSize: new_file_size,
      changeNotes: change_notes
    }, req);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// POST /api/transmissions/:id/approve - Approve document (Service B)
router.post('/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { comments } = req.body;
    const result = await transmissionService.approve(req.params.id, req.user, { comments }, req);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// POST /api/transmissions/:id/sign - Sign electronically & Auto-Return to Service A (Service B)
router.post('/:id/sign', authenticateToken, async (req, res) => {
  try {
    const { signature_image_path, comments, signed_file_path, signed_file_name, signed_file_size } = req.body;
    const result = await transmissionService.sign(req.params.id, req.user, {
      signatureImagePath: signature_image_path,
      comments,
      signedFilePath: signed_file_path,
      signedFileName: signed_file_name,
      signedFileSize: signed_file_size
    }, req);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// POST /api/transmissions/:id/reject - Reject transmission with reason (Service B)
router.post('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await transmissionService.reject(req.params.id, req.user, { reason }, req);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// POST /api/transmissions/:id/archive - Archive transmission in service category
router.post('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { archive_category_id, comments } = req.body;
    const result = await transmissionService.archive(req.params.id, req.user, {
      archiveCategoryId: archive_category_id,
      comments
    }, req);
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

module.exports = router;
