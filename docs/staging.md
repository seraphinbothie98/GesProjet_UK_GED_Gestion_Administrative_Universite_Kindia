# Guide de l'Environnement de Staging (Préproduction) - UK-GED

L'environnement de Staging est l'instance miroir de test accessible sur :
**`https://staging-ged.universite.edu`**

---

## 1. Rôle du Staging

L'instance de staging a pour mission :
1. Valider les nouvelles fonctionnalités développées avec Antigravity avant mise en production.
2. Tester en conditions réelles l'application des migrations de base de données.
3. Vérifier les circuits de validation, les rôles administratifs et les téléchargements de documents sans toucher aux données réelles.
4. Réaliser des tests de non-régression.

---

## 2. Configuration Staging

Fichier : `server/.env.staging`

```ini
NODE_ENV=staging
PORT=5001
APP_VERSION=1.0.0
APP_URL=https://staging-ged.universite.edu

DATABASE_PATH=./data/staging/uk_ged_staging.db
STORAGE_PATH=./uploads/staging
BACKUP_DIR=../backups/staging

JWT_SECRET=uk_ged_staging_secret_key_universite_kindia_2026_preprod
JWT_EXPIRES_IN=24h
```

---

## 3. Déploiement sur Staging

```bash
# Déploiement Staging
cd server
NODE_ENV=staging npm run deploy
```

---

## 4. Règles d'Isolation Staging

- **Base de données indépendante** : `uk_ged_staging.db` est totalement étanche de la base de production.
- **Stockage indépendant** : `uploads/staging/` héberge les fichiers de test.
- **Interdiction de données sensibles réelles** : Seules des données de test ou anonymisées doivent être utilisées.
