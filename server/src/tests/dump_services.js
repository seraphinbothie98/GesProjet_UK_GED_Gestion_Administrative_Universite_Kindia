const db = require('../database/db');
(async () => {
  const s = await db.all('SELECT id, code, name, reference_code FROM services');
  console.log(s);
})();
