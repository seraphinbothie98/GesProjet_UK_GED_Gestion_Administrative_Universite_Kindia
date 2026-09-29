const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { formatFullName } = require('../utils/userUtils');

// Helper to ensure verification logs table exists
let tableChecked = false;
async function ensureVerificationLogsTable() {
  if (tableChecked) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS mission_verification_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        token TEXT,
        scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_hash TEXT,
        user_agent TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_mvl_doc_id ON mission_verification_logs(document_id);
      CREATE INDEX IF NOT EXISTS idx_mvl_token ON mission_verification_logs(token);
    `);
    tableChecked = true;
  } catch (err) {
    console.warn('Could not initialize mission_verification_logs table:', err.message);
  }
}

/**
 * Core verification resolver for mission orders and general documents
 */
async function resolveVerification(tokenOrRef, req) {
  await ensureVerificationLogsTable();

  if (!tokenOrRef || !tokenOrRef.trim()) {
    return {
      status_code: 400,
      payload: {
        valid: false,
        status: 'NOT_FOUND',
        title: 'IDENTIFIANT MANQUANT',
        message: 'L’identifiant ou le token de vérification est manquant.'
      }
    };
  }

  let cleanKey = decodeURIComponent(tokenOrRef.trim());
  if (cleanKey.includes('/verification/ordre-mission/')) {
    cleanKey = cleanKey.split('/verification/ordre-mission/')[1];
  } else if (cleanKey.includes('/verify/')) {
    cleanKey = cleanKey.split('/verify/')[1];
  }

  // 1. Search document by tracking_token, verification_token, reference, or receipt_number
  const doc = await db.get(
    `SELECT d.id, d.reference, d.document_type, d.title, d.status, d.created_at, d.updated_at, d.archived_at, d.is_locked, d.qr_code_hash, d.tracking_token,
            s.name as service_name, s.code as service_code,
            r.receipt_number, r.created_at as receipt_date
     FROM documents d
     LEFT JOIN services s ON d.current_service_id = s.id
     LEFT JOIN document_receipts r ON d.id = r.document_id
     WHERE d.tracking_token = ? 
        OR UPPER(d.reference) = UPPER(?) 
        OR (r.receipt_number IS NOT NULL AND UPPER(r.receipt_number) = UPPER(?))
     ORDER BY d.id DESC LIMIT 1`,
    [cleanKey, cleanKey, cleanKey]
  );

  let targetDoc = doc;

  // Fallback to mission_order_requests if applicable
  if (!targetDoc) {
    const reqRow = await db.get(
      `SELECT * FROM mission_order_requests WHERE tracking_token = ? OR UPPER(reference) = ? LIMIT 1`,
      [cleanKey, cleanKey]
    );
    if (reqRow && reqRow.official_document_id) {
      targetDoc = await db.get(
        `SELECT d.id, d.reference, d.document_type, d.title, d.status, d.created_at, d.updated_at, d.archived_at, d.is_locked, d.qr_code_hash, d.tracking_token,
                s.name as service_name, s.code as service_code,
                r.receipt_number, r.created_at as receipt_date
         FROM documents d
         LEFT JOIN services s ON d.current_service_id = s.id
         LEFT JOIN document_receipts r ON d.id = r.document_id
         WHERE d.id = ?`,
        [reqRow.official_document_id]
      );
    } else if (reqRow) {
      // Pending request status
      return {
        status_code: 200,
        payload: {
          valid: true,
          status: 'REGISTERED',
          title: 'DEMANDE ENREGISTRÉE',
          message: 'Demande d’ordre de mission enregistrée au Secrétariat Central (en cours de traitement).',
          reference: reqRow.reference,
          document_type: 'DEMANDE_ORDRE_MISSION',
          document_type_label: 'Demande d’ordre de mission',
          identite: {
            nom_complet: formatFullName({
              titre: reqRow.applicant_titre || 'M.',
              first_name: reqRow.applicant_first_names,
              last_name: reqRow.applicant_last_name
            }),
            fonction: reqRow.applicant_function || 'Personnel UK',
            structure: reqRow.applicant_service_name || 'Université de Kindia',
            matricule: reqRow.applicant_matricule || '—'
          },
          mission: {
            objet_mission: reqRow.object_of_mission || '—',
            destination: reqRow.destination || 'Guinée',
            date_depart: reqRow.start_date ? new Date(reqRow.start_date).toLocaleDateString('fr-FR') : '—',
            date_retour: reqRow.end_date ? new Date(reqRow.end_date).toLocaleDateString('fr-FR') : '—'
          },
          document: {
            reference: reqRow.reference,
            date_emission: new Date(reqRow.created_at).toLocaleDateString('fr-FR'),
            service_emetteur: 'Secrétariat Central',
            statut_actuel: reqRow.status || 'Enregistrée'
          },
          verification_date: new Date().toISOString()
        }
      };
    }
  }

  // ÉTAT 2 — DOCUMENT NON RECONNU
  if (!targetDoc) {
    return {
      status_code: 404,
      payload: {
        valid: false,
        status: 'NOT_FOUND',
        title: 'DOCUMENT NON RECONNU',
        message: 'Ce QR Code ou identifiant de vérification ne correspond à aucun document officiel enregistré dans le registre UK-GED de l’Université de Kindia.',
        verification_date: new Date().toISOString()
      }
    };
  }

  const activeDoc = targetDoc;
  const rawStatus = (activeDoc.status || '').toUpperCase();

  // Log scan event safely (no intrusive phone data)
  try {
    const userAgent = (req?.headers['user-agent'] || '').substring(0, 100);
    const ip = req?.ip || req?.connection?.remoteAddress || '127.0.0.1';
    await db.run(
      `INSERT INTO mission_verification_logs (document_id, token, scanned_at, ip_hash, user_agent)
       VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      [activeDoc.id, cleanKey, ip, userAgent]
    );
  } catch (logErr) {
    console.warn('Scan logging error:', logErr.message);
  }

  // Fetch scan count
  let totalScans = 1;
  try {
    const countRow = await db.get(
      `SELECT COUNT(*) as count FROM mission_verification_logs WHERE document_id = ?`,
      [activeDoc.id]
    );
    if (countRow) totalScans = countRow.count;
  } catch (cErr) {
    // ignore
  }

  // ÉTAT 3 — DOCUMENT ANNULÉ
  if (rawStatus === 'CANCELLED' || rawStatus === 'ANNULÉ' || rawStatus === 'TRASHED' || rawStatus === 'REJETÉ' || rawStatus === 'REJECTED') {
    return {
      status_code: 200,
      payload: {
        valid: false,
        status: 'CANCELLED',
        title: 'DOCUMENT ANNULÉ',
        message: 'Cet Ordre de Mission a été annulé ou invalidé. Il n’est plus en vigueur.',
        reference: activeDoc.reference,
        document_type: activeDoc.document_type,
        cancellation_date: new Date(activeDoc.updated_at || activeDoc.created_at).toLocaleDateString('fr-FR'),
        verification_date: new Date().toISOString()
      }
    };
  }

  // Determine real-time human-readable status
  let currentStatusLabel = 'Document Officiel Valide';
  const isSigned = rawStatus.includes('SIGNÉ') || rawStatus.includes('SIGNED') || rawStatus.includes('RETOUR AU SECRÉTARIAT CENTRAL') || rawStatus === 'ARCHIVED' || rawStatus === 'ARCHIVÉ' || rawStatus === 'REMIS AU DEMANDEUR';
  const isArchived = rawStatus === 'ARCHIVED' || rawStatus === 'ARCHIVÉ';

  if (isArchived) {
    currentStatusLabel = 'Archivé aux archives électroniques officielles';
  } else if (isSigned) {
    currentStatusLabel = 'Signé par le Secrétaire Général et Scellé';
  } else if (rawStatus === 'PENDING' || rawStatus === 'EN_ATTENTE' || rawStatus.includes('EN ATTENTE DE SIGNATURE')) {
    currentStatusLabel = 'En attente de signature officielle';
  } else {
    currentStatusLabel = 'Enregistré au registre UK-GED';
  }

  // Fetch detailed mission information if applicable
  let missionDetails = null;
  let identityDetails = null;
  let transportDetails = null;
  let documentMeta = null;

  const isMissionType = activeDoc.document_type === 'MISSION_ORDER' || 
                        activeDoc.document_type === 'ORDRE_MISSION' || 
                        activeDoc.document_type === 'ORDRE_DE_MISSION' ||
                        (activeDoc.document_type && activeDoc.document_type.includes('MISSION'));

  if (isMissionType) {
    const mo = await db.get(
      `SELECT mo.*,
              st.titre as staff_titre, st.nom as staff_nom, st.prenoms as staff_prenoms, st.matricule as staff_matricule, st.fonction as staff_fonction, st.telephone as staff_phone,
              u_signer.first_name as signer_first, u_signer.last_name as signer_last, u_signer.function_title as signer_function
       FROM mission_orders mo
       LEFT JOIN staff st ON mo.missionary_id = st.id
       LEFT JOIN users u_signer ON mo.signed_by_user_id = u_signer.id
       WHERE mo.document_id = ?`,
      [activeDoc.id]
    );

    if (mo) {
      // 1. Identité (strictly formatted: [Titre] [Prénoms] [NOM])
      const missionaryTitre = mo.missionary_title_snapshot || mo.staff_titre || '';
      const missionaryFirst = mo.missionary_firstnames_snapshot || mo.staff_prenoms || '';
      const missionaryLast = mo.missionary_name_snapshot || mo.staff_nom || mo.missionary_name || '';
      const formattedName = formatFullName({
        titre: missionaryTitre,
        first_name: missionaryFirst,
        last_name: missionaryLast
      }, mo.missionary_name || 'Personnel Université de Kindia');

      identityDetails = {
        nom_complet: formattedName,
        fonction: mo.missionary_function_snapshot || mo.staff_fonction || mo.function_title || 'Personnel Universitaire',
        structure: mo.missionary_service_snapshot || mo.faculty_dept || activeDoc.service_name || 'Université de Kindia',
        matricule: mo.missionary_matricule_snapshot || mo.staff_matricule || '—',
        nationalite: mo.nationality || 'Guinéenne'
      };

      // 2. Mission
      let departureFormatted = mo.departure_date ? new Date(mo.departure_date).toLocaleDateString('fr-FR') : '—';
      let returnFormatted = mo.return_date ? new Date(mo.return_date).toLocaleDateString('fr-FR') : 'Fin de mission';

      let dureeJours = null;
      if (mo.departure_date && mo.return_date) {
        const d1 = new Date(mo.departure_date);
        const d2 = new Date(mo.return_date);
        const diffTime = Math.abs(d2 - d1);
        dureeJours = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }

      missionDetails = {
        objet_mission: mo.object_of_mission || activeDoc.title || 'Mission officielle',
        destination: mo.destination || 'Guinée',
        date_depart: departureFormatted,
        date_retour: returnFormatted,
        duree_jours: dureeJours ? `${dureeJours} jour(s)` : null,
        observations: mo.observations || null
      };

      // 3. Transport
      const rawTransport = mo.transport_mode || 'Véhicule service/Personnel';
      const regNumber = mo.vehicle_registration_snapshot || mo.vehicle_registration || null;
      const driverName = (mo.driver_option === 'SELF' || !mo.driver_name || mo.driver_name === 'Lui-même' || mo.driver_name === 'Lui-même / Autonome') 
        ? 'Lui-même' 
        : mo.driver_name;

      transportDetails = {
        moyen_transport: rawTransport,
        immatriculation: regNumber || 'Non spécifiée / Transport public',
        chauffeur: driverName
      };

      // 4. Signataire
      const signerFullName = mo.signer_first ? `${mo.signer_first} ${mo.signer_last}`.trim() : 'Dr Mamadou Billo DOUMBOUYA';
      const signerRole = mo.signer_function || 'Secrétaire Général de l’Université de Kindia';

      documentMeta = {
        reference: activeDoc.reference,
        date_emission: new Date(activeDoc.created_at).toLocaleDateString('fr-FR'),
        date_signature: mo.signed_at ? new Date(mo.signed_at).toLocaleDateString('fr-FR') : (isSigned ? new Date(activeDoc.updated_at).toLocaleDateString('fr-FR') : null),
        heure_signature: mo.signed_at ? new Date(mo.signed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null,
        service_emetteur: 'Secrétariat Central',
        signataire_nom: signerFullName,
        signataire_role: signerRole,
        statut_actuel: currentStatusLabel,
        is_signed: Boolean(isSigned || mo.is_signed === 1),
        is_archived: isArchived
      };
    }
  }

  // Fallback for general administrative documents if not a mission order
  if (!identityDetails) {
    identityDetails = {
      nom_complet: activeDoc.sender_name || 'Secrétariat Central',
      fonction: 'Administration UK',
      structure: activeDoc.service_name || 'Université de Kindia',
      matricule: '—'
    };
  }

  if (!missionDetails) {
    missionDetails = {
      objet_mission: activeDoc.title || 'Document administratif officiel',
      destination: 'Université de Kindia',
      date_depart: new Date(activeDoc.created_at).toLocaleDateString('fr-FR'),
      date_retour: '—'
    };
  }

  if (!transportDetails) {
    transportDetails = {
      moyen_transport: 'N/A',
      immatriculation: 'N/A',
      chauffeur: 'N/A'
    };
  }

  if (!documentMeta) {
    documentMeta = {
      reference: activeDoc.reference,
      date_emission: new Date(activeDoc.created_at).toLocaleDateString('fr-FR'),
      service_emetteur: activeDoc.service_name || 'Secrétariat Central',
      statut_actuel: currentStatusLabel,
      is_signed: isSigned,
      is_archived: isArchived
    };
  }

  // ÉTAT 1 — DOCUMENT AUTHENTIQUE
  return {
    status_code: 200,
    payload: {
      valid: true,
      status: 'AUTHENTIC',
      title: 'DOCUMENT AUTHENTIQUE',
      message: 'Cet Ordre de Mission est certifié et authentifié dans le registre officiel UK-GED de l’Université de Kindia.',
      institution: 'UNIVERSITÉ DE KINDIA',
      ministere: 'Ministère de l’Enseignement Supérieur, de la Recherche Scientifique et de l’Innovation',
      reference: activeDoc.reference,
      document_type: activeDoc.document_type,
      document_type_label: 'Ordre de Mission Officiel',
      identite: identityDetails,
      mission: missionDetails,
      transport: transportDetails,
      document: documentMeta,
      verification: {
        verified_at: new Date().toISOString(),
        verified_at_formatted: `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
        total_scans: totalScans
      }
    }
  };
}

// GET /api/verify/mission/:token - Dedicated Public Mission Order Verification Endpoint
router.get('/mission/:token', async (req, res) => {
  try {
    const result = await resolveVerification(req.params.token, req);
    res.status(result.status_code).json(result.payload);
  } catch (err) {
    console.error('Dedicated mission verification error:', err);
    res.status(500).json({
      valid: false,
      status: 'ERROR',
      title: 'ERREUR DE VÉRIFICATION',
      message: 'Une erreur est survenue lors de la vérification du document.'
    });
  }
});

// GET /api/verify/:reference - General Public Verification Endpoint
router.get('/:reference', async (req, res) => {
  try {
    const result = await resolveVerification(req.params.reference, req);
    res.status(result.status_code).json(result.payload);
  } catch (err) {
    console.error('Public verification error:', err);
    res.status(500).json({
      valid: false,
      status: 'ERROR',
      title: 'ERREUR DE VÉRIFICATION',
      message: 'Une erreur est survenue lors de la vérification du document.'
    });
  }
});

module.exports = router;
