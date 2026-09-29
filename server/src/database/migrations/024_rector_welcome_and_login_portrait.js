/**
 * Migration 024: Rector Welcome Message, Portrait & Login Customization Settings
 * Université de Kindia (UK-GED)
 */
async function up(db) {
  const tableInfo = await db.all('PRAGMA table_info(institution_settings)');
  const columnNames = tableInfo.map(c => c.name);

  if (!columnNames.includes('rector_name')) {
    await db.run("ALTER TABLE institution_settings ADD COLUMN rector_name TEXT DEFAULT 'Pr AKOYE MASSA ZOUMANIGUI'");
  }

  if (!columnNames.includes('rector_title')) {
    await db.run("ALTER TABLE institution_settings ADD COLUMN rector_title TEXT DEFAULT 'Recteur de l''Université de Kindia'");
  }

  if (!columnNames.includes('rector_photo_path')) {
    await db.run("ALTER TABLE institution_settings ADD COLUMN rector_photo_path TEXT DEFAULT '/uploads/logos/rector_portrait.jpg'");
  }

  if (!columnNames.includes('rector_welcome_message')) {
    await db.run(`ALTER TABLE institution_settings ADD COLUMN rector_welcome_message TEXT DEFAULT 'Bienvenue sur la plateforme numérique officielle UK-GED de l''Université de Kindia. Notre engagement est de garantir la transparence, la célérité et la traçabilité intégrale de nos actes administratifs et académiques.'`);
  }

  if (!columnNames.includes('show_rector_login')) {
    await db.run("ALTER TABLE institution_settings ADD COLUMN show_rector_login INTEGER DEFAULT 1");
  }

  // Ensure default record has values filled
  await db.run(`
    UPDATE institution_settings
    SET rector_name = COALESCE(rector_name, 'Pr AKOYE MASSA ZOUMANIGUI'),
        rector_title = COALESCE(rector_title, 'Recteur de l''Université de Kindia'),
        rector_photo_path = COALESCE(rector_photo_path, '/uploads/logos/rector_portrait.jpg'),
        rector_welcome_message = COALESCE(rector_welcome_message, 'Bienvenue sur la plateforme numérique officielle UK-GED de l''Université de Kindia. Notre engagement est de garantir la transparence, la célérité et la traçabilité intégrale de nos actes administratifs et académiques.'),
        show_rector_login = COALESCE(show_rector_login, 1)
    WHERE id = 1
  `);
}

async function down(db) {
  // SQLite doesn't support DROP COLUMN easily in older versions, no-op
}

module.exports = { up, down };
