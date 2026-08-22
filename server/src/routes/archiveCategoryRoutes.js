const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// Helper to generate unique category code
function generateCategoryCode(name, serviceId) {
  const baseSlug = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);
  return `CAT_${baseSlug}_S${serviceId || 'GEN'}`;
}

// Helper to ensure mandatory default categories exist for a service (Rule 1 & 12)
async function ensureServiceDefaultCategories(serviceId, creatorUserId = 1) {
  if (!serviceId || serviceId <= 0) return;
  try {
    const existingDefault = await db.all(
      `SELECT code, name FROM archive_custom_categories WHERE service_id = ?`,
      [serviceId]
    );

    const hasSoitTransmis = existingDefault.some(c => 
      c.code === 'SOIT_TRANSMIS' || c.name.toLowerCase().includes('soit-transmis')
    );
    const hasDemandes = existingDefault.some(c => 
      c.code === 'DEMANDE' || c.name.toLowerCase().includes('demande')
    );

    if (!hasSoitTransmis) {
      await db.run(
        `INSERT OR IGNORE INTO archive_custom_categories 
         (service_id, code, name, description, icon, color, display_order, is_default, is_active, created_by)
         VALUES (?, 'SOIT_TRANSMIS', 'Soit-transmis', 'Actes et bordereaux de transmission officielle', 'Send', 'text-amber-700 bg-amber-50 border-amber-200', 10, 1, 1, ?)`,
        [serviceId, creatorUserId]
      );
    }

    if (!hasDemandes) {
      await db.run(
        `INSERT OR IGNORE INTO archive_custom_categories 
         (service_id, code, name, description, icon, color, display_order, is_default, is_active, created_by)
         VALUES (?, 'DEMANDE', 'Demandes', 'Demandes administratives, requêtes et congés', 'FileText', 'text-blue-700 bg-blue-50 border-blue-200', 20, 1, 1, ?)`,
        [serviceId, creatorUserId]
      );
    }
  } catch (e) {
    console.warn(`[ensureServiceDefaultCategories] Error for service ${serviceId}:`, e.message);
  }
}

// GET /api/archive-categories/admin/services-summary - Summary list for Admin archive management (Rule 3 & 8)
router.get('/admin/services-summary', authenticateToken, async (req, res) => {
  const user = req.user;
  if (user.role_code !== 'ADMINISTRATEUR') {
    return res.status(403).json({ error: 'Accès réservé à l’administrateur système.' });
  }

  try {
    const services = await db.all(`
      SELECT s.id, s.name, s.code, s.structure_type, s.acronym,
             p.name as parent_name, p.code as parent_code,
             (SELECT COUNT(*) FROM archive_custom_categories WHERE service_id = s.id) as categories_count,
             (SELECT COUNT(*) FROM documents WHERE (current_service_id = s.id OR owner_service_id = s.id OR originating_service_id = s.id) AND status IN ('ARCHIVED', 'ARCHIVÉ')) as archived_docs_count
      FROM services s
      LEFT JOIN services p ON s.parent_id = p.id
      ORDER BY s.order_index ASC, s.name ASC
    `);

    // Ensure all services have their default categories
    for (const s of services) {
      if (s.categories_count === 0) {
        await ensureServiceDefaultCategories(s.id, user.id);
      }
    }

    res.json(services);
  } catch (err) {
    console.error('Fetch services archive summary error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du résumé des archives par service.' });
  }
});

// Helper French alphabetical sort
const frenchCollator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
function sortFrenchAlphabetical(list, key = 'name') {
  return [...list].sort((a, b) => frenchCollator.compare(a[key] || a.label || '', b[key] || b.label || ''));
}

// GET /api/archive-categories/document-types - Retrieve all official document / act types
router.get('/document-types', authenticateToken, async (req, res) => {
  try {
    const types = await db.all(
      `SELECT code, label, category, description, icon, display_order, allow_direct_archive, is_active 
       FROM document_type_configs 
       WHERE is_active = 1 
       ORDER BY label ASC`
    );
    const sorted = sortFrenchAlphabetical(types, 'label');
    res.json(sorted);
  } catch (err) {
    console.error('Fetch document types error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des types de documents.' });
  }
});

// POST /api/archive-categories/document-types - Create a new official document / act type (Rule 4)
router.post('/document-types', authenticateToken, async (req, res) => {
  const user = req.user;
  const { label, description, icon, category } = req.body;

  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'Le libellé du type de document est obligatoire.' });
  }

  const trimmedLabel = label.trim();
  const baseSlug = trimmedLabel
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);

  const code = req.body.code ? req.body.code.trim().toUpperCase() : baseSlug;

  try {
    const existing = await db.get(
      'SELECT code, label FROM document_type_configs WHERE code = ? OR LOWER(label) = LOWER(?)',
      [code, trimmedLabel]
    );
    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'Ce type de document existe déjà.',
        type: existing
      });
    }

    await db.run(
      `INSERT INTO document_type_configs (code, label, category, description, icon, display_order, allow_direct_archive, is_active)
       VALUES (?, ?, ?, ?, ?, 50, 1, 1)`,
      [
        code,
        trimmedLabel,
        category || 'OFFICIAL',
        description ? description.trim() : `Acte officiel / type de document : ${trimmedLabel}`,
        icon || 'FileText'
      ]
    );

    const created = await db.get('SELECT * FROM document_type_configs WHERE code = ?', [code]);

    await logAuditAction(user.id, 'CREATE_DOCUMENT_TYPE', 'DOCUMENT_TYPE', code, req, {
      code,
      label: trimmedLabel
    });

    res.status(201).json({
      success: true,
      message: `Type d'acte [${trimmedLabel}] créé avec succès.`,
      type: created
    });
  } catch (err) {
    console.error('Create document type error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du type de document.' });
  }
});

// GET /api/archive-categories/suggest-category - Smart Suggestion (Rules 5, 6, 7, 8)
router.get('/suggest-category', authenticateToken, async (req, res) => {
  const user = req.user;
  const { type, service_id } = req.query;
  const targetServiceId = Number(service_id || user.service_id) || 1;

  if (!type) {
    return res.status(400).json({ error: 'Le paramètre type est requis.' });
  }

  const typeCode = type.trim().toUpperCase();

  try {
    // 1. Check custom categories for this service
    const categories = await db.all(
      `SELECT * FROM archive_custom_categories 
       WHERE service_id = ? AND is_active = 1 
       ORDER BY name ASC`,
      [targetServiceId]
    );

    let defaultCategory = null;
    const compatibleCategories = [];

    for (const cat of categories) {
      let assoc = [];
      let defTypes = [];
      try {
        assoc = JSON.parse(cat.associated_types_json || '[]');
      } catch (e) {}
      try {
        defTypes = JSON.parse(cat.is_default_for_types_json || '[]');
      } catch (e) {}

      const isAssociated = assoc.includes(typeCode) || cat.code === typeCode;
      const isDefault = defTypes.includes(typeCode) || (cat.is_default === 1 && isAssociated);

      if (isAssociated) {
        compatibleCategories.push(cat);
      }
      if (isDefault && !defaultCategory) {
        defaultCategory = cat;
      }
    }

    // Fallback: If no custom category explicitly matched, check default category for type (e.g. Soit-transmis for SOIT_TRANSMIS)
    if (!defaultCategory && compatibleCategories.length === 1) {
      defaultCategory = compatibleCategories[0];
    } else if (!defaultCategory) {
      // Look for standard category match
      const standardMatch = categories.find(c => c.code === typeCode || c.name.toUpperCase() === typeCode);
      if (standardMatch) {
        defaultCategory = standardMatch;
        if (!compatibleCategories.some(c => c.id === standardMatch.id)) {
          compatibleCategories.push(standardMatch);
        }
      }
    }

    res.json({
      type: typeCode,
      defaultCategory,
      compatibleCategories: sortFrenchAlphabetical(compatibleCategories, 'name'),
      allCategories: sortFrenchAlphabetical(categories, 'name')
    });
  } catch (err) {
    console.error('Suggest category error:', err);
    res.status(500).json({ error: 'Erreur lors de la suggestion de catégorie.' });
  }
});

// GET /api/archive-categories - Retrieve Standard + Service Specific Categories (with dynamic counts & Alphabetical Sort)
router.get('/', authenticateToken, async (req, res) => {
  const user = req.user;
  const isAdmin = user.role_code === 'ADMINISTRATEUR';
  const targetServiceId = (isAdmin && req.query.service_id)
    ? Number(req.query.service_id)
    : Number(user.service_id) || -1;

  try {
    if (targetServiceId > 0) {
      await ensureServiceDefaultCategories(targetServiceId, user.id);
    }

    // 1. Fetch system standard categories
    const standardCategories = await db.all(
      `SELECT code, label as name, description, icon, display_order, is_active, 
              'STANDARD' as source_type, NULL as service_id, NULL as id
       FROM document_type_configs 
       WHERE is_active = 1 
       ORDER BY label ASC`
    );

    // 2. Fetch service custom categories with real document counts
    let customQuery = `
      SELECT acc.id, acc.service_id, acc.code, acc.name, acc.description, 
             acc.icon, acc.color, acc.display_order, acc.associated_types_json, acc.is_default_for_types_json,
             acc.is_default, acc.is_active, 
             'CUSTOM' as source_type,
             s.name as service_name, s.code as service_code,
             u.first_name as creator_first, u.last_name as creator_last,
             acc.created_at, acc.updated_at,
             (SELECT COUNT(*) FROM documents d 
              WHERE (d.custom_category_id = acc.id OR d.document_type = acc.code OR d.archive_category = acc.name)
                AND (d.owner_service_id = acc.service_id OR d.originating_service_id = acc.service_id OR d.current_service_id = acc.service_id)) as document_count
      FROM archive_custom_categories acc
      LEFT JOIN services s ON acc.service_id = s.id
      LEFT JOIN users u ON acc.created_by = u.id
    `;
    const customParams = [];

    if (!isAdmin || targetServiceId > 0) {
      customQuery += ` WHERE acc.service_id = ?`;
      customParams.push(targetServiceId);
    }

    customQuery += ` ORDER BY acc.name COLLATE NOCASE ASC`;
    const rawCustomCategories = await db.all(customQuery, customParams);

    const customCategories = rawCustomCategories.map(cc => {
      let assoc = [];
      let defTypes = [];
      try {
        assoc = JSON.parse(cc.associated_types_json || '[]');
      } catch (e) {}
      try {
        defTypes = JSON.parse(cc.is_default_for_types_json || '[]');
      } catch (e) {}
      return {
        id: cc.id,
        code: cc.code,
        name: cc.name,
        description: cc.description,
        icon: cc.icon || 'Folder',
        color: cc.color || 'text-emerald-700 bg-emerald-50 border-emerald-200',
        display_order: cc.display_order || 100,
        associated_types: assoc,
        is_default_for_types: defTypes,
        is_default: cc.is_default === 1,
        is_active: cc.is_active === 1,
        document_count: cc.document_count || 0,
        source_type: 'CUSTOM',
        service_id: cc.service_id,
        service_name: cc.service_name,
        service_code: cc.service_code,
        created_by_name: cc.creator_first ? `${cc.creator_first} ${cc.creator_last}` : null
      };
    });

    const sortedCustomCategories = sortFrenchAlphabetical(customCategories, 'name');
    const sortedStandardCategories = sortFrenchAlphabetical(standardCategories, 'name');

    res.json({
      standards: sortedStandardCategories,
      customs: sortedCustomCategories,
      all: sortedCustomCategories.length > 0 ? sortedCustomCategories : sortedStandardCategories
    });
  } catch (err) {
    console.error('Fetch archive categories error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des catégories d’archivage.' });
  }
});

// POST /api/archive-categories - Create Custom Archive Category for Service (Rules 2, 3, 4, 9, 16)
router.post('/', authenticateToken, async (req, res) => {
  const user = req.user;
  const { 
    name, 
    description, 
    icon, 
    color, 
    display_order, 
    service_id, 
    associated_types = [], 
    is_default_for_types = [] 
  } = req.body;

  const isAdmin = user.role_code === 'ADMINISTRATEUR';
  
  // Rule 2 & 9: Service users can only create for their own service; Admin can specify service_id
  const targetServiceId = (isAdmin && service_id) 
    ? Number(service_id) 
    : (Number(user.service_id) || 1);

  if (!targetServiceId || targetServiceId <= 0) {
    return res.status(400).json({ error: 'Service administratif non identifié.' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom de la catégorie est obligatoire.' });
  }

  const trimmedName = name.trim();

  try {
    // 1. Scoped duplicate check for the same service
    const existing = await db.get(
      `SELECT id FROM archive_custom_categories 
       WHERE service_id = ? AND LOWER(TRIM(name)) = LOWER(?)`,
      [targetServiceId, trimmedName]
    );

    if (existing) {
      return res.status(400).json({
        error: 'Une catégorie portant ce nom existe déjà dans ce service.'
      });
    }

    const code = generateCategoryCode(trimmedName, targetServiceId);
    const assocJson = JSON.stringify(Array.isArray(associated_types) ? associated_types : []);
    const defJson = JSON.stringify(Array.isArray(is_default_for_types) ? is_default_for_types : []);

    const result = await db.run(
      `INSERT INTO archive_custom_categories 
       (service_id, code, name, description, icon, color, display_order, associated_types_json, is_default_for_types_json, is_default, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
      [
        targetServiceId,
        code,
        trimmedName,
        description ? description.trim() : null,
        icon || 'Folder',
        color || 'text-teal-700 bg-teal-50 border-teal-200',
        display_order ? parseInt(display_order, 10) : 50,
        assocJson,
        defJson,
        user.id
      ]
    );

    const categoryId = result.lastID;

    // Synchronize archive_category_document_types junction table
    if (Array.isArray(associated_types)) {
      for (const tCode of associated_types) {
        const isDef = Array.isArray(is_default_for_types) && is_default_for_types.includes(tCode) ? 1 : 0;
        await db.run(
          `INSERT OR REPLACE INTO archive_category_document_types (category_id, document_type_code, is_default, service_id)
           VALUES (?, ?, ?, ?)`,
          [categoryId, tCode, isDef, targetServiceId]
        );
      }
    }

    const createdCategory = await db.get('SELECT * FROM archive_custom_categories WHERE id = ?', [categoryId]);

    await logAuditAction(user.id, 'CREATE_ARCHIVE_CATEGORY', 'ARCHIVE_CATEGORY', categoryId, req, {
      name: trimmedName,
      code,
      service_id: targetServiceId,
      associated_types
    });

    res.status(201).json({
      success: true,
      message: `Catégorie [${trimmedName}] créée avec succès.`,
      category: {
        ...createdCategory,
        associated_types: Array.isArray(associated_types) ? associated_types : [],
        is_default_for_types: Array.isArray(is_default_for_types) ? is_default_for_types : []
      }
    });
  } catch (err) {
    console.error('Create archive category error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la catégorie d’archivage.' });
  }
});

// PUT /api/archive-categories/:id - Update Category (Rules 3, 4, 5, 7, 8, 10, 11, 15)
router.put('/:id', authenticateToken, async (req, res) => {
  const catId = req.params.id;
  const user = req.user;
  const isAdmin = user.role_code === 'ADMINISTRATEUR';
  const { 
    name, 
    description, 
    icon, 
    color, 
    display_order, 
    is_active,
    associated_types,
    is_default_for_types
  } = req.body;

  // Rule 7 & 11: Service users cannot modify existing categories; only admin can
  if (!isAdmin) {
    return res.status(403).json({
      error: 'Seul l\'administrateur système est autorisé à modifier ou personnaliser une catégorie existante.'
    });
  }

  try {
    const cat = await db.get('SELECT * FROM archive_custom_categories WHERE id = ?', [catId]);
    if (!cat) {
      return res.status(404).json({ error: 'Catégorie personnalisée introuvable.' });
    }

    const trimmedName = name ? name.trim() : cat.name;

    // Check duplicate name if name changed
    if (name && trimmedName.toLowerCase() !== cat.name.toLowerCase()) {
      const duplicate = await db.get(
        `SELECT id FROM archive_custom_categories 
         WHERE service_id = ? AND LOWER(TRIM(name)) = LOWER(?) AND id != ?`,
        [cat.service_id, trimmedName, catId]
      );
      if (duplicate) {
        return res.status(400).json({ error: 'Une autre catégorie portant ce nom existe déjà dans ce service.' });
      }
    }

    const assocJson = associated_types !== undefined 
      ? JSON.stringify(Array.isArray(associated_types) ? associated_types : []) 
      : cat.associated_types_json;
    const defJson = is_default_for_types !== undefined 
      ? JSON.stringify(Array.isArray(is_default_for_types) ? is_default_for_types : []) 
      : cat.is_default_for_types_json;

    await db.run(
      `UPDATE archive_custom_categories 
       SET name = ?, 
           description = ?, 
           icon = ?, 
           color = ?, 
           display_order = ?, 
           associated_types_json = ?,
           is_default_for_types_json = ?,
           is_active = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [
        trimmedName,
        description !== undefined ? (description ? description.trim() : null) : cat.description,
        icon || cat.icon,
        color || cat.color,
        display_order !== undefined ? parseInt(display_order, 10) : cat.display_order,
        assocJson,
        defJson,
        is_active !== undefined ? (is_active ? 1 : 0) : cat.is_active,
        catId
      ]
    );

    // Synchronize junction table
    if (associated_types !== undefined && Array.isArray(associated_types)) {
      await db.run('DELETE FROM archive_category_document_types WHERE category_id = ?', [catId]);
      for (const tCode of associated_types) {
        const isDef = Array.isArray(is_default_for_types) && is_default_for_types.includes(tCode) ? 1 : 0;
        await db.run(
          `INSERT OR REPLACE INTO archive_category_document_types (category_id, document_type_code, is_default, service_id)
           VALUES (?, ?, ?, ?)`,
          [catId, tCode, isDef, cat.service_id]
        );
      }
    }

    // Rule 4 & 11: When renamed, update document text labels if needed while preserving custom_category_id links
    if (name && trimmedName !== cat.name) {
      await db.run(
        `UPDATE documents 
         SET archive_category = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE custom_category_id = ?`,
        [trimmedName, catId]
      );
    }

    const updated = await db.get('SELECT * FROM archive_custom_categories WHERE id = ?', [catId]);

    let parsedAssoc = [];
    let parsedDef = [];
    try { parsedAssoc = JSON.parse(updated.associated_types_json || '[]'); } catch (e) {}
    try { parsedDef = JSON.parse(updated.is_default_for_types_json || '[]'); } catch (e) {}

    await logAuditAction(user.id, 'UPDATE_ARCHIVE_CATEGORY', 'ARCHIVE_CATEGORY', catId, req, {
      name: trimmedName,
      old_name: cat.name,
      service_id: cat.service_id,
      associated_types
    });

    res.json({
      success: true,
      message: `Catégorie [${trimmedName}] mise à jour avec succès par l'administrateur.`,
      category: {
        ...updated,
        associated_types: parsedAssoc,
        is_default_for_types: parsedDef
      }
    });
  } catch (err) {
    console.error('Update archive category error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la catégorie.' });
  }
});

// DELETE /api/archive-categories/:id - Delete Category (Rule 6, 7, 11: Reserved exclusively to ADMINISTRATOR)
router.delete('/:id', authenticateToken, async (req, res) => {
  const catId = req.params.id;
  const user = req.user;
  const isAdmin = user.role_code === 'ADMINISTRATEUR';

  // Rule 6, 7 & 11: Only admin can delete a category
  if (!isAdmin) {
    return res.status(403).json({
      error: 'Seul l\'administrateur système est autorisé à supprimer une catégorie d\'archivage.'
    });
  }

  try {
    const cat = await db.get('SELECT * FROM archive_custom_categories WHERE id = ?', [catId]);
    if (!cat) {
      return res.status(404).json({ error: 'Catégorie personnalisée introuvable.' });
    }

    // Safety check: Count documents attached to this category
    const docCount = await db.get(
      `SELECT COUNT(*) as c FROM documents 
       WHERE (custom_category_id = ? OR document_type = ? OR archive_category = ?) 
         AND (owner_service_id = ? OR originating_service_id = ? OR current_service_id = ?)`,
      [catId, cat.code, cat.name, cat.service_id, cat.service_id, cat.service_id]
    );

    const count = docCount ? docCount.c : 0;
    if (count > 0) {
      return res.status(400).json({
        error: `Cette catégorie contient encore ${count} document(s) archivé(s). Veuillez d'abord déplacer ces documents vers une autre catégorie ou vers « Non classés ».`,
        document_count: count
      });
    }

    await db.run('DELETE FROM archive_custom_categories WHERE id = ?', [catId]);

    await logAuditAction(user.id, 'DELETE_ARCHIVE_CATEGORY', 'ARCHIVE_CATEGORY', catId, req, {
      name: cat.name,
      code: cat.code,
      service_id: cat.service_id
    });

    res.json({
      success: true,
      message: `Catégorie [${cat.name}] supprimée avec succès par l'administrateur.`
    });
  } catch (err) {
    console.error('Delete archive category error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la catégorie.' });
  }
});

// POST /api/archive-categories/:id/move-documents - Move documents before deletion (Rule 6)
router.post('/:id/move-documents', authenticateToken, async (req, res) => {
  const sourceCatId = req.params.id;
  const { target_category_code, target_category_id } = req.body;
  const user = req.user;
  const isAdmin = user.role_code === 'ADMINISTRATEUR';

  if (!isAdmin) {
    return res.status(403).json({ error: 'Seul l\'administrateur système est autorisé à réassigner des documents de catégorie.' });
  }

  try {
    const sourceCat = await db.get('SELECT * FROM archive_custom_categories WHERE id = ?', [sourceCatId]);
    if (!sourceCat) return res.status(404).json({ error: 'Catégorie source introuvable.' });

    let finalTargetType = target_category_code || 'NON_CLASSE';
    let finalCustomCatId = target_category_id || null;
    let finalTargetName = 'Non classés';

    if (finalCustomCatId) {
      const targetCat = await db.get('SELECT * FROM archive_custom_categories WHERE id = ?', [finalCustomCatId]);
      if (targetCat) {
        finalTargetType = targetCat.code;
        finalTargetName = targetCat.name;
      }
    } else if (target_category_code && target_category_code !== 'NON_CLASSE') {
      const targetByCode = await db.get('SELECT * FROM archive_custom_categories WHERE service_id = ? AND code = ?', [sourceCat.service_id, target_category_code]);
      if (targetByCode) {
        finalCustomCatId = targetByCode.id;
        finalTargetName = targetByCode.name;
        finalTargetType = targetByCode.code;
      }
    }

    const result = await db.run(
      `UPDATE documents 
       SET custom_category_id = ?, 
           document_type = CASE WHEN ? = 'NON_CLASSE' THEN document_type ELSE ? END, 
           archive_category = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE (custom_category_id = ? OR document_type = ? OR archive_category = ?) 
         AND (owner_service_id = ? OR originating_service_id = ? OR current_service_id = ?)`,
      [
        finalCustomCatId,
        finalTargetType,
        finalTargetType,
        finalTargetName,
        sourceCatId,
        sourceCat.code,
        sourceCat.name,
        sourceCat.service_id,
        sourceCat.service_id,
        sourceCat.service_id
      ]
    );

    await logAuditAction(user.id, 'MOVE_CATEGORY_DOCUMENTS', 'ARCHIVE_CATEGORY', sourceCatId, req, {
      moved_count: result.changes,
      target_type: finalTargetType,
      target_category_id: finalCustomCatId
    });

    res.json({
      success: true,
      message: `${result.changes} document(s) déplacé(s) avec succès vers [${finalTargetName}].`,
      moved_count: result.changes
    });
  } catch (err) {
    console.error('Move documents error:', err);
    res.status(500).json({ error: 'Erreur lors du déplacement des documents.' });
  }
});

module.exports = router;
