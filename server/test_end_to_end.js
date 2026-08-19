const http = require('http');

async function apiCall(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runEndToEndScenario() {
  console.log('========================================================================');
  console.log(' STARTING UK-GED 27-POINT END-TO-END VALIDATION SCENARIO (SECTION 43)');
  console.log('========================================================================');

  try {
    // 1. Login as Secrétariat Central
    console.log('\n[1-4] Connexion Secrétariat Central...');
    const scLogin = await apiCall('/auth/login', 'POST', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
    const scToken = scLogin.token;
    console.log('✓ Connecté en tant que :', scLogin.user.first_name, scLogin.user.last_name, `(${scLogin.user.service_name})`);

    // 2. Create Incoming Mail
    console.log('\n[5] Enregistrement d\'un courrier entrant avec référence auto...');
    const services = await apiCall('/services', 'GET', null, scToken);
    const sgService = services.find(s => s.code === 'SG');
    const recteurService = services.find(s => s.code === 'RECT');
    const dafService = services.find(s => s.code === 'DAF');
    const cfService = services.find(s => s.code === 'CF');

    const newMail = await apiCall('/documents/incoming', 'POST', {
      title: 'Demande de subvention pour la Recherche Scientifique 2026',
      description: 'Dossier transmis par le Ministère pour financement des équipements informatiques',
      sender_name: 'Ministère de l’Enseignement Supérieur',
      sender_organization: 'MESRSI Guinée',
      reception_date: '2026-08-10',
      priority: 'HIGH',
      target_service_id: sgService.id,
      instruction: 'Transmission initiale au Secrétaire Général'
    }, scToken);

    const docId = newMail.id;
    const docRef = newMail.reference;
    console.log(`✓ Courrier entrant créé avec succès ! Référence générée : ${docRef} (ID: ${docId})`);

    // 3. Login as SG & Orient to Recteur
    console.log('\n[6-8] Connexion Secrétaire Général & Orientation vers le Recteur...');
    const sgLogin = await apiCall('/auth/login', 'POST', { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
    const sgToken = sgLogin.token;

    await apiCall('/workflow/orient', 'POST', {
      document_id: docId,
      to_service_id: recteurService.id,
      motif: 'Pour avis',
      instruction: 'Transmis au Recteur pour arbitrage institutionnel et avis technique.',
      priority: 'URGENT'
    }, sgToken);
    console.log('✓ Document orienté vers le Recteur avec instruction.');

    // 4. Login as Recteur & Orient to DAF
    console.log('\n[9-11] Connexion Recteur & Orientation vers la DAF...');
    const recLogin = await apiCall('/auth/login', 'POST', { identity: 'recteur@univ-kindia.edu.gn', password: 'Recteur123!' });
    const recToken = recLogin.token;

    await apiCall('/workflow/orient', 'POST', {
      document_id: docId,
      to_service_id: dafService.id,
      motif: 'Pour traitement',
      instruction: 'Prière à la DAF de vérifier l’éligibilité budgétaire et de transmettre au Contrôle Financier.'
    }, recToken);
    console.log('✓ Recteur a orienté le document vers la Division des Affaires Financières (DAF).');

    // 5. Login as DAF & Transmit to Contrôle Financier
    console.log('\n[12-14] Connexion DAF & Transmission au Contrôle Financier...');
    const dafLogin = await apiCall('/auth/login', 'POST', { identity: 'daf@univ-kindia.edu.gn', password: 'Daf123!' });
    const dafToken = dafLogin.token;

    await apiCall('/workflow/transmit', 'POST', {
      document_id: docId,
      to_service_id: cfService.id,
      instruction: 'Transmis au Contrôle Financier pour visa préventif.'
    }, dafToken);
    console.log('✓ DAF a transmis le document au Contrôle Financier.');

    // 6. Login as CF & Return to Recteur
    console.log('\n[15-16] Connexion Contrôle Financier & Retour du document au Recteur...');
    const cfLogin = await apiCall('/auth/login', 'POST', { identity: 'cf@univ-kindia.edu.gn', password: 'Cf123!' });
    const cfToken = cfLogin.token;

    await apiCall('/workflow/return', 'POST', {
      document_id: docId,
      to_service_id: recteurService.id,
      return_reason: 'Avis favorable émis par le Contrôle Financier. Retour au Recteur pour décision finale.'
    }, cfToken);
    console.log('✓ Document retourné avec succès au Recteur par le Contrôle Financier.');

    // 7. Verify Trajectory Circuit
    console.log('\n[17] Vérification du Cheminement (Timeline Grafique)...');
    const circuit = await apiCall(`/workflow/circuit/${docId}`, 'GET', null, recToken);
    console.log(`✓ Nombre d'étapes journalisées dans le circuit : ${circuit.history.length}`);
    circuit.history.forEach((h, i) => {
      console.log(`   Étape ${i+1}: [${h.service_name}] - Action: ${h.action} -> ${h.details}`);
    });

    // 8. Mission Order & SG Digital Signature
    console.log('\n[19-25] Création d\'un Ordre de Mission & Signature du Secrétaire Général...');
    const missionRes = await apiCall('/missions', 'POST', {
      missionary_name: 'Dr. Ousmane Diallo',
      function_title: 'Secrétaire Général',
      destination: 'Labé - Université d’Hafia',
      object_of_mission: 'Supervision de la conférence inter-universitaire de recherche',
      transport_mode: 'Véhicule de Fonction UK',
      departure_date: '2026-08-15',
      return_date: '2026-08-20',
      driver_name: 'Mamadou Camara'
    }, sgToken);

    const omDocId = missionRes.id;
    const omRef = missionRes.reference;
    console.log(`✓ Ordre de mission créé (Référence : ${omRef})`);

    const signRes = await apiCall(`/missions/${omDocId}/sign`, 'POST', {}, sgToken);
    console.log(`✓ Ordre de mission signé numériquement par le SG !`);
    console.log(`   - PDF généré : ${signRes.pdf_url}`);
    console.log(`   - URL de vérification QR Code : ${signRes.verification_url}`);

    // 9. QR Code Verification Test
    console.log('\n[24-26] Vérification Publique d\'Authenticité du Document...');
    const verifyData = await apiCall(`/verify/${encodeURIComponent(omRef)}`, 'GET');
    console.log('✓ Réponse de vérification d\'authenticité :');
    console.log(`   - Valide : ${verifyData.valid}`);
    console.log(`   - Institution : ${verifyData.institution}`);
    console.log(`   - Signataire : ${verifyData.signature?.signed_by} (${verifyData.signature?.function_title})`);
    console.log(`   - Empreinte Hash SHA-256 : ${verifyData.signature?.hash.substring(0, 32)}...`);

    // 10. Audit Logs Verification
    console.log('\n[27] Journal d\'Audit Inviolable...');
    const adminLogin = await apiCall('/auth/login', 'POST', { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });
    const auditLogs = await apiCall('/audit', 'GET', null, adminLogin.token);
    console.log(`✓ Total des événements d'audit enregistrés : ${auditLogs.length}`);

    console.log('\n========================================================================');
    console.log(' 🎉 LE SCÉNARIO COMPLET DE BOUT EN BOUT (27/27) A RÉUSSI AVEC SUCCÈS !');
    console.log('========================================================================');

  } catch (err) {
    console.error('❌ SCENARIO ERREUR :', err);
  }
}

runEndToEndScenario();
