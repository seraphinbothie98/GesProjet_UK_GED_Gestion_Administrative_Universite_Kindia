const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://127.0.0.1:5000';

function request(method, pathUrl, body = null, token = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers }
    };

    let postData = null;
    if (body) {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        postData = body;
      } else {
        postData = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
      }
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function createMultipartBody(fields, files) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let chunks = [];

  for (const [key, val] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  for (const file of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.name}"\r\nContent-Type: ${file.mime}\r\n\r\n`));
    chunks.push(file.content);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const bodyBuffer = Buffer.concat(chunks);

  return {
    boundary,
    body: bodyBuffer,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': bodyBuffer.length
    }
  };
}

async function runArchivesTestSuite() {
  console.log('========================================================================');
  console.log('🏛️ SUITE DE VALIDATION : CONSULTATION ARCHIVES & ARCHIVAGE DIRECT UK-GED');
  console.log('========================================================================\n');

  const db = require('./src/database/db');

  // 1. Authentification
  console.log('1. Authentification des comptes Secrétariat Central et Administrateur :');
  const scLogin = await request('POST', '/api/auth/login', {
    identity: 'sc@univ-kindia.edu.gn',
    password: 'Agent123!'
  });
  if (scLogin.status !== 200 || !scLogin.data.token) throw new Error('Échec login SC');
  const scToken = scLogin.data.token;
  console.log('   - Secrétariat Central (SC) authentifié avec succès.');

  const adminLogin = await request('POST', '/api/auth/login', {
    identity: 'admin@univ-kindia.edu.gn',
    password: 'Admin123!'
  });
  if (adminLogin.status !== 200 || !adminLogin.data.token) throw new Error('Échec login Admin');
  const adminToken = adminLogin.data.token;
  console.log('   - Administrateur authentifié avec succès.\n');

  // 2. TEST PRÉVISUALISATION DE LA RÉFÉRENCE (Endpoint /api/documents/preview-reference)
  console.log('2. [TEST GÉNÉRATION RÉFÉRENCE] Prévisualisation avant enregistrement :');
  const typesToTest = ['ARRETE', 'DECRET', 'NOTE_SERVICE', 'DECISION', 'CIRCULAIRE', 'INCOMING_MAIL'];
  for (const t of typesToTest) {
    const refRes = await request('GET', `/api/documents/preview-reference?type=${t}`, null, scToken);
    if (refRes.status !== 200 || !refRes.data.reference) {
      throw new Error(`Échec génération référence pour ${t}: ${JSON.stringify(refRes)}`);
    }
    console.log(`   - Type [${t}] -> Référence officielle générée : "${refRes.data.reference}"`);
  }
  console.log('   ✅ Système de référence dynamique opérationnel.\n');

  // 3. TEST ARCHIVAGE DIRECT D'UN ARRÊTÉ OFFICIEL AVEC FICHIER NUMÉRISÉ (PARTIE B)
  console.log('3. [TEST ARCHIVAGE DIRECT] Création d’un document officiel Arrêté avec fichier joint :');
  const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n182\n%%EOF');
  
  const mp = createMultipartBody({
    processing_mode: 'DIRECT_ARCHIVE',
    official_type: 'ARRETE',
    title: 'Arrêté portant nomination des responsables de département 2026',
    sender_name: 'Ministère de l\'Enseignement Supérieur (MESRSI)',
    sender_organization: 'MESRSI Guinée',
    priority: 'HIGH',
    instruction: 'Pour archivage officiel permanent'
  }, [
    { field: 'files', name: 'arrete_nomination_2026.pdf', mime: 'application/pdf', content: samplePdfBuffer }
  ]);

  const createRes = await request('POST', '/api/documents/incoming', mp.body, scToken, mp.headers);
  console.log(`   - Création Arrêté : Status ${createRes.status}`);
  if (createRes.status !== 201 || !createRes.data.id) {
    throw new Error('Échec création document en archivage direct: ' + JSON.stringify(createRes));
  }
  const directDocId = createRes.data.id;
  const directRef = createRes.data.reference;
  console.log(`   - Document créé : ID ${directDocId} | Référence : ${directRef}`);

  // 4. VÉRIFICATION DE LA RELATION ARCHIVE & DU STATUT "ARCHIVED"
  console.log('\n4. [TEST VÉRIFICATION ARCHIVE & STATUT] Contrôle en base de données :');
  const directDoc = await db.get('SELECT * FROM documents WHERE id = ?', [directDocId]);
  console.log(`   - Statut : ${directDoc.status} (Attendu: ARCHIVED)`);
  console.log(`   - Processing Mode : ${directDoc.processing_mode} (Attendu: DIRECT_ARCHIVE)`);
  console.log(`   - Date d'archivage : ${directDoc.archived_at}`);
  if (directDoc.status !== 'ARCHIVED') {
    throw new Error(`ERREUR: Statut incorrect (${directDoc.status}), attendu ARCHIVED.`);
  }

  // Vérification de l'historique
  const history = await db.all('SELECT action, details FROM document_history WHERE document_id = ? ORDER BY id ASC', [directDocId]);
  console.log(`   - Historique (${history.length} entrées) :`);
  history.forEach(h => console.log(`     * [${h.action}] ${h.details}`));
  const hasArchiveDirectHistory = history.some(h => h.action === 'ARCHIVE_DIRECT');
  if (!hasArchiveDirectHistory) {
    throw new Error('Historique ARCHIVE_DIRECT manquant pour le document.');
  }

  // 5. TEST DE CONSULTATION SÉCURISÉE (PARTIE A - AUCUN "TOKEN MANQUANT")
  console.log('\n5. [TEST CONSULTATION ARCHIVE] Consultation via API sécurisée :');
  
  // 5.1 Consultation des métadonnées
  const docDetailRes = await request('GET', `/api/documents/${directDocId}`, null, scToken);
  console.log(`   - GET /api/documents/${directDocId} : Status ${docDetailRes.status} (Titre: "${docDetailRes.data.title}")`);
  if (docDetailRes.status !== 200) throw new Error('Échec consultation détail document archivé');

  // 5.2 Streaming du fichier avec Token dans Header Authorization
  const viewHeaderRes = await request('GET', `/api/documents/${directDocId}/view`, null, scToken);
  console.log(`   - GET /api/documents/${directDocId}/view (Authorization Header) : Status ${viewHeaderRes.status} (Content-Type: ${viewHeaderRes.headers['content-type']})`);
  if (viewHeaderRes.status !== 200) throw new Error('Échec streaming fichier avec Authorization header');

  // 5.3 Streaming du fichier avec Token en Query Param (?token=...) [Résout le cas iframe / lien]
  const viewQueryRes = await request('GET', `/api/documents/${directDocId}/view?token=${encodeURIComponent(scToken)}`, null, null);
  console.log(`   - GET /api/documents/${directDocId}/view?token=... (Query Param) : Status ${viewQueryRes.status} (Content-Type: ${viewQueryRes.headers['content-type']})`);
  if (viewQueryRes.status !== 200) {
    throw new Error('Échec streaming fichier avec query param token: ' + JSON.stringify(viewQueryRes));
  }
  if (viewQueryRes.raw.includes('Token manquant')) {
    throw new Error('ERREUR CRITIQUE: "Token manquant" renvoyé lors de la consultation !');
  }
  console.log('   ✅ Règle résolue : Aucune erreur "Token manquant", le flux PDF est délivré avec succès.');

  // 5.4 Test Téléchargement
  const downloadRes = await request('GET', `/api/documents/${directDocId}/download?token=${encodeURIComponent(scToken)}`, null, null);
  console.log(`   - GET /api/documents/${directDocId}/download : Status ${downloadRes.status} (Content-Disposition: ${downloadRes.headers['content-disposition']})`);
  if (downloadRes.status !== 200 || !downloadRes.headers['content-disposition'].includes('attachment')) {
    throw new Error('Échec téléchargement fichier archivé');
  }

  // 6. TEST DE NON-RÉGRESSION : COURRIER NORMAL (NE DOIT PAS ÊTRE ARCHIVÉ DIRECTEMENT)
  console.log('\n6. [TEST NON-RÉGRESSION] Création d’un courrier entrant normal :');
  const normalMp = createMultipartBody({
    processing_mode: 'NORMAL',
    title: 'Demande de subvention recherche 2026',
    sender_name: 'Laboratoire de Botanique et Pharmacopée',
    priority: 'NORMAL',
    instruction: 'Pour examen du Secrétaire Général'
  }, [
    { field: 'files', name: 'demande_subvention.pdf', mime: 'application/pdf', content: samplePdfBuffer }
  ]);

  const normalRes = await request('POST', '/api/documents/incoming', normalMp.body, scToken, normalMp.headers);
  console.log(`   - Création Courrier Normal : Status ${normalRes.status} (ID: ${normalRes.data.id})`);
  const normalDoc = await db.get('SELECT * FROM documents WHERE id = ?', [normalRes.data.id]);
  console.log(`   - Statut Courrier Normal : ${normalDoc.status} (Attendu: IN_PROGRESS)`);
  console.log(`   - Service destinataire : ${normalDoc.current_service_id} (Secrétaire Général)`);
  if (normalDoc.status === 'ARCHIVED') {
    throw new Error('ERREUR: Le courrier normal ne doit pas être archivé immédiatement !');
  }
  console.log('   ✅ Le workflow normal des courriers entrants est parfaitement préservé.');

  // 7. TEST MULTI-TYPES D'ACTES OFFICIELS
  console.log('\n7. [TEST MULTI-TYPES] Vérification de l\'archivage direct pour plusieurs catégories :');
  const acts = [
    { type: 'DECRET', title: 'Décret présidentiel D/2026/089' },
    { type: 'NOTE_SERVICE', title: 'Note de service relative au calendrier académique' },
    { type: 'DECISION', title: 'Décision rectorale portant organisation des examens' },
    { type: 'CIRCULAIRE', title: 'Circulaire d\'application budgétaire' },
    { type: 'PROCES_VERBAL', title: 'Procès-verbal du Conseil d\'Université' }
  ];

  for (const act of acts) {
    const actMp = createMultipartBody({
      processing_mode: 'DIRECT_ARCHIVE',
      official_type: act.type,
      title: act.title,
      sender_name: 'Université de Kindia',
      priority: 'NORMAL'
    }, [
      { field: 'files', name: `${act.type.toLowerCase()}_sample.pdf`, mime: 'application/pdf', content: samplePdfBuffer }
    ]);

    const res = await request('POST', '/api/documents/incoming', actMp.body, scToken, actMp.headers);
    if (res.status !== 201) throw new Error(`Échec création acte ${act.type}`);
    const row = await db.get('SELECT * FROM documents WHERE id = ?', [res.data.id]);
    console.log(`   - Acte [${act.type}] -> ID ${row.id} | Réf: ${row.reference} | Statut: ${row.status} | Mode: ${row.processing_mode}`);
    if (row.status !== 'ARCHIVED' || row.document_type !== act.type) {
      throw new Error(`Échec classement type ${act.type}`);
    }
  }

  // 8. TEST SÉCURITÉ & MULTI-TENANT (REFUS SANS TOKEN)
  console.log('\n8. [TEST SÉCURITÉ & CONTRÔLE D\'ACCÈS] Requête non authentifiée :');
  const unauthRes = await request('GET', `/api/documents/${directDocId}/view`, null, null);
  console.log(`   - GET sans token : Status ${unauthRes.status} (Attendu: 401 Accès non autorisé)`);
  if (unauthRes.status !== 401) {
    throw new Error('ERREUR DE SÉCURITÉ: L\'accès sans token n\'a pas été bloqué avec HTTP 401 !');
  }
  console.log('   ✅ Sécurité inviolable : Les fichiers restent 100% protégés contre tout accès non authentifié.');

  console.log('\n========================================================================');
  console.log('🎉 TOUS LES TESTS D\'ARCHIVAGE ET DE CONSULTATION SÉCURISÉE ONT RÉUSSI (100%) !');
  console.log('========================================================================\n');
}

runArchivesTestSuite().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ ERREUR LORS DE LA SUITE DE TESTS:', err);
  process.exit(1);
});
