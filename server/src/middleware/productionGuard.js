const { NODE_ENV } = require('../config/constants');
const { logAuditAction } = require('./audit');

/**
 * Production & Staging Safety Guard
 * Protège les données sensibles et empêche toute altération destructrice accidentelle.
 */
function blockInProduction(actionDescription = 'Cette opération sensible') {
  return (req, res, next) => {
    if (NODE_ENV === 'production') {
      const errorMsg = `⚠️ OPÉRATION BLOQUÉE : ${actionDescription} est formellement interdite en environnement de PRODUCTION.`;
      console.warn(`[SECURITY ALERT] Tentative d'opération interdite en production par l'utilisateur ID: ${req.user?.id || 'ANONYMOUS'} - IP: ${req.ip}`);
      
      // Audit log attempt
      if (req.user?.id) {
        logAuditAction(req.user.id, 'BLOCKED_PROD_OPERATION', 'SYSTEM', 0, req, {
          action: actionDescription,
          url: req.originalUrl,
          method: req.method
        }).catch(() => {});
      }

      return res.status(403).json({
        error: errorMsg,
        environment: NODE_ENV,
        blocked: true
      });
    }
    next();
  };
}

/**
 * Require explicit typed confirmation for critical tasks in staging / dev
 */
function requireExplicitConfirm(expectedWord = 'CONFIRMER') {
  return (req, res, next) => {
    const confirmation = req.body?.confirmText || req.headers['x-confirm-action'];
    if (confirmation !== expectedWord) {
      return res.status(400).json({
        error: `Confirmation explicite requise. Veuillez saisir exactement "${expectedWord}" pour autoriser cette action.`,
        required_confirmation: expectedWord
      });
    }
    next();
  };
}

module.exports = {
  blockInProduction,
  requireExplicitConfirm
};
