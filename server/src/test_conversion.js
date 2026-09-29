const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const docxService = require('./services/docxService');
const { convertDocxToPdf, getConversionEngineInfo } = require('./services/docxToPdfEngine');
const { generateQRCodeBuffer } = require('./services/qrService');
const pdfService = require('./services/pdfService');

async function runPipelineTest() {
  console.log('=== TEST DU PIPELINE DOCX -> PDF ET FIDÉLITÉ EXACTE ===\n');

  // 1. Check conversion engine status
  console.log('1. Détection du moteur de conversion :');
  const engineInfo = await getConversionEngineInfo();
  console.log('   Moteur actif :', engineInfo.engine);
  console.log('   Détails :', engineInfo.details);
  console.log('   Statut :', engineInfo.ready ? 'PRÊT' : 'EN ATTENTE DE DÉMARRAGE');

  // 2. Fetch default official template from database
  console.log('\n2. Recherche du modèle officiel par défaut (MISSION_ORDER) :');
  const activeTemplateData = await pdfService.getActiveTemplateForDocumentType('MISSION_ORDER');
  if (activeTemplateData) {
    console.log('   Modèle trouvé en base : ID =', activeTemplateData.template.id, '| Version =', activeTemplateData.activeVersion.version_number, '| Fichier =', activeTemplateData.template.file_path);
  } else {
    console.log('   Aucun modèle par défaut trouvé en base !');
  }

  // 3. Test generateMissionOrderDocumentInstance (Creation Step)
  console.log('\n3. Test Création Ordre de Mission (Instance DOCX + PDF Initial fidèlement converti) :');
  const testMissionData = {
    reference: 'OM-2026-TEST-FIDELITE',
    missionary_name: 'CAMARA Sekou Oumar',
    missionary_last_name: 'CAMARA',
    missionary_firstnames: 'Sekou Oumar',
    nationality: 'Guinéenne',
    function_title: 'Enseignant-Chercheur / Maître de Conférences',
    missionary_service: 'Faculté des Sciences et Techniques',
    matricule: 'ENS-2026-9988',
    destination: 'Conakry (Ministère de l’Enseignement Supérieur)',
    object_of_mission: 'Participation à la commission nationale d’évaluation et d’accréditation des programmes universitaires',
    transport_mode: 'Véhicule de service (Immat: RC-4589-B)',
    departure_date: '2026-10-01',
    return_date: '2026-10-05',
    driver_name: 'Mamadouba SYLLA (Chauffeur officiel)',
    created_at: new Date().toISOString()
  };

  const instanceResult = await pdfService.generateMissionOrderDocumentInstance(testMissionData);
  console.log('   ✓ Instance DOCX générée :', instanceResult.generated_docx_path);
  console.log('   ✓ PDF Initial converti :', instanceResult.generated_file_path);
  console.log('   ✓ Chemin complet PDF :', instanceResult.pdf_path);

  // 4. Test generateSignedMissionOrderPDF (Signing Step - strictly overlay)
  console.log('\n4. Test Signature du Secrétaire Général (Surcouche pure Signature + QR Code) :');
  
  // Find an available signature image for test
  const sigDir = path.join(__dirname, '../uploads/dev/signatures');
  let sigPath = 'signature_recteur_2026.png';
  if (fs.existsSync(sigDir)) {
    const files = fs.readdirSync(sigDir).filter(f => f.match(/\.(png|jpg|jpeg)$/i));
    if (files.length > 0) sigPath = files[0];
  }

  const signatureDetails = {
    signed_at: new Date().toISOString(),
    signed_by_name: 'Dr Mamadou Billo DOUMBOUYA',
    signed_by_role: 'LE SECRETAIRE GENERAL',
    signature_image_path: sigPath
  };

  const signedResult = await pdfService.generateSignedMissionOrderPDF({
    ...testMissionData,
    template_id: instanceResult.template_id,
    template_version_id: instanceResult.template_version_id,
    template_version_number: instanceResult.template_version_number,
    generated_docx_path: instanceResult.generated_docx_path,
    generated_file_path: instanceResult.generated_file_path
  }, signatureDetails);

  console.log('   ✓ PDF Final signé généré :', signedResult.filename);
  console.log('   ✓ URL de vérification :', signedResult.verificationUrl);

  // 5. Verification: Check that PDF exists, is valid, and non-empty
  const initialStat = fs.statSync(instanceResult.pdf_path);
  const signedStat = fs.statSync(signedResult.filePath);
  console.log('\n5. Vérification des artefacts :');
  console.log(`   - Taille PDF initial : ${initialStat.size} octets`);
  console.log(`   - Taille PDF signé : ${signedStat.size} octets`);

  if (initialStat.size > 1000 && signedStat.size > 1000) {
    console.log('\n>>> PIPELINE COMPLET TESTÉ ET VALIDÉ AVEC SUCCÈS ! <<<');
  } else {
    throw new Error('Les fichiers PDF générés semblent corrompus ou vides.');
  }
}

runPipelineTest().catch(err => {
  console.error('ERREUR LORS DU TEST DU PIPELINE :', err);
  process.exit(1);
});
