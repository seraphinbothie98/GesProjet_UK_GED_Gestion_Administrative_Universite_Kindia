const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { UPLOAD_DIR } = require('../config/constants');
const { generateQRCodeDataUrl, generateQRCodeBuffer } = require('./qrService');

// Ensure receipts directory exists
const RECEIPTS_DIR = path.join(UPLOAD_DIR, 'receipts');
if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

/**
 * Strips unsupported characters for pdf-lib standard fonts
 */
function sanitizeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/[^\x00-\x7F\u00A0-\u00FF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds the canonical public verification URL for a given document
 */
function getVerificationUrl(reference, token, req = null) {
  let host = 'http://localhost:5173';
  if (process.env.APP_URL) {
    host = process.env.APP_URL.replace(/\/$/, '');
  } else if (req) {
    const origin = req.get('origin') || req.get('referer');
    if (origin) {
      try {
        const urlObj = new URL(origin);
        host = `${urlObj.protocol}//${urlObj.host}`;
      } catch (e) {
        host = 'http://localhost:5173';
      }
    }
  }
  const cleanRef = encodeURIComponent(reference);
  return `${host}/verify/${cleanRef}`;
}

/**
 * Main Receipt Generator: Generates Official Receipt PDF with QR Code and stores it in database
 */
async function generateAndStoreReceipt(documentId, receiptType, req = null) {
  try {
    // 1. Fetch document and related data
    const doc = await db.get(
      `SELECT d.*, 
              s.name as current_service_name, s.code as current_service_code,
              u.first_name as creator_first, u.last_name as creator_last, u.matricule as creator_matricule,
              us.name as creator_service_name
       FROM documents d
       LEFT JOIN services s ON d.current_service_id = s.id
       LEFT JOIN users u ON d.created_by = u.id
       LEFT JOIN services us ON u.service_id = us.id
       WHERE d.id = ?`,
      [documentId]
    );

    if (!doc) {
      throw new Error(`Document #${documentId} introuvable pour la génération du reçu.`);
    }

    // Fetch incoming mail or mission order specific details
    let incomingMail = null;
    let missionOrder = null;

    if (doc.document_type === 'INCOMING_MAIL' || receiptType === 'INCOMING_MAIL') {
      incomingMail = await db.get('SELECT * FROM incoming_mails WHERE document_id = ?', [doc.id]);
    } else if (doc.document_type === 'MISSION_ORDER' || receiptType === 'MISSION_ORDER') {
      missionOrder = await db.get('SELECT * FROM mission_orders WHERE document_id = ?', [doc.id]);
    }

    // 2. Compute canonical Verification URL & Token
    const verificationUrl = getVerificationUrl(doc.reference, doc.tracking_token, req);
    const qrCodeDataUrl = await generateQRCodeDataUrl(verificationUrl);
    const qrCodeBuffer = await generateQRCodeBuffer(verificationUrl);

    // 3. Generate sequential Receipt Number
    const year = new Date().getFullYear();
    const receiptPrefix = receiptType === 'MISSION_ORDER' ? 'REC-OM' : 'REC-CE';
    const countRow = await db.get('SELECT COUNT(*) as c FROM document_receipts WHERE receipt_type = ?', [receiptType]);
    const seq = String((countRow ? countRow.c : 0) + 1).padStart(6, '0');
    const receiptNumber = `${receiptPrefix}-UK-${year}-${seq}`;

    // 4. Build Official PDF Document using pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const primaryColor = rgb(0 / 255, 43 / 255, 73 / 255); // #002B49 (Kindia Navy)
    const goldColor = rgb(212 / 255, 175 / 255, 55 / 255); // #D4AF37 (Kindia Gold)
    const darkSlate = rgb(30 / 255, 41 / 255, 59 / 255);
    const mutedGray = rgb(100 / 255, 116 / 255, 139 / 255);
    const bgLight = rgb(248 / 255, 250 / 255, 252 / 255);
    const borderLight = rgb(226 / 255, 232 / 255, 240 / 255);

    // Decorative Top Golden Line
    page.drawRectangle({
      x: 0,
      y: height - 8,
      width: width,
      height: 8,
      color: goldColor
    });

    // 4.1 Header: Institutional Logos & Text
    let currentY = height - 40;

    // Load institution logo if available
    const instSettings = await db.get('SELECT * FROM institution_settings WHERE id = 1');
    if (instSettings && instSettings.logo_path) {
      try {
        const logoBasename = path.basename(instSettings.logo_path);
        const candidates = [
          path.join(UPLOAD_DIR, 'logos', logoBasename),
          path.join(UPLOAD_DIR, logoBasename)
        ];
        let logoBuffer = null;
        for (const c of candidates) {
          if (fs.existsSync(c)) {
            logoBuffer = fs.readFileSync(c);
            break;
          }
        }
        if (logoBuffer) {
          let embeddedLogo = null;
          if (logoBasename.toLowerCase().endsWith('.png')) {
            embeddedLogo = await pdfDoc.embedPng(logoBuffer);
          } else if (logoBasename.toLowerCase().endsWith('.jpg') || logoBasename.toLowerCase().endsWith('.jpeg')) {
            embeddedLogo = await pdfDoc.embedJpg(logoBuffer);
          }
          if (embeddedLogo) {
            page.drawImage(embeddedLogo, {
              x: 45,
              y: currentY - 50,
              width: 55,
              height: 55
            });
          }
        }
      } catch (err) {
        console.warn('Could not embed logo in receipt PDF:', err.message);
      }
    }

    // Left Institutional Text
    page.drawText(sanitizeText("RÉPUBLIQUE DE GUINÉE"), {
      x: 115,
      y: currentY,
      size: 10,
      font: fontBold,
      color: primaryColor
    });
    page.drawText(sanitizeText("Travail - Justice - Solidarité"), {
      x: 115,
      y: currentY - 12,
      size: 8,
      font: fontOblique,
      color: mutedGray
    });
    page.drawText(sanitizeText("MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR"), {
      x: 115,
      y: currentY - 25,
      size: 8,
      font: fontRegular,
      color: darkSlate
    });
    page.drawText(sanitizeText("DE LA RECHERCHE SCIENTIFIQUE ET DE L'INNOVATION"), {
      x: 115,
      y: currentY - 35,
      size: 7.5,
      font: fontRegular,
      color: darkSlate
    });
    page.drawText(sanitizeText("UNIVERSITÉ DE KINDIA • SECRÉTARIAT CENTRAL"), {
      x: 115,
      y: currentY - 48,
      size: 9,
      font: fontBold,
      color: primaryColor
    });

    // Right Official Header Stamp Box
    page.drawRectangle({
      x: width - 200,
      y: currentY - 50,
      width: 155,
      height: 55,
      borderColor: goldColor,
      borderWidth: 1,
      color: bgLight
    });
    page.drawText(sanitizeText("REGISTRE OFFICIEL UK-GED"), {
      x: width - 190,
      y: currentY - 14,
      size: 8,
      font: fontBold,
      color: primaryColor
    });
    page.drawText(sanitizeText(`Reçu N° : ${receiptNumber}`), {
      x: width - 190,
      y: currentY - 28,
      size: 7.5,
      font: fontBold,
      color: darkSlate
    });
    page.drawText(sanitizeText(`Date : ${new Date().toLocaleDateString('fr-FR')}`), {
      x: width - 190,
      y: currentY - 42,
      size: 7.5,
      font: fontRegular,
      color: mutedGray
    });

    // 4.2 Title Banner Box
    currentY -= 75;
    page.drawRectangle({
      x: 45,
      y: currentY - 30,
      width: width - 90,
      height: 35,
      color: primaryColor
    });

    const isMission = receiptType === 'MISSION_ORDER' || doc.document_type === 'MISSION_ORDER';
    const receiptTitle = isMission 
      ? "REÇU D'ENREGISTREMENT D'ORDRE DE MISSION" 
      : "REÇU D'ENREGISTREMENT DE COURRIER ENTRANT";

    const titleWidth = fontBold.widthOfTextAtSize(receiptTitle, 12);
    page.drawText(receiptTitle, {
      x: 45 + ((width - 90) - titleWidth) / 2,
      y: currentY - 19,
      size: 12,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    // Subtitle notice
    currentY -= 48;
    const certifNotice = "PREUVE OFFICIELLE D'ENREGISTREMENT ET DE DÉPÔT NUMÉRIQUE CERTIFIÉ";
    const certWidth = fontBold.widthOfTextAtSize(certifNotice, 8);
    page.drawText(certifNotice, {
      x: 45 + ((width - 90) - certWidth) / 2,
      y: currentY,
      size: 8,
      font: fontBold,
      color: goldColor
    });

    // 4.3 Key Reference Banner Box
    currentY -= 32;
    page.drawRectangle({
      x: 45,
      y: currentY - 24,
      width: width - 90,
      height: 28,
      color: bgLight,
      borderColor: borderLight,
      borderWidth: 1
    });

    page.drawText(sanitizeText("RÉFÉRENCE UNIQUE DE SUIVI :"), {
      x: 60,
      y: currentY - 16,
      size: 9,
      font: fontBold,
      color: mutedGray
    });

    page.drawText(sanitizeText(doc.reference), {
      x: 230,
      y: currentY - 17,
      size: 12,
      font: fontBold,
      color: primaryColor
    });

    // 4.4 Main Information Table Box
    currentY -= 40;
    const tableTop = currentY;
    const tableHeight = isMission ? 210 : 220;
    
    page.drawRectangle({
      x: 45,
      y: tableTop - tableHeight,
      width: width - 90,
      height: tableHeight,
      borderColor: borderLight,
      borderWidth: 1,
      color: rgb(1, 1, 1)
    });

    // Helper to draw row in table
    const drawTableRow = (label, value, yPos, isHighlight = false) => {
      page.drawLine({
        start: { x: 45, y: yPos + 16 },
        end: { x: width - 45, y: yPos + 16 },
        thickness: 0.5,
        color: borderLight
      });

      page.drawText(sanitizeText(label), {
        x: 58,
        y: yPos + 3,
        size: 8.5,
        font: fontBold,
        color: isHighlight ? primaryColor : darkSlate
      });

      page.drawText(sanitizeText(value || 'Non spécifié'), {
        x: 210,
        y: yPos + 3,
        size: 8.5,
        font: fontRegular,
        color: isHighlight ? primaryColor : darkSlate
      });
    };

    let rowY = tableTop - 18;

    if (isMission) {
      const missionName = (missionOrder && (missionOrder.missionary_name || missionOrder.missionary_name_snapshot)) || doc.sender_name || 'Agent UK';
      const missionFunc = (missionOrder && (missionOrder.function_title || missionOrder.missionary_function_snapshot)) || 'Enseignant-Chercheur / Cadre';
      const destination = (missionOrder && missionOrder.destination) || 'Non spécifié';
      const dates = missionOrder ? `Du ${new Date(missionOrder.departure_date).toLocaleDateString('fr-FR')} au ${new Date(missionOrder.return_date).toLocaleDateString('fr-FR')}` : 'Dates non spécifiées';
      
      drawTableRow("Missionnaire / Demandeur :", missionName, rowY, true);
      rowY -= 22;
      drawTableRow("Fonction & Structure :", missionFunc, rowY);
      rowY -= 22;
      drawTableRow("Destination de la mission :", destination, rowY, true);
      rowY -= 22;
      drawTableRow("Période officielle :", dates, rowY);
      rowY -= 22;
      drawTableRow("Objet de la mission :", (doc.description || doc.title).slice(0, 55), rowY);
      rowY -= 22;
      drawTableRow("Moyen de transport :", (missionOrder && missionOrder.transport_mode) || 'Véhicule de service', rowY);
      rowY -= 22;
      drawTableRow("Service émetteur :", doc.creator_service_name || 'Secrétariat Central', rowY);
      rowY -= 22;
      drawTableRow("Agent opérateur :", `${doc.creator_first || ''} ${doc.creator_last || ''} ${doc.creator_matricule ? '(' + doc.creator_matricule + ')' : ''}`, rowY);
      rowY -= 22;
      drawTableRow("Statut initial :", "EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL", rowY, true);
    } else {
      const expediteur = `${doc.sender_name || 'Expéditeur Externe'} ${doc.sender_organization ? '(' + doc.sender_organization + ')' : ''}`;
      const destService = doc.current_service_name || 'Secrétariat Général';
      const dateReg = new Date(doc.created_at).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      drawTableRow("Date & Heure d'enregistrement :", `${dateReg}`, rowY, true);
      rowY -= 22;
      drawTableRow("Expéditeur / Provenance :", expediteur.slice(0, 55), rowY);
      rowY -= 22;
      drawTableRow("Objet du courrier :", (doc.title || doc.description || '').slice(0, 55), rowY, true);
      rowY -= 22;
      drawTableRow("Service destinataire initial :", destService, rowY);
      rowY -= 22;
      drawTableRow("Type & Nature de l'acte :", `${doc.document_type} • ${doc.confidentiality || 'INTERNE'}`, rowY);
      rowY -= 22;
      drawTableRow("Mode de traitement :", doc.processing_mode === 'DIRECT_ARCHIVE' ? 'Archivage Direct' : 'Circuit Normal (Transmission SG)', rowY);
      rowY -= 22;
      drawTableRow("Statut du document :", doc.status === 'ARCHIVED' || doc.processing_mode === 'DIRECT_ARCHIVE' ? 'DOCUMENT OFFICIEL ARCHIVÉ DIRECTEMENT' : 'EN COURS DE TRAITEMENT (TRANSMISSION SG)', rowY, true);
      rowY -= 22;
      drawTableRow("Service enregistreur :", doc.creator_service_name || 'Secrétariat Central', rowY);
      rowY -= 22;
      drawTableRow("Agent ayant enregistré :", `${doc.creator_first || ''} ${doc.creator_last || ''} ${doc.creator_matricule ? '(' + doc.creator_matricule + ')' : ''}`, rowY);
    }

    // 4.5 QR Code Section & Security Verification Notice
    currentY = tableTop - tableHeight - 25;

    // QR Code Box
    page.drawRectangle({
      x: 45,
      y: currentY - 145,
      width: width - 90,
      height: 145,
      color: bgLight,
      borderColor: goldColor,
      borderWidth: 1
    });

    // Embed QR Code Image in PDF
    const embeddedQR = await pdfDoc.embedPng(qrCodeBuffer);
    const qrSize = 115;
    page.drawImage(embeddedQR, {
      x: 60,
      y: currentY - 130,
      width: qrSize,
      height: qrSize
    });

    // QR Verification Text on Right of QR Code
    const textX = 195;
    page.drawText(sanitizeText("VÉRIFICATION NUMÉRIQUE D'AUTHENTICITÉ"), {
      x: textX,
      y: currentY - 25,
      size: 10,
      font: fontBold,
      color: primaryColor
    });

    page.drawText(sanitizeText("Ce reçu officiel constitue la preuve certifiée de l'enregistrement de votre document."), {
      x: textX,
      y: currentY - 42,
      size: 8,
      font: fontRegular,
      color: darkSlate
    });

    page.drawText(sanitizeText("Scannez ce QR Code avec tout smartphone ou rendez-vous sur :"), {
      x: textX,
      y: currentY - 58,
      size: 8,
      font: fontRegular,
      color: darkSlate
    });

    page.drawText(sanitizeText(verificationUrl), {
      x: textX,
      y: currentY - 74,
      size: 8,
      font: fontBold,
      color: primaryColor
    });

    page.drawText(sanitizeText("✓ Identifiant infalsifiable et sécurisé"), {
      x: textX,
      y: currentY - 94,
      size: 8,
      font: fontBold,
      color: rgb(22 / 255, 101 / 255, 52 / 255)
    });

    page.drawText(sanitizeText("✓ Suivi en temps réel de l'état d'avancement et des signatures"), {
      x: textX,
      y: currentY - 108,
      size: 8,
      font: fontBold,
      color: rgb(22 / 255, 101 / 255, 52 / 255)
    });

    page.drawText(sanitizeText("✓ Aucune authentification requise pour la vérification publique"), {
      x: textX,
      y: currentY - 122,
      size: 7.5,
      font: fontOblique,
      color: mutedGray
    });

    // 4.6 Footer & Legal Notice
    const footerY = 35;
    page.drawLine({
      start: { x: 45, y: footerY + 20 },
      end: { x: width - 45, y: footerY + 20 },
      thickness: 0.5,
      color: borderLight
    });

    const footerInst = "UNIVERSITÉ DE KINDIA • GESTION ÉLECTRONIQUE DES DOCUMENTS (UK-GED)";
    const footW = fontBold.widthOfTextAtSize(footerInst, 8);
    page.drawText(footerInst, {
      x: (width - footW) / 2,
      y: footerY + 8,
      size: 8,
      font: fontBold,
      color: primaryColor
    });

    const footerSub = "Document administratif officiel généré automatiquement • Système certifié conforme aux procédures académiques.";
    const footSubW = fontRegular.widthOfTextAtSize(footerSub, 7);
    page.drawText(footerSub, {
      x: (width - footSubW) / 2,
      y: footerY - 2,
      size: 7,
      font: fontRegular,
      color: mutedGray
    });

    // Save PDF Bytes
    const pdfBytes = await pdfDoc.save();
    const cleanRefFilename = doc.reference.replace(/[^a-zA-Z0-9-_]/g, '_');
    const pdfFileName = `receipt_${cleanRefFilename}_${Date.now()}.pdf`;
    const fullPdfPath = path.join(RECEIPTS_DIR, pdfFileName);
    const relativePdfPath = path.join('receipts', pdfFileName).replace(/\\/g, '/');

    fs.writeFileSync(fullPdfPath, pdfBytes);

    // 5. Store / Update in database
    const existingReceipt = await db.get('SELECT id FROM document_receipts WHERE document_id = ?', [documentId]);
    let receiptId;

    if (existingReceipt) {
      await db.run(
        `UPDATE document_receipts 
         SET receipt_number = ?, receipt_type = ?, file_path = ?, qr_code_data = ?, verification_url = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [receiptNumber, receiptType, relativePdfPath, qrCodeDataUrl, verificationUrl, existingReceipt.id]
      );
      receiptId = existingReceipt.id;
    } else {
      const insRes = await db.run(
        `INSERT INTO document_receipts (document_id, receipt_number, receipt_type, file_path, qr_code_data, verification_url, created_by, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'UNIVERSITE_KINDIA')`,
        [documentId, receiptNumber, receiptType, relativePdfPath, qrCodeDataUrl, verificationUrl, doc.created_by]
      );
      receiptId = insRes.lastID;
    }

    // 6. Log in document history and audit
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'RECEIPT_GENERATED', ?)`,
      [documentId, doc.created_by, doc.current_service_id, `Reçu officiel généré automatiquement avec QR Code [${receiptNumber}].`]
    );

    return {
      id: receiptId,
      receipt_id: receiptId,
      receipt_number: receiptNumber,
      receipt_type: receiptType,
      document_id: documentId,
      reference: doc.reference,
      tracking_token: doc.tracking_token,
      file_path: relativePdfPath,
      pdf_url: `/api/receipts/${receiptId}/pdf`,
      qr_code_data: qrCodeDataUrl,
      qr_code_data_url: qrCodeDataUrl,
      verification_url: verificationUrl
    };

  } catch (err) {
    console.error('Error generating official receipt:', err);
    throw err;
  }
}

module.exports = {
  generateAndStoreReceipt,
  getVerificationUrl,
  RECEIPTS_DIR
};
