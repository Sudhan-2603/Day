@echo off
setlocal
echo ===================================================
echo             Day Installer Assistant
echo ===================================================
echo.

if exist "%~dp0Day-Setup.exe" (
    echo Starting Day Setup Wizard...
    start "" "%~dp0Day-Setup.exe"
    exit /b 0
)

if exist "%~dp0Day.exe" (
    echo Launching Day portable executable...
    start "" "%~dp0Day.exe"
    exit /b 0
)

echo Setup binary not found! Please ensure Day-Setup.exe is in this folder.
pause
exit /b 1

