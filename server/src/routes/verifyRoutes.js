const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET /api/verify/:reference - Public Verification Endpoint (No authentication required)
router.get('/:reference', async (req, res) => {
  const rawRef = req.params.reference;
  if (!rawRef || !rawRef.trim()) {
    return res.status(400).json({
      valid: false,
      status: 'NOT_FOUND',
      message: 'Référence du document manquante.'
    });
  }

  let cleanRef = decodeURIComponent(rawRef.trim());
  if (cleanRef.includes('/verify/')) {
    cleanRef = cleanRef.split('/verify/')[1];
  }

  try {
    // 1. Search document in database
    const doc = await db.get(
      `SELECT d.id, d.reference, d.document_type, d.title, d.status, d.created_at, d.updated_at, d.archived_at, d.is_locked, d.qr_code_hash, d.tracking_token,
              s.name as service_name,
              r.receipt_number, r.created_at as receipt_date
       FROM documents d
       LEFT JOIN services s ON d.current_service_id = s.id
       LEFT JOIN document_receipts r ON d.id = r.document_id
       WHERE UPPER(d.reference) = UPPER(?) 
          OR d.tracking_token = ? 
          OR (r.receipt_number IS NOT NULL AND UPPER(r.receipt_number) = UPPER(?))`,
      [cleanRef, cleanRef, cleanRef]
    );

    let targetDoc = doc;
    if (!targetDoc) {
      const reqRow = await db.get('SELECT * FROM mission_order_requests WHERE UPPER(reference) = ?', [cleanRef]);
      if (reqRow && reqRow.official_document_id) {
        targetDoc = await db.get(
          `SELECT d.id, d.reference, d.document_type, d.title, d.status, d.created_at, d.updated_at, d.archived_at, d.is_locked, d.qr_code_hash, d.tracking_token,
                  s.name as service_name,
                  r.receipt_number, r.created_at as receipt_date
           FROM documents d
           LEFT JOIN services s ON d.current_service_id = s.id
           LEFT JOIN document_receipts r ON d.id = r.document_id
           WHERE d.id = ?`,
          [reqRow.official_document_id]
        );
      } else if (reqRow) {
        return res.status(200).json({
          valid: true,
          status: 'REGISTERED',
          status_label: 'Demande d’ordre de mission enregistrée (Secrétariat Central)',
          reference: reqRow.reference,
          type: 'DEMANDE_ORDRE_MISSION',
          type_label: 'Demande d’ordre de mission',
          title: `Demande d’ordre de mission : ${reqRow.applicant_last_name} ${reqRow.applicant_first_names}`,
          service: reqRow.applicant_service_name || 'Secrétariat Central',
          created_at: reqRow.created_at,
          verification_date: new Date().toISOString()
        });
      }
    }

    if (!targetDoc) {
      return res.status(404).json({
        valid: false,
        status: 'NOT_FOUND',
        title: 'DOCUMENT INTROUVABLE',
        message: 'Cette référence ne correspond à aucun document enregistré dans le registre officiel UK-GED de l’Université de Kindia.'
      });
    }

    const activeDoc = targetDoc;

    // 2. Check if document was trashed or cancelled
    if (activeDoc.status === 'TRASHED' || activeDoc.status === 'CANCELLED') {
      return res.status(200).json({
        valid: false,
        status: 'INVALID',
        title: 'DOCUMENT NON VALIDE',
        message: 'Ce document a été invalidé ou retiré du registre officiel de l’Université de Kindia.',
        reference: activeDoc.reference,
        type: activeDoc.document_type
      });
    }

    // 3. Determine real-time human-readable status
    let currentStatusLabel = 'Enregistré';
    const s = (activeDoc.status || '').toUpperCase();
    
    if (s === 'ARCHIVED' || s === 'ARCHIVÉ') {
      currentStatusLabel = 'Archivé aux archives électroniques';
    } else if (s === 'SIGNED' || s === 'SIGNÉ' || s === 'ACCEPTED' || s === 'ACCEPTE') {
      currentStatusLabel = activeDoc.document_type === 'MISSION_ORDER' ? 'Signé par le Secrétaire Général' : 'Validé et Accepté';
    } else if (s === 'IN_PROGRESS' || s === 'EN COURS') {
      currentStatusLabel = 'En cours de traitement administratif';
    } else if (s === 'REJECTED' || s === 'REJETÉ') {
      currentStatusLabel = 'Rejeté';
    } else if (activeDoc.document_type === 'MISSION_ORDER') {
      currentStatusLabel = 'En attente de signature';
    } else {
      currentStatusLabel = 'Enregistré au Secrétariat Central';
    }

    // Type label
    let typeLabel = 'Document Administratif';
    if (activeDoc.document_type === 'INCOMING_MAIL' || activeDoc.document_type === 'COURRIER_ENTRANT') {
      typeLabel = 'Courrier entrant';
    } else if (activeDoc.document_type === 'OUTGOING_MAIL' || activeDoc.document_type === 'COURRIER_SORTANT') {
      typeLabel = 'Courrier sortant';
    } else if (activeDoc.document_type === 'MISSION_ORDER' || activeDoc.document_type === 'ORDRE_MISSION') {
      typeLabel = 'Ordre de mission';
    } else if (activeDoc.document_type === 'NOTE_SERVICE') {
      typeLabel = 'Note de service';
    }

    // Mission details if applicable
    let missionDetails = null;
    if (activeDoc.document_type === 'MISSION_ORDER') {
      const mo = await db.get(
        `SELECT missionary_name, destination, departure_date, return_date, is_signed, signed_at,
                missionary_name_snapshot, destination as dest_snap
         FROM mission_orders WHERE document_id = ?`,
        [activeDoc.id]
      );
      if (mo) {
        missionDetails = {
          missionary_name: mo.missionary_name || mo.missionary_name_snapshot || 'Personnel UK',
          destination: mo.destination || 'Guinée',
          departure_date: mo.departure_date ? new Date(mo.departure_date).toLocaleDateString('fr-FR') : null,
          return_date: mo.return_date ? new Date(mo.return_date).toLocaleDateString('fr-FR') : null,
          is_signed: mo.is_signed === 1 || s === 'SIGNED' || s === 'SIGNÉ' || s === 'ARCHIVED',
          signed_at: mo.signed_at ? new Date(mo.signed_at).toLocaleDateString('fr-FR') : null
        };
      }
    }

    // 4. Return secure public verification payload (No confidential content)
    res.json({
      valid: true,
      status: 'AUTHENTIC',
      title: 'DOCUMENT AUTHENTIQUE',
      message: 'Document officiel authentifié et enregistré dans le registre UK-GED.',
      institution: 'UNIVERSITÉ DE KINDIA',
      reference: activeDoc.reference,
      receipt_number: activeDoc.receipt_number || null,
      document_type: activeDoc.document_type,
      document_type_label: typeLabel,
      object_title: activeDoc.title,
      registration_date: new Date(activeDoc.created_at).toLocaleDateString('fr-FR'),
      registration_time: new Date(activeDoc.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      current_status: currentStatusLabel,
      raw_status: activeDoc.status,
      current_service: activeDoc.service_name || 'Secrétariat Central',
      mission: missionDetails,
      is_archived: s === 'ARCHIVED' || s === 'ARCHIVÉ',
      is_signed: s === 'SIGNED' || s === 'SIGNÉ' || (missionDetails && missionDetails.is_signed)
    });

  } catch (err) {
    console.error('Public verification error:', err);
    res.status(500).json({
      valid: false,
      status: 'ERROR',
      message: 'Erreur lors de la vérification du document.'
    });
  }
});

module.exports = router;
