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

    // Dynamic column migrations for services table
    const serviceCols = await db.all("PRAGMA table_info(services)");
    const sColNames = serviceCols.map(c => c.name);
    const newServiceCols = [
      { name: 'parent_id', type: 'INTEGER REFERENCES services(id)' },
      { name: 'structure_type', type: "TEXT NOT NULL DEFAULT 'SERVICE'" },
      { name: 'acronym', type: 'TEXT' },
      { name: 'reference_code', type: 'TEXT' },
      { name: 'function_title', type: 'TEXT' },
      { name: 'header_text', type: 'TEXT' },
      { name: 'logo_path', type: 'TEXT' },
      { name: 'stamp_path', type: 'TEXT' },
      { name: 'address', type: 'TEXT' },
      { name: 'email', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'order_index', type: 'INTEGER DEFAULT 0' }
    ];
    for (const c of newServiceCols) {
      if (!sColNames.includes(c.name)) {
        await db.run(`ALTER TABLE services ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Ensure service_heads_history table exists
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

    // Dynamic column migrations for documents table
    const docCols = await db.all("PRAGMA table_info(documents)");
    const colNames = docCols.map(c => c.name);
    const newDocCols = [
      { name: 'tracking_token', type: 'TEXT' },
      { name: 'document_category', type: "TEXT DEFAULT 'SOIT_TRANSMIS'" },
      { name: 'content_body', type: 'TEXT' },
      { name: 'current_version', type: 'INTEGER DEFAULT 1' },
      { name: 'last_edited_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'rejection_reason', type: 'TEXT' },
      { name: 'rejected_by', type: 'INTEGER' },
      { name: 'processing_mode', type: "TEXT DEFAULT 'NORMAL'" },
      { name: 'document_date', type: 'DATE' },
      { name: 'has_external_signature', type: 'INTEGER DEFAULT 0' },
      { name: 'external_signatory_name', type: 'TEXT' },
      { name: 'external_signature_date', type: 'DATE' },
      { name: 'deleted_at', type: 'DATETIME' },
      { name: 'deleted_by', type: 'INTEGER' },
      { name: 'deletion_reason', type: 'TEXT' },
      { name: 'previous_status', type: 'TEXT' },
      { name: 'reference_meta', type: 'TEXT' },
      { name: 'file_path', type: 'TEXT' },
      { name: 'originating_service_id', type: 'INTEGER REFERENCES services(id)' },
      { name: 'originating_head_name', type: 'TEXT' },
      { name: 'originating_head_function', type: 'TEXT' },
      { name: 'service_sequence_number', type: 'INTEGER' },
      { name: 'target_recipient_type', type: 'TEXT' },
      { name: 'target_recipient_name', type: 'TEXT' },
      { name: 'target_recipient_id', type: 'INTEGER REFERENCES users(id)' },
      { name: 'target_service_id', type: 'INTEGER REFERENCES services(id)' },
      { name: 'sg_routed_at', type: 'DATETIME' },
      { name: 'sg_routed_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'sg_orientation_instruction', type: 'TEXT' },
      { name: 'authorized_signatory_role', type: 'TEXT' },
      { name: 'owner_service_id', type: 'INTEGER REFERENCES services(id)' },
      { name: 'archive_scope', type: "TEXT DEFAULT 'PRIVE_SERVICE'" },
      { name: 'archive_category', type: 'TEXT' },
      { name: 'archived_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'is_central_archived', type: 'INTEGER DEFAULT 0' },
      { name: 'transmitted_to_sc_for_archive', type: 'INTEGER DEFAULT 0' },
      { name: 'transmitted_to_sc_at', type: 'DATETIME' },
      { name: 'transmitted_to_sc_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'transmission_to_sc_motive', type: 'TEXT' },
      { name: 'central_archived_at', type: 'DATETIME' },
      { name: 'central_archived_by', type: 'INTEGER REFERENCES users(id)' },
      { name: 'custom_category_id', type: 'INTEGER' },
      { name: 'ocr_text', type: 'TEXT' },
      { name: 'keywords', type: 'TEXT' },
      { name: 'author_name', type: 'TEXT' },
      { name: 'signatory_name', type: 'TEXT' }
    ];
    for (const c of newDocCols) {
      if (!colNames.includes(c.name)) {
        await db.run(`ALTER TABLE documents ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Ensure archive_shares, document_versions and workflow_rules tables exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS archive_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        target_service_id INTEGER NOT NULL,
        shared_by INTEGER NOT NULL,
        motive TEXT,
        can_download INTEGER DEFAULT 1,
        shared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (target_service_id) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_arch_shares_doc ON archive_shares(document_id);
      CREATE INDEX IF NOT EXISTS idx_arch_shares_serv ON archive_shares(target_service_id);

      CREATE TABLE IF NOT EXISTS archive_custom_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        icon TEXT DEFAULT 'Folder',
        color TEXT DEFAULT 'text-kindia-blue bg-blue-50 border-blue-200',
        display_order INTEGER DEFAULT 100,
        is_default INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE (service_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_arch_cust_cat_serv ON archive_custom_categories(service_id);

      CREATE TABLE IF NOT EXISTS service_document_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER UNIQUE NOT NULL,
        version INTEGER DEFAULT 1,
        ref_pattern TEXT DEFAULT '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}',
        seq_padding INTEGER DEFAULT 4,
        reset_annually INTEGER DEFAULT 1,
        prefix TEXT DEFAULT '',
        suffix TEXT DEFAULT '',
        type_codes_json TEXT DEFAULT '{"LETTRE":"LET","DEMANDE":"DEM","SOIT_TRANSMIS":"ST","NOTE_SERVICE":"NS","RAPPORT":"RAP","PROCES_VERBAL":"PV","DECISION":"DEC","ARRETE":"ARR","DECRET":"DEC","CIRCULAIRE":"CIR","MISSION_ORDER":"OM","AUTRE":"DOC"}',
        header_institution_name TEXT DEFAULT 'RÉPUBLIQUE DE GUINÉE\nTravail – Justice – Solidarité\n\nUNIVERSITÉ DE KINDIA',
        header_faculty_name TEXT,
        header_dept_name TEXT,
        header_service_name TEXT,
        header_logo_enabled INTEGER DEFAULT 1,
        header_logo_path TEXT,
        header_address TEXT,
        header_phone TEXT,
        header_email TEXT,
        header_website TEXT,
        header_alignment TEXT DEFAULT 'CENTER',
        header_custom_text TEXT,
        footer_custom_text TEXT,
        footer_confidentiality_note TEXT DEFAULT 'Document officiel — Ne pas reproduire sans autorisation',
        footer_alignment TEXT DEFAULT 'SPLIT',
        footer_enable_pagination INTEGER DEFAULT 1,
        footer_pagination_format TEXT DEFAULT 'Page {PAGE} / {TOTAL_PAGES}',
        footer_show_separator INTEGER DEFAULT 1,
        footer_contact_info TEXT,
        created_by INTEGER,
        updated_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (updated_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_serv_doc_settings_srv ON service_document_settings(service_id);

      CREATE TABLE IF NOT EXISTS service_document_settings_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id INTEGER NOT NULL,
        version INTEGER NOT NULL,
        settings_snapshot_json TEXT NOT NULL,
        change_summary TEXT,
        changed_by INTEGER NOT NULL,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
        FOREIGN KEY (changed_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_serv_doc_settings_hist_srv ON service_document_settings_history(service_id);

      CREATE TABLE IF NOT EXISTS document_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        version_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        object_title TEXT,
        content_body TEXT,
        pieces_jointes TEXT,
        snapshot_json TEXT,
        change_notes TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_doc_vers_doc ON document_versions(document_id);

      CREATE TABLE IF NOT EXISTS workflow_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        document_type TEXT NOT NULL,
        from_structure_type TEXT,
        from_service_id INTEGER,
        to_structure_type TEXT,
        to_service_id INTEGER,
        authorized_signatory_role TEXT,
        requires_sg_visa INTEGER DEFAULT 0,
        allow_direct_transmission INTEGER DEFAULT 1,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_service_id) REFERENCES services(id),
        FOREIGN KEY (to_service_id) REFERENCES services(id)
      );
      CREATE INDEX IF NOT EXISTS idx_wf_rules_type ON workflow_rules(document_type);
    `);

    // Dynamic column migrations for document_type_configs table
    const dtcCols = await db.all("PRAGMA table_info(document_type_configs)");
    const dtcColNames = dtcCols.map(c => c.name);
    const newDtcCols = [
      { name: 'description', type: 'TEXT' },
      { name: 'icon', type: 'TEXT' },
      { name: 'display_order', type: 'INTEGER DEFAULT 100' },
      { name: 'is_active', type: 'INTEGER DEFAULT 1' }
    ];
    for (const c of newDtcCols) {
      if (!dtcColNames.includes(c.name)) {
        await db.run(`ALTER TABLE document_type_configs ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Dynamic column migrations for archive_custom_categories table
    const accCols = await db.all("PRAGMA table_info(archive_custom_categories)");
    const accColNames = accCols.map(c => c.name);
    if (!accColNames.includes('is_default')) {
      await db.run("ALTER TABLE archive_custom_categories ADD COLUMN is_default INTEGER DEFAULT 0;");
    }

    // Dynamic column migrations for document_templates table
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
      { name: 'created_by', type: 'INTEGER' },
      { name: 'scope_type', type: "TEXT DEFAULT 'GLOBAL'" },
      { name: 'target_service_id', type: 'INTEGER REFERENCES services(id)' },
      { name: 'document_category', type: "TEXT DEFAULT 'SOIT_TRANSMIS'" }
    ];
    for (const c of newDtCols) {
      if (!dtColNames.includes(c.name)) {
        await db.run(`ALTER TABLE document_templates ADD COLUMN ${c.name} ${c.type};`);
      }
    }

    // Dynamic column migrations for users table
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

    // 1. Seed Roles
    console.log('--- SEEDING ROLES ---');
    const roleEntries = [
      { code: ROLES.ADMIN, name: 'Administrateur Système', desc: 'Accès complet d’administration' },
      { code: ROLES.AGENT_SC, name: 'Agent Secrétariat Central', desc: 'Gestion des courriers entrants et enregistrements' },
      { code: ROLES.SG, name: 'Secrétaire Général', desc: 'Orientation globale, gestion administrative & signatures' },
      { code: ROLES.RECTEUR, name: 'Recteur', desc: 'Supervision rectorale, orientations & arbitrages' },
      { code: ROLES.CHEF_SERVICE, name: 'Chef de Service / Responsable', desc: 'Responsable de division, faculté ou département' },
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

    // Map permissions to roles
    console.log('--- MAPPING ROLE PERMISSIONS ---');
    await db.run('DELETE FROM role_permissions');
    for (const permCode in permIds) {
      await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.ADMIN], permIds[permCode]]);
    }

    const scPerms = [
      'documents.create', 'documents.read', 'documents.update', 'documents.transmit', 'documents.orient', 'documents.return', 'documents.download', 'documents.archive', 'documents.archive_direct',
      'archives.view_central', 'archives.archive_central', 'archives.view_service', 'archives.archive_service', 'archives.share', 'archives.manage_categories',
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

    const execPerms = [
      'documents.create', 'documents.read', 'documents.update', 'documents.transmit', 'documents.orient', 'documents.return', 'documents.accept', 'documents.reject', 'documents.download', 'documents.manage_service_settings', 'incoming_mail.read', 'outgoing_mail.create', 'outgoing_mail.read', 'outgoing_mail.validate', 'outgoing_mail.send', 'mission.read', 'mission.validate', 'mission.sign', 'mission.reject', 'mission_orders.view', 'mission_orders.sign', 'reports.read', 'audit.read',
      'archives.view_faculty', 'archives.view_service', 'archives.view_central', 'archives.archive_service', 'archives.transmit_to_central', 'archives.share', 'archives.manage_categories',
      'appointments.view', 'appointments.create', 'appointments.update', 'appointments.cancel', 'appointments.accept', 'appointments.reject', 'appointments.reschedule', 'appointments.manage_availability', 'appointments.manage_calendar', 'appointments.view_history', 'appointments.check_in', 'appointments.complete', 'appointments.receive',
      'dispatching.view', 'dispatching.create', 'dispatching.send', 'dispatching.tracking', 'dispatching.acknowledge', 'dispatching.action', 'dispatching.export',
      'signatures.manage', 'signatures.view', 'signatures.create', 'signatures.edit', 'signatures.activate', 'signatures.deactivate'
    ];
    for (const p of execPerms) {
      if (permIds[p]) {
        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.SG], permIds[p]]);
        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.RECTEUR], permIds[p]]);
      }
    }

    const chefPerms = [
      'documents.create', 'documents.read', 'documents.update', 'documents.transmit', 'documents.orient', 'documents.return', 'documents.accept', 'documents.reject', 'documents.download', 'documents.manage_service_settings', 'incoming_mail.read', 'outgoing_mail.create', 'outgoing_mail.read', 'mission.read', 'mission_orders.view', 'reports.read',
      'archives.view_service', 'archives.view_faculty', 'archives.archive_service', 'archives.transmit_to_central', 'archives.share', 'archives.manage_categories',
      'appointments.view', 'appointments.create', 'appointments.update', 'appointments.cancel', 'appointments.accept', 'appointments.reject', 'appointments.reschedule', 'appointments.manage_availability', 'appointments.manage_calendar', 'appointments.view_history', 'appointments.complete', 'appointments.receive',
      'dispatching.view', 'dispatching.acknowledge', 'dispatching.action', 'signatures.view'
    ];
    for (const p of chefPerms) {
      if (permIds[p]) {
        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.CHEF_SERVICE], permIds[p]]);
        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.RESPONSABLE_ADMIN], permIds[p]]);
      }
    }

    const stdPerms = [
      'documents.create', 'documents.read', 'documents.transmit', 'documents.download', 'outgoing_mail.create', 'outgoing_mail.read', 'mission.read', 'mission_orders.view', 'appointments.view', 'appointments.create', 'appointments.cancel', 'dispatching.view',
      'archives.view_service', 'archives.archive_service'
    ];
    for (const p of stdPerms) {
      if (permIds[p]) {
        await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleIds[ROLES.STANDARD], permIds[p]]);
      }
    }

    // 3. Seed Hierarchical Organizational Structure
    console.log('--- SEEDING HIERARCHICAL ADMINISTRATIVE STRUCTURE ---');
    
    // 3a. Root University
    let ukRoot = await db.get('SELECT id FROM services WHERE code = "UK"');
    let ukId;
    if (!ukRoot) {
      const res = await db.run(
        `INSERT INTO services (code, name, structure_type, acronym, reference_code, header_text, address, email, phone, status, order_index)
         VALUES ("UK", "Université de Kindia", "UNIVERSITE", "UK", "UK", 
                 "RÉPUBLIQUE DE GUINÉE\nTravail – Justice – Solidarité\n\nMINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION\n\nUNIVERSITÉ DE KINDIA",
                 "Quartier Foulayah, BP 164, Kindia, Guinée", "contact@univ-kindia.edu.gn", "+224 622 00 00 00", "ACTIVE", 1)`
      );
      ukId = res.lastID;
    } else {
      ukId = ukRoot.id;
      await db.run(
        `UPDATE services SET structure_type = "UNIVERSITE", reference_code = "UK", order_index = 1 WHERE id = ?`,
        [ukId]
      );
    }

    // 3b. Faculties under UK
    const faculties = [
      { code: 'FS', name: 'Faculté des Sciences', acronym: 'FS', ref_code: 'FS', order_index: 10, header: "RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA\nFACULTÉ DES SCIENCES" },
      { code: 'FSEG', name: 'Faculté des Sciences Économiques et de Gestion', acronym: 'FSEG', ref_code: 'FSEG', order_index: 20, header: "RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA\nFACULTÉ DES SCIENCES ÉCONOMIQUES ET DE GESTION" },
      { code: 'FSS', name: 'Faculté des Sciences Sociales', acronym: 'FSS', ref_code: 'FSS', order_index: 30, header: "RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA\nFACULTÉ DES SCIENCES SOCIALES" },
      { code: 'FLL', name: 'Faculté des Langues et Lettres', acronym: 'FLL', ref_code: 'FLL', order_index: 40, header: "RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA\nFACULTÉ DES LANGUES ET LETTRES" }
    ];

    const facultyIds = {};
    for (const f of faculties) {
      let existing = await db.get('SELECT id FROM services WHERE code = ?', [f.code]);
      if (!existing) {
        const res = await db.run(
          `INSERT INTO services (parent_id, structure_type, code, name, acronym, reference_code, header_text, status, order_index)
           VALUES (?, 'FACULTE', ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
          [ukId, f.code, f.name, f.acronym, f.ref_code, f.header, f.order_index]
        );
        facultyIds[f.code] = res.lastID;
      } else {
        facultyIds[f.code] = existing.id;
        await db.run(
          `UPDATE services SET parent_id = ?, structure_type = 'FACULTE', acronym = ?, reference_code = ?, header_text = ?, order_index = ? WHERE id = ?`,
          [ukId, f.acronym, f.ref_code, f.header, f.order_index, existing.id]
        );
      }
    }

    // 3c. Departments under Faculté des Sciences (FS)
    const fsDepartments = [
      { code: 'FS_INFO', name: 'Département d’Informatique', acronym: 'INFO', ref_code: 'FS/INFO', order_index: 11, header: "RÉPUBLIQUE DE GUINÉE\nTravail – Justice – Solidarité\n\nUNIVERSITÉ DE KINDIA\nFACULTÉ DES SCIENCES\nDÉPARTEMENT D'INFORMATIQUE", email: "informatique@univ-kindia.edu.gn", phone: "+224 620 10 10 10" },
      { code: 'FS_MATH', name: 'Département de Mathématiques', acronym: 'MATH', ref_code: 'FS/MATH', order_index: 12, header: "RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA\nFACULTÉ DES SCIENCES\nDÉPARTEMENT DE MATHÉMATIQUES" },
      { code: 'FS_CHIM', name: 'Département de Chimie', acronym: 'CHIM', ref_code: 'FS/CHIM', order_index: 13, header: "RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA\nFACULTÉ DES SCIENCES\nDÉPARTEMENT DE CHIMIE" },
      { code: 'FS_PHYS', name: 'Département de Physique', acronym: 'PHYS', ref_code: 'FS/PHYS', order_index: 14, header: "RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA\nFACULTÉ DES SCIENCES\nDÉPARTEMENT DE PHYSIQUE" },
      { code: 'FS_BIO', name: 'Département de Biologie', acronym: 'BIO', ref_code: 'FS/BIO', order_index: 15, header: "RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA\nFACULTÉ DES SCIENCES\nDÉPARTEMENT DE BIOLOGIE" }
    ];

    const departmentIds = {};
    for (const d of fsDepartments) {
      let existing = await db.get('SELECT id FROM services WHERE code = ? OR reference_code = ?', [d.code, d.ref_code]);
      if (!existing) {
        const res = await db.run(
          `INSERT INTO services (parent_id, structure_type, code, name, acronym, reference_code, header_text, email, phone, status, order_index)
           VALUES (?, 'DEPARTEMENT', ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
          [facultyIds['FS'], d.code, d.name, d.acronym, d.ref_code, d.header, d.email || null, d.phone || null, d.order_index]
        );
        departmentIds[d.code] = res.lastID;
      } else {
        departmentIds[d.code] = existing.id;
        await db.run(
          `UPDATE services SET parent_id = ?, structure_type = 'DEPARTEMENT', code = ?, name = ?, acronym = ?, reference_code = ?, header_text = ?, email = ?, phone = ?, order_index = ? WHERE id = ?`,
          [facultyIds['FS'], d.code, d.name, d.acronym, d.ref_code, d.header, d.email || null, d.phone || null, d.order_index, existing.id]
        );
      }
    }

    // 3d. Central Admin & Services attached to UK / SG
    const centralServices = [
      { code: 'RECT', name: 'Rectorat / Cabinet du Recteur', type: 'DIRECTION', acronym: 'RECT', ref_code: 'RECT', parent: ukId, order_index: 2 },
      { code: 'SG', name: 'Secrétariat Général', type: 'DIRECTION', acronym: 'SG', ref_code: 'SG', parent: ukId, order_index: 3 },
      { code: 'SC', name: 'Secrétariat Central', type: 'SERVICE', acronym: 'SC', ref_code: 'SG/SC', parent: null, parent_code: 'SG', order_index: 4 },
      { code: 'DAF', name: 'Division des Affaires Financières', type: 'DIRECTION', acronym: 'DAF', ref_code: 'DAF', parent: ukId, order_index: 5 },
      { code: 'CF', name: 'Contrôle Financier', type: 'SERVICE', acronym: 'CF', ref_code: 'CF', parent: ukId, order_index: 6 },
      { code: 'AC', name: 'Agence Comptable', type: 'SERVICE', acronym: 'AC', ref_code: 'AC', parent: ukId, order_index: 7 },
      { code: 'DRH', name: 'Division des Ressources Humaines', type: 'DIRECTION', acronym: 'DRH', ref_code: 'DRH', parent: null, parent_code: 'SG', order_index: 8 },
      { code: 'VR_ETU', name: 'Vice-Rectorat / Études', type: 'DIRECTION', acronym: 'VR-ETU', ref_code: 'VR/ETU', parent: ukId, order_index: 9 },
      { code: 'VR_REC', name: 'Vice-Rectorat / Recherche', type: 'DIRECTION', acronym: 'VR-REC', ref_code: 'VR/REC', parent: ukId, order_index: 10 },
      { code: 'SCOL', name: 'Scolarité Centrale', type: 'SERVICE', acronym: 'SCOL', ref_code: 'SCOL', parent: ukId, order_index: 11 },
      { code: 'CNEU', name: 'Centre Numérique et d’Éditions Universitaires', type: 'SERVICE', acronym: 'CNEU', ref_code: 'CNEU', parent: ukId, order_index: 12 },
      { code: 'CIAQ', name: 'Cellule Interne Assurance Qualité (CIAQ)', type: 'SERVICE', acronym: 'CIAQ', ref_code: 'CIAQ', parent: ukId, order_index: 13 }
    ];

    const serviceIds = {};
    serviceIds['UK'] = ukId;
    Object.assign(serviceIds, facultyIds);
    Object.assign(serviceIds, departmentIds);

    for (const s of centralServices) {
      let parentId = s.parent;
      if (!parentId && s.parent_code && serviceIds[s.parent_code]) {
        parentId = serviceIds[s.parent_code];
      }
      let existing = await db.get('SELECT id FROM services WHERE code = ?', [s.code]);
      if (!existing) {
        const res = await db.run(
          `INSERT INTO services (parent_id, structure_type, code, name, acronym, reference_code, status, order_index)
           VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
          [parentId || ukId, s.type, s.code, s.name, s.acronym, s.ref_code, s.order_index]
        );
        serviceIds[s.code] = res.lastID;
      } else {
        serviceIds[s.code] = existing.id;
        await db.run(
          `UPDATE services SET parent_id = ?, structure_type = ?, acronym = ?, reference_code = ?, order_index = ? WHERE id = ?`,
          [parentId || ukId, s.type, s.acronym, s.ref_code, s.order_index, existing.id]
        );
      }
    }

    // 4. Seed Test Users
    console.log('--- SEEDING TEST ACCOUNTS & HEADS ---');
    const testPassword = await bcrypt.hash('Admin123!', 10);
    const sgPassword = await bcrypt.hash('Sg123!', 10);
    const recteurPassword = await bcrypt.hash('Recteur123!', 10);
    const scPassword = await bcrypt.hash('Agent123!', 10);
    const dafPassword = await bcrypt.hash('Daf123!', 10);
    const cfPassword = await bcrypt.hash('Cf123!', 10);
    const doyenPassword = await bcrypt.hash('Doyen123!', 10);
    const chefPassword = await bcrypt.hash('Chef123!', 10);
    const agentPassword = await bcrypt.hash('Agent123!', 10);

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
        matricule: 'UK-FS-001',
        first_name: 'Prof. Aboubacar',
        last_name: 'Touré',
        email: 'doyen_fs@univ-kindia.edu.gn',
        phone: '+224 626 11 22 44',
        function_title: 'Doyen de la Faculté des Sciences',
        personnel_category: 'ENSEIGNANT_CHERCHEUR',
        academic_structure: 'Faculté des Sciences',
        service_code: 'FS',
        role_code: ROLES.CHEF_SERVICE,
        pass: doyenPassword
      },
      {
        matricule: 'UK-INFO-001',
        first_name: 'Dr. Bangaly',
        last_name: 'Kaba',
        email: 'chef_info@univ-kindia.edu.gn',
        phone: '+224 627 00 11 22',
        function_title: 'Chef du Département d’Informatique',
        personnel_category: 'ENSEIGNANT_CHERCHEUR',
        academic_structure: 'Faculté des Sciences - Département d’Informatique',
        service_code: 'FS_INFO',
        role_code: ROLES.CHEF_SERVICE,
        pass: chefPassword
      },
      {
        matricule: 'UK-INFO-002',
        first_name: 'M. Sékou Oumar',
        last_name: 'Traoré',
        email: 'agent_info@univ-kindia.edu.gn',
        phone: '+224 628 33 44 55',
        function_title: 'Enseignant & Rédacteur Administratif',
        personnel_category: 'ENSEIGNANT_CHERCHEUR',
        academic_structure: 'Faculté des Sciences - Département d’Informatique',
        service_code: 'FS_INFO',
        role_code: ROLES.STANDARD,
        pass: agentPassword
      },
      {
        matricule: 'UK-MATH-001',
        first_name: 'Dr. Ibrahima',
        last_name: 'Camara',
        email: 'chef_math@univ-kindia.edu.gn',
        phone: '+224 629 00 22 44',
        function_title: 'Chef du Département de Mathématiques',
        personnel_category: 'ENSEIGNANT_CHERCHEUR',
        academic_structure: 'Faculté des Sciences - Département de Mathématiques',
        service_code: 'FS_MATH',
        role_code: ROLES.CHEF_SERVICE,
        pass: chefPassword
      },
      {
        matricule: 'UK-MATH-002',
        first_name: 'M. Lansana',
        last_name: 'Condé',
        email: 'agent_math@univ-kindia.edu.gn',
        phone: '+224 629 11 33 55',
        function_title: 'Enseignant Chercheur en Mathématiques',
        personnel_category: 'ENSEIGNANT_CHERCHEUR',
        academic_structure: 'Faculté des Sciences - Département de Mathématiques',
        service_code: 'FS_MATH',
        role_code: ROLES.STANDARD,
        pass: agentPassword
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
      } else {
        userIds[u.email] = existing.id;
        await db.run(
          'UPDATE users SET function_title = ?, personnel_category = ?, academic_structure = ?, service_id = ?, role_id = ? WHERE id = ?',
          [u.function_title, u.personnel_category || 'PERSONNEL_ADMINISTRATIF', u.academic_structure || '', sId, rId, existing.id]
        );
      }
    }

    // 4b. Assign Service Heads & Seed Service Heads History
    console.log('--- LINKING SERVICE HEADS & HISTORY ---');
    const headAssignments = [
      { service_code: 'RECT', email: 'recteur@univ-kindia.edu.gn', function: 'Recteur' },
      { service_code: 'SG', email: 'sg@univ-kindia.edu.gn', function: 'Secrétaire Général' },
      { service_code: 'DAF', email: 'daf@univ-kindia.edu.gn', function: 'Directeur des Affaires Financières' },
      { service_code: 'CF', email: 'cf@univ-kindia.edu.gn', function: 'Contrôleur Financier' },
      { service_code: 'FS', email: 'doyen_fs@univ-kindia.edu.gn', function: 'Doyen de la Faculté des Sciences' },
      { service_code: 'FS_INFO', email: 'chef_info@univ-kindia.edu.gn', function: 'Chef du Département d’Informatique' }
    ];

    for (const ha of headAssignments) {
      const sId = serviceIds[ha.service_code];
      const uId = userIds[ha.email];
      if (sId && uId) {
        await db.run(
          `UPDATE services SET head_user_id = ?, function_title = ? WHERE id = ?`,
          [uId, ha.function, sId]
        );

        // Record in service_heads_history if not present
        const existingHist = await db.get(
          `SELECT id FROM service_heads_history WHERE service_id = ? AND user_id = ? AND is_current = 1`,
          [sId, uId]
        );
        if (!existingHist) {
          await db.run(
            `UPDATE service_heads_history SET is_current = 0, end_date = CURRENT_DATE WHERE service_id = ? AND is_current = 1`,
            [sId]
          );
          await db.run(
            `INSERT INTO service_heads_history (service_id, user_id, function_title, start_date, is_current, appointment_act_ref)
             VALUES (?, ?, ?, '2025-01-01', 1, 'DEC-NOMIN-UK-2025')`,
            [sId, uId, ha.function]
          );
        }
      }
    }

    // 5. Seed Document Type Configs (Types Administratifs Universitaires avec Ordre Configurable)
    console.log('--- SEEDING DOCUMENT TYPE CONFIGS ---');
    const docTypeConfigs = [
      { code: 'SOIT_TRANSMIS', label: 'Soit-transmis', category: 'OFFICIAL', description: 'Bordereaux d’envoi et de transmission de dossiers', icon: 'Send', display_order: 1 },
      { code: 'DEMANDE', label: 'Demandes', category: 'OFFICIAL', description: 'Demandes administratives, congés, autorisations et matériels', icon: 'FileText', display_order: 2 },
      { code: 'LETTRE', label: 'Lettres & Courriers', category: 'OFFICIAL', description: 'Lettres officielles et courriers administratifs', icon: 'Mail', display_order: 3 },
      { code: 'NOTE_SERVICE', label: 'Notes de service', category: 'OFFICIAL', description: 'Directives et communications internes aux agents et services', icon: 'AlertCircle', display_order: 4 },
      { code: 'DECISION', label: 'Décisions', category: 'OFFICIAL', description: 'Décisions rectorales, décanales et actes d’application', icon: 'FileSignature', display_order: 5 },
      { code: 'ARRETE', label: 'Arrêtés', category: 'REGULATORY', description: 'Arrêtés ministériels, rectoraux et actes réglementaires', icon: 'BookmarkCheck', display_order: 6 },
      { code: 'DECRET', label: 'Décrets', category: 'REGULATORY', description: 'Décrets présidentiels et textes légaux institutionnels', icon: 'Landmark', display_order: 7 },
      { code: 'CIRCULAIRE', label: 'Circulaires', category: 'OFFICIAL', description: 'Circulaires d’information et instructions générales', icon: 'Bell', display_order: 8 },
      { code: 'RAPPORT', label: 'Rapports', category: 'OFFICIAL', description: 'Rapports d’activité, rapports académiques et bilans', icon: 'FileBarChart', display_order: 9 },
      { code: 'PROCES_VERBAL', label: 'Procès-verbaux', category: 'OFFICIAL', description: 'PV de délibérations, réunions et passations de service', icon: 'CheckSquare', display_order: 10 },
      { code: 'MISSION_ORDER', label: 'Ordres de mission', category: 'OFFICIAL', description: 'Ordres et autorisations de mission officielle signés', icon: 'Award', display_order: 11 },
      { code: 'CONVOCATION', label: 'Convocations', category: 'OFFICIAL', description: 'Convocations aux conseils, réunions et commissions', icon: 'Calendar', display_order: 12 },
      { code: 'INVITATION', label: 'Invitations', category: 'OFFICIAL', description: 'Invitations officielles aux cérémonies et événements', icon: 'Award', display_order: 13 },
      { code: 'ATTESTATION', label: 'Attestations', category: 'OFFICIAL', description: 'Attestations administratives, prises de service et présence', icon: 'ShieldCheck', display_order: 14 },
      { code: 'AUTRE', label: 'Autres documents', category: 'OFFICIAL', description: 'Actes administratifs divers et spécifiques', icon: 'Folder', display_order: 15 },
      { code: 'NON_CLASSE', label: 'Non classés', category: 'FALLBACK', description: 'Documents anciens ou sans catégorie définie', icon: 'HelpCircle', display_order: 99 }
    ];

    for (const dt of docTypeConfigs) {
      let existingDt = await db.get('SELECT code FROM document_type_configs WHERE code = ?', [dt.code]);
      if (!existingDt) {
        await db.run(
          `INSERT INTO document_type_configs (code, label, category, description, icon, display_order, allow_direct_archive, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
          [dt.code, dt.label, dt.category, dt.description, dt.icon, dt.display_order]
        );
      } else {
        await db.run(
          `UPDATE document_type_configs SET label = ?, category = ?, description = ?, icon = ?, display_order = ?, is_active = 1 WHERE code = ?`,
          [dt.label, dt.category, dt.description, dt.icon, dt.display_order, dt.code]
        );
      }
    }

    // 5b. Ensure default archive categories (Soit-transmis, Demandes) exist for each service (Requirement 2)
    console.log('--- SEEDING DEFAULT ARCHIVE CATEGORIES PER SERVICE ---');
    try {
      await db.run("ALTER TABLE archive_custom_categories ADD COLUMN associated_types_json TEXT DEFAULT '[]'");
    } catch (e) {}
    try {
      await db.run("ALTER TABLE archive_custom_categories ADD COLUMN is_default_for_types_json TEXT DEFAULT '[]'");
    } catch (e) {}
    try {
      await db.run(`
        CREATE TABLE IF NOT EXISTS archive_category_document_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER NOT NULL,
          document_type_code TEXT NOT NULL,
          is_default INTEGER DEFAULT 0,
          service_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES archive_custom_categories(id) ON DELETE CASCADE,
          UNIQUE(category_id, document_type_code)
        )
      `);
    } catch (e) {}

    const allDbServices = await db.all('SELECT id FROM services');
    const adminUser = await db.get('SELECT id FROM users WHERE email = "admin@univ-kindia.edu.gn"');
    const adminId = adminUser ? adminUser.id : 1;
    for (const s of allDbServices) {
      await db.run(
        `INSERT OR IGNORE INTO archive_custom_categories 
         (service_id, code, name, description, icon, color, display_order, associated_types_json, is_default_for_types_json, is_default, is_active, created_by)
         VALUES (?, 'SOIT_TRANSMIS', 'Soit-transmis', 'Actes et bordereaux de transmission officielle', 'Send', 'text-amber-700 bg-amber-50 border-amber-200', 10, '["SOIT_TRANSMIS"]', '["SOIT_TRANSMIS"]', 1, 1, ?)`,
        [s.id, adminId]
      );
      await db.run(
        `INSERT OR IGNORE INTO archive_custom_categories 
         (service_id, code, name, description, icon, color, display_order, associated_types_json, is_default_for_types_json, is_default, is_active, created_by)
         VALUES (?, 'DEMANDE', 'Demandes', 'Demandes administratives, requêtes et congés', 'FileText', 'text-blue-700 bg-blue-50 border-blue-200', 20, '["DEMANDE"]', '["DEMANDE"]', 1, 1, ?)`,
        [s.id, adminId]
      );
      // Ensure existing default categories have associated_types_json populated
      await db.run(
        `UPDATE archive_custom_categories 
         SET associated_types_json = '["SOIT_TRANSMIS"]', is_default_for_types_json = '["SOIT_TRANSMIS"]' 
         WHERE service_id = ? AND code = 'SOIT_TRANSMIS' AND (associated_types_json IS NULL OR associated_types_json = '[]')`,
        [s.id]
      );
      await db.run(
        `UPDATE archive_custom_categories 
         SET associated_types_json = '["DEMANDE"]', is_default_for_types_json = '["DEMANDE"]' 
         WHERE service_id = ? AND code = 'DEMANDE' AND (associated_types_json IS NULL OR associated_types_json = '[]')`,
        [s.id]
      );
    }

    // 6. Seed Configurable Workflow Rules
    console.log('--- SEEDING WORKFLOW RULES ---');
    const defaultWorkflowRules = [
      {
        name: 'Transmission Soit-Transmis Décanat/Rectorat',
        document_type: 'SOIT_TRANSMIS',
        from_structure_type: 'DEPARTEMENT',
        to_structure_type: 'FACULTE',
        authorized_signatory_role: 'RECTEUR',
        requires_sg_visa: 1,
        description: 'Transmission hiérarchique : Département -> Faculté -> Secrétariat Central -> SG -> Recteur'
      },
      {
        name: 'Demande Administrative vers Hiérarchie',
        document_type: 'DEMANDE',
        from_structure_type: 'DEPARTEMENT',
        to_structure_type: 'FACULTE',
        authorized_signatory_role: 'DOYEN',
        requires_sg_visa: 0,
        description: 'Demande administrative d’un agent : Agent -> Chef de Département -> Doyen'
      },
      {
        name: 'Lettre Administrative vers Administration Centrale',
        document_type: 'LETTRE',
        from_structure_type: 'SERVICE',
        to_structure_type: 'UNIVERSITE',
        authorized_signatory_role: 'SECRÉTAIRE_GÉNÉRAL',
        requires_sg_visa: 1,
        description: 'Courrier vers l’administration centrale soumis à l’orientation impérative du SG'
      },
      {
        name: 'Note de Service Rectorale ou Décanale',
        document_type: 'NOTE_SERVICE',
        from_structure_type: 'UNIVERSITE',
        to_structure_type: 'SERVICE',
        authorized_signatory_role: 'RECTEUR',
        requires_sg_visa: 0,
        description: 'Diffusion descendante des directives rectorales'
      }
    ];

    for (const wr of defaultWorkflowRules) {
      let existingWr = await db.get('SELECT id FROM workflow_rules WHERE name = ?', [wr.name]);
      if (!existingWr) {
        await db.run(
          `INSERT INTO workflow_rules (name, document_type, from_structure_type, to_structure_type, authorized_signatory_role, requires_sg_visa, allow_direct_transmission, description, is_active)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, 1)`,
          [wr.name, wr.document_type, wr.from_structure_type, wr.to_structure_type, wr.authorized_signatory_role, wr.requires_sg_visa, wr.description]
        );
      }
    }

    // 7. Modèles de documents réels
    // RÈGLE FONDAMENTALE : Ne plus créer de modèles prédéfinis d'office.
    // Les modèles sont créés et gérés par les utilisateurs et administrateurs selon leurs besoins réels.
    console.log('--- PRESERVING REAL CUSTOM TEMPLATES ONLY ---');

    // 9. Backfill and Migration of Existing Archives (Rule 28)
    console.log('--- MIGRATING EXISTING ARCHIVES & PERIMETERS ---');
    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    const scId = scService ? scService.id : 5;

    // Set owner_service_id where missing
    await db.run(`
      UPDATE documents 
      SET owner_service_id = COALESCE(originating_service_id, current_service_id, created_by, 1)
      WHERE owner_service_id IS NULL
    `);

    // Set archive_scope where missing
    await db.run(`
      UPDATE documents 
      SET archive_scope = CASE 
        WHEN document_type IN ('DECISION', 'NOTE_SERVICE', 'CIRCULAIRE') THEN 'INSTITUTIONNEL'
        WHEN owner_service_id = ? THEN 'CENTRAL'
        WHEN status IN ('ARCHIVED', 'ARCHIVÉ') AND is_central_archived = 1 THEN 'CENTRAL'
        ELSE 'PRIVE_SERVICE'
      END
      WHERE archive_scope IS NULL OR archive_scope = ''
    `, [scId]);

    console.log('=== DATABASE SEEDED SUCCESSFULLY! ===');
    console.log('Hierarchy ready: Université de Kindia (UK) -> Faculté des Sciences (FS) -> Département d\'Informatique (FS/INFO)');
    console.log('Test credentials:');
    console.log('1. Admin:               admin@univ-kindia.edu.gn / Admin123!');
    console.log('2. Chef Dept INFO:      chef_info@univ-kindia.edu.gn / Chef123! (FS/INFO)');
    console.log('3. Agent Dept INFO:     agent_info@univ-kindia.edu.gn / Agent123! (FS/INFO)');
    console.log('4. Doyen FS:            doyen_fs@univ-kindia.edu.gn / Doyen123! (FS)');
    console.log('5. Secrétariat Central: sc@univ-kindia.edu.gn / Agent123!');
    console.log('6. Secrétaire Général:  sg@univ-kindia.edu.gn / Sg123!');
    console.log('7. Recteur:             recteur@univ-kindia.edu.gn / Recteur123!');

  } catch (err) {
    console.error('Error during database seed:', err);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
