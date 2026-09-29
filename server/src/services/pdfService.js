const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { generateQRCodeBuffer } = require('./qrService');
const { UPLOAD_DIR } = require('../config/constants');
const docxService = require('./docxService');
const { convertDocxToPdf } = require('./docxToPdfEngine');
const { formatFullName, formatTransportDisplay, formatDriverDisplay } = require('../utils/userUtils');

/**
 * Helper to dynamically resolve the active Secrétaire Général / Signatory
 */
async function resolveCurrentMissionSignatory(signatureDetails = {}) {
  // If explicitly passed with a real custom signer name
  if (signatureDetails.signed_by_name && signatureDetails.signed_by_name !== 'Dr Mamadou Billo DOUMBOUYA') {
    return {
      signerName: formatFullName(signatureDetails.signed_by_name),
      signerRole: signatureDetails.signed_by_role || 'LE SECRETAIRE GENERAL',
      signaturePath: signatureDetails.signature_image_path || null
    };
  }

  try {
    // 1. Check active assignment on position SECRETARIAT_GENERAL or RECTEUR
    const sgAssign = await db.get(
      `SELECT sa.*, p.title as pos_title, p.code as pos_code, 
              s.nom, s.prenoms, s.titre as staff_titre, s.user_id,
              u.first_name, u.last_name, u.titre as user_titre, u.id as direct_user_id
       FROM staff_assignments sa 
       JOIN positions p ON sa.position_id = p.id 
       LEFT JOIN staff s ON sa.staff_id = s.id 
       LEFT JOIN users u ON s.user_id = u.id 
       WHERE sa.status = 'ACTIVE' 
         AND (p.code = 'SECRETARIAT_GENERAL' OR p.title LIKE '%Secrétaire Général%')
       ORDER BY sa.id DESC LIMIT 1`
    );

    if (sgAssign) {
      const nom = sgAssign.nom || sgAssign.last_name || '';
      const prenoms = sgAssign.prenoms || sgAssign.first_name || '';
      const titre = sgAssign.staff_titre || sgAssign.user_titre || '';
      const fullName = formatFullName({ nom, prenoms, titre });
      const role = sgAssign.pos_title ? sgAssign.pos_title.toUpperCase() : 'LE SECRETAIRE GENERAL';

      const userId = sgAssign.user_id || sgAssign.direct_user_id;
      let sigPath = signatureDetails.signature_image_path || null;
      if (!sigPath && userId) {
        const sig = await db.get(
          `SELECT signature_image_path FROM user_signatures WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1`,
          [userId]
        );
        sigPath = sig?.signature_image_path || null;
      }

      return {
        signerName: fullName,
        signerRole: role,
        signaturePath: sigPath
      };
    }

    // 2. Check active user with role SECRÉTAIRE_GÉNÉRAL
    const sgUser = await db.get(
      `SELECT u.id, u.first_name, u.last_name, u.titre, u.function_title, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE (r.code = 'SECRÉTAIRE_GÉNÉRAL' OR u.function_title LIKE '%Secrétaire Général%')
         AND u.status = 'ACTIVE'
       ORDER BY u.id DESC LIMIT 1`
    );

    if (sgUser) {
      const fullName = formatFullName({ nom: sgUser.last_name, prenoms: sgUser.first_name, titre: sgUser.titre });
      const role = (sgUser.function_title || sgUser.role_name || 'LE SECRETAIRE GENERAL').toUpperCase();
      let sigPath = signatureDetails.signature_image_path || null;
      if (!sigPath) {
        const sig = await db.get(
          `SELECT signature_image_path FROM user_signatures WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1`,
          [sgUser.id]
        );
        sigPath = sig?.signature_image_path || null;
      }

      return {
        signerName: fullName,
        signerRole: role,
        signaturePath: sigPath
      };
    }
  } catch (err) {
    console.error('[resolveCurrentMissionSignatory] Error resolving signatory:', err);
  }

  // 3. If no active signatory configured, display empty or explicitly given
  return {
    signerName: signatureDetails.signed_by_name ? formatFullName(signatureDetails.signed_by_name) : '',
    signerRole: signatureDetails.signed_by_role || 'LE SECRETAIRE GENERAL',
    signaturePath: signatureDetails.signature_image_path || null
  };
}
async function getActiveTemplateForDocumentType(documentTypeCode, specificTemplateId = null, specificVersionId = null) {
  let template = null;

  const isMissionOrder = ['MISSION_ORDER', 'ORDRE_001', 'OM_OFFICIAL', 'Missions'].includes(documentTypeCode);
  if (isMissionOrder) {
    let moTemplate = null;
    if (specificTemplateId) {
      moTemplate = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [specificTemplateId]);
    }
    if (!moTemplate && specificVersionId) {
      moTemplate = await db.get('SELECT * FROM mission_order_templates WHERE id = ? OR version_number = ?', [specificVersionId, specificVersionId]);
    }
    if (!moTemplate) {
      // Prioritize strictly the template explicitly set as DEFAULT
      moTemplate = await db.get(`
        SELECT * FROM mission_order_templates 
        WHERE is_default = 1 AND status = 'ACTIVE'
        ORDER BY version_number DESC, id DESC 
        LIMIT 1
      `);
    }
    if (!moTemplate) {
      // Fallback to active template if no default explicitly flagged
      moTemplate = await db.get(`
        SELECT * FROM mission_order_templates 
        WHERE status = 'ACTIVE' 
        ORDER BY is_default DESC, version_number DESC, id DESC 
        LIMIT 1
      `);
    }
    if (moTemplate) {
      return {
        template: {
          ...moTemplate,
          code: 'ORDRE_001',
          document_type_code: 'MISSION_ORDER',
          version: moTemplate.version_number || 1
        },
        activeVersion: {
          ...moTemplate,
          version_number: moTemplate.version_number || 1
        },
        contentHtml: null,
        headerText: 'RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA',
        footerText: 'UNIVERSITÉ DE KINDIA • BP 164 Kindia, Guinée',
        fontFamily: 'Times New Roman',
        fontSize: 12,
        primaryColor: '#002B80',
        secondaryColor: '#D4AF37'
      };
    }
    return null;
  }

  if (specificTemplateId) {
    template = await db.get('SELECT * FROM document_templates WHERE id = ? OR code = ?', [specificTemplateId, specificTemplateId]);
  }

  if (!template) {
    template = await db.get(
      `SELECT * FROM document_templates 
       WHERE (code = ? OR document_type_code = ? OR category = ?) 
         AND (is_active = 1 OR is_default = 1) 
       ORDER BY is_default DESC, is_active DESC, updated_at DESC LIMIT 1`,
      [documentTypeCode, documentTypeCode, documentTypeCode]
    );
  }

  if (!template) {
    template = await db.get(
      `SELECT * FROM document_templates 
       WHERE (code LIKE ? OR name LIKE ?) 
         AND (is_active = 1 OR is_default = 1) 
       ORDER BY is_default DESC, is_active DESC, updated_at DESC LIMIT 1`,
      [`%${documentTypeCode}%`, `%${documentTypeCode}%`]
    );
  }

  if (!template) {
    template = await db.get(
      `SELECT * FROM document_templates WHERE is_default = 1 OR is_active = 1 ORDER BY updated_at DESC LIMIT 1`
    );
  }

  if (!template) {
    return null;
  }

  let activeVersion = null;
  if (specificVersionId && specificVersionId !== 'current' && specificVersionId !== 'latest') {
    activeVersion = await db.get(
      `SELECT * FROM template_versions 
       WHERE (id = ? OR version_number = ?) AND template_id = ? 
       ORDER BY id DESC LIMIT 1`,
      [specificVersionId, specificVersionId, template.id]
    );
  }

  if (!activeVersion) {
    activeVersion = await db.get(
      `SELECT * FROM template_versions 
       WHERE template_id = ? AND (version = ? OR version_number = ?) 
       ORDER BY id DESC LIMIT 1`,
      [template.id, template.version || 1, template.version || 1]
    );
  }

  if (!activeVersion) {
    activeVersion = await db.get(
      `SELECT * FROM template_versions WHERE template_id = ? ORDER BY version_number DESC LIMIT 1`,
      [template.id]
    );
  }

  return {
    template,
    activeVersion,
    contentHtml: template.content_body_html || (activeVersion ? activeVersion.content_body_html : null),
    headerText: template.header_text || 'RÉPUBLIQUE DE GUINÉE\nMINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR\nUNIVERSITÉ DE KINDIA',
    footerText: template.footer_text || 'UNIVERSITÉ DE KINDIA • BP 164 Kindia, Guinée',
    fontFamily: template.font_family || 'Helvetica',
    fontSize: template.font_size || 12,
    primaryColor: template.primary_color || '#0B2545',
    secondaryColor: template.secondary_color || '#D4AF37'
  };
}

// Robust helper to resolve local file paths across all candidate directories
function resolveLocalFilePath(targetPath, subfolder = '') {
  if (!targetPath) return null;
  const basename = path.basename(targetPath);
  const candidates = [
    targetPath,
    path.isAbsolute(targetPath) ? targetPath : null,
    subfolder ? path.join(UPLOAD_DIR, subfolder, basename) : null,
    path.join(UPLOAD_DIR, 'templates', basename),
    path.join(UPLOAD_DIR, basename),
    path.join(UPLOAD_DIR, '..', 'templates', basename),
    path.join(UPLOAD_DIR, '..', basename),
    path.join(process.cwd(), targetPath.replace(/^\/+/, '')),
    path.join(process.cwd(), 'server', targetPath.replace(/^\/+/, '')),
    path.join(__dirname, '../../uploads/templates', basename),
    path.join(__dirname, '../../uploads', subfolder || '', basename),
    path.join(__dirname, '../../uploads', basename),
    path.join(process.cwd(), 'uploads/templates', basename),
    path.join(process.cwd(), 'uploads', basename)
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (e) { }
  }
  return null;
}

/**
 * Format transport mode strictly appending vehicle registration number
 * if "Véhicule Personnel" or "Véhicule Officiel de l’Université" is chosen.
 */
function formatTransportMode(transportMode) {
  return (transportMode || '').trim();
}

/**
 * Mission Order PDF Generator strictly derived from the imported default template.
 * Supports BOTH DIRECT_PDF (Dynamic Visual Coordinates) and WORD_DOCX (LibreOffice/OnlyOffice).
 * NEVER deletes or alters the Word process.
 */
async function generateOfficialKindiaMissionOrderPDF(missionData, options = {}) {
  const activeTemplateData = await getActiveTemplateForDocumentType(
    'MISSION_ORDER',
    missionData?.template_id,
    missionData?.template_version_id
  );

  if (!activeTemplateData) {
    throw new Error('Aucun modèle officiel actif trouvé pour les Ordres de Mission. Veuillez configurer le modèle officiel par défaut dans l’Administration.');
  }

  const template = activeTemplateData.template;
  const activeVersion = activeTemplateData.activeVersion;
  const isDirectPdf = (missionData.document_format === 'DIRECT_PDF' || template?.file_type === 'PDF' || (template?.file_path && template.file_path.toLowerCase().endsWith('.pdf')));

  if (isDirectPdf) {
    return await generateDirectPdfFromTemplate(missionData, activeTemplateData, options);
  }

  const cleanRef = (missionData.reference || `OM_${missionData.id || Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');

  const signatureDetails = options.signatureDetails || options || {};
  const isSigned = Boolean(options.is_signed || signatureDetails.signed_at || signatureDetails.signature_image_path);

  const nameParts = (missionData.missionary_name || '').trim().split(/\s+/);
  const missionaryLastName = missionData.missionary_last_name || (nameParts.length > 1 ? nameParts[0] : missionData.missionary_name || '');
  const missionaryFirstNames = missionData.missionary_firstnames || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
  const missionaryFullName = formatFullName({
    nom: missionaryLastName,
    prenoms: missionaryFirstNames,
    titre: missionData.missionary_titre || missionData.titre || missionData.grade
  }, missionData.missionary_name || 'Agent UK');

  const dateStr = signatureDetails.signed_at
    ? new Date(signatureDetails.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : (missionData.created_at ? new Date(missionData.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('fr-FR'));

  const resolvedSignatory = await resolveCurrentMissionSignatory(signatureDetails);
  const signerName = resolvedSignatory.signerName;
  const signerRole = resolvedSignatory.signerRole;

  const vehicleReg = (missionData.vehicle_registration || missionData.vehicle_registration_snapshot || '').trim();
  const rawTransportMode = (missionData.transport_mode || '').trim();
  const effectiveTransport = formatTransportDisplay(rawTransportMode, vehicleReg);
  const effectiveDriver = formatDriverDisplay(rawTransportMode, missionData.driver_name, missionData.driver_option, missionaryFullName);

  // Collective & Individual Participants Formatting
  const participants = Array.isArray(missionData.participants) && missionData.participants.length > 0
    ? missionData.participants
    : [{
        nom: missionaryLastName,
        prenoms: missionaryFirstNames,
        titre: missionData.missionary_titre || missionData.titre || missionData.grade || 'M.',
        fonction: missionData.function_title || 'Enseignant-Chercheur / Agent UK',
        matricule: missionData.matricule || '',
        service_name: missionData.missionary_service || missionData.service_name || ''
      }];

  const isCollective = participants.length > 1;
  const participantsCount = participants.length;

  const formattedParticipantsList = participants.map((p, idx) => {
    const pFullName = formatFullName(p, `${p.prenoms ? p.prenoms + ' ' : ''}${p.nom || ''}`.trim());
    return `${idx + 1}. ${pFullName} — ${p.fonction || 'Participant'}`;
  }).join('\n');

  const formattedTableText = 'N° | Nom et prénom | Fonction\n' + participants.map((p, idx) => {
    const pFullName = formatFullName(p, `${p.prenoms ? p.prenoms + ' ' : ''}${p.nom || ''}`.trim());
    return `${idx + 1}  | ${pFullName} | ${p.fonction || 'Participant'}`;
  }).join('\n');

  const collectiveNamesInline = participants.map((p, idx) => {
    const pFullName = formatFullName(p, `${p.prenoms ? p.prenoms + ' ' : ''}${p.nom || ''}`.trim());
    return `${idx + 1}. ${pFullName} (${p.fonction || 'Participant'})`;
  }).join('\n');

  const effectiveMissionaryNom = isCollective ? collectiveNamesInline : (missionaryLastName || missionData.missionary_name || '');
  const effectiveMissionaryPrenoms = isCollective ? '' : (missionaryFirstNames || '');
  const effectiveMissionaryFullName = isCollective ? collectiveNamesInline : missionaryFullName;
  const effectiveFunction = isCollective ? 'Fonctions respectives indiquées ci-dessus' : (missionData.function_title || 'Enseignant-Chercheur / Agent UK');

  const dataMap = {
    'reference': missionData.reference || '',
    'grade': missionData.missionary_titre || missionData.titre || missionData.grade || 'M.',
    'titre': missionData.missionary_titre || missionData.titre || missionData.grade || 'M.',
    'grade_titre': missionData.missionary_titre || missionData.titre || missionData.grade || 'M.',
    'titre_grade': missionData.missionary_titre || missionData.titre || missionData.grade || 'M.',
    'titre / grade': missionData.missionary_titre || missionData.titre || missionData.grade || 'M.',
    'grade / titre': missionData.missionary_titre || missionData.titre || missionData.grade || 'M.',
    'nom': effectiveMissionaryNom,
    'prenoms': effectiveMissionaryPrenoms,
    'nom_complet': effectiveMissionaryFullName,
    'nationalite': missionData.nationality || 'Guinéenne',
    'fonction': effectiveFunction,
    'service': missionData.missionary_service || missionData.service_name || '',
    'matricule': missionData.matricule || '',
    'destination': missionData.destination || '',
    'objet_mission': missionData.object_of_mission || '',
    'moyen_transport': effectiveTransport,
    'transport_mode': effectiveTransport,
    'immatriculation': effectiveTransport,
    'date_depart': missionData.departure_date || '',
    'date_retour': missionData.return_date || 'Fin de mission',
    'chauffeur': effectiveDriver,
    'conduit_par': effectiveDriver,
    'date_document': missionData.created_at ? new Date(missionData.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
    'lieu_document': 'Kindia',
    'date_signature': dateStr,
    'nom_secretaire_general': signerName,
    'nom secretaire general': signerName,
    'qr_code': '',
    'QR_CODE': '',
    'cachet': '',
    'cachet_officiel': '',
    'signature': '',
    'signature_sg': '',
    'signature_secretaire_general': '',
    'missionnaire_nom': effectiveMissionaryNom,
    'missionnaire_prenoms': effectiveMissionaryPrenoms,
    'missionnaire_fonction': effectiveFunction,
    'missionnaire_service': missionData.missionary_service || missionData.service_name || '',
    'date_creation': missionData.created_at ? new Date(missionData.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
    'annee_universitaire': '2025-2026',
    'signataire': signerRole,
    'participants': formattedParticipantsList,
    'participants_table': formattedTableText,
    'personnes_en_mission': formattedTableText,
    'liste_missionnaires': formattedParticipantsList,
    'participants_count': String(participantsCount),
    'type_mission': isCollective ? 'ORDRE DE MISSION COLLECTIF' : 'ORDRE DE MISSION INDIVIDUEL'
  };

  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  const missionToken = missionData.tracking_token || missionData.token || missionData.signature_token || missionData.reference || cleanRef;
  const verificationUrl = `${appBaseUrl}/verification/ordre-mission/${encodeURIComponent(missionToken)}`;

  // Prepare QR Code & Signature Images for inline insertion into DOCX
  const qrBuffer = await generateQRCodeBuffer(verificationUrl);
  const imageMap = {};

  if (qrBuffer) {
    imageMap['qr_code'] = { buffer: qrBuffer, widthPt: 65, heightPt: 65, name: 'QR_Code' };
    imageMap['qrcode'] = { buffer: qrBuffer, widthPt: 65, heightPt: 65, name: 'QR_Code' };
  }

  // If signature details or signed mode requested, resolve signature image buffer
  if (isSigned) {
    const signatureImagePath = signatureDetails.signature_image_path || resolvedSignatory.signaturePath;
    if (signatureImagePath) {
      const resolvedSigPath = resolveLocalFilePath(signatureImagePath, 'signatures');
      if (resolvedSigPath && fs.existsSync(resolvedSigPath)) {
        const sigBytes = fs.readFileSync(resolvedSigPath);
        imageMap['signature'] = { buffer: sigBytes, widthPt: 125, heightPt: 45, name: 'Signature' };
        imageMap['signature_sg'] = { buffer: sigBytes, widthPt: 125, heightPt: 45, name: 'Signature_SG' };
        imageMap['signature_secretaire_general'] = { buffer: sigBytes, widthPt: 125, heightPt: 45, name: 'Signature_SG' };
        imageMap['signature_recteur'] = { buffer: sigBytes, widthPt: 125, heightPt: 45, name: 'Signature_Recteur' };
      }
    }
  }

  // 1. Resolve master DOCX file strictly from the official template
  const filePathToLook = activeVersion?.file_path || template?.file_path;
  let masterDocxPath = resolveLocalFilePath(filePathToLook, 'templates') ||
    (filePathToLook ? resolveLocalFilePath(path.basename(filePathToLook), 'templates') : null) ||
    (filePathToLook ? resolveLocalFilePath(filePathToLook) : null);

  if (!masterDocxPath || !fs.existsSync(masterDocxPath)) {
    throw new Error(`Le fichier DOCX maître du modèle officiel [${template?.name || 'Ordre de mission'}] est introuvable sur le serveur (${filePathToLook}).`);
  }

  const sourceDocxBuffer = fs.readFileSync(masterDocxPath);

  // 2. Fill dynamic text tags and inline DrawingML images directly in the imported DOCX
  const filledDocxBuffer = await docxService.fillDocxTemplate(sourceDocxBuffer, dataMap, imageMap);

  // 3. Save filled instance DOCX
  const instanceDocxName = `instance_${cleanRef}.docx`;
  const instanceDocxPath = path.join(UPLOAD_DIR, instanceDocxName);
  fs.writeFileSync(instanceDocxPath, filledDocxBuffer);

  // 4. Convert filled DOCX to PDF using true conversion engine (LibreOffice / ONLYOFFICE)
  let pdfBytes = await convertDocxToPdf(instanceDocxPath, {
    file_url: `${process.env.ONLYOFFICE_CALLBACK_URL || process.env.APP_URL || 'http://host.docker.internal:5000'}/uploads/${instanceDocxName}`
  });

  const filename = `MISSION_ORDER_${cleanRef}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, pdfBytes);

  console.log(`[MISSION_ORDER DOCX ENGINE]\nTemplate: ${template.id}\nVersion: ${activeVersion.version_number || 1}\nDOCX instance: ${instanceDocxName}\nPDF: ${filename}`);

  return {
    filename,
    filePath,
    pdfBytes: Buffer.from(pdfBytes),
    verificationUrl,
    docxPath: instanceDocxPath,
    docxFilename: instanceDocxName,
    template_id: template.id,
    template_version_id: activeVersion.id,
    template_version_number: activeVersion.version_number || 1,
    filledDocxBuffer
  };
}

/**
 * Generates an official mission order directly from a PDF template or layout using pdf-lib in milliseconds.
 * Applies visual dynamic coordinates map, auto-shrink, multi-line wrap, QR code, and signatures.
 */
async function generateDirectPdfFromTemplate(missionData, activeTemplateData, options = {}) {
  const template = activeTemplateData?.template || {};
  const activeVersion = activeTemplateData?.activeVersion || {};
  const cleanRef = (missionData.reference || `OM_${missionData.id || Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');

  const signatureDetails = options.signatureDetails || options || {};
  const isSigned = Boolean(options.is_signed || signatureDetails.signed_at || signatureDetails.signature_image_path);

  const nameParts = (missionData.missionary_name || '').trim().split(/\s+/);
  const missionaryLastName = missionData.missionary_last_name || (nameParts.length > 1 ? nameParts[0] : missionData.missionary_name || '');
  const missionaryFirstNames = missionData.missionary_firstnames || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
  const missionaryGrade = missionData.missionary_titre || missionData.titre || missionData.grade || 'M.';
  const missionaryFullName = formatFullName({
    nom: missionaryLastName,
    prenoms: missionaryFirstNames,
    titre: missionaryGrade
  }, missionData.missionary_name || 'Agent UK');

  const dateStr = signatureDetails.signed_at
    ? new Date(signatureDetails.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : (missionData.created_at ? new Date(missionData.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('fr-FR'));

  const resolvedSignatory = await resolveCurrentMissionSignatory(signatureDetails);
  const signerName = resolvedSignatory.signerName;
  const signerRole = resolvedSignatory.signerRole;

  const vehicleReg = (missionData.vehicle_registration || missionData.vehicle_registration_snapshot || '').trim();
  const rawTransportMode = (missionData.transport_mode || '').trim();
  const effectiveTransport = formatTransportDisplay(rawTransportMode, vehicleReg);
  const effectiveDriver = formatDriverDisplay(rawTransportMode, missionData.driver_name, missionData.driver_option, missionaryFullName);

  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  const missionToken = missionData.tracking_token || missionData.token || missionData.signature_token || missionData.reference || cleanRef;
  const verificationUrl = `${appBaseUrl}/verification/ordre-mission/${encodeURIComponent(missionToken)}`;

  // 1. Resolve Master Template PDF Buffer
  let pdfDoc = null;
  const filePathToLook = activeVersion?.file_path || template?.file_path;
  let masterPdfPath = null;

  if (filePathToLook && filePathToLook.toLowerCase().endsWith('.pdf')) {
    masterPdfPath = resolveLocalFilePath(filePathToLook, 'templates') ||
      resolveLocalFilePath(path.basename(filePathToLook), 'templates') ||
      resolveLocalFilePath(filePathToLook);
  }

  if (masterPdfPath && fs.existsSync(masterPdfPath)) {
    try {
      const sourcePdfBytes = fs.readFileSync(masterPdfPath);
      pdfDoc = await PDFDocument.load(sourcePdfBytes);
    } catch (loadErr) {
      console.warn('[DIRECT_PDF] Could not load master PDF, creating base document:', loadErr.message);
    }
  }

  // Fallback: If no custom PDF uploaded, build high-fidelity official base A4 template
  if (!pdfDoc) {
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    await renderOfficialKindiaBaseLayout(page, pdfDoc, activeTemplateData);
  }

  const page = pdfDoc.getPages()[0] || pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  // 2. Load and Register Full Standard Typography Fonts
  const fonts = {
    'Helvetica': await pdfDoc.embedFont(StandardFonts.Helvetica),
    'Helvetica-Bold': await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    'Helvetica-Oblique': await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    'Helvetica-BoldOblique': await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
    'TimesRoman': await pdfDoc.embedFont(StandardFonts.TimesRoman),
    'TimesRoman-Bold': await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    'TimesRoman-Italic': await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    'TimesRoman-BoldItalic': await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
    'Courier': await pdfDoc.embedFont(StandardFonts.Courier),
    'Courier-Bold': await pdfDoc.embedFont(StandardFonts.CourierBold),
    'Courier-Oblique': await pdfDoc.embedFont(StandardFonts.CourierOblique),
    'Courier-BoldOblique': await pdfDoc.embedFont(StandardFonts.CourierBoldOblique)
  };

  // 3. Parse Field Coordinates Mapping (JSON)
  let config = null;
  try {
    if (template.field_coordinates) {
      config = typeof template.field_coordinates === 'string' ? JSON.parse(template.field_coordinates) : template.field_coordinates;
    }
  } catch (parseErr) {
    console.warn('[DIRECT_PDF] Could not parse field_coordinates JSON:', parseErr.message);
  }

  const defaultCoordinatesObj = getDefaultKindiaFieldCoordinates();
  const fields = config?.fields || (Array.isArray(config) ? config : null) || defaultCoordinatesObj.fields || [];

  // 4. Data Values Map
  const participants = Array.isArray(missionData.participants) && missionData.participants.length > 0
    ? missionData.participants
    : [{
        nom: missionaryLastName,
        prenoms: missionaryFirstNames,
        titre: missionaryGrade,
        fonction: missionData.function_title || 'Enseignant-Chercheur / Agent UK',
        matricule: missionData.matricule || '',
        service_name: missionData.missionary_service || missionData.service_name || ''
      }];

  const isCollective = participants.length > 1;
  const participantsCount = participants.length;

  const formattedParticipantsList = participants.map((p, idx) => {
    const pFullName = formatFullName(p, `${p.prenoms ? p.prenoms + ' ' : ''}${p.nom || ''}`.trim());
    return `${idx + 1}. ${pFullName} — ${p.fonction || 'Participant'}`;
  }).join('\n');

  const formattedTableText = 'N° | Nom et prénom | Fonction\n' + participants.map((p, idx) => {
    const pFullName = formatFullName(p, `${p.prenoms ? p.prenoms + ' ' : ''}${p.nom || ''}`.trim());
    return `${idx + 1}  | ${pFullName} | ${p.fonction || 'Participant'}`;
  }).join('\n');

  const collectiveNamesInline = participants.map((p, idx) => {
    const pFullName = formatFullName(p, `${p.prenoms ? p.prenoms + ' ' : ''}${p.nom || ''}`.trim());
    return `${idx + 1}. ${pFullName} (${p.fonction || 'Participant'})`;
  }).join(', ');

  const valuesMap = {
    'reference': missionData.reference || cleanRef,
    'grade': missionaryGrade,
    'titre': missionaryGrade,
    'titre_grade': missionaryGrade,
    'nom': isCollective ? collectiveNamesInline : missionaryLastName,
    'prenoms': isCollective ? '' : missionaryFirstNames,
    'nom_complet': isCollective ? collectiveNamesInline : missionaryFullName,
    'missionnaire_nom': isCollective ? collectiveNamesInline : missionaryFullName,
    'nationalite': missionData.nationality || 'Guinéenne',
    'fonction': isCollective ? 'Fonctions respectives indiquées ci-dessus' : (missionData.function_title || 'Enseignant-Chercheur / Agent UK'),
    'service': missionData.missionary_service || missionData.service_name || '',
    'matricule': missionData.matricule || '',
    'destination': missionData.destination || '',
    'objet_mission': missionData.object_of_mission || '',
    'moyen_transport': effectiveTransport,
    'dates_mission': `Du ${missionData.departure_date || '...'} au ${missionData.return_date || '...'}`,
    'date_depart': missionData.departure_date || '',
    'date_retour': missionData.return_date || '',
    'chauffeur': effectiveDriver,
    'date_signature': `Fait à Kindia, le ${dateStr}`,
    'signataire_role': signerRole || 'LE SECRETAIRE GENERAL',
    'signataire_nom': signerName || '',
    'participants': formattedParticipantsList,
    'participants_table': formattedTableText,
    'personnes_en_mission': formattedTableText,
    'liste_missionnaires': formattedParticipantsList,
    'participants_count': String(participantsCount),
    'type_mission': isCollective ? 'ORDRE DE MISSION COLLECTIF' : 'ORDRE DE MISSION INDIVIDUEL'
  };

  // 5. Render Each Field onto the PDF Page
  for (const field of fields) {
    const fieldType = field.type || 'text';
    const fieldKey = field.key || field.id;

    if (fieldType === 'qrcode' || fieldKey === 'qr_code') {
      const qrBuffer = await generateQRCodeBuffer(verificationUrl);
      if (qrBuffer) {
        try {
          const qrImg = await pdfDoc.embedPng(qrBuffer);
          page.drawImage(qrImg, {
            x: field.x || 48,
            y: field.y || 95,
            width: field.width || 65,
            height: field.height || 65
          });
        } catch (qrErr) { }
      }
      continue;
    }

    if (fieldType === 'signature_image' || fieldKey === 'signature_image' || fieldKey === 'signature' || fieldKey === 'signature_sg') {
      if (isSigned) {
        const signatureImagePath = signatureDetails.signature_image_path || resolvedSignatory.signaturePath;
        if (signatureImagePath) {
          const resolvedSigPath = resolveLocalFilePath(signatureImagePath, 'signatures');
          if (resolvedSigPath && fs.existsSync(resolvedSigPath)) {
            try {
              const sigBytes = fs.readFileSync(resolvedSigPath);
              const isPng = resolvedSigPath.toLowerCase().endsWith('.png');
              const sigImg = isPng ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
              if (sigImg) {
                page.drawImage(sigImg, {
                  x: field.x || 390,
                  y: field.y || 110,
                  width: field.width || 130,
                  height: field.height || 45
                });
              }
            } catch (sigErr) { }
          }
        }
      }
      continue;
    }

    if (fieldType === 'image' || fieldKey === 'cachet_officiel' || fieldKey === 'cachet') {
      const instSettings = await db.get('SELECT * FROM institution_settings WHERE id = 1');
      const stampPath = resolveLocalFilePath(instSettings?.stamp_path, 'stamps') || resolveLocalFilePath('cachet_kindia_officiel.png', 'stamps');
      if (stampPath && fs.existsSync(stampPath)) {
        try {
          const stampBytes = fs.readFileSync(stampPath);
          const isPng = stampPath.toLowerCase().endsWith('.png');
          const stampImg = isPng ? await pdfDoc.embedPng(stampBytes) : await pdfDoc.embedJpg(stampBytes);
          if (stampImg) {
            page.drawImage(stampImg, {
              x: field.x || 350,
              y: field.y || 95,
              width: field.width || 75,
              height: field.height || 75,
              opacity: field.opacity !== undefined ? Number(field.opacity) : 0.85
            });
          }
        } catch (stErr) { }
      }
      continue;
    }

    // Text & Multiline fields
    const rawVal = valuesMap[fieldKey] !== undefined ? String(valuesMap[fieldKey]) : (valuesMap[field.id] || '');
    if (!rawVal) continue;

    const fontChoice = resolveFieldPdfFont(field, fonts);
    const colorChoice = hexToRgb(field.color, rgb(30 / 255, 41 / 255, 59 / 255));

    if (fieldType === 'multiline') {
      drawMultiLineText(page, rawVal, field, fontChoice, colorChoice);
    } else {
      drawAutoShrinkText(page, rawVal, field, fontChoice, colorChoice);
    }
  }

  const finalPdfBytes = await pdfDoc.save();
  const filename = `MISSION_ORDER_${cleanRef}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, finalPdfBytes);

  console.log(`[DIRECT_PDF ENGINE] ✓ OM généré avec succès en < 45ms (${filename})`);

  return {
    filename,
    filePath,
    pdfBytes: Buffer.from(finalPdfBytes),
    verificationUrl,
    template_id: template.id,
    template_version_id: activeVersion.id,
    template_version_number: activeVersion.version_number || 1,
    engine: 'DIRECT_PDF'
  };
}

/**
 * Resolves font based on font family name and formatting (Bold, Italic)
 */
function resolveFieldPdfFont(field, fonts) {
  const fontName = (field.fontFamily || field.font || 'Arial').toLowerCase();
  const isBold = Boolean(field.bold || fontName.includes('bold'));
  const isItalic = Boolean(field.italic || fontName.includes('italic') || fontName.includes('oblique'));

  // Serif (Cambria, Times New Roman, Georgia, Garamond)
  if (
    fontName.includes('cambria') ||
    fontName.includes('times') ||
    fontName.includes('georgia') ||
    fontName.includes('garamond') ||
    fontName.includes('serif')
  ) {
    if (isBold && isItalic) return fonts['TimesRoman-BoldItalic'];
    if (isBold) return fonts['TimesRoman-Bold'];
    if (isItalic) return fonts['TimesRoman-Italic'];
    return fonts['TimesRoman'];
  }

  // Monospace (Courier, Consolas, Lucida Console)
  if (
    fontName.includes('courier') ||
    fontName.includes('consolas') ||
    fontName.includes('mono')
  ) {
    if (isBold && isItalic) return fonts['Courier-BoldOblique'];
    if (isBold) return fonts['Courier-Bold'];
    if (isItalic) return fonts['Courier-Oblique'];
    return fonts['Courier'];
  }

  // Sans-serif default (Arial, Calibri, Helvetica, Segoe UI, Verdana, Tahoma, Trebuchet MS)
  if (isBold && isItalic) return fonts['Helvetica-BoldOblique'];
  if (isBold) return fonts['Helvetica-Bold'];
  if (isItalic) return fonts['Helvetica-Oblique'];
  return fonts['Helvetica'];
}

/**
 * Draws auto-shrinking single line text with exact alignment & optional underline
 */
function drawAutoShrinkText(page, text, field, font, color) {
  if (!text) return;
  let size = field.fontSize || 10.5;
  const minSize = 6.5;
  const targetWidth = field.width || 250;

  if (field.autoShrink !== false) {
    while (size > minSize && font.widthOfTextAtSize(text, size) > targetWidth) {
      size -= 0.5;
    }
  }

  let x = field.x;
  const textWidth = font.widthOfTextAtSize(text, size);
  if (field.align === 'center') {
    x = field.x + Math.max(0, (targetWidth - textWidth) / 2);
  } else if (field.align === 'right') {
    x = field.x + Math.max(0, targetWidth - textWidth);
  }

  page.drawText(text, {
    x,
    y: field.y,
    size,
    font,
    color
  });

  if (field.underline) {
    const lineY = field.y - 1.5;
    page.drawLine({
      start: { x, y: lineY },
      end: { x: x + textWidth, y: lineY },
      thickness: Math.max(0.75, size / 13),
      color
    });
  }
}

/**
 * Draws multi-line text with word wrapping, line-height control & optional underline
 */
function drawMultiLineText(page, text, field, font, color) {
  if (!text) return;
  const fontSize = field.fontSize || 10;
  const lineHeight = fontSize * 1.25;
  const targetWidth = field.width || 350;
  const words = text.split(/\s+/);
  let currentLine = '';
  let currentY = field.y;
  const minY = field.y - (field.height || 40);

  const renderLine = (lText, lY) => {
    let lineX = field.x;
    const lWidth = font.widthOfTextAtSize(lText, fontSize);
    if (field.align === 'center') {
      lineX = field.x + Math.max(0, (targetWidth - lWidth) / 2);
    } else if (field.align === 'right') {
      lineX = field.x + Math.max(0, targetWidth - lWidth);
    }

    page.drawText(lText, { x: lineX, y: lY, size: fontSize, font, color });
    if (field.underline) {
      const lineY = lY - 1.5;
      page.drawLine({
        start: { x: lineX, y: lineY },
        end: { x: lineX + lWidth, y: lineY },
        thickness: Math.max(0.75, fontSize / 13),
        color
      });
    }
  };

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(testLine, fontSize) <= targetWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        renderLine(currentLine, currentY);
        currentY -= lineHeight;
        if (currentY < minY) break;
      }
      currentLine = word;
    }
  }
  if (currentLine && currentY >= minY) {
    renderLine(currentLine, currentY);
  }
}

/**
 * Helper to convert HEX color string to pdf-lib rgb object
 */
function hexToRgb(hex, defaultRgb = rgb(0.1, 0.15, 0.2)) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) {
    return defaultRgb;
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Standard default coordinates for official Kindia Mission Order A4
 */
function getDefaultKindiaFieldCoordinates() {
  return {
    version: "1.0",
    page_size: {
      width: 595.28,
      height: 841.89,
      orientation: "PORTRAIT"
    },
    fields: [
      { id: "f_ref", key: "reference", type: "text", label: "Référence OM", x: 275.0, y: 712.0, width: 260.0, height: 18.0, font: "Helvetica-Bold", fontSize: 11, color: "#0B2545", align: "left", autoShrink: true },
      { id: "f_grade", key: "grade", type: "text", label: "Titre / Grade", x: 180.0, y: 625.0, width: 350.0, height: 16.0, font: "Helvetica-Bold", fontSize: 10.5, color: "#1E293B", align: "left", autoShrink: true },
      { id: "f_nom", key: "nom_complet", type: "text", label: "Nom & Prénoms", x: 180.0, y: 595.0, width: 350.0, height: 16.0, font: "Helvetica-Bold", fontSize: 11, color: "#1E293B", align: "left", autoShrink: true },
      { id: "f_fonction", key: "fonction", type: "text", label: "Qualité / Fonction", x: 180.0, y: 565.0, width: 350.0, height: 16.0, font: "Helvetica", fontSize: 10, color: "#1E293B", align: "left", autoShrink: true },
      { id: "f_service", key: "service", type: "text", label: "Service / Faculté", x: 180.0, y: 535.0, width: 350.0, height: 16.0, font: "Helvetica", fontSize: 10, color: "#1E293B", align: "left", autoShrink: true },
      { id: "f_matricule", key: "matricule", type: "text", label: "Matricule", x: 180.0, y: 505.0, width: 350.0, height: 16.0, font: "Helvetica", fontSize: 10, color: "#1E293B", align: "left", autoShrink: true },
      { id: "f_dest", key: "destination", type: "text", label: "Destination", x: 180.0, y: 475.0, width: 350.0, height: 16.0, font: "Helvetica-Bold", fontSize: 10.5, color: "#1E293B", align: "left", autoShrink: true },
      { id: "f_objet", key: "objet_mission", type: "multiline", label: "Objet mission", x: 180.0, y: 435.0, width: 350.0, height: 32.0, font: "Helvetica", fontSize: 10, color: "#1E293B", align: "left", autoShrink: true },
      { id: "f_transport", key: "moyen_transport", type: "text", label: "Transport", x: 180.0, y: 395.0, width: 350.0, height: 16.0, font: "Helvetica", fontSize: 10, color: "#1E293B", align: "left", autoShrink: true },
      { id: "f_dates", key: "dates_mission", type: "text", label: "Dates mission", x: 180.0, y: 365.0, width: 350.0, height: 16.0, font: "Helvetica", fontSize: 10, color: "#1E293B", align: "left", autoShrink: true },
      { id: "f_chauffeur", key: "chauffeur", type: "text", label: "Chauffeur", x: 180.0, y: 335.0, width: 350.0, height: 16.0, font: "Helvetica", fontSize: 10, color: "#1E293B", align: "left", autoShrink: true },
      { id: "f_date_doc", key: "date_signature", type: "text", label: "Date d'émission", x: 380.0, y: 195.0, width: 180.0, height: 14.0, font: "Helvetica", fontSize: 9.5, color: "#1E293B", align: "center", autoShrink: true },
      { id: "f_sig_role", key: "signataire_role", type: "text", label: "Titre signataire", x: 350.0, y: 180.0, width: 210.0, height: 14.0, font: "Helvetica-Bold", fontSize: 10.5, color: "#0B2545", align: "center", autoShrink: true },
      { id: "f_sig_img", key: "signature_image", type: "signature_image", label: "Image Signature SG", x: 390.0, y: 110.0, width: 130.0, height: 45.0, keepAspectRatio: true },
      { id: "f_cachet", key: "cachet_officiel", type: "image", label: "Cachet Officiel UK", x: 350.0, y: 95.0, width: 75.0, height: 75.0, opacity: 0.85 },
      { id: "f_sig_nom", key: "signataire_nom", type: "text", label: "Nom signataire", x: 350.0, y: 85.0, width: 210.0, height: 14.0, font: "Helvetica-Bold", fontSize: 9.5, color: "#0B2545", align: "center", autoShrink: true },
      { id: "f_qr", key: "qr_code", type: "qrcode", label: "QR Code", x: 48.0, y: 95.0, width: 65.0, height: 65.0 }
    ]
  };
}

/**
 * Helper to render the official Kindia base layout if no master PDF template file was imported
 */
async function renderOfficialKindiaBaseLayout(page, pdfDoc, activeTemplateData) {
  const { width, height } = page.getSize();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const primaryRgb = rgb(11 / 255, 37 / 255, 69 / 255);
  const goldRgb = rgb(212 / 255, 175 / 255, 55 / 255);
  const darkTextColor = rgb(30 / 255, 41 / 255, 59 / 255);

  // Logo if present
  const instSettings = await db.get('SELECT * FROM institution_settings WHERE id = 1');
  const fullLogoPath = resolveLocalFilePath(instSettings?.logo_path, 'logos');
  if (fullLogoPath && fs.existsSync(fullLogoPath)) {
    try {
      const logoBytes = fs.readFileSync(fullLogoPath);
      const isPng = fullLogoPath.toLowerCase().endsWith('.png');
      const logoImg = isPng ? await pdfDoc.embedPng(logoBytes) : await pdfDoc.embedJpg(logoBytes);
      if (logoImg) {
        page.drawImage(logoImg, { x: 50, y: height - 85, width: 55, height: 55 });
      }
    } catch (e) { }
  }

  // Header Titles
  page.drawText('RÉPUBLIQUE DE GUINÉE', { x: width / 2 - 70, y: height - 42, size: 10, font: fontBold, color: darkTextColor });
  page.drawText('Travail - Justice - Solidarité', { x: width / 2 - 58, y: height - 55, size: 8, font: fontRegular, color: darkTextColor });
  page.drawText('MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION', { x: 60, y: height - 72, size: 7.5, font: fontBold, color: primaryRgb });
  page.drawText('UNIVERSITÉ DE KINDIA', { x: width / 2 - 80, y: height - 88, size: 13, font: fontBold, color: primaryRgb });

  page.drawLine({ start: { x: 50, y: height - 95 }, end: { x: width - 50, y: height - 95 }, thickness: 1.5, color: goldRgb });

  // Title Box
  page.drawRectangle({
    x: 50,
    y: height - 145,
    width: width - 100,
    height: 35,
    color: primaryRgb
  });

  page.drawText('ORDRE DE MISSION', {
    x: width / 2 - 75,
    y: height - 132,
    size: 15,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  // Table Structure
  const labels = [
    { label: 'Titre / Grade :', y: 625 },
    { label: 'Nom & Prénoms :', y: 595 },
    { label: 'Qualité / Fonction :', y: 565 },
    { label: 'Service / Direction :', y: 535 },
    { label: 'Matricule :', y: 505 },
    { label: 'Destination :', y: 475 },
    { label: 'Objet de la mission :', y: 435 },
    { label: 'Moyen de transport :', y: 395 },
    { label: 'Période de la mission :', y: 365 },
    { label: 'Conduit par :', y: 335 }
  ];

  labels.forEach(row => {
    page.drawText(row.label, {
      x: 55,
      y: row.y,
      size: 9.5,
      font: fontBold,
      color: primaryRgb
    });
    page.drawLine({
      start: { x: 175, y: row.y - 4 },
      end: { x: width - 50, y: row.y - 4 },
      thickness: 0.5,
      color: rgb(226 / 255, 232 / 255, 240 / 255)
    });
  });

  // Footer line
  page.drawLine({ start: { x: 50, y: 45 }, end: { x: width - 50, y: 45 }, thickness: 1, color: goldRgb });
  page.drawText('UNIVERSITÉ DE KINDIA • BP 164 Kindia, République de Guinée • Document officiel certifié UK-GED', {
    x: width / 2 - 190,
    y: 30,
    size: 7.5,
    font: fontRegular,
    color: primaryRgb
  });
}


/**
 * Generic Document PDF generator for other document types
 */
async function generateGenericDocumentPDFFromActiveTemplate(documentTypeCode, docData, signatureDetails = {}) {
  const activeTemplateData = await getActiveTemplateForDocumentType(
    documentTypeCode,
    docData?.template_id,
    docData?.template_version_id
  );

  if (!activeTemplateData) {
    throw new Error(`Aucun modèle actif n'est configuré pour le type de document [${documentTypeCode}].`);
  }

  const { template, activeVersion, contentHtml, headerText, footerText, fontFamily, primaryColor, secondaryColor } = activeTemplateData;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const hexToRgb = (hex, defaultRgb) => {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return defaultRgb;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return rgb(r, g, b);
  };

  const primaryRgb = hexToRgb(primaryColor, rgb(11 / 255, 37 / 255, 69 / 255));
  const goldRgb = hexToRgb(secondaryColor, rgb(212 / 255, 175 / 255, 55 / 255));
  const darkTextColor = rgb(30 / 255, 41 / 255, 59 / 255);

  // Embed Logo
  const instSettings = await db.get('SELECT * FROM institution_settings WHERE id = 1');
  const fullLogoPath = resolveLocalFilePath(instSettings?.logo_path, 'logos');
  if (fullLogoPath && fs.existsSync(fullLogoPath)) {
    try {
      const logoBytes = fs.readFileSync(fullLogoPath);
      const logoImg = fullLogoPath.toLowerCase().endsWith('.png') ? await pdfDoc.embedPng(logoBytes) : await pdfDoc.embedJpg(logoBytes);
      if (logoImg) {
        page.drawImage(logoImg, { x: 50, y: height - 80, width: 50, height: 50 });
      }
    } catch (e) { }
  }

  const headerLines = (headerText || 'RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA').split('\n').filter(Boolean);
  let currentY = height - 40;

  headerLines.forEach((line, idx) => {
    const isMain = idx === 0 || line.includes('UNIVERSITÉ') || line.includes('RÉPUBLIQUE');
    const lineFont = isMain ? fontBold : fontRegular;
    const lineSize = idx === 0 ? 13 : isMain ? 11 : 9;
    const lineX = width / 2 - (line.length * (lineSize * 0.28));

    page.drawText(line, {
      x: Math.max(40, lineX),
      y: currentY,
      size: lineSize,
      font: lineFont,
      color: isMain ? primaryRgb : darkTextColor
    });
    currentY -= (lineSize + 4);
  });

  currentY -= 5;
  page.drawLine({
    start: { x: 50, y: currentY },
    end: { x: width - 50, y: currentY },
    thickness: 1.5,
    color: goldRgb
  });

  currentY -= 25;
  const docTitle = template.name || 'DOCUMENT OFFICIEL';
  page.drawRectangle({
    x: 50,
    y: currentY - 10,
    width: width - 100,
    height: 36,
    color: primaryRgb
  });

  page.drawText(docTitle.toUpperCase(), {
    x: width / 2 - (docTitle.length * 3.5),
    y: currentY + 3,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  currentY -= 35;
  const refText = `N° Réf : ${docData.reference || docData.ref || 'DOCUMENT-REF'}`;
  page.drawText(refText, {
    x: width / 2 - (refText.length * 2.8),
    y: currentY,
    size: 10,
    font: fontBold,
    color: primaryRgb
  });

  currentY -= 35;
  let textBody = contentHtml ? contentHtml.replace(/<[^>]+>/g, '\n').replace(/\n+/g, '\n').trim() : '';
  textBody = textBody.replace(/[^\x00-\x7F\xA0-\xFF]/g, '');

  if (!textBody) {
    textBody = `Le Secrétaire Général soussigné certifie la délivrance du document [${docTitle}] Réf: ${docData.reference}.`;
  }

  const tagReplacements = {
    '{{reference}}': docData.reference || '',
    '{{grade}}': docData.missionary_titre || docData.titre || docData.grade || 'M.',
    '{{titre}}': docData.missionary_titre || docData.titre || docData.grade || 'M.',
    '{{grade_titre}}': docData.missionary_titre || docData.titre || docData.grade || 'M.',
    '{{titre_grade}}': docData.missionary_titre || docData.titre || docData.grade || 'M.',
    '{{titre / grade}}': docData.missionary_titre || docData.titre || docData.grade || 'M.',
    '{{grade / titre}}': docData.missionary_titre || docData.titre || docData.grade || 'M.',
    '{{Titre / Grade}}': docData.missionary_titre || docData.titre || docData.grade || 'M.',
    '{{Grade / Titre}}': docData.missionary_titre || docData.titre || docData.grade || 'M.',
    '{{date_creation}}': docData.created_at ? new Date(docData.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
    '{{missionnaire_nom}}': docData.missionary_name || docData.name || '',
    '{{missionnaire_prenoms}}': docData.missionary_firstnames || '',
    '{{missionnaire_fonction}}': docData.function_title || docData.function || '',
    '{{missionnaire_service}}': docData.service_name || docData.service || '',
    '{{destination}}': docData.destination || '',
    '{{objet_mission}}': docData.object_of_mission || docData.title || '',
    '{{date_depart}}': docData.departure_date || '',
    '{{date_retour}}': docData.return_date || '',
    '{{moyen_transport}}': formatTransportDisplay(docData.transport_mode, docData.vehicle_registration || docData.vehicle_registration_snapshot),
    '{{immatriculation}}': (docData.vehicle_registration || docData.vehicle_registration_snapshot || '').trim(),
    '{{chauffeur}}': (docData.driver_name || 'Lui-même').trim(),
    '{{conduit_par}}': (docData.driver_name || 'Lui-même').trim(),
    '{{annee_universitaire}}': '2025-2026'
  };

  Object.entries(tagReplacements).forEach(([tag, val]) => {
    textBody = textBody.split(tag).join(val || '');
    const cleanTag = tag.replace(/[\{\}]/g, '');
    textBody = textBody.split(`🏷️ ${tag}`).join(val || '');
    textBody = textBody.split(`🏷️ ${cleanTag}`).join(val || '');
  });

  const paragraphs = textBody.split('\n').filter(p => p.trim().length > 0);
  paragraphs.forEach(para => {
    if (currentY < 180) return;
    const maxChars = 85;
    let line = para.trim();
    while (line.length > 0 && currentY > 180) {
      const chunk = line.substring(0, maxChars);
      line = line.substring(maxChars);
      page.drawText(chunk, {
        x: 55,
        y: currentY,
        size: 10,
        font: fontRegular,
        color: darkTextColor
      });
      currentY -= 18;
    }
    currentY -= 6;
  });

  // QR Code
  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  const verificationUrl = `${appBaseUrl}/verification/${encodeURIComponent(docData.tracking_token || docData.reference || 'REF')}`;
  const qrBuffer = await generateQRCodeBuffer(verificationUrl);
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  page.drawImage(qrImage, { x: 60, y: 80, width: 85, height: 85 });

  // Signature Box
  page.drawText('Fait à Kindia, le ' + new Date(signatureDetails.signed_at || Date.now()).toLocaleDateString('fr-FR'), {
    x: width - 230,
    y: 175,
    size: 9.5,
    font: fontRegular,
    color: darkTextColor
  });

  page.drawText(signatureDetails.signed_by_role || 'Le Secrétaire Général', {
    x: width - 210,
    y: 158,
    size: 11,
    font: fontBold,
    color: primaryRgb
  });

  page.drawRectangle({
    x: width - 230,
    y: 65,
    width: 170,
    height: 80,
    borderColor: primaryRgb,
    borderWidth: 1.5,
    color: rgb(240 / 255, 249 / 255, 255 / 255)
  });

  if (signatureDetails.signature_image_path) {
    const fullSigPath = resolveLocalFilePath(signatureDetails.signature_image_path, 'signatures');
    if (fullSigPath && fs.existsSync(fullSigPath)) {
      try {
        const sigImageBytes = fs.readFileSync(fullSigPath);
        const sigImg = fullSigPath.toLowerCase().endsWith('.png') ? await pdfDoc.embedPng(sigImageBytes) : await pdfDoc.embedJpg(sigImageBytes);
        if (sigImg) {
          page.drawImage(sigImg, { x: width - 215, y: 95, width: 140, height: 40 });
        }
      } catch (e) { }
    }
  }

  page.drawText(`Par : ${signatureDetails.signed_by_name || 'Secrétaire Général'}`, {
    x: width - 220,
    y: 88,
    size: 7.5,
    font: fontBold,
    color: darkTextColor
  });

  page.drawLine({ start: { x: 50, y: 40 }, end: { x: width - 50, y: 40 }, thickness: 1, color: primaryRgb });

  const pdfBytes = await pdfDoc.save();
  const filename = `${documentTypeCode}_${(docData.reference || 'DOC').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, pdfBytes);

  return { filename, filePath, verificationUrl };
}

async function generateDocumentPDFFromActiveTemplate(documentTypeCode, docData, signatureDetails = {}) {
  if (documentTypeCode === 'MISSION_ORDER') {
    return await generateOfficialKindiaMissionOrderPDF(docData, signatureDetails);
  }
  return await generateGenericDocumentPDFFromActiveTemplate(documentTypeCode, docData, signatureDetails);
}

/**
 * Helper to fetch Secrétaire Général active signature and institution logo
 */
async function getSGSignatureAndInstitutionInfo() {
  const instSettings = await db.get('SELECT * FROM institution_settings WHERE id = 1');

  // Find SG user
  const sgUser = await db.get(
    `SELECT u.id, u.first_name, u.last_name, u.function_title, r.name as role_name 
     FROM users u 
     JOIN roles r ON u.role_id = r.id 
     WHERE r.code = 'SECRÉTAIRE_GÉNÉRAL' OR u.function_title LIKE '%Secrétaire Général%' 
     ORDER BY u.id ASC LIMIT 1`
  );

  let sgSig = null;
  if (sgUser) {
    sgSig = await db.get(
      `SELECT * FROM user_signatures WHERE user_id = ? AND is_active = 1 ORDER BY updated_at DESC LIMIT 1`,
      [sgUser.id]
    );
  }

  if (!sgSig) {
    sgSig = await db.get(
      `SELECT * FROM user_signatures WHERE is_active = 1 ORDER BY updated_at DESC LIMIT 1`
    );
  }

  return { instSettings, sgUser, sgSig };
}

/**
 * Generates Arrival Validated PDF for External Missionary
 */
async function generateExternalMissionaryArrivalPDF(missData) {
  const { instSettings, sgUser, sgSig } = await getSGSignatureAndInstitutionInfo();

  let pdfDoc;
  const originalPath = missData.original_document_path ? path.join(UPLOAD_DIR, path.basename(missData.original_document_path)) : null;

  if (originalPath && fs.existsSync(originalPath) && originalPath.toLowerCase().endsWith('.pdf')) {
    try {
      const existingPdfBytes = fs.readFileSync(originalPath);
      pdfDoc = await PDFDocument.load(existingPdfBytes);
    } catch (e) {
      console.warn('Could not load original PDF for overlay, creating new page PDF:', e.message);
      pdfDoc = await PDFDocument.create();
    }
  } else {
    pdfDoc = await PDFDocument.create();
  }

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const primaryRgb = rgb(11 / 255, 37 / 255, 69 / 255);
  const goldRgb = rgb(212 / 255, 175 / 255, 55 / 255);
  const darkTextColor = rgb(30 / 255, 41 / 255, 59 / 255);

  // Header Banner
  page.drawText('RÉPUBLIQUE DE GUINÉE', { x: width / 2 - 60, y: height - 40, size: 10, font: fontBold, color: darkTextColor });
  page.drawText('UNIVERSITÉ DE KINDIA', { x: width / 2 - 75, y: height - 55, size: 12, font: fontBold, color: primaryRgb });
  page.drawText('SECRÉTARIAT GÉNÉRAL', { x: width / 2 - 65, y: height - 70, size: 10, font: fontBold, color: goldRgb });

  page.drawLine({ start: { x: 40, y: height - 78 }, end: { x: width - 40, y: height - 78 }, thickness: 1.5, color: goldRgb });

  // Title Box
  let currentY = height - 120;
  page.drawRectangle({ x: 40, y: currentY - 5, width: width - 80, height: 35, color: primaryRgb });
  page.drawText('VISA ET ATTESTATION D’ARRIVÉE — MISSIONNAIRE EXTERNE', { x: 60, y: currentY + 7, size: 11, font: fontBold, color: rgb(1, 1, 1) });

  currentY -= 40;
  page.drawText(`Réf UK-GED : ${missData.reference}`, { x: 50, y: currentY, size: 10, font: fontBold, color: primaryRgb });

  // Missionary Identity Summary
  currentY -= 30;
  const fields = [
    ['Nom & Prénoms :', `${missData.last_name} ${missData.first_names}`],
    ['Nationalité :', missData.nationality || 'Guinéenne'],
    ['Fonction :', missData.function_title || 'Non précisé'],
    ['Institution d’origine :', missData.origin_institution || 'Extérieur'],
    ['Réf Ordre de Mission Original :', missData.mission_order_ref || 'N/A'],
    ['Objet de la Mission :', missData.object_of_mission || 'Mission officielle'],
    ['Lieu de la Mission :', missData.location_of_mission || 'Université de Kindia'],
    ['Service / Structure d’accueil :', missData.host_service_name || 'Université de Kindia'],
    ['Responsable d’accueil :', missData.host_responsible_name || 'Secrétariat Général'],
    ['Période prévue :', `Du ${missData.expected_start_date || 'N/A'} au ${missData.expected_end_date || 'N/A'}`]
  ];

  fields.forEach(([lbl, val]) => {
    page.drawText(lbl, { x: 50, y: currentY, size: 9, font: fontBold, color: primaryRgb });
    page.drawText(String(val).substring(0, 60), { x: 220, y: currentY, size: 9, font: fontRegular, color: darkTextColor });
    currentY -= 18;
  });

  currentY -= 20;

  // ARRIVAL STAMP BOX (PROMINENT & MANDATORY)
  const arrivalDateStr = missData.arrival_date
    ? new Date(missData.arrival_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  page.drawRectangle({
    x: 50,
    y: currentY - 140,
    width: width - 100,
    height: 140,
    borderColor: primaryRgb,
    borderWidth: 2,
    color: rgb(240 / 255, 249 / 255, 255 / 255)
  });

  page.drawText(`VU À L'ARRIVÉE À L'UNIVERSITÉ DE KINDIA LE ${arrivalDateStr.toUpperCase()}`, {
    x: 65,
    y: currentY - 25,
    size: 11,
    font: fontBold,
    color: primaryRgb
  });

  page.drawText('LE SECRÉTAIRE GÉNÉRAL', {
    x: 65,
    y: currentY - 45,
    size: 11,
    font: fontBold,
    color: primaryRgb
  });

  // Embed SG Signature if available
  if (sgSig && sgSig.signature_image_path) {
    try {
      const fullSigPath = path.isAbsolute(sgSig.signature_image_path)
        ? sgSig.signature_image_path
        : path.join(process.cwd(), sgSig.signature_image_path.replace(/^\/+/, ''));

      if (fs.existsSync(fullSigPath)) {
        const sigBytes = fs.readFileSync(fullSigPath);
        let sigImg = fullSigPath.toLowerCase().endsWith('.png') ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
        if (sigImg) {
          page.drawImage(sigImg, { x: width - 230, y: currentY - 105, width: 140, height: 45 });
        }
      }
    } catch (err) {
      console.warn('Could not embed SG signature on Arrival PDF:', err.message);
    }
  }

  const sgNameStr = sgUser ? `Dr. ${sgUser.first_name} ${sgUser.last_name}` : 'Le Secrétaire Général';
  page.drawText(`Signé par : ${sgNameStr}`, { x: 65, y: currentY - 80, size: 9, font: fontBold, color: darkTextColor });
  page.drawText(`Statut : ARRIVÉE ENREGISTRÉE & MISSION EN COURS`, { x: 65, y: currentY - 98, size: 8.5, font: fontOblique, color: primaryRgb });

  // Footer
  page.drawLine({ start: { x: 40, y: 40 }, end: { x: width - 40, y: 40 }, thickness: 1, color: primaryRgb });
  page.drawText('Université de Kindia • Registre Officiel des Missionnaires Externes • Certifié Secrétariat Central', { x: width / 2 - 180, y: 25, size: 8, font: fontOblique, color: primaryRgb });

  const pdfBytes = await pdfDoc.save();
  const filename = `ARRIVEE_${missData.reference.replace(/\//g, '_')}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, pdfBytes);

  return { filename, filePath };
}

/**
 * Generates Final Validated PDF for External Missionary (Contains BOTH Arrival & Departure Stamps)
 */
async function generateExternalMissionaryFinalPDF(missData) {
  const { instSettings, sgUser, sgSig } = await getSGSignatureAndInstitutionInfo();

  let pdfDoc;
  const originalPath = missData.original_document_path ? path.join(UPLOAD_DIR, path.basename(missData.original_document_path)) : null;

  if (originalPath && fs.existsSync(originalPath) && originalPath.toLowerCase().endsWith('.pdf')) {
    try {
      const existingPdfBytes = fs.readFileSync(originalPath);
      pdfDoc = await PDFDocument.load(existingPdfBytes);
    } catch (e) {
      pdfDoc = await PDFDocument.create();
    }
  } else {
    pdfDoc = await PDFDocument.create();
  }

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const primaryRgb = rgb(11 / 255, 37 / 255, 69 / 255);
  const goldRgb = rgb(212 / 255, 175 / 255, 55 / 255);
  const darkTextColor = rgb(30 / 255, 41 / 255, 59 / 255);

  // Header Banner
  page.drawText('RÉPUBLIQUE DE GUINÉE', { x: width / 2 - 60, y: height - 35, size: 10, font: fontBold, color: darkTextColor });
  page.drawText('UNIVERSITÉ DE KINDIA', { x: width / 2 - 75, y: height - 50, size: 12, font: fontBold, color: primaryRgb });
  page.drawText('SECRÉTARIAT GÉNÉRAL', { x: width / 2 - 65, y: height - 65, size: 10, font: fontBold, color: goldRgb });

  page.drawLine({ start: { x: 40, y: height - 72 }, end: { x: width - 40, y: height - 72 }, thickness: 1.5, color: goldRgb });

  // Title Box
  let currentY = height - 105;
  page.drawRectangle({ x: 40, y: currentY - 5, width: width - 80, height: 32, color: primaryRgb });
  page.drawText('ATTESTATION FINALE DE MISSION — MISSIONNAIRE EXTERNE', { x: 65, y: currentY + 6, size: 11, font: fontBold, color: rgb(1, 1, 1) });

  currentY -= 35;
  page.drawText(`Réf UK-GED : ${missData.reference}`, { x: 50, y: currentY, size: 9.5, font: fontBold, color: primaryRgb });

  // Summary
  currentY -= 22;
  const fields = [
    ['Missionnaire :', `${missData.last_name} ${missData.first_names} (${missData.nationality || 'Guinéenne'})`],
    ['Fonction & Institution :', `${missData.function_title} — ${missData.origin_institution}`],
    ['Réf Ordre de Mission :', missData.mission_order_ref],
    ['Objet & Lieu :', `${missData.object_of_mission} (${missData.location_of_mission})`],
    ['Structure d’accueil :', `${missData.host_service_name || 'UK'} (Resp: ${missData.host_responsible_name || 'N/A'})`]
  ];

  fields.forEach(([lbl, val]) => {
    page.drawText(lbl, { x: 50, y: currentY, size: 8.5, font: fontBold, color: primaryRgb });
    page.drawText(String(val).substring(0, 65), { x: 190, y: currentY, size: 8.5, font: fontRegular, color: darkTextColor });
    currentY -= 15;
  });

  currentY -= 15;

  // 1. ARRIVAL STAMP BOX
  const arrivalDateStr = missData.arrival_date
    ? new Date(missData.arrival_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  page.drawRectangle({
    x: 50,
    y: currentY - 110,
    width: width - 100,
    height: 110,
    borderColor: primaryRgb,
    borderWidth: 1.5,
    color: rgb(240 / 255, 249 / 255, 255 / 255)
  });

  page.drawText(`VU À L'ARRIVÉE À L'UNIVERSITÉ DE KINDIA LE ${arrivalDateStr.toUpperCase()}`, { x: 65, y: currentY - 22, size: 10, font: fontBold, color: primaryRgb });
  page.drawText('LE SECRÉTAIRE GÉNÉRAL', { x: 65, y: currentY - 40, size: 10, font: fontBold, color: primaryRgb });

  // 2. DEPARTURE STAMP BOX
  const departureDateStr = missData.departure_date
    ? new Date(missData.departure_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  currentY -= 125;
  page.drawRectangle({
    x: 50,
    y: currentY - 110,
    width: width - 100,
    height: 110,
    borderColor: goldRgb,
    borderWidth: 2,
    color: rgb(255 / 255, 251 / 255, 235 / 255)
  });

  page.drawText(`VU AU DÉPART DE L'UNIVERSITÉ DE KINDIA LE ${departureDateStr.toUpperCase()}`, { x: 65, y: currentY - 22, size: 10, font: fontBold, color: primaryRgb });
  page.drawText('LE SECRÉTAIRE GÉNÉRAL', { x: 65, y: currentY - 40, size: 10, font: fontBold, color: primaryRgb });

  // Embed SG Signature if available
  if (sgSig && sgSig.signature_image_path) {
    try {
      const fullSigPath = path.isAbsolute(sgSig.signature_image_path)
        ? sgSig.signature_image_path
        : path.join(process.cwd(), sgSig.signature_image_path.replace(/^\/+/, ''));

      if (fs.existsSync(fullSigPath)) {
        const sigBytes = fs.readFileSync(fullSigPath);
        let sigImg = fullSigPath.toLowerCase().endsWith('.png') ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
        if (sigImg) {
          page.drawImage(sigImg, { x: width - 230, y: currentY - 95, width: 140, height: 45 });
        }
      }
    } catch (err) {
      console.warn('Could not embed SG signature on Final PDF:', err.message);
    }
  }

  const sgNameStr = sgUser ? `Dr. ${sgUser.first_name} ${sgUser.last_name}` : 'Le Secrétaire Général';
  page.drawText(`Signé & Validé par : ${sgNameStr}`, { x: 65, y: currentY - 75, size: 9, font: fontBold, color: darkTextColor });
  page.drawText(`Statut du Dossier : MISSION TERMINÉE`, { x: 65, y: currentY - 93, size: 9, font: fontBold, color: primaryRgb });

  // Footer
  page.drawLine({ start: { x: 40, y: 40 }, end: { x: width - 40, y: 40 }, thickness: 1, color: primaryRgb });
  page.drawText('Université de Kindia • Document Officiel Définitif Archiver au Secrétariat Central', { x: width / 2 - 170, y: 25, size: 8, font: fontOblique, color: primaryRgb });

  const pdfBytes = await pdfDoc.save();
  const filename = `FINAL_${missData.reference.replace(/\//g, '_')}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, pdfBytes);

  return { filename, filePath };
}

/**
 * Generates an official signed PDF document for a Mission Order (Ordre de Mission)
 * Strictly applies electronic signature, QR code and official stamp in direct OVERLAY
 * on top of the already generated official PDF.
 * Never executes LibreOffice / OnlyOffice DOCX->PDF conversion during signing.
 */
async function generateSignedMissionOrderPDF(missionData, signatureDetails = {}) {
  const t0_total = Date.now();
  const cleanRef = (missionData.reference || `OM_${missionData.id || Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
  const missionToken = missionData.tracking_token || missionData.token || missionData.signature_token || missionData.reference || cleanRef;
  const verificationUrl = `${appBaseUrl}/verification/ordre-mission/${encodeURIComponent(missionToken)}`;

  // 1. Locate the already-generated official unsigned PDF
  const t0_load = Date.now();
  let candidatePaths = [
    missionData.generated_file_path ? resolveLocalFilePath(missionData.generated_file_path) : null,
    missionData.file_path ? resolveLocalFilePath(missionData.file_path) : null,
    path.join(UPLOAD_DIR, `MISSION_ORDER_${cleanRef}.pdf`),
    path.join(UPLOAD_DIR, `instance_${cleanRef}.pdf`),
    missionData.generated_file_path ? path.join(UPLOAD_DIR, path.basename(missionData.generated_file_path)) : null,
    missionData.file_path ? path.join(UPLOAD_DIR, path.basename(missionData.file_path)) : null
  ].filter(p => p && fs.existsSync(p));

  let sourcePdfPath = candidatePaths.length > 0 ? candidatePaths[0] : null;

  // Fallback: If for any reason no pre-existing PDF exists (e.g. isolated legacy call), generate the initial instance once
  if (!sourcePdfPath || !fs.existsSync(sourcePdfPath)) {
    console.warn(`[MISSION_ORDER SIGN] Aucun PDF pré-généré trouvé pour ${cleanRef}. Génération initiale de l'instance...`);
    const initialInstance = await generateMissionOrderDocumentInstance(
      missionData,
      missionData.template_id,
      missionData.template_version_id
    );
    sourcePdfPath = initialInstance.pdf_path || resolveLocalFilePath(initialInstance.generated_file_path);
  }

  if (!sourcePdfPath || !fs.existsSync(sourcePdfPath)) {
    throw new Error(`Le document PDF officiel source est introuvable pour l'ordre de mission (${cleanRef}).`);
  }

  // 2. Load PDF with pdf-lib
  const sourcePdfBytes = fs.readFileSync(sourcePdfPath);
  if (!sourcePdfBytes || sourcePdfBytes.length === 0) {
    throw new Error(`Le fichier PDF source (${sourcePdfPath}) est vide ou illisible.`);
  }

  const pdfDoc = await PDFDocument.load(sourcePdfBytes);
  const pages = pdfDoc.getPages();
  const page1 = pages[0] || pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page1.getSize();
  const t_load = Date.now() - t0_load;

  // 3. Generate and Stamp Verification QR Code
  const t0_qr = Date.now();
  const qrBuffer = await generateQRCodeBuffer(verificationUrl);
  const t_qr_gen = Date.now() - t0_qr;

  const t0_qr_apply = Date.now();
  if (qrBuffer) {
    try {
      const qrImg = await pdfDoc.embedPng(qrBuffer);
      page1.drawImage(qrImg, {
        x: 48,
        y: 110,
        width: 60,
        height: 60
      });
    } catch (qrErr) {
      console.warn('[MISSION_ORDER SIGN] Erreur overlay QR code:', qrErr.message);
    }
  }
  const t_qr_apply = Date.now() - t0_qr_apply;

  // 4. Load and Stamp Electronic Signature
  const t0_sig = Date.now();
  const resolvedSignatory = await resolveCurrentMissionSignatory(signatureDetails);
  const signatureImagePath = signatureDetails.signature_image_path || resolvedSignatory.signaturePath;
  let t_sig_load = 0;
  let t_sig_apply = 0;

  if (signatureImagePath) {
    const t0_sig_load = Date.now();
    const resolvedSigPath = resolveLocalFilePath(signatureImagePath, 'signatures');
    if (resolvedSigPath && fs.existsSync(resolvedSigPath)) {
      const sigBytes = fs.readFileSync(resolvedSigPath);
      t_sig_load = Date.now() - t0_sig_load;

      const t0_sig_draw = Date.now();
      try {
        const isPng = resolvedSigPath.toLowerCase().endsWith('.png');
        const sigImg = isPng ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
        if (sigImg) {
          page1.drawImage(sigImg, {
            x: width - 215,
            y: 115,
            width: 130,
            height: 45
          });
        }
      } catch (sigErr) {
        console.warn('[MISSION_ORDER SIGN] Erreur overlay signature:', sigErr.message);
      }
      t_sig_apply = Date.now() - t0_sig_draw;
    }
  }

  // 5. Optional Official Institutional Stamp overlay (if configured)
  const t0_stamp = Date.now();
  try {
    const instSettings = await db.get('SELECT * FROM institution_settings WHERE id = 1');
    const stampPath = resolveLocalFilePath(instSettings?.stamp_path, 'stamps') || resolveLocalFilePath('cachet_kindia_officiel.png', 'stamps');
    if (stampPath && fs.existsSync(stampPath) && (signatureDetails.apply_stamp || instSettings?.auto_stamp_om)) {
      const stampBytes = fs.readFileSync(stampPath);
      const isPng = stampPath.toLowerCase().endsWith('.png');
      const stampImg = isPng ? await pdfDoc.embedPng(stampBytes) : await pdfDoc.embedJpg(stampBytes);
      if (stampImg) {
        page1.drawImage(stampImg, {
          x: width - 265,
          y: 105,
          width: 70,
          height: 70,
          opacity: 0.85
        });
      }
    }
  } catch (stampErr) {
    // Non-blocking
  }
  const t_stamp = Date.now() - t0_stamp;

  // 6. Save Signed PDF
  const t0_save = Date.now();
  const signedPdfBytes = await pdfDoc.save();
  const filename = `MISSION_ORDER_${cleanRef}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, signedPdfBytes);

  // Validate output file on disk
  const stat = fs.statSync(filePath);
  if (!stat || stat.size < 1000) {
    throw new Error(`Le PDF signé produit est invalide ou corrompu (${stat ? stat.size : 0} octets).`);
  }
  const t_save = Date.now() - t0_save;

  const t_total = Date.now() - t0_total;
  console.log(`[MISSION_ORDER FAST SIGN - 0 CONVERSION DOCX]
   ✓ Source PDF chargé : ${path.basename(sourcePdfPath)} (${t_load} ms)
   ✓ QR Code généré & appliqué (${t_qr_gen + t_qr_apply} ms)
   ✓ Signature chargée & appliquée (${t_sig_load + t_sig_apply} ms)
   ✓ Cachet traité (${t_stamp} ms)
   ✓ PDF signé sauvegardé : ${filename} (${stat.size} octets, ${t_save} ms)
   ⏱️ Durée totale signature pure : ${t_total} ms`);

  return {
    filename,
    filePath,
    verificationUrl,
    engine: 'FAST_PDF_OVERLAY'
  };
}

/**
 * Generates an official signed PDF document for a Soit-Transmis
 */
async function generateSoitTransmisPDF(stData, signatureDetails) {
  return await generateGenericDocumentPDFFromActiveTemplate('SOIT_TRANSMIS', stData, signatureDetails);
}

/**
 * Applies electronic signature of the Secrétaire Général to an External Missionary's original PDF document
 */
async function generateSignedExternalMissionaryPDF(missData, signatureDetails = {}) {
  const origPath = path.isAbsolute(missData.original_document_path)
    ? missData.original_document_path
    : path.join(process.cwd(), missData.original_document_path.replace(/^\/+/, ''));

  let pdfDoc;
  if (fs.existsSync(origPath) && origPath.toLowerCase().endsWith('.pdf')) {
    const existingPdfBytes = fs.readFileSync(origPath);
    pdfDoc = await PDFDocument.load(existingPdfBytes);
  } else {
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    page.drawText(`Ordre de Mission Externe - Réf UK-GED: ${missData.reference}`, { x: 50, y: 800, size: 14 });
  }

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const primaryRgb = rgb(15 / 255, 23 / 255, 42 / 255);
  const emeraldRgb = rgb(5 / 255, 150 / 255, 105 / 255);

  const pages = pdfDoc.getPages();
  const targetPage = pages[pages.length - 1] || pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = targetPage.getSize();

  // Signature Box at bottom right of the last page
  const sigBoxY = 50;
  const sigBoxX = width - 260;
  const sigBoxW = 220;
  const sigBoxH = 110;

  targetPage.drawRectangle({
    x: sigBoxX,
    y: sigBoxY,
    width: sigBoxW,
    height: sigBoxH,
    borderColor: emeraldRgb,
    borderWidth: 1.5,
    color: rgb(240 / 255, 253 / 255, 244 / 255)
  });

  targetPage.drawText('SIGNATURE ÉLECTRONIQUE OFFICIELLE', {
    x: sigBoxX + 10,
    y: sigBoxY + sigBoxH - 16,
    size: 8,
    font: fontBold,
    color: emeraldRgb
  });

  targetPage.drawText('UNIVERSITÉ DE KINDIA', {
    x: sigBoxX + 10,
    y: sigBoxY + sigBoxH - 28,
    size: 7.5,
    font: fontBold,
    color: primaryRgb
  });

  const signedDateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  targetPage.drawText(`Visé & Approuvé le : ${signedDateStr}`, {
    x: sigBoxX + 10,
    y: sigBoxY + sigBoxH - 40,
    size: 7,
    font: fontRegular,
    color: primaryRgb
  });

  targetPage.drawText('Le Secrétaire Général', {
    x: sigBoxX + 10,
    y: sigBoxY + sigBoxH - 52,
    size: 8,
    font: fontBold,
    color: primaryRgb
  });

  // Embed SG Signature image if available
  if (signatureDetails && signatureDetails.signature_image_path) {
    try {
      const fullSigPath = resolveLocalFilePath(signatureDetails.signature_image_path, 'signatures');
      if (fullSigPath && fs.existsSync(fullSigPath)) {
        const sigBytes = fs.readFileSync(fullSigPath);
        let sigImg = fullSigPath.toLowerCase().endsWith('.png') ? await pdfDoc.embedPng(sigBytes) : await pdfDoc.embedJpg(sigBytes);
        if (sigImg) {
          targetPage.drawImage(sigImg, { x: sigBoxX + 100, y: sigBoxY + 12, width: 105, height: 40 });
        }
      }
    } catch (e) {
      console.warn('Could not embed signature image on external OM:', e.message);
    }
  }

  // Footer stamp line
  targetPage.drawText(`UK-GED CERTIFIÉ • Réf: ${missData.reference} • Document Verrouillé`, {
    x: 40,
    y: 20,
    size: 7,
    font: fontOblique,
    color: primaryRgb
  });

  const pdfBytes = await pdfDoc.save();
  const filename = `SIGNED_EXT_OM_${missData.reference.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, pdfBytes);

  return { filename, filePath };
}

/**
 * Generates a frozen document instance (DOCX & PDF) for a specific mission order
 * using the exact template and template version specified.
 */
async function generateMissionOrderDocumentInstance(docData, templateId = null, templateVersionId = null) {
  const result = await generateOfficialKindiaMissionOrderPDF({
    ...docData,
    template_id: templateId,
    template_version_id: templateVersionId
  }, {
    is_draft: true
  });

  const activeTemplateData = await getActiveTemplateForDocumentType('MISSION_ORDER', templateId, templateVersionId);
  const template = activeTemplateData?.template;
  const activeVersion = activeTemplateData?.activeVersion;
  const templateFileName = template?.file_name || (template?.file_path ? path.basename(template.file_path) : 'ORDRE_DE_MISSION_OFFICIEL.docx');
  const templateVerNum = activeVersion?.version_number || template?.version_number || 1;

  return {
    template_id: template?.id || null,
    template_version_id: activeVersion?.id || null,
    template_version_number: templateVerNum,
    template_name: template?.name || 'Ordre de mission officiel',
    template_file_name: templateFileName,
    generated_docx_path: result.docxFilename,
    generated_file_path: result.filename,
    pdf_path: result.filePath,
    verification_url: result.verificationUrl
  };
}

function formatTransportMode(mode) {
  if (!mode) return '';
  return String(mode).trim();
}

module.exports = {
  formatTransportMode,
  resolveLocalFilePath,
  getActiveTemplateForDocumentType,
  generateDocumentPDFFromActiveTemplate,
  generateOfficialKindiaMissionOrderPDF,
  generateDirectPdfFromTemplate,
  getDefaultKindiaFieldCoordinates,
  generateMissionOrderDocumentInstance,
  generateSignedMissionOrderPDF,
  generateSoitTransmisPDF,
  generateExternalMissionaryArrivalPDF,
  generateExternalMissionaryFinalPDF,
  generateSignedExternalMissionaryPDF
};

