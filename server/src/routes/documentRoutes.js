const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { UPLOAD_DIR } = require('../config/constants');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { buildABACDocumentFilter, verifyDocumentAccess } = require('../middleware/abac');
const { generateReference, generateReferenceWithMeta, previewReference } = require('../services/numberGenerator');
const { logAuditAction } = require('../middleware/audit');
const { generateAndStoreReceipt } = require('../services/receiptService');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// GET /api/documents - List documents accessible to authenticated user under ABAC
router.get('/', authenticateToken, async (req, res) => {
  const { type, status, priority } = req.query;
  const user = req.user;

  try {
    const { sql: abacSql, params: abacParams } = buildABACDocumentFilter(user);

    let query = `
      SELECT DISTINCT d.*, 
             s.name as current_service_name, s.code as current_service_code,
             u.first_name as current_user_first, u.last_name as current_user_last,
             cb.first_name as creator_first, cb.last_name as creator_last,
             (SELECT COUNT(*) FROM attachments WHERE document_id = d.id) as attachment_count
      FROM documents d
      JOIN services s ON d.current_service_id = s.id
      LEFT JOIN users u ON d.current_user_id = u.id
      JOIN users cb ON d.created_by = cb.id
      WHERE ${abacSql}
    `;

    const queryParams = [...abacParams];

    if (type) {
      if (type === 'OUTGOING_MAIL' || type === 'COURRIER_SORTANT') {
        query += ` AND d.document_type IN ('OUTGOING_MAIL', 'SOIT_TRANSMIS', 'COURRIER_SORTANT')`;
      } else if (type === 'INCOMING_MAIL' || type === 'COURRIER_ENTRANT') {
        query += ` AND d.document_type IN ('INCOMING_MAIL', 'COURRIER_ENTRANT')`;
      } else {
        query += ` AND d.document_type = ?`;
        queryParams.push(type);
      }
    }
    if (status) {
      query += ` AND d.status = ?`;
      queryParams.push(status);
    } else {
      query += ` AND d.status != 'TRASHED'`;
    }
    if (priority) {
      query += ` AND d.priority = ?`;
      queryParams.push(priority);
    }

    query += ` ORDER BY d.created_at DESC`;

    const documents = await db.all(query, queryParams);
    res.json(documents);
  } catch (err) {
    console.error('Fetch documents error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des documents.' });
  }
});

// GET /api/documents/to-sign - List documents pending electronic signature for authenticated responsable
router.get('/to-sign', authenticateToken, async (req, res) => {
  const user = req.user;
  try {
    const { sql: abacSql, params: abacParams } = buildABACDocumentFilter(user);

    let query = `
      SELECT DISTINCT d.*, 
             s.name as current_service_name, s.code as current_service_code,
             u.first_name as current_user_first, u.last_name as current_user_last,
             cb.first_name as creator_first, cb.last_name as creator_last
      FROM documents d
      JOIN services s ON d.current_service_id = s.id
      LEFT JOIN users u ON d.current_user_id = u.id
      JOIN users cb ON d.created_by = cb.id
      WHERE (${abacSql}) 
        AND d.current_service_id = ?
        AND d.is_locked = 0
        AND d.status NOT IN ('SIGNÉ', 'SIGNED', 'ARCHIVED', 'ARCHIVÉ', 'TRASHED', 'ACCEPTED', 'ACCEPTE', 'REJECTED', 'REJETÉ', 'RETOURNÉ AU SECRÉTARIAT CENTRAL', 'REMIS AU DEMANDEUR', 'REMIS AU MISSIONNAIRE')
        AND d.status != 'TRASHED'
      ORDER BY d.created_at DESC
    `;

    const docs = await db.all(query, [...abacParams, user.service_id]);
    res.json(docs);
  } catch (err) {
    console.error('Fetch to-sign documents error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des documents à signer.' });
  }
});

// Middleware to ensure user is System Administrator for deletion/trash actions
function requireSystemAdminRole(req, res, next) {
  if (!req.user || req.user.role_code !== 'ADMINISTRATEUR') {
    return res.status(403).json({
      error: "ACCÈS REFUSÉ : La suppression et la gestion de la corbeille sont réservées exclusivement à l'Administrateur Système."
    });
  }
  next();
}

// GET /api/documents/trash - List Trashed Documents (Section 13, 14)
router.get('/trash', authenticateToken, requireSystemAdminRole, async (req, res) => {
  try {
    const trashedDocs = await db.all(
      `SELECT d.*, 
              s.name as current_service_name,
              u.first_name as deleter_first, u.last_name as deleter_last,
              cb.first_name as creator_first, cb.last_name as creator_last
       FROM documents d
       LEFT JOIN services s ON d.current_service_id = s.id
       LEFT JOIN users u ON d.deleted_by = u.id
       LEFT JOIN users cb ON d.created_by = cb.id
       WHERE d.status = 'TRASHED'
       ORDER BY d.deleted_at DESC`
    );
    res.json(trashedDocs);
  } catch (err) {
    console.error('Fetch trashed documents error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la corbeille.' });
  }
});

// GET /api/documents/attachments/:id/view - Secure Attachment File Streamer (Rules 1, 2, 3, 4, 5)
router.get('/attachments/:id/view', authenticateToken, async (req, res) => {
  const attachmentId = req.params.id;

  try {
    const attachment = await db.get('SELECT * FROM attachments WHERE id = ?', [attachmentId]);
    if (!attachment) {
      return res.status(404).json({ error: 'Pièce jointe non trouvée.' });
    }

    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [attachment.document_id]);
    if (!doc) {
      return res.status(404).json({ error: 'Document associé non trouvé.' });
    }

    // Verify ABAC access for user
    req.params.id = doc.id;
    await verifyDocumentAccess(req, res, () => {});

    const fs = require('fs');
    const fileBasename = path.basename(attachment.file_path);
    const fullPath = path.join(UPLOAD_DIR, fileBasename);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Fichier physique introuvable sur le serveur.' });
    }

    const mimeType = attachment.mime_type || 'application/pdf';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(attachment.file_name)}"`);
    return res.sendFile(fullPath);
  } catch (err) {
    console.error('View attachment error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de la pièce jointe.' });
  }
});

// GET /api/documents/preview-reference - Preview next official reference
router.get('/preview-reference', authenticateToken, async (req, res) => {
  const type = req.query.type || 'INCOMING_MAIL';
  try {
    const preview = await previewReference(type);
    res.json({ reference: preview });
  } catch (err) {
    console.error('Preview reference error:', err);
    res.status(500).json({ error: 'Erreur lors de la prévisualisation de la référence.' });
  }
});

// GET /api/documents/:id/signed-pdf/view OR /api/documents/:id/view OR /api/documents/:id/download - Secure Document File Streamer
router.get(['/:id/signed-pdf/view', '/:id/view', '/:id/download'], authenticateToken, verifyDocumentAccess, async (req, res) => {
  const docId = req.params.id;

  try {
    const doc = req.document || await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) {
      return res.status(404).json({ error: 'Document introuvable.' });
    }

    let targetFilePath = null;
    let targetFileName = `${doc.reference || 'document'}.pdf`;
    let targetMimeType = 'application/pdf';

    // 1. Check mission_orders for signed PDF or frozen instance
    const mo = await db.get('SELECT signed_pdf_path, generated_file_path, generated_docx_path FROM mission_orders WHERE document_id = ?', [docId]);
    if (mo) {
      if (mo.signed_pdf_path) {
        targetFilePath = mo.signed_pdf_path;
      } else if (mo.generated_file_path) {
        targetFilePath = mo.generated_file_path;
      } else if (mo.generated_docx_path) {
        targetFilePath = mo.generated_docx_path;
      }
    }

    // 2. Check documents.file_path
    if (!targetFilePath && doc.file_path) {
      targetFilePath = doc.file_path;
    }

    // 3. Check attachments table for uploaded file (Scans, PDF, Word, etc.)
    if (!targetFilePath) {
      const att = await db.get('SELECT * FROM attachments WHERE document_id = ? ORDER BY id ASC LIMIT 1', [docId]);
      if (att && att.file_path) {
        targetFilePath = att.file_path;
        targetFileName = att.file_name || targetFileName;
        targetMimeType = att.mime_type || targetMimeType;
      }
    }

    // If a physical file was found, verify and serve it
    if (targetFilePath) {
      const fileBasename = path.basename(targetFilePath);
      const fullPath = path.join(UPLOAD_DIR, fileBasename);

      if (fs.existsSync(fullPath)) {
        const extName = path.extname(fileBasename).toLowerCase();
        if (extName === '.pdf') targetMimeType = 'application/pdf';
        else if (extName === '.docx') targetMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (['.jpg', '.jpeg'].includes(extName)) targetMimeType = 'image/jpeg';
        else if (extName === '.png') targetMimeType = 'image/png';

        res.setHeader('Content-Type', targetMimeType);
        const disposition = req.path.includes('download') ? 'attachment' : 'inline';
        res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(targetFileName || fileBasename)}"`);
        return res.sendFile(fullPath);
      }
    }

    return res.status(404).json({ error: 'Fichier original ou PDF non disponible pour ce document.' });
  } catch (err) {
    console.error('View document error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement du document.' });
  }
});

// GET /api/documents/:id - Single Document Detail
router.get('/:id', authenticateToken, verifyDocumentAccess, async (req, res) => {
  try {
    const doc = req.document;

    // Fetch service & user metadata
    const currentService = await db.get('SELECT name, code FROM services WHERE id = ?', [doc.current_service_id]);
    const currentUser = doc.current_user_id ? await db.get('SELECT first_name, last_name, function_title FROM users WHERE id = ?', [doc.current_user_id]) : null;
    const creator = await db.get('SELECT first_name, last_name, function_title FROM users WHERE id = ?', [doc.created_by]);

    // Fetch extensions
    let extensionData = null;
    if (doc.document_type === 'INCOMING_MAIL') {
      extensionData = await db.get('SELECT * FROM incoming_mails WHERE document_id = ?', [doc.id]);
    } else if (doc.document_type === 'OUTGOING_MAIL') {
      extensionData = await db.get('SELECT * FROM outgoing_mails WHERE document_id = ?', [doc.id]);
    } else if (doc.document_type === 'MISSION_ORDER') {
      extensionData = await db.get('SELECT * FROM mission_orders WHERE document_id = ?', [doc.id]);
    }

    // Attachments
    const attachments = await db.all('SELECT * FROM attachments WHERE document_id = ?', [doc.id]);

    // History Timeline
    const history = await db.all(
      `SELECT dh.*, u.first_name, u.last_name, u.function_title, s.name as service_name
       FROM document_history dh
       JOIN users u ON dh.user_id = u.id
       JOIN services s ON dh.service_id = s.id
       WHERE dh.document_id = ?
       ORDER BY dh.timestamp ASC`,
      [doc.id]
    );

    // Transfers
    const transfers = await db.all(
      `SELECT dt.*, fs.name as from_service_name, ts.name as to_service_name
       FROM document_transfers dt
       JOIN services fs ON dt.from_service_id = fs.id
       JOIN services ts ON dt.to_service_id = ts.id
       WHERE dt.document_id = ?
       ORDER BY dt.sent_at ASC`,
      [doc.id]
    );

    await logAuditAction(req.user.id, 'VIEW', 'DOCUMENT', doc.id, req);

    res.json({
      ...doc,
      current_service_name: currentService ? currentService.name : '',
      current_service_code: currentService ? currentService.code : '',
      current_user_name: currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : null,
      creator_name: creator ? `${creator.first_name} ${creator.last_name}` : '',
      extension: extensionData,
      attachments,
      history,
      transfers
    });
  } catch (err) {
    console.error('Fetch document detail error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement du document.' });
  }
});

// GET /api/documents/:id/history - Dedicated history timeline endpoint
router.get('/:id/history', authenticateToken, verifyDocumentAccess, async (req, res) => {
  const docId = req.params.id;
  try {
    const history = await db.all(
      `SELECT dh.*, u.first_name, u.last_name, u.function_title, s.name as service_name
       FROM document_history dh
       JOIN users u ON dh.user_id = u.id
       JOIN services s ON dh.service_id = s.id
       WHERE dh.document_id = ?
       ORDER BY dh.timestamp ASC`,
      [docId]
    );
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération de l’historique.' });
  }
});

// POST /api/documents/incoming or /api/documents - Create Incoming Mail / Official Document
router.post(['/incoming', '/'], authenticateToken, requirePermission('incoming_mail.create'), upload.array('files'), async (req, res) => {
  const { 
    title, description, sender_name, sender_organization, sender_address, reception_date, 
    mail_type, priority, confidentiality, instruction, deadline_date, observations,
    processing_mode, official_type, document_date, has_external_signature, external_signatory_name, external_signature_date
  } = req.body;

  if (!title || !sender_name) {
    return res.status(400).json({ error: 'Veuillez renseigner le titre et l’expéditeur.' });
  }

  try {
    const { reference, reference_meta } = await generateReferenceWithMeta(official_type || 'INCOMING_MAIL');
    const trackingToken = require('crypto').randomBytes(16).toString('hex');
    const user = req.user;
    const isDirectArchive = processing_mode === 'DIRECT_ARCHIVE';

    const scService = await db.get('SELECT id, name FROM services WHERE code = "SC"');
    if (!scService) {
      return res.status(500).json({ error: 'Service Secrétariat Central introuvable.' });
    }

    let targetServiceId = null;
    let docStatus = 'IN_PROGRESS';
    let docType = official_type || 'INCOMING_MAIL';

    if (isDirectArchive) {
      // Rule 13: Permission & SC Context check for Direct Archiving
      const isSC = user.role_code === 'AGENT_SC' || user.role_code === 'ADMINISTRATEUR';
      const userService = user.service_id ? await db.get('SELECT code FROM services WHERE id = ?', [user.service_id]) : null;
      if (!isSC && (!userService || userService.code !== 'SC')) {
        return res.status(403).json({ error: "L'archivage direct est réservé exclusivement au Secrétariat Central et à l'Administration." });
      }

      // Check document type configuration
      if (!official_type || official_type === 'COURRIER_ENTRANT' || official_type === 'INCOMING_MAIL') {
        return res.status(400).json({ error: "Veuillez sélectionner un type d'acte officiel autorisé pour l'archivage direct (ex: Note de service, Décret, Arrêté, Décision, Circulaire, Procès-verbal)." });
      }

      const typeConfig = await db.get('SELECT * FROM document_type_configs WHERE code = ?', [official_type]);
      if (typeConfig && typeConfig.allow_direct_archive === 0) {
        return res.status(400).json({ error: `Le type de document [${typeConfig.label}] n'est pas autorisé pour l'archivage direct. Veuillez sélectionner un acte officiel valide.` });
      }

      targetServiceId = scService.id;
      docStatus = 'ARCHIVED';
    } else {
      // Path A: Normal workflow auto-routed to Secrétaire Général (SG)
      const sgService = await db.get('SELECT id, name FROM services WHERE code = "SG"');
      if (!sgService) {
        return res.status(500).json({ error: 'Service Secrétaire Général introuvable.' });
      }
      targetServiceId = sgService.id;
      docStatus = 'IN_PROGRESS';
    }

    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, title, description, sender_name, sender_organization, priority, confidentiality, status, current_service_id, current_user_id, created_by, deadline_date, processing_mode, document_date, has_external_signature, external_signatory_name, external_signature_date, reference_meta, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference, trackingToken, docType, title, description || '', sender_name, sender_organization || '', 
        priority || 'NORMAL', confidentiality || 'INTERNAL', docStatus, targetServiceId, user.id, deadline_date || null,
        isDirectArchive ? 'DIRECT_ARCHIVE' : 'NORMAL',
        document_date || null,
        has_external_signature ? 1 : 0,
        external_signatory_name || null,
        external_signature_date || null,
        reference_meta,
        isDirectArchive ? new Date().toISOString() : null
      ]
    );

    const docId = docRes.lastID;

    // Incoming Mail Details
    await db.run(
      `INSERT INTO incoming_mails (document_id, reception_date, sender_address, mail_type, instruction, observations)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [docId, reception_date || new Date().toISOString().split('T')[0], sender_address || '', mail_type || 'OFFICIAL', instruction || '', observations || '']
    );

    if (isDirectArchive) {
      // Path B History & Trace
      await db.run(
        `INSERT INTO document_history (document_id, user_id, service_id, action, details)
         VALUES (?, ?, ?, 'CREATE', ?)`,
        [docId, user.id, user.service_id, `Document officiel enregistré au Secrétariat Central avec référence : ${reference}. Type : ${docType}`]
      );

      await db.run(
        `INSERT INTO document_history (document_id, user_id, service_id, action, details)
         VALUES (?, ?, ?, 'ARCHIVE_DIRECT', ?)`,
        [docId, user.id, user.service_id, `Document officiel classé directement dans les archives permanentes de l'Université de Kindia (Catégorie : ${docType}).`]
      );

      await logAuditAction(user.id, 'DOCUMENT_ARCHIVE_DIRECT', 'DOCUMENT', docId, req, {
        reference,
        type: docType,
        processing_mode: 'DIRECT_ARCHIVE',
        status: 'ARCHIVED'
      });
    } else {
      // Path A History & Transmission Trace to SG
      await db.run(
        `INSERT INTO document_history (document_id, user_id, service_id, action, details)
         VALUES (?, ?, ?, 'CREATE', ?)`,
        [docId, user.id, user.service_id, `Courrier entrant enregistré au Secrétariat Central avec référence : ${reference}. Destinataire initial : Secrétaire Général`]
      );

      await db.run(
        `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, to_user_id, action, instruction, status)
         VALUES (?, ?, ?, ?, NULL, 'TRANSMIT', ?, 'PENDING')`,
        [docId, user.service_id, user.id, targetServiceId, instruction || 'Transmission automatique au Secrétaire Général']
      );

      await db.run(
        `INSERT INTO document_history (document_id, user_id, service_id, action, details)
         VALUES (?, ?, ?, 'TRANSMIT', ?)`,
        [docId, user.id, user.service_id, `Transmis au Secrétaire Général`]
      );
    }

    // Attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.run(
          `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [docId, file.originalname, file.path, file.size, file.mimetype, user.id]
        );
      }
    }

    await logAuditAction(user.id, 'CREATE', 'DOCUMENT', docId, req, { 
      reference, 
      type: docType, 
      processing_mode: isDirectArchive ? 'DIRECT_ARCHIVE' : 'NORMAL'
    });

    // Automatically generate official PDF Receipt with QR Code (Module Reçus Officiels)
    let receiptInfo = null;
    try {
      receiptInfo = await generateAndStoreReceipt(docId, 'INCOMING_MAIL', req);
    } catch (receiptErr) {
      console.error('Auto receipt generation failed for incoming mail:', receiptErr);
    }

    res.status(201).json({ 
      success: true, 
      id: docId, 
      reference,
      tracking_token: trackingToken,
      receipt: receiptInfo 
    });
  } catch (err) {
    console.error('Create incoming mail error:', err);
    res.status(500).json({ error: 'Erreur lors du traitement du courrier entrant.' });
  }
});

// POST /api/documents/soit-transmis - Create Soit-Transmis Document (Rules 6, 7, 8, 18, 19, 26)
router.post('/soit-transmis', authenticateToken, requirePermission('outgoing_mail.create'), upload.array('files'), async (req, res) => {
  const { recipient_name, recipient_address, object_title, content_body, pieces_jointes } = req.body;

  if (!recipient_name || !object_title || !content_body) {
    return res.status(400).json({ error: 'Destinataire, objet et contenu sont obligatoires.' });
  }

  try {
    const user = req.user;

    // Rule 26: Active Template Enforcement Check
    const activeTemplate = await db.get('SELECT * FROM document_templates WHERE code = "SOIT_TRANSMIS" AND is_active = 1');
    if (!activeTemplate) {
      return res.status(400).json({
        error: "⚠️ Aucun modèle officiel actif n'est disponible pour ce type de document [Soit-Transmis]."
      });
    }

    const { reference, reference_meta } = await generateReferenceWithMeta('SOIT_TRANSMIS');
    const trackingToken = require('crypto').randomBytes(16).toString('hex');

    // Route to Secrétariat Général for signature (Rule 18: SC -> SG)
    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    const targetServiceId = sgService ? sgService.id : user.service_id;

    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, title, description, sender_name, sender_organization, priority, confidentiality, status, current_service_id, created_by, reference_meta)
       VALUES (?, ?, 'SOIT_TRANSMIS', ?, ?, ?, 'Université de Kindia', 'HIGH', 'INTERNAL', 'PENDING', ?, ?, ?)`,
      [reference, trackingToken, `Soit-Transmis : ${object_title}`, content_body, user.first_name + ' ' + user.last_name, targetServiceId, user.id, reference_meta]
    );

    const docId = docRes.lastID;

    await db.run(
      `INSERT INTO outgoing_mails (document_id, recipient_name, recipient_address, content_body)
       VALUES (?, ?, ?, ?)`,
      [docId, recipient_name, recipient_address || '', content_body]
    );

    // Save Template Instance Snapshot (Rule 25)
    const snapshot = {
      template_code: activeTemplate.code,
      template_name: activeTemplate.name,
      template_version: activeTemplate.version,
      header_text: activeTemplate.header_text,
      footer_text: activeTemplate.footer_text,
      recipient_name,
      recipient_address,
      object_title,
      content_body,
      pieces_jointes: pieces_jointes || ''
    };

    await db.run(
      `INSERT INTO document_template_instances (document_id, template_id, template_version_id, snapshot_json)
       VALUES (?, ?, ?, ?)`,
      [docId, activeTemplate.id, activeTemplate.version, JSON.stringify(snapshot)]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'CREATE', ?)`,
      [docId, user.id, user.service_id, `Soit-Transmis créé par le Secrétariat Central avec référence : ${reference}. Soumis au Secrétaire Général pour signature.`]
    );

    await db.run(
      `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, action, instruction, status)
       VALUES (?, ?, ?, ?, 'TRANSMIT', 'Soumis pour signature du Secrétaire Général', 'PENDING')`,
      [docId, user.service_id, user.id, targetServiceId]
    );

    // Attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.run(
          `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [docId, file.originalname, file.path, file.size, file.mimetype, user.id]
        );
      }
    }

    await logAuditAction(user.id, 'CREATE_SOIT_TRANSMIS', 'DOCUMENT', docId, req, { reference });

    res.status(201).json({ success: true, id: docId, reference });
  } catch (err) {
    console.error('Create soit-transmis error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du Soit-Transmis.' });
  }
});

// POST /api/documents/outgoing - Create Outgoing Mail (Courrier Sortant)
router.post('/outgoing', authenticateToken, requirePermission('outgoing_mail.create'), upload.array('files'), async (req, res) => {
  const { title, description, recipient_name, recipient_address, content_body, priority, confidentiality } = req.body;

  if (!title || !recipient_name) {
    return res.status(400).json({ error: 'Titre et destinataire obligatoires.' });
  }

  try {
    const { reference, reference_meta } = await generateReferenceWithMeta('OUTGOING_MAIL');
    const trackingToken = require('crypto').randomBytes(16).toString('hex');
    const user = req.user;

    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, title, description, sender_name, sender_organization, priority, confidentiality, status, current_service_id, current_user_id, created_by, reference_meta)
       VALUES (?, ?, 'OUTGOING_MAIL', ?, ?, ?, 'Université de Kindia', ?, ?, 'CREATED', ?, ?, ?, ?)`,
      [reference, trackingToken, title, description || '', user.first_name + ' ' + user.last_name, priority || 'NORMAL', confidentiality || 'INTERNAL', user.service_id, user.id, user.id, reference_meta]
    );

    const docId = docRes.lastID;

    await db.run(
      `INSERT INTO outgoing_mails (document_id, recipient_name, recipient_address, content_body)
       VALUES (?, ?, ?, ?)`,
      [docId, recipient_name, recipient_address || '', content_body || '']
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'CREATE', ?)`,
      [docId, user.id, user.service_id, `Courrier sortant rédigé avec référence : ${reference}`]
    );

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.run(
          `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [docId, file.originalname, file.path, file.size, file.mimetype, user.id]
        );
      }
    }

    await logAuditAction(user.id, 'CREATE', 'DOCUMENT', docId, req, { reference, type: 'OUTGOING_MAIL' });

    res.status(201).json({ success: true, id: docId, reference });
  } catch (err) {
    console.error('Create outgoing mail error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du courrier sortant.' });
  }
});

// PUT /api/documents/:id/archive - Archive document (Strict Rules 3 & 6)
router.put('/:id/archive', authenticateToken, requirePermission('documents.archive'), verifyDocumentAccess, async (req, res) => {
  const docId = req.params.id;

  try {
    // Check 1: User's active service MUST be Secrétariat Central (code = 'SC')
    const userService = await db.get('SELECT code FROM services WHERE id = ?', [req.user.service_id]);
    if (!userService || userService.code !== 'SC') {
      return res.status(403).json({
        error: "ARCHIVAGE IMPOSSIBLE : L'archivage définitif est réservé exclusivement au Secrétariat Central."
      });
    }

    // Check 2: Document's current holder MUST be Secrétariat Central
    const doc = await db.get('SELECT current_service_id, status, document_type FROM documents WHERE id = ?', [docId]);
    if (!doc) {
      return res.status(404).json({ error: 'Document non trouvé.' });
    }

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    if (Number(doc.current_service_id) !== Number(scService.id)) {
      return res.status(400).json({
        error: "ARCHIVAGE IMPOSSIBLE : Le document doit d'abord terminer son circuit administratif et revenir au Secrétariat Central."
      });
    }

    // Check 3: Workflow/Treatment/Signatures must be completed or returned
    const validArchiveStatuses = ['RETURNED', 'RETOURNÉ AU SECRÉTARIAT CENTRAL', 'PRÊT POUR ARCHIVAGE', 'SIGNED', 'SIGNÉ', 'ACCEPTED', 'COMPLETED', 'REMIS AU DEMANDEUR'];
    if (!validArchiveStatuses.includes(doc.status)) {
      return res.status(400).json({
        error: "ARCHIVAGE IMPOSSIBLE : Le document n'a pas encore terminé son traitement obligatoire."
      });
    }

    // Rule 26: Mandatory Action Ordering for Mission Orders - MUST be delivered to recipient before archiving
    if (doc.document_type === 'MISSION_ORDER' && doc.status !== 'REMIS AU DEMANDEUR') {
      return res.status(400).json({
        error: "⚠️ ACTION IMPOSSIBLE : L'ordre de mission doit d'abord être imprimé et remis au demandeur."
      });
    }

    await db.run(
      `UPDATE documents SET status = 'ARCHIVED', archived_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'ARCHIVE', 'Document classé définitivement dans les archives électroniques au Secrétariat Central')`,
      [docId, req.user.id, req.user.service_id]
    );

    await logAuditAction(req.user.id, 'ARCHIVE', 'DOCUMENT', docId, req);

    res.json({ success: true, message: 'Document archivé avec succès par le Secrétariat Central.' });
  } catch (err) {
    console.error('Archive document error:', err);
    res.status(500).json({ error: 'Erreur lors de l’archivage.' });
  }
});

// PUT /api/documents/:id/archive-direct - Direct Archiving of Official Documents (Path B, Rules 4, 6, 13)
router.put('/:id/archive-direct', authenticateToken, requirePermission('documents.archive_direct'), verifyDocumentAccess, async (req, res) => {
  const docId = req.params.id;

  try {
    // Check 1: User active service MUST be Secrétariat Central (code = 'SC')
    const userService = await db.get('SELECT code FROM services WHERE id = ?', [req.user.service_id]);
    if (!userService || userService.code !== 'SC') {
      return res.status(403).json({
        error: "ARCHIVAGE DIRECT IMPOSSIBLE : L'archivage direct est réservé exclusivement au Secrétariat Central."
      });
    }

    // Check 2: Document current holder MUST be Secrétariat Central
    const doc = await db.get('SELECT current_service_id, status, document_type, reference FROM documents WHERE id = ?', [docId]);
    if (!doc) {
      return res.status(404).json({ error: 'Document non trouvé.' });
    }

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    if (Number(doc.current_service_id) !== Number(scService.id)) {
      return res.status(400).json({
        error: "ARCHIVAGE DIRECT IMPOSSIBLE : Le document n'est pas sous la responsabilité du Secrétariat Central."
      });
    }

    await db.run(
      `UPDATE documents SET status = 'ARCHIVED', processing_mode = 'DIRECT_ARCHIVE', archived_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'ARCHIVE_DIRECT', 'Document officiel classé directement dans les archives électroniques au Secrétariat Central')`,
      [docId, req.user.id, req.user.service_id]
    );

    await logAuditAction(req.user.id, 'ARCHIVE_DIRECT', 'DOCUMENT', docId, req, {
      reference: doc.reference,
      type: doc.document_type
    });

    res.json({ success: true, message: 'Document officiel archivé directement avec succès.' });
  } catch (err) {
    console.error('Direct archive document error:', err);
    res.status(500).json({ error: 'Erreur lors de l’archivage direct.' });
  }
});

// PUT /api/documents/:id/trash - Move Document to Trash (Suppression Logique, Section 1, 2, 4, 13, 14)
router.put('/:id/trash', authenticateToken, requireSystemAdminRole, async (req, res) => {
  const docId = req.params.id;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Le motif de suppression est obligatoire pour le journal d’audit.' });
  }

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) {
      return res.status(404).json({ error: 'Document introuvable.' });
    }

    const previousStatus = doc.status;
    await db.run(
      `UPDATE documents 
       SET previous_status = ?, status = 'TRASHED', deleted_at = CURRENT_TIMESTAMP, deleted_by = ?, deletion_reason = ? 
       WHERE id = ?`,
      [previousStatus, req.user.id, reason, docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'MOVE_TO_TRASH', ?)`,
      [docId, req.user.id, req.user.service_id || 1, `Document déplacé dans la Corbeille Administrateur par l’Administrateur Système. Motif: ${reason}`]
    );

    await logAuditAction(req.user.id, 'MOVE_TO_TRASH', 'DOCUMENT', docId, req, {
      reference: doc.reference,
      document_type: doc.document_type,
      previous_status: previousStatus,
      reason
    });

    res.json({ success: true, message: 'Document déplacé dans la corbeille administrateur.' });
  } catch (err) {
    console.error('Trash document error:', err);
    res.status(500).json({ error: 'Erreur lors du déplacement vers la corbeille.' });
  }
});

// PUT /api/documents/:id/restore - Restore Document from Trash (Section 13, 14)
router.put('/:id/restore', authenticateToken, requireSystemAdminRole, async (req, res) => {
  const docId = req.params.id;

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ? AND status = "TRASHED"', [docId]);
    if (!doc) {
      return res.status(404).json({ error: 'Document non trouvé dans la corbeille.' });
    }

    const restoredStatus = doc.previous_status || 'ARCHIVED';
    await db.run(
      `UPDATE documents 
       SET status = ?, deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL 
       WHERE id = ?`,
      [restoredStatus, docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'RESTORE_FROM_TRASH', ?)`,
      [docId, req.user.id, req.user.service_id || 1, `Document restauré de la corbeille vers l’état "${restoredStatus}".`]
    );

    await logAuditAction(req.user.id, 'RESTORE_FROM_TRASH', 'DOCUMENT', docId, req, {
      reference: doc.reference,
      restored_status: restoredStatus
    });

    res.json({ success: true, message: 'Document restauré avec succès.' });
  } catch (err) {
    console.error('Restore document error:', err);
    res.status(500).json({ error: 'Erreur lors de la restauration du document.' });
  }
});

// DELETE /api/documents/:id/permanent - Permanent Deletion (Section 2, 3, 4, 5, 6, 7, 16)
router.delete('/:id/permanent', authenticateToken, requireSystemAdminRole, async (req, res) => {
  const docId = req.params.id;
  const reason = req.body?.reason || req.query?.reason;
  const confirmText = req.body?.confirmText || req.query?.confirmText;

  if (confirmText !== 'SUPPRIMER') {
    return res.status(400).json({ error: 'Veuillez saisir exactement "SUPPRIMER" pour confirmer la suppression définitive.' });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Le motif de suppression définitive est obligatoire.' });
  }

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) {
      return res.status(404).json({ error: 'Document non trouvé.' });
    }

    // Step 1: Clean physical files for attachments
    const attachments = await db.all('SELECT file_path FROM attachments WHERE document_id = ?', [docId]);
    for (const att of attachments) {
      if (att.file_path) {
        const fullPath = path.join(UPLOAD_DIR, path.basename(att.file_path));
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (e) {}
        }
      }
    }

    // Step 2: Clean signed PDF physical file if applicable
    const mo = await db.get('SELECT signed_pdf_path FROM mission_orders WHERE document_id = ?', [docId]);
    if (mo && mo.signed_pdf_path) {
      const pdfPath = path.join(UPLOAD_DIR, path.basename(mo.signed_pdf_path));
      if (fs.existsSync(pdfPath)) {
        try { fs.unlinkSync(pdfPath); } catch (e) {}
      }
    }

    // Step 3: Delete database records linked exclusively to this document
    await db.run('DELETE FROM attachments WHERE document_id = ?', [docId]);
    await db.run('DELETE FROM incoming_mails WHERE document_id = ?', [docId]);
    await db.run('DELETE FROM outgoing_mails WHERE document_id = ?', [docId]);
    await db.run('DELETE FROM mission_orders WHERE document_id = ?', [docId]);
    await db.run('DELETE FROM document_transfers WHERE document_id = ?', [docId]);
    await db.run('DELETE FROM document_history WHERE document_id = ?', [docId]);
    await db.run('DELETE FROM signatures WHERE document_id = ?', [docId]);
    await db.run('UPDATE appointments SET document_id = NULL, document_reference_input = NULL WHERE document_id = ? OR document_reference_input = ?', [docId, doc.reference]);
    await db.run('DELETE FROM documents WHERE id = ?', [docId]);

    // Step 4: Record permanent audit trace (Section 5)
    await logAuditAction(req.user.id, 'SUPPRESSION DÉFINITIVE', 'DOCUMENT', docId, req, {
      reference: doc.reference,
      document_type: doc.document_type,
      status_before_deletion: doc.status,
      reason
    });

    res.json({ success: true, message: `Document ${doc.reference} et ses fichiers associés ont été définitivement supprimés.` });
  } catch (err) {
    console.error('Permanent delete document error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression définitive du document.' });
  }
});

// POST /api/documents/:id/archive - Archive a Document (Secrétariat Central / Admin)
router.post('/:id/archive', authenticateToken, async (req, res) => {
  const docId = req.params.id;

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    const newStatus = 'ARCHIVED';

    await db.run(
      `UPDATE documents SET status = ?, archived_at = CURRENT_TIMESTAMP, is_locked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStatus, docId]
    );

    await db.run(
      `UPDATE mission_order_requests SET status = 'ARCHIVÉ', updated_at = CURRENT_TIMESTAMP WHERE official_document_id = ?`,
      [docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'ARCHIVE_DOCUMENT', ?)`,
      [docId, req.user.id, req.user.service_id || 1, 'Document classé définitivement dans les archives électroniques.']
    );

    await logAuditAction(req.user.id, 'ARCHIVE_DOCUMENT', 'DOCUMENT', docId, req, {
      reference: doc.reference
    });

    res.json({ success: true, message: 'Document classé dans les archives avec succès.', status: newStatus });
  } catch (err) {
    console.error('Archive document error:', err);
    res.status(500).json({ error: 'Erreur lors de l’archivage du document.' });
  }
});

module.exports = router;
