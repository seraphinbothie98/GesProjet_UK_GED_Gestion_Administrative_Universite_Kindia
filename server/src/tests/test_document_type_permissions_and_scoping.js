/**
 * Automated Test Suite: Document Type Strict Permissions & Scoping for UK-GED
 * Tests ordinary service restrictions, Secrétariat Central extended access,
 * Administrator universal access, dynamic override grants/revocations, and creatable catalogue scoping.
 */

const assert = require('assert');
const db = require('../database/db');
const documentTypeService = require('../services/documentTypeService');

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 TEST SUITE: DOCUMENT TYPE PERMISSIONS & SCOPING UK-GED');
  console.log('🧪 ========================================================\n');

  try {
    // 1. Setup mock users
    const adminUser = {
      id: 1,
      role_code: 'ADMINISTRATEUR',
      service_code: 'RECTORAT',
      service_id: 1
    };

    const scUser = {
      id: 2,
      role_code: 'AGENT_ARCHIVISTE',
      service_code: 'SC',
      service_id: 2
    };

    const ordinaryService = await db.get("SELECT id, code FROM services WHERE code != 'SC' LIMIT 1") || { id: 3, code: 'INFO' };
    const ordinaryUser = {
      id: 3,
      role_code: 'CHEF_SERVICE',
      service_code: ordinaryService.code,
      service_id: ordinaryService.id,
      role_id: 3
    };

    // ---------------------------------------------------------
    // TEST 1: Ordinary Services Allowed Types (Niveau 1)
    // ---------------------------------------------------------
    console.log('▶ Test 1: Ordinary Service allowed standard types...');
    const allowedStandardTypes = ['RAPPORT', 'PROCES_VERBAL', 'ATTESTATION', 'SOIT_TRANSMIS', 'NOTE_SERVICE', 'LETTRE', 'DEMANDE'];
    for (const t of allowedStandardTypes) {
      const canCreate = await documentTypeService.canUserCreateDocumentType(ordinaryUser, t);
      assert.strictEqual(canCreate, true, `Ordinary service MUST be allowed to create [${t}] by default`);
    }
    console.log('  ✅ Standard ordinary types (RAPPORT, PV, ATTESTATION, SOIT_TRANSMIS, NOTE_SERVICE, LETTRE, DEMANDE) are ALLOWED.\n');

    // ---------------------------------------------------------
    // TEST 2: Ordinary Services Denied Restricted Types (Niveau 1)
    // ---------------------------------------------------------
    console.log('▶ Test 2: Ordinary Service restricted sovereign types (Default Deny)...');
    const restrictedTypes = ['ARRETE', 'DECISION', 'DECRET', 'LOI', 'CIRCULAIRE', 'INSTRUCTION'];
    for (const t of restrictedTypes) {
      const canCreate = await documentTypeService.canUserCreateDocumentType(ordinaryUser, t);
      assert.strictEqual(canCreate, false, `Ordinary service MUST be FORBIDDEN to create restricted type [${t}] by default`);
    }
    console.log('  ✅ Restricted sovereign types (ARRETE, DECISION, DECRET, LOI, CIRCULAIRE, INSTRUCTION) are BLOCKED by default.\n');

    // ---------------------------------------------------------
    // TEST 3: Secrétariat Central (SC) Extended Rights (Niveau 2)
    // ---------------------------------------------------------
    console.log('▶ Test 3: Secrétariat Central (SC) extended access across all types...');
    const allTypesToTest = ['RAPPORT', 'SOIT_TRANSMIS', 'ARRETE', 'DECISION', 'DECRET', 'LOI'];
    for (const t of allTypesToTest) {
      const canCreate = await documentTypeService.canUserCreateDocumentType(scUser, t);
      assert.strictEqual(canCreate, true, `Secrétariat Central (SC) MUST be authorized to create [${t}]`);
    }
    console.log('  ✅ Secrétariat Central (SC) has universal creation rights across all types.\n');

    // ---------------------------------------------------------
    // TEST 4: Administrator Universal Rights (Niveau 3)
    // ---------------------------------------------------------
    console.log('▶ Test 4: Administrator universal creation rights...');
    for (const t of allTypesToTest) {
      const canCreate = await documentTypeService.canUserCreateDocumentType(adminUser, t);
      assert.strictEqual(canCreate, true, `Administrator MUST have full creation rights for [${t}]`);
    }
    console.log('  ✅ Administrator has full universal creation rights.\n');

    // ---------------------------------------------------------
    // TEST 5: Dynamic Permission Grant & Revocation
    // ---------------------------------------------------------
    console.log('▶ Test 5: Dynamic Permission Grant by Administrator to an Ordinary Service...');
    // Initial state: ordinaryUser cannot create ARRETE
    let canOrdinaryCreateArrete = await documentTypeService.canUserCreateDocumentType(ordinaryUser, 'ARRETE');
    assert.strictEqual(canOrdinaryCreateArrete, false);

    // Admin grants ARRETE permission to ordinaryService
    await documentTypeService.updatePermissions('ARRETE', [
      { service_id: ordinaryService.id, can_create: 1, can_edit: 1, can_view: 1 }
    ], adminUser);

    // After grant: ordinaryUser CAN create ARRETE
    canOrdinaryCreateArrete = await documentTypeService.canUserCreateDocumentType(ordinaryUser, 'ARRETE');
    assert.strictEqual(canOrdinaryCreateArrete, true, 'Ordinary service MUST now be allowed to create ARRETE following explicit grant');
    console.log('  ✅ Dynamic explicit grant applied successfully (ordinary user can now create ARRETE).');

    // Admin revokes ARRETE permission
    await documentTypeService.updatePermissions('ARRETE', [], adminUser);
    canOrdinaryCreateArrete = await documentTypeService.canUserCreateDocumentType(ordinaryUser, 'ARRETE');
    assert.strictEqual(canOrdinaryCreateArrete, false, 'Ordinary service MUST be denied ARRETE after revocation');
    console.log('  ✅ Dynamic revocation applied successfully.\n');

    // ---------------------------------------------------------
    // TEST 6: Creatable Catalog Scoping
    // ---------------------------------------------------------
    console.log('▶ Test 6: Creatable Catalog Scoping for ordinary user vs SC...');
    const ordinaryCreatable = await documentTypeService.getCreatableDocumentTypesForUser(ordinaryUser);
    const scCreatable = await documentTypeService.getCreatableDocumentTypesForUser(scUser);

    const ordinaryCodes = ordinaryCreatable.map(t => t.code);
    const scCodes = scCreatable.map(t => t.code);

    assert(ordinaryCodes.includes('RAPPORT'), 'Ordinary catalog MUST include RAPPORT');
    assert(!ordinaryCodes.includes('LOI'), 'Ordinary catalog MUST NOT include LOI');
    assert(!ordinaryCodes.includes('DECRET'), 'Ordinary catalog MUST NOT include DECRET');
    assert(!ordinaryCodes.includes('ARRETE'), 'Ordinary catalog MUST NOT include ARRETE');

    assert(scCodes.includes('LOI'), 'SC catalog MUST include LOI');
    assert(scCodes.includes('DECRET'), 'SC catalog MUST include DECRET');
    assert(scCodes.includes('ARRETE'), 'SC catalog MUST include ARRETE');
    assert(scCodes.includes('RAPPORT'), 'SC catalog MUST include RAPPORT');

    console.log(`  ✅ Ordinary catalog properly filtered (${ordinaryCreatable.length} types) vs SC catalog (${scCreatable.length} types).\n`);

    // ---------------------------------------------------------
    // TEST 7: Document Type CRUD & Logical Deactivation (Integrity)
    // ---------------------------------------------------------
    console.log('▶ Test 7: Document Type Creation & Logical Deactivation...');
    const testTypeCode = 'TEST_DOC_AUDIT_' + Date.now();
    const createdType = await documentTypeService.createDocumentType({
      code: testTypeCode,
      label: 'Document Test Audit',
      category: 'OFFICIAL',
      is_restricted: false,
      default_reference_pattern: 'TEST/{SERVICE}/{ANNEE}/{NUMERO}'
    }, adminUser);

    assert.strictEqual(createdType.code, testTypeCode);
    assert.strictEqual(createdType.is_active, 1);

    // Deactivate logically
    const deactRes = await documentTypeService.deactivateDocumentType(testTypeCode, adminUser);
    assert.strictEqual(deactRes.success, true);

    const checkDeact = await db.get('SELECT is_active FROM document_type_configs WHERE code = ?', [testTypeCode]);
    assert.strictEqual(checkDeact.is_active, 0, 'Type MUST be logically deactivated');

    // Clean up test type
    await db.run('DELETE FROM document_type_configs WHERE code = ?', [testTypeCode]);
    console.log('  ✅ Document Type lifecycle and logical deactivation verified.\n');

    console.log('🎉 ========================================================');
    console.log('🎉 ALL TESTS PASSED: DOCUMENT TYPE PERMISSIONS & SCOPING');
    console.log('🎉 ========================================================');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTests();
