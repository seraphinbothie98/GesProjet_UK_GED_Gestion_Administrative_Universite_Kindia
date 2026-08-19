const db = require('../database/db');
const { logAuditAction } = require('../middleware/audit');

/**
 * Workflow Engine managing dynamic transitions A -> B -> C -> D -> B -> A
 */
class WorkflowEngine {
  /**
   * Orient document to target service/user with motif, instruction & deadline
   */
  static async orientDocument({ documentId, fromUserId, fromServiceId, toServiceId, toUserId, motif, instruction, deadline, priority, req }) {
    if (Number(fromServiceId) === Number(toServiceId)) {
      throw new Error('TRANSMISSION IMPOSSIBLE : Vous ne pouvez pas transmettre ou orienter un document vers votre propre service. Veuillez sélectionner un autre service destinataire.');
    }

    // 1. Fetch document
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!doc) throw new Error('Document introuvable.');

    if (doc.is_locked) {
      throw new Error('Impossible d’orienter un document verrouillé ou signé.');
    }

    if (Number(doc.current_service_id) !== Number(fromServiceId)) {
      const currService = await db.get('SELECT name FROM services WHERE id = ?', [doc.current_service_id]);
      throw new Error(`Action impossible : Le document est actuellement sous le contrôle du service [${currService ? currService.name : 'destinataire'}] et ne peut pas être orienté par votre service.`);
    }

    // 2. Create document transfer entry
    const transferRes = await db.run(
      `INSERT INTO document_transfers 
       (document_id, from_service_id, from_user_id, to_service_id, to_user_id, action, motif, instruction, deadline, status)
       VALUES (?, ?, ?, ?, ?, 'ORIENT', ?, ?, ?, 'PENDING')`,
      [documentId, fromServiceId, fromUserId, toServiceId, toUserId || null, motif, instruction, deadline || null]
    );

    // 3. Update current document holder and status
    const newPriority = priority || doc.priority;
    await db.run(
      `UPDATE documents 
       SET current_service_id = ?, current_user_id = ?, priority = ?, status = 'IN_PROGRESS', deadline_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [toServiceId, toUserId || null, newPriority, deadline || doc.deadline_date, documentId]
    );

    // 4. Log in document_history
    const fromService = await db.get('SELECT name FROM services WHERE id = ?', [fromServiceId]);
    const toService = await db.get('SELECT name FROM services WHERE id = ?', [toServiceId]);
    
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'ORIENT', ?)`,
      [documentId, fromUserId, fromServiceId, `Orienté vers [${toService.name}] - Motif: ${motif}. Instruction: ${instruction || 'Aucune'}`]
    );

    // 5. Create Notification for target service/users
    let targetUsers = [];
    if (toUserId) {
      targetUsers = [{ id: toUserId }];
    } else {
      targetUsers = await db.all('SELECT id FROM users WHERE service_id = ? AND status = "ACTIVE"', [toServiceId]);
    }

    for (const u of targetUsers) {
      await db.run(
        `INSERT INTO notifications (user_id, document_id, title, message, type)
         VALUES (?, ?, ?, ?, 'ACTION_REQUIRED')`,
        [u.id, documentId, 'Nouveau document orienté', `Le document Réf ${doc.reference} a été orienté vers votre service par ${fromService.name}. Motif: ${motif}`]
      );
    }

    // 6. Log Audit
    await logAuditAction(fromUserId, 'ORIENT', 'DOCUMENT', documentId, req, {
      fromServiceId,
      toServiceId,
      motif,
      instruction
    });

    return { success: true, transferId: transferRes.lastID };
  }

  /**
   * Transmit document directly to target service
   */
  static async transmitDocument({ documentId, fromUserId, fromServiceId, toServiceId, toUserId, instruction, req }) {
    if (Number(fromServiceId) === Number(toServiceId)) {
      throw new Error('TRANSMISSION IMPOSSIBLE : Vous ne pouvez pas transmettre ou orienter un document vers votre propre service. Veuillez sélectionner un autre service destinataire.');
    }

    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!doc) throw new Error('Document introuvable.');

    if (doc.is_locked) {
      throw new Error('Impossible de transmettre un document verrouillé.');
    }

    if (Number(doc.current_service_id) !== Number(fromServiceId)) {
      const currService = await db.get('SELECT name FROM services WHERE id = ?', [doc.current_service_id]);
      throw new Error(`Action impossible : Le document est actuellement sous le contrôle du service [${currService ? currService.name : 'destinataire'}] et ne peut pas être transmis par votre service.`);
    }

    const transferRes = await db.run(
      `INSERT INTO document_transfers 
       (document_id, from_service_id, from_user_id, to_service_id, to_user_id, action, instruction, status)
       VALUES (?, ?, ?, ?, ?, 'TRANSMIT', ?, 'PENDING')`,
      [documentId, fromServiceId, fromUserId, toServiceId, toUserId || null, instruction || 'Transmission simple']
    );

    await db.run(
      `UPDATE documents 
       SET current_service_id = ?, current_user_id = ?, status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [toServiceId, toUserId || null, documentId]
    );

    const toService = await db.get('SELECT name FROM services WHERE id = ?', [toServiceId]);

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'TRANSMIT', ?)`,
      [documentId, fromUserId, fromServiceId, `Transmis au service [${toService.name}]`]
    );

    let targetUsers = [];
    if (toUserId) {
      targetUsers = [{ id: toUserId }];
    } else {
      targetUsers = await db.all('SELECT id FROM users WHERE service_id = ? AND status = "ACTIVE"', [toServiceId]);
    }

    for (const u of targetUsers) {
      await db.run(
        `INSERT INTO notifications (user_id, document_id, title, message, type)
         VALUES (?, ?, ?, ?, 'INFO')`,
        [u.id, documentId, 'Document transmis', `Le document Réf ${doc.reference} vous a été transmis.`]
      );
    }

    await logAuditAction(fromUserId, 'TRANSMIT', 'DOCUMENT', documentId, req, { fromServiceId, toServiceId });

    return { success: true, transferId: transferRes.lastID };
  }

  /**
   * Return document to a previous service or creator (defaults to Secrétariat Central if requested)
   */
  static async returnDocument({ documentId, fromUserId, fromServiceId, toServiceId, returnReason, req }) {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!doc) throw new Error('Document introuvable.');

    if (Number(doc.current_service_id) !== Number(fromServiceId)) {
      const currService = await db.get('SELECT name FROM services WHERE id = ?', [doc.current_service_id]);
      throw new Error(`Action impossible : Le document est actuellement sous le contrôle du service [${currService ? currService.name : 'destinataire'}].`);
    }

    // If toServiceId is not specified or requested to return to SC, resolve SC service ID
    let targetServiceId = toServiceId;
    if (!targetServiceId) {
      const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
      if (scService) targetServiceId = scService.id;
      else throw new Error('Service Secrétariat Central introuvable.');
    }

    if (Number(fromServiceId) === Number(targetServiceId)) {
      throw new Error('TRANSMISSION IMPOSSIBLE : Vous ne pouvez pas retourner un document à votre propre service.');
    }

    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const isReturnToSC = scService && Number(targetServiceId) === Number(scService.id);
    const newStatus = isReturnToSC ? 'RETOURNÉ AU SECRÉTARIAT CENTRAL' : 'IN_PROGRESS';

    await db.run(
      `INSERT INTO document_transfers 
       (document_id, from_service_id, from_user_id, to_service_id, action, motif, instruction, status)
       VALUES (?, ?, ?, ?, 'RETURN', 'Retour au Secrétariat Central', ?, 'RETURNED')`,
      [documentId, fromServiceId, fromUserId, targetServiceId, returnReason || 'Retour après traitement']
    );

    await db.run(
      `UPDATE documents 
       SET current_service_id = ?, current_user_id = NULL, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [targetServiceId, newStatus, documentId]
    );

    const toService = await db.get('SELECT name FROM services WHERE id = ?', [targetServiceId]);

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'RETURN', ?)`,
      [documentId, fromUserId, fromServiceId, `Retourné au service [${toService.name}] - Motif: ${returnReason || 'Retour au Secrétariat Central'}`]
    );

    const targetUsers = await db.all('SELECT id FROM users WHERE service_id = ? AND status = "ACTIVE"', [targetServiceId]);
    for (const u of targetUsers) {
      await db.run(
        `INSERT INTO notifications (user_id, document_id, title, message, type)
         VALUES (?, ?, ?, ?, 'ACTION_REQUIRED')`,
        [u.id, documentId, 'Document retourné', `Le document Réf ${doc.reference} a été retourné. Motif : ${returnReason || 'Retour au Secrétariat Central'}`]
      );
    }

    await logAuditAction(fromUserId, 'RETURN', 'DOCUMENT', documentId, req, { fromServiceId, toServiceId: targetServiceId, returnReason });

    return { success: true };
  }

  /**
   * Accept document at the current step (SG, Recteur, or authorized service head)
   */
  static async acceptDocument({ documentId, userId, userServiceId, remarks, req }) {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!doc) throw new Error('Document introuvable.');

    if (doc.status === 'ARCHIVED') {
      throw new Error('Impossible d’accepter un document archivé.');
    }

    if (Number(doc.current_service_id) !== Number(userServiceId)) {
      const currService = await db.get('SELECT name FROM services WHERE id = ?', [doc.current_service_id]);
      throw new Error(`Action impossible : Le document est actuellement sous le contrôle du service [${currService ? currService.name : 'destinataire'}].`);
    }

    // Update document status
    await db.run(
      `UPDATE documents 
       SET status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [documentId]
    );

    // Document History entry
    const userObj = await db.get('SELECT u.first_name, u.last_name, u.function_title, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?', [userId]);
    const detailsMsg = `Document validé et ACCEPTÉ par ${userObj.function_title || userObj.role_name} (${userObj.first_name} ${userObj.last_name}).${remarks ? ' Remarques: ' + remarks : ''}`;

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'ACCEPT', ?)`,
      [documentId, userId, userServiceId, detailsMsg]
    );

    // Notify document creator
    await db.run(
      `INSERT INTO notifications (user_id, document_id, title, message, type)
       VALUES (?, ?, 'Document accepté', ?, 'INFO')`,
      [doc.created_by, documentId, `Votre document (Réf: ${doc.reference}) a été officialisé et ACCEPTÉ par le ${userObj.function_title || 'Secrétariat General'}.`]
    );

    // Audit log
    await logAuditAction(userId, 'ACCEPT', 'DOCUMENT', documentId, req, {
      reference: doc.reference,
      remarks: remarks || null
    });

    return { success: true, message: 'Document accepté avec succès.' };
  }

  /**
   * Reject document at the current step (SG, Recteur, or authorized service head)
   * Motif is strictly required!
   */
  static async rejectDocument({ documentId, userId, userServiceId, motif, req }) {
    if (!motif || !motif.trim()) {
      throw new Error('Le motif du rejet est obligatoire.');
    }

    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!doc) throw new Error('Document introuvable.');

    if (Number(doc.current_service_id) !== Number(userServiceId)) {
      const currService = await db.get('SELECT name FROM services WHERE id = ?', [doc.current_service_id]);
      throw new Error(`Action impossible : Le document est actuellement sous le contrôle du service [${currService ? currService.name : 'destinataire'}].`);
    }

    const cleanMotif = motif.trim();
    const nowIso = new Date().toISOString();

    // Update document with REJECTED status and rejection metadata
    await db.run(
      `UPDATE documents 
       SET status = 'REJECTED', rejection_reason = ?, rejected_by = ?, rejected_at = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [cleanMotif, userId, nowIso, documentId]
    );

    // Document History entry
    const userObj = await db.get('SELECT u.first_name, u.last_name, u.function_title, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?', [userId]);
    const historyDetails = `Document REJETÉ par ${userObj.function_title || userObj.role_name} (${userObj.first_name} ${userObj.last_name}). Motif de rejet: "${cleanMotif}"`;

    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'REJECT', ?)`,
      [documentId, userId, userServiceId, historyDetails]
    );

    // Notify creator & involved services
    await db.run(
      `INSERT INTO notifications (user_id, document_id, title, message, type)
       VALUES (?, ?, 'Document rejeté', ?, 'ACTION_REQUIRED')`,
      [doc.created_by, documentId, `Votre document (Réf: ${doc.reference}) a été REJETÉ par le ${userObj.function_title || 'Secrétariat Général'}. Motif : ${cleanMotif}`]
    );

    // Audit log with full motif, date, time and user metadata
    await logAuditAction(userId, 'REJECT', 'DOCUMENT', documentId, req, {
      reference: doc.reference,
      motif: cleanMotif,
      rejected_by_name: `${userObj.first_name} ${userObj.last_name}`,
      rejected_by_function: userObj.function_title,
      rejected_at: nowIso
    });

    return { success: true, message: 'Document rejeté et motif enregistré.' };
  }

  /**
   * Chef de Service Signature & Validation with automatic return to Secrétariat Central (Rules 4 & 5)
   */
  static async signAndReturnDocument({ documentId, userId, userServiceId, remarks, req }) {
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!doc) throw new Error('Document introuvable.');

    if (doc.status === 'ARCHIVED') {
      throw new Error('Impossible de signer un document déjà archivé.');
    }

    if (Number(doc.current_service_id) !== Number(userServiceId)) {
      const currService = await db.get('SELECT name FROM services WHERE id = ?', [doc.current_service_id]);
      throw new Error(`Action impossible : Le document est actuellement sous le contrôle du service [${currService ? currService.name : 'destinataire'}].`);
    }

    const userObj = await db.get('SELECT u.first_name, u.last_name, u.function_title, u.matricule, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?', [userId]);
    const now = new Date();
    const signedAt = now.toISOString();

    const crypto = require('crypto');
    const signatureRaw = `${doc.reference}:${userObj.matricule}:${signedAt}:${userId}:UK_GED_CERT_2026`;
    const signatureHash = crypto.createHash('sha256').update(signatureRaw).digest('hex');

    // Register signature
    await db.run(
      `INSERT INTO signatures (document_id, user_id, signature_hash, certificate_info, signed_at)
       VALUES (?, ?, ?, ?, ?)`,
      [documentId, userId, signatureHash, `Certificat Validé UK-GED - ${userObj.function_title || userObj.role_name}`, signedAt]
    );

    // Fetch Secrétariat Central service ID
    const scService = await db.get('SELECT id, name FROM services WHERE code = "SC"');
    if (!scService) throw new Error('Service Secrétariat Central introuvable.');

    // Step 1: Mark as SIGNÉ & locked
    await db.run(
      `UPDATE documents 
       SET status = 'SIGNÉ', is_locked = 1, qr_code_hash = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [signatureHash, documentId]
    );

    // Step 2: Record Signature History
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'SIGN', ?)`,
      [documentId, userId, userServiceId, `Signé et validé par ${userObj.function_title || userObj.role_name} (${userObj.first_name} ${userObj.last_name}). ${remarks ? 'Remarques: ' + remarks : ''}`]
    );

    // Step 3: Record Transfer back to Secrétariat Central
    await db.run(
      `INSERT INTO document_transfers (document_id, from_service_id, from_user_id, to_service_id, action, motif, instruction, status)
       VALUES (?, ?, ?, ?, 'RETURN', 'Retour après signature / validation', ?, 'RETURNED')`,
      [documentId, userServiceId, userId, scService.id, remarks || 'Traitement et signature terminés']
    );

    // Step 4: Set status to RETOURNÉ AU SECRÉTARIAT CENTRAL & PRÊT POUR ARCHIVAGE
    await db.run(
      `UPDATE documents 
       SET current_service_id = ?, current_user_id = NULL, status = 'RETOURNÉ AU SECRÉTARIAT CENTRAL', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [scService.id, documentId]
    );

    // Record History for Return to SC
    await db.run(
      `INSERT INTO document_history (document_id, user_id, service_id, action, details)
       VALUES (?, ?, ?, 'RETURN', ?)`,
      [documentId, userId, userServiceId, `Document signé et retourné au [${scService.name}] — Statut : PRÊT POUR ARCHIVAGE`]
    );

    // Audit Log
    await logAuditAction(userId, 'SIGN_AND_RETURN', 'DOCUMENT', documentId, req, {
      reference: doc.reference,
      signee: `${userObj.first_name} ${userObj.last_name}`,
      function: userObj.function_title,
      signatureHash,
      date: now.toLocaleDateString('fr-FR'),
      time: now.toLocaleTimeString('fr-FR')
    });

    return { 
      success: true, 
      message: 'Document signé, validé et retourné au Secrétariat Central avec succès.',
      signatureHash 
    };
  }

  /**
   * Get full historical visual circuit of a document
   */
  static async getVisualCircuit(documentId) {
    const history = await db.all(
      `SELECT dh.*, u.first_name, u.last_name, u.function_title, s.name as service_name, s.code as service_code
       FROM document_history dh
       JOIN users u ON dh.user_id = u.id
       JOIN services s ON dh.service_id = s.id
       WHERE dh.document_id = ?
       ORDER BY dh.timestamp ASC`,
      [documentId]
    );

    const transfers = await db.all(
      `SELECT dt.*, 
              fs.name as from_service_name, fs.code as from_service_code,
              ts.name as to_service_name, ts.code as to_service_code,
              fu.first_name as from_user_first, fu.last_name as from_user_last,
              tu.first_name as to_user_first, tu.last_name as to_user_last
       FROM document_transfers dt
       JOIN services fs ON dt.from_service_id = fs.id
       JOIN services ts ON dt.to_service_id = ts.id
       JOIN users fu ON dt.from_user_id = fu.id
       LEFT JOIN users tu ON dt.to_user_id = tu.id
       WHERE dt.document_id = ?
       ORDER BY dt.sent_at ASC`,
      [documentId]
    );

    return { history, transfers };
  }
}

module.exports = WorkflowEngine;
