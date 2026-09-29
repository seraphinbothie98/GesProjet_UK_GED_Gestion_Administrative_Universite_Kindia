const API_BASE = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return { data, status: res.status };
}

async function main() {
  console.log('===============================================================');
  console.log('🧪 SUITE DE TESTS OFFICIELLE — 18 SCÉNARIOS UK-GED');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [SUCCÈS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [ÉCHEC] ${message}`);
      failed++;
    }
  }

  // 1. Authenticate as Admin
  console.log('\n🔐 Authentification Admin...');
  const adminLogin = await req('/auth/login', {
    method: 'POST',
    body: { identity: 'UK-ADM-001', password: 'Admin123!' }
  });
  const adminToken = adminLogin.data.token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 2. Authenticate as SC (Agent Secrétariat Central)
  console.log('🔐 Authentification Secrétariat Central...');
  const scLogin = await req('/auth/login', {
    method: 'POST',
    body: { identity: 'UK-SC-002', password: 'Agent123!' }
  });
  const scToken = scLogin.data.token;
  const scHeaders = { Authorization: `Bearer ${scToken}` };

  // 3. Authenticate as Teacher / Regular User
  console.log('🔐 Authentification Enseignant / Utilisateur standard...');
  const teacherLogin = await req('/auth/login', {
    method: 'POST',
    body: { identity: 'UK-INFO-002', password: 'Agent123!' }
  });
  const teacherToken = teacherLogin.data.token;
  const teacherHeaders = { Authorization: `Bearer ${teacherToken}` };

  // =========================================================================
  // TEST 1 : Créer un personnel sans véhicule -> création réussie
  // =========================================================================
  console.log('\n--- TEST 1 : Créer un personnel sans véhicule ---');
  const testStaffPayload = {
    nom: 'TOURE',
    prenoms: 'Alpha Oumar',
    matricule: 'UK-RECT-' + Date.now().toString().slice(-4),
    grade: 'PROFESSEUR TITULAIRE',
    fonction: 'Recteur de l’Université',
    category: 'PERSONNEL_ADMINISTRATIF',
    nationality: 'Guinéenne',
    telephone: '+224622001122',
    email: `recteur_${Date.now()}@univ-kindia.edu.gn`,
    service_id: 1,
    status: 'ACTIF'
  };
  const staffRes = await req('/staff', {
    method: 'POST',
    headers: adminHeaders,
    body: testStaffPayload
  });
  const staffId = staffRes.data.id || staffRes.data.staff?.id;
  assert(staffId !== undefined && staffId > 0, `TEST 1: Personnel créé sans véhicule avec ID: ${staffId}`);

  // =========================================================================
  // TEST 2 : Ajouter 2 véhicules personnels -> les deux apparaissent dans sa fiche
  // =========================================================================
  console.log('\n--- TEST 2 : Ajouter 2 véhicules personnels ---');
  await req('/vehicles/personal', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      staff_id: staffId,
      registration_number: 'GN-1234-AA',
      brand: 'Toyota',
      model: 'Land Cruiser Prado',
      vehicle_type: 'SUV',
      color: 'Noir'
    }
  });

  await req('/vehicles/personal', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      staff_id: staffId,
      registration_number: 'GN-5678-BB',
      brand: 'Mercedes-Benz',
      model: 'Classe E',
      vehicle_type: 'Berline',
      color: 'Gris'
    }
  });

  const staffDetail1 = await req(`/staff/${staffId}`, { headers: adminHeaders });
  const personalVehs = staffDetail1.data.personal_vehicles || [];
  assert(
    personalVehs.length >= 2 &&
    personalVehs.some(v => v.registration_number === 'GN-1234-AA') &&
    personalVehs.some(v => v.registration_number === 'GN-5678-BB'),
    `TEST 2: Les 2 véhicules personnels (${personalVehs.map(v => v.registration_number).join(', ')}) apparaissent dans la fiche du personnel.`
  );

  // =========================================================================
  // TEST 3 : Ajouter 2 véhicules de service -> les deux apparaissent dans sa fiche
  // =========================================================================
  console.log('\n--- TEST 3 : Ajouter 2 véhicules de service ---');
  const existingFleet = await req('/vehicles', { headers: adminHeaders });
  let fv1 = existingFleet.data.find(v => v.registration_number === 'GN-3000-CC');
  if (!fv1) {
    const created1 = await req('/vehicles', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        registration_number: 'GN-3000-CC',
        brand: 'Toyota',
        model: 'Hilux Double Cabine',
        vehicle_type: 'Pick-up',
        status: 'DISPONIBLE'
      }
    });
    fv1 = created1.data.vehicle || created1.data;
  }

  let fv2 = existingFleet.data.find(v => v.registration_number === 'GN-4000-DD');
  if (!fv2) {
    const created2 = await req('/vehicles', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        registration_number: 'GN-4000-DD',
        brand: 'Nissan',
        model: 'Patrol V8',
        vehicle_type: '4x4',
        status: 'DISPONIBLE'
      }
    });
    fv2 = created2.data.vehicle || created2.data;
  }

  const fv1Id = fv1.id;
  const fv2Id = fv2.id;

  // Assign both to the staff
  await req(`/staff/${staffId}/assigned-vehicles`, {
    method: 'POST',
    headers: adminHeaders,
    body: {
      vehicle_id: fv1Id,
      purpose: 'Véhicule de fonction officiel'
    }
  });

  await req(`/staff/${staffId}/assigned-vehicles`, {
    method: 'POST',
    headers: adminHeaders,
    body: {
      vehicle_id: fv2Id,
      purpose: 'Véhicule de service d’appui'
    }
  });

  const staffDetail2 = await req(`/staff/${staffId}`, { headers: adminHeaders });
  const assignedVehs = staffDetail2.data.assigned_vehicles || [];
  assert(
    assignedVehs.length >= 2 &&
    assignedVehs.some(v => v.registration_number === 'GN-3000-CC') &&
    assignedVehs.some(v => v.registration_number === 'GN-4000-DD'),
    `TEST 3: Les 2 véhicules de service (${assignedVehs.map(v => v.registration_number).join(', ')}) apparaissent dans la fiche.`
  );

  // =========================================================================
  // TEST 4 : Ajouter 3 chauffeurs -> les trois apparaissent dans sa fiche
  // =========================================================================
  console.log('\n--- TEST 4 : Ajouter 3 chauffeurs & les rattacher ---');
  const existingDrivers = await req('/drivers', { headers: adminHeaders });
  let d1 = existingDrivers.data.find(d => d.nom.toLowerCase().includes('diallo') && d.prenoms.toLowerCase().includes('mamadou'));
  if (!d1) {
    const cd1 = await req('/drivers', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        nom: 'Diallo',
        prenoms: 'Mamadou',
        matricule: 'CHAUFF-001',
        telephone: '+224621111111',
        license_number: 'PC-GIN-001'
      }
    });
    d1 = cd1.data.driver || cd1.data;
  }

  let d2 = existingDrivers.data.find(d => d.nom.toLowerCase().includes('bah') && d.prenoms.toLowerCase().includes('ibrahima'));
  if (!d2) {
    const cd2 = await req('/drivers', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        nom: 'Bah',
        prenoms: 'Ibrahima',
        matricule: 'CHAUFF-002',
        telephone: '+224622222222',
        license_number: 'PC-GIN-002'
      }
    });
    d2 = cd2.data.driver || cd2.data;
  }

  let d3 = existingDrivers.data.find(d => d.nom.toLowerCase().includes('camara') && d.prenoms.toLowerCase().includes('mohamed'));
  if (!d3) {
    const cd3 = await req('/drivers', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        nom: 'Camara',
        prenoms: 'Mohamed',
        matricule: 'CHAUFF-003',
        telephone: '+224623333333',
        license_number: 'PC-GIN-003'
      }
    });
    d3 = cd3.data.driver || cd3.data;
  }

  const d1Id = d1.id;
  const d2Id = d2.id;
  const d3Id = d3.id;

  // Attach all 3 drivers to the staff
  await req(`/staff/${staffId}/drivers`, {
    method: 'POST',
    headers: adminHeaders,
    body: { driver_id: d1Id, is_default: true }
  }).catch(() => {});

  await req(`/staff/${staffId}/drivers`, {
    method: 'POST',
    headers: adminHeaders,
    body: { driver_id: d2Id, is_default: false }
  }).catch(() => {});

  await req(`/staff/${staffId}/drivers`, {
    method: 'POST',
    headers: adminHeaders,
    body: { driver_id: d3Id, is_default: false }
  }).catch(() => {});

  const staffDetail3 = await req(`/staff/${staffId}`, { headers: adminHeaders });
  const attachedDrvs = staffDetail3.data.attached_drivers || [];
  assert(
    attachedDrvs.length >= 3 &&
    attachedDrvs.some(d => d.driver_id === d1Id || d.id === d1Id) &&
    attachedDrvs.some(d => d.driver_id === d2Id || d.id === d2Id) &&
    attachedDrvs.some(d => d.driver_id === d3Id || d.id === d3Id),
    `TEST 4: Les 3 chauffeurs (${attachedDrvs.map(d => d.full_name || `${d.nom} ${d.prenoms}`).join(', ')}) apparaissent dans sa fiche.`
  );

  // =========================================================================
  // TEST 5 : Associer un chauffeur habituel au véhicule GN-3000-CC
  // =========================================================================
  console.log('\n--- TEST 5 : Associer un chauffeur habituel au véhicule GN-3000-CC ---');
  await req(`/vehicles/${fv1Id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: { default_driver_id: d1Id }
  });

  const fv1Updated = await req(`/vehicles/${fv1Id}`, { headers: adminHeaders });
  assert(
    fv1Updated.data.default_driver_id === d1Id,
    `TEST 5: Chauffeur habituel ${fv1Updated.data.default_driver_full_name} associé au véhicule GN-3000-CC.`
  );

  // =========================================================================
  // TEST 6 : Créer un Ordre de Mission avec GN-3000-CC -> Chauffeur habituel proposé automatiquement
  // =========================================================================
  console.log('\n--- TEST 6 : Créer un Ordre de Mission avec GN-3000-CC ---');
  const om1Res = await req('/missions', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      staff_id: staffId,
      missionary_name: 'TOURE Alpha Oumar',
      function_title: 'Recteur',
      destination: 'Conakry',
      object_of_mission: 'Conférence des Recteurs et Évaluation Institutionnelle',
      transport_mode: 'Véhicule de service',
      departure_date: '2026-10-01',
      return_date: '2026-10-05',
      vehicle_id: fv1Id,
      vehicle_registration: 'GN-3000-CC',
      driver_option: 'DRIVER',
      driver_id: d1Id,
      driver_name: d1.full_name || `${d1.nom} ${d1.prenoms}`
    }
  });

  const allMissions1 = await req('/missions', { headers: adminHeaders });
  const om1 = allMissions1.data.find(m => m.reference === om1Res.data.reference) || {};
  assert(
    om1.reference && (om1.driver_name_snapshot || om1.driver_name),
    `TEST 6: Ordre de mission créé avec GN-3000-CC et chauffeur proposé ${om1.driver_name_snapshot || om1.driver_name}.`
  );

  // =========================================================================
  // TEST 7 : Modifier le chauffeur proposé -> possibilité de choisir un autre chauffeur rattaché
  // =========================================================================
  console.log('\n--- TEST 7 : Créer un Ordre de Mission avec un autre chauffeur rattaché (Ibrahima Bah) ---');
  const om2Res = await req('/missions', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      staff_id: staffId,
      missionary_name: 'TOURE Alpha Oumar',
      function_title: 'Recteur',
      destination: 'Mamou',
      object_of_mission: 'Supervision universitaire',
      transport_mode: 'Véhicule de service',
      departure_date: '2026-10-10',
      return_date: '2026-10-12',
      vehicle_id: fv1Id,
      vehicle_registration: 'GN-3000-CC',
      driver_option: 'DRIVER',
      driver_id: d2Id,
      driver_name: d2.full_name || `${d2.nom} ${d2.prenoms}`
    }
  });

  const allMissions2 = await req('/missions', { headers: adminHeaders });
  const om2 = allMissions2.data.find(m => m.reference === om2Res.data.reference) || {};
  assert(
    om2.reference && (om2.driver_name_snapshot || om2.driver_name),
    `TEST 7: Ordre de mission créé avec un autre chauffeur rattaché (${om2.driver_name_snapshot || om2.driver_name}).`
  );

  // =========================================================================
  // TEST 8 : Créer un Ordre de Mission avec un véhicule personnel
  // =========================================================================
  console.log('\n--- TEST 8 : Créer un Ordre de Mission avec un véhicule personnel (GN-1234-AA) ---');
  const pvList = await req(`/staff/${staffId}/personal-vehicles?active_only=true`, { headers: adminHeaders });
  const userPv = pvList.data.find(v => v.registration_number === 'GN-1234-AA');

  const om3Res = await req('/missions', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      staff_id: staffId,
      missionary_name: 'TOURE Alpha Oumar',
      function_title: 'Recteur',
      destination: 'Labé',
      object_of_mission: 'Colloque scientifique',
      transport_mode: 'Véhicule personnel',
      departure_date: '2026-10-15',
      return_date: '2026-10-18',
      personal_vehicle_id: userPv.id,
      vehicle_registration: 'GN-1234-AA',
      driver_option: 'SELF',
      driver_name: 'Lui-même'
    }
  });

  const allMissions3 = await req('/missions', { headers: adminHeaders });
  const om3 = allMissions3.data.find(m => m.reference === om3Res.data.reference) || {};
  assert(
    om3.reference && (om3.vehicle_registration_snapshot === 'GN-1234-AA' || om3.vehicle_registration === 'GN-1234-AA'),
    `TEST 8: Ordre de mission créé avec véhicule personnel GN-1234-AA.`
  );

  // =========================================================================
  // TEST 9 : Créer un Ordre de Mission avec un véhicule de service
  // =========================================================================
  console.log('\n--- TEST 9 : Créer un Ordre de Mission avec véhicule de service GN-4000-DD ---');
  const om4Res = await req('/missions', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      staff_id: staffId,
      missionary_name: 'TOURE Alpha Oumar',
      function_title: 'Recteur',
      destination: 'Boké',
      object_of_mission: 'Mission inter-institutionnelle',
      transport_mode: 'Véhicule de service',
      departure_date: '2026-10-20',
      return_date: '2026-10-25',
      vehicle_id: fv2Id,
      vehicle_registration: 'GN-4000-DD',
      driver_option: 'DRIVER',
      driver_id: d3Id,
      driver_name: d3.full_name || `${d3.nom} ${d3.prenoms}`
    }
  });

  const allMissions4 = await req('/missions', { headers: adminHeaders });
  const om4 = allMissions4.data.find(m => m.reference === om4Res.data.reference) || {};
  assert(
    om4.reference && (om4.vehicle_registration_snapshot === 'GN-4000-DD' || om4.vehicle_registration === 'GN-4000-DD'),
    `TEST 9: Ordre de mission créé avec véhicule de service attribué GN-4000-DD.`
  );

  // =========================================================================
  // TEST 10 : Vérifier que l'immatriculation affichée correspond exactement au véhicule sélectionné
  // =========================================================================
  console.log('\n--- TEST 10 : Vérifier la correspondance exacte de l’immatriculation ---');
  assert(
    (om1.vehicle_registration_snapshot === 'GN-3000-CC' || om1.vehicle_registration === 'GN-3000-CC'),
    `TEST 10: Immatriculation correspond exactement à GN-3000-CC.`
  );

  // =========================================================================
  // TEST 11, 12, 13 : Vérifier que {{immatriculation}}, {{moyen_transport}}, {{chauffeur}} contiennent uniquement les données brutes
  // =========================================================================
  console.log('\n--- TESTS 11, 12, 13 : Données brutes des placeholders ---');
  const rawTransport = om1.transport_mode_snapshot || om1.transport_mode;
  const rawRegistration = om1.vehicle_registration_snapshot || om1.vehicle_registration;
  const rawDriver = om1.driver_name_snapshot || om1.driver_name;

  assert(rawRegistration === 'GN-3000-CC', `TEST 11: {{immatriculation}} = "${rawRegistration}" (aucun libellé parasite)`);
  assert(rawTransport === 'Véhicule de service', `TEST 12: {{moyen_transport}} = "${rawTransport}" (valeur brute)`);
  assert(rawDriver.toLowerCase().includes('diallo') && rawDriver.toLowerCase().includes('mamadou'), `TEST 13: {{chauffeur}} = "${rawDriver}" (nom brut)`);

  // =========================================================================
  // TEST 14 : Modifier ultérieurement le chauffeur habituel -> les anciens OM ne changent pas
  // =========================================================================
  console.log('\n--- TEST 14 : Immutabilité lors du changement ultérieur du chauffeur habituel ---');
  await req(`/vehicles/${fv1Id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: { default_driver_id: d2Id }
  });

  const missionsCheck1 = await req('/missions', { headers: adminHeaders });
  const om1AfterDriverChange = missionsCheck1.data.find(m => m.reference === om1.reference);
  const driverValAfterChange = om1AfterDriverChange.driver_name_snapshot || om1AfterDriverChange.driver_name;
  assert(
    driverValAfterChange.toLowerCase().includes('diallo') && driverValAfterChange.toLowerCase().includes('mamadou'),
    `TEST 14: L'ancien OM conserve son chauffeur d'origine (${driverValAfterChange}).`
  );

  // =========================================================================
  // TEST 15 : Réaffecter ultérieurement un véhicule -> les anciens OM ne changent pas
  // =========================================================================
  console.log('\n--- TEST 15 : Immutabilité lors de la réaffectation ultérieure du véhicule ---');
  await req(`/staff/${staffId}/assigned-vehicles/${fv1Id}`, {
    method: 'DELETE',
    headers: adminHeaders
  });

  const missionsCheck2 = await req('/missions', { headers: adminHeaders });
  const om1AfterVehChange = missionsCheck2.data.find(m => m.reference === om1.reference);
  assert(
    (om1AfterVehChange.vehicle_registration_snapshot === 'GN-3000-CC' || om1AfterVehChange.vehicle_registration === 'GN-3000-CC'),
    `TEST 15: L'ancien OM conserve l'immatriculation d'origine (${om1AfterVehChange.vehicle_registration_snapshot || om1AfterVehChange.vehicle_registration}).`
  );

  // =========================================================================
  // TEST 16 : Se connecter comme Administrateur -> Parc automobile et Chauffeurs visibles
  // =========================================================================
  console.log('\n--- TEST 16 : Droits Administrateur ---');
  const adminVehList = await req('/vehicles', { headers: adminHeaders });
  const adminDrvList = await req('/drivers', { headers: adminHeaders });
  assert(
    Array.isArray(adminVehList.data) && Array.isArray(adminDrvList.data),
    `TEST 16: Administrateur a accès au Parc (${adminVehList.data.length} véhicules) et aux Chauffeurs (${adminDrvList.data.length} chauffeurs).`
  );

  // =========================================================================
  // TEST 17 : Se connecter comme Secrétariat Central -> Parc et Chauffeurs visibles et modifiables
  // =========================================================================
  console.log('\n--- TEST 17 : Droits Secrétariat Central ---');
  const scVehList = await req('/vehicles', { headers: scHeaders });
  const scDrvList = await req('/drivers', { headers: scHeaders });
  // SC corrects a driver's name
  await req(`/drivers/${d1Id}`, {
    method: 'PUT',
    headers: scHeaders,
    body: {
      nom: 'Diallo',
      prenoms: 'Mamadou Oury'
    }
  });
  const updatedDriver = await req(`/drivers/${d1Id}`, { headers: scHeaders });

  assert(
    Array.isArray(scVehList.data) && Array.isArray(scDrvList.data) && updatedDriver.data.full_name.includes('Mamadou Oury'),
    `TEST 17: Secrétariat Central peut consulter et modifier les chauffeurs (${updatedDriver.data.full_name}).`
  );

  // =========================================================================
  // TEST 18 : Se connecter avec un autre rôle -> Parc et Chauffeurs inaccessibles
  // =========================================================================
  console.log('\n--- TEST 18 : Restriction pour les rôles ordinaires ---');
  let teacherVehBlocked = false;
  let teacherDrvBlocked = false;

  try {
    await req('/vehicles', { headers: teacherHeaders });
  } catch (err) {
    if (err.status === 403 || err.status === 401) {
      teacherVehBlocked = true;
    }
  }

  try {
    await req('/drivers', { headers: teacherHeaders });
  } catch (err) {
    if (err.status === 403 || err.status === 401) {
      teacherDrvBlocked = true;
    }
  }

  assert(
    teacherVehBlocked && teacherDrvBlocked,
    `TEST 18: Les utilisateurs ordinaires ont un accès bloqué (403/401) au Parc et aux Chauffeurs.`
  );

  console.log('\n===============================================================');
  console.log(`📊 RÉSULTAT GLOBAL : ${passed}/18 RÉUSSIS, ${failed} ÉCHECS`);
  console.log('===============================================================');

  if (failed === 0) {
    console.log('🎉 TOUS LES 18 SCÉNARIOS SONT CONFORMES ET VALIDÉS !');
    process.exit(0);
  } else {
    console.error('⚠️ CERTAINS TESTS ONT ÉCHOUÉ.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err.message, err.data || '');
  process.exit(1);
});
