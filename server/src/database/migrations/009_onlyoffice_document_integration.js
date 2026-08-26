/**
 * Migration 009: ONLYOFFICE Document Server Integration, Multi-user Editing Locks & Version Tracking
 */

module.exports = {
  version: '009',
  name: 'onlyoffice_document_integration',

  async up(db) {
    // 1. Create document_editing_locks table to track active ONLYOFFICE editing sessions
    await db.run(`
      CREATE TABLE IF NOT EXISTS document_editing_locks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        session_key TEXT NOT NULL UNIQUE,
        locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_editing_locks_doc ON document_editing_locks(document_id)
    `);

    // 2. Enhance document_versions table with file storage columns if missing
    const versionCols = (await db.all('PRAGMA table_info(document_versions)')).map(c => c.name);
    if (!versionCols.includes('file_path')) {
      await db.run('ALTER TABLE document_versions ADD COLUMN file_path TEXT');
    }
    if (!versionCols.includes('file_name')) {
      await db.run('ALTER TABLE document_versions ADD COLUMN file_name TEXT');
    }
    if (!versionCols.includes('file_size')) {
      await db.run('ALTER TABLE document_versions ADD COLUMN file_size INTEGER');
    }
    if (!versionCols.includes('uploaded_by')) {
      await db.run('ALTER TABLE document_versions ADD COLUMN uploaded_by INTEGER');
    }
    if (!versionCols.includes('change_summary')) {
      await db.run('ALTER TABLE document_versions ADD COLUMN change_summary TEXT');
    }
    if (!versionCols.includes('file_type')) {
      await db.run('ALTER TABLE document_versions ADD COLUMN file_type VARCHAR(20)');
    }
    if (!versionCols.includes('file_hash')) {
      await db.run('ALTER TABLE document_versions ADD COLUMN file_hash VARCHAR(128)');
    }
    if (!versionCols.includes('is_signed_version')) {
      await db.run('ALTER TABLE document_versions ADD COLUMN is_signed_version INTEGER DEFAULT 0');
    }

    // 3. Add permission for ONLYOFFICE edition
    const existingPerm = await db.get("SELECT id FROM permissions WHERE code = 'documents.onlyoffice_edit'");
    if (!existingPerm) {
      const permRes = await db.run(
        'INSERT INTO permissions (code, category, description) VALUES (?, ?, ?)',
        ['documents.onlyoffice_edit', 'Documents', 'Modifier des documents bureautiques en ligne via ONLYOFFICE Document Server']
      );
      const permId = permRes.lastID;

      // Assign to key roles
      const roles = await db.all(
        "SELECT id FROM roles WHERE code IN ('ADMINISTRATEUR', 'CHEF_SERVICE', 'AGENT_SECRÉTARIAT_CENTRAL', 'SECRÉTAIRE_GÉNÉRAL', 'RECTEUR', 'DAF', 'CONTRÔLEUR_FINANCIER')"
      );
      for (const r of roles) {
        const hasPerm = await db.get('SELECT * FROM role_permissions WHERE role_id = ? AND permission_id = ?', [r.id, permId]);
        if (!hasPerm) {
          await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [r.id, permId]);
        }
      }
    }
  },

  async down(db) {
    await db.run('DROP TABLE IF EXISTS document_editing_locks');
    await db.run("DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'documents.onlyoffice_edit')");
    await db.run("DELETE FROM permissions WHERE code = 'documents.onlyoffice_edit'");
  }
};
