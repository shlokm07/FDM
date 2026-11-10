@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   REA-IDM - Ultra-Lightweight Download Manager Setup
echo ========================================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\Programs\REA-IDM"
set "BIN_DIR=%~dp0bin"

echo [*] Target Directory: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%\ui" mkdir "%INSTALL_DIR%\ui"

echo [*] Copying binary and assets...
copy /Y "%BIN_DIR%\rea-idm.exe" "%INSTALL_DIR%\rea-idm.exe" >nul
if exist "%BIN_DIR%\ui" xcopy /E /Y /I "%BIN_DIR%\ui" "%INSTALL_DIR%\ui" >nul

echo [*] Registering Chrome & Edge Native Messaging Host...
"%INSTALL_DIR%\rea-idm.exe" --install

echo [*] Creating Desktop and Start Menu Shortcuts...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$sDesktop = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\REA-IDM.lnk'); " ^
  "$sDesktop.TargetPath = '%INSTALL_DIR%\rea-idm.exe'; " ^
  "$sDesktop.Description = 'REA-IDM Download Manager'; " ^
  "$sDesktop.Save(); " ^
  "$startMenu = [Environment]::GetFolderPath('Programs') + '\REA-IDM'; " ^
  "if (!(Test-Path $startMenu)) { New-Item -ItemType Directory -Path $startMenu -Force | Out-Null }; " ^
  "$sMenu = $ws.CreateShortcut($startMenu + '\REA-IDM.lnk'); " ^
  "$sMenu.TargetPath = '%INSTALL_DIR%\rea-idm.exe'; " ^
  "$sMenu.Save();"

echo.
echo ========================================================
echo   Installation Successful!
echo   Desktop shortcut created: REA-IDM
echo   Launching REA-IDM...
echo ========================================================
start "" "%INSTALL_DIR%\rea-idm.exe"
exit /b 0

