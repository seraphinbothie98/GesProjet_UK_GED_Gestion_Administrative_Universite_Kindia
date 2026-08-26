const assert = require('assert');
const migrator = require('../database/migrator');
const db = require('../database/db');

async function testMigrations() {
  console.log('\n🧪 [TEST] Démarrage des tests du moteur de migrations versionnées...');

  // 1. Check status
  const statusBefore = await migrator.status();
  console.log(`  -> Migrations totales disponibles : ${statusBefore.total_migrations}`);
  console.log(`  -> Migrations appliquées          : ${statusBefore.applied_count}`);
  console.log(`  -> Migrations en attente          : ${statusBefore.pending_count}`);

  assert(statusBefore.total_migrations >= 6, 'Au moins 6 fichiers de migration doivent être présents');

  // 2. Run migrations
  const upResult = await migrator.up();
  console.log(`  -> Résultat up() : ${upResult.appliedCount} migration(s) traitée(s)`);

  // 3. Verify status after up
  const statusAfter = await migrator.status();
  assert.strictEqual(statusAfter.pending_count, 0, 'Toutes les migrations doivent être appliquées');
  assert.strictEqual(statusAfter.applied_count, statusAfter.total_migrations, 'Le nombre appliqué doit correspondre au total');

  // 4. Verify _schema_migrations table structure and records
  const migrationRecords = await db.all('SELECT * FROM _schema_migrations');
  assert(migrationRecords.length >= 6, 'La table _schema_migrations doit contenir les enregistrements');
  for (const m of migrationRecords) {
    assert(m.migration_name.endsWith('.js'), 'Le nom de fichier doit être enregistré');
    assert(m.checksum && m.checksum.length === 64, 'Le checksum SHA256 doit être valide');
    assert(m.batch > 0, 'Le numéro de lot doit être supérieur à 0');
  }

  // 5. Test idempotency (running up again does nothing)
  const upAgain = await migrator.up();
  assert.strictEqual(upAgain.appliedCount, 0, 'Une seconde exécution ne doit rien réappliquer');

  console.log('✅ [TEST PASSÉ] Moteur de migrations versionnées validé avec succès !\n');
}

testMigrations().catch(err => {
  console.error('❌ [TEST ÉCHOUÉ] Erreur lors du test des migrations:', err);
  process.exit(1);
});
