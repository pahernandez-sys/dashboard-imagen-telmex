"""
Generador de Réplica Actualizada de 'CANTIDADES MATERIALES RECIBIDOS.xlsx'
Mapea y actualiza las entregas de material capturadas en Linkaform (Forma 184350)
directamente en las columnas 'CANTIDADES RECIBIDAS' de las hojas:
- LATERALES IASA (Casetas)
- CAJAS IASA (Cajas)
- IASA (AREAS) (Directorio de plazas)
"""

import os
import re
import json
import shutil
import openpyxl
import unicodedata
from collections import defaultdict
from datetime import datetime

# Rutas principales
BASE_TEMPLATE_PATH = r"c:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\CANTIDADES MATERIALES RECIBIDOS.xlsx"
CLEAN_BASE_BACKUP = os.path.join(os.path.dirname(__file__), "data", "CANTIDADES_MATERIALES_RECIBIDOS_BASE.xlsx")
OUTPUT_EXCEL_PATH = os.path.join(os.path.dirname(__file__), "data", "CANTIDADES_MATERIALES_RECIBIDOS_ACTUALIZADO.xlsx")
USER_WORKSPACE_COPY = r"c:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\CANTIDADES MATERIALES RECIBIDOS - Actualizado.xlsx"

def normalize_str(val):
    if not val:
        return ""
    s = str(val).strip().upper()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    # Normalizar números romanos en áreas
    s = s.replace("-", " ").replace("  ", " ").strip()
    s = re.sub(r"\bMONTERREY\s+I\b", "MONTERREY 1", s)
    s = re.sub(r"\bMONTERREY\s+II\b", "MONTERREY 2", s)
    s = re.sub(r"\bMONTERREY\s+III\b", "MONTERREY 3", s)
    return s

def map_caseta_type(desc):
    d = (desc or "").upper()
    if "CUICUILCO" in d: return "Laterales de caseta cuicuilco"
    if "REFORMA" in d: return "Laterales de caseta Doble Reforma"
    if "SEMICIRCULAR" in d: return "Laterales de caseta Semicirculares"
    if "MINI" in d: return "Laterales de caseta Mini"
    if "NORMAL" in d: return "Laterales de caseta Normal"
    return None

def map_caja_type(desc):
    d = (desc or "").upper()
    if "SIECOR" in d:
        if "DOBLE" in d:
            return "Siecor Doble 160 X 77 Cm"
        if re.search(r"\b2\s*PTA", d) or "DOS PTA" in d:
            return "Siecor Sencilla 2 Pta 82 X 76 Cm"
        if re.search(r"\b1\s*PTA", d) or "UNA PTA" in d or "SENCILLA" in d:
            return "Siecor Sencilla 1 Pta 79 X 80 Cm"
        return "Siecor Doble 160 X 77 Cm"
    if "KRONE" in d: return "KRONE"
    if "ENVOLV" in d and "DOBLE" in d: return "ENVOLVENTE DOBLE"
    if "ENVOLV" in d: return "ENVOLVENTE SENCILLA"
    if ("DEPLAS" in d or "DESPLAZ" in d) and "DOBLE" in d: return "DESPLAZAMIENTO DOBLE"
    if ("DEPLAS" in d or "DESPLAZ" in d): return "DESPLAZAMIENTO SENCILLA"
    if "TRADICIONAL" in d and "DOBLE" in d: return "Tradicional Doble 147 X 77 Cm"
    if "TRADICIONAL" in d: return "Tradicional Sencilla 74 X 77 Cm"
    return None

def load_live_materials():
    js_path = os.path.join(os.path.dirname(__file__), "data", "linkaform_live_data.js")
    if not os.path.exists(js_path):
        print(f"[ERROR] No se encontró {js_path}")
        return []
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()
    mat_part = content.split("const LINKAFORM_LIVE_MATERIALS = ")[1].strip(";\n ")
    return json.loads(mat_part)

from sync_linkaform import get_cutoff_info, get_accounting_date

def build_materiales_recibidos(current_dt=None):
    # 1. Asegurar copia de la plantilla base limpia
    if os.path.exists(BASE_TEMPLATE_PATH):
        os.makedirs(os.path.dirname(CLEAN_BASE_BACKUP), exist_ok=True)
        shutil.copyfile(BASE_TEMPLATE_PATH, CLEAN_BASE_BACKUP)
    elif not os.path.exists(CLEAN_BASE_BACKUP):
        raise FileNotFoundError(f"No se encontró la plantilla base en {BASE_TEMPLATE_PATH} ni en {CLEAN_BASE_BACKUP}")

    cutoff_info = get_cutoff_info(current_dt)
    print(f"Cargando plantilla base: {CLEAN_BASE_BACKUP}...")
    print(f"  [Regla de Corte Materiales] {cutoff_info['badge']}: {cutoff_info['description']}")
    wb = openpyxl.load_workbook(CLEAN_BASE_BACKUP, data_only=False)
    materials = load_live_materials()
    print(f"Cargados {len(materials)} registros de entregas de materiales de Linkaform.")


    # =========================================================
    # 1. HOJA: LATERALES IASA (Casetas)
    # =========================================================
    ws_lat = wb["LATERALES IASA"]
    lat_date_cols = {} # date_str -> col_idx_recibidas
    for c in range(5, ws_lat.max_column):
        v = ws_lat.cell(2, c).value
        if v and "2026" in str(v):
            d_str = str(v)[:10]
            if ws_lat.cell(2, c + 1).value == "RECIBIDAS":
                lat_date_cols[d_str] = c + 1

    lat_rows = defaultdict(list)
    for r in range(4, ws_lat.max_row + 1):
        t = ws_lat.cell(r, 1).value
        a = ws_lat.cell(r, 3).value
        if t and a:
            key = (normalize_str(t), normalize_str(a))
            lat_rows[key].append(r)

    # =========================================================
    # 2. HOJA: CAJAS IASA (Cajas)
    # =========================================================
    ws_caj = wb["CAJAS IASA"]
    caj_date_cols = {} # date_str -> col_idx_recibidas
    for c in range(6, ws_caj.max_column):
        v = ws_caj.cell(3, c).value
        if v and "2026" in str(v):
            d_str = str(v)[:10]
            if ws_caj.cell(3, c + 1).value == "RECIBIDAS":
                caj_date_cols[d_str] = c + 1

    caj_rows = defaultdict(list)
    for r in range(5, ws_caj.max_row + 1):
        t = ws_caj.cell(r, 1).value
        a = ws_caj.cell(r, 4).value
        if t and a:
            key = (normalize_str(t), normalize_str(a))
            caj_rows[key].append(r)

    # =========================================================
    # 3. POBLAR CANTIDADES RECIBIDAS DE LINKAFORM
    # =========================================================
    # Agrupar materiales por (is_caseta, mapped_type, area_norm, fecha_str)
    grouped_materials = defaultdict(float)
    for m in materials:
        f_str = str(m.get("fecha") or "")[:10]
        desc = (m.get("descripcion") or "").strip()
        area = (m.get("area") or "").strip()
        qty = float(m.get("cantidad") or 0)
        if not f_str or qty <= 0:
            continue

        is_cas = "CASETA" in desc.upper() or "SEMICIRCULAR" in desc.upper()
        if is_cas:
            mapped_t = map_caseta_type(desc)
        else:
            mapped_t = map_caja_type(desc)
            
        if not mapped_t:
            continue
            
        a_norm = normalize_str(area)
        grouped_materials[(is_cas, mapped_t, a_norm, f_str)] += qty

    actualizaciones_casetas = 0
    actualizaciones_cajas = 0

    for (is_cas, mapped_t, a_norm, f_str), qty in grouped_materials.items():
        if is_cas:
            target_ws = ws_lat
            target_rows_map = lat_rows
            target_date_cols = lat_date_cols
        else:
            target_ws = ws_caj
            target_rows_map = caj_rows
            target_date_cols = caj_date_cols

        recib_col = target_date_cols.get(f_str)
        if not recib_col:
            continue

        t_norm = normalize_str(mapped_t)
        row_candidates = target_rows_map.get((t_norm, a_norm))
        if not row_candidates:
            # Búsqueda difusa por coincidencia parcial de área
            for (kt, ka), r_list in target_rows_map.items():
                if kt == t_norm and (a_norm in ka or ka in a_norm):
                    row_candidates = r_list
                    break

        if not row_candidates:
            continue

        # Seleccionar la fila más idónea si existen múltiples (p. ej. Morelos/Toluca fases 0 y 1)
        best_row = row_candidates[0]
        if len(row_candidates) > 1:
            for r in row_candidates:
                ship_val = target_ws.cell(r, recib_col - 1).value
                if ship_val and isinstance(ship_val, (int, float)) and float(ship_val) == qty:
                    best_row = r
                    break
                elif ship_val and isinstance(ship_val, (int, float)) and float(ship_val) > 0:
                    best_row = r

        # Asignar la cantidad en la columna CANTIDADES RECIBIDAS
        current_val = target_ws.cell(best_row, recib_col).value
        if isinstance(current_val, (int, float)):
            target_ws.cell(best_row, recib_col).value = current_val + qty
        else:
            target_ws.cell(best_row, recib_col).value = qty

        col_let = openpyxl.utils.get_column_letter(recib_col)
        if is_cas:
            actualizaciones_casetas += 1
            print(f"  [Lateral Recibido] {a_norm} | {f_str} -> Fila {best_row}, Col {col_let} = {qty}")
        else:
            actualizaciones_cajas += 1
            print(f"  [Caja Recibida] {a_norm} | {f_str} -> Fila {best_row}, Col {col_let} = {qty}")

    # Guardar archivo actualizado
    os.makedirs(os.path.dirname(OUTPUT_EXCEL_PATH), exist_ok=True)
    wb.save(OUTPUT_EXCEL_PATH)
    print(f"\n[OK] Archivo generado exitosamente en: {OUTPUT_EXCEL_PATH}")

    try:
        wb.save(USER_WORKSPACE_COPY)
        print(f"[OK] Copia guardada en workspace del usuario: {USER_WORKSPACE_COPY}")
    except Exception as e:
        print(f"[Aviso] No se pudo escribir copia en workspace: {e}")

    print(f"[Resumen] Casetas actualizadas: {actualizaciones_casetas}, Cajas actualizadas: {actualizaciones_cajas}")
    return OUTPUT_EXCEL_PATH

if __name__ == "__main__":
    build_materiales_recibidos()
