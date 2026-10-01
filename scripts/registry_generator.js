#!/usr/bin/env node
/**
 * registry_generator.js — Fase 1 · Esquema Declarativo y Generador Versionado
 * ===========================================================================
 * Fusiona las TRES fuentes de verdad de parámetros de ABDEep y emite los
 * artefactos .gen (JS + C++ + data.json) bajo el esquema schemaVersion 1.
 *
 *   Fuentes:
 *     1. WebUI/js/bridge-param-maps.js      → PARAM_TO_BYTE_OFFSET / PARAM_TO_CC /
 *                                             BIPOLAR_BYTES / ENUM_BYTES (canónico hardware)
 *     2. WebUI/js/byte_map_data.js          → BYTE_MAP (242 bytes físicos, display names,
 *                                             regiones, tipos descriptivos, descripciones)
 *     3. resources/parameters_spec.json     → metadatos legacy del emulador (name, default,
 *                                             min/max, options, description, midi_cc)
 *     4. Source/Core/ParametersSpec_*.cpp   → el spec que el HOST DECLARA (la APVTS).
 *                                             Solo se lee el CONJUNTO de ids; es contra
 *                                             este contra el que se miden los guards.
 *
 *   Artefactos emitidos (todos versionados en el repo):
 *     - schemas/parameter-registry.data.json        (instancia canónica validada)
 *     - WebUI/js/registry.gen.js                    (registro JS para la WebUI)
 *     - Source/Core/ParameterRegistry.gen.h         (registro C++ — enum + array + lookups)
 *     - Source/Core/ParameterRegistry.gen.cpp
 *
 *   Política de validación:
 *     - Errores FATALES (exit 1, no emite nada): ids duplicados, rangos incompatibles
 *       (min>=max), offsets fuera de 0..399, byte map no contiguo, colisiones de
 *       identificador C++ (cppName), ids sin byte offset en el mapa bridge, y
 *       parámetros físicos en regiones reservadas del preset (223-238 nombre del
 *       patch, 239-241 cola del payload) — RESERVED_BYTE_COLLISION.
 *     - Los TRES GUARDS que compara(n) las fuentes entre sí, y que salen de
 *       docs/parametros_sin_uso.md §"El guard que falta":
 *         1. REGISTRY_ID_NOT_IN_SPEC — un id en el mapa del puente que el host no
 *            declara. Es una escritura sin destino: el preset la guarda y al
 *            abrirlo el parámetro no existe. Se mira en las DOS tablas de ids del
 *            puente: PARAM_TO_BYTE_OFFSET (CC_ID_NOT_IN_SPEC si solo aparece en la
 *            de CC, que es el mismo defecto por la puerta del MIDI).
 *         2. NRPN_COLLISION — dos ids en el mismo byte. No es un parámetro
 *            inerte, es un byte con DOS respuestas: `findParameterByOffset`
 *            devuelve el primero que encuentra y el otro se vuelve un mando que
 *            no hace nada.
 *         3. SPECONLY_UNCONSUMED — el host declara un parámetro sin byte que
 *            nadie lee. El host lo acepta y lo serializa, y no mueve nada.
 *     - Advertencias (exit 0, se registran en warnings[]): divergencias CC legacy vs
 *       canónico (comparisonMode, §6 del plan) y entradas de SPECONLY_CONSUMIDOS
 *       que ya no aplican (SPECONLY_ALLOWLIST_STALE).
 *
 *   Uso:
 *     node scripts/registry_generator.js
 *   Enlazado desde:
 *     scripts/validate_and_generate.ps1 (entrada humana/CI)
 *     CMakeLists.txt  (add_custom_command de regeneración)
 *
 *   Idempotencia: si el contenido estable no cambio, NO reescribe los .gen ni
 *   avanza generatedAt, asi que correrlo no ensucia el diff ni invalida el
 *   build nativo (que lo invoca en cada add_custom_command).
 *
 *   sourceHashes: se calculan sobre la forma CANÓNICA de cada fuente (valor parseado,
 *   claves ordenadas, `Set` como array ordenado), no sobre los bytes del fichero: así
 *   cambios de formato o comentarios no re-sellan el registro. Incluye ya el spec
 *   de C++ como cuarta fuente (`parametersSpecCpp`), que también se hashée sobre
 *   la lista de ids ya parseada y no sobre los bytes del .cpp.
 *
 * Exit code: 0 = OK (con o sin warnings), 1 = errores fatales.
 */
'use strict';

// ESM interop shim: package.json declares "type": "module", so this script
// (invoked by the CMake add_custom_command) runs as ESM. Re-create the
// CommonJS globals it relies on instead of rewriting the whole generator.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

// ── Rutas de fuentes ──────────────────────────────────────────────
const SRC = {
  bridge: path.join(ROOT, 'WebUI', 'js', 'bridge-param-maps.js'),
  byteMap: path.join(ROOT, 'WebUI', 'js', 'byte_map_data.js'),
  spec: path.join(ROOT, 'resources', 'parameters_spec.json'),
  // El spec que el HOST declara (la APVTS) vive en C++, no en el JSON: el JSON
  // son 15 metadatos legacy del emulador y el C++ son los 247 parametros que
  // existen de verdad. Los guards necesitan el de C++; los metadatos, el JSON.
  specCppDir: path.join(ROOT, 'Source', 'Core'),
  schema: path.join(ROOT, 'schemas', 'parameter-registry.json'),
};

// El spec declarativo del host: `{ "id", "Name", "block", "type", ... }`. El
// cuarto campo (el tipo) es la unica clave de la linea, y ancla el match para que
// una tabla de opciones con el mismo shape no se cuele como parametro.
const RE_SPEC_ENTRY = /\{\s*"([a-z0-9_]+)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([a-z]+)"/g;

// ── Rutas de artefactos ───────────────────────────────────────────
const OUT = {
  data: path.join(ROOT, 'schemas', 'parameter-registry.data.json'),
  js: path.join(ROOT, 'WebUI', 'js', 'registry.gen.js'),
  h: path.join(ROOT, 'Source', 'Core', 'ParameterRegistry.gen.h'),
  cpp: path.join(ROOT, 'Source', 'Core', 'ParameterRegistry.gen.cpp'),
};

const GEN_HEADER_JS = '/* AUTO-GENERATED by scripts/validate_and_generate.ps1 → registry_generator.js — DO NOT EDIT. */';
const GEN_HEADER_CPP = '// AUTO-GENERATED by scripts/validate_and_generate.ps1 → registry_generator.js — DO NOT EDIT.';

// Parametros que el host declara y el registro no tiene byte, pero que estan
// VIVOS: o los lee el motor por un id construido (`fx1_mix` sale de
// `"fx" + String(s + 1) + "_mix"`), o son metadatos globales que la APVTS
// declara para que el host los acepte y los guarde en el preset.
//
// Un specOnly que NO este aqui y siga declarado es un error: es un parametro que
// el host acepta, serializa y devuelve, y que no mueve nada. La lista se deja
// vacia a proposito cuando un parametro entra en ella (hoy el generador no
// necesita ninguno: los 16 sin byte que quedan son todos globales o construidos
// por prefijo, y los dos restos de otra nomenclatura se borraron).
const SPECONLY_CONSUMIDOS = new Map([
  // Los cuatro `mix`: FXEngine.cpp construye "fx" + slot + "_mix".
  ['fx1_mix', 'FXEngine.cpp construye el id: "fx" + String(s + 1) + "_mix"'],
  ['fx2_mix', 'FXEngine.cpp construye el id: "fx" + String(s + 1) + "_mix"'],
  ['fx3_mix', 'FXEngine.cpp construye el id: "fx" + String(s + 1) + "_mix"'],
  ['fx4_mix', 'FXEngine.cpp construye el id: "fx" + String(s + 1) + "_mix"'],
  // Globales de la APVTS: no son del sintet, pero el host los acepta y los
  // guarda en el preset. Sin byte fisico a proposito.
  ['global_volume', 'global de la APVTS; lo aplica el host, no el motor'],
  ['global_tune', 'global de la APVTS; lo aplica el host, no el motor'],
  ['transpose', 'global de la APVTS; lo aplica el host, no el motor'],
  ['master_softclip_bypass', 'global de la APVTS; conmutador del host'],
  ['master_softclip_headroom', 'global de la APVTS; lo aplica el host'],
  // Pertenecen al panel, no a un NRPN del preset.
  ['hpf_bass_boost_gain', 'cabeza del filtro, no el conmutador on/off del byte 52'],
  ['sub_level', 'nivel del sub, sin byte en el mapa del puente'],
  ['vca_mode', 'modo del VCA, sin byte en el mapa del puente'],
  ['vcf_oversample', 'sobresampling, sin byte en el mapa del puente'],
  // El selector Vel Gate del arpegiador: lo pinta el panel y el modal, y lo lee
  // `bridge-engines-arp.js` vía `_arpVelocityFor` (bridge-engines-arp-modes.js),
  // que decide si la nota suena con velocidad constante, con la de la tecla o
  // con la rampa del patrón. Sin byte propio porque el 112 del preset real lo
  // ocupa Mod Slot 7 Dest (dual), igual que el resto de arp_* de este bloque.
  ['arp_velocity_gate', 'lo lee bridge-engines-arp.js vía _arpVelocityFor (Gate/Velocity/Seq)'],
]);

// ── Colección de problemas ────────────────────────────────────────
const fatalErrors = [];
const warnings = [];

const fail = (code, message) => fatalErrors.push({ code, message });
const warn = (code, message) => warnings.push({ code, message });

// ── Helpers ───────────────────────────────────────────────────────
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Forma CANÓNICA de una fuente (hash estable ante formato/comentarios).
// El hash de cada fuente se calcula sobre su valor YA PARSEADO, serializado de
// forma determinista — claves ordenadas, arrays en su orden de declaración, `Set`
// como array ordenado — y NO sobre los bytes del fichero. Así, cambios de
// indentación, espaciado o comentarios NO re-sellan el registro; solo lo hace un
// cambio real de datos. Se excluyen funciones y `undefined` (son código, no datos
// de parámetros). Ojo: sin el caso `Set`, JSON.stringify convertiría BIPOLAR_BYTES
// (un Set) en `{}` y lo ignoraría silenciosamente.
// Implementación de referencia (idéntica): scripts/registry_core.ts → canonicalizeSource().
function canonicalizeSource(value) {
  if (value instanceof Set) {
    return [...value].map(canonicalizeSource).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  if (value instanceof Map) {
    return [...value.entries()]
      .map(([k, v]) => [k, canonicalizeSource(v)])
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeSource);
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const v = value[key];
      if (v === undefined || typeof v === 'function') { continue; }
      out[key] = canonicalizeSource(v);
    }
    return out;
  }
  return value;
}

/** SHA-256 de la forma canónica de `value`. */
function canonicalHash(value) {
  return sha256(JSON.stringify(canonicalizeSource(value)));
}

function loadJsGlobal(file) {
  // Los scripts del WebUI se asignan a window.X. Se ejecutan en un sandbox
  // para obtener su export sin tocar el global del proceso.
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = { window: {} };
  const fn = new Function('window', code + '\n;return window;');
  return fn(sandbox.window);
}

/**
 * Los ids que el HOST DECLARA: las entradas `{ "id", "Name", "block", "type", … }`
 * de los `Source/Core/ParametersSpec_*.cpp`.
 *
 * Por que se lee el C++ y no el JSON: el spec que manda es el de la APVTS (247
 * entradas repartidas en cinco ficheros), y `resources/parameters_spec.json` son
 * 15 metadatos legacy del emulador. Un guard que comparara el registro contra el
 * JSON daria 220 falsos positivos; uno que no compare nada no vigila nada.
 *
 * El JSON sigue siendo la fuente de METADATOS (name, desc, min/max, default,
 * midi_cc) y se sigue fusionando igual que antes. Esto solo anade el conjunto de
 * ids, que es lo que los tres guards necesitan.
 *
 * @returns {{ ids: string[], porFichero: Record<string, string[]> }}
 */
function loadSpecCppIds(dir) {
  const files = fs.readdirSync(dir)
    .filter((f) => /^ParametersSpec(_[A-Za-z]+)?\.cpp$/.test(f))
    .sort();
  if (files.length === 0) {
    throw new Error('no hay ficheros ParametersSpec*.cpp en ' + dir);
  }

  const ids = [];
  const porFichero = {};
  const vistos = new Map(); // id -> fichero, para el error de duplicado

  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const encontrados = [];
    RE_SPEC_ENTRY.lastIndex = 0;
    let m;
    while ((m = RE_SPEC_ENTRY.exec(text)) !== null) {
      const id = m[1];
      if (vistos.has(id)) {
        fail('SPEC_ID_DUPLICADO',
          'Spec C++ declara "' + id + '" dos veces: ' + vistos.get(id) + ' y ' + f +
          ' — el host no sabe cuál de los dos es');
        continue;
      }
      vistos.set(id, f);
      encontrados.push(id);
      ids.push(id);
    }
    porFichero[f] = encontrados;
  }

  return { ids, porFichero };
}

/** 'lfo1_rate' → 'Lfo1Rate', 'fx1_param10' → 'Fx1Param10' */
function toPascalCase(id) {
  return id.split(/[^A-Za-z0-9]+/).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ── 1. Cargar fuentes ─────────────────────────────────────────────
let bridge, byteMap, spec;
try {
  const bridgeWin = loadJsGlobal(SRC.bridge);
  bridge = bridgeWin.BRIDGE_PARAM_MAPS;
  if (!bridge) {fail('SRC_BRIDGE_MISSING', 'bridge-param-maps.js no expuso window.BRIDGE_PARAM_MAPS');}
} catch (e) {
  fail('SRC_BRIDGE_LOAD', 'No se pudo cargar bridge-param-maps.js: ' + e.message);
}
try {
  const byteWin = loadJsGlobal(SRC.byteMap);
  byteMap = byteWin.BYTE_MAP;
  if (!byteMap) {fail('SRC_BYTEMAP_MISSING', 'byte_map_data.js no expuso window.BYTE_MAP');}
} catch (e) {
  fail('SRC_BYTEMAP_LOAD', 'No se pudo cargar byte_map_data.js: ' + e.message);
}
try {
  const raw = JSON.parse(fs.readFileSync(SRC.spec, 'utf8'));
  spec = raw && raw.parameters ? raw.parameters : raw;
  if (!Array.isArray(spec)) {fail('SRC_SPEC_SHAPE', 'parameters_spec.json no contiene un array en "parameters"');}
} catch (e) {
  fail('SRC_SPEC_LOAD', 'No se pudo cargar parameters_spec.json: ' + e.message);
}
if (fatalErrors.length > 0) {
  reportAndExit(1);
}

// El spec del host (C++). Es la cuarta fuente: no aporta bytes ni metadatos,
// aporta el CONJUNTO de ids que existe, que es contra el que se miden los guards.
let specCpp;
try {
  specCpp = loadSpecCppIds(SRC.specCppDir);
} catch (e) {
  fail('SRC_SPECCPP_LOAD', 'No se pudo leer el spec del host: ' + e.message);
}
if (fatalErrors.length > 0) {
  reportAndExit(1);
}

const specCppIds = new Set(specCpp.ids);

// Hashes sobre la forma CANÓNICA de las fuentes ya parseadas (no los bytes del
// fichero): cambios de formato o comentarios no re-sellan el registro.
const sourceHashes = {
  parametersSpec: canonicalHash(spec),
  bridgeParamMaps: canonicalHash(bridge),
  byteMapData: canonicalHash(byteMap),
  parametersSpecCpp: canonicalHash(specCpp.ids),
};

// ── 2. Validación estructural del byte map ────────────────────────
if (!Array.isArray(byteMap) || byteMap.length !== 242) {
  fail('BYTEMAP_LENGTH', 'BYTE_MAP debe tener 242 entradas (físicas); tiene ' + (byteMap ? byteMap.length : 'n/a'));
} else {
  byteMap.forEach((entry, idx) => {
    if (!entry || entry.idx !== idx) {
      fail('BYTEMAP_CONTIGUITY', 'BYTE_MAP[' + idx + '] no es contiguo (idx=' + (entry && entry.idx) + ')');
    }
    if (!entry.param || !entry.region || !entry.type) {
      fail('BYTEMAP_FIELDS', 'BYTE_MAP[' + idx + '] carece de param/region/type');
    }
  });
}

// ── 3. Fusionar fuentes ───────────────────────────────────────────
const paramToOffset = bridge.PARAM_TO_BYTE_OFFSET || {};
const paramToCC = bridge.PARAM_TO_CC || {};
const enumBytes = bridge.ENUM_BYTES || {};
const bipolarBytes = bridge.BIPOLAR_BYTES instanceof Set ? bridge.BIPOLAR_BYTES : new Set(Object.keys(bridge.BIPOLAR_BYTES || {}).map(Number));

const specById = new Map();
for (const p of spec) {specById.set(p.id, p);}

const entries = [];
const byOffset = {}; // byteOffset → [ids]

for (const [id, offsetRaw] of Object.entries(paramToOffset)) {
  const byteOffset = Number(offsetRaw);
  if (!Number.isInteger(byteOffset) || byteOffset < 0 || byteOffset > 399) {
    fail('OFFSET_RANGE', 'Param "' + id + '" tiene byteOffset inválido: ' + offsetRaw);
    continue;
  }
  (byOffset[byteOffset] = byOffset[byteOffset] || []).push(id);
}

// ── GUARD 2: dos ids en el mismo byte ─────────────────────────────
// Un byte con dos ids no es un parámetro inactivo: es un byte con DOS
// RESPUESTAS. `PatchByteCodec.h` resuelve el byte con `findParameterByOffset`, que
// devuelve el primero que encuentra, así que escribir al byte 32 guarda como
// fuente de modulación del OSC2 o como selector de mod de tono según el orden.
// El que pierda se vuelve un id que el usuario puede mover y que no hace nada.
//
// Aquí hubo una lista de escapes (kKnownAliasOffsets = {32, 88, 160}) que
// llamaba "alias intencionales" a los tres. Eran exactamente los tres defectos
// que el guard tenía que cazar, y la lista los hacía pasar por buenos. Se ha
// quitado: si un alias de verdad es necesario, se declara con su byte propio.
for (const [off, ids] of Object.entries(byOffset)) {
  if (ids.length > 1) {
    fail('NRPN_COLLISION', 'Byte ' + off + ' compartido por ' + ids.length + ' ids: ' +
      ids.join(', ') + ' — un byte, dos respuestas; dar a cada uno el suyo');
  }
}

// ── 3b. Regiones reservadas del preset (NO admite parámetros) ─────
// El preset físico DM12 no tiene bytes editables más allá de 222:
//   - 223-238  → nombre del patch (15-16 chars ASCII; verificado en dumps reales:
//                banco A preset 0 = "Blue Dolphin BC " empieza en el byte 223)
//   - 239-241  → cola del payload empaquetado
// Cualquier parámetro físico que aterrice aquí es un error FATAL (usurparía
// bytes del nombre del patch); los parámetros del emulador sin byte físico
// deben declararse en la región virtual (>=300), p.ej. fx_feedback_gain=300,
// fx_send_level=301.
const kReservedPhysicalRegions = [
  { start: 223, end: 238, label: 'patch name (223-238)' },
  { start: 239, end: 241, label: 'payload tail (239-241)' },
];
for (const [id, offsetRaw] of Object.entries(paramToOffset)) {
  const byteOffset = Number(offsetRaw);
  if (!Number.isInteger(byteOffset) || byteOffset < 0) {continue;}
  if (byteOffset > 241) {continue;} // solo aplica a bytes físicos 0-241
  const region = kReservedPhysicalRegions.find((r) => byteOffset >= r.start && byteOffset <= r.end);
  if (region) {
    fail('RESERVED_BYTE_COLLISION', 'Param "' + id + '" (byteOffset=' + byteOffset +
      ') cae en la región reservada ' + region.label + ' — sin byte físico legítimo; mover a virtual (>=300)');
  }
}

// ── GUARD 1: ningún id del registro puede estar fuera del spec ─────
// El registro tiene 236 entradas; el host declara 247. Un id que llega al mapa
// del puente sin existir en la APVTS es una ESCRITURA SIN DESTINO: el
// `PatchByteCodec` la acepta, el preset la serializa y al abrirla el host no la
// declara, así que se pierde. Y si además comparte byte con otro (lo hacía
// `osc2_pitch_mod_select` con `osc2_pm_source`), deja de estar inerte y rompe el
// parámetro que sí suena.
//
// Se mide contra el spec de C++ (el que el host declara) y no contra el JSON: el
// JSON son 15 metadatos legacy, y compararlos daría 220 falsos positivos.
for (const [id, offsetRaw] of Object.entries(paramToOffset)) {
  if (!specCppIds.has(id)) {
    fail('REGISTRY_ID_NOT_IN_SPEC', 'Param "' + id + '" (byteOffset=' + offsetRaw +
      ') está en el mapa del puente pero el host NO lo declara en Source/Core/ParametersSpec_*.cpp' +
      ' — el byte se escribe, el preset lo guarda y al abrirlo el parámetro no existe');
  }
}
// Y lo mismo por la otra puerta: PARAM_TO_CC. Un id que solo aparece ahí es un CC
// que responde a un mando que el host no declara — el mismo defecto que el de
// arriba, con el solo.extra de que también se mueve desde el MIDI externo.
// Sin byte legítimo son los globales de la APVTS (`global_volume`, `global_tune`,
// `transpose`), y esos están en el spec, así que no necesitan lista de escapes:
// basta con mirar dónde están declarados.
for (const [id, cc] of Object.entries(paramToCC)) {
  if (!specCppIds.has(id)) {
    fail('CC_ID_NOT_IN_SPEC', 'Param "' + id + '" (CC=' + cc +
      ') está en PARAM_TO_CC pero el host NO lo declara en Source/Core/ParametersSpec_*.cpp' +
      ' — un CC que mueve un parámetro que no existe');
  }
}

// Construir entrada canónica por id (mantener orden de definición del bridge).
for (const [id, offsetRaw] of Object.entries(paramToOffset)) {
  const byteOffset = Number(offsetRaw);
  const specMeta = specById.get(id);

  // Regla 1.1: rangos incompatibles en la fuente legacy.
  if (specMeta && typeof specMeta.min === 'number' && typeof specMeta.max === 'number' && specMeta.min >= specMeta.max) {
    fail('RANGE_INCOMPATIBLE', 'Spec "' + id + '": min(' + specMeta.min + ') >= max(' + specMeta.max + ')');
    continue;
  }

  const category = byteOffset >= 300 ? 'virtual' : (byteOffset >= 242 ? 'extended' : 'physical');
  const isEnum = Object.prototype.hasOwnProperty.call(enumBytes, String(byteOffset));
  const isBipolar = bipolarBytes.has(byteOffset);
  const codecType = isEnum ? 'enum' : (isBipolar ? 'bipolar' : 'value');

  const bm = category === 'physical' && byteMap[byteOffset] ? byteMap[byteOffset] : null;
  const cc = paramToCC[id] !== undefined ? Number(paramToCC[id]) : null;
  const legacyCC = specMeta && specMeta.midi_cc !== undefined ? Number(specMeta.midi_cc) : null;
  const ccConflict = cc !== null && legacyCC !== null && cc !== legacyCC;
  if (ccConflict) {
    warn('CC_LEGACY_DIVERGENCE', 'Param "' + id + '": CC canónico=' + cc + ' vs legacy=' + legacyCC + ' (comparisonMode)');
  }

  const enumMax = isEnum ? Number(enumBytes[String(byteOffset)]) : null;
  if (isEnum && (!Number.isInteger(enumMax) || enumMax < 1)) {
    fail('ENUM_MAX', 'Param "' + id + '" enum con ENUM_BYTES inválido: ' + enumMax);
    continue;
  }

  const aliases = (byOffset[byteOffset] || []).filter((a) => a !== id);
  const cppName = toPascalCase(id);

  entries.push({
    id,
    byteOffset,
    category,
    region: bm ? bm.region : (category === 'extended' ? 'Extended' : 'Virtual'),
    codecType,
    byteMapType: bm ? bm.type : null,
    enumMax,
    enumLabels: bm && bm.enumLabels ? bm.enumLabels : null,
    cc,
    legacyCC,
    ccConflict,
    name: (specMeta && specMeta.name) || (bm && bm.param) || null,
    desc: (specMeta && specMeta.description) || (bm && bm.desc) || null,
    defaultValue: computeDefaultNormalized(specMeta),
    aliases,
    cppName,
    index: 0, // se asigna tras ordenar
  });
}

// Regla: ids sin byte offset válido o duplicados de cppName.
const cppNames = new Map();
entries.forEach((e, idx) => {
  e.index = idx;
  if (cppNames.has(e.cppName)) {
    fail('CPP_NAME_COLLISION', 'cppName "' + e.cppName + '" colisiona entre "' + cppNames.get(e.cppName) + '" y "' + e.id + '"');
  }
  cppNames.set(e.cppName, e.id);
});

// Parámetros spec-only (universo legacy sin byte físico).
// `hasOwnProperty` y no truthiness: un id en el byte 0 tiene valor 0, que es
// falsy. Con `!paramToOffset[p.id]` el byte cero se habría contado como
// spec-only.
const specOnly = [];
for (const p of spec) {
  if (!Object.prototype.hasOwnProperty.call(paramToOffset, p.id)) {
    specOnly.push({
      id: p.id,
      name: p.name || null,
      block: p.block || null,
      type: p.type || null,
      description: p.description || null,
      options: p.options || null,
    });
  }
}

// ── GUARD 3: un specOnly que nadie consume es un error ─────────────
// No se escanea el motor para decidirlo: se compara contra una lista explícita
// de los declarados-sin-byte que SÍ están vivos. El escaneo se descartó porque
// los ids construidos por prefijo (`fx1_mix` sale de `"fx" + String(s+1) + "_mix"`)
// no aparecen como literal en ningún fichero, y un escaneo los daría por muertos
// — o peor, por vivos y hubiera que mantener la lista de prefijos al día.
//
// Se mide contra el spec de C++, que es donde vive la verdad de qué declara el
// host; los `slot_*` que vivían solo en el JSON ya se borraron.
// OJO: `hasOwnProperty`, no `!paramToOffset[id]`. `lfo1_rate` está en el byte 0,
// y `!0` es `true`: el truthiness de un truthy falsifica al id del byte cero y lo
// declara sin byte. Un guard que se equivoca en el primer id del registro es un
// guard que nadie se cree.
const specOnlyDelHost = specCpp.ids.filter(
  (id) => !Object.prototype.hasOwnProperty.call(paramToOffset, id));
for (const id of specOnlyDelHost) {
  if (!SPECONLY_CONSUMIDOS.has(id)) {
    fail('SPECONLY_UNCONSUMED', 'Spec declara "' + id + '" pero no tiene byte en el mapa del puente' +
      ' y no está en SPECONLY_CONSUMIDOS — el host lo acepta y lo serializa, y no lo lee nadie' +
      ' (si está vivo, añadirlo a la lista con su porqué; si no, borrarlo del spec)');
  }
}
// Y al revés: una entrada en la lista que ya no aplica es deuda cerrada que
// alguien se dejó olvidada. Aviso, no error: el fallo real lo vería el guard 1.
for (const id of SPECONLY_CONSUMIDOS.keys()) {
  if (!specOnlyDelHost.includes(id)) {
    warn('SPECONLY_ALLOWLIST_STALE', 'SPECONLY_CONSUMIDOS lista "' + id +
      '" pero ya no es spec-only (tiene byte, o ha desaparecido del spec) — quitarlo de la lista');
  }
}

// byteMap canónico: los 242 bytes con su id de registro (o null).
const canonicalByteMap = byteMap.map((bmEntry) => {
  const ids = byOffset[bmEntry.idx] || null;
  return {
    idx: bmEntry.idx,
    param: bmEntry.param,
    region: bmEntry.region,
    type: bmEntry.type,
    desc: bmEntry.desc || null,
    enumLabels: bmEntry.enumLabels || null,
    id: ids && ids.length > 0 ? ids[0] : null,
  };
});

// ── 4. Resumen ────────────────────────────────────────────────────
const aliasGroups = Object.values(byOffset).filter((ids) => ids.length > 1).length;
const summary = {
  total: entries.length,
  physical: entries.filter((e) => e.category === 'physical').length,
  extended: entries.filter((e) => e.category === 'extended').length,
  virtual: entries.filter((e) => e.category === 'virtual').length,
  aliasGroups,
  enumCount: entries.filter((e) => e.codecType === 'enum').length,
  bipolarCount: entries.filter((e) => e.codecType === 'bipolar').length,
  valueCount: entries.filter((e) => e.codecType === 'value').length,
  ccCount: entries.filter((e) => e.cc !== null).length,
  specOnlyCount: specOnly.length,
  warningCount: warnings.length,
};

// ── 5. Emitir si no hay errores fatales ───────────────────────────
if (fatalErrors.length > 0) {reportAndExit(1);}

const registry = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceHashes,
  parameters: entries,
  byteMap: canonicalByteMap,
  specOnly,
  warnings,
  summary,
};

// `generatedAt` es lo UNICO que cambia entre dos corridas con las mismas fuentes.
// Si se regenerara siempre, cada build dejaria un diff espurio de una linea en
// data.json + registry.gen.js (y, al tocarlos, invalidaria los .gen para CMake).
// Se conserva la fecha anterior cuando el contenido estable (todo menos
// generatedAt) no cambio: la fecha pasa a significar "cuando cambio el contenido".
const previous = readJsonIfExists(OUT.data);
if (previous !== null && stableForm(previous) === stableForm(registry)) {
  registry.generatedAt = previous.generatedAt;
}

// Emisión atómica: escribir a .tmp + rename para que un fallo a mitad de la
// generación nunca deje artefactos parciales que CMake considere vigentes.
const payloads = [
  [OUT.data, JSON.stringify(registry, null, 2) + '\n'],
  [OUT.js, renderJs(registry)],
  [OUT.h, renderCppHeader(registry)],
  [OUT.cpp, renderCppSource(registry)],
];

const written = [];
const untouched = [];
for (const [file, content] of payloads) {
  if (writeIfChanged(file, content)) {written.push(file);} else {untouched.push(file);}
}

// Post-emisión: re-validar la instancia emitida contra las invariantes clave
// del esquema (sin dependencia externa; ajv llegará en el job CI de Fase 7).
const emitted = JSON.parse(fs.readFileSync(OUT.data, 'utf8'));
validateEmitted(emitted);

// ── 6. Reporte ────────────────────────────────────────────────────
console.log('[registry] OK — schemaVersion=1 · parámetros=' + summary.total +
  ' (físicos=' + summary.physical + ' · extendidos=' + summary.extended + ' · virtuales=' + summary.virtual + ')' +
  ' · byteMap=242 · aliasGroups=' + summary.aliasGroups +
  ' · enum=' + summary.enumCount + ' · bipolar=' + summary.bipolarCount + ' · cc=' + summary.ccCount);
for (const w of warnings) {console.log('[registry] WARN  ' + w.code + ': ' + w.message);}
if (warnings.length > 0) {
  console.log('[registry] Warnings no fatales registrados en warnings[] (comparisonMode §6).');
}
console.log('[registry] Artefactos: ' + written.length + ' reescritos, ' +
  untouched.length + ' ya al dia');
for (const f of written) {console.log('  ~ ' + path.relative(ROOT, f));}
for (const f of untouched) {console.log('  = ' + path.relative(ROOT, f) + ' (sin cambios)');}
process.exit(0);

// ── Implementaciones auxiliares ───────────────────────────────────
function writeAtomic(file, content) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

// Escribe solo si el contenido cambia. Devuelve true si el fichero se toco.
// Un no-op deja el mtime intacto, que es justo lo que CMake mira para no
// recompilar los .gen ni encadenar el rebuild de quien los incluye.
function writeIfChanged(file, content) {
  if (readTextIfExists(file) === content) {return false;}

  writeAtomic(file, content);

  return true;
}

function readTextIfExists(file) {
  try {return fs.readFileSync(file, 'utf8');} catch (err) {return null;}
}

// null si el artefacto no existe o no es JSON valido (entonces no hay fecha que
// reutilizar y se emite con marca nueva).
function readJsonIfExists(file) {
  try {return JSON.parse(fs.readFileSync(file, 'utf8'));} catch (err) {return null;}
}

// JSON canonico del registro sin generatedAt: es lo que distingue una corrida
// sin cambios reales de una con cambios.
function stableForm(reg) {
  const stable = {...reg};
  delete stable.generatedAt;
  return JSON.stringify(stable);
}

// Valida la instancia emitida contra invariantes del esquema (espejo de lo que
// validará el job CI schema-validation con ajv en Fase 7).
function validateEmitted(d) {
  if (d.schemaVersion !== 1) {fail('SCHEMA_VERSION', 'data.json no tiene schemaVersion=1');}
  if (!Array.isArray(d.parameters) || d.parameters.length !== entries.length) {
    fail('EMITTED_PARAMETERS', 'data.json parámetros no coinciden con la generación');
  }
  if (!Array.isArray(d.byteMap) || d.byteMap.length !== 242) {
    fail('EMITTED_BYTEMAP', 'data.json byteMap ≠ 242');
  }
  // Los tres guards, otra vez, sobre lo EMITIDO. Ya se comprobaron sobre las
  // fuentes; aquí se comprueban sobre los bytes que se acaban de escribir, que
  // es lo que va a leer el resto del repo. Sin esto, un artefacto viejo commiteado
  // pasaría el generador sin que nadie se enterase.
  const emitidosPorByte = {};
  for (const p of d.parameters) {
    (emitidosPorByte[p.byteOffset] = emitidosPorByte[p.byteOffset] || []).push(p.id);
  }
  for (const [byte, ids] of Object.entries(emitidosPorByte)) {
    if (ids.length > 1) {
      fail('EMITTED_NRPN_COLLISION', 'El registro EMITIDO tiene el byte ' + byte +
        ' con ' + ids.length + ' ids: ' + ids.join(', '));
    }
  }
  for (const p of d.parameters) {
    if (!specCppIds.has(p.id)) {
      fail('EMITTED_ID_NOT_IN_SPEC', 'El registro EMITIDO trae "' + p.id +
        '" (byte ' + p.byteOffset + ') y el host no lo declara');
    }
  }
  const cpp = new Set();
  for (const p of d.parameters) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(p.cppName)) {fail('EMITTED_CPPNAME', 'cppName inválido: ' + p.id);}
    if (cpp.has(p.cppName)) {fail('EMITTED_CPPNAME_DUP', 'cppName duplicado: ' + p.cppName);}
    cpp.add(p.cppName);
  }
  if (d.summary.aliasGroups !== 0) {
    fail('EMITTED_ALIAS_GROUPS', 'El registro emitido declara ' + d.summary.aliasGroups +
      ' aliasGroups; debería ser 0');
  }
  if (fatalErrors.length > 0) {reportAndExit(1);}
}

function computeDefaultNormalized(specMeta) {
  if (!specMeta) {return null;}
  if (specMeta.type === 'bool') {return specMeta.default === true ? 1 : (specMeta.default === false ? 0 : null);}
  if (typeof specMeta.default === 'number') {
    if (typeof specMeta.min === 'number' && typeof specMeta.max === 'number' && specMeta.max > specMeta.min) {
      const n = (specMeta.default - specMeta.min) / (specMeta.max - specMeta.min);
      return Math.min(1, Math.max(0, n));
    }
    return Math.min(1, Math.max(0, specMeta.default));
  }
  if (specMeta.type === 'enum' && Array.isArray(specMeta.options) && typeof specMeta.default === 'string') {
    const idx = specMeta.options.indexOf(specMeta.default);
    if (idx >= 0 && specMeta.options.length > 1) {return idx / (specMeta.options.length - 1);}
  }
  return null;
}

function reportAndExit(code) {
  console.error('[registry] ERRORES FATALES — no se emiten artefactos:');
  for (const e of fatalErrors) {console.error('  ✗ ' + e.code + ': ' + e.message);}
  process.exit(code);
}

// ── Render JS (UMD: window.ParameterRegistry + module.exports) ────
function renderJs(reg) {
  const lines = [];
  lines.push(GEN_HEADER_JS);
  lines.push('/* eslint-disable */');
  lines.push('(function (root, factory) {');
  lines.push('  if (typeof module === "object" && module.exports) { module.exports = factory(); }');
  lines.push('  else if (typeof window !== "undefined") { window.ParameterRegistry = factory(); }');
  lines.push('  else { root.ParameterRegistry = factory(); }');
  // El root DEBE ser globalThis: en un modulo ES `this` es undefined, asi que la
  // rama de reserva (carga nativa ESM, sin `module` ni `window`) reventaba con
  // "Cannot set properties of undefined". Con globalThis el artefacto sirve para
  // los tres consumidores: script clasico del navegador, interop de Vitest y
  // import nativo de los scripts de CI (que leen globalThis.ParameterRegistry).
  lines.push('})(typeof self !== "undefined" ? self : globalThis, function () {');
  lines.push('  var byId = {};');
  lines.push('  var byOffset = {};');
  lines.push('  var parameters = ' + JSON.stringify(reg.parameters) + ';');
  lines.push('');
  lines.push('  parameters.forEach(function (p) { byId[p.id] = p; });');
  lines.push('  parameters.forEach(function (p) {');
  lines.push('    (byOffset[p.byteOffset] = byOffset[p.byteOffset] || []).push(p.id);');
  lines.push('  });');
  lines.push('');  lines.push('');
  lines.push('    return {');
  lines.push('    schemaVersion: 1,');
  lines.push('    generatedAt: ' + JSON.stringify(reg.generatedAt) + ',');
  lines.push('    sourceHashes: ' + JSON.stringify(reg.sourceHashes) + ',');
  lines.push('    parameters: parameters,');
  lines.push('    byteMap: ' + JSON.stringify(reg.byteMap) + ',');
  lines.push('    specOnly: ' + JSON.stringify(reg.specOnly) + ',');
  lines.push('    warnings: ' + JSON.stringify(reg.warnings) + ',');
  lines.push('    summary: ' + JSON.stringify(reg.summary) + ',');
  lines.push('    byId: byId,');
  lines.push('    byOffset: byOffset,');
  lines.push('    rawToNormalized: function (byteOffset, rawValue) {');
  lines.push('      if (byteOffset === undefined) return 0;');
  lines.push('      var p = byOffset[byteOffset] && byOffset[byteOffset][0] ? byId[byOffset[byteOffset][0]] : null;');
  lines.push('      if (p && p.codecType === "bipolar") { return Math.max(0, Math.min(1, ((rawValue - 128) / 127 + 1) / 2)); }');
  lines.push('      if (p && p.codecType === "enum" && p.enumMax) { return Math.min(1, rawValue / p.enumMax); }');
  lines.push('      return rawValue / 255;');
  lines.push('    },');
  lines.push('    normalizedToRaw: function (byteOffset, normalizedValue) {');
  lines.push('      var p = byOffset[byteOffset] && byOffset[byteOffset][0] ? byId[byOffset[byteOffset][0]] : null;');
  lines.push('      if (p && p.codecType === "bipolar") { return Math.round(((normalizedValue * 2 - 1) * 127) + 128); }');
  lines.push('      if (p && p.codecType === "enum" && p.enumMax) { return Math.round(normalizedValue * p.enumMax); }');
  lines.push('      return Math.round(normalizedValue * 255);');
  lines.push('    }');
  lines.push('  };');
  lines.push('});');
  lines.push('');
  return lines.join('\n');
}

// ── Render C++ ────────────────────────────────────────────────────
function codecTypeId(t) { return t === 'bipolar' ? 1 : (t === 'enum' ? 2 : 0); }

function renderCppHeader(reg) {
  const L = [];
  L.push(GEN_HEADER_CPP);
  L.push('#pragma once');
  L.push('');
  L.push('#include <array>');
  L.push('#include <cstdint>');
  L.push('#include <string_view>');
  L.push('');
  L.push('namespace ABD');
  L.push('{');
  L.push('namespace Registry');
  L.push('{');
  L.push('');
  L.push('// Índices generados en build-time (lookup O(1) por enum — invariante §3.2 del plan).');
  L.push('enum class ParameterIndex : std::uint16_t');
  L.push('{');
  reg.parameters.forEach((p) => L.push('    ' + p.cppName + ' = ' + p.index + ','));
  L.push('    kCount');
  L.push('};');
  L.push('');
  L.push('// codecType: 0 = value, 1 = bipolar, 2 = enum');
  L.push('struct ParameterEntry');
  L.push('{');
  L.push('    const char* id;');
  L.push('    std::uint16_t byteOffset;');
  L.push('    const char* region;');
  L.push('    std::uint8_t codecType;');
  L.push('    std::uint8_t cc;            // 0 = no mapeado');
  L.push('    std::uint8_t enumMax;       // 0 = n/a');
  L.push('    float defaultValue;         // normalized 0..1; -1.0f = desconocido');
  L.push('    ParameterIndex index;');
  L.push('};');
  L.push('');
  L.push('inline constexpr std::size_t kParameterCount = ' + reg.parameters.length + ';');
  L.push('inline constexpr std::size_t kByteMapSize = ' + reg.byteMap.length + ';');
  L.push('');
  L.push('extern const std::array<ParameterEntry, kParameterCount> kParameters;');
  L.push('extern const std::array<const char*, kByteMapSize> kByteMapParams;');
  L.push('');
  L.push('// Lookups para hilo de control / tests (nunca en el hilo de audio).');
  L.push('inline const ParameterEntry* findParameterById (std::string_view id) noexcept');
  L.push('{');
  L.push('    for (const auto& p : kParameters)');
  L.push('        if (id == p.id)');
  L.push('            return &p;');
  L.push('    return nullptr;');
  L.push('}');
  L.push('');
  L.push('inline const ParameterEntry* findParameterByOffset (std::uint16_t byteOffset) noexcept');
  L.push('{');
  L.push('    for (const auto& p : kParameters)');
  L.push('        if (byteOffset == p.byteOffset)');
  L.push('            return &p;');
  L.push('    return nullptr;');
  L.push('}');
  L.push('');
  L.push('} // namespace Registry');
  L.push('} // namespace ABD');
  L.push('');
  return L.join('\n');
}

function renderCppSource(reg) {
  const L = [];
  L.push(GEN_HEADER_CPP);
  L.push('#include "ParameterRegistry.gen.h"');
  L.push('');
  L.push('namespace ABD');
  L.push('{');
  L.push('namespace Registry');
  L.push('{');
  L.push('');
  L.push('const std::array<ParameterEntry, kParameterCount> kParameters = {{');
  reg.parameters.forEach((p) => {
    const def = p.defaultValue === null ? -1.0 : p.defaultValue;
    L.push('    { "' + p.id + '", ' + p.byteOffset + ', "' + p.region + '", ' + codecTypeId(p.codecType) +
      ', ' + (p.cc === null ? 0 : p.cc) + ', ' + (p.enumMax === null ? 0 : p.enumMax) +
      ', ' + def.toFixed(6) + 'f, ParameterIndex::' + p.cppName + ' },');
  });
  L.push('}};');
  L.push('');
  L.push('const std::array<const char*, kByteMapSize> kByteMapParams = {{');
  reg.byteMap.forEach((b) => L.push('    "' + escapeCpp(b.param) + '",'));
  L.push('}};');
  L.push('');
  L.push('} // namespace Registry');
  L.push('} // namespace ABD');
  L.push('');
  return L.join('\n');
}

function escapeCpp(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
