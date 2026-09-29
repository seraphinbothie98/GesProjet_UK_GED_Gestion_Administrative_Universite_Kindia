/**
 * Migration 021: Normalize Academic Grades & Titles for all System Accounts & Staff
 * Université de Kindia (UK-GED)
 */
module.exports = {
  name: '021_normalize_academic_grades_and_titles',

  async up(db) {
    // 1. Ensure 'titre' column exists on users table
    const userColumns = await db.all('PRAGMA table_info(users)');
    const hasUserTitre = userColumns.some(c => c.name === 'titre');
    if (!hasUserTitre) {
      await db.run("ALTER TABLE users ADD COLUMN titre TEXT DEFAULT 'M.'");
    }

    // 2. Ensure 'titre' column exists on staff table
    const staffColumns = await db.all('PRAGMA table_info(staff)');
    const hasStaffTitre = staffColumns.some(c => c.name === 'titre');
    if (!hasStaffTitre) {
      await db.run("ALTER TABLE staff ADD COLUMN titre TEXT DEFAULT 'M.'");
    }

    // 3. Helper to clean prefix from first names and extract normalized title
    function parseTitleAndName(rawTitle, rawFirstName) {
      let title = rawTitle ? rawTitle.trim() : '';
      let firstName = rawFirstName ? rawFirstName.trim() : '';

      const match = firstName.match(/^(Prof\.|Professeur|Pr\s+Titulaire|Pr\.|Pr|Docteure|Dre\.|Dre|Docteur|Dr\.|Dr|Madame|Mme\.|Mme|Mademoiselle|Mlle\.|Mlle|Monsieur|M\.|Ing\.|MCF|MA)\s+(.*)$/i);
      if (match) {
        const prefix = match[1];
        firstName = match[2].trim();

        if (/^Prof/i.test(prefix) || /^Pr/i.test(prefix)) {
          title = prefix.toLowerCase().includes('titulaire') ? 'Pr Titulaire' : 'Pr';
        } else if (/^Dre/i.test(prefix) || /^Docteure/i.test(prefix)) {
          title = 'Dre';
        } else if (/^Dr/i.test(prefix) || /^Docteur/i.test(prefix)) {
          title = 'Dr';
        } else if (/^Mme/i.test(prefix) || /^Madame/i.test(prefix)) {
          title = 'Mme';
        } else if (/^Mlle/i.test(prefix) || /^Mademoiselle/i.test(prefix)) {
          title = 'Mlle';
        } else if (/^M\./i.test(prefix) || /^Monsieur/i.test(prefix)) {
          title = 'M.';
        } else if (/^Ing/i.test(prefix)) {
          title = 'Ing.';
        }
      }

      if (!title) title = 'M.';
      return { title, firstName };
    }

    // 4. Update and normalize existing users
    const allUsers = await db.all('SELECT id, first_name, last_name, email, matricule, titre, function_title FROM users');
    for (const u of allUsers) {
      let { title, firstName } = parseTitleAndName(u.titre, u.first_name);

      // Specific known academic/institutional assignments
      const lowerLast = (u.last_name || '').toLowerCase();
      const lowerFirst = (firstName || '').toLowerCase();
      const lowerEmail = (u.email || '').toLowerCase();

      if (lowerLast.includes('zoumanigui') || lowerEmail.includes('recteur')) {
        title = 'Pr';
      } else if (lowerLast.includes('bah') && (lowerFirst.includes('mariame') || lowerEmail.includes('bio001'))) {
        title = 'Dre';
      } else if (lowerLast.includes('bah') && (lowerFirst.includes('boubacar') || lowerEmail.includes('doyen_fs'))) {
        title = 'Pr';
      } else if (lowerLast.includes('doumbouya') && (lowerFirst.includes('billo') || lowerEmail.includes('sg@'))) {
        title = 'Dr';
      } else if (lowerLast.includes('diallo') && (lowerFirst.includes('gando') || lowerEmail.includes('chef_info'))) {
        title = 'Dr';
      } else if (lowerLast.includes('kourouma') && (lowerFirst.includes('sidiki') || lowerEmail.includes('doyen_fll'))) {
        title = 'Dr';
      } else if (lowerLast.includes('keita') && lowerFirst.includes('fode') && lowerEmail.includes('ciaq')) {
        title = 'Dr';
      } else if (lowerLast.includes('barry') && (lowerFirst.includes('samba') || lowerEmail.includes('vre'))) {
        title = 'Pr';
      } else if (lowerLast.includes('conde') && (lowerFirst.includes('youssouf') || lowerEmail.includes('vrr'))) {
        title = 'Pr';
      } else if (lowerLast.includes('sow') && lowerFirst.includes('thierno')) {
        title = 'Dr';
      } else if (lowerLast.includes('tenguiano')) {
        title = 'Dr';
      } else if (lowerLast.includes('sow') && lowerFirst.includes('kadiatou')) {
        title = 'Mme';
      } else if (lowerLast.includes('sylla') && lowerFirst.includes('mariama')) {
        title = 'Mme';
      } else if (lowerLast.includes('lamah') && lowerFirst.includes('marie')) {
        title = 'Mme';
      }

      await db.run(
        `UPDATE users SET titre = ?, first_name = ?, last_name = ? WHERE id = ?`,
        [title, firstName, (u.last_name || '').trim().toUpperCase(), u.id]
      );
    }

    // 5. Update and normalize staff table
    const allStaff = await db.all('SELECT id, prenoms, nom, email, matricule, titre, user_id FROM staff');
    for (const s of allStaff) {
      let { title, firstName } = parseTitleAndName(s.titre, s.prenoms);

      // If linked to user, sync title
      if (s.user_id) {
        const linkedUser = await db.get('SELECT titre FROM users WHERE id = ?', [s.user_id]);
        if (linkedUser && linkedUser.titre) {
          title = linkedUser.titre;
        }
      } else {
        const lowerLast = (s.nom || '').toLowerCase();
        const lowerFirst = (firstName || '').toLowerCase();
        if (lowerLast.includes('zoumanigui')) title = 'Pr';
        else if (lowerLast.includes('bah') && lowerFirst.includes('mariame')) title = 'Dre';
        else if (lowerLast.includes('bah') && lowerFirst.includes('boubacar')) title = 'Pr';
        else if (lowerLast.includes('doumbouya') && lowerFirst.includes('billo')) title = 'Dr';
        else if (lowerLast.includes('diallo') && lowerFirst.includes('gando')) title = 'Dr';
        else if (lowerLast.includes('kourouma') && lowerFirst.includes('sidiki')) title = 'Dr';
        else if (lowerLast.includes('keita') && lowerFirst.includes('fode')) title = 'Dr';
        else if (lowerLast.includes('barry') && lowerFirst.includes('samba')) title = 'Pr';
        else if (lowerLast.includes('conde') && lowerFirst.includes('youssouf')) title = 'Pr';
      }

      await db.run(
        `UPDATE staff SET titre = ?, prenoms = ?, nom = ? WHERE id = ?`,
        [title, firstName, (s.nom || '').trim().toUpperCase(), s.id]
      );
    }
  },

  async down(db) {
    // Keep data intact
  }
};
