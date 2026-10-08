$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "Agenor Domestic.lnk"
$targetPath = "wscript.exe"
$workDir = "d:\HP I5\AGENOR IT\1 - Proyectos\2-work-space-apps\agenor-domestic"
$scriptPath = Join-Path $workDir "launch_agenor.vbs"

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.Arguments = "`"$scriptPath`""
$shortcut.WorkingDirectory = $workDir
$shortcut.Description = "Agenor Domestic - Aplicacion Local de Escritorio"
$shortcut.Save()

Write-Host "Acceso directo creado exitosamente en el Escritorio: $shortcutPath"
