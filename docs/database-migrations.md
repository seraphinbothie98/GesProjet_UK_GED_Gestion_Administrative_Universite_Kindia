# Guide des Migrations de Base de Données UK-GED

Ce document détaille le fonctionnement du système de migrations versionnées et la **Règle Zéro Perte de Données**.

---

## 1. Principes Fondamentaux

1. **Aucun Reset Automatique** : La base de données de production n'est **jamais** réinitialisée ni écrasée.
2. **Migrations Additives** : Les modifications de schéma sont toujours additives (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`).
3. **Traçabilité Totale** : Chaque migration exécutée est enregistrée dans la table `_schema_migrations` avec sa date, son lot (*batch*), son empreinte SHA256 et sa durée.
4. **Transactions Atomiques** : Chaque fichier de migration s'exécute dans une transaction (`BEGIN TRANSACTION` -> `COMMIT` / `ROLLBACK`).

---

## 2. Structure des Migrations

Les fichiers de migration sont situés dans `server/src/database/migrations/` :

```
migrations/
├── 001_core_schema.js
├── 002_administrative_hierarchy_and_heads.js
├── 003_archive_categories_and_shares.js
├── 004_service_document_settings_and_dynamic_fields.js
├── 005_templates_signatures_and_versions.js
└── 006_dispatches_receipts_and_tracking.js
```

---

## 3. Créer une Nouvelle Migration

Pour ajouter une nouvelle table ou colonne :

```bash
cd server
npm run migrate:create add_notification_preferences
```

Cela génère un fichier squelette horodaté `YYYYMMDDHHMMSS_add_notification_preferences.js` :

```javascript
module.exports = {
  async up(db) {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        email_enabled INTEGER DEFAULT 1,
        sms_enabled INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  },

  async down(db) {
    // Procédure d'annulation (si réversible de façon sûre)
  }
};
```

---

## 4. Commandes de Gestion des Migrations

```bash
# Vérifier l'état des migrations (appliquées / en attente)
npm run migrate:status

# Appliquer toutes les migrations en attente
npm run migrate:up

# Annuler le dernier lot de migrations (Rollback)
npm run migrate:down
```
