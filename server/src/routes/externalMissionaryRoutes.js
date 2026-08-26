const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { UPLOAD_DIR } = require('../config/constants');
const { authenticateToken, requireCentralAdminOrSC } = require('../middleware/auth');
const { generateReferenceWithMeta } = require('../services/numberGenerator');
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
const upload = multer({ 
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Veuillez importer un PDF, JPG ou PNG.'));
    }
  }
});

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

// GET /api/external-missionaries/to-sign - List external mission orders awaiting SG signature (Arrival or Departure)
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
       WHERE m.status IN (
         'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG',
         'DÉPART ENREGISTRÉ – EN ATTENTE DE SIGNATURE DU SG',
         'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE'
       )
       OR (m.current_service_id = ? AND m.status NOT IN ('ARCHIVÉ', 'ARCHIVED'))
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
             db_user.first_name as departure_user_first, db_user.last_name as departure_user_last,
             sb.first_name as signed_user_first, sb.last_name as signed_user_last,
             asb.first_name as arrival_signed_user_first, asb.last_name as arrival_signed_user_last,
             dsb.first_name as departure_signed_user_first, dsb.last_name as departure_signed_user_last,
             del.first_name as delivered_user_first, del.last_name as delivered_user_last,
             arch.first_name as archived_user_first, arch.last_name as archived_user_last
      FROM external_missionaries m
      LEFT JOIN services s ON m.host_service_id = s.id
      LEFT JOIN services cs ON m.current_service_id = cs.id
      LEFT JOIN users ab ON m.arrival_recorded_by = ab.id
      LEFT JOIN users db_user ON m.departure_recorded_by = db_user.id
      LEFT JOIN users sb ON m.signed_by_user_id = sb.id
      LEFT JOIN users asb ON m.arrival_signed_by_user_id = asb.id
      LEFT JOIN users dsb ON m.departure_signed_by_user_id = dsb.id
      LEFT JOIN users del ON m.delivered_by_user_id = del.id
      LEFT JOIN users arch ON m.archived_by_user_id = arch.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      if (status === 'ARCHIVED' || status === 'ARCHIVÉ') {
        query += ` AND m.status IN ('ARCHIVED', 'ARCHIVÉ')`;
      } else if (status === 'IN_PROGRESS' || status === 'MISSION_EN_COURS') {
        query += ` AND m.status IN ('ARRIVÉE SIGNÉE – MISSION EN COURS', 'MISSION EN COURS', 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL')`;
      } else if (status === 'TO_SIGN_ARRIVAL') {
        query += ` AND m.status IN ('ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG', 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE')`;
      } else if (status === 'TO_SIGN_DEPARTURE') {
        query += ` AND m.status = 'DÉPART ENREGISTRÉ – EN ATTENTE DE SIGNATURE DU SG'`;
      } else if (status === 'READY_TO_ARCHIVE') {
        query += ` AND m.status IN ('DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE', 'MISSION TERMINÉE')`;
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
              db_user.first_name as departure_user_first, db_user.last_name as departure_user_last,
              sb.first_name as signed_user_first, sb.last_name as signed_user_last,
              asb.first_name as arrival_signed_user_first, asb.last_name as arrival_signed_user_last,
              dsb.first_name as departure_signed_user_first, dsb.last_name as departure_signed_user_last,
              del.first_name as delivered_user_first, del.last_name as delivered_user_last,
              arch.first_name as archived_user_first, arch.last_name as archived_user_last
       FROM external_missionaries m
       LEFT JOIN services s ON m.host_service_id = s.id
       LEFT JOIN services cs ON m.current_service_id = cs.id
       LEFT JOIN users ab ON m.arrival_recorded_by = ab.id
       LEFT JOIN users db_user ON m.departure_recorded_by = db_user.id
       LEFT JOIN users sb ON m.signed_by_user_id = sb.id
       LEFT JOIN users asb ON m.arrival_signed_by_user_id = asb.id
       LEFT JOIN users dsb ON m.departure_signed_by_user_id = dsb.id
       LEFT JOIN users del ON m.delivered_by_user_id = del.id
       LEFT JOIN users arch ON m.archived_by_user_id = arch.id
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

// GET /api/external-missionaries/:id/history - Timeline of actions
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
    res.status(500).json({ error: 'Erreur lors de la récupération de l’historique.' });
  }
});

// POST /api/external-missionaries - SC registers new external missionary upon arrival with scan/PDF
router.post('/', requireCentralAdminOrSC, upload.single('original_document'), async (req, res) => {
  try {
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
      arrival_date,
      arrival_time,
      phone,
      email,
      observations
    } = req.body;

    if (!last_name || !first_names || !function_title || !origin_institution || !mission_order_ref || !object_of_mission) {
      return res.status(400).json({ error: 'Veuillez renseigner tous les champs obligatoires (Nom, Prénoms, Fonction, Institution d’origine, Réf de l’ordre, Objet).' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Veuillez joindre le document numérisé ou le PDF de l’ordre de mission original.' });
    }

    const { reference, reference_meta } = await generateReferenceWithMeta('EXT_MISSION');

    // Get SG Service ID for automatic forwarding
    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    const sgServiceId = sgService ? sgService.id : null;

    const actualArrivalDate = arrival_date ? new Date(arrival_date).toISOString() : new Date().toISOString();
    const actualArrivalTime = arrival_time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();

    const status = 'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG';

    const result = await db.run(
      `INSERT INTO external_missionaries (
        reference, reference_meta, last_name, first_names, nationality, function_title,
        origin_institution, mission_order_ref, object_of_mission, location_of_mission,
        issuing_authority, host_service_id, host_responsible_name, expected_start_date,
        expected_end_date, phone, email, observations, original_document_path,
        arrival_date, arrival_time, arrival_recorded_at, arrival_recorded_by,
        current_service_id, status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )`,
      [
        reference,
        JSON.stringify(reference_meta),
        last_name.trim().toUpperCase(),
        first_names.trim(),
        nationality || 'Guinéenne',
        function_title.trim(),
        origin_institution.trim(),
        mission_order_ref.trim(),
        object_of_mission.trim(),
        location_of_mission || 'Université de Kindia',
        issuing_authority || null,
        host_service_id ? parseInt(host_service_id) : null,
        host_responsible_name || null,
        expected_start_date || null,
        expected_end_date || null,
        phone || null,
        email || null,
        observations || null,
        req.file.path,
        actualArrivalDate,
        actualArrivalTime,
        nowIso,
        req.user.id,
        sgServiceId,
        status,
        nowIso,
        nowIso
      ]
    );

    const missionaryId = result.lastID;

    // Log in timeline
    await logExtMissHistory(
      missionaryId,
      req.user.id,
      req.user.service_id,
      'REGISTRATION_AND_ARRIVAL_RECORDED',
      `Arrivée enregistrée et ordre de mission numérisé par le Secrétariat Central. Mention : "Vu à l’arrivée à l’Université de Kindia le ${new Date(actualArrivalDate).toLocaleDateString('fr-FR')}". Transmis au Secrétaire Général pour signature.`
    );

    await logAuditAction(req.user.id, 'CREATE_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', missionaryId, req, {
      reference,
      missionary: `${last_name} ${first_names}`,
      origin: origin_institution
    });

    res.status(201).json({
      success: true,
      id: missionaryId,
      reference,
      status,
      message: `Ordre de mission enregistré avec succès. Mention d’arrivée apposée et dossier transmis au Secrétaire Général.`
    });
  } catch (err) {
    console.error('Create external missionary error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de l’ordre de mission.' });
  }
});

// POST /api/external-missionaries/:id/arrival - Record / Update Arrival details (Secrétariat Central)
router.post('/:id/arrival', requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;
  const { arrival_date, arrival_time, observations } = req.body;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    if (record.is_locked || record.status === 'ARCHIVÉ') {
      return res.status(400).json({ error: 'Ce dossier est verrouillé et ne peut plus être modifié.' });
    }

    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    const sgServiceId = sgService ? sgService.id : null;

    const actualArrivalDate = arrival_date ? new Date(arrival_date).toISOString() : (record.arrival_date || new Date().toISOString());
    const actualArrivalTime = arrival_time || record.arrival_time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();

    const newStatus = 'ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG';

    await db.run(
      `UPDATE external_missionaries 
       SET arrival_date = ?, arrival_time = ?, arrival_recorded_at = ?, arrival_recorded_by = ?,
           observations = COALESCE(?, observations),
           current_service_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [actualArrivalDate, actualArrivalTime, nowIso, req.user.id, observations || null, sgServiceId, newStatus, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'ARRIVAL_RECORDED',
      `Informations d'arrivée enregistrées : Date ${new Date(actualArrivalDate).toLocaleDateString('fr-FR')} (${actualArrivalTime}). Dossier transmis au Secrétaire Général.`
    );

    res.json({
      success: true,
      message: 'Arrivée enregistrée avec succès. Dossier transmis au Secrétaire Général pour signature.',
      status: newStatus,
      arrival_date: actualArrivalDate
    });
  } catch (err) {
    console.error('Record arrival error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de l’arrivée.' });
  }
});

// POST /api/external-missionaries/:id/sign-arrival - SG electronically signs the Arrival stamp
router.post('/:id/sign-arrival', async (req, res) => {
  const { id } = req.params;

  const isSGOrAdmin = req.user.role_code === 'ADMINISTRATEUR' 
    || req.user.role_code === 'SECRÉTAIRE_GÉNÉRAL' 
    || req.user.role_code === 'RECTEUR';

  if (!isSGOrAdmin) {
    return res.status(403).json({ error: 'Seul le Secrétaire Général ou l’Administrateur est habilité à signer l’arrivée.' });
  }

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    // Generate signed Arrival PDF with official stamp & SG signature
    let hostServiceName = 'Université de Kindia';
    if (record.host_service_id) {
      const s = await db.get('SELECT name FROM services WHERE id = ?', [record.host_service_id]);
      if (s) hostServiceName = s.name;
    }

    const arrivalPdfData = { ...record, host_service_name: hostServiceName };
    const { filePath } = await generateExternalMissionaryArrivalPDF(arrivalPdfData);

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : null;

    const newStatus = 'ARRIVÉE SIGNÉE – MISSION EN COURS';
    const nowIso = new Date().toISOString();

    await db.run(
      `UPDATE external_missionaries 
       SET status = ?, current_service_id = ?, 
           arrival_signed_at = ?, arrival_signed_by_user_id = ?, arrival_signed_document_path = ?, arrival_document_path = ?,
           signed_at = ?, signed_by_user_id = ?, signed_document_path = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, scServiceId, nowIso, req.user.id, filePath, filePath, nowIso, req.user.id, filePath, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'ARRIVAL_SIGNED_BY_SG',
      `Visa d'arrivée signé électroniquement par le Secrétaire Général (${req.user.first_name} ${req.user.last_name}). Mention : "Vu à l’arrivée à l’Université de Kindia". Statut passé à "MISSION EN COURS". Retour au Secrétariat Central.`
    );

    await logAuditAction(req.user.id, 'SIGN_ARRIVAL_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', id, req, {
      reference: record.reference,
      signed_at: nowIso
    });

    res.json({
      success: true,
      message: 'Visa d’arrivée signé avec succès par le Secrétaire Général. La mission est maintenant EN COURS.',
      status: newStatus,
      arrival_signed_document_path: filePath
    });
  } catch (err) {
    console.error('Sign arrival error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la signature d’arrivée.' });
  }
});

// POST /api/external-missionaries/:id/departure - SC records Departure when mission finishes
router.post('/:id/departure', requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;
  const { departure_date, departure_time, observations } = req.body;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    if (!record.arrival_signed_at && record.status !== 'ARRIVÉE SIGNÉE – MISSION EN COURS' && record.status !== 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL') {
      return res.status(400).json({ error: 'Impossible d’enregistrer le départ : le visa d’arrivée n’a pas encore été signé par le Secrétaire Général.' });
    }

    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    const sgServiceId = sgService ? sgService.id : null;

    const actualDepartureDate = departure_date ? new Date(departure_date).toISOString() : new Date().toISOString();
    const actualDepartureTime = departure_time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const nowIso = new Date().toISOString();

    const newStatus = 'DÉPART ENREGISTRÉ – EN ATTENTE DE SIGNATURE DU SG';

    await db.run(
      `UPDATE external_missionaries 
       SET departure_date = ?, departure_time = ?, departure_recorded_at = ?, departure_recorded_by = ?,
           observations = COALESCE(?, observations),
           current_service_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [actualDepartureDate, actualDepartureTime, nowIso, req.user.id, observations || null, sgServiceId, newStatus, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'DEPARTURE_RECORDED',
      `Fin de mission et départ enregistrés par le Secrétariat Central. Mention : "Vu au départ de l’Université de Kindia le ${new Date(actualDepartureDate).toLocaleDateString('fr-FR')}". Transmis au Secrétaire Général pour la signature finale de départ.`
    );

    res.json({
      success: true,
      message: 'Départ enregistré avec succès. Dossier transmis au Secrétaire Général pour signature de fin de mission.',
      status: newStatus,
      departure_date: actualDepartureDate
    });
  } catch (err) {
    console.error('Record departure error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement du départ.' });
  }
});

// POST /api/external-missionaries/:id/sign-departure - SG electronically signs Departure stamp & generates final consolidated document
router.post('/:id/sign-departure', async (req, res) => {
  const { id } = req.params;

  const isSGOrAdmin = req.user.role_code === 'ADMINISTRATEUR' 
    || req.user.role_code === 'SECRÉTAIRE_GÉNÉRAL' 
    || req.user.role_code === 'RECTEUR';

  if (!isSGOrAdmin) {
    return res.status(403).json({ error: 'Seul le Secrétaire Général ou l’Administrateur est habilité à signer le départ.' });
  }

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    if (!record.arrival_date || !record.departure_date) {
      return res.status(400).json({ error: 'Les dates d’arrivée et de départ doivent être dûment enregistrées avant la signature finale.' });
    }

    // Generate Final Consolidated PDF containing BOTH Arrival and Departure stamps & signatures
    let hostServiceName = 'Université de Kindia';
    if (record.host_service_id) {
      const s = await db.get('SELECT name FROM services WHERE id = ?', [record.host_service_id]);
      if (s) hostServiceName = s.name;
    }

    const finalPdfData = { ...record, host_service_name: hostServiceName };
    const { filePath } = await generateExternalMissionaryFinalPDF(finalPdfData);

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : null;

    const newStatus = 'DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE';
    const nowIso = new Date().toISOString();

    await db.run(
      `UPDATE external_missionaries 
       SET status = ?, current_service_id = ?, 
           departure_signed_at = ?, departure_signed_by_user_id = ?, departure_signed_document_path = ?,
           final_document_path = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, scServiceId, nowIso, req.user.id, filePath, filePath, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'DEPARTURE_SIGNED_BY_SG',
      `Visa de départ signé électroniquement par le Secrétaire Général (${req.user.first_name} ${req.user.last_name}). Document final consolidé produit avec les 2 signatures. Dossier retourné au Secrétariat Central pour archivage.`
    );

    await logAuditAction(req.user.id, 'SIGN_DEPARTURE_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', id, req, {
      reference: record.reference,
      signed_at: nowIso
    });

    res.json({
      success: true,
      message: 'Visa de départ signé avec succès par le Secrétaire Général. Le document final est prêt pour archivage au Secrétariat Central.',
      status: newStatus,
      final_document_path: filePath
    });
  } catch (err) {
    console.error('Sign departure error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la signature de départ.' });
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
    return res.status(403).json({ error: 'Seul le Secrétaire Général ou l’Administrateur peut retourner ou rejeter ce dossier.' });
  }

  if (!rejection_reason || !rejection_reason.trim()) {
    return res.status(400).json({ error: 'Le motif du rejet ou du retour est obligatoire.' });
  }

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : null;

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
      `Dossier retourné par le Secrétaire Général. Motif : ${rejection_reason.trim()}`
    );

    await logAuditAction(req.user.id, 'REJECT_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', id, req, {
      reference: record.reference,
      rejection_reason
    });

    res.json({
      success: true,
      message: 'Ordre de mission externe retourné au Secrétariat Central avec le motif indiqué.',
      status: newStatus
    });
  } catch (err) {
    console.error('Reject external missionary error:', err);
    res.status(500).json({ error: 'Erreur lors du rejet de l’ordre de mission.' });
  }
});

// POST /api/external-missionaries/:id/archive - Exclusively Secrétariat Central (or Admin), strictly requiring arrival & departure signatures
router.post('/:id/archive', requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Ordre de mission externe introuvable.' });
    }

    // STRICT WORKFLOW CONTROL: Check all mandatory conditions
    const hasOriginalDoc = !!record.original_document_path;
    const hasArrivalRecorded = !!record.arrival_date;
    const hasArrivalSigned = !!record.arrival_signed_at || record.status === 'ARRIVÉE SIGNÉE – MISSION EN COURS' || !!record.signed_at;
    const hasDepartureRecorded = !!record.departure_date;
    const hasDepartureSigned = !!record.departure_signed_at || record.status === 'DÉPART SIGNÉ – PRÊT POUR ARCHIVAGE' || record.status === 'MISSION TERMINÉE';

    if (!hasOriginalDoc) {
      return res.status(400).json({ error: 'Archivage impossible : Le document original numérisé est absent.' });
    }

    if (!hasArrivalRecorded || !hasArrivalSigned) {
      return res.status(400).json({ error: 'Archivage strictement interdit : Le visa d’arrivée n’a pas été signé par le Secrétaire Général.' });
    }

    if (!hasDepartureRecorded || !hasDepartureSigned) {
      return res.status(400).json({ 
        error: 'Archivage strictement interdit : La mission n’est pas clôturée. La signature de départ du Secrétaire Général est obligatoire avant tout archivage.' 
      });
    }

    const newStatus = 'ARCHIVÉ';
    const nowIso = new Date().toISOString();

    await db.run(
      `UPDATE external_missionaries 
       SET status = ?, is_locked = 1, archived_at = ?, archived_by_user_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, nowIso, req.user.id, id]
    );

    await logExtMissHistory(
      id,
      req.user.id,
      req.user.service_id,
      'DOCUMENT_ARCHIVED',
      `Ordre de mission externe classé définitivement dans les archives électroniques de l'Université par le Secrétariat Central (${req.user.first_name} ${req.user.last_name}). Dossier verrouillé.`
    );

    await logAuditAction(req.user.id, 'ARCHIVE_EXTERNAL_MISSIONARY', 'EXTERNAL_MISSIONARY', id, req, {
      reference: record.reference,
      archived_at: nowIso
    });

    res.json({
      success: true,
      message: 'Ordre de mission classé définitivement dans les archives électroniques de l’Université avec succès.',
      status: newStatus
    });
  } catch (err) {
    console.error('Archive external missionary error:', err);
    res.status(500).json({ error: 'Erreur lors de l’archivage.' });
  }
});

// GET /api/external-missionaries/:id/document/:version - Stream PDF / Image document (original, arrival, signed, departure, final)
router.get('/:id/document/:version', async (req, res) => {
  const { id, version } = req.params;

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Fiche missionnaire introuvable.' });
    }

    let targetFilePath = null;
    if (version === 'final') {
      targetFilePath = record.final_document_path || record.departure_signed_document_path || record.arrival_signed_document_path || record.signed_document_path || record.original_document_path;
    } else if (version === 'departure' || version === 'signed') {
      targetFilePath = record.departure_signed_document_path || record.final_document_path || record.signed_document_path || record.arrival_signed_document_path || record.original_document_path;
    } else if (version === 'arrival') {
      targetFilePath = record.arrival_signed_document_path || record.arrival_document_path || record.original_document_path;
    } else if (version === 'original') {
      targetFilePath = record.original_document_path;
    } else {
      targetFilePath = record.final_document_path || record.signed_document_path || record.original_document_path;
    }

    if (!targetFilePath) {
      return res.status(404).json({ error: 'Document non disponible pour cette version.' });
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
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
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

  if (req.user.role_code !== 'ADMINISTRATEUR') {
    return res.status(403).json({ error: 'Seul un Administrateur peut supprimer un ordre de mission externe.' });
  }

  try {
    const record = await db.get('SELECT * FROM external_missionaries WHERE id = ?', [id]);
    if (!record) {
      return res.status(404).json({ error: 'Fiche missionnaire introuvable.' });
    }

    // Delete associated files
    const filePaths = [
      record.original_document_path, 
      record.arrival_document_path, 
      record.arrival_signed_document_path, 
      record.signed_document_path, 
      record.departure_signed_document_path, 
      record.final_document_path
    ];
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
