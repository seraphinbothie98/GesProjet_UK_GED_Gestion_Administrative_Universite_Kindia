const db = require('../database/db');

async function checkFK() {
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
  for (const t of tables) {
    const fks = await db.all(`PRAGMA foreign_key_list(${t.name})`);
    for (const fk of fks) {
      if (fk.table.toLowerCase() === 'users') {
        console.log(`Table [${t.name}] column [${fk.from}] -> users(${fk.to}) on_delete=[${fk.on_delete}]`);
      }
    }
  }
}

checkFK().then(() => process.exit(0));
