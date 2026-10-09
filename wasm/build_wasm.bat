@echo off
REM ============================================================
REM build_wasm.bat — Compila el motor DSP de ABDEep a WebAssembly
REM ============================================================

echo ========================================
echo  ABDEep WASM Build
echo ========================================

REM 0. Detección dinámica de JUCE
set "JUCE_DIR="
if exist "%~dp0..\JUCE\modules\juce_core" set "JUCE_DIR=%~dp0..\JUCE"
if not defined JUCE_DIR if exist "C:\JUCE\modules\juce_core" set "JUCE_DIR=C:\JUCE"
if not defined JUCE_DIR if defined JUCE_PATH if exist "%JUCE_PATH%\modules\juce_core" set "JUCE_DIR=%JUCE_PATH%"

if not defined JUCE_DIR (
    echo [ERROR] No se encontro la carpeta de modulos de JUCE.
    exit /b 1
)
echo Usando JUCE desde: %JUCE_DIR%

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
powershell -NoProfile -Command "Copy-Item -Path '%JUCE_DIR%\modules\juce_core' -Destination 'wasm\juce_shim\juce_core' -Recurse -Force"

REM 3. Patching ThreadPriorities de juce_core: copiamos nuestro archivo estático pre-configurado
echo Overriding ThreadPriorities for Emscripten...
copy /y "wasm\juce_shim\native\juce_ThreadPriorities_native.h" "wasm\juce_shim\juce_core\native\juce_ThreadPriorities_native.h" >nul

REM 4. Recopiar juce_audio_processors localmente
echo Copying juce_audio_processors module...
powershell -NoProfile -Command "Copy-Item -Path '%JUCE_DIR%\modules\juce_audio_processors' -Destination 'wasm\juce_shim\juce_audio_processors' -Recurse -Force"

REM 5. Patching PluginHostType de juce_audio_processors: usamos el enum correcto de JUCE
echo Patching juce_audio_processors PluginHostType...
powershell -NoProfile -Command "(Get-Content 'wasm\juce_shim\juce_audio_processors\utilities\juce_PluginHostType.cpp') -replace '#error', 'return PluginHostType::UnknownHost;' | Set-Content 'wasm\juce_shim\juce_audio_processors\utilities\juce_PluginHostType.cpp'"

REM --- Detección dinámica de Visual Studio vcvarsall.bat ---
set "VC_VARS="
for %%A in (
    "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\18\Professional\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\18\Enterprise\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\17\Community\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\17\Professional\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\17\Enterprise\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files (x86)\Microsoft Visual Studio\17\Community\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files (x86)\Microsoft Visual Studio\17\Professional\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files (x86)\Microsoft Visual Studio\17\Enterprise\VC\Auxiliary\Build\vcvarsall.bat"
) do (
    if not defined VC_VARS if exist %%A set "VC_VARS=%%~A"
)
if defined VC_VARS call "%VC_VARS%" x64 >nul 2>nul

REM --- Detección dinámica de Emscripten SDK ---
set "EMSDK_DIR="
if exist "D:\desarrollos\emsdk\upstream\emscripten\emcmake.exe" set "EMSDK_DIR=D:\desarrollos\emsdk"
if not defined EMSDK_DIR if exist "C:\emsdk\upstream\emscripten\emcmake.exe" set "EMSDK_DIR=C:\emsdk"
if not defined EMSDK_DIR if defined EMSDK if exist "%EMSDK%\upstream\emscripten\emcmake.exe" set "EMSDK_DIR=%EMSDK%"

if defined EMSDK_DIR (
    echo Usando Emscripten SDK desde: %EMSDK_DIR%
    set "PATH=%EMSDK_DIR%;%EMSDK_DIR%\upstream\emscripten;%EMSDK_DIR%\node\22.16.0_64bit\bin;%EMSDK_DIR%\python\3.13.3_64bit;%PATH%"
    set "EM_CONFIG=%EMSDK_DIR%\.emscripten"
    set "EMSDK=%EMSDK_DIR%"
    call "%EMSDK_DIR%\emsdk_env.bat" >nul 2>nul
) else (
    echo [WARNING] No se encontro emsdk en D:\desarrollos\emsdk ni C:\emsdk
)

REM Crear directorio de build
if not exist "wasm\build" mkdir wasm\build

REM 6. Configurar CMake
echo.
echo Configuring CMake with Emscripten...
call emcmake cmake -S wasm -B wasm\build -DCMAKE_BUILD_TYPE=Release -DJUCE_PATH="%JUCE_DIR%" -G Ninja
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
