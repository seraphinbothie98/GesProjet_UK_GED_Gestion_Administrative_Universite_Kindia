/**
 * ONLYOFFICE Document Server Integration Service for UK-GED
 * Handles ABAC permission checks, secure token generation, immutable versioning,
 * multi-user editing locks, and callback processing for administrative documents.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { UPLOAD_DIR, JWT_SECRET, NODE_ENV } = require('../config/constants');
const { logAuditAction } = require('../middleware/audit');

// Configuration ONLYOFFICE
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || 'uk_ged_onlyoffice_secret_2026';
const ONLYOFFICE_DOCUMENT_SERVER_URL = process.env.ONLYOFFICE_DOCUMENT_SERVER_URL || 'http://localhost:8080';
const ONLYOFFICE_INTERNAL_SERVER_URL = process.env.ONLYOFFICE_INTERNAL_SERVER_URL || ONLYOFFICE_DOCUMENT_SERVER_URL;
const ONLYOFFICE_CALLBACK_URL = process.env.ONLYOFFICE_CALLBACK_URL || process.env.APP_URL || 'http://localhost:5000';

// Formats bureautiques officiellement pris en charge
const SUPPORTED_EDIT_FORMATS = ['docx', 'doc', 'odt', 'rtf', 'txt', 'xlsx', 'xls', 'ods', 'csv', 'pptx', 'ppt', 'odp'];
const SUPPORTED_VIEW_FORMATS = [...SUPPORTED_EDIT_FORMATS, 'pdf'];

class OnlyofficeDocumentService {
  /**
   * Check if file extension is supported by ONLYOFFICE
   */
  isFormatSupported(fileNameOrPath) {
    if (!fileNameOrPath) return false;
    const ext = path.extname(fileNameOrPath).replace('.', '').toLowerCase();
    return SUPPORTED_VIEW_FORMATS.includes(ext);
  }

  isEditableFormat(fileNameOrPath) {
    if (!fileNameOrPath) return false;
    const ext = path.extname(fileNameOrPath).replace('.', '').toLowerCase();
    return SUPPORTED_EDIT_FORMATS.includes(ext);
  }

  getDocumentTypeCategory(ext) {
    const wordExts = ['docx', 'doc', 'odt', 'rtf', 'txt', 'pdf'];
    const cellExts = ['xlsx', 'xls', 'ods', 'csv'];
    const slideExts = ['pptx', 'ppt', 'odp'];

    if (cellExts.includes(ext)) return 'cell';
    if (slideExts.includes(ext)) return 'slide';
    return 'word';
  }

  /**
   * Determine exact permission mode (edit vs view) under UK-GED business rules & ABAC
   */
  async determineDocumentPermission(document, user) {
    // 1. If document is archived or central archived -> Strict Read-Only
    if (
      document.status === 'ARCHIVED' || 
      document.status === 'ARCHIVÉ' || 
      document.is_central_archived === 1 || 
      document.archived_at
    ) {
      return {
        canAccess: true,
        mode: 'view',
        reason: 'Document archivé définitivement (Consultation en lecture seule)'
      };
    }

    // 2. If document is signed electronically -> Strict Read-Only
    if (
      document.status === 'SIGNÉ' || 
      document.status === 'SIGNED' || 
      document.status === 'REMIS AU DEMANDEUR' || 
      document.status === 'REMIS AU MISSIONNAIRE'
    ) {
      return {
        canAccess: true,
        mode: 'view',
        reason: 'Document officiel scellé et signé (Consultation en lecture seule)'
      };
    }

    // 3. If document is locked in administrative circuit -> Strict Read-Only
    if (document.is_locked === 1) {
      return {
        canAccess: true,
        mode: 'view',
        reason: 'Document verrouillé dans le circuit de validation'
      };
    }

    // 4. If format is not editable (e.g. PDF) -> View only
    const ext = path.extname(document.file_path || '').replace('.', '').toLowerCase();
    if (!SUPPORTED_EDIT_FORMATS.includes(ext)) {
      return {
        canAccess: true,
        mode: 'view',
        reason: `Format .${ext} supporté en lecture seule`
      };
    }

    // 4.5. Règle stricte : Ordres de mission transmis pour signature SG (Modification interdite dans ce workflow)
    if (
      (document.document_type === 'MISSION_ORDER' || document.document_type === 'ORDRE_MISSION') &&
      (user.role_code === 'SECRÉTAIRE_GÉNÉRAL' || (document.status && document.status.includes('SIGNATURE')) || (document.status && document.status.includes('TRANSMIS')))
    ) {
      return {
        canAccess: true,
        mode: 'view',
        reason: 'Ordre de mission officiel transmis pour signature (Modification interdite dans ce circuit)'
      };
    }

    // 5. Check user RBAC/ABAC rights
    const isAdmin = user.role_code === 'ADMINISTRATEUR';
    const isAuthor = document.created_by === user.id;
    const isCurrentHolder = document.current_user_id === user.id;
    const isSameService = document.current_service_id === user.service_id;
    const hasEditPerm = user.permissions?.includes('documents.onlyoffice_edit') || 
                        user.permissions?.includes('documents.edit') || 
                        user.permissions?.includes('documents.create');

    if (isAdmin || (hasEditPerm && (isAuthor || isCurrentHolder || isSameService))) {
      return {
        canAccess: true,
        mode: 'edit',
        reason: 'Utilisateur autorisé à modifier le document'
      };
    }

    // Default to view mode for standard readers
    return {
      canAccess: true,
      mode: 'view',
      reason: 'Mode consultation (Droits de modification non attribués)'
    };
  }

  /**
   * Generate secure token for ONLYOFFICE file access
   */
  generateFileAccessToken(documentId, versionNumber, userId) {
    return jwt.sign(
      {
        documentId,
        versionNumber: versionNumber || 1,
        userId,
        purpose: 'ONLYOFFICE_DOC_ACCESS'
      },
      ONLYOFFICE_JWT_SECRET,
      { expiresIn: '2h' }
    );
  }

  /**
   * Generate secure token for ONLYOFFICE save callback
   */
  generateCallbackToken(documentId, userId) {
    return jwt.sign(
      {
        documentId,
        userId,
        purpose: 'ONLYOFFICE_DOC_CALLBACK'
      },
      ONLYOFFICE_JWT_SECRET,
      { expiresIn: '12h' }
    );
  }

  /**
   * Acquire or refresh active editing lock
   */
  async acquireEditingLock(documentId, user) {
    // Clean expired locks
    await db.run('DELETE FROM document_editing_locks WHERE expires_at < CURRENT_TIMESTAMP');

    // Check existing lock by another user
    const existingLock = await db.get(`
      SELECT l.*, u.first_name, u.last_name, u.email
      FROM document_editing_locks l
      JOIN users u ON l.user_id = u.id
      WHERE l.document_id = ? AND l.user_id != ? AND l.expires_at > CURRENT_TIMESTAMP
    `, [documentId, user.id]);

    if (existingLock) {
      return {
        locked: true,
        lockedBy: `${existingLock.first_name} ${existingLock.last_name}`,
        lockedAt: existingLock.locked_at,
        expiresAt: existingLock.expires_at
      };
    }

    // Create or update lock for current user (15 min window)
    const sessionKey = `lock_doc_${documentId}_u_${user.id}_${Date.now()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await db.run(`
      INSERT INTO document_editing_locks (document_id, user_id, session_key, locked_at, expires_at, last_heartbeat)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(session_key) DO UPDATE SET
        expires_at = excluded.expires_at,
        last_heartbeat = CURRENT_TIMESTAMP
    `, [documentId, user.id, sessionKey, expiresAt]);

    return { locked: false, sessionKey, expiresAt };
  }

  /**
   * Release editing lock
   */
  async releaseEditingLock(documentId, user) {
    await db.run('DELETE FROM document_editing_locks WHERE document_id = ? AND user_id = ?', [documentId, user.id]);
  }

  /**
   * Build complete ONLYOFFICE Docs Editor configuration object
   */
  async buildDocumentSessionConfig(documentId, user, req = null) {
    const document = await db.get(`
      SELECT d.*, s.name as service_name, s.code as service_code
      FROM documents d
      LEFT JOIN services s ON d.current_service_id = s.id
      WHERE d.id = ? AND d.status != 'TRASHED'
    `, [documentId]);

    if (!document) {
      throw new Error('Document introuvable ou supprimé.');
    }

    // Check permissions
    const perm = await this.determineDocumentPermission(document, user);
    if (!perm.canAccess) {
      const err = new Error(perm.reason || 'Accès non autorisé à ce document.');
      err.status = 403;
      throw err;
    }

    // Multi-user lock check
    let lockInfo = null;
    let actualMode = perm.mode;

    // Clean expired locks
    await db.run('DELETE FROM document_editing_locks WHERE expires_at < CURRENT_TIMESTAMP');

    // Check active lock by another user
    const existingLock = await db.get(`
      SELECT l.*, u.first_name, u.last_name, u.email
      FROM document_editing_locks l
      JOIN users u ON l.user_id = u.id
      WHERE l.document_id = ? AND l.user_id != ? AND l.expires_at > CURRENT_TIMESTAMP
    `, [documentId, user.id]);

    if (existingLock) {
      lockInfo = {
        locked: true,
        lockedBy: `${existingLock.first_name} ${existingLock.last_name}`,
        lockedAt: existingLock.locked_at,
        expiresAt: existingLock.expires_at
      };
      if (perm.mode === 'edit') {
        actualMode = 'view';
      }
    } else if (perm.mode === 'edit') {
      const lockResult = await this.acquireEditingLock(documentId, user);
      if (lockResult.locked) {
        lockInfo = lockResult;
        actualMode = 'view';
      }
    }

    const versionNum = document.current_version || 1;
    const filePath = document.file_path || '';
    const fileExt = (path.extname(filePath).replace('.', '') || 'docx').toLowerCase();
    const docTypeCategory = this.getDocumentTypeCategory(fileExt);

    // Document Key for ONLYOFFICE caching: format UKGED_DOC_<id>_V<ver>_<timestamp>
    const fileTimestamp = document.updated_at ? new Date(document.updated_at).getTime() : Date.now();
    const documentKey = `UKGED_DOC_${document.id}_V${versionNum}_${fileTimestamp}`;

    const docAccessToken = this.generateFileAccessToken(document.id, versionNum, user.id);
    const callbackToken = this.generateCallbackToken(document.id, user.id);

    const documentUrl = `${ONLYOFFICE_CALLBACK_URL}/api/documents/${document.id}/onlyoffice/file?token=${encodeURIComponent(docAccessToken)}`;
    const callbackUrl = `${ONLYOFFICE_CALLBACK_URL}/api/documents/${document.id}/onlyoffice/callback?token=${encodeURIComponent(callbackToken)}`;

    const config = {
      document: {
        fileType: fileExt,
        key: documentKey,
        title: `${document.reference || document.title || 'Document'}_v${versionNum}.${fileExt}`,
        url: documentUrl,
        permissions: {
          download: true,
          edit: actualMode === 'edit',
          print: true,
          review: false,
          comment: false,
          fillForms: true,
          modifyFilter: true,
          modifyContentControl: true
        }
      },
      documentType: docTypeCategory,
      editorConfig: {
        mode: actualMode,
        lang: 'fr',
        callbackUrl: callbackUrl,
        user: {
          id: `usr_${user.id}`,
          name: `${user.first_name || ''} ${user.last_name || user.matricule}`.trim()
        },
        customization: {
          autosave: false,
          forcesave: true,
          comments: false,
          feedback: false,
          help: false,
          hideRightMenu: false,
          toolbarHideFileName: false,
          toolbarNoTabs: false,
          logo: {
            image: `${ONLYOFFICE_CALLBACK_URL}/uploads/logos/logo_kindia.png`,
            imageEmbedded: `${ONLYOFFICE_CALLBACK_URL}/uploads/logos/logo_kindia.png`,
            url: ONLYOFFICE_CALLBACK_URL
          },
          customer: {
            name: 'Université de Kindia - GED',
            address: 'Kindia, République de Guinée',
            mail: 'contact@univ-kindia.edu.gn',
            www: 'https://univ-kindia.edu.gn'
          },
          uiTheme: 'theme-classic-light'
        }
      }
    };

    // Sign configuration with ONLYOFFICE JWT Secret
    if (ONLYOFFICE_JWT_SECRET) {
      config.token = jwt.sign(config, ONLYOFFICE_JWT_SECRET);
    }

    if (req) {
      await logAuditAction(user.id, 'DOCUMENT_OPENED_WITH_ONLYOFFICE', 'DOCUMENT', document.id, req, {
        mode: actualMode,
        version: versionNum,
        document_key: documentKey
      });
    }

    return {
      config,
      docServerUrl: ONLYOFFICE_DOCUMENT_SERVER_URL,
      documentKey,
      mode: actualMode,
      lockInfo,
      reason: perm.reason
    };
  }

  /**
   * Handle ONLYOFFICE Save Callback
   * Status 2 / 6: Download saved file, create a new version without overwriting previous file, update DB & audit
   */
  async handleCallback(documentId, payload, req = null) {
    const { status, url, users, key } = payload;
    const document = await db.get('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!document) {
      return { error: 1, message: 'Document introuvable' };
    }

    // Status 1: Document is being edited
    if (status === 1) {
      return { error: 0 };
    }

    // Status 4: Document closed without changes
    if (status === 4) {
      await db.run('DELETE FROM document_editing_locks WHERE document_id = ?', [documentId]);
      return { error: 0 };
    }

    // Status 2 (Ready for saving) or Status 6 (Forcesave)
    if (status === 2 || status === 6) {
      if (!url) {
        return { error: 1, message: 'URL de téléchargement manquante' };
      }

      // 1. Download the modified file from ONLYOFFICE Document Server
      const ext = path.extname(document.file_path || '.docx') || '.docx';
      const nextVersion = (document.current_version || 1) + 1;
      const newFileName = `doc_${document.id}_v${nextVersion}_${Date.now()}${ext}`;
      const newFilePath = path.join(UPLOAD_DIR, newFileName);

      await this.downloadFile(url, newFilePath);

      const stats = fs.statSync(newFilePath);
      const fileBuffer = fs.readFileSync(newFilePath);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // 2. Save new record in document_versions (IMMUTABLE HISTORY)
      const editingUserId = (users && users.length > 0) ? parseInt(users[0].replace('usr_', '')) : document.created_by;

      await db.run(`
        INSERT INTO document_versions (
          document_id, version_number, title, file_path, file_name, file_size, file_type, file_hash, 
          created_by, uploaded_by, change_notes, change_summary, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        document.id,
        nextVersion,
        document.title || document.reference || 'Document Administratif',
        newFileName,
        newFileName,
        stats.size,
        ext.replace('.', '').toUpperCase(),
        fileHash,
        editingUserId,
        editingUserId,
        `Modification effectuée via ONLYOFFICE Document Server (v${nextVersion})`,
        `Modification effectuée via ONLYOFFICE Document Server (v${nextVersion})`
      ]);

      // 3. Update active document pointer without destroying previous file
      await db.run(`
        UPDATE documents 
        SET file_path = ?,
            current_version = ?,
            last_edited_by = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newFileName, nextVersion, editingUserId, document.id]);

      // 4. Release editing lock
      await db.run('DELETE FROM document_editing_locks WHERE document_id = ?', [documentId]);

      // 5. Log audit trail
      if (req) {
        await logAuditAction(editingUserId, 'DOCUMENT_VERSION_CREATED', 'DOCUMENT', document.id, req, {
          version_number: nextVersion,
          file_name: newFileName,
          file_size: stats.size,
          sha256: fileHash,
          source: 'ONLYOFFICE'
        });
      }

      return { error: 0 };
    }

    return { error: 0 };
  }

  /**
   * Helper: Download file from URL to local path
   */
  downloadFile(fileUrl, destPath) {
    return new Promise((resolve, reject) => {
      const client = fileUrl.startsWith('https') ? https : http;
      const file = fs.createWriteStream(destPath);

      client.get(fileUrl, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`Échec du téléchargement ONLYOFFICE: HTTP ${response.statusCode}`));
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close(resolve);
        });
      }).on('error', (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }

  /**
   * Check ONLYOFFICE Document Server Health
   */
  async checkHealth() {
    return new Promise((resolve) => {
      const healthUrl = `${ONLYOFFICE_INTERNAL_SERVER_URL}/healthcheck`;
      const client = healthUrl.startsWith('https') ? https : http;

      const req = client.get(healthUrl, { timeout: 3000 }, (res) => {
        if (res.statusCode === 200) {
          resolve({
            status: 'HEALTHY',
            url: ONLYOFFICE_DOCUMENT_SERVER_URL,
            version: '8.2.2'
          });
        } else {
          resolve({
            status: 'DEGRADED',
            url: ONLYOFFICE_DOCUMENT_SERVER_URL,
            statusCode: res.statusCode
          });
        }
      });

      req.on('error', () => {
        resolve({
          status: 'UNAVAILABLE',
          url: ONLYOFFICE_DOCUMENT_SERVER_URL,
          message: 'Serveur ONLYOFFICE temporairement inaccessible (Dégradation contrôlée active)'
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          status: 'TIMEOUT',
          url: ONLYOFFICE_DOCUMENT_SERVER_URL,
          message: 'Délai d’attente dépassé'
        });
      });
    });
  }
}

module.exports = new OnlyofficeDocumentService();
