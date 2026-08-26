/**
 * Migration 007: Système Sécurisé de Transmission Inter-Services avec Confidentialité Stricte
 * Tables : service_transmissions, service_transmission_history
 */

module.exports = {
  async up(db) {
    await db.exec(`
      -- 1. Table des Transmissions Inter-Services Confidentielles
      CREATE TABLE IF NOT EXISTS service_transmissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transmission_number TEXT UNIQUE NOT NULL, -- Ex: TR-2026-00045
        document_id INTEGER NOT NULL,
        from_service_id INTEGER NOT NULL,
        to_service_id INTEGER NOT NULL,
        from_user_id INTEGER NOT NULL,
        to_user_id INTEGER,
        subject TEXT NOT NULL,
        instruction TEXT,
        confidentiality_level TEXT NOT NULL DEFAULT 'CONFIDENTIEL_INTER_SERVICES', -- CONFIDENTIEL_INTER_SERVICES, TRES_CONFIDENTIEL
        status TEXT NOT NULL DEFAULT 'ENVOYE', 
        -- Statuts possibles : 'BROUILLON', 'ENVOYE', 'RECU', 'EN_COURS_DE_TRAITEMENT', 'MODIFICATION_DEMANDEE', 'APPROUVE', 'SIGNE', 'RETOUR_EN_COURS', 'RETOURNE', 'REFUSE', 'ARCHIVE'
        
        requires_signature INTEGER NOT NULL DEFAULT 1,
        
        -- Validation & Approbation
        approved_by_user_id INTEGER,
        approved_at DATETIME,
        approval_comments TEXT,
        
        -- Signature Électronique
        signed_by_user_id INTEGER,
        signed_at DATETIME,
        signer_name TEXT,
        signer_function_title TEXT,
        signature_image_path TEXT,
        signed_file_path TEXT,
        signed_file_name TEXT,
        signed_file_size INTEGER,
        
        -- Demande de modification
        modification_reason TEXT,
        modification_requested_by INTEGER,
        modification_requested_at DATETIME,
        
        -- Refus
        rejection_reason TEXT,
        rejected_by_user_id INTEGER,
        rejected_at DATETIME,
        
        -- Clôture & Archivage
        archived_at DATETIME,
        archived_by_user_id INTEGER,
        archived_category_id INTEGER,
        
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (from_service_id) REFERENCES services(id),
        FOREIGN KEY (to_service_id) REFERENCES services(id),
        FOREIGN KEY (from_user_id) REFERENCES users(id),
        FOREIGN KEY (to_user_id) REFERENCES users(id),
        FOREIGN KEY (approved_by_user_id) REFERENCES users(id),
        FOREIGN KEY (signed_by_user_id) REFERENCES users(id),
        FOREIGN KEY (modification_requested_by) REFERENCES users(id),
        FOREIGN KEY (rejected_by_user_id) REFERENCES users(id),
        FOREIGN KEY (archived_by_user_id) REFERENCES users(id),
        FOREIGN KEY (archived_category_id) REFERENCES archive_custom_categories(id)
      );

      -- Index pour isolation et performances de requêtes par service
      CREATE INDEX IF NOT EXISTS idx_transmissions_from_svc ON service_transmissions(from_service_id, status);
      CREATE INDEX IF NOT EXISTS idx_transmissions_to_svc ON service_transmissions(to_service_id, status);
      CREATE INDEX IF NOT EXISTS idx_transmissions_doc ON service_transmissions(document_id);
      CREATE INDEX IF NOT EXISTS idx_transmissions_num ON service_transmissions(transmission_number);

      -- 2. Historique Confidentiel de Traçabilité des Événements
      CREATE TABLE IF NOT EXISTS service_transmission_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transmission_id INTEGER NOT NULL,
        user_id INTEGER,
        service_id INTEGER,
        action TEXT NOT NULL, 
        -- 'CREATION', 'ENVOI', 'RECEPTION', 'PRISE_EN_CHARGE', 'MODIFICATION_DEMANDEE', 'NOUVELLE_VERSION', 'APPROBATION', 'SIGNATURE', 'RETOUR_AUTOMATIQUE', 'REFUS', 'ARCHIVAGE', 'SUPERVISION_ADMIN'
        action_label TEXT NOT NULL,
        comments TEXT,
        metadata_json TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transmission_id) REFERENCES service_transmissions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sth_transmission ON service_transmission_history(transmission_id);
    `);

    // Ajout de colonne 'is_inter_service_transmission' sur documents pour verrouillage strict ABAC
    const docCols = await db.all("PRAGMA table_info(documents);");
    const dColNames = docCols.map(c => c.name);

    if (!dColNames.includes('is_inter_service_transmission')) {
      await db.run("ALTER TABLE documents ADD COLUMN is_inter_service_transmission INTEGER DEFAULT 0;");
    }
    if (!dColNames.includes('active_transmission_id')) {
      await db.run("ALTER TABLE documents ADD COLUMN active_transmission_id INTEGER REFERENCES service_transmissions(id);");
    }
  },

  async down(db) {
    // Non destructif
  }
};
