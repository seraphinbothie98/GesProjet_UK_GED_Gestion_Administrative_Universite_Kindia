/**
 * Migration 018: Multi-Vehicles, University Fleet Management, Independent Drivers & Assignment History
 */
exports.up = async function(db) {
  // 1. Create personal_vehicles table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS personal_vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      registration_number TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      color TEXT,
      vehicle_type TEXT DEFAULT 'Voiture',
      year TEXT,
      status TEXT DEFAULT 'ACTIF', -- ACTIF, INACTIF
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_personal_vehicles_staff ON personal_vehicles(staff_id);
    CREATE INDEX IF NOT EXISTS idx_personal_vehicles_reg ON personal_vehicles(registration_number);
    CREATE INDEX IF NOT EXISTS idx_personal_vehicles_status ON personal_vehicles(status);
  `);

  // 2. Create drivers table (independent of UK-GED user accounts)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricule TEXT,
      nom TEXT NOT NULL,
      prenoms TEXT NOT NULL,
      telephone TEXT NOT NULL,
      license_number TEXT,
      service_id INTEGER,
      status TEXT DEFAULT 'ACTIF', -- ACTIF, INACTIF
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
    CREATE INDEX IF NOT EXISTS idx_drivers_service ON drivers(service_id);
  `);

  // 3. Ensure and enhance vehicles table (University Fleet)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_number TEXT NOT NULL UNIQUE,
      brand TEXT,
      model TEXT,
      vehicle_type TEXT DEFAULT 'SERVICE',
      color TEXT,
      status TEXT DEFAULT 'DISPONIBLE', -- DISPONIBLE, AFFECTÉ, EN_ENTRETIEN, IMMOBILISÉ, RÉFORMÉ, INACTIF
      assigned_staff_id INTEGER,
      assigned_service_id INTEGER,
      default_driver_id INTEGER,
      assigned_at DATETIME,
      observations TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_service_id) REFERENCES services(id) ON DELETE SET NULL,
      FOREIGN KEY (default_driver_id) REFERENCES drivers(id) ON DELETE SET NULL
    );
  `);

  const vehCols = (await db.all("PRAGMA table_info(vehicles)")).map(c => c.name);
  if (!vehCols.includes('assigned_service_id')) {
    await db.run("ALTER TABLE vehicles ADD COLUMN assigned_service_id INTEGER REFERENCES services(id) ON DELETE SET NULL");
  }
  if (!vehCols.includes('default_driver_id')) {
    await db.run("ALTER TABLE vehicles ADD COLUMN default_driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL");
  }
  if (!vehCols.includes('assigned_at')) {
    await db.run("ALTER TABLE vehicles ADD COLUMN assigned_at DATETIME");
  }
  if (!vehCols.includes('color')) {
    await db.run("ALTER TABLE vehicles ADD COLUMN color TEXT");
  }
  if (!vehCols.includes('observations')) {
    await db.run("ALTER TABLE vehicles ADD COLUMN observations TEXT");
  }

  // 4. Create vehicle_assignment_history table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS vehicle_assignment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      staff_id INTEGER,
      service_id INTEGER,
      assigned_by_user_id INTEGER,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      unassigned_at DATETIME,
      reason TEXT,
      notes TEXT,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_veh_hist_vehicle ON vehicle_assignment_history(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_veh_hist_staff ON vehicle_assignment_history(staff_id);
  `);

  // 5. Enhance mission_orders table with snapshots & references if missing
  const moCols = (await db.all("PRAGMA table_info(mission_orders)")).map(c => c.name);
  if (!moCols.includes('vehicle_id')) {
    await db.run("ALTER TABLE mission_orders ADD COLUMN vehicle_id INTEGER");
  }
  if (!moCols.includes('personal_vehicle_id')) {
    await db.run("ALTER TABLE mission_orders ADD COLUMN personal_vehicle_id INTEGER");
  }
  if (!moCols.includes('vehicle_registration_snapshot')) {
    await db.run("ALTER TABLE mission_orders ADD COLUMN vehicle_registration_snapshot TEXT");
  }
  if (!moCols.includes('driver_id')) {
    await db.run("ALTER TABLE mission_orders ADD COLUMN driver_id INTEGER");
  }
  if (!moCols.includes('driver_name_snapshot')) {
    await db.run("ALTER TABLE mission_orders ADD COLUMN driver_name_snapshot TEXT");
  }

  // 6. Add RBAC permissions
  const permissions = [
    { code: 'fleet.view', category: 'FLEET', description: 'Consulter le parc automobile' },
    { code: 'fleet.manage', category: 'FLEET', description: 'Gérer le parc automobile (Ajouter, Modifier, Affecter)' },
    { code: 'drivers.view', category: 'DRIVERS', description: 'Consulter les chauffeurs' },
    { code: 'drivers.manage', category: 'DRIVERS', description: 'Gérer les chauffeurs (Ajouter, Modifier, Statut)' },
    { code: 'personal_vehicles.manage', category: 'PERSONNEL', description: 'Gérer les véhicules personnels des agents' }
  ];

  for (const p of permissions) {
    const existing = await db.get('SELECT id FROM permissions WHERE code = ?', [p.code]);
    if (!existing) {
      await db.run('INSERT INTO permissions (code, category, description) VALUES (?, ?, ?)', [p.code, p.category, p.description]);
    }
  }

  // Grant to ADMIN, SC, SG, RECTEUR
  const rolesToGrant = ['ADMINISTRATEUR', 'AGENT_SECRÉTARIAT_CENTRAL', 'SECRÉTAIRE_GÉNÉRAL', 'RECTEUR'];
  for (const roleCode of rolesToGrant) {
    const role = await db.get('SELECT id FROM roles WHERE code = ?', [roleCode]);
    if (role) {
      for (const p of permissions) {
        const perm = await db.get('SELECT id FROM permissions WHERE code = ?', [p.code]);
        if (perm) {
          const alreadyHas = await db.get('SELECT 1 FROM role_permissions WHERE role_id = ? AND permission_id = ?', [role.id, perm.id]);
          if (!alreadyHas) {
            await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [role.id, perm.id]);
          }
        }
      }
    }
  }

  // 7. Data Backfill
  // 7a. Backfill personal vehicles from staff table if any exist
  const staffList = await db.all("SELECT id, personal_vehicle_registration, personal_vehicle_brand, personal_vehicle_model FROM staff WHERE personal_vehicle_registration IS NOT NULL AND TRIM(personal_vehicle_registration) != ''");
  for (const st of staffList) {
    const reg = st.personal_vehicle_registration.trim();
    const existingPV = await db.get('SELECT id FROM personal_vehicles WHERE staff_id = ? AND registration_number = ?', [st.id, reg]);
    if (!existingPV) {
      await db.run(
        'INSERT INTO personal_vehicles (staff_id, registration_number, brand, model, status) VALUES (?, ?, ?, ?, "ACTIF")',
        [st.id, reg, st.personal_vehicle_brand || '', st.personal_vehicle_model || '']
      );
    }
  }

  // 7b. Backfill drivers from staff with is_driver = 1
  const driverStaff = await db.all("SELECT id, prenoms, nom, telephone, matricule, service_id FROM staff WHERE is_driver = 1");
  for (const ds of driverStaff) {
    const phone = ds.telephone || '+224620000000';
    const existingDriver = await db.get('SELECT id FROM drivers WHERE (matricule = ? AND matricule IS NOT NULL) OR (nom = ? AND prenoms = ?)', [ds.matricule, ds.nom, ds.prenoms]);
    if (!existingDriver) {
      await db.run(
        'INSERT INTO drivers (matricule, nom, prenoms, telephone, service_id, status) VALUES (?, ?, ?, ?, ?, "ACTIF")',
        [ds.matricule || null, ds.nom, ds.prenoms, phone, ds.service_id]
      );
    }
  }

  // 7c. Normalize vehicle status & initialize assignment history if needed
  const fleetVehicles = await db.all("SELECT id, assigned_staff_id, assigned_service_id, status FROM vehicles");
  for (const fv of fleetVehicles) {
    let newStatus = fv.status;
    if (fv.assigned_staff_id || fv.assigned_service_id) {
      if (!['EN_ENTRETIEN', 'IMMOBILISÉ', 'RÉFORMÉ', 'INACTIF'].includes(fv.status)) {
        newStatus = 'AFFECTÉ';
      }
    } else if (fv.status === 'ACTIF') {
      newStatus = 'DISPONIBLE';
    }
    await db.run('UPDATE vehicles SET status = ? WHERE id = ?', [newStatus, fv.id]);

    if (fv.assigned_staff_id || fv.assigned_service_id) {
      const histExists = await db.get('SELECT id FROM vehicle_assignment_history WHERE vehicle_id = ? AND unassigned_at IS NULL', [fv.id]);
      if (!histExists) {
        await db.run(
          'INSERT INTO vehicle_assignment_history (vehicle_id, staff_id, service_id, reason, assigned_at) VALUES (?, ?, ?, "Affectation initiale", CURRENT_TIMESTAMP)',
          [fv.id, fv.assigned_staff_id, fv.assigned_service_id]
        );
      }
    }
  }
};

exports.down = async function(db) {
  // No-op for SQLite alter table rollbacks
};
