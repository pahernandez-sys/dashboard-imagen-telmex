@echo off
chcp 65001 > nul
title Sincronizador Linkaform - Dashboard Imagen Telmex 2026
echo =====================================================================
echo    SINCRONIZADOR LINKAFORM - DASHBOARD IMAGEN TELMEX 2026
echo =====================================================================
echo.
echo [1/3] Conectando a Linkaform API y descargando evidencias actualizadas...
python "%~dp0sync_linkaform.py"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Ocurrió un error al sincronizar con Linkaform.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Preparando publicación en GitHub Pages...
cd /d "%~dp0"
git add data/ app.js index.html
git commit -m "[Sincronización Manual] Actualizar registros Linkaform y Reporte Diario Excel"
echo.
echo [3/3] Publicando en GitHub Pages...
git push origin main

echo.
echo =====================================================================
echo  ¡SINCRONIZACIÓN Y PUBLICACIÓN COMPLETADA CON ÉXITO!
echo  El reporte Excel y el Dashboard web ya tienen la información de hoy.
echo =====================================================================
echo.
pause
