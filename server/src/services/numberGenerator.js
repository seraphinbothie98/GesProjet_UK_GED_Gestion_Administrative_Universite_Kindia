const db = require('../database/db');

/**
 * Dynamic Administrative Reference Generator for UK-GED
 * 
 * Supports:
 * - Institutional configuration
 * - Per-Service customized document reference patterns
 * - Hierarchical tokens ({UNIV}, {FACULTY}, {DEPT}, {SERVICE}, {TYPE}, {YEAR}, {MONTH}, {SEQ}, {PREFIX}, {SUFFIX})
 * - Zero-collision atomic sequence allocation under concurrent requests (Mutex)
 * - Annual reset vs Continuous sequence configuration per service
 */

// In-memory mutex to guarantee zero-collision sequence allocation across concurrent requests
const sequenceLocks = new Map();

function withSequenceLock(lockKey, task) {
  const currentLock = sequenceLocks.get(lockKey) || Promise.resolve();
  const nextLock = currentLock.then(async () => {
    return await task();
  });
  // Keep queue clean on errors
  sequenceLocks.set(lockKey, nextLock.catch(() => {}));
  return nextLock;
}

/**
 * Resolve hierarchical structure codes for a given service
 */
async function getServiceHierarchy(serviceId) {
  if (!serviceId) return null;
  try {
    const s = await db.get('SELECT * FROM services WHERE id = ?', [serviceId]);
    if (!s) return null;

    let parent = null;
    let grandParent = null;
    if (s.parent_id) {
      parent = await db.get('SELECT * FROM services WHERE id = ?', [s.parent_id]);
      if (parent && parent.parent_id) {
        grandParent = await db.get('SELECT * FROM services WHERE id = ?', [parent.parent_id]);
      }
    }

    let facultyCode = '';
    let deptCode = '';

    if (s.structure_type === 'FACULTE') {
      facultyCode = s.acronym || s.code || '';
    } else if (s.structure_type === 'DEPARTEMENT') {
      deptCode = s.acronym || s.code || '';
      if (parent && parent.structure_type === 'FACULTE') {
        facultyCode = parent.acronym || parent.code || '';
      }
    } else {
      if (parent && parent.structure_type === 'FACULTE') {
        facultyCode = parent.acronym || parent.code || '';
      } else if (grandParent && grandParent.structure_type === 'FACULTE') {
        facultyCode = grandParent.acronym || grandParent.code || '';
      }
      if (parent && parent.structure_type === 'DEPARTEMENT') {
        deptCode = parent.acronym || parent.code || '';
      }
    }

    return {
      service: s,
      parent,
      grandParent,
      univCode: 'UK',
      facultyCode: facultyCode.replace('FS_', '').replace('FSEG_', ''),
      deptCode: deptCode.replace('FS_', '').replace('FSEG_', ''),
      serviceCode: (s.acronym || s.code || '').replace('FS_', '').replace('FSEG_', ''),
      referenceCode: s.reference_code || s.code || ''
    };
  } catch (err) {
    console.error('Error resolving service hierarchy:', err);
    return null;
  }
}

/**
 * Fetch document settings for a specific service or default
 */
async function getServiceDocumentSettings(serviceId) {
  try {
    if (serviceId) {
      const sSettings = await db.get('SELECT * FROM service_document_settings WHERE service_id = ?', [serviceId]);
      if (sSettings) {
        let typeCodes = {};
        try {
          typeCodes = sSettings.type_codes_json ? JSON.parse(sSettings.type_codes_json) : {};
        } catch (e) {
          typeCodes = {};
        }
        return {
          ...sSettings,
          type_codes: typeCodes
        };
      }
    }
  } catch (err) {
    console.error('Error fetching service document settings:', err);
  }
  return null;
}

async function getReferenceSettings() {
  try {
    const inst = await db.get('SELECT * FROM institution_settings WHERE id = 1');
    if (!inst) {
      return {
        ministry_code: 'MESRS',
        institution_code: 'UK',
        structure_name: 'Rectorat',
        structure_code: 'RECT',
        authority_name: 'Secrétaire Général',
        authority_code: 'SG',
        reference_pattern: '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
        sequence_padding: 4,
        reference_type_patterns: null
      };
    }
    return {
      ministry_code: inst.ministry_code || 'MESRS',
      institution_code: inst.institution_code || 'UK',
      structure_name: inst.structure_name || 'Rectorat',
      structure_code: inst.structure_code || 'RECT',
      authority_name: inst.authority_name || 'Secrétaire Général',
      authority_code: inst.authority_code || 'SG',
      reference_pattern: inst.reference_pattern || '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
      sequence_padding: parseInt(inst.sequence_padding) || 4,
      reference_type_patterns: inst.reference_type_patterns ? (typeof inst.reference_type_patterns === 'string' ? JSON.parse(inst.reference_type_patterns) : inst.reference_type_patterns) : null
    };
  } catch (err) {
    console.error('Error fetching reference settings:', err);
    return {
      ministry_code: 'MESRS',
      institution_code: 'UK',
      structure_name: 'Rectorat',
      structure_code: 'RECT',
      authority_name: 'Secrétaire Général',
      authority_code: 'SG',
      reference_pattern: '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
      sequence_padding: 4,
      reference_type_patterns: null
    };
  }
}

/**
 * Format a reference pattern with actual values and custom fields
 * Supports both {TOKEN} and {{TOKEN}} syntax (case-insensitive)
 */
function buildReferenceString(pattern, values = {}, customFields = {}) {
  let ref = pattern || '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}';

  // Helper replacing both {TOKEN} and {{TOKEN}}
  const replaceToken = (str, token, val) => {
    if (!token) return str;
    const cleanToken = token.replace(/[{}]/g, '').trim();
    const regex1 = new RegExp(`\\{\\{${cleanToken}\\}\\}`, 'gi');
    const regex2 = new RegExp(`\\{${cleanToken}\\}`, 'gi');
    const replacement = val !== undefined && val !== null ? String(val) : '';
    return str.replace(regex1, replacement).replace(regex2, replacement);
  };

  // 1. Standard System tokens
  ref = replaceToken(ref, 'UNIV', values.univ || values.institution_code || 'UK');
  ref = replaceToken(ref, 'UNIVERSITE', values.univ || values.institution_code || 'UK');
  ref = replaceToken(ref, 'INSTITUTION_CODE', values.institution_code || 'UK');
  
  ref = replaceToken(ref, 'FACULTY', values.faculty || '');
  ref = replaceToken(ref, 'FACULTE', values.faculty || '');
  
  ref = replaceToken(ref, 'DEPT', values.dept || '');
  ref = replaceToken(ref, 'DEPARTEMENT', values.dept || '');
  
  ref = replaceToken(ref, 'SERVICE', values.service || values.service_code || '');
  ref = replaceToken(ref, 'SERVICE_CODE', values.service_code || '');
  ref = replaceToken(ref, 'SERVICE_REF', values.service_ref || values.service_code || '');
  ref = replaceToken(ref, 'STRUCTURE_CODE', values.structure_code || 'RECT');
  ref = replaceToken(ref, 'AUTHORITY_CODE', values.authority_code || 'SG');
  ref = replaceToken(ref, 'MINISTRY_CODE', values.ministry_code || 'MESRS');

  ref = replaceToken(ref, 'TYPE', values.type || values.type_code || '');
  ref = replaceToken(ref, 'TYPE_CODE', values.type_code || '');

  ref = replaceToken(ref, 'YEAR', values.year || new Date().getFullYear());
  ref = replaceToken(ref, 'ANNEE', values.year || new Date().getFullYear());
  
  ref = replaceToken(ref, 'MONTH', values.month || String(new Date().getMonth() + 1).padStart(2, '0'));
  ref = replaceToken(ref, 'MOIS', values.month || String(new Date().getMonth() + 1).padStart(2, '0'));
  
  ref = replaceToken(ref, 'SEQ', values.sequence);
  ref = replaceToken(ref, 'SEQUENCE', values.sequence);
  ref = replaceToken(ref, 'NUMERO_SEQUENTIEL', values.sequence);
  
  ref = replaceToken(ref, 'PREFIX', values.prefix || '');
  ref = replaceToken(ref, 'SUFFIX', values.suffix || '');

  // 2. Custom service dynamic tokens (Rule 3, 10, 13)
  const allCustom = { ...(customFields || {}), ...(values.custom_values || {}), ...(values.customValues || {}) };
  for (const [key, val] of Object.entries(allCustom)) {
    ref = replaceToken(ref, key, val);
  }

  // Clean up multiple slashes, dashes, or trailing separators caused by empty tokens
  ref = ref.replace(/\/+/g, '/').replace(/-+/g, '-').replace(/^\/|\/$/g, '').replace(/^-|-$/g, '');

  return ref;
}

/**
 * Universal dynamic variables resolver for documents, headers, footers, and templates
 */
function resolveAllDynamicVariables(templateText, context = {}, customFields = {}) {
  if (!templateText) return '';
  const now = new Date();
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const formattedDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  const standardValues = {
    'REFERENCE': context.reference || context.preview_reference || '[RÉFÉRENCE OFFICIELLE]',
    'DATE': context.date || formattedDate,
    'ANNEE': context.year || String(now.getFullYear()),
    'MOIS': context.month || String(now.getMonth() + 1).padStart(2, '0'),
    'UNIVERSITE': context.univ || context.institution_name || 'UNIVERSITÉ DE KINDIA',
    'UNIV': context.univ || 'UK',
    'FACULTE': context.faculty_name || context.faculty || '',
    'FACULTY': context.faculty || '',
    'DEPARTEMENT': context.department_name || context.dept || '',
    'DEPT': context.dept || '',
    'SERVICE': context.service_name || context.service || '',
    'DESTINATAIRE': context.recipient_name || context.target_recipient_name || '',
    'OBJET': context.object || context.title || context.object_title || '',
    'RESPONSABLE': context.head_name || '',
    'FONCTION_RESPONSABLE': context.head_title || '',
    'NUMERO_SEQUENTIEL': context.sequence || '001',
    'SEQ': context.sequence || '001'
  };

  let result = templateText;

  // Replace standard tokens
  for (const [key, val] of Object.entries(standardValues)) {
    const regex1 = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    const regex2 = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(regex1, val || '').replace(regex2, val || '');
  }

  // Replace custom dynamic fields
  const allCustom = { ...(customFields || {}), ...(context.custom_values || {}), ...(context.customValues || {}) };
  for (const [key, val] of Object.entries(allCustom)) {
    const cleanKey = key.replace(/[{}]/g, '').trim();
    const regex1 = new RegExp(`\\{\\{${cleanKey}\\}\\}`, 'gi');
    const regex2 = new RegExp(`\\{${cleanKey}\\}`, 'gi');
    result = result.replace(regex1, val !== undefined && val !== null ? String(val) : '')
                   .replace(regex2, val !== undefined && val !== null ? String(val) : '');
  }

  return result;
}

/**
 * Generates an administrative reference string
 */
async function generateReference(type = 'DOC_ADMIN', options = {}) {
  const result = await generateReferenceWithMeta(type, options);
  return result.reference;
}

/**
 * Generates a service-specific administrative reference
 */
async function generateServiceReference(serviceId, docType = 'DOC') {
  return await generateReferenceWithMeta(docType, { serviceId });
}

/**
 * Generates reference and returns both the string and the metadata snapshot
 */
async function generateReferenceWithMeta(type = 'DOC_ADMIN', options = {}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const serviceId = options.serviceId || null;

  const instSettings = await getReferenceSettings();
  const serviceSettings = await getServiceDocumentSettings(serviceId);
  const hierarchy = await getServiceHierarchy(serviceId);

  // Determine Type Code
  let typeCode = type;
  const defaultTypeCodes = {
    LETTRE: 'LET',
    DEMANDE: 'DEM',
    SOIT_TRANSMIS: 'ST',
    NOTE_SERVICE: 'NS',
    RAPPORT: 'RAP',
    PROCES_VERBAL: 'PV',
    DECISION: 'DEC',
    ARRETE: 'ARR',
    DECRET: 'DEC',
    CIRCULAIRE: 'CIR',
    MISSION_ORDER: 'OM',
    CONVOCATION: 'CONV',
    INVITATION: 'INV',
    ATTESTATION: 'ATT',
    AUTRE: 'DOC'
  };

  const configuredTypeCodes = serviceSettings?.type_codes || defaultTypeCodes;
  const upperType = (type || '').toUpperCase().trim();
  typeCode = configuredTypeCodes[upperType] || defaultTypeCodes[upperType] || upperType || 'DOC';

  // Determine Pattern and Sequence rules
  let pattern = '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}';
  let padding = 4;
  let resetAnnually = 1;
  let prefix = '';
  let suffix = '';

  if (serviceSettings) {
    pattern = serviceSettings.ref_pattern || pattern;
    padding = parseInt(serviceSettings.seq_padding) || 4;
    resetAnnually = serviceSettings.reset_annually !== 0 ? 1 : 0;
    prefix = serviceSettings.prefix || '';
    suffix = serviceSettings.suffix || '';
  } else if (hierarchy?.referenceCode) {
    pattern = `${hierarchy.referenceCode}/{YEAR}/{SEQ}`;
  } else if (instSettings?.reference_pattern) {
    pattern = instSettings.reference_pattern;
    padding = instSettings.sequence_padding || 4;
  }

  // Determine Mutex and Sequence Storage Keys
  const seqKey = serviceId 
    ? (resetAnnually ? `SERVICE_${serviceId}` : `SERVICE_${serviceId}_CONT`)
    : 'DOC_ADMIN';
  const seqYear = resetAnnually ? currentYear : 0;
  const lockKey = `${seqKey}_${seqYear}`;

  return await withSequenceLock(lockKey, async () => {
    await db.run(
      'INSERT OR IGNORE INTO number_sequences (seq_key, year, current_val) VALUES (?, ?, 0)',
      [seqKey, seqYear]
    );
    await db.run(
      'UPDATE number_sequences SET current_val = current_val + 1 WHERE seq_key = ? AND year = ?',
      [seqKey, seqYear]
    );

    const row = await db.get(
      'SELECT current_val FROM number_sequences WHERE seq_key = ? AND year = ?',
      [seqKey, seqYear]
    );
    const counter = row ? row.current_val : 1;
    const formattedCounter = String(counter).padStart(padding, '0');

    // Fetch active custom fields for service if available
    let serviceCustomFieldsMap = {};
    if (serviceId) {
      try {
        const customFieldRows = await db.all(
          'SELECT variable_code, default_value FROM service_custom_fields WHERE service_id = ? AND is_active = 1',
          [serviceId]
        );
        for (const cf of customFieldRows || []) {
          if (cf.variable_code) {
            serviceCustomFieldsMap[cf.variable_code] = cf.default_value || '';
          }
        }
      } catch (e) {
        // table might not exist in old runs
      }
    }

    const providedCustom = options.custom_values || options.customValues || {};
    const finalCustomValues = { ...serviceCustomFieldsMap, ...providedCustom };

    const values = {
      univ: hierarchy?.univCode || instSettings.institution_code || 'UK',
      faculty: hierarchy?.facultyCode || '',
      dept: hierarchy?.deptCode || '',
      service: hierarchy?.serviceCode || hierarchy?.referenceCode || '',
      service_ref: hierarchy?.referenceCode || hierarchy?.serviceCode || '',
      type: typeCode,
      type_code: typeCode,
      year: currentYear,
      month: currentMonth,
      sequence: formattedCounter,
      prefix,
      suffix,
      ministry_code: instSettings.ministry_code,
      institution_code: instSettings.institution_code,
      structure_code: hierarchy?.serviceCode || instSettings.structure_code,
      authority_code: instSettings.authority_code,
      custom_values: finalCustomValues
    };

    const reference = buildReferenceString(pattern, values, finalCustomValues);

    const metaSnapshot = {
      year: currentYear,
      month: currentMonth,
      sequence_number: counter,
      formatted_sequence: formattedCounter,
      service_id: serviceId,
      service_code: hierarchy?.serviceCode || null,
      service_ref: hierarchy?.referenceCode || null,
      pattern,
      settings_version: serviceSettings?.version || 1,
      custom_values: finalCustomValues,
      generated_at: new Date().toISOString()
    };

    return {
      reference,
      sequence_number: counter,
      reference_meta: JSON.stringify(metaSnapshot)
    };
  });
}

/**
 * Preview reference in real-time during service configuration
 */
function previewReference(customSettings = {}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const padding = parseInt(customSettings.seq_padding || customSettings.sequence_padding) || 4;
  const sampleSequence = String(1).padStart(padding, '0');

  const customValues = customSettings.custom_values || customSettings.customValues || {};

  const values = {
    univ: (customSettings.univ || 'UK').trim(),
    faculty: (customSettings.faculty || 'FS').trim(),
    dept: (customSettings.dept || 'INFO').trim(),
    service: (customSettings.service || 'INFO').trim(),
    service_ref: (customSettings.service_ref || 'FS/INFO').trim(),
    type: (customSettings.type || 'LET').trim(),
    type_code: (customSettings.type_code || 'LET').trim(),
    year: currentYear,
    month: currentMonth,
    sequence: sampleSequence,
    prefix: (customSettings.prefix || '').trim(),
    suffix: (customSettings.suffix || '').trim(),
    ministry_code: (customSettings.ministry_code || 'MESRS').trim(),
    institution_code: (customSettings.institution_code || 'UK').trim(),
    structure_code: (customSettings.structure_code || 'INFO').trim(),
    authority_code: (customSettings.authority_code || 'CHEF').trim(),
    custom_values: customValues
  };

  const pattern = customSettings.ref_pattern || customSettings.reference_pattern || '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}';
  return buildReferenceString(pattern, values, customValues);
}

module.exports = {
  generateReference,
  generateServiceReference,
  generateReferenceWithMeta,
  getReferenceSettings,
  getServiceHierarchy,
  getServiceDocumentSettings,
  previewReference,
  buildReferenceString,
  resolveAllDynamicVariables
};
