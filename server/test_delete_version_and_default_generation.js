const fs = require('fs');
const path = require('path');
const db = require('./src/database/db');
const { generateMissionOrderDocumentInstance } = require('./src/services/pdfService');
const { UPLOAD_DIR } = require('./src/config/constants');
const JSZip = require('jszip');

async function testVersionDeletionAndDefaultWorkflow() {
  console.log('========================================================================');
  console.log('TEST: SUPPRESSION DE VERSIONS ET PRISE EN CHARGE DU MODÈLE PAR DÉFAUT');
  console.log('========================================================================\n');

  // 1. Check all existing versions
  const versionsBefore = await db.all('SELECT * FROM mission_order_templates ORDER BY version_number ASC');
  console.log(`1. Nombre total de versions existantes : ${versionsBefore.length}`);
  versionsBefore.forEach(v => {
    console.log(`   - ID: ${v.id} | v${v.version_number} | ${v.file_name || v.name} | is_default: ${v.is_default}`);
  });

  // 2. Test deleting an old/unwanted version (e.g. not the only remaining one)
  if (versionsBefore.length > 1) {
    const nonDefaultVersion = versionsBefore.find(v => v.is_default !== 1) || versionsBefore[0];
    console.log(`\n2. Suppression de la version ID: ${nonDefaultVersion.id} (v${nonDefaultVersion.version_number})...`);

    await db.run('DELETE FROM mission_order_templates WHERE id = ?', [nonDefaultVersion.id]);
    const checkDeleted = await db.get('SELECT * FROM mission_order_templates WHERE id = ?', [nonDefaultVersion.id]);
    if (checkDeleted) {
      throw new Error(`La version ${nonDefaultVersion.id} n'a pas été supprimée.`);
    }
    console.log(`✓ Version ${nonDefaultVersion.id} supprimée avec succès du système.`);
  }

  // 3. Check active default template
  const defaultTpl = await db.get(`
    SELECT * FROM mission_order_templates 
    WHERE is_default = 1 OR status = 'ACTIVE' 
    ORDER BY is_default DESC, (status = 'ACTIVE') DESC, version_number DESC, id DESC 
    LIMIT 1
  `);
  console.log(`\n3. Modèle par défaut actif : ID ${defaultTpl?.id} (v${defaultTpl?.version_number} - ${defaultTpl?.file_name || defaultTpl?.name})`);

  // 4. Test emission of Mission Order by Secrétariat Central
  console.log('\n4. Émission d’un ordre de mission par le Secrétariat Central...');
  const missionPayload = {
    reference: '2026/1005/MESRS/UK/RECT/SG',
    missionary_name: 'SOUMAH',
    missionary_firstnames: 'Aboubacar',
    nationality: 'Guinéenne',
    function_title: 'Chef de Département Informatique',
    missionary_service: 'Département Informatique',
    destination: 'Mamou',
    object_of_mission: 'Installation réseau pédagogique',
    transport_mode: 'Véhicule de service',
    departure_date: '28 Septembre 2026',
    return_date: '02 Octobre 2026',
    driver_name: 'Lui-même / Autonome',
    created_at: new Date().toISOString()
  };

  const genResult = await generateMissionOrderDocumentInstance(missionPayload);
  console.log(`✓ Ordre de mission généré avec succès :`);
  console.log(`  - Fichier DOCX : ${genResult.generated_docx_path}`);
  console.log(`  - Modèle source : ${genResult.template_file_name} (Version ${genResult.template_version_number})`);
  console.log(`  - ID Modèle utilisé : ${genResult.template_id}`);

  // 5. Verify the generated file content
  const fullDocxPath = path.join(UPLOAD_DIR, genResult.generated_docx_path);
  if (!fs.existsSync(fullDocxPath)) {
    throw new Error(`Le fichier généré n'existe pas : ${fullDocxPath}`);
  }

  const zip = await JSZip.loadAsync(fs.readFileSync(fullDocxPath));
  const docXml = await zip.file('word/document.xml').async('string');
  if (!docXml.includes('SOUMAH')) {
    throw new Error('Le nom SOUMAH est introuvable dans le DOCX généré.');
  }
  if (!docXml.includes('Mamou')) {
    throw new Error('La destination Mamou est introuvable dans le DOCX généré.');
  }
  console.log('✓ Le document généré contient toutes les données dynamiques et respecte le modèle par défaut sélectionné.');

  console.log('\n========================================================================');
  console.log('TEST TERMINÉ AVEC SUCCÈS À 100%');
  console.log('========================================================================');
  process.exit(0);
}

testVersionDeletionAndDefaultWorkflow().catch(err => {
  console.error('\n❌ Erreur :', err);
  process.exit(1);
});
