@echo off
setlocal
echo ===================================================
echo             Day Uninstaller Assistant
echo ===================================================
echo.

:: 1. Terminate running Day processes
taskkill /F /IM Day.exe /T 2>nul
taskkill /F /IM Day-hook.exe /T 2>nul

:: 2. Check for standard Inno Setup uninstaller
set "INSTALL_DIR=%LOCALAPPDATA%\Programs\Day"
if exist "%INSTALL_DIR%\unins000.exe" (
    echo Running Day Uninstaller wizard...
    start /wait "" "%INSTALL_DIR%\unins000.exe"
    goto :done
)

:: 3. Fallback manual cleanup if installed portably
echo Performing cleanup...
if exist "%INSTALL_DIR%" (
    rmdir /S /Q "%INSTALL_DIR%" 2>nul
)

:: Remove Desktop & Start Menu shortcuts if present
if exist "%USERPROFILE%\Desktop\Day.lnk" (
    del /F /Q "%USERPROFILE%\Desktop\Day.lnk" 2>nul
)
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Day.lnk" (
    del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Day.lnk" 2>nul
)

:: Remove Registry autostart entry if present
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "Day" /f 2>nul

:done
echo.
echo Day has been successfully uninstalled.
echo ===================================================
timeout /t 3 >nul
exit /b 0
