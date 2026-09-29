/**
 * Migration 023: Sync Users and Staff Titles & Grades
 * Université de Kindia (UK-GED)
 */
module.exports = {
  name: '023_sync_users_and_staff_titles',

  async up(db) {
    // 1. Sync users.titre from staff.titre where staff.titre is present and non-empty
    const staffList = await db.all("SELECT id, user_id, matricule, titre, fonction, prenoms, nom FROM staff WHERE titre IS NOT NULL AND titre != ''");
    for (const st of staffList) {
      if (st.user_id) {
        await db.run(
          "UPDATE users SET titre = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [st.titre.trim(), st.user_id]
        );
      } else if (st.matricule) {
        await db.run(
          "UPDATE users SET titre = ?, updated_at = CURRENT_TIMESTAMP WHERE matricule = ?",
          [st.titre.trim(), st.matricule.trim()]
        );
      }
    }

    // 2. Specific rectification for academic roles if titre is 'M.' or null
    const usersWithRoles = await db.all(`
      SELECT u.id, u.first_name, u.last_name, u.titre, u.email, r.code as role_code, p.title as pos_title, p.code as pos_code
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN staff st ON st.user_id = u.id
      LEFT JOIN staff_assignments sa ON sa.staff_id = st.id AND sa.status = 'ACTIVE'
      LEFT JOIN positions p ON sa.position_id = p.id
    `);

    for (const u of usersWithRoles) {
      let resolvedTitre = u.titre;
      const lowerLast = (u.last_name || '').toLowerCase();
      const lowerRole = (u.role_code || '').toLowerCase();
      const lowerPos = (u.pos_code || u.pos_title || '').toLowerCase();

      if (lowerRole.includes('recteur') || lowerPos.includes('recteur') || lowerLast.includes('zoumanigui')) {
        resolvedTitre = 'Pr';
      } else if (lowerRole.includes('secrétaire_général') || lowerRole.includes('secretariat_general') || lowerPos.includes('secrétaire général')) {
        if (!resolvedTitre || resolvedTitre === 'M.') resolvedTitre = 'Dr';
      }

      if (resolvedTitre && resolvedTitre !== u.titre) {
        await db.run("UPDATE users SET titre = ? WHERE id = ?", [resolvedTitre, u.id]);
        await db.run("UPDATE staff SET titre = ? WHERE user_id = ?", [resolvedTitre, u.id]);
      }
    }
  },

  async down(db) {
    // Non-destructive rollback
  }
};
