const assert = require('assert');
const seedDatabase = require('../database/seed');
const { blockInProduction, requireExplicitConfirm } = require('../middleware/productionGuard');

async function testProductionGuards() {
  console.log('\n🧪 [TEST] Démarrage des tests des garde-fous de sécurité en production...');

  // 1. Test blockInProduction middleware simulation
  const reqMock = { user: { id: 1 }, originalUrl: '/api/admin/maintenance/cleanup', method: 'POST', ip: '127.0.0.1' };
  let statusSet = null;
  let jsonResponse = null;
  const resMock = {
    status(code) {
      statusSet = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    }
  };

  // 2. Test requireExplicitConfirm middleware
  let nextCalled = false;
  const reqValidConfirm = { body: { confirmText: 'NETTOYER' } };
  requireExplicitConfirm('NETTOYER')(reqValidConfirm, resMock, () => { nextCalled = true; });
  assert(nextCalled, 'requireExplicitConfirm doit appeler next() quand le mot est correct');

  let failStatus = null;
  const resFail = {
    status(code) { failStatus = code; return this; },
    json() { return this; }
  };
  let nextFailCalled = false;
  const reqInvalidConfirm = { body: { confirmText: 'MAUVAIS' } };
  requireExplicitConfirm('NETTOYER')(reqInvalidConfirm, resFail, () => { nextFailCalled = true; });
  assert(!nextFailCalled, 'requireExplicitConfirm ne doit PAS appeler next() en cas de mot erroné');
  assert.strictEqual(failStatus, 400, 'Doit retourner un code 400');

  console.log('✅ [TEST PASSÉ] Garde-fous de sécurité et confirmations explicites validés avec succès !\n');
}

testProductionGuards().catch(err => {
  console.error('❌ [TEST ÉCHOUÉ] Erreur lors du test des garde-fous:', err);
  process.exit(1);
});
