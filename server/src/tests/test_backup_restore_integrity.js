const assert = require('assert');
const fs = require('fs');
const path = require('path');
const backupService = require('../services/backupService');

async function testBackupRestore() {
  console.log('\n🧪 [TEST] Démarrage des tests de sauvegarde, intégrité et restauration...');

  // 1. Create a full backup
  const backupResult = await backupService.createFullBackup({
    tag: 'UNIT_TEST',
    description: 'Test unitaire de sauvegarde'
  });

  assert(backupResult.success, 'La sauvegarde doit réussir');
  assert(fs.existsSync(backupResult.backupPath), 'Le fichier ZIP doit exister sur disque');
  assert(backupResult.sizeBytes > 0, 'La taille du fichier doit être supérieure à 0');
  console.log(`  -> Sauvegarde créée : ${backupResult.filename} (${backupResult.sizeBytes} octets)`);

  // 2. Verify backup archive in Sandbox
  const verification = await backupService.verifyBackup(backupResult.backupPath);
  assert(verification.isValid, 'La vérification de l archive doit être valide');
  assert(verification.sandbox_db_valid, 'La base de données sandbox SQLite doit être valide');
  console.log(`  -> Intégrité vérifiée avec succès (Sandbox DB validée).`);

  // 3. Test sandbox restoration in a separate folder
  const testRestoreDir = path.join(__dirname, '../../data/test_restore_sandbox');
  const testStorageDir = path.join(__dirname, '../../uploads/test_restore_sandbox');
  const testDbFile = path.join(testRestoreDir, 'restored_test.db');

  if (!fs.existsSync(testRestoreDir)) fs.mkdirSync(testRestoreDir, { recursive: true });
  if (!fs.existsSync(testStorageDir)) fs.mkdirSync(testStorageDir, { recursive: true });

  const restoreResult = await backupService.restoreBackup(backupResult.backupPath, {
    confirmText: 'RESTAURER',
    targetDbPath: testDbFile,
    targetStorageDir: testStorageDir
  });

  assert(restoreResult.success, 'La restauration sandbox doit réussir');
  assert(fs.existsSync(testDbFile), 'La base restaurée doit exister');
  console.log(`  -> Restauration bac à sable réussie (${restoreResult.restored_files_count} fichiers rétablis).`);

  // Clean up sandbox test artifacts
  try {
    if (fs.existsSync(testDbFile)) fs.unlinkSync(testDbFile);
    if (fs.existsSync(testRestoreDir)) fs.rmdirSync(testRestoreDir, { recursive: true });
    if (fs.existsSync(testStorageDir)) fs.rmdirSync(testStorageDir, { recursive: true });
    if (fs.existsSync(backupResult.backupPath)) fs.unlinkSync(backupResult.backupPath);
  } catch (e) {}

  console.log('✅ [TEST PASSÉ] Sauvegarde, vérification et restauration validées avec succès !\n');
}

testBackupRestore().catch(err => {
  console.error('❌ [TEST ÉCHOUÉ] Erreur lors du test de sauvegarde/restauration:', err);
  process.exit(1);
});
