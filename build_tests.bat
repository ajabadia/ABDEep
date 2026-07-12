@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Building ABD Eep Unit Test Runner
echo ========================================

set "VC_VARS=C:\Program Files\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvarsall.bat"
set "CMAKE_PATH=C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"

if not exist "%VC_VARS%" (
    echo [ERROR] vcvarsall.bat not found
    exit /b 1
)
if not exist "%CMAKE_PATH%" (
    echo [ERROR] cmake not found
    exit /b 1
)

echo [INFO] Initializing Visual Studio environment...
call "%VC_VARS%" x64

echo [INFO] Configuring CMake...
if not exist "build_tests" mkdir build_tests

"%CMAKE_PATH%" -S . -B build_tests -G "Visual Studio 18 2026" -A x64 -DCMAKE_SYSTEM_VERSION=10.0.26100.0
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] CMake config failed, retrying...
    if exist "build_tests\CMakeCache.txt" del /q "build_tests\CMakeCache.txt"
    "%CMAKE_PATH%" -S . -B build_tests -G "Visual Studio 18 2026" -A x64 -DCMAKE_SYSTEM_VERSION=10.0.26100.0
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] CMake configuration failed
        exit /b 1
    )
)

echo [INFO] Building ABDEep_UnitTests target...
"%CMAKE_PATH%" --build build_tests --target ABDEep_UnitTests --config Debug --parallel
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed with code %ERRORLEVEL%
    exit /b 1
)

echo [SUCCESS] ABDEep_UnitTests built successfully.
echo.
echo Binary: build_tests\Source\Debug\ABDEep_UnitTests.exe
echo.
echo Run with: build_tests\Source\Debug\ABDEep_UnitTests.exe
echo Verbose:  build_tests\Source\Debug\ABDEep_UnitTests.exe --verbose
exit /b 0
