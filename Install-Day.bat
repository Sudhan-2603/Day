@echo off
setlocal enabledelayedexpansion

:: ========================================================
:: Day - Windows Installer & Setup Script
:: ========================================================

echo.
echo ========================================================
echo               Installing Day for Windows
echo ========================================================
echo.

:: Set paths
set "SCRIPT_DIR=%~dp0"
set "INSTALL_DIR=%LOCALAPPDATA%\Programs\Day"
set "BIN_DIR=%LOCALAPPDATA%\Day\bin"

:: 1. Close any running Day instances
echo [1/5] Stopping any running instances of Day...
taskkill /F /IM Day.exe /IM Day-hook.exe >nul 2>&1
ping 127.0.0.1 -n 2 >nul

:: 2. Create program directory
echo [2/5] Creating application directories...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

:: 3. Copy application files
echo [3/5] Copying application files...
if exist "%SCRIPT_DIR%Day.exe" (
    copy /Y "%SCRIPT_DIR%Day.exe" "%INSTALL_DIR%\Day.exe" >nul
) else if exist "%SCRIPT_DIR%release_bin\Day.exe" (
    copy /Y "%SCRIPT_DIR%release_bin\Day.exe" "%INSTALL_DIR%\Day.exe" >nul
) else if exist "%SCRIPT_DIR%windows\target\release\Day.exe" (
    copy /Y "%SCRIPT_DIR%windows\target\release\Day.exe" "%INSTALL_DIR%\Day.exe" >nul
) else (
    echo [ERROR] Day.exe not found in "%SCRIPT_DIR%"!
    pause
    exit /b 1
)

if exist "%SCRIPT_DIR%Day-hook.exe" (
    copy /Y "%SCRIPT_DIR%Day-hook.exe" "%INSTALL_DIR%\Day-hook.exe" >nul
    copy /Y "%SCRIPT_DIR%Day-hook.exe" "%BIN_DIR%\Day-hook.exe" >nul
) else if exist "%SCRIPT_DIR%release_bin\Day-hook.exe" (
    copy /Y "%SCRIPT_DIR%release_bin\Day-hook.exe" "%INSTALL_DIR%\Day-hook.exe" >nul
    copy /Y "%SCRIPT_DIR%release_bin\Day-hook.exe" "%BIN_DIR%\Day-hook.exe" >nul
) else if exist "%SCRIPT_DIR%windows\target\release\Day-hook.exe" (
    copy /Y "%SCRIPT_DIR%windows\target\release\Day-hook.exe" "%INSTALL_DIR%\Day-hook.exe" >nul
    copy /Y "%SCRIPT_DIR%windows\target\release\Day-hook.exe" "%BIN_DIR%\Day-hook.exe" >nul
)

:: Copy uninstaller to install dir
if exist "%SCRIPT_DIR%Uninstall-Day.bat" (
    copy /Y "%SCRIPT_DIR%Uninstall-Day.bat" "%INSTALL_DIR%\Uninstall-Day.bat" >nul
) else if exist "%SCRIPT_DIR%release_bin\Uninstall-Day.bat" (
    copy /Y "%SCRIPT_DIR%release_bin\Uninstall-Day.bat" "%INSTALL_DIR%\Uninstall-Day.bat" >nul
)

:: 4. Create Desktop and Start Menu Shortcuts using PowerShell
echo [4/5] Creating Desktop and Start Menu shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$programs = [Environment]::GetFolderPath('Programs'); " ^
  "$sDesktop = $ws.CreateShortcut(\"$desktop\Day.lnk\"); " ^
  "$sDesktop.TargetPath = '%INSTALL_DIR%\Day.exe'; " ^
  "$sDesktop.WorkingDirectory = '%INSTALL_DIR%'; " ^
  "$sDesktop.Description = 'Day AI Assistant & Dynamic Island'; " ^
  "$sDesktop.IconLocation = '%INSTALL_DIR%\Day.exe,0'; " ^
  "$sDesktop.Save(); " ^
  "$sStart = $ws.CreateShortcut(\"$programs\Day.lnk\"); " ^
  "$sStart.TargetPath = '%INSTALL_DIR%\Day.exe'; " ^
  "$sStart.WorkingDirectory = '%INSTALL_DIR%'; " ^
  "$sStart.Description = 'Day AI Assistant & Dynamic Island'; " ^
  "$sStart.IconLocation = '%INSTALL_DIR%\Day.exe,0'; " ^
  "$sStart.Save();"

:: 5. Register in Windows Apps & Features / Installed Apps (Registry)
echo [5/5] Registering uninstaller with Windows...
set "UNINST_KEY=HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Day"
reg add "%UNINST_KEY%" /v "DisplayName" /t REG_SZ /d "Day" /f >nul
reg add "%UNINST_KEY%" /v "DisplayVersion" /t REG_SZ /d "0.5.9" /f >nul
reg add "%UNINST_KEY%" /v "Publisher" /t REG_SZ /d "Day" /f >nul
reg add "%UNINST_KEY%" /v "DisplayIcon" /t REG_SZ /d "%INSTALL_DIR%\Day.exe,0" /f >nul
reg add "%UNINST_KEY%" /v "InstallLocation" /t REG_SZ /d "%INSTALL_DIR%" /f >nul
reg add "%UNINST_KEY%" /v "UninstallString" /t REG_SZ /d "\"%INSTALL_DIR%\Uninstall-Day.bat\"" /f >nul
reg add "%UNINST_KEY%" /v "QuietUninstallString" /t REG_SZ /d "\"%INSTALL_DIR%\Uninstall-Day.bat\" /quiet" /f >nul
reg add "%UNINST_KEY%" /v "NoModify" /t REG_DWORD /d 1 /f >nul
reg add "%UNINST_KEY%" /v "NoRepair" /t REG_DWORD /d 1 /f >nul

echo.
echo ========================================================
echo            Day has been successfully installed!
echo ========================================================
echo.
echo   - Location: %INSTALL_DIR%
echo   - Desktop shortcut created
echo   - Start Menu shortcut created
echo   - Registered in Windows Installed Apps (Uninstaller ready)
echo.

if "%1"=="/quiet" goto done
if "%1"=="/silent" goto done

set "START_NOW=Y"
set /p START_NOW="Do you want to launch Day now? (Y/n): "
if /i not "!START_NOW!"=="n" (
    start "" "%INSTALL_DIR%\Day.exe"
)

:done
exit /b 0
