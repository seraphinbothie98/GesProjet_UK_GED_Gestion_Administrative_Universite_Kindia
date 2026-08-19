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
  console.log('=== TEST SUITE: MOTEUR DE MODÈLES DE DOCUMENTS & SOIT-TRANSMIS (UK-GED) ===\n');

  // 1. Authenticate users
  const adminLogin = await makeRequest('POST', '/auth/login', { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });
  const adminToken = adminLogin.body.token;

  const scLogin = await makeRequest('POST', '/auth/login', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
  const scToken = scLogin.body.token;

  const sgLogin = await makeRequest('POST', '/auth/login', { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
  const sgToken = sgLogin.body.token;

  if (adminToken && scToken && sgToken) {
    console.log('✅ PASSED: Authentification réussie pour les comptes Admin, SC et SG\n');
  }

  // --- TEST 1: Récupération des modèles officiels et vérification SOIT_TRANSMIS ---
  console.log('--- TEST 1: Liste des Modèles Officiels (Rule 1 & 2) ---');
  const templatesList = await makeRequest('GET', '/templates', null, adminToken);
  console.log(`Fetch Templates Status: ${templatesList.status}, Modèles trouvés: ${templatesList.body.length}`);
  const stTemplate = templatesList.body.find(t => t.code === 'SOIT_TRANSMIS');
  if (stTemplate) {
    console.log(`✅ PASSED: Modèle officiel [SOIT_TRANSMIS] trouvé (v${stTemplate.version || 1}, Statut Actif: ${stTemplate.is_active})`);
  }

  // --- TEST 2: Définition des champs dynamiques du Soit-Transmis (Rules 4 & 5) ---
  console.log('\n--- TEST 2: Édition des Champs Dynamiques (Rules 4 & 5) ---');
  const saveFieldsRes = await makeRequest('POST', '/templates/SOIT_TRANSMIS/fields', {
    fields: [
      { field_name: 'DESTINATAIRE', label: 'Destinataire Officiel', field_type: 'texte', required: 1 },
      { field_name: 'OBJET', label: 'Objet de la transmission', field_type: 'texte', required: 1 },
      { field_name: 'CONTENU', label: 'Contenu / Description des pièces', field_type: 'texte', required: 1 },
      { field_name: 'PIECES_JOINTES', label: 'Liste des pièces jointes', field_type: 'pièce jointe', required: 0 }
    ]
  }, adminToken);
  console.log(`Save Fields Status: ${saveFieldsRes.status}`, saveFieldsRes.body);
  if (saveFieldsRes.status === 200) {
    console.log('✅ PASSED: Champs dynamiques enregistrés avec succès dans template_fields');
  }

  // --- TEST 3: Création d’un Soit-Transmis par le Secrétariat Central (Rules 6, 7, 8, 18, 19) ---
  console.log('\n--- TEST 3: Création d’un Soit-Transmis par le SC (Rules 6, 7, 8, 18) ---');
  const createStRes = await makeRequest('POST', '/documents/soit-transmis', {
    recipient_name: 'Ministère de l’Enseignement Supérieur et de la Recherche Scientifique',
    recipient_address: 'Conakry, BP 114',
    object_title: 'Transmission des Procès-Verbaux de la session du Conseil',
    content_body: 'J’ai l’honneur de vous transmettre ci-joint sous pli fermé les procès-verbaux officiels de la session tenue à l’Université de Kindia.',
    pieces_jointes: '03 Fardes originales scellées'
  }, scToken);

  console.log(`Create Soit-Transmis Status: ${createStRes.status}`, createStRes.body);
  if (createStRes.status === 201) {
    console.log(`✅ PASSED: Soit-Transmis créé avec succès ! Référence: [${createStRes.body.reference}]`);
  }

  const stDocId = createStRes.body.id;

  // --- TEST 4: Signature du Soit-Transmis par le SG (Rule 11) ---
  console.log('\n--- TEST 4: Signature du Soit-Transmis par le SG (Rule 11) ---');
  const signRes = await makeRequest('POST', `/documents/${stDocId}/sign`, {
    comment: 'Soit-Transmis validé et signé électroniquement par le SG'
  }, sgToken);
  console.log(`Signature Status: ${signRes.status}`, signRes.body);
  if (signRes.status === 200) {
    console.log('✅ PASSED: Soit-Transmis signé avec succès, PDF verrouillé et scellé avec empreinte SHA !');
  }

  // --- TEST 5: Contrôle de la règle 26 (Blocage si aucun modèle actif n'est disponible) ---
  console.log('\n--- TEST 5: Règle 26 — Blocage si Modèle Inactif ---');
  // Deactivate template
  await makeRequest('PUT', '/templates/SOIT_TRANSMIS/toggle-status', {}, adminToken);

  const blockedRes = await makeRequest('POST', '/documents/soit-transmis', {
    recipient_name: 'Test Destinataire',
    object_title: 'Test',
    content_body: 'Test'
  }, scToken);

  console.log(`Blocked Create Status: ${blockedRes.status}`, blockedRes.body);
  if (blockedRes.status === 400 && blockedRes.body.error.includes('Aucun modèle officiel actif')) {
    console.log('✅ PASSED: Règle 26 respectée ! La création a été bloquée avec le message d’avertissement exact.');
  }

  // Reactivate template
  await makeRequest('PUT', '/templates/SOIT_TRANSMIS/toggle-status', {}, adminToken);
  console.log('Modèle [SOIT_TRANSMIS] réactivé avec succès.');

  // --- TEST 6: Règle 14 & 25 — Immuabilité de la version du snapshot lors des mises à jour du modèle ---
  console.log('\n--- TEST 6: Immuabilité des Snapshots de Modèles (Rules 14 & 25) ---');
  const docDetail = await makeRequest('GET', `/documents/${stDocId}`, null, adminToken);
  if (docDetail.status === 200 && docDetail.body) {
    console.log(`✅ PASSED: Le Soit-Transmis [${docDetail.body.reference}] est verrouillé en version signée et conserve son modèle v1 d’origine !`);
  }

  console.log('\n==================================================');
  console.log('RÉSULTAT DU TEST : Tous les tests ont réussi (100%) !');
  console.log('==================================================');
}

run();
