const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// GET /api/staff - List staff directory unified with Users repository (Rules 1 & 14)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, query, is_driver, service_id } = req.query;
    let sql = `
      SELECT st.id, st.user_id,
             COALESCE(u.matricule, st.matricule) as matricule,
             COALESCE(u.last_name, st.nom) as nom,
             COALESCE(u.first_name, st.prenoms) as prenoms,
             st.nationality,
             COALESCE(u.function_title, st.fonction) as fonction,
             COALESCE(u.service_id, st.service_id) as service_id,
             COALESCE(u.phone, st.telephone) as telephone,
             COALESCE(u.email, st.email) as email,
             CASE 
               WHEN u.status IS NOT NULL THEN (CASE WHEN u.status = 'ACTIVE' THEN 'ACTIF' ELSE 'INACTIF' END)
               ELSE st.status 
             END as status,
             st.is_driver,
             u.id as linked_user_id,
             u.user_uid,
             u.role_id,
             r.name as role_name,
             r.code as role_code,
             s.name as service_name, s.code as service_code,
             v.registration_number as vehicle_registration, v.brand as vehicle_brand, v.model as vehicle_model
      FROM staff st
      LEFT JOIN users u ON st.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN services s ON COALESCE(u.service_id, st.service_id) = s.id
      LEFT JOIN vehicles v ON v.assigned_staff_id = st.id
      WHERE 1=1
    `;
    const params = [];

    if (service_id) {
      sql += ' AND COALESCE(u.service_id, st.service_id) = ?';
      params.push(Number(service_id));
    }

    if (status) {
      sql += ` AND (CASE 
        WHEN u.status IS NOT NULL THEN (CASE WHEN u.status = 'ACTIVE' THEN 'ACTIF' ELSE 'INACTIF' END)
        ELSE st.status 
      END) = ?`;
      params.push(status);
    }

    if (is_driver === 'true' || is_driver === '1') {
      sql += ' AND st.is_driver = 1';
    }

    if (query) {
      sql += ` AND (
        st.nom LIKE ? OR st.prenoms LIKE ? OR st.matricule LIKE ? OR st.fonction LIKE ? OR st.telephone LIKE ? OR st.email LIKE ?
        OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.matricule LIKE ? OR u.email LIKE ?
      )`;
      const q = `%${query}%`;
      params.push(q, q, q, q, q, q, q, q, q, q);
    }

    sql += ' ORDER BY COALESCE(u.last_name, st.nom) COLLATE NOCASE ASC, COALESCE(u.first_name, st.prenoms) COLLATE NOCASE ASC';

    const staffList = await db.all(sql, params);
    res.json(staffList);
  } catch (err) {
    console.error('Fetch staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du répertoire du personnel.' });
  }
});

// GET /api/staff/check-duplicate - Check duplicate personnel & users (Rule 18)
router.get('/check-duplicate', authenticateToken, async (req, res) => {
  const { matricule, nom, prenoms, email } = req.query;

  try {
    let matchStaff = null;
    let matchUser = null;

    if (matricule && matricule.trim()) {
      matchStaff = await db.get('SELECT * FROM staff WHERE matricule = ?', [matricule.trim()]);
      matchUser = await db.get('SELECT * FROM users WHERE matricule = ?', [matricule.trim()]);
    }

    if (!matchStaff && !matchUser && email && email.trim()) {
      matchStaff = await db.get('SELECT * FROM staff WHERE LOWER(email) = LOWER(?)', [email.trim()]);
      matchUser = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    }

    if (!matchStaff && !matchUser && nom && prenoms) {
      matchStaff = await db.get(
        'SELECT * FROM staff WHERE (LOWER(nom) = LOWER(?) AND LOWER(prenoms) = LOWER(?)) OR (LOWER(nom) = LOWER(?) AND LOWER(prenoms) = LOWER(?))',
        [nom.trim(), prenoms.trim(), prenoms.trim(), nom.trim()]
      );
      matchUser = await db.get(
        'SELECT * FROM users WHERE (LOWER(last_name) = LOWER(?) AND LOWER(first_name) = LOWER(?)) OR (LOWER(last_name) = LOWER(?) AND LOWER(first_name) = LOWER(?))',
        [nom.trim(), prenoms.trim(), prenoms.trim(), nom.trim()]
      );
    }

    const hasDuplicate = !!(matchStaff || matchUser);
    res.json({
      duplicate: hasDuplicate,
      staff: matchStaff || null,
      user: matchUser || null
    });
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
      `SELECT st.id, st.user_id,
              COALESCE(u.matricule, st.matricule) as matricule,
              COALESCE(u.last_name, st.nom) as nom,
              COALESCE(u.first_name, st.prenoms) as prenoms,
              st.nationality,
              COALESCE(u.function_title, st.fonction) as fonction,
              COALESCE(u.service_id, st.service_id) as service_id,
              COALESCE(u.phone, st.telephone) as telephone,
              COALESCE(u.email, st.email) as email,
              CASE 
                WHEN u.status IS NOT NULL THEN (CASE WHEN u.status = 'ACTIVE' THEN 'ACTIF' ELSE 'INACTIF' END)
                ELSE st.status 
              END as status,
              st.is_driver,
              u.id as linked_user_id,
              u.user_uid,
              u.role_id,
              r.name as role_name,
              r.code as role_code,
              s.name as service_name, s.code as service_code,
              v.registration_number as vehicle_registration, v.brand as vehicle_brand, v.model as vehicle_model
       FROM staff st
       LEFT JOIN users u ON st.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN services s ON COALESCE(u.service_id, st.service_id) = s.id
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

// POST /api/staff - Add or link staff member (Rules 2, 3, 4)
router.post('/', authenticateToken, requirePermission('personnel.create'), async (req, res) => {
  const { nom, prenoms, nationality, fonction, service_id, matricule, telephone, email, status, is_driver, vehicle_registration, vehicle_brand, vehicle_model } = req.body;

  if (!nom || !prenoms || !fonction) {
    return res.status(400).json({ error: 'Nom, prénoms et fonction sont obligatoires.' });
  }

  try {
    // Check if matching user exists to link user_id
    let linkedUserId = null;
    if (matricule && matricule.trim()) {
      const uMat = await db.get('SELECT id FROM users WHERE matricule = ?', [matricule.trim()]);
      if (uMat) linkedUserId = uMat.id;
    }
    if (!linkedUserId && email && email.trim()) {
      const uEmail = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
      if (uEmail) linkedUserId = uEmail.id;
    }

    if (matricule && matricule.trim()) {
      const existingMatricule = await db.get('SELECT id FROM staff WHERE matricule = ?', [matricule.trim()]);
      if (existingMatricule) {
        return res.status(400).json({ error: `Le matricule [${matricule}] est déjà attribué à un membre du personnel.` });
      }
    }

    const result = await db.run(
      `INSERT INTO staff (user_id, matricule, nom, prenoms, nationality, fonction, service_id, telephone, email, status, is_driver)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        linkedUserId,
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

    await logAuditAction(req.user.id, 'CREATE_STAFF', 'STAFF', staffId, req, { nom, prenoms, matricule, linkedUserId });

    res.status(201).json({
      success: true,
      message: `Membre du personnel ${nom} ${prenoms} enregistré avec succès.`,
      id: staffId,
      user_id: linkedUserId
    });
  } catch (err) {
    console.error('Create staff error:', err);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement du membre du personnel.' });
  }
});

// PUT /api/staff/:id - Update staff member & synchronize with User account
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

    const updatedMatricule = matricule ? matricule.trim() : existing.matricule;
    const updatedNom = nom ? nom.trim().toUpperCase() : existing.nom;
    const updatedPrenoms = prenoms ? prenoms.trim() : existing.prenoms;
    const updatedNationality = nationality || existing.nationality;
    const updatedFonction = fonction ? fonction.trim() : existing.fonction;
    const updatedServiceId = service_id !== undefined ? (service_id || null) : existing.service_id;
    const updatedTelephone = telephone !== undefined ? telephone : existing.telephone;
    const updatedEmail = email !== undefined ? email : existing.email;
    const updatedStatus = status || existing.status;
    const updatedIsDriver = is_driver !== undefined ? (is_driver ? 1 : 0) : existing.is_driver;

    await db.run(
      `UPDATE staff SET
         matricule = ?, nom = ?, prenoms = ?, nationality = ?, fonction = ?, service_id = ?,
         telephone = ?, email = ?, status = ?, is_driver = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        updatedMatricule,
        updatedNom,
        updatedPrenoms,
        updatedNationality,
        updatedFonction,
        updatedServiceId,
        updatedTelephone,
        updatedEmail,
        updatedStatus,
        updatedIsDriver,
        staffId
      ]
    );

    // If linked to a user account in `users`, synchronize common fields
    if (existing.user_id) {
      const userStatus = updatedStatus === 'INACTIF' ? 'INACTIVE' : 'ACTIVE';
      await db.run(
        `UPDATE users SET
           matricule = ?, first_name = ?, last_name = ?, email = ?, phone = ?, function_title = ?,
           service_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          updatedMatricule,
          updatedPrenoms,
          updatedNom,
          updatedEmail,
          updatedTelephone,
          updatedFonction,
          updatedServiceId,
          userStatus,
          existing.user_id
        ]
      );
    }

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

    await logAuditAction(req.user.id, 'UPDATE_STAFF', 'STAFF', staffId, req, { nom: updatedNom, prenoms: updatedPrenoms, user_id: existing.user_id });

    res.json({ success: true, message: 'Fiche du personnel mise à jour avec succès.' });
  } catch (err) {
    console.error('Update staff error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la fiche du personnel.' });
  }
});

// PUT /api/staff/:id/toggle-status - Deactivate staff & sync user account (Rule 17)
router.put('/:id/toggle-status', authenticateToken, requirePermission('personnel.deactivate'), async (req, res) => {
  const staffId = req.params.id;
  try {
    const staff = await db.get('SELECT * FROM staff WHERE id = ?', [staffId]);
    if (!staff) return res.status(404).json({ error: 'Membre du personnel introuvable.' });

    const newStatus = staff.status === 'ACTIF' ? 'INACTIF' : 'ACTIF';
    await db.run('UPDATE staff SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, staffId]);

    // Synchronize linked user account
    if (staff.user_id) {
      const userStatus = newStatus === 'INACTIF' ? 'INACTIVE' : 'ACTIVE';
      await db.run('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [userStatus, staff.user_id]);
    }

    await logAuditAction(req.user.id, 'TOGGLE_STAFF_STATUS', 'STAFF', staffId, req, { newStatus, user_id: staff.user_id });

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

