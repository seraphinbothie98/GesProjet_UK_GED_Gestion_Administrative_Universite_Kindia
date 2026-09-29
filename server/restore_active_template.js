const db = require('./src/database/db');

async function restore() {
  await db.run("UPDATE mission_order_templates SET is_default = 0, status = 'INACTIVE'");
  const template = await db.get("SELECT id FROM mission_order_templates WHERE file_path LIKE '%1789520288956%' OR file_name LIKE '%ORDRE_Mission%' ORDER BY id DESC LIMIT 1");
  if (template) {
    await db.run("UPDATE mission_order_templates SET is_default = 1, status = 'ACTIVE' WHERE id = ?", [template.id]);
    console.log('Restored template ID', template.id, 'as active default.');
  }
  const active = await db.get("SELECT id, name, file_name, file_path, is_default, version_number FROM mission_order_templates WHERE is_default = 1");
  console.log('Active default template is now:', active);
}

restore().catch(console.error);
