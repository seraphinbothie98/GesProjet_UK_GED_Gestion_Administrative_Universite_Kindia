/**
 * Migration 006: Bordereaux d'Envoi, Récépissés Officiels, Ordres de Mission et Suivi QR
 * Tables : dispatches, dispatch_items, official_receipts, external_missionaries, mission_requests, mission_request_steps, verification_tokens, institution_settings
 */

module.exports = {
  async up(db) {
    await db.exec(`
      -- Paramètres institutionnels globaux
      CREATE TABLE IF NOT EXISTS institution_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Tokens de vérification publique QR Code
      CREATE TABLE IF NOT EXISTS verification_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        document_id INTEGER NOT NULL,
        qr_code_path TEXT,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      -- Missionnaires externes
      CREATE TABLE IF NOT EXISTS external_missionaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        organization TEXT NOT NULL,
        function_title TEXT,
        phone TEXT,
        email TEXT,
        id_card_number TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Demandes et étapes de mission
      CREATE TABLE IF NOT EXISTS mission_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER UNIQUE,
        mission_order_number TEXT,
        applicant_id INTEGER NOT NULL,
        destination TEXT NOT NULL,
        purpose TEXT NOT NULL,
        transport_mode TEXT NOT NULL,
        departure_date DATE NOT NULL,
        return_date DATE NOT NULL,
        estimated_budget REAL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'SUBMITTED',
        current_step INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
        FOREIGN KEY (applicant_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS mission_request_steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_request_id INTEGER NOT NULL,
        step_order INTEGER NOT NULL,
        role_code TEXT NOT NULL,
        assigned_user_id INTEGER,
        status TEXT NOT NULL DEFAULT 'PENDING',
        decision_date DATETIME,
        comments TEXT,
        FOREIGN KEY (mission_request_id) REFERENCES mission_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_user_id) REFERENCES users(id)
      );

      -- Bordereaux d'envoi (Dispatches)
      CREATE TABLE IF NOT EXISTS dispatches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dispatch_number TEXT UNIQUE NOT NULL,
        origin_service_id INTEGER NOT NULL,
        destination_organization TEXT NOT NULL,
        destination_address TEXT,
        bearer_name TEXT,
        bearer_phone TEXT,
        status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, SENT, RECEIVED, ARCHIVED
        dispatch_date DATE NOT NULL,
        notes TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (origin_service_id) REFERENCES services(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS dispatch_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dispatch_id INTEGER NOT NULL,
        document_id INTEGER,
        item_order INTEGER DEFAULT 1,
        designation TEXT NOT NULL,
        number_of_copies INTEGER DEFAULT 1,
        observation TEXT,
        FOREIGN KEY (dispatch_id) REFERENCES dispatches(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
      );

      -- Récépissés officiels de dépôt / décharge
      CREATE TABLE IF NOT EXISTS official_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT UNIQUE NOT NULL,
        document_id INTEGER NOT NULL,
        deponent_name TEXT NOT NULL,
        deponent_org TEXT,
        deponent_phone TEXT,
        reception_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        received_by_user_id INTEGER NOT NULL,
        qr_code_token TEXT,
        pdf_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (received_by_user_id) REFERENCES users(id)
      );
    `);
  },

  async down(db) {
    // Non destructif
  }
};
