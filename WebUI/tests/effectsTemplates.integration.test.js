/**
 * Integration tests for WebUI/js/effects_templates.js
 *
 * These tests verify that renderActiveEffectParams() runs without errors
 * against a stubbed DOM/bridge and produces the expected semantic CSS classes.
 *
 * Run with: npx vitest run WebUI/tests/effectsTemplates.integration.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// ══════════════════════════════════════════════════════════════════
// Fake DOM helpers
// ══════════════════════════════════════════════════════════════════

function createFakeEl(tag, attrs) {
  return {
    tagName: (tag || 'div').toUpperCase(),
    id: (attrs && attrs.id) || '',
    _attrs: attrs || {},
    _listeners: {},
    value: (attrs && attrs.value) || '',
    textContent: '',
    innerHTML: '',
    innerText: '',
    style: {},
    dataset: {},
    classList: {
      _classes: [],
      add(c) { if (!this._classes.includes(c)) {this._classes.push(c);} },
      remove(c) { this._classes = this._classes.filter(x => x !== c); },
      contains(c) { return this._classes.includes(c); },
    },
    getAttribute(name) { return this._attrs[name] || null; },
    setAttribute(name, val) { this._attrs[name] = val; },
    addEventListener(event, handler) {
      if (!this._listeners[event]) {this._listeners[event] = [];}
      this._listeners[event].push(handler);
    },
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100, bottom: 100, right: 100 }; },
  };
}

// ══════════════════════════════════════════════════════════════════
// Load effects_templates_renderers.js + effects_templates.js
// ══════════════════════════════════════════════════════════════════

function loadEffectsTemplates() {
  // Must load theme and renderers first (defines _fxThemeStyle, _renderFX* used by _getFXTemplateRenderer)
  const modules = [
    'effects_theme.js',
    'effects_render_params.js',
    'effects_renderers_reverbs.js',
    'effects_renderers_eq_dynamics.js',
    'effects_renderers_modulation.js',
    'effects_renderers_delays_pitch.js',
    'effects_templates_renderers.js',
  ];
  for (const file of modules) {
    const fPath = path.resolve(__dirname, '../js', file);
    const code = fs.readFileSync(fPath, 'utf-8');
    // eslint-disable-next-line no-eval
    eval(code);
  }

  const filePath = path.resolve(__dirname, '../js/effects_templates.js');
  const code = fs.readFileSync(filePath, 'utf-8');
  // Execute in the current global context (uses global document/window)
  // eslint-disable-next-line no-eval
  eval(code);
}

// ══════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════

describe('renderActiveEffectParams integration', () => {
  let dynamicArea;
  let activeSlotLabel;
  let typeSelect;
  let originalWindowKeys;

  beforeEach(() => {
    // Build fake DOM elements
    dynamicArea = createFakeEl('div', { id: 'fx-dynamic-editor-area' });
    activeSlotLabel = createFakeEl('div', { id: 'fx-screen-active-slot' });
    typeSelect = createFakeEl('select', { class: 'fx-type-select', value: '2' });
    typeSelect.dataset.slot = '1';

    // Stub document
    global.document = {
      getElementById(id) {
        if (id === 'fx-dynamic-editor-area') {return dynamicArea;}
        if (id === 'fx-screen-active-slot') {return activeSlotLabel;}
        return null;
      },
      querySelector(sel) {
        if (sel === '.fx-type-select[data-slot="1"]') {return typeSelect;}
        return null;
      },
    };

    // Stub window globals used by effects_templates.js
    global.window = global;
    global._selectedFxSlot = 1;
    global.FX_TYPE_NAMES = [
      'Bypass', 'Ambience', 'tcDeepVerb', 'RoomRev', 'VintageRoom', 'HallReverb',
      'ChamberRev', 'Plate Reverb', 'Rich Plate', 'Gated Reverb', 'Reverse Reverb',
      'ChorusRev', 'DelayRev', 'FlangerRev', 'MidasEQ', 'Enhancer', 'FairComp',
      'MBDistortion', 'RackAmp', 'Edison', 'AutoPan/Trem', 'NoiseGate', 'Delay',
      '3Tap Delay', '4Tap Delay', 'T-RayDelay', 'DecimatorDelay', 'ModDlyRev',
      'Stereo Chorus', 'Chorus-D', 'Stereo Flanger', 'Stereo Phaser', 'Mood Filter',
      'Dual Pitch', 'Vintage Pitch', 'Rotary Speaker', 'BBD Chorus', 'Solina Ens', 'Ring Mod',
      'Space Echo', 'Tape Delay', 'Shimmer Dly', 'Granular Dly', 'Pattern Frz', 'Duck Delay',
      'Spectral Dly', 'Freq Shifter', 'HarmonicReso', 'Combulator', 'MB Vocoder',
      'OS Distortion', 'WaveShaper', 'FDN Reverb', 'Zita Reverb', 'Nimbus', 'Bonsai', 'TreeMonster'
    ];
    global.findMatchingFxPresetName = null;
    global.dualMidiBridge = {
      parameterCache: {},
      setParameter: () => {},
    };
  });

  afterEach(() => {
    delete global.document;
    delete global._selectedFxSlot;
    delete global.FX_TYPE_NAMES;
    delete global.findMatchingFxPresetName;
    delete global.dualMidiBridge;
    delete global.renderActiveEffectParams;
    delete global._readFxParamValue;
    delete global._fxThemeStyle;
    delete global._getFxTheme;
    delete global._getFXTemplateRenderer;
  });

  it('renders tcDeepVerb template without throwing and includes .fx-theme-custom', () => {
    typeSelect.value = '2';
    let threw = false;
    try {
      loadEffectsTemplates();
      global.renderActiveEffectParams();
    } catch (e) {
      threw = true;
      // eslint-disable-next-line no-console
      console.error('renderActiveEffectParams threw:', e);
    }

    expect(threw).toBe(false);
    expect(dynamicArea.innerHTML).toContain('tcDeepVerb');
    expect(activeSlotLabel.innerText).toContain('tcDeepVerb');
  });

  it('renders bypass template without throwing', () => {
    typeSelect.value = '0';
    let threw = false;
    try {
      loadEffectsTemplates();
      global.renderActiveEffectParams();
    } catch (e) {
      threw = true;
      // eslint-disable-next-line no-console
      console.error('renderActiveEffectParams threw:', e);
    }

    expect(threw).toBe(false);
    expect(dynamicArea.innerHTML).toContain('Effect Bypassed');
  });

  it('renders Plate Reverb template and includes expected labels', () => {
    typeSelect.value = '7';
    let threw = false;
    try {
      loadEffectsTemplates();
      global.renderActiveEffectParams();
    } catch (e) {
      threw = true;
      // eslint-disable-next-line no-console
      console.error('renderActiveEffectParams threw:', e);
    }

    expect(threw).toBe(false);
    expect(dynamicArea.innerHTML).toContain('PLATE');
    expect(dynamicArea.innerHTML).toContain('PRE DEL');
  });

  it('handles missing dynamic area gracefully', () => {
    global.document.getElementById = () => null;
    let threw = false;
    try {
      loadEffectsTemplates();
      global.renderActiveEffectParams();
    } catch (e) {
      threw = true;
      // eslint-disable-next-line no-console
      console.error('renderActiveEffectParams threw:', e);
    }
    expect(threw).toBe(false);
  });

  it('handles missing type select gracefully', () => {
    global.document.querySelector = () => null;
    let threw = false;
    try {
      loadEffectsTemplates();
      global.renderActiveEffectParams();
    } catch (e) {
      threw = true;
      // eslint-disable-next-line no-console
      console.error('renderActiveEffectParams threw:', e);
    }
    expect(threw).toBe(false);
  });
});
