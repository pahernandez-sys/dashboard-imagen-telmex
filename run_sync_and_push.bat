@echo off
cd /d "C:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex"

echo ======================================================= >> auto_sync_service.log
echo [%DATE% %TIME%] Iniciando sincronizacion automatica programada... >> auto_sync_service.log

"C:\Users\PCI\AppData\Local\Programs\Python\Python312\python.exe" -u sync_linkaform.py >> auto_sync_service.log 2>&1

"C:\Users\PCI\AppData\Local\Programs\Python\Python312\python.exe" -u "C:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\scripts\auto_patch_generic_linkaform.py" >> auto_sync_service.log 2>&1

"C:\Users\PCI\AppData\Local\Programs\Python\Python312\python.exe" -u "C:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\scripts\generate_completed_assets.py" >> auto_sync_service.log 2>&1

"C:\Users\PCI\AppData\Local\Programs\Python\Python312\python.exe" -u "C:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\scripts\sync_to_local_mysql.py" >> auto_sync_service.log 2>&1

"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" add -A data/ app.js index.html run_sync_and_push.bat >> auto_sync_service.log 2>&1
"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" diff --staged --quiet || (
    "C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" commit -m "chore: sync avances en vivo (local CDN)" >> auto_sync_service.log 2>&1
)
"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" pull --no-rebase -X ours origin main --no-edit >> auto_sync_service.log 2>&1
"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" push origin main >> auto_sync_service.log 2>&1

:: Sincronizar y empujar a repo de la app PWA (imagen-telmex-2026)
cd /d "C:\Users\PCI\Documents\Antigravity\imagen-telmex-2026"
"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" add -A data/ app.js index.html styles.css sw.js >> "C:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex\auto_sync_service.log" 2>&1
"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" diff --staged --quiet || (
    "C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" commit -m "chore: auto-sync completed assets Linkaform" >> "C:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex\auto_sync_service.log" 2>&1
    "C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" pull --no-rebase -X ours origin main --no-edit >> "C:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex\auto_sync_service.log" 2>&1
    "C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe" push origin main >> "C:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex\auto_sync_service.log" 2>&1
)

echo [%DATE% %TIME%] Ciclo completado exitosamente. >> "C:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex\auto_sync_service.log"
