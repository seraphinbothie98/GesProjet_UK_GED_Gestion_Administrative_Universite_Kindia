/**
 * Migration 025: Institution Leaders & Multi-Speaker Welcome Carousel
 * Support for multiple University Leaders (Rector, SG, VPs, Deans) with portraits & welcome messages
 * Université de Kindia (UK-GED)
 */
async function up(db) {
  await db.run(`
    CREATE TABLE IF NOT EXISTS institution_leaders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      photo_path TEXT NOT NULL DEFAULT '/uploads/logos/rector_portrait.jpg',
      welcome_message TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const count = await db.get('SELECT COUNT(*) as cnt FROM institution_leaders');
  if (!count || count.cnt === 0) {
    // Seed default Rector and Secretary General
    await db.run(`
      INSERT INTO institution_leaders (name, title, subtitle, photo_path, welcome_message, display_order, is_active)
      VALUES (
        'Pr AKOYE MASSA ZOUMANIGUI',
        'Recteur de l''Université de Kindia',
        'Rectorat • Haute Autorité Académique',
        '/uploads/logos/rector_portrait.jpg',
        'Bienvenue sur la plateforme numérique officielle UK-GED de l''Université de Kindia. Notre engagement est de garantir la transparence, la célérité et la traçabilité intégrale de nos actes administratifs et académiques.',
        1,
        1
      )
    `);

    await db.run(`
      INSERT INTO institution_leaders (name, title, subtitle, photo_path, welcome_message, display_order, is_active)
      VALUES (
        'Dr DOUMBOUYA Mohamed',
        'Secrétaire Général de l''Université de Kindia',
        'Secrétariat Général • Coordination Administrative',
        '/uploads/logos/rector_portrait.jpg',
        'La dématérialisation et la traçabilité de notre gestion administrative consolident l''efficacité de nos services, la rigueur de nos circuits de validation et la fluidité des transmissions institutionnelles.',
        2,
        1
      )
    `);
  }
}

async function down(db) {
  await db.run('DROP TABLE IF EXISTS institution_leaders');
}

module.exports = { up, down };
