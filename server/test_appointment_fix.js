const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

function makeRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== TEST CORRECTION APPOINTMENTS & PUBLIC ENDPOINTS ===');

  // Login
  const loginRes = await makeRequest('POST', '/auth/login', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
  const token = loginRes.body.token;

  // Test 1: Authenticated appointment creation
  const authRdv = await makeRequest('POST', '/appointments', {
    requester_first_name: 'Mariama',
    requester_last_name: 'CAMARA',
    requester_email: 'mariama@univ-kindia.edu.gn',
    requester_phone: '+224621000000',
    responsible_id: 3, // SG
    subject: 'Entretien urgent',
    motif: 'Discussion sur la réorganisation des courriers',
    requested_date: '2026-08-25',
    requested_start_time: '11:00',
    duration: 30
  }, token);

  console.log('Test 1 (Authenticated Appointment):', authRdv.status, authRdv.body);
  if (authRdv.status === 201) console.log('✅ PASSED: Création rendez-vous authentifié réussie !');
  else console.error('❌ FAILED:', authRdv.body);

  // Test 2: Public responsibles list
  const publicResp = await makeRequest('GET', '/appointments/public/responsibles');
  console.log('Test 2 (Public Responsibles):', publicResp.status, 'Count:', publicResp.body.length);
  if (publicResp.status === 200 && publicResp.body.length > 0) console.log('✅ PASSED: Liste publique des responsables récupérée !');

  // Test 3: Public appointment creation
  const publicRdv = await makeRequest('POST', '/appointments/public', {
    requester_first_name: 'Jean',
    requester_last_name: 'DUPONT',
    requester_email: 'jean.dupont@partner.org',
    requester_phone: '+224628887766',
    requester_organization: 'Partenaire Externe',
    responsible_id: 3,
    subject: 'Demande de partenariat',
    motif: 'Présentation du projet de numérisation',
    requested_date: '2026-08-26',
    requested_start_time: '14:00',
    duration: 30
  });

  console.log('Test 3 (Public Appointment):', publicRdv.status, publicRdv.body);
  if (publicRdv.status === 201) console.log('✅ PASSED: Création rendez-vous public sans connexion réussie !');
  else console.error('❌ FAILED:', publicRdv.body);
}

run();
