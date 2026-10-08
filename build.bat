@echo off
setlocal enabledelayedexpansion

rem ============================================================================
rem build.bat - Build ABD Eep for a specific model
rem ============================================================================

taskkill /f /im "ABD Eep Calibration Lab.exe" >nul 2>&1
taskkill /f /im "ABD Eep.exe" >nul 2>&1

rem --- Rutas canónicas de vcvars para varias ediciones/versions de VS ----------
rem El proyecto nacio en VS2026 Community, pero esta version es robusta para
rem VS2022/VS2026 Community/Professional/Enterprise y para cuando el usuario
rem tiene la instalacion en otra ruta canonica de Microsoft Visual Studio.
rem Orden: primero la canonica del proyecto, luego alternativas comunes.

rem NOTA: rutas con UN solo backslash. En batch, \\ literal no se normaliza y
rem rompe el `if exist` de cada entrada. Los items van citados para que el
rem `for` respete los espacios (Program Files / Archivos de programa).
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

set "CMAKE_PATH=C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"

rem --- Encontrar vcvars (ya detectado arriba; VC_VARS queda definido o vacio) ---
if not defined VC_VARS (
    echo [ERROR] vcvarsall.bat no encontrado en ninguna ruta canonica de Visual Studio.
    echo [ERROR] Instale "Desarrollo de escritorio con C++" para una de las ediciones de VS2022/VS2026 y vuelva a intentar.
    goto error
)

rem --- Encontrar cmake ---------------------------------------------------------------
if exist "%CMAKE_PATH%" goto cmake_found
set "CMAKE_PATH_ALT=C:\Program Files\Microsoft Visual Studio\17\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
if exist "%CMAKE_PATH_ALT%" set "CMAKE_PATH=%CMAKE_PATH_ALT%" && goto cmake_found
where cmake >nul 2>&1
if %ERRORLEVEL%==0 (
    for /f "delims=" %%F in ('where cmake') do set "CMAKE_PATH=%%F" && goto cmake_found
)
echo [ERROR] cmake no encontrado. Instale Visual Studio con la carga de trabajo "Desarrollo de escritorio con C++" (incluye CMake) o agregue cmake al PATH.
goto error
:cmake_found

rem --- Cargar vcvars y verificar toolchain -------------------------------------------
call "%VC_VARS%" x64
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] vcvarsall.bat x64 fallo con codigo %ERRORLEVEL%.
    goto error
)

rem Verificar que el ensamblador C++ esta en PATH despues de cargar vcvars.
where cl >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] vcvars cargado pero 'cl' no esta en PATH. Toolchain de C++ no disponible.
    goto error
)

if not exist "%CMAKE_PATH%" (
    echo [ERROR] cmake no encontrado en la ruta esperada: %CMAKE_PATH%
    goto error
)

rem --- Modelo y directorio de build --------------------------------------------------
set MODEL=2
if not "%1"=="" set MODEL=%1

if "%2"=="" (
    set "BUILD_DIR=build"
) else (
    set "BUILD_DIR=%2"
)

if %MODEL%==0 set "MODEL_NAME=ABD Eep - MIDI Controller"
if %MODEL%==1 set "MODEL_NAME=ABD Eep - Classic (DeepMind Clone)"
if %MODEL%==2 set "MODEL_NAME=ABD Eep - Enhanced (Expanded Synthesis)"

echo ========================================
echo Building: %MODEL_NAME%
echo DEEP_TARGET_MODEL=%MODEL%
echo Build dir: %BUILD_DIR%
echo VC vars: %VC_VARS%
echo cl: %CL%
echo cmake: %CMAKE_PATH%
echo ========================================

if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

rem --- Increment build number -------------------------------------------------------
set "VERSION_FILE=build_no.txt"
if not exist %VERSION_FILE% echo 100 > %VERSION_FILE%
set /p build_no=<%VERSION_FILE%
set /a build_no=%build_no% + 1
echo %build_no% > %VERSION_FILE%

if not exist "Source\Core" mkdir "Source\Core"
echo #define EEP_BUILD_VERSION "%build_no%" > "Source\Core\BuildVersion.h"
echo #define EEP_BUILD_TIMESTAMP "%DATE% %TIME%" >> "Source\Core\BuildVersion.h"

rem --- Bundle del WebUI (Vite): los bare imports @abdsynths/* (keybed
rem     compartido, fitStage) tienen que llegar resueltos al WebView2. ---
set "ABDEEP_NODE_OK="
where node >nul 2>&1
if %ERRORLEVEL%==0 set "ABDEEP_NODE_OK=1"

if defined ABDEEP_NODE_OK (
    echo [INFO] Empaquetando WebUI ^(vite build -^> WebUI/dist^)...
    call node scripts\build_webui.js
    if !ERRORLEVEL! NEQ 0 echo [WARNING] El bundle del WebUI fallo: el binario embebido usara el arbol crudo.
) else (
    echo [WARNING] node no encontrado: WebUI sin empaquetar ^(keybed compartido sin montar^).
)

echo [INFO] Configuring CMake...
"%CMAKE_PATH%" -S . -B "%BUILD_DIR%" -G "Visual Studio 18 2026" -A x64 -DCMAKE_SYSTEM_VERSION=10.0.26100.0 -D DEEP_TARGET_MODEL=%MODEL%
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] CMake configuration failed with code %ERRORLEVEL%.
    goto error
)

echo [INFO] Building VST3 and Standalone...
"%CMAKE_PATH%" --build "%BUILD_DIR%" --config Release --parallel
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed with code %ERRORLEVEL%.
    goto error
)

echo [SUCCESS] %MODEL_NAME% built successfully.
echo.
choice /C SN /N /M "Do you want to compile WebAssembly (WASM) as well? [S=Yes, N=No] "
if %ERRORLEVEL% EQU 1 (
    echo.
    echo ========================================
    echo  Launching WASM build...
    echo ========================================
    call .\wasm\build_wasm.bat
)
exit /b 0

:error
echo.
echo [ERROR] Build failed.
exit /b 1
