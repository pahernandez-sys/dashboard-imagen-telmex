"""
Servicio Local de Sincronizacion Linkaform (HTTP Bridge para Dashboard Web)
Permite que el boton 'Sincronizar Linkaform' en el navegador web ejecute
la descarga directa desde Linkaform, actualice el Reporte Diario Excel y
despliegue a GitHub Pages sin que el usuario use la terminal.
"""

import sys
import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

PORT = 8765

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
            self.wfile.write(json.dumps({"status": "running", "service": "Linkaform Sync Service 2026"}).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/sync":
            try:
                # 1. Ejecutar sincronizacion Linkaform
                import importlib
                import sync_linkaform
                import build_reporte_diario
                import build_materiales_recibidos

                importlib.reload(sync_linkaform)
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

                # 2. Reconstruir Reportes Excel Oficiales
                excel_path = build_reporte_diario.build_reporte_diario()
                mat_excel_path = build_materiales_recibidos.build_materiales_recibidos()

                # 3. Leer los datos sincronizados para devolverlos al navegador
                live_records, live_materials = build_reporte_diario.load_live_data()

                # 4. Publicar automaticamente a GitHub Pages en segundo plano
                def push_to_git():
                    try:
                        git_path = r"C:\Users\PCI\AppData\Local\Programs\Git\cmd\git.exe"
                        repo_dir = os.path.dirname(os.path.abspath(__file__))
                        import subprocess
                        subprocess.run([git_path, "add", "data/", "app.js", "index.html", "build_reporte_diario.py", "build_materiales_recibidos.py"], cwd=repo_dir, capture_output=True, timeout=30)
                        subprocess.run([git_path, "commit", "-m", "[Auto-Sync Web] Actualizar Linkaform, Reporte Diario y Materiales Recibidos Excel"], cwd=repo_dir, capture_output=True, timeout=30)
                        subprocess.run([git_path, "push", "origin", "main"], cwd=repo_dir, capture_output=True, timeout=60)
                    except Exception as ge:
                        print(f"[Git Sync Aviso] {ge}")

                threading.Thread(target=push_to_git, daemon=True).start()

                # Responder al navegador
                resp_payload = {
                    "success": True,
                    "records_count": len(live_records),
                    "materials_count": len(live_materials),
                    "excel_updated": True,
                    "message": f"Sincronización completada: {len(live_records)} trabajos y {len(live_materials)} entregas. Reportes Excel actualizados."
                }
                
                self.send_response(200)
                self._send_cors_headers()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(resp_payload).encode("utf-8"))

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
