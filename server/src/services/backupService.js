const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const sqlite3 = require('sqlite3').verbose();
const db = require('../database/db');
const {
  NODE_ENV,
  DB_PATH,
  UPLOAD_DIR,
  BACKUP_DIR,
  APP_VERSION,
  BACKUP_RETENTION_DAILY_DAYS,
  BACKUP_RETENTION_WEEKLY_WEEKS,
  BACKUP_RETENTION_MONTHLY_MONTHS
} = require('../config/constants');

class BackupService {
  constructor() {
    this.backupDir = BACKUP_DIR;
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Calculate file SHA256
  getFileChecksum(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // Recursively collect files in a folder
  collectFiles(dirPath, baseDir = dirPath) {
    let results = [];
    if (!fs.existsSync(dirPath)) return results;

    const list = fs.readdirSync(dirPath);
    for (const file of list) {
      const fullPath = path.join(dirPath, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.collectFiles(fullPath, baseDir));
      } else {
        const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        results.push({
          fullPath,
          relativePath,
          size: stat.size,
          sha256: this.getFileChecksum(fullPath)
        });
      }
    }
    return results;
  }

  // Generate full SQL dump for audit & portable backup
  async generateSqlDump() {
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    let dump = `-- UK-GED DATABASE DUMP (${NODE_ENV.toUpperCase()})\n-- Date: ${new Date().toISOString()}\n-- Version: ${APP_VERSION}\n\nPRAGMA foreign_keys = OFF;\n\n`;

    for (const t of tables) {
      const tableName = t.name;
      const schemaRow = await db.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name = ?`, [tableName]);
      if (schemaRow && schemaRow.sql) {
        dump += `-- Schema for ${tableName}\n${schemaRow.sql};\n\n`;
      }

      const rows = await db.all(`SELECT * FROM "${tableName}"`);
      if (rows.length > 0) {
        dump += `-- Data for ${tableName} (${rows.length} rows)\n`;
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = keys.map(k => {
            const v = row[k];
            if (v === null || v === undefined) return 'NULL';
            if (typeof v === 'number') return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          });
          dump += `INSERT INTO "${tableName}" (${keys.map(k => `"${k}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        dump += '\n';
      }
    }

    dump += `PRAGMA foreign_keys = ON;\n`;
    return dump;
  }

  // Collect key metrics from database
  async getDatabaseMetrics() {
    const metrics = {};
    const tables = ['users', 'services', 'documents', 'archive_categories', 'attachments', 'audit_logs', 'document_templates'];
    for (const t of tables) {
      try {
        const countRow = await db.get(`SELECT COUNT(*) as count FROM "${t}"`);
        metrics[t] = countRow ? countRow.count : 0;
      } catch (err) {
        metrics[t] = 0;
      }
    }
    return metrics;
  }

  // Create full backup (Database + Storage Uploads + Manifest)
  async createFullBackup({ tag = '', description = '', createdBy = 'SYSTEM' } = {}) {
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const backupName = `uk_ged_backup_${NODE_ENV}_${timestamp}${tag ? `_${tag}` : ''}.zip`;
    const targetZipPath = path.join(this.backupDir, backupName);

    console.log(`[BACKUP] (${NODE_ENV}) Début de la sauvegarde complète : ${backupName}...`);

    // 1. Check database exists
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(`Fichier de base de données introuvable à : ${DB_PATH}`);
    }

    const dbChecksum = this.getFileChecksum(DB_PATH);
    const dbSize = fs.statSync(DB_PATH).size;
    const dbMetrics = await this.getDatabaseMetrics();
    const sqlDump = await this.generateSqlDump();

    // 2. Collect all storage files
    const storageFiles = this.collectFiles(UPLOAD_DIR);
    const totalStorageBytes = storageFiles.reduce((acc, f) => acc + f.size, 0);

    // 3. Build Manifest
    const manifest = {
      app: 'UK-GED - Université de Kindia',
      version: APP_VERSION,
      environment: NODE_ENV,
      created_at: new Date().toISOString(),
      created_by: createdBy,
      tag: tag || 'AUTOMATED',
      description: description || `Sauvegarde intégrale UK-GED ${NODE_ENV}`,
      database: {
        file_name: path.basename(DB_PATH),
        size_bytes: dbSize,
        sha256: dbChecksum,
        metrics: dbMetrics
      },
      storage: {
        directory: UPLOAD_DIR,
        files_count: storageFiles.length,
        total_size_bytes: totalStorageBytes,
        files: storageFiles.map(f => ({
          relative_path: f.relativePath,
          size_bytes: f.size,
          sha256: f.sha256
        }))
      }
    };

    // 4. Create ZIP archive
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('database.db', fs.readFileSync(DB_PATH));
    zip.file('database_dump.sql', sqlDump);

    // Add storage files into zip
    const storageFolder = zip.folder('storage');
    for (const f of storageFiles) {
      storageFolder.file(f.relativePath, fs.readFileSync(f.fullPath));
    }

    const zipContent = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    fs.writeFileSync(targetZipPath, zipContent);
    const archiveSize = fs.statSync(targetZipPath).size;
    const archiveSha256 = this.getFileChecksum(targetZipPath);
    const duration = Date.now() - startTime;

    console.log(`[BACKUP] ✅ Sauvegarde réussie (${archiveSize} octets, ${storageFiles.length} fichiers, ${duration}ms)`);
    console.log(`         Archive : ${targetZipPath}`);
    console.log(`         SHA256  : ${archiveSha256}`);

    // 5. Apply Retention Policy
    await this.applyRetentionPolicy();

    return {
      success: true,
      backupPath: targetZipPath,
      filename: backupName,
      sizeBytes: archiveSize,
      sha256: archiveSha256,
      manifest,
      durationMs: duration
    };
  }

  // Verify Backup Archive Integrity in Sandbox
  async verifyBackup(zipPath) {
    if (!fs.existsSync(zipPath)) {
      throw new Error(`Fichier d'archive introuvable : ${zipPath}`);
    }

    console.log(`[VERIFY-BACKUP] Vérification de l'archive : ${path.basename(zipPath)}...`);
    const zipData = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(zipData);

    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error("L'archive ne contient pas de fichier 'manifest.json' valide.");
    }

    const manifestContent = await manifestFile.async('string');
    const manifest = JSON.parse(manifestContent);

    const dbFile = zip.file('database.db');
    if (!dbFile) {
      throw new Error("L'archive ne contient pas de fichier 'database.db'.");
    }

    const dbBuffer = await dbFile.async('nodebuffer');
    const dbHash = crypto.createHash('sha256').update(dbBuffer).digest('hex');
    if (dbHash !== manifest.database.sha256) {
      throw new Error(`ÉCHEC CHECKSUM DB : Attendu ${manifest.database.sha256}, obtenu ${dbHash}`);
    }

    // Verify Sandbox DB integrity with SQLite
    const tempDir = path.join(__dirname, '../../data', 'sandbox_test');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempDbPath = path.join(tempDir, `sandbox_${Date.now()}.db`);
    fs.writeFileSync(tempDbPath, dbBuffer);

    let sandboxValid = false;
    let tableCounts = {};

    try {
      const sandboxDb = new sqlite3.Database(tempDbPath);
      const testPromise = new Promise((resolve, reject) => {
        sandboxDb.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'", (err, row) => {
          if (err) return reject(err);
          resolve(row?.count || 0);
        });
      });

      const totalTables = await testPromise;
      sandboxDb.close();
      sandboxValid = totalTables > 0;
    } finally {
      if (fs.existsSync(tempDbPath)) {
        try { fs.unlinkSync(tempDbPath); } catch (e) {}
      }
    }

    return {
      isValid: true,
      archive_sha256: crypto.createHash('sha256').update(zipData).digest('hex'),
      manifest,
      sandbox_db_valid: sandboxValid
    };
  }

  // Restore Backup
  async restoreBackup(zipPath, { confirmText = '', targetDbPath = DB_PATH, targetStorageDir = UPLOAD_DIR } = {}) {
    const requiredConfirmation = NODE_ENV === 'production' ? 'RESTAURER_PRODUCTION' : 'RESTAURER';
    if (confirmText !== requiredConfirmation) {
      throw new Error(`Confirmation invalide. Vous devez saisir exactement "${requiredConfirmation}" pour restaurer.`);
    }

    console.log(`[RESTORE] ⚠️ DÉBUT DE LA PROCÉDURE DE RESTAURATION (${NODE_ENV})`);
    
    // 1. First, create a safety snapshot of current state before restore!
    if (fs.existsSync(DB_PATH)) {
      console.log(`[RESTORE] Création d'un backup de sécurité pré-restauration...`);
      await this.createFullBackup({ tag: 'PRE_RESTORE_SAFETY', description: 'Sauvegarde automatique pré-restauration' });
    }

    // 2. Verify archive before restoring
    const verification = await this.verifyBackup(zipPath);
    if (!verification.isValid) {
      throw new Error("L'archive de sauvegarde est corrompue ou invalide.");
    }

    const zipData = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(zipData);

    // 3. Restore Database File
    const dbFile = zip.file('database.db');
    const dbBuffer = await dbFile.async('nodebuffer');
    fs.writeFileSync(targetDbPath, dbBuffer);
    console.log(`[RESTORE] Base de données restaurée à : ${targetDbPath}`);

    // 4. Restore Storage Files
    let restoredFilesCount = 0;
    const storageFiles = Object.keys(zip.files).filter(k => k.startsWith('storage/') && !zip.files[k].dir);

    for (const relPath of storageFiles) {
      const filePathInside = relPath.replace(/^storage\//, '');
      const fullDestPath = path.join(targetStorageDir, filePathInside);
      const destDir = path.dirname(fullDestPath);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      const fileBuffer = await zip.file(relPath).async('nodebuffer');
      fs.writeFileSync(fullDestPath, fileBuffer);
      restoredFilesCount++;
    }

    console.log(`[RESTORE] ✅ Restauration terminée avec succès (${restoredFilesCount} fichiers restaurés).`);
    return {
      success: true,
      restored_db: targetDbPath,
      restored_files_count: restoredFilesCount,
      timestamp: new Date().toISOString()
    };
  }

  // Retention Policy Cleanup
  async applyRetentionPolicy() {
    try {
      if (!fs.existsSync(this.backupDir)) return;
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith(`uk_ged_backup_${NODE_ENV}`) && f.endsWith('.zip'))
        .map(f => {
          const fullPath = path.join(this.backupDir, f);
          const stat = fs.statSync(fullPath);
          return { filename: f, fullPath, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      // Keep at least the 5 most recent backups regardless of age
      const minimumToKeep = 5;
      const maxAgeMs = BACKUP_RETENTION_DAILY_DAYS * 24 * 60 * 60 * 1000;
      const now = Date.now();

      for (let i = minimumToKeep; i < files.length; i++) {
        const item = files[i];
        if (now - item.mtime > maxAgeMs) {
          console.log(`[RETENTION] Suppression du backup expiré : ${item.filename}`);
          fs.unlinkSync(item.fullPath);
        }
      }
    } catch (err) {
      console.warn('[RETENTION] Avertissement lors du nettoyage des sauvegardes expirées:', err.message);
    }
  }
}

module.exports = new BackupService();
