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
});
