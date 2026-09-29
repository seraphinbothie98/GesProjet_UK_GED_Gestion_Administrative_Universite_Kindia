const db = require('../database/db');

/**
 * Assignment Service (Gestion des Postes, Affectations, Mutations & Historique Professionnel)
 * Université de Kindia (UK-GED)
 */
class AssignmentService {

  /**
   * Vérifie si un poste est disponible (VACANT) ou déjà occupé (OCCUPÉ).
   * @param {number} positionId - ID du poste
   * @param {number|null} excludeStaffId - ID du membre du personnel à exclure de la vérification
   */
  async checkPositionAvailability(positionId, excludeStaffId = null) {
    if (!positionId) return { isAvailable: true, position: null };

    const position = await db.get('SELECT * FROM positions WHERE id = ?', [Number(positionId)]);
    if (!position) {
      throw new Error(`Poste introuvable (ID: ${positionId})`);
    }

    // Si le poste n'est pas à titulaire unique, il est toujours disponible
    if (position.is_unique === 0) {
      return { isAvailable: true, isUnique: false, position };
    }

    // Recherche d'une affectation active pour ce poste
    let sql = `
      SELECT sa.id as assignment_id, sa.staff_id, sa.start_date, sa.status,
             st.nom, st.prenoms, st.matricule, st.email, st.telephone, st.user_id,
             srv.name as service_name, srv.code as service_code
      FROM staff_assignments sa
      JOIN staff st ON sa.staff_id = st.id
      LEFT JOIN services srv ON sa.service_id = srv.id
      WHERE sa.position_id = ? AND sa.status = 'ACTIVE' AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE)
        AND st.status = 'ACTIF'
    `;
    const params = [Number(positionId)];

    if (excludeStaffId) {
      sql += ' AND sa.staff_id != ?';
      params.push(Number(excludeStaffId));
    }

    const activeOccupant = await db.get(sql, params);

    if (activeOccupant) {
      return {
        isAvailable: false,
        is_occupied: true,
        isUnique: true,
        position,
        occupant: {
          assignment_id: activeOccupant.assignment_id,
          staff_id: activeOccupant.staff_id,
          user_id: activeOccupant.user_id,
          nom: activeOccupant.nom,
          prenoms: activeOccupant.prenoms,
          full_name: `${activeOccupant.prenoms} ${activeOccupant.nom}`.trim(),
          matricule: activeOccupant.matricule,
          email: activeOccupant.email,
          service_name: activeOccupant.service_name,
          start_date: activeOccupant.start_date
        }
      };
    }

    return {
      isAvailable: true,
      is_occupied: false,
      isUnique: true,
      position,
      occupant: null
    };
  }

  /**
   * Affecte un personnel à un poste (Création d'affectation, Mutation, Promotion)
   */
  async assignStaffToPosition(payload) {
    const staffId = payload.staffId || payload.staff_id;
    const positionId = payload.positionId || payload.position_id;
    const serviceId = payload.serviceId !== undefined ? payload.serviceId : payload.service_id;
    const startDate = payload.startDate || payload.start_date;
    const motive = payload.motive || payload.notes;
    const appointmentActRef = payload.appointmentActRef || payload.reference_decision || payload.appointment_act_ref;
    const createdByUserId = payload.createdByUserId || payload.created_by_user_id || null;

    if (!staffId) throw new Error('Identifiant du personnel obligatoire.');
    if (!positionId) throw new Error('Identifiant du poste obligatoire.');

    const staff = await db.get('SELECT * FROM staff WHERE id = ?', [Number(staffId)]);
    if (!staff) throw new Error('Membre du personnel introuvable.');

    const position = await db.get('SELECT * FROM positions WHERE id = ?', [Number(positionId)]);
    if (!position) throw new Error('Poste introuvable.');

    const effectiveStartDate = startDate || new Date().toISOString().split('T')[0];
    const targetServiceId = serviceId !== undefined && serviceId !== null && serviceId !== '' ? Number(serviceId) : position.service_id;

    // 1. Vérifier la vacance du poste s'il est unique
    const check = await this.checkPositionAvailability(positionId, staffId);
    if (!check.isAvailable && check.occupant) {
      throw new Error(
        `Ce poste est déjà occupé par une autre personne : ${check.occupant.full_name} (Matricule: ${check.occupant.matricule || 'N/A'}). ` +
        `Pour affecter ${staff.prenoms} ${staff.nom}, veuillez d'abord mettre fin à l'affectation active du titulaire actuel.`
      );
    }

    // 2. Clôturer l'ancienne affectation active de cette personne (sans écraser l'historique)
    const activeAssignment = await db.get(
      'SELECT id, position_id, service_id FROM staff_assignments WHERE staff_id = ? AND status = "ACTIVE"',
      [Number(staffId)]
    );

    if (activeAssignment) {
      await db.run(
        `UPDATE staff_assignments 
         SET status = 'MUTATED', end_date = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [effectiveStartDate, activeAssignment.id]
      );
    }

    // 3. Créer la nouvelle affectation
    const result = await db.run(
      `INSERT INTO staff_assignments (
         staff_id, position_id, service_id, start_date, end_date, status, motive, appointment_act_ref, created_by
       ) VALUES (?, ?, ?, ?, NULL, 'ACTIVE', ?, ?, ?)`,
      [
        Number(staffId),
        Number(positionId),
        targetServiceId || null,
        effectiveStartDate,
        motive || (activeAssignment ? 'Mutation / Changement de poste' : 'Affectation initiale'),
        appointmentActRef || null,
        createdByUserId || null
      ]
    );

    const newAssignmentId = result.lastID;

    // 4. Mettre à jour les dénormalisations de commodité sur la table staff
    const effectiveFonction = (payload.fonction && String(payload.fonction).trim()) 
      || (payload.function_title && String(payload.function_title).trim()) 
      || position.title;

    await db.run(
      `UPDATE staff SET fonction = ?, service_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [effectiveFonction, targetServiceId || null, Number(staffId)]
    );

    // 5. Synchroniser le compte utilisateur lié s'il existe (SANS recréer de compte ni changer d'ID)
    if (staff.user_id) {
      const staffRecord = await db.get('SELECT titre FROM staff WHERE id = ?', [Number(staffId)]);
      const titreToSync = staffRecord?.titre || staff.titre;

      await db.run(
        `UPDATE users SET function_title = ?, service_id = ?, titre = COALESCE(?, titre), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [effectiveFonction, targetServiceId || null, titreToSync || null, Number(staff.user_id)]
      );

      // Si le poste correspond à un service institutionnel (ex: Direction ou Chef de Service),
      // synchroniser également service_heads_history si applicable
      if (position.code === 'RECTEUR' || position.code === 'SECRETARIAT_GENERAL' || position.is_unique === 1) {
        if (targetServiceId) {
          await db.run(
            `UPDATE services SET head_user_id = ?, function_title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [Number(staff.user_id), effectiveFonction, targetServiceId]
          );

          await db.run(
            `UPDATE service_heads_history SET is_current = 0, end_date = ? WHERE service_id = ? AND is_current = 1 AND user_id != ?`,
            [effectiveStartDate, targetServiceId, Number(staff.user_id)]
          );

          const existingShh = await db.get(
            `SELECT id FROM service_heads_history WHERE service_id = ? AND user_id = ? AND is_current = 1`,
            [targetServiceId, Number(staff.user_id)]
          );

          if (!existingShh) {
            await db.run(
              `INSERT INTO service_heads_history (service_id, user_id, function_title, start_date, is_current, appointment_act_ref)
               VALUES (?, ?, ?, ?, 1, ?)`,
              [targetServiceId, Number(staff.user_id), position.title, effectiveStartDate, appointmentActRef || null]
            );
          }
        }
      }
    }

    return {
      success: true,
      assignment_id: newAssignmentId,
      position: position.title,
      service_id: targetServiceId,
      start_date: effectiveStartDate
    };
  }

  /**
   * Met fin à une affectation active (Le poste redevient VACANT, l'historique est conservé).
   */
  async terminateAssignment(arg1, arg2 = {}) {
    let staffId = null;
    let assignmentId = null;
    let endDate = null;
    let motive = null;

    if (typeof arg1 === 'object' && arg1 !== null) {
      staffId = arg1.staffId || arg1.staff_id;
      assignmentId = arg1.assignmentId || arg1.assignment_id;
      endDate = arg1.endDate || arg1.end_date;
      motive = arg1.motive || arg1.notes;
    } else {
      assignmentId = arg1;
      endDate = arg2.endDate || arg2.end_date;
      motive = arg2.motive || arg2.notes;
    }

    const effectiveEndDate = endDate || new Date().toISOString().split('T')[0];

    let targetAssignment = null;
    if (assignmentId) {
      targetAssignment = await db.get(
        'SELECT * FROM staff_assignments WHERE id = ?',
        [Number(assignmentId)]
      );
    } else if (staffId) {
      targetAssignment = await db.get(
        'SELECT * FROM staff_assignments WHERE staff_id = ? AND status = "ACTIVE"',
        [Number(staffId)]
      );
    }

    if (!targetAssignment) {
      throw new Error('Aucune affectation active trouvée pour ce personnel.');
    }

    await db.run(
      `UPDATE staff_assignments 
       SET status = 'TERMINATED', end_date = ?, motive = COALESCE(?, motive), updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [effectiveEndDate, motive || 'Fin d’affectation / Libération du poste', targetAssignment.id]
    );

    // Si le personnel était responsable de service, libérer le poste dans services
    const resolvedStaffId = targetAssignment.staff_id;
    const staff = await db.get('SELECT user_id FROM staff WHERE id = ?', [Number(resolvedStaffId)]);
    if (staff && staff.user_id && targetAssignment.service_id) {
      const srv = await db.get('SELECT head_user_id FROM services WHERE id = ?', [targetAssignment.service_id]);
      if (srv && Number(srv.head_user_id) === Number(staff.user_id)) {
        await db.run('UPDATE services SET head_user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [targetAssignment.service_id]);
        await db.run(
          'UPDATE service_heads_history SET is_current = 0, end_date = ? WHERE service_id = ? AND user_id = ? AND is_current = 1',
          [effectiveEndDate, targetAssignment.service_id, staff.user_id]
        );
      }
    }

    return { 
      success: true, 
      message: 'Affectation terminée avec succès. Le poste est désormais VACANT.',
      assignment_id: targetAssignment.id,
      end_date: effectiveEndDate
    };
  }

  /**
   * Enregistre un événement de carrière officiel (Retraite, Limogeage, Suspension, Mutation, Réintégration)
   * avec synchronisation atomique du dossier Personnel, des Affectations et du Compte Utilisateur.
   */
  async recordCareerEvent(payload) {
    const staff_id = payload.staff_id || payload.staffId;
    const event_type = (payload.event_type || payload.eventType || '').toUpperCase();
    const effective_date = payload.effective_date || payload.effectiveDate || payload.date;
    const position_id = payload.position_id || payload.positionId;
    const service_id = payload.service_id !== undefined ? payload.service_id : payload.serviceId;
    const motive = payload.motive || payload.notes;
    const reference_decision = payload.reference_decision || payload.appointment_act_ref || payload.act_ref;
    const created_by_user_id = payload.created_by_user_id || payload.createdByUserId || null;

    if (!staff_id) throw new Error('Identifiant du personnel obligatoire.');
    if (!event_type) throw new Error('Type d\'événement de carrière obligatoire.');

    const staff = await db.get('SELECT * FROM staff WHERE id = ?', [Number(staff_id)]);
    if (!staff) throw new Error('Membre du personnel introuvable.');

    const dateStr = effective_date || new Date().toISOString().split('T')[0];

    if (event_type === 'MUTATION') {
      if (!position_id) throw new Error('Le nouveau poste est obligatoire pour une mutation.');
      return await this.assignStaffToPosition({
        staffId: staff_id,
        positionId: position_id,
        serviceId: service_id,
        startDate: dateStr,
        motive: motive || 'Mutation de service',
        appointmentActRef: reference_decision,
        createdByUserId: created_by_user_id
      });
    }

    if (event_type === 'RETRAITE') {
      // 1. Clôturer l'affectation active
      await this.terminateAssignment({
        staffId: staff_id,
        endDate: dateStr,
        motive: motive || `Départ à la retraite (Réf: ${reference_decision || 'N/A'})`
      }).catch(() => {});

      // 2. Mettre à jour le statut du personnel
      await db.run(
        `UPDATE staff SET status = 'RETRAITÉ', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Number(staff_id)]
      );

      // 3. Désactiver le compte utilisateur lié
      if (staff.user_id) {
        await db.run(
          `UPDATE users SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [Number(staff.user_id)]
        );
      }

      return {
        success: true,
        event_type: 'RETRAITE',
        message: `${staff.prenoms} ${staff.nom} est désormais enregistré comme RETRAITÉ. Son compte d'accès a été désactivé et son poste libéré.`
      };
    }

    if (event_type === 'LIMOGEAGE' || event_type === 'FIN_FONCTION' || event_type === 'REVOCATION') {
      // 1. Clôturer l'affectation active avec motif
      await this.terminateAssignment({
        staffId: staff_id,
        endDate: dateStr,
        motive: motive || `Fin de fonction / Révocation (Acte: ${reference_decision || 'Décision Rectorale/Ministérielle'})`
      }).catch(() => {});

      // 2. Mettre à jour le statut du personnel
      await db.run(
        `UPDATE staff SET status = 'INACTIF', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Number(staff_id)]
      );

      // 3. Désactiver le compte utilisateur
      if (staff.user_id) {
        await db.run(
          `UPDATE users SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [Number(staff.user_id)]
        );
      }

      return {
        success: true,
        event_type: 'LIMOGEAGE',
        message: `Fin de fonction enregistrée pour ${staff.prenoms} ${staff.nom}. Le poste a été libéré (VACANT) et le compte utilisateur désactivé.`
      };
    }

    if (event_type === 'SUSPENSION') {
      await this.terminateAssignment({
        staffId: staff_id,
        endDate: dateStr,
        motive: motive || `Suspension administrative (Réf: ${reference_decision || 'N/A'})`
      }).catch(() => {});

      await db.run(
        `UPDATE staff SET status = 'SUSPENDU', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Number(staff_id)]
      );

      if (staff.user_id) {
        await db.run(
          `UPDATE users SET status = 'INACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [Number(staff.user_id)]
        );
      }

      return {
        success: true,
        event_type: 'SUSPENSION',
        message: `${staff.prenoms} ${staff.nom} a été marqué comme SUSPENDU. Les accès au système sont révoqués.`
      };
    }

    if (event_type === 'REINTEGRATION') {
      await db.run(
        `UPDATE staff SET status = 'ACTIF', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [Number(staff_id)]
      );

      if (staff.user_id) {
        await db.run(
          `UPDATE users SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [Number(staff.user_id)]
        );
      }

      return {
        success: true,
        event_type: 'REINTEGRATION',
        message: `${staff.prenoms} ${staff.nom} a été réintégré avec succès avec le statut ACTIF. Vous pouvez maintenant lui assigner une nouvelle affectation.`
      };
    }

    throw new Error(`Type d'événement non reconnu : ${event_type}`);
  }

  /**
   * Récupère tout l'historique professionnel (parcours) d'un membre du personnel.
   */
  async getStaffCareerHistory(staffId) {
    return await db.all(
      `SELECT sa.id, sa.staff_id, sa.position_id, sa.service_id, sa.start_date, sa.end_date, sa.status, sa.motive, sa.appointment_act_ref, sa.created_at,
              p.code as position_code, p.title as position_title, p.category as position_category, p.is_unique,
              s.name as service_name, s.code as service_code, s.structure_type
       FROM staff_assignments sa
       JOIN positions p ON sa.position_id = p.id
       LEFT JOIN services s ON sa.service_id = s.id
       WHERE sa.staff_id = ?
       ORDER BY sa.start_date DESC, sa.id DESC`,
      [Number(staffId)]
    );
  }

  /**
   * Récupère la liste de tous les postes avec leur statut d'occupation (VACANT / OCCUPÉ)
   */
  async getAllPositionsWithOccupancy(filters = {}) {
    const { category, service_id, status } = filters;
    let sql = `
      SELECT p.id, p.code, p.title, p.service_id, p.is_unique, p.category, p.description, p.status, p.created_at,
             s.name as service_name, s.code as service_code,
             sa.id as active_assignment_id, sa.start_date as occupied_since,
             st.id as holder_staff_id, st.nom as holder_nom, st.prenoms as holder_prenoms, st.matricule as holder_matricule, st.telephone as holder_telephone, st.email as holder_email, st.user_id as holder_user_id,
             CASE 
               WHEN sa.id IS NOT NULL AND st.id IS NOT NULL THEN 'OCCUPE'
               ELSE 'VACANT'
             END as occupancy_status
      FROM positions p
      LEFT JOIN services s ON p.service_id = s.id
      LEFT JOIN staff_assignments sa ON p.id = sa.position_id AND sa.status = 'ACTIVE' AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE)
      LEFT JOIN staff st ON sa.staff_id = st.id AND st.status = 'ACTIF'
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      sql += ' AND p.category = ?';
      params.push(category);
    }
    if (service_id) {
      sql += ' AND p.service_id = ?';
      params.push(Number(service_id));
    }
    if (status) {
      sql += ' AND p.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY p.is_unique DESC, p.title ASC';

    const positions = await db.all(sql, params);
    return positions.map(pos => {
      const isOccupied = pos.occupancy_status === 'OCCUPE' || Boolean(pos.active_assignment_id);
      const fullName = pos.holder_nom ? `${pos.holder_prenoms || ''} ${pos.holder_nom}`.trim() : null;
      return {
        ...pos,
        is_occupied: isOccupied,
        holder_full_name: fullName,
        occupant_name: fullName,
        occupant_matricule: pos.holder_matricule || null
      };
    });
  }
}

module.exports = new AssignmentService();
