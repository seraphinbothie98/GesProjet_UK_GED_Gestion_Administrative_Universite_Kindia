@echo off
chcp 65001 >nul
title Arrêt de UK-GED
color 0E

echo ===============================================================================
echo             ARRÊT DES PROCESSUS UK-GED (PORTS 3000 ET 5000)
echo ===============================================================================
echo.

echo Arrêt des processus Node.js en cours...
taskkill /F /IM node.exe /T >nul 2>&1

echo.
echo Les serveurs UK-GED ont été arrêtés.
echo.
pause
