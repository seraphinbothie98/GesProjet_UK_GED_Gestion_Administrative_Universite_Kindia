const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Determine active environment (development by default)
const NODE_ENV = process.env.NODE_ENV || 'development';

// Define base root
const serverRoot = path.resolve(__dirname, '../..');
const projectRoot = path.resolve(serverRoot, '..');

// Load environment-specific .env file
const envFiles = [
  path.join(serverRoot, `.env.${NODE_ENV}.local`),
  path.join(serverRoot, `.env.${NODE_ENV}`),
  path.join(serverRoot, '.env.local'),
  path.join(serverRoot, '.env'),
  path.join(projectRoot, `.env.${NODE_ENV}`),
  path.join(projectRoot, '.env')
];

let loadedEnvFile = null;
for (const file of envFiles) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file });
    if (!loadedEnvFile) loadedEnvFile = file;
  }
}

// App Version
const pkg = require('../../package.json');
const APP_VERSION = process.env.APP_VERSION || pkg.version || '1.0.0';

// Build environment-specific storage and database paths
function resolveStorageDir() {
  if (process.env.STORAGE_PATH) {
    return path.resolve(process.env.STORAGE_PATH);
  }
  // Isolate uploads per environment
  const subFolder = NODE_ENV === 'production' ? 'prod' : (NODE_ENV === 'staging' ? 'staging' : 'dev');
  return path.join(serverRoot, 'uploads', subFolder);
}

function resolveDbPath() {
  if (process.env.DATABASE_PATH || process.env.DATABASE_URL) {
    const raw = process.env.DATABASE_PATH || process.env.DATABASE_URL;
    if (raw.startsWith('./') || raw.startsWith('../')) {
      return path.resolve(serverRoot, raw);
    }
    return raw;
  }
  const subFolder = NODE_ENV === 'production' ? 'prod' : (NODE_ENV === 'staging' ? 'staging' : 'dev');
  const dbName = `uk_ged_${subFolder}.db`;
  return path.join(serverRoot, 'data', subFolder, dbName);
}

const STORAGE_DIR = resolveStorageDir();
const DB_PATH = resolveDbPath();
const BACKUP_DIR = process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(projectRoot, 'backups', NODE_ENV);

// Ensure required directories exist
[STORAGE_DIR, path.dirname(DB_PATH), BACKUP_DIR].forEach((dir) => {
  if (typeof dir === 'string' && !dir.startsWith('postgres') && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// App URLs according to environment
function resolveAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (NODE_ENV === 'production') return 'https://ged.universite.edu';
  if (NODE_ENV === 'staging') return 'https://staging-ged.universite.edu';
  return `http://localhost:${process.env.PORT || 3000}`;
}

const config = {
  NODE_ENV,
  IS_PRODUCTION: NODE_ENV === 'production',
  IS_STAGING: NODE_ENV === 'staging',
  IS_DEV: NODE_ENV === 'development' || NODE_ENV === 'test',
  APP_VERSION,
  PORT: parseInt(process.env.PORT || (NODE_ENV === 'staging' ? 5001 : 5000), 10),
  APP_URL: resolveAppUrl(),
  JWT_SECRET: process.env.JWT_SECRET || (NODE_ENV === 'production' ? (() => {
    throw new Error('FATAL: JWT_SECRET must be explicitly defined in production environment variables.');
  })() : `uk_ged_secret_key_${NODE_ENV}_2026`),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  DB_PATH,
  STORAGE_DIR,
  BACKUP_DIR,
  LOADED_ENV_FILE: loadedEnvFile,
  
  // Backup Retention Policy (in days/units)
  BACKUP_RETENTION_DAILY_DAYS: parseInt(process.env.BACKUP_RETENTION_DAILY_DAYS || '30', 10),
  BACKUP_RETENTION_WEEKLY_WEEKS: parseInt(process.env.BACKUP_RETENTION_WEEKLY_WEEKS || '12', 10),
  BACKUP_RETENTION_MONTHLY_MONTHS: parseInt(process.env.BACKUP_RETENTION_MONTHLY_MONTHS || '12', 10)
};

module.exports = config;
