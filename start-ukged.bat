@echo off
chcp 65001 >nul
title UK-GED - Système de Gestion Électronique des Documents (Université de Kindia)
color 0B

echo ===============================================================================
echo       UNIVERSITÉ DE KINDIA - APPLICATION UK-GED (VERSION DE TEST)
echo ===============================================================================
echo.

:: 1. Vérification de la présence de Node.js
echo [1/4] Vérification de l'environnement Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [ERREUR] Node.js n'est pas installé ou n'est pas reconnu dans le PATH de Windows.
    echo.
    echo Veuillez installer Node.js (Version LTS 18, 20 ou 22 recommandée) :
    echo https://nodejs.org/
    echo.
    echo Après installation, redémarrez ce script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo     -^> Node.js détecté : %NODE_VER% (OK)

:: 2. Vérification des dossiers et fichiers de données
echo [2/4] Vérification de la base de données et des répertoires de stockage...
if not exist "%~dp0server\data" mkdir "%~dp0server\data"
if not exist "%~dp0server\uploads" mkdir "%~dp0server\uploads"
if not exist "%~dp0server\uploads\logos" mkdir "%~dp0server\uploads\logos"
if not exist "%~dp0server\uploads\signatures" mkdir "%~dp0server\uploads\signatures"
if not exist "%~dp0server\uploads\templates" mkdir "%~dp0server\uploads\templates"
if not exist "%~dp0server\uploads\mission_requests" mkdir "%~dp0server\uploads\mission_requests"

if exist "%~dp0server\data\uk_ged.db" (
    echo     -^> Base de données SQLite locale trouvée : server\data\uk_ged.db (OK)
) else (
    if exist "%~dp0server\data\uk_ged_test_backup.db" (
        echo     -^> Restauration de la base de test depuis la sauvegarde...
        copy "%~dp0server\data\uk_ged_test_backup.db" "%~dp0server\data\uk_ged.db" >nul
        echo     -^> Base de données restaurée avec succès (OK)
    ) else (
        echo     -^> Nouvelle base de données qui sera initialisée au démarrage.
    )
)

:: 3. Vérification des dépendances (node_modules)
echo [3/4] Vérification des modules applicatifs...
if not exist "%~dp0server\node_modules" (
    echo     -^> Installation des modules du Serveur Backend (veuillez patienter)...
    cd /d "%~dp0server"
    call npm install
    cd /d "%~dp0"
) else (
    echo     -^> Modules Backend prêts (OK)
)

if not exist "%~dp0client\node_modules" (
    echo     -^> Installation des modules du Client Frontend (veuillez patienter)...
    cd /d "%~dp0client"
    call npm install
    cd /d "%~dp0"
) else (
    echo     -^> Modules Frontend prêts (OK)
)

:: 4. Lancement des serveurs
echo [4/4] Démarrage des serveurs UK-GED...
echo.
echo -------------------------------------------------------------------------------
echo    Serveur Backend  : http://localhost:5000 (API & Base SQLite)
echo    Client Frontend  : http://localhost:3000 (Interface Utilisateur)
echo -------------------------------------------------------------------------------
echo.

:: Lancer le Backend dans une fenêtre dédiée
start "UK-GED Backend (Port 5000)" cmd /k "cd /d "%~dp0server" && npm start"

:: Attendre 2 secondes pour initialiser la DB et le serveur backend
timeout /t 2 /nobreak >nul

:: Lancer le Frontend dans une fenêtre dédiée
start "UK-GED Frontend (Port 3000)" cmd /k "cd /d "%~dp0client" && npm run dev"

:: Attendre 3 secondes puis ouvrir le navigateur
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo ===============================================================================
echo    UK-GED EST MAINTENANT ACTIF ET OUVERT DANS VOTRE NAVIGATEUR !
echo ===============================================================================
echo.
echo  COMPTES DE TEST DISPONIBLES :
echo  -----------------------------------------------------------------------------
echo  1. Administrateur       : admin@univ-kindia.edu.gn   /   Admin123!
echo  2. Secrétariat Central   : sc@univ-kindia.edu.gn      /   Agent123!
echo  3. Secrétaire Général    : sg@univ-kindia.edu.gn      /   Sg123!
echo  4. Recteur               : recteur@univ-kindia.edu.gn /   Recteur123!
echo  5. Chef de Service (DAF) : daf@univ-kindia.edu.gn     /   Daf123!
echo  6. Contrôle Financier    : cf@univ-kindia.edu.gn      /   Cf123!
echo  7. Enseignant-Chercheur  : ec1@univ-kindia.edu.gn     /   Ec123!
echo  -----------------------------------------------------------------------------
echo.
echo  Pour arrêter UK-GED, fermez simplement les 2 fenêtres de terminal ouvertes
echo  ou lancez le fichier "arreter-ukged.bat".
echo.
pause
