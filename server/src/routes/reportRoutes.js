const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { buildABACDocumentFilter } = require('../middleware/abac');

// GET /api/reports/dashboard - Role-tailored dashboard metrics and Central Secretariat active tracking
router.get('/dashboard', authenticateToken, async (req, res) => {
  const user = req.user;
  const isSC = user.role_code === 'ADMINISTRATEUR' || user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || user.role_code === 'AGENT_SC' || user.service_code === 'SC';

  try {
    const { sql: abacSql, params: abacParams } = buildABACDocumentFilter(user);

    // Document counters under ABAC (excluding TRASHED documents)
    const totalAccessible = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d WHERE d.status != 'TRASHED' AND ${abacSql}`,
      abacParams
    );

    const pendingDocs = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
       WHERE d.status IN ('PENDING', 'EN_ATTENTE', 'DEMANDE REÇUE', 'EN PRÉPARATION', 'EN ATTENTE DE SIGNATURE', 'ENREGISTRÉ', 'CREATED', 'DRAFT', 'EN ATTENTE D''ORIENTATION', 'EN ATTENTE DE TRAITEMENT', 'ORIENTÉ') 
         AND d.status != 'TRASHED' AND ${abacSql}`,
      abacParams
    );

    const inProgressDocs = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
       WHERE d.status IN ('IN_PROGRESS', 'EN_COURS', 'EN COURS DE TRAITEMENT', 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE') 
         AND d.status != 'TRASHED' AND ${abacSql}`,
      abacParams
    );

    const signedDocs = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
       WHERE d.status IN ('SIGNED', 'SIGNÉ', 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL', 'REMIS AU DEMANDEUR', 'REMIS AU MISSIONNAIRE', 'PRÊT POUR ARCHIVAGE DIRECT') 
         AND d.status != 'TRASHED' AND ${abacSql}`,
      abacParams
    );

    const archivedDocs = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
       WHERE d.status IN ('ARCHIVED', 'ARCHIVÉ') 
         AND d.status != 'TRASHED' AND ${abacSql}`,
      abacParams
    );

    // Overdue items
    const today = new Date().toISOString().split('T')[0];
    const overdueDocs = await db.get(
      `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
       WHERE d.deadline_date < ? 
         AND d.status NOT IN ('SIGNED', 'SIGNÉ', 'ARCHIVED', 'ARCHIVÉ', 'TRASHED', 'REMIS AU DEMANDEUR', 'REMIS AU MISSIONNAIRE', 'TRAITÉ', 'CLÔTURÉ') 
         AND d.status != 'TRASHED' 
         AND ${abacSql}`,
      [today, ...abacParams]
    );

    // System-wide admin counts if role is Admin
    let adminStats = null;
    if (user.role_code === 'ADMINISTRATEUR') {
      const userCount = await db.get('SELECT COUNT(*) as count FROM users');
      const serviceCount = await db.get('SELECT COUNT(*) as count FROM services WHERE status = "ACTIVE"');
      const auditCount = await db.get('SELECT COUNT(*) as count FROM audit_logs');
      adminStats = {
        total_users: userCount ? userCount.count : 0,
        active_services: serviceCount ? serviceCount.count : 0,
        audit_events: auditCount ? auditCount.count : 0
      };
    }

    // Generic Responsable Signature/Validation Stats for ANY logged in user/service head
    const docsToSignCount = await db.get(
      `SELECT COUNT(*) as count 
       FROM documents d 
       WHERE d.current_service_id = ? 
         AND d.is_locked = 0 
         AND d.status NOT IN ('SIGNÉ', 'SIGNED', 'ARCHIVED', 'ARCHIVÉ', 'TRASHED', 'ACCEPTED', 'ACCEPTE', 'REJECTED', 'REJETÉ', 'RETOURNÉ AU SECRÉTARIAT CENTRAL', 'REMIS AU DEMANDEUR', 'REMIS AU MISSIONNAIRE', 'TRAITÉ', 'CLÔTURÉ')`,
      [user.service_id]
    );

    const toSignCount = docsToSignCount ? docsToSignCount.count : 0;
    const sgStats = { missions_to_sign: toSignCount };

    // =========================================================================
    // DEDICATED SECRÉTARIAT CENTRAL KPIS & ACTIVE TRACKING
    // =========================================================================
    let scStats = null;
    if (isSC) {
      // 1. Mission requests pending
      const pendingReqs = await db.get(
        `SELECT COUNT(*) as count FROM mission_order_requests WHERE status IN ('EN_ATTENTE_SC', 'DEMANDE ENREGISTRÉE', 'EN ATTENTE', 'DEMANDE REÇUE')`
      );

      // 2. Incoming mail pending action / orientation / treatment
      const pendingIncomingMail = await db.get(
        `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
         WHERE d.document_type IN ('INCOMING_MAIL', 'COURRIER_ENTRANT') 
           AND d.status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'TRASHED', 'TRAITÉ', 'CLÔTURÉ', 'SIGNÉ', 'SIGNED')`
      );

      // 3. Internal mission orders pending
      const pendingInternalMissions = await db.get(
        `SELECT (
           (SELECT COUNT(DISTINCT d.id) FROM documents d WHERE d.document_type IN ('MISSION_ORDER', 'ORDRE_MISSION') AND d.status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'TRASHED', 'TRAITÉ', 'CLÔTURÉ', 'SIGNÉ', 'SIGNED'))
           +
           (SELECT COUNT(*) FROM mission_order_requests WHERE status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'REJETÉ', 'REJETÉE') AND (official_document_id IS NULL OR official_document_id NOT IN (SELECT id FROM documents WHERE status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'TRASHED', 'TRAITÉ', 'CLÔTURÉ', 'SIGNÉ', 'SIGNED'))))
         ) as count`
      );

      // 4. External mission orders active / pending action
      const pendingExternalMissions = await db.get(
        `SELECT COUNT(*) as count FROM external_missionaries 
         WHERE status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'REJETÉ PAR LE SECRÉTAIRE GÉNÉRAL')`
      );

      // 5. Administrative requests pending
      const pendingAdministrativeRequests = await db.get(
        `SELECT COUNT(DISTINCT d.id) as count FROM documents d 
         WHERE d.document_type IN ('DEMANDE', 'DEMANDE_ADMINISTRATIVE') 
           AND d.status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'TRASHED', 'TRAITÉ', 'CLÔTURÉ', 'SIGNÉ', 'SIGNED')`
      );

      // 6. Documents pending official signature
      const pendingSignaturesTotal = await db.get(
        `SELECT (
           (SELECT COUNT(DISTINCT d.id) FROM documents d WHERE d.status IN ('EN ATTENTE DE SIGNATURE', 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE', 'EN_ATTENTE_SIGNATURE') AND d.status != 'TRASHED')
           +
           (SELECT COUNT(*) FROM external_missionaries WHERE status IN ('ARRIVÉE ENREGISTRÉE – EN ATTENTE DE SIGNATURE DU SG', 'DÉPART ENREGISTRÉ – EN ATTENTE DE SIGNATURE DU SG', 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE'))
           +
           (SELECT COUNT(*) FROM mission_order_requests WHERE status IN ('EN ATTENTE DE SIGNATURE DU SECRÉTAIRE GÉNÉRAL') AND (official_document_id IS NULL OR official_document_id NOT IN (SELECT id FROM documents WHERE status != 'TRASHED')))
         ) as count`
      );

      // 7. Total active dossiers requiring action (deduplicated)
      const totalActiveDossiersCount = (pendingIncomingMail?.count || 0) + 
                                       (pendingInternalMissions?.count || 0) + 
                                       (pendingExternalMissions?.count || 0) + 
                                       (pendingAdministrativeRequests?.count || 0);

      scStats = {
        mission_requests_pending: pendingReqs ? pendingReqs.count : 0,
        pending_incoming_mail: pendingIncomingMail ? pendingIncomingMail.count : 0,
        pending_internal_missions: pendingInternalMissions ? pendingInternalMissions.count : 0,
        pending_external_missions: pendingExternalMissions ? pendingExternalMissions.count : 0,
        pending_requests: pendingAdministrativeRequests ? pendingAdministrativeRequests.count : 0,
        pending_signatures: pendingSignaturesTotal ? pendingSignaturesTotal.count : 0,
        pending_processing: totalActiveDossiersCount
      };
    }

    // =========================================================================
    // UNIFIED ACTIVE DOSSIERS LIST (« DERNIERS DOCUMENTS & ORIENTATION »)
    // =========================================================================
    const ACTION_LABELS = {
      'SUBMIT_REQUEST': "Demande d'ordre de mission déposée",
      'REQUEST_COMPLEMENT': "Compléments d'informations demandés",
      'ACCEPT_REQUEST': "Demande d'ordre de mission acceptée",
      'REJECT_REQUEST': "Demande d'ordre de mission rejetée",
      'PREPARE_OFFICIAL_OM': "Ordre de mission officiel préparé",
      'TRANSMIT_TO_SG': "Transmis au Secrétaire Général pour signature",
      'REGISTRATION_AND_ARRIVAL_RECORDED': 'Arrivée enregistrée par le Secrétariat Central',
      'ARRIVAL_RECORDED': 'Arrivée enregistrée par le Secrétariat Central',
      'ARRIVAL_SIGNED_BY_SG': "Visa d'arrivée signé par le Secrétaire Général",
      'SG_ARRIVAL_SIGNED': "Visa d'arrivée signé par le Secrétaire Général",
      'DEPART_RECORDED': 'Départ enregistré par le Secrétariat Central',
      'DEPART_SIGNED_BY_SG': 'Visa de départ signé par le Secrétaire Général',
      'SG_DEPARTURE_SIGNED': 'Visa de départ signé par le Secrétaire Général',
      'MISSION_STARTED': 'Mission en cours',
      'DOCUMENT_FORWARDED': 'Document orienté / transmis',
      'FORWARD': 'Document orienté / transmis',
      'ORIENT': 'Document orienté vers le service',
      'DOCUMENT_RECEIVED': 'Document reçu par le service',
      'RECEIVE': 'Document reçu par le service',
      'DOCUMENT_TREATED': 'Dossier pris en charge pour traitement',
      'TREAT': 'Dossier pris en charge pour traitement',
      'PROCESSING': 'Dossier pris en charge pour traitement',
      'IN_PROGRESS': 'En cours de traitement',
      'DOCUMENT_COMPLETED': 'Traitement terminé',
      'COMPLETED': 'Traitement terminé',
      'DOCUMENT_RETURNED': 'Document retourné au Secrétariat Central',
      'RETURN': 'Document retourné au Secrétariat Central',
      'RETOUR': 'Document retourné pour correction',
      'RETURN_FOR_CORRECTION': 'Document retourné pour correction',
      'A_CORRIGER': 'Document à corriger',
      'DOCUMENT_REJECTED': 'Document rejeté',
      'REJECT': 'Document rejeté',
      'DOCUMENT_ARCHIVED': 'Document archivé définitivement',
      'ARCHIVE': 'Document archivé définitivement',
      'ARCHIVED': 'Document archivé définitivement',
      'ARCHIVE_DIRECT': 'Document officiel classé aux archives',
      'VALIDATED': 'Document validé',
      'VALIDATE': 'Document validé',
      'ACCEPTED': 'Document validé et accepté',
      'SIGNED': 'Document signé électroniquement',
      'SIGN': 'Document signé électroniquement',
      'CREATE': 'Document enregistré dans UK-GED',
      'CREATED': 'Document enregistré dans UK-GED',
      'UPDATE': 'Mise à jour du document',
      'PENDING_SIGNATURE': 'En attente de signature',
      'PENDING_PROCESSING': 'En attente de traitement'
    };

    function formatHumanAction(actionCode, details) {
      let code = (actionCode || '').trim();
      let detailText = (details || '').trim();

      if (code.includes(' : ')) {
        const parts = code.split(' : ');
        code = parts[0].trim();
        if (!detailText) detailText = parts.slice(1).join(' : ').trim();
      }

      let title = ACTION_LABELS[code.toUpperCase()] || '';
      if (!title) {
        if (code && /^[A-Z0-9_]+$/.test(code)) {
          title = code.toLowerCase().replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
        } else if (code) {
          title = code;
        } else {
          title = 'Document enregistré dans UK-GED';
        }
      }

      let mention = '';
      const upperCode = code.toUpperCase();
      if (upperCode === 'ARRIVAL_SIGNED_BY_SG' || upperCode === 'SG_ARRIVAL_SIGNED') {
        mention = 'Retour au Secrétariat Central';
      } else if (upperCode === 'DEPART_SIGNED_BY_SG' || upperCode === 'SG_DEPARTURE_SIGNED') {
        mention = 'Retour au Secrétariat Central pour archivage';
      } else if (upperCode === 'REGISTRATION_AND_ARRIVAL_RECORDED') {
        mention = 'En attente du visa du Secrétaire Général';
      } else if (upperCode === 'SUBMIT_REQUEST') {
        mention = 'Transmis au Secrétariat Central';
      } else if (upperCode === 'TRANSMIT_TO_SG') {
        mention = 'En attente de signature SG';
      } else if (detailText) {
        let clean = detailText.replace(/^[A-Z0-9_]+\s*:\s*/i, '').trim();
        if (clean.toLowerCase().includes('retour au secrétariat central')) {
          mention = 'Retour au Secrétariat Central';
        } else if (clean.length > 0 && clean.length <= 45 && !clean.includes('\n')) {
          mention = clean;
        }
      }

      return { title, mention };
    }

    // A. Query standard documents with their live responsible, history & next action
    const rawDocuments = await db.all(
      `SELECT d.id, d.reference, d.title, d.document_type, d.status, d.priority, d.created_at, d.updated_at,
              d.sender_name, d.sender_organization, d.deadline_date, d.originating_service_id, d.current_service_id,
              s.name as service_name, s.code as service_code,
              u.first_name as current_user_first, u.last_name as current_user_last, u.function_title as current_user_function,
              sh.function_title as head_function, hu.first_name as head_first, hu.last_name as head_last,
              (
                SELECT dh.action
                FROM document_history dh 
                WHERE dh.document_id = d.id 
                ORDER BY dh.id DESC 
                LIMIT 1
              ) as last_action_code,
              (
                SELECT dh.details
                FROM document_history dh 
                WHERE dh.document_id = d.id 
                ORDER BY dh.id DESC 
                LIMIT 1
              ) as last_action_details,
              (
                SELECT dh.timestamp 
                FROM document_history dh 
                WHERE dh.document_id = d.id 
                ORDER BY dh.id DESC 
                LIMIT 1
              ) as last_history_date
       FROM documents d
       LEFT JOIN services s ON d.current_service_id = s.id
       LEFT JOIN users u ON d.current_user_id = u.id
       LEFT JOIN users hu ON s.head_user_id = hu.id
       LEFT JOIN service_heads_history sh ON s.id = sh.service_id AND sh.is_current = 1
       WHERE d.status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'TRASHED') AND ${abacSql}
       ORDER BY d.updated_at DESC, d.id DESC
       LIMIT 40`,
      abacParams
    );

    const isUserSG = user.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user.service_code === 'SG';

    const formattedDocs = (rawDocuments || []).map(doc => {
      let currentResponsible = '';
      if (doc.current_user_first) {
        currentResponsible = `${doc.current_user_first} ${doc.current_user_last}` + (doc.current_user_function ? ` (${doc.current_user_function})` : '');
      } else if (doc.head_first) {
        currentResponsible = `${doc.head_first} ${doc.head_last}` + (doc.head_function ? ` (${doc.head_function})` : ' (Chef de service)');
      } else {
        currentResponsible = doc.service_name || 'Secrétariat Central';
      }

      // Compute next expected action based on status & role
      let nextAction = '';
      const st = (doc.status || '').toUpperCase();
      if (st.includes('ORIENTATION') || st === 'PENDING' || st === 'CREATED' || st === 'ENREGISTRÉ') {
        nextAction = 'Orientation vers service compétent';
      } else if (st.includes('TRAITEMENT') || st === 'IN_PROGRESS' || st === 'ORIENTÉ' || st === 'TRANSMIS') {
        nextAction = `Traitement par ${doc.service_name || 'le service'}`;
      } else if (st.includes('SIGNATURE') || st === 'EN ATTENTE DE SIGNATURE') {
        nextAction = isUserSG ? 'Signature du document' : "En attente de signature de l'autorité";
      } else if (st.includes('RETOUR') || st === 'A_CORRIGER') {
        nextAction = 'Correction par le service émetteur';
      } else if (st.includes('VALIDÉ') || st === 'ACCEPTED') {
        nextAction = 'Clôture et remise au demandeur';
      } else if (st.includes('SIGNÉ') || st === 'SIGNED' || st.includes('PRÊT POUR ARCHIVAGE')) {
        nextAction = 'Archivage définitif au Secrétariat Central';
      } else if (st.includes('ARCHIV') || st.includes('TRAITÉ') || st.includes('CLÔTURÉ')) {
        nextAction = 'Dossier traité et clôturé';
      } else {
        nextAction = 'Action administrative requise';
      }

      const humanAction = formatHumanAction(doc.last_action_code, doc.last_action_details);

      return {
        id: doc.id,
        raw_id: doc.id,
        reference: doc.reference,
        title: doc.title,
        document_type: doc.document_type,
        type_category: doc.document_type === 'INCOMING_MAIL' ? 'COURRIER_ENTRANT' : 
                       doc.document_type === 'OUTGOING_MAIL' ? 'COURRIER_SORTANT' : 
                       doc.document_type === 'MISSION_ORDER' ? 'ORDRE_MISSION_INTERNE' : 
                       doc.document_type === 'DEMANDE' ? 'DEMANDE' : 'AUTRE_DOCUMENT',
        sender_name: doc.sender_organization ? `${doc.sender_name || 'Expéditeur'} (${doc.sender_organization})` : (doc.sender_name || 'Non spécifié'),
        service_name: doc.service_name || 'Secrétariat Central',
        service_id: doc.current_service_id,
        current_responsible: currentResponsible,
        status: doc.status,
        priority: doc.priority || 'NORMAL',
        last_action_title: humanAction.title,
        last_action_mention: humanAction.mention,
        last_action: humanAction.title + (humanAction.mention ? ` — ${humanAction.mention}` : ''),
        last_action_date: doc.last_history_date || doc.updated_at || doc.created_at,
        next_action: nextAction,
        source_table: 'documents',
        created_at: doc.created_at,
        updated_at: doc.updated_at
      };
    });

    // B. If user is SC, Admin or SG (or Recteur if explicitly transferred to him), include active external missionaries
    let externalMissionaryDossiers = [];
    const canSeeAllExtMiss = isSC || user.role_code === 'SECRÉTAIRE_GÉNÉRAL';
    const isRecteur = user.role_code === 'RECTEUR';

    if (canSeeAllExtMiss || isRecteur) {
      let extWhere = `m.status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'REJETÉ PAR LE SECRÉTAIRE GÉNÉRAL')`;
      let extParams = [];
      if (isRecteur) {
        extWhere += ` AND (m.current_service_id = ? OR m.host_service_id = ?)`;
        extParams.push(user.service_id, user.service_id);
      }

      const rawExtMiss = await db.all(
        `SELECT m.id, m.reference, m.last_name, m.first_names, m.origin_institution, m.object_of_mission,
                m.status, m.host_service_id, m.current_service_id, m.arrival_date, m.departure_date,
                m.created_at, m.updated_at,
                s.name as host_service_name,
                cs.name as current_service_name,
                (
                  SELECT emh.action
                  FROM external_missionary_history emh 
                  WHERE emh.missionary_id = m.id 
                  ORDER BY emh.id DESC 
                  LIMIT 1
                ) as last_action_code,
                (
                  SELECT emh.details
                  FROM external_missionary_history emh 
                  WHERE emh.missionary_id = m.id 
                  ORDER BY emh.id DESC 
                  LIMIT 1
                ) as last_action_details,
                (
                  SELECT emh.timestamp 
                  FROM external_missionary_history emh 
                  WHERE emh.missionary_id = m.id 
                  ORDER BY emh.id DESC 
                  LIMIT 1
                ) as last_history_date
         FROM external_missionaries m
         LEFT JOIN services s ON m.host_service_id = s.id
         LEFT JOIN services cs ON m.current_service_id = cs.id
         WHERE ${extWhere}
         ORDER BY m.updated_at DESC
         LIMIT 20`,
        extParams
      );

      externalMissionaryDossiers = (rawExtMiss || []).map(m => {
        let nextAction = '';
        const st = (m.status || '').toUpperCase();
        if (st.includes('ARRIVÉE ENREGISTRÉE') || st.includes('EN ATTENTE DE SIGNATURE DU SG')) {
          nextAction = isUserSG ? "Signature du visa d'arrivée" : "En attente de signature du visa d'arrivée par le SG";
        } else if (st.includes('ARRIVÉE SIGNÉE') || st.includes('MISSION EN COURS')) {
          nextAction = 'Mission en cours — Enregistrement du départ en fin de mission';
        } else if (st.includes('DÉPART ENREGISTRÉ')) {
          nextAction = isUserSG ? 'Signature du visa final de départ' : 'En attente de signature du visa de départ par le SG';
        } else if (st.includes('DÉPART SIGNÉ') || st.includes('PRÊT POUR ARCHIVAGE')) {
          nextAction = 'Retour au Secrétariat Central pour archivage';
        } else if (st.includes('ARCHIV')) {
          nextAction = 'Mission clôturée et archivée';
        } else {
          nextAction = 'Traitement ordre de mission externe';
        }

        const humanAction = formatHumanAction(m.last_action_code, m.last_action_details);

        return {
          id: `ext_${m.id}`,
          raw_id: m.id,
          reference: m.reference,
          title: `Ordre de mission externe — ${m.object_of_mission}`,
          document_type: 'ORDRE_MISSION_EXTERNE',
          type_category: 'ORDRE_MISSION_EXTERNE',
          sender_name: `${m.last_name} ${m.first_names} (${m.origin_institution})`,
          service_name: m.current_service_name || m.host_service_name || 'Secrétariat Général',
          service_id: m.current_service_id,
          current_responsible: st.includes('SIGNATURE') ? 'Secrétaire Général' : (m.host_service_name || 'Secrétariat Central'),
          status: m.status,
          priority: 'HIGH',
          last_action_title: humanAction.title,
          last_action_mention: humanAction.mention,
          last_action: humanAction.title + (humanAction.mention ? ` — ${humanAction.mention}` : ''),
          last_action_date: m.last_history_date || m.updated_at || m.created_at,
          next_action: nextAction,
          source_table: 'external_missionaries',
          created_at: m.created_at,
          updated_at: m.updated_at
        };
      });
    }

    // C. Internal Mission Order Requests (« DEMANDES D'ORDRE DE MISSION INTERNES »)
    // Synchronized with dashboard indicators without duplicates
    let internalMissionDossiers = [];
    let moWhere = `r.status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'REJETÉ', 'REJETÉE')
                   AND (r.official_document_id IS NULL OR r.official_document_id NOT IN (SELECT id FROM documents WHERE status NOT IN ('ARCHIVED', 'ARCHIVÉ', 'TRASHED')))`;
    let moParams = [];

    const canSeeAllMissions = isSC || user.role_code === 'SECRÉTAIRE_GÉNÉRAL' || user.role_code === 'RECTEUR';
    if (!canSeeAllMissions) {
      moWhere += ` AND (r.user_id = ? OR LOWER(r.applicant_email) = LOWER(?) OR r.destination_service_id = ? OR (r.applicant_service_name = ? AND ? IS NOT NULL))`;
      moParams.push(user.id, user.email || '', user.service_id || 0, user.service_name || '', user.service_name || null);
    }

    const rawMoReqs = await db.all(
      `SELECT r.id, r.reference, r.tracking_token, r.user_id,
              r.applicant_last_name, r.applicant_first_names, r.applicant_function, r.applicant_matricule,
              r.applicant_service_name, r.applicant_phone, r.applicant_email, r.applicant_institution,
              r.object_of_mission, r.destination, r.country, r.exact_location,
              r.start_date, r.end_date, r.duration_days, r.transport_means,
              r.status, r.destination_service_id, r.destination_service_name,
              r.created_at, r.updated_at,
              s.name as destination_service_real_name,
              (
                SELECT rh.action 
                FROM mission_order_request_history rh 
                WHERE rh.request_id = r.id 
                ORDER BY rh.id DESC 
                LIMIT 1
              ) as last_action_code,
              (
                SELECT rh.observation 
                FROM mission_order_request_history rh 
                WHERE rh.request_id = r.id 
                ORDER BY rh.id DESC 
                LIMIT 1
              ) as last_action_details,
              (
                SELECT rh.timestamp 
                FROM mission_order_request_history rh 
                WHERE rh.request_id = r.id 
                ORDER BY rh.id DESC 
                LIMIT 1
              ) as last_history_date
       FROM mission_order_requests r
       LEFT JOIN services s ON r.destination_service_id = s.id
       WHERE ${moWhere}
       ORDER BY r.updated_at DESC, r.id DESC
       LIMIT 30`,
      moParams
    );

    internalMissionDossiers = (rawMoReqs || []).map(r => {
      let nextAction = '';
      const st = (r.status || '').toUpperCase();
      if (st.includes('EN_ATTENTE_SC') || st.includes('DEMANDE ENREGISTRÉE') || st === 'EN ATTENTE' || st === 'DEMANDE REÇUE') {
        nextAction = isSC ? "Examen et validation de la demande" : "En attente d'examen par le Secrétariat Central";
      } else if (st.includes('COMPLÉMENT') || st.includes('COMPLEMENT')) {
        nextAction = "En attente des compléments du demandeur";
      } else if (st.includes('ACCEPTÉ') || st.includes('ACCEPTE')) {
        nextAction = isSC ? "Préparation de l'ordre de mission officiel" : "Demande acceptée — En attente de rédaction d'OM";
      } else if (st.includes('PRÉPARATION') || st.includes('PREPARATION')) {
        nextAction = isSC ? "Finalisation et transmission au Secrétaire Général" : "Ordre de mission en cours de préparation";
      } else if (st.includes('SIGNATURE') || st.includes('SECRÉTAIRE GÉNÉRAL')) {
        nextAction = isUserSG ? "Signature de l'ordre de mission" : "En attente de signature par le Secrétaire Général";
      } else if (st.includes('SIGNÉ') || st.includes('SIGNE')) {
        nextAction = "Archivage au Secrétariat Central";
      } else {
        nextAction = "Traitement de la demande d'ordre de mission";
      }

      const humanAction = formatHumanAction(
        r.last_action_code || 'SUBMIT_REQUEST', 
        r.last_action_details || `Mission vers ${r.destination}`
      );

      let currentResponsible = '';
      if (st.includes('SIGNATURE') || st.includes('SECRÉTAIRE GÉNÉRAL')) {
        currentResponsible = 'Secrétaire Général';
      } else if (st.includes('COMPLÉMENT') || st.includes('COMPLEMENT')) {
        currentResponsible = `${r.applicant_first_names} ${r.applicant_last_name} (Demandeur)`;
      } else {
        currentResponsible = r.destination_service_real_name || r.destination_service_name || 'Secrétariat Central';
      }

      const applicantInfo = r.applicant_service_name 
        ? `${r.applicant_first_names} ${r.applicant_last_name} (${r.applicant_service_name})`
        : `${r.applicant_first_names} ${r.applicant_last_name}` + (r.applicant_function ? ` (${r.applicant_function})` : '');

      return {
        id: `req_${r.id}`,
        raw_id: r.id,
        reference: r.reference,
        title: `Demande d'ordre de mission : ${r.applicant_first_names} ${r.applicant_last_name} vers ${r.destination}`,
        document_type: 'ORDRE_MISSION_INTERNE',
        type_category: 'ORDRE_MISSION_INTERNE',
        sender_name: applicantInfo,
        service_name: r.destination_service_real_name || r.destination_service_name || 'Secrétariat Central',
        service_id: r.destination_service_id || 5,
        current_responsible: currentResponsible,
        status: r.status,
        priority: 'NORMAL',
        last_action_title: humanAction.title,
        last_action_mention: humanAction.mention,
        last_action: humanAction.title + (humanAction.mention ? ` — ${humanAction.mention}` : ''),
        last_action_date: r.last_history_date || r.updated_at || r.created_at,
        next_action: nextAction,
        source_table: 'mission_requests',
        created_at: r.created_at,
        updated_at: r.updated_at
      };
    });

    // Combine and sort recent unified activity by updated_at
    const allRecentActivity = [...formattedDocs, ...externalMissionaryDossiers, ...internalMissionDossiers]
      .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

    // Appointment counters
    let apptWhere = 'WHERE (responsible_id = ? OR requester_id = ? OR ? = "ADMINISTRATEUR")';
    let apptParams = [user.id, user.id, user.role_code];
    const apptPending = await db.get(`SELECT COUNT(*) as count FROM appointments ${apptWhere} AND status = "EN_ATTENTE"`, apptParams);
    const apptConfirmed = await db.get(`SELECT COUNT(*) as count FROM appointments ${apptWhere} AND status IN ("CONFIRME", "ACCEPTE")`, apptParams);
    const apptToday = await db.get(`SELECT COUNT(*) as count FROM appointments ${apptWhere} AND requested_date = ?`, [...apptParams, today]);

    res.json({
      metrics: {
        total: totalAccessible ? totalAccessible.count : 0,
        pending: pendingDocs ? pendingDocs.count : 0,
        in_progress: inProgressDocs ? inProgressDocs.count : 0,
        signed: signedDocs ? signedDocs.count : 0,
        archived: archivedDocs ? archivedDocs.count : 0,
        overdue: overdueDocs ? overdueDocs.count : 0
      },
      appointments: {
        pending: apptPending ? apptPending.count : 0,
        confirmed: apptConfirmed ? apptConfirmed.count : 0,
        today: apptToday ? apptToday.count : 0
      },
      admin: adminStats,
      sg: sgStats,
      sc: scStats,
      to_sign_count: toSignCount,
      recent_activity: allRecentActivity || []
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Erreur lors du calcul du tableau de bord.' });
  }
});

module.exports = router;

