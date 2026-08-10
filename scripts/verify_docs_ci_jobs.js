#!/usr/bin/env node
/**
 * @file verify_docs_ci_jobs.js
 * @purpose Verificación documental de Fase 7 (plan v3.2 §7) — contrato de los 13 jobs CI.
 *
 * Comprueba que los 13 jobs de Fase 7 listados en el plan
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
 *   3. El workflow contiene un job definido en su sección `jobs:`: cada job del
 *      contrato debe aparecer como JOB ID dentro de su workflow (tabla
 *      JOB_WORKFLOW_JOBS — el nombre del job puede diferir del nombre documentado,
 *      p. ej. `cpp-unit-tests` vive en dsp-ci.yml como job `build-and-test`).
 *   4. Mención del workflow en los bullets: el TEXTO de cada bullet `Job \`x\``
 *      (línea del bullet + líneas de continuación) en el plan Y en baseline §7
 *      debe mencionar el nombre del workflow real que lo implementa
 *      (JOB_WORKFLOWS, p. ej. `dsp-ci.yml`) — anti-drift si un bullet apunta a
 *      un workflow equivocado u omite la referencia.
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
// Contrato canónico: los 13 jobs de Fase 7 (plan v3.2 §7).
// Fuente de verdad — un job NUEVO debe añadirse AQUÍ + como bullet
// `- [x] Job \`<nombre>\`` en el plan + como bullet `- ✅ **Job \`<nombre>\`**`
// en baseline_fase0_v32.md §7, o el job docs-verification falla.
// ────────────────────────────────────────────────────────────────────────────
const EXPECTED_JOBS = [
  'allocation-audit',
  'benchmark',
  'cpp-unit-tests',
  'fase4-corpus',
  'hw-dump-validate',
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
  'hw-dump-validate': 'hardware-dump-validate.yml',
  pluginval: 'pluginval.yml',
  'property-fuzzing': 'property-fuzzing.yml',
  'registry-generation': 'registry-generation.yml',
  'roundtrip-corpus': 'roundtrip-corpus.yml',
  'schema-validation': 'schema-validation.yml',
  'security-scan': 'security-scan.yml',
  vitest: 'webui-ci.yml',
  'wasm-build': 'wasm-build.yml',
};

// Job IDs que DEBEN existir en la sección `jobs:` de cada workflow, por job del
// contrato (el nombre del job real puede diferir del nombre documentado,
// p. ej. `cpp-unit-tests` → job `build-and-test` en dsp-ci.yml).
const JOB_WORKFLOW_JOBS = {
  'allocation-audit': ['allocation-audit'],
  benchmark: ['benchmark'],
  'cpp-unit-tests': ['build-and-test'],
  'fase4-corpus': ['fase4-corpus'],
  'hw-dump-validate': ['hw-dump-validate'],
  pluginval: ['pluginval'],
  'property-fuzzing': ['property-fuzzing'],
  'registry-generation': ['registry-generation'],
  'roundtrip-corpus': ['roundtrip-corpus'],
  'schema-validation': ['schema-validation'],
  'security-scan': ['security-scan'],
  vitest: ['test-and-export'],
  'wasm-build': ['wasm-build'],
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

/**
 * Extrae el TEXTO COMPLETO de cada bullet `Job \`name\`` de una sección:
 * Map<job, texto> con la línea del bullet más sus líneas de continuación
 * (indentadas). Un bullet termina cuando aparece otra línea de lista (`- ` /
 * `* ` sin indentar) o un heading — permite validar menciones en el cuerpo
 * completo del bullet, no solo en la primera línea.
 */
function extractJobBulletTexts(section, jobRe) {
  const bullets = new Map();
  const lines = String(section).split(/\r?\n/);
  const lineRe = new RegExp(jobRe.source);
  let current = null;
  let acc = [];
  const flush = () => {
    if (current !== null) { bullets.set(current, acc.join('\n').trim()); }
  };
  for (const line of lines) {
    const m = lineRe.exec(line);
    if (m) {
      flush();
      current = m[1];
      acc = [line];
    } else if (current !== null) {
      if (/^[-*] /.test(line) || /^#{1,6} /.test(line)) {
        flush();
        current = null;
        acc = [];
      } else {
        acc.push(line);
      }
    }
  }
  flush();
  return bullets;
}

/**
 * Extrae los JOB IDs de la sección `jobs:` de un workflow YAML (formato GitHub
 * Actions: `jobs:` en columna 0 y cada job con indentación de 2 espacios).
 * Parser ligero y determinista — suficiente para el subconjunto de YAML que usa
 * este repo (sin bloques multilínea, sin anclas). Devuelve un Set de nombres.
 */
function extractJobsFromWorkflow(yamlText) {
  const jobs = new Set();
  const lines = String(yamlText).split(/\r?\n/);
  let inJobs = false;
  for (const line of lines) {
    if (!inJobs) {
      if (/^jobs:\s*$/.test(line)) { inJobs = true; }
      continue;
    }
    // Fin del bloque jobs: primera línea con indentación 0 que no sea comentario/blank.
    if (/^[^\s]/.test(line) && !/^#/.test(line) && line.trim() !== '') { break; }
    // Job ID: exactamente 2 espacios de indentación + `name:`.
    const m = /^  ([a-zA-Z0-9_-]+):\s*$/.exec(line);
    if (m) { jobs.add(m[1]); }
  }
  return jobs;
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
    missingJobDefs: [],
    planWorkflowMention: [],
    baselineWorkflowMention: [],
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

  // 2.5. Mención del workflow en los bullets de plan y baseline (anti-drift doc→workflow)
  // Se exige la ruta completa `.github/workflows/<wf>` (no solo el nombre del
  // archivo) para que la mención referencie el workflow de forma inequívoca.
  const planBullets = planSection === null ? new Map() : extractJobBulletTexts(planSection, PLAN_JOB_RE);
  const baselineBullets = baselineSection === null ? new Map() : extractJobBulletTexts(baselineSection, BASELINE_JOB_RE);
  for (const job of EXPECTED_JOBS) {
    const wf = JOB_WORKFLOWS[job];
    const planText = planBullets.get(job);
    if (planText !== undefined && !planText.includes('.github/workflows/' + wf)) {
      report.planWorkflowMention.push(job + ' → bullet no menciona .github/workflows/' + wf);
      report.problems.push('plan: el bullet de ' + job + ' no menciona su workflow (.github/workflows/' + wf + ')');
    }
    const baselineText = baselineBullets.get(job);
    if (baselineText !== undefined && !baselineText.includes('.github/workflows/' + wf)) {
      report.baselineWorkflowMention.push(job + ' → bullet no menciona .github/workflows/' + wf);
      report.problems.push('baseline §7: el bullet de ' + job + ' no menciona su workflow (.github/workflows/' + wf + ')');
    }
  }

  // 3. Workflows reales: el archivo existe Y contiene un job con el ID esperado
  for (const job of EXPECTED_JOBS) {
    const wf = JOB_WORKFLOWS[job];
    const wfPath = path.join(opts.workflowsDir, wf);
    if (!fs.existsSync(wfPath)) {
      report.missingWorkflows.push(job + ' → ' + wf);
      report.problems.push('workflow faltante para ' + job + ' (' + wf + ')');
      continue;
    }
    const expectedJobIds = JOB_WORKFLOW_JOBS[job];
    const actualJobs = extractJobsFromWorkflow(fs.readFileSync(wfPath, 'utf8'));
    const missing = (expectedJobIds || []).filter((jid) => !actualJobs.has(jid));
    if (missing.length > 0) {
      report.missingJobDefs.push(job + ' → ' + wf + ' (job ' + missing.join(', ') + ')');
      report.problems.push(
        'workflow ' + wf + ' no define el job esperado para ' + job + ' (' + missing.join(', ') + ')',
      );
    }
  }

  report.ok = report.problems.length === 0;
  finish(report, opts.wantJson, report.ok ? 0 : 1);
}

function finish(report, wantJson, exitCode) {
  const lines = [
    '='.repeat(64),
    '📄 DOCS VERIFICATION (Fase 7 §7) — 13 jobs del plan vs baseline',
    '='.repeat(64),
    'Plan (Job bullets): ' + (report.planJobs.length > 0 ? report.planJobs.join(', ') : '—'),
    'Baseline §7 (Job bullets): ' + (report.baselineJobs.length > 0 ? report.baselineJobs.join(', ') : '—'),
  ];

  if (report.ok) {
    lines.push('\n✅ OK — los 13 jobs de Fase 7 del plan coinciden con baseline_fase0_v32.md §7, tienen workflow real y sus bullets mencionan el workflow correcto.');
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
  module.exports = { EXPECTED_JOBS, JOB_WORKFLOWS, JOB_WORKFLOW_JOBS, PLAN_JOB_RE, BASELINE_JOB_RE, extractSection, extractJobNames, extractJobBulletTexts, extractJobsFromWorkflow, setEquals };
  if (require.main === module) {
    main();
  }
} else {
  main();
}
