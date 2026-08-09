#!/usr/bin/env node
/**
 * @file verify_docs_ci_jobs.js
 * @purpose Verificación documental de Fase 7 (plan v3.2 §7) — contrato de los 12 jobs CI.
 *
 * Comprueba que los 12 jobs de Fase 7 listados en el plan
 * (`implementation_plan architecture.md`, sección `### Fase 7: Pipeline CI/CD Reproducible`)
 * COINCIDEN con los documentados en `docs/baseline_fase0_v32.md` §7
 * (`## 7. CI — estado de Fase 7`), y que cada job tiene un workflow real en
 * `.github/workflows/`:
 *
 *   1. Igualdad de conjuntos (bidireccional): cada bullet `Job \`nombre\`` del plan
 *      (formato `- [x] Job \`x\``) debe estar en EXPECTED_JOBS y en §7 (formato
 *      `- ✅ **Job \`x\`**`); cualquier job faltante O extra en cualquiera de los
 *      dos docs hace fallar el check (anti-drift entre plan y doc). La extracción
 *      está ANCLADA al prefijo de bullet: menciones narrativas sueltas de
 *      `Job \`x\`` (fuera de un bullet) NO se cuentan.
 *   2. Existencia del workflow real asociado a cada job (tabla JOB_WORKFLOWS).
 *      Caveat: solo comprueba que el ARCHIVO existe, no que implemente el job
 *      (p. ej. `cpp-unit-tests` vive en dsp-ci.yml como job `build-and-test`).
 *
 * Uso:
 *   node scripts/verify_docs_ci_jobs.js [--plan-file implementation_plan\ architecture.md]
 *     [--baseline-file docs/baseline_fase0_v32.md] [--workflows-dir .github/workflows]
 *     [--json]
 *
 * Exit code: 0 = OK · 1 = violaciones · 2 = error de uso.
 */

const fs = require('fs');
const path = require('path');

// ────────────────────────────────────────────────────────────────────────────
// Contrato canónico: los 12 jobs de Fase 7 (plan v3.2 §7).
// Fuente de verdad — un job NUEVO debe añadirse AQUÍ + como bullet
// `- [x] Job \`<nombre>\`` en el plan + como bullet `- ✅ **Job \`<nombre>\`**`
// en baseline_fase0_v32.md §7, o el job docs-verification falla.
// ────────────────────────────────────────────────────────────────────────────
const EXPECTED_JOBS = [
  'allocation-audit',
  'benchmark',
  'cpp-unit-tests',
  'fase4-corpus',
  'pluginval',
  'property-fuzzing',
  'registry-generation',
  'roundtrip-corpus',
  'schema-validation',
  'security-scan',
  'vitest',
  'wasm-build',
];

// Workflow real que implementa cada job (varios jobs comparten dsp-ci.yml /
// roundtrip-corpus.yml / webui-ci.yml).
const JOB_WORKFLOWS = {
  'allocation-audit': 'dsp-ci.yml',
  benchmark: 'dsp-ci.yml',
  'cpp-unit-tests': 'dsp-ci.yml',
  'fase4-corpus': 'roundtrip-corpus.yml',
  pluginval: 'pluginval.yml',
  'property-fuzzing': 'property-fuzzing.yml',
  'registry-generation': 'registry-generation.yml',
  'roundtrip-corpus': 'roundtrip-corpus.yml',
  'schema-validation': 'schema-validation.yml',
  'security-scan': 'security-scan.yml',
  vitest: 'webui-ci.yml',
  'wasm-build': 'wasm-build.yml',
};

// Rutas por defecto — relativas al REPO (resueltas contra __dirname para que el
// script funcione desde cualquier cwd). Override con --plan-file/--baseline-file/
// --workflows-dir (usados por los tests negativos).
const DEFAULT_PLAN_FILE = path.resolve(__dirname, '..', 'implementation_plan architecture.md');
const DEFAULT_BASELINE_FILE = path.resolve(__dirname, '..', 'docs', 'baseline_fase0_v32.md');
const DEFAULT_WORKFLOWS_DIR = path.resolve(__dirname, '..', '.github', 'workflows');

// ────────────────────────────────────────────────────────────────────────────
// Extracción
// ────────────────────────────────────────────────────────────────────────────

// Formato bullet del plan: `- [x] Job \`name\` (...)`. Anclado a inicio de línea
// para ignorar menciones narrativas de `Job \`x\`` fuera de un bullet.
const PLAN_JOB_RE = /^- \[x\] Job `([a-z0-9-]+)`/gm;

// Formato bullet de baseline §7: `- ✅ **Job \`name\` ...` (el nombre puede ir
// seguido de texto, p. ej. "Job `vitest` + lint" — sin exigir `**` de cierre).
const BASELINE_JOB_RE = /^- ✅ \*\*Job `([a-z0-9-]+)`/gm;

/** Devuelve el slice entre startRe (inclusive) y la primera línea que casa endRe. */
function extractSection(text, startRe, endRe) {
  const startMatch = startRe.exec(text);
  if (!startMatch) { return null; }
  const after = text.slice(startMatch.index + startMatch[0].length);
  const endMatch = endRe.exec(after);
  return endMatch ? after.slice(0, endMatch.index) : after;
}

/** Conjunto de nombres de los bullets `Job \`name\`` de una sección (regex anclada). */
function extractJobNames(section, jobRe) {
  const names = new Set();
  const re = new RegExp(jobRe.source, jobRe.flags.includes('m') ? 'gm' : 'g');
  let m;
  while ((m = re.exec(section)) !== null) { names.add(m[1]); }
  return names;
}

function setDifference(a, b) {
  return [...a].filter((x) => !b.has(x)).sort();
}

function setEquals(a, b) {
  if (a.size !== b.size) { return false; }
  for (const x of a) { if (!b.has(x)) { return false; } }
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    planFile: DEFAULT_PLAN_FILE,
    baselineFile: DEFAULT_BASELINE_FILE,
    workflowsDir: DEFAULT_WORKFLOWS_DIR,
    wantJson: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plan-file') { opts.planFile = path.resolve(args[++i]); }
    else if (args[i] === '--baseline-file') { opts.baselineFile = path.resolve(args[++i]); }
    else if (args[i] === '--workflows-dir') { opts.workflowsDir = path.resolve(args[++i]); }
    else if (args[i] === '--json') { opts.wantJson = true; }
  }
  return opts;
}

function main() {
  const opts = parseArgs();
  const report = {
    schemaVersion: 1,
    tool: 'verify_docs_ci_jobs',
    expectedJobs: [...EXPECTED_JOBS],
    planFile: opts.planFile,
    baselineFile: opts.baselineFile,
    workflowsDir: opts.workflowsDir,
    planSectionFound: false,
    baselineSectionFound: false,
    planJobs: [],
    baselineJobs: [],
    missingInPlan: [],
    extraInPlan: [],
    missingInBaseline: [],
    extraInBaseline: [],
    missingWorkflows: [],
    problems: [],
  };

  let planText = null;
  let baselineText = null;
  try {
    planText = fs.readFileSync(opts.planFile, 'utf8');
    baselineText = fs.readFileSync(opts.baselineFile, 'utf8');
  } catch (e) {
    report.problems.push('no se pudo leer un documento: ' + e.message);
    finish(report, opts.wantJson, 1);
    return;
  }

  const expected = new Set(EXPECTED_JOBS);

  // 1. Plan — sección Fase 7
  const planSection = extractSection(planText, /### Fase 7: Pipeline CI\/CD Reproducible/, /^## /m);
  if (planSection === null) {
    report.problems.push('sección "### Fase 7: Pipeline CI/CD Reproducible" no encontrada en el plan');
  } else {
    report.planSectionFound = true;
    const planJobs = extractJobNames(planSection, PLAN_JOB_RE);
    report.planJobs = [...planJobs].sort();
    report.missingInPlan = setDifference(expected, planJobs);
    report.extraInPlan = setDifference(planJobs, expected);
    if (!setEquals(planJobs, expected)) {
      if (report.missingInPlan.length > 0) {
        report.problems.push('plan Fase 7 no lista (Job bullet) — ' + report.missingInPlan.join(', '));
      }
      if (report.extraInPlan.length > 0) {
        report.problems.push('plan Fase 7 lista Job(s) fuera del contrato — ' + report.extraInPlan.join(', '));
      }
    }
  }

  // 2. Baseline — sección §7
  const baselineSection = extractSection(baselineText, /## 7\. CI — estado de Fase 7/, /^## 8\./m);
  if (baselineSection === null) {
    report.problems.push('sección "## 7. CI — estado de Fase 7" no encontrada en baseline_fase0_v32.md');
  } else {
    report.baselineSectionFound = true;
    const baselineJobs = extractJobNames(baselineSection, BASELINE_JOB_RE);
    report.baselineJobs = [...baselineJobs].sort();
    report.missingInBaseline = setDifference(expected, baselineJobs);
    report.extraInBaseline = setDifference(baselineJobs, expected);
    if (!setEquals(baselineJobs, expected)) {
      if (report.missingInBaseline.length > 0) {
        report.problems.push('baseline §7 no documenta (Job bullet) — ' + report.missingInBaseline.join(', '));
      }
      if (report.extraInBaseline.length > 0) {
        report.problems.push('baseline §7 documenta Job(s) fuera del contrato — ' + report.extraInBaseline.join(', '));
      }
    }
  }

  // 3. Workflows reales
  for (const job of EXPECTED_JOBS) {
    const wf = JOB_WORKFLOWS[job];
    const wfPath = path.join(opts.workflowsDir, wf);
    if (!fs.existsSync(wfPath)) {
      report.missingWorkflows.push(job + ' → ' + wf);
      report.problems.push('workflow faltante para ' + job + ' (' + wf + ')');
    }
  }

  report.ok = report.problems.length === 0;
  finish(report, opts.wantJson, report.ok ? 0 : 1);
}

function finish(report, wantJson, exitCode) {
  const lines = [
    '='.repeat(64),
    '📄 DOCS VERIFICATION (Fase 7 §7) — 12 jobs del plan vs baseline',
    '='.repeat(64),
    'Plan (Job bullets): ' + (report.planJobs.length > 0 ? report.planJobs.join(', ') : '—'),
    'Baseline §7 (Job bullets): ' + (report.baselineJobs.length > 0 ? report.baselineJobs.join(', ') : '—'),
  ];

  if (report.ok) {
    lines.push('\n✅ OK — los 12 jobs de Fase 7 del plan coinciden con baseline_fase0_v32.md §7 y tienen workflow real.');
  } else {
    lines.push('\n❌ Violaciones:');
    for (const p of report.problems) {
      lines.push('  - ' + p);
      process.stderr.write('::error::docs-verification — ' + p + '\n');
    }
  }

  process.stdout.write(lines.join('\n') + '\n');
  if (wantJson) {
    process.stdout.write('\n---JSON---\n');
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  }
  process.exitCode = exitCode;
}

// Los tests (webui-ci) importan las constantes sin ejecutar el script: main()
// solo corre cuando se invoca como CLI (node scripts/verify_docs_ci_jobs.js).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EXPECTED_JOBS, JOB_WORKFLOWS, PLAN_JOB_RE, BASELINE_JOB_RE, extractSection, extractJobNames, setEquals };
  if (require.main === module) {
    main();
  }
} else {
  main();
}
