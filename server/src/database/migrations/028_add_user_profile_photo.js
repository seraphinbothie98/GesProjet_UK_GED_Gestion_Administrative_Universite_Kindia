/**
 * Migration 028: Add Profile Photo (photo_path) to Users and Staff tables
 */

async function up(db) {
  console.log('Running migration 028: Add Profile Photo to Users and Staff tables...');

  // 1. Check and add photo_path column to users table
  const userColumns = await db.all("PRAGMA table_info(users)");
  const userColumnNames = userColumns.map(c => c.name);

  if (!userColumnNames.includes('photo_path')) {
    await db.run("ALTER TABLE users ADD COLUMN photo_path TEXT DEFAULT NULL");
    console.log('Added photo_path column to users table.');
  }

  // 2. Check and add photo_path column to staff table
  const staffColumns = await db.all("PRAGMA table_info(staff)");
  const staffColumnNames = staffColumns.map(c => c.name);

  if (!staffColumnNames.includes('photo_path')) {
    await db.run("ALTER TABLE staff ADD COLUMN photo_path TEXT DEFAULT NULL");
    console.log('Added photo_path column to staff table.');
  }

  // 3. Ensure avatars directory exists
  const fs = require('fs');
  const path = require('path');
  const { UPLOAD_DIR } = require('../../config/constants');
  const avatarsDir = path.join(UPLOAD_DIR, 'avatars');
  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
    console.log('Created uploads/avatars directory.');
  }
}

async function down(db) {
  // SQLite does not support DROP COLUMN cleanly in older versions, not critical for down
}

module.exports = { up, down };
