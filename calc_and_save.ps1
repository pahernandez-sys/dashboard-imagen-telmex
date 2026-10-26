$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$path = "c:\Users\PCI\Documents\Antigravity\dashboard-imagen-telmex\data\Reporte_Diario_Casetas_y_Cajas_Contratistas_2026.xlsx"
$wb = $excel.Workbooks.Open($path)
$excel.CalculateFull()
$wb.Save()
$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
Write-Output "Excel COM CalculateFull and Save completed."
