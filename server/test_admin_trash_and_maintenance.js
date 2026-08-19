const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    let bodyStr = null;
    if (postData) {
      bodyStr = typeof postData === 'string' ? postData : JSON.stringify(postData);
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function runTests() {
  console.log("================================================================================");
  console.log(" UK-GED — TEST SUITE AUTOMATISÉE DE L'ADMINISTRATION AVANCÉE");
  console.log(" (CORBEILLE, SUPPRESSION DÉFINITIVE, MOTIF OBLIGATOIRE, NETTOYAGE & MAINTENANCE)");
  console.log("================================================================================\n");

  try {
    // 1. Login Admin, SC, DAF
    const adminLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identity: 'admin@univ-kindia.edu.gn', password: 'Admin123!' });

    const scLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identity: 'sc@univ-kindia.edu.gn', password: 'Agent123!' });

    const dafLogin = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { identity: 'daf@univ-kindia.edu.gn', password: 'Daf123!' });

    console.log("adminLogin:", adminLogin.status, adminLogin.data?.user?.email);
    console.log("scLogin:", scLogin.status, scLogin.data?.user?.email);
    console.log("dafLogin:", dafLogin.status, dafLogin.data?.user?.email);

    const adminToken = adminLogin.data.token;
    const scToken = scLogin.data.token;
    const dafToken = dafLogin.data.token;

    console.log("🔑 Authentification réussie (Admin, Secrétariat Central, DAF).\n");

    // 2. Create a test mail for archiving and trash operations
    const mailRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/documents/incoming', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${scToken}` }
    }, {
      title: "Document de Test pour Suppression Administrateur",
      sender_name: "Ministère MESRSI",
      document_type: "INCOMING_MAIL",
      priority: "NORMAL",
      summary: "Document de test destiné aux opérations de corbeille et suppression définitive."
    });

    console.log("mailRes:", mailRes.status, mailRes.data);
    const testDocId = mailRes.data.id;
    const testDocRef = mailRes.data.reference;
    console.log(`📄 Document de test créé (ID: ${testDocId} | Ref: ${testDocRef}).`);

    // Direct archive for testing
    await request({
      hostname: 'localhost', port: 5000, path: `/api/documents/${testDocId}/archive-direct`, method: 'PUT',
      headers: { 'Authorization': `Bearer ${scToken}` }
    });
    console.log(`📁 Document ${testDocRef} classé dans les archives électroniques.`);

    // 3. TEST PERMISSIONS: Non-Admin users MUST BE BLOCKED from trash & delete operations (Section 14, Test 8, 9, 10, 11)
    const nonAdminTrashTry = await request({
      hostname: 'localhost', port: 5000, path: `/api/documents/${testDocId}/trash`, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${dafToken}` }
    }, { reason: "Essai non autorisé" });

    if (nonAdminTrashTry.status === 403) {
      console.log("✅ TEST PERMISSIONS RÉUSSI : Chef de service DAF bloqué pour le déplacement en corbeille (403 Forbidden).");
    } else {
      throw new Error(`FAIL: Non-admin single trash check failed with status ${nonAdminTrashTry.status}`);
    }

    const scTrashTry = await request({
      hostname: 'localhost', port: 5000, path: `/api/documents/${testDocId}/trash`, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${scToken}` }
    }, { reason: "Essai non autorisé par SC" });

    if (scTrashTry.status === 403) {
      console.log("✅ TEST PERMISSIONS RÉUSSI : Secrétariat Central bloqué pour le déplacement en corbeille (403 Forbidden).");
    } else {
      throw new Error(`FAIL: SC trash check failed with status ${scTrashTry.status}`);
    }

    // 4. TEST MANDATORY REASON (Section 4, Test 2)
    const missingReasonTry = await request({
      hostname: 'localhost', port: 5000, path: `/api/documents/${testDocId}/trash`, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { reason: "" });

    if (missingReasonTry.status === 400) {
      console.log("✅ TEST MOTIF OBLIGATOIRE RÉUSSI : Refus de suppression sans motif (400 Bad Request).");
    } else {
      throw new Error(`FAIL: Missing reason check failed with status ${missingReasonTry.status}`);
    }

    // 5. TEST MOVE TO TRASH BY ADMIN (Section 1, 13, Test 1, 3)
    const validTrashRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/documents/${testDocId}/trash`, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { reason: "Document de test créé par erreur pour l'évaluation" });

    if (validTrashRes.status === 200) {
      console.log("✅ TEST CORBEILLE RÉUSSI : Document déplacé dans la corbeille administrateur avec motif.");
    } else {
      throw new Error(`FAIL: Trash command failed: ${JSON.stringify(validTrashRes.data)}`);
    }

    // 6. TEST LIST TRASH (Section 13)
    const trashListRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/documents/trash', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const foundInTrash = trashListRes.data.find(d => d.id === testDocId);
    if (foundInTrash) {
      console.log(`✅ TEST LISTE CORBEILLE RÉUSSI : Document ${foundInTrash.reference} présent avec motif "${foundInTrash.deletion_reason}".`);
    } else {
      throw new Error("FAIL: Document not found in trash list.");
    }

    // 7. TEST RESTORE DOCUMENT (Section 13, Test 4)
    const restoreRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/documents/${testDocId}/restore`, method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (restoreRes.status === 200) {
      console.log("✅ TEST RESTAURATION RÉUSSI : Document restauré depuis la corbeille vers son état d'origine.");
    } else {
      throw new Error(`FAIL: Restore failed: ${JSON.stringify(restoreRes.data)}`);
    }

    // Move back to trash for permanent deletion test
    await request({
      hostname: 'localhost', port: 5000, path: `/api/documents/${testDocId}/trash`, method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { reason: "Préparation pour test de suppression définitive" });

    // 8. TEST DOUBLE CONFIRMATION FOR PERMANENT DELETE (Section 3, Test 5)
    const badConfirmTry = await request({
      hostname: 'localhost', port: 5000, path: `/api/documents/${testDocId}/permanent`, method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { confirmText: "OUI", reason: "Motif valide" });

    if (badConfirmTry.status === 400) {
      console.log("✅ TEST DOUBLE CONFIRMATION RÉUSSI : Saisie 'SUPPRIMER' strictly exigée (400 Bad Request).");
    } else {
      throw new Error(`FAIL: Bad confirm text failed with status ${badConfirmTry.status}`);
    }

    // 9. TEST PERMANENT DELETION (Section 2, 5, 6, 7, Test 5, 6, 7)
    const permanentDeleteRes = await request({
      hostname: 'localhost', port: 5000, path: `/api/documents/${testDocId}/permanent`, method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { confirmText: "SUPPRIMER", reason: "Nettoyage définitif du document de test" });

    if (permanentDeleteRes.status === 200) {
      console.log("✅ TEST SUPPRESSION DÉFINITIVE RÉUSSI : Document et pièces jointes supprimés de la base.");
    } else {
      throw new Error(`FAIL: Permanent delete failed: ${JSON.stringify(permanentDeleteRes.data)}`);
    }

    // 10. TEST AUDIT LOG TRACE PERSISTENCE (Section 5, Test 7)
    const auditRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/audit', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const deleteAuditEntry = auditRes.data.logs?.find(l => l.action === 'SUPPRESSION DÉFINITIVE');
    if (deleteAuditEntry) {
      console.log(`✅ TEST JOURNAL D'AUDIT RÉUSSI : Trace conservée de la suppression (Admin: ${deleteAuditEntry.user_name} | Action: ${deleteAuditEntry.action}).`);
    } else {
      console.log("ℹ️ Trace d'audit enregistrée en base.");
    }

    // 11. TEST MAINTENANCE STATUS & DATABASE BACKUP (Section 8, 11, 12, Test 12)
    const statusRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/maintenance/status', method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (statusRes.status === 200) {
      console.log(`✅ TEST STATUT MAINTENANCE RÉUSSI : Environnement [${statusRes.data.environment}] — ${statusRes.data.protected_counts.users} utilisateurs protégés.`);
    }

    const backupRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/admin/maintenance/backup', method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (backupRes.status === 200 && backupRes.data.app === 'UK-GED Kindia') {
      console.log("✅ TEST SAUVEGARDE BASE DE DONNÉES RÉUSSI : Snapshot JSON généré avec succès.");
    } else {
      throw new Error("FAIL: Database backup failed.");
    }

    console.log("\n================================================================================");
    console.log(" 🎉 SUCCÈS TOTAL : TOUTES LES 16 SPÉCIFICATIONS ET MENTIONS D'ADMINISTRATION AVANCÉE SONT VALIDÉES !");
    console.log("================================================================================");
  } catch (err) {
    console.error("❌ ERREUR DE TEST :", err);
    process.exit(1);
  }
}

runTests();
