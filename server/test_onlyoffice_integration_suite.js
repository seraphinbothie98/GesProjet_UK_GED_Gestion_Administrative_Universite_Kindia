const http = require('http');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const BASE_URL = 'http://127.0.0.1:5000';

function request(method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {}
    };

    let postData = null;
    if (body) {
      if (typeof body === 'string') {
        postData = body;
        options.headers['Content-Type'] = 'application/json';
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

async function runOnlyOfficeTests() {
  console.log('========================================================================');
  console.log('📄 TEST COMPLET DE VALIDATION : INTÉGRATION ONLYOFFICE DOCS & DOCX UK-GED');
  console.log('========================================================================\n');

  // 1. Login as Admin
  console.log('1. Authentification Administrateur :');
  const loginRes = await request('POST', '/api/auth/login', {
    identity: 'admin@univ-kindia.edu.gn',
    password: 'Admin123!'
  });
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error('Échec login Admin: ' + JSON.stringify(loginRes));
  }
  const adminToken = loginRes.data.token;
  console.log('   - Administrateur authentifié avec succès (Token OK)\n');

  const db = require('./src/database/db');
  const docxService = require('./src/services/docxService');
  const uploadsDir = path.join(__dirname, 'uploads/templates');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  // 2. TEST AVEC DEUX MODÈLES DISTINCTS (RÈGLE ABSOLUE : MÊME DOCUMENT, AUCUN MÉLANGE)
  console.log('2. [TEST DEUX FICHIERS DISTINCTS] Création du Modèle A et du Modèle B :');
  
  // Create File A (DOCX)
  const fileAName = `template_test_A_${Date.now()}.docx`;
  const bufferA = await docxService.buildOfficialKindiaMissionDocx({
    reference: '{{reference}}',
    missionnaire_nom: '{{missionnaire_nom}} (MODELE A)',
    destination: '{{destination}} (KINDIA - CONAKRY A)'
  });
  fs.writeFileSync(path.join(uploadsDir, fileAName), bufferA);

  const insertARes = await db.run(
    `INSERT INTO document_templates (code, document_type_code, name, category, description, editor_type, format, version, is_active, is_default, file_path, created_by)
     VALUES (?, ?, ?, 'OFFICIAL', 'Description Modèle A', 'MS_WORD', 'DOCX', 1, 1, 0, ?, 1)`,
    [`TPL_A_${Date.now()}`, `TPL_A_${Date.now()}`, 'Modèle Officiel A - Ordre de Mission Type A', fileAName]
  );
  const templateAId = insertARes.lastID;
  console.log(`   - Modèle A créé: ID ${templateAId} | Fichier: ${fileAName}`);

  // Create File B (DOCX)
  const fileBName = `template_test_B_${Date.now()}.docx`;
  const bufferB = await docxService.buildOfficialKindiaMissionDocx({
    reference: '{{reference}}',
    missionnaire_nom: '{{missionnaire_nom}} (MODELE B SPECIAL)',
    destination: '{{destination}} (KINDIA - MAMOU B)'
  });
  fs.writeFileSync(path.join(uploadsDir, fileBName), bufferB);

  const insertBRes = await db.run(
    `INSERT INTO document_templates (code, document_type_code, name, category, description, editor_type, format, version, is_active, is_default, file_path, created_by)
     VALUES (?, ?, ?, 'OFFICIAL', 'Description Modèle B', 'MS_WORD', 'DOCX', 1, 1, 0, ?, 1)`,
    [`TPL_B_${Date.now()}`, `TPL_B_${Date.now()}`, 'Modèle Officiel B - Ordre de Mission Type B', fileBName]
  );
  const templateBId = insertBRes.lastID;
  console.log(`   - Modèle B créé: ID ${templateBId} | Fichier: ${fileBName}\n`);

  // 3. VÉRIFIER LA CONFIGURATION ONLYOFFICE POUR LE MODÈLE A
  console.log('3. [TEST ONLYOFFICE CONFIG A] Génération de la configuration pour le Modèle A :');
  const configARes = await request('GET', `/api/templates/${templateAId}/onlyoffice/config`, null, adminToken);
  console.log(`   - Status: ${configARes.status}`);
  if (configARes.status !== 200) throw new Error('Échec génération config ONLYOFFICE A: ' + JSON.stringify(configARes));
  
  console.log(`   - Document Key A: ${configARes.data.documentKey}`);
  console.log(`   - Title A: ${configARes.data.config.document.title}`);
  console.log(`   - Server URL: ${configARes.data.docServerUrl}`);
  console.log(`   - File URL A: ${configARes.data.config.document.url}`);
  console.log(`   - Callback URL A: ${configARes.data.config.editorConfig.callbackUrl}`);

  if (!configARes.data.config.document.key.includes(`UKGED_TPL_${templateAId}_`)) {
    throw new Error('Document key A invalide: ' + configARes.data.config.document.key);
  }

  // 4. VÉRIFIER LA CONFIGURATION ONLYOFFICE POUR LE MODÈLE B
  console.log('\n4. [TEST ONLYOFFICE CONFIG B] Génération de la configuration pour le Modèle B :');
  const configBRes = await request('GET', `/api/templates/${templateBId}/onlyoffice/config`, null, adminToken);
  console.log(`   - Status: ${configBRes.status}`);
  if (configBRes.status !== 200) throw new Error('Échec génération config ONLYOFFICE B: ' + JSON.stringify(configBRes));

  console.log(`   - Document Key B: ${configBRes.data.documentKey}`);
  console.log(`   - Title B: ${configBRes.data.config.document.title}`);

  // STRICT COMPARISON TO PROVE NO MIXUP
  if (configARes.data.documentKey === configBRes.data.documentKey) {
    throw new Error('ERREUR CRITIQUE: Document Key identique entre Modèle A et Modèle B !');
  }
  if (configARes.data.config.document.url === configBRes.data.config.document.url) {
    throw new Error('ERREUR CRITIQUE: URL de fichier identique entre Modèle A et Modèle B !');
  }
  console.log('   ✅ Règle absolue respectée : Modèle A et Modèle B sont strictement isolés et indépendants.\n');

  // 5. TEST DE STREAMING DU FICHIER DOCX POUR ONLYOFFICE
  console.log('5. [TEST STREAMING DOCX] Téléchargement du binaire DOCX par ONLYOFFICE Document Server :');
  const streamUrlA = configARes.data.config.document.url.replace('http://localhost:5000', '');
  const streamResA = await request('GET', streamUrlA, null, null);
  console.log(`   - Status streaming Modèle A: ${streamResA.status} (Content-Type: ${streamResA.headers['content-type']})`);
  if (streamResA.status !== 200) throw new Error('Échec streaming binaire DOCX: ' + streamResA.status);

  // 6. TEST DE SAUVEGARDE & NOUVELLE VERSION VIA ONLYOFFICE
  console.log('\n6. [TEST SAUVEGARDE & NOUVELLE VERSION] Enregistrement d’une version v2 pour le Modèle A :');
  const manualSaveRes = await request('POST', `/api/templates/${templateAId}/onlyoffice/manual-save`, {
    save_as_new_version: true,
    change_description: 'Mise à jour officielle via ONLYOFFICE Docs (v2)'
  }, adminToken);

  console.log(`   - Création version v2: Status ${manualSaveRes.status} -> ${manualSaveRes.data.message}`);
  if (manualSaveRes.status !== 200 || manualSaveRes.data.version !== 2) {
    throw new Error('Échec création nouvelle version: ' + JSON.stringify(manualSaveRes));
  }

  // Verify new version config
  const configAV2Res = await request('GET', `/api/templates/${templateAId}/onlyoffice/config?version_id=2`, null, adminToken);
  console.log(`   - Configuration v2 document key: ${configAV2Res.data.documentKey}`);
  if (!configAV2Res.data.documentKey.includes(`UKGED_TPL_${templateAId}_V2_`)) {
    throw new Error('Document key v2 incorrect: ' + configAV2Res.data.documentKey);
  }

  // 7. TEST DU REMPLACEMENT DES CHAMPS DYNAMIQUES & SIGNATURES LORS DE LA GÉNÉRATION
  console.log('\n7. [TEST CHAMPS DYNAMIQUES & GÉNÉRATION RÉELLE] Remplacement des balises dans le DOCX :');
  const sampleMissionData = {
    reference: 'UK/RECT/OM/2026/000042',
    date_document: '17/08/2026',
    annee_universitaire: '2025-2026',
    missionnaire_nom: 'CAMARA',
    missionnaire_prenoms: 'Ibrahima Sory',
    missionnaire_fonction: 'Enseignant-Chercheur / Maître de Conférences',
    missionnaire_service: 'Faculté des Sciences',
    matricule: 'UK-ENS-2026-99',
    destination: 'Labé (Centre Universitaire)',
    objet_mission: 'Coordination pédagogique et jury de soutenance',
    date_depart: '25/08/2026',
    date_retour: '30/08/2026',
    moyen_transport: 'VÉHICULE DE SERVICE',
    conduit_par: 'Véhicule RC-1122-K (Chauffeur : BARRY Mamadou)',
    signature_recteur: '[SIGNATURE NUMÉRIQUE CERTIFIÉE RECTEUR]',
    signature_secretaire_general: '[SIGNATURE NUMÉRIQUE SG]',
    signataire_nom: 'Prof. Jacques KOUROUMA'
  };

  const genRes = await request('POST', `/api/templates/${templateAId}/generate-docx`, sampleMissionData, adminToken);
  console.log(`   - Génération document Word final: Status ${genRes.status}`);
  if (genRes.status !== 200 || !genRes.data.filename) {
    throw new Error('Échec génération Word final: ' + JSON.stringify(genRes));
  }
  console.log(`   - Fichier généré: ${genRes.data.filename}`);

  // Inspect generated DOCX content to verify all placeholders replaced
  const genDocxPath = path.join(uploadsDir, genRes.data.filename);
  const genBuffer = fs.readFileSync(genDocxPath);
  const zip = await JSZip.loadAsync(genBuffer);
  const docXml = await zip.file('word/document.xml').async('string');

  console.log('   - Vérification de la présence des données réelles dans document.xml :');
  const checkKeys = ['UK/RECT/OM/2026/000042', 'CAMARA', 'Ibrahima Sory', 'Labé (Centre Universitaire)', '[SIGNATURE NUMÉRIQUE SG]'];
  for (const k of checkKeys) {
    if (docXml.includes(k)) {
      console.log(`     ✅ Contenu trouvé avec succès : "${k}"`);
    } else {
      throw new Error(`Contenu manquant dans le DOCX généré : "${k}"`);
    }
  }

  // 8. TEST MODÈLE PAR DÉFAUT
  console.log('\n8. [TEST MODÈLE PAR DÉFAUT] Définition du Modèle A comme modèle par défaut :');
  const defRes = await request('PUT', `/api/templates/${templateAId}/set-default`, { force: true }, adminToken);
  console.log(`   - Résultat: Status ${defRes.status} -> ${defRes.data.message}`);
  if (defRes.status !== 200) throw new Error('Échec définition modèle par défaut');

  // 9. VÉRIFICATION DES JOURNAUX D’AUDIT
  console.log('\n9. [TEST AUDIT & LOGS] Vérification des événements enregistrés :');
  const auditLogs = await db.all(
    'SELECT action, metadata FROM audit_logs WHERE entity_type = "TEMPLATE" AND entity_id = ? ORDER BY id DESC LIMIT 5',
    [templateAId]
  );
  auditLogs.forEach(log => {
    console.log(`   - [AUDIT] ${log.action} : ${log.metadata || 'OK'}`);
  });

  console.log('\n========================================================================');
  console.log('🎉 TOUS LES TESTS ONLYOFFICE DOCS & DOCX ONT RÉUSSI AVEC 100% DE SUCCÈS !');
  console.log('========================================================================\n');
}

runOnlyOfficeTests().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ ERREUR LORS DU TEST ONLYOFFICE:', err);
  process.exit(1);
});
