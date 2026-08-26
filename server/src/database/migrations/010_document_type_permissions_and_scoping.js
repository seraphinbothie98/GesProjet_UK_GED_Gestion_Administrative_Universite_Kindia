/**
 * Migration 010: Document Type Permissions, Configurable Access Control & Service-Scoped Template Rules
 */

module.exports = {
  version: '010',
  name: 'document_type_permissions_and_scoping',

  async up(db) {
    // 1. Create document_type_permissions table
    await db.run(`
      CREATE TABLE IF NOT EXISTS document_type_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_type_code VARCHAR(64) NOT NULL,
        service_id INTEGER,
        role_id INTEGER,
        can_create INTEGER DEFAULT 1,
        can_edit INTEGER DEFAULT 1,
        can_view INTEGER DEFAULT 1,
        can_delete INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        UNIQUE(document_type_code, service_id, role_id)
      )
    `);

    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_dt_perms_code ON document_type_permissions(document_type_code)
    `);
    await db.run(`
      CREATE INDEX IF NOT EXISTS idx_dt_perms_service ON document_type_permissions(service_id)
    `);

    // 2. Enhance document_type_configs with is_restricted and metadata columns
    const cols = (await db.all('PRAGMA table_info(document_type_configs)')).map(c => c.name);
    if (!cols.includes('is_restricted')) {
      await db.run('ALTER TABLE document_type_configs ADD COLUMN is_restricted INTEGER DEFAULT 0');
    }
    if (!cols.includes('default_reference_pattern')) {
      await db.run('ALTER TABLE document_type_configs ADD COLUMN default_reference_pattern TEXT');
    }
    if (!cols.includes('allowed_fields_json')) {
      await db.run('ALTER TABLE document_type_configs ADD COLUMN allowed_fields_json TEXT');
    }

    // 3. Ensure LOI document type exists
    const existingLoi = await db.get("SELECT code FROM document_type_configs WHERE code = 'LOI'");
    if (!existingLoi) {
      await db.run(`
        INSERT INTO document_type_configs (code, label, category, allow_direct_archive, description, icon, is_active, is_restricted, display_order)
        VALUES ('LOI', 'Lois', 'REGULATORY', 1, 'Lois et textes législatifs de la République', 'Scale', 1, 1, 8)
      `);
    }

    // 4. Mark restricted types (DECRET, ARRETE, LOI, DECISION, etc.) vs ordinary types
    const restrictedCodes = ['DECRET', 'ARRETE', 'LOI', 'DECISION', 'CIRCULAIRE', 'INSTRUCTION'];
    for (const code of restrictedCodes) {
      await db.run('UPDATE document_type_configs SET is_restricted = 1 WHERE code = ?', [code]);
    }

    const ordinaryCodes = [
      'RAPPORT', 'PROCES_VERBAL', 'ATTESTATION', 'LETTRE', 'ADMIN_LETTER',
      'INVITATION', 'SOIT_TRANSMIS', 'DEMANDE', 'DEMANDE_ADMIN', 'NOTE_SERVICE',
      'CONVOCATION', 'DOC_ADMIN', 'CORRESPONDANCE', 'AUTRE', 'NON_CLASSE', 'MISSION_ORDER', 'COURRIER_ENTRANT'
    ];
    for (const code of ordinaryCodes) {
      await db.run('UPDATE document_type_configs SET is_restricted = 0 WHERE code = ?', [code]);
    }

    // Set default reference patterns
    await db.run("UPDATE document_type_configs SET default_reference_pattern = 'RAP/{SERVICE}/{ANNEE}/{NUMERO}' WHERE code = 'RAPPORT'");
    await db.run("UPDATE document_type_configs SET default_reference_pattern = 'ARR/{SERVICE}/{ANNEE}/{NUMERO}' WHERE code = 'ARRETE'");
    await db.run("UPDATE document_type_configs SET default_reference_pattern = 'DEC/{SERVICE}/{ANNEE}/{NUMERO}' WHERE code = 'DECISION'");
    await db.run("UPDATE document_type_configs SET default_reference_pattern = 'DEC/{ANNEE}/{NUMERO}' WHERE code = 'DECRET'");
    await db.run("UPDATE document_type_configs SET default_reference_pattern = 'LOI/{ANNEE}/{NUMERO}' WHERE code = 'LOI'");
    await db.run("UPDATE document_type_configs SET default_reference_pattern = 'PV/{SERVICE}/{ANNEE}/{NUMERO}' WHERE code = 'PROCES_VERBAL'");
    await db.run("UPDATE document_type_configs SET default_reference_pattern = 'ATT/{SERVICE}/{ANNEE}/{NUMERO}' WHERE code = 'ATTESTATION'");
    await db.run("UPDATE document_type_configs SET default_reference_pattern = 'NS/{SERVICE}/{ANNEE}/{NUMERO}' WHERE code = 'NOTE_SERVICE'");
    await db.run("UPDATE document_type_configs SET default_reference_pattern = 'ST/{SERVICE}/{ANNEE}/{NUMERO}' WHERE code = 'SOIT_TRANSMIS'");
    await db.run("UPDATE document_type_configs SET default_reference_pattern = 'LET/{SERVICE}/{ANNEE}/{NUMERO}' WHERE code = 'LETTRE'");

    // 5. Add administrative permission for Document Types
    const existingPerm = await db.get("SELECT id FROM permissions WHERE code = 'document_types.manage'");
    if (!existingPerm) {
      const permRes = await db.run(
        'INSERT INTO permissions (code, category, description) VALUES (?, ?, ?)',
        ['document_types.manage', 'Administration', 'Gérer le catalogue des types de documents et les permissions de création par service']
      );
      const adminRole = await db.get("SELECT id FROM roles WHERE code = 'ADMINISTRATEUR'");
      if (adminRole) {
        await db.run('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [adminRole.id, permRes.lastID]);
      }
    }
  },

  async down(db) {
    await db.run('DROP TABLE IF EXISTS document_type_permissions');
    await db.run("DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE code = 'document_types.manage')");
    await db.run("DELETE FROM permissions WHERE code = 'document_types.manage'");
  }
};
