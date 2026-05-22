# ============================================================
# PODCASTS CASO INVERNADERO - PIPELINE AUTOMATIZADO NLM
# Ejecutar con red desde PowerShell como Luis (no Claude Code)
# Requisito: nlm login --profile lh (si han caducado las cookies)
# ============================================================

param(
    [string]$Perfil    = "lh",
    [string]$Destino   = "E:\Automatizaciones\app002-psicologico\supuestos\caso-invernadero\podcast-guiones",
    [string]$IndexPath = "E:\Automatizaciones\app002-psicologico\supuestos\caso-invernadero\INDEX.json",
    [int]$TimeoutMin   = 15,
    [int]$PollSeg      = 30
)

# ---- Definicion de episodios --------------------------------
$episodios = @(
    @{
        Ep         = "ep01"
        Archivo    = "ep01_ira_cronica.mp3"
        Notebook   = "b5afa51d-7f0f-47b4-b544-f0dfb8dd69aa"
        Focus      = "ira cronica, injusticia institucional, invernadero Zarzalejo, hiperactivacion emocional sostenida"
        ArtifactId = "354db951-3829-4420-8720-66fc3819ab30"  # ya lanzado
    },
    @{
        Ep         = "ep02"
        Archivo    = "ep02_la_trampa_de_tener_razon.mp3"
        Notebook   = "dc15ca48-6fc2-4df7-8011-de517575a800"
        Focus      = "tener razon sin obtener justicia, distorsiones cognitivas, TREC, Ayuntamiento Zarzalejo"
        ArtifactId = $null
    },
    @{
        Ep         = "ep03"
        Archivo    = "ep03_verguenza_fracaso.mp3"
        Notebook   = "dc15ca48-6fc2-4df7-8011-de517575a800"
        Focus      = "verguenza, fracaso percibido, herida narcisista, confianza en profesional, 20.000 euros perdidos"
        ArtifactId = $null
    },
    @{
        Ep         = "ep04"
        Archivo    = "ep04_rumiar_no_resuelve.mp3"
        Notebook   = "c9b5997b-4da7-4785-87ce-d91be6809a81"
        Focus      = "rumiacion obsesiva, TOC, defusion cognitiva, bucles mentales sobre el expediente Zarzalejo"
        ArtifactId = $null
    },
    @{
        Ep         = "ep05"
        Archivo    = "ep05_perdonar_sin_olvidar.mp3"
        Notebook   = "9c30b43b-e8d7-4b74-9f6d-c8118385ecbd"
        Focus      = "perdon cristiano, resentimiento, alcalde, arquitecta municipal, liberacion interior, logoterapia"
        ArtifactId = $null
    }
)

# ---- FASE 1: Lanzar generacion de audio --------------------
Write-Host "`n=== FASE 1: LANZANDO GENERACION DE AUDIO ===" -ForegroundColor Cyan

foreach ($ep in $episodios) {
    $mp3 = Join-Path $Destino $ep.Archivo

    # Si el MP3 ya existe, saltar
    if (Test-Path $mp3) {
        Write-Host "[$($ep.Ep)] MP3 ya existe - saltando generacion" -ForegroundColor Yellow
        $ep.ArtifactId = "DONE"
        continue
    }

    # Si ya tiene ArtifactId asignado (ep01), saltar lanzamiento
    if ($ep.ArtifactId) {
        Write-Host "[$($ep.Ep)] Ya lanzado - ArtifactId: $($ep.ArtifactId)" -ForegroundColor Yellow
        continue
    }

    Write-Host "[$($ep.Ep)] Lanzando audio..." -ForegroundColor Cyan

    # Capturar output del comando nlm
    $output = nlm audio create $ep.Notebook `
        --profile $Perfil `
        --language es `
        --format deep_dive `
        --focus $ep.Focus `
        --confirm 2>&1

    # Extraer Artifact ID del output
    $artifactLine = $output | Where-Object { $_ -match "Artifact ID:" }
    if ($artifactLine) {
        $ep.ArtifactId = ($artifactLine -split "Artifact ID:")[-1].Trim()
        Write-Host "  OK Lanzado. ArtifactId: $($ep.ArtifactId)" -ForegroundColor Green
    } else {
        Write-Host "  ERR Error lanzando $($ep.Ep):" -ForegroundColor Red
        $output | ForEach-Object { Write-Host "    $_" }
        $ep.ArtifactId = "ERROR"
    }

    # Pausa entre lanzamientos para no saturar la API
    Start-Sleep -Seconds 5
}

# ---- FASE 2: Esperar a que todos terminen ------------------
Write-Host "`n=== FASE 2: ESPERANDO GENERACION ===" -ForegroundColor Cyan

$pendientes = $episodios | Where-Object { $_.ArtifactId -and $_.ArtifactId -ne "DONE" -and $_.ArtifactId -ne "ERROR" }
$inicio = Get-Date
$timeout = $inicio.AddMinutes($TimeoutMin)

while ($pendientes.Count -gt 0 -and (Get-Date) -lt $timeout) {
    Start-Sleep -Seconds $PollSeg
    $elapsed = [math]::Round(((Get-Date) - $inicio).TotalMinutes, 1)
    Write-Host "`n[${elapsed}min] Comprobando estado..." -ForegroundColor Gray

    $nuevoPendientes = @()
    foreach ($ep in $pendientes) {
        $status = nlm studio status $ep.Notebook --profile $Perfil 2>&1
        $statusLine = $status | Where-Object { $_ -match $ep.ArtifactId }

        if ($statusLine -match "complete") {
            Write-Host "  [$($ep.Ep)] OK COMPLETO" -ForegroundColor Green
        } elseif ($statusLine -match "failed|error") {
            Write-Host "  [$($ep.Ep)] ERR FALLIDO - revisar manualmente" -ForegroundColor Red
            $ep.ArtifactId = "ERROR"
        } else {
            Write-Host "  [$($ep.Ep)] ... En progreso..." -ForegroundColor Yellow
            $nuevoPendientes += $ep
        }
    }
    $pendientes = $nuevoPendientes
}

if ($pendientes.Count -gt 0) {
    Write-Host "`nWARN Timeout alcanzado ($TimeoutMin min). Episodios pendientes:" -ForegroundColor Yellow
    $pendientes | ForEach-Object { Write-Host "  - $($_.Ep): $($_.ArtifactId)" }
    Write-Host "Ejecuta manualmente: nlm download <ArtifactId> --profile $Perfil --output <ruta>"
}

# ---- FASE 3: Descargar MP3 ---------------------------------
Write-Host "`n=== FASE 3: DESCARGANDO MP3 ===" -ForegroundColor Cyan

$descargados = @()
foreach ($ep in $episodios) {
    if ($ep.ArtifactId -eq "DONE") {
        Write-Host "[$($ep.Ep)] Ya existia - OK" -ForegroundColor Green
        $descargados += $ep.Ep
        continue
    }
    if ($ep.ArtifactId -eq "ERROR" -or -not $ep.ArtifactId) { continue }

    $mp3 = Join-Path $Destino $ep.Archivo
    Write-Host "[$($ep.Ep)] Descargando -> $($ep.Archivo)..."

    nlm download $ep.ArtifactId --profile $Perfil --output $mp3 2>&1

    if (Test-Path $mp3) {
        $size = [math]::Round((Get-Item $mp3).Length / 1MB, 1)
        Write-Host "  OK Descargado: $($ep.Archivo) ($size MB)" -ForegroundColor Green
        $descargados += $ep.Ep
    } else {
        Write-Host "  ERR No se encontro el archivo tras la descarga" -ForegroundColor Red
    }
}

# ---- FASE 4: Actualizar INDEX.json -------------------------
Write-Host "`n=== FASE 4: ACTUALIZANDO INDEX.json ===" -ForegroundColor Cyan

if ($descargados.Count -gt 0 -and (Test-Path $IndexPath)) {
    $indexRaw = Get-Content $IndexPath -Raw -Encoding UTF8
    $index = $indexRaw | ConvertFrom-Json

    # Mapa ep -> datos del objeto podcast
    $epDatos = @{
        "ep01" = @{ id="ep01"; titulo="Cuando la ira no se va";    guion="podcast-guiones/ep01_ira_cronica.md";              audio_url="supuestos/caso-invernadero/podcast-guiones/ep01_ira_cronica.mp3" }
        "ep02" = @{ id="ep02"; titulo="La trampa de tener razon";   guion="podcast-guiones/ep02_la_trampa_de_tener_razon.md"; audio_url="supuestos/caso-invernadero/podcast-guiones/ep02_la_trampa_de_tener_razon.mp3" }
        "ep03" = @{ id="ep03"; titulo="Verguenza y fracaso";        guion="podcast-guiones/ep03_verguenza_fracaso.md";        audio_url="supuestos/caso-invernadero/podcast-guiones/ep03_verguenza_fracaso.mp3" }
        "ep04" = @{ id="ep04"; titulo="Rumiar no resuelve";         guion="podcast-guiones/ep04_rumiar_no_resuelve.md";       audio_url="supuestos/caso-invernadero/podcast-guiones/ep04_rumiar_no_resuelve.mp3" }
        "ep05" = @{ id="ep05"; titulo="Perdonar sin olvidar";       guion="podcast-guiones/ep05_perdonar_sin_olvidar.md";     audio_url="supuestos/caso-invernadero/podcast-guiones/ep05_perdonar_sin_olvidar.mp3" }
    }

    # Reconstruir la lista de podcasts con objetos enriquecidos
    $nuevosPodcasts = @()
    foreach ($entrada in $index.contenidos.podcasts) {
        $epId = $null
        if ($entrada -is [string]) {
            # Detectar que ep es por el nombre del archivo
            foreach ($k in $epDatos.Keys) {
                if ($entrada -match $k) { $epId = $k; break }
            }
        } elseif ($entrada.id) {
            $epId = $entrada.id
        }

        if ($epId -and $descargados -contains $epId) {
            $nuevosPodcasts += [PSCustomObject]$epDatos[$epId]
            Write-Host "  OK $epId actualizado con audio_url" -ForegroundColor Green
        } else {
            $nuevosPodcasts += $entrada
        }
    }

    $index.contenidos.podcasts = $nuevosPodcasts

    # Guardar INDEX.json actualizado
    $indexJson = $index | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($IndexPath, $indexJson, [System.Text.UTF8Encoding]::new($false))
    Write-Host "  INDEX.json actualizado" -ForegroundColor Green
} else {
    Write-Host "  Sin MP3 descargados o INDEX.json no encontrado - nada que actualizar" -ForegroundColor Yellow
}

# ---- FASE 5: Deploy ----------------------------------------
Write-Host "`n=== FASE 5: DEPLOY ===" -ForegroundColor Cyan
Write-Host "Ejecutando firebase deploy..." -ForegroundColor Cyan

Push-Location "E:\Automatizaciones\app002-psicologico"
firebase deploy --only hosting
Pop-Location

# ---- RESUMEN FINAL -----------------------------------------
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  RESUMEN FINAL - PODCASTS CASO INVERNADERO" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

foreach ($ep in $episodios) {
    $mp3 = Join-Path $Destino $ep.Archivo
    if (Test-Path $mp3) {
        $size = [math]::Round((Get-Item $mp3).Length / 1MB, 1)
        Write-Host "  OK $($ep.Ep): $($ep.Archivo) ($size MB)" -ForegroundColor Green
    } else {
        Write-Host "  -- $($ep.Ep): pendiente" -ForegroundColor Red
    }
}

Write-Host "`nApp actualizada en: https://psicologico-antigravity.web.app" -ForegroundColor Cyan
Write-Host "Abre la app -> Programa -> Invernadero Zarzalejo -> Podcast" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan
