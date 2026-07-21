// WebUI/tests/audioABControls.test.js
// Test unitario de máquina de estados de la pestaña Audio A/B
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock del entorno DOM para Node.js sin jsdom ──
if (typeof window === 'undefined') {
  global.window = {};
}

let RegisteredPageClass = null;

// Mock HTMLElement
if (typeof global.HTMLElement === 'undefined') {
  global.HTMLElement = class {
    constructor() {
      this.classList = {
        _classes: [],
        add(c) { if (!this._classes.includes(c)) {this._classes.push(c);} },
        remove(c) { this._classes = this._classes.filter(x => x !== c); },
        contains(c) { return this._classes.includes(c); },
        toggle(c, f) {
          if (f === true) {this.add(c);}
          else if (f === false) {this.remove(c);}
          else {this.contains(c) ? this.remove(c) : this.add(c);}
        }
      };
      this.style = {};
    }
    appendChild(c) {
      this._children = this._children || [];
      this._children.push(c);
    }
    querySelector(sel) {
      if (sel === '#audio-btn-start') {
        if (!this._btnStart) {this._btnStart = { disabled: false, onclick: null };}
        return this._btnStart;
      }
      if (sel === '#audio-btn-render') {
        if (!this._btnRender) {this._btnRender = { disabled: true, onclick: null };}
        return this._btnRender;
      }
      if (sel === '#audio-btn-finish') {
        if (!this._btnFinish) {this._btnFinish = { disabled: true, onclick: null };}
        return this._btnFinish;
      }
      if (sel === '#audio-btn-compare') {
        if (!this._btnCompare) {this._btnCompare = { disabled: true, onclick: null };}
        return this._btnCompare;
      }
      if (sel === '#audio-btn-abort') {
        if (!this._btnAbort) {this._btnAbort = { disabled: true, onclick: null };}
        return this._btnAbort;
      }
      if (sel === '#audio-note-input') {return { value: '48' };}
      if (sel === '#audio-vel-input') {return { value: '100' };}
      if (sel === '#audio-dur-input') {return { value: '2.0' };}
      if (sel === 'textarea') {
        if (!this._textarea) {this._textarea = { value: '' };}
        return this._textarea;
      }
      return null;
    }
    querySelectorAll(sel) {
      if (sel === '.cal-tab') {
        return [
          { dataset: { calTab: 'raw' }, classList: { remove: vi.fn(), add: vi.fn(), toggle: vi.fn() } },
          { dataset: { calTab: 'semantic' }, classList: { remove: vi.fn(), add: vi.fn(), toggle: vi.fn() } },
          { dataset: { calTab: 'engine' }, classList: { remove: vi.fn(), add: vi.fn(), toggle: vi.fn() } },
          { dataset: { calTab: 'effective' }, classList: { remove: vi.fn(), add: vi.fn(), toggle: vi.fn() } },
          { dataset: { calTab: 'audio-ab' }, classList: { remove: vi.fn(), add: vi.fn(), toggle: vi.fn() } }
        ];
      }
      return [];
    }
  };
}

if (typeof global.customElements === 'undefined') {
  global.customElements = {
    define: vi.fn((tag, cls) => {
      if (tag === 'calibration-lab-page') {
        RegisteredPageClass = cls;
      }
    })
  };
}

if (typeof global.document === 'undefined') {
  global.document = {
    createElement: (tag) => {
      if (tag === 'calibration-lab-page' && RegisteredPageClass) {
        return new RegisteredPageClass();
      }
      return new global.HTMLElement();
    },
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    }
  };
}

// Helper global escapeHtml
global.escapeHtml = (str) => str || '';

// Importar de forma diferida usando require para evitar hoisting
require('../js/calibration_store.js');
require('../js/calibration_lab_page.js');

describe('CalibrationLabPage - Audio A/B Control Tab State Machine (AUD-05B)', () => {
  let pageEl, store;

  beforeEach(() => {
    // Mock bridge dual
    window.dualMidiBridge = {
      isJuce: true,
      startAudioABRun: vi.fn(async () => ({ ok: true })),
      renderAudioABSoftwareReference: vi.fn(async () => ({ ok: true })),
      finishAudioABRun: vi.fn(async () => ({
        ok: true,
        runId: 'test-run-123',
        manifestPath: 'mock/path/manifest.json',
        hwWavPath: 'mock/path/hardware.wav',
        swWavPath: 'mock/path/software.wav',
        hwPeak: -3.0,
        hwRms: -18.0,
        swPeak: -3.0,
        swRms: -18.0
      })),
      abortAudioABRun: vi.fn(async () => ({ ok: true })),
      compareAudioABRun: vi.fn(async () => ({
        status: 'ok',
        verdict: { level: 'pass', reason_code: 'WITHIN_TOLERANCE', triggered_rules: [] },
        time_metrics: { peak_delta_db: 0.1, rms_delta_db: 0.2, residual_rms_dbfs: -45.0, rmse: 0.005 },
        alignment: { sample_offset: 4, time_offset_ms: 0.09, correlation_peak: 0.985, overlap_ratio: 0.99 },
        spectral_metrics: { log_mag_mean_abs_diff_db: 0.45, low_band_delta_db: 0.2, mid_band_delta_db: 0.3, high_band_delta_db: 0.5 }
      }))
    };

    // SIEMPRE instanciar un store nuevo
    store = window.createCalibrationStore(window.dualMidiBridge);
    window.calibrationStore = store;

    // Crear y montar elemento de la clase real registrada
    pageEl = global.document.createElement('calibration-lab-page');
    pageEl.panelEl = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    };
    pageEl.runListMountEl = null;
    pageEl.workflowMountEl = null;
    pageEl.tabButtons = pageEl.querySelectorAll('.cal-tab');

    // Interceptar render() para sincronizar el estado visual de los mocks del DOM
    const originalRender = pageEl.render;
    pageEl.render = function () {
      originalRender.call(this);
      
      // Sincronizar botones mock
      const startBtn = this.querySelector('#audio-btn-start');
      const renderBtn = this.querySelector('#audio-btn-render');
      const finishBtn = this.querySelector('#audio-btn-finish');
      const compareBtn = this.querySelector('#audio-btn-compare');
      const abortBtn = this.querySelector('#audio-btn-abort');
      const textarea = this.querySelector('textarea');
      
      if (startBtn) {startBtn.disabled = (this._audioStatus === 'running');}
      if (renderBtn) {renderBtn.disabled = (this._audioStatus !== 'running');}
      if (finishBtn) {finishBtn.disabled = (this._audioStatus !== 'running');}
      if (compareBtn) {compareBtn.disabled = (this._audioStatus !== 'finished' && this._audioStatus !== 'compared' && this._audioStatus !== 'passed' && this._audioStatus !== 'failed');}
      if (abortBtn) {abortBtn.disabled = (this._audioStatus !== 'running');}
      
      if (textarea) {
        textarea.value = (this._audioLogs || []).map(l => `[${l.time}] ${l.msg}`).join('\n');
      }
    };

    // Activar pestaña y renderizar
    store.setActiveTab('audio-ab');
    pageEl.render();
  });

  afterEach(() => {
    delete window.dualMidiBridge;
    delete window.calibrationStore;
  });

  it('estado inicial en "idle", start habilitado, render y finish bloqueados', () => {
    expect(pageEl._audioStatus).toBe('idle');
    expect(pageEl.querySelector('#audio-btn-start').disabled).toBe(false);
    expect(pageEl.querySelector('#audio-btn-render').disabled).toBe(true);
    expect(pageEl.querySelector('#audio-btn-finish').disabled).toBe(true);
  });

  it('hacer click en start transiciona a "running", habilita render/finish y deshabilita start', async () => {
    // Simular el click llamando al onclick del botón
    pageEl.querySelector('#audio-btn-start').onclick();

    // Esperar eventos asíncronos del bridge
    await new Promise(process.nextTick);

    expect(window.dualMidiBridge.startAudioABRun).toHaveBeenCalledOnce();
    expect(pageEl._audioStatus).toBe('running');

    expect(pageEl.querySelector('#audio-btn-start').disabled).toBe(true);
    expect(pageEl.querySelector('#audio-btn-render').disabled).toBe(false);
    expect(pageEl.querySelector('#audio-btn-finish').disabled).toBe(false);
  });

  it('hacer click en render llama al bridge nativo de renderizado software', async () => {
    pageEl._audioStatus = 'running';
    pageEl.render();

    pageEl.querySelector('#audio-btn-render').onclick();

    await new Promise(process.nextTick);
    expect(window.dualMidiBridge.renderAudioABSoftwareReference).toHaveBeenCalledOnce();
  });

  it('hacer click en finish transiciona a "finished" y muestra logs de ruta', async () => {
    pageEl._audioStatus = 'running';
    pageEl.render();

    pageEl.querySelector('#audio-btn-finish').onclick();

    await new Promise(process.nextTick);
    expect(window.dualMidiBridge.finishAudioABRun).toHaveBeenCalledOnce();
    expect(pageEl._audioStatus).toBe('finished');

    expect(pageEl.querySelector('textarea').value).toContain('Run finalizado con éxito: test-run-123');
    expect(pageEl.querySelector('textarea').value).toContain('WAV Hardware: mock/path/hardware.wav');
  });

  it('hacer click en abort cancela el run actual y vuelve a "idle"', async () => {
    pageEl._audioStatus = 'running';
    pageEl.render();

    pageEl.querySelector('#audio-btn-abort').onclick();

    await new Promise(process.nextTick);
    expect(window.dualMidiBridge.abortAudioABRun).toHaveBeenCalledOnce();
    expect(pageEl._audioStatus).toBe('idle');
  });

  it('hacer click en compare con veredicto pass transiciona el estado visual a "passed"', async () => {
    pageEl._audioStatus = 'finished';
    pageEl.render();

    pageEl.querySelector('#audio-btn-compare').onclick();

    await new Promise(process.nextTick);
    expect(window.dualMidiBridge.compareAudioABRun).toHaveBeenCalledOnce();
    expect(pageEl._audioStatus).toBe('passed');
    expect(pageEl.querySelector('textarea').value).toContain('Comparación acústica finalizada. Veredicto: PASS');
  });

  it('hacer click en compare con error contractual transiciona el estado visual a "error" con su respectivo código', async () => {
    window.dualMidiBridge.compareAudioABRun.mockResolvedValueOnce({
      status: 'error',
      reason_code: 'SR_MISMATCH',
      errors: ['Frecuencias de muestreo incompatibles: 44100 vs 48000']
    });

    pageEl._audioStatus = 'finished';
    pageEl.render();

    pageEl.querySelector('#audio-btn-compare').onclick();

    await new Promise(process.nextTick);
    expect(pageEl._audioStatus).toBe('error');
    expect(pageEl.querySelector('textarea').value).toContain('Error contractual en comparador: SR_MISMATCH');
  });
});
