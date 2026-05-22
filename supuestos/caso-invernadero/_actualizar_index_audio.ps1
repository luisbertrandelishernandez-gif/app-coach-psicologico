# SCRIPT: detectar MP3 generados y mostrar plantilla JSON para actualizar INDEX.json
# No modifica INDEX.json automaticamente (para evitar romper edits manuales).
# Solo lista los MP3 disponibles y genera el snippet JSON a pegar.

$indexPath = "E:\Automatizaciones\app002-psicologico\supuestos\caso-invernadero\INDEX.json"
$podcastDir = "E:\Automatizaciones\app002-psicologico\supuestos\caso-invernadero\podcast-guiones"

if (-not (Test-Path $indexPath)) {
    Write-Host ("ERROR: INDEX.json no existe en " + $indexPath) -ForegroundColor Red
    exit 1
}

Write-Host "=== Verificacion MP3 generados ===" -ForegroundColor Cyan
$mp3s = Get-ChildItem $podcastDir -Filter "*.mp3" -ErrorAction SilentlyContinue

if (-not $mp3s -or $mp3s.Count -eq 0) {
    Write-Host "No hay MP3 todavia. Ejecutar primero _generar_podcasts.ps1" -ForegroundColor Yellow
    exit 0
}

foreach ($mp3 in $mp3s) {
    $sizeMb = [math]::Round($mp3.Length / 1MB, 1)
    Write-Host ("  OK " + $mp3.Name + " (" + $sizeMb + " MB)") -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Snippet JSON para INDEX.contenidos.podcasts ===" -ForegroundColor Cyan
Write-Host "Sustituir el array 'podcasts' en INDEX.json por:"
Write-Host ""

# Mapping ep -> titulo + notebook (espejo de _generar_podcasts.ps1)
$titulos = @{
    "ep01" = @{ Titulo = "Cuando la ira no se va";        Notebook = "b5afa51d" }
    "ep02" = @{ Titulo = "La trampa de tener razon";       Notebook = "dc15ca48" }
    "ep03" = @{ Titulo = "Verguenza y fracaso";            Notebook = "dc15ca48" }
    "ep04" = @{ Titulo = "Rumiar no resuelve";             Notebook = "c9b5997b" }
    "ep05" = @{ Titulo = "Perdonar sin olvidar";           Notebook = "9c30b43b" }
}

Write-Host '"podcasts": ['
$first = $true
foreach ($mp3 in ($mp3s | Sort-Object Name)) {
    $base = $mp3.BaseName  # ej "ep01_ira_cronica"
    $ep = $base.Split('_')[0]  # ej "ep01"
    $meta = $titulos[$ep]
    if (-not $meta) {
        $meta = @{ Titulo = $base; Notebook = "desconocido" }
    }
    if (-not $first) { Write-Host "," }
    $first = $false
    Write-Host "  {"
    Write-Host ('    "id": "' + $ep + '",')
    Write-Host ('    "titulo": "' + $meta.Titulo + '",')
    Write-Host ('    "guion": "podcast-guiones/' + $base + '.md",')
    Write-Host ('    "audio_url": "supuestos/caso-invernadero/podcast-guiones/' + $mp3.Name + '",')
    Write-Host ('    "notebooklm_notebook": "' + $meta.Notebook + '"')
    Write-Host "  }" -NoNewline
}
Write-Host ""
Write-Host "]"

Write-Host ""
Write-Host "=== Pasos finales ===" -ForegroundColor Cyan
Write-Host "1. Editar INDEX.json y pegar el snippet anterior en 'contenidos.podcasts'"
Write-Host "2. Bumpear cache buster ?v=N en E:\Automatizaciones\app002-psicologico\index.html"
Write-Host "3. firebase deploy --only hosting"
Write-Host "4. Ctrl+Mayus+R en https://psicologico-antigravity.web.app"
