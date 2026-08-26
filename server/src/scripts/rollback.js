#!/usr/bin/env node
/**
 * CLI UK-GED : Procédure de Rollback Rapide
 * Usage: node src/scripts/rollback.js [--steps N] [--force-production]
 */

const migrator = require('../database/migrator');
const { NODE_ENV } = require('../config/constants');

async function run() {
  const args = process.argv.slice(2);
  let steps = 1;
  let forceProd = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--steps' && args[i + 1]) steps = parseInt(args[i + 1], 10);
    if (args[i] === '--force-production') forceProd = true;
  }

  console.log(`=======================================================`);
  console.log(` UK-GED - ROLLBACK DE MIGRATION (${NODE_ENV.toUpperCase()})`);
  console.log(`=======================================================`);

  try {
    const result = await migrator.down({ steps, forceProduction: forceProd });
    console.log(`\n✅ Rollback terminé : ${result.rolledBackCount} migration(s) annulée(s).`);
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Échec du rollback :`, err.message);
    process.exit(1);
  }
}

run();
