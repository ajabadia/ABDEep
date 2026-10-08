/**
 * buildToolchainDiagnostic.test.js — los OTROS diagnósticos de build.bat.
 *
 * `buildWebUiFailureDiagnostic.test.js` fija el aviso del empaquetado del WebUI.
 * Aquí va lo mismo para el resto de fallos del script, que hasta ahora no
 * tenía ni un test: el más caro de todos es el primero.
 *
 * POR QUÉ LA DETECCIÓN DE VISUAL STUDIO ES EL MÁS CARO
 *
 * El script pedía la ruta de Visual Studio con `18\Community` escrita a fuego.
 * Eso solo funciona en la máquina de quien lo escribió. En cualquier otra falla,
 * y falla de la forma más fea posible: sin toolchain, cmake no aparece, y el
 * script dice "CMake not found" señalando un fichero que sí existe pero en otra
 * carpeta. El mensaje culpa al fichero equivocado, que es peor que no tener
 * mensaje.
 *
 * Los tres diagnósticos de aquí, en orden de coste:
 *
 *   1. No hay Visual Studio con compilador.   -> el resto no se puede ejecutar.
 *   2. Hay Visual Studio pero no hay CMake.   -> se puede instalar, es rápido.
 *   3. CMake falla al configurar o al compilar -> ya se ha llegado muy lejos.
 *
 * En los tres, lo que se pierde no es el build: es la SESIÓN. Sin un mensaje que
 * diga qué falta, la Reproducción empieza por "¿por qué cmake no aparece?", y
 * acaba una hora después en un instalador de Visual Studio.
 *
 * DOS CAPAS, Y POR QUÉ NO UNA
 *
 * `webui-ci.yml` corre en ubuntu-latest: `cmd.exe` no existe ahí, así que un test
 * que solo ejecute build.bat no se ejecutaría en CI, que es justo donde hace
 * falta que alguien lo lea. De ahí que haya texto e invariantes estructurales
 * (portables, se comprueban en todas partes) y una ejecución real que solo corre
 * en Windows, en el job `bundle-in-binary` de `webui-bundle-ci.yml`. El guard de
 * que ese job existe está al final, y es lo que impide que esto vuelva a ser
 * una capa que nadie ejecuta.
 *
 * LO QUE SE PIERDE SI ALGUIEN ROMPE ESTOS TEXTOS
 *
 * Son texto, no lógica: nada más los protege. Y hay un fallo YA MEDIDO que lo
 * demuestra, y que está arreglado en build.bat: el mensaje de CMake ausente
 * decía "[ERROR] CMake not found at " seguido de nada. `for %%C in (cmake.exe) do
 * set "CMAKE_PATH=%%~$PATH:C"` devuelve VACIO cuando el fichero no está en el
 * PATH, y el `set` deja la variable vacía: el mensaje señalaba el aire, justo en
 * el caso para el que existe. El test de abajo es el que lo habría parado.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { exigirEjecucionEnWindows } from './helpers/ejecucionEnWindows.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BAT = fs.readFileSync(path.join(ROOT, 'build.bat'), 'latin1');

const ES_WINDOWS = process.platform === 'win32';

/** Este mismo fichero. El guard de mas abajo busca quien lo EJECUTA. */
const WEBSITE = 'WebUI/tests/buildToolchainDiagnostic.test.js';

/** cmd.exe por ruta ABSOLUTA: una de las sondas deja el PATH vacío a proposito. */
const CMD = path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'cmd.exe');

/**
 * Extrae un bloque de build.bat entre dos anclas, INCLUYENDAS.
 *
 * Las anclas se comprueban: si build.bat cambia de forma, el mensaje lo dice en
 * vez de devolver un bloque a medias que luego falla por otro motivo. Un
 * `slice` a pelo sobre el fichero entero daría cualquier otra cosa.
 */
function bloque(desde, hasta) {
  const i = BAT.indexOf(desde);
  expect(i, `build.bat ya no empieza el bloque por: ${desde}`).toBeGreaterThan(-1);
  const j = BAT.indexOf(hasta, i);
  expect(j, `build.bat ya no termina el bloque por: ${hasta}`).toBeGreaterThan(i);
  return BAT.slice(i, j + hasta.length);
}

// ---------------------------------------------------------------- texto ----

describe('build.bat — deteccion de Visual Studio', () => {
  it('sin toolchain el mensaje dice que falta y que hay que instalar', () => {
    // Las cuatro lineas, enteras. Un "Build failed" generico aqui obliga a
    // abrir el instalador de Visual Studio a ciegas.
    expect(BAT).toContain('echo [ERROR] No Visual Studio with the C++ compiler on this machine.');
    expect(BAT).toContain('echo         vcvarsall.bat is missing, and that is the one thing that');
    expect(BAT).toContain('echo         tells us there is a toolchain at all.');
    expect(BAT).toContain('echo         Install the "Desktop development with C++" workload.');
  });

  it('la deteccion se PREGUNTA, y el mensaje de exito dice cual ha elegido', () => {
    // Preguntar a vswhere es lo que hace portable el script. Si esto vuelve a
    // una ruta fija, el mensaje de error de arriba deja de ser cierto y el
    // fallo reaparece en cualquier maquina que no sea la de quien lo escribio.
    expect(BAT).toContain('set "VSWHERE=%PF86%\\Microsoft Visual Studio\\Installer\\vswhere.exe"');
    expect(BAT).toContain('if exist "%VSWHERE%" "%VSWHERE%" -all -prerelease -products * -property installationPath');
    // Y sin toolchain, que se diga cual se ha cogido: la ruta cambia entre
    // maquinas y sin esto no hay forma de saber a cual corresponde el error.
    expect(BAT).toContain('echo [INFO] Visual Studio: %VS_ROOT%');
  });

  it('lo que decide es vcvarsall.bat, no la carpeta de Visual Studio', () => {
    // El criterio es el fichero que hace falta para tener compilador, no el
    // directorio. Una version que compruebe la carpeta acepta una instalacion
    // sin el workload de C++ y vuelve al mismo fallo por el camino largo.
    const bloqueVs = bloque(
      String.raw`set "PF86=%ProgramFiles(x86)%"`,
      String.raw`call "%VC_VARS%" x64`,
    );
    const comprobaciones = bloqueVs.split('\n').filter((l) => l.includes('if exist') && !/^\s*rem\b/.test(l));
    expect(comprobaciones.length).toBeGreaterThan(0);
    for (const l of comprobaciones) {
      // Las unicas excepciones son vswhere.exe (que se busca a proposito) y el
      // fichero de lista que genera.
      if (l.includes('VSWHERE') || l.includes('VS_LIST')) continue;
      expect(l, `esta comprobacion no mira vcvarsall.bat: ${l}`).toContain('vcvarsall.bat');
    }
    expect(bloqueVs).toContain(String.raw`if not defined VS_ROOT if exist "%%~I\VC\Auxiliary\Build\vcvarsall.bat" set "VS_ROOT=%%~I"`);
  });

  it('%ProgramFiles(x86)% se resuelve UNA vez, y fuera de todo bloque', () => {
    // La trampa que el propio script documenta en su cabecera: la variable
    // tiene PARENTESIS. Puesta dentro de un `for` o de un `if ( ... )`, cmd
    // descuadra el parser y el error sale dos lineas mas abajo blamesando un
    // "vswhere.exe" o un "\Microsoft" que no tienen nada que ver. Por eso se
    // asigna a PF86 una vez y de ahi en adelante solo se usa PF86.
    const lineas = BAT.split('\n');
    const directas = lineas.filter((l) => l.includes('%ProgramFiles(x86)%') && !/^\s*rem\b/.test(l));
    expect(directas, 'la variable con parentesis se vuelve a usar en algun sitio').toHaveLength(1);
    expect(directas[0]).toBe(String.raw`set "PF86=%ProgramFiles(x86)%"`);

    // Y la asignacion tiene que estar a profundidad cero de parentesis.
    expect(profundidadEn(lineas, lineas.indexOf(directas[0])))
      .toBe(0);
    // Y PF86 tiene que ser lo que se usa despues, o la indireccion no sirve
    // de nada.
    expect(BAT).toContain(String.raw`set "VSWHERE=%PF86%\Microsoft Visual Studio\Installer\vswhere.exe"`);
  });
});

describe('build.bat — diagnosticos de CMake y de la compilacion', () => {
  it('sin cmake el mensaje dice DONDE lo busco y que instalar', () => {
    // ESTE TEXTO TENIA UN FALLO MEDIDO. Decía
    //   [ERROR] CMake not found at %CMAKE_PATH%
    // y con cmake ausente %CMAKE_PATH% llega VACIO: el mensaje imprimia
    // "CMake not found at " y a continuacion nada. Se senalaba el aire, justo en
    // el caso para el que el mensaje existe.
    //
    // La causa era el `for` del PATH, que se come el valor anterior:
    // `%%~$PATH:C` devuelve vacio si el fichero no esta, y el `set` lo escribe
    // igual. Por eso la ruta de la instalacion se guarda ANTES, en su propia
    // variable, y el mensaje la nombra.
    expect(BAT).not.toContain('echo [ERROR] CMake not found at %CMAKE_PATH%');
    expect(BAT).toContain('echo [ERROR] CMake not found.');
    expect(BAT).toContain('echo         Se ha buscado en la instalacion de Visual Studio:');
    expect(BAT).toContain('echo         %CMAKE_EN_VS%');
    expect(BAT).toContain('y tambien en el PATH');

    // Y el ORDEN que lo arregla, que es lo que de verdad importa. Medido: con las
    // dos lineas intercambiadas —copiar ANTES de que CMAKE_PATH exista— el
    // mensaje vuelve a imprimirse vacio, y un test que solo mirara "la copia
    // esta antes que el for" no lo notaria, porque en ese caso tambien lo esta.
    // Lo que no puede pasar es que la copia quede fuera de entre las dos.
    const define = BAT.indexOf(String.raw`set "CMAKE_PATH=%VS_ROOT%\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe"`);
    const copia = BAT.indexOf(String.raw`set "CMAKE_EN_VS=%CMAKE_PATH%"`);
    const pisa = BAT.indexOf('for %%C in (cmake.exe) do set "CMAKE_PATH=%%~$PATH:C"');
    expect(define).toBeGreaterThan(-1);
    expect(copia, 'build.bat ya no guarda la ruta de la instalacion').toBeGreaterThan(-1);
    expect(pisa).toBeGreaterThan(-1);
    expect(define, 'la copia esta ANTES de que CMAKE_PATH exista: se copiaria vacio')
      .toBeLessThan(copia);
    expect(copia, 'la copia esta DESPUES del for que pisa la variable: se copiaria vacio')
      .toBeLessThan(pisa);
  });

  it('el fallo de configurar avisa, limpia la cache y reintenta', () => {
    // El aviso tiene que decir que VA a limpiar y reintentar: si solo dice
    // "failed", el silencio que viene detrás parece un cuelgue.
    expect(BAT).toContain('echo [WARNING] CMake configuration failed. Clearing CMakeCache.txt and retrying...');
    expect(BAT).toContain('if exist "%BUILD_DIR%\\CMakeCache.txt" del /q "%BUILD_DIR%\\CMakeCache.txt"');
    expect(BAT).toContain('if exist "%BUILD_DIR%\\CMakeFiles" rmdir /s /q "%BUILD_DIR%\\CMakeFiles"');

    // Y si el segundo intento tambien falla, que lo diga CON SU CODIGO.
    expect(BAT).toContain('echo [ERROR] CMake configuration failed again with code %ERRORLEVEL%');
    expect(BAT).toContain('echo [ERROR] Build failed with code %ERRORLEVEL%');
  });

  it('ningun mensaje imprime un ERRORLEVEL que alguien haya puesto a 0', () => {
    // La MISMA clase de fallo que el del empaquetado del WebUI, que ya se
    // cometio ahi: `type`, `findstr`, `del` y compañía ponen ERRORLEVEL a 0, asi
    // que leerlo DESPUES de volcar un log hace que el mensaje diga "code 0" en
    // pleno fallo.
    //
    // Es un fallo de ORDEN, no de texto: un comentario no lo evita y por eso se
    // comprueba mirando el hueco que hay entre el comando y el mensaje.
    for (const asunto of [
      {
        que: 'el fallo de configurar por segunda vez',
        comando: String.raw`"%CMAKE_PATH%" -S . -B "%BUILD_DIR%" -G "Visual Studio 18 2026" -A x64 -DCMAKE_SYSTEM_VERSION=10.0.26100.0 -D DEEP_TARGET_MODEL=%MODEL%`,
        mensaje: 'echo [ERROR] CMake configuration failed again with code %ERRORLEVEL%',
      },
      {
        que: 'el fallo de compilacion',
        comando: String.raw`"%CMAKE_PATH%" --build "%BUILD_DIR%" --config Release --parallel`,
        mensaje: 'echo [ERROR] Build failed with code %ERRORLEVEL%',
      },
    ]) {
      const i = BAT.lastIndexOf(asunto.comando, BAT.indexOf(asunto.mensaje));
      expect(i, `${asunto.que}: ya no encuentro este comando`).toBeGreaterThan(-1);
      const entre = BAT.slice(i + asunto.comando.length, BAT.indexOf(asunto.mensaje))
        .split('\n')
        .filter((l) => VOLCAN_ERRORLEVEL.test(l) && !/^\s*rem\b/.test(l));
      expect(entre, `${asunto.que}: entre el comando y el mensaje hay un comando que pone ERRORLEVEL a 0`)
        .toEqual([]);
    }
  });

  it('hay un solo fallo terminal, y todos los caminos llegan a el', () => {
    // `[ERROR] Build failed.` es el cierre del script. Si cada error imprimiera
    // su propio cierre, el final del log dejaria de significar "se acabo".
    const etiqueta = bloque(':error\necho.', 'exit /b 1');
    expect(etiqueta).toBe(':error\necho.\necho [ERROR] Build failed.\nexit /b 1');

    // Los cuatro fallos con nombre tienen que caer en el mismo sitio.
    for (const asunto of [
      'No Visual Studio with the C++ compiler on this machine.',
      '[ERROR] CMake not found.',
      'CMake configuration failed again with code %ERRORLEVEL%',
      'Build failed with code %ERRORLEVEL%',
    ]) {
      const i = BAT.indexOf(asunto);
      expect(i, `build.bat ya no dice: ${asunto}`).toBeGreaterThan(-1);
      const hastaCierre = BAT.slice(i, BAT.indexOf(':error\necho.'));
      expect(hastaCierre, `${asunto} no cae en :error`).toContain('goto error');
    }
  });

  it('Visual Studio se comprueba ANTES que CMake', () => {
    // El orden importa y por lo que dice la cabecera: sin toolchain, cmake
    // tampoco esta, y un script que preguntara por cmake primero acabaria
    // culpando a un fichero que solo falta por falta el compilador.
    const vs = BAT.indexOf('No Visual Studio with the C++ compiler on this machine.');
    const cmake = BAT.indexOf('[ERROR] CMake not found.');
    expect(vs).toBeGreaterThan(-1);
    expect(cmake).toBeGreaterThan(-1);
    expect(vs, 'cmake se pregunta antes que el compilador').toBeLessThan(cmake);
  });

  it('los bloques con rutas van con goto, no con if ( ... )', () => {
    // Por lo mismo que el empaquetado del WebUI: `%TEMP%` y las rutas pueden
    // traer parentesis, y dentro de un `if ( ... )` descuadran el parser de
    // cmd.exe. Un bloque de este estilo revienta con rutas raras, y no en el
    // fallo que se diagnostica sino en otro, que es peor.
    const control = bloque(
      'echo [INFO] Configuring CMake...',
      ':cmake_configurado',
    );
    expect(control).not.toMatch(/^(if|for)\s*\(/m);
    // Y el bloque de cmake tampoco.
    const busca = bloque('rem CMake primero el que trae', ':cmake_ok');
    expect(busca).not.toMatch(/^(if|for)\s*\(/m);
  });

  it('lo que este fichero fija es ASCII puro', () => {
    // cmd.exe lee el .bat en la codificacion del sistema, no en UTF-8: un
    // acento se parte en dos bytes y de ahi sale un comando que no existe. Se
    // comprueba el alcance de ESTE fichero; el de todo el script lo fija el
    // otro test de diagnosticos.
    for (const trozo of [
      bloque('No Visual Studio with the C++ compiler', 'goto error'),
      bloque('[ERROR] CMake not found.', 'goto error'),
      bloque('echo [INFO] Configuring CMake...', ':cmake_configurado'),
    ]) {
      const fuera = [...trozo].filter((c) => c.charCodeAt(0) > 126);
      expect(fuera, `${fuera.length} byte(s) no ASCII: ${fuera.join('')}`).toEqual([]);
    }
  });
});

// --------------------------------------------------------- comportamiento ----

/**
 * Lo que se ejecuta de verdad: bloques de build.bat extraídos del fichero, con
 * las llamadas a cmake sustituidas por un doble. No se reescribe ningún
 * diagnóstico, se copia tal cual — si el texto cambia, este test lo ve, que es
 * justo lo que se quiere fijar.
 *
 * Por qué se extraen bloques y no se ejecuta build.bat entero: porque las
 * decisiones de los bloques NO dependen del disco real. Se apunta
 * `%ProgramFiles%` y `%ProgramFiles(x86)%` a un árbol temporal, que se planta
 * con el caso que cada escenario quiere probar. Es la única forma de que "no
 * hay Visual Studio" se pueda probar en una máquina que sí lo tiene.
 */
describe('build.bat — los diagnosticos, ejecutados', () => {

// MEDIDO con vitest 4.1.11: este bloque lanza procesos hijo por test, y el
// timeout va aqui, en el `describe`, y NO en cada `it`.
//
// No es que estos tests sean lentos: aislado el mas lento de este fichero tarda 306 ms.
// Lo que falla es la contencion. vitest 4 cambio el pool por defecto de `threads`
// a `forks`, asi que 127 ficheros levantan procesos hijo a la vez y compiten por la
// CPU. Medido en la suite completa: un test que tarda 485 ms aislado tardaba 5355
// ms, o sea ~11x.
//
// Por que en el `describe` y no en cada `it`: puesto test a test solo se arregla el
// que fallo. La corrida siguiente saca el hermano, que es el mismo bloque con la
// misma causa. Aqui se cubre el bloque entero de una vez.
//
// 30 s es unas tres veces el peor caso medido con contencion, y sigue siendo un
// fallo rapido si algo se cuelga de verdad. Es la misma convencion que ya usan
// `baselineGuard` (240 s), `ciSubprocessTests` y `recuentoPorRecoleccion` (120 s).
  let temporal = null;

  beforeAll(() => {
    if (!ES_WINDOWS) {return;}
    temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'abdeep-toolchain-'));
  });

  afterAll(() => {
    if (temporal !== null) {fs.rmSync(temporal, {recursive: true, force: true});}
  });

  /** Árbol de Visual Studio falso. `pf` es %ProgramFiles%, `pf86` el de x86. */
  function arbolVs() {
    const base = path.join(temporal, 'vs');
    const pf = path.join(base, 'pf');
    const pf86 = path.join(base, 'pf86');
    // El Installer existe pero VACÍO: no hay vswhere.exe, que es el caso
    // habitual en una máquina donde el instalador de VS no se ha tocado.
    fs.mkdirSync(path.join(pf, 'Microsoft Visual Studio', 'Installer'), {recursive: true});
    fs.mkdirSync(pf86, {recursive: true});
    return {base, pf, pf86};
  }

  function vcvarsallDe(pf) {
    return path.join(pf, 'Microsoft Visual Studio', '18', 'Community', 'VC', 'Auxiliary', 'Build');
  }

  /** El doble de vcvarsall: deja marca para poder afirmar que se ha llamado. */
  function plantarVcvarsall(pf) {
    const dir = vcvarsallDe(pf);
    fs.mkdirSync(dir, {recursive: true});
    const marca = path.join(temporal, 'vcvarsall-marca.txt');
    fs.writeFileSync(path.join(dir, 'vcvarsall.bat'), [
      '@echo off',
      'echo [stub vcvarsall] llamado con %*',
      'echo [marca] >> "%PROBE_MARCA%"',
      'exit /b 0',
      '',
    ].join('\n'), 'latin1');
    return marca;
  }

  /**
   * Fuerza `%ProgramFiles%` y `%ProgramFiles(x86)%` al arbol temporal.
   *
   * MEDIDO, y no era lo que se suponia: cmd.exe vuelve a leer `ProgramFiles`
   * del REGISTRO al arrancar e ignora el valor heredado en el bloque de entorno.
   * Pasarlo por `spawnSync({env})` no hace nada, y el fallback acababa
   * comparando contra `C:\Program Files` de verdad. `ProgramFiles(x86)` si
   * respeta el heredado, que es lo que hace el fallo confuso.
   *
   * Por eso se fuerza con `set` DENTRO del guion: ahi no hay nada que volver a
   * resolver.
   */
  function forzarRaiz({pf, pf86}) {
    return [`set "ProgramFiles=${pf}"`, `set "ProgramFiles(x86)=${pf86}"`];
  }

  /** El bloque de Visual Studio, con la lista redirigida al temporal. */
  function bloqueVs(rutaLista) {
    const real = String.raw`set "VS_LIST=%TEMP%\abdeep-vs.txt"`;
    const b = bloque(String.raw`set "PF86=%ProgramFiles(x86)%"`, String.raw`call "%VC_VARS%" x64`);
    expect(b, 'la linea de VS_LIST ha cambiado de forma').toContain(real);
    return b.replace(real, `set "VS_LIST=${rutaLista}"`);
  }

  /** El doble de cmake: falla un intento y a la segunda va, o falla siempre. */
  function dobleCmake() {
    const ruta = path.join(temporal, 'cmake-stub.bat');
    fs.writeFileSync(ruta, [
      '@echo off',
      'if /i "%ALWAYS_FAIL%"=="1" goto siempre',
      'if exist "%PROBE_MARCA%" goto segunda',
      'echo [stub cmake] intento 1: falla',
      'echo [marca] >> "%PROBE_MARCA%"',
      'exit /b %FAIL_CODE%',
      ':segunda',
      'echo [stub cmake] intento 2: va bien',
      'exit /b 0',
      ':siempre',
      'echo [stub cmake] fallo simulado con codigo %FAIL_CODE%',
      'exit /b %FAIL_CODE%',
      '',
    ].join('\n'), 'latin1');
    return ruta;
  }

  /** Escribe y ejecuta una sonda; devuelve la salida y el código de salida. */
  /** La lista de vswhere, en el temporal y no en el %TEMP% de verdad. */
  function lista() {
    return path.join(temporal, 'vs.txt');
  }

  function correr(nombre, cuerpo, entorno = {}) {
    const guion = [
      '@echo off',
      'rem Sonda generada por WebUI/tests/buildToolchainDiagnostic.test.js.',
      'setlocal enabledelayedexpansion',
      ...cuerpo,
      'exit /b 0',
      '',
      bloque(':error\necho.', 'exit /b 1'),
      '',
    ].join('\n').replace(/\r\n/g, '\n');

    const ruta = path.join(temporal, `${nombre}.bat`);
    fs.writeFileSync(ruta, guion, 'latin1');
    const r = spawnSync(CMD, ['/d', '/c', ruta], {encoding: 'latin1', env: {...process.env, ...entorno}});
    return {salida: `${r.stdout || ''}${r.stderr || ''}`, codigo: r.status};
  }

  it('sin Visual Studio salen las cuatro lineas y el script para con 1', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const {pf, pf86} = arbolVs();
    const {salida, codigo} = correr('sin-vs', [...forzarRaiz({pf, pf86}), bloqueVs(lista())]);

    expect(salida).toContain('No Visual Studio with the C++ compiler on this machine.');
    expect(salida).toContain('vcvarsall.bat is missing, and that is the one thing that');
    expect(salida).toContain('Install the "Desktop development with C++" workload.');
    // Y no culpa a cmake, que es el fallo de la cabecera: sin toolchain, cmake
    // tampoco esta, y echarle la culpa ahi manda a la persona a la carpeta
    // equivocada.
    expect(salida).not.toContain('CMake not found');
    expect(codigo, 'sin toolchain el script tiene que terminar en error').toBe(1);
    // El cierre comun, que es lo que hace que "se acabo" signifique algo.
    expect(salida).toContain('[ERROR] Build failed.');
  });

  it('una carpeta de Visual Studio SIN vcvarsall.bat no cuenta como instalacion', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const {pf, pf86} = arbolVs();
    // Las carpetas del workload existen, el fichero no. Una deteccion que
    // comprobara el directorio daria por buena esta instalacion y el script
    // seguiria hasta fallar mas tarde, por el camino largo.
    fs.mkdirSync(vcvarsallDe(pf), {recursive: true});

    const {salida, codigo} = correr('vs-sin-vcvarsall', [...forzarRaiz({pf, pf86}), bloqueVs(lista())]);

    expect(salida).toContain('No Visual Studio with the C++ compiler on this machine.');
    expect(salida, 'no debe cantar como Visual Studio una carpeta sin vcvarsall')
      .not.toContain('[INFO] Visual Studio:');
    expect(codigo).toBe(1);
  });

  it('con vcvarsall.bat se elige ESE, se lo dice y lo llama', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const {pf, pf86} = arbolVs();
    const marca = plantarVcvarsall(pf);

    const {salida, codigo} = correr('vs-ok', [...forzarRaiz({pf, pf86}), bloqueVs(lista())], {
      PROBE_MARCA: marca,
    });

    // La ruta que se canta es la REAL, que es lo que hace falta saber cuando
    // algo va mal: la de VS cambia de una maquina a otra.
    const esperado = path.join(pf, 'Microsoft Visual Studio', '18', 'Community');
    expect(salida).toContain(`[INFO] Visual Studio: ${esperado}`);
    expect(salida).not.toContain('No Visual Studio');
    expect(codigo).toBe(0);
    // Y no basta con mirar el fichero: tiene que LLAMARLO, que es de donde sale
    // el compilador.
    expect(fs.existsSync(marca), 'vcvarsall.bat no llego a llamarse').toBe(true);
  });

  it('sin cmake en ninguna parte el mensaje nombra donde se busco', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    // PATH a un directorio VACIO: cmake no esta en ninguna parte, que es el
    // caso que el mensaje viejo no aguantaba.
    const pathVacio = path.join(temporal, 'path-vacio');
    fs.mkdirSync(pathVacio, {recursive: true});
    const vsRoot = path.join(temporal, 'vs-root-que-no-existe');

    const {salida, codigo} = correr('sin-cmake', [
      `set "VS_ROOT=${vsRoot}"`,
      bloque('rem CMake primero el que trae', ':cmake_ok'),
    ], {PATH: pathVacio});

    expect(salida).toContain('[ERROR] CMake not found.');
    // ESTA es la asercion que habria parado el fallo medido: la ruta que se
    // nombra no puede estar vacia.
    const nombrada = salida.split('\n').find((l) => l.includes('Common7'));
    expect(nombrada, 'el mensaje no nombra ninguna ruta de la instalacion').toBeTruthy();
    expect(nombrada).toContain(vsRoot);
    // Y no puede quedar el "not found at " a secas.
    expect(salida).not.toMatch(/CMake not found at\s*$/m);
    expect(salida).toContain('[ERROR] Build failed.');
    expect(codigo).toBe(1);
  });

  it('si el configure falla una vez y la segunda va, avisa y sigue', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const buildDir = path.join(temporal, 'build-reintento');
    fs.mkdirSync(path.join(buildDir, 'CMakeFiles'), {recursive: true});
    fs.writeFileSync(path.join(buildDir, 'CMakeCache.txt'), 'cache simulado\n', 'latin1');
    const marca = path.join(temporal, 'cmake-marca.txt');

    const control = bloque('echo [INFO] Configuring CMake...', ':cmake_configurado');
    const real = String.raw`"%CMAKE_PATH%" -S . -B "%BUILD_DIR%" -G "Visual Studio 18 2026" -A x64 -DCMAKE_SYSTEM_VERSION=10.0.26100.0 -D DEEP_TARGET_MODEL=%MODEL%`;
    const veces = control.split(real).length - 1;
    expect(veces, `se esperaban 2 invocaciones de cmake, hay ${veces}`).toBe(2);

    const {salida, codigo} = correr('configure-reintenta-ok', [
      `set "BUILD_DIR=${buildDir}"`,
      'set "MODEL=2"',
      'set "CMAKE_PATH=x"',
      control.split(real).join('call "%PROBE_CMAKE%"'),
    ], {PROBE_CMAKE: dobleCmake(), PROBE_MARCA: marca, FAIL_CODE: '1'});

    // Avisa ANTES de reintentar, que es lo que evita el silencio de cuelgue.
    expect(salida).toContain('Clearing CMakeCache.txt and retrying');
    expect(salida).toContain('[stub cmake] intento 2: va bien');
    // Un reintento que funciona NO es un fallo: no puede quedar un [ERROR].
    expect(salida).not.toContain('[ERROR]');
    expect(salida).not.toContain('failed again');
    expect(codigo).toBe(0);
    // Y la limpieza se hizo de verdad, no solo se anunciaba.
    expect(fs.existsSync(path.join(buildDir, 'CMakeCache.txt')), 'la cache no se borro').toBe(false);
    expect(fs.existsSync(path.join(buildDir, 'CMakeFiles')), 'CMakeFiles no se borro').toBe(false);
  });

  it('si el configure falla dos veces dice el codigo y para', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const buildDir = path.join(temporal, 'build-reintento-falla');
    fs.mkdirSync(buildDir, {recursive: true});

    const control = bloque('echo [INFO] Configuring CMake...', ':cmake_configurado');
    const real = String.raw`"%CMAKE_PATH%" -S . -B "%BUILD_DIR%" -G "Visual Studio 18 2026" -A x64 -DCMAKE_SYSTEM_VERSION=10.0.26100.0 -D DEEP_TARGET_MODEL=%MODEL%`;

    const {salida, codigo} = correr('configure-falla', [
      `set "BUILD_DIR=${buildDir}"`,
      'set "MODEL=2"',
      'set "CMAKE_PATH=x"',
      control.split(real).join('call "%PROBE_CMAKE%"'),
    ], {PROBE_CMAKE: dobleCmake(), ALWAYS_FAIL: '1', FAIL_CODE: '1'});

    // El aviso del primer fallo sigue estando: sin el, el segundo intento es
    // un silencio de varios minutos.
    expect(salida).toContain('Clearing CMakeCache.txt and retrying');
    // Y el codigo REAL, no un 0. Es la misma clase de fallo que el ya
    // corregido del empaquetado: un mensaje que afirma "code 0" en pleno fallo.
    expect(salida).toContain('[ERROR] CMake configuration failed again with code 1');
    expect(salida).not.toContain('code 0');
    expect(salida).toContain('[ERROR] Build failed.');
    expect(codigo).toBe(1);
  });

  it('si la compilacion falla dice el codigo y para', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const real = String.raw`"%CMAKE_PATH%" --build "%BUILD_DIR%" --config Release --parallel`;
    const control = bloque('echo [INFO] Building VST3 and Standalone...', 'echo [SUCCESS] %MODEL_NAME% built successfully.');
    expect(control, 'la invocacion de compilacion ha cambiado de forma').toContain(real);

    const {salida, codigo} = correr('build-falla', [
      `set "BUILD_DIR=${path.join(temporal, 'build-falla')}"`,
      'set "MODEL_NAME=ABD Eep - Enhanced (Expanded Synthesis)"',
      'set "CMAKE_PATH=x"',
      control.replace(real, 'call "%PROBE_CMAKE%"'),
    ], {PROBE_CMAKE: dobleCmake(), ALWAYS_FAIL: '1', FAIL_CODE: '3'});

    expect(salida).toContain('[ERROR] Build failed with code 3');
    expect(salida).toContain('[ERROR] Build failed.');
    expect(salida, 'no puede cantar exito si la compilacion ha fallado').not.toContain('[SUCCESS]');
    expect(codigo).toBe(1);
  });

  it('los caminos se distinguen: no todos los fallos dicen lo mismo', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    // Una batería de diagnosticos que clasifica siempre igual es decorado.
    // Comparar las salidas es lo que lo demuestra.
    const {pf, pf86} = arbolVs();
    const sinVs = correr('distinto-sin-vs', [...forzarRaiz({pf, pf86}), bloqueVs(lista())]).salida;

    const pathVacio = path.join(temporal, 'path-vacio');
    fs.mkdirSync(pathVacio, {recursive: true});
    const sinCmake = correr('distinto-sin-cmake', [
      `set "VS_ROOT=${path.join(temporal, 'vs-root-que-no-existe')}"`,
      bloque('rem CMake primero el que trae', ':cmake_ok'),
    ], {PATH: pathVacio}).salida;

    expect(sinVs).not.toBe(sinCmake);
  });
}, 30000);

// ------------------------------------------------------- el WASM, sin nadie --

/**
 * EL WASM SE PUEDE DECIDIR SIN SUPERVISION
 *
 * `build.bat` acababa en un `choice` que no se podia esquivar. MEDIDO el por que:
 * `choice` lee de la CONSOLA y no de la entrada estandar, asi que
 * `echo N | build.bat` no lo esquivaba. Con una consola pegada —que es lo que
 * pasa con un `start /b`, o con un runner que deja una sesion de consola— el
 * guion se quedaba esperando una tecla que no iba a llegar. Sin consola, en
 * cambio, `choice` imprime la pregunta y sale al instante, que es por lo que un
 * `spawnSync` con tuberías NO reproduce el cuelgue. Las dos cosas se midieron:
 * el cuelgue, en la compilacion real de las 17:06 (el log se quedo en la
 * pregunta y nunca escribio el final); el no-cuelgue, aqui.
 *
 * Por eso lo que se fija con texto es el TEXTO de las tres vias, y lo que
 * se mide es que la via desatendida no pregunta y no se cuelga. El cuelgue en si
 * no es reproducible desde un test, y fingir que si lo seria mentir.
 */
describe('build.bat — el WASM se decide sin supervision', () => {
  it('tres vias, en orden, y el choice es la ultima', () => {
    // El orden ES el contrato: el argumento gana al entorno porque es lo que ha
    // escrito quien ha lanzado, y el entorno es lo que ha dejado el runner. Si
    // se invirtieran, un `ABDEEP_WASM=yes` de la maquina pisaria el `no` que ha
    // puesto el persona que ha lanzado el build, y no habria forma de saberlo.
    const iArg = BAT.indexOf('set "WASM_DECISION=%~3"');
    const iEntorno = BAT.indexOf('if not defined ABDEEP_WASM goto wasm_pregunta');
    const iPregunta = BAT.indexOf(':wasm_pregunta\nchoice /C SN');
    expect(iArg, 'ya no se lee el tercer argumento').toBeGreaterThan(-1);
    expect(iEntorno, 'ya no se lee la variable ABDEEP_WASM').toBeGreaterThan(-1);
    expect(iPregunta, 'ya no hay pregunta interactiva').toBeGreaterThan(-1);
    expect(iArg, 'el entorno se consulta antes del argumento').toBeLessThan(iEntorno);
    expect(iEntorno, 'se pregunta antes de mirar el entorno').toBeLessThan(iPregunta);

    // Y el `choice` se CONSERVA. Sin supervision hay alguien delante, y esa
    // pregunta es la que compila el WASM sin que nadie lo pidiera.
    expect(BAT).toContain('choice /C SN /N /M "Do you want to compile WebAssembly (WASM) as well? [S=Yes, N=No] "');
  });

  it('un valor desconocido PARA, y no se salta el WASM en silencio', () => {
    // La tentacion es tratar lo que no se reconoce como "no", y seria un fallo
    // silencioso de manual: el WASM se saltaria, el guion no pondria nada, y el
    // log acabaria en [SUCCESS] como si se hubiera compilado todo.
    expect(BAT).toContain(':wasm_valor_malo');
    // Y no basta con que la etiqueta exista: lo que importa es que se LLEGA.
    // MEDIDO: con `goto wasm_no` en vez de `goto wasm_valor_malo` la etiqueta
    // seguia ahi y el test de texto pasaba en verde, mientras el WASM se
    // saltaba en silencio. El unico que lo nota es el de comportamiento, y
    // eso es un solo test para un fallo que no se ve.
    expect(BAT).toContain('if not defined WASM_HAY_WASM goto wasm_valor_malo');
    expect(BAT).not.toMatch(/if not defined WASM_HAY_WASM goto wasm_(no|fin|lanza)/);
    expect(BAT).toContain('echo [ERROR] No se sabe si hay que compilar el WASM: "!WASM_DECISION!",');
    expect(BAT).toContain('echo         Para decir que si:  S  si  yes  y  1');
    expect(BAT).toContain('echo         Para decir que no:  N  no  0');
    // Y sale por un camino propio, que NO es "build failed": la parte de MSBuild
    // ya habia ido bien, y un runner tiene que poder distinguir las dos cosas.
    const malo = bloque(':wasm_valor_malo', 'goto error_uso');
    expect(malo).toContain('goto error_uso');
    expect(malo, 'un valor desconocido no puede terminar como si todo bien').not.toContain('goto wasm_fin');
    expect(uso()).toContain('exit /b 2');
  });

  it('TODO goto tiene su etiqueta', () => {
    // UN `goto` sin etiqueta no es un error de compilacion: cmd imprime
    // "El sistema no encontrar la etiqueta por lotes especificada" y sigue, y lo
    // que se rompe es el flujo justo despues. MEDIDO aqui, en el momento de
    // escribir esto: se anadio el `goto wasm_inicio` sin su `:wasm_inicio`, y el
    // guion se caia de la cola del WASM sin que ningun test lo notara.
    //
    // Es de los invariantes que mas caro salen pagando: se comprueba en dos lineas
    // y evita una clase entera de fallo invisible.
    const etiquetas = new Set([...BAT.matchAll(/^:([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]));
    const saltos = [...BAT.matchAll(/^\s*goto\s+:?([A-Za-z_][A-Za-z0-9_]*)/gm)].map((m) => m[1]);
    expect(saltos.length, 'build.bat ya no tiene saltos').toBeGreaterThan(0);
    for (const destino of saltos) {
      // `:eof` es de cmd, no una etiqueta del guion.
      if (destino === 'eof') {continue;}
      expect(etiquetas.has(destino), `goto ${destino} y no hay ninguna etiqueta :${destino}`).toBe(true);
    }
  });

  it('si el WASM falla, el codigo se dice y no se declara exito', () => {
    // Misma clase de fallo que el del empaquetado del WebUI, y que ya se
    // cometio dos veces en este script: leer el ERRORLEVEL DESPUES de un `echo`.
    expect(BAT).toContain('echo [ERROR] El WASM fallo con el codigo %WASM_RC%.');
    const lanza = bloque(':wasm_lanza', ':wasm_fin');
    const iCall = lanza.indexOf('call .\\wasm\\build_wasm.bat');
    const iCaptura = lanza.indexOf('set "WASM_RC=%ERRORLEVEL%"');
    expect(iCall).toBeGreaterThan(-1);
    expect(iCaptura, 'el WASM no captura su propio codigo').toBeGreaterThan(iCall);
    const entre = lanza.slice(iCall + 'call .\\wasm\\build_wasm.bat'.length, iCaptura)
      .split('\n')
      .filter((l) => VOLCAN_ERRORLEVEL.test(l) && !/^\s*rem\b/.test(l));
    expect(entre, 'entre el call y la captura hay un comando que pone ERRORLEVEL a 0').toEqual([]);
    // Y un WASM que falla NO sale por la ruta de las de exito, que es la de
    // "todocompiled".
    expect(lanza).toContain('goto error');
  });

  it('el camino de decision es portable: sin parentesis ni comillas colgando', () => {
    // La entrada es del usuario, que es el tipo de cosa que puede traer
    // parentesis, y dentro de un `if ( ... )` descuadran el parser de cmd.exe.
    const cola = bloque('goto wasm_inicio', 'exit /b 0');
    expect(cola).not.toMatch(/^(if|for)\s+\(/m);
  });
});

/**
 * Lo que se ejecuta: la cola del guion, tal cual, con el `wasm\build_wasm.bat`
 * doblado. No se reescribe ni una linea del bloque — se copia desde build.bat,
 * asi que si el texto cambia, lo que se mide es el texto nuevo.
 *
 * Se mide UNA cosa sobre todo: que la via desatendida NO pregunte. El cuelgue
 * del `choice` con consola pegada no es reproducible desde aqui (ver el
 * comentario del describe de arriba), pero "no pregunto" si, y es la asercion
 * que separa un build.bat para runner de uno que necesita a alguien delante.
 */
describe('build.bat — el WASM sin supervision, ejecutado', () => {

// MEDIDO con vitest 4.1.11: este bloque lanza procesos hijo por test, y el
// timeout va aqui, en el `describe`, y NO en cada `it`.
//
// No es que estos tests sean lentos: aislado el mas lento de este fichero tarda 306 ms.
// Lo que falla es la contencion. vitest 4 cambio el pool por defecto de `threads`
// a `forks`, asi que 127 ficheros levantan procesos hijo a la vez y compiten por la
// CPU. Medido en la suite completa: un test que tarda 485 ms aislado tardaba 5355
// ms, o sea ~11x.
//
// Por que en el `describe` y no en cada `it`: puesto test a test solo se arregla el
// que fallo. La corrida siguiente saca el hermano, que es el mismo bloque con la
// misma causa. Aqui se cubre el bloque entero de una vez.
//
// 30 s es unas tres veces el peor caso medido con contencion, y sigue siendo un
// fallo rapido si algo se cuelga de verdad. Es la misma convencion que ya usan
// `baselineGuard` (240 s), `ciSubprocessTests` y `recuentoPorRecoleccion` (120 s).
  let temporal = null;

  beforeAll(() => {
    if (!ES_WINDOWS) {return;}
    temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'abdeep-wasm-'));
    // El doble del WASM deja marca, que es como se prueba que se LLEGO a
    // llamar y no solo que se dijo que si.
    fs.mkdirSync(path.join(temporal, 'wasm'), {recursive: true});
    fs.writeFileSync(path.join(temporal, 'wasm', 'build_wasm.bat'), [
      '@echo off',
      'echo [stub wasm] llamado',
      'echo [marca] >> "%PROBE_MARCA%"',
      'exit /b %PROBE_WASM_RC%',
      '',
    ].join('\n'), 'latin1');
  });

  afterAll(() => {
    if (temporal !== null) {fs.rmSync(temporal, {recursive: true, force: true});}
  });

  /**
   * Corre la cola del guion. `timeout` no es adorno: sin el, un `choice` colgado
   * dejaría el test colgado en vez de fallar, que es peor.
   */
  function correrCola(args, {entorno = {}, rcWasm = '0'} = {}) {
    const guion = [
      '@echo off',
      'rem Sonda generada por WebUI/tests/buildToolchainDiagnostic.test.js.',
      'setlocal enabledelayedexpansion',
      'goto wasm_inicio',
      bloque(':wasm_inicio', 'exit /b 0'),
      '',
      bloque(':error\necho.', 'exit /b 1'),
      '',
      uso(),
      '',
    ].join('\n');
    const ruta = path.join(temporal, 'cola.bat');
    fs.writeFileSync(ruta, guion, 'latin1');
    const marca = path.join(temporal, `marca-${Math.random().toString(36).slice(2)}.txt`);
    const r = spawnSync(CMD, ['/d', '/c', ruta, ...args], {
      encoding: 'latin1',
      cwd: temporal,
      timeout: 30000,
      env: {...process.env, PROBE_MARCA: marca, PROBE_WASM_RC: rcWasm, ...entorno},
    });
    return {
      salida: `${r.stdout || ''}${r.stderr || ''}`,
      codigo: r.status,
      llamoWasm: fs.existsSync(marca),
    };
  }

  const PREGUNTA = 'Do you want to compile WebAssembly';

  it('el tercer argumento decide y NO se pregunta', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const si = correrCola(['2', 'build', 'yes']);
    expect(si.salida, 'la via desatendida ha preguntado: eso es justo el fallo que se arregla').not.toContain(PREGUNTA);
    expect(si.salida).toContain('WASM: si, decidido por el tercer argumento');
    expect(si.llamoWasm, 'ha dicho que si y no ha llamado al WASM').toBe(true);
    expect(si.codigo).toBe(0);

    const no = correrCola(['2', 'build', 'no']);
    expect(no.salida).not.toContain(PREGUNTA);
    expect(no.salida).toContain('WASM: no, decidido por el tercer argumento');
    expect(no.llamoWasm, 'ha dicho que no y lo ha llamado').toBe(false);
    expect(no.codigo).toBe(0);
  });

  it('ABDEEP_WASM decide cuando no hay tercer argumento', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const {salida, llamoWasm} = correrCola(['2', 'build'], {entorno: {ABDEEP_WASM: 'yes'}});
    expect(salida).not.toContain(PREGUNTA);
    expect(salida).toContain('WASM: si, decidido por la variable ABDEEP_WASM');
    expect(llamoWasm).toBe(true);

    // Con comillas dentro, que es lo que pasa con `set ABDEEP_WASM="yes"`.
    const conComillas = correrCola(['2', 'build'], {entorno: {ABDEEP_WASM: '"no"'}});
    expect(conComillas.salida).not.toContain(PREGUNTA);
    expect(conComillas.salida).toContain('WASM: no, decidido por la variable ABDEEP_WASM');
    expect(conComillas.llamoWasm, 'las comillas han hecho que no se entendiera el valor').toBe(false);
  });

  it('el tercer argumento GANA sobre la variable de entorno', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    // El runner puede dejar ABDEEP_WASM puesto para toda la maquina. Quien
    // lanza el build con un `no` explicito tiene que ganar, o no hay manera de
    // saltarse el WASM sin vaciar el entorno a mano.
    const {salida, llamoWasm} = correrCola(['2', 'build', 'no'], {entorno: {ABDEEP_WASM: 'yes'}});
    expect(salida).not.toContain(PREGUNTA);
    expect(salida).toContain('WASM: no, decidido por el tercer argumento');
    expect(llamoWasm, 'la variable del runner ha pisado el argumento').toBe(false);
  });

  it('un valor desconocido dice que valen y sale con codigo 2', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const {salida, codigo, llamoWasm} = correrCola(['2', 'build', 'quizas']);
    expect(salida).toContain('No se sabe si hay que compilar el WASM: "quizas"');
    expect(salida).toContain('Para decir que si:  S  si  yes  y  1');
    expect(salida).toContain('Para decir que no:  N  no  0');
    // Y lo que NO puede hacer: seguir como si nada.
    expect(salida, 'un valor desconocido no puede imprimirse como un "no"').not.toContain('WASM: no');
    expect(salida, 'ni como un "si"').not.toContain('WASM: si');
    expect(llamoWasm).toBe(false);
    // Codigo propio: la parte de MSBuild ya habia ido bien, y un runner tiene
    // que poder distinguir "no compilaba" de "lo invocaron mal".
    expect(codigo).toBe(2);
    expect(salida).toContain('[ERROR] build.bat no puede seguir con estos argumentos.');
    expect(salida, 'un uso incorrecto no es un fallo de compilacion').not.toContain('[ERROR] Build failed.');
  });

  it('sin decision se PREGUNTA, que es lo que debe seguir pasando', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    // El modo por defecto NO cambia. Si esto dejara de preguntar, se habria
    // roto el build.bat de siempre, que es el que usa la gente a mano.
    const {salida} = correrCola(['2', 'build']);
    expect(salida).toContain(PREGUNTA);
    expect(salida).toContain('WASM: no, contestado en la pregunta');
  });

  it('si el WASM falla, sale en error y con el codigo', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const {salida, codigo} = correrCola(['2', 'build', 'yes'], {rcWasm: '3'});
    expect(salida).toContain('[ERROR] El WASM fallo con el codigo 3.');
    expect(salida).toContain('[ERROR] Build failed.');
    // Y no puede decir que no, que era lo que pasaba: el guion se llamaba y se
    // observable por el codigo de salida, no por lo que decia.
    expect(salida).not.toContain('code 0');
    expect(codigo, 'un WASM que falla tiene que salir distinto de cero').toBe(1);
  });
}, 30000);

// --------------------------------------------------------------- guard ------

describe('build.bat — cobertura de los diagnosticos', () => {
  it('el CI ejecuta estos tests en Windows (en ubuntu se saltan)', () => {
    // La mitad de este fichero necesita cmd.exe, y webui-ci.yml corre en ubuntu,
    // donde se salta con `ctx.skip()`. Sin esto, la capa de texto pasa en todas
    // partes y la de comportamiento no se comprueba en NINGUNA, sin que nada se
    // ponga rojo. El guard vive en un helper compartido para que un tercer
    // fichero de tests de Windows no pueda nacer sin el.
    exigirEjecucionEnWindows(WEBSITE, 'build.bat');
  });

  it('este fichero cubre lo que el otro no cubre', () => {
    // Si alguien fusiona los dos ficheros, o mueve los diagnosticos de aqui al
    // otro, este test avisa en vez de dejar los dos medio vacios. Compara los
    // mensajes que cada uno dice fijar, que es lo unico comparable.
    const otro = fs.readFileSync(
      path.join(ROOT, 'WebUI', 'tests', 'buildWebUiFailureDiagnostic.test.js'),
      'utf8',
    );
    const mensajes = [
      'No Visual Studio with the C++ compiler on this machine.',
      '[ERROR] CMake not found.',
      'CMake configuration failed again with code %ERRORLEVEL%',
      'Build failed with code %ERRORLEVEL%',
    ];
    for (const m of mensajes) {
      expect(BAT, `build.bat ya no dice: ${m}`).toContain(m);
      expect(otro, `el otro fichero ya se hace cargo de: ${m}`).not.toContain(`toContain('${m}`);
    }
  });
});

/** El cierre del uso incorrecto, que NO es un fallo de compilacion. */
function uso() {
  return bloque(':error_uso\necho.', 'exit /b 2');
}

/** Comandos que ponen ERRORLEVEL a 0 aunque el anterior no fuera 0. */
const VOLCAN_ERRORLEVEL = /^\s*(type|findstr|copy|move|del|ren|dir|ver|vol|cls|md|rmdir|rd|attrib|tree|more|sort|fc)\b/i;

/**
 * Profundidad de parentesis en una linea del array, ignorando las lineas `rem`.
 *
 * El motivo de ignorar los `rem` es que su texto puede llevar parentesis sueltos
 * que no abren nada: `if ^( ... ^)` sale en el comentario de la cabecera de
 * build.bat. Las lineas de codigo, en cambio, se miden tal cual.
 */
function profundidadEn(lineas, indice) {
  let profundidad = 0;
  for (let i = 0; i <= indice; i++) {
    const l = lineas[i];
    if (/^\s*rem\b/.test(l)) continue;
    for (const c of l) {
      if (c === '(') profundidad++;
      else if (c === ')') profundidad--;
    }
  }
  return profundidad;
}