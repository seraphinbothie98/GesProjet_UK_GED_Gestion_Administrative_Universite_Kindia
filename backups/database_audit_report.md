# RAPPORT D'AUDIT COMPLET ET PRÉPARATION SUPABASE - UK-GED

**Date de l'audit** : 26/08/2026 05:56:34
**Base analysée** : `c:\Users\bothi\.gemini\antigravity-ide\scratch\GesProjet_UK_GED_Gestion_Administrative_Universite_Kindia\server\data\dev\uk_ged_dev.db`
**Taille du fichier** : 1.49 MB (1560576 octets)
**Date de dernière modification** : 26/08/2026 04:08:05

## A. SYNTHÈSE GLOBALE DE LA BASE ACTUELLE

- **Moteur de base de données** : SQLite 3 (Driver Node.js `sqlite3` v5.1.7)
- **Chemin absolu** : `c:\Users\bothi\.gemini\antigravity-ide\scratch\GesProjet_UK_GED_Gestion_Administrative_Universite_Kindia\server\data\dev\uk_ged_dev.db`
- **Nombre total de tables** : **64**
- **Nombre total d'enregistrements** : **5603**
- **Nombre total d'index (hors PKs)** : **97**
- **Nombre total de relations (Clés étrangères)** : **144**
- **Nombre de vues** : **0**
- **Nombre de triggers** : **0**

## B. SYNTHÈSE DES TABLES ET VOLUMÉTRIE

| Table | Colonnes | Enregistrements | PK | FK | Index |
| :--- | :---: | :---: | :--- | :---: | :---: |
| `_schema_migrations` | 7 | **11** | `id` | 0 | 2 |
| `roles` | 6 | **7** | `id` | 0 | 1 |
| `services` | 19 | **52** | `id` | 1 | 1 |
| `users` | 23 | **17** | `id` | 2 | 2 |
| `appointment_availabilities` | 8 | **0** | `id` | 1 | 0 |
| `archive_custom_categories` | 15 | **131** | `id` | 2 | 2 |
| `service_transmissions` | 35 | **1** | `id` | 11 | 5 |
| `documents` | 75 | **1** | `id` | 15 | 6 |
| `appointments` | 38 | **0** | `id` | 7 | 7 |
| `appointment_history` | 8 | **0** | `id` | 2 | 0 |
| `appointment_settings` | 2 | **3** | `key` | 0 | 0 |
| `archive_categories` | 8 | **0** | `id` | 1 | 1 |
| `archive_category_document_types` | 6 | **15** | `id` | 1 | 3 |
| `archive_shares` | 7 | **0** | `id` | 3 | 2 |
| `attachments` | 9 | **1** | `id` | 2 | 0 |
| `audit_logs` | 8 | **4692** | `id` | 1 | 1 |
| `calendar_blocks` | 9 | **0** | `id` | 2 | 0 |
| `dispatches` | 12 | **0** | `id` | 2 | 1 |
| `dispatch_items` | 7 | **0** | `id` | 2 | 0 |
| `document_dispatches` | 17 | **0** | `id` | 3 | 5 |
| `dispatch_recipients` | 21 | **0** | `id` | 7 | 5 |
| `dispatch_logs` | 9 | **0** | `id` | 4 | 2 |
| `document_editing_locks` | 7 | **0** | `id` | 2 | 2 |
| `document_history` | 7 | **1** | `id` | 3 | 1 |
| `document_receipts` | 11 | **0** | `id` | 2 | 5 |
| `user_signatures` | 16 | **3** | `id` | 2 | 0 |
| `document_signatures` | 7 | **0** | `id` | 2 | 0 |
| `document_template_instances` | 6 | **1** | `id` | 1 | 0 |
| `document_templates` | 34 | **20** | `id` | 1 | 1 |
| `document_transfers` | 14 | **1** | `id` | 5 | 2 |
| `document_type_configs` | 13 | **27** | `code` | 0 | 0 |
| `document_type_permissions` | 10 | **51** | `id` | 2 | 3 |
| `document_versions` | 19 | **1** | `id` | 2 | 1 |
| `external_missionaries` | 45 | **0** | `id` | 8 | 3 |
| `external_missionary_history` | 7 | **0** | `id` | 3 | 1 |
| `incoming_mails` | 6 | **0** | `document_id` | 1 | 0 |
| `institution_settings` | 30 | **1** | `id` | 0 | 0 |
| `mission_order_requests` | 31 | **0** | `id` | 2 | 7 |
| `mission_order_request_attachments` | 7 | **0** | `id` | 1 | 1 |
| `mission_order_request_history` | 9 | **0** | `id` | 2 | 1 |
| `mission_orders` | 47 | **0** | `document_id` | 2 | 0 |
| `mission_requests` | 13 | **0** | `id` | 2 | 1 |
| `mission_request_steps` | 8 | **0** | `id` | 2 | 0 |
| `notifications` | 9 | **2** | `id` | 2 | 1 |
| `number_sequences` | 3 | **16** | `seq_key, year` | 0 | 0 |
| `official_receipts` | 11 | **0** | `id` | 2 | 1 |
| `outgoing_mails` | 5 | **1** | `document_id` | 2 | 0 |
| `password_reset_tokens` | 8 | **0** | `id` | 1 | 3 |
| `permissions` | 4 | **105** | `id` | 0 | 1 |
| `role_permissions` | 2 | **358** | `role_id, permission_id` | 2 | 0 |
| `service_custom_fields` | 20 | **0** | `id` | 0 | 3 |
| `service_document_settings` | 32 | **4** | `id` | 3 | 2 |
| `service_document_settings_history` | 7 | **14** | `id` | 2 | 1 |
| `service_heads_history` | 9 | **8** | `id` | 2 | 2 |
| `service_transmission_history` | 9 | **1** | `id` | 3 | 1 |
| `signature_versions` | 8 | **3** | `id` | 1 | 0 |
| `signatures` | 7 | **0** | `id` | 2 | 0 |
| `staff` | 14 | **26** | `id` | 2 | 5 |
| `template_fields` | 10 | **0** | `id` | 1 | 0 |
| `template_versions` | 15 | **8** | `id` | 1 | 0 |
| `users_temp` | 17 | **8** | `Aucune` | 0 | 0 |
| `vehicles` | 8 | **8** | `id` | 1 | 0 |
| `verification_tokens` | 6 | **0** | `id` | 1 | 1 |
| `workflow_rules` | 13 | **4** | `id` | 2 | 1 |

## C. VÉRIFICATION DE L'INTÉGRITÉ ET PROBLÈMES DÉTECTÉS

| Gravité | Catégorie | Table / Contexte | Description |
| :--- | :--- | :--- | :--- |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787643019109_onlyoffice_ordre_001_v2.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787643018654_pv_001.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787643018726_rapport_001.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522130_om_1787655522050.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522202_copy_om_1787655522050_copie.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522281_rap_1787655522050.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522316_copy_rap_1787655522050_copie.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522377_att_1787655522050.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522403_copy_att_1787655522050_copie.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522444_pv_1787655522050.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522465_copy_pv_1787655522050_copie.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522516_let_1787655522050.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522538_copy_let_1787655522050_copie.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522603_x_fin_1787655522050.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'template_1787655522622_copy_x_fin_1787655522050_copie.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'none.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'none.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'none.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'none.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `document_templates` | Le fichier référencé 'none.docx' dans la table 'document_templates.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `institution_settings` | Le fichier référencé '/uploads/logos/logo_1786815829682.png' dans la table 'institution_settings.logo_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `signature_versions` | Le fichier référencé '/uploads/signatures/sig_1786579995588_517.png' dans la table 'signature_versions.signature_image_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `signature_versions` | Le fichier référencé '/uploads/signatures/sig_1786580017367_278.png' dans la table 'signature_versions.signature_image_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `signature_versions` | Le fichier référencé '/uploads/signatures/sig_1787019081729_174.png' dans la table 'signature_versions.signature_image_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `template_versions` | Le fichier référencé 'template_1787641043384_ORDRE_Mission.docx' dans la table 'template_versions.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `template_versions` | Le fichier référencé 'template_1787643019109_onlyoffice_ordre_001_v2.docx' dans la table 'template_versions.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `template_versions` | Le fichier référencé 'template_1787655522130_om_1787655522050.docx' dans la table 'template_versions.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `template_versions` | Le fichier référencé 'template_1787655522281_rap_1787655522050.docx' dans la table 'template_versions.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `template_versions` | Le fichier référencé 'template_1787655522377_att_1787655522050.docx' dans la table 'template_versions.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `template_versions` | Le fichier référencé 'template_1787655522444_pv_1787655522050.docx' dans la table 'template_versions.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `template_versions` | Le fichier référencé 'template_1787655522516_let_1787655522050.docx' dans la table 'template_versions.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `template_versions` | Le fichier référencé 'template_1787655522603_x_fin_1787655522050.docx' dans la table 'template_versions.file_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `user_signatures` | Le fichier référencé '/uploads/signatures/sig_1786579995588_517.png' dans la table 'user_signatures.signature_image_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `user_signatures` | Le fichier référencé '/uploads/signatures/sig_1786580017367_278.png' dans la table 'user_signatures.signature_image_path' est introuvable sur le disque local. |
| **MINEUR** | Fichier référencé absent | `user_signatures` | Le fichier référencé '/uploads/signatures/sig_1787019081729_174.png' dans la table 'user_signatures.signature_image_path' est introuvable sur le disque local. |

## D. AUDIT DES FICHIERS UPLOADÉS ET STOCKAGE

- **Nombre total de fichiers sur disque** : **260**
- **Volume total des fichiers** : **17.32 MB**
- **Répartition par extension** :
  - `.pdf` : 107 fichier(s)
  - `.jpg` : 1 fichier(s)
  - `.docx` : 123 fichier(s)
  - `.png` : 20 fichier(s)
  - `.txt` : 9 fichier(s)

**Stratégie Supabase Storage recommandée** :
1. Créer un bucket de stockage Supabase Storage : `uk-ged-documents` (ou `documents`, `templates`, `signatures`, `receipts`).
2. Migrer les fichiers physiques vers le bucket via l'API Supabase Storage (`@supabase/supabase-js`).
3. Ne stocker dans PostgreSQL que les chemins relatifs / URLs d'accès sécurisées (RLS/Signed URLs).

## E. COMPATIBILITÉ POSTGRESQL / SUPABASE

| Type SQLite | Type PostgreSQL / Supabase | Règle de conversion appliquée |
| :--- | :--- | :--- |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGINT GENERATED BY DEFAULT AS IDENTITY` | Préservation stricte des IDs existants + recalibrage de la séquence via `setval()` |
| `INTEGER` (booléen : is_*, has_*, active, etc.) | `BOOLEAN` | Conversion explicite `0 -> FALSE`, `1 -> TRUE` |
| `TEXT` (JSON : metadata, dynamic_fields, etc.) | `JSONB` | Validation et typage `::jsonb` pour indexation performante |
| `TEXT` (Dates / Horodatages) | `TIMESTAMPTZ` / `DATE` | Typage `::timestamptz` et `::date` avec support fuseau horaire |
| `TEXT` (Chemins, codes, libellés) | `TEXT` | Typage texte standard sans perte |
| `REAL` / `NUMERIC` | `DOUBLE PRECISION` / `NUMERIC` | Préservation de la précision décimale |

## F. CONTRÔLE FINAL ET FICHIERS PRODUITS

- **Fichier SQL de migration généré** : `backups/supabase_migration.sql`
- **Fichier de schéma JSON** : `backups/database_schema.json`
- **Fichier de comptage JSON** : `backups/database_data_counts.json`
- **Rapport d'audit complet** : `backups/database_audit_report.md`

**Vérification de concordance** :
- `TABLES_SOURCE` (64) = `TABLES_MIGRATION` (64) ✅
- `RECORDS_SOURCE` (5603) = `RECORDS_MIGRATION` (5603) ✅
- `RELATIONS_SOURCE` (144) = `RELATIONS_MIGRATION` (144) ✅

> **Rappel de sécurité** : Aucune modification n'a été apportée à la base SQLite d'origine ni à l'application. La migration Supabase est prête en attente d'approbation.
