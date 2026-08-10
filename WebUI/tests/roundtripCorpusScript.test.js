/**
 * roundtripCorpusScript.test.js — Fase 4 · script de corpus completo
 *
 * Ejecuta scripts/roundtrip_corpus.js (la batería de igualdad round-trip sobre los
 * factory banks A-H) como subproceso y verifica:
 *   - Exit 0 y resumen con los 3 niveles verdes sobre los 1024 presets.
 *   - Reporte --json con la estructura esperada (nivel1/nivel2/nivel3a, ok:true).
 *   - Invariante de self-match: selfMatched === scanned.
 *   - Banco inexistente → exit 1 con ::error::roundtrip-corpus.
 *
 * Los tests dependen del corpus local (resources/banks) — se saltan si no existe.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BANKS_DIR = path.join(ROOT, 'resources', 'banks', 'Factory Banks V1.1.2');
const hasCorpus = fs.existsSync(BANKS_DIR);
const SCRIPT = path.join(ROOT, 'scripts', 'roundtrip_corpus.js');

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

describe.skipIf(!hasCorpus)('roundtrip_corpus.js — batería Fase 4 sobre el corpus A-H', () => {
  it('exit 0 con los 3 niveles verdes sobre 1024 presets', () => {
    const { status, stdout } = runScript([]);
    expect(status, stdout).toBe(0);
    expect(stdout).toContain('1024/1024 invariante de codec OK');
    expect(stdout).toContain('1024/1024 re-encode estable');
    expect(stdout).toContain('1024/1024 self-match exact');
    expect(stdout).toContain('Todos los niveles verdes');
  });

  it('--json emite un reporte estructurado con nivel1/nivel2/nivel3a y ok:true', () => {
    const { status, stdout } = runScript(['--json']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    expect(r).not.toBeNull();
    expect(r.tool).toBe('roundtrip_corpus');
    expect(r.corpusSize).toBe(1024);
    expect(r.ok).toBe(true);
    expect(r.levels.nivel1.passed).toBe(1024);
    expect(r.levels.nivel2.passed).toBe(1024);
    expect(r.levels.nivel3a.selfMatched).toBe(1024);
    expect(r.errors).toEqual([]);
  });

  it('invariante de self-match: cada preset se encuentra a sí mismo (exact_match)', () => {
    const r = extractJson(runScript(['--json']).stdout);
    expect(r.levels.nivel3a.selfMatched).toBe(r.levels.nivel3a.scanned);
    expect(r.levels.nivel3a.failed).toBe(0);
  });

  it('el corpus tiene duplicados byte-idénticos y la posición de cabecera coincide con el orden', () => {
    const r = extractJson(runScript(['--json']).stdout);
    expect(r.levels.nivel3a.duplicates).toBe(r.duplicates.length);
    // Los factory banks V1.1.2 reutilizan presets entre bancos (A-H) — el reporte los lista
    expect(r.duplicates.length).toBeGreaterThan(0);
    // Sin errores de layout de cabecera (prog del msg[9] == índice secuencial)
    expect(r.errors.some((e) => e.includes('header_layout'))).toBe(false);
  });

  it('un banco inexistente falla con exit 1 y ::error::roundtrip-corpus', () => {
    const { status, stderr } = runScript(['--banks', 'Z']);
    expect(status).toBe(1);
    expect(stderr).toContain('::error::roundtrip-corpus');
    expect(stderr).toContain('Corpus incompleto');
  });

  it('--banks A,B limita el alcance (256 presets) sin errores', () => {
    const { status, stdout } = runScript(['--banks', 'A,B', '--json']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    expect(r.corpusSize).toBe(256);
    expect(r.ok).toBe(true);
  });

  it('--classify emite la tabla por preset (1024 filas, clasificación consistente)', () => {
    const { status, stdout } = runScript(['--classify', '--json']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    expect(r.classify).not.toBeNull();
    expect(r.classify.byPreset.length).toBe(1024);
    const C = r.classify.counts;
    // Los 105 duplicados byte-idénticos cubren 210 posiciones canonical; el resto
    // self-match exact (5 hermanos semánticos = 10 posiciones semantic).
    expect(C.canonical_match).toBe(210);
    expect(C.semantic_match).toBe(10);
    expect(C.exact_match).toBe(1024 - 210 - 10);
    expect(C.no_match).toBe(0);
  });

  it('--classify: cada fila tiene level1/level2 verdaderos y matchedWith coherente', () => {
    const { status, stdout } = runScript(['--classify', '--json']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    const byPreset = r.classify.byPreset;
    for (const p of byPreset) {
      expect(p.level1, `${p.bank}/${p.prog}`).toBe(true);
      expect(p.level2, `${p.bank}/${p.prog}`).toBe(true);
      expect(['exact_match', 'canonical_match', 'semantic_match']).toContain(p.classification);
      if (p.classification === 'exact_match') {
        expect(p.matchedWith).toBeNull();
      } else {
        expect(p.matchedWith).toMatch(/^[A-H]\/\d+$/);
        expect(p.matchedWith).not.toBe(`${p.bank}/${p.prog}`);
      }
    }
    // Al menos un canonical y un semantic referencian otra posición
    const canonical = byPreset.find((p) => p.classification === 'canonical_match');
    const semantic = byPreset.find((p) => p.classification === 'semantic_match');
    expect(canonical).toBeDefined();
    expect(semantic).toBeDefined();
  });

  it('sin --classify el reporte no incluye la tabla por preset', () => {
    const { status, stdout } = runScript(['--json']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    expect(r.classify).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────
// Modo Nivel 3b: --dumps-dir (dumps del HARDWARE vs corpus de fábrica)
// ────────────────────────────────────────────────────────────────

const DUMPS_DIR = path.join(ROOT, 'resources', 'hardware_dumps', '2026-08-10');
const hasDumps = fs.existsSync(path.join(DUMPS_DIR, 'manifest.json'));

describe.skipIf(!hasCorpus || !hasDumps)('roundtrip_corpus.js --dumps-dir — dumps del hardware vs corpus', () => {
  it('clasifica los 1024 presets del dump sin no_match (1023 exact + B/1 known_exception)', () => {
    const { status, stdout } = runScript(['--dumps-dir', DUMPS_DIR, '--classify', '--json']);
    expect(status, stdout).toBe(0);
    const r = extractJson(stdout);
    expect(r).not.toBeNull();
    expect(r.mode).toBe('dumps-vs-corpus');
    expect(r.dumpsLoaded).toBe(1024);
    expect(r.ok).toBe(true);
    const C = r.classify.counts;
    expect(C.exact_match).toBe(1023);
    expect(C.canonical_match).toBe(0);
    expect(C.semantic_match).toBe(0);
    expect(C.known_exception).toBe(1);
    expect(C.no_match).toBe(0);
  });

  it('B/1 es la known_exception (2 bytes en offsets 281/283, leída del manifest)', () => {
    const r = extractJson(runScript(['--dumps-dir', DUMPS_DIR, '--json']).stdout);
    expect(r.knownExceptions).toHaveLength(1);
    const ex = r.knownExceptions[0];
    expect(ex.bank).toBe('B');
    expect(ex.prog).toBe(1);
    expect(ex.reason).toContain('[281,283]');
    const b1 = r.classify.byPreset.find((p) => p.bank === 'B' && p.prog === 1);
    expect(b1.classification).toBe('known_exception');
  });

  it('directorio sin manifest → sin known_exceptions; B/1 degrada a semantic_match (clasificado, exit 0)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtdump-'));
    try {
      // Copia los dumps pero SIN manifest.json (sin excepciones registradas).
      // Los 2 bytes de cola de B/1 (offsets 281/283) caen en la región reservada
      // 223-238 → semanticEqual los ignora → B/1 se clasifica semantic_match, no
      // no_match. Sin known_exception la clasificación SÍ cubre la desviación.
      for (const L of 'ABCDEFGH') {
        fs.copyFileSync(path.join(DUMPS_DIR, `Synth Bank ${L}.syx`), path.join(tmp, `Synth Bank ${L}.syx`));
      }
      const { status, stdout } = runScript(['--dumps-dir', tmp, '--json']);
      expect(status, stdout).toBe(0);
      const r = extractJson(stdout);
      expect(r.knownExceptions).toHaveLength(0);
      expect(r.classify.counts.known_exception).toBe(0);
      expect(r.classify.counts.semantic_match).toBe(1);
      expect(r.classify.counts.no_match).toBe(0);
      const b1 = r.classify.byPreset.find((p) => p.bank === 'B' && p.prog === 1);
      expect(b1.classification).toBe('semantic_match');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('preset manipulado en bytes de PARÁMETRO (fuera de región reservada) → no_match → exit 1', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtdump-'));
    try {
      for (const L of 'ABCDEFGH') {
        fs.copyFileSync(path.join(DUMPS_DIR, `Synth Bank ${L}.syx`), path.join(tmp, `Synth Bank ${L}.syx`));
      }
      // Manipular A/0: byte 39 (filter.cutoff) del payload desempaquetado. Byte
      // empaquetado: grupo 5, posición 5 → payload offset 45 → mensaje 10+45=55.
      const a0 = path.join(tmp, 'Synth Bank A.syx');
      const fd = fs.openSync(a0, 'r+');
      fs.writeSync(fd, Buffer.from([0x7f]), 0, 1, 55);
      fs.closeSync(fd);
      const { status, stderr } = runScript(['--dumps-dir', tmp, '--json']);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::roundtrip-corpus');
      expect(stderr).toContain('Dumps [A/0]: desviación SIN clasificar');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('directorio inexistente → exit 1', () => {
    const { status, stderr } = runScript(['--dumps-dir', path.join(ROOT, 'no-existe'), '--json']);
    expect(status).toBe(1);
    expect(stderr).toContain('::error::roundtrip-corpus');
    expect(stderr).toContain('Directorio de dumps no encontrado');
  });
});
