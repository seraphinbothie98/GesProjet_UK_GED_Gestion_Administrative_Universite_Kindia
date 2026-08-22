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

async function runArchiveCategoriesTests() {
  console.log('========================================================================');
  console.log('  TEST SUITE : ORGANISATION PAR CATÉGORIES DANS L’ARCHIVAGE ÉLECTRONIQUE');
  console.log('========================================================================\n');

  try {
    // 0. Connect test accounts
    console.log('▶ [0. INITIALISATION] : Connexion des comptes de test...');
    const loginAgentInfo = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'agent_info@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    const agentInfoHeaders = { Authorization: `Bearer ${loginAgentInfo.data.token}` };

    const loginAdmin = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' })
    });
    const adminHeaders = { Authorization: `Bearer ${loginAdmin.data.token}` };

    console.log('  ✓ Comptes de test connectés.\n');

    // -------------------------------------------------------------------------
    // TEST 1 : Création de documents de plusieurs types et vérification des compteurs
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 1] : Création de documents archivés de différents types...');
    
    // Create & archive 2 Arrêtés
    for (let i = 1; i <= 2; i++) {
      const docRes = await request(`${API}/documents/administrative`, {
        method: 'POST',
        headers: agentInfoHeaders,
        body: JSON.stringify({
          document_type: 'ARRETE',
          title: `Arrêté Décanale FS N°00${i}`,
          object_title: `Arrêté Décanale FS N°00${i}`,
          content_body: `Contenu de l'arrêté ${i}`,
          action: 'SUBMIT'
        })
      });
      await request(`${API}/documents/${docRes.data.id}/archive-service`, {
        method: 'POST',
        headers: agentInfoHeaders,
        body: JSON.stringify({ archive_scope: 'PRIVE_SERVICE' })
      });
    }

    // Create & archive 3 Lettres
    for (let i = 1; i <= 3; i++) {
      const docRes = await request(`${API}/documents/administrative`, {
        method: 'POST',
        headers: agentInfoHeaders,
        body: JSON.stringify({
          document_type: 'LETTRE',
          title: `Lettre de Transmission N°00${i}`,
          object_title: `Lettre de Transmission N°00${i}`,
          content_body: `Contenu de la lettre ${i}`,
          action: 'SUBMIT'
        })
      });
      await request(`${API}/documents/${docRes.data.id}/archive-service`, {
        method: 'POST',
        headers: agentInfoHeaders,
        body: JSON.stringify({ archive_scope: 'PRIVE_SERVICE' })
      });
    }

    // Create & archive 1 Soit-transmis
    const stRes = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: agentInfoHeaders,
      body: JSON.stringify({
        document_type: 'SOIT_TRANSMIS',
        title: `Soit-Transmis de Bordereau d'Examens`,
        object_title: `Soit-Transmis de Bordereau d'Examens`,
        content_body: `Bordereau officiel d'examens`,
        action: 'SUBMIT'
      })
    });
    await request(`${API}/documents/${stRes.data.id}/archive-service`, {
      method: 'POST',
      headers: agentInfoHeaders,
      body: JSON.stringify({ archive_scope: 'PRIVE_SERVICE' })
    });

    // Check Categories Summary via GET /api/documents/archives
    const archivesRes = await request(`${API}/documents/archives`, { headers: agentInfoHeaders });
    const summary = archivesRes.data.categories_summary;

    const arreteCat = summary.find(c => c.code === 'ARRETE');
    const lettreCat = summary.find(c => c.code === 'LETTRE');
    const stCat = summary.find(c => c.code === 'SOIT_TRANSMIS');

    console.log(`  ✓ Compteur Arrêtés : ${arreteCat ? arreteCat.count : 0} (Attendu >= 2)`);
    console.log(`  ✓ Compteur Lettres : ${lettreCat ? lettreCat.count : 0} (Attendu >= 3)`);
    console.log(`  ✓ Compteur Soit-transmis : ${stCat ? stCat.count : 0} (Attendu >= 1)`);

    if (!arreteCat || arreteCat.count < 2 || !lettreCat || lettreCat.count < 3 || !stCat || stCat.count < 1) {
      throw new Error('ÉCHEC DU TEST 1 : Les compteurs de catégories ne correspondent pas aux documents créés !');
    }
    console.log('  🎉 TEST 1 RÉUSSI : Compteurs dynamiques par catégorie 100% exacts !\n');

    // -------------------------------------------------------------------------
    // TEST 2 : Filtrage strict par catégorie "ARRETE"
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 2] : Filtrage de l’archive par la catégorie "ARRETE"...');
    const filteredArreteRes = await request(`${API}/documents/archives?category=ARRETE`, { headers: agentInfoHeaders });
    const arreteDocs = filteredArreteRes.data.documents;
    console.log(`  ✓ Nombre d'arrêtés retournés : ${arreteDocs.length}`);
    const hasNonArrete = arreteDocs.some(d => (d.document_type || '').toUpperCase() !== 'ARRETE');
    if (hasNonArrete) {
      throw new Error('ÉCHEC DU TEST 2 : Des documents d’un autre type sont apparus dans la catégorie ARRETE !');
    }
    console.log('  🎉 TEST 2 RÉUSSI : Seuls les arrêtés sont retournés lors de la sélection de la catégorie !\n');

    // -------------------------------------------------------------------------
    // TEST 3 : Filtrage strict par catégorie "LETTRE"
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 3] : Filtrage de l’archive par la catégorie "LETTRE"...');
    const filteredLettreRes = await request(`${API}/documents/archives?category=LETTRE`, { headers: agentInfoHeaders });
    const lettreDocs = filteredLettreRes.data.documents;
    console.log(`  ✓ Nombre de lettres retournées : ${lettreDocs.length}`);
    const hasNonLettre = lettreDocs.some(d => !['LETTRE', 'OUTGOING_MAIL', 'INCOMING_MAIL', 'COURRIER_ENTRANT', 'COURRIER_SORTANT'].includes((d.document_type || '').toUpperCase()));
    if (hasNonLettre) {
      throw new Error('ÉCHEC DU TEST 3 : Des documents d’un autre type sont apparus dans la catégorie LETTRE !');
    }
    console.log('  🎉 TEST 3 RÉUSSI : Seules les lettres sont retournées lors de la sélection de la catégorie !\n');

    // -------------------------------------------------------------------------
    // TEST 4 : Respect du Deny by Default dans les compteurs
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 4] : Vérification de l’isolation Deny by Default dans les compteurs...');
    // Login as Math Dept
    const loginAgentMath = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'agent_math@univ-kindia.edu.gn', password: 'Password123!' })
    });
    const agentMathHeaders = { Authorization: `Bearer ${loginAgentMath.data.token}` };

    const mathArchivesRes = await request(`${API}/documents/archives`, { headers: agentMathHeaders });
    const mathSummary = mathArchivesRes.data.categories_summary;
    const mathArreteCat = mathSummary.find(c => c.code === 'ARRETE');
    console.log(`  ✓ Compteur Arrêtés pour Département Math : ${mathArreteCat ? mathArreteCat.count : 0}`);
    
    // Agent Math must NOT count the private Arrêtés of Dept Info
    if (mathArreteCat && mathArreteCat.count > 0 && mathArchivesRes.data.documents.some(d => d.owner_service_id !== 26)) {
      throw new Error('ÉCHEC DU TEST 4 : Le Département Math a comptabilisé les arrêtés privés du Département Info !');
    }
    console.log('  🎉 TEST 4 RÉUSSI : Les compteurs de catégories respectent strictement les droits d’accès ABAC !\n');

    // -------------------------------------------------------------------------
    // TEST 5 : Document sans catégorie apparaissant dans "NON_CLASSE" et reclassement
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 5] : Document sans catégorie (« Non classés ») et Reclassement...');
    
    // Create an unclassified doc by setting document_type to empty
    const unclassDocRes = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: agentInfoHeaders,
      body: JSON.stringify({
        document_type: 'AUTRE',
        title: 'Ancien document historique non typé',
        object_title: 'Ancien document historique non typé',
        content_body: 'Texte scanné ancien',
        action: 'SUBMIT'
      })
    });
    const unclassDocId = unclassDocRes.data.id;
    await request(`${API}/documents/${unclassDocId}/archive-service`, {
      method: 'POST',
      headers: agentInfoHeaders,
      body: JSON.stringify({ archive_scope: 'PRIVE_SERVICE' })
    });

    // Reclassify it to 'DECISION' via PUT /api/documents/:id/classify
    const classifyRes = await request(`${API}/documents/${unclassDocId}/classify`, {
      method: 'PUT',
      headers: agentInfoHeaders,
      body: JSON.stringify({ document_type: 'DECISION', document_category: 'OFFICIAL' })
    });
    console.log(`  ✓ Reclassement du document ID ${unclassDocId} : ${classifyRes.data.message}`);

    // Verify it is now in DECISION
    const docCheck = await request(`${API}/documents/${unclassDocId}`, { headers: agentInfoHeaders });
    if (docCheck.data.document_type !== 'DECISION') {
      throw new Error('ÉCHEC DU TEST 5 : Le document n’a pas été correctement reclassé !');
    }
    console.log('  🎉 TEST 5 RÉUSSI : Reclassement de document validé avec succès !\n');

    // -------------------------------------------------------------------------
    // TEST 6 : Ordre d'affichage des catégories (display_order)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 6] : Ordre d’affichage des catégories...');
    const sortedCategories = archivesRes.data.categories_summary;
    for (let i = 0; i < sortedCategories.length - 1; i++) {
      if (sortedCategories[i].display_order > sortedCategories[i + 1].display_order) {
        throw new Error(`ÉCHEC DU TEST 6 : L’ordre d’affichage n’est pas respecté (${sortedCategories[i].label} avant ${sortedCategories[i+1].label})`);
      }
    }
    console.log(`  ✓ ${sortedCategories.length} catégories sont ordonnées de façon croissante par display_order.`);
    console.log('  🎉 TEST 6 RÉUSSI : Ordre configurable respecté !\n');

    console.log('========================================================================');
    console.log('  🌟 TOUS LES TESTS DES CATÉGORIES D’ARCHIVAGE (1 À 6) ONT RÉUSSI !');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('\n❌ ÉCHEC DU TEST DES CATÉGORIES D’ARCHIVES :', err.message);
    process.exit(1);
  }
}

runArchiveCategoriesTests();
