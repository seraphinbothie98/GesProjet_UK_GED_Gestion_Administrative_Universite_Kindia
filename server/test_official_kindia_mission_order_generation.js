const fs = require('fs');
const path = require('path');
const db = require('./src/database/db');
const { generateOfficialKindiaMissionOrderPDF } = require('./src/services/pdfService');

async function runTest() {
  console.log('=== TEST DE GÉNÉRATION DE L\'ORDRE DE MISSION OFFICIEL UK-GED ===');

  const testMissionData = {
    reference: '2026/0001/MESRS/UK/RECT/SG',
    missionary_name: 'Pr Akoye Massa ZOUMANIGUI',
    nationality: 'Guinéenne',
    function_title: 'Recteur de l\'Université',
    destination: 'Conakry',
    object_of_mission: 'Raisons de Service (Concertation MESRSI)',
    transport_mode: 'BG-9949-02',
    departure_date: '13 Juillet 2026',
    return_date: '18 Juillet 2026',
    driver_name: 'Lui-même / Autonome',
    created_at: new Date('2026-07-13T08:30:00Z')
  };

  const testSignature = {
    signed_by_name: 'Dr Mamadou Billo DOUMBOUYA',
    signed_by_role: 'LE SECRÉTAIRE GÉNÉRAL',
    signed_at: new Date('2026-07-13T09:15:00Z'),
    signature_hash: '3f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c'
  };

  console.log('1. Génération du PDF avec les ressources officielles (Logo + Filigrane Guinée)...');
  const result = await generateOfficialKindiaMissionOrderPDF(testMissionData, testSignature);

  console.log('2. Résultat de la génération :');
  console.log('   - Nom du fichier :', result.filename);
  console.log('   - Chemin physique :', result.filePath);
  console.log('   - URL de vérification :', result.verificationUrl);

  if (fs.existsSync(result.filePath)) {
    const stats = fs.statSync(result.filePath);
    console.log('3. Fichier PDF vérifié avec succès ! Taille :', stats.size, 'octets');
  } else {
    throw new Error('Le fichier PDF généré est introuvable sur le disque.');
  }

  console.log('=== TEST TERMINÉ AVEC SUCCÈS ===');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Erreur lors du test :', err);
  process.exit(1);
});
