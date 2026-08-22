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

async function runCustomArchiveCategoriesTestSuite() {
  console.log('==================================================================================');
  console.log('  TEST SUITE : CRÉATION & GESTION DES CATÉGORIES D’ARCHIVAGE PAR SERVICE (UK-GED)');
  console.log('==================================================================================\n');

  try {
    // 0. Connexion des comptes de test
    console.log('▶ [0. INITIALISATION] : Connexion des comptes de test...');
    
    // Admin
    const loginAdmin = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' })
    });
    if (!loginAdmin.ok) throw new Error('Connexion admin échouée : ' + JSON.stringify(loginAdmin.data));
    const adminHeaders = { Authorization: `Bearer ${loginAdmin.data.token}` };

    // Chef Département INFO (autorisé)
    const loginChefInfo = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'chef_info@univ-kindia.edu.gn', password: 'Chef123!' })
    });
    if (!loginChefInfo.ok) throw new Error('Connexion chef_info échouée : ' + JSON.stringify(loginChefInfo.data));
    const chefInfoHeaders = { Authorization: `Bearer ${loginChefInfo.data.token}` };

    // Agent Département INFO (standard, sans permission de gestion)
    const loginAgentInfo = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'agent_info@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    const agentInfoHeaders = { Authorization: `Bearer ${loginAgentInfo.data.token}` };

    // Chef Département Math (autorisé pour son service)
    const loginChefMath = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'chef_math@univ-kindia.edu.gn', password: 'Chef123!' })
    });
    const chefMathHeaders = { Authorization: `Bearer ${loginChefMath.data.token}` };

    // Agent Département Math
    const loginAgentMath = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'agent_math@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    const agentMathHeaders = { Authorization: `Bearer ${loginAgentMath.data.token}` };

    console.log('  ✓ Comptes connectés avec succès.\n');

    // 0b. Nettoyage idempotent
    const existingInfoCats = await request(`${API}/archive-categories`, { headers: chefInfoHeaders });
    for (const c of existingInfoCats.data.customs || []) {
      if (c.name.toLowerCase().includes('projet') || c.name.toLowerCase().includes('thèse')) {
        await request(`${API}/archive-categories/${c.id}/move-documents`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ target_category_code: 'AUTRE' })
        });
        await request(`${API}/archive-categories/${c.id}`, {
          method: 'DELETE',
          headers: adminHeaders
        });
      }
    }

    const existingMathCats = await request(`${API}/archive-categories`, { headers: chefMathHeaders });
    for (const c of existingMathCats.data.customs || []) {
      if (c.name.toLowerCase().includes('projet') || c.name.toLowerCase().includes('thèse')) {
        await request(`${API}/archive-categories/${c.id}/move-documents`, {
          method: 'POST',
          headers: adminHeaders,
          body: JSON.stringify({ target_category_code: 'AUTRE' })
        });
        await request(`${API}/archive-categories/${c.id}`, {
          method: 'DELETE',
          headers: adminHeaders
        });
      }
    }

    // -------------------------------------------------------------------------
    // TEST 1 : Création d'une catégorie personnalisée par le Département d'Informatique
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 1] : Création de la catégorie « Documents de projets » par le Département INFO...');
    const catName = 'Documents de projets';
    const catDesc = 'Documents administratifs et techniques liés aux projets du département';

    const createCatRes = await request(`${API}/archive-categories`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        name: catName,
        description: catDesc,
        icon: 'Briefcase',
        color: 'text-teal-700 bg-teal-50 border-teal-200',
        display_order: 15
      })
    });

    if (!createCatRes.ok) {
      throw new Error(`Échec création catégorie : ${createCatRes.status} - ${JSON.stringify(createCatRes.data)}`);
    }

    const customCatInfo = createCatRes.data.category;
    console.log(`  ✓ Catégorie créée avec succès : ID=${customCatInfo.id}, Code=${customCatInfo.code}, Nom="${customCatInfo.name}"`);
    console.log('  🎉 TEST 1 RÉUSSI : Création de catégorie personnalisée de service validée !\n');

    // -------------------------------------------------------------------------
    // TEST 2 : Vérification des doublons dans le MÊME service
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 2] : Tentative de création d’un doublon portant le même nom dans le MÊME service...');
    const duplicateRes = await request(`${API}/archive-categories`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        name: 'documents de projets', // Case insensitive test
        description: 'Tentative de doublon',
        icon: 'Folder'
      })
    });

    if (duplicateRes.status === 400) {
      console.log(`  ✓ Doublon correctement rejeté avec le message : "${duplicateRes.data.error}"`);
      console.log('  🎉 TEST 2 RÉUSSI : Contrôle d’unicité par service effectif !\n');
    } else {
      throw new Error(`ÉCHEC DU TEST 2 : Le serveur a autorisé la duplication (${duplicateRes.status})`);
    }

    // -------------------------------------------------------------------------
    // TEST 3 : Isolation Inter-Services (Deny by Default)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 3] : Vérification que le Département de Mathématiques ne voit PAS la catégorie privée d’INFO...');
    const mathCatsRes = await request(`${API}/archive-categories`, { headers: chefMathHeaders });
    const hasInfoCatInMath = mathCatsRes.data.customs.some(c => c.id === customCatInfo.id || c.code === customCatInfo.code);
    
    if (hasInfoCatInMath) {
      throw new Error('ÉCHEC DU TEST 3 : La catégorie privée du Dept INFO est visible par le Dept Math !');
    }
    console.log('  ✓ La catégorie privée du Département INFO n’apparaît pas dans l’espace du Département Math.');
    console.log('  🎉 TEST 3 RÉUSSI : Isolation stricte des catégories par service validée !\n');

    // -------------------------------------------------------------------------
    // TEST 4 : Création autorisée du MÊME nom dans un AUTRE service (Math)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 4] : Création autorisée de « Documents de projets » dans un AUTRE service (Math)...');
    const mathCreateRes = await request(`${API}/archive-categories`, {
      method: 'POST',
      headers: chefMathHeaders,
      body: JSON.stringify({
        name: 'Documents de projets',
        description: 'Projets de recherche mathématique',
        icon: 'Layers'
      })
    });

    if (!mathCreateRes.ok) {
      throw new Error(`Échec création dans autre service : ${mathCreateRes.status} - ${JSON.stringify(mathCreateRes.data)}`);
    }
    console.log(`  ✓ Catégorie créée pour Math avec ID=${mathCreateRes.data.category.id}`);
    console.log('  🎉 TEST 4 RÉUSSI : Homonymie permise entre services distincts !\n');

    // -------------------------------------------------------------------------
    // TEST 5 : Archivage d'un document dans la catégorie personnalisée
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 5] : Création et Archivage d’un document dans la catégorie personnalisée INFO...');
    const docRes = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        document_type: customCatInfo.code,
        title: 'Rapport Annuel du Projet Campus Numérique UK',
        object_title: 'Rapport Annuel du Projet Campus Numérique UK',
        content_body: 'Bilan technique et financier de la phase 1',
        action: 'SUBMIT'
      })
    });

    const docId = docRes.data.id;
    console.log(`  ✓ Document créé avec ID : ${docId}`);

    // Archive it with custom_category_id
    const archiveRes = await request(`${API}/documents/${docId}/archive-service`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        archive_scope: 'PRIVE_SERVICE',
        custom_category_id: customCatInfo.id,
        archive_category: customCatInfo.name
      })
    });

    if (!archiveRes.ok) {
      throw new Error(`Échec archivage dans catégorie personnalisée : ${JSON.stringify(archiveRes.data)}`);
    }

    // Check categories summary in GET /archives
    const archivesRes = await request(`${API}/documents/archives`, { headers: chefInfoHeaders });
    const summary = archivesRes.data.categories_summary;
    const projectCatSummary = summary.find(c => c.code === customCatInfo.code || c.id === customCatInfo.id);

    console.log(`  ✓ Compteur pour « ${customCatInfo.name} » : ${projectCatSummary ? projectCatSummary.count : 0} (Attendu = 1)`);
    if (!projectCatSummary || projectCatSummary.count !== 1) {
      throw new Error('ÉCHEC DU TEST 5 : Le compteur de la catégorie personnalisée n’est pas passé à 1 !');
    }
    console.log('  🎉 TEST 5 RÉUSSI : Document archivé et compteur incrémenté avec succès !\n');

    // -------------------------------------------------------------------------
    // TEST 6 : Filtrage par la catégorie personnalisée
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 6] : Consultation filtrée de la catégorie personnalisée...');
    const filteredRes = await request(`${API}/documents/archives?category=${customCatInfo.code}`, {
      headers: chefInfoHeaders
    });

    const docs = filteredRes.data.documents;
    console.log(`  ✓ Nombre de documents retournés : ${docs.length}`);
    if (docs.length !== 1 || docs[0].id !== docId) {
      throw new Error('ÉCHEC DU TEST 6 : Le document archivé n’est pas retourné lors du filtrage par sa catégorie !');
    }
    console.log(`  ✓ Document trouvé : Réf "${docs[0].reference}" - Titre "${docs[0].title}"`);
    console.log('  🎉 TEST 6 RÉUSSI : Consultation exclusive de la catégorie personnalisée validée !\n');

    // -------------------------------------------------------------------------
    // TEST 7 : Protection contre la suppression si documents présents
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 7] : Tentative de suppression d’une catégorie contenant des documents...');
    const deleteBlockedRes = await request(`${API}/archive-categories/${customCatInfo.id}`, {
      method: 'DELETE',
      headers: adminHeaders
    });

    if (deleteBlockedRes.status === 400) {
      console.log(`  ✓ Suppression bloquée avec succès : "${deleteBlockedRes.data.error}"`);
      console.log('  🎉 TEST 7 RÉUSSI : Protection contre la suppression accidentelle validée !\n');
    } else {
      throw new Error('ÉCHEC DU TEST 7 : La catégorie contenant des documents a été supprimée sans avertissement !');
    }

    // -------------------------------------------------------------------------
    // TEST 8 : Déplacement des documents et suppression ultérieure
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 8] : Déplacement des documents vers « AUTRE » puis suppression...');
    const moveRes = await request(`${API}/archive-categories/${customCatInfo.id}/move-documents`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ target_category_code: 'AUTRE' })
    });
    if (!moveRes.ok) throw new Error('Échec déplacement documents : ' + JSON.stringify(moveRes.data));

    const deleteSuccessRes = await request(`${API}/archive-categories/${customCatInfo.id}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    if (!deleteSuccessRes.ok) throw new Error('Échec suppression après déplacement : ' + JSON.stringify(deleteSuccessRes.data));

    console.log('  ✓ Documents déplacés et catégorie supprimée proprement.');
    console.log('  🎉 TEST 8 RÉUSSI : Déplacement et nettoyage sécurisé validés !\n');

    // -------------------------------------------------------------------------
    // TEST 9 : Contrôle de Permission (Utilisateur standard sans droit)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 9] : Vérification que les utilisateurs standards ne peuvent pas modifier les catégories...');
    const stdCreateRes = await request(`${API}/archive-categories`, {
      method: 'POST',
      headers: agentInfoHeaders,
      body: JSON.stringify({
        name: 'Catégorie Non Autorisée'
      })
    });

    if (stdCreateRes.status === 403) {
      console.log(`  ✓ Requête correctement bloquée par le contrôle de permission 403 (${stdCreateRes.data.error})`);
      console.log('  🎉 TEST 9 RÉUSSI : Contrôle des permissions RBAC/ABAC vérifié !\n');
    } else {
      throw new Error(`ÉCHEC DU TEST 9 : L’utilisateur sans droit a pu créer une catégorie (${stdCreateRes.status})`);
    }

    console.log('==================================================================================');
    console.log('  🌟 TOUS LES TESTS DES CATÉGORIES D’ARCHIVAGE PERSONNALISÉES SONT VALIDÉS (100%) !');
    console.log('==================================================================================\n');

  } catch (err) {
    console.error('\n❌ ÉCHEC DU TEST DES CATÉGORIES PERSONNALISÉES :', err.message);
    process.exit(1);
  }
}

runCustomArchiveCategoriesTestSuite();
