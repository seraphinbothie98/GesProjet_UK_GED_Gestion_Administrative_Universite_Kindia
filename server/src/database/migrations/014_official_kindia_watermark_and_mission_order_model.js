/**
 * Migration 014: Official Kindia Watermark & Mission Order Visual Identity Model
 * Ajoute les paramètres de filigrane officiel et configure le modèle officiel Ordre de Mission
 */

module.exports = {
  async up(db) {
    // 1. Add watermark columns to institution_settings if not exist
    try {
      await db.run(`ALTER TABLE institution_settings ADD COLUMN watermark_path TEXT DEFAULT '/uploads/logos/watermark_guinee_officiel.jpg'`);
    } catch (e) {}

    try {
      await db.run(`ALTER TABLE institution_settings ADD COLUMN watermark_opacity REAL DEFAULT 0.12`);
    } catch (e) {}

    try {
      await db.run(`ALTER TABLE institution_settings ADD COLUMN watermark_size INTEGER DEFAULT 360`);
    } catch (e) {}

    try {
      await db.run(`ALTER TABLE institution_settings ADD COLUMN watermark_position_x INTEGER DEFAULT 0`);
    } catch (e) {}

    try {
      await db.run(`ALTER TABLE institution_settings ADD COLUMN watermark_position_y INTEGER DEFAULT 0`);
    } catch (e) {}

    try {
      await db.run(`ALTER TABLE institution_settings ADD COLUMN watermark_rotation INTEGER DEFAULT 0`);
    } catch (e) {}

    try {
      await db.run(`ALTER TABLE institution_settings ADD COLUMN watermark_enabled INTEGER DEFAULT 1`);
    } catch (e) {}

    // 2. Update default logo and watermark for institution_settings id = 1
    await db.run(`
      UPDATE institution_settings SET
        logo_path = '/uploads/logos/logo_univ_kindia_officiel.png',
        watermark_path = '/uploads/logos/watermark_guinee_officiel.jpg',
        watermark_opacity = 0.12,
        watermark_size = 360,
        watermark_enabled = 1,
        name = 'UNIVERSITÉ DE KINDIA',
        ministry = 'MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR, DE LA RECHERCHE SCIENTIFIQUE ET DE L’INNOVATION',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);

    // 3. Ensure the official Mission Order template is active and default
    const existingOm = await db.get(`SELECT id FROM document_templates WHERE code = 'ORDRE_001' OR code = 'OM_OFFICIAL' OR document_type_code = 'MISSION_ORDER'`);
    if (existingOm) {
      await db.run(`
        UPDATE document_templates SET
          name = 'Ordre de Mission',
          is_default = 1,
          is_active = 1,
          document_type_code = 'MISSION_ORDER',
          category = 'Missions',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [existingOm.id]);
    }
  },

  async down(db) {
    // Reversible if needed
  }
};
