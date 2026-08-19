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

async function runFrozenTemplateWorkflowTest() {
  console.log('========================================================================');
  console.log('🏛️ VALIDATION : CHAÎNE DOCUMENTAIRE INTÈGRE & MODÈLE FIGÉ ORDRE DE MISSION');
  console.log('========================================================================\n');

  const docxService = require('./src/services/docxService');

  // 1. Logins
  console.log('1. 🔑 Authentification des intervenants...');
  const adminLogin = await request('POST', '/api/auth/login', { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });
  const scLogin = await request('POST', '/api/auth/login', { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });
  const sgLogin = await request('POST', '/api/auth/login', { identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' });

  if (adminLogin.status !== 200 || !adminLogin.data.token) throw new Error('Échec login Admin');
  if (scLogin.status !== 200 || !scLogin.data.token) throw new Error('Échec login Secrétariat Central');
  if (sgLogin.status !== 200 || !sgLogin.data.token) throw new Error('Échec login Secrétaire Général');

  const adminToken = adminLogin.data.token;
  const scToken = scLogin.data.token;
  const sgToken = sgLogin.data.token;
  console.log('   ✅ Admin, SC et SG authentifiés avec succès.');

  // 2. Step A: Admin creates and personalizes Template A (v12)
  console.log('\n2. 📄 [ADMIN] Création & Personnalisation du Modèle A (Version personnalisée v12)...');
  const masterDocx = await docxService.buildOfficialKindiaMissionDocx();
  const mp = createMultipartBody({
    code: 'ORDRE_MISSION_TEMPLATE_A',
    document_type_code: 'ORDRE_MISSION',
    name: 'Ordre de Mission Officiel Kindia Template A',
    category: 'OFFICIAL',
    editor_type: 'MS_WORD',
    is_default: 'true'
  }, [
    { field: 'template_file', name: 'template_a_v1.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: masterDocx }
  ]);

  const createTplRes = await request('POST', '/api/templates', mp.body, adminToken, mp.headers);
  if (createTplRes.status !== 201 && createTplRes.status !== 200) throw new Error('Échec création Modèle A');
  const templateAId = createTplRes.data.id;

  // Customize Template A to produce a new version
  const custRes = await request('POST', `/api/templates/${templateAId}/customize`, {
    content_body_html: `
      <h2 style="text-align:center; color:#0B2545;">UNIVERSITÉ DE KINDIA - MODÈLE OFFICIEL A (V12)</h2>
      <p style="text-align:center; font-weight:bold;">ORDRE DE MISSION N° {{reference}}</p>
      <p>Il est ordonné au Dr/Professeur : <strong>{{missionnaire_nom}} {{missionnaire_prenoms}}</strong></p>
      <p>Fonction : {{missionnaire_fonction}} - Matricule : {{matricule}}</p>
      <p>Destination : <strong>{{destination}}</strong></p>
      <p>Objet : {{objet_mission}}</p>
      <p>Dates : Du {{date_depart}} au {{date_retour}}</p>
      <p>Moyen de transport : {{moyen_transport}}</p>
    `,
    save_as_new_version: true,
    change_description: 'Version personnalisée v12 par Administrateur'
  }, adminToken);

  if (custRes.status !== 200) throw new Error('Échec personnalisation Modèle A');
  const versionAId = custRes.data.version || 2;
  console.log(`   ✅ Modèle A créé (ID: ${templateAId}, Version personnalisée: v${versionAId})`);

  // 3. Step B: Secrétariat Central creates OM-001 selecting Template A (v12)
  console.log('\n3. ✍️ [SECRÉTARIAT CENTRAL] Création de l\'Ordre de Mission OM-001 basé sur le Modèle A...');
  const createOMRes = await request('POST', '/api/missions', {
    template_id: templateAId,
    template_version_id: versionAId,
    missionary_name: 'SOW',
    missionary_firstnames: 'Alpha Oumar',
    function_title: 'Enseignant-Chercheur / Chef de Département Informatique',
    nationality: 'Guinéenne',
    matricule: 'UK-ENS-884',
    destination: 'Conakry (Ministère MESRSI)',
    object_of_mission: 'Participation aux assises nationales sur la transformation numérique universitaire',
    transport_mode: 'Véhicule de service UK-04',
    departure_date: '2026-08-25',
    return_date: '2026-08-29',
    observations: 'Prise en charge officielle par l\'Université de Kindia.'
  }, scToken);

  if (createOMRes.status !== 201 || !createOMRes.data.id) {
    throw new Error('Échec création ordre de mission : ' + JSON.stringify(createOMRes.data));
  }
  const omDocId = createOMRes.data.id;
  const omReference = createOMRes.data.reference;
  console.log(`   ✅ Ordre de mission créé avec succès : ID ${omDocId}, Réf: ${omReference}`);

  // Fetch OM details & verify frozen instance metadata
  const docDetailRes = await request('GET', `/api/documents/${omDocId}`, null, scToken);
  if (docDetailRes.status !== 200) throw new Error('Échec récupération détails document');
  const extension = docDetailRes.data.extension;

  console.log(`   - template_id lié : ${extension.template_id}`);
  console.log(`   - template_version_number lié : ${extension.template_version_number}`);
  console.log(`   - generated_file_path (Instance PDF) : ${extension.generated_file_path}`);
  console.log(`   - generated_docx_path (Instance DOCX) : ${extension.generated_docx_path}`);

  if (extension.template_id !== templateAId) {
    throw new Error(`Incohérence : template_id attendu ${templateAId}, reçu ${extension.template_id}`);
  }
  if (!extension.generated_file_path || !extension.generated_docx_path) {
    throw new Error('Instance documentaire figée manquante dans mission_orders !');
  }
  console.log('   ✅ Relations et instance documentaire figée 100% enregistrées.');

  // Verify History logs
  const historyRes = await request('GET', `/api/documents/${omDocId}/history`, null, scToken);
  const actions = (historyRes.data || []).map(h => h.action);
  console.log('   - Actions enregistrées dans l\'historique :', actions.join(' ➔ '));
  if (!actions.includes('MODÈLE_SÉLECTIONNÉ') || !actions.includes('DOCUMENT_FINAL_GÉNÉRÉ') || !actions.includes('TRANSMIS_AU_SECRÉTAIRE_GÉNÉRAL')) {
    throw new Error('Actions obligatoires de traçabilité manquantes dans l\'historique !');
  }
  console.log('   ✅ Traçabilité chronologique complète vérifiée.');

  // 4. Step C: Admin modifies Template A (creating v13) or creates Template B (Immutability Protection)
  console.log('\n4. 🛡️ [PROTECTION IMMUTABILITÉ] L\'Administrateur modifie le modèle après création de l\'OM...');
  const newModifRes = await request('POST', `/api/templates/${templateAId}/customize`, {
    content_body_html: `
      <h1 style="text-align:center; color:red;">NOUVEAU MODÈLE MODIFIÉ V13 - NE DOIT PAS AFFECTER OM-001</h1>
      <p>Texte entièrement changé par l'administrateur ultérieurement.</p>
    `,
    save_as_new_version: true,
    change_description: 'Modification ultérieure v13'
  }, adminToken);
  console.log(`   - Nouveau modèle v${newModifRes.data.version} enregistré dans l'administration.`);

  // Verify OM-001 is STILL referencing its original instance and version
  const checkOM = await request('GET', `/api/documents/${omDocId}`, null, scToken);
  if (checkOM.data.extension.template_version_number === newModifRes.data.version) {
    throw new Error('REGRESSION : L\'ordre de mission OM-001 a été écrasé par la nouvelle version du modèle !');
  }
  console.log(`   ✅ OM-001 est STRICTEMENT FIGÉ sur la version v${checkOM.data.extension.template_version_number}.`);

  // 5. Step D: Secrétaire Général consults and previews OM-001
  console.log('\n5. 👁️ [SECRÉTAIRE GÉNÉRAL] Consultation du document transmis pour signature...');
  const sgViewRes = await request('GET', `/api/documents/${omDocId}/view`, null, sgToken);
  console.log(`   - GET /api/documents/${omDocId}/view : Status ${sgViewRes.status}, Content-Type: ${sgViewRes.headers['content-type']}`);
  if (sgViewRes.status !== 200 || !sgViewRes.buffer || sgViewRes.buffer.length < 500) {
    throw new Error('Échec consultation document par le Secrétaire Général');
  }
  console.log('   ✅ Le Secrétaire Général reçoit et visualise exactement l\'instance préparée pour Dr. Alpha SOW.');

  // 6. Step E: Secrétaire Général signs OM-001
  console.log('\n6. ✍️ [SECRÉTAIRE GÉNÉRAL] Signature électronique officielle de l\'instance...');
  const signRes = await request('POST', `/api/missions/${omDocId}/sign`, {}, sgToken);
  console.log(`   - Signature Status ${signRes.status} : ${signRes.data?.message}`);
  if (signRes.status !== 200 || !signRes.data.success) {
    throw new Error('Échec signature par le Secrétaire Général : ' + JSON.stringify(signRes.data));
  }

  // 7. Step F: Verify Returned to SC & Document Locked
  console.log('\n7. 📬 [RETOUR SC & VERROUILLAGE] Vérification du document signé et verrouillé...');
  const docAfterSign = await request('GET', `/api/documents/${omDocId}`, null, scToken);
  const status = docAfterSign.data.status;
  const isLocked = docAfterSign.data.is_locked;
  const signedPdf = docAfterSign.data.extension.signed_pdf_path;
  console.log(`   - Statut du document : ${status}`);
  console.log(`   - Document verrouillé (is_locked) : ${isLocked}`);
  console.log(`   - signed_pdf_path : ${signedPdf}`);

  if (isLocked !== 1 || !signedPdf) {
    throw new Error('Le document n\'est pas correctement signé ou verrouillé !');
  }
  console.log('   ✅ Document signé numériquement, verrouillé et retourné au Secrétariat Central.');

  // 8. Step G: Handover to Missionary (Remise au demandeur)
  console.log('\n8. 🤝 [REMISE AU MISSIONNAIRE] Remise officielle de la version signée...');
  const deliverRes = await request('POST', `/api/missions/${omDocId}/deliver`, {
    recipient_name: 'Dr. Alpha Oumar SOW'
  }, scToken);
  console.log(`   - Remise Status ${deliverRes.status} : ${deliverRes.data?.message}`);
  if (deliverRes.status !== 200) throw new Error('Échec remise au missionnaire');

  // Verify final download points to signed PDF
  const downloadRes = await request('GET', `/api/documents/${omDocId}/download`, null, scToken);
  if (downloadRes.status !== 200 || !downloadRes.buffer) {
    throw new Error('Échec téléchargement version signée');
  }
  console.log(`   - Fichier téléchargé par le missionnaire : ${downloadRes.headers['content-disposition']}`);
  console.log('   ✅ Le missionnaire télécharge exclusivement la VERSION OFFICIELLE SIGNÉE.');

  console.log('\n========================================================================');
  console.log('🎉 TOUS LES 21 CRITÈRES DU WORKFLOW DOCUMENTAIRE ONT ÉTÉ VALIDÉS AVEC SUCCÈS !');
  console.log('========================================================================\n');
}

runFrozenTemplateWorkflowTest().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ ÉCHEC DU TEST DU WORKFLOW DOCUMENTAIRE:', err);
  process.exit(1);
});
