const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR } = require('../config/constants');

// Multer storage for service stamps / logos
const stampsDir = path.join(UPLOAD_DIR, 'stamps');
if (!fs.existsSync(stampsDir)) fs.mkdirSync(stampsDir, { recursive: true });

const stampStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, stampsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `stamp_${Date.now()}_${Math.round(Math.random() * 1000)}${ext}`);
  }
});
const uploadStamp = multer({
  storage: stampStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// GET /api/services - List all services with hierarchy info & counts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const services = await db.all(
      `SELECT s.*, 
              p.name as parent_name, p.code as parent_code,
              u.first_name as head_first_name, u.last_name as head_last_name, u.email as head_email, u.matricule as head_matricule,
              us.signature_image_path as head_signature_path,
              (SELECT COUNT(*) FROM users WHERE service_id = s.id) as user_count,
              (SELECT COUNT(*) FROM services WHERE parent_id = s.id) as children_count,
              (SELECT COUNT(*) FROM documents WHERE current_service_id = s.id AND status != 'TRASHED') as document_count
       FROM services s
       LEFT JOIN services p ON s.parent_id = p.id
       LEFT JOIN users u ON s.head_user_id = u.id
       LEFT JOIN user_signatures us ON us.user_id = u.id AND (us.status = 'ACTIVE' OR us.is_active = 1)
       ORDER BY s.order_index ASC, s.name ASC`
    );
    res.json(services);
  } catch (err) {
    console.error('Fetch services error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des services.' });
  }
});

// GET /api/services/hierarchy - Hierarchical tree structure for organization
router.get('/hierarchy', authenticateToken, async (req, res) => {
  try {
    const allServices = await db.all(
      `SELECT s.*, 
              u.first_name as head_first_name, u.last_name as head_last_name, u.email as head_email,
              (SELECT COUNT(*) FROM users WHERE service_id = s.id) as user_count,
              (SELECT COUNT(*) FROM documents WHERE current_service_id = s.id AND status != 'TRASHED') as document_count
       FROM services s
       LEFT JOIN users u ON s.head_user_id = u.id
       WHERE s.status = 'ACTIVE'
       ORDER BY s.order_index ASC, s.name ASC`
    );

    // Build recursive tree
    const serviceMap = {};
    const tree = [];

    allServices.forEach(s => {
      serviceMap[s.id] = { ...s, children: [] };
    });

    allServices.forEach(s => {
      if (s.parent_id && serviceMap[s.parent_id]) {
        serviceMap[s.parent_id].children.push(serviceMap[s.id]);
      } else {
        tree.push(serviceMap[s.id]);
      }
    });

    res.json(tree);
  } catch (err) {
    console.error('Fetch hierarchy error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de l’organigramme.' });
  }
});

// GET /api/services/:id/details - Full detailed sheet of a service (Rule 2 & 3)
router.get('/:id/details', authenticateToken, async (req, res) => {
  const serviceId = req.params.id;
  try {
    const service = await db.get(
      `SELECT s.*, 
              p.name as parent_name, p.code as parent_code,
              u.first_name as head_first_name, u.last_name as head_last_name, u.email as head_email, u.phone as head_phone, u.matricule as head_matricule,
              us.signature_image_path as head_signature_path
       FROM services s
       LEFT JOIN services p ON s.parent_id = p.id
       LEFT JOIN users u ON s.head_user_id = u.id
       LEFT JOIN user_signatures us ON us.user_id = u.id AND (us.status = 'ACTIVE' OR us.is_active = 1)
       WHERE s.id = ?`,
      [serviceId]
    );

    if (!service) {
      return res.status(404).json({ error: 'Service introuvable.' });
    }

    // Fetch child units / departments
    const subServices = await db.all(
      `SELECT s.*, u.first_name as head_first_name, u.last_name as head_last_name
       FROM services s
       LEFT JOIN users u ON s.head_user_id = u.id
       WHERE s.parent_id = ?
       ORDER BY s.order_index ASC, s.name ASC`,
      [serviceId]
    );

    // Fetch history of heads (service_heads_history)
    const headsHistory = await db.all(
      `SELECT shh.*, u.first_name, u.last_name, u.email, u.matricule
       FROM service_heads_history shh
       JOIN users u ON shh.user_id = u.id
       WHERE shh.service_id = ?
       ORDER BY shh.start_date DESC, shh.id DESC`,
      [serviceId]
    );

    // Fetch users in this service
    const users = await db.all(
      `SELECT u.id, u.matricule, u.first_name, u.last_name, u.email, u.function_title, r.name as role_name, u.status
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.service_id = ?
       ORDER BY u.last_name ASC`,
      [serviceId]
    );

    // Fetch templates scoped to this service
    const scopedTemplates = await db.all(
      `SELECT * FROM document_templates 
       WHERE (target_service_id = ? OR scope_type = 'GLOBAL') AND is_active = 1
       ORDER BY name ASC`,
      [serviceId]
    );

    res.json({
      service,
      subServices,
      headsHistory,
      users,
      scopedTemplates
    });
  } catch (err) {
    console.error('Fetch service details error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la fiche du service.' });
  }
});

// POST /api/services - Add a new service / structure
router.post('/', authenticateToken, requirePermission('services.create'), async (req, res) => {
  const { parent_id, structure_type, code, name, acronym, reference_code, head_user_id, function_title, header_text, address, email, phone, order_index } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Le code et le nom du service sont obligatoires.' });
  }

  const cleanCode = code.trim().toUpperCase();
  const cleanRef = reference_code ? reference_code.trim().toUpperCase() : cleanCode;

  try {
    const existingCode = await db.get('SELECT id FROM services WHERE code = ?', [cleanCode]);
    if (existingCode) {
      return res.status(400).json({ error: 'Un service avec ce code existe déjà.' });
    }

    const existingRef = await db.get('SELECT id FROM services WHERE reference_code = ?', [cleanRef]);
    if (existingRef) {
      return res.status(400).json({ error: `La référence [${cleanRef}] est déjà utilisée par une autre structure. La référence du service doit être unique.` });
    }

    const resDb = await db.run(
      `INSERT INTO services 
       (parent_id, structure_type, code, name, acronym, reference_code, head_user_id, function_title, header_text, address, email, phone, order_index, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        parent_id || null,
        structure_type || 'SERVICE',
        cleanCode,
        name.trim(),
        acronym || cleanCode,
        cleanRef,
        head_user_id || null,
        function_title || null,
        header_text || null,
        address || null,
        email || null,
        phone || null,
        order_index || 0
      ]
    );

    const newServiceId = resDb.lastID;

    // Automatically create default archive categories for this service (Requirement 2 & 14)
    await db.run(
      `INSERT OR IGNORE INTO archive_custom_categories 
       (service_id, code, name, description, icon, color, display_order, is_default, is_active, created_by)
       VALUES 
       (?, 'SOIT_TRANSMIS', 'Soit-transmis', 'Actes et bordereaux de transmission officielle', 'Send', 'text-amber-700 bg-amber-50 border-amber-200', 10, 1, 1, ?),
       (?, 'DEMANDE', 'Demandes', 'Demandes administratives, requêtes et congés', 'FileText', 'text-blue-700 bg-blue-50 border-blue-200', 20, 1, 1, ?)`,
      [newServiceId, req.user.id, newServiceId, req.user.id]
    );

    // If head_user_id was provided, record initial nomination in history
    if (head_user_id) {
      await db.run(
        `INSERT INTO service_heads_history (service_id, user_id, function_title, start_date, is_current)
         VALUES (?, ?, ?, CURRENT_DATE, 1)`,
        [newServiceId, head_user_id, function_title || 'Responsable de Service']
      );
    }

    await logAuditAction(req.user.id, 'CREATE', 'SERVICE', newServiceId, req, { code: cleanCode, name, reference_code: cleanRef });
    res.status(201).json({ success: true, id: newServiceId, message: 'Structure administrative créée avec succès.' });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du service.' });
  }
});

// PUT /api/services/:id - Update a service
router.put('/:id', authenticateToken, requirePermission('services.update'), async (req, res) => {
  const serviceId = req.params.id;
  const { parent_id, structure_type, name, acronym, reference_code, head_user_id, function_title, header_text, address, email, phone, order_index, status } = req.body;

  try {
    const currentService = await db.get('SELECT * FROM services WHERE id = ?', [serviceId]);
    if (!currentService) {
      return res.status(404).json({ error: 'Service introuvable.' });
    }

    if (reference_code && reference_code.trim().toUpperCase() !== currentService.reference_code) {
      const cleanRef = reference_code.trim().toUpperCase();
      const existingRef = await db.get('SELECT id FROM services WHERE reference_code = ? AND id != ?', [cleanRef, serviceId]);
      if (existingRef) {
        return res.status(400).json({ error: `La référence [${cleanRef}] est déjà attribuée à un autre service.` });
      }
    }

    const cleanRef = reference_code ? reference_code.trim().toUpperCase() : currentService.reference_code;

    await db.run(
      `UPDATE services 
       SET parent_id = ?, structure_type = ?, name = ?, acronym = ?, reference_code = ?,
           head_user_id = ?, function_title = ?, header_text = ?, address = ?, email = ?,
           phone = ?, order_index = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        parent_id !== undefined ? (parent_id || null) : currentService.parent_id,
        structure_type || currentService.structure_type,
        name ? name.trim() : currentService.name,
        acronym !== undefined ? acronym : currentService.acronym,
        cleanRef,
        head_user_id !== undefined ? (head_user_id || null) : currentService.head_user_id,
        function_title !== undefined ? function_title : currentService.function_title,
        header_text !== undefined ? header_text : currentService.header_text,
        address !== undefined ? address : currentService.address,
        email !== undefined ? email : currentService.email,
        phone !== undefined ? phone : currentService.phone,
        order_index !== undefined ? order_index : currentService.order_index,
        status || currentService.status,
        serviceId
      ]
    );

    // If head_user_id changed, update nomination history
    if (head_user_id && Number(head_user_id) !== Number(currentService.head_user_id)) {
      await db.run(
        `UPDATE service_heads_history SET is_current = 0, end_date = CURRENT_DATE WHERE service_id = ? AND is_current = 1`,
        [serviceId]
      );
      await db.run(
        `INSERT INTO service_heads_history (service_id, user_id, function_title, start_date, is_current)
         VALUES (?, ?, ?, CURRENT_DATE, 1)`,
        [serviceId, head_user_id, function_title || 'Responsable de Service']
      );
    }

    await logAuditAction(req.user.id, 'UPDATE', 'SERVICE', serviceId, req, { name, status, reference_code: cleanRef });
    res.json({ success: true, message: 'Service mis à jour avec succès.' });
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du service.' });
  }
});

// POST /api/services/:id/assign-head - Explicit nomination of a new service head with history (Rule 3)
router.post('/:id/assign-head', authenticateToken, requirePermission('services.update'), async (req, res) => {
  const serviceId = req.params.id;
  const { user_id, function_title, start_date, appointment_act_ref } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: 'Veuillez sélectionner un utilisateur pour être responsable.' });
  }

  try {
    const service = await db.get('SELECT * FROM services WHERE id = ?', [serviceId]);
    if (!service) return res.status(404).json({ error: 'Service introuvable.' });

    const user = await db.get('SELECT * FROM users WHERE id = ?', [user_id]);
    if (!user) return res.status(404).json({ error: 'Utilisateur sélectionné introuvable.' });

    const cleanFunction = function_title || user.function_title || 'Responsable de Service';
    const startDate = start_date || new Date().toISOString().split('T')[0];

    // 1. Close current head in history
    await db.run(
      `UPDATE service_heads_history SET is_current = 0, end_date = ? WHERE service_id = ? AND is_current = 1`,
      [startDate, serviceId]
    );

    // 2. Insert new history record
    await db.run(
      `INSERT INTO service_heads_history (service_id, user_id, function_title, start_date, is_current, appointment_act_ref)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [serviceId, user_id, cleanFunction, startDate, appointment_act_ref || null]
    );

    // 3. Update service current head
    await db.run(
      `UPDATE services SET head_user_id = ?, function_title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [user_id, cleanFunction, serviceId]
    );

    await logAuditAction(req.user.id, 'ASSIGN_HEAD', 'SERVICE', serviceId, req, {
      service_id: serviceId,
      new_head_id: user_id,
      new_head_name: `${user.first_name} ${user.last_name}`,
      function: cleanFunction,
      start_date: startDate
    });

    res.json({ success: true, message: 'Nouveau responsable affecté avec succès et consigné dans l’historique.' });
  } catch (err) {
    console.error('Assign head error:', err);
    res.status(500).json({ error: 'Erreur lors de l’affectation du responsable.' });
  }
});

// POST /api/services/:id/stamp - Upload official digital stamp
router.post('/:id/stamp', authenticateToken, requirePermission('services.update'), uploadStamp.single('stamp'), async (req, res) => {
  const serviceId = req.params.id;
  if (!req.file) {
    return res.status(400).json({ error: 'Fichier image du cachet obligatoire.' });
  }

  try {
    const stampRelativePath = `stamps/${req.file.filename}`;
    await db.run(
      'UPDATE services SET stamp_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [stampRelativePath, serviceId]
    );

    await logAuditAction(req.user.id, 'UPLOAD_STAMP', 'SERVICE', serviceId, req, { file: req.file.filename });
    res.json({ success: true, stamp_path: stampRelativePath, message: 'Cachet officiel enregistré avec succès.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l’enregistrement du cachet.' });
  }
});

module.exports = router;

