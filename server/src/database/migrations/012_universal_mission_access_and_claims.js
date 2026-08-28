/**
 * Migration 012: Universal Access Control for Mission Requests & Staff Verification Claims
 * Université de Kindia (UK-GED)
 */

module.exports = {
  version: '012',
  name: 'universal_mission_access_and_claims',

  async up(db) {
    // 1. Add staff_id and identification_mode to mission_order_requests if missing
    const reqCols = (await db.all('PRAGMA table_info(mission_order_requests)')).map(c => c.name);
    if (!reqCols.includes('staff_id')) {
      await db.run('ALTER TABLE mission_order_requests ADD COLUMN staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL');
    }
    if (!reqCols.includes('identification_mode')) {
      await db.run("ALTER TABLE mission_order_requests ADD COLUMN identification_mode TEXT DEFAULT 'UK_GED_ACCOUNT'");
    }

    // 2. Create table for matricule verification claims (when worker matricule is not recognized/needs verification)
    await db.exec(`
      CREATE TABLE IF NOT EXISTS matricule_verification_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        matricule TEXT NOT NULL,
        last_name TEXT NOT NULL,
        first_names TEXT NOT NULL,
        function_title TEXT,
        service_name TEXT,
        phone TEXT,
        email TEXT,
        notes TEXT,
        status TEXT DEFAULT 'PENDING', -- PENDING, RESOLVED, REJECTED
        resolution_notes TEXT,
        resolved_by INTEGER REFERENCES users(id),
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_mvc_matricule ON matricule_verification_claims(matricule);
      CREATE INDEX IF NOT EXISTS idx_mvc_status ON matricule_verification_claims(status);
    `);

    // 3. Ensure standard university workers without UK-GED account exist in staff directory
    // Examples required by specification: Chauffeur, Agent de sécurité, Agent de nettoyage/entretien, Technicien
    const sampleWorkers = [
      {
        matricule: 'UK-CHAUFF-001',
        nom: 'CAMARA',
        prenoms: 'Mamadouba',
        fonction: 'Chauffeur de l’Université',
        service_code: 'LOG', // Logistique / Transport
        telephone: '+224 622 11 22 33',
        email: 'chauffeur.camara@univ-kindia.edu.gn',
        status: 'ACTIF',
        is_driver: 1
      },
      {
        matricule: 'UK-SEC-001',
        nom: 'BANGOURA',
        prenoms: 'Sekou',
        fonction: 'Agent de Sécurité et Gardiennage',
        service_code: 'SEC', // Sécurité
        telephone: '+224 620 44 55 66',
        email: 'securite.bangoura@univ-kindia.edu.gn',
        status: 'ACTIF',
        is_driver: 0
      },
      {
        matricule: 'UK-NETT-001',
        nom: 'TOURE',
        prenoms: 'M’Mah',
        fonction: 'Agente d’Entretien et Nettoyage',
        service_code: 'MG', // Moyens Généraux / Patrimoine
        telephone: '+224 628 77 88 99',
        email: 'entretien.toure@univ-kindia.edu.gn',
        status: 'ACTIF',
        is_driver: 0
      },
      {
        matricule: 'UK-TECH-001',
        nom: 'CONTE',
        prenoms: 'Ibrahima Sory',
        fonction: 'Technicien de Maintenance Électrique',
        service_code: 'SIC', // ou Patrimoine
        telephone: '+224 624 33 44 55',
        email: 'tech.conte@univ-kindia.edu.gn',
        status: 'ACTIF',
        is_driver: 0
      }
    ];

    for (const w of sampleWorkers) {
      const existing = await db.get('SELECT id FROM staff WHERE matricule = ?', [w.matricule]);
      let serviceId = null;
      if (w.service_code) {
        const srv = await db.get('SELECT id FROM services WHERE code = ? LIMIT 1', [w.service_code]);
        if (srv) serviceId = srv.id;
      }

      if (!existing) {
        await db.run(
          `INSERT INTO staff (user_id, matricule, nom, prenoms, nationality, fonction, service_id, telephone, email, status, is_driver)
           VALUES (NULL, ?, ?, ?, 'Guinéenne', ?, ?, ?, ?, ?, ?)`,
          [w.matricule, w.nom, w.prenoms, w.fonction, serviceId, w.telephone, w.email, w.status, w.is_driver]
        );
      } else {
        // Ensure active status and no user account attached
        await db.run(
          `UPDATE staff SET status = ?, is_driver = ?, service_id = COALESCE(service_id, ?) WHERE id = ?`,
          [w.status, w.is_driver, serviceId, existing.id]
        );
      }
    }
  },

  async down(db) {
    try {
      await db.run('DROP TABLE IF EXISTS matricule_verification_claims');
    } catch (e) {}
  }
};
