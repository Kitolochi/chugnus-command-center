$WshShell = New-Object -comObject WScript.Shell
$StartupPath = [Environment]::GetFolderPath('Startup')
$Shortcut = $WshShell.CreateShortcut("$StartupPath\Mega Agenda.lnk")
$Shortcut.TargetPath = "C:\Users\chris\mega-agenda\release\Mega Agenda 1.0.0.exe"
$Shortcut.IconLocation = "C:\Users\chris\mega-agenda\release\Mega Agenda 1.0.0.exe,0"
$Shortcut.WorkingDirectory = "C:\Users\chris\mega-agenda"
$Shortcut.Save()
Write-Host "Startup shortcut created at: $StartupPath\Mega Agenda.lnk"

# Also create desktop shortcut
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$DesktopShortcut = $WshShell.CreateShortcut("$DesktopPath\Mega Agenda.lnk")
$DesktopShortcut.TargetPath = "C:\Users\chris\mega-agenda\release\Mega Agenda 1.0.0.exe"
$DesktopShortcut.IconLocation = "C:\Users\chris\mega-agenda\release\Mega Agenda 1.0.0.exe,0"
$DesktopShortcut.WorkingDirectory = "C:\Users\chris\mega-agenda"
$DesktopShortcut.Save()
Write-Host "Desktop shortcut created at: $DesktopPath\Mega Agenda.lnk"
