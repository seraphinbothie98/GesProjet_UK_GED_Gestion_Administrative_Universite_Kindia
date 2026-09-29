const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { UPLOAD_DIR, JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');
const { authenticateToken, requireCentralAdminOrSC } = require('../middleware/auth');
const { generateReference } = require('../services/numberGenerator');
const { logAuditAction } = require('../middleware/audit');
const { generateMissionOrderDocumentInstance } = require('../services/pdfService');
const { formatFullName } = require('../utils/userUtils');
const { validateMissionParticipants } = require('../utils/missionUtils');

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

// Helper to lookup worker in staff / users by matricule, phone, or email
async function lookupWorkerByIdentifier(rawIdentifier) {
  if (!rawIdentifier || !rawIdentifier.trim()) return null;
  const cleanId = rawIdentifier.trim();
  const lowerId = cleanId.toLowerCase();
  
  // Normalized phone representations
  const strippedPhone = cleanId.replace(/[\s\-\.\(\)\+]/g, '');
  let phone9 = strippedPhone;
  let phone12 = strippedPhone;
  if (strippedPhone.startsWith('224') && strippedPhone.length === 12) {
    phone9 = strippedPhone.substring(3);
  } else if (strippedPhone.length === 9) {
    phone12 = '224' + strippedPhone;
  }

  // 1. Check in staff directory (and join linked user)
  let worker = await db.get(
    `SELECT st.id as staff_id, st.matricule, st.nom, st.prenoms, st.fonction, st.service_id,
            st.telephone, st.email, st.status, st.is_driver, st.nationality,
            s.name as service_name, s.code as service_code,
            u.id as linked_user_id, u.email as user_email, u.password_hash as user_password_hash,
            u.status as user_status, u.role_id, r.name as role_name, r.code as role_code,
            u.function_title as user_function, u.academic_structure, u.personnel_category
     FROM staff st
     LEFT JOIN services s ON st.service_id = s.id
     LEFT JOIN users u ON st.user_id = u.id
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE LOWER(TRIM(COALESCE(st.matricule, ''))) = ?
        OR LOWER(TRIM(COALESCE(st.email, ''))) = ?
        OR LOWER(TRIM(COALESCE(u.matricule, ''))) = ?
        OR LOWER(TRIM(COALESCE(u.email, ''))) = ?
        OR st.telephone = ?
        OR u.phone = ?
        OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(st.telephone, ''), ' ', ''), '-', ''), '+', ''), '.', '') IN (?, ?)
        OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), ' ', ''), '-', ''), '+', ''), '.', '') IN (?, ?)`,
    [
      lowerId, lowerId, lowerId, lowerId,
      cleanId, cleanId,
      phone9, phone12,
      phone9, phone12
    ]
  );

  // 2. If not found in staff, check directly in users table by matricule, email, or phone
  if (!worker) {
    const user = await db.get(
      `SELECT u.id as linked_user_id, u.matricule, u.last_name as nom, u.first_name as prenoms,
              u.function_title as fonction, u.service_id, u.phone as telephone, u.email,
              u.status as user_status, u.password_hash as user_password_hash,
              u.role_id, r.name as role_name, r.code as role_code,
              u.academic_structure, u.personnel_category,
              s.name as service_name, s.code as service_code
       FROM users u
       LEFT JOIN services s ON u.service_id = s.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE LOWER(TRIM(COALESCE(u.matricule, ''))) = ?
          OR LOWER(TRIM(COALESCE(u.email, ''))) = ?
          OR u.phone = ?
          OR REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(u.phone, ''), ' ', ''), '-', ''), '+', ''), '.', '') IN (?, ?)`,
      [
        lowerId, lowerId,
        cleanId,
        phone9, phone12
      ]
    );

    if (user) {
      const st = await db.get(
        'SELECT id, status, is_driver, matricule FROM staff WHERE user_id = ? OR LOWER(matricule) = ?',
        [user.linked_user_id, lowerId]
      );
      worker = {
        staff_id: st ? st.id : null,
        matricule: (st && st.matricule) || user.matricule || cleanId,
        nom: user.nom,
        prenoms: user.prenoms,
        fonction: user.fonction,
        service_id: user.service_id,
        telephone: user.telephone,
        email: user.email,
        status: (st && st.status) || (user.user_status === 'ACTIVE' ? 'ACTIF' : 'INACTIF'),
        is_driver: st ? st.is_driver : 0,
        nationality: 'Guinéenne',
        service_name: user.service_name,
        service_code: user.service_code,
        linked_user_id: user.linked_user_id,
        user_email: user.email,
        user_password_hash: user.user_password_hash,
        user_status: user.user_status,
        role_id: user.role_id,
        role_name: user.role_name,
        role_code: user.role_code,
        user_function: user.fonction,
        academic_structure: user.academic_structure,
        personnel_category: user.personnel_category
      };
    }
  }

  return worker;
}

const lookupWorkerByMatricule = lookupWorkerByIdentifier;

// 0. POST /api/mission-requests/verify-applicant - Universal Applicant Identity Verification
router.post('/verify-applicant', async (req, res) => {
  const { identifier, matricule, password } = req.body;
  const searchKey = (identifier || matricule || '').trim();

  if (!searchKey) {
    return res.status(400).json({ error: 'Veuillez saisir votre matricule, numéro de téléphone ou adresse email.' });
  }

  try {
    const worker = await lookupWorkerByIdentifier(searchKey);

    if (!worker) {
      return res.status(404).json({
        success: false,
        code: 'WORKER_NOT_FOUND',
        message: 'Aucun travailleur trouvé avec ce matricule, numéro de téléphone ou email dans le répertoire officiel de l’Université de Kindia.'
      });
    }

    // Verify active status
    const isInactive = (worker.status && worker.status.toUpperCase() === 'INACTIF') ||
                       (worker.user_status && worker.user_status.toUpperCase() === 'INACTIVE') ||
                       (worker.user_status && worker.user_status.toUpperCase() === 'SUSPENDED');

    if (isInactive) {
      return res.status(403).json({
        success: false,
        code: 'WORKER_INACTIVE',
        message: 'Ce travailleur est actuellement enregistré avec le statut INACTIF. Veuillez contacter les Ressources Humaines ou le Secrétariat Central.'
      });
    }

    const defaultServiceName = worker.service_name || 
      (worker.personnel_category === 'ENSEIGNANT_CHERCHEUR' ? (worker.academic_structure || 'Enseignement / Recherche') : 'Services Généraux / Université de Kindia');

    // Load worker's assigned and personal vehicles
    const vehiclesData = await (async () => {
      if (!worker.staff_id) return { assigned_vehicles: [], personal_vehicles: [] };
      try {
        const assignedVehs = await db.all(`
          SELECT v.*, srv.name AS service_name, srv.code AS service_code,
                 d.nom AS default_driver_nom, d.prenoms AS default_driver_prenoms, d.telephone AS default_driver_telephone
          FROM vehicles v
          LEFT JOIN services srv ON v.assigned_service_id = srv.id
          LEFT JOIN drivers d ON v.default_driver_id = d.id
          WHERE v.assigned_staff_id = ?
          ORDER BY v.registration_number ASC
        `, [worker.staff_id]);

        const formattedAssigned = (assignedVehs || []).map(v => ({
          ...v,
          default_driver_full_name: v.default_driver_nom ? `${v.default_driver_prenoms || ''} ${v.default_driver_nom}`.trim() : null
        }));

        const personalVehs = await db.all(`
          SELECT * FROM personal_vehicles
          WHERE staff_id = ? AND (status IS NULL OR status = 'ACTIF')
          ORDER BY registration_number ASC
        `, [worker.staff_id]);

        return {
          assigned_vehicles: formattedAssigned || [],
          personal_vehicles: personalVehs || []
        };
      } catch (e) {
        return { assigned_vehicles: [], personal_vehicles: [] };
      }
    })();

    // Case 1: Worker has a UK-GED account
    if (worker.linked_user_id && worker.user_password_hash) {
      if (password && password.trim()) {
        const isMatch = await bcrypt.compare(password.trim(), worker.user_password_hash);
        if (!isMatch) {
          return res.status(401).json({
            success: false,
            code: 'INVALID_PASSWORD',
            message: 'Mot de passe incorrect pour le compte UK-GED associé à ce matricule.'
          });
        }

        const token = jwt.sign(
          {
            userId: worker.linked_user_id,
            roleCode: worker.role_code,
            tokenVersion: 1,
            email: worker.user_email || worker.email,
            role_id: worker.role_id,
            service_id: worker.service_id,
            matricule: worker.matricule
          },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        return res.json({
          success: true,
          has_account: true,
          authenticated: true,
          identification_mode: 'UK_GED_ACCOUNT',
          token,
          assigned_vehicles: vehiclesData.assigned_vehicles,
          personal_vehicles: vehiclesData.personal_vehicles,
          user: {
            id: worker.linked_user_id,
            staff_id: worker.staff_id,
            matricule: worker.matricule,
            last_name: worker.nom,
            first_name: worker.prenoms,
            function_title: worker.user_function || worker.fonction,
            service_id: worker.service_id,
            service_name: defaultServiceName,
            phone: worker.telephone || '',
            email: worker.user_email || worker.email,
            role_code: worker.role_code,
            role_name: worker.role_name,
            assigned_vehicles: vehiclesData.assigned_vehicles,
            personal_vehicles: vehiclesData.personal_vehicles
          },
          message: 'Authentification UK-GED réussie.'
        });
      }

      // Password needed
      return res.json({
        success: true,
        has_account: true,
        authenticated: false,
        requires_password: true,
        identification_mode: 'UK_GED_ACCOUNT',
        worker_preview: {
          matricule: worker.matricule,
          name: `${worker.prenoms} ${worker.nom}`,
          function_title: worker.user_function || worker.fonction,
          service_name: defaultServiceName
        },
        message: 'Compte UK-GED détecté pour ce matricule. Veuillez renseigner votre mot de passe pour ouvrir le formulaire.'
      });
    }

    // Case 2: Worker has NO UK-GED account (Chauffeur, Agent de sécurité, Agent de nettoyage, etc.)
    const verificationToken = jwt.sign(
      {
        type: 'STAFF_VERIFIED',
        staff_id: worker.staff_id,
        matricule: worker.matricule,
        nom: worker.nom,
        prenoms: worker.prenoms,
        fonction: worker.fonction,
        service_id: worker.service_id,
        service_name: defaultServiceName
      },
      JWT_SECRET,
      { expiresIn: '3h' }
    );

    return res.json({
      success: true,
      has_account: false,
      authenticated: true,
      requires_password: false,
      identification_mode: 'STAFF_MATRICULE',
      verification_token: verificationToken,
      assigned_vehicles: vehiclesData.assigned_vehicles,
      personal_vehicles: vehiclesData.personal_vehicles,
      worker: {
        staff_id: worker.staff_id,
        matricule: worker.matricule,
        last_name: worker.nom,
        first_name: worker.prenoms,
        function_title: worker.fonction,
        service_id: worker.service_id,
        service_name: defaultServiceName,
        phone: worker.telephone || '',
        email: worker.email || '',
        is_driver: worker.is_driver || 0,
        assigned_vehicles: vehiclesData.assigned_vehicles,
        personal_vehicles: vehiclesData.personal_vehicles
      },
      message: 'Travailleur universitaire reconnu dans le répertoire officiel. Accès accordé sans obligation de compte UK-GED.'
    });
  } catch (err) {
    console.error('Verify applicant error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification du travailleur.' });
  }
});

// 0.1 POST /api/mission-requests/claim-matricule - Report unrecognized matricule to SC/HR
router.post('/claim-matricule', async (req, res) => {
  const { matricule, last_name, first_names, function_title, service_name, phone, email, notes } = req.body;

  if (!matricule || !last_name || !first_names || !phone) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (Matricule, Nom, Prénoms, Téléphone).' });
  }

  try {
    const result = await db.run(
      `INSERT INTO matricule_verification_claims (
        matricule, last_name, first_names, function_title, service_name, phone, email, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        matricule.trim(),
        last_name.trim(),
        first_names.trim(),
        function_title ? function_title.trim() : null,
        service_name ? service_name.trim() : null,
        phone.trim(),
        email ? email.trim() : null,
        notes ? notes.trim() : null
      ]
    );

    await notifySecretariatCentral(
      `Signalement de matricule non reconnu (${matricule.trim()})`,
      `Le travailleur ${first_names.trim()} ${last_name.trim()} (${function_title || 'Non spécifié'}) a demandé la vérification de son matricule pour pouvoir créer une demande de mission.`
    );

    res.status(201).json({
      success: true,
      claim_id: result.lastID,
      message: 'Votre signalement a été transmis au Secrétariat Central et aux Ressources Humaines. Aucune demande d’ordre de mission non authentifiée n’a été créée.'
    });
  } catch (err) {
    console.error('Claim matricule error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de votre signalement.' });
  }
});

// 1. POST /api/mission-requests/public - Verified request submission without account
router.post('/public', upload.array('files'), async (req, res) => {
  const {
    verification_token,
    applicant_matricule,
    applicant_last_name,
    applicant_first_names,
    applicant_function,
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
    vehicle_id,
    personal_vehicle_id,
    vehicle_registration,
    driver_option,
    driver_id,
    driver_name,
    justification_motif,
    host_organization,
    local_contact
  } = req.body;

  if (!applicant_matricule || !applicant_phone || !object_of_mission || !destination || !start_date || !end_date) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (Matricule, Téléphone, Objet, Destination, Dates).' });
  }

  try {
    // Verify worker identity against official staff directory
    let staffRecord = null;

    if (verification_token) {
      try {
        const decoded = jwt.verify(verification_token, JWT_SECRET);
        if (decoded.type === 'STAFF_VERIFIED' && decoded.matricule) {
          staffRecord = await lookupWorkerByIdentifier(decoded.matricule);
        }
      } catch (tokenErr) {
        console.warn('Verification token expired or invalid, falling back to database check:', tokenErr.message);
      }
    }

    if (!staffRecord) {
      staffRecord = await lookupWorkerByIdentifier(applicant_matricule);
    }

    if (!staffRecord) {
      return res.status(403).json({
        error: 'Échec de vérification : Le matricule n’est pas reconnu dans le répertoire officiel des travailleurs.'
      });
    }

    const isInactive = (staffRecord.status && staffRecord.status.toUpperCase() === 'INACTIF') ||
                       (staffRecord.user_status && staffRecord.user_status.toUpperCase() === 'INACTIVE');
    if (isInactive) {
      return res.status(403).json({
        error: 'Échec de vérification : Ce travailleur est enregistré avec le statut INACTIF.'
      });
    }

    // Lock verified identity details to official records to prevent client-side spoofing
    const finalMatricule = staffRecord.matricule;
    const finalLastName = staffRecord.nom;
    const finalFirstNames = staffRecord.prenoms;
    const finalFunction = staffRecord.fonction;
    const finalService = staffRecord.service_name || applicant_service_name || 'Université de Kindia';
    const finalPhone = (applicant_phone && applicant_phone.trim()) || staffRecord.telephone || 'Non renseigné';
    const finalEmail = (applicant_email && applicant_email.trim()) || staffRecord.email || `${finalMatricule.toLowerCase()}@univ-kindia.edu.gn`;
    const finalStaffId = staffRecord.staff_id || null;
    const finalUserId = staffRecord.linked_user_id || null;
    const identificationMode = finalUserId ? 'UK_GED_ACCOUNT' : 'STAFF_MATRICULE';

    // Validate participants (OM individuel ou collectif)
    let sanitizedParticipants = [];
    try {
      sanitizedParticipants = validateMissionParticipants(req.body.participants, {
        id: finalUserId,
        staff_id: finalStaffId,
        nom: finalLastName,
        prenoms: finalFirstNames,
        titre: req.body.applicant_titre || staffRecord.titre || 'M.',
        fonction: finalFunction,
        matricule: finalMatricule,
        service_name: finalService,
        phone: finalPhone,
        email: finalEmail
      });
    } catch (valErr) {
      return res.status(400).json({ error: valErr.message });
    }

    const missionType = sanitizedParticipants.length > 1 ? 'COLLECTIF' : 'INDIVIDUEL';
    const participantsCount = sanitizedParticipants.length;

    const scService = await db.get('SELECT id, name FROM services WHERE code = "SC" LIMIT 1');
    const destServiceId = scService ? scService.id : 5;
    const destServiceName = scService ? scService.name : 'Secrétariat Central';

    const reference = await generateReference('DMO');
    const trackingToken = require('crypto').randomBytes(16).toString('hex');
    const initialStatus = 'EN_ATTENTE_SC';

    const result = await db.run(
      `INSERT INTO mission_order_requests (
        reference, tracking_token, user_id, staff_id, identification_mode,
        destination_service_id, destination_service_name,
        applicant_last_name, applicant_first_names, applicant_function, applicant_matricule,
        applicant_service_name, applicant_phone, applicant_email, applicant_institution,
        object_of_mission, destination, country, exact_location,
        start_date, end_date, duration_days, transport_means,
        vehicle_id, personal_vehicle_id, vehicle_registration,
        driver_option, driver_id, driver_name,
        justification_motif, host_organization, local_contact, status,
        mission_type, participants_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        trackingToken,
        finalUserId,
        finalStaffId,
        identificationMode,
        destServiceId,
        destServiceName,
        finalLastName.trim(),
        finalFirstNames.trim(),
        finalFunction.trim(),
        finalMatricule.trim(),
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
        transport_means || 'Véhicule service/Personnel',
        vehicle_id || null,
        personal_vehicle_id || null,
        vehicle_registration || null,
        driver_option || 'SELF',
        driver_id || null,
        driver_name || null,
        justification_motif || null,
        host_organization || null,
        local_contact || null,
        initialStatus,
        missionType,
        participantsCount
      ]
    );

    const requestId = result.lastID;

    // Save participants snapshots into mission_order_participants
    for (let i = 0; i < sanitizedParticipants.length; i++) {
      const p = sanitizedParticipants[i];
      await db.run(
        `INSERT INTO mission_order_participants (
          request_id, user_id, staff_id, nom, prenoms, titre, fonction, matricule, service_name, telephone, email, is_requester, order_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId,
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

    const roleDescriptor = finalUserId ? 'Utilisateur UK-GED' : `Travailleur identifié (${finalFunction})`;

    // Log History Step 1
    await logRequestHistory(
      requestId,
      finalUserId,
      roleDescriptor,
      'SUBMIT_REQUEST',
      null,
      initialStatus,
      `Demande d'ordre de mission déposée par le travailleur ${finalFirstNames} ${finalLastName} (Matricule: ${finalMatricule}) - ${reference}.`
    );

    await notifySecretariatCentral(
      `Nouvelle demande d'ordre de mission (${reference})`,
      `Demande reçue de ${finalFirstNames} ${finalLastName} (${finalFunction}, Mat: ${finalMatricule}) pour "${destination.trim()}".`,
      requestId
    );

    res.status(201).json({
      success: true,
      message: 'Votre demande d’ordre de mission a été enregistrée avec succès et transmise au Secrétariat Central.',
      id: requestId,
      reference,
      tracking_token: trackingToken,
      status: initialStatus,
      destination_service_name: destServiceName,
      applicant: {
        name: `${finalFirstNames} ${finalLastName}`,
        matricule: finalMatricule,
        function: finalFunction,
        service: finalService,
        identification_mode: identificationMode
      }
    });
  } catch (err) {
    console.error('Public mission request submit error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de l’enregistrement de votre demande.' });
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
    vehicle_id,
    personal_vehicle_id,
    vehicle_registration,
    driver_option,
    driver_id,
    driver_name,
    justification_motif,
    host_organization,
    local_contact
  } = req.body;

  try {
    const user = req.user;
    const staffRecord = await db.get('SELECT id FROM staff WHERE user_id = ? OR (matricule IS NOT NULL AND matricule = ?)', [user.id, user.matricule || '']);
    const staffId = staffRecord ? staffRecord.id : null;
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

    // Validate participants (OM individuel ou collectif)
    let sanitizedParticipants = [];
    try {
      sanitizedParticipants = validateMissionParticipants(req.body.participants, {
        id: user.id,
        staff_id: staffId,
        nom: finalLastName,
        prenoms: finalFirstNames,
        titre: req.body.applicant_titre || user.titre || 'M.',
        fonction: finalFunction,
        matricule: finalMatricule,
        service_name: finalService,
        phone: finalPhone,
        email: finalEmail
      });
    } catch (valErr) {
      return res.status(400).json({ error: valErr.message });
    }

    const missionType = sanitizedParticipants.length > 1 ? 'COLLECTIF' : 'INDIVIDUEL';
    const participantsCount = sanitizedParticipants.length;

    const reference = await generateReference('DMO');
    const trackingToken = require('crypto').randomBytes(16).toString('hex');
    const initialStatus = 'EN_ATTENTE_SC';

    const result = await db.run(
      `INSERT INTO mission_order_requests (
        reference, tracking_token, user_id, staff_id, identification_mode,
        destination_service_id, destination_service_name,
        applicant_last_name, applicant_first_names, applicant_function, applicant_matricule,
        applicant_service_name, applicant_phone, applicant_email, applicant_institution,
        object_of_mission, destination, country, exact_location,
        start_date, end_date, duration_days, transport_means,
        vehicle_id, personal_vehicle_id, vehicle_registration,
        driver_option, driver_id, driver_name,
        justification_motif, host_organization, local_contact, status,
        mission_type, participants_count
      ) VALUES (?, ?, ?, ?, 'UK_GED_ACCOUNT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reference,
        trackingToken,
        user.id,
        staffId,
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
        transport_means || 'Véhicule service/Personnel',
        vehicle_id || null,
        personal_vehicle_id || null,
        vehicle_registration || null,
        driver_option || 'SELF',
        driver_id || null,
        driver_name || null,
        justification_motif || null,
        host_organization || null,
        local_contact || null,
        initialStatus,
        missionType,
        participantsCount
      ]
    );

    const requestId = result.lastID;

    // Save participants snapshots into mission_order_participants
    for (let i = 0; i < sanitizedParticipants.length; i++) {
      const p = sanitizedParticipants[i];
      await db.run(
        `INSERT INTO mission_order_participants (
          request_id, user_id, staff_id, nom, prenoms, titre, fonction, matricule, service_name, telephone, email, is_requester, order_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId,
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
  const { status, view, search } = req.query;

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

    if (view === 'active') {
      query += ` AND r.status IN ('EN_ATTENTE_SC', 'DEMANDE ENREGISTRÉE', 'EN ATTENTE', 'DEMANDE REÇUE') AND r.official_document_id IS NULL`;
    }

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
    const participants = await db.all('SELECT * FROM mission_order_participants WHERE request_id = ? ORDER BY order_index ASC', [id]);

    const effectiveParticipants = participants.length > 0 ? participants : [{
      request_id: request.id,
      user_id: request.user_id,
      staff_id: request.staff_id,
      nom: request.applicant_last_name,
      prenoms: request.applicant_first_names,
      titre: request.applicant_titre || 'M.',
      fonction: request.applicant_function,
      matricule: request.applicant_matricule,
      service_name: request.applicant_service_name,
      telephone: request.applicant_phone,
      email: request.applicant_email,
      is_requester: 1,
      order_index: 1
    }];

    res.json({
      ...request,
      participants: effectiveParticipants,
      mission_type: request.mission_type || (effectiveParticipants.length > 1 ? 'COLLECTIF' : 'INDIVIDUEL'),
      participants_count: effectiveParticipants.length,
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

    if (request.official_document_id) {
      return res.status(409).json({ 
        error: 'Un ordre de mission officiel a déjà été créé pour cette demande (Demande déjà traitée).',
        official_document_id: request.official_document_id
      });
    }

    if (request.status === 'REJETÉ' || request.status === 'ARCHIVÉ') {
      return res.status(400).json({ error: `Impossible de préparer un ordre de mission pour une demande au statut "${request.status}".` });
    }

    // Re-use the EXACT unique immutable reference of the initial mission request!
    const officialRef = request.reference;
    const trackingToken = require('crypto').randomBytes(16).toString('hex');

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : req.user.service_id;

    // Retrieve participants associated with this mission request
    let participants = await db.all(
      'SELECT * FROM mission_order_participants WHERE request_id = ? ORDER BY order_index ASC',
      [id]
    );

    if (!participants || participants.length === 0) {
      participants = [{
        user_id: request.user_id,
        staff_id: request.staff_id,
        nom: request.applicant_last_name,
        prenoms: request.applicant_first_names,
        titre: request.applicant_titre || 'M.',
        fonction: request.applicant_function,
        matricule: request.applicant_matricule,
        service_name: request.applicant_service_name,
        telephone: request.applicant_phone,
        email: request.applicant_email,
        is_requester: 1,
        order_index: 1
      }];
    }

    const isCollective = participants.length > 1;
    const missionType = isCollective ? 'COLLECTIF' : 'INDIVIDUEL';
    const participantsCount = participants.length;

    // Generate Frozen Document Instance (DOCX + PDF) using default official template
    const missionaryFullName = formatFullName({
      nom: request.applicant_last_name,
      prenoms: request.applicant_first_names,
      titre: request.applicant_titre || 'M.'
    }, `${request.applicant_first_names} ${request.applicant_last_name}`.trim());

    let instanceResult = null;
    try {
      instanceResult = await generateMissionOrderDocumentInstance({
        reference: officialRef,
        created_at: new Date().toISOString(),
        missionary_name: missionaryFullName,
        missionary_firstnames: request.applicant_first_names,
        missionary_last_name: request.applicant_last_name,
        missionary_titre: request.applicant_titre || 'M.',
        titre: request.applicant_titre || 'M.',
        grade: request.applicant_titre || 'M.',
        function_title: request.applicant_function,
        missionary_service: request.applicant_service_name,
        matricule: request.applicant_matricule,
        nationality: request.country === 'Guinée' ? 'Guinéenne' : (request.country || 'Guinéenne'),
        destination: request.destination,
        object_of_mission: request.object_of_mission,
        transport_mode: request.transport_means || 'Véhicule service/Personnel',
        departure_date: request.start_date,
        return_date: request.end_date,
        driver_name: request.driver_name || 'Lui-même',
        driver_option: request.driver_option || 'SELF',
        vehicle_registration: request.vehicle_registration,
        tracking_token: trackingToken,
        participants,
        mission_type: missionType,
        participants_count: participantsCount
      });
    } catch (genErr) {
      console.warn('Official OM instance generation fallback:', genErr.message);
    }

    const initialFilePath = instanceResult?.generated_file_path || null;
    const docTitle = isCollective
      ? `Ordre de mission collectif (${participantsCount} personnes) : ${request.applicant_first_names} ${request.applicant_last_name} et al.`
      : `Ordre de mission : ${request.applicant_first_names} ${request.applicant_last_name}`;

    // Create official document in GED documents table with inherited reference
    const docRes = await db.run(
      `INSERT INTO documents (
        reference, tracking_token, document_type, title, description, sender_name, sender_organization,
        status, current_service_id, current_user_id, created_by, file_path
      ) VALUES (?, ?, 'MISSION_ORDER', ?, ?, ?, ?, 'DRAFT', ?, NULL, ?, ?)`,
      [
        officialRef,
        trackingToken,
        docTitle,
        request.object_of_mission,
        `${request.applicant_first_names} ${request.applicant_last_name}`,
        request.applicant_service_name,
        scServiceId,
        req.user.id,
        initialFilePath
      ]
    );

    const docId = docRes.lastID;

    // Populate mission_orders table extension with request_id link and vehicle details
    await db.run(
      `INSERT INTO mission_orders (
        document_id, request_id, missionary_name, nationality, function_title,
        destination, object_of_mission, transport_mode, departure_date, return_date,
        vehicle_id, personal_vehicle_id, vehicle_registration, driver_option, driver_id, driver_name,
        template_id, template_version_id, template_version_number, generated_file_path, generated_docx_path,
        missionary_name_snapshot, missionary_firstnames_snapshot, missionary_titre_snapshot, missionary_function_snapshot, missionary_service_snapshot, missionary_matricule_snapshot,
        mission_type, participants_count, requester_id
      ) VALUES (?, ?, ?, 'Guinéenne', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        id,
        missionaryFullName,
        request.applicant_function,
        request.destination,
        request.object_of_mission,
        request.transport_means || 'Véhicule service/Personnel',
        request.start_date,
        request.end_date,
        request.vehicle_id || null,
        request.personal_vehicle_id || null,
        request.vehicle_registration || null,
        request.driver_option || 'SELF',
        request.driver_id || null,
        request.driver_name || null,
        instanceResult?.template_id || null,
        instanceResult?.template_version_id || null,
        instanceResult?.template_version_number || 1,
        instanceResult?.generated_file_path || null,
        instanceResult?.generated_docx_path || null,
        request.applicant_last_name,
        request.applicant_first_names,
        request.applicant_titre || 'M.',
        request.applicant_function,
        request.applicant_service_name,
        request.applicant_matricule,
        missionType,
        participantsCount,
        request.user_id || null
      ]
    );

    // Link/insert all participants with mission_order_id = docId
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (p.id) {
        await db.run('UPDATE mission_order_participants SET mission_order_id = ? WHERE id = ?', [docId, p.id]);
      } else {
        await db.run(
          `INSERT INTO mission_order_participants (
            mission_order_id, request_id, user_id, staff_id, nom, prenoms, titre, fonction, matricule, service_name, telephone, email, is_requester, order_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            docId, id, p.user_id || null, p.staff_id || null,
            p.nom, p.prenoms, p.titre || 'M.', p.fonction, p.matricule || null, p.service_name || null, p.telephone || null, p.email || null,
            p.is_requester || 0, i + 1
          ]
        );
      }
    }

    // Save attachment for PDF preview
    if (initialFilePath) {
      await db.run(
        `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, uploaded_by)
         VALUES (?, ?, ?, 120000, 'application/pdf', ?)`,
        [docId, initialFilePath, initialFilePath, req.user.id]
      );
    }

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
