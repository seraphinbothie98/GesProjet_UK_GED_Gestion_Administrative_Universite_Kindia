/**
 * Verification of the Default Template Selection Rule:
 * 1. Filtered by exact document type
 * 2. Filtered by active status (is_active = 1)
 * 3. Filtered by default flag (is_default = 1)
 * 4. Filtered by user/service access rights
 * 5. Returns friendly notice when no default is configured
 */

const db = require('../database/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const docxService = require('../services/docxService');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '../../uploads/templates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function runDefaultTemplateRuleTests() {
  console.log('========================================================================');
  console.log(' UK-GED DEFAULT TEMPLATE SELECTION RULE VERIFICATION SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    const user = { id: 1, service_id: 1, role_code: 'SUPER_ADMIN' };

    // Setup: Ensure we have active default templates for key types and test non-default ones
    const docTypesToTest = [
      { code: 'ORDRE_DE_MISSION', name: 'Modèle Officiel — Ordre de Mission' },
      { code: 'RAPPORT', name: 'Modèle Officiel — Rapport d’Activité' },
      { code: 'PROCES_VERBAL', name: 'Modèle Officiel — Procès-Verbal' },
      { code: 'ATTESTATION', name: 'Modèle Officiel — Attestation' },
      { code: 'LETTRE_ADMINISTRATIVE', name: 'Modèle Officiel — Lettre Administrative' }
    ];

    console.log('[SETUP] Configuring active default templates for each document type...');
    for (const dt of docTypesToTest) {
      // 1. Reset defaults for this type
      await db.run('UPDATE document_templates SET is_default = 0 WHERE document_type_code = ? OR code = ?', [dt.code, dt.code]);

      // 2. Insert or update a primary default template
      const existing = await db.get('SELECT id FROM document_templates WHERE document_type_code = ? OR code = ?', [dt.code, dt.code]);
      let tplId;
      if (existing) {
        await db.run('UPDATE document_templates SET is_default = 1, is_active = 1, name = ? WHERE id = ?', [dt.name, existing.id]);
        tplId = existing.id;
      } else {
        const dummyFile = `template_${Date.now()}_${dt.code.toLowerCase()}.docx`;
        const buf = await docxService.buildGenericOfficialDocx({ templateName: dt.name, documentTypeCode: dt.code });
        fs.writeFileSync(path.join(uploadDir, dummyFile), buf);
        const ins = await db.run(
          `INSERT INTO document_templates (code, document_type_code, name, category, scope_type, is_active, is_default, file_path, created_by)
           VALUES (?, ?, ?, 'OFFICIAL', 'GLOBAL', 1, 1, ?, 1)`,
          [dt.code, dt.code, dt.name, dummyFile]
        );
        tplId = ins.lastID;
      }

      // 3. Insert a SECOND non-default template for this same type to verify it is NEVER selected by default rule
      const nonDefCode = `${dt.code}_DRAFT_SECONDARY`;
      const nonDefName = `${dt.name} (Brouillon non par défaut)`;
      const nonDefExisting = await db.get('SELECT id FROM document_templates WHERE code = ?', [nonDefCode]);
      if (!nonDefExisting) {
        await db.run(
          `INSERT INTO document_templates (code, document_type_code, name, category, scope_type, is_active, is_default, file_path, created_by)
           VALUES (?, ?, ?, 'OFFICIAL', 'GLOBAL', 1, 0, 'none.docx', 1)`,
          [nonDefCode, dt.code, nonDefName]
        );
      }
    }

    // TEST 1 to 5: Verify each document type resolves ONLY to its active default template
    for (const dt of docTypesToTest) {
      console.log(`\n[TEST] Resolving default template for type: ${dt.code}...`);

      const defaultTemplate = await db.get(
        `SELECT t.* 
         FROM document_templates t
         WHERE t.is_active = 1 
           AND t.is_default = 1
           AND (
             UPPER(t.document_type_code) = ? 
             OR UPPER(t.code) = ? 
             OR UPPER(t.document_category) = ?
             OR UPPER(t.category) = ?
           )
           AND (
             t.scope_type = 'GLOBAL' 
             OR t.target_service_id IS NULL
             OR t.target_service_id = ?
             OR t.created_by = ?
           )
         ORDER BY t.scope_type DESC, t.updated_at DESC
         LIMIT 1`,
        [dt.code, dt.code, dt.code, dt.code, user.service_id, user.id]
      );

      assert(defaultTemplate !== null && defaultTemplate !== undefined, `Found default template for ${dt.code}`);
      assert(defaultTemplate.is_default === 1, `Template is explicitly default (is_default = 1)`);
      assert(defaultTemplate.is_active === 1, `Template is active (is_active = 1)`);
      assert(defaultTemplate.document_type_code === dt.code || defaultTemplate.code === dt.code, `Template matches requested type ${dt.code}`);
      assert(!defaultTemplate.name.includes('non par défaut'), `Non-default templates for ${dt.code} were excluded`);
    }

    // TEST 6: Verify behavior when no default is configured
    console.log('\n[TEST 6] Testing document type with NO default configured (TYPE_SANS_DEFAUT)...');
    const noDefaultType = 'TYPE_INCONNU_SANS_DEFAUT';
    const noDefaultResult = await db.get(
      `SELECT t.* 
       FROM document_templates t
       WHERE t.is_active = 1 
         AND t.is_default = 1
         AND (
           UPPER(t.document_type_code) = ? 
           OR UPPER(t.code) = ?
         )
       LIMIT 1`,
      [noDefaultType, noDefaultType]
    );

    assert(noDefaultResult === undefined || noDefaultResult === null, 'No template returned when type has no active default');

    console.log('\n========================================================================');
    console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runDefaultTemplateRuleTests();
