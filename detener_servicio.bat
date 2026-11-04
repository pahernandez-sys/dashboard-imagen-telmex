@echo off
title Detener Servicio Telmex 2026
echo Deteniendo procesos en segundo plano de service_auto_sync.py...
powershell -Command "Get-CimInstance Win32_Process -Filter \"CommandLine like '%%service_auto_sync.py%%'\" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('[OK] Proceso detenido: ' + $_.ProcessId) }"
echo [OK] Servicio detenido.
pause
