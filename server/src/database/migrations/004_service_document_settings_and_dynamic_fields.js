/**
 * Migration 004: Paramétrages de Documents de Service et Champs Dynamiques
 * Tables : service_document_settings, service_document_settings_history, service_custom_fields, document_type_configs
 */

module.exports = {
  async up(db) {
    await db.exec(`
      -- Configuration de numérotation et paramètres administratifs par service
      CREATE TABLE IF NOT EXISTS service_document_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        document_type_code TEXT NOT NULL,
        prefix TEXT NOT NULL DEFAULT 'REF',
        include_year INTEGER DEFAULT 1,
        year_format TEXT DEFAULT 'YYYY',
        separator TEXT DEFAULT '/',
        counter_digits INTEGER DEFAULT 4,
        next_counter INTEGER DEFAULT 1,
        reset_frequency TEXT DEFAULT 'ANNUAL',
        last_reset_year INTEGER,
        header_template TEXT,
        footer_template TEXT,
        requires_visa INTEGER DEFAULT 0,
        auto_archive INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        UNIQUE(service_id, document_type_code)
      );

      -- Historique des modifications de paramètres de service
      CREATE TABLE IF NOT EXISTS service_document_settings_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        document_type_code TEXT NOT NULL,
        changed_by_user_id INTEGER NOT NULL,
        change_summary TEXT NOT NULL,
        old_values_json TEXT,
        new_values_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
      );

      -- Champs dynamiques configurables par type de document et service
      CREATE TABLE IF NOT EXISTS service_custom_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        document_type_code TEXT NOT NULL,
        field_key TEXT NOT NULL,
        field_label TEXT NOT NULL,
        field_type TEXT NOT NULL DEFAULT 'TEXT', -- TEXT, NUMBER, DATE, SELECT, TEXTAREA, BOOLEAN
        options_json TEXT, -- Options pour champ SELECT
        is_required INTEGER DEFAULT 0,
        default_value TEXT,
        display_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        UNIQUE(service_id, document_type_code, field_key)
      );

      -- Configuration des types d'actes
      CREATE TABLE IF NOT EXISTS document_type_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL, -- COURRIER_ENTRANT, COURRIER_SORTANT, ACTE_ADMINISTRATIF, ORDRE_MISSION, etc.
        description TEXT,
        default_template_id INTEGER,
        icon TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  },

  async down(db) {
    // Non destructif
  }
};
