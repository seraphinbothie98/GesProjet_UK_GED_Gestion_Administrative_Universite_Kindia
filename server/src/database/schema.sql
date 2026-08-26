-- UK-GED Relational Database Schema
-- Université de Kindia

PRAGMA foreign_keys = ON;

-- 1. Services Table (Structure Organisationnelle Hiérarchique)
CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER,
    structure_type TEXT NOT NULL DEFAULT 'SERVICE', -- UNIVERSITE, FACULTE, DEPARTEMENT, DIRECTION, SERVICE, SOUS_SERVICE, AUTRE
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    acronym TEXT,
    reference_code TEXT UNIQUE, -- Code unique pour numérotation des actes (ex: FS/INFO, RECT)
    head_user_id INTEGER,
    function_title TEXT,
    header_text TEXT,
    logo_path TEXT,
    stamp_path TEXT,
    address TEXT,
    email TEXT,
    phone TEXT,
    order_index INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES services(id) ON DELETE SET NULL,
    FOREIGN KEY (head_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 1b. Service Heads History (Historique des Responsables de Service)
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


-- 2. Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_custom INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Permissions Table
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    description TEXT
);

-- 4. Role Permissions Mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- 5. Users Table
CREATE TABLE IF NOT EXISTS users (
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
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SUSPENDED
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- 6. Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    tracking_token TEXT UNIQUE,
    document_type TEXT NOT NULL, -- INCOMING_MAIL, OUTGOING_MAIL, MISSION_ORDER, SOIT_TRANSMIS, DEMANDE, LETTRE, NOTE_SERVICE, RAPPORT, PROCES_VERBAL, CONVOCATION, INVITATION, ATTESTATION, DECISION, CORRESPONDANCE, etc.
    document_category TEXT DEFAULT 'SOIT_TRANSMIS',
    title TEXT NOT NULL,
    description TEXT,
    content_body TEXT, -- Corps textuel rédigé
    current_version INTEGER DEFAULT 1,
    last_edited_by INTEGER,
    sender_name TEXT,
    sender_organization TEXT,
    priority TEXT NOT NULL DEFAULT 'NORMAL', -- LOW, NORMAL, HIGH, URGENT
    confidentiality TEXT NOT NULL DEFAULT 'INTERNAL', -- PUBLIC, INTERNAL, RESTRICTED, CONFIDENTIAL
    status TEXT NOT NULL DEFAULT 'CREATED', -- CREATED, BROUILLON, SOUMIS, TRANSMIS, REÇU, EN_COURS_TRAITEMENT, A_CORRIGER, RETOUR, VALIDÉ, REJETÉ, EN_ATTENTE_SIGNATURE, SIGNÉ, ARCHIVÉ, TRASHED
    current_service_id INTEGER NOT NULL,
    current_user_id INTEGER,
    created_by INTEGER NOT NULL,
    originating_service_id INTEGER,
    originating_head_name TEXT,
    originating_head_function TEXT,
    service_sequence_number INTEGER,
    target_recipient_type TEXT, -- SERVICE, FONCTION, RESPONSABLE, AUTORITE
    target_recipient_name TEXT,
    target_recipient_id INTEGER,
    target_service_id INTEGER,
    sg_routed_at DATETIME,
    sg_routed_by INTEGER,
    sg_orientation_instruction TEXT,
    authorized_signatory_role TEXT, -- RECTEUR, SECRÉTAIRE_GÉNÉRAL, DOYEN, CHEF_DEPARTEMENT, CHEF_SERVICE
    deadline_date DATE,
    is_locked INTEGER DEFAULT 0,
    qr_code_hash TEXT,
    rejection_reason TEXT,
    rejected_by INTEGER,
    processing_mode TEXT NOT NULL DEFAULT 'NORMAL', -- NORMAL, DIRECT_ARCHIVE
    document_date DATE,
    file_path TEXT,
    has_external_signature INTEGER DEFAULT 0,
    external_signatory_name TEXT,
    external_signature_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    archived_at DATETIME,
    archived_by INTEGER,
    owner_service_id INTEGER, -- Structure administrative propriétaire de l'archive
    archive_scope TEXT DEFAULT 'PRIVE_SERVICE', -- PRIVE_SERVICE, FACULTE, CENTRAL, INSTITUTIONNEL, PARTAGE
    archive_category TEXT,
    is_central_archived INTEGER DEFAULT 0,
    transmitted_to_sc_for_archive INTEGER DEFAULT 0,
    transmitted_to_sc_at DATETIME,
    transmitted_to_sc_by INTEGER,
    transmission_to_sc_motive TEXT,
    central_archived_at DATETIME,
    central_archived_by INTEGER,
    reference_meta TEXT,
    FOREIGN KEY (current_service_id) REFERENCES services(id),
    FOREIGN KEY (current_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (originating_service_id) REFERENCES services(id),
    FOREIGN KEY (owner_service_id) REFERENCES services(id),
    FOREIGN KEY (archived_by) REFERENCES users(id),
    FOREIGN KEY (transmitted_to_sc_by) REFERENCES users(id),
    FOREIGN KEY (central_archived_by) REFERENCES users(id),
    FOREIGN KEY (target_service_id) REFERENCES services(id),
    FOREIGN KEY (target_recipient_id) REFERENCES users(id),
    FOREIGN KEY (sg_routed_by) REFERENCES users(id),
    FOREIGN KEY (rejected_by) REFERENCES users(id),
    FOREIGN KEY (last_edited_by) REFERENCES users(id)
);

-- 6b. Archive Shares Table (Partage sélectif et sécurisé d'archives)
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

-- 6c. Document Type Configurations Table (12 Types Administratifs Officiels)
CREATE TABLE IF NOT EXISTS document_type_configs (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT DEFAULT 'OFFICIAL',
    description TEXT,
    icon TEXT,
    display_order INTEGER DEFAULT 100,
    allow_direct_archive INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6d. Archive Custom Categories (Catégories personnalisées par service)
CREATE TABLE IF NOT EXISTS archive_custom_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER, -- NULL = standard global, INTEGER = catégorie privée du service
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Folder',
    color TEXT DEFAULT 'text-kindia-blue bg-blue-50 border-blue-200',
    display_order INTEGER DEFAULT 100,
    associated_types_json TEXT DEFAULT '[]', -- Liste des codes de types associés (ex: ["DECRET", "ARRETE"])
    is_default_for_types_json TEXT DEFAULT '[]', -- Liste des types dont c'est la catégorie par défaut
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

-- 6d-bis. Archive Category Document Types (Table de liaison explicite Catégorie <-> Types d'actes)
CREATE TABLE IF NOT EXISTS archive_category_document_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    document_type_code TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    service_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES archive_custom_categories(id) ON DELETE CASCADE,
    UNIQUE(category_id, document_type_code)
);
CREATE INDEX IF NOT EXISTS idx_cat_doc_type_cat ON archive_category_document_types(category_id);
CREATE INDEX IF NOT EXISTS idx_cat_doc_type_code ON archive_category_document_types(document_type_code);

-- 6e. Service Document Settings Table (Paramètres personnalisés de documents par service)
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

-- 6f. Service Document Settings History (Audit & Historique des Versions)
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

-- 6g. Service Custom Dynamic Fields Table (Champs dynamiques personnalisés par service)
CREATE TABLE IF NOT EXISTS service_custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_key VARCHAR(100) NOT NULL,
    service_id INTEGER NOT NULL,
    name VARCHAR(150) NOT NULL,
    variable_code VARCHAR(100) NOT NULL,
    label VARCHAR(200),
    field_type VARCHAR(50) NOT NULL DEFAULT 'TEXT',
    options_json TEXT,
    default_value TEXT,
    description TEXT,
    is_required INTEGER DEFAULT 0,
    is_system INTEGER DEFAULT 0,
    applies_to_reference INTEGER DEFAULT 1,
    applies_to_header INTEGER DEFAULT 1,
    applies_to_footer INTEGER DEFAULT 1,
    applies_to_document INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    UNIQUE(service_id, variable_code)
);
CREATE INDEX IF NOT EXISTS idx_serv_custom_fields_srv ON service_custom_fields(service_id);

-- 6c. Document Versions History Table (Révisions & Corrections)
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

-- 6d. Configurable Workflow Routing Rules Table
CREATE TABLE IF NOT EXISTS workflow_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    document_type TEXT NOT NULL, -- ALL, SOIT_TRANSMIS, DEMANDE, LETTRE, etc.
    from_structure_type TEXT, -- DEPARTEMENT, FACULTE, DIRECTION, SERVICE, UNIVERSITE
    from_service_id INTEGER,
    to_structure_type TEXT,
    to_service_id INTEGER,
    authorized_signatory_role TEXT, -- RECTEUR, SECRÉTAIRE_GÉNÉRAL, DOYEN, CHEF_SERVICE
    requires_sg_visa INTEGER DEFAULT 0,
    allow_direct_transmission INTEGER DEFAULT 1,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_service_id) REFERENCES services(id),
    FOREIGN KEY (to_service_id) REFERENCES services(id)
);
CREATE INDEX IF NOT EXISTS idx_wf_rules_type ON workflow_rules(document_type);

-- 7. Incoming Mails Extension
CREATE TABLE IF NOT EXISTS incoming_mails (
    document_id INTEGER PRIMARY KEY,
    reception_date DATE NOT NULL,
    sender_address TEXT,
    mail_type TEXT, -- OFFICIAL, PRIVILEGED, GENERAL
    instruction TEXT,
    observations TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 8. Outgoing Mails Extension
CREATE TABLE IF NOT EXISTS outgoing_mails (
    document_id INTEGER PRIMARY KEY,
    recipient_name TEXT NOT NULL,
    recipient_address TEXT,
    content_body TEXT,
    signatory_user_id INTEGER,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (signatory_user_id) REFERENCES users(id)
);

-- 9. Mission Orders Extension
CREATE TABLE IF NOT EXISTS mission_orders (
    document_id INTEGER PRIMARY KEY,
    missionary_name TEXT NOT NULL,
    nationality TEXT DEFAULT 'Guinéenne',
    function_title TEXT NOT NULL,
    destination TEXT NOT NULL,
    object_of_mission TEXT NOT NULL,
    transport_mode TEXT NOT NULL,
    departure_date DATE NOT NULL,
    return_date DATE NOT NULL,
    driver_name TEXT,
    observations TEXT,
    is_signed INTEGER DEFAULT 0,
    signed_at DATETIME,
    signed_by_user_id INTEGER,
    signature_token TEXT,
    signed_pdf_path TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (signed_by_user_id) REFERENCES users(id)
);

-- 9b. Signatures Table
CREATE TABLE IF NOT EXISTS signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    signature_hash TEXT NOT NULL,
    certificate_info TEXT,
    signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    pdf_path TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 10. Document Transfers (Workflows & Circuits)
CREATE TABLE IF NOT EXISTS document_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    from_service_id INTEGER NOT NULL,
    from_user_id INTEGER NOT NULL,
    to_service_id INTEGER NOT NULL,
    to_user_id INTEGER,
    action TEXT NOT NULL, -- TRANSMIT, ORIENT, RETURN
    motif TEXT, -- Pour examen, Pour avis, Pour étude, Pour traitement, Pour information, Pour exécution, Pour proposition, Pour réponse, Pour suivi
    instruction TEXT,
    deadline DATE,
    status TEXT DEFAULT 'PENDING', -- PENDING, RECEIVED, PROCESSED, RETURNED
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    received_at DATETIME,
    processed_at DATETIME,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (from_service_id) REFERENCES services(id),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_service_id) REFERENCES services(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
);

-- 11. Document History (Timeline Log)
CREATE TABLE IF NOT EXISTS document_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (service_id) REFERENCES services(id)
);

-- 12. Attachments & Scans
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    uploaded_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- 13. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    document_id INTEGER,
    appointment_id INTEGER,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'INFO', -- INFO, ACTION_REQUIRED, SIGNATURE_REQUIRED, OVERDUE, APPOINTMENT, MISSION_REQUEST
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

-- 14. Audit Logs Table (Immutable Log)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    ip_address TEXT,
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 15. Number Sequences Engine
CREATE TABLE IF NOT EXISTS number_sequences (
    seq_key TEXT NOT NULL, -- CE, CS, OM
    year INTEGER NOT NULL,
    current_val INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (seq_key, year)
);

-- Indexes for performance & security filtering
CREATE INDEX IF NOT EXISTS idx_docs_ref ON documents(reference);
CREATE INDEX IF NOT EXISTS idx_docs_token ON documents(tracking_token);
CREATE INDEX IF NOT EXISTS idx_docs_curr_service ON documents(current_service_id);
CREATE INDEX IF NOT EXISTS idx_docs_curr_user ON documents(current_user_id);
CREATE INDEX IF NOT EXISTS idx_docs_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_transfers_doc ON document_transfers(document_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to_service ON document_transfers(to_service_id);
CREATE INDEX IF NOT EXISTS idx_history_doc ON document_history(document_id);
CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- 16. Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    tracking_token TEXT UNIQUE,
    requester_id INTEGER,
    requester_first_name TEXT NOT NULL,
    requester_last_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    requester_phone TEXT NOT NULL,
    requester_organization TEXT,
    responsible_id INTEGER NOT NULL,
    document_id INTEGER,
    document_reference_input TEXT,
    motif TEXT NOT NULL,
    subject TEXT NOT NULL,
    requested_date DATE NOT NULL,
    requested_start_time TIME NOT NULL,
    requested_end_time TIME NOT NULL,
    duration INTEGER NOT NULL DEFAULT 30,
    mode TEXT NOT NULL DEFAULT 'PRESENTIEL',
    location TEXT,
    status TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    rejection_reason TEXT,
    is_reason_private INTEGER DEFAULT 0,
    reschedule_proposed_by INTEGER,
    reschedule_date DATE,
    reschedule_start_time TIME,
    reschedule_end_time TIME,
    reschedule_message TEXT,
    cancel_reason TEXT,
    cancelled_by INTEGER,
    internal_note TEXT,
    qr_code_hash TEXT,
    checked_in_at DATETIME,
    checked_in_by INTEGER,
    completed_at DATETIME,
    completed_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id),
    FOREIGN KEY (responsible_id) REFERENCES users(id),
    FOREIGN KEY (document_id) REFERENCES documents(id),
    FOREIGN KEY (reschedule_proposed_by) REFERENCES users(id),
    FOREIGN KEY (cancelled_by) REFERENCES users(id),
    FOREIGN KEY (checked_in_by) REFERENCES users(id),
    FOREIGN KEY (completed_by) REFERENCES users(id)
);

-- 17. Appointment Availabilities Table
CREATE TABLE IF NOT EXISTS appointment_availabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL, -- 1=Monday, ..., 7=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 18. Calendar Blocks Table
CREATE TABLE IF NOT EXISTS calendar_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    reason TEXT,
    type TEXT DEFAULT 'CONGE',
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 19. Appointment History Table
CREATE TABLE IF NOT EXISTS appointment_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL,
    user_id INTEGER,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 20. Appointment Settings Table
CREATE TABLE IF NOT EXISTS appointment_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Appointment Indexes
CREATE INDEX IF NOT EXISTS idx_appointments_ref ON appointments(reference);
CREATE INDEX IF NOT EXISTS idx_appointments_resp ON appointments(responsible_id);
CREATE INDEX IF NOT EXISTS idx_appointments_req ON appointments(requester_id);

-- 21. Institution Settings Table (Identité Visuelle & Informations de l'Université)
CREATE TABLE IF NOT EXISTS institution_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    name TEXT NOT NULL DEFAULT 'UNIVERSITÉ DE KINDIA',
    ministry TEXT NOT NULL DEFAULT 'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION',
    address TEXT DEFAULT 'Quartier Foulayah, BP 164, Kindia, Guinée',
    phone TEXT DEFAULT '+224 622 00 00 00',
    email TEXT DEFAULT 'contact@univ-kindia.edu.gn',
    website TEXT DEFAULT 'www.univ-kindia.edu.gn',
    slogan TEXT DEFAULT 'Savoir - Innovation - Excellence',
    logo_path TEXT,
    secondary_logo_path TEXT,
    header_text TEXT DEFAULT 'RÉPUBLIQUE DE GUINÉE\nTravail – Justice – Solidarité\n\nMINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION\n\nUNIVERSITÉ DE KINDIA',
    footer_text TEXT DEFAULT 'UNIVERSITÉ DE KINDIA • BP 164 Kindia, Guinée • Tél: +224 622 00 00 00 • E-mail: contact@univ-kindia.edu.gn',
    ministry_code TEXT DEFAULT 'MESRS',
    institution_code TEXT DEFAULT 'UK',
    structure_name TEXT DEFAULT 'Rectorat',
    structure_code TEXT DEFAULT 'RECT',
    authority_name TEXT DEFAULT 'Secrétaire Général',
    authority_code TEXT DEFAULT 'SG',
    reference_pattern TEXT DEFAULT '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
    sequence_padding INTEGER DEFAULT 4,
    reference_type_patterns TEXT,
    show_logo_login INTEGER DEFAULT 1,
    show_logo_sidebar INTEGER DEFAULT 1,
    show_logo_header INTEGER DEFAULT 1,
    show_logo_dashboard INTEGER DEFAULT 1,
    show_logo_mission INTEGER DEFAULT 1,
    show_logo_docs INTEGER DEFAULT 1,
    show_logo_pdf INTEGER DEFAULT 1,
    show_logo_qr INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 22. Document Templates Table (Modèles de Documents Scoped)
CREATE TABLE IF NOT EXISTS document_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    document_type_code TEXT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'OFFICIAL',
    scope_type TEXT DEFAULT 'GLOBAL', -- GLOBAL, FACULTY, DEPARTMENT, SERVICE
    target_service_id INTEGER,
    document_category TEXT DEFAULT 'SOIT_TRANSMIS', -- SOIT_TRANSMIS, DEMANDE, LETTRE, NOTE_SERVICE, RAPPORT, PROCES_VERBAL, CONVOCATION, INVITATION, ATTESTATION, DECISION, AUTRE
    description TEXT,
    editor_type TEXT DEFAULT 'UK_GED_EDITOR', -- UK_GED_EDITOR, MS_WORD
    format TEXT DEFAULT 'DOCX',
    version INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    file_path TEXT,
    header_text TEXT,
    footer_text TEXT,
    header_alignment TEXT DEFAULT 'CENTER',
    header_font_size INTEGER DEFAULT 12,
    header_spacing INTEGER DEFAULT 10,
    show_logo INTEGER DEFAULT 1,
    show_qr_code INTEGER DEFAULT 1,
    custom_styles TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_service_id) REFERENCES services(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 22b. Dynamic Template Fields Table (Champs Dynamiques)
CREATE TABLE IF NOT EXISTS template_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL, -- texte, nombre, date, heure, utilisateur, service, document, liste, signature, image, QR Code, pièce jointe
    required INTEGER DEFAULT 0,
    data_source TEXT,
    default_value TEXT,
    position INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE CASCADE
);

-- 22c. Template Versions History Table
CREATE TABLE IF NOT EXISTS template_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    version_number INTEGER DEFAULT 1,
    file_path TEXT,
    file_type TEXT,
    editor_type TEXT DEFAULT 'UK_GED_EDITOR',
    header_text TEXT,
    footer_text TEXT,
    logo_path TEXT,
    font_family TEXT DEFAULT 'Helvetica',
    font_size INTEGER DEFAULT 12,
    primary_color TEXT DEFAULT '#0B2545',
    secondary_color TEXT DEFAULT '#D4AF37',
    content_body_html TEXT,
    header_html TEXT,
    footer_html TEXT,
    change_description TEXT,
    uploaded_by INTEGER,
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE CASCADE
);

-- 22d. Document Template Snapshots Table (Snapshot du Modèle)
CREATE TABLE IF NOT EXISTS document_template_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    template_version_id INTEGER,
    snapshot_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- 23. User Electronic Signatures Table (Signatures Électroniques des Responsables)
CREATE TABLE IF NOT EXISTS user_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    function_title TEXT,
    service_id INTEGER,
    signature_image_path TEXT NOT NULL,
    version_number INTEGER DEFAULT 1,
    activation_date DATE,
    expiration_date DATE,
    status TEXT DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, EXPIRED
    is_active INTEGER DEFAULT 1,
    width INTEGER DEFAULT 150,
    height INTEGER DEFAULT 60,
    alignment TEXT DEFAULT 'RIGHT',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id)
);

-- 23b. Electronic Signature Versions Table
CREATE TABLE IF NOT EXISTS signature_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    signature_image_path TEXT NOT NULL,
    change_description TEXT,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (signature_id) REFERENCES user_signatures(id) ON DELETE CASCADE
);

-- 23c. Document Signatures Binding Table (Lien avec le Document Verrouillé)
CREATE TABLE IF NOT EXISTS document_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    signature_id INTEGER NOT NULL,
    signature_version_id INTEGER,
    signatory_id INTEGER NOT NULL,
    signature_hash TEXT,
    signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (signature_id) REFERENCES user_signatures(id)
);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(requested_date);

-- 24. Staff Table (Répertoire du Personnel)
CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    matricule TEXT UNIQUE,
    nom TEXT NOT NULL,
    prenoms TEXT NOT NULL,
    nationality TEXT DEFAULT 'Guinéenne',
    fonction TEXT NOT NULL,
    service_id INTEGER,
    telephone TEXT,
    email TEXT,
    status TEXT DEFAULT 'ACTIF', -- ACTIF, INACTIF
    is_driver INTEGER DEFAULT 0, -- 1=Autorisé comme chauffeur, 0=Non
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id)
);

-- 25. Vehicles Table (Gestion des Véhicules)
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_number TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    assigned_staff_id INTEGER,
    status TEXT DEFAULT 'ACTIF',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_matricule ON staff(matricule);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
-- 26. External Missionaries Table (Missionnaires Externes)
CREATE TABLE IF NOT EXISTS external_missionaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL,
    last_name TEXT NOT NULL,
    first_names TEXT NOT NULL,
    nationality TEXT DEFAULT 'Guinéenne',
    function_title TEXT NOT NULL,
    origin_institution TEXT NOT NULL,
    mission_order_ref TEXT NOT NULL,
    object_of_mission TEXT NOT NULL,
    location_of_mission TEXT NOT NULL,
    issuing_authority TEXT,
    observations TEXT,
    host_service_id INTEGER,
    host_responsible_name TEXT,
    current_service_id INTEGER,
    current_user_id INTEGER,
    expected_start_date DATE,
    expected_end_date DATE,
    phone TEXT,
    email TEXT,
    original_document_path TEXT NOT NULL,
    arrival_date DATETIME,
    arrival_recorded_at DATETIME,
    arrival_recorded_by INTEGER,
    arrival_document_path TEXT,
    signed_at DATETIME,
    signed_by_user_id INTEGER,
    signed_document_path TEXT,
    rejection_reason TEXT,
    rejected_by_user_id INTEGER,
    rejected_at DATETIME,
    delivered_at DATETIME,
    delivered_by_user_id INTEGER,
    recipient_name TEXT,
    delivery_notes TEXT,
    print_count INTEGER DEFAULT 0,
    is_locked INTEGER DEFAULT 0,
    departure_date DATETIME,
    departure_recorded_at DATETIME,
    departure_recorded_by INTEGER,
    final_document_path TEXT,
    status TEXT NOT NULL DEFAULT 'ENREGISTRÉ – EN ATTENTE DE TRANSMISSION AU SG',
    reference_meta TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (host_service_id) REFERENCES services(id),
    FOREIGN KEY (current_service_id) REFERENCES services(id),
    FOREIGN KEY (arrival_recorded_by) REFERENCES users(id),
    FOREIGN KEY (signed_by_user_id) REFERENCES users(id),
    FOREIGN KEY (departure_recorded_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ext_miss_ref ON external_missionaries(reference);
CREATE INDEX IF NOT EXISTS idx_ext_miss_status ON external_missionaries(status);

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
    destination_service_id INTEGER REFERENCES services(id) DEFAULT 5,
    destination_service_name TEXT DEFAULT 'Secrétariat Central',
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
    status TEXT NOT NULL DEFAULT 'EN_ATTENTE_SC',
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
CREATE INDEX IF NOT EXISTS idx_mo_req_dest_service ON mission_order_requests(destination_service_id);

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

-- =======================================================
-- MODULE DE DISPATCHING ET DE DIFFUSION ADMINISTRATIVE
-- =======================================================

CREATE TABLE IF NOT EXISTS document_dispatches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT UNIQUE NOT NULL, -- DSP-UK-2026-000001
    document_id INTEGER NOT NULL,
    dispatch_type TEXT NOT NULL DEFAULT 'SIMPLE', -- SIMPLE, PRISE_DE_CONNAISSANCE, ACTION_REQUISE
    title TEXT NOT NULL,
    message TEXT,
    action_description TEXT,
    deadline DATETIME,
    sender_user_id INTEGER NOT NULL,
    sender_service_id INTEGER NOT NULL,
    tenant_id TEXT DEFAULT 'UNIVERSITE_KINDIA',
    total_recipients INTEGER DEFAULT 0,
    acknowledged_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'EN_COURS', -- EN_COURS, TERMINE, EN_RETARD
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_user_id) REFERENCES users(id),
    FOREIGN KEY (sender_service_id) REFERENCES services(id)
);
CREATE INDEX IF NOT EXISTS idx_doc_disp_ref ON document_dispatches(reference);
CREATE INDEX IF NOT EXISTS idx_doc_disp_doc ON document_dispatches(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_disp_status ON document_dispatches(status);
CREATE INDEX IF NOT EXISTS idx_doc_disp_tenant ON document_dispatches(tenant_id);

CREATE TABLE IF NOT EXISTS dispatch_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatch_id INTEGER NOT NULL,
    document_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    user_id INTEGER,
    tenant_id TEXT DEFAULT 'UNIVERSITE_KINDIA',
    status TEXT DEFAULT 'NON_CONSULTE', -- NON_CONSULTE, CONSULTE, PRISE_DE_CONNAISSANCE, ACTION_EN_COURS, ACTION_TERMINEE, EN_RETARD
    first_viewed_at DATETIME,
    first_viewed_by INTEGER,
    acknowledged_at DATETIME,
    acknowledged_by INTEGER,
    action_started_at DATETIME,
    action_completed_at DATETIME,
    action_completed_by INTEGER,
    action_response_comment TEXT,
    action_response_attachment_path TEXT,
    ip_address TEXT,
    reminders_sent INTEGER DEFAULT 0,
    last_reminder_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dispatch_id) REFERENCES document_dispatches(id) ON DELETE CASCADE,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (first_viewed_by) REFERENCES users(id),
    FOREIGN KEY (acknowledged_by) REFERENCES users(id),
    FOREIGN KEY (action_completed_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_disp_rec_disp ON dispatch_recipients(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_disp_rec_doc ON dispatch_recipients(document_id);
CREATE INDEX IF NOT EXISTS idx_disp_rec_service ON dispatch_recipients(service_id);
CREATE INDEX IF NOT EXISTS idx_disp_rec_status ON dispatch_recipients(status);
CREATE INDEX IF NOT EXISTS idx_disp_rec_tenant ON dispatch_recipients(tenant_id);

CREATE TABLE IF NOT EXISTS dispatch_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatch_id INTEGER NOT NULL,
    recipient_id INTEGER,
    service_id INTEGER,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dispatch_id) REFERENCES document_dispatches(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES dispatch_recipients(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_disp_log_disp ON dispatch_logs(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_disp_log_rec ON dispatch_logs(recipient_id);

-- 28. Official Document Receipts with QR Code Table
CREATE TABLE IF NOT EXISTS document_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    receipt_number TEXT UNIQUE NOT NULL,
    receipt_type TEXT NOT NULL, -- INCOMING_MAIL, MISSION_ORDER, OUTGOING_MAIL
    file_path TEXT NOT NULL,
    qr_code_data TEXT NOT NULL,
    verification_url TEXT NOT NULL,
    created_by INTEGER,
    tenant_id TEXT DEFAULT 'UNIVERSITE_KINDIA',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_receipt_doc ON document_receipts(document_id);
CREATE INDEX IF NOT EXISTS idx_receipt_num ON document_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipt_type ON document_receipts(receipt_type);
CREATE INDEX IF NOT EXISTS idx_receipt_tenant ON document_receipts(tenant_id);


