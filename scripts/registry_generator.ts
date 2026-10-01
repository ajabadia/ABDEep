// registry_generator.ts — ABDEep Parameter Registry Generator
// Modern ES module version with TypeScript types
// Run: node --loader ts-node/esm scripts/registry_generator.ts
// Or: npm run generate:registry (after adding to package.json)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateAndBuildRegistry,
  generateRegistryOutput,
  renderJs,
  renderCppHeader,
  renderCppSource,
  parseSpecCppIds,
  indexSpecCppIds,
  ValidationResult,
  ParameterRegistry,
  BridgeParamMap,
  ByteMapEntry,
  SpecParam,
} from './registry_core.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ── Source file paths ────────────────────────────────────────────────
const SRC = {
  bridge: path.join(ROOT, 'WebUI', 'js', 'bridge-param-maps.js'),
  byteMap: path.join(ROOT, 'WebUI', 'js', 'byte_map_data.js'),
  spec: path.join(ROOT, 'resources', 'parameters_spec.json'),
  // El spec que el HOST declara (la APVTS) vive en C++. El JSON son 15
  // metadatos legacy; el C++ son los 247 parámetros que existen de verdad, y es
  // contra este contra el que se miden los guards 1 y 3.
  specCppDir: path.join(ROOT, 'Source', 'Core'),
};

// ── Output file paths ────────────────────────────────────────────────
const OUT = {
  data: path.join(ROOT, 'schemas', 'parameter-registry.data.json'),
  js: path.join(ROOT, 'WebUI', 'js', 'registry.gen.js'),
  h: path.join(ROOT, 'Source', 'Core', 'ParameterRegistry.gen.h'),
  cpp: path.join(ROOT, 'Source', 'Core', 'ParameterRegistry.gen.cpp'),
};

// ── Load source files ────────────────────────────────────────────────
function loadBridgeParams(file: string): BridgeParamMap {
  const code = fs.readFileSync(file, 'utf8');
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  const fn = new Function('window', `${code}\n;return window;`);
  const window = fn(sandbox.window);
  const bridge = window.BRIDGE_PARAM_MAPS;
  if (!bridge) {
    throw new Error('bridge-param-maps.js no expuso window.BRIDGE_PARAM_MAPS');
  }
  return bridge as BridgeParamMap;
}

function loadByteMap(file: string): ByteMapEntry[] {
  const code = fs.readFileSync(file, 'utf8');
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  const fn = new Function('window', `${code}\n;return window;`);
  const window = fn(sandbox.window);
  const byteMap = window.BYTE_MAP;
  if (!byteMap) {
    throw new Error('byte_map_data.js no expuso window.BYTE_MAP');
  }
  return byteMap as ByteMapEntry[];
}

function loadSpec(file: string): SpecParam[] {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const spec = raw && raw.parameters ? raw.parameters : raw;
  if (!Array.isArray(spec)) {
    throw new Error('parameters_spec.json no contiene un array en "parameters"');
  }
  return spec as SpecParam[];
}

// ── Validate byte map structure ──────────────────────────────────────
function validateByteMap(byteMap: ByteMapEntry[]): void {
  if (!Array.isArray(byteMap) || byteMap.length !== 242) {
    throw new Error(`BYTE_MAP debe tener 242 entradas (físicas); tiene ${byteMap?.length ?? 'n/a'}`);
  }
  byteMap.forEach((entry, idx) => {
    if (!entry || entry.idx !== idx) {
      throw new Error(`BYTE_MAP[${idx}] no es contiguo (idx=${entry?.idx})`);
    }
    if (!entry.param || !entry.region || !entry.type) {
      throw new Error(`BYTE_MAP[${idx}] carece de param/region/type`);
    }
  });
}

// ── El spec del host (C++) ────────────────────────────────────────────
/** Los ids declarados en `Source/Core/ParametersSpec_*.cpp`, con su fichero. */
function loadSpecCppIds(dir: string): { ids: string[]; porFichero: Record<string, string[]> } {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^ParametersSpec(_[A-Za-z]+)?\.cpp$/.test(f))
    .sort();
  if (files.length === 0) {
    throw new Error(`no hay ficheros ParametersSpec*.cpp en ${dir}`);
  }

  const ids: string[] = [];
  const porFichero: Record<string, string[]> = {};
  for (const f of files) {
    const encontrados = parseSpecCppIds(fs.readFileSync(path.join(dir, f), 'utf8'));
    porFichero[f] = encontrados;
    ids.push(...encontrados);
  }

  // Un id declarado dos veces en el spec es ambiguo: el host no sabe cuál.
  const { duplicados } = indexSpecCppIds(ids);
  if (duplicados.length > 0) {
    throw new Error(
      `SPEC_ID_DUPLICADO: el spec declara ${duplicados.length} id(s) más de una vez: ` +
      duplicados.map(([id]) => id).join(', ')
    );
  }

  return { ids, porFichero };
}

// ── Atomic write helper ──────────────────────────────────────────────
function writeAtomic(file: string, content: string): void {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

// ── Main generation ──────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('[registry] Cargando fuentes...');

  // Load all sources
  const [bridge, byteMap, spec, specCpp] = await Promise.all([
    Promise.resolve(loadBridgeParams(SRC.bridge)),
    Promise.resolve(loadByteMap(SRC.byteMap)),
    Promise.resolve(loadSpec(SRC.spec)),
    Promise.resolve(loadSpecCppIds(SRC.specCppDir)),
  ]);

  validateByteMap(byteMap);

  console.log(
    `[registry] Validando y construyendo registro (spec del host: ${specCpp.ids.length} ids)...`
  );

  // Build registry
  const result = await validateAndBuildRegistry(bridge, byteMap, spec, specCpp.ids);

  // Report errors
  if (result.errors.length > 0) {
    console.error('[registry] ERRORES FATALES — no se emiten artefactos:');
    for (const e of result.errors) {
      console.error(`  ✗ ${e}`);
    }
    process.exit(1);
  }

  // Generate output
  const registry = generateRegistryOutput(result);

  console.log('[registry] Emitiendo artefactos...');

  // Atomic emission
  const payloads = [
    [OUT.data, JSON.stringify(registry, null, 2) + '\n'],
    [OUT.js, renderJs(registry)],
    [OUT.h, renderCppHeader(registry)],
    [OUT.cpp, renderCppSource(registry)],
  ];

  for (const [file, content] of payloads) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeAtomic(file, content);
  }

  // Post-generation validation
  const emitted = JSON.parse(fs.readFileSync(OUT.data, 'utf8')) as ParameterRegistry;
  validateEmitted(emitted, result);

  // ── Report ─────────────────────────────────────────────────────────
  console.log(
    `[registry] OK — schemaVersion=1 · parámetros=${result.summary.total} ` +
    `(físicos=${result.summary.physical} · extendidos=${result.summary.extended} · virtuales=${result.summary.virtual}) ` +
    `· byteMap=242 · aliasGroups=${result.summary.aliasGroups} ` +
    `· enum=${result.summary.enumCount} · bipolar=${result.summary.bipolarCount} · cc=${result.summary.ccCount}`
  );

  // Los tres guards han pasado. Se dice en voz alta porque `aliasGroups=0` es
  // el que más cuesta mirar: un byte con dos ids genera un artefacto que
  // compila, un preset que se guarda y un mando que no hace nada.
  console.log(
    '[registry] Guards OK — ningún id fuera del spec · ningún byte con dos ids · ' +
    'ningún spec-only sin consumidor'
  );

  for (const w of result.warnings) {
    console.log(`[registry] WARN  ${w.code}: ${w.message}`);
  }
  if (result.warnings.length > 0) {
    console.log('[registry] Warnings no fatales registrados en warnings[] (comparisonMode §6).');
  }

  console.log('[registry] Emitidos:');
  for (const f of Object.values(OUT)) {
    console.log(`  - ${path.relative(ROOT, f)}`);
  }
}

function validateEmitted(emitted: ParameterRegistry, expected: ValidationResult): void {
  if (emitted.schemaVersion !== 1) throw new Error('data.json no tiene schemaVersion=1');
  if (!Array.isArray(emitted.parameters) || emitted.parameters.length !== expected.processed.length) {
    throw new Error('data.json parámetros no coinciden con la generación');
  }
  if (!Array.isArray(emitted.byteMap) || emitted.byteMap.length !== 242) {
    throw new Error('data.json byteMap ≠ 242');
  }

  const cppNames = new Set<string>();
  for (const p of emitted.parameters) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(p.cppName)) {
      throw new Error(`cppName inválido: ${p.id}`);
    }
    if (cppNames.has(p.cppName)) {
      throw new Error(`cppName duplicado: ${p.cppName}`);
    }
    cppNames.add(p.cppName);
  }
}

main().catch(err => {
  console.error('[registry] ERROR:', err);
  process.exit(1);
});