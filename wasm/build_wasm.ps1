# build_wasm.ps1 — PowerShell script to build the WASM DSP engine
# Imports Visual Studio and Emscripten variables and runs CMake.

$ErrorActionPreference = "Stop"

# 1. Ejecutar vcvarsall y emsdk_env en cmd, y recuperar las variables de entorno resultantes
echo "Importing Visual Studio and Emscripten environment variables..."
$vars = cmd.exe /c "call `"C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat`" x64 && call C:\emsdk\emsdk_env.bat && set"

foreach ($line in $vars) {
    if ($line -match "^([^=]+)=(.*)$") {
        $name = $Matches[1]
        $val = $Matches[2]
        [System.Environment]::SetEnvironmentVariable($name, $val, "Process")
    }
}

# 2. Configurar CMake con Emscripten
echo "`nConfiguring CMake with Emscripten..."
if (!(Test-Path "wasm\build")) {
    New-Item -ItemType Directory -Path "wasm\build" | Out-Null
}

& emcmake cmake -S wasm -B wasm\build -DCMAKE_BUILD_TYPE=Release -G Ninja

# 3. Compilar
echo "`nBuilding WASM module..."
& cmake --build wasm\build

echo "`n========================================"
echo " Build complete!"
echo " Output: WebUI\wasm\abdeep_dsp.js"
echo "         WebUI\wasm\abdeep_dsp.wasm"
echo "========================================"
