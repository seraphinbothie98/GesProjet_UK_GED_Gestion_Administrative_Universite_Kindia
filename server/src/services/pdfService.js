const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { generateQRCodeBuffer } = require('./qrService');
const { UPLOAD_DIR } = require('../config/constants');
const docxService = require('./docxService');

/**
 * Helper to fetch active or specific customized template and version for a given document type code
 */
async function getActiveTemplateForDocumentType(documentTypeCode, specificTemplateId = null, specificVersionId = null) {
  let template = null;

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
    path.join(UPLOAD_DIR, basename),
    path.join(process.cwd(), targetPath.replace(/^\/+/, '')),
    path.join(process.cwd(), 'server', targetPath.replace(/^\/+/, '')),
    path.join(__dirname, '../../uploads', subfolder || '', basename),
    path.join(__dirname, '../../uploads', basename)
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (e) {}
  }
  return null;
}

/**
 * High-Fidelity Official Mission Order PDF Generator matching the University of Kindia reference document
 */
async function generateOfficialKindiaMissionOrderPDF(missionData, signatureDetails = {}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
  const { width, height } = page.getSize();

  const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontTimesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const fontTimesBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const navyBlue = rgb(11 / 255, 37 / 255, 69 / 255); // #0B2545
  const kindiaBlue = rgb(0 / 255, 43 / 255, 128 / 255);
  const redColor = rgb(220 / 255, 38 / 255, 38 / 255);
  const goldColor = rgb(202 / 255, 138 / 255, 4 / 255);
  const greenColor = rgb(22 / 255, 163 / 255, 74 / 255);
  const blackColor = rgb(15 / 255, 23 / 255, 42 / 255);
  const grayColor = rgb(100 / 255, 116 / 255, 139 / 255);

  // 1. TOP-LEFT GUINEAN TRICOLOR DIAGONAL RIBBON
  // Red, Yellow, Green bands in top-left
  page.drawLine({ start: { x: 0, y: height - 10 }, end: { x: 100, y: height + 90 }, thickness: 7, color: redColor });
  page.drawLine({ start: { x: 0, y: height - 20 }, end: { x: 110, y: height + 90 }, thickness: 7, color: goldColor });
  page.drawLine({ start: { x: 0, y: height - 30 }, end: { x: 120, y: height + 90 }, thickness: 7, color: greenColor });

  // 2. OFFICIAL CIRCULAR LOGO OF UNIVERSITÉ DE KINDIA
  const instSettings = await db.get('SELECT * FROM institution_settings WHERE id = 1');
  const logoPathCandidate = instSettings?.logo_path || '/uploads/logos/logo_1786815829682.png';
  const fullLogoPath = resolveLocalFilePath(logoPathCandidate, 'logos');

  if (fullLogoPath) {
    try {
      const logoBytes = fs.readFileSync(fullLogoPath);
      let logoImage;
      if (fullLogoPath.toLowerCase().endsWith('.png')) {
        logoImage = await pdfDoc.embedPng(logoBytes);
      } else if (fullLogoPath.toLowerCase().endsWith('.jpg') || fullLogoPath.toLowerCase().endsWith('.jpeg')) {
        logoImage = await pdfDoc.embedJpg(logoBytes);
      }
      if (logoImage) {
        page.drawImage(logoImage, {
          x: 65,
          y: height - 120,
          width: 75,
          height: 75
        });
      }
    } catch (err) {
      console.warn('Could not embed logo in Mission Order PDF:', err.message);
    }
  }

  // 3. INSTITUTIONAL HEADER (RIGHT / CENTER-RIGHT BLOCK)
  const headerRightCenterX = 370;
  
  // "REPUBLIQUE DE GUINEE"
  const repText = "REPUBLIQUE DE GUINEE";
  page.drawText(repText, {
    x: headerRightCenterX - (repText.length * 4.2),
    y: height - 50,
    size: 15,
    font: fontTimesBoldItalic,
    color: blackColor
  });

  // "Travail - Justice - Solidarite" (Tricolor motto)
  const mottoY = height - 64;
  page.drawText("Travail - ", { x: headerRightCenterX - 75, y: mottoY, size: 9, font: fontTimesItalic, color: redColor });
  page.drawText("Justice", { x: headerRightCenterX - 35, y: mottoY, size: 9, font: fontTimesItalic, color: goldColor });
  page.drawText(" - Solidarité", { x: headerRightCenterX - 2, y: mottoY, size: 9, font: fontTimesItalic, color: greenColor });

  // "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique"
  const minText = "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique";
  page.drawText(minText, {
    x: headerRightCenterX - 180,
    y: height - 78,
    size: 9.5,
    font: fontTimesBoldItalic,
    color: blackColor
  });

  // "Université de Kindia" (Large Blue)
  const univText = "Université de Kindia";
  page.drawText(univText, {
    x: headerRightCenterX - (univText.length * 5.2),
    y: height - 98,
    size: 18,
    font: fontTimesBoldItalic,
    color: kindiaBlue
  });

  // BP 212
  page.drawText("BP 212", {
    x: headerRightCenterX - 18,
    y: height - 110,
    size: 8.5,
    font: fontTimesItalic,
    color: blackColor
  });

  // Email & Site
  const emailLabel = "Email : ";
  const emailVal = "rectorat@univ-kindia.org";
  page.drawText(emailLabel, { x: headerRightCenterX - 85, y: height - 122, size: 8.5, font: fontTimesItalic, color: blackColor });
  page.drawText(emailVal, { x: headerRightCenterX - 55, y: height - 122, size: 8.5, font: fontTimesItalic, color: redColor });

  const siteLabel = "Site : ";
  const siteVal = "www.univ-kindia.org";
  page.drawText(siteLabel, { x: headerRightCenterX - 75, y: height - 134, size: 8.5, font: fontTimesItalic, color: blackColor });
  page.drawText(siteVal, { x: headerRightCenterX - 52, y: height - 134, size: 8.5, font: fontTimesItalic, color: blackColor });

  // Dividing solid horizontal line under header
  page.drawLine({
    start: { x: 55, y: height - 146 },
    end: { x: width - 55, y: height - 146 },
    thickness: 1.5,
    color: blackColor
  });

  // 4. REFERENCE NUMBER
  const refString = missionData.reference || '2026/_______/MESRS/UK/RECT/SG';
  const refDisplay = refString.startsWith('Réf') ? refString : `Réf: ${refString}`;
  page.drawText(refDisplay, {
    x: 55,
    y: height - 164,
    size: 11,
    font: fontTimesBold,
    color: blackColor
  });

  // 5. TITLE: "ORDRE DE MISSION" (Centered, Bold, Underlined, Large Blue)
  const titleText = "ORDRE DE MISSION";
  const titleX = width / 2 - 105;
  const titleY = height - 195;

  page.drawText(titleText, {
    x: titleX,
    y: titleY,
    size: 22,
    font: fontHelveticaBold,
    color: navyBlue
  });

  // Underline title
  page.drawLine({
    start: { x: titleX, y: titleY - 4 },
    end: { x: titleX + 215, y: titleY - 4 },
    thickness: 2,
    color: navyBlue
  });

  // 6. BODY DATA LINES (Matching exact visual reference)
  let currentY = height - 240;
  const lineSpacing = 24;

  const missionRows = [
    { label: "Il est ordonné à :", value: missionData.missionary_name || "Pr Akoye Massa ZOUMANIGUI" },
    { label: "Nationalité :", value: missionData.nationality || "Guinéenne" },
    { label: "Profession ou Fonction :", value: missionData.function_title || "Recteur de l'Université" },
    { label: "De se rendre à :", value: missionData.destination || "Conakry" },
    { label: "Objet de la Mission :", value: missionData.object_of_mission || "Raisons de Service" },
    { label: "Moyen de Transport :", value: missionData.transport_mode || "BG-9949-02" },
    { label: "Date de Départ :", value: missionData.departure_date || "13 Juillet 2026" },
    { label: "Date de retour :", value: missionData.return_date || "Fin de mission" },
    { label: "Conduit par :", value: missionData.driver_name || missionData.driver_name_snapshot || (missionData.driver_option === 'DRIVER' ? (missionData.driver_name || 'Chauffeur désigné') : 'Lui-même / Autonome') }
  ];

  for (const row of missionRows) {
    // Label in Regular
    page.drawText(row.label, {
      x: 55,
      y: currentY,
      size: 11.5,
      font: fontHelvetica,
      color: blackColor
    });

    // Value in Bold
    const labelWidth = row.label.length * 6.5;
    page.drawText(String(row.value), {
      x: Math.max(160, 55 + labelWidth + 8),
      y: currentY,
      size: 11.5,
      font: fontHelveticaBold,
      color: blackColor
    });

    currentY -= lineSpacing;
  }

  // 7. ADMINISTRATIVE REQUISITION CLAUSE
  currentY -= 8;
  const clauseLine1 = "Les autorités civiles, militaires des localités traversées sont priées de bien";
  const clauseLine2 = "faciliter l'accomplissement de la présente mission.";

  page.drawText(clauseLine1, {
    x: 55,
    y: currentY,
    size: 10.5,
    font: fontHelvetica,
    color: blackColor
  });

  page.drawText(clauseLine2, {
    x: 55,
    y: currentY - 16,
    size: 10.5,
    font: fontHelvetica,
    color: blackColor
  });

  // 8. VERIFICATION QR CODE & AUTHENTICITY BADGE (Bottom-Left)
  const verificationUrl = `http://localhost:5000/api/verify/${encodeURIComponent(missionData.reference || 'REF')}`;
  try {
    const qrBuffer = await generateQRCodeBuffer(verificationUrl);
    const qrImage = await pdfDoc.embedPng(qrBuffer);
    page.drawImage(qrImage, {
      x: 55,
      y: 55,
      width: 70,
      height: 70
    });
    page.drawText("Vérification d'authenticité", {
      x: 48,
      y: 42,
      size: 6.5,
      font: fontHelveticaOblique,
      color: grayColor
    });
  } catch (qrErr) {
    console.warn('QR Code generation warning:', qrErr.message);
  }

  // 9. SIGNATURE & DATE SECTION (Bottom-Right)
  const sigBlockX = width - 260;
  let sigY = currentY - 60;

  // Date line: "Kindia, le [Date]"
  const dateStr = signatureDetails.signed_at 
    ? new Date(signatureDetails.signed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : (missionData.created_at ? new Date(missionData.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '13 Juillet 2026');

  page.drawText(`Kindia, le  ${dateStr}`, {
    x: sigBlockX + 15,
    y: sigY,
    size: 11,
    font: fontHelveticaBold,
    color: blackColor
  });

  sigY -= 30;

  // Authority Title: "LE SECRETAIRE GENERAL"
  const authorityTitle = (signatureDetails.signed_by_role || "LE SECRETAIRE GENERAL").toUpperCase();
  page.drawText(authorityTitle, {
    x: sigBlockX + 10,
    y: sigY,
    size: 12,
    font: fontHelveticaBold,
    color: navyBlue
  });

  // EMBED ACTUAL SIGNATURE IMAGE IF AVAILABLE AND SIGNED
  const signerName = signatureDetails.signed_by_name || "Dr Mamadou Billo DOUMBOUYA";
  let sigImageEmbedded = false;

  if (signatureDetails.signature_image_path) {
    const resolvedSigPath = resolveLocalFilePath(signatureDetails.signature_image_path, 'signatures');
    if (resolvedSigPath && fs.existsSync(resolvedSigPath)) {
      try {
        const sigBytes = fs.readFileSync(resolvedSigPath);
        let sigImg = null;
        if (resolvedSigPath.toLowerCase().endsWith('.png')) {
          sigImg = await pdfDoc.embedPng(sigBytes);
        } else if (resolvedSigPath.toLowerCase().endsWith('.jpg') || resolvedSigPath.toLowerCase().endsWith('.jpeg')) {
          sigImg = await pdfDoc.embedJpg(sigBytes);
        }
        if (sigImg) {
          page.drawImage(sigImg, {
            x: sigBlockX + 15,
            y: sigY - 55,
            width: 140,
            height: 48
          });
          sigImageEmbedded = true;
        }
      } catch (sigLoadErr) {
        console.warn('Could not embed signature image in Mission Order:', sigLoadErr.message);
      }
    }
  }

  // Signer Name (Underlined / Bold)
  const nameY = sigY - 70;
  page.drawText(signerName, {
    x: sigBlockX + 10,
    y: nameY,
    size: 11.5,
    font: fontHelveticaBold,
    color: blackColor
  });

  // Underline signer name
  page.drawLine({
    start: { x: sigBlockX + 10, y: nameY - 2 },
    end: { x: sigBlockX + 10 + (signerName.length * 6.8), y: nameY - 2 },
    thickness: 1.5,
    color: blackColor
  });

  // Security Stamp metadata
  if (signatureDetails.signature_hash) {
    page.drawText(`UK-GED Scellé Sécurisé • SHA: ${signatureDetails.signature_hash.substring(0, 16)}...`, {
      x: 55,
      y: 28,
      size: 6.5,
      font: fontHelveticaOblique,
      color: grayColor
    });
  }

  const pdfBytes = await pdfDoc.save();
  const cleanRef = (missionData.reference || 'MISSION_ORDER').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `MISSION_ORDER_${cleanRef}.pdf`;
  const filePath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filePath, pdfBytes);

  return { filename, filePath, verificationUrl };
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
    } catch (e) {}
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
    '{{date_creation}}': docData.created_at ? new Date(docData.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
    '{{missionnaire_nom}}': docData.missionary_name || docData.name || '',
    '{{missionnaire_prenoms}}': docData.missionary_firstnames || '',
    '{{missionnaire_fonction}}': docData.function_title || docData.function || '',
    '{{missionnaire_service}}': docData.service_name || docData.service || '',
    '{{destination}}': docData.destination || '',
    '{{objet_mission}}': docData.object_of_mission || docData.title || '',
    '{{date_depart}}': docData.departure_date || '',
    '{{date_retour}}': docData.return_date || '',
    '{{moyen_transport}}': docData.transport_mode || '',
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
  const verificationUrl = `http://localhost:5000/api/verify/${encodeURIComponent(docData.reference || 'REF')}`;
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
      } catch (e) {}
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
 */
async function generateSignedMissionOrderPDF(missionData, signatureDetails) {
  return await generateOfficialKindiaMissionOrderPDF(missionData, signatureDetails);
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
  const activeTemplateData = await getActiveTemplateForDocumentType('MISSION_ORDER', templateId, templateVersionId);
  
  const template = activeTemplateData?.template;
  const activeVersion = activeTemplateData?.activeVersion;

  const cleanRef = (docData.reference || `OM_${docData.id || Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const dataMap = {
    '{{reference}}': docData.reference || '',
    '{{date_document}}': docData.created_at ? new Date(docData.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
    '{{date_creation}}': docData.created_at ? new Date(docData.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
    '{{missionnaire_nom}}': docData.missionary_name || '',
    '{{missionnaire_prenoms}}': docData.missionary_firstnames || '',
    '{{missionnaire_fonction}}': docData.function_title || 'Enseignant-Chercheur / Agent UK',
    '{{missionnaire_service}}': docData.missionary_service || docData.service_name || '',
    '{{matricule}}': docData.matricule || '',
    '{{nationalite}}': docData.nationality || 'Guinéenne',
    '{{destination}}': docData.destination || '',
    '{{objet_mission}}': docData.object_of_mission || '',
    '{{moyen_transport}}': docData.transport_mode || 'Véhicule de service',
    '{{date_depart}}': docData.departure_date || '',
    '{{date_retour}}': docData.return_date || '',
    '{{conduit_par}}': docData.driver_name || '',
    '{{annee_universitaire}}': '2025-2026',
    '{{signataire}}': 'LE SECRÉTAIRE GÉNÉRAL',
    '{{signature}}': '[En attente de signature du Secrétaire Général]'
  };

  // 1. Generate filled DOCX instance
  let sourceDocxBuffer = null;
  const templateDir = path.join(__dirname, '../../uploads/templates');
  let masterDocxPath = activeVersion?.file_path ? path.join(templateDir, activeVersion.file_path) : (template?.file_path ? path.join(templateDir, template.file_path) : null);
  
  if (masterDocxPath && fs.existsSync(masterDocxPath)) {
    sourceDocxBuffer = fs.readFileSync(masterDocxPath);
  } else {
    sourceDocxBuffer = await docxService.buildOfficialKindiaMissionDocx();
  }

  const filledDocxBuffer = await docxService.fillDocxTemplate(sourceDocxBuffer, dataMap);
  const docxFilename = `instance_${cleanRef}.docx`;
  const docxFullPath = path.join(UPLOAD_DIR, docxFilename);
  fs.writeFileSync(docxFullPath, filledDocxBuffer);

  // 2. Generate matching PDF instance (Draft/Pending signature) using official Kindia visual layout
  const pdfResult = await generateOfficialKindiaMissionOrderPDF({
    ...docData,
    template_id: template?.id,
    template_version_id: activeVersion?.id
  }, {
    signed_by_name: 'Dr Mamadou Billo DOUMBOUYA',
    signed_by_role: 'LE SECRETAIRE GENERAL',
    is_draft: true
  });

  return {
    template_id: template?.id || null,
    template_version_id: activeVersion?.id || null,
    template_version_number: activeVersion?.version_number || template?.version || 1,
    generated_docx_path: docxFilename,
    generated_file_path: pdfResult.filename,
    pdf_path: pdfResult.filePath
  };
}

module.exports = { 
  resolveLocalFilePath,
  getActiveTemplateForDocumentType,
  generateDocumentPDFFromActiveTemplate,
  generateOfficialKindiaMissionOrderPDF,
  generateMissionOrderDocumentInstance,
  generateSignedMissionOrderPDF, 
  generateSoitTransmisPDF,
  generateExternalMissionaryArrivalPDF,
  generateExternalMissionaryFinalPDF,
  generateSignedExternalMissionaryPDF
};
