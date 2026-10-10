@echo off
setlocal enabledelayedexpansion

rem ============================================================================
rem build.bat - Build ABD Eep for a specific model
rem ============================================================================
rem
rem CODIFICACION
rem
rem cmd.exe lee este fichero en la codificacion del SISTEMA, no en UTF-8: un
rem acento se parte en dos bytes y de ahi sale un comando que no existe en
rem mitad de un echo. Por eso todo lo que hay aqui es ASCII puro, y hay un
rem test que lo comprueba sobre el fichero entero.
rem
rem POR QUE EL CONTROL VA CON GOTO Y NO CON `if ( ... )`
rem
rem %TEMP%, %ProgramFiles% y cualquier ruta de un fallo pueden traer
rem parentesis. Dentro de un bloque `if ( ... )` cmd.exe descuadra el parser y
rem el error sale dos lineas mas abajo blamesando un fichero que no tiene nada
rem que ver. Los bloques con rutas van con goto.

taskkill /f /im "ABD Eep Calibration Lab.exe" >nul 2>&1
taskkill /f /im "ABD Eep.exe" >nul 2>&1

rem --- Encontrar Visual Studio: lo que decide es vcvarsall.bat ---------------
rem Preguntar con vswhere es lo que hace portable el script. Una ruta escrita a
rem fuego solo funciona en la maquina de quien la escribio, y en cualquier otra
rem el fallo sale por el camino largo: sin toolchain cmake tampoco aparece, y el
rem mensaje senala un fichero que SI existe pero en otra carpeta.
rem
rem Lo que se comprueba es vcvarsall.bat y no la carpeta de Visual Studio: el
rem directorio existe tambien en una instalacion sin el workload de C++, y una
rem deteccion que mirara el directorio daria por buena esa instalacion.
rem
rem %ProgramFiles(x86)% tiene PARENTESIS, por eso se resuelve UNA vez aqui, a
rem profundidad cero, y de ahi en adelante solo se usa PF86. Dentro de un for o
rem de un if descuadra el parser, que es la trampa que documenta esta cabecera.
set "PF86=%ProgramFiles(x86)%"
set "VSWHERE=%PF86%\Microsoft Visual Studio\Installer\vswhere.exe"
set "VS_LIST=%TEMP%\abdeep-vs.txt"
del /q "%VS_LIST%" >nul 2>&1
if exist "%VSWHERE%" "%VSWHERE%" -all -prerelease -products * -property installationPath > "%VS_LIST%"

set "VS_ROOT="
if not exist "%VS_LIST%" goto vs_lista_vacia
for /f "usebackq delims=" %%I in ("%VS_LIST%") do (
    if not defined VS_ROOT if exist "%%~I\VC\Auxiliary\Build\vcvarsall.bat" set "VS_ROOT=%%~I"
)
:vs_lista_vacia

rem Sin vswhere, o con el instalador sin tocar: rutas canonicas. Cada entrada es
rem la RAIZ de una instalacion, no el vcvarsall, para que el mismo criterio
rem (que exista ese fichero) decida en las dos vias.
if defined VS_ROOT goto vs_encontrado
for %%I in (
    "%ProgramFiles%\Microsoft Visual Studio\18\Community"
    "%ProgramFiles%\Microsoft Visual Studio\18\Professional"
    "%ProgramFiles%\Microsoft Visual Studio\18\Enterprise"
    "%PF86%\Microsoft Visual Studio\18\BuildTools"
    "%ProgramFiles%\Microsoft Visual Studio\17\Community"
    "%ProgramFiles%\Microsoft Visual Studio\17\Professional"
    "%ProgramFiles%\Microsoft Visual Studio\17\Enterprise"
    "%PF86%\Microsoft Visual Studio\17\Community"
    "%PF86%\Microsoft Visual Studio\17\Professional"
    "%PF86%\Microsoft Visual Studio\17\Enterprise"
) do (
    if not defined VS_ROOT if exist "%%~I\VC\Auxiliary\Build\vcvarsall.bat" set "VS_ROOT=%%~I"
)
:vs_encontrado

if not defined VS_ROOT goto vs_ausente
if exist "%VS_ROOT%\VC\Auxiliary\Build\vcvarsall.bat" goto vs_listo

:vs_ausente
echo [ERROR] No Visual Studio with the C++ compiler on this machine.
echo         vcvarsall.bat is missing, and that is the one thing that
echo         tells us there is a toolchain at all.
echo         Install the "Desktop development with C++" workload.
goto error

:vs_listo
set "VC_VARS=%VS_ROOT%\VC\Auxiliary\Build\vcvarsall.bat"
echo [INFO] Visual Studio: %VS_ROOT%
call "%VC_VARS%" x64
if errorlevel 1 goto vs_carga_fallo
goto vs_cargado

:vs_cargado

rem Verificar que el ensamblador C++ esta en PATH despues de cargar vcvars.
where cl >nul 2>&1
if errorlevel 1 goto cl_ausente
goto cl_ok

:cl_ausente
echo [ERROR] vcvars cargado pero 'cl' no esta en PATH. Toolchain de C++ no disponible.
goto error

:cl_ok

rem CMake primero el que trae Visual Studio, que ya sabemos que existe
rem ESTE MENSAJE TENIA UN FALLO MEDIDO: decia
rem   [ERROR] CMake not found at %CMAKE_PATH%
rem y con cmake ausente %CMAKE_PATH% llega VACIO, porque `%%~$PATH:C` devuelve
rem vacio si el fichero no esta y el `set` lo escribe igual. El mensaje imprimia
rem "CMake not found at " y a continuacion nada, senalando el aire justo en el
rem caso para el que existe. Por eso la ruta de la instalacion se guarda ANTES,
rem en su propia variable, y es la que nombra el mensaje.
set "CMAKE_PATH=%VS_ROOT%\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"
set "CMAKE_EN_VS=%CMAKE_PATH%"
if exist "%CMAKE_PATH%" goto cmake_ok
for %%C in (cmake.exe) do set "CMAKE_PATH=%%~$PATH:C"
if not "%CMAKE_PATH%"=="" goto cmake_ok
echo [ERROR] CMake not found.
echo         Se ha buscado en la instalacion de Visual Studio:
echo         %CMAKE_EN_VS%
echo         y tambien en el PATH, con `where cmake`.
echo         Instale Visual Studio con la carga de trabajo "Desarrollo de
echo         escritorio con C++", o agregue cmake al PATH.
goto error
:cmake_ok

rem --- Modelo y directorio de build --------------------------------------------
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
echo Visual Studio: %VS_ROOT%
echo cmake: %CMAKE_PATH%
echo ========================================

if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

rem --- Increment build number ---------------------------------------------------
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
rem
rem VA ANTES DE CONFIGURAR CMAKE A PROPOSITO: si se hiciera despues, CMake ya
rem habria embebido el arbol crudo y habria que reconfigurar para que recogiera
rem el bundle.
rem
rem Y NO ES UN [WARNING] DE UNA LINEA. Si el empaquetado falla el binario sale,
rem enlaza y se ve bien: los dos modulos con bare imports se quedan sin
rem resolver, el keybed compartido no aparece, y lo unico que se ve es un 404 en
rem la consola del WebView2 que nadie mira. Es el fallo mas caro de todo el
rem build y el mas invisible, y por eso dice que VA a pasar y POR QUE.
set "WEBUI_LOG=%TEMP%\abdeep-webui.log"
where node >nul 2>&1
if errorlevel 1 goto webui_sin_node
call node scripts\build_webui.js > "%WEBUI_LOG%" 2>&1
set "WEBUI_RC=%ERRORLEVEL%"
if not "%WEBUI_RC%"=="0" goto webui_fallo
goto webui_ok

:webui_ok
echo [INFO] WebUI empaquetado en WebUI/dist.
goto webui_fin

:webui_sin_node
echo [WARNING] node no esta en el PATH: el WebUI se incrusta SIN empaquetar.
echo           El keybed compartido y fitStage llevan bare imports de
echo           @abdsynths/midi-keyb que solo resuelven con node, asi que el
echo           WebView2 los pedira y recibira un 404. Ningun error aparecera
rem           en el host: el plugin sale compilado y sin teclado.
goto webui_fin

:webui_fallo
rem El codigo se captura ANTES de volcar la bitacora: `type`, `findstr` y `echo`
rem dejan ERRORLEVEL a 0, y leerlo despues hacia que el mensaje dijera
rem "(codigo 0)" en pleno fallo, que es el aviso afirmando que no hay fallo.
type "%WEBUI_LOG%"
echo.
echo [ERROR] El empaquetado del WebUI fallo ^(codigo %WEBUI_RC%^).
echo         El binario incrustara el arbol CRUDO: el keybed compartido y el
echo         fitStage NO montaran, y no habra ningun error visible en el host.
call :por_que_fallo_webui "%WEBUI_LOG%"
goto webui_fin

:webui_fin

echo [INFO] Configuring CMake...
"%CMAKE_PATH%" -S . -B "%BUILD_DIR%" -G "Visual Studio 18 2026" -A x64 -DCMAKE_SYSTEM_VERSION=10.0.26100.0 -D DEEP_TARGET_MODEL=%MODEL%
if not errorlevel 1 goto cmake_configurado
rem El aviso dice que SE VA a limpiar y reintentar: si solo dijera "failed", el
rem silencio que viene detras parece un cuelgue de varios minutos.
echo [WARNING] CMake configuration failed. Clearing CMakeCache.txt and retrying...
if exist "%BUILD_DIR%\CMakeCache.txt" del /q "%BUILD_DIR%\CMakeCache.txt"
if exist "%BUILD_DIR%\CMakeFiles" rmdir /s /q "%BUILD_DIR%\CMakeFiles"
"%CMAKE_PATH%" -S . -B "%BUILD_DIR%" -G "Visual Studio 18 2026" -A x64 -DCMAKE_SYSTEM_VERSION=10.0.26100.0 -D DEEP_TARGET_MODEL=%MODEL%
if not errorlevel 1 goto cmake_configurado
echo [ERROR] CMake configuration failed again with code %ERRORLEVEL%
goto error
:cmake_configurado

echo [INFO] Building VST3 and Standalone...
"%CMAKE_PATH%" --build "%BUILD_DIR%" --config Release --parallel
if not errorlevel 1 goto compilado
echo [ERROR] Build failed with code %ERRORLEVEL%
goto error
:compilado

echo [SUCCESS] %MODEL_NAME% built successfully.
echo.
goto wasm_inicio

rem --- WASM: tres vias, y la pregunta es la ULTIMA ----------------------------
rem El argumento 3 gana al entorno porque es lo que ha escrito quien lanza el
rem build; la variable es lo que ha dejado el runner, y puede estar puesta para
rem toda la maquina. Si se invirtiera, un ABDEEP_WASM=yes de la maquina pisaria
rem el `no` explicito de quien lanza y no habria forma de saltarse el WASM.
rem
rem El `choice` se CONSERVA: sin supervision hay alguien delante, y esa pregunta
rem es la que compilaba el WASM sin que nadie lo pidiera. Lo que se arreglo es
rem que la via desatendida no se cuelgue, no que desaparezca la pregunta.
:wasm_inicio
set "WASM_DECISION=%~3"
if defined WASM_DECISION goto wasm_por_argumento
if not defined ABDEEP_WASM goto wasm_pregunta
set "WASM_DECISION=%ABDEEP_WASM%"
set "WASM_COMO=decidido por la variable ABDEEP_WASM"
goto wasm_evalua

:wasm_por_argumento
set "WASM_COMO=decidido por el tercer argumento"
goto wasm_evalua

:wasm_pregunta
choice /C SN /N /M "Do you want to compile WebAssembly (WASM) as well? [S=Yes, N=No] "
if errorlevel 2 goto wasm_pregunta_no
if errorlevel 1 goto wasm_pregunta_si
rem choice ha salido sin contestar: no hay consola y el codigo es 255. Medido,
rem y no se puede reproducir el cuelgue de la consola pegada desde un test, pero
rem si se puede decidir que sin respuesta no se compila.
set "WASM_DECISION=N"
set "WASM_COMO=contestado en la pregunta"
goto wasm_evalua

:wasm_pregunta_si
set "WASM_DECISION=S"
set "WASM_COMO=contestado en la pregunta"
goto wasm_evalua

:wasm_pregunta_no
set "WASM_DECISION=N"
set "WASM_COMO=contestado en la pregunta"
goto wasm_evalua

:wasm_evalua
rem Quitar comillas: `set ABDEEP_WASM="no"` llega con las suyas puestas.
set "WASM_DECISION=%WASM_DECISION:"=%"
set "WASM_HAY_WASM="
if /i "%WASM_DECISION%"=="S" set "WASM_HAY_WASM=1"
if /i "%WASM_DECISION%"=="SI" set "WASM_HAY_WASM=1"
if /i "%WASM_DECISION%"=="YES" set "WASM_HAY_WASM=1"
if /i "%WASM_DECISION%"=="Y" set "WASM_HAY_WASM=1"
if /i "%WASM_DECISION%"=="1" set "WASM_HAY_WASM=1"
if /i "%WASM_DECISION%"=="N" goto wasm_no_compila
if /i "%WASM_DECISION%"=="NO" goto wasm_no_compila
if /i "%WASM_DECISION%"=="0" goto wasm_no_compila
rem Un valor que no se reconoce NO se trata como un "no": seria un fallo
rem silencioso de manual, el WASM se saltaria y el log acabaria en [SUCCESS]
rem como si se hubiera compilado todo. Sale por un camino propio, con codigo 2,
rem porque la parte de MSBuild ya habia ido bien y un runner tiene que poder
rem distinguir "no compilaba" de "lo invocaron mal".
if not defined WASM_HAY_WASM goto wasm_valor_malo
echo WASM: si, !WASM_COMO!
goto wasm_lanza

:wasm_no_compila
echo WASM: no, !WASM_COMO!
goto wasm_fin

:wasm_valor_malo
echo [ERROR] No se sabe si hay que compilar el WASM: "!WASM_DECISION!",
echo         Para decir que si:  S  si  yes  y  1
echo         Para decir que no:  N  no  0
goto error_uso

:wasm_lanza
echo.
echo ========================================
echo  Launching WASM build...
echo ========================================
call .\wasm\build_wasm.bat
set "WASM_RC=%ERRORLEVEL%"
if "%WASM_RC%"=="0" goto wasm_fin
echo [ERROR] El WASM fallo con el codigo %WASM_RC%.
goto error

:wasm_fin
exit /b 0

rem --- El cierre del uso incorrecto, que NO es un fallo de compilacion --------
rem La parte de MSBuild ya habia ido bien: un runner tiene que poder distinguir
rem "se ha invocado mal el script" de "no ha compilado", y por eso sale con 2.
:error_uso
echo.
echo [ERROR] build.bat no puede seguir con estos argumentos.
echo         Uso: build.bat [modelo] [directorio] [wasm]
echo           modelo      0 MIDI Controller, 1 Classic, 2 Enhanced
rem           directorio  carpeta de salida, por defecto build
echo           wasm        S/yes/1 o N/no/0, o se pregunta
exit /b 2

rem --- Un solo fallo terminal --------------------------------------------------
rem Si cada error imprimiera su propio cierre, el final del log dejaria de
rem significar "se acabo". Todos los caminos caen aqui.
:error
echo.
echo [ERROR] Build failed.
exit /b 1

rem ---------------------------------------------------------------------------
rem Por que fallo: el empaquetado del WebUI se ha llevado ya dos causas
rem distintas, y las dos tardan una sesion entera en reconocer porque el error
rem habla de un sitio que no es este repo. Se despiden por findstr sobre la
rem bitacora, que es lo unico que hay.
:por_que_fallo_webui
findstr /C:"EPERM" /C:"operation not permitted" /C:"EACCES" /C:"ACCESS_DENIED" "%~1" >nul 2>&1
if not errorlevel 1 goto webui_permis
findstr /C:"Cannot find package" /C:"ERR_MODULE_NOT_FOUND" /C:"Cannot find module" "%~1" >nul 2>&1
if not errorlevel 1 goto webui_dependencias
echo.
echo         Causa no reconocida. Vuelca la bitacora entera y mira el PRIMERO
echo         de los errores:  type "%~1"
goto webui_fin_sub

:webui_permis
echo.
echo         CAUSA: sin permiso para leer ficheros de FUERA del proyecto.
echo                 pnpm guarda sus dependencias en
echo                 C:\Users\<quien>\AppData\Local\pnpm, y una consola
echo                 lanzada como Administrador no puede leer esa carpeta. El
echo                 error que aparece arriba habla de un .mjs del store y no
echo                 tiene nada que ver con este repositorio.
echo         ARREGLO: relanza esta compilacion desde una consola de Windows
echo                 normal, SIN elevacion, desde la carpeta del proyecto.
goto webui_fin_sub

:webui_dependencias
echo.
echo         CAUSA: faltan dependencias. Ejecuta "pnpm install" o
echo                 "pnpm install --force" y vuelve a compilar.
goto webui_fin_sub

:webui_fin_sub
exit /b 0
