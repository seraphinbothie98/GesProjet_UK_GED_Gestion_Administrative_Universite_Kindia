const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR } = require('../config/constants');

// Multer storage for logo & visual assets
const visualStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const logosDir = path.join(UPLOAD_DIR, 'logos');
    if (!fs.existsSync(logosDir)) {
      fs.mkdirSync(logosDir, { recursive: true });
    }
    cb(null, logosDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const prefix = req.path.includes('watermark') ? 'watermark' : (req.path.includes('background') ? 'login_bg' : 'logo');
    cb(null, `${prefix}_${Date.now()}${ext}`);
  }
});

const uploadImage = multer({
  storage: visualStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format d’image non supporté. Formats acceptés : PNG, JPG, JPEG, SVG, WEBP'));
    }
  }
});

const { previewReference } = require('../services/numberGenerator');

// GET /api/settings/institution - Fetch University & Institution Settings
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
        logo_path: '/uploads/logos/logo_univ_kindia_officiel.png',
        secondary_logo_path: null,
        watermark_path: '/uploads/logos/watermark_guinee_officiel.jpg',
        watermark_opacity: 0.12,
        watermark_size: 360,
        watermark_position_x: 0,
        watermark_position_y: 0,
        watermark_rotation: 0,
        watermark_enabled: 1,
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
        show_logo_qr: 1,
        login_background_path: '/uploads/logos/login_bg_default.jpg',
        show_login_background: 1,
        login_background_overlay: 0.15,
        login_background_duration: 6
      };
    }
    res.json(settings);
  } catch (err) {
    console.error('Fetch institution settings error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des paramètres institutionnels.' });
  }
});

// PUT /api/settings/institution - Update Institution Info, Visual Assets & Reference Configuration
router.put('/institution', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  const { 
    name, ministry, address, phone, email, website, slogan, header_text, footer_text,
    logo_path, secondary_logo_path, watermark_path, watermark_opacity, watermark_size,
    watermark_position_x, watermark_position_y, watermark_rotation, watermark_enabled,
    ministry_code, institution_code, structure_name, structure_code, authority_name, authority_code,
    reference_pattern, sequence_padding, reference_type_patterns,
    show_logo_login, show_logo_sidebar, show_logo_header, show_logo_dashboard,
    show_logo_mission, show_logo_docs, show_logo_pdf, show_logo_qr,
    rector_name, rector_title, rector_photo_path, rector_welcome_message, show_rector_login,
    login_background_path, show_login_background, login_background_overlay, login_background_duration
  } = req.body;

  try {
    const refTypePatternsString = reference_type_patterns 
      ? (typeof reference_type_patterns === 'object' ? JSON.stringify(reference_type_patterns) : reference_type_patterns)
      : null;

    await db.run(
      `UPDATE institution_settings SET
         name = ?, ministry = ?, address = ?, phone = ?, email = ?, website = ?, slogan = ?,
         header_text = ?, footer_text = ?,
         logo_path = COALESCE(?, logo_path),
         secondary_logo_path = ?,
         watermark_path = COALESCE(?, watermark_path),
         watermark_opacity = ?,
         watermark_size = ?,
         watermark_position_x = ?,
         watermark_position_y = ?,
         watermark_rotation = ?,
         watermark_enabled = ?,
         ministry_code = ?, institution_code = ?, structure_name = ?, structure_code = ?,
         authority_name = ?, authority_code = ?, reference_pattern = ?, sequence_padding = ?,
         reference_type_patterns = ?,
         show_logo_login = ?, show_logo_sidebar = ?, show_logo_header = ?, show_logo_dashboard = ?,
         show_logo_mission = ?, show_logo_docs = ?, show_logo_pdf = ?, show_logo_qr = ?,
         rector_name = ?, rector_title = ?,
         rector_photo_path = COALESCE(?, rector_photo_path),
         rector_welcome_message = ?,
         show_rector_login = ?,
         login_background_path = COALESCE(?, login_background_path),
         show_login_background = ?,
         login_background_overlay = ?,
         login_background_duration = ?,
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
        logo_path ? logo_path.split('?')[0] : null,
        secondary_logo_path ? secondary_logo_path.split('?')[0] : null,
        watermark_path ? watermark_path.split('?')[0] : null,
        watermark_opacity !== undefined ? parseFloat(watermark_opacity) : 0.12,
        watermark_size !== undefined ? parseInt(watermark_size) : 360,
        watermark_position_x !== undefined ? parseInt(watermark_position_x) : 0,
        watermark_position_y !== undefined ? parseInt(watermark_position_y) : 0,
        watermark_rotation !== undefined ? parseInt(watermark_rotation) : 0,
        watermark_enabled !== undefined ? (watermark_enabled ? 1 : 0) : 1,
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
        show_logo_qr ? 1 : 0,
        rector_name || 'Pr AKOYE MASSA ZOUMANIGUI',
        rector_title || 'Recteur de l\'Université de Kindia',
        rector_photo_path ? rector_photo_path.split('?')[0] : null,
        rector_welcome_message || 'Bienvenue sur la plateforme numérique officielle UK-GED de l\'Université de Kindia. Notre engagement est de garantir la transparence, la célérité et la traçabilité intégrale de nos actes administratifs et académiques.',
        show_rector_login !== undefined ? (show_rector_login ? 1 : 0) : 1,
        login_background_path ? login_background_path.split('?')[0] : null,
        show_login_background !== undefined ? (show_login_background ? 1 : 0) : 1,
        login_background_overlay !== undefined ? parseFloat(login_background_overlay) : 0.15,
        parseInt(login_background_duration) || 6
      ]
    );

    await logAuditAction(req.user.id, 'UPDATE_INSTITUTION_SETTINGS', 'SETTINGS', 1, req, { 
      name,
      ministry_code,
      institution_code,
      reference_pattern,
      logo_path,
      watermark_path
    });

    res.json({ success: true, message: 'Identité visuelle et paramètres institutionnels enregistrés avec succès.' });
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

// POST /api/settings/upload-logo - Upload University Official Logo
router.post('/upload-logo', authenticateToken, requirePermission('institution.manage'), uploadImage.single('logo'), async (req, res) => {
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

// POST /api/settings/upload-watermark - Upload Official Watermark ("Guinée")
router.post('/upload-watermark', authenticateToken, requirePermission('institution.manage'), uploadImage.single('watermark'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner un fichier image pour le filigrane.' });
  }

  try {
    const watermarkUrl = `/uploads/logos/${req.file.filename}`;

    await db.run(
      `UPDATE institution_settings SET 
         watermark_path = ?, 
         watermark_enabled = 1,
         updated_at = CURRENT_TIMESTAMP 
       WHERE id = 1`, 
      [watermarkUrl]
    );

    await logAuditAction(req.user.id, 'UPLOAD_WATERMARK', 'SETTINGS', 1, req, { watermarkUrl });

    res.json({
      success: true,
      message: 'Image du filigrane officiel importée avec succès.',
      watermark_url: watermarkUrl
    });
  } catch (err) {
    console.error('Upload watermark error:', err);
    res.status(500).json({ error: 'Erreur lors de l’importation du filigrane.' });
  }
});

// DELETE /api/settings/logo - Remove or reset logo
router.delete('/logo', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  try {
    await db.run(`UPDATE institution_settings SET logo_path = '/uploads/logos/logo_univ_kindia_officiel.png', updated_at = CURRENT_TIMESTAMP WHERE id = 1`);
    await logAuditAction(req.user.id, 'RESET_LOGO', 'SETTINGS', 1, req);
    res.json({ success: true, message: 'Logo réinitialisé vers le logo officiel par défaut.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du logo.' });
  }
});

// DELETE /api/settings/watermark - Remove or disable watermark
router.delete('/watermark', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  try {
    await db.run(`UPDATE institution_settings SET watermark_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1`);
    await logAuditAction(req.user.id, 'DISABLE_WATERMARK', 'SETTINGS', 1, req);
    res.json({ success: true, message: 'Filigrane désactivé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la désactivation du filigrane.' });
  }
});

// POST /api/settings/upload-rector-photo - Upload Official Rector Portrait
router.post('/upload-rector-photo', authenticateToken, requirePermission('institution.manage'), uploadImage.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner un fichier image pour la photo du Recteur.' });
  }

  try {
    const photoUrl = `/uploads/logos/${req.file.filename}`;

    await db.run(
      `UPDATE institution_settings SET 
         rector_photo_path = ?, 
         updated_at = CURRENT_TIMESTAMP 
       WHERE id = 1`, 
      [photoUrl]
    );

    await logAuditAction(req.user.id, 'UPLOAD_RECTOR_PHOTO', 'SETTINGS', 1, req, { photoUrl });

    res.json({
      success: true,
      message: 'Photo officielle du Recteur importée avec succès.',
      photo_url: photoUrl
    });
  } catch (err) {
    console.error('Upload rector photo error:', err);
    res.status(500).json({ error: 'Erreur lors de l’importation de la photo du Recteur.' });
  }
});

// DELETE /api/settings/rector-photo - Reset rector photo to default
router.delete('/rector-photo', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  try {
    await db.run(`UPDATE institution_settings SET rector_photo_path = '/uploads/logos/rector_portrait.jpg', updated_at = CURRENT_TIMESTAMP WHERE id = 1`);
    await logAuditAction(req.user.id, 'RESET_RECTOR_PHOTO', 'SETTINGS', 1, req);
    res.json({ success: true, message: 'Photo du Recteur réinitialisée vers la photo par défaut.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la réinitialisation de la photo du Recteur.' });
  }
});

// POST /api/settings/upload-login-background - Upload Custom Login Background Image
router.post('/upload-login-background', authenticateToken, requirePermission('institution.manage'), uploadImage.single('background'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner un fichier image pour l\'arrière-plan.' });
  }

  try {
    const backgroundUrl = `/uploads/logos/${req.file.filename}`;

    await db.run(
      `UPDATE institution_settings SET 
         login_background_path = ?, 
         show_login_background = 1,
         updated_at = CURRENT_TIMESTAMP 
       WHERE id = 1`, 
      [backgroundUrl]
    );

    await logAuditAction(req.user.id, 'UPLOAD_LOGIN_BACKGROUND', 'SETTINGS', 1, req, { backgroundUrl });

    res.json({
      success: true,
      message: 'Image d\'arrière-plan de connexion importée avec succès.',
      background_url: backgroundUrl
    });
  } catch (err) {
    console.error('Upload login background error:', err);
    res.status(500).json({ error: 'Erreur lors de l’importation de l\'arrière-plan.' });
  }
});

// DELETE /api/settings/login-background - Reset login background to default
router.delete('/login-background', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  try {
    await db.run(`UPDATE institution_settings SET login_background_path = '/uploads/logos/login_bg_default.jpg', show_login_background = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1`);
    await logAuditAction(req.user.id, 'RESET_LOGIN_BACKGROUND', 'SETTINGS', 1, req);
    res.json({ success: true, message: 'Arrière-plan de connexion réinitialisé vers l\'image officielle par défaut.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la réinitialisation de l\'arrière-plan.' });
  }
});

// =========================================================================
// MULTI-BACKGROUND SLIDESHOW (ARRIÈRE-PLANS MULTIPLES EN DÉFILEMENT SLIDE)
// =========================================================================

// GET /api/settings/backgrounds - Public list of active background slides
router.get('/backgrounds', async (req, res) => {
  try {
    const backgrounds = await db.all(
      'SELECT id, title, image_path, display_order, is_active FROM institution_backgrounds WHERE is_active = 1 ORDER BY display_order ASC, id ASC'
    );
    res.json({ backgrounds: backgrounds || [] });
  } catch (err) {
    console.error('Fetch public backgrounds error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des arrière-plans.' });
  }
});

// GET /api/settings/admin/backgrounds - Admin list of all background slides
router.get('/admin/backgrounds', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  try {
    const backgrounds = await db.all(
      'SELECT * FROM institution_backgrounds ORDER BY display_order ASC, id ASC'
    );
    res.json({ backgrounds: backgrounds || [] });
  } catch (err) {
    console.error('Fetch admin backgrounds error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des arrière-plans.' });
  }
});

// POST /api/settings/backgrounds - Add a new background slide
router.post('/backgrounds', authenticateToken, requirePermission('institution.manage'), uploadImage.single('image'), async (req, res) => {
  try {
    let imagePath = req.body.image_path;
    if (req.file) {
      imagePath = `/uploads/logos/${req.file.filename}`;
    }

    if (!imagePath) {
      return res.status(400).json({ error: 'Veuillez sélectionner un fichier image.' });
    }

    const title = req.body.title ? req.body.title.trim() : 'Vue du Campus';
    const maxOrder = await db.get('SELECT COALESCE(MAX(display_order), 0) as max_ord FROM institution_backgrounds');
    const newOrder = maxOrder.max_ord + 1;

    const result = await db.run(
      'INSERT INTO institution_backgrounds (title, image_path, display_order, is_active) VALUES (?, ?, ?, 1)',
      [title, imagePath, newOrder]
    );

    const newSlide = await db.get('SELECT * FROM institution_backgrounds WHERE id = ?', [result.lastID]);
    await logAuditAction(req.user.id, 'CREATE_BACKGROUND_SLIDE', 'SETTINGS', result.lastID, req, { title, imagePath });

    res.status(201).json({
      success: true,
      message: 'Nouvel arrière-plan ajouté avec succès.',
      background: newSlide
    });
  } catch (err) {
    console.error('Create background slide error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout de l\'arrière-plan.' });
  }
});

// PUT /api/settings/backgrounds/:id - Update background slide details
router.put('/backgrounds/:id', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  const slideId = parseInt(req.params.id);
  const { title, is_active, display_order } = req.body;

  try {
    const existing = await db.get('SELECT * FROM institution_backgrounds WHERE id = ?', [slideId]);
    if (!existing) {
      return res.status(404).json({ error: 'Arrière-plan introuvable.' });
    }

    await db.run(
      `UPDATE institution_backgrounds SET
         title = ?,
         is_active = ?,
         display_order = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title !== undefined ? title.trim() : existing.title,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        display_order !== undefined ? parseInt(display_order) : existing.display_order,
        slideId
      ]
    );

    const updated = await db.get('SELECT * FROM institution_backgrounds WHERE id = ?', [slideId]);
    await logAuditAction(req.user.id, 'UPDATE_BACKGROUND_SLIDE', 'SETTINGS', slideId, req, { title });

    res.json({
      success: true,
      message: 'Arrière-plan mis à jour.',
      background: updated
    });
  } catch (err) {
    console.error('Update background slide error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'arrière-plan.' });
  }
});

// DELETE /api/settings/backgrounds/:id - Delete a background slide
router.delete('/backgrounds/:id', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  const slideId = parseInt(req.params.id);

  try {
    const existing = await db.get('SELECT * FROM institution_backgrounds WHERE id = ?', [slideId]);
    if (!existing) {
      return res.status(404).json({ error: 'Arrière-plan introuvable.' });
    }

    await db.run('DELETE FROM institution_backgrounds WHERE id = ?', [slideId]);
    await logAuditAction(req.user.id, 'DELETE_BACKGROUND_SLIDE', 'SETTINGS', slideId, req, { title: existing.title });

    res.json({
      success: true,
      message: `L'arrière-plan « ${existing.title} » a été supprimé.`
    });
  } catch (err) {
    console.error('Delete background slide error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

// POST /api/settings/backgrounds/reorder - Reorder background slides
router.post('/backgrounds/reorder', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  const { ordered_ids } = req.body;
  if (!Array.isArray(ordered_ids)) {
    return res.status(400).json({ error: 'ordered_ids doit être un tableau d\'identifiants.' });
  }

  try {
    for (let i = 0; i < ordered_ids.length; i++) {
      await db.run('UPDATE institution_backgrounds SET display_order = ? WHERE id = ?', [i + 1, ordered_ids[i]]);
    }

    res.json({ success: true, message: 'Ordre de défilement des arrière-plans mis à jour.' });
  } catch (err) {
    console.error('Reorder background slides error:', err);
    res.status(500).json({ error: 'Erreur lors de la réorganisation.' });
  }
});

// =========================================================================
// INSTITUTION LEADERS & MULTI-SPEAKER CAROUSEL (PAGE DE CONNEXION)
// =========================================================================

// GET /api/settings/leaders - Public list of active leaders for login carousel
router.get('/leaders', async (req, res) => {
  try {
    const leaders = await db.all(
      'SELECT id, name, title, subtitle, photo_path, welcome_message, display_order, is_active FROM institution_leaders WHERE is_active = 1 ORDER BY display_order ASC, id ASC'
    );
    res.json({ leaders: leaders || [] });
  } catch (err) {
    console.error('Fetch public leaders error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des responsables.' });
  }
});

// GET /api/settings/admin/leaders - Admin list of all leaders
router.get('/admin/leaders', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  try {
    const leaders = await db.all(
      'SELECT * FROM institution_leaders ORDER BY display_order ASC, id ASC'
    );
    res.json({ leaders: leaders || [] });
  } catch (err) {
    console.error('Fetch admin leaders error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de la liste des responsables.' });
  }
});

// POST /api/settings/leaders - Add a new leader
router.post('/leaders', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  const { name, title, subtitle, photo_path, welcome_message, is_active, display_order } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom du responsable est obligatoire.' });
  }
  if (!welcome_message || !welcome_message.trim()) {
    return res.status(400).json({ error: 'Le mot de bienvenue est obligatoire.' });
  }

  try {
    // Get max display order
    const maxOrder = await db.get('SELECT COALESCE(MAX(display_order), 0) as max_ord FROM institution_leaders');
    const newOrder = display_order !== undefined ? parseInt(display_order) : (maxOrder.max_ord + 1);

    const result = await db.run(
      `INSERT INTO institution_leaders (name, title, subtitle, photo_path, welcome_message, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        (title || 'Responsable').trim(),
        (subtitle || '').trim(),
        photo_path ? photo_path.split('?')[0] : '/uploads/logos/rector_portrait.jpg',
        welcome_message.trim(),
        newOrder,
        is_active !== undefined ? (is_active ? 1 : 0) : 1
      ]
    );

    const newLeader = await db.get('SELECT * FROM institution_leaders WHERE id = ?', [result.lastID]);
    await logAuditAction(req.user.id, 'CREATE_INSTITUTION_LEADER', 'SETTINGS', result.lastID, req, { name, title });

    res.status(201).json({
      success: true,
      message: 'Nouveau responsable ajouté avec succès.',
      leader: newLeader
    });
  } catch (err) {
    console.error('Create leader error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du responsable.' });
  }
});

// PUT /api/settings/leaders/:id - Update leader info
router.put('/leaders/:id', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  const leaderId = parseInt(req.params.id);
  const { name, title, subtitle, photo_path, welcome_message, is_active, display_order } = req.body;

  try {
    const existing = await db.get('SELECT * FROM institution_leaders WHERE id = ?', [leaderId]);
    if (!existing) {
      return res.status(404).json({ error: 'Responsable introuvable.' });
    }

    const cleanPhotoPath = photo_path ? photo_path.split('?')[0] : existing.photo_path;

    await db.run(
      `UPDATE institution_leaders SET
         name = ?,
         title = ?,
         subtitle = ?,
         photo_path = ?,
         welcome_message = ?,
         is_active = ?,
         display_order = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name !== undefined ? name.trim() : existing.name,
        title !== undefined ? title.trim() : existing.title,
        subtitle !== undefined ? subtitle.trim() : existing.subtitle,
        cleanPhotoPath,
        welcome_message !== undefined ? welcome_message.trim() : existing.welcome_message,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        display_order !== undefined ? parseInt(display_order) : existing.display_order,
        leaderId
      ]
    );

    const updatedLeader = await db.get('SELECT * FROM institution_leaders WHERE id = ?', [leaderId]);
    await logAuditAction(req.user.id, 'UPDATE_INSTITUTION_LEADER', 'SETTINGS', leaderId, req, { name, title });

    res.json({
      success: true,
      message: 'Informations du responsable mises à jour.',
      leader: updatedLeader
    });
  } catch (err) {
    console.error('Update leader error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du responsable.' });
  }
});

// POST /api/settings/leaders/:id/photo - Upload a specific photo for a leader
router.post('/leaders/:id/photo', authenticateToken, requirePermission('institution.manage'), uploadImage.single('photo'), async (req, res) => {
  const leaderId = parseInt(req.params.id);
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner un fichier image.' });
  }

  try {
    const existing = await db.get('SELECT * FROM institution_leaders WHERE id = ?', [leaderId]);
    if (!existing) {
      return res.status(404).json({ error: 'Responsable introuvable.' });
    }

    const photoUrl = `/uploads/logos/${req.file.filename}`;
    await db.run(
      'UPDATE institution_leaders SET photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [photoUrl, leaderId]
    );

    // If this is leader #1 (or rector), also keep institution_settings updated for consistency
    if (leaderId === 1 || existing.title?.toLowerCase().includes('recteur')) {
      await db.run('UPDATE institution_settings SET rector_photo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [photoUrl]);
    }

    await logAuditAction(req.user.id, 'UPLOAD_LEADER_PHOTO', 'SETTINGS', leaderId, req, { photoUrl });

    res.json({
      success: true,
      message: 'Photo du responsable enregistrée avec succès.',
      photo_url: photoUrl
    });
  } catch (err) {
    console.error('Upload leader photo error:', err);
    res.status(500).json({ error: 'Erreur lors de l’importation de la photo du responsable.' });
  }
});

// DELETE /api/settings/leaders/:id - Delete a leader
router.delete('/leaders/:id', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  const leaderId = parseInt(req.params.id);

  try {
    const existing = await db.get('SELECT * FROM institution_leaders WHERE id = ?', [leaderId]);
    if (!existing) {
      return res.status(404).json({ error: 'Responsable introuvable.' });
    }

    await db.run('DELETE FROM institution_leaders WHERE id = ?', [leaderId]);
    await logAuditAction(req.user.id, 'DELETE_INSTITUTION_LEADER', 'SETTINGS', leaderId, req, { name: existing.name });

    res.json({
      success: true,
      message: `Le responsable « ${existing.name} » a été supprimé.`
    });
  } catch (err) {
    console.error('Delete leader error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du responsable.' });
  }
});

// POST /api/settings/leaders/reorder - Reorder leaders list
router.post('/leaders/reorder', authenticateToken, requirePermission('institution.manage'), async (req, res) => {
  const { ordered_ids } = req.body;
  if (!Array.isArray(ordered_ids)) {
    return res.status(400).json({ error: 'ordered_ids doit être un tableau d\'identifiants.' });
  }

  try {
    for (let i = 0; i < ordered_ids.length; i++) {
      await db.run('UPDATE institution_leaders SET display_order = ? WHERE id = ?', [i + 1, ordered_ids[i]]);
    }

    res.json({ success: true, message: 'Ordre de passage mis à jour avec succès.' });
  } catch (err) {
    console.error('Reorder leaders error:', err);
    res.status(500).json({ error: 'Erreur lors de la réorganisation.' });
  }
});

module.exports = router;

