const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/staff - List staff directory (Rules 1 & 14)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, query, is_driver } = req.query;
    let sql = `
      SELECT st.*, s.name as service_name, s.code as service_code,
             v.registration_number as vehicle_registration, v.brand as vehicle_brand, v.model as vehicle_model
      FROM staff st
      LEFT JOIN services s ON st.service_id = s.id
      LEFT JOIN vehicles v ON v.assigned_staff_id = st.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ' AND st.status = ?';
      params.push(status);
    }

    if (is_driver === 'true' || is_driver === '1') {
      sql += ' AND st.is_driver = 1';
    }

    if (query) {
      sql += ' AND (st.nom LIKE ? OR st.prenoms LIKE ? OR st.matricule LIKE ? OR st.fonction LIKE ? OR st.telephone LIKE ?)';
      const q = `%${query}%`;
      params.push(q, q, q, q, q);
    }

    sql += ' ORDER BY st.nom ASC, st.prenoms ASC';

    const staffList = await db.all(sql, params);
    res.json(staffList);
  } catch (err) {
    console.error('Fetch staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du répertoire du personnel.' });
  }
});

// GET /api/staff/check-duplicate - Check duplicate personnel (Rule 18)
router.get('/check-duplicate', authenticateToken, async (req, res) => {
  const { matricule, nom, prenoms } = req.query;

  try {
    let match = null;
    if (matricule && matricule.trim()) {
      match = await db.get('SELECT * FROM staff WHERE matricule = ?', [matricule.trim()]);
    }

    if (!match && nom && prenoms) {
      match = await db.get(
        'SELECT * FROM staff WHERE LOWER(nom) = LOWER(?) AND LOWER(prenoms) = LOWER(?)',
        [nom.trim(), prenoms.trim()]
      );
    }

    res.json({ duplicate: !!match, staff: match || null });
  } catch (err) {
    console.error('Check duplicate staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification des doublons.' });
  }
});

// GET /api/staff/:id - Detailed staff card & mission history (Rules 15 & 16)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const staffId = req.params.id;
    const staffMember = await db.get(
      `SELECT st.*, s.name as service_name, s.code as service_code,
              v.registration_number as vehicle_registration, v.brand as vehicle_brand, v.model as vehicle_model
       FROM staff st
       LEFT JOIN services s ON st.service_id = s.id
       LEFT JOIN vehicles v ON v.assigned_staff_id = st.id
       WHERE st.id = ?`,
      [staffId]
    );

    if (!staffMember) {
      return res.status(404).json({ error: 'Membre du personnel non trouvé.' });
    }

    // Fetch mission history (Rule 16)
    const missions = await db.all(
      `SELECT d.reference, d.status, d.created_at, mo.destination, mo.object_of_mission, mo.departure_date, mo.return_date, mo.is_signed
       FROM documents d
       JOIN mission_orders mo ON d.id = mo.document_id
       WHERE d.status != 'TRASHED' AND (mo.missionary_id = ? OR mo.driver_id = ?)
       ORDER BY d.created_at DESC`,
      [staffId, staffId]
    );

    res.json({
      staff: staffMember,
      missions: missions || []
    });
  } catch (err) {
    console.error('Fetch staff detail error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la fiche du personnel.' });
  }
});

// POST /api/staff - Add new staff member (Rules 2, 3, 4)
router.post('/', authenticateToken, requirePermission('personnel.create'), async (req, res) => {
  const { nom, prenoms, nationality, fonction, service_id, matricule, telephone, email, status, is_driver, vehicle_registration, vehicle_brand, vehicle_model } = req.body;

  if (!nom || !prenoms || !fonction) {
    return res.status(400).json({ error: 'Nom, prénoms et fonction sont obligatoires.' });
  }

  try {
    if (matricule && matricule.trim()) {
      const existingMatricule = await db.get('SELECT id FROM staff WHERE matricule = ?', [matricule.trim()]);
      if (existingMatricule) {
        return res.status(400).json({ error: `Le matricule [${matricule}] est déjà attribué à un membre du personnel.` });
      }
    }

    const result = await db.run(
      `INSERT INTO staff (matricule, nom, prenoms, nationality, fonction, service_id, telephone, email, status, is_driver)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        matricule ? matricule.trim() : null,
        nom.trim().toUpperCase(),
        prenoms.trim(),
        nationality || 'Guinéenne',
        fonction.trim(),
        service_id || null,
        telephone || '',
        email || '',
        status || 'ACTIF',
        is_driver ? 1 : 0
      ]
    );

    const staffId = result.lastID;

    // Optional Vehicle Record (Rule 3)
    if (vehicle_registration && vehicle_registration.trim()) {
      await db.run(
        `INSERT INTO vehicles (registration_number, brand, model, assigned_staff_id, status)
         VALUES (?, ?, ?, ?, 'ACTIF')`,
        [vehicle_registration.trim(), vehicle_brand || '', vehicle_model || '', staffId]
      );
    }

    await logAuditAction(req.user.id, 'CREATE_STAFF', 'STAFF', staffId, req, { nom, prenoms, matricule });

    res.status(201).json({
      success: true,
      message: `Membre du personnel ${nom} ${prenoms} ajouté avec succès.`,
      id: staffId
    });
  } catch (err) {
    console.error('Create staff error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement du membre du personnel.' });
  }
});

// PUT /api/staff/:id - Update staff member
router.put('/:id', authenticateToken, requirePermission('personnel.edit'), async (req, res) => {
  const staffId = req.params.id;
  const { nom, prenoms, nationality, fonction, service_id, matricule, telephone, email, status, is_driver, vehicle_registration, vehicle_brand, vehicle_model } = req.body;

  try {
    const existing = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!existing) {
      return res.status(404).json({ error: 'Membre du personnel introuvable.' });
    }

    if (matricule && matricule.trim() && matricule.trim() !== existing.matricule) {
      const dup = await db.get('SELECT id FROM staff WHERE matricule = ? AND id != ?', [matricule.trim(), staffId]);
      if (dup) return res.status(400).json({ error: `Le matricule [${matricule}] est déjà utilisé.` });
    }

    await db.run(
      `UPDATE staff SET
         matricule = ?, nom = ?, prenoms = ?, nationality = ?, fonction = ?, service_id = ?,
         telephone = ?, email = ?, status = ?, is_driver = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        matricule ? matricule.trim() : existing.matricule,
        nom ? nom.trim().toUpperCase() : existing.nom,
        prenoms ? prenoms.trim() : existing.prenoms,
        nationality || existing.nationality,
        fonction ? fonction.trim() : existing.fonction,
        service_id || existing.service_id,
        telephone !== undefined ? telephone : existing.telephone,
        email !== undefined ? email : existing.email,
        status || existing.status,
        is_driver !== undefined ? (is_driver ? 1 : 0) : existing.is_driver,
        staffId
      ]
    );

    // Update or insert vehicle
    if (vehicle_registration && vehicle_registration.trim()) {
      const existingVehicle = await db.get('SELECT id FROM vehicles WHERE assigned_staff_id = ?', [staffId]);
      if (existingVehicle) {
        await db.run(
          'UPDATE vehicles SET registration_number = ?, brand = ?, model = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [vehicle_registration.trim(), vehicle_brand || '', vehicle_model || '', existingVehicle.id]
        );
      } else {
        await db.run(
          'INSERT INTO vehicles (registration_number, brand, model, assigned_staff_id, status) VALUES (?, ?, ?, ?, "ACTIF")',
          [vehicle_registration.trim(), vehicle_brand || '', vehicle_model || '', staffId]
        );
      }
    }

    await logAuditAction(req.user.id, 'UPDATE_STAFF', 'STAFF', staffId, req, { nom, prenoms });

    res.json({ success: true, message: 'Fiche du personnel mise à jour avec succès.' });
  } catch (err) {
    console.error('Update staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la fiche du personnel.' });
  }
});

// PUT /api/staff/:id/toggle-status - Deactivate staff (Soft delete) (Rule 17)
router.put('/:id/toggle-status', authenticateToken, requirePermission('personnel.deactivate'), async (req, res) => {
  const staffId = req.params.id;
  try {
    const staff = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) return res.status(404).json({ error: 'Membre du personnel introuvable.' });

    const newStatus = staff.status === 'ACTIF' ? 'INACTIF' : 'ACTIF';
    await db.run('UPDATE staff SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, staffId]);

    await logAuditAction(req.user.id, 'TOGGLE_STAFF_STATUS', 'STAFF', staffId, req, { newStatus });

    res.json({
      success: true,
      message: `Statut du membre du personnel changé à [${newStatus}].`
    });
  } catch (err) {
    console.error('Toggle staff status error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de statut.' });
  }
});

module.exports = router;
