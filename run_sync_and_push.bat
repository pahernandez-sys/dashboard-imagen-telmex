@echo off
cd /d "C:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex"

echo ======================================================= >> auto_sync_service.log
echo [%DATE% %TIME%] Iniciando sincronizacion automatica programada... >> auto_sync_service.log

"C:\Users\PCI\AppData\Local\Programs\Python\Python312\python.exe" -u sync_linkaform.py >> auto_sync_service.log 2>&1

"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" add data/linkaform_live_data.js data/Reporte_Diario_Casetas_y_Cajas_Contratistas_2026.xlsx >> auto_sync_service.log 2>&1
"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" commit -m "chore: sync avances en vivo (auto-scheduler)" >> auto_sync_service.log 2>&1
"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" push origin main >> auto_sync_service.log 2>&1

echo [%DATE% %TIME%] Ciclo completado exitosamente. >> auto_sync_service.log
