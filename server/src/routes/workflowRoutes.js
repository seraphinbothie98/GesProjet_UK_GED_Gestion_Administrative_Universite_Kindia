const express = require('express');
const router = express.Router();
const WorkflowEngine = require('../services/workflowEngine');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { verifyDocumentAccess } = require('../middleware/abac');

// POST /api/workflow/sg-orient - Secrétaire Général Workflow Orientation & Decision (Rule 9)
router.post('/sg-orient', authenticateToken, async (req, res) => {
  const { document_id, action_type, to_service_id, to_user_id, instruction, authorized_signatory_role } = req.body;

  // Verify SG role or Admin
  if (req.user.role_code !== 'SECRÉTAIRE_GÉNÉRAL' && req.user.role_code !== 'ADMINISTRATEUR') {
    return res.status(403).json({ error: 'Action réservée exclusivement au Secrétaire Général.' });
  }

  if (!document_id || !action_type) {
    return res.status(400).json({ error: 'ID du document et type d’action SG obligatoires.' });
  }

  try {
    const result = await WorkflowEngine.orientBySG({
      documentId: document_id,
      sgUserId: req.user.id,
      actionType: action_type,
      toServiceId: to_service_id,
      toUserId: to_user_id,
      instruction,
      authorizedSignatoryRole: authorized_signatory_role,
      req
    });

    res.json(result);
  } catch (err) {
    console.error('SG orient error:', err);
    res.status(400).json({ error: err.message || 'Erreur lors du traitement de la décision du Secrétaire Général.' });
  }
});

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

// POST /api/workflow/in-progress - Mark document as currently in progress by holding service
router.post('/in-progress', authenticateToken, async (req, res) => {
  const { document_id, remarks } = req.body;

  if (!document_id) {
    return res.status(400).json({ error: 'ID du document obligatoire.' });
  }

  try {
    const result = await WorkflowEngine.markInProgress({
      documentId: document_id,
      userId: req.user.id,
      userSvcId: req.user.service_id,
      remarks,
      req
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur lors de la mise en cours de traitement.' });
  }
});

// POST /api/workflow/transmit - Transmit document
router.post('/transmit', authenticateToken, requirePermission('documents.transmit'), async (req, res) => {
  const { document_id, to_service_id, to_user_id, instruction, priority, deadline } = req.body;

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
      priority,
      deadline,
      req
    });

    res.json({ success: true, message: 'Document transmis avec succès.', transferId: result.transferId });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur lors de la transmission du document.' });
  }
});

// POST /api/workflow/return-sc-archive - Return document specifically to Secrétariat Central for central archiving
router.post('/return-sc-archive', authenticateToken, async (req, res) => {
  const { document_id, motive } = req.body;

  if (!document_id) {
    return res.status(400).json({ error: 'ID du document obligatoire.' });
  }

  try {
    const result = await WorkflowEngine.returnToCentralArchive({
      documentId: document_id,
      fromUserId: req.user.id,
      fromServiceId: req.user.service_id,
      motive: motive || 'Versement aux archives centrales',
      req
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Erreur lors du retour pour archivage central.' });
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

// POST /api/workflow/return-for-correction - Return document specifically for correction with mandatory motive (Rule 10, 18, 26)
router.post('/return-for-correction', authenticateToken, async (req, res) => {
  const { document_id, return_reason } = req.body;

  if (!document_id || !return_reason || !return_reason.trim()) {
    return res.status(400).json({ error: 'ID du document et motif du retour pour correction obligatoires.' });
  }

  try {
    const result = await WorkflowEngine.returnForCorrection({
      documentId: document_id,
      fromUserId: req.user.id,
      fromServiceId: req.user.service_id,
      returnReason: return_reason.trim(),
      req
    });

    res.json(result);
  } catch (err) {
    console.error('Return for correction error:', err);
    res.status(400).json({ error: err.message || 'Erreur lors du retour pour correction.' });
  }
});

// GET /api/workflow/rules - List all active workflow rules (Rule 13, 28)
router.get('/rules', authenticateToken, async (req, res) => {
  try {
    const rules = await db.all(
      `SELECT wr.*, 
              fs.name as from_service_name, ts.name as to_service_name
       FROM workflow_rules wr
       LEFT JOIN services fs ON wr.from_service_id = fs.id
       LEFT JOIN services ts ON wr.to_service_id = ts.id
       ORDER BY wr.document_type ASC, wr.id ASC`
    );
    res.json(rules);
  } catch (err) {
    console.error('Fetch workflow rules error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des règles de workflow.' });
  }
});

// POST /api/workflow/rules - Create or update a workflow rule (Rule 28)
router.post('/rules', authenticateToken, async (req, res) => {
  if (req.user.role_code !== 'ADMINISTRATEUR') {
    return res.status(403).json({ error: 'Accès réservé à l’administrateur système.' });
  }

  const { name, document_type, from_structure_type, from_service_id, to_structure_type, to_service_id, authorized_signatory_role, requires_sg_visa, description } = req.body;

  if (!name || !document_type) {
    return res.status(400).json({ error: 'Le nom et le type de document sont obligatoires.' });
  }

  try {
    const resDb = await db.run(
      `INSERT INTO workflow_rules 
       (name, document_type, from_structure_type, from_service_id, to_structure_type, to_service_id, authorized_signatory_role, requires_sg_visa, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        name.trim(),
        document_type,
        from_structure_type || null,
        from_service_id || null,
        to_structure_type || null,
        to_service_id || null,
        authorized_signatory_role || null,
        requires_sg_visa ? 1 : 0,
        description || null
      ]
    );

    res.status(201).json({ success: true, id: resDb.lastID, message: 'Règle de workflow créée avec succès.' });
  } catch (err) {
    console.error('Create workflow rule error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la règle de workflow.' });
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
