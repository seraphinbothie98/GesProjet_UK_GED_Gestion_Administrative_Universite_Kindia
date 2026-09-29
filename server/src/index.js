const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT, UPLOAD_DIR } = require('./config/constants');
const seedDatabase = require('./database/seed');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const roleRoutes = require('./routes/roleRoutes');
const documentRoutes = require('./routes/documentRoutes');
const missionRoutes = require('./routes/missionRoutes');
const workflowRoutes = require('./routes/workflowRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const auditRoutes = require('./routes/auditRoutes');
const verifyRoutes = require('./routes/verifyRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const reportRoutes = require('./routes/reportRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const documentTypeRoutes = require('./routes/documentTypeRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const missionTemplateRoutes = require('./routes/missionTemplateRoutes');
const signatureRoutes = require('./routes/signatureRoutes');
const staffRoutes = require('./routes/staffRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const externalMissionaryRoutes = require('./routes/externalMissionaryRoutes');
const missionRequestRoutes = require('./routes/missionRequestRoutes');
const dispatchRoutes = require('./routes/dispatchRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const archiveCategoryRoutes = require('./routes/archiveCategoryRoutes');
const serviceSettingsRoutes = require('./routes/serviceSettingsRoutes');
const transmissionRoutes = require('./routes/transmissionRoutes');
const accountRoutes = require('./routes/accountRoutes');
const onlyofficeRoutes = require('./routes/onlyofficeRoutes');
const onlyofficeDocumentService = require('./services/onlyofficeDocumentService');
const vehicleRoutes = require('./routes/vehicleRoutes');
const driverRoutes = require('./routes/driverRoutes');
const positionRoutes = require('./routes/positionRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const fs = require('fs');

// Serve static uploads with subfolder resolution and inline headers (Logo & Document Fix)
app.use('/uploads', (req, res) => {
  const reqSubPath = decodeURIComponent(req.path).replace(/^\/+/, '');
  const fileBasename = path.basename(reqSubPath);

  // Check possible location candidates
  const candidates = [
    path.join(UPLOAD_DIR, reqSubPath),
    path.join(UPLOAD_DIR, fileBasename),
    path.join(UPLOAD_DIR, 'avatars', fileBasename),
    path.join(UPLOAD_DIR, 'logos', fileBasename),
    path.join(UPLOAD_DIR, 'signatures', fileBasename),
    path.join(UPLOAD_DIR, 'templates', fileBasename)
  ];

  let fullPath = candidates.find(p => p && fs.existsSync(p) && fs.statSync(p).isFile());

  if (fullPath) {
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(fullPath))}"`);
    return res.sendFile(fullPath);
  }

  return res.status(404).json({ error: 'Fichier non trouvé sur le serveur' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/documents', onlyofficeRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/document-types', documentTypeRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/mission-template', missionTemplateRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/admin/maintenance', maintenanceRoutes);
app.use('/api/external-missionaries', externalMissionaryRoutes);
app.use('/api/mission-requests', missionRequestRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/archive-categories', archiveCategoryRoutes);
app.use('/api/service-settings', serviceSettingsRoutes);
app.use('/api/transmissions', transmissionRoutes);
app.use('/api/account', accountRoutes);

const migrator = require('./database/migrator');
const db = require('./database/db');
const { NODE_ENV, APP_VERSION } = require('./config/constants');

// Enhanced Comprehensive Health check with ONLYOFFICE Monitoring
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();
  let dbStatus = 'UNKNOWN';
  let dbLatencyMs = null;
  let storageStatus = 'UNKNOWN';
  let migrationStatus = 'UNKNOWN';
  let onlyofficeStatus = { status: 'UNKNOWN' };

  // 1. Check Database connection & latency
  try {
    const dbStart = Date.now();
    await db.get('SELECT 1 as ping');
    dbLatencyMs = Date.now() - dbStart;
    dbStatus = 'HEALTHY';
  } catch (err) {
    dbStatus = `ERROR: ${err.message}`;
  }

  // 2. Check Storage directory writable
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const testFile = path.join(UPLOAD_DIR, `.health_check_${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'OK', 'utf-8');
    fs.unlinkSync(testFile);
    storageStatus = 'HEALTHY';
  } catch (err) {
    storageStatus = `ERROR: ${err.message}`;
  }

  // 3. Check Migration status
  try {
    const mStatus = await migrator.status();
    migrationStatus = {
      applied: mStatus.applied_count,
      pending: mStatus.pending_count,
      current_batch: mStatus.current_batch,
      up_to_date: mStatus.pending_count === 0
    };
  } catch (err) {
    migrationStatus = `ERROR: ${err.message}`;
  }

  // 4. Check ONLYOFFICE Document Server status (Non-blocking graceful degradation)
  try {
    onlyofficeStatus = await onlyofficeDocumentService.checkHealth();
  } catch (err) {
    onlyofficeStatus = { status: 'UNAVAILABLE', error: err.message };
  }

  const isCoreHealthy = dbStatus === 'HEALTHY' && storageStatus === 'HEALTHY' && (typeof migrationStatus === 'object' ? migrationStatus.up_to_date : false);

  res.status(isCoreHealthy ? 200 : (dbStatus === 'HEALTHY' ? 200 : 503)).json({
    status: isCoreHealthy ? 'HEALTHY' : 'DEGRADED',
    app: 'UK-GED - Université de Kindia',
    version: APP_VERSION,
    environment: NODE_ENV,
    is_production: NODE_ENV === 'production',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    response_time_ms: Date.now() - startTime,
    components: {
      database: {
        status: dbStatus,
        latency_ms: dbLatencyMs
      },
      storage: {
        status: storageStatus,
        directory: UPLOAD_DIR
      },
      migrations: migrationStatus,
      onlyoffice: onlyofficeStatus
    }
  });
});

// Boot server with automated migrations
async function startServer() {
  try {
    console.log(`[BOOT] Démarrage de UK-GED en environnement : ${NODE_ENV.toUpperCase()}...`);
    
    // 1. Run database migrations safely (additive, transactional, zero data loss)
    await migrator.up();

    // 2. In development only: if database is completely empty, initialize seed
    if (NODE_ENV === 'development' || NODE_ENV === 'test') {
      const userCount = await db.get('SELECT COUNT(*) as count FROM users');
      if (!userCount || userCount.count === 0) {
        console.log('[BOOT] Base de développement vide détectée -> Initialisation du seed de départ...');
        await seedDatabase();
      }
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(` UK-GED Backend Running on http://0.0.0.0:${PORT}`);
      console.log(` Environnement : ${NODE_ENV.toUpperCase()} (Version ${APP_VERSION})`);
      console.log(` Université de Kindia - GED System Ready`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('❌ [FATAL BOOT ERROR] Impossible de démarrer le serveur UK-GED:', err);
    process.exit(1);
  }
}

startServer();
