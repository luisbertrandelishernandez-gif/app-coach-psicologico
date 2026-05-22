$base = 'E:\Automatizaciones\app002-psicologico\supuestos\caso-invernadero'
Write-Host "=== VERIFICACION CONTENIDO GENERADO ===" -ForegroundColor Cyan
Get-ChildItem $base -Recurse -File | Select-Object FullName, Length | Format-Table -AutoSize
$archivos = Get-ChildItem $base -Recurse -File
Write-Host ""
Write-Host "=== TOTALES ===" -ForegroundColor Green
Write-Host ("Total archivos: " + $archivos.Count)
$kb = [math]::Round(($archivos | Measure-Object Length -Sum).Sum/1024, 2)
Write-Host ("Tamano total: " + $kb + " KB")
