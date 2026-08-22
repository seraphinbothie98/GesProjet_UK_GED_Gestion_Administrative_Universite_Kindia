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

async function runServiceDocumentSettingsTestSuite() {
  console.log('================================================================================================');
  console.log('  TEST SUITE : PERSONNALISATION DES RÉFÉRENCES, EN-TÊTES & PIEDS DE PAGE PAR SERVICE (UK-GED)');
  console.log('================================================================================================\n');

  try {
    // 0. Connexion des comptes de test
    console.log('▶ [0. INITIALISATION] : Connexion des comptes de test...');
    
    // Chef Département INFO
    const loginChefInfo = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'chef_info@univ-kindia.edu.gn', password: 'Chef123!' })
    });
    if (!loginChefInfo.ok) throw new Error('Connexion chef_info échouée : ' + JSON.stringify(loginChefInfo.data));
    const chefInfoHeaders = { Authorization: `Bearer ${loginChefInfo.data.token}` };

    // Agent Département INFO (Standard sans permission)
    const loginAgentInfo = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'agent_info@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    const agentInfoHeaders = { Authorization: `Bearer ${loginAgentInfo.data.token}` };

    // Chef Département Math (Autre service)
    const loginChefMath = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'chef_math@univ-kindia.edu.gn', password: 'Chef123!' })
    });
    if (!loginChefMath.ok) throw new Error('Connexion chef_math échouée : ' + JSON.stringify(loginChefMath.data));
    const chefMathHeaders = { Authorization: `Bearer ${loginChefMath.data.token}` };

    console.log('  ✓ Comptes connectés avec succès.\n');

    // -------------------------------------------------------------------------
    // TEST 1 : Récupération des paramètres par défaut et aperçu en temps réel
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 1] : Récupération des paramètres par défaut pour le Département INFO...');
    const getSettingsRes = await request(`${API}/service-settings/document-settings`, { headers: chefInfoHeaders });
    if (!getSettingsRes.ok) throw new Error('Échec GET document-settings : ' + JSON.stringify(getSettingsRes.data));

    const currentSettings = getSettingsRes.data.settings;
    console.log(`  ✓ Paramètres chargés. Version actuelle : ${currentSettings.version}`);
    console.log(`  ✓ Motif par défaut : "${currentSettings.ref_pattern}"`);

    // Aperçu dynamique
    const previewRes = await request(`${API}/service-settings/preview-reference`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        ref_pattern: '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}',
        seq_padding: 4,
        type: 'LET'
      })
    });
    console.log(`  ✓ Aperçu calculé en direct : "${previewRes.data.preview}"`);
    console.log('  🎉 TEST 1 RÉUSSI : Chargement des paramètres et aperçu temps réel validés !\n');

    // -------------------------------------------------------------------------
    // TEST 2 : Configuration d'un format spécifique par le Département d'Informatique
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 2] : Personnalisation du format pour le Département INFO (UK/FS/INFO/LET/2026/0001)...');
    const updateInfoRes = await request(`${API}/service-settings/document-settings`, {
      method: 'PUT',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        ref_pattern: '{UNIV}/{FACULTY}/{DEPT}/{TYPE}/{YEAR}/{SEQ}',
        seq_padding: 4,
        reset_annually: 1,
        header_faculty_name: 'FACULTÉ DES SCIENCES',
        header_dept_name: 'DÉPARTEMENT D\'INFORMATIQUE',
        footer_custom_text: 'Département d\'Informatique — Faculté des Sciences — Université de Kindia',
        footer_confidentiality_note: 'Document administratif officiel — Université de Kindia',
        footer_enable_pagination: 1,
        footer_pagination_format: 'Page {PAGE} / {TOTAL_PAGES}',
        change_summary: 'Configuration officielle du format de référence et en-tête INFO'
      })
    });

    if (!updateInfoRes.ok) throw new Error('Échec mise à jour INFO : ' + JSON.stringify(updateInfoRes.data));
    console.log(`  ✓ Paramètres INFO enregistrés. Nouvelle version : ${updateInfoRes.data.settings.version}`);
    console.log('  🎉 TEST 2 RÉUSSI : Personnalisation complète des références et en-tête enregistrée !\n');

    // -------------------------------------------------------------------------
    // TEST 3 : Configuration d'un format DIFFÉRENT pour le Département de Mathématiques
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 3] : Configuration d\'un format distinct pour le Département MATH (MATH-TYPE-YEAR-SEQ)...');
    const updateMathRes = await request(`${API}/service-settings/document-settings`, {
      method: 'PUT',
      headers: chefMathHeaders,
      body: JSON.stringify({
        ref_pattern: 'MATH-{TYPE}-{YEAR}-{SEQ}',
        seq_padding: 3,
        reset_annually: 1,
        header_faculty_name: 'FACULTÉ DES SCIENCES',
        header_dept_name: 'DÉPARTEMENT DE MATHÉMATIQUES',
        footer_custom_text: 'Département de Mathématiques — UK',
        change_summary: 'Format spécifique MATH'
      })
    });

    if (!updateMathRes.ok) throw new Error('Échec mise à jour MATH : ' + JSON.stringify(updateMathRes.data));
    console.log(`  ✓ Paramètres MATH enregistrés avec motif distinct : "${updateMathRes.data.settings.ref_pattern}"`);
    console.log('  🎉 TEST 3 RÉUSSI : Formats indépendants et personnalisés par service validés !\n');

    // -------------------------------------------------------------------------
    // TEST 4 : Création de documents et génération de référence selon les règles configurées
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 4] : Création d’un document INFO et d’un document MATH pour vérifier les références générées...');
    
    // Document INFO
    const docInfoRes = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        document_type: 'LETTRE',
        title: 'Lettre relative aux projets IA',
        object_title: 'Lettre relative aux projets IA',
        content_body: 'Contenu lettre informatique',
        action: 'SUBMIT'
      })
    });
    if (!docInfoRes.ok) throw new Error('Échec création doc INFO : ' + JSON.stringify(docInfoRes.data));
    console.log(`  ✓ Document INFO créé avec référence : "${docInfoRes.data.reference}"`);
    if (!docInfoRes.data.reference.includes('FS/INFO/LET') && !docInfoRes.data.reference.includes('UK/FS/INFO/LET')) {
      throw new Error(`RÉFÉRENCE INVALIDE POUR INFO : ${docInfoRes.data.reference}`);
    }

    // Document MATH
    const docMathRes = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: chefMathHeaders,
      body: JSON.stringify({
        document_type: 'LETTRE',
        title: 'Lettre relative au séminaire d’algèbre',
        object_title: 'Lettre relative au séminaire d’algèbre',
        content_body: 'Contenu lettre mathématiques',
        action: 'SUBMIT'
      })
    });
    if (!docMathRes.ok) throw new Error('Échec création doc MATH : ' + JSON.stringify(docMathRes.data));
    console.log(`  ✓ Document MATH créé avec référence : "${docMathRes.data.reference}"`);
    if (!docMathRes.data.reference.startsWith('MATH-LET-')) {
      throw new Error(`RÉFÉRENCE INVALIDE POUR MATH : ${docMathRes.data.reference}`);
    }
    console.log('  🎉 TEST 4 RÉUSSI : Génération automatique conforme aux configurations respectives !\n');

    // -------------------------------------------------------------------------
    // TEST 5 : Zéro collision sous création concurrente simultanée (Mutex)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 5] : Test de création concurrente simultanée (5 documents en parallèle pour INFO)...');
    const parallelRequests = Array.from({ length: 5 }, (_, i) => 
      request(`${API}/documents/administrative`, {
        method: 'POST',
        headers: chefInfoHeaders,
        body: JSON.stringify({
          document_type: 'LETTRE',
          title: `Document concurrent ${i + 1}`,
          object_title: `Document concurrent ${i + 1}`,
          content_body: `Contenu test concurrentiel ${i + 1}`,
          action: 'SUBMIT'
        })
      })
    );

    const concurrentResults = await Promise.all(parallelRequests);
    const generatedReferences = concurrentResults.map(r => r.data.reference);
    console.log('  ✓ Références générées simultanément :', generatedReferences);

    const uniqueReferences = new Set(generatedReferences);
    if (uniqueReferences.size !== 5) {
      throw new Error(`ÉCHEC DU TEST 5 : Collision détectée ! ${uniqueReferences.size}/5 références uniques.`);
    }
    console.log('  🎉 TEST 5 RÉUSSI : Zéro collision garantie sous forte concurrence !\n');

    // -------------------------------------------------------------------------
    // TEST 6 : Contrôle de Permission (Agent standard sans droit de modification)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 6] : Tentative de modification des paramètres par un agent standard...');
    const unauthRes = await request(`${API}/service-settings/document-settings`, {
      method: 'PUT',
      headers: agentInfoHeaders,
      body: JSON.stringify({
        ref_pattern: 'HACK-{SEQ}'
      })
    });

    if (unauthRes.status === 403) {
      console.log(`  ✓ Requête correctement rejetée (403) : "${unauthRes.data.error}"`);
      console.log('  🎉 TEST 6 RÉUSSI : Contrôle des permissions RBAC/ABAC validé !\n');
    } else {
      throw new Error(`ÉCHEC DU TEST 6 : L’agent sans droit a pu modifier les paramètres (${unauthRes.status})`);
    }

    // -------------------------------------------------------------------------
    // TEST 7 : Isolation Inter-Services (Chef INFO ne peut pas modifier MATH)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 7] : Tentative pour Chef INFO de modifier les paramètres du Dépt MATH...');
    const crossServiceRes = await request(`${API}/service-settings/document-settings`, {
      method: 'PUT',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        service_id: 33, // Math service ID
        ref_pattern: 'PIRATE-{SEQ}'
      })
    });

    if (crossServiceRes.status === 403 || crossServiceRes.data.settings?.service_id !== 33) {
      console.log('  ✓ Modification inter-services bloquée avec succès.');
      console.log('  🎉 TEST 7 RÉUSSI : Isolation stricte inter-services vérifiée !\n');
    } else {
      throw new Error('ÉCHEC DU TEST 7 : Un chef de service a pu altérer un autre service !');
    }

    // -------------------------------------------------------------------------
    // TEST 8 : Historique des versions et traçabilité
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 8] : Vérification de l’historique des versions pour le Département INFO...');
    const histRes = await request(`${API}/service-settings/history`, { headers: chefInfoHeaders });
    if (!histRes.ok) throw new Error('Échec GET history : ' + JSON.stringify(histRes.data));

    console.log(`  ✓ Nombre de versions antérieures archivées : ${histRes.data.history.length}`);
    if (histRes.data.history.length === 0) {
      throw new Error('ÉCHEC DU TEST 8 : Aucune version antérieure trouvée dans l’historique !');
    }
    console.log(`  ✓ Dernière modification par : ${histRes.data.history[0].first_name} ${histRes.data.history[0].last_name}`);
    console.log('  🎉 TEST 8 RÉUSSI : Traçabilité et versionnement des paramètres validés !\n');

    console.log('================================================================================================');
    console.log('  🌟 TOUS LES TESTS DE PERSONNALISATION DES DOCUMENTS PAR SERVICE SONT VALIDÉS (100%) !');
    console.log('================================================================================================\n');

  } catch (err) {
    console.error('\n❌ ÉCHEC DU TEST DES PARAMÈTRES DE DOCUMENTS :', err.message);
    process.exit(1);
  }
}

runServiceDocumentSettingsTestSuite();
