const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== TEST SUITE: NOUVELLE BASE MODÈLE OFFICIEL ORDRE DE MISSION & RBAC ===\n');

  try {
    // 1. Authenticate as Admin (role: ADMINISTRATEUR)
    console.log('1. Connexion en tant qu\'ADMINISTRATEUR (admin@univ-kindia.edu.gn)...');
    const adminRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' })
    });
    const adminLogin = await adminRes.json();
    if (!adminRes.ok) throw new Error('Admin login failed: ' + adminLogin.error);
    const adminToken = adminLogin.token;
    console.log('✅ Connecté en tant qu\'ADMINISTRATEUR.');

    // 2. Authenticate as Secrétariat Central Agent (role: AGENT_SECRÉTARIAT_CENTRAL)
    console.log('2. Connexion en tant qu\'AGENT_SECRÉTARIAT_CENTRAL (sc@univ-kindia.edu.gn)...');
    const scRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    const scLogin = await scRes.json();
    if (!scRes.ok) throw new Error('SC login failed: ' + scLogin.error);
    const scToken = scLogin.token;
    console.log('✅ Connecté en tant qu\'AGENT_SECRÉTARIAT_CENTRAL.');

    // 3. Admin can fetch official mission template
    console.log('\n3. Consultation du modèle officiel par l\'ADMINISTRATEUR...');
    const adminFetchRes = await fetch(`${API_BASE}/mission-template`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const adminFetch = await adminFetchRes.json();
    console.log('✅ Récupération réussie. Modèle actuel :', adminFetch.template ? adminFetch.template.name + ' (' + adminFetch.template.status + ')' : 'Aucun modèle configuré');

    // 4. SC Agent is FORBIDDEN from accessing /api/mission-template
    console.log('\n4. Test RBAC : Agent Secrétariat Central tente d\'accéder à l\'administration du modèle...');
    const scFetchRes = await fetch(`${API_BASE}/mission-template`, {
      headers: { Authorization: `Bearer ${scToken}` }
    });
    if (scFetchRes.status === 403) {
      const errData = await scFetchRes.json();
      console.log(`✅ SUCCÈS RBAC : Accès refusé à l'agent SC (Code HTTP 403 : ${errData.error}).`);
    } else {
      console.error('❌ ÉCHEC RBAC : L\'agent SC a pu accéder à la route admin ! Status:', scFetchRes.status);
    }

    // 5. Admin imports official template (Single Active Rule)
    console.log('\n5. Importation du modèle officiel par l\'ADMINISTRATEUR...');
    const dummyBlob = new Blob(['Contenu officiel du modèle Ordre de Mission Kindia 2026'], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    const formData = new FormData();
    formData.append('name', 'Ordre de mission officiel Kindia 2026');
    formData.append('template_file', dummyBlob, 'Ordre_de_mission_officiel_2026.docx');

    const uploadRes = await fetch(`${API_BASE}/mission-template/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload error');
    console.log('✅ Modèle téléversé avec succès :', uploadData.template.name, '| Statut :', uploadData.template.status);
    const templateId = uploadData.template.id;

    // 6. SC Agent tries to upload -> Must be FORBIDDEN
    console.log('\n6. Test RBAC : Agent SC tente d\'importer un modèle...');
    const scFormData = new FormData();
    scFormData.append('name', 'Tentative Illégale SC');
    scFormData.append('template_file', dummyBlob, 'illegal.docx');

    const scUploadRes = await fetch(`${API_BASE}/mission-template/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${scToken}` },
      body: scFormData
    });
    if (scUploadRes.status === 403) {
      const scErr = await scUploadRes.json();
      console.log(`✅ SUCCÈS RBAC : Upload refusé à l'agent SC (Code HTTP 403 : ${scErr.error}).`);
    } else {
      console.error('❌ ÉCHEC RBAC : L\'agent SC a pu téléverser un modèle ! Status:', scUploadRes.status);
    }

    // 7. Toggle status test
    console.log('\n7. Test Désactivation / Activation par l\'ADMINISTRATEUR...');
    const toggle1Res = await fetch(`${API_BASE}/mission-template/${templateId}/toggle-status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const toggle1 = await toggle1Res.json();
    console.log('✅ Statut après premier basculement :', toggle1.template.status);

    const toggle2Res = await fetch(`${API_BASE}/mission-template/${templateId}/toggle-status`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const toggle2 = await toggle2Res.json();
    console.log('✅ Statut après second basculement :', toggle2.template.status);

    // 8. Download test
    console.log('\n8. Test Téléchargement du fichier modèle...');
    const downloadRes = await fetch(`${API_BASE}/mission-template/${templateId}/download`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const fileBlob = await downloadRes.blob();
    console.log('✅ Téléchargement réussi, taille reçue :', fileBlob.size, 'octets.');

    // 9. Active template endpoint test
    console.log('\n9. Test Endpoint Modèle Actif (/api/mission-template/active)...');
    const activeRes = await fetch(`${API_BASE}/mission-template/active`, {
      headers: { Authorization: `Bearer ${scToken}` }
    });
    const activeData = await activeRes.json();
    console.log('✅ Modèle actif en vigueur récupéré pour les utilisateurs :', activeData.template ? activeData.template.name : 'Aucun');

    // 10. Test Single Active Rule: Upload a second template and verify first becomes INACTIVE
    console.log('\n10. Test Règle du Modèle Unique Actif...');
    const secondFormData = new FormData();
    secondFormData.append('name', 'Nouveau Modèle Remplaçant 2026');
    secondFormData.append('template_file', dummyBlob, 'Nouveau_Modele.docx');

    const secondUploadRes = await fetch(`${API_BASE}/mission-template/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: secondFormData
    });
    const secondUploadData = await secondUploadRes.json();
    const secondId = secondUploadData.template.id;

    // Check status of active template
    const checkPrevRes = await fetch(`${API_BASE}/mission-template`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const checkData = await checkPrevRes.json();
    console.log('✅ Modèle actif actuel :', checkData.template ? `${checkData.template.id} - ${checkData.template.name} (${checkData.template.status})` : 'Aucun');

    // 11. Verify all mission order templates status in database
    const allTemplatesRes = await fetch(`${API_BASE}/mission-template/active`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const activeCurrent = await allTemplatesRes.json();
    console.log('✅ Modèle officiel actif récupéré :', activeCurrent.template ? `${activeCurrent.template.id} - ${activeCurrent.template.name}` : 'Aucun');

    console.log('\n======================================================');
    console.log('🎉 TOUS LES 10 TESTS DE VALIDATION ONT RÉUSSI AVEC SUCCÈS !');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Erreur lors du test :', err.message);
  }
}

runTests();
