@echo off
setlocal enabledelayedexpansion
title Sincronizador Linkaform - Imagen Telmex 2026

set "PATH=%PATH%;C:\Users\PCI\AppData\Local\Programs\Python\Python312;C:\Users\PCI\AppData\Local\Programs\Python\Python312\Scripts;C:\Users\PCI\AppData\Local\Programs\Git\cmd"

echo =====================================================================
echo    SINCRONIZADOR LINKAFORM - DASHBOARD IMAGEN TELMEX 2026
echo =====================================================================
echo.
echo [1/3] Conectando a Linkaform API y actualizando evidencias...
python "c:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex\sync_linkaform.py"

if errorlevel 1 (
    echo.
    echo [ERROR] Ocurrio un error al sincronizar con Linkaform.
    pause
    exit /b 1
)

echo.
echo [2/3] Preparando publicacion a GitHub Pages...
cd /d "c:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex"
git add data/ app.js index.html libs/ local_sync_service.py Sincronizar_y_Publicar.bat
git commit -m "[Sincronizacion] Actualizar registros Linkaform y Reporte Diario Excel"

echo.
echo [3/3] Publicando en GitHub Pages...
git push origin main

echo.
echo =====================================================================
echo  SINCRONIZACION Y PUBLICACION COMPLETADA CON EXITO!
echo  El reporte Excel y el Dashboard web tienen la informacion actualizada.
echo =====================================================================
echo.
pause
