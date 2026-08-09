/**
 * verifyDocsCiJobs.test.js — verificación documental de Fase 7 (plan v3.2 §7).
 *
 * Cubre scripts/verify_docs_ci_jobs.js (job CI docs-verification):
 *   - Contrato canónico: EXPECTED_JOBS (12 jobs) y JOB_WORKFLOWS (1:1 de existencia).
 *   - Extracción: extractSection / extractJobNames / setEquals sobre contenido sintético.
 *   - Integración positiva: el script real sobre los docs COMMITEADOS → exit 0.
 *   - Integración negativa (con --overrides): job faltante / extra en baseline o plan,
 *     workflow ausente → exit 1 con `::error::docs-verification`.
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
const SCRIPT = path.join(ROOT, 'scripts', 'verify_docs_ci_jobs.js');
const REAL_WORKFLOWS = path.join(ROOT, '.github', 'workflows');

const require = createRequire(import.meta.url);
const {
  EXPECTED_JOBS, JOB_WORKFLOWS, JOB_WORKFLOW_JOBS, PLAN_JOB_RE, BASELINE_JOB_RE,
  extractSection, extractJobNames, extractJobBulletTexts, extractJobsFromWorkflow, setEquals,
} = require(SCRIPT);

// Jobs por defecto para cada workflow sintético — DERIVADO de JOB_WORKFLOW_JOBS
// (fuente de verdad) para que el test no duplique el contrato: workflow → [job IDs]
// es el inverso de job → workflow (JOB_WORKFLOWS) + job → job IDs.
function buildDefaultWorkflowJobs() {
  const byWf = {};
  for (const job of EXPECTED_JOBS) {
    const wf = JOB_WORKFLOWS[job];
    (byWf[wf] = byWf[wf] || []).push(...JOB_WORKFLOW_JOBS[job]);
  }
  return byWf;
}
const DEFAULT_WORKFLOW_JOBS = buildDefaultWorkflowJobs();

// ────────────────────────────────────────────────────────────────────────────
// Helpers: docs sintéticos mínimos con las secciones que el script parsea.
// ────────────────────────────────────────────────────────────────────────────

function buildPlan(jobs) {
  const bullets = jobs
    .map((j) => {
      const wf = JOB_WORKFLOWS[j] || 'unknown.yml';
      return `- [x] Job \`${j}\` (\`.github/workflows/${wf}\`): bullet de prueba`;
    })
    .join('\n');
  return '### Fase 7: Pipeline CI/CD Reproducible\n' + bullets + '\n\n## 🧪 8. Criterios de Aceptación Definitivos\n';
}

function buildBaseline(jobs) {
  const bullets = jobs
    .map((j) => {
      const wf = JOB_WORKFLOWS[j] || 'unknown.yml';
      return `- ✅ **Job \`${j}\`** en \`.github/workflows/${wf}\`: bullet de prueba`;
    })
    .join('\n');
  return '## 7. CI — estado de Fase 7\n' + bullets + '\n\n## 8. Estado y próximos pasos\n';
}

function buildWorkflowContent(jobs) {
  const jobLines = (jobs || []).map((j) => `  ${j}:\n    runs-on: ubuntu-latest\n`).join('');
  return 'name: test\n\njobs:\n' + jobLines;
}

/**
 * Crea un temp dir con docs y workflows. `workflows` puede ser:
 *   - array de nombres: cada uno recibe sus jobs por defecto (DEFAULT_WORKFLOW_JOBS);
 *   - objeto { nombre: [jobIds] | [] }: jobs explícitos ([] = workflow sin jobs).
 */
function writeTemp({ plan, baseline, workflows }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docsci-'));
  const planFile = path.join(dir, 'plan.md');
  const baselineFile = path.join(dir, 'baseline.md');
  const workflowsDir = path.join(dir, 'workflows');
  fs.writeFileSync(planFile, plan);
  fs.writeFileSync(baselineFile, baseline);
  if (workflows) {
    fs.mkdirSync(workflowsDir, { recursive: true });
    const list = Array.isArray(workflows)
      ? workflows.map((w) => [w, DEFAULT_WORKFLOW_JOBS[w] || []])
      : Object.entries(workflows);
    for (const [wf, jobs] of list) {
      fs.writeFileSync(path.join(workflowsDir, wf), buildWorkflowContent(jobs));
    }
  }
  return { dir, planFile, baselineFile, workflowsDir };
}

function runScript(args) {
  let stdout = '';
  let stderr = '';
  let status = 0;
  try {
    stdout = execFileSync(process.execPath, [SCRIPT, ...args], {
      cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    status = e.status ?? 1;
    stdout = String(e.stdout || '');
    stderr = String(e.stderr || '');
  }
  return { status, stdout, stderr };
}

// ────────────────────────────────────────────────────────────────────────────
// Contrato canónico
// ────────────────────────────────────────────────────────────────────────────

describe('verify_docs_ci_jobs.js — contrato de Fase 7', () => {
  it('EXPECTED_JOBS son exactamente los 12 jobs de Fase 7 (ordenados)', () => {
    expect(EXPECTED_JOBS).toHaveLength(12);
    expect(EXPECTED_JOBS).toEqual([...EXPECTED_JOBS].sort());
    expect(EXPECTED_JOBS).toEqual([
      'allocation-audit', 'benchmark', 'cpp-unit-tests', 'fase4-corpus', 'pluginval',
      'property-fuzzing', 'registry-generation', 'roundtrip-corpus', 'schema-validation',
      'security-scan', 'vitest', 'wasm-build',
    ]);
  });

  it('JOB_WORKFLOWS cubre exactamente EXPECTED_JOBS (claves 1:1)', () => {
    expect(Object.keys(JOB_WORKFLOWS).sort()).toEqual([...EXPECTED_JOBS].sort());
  });

  it('JOB_WORKFLOW_JOBS cubre exactamente EXPECTED_JOBS y cada job tiene al menos 1 job ID', () => {
    expect(Object.keys(JOB_WORKFLOW_JOBS).sort()).toEqual([...EXPECTED_JOBS].sort());
    for (const [job, ids] of Object.entries(JOB_WORKFLOW_JOBS)) {
      expect(ids.length, job + ' sin job ID mapeado').toBeGreaterThan(0);
      // El workflow referenciado por el job debe existir en el repo
      expect(fs.existsSync(path.join(REAL_WORKFLOWS, JOB_WORKFLOWS[job])), JOB_WORKFLOWS[job]).toBe(true);
    }
  });

  it('cada workflow del contrato existe en .github/workflows/', () => {
    for (const wf of Object.values(JOB_WORKFLOWS)) {
      expect(fs.existsSync(path.join(REAL_WORKFLOWS, wf)), 'falta ' + wf).toBe(true);
    }
  });

  it('todos los workflows reales definen un job con el ID esperado (validación en vivo)', () => {
    for (const [job, ids] of Object.entries(JOB_WORKFLOW_JOBS)) {
      const wf = JOB_WORKFLOWS[job];
      const content = fs.readFileSync(path.join(REAL_WORKFLOWS, wf), 'utf8');
      const actual = extractJobsFromWorkflow(content);
      for (const jid of ids) {
        expect(actual.has(jid), job + ' → ' + wf + ' debería definir job ' + jid).toBe(true);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Extracción (unit)
// ────────────────────────────────────────────────────────────────────────────

describe('verify_docs_ci_jobs.js — extracción de secciones', () => {
  it('extractSection aísla la sección Fase 7 del plan (hasta el siguiente ##)', () => {
    const plan = buildPlan(['vitest', 'wasm-build']);
    const section = extractSection(plan, /### Fase 7: Pipeline CI\/CD Reproducible/, /^## /m);
    expect(section).not.toBeNull();
    expect(section).toContain('Job `vitest`');
    expect(section).not.toContain('Criterios de Aceptación');
  });

  it('extractJobNames (baseline) devuelve el conjunto de bullets Job', () => {
    const section = buildBaseline(['wasm-build', 'vitest', 'wasm-build']);
    expect(extractJobNames(section, BASELINE_JOB_RE)).toEqual(new Set(['wasm-build', 'vitest']));
  });

  it('extractJobNames (plan) ignora menciones narrativas fuera de bullets', () => {
    const section = 'texto suelto: el Job `pluginval` corre en CI\n- [x] Job `vitest` (workflow): bullet\n- [x] Job `wasm-build` (workflow): bullet\n';
    expect(extractJobNames(section, PLAN_JOB_RE)).toEqual(new Set(['vitest', 'wasm-build']));
  });

  it('extractJobNames (baseline) ignora "job" en minúsculas y no-bullets', () => {
    const section = 'job `docs-verification` y (`docs-verification.yml`)\n- ✅ **Job `pluginval`** en workflow\n';
    expect(extractJobNames(section, BASELINE_JOB_RE)).toEqual(new Set(['pluginval']));
  });

  it('setEquals compara conjuntos por contenido', () => {
    expect(setEquals(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true);
    expect(setEquals(new Set(['a']), new Set(['a', 'b']))).toBe(false);
  });

  it('extractJobBulletTexts captura la línea del bullet y sus continuaciones', () => {
    const section = [
      '- [x] Job `pluginval` (`.github/workflows/pluginval.yml`): valida el VST3',
      '  con pluginval pinneda a v1.0.4 en windows-2022.',
      '- [x] Job `wasm-build` (`.github/workflows/wasm-build.yml`): compila',
    ].join('\n');
    const bullets = extractJobBulletTexts(section, PLAN_JOB_RE);
    expect(bullets.get('pluginval')).toContain('.github/workflows/pluginval.yml');
    expect(bullets.get('pluginval')).toContain('v1.0.4');
    expect(bullets.get('wasm-build')).toContain('.github/workflows/wasm-build.yml');
  });

  it('extractJobBulletTexts: la mención del workflow en una línea de continuación vale como mención del bullet', () => {
    // El workflow solo aparece en la 2ª línea (continuación indentada) — la
    // validación 2.5 exige que el texto COMPLETO del bullet lo mencione.
    const section = [
      '- [x] Job `benchmark`: 18 escenarios × 3 repeticiones',
      '  (`.github/workflows/dsp-ci.yml`): en windows-2022 dedicado',
      '- [x] Job `vitest` (`.github/workflows/webui-ci.yml`): suite completa',
    ].join('\n');
    const bullets = extractJobBulletTexts(section, PLAN_JOB_RE);
    expect(bullets.get('benchmark')).toContain('.github/workflows/dsp-ci.yml');
    expect(bullets.get('vitest')).toContain('.github/workflows/webui-ci.yml');
  });

  it('extractJobBulletTexts corta el bullet en la siguiente línea de lista o heading', () => {
    const section = [
      '- [x] Job `vitest` (`.github/workflows/webui-ci.yml`): suite completa',
      '- 🔎 **Verificación documental**: no es un job',
      '- [x] Job `benchmark` (`.github/workflows/dsp-ci.yml`): 18 escenarios',
      '  en windows-2022',
      '## Otra sección',
    ].join('\n');
    const bullets = extractJobBulletTexts(section, PLAN_JOB_RE);
    expect(bullets.get('vitest')).not.toContain('Verificación documental');
    expect(bullets.get('benchmark')).toContain('windows-2022');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// extractJobsFromWorkflow (unit)
// ────────────────────────────────────────────────────────────────────────────

describe('verify_docs_ci_jobs.js — extractJobsFromWorkflow', () => {
  it('extrae los job IDs de la sección jobs:', () => {
    const yaml = 'name: test\non:\n  push:\n    branches: [main]\n\njobs:\n  build-and-test:\n    runs-on: ubuntu-latest\n  allocation-audit:\n    runs-on: ubuntu-latest\n';
    expect(extractJobsFromWorkflow(yaml)).toEqual(new Set(['build-and-test', 'allocation-audit']));
  });

  it('ignora claves fuera de jobs: (on, permissions, concurrency) y jobs anidados', () => {
    const yaml = 'on:\n  push:\n    branches: [main]\npermissions:\n  contents: read\njobs:\n  security-scan:\n    runs-on: ubuntu-latest\n';
    expect(extractJobsFromWorkflow(yaml)).toEqual(new Set(['security-scan']));
  });

  it('devuelve Set vacío si no hay sección jobs:', () => {
    expect(extractJobsFromWorkflow('name: solo\n')).toEqual(new Set());
  });

  it('maneja CRLF (Windows) sin romperse', () => {
    const yaml = 'name: test\r\njobs:\r\n  pluginval:\r\n    runs-on: windows-2022\r\n';
    expect(extractJobsFromWorkflow(yaml)).toEqual(new Set(['pluginval']));
  });

  it('jobs: como ÚLTIMA clave top-level (sin texto posterior) extrae igual', () => {
    const yaml = 'name: test\non:\n  push:\njobs:\n  wasm-build:\n    runs-on: ubuntu-latest\n';
    expect(extractJobsFromWorkflow(yaml)).toEqual(new Set(['wasm-build']));
  });

  it('comentarios y líneas en blanco dentro de jobs: no se confunden con job IDs', () => {
    const yaml = 'jobs:\n  # primer job\n  security-scan:\n    runs-on: ubuntu-latest\n\n  # segundo\n  schema-validation:\n    runs-on: ubuntu-latest\n';
    expect(extractJobsFromWorkflow(yaml)).toEqual(new Set(['security-scan', 'schema-validation']));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Integración: script real sobre los docs commiteados (contrato vigente)
// ────────────────────────────────────────────────────────────────────────────

describe('verify_docs_ci_jobs.js — docs commiteados', () => {
  it('exit 0: los 12 jobs del plan coinciden con baseline §7 y tienen workflow', () => {
    const { status, stdout } = runScript([]);
    expect(status, stdout).toBe(0);
    expect(stdout).toContain('✅ OK');
  });

  it('--json: reporte con planJobs == baselineJobs == expectedJobs', () => {
    const { status, stdout } = runScript(['--json']);
    expect(status).toBe(0);
    const r = extractJson(stdout);
    expect(r).not.toBeNull();
    expect(r.tool).toBe('verify_docs_ci_jobs');
    expect(r.ok).toBe(true);
    expect(r.planJobs).toEqual(r.baselineJobs);
    expect(r.planJobs).toEqual(r.expectedJobs);
    expect(r.missingWorkflows).toEqual([]);
  });

  it('los bullets reales de plan y baseline mencionan el workflow correcto (anti-drift doc→workflow)', () => {
    const planText = fs.readFileSync(path.join(ROOT, 'implementation_plan architecture.md'), 'utf8');
    const baselineText = fs.readFileSync(path.join(ROOT, 'docs', 'baseline_fase0_v32.md'), 'utf8');
    const planSection = extractSection(planText, /### Fase 7: Pipeline CI\/CD Reproducible/, /^## /m);
    const baselineSection = extractSection(baselineText, /## 7\. CI — estado de Fase 7/, /^## 8\./m);
    const planBullets = extractJobBulletTexts(planSection, PLAN_JOB_RE);
    const baselineBullets = extractJobBulletTexts(baselineSection, BASELINE_JOB_RE);
    for (const job of EXPECTED_JOBS) {
      const wf = JOB_WORKFLOWS[job];
      // Ruta completa (no solo el nombre del archivo): la mención debe referenciar
      // el workflow de forma inequívoca (misma regla que la validación 2.5 del script).
      expect(planBullets.get(job), 'plan: bullet de ' + job).toContain('.github/workflows/' + wf);
      expect(baselineBullets.get(job), 'baseline §7: bullet de ' + job).toContain('.github/workflows/' + wf);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Integración negativa (overrides): divergencias deben fallar
// ────────────────────────────────────────────────────────────────────────────

describe('verify_docs_ci_jobs.js — divergencias plan ↔ baseline', () => {
  it('job faltante en baseline §7 falla con ::error:: y lista el missing', () => {
    const jobs = [...EXPECTED_JOBS].filter((j) => j !== 'pluginval');
    const tmp = writeTemp({
      plan: buildPlan(EXPECTED_JOBS),
      baseline: buildBaseline(jobs),
      workflows: Object.values(JOB_WORKFLOWS),
    });
    try {
      const { status, stderr, stdout } = runScript([
        '--plan-file', tmp.planFile, '--baseline-file', tmp.baselineFile,
        '--workflows-dir', tmp.workflowsDir, '--json',
      ]);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::docs-verification');
      expect(stderr).toContain('pluginval');
      expect(extractJson(stdout).missingInBaseline).toContain('pluginval');
    } finally {
      fs.rmSync(tmp.dir, { recursive: true, force: true });
    }
  });

  it('job extra en el plan (fuera del contrato) falla', () => {
    const planJobs = [...EXPECTED_JOBS, 'job-fantasma'];
    const tmp = writeTemp({
      plan: buildPlan(planJobs),
      baseline: buildBaseline(EXPECTED_JOBS),
      workflows: Object.values(JOB_WORKFLOWS),
    });
    try {
      const { status, stderr, stdout } = runScript([
        '--plan-file', tmp.planFile, '--baseline-file', tmp.baselineFile,
        '--workflows-dir', tmp.workflowsDir, '--json',
      ]);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::docs-verification');
      expect(stderr).toContain('job-fantasma');
      expect(extractJson(stdout).extraInPlan).toContain('job-fantasma');
    } finally {
      fs.rmSync(tmp.dir, { recursive: true, force: true });
    }
  });

  it('workflow real ausente para un job del contrato falla', () => {
    const tmp = writeTemp({
      plan: buildPlan(EXPECTED_JOBS),
      baseline: buildBaseline(EXPECTED_JOBS),
      workflows: Object.values(JOB_WORKFLOWS).filter((w) => w !== 'pluginval.yml'),
    });
    try {
      const { status, stderr, stdout } = runScript([
        '--plan-file', tmp.planFile, '--baseline-file', tmp.baselineFile,
        '--workflows-dir', tmp.workflowsDir, '--json',
      ]);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::docs-verification');
      expect(stderr).toContain('pluginval.yml');
      expect(extractJson(stdout).missingWorkflows[0]).toContain('pluginval.yml');
    } finally {
      fs.rmSync(tmp.dir, { recursive: true, force: true });
    }
  });

  it('workflow sin sección jobs: (archivo vacío) falla', () => {
    const tmp = writeTemp({
      plan: buildPlan(EXPECTED_JOBS),
      baseline: buildBaseline(EXPECTED_JOBS),
      workflows: Object.fromEntries(
        Object.keys(DEFAULT_WORKFLOW_JOBS).map((w) => [w, []]),
      ),
    });
    try {
      const { status, stderr, stdout } = runScript([
        '--plan-file', tmp.planFile, '--baseline-file', tmp.baselineFile,
        '--workflows-dir', tmp.workflowsDir, '--json',
      ]);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::docs-verification');
      expect(extractJson(stdout).missingJobDefs.length).toBe(EXPECTED_JOBS.length);
    } finally {
      fs.rmSync(tmp.dir, { recursive: true, force: true });
    }
  });

  it('workflow con job de nombre distinto al esperado falla (anti-drift de job IDs)', () => {
    // pluginval.yml existe pero define el job 'validacion' en vez de 'pluginval'
    const workflows = { ...DEFAULT_WORKFLOW_JOBS, 'pluginval.yml': ['validacion'] };
    const tmp = writeTemp({
      plan: buildPlan(EXPECTED_JOBS),
      baseline: buildBaseline(EXPECTED_JOBS),
      workflows,
    });
    try {
      const { status, stderr, stdout } = runScript([
        '--plan-file', tmp.planFile, '--baseline-file', tmp.baselineFile,
        '--workflows-dir', tmp.workflowsDir, '--json',
      ]);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::docs-verification');
      expect(stderr).toContain('pluginval');
      expect(extractJson(stdout).missingJobDefs[0]).toContain('pluginval');
    } finally {
      fs.rmSync(tmp.dir, { recursive: true, force: true });
    }
  });

  it('renombrar un job real sin actualizar JOB_WORKFLOW_JOBS falla (p.ej. cpp-unit-tests→build-and-test)', () => {
    // dsp-ci.yml sin el job 'build-and-test' (el que implementa cpp-unit-tests)
    const workflows = {
      ...DEFAULT_WORKFLOW_JOBS,
      'dsp-ci.yml': ['allocation-audit', 'benchmark'],
    };
    const tmp = writeTemp({
      plan: buildPlan(EXPECTED_JOBS),
      baseline: buildBaseline(EXPECTED_JOBS),
      workflows,
    });
    try {
      const { status, stderr, stdout } = runScript([
        '--plan-file', tmp.planFile, '--baseline-file', tmp.baselineFile,
        '--workflows-dir', tmp.workflowsDir, '--json',
      ]);
      expect(status).toBe(1);
      expect(extractJson(stdout).missingJobDefs.some((x) => x.includes('build-and-test'))).toBe(true);
    } finally {
      fs.rmSync(tmp.dir, { recursive: true, force: true });
    }
  });

  it('sección faltante en un documento falla', () => {
    const tmp = writeTemp({
      plan: 'no hay sección Fase 7 aquí',
      baseline: buildBaseline(EXPECTED_JOBS),
      workflows: Object.values(JOB_WORKFLOWS),
    });
    try {
      const { status, stderr, stdout } = runScript([
        '--plan-file', tmp.planFile, '--baseline-file', tmp.baselineFile,
        '--workflows-dir', tmp.workflowsDir, '--json',
      ]);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::docs-verification');
      expect(stderr).toContain('Fase 7');
      expect(extractJson(stdout).planSectionFound).toBe(false);
    } finally {
      fs.rmSync(tmp.dir, { recursive: true, force: true });
    }
  });

  it('bullet que no menciona su workflow en la baseline falla (anti-drift doc→workflow)', () => {
    // baseline con bullets SIN la mención del workflow — la validación 2.5 falla
    const baselineNoMention = [
      '## 7. CI — estado de Fase 7',
      ...EXPECTED_JOBS.map((j) => `- ✅ **Job \`${j}\`**: sin mención de workflow`),
      '## 8. Estado y próximos pasos',
    ].join('\n');
    const tmp = writeTemp({
      plan: buildPlan(EXPECTED_JOBS),
      baseline: baselineNoMention,
      workflows: Object.values(JOB_WORKFLOWS),
    });
    try {
      const { status, stderr, stdout } = runScript([
        '--plan-file', tmp.planFile, '--baseline-file', tmp.baselineFile,
        '--workflows-dir', tmp.workflowsDir, '--json',
      ]);
      expect(status).toBe(1);
      expect(stderr).toContain('::error::docs-verification');
      expect(stderr).toContain('no menciona su workflow');
      expect(extractJson(stdout).baselineWorkflowMention.length).toBe(EXPECTED_JOBS.length);
    } finally {
      fs.rmSync(tmp.dir, { recursive: true, force: true });
    }
  });

  it('bullet que menciona un workflow ERRÓNEO en el plan falla', () => {
    const planWrong = [
      '### Fase 7: Pipeline CI/CD Reproducible',
      ...EXPECTED_JOBS.map((j) => {
        const wrongWf = 'otro-workflow.yml';
        return `- [x] Job \`${j}\` (\`.github/workflows/${wrongWf}\`): bullet de prueba`;
      }),
      '## 🧪 8. Criterios de Aceptación Definitivos',
    ].join('\n');
    const tmp = writeTemp({
      plan: planWrong,
      baseline: buildBaseline(EXPECTED_JOBS),
      workflows: Object.values(JOB_WORKFLOWS),
    });
    try {
      const { status, stderr, stdout } = runScript([
        '--plan-file', tmp.planFile, '--baseline-file', tmp.baselineFile,
        '--workflows-dir', tmp.workflowsDir, '--json',
      ]);
      expect(status).toBe(1);
      expect(stderr).toContain('no menciona su workflow');
      expect(extractJson(stdout).planWorkflowMention.length).toBe(EXPECTED_JOBS.length);
    } finally {
      fs.rmSync(tmp.dir, { recursive: true, force: true });
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function extractJson(stdout) {
  const marker = '---JSON---';
  const idx = stdout.indexOf(marker);
  if (idx === -1) { return null; }
  return JSON.parse(stdout.slice(idx + marker.length).trim());
}
