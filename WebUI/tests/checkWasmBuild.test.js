/**
 * checkWasmBuild.test.js — Fase 7 · verificación del build WASM
 *
 * Cubre scripts/check_wasm_build.js (job CI wasm-build):
 *   - Parser de secciones WASM (LEB128) con un binario sintético mínimo:
 *     sección Memory (initial pages) y sección Export (nombres de función),
 *     más la tolerancia a la minificación de nombres (-O3 --strip-all).
 *   - Ejecución real del script sobre los artefactos commiteados
 *     (WebUI/wasm/abdeep_dsp.{js,wasm}) — skipIf si no existen.
 *
 * Los artefactos .wasm/.js están en .gitignore (se generan con el build WASM),
 * así que el describe de integración se salta en repositorios sin build local.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check_wasm_build.js');
const WASM_DIR = path.join(ROOT, 'WebUI', 'wasm');
const hasArtifacts = fs.existsSync(path.join(WASM_DIR, 'abdeep_dsp.wasm'));

// Las constantes canónicas las exporta el propio script (main() no se ejecuta
// al requerirlo gracias al guard `require.main === module`).
const require = createRequire(import.meta.url);
const { REQUIRED_EXPORTS } = require(SCRIPT);

// Glue mínimo con las 13 funciones de EXPORTED_FUNCTIONS (mismo formato que el
// glue real de Emscripten: nombres con prefijo '_'). Debe incluir las 4 añadidas
// en Fase 5 (wasm_set/get_parameter_index, wasm_set/get_model).
const FULL_GLUE =
  'ABDEepDSP _wasm_init_engine _wasm_process_audio _wasm_set_parameter ' +
  '_wasm_set_parameter_index _wasm_get_parameter_index _wasm_set_model ' +
  '_wasm_get_model _wasm_note_on _wasm_note_off _wasm_pitch_bend ' +
  '_wasm_panic _malloc _free';

// El describe de integración valida artefactos COMMITEADOS/build-CI. Los
// artefactos locales (gitignored) pueden ser de un build previo sin los exports
// nuevos: si el glue no contiene TODOS los exports requeridos, se considera
// obsoleto y el describe se salta (el job wasm-build de CI lo valida tras
// reconstruir).
const glueJs = fs.existsSync(path.join(WASM_DIR, 'abdeep_dsp.js'))
  ? fs.readFileSync(path.join(WASM_DIR, 'abdeep_dsp.js'), 'utf8')
  : '';
const hasCurrentArtifacts = hasArtifacts && REQUIRED_EXPORTS.every((fn) => glueJs.includes('_' + fn));

// ────────────────────────────────────────────────────────────────────────────
// Helpers: construye un binario WASM sintético mínimo con las secciones dadas.
// ────────────────────────────────────────────────────────────────────────────

function uleb(n) {
  const bytes = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n !== 0) { b |= 0x80; }
    bytes.push(b);
  } while (n !== 0);
  return bytes;
}

function section(id, content) {
  return [id, ...uleb(content.length), ...content];
}

function buildWasm({ memInitial, memMax, exports }) {
  // Cabecera \0asm + versión 1
  const bytes = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  if (memInitial !== undefined) {
    const flags = memMax !== undefined ? 0x01 : 0x00;
    const memContent = [0x01, flags, ...uleb(memInitial)];
    if (memMax !== undefined) { memContent.push(...uleb(memMax)); }
    bytes.push(...section(5, memContent)); // Memory
  }
  if (exports) {
    const exportContent = [...uleb(exports.length)]; // count uleb
    for (const name of exports) {
      const nameBytes = Buffer.from(name, 'utf8');
      exportContent.push(...uleb(nameBytes.length), ...nameBytes, 0x00, ...uleb(1)); // kind=func, idx=1
    }
    bytes.push(...section(7, exportContent)); // Export
  }
  return Buffer.from(bytes);
}

// ────────────────────────────────────────────────────────────────────────────
// Unit tests del parser (sin dependencia del build WASM)
// ────────────────────────────────────────────────────────────────────────────

describe('check_wasm_build.js — parser de secciones WASM', () => {
  it('parsea la sección Memory (initial + maximum) y la sección Export', () => {
    // Con -O3 --strip-all Emscripten minifica los nombres de export del .wasm
    // (i, j, k...) — el check exige el CONTEO (>= 13), no los nombres (que viven
    // en el glue .js). El sintético usa 13 exports de función con nombres cortos.
    const minified = 'abcdefghijklm'.split('');
    const bin = buildWasm({ memInitial: 512, memMax: 32768, exports: minified });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wasmcheck-'));
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.wasm'), bin);
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.js'), FULL_GLUE);

    try {
      const { status, stdout } = runScript(['--wasm-dir', tmpDir, '--json']);
      expect(status, stdout).toBe(0);
      const r = extractJson(stdout);
      expect(r.memory.initialPages).toBe(512);
      expect(r.memory.ok).toBe(true);
      expect(r.exports.ok).toBe(true);
      expect(r.exports.count).toBe(13);
      expect(r.artifacts.wasmExists).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Memory initial por debajo de la reserva fija (512) falla', () => {
    // Glue COMPLETO de 13 funciones para aislar el check de Memory (el fallo debe
    // venir solo de la reserva fija, no del glue).
    const bin = buildWasm({ memInitial: 256, memMax: 32768, exports: 'abcdefghijklm'.split('') });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wasmcheck-'));
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.wasm'), bin);
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.js'), FULL_GLUE);

    try {
      const { status, stdout, stderr } = runScript(['--wasm-dir', tmpDir]);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::wasm-build');
      expect(stderr).toContain('reserva fija');
      // El glue completo no debe generar problemas de exports/glue
      expect(stderr).not.toContain('glue .js no exporta');
      expect(stdout).toContain('Exports (.wasm): 13 exports');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('invariante fuente roto (sin guard de reserva fija) falla con --src-file', () => {
    // Requisito central del job: verificar que wasminitengine/preasignación se
    // mantienen. Un WasmBridge.cpp sin el guard getNumSamples() < numSamples en
    // wasm_process_audio debe hacer fallar el check.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wasmcheck-'));
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.wasm'), buildWasm({ memInitial: 512, exports: 'abcdefghi'.split('') }));
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.js'), FULL_GLUE);
    const brokenSrc = path.join(tmpDir, 'WasmBridge_broken.cpp');
    fs.writeFileSync(brokenSrc,
      'extern "C" void wasm_init_engine(double sr, int bs) { gAudioBuffer.setSize(2, gBlockSize); }\n' +
      'extern "C" void wasm_process_audio(float* a, float* b, int n) { gAudioBuffer.setSize(2, n); }\n');

    try {
      const { status, stderr } = runScript(['--wasm-dir', tmpDir, '--src-file', brokenSrc]);
      expect(status).toBe(1);
      expect(stderr).toContain('reserva fija rota');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('invariante fuente roto (sin preasignación en init) falla con --src-file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wasmcheck-'));
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.wasm'), buildWasm({ memInitial: 512, exports: 'abcdefghijklm'.split('') }));
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.js'), FULL_GLUE);
    const brokenSrc = path.join(tmpDir, 'WasmBridge_broken2.cpp');
    fs.writeFileSync(brokenSrc,
      'extern "C" void wasm_init_engine(double sr, int bs) { gAudioBuffer.setSize(4, gBlockSize); }\n' +
      'extern "C" void wasm_process_audio(float* a, float* b, int n) { if (gAudioBuffer.getNumSamples() < n) { gAudioBuffer.setSize(2, n); } }\n');

    try {
      const { status, stderr } = runScript(['--wasm-dir', tmpDir, '--src-file', brokenSrc]);
      expect(status).toBe(1);
      expect(stderr).toContain('preasignación de gAudioBuffer en init rota');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('glue .js sin las funciones exportadas (EXPORTED_FUNCTIONS) falla', () => {
    const bin = buildWasm({ memInitial: 512, exports: 'abcdefghi'.split('') });
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wasmcheck-'));
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.wasm'), bin);
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.js'), 'ABDEepDSP _wasm_init_engine'); // falta _wasm_process_audio etc.

    try {
      const { status, stderr } = runScript(['--wasm-dir', tmpDir]);
      expect(status).toBe(1);
      expect(stderr).toContain('glue .js no exporta _wasm_process_audio');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('magic inválido (no es un .wasm) falla con parseo erróneo', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wasmcheck-'));
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.wasm'), Buffer.from('not a wasm file at all!!!'));
    fs.writeFileSync(path.join(tmpDir, 'abdeep_dsp.js'), 'ABDEepDSP _wasm_init_engine _malloc _free');

    try {
      const { status, stderr } = runScript(['--wasm-dir', tmpDir]);
      expect(status).toBe(1);
      expect(stderr).toContain('magic de WebAssembly');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('artefactos ausentes fallan con ::error:: (build WASM no ejecutado)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wasmcheck-'));
    try {
      const { status, stderr } = runScript(['--wasm-dir', tmpDir]);
      expect(status).toBe(1);
      expect(stderr).toContain('Falta abdeep_dsp.js');
      expect(stderr).toContain('Falta abdeep_dsp.wasm');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Integración: ejecuta el script real sobre los artefactos commiteados
// (WebUI/wasm) — se salta si el build WASM no se ha hecho en local.
// ────────────────────────────────────────────────────────────────────────────

describe.skipIf(!hasCurrentArtifacts)('check_wasm_build.js — artefactos WASM commiteados', () => {
  it('exit 0: artefactos, exports, preasignación e invariante fuente OK', () => {
    const { status, stdout } = runScript([]);
    expect(status, stdout).toBe(0);
    expect(stdout).toContain('Build WASM válido');
  });

  it('--json: reporte con Memory initial >= 512 páginas (32 MiB) y exports >= 9', () => {
    const { status, stdout } = runScript(['--json']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    expect(r).not.toBeNull();
    expect(r.tool).toBe('check_wasm_build');
    expect(r.ok).toBe(true);
    expect(r.artifacts.jsExists).toBe(true);
    expect(r.artifacts.wasmExists).toBe(true);
    expect(r.memory.ok).toBe(true);
    expect(r.memory.initialPages).toBeGreaterThanOrEqual(r.minInitialPages);
    expect(r.exports.ok).toBe(true);
    expect(r.exports.count).toBeGreaterThanOrEqual(r.requiredExports.length);
    expect(r.sourceInvariant.problems).toEqual([]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// runScript / extractJson (subproceso real del script)
// ────────────────────────────────────────────────────────────────────────────

function runScript(args) {
  let stdout = '';
  let stderr = '';
  let status = 0;
  try {
    stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    status = e.status ?? 1;
    stdout = String(e.stdout || '');
    stderr = String(e.stderr || '');
  }
  return { status, stdout, stderr };
}

function extractJson(stdout) {
  const marker = '---JSON---';
  const idx = stdout.indexOf(marker);
  if (idx === -1) { return null; }
  return JSON.parse(stdout.slice(idx + marker.length).trim());
}
