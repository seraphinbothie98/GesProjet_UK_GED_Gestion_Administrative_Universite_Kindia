const db = require('../database/db');

/**
 * Dynamic Administrative Reference Generator for UK-GED
 * 
 * Supports configurable institutional parameters:
 * - Year: {YEAR} (e.g., 2026)
 * - Sequence: {SEQUENCE} (e.g., 0001)
 * - Ministry code: {MINISTRY_CODE} (e.g., MESRS)
 * - Institution code: {INSTITUTION_CODE} (e.g., UK)
 * - Structure code: {STRUCTURE_CODE} (e.g., RECT)
 * - Authority code: {AUTHORITY_CODE} (e.g., SG)
 * - Type code: {TYPE_CODE} (e.g., CE, CS, OM, MEX)
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
 * Format a reference pattern with actual values
 */
function buildReferenceString(pattern, values) {
  let ref = pattern || '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}';
  ref = ref.replace(/{YEAR}/g, values.year);
  ref = ref.replace(/{SEQUENCE}/g, values.sequence);
  ref = ref.replace(/{MINISTRY_CODE}/g, values.ministry_code);
  ref = ref.replace(/{INSTITUTION_CODE}/g, values.institution_code);
  ref = ref.replace(/{STRUCTURE_CODE}/g, values.structure_code);
  ref = ref.replace(/{AUTHORITY_CODE}/g, values.authority_code);
  ref = ref.replace(/{TYPE_CODE}/g, values.type_code || '');
  return ref;
}

/**
 * Generates an administrative reference string
 * Atomically increments sequence per year and sequence key.
 */
async function generateReference(type = 'DOC_ADMIN') {
  const result = await generateReferenceWithMeta(type);
  return result.reference;
}

/**
 * Generates reference and returns both the string and the metadata snapshot
 */
async function generateReferenceWithMeta(type = 'DOC_ADMIN') {
  const currentYear = new Date().getFullYear();
  const settings = await getReferenceSettings();

  // Determine sequence key and pattern for this type
  let seqKey = 'DOC_ADMIN';
  let pattern = settings.reference_pattern;
  let typeCode = type;

  if (type === 'INCOMING_MAIL' || type === 'CE') {
    seqKey = 'DOC_ADMIN';
    typeCode = 'CE';
  } else if (type === 'OUTGOING_MAIL' || type === 'CS') {
    seqKey = 'DOC_ADMIN';
    typeCode = 'CS';
  } else if (type === 'SOIT_TRANSMIS' || type === 'ST') {
    seqKey = 'DOC_ADMIN';
    typeCode = 'ST';
  } else if (type === 'MISSION_ORDER' || type === 'OM') {
    seqKey = 'DOC_ADMIN';
    typeCode = 'OM';
  } else if (type === 'EXTERNAL_MISSION_ORDER' || type === 'MEX') {
    seqKey = 'MEX';
    typeCode = 'MEX';
    if (settings.reference_type_patterns && settings.reference_type_patterns.EXTERNAL_MISSION_ORDER) {
      pattern = settings.reference_type_patterns.EXTERNAL_MISSION_ORDER;
    } else {
      pattern = `${settings.reference_pattern}/MEX`;
    }
  } else if (type === 'APPOINTMENT' || type === 'RDV') {
    seqKey = 'RDV';
    typeCode = 'RDV';
    pattern = `RDV/{YEAR}/{SEQUENCE}/{INSTITUTION_CODE}`;
  } else if (type === 'MISSION_REQUEST' || type === 'DMO') {
    seqKey = 'DMO';
    typeCode = 'DMO';
    pattern = `DM-OM-{YEAR}-{SEQUENCE}`;
  }

  // Override pattern if specific type pattern exists in settings
  if (settings.reference_type_patterns && settings.reference_type_patterns[type]) {
    pattern = settings.reference_type_patterns[type];
  }

  // Lock sequence generation per (seqKey, currentYear) to prevent race condition under concurrent requests
  const lockKey = `${seqKey}_${currentYear}`;

  return await withSequenceLock(lockKey, async () => {
    await db.run('INSERT OR IGNORE INTO number_sequences (seq_key, year, current_val) VALUES (?, ?, 0)', [seqKey, currentYear]);
    await db.run('UPDATE number_sequences SET current_val = current_val + 1 WHERE seq_key = ? AND year = ?', [seqKey, currentYear]);

    const row = await db.get('SELECT current_val FROM number_sequences WHERE seq_key = ? AND year = ?', [seqKey, currentYear]);
    const counter = row ? row.current_val : 1;
    const padding = settings.sequence_padding || 4;
    const formattedCounter = String(counter).padStart(padding, '0');

    const values = {
      year: currentYear,
      sequence: formattedCounter,
      ministry_code: settings.ministry_code,
      institution_code: settings.institution_code,
      structure_code: settings.structure_code,
      authority_code: settings.authority_code,
      type_code: typeCode
    };

    const reference = buildReferenceString(pattern, values);

    const metaSnapshot = {
      year: currentYear,
      sequence_number: counter,
      formatted_sequence: formattedCounter,
      ministry: settings.ministry_code,
      institution: settings.institution_code,
      structure: settings.structure_code,
      authority: settings.authority_code,
      pattern: pattern,
      generated_at: new Date().toISOString()
    };

    return {
      reference,
      reference_meta: JSON.stringify(metaSnapshot)
    };
  });
}

/**
 * Preview reference for admin settings interface without incrementing database sequence
 */
function previewReference(customSettings = {}) {
  const currentYear = new Date().getFullYear();
  const padding = parseInt(customSettings.sequence_padding) || 4;
  const sampleSequence = String(1).padStart(padding, '0');

  const values = {
    year: currentYear,
    sequence: sampleSequence,
    ministry_code: (customSettings.ministry_code || 'MESRS').trim().toUpperCase(),
    institution_code: (customSettings.institution_code || 'UK').trim().toUpperCase(),
    structure_code: (customSettings.structure_code || 'RECT').trim().toUpperCase(),
    authority_code: (customSettings.authority_code || 'SG').trim().toUpperCase(),
    type_code: (customSettings.type_code || 'DOC').trim().toUpperCase()
  };

  const pattern = customSettings.reference_pattern || '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}';
  return buildReferenceString(pattern, values);
}

module.exports = {
  generateReference,
  generateReferenceWithMeta,
  getReferenceSettings,
  previewReference,
  buildReferenceString
};
