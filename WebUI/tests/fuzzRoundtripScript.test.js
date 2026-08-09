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

  it('batería por defecto: 16 seeds × 500 casos = 8.000 casos sin violaciones', () => {
    // Corre la batería CI completa (sin --iterations) para blindar la cobertura
    // ampliada: DEFAULT_SEEDS (16) × DEFAULT_ITERATIONS (500). Coste local <1s.
    const { status, stdout } = runScript(['--json', '--budget-ms', '60000']);
    expect(status, stdout).toBe(0);
    const r = extractJson(stdout);
    expect(r.seeds).toHaveLength(16);
    expect(r.iterations).toBe(500);
    // Todos los casos por defecto pasan (equivalente a 16 × 500 = 8.000) —
    // calculado del reporte para sobrevivir a futuros cambios de batería.
    expect(r.totals.passed).toBe(r.seeds.length * r.iterations);
    expect(r.totals.failed).toBe(0);
    expect(r.totals.violations).toBe(0);
    expect(r.totals.timeouts).toBe(0);
  });

  it('la batería cubre seeds de casos límite (frontera, máscaras, patrones)', () => {
    const { status, stdout } = runScript(['--json', '--budget-ms', '60000', '--iterations', '1']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    // Los 8 seeds originales + 8 de casos límite (mínimo, máscaras de byte/16-bit,
    // bits alternados y máximo uint32) que ejercitan el PRNG y el codec.
    expect(r.seeds).toContain(0x1);
    expect(r.seeds).toContain(0x7F);
    expect(r.seeds).toContain(0xFF);
    expect(r.seeds).toContain(0x7FFF);
    expect(r.seeds).toContain(0xFFFF);
    expect(r.seeds).toContain(0x55555555);
    expect(r.seeds).toContain(0xAAAAAAAA);
    expect(r.seeds).toContain(0xFFFFFFFF);
    expect(new Set(r.seeds).size).toBe(16); // sin duplicados tras el parseo
  });

  it('--json emite un reporte estructurado con runs por seed, totals y fatal:false', () => {
    const { status, stdout } = runScript(['--json', '--budget-ms', '60000', '--iterations', '10']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    expect(r).not.toBeNull();
    expect(r.tool).toBe('fuzz_roundtrip');
    expect(r.seeds.length).toBeGreaterThanOrEqual(16);
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
