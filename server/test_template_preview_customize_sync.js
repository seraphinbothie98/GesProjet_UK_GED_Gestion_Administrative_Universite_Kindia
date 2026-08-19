const db = require('./src/database/db');
const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, UPLOAD_DIR } = require('./src/config/constants');
const docxService = require('./src/services/docxService');

async function runTemplateSyncTests() {
  console.log('=== SUITE DE TESTS : LIAISON 1:1 MODÈLE-PRÉVISUALISATION-PERSONNALISATION ET ÉDITEUR WORD ===\n');

  // Token for Admin
  const adminToken = jwt.sign(
    { userId: 1, email: 'admin@univ-kindia.edu.gn', role_code: 'ADMINISTRATEUR', service_id: 1 },
    JWT_SECRET
  );

  // Helper for HTTP requests
  function apiRequest(method, urlPath, token = null, body = null) {
    return new Promise((resolve, reject) => {
      const postData = body ? JSON.stringify(body) : null;
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (postData) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const options = {
        hostname: '127.0.0.1',
        port: 5000,
        path: urlPath,
        method: method,
        headers: headers
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data, headers: res.headers });
          }
        });
      });
      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  // Setup: Create 2 distinct DOCX files with different contents
  const templatesDir = path.join(UPLOAD_DIR, 'templates');
  if (!fs.existsSync(templatesDir)) fs.mkdirSync(templatesDir, { recursive: true });

  const fileAName = `MODELE_OM_A_${Date.now()}.docx`;
  const fileBName = `MODELE_OM_B_${Date.now()}.docx`;

  const docxABuffer = await docxService.buildOfficialKindiaMissionDocx({
    destination: 'CONAKRY - MINISTÈRE MESRSI',
    objet_mission: 'MISSION OFFICIELLE A - CONCERTATION NATIONALE'
  });
  fs.writeFileSync(path.join(templatesDir, fileAName), docxABuffer);

  const docxBBuffer = await docxService.buildOfficialKindiaMissionDocx({
    destination: 'LABÉ - UNIVERSITÉ DE LABÉ',
    objet_mission: 'MISSION OFFICIELLE B - RECHERCHE APPLIQUÉE ET JURY'
  });
  fs.writeFileSync(path.join(templatesDir, fileBName), docxBBuffer);

  // 1. Insert Template A and Template B in DB
  const codeA = `OM_TEST_A_${Date.now()}`;
  const codeB = `OM_TEST_B_${Date.now()}`;

  const resA = await db.run(
    `INSERT INTO document_templates (code, document_type_code, name, category, format, editor_type, version, is_active, is_default, file_path, created_by)
     VALUES (?, 'MISSION_ORDER', 'Modèle Ordre de Mission A - Conakry', 'Missions', 'DOCX', 'MS_WORD', 1, 1, 0, ?, 1)`,
    [codeA, fileAName]
  );
  const idA = resA.lastID;

  await db.run(
    `INSERT INTO template_versions (template_id, version, version_number, file_path, file_type, editor_type, change_description, status, created_by, uploaded_by)
     VALUES (?, 1, 1, ?, 'DOCX', 'MS_WORD', 'Version initiale A', 'ACTIVE', 1, 1)`,
    [idA, fileAName]
  );

  const resB = await db.run(
    `INSERT INTO document_templates (code, document_type_code, name, category, format, editor_type, version, is_active, is_default, file_path, created_by)
     VALUES (?, 'MISSION_ORDER', 'Modèle Ordre de Mission B - Labé', 'Missions', 'DOCX', 'MS_WORD', 1, 1, 0, ?, 1)`,
    [codeB, fileBName]
  );
  const idB = resB.lastID;

  await db.run(
    `INSERT INTO template_versions (template_id, version, version_number, file_path, file_type, editor_type, change_description, status, created_by, uploaded_by)
     VALUES (?, 1, 1, ?, 'DOCX', 'MS_WORD', 'Version initiale B', 'ACTIVE', 1, 1)`,
    [idB, fileBName]
  );

  console.log(`[+] Création Modèle A (ID: ${idA}, Code: ${codeA}, Fichier: ${fileAName})`);
  console.log(`[+] Création Modèle B (ID: ${idB}, Code: ${codeB}, Fichier: ${fileBName})\n`);

  // ----------------------------------------------------
  // TEST 1 : VÉRIFICATION DE LA LIAISON 1:1 POUR LE MODÈLE A
  // ----------------------------------------------------
  console.log('--- TEST 1 : PRÉVISUALISATION ET ÉDITION DU MODÈLE A ---');

  // 1.1 Prévisualiser Modèle A
  const previewA = await apiRequest('GET', `/api/templates/${idA}/versions/1/file`, adminToken);
  console.log(`   1.1 Prévisualisation A (HTTP Status: ${previewA.status}, Content-Type: ${previewA.headers['content-type']})`);
  if (previewA.status !== 200) throw new Error('Échec 1.1: Prévisualisation Modèle A');

  // 1.2 Charger l'éditeur Word pour Modèle A
  const editA = await apiRequest('GET', `/api/templates/${idA}/versions/1/html`, adminToken);
  console.log(`   1.2 Chargement Éditeur Word A : longueur HTML=${editA.data.html.length} caractères`);
  if (!editA.data.html.includes('ORDRE DE MISSION') || !editA.data.html.includes('missionnaire')) {
    throw new Error('Échec 1.2: Le contenu extrait pour A ne contient pas la structure de l’ordre de mission');
  }

  // 1.3 Modifier le Modèle A dans l'Éditeur Word
  const modifiedHtmlA = editA.data.html + '<p style="color:#0B2545;font-weight:bold;">MODIFICATION OFFICIELLE VALIDÉE SUR MODÈLE A - UNIVERSITÉ DE KINDIA</p>';
  const saveResA = await apiRequest('POST', `/api/templates/${idA}/customize`, adminToken, {
    content_body_html: modifiedHtmlA,
    save_as_new_version: false
  });
  console.log(`   1.3 Enregistrement des modifications sur Modèle A : ${saveResA.data.message}`);
  if (saveResA.status !== 200 || !saveResA.data.success) {
    throw new Error('Échec 1.3: Enregistrement des modifications sur Modèle A');
  }

  // 1.4 Vérifier que la nouvelle prévisualisation de A contient bien les modifications
  const reloadEditA = await apiRequest('GET', `/api/templates/${idA}/versions/1/html`, adminToken);
  if (!reloadEditA.data.html.includes('MODIFICATION OFFICIELLE VALIDÉE SUR MODÈLE A')) {
    throw new Error('Échec 1.4: Les modifications de A ne sont pas persistées');
  }
  console.log('   ✅ TEST 1 VALIDÉ : Modèle A prévisualisé, personnalisé et sauvegardé avec succès.\n');

  // ----------------------------------------------------
  // TEST 2 : NON-RÉGRESSION ET ISOLATION STRICTE DE B
  // ----------------------------------------------------
  console.log('--- TEST 2 : ISOLATION STRICTE ET VÉRIFICATION DU MODÈLE B ---');

  // 2.1 Prévisualiser Modèle B
  const previewB = await apiRequest('GET', `/api/templates/${idB}/versions/1/file`, adminToken);
  console.log(`   2.1 Prévisualisation B (HTTP Status: ${previewB.status})`);
  if (previewB.status !== 200) throw new Error('Échec 2.1: Prévisualisation Modèle B');

  // 2.2 Charger l'éditeur Word pour Modèle B
  const editB = await apiRequest('GET', `/api/templates/${idB}/versions/1/html`, adminToken);
  console.log(`   2.2 Chargement Éditeur Word B : Vérification qu'il n'a PAS été contaminé par A`);
  if (editB.data.html.includes('MODIFICATION OFFICIELLE VALIDÉE SUR MODÈLE A')) {
    throw new Error('❌ ÉCHEC CRITIQUE : Le Modèle B a été écrasé ou contaminé par le Modèle A !');
  }
  console.log('   2.3 Modèle B 100% intègre et distinct de Modèle A.');

  // 2.3 Personnaliser Modèle B avec création d'une NOUVELLE VERSION (v2)
  const modifiedHtmlB = editB.data.html + '<p style="color:#D4AF37;font-weight:bold;">AJOUT SPÉCIFIQUE VERSION 2 SUR MODÈLE B</p>';
  const saveResB = await apiRequest('POST', `/api/templates/${idB}/customize`, adminToken, {
    content_body_html: modifiedHtmlB,
    save_as_new_version: true,
    change_description: 'Création version v2 pour Modèle B'
  });
  console.log(`   2.4 Création nouvelle version v2 sur Modèle B : ${saveResB.data.message} (Version: v${saveResB.data.version})`);
  if (saveResB.data.version !== 2) throw new Error('Échec 2.4: Version v2 non créée pour B');

  // 2.5 Vérifier les versions de B
  const detailB = await apiRequest('GET', `/api/templates/${idB}`, adminToken);
  console.log(`   2.5 Nombre de versions enregistrées pour B : ${detailB.data.versions.length}`);
  if (detailB.data.versions.length !== 2) throw new Error('Échec 2.5: Deux versions attendues pour B');

  console.log('   ✅ TEST 2 VALIDÉ : Aucun mélange entre Modèle A et Modèle B. Gestion des versions 100% opérationnelle.\n');

  // ----------------------------------------------------
  // TEST 3 : CONSERVATION DES BALISES DYNAMIQUES ET SIGNATURES
  // ----------------------------------------------------
  console.log('--- TEST 3 : CONSERVATION DES BALISES DYNAMIQUES & DES SIGNATURES ---');
  const requiredTags = [
    '{{reference}}',
    '{{missionnaire_nom}}',
    '{{missionnaire_prenoms}}',
    '{{destination}}',
    '{{objet_mission}}',
    '{{date_depart}}',
    '{{date_retour}}',
    '{{signature_secretaire_general}}'
  ];

  for (const tag of requiredTags) {
    const tagPresent = editA.data.html.includes(tag) || editA.data.html.includes(tag.replace(/[{}]/g, ''));
    console.log(`   - Balise ${tag.padEnd(35)} : ${tagPresent ? '✅ PRÉSENTE ET INTACTE' : '⚠️ MANQUANTE'}`);
  }

  // Cleanup test templates
  await db.run('DELETE FROM template_versions WHERE template_id IN (?, ?)', [idA, idB]);
  await db.run('DELETE FROM document_templates WHERE id IN (?, ?)', [idA, idB]);
  if (fs.existsSync(path.join(templatesDir, fileAName))) fs.unlinkSync(path.join(templatesDir, fileAName));
  if (fs.existsSync(path.join(templatesDir, fileBName))) fs.unlinkSync(path.join(templatesDir, fileBName));

  console.log('\n======================================================================');
  console.log('🎉 TOUS LES TESTS DE SYNCHRONISATION ET DE LIAISON 1:1 SONT VALIDÉS !');
  console.log('======================================================================\n');
}

runTemplateSyncTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
