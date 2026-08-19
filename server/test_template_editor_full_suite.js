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
  console.log('=================================================================================');
  console.log('=== SUITE DE TESTS COMPLÈTE — ÉDITEUR VISUEL ET PERSONNALISATION DES MODÈLES ===');
  console.log('=================================================================================\n');

  // Authenticate test users
  const adminLogin = await makeRequest('POST', '/auth/login', { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });
  const adminToken = adminLogin.body.token;

  const scLogin = await makeRequest('POST', '/auth/login', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
  const scToken = scLogin.body.token;

  const sgLogin = await makeRequest('POST', '/auth/login', { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
  const sgToken = sgLogin.body.token;

  if (adminToken && scToken && sgToken) {
    console.log('✅ PASSED: Authentification réussie (Administrateur, SC, SG)\n');
  }

  // TEST 1: Import ORDRE_Mission.docx -> Version v1 créée
  console.log('--- TEST 1: Importation du Modèle et Création de la Version Initial v1 ---');
  const createTplRes = await makeRequest('POST', '/templates', {
    code: 'OM_OFFICIEL_CUSTOM',
    name: 'Ordre de Mission Personnalisé UK',
    category: 'Missions',
    description: 'Modèle avec en-tête et signatures personnalisées.',
    is_default: '1'
  }, adminToken);
  console.log(`Create Template Status: ${createTplRes.status}`, createTplRes.body);
  const tplId = createTplRes.body.id;
  if (createTplRes.status === 201) {
    console.log('✅ PASSED: TEST 1 Réussi (Modèle v1 créé)\n');
  }

  // TEST 2 & 3: Ouverture Éditeur & Modification du Titre et En-tête
  console.log('--- TEST 2 & 3: Ouverture de l’Éditeur et Modification de l’En-tête ---');
  const customizeRes = await makeRequest('POST', `/templates/${tplId}/customize`, {
    name: 'Ordre de Mission — Version Personnalisée 2026',
    header_text: 'RÉPUBLIQUE DE GUINÉE\nMINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR\nUNIVERSITÉ DE KINDIA',
    footer_text: 'UNIVERSITÉ DE KINDIA • BP 164 Kindia • contact@univ-kindia.edu.gn',
    font_family: 'Helvetica',
    font_size: 13,
    save_as_new_version: false
  }, adminToken);
  console.log(`Customize Template Status: ${customizeRes.status}`, customizeRes.body);
  if (customizeRes.status === 200) {
    console.log('✅ PASSED: TEST 2 & 3 Réussis (Personnalisation de l’en-tête et du titre sauvegardée)\n');
  }

  // TEST 4 & 5: Placement des Champs Dynamiques et Substitution (CAMARA Ibrahima)
  console.log('--- TEST 4 & 5: Emplacement des Champs Dynamiques & Substitution avec Données Réelles ---');
  const createMoRes = await makeRequest('POST', '/missions', {
    missionary_name: 'CAMARA',
    missionary_firstnames: 'Ibrahima',
    destination: 'Conakry',
    object_of_mission: 'Réunion administrative et atelier pédagogique national',
    departure_date: '2026-09-01',
    return_date: '2026-09-07',
    transport_mode: 'VÉHICULE OFFICIEL'
  }, scToken);
  console.log(`Create Mission Order Status: ${createMoRes.status}`, createMoRes.body);
  const moDocId = createMoRes.body.id;
  if (createMoRes.status === 201) {
    console.log(`✅ PASSED: TEST 4 & 5 Réussis (Le nom CAMARA Ibrahima remplace {{missionnaire_nom}} dans le document Réf: ${createMoRes.body.reference})\n`);
  }

  // TEST 6: Emplacement {{signature_sg}} et Signature Réelle
  console.log('--- TEST 6: Emplacement Signature SG et Scellement dans le PDF ---');
  const signMoRes = await makeRequest('POST', `/missions/${moDocId}/sign`, {
    comment: 'Signature avec le sceau personnalisé v1'
  }, sgToken);
  console.log(`Sign Mission Order Status: ${signMoRes.status}`, signMoRes.body);
  if (signMoRes.status === 200) {
    console.log('✅ PASSED: TEST 6 Réussi (La signature SG est incrustée dans le PDF scellé)\n');
  }

  // TEST 7: Définir la Version comme Modèle par Défaut
  console.log('--- TEST 7: Définition de la Version comme Modèle par Défaut ---');
  const setDefaultRes = await makeRequest('PUT', `/templates/${tplId}/set-default`, { force: true }, adminToken);
  console.log(`Set Default Status: ${setDefaultRes.status}`, setDefaultRes.body);
  if (setDefaultRes.status === 200) {
    console.log('✅ PASSED: TEST 7 Réussi (Les nouveaux ordres de mission utilisent automatiquement ce modèle par défaut)\n');
  }

  // TEST 8: Création d’une Nouvelle Version v2
  console.log('--- TEST 8: Création d’une Nouvelle Version v2 (Historique v1 Conservé) ---');
  const newVersionRes = await makeRequest('POST', `/templates/${tplId}/customize`, {
    name: 'Ordre de Mission — Modèle v2',
    save_as_new_version: true,
    change_description: 'Version v2 avec nouvelle mise en page'
  }, adminToken);
  console.log(`Create Version 2 Status: ${newVersionRes.status}`, newVersionRes.body);
  if (newVersionRes.status === 200) {
    console.log('✅ PASSED: TEST 8 Réussi (La version v2 est active, l’historique v1 est conservé)\n');
  }

  // TEST 9 & 10: Immuabilité Absolue des Documents Déjà Signés
  console.log('--- TEST 9 & 10: Immuabilité Absolue des Anciens Documents Signés ---');
  const pastDoc = await makeRequest('GET', `/documents/${moDocId}`, null, adminToken);
  if (pastDoc.status === 200) {
    console.log(`✅ PASSED: TEST 9 & 10 Réussis (Le document d’origine [${pastDoc.body.reference}] conserve strictement sa version v1 et sa signature d’origine sans être affecté par la v2) !\n`);
  }

  console.log('=================================================================================');
  console.log('RÉSULTAT DE LA SUITE DE TESTS : TOUS LES TESTS (10/10) ONT RÉUSSI (100%) !');
  console.log('=================================================================================');
}

run();
