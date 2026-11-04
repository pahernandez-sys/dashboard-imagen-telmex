@echo off
title Iniciar Servicio Telmex 2026
echo Iniciando Servicio de Sincronizacion en Vivo Telmex 2026 en segundo plano...
wscript.exe "C:\Users\PCI\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\TelmexAutoSync.vbs"
echo [OK] Servicio iniciado silenciosamente en segundo plano.
echo Para ver el registro en vivo, abre: logs\auto_sync_service.log
timeout /t 3
