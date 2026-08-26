# Guide de Déploiement UK-GED - Université de Kindia

Ce guide décrit l'architecture et le cycle de vie de déploiement de **UK-GED** à travers ses 3 environnements strictement isolés : **Développement**, **Staging (Préproduction)** et **Production**.

---

## 1. Vue d'Ensemble des Environnements

```
[ Développeur (Antigravity) ]
              ↓
  1. Développement Local (http://localhost:3000 | uk_ged_dev.db)
              ↓ Tests & Git Commit / Tag
  2. Staging / Préproduction (https://staging-ged.universite.edu | uk_ged_staging.db)
              ↓ Validation Métier & Tests de Non-Régression
  3. Production (https://ged.universite.edu | uk_ged_production.db)
              ↳ Sauvegarde Préalable Obligatoire (Zéro Perte)
              ↳ Migrations de Schéma Versionnées
              ↳ Health Check & Supervision
```

---

## 2. Procédure de Déploiement en 12 Étapes Obligatoires

| Étape | Phase | Action Réalisée | Outil / Commande |
| :--- | :--- | :--- | :--- |
| **1** | **Développement** | Ajout de fonctionnalités ou correctifs | IDE / Antigravity |
| **2** | **Tests Locaux** | Exécution des tests unitaires et d'intégration | `npm test` |
| **3** | **Versionnement** | Tag Git versionné (ex: `v1.2.0`) | `git tag -a v1.2.0 -m "Release v1.2.0"` |
| **4** | **Staging Deploy** | Déploiement sur serveur de Staging | `npm run deploy` (sur Staging) |
| **5** | **Migrations Staging** | Exécution automatique des migrations | `npm run migrate:up` |
| **6** | **Validation Staging** | Recette fonctionnelle sur `staging-ged.universite.edu` | Navigateur / Responsables |
| **7** | **Backup Production** | Création de l'archive de sécurité (Base + Uploads) | `npm run backup` (automatisé) |
| **8** | **Vérification Backup**| Test d'intégrité SHA256 & sandbox de l'archive | `npm run verify-backup` |
| **9** | **Déploiement Prod** | Mise à jour du code de production | `npm run deploy` (sur Prod) |
| **10**| **Migrations Prod** | Application des migrations validées | `npm run migrate:up` |
| **11**| **Health Check** | Contrôle de santé global (`/api/health`) | `curl -f https://ged.universite.edu/api/health` |
| **12**| **Validation Finale** | Release active et opérationnelle | Rapport de livraison |

---

## 3. Commandes Utiles

### Déploiement Automatisé
```bash
cd server
npm run deploy
```
*Le script `deploy.js` effectue automatiquement la sauvegarde préalable, sa vérification d'intégrité, et l'application des migrations.*

### Contrôle de Santé
```bash
curl https://ged.universite.edu/api/health
```

### Rollback en cas d'incident
```bash
# Annulation de la dernière migration
node src/scripts/rollback.js --steps 1 --force-production

# Ou restauration complète de l'archive pré-déploiement
node src/scripts/restore.js /var/uk_ged/backups/prod/uk_ged_backup_production_YYYYMMDD.zip --confirm RESTAURER_PRODUCTION
```
