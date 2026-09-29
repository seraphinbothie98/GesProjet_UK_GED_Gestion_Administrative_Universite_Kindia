/**
 * Migration 020: Positions & Staff Assignments Architecture (Postes, Affectations, Mutations & Historique)
 * Université de Kindia (UK-GED)
 */

module.exports = {
  version: '020',
  name: 'positions_and_assignments_architecture',

  async up(db) {
    // 1. Create positions table (Postes)
    await db.run(`
      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
        is_unique INTEGER DEFAULT 1,
        category TEXT DEFAULT 'ADMINISTRATIF',
        description TEXT,
        status TEXT DEFAULT 'ACTIVE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create staff_assignments table (Affectations & Parcours Professionnel)
    await db.run(`
      CREATE TABLE IF NOT EXISTS staff_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
        position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
        service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        motive TEXT,
        appointment_act_ref TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.run(`CREATE INDEX IF NOT EXISTS idx_assignments_staff ON staff_assignments(staff_id);`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_assignments_pos ON staff_assignments(position_id);`);
    await db.run(`CREATE INDEX IF NOT EXISTS idx_assignments_status ON staff_assignments(status);`);

    // 3. Seed Standard Institutional Positions
    const initialPositions = [
      { code: 'RECTEUR', title: 'Recteur', is_unique: 1, category: 'DIRECTION_GENERALE', desc: 'Première autorité exécutive et académique de l’Université' },
      { code: 'SECRETARIAT_GENERAL', title: 'Secrétaire Général', is_unique: 1, category: 'DIRECTION_GENERALE', desc: 'Gestion administrative et coordination des services généraux' },
      { code: 'VR_ETUDES', title: 'Vice-Recteur chargé des Études', is_unique: 1, category: 'DIRECTION_GENERALE', desc: 'Supervision pédagogique, formations et vie universitaire' },
      { code: 'VR_RECHERCHE', title: 'Vice-Recteur chargé de la Recherche', is_unique: 1, category: 'DIRECTION_GENERALE', desc: 'Supervision des programmes de recherche et laboratoires' },
      { code: 'VR_ETUDIANTS', title: 'Vice-Recteur chargé des Étudiants', is_unique: 1, category: 'DIRECTION_GENERALE', desc: 'Vie étudiante, affaires sociales et suivi des diplômés' },
      { code: 'DAF', title: 'Directeur Administratif et Financier (DAF)', is_unique: 1, category: 'ADMINISTRATIF', desc: 'Gestion budgétaire et financière' },
      { code: 'CONTROLEUR_FINANCIER', title: 'Contrôleur Financier', is_unique: 1, category: 'ADMINISTRATIF', desc: 'Contrôle financier et conformité des engagements' },
      { code: 'DOYEN_FS', title: 'Doyen Faculté des Sciences', is_unique: 1, category: 'FACULTE', desc: 'Direction de la Faculté des Sciences' },
      { code: 'DOYEN_FLL', title: 'Doyen Faculté des Lettres et Langues', is_unique: 1, category: 'FACULTE', desc: 'Direction de la Faculté des Lettres et Langues' },
      { code: 'DOYEN_FSEG', title: 'Doyen Faculté des Sciences Économiques et Gestion', is_unique: 1, category: 'FACULTE', desc: 'Direction de la Faculté des Sciences Économiques et Gestion' },
      { code: 'DOYEN_FSS', title: 'Doyen Faculté des Sciences Sociales', is_unique: 1, category: 'FACULTE', desc: 'Direction de la Faculté des Sciences Sociales' },
      { code: 'CHEF_DEPT_INFO', title: 'Chef du Département d’Informatique', is_unique: 1, category: 'DEPARTEMENT', desc: 'Direction du département Informatique' },
      { code: 'CHEF_DEPT_MATH', title: 'Chef du Département de Mathématiques', is_unique: 1, category: 'DEPARTEMENT', desc: 'Direction du département Mathématiques' },
      { code: 'CHEF_DEPT_PHY', title: 'Chef du Département de Physique', is_unique: 1, category: 'DEPARTEMENT', desc: 'Direction du département Physique' },
      { code: 'CHEF_DEPT_CHIM', title: 'Chef du Département de Chimie', is_unique: 1, category: 'DEPARTEMENT', desc: 'Direction du département Chimie' },
      { code: 'CHEF_DEPT_BIO', title: 'Chef du Département de Biologie', is_unique: 1, category: 'DEPARTEMENT', desc: 'Direction du département Biologie' },
      { code: 'CHEF_SERVICE_DRH', title: 'Chef de Service DRH', is_unique: 1, category: 'SERVICE', desc: 'Gestion des ressources humaines' },
      { code: 'CHEF_SERVICE_SCOLARITE', title: 'Chef de Service Scolarité Centrale', is_unique: 1, category: 'SERVICE', desc: 'Gestion des inscriptions et scolarité' },
      { code: 'CHEF_SERVICE_SECRETARIAT_CENTRAL', title: 'Chef du Secrétariat Central', is_unique: 1, category: 'SERVICE', desc: 'Enregistrement et dispatching du courrier officiel' },
      { code: 'CHEF_SERVICE_GEN', title: 'Chef de Service', is_unique: 0, category: 'SERVICE', desc: 'Responsable hiérarchique d’un service administratif' },
      { code: 'CHEF_DEPT_GEN', title: 'Chef de Département', is_unique: 0, category: 'DEPARTEMENT', desc: 'Responsable d’un département académique' },
      { code: 'ENSEIGNANT_CHERCHEUR', title: 'Enseignant-Chercheur', is_unique: 0, category: 'ACADEMIQUE', desc: 'Corps professoral et d’enseignement' },
      { code: 'AGENT_ADMINISTRATIF', title: 'Agent Administratif', is_unique: 0, category: 'ADMINISTRATIF', desc: 'Agent administratif standard' },
      { code: 'SECRETAIRE', title: 'Secrétaire de Direction / Principal(e)', is_unique: 0, category: 'ADMINISTRATIF', desc: 'Gestion de secrétariat' },
      { code: 'CHAUFFEUR', title: 'Chauffeur de Mission / Parc Auto', is_unique: 0, category: 'LOGISTIQUE', desc: 'Chauffeur autorisé' },
      { code: 'ARCHIVISTE', title: 'Archiviste / Documentaliste', is_unique: 0, category: 'DOCUMENTATION', desc: 'Gestion des archives et documents' }
    ];

    for (const pos of initialPositions) {
      const exists = await db.get('SELECT id FROM positions WHERE code = ?', [pos.code]);
      if (!exists) {
        await db.run(
          `INSERT INTO positions (code, title, is_unique, category, description, status)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
          [pos.code, pos.title, pos.is_unique, pos.category, pos.desc]
        );
      }
    }

    // 4. Clean up corrupted or orphan duplicate test rows (specifically fake duplicate rector rows in staff)
    await db.run(`
      DELETE FROM staff 
      WHERE user_id IS NULL AND matricule LIKE 'UK-RECT-%' AND (nom = 'TOURE' OR nom = 'TESTEUR')
    `);

    // 5. Migrate current staff records to initial staff_assignments
    const allStaff = await db.all('SELECT * FROM staff');
    for (const st of allStaff) {
      let matchedPos = null;
      if (st.fonction && st.fonction.trim()) {
        const fClean = st.fonction.trim();
        matchedPos = await db.get(
          'SELECT id, is_unique FROM positions WHERE LOWER(title) = LOWER(?) OR LOWER(code) = LOWER(?)',
          [fClean, fClean]
        );

        if (!matchedPos) {
          if (fClean.toLowerCase().startsWith('recteur')) {
            matchedPos = await db.get("SELECT id, is_unique FROM positions WHERE code = 'RECTEUR'");
          } else if (fClean.toLowerCase().startsWith('secrétaire général') || fClean.toLowerCase().startsWith('secretaire general')) {
            matchedPos = await db.get("SELECT id, is_unique FROM positions WHERE code = 'SECRETARIAT_GENERAL'");
          } else if (fClean.toLowerCase().startsWith('doyen')) {
            matchedPos = await db.get("SELECT id, is_unique FROM positions WHERE title LIKE 'Doyen%' LIMIT 1");
          } else if (fClean.toLowerCase().startsWith('chef de service')) {
            matchedPos = await db.get("SELECT id, is_unique FROM positions WHERE code = 'CHEF_SERVICE_GEN'");
          } else if (fClean.toLowerCase().startsWith('chef de d') || fClean.toLowerCase().startsWith('chef du d')) {
            matchedPos = await db.get("SELECT id, is_unique FROM positions WHERE code = 'CHEF_DEPT_GEN'");
          } else if (fClean.toLowerCase().includes('enseignant')) {
            matchedPos = await db.get("SELECT id, is_unique FROM positions WHERE code = 'ENSEIGNANT_CHERCHEUR'");
          } else if (fClean.toLowerCase().includes('chauffeur')) {
            matchedPos = await db.get("SELECT id, is_unique FROM positions WHERE code = 'CHAUFFEUR'");
          }
        }

        if (!matchedPos) {
          const newCode = `POS_${Date.now()}_${Math.round(Math.random() * 1000)}`;
          const isUniq = fClean.toLowerCase().startsWith('chef') || fClean.toLowerCase().startsWith('doyen') || fClean.toLowerCase().startsWith('directeur') ? 1 : 0;
          const posRes = await db.run(
            `INSERT INTO positions (code, title, is_unique, category, status)
             VALUES (?, ?, ?, 'ADMINISTRATIF', 'ACTIVE')`,
            [newCode, fClean, isUniq]
          );
          matchedPos = { id: posRes.lastID, is_unique: isUniq };
        }
      } else {
        matchedPos = await db.get("SELECT id, is_unique FROM positions WHERE code = 'AGENT_ADMINISTRATIF'");
      }

      if (matchedPos) {
        const existingAssignment = await db.get(
          'SELECT id FROM staff_assignments WHERE staff_id = ? AND status = "ACTIVE"',
          [st.id]
        );

        if (!existingAssignment) {
          const startDate = st.created_at ? st.created_at.substring(0, 10) : new Date().toISOString().split('T')[0];
          await db.run(
            `INSERT INTO staff_assignments (staff_id, position_id, service_id, start_date, status, motive)
             VALUES (?, ?, ?, ?, 'ACTIVE', 'Affectation initiale')`,
            [st.id, matchedPos.id, st.service_id || null, startDate]
          );
        }
      }
    }
  },

  async down(db) {
    try {
      await db.run('DROP TABLE IF EXISTS staff_assignments');
      await db.run('DROP TABLE IF EXISTS positions');
    } catch (e) {}
  }
};
