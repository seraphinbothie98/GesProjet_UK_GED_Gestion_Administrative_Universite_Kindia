const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { logAuditAction } = require('../middleware/audit');
const { UPLOAD_DIR } = require('../config/constants');

class TransmissionService {
  // Generate sequence number: TR-YYYY-XXXXX
  async generateTransmissionNumber() {
    const currentYear = new Date().getFullYear();
    const prefix = `TR-${currentYear}`;
    
    // Count existing for this year
    const lastRow = await db.get(
      `SELECT transmission_number FROM service_transmissions 
       WHERE transmission_number LIKE ? 
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}-%`]
    );

    let nextNum = 1;
    if (lastRow && lastRow.transmission_number) {
      const parts = lastRow.transmission_number.split('-');
      const numPart = parseInt(parts[2], 10);
      if (!isNaN(numPart)) {
        nextNum = numPart + 1;
      }
    }

    const padded = String(nextNum).padStart(5, '0');
    return `${prefix}-${padded}`;
  }

  // Create & transmit document from Service A to Service B
  async createTransmission({
    documentId,
    fromUserId,
    fromServiceId,
    toServiceId,
    toUserId = null,
    subject,
    instruction = '',
    confidentialityLevel = 'CONFIDENTIEL_INTER_SERVICES',
    requiresSignature = 1,
    req = null
  }) {
    if (!documentId || !fromServiceId || !toServiceId || !subject) {
      throw new Error("Paramètres obligatoires manquants (documentId, fromServiceId, toServiceId, subject).");
    }

    if (Number(fromServiceId) === Number(toServiceId)) {
      throw new Error("Le service destinataire doit être différent du service expéditeur.");
    }

    // 1. Verify document
    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!doc) {
      throw new Error("Document introuvable.");
    }

    // 2. Fetch service names
    const fromService = await db.get('SELECT * FROM services WHERE id = ?', [fromServiceId]);
    const toService = await db.get('SELECT * FROM services WHERE id = ?', [toServiceId]);
    const senderUser = await db.get('SELECT * FROM users WHERE id = ?', [fromUserId]);

    const transmissionNumber = await this.generateTransmissionNumber();

    // 3. Insert transmission record
    const insertRes = await db.run(`
      INSERT INTO service_transmissions (
        transmission_number,
        document_id,
        from_service_id,
        to_service_id,
        from_user_id,
        to_user_id,
        subject,
        instruction,
        confidentiality_level,
        status,
        requires_signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENVOYE', ?)
    `, [
      transmissionNumber,
      documentId,
      fromServiceId,
      toServiceId,
      fromUserId,
      toUserId,
      subject,
      instruction,
      confidentialityLevel,
      requiresSignature ? 1 : 0
    ]);

    const transmissionId = insertRes.lastID;

    // 4. Mark document as part of inter-service transmission
    await db.run(
      `UPDATE documents SET is_inter_service_transmission = 1, active_transmission_id = ?, status = 'TRANSMIS' WHERE id = ?`,
      [transmissionId, documentId]
    );

    // 5. Record confidential history trace
    await this.recordHistory({
      transmissionId,
      userId: fromUserId,
      serviceId: fromServiceId,
      action: 'ENVOI',
      actionLabel: `Transmission initiale de ${fromService?.name || 'Service Expéditeur'} vers ${toService?.name || 'Service Destinataire'}`,
      comments: instruction || `Courrier transmis avec l'identifiant ${transmissionNumber}`,
      metadata: {
        transmission_number: transmissionNumber,
        document_number: doc.document_number,
        from_service: fromService?.name,
        to_service: toService?.name,
        sender: `${senderUser?.first_name} ${senderUser?.last_name}`
      }
    });

    // 6. Targeted confidential notification to recipient service
    await this.notifyServiceMembers({
      serviceId: toServiceId,
      title: 'Nouveau courrier inter-services reçu',
      message: `Vous avez reçu un nouveau courrier confidentiel du ${fromService?.name || 'Service expéditeur'} (${transmissionNumber} : ${subject}).`,
      type: 'TRANSMISSION_RECEIVED',
      resourceId: transmissionId
    });

    if (req) {
      await logAuditAction(fromUserId, 'CREATE_INTER_SERVICE_TRANSMISSION', 'SERVICE_TRANSMISSION', transmissionId, req, {
        transmission_number: transmissionNumber,
        from_service_id: fromServiceId,
        to_service_id: toServiceId
      });
    }

    return {
      success: true,
      transmissionId,
      transmissionNumber,
      status: 'ENVOYE',
      fromService: fromService?.name,
      toService: toService?.name
    };
  }

  // Record History Item
  async recordHistory({ transmissionId, userId, serviceId, action, actionLabel, comments = '', metadata = {} }) {
    await db.run(`
      INSERT INTO service_transmission_history (
        transmission_id, user_id, service_id, action, action_label, comments, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      transmissionId,
      userId || null,
      serviceId || null,
      action,
      actionLabel,
      comments,
      JSON.stringify(metadata)
    ]);
  }

  // Verify access for user (Only Sender Service, Recipient Service, or Supervisor Admin)
  async verifyTransmissionAccess(transmissionId, user) {
    const tr = await db.get(`
      SELECT st.*, 
             s_from.name as from_service_name, s_from.code as from_service_code,
             s_to.name as to_service_name, s_to.code as to_service_code,
             u_from.first_name as from_user_first_name, u_from.last_name as from_user_last_name,
             u_to.first_name as to_user_first_name, u_to.last_name as to_user_last_name,
             doc.reference, doc.reference as document_number, doc.title as document_title, doc.file_path as doc_file_path
      FROM service_transmissions st
      JOIN services s_from ON st.from_service_id = s_from.id
      JOIN services s_to ON st.to_service_id = s_to.id
      JOIN users u_from ON st.from_user_id = u_from.id
      LEFT JOIN users u_to ON st.to_user_id = u_to.id
      JOIN documents doc ON st.document_id = doc.id
      WHERE st.id = ?
    `, [transmissionId]);

    if (!tr) {
      const err = new Error("Transmission introuvable.");
      err.status = 404;
      throw err;
    }

    const userRole = user.role_code;
    const userSId = Number(user.service_id);
    const isSender = userSId === Number(tr.from_service_id);
    const isRecipient = userSId === Number(tr.to_service_id);
    const isSystemAdmin = userRole === 'ADMINISTRATEUR';

    if (!isSender && !isRecipient && !isSystemAdmin) {
      const err = new Error("ACCÈS STRICTEMENT REFUSÉ : Vous ne faites partie ni du service expéditeur ni du service destinataire de ce courrier confidentiel.");
      err.status = 403;
      throw err;
    }

    return {
      transmission: tr,
      isSender,
      isRecipient,
      isSystemAdmin
    };
  }

  // Get Sent Transmissions (Service A)
  async getSent(serviceId, { search = '', status = '', limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT st.*, 
             s_to.name as to_service_name, s_to.code as to_service_code,
             doc.reference, doc.reference as document_number, doc.title as document_title, doc.file_path as doc_file_path,
             u_from.first_name as from_first_name, u_from.last_name as from_last_name
      FROM service_transmissions st
      JOIN services s_to ON st.to_service_id = s_to.id
      JOIN documents doc ON st.document_id = doc.id
      JOIN users u_from ON st.from_user_id = u_from.id
      WHERE st.from_service_id = ?
    `;
    const params = [serviceId];

    if (status) {
      sql += ` AND st.status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (st.transmission_number LIKE ? OR st.subject LIKE ? OR doc.reference LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY st.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return await db.all(sql, params);
  }

  // Get Inbox Transmissions (Service B)
  async getInbox(serviceId, { search = '', status = '', limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT st.*, 
             s_from.name as from_service_name, s_from.code as from_service_code,
             doc.reference, doc.reference as document_number, doc.title as document_title, doc.file_path as doc_file_path,
             u_from.first_name as from_first_name, u_from.last_name as from_last_name
      FROM service_transmissions st
      JOIN services s_from ON st.from_service_id = s_from.id
      JOIN documents doc ON st.document_id = doc.id
      LEFT JOIN users u_from ON st.from_user_id = u_from.id
      WHERE st.to_service_id = ? AND st.status NOT IN ('ARCHIVE')
    `;
    const params = [serviceId];

    if (status) {
      sql += ` AND st.status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (st.transmission_number LIKE ? OR st.subject LIKE ? OR doc.reference LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY st.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return await db.all(sql, params);
  }

  // Get Returned Transmissions (Service A)
  async getReturned(serviceId, { search = '', limit = 50, offset = 0 } = {}) {
    let sql = `
      SELECT st.*, 
             s_to.name as to_service_name, s_to.code as to_service_code,
             doc.reference, doc.reference as document_number, doc.title as document_title, doc.file_path as doc_file_path,
             u_sign.first_name as signer_first_name, u_sign.last_name as signer_last_name
      FROM service_transmissions st
      JOIN services s_to ON st.to_service_id = s_to.id
      JOIN documents doc ON st.document_id = doc.id
      LEFT JOIN users u_sign ON st.signed_by_user_id = u_sign.id
      WHERE st.from_service_id = ? AND st.status IN ('RETOURNE', 'SIGNE', 'APPROUVE')
    `;
    const params = [serviceId];

    if (search) {
      sql += ` AND (st.transmission_number LIKE ? OR st.subject LIKE ? OR doc.reference LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY st.updated_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return await db.all(sql, params);
  }

  // Get Full Transmission Details with Confidential Timeline & Attachments
  async getDetails(transmissionId, user, req = null) {
    const { transmission, isSender, isRecipient, isSystemAdmin } = await this.verifyTransmissionAccess(transmissionId, user);

    if (isSystemAdmin && !isSender && !isRecipient) {
      // Log supervisor inspection in audit log
      if (req) {
        await logAuditAction(user.id, 'SUPERVISOR_VIEW_CONFIDENTIAL_TRANSMISSION', 'SERVICE_TRANSMISSION', transmissionId, req, {
          transmission_number: transmission.transmission_number
        });
      }
    }

    // Fetch history
    const history = await db.all(`
      SELECT sth.*, u.first_name, u.last_name, u.function_title as user_function, s.name as service_name
      FROM service_transmission_history sth
      LEFT JOIN users u ON sth.user_id = u.id
      LEFT JOIN services s ON sth.service_id = s.id
      WHERE sth.transmission_id = ?
      ORDER BY sth.id ASC
    `, [transmissionId]);

    // Fetch attachments of the underlying document
    const attachments = await db.all(`
      SELECT * FROM attachments WHERE document_id = ?
    `, [transmission.document_id]);

    // Fetch document versions
    const versions = await db.all(`
      SELECT dv.*, u.first_name, u.last_name 
      FROM document_versions dv
      LEFT JOIN users u ON dv.created_by = u.id
      WHERE dv.document_id = ?
      ORDER BY dv.version_number DESC
    `, [transmission.document_id]);

    return {
      transmission,
      history,
      attachments,
      versions,
      permissions: {
        canAcknowledge: isRecipient && transmission.status === 'ENVOYE',
        canApprove: isRecipient && ['RECU', 'EN_COURS_DE_TRAITEMENT', 'ENVOYE'].includes(transmission.status),
        canSign: isRecipient && ['APPROUVE', 'RECU', 'EN_COURS_DE_TRAITEMENT'].includes(transmission.status),
        canRequestModification: isRecipient && ['ENVOYE', 'RECU', 'EN_COURS_DE_TRAITEMENT'].includes(transmission.status),
        canReject: isRecipient && ['ENVOYE', 'RECU', 'EN_COURS_DE_TRAITEMENT'].includes(transmission.status),
        canSubmitNewVersion: isSender && transmission.status === 'MODIFICATION_DEMANDEE',
        canArchive: (isSender && ['RETOURNE', 'REFUSE', 'SIGNE'].includes(transmission.status)) || (isRecipient && ['SIGNE', 'APPROUVE'].includes(transmission.status))
      }
    };
  }

  // Acknowledge Receipt by Service B
  async acknowledge(transmissionId, user, { comments = '' } = {}, req = null) {
    const { transmission, isRecipient } = await this.verifyTransmissionAccess(transmissionId, user);
    if (!isRecipient) {
      throw new Error("Seul le service destinataire peut accuser réception du courrier.");
    }

    await db.run(`
      UPDATE service_transmissions 
      SET status = 'EN_COURS_DE_TRAITEMENT', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [transmissionId]);

    await this.recordHistory({
      transmissionId,
      userId: user.id,
      serviceId: user.service_id,
      action: 'RECEPTION',
      actionLabel: `Réception et prise en charge par ${user.first_name} ${user.last_name}`,
      comments: comments || 'Courrier réceptionné et pris en charge par le service destinataire.'
    });

    // Notify sender service
    await this.notifyServiceMembers({
      serviceId: transmission.from_service_id,
      title: 'Courrier réceptionné',
      message: `Le service ${transmission.to_service_name} a réceptionné votre courrier (${transmission.transmission_number}).`,
      type: 'TRANSMISSION_ACKNOWLEDGED',
      resourceId: transmissionId
    });

    return { success: true, status: 'EN_COURS_DE_TRAITEMENT' };
  }

  // Request Modification by Service B
  async requestModification(transmissionId, user, { reason, comments = '' } = {}, req = null) {
    if (!reason || !reason.trim()) {
      throw new Error("Le motif de la demande de modification est obligatoire.");
    }

    const { transmission, isRecipient } = await this.verifyTransmissionAccess(transmissionId, user);
    if (!isRecipient) {
      throw new Error("Seul le service destinataire peut demander une modification sur ce courrier.");
    }

    await db.run(`
      UPDATE service_transmissions 
      SET status = 'MODIFICATION_DEMANDEE',
          modification_reason = ?,
          modification_requested_by = ?,
          modification_requested_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [reason, user.id, transmissionId]);

    await this.recordHistory({
      transmissionId,
      userId: user.id,
      serviceId: user.service_id,
      action: 'MODIFICATION_DEMANDEE',
      actionLabel: `Demande de modification formulée par ${user.first_name} ${user.last_name}`,
      comments: reason,
      metadata: { comments }
    });

    // Notify sender service
    await this.notifyServiceMembers({
      serviceId: transmission.from_service_id,
      title: 'Demande de modification reçue',
      message: `Le service ${transmission.to_service_name} a demandé une modification sur le courrier ${transmission.transmission_number} : "${reason}"`,
      type: 'MODIFICATION_REQUESTED',
      resourceId: transmissionId
    });

    return { success: true, status: 'MODIFICATION_DEMANDEE' };
  }

  // Submit New Corrected Version by Service A
  async submitNewVersion(transmissionId, user, { newFilePath, newFileName, newFileSize, changeNotes = '' } = {}, req = null) {
    const { transmission, isSender } = await this.verifyTransmissionAccess(transmissionId, user);
    if (!isSender) {
      throw new Error("Seul le service expéditeur peut soumettre une nouvelle version corrigée.");
    }

    // 1. Record previous document version in document_versions table
    const currentDoc = await db.get('SELECT * FROM documents WHERE id = ?', [transmission.document_id]);
    const maxVerRow = await db.get('SELECT MAX(version_number) as max_v FROM document_versions WHERE document_id = ?', [transmission.document_id]);
    const nextVer = (maxVerRow?.max_v || 1) + 1;

    await db.run(`
      INSERT INTO document_versions (document_id, version_number, title, object_title, content_body, change_notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      transmission.document_id,
      nextVer - 1,
      currentDoc.title || 'Document',
      currentDoc.title || 'Document',
      currentDoc.content_body || currentDoc.description || '',
      'Version précédente avant correction',
      user.id
    ]);

    // 2. Update document with new file
    if (newFilePath) {
      await db.run(`
        UPDATE documents SET file_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [newFilePath, transmission.document_id]);
    }

    // 3. Reset transmission status to EN_COURS_DE_TRAITEMENT / ENVOYE
    await db.run(`
      UPDATE service_transmissions 
      SET status = 'EN_COURS_DE_TRAITEMENT', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [transmissionId]);

    await this.recordHistory({
      transmissionId,
      userId: user.id,
      serviceId: user.service_id,
      action: 'NOUVELLE_VERSION',
      actionLabel: `Nouvelle version corrigée (v${nextVer}) transmise par ${user.first_name} ${user.last_name}`,
      comments: changeNotes || 'Document mis à jour suite à la demande de modification.'
    });

    // Notify recipient service
    await this.notifyServiceMembers({
      serviceId: transmission.to_service_id,
      title: 'Nouvelle version reçue',
      message: `Le service ${transmission.from_service_name} a transmis une nouvelle version pour le courrier ${transmission.transmission_number}.`,
      type: 'VERSION_SUBMITTED',
      resourceId: transmissionId
    });

    return { success: true, status: 'EN_COURS_DE_TRAITEMENT', version: nextVer };
  }

  // Approve Document by Service B
  async approve(transmissionId, user, { comments = '' } = {}, req = null) {
    const { transmission, isRecipient } = await this.verifyTransmissionAccess(transmissionId, user);
    if (!isRecipient) {
      throw new Error("Seul le service destinataire peut approuver ce courrier.");
    }

    await db.run(`
      UPDATE service_transmissions 
      SET status = 'APPROUVE',
          approved_by_user_id = ?,
          approved_at = CURRENT_TIMESTAMP,
          approval_comments = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [user.id, comments || 'Document approuvé.', transmissionId]);

    await this.recordHistory({
      transmissionId,
      userId: user.id,
      serviceId: user.service_id,
      action: 'APPROBATION',
      actionLabel: `Courrier approuvé par ${user.first_name} ${user.last_name} (${user.function_title || 'Responsable'})`,
      comments: comments || 'Document validé et approuvé sans réserve.'
    });

    // If signature is NOT required, return automatically
    if (!transmission.requires_signature) {
      await db.run(`
        UPDATE service_transmissions 
        SET status = 'RETOURNE', completed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [transmissionId]);

      await this.recordHistory({
        transmissionId,
        userId: user.id,
        serviceId: user.service_id,
        action: 'RETOUR_AUTOMATIQUE',
        actionLabel: `Retour automatique vers ${transmission.from_service_name}`,
        comments: 'Workflow validé et retourné automatiquement à l’expéditeur.'
      });

      await this.notifyServiceMembers({
        serviceId: transmission.from_service_id,
        title: 'Courrier approuvé et retourné',
        message: `Le service ${transmission.to_service_name} a approuvé votre courrier ${transmission.transmission_number}. Il est disponible dans vos courriers retournés.`,
        type: 'TRANSMISSION_RETURNED',
        resourceId: transmissionId
      });
    }

    return { success: true, status: transmission.requires_signature ? 'APPROUVE' : 'RETOURNE' };
  }

  // Sign Document Electronically & Automatically Return to Service A
  async sign(transmissionId, user, { signatureImagePath = null, comments = '', signedFilePath = null, signedFileName = null, signedFileSize = null } = {}, req = null) {
    const { transmission, isRecipient } = await this.verifyTransmissionAccess(transmissionId, user);
    if (!isRecipient) {
      throw new Error("Seul le service destinataire autorisé peut signer ce courrier.");
    }

    // Retrieve saved user signature if not directly supplied
    let finalSigPath = signatureImagePath;
    if (!finalSigPath) {
      const userSig = await db.get('SELECT signature_image_path FROM user_signatures WHERE user_id = ? AND is_active = 1', [user.id]);
      finalSigPath = userSig?.signature_image_path || null;
    }

    const signerTitle = user.function_title || 'Chef de Service / Responsable Habilité';
    const signerFullName = `${user.first_name} ${user.last_name}`;

    // Update transmission with signature data and IMMEDIATELY trigger AUTOMATIC RETURN
    await db.run(`
      UPDATE service_transmissions 
      SET status = 'RETOURNE',
          approved_by_user_id = COALESCE(approved_by_user_id, ?),
          approved_at = COALESCE(approved_at, CURRENT_TIMESTAMP),
          signed_by_user_id = ?,
          signed_at = CURRENT_TIMESTAMP,
          signer_name = ?,
          signer_function_title = ?,
          signature_image_path = ?,
          signed_file_path = COALESCE(?, signed_file_path),
          signed_file_name = COALESCE(?, signed_file_name),
          signed_file_size = COALESCE(?, signed_file_size),
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      user.id,
      user.id,
      signerFullName,
      signerTitle,
      finalSigPath,
      signedFilePath,
      signedFileName,
      signedFileSize,
      transmissionId
    ]);

    // Record Signature history
    await this.recordHistory({
      transmissionId,
      userId: user.id,
      serviceId: user.service_id,
      action: 'SIGNATURE',
      actionLabel: `Document signé électroniquement par ${signerFullName} (${signerTitle})`,
      comments: comments || 'Signature électronique et cachet officiel apposés avec succès.',
      metadata: {
        signer: signerFullName,
        function_title: signerTitle,
        signed_at: new Date().toISOString()
      }
    });

    // Record Automatic Return history (Continuity of workflow)
    await this.recordHistory({
      transmissionId,
      userId: user.id,
      serviceId: user.service_id,
      action: 'RETOUR_AUTOMATIQUE',
      actionLabel: `Retour automatique vers ${transmission.from_service_name}`,
      comments: `Le document approuvé et signé a été retourné automatiquement au Service Expéditeur.`
    });

    // Update main document status
    await db.run(`
      UPDATE documents SET status = 'SIGNE' WHERE id = ?
    `, [transmission.document_id]);

    // Notify Service A (Expéditeur)
    await this.notifyServiceMembers({
      serviceId: transmission.from_service_id,
      title: 'Courrier approuvé et signé disponible',
      message: `Le service ${transmission.to_service_name} a approuvé et signé votre courrier (${transmission.transmission_number}). Le document est disponible dans vos courriers retournés.`,
      type: 'TRANSMISSION_RETURNED',
      resourceId: transmissionId
    });

    if (req) {
      await logAuditAction(user.id, 'SIGN_INTER_SERVICE_TRANSMISSION', 'SERVICE_TRANSMISSION', transmissionId, req, {
        transmission_number: transmission.transmission_number,
        signer: signerFullName,
        signer_function: signerTitle
      });
    }

    return {
      success: true,
      status: 'RETOURNE',
      message: 'Courrier signé électroniquement et retourné avec succès au Service Expéditeur.',
      signer: signerFullName,
      signedAt: new Date().toISOString()
    };
  }

  // Reject Transmission with mandatory reason
  async reject(transmissionId, user, { reason } = {}, req = null) {
    if (!reason || !reason.trim()) {
      throw new Error("Le motif du refus est obligatoire.");
    }

    const { transmission, isRecipient } = await this.verifyTransmissionAccess(transmissionId, user);
    if (!isRecipient) {
      throw new Error("Seul le service destinataire peut refuser ce courrier.");
    }

    await db.run(`
      UPDATE service_transmissions 
      SET status = 'REFUSE',
          rejection_reason = ?,
          rejected_by_user_id = ?,
          rejected_at = CURRENT_TIMESTAMP,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [reason, user.id, transmissionId]);

    await this.recordHistory({
      transmissionId,
      userId: user.id,
      serviceId: user.service_id,
      action: 'REFUS',
      actionLabel: `Courrier refusé par ${user.first_name} ${user.last_name}`,
      comments: reason
    });

    // Notify Service A
    await this.notifyServiceMembers({
      serviceId: transmission.from_service_id,
      title: 'Courrier refusé',
      message: `Le service ${transmission.to_service_name} a refusé le courrier ${transmission.transmission_number} : "${reason}"`,
      type: 'TRANSMISSION_REJECTED',
      resourceId: transmissionId
    });

    return { success: true, status: 'REFUSE' };
  }

  // Archive Transmission in Service's own category
  async archive(transmissionId, user, { archiveCategoryId = null, comments = '' } = {}, req = null) {
    const { transmission, isSender, isRecipient } = await this.verifyTransmissionAccess(transmissionId, user);
    if (!isSender && !isRecipient) {
      throw new Error("Seuls les services impliqués peuvent archiver ce courrier.");
    }

    await db.run(`
      UPDATE service_transmissions 
      SET status = 'ARCHIVE',
          archived_at = CURRENT_TIMESTAMP,
          archived_by_user_id = ?,
          archived_category_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [user.id, archiveCategoryId || null, transmissionId]);

    // Update document archive status
    await db.run(`
      UPDATE documents 
      SET status = 'ARCHIVED', 
          archived_at = CURRENT_TIMESTAMP,
          archive_category_id = COALESCE(?, archive_category_id),
          archived_by_id = ?
      WHERE id = ?
    `, [archiveCategoryId || null, user.id, transmission.document_id]);

    await this.recordHistory({
      transmissionId,
      userId: user.id,
      serviceId: user.service_id,
      action: 'ARCHIVAGE',
      actionLabel: `Courrier archivé par ${user.first_name} ${user.last_name}`,
      comments: comments || 'Transmission et documents classés dans les archives du service.'
    });

    return { success: true, status: 'ARCHIVE' };
  }

  // Send notification to members of a specific service only
  async notifyServiceMembers({ serviceId, title, message, type, resourceId, documentId = null }) {
    try {
      const users = await db.all(`
        SELECT id FROM users WHERE service_id = ? AND status = 'ACTIVE'
      `, [serviceId]);

      for (const u of users) {
        await db.run(`
          INSERT INTO notifications (user_id, document_id, title, message, type)
          VALUES (?, ?, ?, ?, ?)
        `, [
          u.id,
          documentId || null,
          title,
          message,
          type || 'INFO'
        ]);
      }
    } catch (err) {
      console.warn('[TRANSMISSION_NOTIF] Avertissement lors de la notification:', err.message);
    }
  }
}

module.exports = new TransmissionService();
