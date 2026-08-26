#!/usr/bin/env node
/**
 * CLI UK-GED : Vérification d'intégrité d'une sauvegarde
 * Usage: node src/scripts/verify-backup.js <chemin_vers_archive.zip>
 */

const path = require('path');
const backupService = require('../services/backupService');

async function run() {
  const args = process.argv.slice(2);
  const archivePath = args[0];

  if (!archivePath) {
    console.error('Usage: node src/scripts/verify-backup.js <chemin_vers_archive.zip>');
    process.exit(1);
  }

  const fullPath = path.resolve(archivePath);
  console.log(`=======================================================`);
  console.log(` UK-GED - VÉRIFICATION D'INTÉGRITÉ DE SAUVEGARDE`);
  console.log(`=======================================================`);
  console.log(`Archive : ${fullPath}`);

  try {
    const result = await backupService.verifyBackup(fullPath);
    console.log(`\n✅ ARCHIVE VALIDE ET CONFORME !`);
    console.log(`- Version application : ${result.manifest.version}`);
    console.log(`- Environnement       : ${result.manifest.environment}`);
    console.log(`- Date création       : ${result.manifest.created_at}`);
    console.log(`- Total Fichiers      : ${result.manifest.storage.files_count}`);
    console.log(`- Métriques Base      :`, JSON.stringify(result.manifest.database.metrics, null, 2));
    console.log(`- Test Sandbox SQLite : ${result.sandbox_db_valid ? 'OK (Succès)' : 'Échec'}`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ ÉCHEC DE VÉRIFICATION :`, err.message);
    process.exit(1);
  }
}

run();
