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
    const hierarchy = await getServiceHierarchy(user.service_id);
    
    const preview = previewReference({
      ...req.body,
      univ: hierarchy?.univCode || 'UK',
      faculty: hierarchy?.facultyCode || 'FS',
      dept: hierarchy?.deptCode || 'INFO',
      service: hierarchy?.serviceCode || 'INFO',
      service_ref: hierarchy?.referenceCode || 'FS/INFO'
    });

    res.json({ success: true, preview });
  } catch (err) {
    console.error('Preview reference error:', err);
    res.status(500).json({ error: 'Erreur lors du calcul de l\'aperçu.' });
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
