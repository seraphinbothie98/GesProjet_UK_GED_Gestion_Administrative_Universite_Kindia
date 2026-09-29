const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR } = require('../config/constants');
const accountSecurityService = require('../services/accountSecurityService');
const { checkExistingChefDeService, syncServiceChefAssignment } = require('../services/serviceHeadHelper');
const assignmentService = require('../services/assignmentService');

const sigsDir = path.join(UPLOAD_DIR, 'signatures');
if (!fs.existsSync(sigsDir)) {
  fs.mkdirSync(sigsDir, { recursive: true });
}

// Multer storage for signature image and CSV file upload
const staffStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'signature' || file.mimetype?.startsWith('image/')) {
      cb(null, sigsDir);
    } else {
      const tempDir = path.join(UPLOAD_DIR, 'temp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      cb(null, tempDir);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || (file.mimetype?.startsWith('image/') ? '.png' : '.csv');
    cb(null, `staff_${Date.now()}_${Math.round(Math.random() * 1000)}${ext}`);
  }
});

const uploadStaff = multer({
  storage: staffStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Helper to save base64 signature if provided as data url
function saveBase64Signature(base64Str) {
  if (!base64Str || typeof base64Str !== 'string' || !base64Str.startsWith('data:image')) {
    return null;
  }
  try {
    const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length < 3) return null;
    const ext = matches[1] === 'jpeg' ? 'jpg' : (matches[1] === 'svg+xml' ? 'svg' : matches[1]);
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `sig_${Date.now()}_${Math.round(Math.random() * 1000)}.${ext}`;
    const filePath = path.join(sigsDir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/signatures/${filename}`;
  } catch (err) {
    console.error('Save base64 signature error:', err);
    return null;
  }
}

// GET /api/staff/check-service-chef - API to verify if service has an active chef
router.get('/check-service-chef', authenticateToken, async (req, res) => {
  const { service_id, exclude_staff_id, exclude_user_id } = req.query;
  try {
    const existingChef = await checkExistingChefDeService(
      service_id ? Number(service_id) : null,
      exclude_staff_id ? Number(exclude_staff_id) : null,
      exclude_user_id ? Number(exclude_user_id) : null
    );
    res.json({
      has_chef: !!existingChef,
      chef: existingChef || null
    });
  } catch (err) {
    console.error('Check service chef error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification du chef de service.' });
  }
});

// GET /api/staff - List staff directory unified with Users repository (Rules 1 & 14)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, query, is_driver, service_id } = req.query;
    let sql = `
      SELECT st.id, st.user_id,
             COALESCE(u.matricule, st.matricule) as matricule,
             COALESCE(u.last_name, st.nom) as nom,
             COALESCE(u.first_name, st.prenoms) as prenoms,
             COALESCE(st.titre, u.titre, 'M.') as titre,
             st.nationality,
             COALESCE(u.function_title, st.fonction) as fonction,
             COALESCE(u.service_id, st.service_id) as service_id,
             COALESCE(u.phone, st.telephone) as telephone,
             COALESCE(u.email, st.email) as email,
             CASE 
               WHEN u.status IS NOT NULL THEN (CASE WHEN u.status = 'ACTIVE' THEN 'ACTIF' ELSE 'INACTIF' END)
               ELSE st.status 
             END as status,
             st.is_driver,
             u.id as linked_user_id,
             u.user_uid,
             u.role_id,
             r.name as role_name,
             r.code as role_code,
             s.name as service_name, s.code as service_code,
             COALESCE(st.vehicle_registration, (SELECT v.registration_number FROM vehicles v WHERE v.assigned_staff_id = st.id ORDER BY v.id DESC LIMIT 1)) as vehicle_registration, 
             COALESCE(st.vehicle_brand, (SELECT v.brand FROM vehicles v WHERE v.assigned_staff_id = st.id ORDER BY v.id DESC LIMIT 1)) as vehicle_brand, 
             COALESCE(st.vehicle_model, (SELECT v.model FROM vehicles v WHERE v.assigned_staff_id = st.id ORDER BY v.id DESC LIMIT 1)) as vehicle_model,
             st.personal_vehicle_registration,
             st.personal_vehicle_brand,
             st.personal_vehicle_model,
             (SELECT us.signature_image_path FROM user_signatures us WHERE us.user_id = COALESCE(st.user_id, u.id) AND (us.status = 'ACTIVE' OR us.is_active = 1) ORDER BY us.id DESC LIMIT 1) as signature_image_path,
             pos.id as position_id, pos.code as position_code, pos.title as position_title, pos.is_unique as position_is_unique,
             sa.id as active_assignment_id, sa.start_date as assignment_start_date
      FROM staff st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN services s ON COALESCE(u.service_id, st.service_id) = s.id
      LEFT JOIN staff_assignments sa ON st.id = sa.staff_id AND sa.status = 'ACTIVE' AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE)
      LEFT JOIN positions pos ON sa.position_id = pos.id
      WHERE 1=1
    `;
    const params = [];

    if (service_id && !isNaN(Number(service_id)) && Number(service_id) > 0) {
      sql += ' AND COALESCE(u.service_id, st.service_id) = ?';
      params.push(Number(service_id));
    }

    if (status && status.trim() && status !== 'undefined' && status !== 'null') {
      sql += ` AND (CASE 
        WHEN u.status IS NOT NULL THEN (CASE WHEN u.status = 'ACTIVE' THEN 'ACTIF' ELSE 'INACTIF' END)
        ELSE st.status 
      END) = ?`;
      params.push(status.trim());
    }

    if (is_driver === 'true' || is_driver === '1') {
      sql += ' AND st.is_driver = 1';
    }

    if (query && query.trim() && query !== 'undefined' && query !== 'null') {
      sql += ` AND (
        st.nom LIKE ? OR st.prenoms LIKE ? OR st.matricule LIKE ? OR st.fonction LIKE ? OR st.telephone LIKE ? OR st.email LIKE ?
        OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.matricule LIKE ? OR u.email LIKE ?
      )`;
      const q = `%${query.trim()}%`;
      params.push(q, q, q, q, q, q, q, q, q, q);
    }

    sql += ' ORDER BY COALESCE(u.last_name, st.nom) COLLATE NOCASE ASC, COALESCE(u.first_name, st.prenoms) COLLATE NOCASE ASC';

    const staffList = await db.all(sql, params);
    res.json(staffList);
  } catch (err) {
    console.error('Fetch staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du répertoire du personnel.' });
  }
});

// GET /api/staff/:id/signature - Get active signature for a staff member
router.get('/:id/signature', authenticateToken, async (req, res) => {
  try {
    const staffId = req.params.id;
    const staff = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) return res.status(404).json({ error: 'Membre du personnel introuvable.' });

    let sig = null;
    if (staff.user_id) {
      sig = await db.get(
        `SELECT us.*, u.first_name, u.last_name, u.email, u.matricule
         FROM user_signatures us
         JOIN users u ON us.user_id = u.id
         WHERE us.user_id = ? AND (us.status = 'ACTIVE' OR us.is_active = 1)
         ORDER BY us.id DESC LIMIT 1`,
        [staff.user_id]
      );
    }
    if (!sig && staff.matricule) {
      const u = await db.get('SELECT id FROM users WHERE matricule = ?', [staff.matricule]);
      if (u) {
        sig = await db.get(
          `SELECT us.*, u.first_name, u.last_name, u.email, u.matricule
           FROM user_signatures us
           JOIN users u ON us.user_id = u.id
           WHERE us.user_id = ? AND (us.status = 'ACTIVE' OR us.is_active = 1)
           ORDER BY us.id DESC LIMIT 1`,
          [u.id]
        );
      }
    }
    res.json(sig || null);
  } catch (err) {
    console.error('Fetch staff signature error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la signature du personnel.' });
  }
});

// GET /api/staff/check-duplicate - Check duplicate personnel & users (Rule 18)
router.get('/check-duplicate', authenticateToken, async (req, res) => {
  const { matricule, nom, prenoms, email } = req.query;

  try {
    let matchStaff = null;
    let matchUser = null;

    if (matricule && matricule.trim()) {
      matchStaff = await db.get('SELECT * FROM staff WHERE matricule = ?', [matricule.trim()]);
      matchUser = await db.get('SELECT * FROM users WHERE matricule = ?', [matricule.trim()]);
    }

    if (!matchStaff && !matchUser && email && email.trim()) {
      matchStaff = await db.get('SELECT * FROM staff WHERE LOWER(email) = LOWER(?)', [email.trim()]);
      matchUser = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    }

    if (!matchStaff && !matchUser && nom && prenoms) {
      matchStaff = await db.get(
        'SELECT * FROM staff WHERE (LOWER(nom) = LOWER(?) AND LOWER(prenoms) = LOWER(?)) OR (LOWER(nom) = LOWER(?) AND LOWER(prenoms) = LOWER(?))',
        [nom.trim(), prenoms.trim(), prenoms.trim(), nom.trim()]
      );
      matchUser = await db.get(
        'SELECT * FROM users WHERE (LOWER(last_name) = LOWER(?) AND LOWER(first_name) = LOWER(?)) OR (LOWER(last_name) = LOWER(?) AND LOWER(first_name) = LOWER(?))',
        [nom.trim(), prenoms.trim(), prenoms.trim(), nom.trim()]
      );
    }

    const hasDuplicate = !!(matchStaff || matchUser);
    res.json({
      duplicate: hasDuplicate,
      staff: matchStaff || null,
      user: matchUser || null
    });
  } catch (err) {
    console.error('Check duplicate staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification des doublons.' });
  }
});

// GET /api/staff/:id - Detailed staff card & mission history (Rules 15 & 16)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const staffId = req.params.id;
    const staffMember = await db.get(
      `SELECT st.id, st.user_id,
              COALESCE(u.matricule, st.matricule) as matricule,
              COALESCE(u.last_name, st.nom) as nom,
              COALESCE(u.first_name, st.prenoms) as prenoms,
              st.nationality,
              COALESCE(u.function_title, st.fonction) as fonction,
              COALESCE(u.service_id, st.service_id) as service_id,
              COALESCE(u.phone, st.telephone) as telephone,
              COALESCE(u.email, st.email) as email,
              CASE 
                WHEN u.status IS NOT NULL THEN (CASE WHEN u.status = 'ACTIVE' THEN 'ACTIF' ELSE 'INACTIF' END)
                ELSE st.status 
              END as status,
              st.is_driver,
              u.id as linked_user_id,
              u.user_uid,
              u.role_id,
              r.name as role_name,
              r.code as role_code,
              s.name as service_name, s.code as service_code,
              COALESCE(st.vehicle_registration, v.registration_number) as vehicle_registration, 
              COALESCE(st.vehicle_brand, v.brand) as vehicle_brand, 
              COALESCE(st.vehicle_model, v.model) as vehicle_model,
              st.personal_vehicle_registration,
              st.personal_vehicle_brand,
              st.personal_vehicle_model,
              (SELECT us.signature_image_path FROM user_signatures us WHERE us.user_id = COALESCE(st.user_id, u.id) AND (us.status = 'ACTIVE' OR us.is_active = 1) ORDER BY us.id DESC LIMIT 1) as signature_image_path
       FROM staff st
       LEFT JOIN users u ON st.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN services s ON COALESCE(u.service_id, st.service_id) = s.id
       LEFT JOIN vehicles v ON v.assigned_staff_id = st.id
       WHERE st.id = ?`,
      [staffId]
    );

    if (!staffMember) {
      return res.status(404).json({ error: 'Membre du personnel non trouvé.' });
    }

    // Fetch personal vehicles (Multi-vehicles)
    const personalVehicles = await db.all(
      `SELECT * FROM personal_vehicles WHERE staff_id = ? ORDER BY status ASC, created_at DESC`,
      [staffId]
    );

    // Fetch assigned University fleet service vehicles
    const assignedVehicles = await db.all(
      `SELECT v.*, srv.name AS service_name, srv.code AS service_code,
              d.nom AS default_driver_nom, d.prenoms AS default_driver_prenoms, d.telephone AS default_driver_telephone
       FROM vehicles v
       LEFT JOIN services srv ON v.assigned_service_id = srv.id
       LEFT JOIN drivers d ON v.default_driver_id = d.id
       WHERE v.assigned_staff_id = ?
       ORDER BY v.registration_number ASC`,
      [staffId]
    );

    const formattedAssignedVehicles = assignedVehicles.map(v => ({
      ...v,
      default_driver_full_name: v.default_driver_nom ? `${v.default_driver_prenoms || ''} ${v.default_driver_nom}`.trim() : null
    }));

    // Fetch attached drivers (Multi-drivers)
    const attachedDrivers = await db.all(
      `SELECT sd.id AS staff_driver_id, sd.staff_id, sd.driver_id, sd.is_default, sd.notes AS attachment_notes, sd.created_at AS attached_at,
              d.matricule, d.nom, d.prenoms, d.telephone, d.license_number, d.status AS driver_status,
              srv.name AS driver_service_name
       FROM staff_drivers sd
       JOIN drivers d ON sd.driver_id = d.id
       LEFT JOIN services srv ON d.service_id = srv.id
       WHERE sd.staff_id = ?
       ORDER BY sd.is_default DESC, d.nom ASC, d.prenoms ASC`,
      [staffId]
    );

    const formattedAttachedDrivers = attachedDrivers.map(d => ({
      ...d,
      full_name: `${d.prenoms || ''} ${d.nom}`.trim()
    }));

    // Fetch mission history (Rule 16)
    const missions = await db.all(
      `SELECT d.reference, d.status, d.created_at, mo.destination, mo.object_of_mission, mo.departure_date, mo.return_date, mo.is_signed
       FROM documents d
       JOIN mission_orders mo ON d.id = mo.document_id
       WHERE d.status != 'TRASHED' AND (mo.missionary_id = ? OR mo.driver_id = ?)
       ORDER BY d.created_at DESC`,
      [staffId, staffId]
    );

    // Fetch career assignments history (Parcours Professionnel)
    const careerHistory = await assignmentService.getStaffCareerHistory(staffId);
    const activeAssignment = careerHistory.find(a => a.status === 'ACTIVE' && (!a.end_date || new Date(a.end_date) >= new Date())) || null;

    res.json({
      staff: staffMember,
      active_assignment: activeAssignment,
      career_history: careerHistory || [],
      assignments: careerHistory || [],
      personal_vehicles: personalVehicles || [],
      assigned_vehicles: formattedAssignedVehicles || [],
      attached_drivers: formattedAttachedDrivers || [],
      missions: missions || []
    });
  } catch (err) {
    console.error('Fetch staff detail error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la fiche du personnel.' });
  }
});

// GET /api/staff/:id/assignments - Get staff career assignments history
router.get('/:id/assignments', authenticateToken, async (req, res) => {
  try {
    const history = await assignmentService.getStaffCareerHistory(req.params.id);
    res.json(history);
  } catch (err) {
    console.error('Fetch staff assignments error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des affectations.' });
  }
});

// POST /api/staff/:id/assignments - Mutate, Promote or Reassign staff to a position
router.post('/:id/assignments', authenticateToken, requirePermission('personnel.edit'), async (req, res) => {
  const staffId = req.params.id;
  const { position_id, service_id, start_date, motive, appointment_act_ref, role_id } = req.body;

  if (!position_id) {
    return res.status(400).json({ error: 'Le poste est obligatoire.' });
  }

  try {
    const result = await assignmentService.assignStaffToPosition({
      staffId: Number(staffId),
      positionId: Number(position_id),
      serviceId: service_id ? Number(service_id) : null,
      startDate: start_date,
      motive,
      appointmentActRef: appointment_act_ref,
      createdByUserId: req.user.id
    });

    // If role_id provided and staff is linked to user account, update role
    if (role_id) {
      const staff = await db.get('SELECT user_id FROM staff WHERE id = ?', [staffId]);
      if (staff?.user_id) {
        await db.run('UPDATE users SET role_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [Number(role_id), staff.user_id]);
      }
    }

    await logAuditAction(req.user.id, 'ASSIGN_STAFF_POSITION', 'STAFF', staffId, req, {
      staff_id: staffId,
      position_id,
      service_id,
      start_date,
      motive
    });

    res.json({
      success: true,
      message: 'Nouvelle affectation enregistrée avec succès. L’ancienne a été clôturée dans l’historique.',
      ...result
    });
  } catch (err) {
    console.error('Assign staff error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/staff/:id/assignments/:assignmentId/terminate - Terminate active assignment
router.post('/:id/assignments/:assignmentId/terminate', authenticateToken, requirePermission('personnel.edit'), async (req, res) => {
  const { id: staffId, assignmentId } = req.params;
  const { end_date, motive } = req.body;

  try {
    const result = await assignmentService.terminateAssignment({
      staffId: Number(staffId),
      assignmentId: Number(assignmentId),
      endDate: end_date,
      motive
    });

    await logAuditAction(req.user.id, 'TERMINATE_STAFF_ASSIGNMENT', 'STAFF', staffId, req, {
      staff_id: staffId,
      assignment_id: assignmentId,
      end_date,
      motive
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Terminate assignment error:', err);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/staff/:id/career-events - Enregistrer un événement de carrière officiel (Retraite, Limogeage, Suspension, Mutation, Réintégration)
router.post('/:id/career-events', authenticateToken, requirePermission('personnel.edit'), async (req, res) => {
  const staffId = req.params.id;
  const { event_type, effective_date, position_id, service_id, motive, reference_decision, role_id } = req.body;

  try {
    const result = await assignmentService.recordCareerEvent({
      staff_id: Number(staffId),
      event_type,
      effective_date,
      position_id,
      service_id,
      motive,
      reference_decision,
      created_by_user_id: req.user.id
    });

    // If role_id provided and staff is linked to user account, update role
    if (role_id && event_type === 'MUTATION') {
      const staff = await db.get('SELECT user_id FROM staff WHERE id = ?', [staffId]);
      if (staff?.user_id) {
        await db.run('UPDATE users SET role_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [Number(role_id), staff.user_id]);
      }
    }

    await logAuditAction(req.user.id, `CAREER_EVENT_${event_type}`, 'STAFF', staffId, req, {
      staff_id: staffId,
      event_type,
      effective_date,
      position_id,
      service_id,
      motive,
      reference_decision
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Career event error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Helper to ensure a linked user account exists for assigning a signature
async function getOrCreateLinkedUserForStaff(staffId, staffData) {
  const staff = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
  if (!staff) return null;

  if (staff.user_id) {
    return staff.user_id;
  }

  // Check if existing user by matricule or email
  let existingUser = null;
  if (staff.matricule) {
    existingUser = await db.get('SELECT id FROM users WHERE matricule = ?', [staff.matricule]);
  }
  if (!existingUser && staff.email) {
    existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [staff.email]);
  }

  if (existingUser) {
    await db.run('UPDATE staff SET user_id = ? WHERE id = ?', [existingUser.id, staffId]);
    return existingUser.id;
  }

  // Create minimal user account
  const matricule = staff.matricule || `UK-STAFF-${staffId}`;
  const userUid = accountSecurityService.generateUserUid();
  const defaultPass = await bcrypt.hash('UnivKindia@2026', 10);
  const defaultRole = await db.get('SELECT id FROM roles WHERE code = "AGENT" OR code = "SECRÉTAIRE_CENTRAL" ORDER BY id ASC LIMIT 1');
  const roleId = defaultRole ? defaultRole.id : 5;

  const userTitre = staff.titre ? staff.titre.trim() : 'M.';
  const result = await db.run(
    `INSERT INTO users (user_uid, matricule, first_name, last_name, titre, email, phone, function_title, service_id, role_id, password_hash, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [
      userUid,
      matricule,
      staff.prenoms || 'Personnel',
      staff.nom || 'UK',
      userTitre,
      staff.email || `${matricule.toLowerCase().replace(/[^a-z0-9]/g, '')}@univ-kindia.edu.gn`,
      staff.telephone || '',
      staff.fonction || 'Agent',
      staff.service_id || null,
      roleId,
      defaultPass
    ]
  );

  const newUserId = result.lastID;
  await db.run('UPDATE staff SET user_id = ? WHERE id = ?', [newUserId, staffId]);
  return newUserId;
}

// POST /api/staff - Add or link staff member (Rules 2, 3, 4) + Optional Signature & System Account
router.post('/', authenticateToken, requirePermission('personnel.create'), uploadStaff.single('signature'), async (req, res) => {
  const {
    nom, prenoms, titre, nationality, fonction, service_id, matricule, telephone, email,
    status, is_driver, 
    vehicle_registration, vehicle_brand, vehicle_model,
    personal_vehicle_registration, personal_vehicle_brand, personal_vehicle_model,
    signature_base64,
    create_account, enable_system_access, role_id, password, is_chef_service
  } = req.body;

  if (!nom || !prenoms || !fonction) {
    return res.status(400).json({ error: 'Nom, prénoms et fonction sont obligatoires.' });
  }

  try {
    // Check if matching user exists to link user_id
    let linkedUserId = null;
    if (matricule && matricule.trim()) {
      const uMat = await db.get('SELECT id FROM users WHERE matricule = ?', [matricule.trim()]);
      if (uMat) linkedUserId = uMat.id;
    }
    if (!linkedUserId && email && email.trim()) {
      const uEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
      if (uEmail) linkedUserId = uEmail.id;
    }

    if (matricule && matricule.trim()) {
      const existingMatricule = await db.get('SELECT id FROM staff WHERE matricule = ?', [matricule.trim()]);
      if (existingMatricule) {
        return res.status(400).json({ error: `Le matricule [${matricule}] est déjà attribué à un membre du personnel.` });
      }
    }

    // Check if designated as Chef de Service and if the service already has one
    let targetRoleId = role_id ? Number(role_id) : null;
    let isDesignatedChef = is_chef_service === true || is_chef_service === 'true' || is_chef_service === 1 || is_chef_service === '1';
    if (!isDesignatedChef && targetRoleId) {
      const selectedRole = await db.get('SELECT code FROM roles WHERE id = ?', [targetRoleId]);
      if (selectedRole?.code === 'CHEF_SERVICE' || selectedRole?.code === 'RESPONSABLE_SERVICE') isDesignatedChef = true;
    }
    if (!isDesignatedChef && fonction && (fonction.toLowerCase().trim().startsWith('chef de service') || fonction.toLowerCase().trim().startsWith('responsable de service') || fonction.toLowerCase().trim().startsWith('chef du service'))) {
      isDesignatedChef = true;
    }

    if (isDesignatedChef && service_id) {
      const existingChef = await checkExistingChefDeService(service_id, null, linkedUserId);
      if (existingChef) {
        return res.status(400).json({
          error: `Enregistrement refusé : Le service « ${existingChef.service_name || 'sélectionné'} » possède déjà un Chef de Service actif (${existingChef.first_name} ${existingChef.last_name}). Un service ne peut avoir qu'un seul Chef de Service à la fois.`
        });
      }
    }

    const isDriverVal = (is_driver === true || is_driver === 'true' || is_driver === 1 || is_driver === '1') ? 1 : 0;

    const result = await db.run(
      `INSERT INTO staff (
         user_id, matricule, nom, prenoms, titre, nationality, fonction, service_id, 
         telephone, email, status, is_driver, 
         vehicle_registration, vehicle_brand, vehicle_model, 
         personal_vehicle_registration, personal_vehicle_brand, personal_vehicle_model
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        linkedUserId,
        matricule ? matricule.trim() : null,
        nom.trim().toUpperCase(),
        prenoms.trim(),
        titre ? titre.trim() : 'M.',
        nationality || 'Guinéenne',
        fonction.trim(),
        service_id || null,
        telephone || '',
        email || '',
        status || 'ACTIF',
        isDriverVal,
        vehicle_registration ? vehicle_registration.trim() : null,
        vehicle_brand ? vehicle_brand.trim() : null,
        vehicle_model ? vehicle_model.trim() : null,
        personal_vehicle_registration ? personal_vehicle_registration.trim() : null,
        personal_vehicle_brand ? personal_vehicle_brand.trim() : null,
        personal_vehicle_model ? personal_vehicle_model.trim() : null
      ]
    );

    const staffId = result.lastID;

    // Determine if we need to create/update a system user account
    const shouldCreateAccount = create_account === true || create_account === 'true' 
      || enable_system_access === true || enable_system_access === 'true' 
      || Boolean(role_id) || Boolean(password) || Boolean(is_chef_service);

    if (shouldCreateAccount) {
      let resolvedRoleId = role_id ? Number(role_id) : null;
      if (!resolvedRoleId && is_chef_service) {
        const chefRole = await db.get("SELECT id FROM roles WHERE code = 'CHEF_SERVICE' LIMIT 1");
        if (chefRole) resolvedRoleId = chefRole.id;
      }
      if (!resolvedRoleId) {
        const defaultRole = await db.get("SELECT id FROM roles WHERE code = 'AGENT' OR code = 'UTILISATEUR_STANDARD' ORDER BY id ASC LIMIT 1");
        resolvedRoleId = defaultRole ? defaultRole.id : 5;
      }

      if (linkedUserId) {
        let updateSql = `UPDATE users SET first_name = ?, last_name = ?, matricule = ?, email = ?, phone = ?, function_title = ?, service_id = ?, role_id = ?, status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP`;
        const updateParams = [prenoms.trim(), nom.trim().toUpperCase(), matricule ? matricule.trim() : null, email || '', telephone || '', fonction.trim(), service_id || null, resolvedRoleId];
        if (password && password.trim()) {
          const passHash = await bcrypt.hash(password.trim(), 10);
          updateSql += `, password_hash = ?`;
          updateParams.push(passHash);
        }
        updateSql += ` WHERE id = ?`;
        updateParams.push(linkedUserId);
        await db.run(updateSql, updateParams);
      } else {
        const userUid = accountSecurityService.generateUserUid();
        const initialPass = (password && password.trim()) ? password.trim() : 'UnivKindia@2026';
        const passHash = await bcrypt.hash(initialPass, 10);
        const effectiveMatricule = matricule ? matricule.trim() : `UK-STAFF-${staffId}`;
        const effectiveEmail = email && email.trim() ? email.trim() : `${effectiveMatricule.toLowerCase().replace(/[^a-z0-9]/g, '')}@univ-kindia.edu.gn`;

        const cleanTitre = titre ? titre.trim() : 'M.';
        const userRes = await db.run(
          `INSERT INTO users (user_uid, matricule, first_name, last_name, titre, email, phone, function_title, service_id, role_id, password_hash, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
          [
            userUid,
            effectiveMatricule,
            prenoms.trim(),
            nom.trim().toUpperCase(),
            cleanTitre,
            effectiveEmail,
            telephone || '',
            fonction.trim(),
            service_id || null,
            resolvedRoleId,
            passHash
          ]
        );
        linkedUserId = userRes.lastID;
        await db.run('UPDATE staff SET user_id = ? WHERE id = ?', [linkedUserId, staffId]);
      }
    }

    // Optional Signature Attribution
    let signaturePath = null;
    if (req.file) {
      signaturePath = `/uploads/signatures/${req.file.filename}`;
    } else if (signature_base64) {
      signaturePath = saveBase64Signature(signature_base64);
    }

    if (signaturePath) {
      const targetUserId = linkedUserId || await getOrCreateLinkedUserForStaff(staffId, { nom, prenoms, matricule, fonction, service_id, email, telephone });
      if (targetUserId) {
        // Deactivate previous active signatures
        await db.run("UPDATE user_signatures SET status = 'INACTIVE', is_active = 0 WHERE user_id = ?", [targetUserId]);

        const sigResult = await db.run(
          `INSERT INTO user_signatures (user_id, function_title, service_id, signature_image_path, version_number, activation_date, status, is_active, created_by)
           VALUES (?, ?, ?, ?, 1, CURRENT_DATE, 'ACTIVE', 1, ?)`,
          [targetUserId, fonction.trim(), service_id || null, signaturePath, req.user.id]
        );
        const sigId = sigResult.lastID;
        await db.run(
          `INSERT INTO signature_versions (signature_id, version_number, signature_image_path, change_description, is_active, created_by)
           VALUES (?, 1, ?, 'Version initiale attribuée depuis la fiche personnel', 1, ?)`,
          [sigId, signaturePath, req.user.id]
        );
      }
    }

    // Automatically apply as Chef de Service in Services module if designated and vacant
    if (isDesignatedChef && service_id && linkedUserId) {
      await syncServiceChefAssignment({
        serviceId: Number(service_id),
        userId: linkedUserId,
        fonctionTitle: fonction ? fonction.trim() : 'Chef de Service',
        isChef: true
      });
    }

    // Ensure linked user account has synchronized fonction / function_title
    if (linkedUserId) {
      await db.run(
        `UPDATE users SET function_title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [fonction.trim(), linkedUserId]
      );
    }

    // Automatically record initial assignment in staff_assignments
    try {
      let targetPosId = req.body.position_id ? Number(req.body.position_id) : null;
      if (!targetPosId && fonction) {
        const found = await db.get('SELECT id FROM positions WHERE LOWER(title) = LOWER(?) OR LOWER(code) = LOWER(?)', [fonction.trim(), fonction.trim()]);
        if (found) {
          targetPosId = found.id;
        } else {
          const posCode = 'POS_' + fonction.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 25) + '_' + Date.now().toString().slice(-4);
          const posRes = await db.run(
            `INSERT INTO positions (code, title, category, is_unique, service_id, status) VALUES (?, ?, 'ADMINISTRATIF', 0, ?, 'ACTIVE')`,
            [posCode, fonction.trim(), service_id ? Number(service_id) : null]
          );
          targetPosId = posRes.lastID;
        }
      }
      if (targetPosId) {
        await assignmentService.assignStaffToPosition({
          staffId,
          positionId: targetPosId,
          serviceId: service_id || null,
          startDate: req.body.start_date || null,
          motive: req.body.motive || 'Affectation initiale',
          appointmentActRef: req.body.appointment_act_ref || null,
          fonction: fonction.trim(),
          createdByUserId: req.user.id
        });
      }
    } catch (assignErr) {
      console.warn('Initial assignment creation warning:', assignErr.message);
    }

    await logAuditAction(req.user.id, 'CREATE_STAFF', 'STAFF', staffId, req, { nom, prenoms, matricule, linkedUserId, hasSignature: !!signaturePath, is_chef: isDesignatedChef });

    res.status(201).json({
      success: true,
      message: `Membre du personnel ${nom} ${prenoms} enregistré avec succès.`,
      id: staffId,
      user_id: linkedUserId,
      signature_url: signaturePath
    });
  } catch (err) {
    console.error('Create staff error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement du membre du personnel.' });
  }
});

// PUT /api/staff/:id - Update staff member & synchronize with User account + Optional Signature Attribution
router.put('/:id', authenticateToken, requirePermission('personnel.edit'), uploadStaff.single('signature'), async (req, res) => {
  try {
    const staffId = req.params.id;
    const {
      nom, prenoms, titre, nationality, fonction, service_id, matricule, telephone, email,
      status, is_driver, 
      vehicle_registration, vehicle_brand, vehicle_model,
      personal_vehicle_registration, personal_vehicle_brand, personal_vehicle_model,
      signature_base64,
      create_account, enable_system_access, role_id, password, is_chef_service
    } = req.body;

    const existing = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!existing) {
      return res.status(404).json({ error: 'Membre du personnel introuvable.' });
    }

    if (matricule && matricule.trim() && matricule.trim() !== existing.matricule) {
      const dup = await db.get('SELECT id FROM staff WHERE matricule = ? AND id != ?', [matricule.trim(), staffId]);
      if (dup) return res.status(400).json({ error: `Le matricule [${matricule}] est déjà utilisé.` });
    }

    const updatedMatricule = matricule ? matricule.trim() : existing.matricule;
    const updatedNom = nom ? nom.trim().toUpperCase() : existing.nom;
    const updatedPrenoms = prenoms ? prenoms.trim() : existing.prenoms;
    const updatedTitre = titre !== undefined ? (titre ? titre.trim() : 'M.') : (existing.titre || 'M.');
    const updatedNationality = nationality || existing.nationality;
    const updatedFonction = fonction ? fonction.trim() : existing.fonction;
    const updatedServiceId = service_id !== undefined ? (service_id || null) : existing.service_id;
    const updatedTelephone = telephone !== undefined ? telephone : existing.telephone;
    const updatedEmail = email !== undefined ? email : existing.email;
    const updatedStatus = status || existing.status;
    const isDriverVal = (is_driver === true || is_driver === 'true' || is_driver === 1 || is_driver === '1') ? 1 : (is_driver === false || is_driver === 'false' || is_driver === 0 || is_driver === '0' ? 0 : existing.is_driver);
    const updatedVehReg = vehicle_registration !== undefined ? (vehicle_registration ? vehicle_registration.trim() : null) : existing.vehicle_registration;
    const updatedVehBrand = vehicle_brand !== undefined ? (vehicle_brand ? vehicle_brand.trim() : null) : existing.vehicle_brand;
    const updatedVehModel = vehicle_model !== undefined ? (vehicle_model ? vehicle_model.trim() : null) : existing.vehicle_model;
    const updatedPersVehReg = personal_vehicle_registration !== undefined ? (personal_vehicle_registration ? personal_vehicle_registration.trim() : null) : existing.personal_vehicle_registration;
    const updatedPersVehBrand = personal_vehicle_brand !== undefined ? (personal_vehicle_brand ? personal_vehicle_brand.trim() : null) : existing.personal_vehicle_brand;
    const updatedPersVehModel = personal_vehicle_model !== undefined ? (personal_vehicle_model ? personal_vehicle_model.trim() : null) : existing.personal_vehicle_model;

    // Check if designated as Chef de Service and if the service already has another active chef
    let targetRoleId = role_id ? Number(role_id) : null;
    let isDesignatedChef = is_chef_service === true || is_chef_service === 'true' || is_chef_service === 1 || is_chef_service === '1';
    if (!isDesignatedChef && targetRoleId) {
      const selectedRole = await db.get('SELECT code FROM roles WHERE id = ?', [targetRoleId]);
      if (selectedRole?.code === 'CHEF_SERVICE' || selectedRole?.code === 'RESPONSABLE_SERVICE') isDesignatedChef = true;
    }
    if (!isDesignatedChef && updatedFonction && (updatedFonction.toLowerCase().trim().startsWith('chef de service') || updatedFonction.toLowerCase().trim().startsWith('responsable de service') || updatedFonction.toLowerCase().trim().startsWith('chef du service'))) {
      isDesignatedChef = true;
    }

    if (isDesignatedChef && updatedServiceId) {
      const existingChef = await checkExistingChefDeService(updatedServiceId, staffId, existing.user_id);
      if (existingChef) {
        return res.status(400).json({
          error: `Modification refusée : Le service « ${existingChef.service_name || 'sélectionné'} » possède déjà un Chef de Service actif (${existingChef.first_name} ${existingChef.last_name}). Un service ne peut avoir qu'un seul Chef de Service à la fois.`
        });
      }
    }

    await db.run(
      `UPDATE staff SET
         matricule = ?, nom = ?, prenoms = ?, titre = ?, nationality = ?, fonction = ?, service_id = ?,
         telephone = ?, email = ?, status = ?, is_driver = ?,
         vehicle_registration = ?, vehicle_brand = ?, vehicle_model = ?,
         personal_vehicle_registration = ?, personal_vehicle_brand = ?, personal_vehicle_model = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        updatedMatricule,
        updatedNom,
        updatedPrenoms,
        updatedTitre,
        updatedNationality,
        updatedFonction,
        updatedServiceId,
        updatedTelephone,
        updatedEmail,
        updatedStatus,
        isDriverVal,
        updatedVehReg,
        updatedVehBrand,
        updatedVehModel,
        updatedPersVehReg,
        updatedPersVehBrand,
        updatedPersVehModel,
        staffId
      ]
    );

    let targetUserId = existing.user_id;
    if (!targetUserId && updatedMatricule) {
      const uMat = await db.get('SELECT id FROM users WHERE matricule = ?', [updatedMatricule]);
      if (uMat) {
        targetUserId = uMat.id;
        await db.run('UPDATE staff SET user_id = ? WHERE id = ?', [targetUserId, staffId]);
      }
    }
    if (!targetUserId && updatedEmail) {
      const uEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [updatedEmail]);
      if (uEmail) {
        targetUserId = uEmail.id;
        await db.run('UPDATE staff SET user_id = ? WHERE id = ?', [targetUserId, staffId]);
      }
    }

    // Handle User Account Creation or Update
    const shouldHaveAccount = targetUserId || create_account === true || create_account === 'true' 
      || enable_system_access === true || enable_system_access === 'true' 
      || Boolean(role_id) || Boolean(password) || Boolean(is_chef_service);

    if (shouldHaveAccount) {
      let resolvedRoleId = role_id ? Number(role_id) : null;
      if (!resolvedRoleId && is_chef_service) {
        const chefRole = await db.get("SELECT id FROM roles WHERE code = 'CHEF_SERVICE' LIMIT 1");
        if (chefRole) resolvedRoleId = chefRole.id;
      }

      if (targetUserId) {
        const userStatus = updatedStatus === 'INACTIF' ? 'INACTIVE' : 'ACTIVE';
        let updateSql = `UPDATE users SET
           matricule = ?, first_name = ?, last_name = ?, titre = ?, email = ?, phone = ?, function_title = ?,
           service_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP`;
        const updateParams = [
          updatedMatricule,
          updatedPrenoms,
          updatedNom,
          updatedTitre,
          updatedEmail,
          updatedTelephone,
          updatedFonction,
          updatedServiceId,
          userStatus
        ];

        if (resolvedRoleId) {
          updateSql += `, role_id = ?`;
          updateParams.push(resolvedRoleId);
        }

        if (password && password.trim()) {
          const passHash = await bcrypt.hash(password.trim(), 10);
          updateSql += `, password_hash = ?`;
          updateParams.push(passHash);
        }

        updateSql += ` WHERE id = ?`;
        updateParams.push(targetUserId);
        await db.run(updateSql, updateParams);
      } else {
        targetUserId = await getOrCreateLinkedUserForStaff(staffId, {
          nom: updatedNom,
          prenoms: updatedPrenoms,
          matricule: updatedMatricule,
          titre: updatedTitre,
          fonction: updatedFonction,
          service_id: updatedServiceId,
          email: updatedEmail,
          telephone: updatedTelephone
        });
        if (resolvedRoleId || (password && password.trim())) {
          let extraSql = `UPDATE users SET updated_at = CURRENT_TIMESTAMP`;
          const extraParams = [];
          if (resolvedRoleId) {
            extraSql += `, role_id = ?`;
            extraParams.push(resolvedRoleId);
          }
          if (password && password.trim()) {
            const passHash = await bcrypt.hash(password.trim(), 10);
            extraSql += `, password_hash = ?`;
            extraParams.push(passHash);
          }
          extraSql += ` WHERE id = ?`;
          extraParams.push(targetUserId);
          await db.run(extraSql, extraParams);
        }
      }
    } else if (targetUserId) {
      // Even if no full account creation is requested, ensure user function_title remains synchronized
      await db.run(
        `UPDATE users SET function_title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [updatedFonction, targetUserId]
      );
    }

    // Process Optional Signature Attribution
    let signaturePath = null;
    if (req.file) {
      signaturePath = `/uploads/signatures/${req.file.filename}`;
    } else if (signature_base64) {
      signaturePath = saveBase64Signature(signature_base64);
    }

    if (signaturePath) {
      if (!targetUserId) {
        targetUserId = await getOrCreateLinkedUserForStaff(staffId, {
          nom: updatedNom,
          prenoms: updatedPrenoms,
          matricule: updatedMatricule,
          fonction: updatedFonction,
          service_id: updatedServiceId,
          email: updatedEmail,
          telephone: updatedTelephone
        });
      }

      if (targetUserId) {
        // Check if an active signature already exists
        const existingSig = await db.get(
          'SELECT id, version_number FROM user_signatures WHERE user_id = ? AND (status = "ACTIVE" OR is_active = 1) ORDER BY id DESC LIMIT 1',
          [targetUserId]
        );

        if (existingSig) {
          const nextVersion = (existingSig.version_number || 1) + 1;
          await db.run('UPDATE signature_versions SET is_active = 0 WHERE signature_id = ?', [existingSig.id]);
          await db.run(
            `INSERT INTO signature_versions (signature_id, version_number, signature_image_path, change_description, is_active, created_by)
             VALUES (?, ?, ?, 'Mise à jour de signature depuis la fiche personnel', 1, ?)`,
            [existingSig.id, nextVersion, signaturePath, req.user.id]
          );
          await db.run(
            `UPDATE user_signatures 
             SET signature_image_path = ?, version_number = ?, function_title = ?, service_id = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [signaturePath, nextVersion, updatedFonction, updatedServiceId, existingSig.id]
          );
        } else {
          const sigRes = await db.run(
            `INSERT INTO user_signatures (user_id, function_title, service_id, signature_image_path, version_number, activation_date, status, is_active, created_by)
             VALUES (?, ?, ?, ?, 1, CURRENT_DATE, 'ACTIVE', 1, ?)`,
            [targetUserId, updatedFonction, updatedServiceId, signaturePath, req.user.id]
          );
          const newSigId = sigRes.lastID;
          await db.run(
            `INSERT INTO signature_versions (signature_id, version_number, signature_image_path, change_description, is_active, created_by)
             VALUES (?, 1, ?, 'Version initiale attribuée depuis la fiche personnel', 1, ?)`,
            [newSigId, signaturePath, req.user.id]
          );
        }
      }
    }

    // Check if position or service changed to record mutation / assignment
    try {
      let targetPosId = req.body.position_id ? Number(req.body.position_id) : null;
      if (!targetPosId && updatedFonction && updatedFonction !== existing.fonction) {
        const found = await db.get('SELECT id FROM positions WHERE LOWER(title) = LOWER(?) OR LOWER(code) = LOWER(?)', [updatedFonction.trim(), updatedFonction.trim()]);
        if (found) {
          targetPosId = found.id;
        } else {
          const posCode = 'POS_' + updatedFonction.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 25) + '_' + Date.now().toString().slice(-4);
          const posRes = await db.run(
            `INSERT INTO positions (code, title, category, is_unique, service_id, status) VALUES (?, ?, 'ADMINISTRATIF', 0, ?, 'ACTIVE')`,
            [posCode, updatedFonction.trim(), updatedServiceId ? Number(updatedServiceId) : null]
          );
          targetPosId = posRes.lastID;
        }
      }
      if (targetPosId || (updatedServiceId !== existing.service_id) || (updatedFonction !== existing.fonction)) {
        const currentActive = await db.get('SELECT position_id FROM staff_assignments WHERE staff_id = ? AND status = "ACTIVE"', [staffId]);
        const effectivePosId = targetPosId || (currentActive ? currentActive.position_id : null);
        if (effectivePosId) {
          await assignmentService.assignStaffToPosition({
            staffId: Number(staffId),
            positionId: Number(effectivePosId),
            serviceId: updatedServiceId ? Number(updatedServiceId) : null,
            startDate: req.body.start_date || null,
            motive: req.body.motive || 'Mise à jour fiche personnel',
            appointmentActRef: req.body.appointment_act_ref || null,
            fonction: updatedFonction,
            createdByUserId: req.user.id
          });
        }
      }
    } catch (assignErr) {
      console.warn('Assignment update warning:', assignErr.message);
    }

    // Automatically apply or sync as Chef de Service in Services module
    await syncServiceChefAssignment({
      serviceId: updatedServiceId ? Number(updatedServiceId) : null,
      userId: targetUserId || existing.user_id,
      fonctionTitle: updatedFonction,
      isChef: isDesignatedChef,
      previousServiceId: existing.service_id ? Number(existing.service_id) : null,
      previousUserId: existing.user_id
    });

    await logAuditAction(req.user.id, 'UPDATE_STAFF', 'STAFF', staffId, req, {
      nom: updatedNom,
      prenoms: updatedPrenoms,
      user_id: targetUserId,
      signatureUpdated: !!signaturePath,
      is_chef: isDesignatedChef
    });

    res.json({
      success: true,
      message: 'Fiche du personnel mise à jour avec succès.',
      signature_url: signaturePath,
      staff: { id: staffId, user_id: targetUserId }
    });
  } catch (err) {
    console.error('Update staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la fiche du personnel.' });
  }
});

// Helper to parse CSV string into array of row objects
function parseCsvString(csvString) {
  if (!csvString) return [];
  // Remove BOM if present
  let cleanStr = csvString.replace(/^\uFEFF/, '').trim();
  const lines = cleanStr.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  // Determine separator: semicolon or comma or tab
  const headerLine = lines[0];
  let delimiter = ',';
  if (headerLine.includes(';') && (headerLine.split(';').length >= headerLine.split(',').length)) {
    delimiter = ';';
  } else if (headerLine.includes('\t')) {
    delimiter = '\t';
  }

  // Parse header
  const headers = headerLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const rawCols = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (rawCols.every(c => !c)) continue; // skip blank line

    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = rawCols[idx] !== undefined ? rawCols[idx] : '';
    });
    rows.push(rowObj);
  }
  return rows;
}

// POST /api/staff/import-csv - Bulk Import Personnel from CSV
router.post('/import-csv', authenticateToken, requirePermission('personnel.create'), uploadStaff.single('file'), async (req, res) => {
  try {
    let rowsToImport = [];

    if (req.file) {
      const fileContent = fs.readFileSync(req.file.path, 'utf8');
      rowsToImport = parseCsvString(fileContent);
      // Clean temp file
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    } else if (req.body.csv_text) {
      rowsToImport = parseCsvString(req.body.csv_text);
    } else if (Array.isArray(req.body.rows)) {
      rowsToImport = req.body.rows;
    } else {
      return res.status(400).json({ error: 'Veuillez fournir un fichier .CSV ou une liste de données à importer.' });
    }

    if (!rowsToImport || rowsToImport.length === 0) {
      return res.status(400).json({ error: 'Aucune donnée valide trouvée dans le fichier CSV.' });
    }

    // Cache services for fast matching
    const servicesList = await db.all('SELECT id, code, name FROM services');
    const serviceMap = {};
    servicesList.forEach(s => {
      if (s.code) serviceMap[s.code.toUpperCase()] = s.id;
      if (s.name) serviceMap[s.name.toUpperCase()] = s.id;
    });

    let importedCount = 0;
    let updatedCount = 0;
    const errors = [];

    for (let index = 0; index < rowsToImport.length; index++) {
      const row = rowsToImport[index];
      const rowNum = index + 2;

      // Map flexible header names
      const nom = (row.nom || row['nom de famille'] || row.lastname || row.last_name || '').trim();
      const prenoms = (row.prenoms || row.prenom || row['prénoms'] || row['prénom'] || row.firstname || row.first_name || '').trim();
      const fonction = (row.fonction || row.function || row['fonction officielle'] || row.titre || row.poste || 'Personnel').trim();
      const matricule = (row.matricule || row['matricule unique'] || row.matricule_unique || row.matricule_uk || '').trim();
      const nationalite = (row.nationalite || row['nationalité'] || row.nationality || 'Guinéenne').trim();
      const telephone = (row.telephone || row['téléphone'] || row.phone || row.contact || '').trim();
      const email = (row.email || row['e-mail'] || row.courriel || '').trim();
      
      const rawService = (row.service || row['service de rattachement'] || row.structure || row.service_code || row.service_name || '').trim();
      let serviceId = null;
      if (rawService) {
        const key = rawService.toUpperCase();
        if (serviceMap[key]) {
          serviceId = serviceMap[key];
        } else {
          // Partial search in services
          const matched = servicesList.find(s => 
            (s.code && s.code.toUpperCase() === key) || 
            (s.name && s.name.toUpperCase().includes(key)) ||
            (s.name && key.includes(s.name.toUpperCase()))
          );
          if (matched) serviceId = matched.id;
        }
      }

      const rawDriver = (row.is_driver || row.chauffeur || row['autorisé comme chauffeur'] || row.conducteur || '').toString().toLowerCase().trim();
      const isDriver = ['1', 'true', 'oui', 'yes', 'vrai', 'o', 'y'].includes(rawDriver) ? 1 : 0;

      const vehicleReg = (row.immatriculation || row['immatriculation véhicule'] || row.vehicle_registration || '').trim();
      const vehicleBrand = (row.marque || row['marque véhicule'] || row.vehicle_brand || '').trim();
      const vehicleModel = (row.modele || row['modèle'] || row['modèle véhicule'] || row.vehicle_model || '').trim();

      if (!nom || !prenoms) {
        errors.push(`Ligne ${rowNum} : Nom et prénoms obligatoires.`);
        continue;
      }

      try {
        // Check if matching user exists
        let linkedUserId = null;
        if (matricule) {
          const uMat = await db.get('SELECT id FROM users WHERE matricule = ?', [matricule]);
          if (uMat) linkedUserId = uMat.id;
        }
        if (!linkedUserId && email) {
          const uEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
          if (uEmail) linkedUserId = uEmail.id;
        }

        // Check if existing staff record
        let existingStaff = null;
        if (matricule) {
          existingStaff = await db.get('SELECT id, user_id FROM staff WHERE matricule = ?', [matricule]);
        }
        if (!existingStaff && email) {
          existingStaff = await db.get('SELECT id, user_id FROM staff WHERE LOWER(email) = LOWER(?)', [email]);
        }
        if (!existingStaff) {
          existingStaff = await db.get(
            'SELECT id, user_id FROM staff WHERE UPPER(nom) = UPPER(?) AND UPPER(prenoms) = UPPER(?)',
            [nom, prenoms]
          );
        }

        let staffId = null;

        if (existingStaff) {
          staffId = existingStaff.id;
          const finalUserId = existingStaff.user_id || linkedUserId;
          await db.run(
            `UPDATE staff SET
               matricule = COALESCE(?, matricule),
               nom = ?, prenoms = ?, nationality = ?, fonction = ?,
               service_id = COALESCE(?, service_id),
               telephone = COALESCE(?, telephone),
               email = COALESCE(?, email),
               is_driver = ?,
               user_id = COALESCE(?, user_id),
               updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              matricule || null,
              nom.toUpperCase(),
              prenoms,
              nationalite,
              fonction,
              serviceId,
              telephone || null,
              email || null,
              isDriver,
              finalUserId,
              staffId
            ]
          );
          updatedCount++;
        } else {
          const insertRes = await db.run(
            `INSERT INTO staff (user_id, matricule, nom, prenoms, nationality, fonction, service_id, telephone, email, status, is_driver)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF', ?)`,
            [
              linkedUserId,
              matricule || null,
              nom.toUpperCase(),
              prenoms,
              nationalite,
              fonction,
              serviceId,
              telephone,
              email,
              isDriver
            ]
          );
          staffId = insertRes.lastID;
          importedCount++;
        }

        // Handle vehicle record if driver details are given
        if (staffId && vehicleReg) {
          const exVeh = await db.get('SELECT id FROM vehicles WHERE assigned_staff_id = ?', [staffId]);
          if (exVeh) {
            await db.run(
              'UPDATE vehicles SET registration_number = ?, brand = ?, model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [vehicleReg, vehicleBrand, vehicleModel, exVeh.id]
            );
          } else {
            await db.run(
              'INSERT INTO vehicles (registration_number, brand, model, assigned_staff_id, status) VALUES (?, ?, ?, ?, "ACTIF")',
              [vehicleReg, vehicleBrand, vehicleModel, staffId]
            );
          }
        }
      } catch (err) {
        errors.push(`Ligne ${rowNum} (${nom} ${prenoms}) : ${err.message}`);
      }
    }

    await logAuditAction(req.user.id, 'IMPORT_STAFF_CSV', 'STAFF', 0, req, {
      total: rowsToImport.length,
      importedCount,
      updatedCount,
      errorsCount: errors.length
    });

    res.json({
      success: true,
      message: `Importation terminée : ${importedCount} nouveaux membres ajoutés, ${updatedCount} mis à jour.`,
      imported: importedCount,
      updated: updatedCount,
      total: rowsToImport.length,
      errors
    });
  } catch (err) {
    console.error('Import CSV error:', err);
    res.status(500).json({ error: 'Erreur lors de l’importation du fichier CSV : ' + err.message });
  }
});

// PUT /api/staff/:id/toggle-status - Deactivate staff & sync user account (Rule 17)
router.put('/:id/toggle-status', authenticateToken, requirePermission('personnel.deactivate'), async (req, res) => {
  const staffId = req.params.id;
  try {
    const staff = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) return res.status(404).json({ error: 'Membre du personnel introuvable.' });

    const newStatus = staff.status === 'ACTIF' ? 'INACTIF' : 'ACTIF';
    await db.run('UPDATE staff SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, staffId]);

    // Synchronize linked user account
    if (staff.user_id) {
      const userStatus = newStatus === 'INACTIF' ? 'INACTIVE' : 'ACTIVE';
      await db.run('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userStatus, staff.user_id]);
    }

    await logAuditAction(req.user.id, 'TOGGLE_STAFF_STATUS', 'STAFF', staffId, req, { newStatus, user_id: staff.user_id });

    res.json({
      success: true,
      message: `Statut du membre du personnel changé à [${newStatus}].`
    });
  } catch (err) {
    console.error('Toggle staff status error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de statut.' });
  }
});

// DELETE /api/staff/:id - Delete staff member from directory (Admin / Authorized)
router.delete('/:id', authenticateToken, async (req, res) => {
  const staffId = parseInt(req.params.id);

  const canDelete = req.user.role_code === 'ADMINISTRATEUR' || 
                    req.user.permissions?.includes('personnel.delete') || 
                    req.user.permissions?.includes('users.delete');

  if (!canDelete) {
    return res.status(403).json({ error: 'Permission refusée pour la suppression d’un membre du personnel.' });
  }

  try {
    const existing = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!existing) {
      return res.status(404).json({ error: 'Membre du personnel introuvable.' });
    }

    const shouldDeleteLinkedUser = Boolean(req.body?.delete_user || req.body?.delete_linked_user);
    const targetUserId = existing.user_id;

    if (shouldDeleteLinkedUser && targetUserId) {
      if (targetUserId === 1 || targetUserId === Number(req.user.id)) {
        return res.status(400).json({ error: 'Le compte administrateur connecté ou principal ne peut pas être supprimé.' });
      }
    }

    await db.run('PRAGMA foreign_keys = OFF');

    // 1. Unassign vehicles and drivers
    await db.run('UPDATE vehicles SET assigned_staff_id = NULL WHERE assigned_staff_id = ?', [staffId]).catch(() => {});
    await db.run('DELETE FROM personal_vehicles WHERE staff_id = ?', [staffId]).catch(() => {});
    await db.run('DELETE FROM staff_drivers WHERE staff_id = ?', [staffId]).catch(() => {});
    await db.run('UPDATE vehicle_assignment_history SET staff_id = NULL WHERE staff_id = ?', [staffId]).catch(() => {});

    // 2. Preserve historical mission orders & requests
    await db.run('UPDATE mission_orders SET missionary_id = NULL WHERE missionary_id = ?', [staffId]).catch(() => {});
    await db.run('UPDATE mission_orders SET driver_id = NULL WHERE driver_id = ?', [staffId]).catch(() => {});
    await db.run('UPDATE mission_order_requests SET staff_id = NULL WHERE staff_id = ?', [staffId]).catch(() => {});

    // 3. Clean up assignments and handle linked user account
    await db.run('DELETE FROM staff_assignments WHERE staff_id = ?', [staffId]).catch(() => {});

    if (shouldDeleteLinkedUser && targetUserId) {
      // Unassign service head
      await db.run('UPDATE services SET head_user_id = NULL WHERE head_user_id = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE service_heads_history SET is_current = 0, end_date = CURRENT_DATE WHERE user_id = ? AND is_current = 1', [targetUserId]).catch(() => {});

      // Clean up user-specific transient records
      await db.run('DELETE FROM user_signatures WHERE user_id = ?', [targetUserId]).catch(() => {});
      await db.run('DELETE FROM notifications WHERE user_id = ?', [targetUserId]).catch(() => {});
      await db.run('DELETE FROM appointment_availabilities WHERE user_id = ?', [targetUserId]).catch(() => {});
      await db.run('DELETE FROM password_reset_tokens WHERE user_id = ?', [targetUserId]).catch(() => {});
      await db.run('DELETE FROM document_editing_locks WHERE user_id = ?', [targetUserId]).catch(() => {});

      // Preserve documents, transfers, dispatches and audit references
      await db.run('UPDATE documents SET current_user_id = NULL WHERE current_user_id = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE documents SET created_by = NULL WHERE created_by = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE documents SET archived_by = NULL WHERE archived_by = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE documents SET archived_by_id = NULL WHERE archived_by_id = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE documents SET central_archived_by = NULL WHERE central_archived_by = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE documents SET transmitted_to_sc_by = NULL WHERE transmitted_to_sc_by = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE documents SET last_edited_by = NULL WHERE last_edited_by = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE documents SET sg_routed_by = NULL WHERE sg_routed_by = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE documents SET target_recipient_id = NULL WHERE target_recipient_id = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE document_history SET user_id = NULL WHERE user_id = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE audit_logs SET user_id = NULL WHERE user_id = ?', [targetUserId]).catch(() => {});

      // Delete user
      await db.run('DELETE FROM users WHERE id = ?', [targetUserId]);
    } else if (targetUserId) {
      // If user not deleted, unlink user_id from service head and DEACTIVATE account (Rule 3: no orphan active user)
      await db.run('UPDATE services SET head_user_id = NULL WHERE head_user_id = ?', [targetUserId]).catch(() => {});
      await db.run('UPDATE service_heads_history SET is_current = 0, end_date = CURRENT_DATE WHERE user_id = ? AND is_current = 1', [targetUserId]).catch(() => {});
      await db.run('UPDATE users SET status = "INACTIVE", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [targetUserId]).catch(() => {});
    }

    // 4. Delete the staff record strictly by ID
    await db.run('DELETE FROM staff WHERE id = ?', [staffId]);

    await db.run('PRAGMA foreign_keys = ON');

    await logAuditAction(req.user.id, 'DELETE_STAFF', 'STAFF', staffId, req, {
      deleted_matricule: existing.matricule,
      deleted_name: `${existing.nom} ${existing.prenoms}`,
      user_id: targetUserId,
      deleted_user_account: shouldDeleteLinkedUser
    });

    res.json({
      success: true,
      message: `Membre du personnel ${existing.nom} ${existing.prenoms} supprimé avec succès.`
    });
  } catch (err) {
    console.error('Delete staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du membre du personnel.' });
  }
});

// GET /api/staff/:id/personal-vehicles - Get all personal vehicles of a staff member
router.get('/:id/personal-vehicles', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { active_only } = req.query;

    let query = `SELECT * FROM personal_vehicles WHERE staff_id = ?`;
    const params = [id];

    if (active_only === 'true') {
      query += ` AND status = 'ACTIF'`;
    }

    query += ` ORDER BY status ASC, created_at DESC`;

    const vehicles = await db.all(query, params);
    res.json(vehicles);
  } catch (err) {
    console.error('Error fetching staff personal vehicles:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des véhicules personnels' });
  }
});

// GET /api/staff/:id/assigned-vehicles - Get all University fleet service vehicles assigned to a staff member
router.get('/:id/assigned-vehicles', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const vehicles = await db.all(`
      SELECT v.*, srv.name AS service_name, srv.code AS service_code,
             d.nom AS default_driver_nom, d.prenoms AS default_driver_prenoms, d.telephone AS default_driver_telephone
      FROM vehicles v
      LEFT JOIN services srv ON v.assigned_service_id = srv.id
      LEFT JOIN drivers d ON v.default_driver_id = d.id
      WHERE v.assigned_staff_id = ?
      ORDER BY v.registration_number ASC
    `, [id]);

    const formatted = vehicles.map(v => ({
      ...v,
      default_driver_full_name: v.default_driver_nom ? `${v.default_driver_prenoms || ''} ${v.default_driver_nom}`.trim() : null
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching staff assigned vehicles:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des véhicules de service affectés' });
  }
});

// GET /api/staff/:id/drivers - Get all drivers attached to a staff member
router.get('/:id/drivers', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const attachedDrivers = await db.all(`
      SELECT sd.id AS staff_driver_id, sd.staff_id, sd.driver_id, sd.is_default, sd.notes AS attachment_notes, sd.created_at AS attached_at,
             d.matricule, d.nom, d.prenoms, d.telephone, d.license_number, d.status AS driver_status,
             srv.name AS driver_service_name
      FROM staff_drivers sd
      JOIN drivers d ON sd.driver_id = d.id
      LEFT JOIN services srv ON d.service_id = srv.id
      WHERE sd.staff_id = ?
      ORDER BY sd.is_default DESC, d.nom ASC, d.prenoms ASC
    `, [id]);

    const formatted = attachedDrivers.map(d => ({
      ...d,
      full_name: `${d.prenoms || ''} ${d.nom}`.trim()
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching staff attached drivers:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des chauffeurs rattachés' });
  }
});

// POST /api/staff/:id/drivers - Attach a driver to a staff member
router.post('/:id/drivers', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { driver_id, is_default, notes } = req.body;

    if (!driver_id) {
      return res.status(400).json({ error: 'Le chauffeur est obligatoire' });
    }

    const staff = await db.get('SELECT id, nom, prenoms FROM staff WHERE id = ?', [id]);
    if (!staff) {
      return res.status(404).json({ error: 'Membre du personnel introuvable' });
    }

    const driver = await db.get('SELECT id, nom, prenoms FROM drivers WHERE id = ?', [driver_id]);
    if (!driver) {
      return res.status(404).json({ error: 'Chauffeur introuvable' });
    }

    // If is_default is true, unmark other default drivers for this staff
    const isDef = (is_default === true || is_default === 1 || is_default === '1') ? 1 : 0;
    if (isDef) {
      await db.run('UPDATE staff_drivers SET is_default = 0 WHERE staff_id = ?', [id]);
    }

    const existing = await db.get('SELECT id FROM staff_drivers WHERE staff_id = ? AND driver_id = ?', [id, driver_id]);
    if (existing) {
      await db.run(
        'UPDATE staff_drivers SET is_default = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [isDef, (notes || '').trim(), existing.id]
      );
    } else {
      await db.run(
        'INSERT INTO staff_drivers (staff_id, driver_id, is_default, notes) VALUES (?, ?, ?, ?)',
        [id, driver_id, isDef, (notes || '').trim()]
      );
    }

    await logAuditAction(req.user?.id, 'ATTACH_DRIVER_TO_STAFF', `Rattachement chauffeur ${driver.prenoms} ${driver.nom} à ${staff.prenoms} ${staff.nom}`);

    res.status(201).json({ success: true, message: 'Chauffeur rattaché avec succès' });
  } catch (err) {
    console.error('Error attaching driver to staff:', err);
    res.status(500).json({ error: 'Erreur lors du rattachement du chauffeur' });
  }
});

// DELETE /api/staff/:id/drivers/:driverId - Detach a driver from a staff member
router.delete('/:id/drivers/:driverId', authenticateToken, async (req, res) => {
  try {
    const { id, driverId } = req.params;

    const existing = await db.get('SELECT id FROM staff_drivers WHERE staff_id = ? AND driver_id = ?', [id, driverId]);
    if (!existing) {
      return res.status(404).json({ error: 'Rattachement introuvable' });
    }

    await db.run('DELETE FROM staff_drivers WHERE id = ?', [existing.id]);

    await logAuditAction(req.user?.id, 'DETACH_DRIVER_FROM_STAFF', `Détachement chauffeur ID ${driverId} de l'employé ID ${id}`);

    res.json({ success: true, message: 'Chauffeur détaché avec succès' });
  } catch (err) {
    console.error('Error detaching driver from staff:', err);
    res.status(500).json({ error: 'Erreur lors du détachement du chauffeur' });
  }
});

// POST /api/staff/:id/assigned-vehicles - Assign an existing University fleet vehicle to staff
router.post('/:id/assigned-vehicles', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { vehicle_id, default_driver_id, reason, notes } = req.body;

    if (!vehicle_id) {
      return res.status(400).json({ error: 'Le véhicule de service est obligatoire' });
    }

    const staff = await db.get('SELECT id, nom, prenoms, service_id FROM staff WHERE id = ?', [id]);
    if (!staff) {
      return res.status(404).json({ error: 'Membre du personnel introuvable' });
    }

    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [vehicle_id]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule de service introuvable dans le parc' });
    }

    // Close previous assignment in history
    await db.run(`
      UPDATE vehicle_assignment_history
      SET unassigned_at = CURRENT_TIMESTAMP
      WHERE vehicle_id = ? AND unassigned_at IS NULL
    `, [vehicle_id]);

    // Update vehicle assignment
    await db.run(`
      UPDATE vehicles SET
        assigned_staff_id = ?,
        assigned_service_id = COALESCE(?, assigned_service_id),
        default_driver_id = COALESCE(?, default_driver_id),
        assigned_at = CURRENT_TIMESTAMP,
        status = 'AFFECTÉ',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id, staff.service_id || null, default_driver_id || null, vehicle_id]);

    // Record in history
    await db.run(`
      INSERT INTO vehicle_assignment_history (
        vehicle_id,
        staff_id,
        service_id,
        assigned_by_user_id,
        assigned_at,
        reason,
        notes
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `, [
      vehicle_id,
      id,
      staff.service_id || null,
      req.user?.id || null,
      (reason || `Affectation administrative à ${staff.prenoms} ${staff.nom}`).trim(),
      (notes || '').trim()
    ]);

    await logAuditAction(req.user?.id, 'ASSIGN_STAFF_VEHICLE', `Affectation véhicule parc ${vehicle.registration_number} à ${staff.prenoms} ${staff.nom}`);

    res.status(201).json({ success: true, message: 'Véhicule de service affecté avec succès' });
  } catch (err) {
    console.error('Error assigning vehicle to staff:', err);
    res.status(500).json({ error: 'Erreur lors de l’affectation du véhicule de service' });
  }
});

// DELETE /api/staff/:id/assigned-vehicles/:vehicleId - Unassign a fleet vehicle from staff
router.delete('/:id/assigned-vehicles/:vehicleId', authenticateToken, async (req, res) => {
  try {
    const { id, vehicleId } = req.params;
    const { reason } = req.body || {};

    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ? AND assigned_staff_id = ?', [vehicleId, id]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule de service affecté introuvable pour ce personnel' });
    }

    // Close assignment in history
    await db.run(`
      UPDATE vehicle_assignment_history
      SET unassigned_at = CURRENT_TIMESTAMP,
          notes = CASE WHEN notes IS NOT NULL AND notes != '' THEN notes || ' | Fin: ' || ? ELSE 'Fin: ' || ? END
      WHERE vehicle_id = ? AND unassigned_at IS NULL
    `, [(reason || 'Retrait d’affectation depuis la fiche personnel'), (reason || 'Retrait d’affectation depuis la fiche personnel'), vehicleId]);

    // Release vehicle
    await db.run(`
      UPDATE vehicles SET
        assigned_staff_id = NULL,
        assigned_at = NULL,
        status = 'DISPONIBLE',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [vehicleId]);

    await logAuditAction(req.user?.id, 'UNASSIGN_STAFF_VEHICLE', `Retrait affectation véhicule ${vehicle.registration_number} de l'employé ID ${id}`);

    res.json({ success: true, message: 'Affectation du véhicule de service retirée avec succès' });
  } catch (err) {
    console.error('Error unassigning vehicle from staff:', err);
    res.status(500).json({ error: 'Erreur lors du retrait de l’affectation du véhicule' });
  }
});

module.exports = router;


