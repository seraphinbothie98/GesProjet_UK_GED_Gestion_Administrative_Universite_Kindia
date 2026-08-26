#!/usr/bin/env node
/**
 * CLI UK-GED : Restauration sécurisée d'une sauvegarde
 * Usage: node src/scripts/restore.js <chemin_vers_archive.zip> --confirm <MOT_DE_CONFIRMATION>
 */

const path = require('path');
const backupService = require('../services/backupService');
const { NODE_ENV } = require('../config/constants');

async function run() {
  const args = process.argv.slice(2);
  const archivePath = args[0];
  let confirmText = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--confirm' && args[i + 1]) confirmText = args[i + 1];
  }

  if (!archivePath) {
    console.error('Usage: node src/scripts/restore.js <chemin_vers_archive.zip> --confirm RESTAURER');
    process.exit(1);
  }

  const expectedWord = NODE_ENV === 'production' ? 'RESTAURER_PRODUCTION' : 'RESTAURER';

  if (confirmText !== expectedWord) {
    console.error(`\n⚠️ SÉCURITÉ REQUISE : Pour restaurer cette sauvegarde en environnement ${NODE_ENV.toUpperCase()},`);
    console.error(`vous devez spécifier le paramètre : --confirm ${expectedWord}\n`);
    process.exit(1);
  }

  const fullPath = path.resolve(archivePath);
  console.log(`=======================================================`);
  console.log(` UK-GED - RESTAURATION DE SAUVEGARDE (${NODE_ENV.toUpperCase()})`);
  console.log(`=======================================================`);

  try {
    const result = await backupService.restoreBackup(fullPath, { confirmText });
    console.log(`\n✅ RESTAURATION EFFECTUÉE AVEC SUCCÈS !`);
    console.log(`- Base de données restaurée : ${result.restored_db}`);
    console.log(`- Fichiers rétablis         : ${result.restored_files_count}`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ ÉCHEC DE LA RESTAURATION :`, err.message);
    process.exit(1);
  }
}

run();
