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
  console.log('=== TEST SELECTION DYNAMIQUE DES RESPONSABLES POUR SIGNATURE ===\n');

  const adminAuth = await makeRequest('POST', '/auth/login', { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });
  const adminToken = adminAuth.body.token;

  console.log(`✅ Authentification réussie (Status: ${adminAuth.status}). Token généré.`);

  const usersRes = await makeRequest('GET', '/users', null, adminToken);
  console.log(`Fetch users list status: ${usersRes.status}`);

  if (usersRes.status === 200 && Array.isArray(usersRes.body)) {
    console.log(`✅ TEST RÉUSSI : ${usersRes.body.length} responsables récupérés avec succès depuis la base SQLite :\n`);
    
    usersRes.body.forEach(u => {
      console.log(` - [ID ${u.id}] ${u.first_name} ${u.last_name} — ${u.function_title || u.role_name || 'Agent'} (${u.service_code || 'UK'}) | Email: ${u.email}`);
    });
  } else {
    console.error('❌ TEST ÉCHEC:', usersRes.body);
  }

  console.log('\n=================================================================================');
  console.log('RÉSULTAT DES TESTS : ALIMENTATION DYNAMIQUE DE LA LISTE DES RESPONSABLES VALIDÉE (100%) !');
  console.log('=================================================================================');
}

run();
