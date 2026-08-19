const express = require('express');
const router = express.Router();
const WorkflowEngine = require('../services/workflowEngine');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { verifyDocumentAccess } = require('../middleware/abac');

// POST /api/workflow/orient - Orient document to target service/user
router.post('/orient', authenticateToken, requirePermission('documents.orient'), async (req, res) => {
  const { document_id, to_service_id, to_user_id, motif, instruction, deadline, priority } = req.body;

  if (!document_id || !to_service_id || !motif) {
    return res.status(400).json({ error: 'ID du document, service destinataire et motif d’orientation obligatoires.' });
  }

  try {
    const result = await WorkflowEngine.orientDocument({
      documentId: document_id,
      fromUserId: req.user.id,
      fromServiceId: req.user.service_id,
      toServiceId: to_service_id,
      toUserId: to_user_id,
      motif,
      instruction,
      deadline,
      priority,
      req
    });

    res.json({ success: true, message: 'Document orienté avec succès.', transferId: result.transferId });
  } catch (err) {
    console.error('Orient document error:', err);
    res.status(400).json({ error: err.message || 'Erreur lors de l’orientation du document.' });
  }
});

// POST /api/workflow/transmit - Transmit document
router.post('/transmit', authenticateToken, requirePermission('documents.transmit'), async (req, res) => {
  const { document_id, to_service_id, to_user_id, instruction } = req.body;

  if (!document_id || !to_service_id) {
    return res.status(400).json({ error: 'ID du document et service destinataire obligatoires.' });
  }

  try {
    const result = await WorkflowEngine.transmitDocument({
      documentId: document_id,
      fromUserId: req.user.id,
      fromServiceId: req.user.service_id,
      toServiceId: to_service_id,
      toUserId: to_user_id,
      instruction,
      req
    });

    res.json({ success: true, message: 'Document transmis avec succès.', transferId: result.transferId });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur lors de la transmission du document.' });
  }
});

// POST /api/workflow/return - Return document to sender or previous service (or Secrétariat Central)
router.post('/return', authenticateToken, requirePermission('documents.return'), async (req, res) => {
  const { document_id, to_service_id, return_reason } = req.body;

  if (!document_id) {
    return res.status(400).json({ error: 'ID du document obligatoire.' });
  }

  try {
    await WorkflowEngine.returnDocument({
      documentId: document_id,
      fromUserId: req.user.id,
      fromServiceId: req.user.service_id,
      toServiceId: to_service_id || null,
      returnReason: return_reason || 'Retour au Secrétariat Central après traitement',
      req
    });

    res.json({ success: true, message: 'Document retourné au Secrétariat Central avec succès.' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur lors du retour du document.' });
  }
});

// POST /api/workflow/sign-and-return - Sign/validate document and return to Secrétariat Central (Rules 4 & 5)
router.post('/sign-and-return', authenticateToken, async (req, res) => {
  const { document_id, remarks } = req.body;

  if (!document_id) {
    return res.status(400).json({ error: 'ID du document obligatoire.' });
  }

  try {
    const result = await WorkflowEngine.signAndReturnDocument({
      documentId: document_id,
      userId: req.user.id,
      userServiceId: req.user.service_id,
      remarks: remarks || '',
      req
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur lors de la signature et du retour au Secrétariat Central.' });
  }
});

// POST /api/workflow/accept - Accept document
router.post('/accept', authenticateToken, requirePermission('documents.accept'), async (req, res) => {
  const { document_id, remarks } = req.body;

  if (!document_id) {
    return res.status(400).json({ error: 'ID du document obligatoire.' });
  }

  try {
    const result = await WorkflowEngine.acceptDocument({
      documentId: document_id,
      userId: req.user.id,
      userServiceId: req.user.service_id,
      remarks,
      req
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur lors de l’acceptation du document.' });
  }
});

// POST /api/workflow/reject - Reject document (motif MANDATORY)
router.post('/reject', authenticateToken, requirePermission('documents.reject'), async (req, res) => {
  const { document_id, motif } = req.body;

  if (!document_id || !motif || !motif.trim()) {
    return res.status(400).json({ error: 'ID du document et motif de rejet obligatoires.' });
  }

  try {
    const result = await WorkflowEngine.rejectDocument({
      documentId: document_id,
      userId: req.user.id,
      userServiceId: req.user.service_id,
      motif,
      req
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur lors du rejet du document.' });
  }
});

// GET /api/workflow/circuit/:id - Get visual trajectory circuit graph for a document
router.get('/circuit/:id', authenticateToken, verifyDocumentAccess, async (req, res) => {
  try {
    const circuit = await WorkflowEngine.getVisualCircuit(req.params.id);
    res.json(circuit);
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du chargement du cheminement.' });
  }
});

module.exports = router;
