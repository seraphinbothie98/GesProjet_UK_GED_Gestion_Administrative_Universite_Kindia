# GUIDE DE TRANSFERT ET TEST SUR UN AUTRE ORDINATEUR — UK-GED
**Système de Gestion Électronique des Documents — Université de Kindia**

---

Ce document détaille la procédure complète pour copier l'application **UK-GED** sur une clé USB depuis votre ordinateur actuel (**Ordinateur A**), la transférer sur un deuxième ordinateur (**Ordinateur B**) et la tester dans les mêmes conditions avec toutes les données de test conservées.

---

## 1. Prérequis sur l'ordinateur cible (Ordinateur B)

Pour exécuter UK-GED sur l'Ordinateur B, un seul logiciel est nécessaire :

- **Système d'exploitation** : Windows 10 ou Windows 11 (64 bits).
- **Node.js** : Version LTS recommandée (**Node.js 18.x, 20.x ou 22.x**).
  - *Téléchargement officiel gratuit* : [https://nodejs.org/](https://nodejs.org/) (choisir la version **LTS**).
  - *Installation* : Exécuter l'installateur `.msi` et laisser toutes les options par défaut (cocher la case *Add to PATH*).
- **Navigateur Web** : Google Chrome, Microsoft Edge, Firefox ou Brave.
- **Base de données externe** : **AUCUNE requise !** UK-GED utilise SQLite 3, un moteur embarqué directement dans le projet. Il n'y a donc aucun serveur MySQL ou PostgreSQL à installer.

---

## 2. Procédure de transfert par Clé USB

### Étape 2.1 — Sur l'Ordinateur A (Copie vers la clé USB)
1. Insérez votre clé USB dans l'Ordinateur A.
2. Copiez l'intégralité du dossier du projet :
   ```
   GesProjet_UK_GED_Gestion_Administrative_Universite_Kindia
   ```
   vers votre clé USB.
3. *Astuce pour un transfert plus rapide sur la clé USB* :
   - Si vous copiez le dossier complet avec `node_modules`, le projet fonctionnera immédiatement sur l'Ordinateur B sans avoir besoin d'internet.
   - Si vous préférez un transfert rapide sur la clé USB (moins de fichiers), vous pouvez exclure les dossiers `client/node_modules` et `server/node_modules` lors de la copie, puis exécuter `installer-dependances.bat` sur l'Ordinateur B connecté à Internet.

### Étape 2.2 — Sur l'Ordinateur B (Copie depuis la clé USB)
1. Insérez la clé USB dans l'Ordinateur B.
2. Copiez le dossier du projet depuis la clé USB vers un emplacement local de votre choix sur l'ordinateur B (par exemple sur le Bureau ou dans `C:\Projets\GesProjet_UK_GED_Gestion_Administrative_Universite_Kindia`).
3. Vérifiez que la structure suivante est bien présente :
   ```text
   GesProjet_UK_GED_Gestion_Administrative_Universite_Kindia/
   ├── client/                  (Application Frontend React / Vite)
   ├── server/                  (Serveur Backend Express / Node.js)
   │   ├── data/
   │   │   ├── uk_ged.db        (Base de données SQLite contenant toutes les données de test)
   │   │   └── uk_ged_test_backup.db
   │   └── uploads/             (Fichiers PDF, signatures, logos officiels, modèles Word)
   │       ├── logos/
   │       ├── signatures/
   │       ├── templates/
   │       └── mission_requests/
   ├── start-ukged.bat          (Script de démarrage automatique en 1 clic)
   ├── installer-dependances.bat (Script d'installation des dépendances npm)
   ├── arreter-ukged.bat        (Script pour arrêter proprement les serveurs)
   └── INSTALLATION-TEST.md     (Ce guide d'instructions)
   ```

---

## 3. Installation des dépendances (Si nécessaire)

- Si les dossiers `node_modules` ont été transférés avec la clé USB : **Passez directement à l'étape 4.**
- Si les dossiers `node_modules` n'étaient pas présents :
  - Double-cliquez simplement sur le fichier **`installer-dependances.bat`** à la racine du projet.
  - Ou ouvrez une invite de commandes dans le projet et lancez :
    ```cmd
    cd server && npm install
    cd ../client && npm install
    ```

---

## 4. Démarrage de UK-GED

1. Double-cliquez sur le fichier :
   ```
   start-ukged.bat
   ```
2. Le script effectue automatiquement :
   - La vérification de Node.js.
   - La vérification de la base de données `uk_ged.db` et des dossiers de stockage.
   - Le démarrage du serveur backend sur le port **5000**.
   - Le démarrage du client frontend sur le port **3000**.
   - L'ouverture automatique de votre navigateur par défaut à l'adresse :
     ```
     http://localhost:3000
     ```

---

## 5. Adresse locale et configuration réseau

- **Adresse dans le navigateur sur l'ordinateur B** :
  ```
  http://localhost:3000
  ```
- **Pas d'adresse IP en dur** :
  - Le projet utilise des liaisons dynamiques et relatives (`localhost` / `127.0.0.1` et `0.0.0.0`).
  - Il ne dépend d'aucune adresse IP fixe de l'ordinateur A (aucune dépendance envers `10.103.137.236` ou autre adresse spécifique).
  - L'application s'adapte immédiatement aux paramètres réseau de la nouvelle machine.

---

## 6. Comptes de test disponibles pour la connexion

L'application affiche directement la page d'authentification officielle de l'Université de Kindia. Vous pouvez tester les différents circuits avec les comptes suivants :

| Rôle | Identifiant (Email) | Mot de passe | Permissions clés |
| :--- | :--- | :--- | :--- |
| **Administrateur Général** | `admin@univ-kindia.edu.gn` | `Admin123!` | Accès complet, gestion rôles, utilisateurs, maintenance, corbeille |
| **Secrétariat Central** | `sc@univ-kindia.edu.gn` | `Agent123!` | Enregistrement courriers, création ordres de mission, remise, archives |
| **Secrétaire Général** | `sg@univ-kindia.edu.gn` | `Sg123!` | Validation & signature documents / ordres de mission, orientation |
| **Recteur** | `recteur@univ-kindia.edu.gn` | `Recteur123!` | Haute autorité, visa, signature officielle, arbitrage |
| **Chef de Service (DAF)** | `daf@univ-kindia.edu.gn` | `Daf123!` | Traitement des dossiers de sa division, transmission, annotation |
| **Responsable (Contrôle Fin.)** | `cf@univ-kindia.edu.gn` | `Cf123!` | Examen budgétaire, visa administratif, espace responsable |
| **Enseignant-Chercheur 1** | `ec1@univ-kindia.edu.gn` | `Ec123!` | Demandes d'ordres de mission en ligne, suivi de dossier |
| **Enseignant-Chercheur 2** | `ec2@univ-kindia.edu.gn` | `Ec123!` | Consultation, demandes d'audience et RDV |

---

## 7. Grille de vérification des tests sur l'ordinateur B

Après le lancement de l'application, vous pouvez valider point par point le bon fonctionnement de l'ensemble des modules :

- [x] **1. Démarrage** : Les 2 serveurs (Backend port 5000 et Frontend port 3000) s'exécutent sans message d'erreur.
- [x] **2. Page de connexion** : L'interface s'affiche avec le design moderne, le blason de l'Université de Kindia et les champs d'identification.
- [x] **3. Authentification** : Connexion réussie avec le compte Administrateur (`admin@univ-kindia.edu.gn`).
- [x] **4. Utilisateurs & Services** : Les 30 services préconfigurés et les utilisateurs de test sont bien répertoriés.
- [x] **5. Matrice des Rôles & Permissions** : Les privilèges stricts par rôle sont appliqués.
- [x] **6. Courriers & Documents** : La liste des courriers entrants et sortants enregistrés est visible.
- [x] **7. Prévisualisation des pièces jointes** : Les fichiers PDF et images s'affichent correctement dans la visionneuse intégrée.
- [x] **8. Logo officiel** : Le logo de l'Université de Kindia s'affiche sur les en-têtes et les documents générés.
- [x] **9. Signatures électroniques** : Les signatures des autorités (SG, Recteur) sont présentes et fonctionnelles.
- [x] **10. Modèles de documents** : Les modèles administratifs (Soit-Transmis, Ordre de Mission, Note de Service) sont éditables et personnalisables.
- [x] **11. Ordres de mission** : Le circuit de création (SC), transmission, signature (SG/Recteur), remise et archivage fonctionne intégralement.
- [x] **12. Missionnaires externes** : Le registre des missionnaires extérieurs (visa d'arrivée, visa de départ, document signé) est opérationnel.
- [x] **13. Demandes d'ordres de mission en ligne** : Formulaire de demande autonome avec jeton de suivi public.
- [x] **14. Rendez-vous & Audiences** : Le module d'agenda, demandes de RDV et créneaux horaires est disponible.
- [x] **15. Espace Mobile Responsable** : Interface optimisée pour la prise de décision rapide et la signature depuis tablette ou mobile.
- [x] **16. Journal d'Audit & Historique** : Traçabilité complète de chaque action effectuée sur les dossiers.

---

## 8. Arrêt de l'application

Pour arrêter UK-GED :
- Double-cliquez simplement sur **`arreter-ukged.bat`** à la racine du projet.
- Ou fermez manuellement les deux fenêtres de terminal ouvertes lors du lancement.
