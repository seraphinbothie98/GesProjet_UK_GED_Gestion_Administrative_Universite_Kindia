/**
 * Migration 008: User Account Security, Credentials Management & Immutable UID
 * Adds user_uid, token_version, must_change_password, password_reset_tokens table and security permissions.
 */

const crypto = require('crypto');

module.exports = {
  version: '008',
  name: 'user_account_security_and_credentials',

  async up(db) {
    // 1. Add columns to users table if they don't exist
    const userTableInfo = await db.all('PRAGMA table_info(users)');
    const colNames = userTableInfo.map(c => c.name);

    if (!colNames.includes('user_uid')) {
      await db.run('ALTER TABLE users ADD COLUMN user_uid VARCHAR(50)');
    }
    if (!colNames.includes('token_version')) {
      await db.run('ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 1');
    }
    if (!colNames.includes('must_change_password')) {
      await db.run('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0');
    }
    if (!colNames.includes('password_changed_at')) {
      await db.run('ALTER TABLE users ADD COLUMN password_changed_at DATETIME');
    }
    if (!colNames.includes('failed_login_attempts')) {
      await db.run('ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0');
    }
    if (!colNames.includes('locked_until')) {
      await db.run('ALTER TABLE users ADD COLUMN locked_until DATETIME DEFAULT NULL');
    }

    // 2. Populate user_uid for existing users who do not have one
    const existingUsers = await db.all('SELECT id, user_uid FROM users');
    for (const u of existingUsers) {
      if (!u.user_uid) {
        const generatedUid = `usr_${crypto.randomBytes(4).toString('hex')}`;
        await db.run('UPDATE users SET user_uid = ? WHERE id = ?', [generatedUid, u.id]);
      }
    }

    // 3. Create password_reset_tokens table for forgot password / reset requests
    await db.run(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME DEFAULT NULL,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_tokens(token_hash)
    `);
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_reset_token_user_id ON password_reset_tokens(user_id)
    `);

    // 4. Insert new permissions into permissions table
    const permissionsToAdd = [
      {
        code: 'users.reset_password',
        category: 'Administration',
        description: 'Réinitialiser le mot de passe d’un utilisateur et générer un mot de passe temporaire'
      },
      {
        code: 'users.manage_sessions',
        category: 'Administration',
        description: 'Révoquer et déconnecter les sessions actives d’un utilisateur'
      }
    ];

    for (const p of permissionsToAdd) {
      const existingPerm = await db.get('SELECT id FROM permissions WHERE code = ?', [p.code]);
      if (!existingPerm) {
        const permRes = await db.run(
          'INSERT INTO permissions (code, category, description) VALUES (?, ?, ?)',
          [p.code, p.category, p.description]
        );
        const permId = permRes.lastID;

        // Assign to role 'ADMINISTRATEUR'
        const adminRole = await db.get("SELECT id FROM roles WHERE code = 'ADMINISTRATEUR'");
        if (adminRole) {
          const existingRolePerm = await db.get(
            'SELECT * FROM role_permissions WHERE role_id = ? AND permission_id = ?',
            [adminRole.id, permId]
          );
          if (!existingRolePerm) {
            await db.run(
              'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
              [adminRole.id, permId]
            );
          }
        }
      }
    }
  },

  async down(db) {
    await db.run('DROP TABLE IF EXISTS password_reset_tokens');
    await db.run("DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code IN ('users.reset_password', 'users.manage_sessions'))");
    await db.run("DELETE FROM permissions WHERE code IN ('users.reset_password', 'users.manage_sessions')");
  }
};
