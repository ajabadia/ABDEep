/**
 * buildWebUiFailureDiagnostic.test.js — el aviso de fallo del WebUI en build.bat.
 *
 * build.bat empaqueta el WebUI ANTES de configurar CMake, y si ese empaquetado
 * falla el binario NO lleva bundle: se incrusta el árbol CRUDO. Los dos módulos
 * que sí tienen bare imports (`keyboard.js` y `fit-stage.js`) se quedan sin
 * resolver, el keybed compartido no aparece, y no hay ningún error en el host —
 * el WebView2 pide `js/keyboard.js` y recibe un 404 que nadie mira.
 *
 * Por eso ese fallo no puede ser un `[WARNING]` de una línea: es el fallo más
 * caro de todo el build y el más invisible. Este test fija el texto del
 * diagnóstico para que nadie lo degrade sin enterarse.
 *
 * DOS CAPAS, Y POR QUÉ NO UNA
 *
 * `webui-ci.yml` corre en ubuntu-latest: `cmd.exe` no existe ahí, así que un
 * test que solo ejecute build.bat no se ejecutaría en CI, que es justo donde
 * hace falta que alguien lo lea. De ahí que haya texto e invariantes
 * estructurales (portables, se comprueban en todas partes) y una ejecución real
 * que solo corre en Windows, donde está la gente que lo lee.
 *
 * LO QUE SE PIERDE SI ALGUIEN ROMPE ESTE TEXTO
 *
 * El aviso dice qué va a pasar («el árbol CRUDO, el keybed no montará, no habrá
 * error visible en el host») y por qué («EPERM leyendo ficheros de fuera del
 * proyecto»). Si de aquí sale un «build failed» genérico, el síntoma que queda es
 * un plugin sin keybed, un `404` en la consola del WebView2 y una sesión entera
 * buscando en el sitio equivocado. Es texto, no lógica: nada más lo protege.
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
const BUILD_BAT = path.join(ROOT, 'build.bat');
const BAT = fs.readFileSync(BUILD_BAT, 'latin1');

const ES_WINDOWS = process.platform === 'win32';

/** Este mismo fichero. El guard de mas abajo busca quien lo EJECUTA. */
const WEBSITE = 'WebUI/tests/buildWebUiFailureDiagnostic.test.js';

describe('build.bat — diagnóstico del fallo al empaquetar el WebUI', () => {
  it('el bloque existe y va con goto, no con if ( ... )', () => {
    // Por lo mismo que el bloque de CMake más abajo: %TEMP% y las rutas de los
    // fallos pueden traer paréntesis, y dentro de un `if ( … )` descuadran el
    // parser de cmd.exe. Un bloque de este estilo reventaría con rutas raras, y
    // no en un fallo de empaquetado sino en el de otro sitio, que es peor.
    expect(BAT).toContain('rem --- Bundle del WebUI (Vite)');

    // Las etiquetas, no los saltos a ellas: el camino de exito (`:webui_ok`) se
    // alcanza por CAIDA, porque lo unico que hay entre `call node` y esa
    // etiqueta es la ramificacion del fallo. Pedir un `goto webui_ok` seria
    // inventar una linea que el fichero no tiene.
    for (const etiqueta of ['webui_ok', 'webui_sin_node', 'webui_fallo', 'webui_fin',
      'webui_permis', 'webui_dependencias']) {
      expect(BAT, `build.bat ya no tiene la etiqueta :${etiqueta}`).toMatch(new RegExp(`^:${etiqueta}\\s*$`, 'm'));
    }
    for (const salto of ['goto webui_fallo', 'goto webui_fin', 'goto webui_sin_node']) {
      expect(BAT, `build.bat ya no salta a ${salto}`).toContain(salto);
    }

    const desde = BAT.indexOf('rem --- Bundle del WebUI (Vite)');
    const hasta = BAT.indexOf('echo [INFO] Configuring CMake...');
    expect(desde).toBeGreaterThan(-1);
    expect(hasta).toBeGreaterThan(desde);
    const bloque = BAT.slice(desde, hasta);
    // Ninguna llave de nivel superior: todo el control va por goto.
    expect(bloque).not.toMatch(/^(if|for)\s*\(/m);
  });

  it('WEBUI_RC se captura ANTES de volcar la bitácora', () => {
    // ESTE es el fallo que ya se cometió una vez, y por eso está aquí y no solo
    // escrito en un comentario. `type`, `findstr` y `echo` dejan ERRORLEVEL a 0,
    // así que leer el código de salida DESPUÉS de volcar el log hacía que el
    // mensaje dijera `(codigo 0)` en pleno fallo: el aviso del fallo más caro
    // del build affirmaba que no había fallo.
    //
    // Es un fallo de ORDEN, no de texto: un comentario no lo evita, y por eso se
    // comprueba mirando posiciones y no buscando la línea.
    const captura = BAT.indexOf('set "WEBUI_RC=%ERRORLEVEL%"');
    const vuelca = BAT.indexOf('type "%WEBUI_LOG%"');
    const ramifica = BAT.indexOf('if not "%WEBUI_RC%"=="0" goto webui_fallo');
    expect(captura).toBeGreaterThan(-1);
    expect(vuelca).toBeGreaterThan(-1);
    expect(ramifica).toBeGreaterThan(-1);
    expect(captura).toBeLessThan(vuelca);
    expect(captura).toBeLessThan(ramifica);
    expect(BAT).toContain('echo [ERROR] El empaquetado del WebUI fallo ^(codigo %WEBUI_RC%^).');
  });

  it('el texto del diagnóstico: el fallo dice qué pasa, no solo que falló', () => {
    expect(BAT).toContain('El binario incrustara el arbol CRUDO: el keybed compartido y el');
    expect(BAT).toContain('fitStage NO montaran, y no habra ningun error visible en el host.');
  });

  it('las tres causas tienen su mensaje', () => {
    // Una causa sin mensaje es tan inútil como un warning genérico: quien lo lea
    // no tiene por dónde empezar. Las tres ramas tienen que seguir siendo tres.
    expect(BAT).toContain('call :por_que_fallo_webui "%WEBUI_LOG%"');

    // 1. Permisos: el caso habitual, y el que confunde, porque el error habla de
    //    un `.mjs` del store de pnpm, que no tiene nada que ver con este repo.
    expect(BAT).toContain('CAUSA: sin permiso para leer ficheros de FUERA del proyecto.');
    expect(BAT).toContain('ARREGLO: relanza esta compilacion desde una consola de Windows');
    expect(BAT).toContain('/C:"EPERM" /C:"operation not permitted" /C:"EACCES" /C:"ACCESS_DENIED"');

    // 2. Dependencias: un `pnpm install` y a otra cosa.
    expect(BAT).toContain('CAUSA: faltan dependencias. Ejecuta "pnpm install" o');

    // 3. Desconocida: la honestidad de no inventar una causa que no se puede ver.
    expect(BAT).toContain('Causa no reconocida.');
  });

  it('sin node en el PATH avisa de que el keybed no va a montar', () => {
    // Es el otro modo de fallo sin error visible: sin node, el build continúa y
    // el plugin sale sin keybed. El warning tiene que decir qué se pierde.
    expect(BAT).toContain('node no esta en el PATH: el WebUI se incrusta SIN empaquetar.');
    expect(BAT).toContain('@abdsynths/midi-keyb');
  });

  it('build.bat es ASCII puro: cmd.exe lo lee en la codificacion del sistema', () => {
    // Un acento se parte en dos bytes y sale como un comando que no existe, en
    // mitad de una línea que debería ser un `echo`. El síntoma es «un comando
    // recognized es incorrecto» en un sitio que no se parece a un error de
    // build. Comprobarlo aquí es más barato que descubrirlo en una compilación.
    const fueraDeAscii = [...BAT].filter((c) => c.charCodeAt(0) > 126);
    expect(
      fueraDeAscii,
      `build.bat tiene ${fueraDeAscii.length} byte(s) no ASCII: ${fueraDeAscii.join('')}`,
    ).toEqual([]);
  });
});

/**
 * Lo que se ejecuta de verdad: el bloque de build.bat, extraído del fichero, con
 * la llamada a node sustituida por un fallo simulado. No se reescribe el
 * diagnóstico, se copia tal cual —si el texto cambia, este test lo ve, que es
 * justo lo que se quiere fijar.
 *
 * Los tres escenarios, porque las tres ramas tienen que emitir su mensaje:
 * `ok` (no debe decir nada), `permisos` (EPERM) y `deps` (dependencias).
 */
describe('build.bat — el diagnóstico, ejecutado', () => {

// MEDIDO con vitest 4.1.11: este bloque lanza procesos hijo por test, y el
// timeout va aqui, en el `describe`, y NO en cada `it`.
//
// No es que estos tests sean lentos: aislado el mas lento de este fichero tarda 485 ms.
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
    temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'abdeep-buildbat-'));
  });

  afterAll(() => {
    if (temporal !== null) {fs.rmSync(temporal, {recursive: true, force: true});}
  });

  function extraer(desde, hasta) {
    const i = BAT.indexOf(desde);
    expect(i, `build.bat ya no tiene este bloque: ${desde}`).toBeGreaterThan(-1);
    const j = hasta === null ? BAT.length : BAT.indexOf(hasta, i);
    expect(j, `build.bat ya no tiene este bloque: ${hasta ?? 'el final'}`).toBeGreaterThan(i);
    return BAT.slice(i, j);
  }

  /** Monta el .bat de la sonda y lo ejecuta con el escenario pedido. */
  function correr(escenario) {
    const seccion = extraer('rem --- Bundle del WebUI (Vite)', 'echo [INFO] Configuring CMake...');
    const subrutina = extraer('rem ---------------------------------------------------------------------------\nrem Por que fallo', null);

    const llamadaReal = 'call node scripts\\build_webui.js > "%WEBUI_LOG%" 2>&1';
    expect(seccion, 'la llamada a node ha cambiado de forma').toContain(llamadaReal);

    const simulada = [
      'rem SUSTITUIDO POR LA SONDA: aqui no se llama a node.',
      'if /i "%WEBUI_ESCENARIO%"=="deps" (',
      '  (echo   Error: Cannot find package \'postcss\' imported from WebUI) > "%WEBUI_LOG%"',
      '  cmd /c exit /b 1',
      ') else if /i "%WEBUI_ESCENARIO%"=="ok" (',
      '  cmd /c exit /b 0',
      ') else (',
      '  (echo   Error: EPERM: operation not permitted, open \'postcss.mjs\') > "%WEBUI_LOG%"',
      '  cmd /c exit /b 1',
      ')',
    ].join('\n');

    const guion = [
      '@echo off',
      'rem Sonda generada por WebUI/tests/buildWebUiFailureDiagnostic.test.js.',
      'setlocal',
      'if "%WEBUI_ESCENARIO%"=="" set "WEBUI_ESCENARIO=permisos"',
      'set "WEBUI_LOG=%TEMP%\\abdeep-sonda-webui.log"',
      '',
      seccion.replace(llamadaReal, simulada).replace(/\s+$/, ''),
      '',
      'endlocal',
      'exit /b 0',
      '',
      subrutina.replace(/\s+$/, ''),
      '',
    ].join('\n').replace(/\r\n/g, '\n');

    const ruta = path.join(temporal, `sonda-${escenario}.bat`);
    fs.writeFileSync(ruta, guion, 'latin1');
    const r = spawnSync('cmd.exe', ['/d', '/c', ruta], {
      encoding: 'utf8',
      env: {...process.env, WEBUI_ESCENARIO: escenario},
    });
    return `${r.stdout || ''}${r.stderr || ''}`;
  }

  it('con el empaquetado en verde no dice nada', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const salida = correr('ok');
    expect(salida).toContain('WebUI empaquetado en WebUI/dist.');
    expect(salida).not.toContain('[ERROR]');
    expect(salida).not.toContain('CAUSA');
  });

  it('con EPERM dice que es un problema de permisos y no del repo', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const salida = correr('permisos');
    // El codigo de salida REAL, no un 0: el fallo de hoy.
    expect(salida).toContain('(codigo 1)');
    // Y la causa, que es lo que hace falta para no perder la sesion.
    expect(salida).toContain('CAUSA: sin permiso para leer ficheros de FUERA del proyecto.');
    expect(salida).toContain('pnpm');
    expect(salida).not.toContain('Causa no reconocida');
  });

  it('con dependencias ausentes dice que hay que instalar', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    const salida = correr('deps');
    expect(salida).toContain('(codigo 1)');
    expect(salida).toContain('CAUSA: faltan dependencias.');
    expect(salida).toContain('pnpm install');
    expect(salida).not.toContain('sin permiso');
  });

  it('el CI ejecuta estos tests en Windows (en ubuntu se saltan)', () => {
    // ESTA ES LA PARTE QUE NADIE PROTEGIA. La mitad de este fichero necesita
    // cmd.exe, y webui-ci.yml corre en ubuntu, donde se salta con `ctx.skip()`.
    // O sea: la capa de texto pasa en CI, la de comportamiento no se ejecuta en
    // ningun sitio, y el sintoma es que puede faltar media proteccion sin que se
    // note. Un rojo asi solo aparece por casualidad, en un PR que toque build.bat
    // por otra razon.
    //
    // El unico que lo evita es exigir que ALGUN workflow lo EJECUTE de verdad, y
    // que ese workflow se dispare con cambios en build.bat —que es el fichero que
    // estos tests vigilan. Si alguien quita el paso, esto falla; no hace falta
    // acordarse.
    //
    // "Ejecutar" y no "mencionar", y la diferencia es el motivo de que este test
    // sea mas largo de lo que parece. La primera version buscaba el nombre del
    // fichero en cualquier workflow y daba un FALSO POSITIVO: el nombre esta
    // tambien en los filtros `paths`, que son para disparar el workflow, asi que
    // quitar el paso de ejecucion no hacia fallar nada. Un guard satisfecho por
    // una mencion no vigila nada, que es la forma mas comoda de no tener un guard.
    //
    // Por eso se exige que el nombre vaya en la MISMA linea que `vitest`:
    // un filtro de `paths` es `- "WebUI/tests/...test.js"` y no lleva `vitest`
    // delante. Se busca en TODOS los workflows, no en uno fijo: no importa donde
    // viva, importa que exista.
    exigirEjecucionEnWindows(WEBSITE, 'build.bat');
  });

  it('los tres escenarios se distinguen: el diagnóstico no dice siempre lo mismo', (ctx) => {
    if (!ES_WINDOWS) {ctx.skip(); return;}
    // Un diagnóstico que clasifica siempre igual es un decorado, no un
    // diagnóstico. Comparar las tres salidas es lo que lo demuestra.
    const permisos = correr('permisos');
    const deps = correr('deps');
    expect(permisos).not.toBe(deps);
  });
}, 30000);