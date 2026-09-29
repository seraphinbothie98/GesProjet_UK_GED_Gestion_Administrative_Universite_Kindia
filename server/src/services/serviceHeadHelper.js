const db = require('../database/db');

/**
 * Checks if a service already has an active Chef de Service / Responsable
 * Returns null if the post is VACANT, or the existing chef details if already occupied.
 */
async function checkExistingChefDeService(serviceId, excludeStaffId = null, excludeUserId = null) {
  if (!serviceId) return null;

  // Resolve linked user_id if only excludeStaffId is provided
  if (excludeStaffId && !excludeUserId) {
    const staffRec = await db.get('SELECT user_id FROM staff WHERE id = ?', [excludeStaffId]);
    if (staffRec && staffRec.user_id) {
      excludeUserId = staffRec.user_id;
    }
  }

  // Resolve linked staff_id if only excludeUserId is provided
  if (excludeUserId && !excludeStaffId) {
    const userStaff = await db.get('SELECT id FROM staff WHERE user_id = ?', [excludeUserId]);
    if (userStaff && userStaff.id) {
      excludeStaffId = userStaff.id;
    }
  }

  // 1. Check in staff_assignments for active assignments on unique chef/head positions
  try {
    let assignSql = `
      SELECT sa.id as assignment_id, sa.staff_id, sa.start_date, sa.service_id,
             st.nom, st.prenoms, st.matricule, st.email, st.user_id,
             p.title as function_title, s.name as service_name
      FROM staff_assignments sa
      JOIN staff st ON sa.staff_id = st.id
      JOIN positions p ON sa.position_id = p.id
      JOIN services s ON sa.service_id = s.id
      WHERE sa.service_id = ? 
        AND sa.status = 'ACTIVE' 
        AND (sa.end_date IS NULL OR sa.end_date >= CURRENT_DATE)
        AND st.status = 'ACTIF'
        AND (
          p.is_unique = 1 
          OR p.code LIKE 'CHEF_%' 
          OR p.code LIKE 'DOYEN_%' 
          OR p.code = 'RECTEUR' 
          OR p.code = 'SECRETARIAT_GENERAL' 
          OR p.code = 'DAF'
          OR LOWER(p.title) LIKE 'chef de service%'
          OR LOWER(p.title) LIKE 'responsable de service%'
        )
    `;
    const assignParams = [Number(serviceId)];
    if (excludeStaffId) {
      assignSql += ' AND sa.staff_id != ?';
      assignParams.push(Number(excludeStaffId));
    }
    if (excludeUserId) {
      assignSql += ' AND (st.user_id IS NULL OR st.user_id != ?)';
      assignParams.push(Number(excludeUserId));
    }

    const activeAssignmentChef = await db.get(assignSql, assignParams);
    if (activeAssignmentChef) {
      return {
        ...activeAssignmentChef,
        first_name: activeAssignmentChef.prenoms,
        last_name: activeAssignmentChef.nom,
        chef_name: `${activeAssignmentChef.prenoms || ''} ${activeAssignmentChef.nom || ''}`.trim()
      };
    }
  } catch (err) {
    // If table not yet initialized or query fails, continue to fallback
  }

  // 2. Check services table head_user_id
  let srvSql = `
    SELECT s.id as service_id, s.name as service_name, s.head_user_id,
           u.id as user_id, u.first_name, u.last_name, u.email, u.matricule, u.function_title
    FROM services s
    JOIN users u ON s.head_user_id = u.id
    WHERE s.id = ? AND (u.status = 'ACTIVE' OR u.status IS NULL)
  `;
  const srvParams = [Number(serviceId)];
  if (excludeUserId) {
    srvSql += ' AND u.id != ?';
    srvParams.push(Number(excludeUserId));
  }
  const srvChef = await db.get(srvSql, srvParams);
  if (srvChef) {
    return {
      ...srvChef,
      chef_name: `${srvChef.first_name || ''} ${srvChef.last_name || ''}`.trim()
    };
  }

  return null;
}

/**
 * Synchronizes service head assignment in services table and service_heads_history.
 * If user is designated chef:
 *   - Updates service's head_user_id and function_title
 *   - Inserts/updates service_heads_history
 * If user was head of a previous service and moved/demoted:
 *   - Clears head_user_id from previous service and closes history
 */
async function syncServiceChefAssignment({ serviceId, userId, fonctionTitle, isChef, previousServiceId = null, previousUserId = null }) {
  const targetUserId = userId || previousUserId;
  const numServiceId = serviceId ? Number(serviceId) : null;
  const numPrevServiceId = previousServiceId ? Number(previousServiceId) : null;

  // 1. If user is designated chef for this service
  if (isChef && numServiceId && targetUserId) {
    const cleanFunction = fonctionTitle || 'Chef de Service';

    // Close any previous active head record for this service if different user
    await db.run(
      `UPDATE service_heads_history 
       SET is_current = 0, end_date = CURRENT_DATE 
       WHERE service_id = ? AND is_current = 1 AND user_id != ?`,
      [numServiceId, targetUserId]
    );

    // Check if current history record exists for this user in this service
    const existingHist = await db.get(
      `SELECT id FROM service_heads_history WHERE service_id = ? AND user_id = ? AND is_current = 1`,
      [numServiceId, targetUserId]
    );

    if (!existingHist) {
      await db.run(
        `INSERT INTO service_heads_history (service_id, user_id, function_title, start_date, is_current)
         VALUES (?, ?, ?, CURRENT_DATE, 1)`,
        [numServiceId, targetUserId, cleanFunction]
      );
    } else {
      await db.run(
        `UPDATE service_heads_history SET function_title = ? WHERE id = ?`,
        [cleanFunction, existingHist.id]
      );
    }

    // Update services table
    await db.run(
      `UPDATE services SET head_user_id = ?, function_title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [targetUserId, cleanFunction, numServiceId]
    );
  }

  // 2. If user changed service or is no longer chef, vacate previous service if they were head
  if (numPrevServiceId && (numPrevServiceId !== numServiceId || !isChef) && targetUserId) {
    const prevSrv = await db.get('SELECT head_user_id FROM services WHERE id = ?', [numPrevServiceId]);
    if (prevSrv && Number(prevSrv.head_user_id) === Number(targetUserId)) {
      await db.run(
        `UPDATE services SET head_user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [numPrevServiceId]
      );
      await db.run(
        `UPDATE service_heads_history 
         SET is_current = 0, end_date = CURRENT_DATE 
         WHERE service_id = ? AND user_id = ? AND is_current = 1`,
        [numPrevServiceId, targetUserId]
      );
    }
  }
}

module.exports = {
  checkExistingChefDeService,
  syncServiceChefAssignment
};
