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

    // Build cycle-proof recursive tree
    const serviceMap = {};
    allServices.forEach(s => {
      serviceMap[s.id] = { ...s, children: [] };
    });

    // Ensure UK / Université root has no parent
    allServices.forEach(s => {
      if (s.code === 'UK' || s.structure_type === 'UNIVERSITE') {
        if (serviceMap[s.id]) serviceMap[s.id].parent_id = null;
      }
    });

    const tree = [];
    const addedAsChild = new Set();

    // Attach children to parents with cycle prevention
    allServices.forEach(s => {
      const pId = serviceMap[s.id]?.parent_id;
      if (pId && serviceMap[pId] && pId !== s.id) {
        // Trace ancestry to detect any cycle
        let isCycle = false;
        let curr = pId;
        const visited = new Set([s.id]);
        while (curr && serviceMap[curr]) {
          if (visited.has(curr)) {
            isCycle = true;
            break;
          }
          visited.add(curr);
          curr = serviceMap[curr].parent_id;
        }

        if (!isCycle) {
          serviceMap[pId].children.push(serviceMap[s.id]);
          addedAsChild.add(s.id);
        }
      }
    });

    // Any node not added as a child is treated as a root node
    allServices.forEach(s => {
      if (!addedAsChild.has(s.id)) {
        tree.push(serviceMap[s.id]);
      }
    });

    // Helper to sort alphabetically in French
    const sortAlphabetically = (a, b) => {
      return (a.name || '').localeCompare(b.name || '', 'fr', { sensitivity: 'base' });
    };

    // Recursively sort all children levels alphabetically
    const sortChildrenRecursively = (node) => {
      if (node.children && node.children.length > 0) {
        node.children.sort(sortAlphabetically);
        node.children.forEach(sortChildrenRecursively);
      }
    };

    // Sort root level (keeping Université top if present, otherwise alphabetical)
    tree.sort((a, b) => {
      if (a.code === 'UK' || a.structure_type === 'UNIVERSITE') return -1;
      if (b.code === 'UK' || b.structure_type === 'UNIVERSITE') return 1;
      return sortAlphabetically(a, b);
    });

    tree.forEach(sortChildrenRecursively);

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
  const { parent_id, structure_type, code, name, acronym, reference_code, head_user_id, function_title, header_text, description, address, email, phone, order_index, status } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'L’intitulé officiel de la structure est obligatoire.' });
  }

  const cleanName = name.trim();

  // Auto-generate code if omitted
  let cleanCode = (code && code.trim()) ? code.trim().toUpperCase() : '';
  if (!cleanCode) {
    const initials = cleanName
      .split(/[\s\-_',.]+/)
      .filter(w => w.length > 0 && !['de', 'des', 'du', 'la', 'le', 'les', 'et', 'à', 'd', 'l'].includes(w.toLowerCase()))
      .map(w => w[0].toUpperCase())
      .join('');
    const baseCode = (initials.length >= 2 ? initials : cleanName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase()) || 'STR';
    cleanCode = baseCode;
  }

  const cleanRef = reference_code ? reference_code.trim().toUpperCase() : cleanCode;

  try {
    // Check if code exists, append random suffix if auto-generated and duplicate
    let existingCode = await db.get('SELECT id FROM services WHERE code = ?', [cleanCode]);
    if (existingCode) {
      if (!code || !code.trim()) {
        cleanCode = `${cleanCode}_${Math.floor(100 + Math.random() * 900)}`;
      } else {
        return res.status(400).json({ error: `Une structure avec le code [${cleanCode}] existe déjà.` });
      }
    }

    let finalRef = cleanRef;
    let existingRef = await db.get('SELECT id FROM services WHERE reference_code = ?', [finalRef]);
    if (existingRef) {
      if (!reference_code || !reference_code.trim()) {
        finalRef = `${cleanRef}_${Math.floor(100 + Math.random() * 900)}`;
      } else {
        return res.status(400).json({ error: `La référence [${finalRef}] est déjà utilisée par une autre structure.` });
      }
    }

    const descText = description ? description.trim() : (header_text || null);

    const resDb = await db.run(
      `INSERT INTO services 
       (parent_id, structure_type, code, name, acronym, reference_code, head_user_id, function_title, header_text, address, email, phone, order_index, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parent_id ? Number(parent_id) : null,
        structure_type || 'SERVICE',
        cleanCode,
        cleanName,
        acronym ? acronym.trim() : cleanCode,
        finalRef,
        head_user_id ? Number(head_user_id) : null,
        function_title || null,
        descText,
        address || null,
        email || null,
        phone || null,
        order_index || 0,
        status || 'ACTIVE'
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

    await logAuditAction(req.user.id, 'CREATE', 'SERVICE', newServiceId, req, { code: cleanCode, name: cleanName, reference_code: finalRef });
    res.status(201).json({ success: true, id: newServiceId, code: cleanCode, message: 'Structure administrative créée avec succès.' });
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du service.' });
  }
});

// PATCH /api/services/:id/toggle-status - Toggle active/inactive status
router.patch('/:id/toggle-status', authenticateToken, requirePermission('services.update'), async (req, res) => {
  const serviceId = Number(req.params.id);
  try {
    const service = await db.get('SELECT * FROM services WHERE id = ?', [serviceId]);
    if (!service) {
      return res.status(404).json({ error: 'Structure introuvable.' });
    }

    const newStatus = service.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await db.run('UPDATE services SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, serviceId]);

    await logAuditAction(req.user.id, 'TOGGLE_STATUS', 'SERVICE', serviceId, req, {
      old_status: service.status,
      new_status: newStatus
    });

    res.json({
      success: true,
      status: newStatus,
      message: `Statut de « ${service.name} » mis à jour : ${newStatus === 'ACTIVE' ? 'Actif' : 'Inactif'}.`
    });
  } catch (err) {
    console.error('Toggle service status error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de statut.' });
  }
});

// PUT /api/services/:id - Update a service
router.put('/:id', authenticateToken, requirePermission('services.update'), async (req, res) => {
  const serviceId = Number(req.params.id);
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

    let cleanParentId = parent_id !== undefined ? (parent_id ? Number(parent_id) : null) : currentService.parent_id;

    // Enforce root status for Université top institution
    if (structure_type === 'UNIVERSITE' || currentService.code === 'UK') {
      cleanParentId = null;
    } else if (cleanParentId) {
      if (cleanParentId === serviceId) {
        return res.status(400).json({ error: 'Une structure ne peut pas être son propre parent hiérarchique.' });
      }

      // Check for circular reference in ancestry
      let ancestor = await db.get('SELECT id, parent_id FROM services WHERE id = ?', [cleanParentId]);
      const visited = new Set([serviceId]);
      while (ancestor && ancestor.parent_id) {
        if (visited.has(ancestor.parent_id)) {
          return res.status(400).json({ error: 'Affectation hiérarchique circulaire détectée. Cette structure ne peut pas être rattachée à sa propre sous-structure.' });
        }
        visited.add(ancestor.id);
        ancestor = await db.get('SELECT id, parent_id FROM services WHERE id = ?', [ancestor.parent_id]);
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
        cleanParentId,
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

// DELETE /api/services/:id - Delete a service or duplicate structure (Admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  const serviceId = Number(req.params.id);
  const user = req.user;

  // Ensure user has admin rights or service management permissions
  const isAdmin = user.role_code === 'ADMINISTRATEUR' || 
                  user.role_code === 'ADMIN' || 
                  user.role_name?.toLowerCase().includes('admin') ||
                  user.permissions?.includes('services.delete') ||
                  user.permissions?.includes('services.create') ||
                  user.permissions?.includes('services.update') ||
                  user.role_code === 'RECTEUR' ||
                  user.role_code === 'SECRÉTAIRE_GÉNÉRAL';

  if (!isAdmin) {
    return res.status(403).json({ error: 'Seul un administrateur peut supprimer une structure administrative.' });
  }

  try {
    const service = await db.get('SELECT * FROM services WHERE id = ?', [serviceId]);
    if (!service) {
      return res.status(404).json({ error: 'Structure introuvable.' });
    }

    // Protect essential core institutional nodes
    const protectedCodes = ['REC', 'RECT', 'RECTORAT', 'SG', 'SC', 'SEC_GENERAL', 'SEC_CENTRAL', 'ADMIN', 'UK'];
    if (serviceId === 1 || (service.code && protectedCodes.includes(service.code.toUpperCase()))) {
      return res.status(400).json({
        error: `La structure institutionnelle principale « ${service.name} » (${service.code}) est protégée et ne peut pas être supprimée.`
      });
    }

    const fallbackParentId = service.parent_id || null;
    const fallbackServiceId = fallbackParentId || 1; // Used for NOT NULL service_id foreign keys

    // 1. Re-link child sub-services to parent
    await db.run('UPDATE services SET parent_id = ? WHERE parent_id = ?', [fallbackParentId, serviceId]);

    // 2. Re-link users and staff to parent service (or null)
    await db.run('UPDATE users SET service_id = ? WHERE service_id = ?', [fallbackParentId, serviceId]);
    await db.run('UPDATE staff SET service_id = ? WHERE service_id = ?', [fallbackParentId, serviceId]);

    // 3. Re-link documents
    await db.run('UPDATE documents SET current_service_id = ? WHERE current_service_id = ?', [fallbackServiceId, serviceId]);
    await db.run('UPDATE documents SET owner_service_id = ? WHERE owner_service_id = ?', [fallbackParentId, serviceId]);
    await db.run('UPDATE documents SET originating_service_id = ? WHERE originating_service_id = ?', [fallbackParentId, serviceId]);
    await db.run('UPDATE documents SET target_service_id = ? WHERE target_service_id = ?', [fallbackParentId, serviceId]);

    // 4. Re-link document transfers and history
    await db.run('UPDATE document_transfers SET from_service_id = ? WHERE from_service_id = ?', [fallbackServiceId, serviceId]);
    await db.run('UPDATE document_transfers SET to_service_id = ? WHERE to_service_id = ?', [fallbackServiceId, serviceId]);
    await db.run('UPDATE document_history SET service_id = ? WHERE service_id = ?', [fallbackServiceId, serviceId]);

    // 5. Delete dependent service configurations
    await db.run('DELETE FROM service_heads_history WHERE service_id = ?', [serviceId]);
    await db.run('DELETE FROM service_document_settings WHERE service_id = ?', [serviceId]);
    await db.run('DELETE FROM service_document_settings_history WHERE service_id = ?', [serviceId]);
    await db.run('DELETE FROM service_custom_fields WHERE service_id = ?', [serviceId]);
    await db.run('DELETE FROM archive_custom_categories WHERE service_id = ?', [serviceId]);
    await db.run('DELETE FROM archive_shares WHERE target_service_id = ?', [serviceId]);
    await db.run('DELETE FROM workflow_rules WHERE from_service_id = ? OR to_service_id = ?', [serviceId, serviceId]);

    // 6. Re-link templates, signatures, external missionaries, requests, dispatches
    await db.run('UPDATE document_templates SET target_service_id = ? WHERE target_service_id = ?', [fallbackParentId, serviceId]);
    await db.run('UPDATE user_signatures SET service_id = ? WHERE service_id = ?', [fallbackParentId, serviceId]);
    await db.run('UPDATE external_missionaries SET host_service_id = ? WHERE host_service_id = ?', [fallbackParentId, serviceId]);
    await db.run('UPDATE external_missionaries SET current_service_id = ? WHERE current_service_id = ?', [fallbackParentId, serviceId]);
    await db.run('UPDATE external_missionary_history SET service_id = ? WHERE service_id = ?', [fallbackParentId, serviceId]);
    await db.run('UPDATE mission_order_requests SET destination_service_id = ? WHERE destination_service_id = ?', [fallbackParentId || 5, serviceId]);
    await db.run('UPDATE document_dispatches SET sender_service_id = ? WHERE sender_service_id = ?', [fallbackServiceId, serviceId]);
    await db.run('DELETE FROM dispatch_recipients WHERE service_id = ?', [serviceId]);
    await db.run('UPDATE dispatch_logs SET service_id = ? WHERE service_id = ?', [fallbackServiceId, serviceId]);

    // 7. Delete the service
    await db.run('DELETE FROM services WHERE id = ?', [serviceId]);

    await logAuditAction(user.id, 'DELETE_SERVICE', 'SERVICE', serviceId, req, {
      id: serviceId,
      name: service.name,
      code: service.code,
      structure_type: service.structure_type
    });

    res.json({
      success: true,
      message: `Structure « ${service.name} » (${service.code}) supprimée avec succès.`
    });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la suppression de la structure.' });
  }
});

module.exports = router;

