// WebUI/tests/calibrationRoundtripAB.test.js
// Tests de la integración A/B Compare (Fase 4) en la pestaña Round-Trip del Calibration Lab:
// runABCompareReport (clasificación exact/canonical/semantic/no_match), render del
// banner y wiring de eventos (modo single/ab, carga de patches, comparación).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

if (typeof window === 'undefined') {
  global.window = {};
}

let RegisteredPageClass = null;

if (typeof global.HTMLElement === 'undefined') {
  global.HTMLElement = class {
    constructor() {
      this.classList = {
        _classes: [],
        add(c) { if (!this._classes.includes(c)) {this._classes.push(c);} },
        remove(c) { this._classes = this._classes.filter(x => x !== c); },
        contains(c) { return this._classes.includes(c); },
      };
      this.style = {};
    }
    querySelector(sel) {
      const map = {
        '#rt-load-a': '_elLoadA',
        '#rt-load-b': '_elLoadB',
        '#rt-run': '_elRun',
        '#rt-hide-exact': '_elHide',
        '#rt-source-info': '_elInfo',
        '#rt-mode-single': '_elModeSingle',
        '#rt-mode-ab': '_elModeAb',
      };
      if (map[sel]) {
        if (!this[map[sel]]) {
          this[map[sel]] = { onclick: null, onchange: null, checked: false, textContent: '', value: '' };
        }
        return this[map[sel]];
      }
      return null;
    }
  };
}

if (typeof global.customElements === 'undefined') {
  global.customElements = {
    define: vi.fn((tag, cls) => {
      if (tag === 'calibration-lab-page') { RegisteredPageClass = cls; }
    }),
  };
}

if (typeof global.document === 'undefined') {
  global.document = {
    createElement: (tag) => {
      if (tag === 'calibration-lab-page' && RegisteredPageClass) { return new RegisteredPageClass(); }
      return new global.HTMLElement();
    },
    body: { appendChild: vi.fn(), removeChild: vi.fn() },
  };
}

// ── Carga del stack de Calibration Lab (mismo patrón que audioABControls.test.js) ──
require('../js/dom_sanitize.js');
require('../js/calibration_store_data.js');
require('../js/calibration_store_utils.js');
require('../js/calibration_store_selectors.js');
require('../js/calibration_store_actions.js');
require('../js/calibration_store.js');
require('../js/calibration_lab_format.js');
require('../js/calibration_lab_patchdiff.js');
require('../js/calibration_lab_validation.js');
require('../js/calibration_lab_utils.js');
require('../js/calibration_lab_template.js');
require('../js/calibration_lab_page.js');
require('../js/calibration_lab_tab_roundtrip.js');
require('../js/calibration_lab_workflow.js'); // registra el custom element calibration-lab-page

// Fase 4: batería de igualdad + registro canónico (en Node exportan vía module.exports;
// en el navegador index.html los asigna a window — aquí se replican para el helper).
window.RoundTripEquality = require('../js/roundtrip_equality.js');
window.ParameterRegistry = require('../js/registry.gen.js');

// El helper se expone en globalThis (como el resto de utilidades del Calibration Lab);
// en Node globalThis !== window (objeto plano), así que se lee de globalThis.
const abCompare = () => globalThis.runABCompareReport;

// ── Helpers de test ──
function mkPatch(seed, overrides) {
  const bytes = new Uint8Array(242);
  for (let i = 0; i < 242; i++) { bytes[i] = (i * 37 + seed) & 0xFF; }
  return {
    name: `Patch ${seed}`,
    unpackedBytes: bytes,
    bankName: 'A',
    patchIndex: 0,
    ...overrides,
  };
}

function nameOnlyPatch(base, overrides) {
  // Copia que difiere SOLO en la región reservada del nombre (223-238)
  const bytes = new Uint8Array(base.unpackedBytes);
  for (let i = 223; i <= 238; i++) { bytes[i] = (bytes[i] + 1) & 0xFF; }
  return { ...base, name: `${base.name} (renamed)`, unpackedBytes: bytes, ...overrides };
}

function valueDiffPatch(base, offset, delta, overrides) {
  const bytes = new Uint8Array(base.unpackedBytes);
  bytes[offset] = (bytes[offset] + delta) & 0xFF;
  return { ...base, unpackedBytes: bytes, ...overrides };
}

function newStore(bridge) {
  const store = window.createCalibrationStore(bridge || {});
  window.calibrationStore = store;
  return store;
}

function newPageEl() {
  const el = global.document.createElement('calibration-lab-page');
  el._roundTripMode = 'single';
  el.render = vi.fn(function () {});
  return el;
}

// ════════════════════════════════════════════════════════════════
// runABCompareReport — clasificación pura (Fase 4)
// ════════════════════════════════════════════════════════════════

describe('runABCompareReport — clasificación A/B (Fase 4)', () => {
  it('patches idénticos en la misma posición → exact_match', () => {
    const A = mkPatch(1);
    const B = mkPatch(1);
    const r = abCompare()(A, B);
    expect(r.error).toBeUndefined();
    expect(r.cls.best).toBe('exact_match');
    expect(r.sem.equal).toBe(true);
    expect(r.raw.equal).toBe(true);
    expect(r.registryAvailable).toBe(true);
  });

  it('patches idénticos en posición distinta → canonical_match', () => {
    const A = mkPatch(2);
    const B = mkPatch(2, { bankName: 'C', patchIndex: 42 });
    const r = abCompare()(A, B);
    expect(r.cls.best).toBe('canonical_match');
    expect(r.sem.equal).toBe(true);
  });

  it('diferencia solo en la región del nombre → semantic_match', () => {
    const A = mkPatch(3);
    const B = nameOnlyPatch(A);
    const r = abCompare()(A, B);
    expect(r.cls.best).toBe('semantic_match');
    expect(r.raw.equal).toBe(false);
    expect(r.sem.equal).toBe(true);
    expect(r.sem.mismatches).toEqual([]);
  });

  it('diferencia de valor real (VCF Cutoff) → no_match con mismatch detallado', () => {
    const A = mkPatch(4);
    const B = valueDiffPatch(A, 39, 10); // byte 39 = VCF Cutoff
    const r = abCompare()(A, B);
    expect(r.cls.best).toBe('no_match');
    expect(r.sem.equal).toBe(false);
    const m = r.sem.mismatches.find((x) => x.byteOffset === 39);
    expect(m).toBeDefined();
    expect(m.paramIds).toContain('vcf_cutoff');
  });

  it('devuelve error cuando RoundTripEquality no está cargado', () => {
    const A = mkPatch(5);
    const B = mkPatch(5);
    const saved = window.RoundTripEquality;
    window.RoundTripEquality = undefined;
    try {
      const r = abCompare()(A, B);
      expect(r.error).toContain('RoundTripEquality');
    } finally {
      window.RoundTripEquality = saved;
    }
  });

  it('devuelve error con bytes de patch inválidos', () => {
    const r = abCompare()({ name: 'A' }, { name: 'B' });
    expect(r.error).toBe('invalid_patch_bytes');
  });

  it('sin registro el helper lo indica (registryAvailable false) sin romper', () => {
    const A = mkPatch(6);
    const B = valueDiffPatch(A, 39, 10);
    const saved = window.ParameterRegistry;
    window.ParameterRegistry = undefined;
    try {
      const r = abCompare()(A, B);
      expect(r.registryAvailable).toBe(false);
      expect(r.cls.best).toBe('no_match');
    } finally {
      window.ParameterRegistry = saved;
    }
  });
});

// ════════════════════════════════════════════════════════════════
// Render de la pestaña Round-Trip
// ════════════════════════════════════════════════════════════════

describe('renderRoundTripTab — modo single/ab y banner de clasificación', () => {
  let store;

  beforeEach(() => {
    store = newStore();
  });

  afterEach(() => {
    delete window.calibrationStore;
  });

  it('modo por defecto (single): mantiene el flujo histórico', () => {
    const el = newPageEl();
    const html = el.renderRoundTripTab(store);
    expect(html).toContain('Single Patch');
    expect(html).toContain('Run RoundTrip');
    expect(html).toContain('Hide exact matches');
    expect(html).toContain('3-Layer Round-Trip Validator');
  });

  it('modo ab: muestra el toggle, los botones de carga A/B y el botón de comparación', () => {
    const el = newPageEl();
    el._roundTripMode = 'ab';
    const html = el.renderRoundTripTab(store);
    expect(html).toContain('A/B Compare (Fase 4)');
    expect(html).toContain('Compare A vs B');
    expect(html).toContain('Load Patch A');
    expect(html).toContain('Load Patch B');
  });

  it('el botón de modo "Single Patch" está activo por defecto y "A/B Compare" en modo ab', () => {
    const el = newPageEl();
    expect(el.renderRoundTripTab(store)).toContain('rt-mode-single" class="cal-rt-mode-btn active');
    expect(el.renderRoundTripTab(store)).not.toContain('rt-mode-ab" class="cal-rt-mode-btn active');
    el._roundTripMode = 'ab';
    expect(el.renderRoundTripTab(store)).toContain('rt-mode-ab" class="cal-rt-mode-btn active');
    expect(el.renderRoundTripTab(store)).not.toContain('rt-mode-single" class="cal-rt-mode-btn active');
  });

  it('con un reporte semantic_match renderiza el banner SEMANTIC MATCH y la nota de región reservada', () => {
    const A = mkPatch(10);
    const B = nameOnlyPatch(A);
    const el = newPageEl();
    el._roundTripMode = 'ab';
    el._abReport = abCompare()(A, B);
    const html = el.renderRoundTripTab(store);
    expect(html).toContain('SEMANTIC MATCH');
    expect(html).toContain('cal-rt-ab-banner cal-rt-ab-semantic');
    expect(html).toContain('reserved region');
    expect(html).toContain('Registry: <strong>loaded</strong>');
  });

  it('con un reporte no_match renderiza la tabla de diferencias con Param IDs', () => {
    const A = mkPatch(11);
    const B = valueDiffPatch(A, 39, 10);
    const el = newPageEl();
    el._roundTripMode = 'ab';
    el._abReport = abCompare()(A, B);
    const html = el.renderRoundTripTab(store);
    expect(html).toContain('NO MATCH');
    expect(html).toContain('vcf_cutoff');
    expect(html).toContain('Norm A');
    expect(html).toContain('Norm B');
  });

  it('con reporte de error renderiza el estado ERROR', () => {
    const el = newPageEl();
    el._roundTripMode = 'ab';
    el._abReport = { error: 'RoundTripEquality not loaded' };
    expect(el.renderRoundTripTab(store)).toContain('ERROR');
  });
});

// ════════════════════════════════════════════════════════════════
// Eventos — bindRoundTripEvents
// ════════════════════════════════════════════════════════════════

describe('bindRoundTripEvents — modo ab', () => {
  let store;

  beforeEach(() => {
    store = newStore();
  });

  afterEach(() => {
    delete window.calibrationStore;
  });

  it('el botón de modo A/B cambia el modo y re-renderiza', () => {
    const el = newPageEl();
    el.bindRoundTripEvents();
    el.querySelector('#rt-mode-ab').onclick();
    expect(el._roundTripMode).toBe('ab');
    expect(el.render).toHaveBeenCalled();
  });

  it('el botón de modo Single vuelve al modo histórico', () => {
    const el = newPageEl();
    el._roundTripMode = 'ab';
    el.bindRoundTripEvents();
    el.querySelector('#rt-mode-single').onclick();
    expect(el._roundTripMode).toBe('single');
  });

  it('Compare A vs B usa los patches del store y clasifica exact_match', () => {
    const A = mkPatch(20);
    const B = mkPatch(20);
    store.setSelectedPatchA(A);
    store.setSelectedPatchB(B);

    const el = newPageEl();
    el._roundTripMode = 'ab';
    el.bindRoundTripEvents();
    el.querySelector('#rt-run').onclick();

    expect(el._abReport).toBeDefined();
    expect(el._abReport.error).toBeUndefined();
    expect(el._abReport.cls.best).toBe('exact_match');
    expect(el.render).toHaveBeenCalled();
  });

  it('Compare A vs B con posición distinta → canonical_match', () => {
    const A = mkPatch(21);
    const B = mkPatch(21, { bankName: 'D', patchIndex: 99 });
    store.setSelectedPatchA(A);
    store.setSelectedPatchB(B);

    const el = newPageEl();
    el._roundTripMode = 'ab';
    el.bindRoundTripEvents();
    el.querySelector('#rt-run').onclick();

    expect(el._abReport.cls.best).toBe('canonical_match');
  });

  it('Compare sin patches válidos reporta error sin lanzar', () => {
    store.setSelectedPatchA(null);
    store.setSelectedPatchB(null);
    const el = newPageEl();
    el._roundTripMode = 'ab';
    el.bindRoundTripEvents();
    el.querySelector('#rt-run').onclick();
    expect(el._abReport.error).toBe('invalid_patch_bytes');
  });
});
