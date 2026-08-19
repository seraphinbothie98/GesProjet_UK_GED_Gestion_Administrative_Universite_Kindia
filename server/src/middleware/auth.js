const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const db = require('../database/db');

/**
 * Middleware to verify JWT token and attach authenticated user profile
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé. Token manquant.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user profile with service and role permissions (Supports non-service users & Enseignants-Chercheurs)
    const user = await db.get(
      `SELECT u.id, u.matricule, u.first_name, u.last_name, u.email, u.phone, u.function_title, 
              u.personnel_category, u.academic_structure, u.service_id, u.role_id, u.status, 
              s.name as service_name, s.code as service_code, r.code as role_code, r.name as role_name
       FROM users u
       LEFT JOIN services s ON u.service_id = s.id
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ? AND u.status = 'ACTIVE'`,
      [decoded.userId]
    );

    if (!user) {
      return res.status(403).json({ error: 'Utilisateur inactif ou introuvable.' });
    }

    // Fetch user permissions
    const permissions = await db.all(
      `SELECT p.code FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [user.role_id]
    );

    user.permissions = permissions.map(p => p.code);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token invalide ou expiré.' });
  }
}

/**
 * Middleware to check required permission code
 */
function requirePermission(permissionCode) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié.' });
    }

    if (req.user.permissions.includes(permissionCode) || req.user.role_code === 'ADMINISTRATEUR') {
      return next();
    }

    return res.status(403).json({ 
      error: `Permission insuffisante : '${permissionCode}' requise.` 
    });
  };
}

/**
 * Middleware ensuring user is either ADMINISTRATEUR or AGENT_SECRÉTARIAT_CENTRAL
 * Used to protect central administrative modules: Courriers Entrants, Courriers Sortants, Ordres de Mission, Archives, Missionnaires Externes.
 */
function requireCentralAdminOrSC(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Accès non autorisé. Non authentifié.' });
  }

  const isCentralAdminOrSC = req.user.role_code === 'ADMINISTRATEUR' 
    || req.user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' 
    || req.user.service_code === 'SC';

  if (isCentralAdminOrSC) {
    return next();
  }

  return res.status(403).json({
    error: 'Accès non autorisé. L’accès aux registres centraux et à l’archivage est réservé au Secrétariat Central et à l’Administrateur Système.'
  });
}

module.exports = { authenticateToken, requirePermission, requireCentralAdminOrSC };
