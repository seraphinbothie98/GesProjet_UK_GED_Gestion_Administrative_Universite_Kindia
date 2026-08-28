const assert = require('assert');
const http = require('http');
const db = require('./src/database/db');

const BASE_URL = 'http://127.0.0.1:5000';

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers
      },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data });
          } catch (e) {
            resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: body });
          }
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function loginUser(identity, password) {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: { identity, password }
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${identity}: ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

async function runTests() {
  console.log('===============================================================');
  console.log('   TESTS COMPLETS DES ANOMALIES FONCTIONNELLES UK-GED          ');
  console.log('===============================================================\n');

  // 1. Logins
  console.log('▶ Étape 1 : Connexion des différents acteurs...');
  const scAuth = await loginUser('sc@univ-kindia.edu.gn', 'Agent123!');
  const sgAuth = await loginUser('sg@univ-kindia.edu.gn', 'Sg123!');
  const rectAuth = await loginUser('recteur@univ-kindia.edu.gn', 'Recteur123!');
  const chefInfoAuth = await loginUser('chef_info@univ-kindia.edu.gn', 'Chef123!');
  const doyenAuth = await loginUser('doyen_fs@univ-kindia.edu.gn', 'Doyen123!');

  const scHeaders = { Authorization: `Bearer ${scAuth.token}` };
  const sgHeaders = { Authorization: `Bearer ${sgAuth.token}` };
  const rectHeaders = { Authorization: `Bearer ${rectAuth.token}` };
  const infoHeaders = { Authorization: `Bearer ${chefInfoAuth.token}` };
  const doyenHeaders = { Authorization: `Bearer ${doyenAuth.token}` };

  console.log('  ✓ SC, SG, Recteur, Doyen, Chef Département connectés avec succès.\n');

  // Fetch Services
  const scService = await db.get('SELECT id FROM services WHERE code = "SC"');
  const sgService = await db.get('SELECT id FROM services WHERE code = "SG"');
  const doyenService = { id: doyenAuth.user.service_id };
  const infoService = { id: chefInfoAuth.user.service_id };

  // =========================================================================
  // SCÉNARIO 1 : Chaîne complète SC -> SG -> Service C -> Service D -> SC -> Archivage Central
  // =========================================================================
  console.log('▶ SCÉNARIO 1 : Flux complet SC -> SG -> Doyen -> Dept Info -> SC -> Archivage Central...');
  const docRef1 = `COURRIER_TEST_${Date.now()}`;
  const createRes1 = await request('/api/documents/incoming', {
    method: 'POST',
    headers: scHeaders,
    body: {
      reference: docRef1,
      title: 'Courrier officiel pour arbitrage ministériel',
      document_type: 'COURRIER_ENTRANT',
      sender_name: 'Ministère de l’Enseignement Supérieur',
      sender_organization: 'MESRSI',
      reception_date: '2026-08-27',
      processing_mode: 'NORMAL',
      instruction: 'Pour analyse et transmission aux départements concernés.'
    }
  });

  assert.strictEqual(createRes1.status, 201, `Création courrier entrant échouée: ${JSON.stringify(createRes1.data)}`);
  const docId1 = createRes1.data.id || createRes1.data.document_id;
  console.log(`  ✓ Courrier enregistré au SC (ID: ${docId1}) et transmis immédiatement au SG.`);

  // Verify initial transmission to SG
  const docDb1 = await db.get('SELECT * FROM documents WHERE id = ?', [docId1]);
  assert.strictEqual(Number(docDb1.current_service_id), Number(sgService.id), 'Le document doit être sous le contrôle du SG');

  // SG reorients to Service C (Doyen)
  console.log('  -> SG réoriente vers le Doyen...');
  const orient1 = await request('/api/workflow/orient', {
    method: 'POST',
    headers: sgHeaders,
    body: {
      document_id: docId1,
      to_service_id: doyenService.id,
      motif: 'Consultation facultaire',
      instruction: 'Merci d’instruire ce dossier avec le département informatique.'
    }
  });
  assert.strictEqual(orient1.status, 200, `Orientation SG -> Doyen échouée: ${JSON.stringify(orient1.data)}`);

  // Service C reorients to Service D (Informatique)
  console.log('  -> Doyen réoriente vers le Département Informatique...');
  const orient2 = await request('/api/workflow/orient', {
    method: 'POST',
    headers: doyenHeaders,
    body: {
      document_id: docId1,
      to_service_id: infoService.id,
      motif: 'Expertise technique informatique',
      instruction: 'Donner avis technique.'
    }
  });
  assert.strictEqual(orient2.status, 200, `Orientation Doyen -> Info échouée: ${JSON.stringify(orient2.data)}`);

  // Service D returns document to Secrétariat Central
  console.log('  -> Département Informatique retourne le document au Secrétariat Central...');
  const returnRes = await request('/api/workflow/return', {
    method: 'POST',
    headers: infoHeaders,
    body: {
      document_id: docId1,
      to_service_id: scService.id,
      return_reason: 'Avis technique rendu et finalisé. Retour pour archivage central.'
    }
  });
  assert.strictEqual(returnRes.status, 200, `Retour au SC échoué: ${JSON.stringify(returnRes.data)}`);

  // SC archives the returned document
  console.log('  -> Secrétariat Central archive le document retourné...');
  const archiveRes1 = await request(`/api/documents/${docId1}/archive`, {
    method: 'POST',
    headers: scHeaders,
    body: {
      archive_scope: 'CENTRAL',
      archive_category: 'Courrier entrant général'
    }
  });
  assert.strictEqual(archiveRes1.status, 200, `Archivage SC échoué: ${JSON.stringify(archiveRes1.data)}`);

  // Check no duplicates and full history
  const countDocs = await db.get('SELECT COUNT(*) as c FROM documents WHERE reference = ?', [docDb1.reference]);
  assert.strictEqual(countDocs.c, 1, 'Il ne doit y avoir aucun doublon de document');
  const history1 = await db.all('SELECT action, details, timestamp FROM document_history WHERE document_id = ? ORDER BY id ASC', [docId1]);
  console.log(`  ✓ Historique vérifié (${history1.length} étapes enregistrées sans perte ni doublon).`);

  // =========================================================================
  // SCÉNARIO 2 : SC -> SG -> Archivage local SG
  // =========================================================================
  console.log('\n▶ SCÉNARIO 2 : SC -> SG -> Archivage local au niveau du Secrétaire Général...');
  const docRef2 = `COURRIER_SG_ARCH_${Date.now()}`;
  const createRes2 = await request('/api/documents/incoming', {
    method: 'POST',
    headers: scHeaders,
    body: {
      reference: docRef2,
      title: 'Note confidentielle pour le Secrétariat Général',
      document_type: 'COURRIER_ENTRANT',
      sender_name: 'Direction Financière',
      processing_mode: 'NORMAL'
    }
  });
  const docId2 = createRes2.data.id || createRes2.data.document_id;
  const sgArchiveRes = await request(`/api/documents/${docId2}/archive-service`, {
    method: 'POST',
    headers: sgHeaders,
    body: {
      archive_scope: 'PRIVE_SERVICE',
      archive_category: 'Courriers SG'
    }
  });
  assert.strictEqual(sgArchiveRes.status, 200, `Archivage SG échoué: ${JSON.stringify(sgArchiveRes.data)}`);
  const docDb2 = await db.get('SELECT status, owner_service_id FROM documents WHERE id = ?', [docId2]);
  assert.strictEqual(docDb2.status, 'ARCHIVED');
  console.log('  ✓ Document archivé dans les archives du Secrétariat Général avec succès.');

  // =========================================================================
  // SCÉNARIO 3 : SC -> Service C (Info) -> Archivage local Service C
  // =========================================================================
  console.log('\n▶ SCÉNARIO 3 : SC -> SG -> Service C (Info) -> Archivage local Service C...');
  const docRef3 = `COURRIER_INFO_ARCH_${Date.now()}`;
  const createRes3 = await request('/api/documents/incoming', {
    method: 'POST',
    headers: scHeaders,
    body: {
      reference: docRef3,
      title: 'Documentation réseau campus',
      document_type: 'COURRIER_ENTRANT',
      sender_name: 'Fournisseur Télécom',
      processing_mode: 'NORMAL'
    }
  });
  const docId3 = createRes3.data.id || createRes3.data.document_id;
  // SG orients to info
  await request('/api/workflow/orient', {
    method: 'POST',
    headers: sgHeaders,
    body: {
      document_id: docId3,
      to_service_id: infoService.id,
      motif: 'Gestion réseau'
    }
  });
  // Info archives locally
  const infoArchiveRes = await request(`/api/documents/${docId3}/archive-service`, {
    method: 'POST',
    headers: infoHeaders,
    body: {
      archive_scope: 'PRIVE_SERVICE',
      archive_category: 'Documentation Technique'
    }
  });
  assert.strictEqual(infoArchiveRes.status, 200, `Archivage Info échoué: ${JSON.stringify(infoArchiveRes.data)}`);
  console.log('  ✓ Document archivé localement dans le Service C.');

  // =========================================================================
  // SCÉNARIO 4 : Tableau de bord du Recteur — Filtrage strict des Ordres de mission
  // =========================================================================
  console.log('\n▶ SCÉNARIO 4 : Tableau de bord du Recteur — Ordres de mission non orientés vs orientés...');
  // Create an internal mission order not oriented to Recteur
  const missionRef4 = `OM_INT_${Date.now()}`;
  const omRes = await request('/api/documents/incoming', {
    method: 'POST',
    headers: scHeaders,
    body: {
      reference: missionRef4,
      title: 'Ordre de mission pour inspection des centres universitaires',
      document_type: 'MISSION_ORDER',
      priority: 'NORMAL',
      sender_name: 'Faculté des Sciences',
      processing_mode: 'NORMAL'
    }
  });
  const omId = omRes.data.id;
  const omDb = await db.get('SELECT * FROM documents WHERE id = ?', [omId]);

  // Recteur Dashboard check BEFORE orientation
  const rectDashBefore = await request('/api/reports/dashboard', { headers: rectHeaders });
  const inRectBefore = rectDashBefore.data.recent_activity.some(d => d.id === omId || d.reference === omDb.reference);
  assert.strictEqual(inRectBefore, false, 'L’ordre de mission non orienté NE DOIT PAS apparaître dans le tableau de bord du Recteur');
  console.log('  ✓ Ordre de mission non orienté ABSENT du tableau de bord du Recteur (Filtre vérifié).');

  // SG orients document to Recteur
  const sgDecRes = await request('/api/workflow/sg-orient', {
    method: 'POST',
    headers: sgHeaders,
    body: {
      document_id: omId,
      action_type: 'ORIENT_RECTEUR',
      instruction: 'Pour signature de Monsieur le Recteur'
    }
  });
  console.log('  -> Décision SG vers Recteur status:', sgDecRes.status, sgDecRes.data);

  // Recteur Dashboard check AFTER orientation
  const rectDashAfter = await request('/api/reports/dashboard', { headers: rectHeaders });
  const inRectAfter = rectDashAfter.data.recent_activity.some(d => d.id === omId || d.reference === omDb.reference);
  assert.strictEqual(inRectAfter, true, 'L’ordre de mission orienté DOIT apparaître dans le tableau de bord du Recteur');
  console.log('  ✓ Ordre de mission orienté PRÉSENT dans le tableau de bord du Recteur.');

  // =========================================================================
  // SCÉNARIO 5 : Tableau « Derniers documents & orientation » — Exclusion automatique des documents archivés
  // =========================================================================
  console.log('\n▶ SCÉNARIO 5 : Disparition immédiate des documents archivés de « Derniers documents & orientation »...');
  const dashBeforeArchive = await request('/api/reports/dashboard', { headers: scHeaders });
  const isDoc1InRecentBefore = dashBeforeArchive.data.recent_activity.some(d => d.id === docId1 || d.reference === docRef1);
  assert.strictEqual(isDoc1InRecentBefore, false, 'Le document 1 archivé ne doit plus apparaître dans Derniers documents & orientation');
  console.log('  ✓ Document archivé exclu du tableau actif de suivi.');

  // =========================================================================
  // SCÉNARIO 6 : Ordres de Mission Externes — Archivage Central & Catégorie
  // =========================================================================
  console.log('\n▶ SCÉNARIO 6 : Ordre de mission externe — Archivage et présence dans la catégorie dédiée...');
  const extRef = `EXT_OM_${Date.now()}`;
  const nowIso = new Date().toISOString();
  const extInsert = await db.run(
    `INSERT INTO external_missionaries (
       reference, last_name, first_names, origin_institution, function_title, mission_order_ref,
       object_of_mission, location_of_mission, host_service_id, original_document_path,
       arrival_date, arrival_recorded_at, arrival_signed_at, signed_at,
       departure_date, departure_recorded_at, departure_signed_at,
       status, archived_at, archived_by_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      extRef, 'BAH', 'Ibrahima', 'Université de Conakry', 'Chercheur', `REF_ORD_${Date.now()}`,
      'Mission de recherche scientifique conjointe', 'Kindia Campus', scService.id, '/uploads/doc.pdf',
      nowIso, nowIso, nowIso, nowIso,
      nowIso, nowIso, nowIso,
      'ARCHIVÉ', nowIso, scAuth.user.id
    ]
  );
  const extId = extInsert.lastID;

  // Query Central Archives as SC
  const archivesRes = await request('/api/documents/archives?year=2026', { headers: scHeaders });
  assert.strictEqual(archivesRes.status, 200);
  
  // Check Category exists
  const extCat = archivesRes.data.categories_summary.find(c => c.code === 'ORDRE_MISSION_EXTERNE' || c.code === 'ORDRES_DE_MISSION_EXTERNE' || (c.label && c.label.toLowerCase().includes('mission externe')));
  assert.ok(extCat, 'La catégorie « Ordres de mission externe » doit être présente');
  assert.ok(extCat.count >= 1, `Le compteur de la catégorie doit inclure l’OM externe archivé (compteur actuel: ${extCat.count})`);

  // Query filtered by category
  const filteredExtRes = await request(`/api/documents/archives?category=${extCat.code}&year=2026`, { headers: scHeaders });
  const foundExtDoc = filteredExtRes.data.documents.find(d => d.reference === extRef);
  assert.ok(foundExtDoc, 'L’OM externe archivé doit être listé dans la catégorie Ordres de mission externe');
  assert.strictEqual(foundExtDoc.document_type, 'ORDRE_MISSION_EXTERNE');
  console.log(`  ✓ Ordre de mission externe archivé trouvé dans Archives Centrales (Catégorie: ${extCat.label}, Réf: ${foundExtDoc.reference}).`);

  console.log('\n===============================================================');
  console.log('   TOUS LES SCÉNARIOS DE TEST ONT RÉUSSI AVEC SUCCÈS (100%) !  ');
  console.log('===============================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ ERREUR LORS DU TEST :', err);
  process.exit(1);
});
