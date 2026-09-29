/**
 * Migration 026: Customizable Login Background Image & Visual Identity
 * Université de Kindia (UK-GED)
 */
async function up(db) {
  const tableInfo = await db.all('PRAGMA table_info(institution_settings)');
  const columnNames = tableInfo.map(c => c.name);

  if (!columnNames.includes('login_background_path')) {
    await db.run("ALTER TABLE institution_settings ADD COLUMN login_background_path TEXT DEFAULT '/uploads/logos/login_bg_default.jpg'");
  }

  if (!columnNames.includes('show_login_background')) {
    await db.run("ALTER TABLE institution_settings ADD COLUMN show_login_background INTEGER DEFAULT 1");
  }

  if (!columnNames.includes('login_background_overlay')) {
    await db.run("ALTER TABLE institution_settings ADD COLUMN login_background_overlay REAL DEFAULT 0.15");
  }

  // Ensure default record has values initialized
  await db.run(`
    UPDATE institution_settings
    SET login_background_path = COALESCE(login_background_path, '/uploads/logos/login_bg_default.jpg'),
        show_login_background = COALESCE(show_login_background, 1),
        login_background_overlay = COALESCE(login_background_overlay, 0.15)
    WHERE id = 1
  `);
}

async function down(db) {
  // SQLite doesn't drop columns in standard syntax
}

module.exports = { up, down };
