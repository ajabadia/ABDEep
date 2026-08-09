/**
 * fuzzRoundtripScript.test.js — Fase 4/7 · fuzzing acotado multi-seed (CI)
 *
 * Ejecuta scripts/fuzz_roundtrip.js (property-based testing de fuzzRoundTrip con
 * varios seeds deterministas) como subproceso y verifica:
 *   - Exit 0 y resumen sin violaciones de propiedad para los seeds por defecto.
 *   - Reporte --json con la estructura esperada (runs por seed, totals, fatal:false).
 *   - --budget-ms amplio no introduce violaciones (los invariantes son deterministas).
 *   - --seeds 0 → exit 2 (error de uso) con ::error::fuzz-roundtrip.
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'fuzz_roundtrip.js');

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

describe('fuzz_roundtrip.js — property-based testing multi-seed', () => {
  it('exit 0 sin violaciones de propiedad para los seeds por defecto', () => {
    // Presupuesto amplio para eliminar el ruido del reloj de pared (los timeouts
    // no son deterministas; los invariantes que verifica el job sí).
    const { status, stdout } = runScript(['--budget-ms', '60000', '--iterations', '20']);
    expect(status, stdout).toBe(0);
    expect(stdout).toContain('Sin violaciones de propiedad');
  });

  it('--json emite un reporte estructurado con runs por seed, totals y fatal:false', () => {
    const { status, stdout } = runScript(['--json', '--budget-ms', '60000', '--iterations', '10']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    expect(r).not.toBeNull();
    expect(r.tool).toBe('fuzz_roundtrip');
    expect(r.seeds.length).toBeGreaterThanOrEqual(8);
    expect(r.runs.length).toBe(r.seeds.length);
    expect(r.planLimits.maxPayload).toBe(500);
    expect(r.planLimits.maxTimeoutMs).toBe(100);
    expect(r.fatal).toBe(false);
    expect(r.ok).toBe(true);
    expect(r.totals.violations).toBe(0);
    // Los seeds por defecto son deterministas → sin timeouts con presupuesto amplio
    expect(r.totals.timeouts).toBe(0);
  });

  it('--seeds concretos limita el alcance (1 seed · N casos)', () => {
    const { status, stdout } = runScript(['--seeds', '0xBEEF', '--json', '--budget-ms', '60000', '--iterations', '5']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    expect(r.seeds).toEqual([0xBEEF]);
    expect(r.runs.length).toBe(1);
    expect(r.runs[0].passed).toBe(5);
  });

  it('con el presupuesto del plan (100ms/caso) los invariantes se cumplen sin violaciones', () => {
    const { status, stdout } = runScript(['--iterations', '5']);
    expect(status, stdout).toBe(0);
  });

  it('--seeds sin valores → exit 2 (error de uso) con ::error::fuzz-roundtrip', () => {
    const { status, stderr } = runScript(['--seeds', '']);
    expect(status).toBe(2);
    expect(stderr).toContain('::error::fuzz-roundtrip');
  });

  it('--iterations inválido → exit 2 (error de uso) con ::error::fuzz-roundtrip', () => {
    const { status, stderr } = runScript(['--iterations', 'abc']);
    expect(status).toBe(2);
    expect(stderr).toContain('::error::fuzz-roundtrip');
  });
});
