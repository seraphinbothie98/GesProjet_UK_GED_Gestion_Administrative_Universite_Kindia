/**
 * Migration 013: Mission Order Reference Inheritance & Direct Request-to-Order Linking
 * Université de Kindia (UK-GED)
 */

module.exports = {
  version: '013',
  name: 'mission_order_reference_and_request_linking',

  async up(db) {
    // 1. Add request_id to mission_orders if missing
    const moCols = (await db.all('PRAGMA table_info(mission_orders)')).map(c => c.name);
    if (!moCols.includes('request_id')) {
      await db.run('ALTER TABLE mission_orders ADD COLUMN request_id INTEGER REFERENCES mission_order_requests(id) ON DELETE SET NULL');
    }

    // 2. Backfill relation between mission_orders and mission_order_requests
    await db.run(`
      UPDATE mission_orders
      SET request_id = (
        SELECT id FROM mission_order_requests 
        WHERE mission_order_requests.official_document_id = mission_orders.document_id
        LIMIT 1
      )
      WHERE request_id IS NULL AND document_id IN (SELECT official_document_id FROM mission_order_requests WHERE official_document_id IS NOT NULL)
    `);

    // 3. Create index for fast bidirectional lookup
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mo_request_id ON mission_orders(request_id);
    `);
  },

  async down(db) {
    // SQLite doesn't drop columns easily in older versions, nothing to revert
  }
};
