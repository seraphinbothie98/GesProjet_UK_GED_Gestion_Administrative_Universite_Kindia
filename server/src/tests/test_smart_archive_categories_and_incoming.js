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

async function runSmartArchiveCategoriesTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: GESTION INTELLIGENTE DES CATÉGORIES & TRI ALPHABÉTIQUE');
  console.log('================================================================\n');

  // 1. Authenticate Users
  console.log('--- 1. AUTHENTICATING TEST USERS ---');
  const adminLogin = await apiRequest('POST', '/api/auth/login', {
    identity: 'admin@univ-kindia.edu.gn',
    password: 'Admin123!'
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login should succeed');
  const adminToken = adminLogin.body.token;
  console.log('✅ Admin authenticated');

  const infoLogin = await apiRequest('POST', '/api/auth/login', {
    identity: 'chef_info@univ-kindia.edu.gn',
    password: 'Chef123!'
  });
  assert.strictEqual(infoLogin.status, 200, 'Chef Info login should succeed');
  const infoToken = infoLogin.body.token;
  const infoServiceId = infoLogin.body.user.service_id;
  console.log(`✅ Chef Info authenticated (Service ID: ${infoServiceId})`);

  const mathLogin = await apiRequest('POST', '/api/auth/login', {
    identity: 'chef_math@univ-kindia.edu.gn',
    password: 'Chef123!'
  });
  assert.strictEqual(mathLogin.status, 200, 'Chef Math login should succeed');
  const mathToken = mathLogin.body.token;
  const mathServiceId = mathLogin.body.user.service_id;
  console.log(`✅ Chef Math authenticated (Service ID: ${mathServiceId})\n`);

  // 2. Verify default categories exist for services (Soit-transmis & Demandes)
  console.log('--- 2. VERIFY DEFAULT CATEGORIES AUTO-PROVISIONING ---');
  const infoCats = await apiRequest('GET', '/api/archive-categories', null, infoToken);
  assert.strictEqual(infoCats.status, 200, 'Fetch categories for Info should succeed');
  const customCats = infoCats.body.customs || [];
  console.log(`Found ${customCats.length} categories for FS_INFO`);
  
  const hasSoitTransmis = customCats.some(c => c.code === 'SOIT_TRANSMIS' || c.name.toLowerCase().includes('soit-transmis'));
  const hasDemandes = customCats.some(c => c.code === 'DEMANDE' || c.name.toLowerCase().includes('demande'));
  assert.ok(hasSoitTransmis, 'Default category Soit-transmis must exist');
  assert.ok(hasDemandes, 'Default category Demandes must exist');
  console.log('✅ Default categories Soit-transmis & Demandes present with default types\n');

  // 3. Document Types List & Dynamic Creation
  console.log('--- 3. DOCUMENT TYPES LIST & CREATING NEW DOCUMENT TYPE ---');
  const docTypesRes = await apiRequest('GET', '/api/archive-categories/document-types', null, infoToken);
  assert.strictEqual(docTypesRes.status, 200);
  assert.ok(Array.isArray(docTypesRes.body), 'Document types should be an array');
  console.log(`Loaded ${docTypesRes.body.length} official document types`);

  // Create a new official act type on the fly
  const newTypeRes = await apiRequest('POST', '/api/archive-categories/document-types', {
    label: `Bordereau Spécial Kindia ${Date.now()}`
  }, infoToken);
  assert.ok(newTypeRes.status === 200 || newTypeRes.status === 201, 'Should create new document type (200 or 201)');
  console.log(`✅ Created new document type: ${newTypeRes.body.type.label} (${newTypeRes.body.type.code})\n`);

  // 4. Create Category with Associated Types & Default flag
  console.log('--- 4. CREATE CATEGORY WITH MULTIPLE ASSOCIATED TYPES ---');
  const catName = `Actes Réglementaires Test ${Date.now()}`;
  const uniqueTypeCode = newTypeRes.body.type.code;
  const createCatRes = await apiRequest('POST', '/api/archive-categories', {
    name: catName,
    description: 'Décrets, Arrêtés, Circulaires et Décisions du service',
    icon: 'BookmarkCheck',
    color: 'text-amber-800 bg-amber-50 border-amber-200',
    associated_types: ['DECRET', 'ARRETE', 'CIRCULAIRE', uniqueTypeCode],
    is_default_for_types: ['ARRETE', uniqueTypeCode]
  }, infoToken);

  assert.strictEqual(createCatRes.status, 201, 'Should create custom category');
  const createdCat = createCatRes.body.category;
  assert.strictEqual(createdCat.name, catName);
  assert.deepStrictEqual(createdCat.associated_types, ['DECRET', 'ARRETE', 'CIRCULAIRE', uniqueTypeCode]);
  assert.deepStrictEqual(createdCat.is_default_for_types, ['ARRETE', uniqueTypeCode]);
  console.log(`✅ Category [${catName}] created with 4 associated types and 2 defaults\n`);

  // 5. Smart Category Suggestion Verification
  console.log('--- 5. SMART CATEGORY SUGGESTION (BIDIRECTIONAL LINK) ---');
  const suggestRes = await apiRequest('GET', `/api/archive-categories/suggest-category?type=${uniqueTypeCode}&service_id=${infoServiceId}`, null, infoToken);
  assert.strictEqual(suggestRes.status, 200);
  assert.ok(suggestRes.body.defaultCategory, `Should suggest a default category for ${uniqueTypeCode}`);
  assert.strictEqual(suggestRes.body.defaultCategory.id, createdCat.id, `Default category for ${uniqueTypeCode} should be the newly created category`);
  console.log(`✅ Suggested default category for ${uniqueTypeCode}: [${suggestRes.body.defaultCategory.name}]`);

  const suggestCirculaire = await apiRequest('GET', `/api/archive-categories/suggest-category?type=CIRCULAIRE&service_id=${infoServiceId}`, null, infoToken);
  assert.strictEqual(suggestCirculaire.status, 200);
  const isCompatible = suggestCirculaire.body.compatibleCategories.some(c => c.id === createdCat.id);
  assert.ok(isCompatible, 'Created category should be in compatible categories for CIRCULAIRE');
  console.log(`✅ Category is recognized as compatible with CIRCULAIRE\n`);

  // 6. French Alphabetical Sorting with Accented Characters
  console.log('--- 6. FRENCH ALPHABETICAL ORDER SORTING ---');
  // Create several categories to test exact French sorting order
  const catA = `Arrêtés Officiels ${Date.now()}`;
  const catE = `Évaluations Pédagogiques ${Date.now()}`;
  const catZ = `Zénith Travaux ${Date.now()}`;

  await apiRequest('POST', '/api/archive-categories', { name: catZ }, infoToken);
  await apiRequest('POST', '/api/archive-categories', { name: catE }, infoToken);
  await apiRequest('POST', '/api/archive-categories', { name: catA }, infoToken);

  const sortedCatsRes = await apiRequest('GET', '/api/archive-categories', null, infoToken);
  const customs = sortedCatsRes.body.customs;
  const names = customs.map(c => c.name);
  console.log('Categories sorted list:', names);

  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
  for (let i = 0; i < names.length - 1; i++) {
    const comp = collator.compare(names[i], names[i + 1]);
    assert.ok(comp <= 0, `Ordering violation: "${names[i]}" should come before "${names[i + 1]}"`);
  }
  console.log('✅ All categories strictly follow French alphabetical sorting rules\n');

  // 7. Incoming Mail Registration with Archive Category Assignment
  console.log('--- 7. REGISTER INCOMING MAIL WITH ARCHIVE CATEGORY ---');
  const incomingMailRes = await apiRequest('POST', '/api/documents/incoming', {
    title: 'Arrêté Rectoral Portant Organisation des Examens 2026',
    sender_name: 'Direction Générale des Études',
    sender_organization: 'Université de Kindia',
    official_type: 'ARRETE',
    processing_mode: 'DIRECT_ARCHIVE',
    custom_category_id: createdCat.id,
    archive_category: createdCat.name
  }, adminToken);

  assert.ok(incomingMailRes.status === 200 || incomingMailRes.status === 201, 'Incoming mail should be created (200 or 201)');
  assert.ok(incomingMailRes.body.reference, 'Reference should be generated');
  console.log(`✅ Incoming mail created with reference: ${incomingMailRes.body.reference}`);
  console.log(`Document ID: ${incomingMailRes.body.id}\n`);

  // 8. Service Isolation Verification
  console.log('--- 8. SERVICE ISOLATION VERIFICATION ---');
  const mathCatsRes = await apiRequest('GET', '/api/archive-categories', null, mathToken);
  const mathCustomNames = (mathCatsRes.body.customs || []).map(c => c.name);
  assert.ok(!mathCustomNames.includes(catName), `Category [${catName}] of FS_INFO must NOT appear in FS_MATH`);
  console.log(`✅ Strict isolation verified: FS_MATH only sees its own ${mathCustomNames.length} categories\n`);

  // 9. Administrator Rights vs Service User Rights
  console.log('--- 9. ADMIN VS SERVICE ROLE PERMISSION RULES ---');
  // Service user attempting to modify existing category -> MUST BE FORBIDDEN (403)
  const forbiddenUpdate = await apiRequest('PUT', `/api/archive-categories/${createdCat.id}`, {
    name: 'Tentative Modification Non Autorisée'
  }, infoToken);
  assert.strictEqual(forbiddenUpdate.status, 403, 'Service user should receive 403 when updating category');
  console.log('✅ Service user correctly restricted from modifying categories (403)');

  // Admin updating category -> SHOULD SUCCEED (200)
  const renamedCatName = `Archives Arrêtés & Décrets ${Date.now()}`;
  const adminUpdate = await apiRequest('PUT', `/api/archive-categories/${createdCat.id}`, {
    name: renamedCatName,
    associated_types: ['DECRET', 'ARRETE'],
    is_default_for_types: ['ARRETE']
  }, adminToken);
  assert.strictEqual(adminUpdate.status, 200, 'Admin should be able to update category');
  assert.strictEqual(adminUpdate.body.category.name, renamedCatName);
  console.log(`✅ Admin successfully renamed category to [${renamedCatName}] and updated associated types\n`);

  // 10. Document Reassignment & Deletion
  console.log('--- 10. DOCUMENT REASSIGNMENT & SAFE CATEGORY DELETION ---');
  const deleteRes = await apiRequest('DELETE', `/api/archive-categories/${createdCat.id}`, null, adminToken);
  if (deleteRes.status === 400 && deleteRes.body.document_count > 0) {
    console.log(`✅ Deletion blocked because category has ${deleteRes.body.document_count} document(s)`);
    const moveRes = await apiRequest('POST', `/api/archive-categories/${createdCat.id}/move-documents`, {
      target_category_code: 'NON_CLASSE'
    }, adminToken);
    assert.strictEqual(moveRes.status, 200, 'Documents should be moved');
    console.log(`✅ Moved ${moveRes.body.moved_count} document(s) to Non classés`);

    const finalDelete = await apiRequest('DELETE', `/api/archive-categories/${createdCat.id}`, null, adminToken);
    assert.strictEqual(finalDelete.status, 200, 'Category deletion should now succeed');
  } else {
    assert.strictEqual(deleteRes.status, 200, 'Category deletion should succeed');
  }
  console.log('✅ Category deleted successfully by Admin\n');

  console.log('================================================================');
  console.log('🎉 ALL 10 SMART ARCHIVE CATEGORY TEST SUITES PASSED PERFECTLY!');
  console.log('================================================================');
}

runSmartArchiveCategoriesTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
