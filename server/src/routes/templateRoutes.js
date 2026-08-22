const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const multer = require('multer');
const JSZip = require('jszip');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const docxService = require('../services/docxService');
const { ONLYOFFICE_CONFIG, buildOnlyofficeDocEditorConfig } = require('../config/onlyoffice');

// Configure multer storage for official templates
const uploadDir = path.join(__dirname, '../../uploads/templates');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `template_${Date.now()}_${cleanName}${ext}`);
  }
});
const upload = multer({ storage });

// Helper to extract clean structured HTML from any template file (DOCX, ODT, HTML, TXT)
async function extractHtmlFromTemplateFile(fullPath, ext) {
  if (!fs.existsSync(fullPath)) return '';
  const extension = (ext || path.extname(fullPath).substring(1)).toLowerCase();
  
  if (extension === 'docx') {
    return await docxService.docxToHtml(fullPath);
  } else if (extension === 'odt') {
    const fileBuffer = fs.readFileSync(fullPath);
    const zip = await JSZip.loadAsync(fileBuffer);
    const contentXmlFile = zip.file('content.xml');
    if (!contentXmlFile) return '';
    const xmlText = await contentXmlFile.async('string');
    let pMatches = xmlText.match(/<text:[ph][^>]*>(.*?)<\/text:[ph]>/g) || [];
    return pMatches
      .map(p => {
        const text = p.replace(/<[^>]+>/g, '').trim();
        if (!text) return '';
        if (p.startsWith('<text:h')) {
          return `<h2 style="font-size:18px; font-weight:bold; margin-bottom:16px; color:#0B2545; text-align:center;">${text}</h2>`;
        }
        return `<p style="margin-bottom:12px; line-height:1.6; color:#334155;">${text}</p>`;
      })
      .filter(Boolean)
      .join('\n');
  } else if (extension === 'html' || extension === 'htm') {
    return fs.readFileSync(fullPath, 'utf8');
  } else if (extension === 'txt') {
    const raw = fs.readFileSync(fullPath, 'utf8');
    return raw.split('\n').filter(l => l.trim().length > 0).map(l => `<p style="margin-bottom:12px; line-height:1.6; color:#334155;">${l}</p>`).join('\n');
  }
  return '';
}

// 1. GET /api/templates - List all document templates with filters & search (Rules 1 & 2)
router.get('/', authenticateToken, async (req, res) => {
  const { type, status, is_default, category, scope_type, target_service_id, search } = req.query;

  try {
    let query = `
      SELECT t.*, 
             s.name as target_service_name, s.code as target_service_code, s.reference_code as target_service_ref,
             dtc.label as document_type_label,
             (SELECT COUNT(*) FROM template_fields f WHERE f.template_id = t.id) as fields_count,
             (SELECT COUNT(*) FROM template_versions v WHERE v.template_id = t.id) as versions_count
      FROM document_templates t
      LEFT JOIN services s ON t.target_service_id = s.id
      LEFT JOIN document_type_configs dtc ON t.code = dtc.code OR t.document_type_code = dtc.code
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ` AND (t.code = ? OR t.document_type_code = ? OR t.document_category = ?)`;
      params.push(type, type, type);
    }
    if (status) {
      if (status === 'ACTIVE' || status === 'actives') {
        query += ` AND t.is_active = 1`;
      } else if (status === 'INACTIVE' || status === 'inactives') {
        query += ` AND t.is_active = 0`;
      }
    }
    if (scope_type) {
      query += ` AND t.scope_type = ?`;
      params.push(scope_type);
    }
    if (target_service_id) {
      query += ` AND t.target_service_id = ?`;
      params.push(target_service_id);
    }
    if (is_default !== undefined) {
      query += ` AND t.is_default = ?`;
      params.push(is_default === 'true' || is_default === '1' ? 1 : 0);
    }
    if (category) {
      query += ` AND (t.category = ? OR t.document_category = ?)`;
      params.push(category, category);
    }
    if (search && search.trim()) {
      query += ` AND (t.name LIKE ? OR t.code LIKE ? OR t.description LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY t.is_default DESC, t.name ASC`;

    const templates = await db.all(query, params);
    res.json(templates);
  } catch (err) {
    console.error('Fetch templates error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des modèles de documents.' });
  }
});

// 1b. GET /api/templates/available-for-user - List templates authorized specifically for the user's service (Rule 5 & 6)
router.get('/available-for-user', authenticateToken, async (req, res) => {
  const user = req.user;
  const userServId = user.service_id;

  try {
    let parentServiceId = null;
    if (userServId) {
      const userServ = await db.get('SELECT parent_id FROM services WHERE id = ?', [userServId]);
      if (userServ) parentServiceId = userServ.parent_id;
    }

    // Accessible models: GLOBAL + target_service_id = userServId + target_service_id = parentServiceId
    let query = `
      SELECT t.*, 
             s.name as target_service_name, s.code as target_service_code, s.reference_code as target_service_ref
      FROM document_templates t
      LEFT JOIN services s ON t.target_service_id = s.id
      WHERE t.is_active = 1 
        AND (
          t.scope_type = 'GLOBAL' 
          OR t.scope_type IS NULL 
          OR t.target_service_id IS NULL
          ${userServId ? `OR t.target_service_id = ${Number(userServId)}` : ''}
          ${parentServiceId ? `OR t.target_service_id = ${Number(parentServiceId)}` : ''}
        )
      ORDER BY t.scope_type DESC, t.is_default DESC, t.name ASC
    `;

    const availableTemplates = await db.all(query);
    res.json(availableTemplates);
  } catch (err) {
    console.error('Fetch available templates error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des modèles autorisés.' });
  }
});

// 2. GET /api/templates/:id - Get template detail with fields & version history
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const template = await db.get(
      'SELECT * FROM document_templates WHERE id = ? OR code = ?',
      [id, id]
    );

    if (!template) {
      return res.status(404).json({ error: 'Modèle de document non trouvé.' });
    }

    const fields = await db.all('SELECT * FROM template_fields WHERE template_id = ? ORDER BY position ASC', [template.id]);
    const versions = await db.all('SELECT * FROM template_versions WHERE template_id = ? ORDER BY version_number DESC', [template.id]);

    res.json({
      template,
      fields: fields || [],
      versions: versions || []
    });
  } catch (err) {
    console.error('Fetch template detail error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement du modèle.' });
  }
});

// Helper to resolve dynamic variables (Rule 12)
function resolveDynamicTemplateVariables(text, context = {}) {
  if (!text) return '';
  const now = new Date();
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const formattedDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  
  const replacements = {
    '{{REFERENCE}}': context.reference || context.preview_reference || '[RÉFÉRENCE OFFICIELLE]',
    '{{DATE}}': context.date || formattedDate,
    '{{SERVICE}}': context.service_name || '',
    '{{FACULTE}}': context.faculty_name || '',
    '{{DEPARTEMENT}}': context.department_name || '',
    '{{DESTINATAIRE}}': context.recipient_name || context.target_recipient_name || '',
    '{{OBJET}}': context.object || context.title || context.object_title || '',
    '{{RESPONSABLE}}': context.head_name || '',
    '{{FONCTION_RESPONSABLE}}': context.head_title || '',
    '{{ANNEE}}': context.year || String(now.getFullYear())
  };

  let result = text;
  for (const [key, val] of Object.entries(replacements)) {
    const regex = new RegExp(key.replace(/[{}]/g, '\\$&'), 'g');
    result = result.replace(regex, val || '');
  }
  return result;
}

// 2b. POST /api/templates/extract-content - Extract HTML/text from uploaded template file (DOCX, ODT, TXT, HTML)
router.post('/extract-content', authenticateToken, upload.single('template_file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'Aucun fichier fourni.' });
  }

  try {
    const ext = path.extname(file.originalname).substring(1).toUpperCase();
    const filePath = path.join(uploadDir, file.filename);
    const extractedHtml = await extractHtmlFromTemplateFile(filePath, ext);

    const baseName = path.basename(file.originalname, path.extname(file.originalname))
      .replace(/[_-]+/g, ' ')
      .trim();

    res.json({
      success: true,
      filename: file.filename,
      original_name: file.originalname,
      suggested_name: baseName,
      format: ext,
      extracted_html: extractedHtml || `<p>${baseName}</p>`,
      size: file.size
    });
  } catch (err) {
    console.error('Extract template content error:', err);
    res.status(500).json({ error: "Erreur lors de l'analyse du fichier de modèle : " + err.message });
  }
});

// 3. POST /api/templates - Add or import a new template for a service or globally (Rules 4, 6, 10, 11)
router.post('/', authenticateToken, upload.single('template_file'), async (req, res) => {
  const { 
    name, 
    code, 
    document_type_code, 
    category, 
    description, 
    format, 
    is_default, 
    editor_type,
    scope_type,
    target_service_id,
    associated_category_id,
    content_body_html,
    header_text,
    footer_text
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom du modèle est obligatoire.' });
  }

  const user = req.user;
  const isAdmin = user.role_code === 'ADMINISTRATEUR' || (user.permissions && user.permissions.includes('templates.manage'));
  
  // Resolve target service
  let assignedServiceId = null;
  let resolvedScope = scope_type || 'SERVICE';

  if (target_service_id) {
    assignedServiceId = Number(target_service_id);
  } else if (!isAdmin && user.service_id) {
    assignedServiceId = user.service_id;
  } else if (isAdmin && resolvedScope === 'GLOBAL') {
    assignedServiceId = null;
  } else if (user.service_id) {
    assignedServiceId = user.service_id;
  }

  const docTypeCode = (document_type_code || code || 'SOIT_TRANSMIS').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const templateCode = (code || `TPL_${assignedServiceId ? `SRV${assignedServiceId}` : 'GEN'}_${Date.now()}`).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const file = req.file;
  const editorTypeVal = (editor_type === 'MS_WORD' || editor_type === 'WORD' || editor_type === 'DOCX') ? 'MS_WORD' : 'UK_GED_EDITOR';

  try {
    let ext = file ? path.extname(file.originalname).substring(1).toUpperCase() : (editorTypeVal === 'MS_WORD' ? 'DOCX' : (format || 'HTML'));
    const isDefaultVal = (is_default === 'true' || is_default === '1') ? 1 : 0;

    let filePath = file ? file.filename : null;

    let extractedHtml = content_body_html || null;
    if (filePath && !extractedHtml) {
      extractedHtml = await extractHtmlFromTemplateFile(path.join(uploadDir, filePath), ext);
    }

    if (!extractedHtml) {
      extractedHtml = `<h3 style="color:#0B2545; text-align:center;">${name.trim()}</h3>\n<p style="margin-top:16px;">Contenu du modèle administratif pour ${user.service_name || "l'Université de Kindia"}.</p>`;
    }

    const existingTpl = await db.get('SELECT id FROM document_templates WHERE code = ?', [templateCode]);
    let templateId;

    if (existingTpl) {
      templateId = existingTpl.id;
      await db.run(
        `UPDATE document_templates SET
           name = ?, document_type_code = ?, category = ?, scope_type = ?, target_service_id = ?, description = ?, 
           editor_type = ?, format = ?, is_active = 1, is_default = ?, file_path = COALESCE(?, file_path), 
           content_body_html = COALESCE(?, content_body_html), header_text = COALESCE(?, header_text), 
           footer_text = COALESCE(?, footer_text), updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          name.trim(),
          docTypeCode,
          category || docTypeCode,
          resolvedScope,
          assignedServiceId,
          description || '',
          editorTypeVal,
          ext,
          isDefaultVal,
          filePath,
          extractedHtml,
          header_text || null,
          footer_text || null,
          templateId
        ]
      );
    } else {
      const result = await db.run(
        `INSERT INTO document_templates 
         (code, document_type_code, name, category, scope_type, target_service_id, document_category, description, editor_type, format, version, is_active, is_default, file_path, header_text, footer_text, content_body_html, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?)`,
        [
          templateCode,
          docTypeCode,
          name.trim(),
          category || docTypeCode,
          resolvedScope,
          assignedServiceId,
          docTypeCode,
          description || '',
          editorTypeVal,
          ext,
          isDefaultVal,
          filePath,
          header_text || 'RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA',
          footer_text || 'UNIVERSITÉ DE KINDIA • Service Administratif',
          extractedHtml,
          req.user.id
        ]
      );
      templateId = result.lastID;
    }

    // Create Version 1 entry
    await db.run(
      `INSERT INTO template_versions (template_id, version, version_number, file_path, file_type, editor_type, content_body_html, change_description, status, created_by, uploaded_by)
       VALUES (?, 1, 1, ?, ?, ?, ?, 'Création / Importation initiale', 'ACTIVE', ?, ?)`,
      [templateId, filePath, ext, editorTypeVal, extractedHtml, req.user ? req.user.id : 1, req.user ? req.user.id : 1]
    );

    const savedTemplate = await db.get(`
      SELECT t.*, s.name as target_service_name, s.code as target_service_code
      FROM document_templates t
      LEFT JOIN services s ON t.target_service_id = s.id
      WHERE t.id = ?
    `, [templateId]);

    await logAuditAction(req.user.id, 'CREATE_TEMPLATE', 'TEMPLATE', templateId, req, {
      code: templateCode,
      name,
      service_id: assignedServiceId
    });

    res.status(201).json({
      success: true,
      message: `Modèle [${name}] enregistré avec succès.`,
      template: savedTemplate
    });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du modèle : ' + err.message });
  }
});

// 4. GET /api/templates/:id/download - Download template file (Rule 4)
router.get('/:id/download', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template || !template.file_path) {
      return res.status(404).json({ error: 'Fichier modèle introuvable sur le serveur.' });
    }

    const fullPath = path.join(uploadDir, template.file_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Le fichier physique du modèle n’existe plus.' });
    }

    res.download(fullPath, `${template.name}.${template.format || 'docx'}`);
  } catch (err) {
    console.error('Download template file error:', err);
    res.status(500).json({ error: 'Erreur lors du téléchargement du modèle.' });
  }
});

// 5. PUT /api/templates/:id/set-default - Set template as default (Rules 5 & 6)
router.put('/:id/set-default', authenticateToken, requirePermission('templates.manage'), async (req, res) => {
  const { id } = req.params;
  const { force } = req.body;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    // Check if another default template exists for this document type
    const existingDefault = await db.get(
      'SELECT id, name FROM document_templates WHERE (code = ? OR document_type_code = ?) AND is_default = 1 AND id != ?',
      [template.code, template.code, template.id]
    );

    if (existingDefault && !force) {
      return res.status(409).json({
        conflict: true,
        existing_default_name: existingDefault.name,
        message: `Ce type de document possède déjà un modèle par défaut [${existingDefault.name}]. Voulez-vous remplacer le modèle actuel ?`
      });
    }

    // Replace default flag
    await db.run('UPDATE document_templates SET is_default = 0 WHERE code = ? OR document_type_code = ?', [template.code, template.code]);
    await db.run('UPDATE document_templates SET is_default = 1, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [template.id]);

    await logAuditAction(req.user.id, 'SET_DEFAULT_TEMPLATE', 'TEMPLATE', template.id, req, {
      code: template.code,
      name: template.name
    });

    res.json({
      success: true,
      message: `[${template.name}] défini comme modèle par défaut officiel pour ce type de document.`
    });
  } catch (err) {
    console.error('Set default template error:', err);
    res.status(500).json({ error: 'Erreur lors de la définition du modèle par défaut.' });
  }
});

// 6. POST /api/templates/:id/versions - Upload new version (Rules 7 & 8)
router.post('/:id/versions', authenticateToken, requirePermission('templates.manage'), upload.single('template_file'), async (req, res) => {
  const { id } = req.params;
  const { change_description } = req.body;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Veuillez sélectionner un fichier modèle (DOCX, PDF, ODT).' });
    }

    const filePath = req.file.filename;
    const ext = path.extname(req.file.originalname).substring(1).toUpperCase();
    const newVersionNum = (template.version || 1) + 1;
    const extractedHtml = await extractHtmlFromTemplateFile(path.join(uploadDir, filePath), ext);

    // Archive previous version entries
    await db.run('UPDATE template_versions SET status = "ARCHIVED" WHERE template_id = ?', [template.id]);

    // Insert new version
    await db.run(
      `INSERT INTO template_versions (template_id, version_number, file_path, file_type, content_body_html, change_description, status, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      [template.id, newVersionNum, filePath, ext, extractedHtml, change_description || `Mise à jour version v${newVersionNum}`, req.user.id]
    );

    // Update main template record
    await db.run(
      `UPDATE document_templates SET file_path = ?, format = ?, version = ?, content_body_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [filePath, ext, newVersionNum, extractedHtml, template.id]
    );

    await logAuditAction(req.user.id, 'UPLOAD_TEMPLATE_VERSION', 'TEMPLATE', template.id, req, {
      code: template.code,
      version: newVersionNum
    });

    res.json({
      success: true,
      message: `Nouvelle version v${newVersionNum} importée avec succès.`,
      version: newVersionNum,
      file_path: filePath
    });
  } catch (err) {
    console.error('Upload template version error:', err);
    res.status(500).json({ error: 'Erreur lors de l’importation de la nouvelle version.' });
  }
});

// 6b. GET /api/templates/:id/versions/:versionId/file - Serve or download specific version file
router.get('/:id/versions/:versionId/file', authenticateToken, async (req, res) => {
  const { id, versionId } = req.params;
  const isDownload = req.query.download === '1' || req.query.download === 'true';

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle de document introuvable.' });
    }

    let filePath = null;
    let format = template.format || 'DOCX';
    let versionName = `v${template.version || 1}`;

    if (versionId === 'current' || versionId === 'latest') {
      filePath = template.file_path;
    } else {
      const versionRecord = await db.get(
        'SELECT * FROM template_versions WHERE (id = ? OR version_number = ?) AND template_id = ?',
        [versionId, versionId, template.id]
      );

      if (versionRecord && versionRecord.file_path) {
        filePath = versionRecord.file_path;
        format = versionRecord.file_type || format;
        versionName = `v${versionRecord.version_number || versionRecord.version}`;
      } else if (template.file_path) {
        filePath = template.file_path;
      }
    }

    if (!filePath) {
      return res.status(404).json({ error: 'Fichier associé à cette version introuvable sur le serveur.' });
    }

    const fullPath = path.join(uploadDir, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Le fichier physique associé à cette version n’existe pas sur le disque.' });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const downloadName = `${template.name}_${versionName}${ext}`;

    console.log(`[PREVIEW] template_id = ${template.id}, document_id = ${template.id}, file_id = ${filePath}, version_id = ${versionId || 'current'}`);

    if (isDownload) {
      return res.download(fullPath, downloadName);
    }

    // Serve for inline preview
    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === '.odt') mimeType = 'application/vnd.oasis.opendocument.text';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(downloadName)}"`);
    res.sendFile(fullPath);
  } catch (err) {
    console.error('Fetch version file error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement du fichier de version.' });
  }
});

// 6c. GET /api/templates/:id/versions/:versionId/preview-odt - Convert ODT content.xml to HTML for preview
router.get('/:id/versions/:versionId/preview-odt', authenticateToken, async (req, res) => {
  const { id, versionId } = req.params;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    let filePath = template.file_path;
    if (versionId !== 'current' && versionId !== 'latest') {
      const vRecord = await db.get(
        'SELECT * FROM template_versions WHERE (id = ? OR version_number = ?) AND template_id = ?',
        [versionId, versionId, template.id]
      );
      if (vRecord && vRecord.file_path) {
        filePath = vRecord.file_path;
      }
    }

    if (!filePath) {
      return res.status(404).json({ error: 'Fichier ODT introuvable.' });
    }

    const fullPath = path.join(uploadDir, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Le fichier physique ODT n’existe pas sur le disque.' });
    }

    const fileBuffer = fs.readFileSync(fullPath);
    const zip = await JSZip.loadAsync(fileBuffer);

    const contentXmlFile = zip.file('content.xml');
    if (!contentXmlFile) {
      return res.status(400).json({ error: 'Fichier ODT invalide (content.xml manquant).' });
    }

    const xmlText = await contentXmlFile.async('string');

    // Convert ODT content.xml nodes to styled HTML
    let html = xmlText
      .replace(/<text:h[^>]*>(.*?)<\/text:h>/gi, '<h3 style="font-size:16px;font-weight:bold;margin:12px 0;color:#0B2545;">$1</h3>')
      .replace(/<text:p[^>]*>(.*?)<\/text:p>/gi, '<p style="margin:8px 0;line-height:1.6;color:#334155;">$1</p>')
      .replace(/<table:table[^>]*>/gi, '<table style="width:100%;border-collapse:collapse;margin:12px 0;border:1px solid #CBD5E1;">')
      .replace(/<\/table:table>/gi, '</table>')
      .replace(/<table:table-row[^>]*>/gi, '<tr>')
      .replace(/<\/table:table-row>/gi, '</tr>')
      .replace(/<table:table-cell[^>]*>/gi, '<td style="border:1px solid #CBD5E1;padding:8px;font-size:13px;">')
      .replace(/<\/table:table-cell>/gi, '</td>')
      .replace(/<text:span[^>]*>(.*?)<\/text:span>/gi, '<span>$1</span>')
      .replace(/<[^>]+>/g, '');

    const sanitizedHtml = xmlText.includes('<text:p')
      ? xmlText
          .replace(/<text:h[^>]*>(.*?)<\/text:h>/gi, '<h3 class="odt-heading font-bold text-base text-slate-800 my-2">$1</h3>')
          .replace(/<text:p[^>]*>(.*?)<\/text:p>/gi, '<p class="odt-p text-sm text-slate-700 my-1 line-relaxed">$1</p>')
          .replace(/<table:table[^>]*>(.*?)<\/table:table>/gis, '<table class="odt-table w-full border border-slate-300 my-3">$1</table>')
          .replace(/<table:table-row[^>]*>(.*?)<\/table:table-row>/gis, '<tr>$1</tr>')
          .replace(/<table:table-cell[^>]*>(.*?)<\/table:table-cell>/gis, '<td class="border border-slate-300 p-2 text-xs">$1</td>')
          .replace(/<text:line-break\/>/gi, '<br/>')
          .replace(/<[^>]+>/g, (tag) => {
            if (['<h3 class="odt-heading font-bold text-base text-slate-800 my-2">', '</h3>', '<p class="odt-p text-sm text-slate-700 my-1 line-relaxed">', '</p>', '<table class="odt-table w-full border border-slate-300 my-3">', '</table>', '<tr>', '</tr>', '<td class="border border-slate-300 p-2 text-xs">', '</td>', '<br/>'].includes(tag)) {
              return tag;
            }
            return '';
          })
      : `<p class="text-sm text-slate-700">${html}</p>`;

    res.json({
      success: true,
      html: sanitizedHtml
    });
  } catch (err) {
    console.error('Preview ODT error:', err);
    res.status(500).json({ error: 'Erreur lors de la conversion de l’aperçu ODT.' });
  }
});

// 6d. GET /api/templates/:id/versions/:versionId/html - Convert version DOCX/ODT file into editable HTML
router.get('/:id/versions/:versionId/html', authenticateToken, async (req, res) => {
  const { id, versionId } = req.params;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    let filePath = template.file_path;
    let targetTemplate = template;
    let savedHtml = null;

    if (versionId !== 'current' && versionId !== 'latest') {
      const vRecord = await db.get(
        'SELECT * FROM template_versions WHERE (id = ? OR version_number = ?) AND template_id = ?',
        [versionId, versionId, template.id]
      );
      if (vRecord) {
        savedHtml = vRecord.content_body_html;
        if (vRecord.file_path) filePath = vRecord.file_path;
      }
    } else {
      savedHtml = targetTemplate.content_body_html;
    }

    // If template has saved custom HTML, return it directly
    if (savedHtml && savedHtml.trim().length > 0) {
      return res.json({ success: true, html: savedHtml });
    }

    if (!filePath) {
      // Build default Word template for this type
      const defaultDocx = await docxService.buildOfficialKindiaMissionDocx();
      const defaultHtml = await docxService.docxToHtml(defaultDocx);
      return res.json({ success: true, html: defaultHtml });
    }

    const fullPath = path.join(uploadDir, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Le fichier physique source n’existe pas sur le disque.' });
    }

    const ext = path.extname(filePath).toLowerCase();
    let generatedHtml = '';

    if (ext === '.docx') {
      generatedHtml = await docxService.docxToHtml(fullPath);
    } else if (ext === '.odt') {
      const fileBuffer = fs.readFileSync(fullPath);
      const zip = await JSZip.loadAsync(fileBuffer);
      const contentXmlFile = zip.file('content.xml');

      if (!contentXmlFile) {
        return res.status(400).json({ error: 'Fichier ODT invalide (content.xml manquant).' });
      }

      const xmlText = await contentXmlFile.async('string');
      let pMatches = xmlText.match(/<text:[ph][^>]*>(.*?)<\/text:[ph]>/g) || [];

      generatedHtml = pMatches
        .map(p => {
          const text = p.replace(/<[^>]+>/g, '').trim();
          if (!text) return '';
          if (p.startsWith('<text:h')) {
            return `<h2 style="font-size:18px; font-weight:bold; margin-bottom:16px; color:#0B2545; text-align:center;">${text}</h2>`;
          }
          return `<p style="margin-bottom:12px; line-height:1.6; color:#334155;">${text}</p>`;
        })
        .filter(Boolean)
        .join('\n');
    } else {
      const rawText = fs.readFileSync(fullPath, 'utf8');
      generatedHtml = `<p style="margin-bottom:12px; line-height:1.6; color:#334155;">${rawText}</p>`;
    }

    // Format tags like {{tag_name}} into interactive badges
    generatedHtml = generatedHtml.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, tagKey) => {
      return `<span data-field-key="{{${tagKey}}}" class="dynamic-tag" contenteditable="false" style="background-color:#EFF6FF; color:#1E40AF; padding:2px 8px; border-radius:6px; font-family:monospace; font-weight:bold; border:1px solid #BFDBFE; display:inline-block; margin:0 2px;">🏷️ {{${tagKey}}}</span>`;
    });

    if (!generatedHtml.trim()) {
      generatedHtml = `<p style="margin-bottom:12px; line-height:1.6; color:#334155;">Document source importé [${path.basename(filePath)}].</p>`;
    }

    res.json({
      success: true,
      html: generatedHtml
    });
  } catch (err) {
    console.error('Fetch version HTML error:', err);
    res.status(500).json({ error: 'Erreur lors de l’extraction du contenu éditable du fichier.' });
  }
});

// 7. PUT /api/templates/:id/versions/:versionId/restore - Restore past version (Rule 8)
router.put('/:id/versions/:versionId/restore', authenticateToken, requirePermission('templates.manage'), async (req, res) => {
  const { id, versionId } = req.params;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    const targetVersion = await db.get('SELECT * FROM template_versions WHERE id = ? AND template_id = ?', [versionId, template.id]);

    if (!template || !targetVersion) {
      return res.status(404).json({ error: 'Version ou modèle introuvable.' });
    }

    // Set target version as active
    await db.run('UPDATE template_versions SET status = "ARCHIVED" WHERE template_id = ?', [template.id]);
    await db.run('UPDATE template_versions SET status = "ACTIVE" WHERE id = ?', [targetVersion.id]);

    await db.run(
      `UPDATE document_templates SET file_path = ?, format = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [targetVersion.file_path, targetVersion.file_type || 'DOCX', targetVersion.version_number, template.id]
    );

    await logAuditAction(req.user.id, 'RESTORE_TEMPLATE_VERSION', 'TEMPLATE', template.id, req, {
      version: targetVersion.version_number
    });

    res.json({
      success: true,
      message: `Version v${targetVersion.version_number} restaurée comme modèle officiel actif.`
    });
  } catch (err) {
    console.error('Restore template version error:', err);
    res.status(500).json({ error: 'Erreur lors de la restauration de la version.' });
  }
});

// 8. DELETE /api/templates/:id - Delete template (Rule 10 & 11)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    const isAdmin = user.role_code === 'ADMINISTRATEUR' || (user.permissions && user.permissions.includes('templates.manage'));
    const isOwnerService = user.service_id && template.target_service_id === user.service_id;

    if (!isAdmin && !isOwnerService) {
      return res.status(403).json({ error: 'Action non autorisée sur ce modèle.' });
    }

    // Delete physical file if exists
    if (template.file_path) {
      const fullPath = path.join(uploadDir, template.file_path);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) {}
      }
    }

    await db.run('DELETE FROM template_versions WHERE template_id = ?', [template.id]);
    await db.run('DELETE FROM template_fields WHERE template_id = ?', [template.id]);
    await db.run('DELETE FROM document_templates WHERE id = ?', [template.id]);
    await logAuditAction(req.user.id, 'DELETE_TEMPLATE', 'TEMPLATE', template.id, req, { code: template.code });

    res.json({ success: true, message: `Modèle [${template.name}] supprimé avec succès.` });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du modèle : ' + err.message });
  }
});

// 9. POST /api/templates/:code/upload - Upload file for existing template by code alias
router.post('/:code/upload', authenticateToken, requirePermission('templates.manage'), upload.single('template_file'), async (req, res) => {
  const { code } = req.params;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE code = ? OR id = ?', [code, code]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle de document non trouvé.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Veuillez sélectionner un fichier à importer.' });
    }

    const filePath = req.file.filename;
    const ext = path.extname(req.file.originalname).substring(1).toUpperCase();
    const newVersionNum = (template.version || 1) + 1;
    const extractedHtml = await extractHtmlFromTemplateFile(path.join(uploadDir, filePath), ext);

    // Archive previous version entries
    await db.run('UPDATE template_versions SET status = "ARCHIVED" WHERE template_id = ?', [template.id]);

    // Insert version entry
    await db.run(
      `INSERT INTO template_versions (template_id, version, version_number, file_path, file_type, content_body_html, change_description, status, created_by, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, 'Importation de fichier modèle', 'ACTIVE', ?, ?)`,
      [template.id, newVersionNum, newVersionNum, filePath, ext, extractedHtml, req.user ? req.user.id : 1, req.user ? req.user.id : 1]
    );

    // Update main template record
    await db.run(
      `UPDATE document_templates SET file_path = ?, format = ?, version = ?, content_body_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [filePath, ext, newVersionNum, extractedHtml, template.id]
    );

    await logAuditAction(req.user.id, 'UPLOAD_TEMPLATE_FILE', 'TEMPLATE', template.id, req, { code: template.code });

    res.json({
      success: true,
      message: `Fichier du modèle [${template.name}] importé et mis à jour avec succès (v${newVersionNum}).`,
      file_path: filePath
    });
  } catch (err) {
    console.error('Upload template file error:', err);
    res.status(500).json({ error: 'Erreur lors de l’importation du fichier.' });
  }
});

// 10. POST /api/templates/:code/fields - Save dynamic fields
router.post('/:code/fields', authenticateToken, requirePermission('templates.manage'), async (req, res) => {
  const { code } = req.params;
  const { fields } = req.body;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE code = ? OR id = ?', [code, code]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    // Delete existing fields and re-insert
    await db.run('DELETE FROM template_fields WHERE template_id = ?', [template.id]);

    if (fields && Array.isArray(fields)) {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        await db.run(
          `INSERT INTO template_fields (template_id, field_name, label, field_type, default_value, required, position)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            template.id,
            f.field_name || `FIELD_${i+1}`,
            f.label || `Champ ${i+1}`,
            f.field_type || 'texte',
            f.default_value || '',
            f.required ? 1 : 0,
            i + 1
          ]
        );
      }
    }

    res.json({ success: true, message: 'Champs dynamiques du modèle enregistrés avec succès.' });
  } catch (err) {
    console.error('Save template fields error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement des champs.' });
  }
});

// 11. PUT /api/templates/:code/toggle-status - Toggle active/inactive status
router.put('/:code/toggle-status', authenticateToken, requirePermission('templates.manage'), async (req, res) => {
  const { code } = req.params;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE code = ? OR id = ?', [code, code]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    const newActiveState = template.is_active === 1 ? 0 : 1;
    await db.run('UPDATE document_templates SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newActiveState, template.id]);

    res.json({
      success: true,
      message: `Statut du modèle [${template.name}] mis à jour (${newActiveState === 1 ? 'Actif' : 'Inactif'}).`
    });
  } catch (err) {
    console.error('Toggle template status error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du statut.' });
  }
});

// 12. PUT /api/templates/:code - Update template metadata
router.put('/:code', authenticateToken, requirePermission('templates.manage'), async (req, res) => {
  const { code } = req.params;
  const { name, description, header_text, footer_text } = req.body;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE code = ? OR id = ?', [code, code]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    await db.run(
      `UPDATE document_templates SET 
         name = ?, description = ?, header_text = ?, footer_text = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name ? name.trim() : template.name,
        description !== undefined ? description : template.description,
        header_text !== undefined ? header_text : template.header_text,
        footer_text !== undefined ? footer_text : template.footer_text,
        template.id
      ]
    );

    res.json({ success: true, message: `En-tête, pied de page et métadonnées du modèle enregistrés avec succès.` });
  } catch (err) {
    console.error('Update template metadata error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des métadonnées du modèle.' });
  }
});

// 13. POST /api/templates/:id/customize - Save visual customization (Rules 4, 6, 8, 9, 15)
router.post('/:id/customize', authenticateToken, requirePermission('templates.manage'), async (req, res) => {
  const { id } = req.params;
  const { 
    name, description, header_text, footer_text, logo_path, font_family, font_size, 
    primary_color, secondary_color, content_body_html, header_html, footer_html,
    fields, save_as_new_version, change_description
  } = req.body;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) return res.status(404).json({ error: 'Modèle introuvable.' });

    let targetTemplateId = template.id;
    let newVersionNum = template.version || 1;

    // Generate physical DOCX file reflecting the customized HTML content
    const baseDocxPath = template.file_path ? path.join(uploadDir, template.file_path) : null;
    const baseBuffer = baseDocxPath && fs.existsSync(baseDocxPath) ? fs.readFileSync(baseDocxPath) : null;
    const updatedDocxBuffer = await docxService.generateDocxFromHtml(content_body_html, baseBuffer);

    let docxFilename;
    if (save_as_new_version) {
      newVersionNum = newVersionNum + 1;
      docxFilename = `template_${Date.now()}_${template.code.toLowerCase()}_v${newVersionNum}.docx`;
    } else {
      docxFilename = template.file_path || `template_${Date.now()}_${template.code.toLowerCase()}_v${newVersionNum}.docx`;
    }

    fs.writeFileSync(path.join(uploadDir, docxFilename), updatedDocxBuffer);

    // Rule 15: Save as new version if requested or if already used
    if (save_as_new_version) {
      await db.run('UPDATE template_versions SET status = "ARCHIVED" WHERE template_id = ?', [template.id]);

      await db.run(
        `INSERT INTO template_versions (template_id, version, version_number, file_path, file_type, editor_type, content_body_html, change_description, status, created_by, uploaded_by)
         VALUES (?, ?, ?, ?, 'DOCX', 'MS_WORD', ?, ?, 'ACTIVE', ?, ?)`,
        [template.id, newVersionNum, newVersionNum, docxFilename, content_body_html, change_description || `Personnalisation Word v${newVersionNum}`, req.user.id, req.user.id]
      );
    } else {
      await db.run(
        `UPDATE template_versions 
         SET content_body_html = ?, file_path = ?, file_type = 'DOCX', editor_type = 'MS_WORD'
         WHERE template_id = ? AND (status = 'ACTIVE' OR version_number = ?)`,
        [content_body_html, docxFilename, template.id, template.version || 1]
      );
    }

    await db.run(
      `UPDATE document_templates SET
         name = ?, description = ?, header_text = ?, footer_text = ?, logo_path = ?,
         font_family = ?, font_size = ?, primary_color = ?, secondary_color = ?,
         content_body_html = ?, header_html = ?, footer_html = ?, file_path = ?, format = 'DOCX', editor_type = 'MS_WORD', version = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name ? name.trim() : template.name,
        description !== undefined ? description : template.description,
        header_text !== undefined ? header_text : template.header_text,
        footer_text !== undefined ? footer_text : template.footer_text,
        logo_path !== undefined ? logo_path : template.logo_path,
        font_family || template.font_family || 'Calibri',
        font_size || template.font_size || 12,
        primary_color || template.primary_color || '#0B2545',
        secondary_color || template.secondary_color || '#D4AF37',
        content_body_html !== undefined ? content_body_html : template.content_body_html,
        header_html !== undefined ? header_html : template.header_html,
        footer_html !== undefined ? footer_html : template.footer_html,
        docxFilename,
        newVersionNum,
        template.id
      ]
    );

    // Save fields positioning
    if (fields && Array.isArray(fields)) {
      await db.run('DELETE FROM template_fields WHERE template_id = ?', [template.id]);
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        await db.run(
          `INSERT INTO template_fields (template_id, field_name, label, field_type, default_value, required, position)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [template.id, f.field_name || `FIELD_${i+1}`, f.label || `Champ ${i+1}`, f.field_type || 'texte', f.default_value || '', f.required ? 1 : 0, i + 1]
        );
      }
    }

    await logAuditAction(req.user.id, 'CUSTOMIZE_TEMPLATE', 'TEMPLATE', template.id, req, { version: newVersionNum });

    res.json({
      success: true,
      message: `Modèle [${template.name}] personnalisé et enregistré avec succès dans Word (v${newVersionNum}).`,
      version: newVersionNum,
      file_path: docxFilename
    });
  } catch (err) {
    console.error('Customize template error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de la personnalisation du modèle.' });
  }
});

// 14. POST /api/templates/:id/duplicate - Duplicate template (Rule 18)
router.post('/:id/duplicate', authenticateToken, requirePermission('templates.manage'), async (req, res) => {
  const { id } = req.params;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) return res.status(404).json({ error: 'Modèle introuvable.' });

    const newCode = `${template.code}_COPY_${Date.now()}`;
    const newName = `${template.name} (Copie)`;

    const result = await db.run(
      `INSERT INTO document_templates 
       (code, document_type_code, name, category, description, format, version, is_active, is_default, file_path, header_text, footer_text, logo_path, font_family, font_size, primary_color, secondary_color, content_body_html, header_html, footer_html, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newCode, template.document_type_code || template.code, newName, template.category,
        template.description, template.format || 'DOCX', template.file_path, template.header_text,
        template.footer_text, template.logo_path, template.font_family, template.font_size,
        template.primary_color, template.secondary_color, template.content_body_html,
        template.header_html, template.footer_html, req.user.id
      ]
    );

    const duplicatedId = result.lastID;

    // Copy template fields
    const fields = await db.all('SELECT * FROM template_fields WHERE template_id = ?', [template.id]);
    for (const f of fields) {
      await db.run(
        `INSERT INTO template_fields (template_id, field_name, label, field_type, default_value, required, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [duplicatedId, f.field_name, f.label, f.field_type, f.default_value, f.required, f.position]
      );
    }

    await logAuditAction(req.user.id, 'DUPLICATE_TEMPLATE', 'TEMPLATE', duplicatedId, req, { newCode });

    res.status(201).json({
      success: true,
      message: `Modèle dupliqué avec succès [${newName}].`,
      id: duplicatedId,
      code: newCode
    });
  } catch (err) {
    console.error('Duplicate template error:', err);
    res.status(500).json({ error: 'Erreur lors de la duplication du modèle.' });
  }
});

// 15. POST /api/templates/:id/logo - Upload header logo (Rule 5)
router.post('/:id/logo', authenticateToken, requirePermission('templates.manage'), upload.single('logo'), async (req, res) => {
  const { id } = req.params;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) return res.status(404).json({ error: 'Modèle introuvable.' });

    if (!req.file) return res.status(400).json({ error: 'Aucun fichier logo fourni.' });

    const logoPath = `/uploads/templates/${req.file.filename}`;
    await db.run('UPDATE document_templates SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [logoPath, template.id]);

    res.json({
      success: true,
      message: 'Logo officiel mis à jour avec succès.',
      logo_url: logoPath
    });
  } catch (err) {
    console.error('Upload template logo error:', err);
    res.status(500).json({ error: 'Erreur lors du téléchargement du logo.' });
  }
});

// 16. POST /api/templates/:id/test-preview - Test preview with sample data (Rule 14)
router.post('/:id/test-preview', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) return res.status(404).json({ error: 'Modèle introuvable.' });

    const sampleMission = {
      reference: 'OM/UK/SG/TEST/000001',
      missionary_name: 'CAMARA',
      missionary_firstnames: 'Ibrahima',
      nationality: 'Guinéenne',
      function_title: 'Enseignant-Chercheur / Chef de Département',
      service_name: 'Faculté des Sciences',
      matricule: 'UK-TEST-2026',
      destination: 'Conakry',
      object_of_mission: 'Réunion administrative et atelier pédagogique national',
      transport_mode: 'VÉHICULE OFFICIEL',
      departure_date: '2026-09-01',
      return_date: '2026-09-07',
      driver_name: 'SOW Thierno',
      vehicle_registration: 'RC-9988-A',
      observations: 'Ordre de mission de démonstration pour validation du modèle visuel.'
    };

    const generatePDF = require('../services/pdfService').generateSignedMissionOrderPDF;
    const pdfResult = await generatePDF(sampleMission, {
      signed_at: new Date().toISOString(),
      signed_by_name: 'Dr. Mamadou Billo DOUMBOUYA',
      signed_by_role: 'Secrétaire Général',
      signature_hash: 'TEST_HASH_SHA256_UK_GED_2026',
      signature_image_path: null
    });

    res.json({
      success: true,
      sample_data: sampleMission,
      pdf_url: `/uploads/${pdfResult.filename}`
    });
  } catch (err) {
    console.error('Test preview error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération de l’aperçu de test.' });
  }
});

// 17. GET /api/templates/:id/download-docx - Download DOCX file
router.get('/:id/download-docx', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template || !template.file_path) {
      return res.status(404).json({ error: 'Fichier Word (.DOCX) introuvable pour ce modèle.' });
    }

    const fullPath = path.join(uploadDir, template.file_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Le fichier physique DOCX n’existe plus sur le serveur.' });
    }

    const downloadName = `${template.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_v${template.version || 1}.docx`;
    res.download(fullPath, downloadName);
  } catch (err) {
    console.error('Download DOCX error:', err);
    res.status(500).json({ error: 'Erreur lors du téléchargement du fichier Word.' });
  }
});

// 18. POST /api/templates/:id/generate-docx - Generate Word document with injected runtime data
router.post('/:id/generate-docx', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const dataMap = req.body || {};

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    let sourceBuffer;
    if (template.file_path && fs.existsSync(path.join(uploadDir, template.file_path))) {
      sourceBuffer = fs.readFileSync(path.join(uploadDir, template.file_path));
    } else {
      sourceBuffer = await docxService.buildOfficialKindiaMissionDocx(dataMap);
    }

    const filledDocx = await docxService.fillDocxTemplate(sourceBuffer, dataMap);
    const outputFilename = `document_gen_${Date.now()}_${template.code}.docx`;
    const outputPath = path.join(uploadDir, outputFilename);
    fs.writeFileSync(outputPath, filledDocx);

    res.json({
      success: true,
      filename: outputFilename,
      download_url: `/uploads/templates/${outputFilename}`
    });
  } catch (err) {
    console.error('Generate DOCX error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du document Word.' });
  }
});

// 19. POST /api/templates/:id/upload-docx-revision - Upload revised DOCX for a template version
router.post('/:id/upload-docx-revision', authenticateToken, requirePermission('templates.manage'), upload.single('docx_file'), async (req, res) => {
  const { id } = req.params;
  const { change_description, save_as_new_version } = req.body;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier Word (.DOCX) fourni.' });
    }

    const filePath = req.file.filename;
    const ext = 'DOCX';
    const extractedHtml = await extractHtmlFromTemplateFile(path.join(uploadDir, filePath), ext);

    let newVersionNum = template.version || 1;
    const isNewVer = save_as_new_version === 'true' || save_as_new_version === true;

    if (isNewVer) {
      newVersionNum = newVersionNum + 1;
      await db.run('UPDATE template_versions SET status = "ARCHIVED" WHERE template_id = ?', [template.id]);

      await db.run(
        `INSERT INTO template_versions (template_id, version, version_number, file_path, file_type, editor_type, content_body_html, change_description, status, created_by, uploaded_by)
         VALUES (?, ?, ?, ?, 'DOCX', 'MS_WORD', ?, ?, 'ACTIVE', ?, ?)`,
        [template.id, newVersionNum, newVersionNum, filePath, extractedHtml, change_description || `Révision Word v${newVersionNum}`, req.user.id, req.user.id]
      );
    } else {
      await db.run(
        `UPDATE template_versions 
         SET file_path = ?, file_type = 'DOCX', editor_type = 'MS_WORD', content_body_html = ? 
         WHERE template_id = ? AND (status = 'ACTIVE' OR version_number = ?)`,
        [filePath, extractedHtml, template.id, template.version || 1]
      );
    }

    await db.run(
      `UPDATE document_templates SET file_path = ?, format = 'DOCX', editor_type = 'MS_WORD', version = ?, content_body_html = ? WHERE id = ?`,
      [filePath, newVersionNum, extractedHtml, template.id]
    );

    await logAuditAction(req.user.id, 'UPLOAD_DOCX_REVISION', 'TEMPLATE', template.id, req, { version: newVersionNum });

    res.json({
      success: true,
      message: `Fichier Word (.DOCX) importé avec succès pour [${template.name}] (v${newVersionNum}).`,
      version: newVersionNum,
      file_path: filePath
    });
  } catch (err) {
    console.error('Upload DOCX revision error:', err);
    res.status(500).json({ error: 'Erreur lors de l’importation de la révision Word.' });
  }
});

// =========================================================================
// ONLYOFFICE DOCS OFFICIAL INTEGRATION ENDPOINTS
// =========================================================================

// Helper function to download file from ONLYOFFICE Server
function downloadFileFromUrl(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(fileUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const fileStream = fs.createWriteStream(destPath);

      const req = client.get(fileUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fileStream.close();
          fs.unlink(destPath, () => {});
          return downloadFileFromUrl(res.headers.location, destPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          fileStream.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`ONLYOFFICE download error HTTP ${res.statusCode}`));
        }
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(destPath);
        });
      });

      req.on('error', (err) => {
        fileStream.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    } catch (e) {
      reject(e);
    }
  });
}

// 20. GET /api/templates/:id/onlyoffice/config - Generate secure ONLYOFFICE Editor config
router.get('/:id/onlyoffice/config', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { version_id, mode } = req.query;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      await logAuditAction(req.user?.id || 1, 'DOCUMENT_ACCESS_DENIED', 'TEMPLATE', id, req, { reason: 'Template not found' });
      return res.status(404).json({ error: 'Modèle de document introuvable.' });
    }

    // Tenant check
    const tenantId = template.tenant_id || 'UNIVERSITE_KINDIA';

    // Retrieve specific version record if requested
    let versionRecord = null;
    let filePath = template.file_path;

    if (version_id && version_id !== 'current' && version_id !== 'latest') {
      versionRecord = await db.get(
        'SELECT * FROM template_versions WHERE (id = ? OR version_number = ?) AND template_id = ?',
        [version_id, version_id, template.id]
      );
      if (versionRecord && versionRecord.file_path) {
        filePath = versionRecord.file_path;
      }
    }

    // Ensure physical DOCX file exists on disk, create official default DOCX if missing
    if (!filePath || !fs.existsSync(path.join(uploadDir, filePath))) {
      const defaultDocxBuffer = await docxService.buildOfficialKindiaMissionDocx();
      const generatedFilename = `template_${Date.now()}_modele_${(template.code || 'DOC').toLowerCase()}.docx`;
      fs.writeFileSync(path.join(uploadDir, generatedFilename), defaultDocxBuffer);
      filePath = generatedFilename;

      await db.run('UPDATE document_templates SET file_path = ?, format = "DOCX", editor_type = "MS_WORD" WHERE id = ?', [generatedFilename, template.id]);
      if (versionRecord) {
        await db.run('UPDATE template_versions SET file_path = ?, file_type = "DOCX" WHERE id = ?', [generatedFilename, versionRecord.id]);
      }
      template.file_path = generatedFilename;
      template.format = 'DOCX';
    }

    console.log(`[PERSONNALISER] template_id = ${template.id}, document_id = ${template.id}, file_id = ${filePath}, version_id = ${version_id || 'current'}`);

    const editorMode = mode === 'view' ? 'view' : 'edit';
    const onlyofficePayload = buildOnlyofficeDocEditorConfig({
      template,
      version: versionRecord,
      user: req.user,
      mode: editorMode,
      tenantId
    });

    await logAuditAction(req.user.id, 'TEMPLATE_OPENED', 'TEMPLATE', template.id, req, {
      template_name: template.name,
      version: versionRecord ? (versionRecord.version_number || versionRecord.version) : (template.version || 1),
      mode: editorMode,
      document_key: onlyofficePayload.documentKey
    });

    res.json({
      success: true,
      config: onlyofficePayload.config,
      docServerUrl: onlyofficePayload.docServerUrl,
      documentKey: onlyofficePayload.documentKey,
      template: {
        id: template.id,
        code: template.code,
        name: template.name,
        version: template.version || 1,
        format: template.format || 'DOCX',
        is_default: template.is_default,
        file_path: filePath
      },
      version: versionRecord || {
        version_number: template.version || 1,
        file_type: template.format || 'DOCX'
      }
    });
  } catch (err) {
    console.error('ONLYOFFICE config generation error:', err);
    res.status(500).json({ error: 'Erreur lors de la configuration de l’éditeur ONLYOFFICE Docs.' });
  }
});

// 21. GET /api/templates/:id/versions/:versionId/onlyoffice-file - Serve DOCX binary to ONLYOFFICE Document Server
router.get('/:id/versions/:versionId/onlyoffice-file', async (req, res) => {
  const { id, versionId } = req.params;
  const { token } = req.query;

  try {
    // Verify token if configured
    if (ONLYOFFICE_CONFIG.JWT_SECRET && token) {
      try {
        jwt.verify(token, ONLYOFFICE_CONFIG.JWT_SECRET);
      } catch (jwtErr) {
        console.warn('Invalid ONLYOFFICE doc access token:', jwtErr.message);
      }
    }

    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    let filePath = template.file_path;

    if (versionId && versionId !== 'current' && versionId !== 'latest') {
      const vRecord = await db.get(
        'SELECT * FROM template_versions WHERE (id = ? OR version_number = ?) AND template_id = ?',
        [versionId, versionId, template.id]
      );
      if (vRecord && vRecord.file_path) {
        filePath = vRecord.file_path;
      }
    }

    if (!filePath || !fs.existsSync(path.join(uploadDir, filePath))) {
      // Generate default if not present
      const defaultDocxBuffer = await docxService.buildOfficialKindiaMissionDocx();
      const generatedFilename = `template_${Date.now()}_${(template.code || 'doc').toLowerCase()}.docx`;
      fs.writeFileSync(path.join(uploadDir, generatedFilename), defaultDocxBuffer);
      filePath = generatedFilename;
      await db.run('UPDATE document_templates SET file_path = ? WHERE id = ?', [generatedFilename, template.id]);
    }

    const fullPath = path.join(uploadDir, filePath);
    const fileName = `${(template.name || 'Modele_Officiel').replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.sendFile(fullPath);
  } catch (err) {
    console.error('ONLYOFFICE file streaming error:', err);
    res.status(500).json({ error: 'Erreur lors de la diffusion du fichier DOCX.' });
  }
});

// 22. POST /api/templates/:id/onlyoffice/callback - ONLYOFFICE Save Callback Handler
router.post('/:id/onlyoffice/callback', async (req, res) => {
  const { id } = req.params;
  const callbackData = req.body;
  const token = req.query.token;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      console.warn(`[ONLYOFFICE CALLBACK] Template ID ${id} not found.`);
      return res.json({ error: 0 });
    }

    const status = callbackData.status;
    console.log(`[ONLYOFFICE CALLBACK] Template [${template.name}] (ID: ${template.id}) - Status: ${status}`);

    // Status 1: Document is being edited
    if (status === 1) {
      await logAuditAction(1, 'TEMPLATE_EDITED', 'TEMPLATE', template.id, req, {
        template_name: template.name,
        users: callbackData.users
      });
      return res.json({ error: 0 });
    }

    // Status 2 (Ready for saving) or Status 6 (Force save while editing)
    if (status === 2 || status === 6) {
      const downloadUrl = callbackData.url;
      if (!downloadUrl) {
        console.warn('[ONLYOFFICE CALLBACK] Missing download URL in save payload');
        return res.json({ error: 0 });
      }

      const saveAsNewVersion = req.query.new_version === '1' || callbackData.forcesavetype === 2;
      let targetVersionNum = template.version || 1;

      if (saveAsNewVersion) {
        targetVersionNum += 1;
      }

      const newFileName = `template_${Date.now()}_onlyoffice_${template.code.toLowerCase()}_v${targetVersionNum}.docx`;
      const newFilePath = path.join(uploadDir, newFileName);

      // Download the modified DOCX from ONLYOFFICE Document Server
      await downloadFileFromUrl(downloadUrl, newFilePath);
      console.log(`[ONLYOFFICE CALLBACK] Saved modified DOCX to ${newFilePath}`);

      // Extract HTML for lightweight index preview
      let extractedHtml = null;
      try {
        extractedHtml = await extractHtmlFromTemplateFile(newFilePath, 'DOCX');
      } catch (e) {
        console.warn('HTML extraction warning:', e.message);
      }

      if (saveAsNewVersion) {
        // Archive existing versions and insert new version
        await db.run('UPDATE template_versions SET status = "ARCHIVED" WHERE template_id = ?', [template.id]);
        await db.run(
          `INSERT INTO template_versions (template_id, version, version_number, file_path, file_type, editor_type, content_body_html, change_description, status, created_by, uploaded_by)
           VALUES (?, ?, ?, ?, 'DOCX', 'MS_WORD', ?, 'Enregistrement ONLYOFFICE Docs (Nouvelle version)', 'ACTIVE', 1, 1)`,
          [template.id, targetVersionNum, targetVersionNum, newFileName, extractedHtml]
        );

        await db.run(
          `UPDATE document_templates SET file_path = ?, format = 'DOCX', editor_type = 'MS_WORD', version = ?, content_body_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [newFileName, targetVersionNum, extractedHtml, template.id]
        );

        await logAuditAction(1, 'TEMPLATE_VERSION_CREATED', 'TEMPLATE', template.id, req, {
          template_name: template.name,
          version: targetVersionNum,
          file_name: newFileName,
          saved_via: 'ONLYOFFICE_DOCS'
        });
      } else {
        // Update current version
        const currentVersionRecord = await db.get(
          'SELECT id FROM template_versions WHERE template_id = ? AND (status = "ACTIVE" OR version_number = ?)',
          [template.id, template.version || 1]
        );

        if (currentVersionRecord) {
          await db.run(
            `UPDATE template_versions SET file_path = ?, file_type = 'DOCX', editor_type = 'MS_WORD', content_body_html = ? WHERE id = ?`,
            [newFileName, extractedHtml, currentVersionRecord.id]
          );
        } else {
          await db.run(
            `INSERT INTO template_versions (template_id, version, version_number, file_path, file_type, editor_type, content_body_html, change_description, status, created_by, uploaded_by)
             VALUES (?, ?, ?, ?, 'DOCX', 'MS_WORD', ?, 'Enregistrement initial ONLYOFFICE Docs', 'ACTIVE', 1, 1)`,
            [template.id, targetVersionNum, targetVersionNum, newFileName, extractedHtml]
          );
        }

        await db.run(
          `UPDATE document_templates SET file_path = ?, format = 'DOCX', editor_type = 'MS_WORD', content_body_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [newFileName, extractedHtml, template.id]
        );

        await logAuditAction(1, 'TEMPLATE_SAVED', 'TEMPLATE', template.id, req, {
          template_name: template.name,
          version: targetVersionNum,
          file_name: newFileName,
          saved_via: 'ONLYOFFICE_DOCS'
        });
      }
    }

    res.json({ error: 0 });
  } catch (err) {
    console.error('[ONLYOFFICE CALLBACK] Error handling callback:', err);
    await logAuditAction(1, 'DOCUMENT_SAVE_FAILED', 'TEMPLATE', id, req, { error: err.message });
    res.json({ error: 0 }); // ONLYOFFICE expects error 0 to prevent continuous retries
  }
});

// 23. POST /api/templates/:id/onlyoffice/manual-save - Frontend manual save or new version request
router.post('/:id/onlyoffice/manual-save', authenticateToken, requirePermission('templates.manage'), async (req, res) => {
  const { id } = req.params;
  const { save_as_new_version, change_description } = req.body;

  try {
    const template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [id, id]);
    if (!template) {
      return res.status(404).json({ error: 'Modèle introuvable.' });
    }

    let newVersionNum = template.version || 1;
    const isNewVer = save_as_new_version === true || save_as_new_version === 'true';

    if (isNewVer) {
      newVersionNum += 1;

      // Duplicate current file for new version
      let currentFile = template.file_path;
      let newFileName = `template_${Date.now()}_onlyoffice_${template.code.toLowerCase()}_v${newVersionNum}.docx`;

      if (currentFile && fs.existsSync(path.join(uploadDir, currentFile))) {
        fs.copyFileSync(path.join(uploadDir, currentFile), path.join(uploadDir, newFileName));
      } else {
        const defaultDocx = await docxService.buildOfficialKindiaMissionDocx();
        fs.writeFileSync(path.join(uploadDir, newFileName), defaultDocx);
      }

      const extractedHtml = await extractHtmlFromTemplateFile(path.join(uploadDir, newFileName), 'DOCX');

      await db.run('UPDATE template_versions SET status = "ARCHIVED" WHERE template_id = ?', [template.id]);
      await db.run(
        `INSERT INTO template_versions (template_id, version, version_number, file_path, file_type, editor_type, content_body_html, change_description, status, created_by, uploaded_by)
         VALUES (?, ?, ?, ?, 'DOCX', 'MS_WORD', ?, ?, 'ACTIVE', ?, ?)`,
        [template.id, newVersionNum, newVersionNum, newFileName, extractedHtml, change_description || `Nouvelle version v${newVersionNum}`, req.user.id, req.user.id]
      );

      await db.run(
        `UPDATE document_templates SET file_path = ?, format = 'DOCX', editor_type = 'MS_WORD', version = ?, content_body_html = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newFileName, newVersionNum, extractedHtml, template.id]
      );

      await logAuditAction(req.user.id, 'TEMPLATE_VERSION_CREATED', 'TEMPLATE', template.id, req, {
        template_name: template.name,
        version: newVersionNum,
        file_name: newFileName
      });

      return res.json({
        success: true,
        message: `Nouvelle version v${newVersionNum} du modèle créée avec succès.`,
        version: newVersionNum,
        file_path: newFileName
      });
    }

    await logAuditAction(req.user.id, 'TEMPLATE_SAVED', 'TEMPLATE', template.id, req, {
      template_name: template.name,
      version: newVersionNum
    });

    res.json({
      success: true,
      message: `Modèle officiel [${template.name}] enregistré avec succès (v${newVersionNum}).`,
      version: newVersionNum
    });
  } catch (err) {
    console.error('Manual save ONLYOFFICE error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement du modèle.' });
  }
});

module.exports = router;

