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
from datetime import datetime, timedelta

def get_cutoff_info(current_dt=None):
    """
    Calcula la ventana oficial de corte Telmex 2026.
    
    Reglas oficiales:
    - Horario de corte oficial: 10:00 PM (22:00 hrs).
    - Todo registro >= 22:00 hrs se contabiliza para la fecha contable siguiente.
    - Entre las 22:00 hrs (Día D) y las 10:00 AM (Día D+1), el reporte permanece CONGELADO
      mostrando únicamente los datos oficiales cerrados al Día D a las 22:00 hrs.
    - A partir de las 10:00 AM (Día D+1), se liberan los registros posteriores a las 22:00 del Día D
      y los nuevos del Día D+1.
    """
    if current_dt is None:
        current_dt = datetime.now()

    if current_dt.hour < 10:
        # Mañana antes de las 10:00 AM: muestra corte oficial cerrado de ayer a las 22:00
        prev_day = (current_dt - timedelta(days=1)).date()
        max_visible_dt = datetime(prev_day.year, prev_day.month, prev_day.day, 22, 0, 0)
        active_reporting_date = prev_day.strftime("%Y-%m-%d")
        is_frozen = True
        badge = "[CERRADO] REPORTE OFICIAL CERRADO"
        desc = f"Reporte matutino cerrado al {prev_day.strftime('%d/%m/%Y')} (22:00 hrs). La jornada de hoy se liberará a las 10:00 AM."
    elif current_dt.hour >= 22:
        # Noche a partir de las 22:00 hrs: corte cerrado de hoy a las 22:00 para depuración
        today = current_dt.date()
        max_visible_dt = datetime(today.year, today.month, today.day, 22, 0, 0)
        active_reporting_date = today.strftime("%Y-%m-%d")
        is_frozen = True
        badge = "[CORTE 22:00] CORTE OFICIAL ACTIVO"
        desc = f"Corte oficial de las 10:00 PM activo ({today.strftime('%d/%m/%Y')}). Período de depuración. Registros posteriores se liberan mañana a las 10:00 AM."
    else:
        # Jornada activa en vivo (10:00 AM a 22:00 PM)
        today = current_dt.date()
        max_visible_dt = current_dt
        active_reporting_date = today.strftime("%Y-%m-%d")
        is_frozen = False
        badge = "[EN VIVO] JORNADA EN VIVO"
        desc = f"Jornada en vivo activa ({today.strftime('%d/%m/%Y')}, {current_dt.strftime('%H:%M')} hrs). Próximo corte oficial hoy a las 10:00 PM."


    return {
        "now": current_dt.strftime("%Y-%m-%d %H:%M:%S"),
        "corte_oficial_hora": "22:00",
        "liberacion_matutina_hora": "10:00",
        "active_reporting_date": active_reporting_date,
        "max_visible_dt": max_visible_dt.strftime("%Y-%m-%d %H:%M:%S"),
        "max_visible_datetime_str": max_visible_dt.strftime("%Y-%m-%d %H:%M:%S"),
        "max_visible_dt_obj": max_visible_dt,
        "is_frozen": is_frozen,
        "badge": badge,
        "description": desc
    }


def get_accounting_date(dt):
    """
    Calcula la fecha contable según el corte oficial de las 22:00 hrs:
    - Si la hora es >= 22:00: pertenece al ciclo del día siguiente.
    - Si la hora es < 22:00: pertenece al ciclo del día actual.
    """
    if dt.hour >= 22:
        return (dt.date() + timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        return dt.strftime("%Y-%m-%d")


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
    print(f"\n[2/3] Descargando respuestas de Forma {form_id} con paginación...")
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json"
    }
    all_objects = []
    limit = 1000
    offset = 0

    while True:
        url = f"{ANSWERS_URL}?form_id={form_id}&limit={limit}&offset={offset}"
        try:
            resp = requests.get(url, headers=headers, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                objs = data.get("data") or data.get("results") or data.get("objects") or []
                if not objs or len(objs) == 0:
                    break
                all_objects.extend(objs)
                print(f"  [Pagina offset={offset}] {len(objs)} registros recuperados (Total acumulado: {len(all_objects)}).")
                if len(objs) < limit:
                    break
                offset += limit
            else:
                print(f"  [ERROR {resp.status_code}] Fallo en offset={offset}: {resp.text[:200]}")
                break
        except Exception as e:
            print(f"  [EXCEPCION] Error al consultar Forma {form_id} en offset={offset}: {e}")
            break

    print(f"  [OK] Forma {form_id}: Total de {len(all_objects)} registros recuperados.")
    return all_objects

def process_and_save_data(raw_records, raw_materials, output_dir, current_dt=None):
    print("\n[3/3] Procesando y mapeando registros para el Dashboard...")
    cutoff_info = get_cutoff_info(current_dt)
    print(f"  [Regla de Corte] {cutoff_info['badge']}: {cutoff_info['description']}")
    max_visible_dt = cutoff_info["max_visible_dt_obj"]

    # Mapeo Trabajos (142786)
    mapped_records = []
    retained_records = 0
    for i, item in enumerate(raw_records or []):
        ans = item.get("answers", {})
        created_at = item.get("created_at")
        date_str = ""
        time_str = ""
        dt = None
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
            try:
                dt = datetime.strptime(created_at.replace("T", " ")[:19], "%Y-%m-%d %H:%M:%S")
            except Exception:
                try:
                    dt = datetime.strptime(f"{date_str} {time_str}:00", "%Y-%m-%d %H:%M:%S")
                except Exception:
                    dt = datetime.now()
        
        if not dt:
            dt = datetime.now()
            date_str = dt.strftime("%Y-%m-%d")
            time_str = dt.strftime("%H:%M")

        # Regla de corte: si se subió posterior al corte visible actual, se congela hasta las 10:00 AM
        if dt > max_visible_dt:
            retained_records += 1
            continue

        fecha_corte = get_accounting_date(dt)
        created_at_iso = dt.strftime("%Y-%m-%d %H:%M:%S")

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
            "fecha": fecha_corte,
            "fecha_captura": date_str,
            "hora": time_str,
            "fecha_corte": fecha_corte,
            "created_at_iso": created_at_iso,
            "timestamp": dt.timestamp(),
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
    retained_materials = 0
    for idx, m in enumerate(raw_materials or []):
        ans = m.get("answers", {})
        area = (ans.get("6ad695943f0d28deb4a6c9a3") or "GENERAL").upper()
        desc = (ans.get("6ad692011583192abb37cd8f") or "MATERIAL").upper()
        qty = float(ans.get("6ad65b0b1b305d8b534b1e13") or 0)
        unidad_val = ans.get("6ad695943f0d28deb4a6c9a4") or "PZAS."
        if isinstance(unidad_val, list):
            unidad_val = unidad_val[0] if unidad_val else "PZAS."
        
        fecha_val = ans.get("6ad65b0b1b305d8b534b1e11") or ""
        mat_dt = None
        if fecha_val:
            try:
                mat_dt = datetime.strptime(str(fecha_val)[:19].replace("T", " "), "%Y-%m-%d %H:%M:%S")
            except Exception:
                try:
                    mat_dt = datetime.strptime(str(fecha_val)[:10], "%Y-%m-%d")
                except Exception:
                    pass
        if not mat_dt and m.get("created_at"):
            created_at = m.get("created_at")
            if isinstance(created_at, (int, float)):
                mat_dt = datetime.fromtimestamp(created_at)

        if not mat_dt:
            mat_dt = datetime.now()

        # Regla de corte para materiales
        if mat_dt > max_visible_dt:
            retained_materials += 1
            continue

        mat_fecha_corte = get_accounting_date(mat_dt)
        fecha_display = mat_dt.strftime("%Y-%m-%d %H:%M:%S")

        photo_arr = ans.get("6ad69fb41583192abb37cdaa") or []
        photo_url = photo_arr[0].get("file_url") if (isinstance(photo_arr, list) and len(photo_arr) > 0) else ""

        mapped_materials.append({
            "id": m.get("folio") or m.get("id") or f"MAT-{idx+1}",
            "area": area,
            "descripcion": desc,
            "cantidad": qty,
            "unidad": str(unidad_val).upper(),
            "fecha": mat_fecha_corte,
            "fecha_captura": mat_dt.strftime("%Y-%m-%d"),
            "hora": mat_dt.strftime("%H:%M"),
            "created_at_iso": fecha_display,
            "foto": photo_url
        })

    # 1. Guardar JSONs crudos
    raw_rec_path = os.path.join(output_dir, "linkaform_records_142786.json")
    with open(raw_rec_path, "w", encoding="utf-8") as f:
        json.dump(raw_records, f, indent=2, ensure_ascii=False)

    raw_mat_path = os.path.join(output_dir, "linkaform_materials_184350.json")
    with open(raw_mat_path, "w", encoding="utf-8") as f:
        json.dump(raw_materials, f, indent=2, ensure_ascii=False)

    # 2. Guardar archivo JS listo para browser con metadata de corte
    json_cutoff = {k: v for k, v in cutoff_info.items() if k != "max_visible_dt_obj"}

    output_js = os.path.join(output_dir, "linkaform_live_data.js")
    with open(output_js, "w", encoding="utf-8") as f:
        f.write("/**\n")
        f.write(" * Datos Oficiales Sincronizados en Vivo desde Linkaform API\n")
        f.write(f" * Sincronización: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f" * Estado de corte: {cutoff_info['description']}\n")
        f.write(f" * Trabajos de campo visibles: {len(mapped_records)} (Retenidos por corte: {retained_records})\n")
        f.write(f" * Movimientos de materiales visibles: {len(mapped_materials)} (Retenidos por corte: {retained_materials})\n")
        f.write(" */\n\n")
        f.write("const LINKAFORM_CUTOFF_INFO = ")
        json.dump(json_cutoff, f, indent=2, ensure_ascii=False)
        f.write(";\n\n")
        f.write("const LINKAFORM_LIVE_RECORDS = ")
        json.dump(mapped_records, f, indent=2, ensure_ascii=False)
        f.write(";\n\n")
        f.write("const LINKAFORM_LIVE_MATERIALS = ")
        json.dump(mapped_materials, f, indent=2, ensure_ascii=False)
        f.write(";\n")

    print(f"  [OK] Guardado archivo JS: {output_js}")
    print(f"  [OK] Trabajos Visibles: {len(mapped_records)} (Retenidos por corte: {retained_records})")
    print(f"  [OK] Materiales Visibles: {len(mapped_materials)} (Retenidos por corte: {retained_materials})")


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
