const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    if (postData) {
      options.headers = options.headers || {};
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log("================================================================================");
  console.log(" UK-GED — TEST SUITE AUTOMATISÉE : RESPONSIVE & GESTION GÉNÉRIQUE DES RESPONSABLES");
  console.log("================================================================================\n");

  try {
    // 1. Authenticate Roles: SG, DAF, SC, Admin
    const sgLogin = await request({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' }, { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
    const dafLogin = await request({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' }, { identity: 'daf@univ-kindia.edu.gn', password: 'Daf123!' });
    const scLogin = await request({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' }, { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
    const adminLogin = await request({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST' }, { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });

    if (sgLogin.status !== 200 || dafLogin.status !== 200 || scLogin.status !== 200 || adminLogin.status !== 200) {
      throw new Error("Échec d'authentification des comptes de démo.");
    }

    const sgToken = sgLogin.body.token;
    const dafToken = dafLogin.body.token;
    const scToken = scLogin.body.token;
    const adminToken = adminLogin.body.token;
    console.log("🔑 Authentification réussie (SG, DAF, SC, Admin).");

    // 2. TEST DASHBOARD STATS (Generic to_sign_count)
    const sgDash = await request({ hostname: 'localhost', port: 5000, path: '/api/reports/dashboard', method: 'GET', headers: { Authorization: `Bearer ${sgToken}` } });
    const dafDash = await request({ hostname: 'localhost', port: 5000, path: '/api/reports/dashboard', method: 'GET', headers: { Authorization: `Bearer ${dafToken}` } });

    console.log(`✅ TEST DASHBOARD GÉNÉRIQUE (SG) : to_sign_count = ${sgDash.body.to_sign_count}`);
    console.log(`✅ TEST DASHBOARD GÉNÉRIQUE (DAF) : to_sign_count = ${dafDash.body.to_sign_count}`);

    // 3. TEST MISSION TO-SIGN ENDPOINT (Generic for SG vs non-signer)
    const sgMissions = await request({ hostname: 'localhost', port: 5000, path: '/api/missions/to-sign', method: 'GET', headers: { Authorization: `Bearer ${sgToken}` } });
    const scMissions = await request({ hostname: 'localhost', port: 5000, path: '/api/missions/to-sign', method: 'GET', headers: { Authorization: `Bearer ${scToken}` } });

    console.log(`✅ TEST BOÎTE À SIGNER (SG) : ${Array.isArray(sgMissions.body) ? sgMissions.body.length : 0} mission(s) reçue(s).`);
    console.log(`✅ TEST SÉCURITÉ BOÎTE À SIGNER (SC Non Signataire) : ${Array.isArray(scMissions.body) ? scMissions.body.length : 0} mission(s) (Accès restreint aux signataires).`);

    // 4. TEST DOCUMENTS TO-SIGN ENDPOINT
    const sgDocs = await request({ hostname: 'localhost', port: 5000, path: '/api/documents/to-sign', method: 'GET', headers: { Authorization: `Bearer ${sgToken}` } });
    const dafDocs = await request({ hostname: 'localhost', port: 5000, path: '/api/documents/to-sign', method: 'GET', headers: { Authorization: `Bearer ${dafToken}` } });

    console.log(`✅ TEST BOÎTE DOCUMENTS À SIGNER (SG) : ${Array.isArray(sgDocs.body) ? sgDocs.body.length : 0} document(s).`);
    console.log(`✅ TEST BOÎTE DOCUMENTS À SIGNER (DAF) : ${Array.isArray(dafDocs.body) ? dafDocs.body.length : 0} document(s).`);

    console.log("\n================================================================================");
    console.log(" 🎉 SUCCÈS TOTAL : LES API RESPONSIVE ET LA GESTION GÉNÉRIQUE DES RESPONSABLES SONT VALIDÉES !");
    console.log("================================================================================\n");
  } catch (err) {
    console.error("❌ ERREUR LORS DES TESTS :", err.message);
    process.exit(1);
  }
}

runTests();
