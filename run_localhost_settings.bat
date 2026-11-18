@echo off
title Day Settings - Localhost (Port 1420)
echo ===================================================
echo   Day Main Settings - Localhost Web Runner
echo   URL: http://localhost:1420/settings.html
echo ===================================================
echo.
echo Starting local web server...
cd /d "%~dp0windows"
start http://localhost:1420/settings.html
npm run dev
