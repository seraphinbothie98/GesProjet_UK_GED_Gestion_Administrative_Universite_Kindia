/**
 * Migration 002: Hiérarchie Administrative et Historique des Responsables
 * Ajout des champs de rattachement hiérarchique, métadonnées de service et table service_heads_history
 */

module.exports = {
  async up(db) {
    // 1. Table d'historique des responsables de service
    await db.exec(`
      CREATE TABLE IF NOT EXISTS service_heads_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        function_title TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        is_current INTEGER DEFAULT 1,
        appointment_act_ref TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_shh_service ON service_heads_history(service_id);
      CREATE INDEX IF NOT EXISTS idx_shh_user ON service_heads_history(user_id);
    `);

    // 2. Colonnes additionnelles sur la table services (non-destructif)
    const serviceCols = await db.all("PRAGMA table_info(services);");
    const sColNames = serviceCols.map(c => c.name);

    const colsToAdd = [
      { name: 'parent_id', type: 'INTEGER REFERENCES services(id)' },
      { name: 'structure_type', type: "TEXT NOT NULL DEFAULT 'SERVICE'" },
      { name: 'acronym', type: 'TEXT' },
      { name: 'reference_code', type: 'TEXT' },
      { name: 'head_user_id', type: 'INTEGER REFERENCES users(id)' },
      { name: 'function_title', type: 'TEXT' },
      { name: 'header_text', type: 'TEXT' },
      { name: 'logo_path', type: 'TEXT' },
      { name: 'stamp_path', type: 'TEXT' },
      { name: 'address', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'order_index', type: 'INTEGER DEFAULT 0' }
    ];

    for (const col of colsToAdd) {
      if (!sColNames.includes(col.name)) {
        await db.run(`ALTER TABLE services ADD COLUMN ${col.name} ${col.type};`);
      }
    }
  },

  async down(db) {
    // Non destructif
  }
};
