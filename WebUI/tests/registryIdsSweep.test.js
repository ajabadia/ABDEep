/**
 * registryIdsSweep.test.js — Ningún sitio puede escribir un parámetro que no existe
 * ============================================================================
 *
 * Los tres guards del generador (`REGISTRY_ID_NOT_IN_SPEC`, `CC_ID_NOT_IN_SPEC`,
 * `NRPN_COLLISION`) vigilan **el mapa del puente**. No vigilan el resto del árbol, y
 * ahí es donde se acumularon los residuos de los cinco parámetros borrados:
 *
 *   - `script_midi_mappings.js` seguía enseñando `'arp_gate': 'NRPN 1:32 (CC 13)'`
 *     a quien consultara a qué NRPN va cada mando.
 *   - `script_randomizer.js` seguía escribiendo `'osc_drift'`, `'arp_gate'` y
 *     `'osc2_pitch_mod_select'` en cada patch nuevo. Este último escribía el byte 32
 *     de un parámetro que el host no declara: cada patch aleatorio nacía con un byte
 *     que no iba a ningún sitio.
 *   - `WebUI/resources/parameters_spec.json` era un duplicado del spec entero, que
 *     nadie leía pero que seguía conteniendo los `slot_*`.
 *
 * Es el mismo criterio del guard 1, pero sobre el árbol y no sobre el mapa: un
 * parámetro que no existe no puede aparecer en ninguna tabla que declare ids.
 *
 * POR QUÉ UNA LISTA DE TABLAS Y NO UN BARRIDO DE TODO. La primera versión barrió el
 * repo entero buscando cualquier cadena con forma de id, y dio 10 falsos
 * positivos: `patch_dirty`, `midi_channel` y `protect_unsaved_edits` son parámetros
 * INTERNOS del bridge, y `'seq_step_' + (i + 1)` es un id construido por prefijo
 * igual que `"fx" + slot + "_mix"`. Un test que necesita una lista de excepciones
 * para no fallar no se mantiene. Así que este test verifica las tablas que
 * **declaran** ids —esas sí son un contrato— y las lista una a una.
 *
 * Run: npx vitest run tests/registryIdsSweep.test.js
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

/** El registro emitido: la lista de ids que de verdad existen con byte. */
function registryIds() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas', 'parameter-registry.data.json'), 'utf8'));
  return new Set(data.parameters.map((p) => p.id));
}

/** El spec que declara el host (la APVTS), en cinco ficheros de C++. */
function specCppIds() {
  const dir = path.join(ROOT, 'Source', 'Core');
  const re = /\{\s*"([a-z0-9_]+)"\s*,\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*"[a-z]+"/g;
  const ids = new Set();
  for (const f of fs.readdirSync(dir).filter((f) => /^ParametersSpec(_[A-Za-z]+)?\.cpp$/.test(f))) {
    for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(re)) ids.add(m[1]);
  }
  return ids;
}

/**
 * Las tablas del árbol que DECLARAN ids de parámetros, con el patrón que las saca.
 *
 * Añadir aquí una tabla nueva es barato; no añadirla significa que esa tabla
 * puede escribir lo que quiera sin que nadie lo note.
 */
const ID_TABLES = [
  {
    fichero: 'WebUI/js/bridge-param-maps.js',
    re: /['"]([a-z][a-z0-9_]*)['"]\s*:\s*\d+/g,
    que: 'PARAM_TO_BYTE_OFFSET / PARAM_TO_CC / BYTE_OFFSET_TO_PARAM_IDS',
  },
  {
    fichero: 'WebUI/js/script_midi_mappings.js',
    re: /^\s*['"]([a-z][a-z0-9_]*)['"]\s*:\s*['"]NRPN/gm,
    que: 'el mapa de NRPN que consulta el usuario',
  },
  {
    fichero: 'WebUI/js/edit_cache_mapper_data.js',
    re: /param:\s*['"]([a-z][a-z0-9_]*)['"]/g,
    que: 'el mapeo de la caché de edición',
  },
  {
    fichero: 'WebUI/js/script_randomizer.js',
    re: /^\s*['"]([a-z][a-z0-9_]*)['"]\s*:\s*[-0-9.]+/gm,
    que: 'los patches aleatorios',
  },
];

/**
 * Los parámetros INTERNOS del bridge, que no son del sintet y no están en el
 * registro: los escriben a la capa JUCE, no al host. Llevan guion bajo igual que
 * un parámetro de verdad (`patch_dirty` se confundía con uno), así que la forma no
 * basta: hay que nombrarlos.
 *
 * Se listan en vez de deducirse porque son un contrato del bridge, no una regla. Y
 * si alguno se renombra, este test falla diciendo cuál, que es justo lo que tiene que
 * hacer: la lista es la que obliga a actualizar, no una excepción que se cuela.
 */
const BRIDGE_INTERNOS = new Set([
  'patch_dirty',
  'protect_unsaved_edits',
  'midi_channel',
]);

function pareceParametro(id) {
  return /^[a-z][a-z0-9]*_[a-z0-9_]+$/.test(id) && !BRIDGE_INTERNOS.has(id);
}

describe('barrido del árbol — ninguna tabla escribe un parámetro que no existe', () => {
  const known = new Set([...registryIds(), ...specCppIds()]);

  it('el conjunto de referencia no está vacío (si se rompe, el barrido pasa por alto todo)', () => {
    // Un barrido con el conjunto de referencia vacío o minúsculo no comprueba nada,
    // y da verde. Esto es lo que hace que un `[]` accidental no se lea como «todo
    // bien».
    expect(known.size).toBeGreaterThan(200);
    expect(known.has('vcf_cutoff')).toBe(true);
    expect(known.has('arp_velocity_gate')).toBe(true);
  });

  for (const tabla of ID_TABLES) {
    it(`${tabla.fichero} (${tabla.que}) solo declara ids que existen`, () => {
      const ruta = path.join(ROOT, tabla.fichero);
      expect(fs.existsSync(ruta), `${tabla.fichero} no existe — revisa la lista ID_TABLES`).toBe(true);

      const texto = fs.readFileSync(ruta, 'utf8');
      const ids = [...new Set([...texto.matchAll(tabla.re)].map((m) => m[1]))];
      expect(ids.length, `${tabla.fichero} no devolvió ningún id: el patrón está caducado`).toBeGreaterThan(10);

      const inexistentes = ids.filter((id) => pareceParametro(id) && !known.has(id));
      expect(
        inexistentes,
        `${tabla.fichero} escribe estos ids que no están ni en el registro ni en el spec: ${inexistentes.join(', ')}`
      ).toEqual([]);
    });
  }
});

describe('el barrido se contrasta a sí mismo: detecta lo que ya se borró', () => {
  // Un barrido que nunca ha fallado no prueba que sirva. Estos tests meten un
  // residuo conocido y comprueban que lo ve.
  const known = new Set([...registryIds(), ...specCppIds()]);
  const RE_NRPN = /^\s*['"]([a-z][a-z0-9_]*)['"]\s*:\s*['"]NRPN/gm;
  const RE_NUM = /^\s*['"]([a-z][a-z0-9_]*)['"]\s*:\s*[-0-9.]+/gm;

  it('ve un id borrado si vuelve a la tabla de NRPN', () => {
    const texto = "  'osc2_pm_source': 'NRPN 0:32',\n  'arp_gate': 'NRPN 1:32 (CC 13)',\n";
    const ids = [...new Set([...texto.matchAll(RE_NRPN)].map((m) => m[1]))];
    const malos = ids.filter((id) => pareceParametro(id) && !known.has(id));
    expect(malos).toEqual(['arp_gate']);
  });

  it('ve un id borrado si vuelve al randomizador de patches', () => {
    // Este es el residuo que encontró de verdad: el randomizador escribía el byte 32
    // de `osc2_pitch_mod_select` en cada patch nuevo.
    const texto = "  'osc2_pm_source': 0.0,\n  'osc2_pitch_mod_select': 0.0,\n";
    const ids = [...new Set([...texto.matchAll(RE_NUM)].map((m) => m[1]))];
    const malos = ids.filter((id) => pareceParametro(id) && !known.has(id));
    expect(malos).toEqual(['osc2_pitch_mod_select']);
  });

  it('NO ve los ids internos del bridge, que llevan guion bajo igual que un parámetro', () => {
    // Lo que un barrido ingenuo daba por falso positivo. `patch_dirty` se escribe
    // con `setParameter` como cualquier otro, así que la forma del id NO lo delata:
    // lo delata que no esté en el spec del host, y que esté en la lista de internos.
    for (const id of ['patch_dirty', 'midi_channel', 'protect_unsaved_edits']) {
      expect(id.includes('_'), `${id} debería llevar guion bajo: es el caso difícil`).toBe(true);
      expect(pareceParametro(id), `${id} es interno del bridge, no un parámetro`).toBe(false);
      expect(known.has(id), `${id} no debería estar en el spec del host`).toBe(false);
    }
  });

  it('NO ve los ids construidos por prefijo, que no aparecen como literal', () => {
    // `'seq_step_' + (i + 1)` no existe como cadena completa en ningún fichero, así
    // que un barrido de literales no lo ve — y no debe verlo: es una construcción,
    // no un residuo.
    expect(known.has('seq_step_')).toBe(false);
    // `fx1_mix` sí está en el spec (el host lo declara) pero no en el registro,
    // porque el motor lo construye por prefijo en vez de darle byte. Es el caso
    // para el que existe `SPECONLY_CONSUMIDOS` en el generador.
    expect(known.has('fx1_mix')).toBe(true);
    const registry = registryIds();
    expect(registry.has('fx1_mix')).toBe(false);
  });
});

describe('no hay un segundo parameters_spec.json', () => {
  const known = new Set([...registryIds(), ...specCppIds()]);

  // El duplicado era la causa más difícil de ver: mismo nombre, mismo formato,
  // declaran lo mismo, y nadie lo leía. El generador lee `resources/`.
  it('el spec solo existe en resources/', () => {
    const sobrantes = [];
    const SPECS = [
      'resources/parameters_spec.json',
      'WebUI/resources/parameters_spec.json',
      'WebUI/dist/resources/parameters_spec.json',
    ];
    for (const p of SPECS) {
      const ruta = path.join(ROOT, p);
      if (fs.existsSync(ruta) && !p.startsWith('WebUI/dist')) sobrantes.push(p);
    }
    expect(sobrantes).toEqual(['resources/parameters_spec.json']);
  });

  it('y el que existe, no contiene parámetros que el host no declara', () => {
    const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'resources', 'parameters_spec.json'), 'utf8'));
    const ids = (spec.parameters || spec).map((p) => p.id);
    const huerfanos = ids.filter((id) => !known.has(id));
    expect(huerfanos, `el JSON legacy declara: ${huerfanos.join(', ')}`).toEqual([]);
  });
});