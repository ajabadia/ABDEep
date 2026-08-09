/**
 * Unit tests for programmer_display_toggle.js — ProgrammerDisplayToggle class
 * that manages SYSEX/SCOPE/FFT/DUAL view mode switching.
 *
 * Run with: npx vitest run WebUI/tests/programmerDisplayToggle.test.js
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('ProgrammerDisplayToggle', () => {
  let win;
  let _lsStore;

  beforeEach(() => {
    _lsStore = {};
    const mockSysexBlock = { style: { display: 'block' } };
    const mockScopeBlock = { style: { display: 'none' } };
    const mockSysexActions = { style: { display: 'flex' } };
    const mockCopyBtn = { style: { display: 'inline-block' } };
    const mockExportBtn = { style: { display: 'inline-block' } };
    const mockZoomBtn = { style: { display: 'inline-block' } };

    win = {
      localStorage: {
        getItem: vi.fn(function(k) { return _lsStore[k] || null; }),
        setItem: vi.fn(function(k, v) { _lsStore[k] = String(v); }),
      },
      document: {
        getElementById: vi.fn(function(id) {
          if (id === 'programmer-sysex-view-block') {return mockSysexBlock;}
          if (id === 'programmer-scope-view-block') {return mockScopeBlock;}
          if (id === 'programmer-sysex-actions') {return mockSysexActions;}
          if (id === 'sysex-copy-btn') {return mockCopyBtn;}
          if (id === 'sysex-export-btn') {return mockExportBtn;}
          if (id === 'sysex-zoom-btn') {return mockZoomBtn;}
          return null;
        }),
        addEventListener: vi.fn(),
        querySelector: vi.fn(function() { return null; }),
        querySelectorAll: vi.fn(function() { return []; }),
      },
      addEventListener: vi.fn(),
      panelEditState: { _scopeViewMode: 0 },
      drawRealScope: vi.fn(),
    };
    global.window = win;
    global.localStorage = win.localStorage;
    global.document = win.document;

    const code = fs.readFileSync(path.resolve(__dirname, '../js/programmer_display_toggle.js'), 'utf-8');
    // Execute IIFE to define ProgrammerDisplayToggle on window
    eval(code);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete global.window;
    delete global.localStorage;
    delete global.document;
  });

  it('defaults to sysex mode when no stored preference', () => {
    expect(window.programmerDisplayToggle).toBeDefined();
    expect(window.programmerDisplayToggle.mode).toBe('sysex');
  });

  it('restores mode from localStorage when available', () => {
    const altStore = { 'abd-eep-programmer-view-mode': 'scope' };
    const altWin = {
      localStorage: {
        getItem: vi.fn(function(k) { return altStore[k] || null; }),
        setItem: vi.fn(),
      },
      document: { getElementById: vi.fn(), addEventListener: vi.fn(), querySelector: vi.fn(), querySelectorAll: vi.fn() },
      addEventListener: vi.fn(),
      panelEditState: { _scopeViewMode: 0 },
      drawRealScope: vi.fn(),
    };
    global.window = altWin;
    global.localStorage = altWin.localStorage;
    eval(fs.readFileSync(path.resolve(__dirname, '../js/programmer_display_toggle.js'), 'utf-8'));
    expect(altWin.programmerDisplayToggle.mode).toBe('scope');
  });

  it('setMode updates the mode property', () => {
    window.programmerDisplayToggle.setMode('scope');
    expect(window.programmerDisplayToggle.mode).toBe('scope');
  });

  it('setMode persists to localStorage', () => {
    window.programmerDisplayToggle.setMode('fft');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('abd-eep-programmer-view-mode', 'fft');
  });

  it('setMode defaults to sysex for invalid mode', () => {
    window.programmerDisplayToggle.setMode('invalid');
    expect(window.programmerDisplayToggle.mode).toBe('sysex');
  });

  it('setMode stores all 4 valid modes', () => {
    const modes = ['sysex', 'scope', 'fft', 'dual'];
    modes.forEach(function(m) {
      window.programmerDisplayToggle.setMode(m);
      expect(window.programmerDisplayToggle.mode).toBe(m);
    });
  });

  it('setMode calls applyMode internally', () => {
    const applySpy = vi.spyOn(window.programmerDisplayToggle, 'applyMode');
    window.programmerDisplayToggle.setMode('dual');
    expect(applySpy).toHaveBeenCalledWith('dual');
  });

  it('applyMode sets _scopeViewMode correctly for scope mode (1=WAVE)', () => {
    window.programmerDisplayToggle.applyMode('scope');
    expect(window.panelEditState._scopeViewMode).toBe(1);
  });

  it('applyMode sets _scopeViewMode correctly for fft mode (2=SPC)', () => {
    window.programmerDisplayToggle.applyMode('fft');
    expect(window.panelEditState._scopeViewMode).toBe(2);
  });

  it('applyMode sets _scopeViewMode correctly for dual mode (0=DUAL)', () => {
    window.programmerDisplayToggle.applyMode('dual');
    expect(window.panelEditState._scopeViewMode).toBe(0);
  });

  it('applyMode sets _scopeViewMode to 0 for sysex mode', () => {
    window.programmerDisplayToggle.applyMode('sysex');
    expect(window.panelEditState._scopeViewMode).toBe(0);
  });

  it('applyMode toggles block visibility based on mode', () => {
    const sysexBlock = { style: { display: 'block' } };
    const scopeBlock = { style: { display: 'none' } };
    const sysexActions = { style: { display: 'flex' } };
    const copyBtn = { style: { display: 'inline-block' } };
    const exportBtn = { style: { display: 'inline-block' } };
    const zoomBtn = { style: { display: 'inline-block' } };

    window.document.getElementById = vi.fn(function(id) {
      if (id === 'programmer-sysex-view-block') {return sysexBlock;}
      if (id === 'programmer-scope-view-block') {return scopeBlock;}
      if (id === 'programmer-sysex-actions') {return sysexActions;}
      if (id === 'sysex-copy-btn') {return copyBtn;}
      if (id === 'sysex-export-btn') {return exportBtn;}
      if (id === 'sysex-zoom-btn') {return zoomBtn;}
      return null;
    });

    window.programmerDisplayToggle.applyMode('fft');

    expect(sysexBlock.style.display).toBe('none');
    expect(scopeBlock.style.display).toBe('block');
    expect(sysexActions.style.display).toBe('flex');
    expect(copyBtn.style.display).toBe('none');
    expect(zoomBtn.style.display).toBe('inline-block');
  });

  it('applyMode shows sysex block when mode is sysex', () => {
    const sysexBlock = { style: { display: 'none' } };
    const scopeBlock = { style: { display: 'block' } };
    const sysexActions = { style: { display: 'none' } };
    const copyBtn = { style: { display: 'none' } };
    const exportBtn = { style: { display: 'none' } };
    const zoomBtn = { style: { display: 'inline-block' } };

    window.document.getElementById = vi.fn(function(id) {
      if (id === 'programmer-sysex-view-block') {return sysexBlock;}
      if (id === 'programmer-scope-view-block') {return scopeBlock;}
      if (id === 'programmer-sysex-actions') {return sysexActions;}
      if (id === 'sysex-copy-btn') {return copyBtn;}
      if (id === 'sysex-export-btn') {return exportBtn;}
      if (id === 'sysex-zoom-btn') {return zoomBtn;}
      return null;
    });

    window.programmerDisplayToggle.applyMode('sysex');

    expect(sysexBlock.style.display).toBe('block');
    expect(scopeBlock.style.display).toBe('none');
    expect(sysexActions.style.display).toBe('flex');
    expect(copyBtn.style.display).toBe('inline-block');
  });

  it('applyMode updates tab button states', () => {
    const buttons = [];
    for (let i = 0; i < 4; i++) {
      const classes = new Set();
      buttons.push({
        dataset: { mode: ['sysex', 'scope', 'fft', 'dual'][i] },
        classList: {
          add: (c) => classes.add(c),
          remove: (c) => classes.delete(c),
          toggle: (c, force) => force ? classes.add(c) : classes.delete(c),
          contains: (c) => classes.has(c),
        },
        style: { borderColor: '', color: '' },
      });
    }
    window.document.querySelectorAll = vi.fn(function() { return buttons; });

    window.programmerDisplayToggle.applyMode('fft');

    expect(buttons[2].classList.contains('active')).toBe(true);
    expect(buttons[0].classList.contains('active')).toBe(false);
  });

  it('handles missing DOM elements gracefully (no crash)', () => {
    expect(() => {
      window.programmerDisplayToggle.applyMode('scope');
    }).not.toThrow();
  });
});
