const http = require('http');
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

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
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf8');
        try {
          const parsed = JSON.parse(text);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, buffer });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: null, buffer, text });
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

async function runTemplateCustomizationVerification() {
  console.log('========================================================================');
  console.log('🏛️ VALIDATION : PERSONNALISATION DU MODÈLE D\'ORDRE DE MISSION (NO DUPLICATE HEADER)');
  console.log('========================================================================\n');

  const docxService = require('./src/services/docxService');

  // 1. Authenticate as Admin
  const adminLogin = await request('POST', '/api/auth/login', {
    identity: 'admin@univ-kindia.edu.gn',
    password: 'Admin123!'
  });
  if (adminLogin.status !== 200 || !adminLogin.data.token) throw new Error('Échec login Admin');
  const adminToken = adminLogin.data.token;
  console.log('1. ✅ Authentification Administrateur réussie.');

  // 2. Build a realistic master DOCX file with an existing institutional header
  console.log('\n2. 📄 Création du document DOCX maître avec son en-tête institutionnel complet...');
  const masterDocxBuffer = await docxService.buildOfficialKindiaMissionDocx();
  
  // 3. Upload this master file as a new template or new version
  const uploadMp = createMultipartBody({
    code: 'ORDRE_MISSION_OFFICIEL_TEST',
    document_type_code: 'ORDRE_MISSION',
    name: 'Modèle Ordre de Mission Officiel Kindia',
    category: 'OFFICIAL',
    editor_type: 'MS_WORD',
    is_default: 'true'
  }, [
    { field: 'template_file', name: 'ordre_de_mission_original.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: masterDocxBuffer }
  ]);

  const createRes = await request('POST', '/api/templates', uploadMp.body, adminToken, uploadMp.headers);
  console.log(`   - Création / Importation modèle : Status ${createRes.status}`);
  if (createRes.status !== 201 && createRes.status !== 200) {
    throw new Error('Échec création modèle : ' + JSON.stringify(createRes.data));
  }
  const templateId = createRes.data.id;
  const templateCode = createRes.data.code;
  console.log(`   - Template ID : ${templateId} (Code : ${templateCode})`);

  // 4. [TEST PREVIEW]
  console.log('\n3. 👁️ [PREVIEW] Test de la prévisualisation (récupération directe du fichier)...');
  const previewRes = await request('GET', `/api/templates/${templateId}/versions/current/file`, null, adminToken);
  console.log(`   - GET /api/templates/${templateId}/versions/current/file : Status ${previewRes.status}`);
  if (previewRes.status !== 200) throw new Error('Échec prévisualisation du fichier');

  const previewZip = await JSZip.loadAsync(previewRes.buffer);
  const previewDocXml = await previewZip.file('word/document.xml').async('string');
  const headerMatchesPreview = (previewDocXml.match(/RÉPUBLIQUE DE GUINÉE/g) || []).length;
  console.log(`   - Occurrences de "RÉPUBLIQUE DE GUINÉE" en prévisualisation : ${headerMatchesPreview}`);
  if (headerMatchesPreview !== 1) {
    throw new Error(`En-tête dupliqué détecté dès la prévisualisation ! Trouvé ${headerMatchesPreview} occurrences.`);
  }
  console.log('   ✅ Prévisualisation fidèle : Le fichier original contient exactement 1 seul en-tête.');

  // 5. [TEST ONLYOFFICE CONFIG - PERSONNALISER]
  console.log('\n4. ✍️ [PERSONNALISER] Test de la configuration ONLYOFFICE...');
  const onlyofficeConfigRes = await request('GET', `/api/templates/${templateId}/onlyoffice/config?mode=edit`, null, adminToken);
  console.log(`   - GET /api/templates/${templateId}/onlyoffice/config : Status ${onlyofficeConfigRes.status}`);
  if (onlyofficeConfigRes.status !== 200 || !onlyofficeConfigRes.data.config) {
    throw new Error('Échec récupération config ONLYOFFICE');
  }

  const docUrl = onlyofficeConfigRes.data.config.document.url;
  const docKey = onlyofficeConfigRes.data.config.document.key;
  console.log(`   - Document Key ONLYOFFICE : ${docKey}`);
  console.log(`   - Document URL ONLYOFFICE : ${docUrl}`);

  // Fetch the actual file ONLYOFFICE will load
  const parsedUrl = new URL(docUrl);
  const onlyofficeFileRes = await request('GET', parsedUrl.pathname + parsedUrl.search);
  console.log(`   - ONLYOFFICE Fetch Binary File : Status ${onlyofficeFileRes.status}`);
  if (onlyofficeFileRes.status !== 200) throw new Error('Échec ONLYOFFICE fetch file');

  const onlyofficeZip = await JSZip.loadAsync(onlyofficeFileRes.buffer);
  const onlyofficeDocXml = await onlyofficeZip.file('word/document.xml').async('string');
  const headerMatchesOnlyoffice = (onlyofficeDocXml.match(/RÉPUBLIQUE DE GUINÉE/g) || []).length;
  console.log(`   - Occurrences de "RÉPUBLIQUE DE GUINÉE" envoyé à ONLYOFFICE : ${headerMatchesOnlyoffice}`);
  if (headerMatchesOnlyoffice !== 1) {
    throw new Error(`En-tête dupliqué envoyé à ONLYOFFICE ! Trouvé ${headerMatchesOnlyoffice} occurrences.`);
  }
  console.log('   ✅ ONLYOFFICE reçoit exactement le même document maître avec 1 seul en-tête.');

  // 6. [TEST CUSTOMIZATION SAVE]
  console.log('\n5. 💾 [ENREGISTRER] Test de personnalisation et enregistrement sans duplication d\'en-tête...');
  // Modify a text element while preserving template structure
  const updatedHtml = `
    <h2 style="text-align:center; font-size:16px; font-weight:bold; color:#0B2545;">RÉPUBLIQUE DE GUINÉE</h2>
    <p style="text-align:center; font-size:11px; font-style:italic; color:#D4AF37;">Travail – Justice – Solidarité</p>
    <p style="text-align:center; font-size:11px; font-weight:bold; color:#0B2545;">MINISTÈRE DE L'ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L'INNOVATION</p>
    <h2 style="text-align:center; font-size:16px; font-weight:bold; color:#0B2545;">UNIVERSITÉ DE KINDIA</h2>
    <p style="text-align:center; font-size:12px; font-weight:bold; color:#475569;">SECRÉTARIAT GÉNÉRAL</p>
    <p>&nbsp;</p>
    <h2 style="text-align:center; font-size:18px; font-weight:bold; color:#0B2545;">ORDRE DE MISSION OFFICIEL</h2>
    <p style="text-align:center; font-weight:bold; color:#D4AF37;">N° {{reference}}</p>
    <p>Il est ordonné à : <strong>{{missionnaire_prenoms}} {{missionnaire_nom}}</strong></p>
    <p>Fonction : {{missionnaire_fonction}}</p>
    <p>Service / Faculté : {{missionnaire_service}}</p>
    <p>Matricule : {{matricule}}</p>
    <p>De se rendre à : <strong>{{destination}}</strong></p>
    <p>Objet de la Mission : <strong>{{objet_mission}}</strong></p>
    <p>Moyen de Transport : {{moyen_transport}}</p>
    <p>Date de Départ : {{date_depart}}</p>
    <p>Date de retour : {{date_retour}}</p>
    <p>Les autorités civiles et militaires sont priées de bien vouloir faciliter l'accomplissement de la mission.</p>
    <p style="text-align:right;">Kindia, le {{date_document}}</p>
    <p style="text-align:right;"><strong>LE SECRÉTAIRE GÉNÉRAL</strong></p>
    <p style="text-align:right;">{{signature_secretaire_general}}</p>
  `;

  const saveRes = await request('POST', `/api/templates/${templateId}/customize`, {
    content_body_html: updatedHtml,
    save_as_new_version: true,
    change_description: 'Personnalisation avec vérification de non-duplication'
  }, adminToken);

  console.log(`   - Enregistrement Personnalisation : Status ${saveRes.status} (v${saveRes.data.version})`);
  if (saveRes.status !== 200 || !saveRes.data.success) {
    throw new Error('Échec enregistrement personnalisation : ' + JSON.stringify(saveRes.data));
  }

  // 7. [TEST PREVIEW AFTER SAVE]
  console.log('\n6. 🔄 [RE-PREVIEW] Test de la prévisualisation après enregistrement...');
  const rePreviewRes = await request('GET', `/api/templates/${templateId}/versions/current/file`, null, adminToken);
  console.log(`   - GET /api/templates/${templateId}/versions/current/file : Status ${rePreviewRes.status}`);
  if (rePreviewRes.status !== 200) throw new Error('Échec réouverture prévisualisation');

  const reZip = await JSZip.loadAsync(rePreviewRes.buffer);
  const reDocXml = await reZip.file('word/document.xml').async('string');
  const headerMatchesSaved = (reDocXml.match(/RÉPUBLIQUE DE GUINÉE/g) || []).length;
  console.log(`   - Occurrences de "RÉPUBLIQUE DE GUINÉE" après sauvegarde : ${headerMatchesSaved}`);
  if (headerMatchesSaved !== 1) {
    throw new Error(`En-tête dupliqué après sauvegarde ! Trouvé ${headerMatchesSaved} occurrences.`);
  }

  // Verify that modified title exists
  if (!reDocXml.includes('ORDRE DE MISSION OFFICIEL')) {
    throw new Error('La modification apportée n\'a pas été enregistrée dans le DOCX !');
  }

  console.log('   ✅ Le document sauvegardé contient exactement 1 seul en-tête et les modifications apportées.');

  console.log('\n========================================================================');
  console.log('🎉 VALIDATION COMPLÈTE RÉUSSIE : PRÉVISUALISATION ET PERSONNALISATION 100% COHÉRENTES !');
  console.log('========================================================================\n');
}

runTemplateCustomizationVerification().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ ERREUR LORS DU TEST DE PERSONNALISATION:', err);
  process.exit(1);
});
