# Guide de Sauvegarde et Restauration UK-GED

Ce manuel décrit la stratégie de sauvegarde intégrale (Base de Données + Fichiers Uploadés), les politiques de rétention et la procédure de restauration.

---

## 1. Contenu d'une Sauvegarde Complète

Une sauvegarde UK-GED génère une archive ZIP horodatée contenant :
- `database.db` : Fichier binaire exact de la base de données.
- `database_dump.sql` : Export SQL complet table par table lisible et portable.
- `manifest.json` : Métadonnées, métriques de tables, empreintes cryptographiques SHA256 de chaque fichier.
- `storage/` : Répertoire complet des fichiers téléversés (PDF, DOCX, logos, cachets, signatures électroniques, décharges).

---

## 2. Déclencher une Sauvegarde

### Sauvegarde Manuelle
```bash
cd server
npm run backup
# Ou avec tag personnalisé :
node src/scripts/backup.js --tag AVANT_MAJ_ANNUELLE --desc "Sauvegarde annuelle de rentrée"
```

### Automatisation par Tâche Cron (Production Linux)
Ajoutez dans le `crontab` de l'administrateur système :
```cron
# Sauvegarde quotidienne automatique à 02h00 du matin
0 2 * * * cd /var/www/uk_ged/server && NODE_ENV=production npm run backup >> /var/log/uk_ged_backups.log 2>&1
```

---

## 3. Politique de Rétention Automatique

Le service de sauvegarde applique automatiquement les durées de rétention configurées :
- **Sauvegardes quotidiennes** : Conservées pendant **30 jours** (configurable via `BACKUP_RETENTION_DAILY_DAYS`).
- **Sauvegardes hebdomadaires** : Conservées pendant **12 semaines** (`BACKUP_RETENTION_WEEKLY_WEEKS`).
- **Sauvegardes mensuelles** : Conservées pendant **12 mois** (`BACKUP_RETENTION_MONTHLY_MONTHS`).

---

## 4. Vérification d'Intégrité de Sauvegarde

Pour tester la validité d'une archive sans impacter la production :
```bash
npm run verify-backup /var/uk_ged/backups/prod/uk_ged_backup_production_20260824120000.zip
```

---

## 5. Procédure de Restauration

La restauration nécessite une confirmation explicite pour éviter toute erreur humaine :

### En Environnement Staging / Dev :
```bash
node src/scripts/restore.js /chemin/vers/archive.zip --confirm RESTAURER
```

### En Environnement de Production :
```bash
node src/scripts/restore.js /var/uk_ged/backups/prod/archive.zip --confirm RESTAURER_PRODUCTION
```
*Note de sécurité : Le script effectue automatiquement une sauvegarde pré-restauration de secours avant d'écraser la base.*
