#!/usr/bin/env node
/**
 * @file check_wasm_build.js
 * @purpose Fase 7 (plan v3.2 §3.4/§7) — Verificación del build WASM en CI.
 *
 * Tras compilar el DSP a WebAssembly (emcmake + cmake --build wasm/build), este
 * script valida que los artefactos y el invariante de tiempo real se mantienen:
 *
 *   1. Artefactos   — WebUI/wasm/abdeep_dsp.js y .wasm existen, no vacíos y el
 *                     glue .js contiene el EXPORT_NAME (ABDEepDSP) y las
 *                     funciones exportadas en EXPORTED_FUNCTIONS.
 *   2. Exports      — el binario .wasm exporta las funciones C del bridge:
 *                     wasm_init_engine, wasm_process_audio, wasm_set_parameter,
 *                     wasm_set_parameter_index, wasm_get_parameter_index,
 *                     wasm_set_model, wasm_get_model (Fase 5 §3.2/§1.1),
 *                     wasm_note_on, wasm_note_off, wasm_pitch_bend, wasm_panic
 *                     (+ _malloc/_free de la runtime).
 *   3. Preasignación— la sección Memory del .wasm declara `initial >= 512`
 *                     páginas (512 × 64 KiB = 32 MiB = INITIAL_MEMORY) — la
 *                     reserva fija del plan §3.4 («Capacidad preasignada en
 *                     wasminitengine()»).
 *   4. Invariante   — invariante FUENTE en WasmBridge.cpp: `wasm_init_engine`
 *                     preasigna gAudioBuffer/gMidiBuffer y `wasm_process_audio`
 *                     NO reasigna si el bloque cabe (guard `getNumSamples() <
 *                     numSamples`). Si alguien rompe la reserva fija, el job
 *                     falla antes de mergear.
 *
 * Uso:
 *   node scripts/check_wasm_build.js [--wasm-dir WebUI/wasm] [--src-file Source/Wasm/WasmBridge.cpp] [--json] [--out f.json]
 *
 * Exit code: 0 = OK · 1 = invariantes violados · 2 = error de uso.
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_EXPORTS = [
  'wasm_init_engine',
  'wasm_process_audio',
  'wasm_set_parameter',
  'wasm_set_parameter_index',
  'wasm_get_parameter_index',
  'wasm_set_model',
  'wasm_get_model',
  'wasm_note_on',
  'wasm_note_off',
  'wasm_pitch_bend',
  'wasm_panic',
  'malloc',
  'free',
];

// INITIAL_MEMORY del wasm/CMakeLists.txt (33554432 bytes = 512 páginas de 64KiB).
const MIN_INITIAL_PAGES = 512;
const PAGE_SIZE = 65536;

// Invariante fuente: WasmBridge.cpp debe preasignar en init y no reasignar por
// bloque si la capacidad ya alcanza (reserva fija §3.4).
const SOURCE_INVARIANT = {
  file: 'Source/Wasm/WasmBridge.cpp',
  initPattern: /gAudioBuffer\.setSize\(\s*2\s*,\s*gBlockSize\s*\)/,
  noReallocGuard: /gAudioBuffer\.getNumSamples\(\)\s*<\s*numSamples/,
};

// Ruta por defecto del fuente del invariante — relativa al REPO (resuelta contra
// __dirname para que el script funcione desde cualquier cwd). Override con
// --src-file (usado por los tests negativos del invariante).
const DEFAULT_SRC_FILE = path.resolve(__dirname, '..', SOURCE_INVARIANT.file);

// ────────────────────────────────────────────────────────────────────────────
// Parser mínimo de secciones WASM (LEB128 u32) — suficiente para leer las
// secciones Memory (id 5) y Export (id 7) sin dependencias externas (wabt).
// ────────────────────────────────────────────────────────────────────────────

function readULEB(buf, offset) {
  // Acumulación segura contra overflow de << en LEBs de 5 bytes (shift >= 28):
  // se multiplica por 2^7 por iteración en lugar de desplazar bits en 32-bit.
  let result = 0;
  let multiplier = 1;
  let byte;
  do {
    if (offset >= buf.length) { throw new Error('LEB128 truncado'); }
    byte = buf[offset++];
    result += (byte & 0x7f) * multiplier;
    multiplier *= 128;
  } while (byte & 0x80);
  return { value: result >>> 0, offset };
}

function readName(buf, offset) {
  const len = readULEB(buf, offset);
  offset = len.offset;
  const end = offset + len.value;
  if (end > buf.length) { throw new Error('nombre de sección truncado'); }
  return { value: buf.toString('utf8', offset, end), offset: end };
}

/** Devuelve {exports: string[], memory: {initialPages, maxPages|null}[]}. */
function parseWasmSections(bytes) {
  if (bytes.length < 8 || bytes[0] !== 0x00 || bytes[1] !== 0x61 ||
      bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error('magic de WebAssembly no encontrado (\\0asm)');
  }
  const version = bytes.readUInt32LE(4);
  if (version !== 1) { throw new Error('versión de WebAssembly no soportada: ' + version); }

  const exports = [];
  const memory = [];
  let offset = 8;
  while (offset < bytes.length) {
    const id = bytes[offset++];
    const size = readULEB(bytes, offset);
    offset = size.offset;
    const sectionStart = offset;
    const sectionEnd = offset + size.value;
    if (sectionEnd > bytes.length) { throw new Error('sección ' + id + ' truncada'); }

    if (id === 5) { // Memory
      let p = sectionStart;
      const count = readULEB(bytes, p);
      p = count.offset;
      for (let i = 0; i < count.value; i++) {
        const flags = bytes[p++];
        const initial = readULEB(bytes, p);
        p = initial.offset;
        let maxPages = null;
        if (flags & 0x01) { // maximum presente
          const max = readULEB(bytes, p);
          maxPages = max.value;
          p = max.offset;
        }
        memory.push({ initialPages: initial.value, maxPages });
      }
    } else if (id === 7) { // Export
      let p = sectionStart;
      const count = readULEB(bytes, p);
      p = count.offset;
      for (let i = 0; i < count.value; i++) {
        const name = readName(bytes, p);
        p = name.offset;
        const kind = bytes[p++]; // 0=func 1=table 2=memory 3=global
        const idx = readULEB(bytes, p);
        p = idx.offset;
        if (kind === 0) { exports.push(name.value); }
      }
    }
    offset = sectionEnd;
  }
  return { exports, memory };
}

// ────────────────────────────────────────────────────────────────────────────
// Checks
// ────────────────────────────────────────────────────────────────────────────

function checkArtifacts(wasmDir) {
  const problems = [];
  const jsPath = path.join(wasmDir, 'abdeep_dsp.js');
  const wasmPath = path.join(wasmDir, 'abdeep_dsp.wasm');

  let js = null;
  if (!fs.existsSync(jsPath)) { 
    problems.push('Falta abdeep_dsp.js (build WASM no ejecutado)'); 
  } else {
    js = fs.readFileSync(jsPath, 'utf8');
    if (js.trim().length === 0) { problems.push('abdeep_dsp.js está vacío'); }
  }

  let wasm = null;
  if (fs.existsSync(wasmPath)) {
    wasm = fs.readFileSync(wasmPath);
    if (wasm.length === 0) { problems.push('abdeep_dsp.wasm está vacío'); }
  } else {
    // Intentar extraer de la cadena base64 en abdeep_dsp.js (SINGLE_FILE=1)
    const match = js ? js.match(/data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)/) : null;
    if (match) {
      wasm = Buffer.from(match[1], 'base64');
    } else {
      problems.push('Falta abdeep_dsp.wasm o WASM embebido en abdeep_dsp.js (build WASM no ejecutado)');
    }
  }

  // El glue modularizado debe exponer el EXPORT_NAME y las funciones exportadas.
  if (js) {
    if (!js.includes('ABDEepDSP')) {
      problems.push('glue .js no contiene el EXPORT_NAME ABDEepDSP (EXPORT_NAME cambió?)');
    }
    for (const fn of REQUIRED_EXPORTS) {
      // En el glue Emscripten aparecen con prefijo '_' en EXPORTED_FUNCTIONS.
      if (!js.includes('_' + fn)) {
        problems.push('glue .js no exporta _' + fn + ' (EXPORTED_FUNCTIONS cambió?)');
      }
    }
  }
  return { problems, js, wasm };
}

// El build usa -O3 --strip-all: Emscripten MINIFICA los nombres de export del
// .wasm a identificadores cortos (i, j, k...); los nombres canónicos viven en el
// glue JS (EXPORTED_FUNCTIONS). Por eso el check de exports es doble:
//   - glue JS: cada función REQUIRED debe aparecer como _<name> (contrato JS).
//   - .wasm:   el conteo de exports de función debe ser >= REQUIRED_EXPORTS.length
//              (los 7 del bridge + malloc/free de la runtime).
function checkExports(wasmFuncExports) {
  const ok = wasmFuncExports.length >= REQUIRED_EXPORTS.length;
  return {
    ok,
    count: wasmFuncExports.length,
    reason: ok
      ? wasmFuncExports.length + ' exports de función en el .wasm (>= ' + REQUIRED_EXPORTS.length + ' requeridos)'
      : 'solo ' + wasmFuncExports.length + ' exports de función en el .wasm (esperaba >= ' + REQUIRED_EXPORTS.length + ')' + ' — bridge + malloc/free no exportados',
  };
}

function checkMemory(memory) {
  if (memory.length === 0) {
    return { ok: false, reason: 'sin sección Memory en el .wasm', initialPages: null };
  }
  const mem = memory[0];
  const ok = mem.initialPages >= MIN_INITIAL_PAGES;
  return {
    ok,
    reason: ok
      ? 'initial=' + mem.initialPages + ' páginas (' + (mem.initialPages * PAGE_SIZE / (1024 * 1024)) + ' MiB) — reserva fija ' + MIN_INITIAL_PAGES + '+ páginas OK'
      : 'initial=' + mem.initialPages + ' páginas — la reserva fija exige >= ' + MIN_INITIAL_PAGES + ' (INITIAL_MEMORY)',
    initialPages: mem.initialPages,
  };
}

function checkSourceInvariant(srcFile) {
  const problems = [];
  let src;
  try {
    src = fs.readFileSync(srcFile, 'utf8');
  } catch (e) {
    problems.push('no se pudo leer ' + srcFile + ': ' + e.message);
    return { problems };
  }
  if (!src.includes('wasm_init_engine')) {
    problems.push('wasm_init_engine no encontrado en ' + srcFile);
  }
  if (!SOURCE_INVARIANT.initPattern.test(src)) {
    problems.push('preasignación de gAudioBuffer en init rota (esperaba gAudioBuffer.setSize(2, gBlockSize))');
  }
  if (!SOURCE_INVARIANT.noReallocGuard.test(src)) {
    problems.push('reserva fija rota: wasm_process_audio debe guardar con gAudioBuffer.getNumSamples() < numSamples (no reasignar si cabe)');
  }
  return { problems };
}

// ────────────────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let wasmDir = path.resolve(__dirname, '..', 'WebUI', 'wasm');
  let srcFile = DEFAULT_SRC_FILE;
  let wantJson = false;
  let outFile = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--wasm-dir') { wasmDir = path.resolve(args[++i]); }
    else if (args[i] === '--src-file') { srcFile = path.resolve(args[++i]); }
    else if (args[i] === '--json') { wantJson = true; }
    else if (args[i] === '--out') { outFile = args[++i]; }
  }
  return { wasmDir, srcFile, wantJson, outFile };
}

function main() {
  const { wasmDir, srcFile, wantJson, outFile } = parseArgs();

  const report = {
    schemaVersion: 1,
    tool: 'check_wasm_build',
    generatedAt: new Date().toISOString(),
    wasmDir,
    srcFile,
    requiredExports: REQUIRED_EXPORTS,
    minInitialPages: MIN_INITIAL_PAGES,
    artifacts: null,
    exports: { ok: false, count: 0, reason: 'no evaluado' },
    memory: { ok: false, reason: 'no evaluado', initialPages: null },
    sourceInvariant: { problems: ['no evaluado'] },
    problems: [],
  };

  // 1. Artefactos
  const art = checkArtifacts(wasmDir);
  report.artifacts = {
    jsExists: art.js !== null,
    wasmExists: art.wasm !== null,
    jsBytes: art.js !== null ? Buffer.byteLength(art.js, 'utf8') : 0,
    wasmBytes: art.wasm !== null ? art.wasm.length : 0,
  };
  report.problems.push(...art.problems);

  if (art.wasm !== null) {
    // 2. Exports + 3. Preasignación (parseo del binario)
    try {
      const parsed = parseWasmSections(art.wasm);
      const exp = checkExports(parsed.exports);
      report.exports = { ok: exp.ok, count: exp.count, reason: exp.reason };
      const mem = checkMemory(parsed.memory);
      report.memory = { ok: mem.ok, reason: mem.reason, initialPages: mem.initialPages };
      if (!exp.ok) { report.problems.push(exp.reason); }
      if (!mem.ok) { report.problems.push(mem.reason); }
    } catch (e) {
      report.problems.push('parseo del .wasm falló: ' + e.message);
    }
  }

  // 4. Invariante fuente (reserva fija en WasmBridge.cpp)
  const src = checkSourceInvariant(srcFile);
  report.sourceInvariant = { problems: src.problems };
  report.problems.push(...src.problems.map((p) => 'fuente: ' + p));

  report.ok = report.problems.length === 0;

  finish(report, wantJson, outFile, report.ok ? 0 : 1);
}

function finish(report, wantJson, outFile, exitCode) {
  const lines = [
    '='.repeat(64),
    '🧩 WASM BUILD CHECK (Fase 7 §3.4/§7) — abdeep_dsp',
    '='.repeat(64),
    `Artefactos: ${report.artifacts.jsExists ? 'abdeep_dsp.js ' + report.artifacts.jsBytes + 'B' : 'FALTA .js'} · ` +
      `${report.artifacts.wasmExists ? 'abdeep_dsp.wasm ' + report.artifacts.wasmBytes + 'B' : 'FALTA .wasm'}`,
    `Exports (.wasm): ${report.exports.reason}`,
    `Memory: ${report.memory.reason}`,
    `Invariante fuente (WasmBridge.cpp): ${report.sourceInvariant.problems.length === 0 ? 'reserva fija OK' : report.sourceInvariant.problems.join(' | ')}`,
  ];

  if (report.ok) {
    lines.push('\n✅ Build WASM válido: artefactos, exports, preasignación e invariante fuente OK.');
  } else {
    lines.push('\n❌ Violaciones encontradas:');
    for (const p of report.problems) {
      lines.push('  - ' + p);
      process.stderr.write('::error::wasm-build — ' + p + '\n');
    }
  }

  process.stdout.write(lines.join('\n') + '\n');
  if (wantJson) {
    process.stdout.write('\n---JSON---\n');
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  }
  if (outFile) {
    fs.writeFileSync(path.resolve(outFile), JSON.stringify(report, null, 2) + '\n');
  }
  process.exitCode = exitCode;
}

// Los tests (webui-ci) importan las constantes sin ejecutar el script: main()
// solo corre cuando se invoca como CLI (node scripts/check_wasm_build.js).
if (typeof module !== 'undefined' && module.exports)
{
    module.exports = { REQUIRED_EXPORTS, MIN_INITIAL_PAGES, SOURCE_INVARIANT };
    if (require.main === module)
    {
        main();
    }
}
else
{
    main();
}
