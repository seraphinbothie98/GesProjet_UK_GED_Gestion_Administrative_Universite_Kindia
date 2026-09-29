const fs = require('fs');
const path = require('path');
const { generateMissionOrderDocumentInstance, generateSignedMissionOrderPDF } = require('./src/services/pdfService');

async function benchmark() {
  console.log('=== MESURE DU TEMPS DE SIGNATURE ÉLECTRONIQUE (AVANT MODIFICATION) ===\n');

  const testMissionData = {
    reference: 'OM-BENCH-2026-001',
    missionary_name: 'Dr. Ibrahima Sory BANGOURA',
    missionary_last_name: 'BANGOURA',
    missionary_firstnames: 'Ibrahima Sory',
    missionary_titre: 'Dr.',
    function_title: 'Directeur de Recherche',
    missionary_service: 'Laboratoire de Physique',
    matricule: 'UK-ENS-2026-99',
    nationality: 'Guinéenne',
    destination: 'Mamou',
    object_of_mission: 'Supervision des examens régionaux',
    transport_mode: 'Véhicule de service',
    vehicle_registration: 'VA-8822-GN',
    departure_date: '2026-10-10',
    return_date: '2026-10-15',
    driver_name: 'Alpha Oumar DIALLO',
    created_at: new Date().toISOString()
  };

  console.log('1. Génération initiale du document (Création OM par Secrétariat Central)...');
  const t0_create = Date.now();
  const instanceResult = await generateMissionOrderDocumentInstance(testMissionData);
  const t_create = Date.now() - t0_create;
  console.log(`   ✓ Document initial généré en ${t_create} ms (PDF: ${instanceResult.generated_file_path})`);

  console.log('\n2. Signature électronique par le Secrétaire Général...');
  const signatureDetails = {
    signed_at: new Date().toISOString(),
    signed_by_name: 'Dr Mamadou Billo DOUMBOUYA',
    signed_by_role: 'LE SECRETAIRE GENERAL'
  };

  const t0_sign = Date.now();
  const signedResult = await generateSignedMissionOrderPDF({
    ...testMissionData,
    generated_file_path: instanceResult.generated_file_path,
    generated_docx_path: instanceResult.generated_docx_path,
    file_path: instanceResult.generated_file_path,
    template_id: instanceResult.template_id,
    template_version_id: instanceResult.template_version_id
  }, signatureDetails);
  const t_sign = Date.now() - t0_sign;

  console.log(`\n   ✓ PDF Signé : ${signedResult.filename}`);
  console.log(`   ⏱️ Durée totale de la signature électronique : ${t_sign} ms\n`);

  process.exit(0);
}

benchmark().catch(err => {
  console.error('Erreur benchmark:', err);
  process.exit(1);
});
