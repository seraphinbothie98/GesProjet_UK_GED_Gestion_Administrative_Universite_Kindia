const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { UPLOAD_DIR } = require('../config/constants');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { buildABACDocumentFilter, verifyDocumentAccess } = require('../middleware/abac');
const { generateReference, generateReferenceWithMeta, previewReference, resolveAllDynamicVariables } = require('../services/numberGenerator');
const { logAuditAction } = require('../middleware/audit');
const { generateAndStoreReceipt } = require('../services/receiptService');
const documentTypeService = require('../services/documentTypeService');

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

// GET /api/documents/types - List all active document type configurations (Rule 4)
router.get('/types', authenticateToken, async (req, res) => {
  try {
    const types = await db.all('SELECT * FROM document_type_configs WHERE is_active = 1 ORDER BY label ASC');
    res.json(types);
  } catch (err) {
    console.error('Fetch document types error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des types de documents.' });
  }
});

// GET /api/documents/service-space - Full documentary workspace of the service (Rule 3, 22)
router.get('/service-space', authenticateToken, async (req, res) => {
  const user = req.user;
  const userSId = user.service_id;
  const { tab = 'all', search, type, priority } = req.query;

  try {
    // 1. Calculate count metrics for all 10 tabs for the service
    const metricCounts = {
      all: 0,
      my_docs: 0,
      drafts: 0,
      submitted: 0,
      transmitted: 0,
      received: 0,
      to_process: 0,
      returned: 0,
      validated: 0,
      signed: 0,
      archived: 0
    };

    const countQueries = {
      my_docs: `SELECT COUNT(*) as c FROM documents WHERE created_by = ? AND status != 'TRASHED'`,
      drafts: `SELECT COUNT(*) as c FROM documents WHERE (created_by = ? OR originating_service_id = ?) AND status = 'BROUILLON'`,
      submitted: `SELECT COUNT(*) as c FROM documents WHERE (created_by = ? OR originating_service_id = ?) AND status = 'SOUMIS'`,
      transmitted: `SELECT COUNT(*) as c FROM documents WHERE (originating_service_id = ? OR created_by = ?) AND status IN ('TRANSMIS', 'EN_COURS_TRAITEMENT') AND current_service_id != ?`,
      received: `SELECT COUNT(*) as c FROM documents WHERE current_service_id = ? AND originating_service_id != ? AND status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'TRASHED')`,
      to_process: `SELECT COUNT(*) as c FROM documents WHERE current_service_id = ? AND status IN ('SOUMIS', 'TRANSMIS', 'EN_COURS_TRAITEMENT', 'REÇU', 'EN_ATTENTE_SIGNATURE')`,
      returned: `SELECT COUNT(*) as c FROM documents WHERE (created_by = ? OR originating_service_id = ?) AND status IN ('RETOUR', 'A_CORRIGER', 'REJETÉ')`,
      validated: `SELECT COUNT(*) as c FROM documents WHERE (originating_service_id = ? OR current_service_id = ?) AND status IN ('VALIDÉ', 'VALIDE')`,
      signed: `SELECT COUNT(*) as c FROM documents WHERE (originating_service_id = ? OR current_service_id = ?) AND status IN ('SIGNÉ', 'SIGNED', 'PRÊT POUR ARCHIVAGE')`,
      archived: `SELECT COUNT(*) as c FROM documents WHERE (originating_service_id = ? OR current_service_id = ?) AND status IN ('ARCHIVED', 'ARCHIVÉ')`
    };

    const [
      cMyDocs, cDrafts, cSubmitted, cTransmitted, cReceived,
      cToProcess, cReturned, cValidated, cSigned, cArchived
    ] = await Promise.all([
      db.get(countQueries.my_docs, [user.id]),
      db.get(countQueries.drafts, [user.id, userSId]),
      db.get(countQueries.submitted, [user.id, userSId]),
      db.get(countQueries.transmitted, [userSId, user.id, userSId]),
      db.get(countQueries.received, [userSId, userSId]),
      db.get(countQueries.to_process, [userSId]),
      db.get(countQueries.returned, [user.id, userSId]),
      db.get(countQueries.validated, [userSId, userSId]),
      db.get(countQueries.signed, [userSId, userSId]),
      db.get(countQueries.archived, [userSId, userSId])
    ]);

    metricCounts.my_docs = cMyDocs ? cMyDocs.c : 0;
    metricCounts.drafts = cDrafts ? cDrafts.c : 0;
    metricCounts.submitted = cSubmitted ? cSubmitted.c : 0;
    metricCounts.transmitted = cTransmitted ? cTransmitted.c : 0;
    metricCounts.received = cReceived ? cReceived.c : 0;
    metricCounts.to_process = cToProcess ? cToProcess.c : 0;
    metricCounts.returned = cReturned ? cReturned.c : 0;
    metricCounts.validated = cValidated ? cValidated.c : 0;
    metricCounts.signed = cSigned ? cSigned.c : 0;
    metricCounts.archived = cArchived ? cArchived.c : 0;
    metricCounts.all = metricCounts.my_docs + metricCounts.received;

    // 2. Build Tab Filter
    let whereClause = `d.status != 'TRASHED'`;
    let queryParams = [];

    if (tab === 'my_docs') {
      whereClause += ` AND d.created_by = ?`;
      queryParams.push(user.id);
    } else if (tab === 'drafts') {
      whereClause += ` AND (d.created_by = ? OR d.originating_service_id = ?) AND d.status = 'BROUILLON'`;
      queryParams.push(user.id, userSId);
    } else if (tab === 'submitted') {
      whereClause += ` AND (d.created_by = ? OR d.originating_service_id = ?) AND d.status = 'SOUMIS'`;
      queryParams.push(user.id, userSId);
    } else if (tab === 'transmitted') {
      whereClause += ` AND (d.originating_service_id = ? OR d.created_by = ?) AND d.status IN ('TRANSMIS', 'EN_COURS_TRAITEMENT') AND d.current_service_id != ?`;
      queryParams.push(userSId, user.id, userSId);
    } else if (tab === 'received') {
      whereClause += ` AND d.current_service_id = ? AND d.originating_service_id != ? AND d.status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'TRASHED')`;
      queryParams.push(userSId, userSId);
    } else if (tab === 'to_process') {
      whereClause += ` AND d.current_service_id = ? AND d.status IN ('SOUMIS', 'TRANSMIS', 'EN_COURS_TRAITEMENT', 'REÇU', 'EN_ATTENTE_SIGNATURE')`;
      queryParams.push(userSId);
    } else if (tab === 'returned') {
      whereClause += ` AND (d.created_by = ? OR d.originating_service_id = ?) AND d.status IN ('RETOUR', 'A_CORRIGER', 'REJETÉ')`;
      queryParams.push(user.id, userSId);
    } else if (tab === 'validated') {
      whereClause += ` AND (d.originating_service_id = ? OR d.current_service_id = ?) AND d.status IN ('VALIDÉ', 'VALIDE')`;
      queryParams.push(userSId, userSId);
    } else if (tab === 'signed') {
      whereClause += ` AND (d.originating_service_id = ? OR d.current_service_id = ?) AND d.status IN ('SIGNÉ', 'SIGNED', 'PRÊT POUR ARCHIVAGE')`;
      queryParams.push(userSId, userSId);
    } else if (tab === 'archived') {
      whereClause += ` AND (d.originating_service_id = ? OR d.current_service_id = ?) AND d.status IN ('ARCHIVED', 'ARCHIVÉ')`;
      queryParams.push(userSId, userSId);
    } else {
      // 'all'
      whereClause += ` AND (d.created_by = ? OR d.originating_service_id = ? OR d.current_service_id = ? OR d.target_service_id = ?)`;
      queryParams.push(user.id, userSId, userSId, userSId);
    }

    const targetCategory = req.query.category || type;
    if (targetCategory && targetCategory !== 'ALL') {
      if (targetCategory === 'LETTRE') {
        whereClause += ` AND d.document_type IN ('LETTRE', 'OUTGOING_MAIL', 'INCOMING_MAIL', 'COURRIER_ENTRANT', 'COURRIER_SORTANT', 'MAIL')`;
      } else if (targetCategory === 'MISSION_ORDER') {
        whereClause += ` AND d.document_type IN ('MISSION_ORDER', 'ORDRE_MISSION', 'MISSION')`;
      } else if (targetCategory === 'NON_CLASSE') {
        whereClause += ` AND (d.document_type IS NULL OR d.document_type = '' OR d.document_type IN ('NON_CLASSE', 'UNCLASSIFIED', 'AUTRE', 'UNKNOWN'))`;
      } else {
        whereClause += ` AND (d.document_type = ? OR d.document_category = ?)`;
        queryParams.push(targetCategory, targetCategory);
      }
    }
    if (priority) {
      whereClause += ` AND d.priority = ?`;
      queryParams.push(priority);
    }
    if (search) {
      whereClause += ` AND (d.reference LIKE ? OR d.title LIKE ? OR d.description LIKE ? OR d.sender_name LIKE ?)`;
      const s = `%${search.trim()}%`;
      queryParams.push(s, s, s, s);
    }

    const query = `
      SELECT DISTINCT d.*,
             orig_s.name as originating_service_name, orig_s.reference_code as originating_service_ref,
             curr_s.name as current_service_name, curr_s.code as current_service_code,
             u.first_name as creator_first, u.last_name as creator_last, u.function_title as creator_function,
             (SELECT COUNT(*) FROM attachments WHERE document_id = d.id) as attachment_count,
             (SELECT COUNT(*) FROM document_versions WHERE document_id = d.id) as versions_count
      FROM documents d
      LEFT JOIN services orig_s ON d.originating_service_id = orig_s.id
      LEFT JOIN services curr_s ON d.current_service_id = curr_s.id
      LEFT JOIN users u ON d.created_by = u.id
      WHERE ${whereClause}
      ORDER BY d.updated_at DESC, d.id DESC
    `;

    const documents = await db.all(query, queryParams);

    // Compute categories_summary for archives tab (Using strict service custom categories)
    let categoriesSummary = [];
    if (tab === 'archived') {
      const customCategories = await db.all(
        `SELECT id, code, name as label, 'CUSTOM' as category, description, icon, color, display_order, is_active, 1 as is_custom 
         FROM archive_custom_categories 
         WHERE service_id = ? AND is_active = 1 
         ORDER BY display_order ASC, name ASC`,
        [userSId]
      );

      let baseCategories = [];
      if (customCategories && customCategories.length > 0) {
        baseCategories = customCategories;
      } else {
        baseCategories = await db.all(
          `SELECT code, label, category, description, icon, display_order, 0 as is_custom, NULL as id 
           FROM document_type_configs 
           WHERE is_active = 1 
           ORDER BY display_order ASC`
        );
      }

      const allArchivedDocs = await db.all(
        `SELECT d.id, d.document_type, d.document_category, d.archive_category, d.custom_category_id 
         FROM documents d 
         WHERE (d.owner_service_id = ? OR d.originating_service_id = ? OR d.current_service_id = ?) 
           AND d.status IN ('ARCHIVED', 'ARCHIVÉ')`,
        [userSId, userSId, userSId]
      );

      const catCounts = {};
      for (const cat of baseCategories) catCounts[cat.code] = 0;
      catCounts['NON_CLASSE'] = 0;

      for (const ad of allArchivedDocs) {
        let matchedCode = null;
        if (ad.custom_category_id) {
          const m = baseCategories.find(c => c.id === Number(ad.custom_category_id));
          if (m) matchedCode = m.code;
        }
        if (!matchedCode) {
          const t = (ad.document_type || ad.document_category || '').toUpperCase().trim();
          const arch = (ad.archive_category || '').toLowerCase().trim();
          const m = baseCategories.find(c => c.code === t || (arch && c.label.toLowerCase() === arch));
          if (m) matchedCode = m.code;
        }
        if (matchedCode && catCounts[matchedCode] !== undefined) {
          catCounts[matchedCode]++;
        } else {
          catCounts['NON_CLASSE']++;
        }
      }

      categoriesSummary = baseCategories.map(cat => ({
        id: cat.id,
        code: cat.code,
        label: cat.label,
        description: cat.description,
        icon: cat.icon || 'Folder',
        color: cat.color,
        is_custom: cat.is_custom === 1,
        display_order: cat.display_order || 100,
        count: catCounts[cat.code] || 0
      }));

      if (catCounts['NON_CLASSE'] > 0 || !categoriesSummary.some(c => c.code === 'NON_CLASSE')) {
        categoriesSummary.push({
          id: null,
          code: 'NON_CLASSE',
          label: 'Non classés',
          description: 'Documents sans catégorie définie',
          icon: 'HelpCircle',
          is_custom: false,
          display_order: 99,
          count: catCounts['NON_CLASSE'] || 0
        });
      }
      categoriesSummary.sort((a, b) => a.display_order - b.display_order);
    }

    res.json({
      metrics: metricCounts,
      categories_summary: categoriesSummary,
      documents
    });
  } catch (err) {
    console.error('Service space error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de l’espace documentaire du service.' });
  }
});

// GET /api/documents/:id/versions - List version revisions for a document (Rule 26)
router.get('/:id/versions', authenticateToken, verifyDocumentAccess, async (req, res) => {
  try {
    const docId = req.params.id;
    const versions = await db.all(
      `SELECT dv.*, u.first_name as author_first, u.last_name as author_last, u.function_title as author_function
       FROM document_versions dv
       LEFT JOIN users u ON dv.created_by = u.id
       WHERE dv.document_id = ?
       ORDER BY dv.version_number DESC`,
      [docId]
    );
    res.json(versions);
  } catch (err) {
    console.error('Fetch document versions error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des versions.' });
  }
});

// PUT /api/documents/:id/draft - Update an existing draft document
router.put('/:id/draft', authenticateToken, verifyDocumentAccess, async (req, res) => {
  const docId = req.params.id;
  const { title, object_title, content_body, description, pieces_jointes, target_service_id, target_recipient_type, target_recipient_name, target_recipient_id, priority, confidentiality } = req.body;
  const user = req.user;

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    if (doc.status !== 'BROUILLON' && doc.status !== 'CREATED') {
      return res.status(400).json({ error: 'Seuls les brouillons peuvent être modifiés directement via cette route.' });
    }

    const docTitle = title || object_title || doc.title;

    await db.run(
      `UPDATE documents 
       SET title = ?, description = ?, content_body = ?, priority = ?, confidentiality = ?,
           target_service_id = ?, target_recipient_type = ?, target_recipient_name = ?, target_recipient_id = ?,
           last_edited_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        docTitle,
        description || content_body || '',
        content_body || description || '',
        priority || doc.priority,
        confidentiality || doc.confidentiality,
        target_service_id || doc.target_service_id,
        target_recipient_type || doc.target_recipient_type,
        target_recipient_name || doc.target_recipient_name,
        target_recipient_id || doc.target_recipient_id,
        user.id,
        docId
      ]
    );

    // Update outgoing mail content if present
    await db.run(
      `UPDATE outgoing_mails SET recipient_name = ?, content_body = ? WHERE document_id = ?`,
      [target_recipient_name || 'Destinataire Administratif', content_body || description || '', docId]
    );

    // Update current version in document_versions
    await db.run(
      `UPDATE document_versions 
       SET title = ?, object_title = ?, content_body = ?, pieces_jointes = ?
       WHERE document_id = ? AND version_number = ?`,
      [docTitle, docTitle, content_body || description || '', pieces_jointes || '', docId, doc.current_version || 1]
    );

    await logAuditAction(user.id, 'UPDATE_DRAFT', 'DOCUMENT', docId, req);

    res.json({ success: true, message: 'Brouillon mis à jour avec succès.' });
  } catch (err) {
    console.error('Update draft error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du brouillon.' });
  }
});

// POST /api/documents/:id/resubmit - Resubmit a returned document with new version (Rule 18, 26)
router.post('/:id/resubmit', authenticateToken, verifyDocumentAccess, upload.array('files'), async (req, res) => {
  const docId = req.params.id;
  const { title, object_title, content_body, pieces_jointes, change_notes } = req.body;
  const user = req.user;

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    if (doc.status !== 'RETOUR' && doc.status !== 'A_CORRIGER' && doc.status !== 'REJETÉ') {
      return res.status(400).json({ error: 'Seuls les documents retournés ou à corriger peuvent être resoumis.' });
    }

    const newVersionNumber = (doc.current_version || 1) + 1;
    const docTitle = title || object_title || doc.title;

    // 1. Determine destination (SG rule if going to central)
    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    const sgServiceId = sgService ? sgService.id : (doc.target_service_id || 1);

    // 2. Update document status and active version
    await db.run(
      `UPDATE documents 
       SET title = ?, description = ?, content_body = ?, current_version = ?,
           status = 'SOUMIS', current_service_id = ?, last_edited_by = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [docTitle, content_body || doc.description, content_body || doc.content_body, newVersionNumber, sgServiceId, user.id, docId]
    );

    // 3. Insert new version record
    await db.run(
      `INSERT INTO document_versions 
       (document_id, version_number, title, object_title, content_body, pieces_jointes, change_notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [docId, newVersionNumber, docTitle, docTitle, content_body || '', pieces_jointes || '', change_notes || 'Resoumission après correction', user.id]
    );

    // 4. Record history & transfer
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'RESUBMIT', ?)`,
      [docId, user.id, user.service_id || 1, `Document corrigé et resoumis en Version ${newVersionNumber}. Notes: ${change_notes || 'Aucune'}`]
    );

    await db.run(
      `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, action, motif, instruction, status)
       VALUES (?, ?, ?, ?, 'TRANSMIT', 'Resoumission après correction', ?, 'PENDING')`,
      [docId, user.service_id || 1, user.id, sgServiceId, `Nouvelle version V${newVersionNumber} transmise pour réexamen`]
    );

    // 5. Add new attachments if uploaded
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.run(
          `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, version, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [docId, file.originalname, file.path, file.size, file.mimetype, newVersionNumber, user.id]
        );
      }
    }

    // 6. Notify SG / destination
    const destUsers = await db.all('SELECT id FROM users WHERE service_id = ? AND status = "ACTIVE"', [sgServiceId]);
    for (const du of destUsers) {
      await db.run(
        `INSERT INTO notifications (user_id, document_id, title, message, type)
         VALUES (?, ?, 'Document corrigé et resoumis', ?, 'ACTION_REQUIRED')`,
        [du.id, docId, `Le document Réf ${doc.reference} a été corrigé (Version ${newVersionNumber}) et resoumis pour orientation / examen.`]
      );
    }

    await logAuditAction(user.id, 'RESUBMIT_DOCUMENT', 'DOCUMENT', docId, req, { version: newVersionNumber, notes: change_notes });

    res.json({
      success: true,
      message: `Document corrigé avec succès et resoumis en Version ${newVersionNumber}.`,
      version: newVersionNumber
    });
  } catch (err) {
    console.error('Resubmit document error:', err);
    res.status(500).json({ error: 'Erreur lors de la resoumission du document.' });
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

        // Audit log secure file access
        await logAuditAction(req.user.id, disposition === 'attachment' ? 'DOWNLOAD_FILE' : 'VIEW_FILE', 'DOCUMENT', docId, req, {
          reference: doc.reference,
          fileName: targetFileName,
          owner_service_id: doc.owner_service_id,
          archive_scope: doc.archive_scope
        });

        return res.sendFile(fullPath);
      }
    }

    return res.status(404).json({ error: 'Fichier original ou PDF non disponible pour ce document.' });
  } catch (err) {
    console.error('View document error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement du document.' });
  }
});

// GET /api/documents/archives - Retrieve Hierarchical & Isolated Archives with Dynamic Categories (Deny by Default)
router.get('/archives', authenticateToken, async (req, res) => {
  const user = req.user;
  const isAdmin = user.role_code === 'ADMINISTRATEUR';
  const isSC = user.role_code === 'AGENT_SC' || user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user.service_code === 'SC';
  const { scope, year, type, category, search, service_id, serviceId } = req.query;
  const rawServiceId = service_id || serviceId;
  const targetServiceId = rawServiceId 
    ? Number(rawServiceId) 
    : (isAdmin ? null : (Number(user.service_id) || 1));

  try {
    const { sql: abacSql } = buildABACDocumentFilter(user);

    // 1. Fetch configured standard document categories
    let configuredCategories = await db.all(
      `SELECT code, label, category, description, icon, display_order, is_active, 0 as is_custom, NULL as id 
       FROM document_type_configs 
       WHERE is_active = 1 
       ORDER BY display_order ASC, label ASC`
    );

    // 1b. Fetch custom categories for the target service if specified, or user's service
    const serviceForCats = targetServiceId || (Number(user.service_id) || 5);
    const customCategories = await db.all(
      `SELECT id, code, name as label, 'CUSTOM' as category, description, icon, color, display_order, is_active, 1 as is_custom 
       FROM archive_custom_categories 
       WHERE service_id = ? AND is_active = 1 
       ORDER BY display_order ASC, name ASC`,
      [serviceForCats]
    );

    // Strict Service Categories vs Institutional Categories
    let mergedCategories = [];
    if (scope === 'INSTITUTIONNEL' || scope === 'CENTRAL' || (!rawServiceId && isAdmin)) {
      mergedCategories = configuredCategories || [];
    } else if (customCategories && customCategories.length > 0) {
      mergedCategories = customCategories;
    } else {
      mergedCategories = configuredCategories || [];
    }

    // 2. Query all accessible archived documents for the user / service
    let baseQuery = `
      SELECT DISTINCT d.*, 
             s.name as current_service_name, s.code as current_service_code,
             os.name as originating_service_name, os.code as originating_service_code,
             ows.name as owner_service_name, ows.code as owner_service_code,
             cb.first_name as creator_first, cb.last_name as creator_last,
             ab.first_name as archiver_first, ab.last_name as archiver_last,
             tb.first_name as transmitter_first, tb.last_name as transmitter_last,
             cab.first_name as central_archiver_first, cab.last_name as central_archiver_last
      FROM documents d
      LEFT JOIN services s ON d.current_service_id = s.id
      LEFT JOIN services os ON d.originating_service_id = os.id
      LEFT JOIN services ows ON d.owner_service_id = ows.id
      LEFT JOIN users cb ON d.created_by = cb.id
      LEFT JOIN users ab ON d.archived_by = ab.id
      LEFT JOIN users tb ON d.transmitted_to_sc_by = tb.id
      LEFT JOIN users cab ON d.central_archived_by = cab.id
      WHERE (${abacSql})
        AND d.status IN ('ARCHIVED', 'ARCHIVÉ')
    `;

    const baseParams = [];

    // Filter strictly by target service when specified or when non-admin (unless querying global central scope)
    if (targetServiceId) {
      baseQuery += ` AND (d.owner_service_id = ? OR (d.owner_service_id IS NULL AND (d.originating_service_id = ? OR d.current_service_id = ?)))`;
      baseParams.push(targetServiceId, targetServiceId, targetServiceId);
    }

    // Scope filter
    if (scope && scope !== 'ALL') {
      if (scope === 'TRANSMITTED_SC') {
        baseQuery += ` AND (d.transmitted_to_sc_for_archive = 1 OR d.is_central_archived = 1)`;
      } else if (scope === 'PARTAGE') {
        baseQuery += ` AND EXISTS (SELECT 1 FROM archive_shares ash WHERE ash.document_id = d.id AND ash.target_service_id = ?)`;
        baseParams.push(user.service_id);
      } else {
        baseQuery += ` AND d.archive_scope = ?`;
        baseParams.push(scope);
      }
    }

    // Year filter
    if (year) {
      baseQuery += ` AND (strftime('%Y', d.created_at) = ? OR strftime('%Y', d.archived_at) = ?)`;
      baseParams.push(year.toString(), year.toString());
    }

    baseQuery += ` ORDER BY COALESCE(d.archived_at, d.created_at) DESC`;

    let allAccessibleDocs = await db.all(baseQuery, baseParams);

    // 2b. Query archived external missionaries if user is SC, Admin, SG, or Host Service
    const canAccessExtMiss = isAdmin || isSC || user.role_code === 'SECRÉTAIRE_GÉNÉRAL' || (targetServiceId && Number(targetServiceId) === Number(user.service_id));
    if (canAccessExtMiss && (scope === 'ALL' || scope === 'CENTRAL' || scope === 'INSTITUTIONNEL' || !scope)) {
      let extWhere = `m.status IN ('ARCHIVED', 'ARCHIVÉ')`;
      let extParams = [];
      if (targetServiceId && !isAdmin && !isSC) {
        extWhere += ` AND m.host_service_id = ?`;
        extParams.push(targetServiceId);
      }
      if (year) {
        extWhere += ` AND (strftime('%Y', m.created_at) = ? OR strftime('%Y', m.archived_at) = ?)`;
        extParams.push(year.toString(), year.toString());
      }

      const rawExtMiss = await db.all(
        `SELECT m.id, m.reference, m.last_name, m.first_names, m.origin_institution, m.object_of_mission,
                m.location_of_mission, m.function_title, m.status, m.host_service_id, m.current_service_id,
                m.created_at, m.updated_at, m.archived_at, m.archived_by_user_id,
                m.original_document_path, m.arrival_document_path, m.final_document_path, m.signed_document_path,
                s.name as host_service_name, s.code as host_service_code,
                ab.first_name as archiver_first, ab.last_name as archiver_last
         FROM external_missionaries m
         LEFT JOIN services s ON m.host_service_id = s.id
         LEFT JOIN users ab ON m.archived_by_user_id = ab.id
         WHERE ${extWhere}
         ORDER BY COALESCE(m.archived_at, m.updated_at, m.created_at) DESC`,
        extParams
      );

      const extMissDocs = (rawExtMiss || []).map(m => ({
        id: `ext_${m.id}`,
        raw_id: m.id,
        reference: m.reference,
        title: `Ordre de mission externe — ${m.first_names} ${m.last_name} (${m.object_of_mission})`,
        document_type: 'ORDRE_MISSION_EXTERNE',
        document_category: 'ORDRE_MISSION_EXTERNE',
        archive_category: 'Ordres de mission externe',
        status: 'ARCHIVÉ',
        priority: 'NORMAL',
        created_at: m.created_at,
        updated_at: m.updated_at,
        archived_at: m.archived_at || m.updated_at,
        sender_name: `${m.first_names} ${m.last_name}`,
        sender_organization: m.origin_institution,
        owner_service_id: m.host_service_id || 5,
        owner_service_name: m.host_service_name || 'Secrétariat Central',
        originating_service_name: m.origin_institution,
        archiver_first: m.archiver_first || 'Secrétariat',
        archiver_last: m.archiver_last || 'Central',
        is_central_archived: 1,
        archive_scope: 'CENTRAL',
        file_path: m.signed_document_path || m.final_document_path || m.original_document_path || m.arrival_document_path,
        source_table: 'external_missionaries'
      }));

      allAccessibleDocs = [...allAccessibleDocs, ...extMissDocs];
    }

    // Ensure category ORDRE_MISSION_EXTERNE exists in mergedCategories
    if (!mergedCategories.some(c => c.code === 'ORDRE_MISSION_EXTERNE' || c.code === 'ORDRES_DE_MISSION_EXTERNE' || (c.label && c.label.toLowerCase().includes('mission externe')))) {
      mergedCategories.push({
        code: 'ORDRE_MISSION_EXTERNE',
        label: 'Ordres de mission externe',
        category: 'OFFICIAL',
        description: 'Ordres de mission des missionnaires externes à Kindia',
        icon: 'Globe',
        display_order: 15,
        is_active: 1,
        is_custom: 0,
        id: null
      });
    }

    // 3. Helper to determine category of a document within mergedCategories
    const getDocCategoryCode = (d) => {
      // 1. Direct custom_category_id match
      if (d.custom_category_id) {
        const matchedCust = mergedCategories.find(c => c.id && Number(c.id) === Number(d.custom_category_id));
        if (matchedCust) return matchedCust.code;
      }

      const t = (d.document_type || d.document_category || '').toUpperCase().trim();
      const archCat = (d.archive_category || '').trim().toLowerCase();
      const docTitle = (d.title || '').trim().toLowerCase();

      // 2. Direct exact code or label match in mergedCategories
      const exactCode = mergedCategories.find(c => c.code && c.code.toUpperCase() === t);
      if (exactCode) return exactCode.code;

      if (archCat) {
        const exactLabel = mergedCategories.find(c => c.label && c.label.toLowerCase() === archCat);
        if (exactLabel) return exactLabel.code;
        const exactCodeFromArchCat = mergedCategories.find(c => c.code && c.code.toLowerCase() === archCat);
        if (exactCodeFromArchCat) return exactCodeFromArchCat.code;
      }

      // External mission order match
      if (t === 'ORDRE_MISSION_EXTERNE' || t === 'ORDRES_DE_MISSION_EXTERNE' || t === 'EXTERNAL_MISSION_ORDER' || archCat.includes('mission externe') || docTitle.includes('mission externe')) {
        const matched = mergedCategories.find(c => c.code === 'ORDRE_MISSION_EXTERNE' || c.code === 'ORDRES_DE_MISSION_EXTERNE' || (c.label && c.label.toLowerCase().includes('mission externe')));
        if (matched) return matched.code;
      }

      // 3. Robust Semantic Match into mergedCategories
      if (['MISSION_ORDER', 'ORDRE_MISSION', 'ORDRE_DE_MISSION', 'MISSION'].includes(t) || docTitle.includes('ordre de mission') || archCat.includes('mission')) {
        const matched = mergedCategories.find(c => c.code === 'MISSION_ORDER' || c.code === 'ORDRE_DE_MISSION' || c.code.includes('MISSION') || (c.label && c.label.toLowerCase().includes('mission')));
        if (matched) return matched.code;
      }

      if (['COURRIER_ENTRANT', 'INCOMING_MAIL', 'ARRIVE', 'ARRIVÉ'].includes(t) || archCat.includes('arriv') || docTitle.includes('courrier entrant') || docTitle.includes('arrivée')) {
        const matched = mergedCategories.find(c => c.code === 'INCOMING_MAIL' || c.code === 'COURRIER_ENTRANT' || c.code === 'ARRIVE' || c.code.includes('ARRIV') || (c.label && (c.label.toLowerCase().includes('arriv') || c.label.toLowerCase().includes('entrant'))));
        if (matched) return matched.code;
      }

      if (['COURRIER_SORTANT', 'OUTGOING_MAIL', 'DEPART', 'DÉPART'].includes(t) || archCat.includes('départ') || archCat.includes('depart') || docTitle.includes('courrier sortant') || docTitle.includes('départ')) {
        const matched = mergedCategories.find(c => c.code === 'OUTGOING_MAIL' || c.code === 'COURRIER_SORTANT' || c.code === 'DEPART' || c.code.includes('DEPART') || (c.label && (c.label.toLowerCase().includes('départ') || c.label.toLowerCase().includes('depart') || c.label.toLowerCase().includes('sortant'))));
        if (matched) return matched.code;
      }

      if (['DECISION', 'DÉCISION'].includes(t) || archCat.includes('décision') || archCat.includes('decision') || docTitle.includes('décision') || docTitle.includes('decision')) {
        const matched = mergedCategories.find(c => c.code === 'DECISION' || c.code.includes('DECISION') || (c.label && (c.label.toLowerCase().includes('décision') || c.label.toLowerCase().includes('decision'))));
        if (matched) return matched.code;
      }

      if (['ARRETE', 'ARRÊTÉ'].includes(t) || archCat.includes('arrêté') || archCat.includes('arrete') || docTitle.includes('arrêté') || docTitle.includes('arrete')) {
        const matched = mergedCategories.find(c => c.code === 'ARRETE' || c.code.includes('ARRETE') || (c.label && (c.label.toLowerCase().includes('arrêté') || c.label.toLowerCase().includes('arrete'))));
        if (matched) return matched.code;
      }

      if (['DECRET', 'DÉCRET'].includes(t) || archCat.includes('décret') || archCat.includes('decret') || docTitle.includes('décret') || docTitle.includes('decret')) {
        const matched = mergedCategories.find(c => c.code === 'DECRET' || c.code.includes('DECRET') || (c.label && (c.label.toLowerCase().includes('décret') || c.label.toLowerCase().includes('decret'))));
        if (matched) return matched.code;
      }

      if (['CIRCULAIRE'].includes(t) || archCat.includes('circulaire') || docTitle.includes('circulaire')) {
        const matched = mergedCategories.find(c => c.code === 'CIRCULAIRE' || c.code.includes('CIRCULAIRE') || (c.label && c.label.toLowerCase().includes('circulaire')));
        if (matched) return matched.code;
      }

      if (['NOTE_SERVICE', 'NOTE_DE_SERVICE', 'NOTE'].includes(t) || archCat.includes('note') || docTitle.includes('note de service')) {
        const matched = mergedCategories.find(c => c.code === 'NOTE_SERVICE' || c.code === 'NOTE_DE_SERVICE' || c.code.includes('NOTE') || (c.label && c.label.toLowerCase().includes('note')));
        if (matched) return matched.code;
      }

      if (['SOIT_TRANSMIS', 'SOIT-TRANSMIS', 'SOITTRANSMIS'].includes(t) || archCat.includes('transmis') || docTitle.includes('soit-transmis')) {
        const matched = mergedCategories.find(c => c.code === 'SOIT_TRANSMIS' || c.code.includes('TRANSMIS') || (c.label && c.label.toLowerCase().includes('transmis')));
        if (matched) return matched.code;
      }

      if (['DEMANDE'].includes(t) || archCat.includes('demande') || docTitle.includes('demande')) {
        const matched = mergedCategories.find(c => c.code === 'DEMANDE' || (c.label && c.label.toLowerCase().includes('demande')));
        if (matched) return matched.code;
      }

      if (['RAPPORT'].includes(t) || archCat.includes('rapport') || docTitle.includes('rapport')) {
        const matched = mergedCategories.find(c => c.code === 'RAPPORT' || (c.label && c.label.toLowerCase().includes('rapport')));
        if (matched) return matched.code;
      }

      if (['PROCES_VERBAL', 'PV'].includes(t) || archCat.includes('procès') || archCat.includes('proces') || docTitle.includes('procès-verbal')) {
        const matched = mergedCategories.find(c => c.code === 'PROCES_VERBAL' || c.code.includes('PV') || (c.label && (c.label.toLowerCase().includes('procès-verbal') || c.label.toLowerCase().includes('proces-verbal'))));
        if (matched) return matched.code;
      }

      if (['ATTESTATION'].includes(t) || archCat.includes('attestation') || docTitle.includes('attestation')) {
        const matched = mergedCategories.find(c => c.code === 'ATTESTATION' || (c.label && c.label.toLowerCase().includes('attestation')));
        if (matched) return matched.code;
      }

      if (['CONVOCATION'].includes(t) || archCat.includes('convocation') || docTitle.includes('convocation')) {
        const matched = mergedCategories.find(c => c.code === 'CONVOCATION' || (c.label && c.label.toLowerCase().includes('convocation')));
        if (matched) return matched.code;
      }

      if (['INVITATION'].includes(t) || archCat.includes('invitation') || docTitle.includes('invitation')) {
        const matched = mergedCategories.find(c => c.code === 'INVITATION' || (c.label && c.label.toLowerCase().includes('invitation')));
        if (matched) return matched.code;
      }

      // Check fallback match in configured standard categories if not found in custom
      const matchedFallback = configuredCategories.find(c => c.code === t || (archCat && c.label.toLowerCase() === archCat));
      if (matchedFallback && mergedCategories.some(c => c.code === matchedFallback.code)) {
        return matchedFallback.code;
      }

      return 'NON_CLASSE';
    };

    // 4. Compute Dynamic Category Summary with exact counters
    const categoryCounts = {};
    for (const cat of mergedCategories) {
      categoryCounts[cat.code] = 0;
    }
    categoryCounts['NON_CLASSE'] = 0;

    for (const d of allAccessibleDocs) {
      const catCode = getDocCategoryCode(d);
      d.category_code = catCode;
      if (categoryCounts[catCode] !== undefined) {
        categoryCounts[catCode]++;
      } else {
        d.category_code = 'NON_CLASSE';
        categoryCounts['NON_CLASSE']++;
      }
    }

    const categoriesSummary = mergedCategories.map(cat => ({
      id: cat.id,
      code: cat.code,
      label: cat.label,
      description: cat.description,
      icon: cat.icon || 'Folder',
      color: cat.color,
      is_custom: cat.is_custom === 1,
      display_order: cat.display_order || 100,
      count: categoryCounts[cat.code] || 0
    }));

    // Add 'NON_CLASSE' to categoriesSummary if not already in configured list
    if (!categoriesSummary.some(c => c.code === 'NON_CLASSE')) {
      categoriesSummary.push({
        id: null,
        code: 'NON_CLASSE',
        label: 'Non classés',
        description: 'Documents sans catégorie définie',
        icon: 'HelpCircle',
        is_custom: false,
        display_order: 99,
        count: categoryCounts['NON_CLASSE'] || 0
      });
    }

    // Sort categoriesSummary by display_order
    categoriesSummary.sort((a, b) => a.display_order - b.display_order);

    // 5. Filter documents by selected category and search term if provided
    let filteredDocs = allAccessibleDocs;

    const targetCategory = category || type;
    if (targetCategory && targetCategory !== 'ALL') {
      const targetCatObj = mergedCategories.find(c => 
        c.code === targetCategory || 
        String(c.id) === targetCategory || 
        (c.label && c.label.toLowerCase() === targetCategory.toLowerCase())
      );
      const targetCode = targetCatObj ? targetCatObj.code : targetCategory;

      filteredDocs = filteredDocs.filter(d => {
        if (targetCatObj && targetCatObj.id && Number(d.custom_category_id) === Number(targetCatObj.id)) {
          return true;
        }
        if (d.category_code === targetCode) {
          return true;
        }
        return getDocCategoryCode(d) === targetCode;
      });
    }

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      filteredDocs = filteredDocs.filter(d => 
        (d.reference && d.reference.toLowerCase().includes(s)) ||
        (d.title && d.title.toLowerCase().includes(s)) ||
        (d.description && d.description.toLowerCase().includes(s)) ||
        (d.sender_name && d.sender_name.toLowerCase().includes(s)) ||
        (d.creator_first && d.creator_first.toLowerCase().includes(s)) ||
        (d.creator_last && d.creator_last.toLowerCase().includes(s)) ||
        (d.owner_service_name && d.owner_service_name.toLowerCase().includes(s)) ||
        (d.originating_service_name && d.originating_service_name.toLowerCase().includes(s)) ||
        (d.ocr_text && d.ocr_text.toLowerCase().includes(s)) ||
        (d.keywords && d.keywords.toLowerCase().includes(s)) ||
        (d.author_name && d.author_name.toLowerCase().includes(s)) ||
        (d.signatory_name && d.signatory_name.toLowerCase().includes(s))
      );
    }

    // Live counts by scope for tabs
    const metrics = {
      all: allAccessibleDocs.length,
      private: allAccessibleDocs.filter(d => d.archive_scope === 'PRIVE_SERVICE').length,
      faculty: allAccessibleDocs.filter(d => d.archive_scope === 'FACULTE').length,
      central: allAccessibleDocs.filter(d => d.archive_scope === 'CENTRAL' || d.is_central_archived === 1).length,
      institutional: allAccessibleDocs.filter(d => d.archive_scope === 'INSTITUTIONNEL').length,
      transmitted_sc: allAccessibleDocs.filter(d => d.transmitted_to_sc_for_archive === 1).length
    };

    res.json({ 
      service_id: targetServiceId,
      categories_summary: categoriesSummary, 
      documents: filteredDocs, 
      metrics 
    });
  } catch (err) {
    console.error('Error fetching archives:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des archives.' });
  }
});

// PUT /api/documents/:id/classify - Assign or update document category / type
router.put('/:id/classify', authenticateToken, verifyDocumentAccess, async (req, res) => {
  const docId = req.params.id;
  const { document_type, custom_category_id, document_category, archive_category } = req.body;
  const user = req.user;

  try {
    const doc = req.document || await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    let label = document_type;
    let customCatId = custom_category_id ? Number(custom_category_id) : null;
    let finalDocType = document_type || doc.document_type || 'AUTRE';

    if (customCatId) {
      const customCat = await db.get('SELECT * FROM archive_custom_categories WHERE id = ?', [customCatId]);
      if (customCat) {
        label = customCat.name;
        finalDocType = customCat.code;
      }
    } else if (document_type) {
      const typeConfig = await db.get('SELECT label FROM document_type_configs WHERE code = ?', [document_type]);
      if (typeConfig) label = typeConfig.label;
    }

    await db.run(
      `UPDATE documents 
       SET custom_category_id = ?,
           document_type = ?, 
           archive_category = ?,
           document_category = ?, 
           last_edited_by = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [customCatId, finalDocType, archive_category || label, document_category || 'OFFICIAL', user.id, docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'CLASSIFY_DOCUMENT', ?)`,
      [docId, user.id, user.service_id || 1, `Document classé dans la catégorie [${label}]`]
    );

    await logAuditAction(user.id, 'CLASSIFY_DOCUMENT', 'DOCUMENT', docId, req, {
      reference: doc.reference,
      old_type: doc.document_type,
      new_type: finalDocType,
      custom_category_id: customCatId
    });

    res.json({ success: true, message: `Document classé avec succès dans la catégorie [${label}].` });
  } catch (err) {
    console.error('Classify document error:', err);
    res.status(500).json({ error: 'Erreur lors de la classification du document.' });
  }
});

// POST /api/documents/service-archive - Direct Scan & Import Archiving for Service (Rules 1 to 15)
router.post('/service-archive', authenticateToken, upload.array('files'), async (req, res) => {
  const user = req.user;
  const {
    title,
    object_title,
    document_type,
    custom_category_id,
    archive_category,
    reference: customReference,
    document_date,
    author_name,
    signatory_name,
    target_recipient_name,
    description,
    keywords,
    confidentiality = 'INTERNAL',
    priority = 'NORMAL',
    ocr_text,
    is_scanned
  } = req.body;

  const docTitle = title || object_title || (is_scanned ? 'Document Numérisé' : 'Document Importé');
  if (!docTitle) {
    return res.status(400).json({ error: 'Le titre ou l’objet du document est obligatoire.' });
  }

  try {
    const userSvcId = user.service_id || 1;
    const service = await db.get('SELECT * FROM services WHERE id = ?', [userSvcId]);

    // Category resolution
    let finalDocType = document_type || 'AUTRE';
    let finalCatLabel = archive_category || 'Soit-transmis';
    let customCatId = custom_category_id ? Number(custom_category_id) : null;

    if (customCatId) {
      const customCat = await db.get('SELECT * FROM archive_custom_categories WHERE id = ?', [customCatId]);
      if (customCat) {
        finalCatLabel = customCat.name;
        finalDocType = customCat.code || customCat.name;
      }
    } else if (document_type) {
      const typeConfig = await db.get('SELECT label FROM document_type_configs WHERE code = ?', [document_type]);
      if (typeConfig) finalCatLabel = typeConfig.label;
    }

    // Generate or preserve reference
    let reference = customReference && customReference.trim();
    let referenceMeta = null;
    let sequenceNumber = null;

    if (!reference) {
      const gen = await generateReferenceWithMeta(finalDocType, { serviceId: userSvcId });
      reference = gen.reference;
      referenceMeta = gen.reference_meta;
      sequenceNumber = gen.sequence_number;
    }

    const trackingToken = require('crypto').randomBytes(16).toString('hex');
    const nowIso = new Date().toISOString();

    // Primary attachment file if provided
    let mainFilePath = null;
    if (req.files && req.files.length > 0) {
      mainFilePath = req.files[0].path;
    }

    // Insert into documents table
    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, document_category, title, description, content_body,
        sender_name, sender_organization, priority, confidentiality, status, current_service_id, current_user_id,
        created_by, originating_service_id, originating_head_name, originating_head_function, service_sequence_number,
        target_recipient_name, reference_meta, document_date, file_path, archived_at, archived_by,
        owner_service_id, archive_scope, archive_category, custom_category_id, ocr_text, keywords, author_name, signatory_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ARCHIVED', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PRIVE_SERVICE', ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        trackingToken,
        finalDocType,
        'OFFICIAL',
        docTitle,
        description || '',
        ocr_text || description || '',
        author_name || (service ? service.name : `${user.first_name} ${user.last_name}`),
        service ? service.name : 'Université de Kindia',
        priority,
        confidentiality,
        userSvcId,
        user.id,
        userSvcId,
        service?.head_first_name ? `${service.head_first_name} ${service.head_last_name}` : null,
        service?.function_title || 'Responsable de Service',
        sequenceNumber,
        target_recipient_name || '',
        referenceMeta,
        document_date || nowIso.split('T')[0],
        mainFilePath,
        nowIso,
        user.id,
        userSvcId,
        finalCatLabel,
        customCatId,
        ocr_text || '',
        keywords || '',
        author_name || `${user.first_name} ${user.last_name}`,
        signatory_name || ''
      ]
    );

    const docId = docRes.lastID;

    // Attach all files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.run(
          `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [docId, file.originalname, file.path, file.size, file.mimetype, user.id]
        );
      }
    }

    // Document History
    const actionLabel = is_scanned ? 'NUMERISATION_ARCHIVE' : 'IMPORT_ARCHIVE';
    const actionDesc = is_scanned
      ? `Document numérisé et classé définitivement dans la catégorie [${finalCatLabel}]. Référence : ${reference}`
      : `Document importé et classé définitivement dans la catégorie [${finalCatLabel}]. Référence : ${reference}`;

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, ?, ?)`,
      [docId, user.id, userSvcId, actionLabel, actionDesc]
    );

    await logAuditAction(user.id, actionLabel, 'DOCUMENT', docId, req, {
      reference,
      category: finalCatLabel,
      custom_category_id: customCatId,
      status: 'ARCHIVED',
      is_scanned: Boolean(is_scanned)
    });

    const savedDoc = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    res.status(201).json({
      success: true,
      message: `Document archivé avec succès dans [${finalCatLabel}].`,
      document: savedDoc,
      id: docId,
      reference
    });
  } catch (err) {
    console.error('Service archive error:', err);
    res.status(500).json({ error: 'Erreur lors de l’archivage du document de service : ' + err.message });
  }
});

// POST /api/documents/:id/diffuse - Transmit / Diffuse document to target services/users without removing from origin archive (Rules 5, 6, 7)
router.post('/:id/diffuse', authenticateToken, verifyDocumentAccess, async (req, res) => {
  const docId = req.params.id;
  const user = req.user;
  const {
    target_service_ids = [],
    target_user_ids = [],
    subject,
    message,
    priority = 'NORMAL',
    deadline,
    dispatch_type = 'SIMPLE'
  } = req.body;

  try {
    const doc = req.document || await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    const originatingServiceId = user.service_id || doc.owner_service_id || doc.current_service_id || 1;
    const originService = await db.get('SELECT * FROM services WHERE id = ?', [originatingServiceId]);

    const dispatchTitle = subject || `Diffusion de document : ${doc.reference} - ${doc.title}`;
    const dispatchRef = `DIF-UK-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    // Create document_dispatches
    const dispRes = await db.run(
      `INSERT INTO document_dispatches 
       (document_id, reference, dispatch_type, title, message, deadline, sender_user_id, sender_service_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EN_COURS')`,
      [
        docId,
        dispatchRef,
        dispatch_type,
        dispatchTitle,
        message || '',
        deadline || null,
        user.id,
        originatingServiceId
      ]
    );

    const dispatchId = dispRes.lastID;
    let recipientCount = 0;
    const recipientNames = [];

    // Target Services
    for (const svcId of target_service_ids) {
      const targetSvc = await db.get('SELECT * FROM services WHERE id = ?', [svcId]);
      if (targetSvc) {
        recipientNames.push(targetSvc.name);
        await db.run(
          `INSERT INTO dispatch_recipients (dispatch_id, document_id, service_id, user_id, status)
           VALUES (?, ?, ?, NULL, 'NON_CONSULTE')`,
          [dispatchId, docId, svcId]
        );
        recipientCount++;

        // Also record in document_transfers for direct visibility in transfers / incoming
        await db.run(
          `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, to_user_id, action, instruction, status)
           VALUES (?, ?, ?, ?, NULL, 'DIFFUSION', ?, 'PENDING')`,
          [docId, originatingServiceId, user.id, svcId, message || `Document diffusé par ${originService?.name || 'Service'}`]
        );

        // Share access to document
        await db.run(
          `INSERT OR IGNORE INTO archive_shares (document_id, target_service_id, shared_by, motive, can_download)
           VALUES (?, ?, ?, ?, 1)`,
          [docId, svcId, user.id, message || 'Diffusion officielle']
        );
      }
    }

    // Target Users
    for (const uId of target_user_ids) {
      const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [uId]);
      if (targetUser) {
        recipientNames.push(`${targetUser.first_name} ${targetUser.last_name}`);
        await db.run(
          `INSERT INTO dispatch_recipients (dispatch_id, document_id, service_id, user_id, status)
           VALUES (?, ?, ?, ?, 'NON_CONSULTE')`,
          [dispatchId, docId, targetUser.service_id, uId]
        );
        recipientCount++;

        await db.run(
          `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, to_user_id, action, instruction, status)
           VALUES (?, ?, ?, ?, ?, 'DIFFUSION', ?, 'PENDING')`,
          [docId, originatingServiceId, user.id, targetUser.service_id, uId, message || `Document diffusé par ${originService?.name || 'Service'}`]
        );
      }
    }

    // Update dispatch total_recipients
    await db.run('UPDATE document_dispatches SET total_recipients = ? WHERE id = ?', [recipientCount, dispatchId]);

    // Traceability in document_history (Rule 7)
    const historyDetail = `Document diffusé à [${recipientNames.join(', ')}]. Réf diffusion : ${dispatchRef}. Objet : ${dispatchTitle}`;
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'DIFFUSE_DOCUMENT', ?)`,
      [docId, user.id, originatingServiceId, historyDetail]
    );

    await logAuditAction(user.id, 'DIFFUSE_DOCUMENT', 'DOCUMENT', docId, req, {
      reference: doc.reference,
      dispatch_reference: dispatchRef,
      recipients: recipientNames,
      recipient_count: recipientCount
    });

    res.json({
      success: true,
      message: `Document diffusé avec succès vers ${recipientCount} destinataire(s). Il reste conservé dans votre archive de service.`,
      dispatch_id: dispatchId,
      dispatch_reference: dispatchRef,
      recipients: recipientNames
    });
  } catch (err) {
    console.error('Diffuse document error:', err);
    res.status(500).json({ error: 'Erreur lors de la diffusion du document : ' + err.message });
  }
});

// GET /api/documents/:id - Single Document Detail
router.get('/:id', authenticateToken, verifyDocumentAccess, async (req, res) => {
  try {
    const doc = req.document;

    // Fetch service & user metadata
    const currentService = await db.get('SELECT name, code FROM services WHERE id = ?', [doc.current_service_id]);
    const originatingService = doc.originating_service_id ? await db.get('SELECT name, code, reference_code, header_text FROM services WHERE id = ?', [doc.originating_service_id]) : null;
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
      originating_service_name: originatingService ? originatingService.name : (doc.sender_organization || ''),
      originating_service_code: originatingService ? (originatingService.reference_code || originatingService.code) : '',
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
    processing_mode, official_type, document_date, has_external_signature, external_signatory_name, external_signature_date,
    custom_category_id, archive_category
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
      // Normal incoming mail received at Secrétariat Central transmitted to Secrétaire Général for analysis & orientation
      const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
      targetServiceId = sgService ? sgService.id : scService.id;
      docStatus = 'IN_PROGRESS';
    }

    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, title, description, sender_name, sender_organization, priority, confidentiality, status, current_service_id, current_user_id, created_by, deadline_date, processing_mode, document_date, has_external_signature, external_signatory_name, external_signature_date, reference_meta, custom_category_id, archive_category, owner_service_id, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference, trackingToken, docType, title, description || '', sender_name, sender_organization || '', 
        priority || 'NORMAL', confidentiality || 'INTERNAL', docStatus, targetServiceId, user.id, deadline_date || null,
        isDirectArchive ? 'DIRECT_ARCHIVE' : 'NORMAL',
        document_date || null,
        has_external_signature ? 1 : 0,
        external_signatory_name || null,
        external_signature_date || null,
        reference_meta,
        custom_category_id || null,
        archive_category || null,
        user.service_id || targetServiceId,
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
        [docId, user.id, user.service_id, `Courrier entrant enregistré au Secrétariat Central avec référence : ${reference}.`]
      );

      await db.run(
        `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, to_user_id, action, instruction, status)
         VALUES (?, ?, ?, ?, NULL, 'TRANSMIT', ?, 'PENDING')`,
        [docId, user.service_id, user.id, targetServiceId, instruction || 'Transmis au Secrétaire Général pour analyse et orientation']
      );

      await db.run(
        `INSERT INTO document_history (document_id, user_id, service_id, action, details)
         VALUES (?, ?, ?, 'TRANSMIT', ?)`,
        [docId, user.id, user.service_id, `Transmis au Secrétaire Général pour analyse et orientation`]
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

// POST /api/documents/administrative - Create administrative document with service reference, head snapshot, and hierarchy routing (Rule 1, 6, 7, 8, 9, 26)
router.post('/administrative', authenticateToken, upload.any(), async (req, res) => {
  const {
    document_type,
    document_category,
    template_id,
    title,
    description,
    object_title,
    content_body,
    pieces_jointes,
    priority,
    confidentiality,
    target_recipient_type,
    target_recipient_name,
    target_service_id,
    target_recipient_id,
    custom_values,
    action = 'SUBMIT' // 'DRAFT' or 'SUBMIT'
  } = req.body;

  const user = req.user;
  const docType = document_type || document_category || 'SOIT_TRANSMIS';
  const docCategory = document_category || document_type || 'SOIT_TRANSMIS';
  const docTitle = title || object_title || `Document Administratif [${docType}]`;

  if (!docTitle) {
    return res.status(400).json({ error: 'Le titre ou l’objet du document est obligatoire.' });
  }

  // Parse custom values if string
  let parsedCustomValues = {};
  if (typeof custom_values === 'string') {
    try { parsedCustomValues = JSON.parse(custom_values); } catch (e) { parsedCustomValues = {}; }
  } else if (typeof custom_values === 'object' && custom_values !== null) {
    parsedCustomValues = custom_values;
  }

  try {
    // 0. STRICT PERMISSION CHECK BY DOCUMENT TYPE (Niveau 1, 2, 3)
    const isTypeAllowed = await documentTypeService.canUserCreateDocumentType(user, docType);
    if (!isTypeAllowed) {
      return res.status(403).json({
        error: `ACCÈS STRICTEMENT REFUSÉ : Votre service et rôle ne sont pas autorisés à créer des documents de type '${docType}'. Seul le Secrétariat Central ou l'Administrateur peut créer ce type, sauf permission explicite accordée.`
      });
    }

    // 1. Identify originating service & active head snapshot
    const originatingServiceId = user.service_id;
    let originatingService = null;
    let headSnapshotName = null;
    let headSnapshotFunction = null;

    if (originatingServiceId) {
      originatingService = await db.get(
        `SELECT s.*, u.first_name as head_first_name, u.last_name as head_last_name, u.function_title as head_user_function
         FROM services s
         LEFT JOIN users u ON s.head_user_id = u.id
         WHERE s.id = ?`,
        [originatingServiceId]
      );

      if (originatingService) {
        headSnapshotName = originatingService.head_first_name ? `${originatingService.head_first_name} ${originatingService.head_last_name}` : null;
        headSnapshotFunction = originatingService.function_title || originatingService.head_user_function || 'Responsable de Service';
      }
    }

    // 2. Generate unique sequential reference for this specific service with custom dynamic values
    const { reference, sequence_number, reference_meta } = await generateReferenceWithMeta(docType, { 
      serviceId: originatingServiceId,
      custom_values: parsedCustomValues
    });
    const trackingToken = require('crypto').randomBytes(16).toString('hex');

    // 3. Resolve template if provided or fetch default
    let template = null;
    if (template_id) {
      template = await db.get('SELECT * FROM document_templates WHERE id = ?', [template_id]);
    } else {
      template = await db.get(
        `SELECT * FROM document_templates 
         WHERE (code = ? OR document_category = ?) AND is_active = 1 
           AND (target_service_id = ? OR scope_type = 'GLOBAL')
         ORDER BY (CASE WHEN target_service_id = ? THEN 1 ELSE 2 END), is_default DESC LIMIT 1`,
        [docType, docCategory, originatingServiceId, originatingServiceId]
      );
    }

    // Resolve dynamic variables in content_body
    const rawContent = content_body || description || '';
    const resolvedContent = resolveAllDynamicVariables(rawContent, {
      reference,
      date: new Date().toLocaleDateString('fr-FR'),
      service_name: originatingService?.name || user.service_name || '',
      recipient_name: target_recipient_name || '',
      object: docTitle,
      head_name: headSnapshotName || '',
      head_title: headSnapshotFunction || '',
      sequence: String(sequence_number).padStart(4, '0')
    }, parsedCustomValues);

    // 4. Determine initial destination & SG routing rule (Rule 9: documents submitted to central go to SG for orientation)
    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    const sgServiceId = sgService ? sgService.id : (originatingServiceId || 1);

    const isDraft = (action === 'DRAFT');
    const currentServiceId = isDraft ? (originatingServiceId || 1) : (target_service_id ? Number(target_service_id) : sgServiceId);
    const initialStatus = isDraft ? 'BROUILLON' : ((currentServiceId === originatingServiceId) ? 'SOUMIS' : 'SOUMIS');

    // 5. Insert document with full contextual snapshot & custom_values_json
    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, document_category, title, description, content_body,
        current_version, last_edited_by, sender_name, sender_organization,
        priority, confidentiality, status, current_service_id, current_user_id, created_by,
        originating_service_id, originating_head_name, originating_head_function, service_sequence_number,
        target_recipient_type, target_recipient_name, target_service_id, target_recipient_id,
        reference_meta, custom_values_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        trackingToken,
        docType,
        docCategory,
        docTitle,
        description || resolvedContent,
        resolvedContent,
        user.id,
        `${user.first_name} ${user.last_name}`,
        originatingService ? originatingService.name : 'Université de Kindia',
        priority || 'NORMAL',
        confidentiality || 'INTERNAL',
        initialStatus,
        currentServiceId,
        target_recipient_id || null,
        user.id,
        originatingServiceId,
        headSnapshotName,
        headSnapshotFunction,
        sequence_number || null,
        target_recipient_type || 'SERVICE',
        target_recipient_name || '',
        target_service_id || null,
        target_recipient_id || null,
        reference_meta,
        JSON.stringify(parsedCustomValues)
      ]
    );

    const docId = docRes.lastID;

    // 6. Save outgoing mail extension
    await db.run(
      `INSERT INTO outgoing_mails (document_id, recipient_name, recipient_address, content_body)
       VALUES (?, ?, ?, ?)`,
      [docId, target_recipient_name || 'Destinataire Administratif', '', content_body || description || '']
    );

    // 7. Save initial version in document_versions (Rule 26)
    await db.run(
      `INSERT INTO document_versions 
       (document_id, version_number, title, object_title, content_body, pieces_jointes, change_notes, created_by)
       VALUES (?, 1, ?, ?, ?, ?, 'Création initiale du document', ?)`,
      [docId, docTitle, docTitle, content_body || description || '', pieces_jointes || '', user.id]
    );

    // 8. Save template snapshot
    if (template) {
      const snapshot = {
        template_id: template.id,
        template_name: template.name,
        template_code: template.code,
        header_text: originatingService ? (originatingService.header_text || template.header_text) : template.header_text,
        footer_text: template.footer_text,
        originating_service_name: originatingService ? originatingService.name : '',
        originating_service_code: originatingService ? (originatingService.reference_code || originatingService.code) : '',
        originating_head_name: headSnapshotName,
        originating_head_function: headSnapshotFunction,
        target_recipient_name,
        object_title: docTitle,
        content_body: content_body || description || '',
        pieces_jointes: pieces_jointes || ''
      };

      await db.run(
        `INSERT INTO document_template_instances (document_id, template_id, template_version_id, snapshot_json)
         VALUES (?, ?, ?, ?)`,
        [docId, template.id, template.version || 1, JSON.stringify(snapshot)]
      );
    }

    // 9. Log initial history
    const originatingName = originatingService ? originatingService.name : 'Service émetteur';
    const actionLabel = isDraft ? 'Brouillon enregistré' : 'Document créé et soumis';
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'CREATE', ?)`,
      [docId, user.id, originatingServiceId || 1, `${actionLabel} par [${originatingName}] avec la référence officielle : ${reference}`]
    );

    // 10. If submitted and routed to another service (e.g. SG), create transfer entry & notify
    if (!isDraft && currentServiceId !== originatingServiceId) {
      await db.run(
        `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, to_user_id, action, motif, instruction, status)
         VALUES (?, ?, ?, ?, ?, 'TRANSMIT', 'Transmission administrative pour orientation / visa', 'Pour orientation par le Secrétaire Général', 'PENDING')`,
        [docId, originatingServiceId || 1, user.id, currentServiceId, target_recipient_id || null]
      );

      // Notify destination users
      const destUsers = await db.all('SELECT id FROM users WHERE service_id = ? AND status = "ACTIVE"', [currentServiceId]);
      for (const du of destUsers) {
        await db.run(
          `INSERT INTO notifications (user_id, document_id, title, message, type)
           VALUES (?, ?, 'Nouveau document soumis', ?, 'ACTION_REQUIRED')`,
          [du.id, docId, `Le document Réf ${reference} vous a été transmis par ${originatingName} pour orientation / visa.`]
        );
      }
    }

    // 11. Process attachments
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.run(
          `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, version, uploaded_by)
           VALUES (?, ?, ?, ?, ?, 1, ?)`,
          [docId, file.originalname, file.path, file.size, file.mimetype, user.id]
        );
      }
    }

    await logAuditAction(user.id, isDraft ? 'CREATE_DRAFT' : 'CREATE_ADMINISTRATIVE_DOC', 'DOCUMENT', docId, req, {
      reference,
      document_type: docType,
      document_category: docCategory,
      is_draft: isDraft,
      originating_service: originatingName,
      target_recipient: target_recipient_name
    });

    res.status(201).json({
      success: true,
      id: docId,
      reference,
      status: initialStatus,
      originating_service: originatingService ? originatingService.name : null,
      head_snapshot: headSnapshotName,
      message: isDraft 
        ? `Brouillon enregistré avec succès (Réf: ${reference}).` 
        : `Document créé avec succès (Réf: ${reference}) et transmis dans le circuit.`
    });
  } catch (err) {
    console.error('Create administrative document error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la création du document administratif.' });
  }
});

// POST /api/documents/soit-transmis - Create Soit-Transmis Document (Rules 6, 7, 8, 18, 19, 26)
router.post('/soit-transmis', authenticateToken, requirePermission('outgoing_mail.create'), upload.array('files'), async (req, res) => {
  const { recipient_name, recipient_address, object_title, content_body, pieces_jointes, template_id, target_service_id, target_recipient_type, target_recipient_id } = req.body;

  if (!recipient_name || !object_title || !content_body) {
    return res.status(400).json({ error: 'Destinataire, objet et contenu sont obligatoires.' });
  }

  try {
    const user = req.user;
    const originatingServiceId = user.service_id;

    // Fetch originating service & head snapshot
    let originatingService = null;
    let headSnapshotName = null;
    let headSnapshotFunction = null;

    if (originatingServiceId) {
      originatingService = await db.get(
        `SELECT s.*, u.first_name as head_first_name, u.last_name as head_last_name, u.function_title as head_user_function
         FROM services s
         LEFT JOIN users u ON s.head_user_id = u.id
         WHERE s.id = ?`,
        [originatingServiceId]
      );

      if (originatingService) {
        headSnapshotName = originatingService.head_first_name ? `${originatingService.head_first_name} ${originatingService.head_last_name}` : null;
        headSnapshotFunction = originatingService.function_title || originatingService.head_user_function || 'Responsable de Service';
      }
    }

    // Generate service-specific reference (e.g. FS/INFO/2026/0001)
    const { reference, sequence_number, reference_meta } = await generateReferenceWithMeta('SOIT_TRANSMIS', { serviceId: originatingServiceId });
    const trackingToken = require('crypto').randomBytes(16).toString('hex');

    // Route to Secrétariat Général for orientation & signature
    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    const targetServiceIdFinal = target_service_id ? Number(target_service_id) : (sgService ? sgService.id : originatingServiceId);

    const activeTemplate = template_id
      ? await db.get('SELECT * FROM document_templates WHERE id = ?', [template_id])
      : await db.get('SELECT * FROM document_templates WHERE (code = "SOIT_TRANSMIS" OR document_category = "SOIT_TRANSMIS") AND is_active = 1 ORDER BY is_default DESC LIMIT 1');

    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, title, description, sender_name, sender_organization,
        priority, confidentiality, status, current_service_id, created_by,
        originating_service_id, originating_head_name, originating_head_function, service_sequence_number,
        target_recipient_type, target_recipient_name, target_service_id, target_recipient_id,
        reference_meta)
       VALUES (?, ?, 'SOIT_TRANSMIS', ?, ?, ?, ?, 'HIGH', 'INTERNAL', 'SOUMIS', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        trackingToken,
        `Soit-Transmis : ${object_title}`,
        content_body,
        `${user.first_name} ${user.last_name}`,
        originatingService ? originatingService.name : 'Université de Kindia',
        targetServiceIdFinal,
        user.id,
        originatingServiceId,
        headSnapshotName,
        headSnapshotFunction,
        sequence_number || null,
        target_recipient_type || 'SERVICE',
        recipient_name,
        target_service_id || null,
        target_recipient_id || null,
        reference_meta
      ]
    );

    const docId = docRes.lastID;

    await db.run(
      `INSERT INTO outgoing_mails (document_id, recipient_name, recipient_address, content_body)
       VALUES (?, ?, ?, ?)`,
      [docId, recipient_name, recipient_address || '', content_body]
    );

    // Save Template Instance Snapshot
    if (activeTemplate) {
      const snapshot = {
        template_code: activeTemplate.code,
        template_name: activeTemplate.name,
        template_version: activeTemplate.version,
        header_text: originatingService ? (originatingService.header_text || activeTemplate.header_text) : activeTemplate.header_text,
        footer_text: activeTemplate.footer_text,
        originating_service_name: originatingService ? originatingService.name : '',
        originating_service_code: originatingService ? (originatingService.reference_code || originatingService.code) : '',
        originating_head_name: headSnapshotName,
        originating_head_function: headSnapshotFunction,
        recipient_name,
        recipient_address,
        object_title,
        content_body,
        pieces_jointes: pieces_jointes || ''
      };

      await db.run(
        `INSERT INTO document_template_instances (document_id, template_id, template_version_id, snapshot_json)
         VALUES (?, ?, ?, ?)`,
        [docId, activeTemplate.id, activeTemplate.version || 1, JSON.stringify(snapshot)]
      );
    }

    const origName = originatingService ? originatingService.name : 'Service émetteur';
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'CREATE', ?)`,
      [docId, user.id, user.service_id, `Soit-Transmis créé par [${origName}] avec référence : ${reference}. Transmis au Secrétaire Général pour orientation.`]
    );

    await db.run(
      `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, action, motif, instruction, status)
       VALUES (?, ?, ?, ?, 'TRANSMIT', 'Transmission pour orientation et visa', 'Soumis au Secrétaire Général', 'PENDING')`,
      [docId, user.service_id, user.id, targetServiceIdFinal]
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

    await logAuditAction(user.id, 'CREATE_SOIT_TRANSMIS', 'DOCUMENT', docId, req, { reference, originating_service: origName });

    res.status(201).json({ success: true, id: docId, reference });
  } catch (err) {
    console.error('Create soit-transmis error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du Soit-Transmis.' });
  }
});

// POST /api/documents/outgoing - Create Outgoing Mail (Courrier Sortant)
router.post('/outgoing', authenticateToken, requirePermission('outgoing_mail.create'), upload.array('files'), async (req, res) => {
  const { title, description, recipient_name, recipient_address, content_body, priority, confidentiality, target_service_id, target_recipient_type, target_recipient_id } = req.body;

  if (!title || !recipient_name) {
    return res.status(400).json({ error: 'Titre et destinataire obligatoires.' });
  }

  try {
    const user = req.user;
    const originatingServiceId = user.service_id;

    // Fetch originating service & head snapshot
    let originatingService = null;
    let headSnapshotName = null;
    let headSnapshotFunction = null;

    if (originatingServiceId) {
      originatingService = await db.get(
        `SELECT s.*, u.first_name as head_first_name, u.last_name as head_last_name, u.function_title as head_user_function
         FROM services s
         LEFT JOIN users u ON s.head_user_id = u.id
         WHERE s.id = ?`,
        [originatingServiceId]
      );

      if (originatingService) {
        headSnapshotName = originatingService.head_first_name ? `${originatingService.head_first_name} ${originatingService.head_last_name}` : null;
        headSnapshotFunction = originatingService.function_title || originatingService.head_user_function || 'Responsable de Service';
      }
    }

    const { reference, sequence_number, reference_meta } = await generateReferenceWithMeta('OUTGOING_MAIL', { serviceId: originatingServiceId });
    const trackingToken = require('crypto').randomBytes(16).toString('hex');

    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, title, description, sender_name, sender_organization,
        priority, confidentiality, status, current_service_id, current_user_id, created_by,
        originating_service_id, originating_head_name, originating_head_function, service_sequence_number,
        target_recipient_type, target_recipient_name, target_service_id, target_recipient_id,
        reference_meta)
       VALUES (?, ?, 'OUTGOING_MAIL', ?, ?, ?, ?, ?, ?, 'CREATED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        trackingToken,
        title,
        description || '',
        `${user.first_name} ${user.last_name}`,
        originatingService ? originatingService.name : 'Université de Kindia',
        priority || 'NORMAL',
        confidentiality || 'INTERNAL',
        user.service_id,
        user.id,
        user.id,
        originatingServiceId,
        headSnapshotName,
        headSnapshotFunction,
        sequence_number || null,
        target_recipient_type || 'SERVICE',
        recipient_name,
        target_service_id || null,
        target_recipient_id || null,
        reference_meta
      ]
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

    // Auto-detect and set custom category if not yet classified
    let catId = doc.custom_category_id;
    let catName = doc.archive_category;
    if (!catId && req.user.service_id) {
      let matchedCat = null;
      if (doc.document_type === 'MISSION_ORDER') {
        matchedCat = await db.get(
          `SELECT id, name FROM archive_custom_categories 
           WHERE service_id = ? AND is_active = 1 
             AND (code LIKE '%MISSION%' OR name LIKE '%Mission%')
           LIMIT 1`,
          [req.user.service_id]
        );
      } else if (doc.document_type === 'COURRIER_ENTRANT' || doc.document_type === 'INCOMING_MAIL' || doc.document_type === 'ARRIVE') {
        matchedCat = await db.get(
          `SELECT id, name FROM archive_custom_categories 
           WHERE service_id = ? AND is_active = 1 
             AND (code LIKE '%ARRIVE%' OR code LIKE '%ENTRANT%' OR name LIKE '%Arriv%')
           LIMIT 1`,
          [req.user.service_id]
        );
      } else if (doc.document_type === 'COURRIER_SORTANT' || doc.document_type === 'OUTGOING_MAIL' || doc.document_type === 'DEPART') {
        matchedCat = await db.get(
          `SELECT id, name FROM archive_custom_categories 
           WHERE service_id = ? AND is_active = 1 
             AND (code LIKE '%DEPART%' OR code LIKE '%SORTANT%' OR name LIKE '%Départ%' OR name LIKE '%Depart%')
           LIMIT 1`,
          [req.user.service_id]
        );
      }
      if (matchedCat) {
        catId = matchedCat.id;
        catName = matchedCat.name;
      }
    }

    await db.run(
      `UPDATE documents 
       SET status = 'ARCHIVED', 
           archived_at = CURRENT_TIMESTAMP,
           archived_by = ?,
           owner_service_id = COALESCE(owner_service_id, originating_service_id, ?),
           custom_category_id = COALESCE(?, custom_category_id),
           archive_category = COALESCE(?, archive_category)
       WHERE id = ?`,
      [req.user.id, req.user.service_id, catId, catName, docId]
    );

    // Also sync status in mission_orders table if applicable
    if (doc.document_type === 'MISSION_ORDER') {
      await db.run(
        `UPDATE mission_orders SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP WHERE document_id = ?`,
        [docId]
      );
    }

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

// POST /api/documents/:id/archive-service - Archive document in local private service archive
router.post('/:id/archive-service', authenticateToken, verifyDocumentAccess, async (req, res) => {
  const docId = req.params.id;
  const { archive_category, archive_scope, custom_category_id, document_type } = req.body;
  const user = req.user;

  try {
    const doc = req.document || await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    const ownerServiceId = doc.originating_service_id || user.service_id || 1;
    const finalScope = archive_scope || 'PRIVE_SERVICE';

    let customCatId = custom_category_id ? Number(custom_category_id) : (doc.custom_category_id || null);
    let finalDocType = document_type || doc.document_type || 'AUTRE';
    let finalCatLabel = archive_category || doc.archive_category;

    if (customCatId) {
      const customCat = await db.get('SELECT * FROM archive_custom_categories WHERE id = ?', [customCatId]);
      if (customCat) {
        finalCatLabel = customCat.name;
        finalDocType = customCat.code;
      }
    }

    await db.run(
      `UPDATE documents 
       SET status = 'ARCHIVED', 
           owner_service_id = ?, 
           archive_scope = ?, 
           archive_category = ?, 
           custom_category_id = ?,
           document_type = ?,
           archived_by = ?, 
           archived_at = CURRENT_TIMESTAMP, 
           is_locked = 1, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [ownerServiceId, finalScope, finalCatLabel || null, customCatId, finalDocType, user.id, docId]
    );

    const serviceObj = await db.get('SELECT name FROM services WHERE id = ?', [ownerServiceId]);

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'ARCHIVE_SERVICE', ?)`,
      [docId, user.id, user.service_id, `Document classé dans les archives privées du service [${serviceObj ? serviceObj.name : 'Service'}]. Catégorie: ${finalCatLabel || finalDocType}, Portée: ${finalScope}`]
    );

    await logAuditAction(user.id, 'ARCHIVE_SERVICE', 'DOCUMENT', docId, req, {
      reference: doc.reference,
      owner_service_id: ownerServiceId,
      archive_scope: finalScope
    });

    res.json({ 
      success: true, 
      message: `Document classé dans les archives privées de votre service avec succès (Portée : ${finalScope}).` 
    });
  } catch (err) {
    console.error('Archive service error:', err);
    res.status(500).json({ error: 'Erreur lors du classement dans les archives du service.' });
  }
});

// POST /api/documents/:id/transmit-to-central-archive - Transmit document to Secrétariat Central for central archiving
router.post('/:id/transmit-to-central-archive', authenticateToken, verifyDocumentAccess, async (req, res) => {
  const docId = req.params.id;
  const { motive } = req.body;
  const user = req.user;

  if (!motive || !motive.trim()) {
    return res.status(400).json({ error: 'Le motif officiel de transmission pour archivage central est obligatoire.' });
  }

  try {
    const doc = req.document || await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scId = scService ? scService.id : 5;

    await db.run(
      `UPDATE documents 
       SET transmitted_to_sc_for_archive = 1,
           transmitted_to_sc_at = CURRENT_TIMESTAMP,
           transmitted_to_sc_by = ?,
           transmission_to_sc_motive = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [user.id, motive.trim(), docId]
    );

    // Add to transfers history
    await db.run(
      `INSERT INTO document_transfers 
       (document_id, from_service_id, from_user_id, to_service_id, action, motif, instruction, status)
       VALUES (?, ?, ?, ?, 'TRANSMIT_CENTRAL_ARCHIVE', 'Versement pour Archivage Central', ?, 'PENDING_CENTRAL_ARCHIVE')`,
      [docId, user.service_id, user.id, scId, motive.trim()]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'TRANSMIT_TO_CENTRAL_ARCHIVE', ?)`,
      [docId, user.id, user.service_id, `Transmis officiellement au Secrétariat Central pour versement aux archives centrales. Motif: ${motive.trim()}`]
    );

    // Notify SC Agents
    const scUsers = await db.all('SELECT id FROM users WHERE service_id = ? AND status = "ACTIVE"', [scId]);
    for (const u of scUsers) {
      await db.run(
        `INSERT INTO notifications (user_id, document_id, title, message, type)
         VALUES (?, ?, 'Document transmis pour Archivage Central', ?, 'ACTION_REQUIRED')`,
        [u.id, docId, `Le document Réf ${doc.reference} a été transmis pour archivage central. Motif : ${motive.trim()}`]
      );
    }

    await logAuditAction(user.id, 'TRANSMIT_CENTRAL_ARCHIVE', 'DOCUMENT', docId, req, {
      reference: doc.reference,
      motive: motive.trim()
    });

    res.json({ 
      success: true, 
      message: 'Document transmis officiellement au Secrétariat Central pour archivage central.' 
    });
  } catch (err) {
    console.error('Transmit central archive error:', err);
    res.status(500).json({ error: 'Erreur lors de la transmission pour archivage central.' });
  }
});

// POST /api/documents/:id/archive-central - Act central archiving (Secrétariat Central only)
router.post('/:id/archive-central', authenticateToken, async (req, res) => {
  const docId = req.params.id;
  const user = req.user;

  const userService = await db.get('SELECT code FROM services WHERE id = ?', [user.service_id]);
  const isSC = userService && userService.code === 'SC';
  const isAdmin = user.role_code === 'ADMINISTRATEUR';

  if (!isSC && !isAdmin) {
    return res.status(403).json({ error: 'Action réservée exclusivement aux agents du Secrétariat Central.' });
  }

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    await db.run(
      `UPDATE documents 
       SET status = 'ARCHIVED',
           archive_scope = 'CENTRAL',
           is_central_archived = 1,
           central_archived_at = CURRENT_TIMESTAMP,
           central_archived_by = ?,
           is_locked = 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [user.id, docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'ARCHIVE_CENTRAL', 'Document versé et classé définitivement dans les archives centrales de l’Université au Secrétariat Central.')`,
      [docId, user.id, user.service_id]
    );

    await logAuditAction(user.id, 'ARCHIVE_CENTRAL', 'DOCUMENT', docId, req, {
      reference: doc.reference
    });

    res.json({ 
      success: true, 
      message: 'Document versé avec succès dans les archives centrales de l’Université.' 
    });
  } catch (err) {
    console.error('Central archive error:', err);
    res.status(500).json({ error: 'Erreur lors du versement dans les archives centrales.' });
  }
});

// POST /api/documents/:id/share-archive - Share an archive with another service
router.post('/:id/share-archive', authenticateToken, verifyDocumentAccess, async (req, res) => {
  const docId = req.params.id;
  const { target_service_id, motive, can_download } = req.body;
  const user = req.user;

  if (!target_service_id) {
    return res.status(400).json({ error: 'Le service destinataire du partage est obligatoire.' });
  }

  try {
    const doc = req.document;
    const targetService = await db.get('SELECT name FROM services WHERE id = ?', [target_service_id]);
    if (!targetService) return res.status(404).json({ error: 'Service destinataire introuvable.' });

    await db.run(
      `INSERT INTO archive_shares (document_id, target_service_id, shared_by, motive, can_download)
       VALUES (?, ?, ?, ?, ?)`,
      [docId, target_service_id, user.id, motive || null, can_download ? 1 : 0]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'SHARE_ARCHIVE', ?)`,
      [docId, user.id, user.service_id, `Archive partagée avec le service [${targetService.name}]. Motif: ${motive || 'Consultation autorisée'}`]
    );

    await logAuditAction(user.id, 'SHARE_ARCHIVE', 'DOCUMENT', docId, req, {
      reference: doc.reference,
      target_service_id,
      motive
    });

    res.json({ success: true, message: `Archive partagée avec succès avec [${targetService.name}].` });
  } catch (err) {
    console.error('Share archive error:', err);
    res.status(500).json({ error: 'Erreur lors du partage de l’archive.' });
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

