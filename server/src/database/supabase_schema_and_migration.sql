-- ========================================================================================
-- UK-GED : SCHÉMA POSTGRESQL & MIGRATION COMPLÈTE POUR SUPABASE FULL-STACK
-- Université de Kindia - République de Guinée
-- ========================================================================================

-- 1. EXTENSIONS REQUISES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLE DES PARAMÈTRES INSTITUTIONNELS
CREATE TABLE IF NOT EXISTS public.institution_settings (
    id SERIAL PRIMARY KEY,
    institution_name VARCHAR(255) NOT NULL DEFAULT 'UNIVERSITÉ DE KINDIA',
    institution_code VARCHAR(50) NOT NULL DEFAULT 'UK',
    country VARCHAR(100) NOT NULL DEFAULT 'RÉPUBLIQUE DE GUINÉE',
    motto VARCHAR(150) NOT NULL DEFAULT 'Travail – Justice – Solidarité',
    ministry VARCHAR(255) NOT NULL DEFAULT 'MINISTÈRE DE L''ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L''INNOVATION',
    address VARCHAR(255) DEFAULT 'BP 164 Kindia, Guinée',
    phone VARCHAR(50) DEFAULT '+224 622 00 00 00',
    email VARCHAR(100) DEFAULT 'contact@univ-kindia.edu.gn',
    website VARCHAR(100) DEFAULT 'https://univ-kindia.edu.gn',
    logo_url TEXT,
    header_template TEXT,
    footer_template TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. STRUCTURES ADMINISTRATIVES ET SERVICES (Hiérarchie UK -> Facultés -> Départements)
CREATE TABLE IF NOT EXISTS public.services (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'SERVICE', -- 'RECTORAT', 'SECRETARIAT_GENERAL', 'FACULTY', 'DEPARTMENT', 'SERVICE', 'CENTRAL'
    parent_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    reference_code VARCHAR(30) UNIQUE,
    head_user_id UUID, -- lié au responsable
    function_title VARCHAR(150),
    description TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. PARAMÈTRES D'EN-TÊTE, PIED DE PAGE ET RÉFÉRENCE PROPRES À CHAQUE SERVICE
CREATE TABLE IF NOT EXISTS public.service_document_settings (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL UNIQUE REFERENCES public.services(id) ON DELETE CASCADE,
    header_title TEXT,
    header_subtitle TEXT,
    footer_text TEXT,
    reference_format VARCHAR(100) DEFAULT '{YEAR}/{SEQ}/MESRSI/UK/{SERVICE}',
    logo_url TEXT,
    signatory_title VARCHAR(150),
    signatory_name VARCHAR(150),
    is_customized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. RÔLES ET PERMISSIONS (RBAC & ABAC)
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    hierarchy_level INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id INTEGER REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 6. UTILISATEURS (Synchronisés avec auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE, -- Correspond à auth.users.id de Supabase
    email VARCHAR(150) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role_code VARCHAR(50) REFERENCES public.roles(code) ON DELETE SET NULL,
    service_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    function_title VARCHAR(150),
    phone VARCHAR(50),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. TYPES D'ACTES ET DE DOCUMENTS OFFICIELS
CREATE TABLE IF NOT EXISTS public.document_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(150) NOT NULL,
    category VARCHAR(50) DEFAULT 'OFFICIEL', -- 'CORRESPONDANCE', 'ACTE_REGLEMENTAIRE', 'RAPPORT', 'PEDAGOGIQUE'
    description TEXT,
    requires_approval BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. CATÉGORIES D'ARCHIVES PROPRES À CHAQUE SERVICE (Règle 28 : Tri alphabétique & Types associés)
CREATE TABLE IF NOT EXISTS public.archive_categories (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (service_id, name)
);

-- TABLE DE LIAISON MULTI-TYPES VERS CATÉGORIES D'ARCHIVES
CREATE TABLE IF NOT EXISTS public.category_document_types (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES public.archive_categories(id) ON DELETE CASCADE,
    document_type_code VARCHAR(50) NOT NULL REFERENCES public.document_types(code) ON DELETE CASCADE,
    is_default_type BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (category_id, document_type_code)
);

-- 9. MODÈLES DE DOCUMENTS ADMINISTRATIFS (Règles 1-15 : Modèles réels, scopes, isolation par service)
CREATE TABLE IF NOT EXISTS public.document_templates (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    document_type_code VARCHAR(50) REFERENCES public.document_types(code) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) DEFAULT 'OFFICIAL',
    scope_type VARCHAR(30) DEFAULT 'SERVICE', -- 'GLOBAL', 'FACULTY', 'DEPARTMENT', 'SERVICE'
    target_service_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    document_category VARCHAR(50),
    description TEXT,
    editor_type VARCHAR(30) DEFAULT 'UK_GED_EDITOR', -- 'UK_GED_EDITOR', 'MS_WORD'
    format VARCHAR(20) DEFAULT 'DOCX',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    file_path TEXT,
    header_text TEXT,
    footer_text TEXT,
    content_body_html TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.template_versions (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    version_number INTEGER NOT NULL DEFAULT 1,
    file_path TEXT,
    file_type VARCHAR(20) DEFAULT 'DOCX',
    editor_type VARCHAR(30) DEFAULT 'UK_GED_EDITOR',
    content_body_html TEXT,
    change_description TEXT,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.template_fields (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
    field_key VARCHAR(100) NOT NULL,
    field_label VARCHAR(150) NOT NULL,
    field_type VARCHAR(50) DEFAULT 'TEXT',
    is_required BOOLEAN DEFAULT FALSE,
    default_value TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 10. DOCUMENTS ADMINISTRATIFS (Courriers entrants, sortants, actes, notes, délibérations)
CREATE TABLE IF NOT EXISTS public.documents (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(100) UNIQUE NOT NULL,
    tracking_token VARCHAR(100) UNIQUE,
    document_type VARCHAR(50) NOT NULL,
    document_category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_body TEXT,
    current_version INTEGER DEFAULT 1,
    last_edited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    sender_name VARCHAR(150),
    sender_organization VARCHAR(150),
    priority VARCHAR(30) DEFAULT 'NORMAL', -- 'LOW', 'NORMAL', 'URGENT', 'VERY_URGENT'
    confidentiality VARCHAR(30) DEFAULT 'INTERNAL', -- 'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SECRET'
    status VARCHAR(50) DEFAULT 'EN_COURS', -- 'BROUILLON', 'SOUMIS', 'EN_COURS', 'SIGNE', 'TRANSMIS', 'ARCHIVED', 'REJETE'
    
    -- Rattachements de structure
    originating_service_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    current_service_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    current_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    target_service_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    target_recipient_type VARCHAR(30) DEFAULT 'SERVICE', -- 'SERVICE', 'USER', 'EXTERNAL'
    target_recipient_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    target_recipient_name VARCHAR(150),
    
    -- Archivage
    archive_category_id INTEGER REFERENCES public.archive_categories(id) ON DELETE SET NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- Snapshots au moment de la génération
    originating_head_name VARCHAR(150),
    originating_head_function VARCHAR(150),
    service_sequence_number INTEGER,
    reference_meta JSONB,
    
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- DÉTAILS COURRIERS ENTRANTS
CREATE TABLE IF NOT EXISTS public.incoming_mails (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL UNIQUE REFERENCES public.documents(id) ON DELETE CASCADE,
    reception_date DATE NOT NULL DEFAULT CURRENT_DATE,
    sender_address TEXT,
    mail_type VARCHAR(50) DEFAULT 'OFFICIAL',
    instruction TEXT,
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- DÉTAILS COURRIERS SORTANTS
CREATE TABLE IF NOT EXISTS public.outgoing_mails (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL UNIQUE REFERENCES public.documents(id) ON DELETE CASCADE,
    dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
    recipient_address TEXT,
    dispatch_mode VARCHAR(50) DEFAULT 'COURSIER', -- 'COURSIER', 'POSTE', 'EMAIL', 'MAIN_PROPRE'
    courier_name VARCHAR(100),
    signed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. TRANSMISSIONS, CIRCUITS DE VISA & HISTORIQUE
CREATE TABLE IF NOT EXISTS public.document_transfers (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    from_service_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    from_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    to_service_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'TRANSMIT', 'ASSIGN', 'RETURN', 'FORWARD', 'DIFFUSE'
    instruction TEXT,
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED'
    transferred_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.document_visas (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL DEFAULT 1,
    required_role VARCHAR(50),
    service_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    comment TEXT,
    signed_at TIMESTAMPTZ,
    signature_data TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.document_history (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    service_id INTEGER REFERENCES public.services(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    details TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. PIÈCES JOINTES ET RÉCÉPISSÉS OFFICIELS
CREATE TABLE IF NOT EXISTS public.attachments (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    mime_type VARCHAR(100),
    storage_bucket VARCHAR(50) DEFAULT 'attachments',
    ocr_extracted_text TEXT,
    uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.official_receipts (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    pdf_path TEXT,
    storage_bucket VARCHAR(50) DEFAULT 'receipts',
    qr_code_data TEXT,
    verification_url TEXT,
    issued_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    issued_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. AUDIT LOGS & RÈGLES DE WORKFLOW
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.workflow_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    from_structure_type VARCHAR(50),
    to_structure_type VARCHAR(50),
    authorized_signatory_role VARCHAR(50),
    requires_sg_visa BOOLEAN DEFAULT TRUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================================
-- TRIGGERS INTELLIGENTS : AUTO-PROVISIONING DES CATÉGORIES PAR SERVICE (Règle 28)
-- ========================================================================================
CREATE OR REPLACE FUNCTION public.fn_auto_create_default_service_categories()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Catégorie Soit-transmis
    INSERT INTO public.archive_categories (service_id, name, code, is_default, order_index)
    VALUES (NEW.id, 'Soit-transmis', 'SOIT_TRANSMIS', TRUE, 1)
    ON CONFLICT (service_id, name) DO NOTHING;

    -- 2. Catégorie Demandes
    INSERT INTO public.archive_categories (service_id, name, code, is_default, order_index)
    VALUES (NEW.id, 'Demandes', 'DEMANDES', TRUE, 2)
    ON CONFLICT (service_id, name) DO NOTHING;

    -- 3. Initialiser les paramètres de document du service
    INSERT INTO public.service_document_settings (service_id, header_title, reference_format)
    VALUES (
        NEW.id,
        'RÉPUBLIQUE DE GUINÉE\nUNIVERSITÉ DE KINDIA\n' || UPPER(NEW.name),
        '{YEAR}/{SEQ}/MESRSI/UK/' || COALESCE(NEW.reference_code, NEW.code)
    )
    ON CONFLICT (service_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_service_default_categories ON public.services;
CREATE TRIGGER trg_service_default_categories
AFTER INSERT ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_create_default_service_categories();

-- ========================================================================================
-- ROW LEVEL SECURITY (RLS) - ISOLATION STRICTE PAR SERVICE & ACCÈS CENTRAL
-- ========================================================================================
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Politiques de lecture publique / authentifiée
CREATE POLICY "Services visibilité authentifiée" ON public.services
    FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Catégories visibilité par service" ON public.archive_categories
    FOR SELECT TO authenticated USING (
        service_id = (SELECT service_id FROM public.users WHERE id = auth.uid())
        OR (SELECT role_code FROM public.users WHERE id = auth.uid()) IN ('ADMINISTRATEUR', 'SG', 'RECTEUR')
    );

CREATE POLICY "Modèles visibilité par service et globaux" ON public.document_templates
    FOR SELECT TO authenticated USING (
        is_active = TRUE AND (
            scope_type = 'GLOBAL'
            OR target_service_id IS NULL
            OR target_service_id = (SELECT service_id FROM public.users WHERE id = auth.uid())
            OR (SELECT role_code FROM public.users WHERE id = auth.uid()) = 'ADMINISTRATEUR'
        )
    );

-- ========================================================================================
-- CRÉATION DES BUCKETS SUPABASE STORAGE
-- ========================================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('documents', 'documents', false),
    ('attachments', 'attachments', false),
    ('receipts', 'receipts', false),
    ('templates', 'templates', false)
ON CONFLICT (id) DO NOTHING;
