/**
 * Migration 016: Mission Order Template Enhancements
 * Adds versioning, dynamic field analysis, visual identity (logo & watermark) settings
 * to the mission_order_templates table.
 */

module.exports = {
  async up(db) {
    // 1. Add versioning and dynamic fields columns if not existing
    const columns = [
      { name: 'version_number', def: 'INTEGER NOT NULL DEFAULT 1' },
      { name: 'is_default', def: 'INTEGER NOT NULL DEFAULT 1' },
      { name: 'detected_fields', def: "TEXT DEFAULT '[]'" },
      { name: 'logo_path', def: "TEXT DEFAULT '/uploads/logos/logo_univ_kindia_officiel.png'" },
      { name: 'watermark_path', def: "TEXT DEFAULT '/uploads/logos/watermark_guinee_officiel.jpg'" },
      { name: 'watermark_enabled', def: 'INTEGER NOT NULL DEFAULT 1' },
      { name: 'watermark_opacity', def: 'REAL NOT NULL DEFAULT 0.15' },
      { name: 'watermark_size', def: 'INTEGER NOT NULL DEFAULT 60' },
      { name: 'watermark_position', def: "TEXT NOT NULL DEFAULT 'CENTER'" }
    ];

    for (const col of columns) {
      try {
        await db.run(`ALTER TABLE mission_order_templates ADD COLUMN ${col.name} ${col.def}`);
      } catch (err) {
        // Column already exists, safe to ignore
      }
    }

    // 2. Sync initial visual identity from institution_settings if present
    try {
      const inst = await db.get(`SELECT logo_path, watermark_path, watermark_enabled, watermark_opacity, watermark_size FROM institution_settings WHERE id = 1`);
      if (inst) {
        await db.run(`
          UPDATE mission_order_templates SET
            logo_path = COALESCE(logo_path, ?),
            watermark_path = COALESCE(watermark_path, ?),
            watermark_enabled = COALESCE(watermark_enabled, ?),
            watermark_opacity = COALESCE(watermark_opacity, ?),
            watermark_size = COALESCE(watermark_size, ?)
        `, [
          inst.logo_path || '/uploads/logos/logo_univ_kindia_officiel.png',
          inst.watermark_path || '/uploads/logos/watermark_guinee_officiel.jpg',
          inst.watermark_enabled !== undefined ? inst.watermark_enabled : 1,
          inst.watermark_opacity || 0.15,
          inst.watermark_size || 60
        ]);
      }
    } catch (err) {
      console.warn('Migration 016 visual identity sync warning:', err.message);
    }
  },

  async down(db) {
    // In SQLite, dropping columns is rarely needed in downgrade migrations
  }
};
