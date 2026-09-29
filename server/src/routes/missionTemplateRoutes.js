const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const JSZip = require('jszip');
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR } = require('../config/constants');

// Ensure directories exist
const templateUploadDir = path.join(UPLOAD_DIR, 'templates');
const logoUploadDir = path.join(UPLOAD_DIR, 'logos');
if (!fs.existsSync(templateUploadDir)) fs.mkdirSync(templateUploadDir, { recursive: true });
if (!fs.existsSync(logoUploadDir)) fs.mkdirSync(logoUploadDir, { recursive: true });

// Standard official dynamic fields recognized by UK-GED
const OFFICIAL_DYNAMIC_FIELDS = [
  'reference', 'titre_grade', 'grade_titre', 'grade', 'titre', 'nom', 'prenoms', 'nom_complet', 'nationalite', 'fonction', 'service', 
  'matricule', 'destination', 'objet_mission', 'moyen_transport', 
  'date_depart', 'date_retour', 'chauffeur', 'date_document', 'date_signature',
  'lieu_document', 'nom_secretaire_general', 'signataire_nom', 'signataire_role',
  'qr_code', 'cachet', 'cachet_officiel', 'signature', 'signature_sg', 'signature_signataire'
];

/**
 * Helper: Extract all {{field}} tags from a DOCX file using JSZip
 */
async function extractDocxDynamicFields(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { detected: [], known: [], unknown: [] };
    }
    const data = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(data);
    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      return { detected: [], known: [], unknown: [] };
    }
    const xmlContent = await docXmlFile.async('string');
    
    // Strip XML tags to reconstruct continuous text flow
    const cleanText = xmlContent.replace(/<[^>]+>/g, '');
    
    // Match {{tag}} format (with optional spaces inside or between braces)
    const regex = /\{\s*\{\s*([a-zA-Z0-9_\-\s\/\\]+?)\s*\}\s*\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(cleanText)) !== null) {
      if (match[1]) matches.push(match[1].trim());
    }
    const uniqueTags = Array.from(new Set(matches));
    
    const isTagKnown = (t) => {
      const normalized = t.toLowerCase().replace(/[\/\\]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_');
      return OFFICIAL_DYNAMIC_FIELDS.includes(t.toLowerCase()) || 
             OFFICIAL_DYNAMIC_FIELDS.includes(normalized) ||
             OFFICIAL_DYNAMIC_FIELDS.some(f => f.replace(/_/g, ' ') === t.toLowerCase()) ||
             t.toLowerCase().includes('grade') || t.toLowerCase().includes('titre');
    };

    const known = uniqueTags.filter(t => isTagKnown(t));
    const unknown = uniqueTags.filter(t => !isTagKnown(t));

    return {
      detected: uniqueTags,
      known,
      unknown
    };
  } catch (err) {
    console.warn('DOCX dynamic fields extraction note:', err.message);
    return { detected: [], known: [], unknown: [] };
  }
}

/**
 * Helper: Extract all {{field}} tags from a PDF file using PDFParse
 */
async function extractPdfDynamicFields(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { detected: [], known: [], unknown: [], pageCount: 1, message: 'Fichier PDF introuvable.' };
    }
    const { PDFParse } = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    await parser.load();
    const textData = await parser.getText();
    const cleanText = (textData?.text || '');
    const pageCount = textData?.total || textData?.pages?.length || 1;

    // Match {{tag}} format
    const regex = /\{\s*\{\s*([a-zA-Z0-9_\-\s\/\\]+?)\s*\}\s*\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(cleanText)) !== null) {
      if (match[1]) matches.push(match[1].trim());
    }
    const uniqueTags = Array.from(new Set(matches));

    const isTagKnown = (t) => {
      const normalized = t.toLowerCase().replace(/[\/\\]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_');
      return OFFICIAL_DYNAMIC_FIELDS.includes(t.toLowerCase()) || 
             OFFICIAL_DYNAMIC_FIELDS.includes(normalized) ||
             OFFICIAL_DYNAMIC_FIELDS.some(f => f.replace(/_/g, ' ') === t.toLowerCase()) ||
             t.toLowerCase().includes('grade') || t.toLowerCase().includes('titre') || t.toLowerCase().includes('signataire');
    };

    const known = uniqueTags.filter(t => isTagKnown(t));
    const unknown = uniqueTags.filter(t => !isTagKnown(t));

    const message = uniqueTags.length > 0 
      ? `${uniqueTags.length} balise(s) dynamique(s) détectée(s) dans le document PDF.`
      : 'Aucun champ dynamique détecté automatiquement. Vous pouvez placer manuellement les champs depuis le Studio graphique.';

    return {
      detected: uniqueTags,
      known,
      unknown,
      pageCount,
      message
    };
  } catch (err) {
    console.warn('PDF dynamic fields extraction note:', err.message);
    return { 
      detected: [], 
      known: [], 
      unknown: [], 
      pageCount: 1, 
      message: 'Aucun champ dynamique détecté automatiquement. Vous pouvez placer manuellement les champs depuis le Studio graphique.' 
    };
  }
}

// Multer Storage Configuration for DOCX/PDF Templates
const templateStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, templateUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `om_template_${Date.now()}_${baseName}${ext}`);
  }
});

const uploadTemplate = multer({
  storage: templateStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.docx', '.doc', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Veuillez importer un fichier Word (.docx) ou PDF (.pdf).'));
    }
  }
});

// Multer Storage Configuration for Visual Identity (Logo & Watermark)
const brandingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logoUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const prefix = req.path.includes('watermark') ? 'watermark_kindia' : 'logo_kindia';
    cb(null, `${prefix}_${Date.now()}${ext}`);
  }
});

const uploadBranding = multer({
  storage: brandingStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format d’image non supporté. Formats acceptés : PNG, JPG, JPEG, WEBP, SVG.'));
    }
  }
});

// Strict Administrator Guard
function requireAdminOnly(req, res, next) {
  if (req.user && (req.user.role_code === 'ADMINISTRATEUR' || req.user.role_code === 'ADMIN')) {
    return next();
  }
  return res.status(403).json({ 
    error: 'Accès refusé. Seul l’Administrateur système est autorisé à gérer le modèle officiel d’ordre de mission.' 
  });
}

// ============================================================================
// 1. GET /api/mission-template - Full Model Center (Admin)
// ============================================================================
router.get('/', authenticateToken, requireAdminOnly, async (req, res) => {
  try {
    // 1. Fetch current default / active template
    const currentTemplate = await db.get(`
      SELECT * FROM mission_order_templates 
      ORDER BY is_default DESC, (status = 'ACTIVE') DESC, version_number DESC, id DESC 
      LIMIT 1
    `);

    // 2. Fetch all template versions
    const allVersions = await db.all(`
      SELECT m.*, u.first_name || ' ' || u.last_name as author_name
      FROM mission_order_templates m
      LEFT JOIN users u ON m.created_by = u.id
      ORDER BY m.version_number DESC, m.id DESC
    `);

    // 3. Fetch institution visual identity & watermark settings
    const institution = await db.get(`
      SELECT logo_path, watermark_path, watermark_enabled, watermark_opacity, watermark_size, watermark_position_x, watermark_position_y, watermark_rotation
      FROM institution_settings WHERE id = 1
    `) || {};

    // 4. Extract or parse detected dynamic fields for the current template
    let fieldAnalysis = { detected: [], known: [], unknown: [] };
    if (currentTemplate && currentTemplate.file_path) {
      const candidatePaths = [
        path.join(templateUploadDir, path.basename(currentTemplate.file_path)),
        path.join(UPLOAD_DIR, currentTemplate.file_path),
        path.join(UPLOAD_DIR, path.basename(currentTemplate.file_path))
      ];
      const validPath = candidatePaths.find(p => fs.existsSync(p));
      if (validPath) {
        fieldAnalysis = await extractDocxDynamicFields(validPath);
      }
    }

    res.json({
      success: true,
      template: currentTemplate || null,
      versions: allVersions || [],
      branding: {
        logo_path: currentTemplate?.logo_path || institution.logo_path || '/uploads/logos/logo_univ_kindia_officiel.png',
        watermark_path: currentTemplate?.watermark_path || institution.watermark_path || '/uploads/logos/watermark_guinee_officiel.jpg',
        watermark_enabled: currentTemplate?.watermark_enabled !== undefined ? currentTemplate.watermark_enabled : (institution.watermark_enabled !== undefined ? institution.watermark_enabled : 1),
        watermark_opacity: currentTemplate?.watermark_opacity !== undefined ? currentTemplate.watermark_opacity : (institution.watermark_opacity || 0.15),
        watermark_size: currentTemplate?.watermark_size !== undefined ? currentTemplate.watermark_size : (institution.watermark_size || 60),
        watermark_position: currentTemplate?.watermark_position || 'CENTER'
      },
      default_document_format: currentTemplate?.document_format || institution.default_mission_document_format || 'WORD_DOCX',
      availableFields: OFFICIAL_DYNAMIC_FIELDS,
      fieldAnalysis
    });
  } catch (err) {
    console.error('Fetch mission template error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du modèle officiel.' });
  }
});

// ============================================================================
// 2. GET /api/mission-template/active - Active Model for Mission Creation
// ============================================================================
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const template = await db.get(`
      SELECT * FROM mission_order_templates 
      WHERE is_default = 1 OR status = 'ACTIVE' 
      ORDER BY is_default DESC, (status = 'ACTIVE') DESC, version_number DESC, updated_at DESC LIMIT 1
    `);

    const institution = await db.get(`
      SELECT logo_path, watermark_path, watermark_enabled, watermark_opacity, watermark_size, default_mission_document_format 
      FROM institution_settings WHERE id = 1
    `) || {};

    let formatted = null;
    if (template) {
      formatted = {
        ...template,
        code: 'ORDRE_001',
        document_type_code: 'MISSION_ORDER',
        version: template.version_number || 1,
        version_number: template.version_number || 1,
        is_active: template.status === 'ACTIVE' ? 1 : 0,
        is_default: template.is_default !== undefined ? template.is_default : 1
      };
    }

    res.json({ 
      success: true, 
      template: formatted,
      default_document_format: template?.document_format || institution.default_mission_document_format || 'WORD_DOCX',
      branding: {
        logo_path: template?.logo_path || institution.logo_path,
        watermark_path: template?.watermark_path || institution.watermark_path,
        watermark_enabled: template?.watermark_enabled ?? institution.watermark_enabled ?? 1,
        watermark_opacity: template?.watermark_opacity ?? institution.watermark_opacity ?? 0.15,
        watermark_size: template?.watermark_size ?? institution.watermark_size ?? 60
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération du modèle actif.' });
  }
});

// ============================================================================
// 2b. PUT /api/mission-template/default-format - Update Default Document Format (Admin)
// ============================================================================
router.put('/default-format', authenticateToken, requireAdminOnly, async (req, res) => {
  try {
    const { default_format } = req.body;
    const format = (default_format === 'DIRECT_PDF') ? 'DIRECT_PDF' : 'WORD_DOCX';

    await db.run(
      `UPDATE institution_settings SET default_mission_document_format = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
      [format]
    );

    // If switching to DIRECT_PDF, check if active template is DOCX and convert it to Master PDF immediately
    if (format === 'DIRECT_PDF') {
      const activeTemplate = await db.get(`
        SELECT * FROM mission_order_templates 
        WHERE is_default = 1 OR status = 'ACTIVE' 
        ORDER BY is_default DESC, id DESC LIMIT 1
      `);

      if (activeTemplate && (activeTemplate.file_type === 'DOCX' || activeTemplate.file_path.toLowerCase().endsWith('.docx'))) {
        try {
          const { convertSanitizedDocxToMasterPdf } = require('../services/docxToPdfEngine');
          const candidatePaths = [
            path.join(templateUploadDir, path.basename(activeTemplate.file_path)),
            path.join(UPLOAD_DIR, activeTemplate.file_path),
            path.join(UPLOAD_DIR, 'templates', path.basename(activeTemplate.file_path)),
            path.join(UPLOAD_DIR, path.basename(activeTemplate.file_path))
          ];
          const docxPath = candidatePaths.find(p => fs.existsSync(p));
          if (docxPath) {
            console.log(`[SWITCH DIRECT_PDF] Conversion unique et propre du modèle actif DOCX en PDF Maître (sans balises résiduelles)...`);
            const convResult = await convertSanitizedDocxToMasterPdf(docxPath, templateUploadDir);
            const convertedPdfPath = convResult?.pdfPath || (typeof convResult === 'string' ? convResult : null);
            if (convertedPdfPath && fs.existsSync(convertedPdfPath)) {
              const pdfBase = path.basename(convertedPdfPath);
              const pdfName = (activeTemplate.file_name || 'modele_officiel.docx').replace(/\.docx?$/i, '.pdf');
              const pdfSize = fs.statSync(convertedPdfPath).size;

              await db.run(`
                UPDATE mission_order_templates 
                SET file_path = ?, file_name = ?, file_type = 'PDF', file_size = ?, document_format = 'DIRECT_PDF', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [pdfBase, pdfName, pdfSize, activeTemplate.id]);

              try {
                await db.run(`
                  UPDATE document_templates 
                  SET file_path = ?, format = 'PDF' 
                  WHERE code = 'ORDRE_001' OR category = 'Missions' OR document_type_code = 'MISSION_ORDER'
                `, [pdfBase]);
              } catch (e) {}

              console.log(`[SWITCH DIRECT_PDF] ✓ Modèle actif converti en PDF Maître (${pdfBase})`);
            }
          }
        } catch (convErr) {
          console.warn('[SWITCH DIRECT_PDF] Note de conversion automatique:', convErr.message);
        }
      }
    }

    try {
      await db.run(
        `UPDATE mission_order_templates SET document_format = ? WHERE is_default = 1 OR status = 'ACTIVE'`,
        [format]
      );
    } catch (err) {}

    await logAuditAction(req.user.id, 'UPDATE_MISSION_DEFAULT_FORMAT', 'TEMPLATE', null, req, { default_format: format });

    res.json({
      success: true,
      default_document_format: format,
      message: `Format de document par défaut configuré avec succès : ${format === 'DIRECT_PDF' ? 'Format PDF Direct (Signature Instantanée < 1s)' : 'Modèle Word (DOCX) Officiel'}.`
    });
  } catch (err) {
    console.error('Update default format error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du format par défaut.' });
  }
});

// ============================================================================
// 3. POST /api/mission-template/upload - Import or Replace Template File (Admin)
// ============================================================================
router.post('/upload', authenticateToken, requireAdminOnly, uploadTemplate.single('template_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner un fichier modèle (.docx ou .pdf).' });
  }

  try {
    const ext = path.extname(req.file.originalname).toUpperCase().replace('.', '') || 'DOCX';
    const name = req.body.name || 'Ordre de mission officiel';
    const filename = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;
    const filePath = req.file.path;

    // 1. Fetch existing visual identity defaults
    const inst = await db.get(`SELECT logo_path, watermark_path, watermark_enabled, watermark_opacity, watermark_size, default_mission_document_format FROM institution_settings WHERE id = 1`) || {};

    const requestedFormat = req.body.document_format || inst.default_mission_document_format || 'WORD_DOCX';
    let documentFormat = ext === 'PDF' ? 'DIRECT_PDF' : requestedFormat;

    let effectiveFilePath = filename;
    let effectiveFileName = originalName;
    let effectiveFileType = ext;
    let effectiveFileSize = fileSize;

    // 2. Analyze dynamic fields (for DOCX or PDF)
    let fieldAnalysis = { detected: [], known: [], unknown: [] };
    const { getDefaultKindiaFieldCoordinates } = require('../services/pdfService');
    const { convertViaLibreOffice } = require('../services/docxToPdfEngine');
    let defaultCoords = null;

    if (ext === 'DOCX' || ext === 'DOC') {
      fieldAnalysis = await extractDocxDynamicFields(filePath);

      // If DIRECT_PDF mode is active, convert DOCX to Master PDF once for all!
      if (documentFormat === 'DIRECT_PDF') {
        try {
          console.log(`[DIRECT_PDF IMPORT] Conversion unique du modèle DOCX en PDF Maître propre (sans balises textuelles)...`);
          const { convertSanitizedDocxToMasterPdf } = require('../services/docxToPdfEngine');
          const convResult = await convertSanitizedDocxToMasterPdf(filePath, templateUploadDir);
          const convertedPdfPath = convResult?.pdfPath || (typeof convResult === 'string' ? convResult : null);
          if (convertedPdfPath && fs.existsSync(convertedPdfPath)) {
            effectiveFilePath = path.basename(convertedPdfPath);
            effectiveFileName = originalName.replace(/\.docx?$/i, '.pdf');
            effectiveFileType = 'PDF';
            effectiveFileSize = fs.statSync(convertedPdfPath).size;
            console.log(`[DIRECT_PDF IMPORT] ✓ Modèle converti en PDF Maître (${effectiveFilePath})`);
          }
        } catch (convErr) {
          console.warn('[DIRECT_PDF IMPORT] Note de conversion automatique DOCX -> PDF:', convErr.message);
        }
      }

      const defaultCoordsObj = getDefaultKindiaFieldCoordinates();
      const defaultFields = Array.isArray(defaultCoordsObj) ? defaultCoordsObj : (defaultCoordsObj.fields || []);
      defaultCoords = JSON.stringify({
        version: "1.0",
        page_size: { width: 595.28, height: 841.89, orientation: "PORTRAIT" },
        fields: defaultFields
      });
    } else if (ext === 'PDF') {
      fieldAnalysis = await extractPdfDynamicFields(filePath);
      const defaultCoordsObj = getDefaultKindiaFieldCoordinates();
      const defaultFields = Array.isArray(defaultCoordsObj) ? defaultCoordsObj : (defaultCoordsObj.fields || []);
      
      // If the PDF had some tags detected, map them, otherwise prepare clean default field structure
      defaultCoords = JSON.stringify({
        version: "1.0",
        page_size: { width: 595.28, height: 841.89, orientation: "PORTRAIT" },
        fields: defaultFields
      });
    }

    // Compute next version number
    const maxVersionRow = await db.get(`SELECT MAX(version_number) as max_v FROM mission_order_templates`);
    const nextVersion = (maxVersionRow?.max_v || 0) + 1;

    // Reset default flags: strict single default model rule
    await db.run(`UPDATE mission_order_templates SET is_default = 0, status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP`);

    // Insert new version
    const insertResult = await db.run(`
      INSERT INTO mission_order_templates (
        name, file_path, file_name, file_type, file_size, status, version_number, is_default, 
        detected_fields, field_coordinates, document_format, logo_path, watermark_path, watermark_enabled, watermark_opacity, watermark_size, watermark_position,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'CENTER', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      name,
      effectiveFilePath,
      effectiveFileName,
      effectiveFileType,
      effectiveFileSize,
      nextVersion,
      JSON.stringify(fieldAnalysis.detected),
      defaultCoords,
      documentFormat,
      inst.logo_path || '/uploads/logos/logo_univ_kindia_officiel.png',
      inst.watermark_path || '/uploads/logos/watermark_guinee_officiel.jpg',
      inst.watermark_enabled !== undefined ? inst.watermark_enabled : 1,
      inst.watermark_opacity || 0.15,
      inst.watermark_size || 60,
      req.user.id
    ]);

    const createdTemplate = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [insertResult.lastID]);

    // Keep legacy fallback table synchronized
    try {
      await db.run(`DELETE FROM document_templates WHERE code = 'ORDRE_001' OR category = 'Missions' OR document_type_code = 'MISSION_ORDER'`);
      await db.run(`
        INSERT INTO document_templates (code, name, document_type_code, category, file_path, format, is_active, is_default, version, created_by)
        VALUES ('ORDRE_001', ?, 'MISSION_ORDER', 'Missions', ?, ?, 1, 1, ?, ?)
      `, [name, effectiveFilePath, effectiveFileType, nextVersion, req.user.id]);
    } catch (syncErr) {
      console.warn('Sync legacy table notice:', syncErr.message);
    }

    await logAuditAction(req.user.id, 'UPLOAD_MISSION_TEMPLATE', 'MISSION_TEMPLATE', insertResult.lastID, req, {
      name,
      version: nextVersion,
      fileName: effectiveFileName,
      fileType: effectiveFileType,
      documentFormat,
      detectedFields: fieldAnalysis.detected,
      unknownFields: fieldAnalysis.unknown
    });

    const formatMessage = documentFormat === 'DIRECT_PDF'
      ? (ext === 'DOCX' || ext === 'DOC' ? 'converti en PDF Maître optimisé pour la signature instantanée' : 'configuré en format PDF Direct')
      : 'enregistré en modèle Word officiel';

    res.json({
      success: true,
      message: `Modèle officiel ${formatMessage} et défini par défaut avec succès (Version ${nextVersion}). ${fieldAnalysis.detected.length} champ(s) dynamique(s) détecté(s).`,
      template: createdTemplate,
      fieldAnalysis
    });
  } catch (err) {
    console.error('Upload mission template error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement du modèle officiel.' });
  }
});

// ============================================================================
// 3b. PUT /api/mission-template/:id/coordinates - Save Visual Coordinates Mapping (Admin)
// ============================================================================
router.put('/:id/coordinates', authenticateToken, requireAdminOnly, async (req, res) => {
  const { id } = req.params;
  const { field_coordinates } = req.body;

  try {
    const template = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle officiel introuvable.' });
    }

    const coordsString = typeof field_coordinates === 'string' 
      ? field_coordinates 
      : JSON.stringify(field_coordinates || {});

    await db.run(
      'UPDATE mission_order_templates SET field_coordinates = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [coordsString, id]
    );

    await logAuditAction(req.user.id, 'UPDATE_PDF_TEMPLATE_COORDINATES', 'MISSION_TEMPLATE', id, req, {
      version: template.version_number,
      name: template.name
    });

    const updated = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Cartographie des zones et coordonnées PDF enregistrée avec succès.',
      template: updated
    });
  } catch (err) {
    console.error('Save coordinates error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement des coordonnées : ' + err.message });
  }
});

// ============================================================================
// 3c. POST /api/mission-template/preview-direct-pdf - Instant Real PDF Preview with Simulation Data
// ============================================================================
router.post('/preview-direct-pdf', authenticateToken, requireAdminOnly, async (req, res) => {
  try {
    const { template_id, field_coordinates, mock_data } = req.body;
    const { generateDirectPdfFromTemplate, getActiveTemplateForDocumentType } = require('../services/pdfService');

    let templateData = null;
    if (template_id) {
      templateData = await getActiveTemplateForDocumentType('MISSION_ORDER', template_id);
    } else {
      templateData = await getActiveTemplateForDocumentType('MISSION_ORDER');
    }

    if (!templateData) {
      return res.status(404).json({ error: 'Aucun modèle de base trouvé pour l’aperçu.' });
    }

    // Override field coordinates in memory if passed from editor
    if (field_coordinates) {
      templateData.template.field_coordinates = typeof field_coordinates === 'string'
        ? field_coordinates
        : JSON.stringify(field_coordinates);
    }

    const mockSimulationData = {
      reference: 'OM/UK/SG/2026/0001',
      created_at: new Date().toISOString(),
      missionary_name: 'DIALLO',
      missionary_firstnames: 'Mamadou Oury',
      missionary_titre: 'Pr.',
      titre: 'Pr.',
      grade: 'Professeur Titulaire',
      function_title: 'Enseignant-Chercheur • Département de Mathématiques',
      missionary_service: 'Faculté des Sciences et Techniques',
      matricule: 'UK-ENS-042',
      nationality: 'Guinéenne',
      destination: 'Conakry, République de Guinée',
      object_of_mission: 'Participation aux travaux de la Commission Scientifique et Pédagogique Nationale du MESRSI.',
      transport_mode: 'Véhicule de service (Immat: VA-1042-UK)',
      departure_date: '2026-10-05',
      return_date: '2026-10-12',
      driver_name: 'Camara Ibrahima (Chauffeur professionnel UK)',
      driver_option: 'DRIVER',
      vehicle_registration: 'VA-1042-UK',
      tracking_token: 'PREVIEW_SIMULATION_TOKEN_2026',
      ...(mock_data || {})
    };

    const pdfResult = await generateDirectPdfFromTemplate(mockSimulationData, templateData, {
      is_signed: true,
      is_preview: true
    });

    if (!pdfResult || !pdfResult.filePath || !fs.existsSync(pdfResult.filePath)) {
      return res.status(500).json({ error: 'Erreur lors de la génération de l’aperçu PDF.' });
    }

    res.contentType('application/pdf');
    res.sendFile(pdfResult.filePath);
  } catch (err) {
    console.error('Preview direct PDF error:', err);
    res.status(500).json({ error: 'Erreur lors de la prévisualisation : ' + err.message });
  }
});


// ============================================================================
// 4. POST /api/mission-template/upload-revision - Import Revision from Word (Admin)
// ============================================================================
router.post('/upload-revision', authenticateToken, requireAdminOnly, uploadTemplate.single('template_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner le fichier modifié depuis Microsoft Word (.docx).' });
  }

  try {
    const ext = path.extname(req.file.originalname).toUpperCase().replace('.', '') || 'DOCX';
    const filename = req.file.filename;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;
    const filePath = req.file.path;

    // Analyze dynamic tags inside the revised file
    const fieldAnalysis = await extractDocxDynamicFields(filePath);

    // Compute next version
    const maxVersionRow = await db.get(`SELECT MAX(version_number) as max_v FROM mission_order_templates`);
    const nextVersion = (maxVersionRow?.max_v || 0) + 1;

    // Get current template settings
    const current = await db.get(`SELECT * FROM mission_order_templates ORDER BY is_default DESC, id DESC LIMIT 1`) || {};

    // Single default rule: set older versions default = 0
    await db.run(`UPDATE mission_order_templates SET is_default = 0, status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP`);

    // Insert new version
    const insertResult = await db.run(`
      INSERT INTO mission_order_templates (
        name, file_path, file_name, file_type, file_size, status, version_number, is_default, 
        detected_fields, logo_path, watermark_path, watermark_enabled, watermark_opacity, watermark_size, watermark_position,
        created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      current.name || 'Ordre de mission officiel',
      filename,
      originalName,
      ext,
      fileSize,
      nextVersion,
      JSON.stringify(fieldAnalysis.detected),
      current.logo_path || '/uploads/logos/logo_univ_kindia_officiel.png',
      current.watermark_path || '/uploads/logos/watermark_guinee_officiel.jpg',
      current.watermark_enabled !== undefined ? current.watermark_enabled : 1,
      current.watermark_opacity || 0.15,
      current.watermark_size || 60,
      current.watermark_position || 'CENTER',
      req.user.id
    ]);

    const createdTemplate = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [insertResult.lastID]);

    // Keep legacy fallback table synchronized
    try {
      await db.run(`DELETE FROM document_templates WHERE code = 'ORDRE_001' OR category = 'Missions' OR document_type_code = 'MISSION_ORDER'`);
      await db.run(`
        INSERT INTO document_templates (code, name, document_type_code, category, file_path, format, is_active, is_default, version, created_by)
        VALUES ('ORDRE_001', ?, 'MISSION_ORDER', 'Missions', ?, ?, 1, 1, ?, ?)
      `, [current.name || 'Ordre de mission officiel', filename, ext, nextVersion, req.user.id]);
    } catch (syncErr) {}

    await logAuditAction(req.user.id, 'REVISE_MISSION_TEMPLATE_WORD', 'MISSION_TEMPLATE', insertResult.lastID, req, {
      version: nextVersion,
      fileName: originalName,
      detectedFields: fieldAnalysis.detected,
      unknownFields: fieldAnalysis.unknown
    });

    res.json({
      success: true,
      message: `Version ${nextVersion} du modèle officiel enregistrée et définie par défaut avec succès.`,
      template: createdTemplate,
      fieldAnalysis
    });
  } catch (err) {
    console.error('Upload revision error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de la révision Word.' });
  }
});

// ============================================================================
// 5. POST /api/mission-template/analyze - Pre-inspect DOCX for dynamic fields (Admin)
// ============================================================================
router.post('/analyze', authenticateToken, requireAdminOnly, uploadTemplate.single('template_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner un fichier DOCX ou PDF à analyser.' });
  }

  try {
    const ext = path.extname(req.file.originalname).toUpperCase().replace('.', '') || 'DOCX';
    let analysis;
    if (ext === 'PDF') {
      analysis = await extractPdfDynamicFields(req.file.path);
    } else {
      analysis = await extractDocxDynamicFields(req.file.path);
    }
    // Delete temp file after analysis
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.json({
      success: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: ext,
      pageCount: analysis.pageCount || 1,
      message: analysis.message || null,
      detectedFields: analysis.detected,
      knownFields: analysis.known,
      unknownFields: analysis.unknown
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l’analyse du document.' });
  }
});

// ============================================================================
// 6. PUT /api/mission-template/versions/:id/set-default - Set Default Version (Admin)
// ============================================================================
router.put('/versions/:id/set-default', authenticateToken, requireAdminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const targetVersion = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [id]);
    if (!targetVersion) {
      return res.status(404).json({ error: 'Version du modèle introuvable.' });
    }

    // Rule: Single default model - clear all others
    await db.run('UPDATE mission_order_templates SET is_default = 0, status = "INACTIVE", updated_at = CURRENT_TIMESTAMP');
    await db.run('UPDATE mission_order_templates SET is_default = 1, status = "ACTIVE", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

    const updated = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [id]);

    // Sync legacy table
    try {
      await db.run(`UPDATE document_templates SET is_active = 0, is_default = 0 WHERE code = 'ORDRE_001' OR category = 'Missions' OR document_type_code = 'MISSION_ORDER'`);
      await db.run(`
        UPDATE document_templates SET is_active = 1, is_default = 1 
        WHERE file_path = ? OR version = ?
      `, [targetVersion.file_path, targetVersion.version_number]);
    } catch (e) {}

    await logAuditAction(req.user.id, 'SET_DEFAULT_MISSION_TEMPLATE', 'MISSION_TEMPLATE', id, req, {
      version: targetVersion.version_number,
      name: targetVersion.name
    });

    res.json({
      success: true,
      message: `Version ${targetVersion.version_number} définie comme modèle officiel par défaut.`,
      template: updated
    });
  } catch (err) {
    console.error('Set default version error:', err);
    res.status(500).json({ error: 'Erreur lors de la définition du modèle par défaut.' });
  }
});

// ============================================================================
// 6.b DELETE /api/mission-template/versions/:id - Delete a specific version (Admin)
// ============================================================================
router.delete('/versions/:id', authenticateToken, requireAdminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const targetVersion = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [id]);
    if (!targetVersion) {
      return res.status(404).json({ error: 'Version du modèle introuvable.' });
    }

    // Count total versions
    const countRow = await db.get('SELECT COUNT(*) as count FROM mission_order_templates');
    const totalCount = countRow?.count || 1;

    if (totalCount <= 1) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer la seule version restante. Le système nécessite au moins un modèle officiel.' 
      });
    }

    const wasDefault = targetVersion.is_default === 1;

    // Delete record from DB
    await db.run('DELETE FROM mission_order_templates WHERE id = ?', [id]);

    // If the deleted version was default, promote the newest remaining version to default
    if (wasDefault) {
      const newestRemaining = await db.get(`
        SELECT * FROM mission_order_templates 
        ORDER BY version_number DESC, id DESC 
        LIMIT 1
      `);
      if (newestRemaining) {
        await db.run('UPDATE mission_order_templates SET is_default = 0, status = "INACTIVE"');
        await db.run('UPDATE mission_order_templates SET is_default = 1, status = "ACTIVE", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newestRemaining.id]);

        // Sync legacy table
        try {
          await db.run(`UPDATE document_templates SET is_active = 0, is_default = 0 WHERE code = 'ORDRE_001' OR category = 'Missions' OR document_type_code = 'MISSION_ORDER'`);
          await db.run(`
            UPDATE document_templates SET is_active = 1, is_default = 1 
            WHERE file_path = ? OR version = ?
          `, [newestRemaining.file_path, newestRemaining.version_number]);
        } catch (e) {}
      }
    }

    // Try deleting physical file if it exists and is not referenced by another record
    try {
      const otherUsingFile = await db.get('SELECT id FROM mission_order_templates WHERE file_path = ?', [targetVersion.file_path]);
      if (!otherUsingFile && targetVersion.file_path) {
        const filePathOnDisk = path.join(templateUploadDir, path.basename(targetVersion.file_path));
        if (fs.existsSync(filePathOnDisk)) {
          fs.unlinkSync(filePathOnDisk);
        }
      }
    } catch (fileErr) {
      console.warn('Physical file deletion note:', fileErr.message);
    }

    await logAuditAction(req.user.id, 'DELETE_MISSION_TEMPLATE_VERSION', 'MISSION_TEMPLATE', id, req, {
      version: targetVersion.version_number,
      name: targetVersion.name,
      fileName: targetVersion.file_name
    });

    res.json({
      success: true,
      message: `Version ${targetVersion.version_number || ''} supprimée avec succès.`
    });
  } catch (err) {
    console.error('Delete template version error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la version du modèle.' });
  }
});

// ============================================================================
// 7. PUT /api/mission-template/:id/toggle-status - Toggle Active / Inactive (Admin)
// ============================================================================
router.put('/:id/toggle-status', authenticateToken, requireAdminOnly, async (req, res) => {
  const { id } = req.params;

  try {
    const template = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    const newStatus = template.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    if (newStatus === 'ACTIVE') {
      await db.run('UPDATE mission_order_templates SET status = "INACTIVE", updated_at = CURRENT_TIMESTAMP');
      await db.run('UPDATE mission_order_templates SET status = "ACTIVE", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    } else {
      await db.run('UPDATE mission_order_templates SET status = "INACTIVE", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    }

    await logAuditAction(req.user.id, 'TOGGLE_MISSION_TEMPLATE_STATUS', 'MISSION_TEMPLATE', id, req, {
      newStatus
    });

    const updated = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [id]);

    res.json({
      success: true,
      message: `Modèle ${newStatus === 'ACTIVE' ? 'activé' : 'désactivé'} avec succès.`,
      template: updated
    });
  } catch (err) {
    console.error('Toggle status error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de statut.' });
  }
});

// ============================================================================
// 8. GET /api/mission-template/:id/download - Raw Template Download
// ============================================================================
router.get('/:id/download', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const template = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    const candidatePaths = [
      path.join(templateUploadDir, path.basename(template.file_path)),
      path.join(UPLOAD_DIR, template.file_path),
      path.join(UPLOAD_DIR, 'templates', path.basename(template.file_path)),
      path.join(UPLOAD_DIR, path.basename(template.file_path))
    ];

    const resolvedPath = candidatePaths.find(p => fs.existsSync(p));
    if (!resolvedPath) {
      return res.status(404).json({ error: 'Fichier physique du modèle introuvable sur le serveur.' });
    }

    const downloadName = template.file_name || `Ordre_de_mission_v${template.version_number || 1}.docx`;
    res.download(resolvedPath, downloadName);
  } catch (err) {
    console.error('Download template error:', err);
    res.status(500).json({ error: 'Erreur lors du téléchargement du fichier.' });
  }
});

// ============================================================================
// 8b. GET /api/mission-template/:id/file - Stream Template File for In-Browser Studio Canvas
// ============================================================================
router.get('/:id/file', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const template = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    const candidatePaths = [
      path.join(templateUploadDir, path.basename(template.file_path)),
      path.join(UPLOAD_DIR, template.file_path),
      path.join(UPLOAD_DIR, 'templates', path.basename(template.file_path)),
      path.join(UPLOAD_DIR, path.basename(template.file_path))
    ];

    const resolvedPath = candidatePaths.find(p => fs.existsSync(p));
    if (!resolvedPath) {
      return res.status(404).json({ error: 'Fichier physique du modèle introuvable sur le serveur.' });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${template.file_name || 'template.pdf'}"`);
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }
    
    res.sendFile(resolvedPath);
  } catch (err) {
    console.error('Stream template file error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement du fichier pour le studio.' });
  }
});

// ============================================================================
// 9. GET /api/mission-template/open-word-uri - Direct Word URI Protocol
// ============================================================================
router.get('/open-word-uri', authenticateToken, requireAdminOnly, async (req, res) => {
  try {
    const template = await db.get(`
      SELECT * FROM mission_order_templates 
      WHERE is_default = 1 OR status = 'ACTIVE' 
      ORDER BY is_default DESC, id DESC LIMIT 1
    `);

    if (!template) {
      return res.status(404).json({ error: 'Aucun modèle officiel configuré.' });
    }

    // Protocol handler uri (ms-word:ofe|u|...)
    const host = req.get('host');
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/templates/${path.basename(template.file_path)}`;
    const wordProtocolUri = `ms-word:ofe|u|${fileUrl}`;

    res.json({
      success: true,
      wordProtocolUri,
      fileUrl,
      templateId: template.id,
      fileName: template.file_name
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la préparation de l’ouverture Microsoft Word.' });
  }
});

// ============================================================================
// 10. POST /api/mission-template/branding/logo - Upload Official Logo (Admin)
// ============================================================================
router.post('/branding/logo', authenticateToken, requireAdminOnly, uploadBranding.single('logo_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner un fichier image pour le logo officiel.' });
  }

  try {
    const logoRelPath = `/uploads/logos/${req.file.filename}`;

    // Update institution_settings and mission_order_templates
    await db.run('UPDATE institution_settings SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [logoRelPath]);
    await db.run('UPDATE mission_order_templates SET logo_path = ?, updated_at = CURRENT_TIMESTAMP', [logoRelPath]);

    await logAuditAction(req.user.id, 'UPLOAD_MISSION_LOGO', 'INSTITUTION_SETTINGS', 1, req, {
      fileName: req.file.originalname,
      path: logoRelPath
    });

    res.json({
      success: true,
      message: 'Logo officiel de l’Université de Kindia mis à jour avec succès.',
      logo_path: logoRelPath
    });
  } catch (err) {
    console.error('Logo upload error:', err);
    res.status(500).json({ error: 'Erreur lors du téléversement du logo officiel.' });
  }
});

// ============================================================================
// 11. POST /api/mission-template/branding/watermark - Upload Watermark Image (Admin)
// ============================================================================
router.post('/branding/watermark', authenticateToken, requireAdminOnly, uploadBranding.single('watermark_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner une image pour le filigrane officiel.' });
  }

  try {
    const watermarkRelPath = `/uploads/logos/${req.file.filename}`;

    // Update institution_settings and mission_order_templates
    await db.run('UPDATE institution_settings SET watermark_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [watermarkRelPath]);
    await db.run('UPDATE mission_order_templates SET watermark_path = ?, updated_at = CURRENT_TIMESTAMP', [watermarkRelPath]);

    await logAuditAction(req.user.id, 'UPLOAD_MISSION_WATERMARK', 'INSTITUTION_SETTINGS', 1, req, {
      fileName: req.file.originalname,
      path: watermarkRelPath
    });

    res.json({
      success: true,
      message: 'Image du filigrane officiel mise à jour avec succès.',
      watermark_path: watermarkRelPath
    });
  } catch (err) {
    console.error('Watermark upload error:', err);
    res.status(500).json({ error: 'Erreur lors du téléversement du filigrane officiel.' });
  }
});

// ============================================================================
// 12. PUT /api/mission-template/branding/watermark-settings - Watermark Settings (Admin)
// ============================================================================
router.put('/branding/watermark-settings', authenticateToken, requireAdminOnly, async (req, res) => {
  const { enabled, opacity, size, position } = req.body;

  try {
    const watermarkEnabled = enabled !== undefined ? (enabled ? 1 : 0) : 1;
    const watermarkOpacity = opacity !== undefined ? Number(opacity) : 0.15;
    const watermarkSize = size !== undefined ? Number(size) : 60;
    const watermarkPosition = position || 'CENTER';

    await db.run(`
      UPDATE institution_settings SET 
        watermark_enabled = ?, 
        watermark_opacity = ?, 
        watermark_size = ?, 
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = 1
    `, [watermarkEnabled, watermarkOpacity, watermarkSize]);

    await db.run(`
      UPDATE mission_order_templates SET 
        watermark_enabled = ?, 
        watermark_opacity = ?, 
        watermark_size = ?, 
        watermark_position = ?, 
        updated_at = CURRENT_TIMESTAMP
    `, [watermarkEnabled, watermarkOpacity, watermarkSize, watermarkPosition]);

    await logAuditAction(req.user.id, 'UPDATE_MISSION_WATERMARK_SETTINGS', 'INSTITUTION_SETTINGS', 1, req, {
      watermarkEnabled,
      watermarkOpacity,
      watermarkSize,
      watermarkPosition
    });

    res.json({
      success: true,
      message: 'Paramètres du filigrane enregistrés avec succès.',
      branding: {
        watermark_enabled: watermarkEnabled,
        watermark_opacity: watermarkOpacity,
        watermark_size: watermarkSize,
        watermark_position: watermarkPosition
      }
    });
  } catch (err) {
    console.error('Watermark settings update error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des paramètres du filigrane.' });
  }
});

module.exports = router;
