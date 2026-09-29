/**
 * Migration 029: Add vehicle and driver fields to mission_order_requests
 */

module.exports = {
  async up(db) {
    const tableInfo = await db.all("PRAGMA table_info(mission_order_requests)");
    const cols = tableInfo.map(c => c.name);

    if (!cols.includes('vehicle_id')) {
      await db.run('ALTER TABLE mission_order_requests ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL');
    }
    if (!cols.includes('personal_vehicle_id')) {
      await db.run('ALTER TABLE mission_order_requests ADD COLUMN personal_vehicle_id INTEGER REFERENCES personal_vehicles(id) ON DELETE SET NULL');
    }
    if (!cols.includes('vehicle_registration')) {
      await db.run('ALTER TABLE mission_order_requests ADD COLUMN vehicle_registration TEXT');
    }
    if (!cols.includes('driver_option')) {
      await db.run("ALTER TABLE mission_order_requests ADD COLUMN driver_option TEXT DEFAULT 'SELF'");
    }
    if (!cols.includes('driver_id')) {
      await db.run('ALTER TABLE mission_order_requests ADD COLUMN driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL');
    }
    if (!cols.includes('driver_name')) {
      await db.run('ALTER TABLE mission_order_requests ADD COLUMN driver_name TEXT');
    }
  },

  async down(db) {
    // SQLite doesn't require rollback of columns
  }
};
