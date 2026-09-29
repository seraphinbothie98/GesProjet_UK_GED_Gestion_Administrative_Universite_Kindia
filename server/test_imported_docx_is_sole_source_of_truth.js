const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const db = require('./src/database/db');
const docxService = require('./src/services/docxService');
const { generateMissionOrderDocumentInstance, getActiveTemplateForDocumentType } = require('./src/services/pdfService');
const { UPLOAD_DIR } = require('./src/config/constants');

async function createCustomTestDocx({ title, titleColor, customTag, customTableColumn }) {
  const zip = new JSZip();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:sz w:val="22"/>
        <w:color w:val="0F172A"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- Custom Header Title -->
    <w:p>
      <w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="120"/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:sz w:val="32"/><w:color w:val="${titleColor}"/></w:rPr>
        <w:t>${title}</w:t>
      </w:r>
    </w:p>

    <!-- Reference -->
    <w:p>
      <w:pPr><w:jc w:val="left"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>N° Réf: {{reference}}</w:t></w:r>
    </w:p>

    <!-- Custom Specific Table Layout -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9500" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:color="${titleColor}"/>
          <w:left w:val="single" w:sz="6" w:color="${titleColor}"/>
          <w:bottom w:val="single" w:sz="6" w:color="${titleColor}"/>
          <w:right w:val="single" w:sz="6" w:color="${titleColor}"/>
          <w:insideH w:val="single" w:sz="4" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="4" w:color="CBD5E1"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Missionnaire</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{nom}} {{prenoms}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Nationalité</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{nationalite}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Fonction</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{fonction}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Destination</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{destination}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Objet</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>{{objet_mission}}</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${customTableColumn}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${customTag}</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>

    <w:p>
      <w:pPr><w:jc w:val="right"/><w:spacing w:before="200"/></w:pPr>
      <w:r><w:t>Fait à {{lieu_document}}, le {{date_document}}</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/document.xml', documentXml);

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function runStrictVerificationTest() {
  console.log('========================================================================');
  console.log('TEST OBLIGATOIRE : LE DOCX IMPORTÉ PAR DÉFAUT EST LA SOURCE UNIQUE DU MODÈLE');
  console.log('========================================================================\n');

  const templateDir = path.join(UPLOAD_DIR, 'templates');
  if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });

  // -------------------------------------------------------------------------
  // ÉTAPE 1 : Créer et importer un DOCX A avec mise en page très reconnaissable
  // -------------------------------------------------------------------------
  console.log('Étape 1: Création du DOCX A avec mise en page personnalisée...');
  const titleA = "ORDRE DE MISSION OFFICIEL - FACULTÉ DES SCIENCES UK (MODÈLE A)";
  const colorA = "002B80"; // Kindia Blue
  const docxABuffer = await createCustomTestDocx({
    title: titleA,
    titleColor: colorA,
    customTag: "Valable 15 jours",
    customTableColumn: "Validité Spécifique A"
  });

  const docxAName = `ORDRE_DE_MISSION_PERSONNALISE_A_${Date.now()}.docx`;
  const docxAPath = path.join(templateDir, docxAName);
  fs.writeFileSync(docxAPath, docxABuffer);
  console.log(`✓ Fichier physique DOCX A créé : ${docxAName}`);

  // -------------------------------------------------------------------------
  // ÉTAPE 2 : Définir DOCX A comme modèle par défaut
  // -------------------------------------------------------------------------
  console.log('\nÉtape 2: Définir DOCX A comme modèle par défaut dans le système...');
  await db.run(`UPDATE mission_order_templates SET is_default = 0, status = 'INACTIVE'`);
  const insertA = await db.run(`
    INSERT INTO mission_order_templates (
      name, file_path, file_name, file_type, file_size, status, version_number, is_default,
      detected_fields, created_at, updated_at
    ) VALUES (?, ?, ?, 'DOCX', ?, 'ACTIVE', 1, 1, '["reference","nom","prenoms","nationalite","fonction","destination","objet_mission"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, ['Modèle Faculté des Sciences', docxAName, docxAName, docxABuffer.length]);

  const templateAId = insertA.lastID;
  console.log(`✓ Modèle DOCX A enregistré comme Modèle Par Défaut (ID: ${templateAId}, Version: 1)`);

  // -------------------------------------------------------------------------
  // ÉTAPE 3 : Créer un nouvel Ordre de mission
  // -------------------------------------------------------------------------
  console.log('\nÉtape 3: Génération d’un ordre de mission à partir du modèle actif...');
  const missionDataA = {
    reference: '2026/0991/MESRS/UK/RECT/SG',
    missionary_name: 'CAMARA',
    missionary_firstnames: 'Ousmane',
    nationality: 'Guinéenne',
    function_title: 'Doyen de Faculté',
    missionary_service: 'Faculté des Sciences',
    destination: 'Labé',
    object_of_mission: 'Évaluation des laboratoires régionaux',
    transport_mode: 'Véhicule de service 01-UK',
    departure_date: '20 Septembre 2026',
    return_date: '25 Septembre 2026',
    created_at: new Date('2026-09-15T10:00:00Z').toISOString()
  };

  const genResultA = await generateMissionOrderDocumentInstance(missionDataA);
  console.log(`✓ Résultat génération A:`);
  console.log(`  - Fichier DOCX généré : ${genResultA.generated_docx_path}`);
  console.log(`  - Modèle source utilisé : ${genResultA.template_file_name} (Version ${genResultA.template_version_number})`);

  // -------------------------------------------------------------------------
  // ÉTAPE 4 : Vérifier que le document généré correspond réellement au DOCX A
  // -------------------------------------------------------------------------
  console.log('\nÉtape 4: Contrôle de conformité du document généré A...');
  const genDocxAPath = path.join(UPLOAD_DIR, genResultA.generated_docx_path);
  if (!fs.existsSync(genDocxAPath)) {
    throw new Error(`Le fichier généré n'existe pas: ${genDocxAPath}`);
  }

  const zipGenA = await JSZip.loadAsync(fs.readFileSync(genDocxAPath));
  const xmlGenA = await zipGenA.file('word/document.xml').async('string');

  if (!xmlGenA.includes(titleA)) {
    throw new Error(`ÉCHEC: Le document généré ne contient pas le titre spécifique du DOCX A ("${titleA}")`);
  }
  if (!xmlGenA.includes('CAMARA')) {
    throw new Error(`ÉCHEC: Le champ {{nom}} n'a pas été remplacé par CAMARA`);
  }
  if (!xmlGenA.includes('Ousmane')) {
    throw new Error(`ÉCHEC: Le champ {{prenoms}} n'a pas été remplacé par Ousmane`);
  }
  if (!xmlGenA.includes('Labé')) {
    throw new Error(`ÉCHEC: Le champ {{destination}} n'a pas été remplacé par Labé`);
  }
  if (!xmlGenA.includes('Validité Spécifique A')) {
    throw new Error(`ÉCHEC: La structure de tableau spécifique du DOCX A n'est pas préservée`);
  }
  console.log('✓ SUCCÈS ÉTAPE 4: Le document généré reproduit fidèlement le DOCX A avec les champs dynamiques remplacés !');

  // -------------------------------------------------------------------------
  // ÉTAPE 5 : Modifier le document dans Word (Couleur différente, Titre différent)
  // -------------------------------------------------------------------------
  console.log('\nÉtape 5: Modification du modèle pour créer la révision DOCX B (Nouvelle couleur & Titre)...');
  const titleB = "ORDRE DE MISSION OFFICIEL DU RECTEUR (RÉVISION B - ROUGE)";
  const colorB = "DC2626"; // Guinean Red
  const docxBBuffer = await createCustomTestDocx({
    title: titleB,
    titleColor: colorB,
    customTag: "Priorité Absolue Cabinet",
    customTableColumn: "Mention Spécifique Révision B"
  });

  const docxBName = `ORDRE_DE_MISSION_REVISE_B_${Date.now()}.docx`;
  const docxBPath = path.join(templateDir, docxBName);
  fs.writeFileSync(docxBPath, docxBBuffer);
  console.log(`✓ Fichier physique DOCX B créé : ${docxBName}`);

  // -------------------------------------------------------------------------
  // ÉTAPES 6 & 7 : Enregistrer la révision (Version 2) et la définir par défaut
  // -------------------------------------------------------------------------
  console.log('\nÉtape 6 & 7: Enregistrement de la Version 2 et définition comme Modèle Par Défaut...');
  await db.run(`UPDATE mission_order_templates SET is_default = 0, status = 'INACTIVE'`);
  const insertB = await db.run(`
    INSERT INTO mission_order_templates (
      name, file_path, file_name, file_type, file_size, status, version_number, is_default,
      detected_fields, created_at, updated_at
    ) VALUES (?, ?, ?, 'DOCX', ?, 'ACTIVE', 2, 1, '["reference","nom","prenoms","nationalite","fonction","destination","objet_mission"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `, ['Modèle Cabinet Rectoral', docxBName, docxBName, docxBBuffer.length]);

  const templateBId = insertB.lastID;
  console.log(`✓ Modèle DOCX B enregistré comme Modèle Par Défaut (ID: ${templateBId}, Version: 2)`);

  // -------------------------------------------------------------------------
  // ÉTAPE 8 : Créer un nouvel Ordre de mission et vérifier que la nouvelle version est utilisée
  // -------------------------------------------------------------------------
  console.log('\nÉtape 8: Génération d’un nouvel ordre de mission et vérification de la révision B...');
  const missionDataB = {
    reference: '2026/0992/MESRS/UK/RECT/SG',
    missionary_name: 'BARRY',
    missionary_firstnames: 'Mamadou Saliou',
    nationality: 'Guinéenne',
    function_title: 'Secrétaire Général',
    missionary_service: 'Secrétariat Général',
    destination: 'Kankan',
    object_of_mission: 'Supervision des examens nationaux',
    transport_mode: 'Véhicule 4x4 SG-01',
    departure_date: '01 Octobre 2026',
    return_date: '10 Octobre 2026',
    created_at: new Date('2026-09-15T11:00:00Z').toISOString()
  };

  const genResultB = await generateMissionOrderDocumentInstance(missionDataB);
  console.log(`✓ Résultat génération B:`);
  console.log(`  - Fichier DOCX généré : ${genResultB.generated_docx_path}`);
  console.log(`  - Modèle source utilisé : ${genResultB.template_file_name} (Version ${genResultB.template_version_number})`);

  const genDocxBPath = path.join(UPLOAD_DIR, genResultB.generated_docx_path);
  const zipGenB = await JSZip.loadAsync(fs.readFileSync(genDocxBPath));
  const xmlGenB = await zipGenB.file('word/document.xml').async('string');

  if (!xmlGenB.includes(titleB)) {
    throw new Error(`ÉCHEC: Le document généré ne contient pas le nouveau titre du DOCX B ("${titleB}")`);
  }
  if (!xmlGenB.includes(colorB)) {
    throw new Error(`ÉCHEC: Le document généré ne contient pas la nouvelle couleur rouge (${colorB}) du DOCX B`);
  }
  if (xmlGenB.includes(titleA)) {
    throw new Error(`ÉCHEC: Le document généré contient encore l'ancien titre du DOCX A !`);
  }
  if (!xmlGenB.includes('BARRY')) {
    throw new Error(`ÉCHEC: Le champ {{nom}} n'a pas été remplacé par BARRY`);
  }
  if (!xmlGenB.includes('Mamadou Saliou')) {
    throw new Error(`ÉCHEC: Le champ {{prenoms}} n'a pas été remplacé par Mamadou Saliou`);
  }
  if (!xmlGenB.includes('Kankan')) {
    throw new Error(`ÉCHEC: Le champ {{destination}} n'a pas été remplacé par Kankan`);
  }
  if (!xmlGenB.includes('Mention Spécifique Révision B')) {
    throw new Error(`ÉCHEC: La structure de tableau spécifique du DOCX B n'est pas présente`);
  }

  console.log('✓ SUCCÈS ÉTAPE 8: La nouvelle révision (DOCX B - Version 2) avec sa couleur et sa mise en page est réellement utilisée !');

  console.log('\n========================================================================');
  console.log('TOUTES LES VÉRIFICATIONS SONT VALIDÉES AVEC SUCCÈS À 100%');
  console.log('========================================================================');
  process.exit(0);
}

runStrictVerificationTest().catch(err => {
  console.error('\n❌ ERREUR DE TEST :', err.message);
  process.exit(1);
});
