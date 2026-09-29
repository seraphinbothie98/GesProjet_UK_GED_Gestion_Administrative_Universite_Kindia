/**
 * Migration 022: Add Titre and Grade support to Mission Orders & Requests
 * Université de Kindia (UK-GED)
 */
module.exports = {
  name: '022_add_mission_titre_and_grade_fields',

  async up(db) {
    // 1. Ensure mission_orders has missionary_titre and missionary_titre_snapshot
    const moColumns = await db.all('PRAGMA table_info(mission_orders)');
    const hasMoTitre = moColumns.some(c => c.name === 'missionary_titre');
    if (!hasMoTitre) {
      await db.run("ALTER TABLE mission_orders ADD COLUMN missionary_titre TEXT DEFAULT 'M.'");
    }

    const hasMoTitreSnapshot = moColumns.some(c => c.name === 'missionary_titre_snapshot');
    if (!hasMoTitreSnapshot) {
      await db.run("ALTER TABLE mission_orders ADD COLUMN missionary_titre_snapshot TEXT DEFAULT 'M.'");
    }

    // 2. Ensure mission_order_requests has applicant_titre
    const reqTable = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='mission_order_requests'");
    if (reqTable) {
      const reqColumns = await db.all('PRAGMA table_info(mission_order_requests)');
      const hasReqTitre = reqColumns.some(c => c.name === 'applicant_titre');
      if (!hasReqTitre) {
        await db.run("ALTER TABLE mission_order_requests ADD COLUMN applicant_titre TEXT DEFAULT 'M.'");
      }
    }

    // 3. Backfill existing mission_orders from staff or users if available
    await db.run(`
      UPDATE mission_orders 
      SET missionary_titre = (
        SELECT COALESCE(s.titre, 'M.') 
        FROM staff s 
        WHERE s.id = mission_orders.missionary_id
      )
      WHERE missionary_id IS NOT NULL AND (missionary_titre IS NULL OR missionary_titre = 'M.')
    `);

    await db.run(`
      UPDATE mission_orders 
      SET missionary_titre_snapshot = missionary_titre 
      WHERE missionary_titre_snapshot IS NULL OR missionary_titre_snapshot = 'M.'
    `);
  },

  async down(db) {
    // SQLite alter table drop column not strictly required
  }
};
