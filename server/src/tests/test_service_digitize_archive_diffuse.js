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
  console.log('  TEST AUTOMATISÉ : NUMÉRISATION, IMPORTATION, ARCHIVAGE ET DIFFUSION PAR SERVICE');
  console.log('==================================================================================\n');

  try {
    await seedDatabase();

    const PORT = 5124;
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(PORT, resolve));
    API = `http://127.0.0.1:${PORT}/api`;

    // 1. Authentification
    console.log('▶ [0. INITIALISATION] : Connexion des comptes de test...');
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

    const scLog = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    if (!scLog.ok) throw new Error('Connexion SC échouée : ' + JSON.stringify(scLog.data));
    const scHeaders = { Authorization: `Bearer ${scLog.data.token}` };

    console.log('  ✓ Admin, Chef Info, Chef Math et Secrétariat Central connectés.\n');

    // TEST 1 : Numérisation & Archivage direct par le service (Règles 1, 2, 3, 4, 11)
    console.log('▶ [RÈGLES 1, 2, 3, 4 & 11] : Numérisation & Archivage d’un document avec OCR et catégorie...');
    const ocrSecretKeyword = `OCR_FIBRE_OPTIQUE_${Date.now()}`;
    const archiveRes = await request(`${API}/documents/service-archive`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        title: 'Demande de connexion Fibre Optique Labo',
        object_title: 'Renouvellement équipement réseau FS/INFO',
        document_type: 'SOIT_TRANSMIS',
        archive_category: 'Soit-transmis',
        document_date: '2026-08-21',
        author_name: 'Dr. Alpha Oumar Diallo',
        signatory_name: 'Dr. Alpha Oumar Diallo',
        target_recipient_name: 'Secrétariat Central',
        description: 'Dossier complet de raccordement internet',
        keywords: 'fibre, réseau, informatique, kindia',
        confidentiality: 'INTERNAL',
        priority: 'HIGH',
        ocr_text: `Texte extrait par OCR automatique : Demande officielle contenant le mot-clé unique ${ocrSecretKeyword} pour le raccordement du département d'Informatique.`,
        is_scanned: '1'
      })
    });

    if (!archiveRes.ok) throw new Error('Échec archivage service : ' + JSON.stringify(archiveRes.data));
    const archivedDocId = archiveRes.data.id;
    const archivedRef = archiveRes.data.reference;
    console.log(`  ✓ Document numérisé et archivé avec succès (ID: ${archivedDocId}, Référence: ${archivedRef})`);

    // TEST 2 : Vérification de la recherche plein texte OCR (Règle 11)
    console.log('▶ [RÈGLE 11] : Recherche dans les archives via le mot-clé OCR...');
    const ocrSearchRes = await request(`${API}/documents/archives?search=${ocrSecretKeyword}`, {
      headers: chefInfoHeaders
    });
    if (!ocrSearchRes.ok) throw new Error('Échec recherche OCR : ' + JSON.stringify(ocrSearchRes.data));
    const foundDocs = ocrSearchRes.data.documents || [];
    const matched = foundDocs.some(d => d.id === archivedDocId);
    if (!matched) {
      throw new Error(`ÉCHEC RÈGLE 11 : Le document archivé n'a pas été trouvé via son contenu OCR [${ocrSecretKeyword}] !`);
    }
    console.log(`  ✓ Recherche plein-texte OCR réussie ! Le document a été retrouvé instantanément via son mot-clé numérisé.`);

    // TEST 3 : Diffusion du document vers le Secrétariat Central (Règles 5, 6, 7)
    console.log('▶ [RÈGLES 5, 6 & 7] : Diffusion du document vers le Secrétariat Central...');
    // Find SC service id
    const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
    if (!scService) throw new Error('Service SC non trouvé');

    const diffuseRes = await request(`${API}/documents/${archivedDocId}/diffuse`, {
      method: 'POST',
      headers: chefInfoHeaders,
      body: JSON.stringify({
        target_service_ids: [scService.id],
        subject: `Transmission officielle : ${archivedRef}`,
        message: 'Pour instruction et enregistrement au Secrétariat Central.',
        priority: 'URGENT',
        dispatch_type: 'PRISE_DE_CONNAISSANCE'
      })
    });

    if (!diffuseRes.ok) throw new Error('Échec diffusion : ' + JSON.stringify(diffuseRes.data));
    console.log(`  ✓ ${diffuseRes.data.message}`);

    // TEST 4 : Règle 6 : Vérifier que le document reste dans l'archive du Département d'Informatique
    console.log('▶ [RÈGLE 6] : Vérification que le document reste conservé dans l’archive du service propriétaire...');
    const infoArchives = await request(`${API}/documents/archives`, {
      headers: chefInfoHeaders
    });
    const stillInInfo = (infoArchives.data.documents || []).some(d => d.id === archivedDocId);
    if (!stillInInfo) {
      throw new Error('ÉCHEC RÈGLE 6 : Le document a disparu des archives du Département d’Informatique après diffusion !');
    }
    console.log(`  ✓ RÈGLE 6 VALIDÉE : Le document est toujours présent dans les archives privées du Département d’Informatique.`);

    // TEST 5 : Règle 6 & 10 : Le Secrétariat Central a reçu l'accès et la transmission
    console.log('▶ [RÈGLES 6 & 10] : Vérification de la réception et de l’accès par le Secrétariat Central...');
    const scDetail = await request(`${API}/documents/${archivedDocId}`, {
      headers: scHeaders
    });
    if (!scDetail.ok) {
      throw new Error('ÉCHEC RÈGLE 10 : Le Secrétariat Central ne peut pas accéder au document qui lui a été diffusé !');
    }
    console.log(`  ✓ RÈGLE 10 VALIDÉE : Le Secrétariat Central accède avec succès au document diffusé (${scDetail.data.reference}).`);

    // TEST 6 : Règle 9 : Isolation stricte : Le Département Math (non destinataire) n'y a pas accès
    console.log('▶ [RÈGLE 9] : Vérification de l’isolation stricte (Département Math non destinataire)...');
    const mathDetail = await request(`${API}/documents/${archivedDocId}`, {
      headers: chefMathHeaders
    });
    if (mathDetail.status !== 403 && mathDetail.status !== 404) {
      throw new Error(`ÉCHEC RÈGLE 9 : Le Département Math a pu accéder au document privé alors qu'il n'était pas destinataire (Status: ${mathDetail.status}) !`);
    }
    console.log(`  ✓ RÈGLE 9 VALIDÉE : Accès refusé au Département Math (403/404 Forbidden), isolation préservée.`);

    // TEST 7 : Règle 7 : Traçabilité et historique complet
    console.log('▶ [RÈGLE 7] : Vérification de la traçabilité complète dans l’historique...');
    const historyRes = await request(`${API}/documents/${archivedDocId}/history`, {
      headers: chefInfoHeaders
    });
    const historyEntries = historyRes.data || [];
    const hasArchive = historyEntries.some(h => h.action === 'NUMERISATION_ARCHIVE' || h.action === 'IMPORT_ARCHIVE');
    const hasDiffuse = historyEntries.some(h => h.action === 'DIFFUSE_DOCUMENT');

    if (!hasArchive || !hasDiffuse) {
      throw new Error('ÉCHEC RÈGLE 7 : Actions manquantes dans l’historique de traçabilité !');
    }
    console.log(`  ✓ RÈGLE 7 VALIDÉE : Historique complet enregistré (${historyEntries.length} événements avec dates, auteurs et motifs).`);

    console.log('\n==================================================================================');
    console.log('  🏆 TOUS LES TESTS (NUMÉRISATION, OCR, ARCHIVAGE, DIFFUSION) ONT RÉUSSI !');
    console.log('==================================================================================\n');

  } catch (err) {
    console.error('\n❌ ERREUR LORS DU TEST :', err.message);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
  }
}

runTestSuite();
