const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { NODE_ENV } = require('../config/constants');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

class DatabaseMigrator {
  constructor() {
    this.migrationsDir = MIGRATIONS_DIR;
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }
  }

  // Calculate file SHA256 checksum for integrity check
  calculateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  // Initialize tracking table
  async init() {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_name TEXT UNIQUE NOT NULL,
        batch INTEGER NOT NULL,
        checksum TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INTEGER NOT NULL,
        environment TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_migrations_batch ON _schema_migrations(batch);
    `);
  }

  // Get list of migration files sorted by filename
  getMigrationFiles() {
    if (!fs.existsSync(this.migrationsDir)) return [];
    return fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.js'))
      .sort((a, b) => a.localeCompare(b));
  }

  // Get applied migrations from database
  async getAppliedMigrations() {
    await this.init();
    return await db.all('SELECT * FROM _schema_migrations ORDER BY id ASC');
  }

  // Get status
  async status() {
    await this.init();
    const applied = await this.getAppliedMigrations();
    const files = this.getMigrationFiles();
    const appliedNames = new Set(applied.map(m => m.migration_name));

    const statusList = files.map(file => {
      const isApplied = appliedNames.has(file);
      const record = applied.find(m => m.migration_name === file);
      return {
        file,
        applied: isApplied,
        batch: record ? record.batch : null,
        applied_at: record ? record.applied_at : null,
        execution_time_ms: record ? record.execution_time_ms : null,
        checksum: record ? record.checksum : null
      };
    });

    const pending = statusList.filter(s => !s.applied);
    const lastBatch = applied.length > 0 ? Math.max(...applied.map(m => m.batch)) : 0;

    return {
      environment: NODE_ENV,
      total_migrations: files.length,
      applied_count: applied.length,
      pending_count: pending.length,
      current_batch: lastBatch,
      migrations: statusList,
      pending: pending.map(p => p.file)
    };
  }

  // Run pending migrations
  async up({ steps = null } = {}) {
    await this.init();
    const applied = await this.getAppliedMigrations();
    const appliedNames = new Set(applied.map(m => m.migration_name));
    const allFiles = this.getMigrationFiles();

    let pendingFiles = allFiles.filter(f => !appliedNames.has(f));
    if (steps && steps > 0) {
      pendingFiles = pendingFiles.slice(0, steps);
    }

    if (pendingFiles.length === 0) {
      console.log(`[MIGRATOR] (${NODE_ENV}) Aucune migration en attente. Base de données à jour.`);
      return { appliedCount: 0, appliedFiles: [] };
    }

    const currentBatch = applied.length > 0 ? Math.max(...applied.map(m => m.batch)) : 0;
    const nextBatch = currentBatch + 1;
    const executed = [];

    console.log(`[MIGRATOR] (${NODE_ENV}) Exécution de ${pendingFiles.length} migration(s) (Lot #${nextBatch})...`);

    for (const file of pendingFiles) {
      const filePath = path.join(this.migrationsDir, file);
      const checksum = this.calculateChecksum(filePath);
      const migration = require(filePath);

      if (typeof migration.up !== 'function') {
        throw new Error(`[MIGRATOR] La migration ${file} ne contient pas de fonction 'up(db)' valide.`);
      }

      console.log(`  -> Exécution de la migration : ${file}...`);
      const startTime = Date.now();

      try {
        await db.exec('BEGIN TRANSACTION;');
        await migration.up(db);
        const duration = Date.now() - startTime;

        await db.run(
          `INSERT INTO _schema_migrations (migration_name, batch, checksum, execution_time_ms, environment)
           VALUES (?, ?, ?, ?, ?)`,
          [file, nextBatch, checksum, duration, NODE_ENV]
        );

        await db.exec('COMMIT;');
        console.log(`     [OK] Migration ${file} appliquée avec succès (${duration}ms)`);
        executed.push({ file, duration });
      } catch (err) {
        try {
          await db.exec('ROLLBACK;');
        } catch (rbErr) {
          // Ignore rollback error if transaction wasn't open
        }
        console.error(`  ❌ [ÉCHEC MIGRATION] Erreur sur ${file}:`, err.message);
        throw new Error(`Migration ${file} a échoué. Annulation transactionnelle effectuée. Raison: ${err.message}`);
      }
    }

    console.log(`[MIGRATOR] (${NODE_ENV}) Toutes les ${executed.length} migrations ont été appliquées avec succès.`);
    return { appliedCount: executed.length, appliedFiles: executed };
  }

  // Rollback migration(s)
  async down({ steps = 1, forceProduction = false } = {}) {
    await this.init();
    if (NODE_ENV === 'production' && !forceProduction) {
      throw new Error(
        '⚠️ SÉCURITÉ CRITIQUE : Le rollback de migration en PRODUCTION nécessite une confirmation explicite (--force-production).'
      );
    }

    const applied = await this.getAppliedMigrations();
    if (applied.length === 0) {
      console.log(`[MIGRATOR] Aucune migration à annuler.`);
      return { rolledBackCount: 0 };
    }

    const lastBatch = Math.max(...applied.map(m => m.batch));
    const targetMigrations = applied
      .filter(m => m.batch === lastBatch)
      .reverse()
      .slice(0, steps || undefined);

    console.log(`[MIGRATOR] Annulation de ${targetMigrations.length} migration(s) du lot #${lastBatch}...`);
    const reverted = [];

    for (const record of targetMigrations) {
      const file = record.migration_name;
      const filePath = path.join(this.migrationsDir, file);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Fichier de migration ${file} introuvable sur le disque pour le rollback.`);
      }

      const migration = require(filePath);
      if (typeof migration.down !== 'function') {
        throw new Error(`La migration ${file} ne définit pas de méthode 'down(db)' pour le rollback.`);
      }

      console.log(`  <- Annulation de : ${file}...`);
      const startTime = Date.now();

      try {
        await db.exec('BEGIN TRANSACTION;');
        await migration.down(db);
        await db.run('DELETE FROM _schema_migrations WHERE migration_name = ?', [file]);
        await db.exec('COMMIT;');
        const duration = Date.now() - startTime;
        console.log(`     [OK] Migration ${file} annulée (${duration}ms)`);
        reverted.push(file);
      } catch (err) {
        try {
          await db.exec('ROLLBACK;');
        } catch (rbErr) {}
        console.error(`  ❌ [ÉCHEC ROLLBACK] Erreur sur ${file}:`, err.message);
        throw err;
      }
    }

    return { rolledBackCount: reverted.length, revertedFiles: reverted };
  }

  // Create a new migration file template
  create(name) {
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    const filename = `${timestamp}_${cleanName}.js`;
    const targetPath = path.join(this.migrationsDir, filename);

    const template = `/**
 * UK-GED Migration: ${cleanName}
 * Created at: ${new Date().toISOString()}
 *
 * RÈGLE ZÉRO PERTE :
 * - Toujours concevoir des modifications additives et non destructives.
 * - Utiliser des transactions ou des vérifications de colonnes existantes.
 */

module.exports = {
  async up(db) {
    // Exécutez vos modifications de schéma ici :
    // Exemple :
    // await db.exec(\`
    //   CREATE TABLE IF NOT EXISTS ma_nouvelle_table (
    //     id INTEGER PRIMARY KEY AUTOINCREMENT,
    //     nom TEXT NOT NULL,
    //     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    //   );
    // \`);
  },

  async down(db) {
    // Annulation de la migration (si applicable) :
    // await db.exec(\`DROP TABLE IF EXISTS ma_nouvelle_table;\`);
  }
};
`;

    fs.writeFileSync(targetPath, template, 'utf-8');
    console.log(`[MIGRATOR] Fichier de migration créé : ${targetPath}`);
    return { filename, targetPath };
  }
}

module.exports = new DatabaseMigrator();
