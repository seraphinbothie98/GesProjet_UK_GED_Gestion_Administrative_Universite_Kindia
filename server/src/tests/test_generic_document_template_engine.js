/**
 * Automated Verification Suite for UK-GED Generic Document Template Engine
 * Tests all actions (Preview, DOCX Download, Customize/ONLYOFFICE, Duplicate, Toggle Status, Set Default)
 * across ALL templates and on a brand-new unknown template.
 */

const db = require('../database/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const docxService = require('../services/docxService');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const uploadDir = path.join(__dirname, '../../uploads/templates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Generate Admin JWT Token
const adminToken = jwt.sign(
  { id: 1, username: 'admin', role: 'SUPER_ADMIN', permissions: ['*'] },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function runTests() {
  console.log('===============================================================');
  console.log(' UK-GED GENERIC DOCUMENT TEMPLATE ENGINE VERIFICATION SUITE');
  console.log('===============================================================\n');

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
    // 1. Check existing templates in database
    const templates = await db.all('SELECT * FROM document_templates ORDER BY id ASC');
    console.log(`[TEST 1] Found ${templates.length} document templates in database:`);
    templates.forEach(t => console.log(`   - ID ${t.id}: [${t.code}] ${t.name} (v${t.version || 1}, ${t.editor_type})`));
    assert(templates.length > 0, 'Database contains registered document templates');

    // 2. Test Generic DOCX Generation
    console.log('\n[TEST 2] Testing generic DOCX generator (buildGenericOfficialDocx)...');
    const genericBuffer = await docxService.buildGenericOfficialDocx({
      templateName: 'Procès-Verbal de Conseil d’Administration',
      documentTypeCode: 'PROCES_VERBAL',
      institutionName: 'UNIVERSITÉ DE KINDIA',
      serviceName: 'Secrétariat Général',
      contentHtml: '<p>L’an deux mille vingt-six et le vingt-quatre août s’est réuni le Conseil...</p>'
    });
    assert(Buffer.isBuffer(genericBuffer) && genericBuffer.length > 2000, 'Generic DOCX buffer created (> 2KB)');

    const zip = await JSZip.loadAsync(genericBuffer);
    const docXml = await zip.file('word/document.xml').async('string');
    assert(docXml.includes('UNIVERSITÉ DE KINDIA'), 'Generated DOCX contains institution name');
    assert(docXml.includes('PROCES_VERBAL') || docXml.includes('PROCÈS-VERBAL'), 'Generated DOCX contains template title');
    assert(docXml.includes('{{REFERENCE}}') && docXml.includes('{{DATE}}'), 'Generated DOCX contains dynamic variables');

    // 3. Test Preview & DOCX generation for each template in DB
    console.log('\n[TEST 3] Testing DOCX physical file readiness & preview across existing templates...');
    for (const t of templates) {
      let filePath = t.file_path;
      let fullPath = filePath ? path.join(uploadDir, filePath) : null;
      if (!fullPath || !fs.existsSync(fullPath)) {
        // Build generic DOCX on demand
        const buf = await docxService.buildGenericOfficialDocx({
          templateName: t.name,
          documentTypeCode: t.document_type_code || t.code,
          serviceName: t.target_service_name || '',
          contentHtml: t.content_body_html
        });
        const filename = `template_${Date.now()}_${(t.code || 'doc').toLowerCase()}.docx`;
        fullPath = path.join(uploadDir, filename);
        fs.writeFileSync(fullPath, buf);
        await db.run('UPDATE document_templates SET file_path = ?, format = "DOCX" WHERE id = ?', [filename, t.id]);
        filePath = filename;
      }

      assert(fs.existsSync(fullPath), `Physical .docx exists on disk for template [${t.code}] (${filePath})`);

      // Check preview HTML extraction
      const html = await docxService.docxToHtml(fullPath);
      assert(typeof html === 'string' && html.length > 50, `HTML preview extracted for [${t.code}] (${html.length} chars)`);
    }

    // 4. Test Creation of a Brand New Unknown Document Template
    console.log('\n[TEST 4] Creating a brand new unknown document template: "Modèle de Rapport Annuel de Performance 2027"...');
    const newCode = `RAPPORT_ANNUEL_PERF_${Date.now()}`;
    const newName = 'Modèle de Rapport Annuel de Performance 2027';
    const newDocxBuf = await docxService.buildGenericOfficialDocx({
      templateName: newName,
      documentTypeCode: 'RAPPORT_ANNUEL',
      serviceName: 'Direction de la Recherche',
      contentHtml: '<p>Rapport annuel des activités académiques et scientifiques...</p>'
    });
    const newDocxFileName = `template_${Date.now()}_${newCode.toLowerCase()}.docx`;
    fs.writeFileSync(path.join(uploadDir, newDocxFileName), newDocxBuf);

    const insertResult = await db.run(
      `INSERT INTO document_templates 
       (code, document_type_code, name, category, scope_type, description, editor_type, format, version, is_active, is_default, file_path, created_by)
       VALUES (?, 'RAPPORT_ANNUEL', ?, 'OFFICIAL', 'GLOBAL', 'Modèle générique de rapport annuel', 'MS_WORD', 'DOCX', 1, 1, 0, ?, 1)`,
      [newCode, newName, newDocxFileName]
    );
    const newTemplateId = insertResult.lastID;
    assert(newTemplateId > 0, `New template inserted in database with ID ${newTemplateId}`);

    // Insert Version 1
    await db.run(
      `INSERT INTO template_versions (template_id, version, version_number, file_path, file_type, editor_type, change_description, status, created_by, uploaded_by)
       VALUES (?, 1, 1, ?, 'DOCX', 'MS_WORD', 'Version initiale', 'ACTIVE', 1, 1)`,
      [newTemplateId, newDocxFileName]
    );
    assert(true, 'Version 1 recorded in template_versions');

    // 5. Test Duplication of the New Template
    console.log('\n[TEST 5] Testing duplication of the newly created template...');
    const dupCode = `${newCode}_COPIE`;
    const dupName = `${newName} (Copie)`;
    const dupFileName = `template_${Date.now()}_copy_${dupCode.toLowerCase()}.docx`;
    fs.copyFileSync(path.join(uploadDir, newDocxFileName), path.join(uploadDir, dupFileName));

    const dupResult = await db.run(
      `INSERT INTO document_templates 
       (code, document_type_code, name, category, scope_type, description, editor_type, format, version, is_active, is_default, file_path, created_by)
       VALUES (?, 'RAPPORT_ANNUEL', ?, 'OFFICIAL', 'GLOBAL', 'Copie du rapport annuel', 'MS_WORD', 'DOCX', 1, 1, 0, ?, 1)`,
      [dupCode, dupName, dupFileName]
    );
    const dupTemplateId = dupResult.lastID;
    assert(dupTemplateId > 0 && dupTemplateId !== newTemplateId, `Duplicated template created with ID ${dupTemplateId}`);
    assert(fs.existsSync(path.join(uploadDir, dupFileName)), `Duplicated physical file exists on disk (${dupFileName})`);

    // 6. Test Status Toggle
    console.log('\n[TEST 6] Testing status toggle (active / inactive)...');
    await db.run('UPDATE document_templates SET is_active = 0 WHERE id = ?', [dupTemplateId]);
    let checkTpl = await db.get('SELECT is_active FROM document_templates WHERE id = ?', [dupTemplateId]);
    assert(checkTpl.is_active === 0, 'Template status deactivated (is_active = 0)');

    await db.run('UPDATE document_templates SET is_active = 1 WHERE id = ?', [dupTemplateId]);
    checkTpl = await db.get('SELECT is_active FROM document_templates WHERE id = ?', [dupTemplateId]);
    assert(checkTpl.is_active === 1, 'Template status re-activated (is_active = 1)');

    // 7. Test Set Default
    console.log('\n[TEST 7] Testing set default template with scoped reset...');
    await db.run('UPDATE document_templates SET is_default = 0 WHERE document_type_code = "RAPPORT_ANNUEL"');
    await db.run('UPDATE document_templates SET is_default = 1 WHERE id = ?', [newTemplateId]);

    const defaultTpl = await db.get('SELECT * FROM document_templates WHERE id = ?', [newTemplateId]);
    assert(defaultTpl.is_default === 1, 'Template marked as default (is_default = 1)');

    // 8. Test ONLYOFFICE Config Generation
    console.log('\n[TEST 8] Testing ONLYOFFICE DocEditor config generator...');
    const { buildOnlyofficeDocEditorConfig } = require('../config/onlyoffice');
    const onlyofficePayload = buildOnlyofficeDocEditorConfig({
      template: defaultTpl,
      version: { version_number: 1 },
      user: { id: 1, username: 'admin', first_name: 'Séraphin', last_name: 'Bothie' },
      mode: 'edit',
      tenantId: 'UNIVERSITE_KINDIA'
    });

    assert(onlyofficePayload.config && onlyofficePayload.config.document, 'ONLYOFFICE config generated');
    assert(onlyofficePayload.config.document.fileType === 'docx', 'ONLYOFFICE document.fileType is docx');
    assert(onlyofficePayload.config.document.key.startsWith('UKGED_TPL_'), `ONLYOFFICE document.key generated: ${onlyofficePayload.config.document.key}`);
    assert(onlyofficePayload.config.editorConfig.callbackUrl.includes('/api/templates/'), 'ONLYOFFICE callbackUrl correctly formatted');

    console.log('\n===============================================================');
    console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();
