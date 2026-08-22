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
const templateRoutes = require('./routes/templateRoutes');
const signatureRoutes = require('./routes/signatureRoutes');
const staffRoutes = require('./routes/staffRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const externalMissionaryRoutes = require('./routes/externalMissionaryRoutes');
const missionRequestRoutes = require('./routes/missionRequestRoutes');
const dispatchRoutes = require('./routes/dispatchRoutes');
const receiptRoutes = require('./routes/receiptRoutes');
const archiveCategoryRoutes = require('./routes/archiveCategoryRoutes');
const serviceSettingsRoutes = require('./routes/serviceSettingsRoutes');

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
app.use('/api/templates', templateRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin/maintenance', maintenanceRoutes);
app.use('/api/external-missionaries', externalMissionaryRoutes);
app.use('/api/mission-requests', missionRequestRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/archive-categories', archiveCategoryRoutes);
app.use('/api/service-settings', serviceSettingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    app: 'UK-GED - Université de Kindia',
    timestamp: new Date().toISOString()
  });
});

// Boot server & seed DB
async function startServer() {
  await seedDatabase();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` UK-GED Backend Running on http://0.0.0.0:${PORT}`);
    console.log(` Université de Kindia - GED System Ready`);
    console.log(`====================================================`);
  });
}

startServer();
