@echo off
chcp 65001 >nul
title UK-GED - Envoi vers GitHub (seraphinbothie98/GesProjet_UK_GED_Gestion_Administrative_Universite_Kindia)
color 0A

echo ===============================================================================
echo       ENVOI DU PROJET UK-GED VERS GITHUB (seraphinbothie98/GesProjet_UK_GED_Gestion_Administrative_Universite_Kindia)
echo ===============================================================================
echo.

cd /d "%~dp0"

echo Verification de la configuration Git...
git remote set-url origin https://github.com/seraphinbothie98/GesProjet_UK_GED_Gestion_Administrative_Universite_Kindia.git
git branch -M main

echo.
echo Envoi en cours (git push -u origin main)...
echo Si une fenetre GitHub s'ouvre, veuillez vous connecter avec seraphinbothie98.
echo.

git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    color 0A
    echo ===============================================================================
    echo   SUCCES : Le projet a ete publie sur GitHub avec succes !
    echo   Lien : https://github.com/seraphinbothie98/GesProjet_UK_GED_Gestion_Administrative_Universite_Kindia
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
