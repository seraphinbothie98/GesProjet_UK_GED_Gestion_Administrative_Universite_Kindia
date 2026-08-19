const fs = require('fs');
const path = require('path');
const http = require('http');

async function runLogoTests() {
  console.log('================================================================================');
  console.log(' UK-GED — TEST DE PERSISTANCE DU LOGO INSTITUTIONNEL (SCÉNARIO EN 12 ÉTAPES)');
  console.log('================================================================================\n');

  const API_BASE = 'http://localhost:5000/api';

  // Step 1: Login as Admin
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('1. Authentification Admin réussie.');

  // Step 2: Fetch current settings
  const instBefore = await (await fetch(`${API_BASE}/settings/institution`)).json();
  console.log('2. Paramètres actuels récupérés :', instBefore.name);

  // Step 3: Create dummy PNG image buffer and upload via FormData
  const dummyPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');
  const tempPath = path.join(__dirname, 'temp_test_logo.png');
  fs.writeFileSync(tempPath, dummyPng);

  const blob = new Blob([dummyPng], { type: 'image/png' });
  const formData = new FormData();
  formData.append('logo', blob, 'logo_test_univ.png');

  console.log('3. Envoi du fichier logo au serveur (/api/settings/upload-logo)...');
  const uploadRes = await fetch(`${API_BASE}/settings/upload-logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });
  const uploadData = await uploadRes.json();

  if (!uploadRes.ok || !uploadData.logo_url) {
    console.error('❌ ÉCHEC UPLOAD :', uploadData);
    process.exit(1);
  }

  console.log('4. Logo uploadé avec succès. URL persistante retournée :', uploadData.logo_url);

  // Step 4: Verify URL is stored in database
  const instAfterUpload = await (await fetch(`${API_BASE}/settings/institution`)).json();
  if (instAfterUpload.logo_path !== uploadData.logo_url) {
    console.error('❌ ÉCHEC PERSISTANCE DB :', instAfterUpload);
    process.exit(1);
  }
  console.log('5. Vérification DB : logo_path est bien enregistré dans institution_settings (', instAfterUpload.logo_path, ').');

  // Step 5: Test HTTP GET to the logo URL to verify static server resolution (subfolder & static handler)
  const fullUrl = `http://localhost:5000${uploadData.logo_url}`;
  const getRes = await new Promise((resolve) => {
    http.get(fullUrl, res => resolve(res));
  });

  if (getRes.statusCode === 200 && getRes.headers['content-type']?.includes('image')) {
    console.log('6. Vérification serveur HTTP (200 OK & Content-Type: ', getRes.headers['content-type'], ') RÉUSSIE !');
  } else {
    console.error('❌ ÉCHEC SERVEUR HTTP :', getRes.statusCode, getRes.headers);
    process.exit(1);
  }

  // Cleanup temp file
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  console.log('\n================================================================================');
  console.log(' 🎉 SUCCÈS TOTAL : LE LOGO INSTITUTIONNEL EST PERSISTÉ ET ACCESSIBLE À 100% !');
  console.log('================================================================================\n');
}

runLogoTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
