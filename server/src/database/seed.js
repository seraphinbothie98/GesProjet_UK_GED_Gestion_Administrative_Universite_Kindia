const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { INITIAL_SERVICES, PERMISSIONS, ROLES } = require('../config/constants');

async function seedDatabase() {
  try {
    console.log('--- INITIALIZING UK-GED DATABASE SCHEMA ---');
    try {
      const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
      await db.exec(schemaSql);
    } catch (sErr) {
      // Schema tables already created
    }

    // Dynamic column migrations for documents table
    const docCols = await db.all("PRAGMA table_info(documents)");
    const colNames = docCols.map(c => c.name);
    if (!colNames.includes('tracking_token')) {
      await db.run("ALTER TABLE documents ADD COLUMN tracking_token TEXT;");
    }
    if (!colNames.includes('rejection_reason')) {
      await db.run("ALTER TABLE documents ADD COLUMN rejection_reason TEXT;");
    }
    if (!colNames.includes('rejected_by')) {
      await db.run("ALTER TABLE documents ADD COLUMN rejected_by INTEGER;");
    }
    if (!colNames.includes('processing_mode')) {
      await db.run("ALTER TABLE documents ADD COLUMN processing_mode TEXT DEFAULT 'NORMAL';");
    }
    if (!colNames.includes('document_date')) {
      await db.run("ALTER TABLE documents ADD COLUMN document_date DATE;");
    }
    if (!colNames.includes('has_external_signature')) {
      await db.run("ALTER TABLE documents ADD COLUMN has_external_signature INTEGER DEFAULT 0;");
    }
    if (!colNames.includes('external_signatory_name')) {
      await db.run("ALTER TABLE documents ADD COLUMN external_signatory_name TEXT;");
    }
    if (!colNames.includes('external_signature_date')) {
      await db.run("ALTER TABLE documents ADD COLUMN external_signature_date DATE;");
    }
    if (!colNames.includes('deleted_at')) {
      await db.run("ALTER TABLE documents ADD COLUMN deleted_at DATETIME;");
    }
    if (!colNames.includes('deleted_by')) {
      await db.run("ALTER TABLE documents ADD COLUMN deleted_by INTEGER;");
    }
    if (!colNames.includes('deletion_reason')) {
      await db.run("ALTER TABLE documents ADD COLUMN deletion_reason TEXT;");
    }
    if (!colNames.includes('previous_status')) {
      await db.run("ALTER TABLE documents ADD COLUMN previous_status TEXT;");
    }
    if (!colNames.includes('reference_meta')) {
      await db.run("ALTER TABLE documents ADD COLUMN reference_meta TEXT;");
    }
    if (!colNames.includes('file_path')) {
      await db.run("ALTER TABLE documents ADD COLUMN file_path TEXT;");
    }

    // Dynamic column & constraint migration for users table
    const userCols = await db.all("PRAGMA table_info(users)");
    const userColNames = userCols.map(c => c.name);
    if (!userColNames.includes('can_receive_appointments')) {
      await db.run("ALTER TABLE users ADD COLUMN can_receive_appointments INTEGER DEFAULT 1;");
    }
    if (!userColNames.includes('personnel_category')) {
      await db.run("ALTER TABLE users ADD COLUMN personnel_category TEXT DEFAULT 'PERSONNEL_ADMINISTRATIF';");
    }
    if (!userColNames.includes('academic_structure')) {
      await db.run("ALTER TABLE users ADD COLUMN academic_structure TEXT;");
    }

    // Re-create users table if service_id has NOT NULL constraint
    const serviceIdCol = userCols.find(c => c.name === 'service_id');
    if (serviceIdCol && serviceIdCol.notnull === 1) {
      await db.exec(`
        PRAGMA foreign_keys=OFF;
        CREATE TABLE users_temp AS SELECT * FROM users;
        DROP TABLE users;
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            matricule TEXT UNIQUE NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            function_title TEXT NOT NULL,
            personnel_category TEXT DEFAULT 'PERSONNEL_ADMINISTRATIF',
            academic_structure TEXT,
            service_id INTEGER,
            role_id INTEGER NOT NULL,
            password_hash TEXT NOT NULL,
            can_receive_appointments INTEGER DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'ACTIVE',
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (service_id) REFERENCES services(id),
            FOREIGN KEY (role_id) REFERENCES roles(id)
        );
        INSERT INTO users (id, matricule, first_name, last_name, email, phone, function_title, service_id, role_id, password_hash, can_receive_appointments, status, last_login, created_at, updated_at)
        SELECT id, matricule, first_name, last_name, email, phone, function_title, service_id, role_id, password_hash, can_receive_appointments, status, last_login, created_at, updated_at FROM users_temp;
        DROP TABLE users_temp;
        PRAGMA foreign_keys=ON;
      `);
    }

    // Dynamic column migration for mission_orders table
    const moCols = await db.all("PRAGMA table_info(mission_orders)");
    const moColNames = moCols.map(c => c.name);
    const newMoCols = [
      { name: 'missionary_id', type: 'INTEGER' },
      { name: 'driver_id', type: 'INTEGER' },
      { name: 'vehicle_id', type: 'INTEGER' },
      { name: 'driver_option', type: "TEXT DEFAULT 'SELF'" },
      { name: 'missionary_name_snapshot', type: 'TEXT' },
      { name: 'missionary_firstnames_snapshot', type: 'TEXT' },
      { name: 'missionary_nationality_snapshot', type: 'TEXT' },
      { name: 'missionary_function_snapshot', type: 'TEXT' },
      { name: 'missionary_service_snapshot', type: 'TEXT' },
      { name: 'missionary_matricule_snapshot', type: 'TEXT' },
      { name: 'driver_name_snapshot', type: 'TEXT' },
      { name: 'vehicle_registration_snapshot', type: 'TEXT' },
      { name: 'printed_at', type: 'DATETIME' },
      { name: 'printed_by_user_id', type: 'INTEGER' },
      { name: 'print_count', type: 'INTEGER DEFAULT 0' },
      { name: 'delivered_at', type: 'DATETIME' },
      { name: 'delivered_by_user_id', type: 'INTEGER' },
      { name: 'recipient_name', type: 'TEXT' },
      { name: 'reception_signature_path', type: 'TEXT' },
      { name: 'rejection_reason', type: 'TEXT' },
      { name: 'correction_notes', type: 'TEXT' },
      { name: 'personnel_category', type: 'TEXT' },
      { name: 'faculty_dept', type: 'TEXT' },
      { name: 'version', type: 'INTEGER DEFAULT 1' },
      { name: 'template_id', type: 'INTEGER' },
      { name: 'template_version_id', type: 'INTEGER' },
      { name: 'template_version_number', type: 'INTEGER' },
      { name: 'generated_file_path', type: 'TEXT' },
      { name: 'generated_docx_path', type: 'TEXT' },
      { name: 'signed_pdf_path', type: 'TEXT' },
      { name: 'returned_to_sc_at', type: 'DATETIME' },
      { name: 'returned_by_user_id', type: 'INTEGER' }
    ];

    for (const c of newMoCols) {
      if (!moColNames.includes(c.name)) {
        await db.run(`ALTER TABLE mission_orders ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Dynamic column migration for external_missionaries table
    const extCols = await db.all("PRAGMA table_info(external_missionaries)");
    const extColNames = extCols.map(c => c.name);
    const newExtCols = [
      { name: 'issuing_authority', type: 'TEXT' },
      { name: 'observations', type: 'TEXT' },
      { name: 'current_service_id', type: 'INTEGER REFERENCES services(id)' },
      { name: 'current_user_id', type: 'INTEGER REFERENCES users(id)' },
      { name: 'signed_at', type: 'DATETIME' },
      { name: 'signed_by_user_id', type: 'INTEGER REFERENCES users(id)' },
      { name: 'signed_document_path', type: 'TEXT' },
      { name: 'rejection_reason', type: 'TEXT' },
      { name: 'rejected_by_user_id', type: 'INTEGER REFERENCES users(id)' },
      { name: 'rejected_at', type: 'DATETIME' },
      { name: 'delivered_at', type: 'DATETIME' },
      { name: 'delivered_by_user_id', type: 'INTEGER REFERENCES users(id)' },
      { name: 'recipient_name', type: 'TEXT' },
      { name: 'delivery_notes', type: 'TEXT' },
      { name: 'print_count', type: 'INTEGER DEFAULT 0' },
      { name: 'is_locked', type: 'INTEGER DEFAULT 0' }
    ];

    for (const c of newExtCols) {
      if (!extColNames.includes(c.name)) {
        await db.run(`ALTER TABLE external_missionaries ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Ensure external_missionary_history table exists
    await db.exec(`
      CREATE TABLE IF NOT EXISTS external_missionary_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        missionary_id INTEGER NOT NULL REFERENCES external_missionaries(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        service_id INTEGER REFERENCES services(id),
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_ext_miss_hist_miss_id ON external_missionary_history(missionary_id);

      CREATE TABLE IF NOT EXISTS mission_order_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reference TEXT UNIQUE NOT NULL,
        tracking_token TEXT UNIQUE,
        user_id INTEGER REFERENCES users(id),
        applicant_last_name TEXT NOT NULL,
        applicant_first_names TEXT NOT NULL,
        applicant_function TEXT NOT NULL,
        applicant_matricule TEXT,
        applicant_service_name TEXT NOT NULL,
        applicant_phone TEXT NOT NULL,
        applicant_email TEXT NOT NULL,
        applicant_institution TEXT DEFAULT 'Université de Kindia',
        object_of_mission TEXT NOT NULL,
        destination TEXT NOT NULL,
        country TEXT DEFAULT 'Guinée',
        exact_location TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        duration_days INTEGER,
        transport_means TEXT DEFAULT 'VÉHICULE OFFICIEL',
        justification_motif TEXT,
        host_organization TEXT,
        local_contact TEXT,
        status TEXT NOT NULL DEFAULT 'DEMANDE ENREGISTRÉE',
        rejection_reason TEXT,
        complement_request_notes TEXT,
        official_document_id INTEGER REFERENCES documents(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_mo_req_ref ON mission_order_requests(reference);
      CREATE INDEX IF NOT EXISTS idx_mo_req_status ON mission_order_requests(status);
      CREATE INDEX IF NOT EXISTS idx_mo_req_phone ON mission_order_requests(applicant_phone);
      CREATE INDEX IF NOT EXISTS idx_mo_req_email ON mission_order_requests(applicant_email);

      CREATE TABLE IF NOT EXISTS mission_order_request_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL REFERENCES mission_order_requests(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        role_name TEXT,
        action TEXT NOT NULL,
        old_status TEXT,
        new_status TEXT,
        observation TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_mo_req_hist_req_id ON mission_order_request_history(request_id);

      CREATE TABLE IF NOT EXISTS mission_order_request_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL REFERENCES mission_order_requests(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_mo_req_att_req_id ON mission_order_request_attachments(request_id);
    `);

    // Dynamic column migration for document_templates table
    const dtCols = await db.all("PRAGMA table_info(document_templates)");
    const dtColNames = dtCols.map(c => c.name);
    const newDtCols = [
      { name: 'editor_type', type: "TEXT DEFAULT 'UK_GED_EDITOR'" },
      { name: 'category', type: "TEXT DEFAULT 'OFFICIAL'" },
      { name: 'document_type_code', type: 'TEXT' },
      { name: 'description', type: 'TEXT' },
      { name: 'format', type: "TEXT DEFAULT 'DOCX'" },
      { name: 'version', type: 'INTEGER DEFAULT 1' },
      { name: 'is_active', type: 'INTEGER DEFAULT 1' },
      { name: 'is_default', type: 'INTEGER DEFAULT 0' },
      { name: 'file_path', type: 'TEXT' },
      { name: 'logo_path', type: 'TEXT' },
      { name: 'font_family', type: "TEXT DEFAULT 'Helvetica'" },
      { name: 'font_size', type: 'INTEGER DEFAULT 12' },
      { name: 'primary_color', type: "TEXT DEFAULT '#0B2545'" },
      { name: 'secondary_color', type: "TEXT DEFAULT '#D4AF37'" },
      { name: 'content_body_html', type: 'TEXT' },
      { name: 'header_html', type: 'TEXT' },
      { name: 'footer_html', type: 'TEXT' },
      { name: 'created_by', type: 'INTEGER' }
    ];

    for (const c of newDtCols) {
      if (!dtColNames.includes(c.name)) {
        await db.run(`ALTER TABLE document_templates ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Dynamic column migration for user_signatures table
    const sigCols = await db.all("PRAGMA table_info(user_signatures)");
    const sigColNames = sigCols.map(c => c.name);
    const newSigCols = [
      { name: 'version_number', type: 'INTEGER DEFAULT 1' },
      { name: 'is_active', type: 'INTEGER DEFAULT 1' },
      { name: 'created_by', type: 'INTEGER' }
    ];

    for (const c of newSigCols) {
      if (!sigColNames.includes(c.name)) {
        await db.run(`ALTER TABLE user_signatures ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Dynamic column migration for template_versions table
    const tvCols = await db.all("PRAGMA table_info(template_versions)");
    const tvColNames = tvCols.map(c => c.name);
    const newTvCols = [
      { name: 'version_number', type: 'INTEGER DEFAULT 1' },
      { name: 'file_type', type: 'TEXT' },
      { name: 'editor_type', type: "TEXT DEFAULT 'UK_GED_EDITOR'" },
      { name: 'content_body_html', type: 'TEXT' },
      { name: 'change_description', type: 'TEXT' },
      { name: 'uploaded_by', type: 'INTEGER' }
    ];

    for (const c of newTvCols) {
      if (!tvColNames.includes(c.name)) {
        await db.run(`ALTER TABLE template_versions ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Dynamic column migration for institution_settings table (Dynamic Reference System)
    const instCols = await db.all("PRAGMA table_info(institution_settings)");
    const instColNames = instCols.map(c => c.name);
    const newInstCols = [
      { name: 'ministry_code', type: "TEXT DEFAULT 'MESRS'" },
      { name: 'institution_code', type: "TEXT DEFAULT 'UK'" },
      { name: 'structure_name', type: "TEXT DEFAULT 'Rectorat'" },
      { name: 'structure_code', type: "TEXT DEFAULT 'RECT'" },
      { name: 'authority_name', type: "TEXT DEFAULT 'Secrétaire Général'" },
      { name: 'authority_code', type: "TEXT DEFAULT 'SG'" },
      { name: 'reference_pattern', type: "TEXT DEFAULT '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}'" },
      { name: 'sequence_padding', type: "INTEGER DEFAULT 4" },
      { name: 'reference_type_patterns', type: "TEXT" }
    ];

    for (const c of newInstCols) {
      if (!instColNames.includes(c.name)) {
        await db.run(`ALTER TABLE institution_settings ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Dynamic column migration for external_missionaries table (Reference Metadata history)
    if (!extColNames.includes('reference_meta')) {
      await db.run("ALTER TABLE external_missionaries ADD COLUMN reference_meta TEXT;");
    }

    // Dynamic column migration for mission_order_requests table
    const moReqCols = await db.all("PRAGMA table_info(mission_order_requests)");
    const moReqColNames = moReqCols.map(c => c.name);
    const newMoReqCols = [
      { name: 'destination_service_id', type: 'INTEGER DEFAULT 5' },
      { name: 'destination_service_name', type: "TEXT DEFAULT 'Secrétariat Central'" }
    ];

    for (const c of newMoReqCols) {
      if (!moReqColNames.includes(c.name)) {
        await db.run(`ALTER TABLE mission_order_requests ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Dynamic column migration for notifications table
    const notifCols = await db.all("PRAGMA table_info(notifications)");
    const notifColNames = notifCols.map(c => c.name);
    if (!notifColNames.includes('appointment_id')) {
      await db.run('ALTER TABLE notifications ADD COLUMN appointment_id INTEGER;');
    }

    console.log('Schema executed and migrated successfully.');

    // Seed Document Type Configurations
    console.log('--- SEEDING DOCUMENT TYPE CONFIGURATIONS ---');
    const defaultTypes = [
      { code: 'SOIT_TRANSMIS', label: 'Soit-transmis', category: 'Correspondances', allow_direct_archive: 0 },
      { code: 'MISSION_ORDER', label: 'Ordre de mission', category: 'Missions', allow_direct_archive: 0 },
      { code: 'DECRET', label: 'Décret', category: 'Actes Officiels', allow_direct_archive: 1 },
      { code: 'ARRETE', label: 'Arrêté', category: 'Actes Officiels', allow_direct_archive: 1 },
      { code: 'NOTE_SERVICE', label: 'Note de service', category: 'Notes & Décisions', allow_direct_archive: 1 },
      { code: 'DECISION', label: 'Décision', category: 'Notes & Décisions', allow_direct_archive: 1 },
      { code: 'CIRCULAIRE', label: 'Circulaire', category: 'Notes & Décisions', allow_direct_archive: 1 },
      { code: 'CONVOCATION', label: 'Convocation', category: 'Correspondances', allow_direct_archive: 0 },
      { code: 'ATTESTATION', label: 'Attestation', category: 'Administratif', allow_direct_archive: 1 },
      { code: 'PROCES_VERBAL', label: 'Procès-verbal', category: 'Comptes Rendus', allow_direct_archive: 1 },
      { code: 'RAPPORT', label: 'Rapport', category: 'Comptes Rendus', allow_direct_archive: 1 },
      { code: 'ADMIN_LETTER', label: 'Lettre administrative', category: 'Correspondances', allow_direct_archive: 0 },
      { code: 'INSTRUCTION', label: 'Instruction officielle', category: 'Actes Officiels', allow_direct_archive: 1 },
      { code: 'DOC_ADMIN', label: 'Document administratif définitif', category: 'Administratif', allow_direct_archive: 1 },
      { code: 'COURRIER_ENTRANT', label: 'Courrier entrant général', category: 'Correspondances', allow_direct_archive: 0 },
      { code: 'DEMANDE_ADMIN', label: 'Demande administrative', category: 'Correspondances', allow_direct_archive: 0 }
    ];

    for (const dt of defaultTypes) {
      let existing = await db.get('SELECT code FROM document_type_configs WHERE code = ?', [dt.code]);
      if (!existing) {
        await db.run(
          'INSERT INTO document_type_configs (code, label, category, allow_direct_archive) VALUES (?, ?, ?, ?)',
          [dt.code, dt.label, dt.category, dt.allow_direct_archive]
        );
      }
    }

    // 1. Seed Roles
    console.log('--- SEEDING ROLES ---');
    const roleEntries = [
      { code: ROLES.ADMIN, name: 'Administrateur Système', desc: 'Accès complet d’administration' },
      { code: ROLES.AGENT_SC, name: 'Agent Secrétariat Central', desc: 'Gestion des courriers entrants et enregistrements' },
      { code: ROLES.SG, name: 'Secrétaire Général', desc: 'Orientation globale, gestion administrative & signatures' },
      { code: ROLES.RECTEUR, name: 'Recteur', desc: 'Supervision rectorale, orientations & arbitrages' },
      { code: ROLES.CHEF_SERVICE, name: 'Chef de Service', desc: 'Responsable de division ou de faculté' },
      { code: ROLES.RESPONSABLE_ADMIN, name: 'Responsable Administratif', desc: 'Traitement des courriers et missions du service' },
      { code: ROLES.STANDARD, name: 'Utilisateur Standard', desc: 'Agent de service exécutant' }
    ];

    const roleIds = {};
    for (const r of roleEntries) {
      let existing = await db.get('SELECT id FROM roles WHERE code = ?', [r.code]);
      if (!existing) {
        const res = await db.run('INSERT INTO roles (code, name, description) VALUES (?, ?, ?)', [r.code, r.name, r.desc]);
        roleIds[r.code] = res.lastID;
      } else {
        roleIds[r.code] = existing.id;
      }
    }

    // 2. Seed Permissions
    console.log('--- SEEDING PERMISSIONS ---');
    const permIds = {};
    for (const p of PERMISSIONS) {
      let existing = await db.get('SELECT id FROM permissions WHERE code = ?', [p.code]);
      if (!existing) {
        const res = await db.run('INSERT INTO permissions (code, category, description) VALUES (?, ?, ?)', [p.code, p.category, p.description]);
        permIds[p.code] = res.lastID;
      } else {
        permIds[p.code] = existing.id;
      }
    }

    // Seed Institution Settings
    console.log('--- SEEDING INSTITUTION SETTINGS ---');
    const existingInst = await db.get('SELECT id FROM institution_settings WHERE id = 1');
    if (!existingInst) {
      await db.run(
        `INSERT INTO institution_settings (id, name, ministry, address, phone, email, website, slogan)
         VALUES (1, 'UNIVERSITÉ DE KINDIA', 'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION', 'Quartier Foulayah, BP 164, Kindia, Guinée', '+224 622 00 00 00', 'contact@univ-kindia.edu.gn', 'www.univ-kindia.edu.gn', 'Savoir - Innovation - Excellence')`
      );
    }

    // Seed Default Document Templates
    console.log('--- SEEDING DOCUMENT TEMPLATES ---');
    const defaultTemplates = [
      { code: 'SOIT_TRANSMIS', name: 'Soit-Transmis Officiel', category: 'Correspondances', header: 'RÉPUBLIQUE DE GUINÉE\nTravail – Justice – Solidarité\n\nMINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION\n\nUNIVERSITÉ DE KINDIA\n\nSECRÉTARIAT GÉNÉRAL', footer: 'UNIVERSITÉ DE KINDIA • BP 164 Kindia, Guinée • Tél: +224 622 00 00 00 • E-mail: contact@univ-kindia.edu.gn' },
      { code: 'MISSION_ORDER', name: 'Ordre de Mission', category: 'Missions', header: 'RÉPUBLIQUE DE GUINÉE\nTravail – Justice – Solidarité\n\nMINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION\n\nUNIVERSITÉ DE KINDIA\n\nSECRÉTARIAT GÉNÉRAL', footer: 'UNIVERSITÉ DE KINDIA • BP 164 Kindia, Guinée • Tél: +224 622 00 00 00 • E-mail: contact@univ-kindia.edu.gn' },
      { code: 'OFFICIAL_MAIL', name: 'Courrier officiel', category: 'Correspondances', header: 'RÉPUBLIQUE DE GUINÉE\nTravail – Justice – Solidarité\n\nUNIVERSITÉ DE KINDIA', footer: 'UNIVERSITÉ DE KINDIA • Service Courrier' },
      { code: 'NOTE_SERVICE', name: 'Note de service', category: 'Notes & Décisions', header: 'RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA', footer: 'UNIVERSITÉ DE KINDIA • Direction des Services Administratifs' },
      { code: 'DECISION', name: 'Décision', category: 'Notes & Décisions', header: 'RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA', footer: 'UNIVERSITÉ DE KINDIA • Rectorat' },
      { code: 'ARRETE', name: 'Arrêté', category: 'Actes Officiels', header: 'RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA', footer: 'UNIVERSITÉ DE KINDIA • Cabinet du Recteur' },
      { code: 'PROCES_VERBAL', name: 'Procès-verbal', category: 'Comptes Rendus', header: 'RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA', footer: 'UNIVERSITÉ DE KINDIA • Secrétariat Central' }
    ];

    for (const t of defaultTemplates) {
      const existingT = await db.get('SELECT id FROM document_templates WHERE code = ?', [t.code]);
      let templateId = null;
      if (!existingT) {
        const res = await db.run(
          `INSERT INTO document_templates (code, name, category, header_text, footer_text, is_active, version) VALUES (?, ?, ?, ?, ?, 1, 1)`,
          [t.code, t.name, t.category, t.header, t.footer]
        );
        templateId = res.lastID;
      } else {
        templateId = existingT.id;
      }

      // Seed default fields for SOIT_TRANSMIS
      if (t.code === 'SOIT_TRANSMIS') {
        const fieldCount = await db.get('SELECT COUNT(*) as count FROM template_fields WHERE template_id = ?', [templateId]);
        if (fieldCount && fieldCount.count === 0) {
          const stFields = [
            { field_name: 'DESTINATAIRE', label: 'Destinataire Officiel', field_type: 'texte', required: 1, position: 1 },
            { field_name: 'OBJET', label: 'Objet de la transmission', field_type: 'texte', required: 1, position: 2 },
            { field_name: 'CONTENU', label: 'Contenu / Description des pièces', field_type: 'texte', required: 1, position: 3 },
            { field_name: 'PIECES_JOINTES', label: 'Nombre / Liste des pièces jointes', field_type: 'pièce jointe', required: 0, position: 4 },
            { field_name: 'DATE', label: 'Date d’émission', field_type: 'date', required: 1, position: 5 },
            { field_name: 'SIGNATAIRE', label: 'Nom du signataire', field_type: 'utilisateur', required: 1, position: 6 }
          ];

          for (const f of stFields) {
            await db.run(
              `INSERT INTO template_fields (template_id, field_name, label, field_type, required, position) VALUES (?, ?, ?, ?, ?, ?)`,
              [templateId, f.field_name, f.label, f.field_type, f.required, f.position]
            );
          }
        }
      }
    }

    // Map permissions to roles
    console.log('--- MAPPING ROLE PERMISSIONS ---');
    await db.run('DELETE FROM role_permissions');

    // Admin gets all permissions
    for (const permCode in permIds) {
      await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.ADMIN], permIds[permCode]]);
    }

    // Agent Secrétariat Central (Exclusive creation & archiving of mission orders)
    const scPerms = [
      'documents.create', 'documents.read', 'documents.update', 'documents.transmit', 'documents.orient', 'documents.return', 'documents.download', 'documents.archive', 'documents.archive_direct',
      'incoming_mail.create', 'incoming_mail.read', 'incoming_mail.update', 'outgoing_mail.create', 'outgoing_mail.read', 
      'mission.create', 'mission.read', 'mission_orders.create', 'mission_orders.view', 'mission_orders.edit', 'mission_orders.archive', 'mission_order.print', 'mission_order.deliver',
      'personnel.view', 'personnel.create', 'personnel.edit', 'personnel.deactivate', 'personnel.view_mission_history',
      'appointments.view', 'appointments.create', 'appointments.check_in', 'appointments.view_history', 'appointments.complete',
      'external_missionaries.manage', 'external_missionaries.view',
      'dispatching.view', 'dispatching.create', 'dispatching.send', 'dispatching.tracking', 'dispatching.acknowledge', 'dispatching.action', 'dispatching.export'
    ];
    for (const p of scPerms) {
      if (permIds[p]) await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.AGENT_SC], permIds[p]]);
    }

    // SG & Recteur (mission.create and mission_orders.create are EXCLUDED)
    const execPerms = [
      'documents.create', 'documents.read', 'documents.update', 'documents.transmit', 'documents.orient', 'documents.return', 'documents.accept', 'documents.reject', 'documents.download', 'incoming_mail.read', 'outgoing_mail.create', 'outgoing_mail.read', 'outgoing_mail.validate', 'outgoing_mail.send', 'mission.read', 'mission.validate', 'mission.sign', 'mission.reject', 'mission_orders.view', 'mission_orders.sign', 'reports.read', 'audit.read',
      'appointments.view', 'appointments.create', 'appointments.update', 'appointments.cancel', 'appointments.accept', 'appointments.reject', 'appointments.reschedule', 'appointments.manage_availability', 'appointments.manage_calendar', 'appointments.view_history', 'appointments.check_in', 'appointments.complete', 'appointments.receive',
      'dispatching.view', 'dispatching.create', 'dispatching.send', 'dispatching.tracking', 'dispatching.acknowledge', 'dispatching.action', 'dispatching.export'
    ];
    for (const p of execPerms) {
      if (permIds[p]) {
        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.SG], permIds[p]]);
        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.RECTEUR], permIds[p]]);
      }
    }

    // Chef de service / Responsable (mission.create and mission_orders.create are EXCLUDED)
    const chefPerms = [
      'documents.read', 'documents.transmit', 'documents.orient', 'documents.return', 'documents.accept', 'documents.reject', 'documents.download', 'incoming_mail.read', 'outgoing_mail.create', 'outgoing_mail.read', 'mission.read', 'mission_orders.view', 'reports.read',
      'appointments.view', 'appointments.create', 'appointments.update', 'appointments.cancel', 'appointments.accept', 'appointments.reject', 'appointments.reschedule', 'appointments.manage_availability', 'appointments.manage_calendar', 'appointments.view_history', 'appointments.complete', 'appointments.receive',
      'dispatching.view', 'dispatching.acknowledge', 'dispatching.action'
    ];
    for (const p of chefPerms) {
      if (permIds[p]) {
        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.CHEF_SERVICE], permIds[p]]);
        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.RESPONSABLE_ADMIN], permIds[p]]);
      }
    }

    // Standard User (mission.create and mission_orders.create are EXCLUDED)
    const stdPerms = ['documents.read', 'documents.download', 'mission.read', 'mission_orders.view', 'appointments.view', 'appointments.create', 'appointments.cancel', 'dispatching.view'];
    for (const p of stdPerms) {
      if (permIds[p]) {
        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.STANDARD], permIds[p]]);
      }
    }

    // 3. Seed 30 Preconfigured Services
    console.log('--- SEEDING 30 PRECONFIGURED SERVICES ---');
    const serviceIds = {};
    for (const s of INITIAL_SERVICES) {
      let existing = await db.get('SELECT id FROM services WHERE code = ?', [s.code]);
      if (!existing) {
        const res = await db.run('INSERT INTO services (code, name, status) VALUES (?, ?, ?)', [s.code, s.name, 'ACTIVE']);
        serviceIds[s.code] = res.lastID;
      } else {
        serviceIds[s.code] = existing.id;
      }
    }

    // 4. Seed Test Users
    console.log('--- SEEDING TEST ACCOUNTS ---');
    const testPassword = await bcrypt.hash('Admin123!', 10);
    const sgPassword = await bcrypt.hash('Sg123!', 10);
    const recteurPassword = await bcrypt.hash('Recteur123!', 10);
    const scPassword = await bcrypt.hash('Agent123!', 10);
    const dafPassword = await bcrypt.hash('Daf123!', 10);
    const cfPassword = await bcrypt.hash('Cf123!', 10);

    const ecPassword = await bcrypt.hash('Ec123!', 10);

    const testUsers = [
      {
        matricule: 'UK-ADM-001',
        first_name: 'Admin',
        last_name: 'Kindia',
        email: 'admin@univ-kindia.edu.gn',
        phone: '+224 620 00 00 01',
        function_title: 'Administrateur Système',
        personnel_category: 'PERSONNEL_ADMINISTRATIF',
        academic_structure: '',
        service_code: 'SC',
        role_code: ROLES.ADMIN,
        pass: testPassword
      },
      {
        matricule: 'UK-SC-002',
        first_name: 'Mariama',
        last_name: 'Camara',
        email: 'sc@univ-kindia.edu.gn',
        phone: '+224 621 11 22 33',
        function_title: 'Agent du Secrétariat Central',
        personnel_category: 'PERSONNEL_ADMINISTRATIF',
        academic_structure: '',
        service_code: 'SC',
        role_code: ROLES.AGENT_SC,
        pass: scPassword
      },
      {
        matricule: 'UK-SG-003',
        first_name: 'Dr. Ousmane',
        last_name: 'Diallo',
        email: 'sg@univ-kindia.edu.gn',
        phone: '+224 622 33 44 55',
        function_title: 'Secrétaire Général',
        personnel_category: 'PERSONNEL_ADMINISTRATIF',
        academic_structure: '',
        service_code: 'SG',
        role_code: ROLES.SG,
        pass: sgPassword
      },
      {
        matricule: 'UK-REC-004',
        first_name: 'Prof. Mamadou',
        last_name: 'Bah',
        email: 'recteur@univ-kindia.edu.gn',
        phone: '+224 623 44 55 66',
        function_title: 'Recteur de l’Université de Kindia',
        personnel_category: 'ENSEIGNANT_CHERCHEUR',
        academic_structure: 'Rectorat / Cabinet',
        service_code: 'RECT',
        role_code: ROLES.RECTEUR,
        pass: recteurPassword
      },
      {
        matricule: 'UK-DAF-005',
        first_name: 'Ibrahima Sory',
        last_name: 'Sow',
        email: 'daf@univ-kindia.edu.gn',
        phone: '+224 624 55 66 77',
        function_title: 'Directeur des Affaires Financières',
        personnel_category: 'PERSONNEL_ADMINISTRATIF',
        academic_structure: '',
        service_code: 'DAF',
        role_code: ROLES.CHEF_SERVICE,
        pass: dafPassword
      },
      {
        matricule: 'UK-CF-006',
        first_name: 'Aissatou',
        last_name: 'Barry',
        email: 'cf@univ-kindia.edu.gn',
        phone: '+224 625 66 77 88',
        function_title: 'Contrôleur Financier',
        personnel_category: 'PERSONNEL_ADMINISTRATIF',
        academic_structure: '',
        service_code: 'CF',
        role_code: ROLES.RESPONSABLE_ADMIN,
        pass: cfPassword
      },
      {
        matricule: 'UK-EC-001',
        first_name: 'Dr. Alpha',
        last_name: 'Diallo',
        email: 'ec1@univ-kindia.edu.gn',
        phone: '+224 626 77 88 99',
        function_title: 'Maître de Conférences / Enseignant-Chercheur',
        personnel_category: 'ENSEIGNANT_CHERCHEUR',
        academic_structure: 'Faculté des Sciences - Département d\'Informatique',
        service_code: null, // Non rattaché à un service administratif
        role_code: ROLES.STANDARD,
        pass: ecPassword
      },
      {
        matricule: 'UK-EC-002',
        first_name: 'Prof. Fatoumata Binta',
        last_name: 'Sow',
        email: 'ec2@univ-kindia.edu.gn',
        phone: '+224 627 88 99 00',
        function_title: 'Professeure Titulaire / Chercheure',
        personnel_category: 'ENSEIGNANT_CHERCHEUR',
        academic_structure: 'Faculté des Sciences Sociales - Laboratoire LARSSHE',
        service_code: null, // Non rattaché à un service administratif
        role_code: ROLES.STANDARD,
        pass: ecPassword
      }
    ];

    const userIds = {};
    for (const u of testUsers) {
      let existing = await db.get('SELECT id FROM users WHERE email = ?', [u.email]);
      let sId = u.service_code ? serviceIds[u.service_code] : null;
      let rId = roleIds[u.role_code] || roleIds[ROLES.STANDARD];

      if (!existing) {
        const res = await db.run(
          `INSERT INTO users (matricule, first_name, last_name, email, phone, function_title, personnel_category, academic_structure, service_id, role_id, password_hash, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
          [u.matricule, u.first_name, u.last_name, u.email, u.phone, u.function_title, u.personnel_category || 'PERSONNEL_ADMINISTRATIF', u.academic_structure || '', sId, rId, u.pass]
        );
        userIds[u.email] = res.lastID;
        if (sId) {
          await db.run('UPDATE services SET head_user_id = ? WHERE id = ?', [res.lastID, sId]);
        }
      } else {
        userIds[u.email] = existing.id;
        // Update personnel_category and academic_structure if needed
        await db.run(
          'UPDATE users SET personnel_category = ?, academic_structure = ? WHERE id = ?',
          [u.personnel_category || 'PERSONNEL_ADMINISTRATIF', u.academic_structure || '', existing.id]
        );
      }
    }

    // 5. Initialize Number Sequences for 2026
    const currentYear = 2026;
    await db.run('INSERT OR IGNORE INTO number_sequences (seq_key, year, current_val) VALUES ("CE", ?, 0)', [currentYear]);
    await db.run('INSERT OR IGNORE INTO number_sequences (seq_key, year, current_val) VALUES ("CS", ?, 0)', [currentYear]);
    await db.run('INSERT OR IGNORE INTO number_sequences (seq_key, year, current_val) VALUES ("OM", ?, 0)', [currentYear]);
    await db.run('INSERT OR IGNORE INTO number_sequences (seq_key, year, current_val) VALUES ("RDV", ?, 0)', [currentYear]);
    await db.run('INSERT OR IGNORE INTO number_sequences (seq_key, year, current_val) VALUES ("MEX", ?, 0)', [currentYear]);

    // 6. Initialize Appointment Settings
    await db.run('INSERT OR IGNORE INTO appointment_settings (key, value) VALUES ("allow_simultaneous_appointments", "false")');
    await db.run('INSERT OR IGNORE INTO appointment_settings (key, value) VALUES ("default_reminder_hours", "24")');
    await db.run('INSERT OR IGNORE INTO appointment_settings (key, value) VALUES ("allowed_durations", "15,30,45,60,90")');

    // 7. Demonstration Appointments (Only if explicit demo flag is passed, otherwise starts clean)
    // Production & Clean database start with 0 appointments.

    console.log('=== DATABASE SEEDED SUCCESSFULLY! ===');
    console.log('Test credentials:');
    console.log('1. Admin:               admin@univ-kindia.edu.gn / Admin123!');
    console.log('2. Secrétariat Central: sc@univ-kindia.edu.gn / Agent123!');
    console.log('3. Secrétaire Général:  sg@univ-kindia.edu.gn / Sg123!');
    console.log('4. Recteur:             recteur@univ-kindia.edu.gn / Recteur123!');
    console.log('5. DAF:                 daf@univ-kindia.edu.gn / Daf123!');
    console.log('6. Contrôle Financier:  cf@univ-kindia.edu.gn / Cf123!');

  } catch (err) {
    console.error('Error during database seed:', err);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
