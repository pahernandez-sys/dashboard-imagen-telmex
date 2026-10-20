"""
Script de Sincronización Automática con Linkaform
Descarga respuestas de Trabajos Realizados (Forma 142786) y Materiales (Forma 184350)
y actualiza los datos del Dashboard Ejecutivo de Imagen Telmex 2026.
"""

import sys
import os
import json
import requests
from datetime import datetime

FORMS = {
    "records": 142786,
    "materials": 184350
}

API_URL = "https://app.linkaform.com/api/infosync/form_answer/"

def fetch_form_answers(form_id, api_token):
    print(f"\n[Descargando] Consultando respuestas de Forma {form_id}...")
    headers = {
        "Authorization": f"Token {api_token}",
        "Content-Type": "application/json"
    }
    url = f"{API_URL}?form_id={form_id}&limit=1000"
    
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        if resp.status_code == 200:
            data = resp.json()
            objects = data.get("data") or data.get("results") or data.get("objects") or []
            print(f"  [OK] Forma {form_id}: {len(objects)} registros recuperados.")
            return objects
        else:
            print(f"  [ERROR {resp.status_code}] {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"  [EXCEPCION] Error al conectar con Linkaform: {e}")
        return None

def main():
    api_token = os.environ.get("LINKAFORM_API_KEY")
    if not api_token and len(sys.argv) > 1:
        api_token = sys.argv[1].strip()

    if not api_token:
        print("\n" + "="*60)
        print("SINCRONIZADOR LINKAFORM -> DASHBOARD IMAGEN TELMEX 2026")
        print("="*60)
        api_token = input("\nIngresa tu API Token de Linkaform: ").strip()

    if not api_token:
        print("Error: Se requiere un API Token para consultar la base de datos de Linkaform.")
        sys.exit(1)

    records = fetch_form_answers(FORMS["records"], api_token)
    materials = fetch_form_answers(FORMS["materials"], api_token)

    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    os.makedirs(output_dir, exist_ok=True)

    if records is not None:
        rec_path = os.path.join(output_dir, "live_records.json")
        with open(rec_path, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, ensure_ascii=False)
        print(f"  [Guardado] Trabajos guardados en: {rec_path}")

    if materials is not None:
        mat_path = os.path.join(output_dir, "live_materials.json")
        with open(mat_path, "w", encoding="utf-8") as f:
            json.dump(materials, f, indent=2, ensure_ascii=False)
        print(f"  [Guardado] Materiales guardados en: {mat_path}")

    print("\n[Completado] Sincronización finalizada exitosamente.")

if __name__ == "__main__":
    main()
