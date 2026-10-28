"""
Servicio Local de Sincronizacion Linkaform (HTTP Bridge + Auto-Sync Daemon)
Campaña Imagen Telmex 2026 - Mesa de Control

Funcionalidades:
1. Daemon automático en segundo plano:
   - Entre las 10:00 AM y las 10:00 PM (22:00 hrs):
     Sincroniza Linkaform, sube a Supabase Cloud, regenera los Reportes Excel Oficiales
     y publica en GitHub Pages cada 5 minutos automáticamente.
   - Entre las 22:00 hrs (10:00 PM) y las 10:00 AM:
     Se mantiene quieto/congelado respetando el corte oficial.
2. Endpoint HTTP (http://127.0.0.1:8765/sync):
   - Permite forzar sincronización instantánea desde el botón en el dashboard web.
"""

import sys
import os
import json
import time
import threading
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8765
_sync_lock = threading.Lock()

def execute_full_sync():
    """Ejecuta el ciclo completo de sincronización de datos."""
    if not _sync_lock.acquire(blocking=False):
        print("  [Auto-Sync Aviso] Sincronización ya en curso. Omitiendo ejecución concurrente.")
        return None

    try:
        import importlib
        import sync_linkaform
        import add_resumen_general
        import build_reporte_diario
        import build_materiales_recibidos

        importlib.reload(sync_linkaform)
        importlib.reload(add_resumen_general)
        importlib.reload(build_reporte_diario)
        importlib.reload(build_materiales_recibidos)

        username = os.environ.get("LINKAFORM_USERNAME") or sync_linkaform.DEFAULT_USERNAME
        api_key = os.environ.get("LINKAFORM_API_KEY") or sync_linkaform.DEFAULT_API_KEY

        jwt_token = sync_linkaform.get_jwt_token(username, api_key)
        if not jwt_token:
            raise Exception("No se pudo autenticar en Linkaform.")

        raw_records = sync_linkaform.fetch_form_answers(sync_linkaform.FORMS["records"], jwt_token)
        raw_materials = sync_linkaform.fetch_form_answers(sync_linkaform.FORMS["materials"], jwt_token)

        output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
        os.makedirs(output_dir, exist_ok=True)
        sync_linkaform.process_and_save_data(raw_records, raw_materials, output_dir)

        # Reconstruir Reportes Excel Oficiales
        excel_path = build_reporte_diario.build_reporte_diario()
        mat_excel_path = build_materiales_recibidos.build_materiales_recibidos()

        # Cargar datos procesados
        live_records, live_materials = build_reporte_diario.load_live_data()

        # Publicar automáticamente a GitHub Pages en segundo plano
        def push_to_git():
            try:
                git_path = r"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe"
                repo_dir = os.path.dirname(os.path.abspath(__file__))
                import subprocess
                subprocess.run([git_path, "add", "data/", "app.js", "index.html"], cwd=repo_dir, capture_output=True, timeout=30)
                subprocess.run([git_path, "commit", "-m", f"[Auto-Sync] Datos actualizados ({len(live_records)} trabajos, {len(live_materials)} entregas)"], cwd=repo_dir, capture_output=True, timeout=30)
                subprocess.run([git_path, "push", "origin", "main"], cwd=repo_dir, capture_output=True, timeout=60)
            except Exception as ge:
                print(f"[Git Sync Aviso] {ge}")

        threading.Thread(target=push_to_git, daemon=True).start()

        cutoff_info = {k: v for k, v in sync_linkaform.get_cutoff_info().items() if k != "max_visible_dt_obj"}

        return {
            "success": True,
            "records_count": len(live_records),
            "materials_count": len(live_materials),
            "cutoff": cutoff_info,
            "excel_updated": True,
            "records": live_records,
            "materials": live_materials,
            "message": f"Sincronización completada: {len(live_records)} trabajos y {len(live_materials)} entregas. {cutoff_info['description']}"
        }
    finally:
        _sync_lock.release()

def auto_sync_worker():
    """Hilo en segundo plano para auto-sincronizar periódicamente cada 5 minutos en jornada laboral."""
    print("[Auto-Sync Daemon] Hilo de sincronización periódica iniciado.")
    # Esperar 15 segundos al arranque antes del primer ciclo
    time.sleep(15)
    while True:
        try:
            now = datetime.now()
            # Horario de jornada activa: 10:00 AM a 22:00 PM (10:00 a 22:00)
            if 10 <= now.hour < 22:
                print(f"\n[Auto-Sync Daemon {now.strftime('%H:%M:%S')}] Jornada en vivo activa: Ejecutando ciclo de sincronización...")
                res = execute_full_sync()
                if res:
                    print(f"[Auto-Sync Daemon OK] {res['message']}")
            else:
                print(f"[Auto-Sync Daemon {now.strftime('%H:%M:%S')}] Período de corte oficial nocturno/matutino (22:00 a 10:00 hrs). Datos congelados.")
        except Exception as err:
            print(f"[Auto-Sync Daemon Error] {err}")
        
        # Esperar 5 minutos (300 segundos) entre chequeos
        time.sleep(300)

class SyncHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/status" or self.path == "/":
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "running", "service": "Linkaform Sync Service 2026", "auto_sync": True}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/sync":
            try:
                res = execute_full_sync()
                if not res:
                    res = {"success": True, "message": "Sincronización en proceso."}

                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(res).encode("utf-8"))

            except Exception as e:
                self.send_response(500)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

def run():
    # Iniciar worker en segundo plano
    worker = threading.Thread(target=auto_sync_worker, daemon=True)
    worker.start()

    server_address = ("127.0.0.1", PORT)
    httpd = HTTPServer(server_address, SyncHandler)
    print(f"Servicio Local de Sincronizacion Linkaform activo en http://127.0.0.1:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()

if __name__ == "__main__":
    run()
