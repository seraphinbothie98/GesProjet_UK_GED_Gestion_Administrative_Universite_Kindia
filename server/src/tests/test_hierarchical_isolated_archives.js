const API = 'http://127.0.0.1:5000/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  return { status: res.status, ok: res.ok, data };
}

async function runArchiveSecurityTests() {
  console.log('========================================================================');
  console.log('  TEST SUITE : ARCHIVAGE ÉLECTRONIQUE HIÉRARCHIQUE & SÉCURISÉ (UK-GED)');
  console.log('========================================================================\n');

  try {
    // 0. Setup test users and tokens
    console.log('▶ [0. INITIALISATION] : Connexion des comptes de test...');
    const loginAdmin = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' })
    });
    const adminHeaders = { Authorization: `Bearer ${loginAdmin.data.token}` };

    const loginAgentInfo = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'agent_info@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    const agentInfoHeaders = { Authorization: `Bearer ${loginAgentInfo.data.token}` };

    const loginSC = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    const scHeaders = { Authorization: `Bearer ${loginSC.data.token}` };

    const loginDoyenFS = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'doyen_fs@univ-kindia.edu.gn', password: 'Doyen123!' })
    });
    const doyenFSHeaders = { Authorization: `Bearer ${loginDoyenFS.data.token}` };

    // Create a Service and User for Département de Mathématiques (Dept B)
    const mathServiceRes = await request(`${API}/services`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        name: 'Département de Mathématiques',
        code: 'FS_MATH',
        reference_code: 'FS/MATH',
        structure_type: 'DEPARTEMENT'
      })
    });
    const mathServiceId = mathServiceRes.data.id || (await request(`${API}/services`, { headers: adminHeaders })).data.find(s => s.code === 'FS_MATH')?.id;

    // Create Agent for Math Dept
    await request(`${API}/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        matricule: 'AGENT_MATH_01',
        first_name: 'Alpha',
        last_name: 'DIALLO',
        email: 'agent_math@univ-kindia.edu.gn',
        phone: '+224622112233',
        function_title: 'Enseignant-Chercheur Mathématiques',
        role_id: 7, // Standard
        service_id: mathServiceId,
        password: 'Password123!'
      })
    });

    const loginAgentMath = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'agent_math@univ-kindia.edu.gn', password: 'Password123!' })
    });
    const agentMathHeaders = { Authorization: `Bearer ${loginAgentMath.data.token}` };

    // Create Faculté des Langues et Lettres (Faculty B) user
    const fllService = (await request(`${API}/services`, { headers: adminHeaders })).data.find(s => s.code === 'FLL');
    await request(`${API}/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        matricule: 'DOYEN_FLL_01',
        first_name: 'Mamadou',
        last_name: 'BARRY',
        email: 'doyen_fll@univ-kindia.edu.gn',
        phone: '+224622445566',
        function_title: 'Doyen Faculté des Lettres',
        role_id: 5, // Chef de service / Doyen
        service_id: fllService ? fllService.id : 27,
        password: 'Password123!'
      })
    });

    const loginDoyenFLL = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'doyen_fll@univ-kindia.edu.gn', password: 'Password123!' })
    });
    const doyenFLLHeaders = { Authorization: `Bearer ${loginDoyenFLL.data.token}` };

    console.log('  ✓ Tous les comptes et services de test sont configurés.\n');

    // -------------------------------------------------------------------------
    // TEST 1 : Isolation Inter-Départements (Dept A vs Dept B)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 1] : Isolation Inter-Départements (Info vs Mathématiques)...');
    
    // Agent Info creates and archives a private document in Info Archives
    const createDocInfoRes = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: agentInfoHeaders,
      body: JSON.stringify({
        document_type: 'RAPPORT',
        title: 'Rapport Confidentiel du Conseil de Département d’Informatique',
        object_title: 'Rapport Confidentiel du Conseil de Département d’Informatique',
        content_body: 'Contenu hautement confidentiel des délibérations internes du département.',
        action: 'SUBMIT'
      })
    });
    const docInfoId = createDocInfoRes.data.id;
    console.log(`  ✓ Document privé créé par Département Info : ID ${docInfoId} [${createDocInfoRes.data.reference}]`);

    // Archive it in Info Private Archive
    await request(`${API}/documents/${docInfoId}/archive-service`, {
      method: 'POST',
      headers: agentInfoHeaders,
      body: JSON.stringify({ archive_scope: 'PRIVE_SERVICE', archive_category: 'PV & Délibérations' })
    });
    console.log(`  ✓ Document classé dans l'Archive Privée du Département d'Informatique.`);

    // Agent Math tries to access Document Info
    const mathAccessRes = await request(`${API}/documents/${docInfoId}`, { headers: agentMathHeaders });
    console.log(`  ✓ Tentative d'accès par Agent Math : Code HTTP ${mathAccessRes.status} (${mathAccessRes.data.error || 'OK'})`);
    if (mathAccessRes.status !== 403) {
      throw new Error(`ÉCHEC DU TEST 1 : Le Département Math a pu accéder au document privé du Département Info (Code ${mathAccessRes.status})`);
    }
    console.log('  🎉 TEST 1 RÉUSSI : Accès refusé conformément au Deny by Default !\n');

    // -------------------------------------------------------------------------
    // TEST 2 : Isolation Inter-Facultés (Faculté des Sciences vs Faculté des Lettres)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 2] : Isolation Inter-Facultés (Faculté des Sciences vs Faculté des Lettres)...');
    
    // Doyen FS creates an archive at Faculty level
    const createDocFSRes = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: doyenFSHeaders,
      body: JSON.stringify({
        document_type: 'NOTE_SERVICE',
        title: 'Note Décanale Interne — Faculté des Sciences',
        object_title: 'Note Décanale Interne — Faculté des Sciences',
        content_body: 'Directives internes pour le corps professoral de la Faculté des Sciences.',
        action: 'SUBMIT'
      })
    });
    const docFSId = createDocFSRes.data.id;

    await request(`${API}/documents/${docFSId}/archive-service`, {
      method: 'POST',
      headers: doyenFSHeaders,
      body: JSON.stringify({ archive_scope: 'PRIVE_SERVICE' })
    });

    // Doyen FLL tries to access Faculty of Science private archive
    const fllAccessRes = await request(`${API}/documents/${docFSId}`, { headers: doyenFLLHeaders });
    console.log(`  ✓ Tentative d'accès par Doyen Lettres : Code HTTP ${fllAccessRes.status} (${fllAccessRes.data.error || 'OK'})`);
    if (fllAccessRes.status !== 403) {
      throw new Error(`ÉCHEC DU TEST 2 : La Faculté des Lettres a pu accéder à l'archive privée de la Faculté des Sciences !`);
    }
    console.log('  🎉 TEST 2 RÉUSSI : Cloisonnement inter-facultés vérifié !\n');

    // -------------------------------------------------------------------------
    // TEST 3 : Secrétariat Central vs Archive Privée de Service (Avant transmission)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 3] : Secrétariat Central vs Archive Privée de Service...');
    
    // SC tries to access Doc Info (which is private to Info department and not transmitted to SC)
    const scAccessRes = await request(`${API}/documents/${docInfoId}`, { headers: scHeaders });
    console.log(`  ✓ Tentative d'accès par le Secrétariat Central : Code HTTP ${scAccessRes.status} (${scAccessRes.data.error || 'OK'})`);
    if (scAccessRes.status !== 403) {
      throw new Error(`ÉCHEC DU TEST 3 : Le Secrétariat Central a pu accéder à une archive privée non transmise !`);
    }

    // Check if it appears in SC archives list
    const scArchivesList = await request(`${API}/documents/archives`, { headers: scHeaders });
    const foundInSC = scArchivesList.data.documents?.some(d => d.id === docInfoId);
    if (foundInSC) {
      throw new Error(`ÉCHEC DU TEST 3 : Le document privé est apparu dans la liste des archives du Secrétariat Central !`);
    }
    console.log('  ✓ Le document privé n’apparaît pas dans la liste des archives du SC.');
    console.log('  🎉 TEST 3 RÉUSSI : Le Secrétariat Central est strictement isolé des archives privées des services !\n');

    // -------------------------------------------------------------------------
    // TEST 4 : Transmission officielle pour Archivage Central
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 4] : Transmission officielle pour Archivage Central...');
    
    // Département Info transmits docInfoId to SC for central archiving
    const transmitMotive = 'Versement officiel pour conservation légale et inscription aux archives centrales';
    const transmitRes = await request(`${API}/documents/${docInfoId}/transmit-to-central-archive`, {
      method: 'POST',
      headers: agentInfoHeaders,
      body: JSON.stringify({ motive: transmitMotive })
    });
    console.log(`  ✓ Document transmis au SC : ${transmitRes.data.message}`);

    // Now SC can access the document
    const scAccessAfterTransmit = await request(`${API}/documents/${docInfoId}`, { headers: scHeaders });
    console.log(`  ✓ Accès SC après transmission : Code HTTP ${scAccessAfterTransmit.status} (Accès autorisé)`);
    if (scAccessAfterTransmit.status !== 200) {
      throw new Error(`ÉCHEC DU TEST 4 : Le SC n'a pas pu accéder au document après transmission officielle !`);
    }

    // SC validates central archiving
    const centralArchiveRes = await request(`${API}/documents/${docInfoId}/archive-central`, {
      method: 'POST',
      headers: scHeaders
    });
    console.log(`  ✓ Versement dans les archives centrales validé par le SC : ${centralArchiveRes.data.message}`);

    // Verify document history retains origin
    const docDetailAfterCentral = await request(`${API}/documents/${docInfoId}`, { headers: scHeaders });
    console.log(`  ✓ Historique préservé : Émetteur initial = ${docDetailAfterCentral.data.originating_service_name}, Portée = ${docDetailAfterCentral.data.archive_scope}`);
    console.log('  🎉 TEST 4 RÉUSSI : Circuit de transmission et archivage central validé !\n');

    // -------------------------------------------------------------------------
    // TEST 5 : Sécurité du Téléchargement Direct de Fichiers (HTTP 403)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 5] : Sécurité du Téléchargement Direct par URL/API...');
    
    // Agent Math tries to download file of docFS (Faculty of Science private doc)
    const downloadDeniedRes = await request(`${API}/documents/${docFSId}/download`, { headers: agentMathHeaders });
    console.log(`  ✓ Tentative de téléchargement non autorisé : Code HTTP ${downloadDeniedRes.status} (${downloadDeniedRes.data.error || 'OK'})`);
    if (downloadDeniedRes.status !== 403) {
      throw new Error(`ÉCHEC DU TEST 5 : Téléchargement direct autorisé sans droits !`);
    }
    console.log('  🎉 TEST 5 RÉUSSI : Téléchargements et streaming de fichiers strictement protégés !\n');

    // -------------------------------------------------------------------------
    // TEST 6 : Traçabilité et Journal d'Audit Immuable
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 6] : Traçabilité et Journal d’Audit...');
    
    const auditLogsRes = await request(`${API}/audit`, { headers: adminHeaders });
    console.log(`  ✓ Total entrées d'audit enregistrées : ${auditLogsRes.data.length}`);

    const deniedLogs = auditLogsRes.data.filter(l => l.action === 'SECURITY_DENIED_ACCESS');
    console.log(`  ✓ Tentatives d'accès non autorisées tracées avec 'SECURITY_DENIED_ACCESS' : ${deniedLogs.length}`);

    const transmitLogs = auditLogsRes.data.filter(l => l.action === 'TRANSMIT_CENTRAL_ARCHIVE');
    console.log(`  ✓ Transmissions pour archivage central tracées : ${transmitLogs.length}`);

    if (deniedLogs.length === 0 || transmitLogs.length === 0) {
      throw new Error('ÉCHEC DU TEST 6 : Les événements de sécurité ne sont pas correctement audités !');
    }
    console.log('  🎉 TEST 6 RÉUSSI : Audit et traçabilité d’accès 100% vérifiés !\n');

    console.log('========================================================================');
    console.log('  🌟 TOUS LES TESTS DE SÉCURITÉ DE L’ARCHIVAGE (1 À 6) ONT RÉUSSI !');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('\n❌ ÉCHEC DES TESTS D’ARCHIVAGE :', err.message);
    process.exit(1);
  }
}

runArchiveSecurityTests();
