/**
 * Unit tests for initFxPresetsSetting — FX Presets management in Settings Advanced tab.
 *
 * Run with: npx vitest run WebUI/tests/settingsFxPresets.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state
// ══════════════════════════════════════════════════════════════════

let _storage = {};
let _elementRegistry = {};
let _confirmResult = true;
let _clickHandlers = {};

function _resetAll() {
  _storage = {};
  _elementRegistry = {};
  _confirmResult = true;
  _clickHandlers = {};
}

function _setConfirmResult(v) { _confirmResult = v; }

function _createFakeElement(id) {
  const el = {
    id, textContent: '', style: {}, value: '', disabled: false,
    addEventListener: vi.fn((evt, fn) => { _clickHandlers[id + ':' + evt] = fn; }),
    click: vi.fn(), files: null,
  };
  _elementRegistry[id] = el;
  return el;
}

function _getClickHandler(id) {
  if (id.endsWith(':click')) {return _clickHandlers[id] || null;}
  return _clickHandlers[id + ':click'] || null;
}

// ══════════════════════════════════════════════════════════════════
// Setup globals before each test
// ══════════════════════════════════════════════════════════════════

beforeEach(() => {
  _resetAll();
  const mockLocalStorage = {
    getItem: (k) => (_storage[k] !== undefined ? _storage[k] : null),
    setItem: (k, v) => { _storage[k] = String(v); },
    removeItem: (k) => { delete _storage[k]; },
    clear: () => { _storage = {}; },
  };
  vi.stubGlobal('document', {
    getElementById: (id) => _elementRegistry[id] || null,
    createElement: (tag) => {
      const el = { tag, href: '', download: '', click: vi.fn() };
      el.addEventListener = vi.fn((evt, fn) => { _clickHandlers['created:' + tag + ':' + evt] = fn; });
      return el;
    },
  });
  vi.stubGlobal('localStorage', mockLocalStorage);
  vi.stubGlobal('window', { localStorage: mockLocalStorage });
  vi.stubGlobal('confirm', vi.fn(() => _confirmResult));
  vi.stubGlobal('Blob', vi.fn(function(parts, opts) {
    this._parts = parts; this._type = opts && opts.type;
    this.size = (parts[0] || '').length;
  }));
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  });
});

// ══════════════════════════════════════════════════════════════════
// The function under test (extracted from settings.js for isolation)
// ══════════════════════════════════════════════════════════════════

function initFxPresetsSetting() {
  const countEl = document.getElementById('settings-fx-preset-count');
  const sizeEl = document.getElementById('settings-fx-preset-size');
  const exportBtn = document.getElementById('settings-fx-preset-export-btn');
  const importBtn = document.getElementById('settings-fx-preset-import-btn');
  const fileInput = document.getElementById('settings-fx-preset-file-input');
  const clearBtn = document.getElementById('settings-fx-preset-clear-btn');
  const statusEl = document.getElementById('settings-fx-preset-status');
  if (!countEl) { return; }

  const FX_KEY = 'abd-eep-fx-presets';

  function refreshStats() {
    try {
      const raw = localStorage.getItem(FX_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          countEl.textContent = arr.length + ' preset' + (arr.length !== 1 ? 's' : '');
          const bytes = new Blob([raw]).size;
          sizeEl.textContent = bytes > 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B';
          return;
        }
      }
    } catch (e) { /* ignore */ }
    countEl.textContent = '0 presets';
    sizeEl.textContent = '—';
  }

  function setStatus(msg, ms) {
    if (!statusEl) { return; }
    statusEl.textContent = msg;
    if (ms) { setTimeout(function() { statusEl.textContent = ''; }, ms); }
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      try {
        const raw = localStorage.getItem(FX_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(arr) || arr.length === 0) {
          setStatus('No presets to export', 3000);
          return;
        }
        const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'abdeep_fx_presets_' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        setStatus('Exported ' + arr.length + ' presets', 3000);
      } catch (e) {
        setStatus('Export failed', 3000);
      }
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener('click', function() { fileInput.click(); });
    fileInput.addEventListener('change', function() {
      const file = fileInput.files[0];
      if (!file) { return; }
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const imported = JSON.parse(e.target.result);
          if (!Array.isArray(imported)) {
            setStatus('Invalid file format', 3000);
            return;
          }
          const existing = [];
          try {
            const raw = localStorage.getItem(FX_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) { existing.push(...parsed); }
            }
          } catch (ex) { /* ignore */ }

          let added = 0;
          imported.forEach(function(p) {
            if (p && p.name && typeof p.type === 'number') {
              let found = -1;
              for (let i = 0; i < existing.length; i++) {
                if (existing[i].name === p.name && existing[i].slot === p.slot) {
                  found = i; break;
                }
              }
              if (found >= 0) { existing[found] = p; }
              else { existing.push(p); }
              added++;
            }
          });

          localStorage.setItem(FX_KEY, JSON.stringify(existing));
          refreshStats();
          setStatus('Imported ' + added + ' presets (' + imported.length + ' in file)', 3000);
        } catch (ex) {
          setStatus('Import failed: invalid JSON', 3000);
        }
        fileInput.value = '';
      };
      reader.readAsText(file);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      const raw = localStorage.getItem(FX_KEY);
      let count = 0;
      try {
        if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) { count = arr.length; } }
      } catch (e) { /* ignore */ }
      if (count === 0) { setStatus('No presets to clear', 3000); return; }
      if (!confirm('Delete all ' + count + ' FX presets? This cannot be undone.')) { return; }
      localStorage.removeItem(FX_KEY);
      refreshStats();
      setStatus('Cleared ' + count + ' presets', 3000);
    });
  }

  refreshStats();
  window._syncFxPresetsSettingsUI = refreshStats;
}

// ══════════════════════════════════════════════════════════════════
// Helper to build elements and init
// ══════════════════════════════════════════════════════════════════

function _init() {
  _createFakeElement('settings-fx-preset-count');
  _createFakeElement('settings-fx-preset-size');
  _createFakeElement('settings-fx-preset-export-btn');
  _createFakeElement('settings-fx-preset-import-btn');
  _createFakeElement('settings-fx-preset-file-input');
  _createFakeElement('settings-fx-preset-clear-btn');
  _createFakeElement('settings-fx-preset-status');
  initFxPresetsSetting();
  return {
    count: _elementRegistry['settings-fx-preset-count'],
    size: _elementRegistry['settings-fx-preset-size'],
    exportBtn: _elementRegistry['settings-fx-preset-export-btn'],
    importBtn: _elementRegistry['settings-fx-preset-import-btn'],
    fileInput: _elementRegistry['settings-fx-preset-file-input'],
    clearBtn: _elementRegistry['settings-fx-preset-clear-btn'],
    statusEl: _elementRegistry['settings-fx-preset-status'],
  };
}

// ══════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════

describe('initFxPresetsSetting', () => {
  it('should show 0 presets when localStorage is empty', () => {
    const els = _init();
    expect(els.count.textContent).toBe('0 presets');
    expect(els.size.textContent).toBe('—');
  });

  it('should show correct count when presets exist', () => {
    _storage['abd-eep-fx-presets'] = JSON.stringify([
      { name: 'T1', slot: 0, type: 0.1, params: [], gain: 0.5, created: 1 },
      { name: 'T2', slot: 1, type: 0.2, params: [], gain: 0.5, created: 2 },
      { name: 'T3', slot: 2, type: 0.3, params: [], gain: 0.5, created: 3 },
    ]);
    const els = _init();
    expect(els.count.textContent).toBe('3 presets');
  });

  it('should show singular "1 preset"', () => {
    _storage['abd-eep-fx-presets'] = JSON.stringify([
      { name: 'Solo', slot: 0, type: 0.5, params: [], gain: 0.5, created: 1 },
    ]);
    const els = _init();
    expect(els.count.textContent).toBe('1 preset');
  });

  it('should show size in bytes for small data', () => {
    _storage['abd-eep-fx-presets'] = JSON.stringify([
      { name: 'Tiny', slot: 0, type: 0, params: [], gain: 0, created: 0 },
    ]);
    const els = _init();
    expect(els.size.textContent).toMatch(/^\d+ B$/);
  });

  it('should show size in KB for larger data', () => {
    const big = Array.from({ length: 50 }, (_, i) => ({
      name: 'P' + i, slot: i % 4, type: i / 56,
      params: Array.from({ length: 12 }, () => Math.random()),
      gain: 0.5, created: Date.now(),
    }));
    _storage['abd-eep-fx-presets'] = JSON.stringify(big);
    const els = _init();
    expect(els.size.textContent).toMatch(/^\d+(\.\d+)? KB$/);
  });

  it('should handle invalid JSON gracefully', () => {
    _storage['abd-eep-fx-presets'] = 'not-json!!!';
    const els = _init();
    expect(els.count.textContent).toBe('0 presets');
    expect(els.size.textContent).toBe('—');
  });

  it('should handle non-array JSON gracefully', () => {
    _storage['abd-eep-fx-presets'] = '{"foo": "bar"}';
    const els = _init();
    expect(els.count.textContent).toBe('0 presets');
  });

  it('should wire up clear button with confirm', () => {
    _storage['abd-eep-fx-presets'] = JSON.stringify([
      { name: 'X', slot: 0, type: 0, params: [], gain: 0, created: 0 },
    ]);
    const els = _init();
    expect(els.count.textContent).toBe('1 preset');
    _getClickHandler('settings-fx-preset-clear-btn:click')();
    expect(_storage['abd-eep-fx-presets']).toBeUndefined();
    expect(els.count.textContent).toBe('0 presets');
  });

  it('should not clear when user cancels', () => {
    _storage['abd-eep-fx-presets'] = JSON.stringify([
      { name: 'Keep', slot: 0, type: 0, params: [], gain: 0, created: 0 },
    ]);
    _setConfirmResult(false);
    const els = _init();
    _getClickHandler('settings-fx-preset-clear-btn:click')();
    expect(_storage['abd-eep-fx-presets']).toBeDefined();
    expect(els.count.textContent).toBe('1 preset');
  });

  it('should show status when clearing empty list', () => {
    const els = _init();
    _getClickHandler('settings-fx-preset-clear-btn:click')();
    expect(els.statusEl.textContent).toBe('No presets to clear');
  });

  it('should export via blob + click', () => {
    _storage['abd-eep-fx-presets'] = JSON.stringify([
      { name: 'E1', slot: 0, type: 0.1, params: [0.5], gain: 0.5, created: 123 },
    ]);
    const els = _init();
    _getClickHandler('settings-fx-preset-export-btn:click')();
    expect(els.statusEl.textContent).toContain('Exported');
  });

  it('should show message when exporting empty', () => {
    const els = _init();
    _getClickHandler('settings-fx-preset-export-btn:click')();
    expect(els.statusEl.textContent).toContain('No presets to export');
  });

  it('should import and merge presets', () => {
    _storage['abd-eep-fx-presets'] = JSON.stringify([
      { name: 'Existing', slot: 0, type: 0, params: [], gain: 0, created: 0 },
    ]);
    const els = _init();

    _getClickHandler('settings-fx-preset-import-btn:click')(); // triggers fileInput.click

    const fileChangeHandler = _clickHandlers['settings-fx-preset-file-input:change'];
    els.fileInput.files = [{ name: 'test.json' }];

    const fakeReader = {
      readAsText: vi.fn(function() {
        this.result = JSON.stringify([
          { name: 'NewOne', slot: 1, type: 0.5, params: [], gain: 0.5, created: 1 },
        ]);
        if (this.onload) { this.onload({ target: { result: this.result } }); }
      }),
      onload: null, result: '',
    };
    vi.stubGlobal('FileReader', function() { return fakeReader; });

    fileChangeHandler();

    const stored = JSON.parse(_storage['abd-eep-fx-presets']);
    expect(stored).toHaveLength(2);
    expect(stored[0].name).toBe('Existing');
    expect(stored[1].name).toBe('NewOne');
  });

  it('should overwrite same name+slot on import', () => {
    _storage['abd-eep-fx-presets'] = JSON.stringify([
      { name: 'Same', slot: 0, type: 0, params: [0.1], gain: 0, created: 0 },
    ]);
    const els = _init();

    _getClickHandler('settings-fx-preset-import-btn:click')();

    const fileChangeHandler = _clickHandlers['settings-fx-preset-file-input:change'];
    els.fileInput.files = [{ name: 'test.json' }];

    const fakeReader = {
      readAsText: vi.fn(function() {
        this.result = JSON.stringify([
          { name: 'Same', slot: 0, type: 0.5, params: [0.9], gain: 0.8, created: 1 },
        ]);
        if (this.onload) { this.onload({ target: { result: this.result } }); }
      }),
      onload: null, result: '',
    };
    vi.stubGlobal('FileReader', function() { return fakeReader; });
    fileChangeHandler();

    const stored = JSON.parse(_storage['abd-eep-fx-presets']);
    expect(stored).toHaveLength(1);
    expect(stored[0].params[0]).toBe(0.9);
  });

  it('should reject non-array import', () => {
    const els = _init();
    _getClickHandler('settings-fx-preset-import-btn:click')();

    const fileChangeHandler = _clickHandlers['settings-fx-preset-file-input:change'];
    els.fileInput.files = [{ name: 'bad.json' }];

    const fakeReader = {
      readAsText: vi.fn(function() {
        this.result = '{"not": "array"}';
        if (this.onload) { this.onload({ target: { result: this.result } }); }
      }),
      onload: null, result: '',
    };
    vi.stubGlobal('FileReader', function() { return fakeReader; });
    fileChangeHandler();
    expect(els.statusEl.textContent).toContain('Invalid file format');
  });

  it('should skip items with missing name or type on import', () => {
    const els = _init();
    _getClickHandler('settings-fx-preset-import-btn:click')();

    const fileChangeHandler = _clickHandlers['settings-fx-preset-file-input:change'];
    els.fileInput.files = [{ name: 'mixed.json' }];

    const fakeReader = {
      readAsText: vi.fn(function() {
        this.result = JSON.stringify([
          { name: 'Good', slot: 0, type: 0.5, params: [], gain: 0.5, created: 1 },
          { slot: 1 },
          null,
        ]);
        if (this.onload) { this.onload({ target: { result: this.result } }); }
      }),
      onload: null, result: '',
    };
    vi.stubGlobal('FileReader', function() { return fakeReader; });
    fileChangeHandler();

    const stored = JSON.parse(_storage['abd-eep-fx-presets']);
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Good');
  });

  it('should skip import when no file selected', () => {
    const els = _init();
    _getClickHandler('settings-fx-preset-import-btn:click')();

    const fileChangeHandler = _clickHandlers['settings-fx-preset-file-input:change'];
    els.fileInput.files = [];
    fileChangeHandler();
    expect(els.statusEl.textContent).toBe('');
  });

  it('should expose _syncFxPresetsSettingsUI', () => {
    _init();
    expect(window._syncFxPresetsSettingsUI).toBeDefined();
    expect(typeof window._syncFxPresetsSettingsUI).toBe('function');
  });

  it('should refresh stats after clear', () => {
    _storage['abd-eep-fx-presets'] = JSON.stringify([
      { name: 'Del', slot: 0, type: 0, params: [], gain: 0, created: 0 },
    ]);
    const els = _init();
    expect(els.count.textContent).toBe('1 preset');
    _getClickHandler('settings-fx-preset-clear-btn:click')();
    expect(els.count.textContent).toBe('0 presets');
    expect(els.size.textContent).toBe('—');
  });

  it('should handle import of valid items from mixed array', () => {
    const els = _init();
    _getClickHandler('settings-fx-preset-import-btn:click')();

    const fileChangeHandler = _clickHandlers['settings-fx-preset-file-input:change'];
    els.fileInput.files = [{ name: 'mixed.json' }];

    const fakeReader = {
      readAsText: vi.fn(function() {
        this.result = JSON.stringify([
          { name: 'A', slot: 0, type: 0.1, params: [], gain: 0.5, created: 1 },
          { name: 'B', type: 0.2 }, // missing slot
        ]);
        if (this.onload) { this.onload({ target: { result: this.result } }); }
      }),
      onload: null, result: '',
    };
    vi.stubGlobal('FileReader', function() { return fakeReader; });
    fileChangeHandler();

    const stored = JSON.parse(_storage['abd-eep-fx-presets']);
    expect(stored).toHaveLength(2);
    expect(els.statusEl.textContent).toContain('Imported 2 presets (2 in file)');
  });
});
