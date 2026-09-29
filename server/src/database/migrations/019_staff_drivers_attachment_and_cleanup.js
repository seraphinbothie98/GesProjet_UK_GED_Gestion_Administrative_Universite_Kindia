/**
 * Migration 019: Staff Drivers Attachment & Resource Management
 */
exports.up = async function(db) {
  // 1. Create staff_drivers table for attaching multiple drivers to a staff member
  await db.exec(`
    CREATE TABLE IF NOT EXISTS staff_drivers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      driver_id INTEGER NOT NULL,
      is_default INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
      FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
      UNIQUE(staff_id, driver_id)
    );
    CREATE INDEX IF NOT EXISTS idx_staff_drivers_staff ON staff_drivers(staff_id);
    CREATE INDEX IF NOT EXISTS idx_staff_drivers_driver ON staff_drivers(driver_id);
  `);

  // 2. Ensure RBAC permissions for fleet and drivers
  const permissionsToAdd = [
    { code: 'staff.resources.manage', description: 'Gérer les ressources associées au personnel', category: 'STAFF' },
    { code: 'drivers.attach', description: 'Rattacher des chauffeurs aux personnels', category: 'DRIVERS' }
  ];

  for (const perm of permissionsToAdd) {
    const existing = await db.get('SELECT id FROM permissions WHERE code = ?', [perm.code]);
    if (!existing) {
      await db.run(
        'INSERT INTO permissions (code, category, description) VALUES (?, ?, ?)',
        [perm.code, perm.category, perm.description]
      );
    }
  }

  // Grant these permissions to ADMINISTRATEUR and AGENT_SECRÉTARIAT_CENTRAL
  const rolesToGrant = ['ADMINISTRATEUR', 'AGENT_SECRÉTARIAT_CENTRAL'];
  for (const roleCode of rolesToGrant) {
    const role = await db.get('SELECT id FROM roles WHERE code = ?', [roleCode]);
    if (role) {
      for (const perm of permissionsToAdd) {
        const p = await db.get('SELECT id FROM permissions WHERE code = ?', [perm.code]);
        if (p) {
          const rp = await db.get('SELECT * FROM role_permissions WHERE role_id = ? AND permission_id = ?', [role.id, p.id]);
          if (!rp) {
            await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [role.id, p.id]);
          }
        }
      }
    }
  }

  console.log('[MIGRATION 019] staff_drivers table created and permissions updated.');
};

exports.down = async function(db) {
  await db.exec(`DROP TABLE IF EXISTS staff_drivers;`);
};
