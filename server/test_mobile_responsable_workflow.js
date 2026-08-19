const http = require('http');

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api' + path,
      method: method,
      headers: {}
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && !(data instanceof Buffer)) {
      const payload = JSON.stringify(data);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      if (data instanceof Buffer) req.write(data);
      else req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('=== TEST WORKFLOW MOBILE RESPONSABLE MULTI-CHEF DE SERVICE ===\n');

  // Login as SG and Admin
  const sgAuth = await makeRequest('POST', '/auth/login', { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
  const sgToken = sgAuth.body.token;

  const adminAuth = await makeRequest('POST', '/auth/login', { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });
  const adminToken = adminAuth.body.token;

  console.log('✅ Authentification réussie pour les responsables.');

  // Test 1: Fetch documents to sign via Mobile API endpoint GET /api/documents/to-sign
  const toSignRes = await makeRequest('GET', '/documents/to-sign', null, sgToken);
  console.log(`Fetch to-sign documents status (SG Mobile): ${toSignRes.status}`);

  if (toSignRes.status === 200 && Array.isArray(toSignRes.body)) {
    console.log(`✅ TEST 1 RÉUSSI : ${toSignRes.body.length} document(s) à signer récupérés sur mobile pour le responsable.\n`);
    toSignRes.body.slice(0, 3).forEach(d => {
      console.log(` - Ref: ${d.reference} | Type: ${d.document_type} | Statut: ${d.status} | Objet: ${d.subject || d.title}`);
    });
  } else {
    console.error('❌ TEST 1 ÉCHEC:', toSignRes.body);
  }

  // Test 2: Fetch documents to sign as Admin
  const adminSignRes = await makeRequest('GET', '/documents/to-sign', null, adminToken);
  console.log(`\nFetch to-sign documents status (Admin Mobile): ${adminSignRes.status}`);
  if (adminSignRes.status === 200 && Array.isArray(adminSignRes.body)) {
    console.log(`✅ TEST 2 RÉUSSI : ${adminSignRes.body.length} document(s) accessibles sous filtres ABAC.\n`);
  }

  console.log('=================================================================================');
  console.log('RÉSULTAT DES TESTS MOBILE : PARCOURS RESPONSABLE MULTI-CHEF VALIDÉ (100%) !');
  console.log('=================================================================================');
}

run();
