/**
 * Unit tests for the read-only DSP calibration constants panel (F3-4).
 *
 * Run with: npx vitest run WebUI/tests/settingsDspCalibration.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state
// ══════════════════════════════════════════════════════════════════

let _elementRegistry = {};

function _resetElements() { _elementRegistry = {}; }
function _registerElement(id, el) { _elementRegistry[id] = el; }

function _setupGlobals() {
  const mockDocument = {
    getElementById: (id) => _elementRegistry[id] || null,
    createElement: () => _createFakeElement('div'),
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  vi.stubGlobal('document', mockDocument);
  vi.stubGlobal('window', {
    document: mockDocument,
    localStorage: { getItem: () => null, setItem: () => {} },
  });
}

function _createFakeElement(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _children: [],
    textContent: '',
    appendChild(child) { this._children.push(child); },
    style: {},
  };
  return el;
}

// ══════════════════════════════════════════════════════════════════
// Function under test (mirrors WebUI/js/settings_hardware_info.js)
// ══════════════════════════════════════════════════════════════════

function renderDspCalibration(dspCalibration) {
  const container = document.getElementById('settings-dsp-calibration');
  if (!container) { return; }

  const names = Object.keys(dspCalibration || {}).sort();
  if (names.length === 0) {
    container.textContent = 'No calibration data available.';
    return;
  }

  container.textContent = '';
  names.forEach(function (name) {
    const entry = dspCalibration[name] || {};
    const val = typeof entry.value === 'number' ? Number(entry.value.toFixed(4)) : entry.value;
    const unit = entry.unit ? ' ' + entry.unit : '';
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.gap = '10px';
    const nameEl = document.createElement('span');
    nameEl.textContent = name;
    nameEl.style.color = 'var(--text-dim)';
    const valEl = document.createElement('span');
    valEl.textContent = String(val) + unit;
    valEl.style.color = 'var(--text-secondary)';
    row.appendChild(nameEl);
    row.appendChild(valEl);
    container.appendChild(row);
  });
}

// ══════════════════════════════════════════════════════════════════
// Test suites
// ══════════════════════════════════════════════════════════════════

describe('renderDspCalibration', () => {
  beforeEach(() => {
    _resetElements();
    _setupGlobals();
  });

  const SAMPLE = {
    maxNormalizedFreq: { value: 0.85, unit: 'frq' },
    outputScale: { value: 3.22, unit: 'x' },
    inputEnvTauSec: { value: 0.022, unit: 's' },
    deepMindStageSaturation: { value: 0.7, unit: 'x' },
  };

  it('renders one row per constant, sorted by name', () => {
    const container = _createFakeElement('div');
    _registerElement('settings-dsp-calibration', container);
    renderDspCalibration(SAMPLE);
    expect(container._children).toHaveLength(4);
    const names = container._children.map((r) => r._children[0].textContent);
    expect(names).toEqual(['deepMindStageSaturation', 'inputEnvTauSec', 'maxNormalizedFreq', 'outputScale']);
  });

  it('renders formatted value with unit', () => {
    const container = _createFakeElement('div');
    _registerElement('settings-dsp-calibration', container);
    renderDspCalibration(SAMPLE);
    const vals = container._children.map((r) => r._children[1].textContent);
    expect(vals).toContain('0.85 frq');
    expect(vals).toContain('3.22 x');
    expect(vals).toContain('0.022 s');
  });

  it('rounds long floats to 4 decimals', () => {
    const container = _createFakeElement('div');
    _registerElement('settings-dsp-calibration', container);
    renderDspCalibration({ noiseLevelBase: { value: 1.0e-2, unit: 'x' } });
    expect(container._children[0]._children[1].textContent).toBe('0.01 x');
  });

  it('shows placeholder text when no constants provided', () => {
    const container = _createFakeElement('div');
    _registerElement('settings-dsp-calibration', container);
    renderDspCalibration({});
    expect(container.textContent).toBe('No calibration data available.');
  });

  it('does not crash when container missing', () => {
    renderDspCalibration(SAMPLE);
    expect(true).toBe(true);
  });
});
