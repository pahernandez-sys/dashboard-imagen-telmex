"""
Servicio Autónomo de Sincronización en Vivo y Backup Telmex 2026
Ejecuta 100% en segundo plano en Windows sin pedir autorizaciones ni ventanas emergentes.

Horario y Funciones:
1. Jornada en Vivo (10:00 AM a 10:00 PM):
   - Sincroniza Linkaform cada 10 minutos automáticamente.
   - Homologa nombres oficiales de modelos (Cajas y Casetas).
   - Actualiza Supabase Cloud y regenera el Reporte Oficial Excel.
   - Publica a GitHub Pages para que el dashboard web refleje los avances en vivo.
2. Backup Nocturno (10:15 PM / 22:15 hrs):
   - Ejecuta el respaldo automático diario de imágenes a Google Drive.
3. Ventana de Corte Nocturna/Matutina (10:00 PM a 10:00 AM):
   - Mantiene los reportes y datos congelados respetando el corte oficial.
"""

import os
import sys
import time
import subprocess
from datetime import datetime

BASE_DIR = r"c:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex"
BACKUP_SCRIPT = r"c:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\scripts\daily_backup_images_drive.py"
PYTHON_EXE = r"C:\Users\PCI\AppData\Local\Programs\Python\Python312\python.exe"
GIT_EXE = r"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe"

LOG_FILE = os.path.join(BASE_DIR, "auto_sync_service.log")

def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
            f.flush()
    except Exception as e:
        print(f"Log write error: {e}", flush=True)

def rotate_log_if_needed():
    try:
        if os.path.exists(LOG_FILE) and os.path.getsize(LOG_FILE) > 5 * 1024 * 1024:
            old_log = LOG_FILE + ".old"
            if os.path.exists(old_log):
                os.remove(old_log)
            os.rename(LOG_FILE, old_log)
    except Exception:
        pass

def run_sync_linkaform():
    """Ejecuta sync_linkaform.py y sube cambios a GitHub Pages."""
    log("Iniciando ciclo de sincronización en vivo...")
    try:
        p = subprocess.run(
            [PYTHON_EXE, "-u", "sync_linkaform.py"],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            timeout=300
        )
        if p.returncode == 0:
            log("sync_linkaform.py completado exitosamente.")
            # Publicar a GitHub Pages
            if os.path.exists(GIT_EXE):
                subprocess.run([GIT_EXE, "add", "data/linkaform_live_data.js", "data/Reporte_Diario_Casetas_y_Cajas_Contratistas_2026.xlsx"], cwd=BASE_DIR, capture_output=True, timeout=30)
                commit_res = subprocess.run([GIT_EXE, "commit", "-m", "chore: sync avances en vivo (auto-service)"], cwd=BASE_DIR, capture_output=True, text=True, timeout=30)
                if "nothing to commit" not in commit_res.stdout:
                    push_res = subprocess.run([GIT_EXE, "push", "origin", "main"], cwd=BASE_DIR, capture_output=True, text=True, timeout=60)
                    if push_res.returncode == 0:
                        log("Cambios desplegados a GitHub Pages (en vivo).")
                    else:
                        log(f"Git push aviso: {push_res.stderr.strip()[:200]}")
                else:
                    log("Sin cambios nuevos para desplegar a GitHub Pages.")
        else:
            log(f"Error en sync_linkaform (código {p.returncode}): {p.stderr.strip()[:300]}")
    except subprocess.TimeoutExpired:
        log("Timeout: sync_linkaform tardó más de 5 minutos.")
    except Exception as e:
        log(f"Excepción en run_sync_linkaform: {e}")

def run_backup_images():
    """Ejecuta el backup automático a Google Drive a las 10:15 PM."""
    log("Iniciando backup nocturno de imágenes a Google Drive...")
    try:
        p = subprocess.run(
            [PYTHON_EXE, "-u", BACKUP_SCRIPT],
            cwd=os.path.dirname(BACKUP_SCRIPT),
            capture_output=True,
            text=True,
            timeout=1800
        )
        if p.returncode == 0:
            log("Backup de imágenes a Google Drive completado exitosamente.")
        else:
            log(f"Error en backup de imágenes (código {p.returncode}): {p.stderr.strip()[:300]}")
    except Exception as e:
        log(f"Excepción en run_backup_images: {e}")

def main():
    log("=======================================================")
    log("Servicio Autónomo Telmex 2026 INICIADO")
    log(f"Directorio Base: {BASE_DIR}")
    log("Horario en vivo: 10:00 AM - 10:00 PM (cada 10 min)")
    log("Backup a Drive: 10:15 PM diario")
    log("Corte congelado: 10:00 PM - 10:00 AM")
    log("=======================================================")

    last_sync_time = 0
    SYNC_INTERVAL_SEC = 600  # 10 minutos
    last_backup_date = None

    # Ejecutar primera sincronización inmediatamente si estamos en jornada activa
    now = datetime.now()
    if 10 <= now.hour < 22:
        run_sync_linkaform()
        last_sync_time = time.time()

    while True:
        try:
            rotate_log_if_needed()
            now = datetime.now()
            today_str = now.strftime("%Y-%m-%d")

            # 1. Chequeo de Backup Nocturno (10:15 PM a 10:30 PM, una sola vez por día)
            if now.hour == 22 and 15 <= now.minute <= 35 and last_backup_date != today_str:
                run_backup_images()
                last_backup_date = today_str

            # 2. Chequeo de Jornada en Vivo (10:00 AM a 22:00 PM)
            if 10 <= now.hour < 22:
                elapsed = time.time() - last_sync_time
                if elapsed >= SYNC_INTERVAL_SEC:
                    run_sync_linkaform()
                    last_sync_time = time.time()
            else:
                # Período de corte: esperar silenciosamente
                pass

        except Exception as e:
            log(f"Error inesperado en loop principal: {e}")

        # Dormir 30 segundos antes de evaluar el reloj
        time.sleep(30)

if __name__ == "__main__":
    main()
