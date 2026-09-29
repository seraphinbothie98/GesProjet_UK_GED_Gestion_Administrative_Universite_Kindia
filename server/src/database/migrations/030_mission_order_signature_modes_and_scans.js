/**
 * Migration 030: Add signature_mode, manuscript signing and scan upload fields to mission_orders
 */

module.exports = {
  async up(db) {
    const tableInfo = await db.all("PRAGMA table_info(mission_orders)");
    const cols = tableInfo.map(c => c.name);

    if (!cols.includes('signature_mode')) {
      await db.run("ALTER TABLE mission_orders ADD COLUMN signature_mode TEXT DEFAULT 'ELECTRONIC'");
    }
    if (!cols.includes('manuscript_signed_at')) {
      await db.run('ALTER TABLE mission_orders ADD COLUMN manuscript_signed_at DATETIME');
    }
    if (!cols.includes('scanned_pdf_path')) {
      await db.run('ALTER TABLE mission_orders ADD COLUMN scanned_pdf_path TEXT');
    }
    if (!cols.includes('scanned_by_user_id')) {
      await db.run('ALTER TABLE mission_orders ADD COLUMN scanned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL');
    }
    if (!cols.includes('scanned_at')) {
      await db.run('ALTER TABLE mission_orders ADD COLUMN scanned_at DATETIME');
    }
  },

  async down(db) {
    // Non-destructive
  }
};
