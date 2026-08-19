const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000';

function request(method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const headers = {};

    let postData = null;
    if (body) {
      postData = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf8');
        try {
          const parsed = JSON.parse(text);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, buffer });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: null, buffer, text });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTest() {
  console.log('--- TEST DES DEUX CORRECTIONS ---');
  
  // 1. Login SC
  const scLogin = await request('POST', '/api/auth/login', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
  const token = scLogin.data.token;

  // 2. Test Receipts endpoint directly by document ID
  const docsRes = await request('GET', '/api/documents', null, token);
  const firstDoc = (docsRes.data || [])[0];
  if (firstDoc) {
    console.log(`Testing Receipt PDF for Doc #${firstDoc.id} (${firstDoc.reference})...`);
    // Direct stream without token in header (simulating iframe)
    const streamRes = await request('GET', `/api/receipts/document/${firstDoc.id}/pdf`);
    console.log(`Stream Status: ${streamRes.status}, Content-Type: ${streamRes.headers['content-type']}`);
    if (streamRes.status !== 200 || streamRes.headers['content-type'] !== 'application/pdf') {
      throw new Error('Receipt PDF stream failed!');
    }
    console.log('✅ Reçu officiel streamé en PDF avec succès !');
  }

  // 3. Test Templates retrieval for SC
  const tplRes = await request('GET', '/api/templates', null, token);
  console.log(`Templates endpoint status: ${tplRes.status}, Count: ${(tplRes.data || []).length}`);
  if (tplRes.status !== 200) {
    throw new Error('Templates retrieval failed!');
  }
  console.log('✅ Modèles récupérés avec succès pour le Secrétariat Central !');

  console.log('\n🎉 TOUS LES TESTS ONT RÉUSSI !');
}

runTest().then(() => process.exit(0)).catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
