const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// Multer upload setup for action completion attachments
const uploadDir = path.join(__dirname, '../../uploads/dispatches');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `disp_att_${Date.now()}_${cleanName}${ext}`);
  }
});
const upload = multer({ storage });

// Helper to generate unique sequential dispatch reference: DSP-UK-YYYY-XXXXXX
async function generateDispatchReference() {
  const currentYear = new Date().getFullYear();
  const prefix = `DSP-UK-${currentYear}-`;
  
  const lastDispatch = await db.get(
    "SELECT reference FROM document_dispatches WHERE reference LIKE ? ORDER BY id DESC LIMIT 1",
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (lastDispatch && lastDispatch.reference) {
    const parts = lastDispatch.reference.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextNum = lastSeq + 1;
  }

  return `${prefix}${String(nextNum).padStart(6, '0')}`;
}

// Helper to recalculate overall dispatch status and counts
async function updateDispatchGlobalStatus(dispatchId) {
  const recipients = await db.all('SELECT * FROM dispatch_recipients WHERE dispatch_id = ?', [dispatchId]);
  if (!recipients || recipients.length === 0) return;

  const total = recipients.length;
  let ackCount = 0;
  let completedCount = 0;
  let hasPending = false;
  let hasLate = false;
  const now = new Date();

  const dispatch = await db.get('SELECT * FROM document_dispatches WHERE id = ?', [dispatchId]);
  const deadlineDate = dispatch.deadline ? new Date(dispatch.deadline) : null;

  for (const r of recipients) {
    if (r.status === 'PRISE_DE_CONNAISSANCE' || r.acknowledged_at) ackCount++;
    if (r.status === 'ACTION_TERMINEE' || r.action_completed_at) completedCount++;

    if (r.status !== 'ACTION_TERMINEE' && r.status !== 'PRISE_DE_CONNAISSANCE') {
      if (dispatch.dispatch_type === 'ACTION_REQUISE' && r.status !== 'ACTION_TERMINEE') {
        hasPending = true;
      } else if (dispatch.dispatch_type === 'PRISE_DE_CONNAISSANCE' && r.status !== 'PRISE_DE_CONNAISSANCE') {
        hasPending = true;
      }
    }

    if (deadlineDate && now > deadlineDate && r.status !== 'ACTION_TERMINEE' && r.status !== 'PRISE_DE_CONNAISSANCE') {
      hasLate = true;
    }
  }

  let globalStatus = 'EN_COURS';
  if (hasLate) {
    globalStatus = 'EN_RETARD';
  } else if (!hasPending && total > 0) {
    globalStatus = 'TERMINE';
  }

  await db.run(
    `UPDATE document_dispatches 
     SET total_recipients = ?, acknowledged_count = ?, completed_count = ?, status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [total, ackCount, completedCount, globalStatus, dispatchId]
  );
}

// 1. POST /api/dispatches - Create and launch a new dispatch
router.post('/', authenticateToken, requirePermission('dispatching.create'), async (req, res) => {
  const {
    document_id,
    dispatch_type, // 'SIMPLE', 'PRISE_DE_CONNAISSANCE', 'ACTION_REQUISE'
    title,
    message,
    action_description,
    deadline,
    recipients_mode, // 'ALL_SERVICES' or 'SELECTED_SERVICES'
    service_ids // Array of service IDs if SELECTED_SERVICES
  } = req.body;

  if (!document_id || !title) {
    return res.status(400).json({ error: 'Le document et l’objet/titre de la diffusion sont obligatoires.' });
  }

  const dispatchTypeVal = ['SIMPLE', 'PRISE_DE_CONNAISSANCE', 'ACTION_REQUISE'].includes(dispatch_type)
    ? dispatch_type
    : 'SIMPLE';

  try {
    const document = await db.get('SELECT * FROM documents WHERE id = ?', [document_id]);
    if (!document) {
      return res.status(404).json({ error: 'Document original introuvable.' });
    }

    // Determine target services (Only active services of current tenant)
    let targetServices = [];
    if (recipients_mode === 'ALL_SERVICES') {
      targetServices = await db.all("SELECT id, name, code FROM services WHERE status = 'ACTIVE' ORDER BY name ASC");
    } else if (Array.isArray(service_ids) && service_ids.length > 0) {
      const placeholders = service_ids.map(() => '?').join(',');
      targetServices = await db.all(`SELECT id, name, code FROM services WHERE id IN (${placeholders}) AND status = 'ACTIVE'`, service_ids);
    }

    if (targetServices.length === 0) {
      return res.status(400).json({ error: 'Aucun service destinataire sélectionné ou actif.' });
    }

    const reference = await generateDispatchReference();
    const senderUserId = req.user.id;
    const senderServiceId = req.user.service_id || 1; // Default to SC (service 1) if none
    const tenantId = 'UNIVERSITE_KINDIA';

    const insertResult = await db.run(
      `INSERT INTO document_dispatches 
       (reference, document_id, dispatch_type, title, message, action_description, deadline, sender_user_id, sender_service_id, tenant_id, total_recipients, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_COURS')`,
      [
        reference,
        document_id,
        dispatchTypeVal,
        title.trim(),
        message || '',
        action_description || '',
        deadline || null,
        senderUserId,
        senderServiceId,
        tenantId,
        targetServices.length
      ]
    );

    const dispatchId = insertResult.lastID;
    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

    // Insert recipients without duplicating physical document
    for (const service of targetServices) {
      const recResult = await db.run(
        `INSERT INTO dispatch_recipients 
         (dispatch_id, document_id, service_id, tenant_id, status)
         VALUES (?, ?, ?, ?, 'NON_CONSULTE')`,
        [dispatchId, document_id, service.id, tenantId]
      );

      // Create notification for service users
      const notifMsg = `📢 Nouveau document diffusé [${document.reference}] : "${title}". Type : ${dispatchTypeVal.replace(/_/g, ' ')}.`;
      await db.run(
        `INSERT INTO notifications (user_id, document_id, title, message, type, is_read, created_at)
         SELECT id, ?, 'Diffusion Administrative', ?, 'DISPATCHING', 0, CURRENT_TIMESTAMP
         FROM users 
         WHERE service_id = ? AND status = 'ACTIVE'`,
        [document_id, notifMsg, service.id]
      );
    }

    // Log initial dispatch event
    await db.run(
      `INSERT INTO dispatch_logs (dispatch_id, user_id, action, details, ip_address)
       VALUES (?, ?, 'CREATION_DIFFUSION', ?, ?)`,
      [dispatchId, senderUserId, `Diffusion envoyée à ${targetServices.length} service(s). Réf : ${reference}`, clientIp]
    );

    await logAuditAction(senderUserId, 'CREATE_DISPATCH', 'DISPATCHING', dispatchId, req, {
      reference,
      document_reference: document.reference,
      recipients_count: targetServices.length,
      dispatch_type: dispatchTypeVal
    });

    res.status(201).json({
      success: true,
      message: `Diffusion administrative [${reference}] créée et transmise avec succès à ${targetServices.length} service(s).`,
      id: dispatchId,
      reference,
      recipients_count: targetServices.length
    });
  } catch (err) {
    console.error('Create dispatch error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la diffusion administrative.' });
  }
});

// 2. GET /api/dispatches - List all dispatches (with filters & search)
router.get('/', authenticateToken, requirePermission('dispatching.view'), async (req, res) => {
  const { search, status, dispatch_type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  try {
    let whereClauses = ["d.tenant_id = 'UNIVERSITE_KINDIA'"];
    let params = [];

    if (search) {
      whereClauses.push("(d.reference LIKE ? OR d.title LIKE ? OR doc.reference LIKE ? OR doc.title LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereClauses.push("d.status = ?");
      params.push(status);
    }

    if (dispatch_type) {
      whereClauses.push("d.dispatch_type = ?");
      params.push(dispatch_type);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await db.get(
      `SELECT COUNT(d.id) as total 
       FROM document_dispatches d
       JOIN documents doc ON d.document_id = doc.id
       ${whereStr}`,
      params
    );

    const dispatches = await db.all(
      `SELECT d.*, 
              doc.reference as document_reference, 
              doc.title as document_title, 
              doc.document_type as document_type,
              u.first_name || ' ' || u.last_name as sender_name,
              s.name as sender_service_name
       FROM document_dispatches d
       JOIN documents doc ON d.document_id = doc.id
       LEFT JOIN users u ON d.sender_user_id = u.id
       LEFT JOIN services s ON d.sender_service_id = s.id
       ${whereStr}
       ORDER BY d.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), offset]
    );

    res.json({
      success: true,
      dispatches,
      pagination: {
        total: countRow.total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(countRow.total / parseInt(limit, 10))
      }
    });
  } catch (err) {
    console.error('List dispatches error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des diffusions.' });
  }
});

// 3. GET /api/dispatches/inbox/my-service - Inbox for the current user's service
router.get('/inbox/my-service', authenticateToken, requirePermission('dispatching.view'), async (req, res) => {
  const serviceId = req.user.service_id;
  if (!serviceId) {
    return res.json({ success: true, dispatches: [], message: 'Aucun service assigné à cet utilisateur.' });
  }

  const { filter = 'ALL', search } = req.query; // 'ALL', 'PENDING_ACK', 'ACTION_REQUIRED', 'LATE', 'COMPLETED'

  try {
    let query = `
      SELECT r.*,
             d.reference as dispatch_reference,
             d.dispatch_type,
             d.title as dispatch_title,
             d.message as dispatch_message,
             d.action_description,
             d.deadline,
             d.status as dispatch_global_status,
             doc.reference as document_reference,
             doc.title as document_title,
             doc.document_type,
             doc.confidentiality,
             doc.priority,
             s_from.name as sender_service_name,
             u_from.first_name || ' ' || u_from.last_name as sender_name,
             u_ack.first_name || ' ' || u_ack.last_name as acknowledged_by_name,
             u_act.first_name || ' ' || u_act.last_name as action_completed_by_name
      FROM dispatch_recipients r
      JOIN document_dispatches d ON r.dispatch_id = d.id
      JOIN documents doc ON r.document_id = doc.id
      LEFT JOIN services s_from ON d.sender_service_id = s_from.id
      LEFT JOIN users u_from ON d.sender_user_id = u_from.id
      LEFT JOIN users u_ack ON r.acknowledged_by = u_ack.id
      LEFT JOIN users u_act ON r.action_completed_by = u_act.id
      WHERE r.service_id = ? AND r.tenant_id = 'UNIVERSITE_KINDIA'
    `;
    const params = [serviceId];

    if (search) {
      query += ` AND (d.reference LIKE ? OR d.title LIKE ? OR doc.reference LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const now = new Date().toISOString();

    if (filter === 'PENDING_ACK') {
      query += ` AND d.dispatch_type = 'PRISE_DE_CONNAISSANCE' AND r.status != 'PRISE_DE_CONNAISSANCE'`;
    } else if (filter === 'ACTION_REQUIRED') {
      query += ` AND d.dispatch_type = 'ACTION_REQUISE' AND r.status != 'ACTION_TERMINEE'`;
    } else if (filter === 'LATE') {
      query += ` AND d.deadline IS NOT NULL AND d.deadline < ? AND r.status NOT IN ('PRISE_DE_CONNAISSANCE', 'ACTION_TERMINEE')`;
      params.push(now);
    } else if (filter === 'COMPLETED') {
      query += ` AND (r.status = 'PRISE_DE_CONNAISSANCE' OR r.status = 'ACTION_TERMINEE' OR (d.dispatch_type = 'SIMPLE' AND r.status = 'CONSULTE'))`;
    }

    query += ` ORDER BY r.id DESC`;

    const items = await db.all(query, params);

    // Compute dynamic late flags
    const processedItems = items.map(item => {
      const isLate = item.deadline && new Date() > new Date(item.deadline) && item.status !== 'PRISE_DE_CONNAISSANCE' && item.status !== 'ACTION_TERMINEE';
      return {
        ...item,
        is_late: Boolean(isLate),
        display_status: isLate ? 'EN_RETARD' : item.status
      };
    });

    res.json({
      success: true,
      service_id: serviceId,
      dispatches: processedItems
    });
  } catch (err) {
    console.error('Inbox dispatches error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de la boîte de réception.' });
  }
});

// 4. GET /api/dispatches/stats/dashboard - Dashboard statistics
router.get('/stats/dashboard', authenticateToken, requirePermission('dispatching.view'), async (req, res) => {
  try {
    const totalDispatches = await db.get("SELECT COUNT(id) as c FROM document_dispatches WHERE tenant_id = 'UNIVERSITE_KINDIA'");
    const activeDispatches = await db.get("SELECT COUNT(id) as c FROM document_dispatches WHERE status = 'EN_COURS' AND tenant_id = 'UNIVERSITE_KINDIA'");
    const completedDispatches = await db.get("SELECT COUNT(id) as c FROM document_dispatches WHERE status = 'TERMINE' AND tenant_id = 'UNIVERSITE_KINDIA'");
    const lateDispatches = await db.get("SELECT COUNT(id) as c FROM document_dispatches WHERE status = 'EN_RETARD' AND tenant_id = 'UNIVERSITE_KINDIA'");

    const totalRecipients = await db.get("SELECT COUNT(id) as c FROM dispatch_recipients WHERE tenant_id = 'UNIVERSITE_KINDIA'");
    const viewedRecipients = await db.get("SELECT COUNT(id) as c FROM dispatch_recipients WHERE status != 'NON_CONSULTE' AND tenant_id = 'UNIVERSITE_KINDIA'");
    const ackRecipients = await db.get("SELECT COUNT(id) as c FROM dispatch_recipients WHERE status = 'PRISE_DE_CONNAISSANCE' OR acknowledged_at IS NOT NULL");
    const completedActions = await db.get("SELECT COUNT(id) as c FROM dispatch_recipients WHERE status = 'ACTION_TERMINEE' OR action_completed_at IS NOT NULL");

    const totalR = totalRecipients.c || 0;
    const consultationRate = totalR > 0 ? Math.round(((viewedRecipients.c || 0) / totalR) * 100) : 100;
    const ackRate = totalR > 0 ? Math.round(((ackRecipients.c || 0) / totalR) * 100) : 100;

    res.json({
      success: true,
      stats: {
        total_dispatches: totalDispatches.c || 0,
        active_dispatches: activeDispatches.c || 0,
        completed_dispatches: completedDispatches.c || 0,
        late_dispatches: lateDispatches.c || 0,
        total_recipients: totalR,
        consultation_rate: consultationRate,
        acknowledgement_rate: ackRate,
        completed_actions: completedActions.c || 0
      }
    });
  } catch (err) {
    console.error('Stats dashboard error:', err);
    res.status(500).json({ error: 'Erreur lors du calcul des statistiques.' });
  }
});

// 5. GET /api/dispatches/:id - Detailed view of a single dispatch
router.get('/:id', authenticateToken, requirePermission('dispatching.view'), async (req, res) => {
  const { id } = req.params;

  try {
    const dispatch = await db.get(
      `SELECT d.*, 
              doc.reference as document_reference, 
              doc.title as document_title, 
              doc.document_type,
              doc.confidentiality,
              doc.priority,
              u.first_name || ' ' || u.last_name as sender_name,
              s.name as sender_service_name
       FROM document_dispatches d
       JOIN documents doc ON d.document_id = doc.id
       LEFT JOIN users u ON d.sender_user_id = u.id
       LEFT JOIN services s ON d.sender_service_id = s.id
       WHERE (d.id = ? OR d.reference = ?) AND d.tenant_id = 'UNIVERSITE_KINDIA'`,
      [id, id]
    );

    if (!dispatch) {
      return res.status(404).json({ error: 'Diffusion administrative introuvable.' });
    }

    // Security check: if user is not from sender service and lacks tracking permission, ensure their service is in recipients
    const canTrack = req.user.role_code === 'ADMIN_TECH' || req.user.role_code === 'ADMINISTRATEUR' || req.user.role_code === 'AGENT_SC' || req.user.role_code === 'SG' || req.user.role_code === 'RECTEUR';
    
    const recipients = await db.all(
      `SELECT r.*, 
              s.name as service_name, 
              s.code as service_code,
              u_view.first_name || ' ' || u_view.last_name as viewed_by_name,
              u_ack.first_name || ' ' || u_ack.last_name as acknowledged_by_name,
              u_act.first_name || ' ' || u_act.last_name as action_completed_by_name
       FROM dispatch_recipients r
       JOIN services s ON r.service_id = s.id
       LEFT JOIN users u_view ON r.first_viewed_by = u_view.id
       LEFT JOIN users u_ack ON r.acknowledged_by = u_ack.id
       LEFT JOIN users u_act ON r.action_completed_by = u_act.id
       WHERE r.dispatch_id = ?
       ORDER BY s.name ASC`,
      [dispatch.id]
    );

    if (!canTrack) {
      const isRecipient = recipients.some(r => r.service_id === req.user.service_id);
      if (!isRecipient && dispatch.sender_service_id !== req.user.service_id) {
        return res.status(403).json({ error: 'Accès refusé. Cette diffusion ne concerne pas votre service.' });
      }
    }

    const logs = await db.all(
      `SELECT l.*, u.first_name || ' ' || u.last_name as user_name, s.name as service_name
       FROM dispatch_logs l
       LEFT JOIN users u ON l.user_id = u.id
       LEFT JOIN services s ON l.service_id = s.id
       WHERE l.dispatch_id = ?
       ORDER BY l.id ASC`,
      [dispatch.id]
    );

    res.json({
      success: true,
      dispatch,
      recipients,
      logs
    });
  } catch (err) {
    console.error('Fetch dispatch detail error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des détails de la diffusion.' });
  }
});

// 6. POST /api/dispatches/recipients/:recipientId/view - Mark document as viewed by target service
router.post('/recipients/:recipientId/view', authenticateToken, async (req, res) => {
  const { recipientId } = req.params;

  try {
    const recipient = await db.get('SELECT * FROM dispatch_recipients WHERE id = ?', [recipientId]);
    if (!recipient) {
      return res.status(404).json({ error: 'Destinataire de diffusion introuvable.' });
    }

    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

    // Mark as viewed if first time
    if (recipient.status === 'NON_CONSULTE' || !recipient.first_viewed_at) {
      await db.run(
        `UPDATE dispatch_recipients 
         SET status = 'CONSULTE', first_viewed_at = CURRENT_TIMESTAMP, first_viewed_by = ?, ip_address = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [req.user.id, clientIp, recipientId]
      );
    }

    await db.run(
      `INSERT INTO dispatch_logs (dispatch_id, recipient_id, service_id, user_id, action, details, ip_address)
       VALUES (?, ?, ?, ?, 'DOCUMENT_CONSULTÉ', 'Document original consulté par le service destinataire', ?)`,
      [recipient.dispatch_id, recipientId, req.user.service_id || recipient.service_id, req.user.id, clientIp]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'DOCUMENT_CONSULTÉ', ?)`,
      [recipient.document_id, req.user.id, req.user.service_id || recipient.service_id, `Consultation via la diffusion administrative [DSP ID: ${recipient.dispatch_id}]`]
    );

    await logAuditAction(req.user.id, 'DOCUMENT_CONSULTE', 'DISPATCHING', recipient.dispatch_id, req, {
      recipient_id: recipientId,
      document_id: recipient.document_id,
      service_id: req.user.service_id || recipient.service_id
    });

    res.json({ success: true, message: 'Document marqué comme consulté.' });
  } catch (err) {
    console.error('View dispatch error:', err);
    res.status(500).json({ error: 'Erreur lors de la consultation du document.' });
  }
});

// 7. POST /api/dispatches/recipients/:recipientId/acknowledge - Acknowledge receipt ('Prise de connaissance')
router.post('/recipients/:recipientId/acknowledge', authenticateToken, requirePermission('dispatching.acknowledge'), async (req, res) => {
  const { recipientId } = req.params;

  try {
    const recipient = await db.get('SELECT * FROM dispatch_recipients WHERE id = ?', [recipientId]);
    if (!recipient) {
      return res.status(404).json({ error: 'Destinataire de diffusion introuvable.' });
    }

    // Security check: Must belong to target service or be Admin
    const isAdmin = req.user.role_code === 'ADMIN_TECH' || req.user.role_code === 'ADMINISTRATEUR';
    if (!isAdmin && req.user.service_id !== recipient.service_id) {
      return res.status(403).json({ error: 'Vous ne pouvez valider la prise de connaissance que pour votre propre service.' });
    }

    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await db.run(
      `UPDATE dispatch_recipients 
       SET status = 'PRISE_DE_CONNAISSANCE', 
           acknowledged_at = CURRENT_TIMESTAMP, 
           acknowledged_by = ?, 
           ip_address = ?, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.user.id, clientIp, recipientId]
    );

    await db.run(
      `INSERT INTO dispatch_logs (dispatch_id, recipient_id, service_id, user_id, action, details, ip_address)
       VALUES (?, ?, ?, ?, 'DOCUMENT_PRIS_EN_CONNAISSANCE', 'Prise de connaissance certifiée enregistrée avec succès.', ?)`,
      [recipient.dispatch_id, recipientId, recipient.service_id, req.user.id, clientIp]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'DOCUMENT_PRIS_EN_CONNAISSANCE', ?)`,
      [recipient.document_id, req.user.id, recipient.service_id, `Prise de connaissance certifiée par le service destinataire [DSP ID: ${recipient.dispatch_id}]`]
    );

    await updateDispatchGlobalStatus(recipient.dispatch_id);

    await logAuditAction(req.user.id, 'DOCUMENT_PRIS_EN_CONNAISSANCE', 'DISPATCHING', recipient.dispatch_id, req, {
      recipient_id: recipientId,
      document_id: recipient.document_id,
      service_id: recipient.service_id
    });

    res.json({
      success: true,
      message: 'Prise de connaissance enregistrée et certifiée avec succès.'
    });
  } catch (err) {
    console.error('Acknowledge dispatch error:', err);
    res.status(500).json({ error: 'Erreur lors de la prise de connaissance.' });
  }
});

// 8. POST /api/dispatches/recipients/:recipientId/action/start - Start required action
router.post('/recipients/:recipientId/action/start', authenticateToken, requirePermission('dispatching.action'), async (req, res) => {
  const { recipientId } = req.params;

  try {
    const recipient = await db.get('SELECT * FROM dispatch_recipients WHERE id = ?', [recipientId]);
    if (!recipient) return res.status(404).json({ error: 'Destinataire introuvable.' });

    const isAdmin = req.user.role_code === 'ADMIN_TECH' || req.user.role_code === 'ADMINISTRATEUR';
    if (!isAdmin && req.user.service_id !== recipient.service_id) {
      return res.status(403).json({ error: 'Action non autorisée pour ce service.' });
    }

    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
    await db.run(
      `UPDATE dispatch_recipients 
       SET status = 'ACTION_EN_COURS', action_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [recipientId]
    );

    await db.run(
      `INSERT INTO dispatch_logs (dispatch_id, recipient_id, service_id, user_id, action, details, ip_address)
       VALUES (?, ?, ?, ?, 'ACTION_DEMARREE', 'L’action requise a été entamée par le service.', ?)`,
      [recipient.dispatch_id, recipientId, recipient.service_id, req.user.id, clientIp]
    );

    res.json({ success: true, message: 'Action marquée comme en cours de traitement.' });
  } catch (err) {
    console.error('Start action error:', err);
    res.status(500).json({ error: 'Erreur lors du démarrage de l’action.' });
  }
});

// 9. POST /api/dispatches/recipients/:recipientId/action/complete - Complete required action
router.post('/recipients/:recipientId/action/complete', authenticateToken, requirePermission('dispatching.action'), upload.single('response_attachment'), async (req, res) => {
  const { recipientId } = req.params;
  const { comment } = req.body;

  try {
    const recipient = await db.get('SELECT * FROM dispatch_recipients WHERE id = ?', [recipientId]);
    if (!recipient) return res.status(404).json({ error: 'Destinataire introuvable.' });

    const isAdmin = req.user.role_code === 'ADMIN_TECH' || req.user.role_code === 'ADMINISTRATEUR';
    if (!isAdmin && req.user.service_id !== recipient.service_id) {
      return res.status(403).json({ error: 'Action non autorisée pour ce service.' });
    }

    const attachmentPath = req.file ? req.file.filename : null;
    const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';

    await db.run(
      `UPDATE dispatch_recipients 
       SET status = 'ACTION_TERMINEE', 
           action_completed_at = CURRENT_TIMESTAMP, 
           action_completed_by = ?,
           action_response_comment = ?,
           action_response_attachment_path = ?,
           ip_address = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.user.id, comment || '', attachmentPath, clientIp, recipientId]
    );

    await db.run(
      `INSERT INTO dispatch_logs (dispatch_id, recipient_id, service_id, user_id, action, details, ip_address)
       VALUES (?, ?, ?, ?, 'ACTION_TERMINEE', ?, ?)`,
      [recipient.dispatch_id, recipientId, recipient.service_id, req.user.id, `Action finalisée : ${comment || 'Aucun commentaire'}`, clientIp]
    );

    await updateDispatchGlobalStatus(recipient.dispatch_id);

    await logAuditAction(req.user.id, 'COMPLETE_DISPATCH_ACTION', 'DISPATCHING', recipient.dispatch_id, req, {
      recipient_id: recipientId,
      service_id: recipient.service_id,
      has_attachment: Boolean(attachmentPath)
    });

    res.json({
      success: true,
      message: 'Action requise finalisée avec succès.'
    });
  } catch (err) {
    console.error('Complete action error:', err);
    res.status(500).json({ error: 'Erreur lors de la finalisation de l’action.' });
  }
});

// 10. POST /api/dispatches/:id/remind - Send automated reminders to pending services
router.post('/:id/remind', authenticateToken, requirePermission('dispatching.tracking'), async (req, res) => {
  const { id } = req.params;

  try {
    const dispatch = await db.get('SELECT * FROM document_dispatches WHERE id = ?', [id]);
    if (!dispatch) return res.status(404).json({ error: 'Diffusion introuvable.' });

    const pendingRecipients = await db.all(
      `SELECT r.*, s.name as service_name
       FROM dispatch_recipients r
       JOIN services s ON r.service_id = s.id
       WHERE r.dispatch_id = ? AND r.status NOT IN ('PRISE_DE_CONNAISSANCE', 'ACTION_TERMINEE')`,
      [id]
    );

    if (pendingRecipients.length === 0) {
      return res.json({ success: true, message: 'Tous les services destinataires ont déjà traité cette diffusion.' });
    }

    for (const r of pendingRecipients) {
      await db.run(
        `UPDATE dispatch_recipients 
         SET reminders_sent = reminders_sent + 1, last_reminder_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [r.id]
      );

      const reminderMsg = `⚠️ Rappel UK-GED : Le document [${dispatch.reference}] "${dispatch.title}" est en attente de traitement par votre service.`;
      await db.run(
        `INSERT INTO notifications (user_id, document_id, title, message, type, is_read, created_at)
         SELECT id, ?, 'Rappel de Diffusion', ?, 'DISPATCHING', 0, CURRENT_TIMESTAMP
         FROM users 
         WHERE service_id = ? AND status = 'ACTIVE'`,
        [dispatch.document_id, reminderMsg, r.service_id]
      );
    }

    await db.run(
      `INSERT INTO dispatch_logs (dispatch_id, user_id, action, details)
       VALUES (?, ?, 'RAPPEL_AUTOMATIQUE', ?)`,
      [id, req.user.id, `Rappels envoyés à ${pendingRecipients.length} service(s) en attente.`]
    );

    res.json({
      success: true,
      message: `Rappels envoyés avec succès à ${pendingRecipients.length} service(s).`,
      count: pendingRecipients.length
    });
  } catch (err) {
    console.error('Send reminder error:', err);
    res.status(500).json({ error: 'Erreur lors de l’envoi des rappels.' });
  }
});

// 11. GET /api/dispatches/:id/report-pdf - Generate official PDF Diffusion & Attendance Report
router.get('/:id/report-pdf', authenticateToken, requirePermission('dispatching.export'), async (req, res) => {
  const { id } = req.params;

  try {
    const dispatch = await db.get(
      `SELECT d.*, 
              doc.reference as document_reference, 
              doc.title as document_title, 
              doc.document_type,
              u.first_name || ' ' || u.last_name as sender_name,
              s.name as sender_service_name
       FROM document_dispatches d
       JOIN documents doc ON d.document_id = doc.id
       LEFT JOIN users u ON d.sender_user_id = u.id
       LEFT JOIN services s ON d.sender_service_id = s.id
       WHERE d.id = ? OR d.reference = ?`,
      [id, id]
    );

    if (!dispatch) return res.status(404).json({ error: 'Diffusion introuvable.' });

    const recipients = await db.all(
      `SELECT r.*, 
              s.name as service_name, 
              s.code as service_code,
              u_ack.first_name || ' ' || u_ack.last_name as ack_user_name,
              u_act.first_name || ' ' || u_act.last_name as act_user_name
       FROM dispatch_recipients r
       JOIN services s ON r.service_id = s.id
       LEFT JOIN users u_ack ON r.acknowledged_by = u_ack.id
       LEFT JOIN users u_act ON r.action_completed_by = u_act.id
       WHERE r.dispatch_id = ?
       ORDER BY s.name ASC`,
      [dispatch.id]
    );

    // Build PDF report with pdf-lib
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const primaryColor = rgb(0.08, 0.22, 0.38); // UK Blue
    const goldColor = rgb(0.79, 0.64, 0.15); // UK Gold
    const textColor = rgb(0.15, 0.20, 0.25);
    const lightBg = rgb(0.95, 0.96, 0.98);

    // Header
    page.drawRectangle({ x: 40, y: 770, width: 515.28, height: 45, color: primaryColor });
    page.drawText('RÉPUBLIQUE DE GUINÉE • UNIVERSITÉ DE KINDIA', {
      x: 55,
      y: 795,
      size: 11,
      font: fontBold,
      color: rgb(1, 1, 1)
    });
    page.drawText('RAPPORT OFFICIEL DE DIFFUSION ADMINISTRATIVE ET D’ÉMARGEMENT', {
      x: 55,
      y: 780,
      size: 9,
      font: fontBold,
      color: goldColor
    });

    // Metadata section
    let yPos = 740;
    page.drawText(`RÉFÉRENCE DIFFUSION : ${dispatch.reference}`, { x: 40, y: yPos, size: 10, font: fontBold, color: primaryColor });
    page.drawText(`DATE D’ÉMISSION : ${new Date(dispatch.created_at).toLocaleDateString('fr-FR')}`, { x: 340, y: yPos, size: 9, font: fontRegular, color: textColor });
    yPos -= 16;
    page.drawText(`DOCUMENT ORIGINAL : ${dispatch.document_reference} — ${dispatch.document_title}`, { x: 40, y: yPos, size: 9, font: fontRegular, color: textColor });
    yPos -= 16;
    page.drawText(`TYPE DE DIFFUSION : ${dispatch.dispatch_type.replace(/_/g, ' ')}`, { x: 40, y: yPos, size: 9, font: fontBold, color: textColor });
    page.drawText(`ÉMETTEUR : ${dispatch.sender_service_name || 'Secrétariat Central'} (${dispatch.sender_name || 'SC'})`, { x: 300, y: yPos, size: 9, font: fontRegular, color: textColor });
    yPos -= 16;
    page.drawText(`STATUT GLOBAL : ${dispatch.status} (${dispatch.acknowledged_count || 0}/${dispatch.total_recipients || 0} pris connaissance)`, { x: 40, y: yPos, size: 9, font: fontBold, color: primaryColor });
    
    yPos -= 25;
    // Table Header
    page.drawRectangle({ x: 40, y: yPos, width: 515.28, height: 20, color: lightBg });
    page.drawText('SERVICE DESTINATAIRE', { x: 45, y: yPos + 6, size: 8, font: fontBold, color: primaryColor });
    page.drawText('STATUT', { x: 220, y: yPos + 6, size: 8, font: fontBold, color: primaryColor });
    page.drawText('SIGNATAIRE / AGENT', { x: 320, y: yPos + 6, size: 8, font: fontBold, color: primaryColor });
    page.drawText('DATE & HEURE', { x: 450, y: yPos + 6, size: 8, font: fontBold, color: primaryColor });
    yPos -= 18;

    // Table Rows
    for (const r of recipients) {
      if (yPos < 60) {
        page = pdfDoc.addPage([595.28, 841.89]);
        yPos = 780;
      }

      const statusText = r.status.replace(/_/g, ' ');
      const agentName = r.ack_user_name || r.act_user_name || '—';
      const dateStr = r.acknowledged_at ? new Date(r.acknowledged_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : (r.first_viewed_at ? `Vu le ${new Date(r.first_viewed_at).toLocaleDateString('fr-FR')}` : 'En attente');

      page.drawText(r.service_name.substring(0, 32), { x: 45, y: yPos, size: 8, font: fontRegular, color: textColor });
      page.drawText(statusText, { x: 220, y: yPos, size: 8, font: fontBold, color: r.status === 'PRISE_DE_CONNAISSANCE' || r.status === 'ACTION_TERMINEE' ? rgb(0.1, 0.5, 0.2) : rgb(0.8, 0.4, 0) });
      page.drawText(agentName.substring(0, 24), { x: 320, y: yPos, size: 8, font: fontRegular, color: textColor });
      page.drawText(dateStr, { x: 450, y: yPos, size: 7.5, font: fontRegular, color: textColor });
      
      page.drawLine({ start: { x: 40, y: yPos - 4 }, end: { x: 555.28, y: yPos - 4 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
      yPos -= 18;
    }

    // Footer Stamp
    yPos -= 20;
    if (yPos < 60) {
      page = pdfDoc.addPage([595.28, 841.89]);
      yPos = 780;
    }
    page.drawText('Certifié conforme par le Secrétariat Central de l’Université de Kindia', { x: 40, y: yPos, size: 8, font: fontBold, color: primaryColor });
    page.drawText(`Document généré le ${new Date().toLocaleString('fr-FR')} via UK-GED Système GED Officiel`, { x: 40, y: yPos - 12, size: 7, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Rapport_Diffusion_${dispatch.reference}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Generate PDF report error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du rapport PDF.' });
  }
});

module.exports = router;
