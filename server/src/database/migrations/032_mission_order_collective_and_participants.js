/**
 * Migration 032: Mission Orders Collective & Individual Architecture
 * Adds mission_order_participants table, mission_type, requester_id and participants_count
 * to mission_orders and mission_order_requests.
 * Fully non-destructive and backward compatible with existing mission orders.
 */

module.exports = {
  async up(db) {
    // 1. Create table mission_order_participants
    await db.exec(`
      CREATE TABLE IF NOT EXISTS mission_order_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mission_order_id INTEGER,
        request_id INTEGER,
        user_id INTEGER,
        staff_id INTEGER,
        nom TEXT NOT NULL,
        prenoms TEXT,
        titre TEXT DEFAULT 'M.',
        fonction TEXT NOT NULL,
        matricule TEXT,
        service_name TEXT,
        telephone TEXT,
        email TEXT,
        is_requester INTEGER DEFAULT 0,
        order_index INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mission_order_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (request_id) REFERENCES mission_order_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mop_order_id ON mission_order_participants(mission_order_id);
      CREATE INDEX IF NOT EXISTS idx_mop_req_id ON mission_order_participants(request_id);
      CREATE INDEX IF NOT EXISTS idx_mop_user_id ON mission_order_participants(user_id);
      CREATE INDEX IF NOT EXISTS idx_mop_staff_id ON mission_order_participants(staff_id);
    `);

    // 2. Add columns to mission_orders if missing
    const moCols = (await db.all("PRAGMA table_info(mission_orders)")).map(c => c.name);
    if (!moCols.includes('mission_type')) {
      await db.run("ALTER TABLE mission_orders ADD COLUMN mission_type TEXT DEFAULT 'INDIVIDUEL'");
    }
    if (!moCols.includes('participants_count')) {
      await db.run("ALTER TABLE mission_orders ADD COLUMN participants_count INTEGER DEFAULT 1");
    }
    if (!moCols.includes('requester_id')) {
      await db.run("ALTER TABLE mission_orders ADD COLUMN requester_id INTEGER REFERENCES users(id) ON DELETE SET NULL");
    }

    // 3. Add columns to mission_order_requests if missing
    const morCols = (await db.all("PRAGMA table_info(mission_order_requests)")).map(c => c.name);
    if (!morCols.includes('mission_type')) {
      await db.run("ALTER TABLE mission_order_requests ADD COLUMN mission_type TEXT DEFAULT 'INDIVIDUEL'");
    }
    if (!morCols.includes('participants_count')) {
      await db.run("ALTER TABLE mission_order_requests ADD COLUMN participants_count INTEGER DEFAULT 1");
    }
  },

  async down(db) {
    // Non-destructive rollback
  }
};
