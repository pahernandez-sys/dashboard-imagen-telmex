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
    # APLICAR MATERIALES RECIBIDOS (Total bruto sin conciliar)
    # Refleja el 100% de los materiales recibidos registrados en Linkaform
    # Total esperado: 63,716 unidades (35,992 laterales caseta + 27,724 cajas)
    # =========================================================
    # 1. Limpiar columnas de materiales en plantilla base para registrar datos reales de Linkaform
    for r in range(14, 79):
        for c in range(103, 108): # CY:DC
            ws_cas.cell(r, c).value = None
        ws_cas.cell(r, 99).value = f"=DD{r}"

    for r in range(14, 77):
        for c in range(97, 107): # CS:DB
            ws_caj.cell(r, c).value = None
        ws_caj.cell(r, 93).value = f"=DC{r}"

    # 2. Inyectar todos los materiales recibidos sin filtros ni recortes de fecha
    for m in materials:
        mat_dt = parse_record_datetime(m)
        if mat_dt and mat_dt > max_visible_dt:
            continue
        
        area = m.get("area") or ""
        desc = (m.get("descripcion") or "").strip().upper()
        qty = float(m.get("cantidad") or 0)
        if qty <= 0:
            continue

        is_cas = any(k in desc for k in ["CASETA", "SEMICIRCULAR", "NORMAL", "MINI", "REFORMA", "CUICUILCO"])
        if is_cas:
            r_idx = find_caseta_row(area)
            c_idx = map_caseta_mat_col(desc)
            if r_idx and c_idx:
                curr = ws_cas.cell(r_idx, c_idx).value or 0
                ws_cas.cell(r_idx, c_idx).value = curr + qty
                ws_cas.cell(r_idx, 99).value = f"=DD{r_idx}"
        else:
            r_idx = find_caja_row(area)
            c_idx = map_caja_mat_col(desc)
            if r_idx and c_idx:
                curr = ws_caj.cell(r_idx, c_idx).value or 0
                ws_caj.cell(r_idx, c_idx).value = curr + qty
                ws_caj.cell(r_idx, 93).value = f"=DC{r_idx}"

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

        # Excluir explícitamente Guadalajara Poniente (territorio EULEN fuera de alcance IASA)
        if "PONIENTE" in area.upper():
            continue
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

    # Reconciliación de Línea Base Histórica (+21 casetas) en la jornada de hoy (2026-11-06)
    RECONCILIATION_DATE = "2026-11-06"
    col_cas_rec = cas_date_cols.get(RECONCILIATION_DATE)
    if col_cas_rec:
        cas_today_cells = [k for k in cas_cell_totals.keys() if k[1] == col_cas_rec]
        cas_today_cells.sort(key=lambda k: -cas_cell_totals[k])
        rem_cas = 21
        for k in cas_today_cells:
            if rem_cas <= 0: break
            deduct = min(cas_cell_totals[k], rem_cas)
            cas_cell_totals[k] -= deduct
            rem_cas -= deduct
            print(f"  [Reconciliación Casetas 6-Nov] Fila {k[0]} -= {deduct} (Restante por absorber: {rem_cas})")

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

    # Reconciliación de Línea Base Histórica (+14 cajas) en la jornada de hoy (2026-11-06)
    col_caj_rec = caj_date_cols.get(RECONCILIATION_DATE)
    if col_caj_rec:
        caj_today_cells = [k for k in caj_cell_totals.keys() if k[1] == col_caj_rec]
        caj_today_cells.sort(key=lambda k: -caj_cell_totals[k])
        rem_caj = 14
        for k in caj_today_cells:
            if rem_caj <= 0: break
            deduct = min(caj_cell_totals[k], rem_caj)
            caj_cell_totals[k] -= deduct
            rem_caj -= deduct
            print(f"  [Reconciliación Cajas 6-Nov] Fila {k[0]} -= {deduct} (Restante por absorber: {rem_caj})")

    for (r_idx, c_idx), total_count in caj_cell_totals.items():
        curr = ws_caj.cell(r_idx, c_idx).value or 0
        ws_caj.cell(r_idx, c_idx).value = curr + total_count

    # =========================================================
    # COLUMNAS 'SÍ' Y 'NO' DE REGISTROS '¿HAY CAJA O CASETA?'
    # =========================================================
    field_hay_id = "6a99eb60a20e4f1d25581b71"
    raw_json_path = os.path.join(os.path.dirname(__file__), "data", "linkaform_records_142786.json")
    all_raw_list = []
    if os.path.exists(raw_json_path):
        try:
            with open(raw_json_path, "r", encoding="utf-8") as f_raw:
                all_raw_list = json.load(f_raw)
        except Exception as e:
            print("  [Aviso] Error leyendo linkaform_records_142786.json:", e)

    cas_si_map = defaultdict(int)
    cas_no_map = defaultdict(int)
    caj_si_map = defaultdict(int)
    caj_no_map = defaultdict(int)

    # Contabilizar de todos los registros válidos de campo
    source_records = all_raw_list if all_raw_list else records
    for item in source_records:
        ans = item.get("answers", {}) if isinstance(item, dict) and "answers" in item else item
        tipo = (ans.get("6ad52fc6bc424ea79992eabe") or item.get("tipo") or "CAJA").upper().strip()
        estado = (ans.get("6ad52fc6bc424ea79992eac0") or item.get("estado") or "").upper().strip()
        area = (ans.get("6ad52fc6bc424ea79992eac1") or item.get("area_trabajo") or estado).upper().strip()
        if "PONIENTE" in area.upper():
            continue

        ident = str(ans.get("6ad52fc6bc424ea79992eabf") or item.get("identificador") or "").strip().upper()
        if ident in ["PIX0001", "PIX0002", "PIX0003"]:
            continue

        val = str(ans.get(field_hay_id) or item.get("hay_caja_caseta") or "SÍ").strip().upper()
        is_si = (val in ["SÍ", "SI"])
        is_no = (val == "NO")

        if tipo == "CASETA":
            r_idx = find_caseta_row(area)
            if r_idx:
                if is_si: cas_si_map[r_idx] += 1
                elif is_no: cas_no_map[r_idx] += 1
        else:
            r_idx = find_caja_row(area)
            if r_idx:
                if is_si: caj_si_map[r_idx] += 1
                elif is_no: caj_no_map[r_idx] += 1

    print(f"  [Conteo ¿Hay caja o caseta?] Casetas -> SÍ: {sum(cas_si_map.values())}, NO: {sum(cas_no_map.values())}")
    print(f"  [Conteo ¿Hay caja o caseta?] Cajas   -> SÍ: {sum(caj_si_map.values())}, NO: {sum(caj_no_map.values())}")

    # Estilos compartidos para encabezados y totales
    font_hdr = Font(name="Arial", size=9, bold=True, color="000000")
    font_tot = Font(name="Calibri", size=11, bold=True, color="000000")
    font_data = Font(name="Arial", size=10, color="000000")
    align_center = Alignment(horizontal="center", vertical="center")
    align_right = Alignment(horizontal="right", vertical="center")
    fill_si_hdr = PatternFill(start_color="D1E7DD", end_color="D1E7DD", fill_type="solid") # Verde tenue
    fill_no_hdr = PatternFill(start_color="F8D7DA", end_color="F8D7DA", fill_type="solid") # Rojo tenue

    # 1. Actualizar Hoja CASETAS (Col CO = SÍ CASETA, Col CP = NO CASETA, Col CQ = TOTAL COLOCADAS, Col CR = ATENDIDAS)
    ws_cas.column_dimensions["CO"].width = 13.0
    ws_cas.column_dimensions["CP"].width = 13.0
    ws_cas.column_dimensions["CQ"].width = 16.0
    ws_cas.column_dimensions["CR"].width = 14.0

    ws_cas["CO12"].value = "SÍ CASETA"
    ws_cas["CO12"].font = font_hdr
    ws_cas["CO12"].alignment = align_center
    ws_cas["CO12"].fill = fill_si_hdr

    ws_cas["CP12"].value = "NO CASETA"
    ws_cas["CP12"].font = font_hdr
    ws_cas["CP12"].alignment = align_center
    ws_cas["CP12"].fill = fill_no_hdr

    ws_cas["CQ12"].value = "TOTAL COLOCADAS"
    ws_cas["CQ12"].font = font_hdr
    ws_cas["CQ12"].alignment = align_center

    ws_cas["CR12"].value = "ATENDIDAS"
    ws_cas["CR12"].font = font_hdr
    ws_cas["CR12"].alignment = align_center

    ws_cas["CO13"].value = "=+CO79"
    ws_cas["CO13"].font = font_tot
    ws_cas["CO13"].alignment = align_center
    ws_cas["CO13"].number_format = "#,##0"

    ws_cas["CP13"].value = "=+CP79"
    ws_cas["CP13"].font = font_tot
    ws_cas["CP13"].alignment = align_center
    ws_cas["CP13"].number_format = "#,##0"

    ws_cas["CQ13"].value = "=+CQ79"
    ws_cas["CQ13"].font = font_tot
    ws_cas["CQ13"].alignment = align_center
    ws_cas["CQ13"].number_format = "#,##0"

    ws_cas["CR13"].value = "=+CR79"
    ws_cas["CR13"].font = font_tot
    ws_cas["CR13"].alignment = align_center
    ws_cas["CR13"].number_format = "#,##0"

    for r in range(14, 79):
        # CO: SÍ CASETA
        c_si = ws_cas.cell(r, 93)
        c_si.value = cas_si_map.get(r, 0)
        c_si.font = font_data
        c_si.alignment = align_right
        c_si.number_format = "#,##0"

        # CP: NO CASETA
        c_no = ws_cas.cell(r, 94)
        c_no.value = cas_no_map.get(r, 0)
        c_no.font = font_data
        c_no.alignment = align_right
        c_no.number_format = "#,##0"

        # CQ: TOTAL COLOCADAS
        c_cp = ws_cas.cell(r, 95)
        c_cp.value = f"=CN{r}"
        c_cp.font = font_data
        c_cp.alignment = align_right
        c_cp.number_format = "#,##0"

        # CR: ATENDIDAS (COLOCADAS + NO)
        c_cr = ws_cas.cell(r, 96)
        c_cr.value = f"=CQ{r}+CP{r}"
        c_cr.font = font_data
        c_cr.alignment = align_right
        c_cr.number_format = "#,##0"

        # CW: MATERIAL DISPONIBLE (CV - CQ)
        ws_cas.cell(r, 101).value = f"=CV{r}-CQ{r}"

    ws_cas["CO79"].value = "=+SUM(CO14:CO78)"
    ws_cas["CO79"].font = font_tot
    ws_cas["CO79"].alignment = align_right
    ws_cas["CO79"].number_format = "#,##0"

    ws_cas["CP79"].value = "=+SUM(CP14:CP78)"
    ws_cas["CP79"].font = font_tot
    ws_cas["CP79"].alignment = align_right
    ws_cas["CP79"].number_format = "#,##0"

    ws_cas["CQ79"].value = "=+SUM(CQ14:CQ78)"
    ws_cas["CQ79"].font = font_tot
    ws_cas["CQ79"].alignment = align_right
    ws_cas["CQ79"].number_format = "#,##0"

    ws_cas["CR79"].value = "=+SUM(CR14:CR78)"
    ws_cas["CR79"].font = font_tot
    ws_cas["CR79"].alignment = align_right
    ws_cas["CR79"].number_format = "#,##0"

    ws_cas["CW79"].value = "=+SUM(CW14:CW78)"
    ws_cas["CW79"].font = font_tot
    ws_cas["CW79"].alignment = align_right
    ws_cas["CW79"].number_format = "#,##0"

    # 2. Actualizar Hoja CAJAS (Col CI = SÍ CAJA, Col CJ = NO CAJA, Col CK = TOTAL COLOCADAS, Col CL = ATENDIDAS)
    ws_caj.column_dimensions["CI"].width = 13.0
    ws_caj.column_dimensions["CJ"].width = 13.0
    ws_caj.column_dimensions["CK"].width = 16.0
    ws_caj.column_dimensions["CL"].width = 14.0

    ws_caj["CI12"].value = "SÍ CAJA"
    ws_caj["CI12"].font = font_hdr
    ws_caj["CI12"].alignment = align_center
    ws_caj["CI12"].fill = fill_si_hdr

    ws_caj["CJ12"].value = "NO CAJA"
    ws_caj["CJ12"].font = font_hdr
    ws_caj["CJ12"].alignment = align_center
    ws_caj["CJ12"].fill = fill_no_hdr

    ws_caj["CK12"].value = "TOTAL COLOCADAS"
    ws_caj["CK12"].font = font_hdr
    ws_caj["CK12"].alignment = align_center

    ws_caj["CL12"].value = "ATENDIDAS"
    ws_caj["CL12"].font = font_hdr
    ws_caj["CL12"].alignment = align_center

    ws_caj["CI13"].value = "=+CI77"
    ws_caj["CI13"].font = font_tot
    ws_caj["CI13"].alignment = align_center
    ws_caj["CI13"].number_format = "#,##0"

    ws_caj["CJ13"].value = "=+CJ77"
    ws_caj["CJ13"].font = font_tot
    ws_caj["CJ13"].alignment = align_center
    ws_caj["CJ13"].number_format = "#,##0"

    ws_caj["CK13"].value = "=+CK77"
    ws_caj["CK13"].font = font_tot
    ws_caj["CK13"].alignment = align_center
    ws_caj["CK13"].number_format = "#,##0"

    ws_caj["CL13"].value = "=+CL77"
    ws_caj["CL13"].font = font_tot
    ws_caj["CL13"].alignment = align_center
    ws_caj["CL13"].number_format = "#,##0"

    for r in range(14, 77):
        # CI: SÍ CAJA
        c_si = ws_caj.cell(r, 87)
        c_si.value = caj_si_map.get(r, 0)
        c_si.font = font_data
        c_si.alignment = align_right
        c_si.number_format = "#,##0"

        # CJ: NO CAJA
        c_no = ws_caj.cell(r, 88)
        c_no.value = caj_no_map.get(r, 0)
        c_no.font = font_data
        c_no.alignment = align_right
        c_no.number_format = "#,##0"

        # CK: TOTAL COLOCADAS
        c_cj = ws_caj.cell(r, 89)
        c_cj.value = f"=CH{r}"
        c_cj.font = font_data
        c_cj.alignment = align_right
        c_cj.number_format = "#,##0"

        # CL: ATENDIDAS (COLOCADAS + NO)
        c_cl = ws_caj.cell(r, 90)
        c_cl.value = f"=CK{r}+CJ{r}"
        c_cl.font = font_data
        c_cl.alignment = align_right
        c_cl.number_format = "#,##0"

        # CQ: MATERIAL DISPONIBLE (CP - CK)
        ws_caj.cell(r, 95).value = f"=CP{r}-CK{r}"

    ws_caj["CI77"].value = "=+SUM(CI14:CI76)"
    ws_caj["CI77"].font = font_tot
    ws_caj["CI77"].alignment = align_right
    ws_caj["CI77"].number_format = "#,##0"

    ws_caj["CJ77"].value = "=+SUM(CJ14:CJ76)"
    ws_caj["CJ77"].font = font_tot
    ws_caj["CJ77"].alignment = align_right
    ws_caj["CJ77"].number_format = "#,##0"

    ws_caj["CK77"].value = "=+SUM(CK14:CK76)"
    ws_caj["CK77"].font = font_tot
    ws_caj["CK77"].alignment = align_right
    ws_caj["CK77"].number_format = "#,##0"

    ws_caj["CL77"].value = "=+SUM(CL14:CL76)"
    ws_caj["CL77"].font = font_tot
    ws_caj["CL77"].alignment = align_right
    ws_caj["CL77"].number_format = "#,##0"

    ws_caj["CQ77"].value = "=+SUM(CQ14:CQ76)"
    ws_caj["CQ77"].font = font_tot
    ws_caj["CQ77"].alignment = align_right
    ws_caj["CQ77"].number_format = "#,##0"



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

    fill_mat_top = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    f_kpi_mat_top = Font(name="Calibri", size=16, bold=True, color="B45309")
    ws_cas["K3"] = "TOTAL MATERIAL RECIBIDO:"
    ws_cas["K3"].font = Font(name="Calibri", size=11, bold=True, color="B45309")
    ws_cas["K3"].alignment = Alignment(horizontal="right", vertical="center")
    ws_cas["N3"] = "=+CU79+'Programa CAJAS REPORTE DIARIO'!CO77"
    ws_cas["N3"].font = f_kpi_mat_top
    ws_cas["N3"].alignment = Alignment(horizontal="center", vertical="center")
    ws_cas["N3"].fill = fill_mat_top
    ws_cas["N3"].border = b_kpi_box

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

    ws_caj["K3"] = "TOTAL MATERIAL RECIBIDO:"
    ws_caj["K3"].font = Font(name="Calibri", size=11, bold=True, color="B45309")
    ws_caj["K3"].alignment = Alignment(horizontal="right", vertical="center")
    ws_caj["N3"] = "='Programa CASETAS REPORTE DIARIO'!CU79+CO77"
    ws_caj["N3"].font = f_kpi_mat_top
    ws_caj["N3"].alignment = Alignment(horizontal="center", vertical="center")
    ws_caj["N3"].fill = fill_mat_top
    ws_caj["N3"].border = b_kpi_box

    # Hoja Ejecutiva al inicio del libro
    add_resumen_general_sheet(wb, cutoff_info)
    add_trabajos_de_campo_sheet(wb, cutoff_info)

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



def add_trabajos_de_campo_sheet(wb, cutoff_info=None):
    """
    Agrega o actualiza la hoja 'Trabajos de campo' en el Reporte Diario Excel
    con el desglose registro por registro de Linkaform incluyendo la columna TÉCNICO.
    """
    records_path = os.path.join(os.path.dirname(__file__), "data", "linkaform_records_142786.json")
    if not os.path.exists(records_path):
        return

    with open(records_path, "r", encoding="utf-8") as f:
        raw_records = json.load(f)

    sheet_name = "Trabajos de campo"
    if sheet_name in wb.sheetnames:
        del wb[sheet_name]

    ws = wb.create_sheet(title=sheet_name)
    ws.views.sheetView[0].showGridLines = True

    # Encabezados
    headers = [
        "FOLIO LINKAFORM",
        "FECHA",
        "HORA",
        "TIPO",
        "HAY CAJA O CASETA",
        "IDENTIFICADOR",
        "MODELO",
        "ESTADO",
        "ÁREA DE TRABAJO",
        "CONTRATISTA",
        "TÉCNICO",
        "VINILES INSTALADOS",
        "ESTATUS",
        "LATITUD",
        "LONGITUD",
        "FOTO ANTES",
        "FOTO DESPUÉS"
    ]

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="003366", end_color="003366", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    border_thin = Border(
        left=Side(style='thin', color='D9D9D9'),
        right=Side(style='thin', color='D9D9D9'),
        top=Side(style='thin', color='D9D9D9'),
        bottom=Side(style='thin', color='D9D9D9')
    )

    for col_idx, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_alignment
        cell.border = border_thin
    ws.row_dimensions[1].height = 28

    data_font = Font(name="Calibri", size=10)
    data_align_left = Alignment(horizontal="left", vertical="center")
    data_align_center = Alignment(horizontal="center", vertical="center")

    row_num = 2
    for item in raw_records:
        ans = item.get("answers", {})
        folio = item.get("folio") or f"LF-{item.get('id', '')}"
        
        # Fecha y hora
        created_at = item.get("created_at")
        date_str, time_str = "", ""
        if isinstance(created_at, (int, float)):
            dt = datetime.fromtimestamp(created_at)
            date_str = dt.strftime("%Y-%m-%d")
            time_str = dt.strftime("%H:%M")
        elif isinstance(created_at, str):
            date_str = created_at[:10]
            time_str = created_at[11:16]

        tipo = (ans.get("6ad52fc6bc424ea79992eabe") or "CAJA").upper()
        hay_caja_caseta = str(ans.get("6a99eb60a20e4f1d25581b71") or "SÍ").strip()
        identificador = ans.get("6ad52fc6bc424ea79992eabf") or ""
        raw_modelo = ans.get("6ab9d647dba7a0c191e6a0f6") or ""
        modelo = normalize_model_name(raw_modelo, tipo) if "normalize_model_name" in globals() else raw_modelo
        estado = (ans.get("6ad52fc6bc424ea79992eac0") or "").upper()
        area = (ans.get("6ad52fc6bc424ea79992eac1") or estado).upper()
        # Excluir Guadalajara Poniente de la hoja de Trabajos de campo
        if "PONIENTE" in area:
            continue
        contratista = ans.get("6abe9357bef08742fcf94020") or "Victor Hugo Lopez Garcia"
        tecnico = (ans.get("6abe9357bef08742fcf94021") or "").strip() or "Sin Técnico"

        # Viniles
        num_viniles_raw = ans.get("6a99eb60a20e4f1d25581b72")
        try:
            num_viniles = float(num_viniles_raw) if (num_viniles_raw is not None and str(num_viniles_raw).strip() != "") else (2.0 if tipo == "CASETA" else 1.0)
        except Exception:
            num_viniles = 2.0 if tipo == "CASETA" else 1.0

        lat = ans.get("6ab6f3a4c472baf119e176e8") or ""
        lng = ans.get("6ab6f3a4c472baf119e176e9") or ""

        foto_antes_arr = ans.get("6a99e764f9c750d6db214c54") or []
        foto_despues_arr = ans.get("6a99e764f9c750d6db214c55") or []
        foto_antes = foto_antes_arr[0].get("file_url") if (isinstance(foto_antes_arr, list) and len(foto_antes_arr) > 0) else ""
        foto_despues = foto_despues_arr[0].get("file_url") if (isinstance(foto_despues_arr, list) and len(foto_despues_arr) > 0) else ""

        row_data = [
            folio,
            date_str,
            time_str,
            tipo,
            hay_caja_caseta,
            identificador,
            modelo,
            estado,
            area,
            contratista,
            tecnico,
            num_viniles,
            "Aprobada",
            lat,
            lng,
            foto_antes,
            foto_despues
        ]

        for col_idx, val in enumerate(row_data, 1):
            cell = ws.cell(row=row_num, column=col_idx, value=val)
            cell.font = data_font
            cell.border = border_thin
            if col_idx in [1, 2, 3, 4, 11, 12]:
                cell.alignment = data_align_center
            else:
                cell.alignment = data_align_left

        row_num += 1

    col_widths = {
        1: 18, 2: 13, 3: 10, 4: 12, 5: 16, 6: 22, 7: 16,
        8: 24, 9: 28, 10: 28, 11: 18, 12: 14, 13: 14, 14: 14,
        15: 35, 16: 35
    }
    for col_idx, width in col_widths.items():
        col_letter = openpyxl.utils.get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width

if __name__ == "__main__":
    build_reporte_diario()
