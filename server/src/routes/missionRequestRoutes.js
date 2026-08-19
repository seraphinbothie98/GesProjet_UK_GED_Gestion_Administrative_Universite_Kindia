const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { UPLOAD_DIR } = require('../config/constants');
const { authenticateToken, requireCentralAdminOrSC } = require('../middleware/auth');
const { generateReference } = require('../services/numberGenerator');
const { logAuditAction } = require('../middleware/audit');

// Configure Multer for attachments upload
const reqsDir = path.join(UPLOAD_DIR, 'mission_requests');
if (!fs.existsSync(reqsDir)) {
  fs.mkdirSync(reqsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reqsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'REQ_ATTACH_' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Helper to log history events
async function logRequestHistory(requestId, userId, roleName, action, oldStatus, newStatus, observation = '') {
  try {
    await db.run(
      `INSERT INTO mission_order_request_history (request_id, user_id, role_name, action, old_status, new_status, observation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [requestId, userId || null, roleName || 'Demandeur', action, oldStatus || null, newStatus, observation]
    );
  } catch (err) {
    console.error('Failed to log mission request history:', err);
  }
}

// Helper to notify Secrétariat Central agents
async function notifySecretariatCentral(title, message, requestId = null) {
  try {
    const scUsers = await db.all(
      `SELECT DISTINCT u.id 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN services s ON u.service_id = s.id
       WHERE r.code = 'AGENT_SECRÉTARIAT_CENTRAL' OR s.code = 'SC' OR u.email = 'sc@univ-kindia.edu.gn'`
    );
    for (const scUser of scUsers) {
      await db.run(
        `INSERT INTO notifications (user_id, document_id, title, message, type)
         VALUES (?, NULL, ?, ?, 'MISSION_REQUEST')`,
        [scUser.id, title, message]
      );
    }
  } catch (err) {
    console.error('Failed to notify SC:', err);
  }
}

// 1. POST /api/mission-requests/public - Public request submission without account
router.post('/public', upload.array('files'), async (req, res) => {
  const {
    applicant_last_name,
    applicant_first_names,
    applicant_function,
    applicant_matricule,
    applicant_service_name,
    applicant_phone,
    applicant_email,
    applicant_institution,
    object_of_mission,
    destination,
    country,
    exact_location,
    start_date,
    end_date,
    duration_days,
    transport_means,
    justification_motif,
    host_organization,
    local_contact
  } = req.body;

  if (!applicant_last_name || !applicant_first_names || !applicant_function || !applicant_phone || !applicant_email || !object_of_mission || !destination || !start_date || !end_date) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (Nom, Prénoms, Fonction, Téléphone, Email, Objet, Destination, Dates).' });
  }

  try {
    const scService = await db.get('SELECT id, name FROM services WHERE code = "SC" LIMIT 1');
    const destServiceId = scService ? scService.id : 5;
    const destServiceName = scService ? scService.name : 'Secrétariat Central';

    const reference = await generateReference('DMO');
    const trackingToken = require('crypto').randomBytes(16).toString('hex');
    const initialStatus = 'EN_ATTENTE_SC';

    const result = await db.run(
      `INSERT INTO mission_order_requests (
        reference, tracking_token, user_id, destination_service_id, destination_service_name,
        applicant_last_name, applicant_first_names, applicant_function, applicant_matricule,
        applicant_service_name, applicant_phone, applicant_email, applicant_institution,
        object_of_mission, destination, country, exact_location,
        start_date, end_date, duration_days, transport_means,
        justification_motif, host_organization, local_contact, status
      ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        trackingToken,
        destServiceId,
        destServiceName,
        applicant_last_name.trim(),
        applicant_first_names.trim(),
        applicant_function.trim(),
        applicant_matricule ? applicant_matricule.trim() : null,
        applicant_service_name ? applicant_service_name.trim() : 'Enseignement / Recherche',
        applicant_phone.trim(),
        applicant_email.trim(),
        applicant_institution ? applicant_institution.trim() : 'Université de Kindia',
        object_of_mission.trim(),
        destination.trim(),
        country ? country.trim() : 'Guinée',
        exact_location ? exact_location.trim() : null,
        start_date,
        end_date,
        duration_days || null,
        transport_means || 'VÉHICULE OFFICIEL',
        justification_motif || null,
        host_organization || null,
        local_contact || null,
        initialStatus
      ]
    );

    const requestId = result.lastID;

    // Save attached documents
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.run(
          `INSERT INTO mission_order_request_attachments (request_id, file_name, file_path, file_size, mime_type)
           VALUES (?, ?, ?, ?, ?)`,
          [requestId, file.originalname, file.path, file.size, file.mimetype]
        );
      }
    }

    // Log History Step 1
    await logRequestHistory(
      requestId,
      null,
      'Visiteur / Demandeur Public',
      'SUBMIT_REQUEST',
      null,
      initialStatus,
      `Demande d'ordre de mission déposée en ligne (${reference}) et transmise au Secrétariat Central.`
    );

    await notifySecretariatCentral(
      `Nouvelle demande d'ordre de mission (${reference})`,
      `Demande publique reçue de ${applicant_first_names.trim()} ${applicant_last_name.trim()} (${applicant_function.trim()}) pour "${destination.trim()}".`,
      requestId
    );

    res.status(201).json({
      success: true,
      message: 'Votre demande d’ordre de mission a été enregistrée avec succès et transmise au Secrétariat Central.',
      id: requestId,
      reference,
      tracking_token: trackingToken,
      status: initialStatus,
      destination_service_name: destServiceName
    });
  } catch (err) {
    console.error('Public mission request submit error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de votre demande.' });
  }
});

// 2. POST /api/mission-requests/track-public - Public tracking without account (Reference + Phone/Email)
router.post('/track-public', async (req, res) => {
  const { reference, contact } = req.body;

  if (!reference || !contact) {
    return res.status(400).json({ error: 'Veuillez saisir le numéro de référence et votre contact (Téléphone ou Email).' });
  }

  try {
    const cleanRef = reference.trim();
    const cleanContact = contact.trim().toLowerCase();

    const request = await db.get(
      `SELECT r.*, doc.reference as official_doc_reference, doc.status as official_doc_status
       FROM mission_order_requests r
       LEFT JOIN documents doc ON r.official_document_id = doc.id
       WHERE (r.reference = ? OR r.tracking_token = ?)
         AND (LOWER(r.applicant_phone) = ? OR LOWER(r.applicant_email) = ?)`,
      [cleanRef, cleanRef, cleanContact, cleanContact]
    );

    if (!request) {
      return res.status(404).json({ error: 'Aucun dossier correspondant à cette référence et ces coordonnées.' });
    }

    const history = await db.all(
      `SELECT timestamp, action, old_status, new_status, observation, role_name
       FROM mission_order_request_history
       WHERE request_id = ?
       ORDER BY timestamp ASC`,
      [request.id]
    );

    res.json({
      success: true,
      request: {
        id: request.id,
        reference: request.reference,
        applicant: `${request.applicant_first_names} ${request.applicant_last_name}`,
        function: request.applicant_function,
        service: request.applicant_service_name,
        destination: request.destination,
        object: request.object_of_mission,
        start_date: request.start_date,
        end_date: request.end_date,
        status: request.status,
        official_doc_reference: request.official_doc_reference,
        official_doc_status: request.official_doc_status,
        created_at: request.created_at
      },
      history
    });
  } catch (err) {
    console.error('Public track mission request error:', err);
    res.status(500).json({ error: 'Erreur lors du suivi de la demande.' });
  }
});

// 3. POST /api/mission-requests - Connected User request submission
router.post('/', authenticateToken, upload.array('files'), async (req, res) => {
  const {
    applicant_last_name,
    applicant_first_names,
    applicant_function,
    applicant_matricule,
    applicant_service_name,
    applicant_phone,
    applicant_email,
    applicant_institution,
    object_of_mission,
    destination,
    country,
    exact_location,
    start_date,
    end_date,
    duration_days,
    transport_means,
    justification_motif,
    host_organization,
    local_contact
  } = req.body;

  try {
    const user = req.user;
    const finalLastName = applicant_last_name || user.last_name;
    const finalFirstNames = applicant_first_names || user.first_name;
    const finalFunction = applicant_function || user.function_title || 'Enseignant / Agent';
    const finalMatricule = applicant_matricule || user.matricule || null;
    const finalService = applicant_service_name || user.service_name || (user.personnel_category === 'ENSEIGNANT_CHERCHEUR' ? 'Aucun service / Enseignant-chercheur' : 'Université de Kindia');
    const finalPhone = applicant_phone || user.phone || 'Non renseigné';
    const finalEmail = applicant_email || user.email;

    const scService = await db.get('SELECT id, name FROM services WHERE code = "SC" LIMIT 1');
    const destServiceId = scService ? scService.id : 5;
    const destServiceName = scService ? scService.name : 'Secrétariat Central';

    const reference = await generateReference('DMO');
    const trackingToken = require('crypto').randomBytes(16).toString('hex');
    const initialStatus = 'EN_ATTENTE_SC';

    const result = await db.run(
      `INSERT INTO mission_order_requests (
        reference, tracking_token, user_id, destination_service_id, destination_service_name,
        applicant_last_name, applicant_first_names, applicant_function, applicant_matricule,
        applicant_service_name, applicant_phone, applicant_email, applicant_institution,
        object_of_mission, destination, country, exact_location,
        start_date, end_date, duration_days, transport_means,
        justification_motif, host_organization, local_contact, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        trackingToken,
        user.id,
        destServiceId,
        destServiceName,
        finalLastName.trim(),
        finalFirstNames.trim(),
        finalFunction.trim(),
        finalMatricule ? finalMatricule.trim() : null,
        finalService.trim(),
        finalPhone.trim(),
        finalEmail.trim(),
        applicant_institution ? applicant_institution.trim() : 'Université de Kindia',
        object_of_mission.trim(),
        destination.trim(),
        country ? country.trim() : 'Guinée',
        exact_location ? exact_location.trim() : null,
        start_date,
        end_date,
        duration_days || null,
        transport_means || 'VÉHICULE OFFICIEL',
        justification_motif || null,
        host_organization || null,
        local_contact || null,
        initialStatus
      ]
    );

    const requestId = result.lastID;

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await db.run(
          `INSERT INTO mission_order_request_attachments (request_id, file_name, file_path, file_size, mime_type)
           VALUES (?, ?, ?, ?, ?)`,
          [requestId, file.originalname, file.path, file.size, file.mimetype]
        );
      }
    }

    await logRequestHistory(
      requestId,
      user.id,
      user.role_name,
      'SUBMIT_REQUEST',
      null,
      initialStatus,
      `Demande d'ordre de mission soumise par ${user.first_name} ${user.last_name} (${reference}) et transmise au Secrétariat Central.`
    );

    await notifySecretariatCentral(
      `Nouvelle demande d'ordre de mission (${reference})`,
      `Demande reçue de ${finalFirstNames} ${finalLastName} (${finalFunction}) pour "${destination.trim()}".`,
      requestId
    );

    await logAuditAction(user.id, 'CREATE_MISSION_REQUEST', 'MISSION_REQUEST', requestId, req, {
      reference,
      applicant: `${finalFirstNames} ${finalLastName}`,
      destination_service_id: destServiceId
    });

    res.status(201).json({
      success: true,
      message: 'Votre demande d’ordre de mission a été enregistrée avec succès et transmise au Secrétariat Central.',
      id: requestId,
      reference,
      tracking_token: trackingToken,
      status: initialStatus,
      destination_service_name: destServiceName
    });
  } catch (err) {
    console.error('Connected mission request submit error:', err);
    res.status(500).json({ error: 'Erreur lors de la soumission de la demande.' });
  }
});

// 4. GET /api/mission-requests - List all requests (Secrétariat Central / Admin)
router.get('/', authenticateToken, requireCentralAdminOrSC, async (req, res) => {
  const { status, search } = req.query;

  try {
    let query = `
      SELECT r.*, 
             doc.reference as official_doc_reference, doc.status as official_doc_status,
             (SELECT COUNT(*) FROM mission_order_request_attachments att WHERE att.request_id = r.id) as attachments_count
      FROM mission_order_requests r
      LEFT JOIN documents doc ON r.official_document_id = doc.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND r.status = ?`;
      params.push(status);
    }
    if (search) {
      query += ` AND (r.applicant_last_name LIKE ? OR r.applicant_first_names LIKE ? OR r.reference LIKE ? OR r.destination LIKE ? OR r.object_of_mission LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    query += ` ORDER BY r.created_at DESC`;

    const records = await db.all(query, params);
    res.json(records);
  } catch (err) {
    console.error('Fetch mission requests error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement des demandes d’ordre de mission.' });
  }
});

// 5. GET /api/mission-requests/:id - Single request detail with attachments & history
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const request = await db.get(
      `SELECT r.*, doc.reference as official_doc_reference, doc.status as official_doc_status
       FROM mission_order_requests r
       LEFT JOIN documents doc ON r.official_document_id = doc.id
       WHERE r.id = ?`,
      [id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Demande d’ordre de mission introuvable.' });
    }

    const attachments = await db.all('SELECT * FROM mission_order_request_attachments WHERE request_id = ?', [id]);
    const history = await db.all('SELECT * FROM mission_order_request_history WHERE request_id = ? ORDER BY timestamp ASC', [id]);

    res.json({
      ...request,
      attachments,
      history
    });
  } catch (err) {
    console.error('Fetch single mission request error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de la demande.' });
  }
});

// 6. POST /api/mission-requests/:id/request-complement - SC requests complement
router.post('/:id/request-complement', authenticateToken, requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;
  const { complement_request_notes } = req.body;

  if (!complement_request_notes || !complement_request_notes.trim()) {
    return res.status(400).json({ error: 'Les remarques/compléments demandés sont obligatoires.' });
  }

  try {
    const request = await db.get('SELECT * FROM mission_order_requests WHERE id = ?', [id]);
    if (!request) return res.status(404).json({ error: 'Demande introuvable.' });

    const newStatus = 'INFORMATIONS COMPLÉMENTAIRES DEMANDÉES';

    await db.run(
      `UPDATE mission_order_requests 
       SET status = ?, complement_request_notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, complement_request_notes.trim(), id]
    );

    await logRequestHistory(
      id,
      req.user.id,
      req.user.role_name,
      'REQUEST_COMPLEMENT',
      request.status,
      newStatus,
      `Secrétariat Central a demandé des compléments d'informations : ${complement_request_notes.trim()}`
    );

    res.json({ success: true, message: 'Demande de complément transmise au demandeur.', status: newStatus });
  } catch (err) {
    console.error('Request complement error:', err);
    res.status(500).json({ error: 'Erreur lors de la demande de complément.' });
  }
});

// 7. POST /api/mission-requests/:id/accept - SC accepts request
router.post('/:id/accept', authenticateToken, requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;

  try {
    const request = await db.get('SELECT * FROM mission_order_requests WHERE id = ?', [id]);
    if (!request) return res.status(404).json({ error: 'Demande introuvable.' });

    const newStatus = 'DEMANDE ACCEPTÉE';

    await db.run(
      `UPDATE mission_order_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStatus, id]
    );

    await logRequestHistory(
      id,
      req.user.id,
      req.user.role_name,
      'ACCEPT_REQUEST',
      request.status,
      newStatus,
      'Demande acceptée par le Secrétariat Central. Prête pour préparation de l’ordre de mission officiel.'
    );

    res.json({ success: true, message: 'Demande d’ordre de mission acceptée par le Secrétariat Central.', status: newStatus });
  } catch (err) {
    console.error('Accept request error:', err);
    res.status(500).json({ error: 'Erreur lors de l’acceptation de la demande.' });
  }
});

// 8. POST /api/mission-requests/:id/reject - SC rejects request with motif
router.post('/:id/reject', authenticateToken, requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;
  const { rejection_reason } = req.body;

  if (!rejection_reason || !rejection_reason.trim()) {
    return res.status(400).json({ error: 'Le motif de rejet est obligatoire.' });
  }

  try {
    const request = await db.get('SELECT * FROM mission_order_requests WHERE id = ?', [id]);
    if (!request) return res.status(404).json({ error: 'Demande introuvable.' });

    const newStatus = 'REJETÉ';

    await db.run(
      `UPDATE mission_order_requests SET status = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStatus, rejection_reason.trim(), id]
    );

    await logRequestHistory(
      id,
      req.user.id,
      req.user.role_name,
      'REJECT_REQUEST',
      request.status,
      newStatus,
      `Demande rejetée par le Secrétariat Central. Motif : ${rejection_reason.trim()}`
    );

    res.json({ success: true, message: 'Demande rejetée.', status: newStatus });
  } catch (err) {
    console.error('Reject request error:', err);
    res.status(500).json({ error: 'Erreur lors du rejet de la demande.' });
  }
});

// 9. POST /api/mission-requests/:id/generate-official-om - SC prepares Official Mission Order
router.post('/:id/generate-official-om', authenticateToken, requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;

  try {
    const request = await db.get('SELECT * FROM mission_order_requests WHERE id = ?', [id]);
    if (!request) return res.status(404).json({ error: 'Demande introuvable.' });

    // Generate official OM reference
    const officialRef = await generateReference('MISSION_ORDER');
    const trackingToken = require('crypto').randomBytes(16).toString('hex');

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : req.user.service_id;

    // Create official document in GED documents table
    const docRes = await db.run(
      `INSERT INTO documents (
        reference, tracking_token, document_type, title, description, sender_name, sender_organization,
        status, current_service_id, current_user_id, created_by
      ) VALUES (?, ?, 'MISSION_ORDER', ?, ?, ?, ?, 'DRAFT', ?, NULL, ?)`,
      [
        officialRef,
        trackingToken,
        `Ordre de mission : ${request.applicant_first_names} ${request.applicant_last_name}`,
        request.object_of_mission,
        `${request.applicant_first_names} ${request.applicant_last_name}`,
        request.applicant_service_name,
        scServiceId,
        req.user.id
      ]
    );

    const docId = docRes.lastID;

    // Populate mission_orders table extension
    await db.run(
      `INSERT INTO mission_orders (
        document_id, missionary_name, nationality, function_title,
        destination, object_of_mission, transport_mode, departure_date, return_date
      ) VALUES (?, ?, 'Guinéenne', ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        `${request.applicant_first_names} ${request.applicant_last_name}`,
        request.applicant_function,
        request.destination,
        request.object_of_mission,
        request.transport_means || 'VÉHICULE OFFICIEL',
        request.start_date,
        request.end_date
      ]
    );

    const newStatus = 'ORDRE DE MISSION EN PRÉPARATION';

    await db.run(
      `UPDATE mission_order_requests 
       SET status = ?, official_document_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, docId, id]
    );

    await logRequestHistory(
      id,
      req.user.id,
      req.user.role_name,
      'PREPARE_OFFICIAL_OM',
      request.status,
      newStatus,
      `Ordre de mission officiel préparé par le Secrétariat Central (Réf Officielle: ${officialRef}).`
    );

    res.json({
      success: true,
      message: 'Ordre de mission officiel préparé avec succès.',
      official_document_id: docId,
      official_reference: officialRef,
      status: newStatus
    });
  } catch (err) {
    console.error('Generate official OM error:', err);
    res.status(500).json({ error: 'Erreur lors de la préparation de l’ordre de mission officiel.' });
  }
});

// 10. POST /api/mission-requests/:id/transmit-to-sg - Transmit official OM to SG
router.post('/:id/transmit-to-sg', authenticateToken, requireCentralAdminOrSC, async (req, res) => {
  const { id } = req.params;

  try {
    const request = await db.get('SELECT * FROM mission_order_requests WHERE id = ?', [id]);
    if (!request) return res.status(404).json({ error: 'Demande introuvable.' });

    if (!request.official_document_id) {
      return res.status(400).json({ error: 'Veuillez préparer l’ordre de mission officiel avant de le transmettre au Secrétaire Général.' });
    }

    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    if (!sgService) return res.status(500).json({ error: 'Service Secrétaire Général introuvable.' });

    const newStatus = 'EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL';

    // Update document status & current_service_id in GED
    await db.run(
      `UPDATE documents SET current_service_id = ?, status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [sgService.id, request.official_document_id]
    );

    // Update request status
    await db.run(
      `UPDATE mission_order_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStatus, id]
    );

    await logRequestHistory(
      id,
      req.user.id,
      req.user.role_name,
      'TRANSMIT_TO_SG',
      request.status,
      newStatus,
      'Ordre de mission officiel transmis au Secrétaire Général pour signature électronique.'
    );

    res.json({
      success: true,
      message: 'Ordre de mission transmis au Secrétaire Général avec succès.',
      status: newStatus
    });
  } catch (err) {
    console.error('Transmit to SG error:', err);
    res.status(500).json({ error: 'Erreur lors de la transmission au Secrétaire Général.' });
  }
});

module.exports = router;
