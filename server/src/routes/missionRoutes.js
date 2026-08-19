const fs = require('fs');
const path = require('path');
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { generateReference, generateReferenceWithMeta } = require('../services/numberGenerator');
const { generateSignedMissionOrderPDF, generateMissionOrderDocumentInstance, resolveLocalFilePath } = require('../services/pdfService');
const { generateAndStoreReceipt } = require('../services/receiptService');
const { logAuditAction } = require('../middleware/audit');
const { JWT_SECRET, UPLOAD_DIR } = require('../config/constants');

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

// GET /api/missions/to-sign - Generic Inbox for Pending Mission Signatures/Validations
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
       WHERE d.created_by = ? AND d.status != 'TRASHED'
       ORDER BY d.created_at DESC`,
      [user.id]
    );
    res.json(requests);
  } catch (err) {
    console.error('Fetch my mission requests error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de vos demandes d’ordre de mission.' });
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

    // Create document record owned by Secrétariat Central
    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, title, description, sender_name, sender_organization, priority, confidentiality, status, current_service_id, created_by, deadline_date, reference_meta)
       VALUES (?, ?, 'MISSION_ORDER', ?, ?, ?, 'Université de Kindia', 'NORMAL', 'INTERNAL', 'PENDING', ?, ?, ?, ?)`,
      [
        reference, 
        trackingToken, 
        `Demande d'ordre de mission : ${fullName} vers ${destination}`, 
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
        personnel_category, faculty_dept, missionary_name_snapshot, missionary_firstnames_snapshot, missionary_function_snapshot, missionary_service_snapshot, missionary_matricule_snapshot)
       VALUES (?, ?, 'Guinéenne', ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
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
        user.matricule || ''
      ]
    );

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
    driver_option, driver_id, driver_name, vehicle_id, vehicle_registration, observations 
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

    const { reference, reference_meta } = await generateReferenceWithMeta('MISSION_ORDER');
    const trackingToken = crypto.randomBytes(16).toString('hex');

    // Fetch Secrétariat Général service ID for signature routing
    const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
    const targetServiceId = sgService ? sgService.id : user.service_id;

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
        function_title,
        missionary_service: serviceName,
        matricule: matricule || (staffMember ? staffMember.matricule : ''),
        nationality: nationality || 'Guinéenne',
        destination,
        object_of_mission,
        transport_mode: transport_mode || 'Véhicule de service',
        departure_date,
        return_date,
        driver_name: driver_name || ''
      }, templateId, templateVersionId);
    } catch (genErr) {
      console.warn('Instance generation fallback:', genErr.message);
    }

    const initialFilePath = instanceResult?.generated_file_path || null;

    const docRes = await db.run(
      `INSERT INTO documents 
       (reference, tracking_token, document_type, title, description, sender_name, sender_organization, priority, confidentiality, status, current_service_id, created_by, deadline_date, reference_meta, file_path)
       VALUES (?, ?, 'MISSION_ORDER', ?, ?, ?, 'Université de Kindia', 'HIGH', 'INTERNAL', 'PENDING', ?, ?, ?, ?, ?)`,
      [reference, trackingToken, `Ordre de mission : ${missionary_name} vers ${destination}`, object_of_mission, user.first_name + ' ' + user.last_name, targetServiceId, user.id, departure_date, reference_meta, initialFilePath]
    );

    const docId = docRes.lastID;

    // Snapshots & Frozen Template Instance Metadata
    await db.run(
      `INSERT INTO mission_orders 
       (document_id, missionary_id, missionary_name, nationality, function_title, destination, object_of_mission, transport_mode, departure_date, return_date, driver_option, driver_id, driver_name, vehicle_id, observations, is_signed,
        missionary_name_snapshot, missionary_firstnames_snapshot, missionary_nationality_snapshot, missionary_function_snapshot, missionary_service_snapshot, missionary_matricule_snapshot, driver_name_snapshot, vehicle_registration_snapshot,
        template_id, template_version_id, template_version_number, generated_file_path, generated_docx_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        docId,
        staff_id || null,
        missionary_name,
        nationality || 'Guinéenne',
        function_title || 'Enseignant-Chercheur / Agent UK',
        destination,
        object_of_mission,
        transport_mode || 'Véhicule de service',
        departure_date,
        return_date,
        driver_option || 'SELF',
        driver_id || null,
        driver_name || '',
        vehicle_id || null,
        observations || '',
        staffMember ? staffMember.nom : missionary_name,
        staffMember ? staffMember.prenoms : (missionary_firstnames || ''),
        nationality || 'Guinéenne',
        function_title || 'Enseignant-Chercheur / Agent UK',
        serviceName || '',
        matricule || (staffMember ? staffMember.matricule : ''),
        driver_name || '',
        vehicle_registration || '',
        instanceResult?.template_id || null,
        instanceResult?.template_version_id || null,
        instanceResult?.template_version_number || 1,
        instanceResult?.generated_file_path || null,
        instanceResult?.generated_docx_path || null
      ]
    );

    // Save Single Original Attachment (Rule 2: No duplicate attachments)
    const originalPdf = instanceResult?.generated_file_path || initialFilePath;
    if (originalPdf) {
      await db.run(
        `INSERT INTO attachments (document_id, file_name, file_path, file_size, mime_type, uploaded_by)
         VALUES (?, ?, ?, 120000, 'application/pdf', ?)`,
        [docId, originalPdf, originalPdf, user.id]
      );
    }

    // Comprehensive Chronological History
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'MODÈLE_SÉLECTIONNÉ', ?)`,
      [docId, user.id, user.service_id, `Modèle officiel Ordre de Mission sélectionné (Version ${instanceResult?.template_version_number || 1})`]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'CREATE', ?)`,
      [docId, user.id, user.service_id, `Ordre de mission créé par le Secrétariat Central. Réf: ${reference}`]
    );

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'DOCUMENT_ORIGINAL_GÉNÉRÉ', ?)`,
      [docId, user.id, user.service_id, `Document original généré (${originalPdf || 'Prêt pour signature'})`]
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

    await logAuditAction(user.id, 'CREATE', 'MISSION_ORDER', docId, req, { reference, template_id: instanceResult?.template_id, version: instanceResult?.template_version_number });

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
      receipt: receiptInfo 
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
        verification_url: `http://localhost:5000/api/verify/${encodeURIComponent(doc.reference || 'REF')}`
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

    const signerFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Dr Mamadou Billo DOUMBOUYA';
    const signerRole = user.function_title || user.role_name || 'LE SECRETAIRE GENERAL';

    const signatureDetails = {
      signed_at: signedAt,
      signed_by_name: signerFullName,
      signed_by_role: signerRole,
      signature_hash: signatureHash,
      signature_image_path: userSignature.signature_image_path
    };

    // 4. Build official signed PDF with real signature image & QR code
    const pdfResult = await generateSignedMissionOrderPDF(
      { 
        ...mission, 
        reference: doc.reference,
        template_id: mission.template_id,
        template_version_id: mission.template_version_id
      },
      signatureDetails
    );

    if (!pdfResult || !pdfResult.filePath || !fs.existsSync(pdfResult.filePath)) {
      return res.status(500).json({
        error: "Le document signé n'a pas pu être généré. L'ordre de mission n'a pas été marqué comme signé."
      });
    }

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scServiceId = scService ? scService.id : doc.current_service_id;

    // 5. Update mission_orders table
    await db.run(
      `UPDATE mission_orders 
       SET is_signed = 1, signed_at = ?, signed_by_user_id = ?, signature_token = ?, signed_pdf_path = ?, returned_to_sc_at = ?
       WHERE document_id = ?`,
      [signedAt, user.id, signatureHash, pdfResult.filename, signedAt, docId]
    );

    // 6. Lock document and return holder to Secrétariat Central
    await db.run(
      `UPDATE documents 
       SET status = 'RETOURNÉ AU SECRÉTARIAT CENTRAL', current_service_id = ?, is_locked = 1, qr_code_hash = ?, file_path = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [scServiceId, signatureHash, pdfResult.filename, docId]
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

    res.json({
      success: true,
      message: 'Ordre de mission signé numériquement, verrouillé et retourné au Secrétariat Central avec succès.',
      pdf_url: `/uploads/${pdfResult.filename}`,
      verification_url: pdfResult.verificationUrl
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

module.exports = router;
