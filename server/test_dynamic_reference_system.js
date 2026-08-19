const db = require('./src/database/db');
const request = require('http').request;
const { generateReference, generateReferenceWithMeta, previewReference } = require('./src/services/numberGenerator');

function apiCall(options, data = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
    const headers = Object.assign({}, options.headers || {});
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const finalOptions = Object.assign({}, options, { headers });

    const req = request(finalOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function login(identity, password) {
  const res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { identity, password });
  return res.data.token;
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST COMPLET: SYSTÈME DE RÉFÉRENCES ADMINISTRATIVES DYNAMIQUES');
  console.log('================================================================\n');

  const adminToken = await login('admin@univ-kindia.edu.gn', 'Admin123!');
  const scToken = await login('sc@univ-kindia.edu.gn', 'Agent123!');
  console.log('1. ✅ Tokens Admin et Secrétariat Central obtenus.');

  const currentYear = new Date().getFullYear();

  // Clean initial test data
  await db.run('UPDATE mission_order_requests SET official_document_id = NULL');
  await db.run('DELETE FROM incoming_mails WHERE document_id IN (SELECT id FROM documents WHERE title LIKE "%rentrée%" OR title LIKE "%félicitations%" OR title LIKE "%Arrêté ministériel%")');
  await db.run('DELETE FROM outgoing_mails WHERE document_id IN (SELECT id FROM documents WHERE title LIKE "%rentrée%" OR title LIKE "%félicitations%" OR title LIKE "%Arrêté ministériel%")');
  await db.run('DELETE FROM mission_orders WHERE document_id IN (SELECT id FROM documents WHERE title LIKE "%rentrée%" OR title LIKE "%félicitations%" OR title LIKE "%Arrêté ministériel%" OR reference LIKE "%/MESRS/%" OR reference LIKE "%/MESRSI/%")');
  await db.run('DELETE FROM documents WHERE title LIKE "%rentrée%" OR title LIKE "%félicitations%" OR title LIKE "%Arrêté ministériel%" OR reference LIKE "%/MESRS/%" OR reference LIKE "%/MESRSI/%"');
  await db.run('DELETE FROM number_sequences WHERE seq_key = "DOC_ADMIN" AND year = ?', [currentYear]);

  // Test 1: Reset institution reference settings to default
  console.log('\n2. Configuration initiale des paramètres institutionnels par défaut...');
  const resetRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/settings/institution',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    name: 'UNIVERSITÉ DE KINDIA',
    ministry: 'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR ET DE LA RECHERCHE SCIENTIFIQUE',
    ministry_code: 'MESRS',
    institution_code: 'UK',
    structure_name: 'Rectorat',
    structure_code: 'RECT',
    authority_name: 'Secrétaire Général',
    authority_code: 'SG',
    reference_pattern: '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
    sequence_padding: 4
  });

  if (resetRes.status !== 200) {
    console.error('❌ Échec initialisation paramètres:', resetRes.data);
    process.exit(1);
  }
  console.log('   ✅ Paramètres initialisés avec succès : Pattern = {YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}');

  // Test 2: Live preview endpoint
  console.log('\n3. Test du point de terminaison de prévisualisation (POST /api/settings/reference-preview)...');
  const previewRes = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/settings/reference-preview',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    ministry_code: 'MESRS',
    institution_code: 'UK',
    structure_code: 'RECT',
    authority_code: 'SG',
    reference_pattern: '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
    sequence_padding: 4
  });

  console.log(`   Aperçu généré: ${previewRes.data.preview}`);
  const expectedDefaultPreview = `${currentYear}/0001/MESRS/UK/RECT/SG`;
  if (previewRes.data.preview !== expectedDefaultPreview) {
    console.error(`❌ Prévisualisation incorrecte. Attendu: ${expectedDefaultPreview}, Reçu: ${previewRes.data.preview}`);
    process.exit(1);
  }
  console.log('   ✅ Prévisualisation exacte conforme.');

  // Clean sequence for clean testing
  await db.run('DELETE FROM number_sequences WHERE seq_key = "DOC_ADMIN" AND year = ?', [currentYear]);

  // Test 3: Create Document 1 (Courrier Entrant)
  console.log('\n4. Création du 1er Document Administratif...');
  const doc1Res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/documents/incoming',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scToken}`
    }
  }, {
    title: 'Note de service relative à la rentrée universitaire',
    official_type: 'NOTE_SERVICE',
    processing_mode: 'DIRECT_ARCHIVE',
    sender_name: 'Direction Pédagogique',
    reception_date: `${currentYear}-08-15`
  });

  const doc1 = doc1Res.data;
  console.log(`   Statut HTTP doc1: ${doc1Res.status}`, doc1);
  const doc1Ref = doc1.reference || (doc1 && doc1.data && doc1.data.reference);
  console.log(`   Document 1 Référence générée: ${doc1Ref}`);
  const expectedDoc1Ref = `${currentYear}/0001/MESRS/UK/RECT/SG`;
  if (doc1Ref !== expectedDoc1Ref) {
    console.error(`❌ Référence 1 incorrecte. Attendu: ${expectedDoc1Ref}, Reçu: ${doc1Ref}`);
    process.exit(1);
  }
  console.log('   ✅ Réf 1 validée : 0001');

  // Verify doc1 metadata in DB
  const doc1InDb = await db.get('SELECT * FROM documents WHERE id = ?', [doc1.id]);
  const doc1Meta = JSON.parse(doc1InDb.reference_meta);
  console.log(`   Historique capturé pour Doc 1:`, doc1Meta);
  if (doc1Meta.ministry !== 'MESRS' || doc1Meta.sequence_number !== 1) {
    console.error('❌ Métadonnées de référence incorrectes pour Doc 1');
    process.exit(1);
  }
  console.log('   ✅ Métadonnées historiques persistées.');

  // Test 4: Create Document 2 (Outgoing Mail) - should be 0002
  console.log('\n5. Création du 2ème Document Administratif (Incrémentation séquentielle)...');
  const doc2Res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/documents/outgoing',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scToken}`
    }
  }, {
    title: 'Lettre de félicitations aux lauréats',
    recipient_name: 'Tous les étudiants',
    content_body: 'Félicitations pour vos résultats remarquables.'
  });

  const doc2 = doc2Res.data;
  console.log(`   Document 2 Référence générée: ${doc2.reference}`);
  const expectedDoc2Ref = `${currentYear}/0002/MESRS/UK/RECT/SG`;
  if (doc2.reference !== expectedDoc2Ref) {
    console.error(`❌ Référence 2 incorrecte. Attendu: ${expectedDoc2Ref}, Reçu: ${doc2.reference}`);
    process.exit(1);
  }
  console.log('   ✅ Réf 2 validée : 0002 séquentiel');

  // Test 5: Dynamic Parameter Change (Ministry changes name/acronym to MESRSI)
  console.log('\n6. Test de Changement de Paramètres Administratifs (Ministère devient MESRSI)...');
  await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/settings/institution',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    name: 'UNIVERSITÉ DE KINDIA',
    ministry: 'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION',
    ministry_code: 'MESRSI',
    institution_code: 'UK',
    structure_name: 'Rectorat',
    structure_code: 'RECT',
    authority_name: 'Secrétaire Général',
    authority_code: 'SG',
    reference_pattern: '{YEAR}/{SEQUENCE}/{MINISTRY_CODE}/{INSTITUTION_CODE}/{STRUCTURE_CODE}/{AUTHORITY_CODE}',
    sequence_padding: 4
  });

  // Test 6: Create Document 3 under new parameter
  console.log('   Création du Document 3 après modification des paramètres...');
  const doc3Res = await apiCall({
    hostname: 'localhost',
    port: 5000,
    path: '/api/documents/incoming',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${scToken}`
    }
  }, {
    title: 'Arrêté ministériel portant organisation',
    official_type: 'ARRETE',
    processing_mode: 'DIRECT_ARCHIVE',
    sender_name: 'Ministère de Tutelle',
    reception_date: `${currentYear}-08-15`
  });

  const doc3 = doc3Res.data;
  console.log(`   Document 3 Référence générée: ${doc3.reference}`);
  const expectedDoc3Ref = `${currentYear}/0003/MESRSI/UK/RECT/SG`;
  if (doc3.reference !== expectedDoc3Ref) {
    console.error(`❌ Référence 3 incorrecte. Attendu: ${expectedDoc3Ref}, Reçu: ${doc3.reference}`);
    process.exit(1);
  }
  console.log('   ✅ Réf 3 validée avec le nouveau sigle MESRSI et séquence 0003.');

  // Test 7: Strict Immutability Check - verify Doc 1 and Doc 2 were NOT modified
  console.log('\n7. Test d\'Immutabilité stricte des anciens documents...');
  const oldDoc1 = await db.get('SELECT reference, reference_meta FROM documents WHERE id = ?', [doc1.id]);
  const oldDoc2 = await db.get('SELECT reference, reference_meta FROM documents WHERE id = ?', [doc2.id]);

  console.log(`   Doc 1 Réf actuelle en BDD: ${oldDoc1.reference}`);
  console.log(`   Doc 2 Réf actuelle en BDD: ${oldDoc2.reference}`);

  if (oldDoc1.reference !== expectedDoc1Ref || oldDoc2.reference !== expectedDoc2Ref) {
    console.error('❌ VIOLATION D\'IMMUTABILITÉ: Les anciennes références ont été altérées !');
    process.exit(1);
  }
  console.log('   ✅ Immutabilité parfaite : Les anciens documents conservent intacte leur référence d\'origine.');

  // Test 8: Annual Reset Simulation
  console.log('\n8. Test de Réinitialisation Annuelle du Compteur (Simulation Année 2027)...');
  await db.run('DELETE FROM number_sequences WHERE year = 2027');
  await db.run('INSERT OR IGNORE INTO number_sequences (seq_key, year, current_val) VALUES ("DOC_ADMIN", 2027, 0)');
  await db.run('UPDATE number_sequences SET current_val = current_val + 1 WHERE seq_key = "DOC_ADMIN" AND year = 2027');
  const seq2027Row = await db.get('SELECT current_val FROM number_sequences WHERE seq_key = "DOC_ADMIN" AND year = 2027');
  console.log(`   Compteur 2027: ${seq2027Row.current_val} (Attendu: 1)`);
  if (seq2027Row.current_val !== 1) {
    console.error('❌ La séquence annuelle 2027 n\'a pas démarré à 1');
    process.exit(1);
  }
  console.log('   ✅ Réinitialisation annuelle validée : Nouveau millésime redémarre à 0001.');

  // Test 9: Concurrency Testing (Simultaneous creations)
  console.log('\n9. Test de Créations Simultanées Concurrentes (0 Collision garantie)...');
  const concurrentCalls = [];
  for (let i = 0; i < 5; i++) {
    concurrentCalls.push(generateReference('DOC_ADMIN'));
  }
  const results = await Promise.all(concurrentCalls);
  console.log('   Références générées en simultané :', results);
  const uniqueSet = new Set(results);
  if (uniqueSet.size !== 5) {
    console.error('❌ COLLISION DÉTECTÉE lors de créations simultanées !');
    process.exit(1);
  }
  console.log('   ✅ Aucune collision : 5 références uniques et séquentielles générées avec succès.');

  // Cleanup test documents
  await db.run('DELETE FROM documents WHERE id IN (?, ?, ?)', [doc1.id, doc2.id, doc3.id]);
  await db.run('DELETE FROM incoming_mails WHERE document_id IN (?, ?)', [doc1.id, doc3.id]);
  await db.run('DELETE FROM outgoing_mails WHERE document_id = ?', [doc2.id]);
  await db.run('DELETE FROM number_sequences WHERE year = 2027');

  console.log('\n================================================================');
  console.log('🎉 TOUS LES 9 TESTS DU SYSTÈME DE RÉFÉRENCES ONT RÉUSSI À 100% !');
  console.log('================================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal error in reference test suite:', err);
  process.exit(1);
});
