const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// ==========================================
// PARC AUTOMOBILE DE L'UNIVERSITÉ (VÉHICULES DE SERVICE)
// ==========================================

// RBAC Helper: Parc automobile strictly accessible to Admin and Secrétariat Central
function isAuthorizedAdminOrSC(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Non authentifié' });
  const isAllowed = user.role_code === 'ADMINISTRATEUR' || 
                    user.role_code === 'AGENT_SECRÉTARIAT_CENTRAL' || 
                    user.service_code === 'SC';
  if (!isAllowed) {
    return res.status(403).json({ error: 'Accès réservé au Secrétariat Central et à l’Administrateur.' });
  }
  next();
}

// RBAC Helper: Actions critiques (Suppression / Désactivation) strictement réservées à l'Administrateur
function isAdminOnly(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Non authentifié' });
  if (user.role_code !== 'ADMINISTRATEUR') {
    return res.status(403).json({ error: 'Action critique réservée exclusivement à l’Administrateur Système.' });
  }
  next();
}

/**
 * GET /api/vehicles
 * Liste les véhicules du parc automobile de l'Université
 */
router.get('/', authenticateToken, isAuthorizedAdminOrSC, async (req, res) => {
  try {
    const { status, staff_id, service_id, search, available_only } = req.query;

    let query = `
      SELECT 
        v.*,
        s.nom AS assigned_staff_nom,
        s.prenoms AS assigned_staff_prenoms,
        s.matricule AS assigned_staff_matricule,
        s.fonction AS assigned_staff_fonction,
        srv.name AS assigned_service_name,
        srv.code AS assigned_service_code,
        d.nom AS default_driver_nom,
        d.prenoms AS default_driver_prenoms,
        d.telephone AS default_driver_telephone
      FROM vehicles v
      LEFT JOIN staff s ON v.assigned_staff_id = s.id
      LEFT JOIN services srv ON v.assigned_service_id = srv.id
      LEFT JOIN drivers d ON v.default_driver_id = d.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      query += ` AND v.status = ?`;
      params.push(status);
    }

    if (available_only === 'true') {
      query += ` AND v.status IN ('DISPONIBLE', 'ACTIF')`;
    }

    if (staff_id) {
      query += ` AND v.assigned_staff_id = ?`;
      params.push(staff_id);
    }

    if (service_id) {
      query += ` AND v.assigned_service_id = ?`;
      params.push(service_id);
    }

    if (search) {
      const term = `%${search.trim()}%`;
      query += ` AND (
        v.registration_number LIKE ? 
        OR v.brand LIKE ? 
        OR v.model LIKE ? 
        OR s.nom LIKE ? 
        OR s.prenoms LIKE ?
        OR srv.name LIKE ?
      )`;
      params.push(term, term, term, term, term, term);
    }

    query += ` ORDER BY v.registration_number ASC`;

    const vehicles = await db.all(query, params);

    const formatted = vehicles.map(v => ({
      ...v,
      assigned_staff_full_name: v.assigned_staff_nom ? `${v.assigned_staff_prenoms || ''} ${v.assigned_staff_nom}`.trim() : null,
      default_driver_full_name: v.default_driver_nom ? `${v.default_driver_prenoms || ''} ${v.default_driver_nom}`.trim() : null,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Erreur récupération parc automobile:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération du parc automobile' });
  }
});

/**
 * GET /api/vehicles/:id
 * Détails d'un véhicule du parc
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'personal') return; // Handled by personal routes below

    const vehicle = await db.get(`
      SELECT 
        v.*,
        s.nom AS assigned_staff_nom,
        s.prenoms AS assigned_staff_prenoms,
        s.matricule AS assigned_staff_matricule,
        s.fonction AS assigned_staff_fonction,
        srv.name AS assigned_service_name,
        srv.code AS assigned_service_code,
        d.nom AS default_driver_nom,
        d.prenoms AS default_driver_prenoms,
        d.telephone AS default_driver_telephone
      FROM vehicles v
      LEFT JOIN staff s ON v.assigned_staff_id = s.id
      LEFT JOIN services srv ON v.assigned_service_id = srv.id
      LEFT JOIN drivers d ON v.default_driver_id = d.id
      WHERE v.id = ?
    `, [id]);

    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }

    vehicle.assigned_staff_full_name = vehicle.assigned_staff_nom ? `${vehicle.assigned_staff_prenoms || ''} ${vehicle.assigned_staff_nom}`.trim() : null;
    vehicle.default_driver_full_name = vehicle.default_driver_nom ? `${vehicle.default_driver_prenoms || ''} ${vehicle.default_driver_nom}`.trim() : null;

    res.json(vehicle);
  } catch (err) {
    console.error('Erreur récupération véhicule:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération du véhicule' });
  }
});

/**
 * POST /api/vehicles
 * Ajouter un véhicule au parc automobile de l'Université
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      registration_number,
      brand,
      model,
      vehicle_type,
      color,
      status,
      assigned_staff_id,
      assigned_service_id,
      default_driver_id,
      observations
    } = req.body;

    if (!registration_number || !registration_number.trim()) {
      return res.status(400).json({ error: "L'immatriculation est obligatoire" });
    }

    const cleanReg = registration_number.trim().toUpperCase();

    // Vérifier unicité de l'immatriculation
    const existing = await db.get('SELECT id FROM vehicles WHERE registration_number = ?', [cleanReg]);
    if (existing) {
      return res.status(400).json({ error: `Un véhicule avec l'immatriculation ${cleanReg} existe déjà dans le parc` });
    }

    let initialStatus = status || 'DISPONIBLE';
    if (assigned_staff_id || assigned_service_id) {
      if (initialStatus === 'DISPONIBLE') initialStatus = 'AFFECTÉ';
    }

    const assignedAt = (assigned_staff_id || assigned_service_id) ? new Date().toISOString() : null;

    const result = await db.run(`
      INSERT INTO vehicles (
        registration_number,
        brand,
        model,
        vehicle_type,
        color,
        status,
        assigned_staff_id,
        assigned_service_id,
        default_driver_id,
        assigned_at,
        observations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cleanReg,
      (brand || '').trim(),
      (model || '').trim(),
      vehicle_type || 'SERVICE',
      (color || '').trim(),
      initialStatus,
      assigned_staff_id || null,
      assigned_service_id || null,
      default_driver_id || null,
      assignedAt,
      (observations || '').trim()
    ]);

    const newVehicleId = result.lastID;

    // Si affecté d'emblée, consigner dans l'historique
    if (assigned_staff_id || assigned_service_id) {
      await db.run(`
        INSERT INTO vehicle_assignment_history (
          vehicle_id,
          staff_id,
          service_id,
          assigned_by_user_id,
          assigned_at,
          reason,
          notes
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, "Affectation initiale lors de la création", ?)
      `, [newVehicleId, assigned_staff_id || null, assigned_service_id || null, req.user?.id || null, (observations || '').trim()]);
    }

    await logAuditAction(req.user?.id, 'CREATE_VEHICLE', `Ajout véhicule parc: ${cleanReg} (${brand || ''} ${model || ''})`);

    const createdVehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [newVehicleId]);
    res.status(201).json(createdVehicle);
  } catch (err) {
    console.error('Erreur création véhicule parc:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la création du véhicule' });
  }
});

/**
 * PUT /api/vehicles/:id
 * Modifier les informations d'un véhicule du parc
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      registration_number,
      brand,
      model,
      vehicle_type,
      color,
      status,
      default_driver_id,
      observations
    } = req.body;

    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }

    const cleanReg = registration_number ? registration_number.trim().toUpperCase() : vehicle.registration_number;

    if (cleanReg !== vehicle.registration_number) {
      const existing = await db.get('SELECT id FROM vehicles WHERE registration_number = ? AND id != ?', [cleanReg, id]);
      if (existing) {
        return res.status(400).json({ error: `L'immatriculation ${cleanReg} est déjà utilisée par un autre véhicule` });
      }
    }

    await db.run(`
      UPDATE vehicles SET
        registration_number = ?,
        brand = ?,
        model = ?,
        vehicle_type = ?,
        color = ?,
        status = ?,
        default_driver_id = ?,
        observations = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      cleanReg,
      brand !== undefined ? (brand || '').trim() : vehicle.brand,
      model !== undefined ? (model || '').trim() : vehicle.model,
      vehicle_type || vehicle.vehicle_type || 'SERVICE',
      color !== undefined ? (color || '').trim() : vehicle.color,
      status || vehicle.status,
      default_driver_id !== undefined ? (default_driver_id || null) : vehicle.default_driver_id,
      observations !== undefined ? (observations || '').trim() : vehicle.observations,
      id
    ]);

    await logAuditAction(req.user?.id, 'UPDATE_VEHICLE', `Modification véhicule parc: ${cleanReg}`);

    const updated = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    console.error('Erreur mise à jour véhicule parc:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la modification du véhicule' });
  }
});

/**
 * PUT /api/vehicles/:id/status
 * Activer, désactiver ou changer le statut d'un véhicule du parc (Strictly Admin)
 */
router.put('/:id/status', authenticateToken, isAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DISPONIBLE', 'AFFECTÉ', 'EN_ENTRETIEN', 'IMMOBILISÉ', 'RÉFORMÉ', 'INACTIF'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Statut invalide. Statuts valides : ${validStatuses.join(', ')}` });
    }

    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }

    // Si on désactive ou réforme le véhicule alors qu'il était affecté, clore l'affectation dans l'historique
    if (['INACTIF', 'RÉFORMÉ', 'IMMOBILISÉ'].includes(status) && vehicle.assigned_staff_id) {
      await db.run(`
        UPDATE vehicle_assignment_history
        SET unassigned_at = CURRENT_TIMESTAMP,
            notes = CASE WHEN notes IS NOT NULL AND notes != '' THEN notes || ' | Désactivation véhicule' ELSE 'Désactivation véhicule' END
        WHERE vehicle_id = ? AND unassigned_at IS NULL
      `, [id]);
    }

    await db.run(`
      UPDATE vehicles SET
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, id]);

    await logAuditAction(req.user?.id, 'TOGGLE_VEHICLE_STATUS', `Statut véhicule ${vehicle.registration_number} changé en ${status} (ID: ${id})`);

    const updated = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    console.error('Erreur mise à jour statut véhicule:', err);
    res.status(500).json({ error: 'Erreur serveur lors du changement de statut du véhicule' });
  }
});

/**
 * DELETE /api/vehicles/:id
 * Supprimer définitivement un véhicule du parc (Strictly Admin)
 */
router.delete('/:id', authenticateToken, isAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }

    // 1. Déconnecter les ordres de mission référençant ce véhicule
    try {
      await db.run('UPDATE mission_orders SET vehicle_id = NULL WHERE vehicle_id = ?', [id]);
    } catch (e) {
      console.warn('Notice déconnexion ordres de mission véhicule:', e.message);
    }

    // 2. Supprimer l'historique des affectations de ce véhicule
    try {
      await db.run('DELETE FROM vehicle_assignment_history WHERE vehicle_id = ?', [id]);
    } catch (e) {
      console.warn('Notice suppression historique affectations véhicule:', e.message);
    }

    // 3. Supprimer le véhicule de la table vehicles
    await db.run('DELETE FROM vehicles WHERE id = ?', [id]);

    await logAuditAction(req.user?.id, 'DELETE_VEHICLE', `Suppression définitive du véhicule ${vehicle.registration_number} (${vehicle.brand || ''} ${vehicle.model || ''})`);

    res.json({
      success: true,
      message: `Le véhicule ${vehicle.registration_number} a été supprimé avec succès.`,
      id
    });
  } catch (err) {
    console.error('Erreur suppression véhicule parc:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la suppression du véhicule' });
  }
});

/**
 * POST /api/vehicles/:id/assign
 * Affecter ou réaffecter un véhicule à un agent et/ou un service
 */
router.post('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { staff_id, service_id, reason, notes, default_driver_id } = req.body;

    if (!staff_id && !service_id) {
      return res.status(400).json({ error: 'Veuillez sélectionner au moins un agent ou un service pour l’affectation' });
    }

    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }

    // 1. Clôturer l'affectation active précédente dans l'historique
    await db.run(`
      UPDATE vehicle_assignment_history
      SET unassigned_at = CURRENT_TIMESTAMP
      WHERE vehicle_id = ? AND unassigned_at IS NULL
    `, [id]);

    // 2. Mettre à jour le véhicule
    await db.run(`
      UPDATE vehicles SET
        assigned_staff_id = ?,
        assigned_service_id = ?,
        default_driver_id = COALESCE(?, default_driver_id),
        assigned_at = CURRENT_TIMESTAMP,
        status = 'AFFECTÉ',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [staff_id || null, service_id || null, default_driver_id || null, id]);

    // 3. Enregistrer la nouvelle affectation dans l'historique
    await db.run(`
      INSERT INTO vehicle_assignment_history (
        vehicle_id,
        staff_id,
        service_id,
        assigned_by_user_id,
        assigned_at,
        reason,
        notes
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
    `, [
      id,
      staff_id || null,
      service_id || null,
      req.user?.id || null,
      (reason || 'Affectation administrative').trim(),
      (notes || '').trim()
    ]);

    await logAuditAction(req.user?.id, 'ASSIGN_VEHICLE', `Affectation véhicule ${vehicle.registration_number} à staff ${staff_id || 'N/A'}, service ${service_id || 'N/A'}`);

    const updated = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    console.error('Erreur affectation véhicule:', err);
    res.status(500).json({ error: 'Erreur serveur lors de l’affectation du véhicule' });
  }
});

/**
 * POST /api/vehicles/:id/unassign
 * Retirer l'affectation d'un véhicule (le rendre disponible)
 */
router.post('/:id/unassign', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;

    const vehicle = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    if (!vehicle) {
      return res.status(404).json({ error: 'Véhicule introuvable' });
    }

    // Clôturer l'affectation active dans l'historique
    await db.run(`
      UPDATE vehicle_assignment_history
      SET unassigned_at = CURRENT_TIMESTAMP,
          notes = CASE WHEN notes IS NOT NULL AND notes != '' THEN notes || ' | Fin: ' || ? ELSE 'Fin: ' || ? END
      WHERE vehicle_id = ? AND unassigned_at IS NULL
    `, [(reason || 'Retrait d’affectation'), (reason || 'Retrait d’affectation'), id]);

    // Remettre le véhicule en DISPONIBLE
    await db.run(`
      UPDATE vehicles SET
        assigned_staff_id = NULL,
        assigned_service_id = NULL,
        assigned_at = NULL,
        status = 'DISPONIBLE',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    await logAuditAction(req.user?.id, 'UNASSIGN_VEHICLE', `Désaffectation véhicule ${vehicle.registration_number}`);

    const updated = await db.get('SELECT * FROM vehicles WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    console.error('Erreur désaffectation véhicule:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la désaffectation' });
  }
});

/**
 * GET /api/vehicles/:id/history
 * Consulter l'historique des affectations d'un véhicule de service
 */
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const history = await db.all(`
      SELECT 
        h.*,
        s.nom AS staff_nom,
        s.prenoms AS staff_prenoms,
        s.matricule AS staff_matricule,
        s.fonction AS staff_fonction,
        srv.name AS service_name,
        srv.code AS service_code,
        u.username AS assigned_by_username
      FROM vehicle_assignment_history h
      LEFT JOIN staff s ON h.staff_id = s.id
      LEFT JOIN services srv ON h.service_id = srv.id
      LEFT JOIN users u ON h.assigned_by_user_id = u.id
      WHERE h.vehicle_id = ?
      ORDER BY h.assigned_at DESC
    `, [id]);

    const formatted = history.map(item => ({
      ...item,
      staff_full_name: item.staff_nom ? `${item.staff_prenoms || ''} ${item.staff_nom}`.trim() : null
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Erreur historique véhicule:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération de l’historique' });
  }
});

// ==========================================
// VÉHICULES PERSONNELS D'UN EMPLOYÉ
// ==========================================

/**
 * GET /api/vehicles/personal/all
 * Récupérer les véhicules personnels (filtrable par staff_id ou statut)
 */
router.get('/personal/all', authenticateToken, async (req, res) => {
  try {
    const { staff_id, status } = req.query;

    let query = `
      SELECT 
        pv.*,
        s.nom AS staff_nom,
        s.prenoms AS staff_prenoms,
        s.matricule AS staff_matricule
      FROM personal_vehicles pv
      JOIN staff s ON pv.staff_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (staff_id) {
      query += ` AND pv.staff_id = ?`;
      params.push(staff_id);
    }

    if (status) {
      query += ` AND pv.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY pv.created_at DESC`;

    const list = await db.all(query, params);
    res.json(list);
  } catch (err) {
    console.error('Erreur récupération véhicules personnels:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des véhicules personnels' });
  }
});

/**
 * POST /api/vehicles/personal
 * Ajouter un véhicule personnel pour un employé
 */
router.post('/personal', authenticateToken, async (req, res) => {
  try {
    const {
      staff_id,
      registration_number,
      brand,
      model,
      color,
      vehicle_type,
      year
    } = req.body;

    if (!staff_id) {
      return res.status(400).json({ error: "L'identifiant de l'employé est requis" });
    }

    if (!registration_number || !registration_number.trim()) {
      return res.status(400).json({ error: "L'immatriculation est obligatoire" });
    }

    const cleanReg = registration_number.trim().toUpperCase();

    // Vérifier l'existence du staff
    const staff = await db.get('SELECT id, nom, prenoms FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Employé introuvable' });
    }

    // Vérifier si ce véhicule existe déjà pour cet employé avec le statut ACTIF
    const existing = await db.get(`
      SELECT id FROM personal_vehicles 
      WHERE staff_id = ? AND registration_number = ? AND status = 'ACTIF'
    `, [staff_id, cleanReg]);

    if (existing) {
      return res.status(400).json({ error: `Le véhicule ${cleanReg} est déjà enregistré et actif pour cet employé` });
    }

    const result = await db.run(`
      INSERT INTO personal_vehicles (
        staff_id,
        registration_number,
        brand,
        model,
        color,
        vehicle_type,
        year,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIF')
    `, [
      staff_id,
      cleanReg,
      (brand || '').trim(),
      (model || '').trim(),
      (color || '').trim(),
      vehicle_type || 'Voiture',
      (year || '').trim()
    ]);

    await logAuditAction(req.user?.id, 'CREATE_PERSONAL_VEHICLE', `Ajout véhicule personnel ${cleanReg} pour ${staff.prenoms} ${staff.nom}`);

    const created = await db.get('SELECT * FROM personal_vehicles WHERE id = ?', [result.lastID]);
    res.status(201).json(created);
  } catch (err) {
    console.error('Erreur ajout véhicule personnel:', err);
    res.status(500).json({ error: 'Erreur serveur lors de l’ajout du véhicule personnel' });
  }
});

/**
 * PUT /api/vehicles/personal/:id
 * Modifier un véhicule personnel
 */
router.put('/personal/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { registration_number, brand, model, color, vehicle_type, year, status } = req.body;

    const pv = await db.get('SELECT * FROM personal_vehicles WHERE id = ?', [id]);
    if (!pv) {
      return res.status(404).json({ error: 'Véhicule personnel introuvable' });
    }

    const cleanReg = registration_number ? registration_number.trim().toUpperCase() : pv.registration_number;

    await db.run(`
      UPDATE personal_vehicles SET
        registration_number = ?,
        brand = ?,
        model = ?,
        color = ?,
        vehicle_type = ?,
        year = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      cleanReg,
      brand !== undefined ? (brand || '').trim() : pv.brand,
      model !== undefined ? (model || '').trim() : pv.model,
      color !== undefined ? (color || '').trim() : pv.color,
      vehicle_type || pv.vehicle_type || 'Voiture',
      year !== undefined ? (year || '').trim() : pv.year,
      status || pv.status || 'ACTIF',
      id
    ]);

    await logAuditAction(req.user?.id, 'UPDATE_PERSONAL_VEHICLE', `Modification véhicule personnel ${cleanReg} (ID: ${id})`);

    const updated = await db.get('SELECT * FROM personal_vehicles WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    console.error('Erreur mise à jour véhicule personnel:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du véhicule personnel' });
  }
});

/**
 * DELETE /api/vehicles/personal/:id
 * Désactivation logique d'un véhicule personnel (Ne JAMAIS supprimer physiquement pour l'historique)
 */
router.delete('/personal/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const pv = await db.get('SELECT * FROM personal_vehicles WHERE id = ?', [id]);
    if (!pv) {
      return res.status(404).json({ error: 'Véhicule personnel introuvable' });
    }

    // Désactivation logique
    await db.run(`
      UPDATE personal_vehicles 
      SET status = 'INACTIF', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [id]);

    await logAuditAction(req.user?.id, 'DEACTIVATE_PERSONAL_VEHICLE', `Désactivation véhicule personnel ${pv.registration_number} (ID: ${id})`);

    res.json({ message: 'Véhicule personnel désactivé avec succès', id, status: 'INACTIF' });
  } catch (err) {
    console.error('Erreur désactivation véhicule personnel:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la désactivation du véhicule personnel' });
  }
});

module.exports = router;
