const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');
const assignmentService = require('../services/assignmentService');

// GET /api/positions - List all positions with occupancy status (VACANT / OCCUPÉ)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, service_id, status } = req.query;
    const positions = await assignmentService.getAllPositionsWithOccupancy({ category, service_id, status });
    res.json(positions);
  } catch (err) {
    console.error('Fetch positions error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des postes.' });
  }
});

// GET /api/positions/check-availability - Check if position is VACANT or occupied
router.get('/check-availability', authenticateToken, async (req, res) => {
  const { position_id, exclude_staff_id } = req.query;
  if (!position_id) {
    return res.status(400).json({ error: 'Identifiant de poste requis.' });
  }

  try {
    const check = await assignmentService.checkPositionAvailability(
      Number(position_id),
      exclude_staff_id ? Number(exclude_staff_id) : null
    );
    res.json(check);
  } catch (err) {
    console.error('Check position availability error:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la vérification du poste.' });
  }
});

// GET /api/positions/:id - Get detailed position sheet and occupancy history
router.get('/:id', authenticateToken, async (req, res) => {
  const positionId = Number(req.params.id);
  try {
    const position = await db.get(
      `SELECT p.*, s.name as service_name, s.code as service_code
       FROM positions p
       LEFT JOIN services s ON p.service_id = s.id
       WHERE p.id = ?`,
      [positionId]
    );

    if (!position) {
      return res.status(404).json({ error: 'Poste introuvable.' });
    }

    // Occupancy history
    const history = await db.all(
      `SELECT sa.id, sa.start_date, sa.end_date, sa.status, sa.motive, sa.appointment_act_ref,
              st.id as staff_id, st.nom, st.prenoms, st.matricule, st.email, st.user_id,
              srv.name as service_name
       FROM staff_assignments sa
       JOIN staff st ON sa.staff_id = st.id
       LEFT JOIN services srv ON sa.service_id = srv.id
       WHERE sa.position_id = ?
       ORDER BY sa.start_date DESC, sa.id DESC`,
      [positionId]
    );

    const currentOccupant = history.find(h => h.status === 'ACTIVE' && (!h.end_date || new Date(h.end_date) >= new Date())) || null;

    res.json({
      position,
      occupancy_status: currentOccupant ? 'OCCUPE' : 'VACANT',
      current_occupant: currentOccupant ? {
        ...currentOccupant,
        full_name: `${currentOccupant.prenoms} ${currentOccupant.nom}`.trim()
      } : null,
      history: history.map(h => ({
        ...h,
        full_name: `${h.prenoms} ${h.nom}`.trim()
      }))
    });
  } catch (err) {
    console.error('Fetch position detail error:', err);
    res.status(500).json({ error: 'Erreur lors du chargement de la fiche du poste.' });
  }
});

// POST /api/positions - Create a new position (Admin or authorized)
router.post('/', authenticateToken, async (req, res) => {
  const canManage = req.user.role_code === 'ADMINISTRATEUR' || req.user.permissions?.includes('personnel.create');
  if (!canManage) {
    return res.status(403).json({ error: 'Permission refusée pour la création de poste.' });
  }

  const { code, title, service_id, is_unique, category, description } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'L’intitulé du poste est obligatoire.' });
  }

  const cleanTitle = title.trim();
  const cleanCode = (code && code.trim()) ? code.trim().toUpperCase() : `POS_${cleanTitle.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 20)}_${Date.now().toString().slice(-4)}`;

  try {
    const existing = await db.get('SELECT id FROM positions WHERE code = ?', [cleanCode]);
    if (existing) {
      return res.status(400).json({ error: `Un poste avec le code [${cleanCode}] existe déjà.` });
    }

    const isUniqVal = (is_unique === 1 || is_unique === '1' || is_unique === true || is_unique === 'true') ? 1 : 0;

    const result = await db.run(
      `INSERT INTO positions (code, title, service_id, is_unique, category, description, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        cleanCode,
        cleanTitle,
        service_id ? Number(service_id) : null,
        isUniqVal,
        category || 'ADMINISTRATIF',
        description ? description.trim() : null
      ]
    );

    const positionId = result.lastID;
    await logAuditAction(req.user.id, 'CREATE_POSITION', 'POSITION', positionId, req, { code: cleanCode, title: cleanTitle });

    res.status(201).json({
      success: true,
      id: positionId,
      message: `Poste « ${cleanTitle} » créé avec succès.`
    });
  } catch (err) {
    console.error('Create position error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du poste.' });
  }
});

// PUT /api/positions/:id - Update position
router.put('/:id', authenticateToken, async (req, res) => {
  const canManage = req.user.role_code === 'ADMINISTRATEUR' || req.user.permissions?.includes('personnel.edit');
  if (!canManage) {
    return res.status(403).json({ error: 'Permission refusée pour la modification de poste.' });
  }

  const positionId = Number(req.params.id);
  const { title, service_id, is_unique, category, description, status } = req.body;

  try {
    const existing = await db.get('SELECT * FROM positions WHERE id = ?', [positionId]);
    if (!existing) {
      return res.status(404).json({ error: 'Poste introuvable.' });
    }

    const isUniqVal = is_unique !== undefined ? ((is_unique === 1 || is_unique === '1' || is_unique === true || is_unique === 'true') ? 1 : 0) : existing.is_unique;

    await db.run(
      `UPDATE positions 
       SET title = COALESCE(?, title),
           service_id = ?,
           is_unique = ?,
           category = COALESCE(?, category),
           description = COALESCE(?, description),
           status = COALESCE(?, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        title ? title.trim() : existing.title,
        service_id !== undefined ? (service_id ? Number(service_id) : null) : existing.service_id,
        isUniqVal,
        category || existing.category,
        description !== undefined ? description : existing.description,
        status || existing.status,
        positionId
      ]
    );

    await logAuditAction(req.user.id, 'UPDATE_POSITION', 'POSITION', positionId, req, { id: positionId, title });

    res.json({ success: true, message: 'Poste mis à jour avec succès.' });
  } catch (err) {
    console.error('Update position error:', err);
    res.status(500).json({ error: 'Erreur lors de la modification du poste.' });
  }
});

// DELETE /api/positions/:id - Delete position (Only if vacant and not locked)
router.delete('/:id', authenticateToken, async (req, res) => {
  const canManage = req.user.role_code === 'ADMINISTRATEUR';
  if (!canManage) {
    return res.status(403).json({ error: 'Seul un administrateur peut supprimer un poste.' });
  }

  const positionId = Number(req.params.id);

  try {
    const position = await db.get('SELECT * FROM positions WHERE id = ?', [positionId]);
    if (!position) {
      return res.status(404).json({ error: 'Poste introuvable.' });
    }

    // Core institutional positions protection
    const coreCodes = ['RECTEUR', 'SECRETARIAT_GENERAL', 'VR_ETUDES', 'VR_RECHERCHE', 'VR_ETUDIANTS', 'DAF', 'CONTROLEUR_FINANCIER'];
    if (coreCodes.includes(position.code)) {
      return res.status(400).json({ error: `Le poste institutionnel majeur « ${position.title} » est protégé et ne peut pas être supprimé.` });
    }

    // Check if active assignment exists
    const active = await db.get('SELECT id FROM staff_assignments WHERE position_id = ? AND status = "ACTIVE"', [positionId]);
    if (active) {
      return res.status(400).json({ error: 'Ce poste ne peut pas être supprimé car il est actuellement OCCUPÉ par un titulaire actif.' });
    }

    // Safe delete
    await db.run('DELETE FROM staff_assignments WHERE position_id = ?', [positionId]);
    await db.run('DELETE FROM positions WHERE id = ?', [positionId]);

    await logAuditAction(req.user.id, 'DELETE_POSITION', 'POSITION', positionId, req, { code: position.code, title: position.title });

    res.json({ success: true, message: `Poste « ${position.title} » supprimé avec succès.` });
  } catch (err) {
    console.error('Delete position error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du poste.' });
  }
});

module.exports = router;
