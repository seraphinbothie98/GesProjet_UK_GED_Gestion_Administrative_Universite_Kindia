async function testUpdate() {
  const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' })
  });
  const { token } = await loginRes.json();

  const updateRes = await fetch('http://127.0.0.1:5000/api/services/32', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      name: 'Département d’Informatique et Télécommunications',
      reference_code: 'FS/INFO',
      structure_type: 'DEPARTEMENT'
    })
  });
  const updateData = await updateRes.json();
  console.log('Update result:', updateData);
}

testUpdate();
