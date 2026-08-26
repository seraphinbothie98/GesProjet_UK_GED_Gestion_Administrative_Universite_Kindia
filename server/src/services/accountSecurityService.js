/**
 * Account Security & Credentials Management Service for UK-GED
 * Handles self-service identifier changes, password policy enforcement,
 * forgot password tokens, administrative resets, and session revocation.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { JWT_SECRET, JWT_EXPIRES_IN, NODE_ENV } = require('../config/constants');
const { logAuditAction } = require('../middleware/audit');

class AccountSecurityService {
  /**
   * Validate password against the University security policy:
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one digit
   * - At least one special character
   */
  validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, message: 'Le mot de passe est obligatoire.' };
    }

    if (password.length < 8) {
      return { valid: false, message: 'Le mot de passe doit comporter au moins 8 caractères.' };
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      return {
        valid: false,
        message: 'Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule, un chiffre et un caractère spécial.'
      };
    }

    return { valid: true };
  }

  /**
   * Generate an immutable alphanumeric identifier (usr_xxxxxxxx)
   */
  generateUserUid() {
    return `usr_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Self-Service: Update User Identifier (Email / Matricule / Username)
   * Protected by current password verification.
   * Maintains immutable internal ID (id / user_uid) so no documents or history are broken.
   */
  async updateIdentifier(userId, currentPassword, { newEmail, newMatricule }, req = null) {
    if (!currentPassword) {
      throw new Error('Le mot de passe actuel est obligatoire pour modifier vos identifiants.');
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new Error('Utilisateur introuvable.');
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      const err = new Error('Mot de passe actuel incorrect.');
      err.status = 401;
      throw err;
    }

    const updates = [];
    const params = [];
    const auditMeta = {
      old_email: user.email,
      old_matricule: user.matricule
    };

    // 1. Validate & Update Email if provided
    if (newEmail !== undefined && newEmail.trim() !== '') {
      const emailNorm = newEmail.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNorm)) {
        throw new Error('Format d’adresse email invalide.');
      }

      // Check uniqueness
      const duplicateEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', [emailNorm, userId]);
      if (duplicateEmail) {
        throw new Error('Cette adresse email est déjà utilisée par un autre compte.');
      }

      updates.push('email = ?');
      params.push(emailNorm);
      auditMeta.new_email = emailNorm;
    }

    // 2. Validate & Update Matricule / Identifier if provided
    if (newMatricule !== undefined && newMatricule.trim() !== '') {
      const matriculeNorm = newMatricule.trim();
      if (matriculeNorm.length < 3) {
        throw new Error('L’identifiant / matricule doit comporter au moins 3 caractères.');
      }

      // Check uniqueness
      const duplicateMatricule = await db.get('SELECT id FROM users WHERE LOWER(matricule) = ? AND id != ?', [matriculeNorm.toLowerCase(), userId]);
      if (duplicateMatricule) {
        throw new Error('Cet identifiant / matricule est déjà utilisé par un autre compte.');
      }

      updates.push('matricule = ?');
      params.push(matriculeNorm);
      auditMeta.new_matricule = matriculeNorm;
    }

    if (updates.length === 0) {
      throw new Error('Aucune modification d’identifiant fournie.');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    await db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    if (req) {
      await logAuditAction(userId, 'UPDATE_IDENTIFIER', 'USER', userId, req, auditMeta);
    }

    // Fetch updated user
    const updatedUser = await db.get(
      `SELECT u.id, u.user_uid, u.matricule, u.first_name, u.last_name, u.email, u.phone, u.function_title,
              u.service_id, u.role_id, u.status, s.name as service_name, r.name as role_name, r.code as role_code
       FROM users u
       LEFT JOIN services s ON u.service_id = s.id
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [userId]
    );

    return {
      success: true,
      message: 'Identifiants mis à jour avec succès.',
      user: updatedUser
    };
  }

  /**
   * Self-Service: Change User Password
   * Verifies current password, applies security policy, increments token_version, and issues new token.
   */
  async changePassword(userId, currentPassword, newPassword, req = null) {
    if (!currentPassword || !newPassword) {
      throw new Error('Le mot de passe actuel et le nouveau mot de passe sont requis.');
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new Error('Utilisateur introuvable.');
    }

    // 1. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      const err = new Error('Le mot de passe actuel est incorrect.');
      err.status = 401;
      throw err;
    }

    // 2. Validate new password strength
    const strength = this.validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new Error(strength.message);
    }

    // 3. Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);
    const nextTokenVersion = (user.token_version || 1) + 1;

    // 4. Update database
    await db.run(`
      UPDATE users 
      SET password_hash = ?,
          token_version = ?,
          must_change_password = 0,
          password_changed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newHash, nextTokenVersion, userId]);

    if (req) {
      await logAuditAction(userId, 'CHANGE_PASSWORD', 'USER', userId, req, {
        token_version: nextTokenVersion
      });
    }

    // 5. Generate fresh token with new token_version
    const role = await db.get('SELECT code FROM roles WHERE id = ?', [user.role_id]);
    const newToken = jwt.sign(
      { userId: user.id, roleCode: role?.code, tokenVersion: nextTokenVersion },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      success: true,
      message: 'Mot de passe modifié avec succès. Toutes les autres sessions ont été invalidées.',
      token: newToken
    };
  }

  /**
   * Forgot Password Flow: Request password reset token
   * Returns a generic response to prevent username/email enumeration attacks.
   */
  async requestPasswordReset(identity, req = null) {
    if (!identity || typeof identity !== 'string' || !identity.trim()) {
      throw new Error('Veuillez renseigner votre identifiant ou adresse email institutionnelle.');
    }

    const normalized = identity.trim().toLowerCase();
    const user = await db.get(
      'SELECT id, email, matricule, status FROM users WHERE (LOWER(email) = ? OR LOWER(matricule) = ?) AND status = "ACTIVE"',
      [normalized, normalized]
    );

    let rawToken = null;

    if (user) {
      // Generate 32-byte cryptographic random token
      rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      // 30 minutes validity
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const ipAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || '127.0.0.1';
      const userAgent = req?.headers['user-agent'] || 'Unknown';

      // Store hashed token
      await db.run(`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?)
      `, [user.id, tokenHash, expiresAt, ipAddress, userAgent]);

      if (req) {
        await logAuditAction(user.id, 'PASSWORD_RESET_REQUESTED', 'USER', user.id, req, {
          expires_at: expiresAt
        });
      }
    }

    // Generic safe response
    return {
      success: true,
      message: 'Si un compte actif correspond à ces identifiants, un jeton de réinitialisation sécurisé a été généré.',
      // For development/test environments or local testing, provide token if user exists
      resetToken: ((NODE_ENV === 'development' || NODE_ENV === 'test') && rawToken) ? rawToken : undefined
    };
  }

  /**
   * Forgot Password Flow: Verify reset token and set new password
   */
  async verifyAndResetPassword(rawToken, newPassword, req = null) {
    if (!rawToken || !newPassword) {
      throw new Error('Jeton de réinitialisation et nouveau mot de passe requis.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const record = await db.get(`
      SELECT prt.*, u.id as user_id, u.status as user_status, u.token_version
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token_hash = ? AND prt.used_at IS NULL
    `, [tokenHash]);

    if (!record) {
      throw new Error('Jeton de réinitialisation invalide ou déjà utilisé.');
    }

    if (new Date(record.expires_at) < new Date()) {
      throw new Error('Ce jeton de réinitialisation a expiré. Veuillez renouveler votre demande.');
    }

    if (record.user_status !== 'ACTIVE') {
      throw new Error('Ce compte utilisateur est désactivé.');
    }

    // Validate new password strength
    const strength = this.validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new Error(strength.message);
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const nextTokenVersion = (record.token_version || 1) + 1;

    // Mark token used & update password
    await db.run('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?', [record.id]);
    await db.run(`
      UPDATE users 
      SET password_hash = ?,
          token_version = ?,
          must_change_password = 0,
          password_changed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newHash, nextTokenVersion, record.user_id]);

    if (req) {
      await logAuditAction(record.user_id, 'PASSWORD_RESET_COMPLETED', 'USER', record.user_id, req, {
        token_id: record.id
      });
    }

    return {
      success: true,
      message: 'Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
    };
  }

  /**
   * Admin Password Reset (Requires permission `users.reset_password`)
   * Generates a high-entropy temporary password, sets `must_change_password = 1`, and revokes active sessions.
   */
  async adminResetPassword(adminUser, targetUserId, { customTempPassword = null } = {}, req = null) {
    if (!adminUser.permissions?.includes('users.reset_password') && adminUser.role_code !== 'ADMINISTRATEUR') {
      const err = new Error('Permission insuffisante (users.reset_password requise) pour réinitialiser le mot de passe.');
      err.status = 403;
      throw err;
    }

    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      throw new Error('Utilisateur cible introuvable.');
    }

    // Generate secure temporary password if not provided
    const tempPassword = customTempPassword || `Uk@${crypto.randomBytes(4).toString('hex')}!`;
    const tempHash = await bcrypt.hash(tempPassword, 10);
    const nextTokenVersion = (targetUser.token_version || 1) + 1;

    await db.run(`
      UPDATE users 
      SET password_hash = ?,
          must_change_password = 1,
          token_version = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [tempHash, nextTokenVersion, targetUserId]);

    if (req) {
      await logAuditAction(adminUser.id, 'ADMIN_RESET_PASSWORD', 'USER', targetUserId, req, {
        target_user_matricule: targetUser.matricule,
        target_user_email: targetUser.email,
        must_change_password: 1
      });
    }

    return {
      success: true,
      message: `Mot de passe temporaire généré avec succès pour ${targetUser.first_name} ${targetUser.last_name}.`,
      temporaryPassword: tempPassword,
      targetUserId,
      targetUserName: `${targetUser.first_name} ${targetUser.last_name}`
    };
  }

  /**
   * Force change password on first login after admin reset
   */
  async forceChangeTemporaryPassword(userId, currentTempPassword, newPassword, req = null) {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      throw new Error('Utilisateur introuvable.');
    }

    if (user.must_change_password !== 1) {
      throw new Error('Ce compte ne requiert pas de changement de mot de passe obligatoire.');
    }

    const isMatch = await bcrypt.compare(currentTempPassword, user.password_hash);
    if (!isMatch) {
      const err = new Error('Le mot de passe temporaire est incorrect.');
      err.status = 401;
      throw err;
    }

    const strength = this.validatePasswordStrength(newPassword);
    if (!strength.valid) {
      throw new Error(strength.message);
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const nextTokenVersion = (user.token_version || 1) + 1;

    await db.run(`
      UPDATE users 
      SET password_hash = ?,
          must_change_password = 0,
          token_version = ?,
          password_changed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newHash, nextTokenVersion, userId]);

    if (req) {
      await logAuditAction(userId, 'FORCED_PASSWORD_CHANGED', 'USER', userId, req);
    }

    const role = await db.get('SELECT code FROM roles WHERE id = ?', [user.role_id]);
    const newToken = jwt.sign(
      { userId: user.id, roleCode: role?.code, tokenVersion: nextTokenVersion },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      success: true,
      message: 'Votre nouveau mot de passe a été enregistré avec succès.',
      token: newToken
    };
  }

  /**
   * Revoke all active sessions for a user (Increment token_version)
   */
  async revokeSessions(targetUserId, authorUser, req = null) {
    const targetUser = await db.get('SELECT * FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      throw new Error('Utilisateur introuvable.');
    }

    const nextTokenVersion = (targetUser.token_version || 1) + 1;
    await db.run('UPDATE users SET token_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [nextTokenVersion, targetUserId]);

    if (req) {
      await logAuditAction(authorUser.id, 'REVOKE_SESSIONS', 'USER', targetUserId, req, {
        new_token_version: nextTokenVersion
      });
    }

    return {
      success: true,
      message: `Toutes les sessions de l'utilisateur ont été révoquées avec succès.`,
      tokenVersion: nextTokenVersion
    };
  }

  /**
   * Get complete security info for user
   */
  async getSecurityInfo(userId) {
    const user = await db.get(`
      SELECT id, user_uid, matricule, email, status, last_login, must_change_password, password_changed_at, token_version, created_at
      FROM users WHERE id = ?
    `, [userId]);

    if (!user) {
      throw new Error('Utilisateur introuvable.');
    }

    return {
      id: user.id,
      user_uid: user.user_uid,
      matricule: user.matricule,
      email: user.email,
      status: user.status,
      last_login: user.last_login,
      must_change_password: user.must_change_password === 1,
      password_changed_at: user.password_changed_at,
      token_version: user.token_version || 1,
      created_at: user.created_at
    };
  }
}

module.exports = new AccountSecurityService();
