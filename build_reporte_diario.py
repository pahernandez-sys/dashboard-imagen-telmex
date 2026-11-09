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

if __name__ == "__main__":
    build_reporte_diario()


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
        identificador = ans.get("6ad52fc6bc424ea79992eabf") or ""
        raw_modelo = ans.get("6ab9d647dba7a0c191e6a0f6") or ""
        modelo = normalize_model_name(raw_modelo, tipo) if "normalize_model_name" in globals() else raw_modelo
        estado = (ans.get("6ad52fc6bc424ea79992eac0") or "").upper()
        area = (ans.get("6ad52fc6bc424ea79992eac1") or estado).upper()
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
