const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { generateReference, generateReferenceWithMeta } = require('../services/numberGenerator');
const { generateSignedMissionOrderPDF, generateMissionOrderDocumentInstance, resolveLocalFilePath } = require('../services/pdfService');
const { generateAndStoreReceipt } = require('../services/receiptService');
const { logAuditAction } = require('../middleware/audit');
const { JWT_SECRET, UPLOAD_DIR } = require('../config/constants');
const { formatFullName } = require('../utils/userUtils');
const { validateMissionParticipants } = require('../utils/missionUtils');

// Configure Multer for scanned physically-signed mission orders
const scanStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const scanDir = path.join(UPLOAD_DIR, 'scans');
    if (!fs.existsSync(scanDir)) {
      fs.mkdirSync(scanDir, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `SCAN_OM_${uniqueSuffix}${ext}`);
  }
});

const uploadScan = multer({
  storage: scanStorage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Veuillez importer un document PDF, PNG ou JPEG.'));
    }
  }
});

// GET /api/missions - List mission orders accessible to user
router.get('/', authenticateToken, requirePermission('mission.read'), async (req, res) => {
  try {
    const missions = await db.all(
      `SELECT d.*, mo.*, 
              s.name as current_service_name,
              u.first_name as missionary_first, u.last_name as missionary_last
       FROM documents d
       JOIN mission_orders mo ON d.id = mo.document_id
       JOIN services s ON d.current_service_id = s.id
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.status != 'TRASHED'
       ORDER BY d.created_at DESC`
    );
    res.json(missions);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des ordres de mission.' });
  }
});

// GET /api/missions/to-sign - Generic Inbox for Pending Mission Signatures/Validations (Exclusively Electronic mode)
router.get('/to-sign', authenticateToken, async (req, res) => {
  const user = req.user;
  const canSign = user.permissions?.includes('mission.sign') || 
                  user.permissions?.includes('signatures.manage') ||
                  user.role_code === 'SECRÉTAIRE_GÉNÉRAL' || 
                  user.role_code === 'ADMINISTRATEUR';

  if (!canSign) {
    return res.json([]);
  }

  try {
    const pendingMissions = await db.all(
      `SELECT d.*, mo.*, cb.first_name as created_by_first, cb.last_name as created_by_last
       FROM documents d
       JOIN mission_orders mo ON d.id = mo.document_id
       JOIN users cb ON d.created_by = cb.id
       WHERE mo.is_signed = 0 
         AND (mo.signature_mode = 'ELECTRONIC' OR mo.signature_mode IS NULL)
         AND d.status IN ('PENDING', 'EN_ATTENTE', 'DEMANDE REÇUE', 'EN PRÉPARATION', 'EN ATTENTE DE SIGNATURE', 'EN COURS', 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE')
         AND d.status != 'TRASHED'
       ORDER BY d.created_at ASC`
    );
    res.json(pendingMissions);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement de la boîte à signer.' });
  }
});

// GET /api/missions/my-requests - List applicant's own mission requests (Section 9)
router.get('/my-requests', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const requests = await db.all(
      `SELECT d.*, mo.*, 
              s.name as current_service_name,
              cb.first_name as creator_first, cb.last_name as creator_last
       FROM documents d
       JOIN mission_orders mo ON d.id = mo.document_id
       LEFT JOIN services s ON d.current_service_id = s.id
       JOIN users cb ON d.created_by = cb.id
       WHERE d.created_by = ? AND d.status != 'TRASHED'` +
      ` ORDER BY d.created_at DESC`,
      [user.id]
    );
    res.json(requests);
  } catch (err) {
    console.error('Fetch my mission requests error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de vos demandes d’ordre de mission.' });
  }
});

// GET /api/missions/:id - Get a single mission order by document_id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const docId = req.params.id;
    const mission = await db.get(
      `SELECT d.*, mo.*, 
              s.name as current_service_name,
              u.first_name as missionary_first, u.last_name as missionary_last
       FROM documents d
       JOIN mission_orders mo ON d.id = mo.document_id
       JOIN services s ON d.current_service_id = s.id
       LEFT JOIN users u ON d.created_by = u.id
       WHERE d.id = ? AND d.status != 'TRASHED'`,
      [docId]
    );
    if (!mission) {
      return res.status(404).json({ error: 'Ordre de mission non trouvé.' });
    }

    const participants = await db.all(
      'SELECT * FROM mission_order_participants WHERE mission_order_id = ? ORDER BY order_index ASC',
      [docId]
    );

    const effectiveParticipants = participants.length > 0 ? participants : [{
      mission_order_id: mission.document_id,
      user_id: mission.created_by,
      staff_id: mission.missionary_id,
      nom: mission.missionary_name_snapshot || mission.missionary_name,
      prenoms: mission.missionary_firstnames_snapshot || '',
      titre: mission.missionary_titre_snapshot || mission.missionary_titre || 'M.',
      fonction: mission.missionary_function_snapshot || mission.function_title,
      matricule: mission.missionary_matricule_snapshot || '',
      service_name: mission.missionary_service_snapshot || mission.current_service_name || '',
      telephone: '',
      email: '',
      is_requester: 1,
      order_index: 1
    }];

    mission.participants = effectiveParticipants;
    mission.mission_type = mission.mission_type || (effectiveParticipants.length > 1 ? 'COLLECTIF' : 'INDIVIDUEL');
    mission.participants_count = effectiveParticipants.length;

    res.json({ success: true, data: mission });
  } catch (err) {
    console.error('Fetch mission by id error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l’ordre de mission.' });
  }
});

// POST /api/missions/request - Submit a Mission Order Request (Supports Enseignants-Chercheurs & Staff without service)
router.post('/request', authenticateToken, async (req, res) => {
  const { 
    missionary_name, function_title, personnel_category, faculty_dept,
    destination, object_of_mission, transport_mode, departure_date, return_date, observations 
  } = req.body;

  if (!destination || !object_of_mission || !departure_date || !return_date) {
    return res.status(400).json({ error: 'Veuillez renseigner la destination, l’objet et les dates de mission.' });
  }

  try {
    const user = req.user;
    const isTeacher = user.personnel_category === 'ENSEIGNANT_CHERCHEUR' || !user.service_id;

    // Auto-destination: Always target Secrétariat Central (code SC)
    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    if (!scService) {
      return res.status(500).json({ error: 'Service Secrétariat Central introuvable.' });
    }

    const { reference, reference_meta } = await generateReferenceWithMeta('MISSION_ORDER');
    const trackingToken = crypto.randomBytes(16).toString('hex');

    const fullName = missionary_name || `${user.first_name} ${user.last_name}`;
    const userFunction = function_title || user.function_title || (isTeacher ? 'Enseignant-Chercheur' : 'Agent Administratif');
    const category = personnel_category || user.personnel_category || (isTeacher ? 'ENSEIGNANT_CHERCHEUR' : 'PERSONNEL_ADMINISTRATIF');
    const structure = faculty_dept || user.academic_structure || (user.service_name ? `Service : ${user.service_name}` : 'Non rattaché à un service administratif');

    // Validate participants (OM individuel ou collectif) with absolute rule
    let sanitizedParticipants = [];
    try {
      sanitizedParticipants = validateMissionParticipants(req.body.participants, {
        id: user.id,
        nom: user.last_name || fullName,
        prenoms: user.first_name || '',
        titre: user.titre || 'M.',
        fonction: userFunction,
        matricule: user.matricule || '',
        service_name: structure
      });
    } catch (valErr) {
      return res.status(400).json({ error: valErr.message });
    }

    const isCollective = sanitizedParticipants.length > 1;
    const missionType = isCollective ? 'COLLECTIF' : 'INDIVIDUEL';
    const participantsCount = sanitizedParticipants.length;

    const docTitle = isCollective 
      ? `Demande d'ordre de mission collectif (${participantsCount} personnes) vers ${destination}`
      : `Demande d'ordre de mission : ${fullName} vers ${destination}`;

    // Create document record owned by Secrétariat Central
    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, title, description, sender_name, sender_organization, priority, confidentiality, status, current_service_id, created_by, deadline_date, reference_meta)
       VALUES (?, ?, 'MISSION_ORDER', ?, ?, ?, 'Université de Kindia', 'NORMAL', 'INTERNAL', 'PENDING', ?, ?, ?, ?)`,
      [
        reference, 
        trackingToken, 
        docTitle, 
        object_of_mission, 
        fullName, 
        scService.id, 
        user.id, 
        departure_date,
        reference_meta
      ]
    );

    const docId = docRes.lastID;

    // Create mission order extension record
    await db.run(
      `INSERT INTO mission_orders 
       (document_id, missionary_name, nationality, function_title, destination, object_of_mission, transport_mode, departure_date, return_date, observations, is_signed,
        personnel_category, faculty_dept, missionary_name_snapshot, missionary_firstnames_snapshot, missionary_function_snapshot, missionary_service_snapshot, missionary_matricule_snapshot,
        mission_type, participants_count, requester_id)
       VALUES (?, ?, 'Guinéenne', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        fullName,
        userFunction,
        destination,
        object_of_mission,
        transport_mode || 'Transport commun / Véhicule',
        departure_date,
        return_date,
        observations || '',
        category,
        structure,
        user.last_name || fullName,
        user.first_name || '',
        userFunction,
        structure,
        user.matricule || '',
        missionType,
        participantsCount,
        user.id
      ]
    );

    // Save participants snapshots into mission_order_participants
    for (let i = 0; i < sanitizedParticipants.length; i++) {
      const p = sanitizedParticipants[i];
      await db.run(
        `INSERT INTO mission_order_participants (
          mission_order_id, user_id, staff_id, nom, prenoms, titre, fonction, matricule, service_name, telephone, email, is_requester, order_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          docId,
          p.user_id || null,
          p.staff_id || null,
          p.nom,
          p.prenoms,
          p.titre || 'M.',
          p.fonction,
          p.matricule || null,
          p.service_name || null,
          p.telephone || null,
          p.email || null,
          p.is_requester ? 1 : 0,
          i + 1
        ]
      );
    }

    // Document history & transfers
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'CREATE', ?)`,
      [docId, user.id, user.service_id || scService.id, `Demande d'ordre de mission soumise par ${fullName} (${category} - ${structure}). Transmise au Secrétariat Central.`]
    );

    await db.run(
      `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, action, instruction, status)
       VALUES (?, ?, ?, ?, 'TRANSMIT', 'Demande d’ordre de mission soumise pour examen par le Secrétariat Central', 'PENDING')`,
      [docId, user.service_id || scService.id, user.id, scService.id]
    );

    await logAuditAction(user.id, 'CREATE_MISSION_REQUEST', 'MISSION_ORDER', docId, req, { reference, category, structure });

    res.status(201).json({ success: true, id: docId, reference, message: 'Votre demande d’ordre de mission a été transmise avec succès au Secrétariat Central.' });
  } catch (err) {
    console.error('Submit mission request error:', err);
    res.status(500).json({ error: 'Erreur lors de la soumission de la demande d’ordre de mission.' });
  }
});

// POST /api/missions - Create a new Mission Order (Rule 1, 2, 3: Reserved for Secrétariat Central)
router.post('/', authenticateToken, requirePermission('mission.create'), async (req, res) => {
  const { 
    staff_id, missionary_name, missionary_firstnames, nationality, function_title, service_id, matricule,
    destination, object_of_mission, transport_mode, departure_date, return_date,
    driver_option, driver_id, driver_name, vehicle_id, vehicle_registration, observations,
    signature_mode
  } = req.body;

  if (!missionary_name || !destination || !object_of_mission || !departure_date || !return_date) {
    return res.status(400).json({ error: 'Veuillez remplir les informations obligatoires de la mission.' });
  }

  try {
    const user = req.user;

    // Rule 3: Backend Enforcement - Reserved EXCLUSIVELY for Secrétariat Central
    const userService = await db.get('SELECT code FROM services WHERE id = ?', [user.service_id]);
    if (!userService || userService.code !== 'SC') {
      return res.status(403).json({
        error: "Vous n'êtes pas autorisé à créer un ordre de mission. La création des ordres de mission est réservée au Secrétariat Central."
      });
    }

    // Anti-duplicate & Link Check for Online Mission Requests
    const linkedRequestId = req.body.linked_request_id || req.body.request_id || null;
    let linkedRequest = null;
    if (linkedRequestId) {
      linkedRequest = await db.get('SELECT * FROM mission_order_requests WHERE id = ?', [linkedRequestId]);
      if (!linkedRequest) {
        return res.status(404).json({ error: "La demande d'ordre de mission associée est introuvable." });
      }
      if (linkedRequest.official_document_id) {
        return res.status(409).json({ 
          error: "Un ordre de mission officiel a déjà été créé pour cette demande (Demande déjà traitée).",
          official_document_id: linkedRequest.official_document_id
        });
      }
      if (linkedRequest.status === 'REJETÉ' || linkedRequest.status === 'ARCHIVÉ') {
        return res.status(400).json({ error: `Impossible de créer un ordre de mission pour une demande au statut "${linkedRequest.status}".` });
      }
    }

    // Fetch staff info for snapshot if staff_id provided
    let staffMember = null;
    let serviceName = '';
    if (staff_id) {
      staffMember = await db.get(
        'SELECT st.*, s.name as service_name FROM staff st LEFT JOIN services s ON st.service_id = s.id WHERE st.id = ?',
        [staff_id]
      );
      if (staffMember) serviceName = staffMember.service_name || '';
    }

    let reference = null;
    let reference_meta = null;

    if (linkedRequest && linkedRequest.reference) {
      // Re-use the EXACT unique immutable reference of the initial mission request!
      reference = linkedRequest.reference;
    } else {
      // Direct creation from scratch without request -> generate new official reference
      const genResult = await generateReferenceWithMeta('MISSION_ORDER');
      reference = genResult.reference;
      reference_meta = genResult.reference_meta;
    }

    const trackingToken = crypto.randomBytes(16).toString('hex');

    // Fetch Secrétariat Général service ID for signature routing
    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    const targetServiceId = sgService ? sgService.id : user.service_id;

    // Resolve & validate vehicle registration and snapshots
    let effectiveVehicleRegistration = (vehicle_registration || '').trim();
    let effectivePersonalVehicleId = req.body.personal_vehicle_id || null;
    let effectiveServiceVehicleId = req.body.vehicle_id || null;

    if (transport_mode === 'Véhicule personnel' || transport_mode?.toLowerCase().includes('personnel')) {
      if (effectivePersonalVehicleId) {
        const pv = await db.get('SELECT * FROM personal_vehicles WHERE id = ?', [effectivePersonalVehicleId]);
        if (!pv) {
          return res.status(400).json({ error: 'Le véhicule personnel sélectionné est introuvable.' });
        }
        if (staff_id && pv.staff_id !== Number(staff_id)) {
          return res.status(400).json({ error: "Le véhicule personnel sélectionné n'appartient pas à l'employé concerné." });
        }
        if (pv.status !== 'ACTIF') {
          return res.status(400).json({ error: 'Le véhicule personnel sélectionné est inactif.' });
        }
        effectiveVehicleRegistration = pv.registration_number;
      } else if (!effectiveVehicleRegistration && staffMember?.personal_vehicle_registration) {
        effectiveVehicleRegistration = staffMember.personal_vehicle_registration;
      }
    } else if (transport_mode === 'Véhicule de service' || transport_mode?.toLowerCase().includes('service') || transport_mode?.toLowerCase().includes('officiel')) {
      if (effectiveServiceVehicleId) {
        const v = await db.get('SELECT * FROM vehicles WHERE id = ?', [effectiveServiceVehicleId]);
        if (!v) {
          return res.status(400).json({ error: 'Le véhicule de service sélectionné est introuvable dans le parc.' });
        }
        if (['IMMOBILISÉ', 'RÉFORMÉ', 'INACTIF'].includes(v.status)) {
          return res.status(400).json({ error: `Le véhicule de service sélectionné a le statut ${v.status} et ne peut pas être utilisé.` });
        }
        effectiveVehicleRegistration = v.registration_number;
      } else if (!effectiveVehicleRegistration && staffMember?.vehicle_registration) {
        effectiveVehicleRegistration = staffMember.vehicle_registration;
      }
    }

    // Resolve & validate driver
    let effectiveDriverName = 'Lui-même';
    let effectiveDriverId = null;

    if (driver_option === 'SELF' || driver_name === 'Lui-même' || (!driver_name && !driver_id)) {
      effectiveDriverName = 'Lui-même';
      effectiveDriverId = null;
    } else if (driver_id) {
      const drv = await db.get('SELECT * FROM drivers WHERE id = ?', [driver_id]);
      if (drv) {
        if (drv.status !== 'ACTIF') {
          return res.status(400).json({ error: 'Le chauffeur sélectionné est inactif.' });
        }
        effectiveDriverName = `${drv.prenoms || ''} ${drv.nom}`.trim();
        effectiveDriverId = drv.id;
      } else {
        effectiveDriverName = (driver_name || 'Lui-même').trim();
      }
    } else if (driver_name) {
      effectiveDriverName = driver_name.trim();
    }

    // Resolve missionary titre / grade
    const effectiveMissionaryTitre = req.body.missionary_titre || req.body.titre || req.body.grade || (staffMember ? (staffMember.titre || staffMember.grade) : 'M.');

    // Resolve participants (collective or individual)
    let participantsList = [];
    if (linkedRequest) {
      const existingReqParts = await db.all(
        'SELECT * FROM mission_order_participants WHERE request_id = ? ORDER BY order_index ASC',
        [linkedRequest.id]
      );
      if (existingReqParts && existingReqParts.length > 0) {
        participantsList = existingReqParts;
      }
    }

    if (participantsList.length === 0) {
      let rawParticipants = req.body.participants;
      if (typeof rawParticipants === 'string') {
        try { rawParticipants = JSON.parse(rawParticipants); } catch (e) { rawParticipants = []; }
      }
      if (Array.isArray(rawParticipants) && rawParticipants.length > 0) {
        participantsList = rawParticipants.map((p, idx) => ({
          user_id: p.user_id || null,
          staff_id: p.staff_id || null,
          nom: p.nom || '',
          prenoms: p.prenoms || '',
          titre: p.titre || 'M.',
          fonction: p.fonction || function_title || 'Enseignant-Chercheur / Agent UK',
          matricule: p.matricule || null,
          service_name: p.service_name || serviceName || null,
          telephone: p.telephone || null,
          email: p.email || null,
          is_requester: p.is_requester ? 1 : (idx === 0 ? 1 : 0),
          order_index: idx + 1
        }));
      } else {
        participantsList = [{
          user_id: linkedRequest?.user_id || null,
          staff_id: staff_id || null,
          nom: staffMember ? staffMember.nom : missionary_name,
          prenoms: staffMember ? staffMember.prenoms : (missionary_firstnames || ''),
          titre: effectiveMissionaryTitre,
          fonction: function_title || 'Enseignant-Chercheur / Agent UK',
          matricule: matricule || (staffMember ? staffMember.matricule : ''),
          service_name: serviceName || '',
          telephone: '',
          email: '',
          is_requester: 1,
          order_index: 1
        }];
      }
    }

    const isCollective = participantsList.length > 1 || (linkedRequest && linkedRequest.mission_type === 'COLLECTIF');
    const missionType = isCollective ? 'COLLECTIF' : 'INDIVIDUEL';
    const participantsCount = participantsList.length;

    // 1. Generate Frozen Document Instance (DOCX + PDF) using specified template and version
    const templateId = req.body.template_id || null;
    const templateVersionId = req.body.template_version_id || null;

    let instanceResult = null;
    try {
      instanceResult = await generateMissionOrderDocumentInstance({
        reference,
        created_at: new Date().toISOString(),
        missionary_name,
        missionary_firstnames,
        missionary_titre: effectiveMissionaryTitre,
        titre: effectiveMissionaryTitre,
        grade: effectiveMissionaryTitre,
        titre_grade: effectiveMissionaryTitre,
        grade_titre: effectiveMissionaryTitre,
        function_title,
        missionary_service: serviceName,
        matricule: matricule || (staffMember ? staffMember.matricule : ''),
        nationality: nationality || 'Guinéenne',
        destination,
        object_of_mission,
        transport_mode: transport_mode || 'Véhicule de service',
        departure_date,
        return_date,
        driver_name: effectiveDriverName,
        driver_option: driver_option || (effectiveDriverName === 'Lui-même' ? 'SELF' : 'OTHER'),
        vehicle_registration: effectiveVehicleRegistration,
        tracking_token: trackingToken,
        participants: participantsList,
        mission_type: missionType,
        participants_count: participantsCount
      }, templateId, templateVersionId);
    } catch (genErr) {
      console.warn('Instance generation fallback:', genErr.message);
    }

    const initialFilePath = instanceResult?.generated_file_path || null;
    const effectiveSignatureMode = signature_mode === 'MANUSCRIPT' ? 'MANUSCRIPT' : 'ELECTRONIC';
    const initialStatus = effectiveSignatureMode === 'MANUSCRIPT' ? 'EN ATTENTE DE SIGNATURE MANUSCRITE' : 'PENDING';

    const documentTitle = isCollective 
      ? `Ordre de mission collectif (${participantsCount} personnes) vers ${destination}`
      : `Ordre de mission : ${missionary_name} vers ${destination}`;

    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, title, description, sender_name, sender_organization, priority, confidentiality, status, current_service_id, created_by, deadline_date, reference_meta, file_path)
       VALUES (?, ?, 'MISSION_ORDER', ?, ?, ?, 'Université de Kindia', 'HIGH', 'INTERNAL', ?, ?, ?, ?, ?, ?)`,
      [reference, trackingToken, documentTitle, object_of_mission, user.first_name + ' ' + user.last_name, initialStatus, targetServiceId, user.id, departure_date, reference_meta, initialFilePath]
    );

    const docId = docRes.lastID;

    const effectiveDocumentFormat = req.body.document_format || req.body.format || 'WORD_DOCX';

    // Snapshots & Frozen Template Instance Metadata
    await db.run(
      `INSERT INTO mission_orders 
       (document_id, request_id, missionary_id, missionary_name, missionary_titre, nationality, function_title, destination, object_of_mission, transport_mode, departure_date, return_date, driver_option, driver_id, driver_name, vehicle_id, personal_vehicle_id, observations, is_signed, signature_mode,
        missionary_name_snapshot, missionary_firstnames_snapshot, missionary_titre_snapshot, missionary_nationality_snapshot, missionary_function_snapshot, missionary_service_snapshot, missionary_matricule_snapshot, driver_name_snapshot, vehicle_registration_snapshot,
        template_id, template_version_id, template_version_number, generated_file_path, generated_docx_path, document_format,
        mission_type, participants_count, requester_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        linkedRequestId || null,
        staff_id || null,
        missionary_name,
        effectiveMissionaryTitre,
        nationality || 'Guinéenne',
        function_title || 'Enseignant-Chercheur / Agent UK',
        destination,
        object_of_mission,
        transport_mode || 'Véhicule de service',
        departure_date,
        return_date,
        driver_option || (effectiveDriverName === 'Lui-même' ? 'SELF' : 'OTHER'),
        effectiveDriverId,
        effectiveDriverName,
        effectiveServiceVehicleId,
        effectivePersonalVehicleId,
        observations || '',
        effectiveSignatureMode,
        staffMember ? staffMember.nom : missionary_name,
        staffMember ? staffMember.prenoms : (missionary_firstnames || ''),
        effectiveMissionaryTitre,
        nationality || 'Guinéenne',
        function_title || 'Enseignant-Chercheur / Agent UK',
        serviceName || '',
        matricule || (staffMember ? staffMember.matricule : ''),
        effectiveDriverName,
        effectiveVehicleRegistration,
        instanceResult?.template_id || null,
        instanceResult?.template_version_id || null,
        instanceResult?.template_version_number || 1,
        instanceResult?.generated_file_path || null,
        instanceResult?.generated_docx_path || null,
        effectiveDocumentFormat,
        missionType,
        participantsCount,
        linkedRequest ? linkedRequest.user_id : (participantsList[0]?.user_id || user.id)
      ]
    );

    // Link or create participants records in mission_order_participants
    if (linkedRequestId) {
      await db.run(
        'UPDATE mission_order_participants SET mission_order_id = ? WHERE request_id = ?',
        [docId, linkedRequestId]
      );
    }

    const checkParts = await db.get('SELECT COUNT(*) as count FROM mission_order_participants WHERE mission_order_id = ?', [docId]);
    if (!checkParts || checkParts.count === 0) {
      for (let i = 0; i < participantsList.length; i++) {
        const p = participantsList[i];
        await db.run(
          `INSERT INTO mission_order_participants (
            mission_order_id, request_id, user_id, staff_id, nom, prenoms, titre, fonction, matricule, service_name, telephone, email, is_requester, order_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            docId,
            linkedRequestId || null,
            p.user_id || null,
            p.staff_id || null,
            p.nom,
            p.prenoms || '',
            p.titre || 'M.',
            p.fonction || function_title || 'Enseignant-Chercheur / Agent UK',
            p.matricule || null,
            p.service_name || null,
            p.telephone || null,
            p.email || null,
            p.is_requester ? 1 : (i === 0 ? 1 : 0),
            i + 1
          ]
        );
      }
    }

    // Save Single Original Attachment (Rule 2: No duplicate attachments)
    const originalPdf = instanceResult?.generated_file_path || initialFilePath;
    if (originalPdf) {
      await db.run(
        `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, uploaded_by)
         VALUES (?, ?, ?, 120000, 'application/pdf', ?)`,
        [docId, originalPdf, originalPdf, user.id]
      );
    }

    const usedTemplateName = instanceResult?.template_file_name || instanceResult?.template_name || 'ORDRE_DE_MISSION_OFFICIEL.docx';
    const usedTemplateVersion = instanceResult?.template_version_number || 1;
    const generationAuditMsg = `Ordre de mission généré à partir du modèle : ${usedTemplateName} — Version ${usedTemplateVersion}`;

    // Comprehensive Chronological History
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'MODÈLE_SÉLECTIONNÉ', ?)`,
      [docId, user.id, user.service_id, generationAuditMsg]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'CREATE', ?)`,
      [docId, user.id, user.service_id, `Ordre de mission créé par le Secrétariat Central. Réf: ${reference}`]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'DOCUMENT_ORIGINAL_GÉNÉRÉ', ?)`,
      [docId, user.id, user.service_id, `Document original généré (${originalPdf || 'Prêt pour signature'}) à partir de ${usedTemplateName} (Version ${usedTemplateVersion})`]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'TRANSMIS_AU_SECRÉTAIRE_GÉNÉRAL', ?)`,
      [docId, user.id, user.service_id, `Transmis au Secrétaire Général pour signature électronique officielle.`]
    );

    await db.run(
      `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, action, instruction, status)
       VALUES (?, ?, ?, ?, 'TRANSMIT', 'Soumis pour signature du Secrétaire Général', 'PENDING')`,
      [docId, user.service_id, user.id, targetServiceId]
    );

    await logAuditAction(user.id, 'CREATE_MISSION_ORDER', 'MISSION_ORDER', docId, req, {
      reference,
      template_id: instanceResult?.template_id,
      template_name: usedTemplateName,
      template_version: usedTemplateVersion,
      message: generationAuditMsg
    });

    // Link Online Mission Request if created from one
    if (linkedRequestId) {
      const omStatus = 'EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL';
      await db.run(
        `UPDATE mission_order_requests 
         SET official_document_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [docId, omStatus, linkedRequestId]
      );
      await db.run(
        `INSERT INTO mission_order_request_history (request_id, user_id, role_name, action, old_status, new_status, observation)
         VALUES (?, ?, ?, 'GENERATE_OFFICIAL_OM', ?, ?, ?)`,
        [
          linkedRequestId,
          user.id,
          user.role_name,
          linkedRequest ? linkedRequest.status : 'EN_ATTENTE_SC',
          omStatus,
          `Ordre de mission officiel établi par le Secrétariat Central (Réf: ${reference}) et transmis au Secrétaire Général pour signature.`
        ]
      );
    }

    // Automatically generate official PDF Receipt with QR Code (Module Reçus Officiels)
    let receiptInfo = null;
    try {
      receiptInfo = await generateAndStoreReceipt(docId, 'MISSION_ORDER', req);
    } catch (receiptErr) {
      console.error('Auto receipt generation failed for mission order:', receiptErr);
    }

    res.status(201).json({ 
      success: true, 
      id: docId, 
      reference,
      tracking_token: trackingToken,
      receipt: receiptInfo,
      linked_request_id: linkedRequestId || null
    });
  } catch (err) {
    console.error('Create mission order error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l’ordre de mission.' });
  }
});

// POST /api/missions/:id/sign - Responsible Officer Signature Action
router.post('/:id/sign', authenticateToken, requirePermission('mission.sign'), async (req, res) => {
  const docId = req.params.id;
  const user = req.user;

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ? AND document_type = "MISSION_ORDER"', [docId]);
    if (!doc) return res.status(404).json({ error: 'Ordre de mission non trouvé.' });

    const mission = await db.get('SELECT * FROM mission_orders WHERE document_id = ?', [docId]);
    if (!mission) return res.status(404).json({ error: 'Détails de l’ordre de mission introuvables.' });

    // Idempotence check: If already signed, return the already signed document without duplicating
    if (doc.is_locked === 1 || mission.is_signed === 1) {
      const existingPdf = mission.signed_pdf_path || doc.file_path;
      return res.json({
        success: true,
        already_signed: true,
        message: 'Cet ordre de mission est déjà signé numériquement et verrouillé.',
        pdf_url: `/uploads/${existingPdf}`,
        verification_url: `${process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/verification/ordre-mission/${encodeURIComponent(doc.tracking_token || doc.reference || 'REF')}`
      });
    }

    const signedAt = new Date().toISOString();

    // 1. Fetch active electronic signature for signing officer
    const userSignature = await db.get(
      "SELECT * FROM user_signatures WHERE user_id = ? AND (status = 'ACTIVE' OR is_active = 1) ORDER BY id DESC LIMIT 1",
      [user.id]
    );

    if (!userSignature) {
      return res.status(400).json({
        error: `Aucune signature électronique active n'est configurée pour ce responsable (${user.first_name} ${user.last_name}). Veuillez configurer sa signature avant de poursuivre.`
      });
    }

    // 2. Validate physical signature file accessibility
    const { resolveLocalFilePath } = require('../services/pdfService');
    const resolvedSigFile = resolveLocalFilePath(userSignature.signature_image_path, 'signatures');
    if (!resolvedSigFile || !fs.existsSync(resolvedSigFile)) {
      return res.status(400).json({
        error: "La signature électronique configurée existe mais son fichier est inaccessible. Veuillez vérifier la configuration de la signature."
      });
    }

    // 3. Generate cryptographic signature hash
    const signatureRaw = `${doc.reference}:${mission.missionary_name}:${signedAt}:${user.id}:${JWT_SECRET}`;
    const signatureHash = crypto.createHash('sha256').update(signatureRaw).digest('hex');

    const signerFullName = formatFullName({ nom: user.last_name, prenoms: user.first_name, titre: user.titre });
    const signerRole = (user.function_title || user.role_name || 'LE SECRETAIRE GENERAL').toUpperCase();

    const signatureDetails = {
      signed_at: signedAt,
      signed_by_name: signerFullName,
      signed_by_role: signerRole,
      signature_hash: signatureHash,
      signature_image_path: userSignature.signature_image_path
    };

    const t0_req = Date.now();
    // 4. Build official signed PDF directly from the existing official PDF (0 DOCX conversion)
    const t0_pdf = Date.now();
    const pdfResult = await generateSignedMissionOrderPDF(
      { 
        ...mission, 
        reference: doc.reference,
        tracking_token: doc.tracking_token || mission.signature_token || doc.reference,
        file_path: doc.file_path,
        generated_file_path: mission.generated_file_path || doc.file_path,
        template_id: mission.template_id,
        template_version_id: mission.template_version_id
      },
      signatureDetails
    );
    const t_pdf = Date.now() - t0_pdf;

    if (!pdfResult || !pdfResult.filePath || !fs.existsSync(pdfResult.filePath)) {
      return res.status(500).json({
        error: "Le document signé n'a pas pu être généré. L'ordre de mission n'a pas été marqué comme signé."
      });
    }

    const t0_db = Date.now();
    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : doc.current_service_id;

    // 5. Update mission_orders table
    await db.run(
      `UPDATE mission_orders 
       SET is_signed = 1, signed_at = ?, signed_by_user_id = ?, signature_token = ?, signed_pdf_path = ?, returned_to_sc_at = ?
       WHERE document_id = ?`,
      [signedAt, user.id, signatureHash, pdfResult.filename, signedAt, docId]
    );

    // 6. Lock document, set signed status and return holder to Secrétariat Central
    await db.run(
      `UPDATE documents 
       SET status = 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL', current_service_id = ?, is_locked = 1, qr_code_hash = ?, file_path = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [scServiceId, signatureHash, pdfResult.filename, docId]
    );

    // Synchronize corresponding mission_order_requests
    await db.run(
      `UPDATE mission_order_requests 
       SET status = 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL', updated_at = CURRENT_TIMESTAMP 
       WHERE official_document_id = ?`,
      [docId]
    );

    // 7. Register signature entry in document_signatures & signatures
    await db.run(
      `INSERT INTO document_signatures (document_id, signature_id, signature_version_id, signatory_id, signature_hash, signed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [docId, userSignature.id, userSignature.version_number || 1, user.id, signatureHash, signedAt]
    );

    await db.run(
      `INSERT INTO signatures (document_id, user_id, signature_hash, certificate_info, signed_at, pdf_path)
       VALUES (?, ?, ?, 'Certificat Numérique Sécurisé UK-GED', ?, ?)`,
      [docId, user.id, signatureHash, signedAt, pdfResult.filename]
    );

    // 8. History Logs
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'DOCUMENT_SIGNÉ', ?)`,
      [docId, user.id, user.service_id, `Signé électroniquement par ${signerRole} (${signerFullName}). Signature officielle intégrée au document.`]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'RETOURNÉ_AU_SECRÉTARIAT_CENTRAL', ?)`,
      [docId, user.id, user.service_id, `Document officiel signé et scellé, retourné au Secrétariat Central pour mise à disposition.`]
    );

    // 9. Document transfer back to Secrétariat Central
    await db.run(
      `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, action, instruction, status)
       VALUES (?, ?, ?, ?, 'TRANSMIT', 'Ordre de mission signé électroniquement et retourné au Secrétariat Central', 'COMPLETED')`,
      [docId, user.service_id, user.id, scServiceId]
    );

    // 10. Update Attachments table: Maintain single official final document (replace draft or update)
    const existingAtt = await db.get('SELECT id FROM attachments WHERE document_id = ? ORDER BY id ASC LIMIT 1', [docId]);
    if (existingAtt) {
      await db.run(
        `UPDATE attachments SET file_name = ?, file_path = ?, mime_type = 'application/pdf', uploaded_by = ? WHERE id = ?`,
        [pdfResult.filename, pdfResult.filename, user.id, existingAtt.id]
      );
    } else {
      await db.run(
        `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, uploaded_by)
         VALUES (?, ?, ?, 150000, 'application/pdf', ?)`,
        [docId, pdfResult.filename, pdfResult.filename, user.id]
      );
    }

    await logAuditAction(user.id, 'SIGN', 'MISSION_ORDER', docId, req, {
      signer_name: signerFullName,
      role: signerRole,
      signature_hash: signatureHash,
      signed_file: pdfResult.filename
    });
    const t_db = Date.now() - t0_db;
    const t_total_route = Date.now() - t0_req;

    console.log(`[ROUTE POST /api/missions/${docId}/sign - STATS]
   - Génération PDF signé : ${t_pdf} ms
   - Mises à jour Base de données & Audit : ${t_db} ms
   - Temps total traitement serveur : ${t_total_route} ms`);

    res.json({
      success: true,
      message: 'Ordre de mission signé numériquement, verrouillé et retourné au Secrétariat Central avec succès.',
      pdf_url: `/uploads/${pdfResult.filename}`,
      verification_url: pdfResult.verificationUrl,
      timings: {
        pdf_generation_ms: t_pdf,
        db_updates_ms: t_db,
        total_server_ms: t_total_route
      }
    });
  } catch (err) {
    console.error('Sign mission order error:', err);
    res.status(500).json({ error: 'Erreur lors de la signature : ' + err.message });
  }
});

// POST /api/missions/:id/reject - SG Rejection Action (Rule 30)
router.post('/:id/reject', authenticateToken, async (req, res) => {
  const docId = req.params.id;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Veuillez préciser le motif du rejet.' });
  }

  try {
    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : req.user.service_id;

    await db.run(
      `UPDATE documents SET status = 'REJETÉ PAR LE SECRÉTARIAT GÉNÉRAL', current_service_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [scServiceId, docId]
    );

    await db.run(
      `UPDATE mission_orders SET rejection_reason = ? WHERE document_id = ?`,
      [reason.trim(), docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'REJECT', ?)`,
      [docId, req.user.id, req.user.service_id, `Rejeté par le Secrétaire Général. Motif : ${reason.trim()}`]
    );

    await logAuditAction(req.user.id, 'REJECT', 'MISSION_ORDER', docId, req, { reason });

    res.json({ success: true, message: 'Ordre de mission rejeté et retourné au Secrétariat Central.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du rejet.' });
  }
});

// POST /api/missions/:id/request-correction - SG Correction Request Action (Rule 31)
router.post('/:id/request-correction', authenticateToken, async (req, res) => {
  const docId = req.params.id;
  const { notes } = req.body;

  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: 'Veuillez préciser les corrections demandées.' });
  }

  try {
    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : req.user.service_id;

    await db.run(
      `UPDATE documents SET status = 'CORRECTION DEMANDÉE', current_service_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [scServiceId, docId]
    );

    await db.run(
      `UPDATE mission_orders SET correction_notes = ? WHERE document_id = ?`,
      [notes.trim(), docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'REQUEST_CORRECTION', ?)`,
      [docId, req.user.id, req.user.service_id, `Demande de correction du Secrétaire Général. Notes : ${notes.trim()}`]
    );

    await logAuditAction(req.user.id, 'REQUEST_CORRECTION', 'MISSION_ORDER', docId, req, { notes });

    res.json({ success: true, message: 'Demande de correction envoyée au Secrétariat Central.' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la demande de correction.' });
  }
});

// POST /api/missions/:id/print - Printing / Re-printing Action (Rules 22 & 27)
router.post('/:id/print', authenticateToken, async (req, res) => {
  const docId = req.params.id;
  const { reason } = req.body;

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ? AND document_type = "MISSION_ORDER"', [docId]);
    if (!doc) return res.status(404).json({ error: 'Ordre de mission non trouvé.' });

    const mission = await db.get('SELECT * FROM mission_orders WHERE document_id = ?', [docId]);
    const currentPrintCount = (mission.print_count || 0) + 1;
    const printedAt = new Date().toISOString();

    await db.run(
      `UPDATE mission_orders SET printed_at = ?, printed_by_user_id = ?, print_count = ? WHERE document_id = ?`,
      [printedAt, req.user.id, currentPrintCount, docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'PRINT', ?)`,
      [docId, req.user.id, req.user.service_id, `Ordre de mission imprimé (${currentPrintCount}e impression). User: ${req.user.first_name} ${req.user.last_name}${reason ? ' | Motif : ' + reason : ''}`]
    );

    await logAuditAction(req.user.id, 'PRINT_MISSION_ORDER', 'MISSION_ORDER', docId, req, { printCount: currentPrintCount, reason });

    res.json({
      success: true,
      message: 'Impression enregistrée avec succès dans le journal d’audit.',
      pdf_url: mission.signed_pdf_path ? `/uploads/${mission.signed_pdf_path}` : null,
      print_count: currentPrintCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de l’impression.' });
  }
});

// POST /api/missions/:id/deliver - Handover / Remise au demandeur (Rules 23 & 24)
router.post('/:id/deliver', authenticateToken, async (req, res) => {
  const docId = req.params.id;
  const { recipient_name } = req.body;

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ? AND document_type = "MISSION_ORDER"', [docId]);
    if (!doc) return res.status(404).json({ error: 'Ordre de mission non trouvé.' });

    const mission = await db.get('SELECT * FROM mission_orders WHERE document_id = ?', [docId]);
    const deliveredAt = new Date().toISOString();
    const finalRecipient = recipient_name || mission.missionary_name;

    await db.run(
      `UPDATE mission_orders SET delivered_at = ?, delivered_by_user_id = ?, recipient_name = ? WHERE document_id = ?`,
      [deliveredAt, req.user.id, finalRecipient, docId]
    );

    await db.run(
      `UPDATE documents SET status = 'REMIS AU DEMANDEUR', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'DOCUMENT_REMIS_AU_MISSIONNAIRE', ?)`,
      [docId, req.user.id, req.user.service_id, `Ordre de mission officiel signé et scellé remis au missionnaire (${finalRecipient}).`]
    );

    await logAuditAction(req.user.id, 'DELIVER_MISSION_ORDER', 'MISSION_ORDER', docId, req, { finalRecipient });

    res.json({
      success: true,
      message: `Ordre de mission ${doc.reference} remis à ${finalRecipient} avec succès.`
    });
  } catch (err) {
    console.error('Deliver mission order error:', err);
    res.status(500).json({ error: 'Erreur lors de la confirmation de la remise.' });
  }
});

// PUT /api/missions/:id/signature-mode - Switch between Electronic & Manuscript signature modes
router.put('/:id/signature-mode', authenticateToken, async (req, res) => {
  const docId = req.params.id;
  const { signature_mode } = req.body;
  const user = req.user;

  const isSC = user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user.service_code === 'SC' || user.role_code === 'ADMINISTRATEUR';
  const isSG = user.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user.role_code === 'RECTEUR' || user.permissions?.includes('mission.sign');

  if (!isSC && !isSG) {
    return res.status(403).json({ error: 'Action non autorisée. Seul le Secrétariat Central ou le Secrétaire Général peut modifier le mode de signature.' });
  }

  const validModes = ['ELECTRONIC', 'MANUSCRIPT'];
  if (!validModes.includes(signature_mode)) {
    return res.status(400).json({ error: 'Mode de signature invalide. Valeurs acceptées : ELECTRONIC ou MANUSCRIPT.' });
  }

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ? AND document_type = "MISSION_ORDER"', [docId]);
    if (!doc) return res.status(404).json({ error: 'Ordre de mission non trouvé.' });

    const mission = await db.get('SELECT * FROM mission_orders WHERE document_id = ?', [docId]);
    if (!mission) return res.status(404).json({ error: 'Détails de l’ordre de mission introuvables.' });

    if (mission.is_signed === 1 || doc.is_locked === 1) {
      return res.status(400).json({ error: 'Impossible de changer le mode de signature : cet ordre de mission est déjà signé et verrouillé.' });
    }

    const modeLabel = signature_mode === 'MANUSCRIPT' ? 'Signature Manuscrite (SG au bureau)' : 'Signature Électronique (SG en déplacement)';
    let newStatus = doc.status;

    if (signature_mode === 'MANUSCRIPT') {
      if (['PENDING', 'EN_ATTENTE', 'DEMANDE REÇUE', 'EN PRÉPARATION', 'EN ATTENTE DE SIGNATURE'].includes(doc.status)) {
        newStatus = 'EN ATTENTE DE SIGNATURE MANUSCRITE';
      }
    } else {
      if (['EN ATTENTE DE SIGNATURE MANUSCRITE', 'SIGNÉ MANUSCRITEMENT – EN ATTENTE DE NUMÉRISATION'].includes(doc.status)) {
        newStatus = 'EN ATTENTE DE SIGNATURE';
      }
    }

    await db.run(
      `UPDATE mission_orders SET signature_mode = ? WHERE document_id = ?`,
      [signature_mode, docId]
    );

    if (newStatus !== doc.status) {
      await db.run(
        `UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newStatus, docId]
      );
    }

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'MODE_SIGNATURE_MODIFIÉ', ?)`,
      [docId, user.id, user.service_id, `Mode de signature défini sur : ${modeLabel} par ${user.first_name} ${user.last_name}.`]
    );

    await logAuditAction(user.id, 'CHANGE_SIGNATURE_MODE', 'MISSION_ORDER', docId, req, {
      old_mode: mission.signature_mode || 'ELECTRONIC',
      new_mode: signature_mode,
      modeLabel
    });

    res.json({
      success: true,
      message: `Mode de signature mis à jour avec succès : ${modeLabel}.`,
      signature_mode,
      status: newStatus
    });
  } catch (err) {
    console.error('Change signature mode error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de mode de signature : ' + err.message });
  }
});

// POST /api/missions/:id/mark-manuscript-signed - Mark that physical signature and stamp have been done
router.post('/:id/mark-manuscript-signed', authenticateToken, async (req, res) => {
  const docId = req.params.id;
  const user = req.user;

  const isSC = user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user.service_code === 'SC' || user.role_code === 'ADMINISTRATEUR';
  const isSG = user.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user.role_code === 'RECTEUR' || user.permissions?.includes('mission.sign');

  if (!isSC && !isSG) {
    return res.status(403).json({ error: 'Action non autorisée.' });
  }

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ? AND document_type = "MISSION_ORDER"', [docId]);
    if (!doc) return res.status(404).json({ error: 'Ordre de mission non trouvé.' });

    const mission = await db.get('SELECT * FROM mission_orders WHERE document_id = ?', [docId]);
    if (!mission) return res.status(404).json({ error: 'Détails de l’ordre de mission introuvables.' });

    const now = new Date().toISOString();
    const newStatus = 'SIGNÉ MANUSCRITEMENT – EN ATTENTE DE NUMÉRISATION';

    await db.run(
      `UPDATE mission_orders SET manuscript_signed_at = ?, signature_mode = 'MANUSCRIPT' WHERE document_id = ?`,
      [now, docId]
    );

    await db.run(
      `UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newStatus, docId]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'SIGNATURE_MANUSCRITE_EFFECTUÉE', ?)`,
      [docId, user.id, user.service_id, `Signature manuscrite et apposition physique du cachet effectuées par le Secrétaire Général. Document prêt pour numérisation.`]
    );

    await logAuditAction(user.id, 'MARK_MANUSCRIPT_SIGNED', 'MISSION_ORDER', docId, req, {
      reference: doc.reference,
      missionary_name: mission.missionary_name
    });

    res.json({
      success: true,
      message: 'Signature manuscrite enregistrée. Veuillez maintenant importer le document scanné pour finaliser.',
      status: newStatus
    });
  } catch (err) {
    console.error('Mark manuscript signed error:', err);
    res.status(500).json({ error: 'Erreur lors de la validation de signature : ' + err.message });
  }
});

// POST /api/missions/:id/upload-signed-scan - SC imports scanned physically signed and stamped document
router.post('/:id/upload-signed-scan', authenticateToken, uploadScan.single('scanned_file'), async (req, res) => {
  const docId = req.params.id;
  const user = req.user;

  const isSC = user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user.service_code === 'SC' || user.role_code === 'ADMINISTRATEUR';
  if (!isSC) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Seul le Secrétariat Central est habilité à réintégrer le document scanné.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Veuillez sélectionner le fichier scanné (PDF ou image).' });
  }

  try {
    const doc = await db.get('SELECT * FROM documents WHERE id = ? AND document_type = "MISSION_ORDER"', [docId]);
    if (!doc) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Ordre de mission non trouvé.' });
    }

    const mission = await db.get('SELECT * FROM mission_orders WHERE document_id = ?', [docId]);
    if (!mission) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Détails de l’ordre de mission introuvables.' });
    }

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : doc.current_service_id;

    const uploadedFilename = req.file.filename;
    const now = new Date().toISOString();
    const newStatus = 'NUMÉRISÉ – RETOUR AU SECRÉTARIAT CENTRAL';

    // Update mission_orders record
    await db.run(
      `UPDATE mission_orders 
       SET is_signed = 1, signature_mode = 'MANUSCRIPT', scanned_pdf_path = ?, signed_pdf_path = ?, 
           scanned_by_user_id = ?, scanned_at = ?, returned_to_sc_at = ?
       WHERE document_id = ?`,
      [uploadedFilename, uploadedFilename, user.id, now, now, docId]
    );

    // Update documents record to lock and point to official scan
    await db.run(
      `UPDATE documents 
       SET status = ?, file_path = ?, current_service_id = ?, is_locked = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [newStatus, uploadedFilename, scServiceId, docId]
    );

    // Synchronize mission_order_requests if applicable
    await db.run(
      `UPDATE mission_order_requests 
       SET status = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE official_document_id = ?`,
      [newStatus, docId]
    );

    // Update attachments table: the scanned document becomes the official primary attachment
    const existingAtt = await db.get('SELECT id FROM attachments WHERE document_id = ? ORDER BY id ASC LIMIT 1', [docId]);
    if (existingAtt) {
      await db.run(
        `UPDATE attachments SET file_name = ?, file_path = ?, mime_type = ?, file_size = ?, uploaded_by = ? WHERE id = ?`,
        [uploadedFilename, uploadedFilename, req.file.mimetype || 'application/pdf', req.file.size, user.id, existingAtt.id]
      );
    } else {
      await db.run(
        `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [docId, uploadedFilename, uploadedFilename, req.file.size, req.file.mimetype || 'application/pdf', user.id]
      );
    }

    // Register signature entry
    await db.run(
      `INSERT INTO signatures (document_id, user_id, signature_hash, certificate_info, signed_at, pdf_path)
       VALUES (?, ?, 'SCAN_MANUSCRIT_AUTHENTIFIÉ_SC', 'Signature Manuscrite et Cachet Physique Numérisés par le Secrétariat Central', ?, ?)`,
      [docId, user.id, now, uploadedFilename]
    );

    // Document history
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'DOCUMENT_NUMÉRISÉ_ET_RÉINTÉGRÉ', ?)`,
      [docId, user.id, user.service_id, `Document original signé et cacheté numérisé (${uploadedFilename}) réintégré par le Secrétariat Central (${user.first_name} ${user.last_name}).`]
    );

    await logAuditAction(user.id, 'UPLOAD_SIGNED_SCAN', 'MISSION_ORDER', docId, req, {
      reference: doc.reference,
      filename: uploadedFilename,
      file_size: req.file.size
    });

    res.json({
      success: true,
      message: `Document scanné réintégré avec succès pour l'ordre de mission ${doc.reference}. Version officielle scellée prête pour remise et archivage.`,
      pdf_url: `/uploads/${uploadedFilename}`,
      status: newStatus
    });
  } catch (err) {
    console.error('Upload signed scan error:', err);
    res.status(500).json({ error: 'Erreur lors de la réintégration du document scanné : ' + err.message });
  }
});

module.exports = router;
