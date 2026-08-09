# validate_and_generate.ps1 — Fase 1 · Esquema Declarativo y Generador Versionado
# =============================================================================
# Punto de entrada humano/CI para regenerar el registro canónico de parámetros.
# Delega la extracción/fusión/validación/emisión a scripts/registry_generator.js
# (node) y verifica los artefactos emitidos.
#
#   Uso:
#     powershell -ExecutionPolicy Bypass -File scripts/validate_and_generate.ps1
#
#   Exit codes:
#     0 = OK (con o sin warnings no fatales)
#     1 = errores fatales de validación (ids duplicados, rangos incompatibles,
#         NRPNs colisionados, byte map no contiguo, colisiones cppName...)
#     2 = infraestructura (node ausente / artefacto faltante)
#
# Enlazado desde CMakeLists.txt (add_custom_command) para regeneración automática
# cuando cambian las fuentes.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$generator = Join-Path $PSScriptRoot 'registry_generator.js'

# ── 1. Prerrequisitos ──────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error '[validate_and_generate] node no está en el PATH. Instala Node.js ≥ 18.'
    exit 2
}

Write-Host '[validate_and_generate] Ejecutando registry_generator.js (schemaVersion 1)...' -ForegroundColor Cyan

# ── 2. Generar (validación + emisión dentro del generador) ─────────
node $generator
if ($LASTEXITCODE -ne 0) {
    Write-Error "[validate_and_generate] registry_generator.js falló con exit code $LASTEXITCODE. No se actualizaron artefactos."
    exit 1
}

# ── 3. Verificar artefactos emitidos ───────────────────────────────
$artifacts = @(
    'schemas\parameter-registry.data.json',
    'WebUI\js\registry.gen.js',
    'Source\Core\ParameterRegistry.gen.h',
    'Source\Core\ParameterRegistry.gen.cpp'
)

$missing = $false
foreach ($rel in $artifacts) {
    $full = Join-Path $root $rel
    if (-not (Test-Path $full)) {
        Write-Error "[validate_and_generate] Artefacto faltante: $rel"
        $missing = $true
    } elseif ((Get-Item $full).Length -eq 0) {
        Write-Error "[validate_and_generate] Artefacto vacío: $rel"
        $missing = $true
    }
}
if ($missing) {
    Write-Error '[validate_and_generate] Verificación de artefactos fallida.'
    exit 2
}

Write-Host '[validate_and_generate] OK — 4 artefactos regenerados y verificados.' -ForegroundColor Green
exit 0
