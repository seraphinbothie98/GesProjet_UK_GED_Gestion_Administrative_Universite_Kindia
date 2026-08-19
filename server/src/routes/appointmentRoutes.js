const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { generateReference } = require('../services/numberGenerator');
const { generateQRCodeDataURL } = require('../services/qrService');

// Helper to compute end time from start_time (HH:MM) and duration (minutes)
function computeEndTime(startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + parseInt(durationMinutes, 10);
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// Helper to create persistent in-app notifications
async function notifyAppointmentUser(userId, appointmentId, title, message, type = 'INFO') {
  if (!userId) return;
  try {
    await db.run(
      `INSERT INTO notifications (user_id, document_id, appointment_id, title, message, type)
       VALUES (?, NULL, ?, ?, ?, ?)`,
      [userId, appointmentId || null, title, message, type]
    );
  } catch (err) {
    console.error('Failed to create appointment notification:', err);
  }
}

// Helper to check time overlaps
async function checkScheduleConflict(responsibleId, date, startTime, endTime, excludeAppointmentId = null) {
  // Check global setting for simultaneous appointments
  const setting = await db.get('SELECT value FROM appointment_settings WHERE key = "allow_simultaneous_appointments"');
  if (setting && setting.value === 'true') {
    return false; // Conflicts allowed by config
  }

  let query = `
    SELECT id, reference, requested_start_time, requested_end_time 
    FROM appointments
    WHERE responsible_id = ?
      AND requested_date = ?
      AND status IN ('ACCEPTE', 'CONFIRME', 'EN_COURS')
      AND (
        (requested_start_time < ? AND requested_end_time > ?)
      )
  `;
  const params = [responsibleId, date, endTime, startTime];

  if (excludeAppointmentId) {
    query += ` AND id != ?`;
    params.push(excludeAppointmentId);
  }

  const conflict = await db.get(query, params);
  return !!conflict;
}

/**
  * 1. GET /api/appointments/responsibles
  * Get list of users allowed to receive appointments
  */
router.get('/responsibles', authenticateToken, async (req, res) => {
  try {
    const users = await db.all(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.function_title, 
              s.name as service_name, s.code as service_code, r.name as role_name, r.code as role_code,
              u.can_receive_appointments
       FROM users u
       JOIN services s ON u.service_id = s.id
       JOIN roles r ON u.role_id = r.id
       WHERE u.status = 'ACTIVE' AND (u.can_receive_appointments = 1 OR r.code IN ('RECTEUR', 'SECRÉTAIRE_GÉNÉRAL', 'CHEF_SERVICE', 'RESPONSABLE_ADMINISTRATIF'))
       ORDER BY r.id ASC, u.last_name ASC`
    );
    res.json(users);
  } catch (err) {
    console.error('Error fetching responsibles:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des responsables.' });
  }
});

/**
  * 2. GET /api/appointments/verify-document/:reference
  * Verify existence of UK-GED document reference without bypassing ABAC access controls
  */
router.get('/verify-document/:reference', authenticateToken, async (req, res) => {
  try {
    const ref = decodeURIComponent(req.params.reference).trim();
    const doc = await db.get('SELECT id, reference, title, document_type, confidentiality FROM documents WHERE reference = ?', [ref]);
    
    if (!doc) {
      return res.status(404).json({ exists: false, error: 'Document non trouvé dans la GED.' });
    }

    res.json({
      exists: true,
      document: {
        id: doc.id,
        reference: doc.reference,
        title: doc.title,
        document_type: doc.document_type
      }
    });
  } catch (err) {
    console.error('Error verifying document:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification du document.' });
  }
});

/**
 * Public GET /api/appointments/public/responsibles
 * Public list of responsibles for appointment booking from landing page
 */
router.get('/public/responsibles', async (req, res) => {
  try {
    const users = await db.all(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.function_title, 
              s.name as service_name, s.code as service_code, r.name as role_name, r.code as role_code,
              u.can_receive_appointments
       FROM users u
       JOIN services s ON u.service_id = s.id
       JOIN roles r ON u.role_id = r.id
       WHERE u.status = 'ACTIVE' AND (u.can_receive_appointments = 1 OR r.code IN ('RECTEUR', 'SECRÉTAIRE_GÉNÉRAL', 'CHEF_SERVICE', 'RESPONSABLE_ADMINISTRATIF'))
       ORDER BY r.id ASC, u.last_name ASC`
    );
    res.json(users);
  } catch (err) {
    console.error('Error fetching public responsibles:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des responsables.' });
  }
});

/**
 * Public POST /api/appointments/public
 * Public appointment creation endpoint for unauthenticated visitors
 */
router.post('/public', async (req, res) => {
  try {
    const {
      requester_first_name,
      requester_last_name,
      requester_email,
      requester_phone,
      requester_organization,
      responsible_id,
      motif,
      subject,
      requested_date,
      requested_start_time,
      duration = 30,
      mode = 'PRESENTIEL',
      location = 'Bureau du Responsable',
      document_reference_input
    } = req.body;

    if (!requester_first_name || !requester_last_name || !requester_email || !requester_phone || !responsible_id || !motif || !subject || !requested_date || !requested_start_time) {
      return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires (*).' });
    }

    const endTime = computeEndTime(requested_start_time, duration);
    const hasConflict = await checkScheduleConflict(responsible_id, requested_date, requested_start_time, endTime);
    if (hasConflict) {
      return res.status(409).json({ error: "⚠️ Ce créneau n'est pas disponible. Veuillez choisir un autre horaire." });
    }

    let linkedDocId = null;
    if (document_reference_input && document_reference_input.trim()) {
      const doc = await db.get('SELECT id FROM documents WHERE reference = ?', [document_reference_input.trim()]);
      if (doc) linkedDocId = doc.id;
    }

    const reference = await generateReference('RDV');
    const trackingToken = 'RDV-TOK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    let qrCodeHash = null;
    try {
      if (typeof generateQRCodeDataURL === 'function') {
        qrCodeHash = await generateQRCodeDataURL(`RDV:${reference}:${trackingToken}`);
      }
    } catch (e) {
      console.warn('QR Code generation warning:', e.message);
    }

    // Auto-link registered user account if email matches
    let linkedRequesterId = null;
    const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = ?', [requester_email.trim().toLowerCase()]);
    if (existingUser) {
      linkedRequesterId = existingUser.id;
    }

    const result = await db.run(
      `INSERT INTO appointments (
        reference, tracking_token, requester_id, requester_first_name, requester_last_name, 
        requester_email, requester_phone, requester_organization, responsible_id, 
        document_id, document_reference_input, motif, subject, requested_date, 
        requested_start_time, requested_end_time, duration, mode, location, 
        status, qr_code_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?)`,
      [
        reference, trackingToken, linkedRequesterId, requester_first_name.trim(), requester_last_name.trim(),
        requester_email.trim(), requester_phone.trim(), requester_organization || 'Visiteur Extérieur', responsible_id,
        linkedDocId, document_reference_input || null, motif.trim(), subject.trim(), requested_date,
        requested_start_time, endTime, duration, mode, location || 'Secrétariat Général', qrCodeHash
      ]
    );

    const appointmentId = result.lastID;

    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, new_status, comment)
       VALUES (?, ?, 'CREATED', 'EN_ATTENTE', 'Demande de rendez-vous en ligne créée par le visiteur public')`,
      [appointmentId, linkedRequesterId]
    );

    // Notify responsible user
    await notifyAppointmentUser(
      responsible_id,
      appointmentId,
      '🔔 Nouvelle demande de rendez-vous',
      `Demande publique reçue de ${requester_first_name} ${requester_last_name} pour le ${requested_date} à ${requested_start_time}.\nObjet : ${subject}`,
      'ACTION_REQUIRED'
    );

    res.status(201).json({
      success: true,
      message: `Votre demande de rendez-vous [${reference}] a été transmise avec succès.`,
      reference,
      tracking_token: trackingToken,
      id: appointmentId
    });
  } catch (err) {
    console.error('Create public appointment error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du rendez-vous.' });
  }
});

/**
  * 3. POST /api/appointments
  * Create a new appointment request (Authenticated)
  */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      requester_first_name,
      requester_last_name,
      requester_email,
      requester_phone,
      requester_organization,
      responsible_id,
      motif,
      subject,
      requested_date,
      requested_start_time,
      duration = 30,
      mode = 'PRESENTIEL',
      location = 'Bureau du Responsable',
      document_reference_input
    } = req.body;

    // Mandatory fields validation
    if (!requester_first_name || !requester_last_name || !requester_email || !requester_phone || !responsible_id || !motif || !subject || !requested_date || !requested_start_time) {
      return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires (*).' });
    }

    const endTime = computeEndTime(requested_start_time, duration);

    // Check for conflicts
    const hasConflict = await checkScheduleConflict(responsible_id, requested_date, requested_start_time, endTime);
    if (hasConflict) {
      return res.status(409).json({ error: "⚠️ Ce créneau n'est pas disponible. Veuillez choisir un autre horaire." });
    }

    // Verify linked document if reference provided
    let linkedDocId = null;
    if (document_reference_input && document_reference_input.trim()) {
      const doc = await db.get('SELECT id FROM documents WHERE reference = ?', [document_reference_input.trim()]);
      if (doc) {
        linkedDocId = doc.id;
      }
    }

    // Generate reference & tracking token
    const reference = await generateReference('RDV');
    const trackingToken = 'RDV-TOK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    let qrCodeHash = null;
    try {
      if (typeof generateQRCodeDataURL === 'function') {
        qrCodeHash = await generateQRCodeDataURL(`RDV:${reference}:${trackingToken}`);
      }
    } catch (e) {
      console.warn('QR Code generation warning:', e.message);
    }

    const result = await db.run(
      `INSERT INTO appointments (
        reference, tracking_token, requester_id, requester_first_name, requester_last_name, 
        requester_email, requester_phone, requester_organization, responsible_id, 
        document_id, document_reference_input, motif, subject, requested_date, 
        requested_start_time, requested_end_time, duration, mode, location, 
        status, qr_code_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?)`,
      [
        reference, trackingToken, req.user ? req.user.id : null, requester_first_name, requester_last_name,
        requester_email, requester_phone, requester_organization || 'Université de Kindia', responsible_id,
        linkedDocId, document_reference_input || null, motif, subject, requested_date,
        requested_start_time, endTime, duration, mode, location, qrCodeHash
      ]
    );

    const appointmentId = result.lastID;

    // Add history entry
    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, new_status, comment)
       VALUES (?, ?, 'CREATED', 'EN_ATTENTE', 'Demande de rendez-vous créée par le demandeur')`,
      [appointmentId, req.user.id]
    );

    // Create notification for responsible user
    await notifyAppointmentUser(
      responsible_id,
      appointmentId,
      '🔔 Nouvelle demande de rendez-vous',
      `Demandeur : ${requester_first_name} ${requester_last_name}\nObjet : ${subject}\nDate souhaitée : ${requested_date} à ${requested_start_time}`,
      'ACTION_REQUIRED'
    );

    // Audit log
    await logAuditAction(req.user.id, 'APPOINTMENT_CREATED', 'APPOINTMENT', appointmentId, req, { reference, responsible_id });

    const newAppointment = await db.get('SELECT * FROM appointments WHERE id = ?', [appointmentId]);
    res.status(201).json({
      message: 'Demande de rendez-vous transmise avec succès.',
      appointment: newAppointment
    });

  } catch (err) {
    console.error('Error creating appointment:', err);
    res.status(500).json({ error: 'Erreur lors de la création du rendez-vous.' });
  }
});

/**
  * 4. GET /api/appointments
  * List appointments according to user permissions and view mode
  */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { mode = 'all', status, date } = req.query;
    const user = req.user;

    let sql = `
      SELECT a.*, 
             u_resp.first_name as resp_first_name, u_resp.last_name as resp_last_name, u_resp.function_title as resp_function,
             s_resp.name as resp_service_name,
             u_req.first_name as req_user_first_name, u_req.last_name as req_user_last_name
      FROM appointments a
      LEFT JOIN users u_resp ON a.responsible_id = u_resp.id
      LEFT JOIN services s_resp ON u_resp.service_id = s_resp.id
      LEFT JOIN users u_req ON a.requester_id = u_req.id
      WHERE 1=1
    `;
    const params = [];

    // Filter by role / access scope
    if (user.role_code === 'ADMINISTRATEUR') {
      // Admin sees all, or can filter by mode
      if (mode === 'received') {
        sql += ` AND a.responsible_id = ?`;
        params.push(user.id);
      } else if (mode === 'my_requests') {
        sql += ` AND a.requester_id = ?`;
        params.push(user.id);
      }
    } else {
      if (mode === 'received') {
        sql += ` AND a.responsible_id = ?`;
        params.push(user.id);
      } else if (mode === 'my_requests') {
        sql += ` AND (a.requester_id = ? OR a.requester_email = ?)`;
        params.push(user.id, user.email);
      } else {
        // Default: see items where user is responsible or requester or central secretariat check-in staff
        if (user.permissions.includes('appointments.check_in') || user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL') {
          // Central secretariat can see all appointments for reception/check-in
        } else {
          sql += ` AND (a.responsible_id = ? OR a.requester_id = ? OR a.requester_email = ?)`;
          params.push(user.id, user.id, user.email);
        }
      }
    }

    if (status) {
      sql += ` AND a.status = ?`;
      params.push(status);
    }

    if (date) {
      sql += ` AND a.requested_date = ?`;
      params.push(date);
    }

    sql += ` ORDER BY a.requested_date DESC, a.requested_start_time DESC`;

    const appointments = await db.all(sql, params);
    res.json(appointments);

  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des rendez-vous.' });
  }
});

/**
  * 5. GET /api/appointments/calendar
  * Calendar feed for day/week/month views
  */
router.get('/calendar', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, responsible_id } = req.query;
    const user = req.user;

    const targetRespId = responsible_id || user.id;

    let appSql = `
      SELECT a.id, a.reference, a.subject, a.requested_date, a.requested_start_time, a.requested_end_time,
             a.status, a.mode, a.location, a.requester_first_name, a.requester_last_name, a.requester_organization,
             u_resp.first_name as resp_first_name, u_resp.last_name as resp_last_name
      FROM appointments a
      JOIN users u_resp ON a.responsible_id = u_resp.id
      WHERE (a.responsible_id = ? OR a.requester_id = ? OR ? = 'ADMINISTRATEUR')
    `;
    const appParams = [targetRespId, user.id, user.role_code];

    if (start_date) {
      appSql += ` AND a.requested_date >= ?`;
      appParams.push(start_date);
    }

    if (end_date) {
      appSql += ` AND a.requested_date <= ?`;
      appParams.push(end_date);
    }

    const appointments = await db.all(appSql, appParams);

    // Fetch calendar blocks (indisponibilités / congés)
    let blockSql = `SELECT * FROM calendar_blocks WHERE (user_id IS NULL OR user_id = ?)`;
    const blockParams = [targetRespId];
    const blocks = await db.all(blockSql, blockParams);

    res.json({
      appointments,
      blocks
    });
  } catch (err) {
    console.error('Error fetching calendar data:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de l’agenda.' });
  }
});

/**
  * 6. GET /api/appointments/stats
  * Appointment KPI metrics
  */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const isResp = user.can_receive_appointments || ['RECTEUR', 'SECRÉTAIRE_GÉNÉRAL', 'CHEF_SERVICE', 'RESPONSABLE_ADMINISTRATIF'].includes(user.role_code);

    let whereClause = '';
    let params = [];

    if (user.role_code !== 'ADMINISTRATEUR') {
      if (isResp) {
        whereClause = ' WHERE responsible_id = ?';
        params = [user.id];
      } else {
        whereClause = ' WHERE requester_id = ? OR requester_email = ?';
        params = [user.id, user.email];
      }
    }

    const total = await db.get(`SELECT COUNT(*) as count FROM appointments ${whereClause}`, params);
    const pending = await db.get(`SELECT COUNT(*) as count FROM appointments ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'EN_ATTENTE'`, params);
    const confirmed = await db.get(`SELECT COUNT(*) as count FROM appointments ${whereClause ? whereClause + ' AND' : 'WHERE'} status IN ('CONFIRME', 'ACCEPTE')`, params);
    const refused = await db.get(`SELECT COUNT(*) as count FROM appointments ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'REFUSE'`, params);
    const cancelled = await db.get(`SELECT COUNT(*) as count FROM appointments ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'ANNULE'`, params);
    const completed = await db.get(`SELECT COUNT(*) as count FROM appointments ${whereClause ? whereClause + ' AND' : 'WHERE'} status = 'TERMINE'`, params);

    // Today's appointments count
    const todayStr = new Date().toISOString().split('T')[0];
    const todayCount = await db.get(`SELECT COUNT(*) as count FROM appointments ${whereClause ? whereClause + ' AND' : 'WHERE'} requested_date = ?`, [...params, todayStr]);

    res.json({
      total: total ? total.count : 0,
      pending: pending ? pending.count : 0,
      confirmed: confirmed ? confirmed.count : 0,
      refused: refused ? refused.count : 0,
      cancelled: cancelled ? cancelled.count : 0,
      completed: completed ? completed.count : 0,
      today: todayCount ? todayCount.count : 0
    });

  } catch (err) {
    console.error('Error fetching appointment stats:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques.' });
  }
});

/**
  * 7. GET /api/appointments/:id
  * Get detailed appointment view with history
  */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await db.get(
      `SELECT a.*, 
              u_resp.first_name as resp_first_name, u_resp.last_name as resp_last_name, u_resp.function_title as resp_function,
              u_resp.email as resp_email, u_resp.phone as resp_phone, s_resp.name as resp_service_name,
              d.reference as doc_reference, d.title as doc_title
       FROM appointments a
       LEFT JOIN users u_resp ON a.responsible_id = u_resp.id
       LEFT JOIN services s_resp ON u_resp.service_id = s_resp.id
       LEFT JOIN documents d ON a.document_id = d.id
       WHERE a.id = ?`,
      [id]
    );

    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    }

    // Security check: User must be requester, responsible, admin, or secretariat
    const user = req.user;
    const isAllowed = user.role_code === 'ADMINISTRATEUR' ||
                      appointment.responsible_id === user.id ||
                      appointment.requester_id === user.id ||
                      appointment.requester_email === user.email ||
                      user.permissions.includes('appointments.check_in');

    if (!isAllowed) {
      return res.status(403).json({ error: 'Accès non autorisé à ce rendez-vous.' });
    }

    // Fetch timeline history
    const history = await db.all(
      `SELECT h.*, u.first_name, u.last_name, u.function_title
       FROM appointment_history h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.appointment_id = ?
       ORDER BY h.created_at ASC`,
      [id]
    );

    res.json({
      ...appointment,
      history
    });

  } catch (err) {
    console.error('Error fetching appointment detail:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails.' });
  }
});

/**
  * 8. POST /api/appointments/:id/accept
  * Responsible accepts the appointment
  */
router.post('/:id/accept', authenticateToken, requirePermission('appointments.accept'), async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);

    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    }

    // Check ownership/permission
    if (req.user.role_code !== 'ADMINISTRATEUR' && appointment.responsible_id !== req.user.id) {
      return res.status(403).json({ error: 'Seul le responsable désigné peut accepter ce rendez-vous.' });
    }

    const oldStatus = appointment.status;
    const newStatus = 'ACCEPTE'; // Accepted & Confirmed

    await db.run(
      `UPDATE appointments 
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, id]
    );

    // Fetch responsible details for notification template
    const resp = await db.get(
      `SELECT u.first_name, u.last_name, u.function_title, s.name as service_name
       FROM users u
       LEFT JOIN services s ON u.service_id = s.id
       WHERE u.id = ?`,
      [appointment.responsible_id]
    );

    const respLabel = resp 
      ? `${resp.first_name} ${resp.last_name} (${resp.function_title || resp.service_name || 'Direction'})`
      : 'le Responsable';

    const locationLabel = appointment.location || (resp?.service_name || 'Secrétariat Général');

    // Log history
    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
       VALUES (?, ?, 'ACCEPTED', ?, ?, 'Demande de rendez-vous acceptée par le responsable')`,
      [id, req.user.id, oldStatus, newStatus]
    );

    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
       VALUES (?, ?, 'NOTIFICATION_SENT', ?, ?, 'Notification envoyée au demandeur')`,
      [id, req.user.id, oldStatus, newStatus]
    );

    // Notify requester
    if (appointment.requester_id) {
      await notifyAppointmentUser(
        appointment.requester_id,
        id,
        '🔔 Rendez-vous accepté',
        `Votre demande de rendez-vous avec ${respLabel} a été acceptée.\n\nDate : ${appointment.requested_date}\nHeure : ${appointment.requested_start_time}\nLieu : ${locationLabel}\n\nMerci de vous présenter à l'heure indiquée.`,
        'INFO'
      );
    }

    await logAuditAction(req.user.id, 'APPOINTMENT_ACCEPTED', 'APPOINTMENT', id, req, { oldStatus, newStatus });

    res.json({ message: 'Rendez-vous accepté et confirmé avec succès.', status: newStatus });

  } catch (err) {
    console.error('Error accepting appointment:', err);
    res.status(500).json({ error: 'Erreur lors de l’acceptation du rendez-vous.' });
  }
});

/**
  * 9. POST /api/appointments/:id/reject
  * Responsible refuses the appointment with mandatory reason
  */
router.post('/:id/reject', authenticateToken, requirePermission('appointments.reject'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason, is_reason_private = false } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({ error: 'Le motif de refus est obligatoire.' });
    }

    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    }

    if (req.user.role_code !== 'ADMINISTRATEUR' && appointment.responsible_id !== req.user.id) {
      return res.status(403).json({ error: 'Seul le responsable désigné peut refuser ce rendez-vous.' });
    }

    const oldStatus = appointment.status;
    const newStatus = 'REFUSE';

    await db.run(
      `UPDATE appointments 
       SET status = ?, rejection_reason = ?, is_reason_private = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, rejection_reason.trim(), is_reason_private ? 1 : 0, id]
    );

    // History log
    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
       VALUES (?, ?, 'REJECTED', ?, ?, ?)`,
      [id, req.user.id, oldStatus, newStatus, `Refusé : ${rejection_reason.trim()}`]
    );

    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
       VALUES (?, ?, 'NOTIFICATION_SENT', ?, ?, 'Notification de refus envoyée au demandeur')`,
      [id, req.user.id, oldStatus, newStatus]
    );

    // Notify requester
    if (appointment.requester_id) {
      const displayMotif = is_reason_private ? 'Motif administratif restreint.' : rejection_reason.trim();
      await notifyAppointmentUser(
        appointment.requester_id,
        id,
        '🔔 Rendez-vous refusé',
        `Votre demande de rendez-vous du ${appointment.requested_date} à ${appointment.requested_start_time} a été refusée.\n\nMotif : ${displayMotif}`,
        'INFO'
      );
    }

    await logAuditAction(req.user.id, 'APPOINTMENT_REJECTED', 'APPOINTMENT', id, req, { oldStatus, newStatus, rejection_reason });

    res.json({ message: 'Rendez-vous refusé.', status: newStatus });

  } catch (err) {
    console.error('Error rejecting appointment:', err);
    res.status(500).json({ error: 'Erreur lors du refus du rendez-vous.' });
  }
});

/**
  * 10. POST /api/appointments/:id/reschedule
  * Responsible proposes another date
  */
router.post('/:id/reschedule', authenticateToken, requirePermission('appointments.reschedule'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reschedule_date, reschedule_start_time, duration = 30, reschedule_message } = req.body;

    if (!reschedule_date || !reschedule_start_time) {
      return res.status(400).json({ error: 'La nouvelle date et l’heure souhaitée sont obligatoires.' });
    }

    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    }

    if (req.user.role_code !== 'ADMINISTRATEUR' && appointment.responsible_id !== req.user.id) {
      return res.status(403).json({ error: 'Seul le responsable désigné peut proposer une autre date.' });
    }

    const rescheduleEndTime = computeEndTime(reschedule_start_time, duration);

    // Check conflicts for new slot
    const hasConflict = await checkScheduleConflict(appointment.responsible_id, reschedule_date, reschedule_start_time, rescheduleEndTime, id);
    if (hasConflict) {
      return res.status(409).json({ error: "⚠️ Ce nouveau créneau est déjà occupé par un autre rendez-vous." });
    }

    const oldStatus = appointment.status;
    const newStatus = 'REPROGRAMME';

    await db.run(
      `UPDATE appointments 
       SET status = ?, reschedule_proposed_by = ?, reschedule_date = ?, 
           reschedule_start_time = ?, reschedule_end_time = ?, reschedule_message = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, req.user.id, reschedule_date, reschedule_start_time, rescheduleEndTime, reschedule_message || null, id]
    );

    // History log
    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
       VALUES (?, ?, 'RESCHEDULED', ?, ?, ?)`,
      [id, req.user.id, oldStatus, newStatus, `Rendez-vous reprogrammé au : ${reschedule_date} à ${reschedule_start_time}`]
    );

    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
       VALUES (?, ?, 'NOTIFICATION_SENT', ?, ?, 'Notification de reprogrammation envoyée au demandeur')`,
      [id, req.user.id, oldStatus, newStatus]
    );

    // Notify requester
    if (appointment.requester_id) {
      await notifyAppointmentUser(
        appointment.requester_id,
        id,
        '🔔 Rendez-vous reprogrammé',
        `Votre demande de rendez-vous a été reprogrammée.\n\nNouvelle date : ${reschedule_date}\nHeure : ${reschedule_start_time}\nLieu : ${appointment.location || 'Secrétariat Général'}${reschedule_message ? '\n\nMessage : ' + reschedule_message.trim() : ''}`,
        'ACTION_REQUIRED'
      );
    }

    await logAuditAction(req.user.id, 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT', id, req, { reschedule_date, reschedule_start_time });

    res.json({ message: 'Rendez-vous reprogrammé et notification transmise au demandeur.', status: newStatus });

  } catch (err) {
    console.error('Error rescheduling appointment:', err);
    res.status(500).json({ error: 'Erreur lors de la proposition d’une nouvelle date.' });
  }
});

/**
  * 11. POST /api/appointments/:id/respond-reschedule
  * Requester accepts or refuses proposed date
  */
router.post('/:id/respond-reschedule', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'ACCEPT' or 'REJECT'

    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    }

    if (appointment.requester_id !== req.user.id && appointment.requester_email !== req.user.email) {
      return res.status(403).json({ error: 'Seul le demandeur peut répondre à cette proposition.' });
    }

    if (action === 'ACCEPT') {
      const newStatus = 'CONFIRME';
      await db.run(
        `UPDATE appointments 
         SET requested_date = reschedule_date,
             requested_start_time = reschedule_start_time,
             requested_end_time = reschedule_end_time,
             status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newStatus, id]
      );

      await db.run(
        `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
         VALUES (?, ?, 'CONFIRMED', ?, ?, 'Nouvelle date proposée acceptée par le demandeur')`,
        [id, req.user.id, appointment.status, newStatus]
      );

      // Notify responsible
      await db.run(
        `INSERT INTO notifications (user_id, title, message, type)
         VALUES (?, ?, ?, 'INFO')`,
        [
          appointment.responsible_id,
          '✅ Proposition de rendez-vous acceptée',
          `Le demandeur a accepté la nouvelle date du ${appointment.reschedule_date} à ${appointment.reschedule_start_time} pour le RDV ${appointment.reference}.`
        ]
      );

      await logAuditAction(req.user.id, 'APPOINTMENT_CONFIRMED', 'APPOINTMENT', id, req, {});
      return res.json({ message: 'Nouvelle date acceptée. Rendez-vous confirmé !', status: newStatus });

    } else {
      const newStatus = 'REFUSE';
      await db.run(
        `UPDATE appointments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newStatus, id]
      );

      await db.run(
        `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
         VALUES (?, ?, 'REJECTED', ?, ?, 'Proposition de nouvelle date refusée par le demandeur')`,
        [id, req.user.id, appointment.status, newStatus]
      );

      await logAuditAction(req.user.id, 'APPOINTMENT_REJECTED', 'APPOINTMENT', id, req, {});
      return res.json({ message: 'Proposition refusée.', status: newStatus });
    }

  } catch (err) {
    console.error('Error responding to reschedule:', err);
    res.status(500).json({ error: 'Erreur lors de la réponse.' });
  }
});

/**
  * 12. POST /api/appointments/:id/cancel
  * Requester or Responsible cancels appointment with reason
  */
router.post('/:id/cancel', authenticateToken, requirePermission('appointments.cancel'), async (req, res) => {
  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;

    if (!cancel_reason || !cancel_reason.trim()) {
      return res.status(400).json({ error: 'Le motif d’annulation est obligatoire.' });
    }

    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    }

    const isResp = appointment.responsible_id === req.user.id;
    const isReq = appointment.requester_id === req.user.id || appointment.requester_email === req.user.email;
    const isAdmin = req.user.role_code === 'ADMINISTRATEUR';

    if (!isResp && !isReq && !isAdmin) {
      return res.status(403).json({ error: 'Non autorisé à annuler ce rendez-vous.' });
    }

    const oldStatus = appointment.status;
    const newStatus = 'ANNULE';

    await db.run(
      `UPDATE appointments 
       SET status = ?, cancel_reason = ?, cancelled_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, cancel_reason.trim(), req.user.id, id]
    );

    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
       VALUES (?, ?, 'CANCELLED', ?, ?, ?)`,
      [id, req.user.id, oldStatus, newStatus, `Annulé : ${cancel_reason.trim()}`]
    );

    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
       VALUES (?, ?, 'NOTIFICATION_SENT', ?, ?, 'Notification d''annulation transmise')`,
      [id, req.user.id, oldStatus, newStatus]
    );

    // Notify opposite party
    const targetNotifyUserId = isResp ? appointment.requester_id : appointment.responsible_id;
    if (targetNotifyUserId) {
      await notifyAppointmentUser(
        targetNotifyUserId,
        id,
        '🔔 Rendez-vous annulé',
        `Le rendez-vous ref ${appointment.reference} du ${appointment.requested_date} a été annulé.\n\nMotif : ${cancel_reason.trim()}`,
        'INFO'
      );
    }

    await logAuditAction(req.user.id, 'APPOINTMENT_CANCELLED', 'APPOINTMENT', id, req, { cancel_reason });

    res.json({ message: 'Rendez-vous annulé avec succès.', status: newStatus });

  } catch (err) {
    console.error('Error cancelling appointment:', err);
    res.status(500).json({ error: 'Erreur lors de l’annulation.' });
  }
});

/**
  * 13. POST /api/appointments/:id/check-in
  * Mark requester arrived (Secrétariat / Reception scan QR)
  */
router.post('/:id/check-in', authenticateToken, requirePermission('appointments.check_in'), async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);

    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    }

    const oldStatus = appointment.status;
    const newStatus = 'EN_COURS'; // Arrivé / En cours

    await db.run(
      `UPDATE appointments 
       SET status = ?, checked_in_at = CURRENT_TIMESTAMP, checked_in_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, req.user.id, id]
    );

    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
       VALUES (?, ?, 'CHECKED_IN', ?, ?, 'Demandeur marqué comme ARRIVÉ par le secrétariat')`,
      [id, req.user.id, oldStatus, newStatus]
    );

    // Notify responsible user
    await db.run(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (?, ?, ?, 'ACTION_REQUIRED')`,
      [
        appointment.responsible_id,
        '🟢 DEMANDEUR ARRIVÉ',
        `Le demandeur ${appointment.requester_first_name} ${appointment.requester_last_name} pour le rendez-vous ref ${appointment.reference} est arrivé et vous attend au secrétariat.`
      ]
    );

    await logAuditAction(req.user.id, 'APPOINTMENT_CHECKED_IN', 'APPOINTMENT', id, req, {});

    res.json({ message: 'Demandeur marqué comme ARRIVÉ avec succès.', status: newStatus });

  } catch (err) {
    console.error('Error checking in appointment:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de l’arrivée.' });
  }
});

/**
  * 14. POST /api/appointments/:id/complete
  * Complete / close appointment
  */
router.post('/:id/complete', authenticateToken, requirePermission('appointments.complete'), async (req, res) => {
  try {
    const { id } = req.params;
    const { internal_note } = req.body;

    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', [id]);
    if (!appointment) {
      return res.status(404).json({ error: 'Rendez-vous introuvable.' });
    }

    const oldStatus = appointment.status;
    const newStatus = 'TERMINE';

    await db.run(
      `UPDATE appointments 
       SET status = ?, internal_note = ?, completed_at = CURRENT_TIMESTAMP, completed_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, internal_note || null, req.user.id, id]
    );

    await db.run(
      `INSERT INTO appointment_history (appointment_id, user_id, action, old_status, new_status, comment)
       VALUES (?, ?, 'COMPLETED', ?, ?, ?)`,
      [id, req.user.id, oldStatus, newStatus, `Rendez-vous clôturé${internal_note ? ' : ' + internal_note : ''}`]
    );

    await logAuditAction(req.user.id, 'APPOINTMENT_COMPLETED', 'APPOINTMENT', id, req, { internal_note });

    res.json({ message: 'Rendez-vous clôturé avec succès.', status: newStatus });

  } catch (err) {
    console.error('Error completing appointment:', err);
    res.status(500).json({ error: 'Erreur lors de la clôture.' });
  }
});

/**
  * 15. POST /api/appointments/scan-qr
  * Reception desk scans QR code or reference for check-in
  */
router.post('/scan-qr', authenticateToken, async (req, res) => {
  try {
    const { reference } = req.body;
    if (!reference) {
      return res.status(400).json({ error: 'Référence ou QR Code requis.' });
    }

    let cleanRef = reference.trim();
    if (cleanRef.startsWith('RDV:')) {
      cleanRef = cleanRef.split(':')[1];
    }

    const appointment = await db.get(
      `SELECT a.*, 
              u_resp.first_name as resp_first_name, u_resp.last_name as resp_last_name, u_resp.function_title as resp_function,
              s_resp.name as resp_service_name
       FROM appointments a
       LEFT JOIN users u_resp ON a.responsible_id = u_resp.id
       LEFT JOIN services s_resp ON u_resp.service_id = s_resp.id
       WHERE a.reference = ? OR a.tracking_token = ?`,
      [cleanRef, cleanRef]
    );

    if (!appointment) {
      return res.status(404).json({ error: 'Aucun rendez-vous trouvé avec cette référence.' });
    }

    res.json({
      found: true,
      appointment
    });
  } catch (err) {
    console.error('Error scanning QR:', err);
    res.status(500).json({ error: 'Erreur lors du scan du QR Code.' });
  }
});

/**
  * 16. GET & POST /api/appointments/availabilities
  * Manage recurring weekly slots
  */
router.get('/availabilities/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const slots = await db.all('SELECT * FROM appointment_availabilities WHERE user_id = ? ORDER BY day_of_week ASC, start_time ASC', [userId]);
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des créneaux.' });
  }
});

router.post('/availabilities', authenticateToken, requirePermission('appointments.manage_availability'), async (req, res) => {
  try {
    const { user_id, slots } = req.body; // Array of { day_of_week, start_time, end_time }
    const targetUserId = user_id || req.user.id;

    if (req.user.role_code !== 'ADMINISTRATEUR' && targetUserId !== req.user.id) {
      return res.status(403).json({ error: 'Non autorisé.' });
    }

    await db.run('DELETE FROM appointment_availabilities WHERE user_id = ?', [targetUserId]);

    for (const slot of slots) {
      await db.run(
        `INSERT INTO appointment_availabilities (user_id, day_of_week, start_time, end_time, is_available)
         VALUES (?, ?, ?, ?, 1)`,
        [targetUserId, slot.day_of_week, slot.start_time, slot.end_time]
      );
    }

    res.json({ message: 'Créneaux de disponibilité enregistrés.' });
  } catch (err) {
    console.error('Error updating availabilities:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des disponibilités.' });
  }
});

/**
  * 17. GET & POST /api/appointments/blocks
  * Manage calendar blockings (indisponibilités / congés)
  */
router.get('/blocks', authenticateToken, async (req, res) => {
  try {
    const blocks = await db.all(
      `SELECT b.*, u.first_name, u.last_name 
       FROM calendar_blocks b 
       LEFT JOIN users u ON b.user_id = u.id 
       ORDER BY b.start_datetime DESC`
    );
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des blocages.' });
  }
});

router.post('/blocks', authenticateToken, requirePermission('appointments.manage_calendar'), async (req, res) => {
  try {
    const { user_id, title, start_datetime, end_datetime, reason, type = 'CONGE' } = req.body;

    if (!title || !start_datetime || !end_datetime) {
      return res.status(400).json({ error: 'Titre, date de début et de fin obligatoires.' });
    }

    const result = await db.run(
      `INSERT INTO calendar_blocks (user_id, title, start_datetime, end_datetime, reason, type, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id || null, title, start_datetime, end_datetime, reason || null, type, req.user.id]
    );

    res.status(201).json({ message: 'Période d’indisponibilité bloquée.', blockId: result.lastID });
  } catch (err) {
    console.error('Error creating block:', err);
    res.status(500).json({ error: 'Erreur lors de la création du blocage.' });
  }
});

router.delete('/blocks/:id', authenticateToken, requirePermission('appointments.manage_calendar'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM calendar_blocks WHERE id = ?', [id]);
    res.json({ message: 'Blocage supprimé.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

module.exports = router;
