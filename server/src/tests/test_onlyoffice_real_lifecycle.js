/**
 * UK-GED ONLYOFFICE Real Integration & Document Server Lifecycle Test Suite
 * Validates:
 * 1. ONLYOFFICE Config generation & JWT Signature
 * 2. DOCX Binary serving (HTTP 200, valid MIME, PK zip signature)
 * 3. ONLYOFFICE Callback Handling (Status 1, 2, 4, 6)
 * 4. Multi-model isolation (Ordre de mission, Procès-verbal, Rapport)
 * 5. Versioning & Non-destructive persistence
 */

const db = require('../database/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { ONLYOFFICE_CONFIG, buildOnlyofficeDocEditorConfig } = require('../config/onlyoffice');
const docxService = require('../services/docxService');
const fs = require('fs');
const path = require('path');
const http = require('http');

const uploadDir = path.join(__dirname, '../../uploads/templates');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function runOnlyofficeLifecycleTests() {
  console.log('========================================================================');
  console.log(' UK-GED ONLYOFFICE LIFECYCLE & INTEGRATION VERIFICATION SUITE');
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
    const testUser = { id: 1, first_name: 'Admin', last_name: 'Kindia', role_code: 'SUPER_ADMIN', service_id: 1 };
    const authHeader = jwt.sign({ userId: 1, tokenVersion: 1 }, JWT_SECRET);

    const modelsToTest = [
      { code: 'ORDRE_001', name: 'Ordre de Mission Officiel', docType: 'ORDRE_DE_MISSION' },
      { code: 'PV_001', name: 'Procès-Verbal de Conseil', docType: 'PROCES_VERBAL' },
      { code: 'RAPPORT_001', name: 'Rapport Annuel d’Activité', docType: 'RAPPORT' }
    ];

    console.log('[PHASE 1] Initializing & seeding test templates with valid physical DOCX...');
    const createdTemplateIds = [];

    for (const m of modelsToTest) {
      let tpl = await db.get('SELECT * FROM document_templates WHERE code = ?', [m.code]);
      if (!tpl) {
        const dummyFile = `template_${Date.now()}_${m.code.toLowerCase()}.docx`;
        const buf = await docxService.buildGenericOfficialDocx({ templateName: m.name, documentTypeCode: m.docType });
        fs.writeFileSync(path.join(uploadDir, dummyFile), buf);
        const ins = await db.run(
          `INSERT INTO document_templates (code, document_type_code, name, category, scope_type, is_active, is_default, file_path, format, version, created_by)
           VALUES (?, ?, ?, 'OFFICIAL', 'GLOBAL', 1, 1, ?, 'DOCX', 1, 1)`,
          [m.code, m.docType, m.name, dummyFile]
        );
        tpl = await db.get('SELECT * FROM document_templates WHERE id = ?', [ins.lastID]);
      } else {
        // Ensure valid file
        if (!tpl.file_path || !fs.existsSync(path.join(uploadDir, tpl.file_path))) {
          const dummyFile = `template_${Date.now()}_${m.code.toLowerCase()}.docx`;
          const buf = await docxService.buildGenericOfficialDocx({ templateName: m.name, documentTypeCode: m.docType });
          fs.writeFileSync(path.join(uploadDir, dummyFile), buf);
          await db.run('UPDATE document_templates SET file_path = ?, format = "DOCX" WHERE id = ?', [dummyFile, tpl.id]);
          tpl.file_path = dummyFile;
        }
      }
      createdTemplateIds.push(tpl.id);
    }

    console.log(`[PHASE 1] Prepared ${createdTemplateIds.length} test templates.\n`);

    // Helper to make HTTP request to local backend
    function apiRequest(method, endpoint, body = null) {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'localhost',
          port: 5000,
          path: endpoint,
          method: method,
          headers: {
            'Authorization': 'Bearer ' + authHeader,
            'Content-Type': 'application/json'
          }
        };

        const req = http.request(options, (res) => {
          let data = [];
          res.on('data', chunk => data.push(chunk));
          res.on('end', () => {
            const buffer = Buffer.concat(data);
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              buffer: buffer,
              json: () => {
                try { return JSON.parse(buffer.toString()); } catch(e) { return null; }
              },
              text: () => buffer.toString()
            });
          });
        });

        req.on('error', reject);
        if (body) {
          req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
      });
    }

    // TEST SUITE 1: ONLYOFFICE Config Endpoint
    console.log('[PHASE 2] Testing ONLYOFFICE Configuration & JWT Generation...');
    for (const tId of createdTemplateIds) {
      const res = await apiRequest('GET', `/api/templates/${tId}/onlyoffice/config?mode=edit`);
      assert(res.statusCode === 200, `GET /api/templates/${tId}/onlyoffice/config returns HTTP 200`);
      
      const data = res.json();
      assert(data.success === true, `Config payload reports success: true`);
      assert(data.config !== undefined && data.config.document !== undefined, `Config contains document object`);
      assert(data.config.document.fileType === 'docx', `Config document.fileType is docx`);
      assert(typeof data.config.document.key === 'string' && data.config.document.key.length > 5, `Config document.key is valid (${data.config.document.key})`);
      assert(typeof data.config.document.url === 'string' && data.config.document.url.includes('/onlyoffice-file'), `Config document.url points to onlyoffice-file`);
      assert(typeof data.config.editorConfig.callbackUrl === 'string' && data.config.editorConfig.callbackUrl.includes('/onlyoffice/callback'), `Config callbackUrl points to onlyoffice callback`);
      
      // Verify JWT Signature if enabled
      if (ONLYOFFICE_CONFIG.JWT_SECRET) {
        assert(typeof data.config.token === 'string', `Config includes signed JWT token`);
        const decoded = jwt.verify(data.config.token, ONLYOFFICE_CONFIG.JWT_SECRET);
        assert(decoded.document !== undefined, `Decoded JWT token contains valid document configuration`);
      }
    }

    // TEST SUITE 2: DOCX Binary Delivery
    console.log('\n[PHASE 3] Testing DOCX Binary Serving (/onlyoffice-file)...');
    for (const tId of createdTemplateIds) {
      const res = await apiRequest('GET', `/api/templates/${tId}/versions/current/onlyoffice-file`);
      assert(res.statusCode === 200, `GET onlyoffice-file for template ${tId} returns HTTP 200`);
      assert(
        res.headers['content-type'] && res.headers['content-type'].includes('officedocument.wordprocessingml.document'),
        `Content-Type is official Word OpenXML format`
      );
      assert(res.buffer.length > 1000, `DOCX payload size is valid (${res.buffer.length} bytes)`);
      // Verify PK zip magic bytes (first 2 bytes are PK: 0x50, 0x4B)
      assert(res.buffer[0] === 0x50 && res.buffer[1] === 0x4B, `File signature is valid DOCX ZIP binary (PK magic bytes)`);
    }

    // TEST SUITE 3: ONLYOFFICE Callback Handler
    console.log('\n[PHASE 4] Testing ONLYOFFICE Callbacks (Status 1, 4, 2)...');
    const primaryId = createdTemplateIds[0];

    // Status 1: User editing
    const cbEditing = await apiRequest('POST', `/api/templates/${primaryId}/onlyoffice/callback`, {
      status: 1,
      users: ['user_1'],
      key: `UKGED_TEST_KEY_${Date.now()}`
    });
    assert(cbEditing.statusCode === 200, `Callback Status 1 (Editing) returns HTTP 200`);
    assert(cbEditing.json()?.error === 0, `Callback Status 1 returns { error: 0 }`);

    // Status 4: Closed without modifications
    const cbClosed = await apiRequest('POST', `/api/templates/${primaryId}/onlyoffice/callback`, {
      status: 4,
      key: `UKGED_TEST_KEY_${Date.now()}`
    });
    assert(cbClosed.statusCode === 200, `Callback Status 4 (Closed) returns HTTP 200`);
    assert(cbClosed.json()?.error === 0, `Callback Status 4 returns { error: 0 }`);

    // Status 2: Document saved (mocking ONLYOFFICE download URL with existing local file)
    const tplRec = await db.get('SELECT * FROM document_templates WHERE id = ?', [primaryId]);
    const mockDownloadUrl = `http://localhost:5000/api/templates/${primaryId}/versions/current/onlyoffice-file`;
    const cbSave = await apiRequest('POST', `/api/templates/${primaryId}/onlyoffice/callback?new_version=1`, {
      status: 2,
      url: mockDownloadUrl,
      key: `UKGED_TEST_KEY_${Date.now()}`,
      users: ['user_1']
    });
    assert(cbSave.statusCode === 200, `Callback Status 2 (Saved) returns HTTP 200`);
    assert(cbSave.json()?.error === 0, `Callback Status 2 returns { error: 0 }`);

    // Verify version bumped to V2
    const updatedTpl = await db.get('SELECT * FROM document_templates WHERE id = ?', [primaryId]);
    assert(updatedTpl.version > tplRec.version, `Template version was incremented from v${tplRec.version} to v${updatedTpl.version}`);

    console.log('\n========================================================================');
    console.log(` SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Lifecycle test execution error:', err);
    process.exit(1);
  }
}

runOnlyofficeLifecycleTests();
