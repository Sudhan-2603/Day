@echo off
setlocal enabledelayedexpansion

:: ========================================================
:: Day - Windows Uninstaller Script
:: ========================================================

echo.
echo ========================================================
echo               Uninstalling Day from Windows
echo ========================================================
echo.

if not "%1"=="/quiet" (
    set /p CONFIRM="Are you sure you want to uninstall Day? (y/N): "
    if /i not "!CONFIRM!"=="y" (
        echo Uninstallation cancelled.
        exit /b 0
    )
)

:: Set paths
set "INSTALL_DIR=%LOCALAPPDATA%\Programs\Day"
set "DAY_DATA=%LOCALAPPDATA%\Day"

:: 1. Close any running Day instances
echo [1/4] Stopping Day processes...
taskkill /F /IM Day.exe /IM Day-hook.exe >nul 2>&1
ping 127.0.0.1 -n 2 >nul

:: 2. Remove Desktop and Start Menu Shortcuts
echo [2/4] Removing shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$programs = [Environment]::GetFolderPath('Programs'); " ^
  "Remove-Item \"$desktop\Day.lnk\" -Force -ErrorAction SilentlyContinue; " ^
  "Remove-Item \"$programs\Day.lnk\" -Force -ErrorAction SilentlyContinue;"

:: 3. Remove Windows Registry Uninstall key
echo [3/4] Removing Windows registry entries...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Day" /f >nul 2>&1

:: 4. Clean up application data and install directory
echo [4/4] Cleaning application files...
if exist "%DAY_DATA%\bin" rmdir /s /q "%DAY_DATA%\bin" >nul 2>&1
if exist "%DAY_DATA%\inbox" rmdir /s /q "%DAY_DATA%\inbox" >nul 2>&1
if exist "%DAY_DATA%\Day.log" del /f /q "%DAY_DATA%\Day.log" >nul 2>&1

:: Remove install directory cleanly
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Sleep -Milliseconds 500; " ^
  "if (Test-Path '%INSTALL_DIR%') { Remove-Item -Path '%INSTALL_DIR%' -Recurse -Force -ErrorAction SilentlyContinue }"

echo.
echo ========================================================
echo            Day has been successfully uninstalled!
echo ========================================================
echo.

if not "%1"=="/quiet" (
    echo Press any key to exit...
    pause >nul
)

exit /b 0
