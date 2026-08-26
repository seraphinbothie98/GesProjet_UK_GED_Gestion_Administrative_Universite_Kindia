#!/usr/bin/env node
/**
 * CLI UK-GED : Création d'une sauvegarde intégrale
 * Usage: node src/scripts/backup.js [--tag MON_TAG] [--desc "Description"]
 */

const backupService = require('../services/backupService');
const { NODE_ENV } = require('../config/constants');

async function run() {
  const args = process.argv.slice(2);
  let tag = '';
  let desc = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tag' && args[i + 1]) tag = args[i + 1];
    if (args[i] === '--desc' && args[i + 1]) desc = args[i + 1];
  }

  console.log(`=======================================================`);
  console.log(` UK-GED - SAUVEGARDE COMPLÈTE (${NODE_ENV.toUpperCase()})`);
  console.log(`=======================================================`);

  try {
    const result = await backupService.createFullBackup({
      tag,
      description: desc,
      createdBy: `CLI (${process.env.USERNAME || process.env.USER || 'ADMIN'})`
    });

    console.log(`\n✅ SUCCÈS : Sauvegarde créée avec succès.`);
    console.log(`- Fichier : ${result.backupPath}`);
    console.log(`- Taille  : ${(result.sizeBytes / 1024 / 1024).toFixed(2)} Mo`);
    console.log(`- SHA256  : ${result.sha256}`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ ÉCHEC : Erreur lors de la sauvegarde:`, err.message);
    process.exit(1);
  }
}

run();
