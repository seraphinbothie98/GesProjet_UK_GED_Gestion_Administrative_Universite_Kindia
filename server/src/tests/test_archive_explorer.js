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

async function runArchiveExplorerTestSuite() {
  console.log('==================================================================================');
  console.log('  TEST SUITE : EXPLORATEUR D’ARCHIVAGE À 2 PANNEAUX & VISIONNEUSE (UK-GED)');
  console.log('==================================================================================\n');

  try {
    // 0. Initialisation des comptes
    console.log('▶ [0. INITIALISATION] : Connexion des comptes de test...');
    const loginChef = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'chef_info@univ-kindia.edu.gn', password: 'Chef123!' })
    });
    if (!loginChef.ok) throw new Error('Connexion chef_info échouée : ' + JSON.stringify(loginChef.data));
    const chefHeaders = { Authorization: `Bearer ${loginChef.data.token}` };

    console.log('  ✓ Compte Chef INFO connecté.\n');

    // -------------------------------------------------------------------------
    // TEST 1 : Chargement vue par défaut (Toutes les archives 2026)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 1] : Chargement par défaut (Année 2026, Toutes les catégories)...');
    const res2026 = await request(`${API}/documents/archives?year=2026`, { headers: chefHeaders });
    if (!res2026.ok) throw new Error('Échec GET /archives 2026 : ' + JSON.stringify(res2026.data));

    const { categories_summary, documents } = res2026.data;
    console.log(`  ✓ Nombre de catégories listées : ${categories_summary.length}`);
    console.log(`  ✓ Nombre total de documents archivés en 2026 : ${documents.length}`);
    
    if (!Array.isArray(categories_summary) || categories_summary.length === 0) {
      throw new Error('ÉCHEC DU TEST 1 : Aucune catégorie retournée pour le panneau gauche !');
    }
    console.log('  🎉 TEST 1 RÉUSSI : Panneau gauche des dossiers et vue globale 2026 validés !\n');

    // -------------------------------------------------------------------------
    // TEST 2 : Sélection d'un dossier standard (Arrêtés)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 2] : Sélection du dossier « Arrêtés »...');
    const resArrete = await request(`${API}/documents/archives?year=2026&category=ARRETE`, { headers: chefHeaders });
    if (!resArrete.ok) throw new Error('Échec filtrage Arrêtés : ' + JSON.stringify(resArrete.data));

    const arreteDocs = resArrete.data.documents;
    console.log(`  ✓ Nombre d’arrêtés retournés à droite : ${arreteDocs.length}`);
    const hasNonArrete = arreteDocs.some(d => (d.document_type || '').toUpperCase() !== 'ARRETE');
    if (hasNonArrete) {
      throw new Error('ÉCHEC DU TEST 2 : Des documents d’un autre type sont apparus dans le dossier Arrêtés !');
    }
    console.log('  🎉 TEST 2 RÉUSSI : Filtrage instantané du dossier Arrêtés validé !\n');

    // -------------------------------------------------------------------------
    // TEST 3 : Sélection d'un dossier standard (Notes de service)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 3] : Création & Sélection du dossier « Notes de service »...');
    const noteDocRes = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: chefHeaders,
      body: JSON.stringify({
        document_type: 'NOTE_SERVICE',
        title: 'Note de service sur les congés académiques',
        object_title: 'Note de service sur les congés académiques',
        content_body: 'Modalités d’organisation des congés',
        action: 'SUBMIT'
      })
    });
    await request(`${API}/documents/${noteDocRes.data.id}/archive-service`, {
      method: 'POST',
      headers: chefHeaders,
      body: JSON.stringify({ archive_scope: 'PRIVE_SERVICE' })
    });

    const resNotes = await request(`${API}/documents/archives?year=2026&category=NOTE_SERVICE`, { headers: chefHeaders });
    const noteDocs = resNotes.data.documents;
    console.log(`  ✓ Nombre de notes de service retournées : ${noteDocs.length}`);
    if (noteDocs.length === 0) {
      throw new Error('ÉCHEC DU TEST 3 : La note de service archivée n’apparaît pas !');
    }
    console.log('  🎉 TEST 3 RÉUSSI : Dossier Notes de service validé !\n');

    // -------------------------------------------------------------------------
    // TEST 4 : Recherche textuelle dans le dossier d'archives
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 4] : Recherche textuelle sur « congés »...');
    const searchRes = await request(`${API}/documents/archives?year=2026&search=congés`, { headers: chefHeaders });
    const searchDocs = searchRes.data.documents;
    console.log(`  ✓ Résultats trouvés pour « congés » : ${searchDocs.length}`);
    if (searchDocs.length === 0 || !searchDocs.some(d => d.title.includes('congés'))) {
      throw new Error('ÉCHEC DU TEST 4 : La recherche textuelle n’a pas retourné le document attendu !');
    }
    console.log('  🎉 TEST 4 RÉUSSI : Recherche multi-critères validée !\n');

    // -------------------------------------------------------------------------
    // TEST 5 : Consultation détaillée d'un document (Lecteur & Métadonnées)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 5] : Consultation des détails d’un document pour la visionneuse latérale...');
    const targetDocId = noteDocRes.data.id;
    const detailRes = await request(`${API}/documents/${targetDocId}`, { headers: chefHeaders });
    if (!detailRes.ok) throw new Error('Échec GET document detail : ' + JSON.stringify(detailRes.data));

    const docDetail = detailRes.data;
    console.log(`  ✓ Réf : ${docDetail.reference}`);
    console.log(`  ✓ Titre : ${docDetail.title}`);
    console.log(`  ✓ Service émetteur : ${docDetail.originating_service ? docDetail.originating_service.name : 'FS_INFO'}`);
    console.log(`  ✓ Historique d’événements : ${docDetail.history ? docDetail.history.length : 0} entrées`);

    if (!docDetail.reference || !docDetail.title || !docDetail.history) {
      throw new Error('ÉCHEC DU TEST 5 : Les métadonnées complètes ou l’historique sont manquants !');
    }
    console.log('  🎉 TEST 5 RÉUSSI : Données pour visionneuse et lecteur intégrés 100% complètes !\n');

    console.log('==================================================================================');
    console.log('  🌟 TOUS LES TESTS DE L’EXPLORATEUR D’ARCHIVAGE À 2 PANNEAUX ONT RÉUSSI (100%) !');
    console.log('==================================================================================\n');

  } catch (err) {
    console.error('\n❌ ÉCHEC DU TEST DE L’EXPLORATEUR D’ARCHIVES :', err.message);
    process.exit(1);
  }
}

runArchiveExplorerTestSuite();
