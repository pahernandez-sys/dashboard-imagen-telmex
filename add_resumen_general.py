import openpyxl
from datetime import datetime
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def add_resumen_general_sheet(wb, cutoff_info):
    sheet_name = "RESUMEN GENERAL"
    if sheet_name in wb.sheetnames:
        del wb[sheet_name]
    
    ws = wb.create_sheet(title=sheet_name, index=0)
    ws.views.sheetView[0].showGridLines = True

    # Paleta de Colores Telmex Oficial
    c_blue_dark = "002F6C"   # Telmex azul principal
    c_blue_light = "E8F1FA"  # Azul fondo suave
    c_blue_accent = "0072CE" # Azul brillante
    c_gray_bg = "F4F6F9"
    c_white = "FFFFFF"
    c_green = "107C41"       # Verde Excel / completado

    # Fuentes
    f_title = Font(name="Calibri", size=16, bold=True, color=c_white)
    f_subtitle = Font(name="Calibri", size=10, italic=True, color="D0E1F9")
    f_kpi_title = Font(name="Calibri", size=10, bold=True, color="555555")
    f_kpi_val = Font(name="Calibri", size=22, bold=True, color=c_blue_dark)
    f_kpi_val_green = Font(name="Calibri", size=24, bold=True, color=c_green)
    f_kpi_sub = Font(name="Calibri", size=9, color="777777")
    f_tbl_header = Font(name="Calibri", size=11, bold=True, color=c_white)
    f_tbl_row = Font(name="Calibri", size=11, color="111111")
    f_tbl_total = Font(name="Calibri", size=12, bold=True, color=c_blue_dark)

    # Fills
    fill_header = PatternFill(start_color=c_blue_dark, end_color=c_blue_dark, fill_type="solid")
    fill_kpi_bg = PatternFill(start_color=c_blue_light, end_color=c_blue_light, fill_type="solid")
    fill_kpi_tot = PatternFill(start_color="E6F4EA", end_color="E6F4EA", fill_type="solid") # Verde suave
    fill_tbl_h = PatternFill(start_color=c_blue_accent, end_color=c_blue_accent, fill_type="solid")
    fill_row_alt = PatternFill(start_color=c_gray_bg, end_color=c_gray_bg, fill_type="solid")
    fill_total_row = PatternFill(start_color="D9E8F5", end_color="D9E8F5", fill_type="solid")

    # Bordes
    thin = Side(border_style="thin", color="CCCCCC")
    thick_b = Side(border_style="medium", color=c_blue_dark)
    b_all_thin = Border(left=thin, right=thin, top=thin, bottom=thin)
    b_kpi = Border(left=thin, right=thin, top=thin, bottom=thin)
    b_total = Border(top=thin, bottom=thick_b)

    # Alignments
    al_center = Alignment(horizontal="center", vertical="center")
    al_left = Alignment(horizontal="left", vertical="center")
    al_right = Alignment(horizontal="right", vertical="center")

    # 1. TÍTULO Y ENCABEZADO
    ws.merge_cells("B2:J2")
    ws["B2"] = "REPORTE DIARIO DE CASETAS Y CAJAS CONTRATISTAS 2026 - IASA / TELMEX"
    ws["B2"].font = f_title
    ws["B2"].fill = fill_header
    ws["B2"].alignment = al_center

    ws.merge_cells("B3:J3")
    desc_corte = cutoff_info.get("description", "Regla de corte 10:00 PM")
    ws["B3"] = f"RESUMEN EJECUTIVO CONSOLIDADO AL MOMENTO • {desc_corte}"
    ws["B3"].font = f_subtitle
    ws["B3"].fill = fill_header
    ws["B3"].alignment = al_center

    ws.row_dimensions[2].height = 28
    ws.row_dimensions[3].height = 20

    # 2. TARJETAS KPI (Filas 5 a 7)
    # KPI 1: Casetas
    ws.merge_cells("B5:C5")
    ws["B5"] = "TOTAL CASETAS AL MOMENTO"
    ws["B5"].font = f_kpi_title
    ws["B5"].alignment = al_center

    ws.merge_cells("B6:C6")
    ws["B6"] = "='Programa CASETAS REPORTE DIARIO'!CN79"
    ws["B6"].font = f_kpi_val
    ws["B6"].alignment = al_center

    ws.merge_cells("B7:C7")
    ws["B7"] = "Casetas Instaladas Validadas"
    ws["B7"].font = f_kpi_sub
    ws["B7"].alignment = al_center

    # KPI 2: Cajas
    ws.merge_cells("E5:F5")
    ws["E5"] = "TOTAL CAJAS AL MOMENTO"
    ws["E5"].font = f_kpi_title
    ws["E5"].alignment = al_center

    ws.merge_cells("E6:F6")
    ws["E6"] = "='Programa CAJAS REPORTE DIARIO'!CH77"
    ws["E6"].font = f_kpi_val
    ws["E6"].alignment = al_center

    ws.merge_cells("E7:F7")
    ws["E7"] = "Cajas Instaladas Validadas"
    ws["E7"].font = f_kpi_sub
    ws["E7"].alignment = al_center

    # KPI 3: SUMA TOTAL (Cajas + Casetas)
    ws.merge_cells("H5:J5")
    ws["H5"] = "SUMA TOTAL AL MOMENTO (CASETAS + CAJAS)"
    ws["H5"].font = Font(name="Calibri", size=11, bold=True, color=c_green)
    ws["H5"].alignment = al_center

    ws.merge_cells("H6:J6")
    ws["H6"] = "=B6+E6"
    ws["H6"].font = f_kpi_val_green
    ws["H6"].alignment = al_center

    ws.merge_cells("H7:J7")
    ws["H7"] = "Gran Total Acumulado al Momento"
    ws["H7"].font = f_kpi_sub
    ws["H7"].alignment = al_center

    # Aplicar fondos y bordes a KPIs
    for r in range(5, 8):
        for c in [2, 3]:
            ws.cell(r, c).fill = fill_kpi_bg
            ws.cell(r, c).border = b_kpi
        for c in [5, 6]:
            ws.cell(r, c).fill = fill_kpi_bg
            ws.cell(r, c).border = b_kpi
        for c in [8, 9, 10]:
            ws.cell(r, c).fill = fill_kpi_tot
            ws.cell(r, c).border = b_kpi

    ws.row_dimensions[5].height = 18
    ws.row_dimensions[6].height = 32
    ws.row_dimensions[7].height = 16

    # 3. TABLA DE AVANCE DIARIO CONSOLIDADO
    # Título de Sección
    ws.merge_cells("B9:J9")
    ws["B9"] = "DESGLOSE DE AVANCE DIARIO CONSOLIDADO (TELMEX)"
    ws["B9"].font = Font(name="Calibri", size=12, bold=True, color=c_blue_dark)
    ws["B9"].alignment = al_left

    headers = [
        ("B", "FECHA"),
        ("C", "DÍA SEMANA"),
        ("D", "CASETAS"),
        ("E", "CAJAS"),
        ("F", "TOTAL DÍA (CASETAS + CAJAS)"),
        ("G", "ACUMULADO AL MOMENTO"),
        ("H", "ESTADO CORTE")
    ]

    ws.row_dimensions[10].height = 24
    for col_letter, title in headers:
        cell = ws[f"{col_letter}10"]
        cell.value = title
        cell.font = f_tbl_header
        cell.fill = fill_tbl_h
        cell.alignment = al_center
        cell.border = b_all_thin

    # Detectar dinámicamente las columnas de fechas disponibles en ambas hojas
    ws_cas = wb["Programa CASETAS REPORTE DIARIO"]
    ws_caj = wb["Programa CAJAS REPORTE DIARIO"]

    cas_cols = {}
    for c in range(23, 92):
        v = ws_cas.cell(12, c).value
        d = str(v)[:10] if v else ""
        if "2026" in d:
            cas_cols[d] = get_column_letter(c)

    caj_cols = {}
    for c in range(29, 86):
        v = ws_caj.cell(12, c).value
        d = str(v)[:10] if v else ""
        if "2026" in d:
            caj_cols[d] = get_column_letter(c)

    active_date = cutoff_info.get("active_reporting_date", datetime.now().strftime("%Y-%m-%d"))
    is_frozen = cutoff_info.get("is_frozen", False)

    all_dates = sorted(set(cas_cols.keys()) & set(caj_cols.keys()))
    # Filtrar fechas desde el inicio de campaña (2026-10-17) hasta la fecha activa de reporte
    all_dates = [d for d in all_dates if "2026-10-17" <= d <= active_date]

    days_es = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    daily_rows = []
    for d in all_dates:
        dt = datetime.strptime(d, "%Y-%m-%d")
        dia_sem = days_es[dt.weekday()]
        f_cas = f"'Programa CASETAS REPORTE DIARIO'!{cas_cols[d]}79"
        f_caj = f"'Programa CAJAS REPORTE DIARIO'!{caj_cols[d]}77"
        if d < "2026-10-26":
            st = "Línea Base Entregada"
        elif d < active_date:
            st = "Corte Oficial Cerrado"
        else:
            st = "Corte Oficial Cerrado" if is_frozen else "Jornada en Vivo"
        daily_rows.append((d, dia_sem, f_cas, f_caj, st))

    curr_row = 11
    for f_str, dia_sem, f_cas, f_caj, status in daily_rows:
        ws.row_dimensions[curr_row].height = 20
        fill_curr = fill_row_alt if curr_row % 2 == 0 else PatternFill(fill_type=None)

        ws[f"B{curr_row}"] = f_str
        ws[f"B{curr_row}"].alignment = al_center
        ws[f"C{curr_row}"] = dia_sem
        ws[f"C{curr_row}"].alignment = al_center
        
        ws[f"D{curr_row}"] = f"={f_cas}"
        ws[f"D{curr_row}"].alignment = al_right
        ws[f"D{curr_row}"].number_format = "#,##0"

        ws[f"E{curr_row}"] = f"={f_caj}"
        ws[f"E{curr_row}"].alignment = al_right
        ws[f"E{curr_row}"].number_format = "#,##0"

        ws[f"F{curr_row}"] = f"=D{curr_row}+E{curr_row}"
        ws[f"F{curr_row}"].alignment = al_right
        ws[f"F{curr_row}"].number_format = "#,##0"

        if curr_row == 11:
            ws[f"G{curr_row}"] = f"=F{curr_row}"
        else:
            ws[f"G{curr_row}"] = f"=G{curr_row-1}+F{curr_row}"
        ws[f"G{curr_row}"].alignment = al_right
        ws[f"G{curr_row}"].number_format = "#,##0"

        ws[f"H{curr_row}"] = status
        ws[f"H{curr_row}"].alignment = al_center

        for col_letter, _ in headers:
            cell = ws[f"{col_letter}{curr_row}"]
            cell.font = f_tbl_row
            if fill_curr.fill_type: cell.fill = fill_curr
            cell.border = b_all_thin

        curr_row += 1

    # Fila de Totales
    total_row = curr_row
    ws.row_dimensions[total_row].height = 24
    ws[f"B{total_row}"] = "TOTAL GENERAL AL MOMENTO"
    ws[f"B{total_row}"].alignment = al_left
    ws[f"C{total_row}"] = ""
    
    ws[f"D{total_row}"] = f"=SUM(D11:D{total_row-1})"
    ws[f"D{total_row}"].alignment = al_right
    ws[f"D{total_row}"].number_format = "#,##0"

    ws[f"E{total_row}"] = f"=SUM(E11:E{total_row-1})"
    ws[f"E{total_row}"].alignment = al_right
    ws[f"E{total_row}"].number_format = "#,##0"

    ws[f"F{total_row}"] = f"=SUM(F11:F{total_row-1})"
    ws[f"F{total_row}"].alignment = al_right
    ws[f"F{total_row}"].number_format = "#,##0"

    ws[f"G{total_row}"] = f"=F{total_row}"
    ws[f"G{total_row}"].alignment = al_right
    ws[f"G{total_row}"].number_format = "#,##0"

    ws[f"H{total_row}"] = "100% CONCILIADO"
    ws[f"H{total_row}"].alignment = al_center

    for col_letter, _ in headers:
        cell = ws[f"{col_letter}{total_row}"]
        cell.font = f_tbl_total
        cell.fill = fill_total_row
        cell.border = b_total

    # 4. CUADRO DE NOTAS DE AUDITORÍA Y CONCILIACIÓN
    note_start = total_row + 2
    ws.merge_cells(f"B{note_start}:H{note_start}")
    ws[f"B{note_start}"] = "NOTAS DE INTEGRIDAD Y REGLAS DE AUDITORÍA"
    ws[f"B{note_start}"].font = Font(name="Calibri", size=11, bold=True, color=c_blue_dark)

    notes = [
        "1. Línea Base Oficial Entregada: Los datos del 17 al 25 de Octubre corresponden al reporte entregado hoy (263 casetas + 684 cajas = 947 intervenciones validadas), los cuales quedan 100% fijos e inmutables.",
        "2. Actividad Diaria Normal: A partir del 26 de Octubre, las actividades de campo se suman diariamente en cada corte matutino (7:00 AM) sobre la línea base oficial.",
        "3. Deduplicación Estricta: Cada activo físico se contabiliza una sola vez por orden cronológico, protegiendo las cifras frente a reintentos de captura en campo.",
        "4. Regla de Horario de Corte: Las capturas realizadas después de las 22:00 hrs se contabilizan oficialmente para el ciclo del día siguiente."
    ]

    for idx, note_txt in enumerate(notes):
        r_n = note_start + 1 + idx
        ws.merge_cells(f"B{r_n}:H{r_n}")
        ws[f"B{r_n}"] = note_txt
        ws[f"B{r_n}"].font = Font(name="Calibri", size=9.5, italic=True, color="444444")
        ws.row_dimensions[r_n].height = 18

    # Ajustar ancho de columnas
    ws.column_dimensions["A"].width = 3
    ws.column_dimensions["B"].width = 16
    ws.column_dimensions["C"].width = 15
    ws.column_dimensions["D"].width = 16
    ws.column_dimensions["E"].width = 16
    ws.column_dimensions["F"].width = 24
    ws.column_dimensions["G"].width = 24
    ws.column_dimensions["H"].width = 20
    ws.column_dimensions["I"].width = 5
    ws.column_dimensions["J"].width = 5

    return ws
