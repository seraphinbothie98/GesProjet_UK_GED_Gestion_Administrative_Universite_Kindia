/**
 * Migration 017: Staff Vehicle Information & Mission Order Transport enhancements
 */
exports.up = async function(db) {
  // Add columns to staff table
  const staffCols = (await db.all("PRAGMA table_info(staff)")).map(c => c.name);

  if (!staffCols.includes('vehicle_registration')) {
    await db.run("ALTER TABLE staff ADD COLUMN vehicle_registration TEXT");
  }
  if (!staffCols.includes('vehicle_brand')) {
    await db.run("ALTER TABLE staff ADD COLUMN vehicle_brand TEXT");
  }
  if (!staffCols.includes('vehicle_model')) {
    await db.run("ALTER TABLE staff ADD COLUMN vehicle_model TEXT");
  }
  if (!staffCols.includes('personal_vehicle_registration')) {
    await db.run("ALTER TABLE staff ADD COLUMN personal_vehicle_registration TEXT");
  }
  if (!staffCols.includes('personal_vehicle_brand')) {
    await db.run("ALTER TABLE staff ADD COLUMN personal_vehicle_brand TEXT");
  }
  if (!staffCols.includes('personal_vehicle_model')) {
    await db.run("ALTER TABLE staff ADD COLUMN personal_vehicle_model TEXT");
  }

  // Add vehicle_type to vehicles table if missing
  const vehCols = (await db.all("PRAGMA table_info(vehicles)")).map(c => c.name);
  if (!vehCols.includes('vehicle_type')) {
    await db.run("ALTER TABLE vehicles ADD COLUMN vehicle_type TEXT DEFAULT 'SERVICE'");
  }
};

exports.down = async function(db) {
  // No-op for SQLite alter table rollbacks
};
