/**
 * Migration 005: Modèles Documentaires, Signatures Électroniques et Versionnage
 * Tables : document_templates, template_versions, template_fields, user_signatures, document_versions, appointments, workflow_rules
 */

module.exports = {
  async up(db) {
    await db.exec(`
      -- Modèles de documents officiels (Word/DOCX et PDF)
      CREATE TABLE IF NOT EXISTS document_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        document_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        variables_json TEXT, -- Liste des balises/variables supportées
        preview_image_path TEXT,
        service_id INTEGER,
        is_system INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS template_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL,
        version_number INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        change_notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS template_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL,
        field_key TEXT NOT NULL,
        field_label TEXT NOT NULL,
        field_type TEXT NOT NULL DEFAULT 'TEXT',
        is_required INTEGER DEFAULT 0,
        FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE CASCADE
      );

      -- Signatures et cachets électroniques des utilisateurs
      CREATE TABLE IF NOT EXISTS user_signatures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        signature_path TEXT,
        stamp_path TEXT,
        is_active INTEGER DEFAULT 1,
        pin_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Historique des versions de fichiers documents
      CREATE TABLE IF NOT EXISTS document_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        version_number INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        uploaded_by INTEGER,
        change_summary TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(document_id, version_number)
      );

      -- Rendez-vous et audiences
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        visitor_name TEXT NOT NULL,
        visitor_organization TEXT,
        visitor_phone TEXT,
        visitor_email TEXT,
        target_service_id INTEGER,
        target_user_id INTEGER,
        appointment_date DATETIME NOT NULL,
        duration_minutes INTEGER DEFAULT 30,
        status TEXT NOT NULL DEFAULT 'PENDING',
        purpose TEXT,
        notes TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (target_service_id) REFERENCES services(id) ON DELETE SET NULL,
        FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      -- Règles de circuit de validation (workflow)
      CREATE TABLE IF NOT EXISTS workflow_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_type TEXT NOT NULL,
        service_id INTEGER,
        step_order INTEGER NOT NULL,
        role_code TEXT NOT NULL,
        action_type TEXT NOT NULL, -- VISA, SIGNATURE, APPROBATION, CLASSEMENT
        is_mandatory INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      );
    `);
  },

  async down(db) {
    // Non destructif
  }
};
