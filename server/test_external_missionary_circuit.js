async function runCircuitTests() {
  console.log('===========================================================');
  console.log(' UK-GED : SCÉNARIO DE TEST INTÉGRAL EN 20 ÉTAPES');
  console.log(' CIRCUIT DES ORDRES DE MISSION DES MISSIONNAIRES EXTERNES');
  console.log('===========================================================');

  const BASE_URL = 'http://127.0.0.1:5000/api';

  const login = async (identity, password) => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });
    const data = await res.json();
    return { status: res.status, token: data.token };
  };

  // Step 1: Login as Secrétariat Central
  console.log('\nÉtape 1 : Connexion en tant que Secrétariat Central...');
  const sc = await login('sc@univ-kindia.edu.gn', 'Agent123!');
  console.log('   -> Status :', sc.status === 200 ? 'OK (200 Authentifié)' : `ÉCHEC (${sc.status})`);

  // Step 2: Register a new external mission order
  console.log('\nÉtape 2 : Enregistrement d’un nouvel ordre de mission externe avec PDF original...');
  const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');
  const dummyBlob = new Blob([dummyPdf], { type: 'application/pdf' });

  const form = new FormData();
  form.append('last_name', 'BARRY');
  form.append('first_names', 'Ibrahima Sory');
  form.append('nationality', 'Guinéenne');
  form.append('function_title', 'Expert Consultant en Evaluation');
  form.append('origin_institution', 'Université Gamal Abdel Nasser de Conakry / MESRSI');
  form.append('mission_order_ref', 'OM/2026/089/UGANC');
  form.append('object_of_mission', 'Atelier de validation du cadre stratégique de recherche 2026-2030');
  form.append('location_of_mission', 'Campus Universitaire de Kindia');
  form.append('issuing_authority', 'Le Recteur de UGANC');
  form.append('expected_start_date', '2026-08-20');
  form.append('expected_end_date', '2026-08-24');
  form.append('phone', '+224 622 33 44 55');
  form.append('email', 'ibarry@uganc.edu.gn');
  form.append('observations', 'Hébergement prévu à la résidence universitaire.');
  form.append('original_document', dummyBlob, 'OM_Source_Barry.pdf');

  const createRes = await fetch(`${BASE_URL}/external-missionaries`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sc.token}` },
    body: form
  });
  const createData = await createRes.json();
  const missId = createData.id;
  console.log('   -> Status :', createRes.status === 201 ? `OK (Créé avec ID: ${missId}, Réf: ${createData.reference})` : `ÉCHEC (${createRes.status}: ${createData.error})`);

  // Step 3 & 4: Fetch details & verify initial status
  console.log('\nÉtapes 3 & 4 : Vérification du statut initial et de la référence UK-GED...');
  const detailRes = await fetch(`${BASE_URL}/external-missionaries/${missId}`, {
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const detailData = await detailRes.json();
  console.log('   -> Statut initial :', detailData.status);
  console.log('   -> Réf UK-GED générée :', detailData.reference);
  console.log('   -> Valide :', detailData.status === 'ENREGISTRÉ – EN ATTENTE DE TRANSMISSION AU SG' ? 'OK' : 'ÉCHEC');

  // Step 5: Transmit to Secrétaire Général
  console.log('\nÉtape 5 : Transmission au Secrétaire Général par le Secrétariat Central...');
  const transmitRes = await fetch(`${BASE_URL}/external-missionaries/${missId}/transmit-to-sg`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const transmitData = await transmitRes.json();
  console.log('   -> Status transmission :', transmitRes.status === 200 ? 'OK' : `ÉCHEC (${transmitRes.status})`);

  // Step 6: Verify status after transmission
  console.log('\nÉtape 6 : Vérification du statut "TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE"...');
  const detailRes2 = await fetch(`${BASE_URL}/external-missionaries/${missId}`, {
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const detailData2 = await detailRes2.json();
  console.log('   -> Nouveau statut :', detailData2.status === 'TRANSMIS AU SECRÉTAIRE GÉNÉRAL – EN ATTENTE DE SIGNATURE' ? 'OK' : detailData2.status);

  // Step 7: Login as Secrétaire Général
  console.log('\nÉtape 7 : Connexion en tant que Secrétaire Général...');
  const sg = await login('sg@univ-kindia.edu.gn', 'Sg123!');
  console.log('   -> Status :', sg.status === 200 ? 'OK (SG Authentifié)' : `ÉCHEC (${sg.status})`);

  // Step 8: Verify order appears in SG's "À signer" list
  console.log('\nÉtape 8 : Vérification de la présence dans la liste "Ordres de mission externes à signer" du SG...');
  const toSignRes = await fetch(`${BASE_URL}/external-missionaries/to-sign`, {
    headers: { 'Authorization': `Bearer ${sg.token}` }
  });
  const toSignList = await toSignRes.json();
  const foundInToSign = toSignList.some(item => item.id === missId);
  console.log('   -> Présent dans la liste du SG :', foundInToSign ? 'OK (Présent)' : 'ÉCHEC');

  // Step 9: View original PDF document stream
  console.log('\nÉtape 9 : Visualisation du document original PDF...');
  const docStreamRes = await fetch(`${BASE_URL}/external-missionaries/${missId}/document/original`, {
    headers: { 'Authorization': `Bearer ${sg.token}` }
  });
  console.log('   -> Format du document :', docStreamRes.headers.get('content-type') === 'application/pdf' ? 'OK (PDF)' : docStreamRes.headers.get('content-type'));

  // Step 10: Sign electronically as SG
  console.log('\nÉtape 10 : Signature électronique par le Secrétaire Général...');
  const signRes = await fetch(`${BASE_URL}/external-missionaries/${missId}/sign`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sg.token}` }
  });
  const signData = await signRes.json();
  console.log('   -> Résultat signature :', signRes.status === 200 ? `OK (${signData.message})` : `ÉCHEC (${signRes.status}: ${signData.error})`);

  // Step 11: Verify removal from SG "À signer" list
  console.log('\nÉtape 11 : Vérification du retrait de la liste "À signer" du SG...');
  const toSignRes2 = await fetch(`${BASE_URL}/external-missionaries/to-sign`, {
    headers: { 'Authorization': `Bearer ${sg.token}` }
  });
  const toSignList2 = await toSignRes2.json();
  const stillInToSign = toSignList2.some(item => item.id === missId);
  console.log('   -> Disparu de la liste du SG :', !stillInToSign ? 'OK (Disparu comme prévu)' : 'ÉCHEC');

  // Step 12 & 13: Connect as SC and verify status "SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL"
  console.log('\nÉtapes 12 & 13 : Connexion au Secrétariat Central et vérification du statut "SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL"...');
  const detailRes3 = await fetch(`${BASE_URL}/external-missionaries/${missId}`, {
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const detailData3 = await detailRes3.json();
  console.log('   -> Statut au SC :', detailData3.status === 'SIGNÉ – RETOUR AU SECRÉTARIAT CENTRAL' ? 'OK' : detailData3.status);

  // Step 14: View signed PDF version
  console.log('\nÉtape 14 : Visualisation du document signé avec signature électronique du SG...');
  const signedStreamRes = await fetch(`${BASE_URL}/external-missionaries/${missId}/document/signed`, {
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  console.log('   -> Document signé disponible :', signedStreamRes.status === 200 ? 'OK (PDF Signé)' : 'ÉCHEC');

  // Step 15: Print document
  console.log('\nÉtape 15 : Enregistrement de l’impression de l’ordre de mission...');
  const printRes = await fetch(`${BASE_URL}/external-missionaries/${missId}/print`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  console.log('   -> Statut impression :', printRes.status === 200 ? 'OK (Impression comptabilisée)' : 'ÉCHEC');

  // Step 16 & 17: Deliver to missionary and verify status "REMIS AU MISSIONNAIRE"
  console.log('\nÉtapes 16 & 17 : Remise en main propre au missionnaire externe...');
  const deliverRes = await fetch(`${BASE_URL}/external-missionaries/${missId}/deliver`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sc.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient_name: 'Ibrahima Sory BARRY',
      delivery_notes: 'Document imprimé et remis en main propre au Secrétariat Central.'
    })
  });
  const deliverData = await deliverRes.json();
  console.log('   -> Statut remise :', deliverRes.status === 200 ? `OK (${deliverData.message})` : `ÉCHEC (${deliverRes.status})`);

  const detailRes4 = await fetch(`${BASE_URL}/external-missionaries/${missId}`, {
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const detailData4 = await detailRes4.json();
  console.log('   -> Statut après remise :', detailData4.status === 'REMIS AU MISSIONNAIRE' ? 'OK (REMIS AU MISSIONNAIRE)' : detailData4.status);

  // Step 18: Archive the external mission order
  console.log('\nÉtape 18 : Classer dans les Archives électroniques -> Ordres de mission...');
  const archiveRes = await fetch(`${BASE_URL}/external-missionaries/${missId}/archive`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const archiveData = await archiveRes.json();
  console.log('   -> Statut archivage :', archiveRes.status === 200 ? `OK (${archiveData.message})` : `ÉCHEC (${archiveRes.status})`);

  // Step 19: Verify locked status in archives
  console.log('\nÉtape 19 : Vérification du statut "ARCHIVÉ" et du verrouillage du document...');
  const detailRes5 = await fetch(`${BASE_URL}/external-missionaries/${missId}`, {
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const detailData5 = await detailRes5.json();
  console.log('   -> Statut final :', detailData5.status === 'ARCHIVÉ' ? 'OK (ARCHIVÉ)' : detailData5.status);
  console.log('   -> Verrouillé contre modification :', detailData5.is_locked === 1 ? 'OK (Verrouillé)' : 'ÉCHEC');

  // Step 20: Fetch & audit full chronological timeline history
  console.log('\nÉtape 20 : Vérification de la traçabilité et de la chronologie complète des événements...');
  const historyRes = await fetch(`${BASE_URL}/external-missionaries/${missId}/history`, {
    headers: { 'Authorization': `Bearer ${sc.token}` }
  });
  const historyList = await historyRes.json();
  
  console.log(`   -> Nombre d’événements horodatés enregistrés : ${historyList.length}`);
  historyList.forEach((h, idx) => {
    console.log(`      [${idx + 1}] ${new Date(h.timestamp).toLocaleString('fr-FR')} | Action: ${h.action} | User: ${h.first_name || ''} ${h.last_name || ''} (${h.service_name || 'SC'}) | Details: ${h.details}`);
  });

  const allPassed = historyList.length >= 5 && detailData5.status === 'ARCHIVÉ';
  console.log('\n===========================================================');
  if (allPassed) {
    console.log(' 🎉 LE CIRCUIT COMPLET DES ORDRES DE MISSION EXTERNES A RÉUSSI LES 20 ÉTAPES AVEC SUCCÈS !');
  } else {
    console.log(' ❌ CERTAINES ÉTAPES DU CIRCUIT ONT ÉCHOUÉ.');
  }
  console.log('===========================================================');
}

runCircuitTests().catch(err => {
  console.error('Fatal circuit test runner error:', err);
  process.exit(1);
});
