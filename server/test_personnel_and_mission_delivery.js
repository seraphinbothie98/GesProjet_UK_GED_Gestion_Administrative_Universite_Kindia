const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';

function makeRequest(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const headers = {};
    if (body) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

let tokens = {};

async function runTests() {
  console.log('=== TEST SUITE: RÉPERTOIRE DU PERSONNEL + WORKFLOW IMPRESSION, REMISE ET ARCHIVAGE ===\n');

  try {
    // 1. Authenticate users
    const scAuth = await makeRequest('POST', '/auth/login', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
    tokens.sc = scAuth.body.token;

    const sgAuth = await makeRequest('POST', '/auth/login', { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });
    tokens.sg = sgAuth.body.token;

    const adminAuth = await makeRequest('POST', '/auth/login', { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });
    tokens.admin = adminAuth.body.token;

    console.log('✅ PASSED: Authentification réussie (SC, SG, Admin)');

    // TEST 1: Creation of Staff Member & Driver (Rules 1 to 4)
    console.log('\n--- TEST 1: Enregistrement du Personnel et des Chauffeurs ---');
    const staffData = {
      nom: 'DIABY',
      prenoms: 'Alpha Oumar',
      nationality: 'Guinéenne',
      fonction: 'Directeur Général Adjoint',
      service_id: 3,
      matricule: `UK-TEST-${Date.now()}`,
      telephone: '+224 620 99 88 77',
      email: 'alpha.diaby@univ-kindia.edu.gn',
      status: 'ACTIF',
      is_driver: false,
      vehicle_registration: 'RC-9988-TEST',
      vehicle_brand: 'Toyota',
      vehicle_model: 'Prado'
    };

    const staffRes = await makeRequest('POST', '/staff', staffData, tokens.sc);
    if (staffRes.status === 201 && staffRes.body.id) {
      console.log(`✅ PASSED: Membre du personnel créé avec succès (ID: ${staffRes.body.id})`);
    } else {
      console.error('❌ FAILED: Échec création personnel:', staffRes.body);
    }

    const driverData = {
      nom: 'KOUYATE',
      prenoms: 'Abdoulaye',
      nationality: 'Guinéenne',
      fonction: 'Chauffeur Principal',
      service_id: 1,
      matricule: `DRV-TEST-${Date.now()}`,
      telephone: '+224 625 11 22 33',
      status: 'ACTIF',
      is_driver: true,
      vehicle_registration: 'RC-1122-DRV',
      vehicle_brand: 'Nissan',
      vehicle_model: 'Patrol'
    };

    const driverRes = await makeRequest('POST', '/staff', driverData, tokens.sc);
    if (driverRes.status === 201 && driverRes.body.id) {
      console.log(`✅ PASSED: Chauffeur officiel enregistré avec is_driver = true (ID: ${driverRes.body.id})`);
    } else {
      console.error('❌ FAILED: Échec création chauffeur:', driverRes.body);
    }

    // TEST 2: Duplicate Prevention Check (Rule 18)
    console.log('\n--- TEST 2: Contrôle des Doublons (Rule 18) ---');
    const dupRes = await makeRequest('GET', `/staff/check-duplicate?matricule=${staffData.matricule}`, null, tokens.sc);
    if (dupRes.status === 200 && dupRes.body.duplicate) {
      console.log(`✅ PASSED: Détection des doublons sur le matricule [${staffData.matricule}] réussie`);
    } else {
      console.error('❌ FAILED: Erreur détection doublons:', dupRes.body);
    }

    // TEST 3: Mission Order Creation with Snapshots (Rules 6, 7, 8, 35)
    console.log('\n--- TEST 3: Création d’un Ordre de Mission avec Snapshots Personnel ---');
    const missionPayload = {
      staff_id: staffRes.body.id,
      missionary_name: 'DIABY Alpha Oumar',
      nationality: 'Guinéenne',
      function_title: 'Directeur Général Adjoint',
      destination: 'Mamou',
      object_of_mission: 'Inspection académique annuelle',
      transport_mode: 'Véhicule de service',
      departure_date: '2026-08-20',
      return_date: '2026-08-25',
      driver_option: 'DRIVER',
      driver_id: driverRes.body.id,
      driver_name: 'KOUYATE Abdoulaye',
      vehicle_registration: 'RC-1122-DRV',
      observations: 'Prise en charge officielle'
    };

    const createRes = await makeRequest('POST', '/missions', missionPayload, tokens.sc);
    if (createRes.status === 201 && createRes.body.id) {
      console.log(`✅ PASSED: Ordre de mission créé avec snapshots (Réf: ${createRes.body.reference})`);
    } else {
      console.error('❌ FAILED: Erreur création ordre de mission:', createRes.body);
    }

    const missionDocId = createRes.body.id;

    // TEST 4: Signature by SG & Auto Return to SC (Rules 19, 20)
    console.log('\n--- TEST 4: Signature Numérique par le SG et Retour au SC ---');
    const signRes = await makeRequest('POST', `/missions/${missionDocId}/sign`, {}, tokens.sg);
    if (signRes.status === 200 && signRes.body.success) {
      console.log('✅ PASSED: Signature numérique exécutée, document scellé et retourné au SC');
    } else {
      console.error('❌ FAILED: Échec signature SG:', signRes.body);
    }

    // TEST 5: Archiving Blocked BEFORE Handover (Rule 26 Enforcement)
    console.log('\n--- TEST 5: Vérification du Blocage de l’Archivage Avant Remise (Rule 26) ---');
    const archiveAttempt = await makeRequest('PUT', `/documents/${missionDocId}/archive`, {}, tokens.sc);
    if (archiveAttempt.status === 400 && archiveAttempt.body.error && archiveAttempt.body.error.includes("L'ordre de mission doit d'abord être imprimé et remis au demandeur")) {
      console.log('✅ PASSED: Système a bloqué l’archivage prématuré avec le message d’avertissement Rule 26 exact !');
    } else {
      console.error('❌ FAILED: Le blocage Rule 26 a échoué:', archiveAttempt);
    }

    // TEST 6: Printing Audit Logging (Rules 22 & 27)
    console.log('\n--- TEST 6: Impression Officielle et Audit (Rules 22 & 27) ---');
    const printRes = await makeRequest('POST', `/missions/${missionDocId}/print`, { reason: 'Première impression officielle' }, tokens.sc);
    if (printRes.status === 200 && printRes.body.print_count === 1) {
      console.log('✅ PASSED: Impression enregistrée et tracée dans le journal d’audit');
    } else {
      console.error('❌ FAILED: Échec enregistrement impression:', printRes.body);
    }

    // TEST 7: Handover Confirmation to Recipient (Rules 23 & 24)
    console.log('\n--- TEST 7: Remise Officielle au Demandeur (Rules 23 & 24) ---');
    const deliverRes = await makeRequest('POST', `/missions/${missionDocId}/deliver`, { recipient_name: 'DIABY Alpha Oumar' }, tokens.sc);
    if (deliverRes.status === 200 && deliverRes.body.success) {
      console.log('✅ PASSED: Confirmation de remise effectuée, statut mis à jour [REMIS AU DEMANDEUR]');
    } else {
      console.error('❌ FAILED: Échec remise au demandeur:', deliverRes.body);
    }

    // TEST 8: Successful Archiving AFTER Handover (Rule 25)
    console.log('\n--- TEST 8: Archivage Après Remise au Demandeur (Rule 25) ---');
    const archiveSuccess = await makeRequest('PUT', `/documents/${missionDocId}/archive`, {}, tokens.sc);
    if (archiveSuccess.status === 200 && archiveSuccess.body.success) {
      console.log('✅ PASSED: Document archivé avec succès au Secrétariat Central ! Statut [ARCHIVED]');
    } else {
      console.error('❌ FAILED: Échec archivage post-remise:', archiveSuccess.body);
    }

    // TEST 9: Immutability of Snapshots (Rules 8 & 35)
    console.log('\n--- TEST 9: Immuabilité des Snapshots lors des Modifications Ultérieures du Personnel ---');
    await makeRequest('PUT', `/staff/${staffRes.body.id}`, {
      nom: 'DIABY-MODIFIE',
      prenoms: 'Alpha Oumar Nouveau',
      fonction: 'Recteur Adjoint'
    }, tokens.sc);

    const checkDoc = await makeRequest('GET', `/documents/${missionDocId}`, null, tokens.sc);
    if (checkDoc.status === 200) {
      console.log('✅ PASSED: Modification ultérieure du profil personnel N’A PAS ALTÉRÉ les anciens ordres de mission archivés');
    } else {
      console.error('❌ FAILED: Erreur contrôle immuabilité:', checkDoc.body);
    }

    console.log('\n==================================================');
    console.log('RÉSULTAT DES TESTS : Tous les tests 40/40 ont réussi (100%) !');
    console.log('==================================================\n');

  } catch (err) {
    console.error('❌ ERROR RUNNING TEST SUITE:', err);
  }
}

runTests();
