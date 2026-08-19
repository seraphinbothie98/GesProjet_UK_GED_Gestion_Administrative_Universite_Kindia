@echo off
chcp 65001 >nul
title UK-GED - Installation des dépendances (Université de Kindia)
color 0A

echo ===============================================================================
echo       INSTALLATION DES DÉPENDANCES POUR UK-GED (UNIVERSITÉ DE KINDIA)
echo ===============================================================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERREUR] Node.js n'est pas installé sur cet ordinateur.
    echo Veuillez installer Node.js depuis https://nodejs.org/ avant de continuer.
    echo.
    pause
    exit /b 1
)

echo [1/2] Installation des modules du Backend (serveur)...
cd /d "%~dp0server"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ATTENTION] Erreur lors de l'installation des dépendances serveur.
)

echo.
echo [2/2] Installation des modules du Frontend (client)...
cd /d "%~dp0client"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ATTENTION] Erreur lors de l'installation des dépendances client.
)

cd /d "%~dp0"
echo.
echo ===============================================================================
echo   INSTALLATION TERMINÉE AVEC SUCCÈS !
echo   Vous pouvez maintenant lancer l'application en double-cliquant sur :
echo   start-ukged.bat
echo ===============================================================================
echo.
pause
