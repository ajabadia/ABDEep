/**
 * El contrato de efectos no puede desincronizarse del C++.
 *
 *   npx vitest run WebUI/tests/fxContract.test.js
 *
 * QUE ATA ESTE FICHERO, Y POR QUE HACE FALTA
 *
 * Hay cuatro sitios que tienen que coincidir en el MISMO numero de efecto:
 *
 *   1. `Source/DSP/FX/FXSlot_Factory.cpp`  — quien de verdad construye el DSP.
 *   2. `ABDSharedAssets/contracts/fx-effects.json` — el contrato compartido.
 *   3. `WebUI/js/fx_contract.gen.js`       — lo que lee la web.
 *   4. `WebUI/js/components/fx_modal_templates.js` — el desplegable del rack.
 *
 * El 4 era una lista POR SU CUENTA, escrita a mano, y era la que el usuario
 * tenia delante de los ojos: ponia "Ambience" en el id 1 (que la fabrica
 * construye como Hall), "Delay" en el 22 (Deep Verb) y "DecimatorDelay" en el
 * 26 (Chamber), y ofrecia ademas los ids 57-63, que la fabrica NO construye.
 * Ver el ultimo `describe` de este fichero.
 *
 * Con 2, 3 y 4 duplicados a mano, el que se olvida de actualizar gana siempre, y
 * no da ningun error: la etiqueta del desplegable simplemente se equivoca y
 * nadie se entera hasta que alguien con el rack abierto se queja de que el
 * "Ambience" le suena a Hall. Eso ya paso una vez, por eso existen estos tests.
 *
 * Aqui se atan las cuatro:
 *
 *   - el .gen commiteado tiene que ser EXACTAMENTE lo que genera el contrato
 *     compartido (se regenera en memoria y se compara byte a byte, que es lo
 *     mismo que hace `generate_fx_contract.mjs --check` en CI);
 *   - el contrato tiene que estar alineado con la FABRICA de C++, que se lee
 *     del propio `.cpp` y no de una copia;
 *   - `effects_data.js` tiene que DERIVAR los nombres y no tenerlos escritos,
 *     para que no vuelva a colarse una lista a mano por la puerta de atras.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync,
  readFileSync, rmSync, statSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const suiteRoot = resolve(repoRoot, '..');

const CONTRACT = join(suiteRoot, 'ABDSharedAssets', 'contracts', 'fx-effects.json');
const GENERATOR = join(repoRoot, 'scripts', 'generate_fx_contract.mjs');
const FACTORY = join(repoRoot, 'Source', 'DSP', 'FX', 'FXSlot_Factory.cpp');
const GENERATED = join(repoRoot, 'WebUI', 'js', 'fx_contract.gen.js');
const EFFECTS_DATA = join(repoRoot, 'WebUI', 'js', 'effects_data.js');
const INDEX_HTML = join(repoRoot, 'WebUI', 'index.html');
const WORKFLOW = join(repoRoot, '.github', 'workflows', 'fx-contract-generation.yml');

// ── El .gen tal cual lo carga el WebView ────────────────────────────────────

function loadGenerated () {
  const context = { window: null, self: null };
  context.window = context;
  context.self = context;
  vm.createContext(context);

  vm.runInContext(readFileSync(GENERATED, 'utf8'), context, { filename: 'fx_contract.gen.js' });

  return context.FxEffectsContract;
}

const generated = loadGenerated();

/**
 * Las claves de PROCEDENCIA: las que el generador tiene que copiar del
 * contrato tal cual, sin inventar y sin omitir.
 *
 * Se comprueba que la lista no este vacia porque un `for` sobre una lista
 * vacia no falla nunca: si alguien la vacia, el guard deja de mirar y sigue
 * en verde. Ver el aserto que la comprueba.
 */
const CLAVES_DE_PROCEDENCIA = ['generatedFrom'];

/**
 * QUE PROCEDENCIA SE HA PERDIDO O INVENTADO, en texto.
 *
 * Devuelve una lista de problemas, vacia si todo cuadra. Es una FUNCION PURA a
 * proposito —no un `it`— para que este mismo fichero le pueda dar un contrato y
 * un .gen falsos y comprobar que los ve. Un guard que solo se puede evaluar
 * contra los ficheros de verdad no se puede verificar: si un dia dejara de
 * mirar nada, seguiria en verde y nadie lo notaria.
 *
 * La regla, en las dos direcciones, que es lo que la asercion original perdia:
 * lo que el contrato declara, el .gen lo copia; y lo que el contrato NO declara,
 * el .gen no puede aparecer con una. Con la clave ausente en ambos, comparar
 * undefined con undefined era un test que no podia fallar.
 */
function problemasDeProcedencia (ctto, gen) {
  const problemas = [];

  for (const clave of CLAVES_DE_PROCEDENCIA) {
    const delContrato = ctto[clave];
    const delGen = gen[clave];

    if (delContrato === undefined) {
      if (delGen !== undefined) {
        problemas.push(`${clave}: el contrato no lo declara y el .gen se lo ha inventado ("${delGen}")`);
      }
    } else if (delGen !== delContrato) {
      problemas.push(`${clave}: el contrato declara "${delContrato}" y el .gen dice "${delGen}"`);
    }
  }

  return problemas;
}

/** El sha256 de los BYTES del contrato, que es lo que hashea el generador. */
function hashContrato () {
  return createHash('sha256').update(readFileSync(CONTRACT)).digest('hex');
}
const contract = JSON.parse(readFileSync(CONTRACT, 'utf8'));
const effects = contract.effects ?? contract;

// ══════════════════════════════════════════════════════════════════════════

describe('fx_contract.gen.js esta al dia respecto al contrato compartido', () => {
  it('el fichero commiteado es byte a byte lo que genera el script', () => {
    // Es la MISMA comprobacion que hace `generate_fx_contract.mjs --check` en CI,
    // pero en el test: si el contrato cambia y nadie regenera, esto falla aqui
    // tambien, sin depender de que el job de CI se haya ejecutado.
    expect(() => execFileSync(process.execPath, [GENERATOR, '--check'], { cwd: repoRoot }))
      .not.toThrow();
  });

  it('el .gen declara que viene del contrato, para que se sepa de donde', () => {
    expect(generated.source).toBe('ABDSharedAssets/contracts/fx-effects.json');
  });

  it('la procedencia que el .gen declara es la que declara el contrato', () => {
    // ESTA ASERCION ERA VACUA Y AHORA NO. Decia
    //   expect(generated.generatedFrom).toBe(contract.generatedFrom)
    // pero el contrato ya NO trae esa clave, asi que comparaba undefined con
    // undefined y pasaba siempre: un test que no puede fallar.
    //
    // Ahora la regla vive en `problemasDeProcedencia`, en las dos direcciones,
    // y este `it` solo mira que salga vacia. Que la regla sea correcta de verdad
    // —que vea los dos fallos— lo comprueban los tests del final del fichero,
    // que le dan un par de contrato/.gen falsos.
    expect(problemasDeProcedencia(contract, generated)).toEqual([]);
  });

  it('la comprobacion de procedencia mira AL MENOS una clave', () => {
    // Un `for` sobre una lista vacia no falla nunca. Si alguien vacia
    // CLAVES_DE_PROCEDENCIA, el aserto de arriba pasaria con los ficheros que
    // hubiera y no miraria nada: verde y muerto. Esto es lo que le quita la
    // ultima costura al guard para volverse adorno.
    expect(CLAVES_DE_PROCEDENCIA.length).toBeGreaterThan(0);
  });

  it('el .gen tiene la cabecera AUTO-GENERATED y no una lista a mano', () => {
    const header = readFileSync(GENERATED, 'utf8').split('\n').slice(0, 2).join('\n');

    expect(header).toMatch(/AUTO-GENERATED/);
    expect(header).toMatch(/DO NOT EDIT/);
  });

  it('los nombres del .gen coinciden uno a uno con los del contrato', () => {
    // OJO con el orden: el array `effects` del contrato va AGRUPADO POR FAMILIA
    // (bypass, reverb, delay, tape, ...), no ordenado por id. Los ids se saltan
    // de un grupo a otro: al final del array se leen 55, 39, 16, 19, 43, 49,
    // 54, 56. Por eso la comparacion ordena por id antes, y no se asume que
    // `names` siga el orden del array.
    const byId = [...effects].sort((a, b) => a.id - b.id);

    expect(generated.names).toEqual(byId.map((e) => e.name));
  });

  it('el array del contrato esta agrupado por familia, no por id', () => {
    // Se fija a proposito: es la propiedad que hace peligroso indexar el
    // contrato por posicion en vez de por id.
    const ids = effects.map((e) => e.id);
    const sorted = ids.every((id, i) => i === 0 || ids[i - 1] < id);

    expect(sorted, 'si el contrato pasa a estar ordenado por id, este test se puede quitar').toBe(false);
  });

  it('el hash de origen del .gen es el del contrato de verdad', () => {
    // ESTA TAMBIEN ERA DE FORMADO, NO DE VALOR: `toMatch(/^[0-9a-f]{64}$/)`
    // solo comprueba que sean 64 hex, asi que un .gen regenerado de otro
    // contrato con los MISMOS 61 efectos pasaba en verde. El comentario de
    // arriba ya decia lo que hay que comprobar; aqui se comprueba de verdad,
    // hasheando el contrato otra vez.
    expect(generated.sourceHash).toBe(hashContrato());
  });
});

// ══════════════════════════════════════════════════════════════════════════
// EL GUARD VERIFICANDO AL GUARD
// ══════════════════════════════════════════════════════════════════════════
//
// Un guard en verde no prueba que mire. Estos tests le dan a cada guard un caso
// que TIENE que estar roto, y exigen que lo detecte. Si alguno dejara de
// detectar, el fallo sale aqui y no tres meses despues, cuando un contrato
// cambie y nadie se entere.

describe('el guard de procedencia ve los dos fallos', () => {
  it('detecta que el .gen se inventa una procedencia que el contrato no tiene', () => {
    // Este es el fallo que la asercion original no podia ver: comparaba
    // undefined con undefined, asi que un .gen con una procedencia INVENTADA
    // pasaba en verde.
    const problemas = problemasDeProcedencia({}, { generatedFrom: 'inventado.js' });

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/inventado/);
  });

  it('detecta que el .gen se calla una procedencia que el contrato declara', () => {
    // Y el simetrico: el contrato dice de donde sale el .gen y el .gen no lo
    // dice. Sin esto, nadie sabe de donde viene el fichero que lee la web.
    const problemas = problemasDeProcedencia({ generatedFrom: 'FXSlot_Factory.cpp' }, {});

    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/FXSlot_Factory/);
  });

  it('detecta que el .gen se equivoca al copiar la procedencia', () => {
    // El caso que no cubrian los dos anteriores: los dos lados la declaran,
    // pero distinta. Un `toBe` entre los dos lados lo ve; compararlos solo
    // contra "esta o no esta" no.
    const problemas = problemasDeProcedencia(
      { generatedFrom: 'la-fabrica.cpp' },
      { generatedFrom: 'otro-fichero.cpp' }
    );

    expect(problemas).toHaveLength(1);
  });

  it('no inventa problemas cuando los dos lados coinciden', () => {
    // El contrapeso: una funcion que siempre dice "problema" tambien es un
    // guard que no sirve. Tiene que estar callada cuando de verdad cuadra.
    expect(problemasDeProcedencia({}, {})).toEqual([]);
    expect(problemasDeProcedencia({ generatedFrom: 'a.cpp' }, { generatedFrom: 'a.cpp' })).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('el --check del generador detecta un .gen desincronizado', () => {
  /**
   * Monta un arbol de dos repos en un temporal, con el .gen DELIBERADAMENTE
   * desincronizado, y devuelve la raiz.
   *
   * Por que un temporal y no el arbol de verdad: porque el test tiene que
   * comprobar que el `--check` SALTA cuando el .gen esta mal. Con el .gen real,
   * que esta bien, el check pasaria tanto si mira como si no mira: en verde y
   * sin decir nada. Aqui se le da algo roto a proposito y se le exige que lo
   * note.
   *
   * No se toca el repo: el generador se copia, el contrato se copia y el .gen
   * se escribe desde el bueno mas un cambio. Nada fuera del temporal se mueve.
   */
  function arbolConGenDesincronizado () {
    const raiz = mkdtempSync(join(tmpdir(), 'fx-contract-check-'));

    // El generador resuelve el contrato como HERMANO:
    //   resolve(repoRoot, '..', 'ABDSharedAssets', 'contracts', 'fx-effects.json')
    // asi que la estructura de directorios es parte del contrato con el.
    mkdirSync(join(raiz, 'ABDEep', 'scripts'), { recursive: true });
    mkdirSync(join(raiz, 'ABDSharedAssets', 'contracts'), { recursive: true });
    mkdirSync(join(raiz, 'ABDEep', 'WebUI', 'js'), { recursive: true });

    copyFileSync(GENERATOR, join(raiz, 'ABDEep', 'scripts', 'generate_fx_contract.mjs'));
    copyFileSync(CONTRACT, join(raiz, 'ABDSharedAssets', 'contracts', 'fx-effects.json'));

    // El .gen bueno + un byte. Suficiente para que no case, sin tocar el
    // contenido que el generador lee.
    const bueno = readFileSync(GENERATED, 'utf8');
    writeFileSync(join(raiz, 'ABDEep', 'WebUI', 'js', 'fx_contract.gen.js'), bueno + '\n');

    return raiz;
  }

  it('sale con 1 y dice STALE cuando el .gen no coincide', () => {
    const raiz = arbolConGenDesincronizado();

    try {
      const r = spawnSync(process.execPath, ['scripts/generate_fx_contract.mjs', '--check'], {
        cwd: join(raiz, 'ABDEep'),
        encoding: 'utf8'
      });

      expect(r.status, 'el --check tendria que salir con 1').toBe(1);
      expect(r.stderr).toMatch(/STALE/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it('y sale con 0 cuando el .gen SI coincide', () => {
    // El contrapeso del anterior: si el check fallara siempre, el primer test
    // pasaria y el guard no valdria nada. Tiene que ser capaz de decir que si.
    const raiz = mkdtempSync(join(tmpdir(), 'fx-contract-ok-'));

    try {
      mkdirSync(join(raiz, 'ABDEep', 'scripts'), { recursive: true });
      mkdirSync(join(raiz, 'ABDSharedAssets', 'contracts'), { recursive: true });
      mkdirSync(join(raiz, 'ABDEep', 'WebUI', 'js'), { recursive: true });

      copyFileSync(GENERATOR, join(raiz, 'ABDEep', 'scripts', 'generate_fx_contract.mjs'));
      copyFileSync(CONTRACT, join(raiz, 'ABDSharedAssets', 'contracts', 'fx-effects.json'));
      copyFileSync(GENERATED, join(raiz, 'ABDEep', 'WebUI', 'js', 'fx_contract.gen.js'));

      const r = spawnSync(process.execPath, ['scripts/generate_fx_contract.mjs', '--check'], {
        cwd: join(raiz, 'ABDEep'),
        encoding: 'utf8'
      });

      expect(r.status, 'el --check tendria que salir con 0').toBe(0);
      expect(r.stdout).toMatch(/al dia/);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it('el --check NO ESCRIBE el .gen commiteado, ni siquiera con el mismo contenido', () => {
    // ESTE ASERTO NECESITA LA FECHA, NO SOLO EL TEXTO, Y POR ESO.
    //
    // Comparar el contenido antes y despues parece suficiente y no lo es: si el
    // `--check` reescribe el `.gen` con el contenido CORRECTO —que es
    // exactamente lo que haria una "optimizacion" del tipo "si no cuadra, lo
    // arreglo y aviso"—, el texto resultante es IDENTICO al de antes y la
    // comparacion pasa en verde. Se comprobo: esa mutacion deja este test
    // verde, y es justo la que hay que cazar.
    //
    // El sintoma que persigue es el mas dificil de ver de todo este modulo: un
    // guard que se ARREGLA SOLO. El `.gen` queda al dia, el `--check` sale con
    // el codigo que le toca, y el unico rastro es un fichero commiteado que se
    // toco sin motivo. Nada rojo, nada que leer.
    //
    // Por eso se mira `mtimeMs`, que cambia con CUALQUIER escritura, y `size`,
    // que es el segundo testigo por si el sistema de ficheros no resuelve bien
    // el reloj. Se comparan los dos contra si mismos despues del `--check`.
    const antesTexto = readFileSync(GENERATED, 'utf8');
    const antesStat = statSync(GENERATED);

    const r = spawnSync(process.execPath, [GENERATOR, '--check'], {
      cwd: repoRoot,
      encoding: 'utf8'
    });

    expect(r.status).toBe(0);

    const despuesStat = statSync(GENERATED);

    expect(readFileSync(GENERATED, 'utf8'), 'el --check ha MODIFICADO el contenido del .gen commiteado').toBe(antesTexto);
    expect(despuesStat.mtimeMs, 'el --check ha REESCRITO el .gen (mtime cambiado)').toBe(antesStat.mtimeMs);
    expect(despuesStat.size, 'el --check ha reescrito el .gen con otro tamano').toBe(antesStat.size);
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('CI corre este check de verdad, no solo el test', () => {
  it('el workflow del contrato existe', () => {
    // Sin esto, el unico guard es este fichero de test, que no corre en ningun
    // sitio salvo que alguien lo lance a mano. El dia que este test pasara por
    // alto en un CI, el contrato podria desincronizarse sin que nadie se entere
    // hasta que un usuario mire el desplegable y vea mal las etiquetas.
    expect(existsSync(WORKFLOW), `no esta el workflow ${WORKFLOW}`).toBe(true);
  });

  it('el workflow invoca el generador con --check', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');

    // Se busca la invocacion real, no la palabra `--check` suelta: un workflow
    // que menciona el check en un comentario y no lo corre pasaria con un
    // `toContain('--check')`, que es justo el tipo de asercion de forma que
    // este fichero acaba de dejar de usar.
    const invoca = /run:.*generate_fx_contract\.mjs[^\n]*--check/.test(yml);

    expect(invoca, 'el workflow no corre `generate_fx_contract.mjs --check` en ningun paso').toBe(true);
  });

  it('el workflow se dispara en push a main, no solo a mano', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');

    // Solo `workflow_dispatch` seria un guard que nadie tira. Tiene que
    // dispararse solo cuando llega un commit a main.
    const seccionPush = /push:[\s\S]*?branches:[\s\S]*?main/.test(yml);

    expect(seccionPush, 'el workflow no se dispara solo en push a main').toBe(true);
  });

  it('el workflow saca el contrato del repo HERMANO', () => {
    const yml = readFileSync(WORKFLOW, 'utf8');

    // El contrato vive en ABDSharedAssets. Un checkout que no lo traiga hace
    // que el generador salga con su codigo 2 ("no se encuentra el contrato"), que
    // es un fallo de infrastructure y no una prueba de nada.
    expect(yml).toMatch(/repository:\s*ajabadia\/ABDSharedAssets/);
  });

  it('el workflow corre ESTE script, no otro generador', () => {
    // Traba el ultimo cable flojo: que el job existente sea el de este script.
    // Si alguien renombra `generate_fx_contract.mjs`, el paso del workflow se
    // quedaapuntando a un fichero que no existe y el job falla por infraestructura,
    // que es un fallo difícil de leer como "el nombre cambio".
    const yml = readFileSync(WORKFLOW, 'utf8');

    // El nombre sale del propio generador, de como se documenta a si mismo, y
    // no de una constante escrita aqui al lado: si las dos fuentes se
    // separan, este aserto compara el nombre viejo con el viejo y no lo nota.
    const nombre = readFileSync(GENERATOR, 'utf8').match(/scripts\/generate_[a-z_]+\.mjs/);

    expect(nombre, 'el generador ya no se documenta con su propia ruta').not.toBeNull();
    expect(yml).toContain(nombre[0]);
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('el contrato esta alineado con FXSlot_Factory.cpp', () => {
  const factory = readFileSync(FACTORY, 'utf8');

  /**
   * Lee la fabrica y devuelve `id -> clase construida`.
   *
   * NO se puede con un regex suelto, y el intento fallo de la forma mas
   * traicionera posible: la fabrica escribe
   *
   *     case 11: // Flanger
   *         return std::make_unique<FXFlanger>();
   *
   *     case 23: // flangVerb
   *     case 24: // chorusVerb
   *     case 25: // delayVerb
   *         return std::make_unique<FXHybridReverb>(newType);
   *
   * o sea, hay un comentario entre `:` y el `return`, y hay `case` en cascada
   * donde UN solo return sirve a varias etiquetas. Un `/case (\d+):\s*return/`
   * encuentra 47 de 56 ids y deja huecos en 10, 11, 13, 14, 15, 17, 23, 24 y 25
   * — ids que la fabrica construye perfectamente. Peor: como la asercion era
   * "todo lo que construye la fabrica esta en el contrato", un subconjunto la
   * cumple igual y el test pasaba en verde sin comprobar casi nada.
   *
   * Asi que se recorre linea a linea: cada `case N:` se apila, y el siguiente
   * `make_unique<T>` se asigna a TODAS las etiquetas apiladas (que es lo que
   * hace el compilador con la cascada).
   */
  function parseFactory (source) {
    const built = new Map();
    let pending = [];

    for (const line of source.split(/\r?\n/)) {
      const caseMatch = line.match(/^\s*case\s+(\d+)\s*:/);

      if (caseMatch) pending.push(Number(caseMatch[1]));

      // Un `default` cierra la cascada sin construir nada (Bypass).
      if (/^\s*default\s*:/.test(line)) {
        pending = [];
        continue;
      }

      // OJO: no hay `continue` despues del `case`, porque la fabrica escribe las
      // primeras diez en una sola linea — `case 1:  return
      // std::make_unique<FXSimpleReverb>(1);` — y con el `continue` se perdian
      // justo esos, que son los reverbs que este test va a mirar.
      const ctor = line.match(/std::make_unique<\s*(\w+)/);

      if (ctor && pending.length > 0) {
        for (const id of pending) built.set(id, ctor[1]);
        pending = [];
      }
    }

    return built;
  }

  const built = parseFactory(factory);

  it('la fabrica construye exactamente los ids 1..56', () => {
    // El id 0 (Bypass) no pasa por la fabrica: lo resuelve `FXSlot` antes, y la
    // fabrica cae en `default: return nullptr`.
    const ids = [...built.keys()].sort((a, b) => a - b);

    expect(ids).toEqual(Array.from({ length: 56 }, (_, i) => i + 1));
  });

  it('los ids que construye la fabrica son ids que el contrato conoce', () => {
    const known = new Set(effects.map((e) => e.id));
    const orphans = [...built.keys()].filter((id) => ! known.has(id));

    expect(orphans).toEqual([]);
  });

  it('el contrato declara la MISMA clase que construye la fabrica', () => {
    // El contrato llama "engine" a lo que la fabrica construye con prefijo FX.
    // Es la union mas fuerte de las dos: si alguien cambia el id 39 a otro
    // efecto en la fabrica, el nombre de aqui no cuadra y salta.
    const mismatches = [];

    for (const [id, className] of built) {
      const engine = generated.byId[id]?.engine;

      if (engine !== className.replace(/^FX/, '')) {
        mismatches.push(`${id}: fabrica=${className} contrato=${engine}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('los diez reverbs salen en los ids que la fabrica construye', () => {
    // El caso que ya se rompio una vez: la lista de la web ponia los diez
    // reverbs en 1..10, pero la fabrica construye el 22 y el 26-28.
    const factoryReverbs = [...built.entries()]
      .filter(([, className]) => className === 'FXSimpleReverb')
      .map(([id]) => id)
      .sort((a, b) => a - b);

    expect(factoryReverbs).toEqual([1, 2, 3, 4, 5, 6, 22, 26, 27, 28]);

    // Y el contrato los declara en ESOS ids, con la variante correcta.
    for (const id of factoryReverbs) {
      const entry = generated.byId[id];

      expect(entry, `el contrato no conoce el reverb ${id}`).toBeDefined();
      expect(entry.engine).toBe('SimpleReverb');
      expect(entry.variant).toBe(id);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('effects_data.js deriva del contrato y no los escribe', () => {
  const source = readFileSync(EFFECTS_DATA, 'utf8');

  it('no contiene una lista de nombres de efecto escrita a mano', () => {
    // Cualquier array de cadenas de este tamano en este fichero seria una
    // lista de nombres. El patron cubre las dos formas que ha habido: el array
    // plano, y el array partido en lineas por el formateador.
    const bigArray = source.match(/\[[^\]]{200,}\]/s);

    expect(bigArray, 'effects_data.js ha vuelto a escribir la lista de nombres').toBeNull();
  });

  it('no menciona los nombres que solo existian en la lista vieja', () => {
    // Varios de estos eran nombres inventados para la lista y no coinciden con
    // el contrato. Si aparecen aqui, alguien ha pegado la lista otra vez.
    for (const stale of ['HallReverb', 'Plate Reverb', 'Gated Reverb', 'tcDeepVerb']) {
      expect(source, `effects_data.js menciona "${stale}", que viene de la lista vieja`).not.toContain(stale);
    }
  });

  it('expone la lista que se espera, leida del contrato', () => {
    const context = { window: null, self: null };
    context.window = context;
    context.self = context;
    vm.createContext(context);

    vm.runInContext(readFileSync(GENERATED, 'utf8'), context, { filename: 'fx_contract.gen.js' });
    vm.runInContext(source, context, { filename: 'effects_data.js' });

    expect(context.FX_TYPE_NAMES).toEqual(generated.names);
    expect(context.FX_TYPE_NAMES[0]).toBe('Bypass');
    expect(context.FX_TYPE_NAMES[1]).toBe('Hall');
    expect(context.FX_TYPE_NAMES[22]).toBe('Deep Verb');
    expect(context.FX_TYPE_NAMES[26]).toBe('Chamber');
  });

  it('fxTypeName devuelve undefined para un id que no existe, y el nombre si', () => {
    const context = { window: null, self: null };
    context.window = context;
    context.self = context;
    vm.createContext(context);

    vm.runInContext(readFileSync(GENERATED, 'utf8'), context, { filename: 'fx_contract.gen.js' });
    vm.runInContext(source, context, { filename: 'effects_data.js' });

    expect(context.fxTypeName(6)).toBe('Reverse');
    expect(context.fxTypeName(999)).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('index.html carga el contrato antes de derivar de el', () => {
  it('el script del .gen aparece antes que effects_data.js', () => {
    const html = readFileSync(INDEX_HTML, 'utf8');

    const gen = html.indexOf('js/fx_contract.gen.js');
    const data = html.indexOf('js/effects_data.js');

    expect(gen).toBeGreaterThan(-1);
    expect(data).toBeGreaterThan(-1);
    // Si el orden se invierte, effects_data.js no encuentra el contrato y la
    // lista se queda sin definir, que es el fallo silencioso que se quiere evitar.
    expect(gen).toBeLessThan(data);
  });
});

// ══════════════════════════════════════════════════════════════════════════

describe('el desplegable del rack deriva del contrato', () => {
  /**
   * Cuarto sitio que tiene que saber el MISMO numero de efecto que la fabrica.
   *
   * Este era el que quedaba fuera: `fx_modal_templates.js` tenia su PROPIA
   * cadena de `<option>` y su propio objeto de etiquetas, los dos escritos a
   * mano, y los dos desplazados. Ponia "Ambience" en el id 1 (que la fabrica
   * construye como Hall), "tcDeepVerb" en el 2 (Plate), "Delay" en el 22 (Deep
   * Verb) y "DecimatorDelay" en el 26 (Chamber). Ademas ofrecia los ids 57-63,
   * que la fabrica NO construye: se podian elegir y la ranura se quedaba muda.
   *
   * Que ya no quede ninguna lista escrita a mano en ese fichero es la garantia
   * de que esto no se puede volver a desalinear.
   */
  const TEMPLATES = resolve(repoRoot, 'WebUI', 'js', 'components', 'fx_modal_templates.js');

  /** Monta el componente con el contrato cargado, como hace la pagina. */
  function loadTemplates (withContract = true) {
    const context = { window: null, self: null, console: { warn () {} } };
    context.window = context;
    context.self = context;
    vm.createContext(context);

    if (withContract) {
      vm.runInContext(readFileSync(GENERATED, 'utf8'), context, { filename: 'fx_contract.gen.js' });
    }

    vm.runInContext(readFileSync(TEMPLATES, 'utf8'), context, { filename: 'fx_modal_templates.js' });

    return context;
  }

  /** Los pares `[id, etiqueta]` que salen del desplegable montado. */
  function optionsOf (context) {
    return [...context.FX_TYPE_OPTIONS.matchAll(/<option value="(\d+)">([^<]*)<\/option>/g)]
      .map((m) => [Number(m[1]), m[2]]);
  }

  it('no tiene ninguna lista de nombres escrita a mano', () => {
    const source = readFileSync(TEMPLATES, 'utf8');

    // Estas cuatro son etiquetas que solo existian en la lista vieja del
    // desplegable. Si aparecen, alguien ha pegado la lista otra vez.
    for (const stale of ['HallReverb', 'Plate Reverb', 'Gated Reverb', 'tcDeepVerb']) {
      expect(source, `fx_modal_templates.js menciona "${stale}", que viene de la lista vieja`).not.toContain(stale);
    }

    // Y el signo de que se construye de verdad: que se llame al contrato.
    expect(source).toContain('FxEffectsContract');
  });

  it('cada opcion lleva el nombre que tiene el contrato', () => {
    const context = loadTemplates();

    const mismatches = optionsOf(context)
      .filter(([id, label]) => generated.byId[id]?.name !== label)
      .map(([id, label]) => `${id}: desplegable=${label} contrato=${generated.byId[id]?.name}`);

    expect(mismatches).toEqual([]);
  });

  it('ofrece exactamente los ids del contrato, ni uno mas ni uno menos', () => {
    const context = loadTemplates();

    const ids = optionsOf(context).map(([id]) => id);

    // Los 57 del contrato, ordenados y SIN repetir. La lista vieja tinha 64
    // opciones: los ids 57-63 no los construye la fabrica, y elegirlos dejaba la
    // ranura sin efecto sin dar ningun error.
    expect(ids).toEqual(effects.map((e) => e.id).sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('los diez reverbs salen en los ids que construye la fabrica', () => {
    const context = loadTemplates();
    const options = Object.fromEntries(optionsOf(context));

    // El caso que se rompio dos veces: el desplegable ponia los reverbs en
    // 1..10 y luego en otra lista distinta, y la fabrica construye el 22 y el
    // 26-28. Este aserto no deja que vuelvan a deslizarse.
    expect(options[1]).toBe('Hall');
    expect(options[2]).toBe('Plate');
    expect(options[3]).toBe('Rich Plate');
    expect(options[4]).toBe('Ambience');
    expect(options[5]).toBe('Gated');
    expect(options[6]).toBe('Reverse');
    expect(options[22]).toBe('Deep Verb');
    expect(options[26]).toBe('Chamber');
    expect(options[27]).toBe('Room');
    expect(options[28]).toBe('Vintage');
  });

  it('cada id cae en un solo grupo, y los grupos no se solapan', () => {
    const context = loadTemplates();

    const groups = [...context.FX_TYPE_OPTIONS.matchAll(/<optgroup label="[^"]*">(.*?)<\/optgroup>/g)]
      .map((m) => [...m[1].matchAll(/value="(\d+)"/g)].map((v) => Number(v[1])));

    expect(groups.length).toBe(2);
    expect(groups[0]).toEqual(effects.map((e) => e.id).filter((id) => id <= 35).sort((a, b) => a - b));
    expect(groups[1]).toEqual(effects.map((e) => e.id).filter((id) => id > 35).sort((a, b) => a - b));
    // El bug que se metio al arreglar esto: el segundo grupo no tenia `from`, se
    // comia los ids del primero y el desplegable salia con 93 opciones y duplicadas.
    expect(groups[0].filter((id) => groups[1].includes(id))).toEqual([]);
  });

  it('sin contrato avisa y deja el desplegable en Bypass, no en una lista vieja', () => {
    const context = loadTemplates(false);

    expect(optionsOf(context)).toEqual([[0, 'Bypass']]);
    // La plantilla tiene que seguir montando: cuatro ranuras, un desplegable
    // cada una. Un desplegable vacio se ve; una lista vieja equivocada no.
    expect((context.FX_MODAL_TEMPLATE.match(/fx-type-select/g) || []).length).toBe(4);
  });

  it('las etiquetas cortas del rack tambien vienen del contrato', () => {
    const context = loadTemplates();

    expect(context.FX_TYPE_LABELS[1]).toBe('Hall');
    expect(context.FX_TYPE_LABELS[22]).toBe('Deep Verb');
    expect(context.FX_TYPE_LABELS[26]).toBe('Chamber');
    expect(Object.keys(context.FX_TYPE_LABELS).length).toBe(effects.length);
  });

  it('la plantilla no pone un nombre de efecto inventado por defecto', () => {
    const context = loadTemplates();

    // Antes la ranura 1 salia con "Ambience" y la 2 con "VintageRoom" escritos en
    // el HTML, o sea contradiciendo el desplegable que tienen justo encima hasta
    // que el usuario tocaba algo. Ahora arrancan en Bypass, que es la verdad.
    expect(context.FX_MODAL_TEMPLATE).not.toContain('Ambience</div>');
    expect(context.FX_MODAL_TEMPLATE).not.toContain('VintageRoom</div>');
  });
});
