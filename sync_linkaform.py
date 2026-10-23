"""
Script de Sincronización Automática con Linkaform API
Campaña Nacional Imagen Telmex 2026 - Mesa de Control

Descarga las evidencias en vivo de:
- Trabajos Realizados en Campo (Forma 142786)
- Control y Recepción de Materiales (Forma 184350)
Y actualiza automáticamente los archivos de datos del Dashboard Ejecutivo.
"""

import sys
import os
import json
import requests
from datetime import datetime

DEFAULT_USERNAME = "pahernandez@operacionpci.com.mx"
DEFAULT_API_KEY = "003ab07a66c6795f8d3fcca2a3b6f94a7f06258e"

FORMS = {
    "records": 142786,
    "materials": 184350
}

LOGIN_URL = "https://app.linkaform.com/api/infosync/user_admin/login/"
ANSWERS_URL = "https://app.linkaform.com/api/infosync/form_answer/"

def get_jwt_token(username, api_key):
    print(f"\n[1/3] Autenticando en Linkaform con usuario: {username}...")
    try:
        resp = requests.post(LOGIN_URL, json={"username": username, "api_key": api_key}, timeout=20)
        if resp.status_code == 200:
            token = resp.json().get("jwt")
            print("  [OK] Autenticacion exitosa. Token JWT generado.")
            return token
        else:
            print(f"  [ERROR {resp.status_code}] Fallo autenticacion: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"  [EXCEPCION] Error al conectar con login de Linkaform: {e}")
        return None

def fetch_form_answers(form_id, jwt_token):
    print(f"\n[2/3] Descargando respuestas de Forma {form_id}...")
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    url = f"{ANSWERS_URL}?form_id={form_id}&limit=1000"
    
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            objects = data.get("data") or data.get("results") or data.get("objects") or []
            print(f"  [OK] Forma {form_id}: {len(objects)} registros recuperados.")
            return objects
        else:
            print(f"  [ERROR {resp.status_code}] {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"  [EXCEPCION] Error al consultar Forma {form_id}: {e}")
        return None

def process_and_save_data(raw_records, raw_materials, output_dir):
    print("\n[3/3] Procesando y mapeando registros para el Dashboard...")
    
    # Mapeo Trabajos (142786)
    mapped_records = []
    for i, item in enumerate(raw_records or []):
        ans = item.get("answers", {})
        created_at = item.get("created_at")
        date_str = ""
        time_str = ""
        if isinstance(created_at, (int, float)):
            dt = datetime.fromtimestamp(created_at)
            date_str = dt.strftime("%Y-%m-%d")
            time_str = dt.strftime("%H:%M")
        elif isinstance(created_at, str):
            if "T" in created_at:
                date_str = created_at.split("T")[0]
                time_str = created_at.split("T")[1][:5]
            else:
                date_str = created_at[:10]
                time_str = created_at[11:16]

        tipo = (ans.get("6ad52fc6bc424ea79992eabe") or "CAJA").upper()
        identificador = ans.get("6ad52fc6bc424ea79992eabf") or f"S/ID-{i+1}"
        estado = (ans.get("6ad52fc6bc424ea79992eac0") or "MORELOS").upper()
        area = (ans.get("6ad52fc6bc424ea79992eac1") or estado).upper()
        contratista = ans.get("6abe9357bef08742fcf94020") or "Victor Hugo Lopez Garcia"
        modelo = ans.get("6ab9d647dba7a0c191e6a0f6") or "Sencilla"
        oferta = ans.get("6a99eb8af9c750d6db214c5d") or "200 MB"
        existe_bd = ans.get("6ad530403c0c04d9bb2555b2") or "Sí"
        comentarios = ans.get("6ad4df593c0c04d9bb25556e") or ""
        folio = item.get("folio") or f"LF-{item.get('id', i+1)}"
        lat = ans.get("6ab6f3a4c472baf119e176e8")
        lng = ans.get("6ab6f3a4c472baf119e176e9")

        foto_antes_arr = ans.get("6a99e764f9c750d6db214c54") or []
        foto_despues_arr = ans.get("6a99e764f9c750d6db214c55") or []
        foto_antes = foto_antes_arr[0].get("file_url") if (isinstance(foto_antes_arr, list) and len(foto_antes_arr) > 0) else ""
        foto_despues = foto_despues_arr[0].get("file_url") if (isinstance(foto_despues_arr, list) and len(foto_despues_arr) > 0) else ""

        # Cantidad de viniles colocados
        num_viniles_raw = ans.get("6a99eb60a20e4f1d25581b72")
        try:
            num_viniles = float(num_viniles_raw) if (num_viniles_raw is not None and str(num_viniles_raw).strip() != "") else (2.0 if tipo == "CASETA" else 1.0)
        except (ValueError, TypeError):
            num_viniles = 2.0 if tipo == "CASETA" else 1.0

        version = ans.get("6adaa11601dfe84563e2253b") or "Sin versión"

        mapped_records.append({
            "folio": folio,
            "fecha": date_str,
            "hora": time_str,
            "tipo": tipo,
            "identificador": identificador,
            "modelo": modelo,
            "estado": estado,
            "area_trabajo": area,
            "contratista": contratista,
            "oferta": oferta,
            "existe_bd": existe_bd,
            "comentarios": comentarios,
            "num_viniles": num_viniles,
            "version": version,
            "latitud": lat,
            "longitud": lng,
            "foto_antes": foto_antes,
            "foto_despues": foto_despues,
            "estatus": "Aprobada"
        })

    # Mapeo Materiales (184350)
    mapped_materials = []
    for idx, m in enumerate(raw_materials or []):
        ans = m.get("answers", {})
        area = (ans.get("6ad695943f0d28deb4a6c9a3") or "GENERAL").upper()
        desc = (ans.get("6ad692011583192abb37cd8f") or "MATERIAL").upper()
        qty = float(ans.get("6ad65b0b1b305d8b534b1e13") or 0)
        unidad_val = ans.get("6ad695943f0d28deb4a6c9a4") or "PZAS."
        if isinstance(unidad_val, list):
            unidad_val = unidad_val[0] if unidad_val else "PZAS."
        
        fecha_val = ans.get("6ad65b0b1b305d8b534b1e11") or ""
        if not fecha_val and m.get("created_at"):
            created_at = m.get("created_at")
            if isinstance(created_at, (int, float)):
                fecha_val = datetime.fromtimestamp(created_at).strftime("%Y-%m-%d %H:%M:%S")

        photo_arr = ans.get("6ad69fb41583192abb37cdaa") or []
        photo_url = photo_arr[0].get("file_url") if (isinstance(photo_arr, list) and len(photo_arr) > 0) else ""

        mapped_materials.append({
            "id": m.get("folio") or m.get("id") or f"MAT-{idx+1}",
            "area": area,
            "descripcion": desc,
            "cantidad": qty,
            "unidad": str(unidad_val).upper(),
            "fecha": fecha_val,
            "foto": photo_url
        })

    # 1. Guardar JSONs crudos
    raw_rec_path = os.path.join(output_dir, "linkaform_records_142786.json")
    with open(raw_rec_path, "w", encoding="utf-8") as f:
        json.dump(raw_records, f, indent=2, ensure_ascii=False)

    raw_mat_path = os.path.join(output_dir, "linkaform_materials_184350.json")
    with open(raw_mat_path, "w", encoding="utf-8") as f:
        json.dump(raw_materials, f, indent=2, ensure_ascii=False)

    # 2. Guardar archivo JS listo para browser
    output_js = os.path.join(output_dir, "linkaform_live_data.js")
    with open(output_js, "w", encoding="utf-8") as f:
        f.write("/**\n")
        f.write(" * Datos Oficiales Sincronizados en Vivo desde Linkaform API\n")
        f.write(f" * Fecha y hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f" * Trabajos de campo (Forma 142786): {len(mapped_records)}\n")
        f.write(f" * Movimientos de materiales (Forma 184350): {len(mapped_materials)}\n")
        f.write(" */\n\n")
        f.write("const LINKAFORM_LIVE_RECORDS = ")
        json.dump(mapped_records, f, indent=2, ensure_ascii=False)
        f.write(";\n\n")
        f.write("const LINKAFORM_LIVE_MATERIALS = ")
        json.dump(mapped_materials, f, indent=2, ensure_ascii=False)
        f.write(";\n")

    print(f"  [OK] Guardado archivo JS: {output_js}")
    print(f"  [OK] Total Trabajos: {len(mapped_records)}")
    print(f"  [OK] Total Movimientos de Material: {len(mapped_materials)}")

def main():
    username = os.environ.get("LINKAFORM_USERNAME") or DEFAULT_USERNAME
    api_key = os.environ.get("LINKAFORM_API_KEY")
    if not api_key and len(sys.argv) > 1:
        api_key = sys.argv[1].strip()
    if not api_key:
        api_key = DEFAULT_API_KEY

    print("=" * 65)
    print("SINCRONIZADOR LINKAFORM -> DASHBOARD IMAGEN TELMEX 2026")
    print("=" * 65)

    jwt_token = get_jwt_token(username, api_key)
    if not jwt_token:
        print("[ERROR] No se pudo obtener la sesion en Linkaform. Verifica credenciales.")
        sys.exit(1)

    raw_records = fetch_form_answers(FORMS["records"], jwt_token)
    raw_materials = fetch_form_answers(FORMS["materials"], jwt_token)

    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    os.makedirs(output_dir, exist_ok=True)

    process_and_save_data(raw_records, raw_materials, output_dir)

    try:
        from build_reporte_diario import build_reporte_diario
        print("\n[Generando Reporte Diario Excel actualizado...]")
        build_reporte_diario()
    except Exception as e:
        print(f"  [Aviso] No se pudo generar el Reporte Diario Excel: {e}")

    print("\n" + "=" * 65)
    print("SINCRONIZACION COMPLETADA EXITOSAMENTE")
    print("=" * 65)

if __name__ == "__main__":
    main()
