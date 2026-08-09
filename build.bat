@echo off
setlocal enabledelayedexpansion

rem ============================================================================
rem build.bat - Build ABD Eep for a specific model
rem ============================================================================

taskkill /f /im "ABD Eep Calibration Lab.exe" >nul 2>&1
taskkill /f /im "ABD Eep.exe" >nul 2>&1

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

set MODEL=0
if not "%1"=="" set MODEL=%1

if "%2"=="" (
    set "BUILD_DIR=build"
) else (
    set BUILD_DIR=%2
)

if %MODEL%==0 set "MODEL_NAME=ABD Eep - Classic (DeepMind Clone)"
if %MODEL%==1 set "MODEL_NAME=ABD Eep - Classic (DeepMind Clone)"
if %MODEL%==2 set "MODEL_NAME=ABD Eep - Enhanced (Expanded Synthesis)"

echo ========================================
echo Building: %MODEL_NAME%
echo DEEP_TARGET_MODEL=%MODEL%
echo Build dir: %BUILD_DIR%
echo ========================================

if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

rem --- Increment build number ---
set "VERSION_FILE=build_no.txt"
if not exist %VERSION_FILE% echo 100 > %VERSION_FILE%
set /p build_no=<%VERSION_FILE%
set /a build_no=%build_no% + 1
echo %build_no% > %VERSION_FILE%

if not exist "Source\Core" mkdir "Source\Core"
echo #define EEP_BUILD_VERSION "%build_no%" > "Source\Core\BuildVersion.h"
echo #define EEP_BUILD_TIMESTAMP "%DATE% %TIME%" >> "Source\Core\BuildVersion.h"

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
