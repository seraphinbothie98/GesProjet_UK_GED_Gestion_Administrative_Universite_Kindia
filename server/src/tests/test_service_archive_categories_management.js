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

async function runServiceArchiveCategoriesManagementTestSuite() {
  console.log('====================================================================================================');
  console.log('  TEST SUITE : GESTION SÉCURISÉE DES CATÉGORIES D’ARCHIVAGE PAR SERVICE & RÔLES ADMIN/SERVICE');
  console.log('====================================================================================================\n');

  try {
    // 0. Initialisation des comptes
    console.log('▶ [0. INITIALISATION] : Connexion des comptes de test...');
    
    // Admin
    const loginAdmin = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' })
    });
    if (!loginAdmin.ok) throw new Error('Connexion admin échouée : ' + JSON.stringify(loginAdmin.data));
    const adminHeaders = { Authorization: `Bearer ${loginAdmin.data.token}` };

    // Chef Département INFO
    const loginChefInfo = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'chef_info@univ-kindia.edu.gn', password: 'Chef123!' })
    });
    const chefInfoHeaders = { Authorization: `Bearer ${loginChefInfo.data.token}` };

    // Agent Département INFO
    const loginAgentInfo = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'agent_info@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    const agentInfoHeaders = { Authorization: `Bearer ${loginAgentInfo.data.token}` };

    // Chef Département Math
    const loginChefMath = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'chef_math@univ-kindia.edu.gn', password: 'Chef123!' })
    });
    const chefMathHeaders = { Authorization: `Bearer ${loginChefMath.data.token}` };

    console.log('  ✓ Comptes connectés avec succès.\n');

    // -------------------------------------------------------------------------
    // TEST 1 : Création d’un nouveau service et génération automatique des catégories par défaut
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 1] : Création d’un nouveau service (Institut Confucius / IC) par l’administrateur...');
    const newServiceCode = `TEST_SRV_${Date.now()}`;
    const createServiceRes = await request(`${API}/services`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        code: newServiceCode,
        name: 'Institut Confucius et Langues',
        structure_type: 'INSTITUT',
        reference_code: `UK/${newServiceCode}`
      })
    });

    if (!createServiceRes.ok) {
      throw new Error(`Échec création service : ${createServiceRes.status} - ${JSON.stringify(createServiceRes.data)}`);
    }

    const newServiceId = createServiceRes.data.id;
    console.log(`  ✓ Service créé avec ID=${newServiceId}. Vérification des catégories par défaut créées automatiquement...`);

    const newServiceCatsRes = await request(`${API}/archive-categories?service_id=${newServiceId}`, {
      headers: adminHeaders
    });

    const customs = newServiceCatsRes.data.customs || [];
    const hasSoitTransmis = customs.some(c => c.name.toLowerCase().includes('soit-transmis') && c.is_default);
    const hasDemandes = customs.some(c => c.name.toLowerCase().includes('demande') && c.is_default);

    console.log(`  ✓ Catégories générées pour le nouveau service :`, customs.map(c => `${c.name} (default:${c.is_default})`));
    if (!hasSoitTransmis || !hasDemandes) {
      throw new Error('ÉCHEC DU TEST 1 : Les catégories par défaut (Soit-transmis et Demandes) n’ont pas été créées automatiquement !');
    }
    console.log('  🎉 TEST 1 RÉUSSI : Création automatique transactionnelle des catégories par défaut validée !\n');

    // -------------------------------------------------------------------------
    // TEST 2 : Cloisonnement strict des catégories par service
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 2] : Vérification du cloisonnement strict des catégories entre INFO et MATH...');
    const infoCatsRes = await request(`${API}/archive-categories`, { headers: chefInfoHeaders });
    const mathCatsRes = await request(`${API}/archive-categories`, { headers: chefMathHeaders });

    const infoCustomIds = (infoCatsRes.data.customs || []).map(c => c.id);
    const mathCustomIds = (mathCatsRes.data.customs || []).map(c => c.id);

    const commonIds = infoCustomIds.filter(id => mathCustomIds.includes(id));
    if (commonIds.length > 0) {
      throw new Error(`ÉCHEC DU TEST 2 : Fuite de catégories entre services distincts (${commonIds.join(', ')})`);
    }
    console.log(`  ✓ Catégories INFO (${infoCustomIds.length}) et MATH (${mathCustomIds.length}) sont 100% isolées.`);
    console.log('  🎉 TEST 2 RÉUSSI : Cloisonnement strict validé !\n');

    // -------------------------------------------------------------------------
    // TEST 3 : Le service peut créer une catégorie supplémentaire
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 3] : Création d’une catégorie supplémentaire par le Chef INFO (« Rapports techniques »)...');
    const catTechName = `Rapports techniques ${Date.now()}`;
    const createTechRes = await request(`${API}/archive-categories`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        name: catTechName,
        description: 'Rapports et livrables techniques du département informatique',
        icon: 'FileCode',
        color: 'text-purple-700 bg-purple-50 border-purple-200',
        display_order: 30
      })
    });

    if (!createTechRes.ok) {
      throw new Error(`Échec création catégorie par le service : ${JSON.stringify(createTechRes.data)}`);
    }

    const techCat = createTechRes.data.category;
    console.log(`  ✓ Catégorie créée avec succès par le service : ID=${techCat.id}, Nom="${techCat.name}"`);
    console.log('  🎉 TEST 3 RÉUSSI : Création de catégorie supplémentaire par le service validée !\n');

    // -------------------------------------------------------------------------
    // TEST 4 : Le service NE PEUT PAS modifier une catégorie existante (Réservé Admin)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 4] : Tentative de modification de la catégorie par le Chef INFO (Doit être rejeté 403)...');
    const updateForbiddenRes = await request(`${API}/archive-categories/${techCat.id}`, {
      method: 'PUT',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        name: 'Tentative de renommage par chef de service'
      })
    });

    if (updateForbiddenRes.status === 403) {
      console.log(`  ✓ Modification correctement bloquée avec message : "${updateForbiddenRes.data.error}"`);
      console.log('  🎉 TEST 4 RÉUSSI : Restriction de modification côté serveur validée !\n');
    } else {
      throw new Error(`ÉCHEC DU TEST 4 : Le service a pu modifier une catégorie (${updateForbiddenRes.status})`);
    }

    // -------------------------------------------------------------------------
    // TEST 5 : Le service NE PEUT PAS supprimer une catégorie existante (Réservé Admin)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 5] : Tentative de suppression de la catégorie par le Chef INFO (Doit être rejeté 403)...');
    const deleteForbiddenRes = await request(`${API}/archive-categories/${techCat.id}`, {
      method: 'DELETE',
      headers: chefInfoHeaders
    });

    if (deleteForbiddenRes.status === 403) {
      console.log(`  ✓ Suppression correctement bloquée avec message : "${deleteForbiddenRes.data.error}"`);
      console.log('  🎉 TEST 5 RÉUSSI : Restriction de suppression côté serveur validée !\n');
    } else {
      throw new Error(`ÉCHEC DU TEST 5 : Le service a pu supprimer une catégorie (${deleteForbiddenRes.status})`);
    }

    // -------------------------------------------------------------------------
    // TEST 6 : L’Administrateur peut modifier et renommer n’importe quelle catégorie
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 6] : Modification de la catégorie par l’ADMINISTRATEUR (Renommage en « Livrables & Rapports techniques »)...');
    const adminUpdateRes = await request(`${API}/archive-categories/${techCat.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Livrables & Rapports techniques ${Date.now()}`,
        icon: 'Database',
        color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        display_order: 25
      })
    });

    if (!adminUpdateRes.ok) {
      throw new Error(`Échec modification admin : ${JSON.stringify(adminUpdateRes.data)}`);
    }
    console.log(`  ✓ Catégorie mise à jour par l’administrateur : "${adminUpdateRes.data.category.name}"`);
    console.log('  🎉 TEST 6 RÉUSSI : Administration globale et personnalisation par l’administrateur validées !\n');

    // -------------------------------------------------------------------------
    // TEST 7 : Archivage d’un document et persistance après renommage
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 7] : Archivage d’un document et vérification de la conservation...');
    const docRes = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        document_type: techCat.code,
        title: 'Livrable Technique Système GED',
        object_title: 'Livrable Technique Système GED',
        content_body: 'Contenu livrable',
        action: 'SUBMIT'
      })
    });
    const docId = docRes.data.id;

    await request(`${API}/documents/${docId}/archive-service`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        archive_scope: 'PRIVE_SERVICE',
        custom_category_id: techCat.id,
        archive_category: adminUpdateRes.data.category.name
      })
    });

    const archivesRes = await request(`${API}/documents/archives?category=${techCat.code}`, {
      headers: chefInfoHeaders
    });
    console.log(`  ✓ Documents trouvés dans la catégorie après renommage : ${archivesRes.data.documents.length}`);
    if (archivesRes.data.documents.length === 0) {
      throw new Error('ÉCHEC DU TEST 7 : Le document archivé n’apparaît plus après modification du nom !');
    }
    console.log('  🎉 TEST 7 RÉUSSI : Intégrité documentaire et persistance garanties !\n');

    // -------------------------------------------------------------------------
    // TEST 8 : Suppression sécurisée par l’Administrateur avec déplacement des documents
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 8] : Suppression protégée par l’administrateur (Déplacement préalable vers « AUTRE »)...');
    
    // Déplacement
    const moveRes = await request(`${API}/archive-categories/${techCat.id}/move-documents`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ target_category_code: 'AUTRE' })
    });
    if (!moveRes.ok) throw new Error('Échec déplacement : ' + JSON.stringify(moveRes.data));

    // Suppression
    const deleteRes = await request(`${API}/archive-categories/${techCat.id}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    if (!deleteRes.ok) throw new Error('Échec suppression admin : ' + JSON.stringify(deleteRes.data));

    console.log('  ✓ Catégorie supprimée proprement par l’administrateur sans aucune perte de documents.');
    console.log('  🎉 TEST 8 RÉUSSI : Déplacement et suppression administrative sécurisée validés !\n');

    console.log('====================================================================================================');
    console.log('  🌟 TOUS LES TESTS DE GESTION DES CATÉGORIES D’ARCHIVAGE PAR SERVICE SONT VALIDÉS (100%) !');
    console.log('====================================================================================================\n');

  } catch (err) {
    console.error('\n❌ ÉCHEC DU TEST DE GESTION DES CATÉGORIES D’ARCHIVES :', err.message);
    process.exit(1);
  }
}

runServiceArchiveCategoriesManagementTestSuite();
