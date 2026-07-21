@echo off
setlocal enabledelayedexpansion

rem ============================================================================
rem build.bat — Build ABD Eep for a specific model
rem ============================================================================

rem Mate a todos los posibles ejecutables abiertos que bloqueen la compilacion
taskkill /f /im "ABD Eep Calibration Lab.exe" >nul 2>&1
taskkill /f /im "ABD Eep.exe" >nul 2>&1
rem
rem Usage:
rem   build.bat [model] [build_dir]
rem
rem   model      0=MIDI Controller (default), 1=Classic (DeepMind Clone), 2=Enhanced (Expanded Synth)
rem   build_dir  Optional output directory (default: build)
rem ============================================================================

set "VC_VARS=C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat"
set "CMAKE_PATH=C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"

if exist "%VC_VARS%" (
    call "%VC_VARS%" x64
) else (
    echo [WARNING] vcvarsall.bat not found at %VC_VARS%
)

if not exist "%CMAKE_PATH%" (
    echo [ERROR] CMake not found at %CMAKE_PATH%
    goto error
)

rem --- Parse arguments ---
set MODEL=0
if not "%1"=="" set MODEL=%1

if "%2"=="" (
    set "BUILD_DIR=build"
) else (
    set BUILD_DIR=%2
)

rem --- Resolve model name for display ---
if %MODEL%==0 set "MODEL_NAME=ABD Eep - MIDI Controller"
if %MODEL%==1 set "MODEL_NAME=ABD Eep - Classic (DeepMind Clone)"
if %MODEL%==2 set "MODEL_NAME=ABD Eep - Enhanced (Expanded Synthesis)"

echo ========================================
echo Building: %MODEL_NAME%
echo DEEP_TARGET_MODEL=%MODEL%
echo Build dir: %BUILD_DIR%
echo ========================================

if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

echo [INFO] Configuring CMake...
    "%CMAKE_PATH%" -S . -B "%BUILD_DIR%" -G "Visual Studio 18 2026" -A x64 -DCMAKE_SYSTEM_VERSION=10.0.26100.0 -D DEEP_TARGET_MODEL=%MODEL%
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] CMake configuration failed. Clearing CMakeCache.txt and retrying...
    if exist "%BUILD_DIR%\CMakeCache.txt" del /q "%BUILD_DIR%\CMakeCache.txt"
    if exist "%BUILD_DIR%\CMakeFiles" rmdir /s /q "%BUILD_DIR%\CMakeFiles"
"%CMAKE_PATH%" -S . -B "%BUILD_DIR%" -G "Visual Studio 18 2026" -A x64 -DCMAKE_SYSTEM_VERSION=10.0.26100.0 -D DEEP_TARGET_MODEL=%MODEL%
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] CMake configuration failed again with code !ERRORLEVEL!
        goto error
    )
)

echo [INFO] Building VST3 and Standalone...
"%CMAKE_PATH%" --build "%BUILD_DIR%" --config Release --parallel
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed with code %ERRORLEVEL%
    goto error
)

echo [SUCCESS] %MODEL_NAME% built successfully.
exit /b 0

:error
echo.
echo [ERROR] Build failed.
pause
exit /b 1
