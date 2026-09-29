const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticateToken } = require('../middleware/auth');
const { logAuditAction } = require('../middleware/audit');

// Helper to normalize and ensure Guinean phone format +224
function formatGuineaPhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+224')) return cleaned;
  if (cleaned.startsWith('00224')) return '+' + cleaned.substring(2);
  if (cleaned.startsWith('224') && cleaned.length >= 11) return '+' + cleaned;
  if (cleaned.startsWith('+')) return cleaned;
  // If 9 digits or starting with 6
  let digits = cleaned.replace(/[^0-9]/g, '');
  if (digits.length === 9) return '+224' + digits;
  if (digits.length === 8) return '+2246' + digits;
  return digits ? `+224${digits}` : '';
}

// RBAC Helper: Chauffeurs module strictly accessible to Admin and Secrétariat Central
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
 * GET /api/drivers
 * Liste des chauffeurs enregistrés (indépendants des comptes utilisateurs)
 */
router.get('/', authenticateToken, isAuthorizedAdminOrSC, async (req, res) => {
  try {
    const { status, search, active_only } = req.query;

    let query = `
      SELECT 
        d.*,
        srv.name AS service_name,
        srv.code AS service_code
      FROM drivers d
      LEFT JOIN services srv ON d.service_id = srv.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND d.status = ?`;
      params.push(status);
    }

    if (active_only === 'true') {
      query += ` AND d.status = 'ACTIF'`;
    }

    if (search) {
      const term = `%${search.trim()}%`;
      query += ` AND (
        d.nom LIKE ? 
        OR d.prenoms LIKE ? 
        OR d.telephone LIKE ? 
        OR d.matricule LIKE ?
        OR d.license_number LIKE ?
      )`;
      params.push(term, term, term, term, term);
    }

    query += ` ORDER BY d.nom ASC, d.prenoms ASC`;

    const drivers = await db.all(query, params);

    const formatted = drivers.map(d => ({
      ...d,
      full_name: `${d.prenoms || ''} ${d.nom}`.trim()
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Erreur récupération chauffeurs:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des chauffeurs' });
  }
});

/**
 * GET /api/drivers/:id
 * Détail d'un chauffeur
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const driver = await db.get(`
      SELECT 
        d.*,
        srv.name AS service_name,
        srv.code AS service_code
      FROM drivers d
      LEFT JOIN services srv ON d.service_id = srv.id
      WHERE d.id = ?
    `, [id]);

    if (!driver) {
      return res.status(404).json({ error: 'Chauffeur introuvable' });
    }

    driver.full_name = `${driver.prenoms || ''} ${driver.nom}`.trim();
    res.json(driver);
  } catch (err) {
    console.error('Erreur récupération chauffeur:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération du chauffeur' });
  }
});

/**
 * POST /api/drivers
 * Ajouter un chauffeur dans le système (sans compte utilisateur obligatoire)
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      matricule,
      nom,
      prenoms,
      telephone,
      license_number,
      service_id,
      status,
      notes
    } = req.body;

    if (!nom || !nom.trim()) {
      return res.status(400).json({ error: 'Le nom du chauffeur est obligatoire' });
    }
    if (!prenoms || !prenoms.trim()) {
      return res.status(400).json({ error: 'Le prénom du chauffeur est obligatoire' });
    }
    if (!telephone || !telephone.trim()) {
      return res.status(400).json({ error: 'Le numéro de téléphone est obligatoire' });
    }

    const cleanPhone = formatGuineaPhone(telephone);
    const cleanNom = nom.trim().toUpperCase();
    const cleanPrenoms = prenoms.trim();

    // Vérifier si matricule unique s'il est renseigné
    if (matricule && matricule.trim()) {
      const existingMat = await db.get('SELECT id FROM drivers WHERE matricule = ?', [matricule.trim().toUpperCase()]);
      if (existingMat) {
        return res.status(400).json({ error: `Un chauffeur avec le matricule ${matricule.trim().toUpperCase()} existe déjà` });
      }
    }

    const result = await db.run(`
      INSERT INTO drivers (
        matricule,
        nom,
        prenoms,
        telephone,
        license_number,
        service_id,
        status,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      matricule ? matricule.trim().toUpperCase() : null,
      cleanNom,
      cleanPrenoms,
      cleanPhone,
      license_number ? license_number.trim() : null,
      service_id || null,
      status || 'ACTIF',
      (notes || '').trim()
    ]);

    await logAuditAction(req.user?.id, 'CREATE_DRIVER', `Enregistrement chauffeur: ${cleanPrenoms} ${cleanNom} (${cleanPhone})`);

    const created = await db.get('SELECT * FROM drivers WHERE id = ?', [result.lastID]);
    created.full_name = `${created.prenoms || ''} ${created.nom}`.trim();

    res.status(201).json(created);
  } catch (err) {
    console.error('Erreur création chauffeur:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la création du chauffeur' });
  }
});

/**
 * PUT /api/drivers/:id
 * Modifier un chauffeur
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      matricule,
      nom,
      prenoms,
      telephone,
      license_number,
      service_id,
      status,
      notes
    } = req.body;

    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return res.status(404).json({ error: 'Chauffeur introuvable' });
    }

    const cleanNom = nom !== undefined ? (nom || '').trim().toUpperCase() : driver.nom;
    const cleanPrenoms = prenoms !== undefined ? (prenoms || '').trim() : driver.prenoms;
    const cleanPhone = telephone !== undefined ? formatGuineaPhone(telephone) : driver.telephone;

    if (matricule && matricule.trim() && matricule.trim().toUpperCase() !== driver.matricule) {
      const existingMat = await db.get('SELECT id FROM drivers WHERE matricule = ? AND id != ?', [matricule.trim().toUpperCase(), id]);
      if (existingMat) {
        return res.status(400).json({ error: `Le matricule ${matricule.trim().toUpperCase()} est déjà utilisé par un autre chauffeur` });
      }
    }

    await db.run(`
      UPDATE drivers SET
        matricule = ?,
        nom = ?,
        prenoms = ?,
        telephone = ?,
        license_number = ?,
        service_id = ?,
        status = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      matricule !== undefined ? (matricule ? matricule.trim().toUpperCase() : null) : driver.matricule,
      cleanNom,
      cleanPrenoms,
      cleanPhone,
      license_number !== undefined ? (license_number ? license_number.trim() : null) : driver.license_number,
      service_id !== undefined ? (service_id || null) : driver.service_id,
      status || driver.status,
      notes !== undefined ? (notes || '').trim() : driver.notes,
      id
    ]);

    await logAuditAction(req.user?.id, 'UPDATE_DRIVER', `Modification chauffeur: ${cleanPrenoms} ${cleanNom} (ID: ${id})`);

    const updated = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    updated.full_name = `${updated.prenoms || ''} ${updated.nom}`.trim();

    res.json(updated);
  } catch (err) {
    console.error('Erreur mise à jour chauffeur:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la mise à jour du chauffeur' });
  }
});

/**
 * PUT /api/drivers/:id/status
 * Toggle driver active status (Strictly Admin)
 */
router.put('/:id/status', authenticateToken, isAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['ACTIF', 'INACTIF'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide (ACTIF ou INACTIF requis)' });
    }
    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return res.status(404).json({ error: 'Chauffeur introuvable' });
    }
    await db.run('UPDATE drivers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
    await logAuditAction(req.user?.id, 'TOGGLE_DRIVER_STATUS', `Statut chauffeur ${driver.prenoms} ${driver.nom} changé à ${status} (ID: ${id})`);
    res.json({ message: 'Statut mis à jour avec succès', id, status });
  } catch (err) {
    console.error('Erreur changement statut chauffeur:', err);
    res.status(500).json({ error: 'Erreur serveur lors du changement de statut' });
  }
});

/**
 * DELETE /api/drivers/:id
 * Suppression ou désactivation d'un chauffeur (Strictly Admin)
 */
router.delete('/:id', authenticateToken, isAdminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    const driver = await db.get('SELECT * FROM drivers WHERE id = ?', [id]);
    if (!driver) {
      return res.status(404).json({ error: 'Chauffeur introuvable' });
    }

    if (permanent === 'true') {
      // Nettoyer les références dans les véhicules
      try {
        await db.run('UPDATE vehicles SET default_driver_id = NULL WHERE default_driver_id = ?', [id]);
      } catch (e) {
        console.warn('Notice déconnexion chauffeur véhicules:', e.message);
      }

      // Nettoyer les références dans les ordres de mission
      try {
        await db.run('UPDATE mission_orders SET driver_id = NULL WHERE driver_id = ?', [id]);
      } catch (e) {
        console.warn('Notice déconnexion chauffeur ordres de mission:', e.message);
      }

      await db.run('DELETE FROM drivers WHERE id = ?', [id]);
      await logAuditAction(req.user?.id, 'DELETE_DRIVER', `Suppression définitive chauffeur ${driver.prenoms} ${driver.nom} (ID: ${id})`);

      return res.json({ message: 'Chauffeur supprimé définitivement avec succès', id, deleted: true });
    }

    await db.run(`UPDATE drivers SET status = 'INACTIF', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);

    await logAuditAction(req.user?.id, 'DEACTIVATE_DRIVER', `Désactivation chauffeur ${driver.prenoms} ${driver.nom} (ID: ${id})`);

    res.json({ message: 'Chauffeur désactivé avec succès', id, status: 'INACTIF' });
  } catch (err) {
    console.error('Erreur suppression/désactivation chauffeur:', err);
    res.status(500).json({ error: 'Erreur serveur lors de l’opération sur le chauffeur' });
  }
});

module.exports = router;
