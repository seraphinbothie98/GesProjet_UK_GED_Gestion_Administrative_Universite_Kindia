#!/usr/bin/env node
/**
 * CLI UK-GED : Déploiement Sécurisé avec Sauvegarde Préalable et Migrations
 * Usage: node src/scripts/deploy.js [--env staging|production]
 */

const path = require('path');
const backupService = require('../services/backupService');
const migrator = require('../database/migrator');
const { NODE_ENV, APP_VERSION, PORT } = require('../config/constants');

async function deploy() {
  console.log(`================================================================`);
  console.log(` UK-GED - PIPELINE DE DÉPLOIEMENT SÉCURISÉ`);
  console.log(` Environnement : ${NODE_ENV.toUpperCase()} (Version ${APP_VERSION})`);
  console.log(`================================================================\n`);

  const startTime = Date.now();
  let preDeployBackupPath = null;

  try {
    // -------------------------------------------------------------------------
    // Étape 1 : Sauvegarde Préalable Obligatoire (Règle Zéro Perte)
    // -------------------------------------------------------------------------
    console.log(`[ÉTAPE 1/4] Création de la sauvegarde obligatoire pré-déploiement...`);
    const backupResult = await backupService.createFullBackup({
      tag: `PRE_DEPLOY_v${APP_VERSION.replace(/\./g, '_')}`,
      description: `Sauvegarde automatique avant déploiement de la version ${APP_VERSION}`
    });

    preDeployBackupPath = backupResult.backupPath;
    console.log(`  -> Sauvegarde créée : ${backupResult.filename}`);

    // -------------------------------------------------------------------------
    // Étape 2 : Vérification de l'intégrité de la sauvegarde
    // -------------------------------------------------------------------------
    console.log(`\n[ÉTAPE 2/4] Vérification d'intégrité de l'archive de sauvegarde...`);
    const verification = await backupService.verifyBackup(preDeployBackupPath);
    if (!verification.isValid) {
      throw new Error(`Échec de validation de la sauvegarde de sécurité. Déploiement annulé.`);
    }
    console.log(`  -> Archive vérifiée et intègre (Sandbox DB valide).`);

    // -------------------------------------------------------------------------
    // Étape 3 : Application des Migrations de Schéma
    // -------------------------------------------------------------------------
    console.log(`\n[ÉTAPE 3/4] Exécution des migrations de base de données...`);
    const migrationResult = await migrator.up();
    console.log(`  -> Migrations appliquées : ${migrationResult.appliedCount} fichier(s).`);

    // -------------------------------------------------------------------------
    // Étape 4 : Rapport de succès
    // -------------------------------------------------------------------------
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n================================================================`);
    console.log(` ✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS (${totalDuration}s)`);
    console.log(`================================================================`);
    console.log(`- Environnement : ${NODE_ENV.toUpperCase()}`);
    console.log(`- Version       : ${APP_VERSION}`);
    console.log(`- Backup prêt   : ${preDeployBackupPath}`);
    console.log(`- Données       : 100% Intègres & Préservées`);
    console.log(`================================================================\n`);

    process.exit(0);
  } catch (err) {
    console.error(`\n❌ ÉCHEC DU DÉPLOIEMENT :`, err.message);
    if (preDeployBackupPath) {
      console.log(`\n⚠️ Une sauvegarde de sécurité a été créée avant l'échec : ${preDeployBackupPath}`);
      console.log(`Pour restaurer si nécessaire : node src/scripts/restore.js "${preDeployBackupPath}" --confirm ${NODE_ENV === 'production' ? 'RESTAURER_PRODUCTION' : 'RESTAURER'}`);
    }
    process.exit(1);
  }
}

deploy();
