const assert = require('assert');
const path = require('path');
const http = require('http');

const API_HOST = '127.0.0.1';
const API_PORT = 5000;

function apiRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path: endpoint,
      method: method,
      headers: headers
    }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: rawData });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runCustomTemplatesWorkflowTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: MODÈLES RÉELS, ISOLATION PAR SERVICE & VARIABLES');
  console.log('================================================================\n');

  // 1. Authenticate Users
  console.log('--- 1. AUTHENTICATING USERS ---');
  const adminLogin = await apiRequest('POST', '/api/auth/login', {
    identity: 'admin@univ-kindia.edu.gn',
    password: 'Admin123!'
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
  const adminToken = adminLogin.body.token;

  const infoLogin = await apiRequest('POST', '/api/auth/login', {
    identity: 'chef_info@univ-kindia.edu.gn',
    password: 'Chef123!'
  });
  assert.strictEqual(infoLogin.status, 200, 'Chef Info login should succeed');
  const infoToken = infoLogin.body.token;
  const infoServiceId = infoLogin.body.user.service_id;
  console.log(`✅ Chef Info (Service ID: ${infoServiceId}) & Admin connected.\n`);

  const mathLogin = await apiRequest('POST', '/api/auth/login', {
    identity: 'chef_math@univ-kindia.edu.gn',
    password: 'Chef123!'
  });
  assert.strictEqual(mathLogin.status, 200, 'Chef Math login should succeed');
  const mathToken = mathLogin.body.token;
  const mathServiceId = mathLogin.body.user.service_id;
  console.log(`✅ Chef Math (Service ID: ${mathServiceId}) connected.\n`);

  // 2. Verify Available Templates for Service
  console.log('--- 2. CHECKING AVAILABLE TEMPLATES FOR SERVICE (RULES 1, 2 & 15) ---');
  const availableRes = await apiRequest('GET', '/api/templates/available-for-user', null, infoToken);
  assert.strictEqual(availableRes.status, 200);
  console.log(`Initial available templates count for Info: ${availableRes.body.length}`);

  // 3. Create Custom Template for FS_INFO (Rule 4, 11)
  console.log('--- 3. CREATING CUSTOM TEMPLATE FOR FS_INFO ---');
  const templateName = `Lettre de Transmission Informatique ${Date.now()}`;
  const rawHtml = `
    <h2 style="text-align:center;">{{SERVICE}}</h2>
    <p>Réf: {{REFERENCE}} | Date: {{DATE}}</p>
    <p>A l'attention de : {{DESTINATAIRE}}</p>
    <p>Objet : {{OBJET}}</p>
    <p>Par la présente, le {{RESPONSABLE}} en qualité de {{FONCTION_RESPONSABLE}} transmet les documents ci-annexés pour l'année {{ANNEE}}.</p>
  `;

  const createTmplRes = await apiRequest('POST', '/api/templates', {
    name: templateName,
    description: 'Modèle officiel pour les transmissions du Département Informatique',
    document_type_code: 'SOIT_TRANSMIS',
    category: 'Correspondances',
    scope_type: 'SERVICE',
    target_service_id: infoServiceId,
    content_body_html: rawHtml,
    editor_type: 'UK_GED_EDITOR'
  }, infoToken);

  assert.strictEqual(createTmplRes.status, 201, 'Should create custom template');
  const createdTmpl = createTmplRes.body.template;
  assert.strictEqual(createdTmpl.name, templateName);
  assert.strictEqual(createdTmpl.target_service_id, infoServiceId);
  console.log(`✅ Template [${templateName}] created with ID: ${createdTmpl.id}\n`);

  // 4. Verify Template Presence in FS_INFO & Strict Isolation in FS_MATH (Rule 3)
  console.log('--- 4. VERIFYING SERVICE ISOLATION (RULE 3) ---');
  const infoTemplates = await apiRequest('GET', '/api/templates/available-for-user', null, infoToken);
  const hasInInfo = infoTemplates.body.some(t => t.id === createdTmpl.id);
  assert.ok(hasInInfo, 'Created template must be available for FS_INFO');
  console.log('✅ Template is visible in FS_INFO');

  const mathTemplates = await apiRequest('GET', '/api/templates/available-for-user', null, mathToken);
  const hasInMath = mathTemplates.body.some(t => t.id === createdTmpl.id);
  assert.ok(!hasInMath, 'Created template for FS_INFO must NOT be visible in FS_MATH');
  console.log('✅ Strict isolation confirmed: Template is hidden from FS_MATH\n');

  // 5. Create Administrative Document using Custom Template (Rule 5 & 14)
  console.log('--- 5. CREATING ADMINISTRATIVE DOCUMENT FROM TEMPLATE (RULE 14) ---');
  const docRes = await apiRequest('POST', '/api/documents/administrative', {
    title: 'Transmission des Notes L3 Informatique 2026',
    object_title: 'Transmission des Notes L3 Informatique 2026',
    document_type: 'SOIT_TRANSMIS',
    template_id: createdTmpl.id,
    content_body: rawHtml,
    action: 'DRAFT'
  }, infoToken);

  assert.ok(docRes.status === 200 || docRes.status === 201, 'Document should be created');
  console.log(`✅ Document created with reference: ${docRes.body.reference || docRes.body.id}\n`);

  // 6. Delete / Clean up Template
  console.log('--- 6. DELETING TEMPLATE BY ADMIN ---');
  const deleteRes = await apiRequest('DELETE', `/api/templates/${createdTmpl.id}`, null, adminToken);
  assert.strictEqual(deleteRes.status, 200, 'Template deletion should succeed');
  console.log('✅ Template deleted cleanly by Admin\n');

  console.log('================================================================');
  console.log('🎉 ALL CUSTOM TEMPLATES WORKFLOW TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================');
}

runCustomTemplatesWorkflowTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
