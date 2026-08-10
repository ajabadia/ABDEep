# scripts/verify_release.ps1
# Script de verificación de distribución para ABD Eep
# Ejecuta: build → tests C++ → tests WebUI → Pluginval
#
# Uso:
#   .\scripts\verify_release.ps1                # Build Release + test todo
#   .\scripts\verify_release.ps1 -SkipBuild      # Saltar compilación
#   .\scripts\verify_release.ps1 -PluginvalPath "C:\tools\pluginval.exe"

param(
    [switch]$SkipBuild,
    [string]$PluginvalPath = "",
    [switch]$Help
)

if ($Help) {
    Get-Help $PSCommandPath -Detailed
    exit 0
}

$ErrorActionPreference = "Stop"
$rootDir = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $rootDir "build"
$testBin = Join-Path $buildDir "ABDEep_UnitTests_artefacts\Release\ABDEep_UnitTests.exe"
$vst3Glob = Join-Path $buildDir "*_artefacts\Release\VST3\*.vst3"
$logFile = Join-Path $rootDir "verify_release_log.txt"
$global:exitCode = 0

function Write-Step($msg) {
    Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════`n" -ForegroundColor Cyan
}

function Write-Pass($msg) {
    Write-Host "  ✅ $msg" -ForegroundColor Green
}

function Write-Fail($msg) {
    Write-Host "  ❌ $msg" -ForegroundColor Red
    $global:exitCode = 1
}

function Write-Skip($msg) {
    Write-Host "  ⏭️  $msg" -ForegroundColor Yellow
}

# ── 1. COMPILACIÓN RELEASE ──────────────────────────────────
if (-not $SkipBuild) {
    Write-Step "Paso 1: Compilación Release"
    $buildScript = Join-Path $rootDir "build.bat"
    if (Test-Path $buildScript) {
        Push-Location $rootDir
        try {
            & cmd.exe /c ".\build.bat 2" 2>&1 | Tee-Object -FilePath $logFile -Append
            if ($LASTEXITCODE -eq 0) {
                Write-Pass "Compilación Release completada (exit code: 0)"
            } else {
                Write-Fail "Compilación Release falló (exit code: $LASTEXITCODE). Revisa $logFile"
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Skip "build.bat no encontrado. Compila manualmente: cmake --build build --config Release"
    }
} else {
    Write-Skip "Compilación omitida (--SkipBuild)"
}

# ── 2. TESTS UNITARIOS C++ ────────────────────────────────
Write-Step "Paso 2: Tests Unitarios C++"
if (Test-Path $testBin) {
    & $testBin *> "$rootDir\test_cpp_output.txt"
    if ($LASTEXITCODE -eq 0) {
        Write-Pass "Tests C++: 0 fallos (ver test_cpp_output.txt)"
    } else {
        Write-Fail "Tests C++ fallaron (exit code: $LASTEXITCODE). Revisa test_cpp_output.txt"
    }
} else {
    Write-Skip "Binario de tests no encontrado: $testBin"
}

# ── 3. TESTS WEBUI ─────────────────────────────────────────
Write-Step "Paso 3: Tests WebUI (Vitest)"
Push-Location $rootDir
try {
    # PowerShell 2>&1 con stderr mezclado corrompe encoding con Tee-Object.
    # Convertimos cada objeto ErrorRecord a string con ForEach-Object antes de tee.
    $npmOut = & npx vitest run --reporter basic 2>&1 | ForEach-Object { "$_" }
    $npmExit = $LASTEXITCODE
    $npmOut | Add-Content -Path $logFile
    if ($npmExit -eq 0) {
        # Extraer línea de resumen ("Tests  4731 passed | 2 skipped (4733)")
        $summaryLine = ($npmOut | Select-String -Pattern "^\s*Tests" | Select-Object -Last 1)
        if ($summaryLine) {
            Write-Pass "WebUI: $($summaryLine.ToString().Trim())"
        } else {
            Write-Pass "WebUI tests: 0 fallos"
        }
    } else {
        Write-Fail "WebUI tests fallaron (exit code: $npmExit). Revisa $logFile"
    }
} finally {
    Pop-Location
}

# ── 4. PLUGINVAL ───────────────────────────────────────────
Write-Step "Paso 4: Validación Pluginval"
$vst3Files = Get-ChildItem -Path $vst3Glob -ErrorAction SilentlyContinue
if ($vst3Files.Count -eq 0) {
    Write-Skip "No se encontraron binarios VST3 para validar"
} else {
    if ([string]::IsNullOrEmpty($PluginvalPath)) {
        # Buscar pluginval en PATH o ubicaciones comunes
        $pluginval = Get-Command "pluginval.exe" -ErrorAction SilentlyContinue
        if (-not $pluginval) {
            $candidates = @(
                "$env:LOCALAPPDATA\pluginval\pluginval.exe",
                "$env:ProgramFiles\pluginval\pluginval.exe",
                "${env:ProgramFiles(x86)}\pluginval\pluginval.exe"
            )
            foreach ($cand in $candidates) {
                if (Test-Path $cand) { $pluginval = $cand; break }
            }
        }
    } else {
        $pluginval = $PluginvalPath
    }

    if ($pluginval) {
        foreach ($vst3 in $vst3Files) {
            Write-Host "Validando: $($vst3.FullName)" -ForegroundColor Gray
            & $pluginval --strictness-level 5 --seed 42 --validate "$($vst3.FullName)" *>> $logFile
            if ($LASTEXITCODE -eq 0) {
                Write-Pass "Pluginval: $($vst3.Name) — ALL TESTS PASSED"
            } else {
                Write-Fail "Pluginval: $($vst3.Name) — FALLOS DETECTADOS"
            }
        }
    } else {
        Write-Skip "pluginval.exe no encontrado. Descárgalo de: https://github.com/Tracktion/pluginval/releases"
    }
}

# ── RESUMEN FINAL ───────────────────────────────────────────
Write-Step "Resumen Final"
if ($global:exitCode -eq 0) {
    Write-Host "  🎉 TODAS LAS VERIFICACIONES PASARON" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Algunas verificaciones fallaron. Revisa $logFile" -ForegroundColor Red
}

Write-Host "`nLog completo: $logFile`n"
exit $global:exitCode
