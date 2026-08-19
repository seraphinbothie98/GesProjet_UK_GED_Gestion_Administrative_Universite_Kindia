const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { UPLOAD_DIR } = require('../config/constants');
const { authenticateToken, requireCentralAdminOrSC } = require('../middleware/auth');
const { generateReference, generateReferenceWithMeta } = require('../services/numberGenerator');
const { 
  generateExternalMissionaryArrivalPDF, 
  generateExternalMissionaryFinalPDF,
  generateSignedExternalMissionaryPDF 
} = require('../services/pdfService');
const { logAuditAction } = require('../middleware/audit');

// Configure Multer for original document upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'EXT_MISSION_' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Helper to log external missionary timeline history
async function logExtMissHistory(missionaryId, userId, serviceId, action, details = '') {
  try {
    await db.run(
      `INSERT INTO external_missionary_history (missionary_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, ?, ?)`,
      [missionaryId, userId, serviceId || null, action, details]
    );
  } catch (err) {
    console.error('Failed to log external missionary history:', err);
  }
}

// All endpoints in this router require token authentication
router.use(authenticateToken);

// GET /api/external-missionaries/to-sign - List external mission orders awaiting SG signature
router.get('/to-sign', async (req, res) => {
  const isSGOrAdmin = req.user.role_code === 'ADMINISTRATEUR' 
    || req.user.role_code === 'SECRÉTAIRE_GÉNÉRAL' 
    || req.user.role_code === 'RECTEUR';

  if (!isSGOrAdmin) {
    return res.json([]);
  }

  try {
    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    const sgServiceId = sgService ? sgService.id : null;

    const records = await db.all(
      `SELECT m.*, 
              s.name as host_service_name, s.code as host_service_code,
              cs.name as current_service_name
       FROM external_missionaries m
       LEFT JOIN services s ON m.host_service_id = s.id
       LEFT JOIN services cs ON m.current_service_id = cs.id
       WHERE m.status = 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE'
          OR m.current_service_id = ?
       ORDER BY m.updated_at DESC`,
      [sgServiceId]
    );

    res.json(records);
  } catch (err) {
    console.error('Fetch external missionaries to sign error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des ordres à signer.' });
  }
});

// GET /api/external-missionaries - List all external missionaries (SC & Central Admin)
router.get('/', async (req, res) => {
  const { status, search } = req.query;

  try {
    let query = `
      SELECT m.*, 
             s.name as host_service_name, s.code as host_service_code,
             cs.name as current_service_name,
             ab.first_name as arrival_user_first, ab.last_name as arrival_user_last,
             db.first_name as departure_user_first, db.last_name as departure_user_last,
             sb.first_name as signed_user_first, sb.last_name as signed_user_last,
             del.first_name as delivered_user_first, del.last_name as delivered_user_last
      FROM external_missionaries m
      LEFT JOIN services s ON m.host_service_id = s.id
      LEFT JOIN services cs ON m.current_service_id = cs.id
      LEFT JOIN users ab ON m.arrival_recorded_by = ab.id
      LEFT JOIN users db ON m.departure_recorded_by = db.id
      LEFT JOIN users sb ON m.signed_by_user_id = sb.id
      LEFT JOIN users del ON m.delivered_by_user_id = del.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      if (status === 'ARCHIVED' || status === 'ARCHIVÉ') {
        query += ` AND m.status IN ('ARCHIVED', 'ARCHIVÉ')`;
      } else {
        query += ` AND m.status = ?`;
        params.push(status);
      }
    }
    if (search) {
      query += ` AND (m.last_name LIKE ? OR m.first_names LIKE ? OR m.origin_institution LIKE ? OR m.reference LIKE ? OR m.mission_order_ref LIKE ? OR m.object_of_mission LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }

    query += ` ORDER BY m.created_at DESC`;

    const records = await db.all(query, params);
    res.json(records);
  } catch (err) {
    console.error('Fetch external missionaries error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des missionnaires externes.' });
  }
});

// GET /api/external-missionaries/:id - Fetch single external missionary record & details
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const record = await db.get(
      `SELECT m.*, 
              s.name as host_service_name, s.code as host_service_code,
              cs.name as current_service_name,
              ab.first_name as arrival_user_first, ab.last_name as arrival_user_last,
              db.first_name as departure_user_first, db.last_name as departure_user_last,
              sb.first_name as signed_user_first, sb.last_name as signed_user_last,
              del.first_name as delivered_user_first, del.last_name as delivered_user_last
       FROM external_missionaries m
       LEFT JOIN services s ON m.host_service_id = s.id
       LEFT JOIN services cs ON m.current_service_id = cs.id
       LEFT JOIN users ab ON m.arrival_recorded_by = ab.id
       LEFT JOIN users db ON m.departure_recorded_by = db.id
       LEFT JOIN users sb ON m.signed_by_user_id = sb.id
       LEFT JOIN users del ON m.delivered_by_user_id = del.id
       WHERE m.id = ?`,
      [id]
    );

    if (!record) {
      return res.status(404).json({ error: 'Fiche missionnaire externe introuvable.' });
    }

    res.json(record);
  } catch (err) {
    console.error('Fetch single external missionary error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de la fiche missionnaire.' });
  }
});

// GET /api/external-missionaries/:id/history - Fetch full chronological timeline
router.get('/:id/history', async (req, res) => {
  const { id } = req.params;

  try {
    const history = await db.all(
      `SELECT h.*, 
              u.first_name, u.last_name, u.function_title,
              s.name as service_name, s.code as service_code
       FROM external_missionary_history h
       LEFT JOIN users u ON h.user_id = u.id
       LEFT JOIN services s ON h.service_id = s.id
       WHERE h.missionary_id = ?
       ORDER BY h.timestamp ASC, h.id ASC`,
      [id]
    );

    res.json(history);
  } catch (err) {
    console.error('Fetch external missionary history error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de l’historique.' });
  }
});

// POST /api/external-missionaries - Register a new external missionary (SC / Central Admin)
router.post('/', requireCentralAdminOrSC, upload.single('original_document'), async (req, res) => {
  const {
    last_name,
    first_names,
    nationality,
    function_title,
    origin_institution,
    mission_order_ref,
    object_of_mission,
    location_of_mission,
    issuing_authority,
    host_service_id,
    host_responsible_name,
    expected_start_date,
    expected_end_date,
    phone,
    email,
    observations
  } = req.body;

  if (!last_name || !first_names || !function_title || !origin_institution || !mission_order_ref || !object_of_mission) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (Nom, Prénoms, Fonction, Institution, Réf ordre de mission, Objet).' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'L’ordre de mission original scanné ou PDF est obligatoire.' });
  }

  try {
    const { reference, reference_meta } = await generateReferenceWithMeta('EXTERNAL_MISSION_ORDER');
    const originalDocumentPath = req.file.path;

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const currentServiceId = scService ? scService.id : req.user.service_id;

    const result = await db.run(
      `INSERT INTO external_missionaries (
        reference, last_name, first_names, nationality, function_title,
        origin_institution, mission_order_ref, object_of_mission, location_of_mission,
        issuing_authority, observations, host_service_id, host_responsible_name,
        current_service_id, current_user_id, expected_start_date, expected_end_date,
        phone, email, original_document_path, status, reference_meta
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENREGISTRÉ – EN ATTENTE DE TRANSMISSION AU SG', ?)`,
      [
        reference,
        last_name.trim(),
        first_names.trim(),
        nationality || 'Guinéenne',
        function_title.trim(),
        origin_institution.trim(),
        mission_order_ref.trim(),
        object_of_mission.trim(),
        location_of_mission || 'Université de Kindia',
        issuing_authority || null,
        observations || null,
        host_service_id || null,
        host_responsible_name || null,
        currentServiceId,
        req.user.id,
        expected_start_date || null,
        expected_end_date || null,
        phone || null,
        email || null,
        originalDocumentPath,
        reference_meta
      ]
    );

    const newId = result.lastID;

    // Log Timeline Event 1
    await logExtMissHistory(
      newId,
      req.user.id,
      currentServiceId,
      'RECEPTION_AND_REGISTRATION',
      `Ordre de mission externe reçu et enregistré par le Secrétariat Central (Réf OM: ${mission_order_ref}, Institution: ${origin_institution}).`
    );

    await logAuditAction(req.user.id, 'CREATE_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', newId, req, {
      reference,
      missionary: `${first_names} ${last_name}`,
      origin_institution
    });

    res.status(201).json({
      success: true,
      message: 'Ordre de mission externe enregistré avec succès au Secrétariat Central.',
      id: newId,
      reference
    });
  } catch (err) {
    console.error('Create external missionary error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de l’ordre de mission externe.' });
  }
});

// POST /api/external-missionaries/:id/transmit-to-sg - Transmit to Secrétaire Général
router.post('/:id/transmit-to-sg', requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    if (!sgService) {
      return res.status(500).json({ error: 'Service Secrétaire Général introuvable.' });
    }

    const newStatus = 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE';

    await db.run(
      `UPDATE external_missionaries 
       SET current_service_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [sgService.id, newStatus, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'TRANSMIT_TO_SG',
      'Ordre de mission externe transmis au Secrétaire Général pour signature électronique.'
    );

    await logAuditAction(req.user.id, 'TRANSMIT_EXTERNAL_MISSIONARY_TO_SG', 'EXTERNAL_MISSIONARY', id, req, {
      reference: record.reference
    });

    res.json({
      success: true,
      message: 'Ordre de mission externe transmis au Secrétaire Général avec succès.',
      status: newStatus
    });
  } catch (err) {
    console.error('Transmit to SG error:', err);
    res.status(500).json({ error: 'Erreur lors de la transmission au Secrétaire Général.' });
  }
});

// POST /api/external-missionaries/:id/sign - SG signs electronically & returns to SC
router.post('/:id/sign', async (req, res) => {
  const { id } = req.params;

  const isSGOrAdmin = req.user.role_code === 'ADMINISTRATEUR' 
    || req.user.role_code === 'SECRÉTAIRE_GÉNÉRAL' 
    || req.user.role_code === 'RECTEUR';

  if (!isSGOrAdmin) {
    return res.status(403).json({ error: 'Seul le Secrétaire Général ou l’Administrateur peut signer électroniquement cet ordre de mission.' });
  }

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    // Fetch active signature for SG user
    const sgSig = await db.get(
      'SELECT signature_image_path FROM user_signatures WHERE user_id = ? AND is_active = 1',
      [req.user.id]
    );

    // Generate signed PDF
    const { filePath } = await generateSignedExternalMissionaryPDF(record, sgSig || {});

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : record.host_service_id;

    const newStatus = 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL';
    const nowIso = new Date().toISOString();

    await db.run(
      `UPDATE external_missionaries 
       SET status = ?, current_service_id = ?, signed_at = ?, signed_by_user_id = ?, signed_document_path = ?, is_locked = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, scServiceId, nowIso, req.user.id, filePath, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'ELECTRONIC_SIGNATURE',
      `Signé électroniquement par le Secrétaire Général (${req.user.first_name} ${req.user.last_name}) et retourné automatiquement au Secrétariat Central.`
    );

    await logAuditAction(req.user.id, 'SIGN_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', id, req, {
      reference: record.reference,
      signed_at: nowIso
    });

    res.json({
      success: true,
      message: 'Ordre de mission signé électroniquement avec succès et retourné au Secrétariat Central.',
      status: newStatus,
      signed_document_path: filePath
    });
  } catch (err) {
    console.error('Sign external missionary error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la signature électronique.' });
  }
});

// POST /api/external-missionaries/:id/reject - SG rejects with mandatory reason
router.post('/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;

  const isSGOrAdmin = req.user.role_code === 'ADMINISTRATEUR' 
    || req.user.role_code === 'SECRÉTAIRE_GÉNÉRAL' 
    || req.user.role_code === 'RECTEUR';

  if (!isSGOrAdmin) {
    return res.status(403).json({ error: 'Seul le Secrétaire Général ou l’Administrateur peut rejeter cet ordre de mission.' });
  }

  if (!rejection_reason || !rejection_reason.trim()) {
    return res.status(400).json({ error: 'Le motif du rejet est obligatoire.' });
  }

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : record.host_service_id;

    const newStatus = 'REJETÉ PAR LE SECRÉTAIRE GÉNÉRAL';
    const nowIso = new Date().toISOString();

    await db.run(
      `UPDATE external_missionaries 
       SET status = ?, current_service_id = ?, rejection_reason = ?, rejected_by_user_id = ?, rejected_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, scServiceId, rejection_reason.trim(), req.user.id, nowIso, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'REJECTED_BY_SG',
      `Rejeté par le Secrétaire Général. Motif : ${rejection_reason.trim()}`
    );

    await logAuditAction(req.user.id, 'REJECT_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', id, req, {
      reference: record.reference,
      rejection_reason
    });

    res.json({
      success: true,
      message: 'Ordre de mission externe rejeté et retourné au Secrétariat Central.',
      status: newStatus
    });
  } catch (err) {
    console.error('Reject external missionary error:', err);
    res.status(500).json({ error: 'Erreur lors du rejet de l’ordre de mission.' });
  }
});

// POST /api/external-missionaries/:id/print - Log Print Action
router.post('/:id/print', requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    await db.run('UPDATE external_missionaries SET print_count = print_count + 1 WHERE id = ?', [id]);

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'DOCUMENT_PRINTED',
      `Ordre de mission externe imprimé par le Secrétariat Central (${req.user.first_name} ${req.user.last_name}).`
    );

    res.json({ success: true, message: 'Impression enregistrée.' });
  } catch (err) {
    console.error('Print external missionary error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de l’impression.' });
  }
});

// POST /api/external-missionaries/:id/deliver - Record Delivery to Missionary
router.post('/:id/deliver', requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;
  const { recipient_name, delivery_notes, delivery_date } = req.body;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    const nowIso = delivery_date || new Date().toISOString();
    const finalRecipient = recipient_name || `${record.first_names} ${record.last_name}`;
    const newStatus = 'REMIS AU MISSIONNAIRE';

    await db.run(
      `UPDATE external_missionaries 
       SET status = ?, delivered_at = ?, delivered_by_user_id = ?, recipient_name = ?, delivery_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, nowIso, req.user.id, finalRecipient, delivery_notes || null, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'DELIVERED_TO_MISSIONARY',
      `Ordre de mission remis en main propre au missionnaire [${finalRecipient}]. Observation : ${delivery_notes || 'Aucune'}`
    );

    await logAuditAction(req.user.id, 'DELIVER_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', id, req, {
      reference: record.reference,
      recipient: finalRecipient
    });

    res.json({
      success: true,
      message: 'Remise au missionnaire enregistrée avec succès. Le circuit du document est achevé.',
      status: newStatus,
      delivered_at: nowIso
    });
  } catch (err) {
    console.error('Deliver external missionary error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de la remise.' });
  }
});

// POST /api/external-missionaries/:id/archive - Archive External Mission Order
router.post('/:id/archive', requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    const newStatus = 'ARCHIVÉ';

    await db.run(
      `UPDATE external_missionaries 
       SET status = ?, is_locked = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'DOCUMENT_ARCHIVED',
      'Ordre de mission externe classé définitivement dans les archives électroniques.'
    );

    await logAuditAction(req.user.id, 'ARCHIVE_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', id, req, {
      reference: record.reference
    });

    res.json({
      success: true,
      message: 'Ordre de mission classé dans les archives avec succès.',
      status: newStatus
    });
  } catch (err) {
    console.error('Archive external missionary error:', err);
    res.status(500).json({ error: 'Erreur lors de l’archivage.' });
  }
});

// POST /api/external-missionaries/:id/check-in - Record Arrival (Legacy/Complementary)
router.post('/:id/check-in', requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Missionnaire externe introuvable.' });
    }

    const nowIso = new Date().toISOString();
    let hostServiceName = 'Université de Kindia';
    if (record.host_service_id) {
      const s = await db.get('SELECT name FROM services WHERE id = ?', [record.host_service_id]);
      if (s) hostServiceName = s.name;
    }

    const missDataForPdf = { ...record, arrival_date: nowIso, host_service_name: hostServiceName };
    const { filePath } = await generateExternalMissionaryArrivalPDF(missDataForPdf);

    await db.run(
      `UPDATE external_missionaries 
       SET arrival_date = ?, arrival_recorded_at = ?, arrival_recorded_by = ?, arrival_document_path = ?, status = 'ARRIVÉE ENREGISTRÉE', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nowIso, nowIso, req.user.id, filePath, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'ARRIVEE_STAMPED',
      'Mention "VU À L’ARRIVÉE" apposée sur l’ordre de mission par le Secrétariat Central.'
    );

    res.json({
      success: true,
      message: 'Arrivée enregistrée avec succès.',
      arrival_date: nowIso
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Erreur lors du visa d’arrivée.' });
  }
});

// POST /api/external-missionaries/:id/check-out - Record Departure (Legacy/Complementary)
router.post('/:id/check-out', requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Missionnaire externe introuvable.' });
    }

    const nowIso = new Date().toISOString();
    let hostServiceName = 'Université de Kindia';
    if (record.host_service_id) {
      const s = await db.get('SELECT name FROM services WHERE id = ?', [record.host_service_id]);
      if (s) hostServiceName = s.name;
    }

    const missDataForPdf = { ...record, departure_date: nowIso, host_service_name: hostServiceName };
    const { filePath } = await generateExternalMissionaryFinalPDF(missDataForPdf);

    await db.run(
      `UPDATE external_missionaries 
       SET departure_date = ?, departure_recorded_at = ?, departure_recorded_by = ?, final_document_path = ?, status = 'MISSION TERMINÉE', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nowIso, nowIso, req.user.id, filePath, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'DEPARTURE_STAMPED',
      'Mention "VU AU DÉPART" apposée sur l’ordre de mission. Mission clôturée.'
    );

    res.json({
      success: true,
      message: 'Départ enregistré avec succès.',
      departure_date: nowIso
    });
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ error: 'Erreur lors du visa de départ.' });
  }
});

// GET /api/external-missionaries/:id/document/:version - Stream PDF document (original, signed, arrival, final)
router.get('/:id/document/:version', async (req, res) => {
  const { id, version } = req.params;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Fiche missionnaire introuvable.' });
    }

    let targetFilePath = null;
    if (version === 'signed') targetFilePath = record.signed_document_path || record.original_document_path;
    else if (version === 'original') targetFilePath = record.original_document_path;
    else if (version === 'arrival') targetFilePath = record.arrival_document_path || record.original_document_path;
    else if (version === 'final') targetFilePath = record.final_document_path || record.signed_document_path || record.original_document_path;
    else targetFilePath = record.signed_document_path || record.original_document_path;

    if (!targetFilePath) {
      return res.status(404).json({ error: 'Document non disponible.' });
    }

    const fullPath = path.isAbsolute(targetFilePath) ? targetFilePath : path.join(UPLOAD_DIR, path.basename(targetFilePath));

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Fichier introuvable sur le disque.' });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(fullPath))}"`);
    return res.sendFile(fullPath);
  } catch (err) {
    console.error('Stream external missionary document error:', err);
    res.status(500).json({ error: 'Erreur lors de la lecture du document.' });
  }
});

// DELETE /api/external-missionaries/:id - Delete external missionary record (Admin only)
router.delete('/:id', requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Fiche missionnaire introuvable.' });
    }

    // Delete associated files
    const filePaths = [record.original_document_path, record.arrival_document_path, record.signed_document_path, record.final_document_path];
    for (const fp of filePaths) {
      if (fp) {
        const fullPath = path.isAbsolute(fp) ? fp : path.join(UPLOAD_DIR, path.basename(fp));
        if (fs.existsSync(fullPath)) {
          try { fs.unlinkSync(fullPath); } catch (e) {}
        }
      }
    }

    await db.run('DELETE FROM external_missionary_history WHERE missionary_id = ?', [id]);
    await db.run('DELETE FROM external_missionaries WHERE id = ?', [id]);

    await logAuditAction(req.user.id, 'DELETE_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', id, req, {
      reference: record.reference,
      missionary: `${record.last_name} ${record.first_names}`
    });

    res.json({ success: true, message: `Ordre de mission externe ${record.reference} supprimé avec succès.` });
  } catch (err) {
    console.error('Delete external missionary error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du missionnaire externe.' });
  }
});

module.exports = router;
