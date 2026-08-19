const http = require('http');

function post(urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: urlPath,
      method: 'POST',
      headers
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resBody);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(urlPath, token) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: urlPath,
      method: 'GET',
      headers
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resBody);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runTest() {
  console.log('========================================================');
  console.log(' TEST DU WORKFLOW DES ORDRES DE MISSION & SIGNATURE SG ');
  console.log('========================================================\n');

  // 1. SC Login
  console.log('[1/7] Connexion Secrétariat Central (sc@univ-kindia.edu.gn)...');
  const scLogin = await post('/api/auth/login', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
  if (scLogin.status !== 200 || !scLogin.data.token) {
    throw new Error('Échec de la connexion SC: ' + JSON.stringify(scLogin.data));
  }
  const scToken = scLogin.data.token;
  console.log('  -> Succès. Token SC obtenu.');

  // 2. SC Creates Mission Order
  console.log('\n[2/7] Secrétariat Central : Création de l’Ordre de Mission personnalisé...');
  const newOM = {
    missionary_name: 'DIALLO Mamadou Oury',
    missionary_firstnames: 'Mamadou Oury',
    nationality: 'Guinéenne',
    function_title: 'Enseignant-Chercheur / Département Mathématiques',
    matricule: 'UK-EC-982',
    destination: 'Mamou - Centre Universitaire',
    object_of_mission: 'Supervision pédagogique des examens de session principale 2026',
    transport_mode: 'Véhicule de service UK',
    departure_date: '2026-08-25',
    return_date: '2026-08-29',
    driver_option: 'DRIVER',
    driver_name: 'Camara Aboubacar (Chauffeur Officiel UK)',
    vehicle_registration: 'RC-9988-K',
    observations: 'Prise en charge carburant selon barème officiel de l’Université de Kindia'
  };

  const createRes = await post('/api/missions', newOM, scToken);
  if (createRes.status !== 201 || !createRes.data.id) {
    throw new Error('Échec de création OM: ' + JSON.stringify(createRes.data));
  }
  const omDocId = createRes.data.id;
  const omRef = createRes.data.reference;
  console.log(`  -> Succès ! Ordre de Mission créé. ID: ${omDocId}, Réf: ${omRef}`);

  // 3. SG Login
  console.log('\n[3/7] Connexion Secrétaire Général (sg@univ-kindia.edu.gn)...');
  const sgLogin = await post('/api/auth/login', { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
  if (sgLogin.status !== 200 || !sgLogin.data.token) {
    throw new Error('Échec de la connexion SG: ' + JSON.stringify(sgLogin.data));
  }
  const sgToken = sgLogin.data.token;
  console.log('  -> Succès. Token SG obtenu.');

  // 4. SG checks To-Sign list
  console.log('\n[4/7] Secrétaire Général : Consultation de la boîte à signer...');
  const toSignRes = await get('/api/missions/to-sign', sgToken);
  if (toSignRes.status !== 200 || !Array.isArray(toSignRes.data)) {
    throw new Error('Échec get to-sign: ' + JSON.stringify(toSignRes.data));
  }
  const foundInToSign = toSignRes.data.find(m => m.document_id === omDocId || m.id === omDocId || m.reference === omRef);
  if (!foundInToSign) {
    throw new Error(`Ordre de mission ${omRef} non trouvé dans la boîte à signer du SG !`);
  }
  console.log(`  -> Trouvé dans la boîte à signer : ${foundInToSign.reference} - ${foundInToSign.missionary_name}`);

  // 5. SG fetches full document detail
  console.log('\n[5/7] Secrétaire Général : Chargement des détails complets du document...');
  const docDetail = await get(`/api/documents/${omDocId}`, sgToken);
  if (docDetail.status !== 200 || !docDetail.data.reference) {
    throw new Error('Échec get document detail: ' + JSON.stringify(docDetail.data));
  }
  console.log(`  -> Détails vérifiés sans page blanche. Titre: "${docDetail.data.title}", Statut: "${docDetail.data.status}"`);

  // 6. SG Signs the Mission Order
  console.log('\n[6/7] Secrétaire Général : Signature électronique officielle...');
  const signRes = await post(`/api/missions/${omDocId}/sign`, {}, sgToken);
  if (signRes.status !== 200 || !signRes.data.success) {
    throw new Error('Échec signature: ' + JSON.stringify(signRes.data));
  }
  console.log(`  -> Succès ! Message: "${signRes.data.message}"`);
  console.log(`  -> PDF signé officiel généré : ${signRes.data.pdf_url}`);

  // 7. Verification of return to SC
  console.log('\n[7/7] Vérification du retour au Secrétariat Central...');
  const signedDocDetail = await get(`/api/documents/${omDocId}`, scToken);
  if (signedDocDetail.status !== 200) {
    throw new Error('Échec get signed doc by SC: ' + JSON.stringify(signedDocDetail.data));
  }
  console.log(`  -> Statut actuel : "${signedDocDetail.data.status}" (Verrouillé: ${signedDocDetail.data.is_locked})`);
  console.log(`  -> Service détenteur : "${signedDocDetail.data.current_service_name}"`);
  console.log(`  -> Pièce signée : ${signedDocDetail.data.file_path}`);

  console.log('\n========================================================');
  console.log(' ✅ WORKFLOW COMPLET VALIDÉ AVEC SUCCÈS À 100% !');
  console.log('========================================================\n');
}

runTest().catch(err => {
  console.error('\n❌ ERREUR LORS DU TEST:', err.message);
  process.exit(1);
});
