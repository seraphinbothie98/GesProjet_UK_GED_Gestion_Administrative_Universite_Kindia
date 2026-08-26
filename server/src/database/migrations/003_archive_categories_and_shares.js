/**
 * Migration 003: Catégories d'Archives Personnalisées et Partages
 * Tables : archive_categories, archive_shares, archive_custom_categories, archive_category_document_types
 */

module.exports = {
  async up(db) {
    await db.exec(`
      -- Catégories d'archives
      CREATE TABLE IF NOT EXISTS archive_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        retention_years INTEGER DEFAULT 5,
        service_id INTEGER,
        is_system INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
      );

      -- Partages d'archives entre services
      CREATE TABLE IF NOT EXISTS archive_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        from_service_id INTEGER NOT NULL,
        to_service_id INTEGER NOT NULL,
        shared_by_user_id INTEGER NOT NULL,
        share_type TEXT NOT NULL DEFAULT 'CONSULTATION',
        valid_until DATETIME,
        comments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (from_service_id) REFERENCES services(id),
        FOREIGN KEY (to_service_id) REFERENCES services(id),
        FOREIGN KEY (shared_by_user_id) REFERENCES users(id)
      );

      -- Catégories personnalisées par service
      CREATE TABLE IF NOT EXISTS archive_custom_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        description TEXT,
        retention_years INTEGER DEFAULT 5,
        is_default INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        UNIQUE(service_id, code)
      );

      -- Association types de documents et catégories
      CREATE TABLE IF NOT EXISTS archive_category_document_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        document_type_code TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES archive_custom_categories(id) ON DELETE CASCADE,
        UNIQUE(category_id, document_type_code)
      );
    `);

    // Colonnes d'archivage sur la table documents
    const docCols = await db.all("PRAGMA table_info(documents);");
    const dColNames = docCols.map(c => c.name);

    const docColsToAdd = [
      { name: 'archive_category_id', type: 'INTEGER REFERENCES archive_custom_categories(id)' },
      { name: 'archive_date', type: 'DATETIME' },
      { name: 'archived_by_id', type: 'INTEGER REFERENCES users(id)' },
      { name: 'is_digitized', type: 'INTEGER DEFAULT 0' },
      { name: 'source_origin', type: 'TEXT' },
      { name: 'confidentiality_level', type: "TEXT DEFAULT 'INTERNE'" }
    ];

    for (const col of docColsToAdd) {
      if (!dColNames.includes(col.name)) {
        await db.run(`ALTER TABLE documents ADD COLUMN ${col.name} ${col.type};`);
      }
    }
  },

  async down(db) {
    // Non destructif
  }
};
