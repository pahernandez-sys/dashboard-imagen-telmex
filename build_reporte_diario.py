"""
Generador de Reporte Diario de Casetas y Cajas Contratistas 2026
Replica oficial del formato Excel con datos actualizados de Linkaform
- Mantiene 100% el formato, estilos, colores y fórmulas originales del archivo base.
- Actualiza los suministros de materiales en base a Forma 184350:
  * Suma todos los materiales de CASETAS por área en 'Programa CASETAS REPORTE DIARIO' (Col CU: MATERIAL RECIBIDO).
  * Suma todos los materiales de CAJAS por área en 'Programa CAJAS REPORTE DIARIO' (Col CO: MATERIAL RECIBIDO).
- Actualiza las intervenciones diarias por fecha en base a Forma 142786.
"""

import os
import json
import openpyxl
from copy import copy
from datetime import datetime
from collections import defaultdict

BASE_TEMPLATE_PATH = r"c:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\Reporte diarios Casetas y Cajas Contratistas 2026 - 16-10-26.xlsx"
LOCAL_TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "data", "Reporte_Diario_Casetas_y_Cajas_Contratistas_2026.xlsx")

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

    # 1. Agrupar Materiales por Tipo (CASETA vs CAJA) y Área
    caseta_materials = defaultdict(float)
    caja_materials = defaultdict(float)

    for m in materials:
        area_norm = normalize_area_str(m.get("area"))
        desc = (m.get("descripcion") or "").upper().strip()
        qty = float(m.get("cantidad") or 0)
        
        if "CASETA" in desc or "SEMICIRCULAR" in desc:
            caseta_materials[area_norm] += qty
        else:
            caja_materials[area_norm] += qty

    # 2. Agrupar Trabajos por Tipo, Área y Fecha
    caseta_works = defaultdict(lambda: defaultdict(int))
    caja_works = defaultdict(lambda: defaultdict(int))

    for r in records:
        tipo = (r.get("tipo") or "CAJA").upper().strip()
        area_norm = normalize_area_str(r.get("area_trabajo"))
        fecha = str(r.get("fecha") or "").replace("/", "-")[:10]
        
        if not fecha:
            continue
            
        if tipo == "CASETA":
            caseta_works[area_norm][fecha] += 1
        else:
            caja_works[area_norm][fecha] += 1

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

    # Mapeo de filas de áreas
    casetas_area_rows = {}
    for r in range(14, 79):
        a_val = normalize_area_str(ws_casetas.cell(r, 3).value)
        at_val = normalize_area_str(ws_casetas.cell(r, 2).value)
        if a_val and a_val not in casetas_area_rows:
            casetas_area_rows[a_val] = r
        if at_val and at_val not in casetas_area_rows:
            casetas_area_rows[at_val] = r

    # Rellenar Materiales Casetas (Col CU: 99 - MATERIAL RECIBIDO)
    COL_CU_CASETAS = 99
    COL_CP_CASETAS = 94 # TOTAL COLOCADAS
    COL_CR_CASETAS = 96 # ATENDIDAS

    for area_norm, qty in caseta_materials.items():
        row_idx = casetas_area_rows.get(area_norm)
        if not row_idx:
            # Buscar coincidencia parcial
            for k, r in casetas_area_rows.items():
                if area_norm in k or k in area_norm:
                    row_idx = r
                    break
        if row_idx:
            ws_casetas.cell(row_idx, COL_CU_CASETAS).value = qty
            print(f"  [Casetas Material] {area_norm} -> Fila {row_idx}, Col CU={qty}")
        else:
            print(f"  [Aviso] Área de casetas no encontrada en plantilla: {area_norm}")

    # Rellenar Trabajos Casetas en fechas
    for area_norm, dates in caseta_works.items():
        row_idx = casetas_area_rows.get(area_norm)
        if not row_idx:
            for k, r in casetas_area_rows.items():
                if area_norm in k or k in area_norm:
                    row_idx = r
                    break
        if row_idx:
            total_area_casetas = 0
            for f_str, count in dates.items():
                total_area_casetas += count
                col_idx = casetas_date_cols.get(f_str)
                if col_idx:
                    ws_casetas.cell(row_idx, col_idx).value = count
                    print(f"  [Casetas Avance] {area_norm} ({f_str}) -> Fila {row_idx}, Col {openpyxl.utils.get_column_letter(col_idx)}={count}")
                else:
                    print(f"  [Aviso] Fecha sin columna en casetas: {f_str}")
            # Total colocadas
            ws_casetas.cell(row_idx, COL_CP_CASETAS).value = total_area_casetas
            ws_casetas.cell(row_idx, COL_CR_CASETAS).value = total_area_casetas

    # Normalizar bordes eliminando recuadros manuales gruesos (fila 27 MORELOS)
    for r in [26, 27, 28]:
        for c in range(1, ws_casetas.max_column + 1):
            ws_casetas.cell(r, c).border = copy(ws_casetas.cell(25, c).border)
    print("  [Bordes] Normalizados bordes de filas 26-28 en Casetas.")

    # Normalizar fuentes en área de materiales y resumen (quitar negrita)
    for r in range(14, 79):
        for c in range(94, 102):
            cell = ws_casetas.cell(r, c)
            if cell.font and cell.font.bold:
                cell.font = openpyxl.styles.Font(
                    name=cell.font.name or "Calibri",
                    size=cell.font.size or 11,
                    bold=False,
                    color=cell.font.color
                )
    print("  [Fuentes] Normalizadas fuentes (sin negrita) en área de materiales de Casetas.")

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
    for r in range(14, 77):
        a_val = normalize_area_str(ws_cajas.cell(r, 3).value)
        at_val = normalize_area_str(ws_cajas.cell(r, 2).value)
        if a_val and a_val not in cajas_area_rows:
            cajas_area_rows[a_val] = r
        if at_val and at_val not in cajas_area_rows:
            cajas_area_rows[at_val] = r

    COL_CO_CAJAS = 93 # MATERIAL RECIBIDO (UNIDADES)
    COL_CJ_CAJAS = 88 # TOTAL COLOCADAS
    COL_CL_CAJAS = 90 # ATENDIDAS

    # Rellenar Materiales Cajas (Col CO: 93)
    for area_norm, qty in caja_materials.items():
        row_idx = cajas_area_rows.get(area_norm)
        if not row_idx:
            for k, r in cajas_area_rows.items():
                if area_norm in k or k in area_norm:
                    row_idx = r
                    break
        if row_idx:
            ws_cajas.cell(row_idx, COL_CO_CAJAS).value = qty
            print(f"  [Cajas Material] {area_norm} -> Fila {row_idx}, Col CO={qty}")
        else:
            print(f"  [Aviso] Área de cajas no encontrada en plantilla: {area_norm}")

    # Rellenar Trabajos Cajas en fechas
    for area_norm, dates in caja_works.items():
        row_idx = cajas_area_rows.get(area_norm)
        if not row_idx:
            for k, r in cajas_area_rows.items():
                if area_norm in k or k in area_norm:
                    row_idx = r
                    break
        if row_idx:
            total_area_cajas = 0
            for f_str, count in dates.items():
                total_area_cajas += count
                col_idx = cajas_date_cols.get(f_str)
                if col_idx:
                    ws_cajas.cell(row_idx, col_idx).value = count
                    print(f"  [Cajas Avance] {area_norm} ({f_str}) -> Fila {row_idx}, Col {openpyxl.utils.get_column_letter(col_idx)}={count}")
                else:
                    print(f"  [Aviso] Fecha sin columna en cajas: {f_str}")
            # Total colocadas
            ws_cajas.cell(row_idx, COL_CJ_CAJAS).value = total_area_cajas
            ws_cajas.cell(row_idx, COL_CL_CAJAS).value = total_area_cajas

    # Normalizar bordes eliminando recuadros manuales gruesos (fila 28 TOLUCA)
    for r in [27, 28, 29]:
        for c in range(1, ws_cajas.max_column + 1):
            ws_cajas.cell(r, c).border = copy(ws_cajas.cell(26, c).border)
    print("  [Bordes] Normalizados bordes de filas 27-29 en Cajas.")

    # Normalizar fuentes en área de materiales y resumen (quitar negrita)
    for r in range(14, 77):
        for c in range(88, 96):
            cell = ws_cajas.cell(r, c)
            if cell.font and cell.font.bold:
                cell.font = openpyxl.styles.Font(
                    name=cell.font.name or "Calibri",
                    size=cell.font.size or 11,
                    bold=False,
                    color=cell.font.color
                )
    print("  [Fuentes] Normalizadas fuentes (sin negrita) en área de materiales de Cajas.")

    # Vaciar completamente la fila 78 en Cajas (quitar MORELOS y cualquier formato)
    for c in range(1, ws_cajas.max_column + 1):
        cell = ws_cajas.cell(78, c)
        cell.value = None
        cell.border = openpyxl.styles.Border()
        cell.fill = openpyxl.styles.PatternFill(fill_type=None)
        cell.font = openpyxl.styles.Font()
    print("  [Fila 78] Fila 78 en Cajas vaciada al 100%.")

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
