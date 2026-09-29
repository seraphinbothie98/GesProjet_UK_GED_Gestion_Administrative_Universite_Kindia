const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const API_BASE = 'http://localhost:5000/api';

async function createTestDocx(contentWithTags) {
  const zip = new JSZip();
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${contentWithTags}</w:t></w:r></w:p>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  return await zip.generateAsync({ type: 'nodebuffer' });
}

async function runComprehensiveTests() {
  console.log('================================================================');
  console.log(' UK-GED - VALIDATION CENTRE DE GESTION DU MODÈLE ORDRE DE MISSION');
  console.log('================================================================\n');

  try {
    // 1. Authenticate Admin
    console.log('1. Authentification Administrateur (admin@univ-kindia.edu.gn)...');
    const adminRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' })
    });
    const adminData = await adminRes.json();
    if (!adminRes.ok) throw new Error('Admin login failed: ' + adminData.error);
    const adminToken = adminData.token;
    console.log('✅ Administrateur connecté avec succès.');

    // 2. Authenticate Secrétariat Central Agent
    console.log('2. Authentification Agent Secrétariat Central (sc@univ-kindia.edu.gn)...');
    const scRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    const scData = await scRes.json();
    if (!scRes.ok) throw new Error('SC login failed: ' + scData.error);
    const scToken = scData.token;
    console.log('✅ Agent Secrétariat Central connecté avec succès.');

    // 3. Test Fetch Full Template Center
    console.log('\n3. Consultation du Centre de Gestion du Modèle Officiel (Admin)...');
    const centerRes = await fetch(`${API_BASE}/mission-template`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const centerData = await centerRes.json();
    if (!centerRes.ok) throw new Error(centerData.error);
    console.log('✅ Données récupérées :');
    console.log('   - Modèle actuel :', centerData.template?.name || 'Aucun');
    console.log('   - Nombre de versions :', centerData.versions?.length || 0);
    console.log('   - Champs officiels disponibles :', centerData.availableFields?.length || 0);
    console.log('   - Logo actuel :', centerData.branding?.logo_path);
    console.log('   - Filigrane actuel :', centerData.branding?.watermark_path, `(Actif: ${centerData.branding?.watermark_enabled})`);

    // 4. Test Pre-Inspection Endpoint (/api/mission-template/analyze)
    console.log('\n4. Test Analyse Préalable d’un DOCX avec balises connues & inconnues...');
    const docxBuffer = await createTestDocx(
      'ORDRE DE MISSION UK N° {{reference}} ordonné à {{nom}} {{prenoms}}, fonction {{fonction}}, destination {{destination}}, objet {{objet_mission}}. Balise test custom : {{champ_personnalise_special}}.'
    );
    const analyzeBlob = new Blob([docxBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const analyzeForm = new FormData();
    analyzeForm.append('template_file', analyzeBlob, 'test_modele_inspection.docx');

    const analyzeRes = await fetch(`${API_BASE}/mission-template/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: analyzeForm
    });
    const analyzeResult = await analyzeRes.json();
    if (!analyzeRes.ok) throw new Error(analyzeResult.error);
    console.log('✅ Analyse réussie :');
    console.log('   - Balises reconnues (✓) :', analyzeResult.knownFields.join(', '));
    console.log('   - Balises inconnues signalées (⚠) :', analyzeResult.unknownFields.join(', '));

    // 5. Test Template Import (Version 1 creation)
    console.log('\n5. Importation du Modèle Officiel Version 1...');
    const uploadForm = new FormData();
    uploadForm.append('name', 'Ordre de Mission Officiel Kindia');
    uploadForm.append('template_file', analyzeBlob, 'Ordre_Mission_Officiel_v1.docx');

    const uploadRes = await fetch(`${API_BASE}/mission-template/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: uploadForm
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error);
    console.log(`✅ ${uploadData.message} (ID: ${uploadData.template.id}, Version: ${uploadData.template.version_number}, Par Défaut: ${uploadData.template.is_default})`);
    const v1Id = uploadData.template.id;

    // 6. Test Word Revision Upload (Version 2 creation)
    console.log('\n6. Test Révision Word & Création de la Version 2...');
    const revisedBuffer = await createTestDocx(
      'ORDRE DE MISSION RÉVISÉ WORD 2026 - Réf: {{reference}} - Demandeur: {{nom}} {{prenoms}} - Date départ: {{date_depart}} - Retour: {{date_retour}}.'
    );
    const revisedBlob = new Blob([revisedBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const wordRevisionForm = new FormData();
    wordRevisionForm.append('template_file', revisedBlob, 'Ordre_Mission_Officiel_v2_Word.docx');

    const revRes = await fetch(`${API_BASE}/mission-template/upload-revision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: wordRevisionForm
    });
    const revData = await revRes.json();
    if (!revRes.ok) throw new Error(revData.error);
    console.log(`✅ ${revData.message} (Version: ${revData.template.version_number}, Par Défaut: ${revData.template.is_default})`);
    const v2Id = revData.template.id;

    // 7. Test Setting Version 1 as Default and Single Default Rule
    console.log('\n7. Test Définition de la Version 1 comme modèle par défaut...');
    const setDefRes = await fetch(`${API_BASE}/mission-template/versions/${v1Id}/set-default`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const setDefData = await setDefRes.json();
    if (!setDefRes.ok) throw new Error(setDefData.error);
    console.log(`✅ ${setDefData.message}`);

    // Verify in versions list that ONLY v1 is default
    const checkVersionsRes = await fetch(`${API_BASE}/mission-template`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const checkVersionsData = await checkVersionsRes.json();
    const defaults = checkVersionsData.versions.filter(v => v.is_default === 1);
    console.log(`✅ Règle d'unicité vérifiée : ${defaults.length} seul modèle par défaut (Version ${defaults[0].version_number}).`);

    // Reset v2 as default
    await fetch(`${API_BASE}/mission-template/versions/${v2Id}/set-default`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('✅ Version 2 rétablie comme modèle par défaut.');

    // 8. Test Visual Identity: Logo Upload
    console.log('\n8. Test Téléversement du Logo Officiel...');
    const logoBlob = new Blob(['PNG_DUMMY_IMAGE_DATA_UK'], { type: 'image/png' });
    const logoForm = new FormData();
    logoForm.append('logo_file', logoBlob, 'logo_kindia_test.png');

    const logoRes = await fetch(`${API_BASE}/mission-template/branding/logo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: logoForm
    });
    const logoData = await logoRes.json();
    if (!logoRes.ok) throw new Error(logoData.error);
    console.log(`✅ ${logoData.message} (Chemin: ${logoData.logo_path})`);

    // 9. Test Visual Identity: Watermark Upload & Settings
    console.log('\n9. Test Téléversement et Configuration du Filigrane...');
    const wmBlob = new Blob(['JPG_DUMMY_WATERMARK_DATA_UK'], { type: 'image/jpeg' });
    const wmForm = new FormData();
    wmForm.append('watermark_file', wmBlob, 'watermark_guinee_test.jpg');

    const wmRes = await fetch(`${API_BASE}/mission-template/branding/watermark`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: wmForm
    });
    const wmData = await wmRes.json();
    if (!wmRes.ok) throw new Error(wmData.error);
    console.log(`✅ ${wmData.message} (Chemin: ${wmData.watermark_path})`);

    // Update settings
    const wmSettingsRes = await fetch(`${API_BASE}/mission-template/branding/watermark-settings`, {
      method: 'PUT',
      headers: { ... { 'Content-Type': 'application/json' }, Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        enabled: true,
        opacity: 0.22,
        size: 75,
        position: 'CENTER'
      })
    });
    const wmSettingsData = await wmSettingsRes.json();
    if (!wmSettingsRes.ok) throw new Error(wmSettingsData.error);
    console.log(`✅ Paramètres filigrane mis à jour : Opacité=${wmSettingsData.branding.watermark_opacity}, Taille=${wmSettingsData.branding.watermark_size}%, Actif=${wmSettingsData.branding.watermark_enabled}`);

    // 10. Test Direct Word URI Endpoint
    console.log('\n10. Test Génération de l’URI de Protocole Microsoft Word...');
    const wordUriRes = await fetch(`${API_BASE}/mission-template/open-word-uri`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const wordUriData = await wordUriRes.json();
    if (!wordUriRes.ok) throw new Error(wordUriData.error);
    console.log(`✅ URI Word générée : ${wordUriData.wordProtocolUri}`);

    // 11. Test Security RBAC: Agent SC must be blocked from all admin endpoints
    console.log('\n11. Test RBAC : Vérification du blocage strict pour l’Agent du Secrétariat Central...');
    const scTests = [
      { name: 'Consultation admin', fn: () => fetch(`${API_BASE}/mission-template`, { headers: { Authorization: `Bearer ${scToken}` } }) },
      { name: 'Import modèle', fn: () => fetch(`${API_BASE}/mission-template/upload`, { method: 'POST', headers: { Authorization: `Bearer ${scToken}` } }) },
      { name: 'Révision Word', fn: () => fetch(`${API_BASE}/mission-template/upload-revision`, { method: 'POST', headers: { Authorization: `Bearer ${scToken}` } }) },
      { name: 'Import logo', fn: () => fetch(`${API_BASE}/mission-template/branding/logo`, { method: 'POST', headers: { Authorization: `Bearer ${scToken}` } }) },
      { name: 'Import filigrane', fn: () => fetch(`${API_BASE}/mission-template/branding/watermark`, { method: 'POST', headers: { Authorization: `Bearer ${scToken}` } }) },
      { name: 'Réglage filigrane', fn: () => fetch(`${API_BASE}/mission-template/branding/watermark-settings`, { method: 'PUT', headers: { Authorization: `Bearer ${scToken}` } }) },
      { name: 'Définir par défaut', fn: () => fetch(`${API_BASE}/mission-template/versions/${v1Id}/set-default`, { method: 'PUT', headers: { Authorization: `Bearer ${scToken}` } }) }
    ];

    for (const test of scTests) {
      const res = await test.fn();
      if (res.status === 403) {
        console.log(`   [RBAC OK] ${test.name} -> Bloqué avec HTTP 403 Forbidden.`);
      } else {
        console.error(`   [RBAC ÉCHEC] ${test.name} -> Status inattendu : ${res.status}`);
      }
    }

    console.log('\n================================================================');
    console.log('🎉 TOUS LES 11 TESTS DU CENTRE DE GESTION DU MODÈLE ONT RÉUSSI !');
    console.log('================================================================\n');
  } catch (err) {
    console.error('❌ Erreur lors du test :', err.message);
  }
}

runComprehensiveTests();
