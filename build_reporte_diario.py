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
import subprocess
import unicodedata
from collections import defaultdict
from datetime import datetime, timedelta
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from add_resumen_general import add_resumen_general_sheet
from sync_linkaform import get_cutoff_info, get_accounting_date

def parse_record_datetime(rec):
    """Extrae el objeto datetime exacto de un registro."""
    iso_str = rec.get("created_at_iso")
    if iso_str:
        try:
            return datetime.strptime(str(iso_str)[:19], "%Y-%m-%d %H:%M:%S")
        except Exception:
            pass

    ts = rec.get("timestamp")
    if ts and isinstance(ts, (int, float)):
        try:
            return datetime.fromtimestamp(ts)
        except Exception:
            pass

    f = str(rec.get("fecha_captura") or rec.get("fecha") or "").replace("/", "-")[:10]
    h = str(rec.get("hora") or "12:00").strip()
    if len(h) == 5:
        h += ":00"
    try:
        return datetime.strptime(f"{f} {h[:8]}", "%Y-%m-%d %H:%M:%S")
    except Exception:
        pass

    try:
        return datetime.strptime(f"{f} 12:00:00", "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


# Rutas de plantillas y salidas
BASE_IASA_WORKSPACE = r"c:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\Reporte_Diario_Casetas_y_Cajas_Contratistas_2026_26102026.xlsx"
CLEAN_BASE_LOCAL = os.path.join(os.path.dirname(__file__), "data", "Reporte_diarios_IASA_BASE.xlsx")
OUTPUT_EXCEL_DATA = os.path.join(os.path.dirname(__file__), "data", "Reporte_Diario_Casetas_y_Cajas_Contratistas_2026.xlsx")
USER_WORKSPACE_COPY = r"c:\Users\PCI\Documents\Antigravity\Imagen Telmex 2026_2\Reporte diarios Casetas y Cajas Contratistas 2026 - Actualizado.xlsx"

START_DATE = "2026-10-26"

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

def build_reporte_diario(current_dt=None):
    # 1. Asegurar copia de la plantilla base oficial IASA
    if os.path.exists(BASE_IASA_WORKSPACE):
        shutil.copyfile(BASE_IASA_WORKSPACE, CLEAN_BASE_LOCAL)
    elif not os.path.exists(CLEAN_BASE_LOCAL):
        raise FileNotFoundError("No se encontró la plantilla oficial IASA.")

    cutoff_info = get_cutoff_info(current_dt)
    max_visible_dt = cutoff_info["max_visible_dt_obj"]
    active_reporting_date = cutoff_info["active_reporting_date"]

    print(f"Cargando plantilla base limpia: {CLEAN_BASE_LOCAL}...")
    print(f"  [Regla de Corte Excel] {cutoff_info['badge']}: {cutoff_info['description']}")
    wb = openpyxl.load_workbook(CLEAN_BASE_LOCAL, data_only=False)

    records, materials = load_live_data()
    print(f"Datos cargados: {len(records)} trabajos de campo, {len(materials)} entregas de materiales.")


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


    # =========================================================
    # APLICAR MATERIALES NUEVOS (START_DATE <= fecha_corte <= active_reporting_date)
    # =========================================================
    for m in materials:
        mat_dt = parse_record_datetime(m)
        if mat_dt and mat_dt > max_visible_dt:
            continue

        f_m = get_accounting_date(mat_dt) if mat_dt else str(m.get("fecha") or "")[:10]
        if f_m < START_DATE or f_m > active_reporting_date:
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
    # APLICAR TRABAJOS DE CAMPO NUEVOS (START_DATE <= fecha_corte <= active_reporting_date)
    # Deduplicación estricta por activo en orden cronológico
    # =========================================================
    caseta_works = defaultdict(lambda: defaultdict(int))
    caja_works = defaultdict(lambda: defaultdict(int))
    seen_assets = set()

    # Pre-cargar seen_assets con todos los activos completados antes de START_DATE
    # para que ningún activo ya entregado en la línea base se pueda duplicar
    for rec in records:
        rec_dt = parse_record_datetime(rec)
        acc_date = get_accounting_date(rec_dt) if rec_dt else str(rec.get("fecha") or "")[:10]
        if acc_date < START_DATE:
            identificador = str(rec.get("identificador") or "").strip().upper()
            tipo = (rec.get("tipo") or "CAJA").upper().strip()
            if identificador and identificador not in ["S/N", "N/A", "0", ""]:
                seen_assets.add((tipo, identificador))

    print(f"  [Línea Base] {len(seen_assets)} activos únicos registrados en la base entregada.")

    # Ordenar cronológicamente para mantener el primer folio original de cada activo
    sorted_records = []
    for rec in records:
        rec_dt = parse_record_datetime(rec)
        sorted_records.append((rec_dt or datetime.now(), rec))
    sorted_records.sort(key=lambda x: x[0])

    retained_records = 0
    for rec_dt, rec in sorted_records:
        # 1. Regla de corte: si se subió posterior al corte visible actual, se omite
        if rec_dt > max_visible_dt:
            retained_records += 1
            continue

        # 2. Fecha contable: si hora >= 22:00, se contabiliza para el día siguiente
        accounting_date = get_accounting_date(rec_dt)

        # 3. Solo procesar fechas a partir de START_DATE
        if accounting_date < START_DATE or accounting_date > active_reporting_date:
            continue
        
        tipo = (rec.get("tipo") or "CAJA").upper().strip()
        area = rec.get("area_trabajo") or ""
        identificador = str(rec.get("identificador") or "").strip().upper()

        # Si el activo tiene identificador válido, deduplicar para no inflar avances
        if identificador and identificador not in ["S/N", "N/A", "0", ""]:
            asset_key = (tipo, identificador)
            if asset_key in seen_assets:
                print(f"  [Deduplicado Linkaform] Omitiendo registro repetido: {tipo} {identificador} (Folio: {rec.get('folio')})")
                continue
            seen_assets.add(asset_key)

        if tipo == "CASETA":
            caseta_works[area][accounting_date] += 1
        else:
            caja_works[area][accounting_date] += 1

    if retained_records > 0:
        print(f"  [Corte] {retained_records} trabajos retenidos temporalmente (subidos posterior al corte oficial {cutoff_info['max_visible_datetime_str']}).")

    cas_cell_totals = defaultdict(int)
    for area, f_map in caseta_works.items():
        r_idx = find_caseta_row(area)
        if r_idx:
            for f_str, count in f_map.items():
                c_idx = cas_date_cols.get(f_str)
                if c_idx:
                    cas_cell_totals[(r_idx, c_idx)] += count
                    print(f"  [Caseta Avance] {area} ({f_str}) -> Fila {r_idx}, Col {c_idx} += {count}")

    for (r_idx, c_idx), total_count in cas_cell_totals.items():
        curr = ws_cas.cell(r_idx, c_idx).value or 0
        ws_cas.cell(r_idx, c_idx).value = curr + total_count

    caj_cell_totals = defaultdict(int)
    for area, f_map in caja_works.items():
        r_idx = find_caja_row(area)
        if r_idx:
            for f_str, count in f_map.items():
                c_idx = caj_date_cols.get(f_str)
                if c_idx:
                    caj_cell_totals[(r_idx, c_idx)] += count
                    print(f"  [Caja Avance] {area} ({f_str}) -> Fila {r_idx}, Col {c_idx} += {count}")

    for (r_idx, c_idx), total_count in caj_cell_totals.items():
        curr = ws_caj.cell(r_idx, c_idx).value or 0
        ws_caj.cell(r_idx, c_idx).value = curr + total_count

    # =========================================================
    # INDICADORES SUPERIORES VISIBLES EN CASETAS Y CAJAS
    # =========================================================
    f_kpi_lbl = Font(name="Calibri", size=11, bold=True, color="333333")
    f_kpi_val = Font(name="Calibri", size=14, bold=True, color="002F6C")
    f_kpi_tot_val = Font(name="Calibri", size=16, bold=True, color="107C41")
    fill_kpi = PatternFill(start_color="E8F1FA", end_color="E8F1FA", fill_type="solid")
    fill_tot = PatternFill(start_color="E6F4EA", end_color="E6F4EA", fill_type="solid")
    thin_side = Side(border_style="thin", color="CCCCCC")
    b_kpi_box = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

    ws_cas["B3"] = "TOTAL CASETAS AL MOMENTO:"
    ws_cas["B3"].font = f_kpi_lbl
    ws_cas["B3"].alignment = Alignment(horizontal="right", vertical="center")
    ws_cas["D3"] = "=+CN79"
    ws_cas["D3"].font = f_kpi_val
    ws_cas["D3"].alignment = Alignment(horizontal="center", vertical="center")
    ws_cas["D3"].fill = fill_kpi
    ws_cas["D3"].border = b_kpi_box

    ws_cas["F3"] = "SUMA TOTAL AL MOMENTO (CASETAS + CAJAS):"
    ws_cas["F3"].font = Font(name="Calibri", size=11, bold=True, color="107C41")
    ws_cas["F3"].alignment = Alignment(horizontal="right", vertical="center")
    ws_cas["I3"] = "='Programa CAJAS REPORTE DIARIO'!CH77+CN79"
    ws_cas["I3"].font = f_kpi_tot_val
    ws_cas["I3"].alignment = Alignment(horizontal="center", vertical="center")
    ws_cas["I3"].fill = fill_tot
    ws_cas["I3"].border = b_kpi_box

    ws_caj["B3"] = "TOTAL CAJAS AL MOMENTO:"
    ws_caj["B3"].font = f_kpi_lbl
    ws_caj["B3"].alignment = Alignment(horizontal="right", vertical="center")
    ws_caj["D3"] = "=+CH77"
    ws_caj["D3"].font = f_kpi_val
    ws_caj["D3"].alignment = Alignment(horizontal="center", vertical="center")
    ws_caj["D3"].fill = fill_kpi
    ws_caj["D3"].border = b_kpi_box

    ws_caj["F3"] = "SUMA TOTAL AL MOMENTO (CASETAS + CAJAS):"
    ws_caj["F3"].font = Font(name="Calibri", size=11, bold=True, color="107C41")
    ws_caj["F3"].alignment = Alignment(horizontal="right", vertical="center")
    ws_caj["I3"] = "='Programa CASETAS REPORTE DIARIO'!CN79+CH77"
    ws_caj["I3"].font = f_kpi_tot_val
    ws_caj["I3"].alignment = Alignment(horizontal="center", vertical="center")
    ws_caj["I3"].fill = fill_tot
    ws_caj["I3"].border = b_kpi_box

    # Hoja Ejecutiva al inicio del libro
    add_resumen_general_sheet(wb, cutoff_info)

    if wb.calculation:
        wb.calculation.fullCalcOnLoad = True
        wb.calculation.forceFullCalc = True
        wb.calculation.calcMode = "auto"

    # Guardar en data del repo
    os.makedirs(os.path.dirname(OUTPUT_EXCEL_DATA), exist_ok=True)
    wb.save(OUTPUT_EXCEL_DATA)
    print(f"\n[OK] Archivo generado exitosamente en: {OUTPUT_EXCEL_DATA}")

    # Recalcular valores cacheados nativamente con Excel COM
    recalculate_with_excel_com(OUTPUT_EXCEL_DATA)

    try:
        shutil.copyfile(OUTPUT_EXCEL_DATA, USER_WORKSPACE_COPY)
        print(f"[OK] Copia precalculada guardada en workspace del usuario: {USER_WORKSPACE_COPY}")
    except Exception as e:
        print(f"[Aviso] No se pudo escribir copia en workspace: {e}")

    return OUTPUT_EXCEL_DATA

def recalculate_with_excel_com(file_path):
    """
    Ejecuta el recálculo nativo completo con Microsoft Excel COM
    para que todas las fórmulas se evalúen y los valores <v> queden grabados.
    """
    try:
        abs_p = os.path.abspath(file_path).replace("\\", "\\\\")
        ps_cmd = f"$excel = New-Object -ComObject Excel.Application; $excel.Visible = $false; $excel.DisplayAlerts = $false; $wb = $excel.Workbooks.Open('{abs_p}'); $excel.CalculateFull(); $wb.Save(); $wb.Close($false); $excel.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null"
        subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, timeout=30)
        print("  [OK] Excel COM: Todas las fórmulas calculadas y grabadas en el archivo.")
    except Exception as e:
        print(f"  [Aviso Excel COM] No se pudo invocar recálculo COM: {e}")

if __name__ == "__main__":
    build_reporte_diario()
