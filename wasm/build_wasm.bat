@echo off
REM ============================================================
REM build_wasm.bat — Compila el motor DSP de ABDEep a WebAssembly
REM ============================================================

echo ========================================
echo  ABDEep WASM Build
echo ========================================

REM 1. Limpieza total de shims para asegurar reconstrucción idempotente y limpia
if exist "wasm\juce_shim\juce_core" (
    echo Cleaning juce_core shim...
    rmdir /s /q "wasm\juce_shim\juce_core"
)
if exist "wasm\juce_shim\juce_audio_processors" (
    echo Cleaning juce_audio_processors shim...
    rmdir /s /q "wasm\juce_shim\juce_audio_processors"
)

REM 2. Recopiar juce_core localmente
echo Copying juce_core module...
powershell -NoProfile -Command "Copy-Item -Path 'C:\JUCE\modules\juce_core' -Destination 'wasm\juce_shim\juce_core' -Recurse -Force"

REM 3. Patching ThreadPriorities de juce_core: copiamos nuestro archivo estático pre-configurado
echo Overriding ThreadPriorities for Emscripten...
copy /y "wasm\juce_shim\native\juce_ThreadPriorities_native.h" "wasm\juce_shim\juce_core\native\juce_ThreadPriorities_native.h" >nul

REM 4. Recopiar juce_audio_processors localmente
echo Copying juce_audio_processors module...
powershell -NoProfile -Command "Copy-Item -Path 'C:\JUCE\modules\juce_audio_processors' -Destination 'wasm\juce_shim\juce_audio_processors' -Recurse -Force"

REM 5. Patching PluginHostType de juce_audio_processors: usamos el enum correcto de JUCE
echo Patching juce_audio_processors PluginHostType...
powershell -NoProfile -Command "(Get-Content 'wasm\juce_shim\juce_audio_processors\utilities\juce_PluginHostType.cpp') -replace '#error', 'return PluginHostType::UnknownHost;' | Set-Content 'wasm\juce_shim\juce_audio_processors\utilities\juce_PluginHostType.cpp'"

REM Activar Emscripten y VS (silenciando la salida).
REM Quirk conocido (ver ABDCZ101/wasm/build_wasm.bat): llamar emsdk_env.bat con
REM >nul silencia TAMBIEN su set PATH y bajo Git Bash emite exports sh. Si el
REM SDK esta donde se espera, montar el PATH a mano (determinista).
call "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat" x64 >nul 2>nul
if exist "C:\emsdk\upstream\emscripten\emcmake.exe" (
    set "PATH=C:\emsdk;C:\emsdk\upstream\emscripten;C:\emsdk\node\22.16.0_64bit\bin;C:\emsdk\python\3.13.3_64bit;%PATH%"
    set "EM_CONFIG=C:\emsdk\.emscripten"
) else (
    call C:\emsdk\emsdk_env.bat >nul 2>nul
)

REM Crear directorio de build
if not exist "wasm\build" mkdir wasm\build

REM 6. Configurar CMake
echo.
echo Configuring CMake with Emscripten...
call emcmake cmake -S wasm -B wasm\build -DCMAKE_BUILD_TYPE=Release -G Ninja
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: CMake configuration failed!
    exit /b 1
)

REM 7. Compilar
echo.
echo Building WASM module...
cmake --build wasm\build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo ========================================
echo  Build complete!
echo  Output: WebUI\wasm\abdeep_dsp.js
echo          WebUI\wasm\abdeep_dsp.wasm
echo ========================================
