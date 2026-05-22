# SCRIPT: Generar MP3 para podcasts del caso Invernadero Zarzalejo
# REQUIERE RED - Ejecutar manualmente (Cortex XDR bloquea desde Claude Code)
# Perfil NLM: lh (cuenta luisbertrandelishernandez@gmail.com)
# Renovar si caduco: nlm login --profile lh

param(
    [string]$Perfil = "lh",
    [string]$Destino = "E:\Automatizaciones\app002-psicologico\supuestos\caso-invernadero\podcast-guiones"
)

$podcasts = @(
    @{
        Ep       = "ep01"
        Nombre   = "ira_cronica"
        Notebook = "b5afa51d"
        Titulo   = "Cuando la ira no se va"
    },
    @{
        Ep       = "ep02"
        Nombre   = "la_trampa_de_tener_razon"
        Notebook = "dc15ca48"
        Titulo   = "La trampa de tener razon"
    },
    @{
        Ep       = "ep03"
        Nombre   = "verguenza_fracaso"
        Notebook = "dc15ca48"
        Titulo   = "Verguenza y fracaso"
    },
    @{
        Ep       = "ep04"
        Nombre   = "rumiar_no_resuelve"
        Notebook = "c9b5997b"
        Titulo   = "Rumiar no resuelve"
    },
    @{
        Ep       = "ep05"
        Nombre   = "perdonar_sin_olvidar"
        Notebook = "9c30b43b"
        Titulo   = "Perdonar sin olvidar"
    }
)

Write-Host "=== GENERACION PODCASTS CASO INVERNADERO ===" -ForegroundColor Cyan
Write-Host ("Perfil NLM: " + $Perfil + " | Destino: " + $Destino)

# Verificar que nlm esta en PATH
$nlmCheck = Get-Command nlm -ErrorAction SilentlyContinue
if (-not $nlmCheck) {
    Write-Host "ERROR: 'nlm' no esta en PATH. Probar instalar:" -ForegroundColor Red
    Write-Host "  pip install --upgrade notebooklm-cli" -ForegroundColor Yellow
    Write-Host "  o renovar perfil: nlm login --profile $Perfil" -ForegroundColor Yellow
    exit 1
}

# Verificar destino
if (-not (Test-Path $Destino)) {
    Write-Host ("ERROR: destino no existe: " + $Destino) -ForegroundColor Red
    exit 1
}

foreach ($p in $podcasts) {
    $nombreMp3 = $p.Ep + "_" + $p.Nombre + ".mp3"
    $rutaMp3 = Join-Path $Destino $nombreMp3

    if (Test-Path $rutaMp3) {
        Write-Host ("[" + $p.Ep + "] Ya existe: " + $nombreMp3 + " - saltando") -ForegroundColor Yellow
        continue
    }

    Write-Host ""
    Write-Host ("[" + $p.Ep + "] Generando: " + $p.Titulo + "...") -ForegroundColor Cyan
    Write-Host ("  Cuaderno: " + $p.Notebook)

    # Generar audio overview con NLM CLI
    # NOTA: la sintaxis exacta de nlm puede variar entre versiones.
    # Si falla, probar: nlm audio-overview <id> --profile <perfil> > <output>
    # o consultar 'nlm --help'.
    $cmd = "nlm audio-overview `"$($p.Notebook)`" --profile $Perfil --output `"$rutaMp3`""
    Write-Host ("  Ejecutando: " + $cmd)

    try {
        Invoke-Expression $cmd
        if ($LASTEXITCODE -eq 0 -and (Test-Path $rutaMp3)) {
            $size = (Get-Item $rutaMp3).Length
            $sizeMb = [math]::Round($size / 1MB, 1)
            Write-Host ("  OK: " + $nombreMp3 + " (" + $sizeMb + " MB)") -ForegroundColor Green
        } else {
            Write-Host ("  ERROR en " + $p.Ep + " - continuar manualmente con NotebookLM web") -ForegroundColor Red
        }
    } catch {
        Write-Host ("  EXCEPCION en " + $p.Ep + ": " + $_.Exception.Message) -ForegroundColor Red
    }

    # Pausa entre llamadas para no saturar la API
    Write-Host "  Pausa 30s..."
    Start-Sleep -Seconds 30
}

Write-Host ""
Write-Host "=== SIGUIENTE PASO ===" -ForegroundColor Cyan
Write-Host "1. Verificar MP3 generados: dir $Destino\*.mp3"
Write-Host "2. Ejecutar: .\_actualizar_index_audio.ps1"
Write-Host "3. Editar INDEX.json (cambiar strings de podcast a objetos con audio_url)"
Write-Host "4. Bumpear cache buster ?v=N en index.html"
Write-Host "5. firebase deploy --only hosting"
