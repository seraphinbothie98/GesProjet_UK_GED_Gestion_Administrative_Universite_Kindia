const fs = require('fs');
const path = require('path');
const http = require('http');

async function runTeacherMissionTests() {
  console.log('================================================================================');
  console.log(' UK-GED — TEST DE DEMANDE D’ORDRE DE MISSION (ENSEIGNANTS & STAFFS)');
  console.log('================================================================================\n');

  const API_BASE = 'http://localhost:5000/api';

  // 1. Login as Enseignant-Chercheur (Dr. Alpha Diallo - ec1@univ-kindia.edu.gn)
  const ecLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'ec1@univ-kindia.edu.gn', password: 'Ec123!' })
  });
  const ecLoginData = await ecLoginRes.json();
  if (!ecLoginRes.ok) {
    console.error('❌ ÉCHEC LOGIN ENSEIGNANT :', ecLoginData);
    process.exit(1);
  }
  const ecToken = ecLoginData.token;
  console.log('1. Authentification Enseignant-Chercheur (Dr. Alpha Diallo) réussie.');
  console.log('   Catégorie :', ecLoginData.user.personnel_category, '| Structure :', ecLoginData.user.academic_structure);

  // 2. Submit Mission Request as Enseignant-Chercheur (No Administrative Service required)
  const ecReqRes = await fetch(`${API_BASE}/missions/request`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ecToken}` 
    },
    body: JSON.stringify({
      missionary_name: 'Dr. Alpha Diallo',
      function_title: 'Maître de Conférences / Enseignant-Chercheur',
      personnel_category: 'ENSEIGNANT_CHERCHEUR',
      faculty_dept: 'Faculté des Sciences - Département d\'Informatique',
      destination: 'Conakry (Ministère & MESRSI)',
      object_of_mission: 'Présentation des travaux de recherche sur les réseaux de capteurs',
      transport_mode: 'Transport commun / Terrestre',
      departure_date: '2026-09-01',
      return_date: '2026-09-05',
      observations: 'Demande soumise sans service administratif de rattachement'
    })
  });
  const ecReqData = await ecReqRes.json();
  if (!ecReqRes.ok || !ecReqData.id) {
    console.error('❌ ÉCHEC DEMANDE ENSEIGNANT :', ecReqData);
    process.exit(1);
  }
  console.log('2. Demande d’ordre de mission soumise avec succès (ID:', ecReqData.id, '| Réf:', ecReqData.reference, ').');

  // 3. Login as Secrétariat Central (Mariama Camara - sc@univ-kindia.edu.gn)
  const scLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' })
  });
  const scToken = (await scLoginRes.json()).token;

  // Verify SC receives the demand
  const scMissions = await (await fetch(`${API_BASE}/missions`, {
    headers: { Authorization: `Bearer ${scToken}` }
  })).json();

  const foundEcMission = scMissions.find(m => m.document_id === ecReqData.id);
  if (!foundEcMission) {
    console.error('❌ DEMANDE NON TROUVÉE DANS LA BOÎTE DU SECRÉTARIAT CENTRAL');
    process.exit(1);
  }
  console.log('3. Secrétariat Central a bien reçu la demande (Titre:', foundEcMission.title, '| Statut:', foundEcMission.status, ').');

  // 4. Secrétariat Central routes to Secrétaire Général for signature
  const sgServiceRes = await fetch(`${API_BASE}/workflow/transfer`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scToken}` 
    },
    body: JSON.stringify({
      document_id: ecReqData.id,
      to_service_id: 3, // SG
      action: 'TRANSMIT',
      instruction: 'Soumis pour signature du Secrétaire Général'
    })
  });
  console.log('4. Transmission de la demande au Secrétariat Général effectuée.');

  // 5. Login as Secrétaire Général (sg@univ-kindia.edu.gn) and Sign
  const sgLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' })
  });
  const sgToken = (await sgLoginRes.json()).token;

  const signRes = await fetch(`${API_BASE}/missions/${ecReqData.id}/sign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${sgToken}` }
  });
  const signData = await signRes.json();
  if (!signRes.ok || !signData.success) {
    console.error('❌ ÉCHEC SIGNATURE SG :', signData);
    process.exit(1);
  }
  console.log('5. Secrétaire Général a signé l’ordre de mission. PDF signé généré :', signData.pdf_url);

  // 6. Applicant checks "Mes demandes"
  const myReqsRes = await fetch(`${API_BASE}/missions/my-requests`, {
    headers: { Authorization: `Bearer ${ecToken}` }
  });
  const myReqs = await myReqsRes.json();
  const signedReq = myReqs.find(m => m.document_id === ecReqData.id);
  if (!signedReq || !signedReq.is_signed) {
    console.error('❌ ÉCHEC SUIVI DEMANDEUR :', signedReq);
    process.exit(1);
  }
  console.log('6. L’Enseignant-Chercheur consulte sa demande finalisée et signée (Statut:', signedReq.status, '| PDF:', signedReq.signed_pdf_path, ').');

  console.log('\n================================================================================');
  console.log(' 🎉 SUCCÈS TOTAL : WORKFLOW COMPLET VALIDÉ POUR LES ENSEIGNANTS-CHERCHEURS !');
  console.log('================================================================================\n');
}

runTeacherMissionTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
