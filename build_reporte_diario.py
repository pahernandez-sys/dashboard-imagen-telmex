"""
Generador de Reporte Diario de Casetas y Cajas Contratistas 2026
Replica oficial del formato Excel con datos actualizados de Linkaform
Plantilla base oficial: Reporte diarios Casetas y Cajas Contratistas 2026 - IASA.xlsx

Reglas de replicación e integridad:
1. Réplica 100% fiel de la plantilla oficial IASA.
2. Los números históricos de ayer hacia atrás (<= 2026-10-20) permanecen intactos.
3. Solo a partir de START_DATE (>= 2026-10-21) se actualizan las intervenciones diarias y entregas de materiales.
4. Desglose de materiales por tipo en columnas CS:DB (Cajas) y CY:DC (Casetas).
5. Las fórmulas de totales (=SUM, =DC, =DD, =CN, =CH, etc.) se preservan y calculan automáticamente.
"""

import os
import re
import json
import shutil
import openpyxl
import unicodedata
from collections import defaultdict
from datetime import datetime

# Rutas de plantillas y salidas
BASE_IASA_WORKSPACE = r"c:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\Reporte diarios Casetas y Cajas Contratistas 2026 - IASA.xlsx"
CLEAN_BASE_LOCAL = os.path.join(os.path.dirname(__file__), "data", "Reporte_diarios_IASA_BASE.xlsx")
OUTPUT_EXCEL_DATA = os.path.join(os.path.dirname(__file__), "data", "Reporte_Diario_Casetas_y_Cajas_Contratistas_2026.xlsx")
USER_WORKSPACE_COPY = r"c:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\Reporte diarios Casetas y Cajas Contratistas 2026 - Actualizado.xlsx"

START_DATE = "2026-10-21"

def normalize_area_str(val):
    if not val:
        return ""
    s = str(val).strip().upper()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s.replace("-", " ").replace("  ", " ").strip()

def map_caseta_mat_col(desc):
    d = (desc or "").upper()
    if "CUICUILCO" in d: return 107    # DC
    if "REFORMA" in d: return 106      # DB
    if "SEMICIRCULAR" in d: return 105 # DA
    if "MINI" in d: return 104         # CZ
    if "NORMAL" in d: return 103       # CY
    return None

def map_caja_mat_col(desc):
    d = (desc or "").upper()
    if "SIECOR" in d:
        if "DOBLE" in d:
            return 102 # CX
        if re.search(r"\b2\s*PTA", d) or "DOS PTA" in d:
            return 104 # CZ
        if re.search(r"\b1\s*PTA", d) or "UNA PTA" in d or "SENCILLA" in d:
            return 103 # CY
        return 102
    if "KRONE" in d: return 101 # CW
    if "ENVOLV" in d and "DOBLE" in d: return 99 # CU
    if "ENVOLV" in d: return 100 # CV
    if ("DEPLAS" in d or "DESPLAZ" in d) and "DOBLE" in d: return 97 # CS
    if ("DEPLAS" in d or "DESPLAZ" in d): return 98 # CT
    if "TRADICIONAL" in d and "DOBLE" in d: return 105 # DA
    if "TRADICIONAL" in d: return 106 # DB
    return None

def load_live_data():
    js_path = os.path.join(os.path.dirname(__file__), "data", "linkaform_live_data.js")
    if not os.path.exists(js_path):
        print(f"[ERROR] No se encontró {js_path}")
        return [], []
    with open(js_path, "r", encoding="utf-8") as f:
        content = f.read()
    rec_part = content.split("LINKAFORM_LIVE_RECORDS = ")[1].split(";\n\nconst LINKAFORM_LIVE_MATERIALS")[0]
    mat_part = content.split("const LINKAFORM_LIVE_MATERIALS = ")[1].strip(";\n ")
    return json.loads(rec_part), json.loads(mat_part)

def build_reporte_diario():
    # 1. Asegurar copia de la plantilla base oficial IASA
    if os.path.exists(BASE_IASA_WORKSPACE):
        shutil.copyfile(BASE_IASA_WORKSPACE, CLEAN_BASE_LOCAL)
    elif not os.path.exists(CLEAN_BASE_LOCAL):
        raise FileNotFoundError("No se encontró la plantilla oficial IASA.")

    print(f"Cargando plantilla base limpia: {CLEAN_BASE_LOCAL}...")
    wb = openpyxl.load_workbook(CLEAN_BASE_LOCAL, data_only=False)

    records, materials = load_live_data()
    print(f"Datos cargados: {len(records)} trabajos de campo, {len(materials)} entregas de materiales.")

    today_limit = datetime.now().strftime("%Y-%m-%d")

    # =========================================================
    # HOJA 1: Programa CASETAS REPORTE DIARIO
    # =========================================================
    ws_cas = wb["Programa CASETAS REPORTE DIARIO"]
    casetas_areas = {}
    for r in range(14, 79):
        c3 = normalize_area_str(ws_cas.cell(r, 3).value)
        c2 = normalize_area_str(ws_cas.cell(r, 2).value)
        if c3: casetas_areas[c3] = r
        if c2 and c2 not in casetas_areas: casetas_areas[c2] = r

    def find_caseta_row(a):
        norm = normalize_area_str(a)
        if norm in casetas_areas: return casetas_areas[norm]
        for k, r in casetas_areas.items():
            if norm in k or k in norm: return r
        return None

    cas_date_cols = {}
    for c in range(23, 92):
        v = ws_cas.cell(12, c).value
        d_str = str(v)[:10] if v else ""
        if "2026" in d_str:
            cas_date_cols[d_str] = c

    # Materiales históricos Casetas en desglose
    # Toluca (Row 28): 48 normales
    ws_cas.cell(28, 103).value = 48
    ws_cas.cell(28, 99).value = "=DD28"
    # Morelos (Row 27): 554 normales, 64 mini
    ws_cas.cell(27, 103).value = 554
    ws_cas.cell(27, 104).value = 64
    ws_cas.cell(27, 99).value = "=DD27"

    # =========================================================
    # HOJA 2: Programa CAJAS REPORTE DIARIO
    # =========================================================
    ws_caj = wb["Programa CAJAS REPORTE DIARIO"]
    cajas_areas = {}
    for r in range(14, 77):
        c3 = normalize_area_str(ws_caj.cell(r, 3).value)
        c2 = normalize_area_str(ws_caj.cell(r, 2).value)
        if c3: cajas_areas[c3] = r
        if c2 and c2 not in cajas_areas: cajas_areas[c2] = r

    def find_caja_row(a):
        norm = normalize_area_str(a)
        if norm in cajas_areas: return cajas_areas[norm]
        for k, r in cajas_areas.items():
            if norm in k or k in norm: return r
        return None

    caj_date_cols = {}
    for c in range(29, 86):
        v = ws_caj.cell(12, c).value
        d_str = str(v)[:10] if v else ""
        if "2026" in d_str:
            caj_date_cols[d_str] = c

    # Materiales históricos Cajas en desglose
    # Morelos (Row 27): 176 tradicional sencilla
    ws_caj.cell(27, 106).value = 176
    ws_caj.cell(27, 93).value = "=DC27"
    # Toluca (Row 28): 67 desp dob, 38 desp senc, 5 env senc, 8 siecor dob, 16 siecor 1 pta
    ws_caj.cell(28, 97).value = 67
    ws_caj.cell(28, 98).value = 38
    ws_caj.cell(28, 100).value = 5
    ws_caj.cell(28, 102).value = 8
    ws_caj.cell(28, 103).value = 16
    ws_caj.cell(28, 93).value = "=DC28"
    # Nayarit (Row 41): 2 krone
    ws_caj.cell(41, 101).value = 2
    ws_caj.cell(41, 93).value = "=DC41"

    # =========================================================
    # APLICAR MATERIALES NUEVOS (>= START_DATE)
    # =========================================================
    for m in materials:
        f_m = str(m.get("fecha") or "")[:10]
        if f_m < START_DATE:
            continue
        
        area = m.get("area") or ""
        desc = (m.get("descripcion") or "").strip()
        qty = float(m.get("cantidad") or 0)
        if qty <= 0:
            continue

        is_cas = "CASETA" in desc.upper() or "SEMICIRCULAR" in desc.upper()
        if is_cas:
            r_idx = find_caseta_row(area)
            c_idx = map_caseta_mat_col(desc)
            if r_idx and c_idx:
                curr = ws_cas.cell(r_idx, c_idx).value
                ws_cas.cell(r_idx, c_idx).value = (curr or 0) + qty
                ws_cas.cell(r_idx, 99).value = f"=DD{r_idx}"
                print(f"  [Caseta Mat Nuevo] {area} -> Fila {r_idx}, Col {c_idx} += {qty}")
        else:
            r_idx = find_caja_row(area)
            c_idx = map_caja_mat_col(desc)
            if r_idx and c_idx:
                curr = ws_caj.cell(r_idx, c_idx).value
                ws_caj.cell(r_idx, c_idx).value = (curr or 0) + qty
                ws_caj.cell(r_idx, 93).value = f"=DC{r_idx}"
                print(f"  [Caja Mat Nuevo] {area} -> Fila {r_idx}, Col {c_idx} += {qty}")

    # =========================================================
    # APLICAR TRABAJOS DE CAMPO NUEVOS (START_DATE <= fecha <= today)
    # =========================================================
    caseta_works = defaultdict(lambda: defaultdict(int))
    caja_works = defaultdict(lambda: defaultdict(int))

    for rec in records:
        f_rec = str(rec.get("fecha") or "").replace("/", "-")[:10]
        if not f_rec or f_rec < START_DATE or f_rec > today_limit:
            continue
        
        tipo = (rec.get("tipo") or "CAJA").upper().strip()
        area = rec.get("area_trabajo") or ""
        if tipo == "CASETA":
            caseta_works[area][f_rec] += 1
        else:
            caja_works[area][f_rec] += 1

    for area, f_map in caseta_works.items():
        r_idx = find_caseta_row(area)
        if r_idx:
            for f_str, count in f_map.items():
                c_idx = cas_date_cols.get(f_str)
                if c_idx:
                    ws_cas.cell(r_idx, c_idx).value = count
                    print(f"  [Caseta Avance Hoy] {area} ({f_str}) -> Fila {r_idx}, Col {c_idx} = {count}")

    for area, f_map in caja_works.items():
        r_idx = find_caja_row(area)
        if r_idx:
            for f_str, count in f_map.items():
                c_idx = caj_date_cols.get(f_str)
                if c_idx:
                    ws_caj.cell(r_idx, c_idx).value = count
                    print(f"  [Caja Avance Hoy] {area} ({f_str}) -> Fila {r_idx}, Col {c_idx} = {count}")

    # Guardar en data del repo y copia del usuario
    os.makedirs(os.path.dirname(OUTPUT_EXCEL_DATA), exist_ok=True)
    wb.save(OUTPUT_EXCEL_DATA)
    print(f"\n[OK] Archivo generado exitosamente en: {OUTPUT_EXCEL_DATA}")

    try:
        wb.save(USER_WORKSPACE_COPY)
        print(f"[OK] Copia guardada en workspace del usuario: {USER_WORKSPACE_COPY}")
    except Exception as e:
        print(f"[Aviso] No se pudo escribir copia en workspace: {e}")

    return OUTPUT_EXCEL_DATA

if __name__ == "__main__":
    build_reporte_diario()
