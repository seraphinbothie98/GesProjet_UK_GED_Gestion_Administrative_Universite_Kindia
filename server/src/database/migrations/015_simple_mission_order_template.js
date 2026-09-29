/**
 * Migration 015: Simple Mission Order Official Template Base
 * Creates dedicated and simplified table for the single official mission order template.
 */

module.exports = {
  async up(db) {
    // 1. Create table mission_order_templates
    await db.run(`
      CREATE TABLE IF NOT EXISTS mission_order_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL DEFAULT 'Ordre de mission officiel',
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL DEFAULT 'DOCX',
        file_size INTEGER,
        status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' or 'INACTIVE'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // 2. Check if a default official mission template file exists to seed as initial record
    const existing = await db.get(`SELECT * FROM mission_order_templates LIMIT 1`);
    if (!existing) {
      const oldTemplate = await db.get(`
        SELECT * FROM document_templates 
        WHERE code = 'ORDRE_001' OR category = 'Missions' OR document_type_code = 'MISSION_ORDER'
        ORDER BY is_default DESC, id DESC LIMIT 1
      `);

      if (oldTemplate && oldTemplate.file_path) {
        await db.run(`
          INSERT INTO mission_order_templates (name, file_path, file_name, file_type, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          'Ordre de mission officiel',
          oldTemplate.file_path,
          oldTemplate.file_path.split('/').pop() || 'Ordre_de_mission_officiel.docx',
          oldTemplate.format || 'DOCX'
        ]);
      }
    }
  },

  async down(db) {
    await db.run(`DROP TABLE IF EXISTS mission_order_templates`);
  }
};
