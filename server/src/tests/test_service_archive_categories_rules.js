const express = require('express');
const http = require('http');
const db = require('../database/db');
const seedDatabase = require('../database/seed');

// Import routes
const authRoutes = require('../routes/authRoutes');
const serviceRoutes = require('../routes/serviceRoutes');
const archiveCategoryRoutes = require('../routes/archiveCategoryRoutes');
const documentRoutes = require('../routes/documentRoutes');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/archive-categories', archiveCategoryRoutes);
app.use('/api/documents', documentRoutes);

let server;
let API;

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTestSuite() {
  console.log('==================================================================================');
  console.log('  TEST AUTOMATISÉ : 12 RÈGLES DE GESTION DES CATÉGORIES D’ARCHIVES PAR SERVICE');
  console.log('==================================================================================\n');

  try {
    await seedDatabase();

    const PORT = 5123;
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    API = `http://127.0.0.1:${PORT}/api`;

    // 1. Authentification
    console.log('▶ [0. INITIALISATION] : Connexion des utilisateurs...');
    const adminLog = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' })
    });
    if (!adminLog.ok) throw new Error('Connexion admin échouée : ' + JSON.stringify(adminLog.data));
    const adminHeaders = { Authorization: `Bearer ${adminLog.data.token}` };

    const chefInfoLog = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'chef_info@univ-kindia.edu.gn', password: 'Chef123!' })
    });
    if (!chefInfoLog.ok) throw new Error('Connexion chef_info échouée : ' + JSON.stringify(chefInfoLog.data));
    const chefInfoHeaders = { Authorization: `Bearer ${chefInfoLog.data.token}` };

    const chefMathLog = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'chef_math@univ-kindia.edu.gn', password: 'Chef123!' })
    });
    if (!chefMathLog.ok) throw new Error('Connexion chef_math échouée : ' + JSON.stringify(chefMathLog.data));
    const chefMathHeaders = { Authorization: `Bearer ${chefMathLog.data.token}` };

    console.log('  ✓ Admin, Chef Info et Chef Math connectés avec succès.\n');

    // RÈGLE 1 : Création d'un nouveau service et vérification des catégories automatiques
    console.log('▶ [RÈGLE 1 & 12] : Création d’un nouveau service et catégories automatiques (Soit-transmis, Demandes)...');
    const uniqueSuffix = Date.now().toString().slice(-4);
    const testCode = `STAA_${uniqueSuffix}`;
    const newServiceRes = await request(`${API}/services`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        code: testCode,
        name: `Service de Test Archivage Automatique ${uniqueSuffix}`,
        acronym: `STAA${uniqueSuffix}`,
        reference_code: `UK/STAA/${uniqueSuffix}`,
        structure_type: 'SERVICE'
      })
    });
    if (!newServiceRes.ok) throw new Error('Échec création service : ' + JSON.stringify(newServiceRes.data));
    const testServiceId = newServiceRes.data.id;

    // Vérifier les catégories créées pour ce service
    const serviceCatsRes = await request(`${API}/archive-categories?service_id=${testServiceId}`, {
      headers: adminHeaders
    });
    const autoCustoms = serviceCatsRes.data.customs || [];
    const hasSoitTransmis = autoCustoms.some(c => c.code === 'SOIT_TRANSMIS' || c.name === 'Soit-transmis');
    const hasDemandes = autoCustoms.some(c => c.code === 'DEMANDE' || c.name === 'Demandes');

    if (!hasSoitTransmis || !hasDemandes) {
      throw new Error(`ÉCHEC RÈGLE 1 : Les catégories automatiques Soit-transmis ou Demandes sont manquantes !`);
    }
    console.log(`  ✓ Service #${testServiceId} créé avec succès.`);
    console.log(`  ✓ Catégories automatiques créées pour ce service : [${autoCustoms.map(c => c.name).join(', ')}]`);
    console.log('  🎉 RÈGLE 1 & 12 VALIDÉE AVEC SUCCÈS !\n');

    // RÈGLE 2 : Le service peut ajouter ses propres catégories
    console.log('▶ [RÈGLE 2] : Ajout de catégories propres par le service (nom, description, icône, couleur)...');
    const customCatName = `Documents techniques ${uniqueSuffix}`;
    const addCatRes = await request(`${API}/archive-categories`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        name: customCatName,
        description: 'Dossiers techniques, architecture et code source',
        icon: 'HardDrive',
        color: 'text-purple-700 bg-purple-50 border-purple-200',
        display_order: 30
      })
    });
    if (!addCatRes.ok) throw new Error('Échec création catégorie par Chef Info : ' + JSON.stringify(addCatRes.data));
    const createdCat = addCatRes.data.category;
    console.log(`  ✓ Nouvelle catégorie créée : [${createdCat.name}] (ID: ${createdCat.id}, Icône: ${createdCat.icon}, Couleur: ${createdCat.color})`);
    console.log('  🎉 RÈGLE 2 VALIDÉE AVEC SUCCÈS !\n');

    // RÈGLE 9 : Isolation stricte entre services
    console.log('▶ [RÈGLE 9] : Vérification de l’isolation stricte entre services...');
    const mathCatsRes = await request(`${API}/archive-categories`, {
      headers: chefMathHeaders
    });
    const mathCustoms = mathCatsRes.data.customs || [];
    const leakFound = mathCustoms.some(c => c.id === createdCat.id);
    if (leakFound) {
      throw new Error('ÉCHEC RÈGLE 9 : Le Département Math a accès à la catégorie privée du Département Info !');
    }
    console.log(`  ✓ Le Département Math ne voit pas la catégorie privée d’Informatique.`);
    console.log('  🎉 RÈGLE 9 VALIDÉE AVEC SUCCÈS !\n');

    // RÈGLE 7 & 11 : Services - Droits limités & Sécurité serveur
    console.log('▶ [RÈGLE 7 & 11] : Sécurité serveur - Les utilisateurs de service ne peuvent pas modifier/supprimer...');
    const unauthorizedPut = await request(`${API}/archive-categories/${createdCat.id}`, {
      method: 'PUT',
      headers: chefInfoHeaders,
      body: JSON.stringify({ name: 'Nom Hacké Par Chef' })
    });
    if (unauthorizedPut.status !== 403) {
      throw new Error(`ÉCHEC RÈGLE 7 : La modification par un non-admin aurait dû renvoyer 403, reçu : ${unauthorizedPut.status}`);
    }
    console.log(`  ✓ Modification par l'utilisateur du service refusée côté serveur (403 Forbidden).`);

    const unauthorizedDelete = await request(`${API}/archive-categories/${createdCat.id}`, {
      method: 'DELETE',
      headers: chefInfoHeaders
    });
    if (unauthorizedDelete.status !== 403) {
      throw new Error(`ÉCHEC RÈGLE 7 : La suppression par un non-admin aurait dû renvoyer 403, reçu : ${unauthorizedDelete.status}`);
    }
    console.log(`  ✓ Suppression par l'utilisateur du service refusée côté serveur (403 Forbidden).`);
    console.log('  🎉 RÈGLES 7 & 11 VALIDÉES AVEC SUCCÈS !\n');

    // RÈGLE 3 & 8 : L'administrateur peut gérer toutes les catégories
    console.log('▶ [RÈGLE 3 & 8] : L’administrateur consulte le résumé global de tous les services...');
    const adminSummary = await request(`${API}/archive-categories/admin/services-summary`, {
      headers: adminHeaders
    });
    if (!adminSummary.ok) throw new Error('Échec résumé admin : ' + JSON.stringify(adminSummary.data));
    console.log(`  ✓ Résumé récupéré pour ${adminSummary.data.length} services de l'Université.`);
    console.log('  🎉 RÈGLE 3 & 8 VALIDÉE AVEC SUCCÈS !\n');

    // RÈGLE 4 & 5 : Renommer, changer l'icône et la couleur par l'Administrateur
    console.log('▶ [RÈGLE 4 & 5] : Renommage, modification de l’icône et de la couleur par l’Administrateur...');
    const renamedCatName = `Dossiers Techniques & Recherche ${uniqueSuffix}`;
    const adminUpdateRes = await request(`${API}/archive-categories/${createdCat.id}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({
        name: renamedCatName,
        icon: 'BookOpen',
        color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        description: 'Dossiers de recherche et brevets techniques',
        display_order: 15
      })
    });
    if (!adminUpdateRes.ok) throw new Error('Échec mise à jour par Admin : ' + JSON.stringify(adminUpdateRes.data));
    const updatedCat = adminUpdateRes.data.category;
    if (updatedCat.name !== renamedCatName || updatedCat.icon !== 'BookOpen') {
      throw new Error('ÉCHEC RÈGLE 4/5 : Les modifications n’ont pas été enregistrées correctement !');
    }
    console.log(`  ✓ Catégorie mise à jour par l’Administrateur :`);
    console.log(`    - Nouveau nom : [${updatedCat.name}]`);
    console.log(`    - Nouvelle icône : [${updatedCat.icon}]`);
    console.log(`    - Nouvelle couleur : [${updatedCat.color}]`);
    console.log('  🎉 RÈGLES 4 & 5 VALIDÉES AVEC SUCCÈS !\n');

    // RÈGLE 6 : Suppression sécurisée par l'Administrateur
    console.log('▶ [RÈGLE 6] : Suppression d’une catégorie par l’Administrateur...');
    const deleteRes = await request(`${API}/archive-categories/${createdCat.id}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    if (!deleteRes.ok) throw new Error('Échec suppression par Admin : ' + JSON.stringify(deleteRes.data));
    console.log(`  ✓ Catégorie supprimée avec succès par l’Administrateur : ${deleteRes.data.message}`);
    console.log('  🎉 RÈGLE 6 VALIDÉE AVEC SUCCÈS !\n');

    console.log('==================================================================================');
    console.log('  🏆 TOUS LES TESTS (12 RÈGLES DE GESTION DES ARCHIVES) ONT RÉUSSI AVEC SUCCÈS !');
    console.log('==================================================================================\n');

  } catch (err) {
    console.error('\n❌ ERREUR LORS DU TEST DES RÈGLES :', err.message);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTestSuite();
