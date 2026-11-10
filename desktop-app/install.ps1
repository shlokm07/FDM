Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  REA-IDM - Ultra-Lightweight Download Manager Setup" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$installDir = "$env:LOCALAPPDATA\Programs\REA-IDM"
$binDir = "$PSScriptRoot\bin"

Write-Host "[*] Creating installation directory: $installDir"
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
New-Item -ItemType Directory -Path "$installDir\ui" -Force | Out-Null

Write-Host "[*] Installing rea-idm.exe..."
Copy-Item "$binDir\rea-idm.exe" "$installDir\rea-idm.exe" -Force
if (Test-Path "$binDir\ui") {
    Copy-Item "$binDir\ui\*" "$installDir\ui\" -Recurse -Force
}

Write-Host "[*] Registering Chrome and Edge Native Messaging Host..."
Start-Process -FilePath "$installDir\rea-idm.exe" -ArgumentList "--install" -Wait -NoNewWindow

Write-Host "[*] Creating Shortcuts..."
$wscript = New-Object -ComObject WScript.Shell

$desktopLnk = "$([Environment]::GetFolderPath('Desktop'))\REA-IDM.lnk"
$shortcut = $wscript.CreateShortcut($desktopLnk)
$shortcut.TargetPath = "$installDir\rea-idm.exe"
$shortcut.Description = "REA-IDM Ultra-Lightweight Download Manager"
$shortcut.Save()

$startMenuFolder = "$([Environment]::GetFolderPath('Programs'))\REA-IDM"
New-Item -ItemType Directory -Path $startMenuFolder -Force | Out-Null
$menuLnk = "$startMenuFolder\REA-IDM.lnk"
$shortcutMenu = $wscript.CreateShortcut($menuLnk)
$shortcutMenu.TargetPath = "$installDir\rea-idm.exe"
$shortcutMenu.Save()

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Installation Completed Successfully!" -ForegroundColor Green
Write-Host "  Launching REA-IDM..." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

Start-Process -FilePath "$installDir\rea-idm.exe"

