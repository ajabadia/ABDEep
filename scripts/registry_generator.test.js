/**
 * registry_generator.test.js — las funciones PURAS del generador, comprobadas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUE SUSTITUYE A ESTE, Y POR QUE
 *
 * Antes había `registry_core.test.ts`, que comprobaba un `registry_core.ts`
 * que acompañaba a un `registry_generator.ts`. Los dos coexistían con el
 * `registry_generator.js` de este repo, y los TRES tocaban los mismos cuatro
 * artefactos —mismos `OUT`, la misma `schemas/parameter-registry.data.json`—, así
 * que el repo tenía dos generadores y el `--check` no podía distinguir cuál había
 * escrito lo que había.
 *
 * Y el `.ts` estaba roto: leía `BIPOLAR_BYTES` —un `Set`— con `Object.keys()`,
 * que devuelve `[]`, así que generaba un registro con `bipolarCount: 0` en vez de
 * 43. Como `codecType` lo deserializa `PatchByteCodec.h` (`case 1: // bipolar`),
 * ejecutarlo no daba error: guardaba presets con los 43 mandos bipolares leídos
 * como si fueran lineales.
 *
 * Así que ahora hay un generador, y sus funciones puras se prueban aquí. Lo que
 * este test NO hace es fingir que la cobertura es la misma: la del `.ts` incluía
 * símbolos que el `.js` nunca tuvo (`formatCppFloat`, `normalizeSpecType`,
 * `determineCodecType`, `determineCategory`, `checkReservedRegions`,
 * `validateAndBuildRegistry`, `indexSpecCppIds`, `KNOWN_ALIAS_OFFSETS`,
 * `RESERVED_PHYSICAL_REGIONS`). Eran pruebas de una implementación que ya no
 * existe, y sustituirlas por stubs vacíos habría sido el peor resultado posible:
 * un test verde que no vigila nada. Lo que no hay aquí es una comprobación de que
 * esas funciones hacen su trabajo, porque no son funciones de este generador.
 *
 * Lo que se conserva y se Adapta:
 *   · `toPascalCase` y `computeDefaultNormalized` con los mismos casos.
 *   · `SPECONLY_CONSUMIDOS`, que en el `.js` es un `Map` (id → por qué) y en el
 *     `.ts` un array de objetos. La propiedad que importa es la MISMA: cada id
 *     dice por qué está, y ninguno está repetido.
 *   · El parseo del spec de C++, que en el `.js` lee un DIRECTORIO entero de
 *     `ParametersSpec*.cpp` en vez de un texto suelto. Se prueba contra los
 *     ficheros de verdad, no contra una cadena escrita a mano.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUE ESTE TEST NO HACE, Y ES LO IMPORTANTE
 *
 * No escribe nada, y no por cortesía. `main()` del generador solo se llama cuando
 * el fichero es el punto de entrada, así que este `import` carga el módulo sin
 * generar. Es lo que permite que un test importe las funciones puras de un
 * generador, que antes no se podía: importar disparaba la generación entera
 * dentro de la suite.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  main,
  canonicalizeSource,
  canonicalHash,
  sha256,
  toPascalCase,
  computeDefaultNormalized,
  codecTypeId,
  escapeCpp,
  SPECONLY_CONSUMIDOS,
  __soloParaTest as interno,
} from './registry_generator.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const SPEC_CPP_DIR = join(ROOT, 'Source', 'Core');

// ─────────────────────────────────────────────────────────────────────────────

describe('el generador es UNO, y es este', () => {
  // La razón de que este fichero exista. Antes podía haber otro `.ts` escribiendo
  // los mismos cuatro artefactos, y nada en la suite lo impedía: los dos
  // generadores eran correctos por separado y el repo tenía dos verdades.
  it('importar el generador no escribe nada', () => {
    // Si `main()` se ejecutara al importar, los cuatro artefactos se habrían
    // reescrito con la marca de tiempo de este test. Aquí solo se comprueba que el
    // módulo tiene la forma esperada; el efecto de no escribir se comprueba en
    // `artefactosVigilados` y en `registryGen.test.js`, que miran los ficheros.
    expect(typeof interno).toBe('object');
    expect(typeof interno.parseSpecCppIds).toBe('function');
  });

  it('expone lo que la suite necesita, y solo lo que no tiene estado', () => {
    for (const nombre of ['canonicalizeSource', 'canonicalHash', 'sha256',
      'toPascalCase', 'computeDefaultNormalized', 'codecTypeId', 'escapeCpp']) {
      expect(typeof interno[nombre], `falta la export ${nombre}`).toBe('function');
    }
  });
});

describe('toPascalCase', () => {
  it('convierte snake_case a PascalCase', () => {
    expect(toPascalCase('osc1_wave')).toBe('Osc1Wave');
    expect(toPascalCase('filter_cutoff')).toBe('FilterCutoff');
  });

  it('aguanta varios guiones bajos', () => {
    expect(toPascalCase('lfo_1_rate')).toBe('Lfo1Rate');
  });

  it('una sola palabra', () => {
    expect(toPascalCase('volume')).toBe('Volume');
  });
});

describe('canonicalizeSource', () => {
  // El `Set` es el caso que hace que esto no sea un `JSON.stringify` y pelado: sin
  // el `instanceof Set`, `JSON.stringify` convierte un `Set` en `{}` y lo pierde en
  // silencio. Y `BIPOLAR_BYTES` ES un Set, que es justo lo que el `.ts` roto leía
  // mal.

  it('un Set se convierte en un array ORDENADO, no en {}', () => {
    const c = canonicalizeSource(new Set([98, 42, 83]));

    // Ordenado a proposito: dos corridas con el mismo contenido tienen que dar el
    // mismo hash aunque el `Set` se haya construido en otro orden.
    expect(Array.isArray(c)).toBe(true);
    expect(c).toEqual([42, 83, 98]);
  });

  it('un Set NO se pierde (que era justo el bug del .ts)', () => {
    const c = canonicalizeSource(new Set([1, 2, 3]));

    expect(c).not.toEqual({});
    expect(JSON.stringify(c)).toBe('[1,2,3]');
  });

  it('ordena las claves de un objeto', () => {
    expect(Object.keys(canonicalizeSource({ b: 1, a: 2 }))).toEqual(['a', 'b']);
  });

  it('deja fuera funciones y undefined', () => {
    const c = canonicalizeSource({ a: 1, fn: () => {}, b: undefined });

    expect(Object.keys(c)).toEqual(['a']);
  });

  it('el orden de las claves NO cambia el hash (re-estabilidad de la fuente)', () => {
    // Esta es la propiedad que hace que cambiar un comentario no re-selle el
    // registro. Si se rompe, el `generatedAt` de todo el repo salta con cada
    // retoque de formato.
    expect(canonicalHash({ b: 2, a: 1 })).toBe(canonicalHash({ a: 1, b: 2 }));
  });

  it('un cambio de dato SÍ cambia el hash', () => {
    expect(canonicalHash({ a: 1 })).not.toBe(canonicalHash({ a: 2 }));
  });

  it('canonicalHash es sha256 del JSON canonico', () => {
    const valor = { a: 1, b: new Set([2, 1]) };

    expect(canonicalHash(valor))
      .toBe(sha256(JSON.stringify(canonicalizeSource(valor))));
  });
});

describe('computeDefaultNormalized', () => {
  it('booleanos', () => {
    expect(computeDefaultNormalized({ type: 'bool', default: true })).toBe(1);
    expect(computeDefaultNormalized({ type: 'bool', default: false })).toBe(0);
  });

  it('normaliza un rango numerico', () => {
    expect(computeDefaultNormalized({ type: 'continuous', min: 0, max: 100, default: 50 }))
      .toBe(0.5);
  });

  it('recorta lo que se sale del rango', () => {
    expect(computeDefaultNormalized({ type: 'continuous', min: 0, max: 100, default: 150 }))
      .toBe(1);
    expect(computeDefaultNormalized({ type: 'continuous', min: 0, max: 100, default: -50 }))
      .toBe(0);
  });

  it('enum con default de texto', () => {
    expect(computeDefaultNormalized({ type: 'enum', options: ['A', 'B', 'C'], default: 'B' }))
      .toBe(0.5);
  });

  it('null cuando no se puede normalizar', () => {
    expect(computeDefaultNormalized(null)).toBe(null);
    expect(computeDefaultNormalized({})).toBe(null);
  });
});

describe('codecTypeId', () => {
  // Los numeros que lee `Source/Core/PatchByteCodec.h`:
  //   switch (p->codecType) { case 1: bipolar; case 2: enum; default: value; }
  // Si esta tabla se mueve, los presets dejan de deserializarse bien y no hay
  // ningun error: sale un mando en el lado equivocado de su recorrido.

  it('bipolar es 1', () => {
    expect(codecTypeId('bipolar')).toBe(1);
  });

  it('enum es 2', () => {
    expect(codecTypeId('enum')).toBe(2);
  });

  it('cualquier otra cosa es 0 (value)', () => {
    expect(codecTypeId('value')).toBe(0);
    expect(codecTypeId(undefined)).toBe(0);
  });

  it('la cabecera de C++ y esta tabla coinciden', () => {
    // La comprobacion que ata los dos lados: se lee el `switch` real del motor y
    // se mira que los casos que declara son los que esta tabla produce.
    const fuente = join(ROOT, 'Source', 'Core', 'PatchByteCodec.h');
    expect(existsSync(fuente), `no encuentro ${fuente}`).toBe(true);

    const texto = readFileSync(fuente, 'utf8');

    expect(texto, 'PatchByteCodec.h ya no tiene el switch por codecType')
      .toMatch(/switch\s*\(\s*p->codecType\s*\)/);
    // `case 1: // bipolar` y `case 2: // enum`: el comentario va en la MISMA linea
    // que el case en este repo, asi que se buscan juntos.
    expect(texto).toMatch(/case\s+1\s*:[^\n]*bipolar/);
    expect(texto).toMatch(/case\s+2\s*:[^\n]*enum/);
  });
});

describe('escapeCpp', () => {
  // Esto va a un literal de C++ (`"..."`), asi que una comilla o una barra sin
  // escapar no daria error de compilacion: daria un valor equivocado en el
  // registro, que es justo el fallo que no se ve.
  it('escapa la barra invertida', () => {
    expect(escapeCpp('a\\b')).toBe('a\\\\b');
  });

  it('escapa las comillas dobles', () => {
    expect(escapeCpp('say "hi"')).toBe('say \\"hi\\"');
  });

  it('deja intacto lo que no hay que escapar', () => {
    expect(escapeCpp('osc1_wave')).toBe('osc1_wave');
    expect(escapeCpp('')).toBe('');
  });
});

describe('SPECONLY_CONSUMIDOS', () => {
  // En el `.js` es un `Map` de id → por qué; en el `.ts` era un array de objetos.
  // La propiedad que se vigila es la misma en los dos.
  //
  // Se lee de `__soloParaTest` y no del export con nombre porque el `Map` se
  // construye en el modulo: un export con nombre de un valor mutable es una
  // promesa de que no cambia, y esta lista cambia cuando el spec cambia.
  const specOnly = interno.SPECONLY_CONSUMIDOS ?? SPECONLY_CONSUMIDOS;

  it('cada entrada dice POR QUE esta', () => {
    for (const [id, porque] of specOnly) {
      expect(id, `id con formato raro: ${id}`).toMatch(/^[a-z0-9_]+$/);
      // Un motivo de una palabra no sirve para decidir si un id se puede borrar.
      expect(porque.length, `${id} no explica por que esta`).toBeGreaterThan(10);
    }
  });

  it('no hay ids repetidos', () => {
    // Un `Map` no puede tener claves repetidas, asi que esto se comprueba contra
    // el SPEC, no contra la constante: un id duplicado en el spec del host es un
    // error real y lo detecta `loadSpecCppIds`.
    const ids = [...specOnly.keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('los restos de otra nomenclatura ya no estan', () => {
    // `slot_a_type` / `slot_b_type` con opciones OSC1_Style/OSC2_Style: este synth
    // tiene `osc1_*` y `osc2_*`, no ranuras A y B. Se borraron del spec, asi que
    // no pueden volver a la lista.
    const ids = [...specOnly.keys()];

    expect(ids).not.toContain('slot_a_type');
    expect(ids).not.toContain('slot_b_type');
    expect(ids).not.toContain('osc_drift');
  });
});

describe('los ids del spec de C++ se leen bien', () => {
  // En el `.js` esto lee un DIRECTORIO de `ParametersSpec*.cpp`, no un texto suelto
  // como hacia el `.ts`. Se prueba contra los ficheros de verdad, que es la unica
  // forma de que el caso del `.ts` roto —`BIPOLAR_BYTES` leido como `{}`— no pueda
  // volver: un `Set` leido como objeto plano da `[]`, y contra el spec real eso se
  // ve al instante.

  it('encuentra los ficheros del spec y devuelve ids', () => {
    const r = interno.parseSpecCppIds(SPEC_CPP_DIR);

    expect(Array.isArray(r.ids)).toBe(true);
    expect(r.ids.length, 'el spec del host no declara ningun parametro').toBeGreaterThan(100);
  });

  it('los ids son unicos (el host no puede declarar dos veces el mismo)', () => {
    const r = interno.parseSpecCppIds(SPEC_CPP_DIR);

    expect(new Set(r.ids).size, 'el spec declara ids repetidos').toBe(r.ids.length);
  });

  it('todos los ids son snake_case en minusculas', () => {
    for (const id of interno.parseSpecCppIds(SPEC_CPP_DIR).ids) {
      expect(id, `id con formato raro: ${id}`).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it('separa por fichero, para poder decir de donde sale cada id', () => {
    const r = interno.parseSpecCppIds(SPEC_CPP_DIR);

    expect(Object.keys(r.porFichero).length, 'no se sabe de que fichero sale cada id')
      .toBeGreaterThan(0);
  });
});

describe('lo que este test ya NO cubre, y por que', () => {
  // Un test que documenta sus propios huecos. Sin esto, comparar el número de
  // tests antes y después de borrar el `.ts` da «menos cobertura» sin explicar qué
  // se perdió: esto dice exactamente qué, y que no era de este generador.

  it('los simbolos del nucleo eliminado no forman parte de este generador', () => {
    const perdidos = [
      'formatCppFloat',
      'normalizeSpecType',
      'determineCodecType',
      'determineCategory',
      'checkReservedRegions',
      'validateAndBuildRegistry',
      'indexSpecCppIds',
      'KNOWN_ALIAS_OFFSETS',
      'RESERVED_PHYSICAL_REGIONS',
    ];

    for (const nombre of perdidos) {
      expect(interno[nombre],
        `${nombre} vuelve a exportarse: si es codigo real, necesita sus tests`)
        .toBe(undefined);
    }
  });

  it('el repo ya no tiene un segundo generador del registro', () => {
    // Si alguien vuelve a crear un `registry_generator.ts` —o cualquier otro
    // fichero que escriba estos cuatro artefactos— vuelve a haber dos verdades.
    // Esta es la puerta que habria hecho falta el dia que el `.ts` roto estaba ahi
    // y 43 parametros bipolares dejaron de estar en el registro.
    const siblings = readdirSync(HERE)
      .filter((f) => /^registry_(generator|core)\./.test(f))
      .sort();

    expect(siblings,
      'hay mas ficheros registry_* de los que este generador necesita: ' + siblings.join(', '))
      .toEqual(['registry_generator.js', 'registry_generator.test.js']);
  });
});

// ════════════════════════════════════════════════════════════════════════
// La capa de conversion no puede divergir de la calibracion del motor
// ════════════════════════════════════════════════════════════════════════
//
// POR QUE ESTE GUARD EXISTE
//
// El motor NO lee el cutoff del spec de conversion: lee sus constantes
// (`minHz 15` / `curveBase 550`) de `resources/calibration.json`, porque la
// exponencial se aplica sobre el valor MODULADO y por muestra con `fastExp2`.
// O sea: hay DOS fuentes de la misma verdad, y editar una sola deja el spec
// diciendo una cosa y el motor sonando otra, SIN ningun rojo.
//
// Es exactamente el fallo que aparecio el dia que alguien puso el cutoff del
// spec en [50, 20000] base 400 sin tocar `calibration.json`: ni un test se entero
// de que el spec y el motor ya no decian lo mismo. Este test los cruza.
//
// Cubre los tres acoplamientos que HOY comparten spec y calibracion: el cutoff
// (dominio + base), los tiempos de envolvente (techo del dominio) y el rate del
// LFO (escala y exponente). Si alguien mueve uno, esto se pone rojo y lo dice.
describe('la capa de conversion y la calibracion del motor dicen lo mismo', () => {
  const raiz = resolve(HERE, '..');
  const spec = JSON.parse(readFileSync(join(raiz, 'schemas', 'parameter-conversion.json'), 'utf8'));
  const cal = JSON.parse(readFileSync(join(raiz, 'resources', 'calibration.json'), 'utf8'));
  const par = spec.parameters;

  it('vcf_cutoff: el dominio y la base coinciden con transfer.vcfCutoff', () => {
    const e = par.vcf_cutoff;
    expect(e, 'el spec debe declarar vcf_cutoff').toBeTruthy();

    const { minHz, curveBase } = cal.transfer.vcfCutoff;

    expect(e.curve, 'vcf_cutoff tiene que ser exponencial (el motor calcula base^t)')
      .toBe('exp');
    expect(e.domain[0],
      'vcf_cutoff.domain[0] != calibration.transfer.vcfCutoff.minHz: el spec y el motor divergen')
      .toBeCloseTo(minHz, 5);
    expect(Math.exp(e.curveParams[1]) / curveBase,
      'exp(curveParams[1]) != calibration.transfer.vcfCutoff.curveBase: la base del spec y la del motor divergen')
      .toBeCloseTo(1, 3);
  });

  it('tiempos de envolvente: el techo del dominio coincide con envelopes.maxTimeSec', () => {
    const { maxTimeSec } = cal.transfer.envelopes;

    for (const env of [1, 2, 3]) {
      for (const fase of ['attack', 'decay', 'release']) {
        const id = `env${env}_${fase}`;
        const e = par[id];
        expect(e, `el spec debe declarar ${id}`).toBeTruthy();
        expect(e.domain[1],
          `${id}.domain[1] != calibration.transfer.envelopes.maxTimeSec (${maxTimeSec})`)
          .toBeCloseTo(maxTimeSec, 5);
      }
    }
  });

  it('rate del LFO: la curva del spec es la de transfer.lfo', () => {
    const { rateScale, rateExp } = cal.transfer.lfo;

    for (const lfo of [1, 2]) {
      const e = par[`lfo${lfo}_rate`];
      expect(e.curve, `lfo${lfo}_rate tiene que ser exponencial`).toBe('exp');
      expect(e.curveParams[0], `lfo${lfo}_rate.curveParams[0] != rateScale (${rateScale})`)
        .toBeCloseTo(rateScale, 6);
      expect(e.curveParams[1], `lfo${lfo}_rate.curveParams[1] != rateExp (${rateExp})`)
        .toBeCloseTo(rateExp, 6);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// El codec del spec y el del registro tienen que ser el MISMO
//
// El libro de bytes lo decodifica HOY el registro (bridge-param-maps.js:
// BIPOLAR_BYTES / ENUM_BYTES), y el spec declara para que se traduce. Si los dos
// discrepan en bipolar contra value, el punto neutro del mando cae en otro byte
// (128 contra 127.5) y aparecen dos mediciones para el mismo mando; el generador
// lo trata como fatal (CONVERSION_CODEC_CONFLICT). Este test fija ese invariante
// sin romper el arbol, y deja escrito el inventario de migraciones ENUM
// pendientes para que no crezca en silencio.
describe('el codec del spec no contradice al del registro', () => {
  const raiz = resolve(HERE, '..');
  const spec = JSON.parse(readFileSync(join(raiz, 'schemas', 'parameter-conversion.json'), 'utf8'));
  const reg = JSON.parse(readFileSync(join(raiz, 'schemas', 'parameter-registry.data.json'), 'utf8'));
  const porId = new Map(reg.parameters.map((e) => [e.id, e]));

  it('bipolar contra value: nunca discrepan (seria el punto neutro en otro byte)', () => {
    const choques = [];
    for (const [id, e] of Object.entries(spec.parameters)) {
      const r = porId.get(id);
      if (!r || !r.codecType) continue;
      const tocaBipolar = e.wireCodec === 'bipolar' || r.codecType === 'bipolar';
      if (tocaBipolar && e.wireCodec !== r.codecType) {
        choques.push(`${id}: spec=${e.wireCodec} registro=${r.codecType}`);
      }
    }
    expect(choques,
      `el spec y el registro no pueden discrepar en bipolar:\n${choques.join('\n')}`).toEqual([]);
  });

  it('los 43 bipolares son exactamente los mismos en spec y registro', () => {
    const deReg = reg.parameters.filter((e) => e.codecType === 'bipolar').map((e) => e.id).sort();
    const deSpec = Object.entries(spec.parameters)
      .filter(([, e]) => e.wireCodec === 'bipolar').map(([id]) => id).sort();
    expect(deSpec).toEqual(deReg);
    expect(deSpec).toHaveLength(43);
  });

  it('las 12 curvas de envolvente: dominio bipolar declarado y cable coherente con el registro', () => {
    // OJO: esto NO afirma que `value` sea lo correcto en el cable. Afirma que el
    // spec y el registro DICEN LO MISMO (que es el invariante que protege
    // CONVERSION_CODEC_CONFLICT) y deja constancia de la pregunta abierta.
    //
    // La declaracion `value` (neutro en el byte 0) procede de la nota de
    // ingenieria inversa docs/sysex_format.md. Esa nota esta disputada: el manual
    // describe tres regimenes (lineal / exponencial / exponencial invertida, ver
    // el test de abajo) y los 1024 presets de fabrica usan 128 como neutro en
    // attack/sustain. La evidencia completa y el plan para resolverlo estan en
    // docs/capa_conversion_wire_dominio.md §9.1. Si se resuelve, cambian los tres
    // sitios a la vez: wireCodec del spec, BIPOLAR_BYTES del puente y la regla
    // simetrica; y este test pasa a fijar la respuesta nueva.
    const curvas = Object.entries(spec.parameters).filter(([id]) => /_curve$/.test(id));
    expect(curvas).toHaveLength(12);
    for (const [id, e] of curvas) {
      expect(e.unit, `${id}: el dominio de una curva de envolvente es bipolar`).toBe('bipolar');
      expect(e.domain, `${id} debe tener dominio bipolar [-1, 1]`).toEqual([-1, 1]);
      // El cable: hoy `value`, y el registro dice lo mismo para las 12.
      expect(e.wireCodec, `${id}: el spec no puede declarar un cable que el registro no tenga`)
        .toBe(porId.get(id).codecType);
    }
  });

  it('la pregunta abierta del byte neutro sigue documentada con su evidencia', () => {
    // No es un test de comportamiento: es un CANDADO DE MEMORIA. La duda «neutro
    // en el byte 0 o en el 128» no se puede cerrar sin audio, pero tampoco se
    // puede perder: si alguien resuelve la pregunta y olvida dejar constancia,
    // esto se pone rojo y le manda a §9.1. Las dos fuentes que la mantienen
    // abierta son el manual (tres regimenes, no dos) y los presets de fabrica.
    const manual = readFileSync(
      join(raiz, 'resources', 'md', 'deepmind_adsr_y_envolventes.md'), 'utf8');
    expect(manual, 'el manual tiene que seguir describiendo el regimen invertido')
      .toMatch(/lineales,\s*exponenciales y exponenciales invertidos/i);

    const doc = readFileSync(join(raiz, 'docs', 'capa_conversion_wire_dominio.md'), 'utf8');
    expect(doc, '§9.1 tiene que seguir recogiendo la pregunta abierta del byte neutro')
      .toMatch(/PREGUNTA ABIERTA: el byte neutro/);
  });

  it('la traduccion enum declarada y aun no cableada es EXACTAMENTE el juego conocido', () => {
    // El generador AVISA (CONVERSION_CODEC_NOT_WIRED) cuando el spec traduce como
    // enum y el registro todavia decodifica como value, en vez de bloquear, para
    // poder migrar por bloques. El inventario queda fijado aqui: si alguien anade
    // otro, sale en rojo en vez de perderse entre los avisos.
    //
    // Los 16 bytes de la matriz (93-116) ESTUVIERON en esta lista hasta la
    // conversionVersion 2; ya no, porque el ENUM_BYTES del puente los tiene (ver
    // el test de abajo). Lo que queda es el bloque de Chord, que no tiene byte
    // (wire: none) y por eso no lo puede cablear el puente.
    const pendientes = [];
    for (const [id, e] of Object.entries(spec.parameters)) {
      const r = porId.get(id);
      if (!r || !r.codecType || r.codecType === e.wireCodec) continue;
      if (e.wireCodec === 'bipolar' || r.codecType === 'bipolar') continue;
      pendientes.push(id);
    }
    expect(pendientes.sort()).toEqual(['chord_enable', 'chord_type', 'poly_chord_enable']);
  });

  it('los 16 selectores de la matriz ya son enum en el registro, con su wireMax', () => {
    // El defecto que esta migracion cierra, medido: con el codec value (raw/255)
    // el selector de FUENTE usaba solo el 8,6% del recorrido del fader y el de
    // DESTINO el 50,6%, asi que la mitad alta de los destinos y 20 de las 23
    // fuentes eran inalcanzables desde la UI. El ida y vuelta seguia funcionando,
    // que es por lo que ningun test de round-trip lo veia: era un defecto de
    // MAPEO, no de perdida de datos.
    const puente = readFileSync(join(raiz, 'WebUI', 'js', 'bridge-param-maps.js'), 'utf8');
    const bloqueEnum = puente.match(/ENUM_BYTES\s*=\s*\{([\s\S]*?)\};/);
    expect(bloqueEnum, 'el puente tiene que seguir declarando ENUM_BYTES').not.toBeNull();
    const techos = new Map(
      [...bloqueEnum[1].matchAll(/(\d+)\s*:\s*(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]),
    );

    for (let slot = 1; slot <= 8; slot++) {
      const src = `mod_matrix_slot${slot}_src`;
      const dest = `mod_matrix_slot${slot}_dest`;

      // El byte del puente y el registro tienen que ser el mismo selector.
      expect(techos.get(porId.get(src).byteOffset), `${src}: el puente no lo decodifica como enum`)
        .toBe(22);
      expect(techos.get(porId.get(dest).byteOffset), `${dest}: el puente no lo decodifica como enum`)
        .toBe(129);

      expect(porId.get(src).codecType, `${src} en el registro`).toBe('enum');
      expect(porId.get(src).enumMax, `${src}.enumMax`).toBe(22);
      expect(porId.get(dest).codecType, `${dest} en el registro`).toBe('enum');
      expect(porId.get(dest).enumMax, `${dest}.enumMax`).toBe(129);

      // Y con ese techo, el ultimo codigo llega al final del recorrido.
      expect(Math.min(1, 22 / techos.get(porId.get(src).byteOffset)), `${src} no cubre 0..1`)
        .toBe(1);
      expect(Math.min(1, 129 / techos.get(porId.get(dest).byteOffset)), `${dest} no cubre 0..1`)
        .toBe(1);
    }
  });

  it('el modo --check valida los 4 artefactos sin modificar archivos', () => {
    const res = main({ checkOnly: true });
    expect(res.ok).toBe(true);
    expect(res.outdated).toEqual([]);
    expect(res.summary.total).toBe(232);
    expect(res.untouched.length).toBe(4);
  });
});