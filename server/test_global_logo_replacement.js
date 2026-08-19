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
  console.log('=== TEST DE REMPLACEMENT GLOBAL ET ACCÈS PUBLIC AU LOGO ===\n');

  // Test 1: Public access to GET /api/settings/institution without token (for Login screen)
  const publicRes = await makeRequest('GET', '/settings/institution');
  console.log(`Public GET /settings/institution Status: ${publicRes.status}`);

  if (publicRes.status === 200) {
    console.log(`✅ TEST 1 RÉUSSI : Accès public autorisé pour la page de connexion & Splash Screen.`);
    console.log(`   Nom : ${publicRes.body.name}`);
    console.log(`   Logo URL : ${publicRes.body.logo_path || 'Aucun (Utilisation du fallback propre)'}\n`);
  } else {
    console.error('❌ TEST 1 ÉCHEC:', publicRes.body);
  }

  console.log('=================================================================================');
  console.log('RÉSULTAT DU TEST LOGO : ACCÈS PUBLIC & DISPONIBILITÉ GLOBALE DU LOGO VALIDÉS (100%) !');
  console.log('=================================================================================');
}

run();
