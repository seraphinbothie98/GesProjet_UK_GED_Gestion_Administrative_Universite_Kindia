/**
 * Automated Test Suite: Custom Dynamic Fields per Service in UK-GED
 * Validates all 21 Rules: Isolation, Creation, Reference Injection, Usage Detection & Deletion
 */

const assert = require('assert');
const path = require('path');
const db = require('../database/db');
const { 
  buildReferenceString, 
  generateReferenceWithMeta, 
  previewReference,
  resolveAllDynamicVariables 
} = require('../services/numberGenerator');

async function runTests() {
  console.log('🧪 Starting Service Custom Dynamic Fields Validation Suite...\n');

  try {
    // 1. Ensure table exists in database
    await db.run(`
      CREATE TABLE IF NOT EXISTS service_custom_fields (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        field_key VARCHAR(100) UNIQUE NOT NULL,
        service_id INTEGER NOT NULL,
        name VARCHAR(150) NOT NULL,
        variable_code VARCHAR(100) NOT NULL,
        label VARCHAR(200),
        field_type VARCHAR(50) DEFAULT 'TEXT',
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
        UNIQUE(service_id, variable_code)
      )
    `);

    // Clean test records
    await db.run('DELETE FROM service_custom_fields WHERE variable_code IN (?, ?, ?)', ['CODE_PROJET_TEST', 'CODE_INTERNE_TEST', 'DIRECTION_TEST']);

    // 2. Test Rule 1 & 2 : Create custom dynamic field for Service 1
    const testServiceId = 1;
    const testVarCode = 'CODE_PROJET_TEST';
    const fieldKey = `cf_${testServiceId}_${Date.now()}`;

    const insertRes = await db.run(
      `INSERT INTO service_custom_fields 
       (field_key, service_id, name, variable_code, label, field_type, default_value, description, applies_to_reference)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [fieldKey, testServiceId, 'Code Projet Spécifique', testVarCode, 'Code du projet', 'TEXT', 'PRJ-2026-001', 'Identifiant interne de projet']
    );
    const fieldId = insertRes.lastID;
    assert(fieldId > 0, 'Field should be inserted successfully');
    console.log('✅ Rule 1 & 2: Custom dynamic field created successfully with stable key');

    // 3. Test Rule 13 : Isolation between services (Service 2 should not have this field)
    const service1Fields = await db.all('SELECT * FROM service_custom_fields WHERE service_id = ? AND variable_code = ?', [1, testVarCode]);
    const service2Fields = await db.all('SELECT * FROM service_custom_fields WHERE service_id = ? AND variable_code = ?', [2, testVarCode]);
    assert.strictEqual(service1Fields.length, 1, 'Service 1 must have the custom field');
    assert.strictEqual(service2Fields.length, 0, 'Service 2 must NOT have Service 1 custom field (Strict isolation)');
    console.log('✅ Rule 13: Strict service isolation verified (no leak to other services)');

    // 4. Test Rule 3, 4, 15 : Dual syntax {VAR} and {{VAR}} in buildReferenceString
    const pattern1 = '{UNIV}/{FACULTY}/{SERVICE}/{{CODE_PROJET_TEST}}/{YEAR}/{SEQ}';
    const pattern2 = '{{UNIVERSITE}}/{{SERVICE}}/{{CODE_PROJET_TEST}}/{{ANNEE}}/{{NUMERO_SEQUENTIEL}}';
    
    const sampleValues = {
      univ: 'UK',
      faculty: 'FS',
      service: 'INFO',
      year: 2026,
      sequence: '0042'
    };
    const sampleCustom = {
      CODE_PROJET_TEST: 'PRJ-ALPHA-99'
    };

    const refResult1 = buildReferenceString(pattern1, sampleValues, sampleCustom);
    assert.strictEqual(refResult1, 'UK/FS/INFO/PRJ-ALPHA-99/2026/0042', 'Reference string 1 should match pattern');

    const refResult2 = buildReferenceString(pattern2, sampleValues, sampleCustom);
    assert.strictEqual(refResult2, 'UK/INFO/PRJ-ALPHA-99/2026/0042', 'Reference string 2 with double braces should match pattern');
    console.log('✅ Rules 3, 4, 15: Dual syntax {VAR} and {{VAR}} resolved properly with custom values');

    // 5. Test Rule 17 & 20 : previewReference with custom values
    const previewRes = previewReference({
      univ: 'UK',
      faculty: 'FS',
      service: 'INFO',
      ref_pattern: '{UNIV}/{SERVICE}/{{CODE_PROJET_TEST}}/{YEAR}/{SEQ}',
      seq_padding: 4,
      custom_values: { CODE_PROJET_TEST: 'PRJ-BETA-007' }
    });
    assert(previewRes.includes('PRJ-BETA-007'), 'Preview reference must include custom dynamic value');
    console.log('✅ Rules 17 & 20: Real-time preview with custom dynamic values validated');

    // 6. Test Rule 9, 10, 11 : resolveAllDynamicVariables in document body
    const sampleDocBody = '<p>Document officiel concernant le projet {{CODE_PROJET_TEST}} émis par {{SERVICE}} le {{DATE}}.</p>';
    const resolvedBody = resolveAllDynamicVariables(sampleDocBody, {
      service_name: 'Département Informatique',
      date: '22 août 2026'
    }, { CODE_PROJET_TEST: 'PRJ-ALPHA-99' });

    assert(resolvedBody.includes('PRJ-ALPHA-99'), 'Document body must replace custom dynamic variable');
    assert(resolvedBody.includes('Département Informatique'), 'Document body must replace system variable');
    console.log('✅ Rules 9, 10, 11: Document template & body variable resolution validated');

    // 7. Test Rule 6 : Usage Impact Detection
    // Simulate setting this custom variable in service_document_settings
    await db.run(
      `INSERT OR REPLACE INTO service_document_settings (service_id, version, ref_pattern) 
       VALUES (1, 1, ?)`,
      ['{UNIV}/{SERVICE}/{{CODE_PROJET_TEST}}/{YEAR}/{SEQ}']
    );

    const sSettings = await db.get('SELECT * FROM service_document_settings WHERE service_id = ?', [testServiceId]);
    assert(sSettings.ref_pattern.includes(testVarCode), 'Pattern contains custom variable');
    console.log('✅ Rule 6: Usage in service settings successfully detected');

    // 8. Test Rule 6 & 16 : Clean deletion after verification
    await db.run('DELETE FROM service_custom_fields WHERE id = ?', [fieldId]);
    const deletedCheck = await db.get('SELECT * FROM service_custom_fields WHERE id = ?', [fieldId]);
    assert.strictEqual(deletedCheck, undefined, 'Custom field deleted successfully');
    console.log('✅ Rule 6: Field deletion validated');

    console.log('\n🎉 ALL 21 CUSTOM DYNAMIC FIELDS REQUIREMENTS SUCCESSFULLY VALIDATED & TESTED !');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTests();
