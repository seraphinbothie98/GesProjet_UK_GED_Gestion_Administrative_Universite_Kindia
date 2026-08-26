# Guide d'Exploitation Production - UK-GED

Ce guide est destiné aux administrateurs système et équipes d'infrastructure responsables du sous-domaine institutionnel :
**`https://ged.universite.edu`**

---

## 1. Prérequis & Architecture Serveur

- **Système d'exploitation** : Ubuntu Server 22.04 LTS ou 24.04 LTS (ou Debian 12)
- **Runtime** : Node.js LTS (v20.x recommandé)
- **Reverse Proxy** : Nginx avec support HTTP/2 et certificat SSL Let's Encrypt / Certbot
- **Gestionnaire de Processus** : PM2 ou Docker Compose

---

## 2. Variables d'Environnement de Production

Fichier : `/var/www/uk_ged/server/.env.production`

```ini
NODE_ENV=production
PORT=5000
APP_VERSION=1.0.0
APP_URL=https://ged.universite.edu

DATABASE_PATH=/var/uk_ged/data/uk_ged_production.db
STORAGE_PATH=/var/uk_ged/storage/prod
BACKUP_DIR=/var/uk_ged/backups/prod

JWT_SECRET=VOTRE_CLE_HAUTE_SECURITE_64_CARACTERES
JWT_EXPIRES_IN=12h

BACKUP_RETENTION_DAILY_DAYS=30
BACKUP_RETENTION_WEEKLY_WEEKS=12
BACKUP_RETENTION_MONTHLY_MONTHS=12
```

---

## 3. Démarrage avec PM2

```bash
# Installation de PM2
npm install -g pm2

# Lancement de l'application en mode cluster
NODE_ENV=production pm2 start src/index.js --name "uk-ged-prod" -i max

# Sauvegarde de la configuration PM2 pour démarrage automatique au boot
pm2 save
pm2 startup
```

---

## 4. Surveillance & Supervision

- **Supervision HTTP** : Endpoint `https://ged.universite.edu/api/health`
- **Logs applicatifs** : `pm2 logs uk-ged-prod`
- **Logs Nginx** : `/var/log/nginx/uk_ged_production_access.log` et `/var/log/nginx/uk_ged_production_error.log`
