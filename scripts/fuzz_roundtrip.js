#!/usr/bin/env node
/**
 * @file fuzz_roundtrip.js
 * @purpose Fase 7 (plan v3.2 §5) — Property-Based Testing / Fuzzing acotado en CI.
 *
 * Ejecuta `fuzzRoundTrip` (roundtrip_equality.js) con VARIOS seeds deterministas
 * y el registro canónico real (registry.gen.js), agregando las violaciones:
 *   - codec_invariance          → invariante Nivel 1 roto (FATAL, falla CI)
 *   - codec_payload_bound       → codec emitió > 242 bytes (FATAL)
 *   - codec_throws              → el codec lanzó excepción (FATAL)
 *   - decode_encode_stability   → invariante Nivel 2 roto (FATAL)
 *   - timeout                   → caso excedió el presupuesto temporal (WARNING)
 *
 * Política de CI: las violaciones de PROPIEDAD (deterministas) fallan el job; los
 * timeouts dependen del reloj de pared y NO son deterministas — se reportan como
 * warning para no romper la CI por ruido de runner (los invariantes se verifican
 * con presupuesto amplio vía `--budget-ms`, ver abajo).
 *
 * Uso:
 *   node scripts/fuzz_roundtrip.js                      # seeds por defecto
 *   node scripts/fuzz_roundtrip.js --seeds 1,2,3        # seeds concretos
 *   node scripts/fuzz_roundtrip.js --iterations 500     # casos por seed
 *   node scripts/fuzz_roundtrip.js --budget-ms 60000    # presupuesto temporal amplio
 *   node scripts/fuzz_roundtrip.js --json               # reporte JSON en stdout
 *   node scripts/fuzz_roundtrip.js --out report.json
 *
 * Exit code: 0 = OK · 1 = violaciones de propiedad (fatal) · 2 = errores de uso.
 */

const path = require('path');
const fs = require('fs');

const RTE = require('../WebUI/js/roundtrip_equality.js');
const REGISTRY = require('../WebUI/js/registry.gen.js');

// Seeds deterministas de la batería (los mismos que el test unitario + casos límite).
// 16 seeds: los 8 originales + valores frontera/patrones que ejercitan el PRNG
// mulberry32 y el codec 7/8 (mínimo, máscaras de byte/16 bits, bits alternados,
// máximo uint32) para ampliar la cobertura de propiedades en CI.
const DEFAULT_SEEDS = [
  0xC0FFEE, 0xBEEF, 0x1234, 0xDEAD, 0xF00D, 0xABCDEF, 0x13579, 0x2468A,
  0x1, 0x7F, 0xFF, 0x7FFF, 0xFFFF, 0x55555555, 0xAAAAAAAA, 0xFFFFFFFF,
];
// 16 seeds × 500 casos = 8.000 casos por corrida CI (5× la batería original de
// 8×200=1.600). El coste medido es <1s en total (máx 1ms/caso), así que ampliar
// la cobertura no penaliza el tiempo del job.
const DEFAULT_ITERATIONS = 500;

// Acepta decimal (48879) y hex (0xBEEF) — parseInt('0xBEEF', 10) devolvería 0.
function parseSeed(str) {
  const s = str.trim();
  const radix = /^0x/i.test(s) ? 16 : 10;
  return parseInt(s, radix);
}

function parseArgs() {
  const args = process.argv.slice(2);
  let seeds = DEFAULT_SEEDS;
  let iterations = DEFAULT_ITERATIONS;
  let budgetMs = undefined;
  let wantJson = false;
  let outFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seeds') {
      seeds = args[++i].split(',').map(parseSeed).filter((n) => !Number.isNaN(n));
      if (seeds.length === 0) {
        process.stderr.write('::error::fuzz-roundtrip — --seeds vacío\n');
        process.exit(2);
      }
    } else if (args[i] === '--iterations') {
      iterations = parseInt(args[++i], 10);
      if (!Number.isFinite(iterations) || iterations < 1) {
        process.stderr.write('::error::fuzz-roundtrip — --iterations inválido\n');
        process.exit(2);
      }
    } else if (args[i] === '--budget-ms') {
      budgetMs = parseInt(args[++i], 10);
      if (!Number.isFinite(budgetMs) || budgetMs < 1) {
        process.stderr.write('::error::fuzz-roundtrip — --budget-ms inválido\n');
        process.exit(2);
      }
    } else if (args[i] === '--json') {
      wantJson = true;
    } else if (args[i] === '--out') {
      outFile = args[++i];
    }
  }
  return { seeds, iterations, budgetMs, wantJson, outFile };
}

function main() {
  const { seeds, iterations, budgetMs, wantJson, outFile } = parseArgs();

  const report = {
    schemaVersion: 1,
    tool: 'fuzz_roundtrip',
    generatedAt: new Date().toISOString(),
    // Los límites del plan se leen del MÓDULO (fuente de verdad única): si el
    // fuzzing cambiara sus presupuestos, el reporte CI los reflejaría.
    planLimits: { maxPayload: RTE.FUZZ_MAX_PAYLOAD, maxTimeoutMs: RTE.FUZZ_MAX_TIMEOUT_MS },
    seeds,
    iterations,
    runs: [],
    totals: { passed: 0, failed: 0, violations: 0, timeouts: 0, maxCaseMs: 0 },
    violations: [],
    fatal: false,
  };

  for (const seed of seeds) {
    // El presupuesto temporal del plan (100ms/caso) se aplica por defecto. En CI
    // (runner compartido) el reloj de pared puede superarlo sin que haya un bug:
    // --budget-ms amplio desactiva esa fuente de ruido (los invariantes son
    // deterministas; el timeout no).
    const run = RTE.fuzzRoundTrip({
      seed,
      iterations,
      registry: REGISTRY,
      maxTimeoutMs: budgetMs !== undefined ? budgetMs : RTE.FUZZ_MAX_TIMEOUT_MS,
    });

    report.runs.push({
      seed,
      passed: run.passed,
      failed: run.failed,
      maxCaseMs: run.maxCaseMs,
      violations: run.violations,
    });

    report.totals.passed += run.passed;
    report.totals.failed += run.failed;
    report.totals.maxCaseMs = Math.max(report.totals.maxCaseMs, run.maxCaseMs);

    for (const v of run.violations) {
      const entry = { seed, ...v };
      report.violations.push(entry);
      if (v.property === 'timeout') {
        report.totals.timeouts++;
      } else {
        report.totals.violations++;
      }
    }
  }

  // Los timeouts NO fallan el job (dependen del reloj de pared): se reportan como
  // warning. Las violaciones de propiedad (deterministas) sí fallan.
  report.fatal = report.totals.violations > 0;
  report.ok = !report.fatal;

  finish(report, wantJson, outFile, report.fatal ? 1 : 0);
}

function finish(report, wantJson, outFile, exitCode) {
  const L = report.planLimits;
  const lines = [
    '='.repeat(64),
    '🔬 PROPERTY FUZZING (Fase 4/7) — fuzzRoundTrip acotado multi-seed',
    '='.repeat(64),
    `Seeds: ${report.seeds.length} · ${report.seeds.join(',')} · ${report.iterations} casos/seed`,
    `Límites del plan: Max Payload ${L.maxPayload}B · Max Timeout ${L.maxTimeoutMs}ms/caso`,
    `Totales: ${report.totals.passed} pasados · ${report.totals.failed} fallidos · ${report.totals.violations} violaciones de propiedad · ${report.totals.timeouts} timeout(s)`,
    `Máximo tiempo por caso: ${report.totals.maxCaseMs}ms`,
  ];

  if (report.totals.timeouts > 0) {
    lines.push('\n⚠️  Timeouts (no deterministas — reloj de pared; no fallan CI):');
    for (const v of report.violations) {
      if (v.property === 'timeout') {
        lines.push(`  seed ${v.seed} · caso ${v.case} · ${v.caseMs}ms (max ${v.maxTimeoutMs}ms)`);
      }
    }
  }
  if (report.totals.violations > 0) {
    lines.push('\n❌ Violaciones de propiedad (deterministas — fallan CI):');
    for (const v of report.violations) {
      if (v.property !== 'timeout') {
        lines.push(`  seed ${v.seed} · caso ${v.case} · ${v.property} · ${v.detail || ''}`);
      }
    }
  } else if (report.totals.timeouts === 0) {
    lines.push('\n✅ Sin violaciones de propiedad ni timeouts en todos los seeds.');
  }

  const out = lines.join('\n') + '\n';
  process.stdout.write(out);
  for (const v of report.violations) {
    if (v.property !== 'timeout') {
      process.stderr.write(`::error::fuzz-roundtrip — seed ${v.seed} caso ${v.case}: ${v.property} ${v.detail || ''}\n`);
    }
  }
  if (report.fatal) {
    process.stderr.write('::error::fuzz-roundtrip — violaciones de propiedad encontradas (ver reporte).\n');
  }

  if (wantJson) {
    process.stdout.write('\n---JSON---\n');
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  }
  if (outFile) {
    fs.writeFileSync(path.resolve(outFile), JSON.stringify(report, null, 2) + '\n');
  }
  process.exitCode = exitCode;
}

main();
