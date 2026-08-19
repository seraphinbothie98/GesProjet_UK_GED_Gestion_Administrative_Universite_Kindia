const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR } = require('../config/constants');

// Multer storage for logo images
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const logosDir = path.join(UPLOAD_DIR, 'logos');
    if (!require('fs').existsSync(logosDir)) {
      require('fs').mkdirSync(logosDir, { recursive: true });
    }
    cb(null, logosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `logo_${Date.now()}${ext}`);
  }
});

const uploadLogo = multer({
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format d’image non supporté. Formats acceptés : PNG, JPG, SVG, WEBP'));
    }
  }
});

const { previewReference } = require('../services/numberGenerator');

// GET /api/settings/institution - Fetch University & Institution Settings (Publicly accessible for Login, Header, Sidebar)
router.get('/institution', async (req, res) => {
  try {
    let settings = await db.get('SELECT * FROM institution_settings WHERE id = 1');
    if (!settings) {
      settings = {
        name: 'UNIVERSITÉ DE KINDIA',
        ministry: 'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION',
        address: 'Quartier Foulayah, BP 164, Kindia, Guinée',
        phone: '+224 622 00 00 00',
        email: 'contact@univ-kindia.edu.gn',
        website: 'www.univ-kindia.edu.gn',
        slogan: 'Savoir - Innovation - Excellence',
        logo_path: null,
        secondary_logo_path: null,
        ministry_code: 'MESRS',
        institution_code: 'UK',
        structure_name: 'Rectorat',
        structure_code: 'RECT',
        authority_name: 'Secrétaire Général',
        authority_code: 'SG',
        reference_pattern: '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
        sequence_padding: 4,
        reference_type_patterns: null,
        show_logo_login: 1,
        show_logo_sidebar: 1,
        show_logo_header: 1,
        show_logo_dashboard: 1,
        show_logo_mission: 1,
        show_logo_docs: 1,
        show_logo_pdf: 1,
        show_logo_qr: 1
      };
    }
    res.json(settings);
  } catch (err) {
    console.error('Fetch institution settings error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des paramètres institutionnels.' });
  }
});

// PUT /api/settings/institution - Update Institution Info & Reference Configuration
router.put('/institution', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  const { 
    name, ministry, address, phone, email, website, slogan, header_text, footer_text,
    ministry_code, institution_code, structure_name, structure_code, authority_name, authority_code,
    reference_pattern, sequence_padding, reference_type_patterns,
    show_logo_login, show_logo_sidebar, show_logo_header, show_logo_dashboard,
    show_logo_mission, show_logo_docs, show_logo_pdf, show_logo_qr
  } = req.body;

  try {
    const refTypePatternsString = reference_type_patterns 
      ? (typeof reference_type_patterns === 'object' ? JSON.stringify(reference_type_patterns) : reference_type_patterns)
      : null;

    await db.run(
      `UPDATE institution_settings SET
         name = ?, ministry = ?, address = ?, phone = ?, email = ?, website = ?, slogan = ?,
         header_text = ?, footer_text = ?,
         ministry_code = ?, institution_code = ?, structure_name = ?, structure_code = ?,
         authority_name = ?, authority_code = ?, reference_pattern = ?, sequence_padding = ?,
         reference_type_patterns = ?,
         show_logo_login = ?, show_logo_sidebar = ?, show_logo_header = ?, show_logo_dashboard = ?,
         show_logo_mission = ?, show_logo_docs = ?, show_logo_pdf = ?, show_logo_qr = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`,
      [
        name || 'UNIVERSITÉ DE KINDIA',
        ministry || '',
        address || '',
        phone || '',
        email || '',
        website || '',
        slogan || '',
        header_text || '',
        footer_text || '',
        (ministry_code || 'MESRS').trim().toUpperCase(),
        (institution_code || 'UK').trim().toUpperCase(),
        structure_name || 'Rectorat',
        (structure_code || 'RECT').trim().toUpperCase(),
        authority_name || 'Secrétaire Général',
        (authority_code || 'SG').trim().toUpperCase(),
        reference_pattern || '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
        parseInt(sequence_padding) || 4,
        refTypePatternsString,
        show_logo_login ? 1 : 0,
        show_logo_sidebar ? 1 : 0,
        show_logo_header ? 1 : 0,
        show_logo_dashboard ? 1 : 0,
        show_logo_mission ? 1 : 0,
        show_logo_docs ? 1 : 0,
        show_logo_pdf ? 1 : 0,
        show_logo_qr ? 1 : 0
      ]
    );

    await logAuditAction(req.user.id, 'UPDATE_INSTITUTION_SETTINGS', 'SETTINGS', 1, req, { 
      name,
      ministry_code,
      institution_code,
      reference_pattern
    });

    res.json({ success: true, message: 'Paramètres institutionnels et règles de référencement enregistrés avec succès.' });
  } catch (err) {
    console.error('Update institution settings error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres.' });
  }
});

// POST /api/settings/reference-preview - Test live reference generation preview
router.post('/reference-preview', authenticateToken, async (req, res) => {
  try {
    const preview = previewReference(req.body);
    res.json({ preview });
  } catch (err) {
    console.error('Reference preview error:', err);
    res.status(500).json({ error: 'Erreur lors de la prévisualisation de la référence.' });
  }
});

// POST /api/settings/upload-logo - Upload University Official Logo (Rule 11)
router.post('/upload-logo', authenticateToken, requirePermission('institution.manage'), uploadLogo.single('logo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner un fichier image pour le logo.' });
  }

  try {
    const isSecondary = req.body.type === 'secondary';
    const logoUrl = `/uploads/logos/${req.file.filename}`;

    if (isSecondary) {
      await db.run('UPDATE institution_settings SET secondary_logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [logoUrl]);
    } else {
      await db.run('UPDATE institution_settings SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [logoUrl]);
    }

    await logAuditAction(req.user.id, 'UPLOAD_LOGO', 'SETTINGS', 1, req, { logoUrl, isSecondary });

    res.json({
      success: true,
      message: 'Logo institutionnel importé avec succès.',
      logo_url: logoUrl
    });
  } catch (err) {
    console.error('Upload logo error:', err);
    res.status(500).json({ error: 'Erreur lors de l’importation du logo.' });
  }
});

module.exports = router;
