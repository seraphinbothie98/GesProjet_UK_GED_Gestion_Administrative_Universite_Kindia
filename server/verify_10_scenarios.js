const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./src/database/db');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
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
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('🏁 STARTING AUTOMATED TEST OF 10 SCENARIOS FOR MULTI-VEHICLES & DRIVERS');
  console.log('================================================================\n');

  const runId = Date.now().toString().slice(-4);

  // 1. Authenticate as SC / Admin
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identity: 'UK-ADM-001',
    password: 'Admin123!'
  });

  const token = loginRes.body.token;
  if (!token) {
    console.error('Failed to log in as admin:', loginRes.body);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Authenticate as SG for signing
  const sgLoginRes = await request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    identity: 'UK-SG-003',
    password: 'Sg123!'
  });
  const sgToken = sgLoginRes.body.token;
  const sgHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sgToken}`
  };

  // Ensure SG has active signature file linked in DB
  const sgUser = await db.get('SELECT * FROM users WHERE matricule = "UK-SG-003"');
  if (sgUser) {
    const existingSig = await db.get('SELECT * FROM user_signatures WHERE user_id = ?', [sgUser.id]);
    if (!existingSig) {
      await db.run(
        'INSERT INTO user_signatures (user_id, signature_image_path, is_active, status) VALUES (?, "uploads/signatures/sig_1787019081729_174.png", 1, "ACTIVE")',
        [sgUser.id]
      );
    }
  }

  const results = [];

  try {
    // PREPARATION: Create Test Staff, Drivers, Fleet Vehicles, Personal Vehicles
    console.log('--- PREPARATION: Setup test entities ---');
    const staffListRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/staff',
      method: 'GET',
      headers
    });
    const staffList = staffListRes.body.data || staffListRes.body || [];
    let testStaff = staffList.find(s => s.nom === 'TEST_AGENT_MULTI');
    if (!testStaff) {
      const createStaffRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/staff',
        method: 'POST',
        headers
      }, {
        nom: 'TEST_AGENT_MULTI',
        prenoms: 'Alpha Oumar',
        matricule: `UK-T-${runId}`,
        fonction: 'Chef de Département Informatique',
        personnel_category: 'ENSEIGNANT_CHERCHEUR',
        email: `alpha.test.${runId}@univ-kindia.edu.gn`,
        phone_number: '+224621000099'
      });
      testStaff = createStaffRes.body.data || createStaffRes.body;
    }
    console.log(`✓ Test Staff ready: ID=${testStaff.id}, Name=${testStaff.nom} ${testStaff.prenoms}`);

    // Create 3 Personal Vehicles for Staff
    const pv1Reg = `RC-${runId}-1`;
    const pv2Reg = `RC-${runId}-2`;
    const pv3Reg = `RC-${runId}-3`;

    const pv1Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/vehicles/personal',
      method: 'POST',
      headers
    }, {
      staff_id: testStaff.id,
      registration_number: pv1Reg,
      brand: 'Toyota',
      model: 'Corolla',
      color: 'Gris Métallisé',
      vehicle_type: 'Voiture Berline'
    });
    const pv1 = pv1Res.body.data || pv1Res.body;

    const pv2Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/vehicles/personal',
      method: 'POST',
      headers
    }, {
      staff_id: testStaff.id,
      registration_number: pv2Reg,
      brand: 'Peugeot',
      model: '508',
      color: 'Noir',
      vehicle_type: 'Voiture Berline'
    });
    const pv2 = pv2Res.body.data || pv2Res.body;

    const pv3Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/vehicles/personal',
      method: 'POST',
      headers
    }, {
      staff_id: testStaff.id,
      registration_number: pv3Reg,
      brand: 'Hyundai',
      model: 'Tucson',
      color: 'Blanc',
      vehicle_type: 'SUV 4x4'
    });
    const pv3 = pv3Res.body.data || pv3Res.body;
    console.log(`✓ 3 Personal Vehicles registered: PV1=${pv1.registration_number}, PV2=${pv2.registration_number}, PV3=${pv3.registration_number}`);

    // Create 2 Drivers
    const drv1Mat = `CH-${runId}-1`;
    const drv2Mat = `CH-${runId}-2`;

    const drv1Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/drivers',
      method: 'POST',
      headers
    }, {
      matricule: drv1Mat,
      nom: 'DIALLO',
      prenoms: 'Ibrahima Sory',
      telephone: '+224622112233',
      license_number: `PC-2020-${runId}`
    });
    const drv1 = drv1Res.body.data || drv1Res.body;

    const drv2Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/drivers',
      method: 'POST',
      headers
    }, {
      matricule: drv2Mat,
      nom: 'CAMARA',
      prenoms: 'Aboubacar Sidiki',
      telephone: '+224622445566',
      license_number: `PC-2021-${runId}`
    });
    const drv2 = drv2Res.body.data || drv2Res.body;
    console.log(`✓ 2 Drivers created: D1=${drv1.nom} (${drv1.matricule}), D2=${drv2.nom} (${drv2.matricule})`);

    // Create 2 Fleet Service Vehicles assigned to Staff
    const fv1Reg = `UK-${runId}-1`;
    const fv2Reg = `UK-${runId}-2`;

    const fv1Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/vehicles',
      method: 'POST',
      headers
    }, {
      registration_number: fv1Reg,
      brand: 'Nissan',
      model: 'Patrol Y61',
      status: 'AFFECTÉ',
      assigned_staff_id: testStaff.id,
      default_driver_id: drv1.id
    });
    const fv1 = fv1Res.body.data || fv1Res.body;

    const fv2Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/vehicles',
      method: 'POST',
      headers
    }, {
      registration_number: fv2Reg,
      brand: 'Toyota',
      model: 'Hilux Double Cabine',
      status: 'AFFECTÉ',
      assigned_staff_id: testStaff.id
    });
    const fv2 = fv2Res.body.data || fv2Res.body;
    console.log(`✓ 2 Fleet Vehicles created: FV1=${fv1.registration_number} (with default driver D1), FV2=${fv2.registration_number}`);

    // Helper to fetch mission details from /api/missions
    async function getMissionDetails(documentId) {
      const listRes = await request({
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/missions',
        method: 'GET',
        headers
      });
      const list = listRes.body.data || listRes.body || [];
      return list.find(m => m.document_id === documentId || m.id === documentId);
    }

    // =========================================================================
    // SCÉNARIO 1: Employé avec 3 véhicules personnels -> OM avec 2e véhicule
    // =========================================================================
    console.log('\n▶ SCÉNARIO 1: Création OM avec 2e véhicule personnel...');
    const om1Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/missions',
      method: 'POST',
      headers
    }, {
      staff_id: testStaff.id,
      missionary_name: 'TEST_AGENT_MULTI Alpha Oumar',
      function_title: 'Chef de Département',
      destination: 'Mamou',
      object_of_mission: 'Supervision pédagogique',
      departure_date: '2026-10-01',
      return_date: '2026-10-05',
      transport_mode: 'Véhicule personnel',
      personal_vehicle_id: pv2.id,
      vehicle_registration: pv2.registration_number,
      driver_name: 'Lui-même'
    });
    
    const om1DocId = om1Res.body.documentId || om1Res.body.id;
    const om1 = await getMissionDetails(om1DocId);
    const sc1Pass = om1 && om1.personal_vehicle_id === pv2.id && om1.vehicle_registration_snapshot === pv2.registration_number;
    console.log(`Scénario 1 Result: ${sc1Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Expected Reg: ${pv2.registration_number}, Stored Snapshot: ${om1?.vehicle_registration_snapshot}`);
    results.push({ scenario: 1, pass: sc1Pass, desc: 'OM avec 2e véhicule personnel' });

    // =========================================================================
    // SCÉNARIO 2: Employé avec 2 véhicules de service -> OM avec 1er véhicule
    // =========================================================================
    console.log('\n▶ SCÉNARIO 2: Création OM avec 1er véhicule de service affecté...');
    const om2Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/missions',
      method: 'POST',
      headers
    }, {
      staff_id: testStaff.id,
      missionary_name: 'TEST_AGENT_MULTI Alpha Oumar',
      function_title: 'Chef de Département',
      destination: 'Labé',
      object_of_mission: 'Séminaire inter-universitaire',
      departure_date: '2026-10-10',
      return_date: '2026-10-14',
      transport_mode: 'Véhicule de service',
      vehicle_id: fv1.id,
      vehicle_registration: fv1.registration_number,
      driver_name: 'Lui-même'
    });
    
    const om2DocId = om2Res.body.documentId || om2Res.body.id;
    const om2 = await getMissionDetails(om2DocId);
    const sc2Pass = om2 && om2.vehicle_id === fv1.id && om2.vehicle_registration_snapshot === fv1.registration_number;
    console.log(`Scénario 2 Result: ${sc2Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Expected Reg: ${fv1.registration_number}, Stored Snapshot: ${om2?.vehicle_registration_snapshot}`);
    results.push({ scenario: 2, pass: sc2Pass, desc: 'OM avec 1er véhicule de service' });

    // =========================================================================
    // SCÉNARIO 3: Véhicule avec chauffeur habituel -> pré-sélection
    // =========================================================================
    console.log('\n▶ SCÉNARIO 3: Vérification du chauffeur habituel lié au véhicule de service...');
    const fv1Check = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/vehicles/${fv1.id}`,
      method: 'GET',
      headers
    });
    const fv1Data = fv1Check.body.data || fv1Check.body;
    const sc3Pass = fv1Data && fv1Data.default_driver_id === drv1.id && (fv1Data.default_driver_full_name || '').includes('DIALLO');
    console.log(`Scénario 3 Result: ${sc3Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Default Driver ID: ${fv1Data?.default_driver_id}, Full Name: ${fv1Data?.default_driver_full_name}`);
    results.push({ scenario: 3, pass: sc3Pass, desc: 'Chauffeur habituel lié au véhicule' });

    // =========================================================================
    // SCÉNARIO 4: Changement de chauffeur pour la mission -> enregistre le chauffeur choisi
    // =========================================================================
    console.log('\n▶ SCÉNARIO 4: Sélection d\'un chauffeur différent (D2 au lieu de D1)...');
    const om4Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/missions',
      method: 'POST',
      headers
    }, {
      staff_id: testStaff.id,
      missionary_name: 'TEST_AGENT_MULTI Alpha Oumar',
      function_title: 'Chef de Département',
      destination: 'Conakry',
      object_of_mission: 'Conférence ministérielle',
      departure_date: '2026-10-20',
      return_date: '2026-10-25',
      transport_mode: 'Véhicule de service',
      vehicle_id: fv1.id,
      vehicle_registration: fv1.registration_number,
      driver_id: drv2.id,
      driver_name: `${drv2.prenoms} ${drv2.nom}`
    });
    
    const om4DocId = om4Res.body.documentId || om4Res.body.id;
    const om4 = await getMissionDetails(om4DocId);
    const sc4Pass = om4 && om4.driver_id === drv2.id && om4.driver_name_snapshot === `${drv2.prenoms} ${drv2.nom}`;
    console.log(`Scénario 4 Result: ${sc4Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Selected Driver Snapshot: ${om4?.driver_name_snapshot}, Driver ID: ${om4?.driver_id}`);
    results.push({ scenario: 4, pass: sc4Pass, desc: 'Chauffeur sélectionné enregistré (et non le chauffeur par défaut)' });

    // =========================================================================
    // SCÉNARIO 5: Option « Lui-même » -> affiche « Lui-même » sans nom du demandeur
    // =========================================================================
    console.log('\n▶ SCÉNARIO 5: Option "Lui-même" -> vérification du champ snapshot conducteur...');
    const om5Res = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/missions',
      method: 'POST',
      headers
    }, {
      staff_id: testStaff.id,
      missionary_name: 'TEST_AGENT_MULTI Alpha Oumar',
      function_title: 'Chef de Département',
      destination: 'Kindia Ville',
      object_of_mission: 'Inspection locale',
      departure_date: '2026-11-01',
      return_date: '2026-11-02',
      transport_mode: 'Véhicule personnel',
      personal_vehicle_id: pv1.id,
      vehicle_registration: pv1.registration_number,
      driver_name: 'Lui-même'
    });
    
    const om5DocId = om5Res.body.documentId || om5Res.body.id;
    const om5 = await getMissionDetails(om5DocId);
    const sc5Pass = om5 && (om5.driver_name_snapshot === 'Lui-même' || om5.driver_name === 'Lui-même');
    console.log(`Scénario 5 Result: ${sc5Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Driver Snapshot: ${om5?.driver_name_snapshot}`);
    results.push({ scenario: 5, pass: sc5Pass, desc: 'Champ conduit par affiche "Lui-même"' });

    // =========================================================================
    // SCÉNARIO 6: Rendu des Placeholders purs (moyen_transport, immatriculation)
    // =========================================================================
    console.log('\n▶ SCÉNARIO 6: Format strict des placeholders sans préfixe polluant...');
    const pdfService = require('./src/services/pdfService');
    const tMode = pdfService.formatTransportMode('Véhicule personnel');
    const sc6Pass = tMode === 'Véhicule personnel' && om1.vehicle_registration_snapshot === pv2Reg;
    console.log(`Scénario 6 Result: ${sc6Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  formatTransportMode: "${tMode}", Registration: "${om1?.vehicle_registration_snapshot}"`);
    results.push({ scenario: 6, pass: sc6Pass, desc: 'Placeholders {{moyen_transport}} et {{immatriculation}} purs' });

    // =========================================================================
    // SCÉNARIO 7: Réaffectation de véhicule -> OM antérieur non altéré
    // =========================================================================
    console.log('\n▶ SCÉNARIO 7: Réaffectation du véhicule de service à un autre agent...');
    // Create Staff B
    const staffBRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/staff',
      method: 'POST',
      headers
    }, {
      nom: `AGENT_B_${runId}`,
      prenoms: 'Moussa',
      matricule: `UK-B-${runId}`,
      fonction: 'Secrétaire Général Adjoint',
      email: `moussa.b.${runId}@univ-kindia.edu.gn`
    });
    const staffB = staffBRes.body.data || staffBRes.body;

    // Reassign FV1 to Staff B
    await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/vehicles/${fv1.id}/assign`,
      method: 'POST',
      headers
    }, {
      assigned_staff_id: staffB.id,
      reason: 'Mutation de service'
    });

    // Check past OM 2 (created when FV1 was assigned to Staff A)
    const om2Check = await getMissionDetails(om2DocId);
    const sc7Pass = om2Check && om2Check.vehicle_registration_snapshot === fv1Reg && om2Check.missionary_name.includes('TEST_AGENT_MULTI');
    console.log(`Scénario 7 Result: ${sc7Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Past OM vehicle snapshot intact: ${om2Check?.vehicle_registration_snapshot}`);
    results.push({ scenario: 7, pass: sc7Pass, desc: 'Immutabilité des anciens OM après réaffectation' });

    // =========================================================================
    // SCÉNARIO 8: Véhicule personnel désactivé -> absent des nouveaux OM mais anciens conservés
    // =========================================================================
    console.log('\n▶ SCÉNARIO 8: Désactivation d\'un véhicule personnel...');
    await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/vehicles/personal/${pv2.id}`,
      method: 'DELETE',
      headers
    });

    const activePVs = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/staff/${testStaff.id}/personal-vehicles?active_only=true`,
      method: 'GET',
      headers
    });
    const activeList = activePVs.body.data || activePVs.body || [];
    const pv2InActive = activeList.some(v => v.id === pv2.id);

    // Past OM 1 check
    const om1Check = await getMissionDetails(om1DocId);
    const sc8Pass = !pv2InActive && om1Check && om1Check.vehicle_registration_snapshot === pv2Reg;
    console.log(`Scénario 8 Result: ${sc8Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  PV2 filtered out from active list: ${!pv2InActive}, Past OM snapshot intact: ${om1Check?.vehicle_registration_snapshot}`);
    results.push({ scenario: 8, pass: sc8Pass, desc: 'Désactivation véhicule personnel sans perte historique' });

    // =========================================================================
    // SCÉNARIO 9: Chauffeur désactivé -> absent des nouveaux OM
    // =========================================================================
    console.log('\n▶ SCÉNARIO 9: Désactivation d\'un chauffeur...');
    await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/drivers/${drv2.id}/status`,
      method: 'PUT',
      headers
    }, {
      status: 'INACTIF'
    });

    const activeDriversRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/drivers?active_only=true',
      method: 'GET',
      headers
    });
    const activeDrivers = activeDriversRes.body.data || activeDriversRes.body || [];
    const drv2InActive = activeDrivers.some(d => d.id === drv2.id);
    const sc9Pass = !drv2InActive;
    console.log(`Scénario 9 Result: ${sc9Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Driver D2 filtered out from active drivers: ${!drv2InActive}`);
    results.push({ scenario: 9, pass: sc9Pass, desc: 'Chauffeur désactivé exclu de la sélection' });

    // =========================================================================
    // SCÉNARIO 10: Signature & Génération PDF complète avec QR code
    // =========================================================================
    console.log('\n▶ SCÉNARIO 10: Validation et signature OM (SG)...');
    const signRes = await request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api/missions/${om1DocId}/sign`,
      method: 'POST',
      headers: sgHeaders
    }, {
      signer_name: 'Dr. Ousmane DIALLO',
      signer_title: 'Secrétaire Général',
      signature_notes: 'Ordre de mission validé et signé pour mission officielle'
    });
    const signedData = signRes.body.data || signRes.body;
    const sc10Pass = signRes.status === 200 && (signedData.is_signed === 1 || signedData.is_signed === true || signedData.status === 'SIGNÉ' || signedData.pdf_url);
    console.log(`Scénario 10 Result: ${sc10Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Signature Status: ${signRes.status === 200 ? 'SUCCESS (200)' : 'FAILED'}, PDF URL: ${signedData.pdf_url || 'Generated'}`);
    results.push({ scenario: 10, pass: sc10Pass, desc: 'Signature officielle et chaîne de génération PDF' });

    // SUMMARY
    console.log('\n================================================================');
    console.log('📊 TEST RESULTS SUMMARY (10 SCENARIOS)');
    console.log('================================================================');
    let allPassed = true;
    for (const r of results) {
      console.log(`Scénario ${r.scenario}: ${r.pass ? '✅ PASS' : '❌ FAIL'} - ${r.desc}`);
      if (!r.pass) allPassed = false;
    }
    console.log('================================================================');
    console.log(allPassed ? '🎉 ALL 10 SCENARIOS PASSED PERFECTLY!' : '⚠️ SOME SCENARIOS FAILED');
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal error during test run:', err);
  }
}

run();
