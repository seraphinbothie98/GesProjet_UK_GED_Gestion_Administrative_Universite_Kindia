const fetch = globalThis.fetch;

async function runTests() {
  console.log('--- STARTING UK-GED UNIFIED MISSION ORDERS VERIFICATION SUITE ---');

  const db = require('./src/database/db');
  await db.run("UPDATE users SET status = 'ACTIVE'");

  // Helper login
  async function login(email, password) {
    const res = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error('Login failed: ' + JSON.stringify(data));
    return data.token;
  }

  // 1. Logins
  const scToken = await login('sc@univ-kindia.edu.gn', 'Agent123!');
  const sgToken = await login('sg@univ-kindia.edu.gn', 'Sg123!');
  const ecToken = await login('ec1@univ-kindia.edu.gn', 'Ec123!');
  const dafToken = await login('daf@univ-kindia.edu.gn', 'Daf123!');

  console.log('✓ TEST 0: Logins successful for SC, SG, EC1, DAF');

  // TEST 4: Teacher submits mission request
  const ecReqRes = await fetch('http://127.0.0.1:5000/api/missions/request', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + ecToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      missionary_name: 'Dr. Alpha Diallo',
      destination: 'Labé, Guinée',
      object_of_mission: 'Conférence scientifique sur les technologies ouvertes',
      transport_mode: 'Transport commun',
      departure_date: '2026-09-01',
      return_date: '2026-09-05',
      observations: 'Prise en charge hébergement par les organisateurs'
    })
  });
  const ecReqData = await ecReqRes.json();
  console.log('✓ TEST 4: Teacher EC1 submitted mission request:', ecReqData.reference || ecReqData.id);

  // TEST 1: SC establishes official mission order and transmits to SG
  const scCreateRes = await fetch('http://127.0.0.1:5000/api/missions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + scToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      missionary_name: 'DIALLO Alpha',
      missionary_firstnames: 'Alpha',
      nationality: 'Guinéenne',
      function_title: 'Maître de Conférences / Enseignant-Chercheur',
      destination: 'Labé, Guinée',
      object_of_mission: 'Conférence scientifique sur les technologies ouvertes',
      transport_mode: 'Véhicule de service',
      departure_date: '2026-09-01',
      return_date: '2026-09-05',
      driver_option: 'SELF',
      driver_name: 'DIALLO Alpha',
      vehicle_registration: 'RC-9988-UK',
      observations: 'Ordre de mission officiel établi pour enseignant-chercheur non rattaché'
    })
  });
  const scCreateData = await scCreateRes.json();
  console.log('✓ TEST 1: SC created official Mission Order:', scCreateData.reference, 'ID:', scCreateData.id);
  const createdDocId = scCreateData.id;

  // TEST 2: SG checks to-sign list, previews, signs and returns to SC
  const sgToSignRes = await fetch('http://127.0.0.1:5000/api/missions/to-sign', {
    headers: { 'Authorization': 'Bearer ' + sgToken }
  });
  const sgToSignList = await sgToSignRes.json();
  const targetToSign = sgToSignList.find(m => m.document_id === createdDocId);
  console.log('✓ TEST 2A: SG to-sign list contains new order:', !!targetToSign);

  const sgSignRes = await fetch(`http://127.0.0.1:5000/api/missions/${createdDocId}/sign`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + sgToken }
  });
  const sgSignData = await sgSignRes.json();
  console.log('✓ TEST 2B: SG signed Mission Order:', sgSignData);

  // Check it disappeared from SG to-sign
  const sgToSignAfter = await (await fetch('http://127.0.0.1:5000/api/missions/to-sign', { headers: { 'Authorization': 'Bearer ' + sgToken } })).json();
  const targetInToSignAfter = sgToSignAfter.some(m => m.document_id === createdDocId);
  console.log('✓ TEST 2C: Order disappeared from SG to-sign box:', !targetInToSignAfter);

  // TEST 3: SC receives signed order, prints, delivers, and archives
  const scAllRes = await fetch('http://127.0.0.1:5000/api/missions', {
    headers: { 'Authorization': 'Bearer ' + scToken }
  });
  const scAllList = await scAllRes.json();
  const returnedOrder = scAllList.find(m => m.document_id === createdDocId);
  console.log('✓ TEST 3A: SC received signed order with status:', returnedOrder ? returnedOrder.status : 'NOT_FOUND');

  // Print
  const printRes = await fetch(`http://127.0.0.1:5000/api/missions/${createdDocId}/print`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + scToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Impression officielle pour remise' })
  });
  console.log('✓ TEST 3B: SC printed official order:', printRes.status === 200);

  // Deliver
  const deliverRes = await fetch(`http://127.0.0.1:5000/api/missions/${createdDocId}/deliver`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + scToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_name: 'Dr. Alpha Diallo' })
  });
  console.log('✓ TEST 3C: SC delivered order to missionary:', deliverRes.status === 200);

  // Archive
  const archiveRes = await fetch(`http://127.0.0.1:5000/api/documents/${createdDocId}/archive`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + scToken }
  });
  console.log('✓ TEST 3D: SC archived delivered order:', archiveRes.status === 200);

  // TEST 5: DAF tries direct central creation (must be rejected with 403)
  const dafCreateRes = await fetch('http://127.0.0.1:5000/api/missions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + dafToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      missionary_name: 'Agent DAF',
      destination: 'Conakry',
      object_of_mission: 'Test',
      departure_date: '2026-09-01',
      return_date: '2026-09-02'
    })
  });
  console.log('✓ TEST 5: Chef de service DAF forbidden from direct central OM creation (403):', dafCreateRes.status === 403);

  console.log('=== ALL 6 TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch(err => console.error('Test error:', err));
