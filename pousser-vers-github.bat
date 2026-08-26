@echo off
chcp 65001 >nul
title UK-GED - Envoi vers GitHub (bothieseraphin1x-lab/UK_GED)
color 0A

echo ===============================================================================
echo       ENVOI DU PROJET UK-GED VERS GITHUB (bothieseraphin1x-lab/UK_GED)
echo ===============================================================================
echo.

cd /d "%~dp0"

echo Verification de la configuration Git...
git remote set-url origin https://github.com/bothieseraphin1x-lab/UK_GED.git
git branch -M main

echo.
echo Envoi en cours (git push -u origin main)...
echo Si une fenetre GitHub s'ouvre, veuillez vous connecter avec bothieseraphin1x-lab.
echo.

git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    color 0A
    echo ===============================================================================
    echo   SUCCES : Le projet a ete publie sur GitHub avec succes !
    echo   Lien : https://github.com/bothieseraphin1x-lab/UK_GED
    echo ===============================================================================
) else (
    color 0C
    echo ===============================================================================
    echo   Une erreur s'est produite lors de l'envoi.
    echo   Veuillez verifier votre connexion ou vos identifiants GitHub.
    echo ===============================================================================
)

echo.
pause
