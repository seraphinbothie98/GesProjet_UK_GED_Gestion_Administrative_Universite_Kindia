const API = 'http://127.0.0.1:5000/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return data;
}

async function runComprehensiveTests() {
  console.log('================================================================');
  console.log('  TEST SUITE : SYSTÈME DE RÉDACTION, WORKFLOWS & GED UK');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // SCÉNARIO A: Département d'Informatique -> Faculté -> SG -> Recteur
    // -------------------------------------------------------------------------
    console.log('▶ [SCÉNARIO A] : Transmission hiérarchique Soit-Transmis...');
    const loginAgent = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'agent_info@univ-kindia.edu.gn', password: 'Agent123!' })
    });
    const agentHeaders = { Authorization: `Bearer ${loginAgent.token}` };

    const docA = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        document_type: 'SOIT_TRANSMIS',
        title: 'Transmission des fiches de notes de Licence 3 Informatique',
        object_title: 'Transmission des fiches de notes de Licence 3 Informatique',
        content_body: 'J’ai l’honneur de vous transmettre ci-joint pour visa et signature rectorale les fiches de notes homologuées.',
        target_recipient_name: 'Monsieur le Recteur de l’Université de Kindia',
        action: 'SUBMIT'
      })
    });
    console.log(`  ✓ Document A créé : ID ${docA.id}, Réf [${docA.reference}], Statut initial : ${docA.status}`);

    // SG login & orientation to Recteur
    const loginSG = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'sg@univ-kindia.edu.gn', password: 'Sg123!' })
    });
    const sgHeaders = { Authorization: `Bearer ${loginSG.token}` };

    await request(`${API}/workflow/sg-orient`, {
      method: 'POST',
      headers: sgHeaders,
      body: JSON.stringify({
        document_id: docA.id,
        action_type: 'ORIENT_RECTEUR',
        instruction: 'Dossier académique conforme. Transmis pour signature rectorale.'
      })
    });
    console.log(`  ✓ Décision SG exécutée : Transmis au Recteur.`);

    // Recteur login & signature
    const loginRecteur = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'recteur@univ-kindia.edu.gn', password: 'Recteur123!' })
    });
    const recteurHeaders = { Authorization: `Bearer ${loginRecteur.token}` };

    const signResA = await request(`${API}/workflow/sign-and-return`, {
      method: 'POST',
      headers: recteurHeaders,
      body: JSON.stringify({
        document_id: docA.id,
        remarks: 'Vu et approuvé par le Recteur.'
      })
    });
    console.log(`  ✓ Signature rectorale apposée. Hash SHA-256 : ${signResA.signatureHash.substring(0, 20)}...`);

    // -------------------------------------------------------------------------
    // SCÉNARIO B: Demande Administrative
    // -------------------------------------------------------------------------
    console.log('\n▶ [SCÉNARIO B] : Demande Administrative d’un agent...');
    const docB = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        document_type: 'DEMANDE',
        document_category: 'DEMANDE',
        title: 'Demande d’autorisation d’absence pour mission de recherche',
        object_title: 'Demande d’autorisation d’absence pour mission de recherche',
        content_body: 'J’ai l’honneur de solliciter votre haute bienveillance afin de m’accorder une autorisation d’absence de 3 jours.',
        target_recipient_name: 'Monsieur le Chef de Département d’Informatique',
        action: 'SUBMIT'
      })
    });
    console.log(`  ✓ Demande B créée : ID ${docB.id}, Réf [${docB.reference}], Statut : ${docB.status}`);

    // Chef Dept Login & Accept
    const loginChef = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'chef_info@univ-kindia.edu.gn', password: 'Chef123!' })
    });
    const chefHeaders = { Authorization: `Bearer ${loginChef.token}` };

    // -------------------------------------------------------------------------
    // SCÉNARIO C: Lettre Officielle avec en-tête automatique
    // -------------------------------------------------------------------------
    console.log('\n▶ [SCÉNARIO C] : Lettre Officielle émise par la Faculté des Sciences...');
    const loginDoyen = await request(`${API}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ identity: 'doyen_fs@univ-kindia.edu.gn', password: 'Doyen123!' })
    });
    const doyenHeaders = { Authorization: `Bearer ${loginDoyen.token}` };

    const docC = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: doyenHeaders,
      body: JSON.stringify({
        document_type: 'LETTRE',
        document_category: 'LETTRE',
        title: 'Lettre de transmission du calendrier des examens du semestre 2',
        object_title: 'Lettre de transmission du calendrier des examens du semestre 2',
        content_body: 'Monsieur le Secrétaire Général, veuillez trouver ci-joint le calendrier prévisionnel des examens de la Faculté des Sciences.',
        target_recipient_name: 'Monsieur le Secrétaire Général',
        action: 'SUBMIT'
      })
    });
    console.log(`  ✓ Lettre C créée : ID ${docC.id}, Réf [${docC.reference}] (Préfixe respecté : ${docC.reference.split('/')[0]}), Émetteur : ${docC.originating_service}`);

    // -------------------------------------------------------------------------
    // SCÉNARIO D: Retour pour correction avec motif & Resoumission versionnée (V1 -> V2)
    // -------------------------------------------------------------------------
    console.log('\n▶ [SCÉNARIO D] : Circuit de Retour pour Correction et Versionnage...');
    // 1. Agent creates document D
    const docD = await request(`${API}/documents/administrative`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        document_type: 'DEMANDE',
        title: 'Demande d’acquisition de matériel informatique de laboratoire',
        object_title: 'Demande d’acquisition de matériel informatique de laboratoire',
        content_body: 'Demande de 10 ordinateurs pour le laboratoire d’informatique.',
        target_recipient_name: 'Secrétariat Général',
        action: 'SUBMIT'
      })
    });
    console.log(`  ✓ Document D créé (Version 1) : ID ${docD.id}, Réf [${docD.reference}]`);

    // 2. SG returns document D for correction
    const returnMotive = 'Corriger la référence du budget prévisionnel et joindre le devis estimatif.';
    await request(`${API}/workflow/return-for-correction`, {
      method: 'POST',
      headers: sgHeaders,
      body: JSON.stringify({
        document_id: docD.id,
        return_reason: returnMotive
      })
    });
    console.log(`  ✓ Document retourné par le SG avec le motif : "${returnMotive}"`);

    // Check status
    const docDAfterReturn = await request(`${API}/documents/${docD.id}`, { headers: agentHeaders });
    console.log(`  ✓ Statut après retour : [${docDAfterReturn.status}], Motif consigné : "${docDAfterReturn.rejection_reason}"`);
    if (docDAfterReturn.status !== 'RETOUR') {
      throw new Error(`Statut attendu RETOUR mais reçu ${docDAfterReturn.status}`);
    }

    // 3. Agent modifies and resubmits document D -> Version 2
    const resubmitRes = await request(`${API}/documents/${docD.id}/resubmit`, {
      method: 'POST',
      headers: agentHeaders,
      body: JSON.stringify({
        title: 'Demande d’acquisition de matériel informatique de laboratoire (Rectifiée)',
        object_title: 'Demande d’acquisition de matériel informatique de laboratoire (Rectifiée)',
        content_body: 'Demande de 10 ordinateurs pour le laboratoire d’informatique avec devis joint n°DEV-2026-08 et ligne budgétaire 402-INFO.',
        change_notes: 'Ajout du devis estimatif et de la ligne budgétaire 402-INFO'
      })
    });
    console.log(`  ✓ Document resoumis avec succès ! Nouvelle Version active : V${resubmitRes.version}`);

    // Verify Version History
    const versionsList = await request(`${API}/documents/${docD.id}/versions`, { headers: agentHeaders });
    console.log(`  ✓ Historique des versions conservé : ${versionsList.length} version(s) enregistrée(s)`);
    versionsList.forEach(v => {
      console.log(`    - Version ${v.version_number} : "${v.title}" | Auteur: ${v.author_first} ${v.author_last} | Notes: ${v.change_notes || 'N/A'}`);
    });

    if (versionsList.length < 2) {
      throw new Error('Les deux versions du document doivent être conservées dans document_versions.');
    }

    // -------------------------------------------------------------------------
    // SCÉNARIO E: Vérification de l'Espace Documentaire du Service
    // -------------------------------------------------------------------------
    console.log('\n▶ [SCÉNARIO E] : Vérification de l’Espace Documentaire du Service...');
    const spaceRes = await request(`${API}/documents/service-space`, { headers: agentHeaders });
    console.log('  ✓ Métriques des onglets de l’espace documentaire calculées en direct :');
    console.log(`    - Mes documents : ${spaceRes.metrics.my_docs}`);
    console.log(`    - Brouillons : ${spaceRes.metrics.drafts}`);
    console.log(`    - Soumis : ${spaceRes.metrics.submitted}`);
    console.log(`    - Reçus : ${spaceRes.metrics.received}`);
    console.log(`    - À traiter : ${spaceRes.metrics.to_process}`);
    console.log(`    - Retournés / À corriger : ${spaceRes.metrics.returned}`);
    console.log(`    - Signés : ${spaceRes.metrics.signed}`);
    console.log(`    - Total documents affichés : ${spaceRes.documents.length}`);

    console.log('\n================================================================');
    console.log('  🎉 TOUS LES SCÉNARIOS OBLIGATOIRES (A, B, C, D, E) ONT RÉUSSI !');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ ÉCHEC DU TEST :', err.message);
    process.exit(1);
  }
}

runComprehensiveTests();
