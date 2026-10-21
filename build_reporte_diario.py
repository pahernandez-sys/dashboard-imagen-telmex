"""
Generador de Reporte Diario de Casetas y Cajas Contratistas 2026
Replica oficial del formato Excel con datos actualizados de Linkaform
Plantilla base: Reporte diarios Casetas y Cajas Contratistas 2026 - IASA.xlsx

Regla de actualización:
- Los números de ayer hacia atrás (<= 2026-10-20) NO se mueven.
- Solo a partir de hoy (>= 2026-10-21) se actualizan las intervenciones diarias y nuevos materiales.
- Las fórmulas de totales (=CN... / =CH...) y sumas automáticas se respetan al 100%.
"""

import os
import json
import openpyxl
from copy import copy
from datetime import datetime
from collections import defaultdict

BASE_TEMPLATE_PATH = r"c:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\Reporte diarios Casetas y Cajas Contratistas 2026 - IASA.xlsx"
LOCAL_TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "data", "Reporte_Diario_Casetas_y_Cajas_Contratistas_2026.xlsx")

START_DATE = "2026-10-21"

def load_live_data():
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    js_path = os.path.join(data_dir, "linkaform_live_data.js")
    
    if not os.path.exists(js_path):
        print(f"[ERROR] No se encontró {js_path}")
        return [], []
        
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    rec_part = content.split("LINKAFORM_LIVE_RECORDS = ")[1].split(";\n\nconst LINKAFORM_LIVE_MATERIALS")[0]
    mat_part = content.split("const LINKAFORM_LIVE_MATERIALS = ")[1].strip(";\n ")
    
    records = json.loads(rec_part)
    materials = json.loads(mat_part)
    return records, materials

def normalize_area_str(val):
    if not val:
        return ""
    import unicodedata
    s = str(val).strip().upper()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s.replace("-", " ").replace("  ", " ").strip()

def build_reporte_diario():
    template_source = BASE_TEMPLATE_PATH if os.path.exists(BASE_TEMPLATE_PATH) else LOCAL_TEMPLATE_PATH
    if not os.path.exists(template_source):
        raise FileNotFoundError(f"No se encontró la plantilla base en {template_source}")
        
    print(f"Cargando plantilla base: {template_source}...")
    wb = openpyxl.load_workbook(template_source, data_only=False)
    records, materials = load_live_data()
    print(f"Datos cargados: {len(records)} trabajos de campo, {len(materials)} entregas de materiales.")

    # 1. Agrupar Materiales NUEVOS a partir de START_DATE (>= 2026-10-21)
    caseta_materials_new = defaultdict(float)
    caja_materials_new = defaultdict(float)

    for m in materials:
        fecha_m = str(m.get("fecha") or "")[:10]
        if fecha_m and fecha_m < START_DATE:
            # Los de ayer hacia atrás ya están validados en la plantilla IASA
            continue
            
        area_norm = normalize_area_str(m.get("area"))
        desc = (m.get("descripcion") or "").upper().strip()
        qty = float(m.get("cantidad") or 0)
        
        if "CASETA" in desc or "SEMICIRCULAR" in desc:
            caseta_materials_new[area_norm] += qty
        else:
            caja_materials_new[area_norm] += qty

    # 2. Agrupar Trabajos NUEVOS a partir de START_DATE (>= 2026-10-21)
    caseta_works_new = defaultdict(lambda: defaultdict(int))
    caja_works_new = defaultdict(lambda: defaultdict(int))

    for r in records:
        fecha = str(r.get("fecha") or "").replace("/", "-")[:10]
        if not fecha or fecha < START_DATE:
            # Los de ayer hacia atrás ya están capturados en la plantilla IASA
            continue

        tipo = (r.get("tipo") or "CAJA").upper().strip()
        area_norm = normalize_area_str(r.get("area_trabajo"))
            
        if tipo == "CASETA":
            caseta_works_new[area_norm][fecha] += 1
        else:
            caja_works_new[area_norm][fecha] += 1

    # =========================================================
    # HOJA 1: Programa CASETAS REPORTE DIARIO
    # =========================================================
    ws_casetas = wb["Programa CASETAS REPORTE DIARIO"]
    print("\nProcesando hoja 'Programa CASETAS REPORTE DIARIO'...")
    
    # Mapeo de columnas de fechas (Fila 12)
    casetas_date_cols = {}
    for c in range(23, ws_casetas.max_column + 1):
        v = ws_casetas.cell(12, c).value
        d_str = ""
        if isinstance(v, datetime):
            d_str = v.strftime("%Y-%m-%d")
        elif isinstance(v, str) and "2026" in v:
            d_str = v.strip()[:10]
        if d_str:
            casetas_date_cols[d_str] = c

    # Mapeo de filas de áreas (ignorando totales)
    casetas_area_rows = {}
    for r in range(14, ws_casetas.max_row + 1):
        c3 = ws_casetas.cell(r, 3).value
        c2 = ws_casetas.cell(r, 2).value
        if c3 and c3 not in ("Total general", "TELNOR"):
            a_val = normalize_area_str(c3)
            if a_val and a_val not in casetas_area_rows:
                casetas_area_rows[a_val] = r
        if c2 and c2 not in ("Total general", "TELNOR", "CDMX Y AREA CONURBADA"):
            at_val = normalize_area_str(c2)
            if at_val and at_val not in casetas_area_rows:
                casetas_area_rows[at_val] = r

    def find_caseta_row(area_n):
        if area_n in casetas_area_rows:
            return casetas_area_rows[area_n]
        for k, r_idx in casetas_area_rows.items():
            if area_n in k or k in area_n:
                return r_idx
        return None

    # Actualizar Materiales Casetas nuevos (Col CU: 99)
    COL_CU_CASETAS = 99
    for area_norm, qty in caseta_materials_new.items():
        row_idx = find_caseta_row(area_norm)
        if row_idx and qty > 0:
            current_val = ws_casetas.cell(row_idx, COL_CU_CASETAS).value
            if isinstance(current_val, (int, float)):
                ws_casetas.cell(row_idx, COL_CU_CASETAS).value = current_val + qty
            else:
                ws_casetas.cell(row_idx, COL_CU_CASETAS).value = qty
            print(f"  [Casetas Material Nuevo] {area_norm} -> Fila {row_idx}, +{qty} en Col CU")

    TODAY_LIMIT = datetime.now().strftime("%Y-%m-%d")

    # Actualizar Trabajos Casetas a partir de hoy (START_DATE) y hasta TODAY_LIMIT
    for area_norm, dates in caseta_works_new.items():
        row_idx = find_caseta_row(area_norm)
        if row_idx:
            for f_str, count in dates.items():
                if START_DATE <= f_str <= TODAY_LIMIT:
                    col_idx = casetas_date_cols.get(f_str)
                    if col_idx:
                        ws_casetas.cell(row_idx, col_idx).value = count
                        print(f"  [Casetas Avance Hoy] {area_norm} ({f_str}) -> Fila {row_idx}, Col {openpyxl.utils.get_column_letter(col_idx)}={count}")

    # Limpiar columnas futuras (> TODAY_LIMIT) para evitar cualquier dato en el 22 de octubre o posterior
    for d_str, col_idx in casetas_date_cols.items():
        if d_str > TODAY_LIMIT:
            for r in range(14, ws_casetas.max_row + 1):
                cell = ws_casetas.cell(r, col_idx)
                if isinstance(cell.value, (int, float)):
                    cell.value = None

    # =========================================================
    # HOJA 2: Programa CAJAS REPORTE DIARIO
    # =========================================================
    ws_cajas = wb["Programa CAJAS REPORTE DIARIO"]
    print("\nProcesando hoja 'Programa CAJAS REPORTE DIARIO'...")
    
    # Mapeo de columnas de fechas (Fila 12)
    cajas_date_cols = {}
    for c in range(29, ws_cajas.max_column + 1):
        v = ws_cajas.cell(12, c).value
        d_str = ""
        if isinstance(v, datetime):
            d_str = v.strftime("%Y-%m-%d")
        elif isinstance(v, str) and "2026" in v:
            d_str = v.strip()[:10]
        if d_str:
            cajas_date_cols[d_str] = c

    # Mapeo de filas de áreas
    cajas_area_rows = {}
    for r in range(14, ws_cajas.max_row + 1):
        c3 = ws_cajas.cell(r, 3).value
        c2 = ws_cajas.cell(r, 2).value
        if c3 and c3 not in ("Total general", "TELNOR"):
            a_val = normalize_area_str(c3)
            if a_val and a_val not in cajas_area_rows:
                cajas_area_rows[a_val] = r
        if c2 and c2 not in ("Total general", "TELNOR", "CDMX Y AREA CONURBADA"):
            at_val = normalize_area_str(c2)
            if at_val and at_val not in cajas_area_rows:
                cajas_area_rows[at_val] = r

    def find_caja_row(area_n):
        if area_n in cajas_area_rows:
            return cajas_area_rows[area_n]
        for k, r_idx in cajas_area_rows.items():
            if area_n in k or k in area_n:
                return r_idx
        return None

    # Actualizar Materiales Cajas nuevos (Col CO: 93)
    COL_CO_CAJAS = 93
    for area_norm, qty in caja_materials_new.items():
        row_idx = find_caja_row(area_norm)
        if row_idx and qty > 0:
            current_val = ws_cajas.cell(row_idx, COL_CO_CAJAS).value
            if isinstance(current_val, (int, float)):
                ws_cajas.cell(row_idx, COL_CO_CAJAS).value = current_val + qty
            else:
                ws_cajas.cell(row_idx, COL_CO_CAJAS).value = qty
            print(f"  [Cajas Material Nuevo] {area_norm} -> Fila {row_idx}, +{qty} en Col CO")

    # Actualizar Trabajos Cajas a partir de hoy (START_DATE) y hasta TODAY_LIMIT
    for area_norm, dates in caja_works_new.items():
        row_idx = find_caja_row(area_norm)
        if row_idx:
            for f_str, count in dates.items():
                if START_DATE <= f_str <= TODAY_LIMIT:
                    col_idx = cajas_date_cols.get(f_str)
                    if col_idx:
                        ws_cajas.cell(row_idx, col_idx).value = count
                        print(f"  [Cajas Avance Hoy] {area_norm} ({f_str}) -> Fila {row_idx}, Col {openpyxl.utils.get_column_letter(col_idx)}={count}")

    # Limpiar columnas futuras (> TODAY_LIMIT) para evitar cualquier dato en el 22 de octubre o posterior
    for d_str, col_idx in cajas_date_cols.items():
        if d_str > TODAY_LIMIT:
            for r in range(14, ws_cajas.max_row + 1):
                cell = ws_cajas.cell(r, col_idx)
                if isinstance(cell.value, (int, float)):
                    cell.value = None

    # Asegurar que fila 78 en Cajas esté completamente vacía
    for c in range(1, ws_cajas.max_column + 1):
        cell = ws_cajas.cell(78, c)
        cell.value = None
        cell.border = openpyxl.styles.Border()
        cell.fill = openpyxl.styles.PatternFill(fill_type=None)
        cell.font = openpyxl.styles.Font()

    # Guardar en local del repositorio para descarga en GitHub Pages
    os.makedirs(os.path.dirname(LOCAL_TEMPLATE_PATH), exist_ok=True)
    wb.save(LOCAL_TEMPLATE_PATH)
    print(f"\n[OK] Archivo generado exitosamente en: {LOCAL_TEMPLATE_PATH}")

    # Guardar copia en el workspace principal del usuario
    user_copy_path = os.path.join(r"c:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2", "Reporte diarios Casetas y Cajas Contratistas 2026 - Actualizado.xlsx")
    try:
        wb.save(user_copy_path)
        print(f"[OK] Copia guardada en workspace del usuario: {user_copy_path}")
    except Exception as e:
        print(f"[Aviso] No se pudo escribir copia en workspace: {e}")

    return LOCAL_TEMPLATE_PATH

if __name__ == "__main__":
    build_reporte_diario()
