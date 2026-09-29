const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR } = require('../config/constants');

const sigsDir = path.join(UPLOAD_DIR, 'signatures');
if (!fs.existsSync(sigsDir)) {
  fs.mkdirSync(sigsDir, { recursive: true });
}

// Multer storage for signature image files
const sigStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, sigsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `sig_${Date.now()}_${Math.round(Math.random() * 1000)}${ext}`);
  }
});

const uploadSig = multer({
  storage: sigStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format d’image non supporté. PNG transparent recommandé.'));
    }
  }
});

// 1. GET /api/signatures - List all electronic signatures (Strictly Admin)
router.get('/', authenticateToken, async (req, res) => {
  if (req.user?.role_code !== 'ADMINISTRATEUR') {
    return res.status(403).json({ error: 'Accès réservé exclusivement à l’Administrateur Système.' });
  }
  try {
    const signatures = await db.all(
      `SELECT us.*, u.first_name, u.last_name, u.email, u.matricule, u.function_title as user_function,
              s.name as service_name, r.name as role_name, r.code as role_code,
              (SELECT COUNT(*) FROM signature_versions sv WHERE sv.signature_id = us.id) as versions_count,
              (SELECT COUNT(*) FROM document_signatures ds WHERE ds.signature_id = us.id) as documents_signed_count
       FROM user_signatures us
       JOIN users u ON us.user_id = u.id
       LEFT JOIN services s ON us.service_id = s.id
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY us.is_active DESC, us.created_at DESC`
    );
    res.json(signatures);
  } catch (err) {
    console.error('Fetch signatures error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des signatures électroniques.' });
  }
});

// 2. GET /api/signatures/my-signature - Get active signature for logged in user
router.get('/my-signature', authenticateToken, async (req, res) => {
  try {
    const sig = await db.get(
      `SELECT * FROM user_signatures WHERE user_id = ? AND (status = 'ACTIVE' OR is_active = 1) ORDER BY id DESC LIMIT 1`,
      [req.user.id]
    );
    res.json(sig || null);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération de votre signature.' });
  }
});

// 3. POST /api/signatures - Register Electronic Signature (Rules 13, 14, 16, 21, 27)
router.post('/', authenticateToken, requirePermission('signatures.manage'), uploadSig.single('signature'), async (req, res) => {
  const { user_id, function_title, service_id, activation_date, expiration_date, width, height, alignment, force } = req.body;

  if (!req.file || !user_id) {
    return res.status(400).json({ error: 'Fichier de signature et responsable obligatoires.' });
  }

  try {
    const user = await db.get('SELECT u.*, s.name as service_name FROM users u LEFT JOIN services s ON u.service_id = s.id WHERE u.id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ error: 'Responsable non trouvé dans la base.' });
    }

    // Rule 16 & 21: Check if an active signature already exists for this officer
    const existingActive = await db.get(
      "SELECT id, function_title FROM user_signatures WHERE user_id = ? AND (status = 'ACTIVE' OR is_active = 1)",
      [user_id]
    );

    if (existingActive && force !== 'true' && force !== true) {
      return res.status(409).json({
        conflict: true,
        existing_signature_id: existingActive.id,
        message: `Une autre signature est actuellement active pour ce responsable (${user.first_name} ${user.last_name}). Voulez-vous la désactiver et activer cette nouvelle signature ?`
      });
    }

    const signaturePath = `/uploads/signatures/${req.file.filename}`;

    // Deactivate previous active signatures if replacing (Rule 21)
    if (existingActive) {
      await db.run("UPDATE user_signatures SET status = 'INACTIVE', is_active = 0 WHERE user_id = ?", [user_id]);
      await db.run("UPDATE signature_versions SET is_active = 0 WHERE signature_id = ?", [existingActive.id]);
    }

    const result = await db.run(
      `INSERT INTO user_signatures 
       (user_id, function_title, service_id, signature_image_path, version_number, activation_date, expiration_date, status, is_active, width, height, alignment, created_by)
       VALUES (?, ?, ?, ?, 1, ?, ?, 'ACTIVE', 1, ?, ?, ?, ?)`,
      [
        user_id,
        function_title || user.function_title || 'Responsable Administratif',
        service_id || user.service_id,
        signaturePath,
        activation_date || new Date().toISOString().split('T')[0],
        expiration_date || null,
        width ? parseInt(width) : 150,
        height ? parseInt(height) : 60,
        alignment || 'RIGHT',
        req.user.id
      ]
    );

    const sigId = result.lastID;

    // Save Version 1 entry
    await db.run(
      `INSERT INTO signature_versions (signature_id, version_number, signature_image_path, change_description, is_active, created_by)
       VALUES (?, 1, ?, 'Version initiale v1', 1, ?)`,
      [sigId, signaturePath, req.user.id]
    );

    await logAuditAction(req.user.id, 'CREATE_ELECTRONIC_SIGNATURE', 'SIGNATURE', sigId, req, {
      user_id,
      user_name: `${user.first_name} ${user.last_name}`,
      signaturePath
    });

    res.status(201).json({
      success: true,
      message: `Signature électronique enregistrée et activée avec succès pour ${user.first_name} ${user.last_name}.`,
      id: sigId,
      signature_url: signaturePath
    });
  } catch (err) {
    console.error('Create signature error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la signature électronique.' });
  }
});

// 4. PUT /api/signatures/:id/toggle - Activate / Deactivate signature (Rule 17)
router.put('/:id/toggle', authenticateToken, requirePermission('signatures.manage'), async (req, res) => {
  const { id } = req.params;

  try {
    const sig = await db.get('SELECT * FROM user_signatures WHERE id = ?', [id]);
    if (!sig) return res.status(404).json({ error: 'Signature non trouvée.' });

    const newActiveState = sig.is_active === 1 ? 0 : 1;
    const newStatus = newActiveState === 1 ? 'ACTIVE' : 'INACTIVE';

    if (newActiveState === 1) {
      // Deactivate other active signatures for same user (Rule 21)
      await db.run("UPDATE user_signatures SET status = 'INACTIVE', is_active = 0 WHERE user_id = ? AND id != ?", [sig.user_id, id]);
    }

    await db.run(
      'UPDATE user_signatures SET status = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newStatus, newActiveState, id]
    );

    await logAuditAction(req.user.id, 'TOGGLE_SIGNATURE_STATUS', 'SIGNATURE', id, req, { status: newStatus });

    res.json({
      success: true,
      message: `Signature électronique ${newActiveState === 1 ? 'activée' : 'désactivée'} avec succès.`
    });
  } catch (err) {
    console.error('Toggle signature status error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de statut de la signature.' });
  }
});

// 4b. PUT /api/signatures/:id - Update signature metadata and/or replace image
router.put('/:id', authenticateToken, requirePermission('signatures.manage'), uploadSig.single('signature'), async (req, res) => {
  const { id } = req.params;
  const { function_title, service_id, activation_date, expiration_date, is_active, status } = req.body;

  try {
    const existing = await db.get('SELECT * FROM user_signatures WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Signature non trouvée.' });

    let signaturePath = existing.signature_image_path;
    let versionNum = existing.version_number || 1;

    if (req.file) {
      signaturePath = `/uploads/signatures/${req.file.filename}`;
      versionNum += 1;
      await db.run('UPDATE signature_versions SET is_active = 0 WHERE signature_id = ?', [id]);
      await db.run(
        `INSERT INTO signature_versions (signature_id, version_number, signature_image_path, change_description, is_active, created_by)
         VALUES (?, ?, ?, 'Mise à jour / Remplacement de signature', 1, ?)`,
        [id, versionNum, signaturePath, req.user.id]
      );
    }

    const newActive = is_active !== undefined ? (is_active === '1' || is_active === 1 || is_active === true || is_active === 'true' ? 1 : 0) : existing.is_active;
    const newStatus = status || (newActive === 1 ? 'ACTIVE' : 'INACTIVE');

    if (newActive === 1 && existing.is_active === 0) {
      // Deactivate any other active signature for this user (Rule 21)
      await db.run("UPDATE user_signatures SET status = 'INACTIVE', is_active = 0 WHERE user_id = ? AND id != ?", [existing.user_id, id]);
    }

    await db.run(
      `UPDATE user_signatures SET
         function_title = ?, service_id = ?, signature_image_path = ?, version_number = ?,
         activation_date = ?, expiration_date = ?, status = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        function_title !== undefined && function_title !== null ? function_title : existing.function_title,
        service_id !== undefined ? (service_id || null) : existing.service_id,
        signaturePath,
        versionNum,
        activation_date || existing.activation_date,
        expiration_date !== undefined ? expiration_date : existing.expiration_date,
        newStatus,
        newActive,
        id
      ]
    );

    await logAuditAction(req.user.id, 'UPDATE_ELECTRONIC_SIGNATURE', 'SIGNATURE', id, req, {
      function_title,
      versionNum,
      newActive
    });

    res.json({
      success: true,
      message: 'Signature électronique mise à jour avec succès.',
      signature_url: signaturePath,
      version_number: versionNum
    });
  } catch (err) {
    console.error('Update signature error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la signature.' });
  }
});

// 5. POST /api/signatures/:id/versions - Add new signature version (Rule 18)
router.post('/:id/versions', authenticateToken, requirePermission('signatures.manage'), uploadSig.single('signature'), async (req, res) => {
  const { id } = req.params;
  const { change_description } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Fichier de signature obligatoire pour la nouvelle version.' });
  }

  try {
    const sig = await db.get('SELECT * FROM user_signatures WHERE id = ?', [id]);
    if (!sig) return res.status(404).json({ error: 'Signature non trouvée.' });

    const newVersionNum = (sig.version_number || 1) + 1;
    const signaturePath = `/uploads/signatures/${req.file.filename}`;

    // Archive previous versions
    await db.run('UPDATE signature_versions SET is_active = 0 WHERE signature_id = ?', [id]);

    // Insert version 
    await db.run(
      `INSERT INTO signature_versions (signature_id, version_number, signature_image_path, change_description, is_active, created_by)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [id, newVersionNum, signaturePath, change_description || `Version v${newVersionNum}`, req.user.id]
    );

    // Update main signature record
    await db.run(
      `UPDATE user_signatures SET signature_image_path = ?, version_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [signaturePath, newVersionNum, id]
    );

    await logAuditAction(req.user.id, 'NEW_SIGNATURE_VERSION', 'SIGNATURE', id, req, { version: newVersionNum });

    res.json({
      success: true,
      message: `Nouvelle version de signature v${newVersionNum} enregistrée avec succès. Les anciens documents conservent leur signature d’origine.`
    });
  } catch (err) {
    console.error('Upload signature version error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la nouvelle version.' });
  }
});

// 6. DELETE /api/signatures/:id - Safe Deletion (Historical signed documents retain their embedded signatures)
router.delete('/:id', authenticateToken, requirePermission('signatures.manage'), async (req, res) => {
  const { id } = req.params;

  try {
    const sig = await db.get('SELECT * FROM user_signatures WHERE id = ?', [id]);
    if (!sig) return res.status(404).json({ error: 'Signature non trouvée.' });

    // Unlink from document_signatures foreign key without breaking historical documents
    try {
      await db.run('UPDATE document_signatures SET signature_id = NULL WHERE signature_id = ?', [id]);
    } catch (e) {
      console.warn('Notice unlinking document_signatures:', e.message);
    }

    // Delete child versions
    await db.run('DELETE FROM signature_versions WHERE signature_id = ?', [id]);

    // Delete signature record
    await db.run('DELETE FROM user_signatures WHERE id = ?', [id]);

    await logAuditAction(req.user.id, 'DELETE_ELECTRONIC_SIGNATURE', 'SIGNATURE', id, req, {
      user_id: sig.user_id,
      function_title: sig.function_title
    });

    res.json({
      success: true,
      message: 'Signature électronique supprimée avec succès. Les documents déjà signés restent intacts avec leur signature.'
    });
  } catch (err) {
    console.error('Delete signature error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la signature.' });
  }
});

module.exports = router;
