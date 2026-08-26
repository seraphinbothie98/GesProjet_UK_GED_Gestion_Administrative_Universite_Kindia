const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { 
  getServiceHierarchy, 
  getServiceDocumentSettings, 
  previewReference 
} = require('../services/numberGenerator');

/**
 * GET /api/service-settings/document-settings
 * Retrieve document presentation & reference configuration for the user's service
 */
router.get('/document-settings', authenticateToken, async (req, res) => {
  const user = req.user;
  const targetServiceId = req.query.service_id && user.role_code === 'ADMINISTRATEUR'
    ? Number(req.query.service_id)
    : Number(user.service_id);

  if (!targetServiceId) {
    return res.status(400).json({ error: 'Service introuvable pour cet utilisateur.' });
  }

  try {
    const hierarchy = await getServiceHierarchy(targetServiceId);
    let settings = await getServiceDocumentSettings(targetServiceId);

    // If no custom settings exist yet, build intelligent defaults based on service hierarchy
    if (!settings) {
      const defaultTypeCodes = {
        LETTRE: 'LET',
        DEMANDE: 'DEM',
        SOIT_TRANSMIS: 'ST',
        NOTE_SERVICE: 'NS',
        RAPPORT: 'RAP',
        PROCES_VERBAL: 'PV',
        DECISION: 'DEC',
        ARRETE: 'ARR',
        DECRET: 'DEC',
        CIRCULAIRE: 'CIR',
        MISSION_ORDER: 'OM',
        AUTRE: 'DOC'
      };

      const s = hierarchy?.service;
      const parent = hierarchy?.parent;

      const facultyName = (s?.structure_type === 'FACULTE') 
        ? s.name 
        : (parent?.structure_type === 'FACULTE' ? parent.name : '');

      const deptName = (s?.structure_type === 'DEPARTEMENT') 
        ? s.name 
        : (parent?.structure_type === 'DEPARTEMENT' ? parent.name : '');

      settings = {
        service_id: targetServiceId,
        version: 1,
        ref_pattern: '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}',
        seq_padding: 4,
        reset_annually: 1,
        prefix: '',
        suffix: '',
        type_codes: defaultTypeCodes,
        header_institution_name: 'RÉPUBLIQUE DE GUINÉE\nTravail – Justice – Solidarité\n\nUNIVERSITÉ DE KINDIA',
        header_faculty_name: facultyName,
        header_dept_name: deptName,
        header_service_name: s?.name || '',
        header_logo_enabled: 1,
        header_logo_path: s?.logo_path || null,
        header_address: s?.address || 'BP 164 Kindia, République de Guinée',
        header_phone: s?.phone || '+224 620 00 00 00',
        header_email: s?.email || 'contact@univ-kindia.edu.gn',
        header_website: 'www.univ-kindia.edu.gn',
        header_alignment: 'CENTER',
        header_custom_text: '',
        footer_custom_text: `Université de Kindia — ${s?.name || 'Service Administratif'}`,
        footer_confidentiality_note: 'Document officiel — Ne pas reproduire sans autorisation',
        footer_alignment: 'SPLIT',
        footer_enable_pagination: 1,
        footer_pagination_format: 'Page {PAGE} / {TOTAL_PAGES}',
        footer_show_separator: 1,
        footer_contact_info: `${s?.address || 'Kindia, Guinée'} • Email: ${s?.email || 'contact@univ-kindia.edu.gn'}`
      };
    }

    res.json({
      success: true,
      settings,
      hierarchy
    });
  } catch (err) {
    console.error('Get service document settings error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des paramètres de documents.' });
  }
});

/**
 * PUT /api/service-settings/document-settings
 * Update service document settings and log to history
 */
router.put('/document-settings', authenticateToken, requirePermission('documents.manage_service_settings'), async (req, res) => {
  const user = req.user;
  const {
    service_id,
    ref_pattern,
    seq_padding,
    reset_annually,
    prefix,
    suffix,
    type_codes,
    header_institution_name,
    header_faculty_name,
    header_dept_name,
    header_service_name,
    header_logo_enabled,
    header_logo_path,
    header_address,
    header_phone,
    header_email,
    header_website,
    header_alignment,
    header_custom_text,
    footer_custom_text,
    footer_confidentiality_note,
    footer_alignment,
    footer_enable_pagination,
    footer_pagination_format,
    footer_show_separator,
    footer_contact_info,
    change_summary
  } = req.body;

  const targetServiceId = (service_id && user.role_code === 'ADMINISTRATEUR')
    ? Number(service_id)
    : Number(user.service_id);

  if (!targetServiceId) {
    return res.status(400).json({ error: 'Service ID obligatoire.' });
  }

  // Security check: only own service can be edited unless Administrator
  if (user.role_code !== 'ADMINISTRATEUR' && Number(user.service_id) !== targetServiceId) {
    return res.status(403).json({ error: 'Vous ne pouvez pas modifier les paramètres d\'un autre service.' });
  }

  try {
    const existing = await db.get('SELECT * FROM service_document_settings WHERE service_id = ?', [targetServiceId]);
    const currentVersion = existing ? existing.version : 0;
    const nextVersion = currentVersion + 1;
    const typeCodesJson = JSON.stringify(type_codes || {});

    if (existing) {
      // Archive current snapshot to history
      await db.run(
        `INSERT INTO service_document_settings_history (service_id, version, settings_snapshot_json, change_summary, changed_by)
         VALUES (?, ?, ?, ?, ?)`,
        [
          targetServiceId,
          existing.version,
          JSON.stringify(existing),
          change_summary || `Mise à jour des paramètres vers la version ${nextVersion}`,
          user.id
        ]
      );

      // Update settings
      await db.run(
        `UPDATE service_document_settings 
         SET version = ?,
             ref_pattern = ?,
             seq_padding = ?,
             reset_annually = ?,
             prefix = ?,
             suffix = ?,
             type_codes_json = ?,
             header_institution_name = ?,
             header_faculty_name = ?,
             header_dept_name = ?,
             header_service_name = ?,
             header_logo_enabled = ?,
             header_logo_path = ?,
             header_address = ?,
             header_phone = ?,
             header_email = ?,
             header_website = ?,
             header_alignment = ?,
             header_custom_text = ?,
             footer_custom_text = ?,
             footer_confidentiality_note = ?,
             footer_alignment = ?,
             footer_enable_pagination = ?,
             footer_pagination_format = ?,
             footer_show_separator = ?,
             footer_contact_info = ?,
             updated_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE service_id = ?`,
        [
          nextVersion,
          ref_pattern || '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}',
          parseInt(seq_padding) || 4,
          reset_annually !== 0 ? 1 : 0,
          prefix || '',
          suffix || '',
          typeCodesJson,
          header_institution_name,
          header_faculty_name,
          header_dept_name,
          header_service_name,
          header_logo_enabled !== 0 ? 1 : 0,
          header_logo_path,
          header_address,
          header_phone,
          header_email,
          header_website,
          header_alignment || 'CENTER',
          header_custom_text,
          footer_custom_text,
          footer_confidentiality_note,
          footer_alignment || 'SPLIT',
          footer_enable_pagination !== 0 ? 1 : 0,
          footer_pagination_format || 'Page {PAGE} / {TOTAL_PAGES}',
          footer_show_separator !== 0 ? 1 : 0,
          footer_contact_info,
          user.id,
          targetServiceId
        ]
      );
    } else {
      // Insert initial record
      await db.run(
        `INSERT INTO service_document_settings 
         (service_id, version, ref_pattern, seq_padding, reset_annually, prefix, suffix, type_codes_json,
          header_institution_name, header_faculty_name, header_dept_name, header_service_name,
          header_logo_enabled, header_logo_path, header_address, header_phone, header_email, header_website,
          header_alignment, header_custom_text, footer_custom_text, footer_confidentiality_note,
          footer_alignment, footer_enable_pagination, footer_pagination_format, footer_show_separator,
          footer_contact_info, created_by, updated_by)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetServiceId,
          ref_pattern || '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}',
          parseInt(seq_padding) || 4,
          reset_annually !== 0 ? 1 : 0,
          prefix || '',
          suffix || '',
          typeCodesJson,
          header_institution_name,
          header_faculty_name,
          header_dept_name,
          header_service_name,
          header_logo_enabled !== 0 ? 1 : 0,
          header_logo_path,
          header_address,
          header_phone,
          header_email,
          header_website,
          header_alignment || 'CENTER',
          header_custom_text,
          footer_custom_text,
          footer_confidentiality_note,
          footer_alignment || 'SPLIT',
          footer_enable_pagination !== 0 ? 1 : 0,
          footer_pagination_format || 'Page {PAGE} / {TOTAL_PAGES}',
          footer_show_separator !== 0 ? 1 : 0,
          footer_contact_info,
          user.id,
          user.id
        ]
      );
    }

    await logAuditAction(user.id, 'UPDATE_SERVICE_DOCUMENT_SETTINGS', 'SERVICE_SETTINGS', targetServiceId, req, {
      version: nextVersion || 1,
      ref_pattern,
      reset_annually
    });

    const updated = await getServiceDocumentSettings(targetServiceId);

    res.json({
      success: true,
      message: `Paramètres de documents du service enregistrés avec succès (Version ${updated?.version || 1}).`,
      settings: updated
    });
  } catch (err) {
    console.error('Save service document settings error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement des paramètres.' });
  }
});

/**
 * POST /api/service-settings/preview-reference
 * Preview generated reference with dynamic tokens in real time
 */
router.post('/preview-reference', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const targetServiceId = req.body.service_id && user.role_code === 'ADMINISTRATEUR'
      ? Number(req.body.service_id)
      : Number(user.service_id);

    const hierarchy = await getServiceHierarchy(targetServiceId);
    
    const preview = previewReference({
      ...req.body,
      univ: hierarchy?.univCode || 'UK',
      faculty: hierarchy?.facultyCode || 'FS',
      dept: hierarchy?.deptCode || 'INFO',
      service: hierarchy?.serviceCode || 'INFO',
      service_ref: hierarchy?.referenceCode || 'FS/INFO',
      custom_values: req.body.custom_values || req.body.customValues || {}
    });

    res.json({ success: true, preview });
  } catch (err) {
    console.error('Preview reference error:', err);
    res.status(500).json({ error: 'Erreur lors du calcul de l\'aperçu.' });
  }
});

/**
 * System default dynamic fields definition
 */
const SYSTEM_DYNAMIC_FIELDS = [
  { field_key: 'sys_univ', name: 'Université', variable_code: 'UNIVERSITE', label: 'Université configurée', field_type: 'AUTO', source: 'Système', is_system: 1, applies_to_reference: 1, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_faculty', name: 'Faculté', variable_code: 'FACULTE', label: 'Faculté de rattachement', field_type: 'AUTO', source: 'Système', is_system: 1, applies_to_reference: 1, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_dept', name: 'Département', variable_code: 'DEPARTEMENT', label: 'Département académique', field_type: 'AUTO', source: 'Système', is_system: 1, applies_to_reference: 1, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_service', name: 'Service', variable_code: 'SERVICE', label: 'Structure émettrice', field_type: 'AUTO', source: 'Service', is_system: 1, applies_to_reference: 1, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_year', name: 'Année', variable_code: 'ANNEE', label: 'Année courante', field_type: 'AUTO', source: 'Système', is_system: 1, applies_to_reference: 1, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_month', name: 'Mois', variable_code: 'MOIS', label: 'Mois courant (2 chiffres)', field_type: 'AUTO', source: 'Système', is_system: 1, applies_to_reference: 1, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_seq', name: 'Numéro séquentiel', variable_code: 'NUMERO_SEQUENTIEL', label: 'Compteur séquentiel de service', field_type: 'SEQUENCE', source: 'Service', is_system: 1, applies_to_reference: 1, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_date', name: 'Date', variable_code: 'DATE', label: 'Date officielle du document', field_type: 'AUTO', source: 'Document', is_system: 1, applies_to_reference: 0, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_ref', name: 'Référence', variable_code: 'REFERENCE', label: 'Numéro de référence généré', field_type: 'AUTO', source: 'Document', is_system: 1, applies_to_reference: 0, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_dest', name: 'Destinataire', variable_code: 'DESTINATAIRE', label: 'Destinataire officiel', field_type: 'DOC_INFO', source: 'Document', is_system: 1, applies_to_reference: 0, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_obj', name: 'Objet', variable_code: 'OBJET', label: 'Objet du document', field_type: 'DOC_INFO', source: 'Document', is_system: 1, applies_to_reference: 0, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_resp', name: 'Responsable', variable_code: 'RESPONSABLE', label: 'Nom du responsable', field_type: 'SERVICE_INFO', source: 'Service', is_system: 1, applies_to_reference: 0, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 },
  { field_key: 'sys_fonc', name: 'Fonction Responsable', variable_code: 'FONCTION_RESPONSABLE', label: 'Titre de fonction', field_type: 'SERVICE_INFO', source: 'Service', is_system: 1, applies_to_reference: 0, applies_to_header: 1, applies_to_footer: 1, applies_to_document: 1 }
];

/**
 * GET /api/service-settings/custom-fields
 * Retrieve both system fields and service custom dynamic fields (Rules 1, 14, 16, 18)
 */
router.get('/custom-fields', authenticateToken, async (req, res) => {
  const user = req.user;
  const targetServiceId = req.query.service_id && user.role_code === 'ADMINISTRATEUR'
    ? Number(req.query.service_id)
    : Number(user.service_id);

  if (!targetServiceId) {
    return res.status(400).json({ error: 'Service ID requis.' });
  }

  try {
    const customFields = await db.all(
      `SELECT * FROM service_custom_fields 
       WHERE service_id = ? 
       ORDER BY order_index ASC, created_at ASC`,
      [targetServiceId]
    );

    const formattedCustom = (customFields || []).map(f => ({
      ...f,
      source: 'Service',
      is_system: 0,
      options: f.options_json ? JSON.parse(f.options_json) : []
    }));

    res.json({
      success: true,
      system_fields: SYSTEM_DYNAMIC_FIELDS,
      custom_fields: formattedCustom,
      all_fields: [...SYSTEM_DYNAMIC_FIELDS, ...formattedCustom]
    });
  } catch (err) {
    console.error('Get custom fields error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des champs dynamiques.' });
  }
});

/**
 * POST /api/service-settings/custom-fields
 * Create a new service custom dynamic field (Rules 2, 14, 17, 19)
 */
router.post('/custom-fields', authenticateToken, async (req, res) => {
  const user = req.user;
  const {
    service_id,
    name,
    variable_code,
    label,
    field_type,
    options,
    default_value,
    description,
    is_required,
    applies_to_reference,
    applies_to_header,
    applies_to_footer,
    applies_to_document
  } = req.body;

  const targetServiceId = (service_id && user.role_code === 'ADMINISTRATEUR')
    ? Number(service_id)
    : Number(user.service_id);

  if (!targetServiceId) {
    return res.status(400).json({ error: 'Service introuvable.' });
  }

  // Security check: service isolation
  if (user.role_code !== 'ADMINISTRATEUR' && Number(user.service_id) !== targetServiceId) {
    return res.status(403).json({ error: 'Vous ne pouvez créer des champs que pour votre propre service.' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom du champ est obligatoire.' });
  }

  // Auto-generate or clean variable code
  let cleanVarCode = (variable_code || name)
    .trim()
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!cleanVarCode) {
    cleanVarCode = `CHAMP_${Date.now()}`;
  }

  // Check collision with system fields (Rule 19)
  const isSystemConflict = SYSTEM_DYNAMIC_FIELDS.some(sf => sf.variable_code === cleanVarCode);
  if (isSystemConflict) {
    return res.status(400).json({ 
      error: `La variable [${cleanVarCode}] est réservée par le système. Veuillez choisir un autre code.` 
    });
  }

  try {
    // Check uniqueness within service
    const existing = await db.get(
      'SELECT id FROM service_custom_fields WHERE service_id = ? AND variable_code = ?',
      [targetServiceId, cleanVarCode]
    );

    if (existing) {
      return res.status(400).json({ 
        error: `Un champ avec la variable [${cleanVarCode}] existe déjà pour votre service.` 
      });
    }

    // Stable internal key
    const fieldKey = `cf_${targetServiceId}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const optionsJson = Array.isArray(options) ? JSON.stringify(options) : (options || '[]');

    const result = await db.run(
      `INSERT INTO service_custom_fields 
       (field_key, service_id, name, variable_code, label, field_type, options_json, default_value, description,
        is_required, applies_to_reference, applies_to_header, applies_to_footer, applies_to_document, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        fieldKey,
        targetServiceId,
        name.trim(),
        cleanVarCode,
        label ? label.trim() : name.trim(),
        field_type || 'TEXT',
        optionsJson,
        default_value || '',
        description || '',
        is_required ? 1 : 0,
        applies_to_reference !== undefined ? (applies_to_reference ? 1 : 0) : 1,
        applies_to_header !== undefined ? (applies_to_header ? 1 : 0) : 1,
        applies_to_footer !== undefined ? (applies_to_footer ? 1 : 0) : 1,
        applies_to_document !== undefined ? (applies_to_document ? 1 : 0) : 1
      ]
    );

    const createdField = await db.get('SELECT * FROM service_custom_fields WHERE id = ?', [result.lastID]);

    await logAuditAction(user.id, 'CREATE_CUSTOM_FIELD', 'SERVICE_SETTINGS', targetServiceId, req, {
      field_id: result.lastID,
      variable_code: cleanVarCode,
      name
    });

    res.status(201).json({
      success: true,
      message: `Champ dynamique [${name}] créé avec succès.`,
      field: {
        ...createdField,
        source: 'Service',
        is_system: 0,
        options: createdField.options_json ? JSON.parse(createdField.options_json) : []
      }
    });
  } catch (err) {
    console.error('Create custom field error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du champ dynamique : ' + err.message });
  }
});

/**
 * PUT /api/service-settings/custom-fields/:id
 * Modify an existing custom dynamic field without breaking stable keys (Rules 5, 17)
 */
router.put('/custom-fields/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  const {
    name,
    label,
    field_type,
    options,
    default_value,
    description,
    is_required,
    applies_to_reference,
    applies_to_header,
    applies_to_footer,
    applies_to_document,
    is_active
  } = req.body;

  try {
    const existing = await db.get('SELECT * FROM service_custom_fields WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Champ dynamique introuvable.' });
    }

    if (user.role_code !== 'ADMINISTRATEUR' && Number(user.service_id) !== Number(existing.service_id)) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que les champs de votre propre service.' });
    }

    const optionsJson = Array.isArray(options) ? JSON.stringify(options) : (options || existing.options_json);

    await db.run(
      `UPDATE service_custom_fields SET
         name = ?, label = ?, field_type = ?, options_json = ?, default_value = ?, description = ?,
         is_required = ?, applies_to_reference = ?, applies_to_header = ?, applies_to_footer = ?,
         applies_to_document = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name ? name.trim() : existing.name,
        label !== undefined ? label.trim() : existing.label,
        field_type || existing.field_type,
        optionsJson,
        default_value !== undefined ? default_value : existing.default_value,
        description !== undefined ? description : existing.description,
        is_required !== undefined ? (is_required ? 1 : 0) : existing.is_required,
        applies_to_reference !== undefined ? (applies_to_reference ? 1 : 0) : existing.applies_to_reference,
        applies_to_header !== undefined ? (applies_to_header ? 1 : 0) : existing.applies_to_header,
        applies_to_footer !== undefined ? (applies_to_footer ? 1 : 0) : existing.applies_to_footer,
        applies_to_document !== undefined ? (applies_to_document ? 1 : 0) : existing.applies_to_document,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        id
      ]
    );

    const updatedField = await db.get('SELECT * FROM service_custom_fields WHERE id = ?', [id]);

    await logAuditAction(user.id, 'UPDATE_CUSTOM_FIELD', 'SERVICE_SETTINGS', existing.service_id, req, {
      field_id: id,
      variable_code: existing.variable_code
    });

    res.json({
      success: true,
      message: `Champ [${updatedField.name}] mis à jour avec succès.`,
      field: {
        ...updatedField,
        source: 'Service',
        is_system: 0,
        options: updatedField.options_json ? JSON.parse(updatedField.options_json) : []
      }
    });
  } catch (err) {
    console.error('Update custom field error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du champ : ' + err.message });
  }
});

/**
 * GET /api/service-settings/custom-fields/:id/usage
 * Check usage impact before deleting a dynamic field (Rule 6)
 */
router.get('/custom-fields/:id/usage', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const field = await db.get('SELECT * FROM service_custom_fields WHERE id = ?', [id]);
    if (!field) {
      return res.status(404).json({ error: 'Champ introuvable.' });
    }

    const varCode = field.variable_code;
    const regexTag1 = `{{${varCode}}}`;
    const regexTag2 = `{${varCode}}`;

    const usages = [];

    // 1. Check in Service Document Settings
    const sSettings = await db.get('SELECT * FROM service_document_settings WHERE service_id = ?', [field.service_id]);
    if (sSettings) {
      if (sSettings.ref_pattern?.includes(varCode)) {
        usages.push({ type: 'REFERENCE_PATTERN', label: 'Modèle de référence du service', value: sSettings.ref_pattern });
      }
      if (sSettings.header_custom_text?.includes(varCode) || sSettings.header_institution_name?.includes(varCode)) {
        usages.push({ type: 'HEADER', label: 'En-tête personnalisé du service' });
      }
      if (sSettings.footer_custom_text?.includes(varCode) || sSettings.footer_contact_info?.includes(varCode)) {
        usages.push({ type: 'FOOTER', label: 'Pied de page du service' });
      }
    }

    // 2. Check in Document Templates
    const templates = await db.all(
      `SELECT id, name FROM document_templates 
       WHERE (target_service_id = ? OR scope_type = 'GLOBAL') 
         AND (content_body_html LIKE ? OR content_body_html LIKE ?)`,
      [field.service_id, `%${regexTag1}%`, `%${regexTag2}%`]
    );
    for (const t of templates || []) {
      usages.push({ type: 'TEMPLATE', label: `Modèle de document [${t.name}]`, id: t.id });
    }

    // 3. Check in Documents
    const docsCount = await db.get(
      `SELECT COUNT(*) as count FROM documents 
       WHERE originating_service_id = ? 
         AND (content_body LIKE ? OR content_body LIKE ? OR reference LIKE ?)`,
      [field.service_id, `%${regexTag1}%`, `%${regexTag2}%`, `%${varCode}%`]
    );

    if (docsCount && docsCount.count > 0) {
      usages.push({ type: 'DOCUMENTS', label: `${docsCount.count} document(s) existant(s)`, count: docsCount.count });
    }

    const totalCount = usages.length;
    res.json({
      success: true,
      field,
      is_used: totalCount > 0,
      total_occurrences: totalCount,
      usages
    });
  } catch (err) {
    console.error('Check custom field usage error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification de l\'usage : ' + err.message });
  }
});

/**
 * DELETE /api/service-settings/custom-fields/:id
 * Delete a custom dynamic field with impact verification (Rule 6)
 */
router.delete('/custom-fields/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const field = await db.get('SELECT * FROM service_custom_fields WHERE id = ?', [id]);
    if (!field) {
      return res.status(404).json({ error: 'Champ dynamique introuvable.' });
    }

    if (user.role_code !== 'ADMINISTRATEUR' && Number(user.service_id) !== Number(field.service_id)) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que les champs de votre propre service.' });
    }

    await db.run('DELETE FROM service_custom_fields WHERE id = ?', [id]);

    await logAuditAction(user.id, 'DELETE_CUSTOM_FIELD', 'SERVICE_SETTINGS', field.service_id, req, {
      field_id: id,
      variable_code: field.variable_code,
      name: field.name
    });

    res.json({
      success: true,
      message: `Champ dynamique [${field.name}] supprimé avec succès.`
    });
  } catch (err) {
    console.error('Delete custom field error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du champ : ' + err.message });
  }
});

/**
 * GET /api/service-settings/history
 * List previous versions of settings
 */
router.get('/history', authenticateToken, async (req, res) => {
  const user = req.user;
  const targetServiceId = req.query.service_id && user.role_code === 'ADMINISTRATEUR'
    ? Number(req.query.service_id)
    : Number(user.service_id);

  if (!targetServiceId) return res.status(400).json({ error: 'Service ID requis.' });

  try {
    const history = await db.all(
      `SELECT h.*, u.first_name, u.last_name, u.email
       FROM service_document_settings_history h
       JOIN users u ON h.changed_by = u.id
       WHERE h.service_id = ?
       ORDER BY h.version DESC, h.changed_at DESC`,
      [targetServiceId]
    );

    res.json({ success: true, history });
  } catch (err) {
    console.error('Get service settings history error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique.' });
  }
});

module.exports = router;
