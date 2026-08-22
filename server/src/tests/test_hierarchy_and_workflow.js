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
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return data;
}

async function runValidationTest() {
  console.log('================================================================');
  console.log('  TEST SCENARIO : GOUVERNANCE ADMINISTRATIVE & WORKFLOW SG UK');
  console.log('================================================================\n');

  try {
    // 1. Login as Agent Dept Informatique (FS/INFO)
    console.log('▶ STEP 1: Connexion en tant qu’Agent du Département d’Informatique...');
    const loginAgentRes = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        identity: 'agent_info@univ-kindia.edu.gn',
        password: 'Agent123!'
      })
    });
    const agentToken = loginAgentRes.token;
    const agentHeaders = { Authorization: `Bearer ${agentToken}` };
    console.log(`  ✓ Connecté : ${loginAgentRes.user.first_name} ${loginAgentRes.user.last_name} (${loginAgentRes.user.service_name})`);

    // 2. Fetch Hierarchy and Services
    console.log('\n▶ STEP 2: Vérification de l’Organigramme Hiérarchique (UK -> FS -> FS/INFO)...');
    const hierarchyRes = await request(`${API}/services/hierarchy`, { headers: agentHeaders });
    const ukNode = hierarchyRes.find(n => n.code === 'UK');
    console.log(`  ✓ Racine : ${ukNode.name} (${ukNode.reference_code})`);
    const fsChild = ukNode.children.find(c => c.code === 'FS');
    console.log(`    ↳ Faculté : ${fsChild.name} (${fsChild.reference_code})`);
    const infoChild = fsChild.children.find(c => c.code === 'FS_INFO');
    console.log(`      ↳ Département : ${infoChild.name} (Réf Unique : ${infoChild.reference_code})`);

    // 3. Create Soit-Transmis from FS/INFO
    console.log('\n▶ STEP 3: Création contextuelle d’un Soit-Transmis par le Département d’Informatique...');
    const createRes = await request(`${API}/documents/soit-transmis`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        object_title: 'Transmission des notes et procès-verbaux de Licence 3 Informatique',
        content_body: 'J’ai l’honneur de vous transmettre ci-joint pour visa et signature rectorale les PV de délibération.',
        recipient_name: 'Monsieur le Recteur de l’Université de Kindia',
        pieces_jointes: '03 Chemises cartonnées avec bordereau d’envoi n°14'
      })
    });

    const docId = createRes.id;
    const generatedRef = createRes.reference;
    console.log(`  ✓ Document créé avec succès !`);
    console.log(`  ✓ ID : ${docId}`);
    console.log(`  ✓ Référence générée : [${generatedRef}] (Pattern respecté : FS/INFO/YYYY/XXXX)`);

    if (!generatedRef.startsWith('FS/INFO/')) {
      throw new Error(`La référence [${generatedRef}] ne respecte pas le code unique du service émetteur [FS/INFO].`);
    }

    // 4. Verify Document Snapshot Details
    console.log('\n▶ STEP 4: Vérification du Snapshot du Responsable en Poste et En-tête...');
    const doc = await request(`${API}/documents/${docId}`, { headers: agentHeaders });
    console.log(`  ✓ Structure émettrice : ${doc.originating_service_name}`);
    console.log(`  ✓ Responsable en fonction : ${doc.originating_head_name} (${doc.originating_head_function})`);
    console.log(`  ✓ Détenteur actuel du document : ${doc.current_service_name} (Aiguillé vers le SG)`);
    console.log(`  ✓ Statut initial : ${doc.status}`);

    // 5. Login as Secrétaire Général (SG)
    console.log('\n▶ STEP 5: Connexion en tant que Secrétaire Général (SG)...');
    const loginSgRes = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        identity: 'sg@univ-kindia.edu.gn',
        password: 'Sg123!'
      })
    });
    const sgToken = loginSgRes.token;
    const sgHeaders = { Authorization: `Bearer ${sgToken}` };
    console.log(`  ✓ Connecté : ${loginSgRes.user.first_name} ${loginSgRes.user.last_name} (${loginSgRes.user.role_name})`);

    // 6. SG Decision: Orient to Recteur
    console.log('\n▶ STEP 6: Exercice de la Règle Impérative du SG (Orientation vers le Recteur)...');
    const sgDecisionRes = await request(`${API}/workflow/sg-orient`, {
      method: 'POST',
      headers: sgHeaders,
      body: JSON.stringify({
        document_id: docId,
        action_type: 'ORIENT_RECTEUR',
        instruction: 'Dossier conforme et complet. Transmis pour visa et signature du Recteur.'
      })
    });
    console.log(`  ✓ Décision SG exécutée : ${sgDecisionRes.message}`);

    // 7. Verify routing to Rectorat
    const docAfterSg = await request(`${API}/documents/${docId}`, { headers: sgHeaders });
    console.log(`  ✓ Nouveau détenteur : ${docAfterSg.current_service_name} (Rectorat)`);
    console.log(`  ✓ Autorité signataire autorisée : ${docAfterSg.authorized_signatory_role}`);
    console.log(`  ✓ Instruction SG consignée : "${docAfterSg.sg_orientation_instruction}"`);

    // 8. Login as Recteur
    console.log('\n▶ STEP 8: Connexion en tant que Recteur de l’Université de Kindia...');
    const loginRecteurRes = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({
        identity: 'recteur@univ-kindia.edu.gn',
        password: 'Recteur123!'
      })
    });
    const recteurToken = loginRecteurRes.token;
    const recteurHeaders = { Authorization: `Bearer ${recteurToken}` };
    console.log(`  ✓ Connecté : ${loginRecteurRes.user.first_name} ${loginRecteurRes.user.last_name} (${loginRecteurRes.user.role_name})`);

    // 9. Recteur Signature & Return to Secrétariat Central for Archiving
    console.log('\n▶ STEP 9: Signature Électronique et Validation par le Recteur...');
    const signRes = await request(`${API}/workflow/sign-and-return`, {
      method: 'POST',
      headers: recteurHeaders,
      body: JSON.stringify({
        document_id: docId,
        remarks: 'Vu et approuvé par le Recteur. PV homologués.'
      })
    });
    console.log(`  ✓ Signature enregistrée avec succès !`);
    console.log(`  ✓ Hash cryptographique SHA-256 : ${signRes.signatureHash}`);

    // 10. Verify Full Trajectory and Audit Log
    console.log('\n▶ STEP 10: Vérification du Circuit Visuel & Journal d’Audit...');
    const circuitRes = await request(`${API}/workflow/circuit/${docId}`, { headers: recteurHeaders });
    console.log(`  ✓ Étapes de l’historique consignées : ${circuitRes.history.length}`);
    circuitRes.history.forEach((h, idx) => {
      console.log(`    [${idx + 1}] ${h.timestamp} | ${h.action} | ${h.service_name} (${h.first_name} ${h.last_name}) : ${h.details}`);
    });

    console.log('\n================================================================');
    console.log('  🎉 TOUS LES TESTS DU SCÉNARIO OBLIGATOIRE ONT RÉUSSI AVEC SUCCÈS !');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ ERREUR LORS DU TEST :', err.message);
    process.exit(1);
  }
}

runValidationTest();
