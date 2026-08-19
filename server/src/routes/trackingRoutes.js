const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { TRACKING_STATUSES } = require('../config/constants');

/**
 * Helper to build the secure public tracking DTO for a document
 */
async function buildPublicTrackingDTO(doc) {
  // Current service name
  const currentService = await db.get('SELECT name, code FROM services WHERE id = ?', [doc.current_service_id]);
  const currentServiceName = currentService ? currentService.name : 'Service Administratif';

  // Creator service name
  const creatorUser = await db.get('SELECT service_id FROM users WHERE id = ?', [doc.created_by]);
  const creatorService = creatorUser ? await db.get('SELECT name FROM services WHERE id = ?', [creatorUser.service_id]) : null;
  const creatorServiceName = creatorService ? creatorService.name : 'Secrétariat Central';

  // Determine public tracking status & label
  let publicStatusKey = 'IN_PROGRESS';
  if (doc.status === 'CREATED' || doc.status === 'PENDING') {
    publicStatusKey = 'REGISTERED';
  } else if (doc.status === 'IN_PROGRESS') {
    publicStatusKey = 'IN_PROGRESS';
  } else if (doc.status === 'ACCEPTED' || doc.status === 'SIGNED') {
    publicStatusKey = 'ACCEPTED';
  } else if (doc.status === 'REJECTED') {
    publicStatusKey = 'REJECTED';
  } else if (doc.status === 'ARCHIVED') {
    publicStatusKey = 'ARCHIVED';
  }

  const statusConfig = TRACKING_STATUSES[publicStatusKey] || TRACKING_STATUSES.IN_PROGRESS;

  // Map document type label
  let typeLabel = 'Courrier';
  if (doc.document_type === 'INCOMING_MAIL') typeLabel = 'Courrier entrant';
  else if (doc.document_type === 'OUTGOING_MAIL') typeLabel = 'Courrier sortant';
  else if (doc.document_type === 'MISSION_ORDER') typeLabel = 'Ordre de mission';

  // Build anonymized progression timeline (without internal agent names or confidential notes)
  const transfers = await db.all(
    `SELECT dt.sent_at, fs.name as from_service_name, ts.name as to_service_name
     FROM document_transfers dt
     JOIN services fs ON dt.from_service_id = fs.id
     JOIN services ts ON dt.to_service_id = ts.id
     WHERE dt.document_id = ?
     ORDER BY dt.sent_at ASC`,
    [doc.id]
  );

  const progression = [
    {
      step: 1,
      label: 'Document enregistré',
      service: creatorServiceName,
      is_completed: true,
      is_current: transfers.length === 0 && doc.status !== 'ARCHIVED'
    }
  ];

  transfers.forEach((tr, idx) => {
    const isLast = idx === transfers.length - 1;
    progression.push({
      step: idx + 2,
      label: `Transmis à ${tr.to_service_name}`,
      service: tr.to_service_name,
      is_completed: !isLast || doc.status === 'ACCEPTED' || doc.status === 'SIGNED' || doc.status === 'ARCHIVED',
      is_current: isLast && doc.status === 'IN_PROGRESS'
    });
  });

  if (doc.status === 'ACCEPTED' || doc.status === 'SIGNED') {
    progression.push({
      step: progression.length + 1,
      label: doc.document_type === 'MISSION_ORDER' ? 'Ordre de mission signé' : 'Traitement finalisé / Accepté',
      service: currentServiceName,
      is_completed: true,
      is_current: doc.status !== 'ARCHIVED'
    });
  } else if (doc.status === 'REJECTED') {
    progression.push({
      step: progression.length + 1,
      label: 'Traitement interrompu - Document rejeté',
      service: currentServiceName,
      is_completed: true,
      is_current: true
    });
  }

  if (doc.status === 'ARCHIVED') {
    progression.push({
      step: progression.length + 1,
      label: 'Archivé aux archives électroniques',
      service: 'Service des Archives',
      is_completed: true,
      is_current: true
    });
  }

  // Format Dates
  const createdDate = new Date(doc.created_at).toLocaleDateString('fr-FR');
  const updatedDate = new Date(doc.updated_at).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return {
    found: true,
    reference: doc.reference,
    tracking_token: doc.tracking_token || null,
    document_type: doc.document_type,
    document_type_label: typeLabel,
    title: doc.title,
    deposit_date: createdDate,
    status_code: publicStatusKey,
    status_label: statusConfig.label,
    status_emoji: statusConfig.emoji,
    status_color: statusConfig.color,
    current_level: currentServiceName,
    last_update: updatedDate,
    progression,
    is_rejected: doc.status === 'REJECTED',
    rejection_info: doc.status === 'REJECTED' ? {
      message: 'Votre document a été rejeté. Une action complémentaire ou une correction est requise.',
      date: doc.rejected_at ? new Date(doc.rejected_at).toLocaleDateString('fr-FR') : updatedDate
    } : null
  };
}

// GET /api/tracking/document/:reference - Public Tracking by Reference
router.get('/document/:reference', async (req, res) => {
  const rawRef = req.params.reference;
  if (!rawRef || !rawRef.trim()) {
    return res.status(400).json({ found: false, error: 'Référence du document manquante.' });
  }

  const cleanRef = decodeURIComponent(rawRef.trim().toUpperCase());

  try {
    const doc = await db.get(
      'SELECT * FROM documents WHERE (UPPER(reference) = ? OR tracking_token = ?) AND status != "TRASHED"',
      [cleanRef, cleanRef]
    );

    if (!doc) {
      return res.status(404).json({
        found: false,
        error: 'Document introuvable. Veuillez vérifier la référence ou scanner à nouveau le QR Code.'
      });
    }

    const publicDto = await buildPublicTrackingDTO(doc);
    res.json(publicDto);
  } catch (err) {
    console.error('Public tracking error:', err);
    res.status(500).json({ found: false, error: 'Erreur lors de la recherche du document.' });
  }
});

// POST /api/tracking/scan - Public QR Code Scan
router.post('/scan', async (req, res) => {
  const { qr_data, reference, token } = req.body;
  const inputQuery = qr_data || reference || token;

  if (!inputQuery) {
    return res.status(400).json({ found: false, error: 'Données du QR Code ou référence manquante.' });
  }

  try {
    let cleanRef = String(inputQuery).trim();
    
    // Extract reference from full URL if QR contains URL like http://localhost:5000/verify/UK%2FSC%2FCE%2F2026%2F000245
    if (cleanRef.includes('/verify/')) {
      const parts = cleanRef.split('/verify/');
      cleanRef = decodeURIComponent(parts[1]);
    } else if (cleanRef.includes('/suivi-document?ref=')) {
      const parts = cleanRef.split('/suivi-document?ref=');
      cleanRef = decodeURIComponent(parts[1]);
    }

    cleanRef = cleanRef.toUpperCase();

    const doc = await db.get(
      'SELECT * FROM documents WHERE (UPPER(reference) = ? OR tracking_token = ? OR qr_code_hash = ?) AND status != "TRASHED"',
      [cleanRef, cleanRef, cleanRef]
    );

    if (!doc) {
      return res.status(404).json({
        found: false,
        error: 'QR Code invalide ou expiré. Aucun document correspondant n’a été trouvé.'
      });
    }

    const publicDto = await buildPublicTrackingDTO(doc);
    res.json(publicDto);
  } catch (err) {
    console.error('QR scan tracking error:', err);
    res.status(500).json({ found: false, error: 'Erreur lors du traitement du QR Code.' });
  }
});

// Block state mutation on public tracking route (Read-Only Safety Rule)
router.put('/document/*', (req, res) => {
  res.status(405).json({ error: 'L’API de suivi est strictement en lecture seule. Modification interdite.' });
});
router.post('/document/*', (req, res) => {
  res.status(405).json({ error: 'L’API de suivi est strictement en lecture seule. Modification interdite.' });
});

module.exports = router;
