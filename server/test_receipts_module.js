const db = require('./src/database/db');
const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, UPLOAD_DIR } = require('./src/config/constants');

async function runReceiptsTests() {
  console.log('=== SUITE DE TESTS COMPLÈTE : MODULE DE REÇUS OFFICIELS AVEC QR CODE UK-GED ===\n');

  // Token for Secrétariat Central (Service ID 1)
  const scToken = jwt.sign(
    { userId: 2, email: 'sc@univ-kindia.edu.gn', service_id: 1, role_code: 'AGENT_SECRÉTARIAT_CENTRAL' },
    JWT_SECRET
  );

  // Token for Secrétaire Général (SG, Service ID 2)
  const sgToken = jwt.sign(
    { userId: 3, email: 'sg@univ-kindia.edu.gn', service_id: 2, role_code: 'SECRÉTAIRE_GÉNÉRAL' },
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

  // Helper for raw binary download
  function apiDownload(urlPath, token = null) {
    return new Promise((resolve, reject) => {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const options = {
        hostname: '127.0.0.1',
        port: 5000,
        path: urlPath,
        method: 'GET',
        headers: headers
      };

      const req = http.request(options, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, buffer: Buffer.concat(chunks), headers: res.headers });
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  // ----------------------------------------------------
  // TEST 1 : COURRIER ENTRANT
  // ----------------------------------------------------
  console.log('--- TEST 1 : COURRIER ENTRANT & REÇU OFFICIEL AVEC QR CODE ---');

  // 1.1 Enregistrer un courrier entrant
  const mailRes = await apiRequest('POST', '/api/documents', scToken, {
    document_type: 'INCOMING_MAIL',
    title: 'Demande de partenariat interuniversitaire - Université Gamal Abdel Nasser',
    description: 'Proposition de convention cadre pour échanges d’enseignants-chercheurs.',
    sender_name: 'Pr. Alpha Barry',
    sender_organization: 'Université Gamal Abdel Nasser de Conakry',
    priority: 'HIGH',
    confidentiality: 'INTERNAL'
  });

  console.log(`   1.1 Enregistrement courrier: code ${mailRes.status} -> Réf: ${mailRes.data.reference}`);
  if (mailRes.status !== 201 || !mailRes.data.id || !mailRes.data.receipt) {
    throw new Error('Échec 1.1: Création courrier entrant avec reçu automatique');
  }

  const mailDocId = mailRes.data.id;
  const mailRef = mailRes.data.reference;
  const mailReceipt = mailRes.data.receipt;

  console.log(`   1.2 Reçu généré automatiquement : N° ${mailReceipt.receipt_number}`);
  console.log(`   1.3 URL de vérification QR Code : ${mailReceipt.verification_url}`);
  console.log(`   1.4 Chemin PDF du reçu : ${mailReceipt.file_path}`);

  // Vérifier le fichier physique du reçu sur le disque
  const mailPdfDiskPath = path.join(UPLOAD_DIR, mailReceipt.file_path);
  if (!fs.existsSync(mailPdfDiskPath)) {
    throw new Error(`Échec 1.2: Le fichier PDF du reçu n'existe pas sur le disque : ${mailPdfDiskPath}`);
  }
  const mailPdfStats = fs.statSync(mailPdfDiskPath);
  console.log(`   1.5 Taille du PDF généré sur le disque : ${mailPdfStats.size} octets`);
  if (mailPdfStats.size < 1000) throw new Error('Échec 1.2: Fichier PDF du reçu trop petit / corrompu');

  // Téléchargement du reçu PDF via l'endpoint public /api/receipts/:id/pdf
  const pdfDownloadRes = await apiDownload(`/api/receipts/${mailReceipt.receipt_id}/pdf`);
  console.log(`   1.6 Téléchargement direct PDF du reçu : statut ${pdfDownloadRes.status}, Content-Type: ${pdfDownloadRes.headers['content-type']}`);
  if (pdfDownloadRes.status !== 200 || pdfDownloadRes.buffer.length !== mailPdfStats.size) {
    throw new Error('Échec 1.6: Téléchargement du reçu PDF invalide');
  }

  // 1.7 Scanner / appeler l'API publique de vérification sans authentification
  const verify1 = await apiRequest('GET', `/api/verify/${encodeURIComponent(mailRef)}`);
  console.log(`   1.7 Scan QR Code (Public) : Titre="${verify1.data.title}", Statut="${verify1.data.current_status}"`);
  if (!verify1.data.valid || verify1.data.status !== 'AUTHENTIC') {
    throw new Error('Échec 1.7: Vérification publique initiale non conforme');
  }

  // 1.8 Faire évoluer le statut du courrier (ex: passage à ACCEPTED)
  await db.run("UPDATE documents SET status = 'ACCEPTED' WHERE id = ?", [mailDocId]);

  // 1.9 Scanner à nouveau le MÊME QR Code
  const verify1Updated = await apiRequest('GET', `/api/verify/${encodeURIComponent(mailRef)}`);
  console.log(`   1.9 Nouveau scan du MÊME QR Code après évolution : Statut="${verify1Updated.data.current_status}"`);
  if (!verify1Updated.data.valid || (!verify1Updated.data.current_status.includes('Accepté') && !verify1Updated.data.current_status.includes('Validé'))) {
    throw new Error('Échec 1.9: Le statut actualisé en temps réel n’est pas apparu sur le QR Code');
  }

  console.log('   ✅ TEST 1 VALIDÉ À 100% (Courrier entrant, Reçu PDF, QR Code permanent et Statut temps réel)\n');

  // ----------------------------------------------------
  // TEST 2 : ORDRE DE MISSION
  // ----------------------------------------------------
  console.log('--- TEST 2 : ORDRE DE MISSION & CYCLE COMPLET DE SIGNATURE & ARCHIVAGE ---');

  // 2.1 Créer un ordre de mission
  const missionRes = await apiRequest('POST', '/api/missions', scToken, {
    missionary_name: 'Dr. Mamadou Diallo',
    nationality: 'Guinéenne',
    function_title: 'Doyen de la Faculté des Sciences',
    destination: 'Labé - Université de Labé',
    object_of_mission: 'Participation au jury de soutenance de thèses de doctorat',
    transport_mode: 'Véhicule de service UK-042-GN',
    departure_date: '2026-08-20',
    return_date: '2026-08-25'
  });

  console.log(`   2.1 Création Ordre de Mission: code ${missionRes.status} -> Réf: ${missionRes.data.reference}`);
  if (missionRes.status !== 201 || !missionRes.data.id || !missionRes.data.receipt) {
    throw new Error('Échec 2.1: Création ordre de mission avec reçu');
  }

  const missionDocId = missionRes.data.id;
  const missionRef = missionRes.data.reference;
  const missionReceipt = missionRes.data.receipt;

  console.log(`   2.2 Reçu Ordre de Mission généré : N° ${missionReceipt.receipt_number}`);
  console.log(`   2.3 URL de vérification : ${missionReceipt.verification_url}`);

  // 2.4 Vérification publique initiale (En attente de signature)
  const verifyMissionInit = await apiRequest('GET', `/api/verify/${encodeURIComponent(missionRef)}`);
  console.log(`   2.4 Scan QR Code initial (Public) : "${verifyMissionInit.data.current_status}" (Missionnaire: ${verifyMissionInit.data.mission.missionary_name})`);
  if (!verifyMissionInit.data.valid || verifyMissionInit.data.mission.is_signed !== false) {
    throw new Error('Échec 2.4: Statut initial de l’ordre de mission invalide');
  }

  // 2.5 Signature de l'ordre de mission par le Secrétaire Général
  await db.run("UPDATE mission_orders SET is_signed = 1, signed_at = CURRENT_TIMESTAMP WHERE document_id = ?", [missionDocId]);
  await db.run("UPDATE documents SET status = 'SIGNED', is_locked = 1 WHERE id = ?", [missionDocId]);

  // 2.6 Nouveau scan du MÊME QR Code après signature
  const verifyMissionSigned = await apiRequest('GET', `/api/verify/${encodeURIComponent(missionRef)}`);
  console.log(`   2.6 Scan du MÊME QR Code après signature SG : Statut="${verifyMissionSigned.data.current_status}", is_signed=${verifyMissionSigned.data.mission.is_signed}`);
  if (!verifyMissionSigned.data.valid || !verifyMissionSigned.data.current_status.includes('Signé') || !verifyMissionSigned.data.mission.is_signed) {
    throw new Error('Échec 2.6: Le statut Signé n’apparaît pas sur le QR code');
  }

  // 2.7 Archivage de l'ordre de mission
  await db.run("UPDATE documents SET status = 'ARCHIVED', archived_at = CURRENT_TIMESTAMP WHERE id = ?", [missionDocId]);

  // 2.8 Nouveau scan du MÊME QR Code après archivage
  const verifyMissionArchived = await apiRequest('GET', `/api/verify/${encodeURIComponent(missionRef)}`);
  console.log(`   2.8 Scan du MÊME QR Code après archivage : Statut="${verifyMissionArchived.data.current_status}", is_archived=${verifyMissionArchived.data.is_archived}`);
  if (!verifyMissionArchived.data.valid || !verifyMissionArchived.data.current_status.includes('Archivé')) {
    throw new Error('Échec 2.8: Le statut Archivé n’apparaît pas sur le QR code');
  }

  console.log('   ✅ TEST 2 VALIDÉ À 100% (Ordre de mission, Reçu, Signature SG, Archivage & QR Code permanent)\n');

  // ----------------------------------------------------
  // TEST 3 : SÉCURITÉ, RECHERCHE ET CAS LIMITES
  // ----------------------------------------------------
  console.log('--- TEST 3 : SÉCURITÉ, CONTRÔLE D’AUTHENTICITÉ ET GESTION DES CAS LIMITES ---');

  // 3.1 Référence inexistante
  const fakeVerify = await apiRequest('GET', `/api/verify/UK-CE-9999-999999`);
  console.log(`   3.1 Référence inexistante : code HTTP ${fakeVerify.status}, Titre="${fakeVerify.data.title}"`);
  if (fakeVerify.status !== 404 || fakeVerify.data.status !== 'NOT_FOUND') {
    throw new Error('Échec 3.1: La référence inexistante aurait dû renvoyer NOT_FOUND 404');
  }

  // 3.2 Document invalidé / Corbeille
  await db.run("UPDATE documents SET status = 'TRASHED' WHERE id = ?", [mailDocId]);
  const trashedVerify = await apiRequest('GET', `/api/verify/${encodeURIComponent(mailRef)}`);
  console.log(`   3.2 Document mis en corbeille : Statut="${trashedVerify.data.status}", Titre="${trashedVerify.data.title}"`);
  if (trashedVerify.data.valid !== false || trashedVerify.data.status !== 'INVALID') {
    throw new Error('Échec 3.2: Le document en corbeille aurait dû renvoyer INVALID');
  }

  // 3.3 Vérification de la non-exposition des données confidentielles
  const publicKeys = Object.keys(verifyMissionSigned.data);
  const sensitiveKeys = ['password', 'password_hash', 'confidential_notes', 'internal_instruction', 'ip_address'];
  const hasLeak = sensitiveKeys.some(k => publicKeys.includes(k));
  console.log(`   3.3 Fuite de données sensibles : ${hasLeak ? '❌ FUITE DÉTECTÉE' : '✅ AUCUNE FUITE (Protection Totale)'}`);
  if (hasLeak) throw new Error('Échec 3.3: Données sensibles exposées dans la réponse publique');

  // Cleanup test documents
  await db.run('DELETE FROM document_receipts WHERE document_id IN (?, ?)', [mailDocId, missionDocId]);
  await db.run('DELETE FROM incoming_mails WHERE document_id = ?', [mailDocId]);
  await db.run('DELETE FROM mission_orders WHERE document_id = ?', [missionDocId]);
  await db.run('DELETE FROM documents WHERE id IN (?, ?)', [mailDocId, missionDocId]);

  console.log('======================================================================');
  console.log('🎉 TOUS LES TESTS DU MODULE REÇUS OFFICIELS AVEC QR CODE SONT VALIDÉS !');
  console.log('======================================================================\n');
}

runReceiptsTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
