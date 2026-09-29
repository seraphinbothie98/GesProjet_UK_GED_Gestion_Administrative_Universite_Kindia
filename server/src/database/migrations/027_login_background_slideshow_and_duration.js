/**
 * Migration 027: Multiple Background Slideshow & Configurable Slide Duration
 * Université de Kindia (UK-GED)
 */
async function up(db) {
  // 1. Create table for multiple background images
  await db.run(`
    CREATE TABLE IF NOT EXISTS institution_backgrounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      image_path TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Add duration and settings column to institution_settings if missing
  const tableInfo = await db.all('PRAGMA table_info(institution_settings)');
  const columnNames = tableInfo.map(c => c.name);

  if (!columnNames.includes('login_background_duration')) {
    await db.run("ALTER TABLE institution_settings ADD COLUMN login_background_duration INTEGER DEFAULT 6");
  }

  // 3. Seed default 3 campus slides if table is empty
  const count = await db.get('SELECT COUNT(*) as cnt FROM institution_backgrounds');
  if (!count || count.cnt === 0) {
    await db.run(`
      INSERT INTO institution_backgrounds (title, image_path, display_order, is_active)
      VALUES 
        ('Bâtiment Principal & Administration', '/uploads/logos/login_bg_default.jpg', 1, 1),
        ('Campus Universitaire & Espaces Pédagogiques', '/uploads/logos/login_bg_slide_2.jpg', 2, 1),
        ('Rectorat & Bibliothèque Centrale', '/uploads/logos/login_bg_slide_3.jpg', 3, 1)
    `);
  }

  // Update default settings
  await db.run(`
    UPDATE institution_settings
    SET login_background_duration = COALESCE(login_background_duration, 6),
        show_login_background = COALESCE(show_login_background, 1),
        login_background_overlay = COALESCE(login_background_overlay, 0.15)
    WHERE id = 1
  `);
}

async function down(db) {
  await db.run('DROP TABLE IF EXISTS institution_backgrounds');
}

module.exports = { up, down };
