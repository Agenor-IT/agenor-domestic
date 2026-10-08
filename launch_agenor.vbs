Set WshShell = CreateObject("WScript.Shell")
' Iniciar servidor local estático en segundo plano sin ventana de consola (0)
WshShell.Run "cmd /c """ & WshShell.CurrentDirectory & "\start_server.bat""", 0, False
' Pausa breve para garantizar inicialización del servidor HTTP local
WScript.Sleep 1500
' Abrir la aplicación en modo ventana nativa independiente (Standalone App)
On Error Resume Next
WshShell.Run "msedge.exe --app=http://localhost:5173", 1, False
If Err.Number <> 0 Then
    WshShell.Run "chrome.exe --app=http://localhost:5173", 1, False
End If
