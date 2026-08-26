/**
 * Document Type Access Control and Management Service
 * Implements strict, fine-grained, configurable RBAC & ABAC permissions per document type,
 * with ordinary services restrictions, Secrétariat Central extended access, and Administrator catalog management.
 */

const db = require('../database/db');
const { logAuditAction } = require('../middleware/audit');

class DocumentTypeService {
  /**
   * Evaluate whether a user (by role and service) is authorized to create a specific document type
   */
  async canUserCreateDocumentType(user, documentTypeCode) {
    if (!user || !documentTypeCode) return false;
    const code = documentTypeCode.trim().toUpperCase();

    // 1. Level 3: Administrator has absolute universal creation rights
    if (user.role_code === 'ADMINISTRATEUR') {
      return true;
    }

    // 2. Level 2: Secrétariat Central has extended creation rights across all types
    if (user.service_code === 'SC') {
      return true;
    }

    // 3. Check explicit permission overrides in document_type_permissions
    // Precedence: (Service + Role) > (Service only) > (Role only)
    const userServId = user.service_id || null;
    const userRoleId = user.role_id || null;

    if (userServId || userRoleId) {
      const explicitPerms = await db.all(`
        SELECT * FROM document_type_permissions
        WHERE document_type_code = ?
          AND (
            (service_id = ? AND role_id = ?)
            OR (service_id = ? AND role_id IS NULL)
            OR (service_id IS NULL AND role_id = ?)
          )
        ORDER BY 
          (CASE 
            WHEN service_id IS NOT NULL AND role_id IS NOT NULL THEN 1 
            WHEN service_id IS NOT NULL THEN 2 
            ELSE 3 
          END) ASC
      `, [code, userServId, userRoleId, userServId, userRoleId]);

      if (explicitPerms && explicitPerms.length > 0) {
        return explicitPerms[0].can_create === 1;
      }
    }

    // 4. Default policy based on is_restricted in document_type_configs
    const typeConfig = await db.get('SELECT * FROM document_type_configs WHERE code = ?', [code]);
    if (!typeConfig) {
      // If type not explicitly configured, fallback to checking if it is in hard restricted list
      const hardRestricted = ['DECRET', 'ARRETE', 'LOI', 'DECISION', 'CIRCULAIRE', 'INSTRUCTION'];
      return !hardRestricted.includes(code);
    }

    // If type is marked restricted (is_restricted = 1), ordinary services are disallowed by default
    if (typeConfig.is_restricted === 1) {
      return false;
    }

    // Otherwise, ordinary active types are allowed
    return typeConfig.is_active === 1;
  }

  /**
   * Get all creatable document types for the authenticated user
   */
  async getCreatableDocumentTypesForUser(user) {
    const allActiveTypes = await db.all(
      'SELECT * FROM document_type_configs WHERE is_active = 1 ORDER BY display_order ASC, label ASC'
    );

    const creatableTypes = [];
    for (const dt of allActiveTypes) {
      const allowed = await this.canUserCreateDocumentType(user, dt.code);
      if (allowed) {
        creatableTypes.push(dt);
      }
    }

    return creatableTypes;
  }

  /**
   * Get permissions matrix for a document type (for Admin configuration)
   */
  async getPermissionsMatrix(typeCode) {
    const code = typeCode.toUpperCase();
    const typeConfig = await db.get('SELECT * FROM document_type_configs WHERE code = ?', [code]);
    if (!typeConfig) {
      throw new Error(`Type de document introuvable: ${typeCode}`);
    }

    const permissions = await db.all(`
      SELECT p.*, s.name as service_name, s.code as service_code, r.name as role_name, r.code as role_code
      FROM document_type_permissions p
      LEFT JOIN services s ON p.service_id = s.id
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.document_type_code = ?
      ORDER BY s.name ASC, r.name ASC
    `, [code]);

    const services = await db.all('SELECT id, name, code FROM services ORDER BY name ASC');
    const roles = await db.all('SELECT id, name, code FROM roles ORDER BY name ASC');

    return {
      type: typeConfig,
      permissions,
      services,
      roles
    };
  }

  /**
   * Set or update permissions for a document type (Admin only)
   */
  async updatePermissions(typeCode, rules, adminUser, req = null) {
    const code = typeCode.toUpperCase();
    const typeConfig = await db.get('SELECT * FROM document_type_configs WHERE code = ?', [code]);
    if (!typeConfig) {
      throw new Error(`Type de document introuvable: ${typeCode}`);
    }

    // Clean existing permissions for this type
    await db.run('DELETE FROM document_type_permissions WHERE document_type_code = ?', [code]);

    // Insert new rules
    if (Array.isArray(rules)) {
      for (const rule of rules) {
        await db.run(`
          INSERT INTO document_type_permissions (document_type_code, service_id, role_id, can_create, can_edit, can_view, can_delete)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          code,
          rule.service_id ? parseInt(rule.service_id) : null,
          rule.role_id ? parseInt(rule.role_id) : null,
          rule.can_create !== undefined ? (rule.can_create ? 1 : 0) : 1,
          rule.can_edit !== undefined ? (rule.can_edit ? 1 : 0) : 1,
          rule.can_view !== undefined ? (rule.can_view ? 1 : 0) : 1,
          rule.can_delete !== undefined ? (rule.can_delete ? 1 : 0) : 0
        ]);
      }
    }

    if (req) {
      await logAuditAction(adminUser.id, 'UPDATE_DOC_TYPE_PERMISSIONS', 'SETTINGS', 0, req, {
        document_type_code: code,
        rules_count: rules ? rules.length : 0
      });
    }

    return { success: true, message: `Permissions du type [${typeConfig.label}] mises à jour avec succès.` };
  }

  /**
   * Create a new document type
   */
  async createDocumentType(data, adminUser, req = null) {
    const { code, label, category, description, icon, is_restricted, default_reference_pattern, allowed_fields_json, display_order } = data;

    if (!code || !label) {
      throw new Error('Le code et le libellé sont obligatoires.');
    }

    const normalizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const existing = await db.get('SELECT code FROM document_type_configs WHERE code = ?', [normalizedCode]);
    if (existing) {
      throw new Error(`Le type de document avec le code [${normalizedCode}] existe déjà.`);
    }

    await db.run(`
      INSERT INTO document_type_configs 
      (code, label, category, description, icon, is_restricted, is_active, allow_direct_archive, default_reference_pattern, allowed_fields_json, display_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
      normalizedCode,
      label.trim(),
      category || 'OFFICIAL',
      description || null,
      icon || 'FileText',
      is_restricted ? 1 : 0,
      default_reference_pattern || `${normalizedCode}/{SERVICE}/{ANNEE}/{NUMERO}`,
      allowed_fields_json || null,
      display_order || 50
    ]);

    if (req) {
      await logAuditAction(adminUser.id, 'CREATE_DOC_TYPE', 'SETTINGS', 0, req, {
        code: normalizedCode,
        label
      });
    }

    return await db.get('SELECT * FROM document_type_configs WHERE code = ?', [normalizedCode]);
  }

  /**
   * Update an existing document type
   */
  async updateDocumentType(code, data, adminUser, req = null) {
    const existing = await db.get('SELECT * FROM document_type_configs WHERE code = ?', [code]);
    if (!existing) {
      throw new Error(`Type de document introuvable: ${code}`);
    }

    const { label, category, description, icon, is_restricted, is_active, default_reference_pattern, allowed_fields_json, display_order } = data;

    await db.run(`
      UPDATE document_type_configs
      SET label = ?,
          category = ?,
          description = ?,
          icon = ?,
          is_restricted = ?,
          is_active = ?,
          default_reference_pattern = ?,
          allowed_fields_json = ?,
          display_order = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE code = ?
    `, [
      label !== undefined ? label.trim() : existing.label,
      category !== undefined ? category : existing.category,
      description !== undefined ? description : existing.description,
      icon !== undefined ? icon : existing.icon,
      is_restricted !== undefined ? (is_restricted ? 1 : 0) : existing.is_restricted,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      default_reference_pattern !== undefined ? default_reference_pattern : existing.default_reference_pattern,
      allowed_fields_json !== undefined ? allowed_fields_json : existing.allowed_fields_json,
      display_order !== undefined ? parseInt(display_order) : existing.display_order,
      code
    ]);

    if (req) {
      await logAuditAction(adminUser.id, 'UPDATE_DOC_TYPE', 'SETTINGS', 0, req, {
        code,
        label: label || existing.label
      });
    }

    return await db.get('SELECT * FROM document_type_configs WHERE code = ?', [code]);
  }

  /**
   * Safe logical deactivation of document type (Never physically delete historical types)
   */
  async deactivateDocumentType(code, adminUser, req = null) {
    const existing = await db.get('SELECT * FROM document_type_configs WHERE code = ?', [code]);
    if (!existing) {
      throw new Error(`Type de document introuvable: ${code}`);
    }

    // Check usage in documents
    const usage = await db.get(
      'SELECT COUNT(*) as count FROM documents WHERE document_type = ? OR document_category = ?',
      [code, code]
    );

    // If documents use this type, soft-deactivate to preserve historical integrity
    await db.run('UPDATE document_type_configs SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE code = ?', [code]);

    if (req) {
      await logAuditAction(adminUser.id, 'DEACTIVATE_DOC_TYPE', 'SETTINGS', 0, req, {
        code,
        historical_documents_count: usage.count
      });
    }

    return {
      success: true,
      message: `Type de document [${existing.label}] désactivé avec succès. Les ${usage.count} document(s) historiques restent intacts.`
    };
  }
}

module.exports = new DocumentTypeService();
