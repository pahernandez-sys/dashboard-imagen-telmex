@echo off
title Servicio de Sincronizacion en Vivo Telmex 2026
cd /d "c:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex"
echo =================================================================
echo INICIANDO SERVICIO DE SINCRONIZACION EN VIVO TELMEX 2026
echo =================================================================
echo - Horario en vivo activo: 10:00 AM a 10:00 PM (actualizaciones cada 5 min).
echo - Horario de corte congelado: 10:00 PM a 10:00 AM.
echo - Puerto HTTP local: http://127.0.0.1:8765
echo =================================================================
python local_sync_service.py
pause
