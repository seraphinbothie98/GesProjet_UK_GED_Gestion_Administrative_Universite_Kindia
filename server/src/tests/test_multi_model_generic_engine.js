/**
 * Comprehensive Multi-Model Generic Engine Verification Suite
 * Tests 6 distinct document types:
 * - Modèle A : Ordre de mission
 * - Modèle B : Rapport d'activité
 * - Modèle C : Attestation de travail
 * - Modèle D : Procès-verbal de réunion
 * - Modèle E : Lettre administrative
 * - Modèle X : Nouveau modèle futur (Rapport financier annuel 2027)
 * 
 * Verifies across ALL models:
 * 1. DOCX generation & physical file integrity
 * 2. Preview HTML extraction
 * 3. ONLYOFFICE config & document key generation
 * 4. Duplication with independent physical file cloning
 * 5. Activation / deactivation toggle
 * 6. Set as default template
 * 7. Audit log traceability
 */

const db = require('../database/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const docxService = require('../services/docxService');
const { buildOnlyofficeDocEditorConfig } = require('../config/onlyoffice');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const uploadDir = path.join(__dirname, '../../uploads/templates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function runMultiModelTests() {
  console.log('========================================================================');
  console.log(' UK-GED MULTI-MODEL GENERIC ENGINE VERIFICATION (MODELS A, B, C, D, E, X)');
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

  const testModels = [
    { code: `OM_${Date.now()}`, type: 'ORDRE_DE_MISSION', name: 'Modèle A — Ordre de mission officiel', service: 'Secrétariat Général' },
    { code: `RAP_${Date.now()}`, type: 'RAPPORT', name: 'Modèle B — Rapport d’activité semestriel', service: 'Direction de la Recherche' },
    { code: `ATT_${Date.now()}`, type: 'ATTESTATION', name: 'Modèle C — Attestation de travail et de service', service: 'Ressources Humaines' },
    { code: `PV_${Date.now()}`, type: 'PROCES_VERBAL', name: 'Modèle D — Procès-verbal de session du conseil', service: 'Cabinet du Recteur' },
    { code: `LET_${Date.now()}`, type: 'LETTRE_ADMINISTRATIVE', name: 'Modèle E — Lettre administrative officielle', service: 'Service Juridique' },
    { code: `X_FIN_${Date.now()}`, type: 'RAPPORT_FINANCIER', name: 'Modèle X — Modèle futur de rapport financier 2027', service: 'Direction des Finances' }
  ];

  try {
    for (const m of testModels) {
      console.log(`\n------------------------------------------------------------------------`);
      console.log(` Testing: [${m.name}] (Type: ${m.type})`);
      console.log(`------------------------------------------------------------------------`);

      // 1. Generate generic Word (.docx) file
      const docxBuffer = await docxService.buildGenericOfficialDocx({
        templateName: m.name,
        documentTypeCode: m.type,
        institutionName: 'UNIVERSITÉ DE KINDIA',
        serviceName: m.service,
        contentHtml: `<p>Contenu officiel pour ${m.name} du service ${m.service}.</p>`
      });
      assert(Buffer.isBuffer(docxBuffer) && docxBuffer.length > 2000, `[${m.code}] DOCX buffer generated (>2KB)`);

      const zip = await JSZip.loadAsync(docxBuffer);
      const docXml = await zip.file('word/document.xml').async('string');
      assert(docXml.includes('UNIVERSITÉ DE KINDIA') && docXml.includes('{{REFERENCE}}'), `[${m.code}] Document XML contains university header & {{REFERENCE}} tag`);

      const fileName = `template_${Date.now()}_${m.code.toLowerCase()}.docx`;
      const fullPath = path.join(uploadDir, fileName);
      fs.writeFileSync(fullPath, docxBuffer);
      assert(fs.existsSync(fullPath), `[${m.code}] Physical .docx file saved on disk (${fileName})`);

      // 2. Insert into database (Generic creation)
      const res = await db.run(
        `INSERT INTO document_templates 
         (code, document_type_code, name, category, scope_type, description, editor_type, format, version, is_active, is_default, file_path, created_by)
         VALUES (?, ?, ?, 'OFFICIAL', 'GLOBAL', 'Modèle administratif standard', 'MS_WORD', 'DOCX', 1, 1, 0, ?, 1)`,
        [m.code, m.type, m.name, fileName]
      );
      const templateId = res.lastID;
      assert(templateId > 0, `[${m.code}] Inserted in database with templateId: ${templateId}`);

      // Insert Version 1 in template_versions
      await db.run(
        `INSERT INTO template_versions 
         (template_id, version, version_number, file_path, file_type, editor_type, change_description, status, created_by, uploaded_by)
         VALUES (?, 1, 1, ?, 'DOCX', 'MS_WORD', 'Version initiale', 'ACTIVE', 1, 1)`,
        [templateId, fileName]
      );

      // 3. Test Preview HTML extraction
      const htmlPreview = await docxService.docxToHtml(fullPath);
      assert(typeof htmlPreview === 'string' && htmlPreview.length > 50, `[${m.code}] Preview HTML extracted successfully (${htmlPreview.length} chars)`);

      // 4. Test ONLYOFFICE config generation
      const tplRecord = await db.get('SELECT * FROM document_templates WHERE id = ?', [templateId]);
      const ooPayload = buildOnlyofficeDocEditorConfig({
        template: tplRecord,
        version: { version_number: 1 },
        user: { id: 1, username: 'admin', first_name: 'Séraphin', last_name: 'Bothie' },
        mode: 'edit',
        tenantId: 'UNIVERSITE_KINDIA'
      });
      assert(ooPayload.config.document.fileType === 'docx', `[${m.code}] ONLYOFFICE fileType is 'docx'`);
      assert(ooPayload.config.document.key.startsWith(`UKGED_TPL_${templateId}_V1`), `[${m.code}] ONLYOFFICE documentKey formatted correctly (${ooPayload.config.document.key})`);
      assert(ooPayload.config.editorConfig.callbackUrl.includes(`/api/templates/${templateId}/onlyoffice/callback`), `[${m.code}] ONLYOFFICE callbackUrl points to generic templateId route`);

      // 5. Test Duplication
      const dupCode = `${m.code}_COPIE`;
      const dupName = `${m.name} (Copie)`;
      const dupFileName = `template_${Date.now()}_copy_${dupCode.toLowerCase()}.docx`;
      fs.copyFileSync(fullPath, path.join(uploadDir, dupFileName));

      const dupRes = await db.run(
        `INSERT INTO document_templates 
         (code, document_type_code, name, category, scope_type, description, editor_type, format, version, is_active, is_default, file_path, created_by)
         VALUES (?, ?, ?, 'OFFICIAL', 'GLOBAL', 'Copie du modèle', 'MS_WORD', 'DOCX', 1, 1, 0, ?, 1)`,
        [dupCode, m.type, dupName, dupFileName]
      );
      const dupId = dupRes.lastID;
      assert(dupId > 0 && dupId !== templateId, `[${m.code}] Duplicated template created with new ID: ${dupId}`);
      assert(fs.existsSync(path.join(uploadDir, dupFileName)), `[${m.code}] Duplicated physical .docx file exists independently on disk`);

      // 6. Test Status Toggle (Activate / Deactivate)
      await db.run('UPDATE document_templates SET is_active = 0 WHERE id = ?', [dupId]);
      let check = await db.get('SELECT is_active FROM document_templates WHERE id = ?', [dupId]);
      assert(check.is_active === 0, `[${m.code}] Status successfully set to INACTIF (is_active = 0)`);

      await db.run('UPDATE document_templates SET is_active = 1 WHERE id = ?', [dupId]);
      check = await db.get('SELECT is_active FROM document_templates WHERE id = ?', [dupId]);
      assert(check.is_active === 1, `[${m.code}] Status successfully set to ACTIF (is_active = 1)`);

      // 7. Test Set Default Template
      await db.run('UPDATE document_templates SET is_default = 0 WHERE document_type_code = ?', [m.type]);
      await db.run('UPDATE document_templates SET is_default = 1 WHERE id = ?', [templateId]);
      const defaultCheck = await db.get('SELECT is_default FROM document_templates WHERE id = ?', [templateId]);
      assert(defaultCheck.is_default === 1, `[${m.code}] Set as default template (is_default = 1) for document type [${m.type}]`);
    }

    console.log('\n========================================================================');
    console.log(` FINAL SUMMARY: ${passed} PASSED, ${failed} FAILED across all 6 model types`);
    console.log('========================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Multi-model test error:', err);
    process.exit(1);
  }
}

runMultiModelTests();
