/**
 * Migration 011: Unification & Synchronization of Users (Admin) & Personnel (Staff) Directories
 * Université de Kindia (UK-GED)
 */

module.exports = {
  version: '011',
  name: 'sync_users_and_staff',

  async up(db) {
    // 1. Add user_id column to staff table if missing
    const staffCols = (await db.all('PRAGMA table_info(staff)')).map(c => c.name);
    if (!staffCols.includes('user_id')) {
      await db.run('ALTER TABLE staff ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    }

    // 2. Create index for fast lookups
    await db.run('CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id)');

    // 3. Reconcile existing staff records with users
    const unlinkedStaff = await db.all('SELECT * FROM staff WHERE user_id IS NULL');
    for (const st of unlinkedStaff) {
      let matchedUser = null;
      if (st.matricule && st.matricule.trim()) {
        matchedUser = await db.get('SELECT id FROM users WHERE matricule = ?', [st.matricule.trim()]);
      }
      if (!matchedUser && st.email && st.email.trim()) {
        matchedUser = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [st.email.trim()]);
      }
      if (!matchedUser && st.nom && st.prenoms) {
        matchedUser = await db.get(
          'SELECT id FROM users WHERE (LOWER(last_name) = LOWER(?) AND LOWER(first_name) = LOWER(?)) OR (LOWER(last_name) = LOWER(?) AND LOWER(first_name) = LOWER(?))',
          [st.nom.trim(), st.prenoms.trim(), st.prenoms.trim(), st.nom.trim()]
        );
      }

      if (matchedUser) {
        await db.run('UPDATE staff SET user_id = ? WHERE id = ?', [matchedUser.id, st.id]);
      }
    }

    // 4. Ensure all users have a corresponding staff record
    const users = await db.all('SELECT * FROM users');
    for (const u of users) {
      const existingStaff = await db.get(
        'SELECT id FROM staff WHERE user_id = ? OR (matricule IS NOT NULL AND matricule = ?) OR (email IS NOT NULL AND email != "" AND LOWER(email) = LOWER(?))',
        [u.id, u.matricule, u.email]
      );

      if (!existingStaff) {
        await db.run(
          `INSERT INTO staff (user_id, matricule, nom, prenoms, nationality, fonction, service_id, telephone, email, status, is_driver)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            u.id,
            u.matricule || null,
            (u.last_name || '').toUpperCase().trim(),
            (u.first_name || '').trim(),
            'Guinéenne',
            u.function_title || 'Personnel',
            u.service_id || null,
            u.phone || '',
            u.email || '',
            u.status === 'INACTIVE' ? 'INACTIF' : 'ACTIF'
          ]
        );
      } else {
        // Link user_id if not already linked
        await db.run('UPDATE staff SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id != ?)', [u.id, existingStaff.id, u.id]);
      }
    }
  },

  async down(db) {
    // Reversible: set user_id to NULL if rolling back
    try {
      await db.run('UPDATE staff SET user_id = NULL');
    } catch (e) {}
  }
};
