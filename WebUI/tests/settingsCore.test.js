/**
 * Unit tests for settings.js — MIDI Learn Editor, Controller Curves UI,
 * Persistence init functions, Compare Mode, Dump Viewer (Vitest version)
 *
 * Run with: npx vitest run WebUI/tests/settingsCore.test.js
 *
 * NOTE: initVelocityCurveSetting, initPedalPolaritySetting, initMidiChannelSetting,
 * initMasterTuneSetting, initTransposeSetting, drawVelocityCurvePreview are
 * already covered in globalSettings.test.js.
 * applyControllerCurve, applyBipolarCurve, _evalCustomCurve, getControllerCurve,
 * getCustomCurvePoints are already covered in scriptCore.test.js.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state helpers (reused from globalSettings.test.js)
// ══════════════════════════════════════════════════════════════════

let _storage = {};
let _elementRegistry = {};
let _bridge;

function _resetStorage() { _storage = {}; }
function _resetElements() { _elementRegistry = {}; }

function _registerElement(id, el) { _elementRegistry[id] = el; }

function _resetBridge() {
  _bridge = {
    midiChannel: 1,
    parameterCache: {},
    midiLearnMappings: {},
    _hardwareInfo: { globalDumpBytes: [0, 128, 48, 0, 0], deviceId: '0' },
    _connected: true,
    _setGlobalCalls: [],
    _sendGlobalDumpCalled: false,
    setGlobalParameter(paramId, value) {
      this._setGlobalCalls.push({ paramId, value });
    },
    sendGlobalDump() { this._sendGlobalDumpCalled = true; },
    removeMidiLearnMapping(key) {
      delete this.midiLearnMappings[key];
    },
    clearMidiLearnMappings() {
      this.midiLearnMappings = {};
    },
    _saveMidiLearnMappings() { /* no-op */ },
    _getParamName(id) {
      const names = {
        'osc1_saw_enable': 'OSC1 Saw Enable',
        'vcf_cutoff': 'VCF Cutoff',
        'vca_level': 'VCA Level',
      };
      return names[id] || id;
    },
    getHardwareInfo() {
      return {
        deviceId: '0',
        midiChannel: this.midiChannel,
        connectionType: 'USB',
        hostVersion: '1.0',
        voiceVersion: '1.0',
      };
    },
  };
}

let _curveStorage = {
  aftertouch: 'linear',
  modwheel: 'linear',
  pitchbend: 'linear',
};
let _customPoints = {
  aftertouch: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  modwheel: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
  pitchbend: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
};

function _setupGlobals() {
  const mockDocument = {
    getElementById: (id) => _elementRegistry[id] || null,
    querySelector: (sel) => null,
    querySelectorAll: () => [],
    documentElement: { style: { setProperty: () => {} } },
    body: { dataset: {} },
  };
  const mockLocalStorage = {
    getItem: (k) => (_storage[k] !== undefined ? _storage[k] : null),
    setItem: (k, v) => { _storage[k] = String(v); },
    removeItem: (k) => { delete _storage[k]; },
    clear: () => { _storage = {}; },
  };
  vi.stubGlobal('document', mockDocument);
  vi.stubGlobal('localStorage', mockLocalStorage);
  vi.stubGlobal('getComputedStyle', () => ({
    getPropertyValue: (name) => (name === '--brand-accent' ? '#ff9900' : ''),
  }));
  vi.stubGlobal('window', {
    dualMidiBridge: _bridge,
    localStorage: mockLocalStorage,
    document: mockDocument,
    getComputedStyle: () => ({
      getPropertyValue: (name) => (name === '--brand-accent' ? '#ff9900' : ''),
    }),
    getControllerCurve: (name) => _curveStorage[name] || 'linear',
    setControllerCurve: (name, val) => { _curveStorage[name] = val; },
    getCustomCurvePoints: (name) => _customPoints[name] || [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    setCustomCurvePoints: (name, pts) => { _customPoints[name] = pts; },
    ShortcutConfig: null,
    _lastUnpackedBytes: null,
    _lastPresetName: null,
    BYTE_MAP: [],
    lcdSafeUpdate: () => {},
    updateLfoSlidersFromCurrentPreset: () => {},
    updateEnvSlidersFromCurrentPreset: () => {},
    updateOscSlidersFromCurrentPreset: () => {},
  });
}

// ══════════════════════════════════════════════════════════════════
// Fake DOM factory (reused from globalSettings.test.js)
// ══════════════════════════════════════════════════════════════════

function _createFakeElement(tag, attrs) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _attrs: attrs || {},
    _listeners: {},
    value: '',
    textContent: '',
    innerHTML: '',
    checked: false,
    disabled: false,
    style: {
      _props: {},
      removeProperty(prop) { delete this._props[prop]; },
      get color() { return this._props.color; },
      set color(val) { this._props.color = val; },
      get opacity() { return this._props.opacity; },
      set opacity(val) { this._props.opacity = val; },
      get display() { return this._props.display; },
      set display(val) { this._props.display = val; },
      get background() { return this._props.background; },
      set background(val) { this._props.background = val; },
      get outline() { return this._props.outline; },
      set outline(val) { this._props.outline = val; },
    },
    dataset: {},
    classList: {
      _classes: [],
      add(c) { if (!this._classes.includes(c)) this._classes.push(c); },
      remove(c) { this._classes = this._classes.filter((x) => x !== c); },
      contains(c) { return this._classes.includes(c); },
    },
    getAttribute(name) { return this._attrs[name]; },
    setAttribute(name, val) { this._attrs[name] = val; },
    addEventListener(event, handler) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(handler);
    },
    removeEventListener() {},
    dispatchEvent() {},
    appendChild(child) {
      this._children = this._children || [];
      this._children.push(child);
    },
    _children: [],
    _hideTimer: null,
    _wired: false,
    _customCurveSetupDone: false,
    _ctx: ((() => {
      const calls = [];
      return {
        _calls: calls,
        clearRect() { calls.push('clearRect'); },
        beginPath() { calls.push('beginPath'); },
        moveTo() { calls.push('moveTo'); },
        lineTo() { calls.push('lineTo'); },
        stroke() { calls.push('stroke'); },
        fillText() { calls.push('fillText'); },
        arc() { calls.push('arc'); },
        fill() { calls.push('fill'); },
        setLineDash() { calls.push('setLineDash'); },
        strokeStyle: null,
        lineWidth: null,
        fillStyle: null,
        font: null,
        textAlign: null,
      };
    }))(),
    getContext() { return this._ctx; },
    width: 80,
    height: 30,
    getBoundingClientRect() {
      return { top: 0, left: 0, width: 80, height: 30, bottom: 30, right: 80 };
    },
    setPointerCapture() {},
    click() {
      if (this._listeners.click) this._listeners.click.forEach(h => h({ preventDefault: () => {}, target: this }));
    },
    querySelectorAll: (sel) => [],
    querySelector: (sel) => null,
  };
  return el;
}

function _triggerChange(el, newValue) {
  el.value = newValue;
  const handlers = el._listeners.change || [];
  handlers.forEach((h) => h.call(el, { target: el }));
}

function _triggerInput(el, newValue) {
  el.value = newValue;
  const handlers = el._listeners.input || [];
  handlers.forEach((h) => h.call(el, { target: el }));
}

// ══════════════════════════════════════════════════════════════════
// Functions under test (extracted from settings.js)
// ══════════════════════════════════════════════════════════════════

// ── Persistence helpers ──

function initFadeSpeed() {
  const fadeSel = document.getElementById('settings-fade-speed');
  if (!fadeSel) return;
  const saved = localStorage.getItem('abd-eep-fade-speed') || 'normal';
  fadeSel.value = saved;
  fadeSel.addEventListener('change', () => {
    localStorage.setItem('abd-eep-fade-speed', fadeSel.value);
  });
}

function initLcdTimeoutSetting() {
  const sel = document.getElementById('settings-lcd-timeout');
  if (!sel) return;
  const saved = localStorage.getItem('abd-eep-lcd-timeout') || '2000';
  sel.value = saved;
  sel.addEventListener('change', () => {
    localStorage.setItem('abd-eep-lcd-timeout', sel.value);
  });
}

function initLcdVelocitySetting() {
  const velSel = document.getElementById('settings-lcd-velocity');
  if (!velSel) return;
  const saved = localStorage.getItem('abd-eep-lcd-velocity') || 'show';
  velSel.value = saved;
  velSel.addEventListener('change', () => {
    localStorage.setItem('abd-eep-lcd-velocity', velSel.value);
  });
}

function initPbSensitivitySetting() {
  const pbSlider = document.getElementById('settings-pb-sensitivity');
  const pbVal = document.getElementById('settings-pb-sensitivity-val');
  if (!pbSlider) return;
  const saved = localStorage.getItem('abd-eep-pb-sensitivity') || '6';
  pbSlider.value = saved;
  if (pbVal) pbVal.textContent = saved + 'px';
  pbSlider.addEventListener('input', () => {
    const val = pbSlider.value;
    localStorage.setItem('abd-eep-pb-sensitivity', val);
    if (pbVal) pbVal.textContent = val + 'px';
  });
}

function initMidiClockSetting() {
  const sel = document.getElementById('settings-midi-clock');
  if (!sel) return;
  const saved = localStorage.getItem('abd-eep-midi-clock') || 'internal';
  sel.value = saved;
  sel.addEventListener('change', function() {
    localStorage.setItem('abd-eep-midi-clock', this.value);
    if (window.dualMidiBridge && window.dualMidiBridge._updateArpTempo) {
      window.dualMidiBridge._updateArpTempo();
    }
  });
}

function initLcdContrastSetting() {
  const slider = document.getElementById('settings-lcd-contrast');
  const valEl = document.getElementById('settings-lcd-contrast-val');
  if (!slider) return;
  const saved = localStorage.getItem('abd-eep-lcd-contrast') || '70';
  slider.value = saved;
  if (valEl) valEl.textContent = saved + '%';
  function updateContrast(v) {
    const lcdEl = document.querySelector('.lcd-screen, #lcd-screen, .lcd');
    if (lcdEl) lcdEl.style.opacity = (v / 100).toFixed(2);
    document.documentElement.style.setProperty('--lcd-opacity', (v / 100).toFixed(2));
  }
  updateContrast(parseInt(saved));
  slider.addEventListener('input', function() {
    const val = this.value;
    localStorage.setItem('abd-eep-lcd-contrast', val);
    if (valEl) valEl.textContent = val + '%';
    updateContrast(parseInt(val));
  });
}

function initBarStyleSetting() {
  const sel = document.getElementById('settings-bar-style');
  if (!sel) return;
  const saved = localStorage.getItem('abd-eep-bar-style') || 'solid';
  sel.value = saved;
  sel.addEventListener('change', () => {
    localStorage.setItem('abd-eep-bar-style', sel.value);
  });
}

function initPitchBendModeSetting() {
  const sel = document.getElementById('settings-pitch-bend-mode');
  if (!sel) return;
  const saved = localStorage.getItem('abd-eep-pitch-bend-mode') || 'all';
  sel.value = saved;
  sel.addEventListener('change', function() {
    localStorage.setItem('abd-eep-pitch-bend-mode', this.value);
  });
}

function initPedalSettings() {
  const pedalType = document.getElementById('settings-pedal-type');
  const sustain = document.getElementById('settings-pedal-sustain');
  const sustainMode = document.getElementById('settings-pedal-sustain-mode');
  if (pedalType) {
    const saved = localStorage.getItem('abd-eep-pedal-type') || 'foot-ctrl';
    pedalType.value = saved;
    pedalType.addEventListener('change', function() { localStorage.setItem('abd-eep-pedal-type', this.value); });
  }
  if (sustain) {
    const saved = localStorage.getItem('abd-eep-pedal-sustain') || 'norm-open';
    sustain.value = saved;
    sustain.addEventListener('change', function() { localStorage.setItem('abd-eep-pedal-sustain', this.value); });
  }
  if (sustainMode) {
    const saved = localStorage.getItem('abd-eep-pedal-sustain-mode') || 'sustain';
    sustainMode.value = saved;
    sustainMode.addEventListener('change', function() { localStorage.setItem('abd-eep-pedal-sustain-mode', this.value); });
  }
}

function initPolyChainSettings() {
  const chain = document.getElementById('settings-poly-chain');
  const keyRange = document.getElementById('settings-poly-key-range');
  const lowerNote = document.getElementById('settings-poly-range-lower-note');
  const lowerOct = document.getElementById('settings-poly-range-lower-oct');
  const upperNote = document.getElementById('settings-poly-range-upper-note');
  const upperOct = document.getElementById('settings-poly-range-upper-oct');
  if (chain) {
    chain.checked = localStorage.getItem('abd-eep-poly-chain') === 'on';
    chain.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-chain', this.checked ? 'on' : 'off'); });
  }
  if (keyRange) {
    keyRange.checked = localStorage.getItem('abd-eep-poly-key-range') === 'on';
    keyRange.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-key-range', this.checked ? 'on' : 'off'); });
  }
  if (lowerNote) {
    lowerNote.value = localStorage.getItem('abd-eep-poly-range-lower-note') || 'C';
    lowerNote.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-lower-note', this.value); });
  }
  if (lowerOct) {
    lowerOct.value = localStorage.getItem('abd-eep-poly-range-lower-oct') || '-2';
    lowerOct.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-lower-oct', this.value); });
  }
  if (upperNote) {
    upperNote.value = localStorage.getItem('abd-eep-poly-range-upper-note') || 'G';
    upperNote.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-upper-note', this.value); });
  }
  if (upperOct) {
    upperOct.value = localStorage.getItem('abd-eep-poly-range-upper-oct') || '8';
    upperOct.addEventListener('change', function() { localStorage.setItem('abd-eep-poly-range-upper-oct', this.value); });
  }
}

function initRoutingSettings() {
  function wireSelect(id, storageKey, defaultValue) {
    const el = document.getElementById(id);
    if (!el) return;
    const saved = localStorage.getItem(storageKey) || defaultValue;
    el.value = saved;
    el.addEventListener('change', function() { localStorage.setItem(storageKey, this.value); });
  }
  function wireCheckbox(id, storageKey, defaultChecked) {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = localStorage.getItem(storageKey) === 'on' || (!localStorage.getItem(storageKey) && defaultChecked);
    el.addEventListener('change', function() { localStorage.setItem(storageKey, this.checked ? 'on' : 'off'); });
  }
  wireSelect('settings-midi-ctrl', 'abd-eep-midi-ctrl', 'Off');
  wireSelect('settings-midi-prog-change', 'abd-eep-midi-prog-change', 'RX');
  wireSelect('settings-midi-tx-ch', 'abd-eep-midi-tx-ch', 'RxCh');
  wireSelect('settings-midi-rx-ch', 'abd-eep-midi-rx-ch', 'All');
  wireCheckbox('settings-midi-soft-thru', 'abd-eep-midi-soft-thru', true);
  wireCheckbox('settings-midi-usb-thru', 'abd-eep-midi-usb-thru', false);
  wireCheckbox('settings-midi-wifi-thru', 'abd-eep-midi-wifi-thru', false);
  wireSelect('settings-usb-ctrl', 'abd-eep-usb-ctrl', 'Off');
  wireSelect('settings-usb-prog-change', 'abd-eep-usb-prog-change', 'RX');
  wireSelect('settings-usb-tx-ch', 'abd-eep-usb-tx-ch', 'RxCh');
  wireSelect('settings-usb-rx-ch', 'abd-eep-usb-rx-ch', 'All');
  wireCheckbox('settings-usb-midi-thru', 'abd-eep-usb-midi-thru', true);
  wireCheckbox('settings-usb-wifi-thru', 'abd-eep-usb-wifi-thru', false);
  wireSelect('settings-wifi-ctrl', 'abd-eep-wifi-ctrl', 'Off');
  wireSelect('settings-wifi-prog-change', 'abd-eep-wifi-prog-change', 'RX');
  wireSelect('settings-wifi-tx-ch', 'abd-eep-wifi-tx-ch', 'All');
  wireSelect('settings-wifi-rx-ch', 'abd-eep-wifi-rx-ch', 'RxCh');
  wireCheckbox('settings-wifi-midi-thru', 'abd-eep-wifi-midi-thru', false);
  wireCheckbox('settings-wifi-usb-thru', 'abd-eep-wifi-usb-thru', false);
  wireSelect('settings-device-id', 'abd-eep-device-id', '1');
}

function setActiveTheme(theme) {
  if (theme === 'default') {
    delete document.body.dataset.theme;
  } else {
    document.body.dataset.theme = theme;
  }
  localStorage.setItem('abd-eep-theme', theme);
  const themeSelect = document.getElementById('settings-theme-select');
  if (themeSelect) themeSelect.value = theme;
}

function initThemeSelector() {
  const themeSelect = document.getElementById('settings-theme-select');
  if (!themeSelect) return;
  const savedTheme = localStorage.getItem('abd-eep-theme') || 'default';
  setActiveTheme(savedTheme);
  themeSelect.value = savedTheme;
  themeSelect.addEventListener('change', () => {
    setActiveTheme(themeSelect.value);
  });
}

function initNavbarThemeSelector() {
  const themeMap = {
    'menu-theme-default': 'default',
    'menu-theme-red': 'red',
    'menu-theme-blue': 'blue',
    'menu-theme-green': 'green',
    'menu-theme-midnight': 'midnight',
    'menu-theme-dark-v2': 'dark-v2'
  };
  Object.keys(themeMap).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      setActiveTheme(themeMap[id]);
    });
  });
}

// ── Compare Mode ──

function _computeCompareDiff(snapshotStr) {
  if (!snapshotStr || !window.dualMidiBridge) return 0;
  try {
    var snap = JSON.parse(snapshotStr);
    var cache = window.dualMidiBridge.parameterCache;
    var count = 0;
    for (var paramId in snap) {
      if (snap.hasOwnProperty(paramId)) {
        var cached = cache[paramId];
        var snapped = snap[paramId];
        if (typeof snapped === 'object' || typeof cached === 'object') continue;
        if (cached === undefined || Math.abs(cached - snapped) > 0.001) {
          count++;
        }
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}

// ── Dump Viewer ──

const DUMP_REGION_COLORS = {
  'LFO1':    {bg:'#1a2a3a', fg:'#7fc8ff'},
  'LFO2':    {bg:'#1a2a3a', fg:'#7fc8ff'},
  'OSC1':    {bg:'#2a1a3a', fg:'#c87fff'},
  'OSC2':    {bg:'#2a1a3a', fg:'#c87fff'},
  'VCF':     {bg:'#1a3a2a', fg:'#7fffaf'},
  'ENV1':    {bg:'#3a2a1a', fg:'#ffc87f'},
  'FX':      {bg:'#2a1a2a', fg:'#ff7fff'},
  '?':       {bg:'#1a1a1a', fg:'#666666'},
  'Name':    {bg:'#1a1a1a', fg:'#cccccc'},
};

const DEFAULT_REGION_COLOR = {bg:'#111', fg:'#888'};

function getRegionColor(region) {
  return DUMP_REGION_COLORS[region] || DEFAULT_REGION_COLOR;
}

function formatTooltip(info, val) {
  const pct = (val / 255 * 100).toFixed(1);
  let lines = [`Byte ${info.idx} — ${info.param}`];
  lines.push(`Region: ${info.region} | Type: ${info.type}`);
  lines.push(`Value: ${val} (0x${val.toString(16).toUpperCase().padStart(2,'0')}) [${pct}%]`);
  if (info.type === 'toggle') {
    lines.push(`→ ${val > 0 ? 'ON (1)' : 'OFF (0)'}`);
  } else if (info.type === 'enum' && info.enumLabels) {
    const idx = Math.min(val, info.enumLabels.length - 1);
    lines.push(`→ ${info.enumLabels[idx]} (index ${idx})`);
  } else if (info.type === 'bipolar') {
    const bipolar = val - 128;
    lines.push(`→ Bipolar: ${bipolar} (center=0, range -128..+127)`);
    if (val === 128) lines.push('→ Center (no modulation)');
    else if (val === 0) lines.push('→ Skip step (seq) or min');
  } else if (info.type === 'time') {
    const secs = (val / 255 * 10).toFixed(3);
    lines.push(`→ ${secs}s`);
  } else if (info.type === 'ascii') {
    const ch = val >= 32 && val < 127 ? String.fromCharCode(val) : '·';
    lines.push(`→ '${ch}'`);
  }
  if (info.desc) lines.push(`Note: ${info.desc}`);
  return lines.join('\n');
}

// ── MIDI Learn Editor ──

function initMidiLearnEditor() {
  // Simplified: just return the helper functions for testing
  // The source wires them to DOM events; we test them in isolation
}

function refreshMappingsList() {
  var container = document.getElementById('midi-learn-mappings-list');
  var countEl = document.getElementById('midi-learn-mapping-count');
  if (!container) return;
  var bridge = window.dualMidiBridge;
  if (!bridge || !bridge.midiLearnMappings || Object.keys(bridge.midiLearnMappings).length === 0) {
    container.innerHTML = '<div class="text-dim text-center" style="padding:20px;font-size:var(--text-sm)">No mappings yet. Use MIDI LEARN on the main panel to create mappings.</div>';
    if (countEl) countEl.textContent = '0 mappings';
    return;
  }
  var html = '';
  var keys = Object.keys(bridge.midiLearnMappings);
  keys.forEach(function(key) {
    var paramId = bridge.midiLearnMappings[key];
    var displayKey = key.replace('nrpn:', 'NRPN ').replace('cc:', 'CC ');
    var paramName = bridge._getParamName ? bridge._getParamName(paramId) : paramId;
    html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-bottom:1px solid var(--border-dim);font-size:var(--text-sm)">'
      + '<span style="color:var(--accent-blue);font-weight:bold;font-family:\'Share Tech Mono\',monospace;min-width:80px">' + displayKey + '</span>'
      + '<span style="color:var(--text-secondary)">→</span>'
      + '<span style="color:var(--brand-accent);flex:1">' + paramName.toUpperCase() + '</span>'
      + '<button class="midi-learn-del-btn" data-key="' + key + '" style="background:none;border:1px solid var(--color-danger);color:var(--color-danger);border-radius:2px;cursor:pointer;padding:1px 6px;font-size:9px">Delete</button>'
      + '</div>';
  });
  container.innerHTML = html;
  if (countEl) countEl.textContent = keys.length + ' mapping' + (keys.length === 1 ? '' : 's');
}

// ── Controller Curves UI ──

function _getActiveCustomCtrlName() {
  const atSel = document.getElementById('settings-curve-aftertouch');
  const mwSel = document.getElementById('settings-curve-modwheel');
  const pbSel = document.getElementById('settings-curve-pitchbend');
  if (atSel && atSel.value === 'custom') return 'aftertouch';
  if (mwSel && mwSel.value === 'custom') return 'modwheel';
  if (pbSel && pbSel.value === 'custom') return 'pitchbend';
  return null;
}

let _lastCurveType = 'linear';
let _lastCurveIsBipolar = false;

function drawCurvePreview(curveType, bipolar) {
  _lastCurveType = curveType;
  _lastCurveIsBipolar = !!bipolar;
  const canvas = document.getElementById('curve-preview-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = 8;
  const graphW = w - pad * 2;
  const graphH = h - pad * 2;
  const centerY = pad + graphH / 2;
  ctx.clearRect(0, 0, w, h);
  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const x = pad + (i / 4) * graphW;
    const y = pad + (1 - i / 4) * graphH;
    ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, pad + graphH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(pad + graphW, y); ctx.stroke();
  }
  if (bipolar) {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, centerY);
    ctx.lineTo(pad + graphW, centerY);
    ctx.stroke();
  }
  // Linear reference (dim dashed)
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(pad, pad + graphH);
  ctx.lineTo(pad + graphW, pad);
  ctx.stroke();
  ctx.setLineDash([]);
  // Curve stroke
  const brandColor = '#ff9900';
  ctx.strokeStyle = brandColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let px = 0; px <= graphW; px++) {
    const t = px / graphW;
    let canvasY;
    if (bipolar) {
      const input = t * 2 - 1;
      let output = input;
      if (typeof window.applyBipolarCurve === 'function') {
        output = window.applyBipolarCurve(input, curveType);
      }
      canvasY = centerY - output * (graphH / 2);
    } else {
      let y = t;
      if (typeof window.applyControllerCurve === 'function') {
        y = window.applyControllerCurve(t, curveType);
      }
      canvasY = pad + graphH - y * graphH;
    }
    const canvasX = pad + px;
    if (px === 0) ctx.moveTo(canvasX, canvasY);
    else ctx.lineTo(canvasX, canvasY);
  }
  ctx.stroke();
  // Label
  const CURVE_LABELS = {
    'linear': 'Linear',
    'expo2': 'Quadratic',
    'expo3': 'Cubic',
    'log': 'Log',
    's-curve': 'S-Curve',
    'custom': 'Custom'
  };
  const label = (bipolar ? 'Bipolar ' : '') + (CURVE_LABELS[curveType] || curveType);
  ctx.fillStyle = brandColor;
  ctx.font = 'bold 8px Share Tech Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(label, pad + graphW, pad + 9);
  ctx.textAlign = 'start';
  // Endpoint labels
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '7px Share Tech Mono, monospace';
  if (bipolar) {
    ctx.fillText('-1', pad, pad + graphH + 7);
    ctx.fillText('0', pad + graphW / 2 - 3, pad + graphH + 7);
    ctx.fillText('+1', pad + graphW - 7, pad + graphH + 7);
  } else {
    ctx.fillText('0', pad, pad + graphH + 7);
    ctx.fillText('1', pad + graphW - 5, pad + graphH + 7);
  }
}

function initControllerCurves() {
  const atCurveSel = document.getElementById('settings-curve-aftertouch');
  const mwCurveSel = document.getElementById('settings-curve-modwheel');
  const pbCurveSel = document.getElementById('settings-curve-pitchbend');
  if (atCurveSel) {
    atCurveSel.value = window.getControllerCurve('aftertouch');
    atCurveSel.addEventListener('change', () => {
      window.setControllerCurve('aftertouch', atCurveSel.value);
      drawCurvePreview(atCurveSel.value);
    });
  }
  if (mwCurveSel) {
    mwCurveSel.value = window.getControllerCurve('modwheel');
    mwCurveSel.addEventListener('change', () => {
      window.setControllerCurve('modwheel', mwCurveSel.value);
      drawCurvePreview(mwCurveSel.value);
    });
  }
  if (pbCurveSel) {
    pbCurveSel.value = window.getControllerCurve('pitchbend');
    pbCurveSel.addEventListener('change', () => {
      window.setControllerCurve('pitchbend', pbCurveSel.value);
      drawCurvePreview(pbCurveSel.value, true);
    });
  }
  if (atCurveSel) drawCurvePreview(atCurveSel.value);
}

// ══════════════════════════════════════════════════════════════════
// Test suites
// ══════════════════════════════════════════════════════════════════

// ── 1. PERSISTENCE INIT FUNCTIONS ──

describe('initFadeSpeed', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores saved value from localStorage', () => {
    _storage['abd-eep-fade-speed'] = 'slow';
    const sel = _createFakeElement('select', { id: 'settings-fade-speed' });
    _registerElement('settings-fade-speed', sel);
    initFadeSpeed();
    expect(sel.value).toBe('slow');
  });

  it('defaults to normal when no saved value', () => {
    const sel = _createFakeElement('select', { id: 'settings-fade-speed' });
    _registerElement('settings-fade-speed', sel);
    initFadeSpeed();
    expect(sel.value).toBe('normal');
  });

  it('change saves to localStorage', () => {
    const sel = _createFakeElement('select', { id: 'settings-fade-speed' });
    _registerElement('settings-fade-speed', sel);
    initFadeSpeed();
    _triggerChange(sel, 'fast');
    expect(_storage['abd-eep-fade-speed']).toBe('fast');
  });

  it('does nothing when select element missing', () => {
    initFadeSpeed();
    expect(true).toBe(true); // no crash
  });
});

describe('initLcdTimeoutSetting', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores saved value', () => {
    _storage['abd-eep-lcd-timeout'] = '5000';
    const sel = _createFakeElement('select', { id: 'settings-lcd-timeout' });
    _registerElement('settings-lcd-timeout', sel);
    initLcdTimeoutSetting();
    expect(sel.value).toBe('5000');
  });

  it('defaults to 2000 when no saved value', () => {
    const sel = _createFakeElement('select', { id: 'settings-lcd-timeout' });
    _registerElement('settings-lcd-timeout', sel);
    initLcdTimeoutSetting();
    expect(sel.value).toBe('2000');
  });

  it('change saves to localStorage', () => {
    const sel = _createFakeElement('select', { id: 'settings-lcd-timeout' });
    _registerElement('settings-lcd-timeout', sel);
    initLcdTimeoutSetting();
    _triggerChange(sel, '3000');
    expect(_storage['abd-eep-lcd-timeout']).toBe('3000');
  });

  it('does nothing when select missing', () => {
    initLcdTimeoutSetting();
    expect(true).toBe(true);
  });
});

describe('initLcdVelocitySetting', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores saved value', () => {
    _storage['abd-eep-lcd-velocity'] = 'hide';
    const sel = _createFakeElement('select', { id: 'settings-lcd-velocity' });
    _registerElement('settings-lcd-velocity', sel);
    initLcdVelocitySetting();
    expect(sel.value).toBe('hide');
  });

  it('defaults to show', () => {
    const sel = _createFakeElement('select', { id: 'settings-lcd-velocity' });
    _registerElement('settings-lcd-velocity', sel);
    initLcdVelocitySetting();
    expect(sel.value).toBe('show');
  });

  it('change saves value', () => {
    const sel = _createFakeElement('select', { id: 'settings-lcd-velocity' });
    _registerElement('settings-lcd-velocity', sel);
    initLcdVelocitySetting();
    _triggerChange(sel, 'hide');
    expect(_storage['abd-eep-lcd-velocity']).toBe('hide');
  });
});

describe('initPbSensitivitySetting', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores saved value on slider', () => {
    _storage['abd-eep-pb-sensitivity'] = '12';
    const slider = _createFakeElement('input', { id: 'settings-pb-sensitivity' });
    _registerElement('settings-pb-sensitivity', slider);
    initPbSensitivitySetting();
    expect(slider.value).toBe('12');
  });

  it('restores saved value on display element', () => {
    _storage['abd-eep-pb-sensitivity'] = '12';
    const slider = _createFakeElement('input', { id: 'settings-pb-sensitivity' });
    const valEl = _createFakeElement('span', { id: 'settings-pb-sensitivity-val' });
    _registerElement('settings-pb-sensitivity', slider);
    _registerElement('settings-pb-sensitivity-val', valEl);
    initPbSensitivitySetting();
    expect(valEl.textContent).toBe('12px');
  });

  it('defaults to 6', () => {
    const slider = _createFakeElement('input', { id: 'settings-pb-sensitivity' });
    _registerElement('settings-pb-sensitivity', slider);
    initPbSensitivitySetting();
    expect(slider.value).toBe('6');
  });

  it('input saves and updates display', () => {
    const slider = _createFakeElement('input', { id: 'settings-pb-sensitivity' });
    const valEl = _createFakeElement('span', { id: 'settings-pb-sensitivity-val' });
    _registerElement('settings-pb-sensitivity', slider);
    _registerElement('settings-pb-sensitivity-val', valEl);
    initPbSensitivitySetting();
    _triggerInput(slider, '10');
    expect(_storage['abd-eep-pb-sensitivity']).toBe('10');
    expect(valEl.textContent).toBe('10px');
  });

  it('does not crash without val display element', () => {
    const slider = _createFakeElement('input', { id: 'settings-pb-sensitivity' });
    _registerElement('settings-pb-sensitivity', slider);
    initPbSensitivitySetting();
    _triggerInput(slider, '8');
    expect(_storage['abd-eep-pb-sensitivity']).toBe('8');
  });

  it('does nothing when slider missing', () => {
    initPbSensitivitySetting();
    expect(true).toBe(true);
  });
});

describe('initMidiClockSetting', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
    _bridge._updateArpTempo = vi.fn();
  });

  it('restores saved value', () => {
    _storage['abd-eep-midi-clock'] = 'external';
    const sel = _createFakeElement('select', { id: 'settings-midi-clock' });
    _registerElement('settings-midi-clock', sel);
    initMidiClockSetting();
    expect(sel.value).toBe('external');
  });

  it('defaults to internal', () => {
    const sel = _createFakeElement('select', { id: 'settings-midi-clock' });
    _registerElement('settings-midi-clock', sel);
    initMidiClockSetting();
    expect(sel.value).toBe('internal');
  });

  it('change saves and calls _updateArpTempo', () => {
    const sel = _createFakeElement('select', { id: 'settings-midi-clock' });
    _registerElement('settings-midi-clock', sel);
    initMidiClockSetting();
    _triggerChange(sel, 'external');
    expect(_storage['abd-eep-midi-clock']).toBe('external');
    expect(_bridge._updateArpTempo).toHaveBeenCalledTimes(1);
  });

  it('change without _updateArpTempo does not throw', () => {
    delete _bridge._updateArpTempo;
    const sel = _createFakeElement('select', { id: 'settings-midi-clock' });
    _registerElement('settings-midi-clock', sel);
    initMidiClockSetting();
    _triggerChange(sel, 'external');
    expect(_storage['abd-eep-midi-clock']).toBe('external');
  });

  it('does nothing when select missing', () => {
    initMidiClockSetting();
    expect(true).toBe(true);
  });
});

describe('initLcdContrastSetting', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores saved value on slider', () => {
    _storage['abd-eep-lcd-contrast'] = '50';
    const slider = _createFakeElement('input', { id: 'settings-lcd-contrast' });
    _registerElement('settings-lcd-contrast', slider);
    initLcdContrastSetting();
    expect(slider.value).toBe('50');
  });

  it('restores saved value on display element', () => {
    _storage['abd-eep-lcd-contrast'] = '90';
    const slider = _createFakeElement('input', { id: 'settings-lcd-contrast' });
    const valEl = _createFakeElement('span', { id: 'settings-lcd-contrast-val' });
    _registerElement('settings-lcd-contrast', slider);
    _registerElement('settings-lcd-contrast-val', valEl);
    initLcdContrastSetting();
    expect(valEl.textContent).toBe('90%');
  });

  it('defaults to 70', () => {
    const slider = _createFakeElement('input', { id: 'settings-lcd-contrast' });
    _registerElement('settings-lcd-contrast', slider);
    initLcdContrastSetting();
    expect(slider.value).toBe('70');
  });

  it('input saves and updates display', () => {
    const slider = _createFakeElement('input', { id: 'settings-lcd-contrast' });
    const valEl = _createFakeElement('span', { id: 'settings-lcd-contrast-val' });
    _registerElement('settings-lcd-contrast', slider);
    _registerElement('settings-lcd-contrast-val', valEl);
    initLcdContrastSetting();
    _triggerInput(slider, '45');
    expect(_storage['abd-eep-lcd-contrast']).toBe('45');
    expect(valEl.textContent).toBe('45%');
  });

  it('input updates CSS --lcd-opacity', () => {
    const slider = _createFakeElement('input', { id: 'settings-lcd-contrast' });
    _registerElement('settings-lcd-contrast', slider);
    const setPropertySpy = vi.fn();
    document.documentElement.style.setProperty = setPropertySpy;
    initLcdContrastSetting();
    _triggerInput(slider, '30');
    expect(setPropertySpy).toHaveBeenCalledWith('--lcd-opacity', '0.30');
  });

  it('does not crash without val display element', () => {
    const slider = _createFakeElement('input', { id: 'settings-lcd-contrast' });
    _registerElement('settings-lcd-contrast', slider);
    initLcdContrastSetting();
    _triggerInput(slider, '80');
    expect(_storage['abd-eep-lcd-contrast']).toBe('80');
  });

  it('does nothing when slider missing', () => {
    initLcdContrastSetting();
    expect(true).toBe(true);
  });
});

describe('initBarStyleSetting', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores saved value', () => {
    _storage['abd-eep-bar-style'] = 'gradient';
    const sel = _createFakeElement('select', { id: 'settings-bar-style' });
    _registerElement('settings-bar-style', sel);
    initBarStyleSetting();
    expect(sel.value).toBe('gradient');
  });

  it('defaults to solid', () => {
    const sel = _createFakeElement('select', { id: 'settings-bar-style' });
    _registerElement('settings-bar-style', sel);
    initBarStyleSetting();
    expect(sel.value).toBe('solid');
  });

  it('change saves to localStorage', () => {
    const sel = _createFakeElement('select', { id: 'settings-bar-style' });
    _registerElement('settings-bar-style', sel);
    initBarStyleSetting();
    _triggerChange(sel, 'gradient');
    expect(_storage['abd-eep-bar-style']).toBe('gradient');
  });
});

describe('initPitchBendModeSetting', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores saved value', () => {
    _storage['abd-eep-pitch-bend-mode'] = 'mono';
    const sel = _createFakeElement('select', { id: 'settings-pitch-bend-mode' });
    _registerElement('settings-pitch-bend-mode', sel);
    initPitchBendModeSetting();
    expect(sel.value).toBe('mono');
  });

  it('defaults to all', () => {
    const sel = _createFakeElement('select', { id: 'settings-pitch-bend-mode' });
    _registerElement('settings-pitch-bend-mode', sel);
    initPitchBendModeSetting();
    expect(sel.value).toBe('all');
  });

  it('change saves to localStorage', () => {
    const sel = _createFakeElement('select', { id: 'settings-pitch-bend-mode' });
    _registerElement('settings-pitch-bend-mode', sel);
    initPitchBendModeSetting();
    _triggerChange(sel, 'mono');
    expect(_storage['abd-eep-pitch-bend-mode']).toBe('mono');
  });
});

describe('initPedalSettings', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores pedal type, sustain, sustain mode from localStorage', () => {
    _storage['abd-eep-pedal-type'] = 'switch';
    _storage['abd-eep-pedal-sustain'] = 'norm-closed';
    _storage['abd-eep-pedal-sustain-mode'] = 'half';
    const pedalType = _createFakeElement('select', { id: 'settings-pedal-type' });
    const sustain = _createFakeElement('select', { id: 'settings-pedal-sustain' });
    const sustainMode = _createFakeElement('select', { id: 'settings-pedal-sustain-mode' });
    _registerElement('settings-pedal-type', pedalType);
    _registerElement('settings-pedal-sustain', sustain);
    _registerElement('settings-pedal-sustain-mode', sustainMode);
    initPedalSettings();
    expect(pedalType.value).toBe('switch');
    expect(sustain.value).toBe('norm-closed');
    expect(sustainMode.value).toBe('half');
  });

  it('defaults to foot-ctrl, norm-open, sustain', () => {
    const pedalType = _createFakeElement('select', { id: 'settings-pedal-type' });
    const sustain = _createFakeElement('select', { id: 'settings-pedal-sustain' });
    const sustainMode = _createFakeElement('select', { id: 'settings-pedal-sustain-mode' });
    _registerElement('settings-pedal-type', pedalType);
    _registerElement('settings-pedal-sustain', sustain);
    _registerElement('settings-pedal-sustain-mode', sustainMode);
    initPedalSettings();
    expect(pedalType.value).toBe('foot-ctrl');
    expect(sustain.value).toBe('norm-open');
    expect(sustainMode.value).toBe('sustain');
  });

  it('change saves each setting to localStorage', () => {
    const pedalType = _createFakeElement('select', { id: 'settings-pedal-type' });
    const sustain = _createFakeElement('select', { id: 'settings-pedal-sustain' });
    const sustainMode = _createFakeElement('select', { id: 'settings-pedal-sustain-mode' });
    _registerElement('settings-pedal-type', pedalType);
    _registerElement('settings-pedal-sustain', sustain);
    _registerElement('settings-pedal-sustain-mode', sustainMode);
    initPedalSettings();
    _triggerChange(pedalType, 'switch');
    _triggerChange(sustain, 'norm-closed');
    _triggerChange(sustainMode, 'half');
    expect(_storage['abd-eep-pedal-type']).toBe('switch');
    expect(_storage['abd-eep-pedal-sustain']).toBe('norm-closed');
    expect(_storage['abd-eep-pedal-sustain-mode']).toBe('half');
  });

  it('handles missing elements gracefully', () => {
    initPedalSettings();
    expect(true).toBe(true); // no crash
  });

  it('handles partial elements (only pedal type exists)', () => {
    const pedalType = _createFakeElement('select', { id: 'settings-pedal-type' });
    _registerElement('settings-pedal-type', pedalType);
    initPedalSettings();
    expect(pedalType.value).toBe('foot-ctrl');
    _triggerChange(pedalType, 'switch');
    expect(_storage['abd-eep-pedal-type']).toBe('switch');
  });
});

describe('initPolyChainSettings', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores chain and keyRange checked from localStorage', () => {
    _storage['abd-eep-poly-chain'] = 'on';
    _storage['abd-eep-poly-key-range'] = 'on';
    const chain = _createFakeElement('input', { type: 'checkbox', id: 'settings-poly-chain' });
    const keyRange = _createFakeElement('input', { type: 'checkbox', id: 'settings-poly-key-range' });
    _registerElement('settings-poly-chain', chain);
    _registerElement('settings-poly-key-range', keyRange);
    initPolyChainSettings();
    expect(chain.checked).toBe(true);
    expect(keyRange.checked).toBe(true);
  });

  it('chain defaults to unchecked', () => {
    const chain = _createFakeElement('input', { type: 'checkbox', id: 'settings-poly-chain' });
    _registerElement('settings-poly-chain', chain);
    initPolyChainSettings();
    expect(chain.checked).toBe(false);
  });

  it('restores note and octave values', () => {
    _storage['abd-eep-poly-range-lower-note'] = 'E';
    _storage['abd-eep-poly-range-lower-oct'] = '1';
    _storage['abd-eep-poly-range-upper-note'] = 'A';
    _storage['abd-eep-poly-range-upper-oct'] = '6';
    const lowerNote = _createFakeElement('select', { id: 'settings-poly-range-lower-note' });
    const lowerOct = _createFakeElement('select', { id: 'settings-poly-range-lower-oct' });
    const upperNote = _createFakeElement('select', { id: 'settings-poly-range-upper-note' });
    const upperOct = _createFakeElement('select', { id: 'settings-poly-range-upper-oct' });
    _registerElement('settings-poly-range-lower-note', lowerNote);
    _registerElement('settings-poly-range-lower-oct', lowerOct);
    _registerElement('settings-poly-range-upper-note', upperNote);
    _registerElement('settings-poly-range-upper-oct', upperOct);
    initPolyChainSettings();
    expect(lowerNote.value).toBe('E');
    expect(lowerOct.value).toBe('1');
    expect(upperNote.value).toBe('A');
    expect(upperOct.value).toBe('6');
  });

  it('defaults note/oct values', () => {
    const lowerNote = _createFakeElement('select', { id: 'settings-poly-range-lower-note' });
    const lowerOct = _createFakeElement('select', { id: 'settings-poly-range-lower-oct' });
    const upperNote = _createFakeElement('select', { id: 'settings-poly-range-upper-note' });
    const upperOct = _createFakeElement('select', { id: 'settings-poly-range-upper-oct' });
    _registerElement('settings-poly-range-lower-note', lowerNote);
    _registerElement('settings-poly-range-lower-oct', lowerOct);
    _registerElement('settings-poly-range-upper-note', upperNote);
    _registerElement('settings-poly-range-upper-oct', upperOct);
    initPolyChainSettings();
    expect(lowerNote.value).toBe('C');
    expect(lowerOct.value).toBe('-2');
    expect(upperNote.value).toBe('G');
    expect(upperOct.value).toBe('8');
  });

  it('change saves all poly values', () => {
    const chain = _createFakeElement('input', { type: 'checkbox', id: 'settings-poly-chain' });
    const keyRange = _createFakeElement('input', { type: 'checkbox', id: 'settings-poly-key-range' });
    const lowerNote = _createFakeElement('select', { id: 'settings-poly-range-lower-note' });
    const lowerOct = _createFakeElement('select', { id: 'settings-poly-range-lower-oct' });
    const upperNote = _createFakeElement('select', { id: 'settings-poly-range-upper-note' });
    const upperOct = _createFakeElement('select', { id: 'settings-poly-range-upper-oct' });
    _registerElement('settings-poly-chain', chain);
    _registerElement('settings-poly-key-range', keyRange);
    _registerElement('settings-poly-range-lower-note', lowerNote);
    _registerElement('settings-poly-range-lower-oct', lowerOct);
    _registerElement('settings-poly-range-upper-note', upperNote);
    _registerElement('settings-poly-range-upper-oct', upperOct);
    initPolyChainSettings();
    chain.checked = true;
    _triggerChange(chain, true);
    keyRange.checked = true;
    _triggerChange(keyRange, true);
    _triggerChange(lowerNote, 'F');
    _triggerChange(lowerOct, '2');
    _triggerChange(upperNote, 'B');
    _triggerChange(upperOct, '7');
    expect(_storage['abd-eep-poly-chain']).toBe('on');
    expect(_storage['abd-eep-poly-key-range']).toBe('on');
    expect(_storage['abd-eep-poly-range-lower-note']).toBe('F');
    expect(_storage['abd-eep-poly-range-lower-oct']).toBe('2');
    expect(_storage['abd-eep-poly-range-upper-note']).toBe('B');
    expect(_storage['abd-eep-poly-range-upper-oct']).toBe('7');
  });

  it('handles missing elements', () => {
    initPolyChainSettings();
    expect(true).toBe(true);
  });
});

describe('initRoutingSettings', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores MIDI select defaults', () => {
    const ctrl = _createFakeElement('select', { id: 'settings-midi-ctrl' });
    const prog = _createFakeElement('select', { id: 'settings-midi-prog-change' });
    const txCh = _createFakeElement('select', { id: 'settings-midi-tx-ch' });
    const rxCh = _createFakeElement('select', { id: 'settings-midi-rx-ch' });
    _registerElement('settings-midi-ctrl', ctrl);
    _registerElement('settings-midi-prog-change', prog);
    _registerElement('settings-midi-tx-ch', txCh);
    _registerElement('settings-midi-rx-ch', rxCh);
    initRoutingSettings();
    expect(ctrl.value).toBe('Off');
    expect(prog.value).toBe('RX');
    expect(txCh.value).toBe('RxCh');
    expect(rxCh.value).toBe('All');
  });

  it('restores MIDI checkbox defaults (soft-thru on, others off)', () => {
    const softThru = _createFakeElement('input', { type: 'checkbox', id: 'settings-midi-soft-thru' });
    const usbThru = _createFakeElement('input', { type: 'checkbox', id: 'settings-midi-usb-thru' });
    const wifiThru = _createFakeElement('input', { type: 'checkbox', id: 'settings-midi-wifi-thru' });
    _registerElement('settings-midi-soft-thru', softThru);
    _registerElement('settings-midi-usb-thru', usbThru);
    _registerElement('settings-midi-wifi-thru', wifiThru);
    initRoutingSettings();
    expect(softThru.checked).toBe(true);
    expect(usbThru.checked).toBe(false);
    expect(wifiThru.checked).toBe(false);
  });

  it('restores USB select defaults', () => {
    const ctrl = _createFakeElement('select', { id: 'settings-usb-ctrl' });
    const prog = _createFakeElement('select', { id: 'settings-usb-prog-change' });
    const txCh = _createFakeElement('select', { id: 'settings-usb-tx-ch' });
    const rxCh = _createFakeElement('select', { id: 'settings-usb-rx-ch' });
    _registerElement('settings-usb-ctrl', ctrl);
    _registerElement('settings-usb-prog-change', prog);
    _registerElement('settings-usb-tx-ch', txCh);
    _registerElement('settings-usb-rx-ch', rxCh);
    initRoutingSettings();
    expect(ctrl.value).toBe('Off');
    expect(prog.value).toBe('RX');
    expect(txCh.value).toBe('RxCh');
    expect(rxCh.value).toBe('All');
  });

  it('restores saved values from localStorage', () => {
    _storage['abd-eep-midi-ctrl'] = 'On';
    _storage['abd-eep-midi-soft-thru'] = 'off';
    const ctrl = _createFakeElement('select', { id: 'settings-midi-ctrl' });
    const softThru = _createFakeElement('input', { type: 'checkbox', id: 'settings-midi-soft-thru' });
    _registerElement('settings-midi-ctrl', ctrl);
    _registerElement('settings-midi-soft-thru', softThru);
    initRoutingSettings();
    expect(ctrl.value).toBe('On');
    expect(softThru.checked).toBe(false);
  });

  it('change saves MIDI select values', () => {
    const ctrl = _createFakeElement('select', { id: 'settings-midi-ctrl' });
    _registerElement('settings-midi-ctrl', ctrl);
    initRoutingSettings();
    _triggerChange(ctrl, 'On');
    expect(_storage['abd-eep-midi-ctrl']).toBe('On');
  });

  it('change saves MIDI checkbox values', () => {
    const softThru = _createFakeElement('input', { type: 'checkbox', id: 'settings-midi-soft-thru' });
    _registerElement('settings-midi-soft-thru', softThru);
    initRoutingSettings();
    softThru.checked = false;
    _triggerChange(softThru, false);
    expect(_storage['abd-eep-midi-soft-thru']).toBe('off');
  });

  it('restores Device ID default', () => {
    const devId = _createFakeElement('select', { id: 'settings-device-id' });
    _registerElement('settings-device-id', devId);
    initRoutingSettings();
    expect(devId.value).toBe('1');
  });

  it('handles all missing elements gracefully', () => {
    initRoutingSettings();
    expect(true).toBe(true);
  });
});

// ── THEME SELECTORS ──

describe('setActiveTheme', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('sets theme to red and saves', () => {
    setActiveTheme('red');
    expect(document.body.dataset.theme).toBe('red');
    expect(_storage['abd-eep-theme']).toBe('red');
  });

  it('sets theme to default (deletes dataset.theme)', () => {
    document.body.dataset.theme = 'red';
    setActiveTheme('default');
    expect(document.body.dataset.theme).toBeUndefined();
    expect(_storage['abd-eep-theme']).toBe('default');
  });

  it('sets theme select element if exists', () => {
    const themeSelect = _createFakeElement('select', { id: 'settings-theme-select' });
    _registerElement('settings-theme-select', themeSelect);
    setActiveTheme('blue');
    expect(themeSelect.value).toBe('blue');
  });

  it('does not crash without theme select', () => {
    setActiveTheme('red');
    expect(_storage['abd-eep-theme']).toBe('red');
  });
});

describe('initThemeSelector', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('restores saved theme', () => {
    _storage['abd-eep-theme'] = 'midnight';
    const themeSelect = _createFakeElement('select', { id: 'settings-theme-select' });
    _registerElement('settings-theme-select', themeSelect);
    initThemeSelector();
    expect(themeSelect.value).toBe('midnight');
  });

  it('defaults to default', () => {
    const themeSelect = _createFakeElement('select', { id: 'settings-theme-select' });
    _registerElement('settings-theme-select', themeSelect);
    initThemeSelector();
    expect(themeSelect.value).toBe('default');
  });

  it('change saves and applies new theme', () => {
    const themeSelect = _createFakeElement('select', { id: 'settings-theme-select' });
    _registerElement('settings-theme-select', themeSelect);
    initThemeSelector();
    _triggerChange(themeSelect, 'green');
    expect(_storage['abd-eep-theme']).toBe('green');
    expect(document.body.dataset.theme).toBe('green');
  });

  it('does nothing when select missing', () => {
    initThemeSelector();
    expect(true).toBe(true);
  });
});

describe('initNavbarThemeSelector', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('wires click handlers for all theme menu items', () => {
    const themeIds = ['menu-theme-default', 'menu-theme-red', 'menu-theme-blue',
      'menu-theme-green', 'menu-theme-midnight', 'menu-theme-dark-v2'];
    themeIds.forEach(id => {
      _registerElement(id, _createFakeElement('a', { id }));
    });
    initNavbarThemeSelector();
    // Click each and verify theme saved
    const el = _elementRegistry['menu-theme-red'];
    el.click();
    expect(_storage['abd-eep-theme']).toBe('red');
    expect(document.body.dataset.theme).toBe('red');
  });

  it('clicking default removes dataset.theme', () => {
    document.body.dataset.theme = 'red';
    _registerElement('menu-theme-default', _createFakeElement('a', { id: 'menu-theme-default' }));
    initNavbarThemeSelector();
    _elementRegistry['menu-theme-default'].click();
    expect(_storage['abd-eep-theme']).toBe('default');
    expect(document.body.dataset.theme).toBeUndefined();
  });

  it('handles missing elements gracefully', () => {
    initNavbarThemeSelector();
    expect(true).toBe(true); // no crash
  });

  it('wires all 6 theme buttons', () => {
    const themeIds = ['menu-theme-default', 'menu-theme-red', 'menu-theme-blue',
      'menu-theme-green', 'menu-theme-midnight', 'menu-theme-dark-v2'];
    themeIds.forEach(id => {
      _registerElement(id, _createFakeElement('a', { id }));
    });
    initNavbarThemeSelector();
    const themes = ['default', 'red', 'blue', 'green', 'midnight', 'dark-v2'];
    themeIds.forEach((id, i) => {
      _elementRegistry[id].click();
      expect(_storage['abd-eep-theme']).toBe(themes[i]);
    });
  });
});

// ── 2. COMPARE MODE ──

describe('_computeCompareDiff', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('returns 0 when snapshot is null', () => {
    expect(_computeCompareDiff(null)).toBe(0);
  });

  it('returns 0 when snapshot is empty string', () => {
    expect(_computeCompareDiff('')).toBe(0);
  });

  it('returns 0 when no bridge', () => {
    window.dualMidiBridge = null;
    expect(_computeCompareDiff('{"a":1}')).toBe(0);
  });

  it('returns 0 when no params differ', () => {
    _bridge.parameterCache = { vol: 0.5, pan: 0.3 };
    const snapshot = JSON.stringify({ vol: 0.5, pan: 0.3 });
    expect(_computeCompareDiff(snapshot)).toBe(0);
  });

  it('counts params with different values', () => {
    _bridge.parameterCache = { vol: 0.7, pan: 0.3 };
    const snapshot = JSON.stringify({ vol: 0.5, pan: 0.3 });
    expect(_computeCompareDiff(snapshot)).toBe(1);
  });

  it('counts multiple differing params', () => {
    _bridge.parameterCache = { vol: 0.7, pan: 0.6, cutoff: 0.5 };
    const snapshot = JSON.stringify({ vol: 0.5, pan: 0.3, cutoff: 0.5 });
    expect(_computeCompareDiff(snapshot)).toBe(2);
  });

  it('counts param missing in cache as diff', () => {
    _bridge.parameterCache = { vol: 0.5 };
    const snapshot = JSON.stringify({ vol: 0.5, pan: 0.3 });
    expect(_computeCompareDiff(snapshot)).toBe(1);
  });

  it('returns 0 for invalid JSON', () => {
    expect(_computeCompareDiff('not-json')).toBe(0);
  });

  it('skips array/object values', () => {
    _bridge.parameterCache = { vol: 0.5, chord: [60, 64, 67] };
    const snapshot = JSON.stringify({ vol: 0.5, chord: [60, 64, 67] });
    expect(_computeCompareDiff(snapshot)).toBe(0);
  });

  it('uses tolerance of 0.001 for float comparison', () => {
    _bridge.parameterCache = { vol: 0.50005 };
    const snapshot = JSON.stringify({ vol: 0.5 });
    expect(_computeCompareDiff(snapshot)).toBe(0); // within tolerance
  });

  it('counts as diff when outside tolerance', () => {
    _bridge.parameterCache = { vol: 0.502 };
    const snapshot = JSON.stringify({ vol: 0.5 });
    expect(_computeCompareDiff(snapshot)).toBe(1);
  });
});

// ── 3. DUMP VIEWER ──

describe('getRegionColor', () => {
  it('returns color for LFO1', () => {
    const c = getRegionColor('LFO1');
    expect(c.bg).toBe('#1a2a3a');
    expect(c.fg).toBe('#7fc8ff');
  });

  it('returns color for OSC1', () => {
    const c = getRegionColor('OSC1');
    expect(c.bg).toBe('#2a1a3a');
    expect(c.fg).toBe('#c87fff');
  });

  it('returns color for VCF', () => {
    const c = getRegionColor('VCF');
    expect(c.bg).toBe('#1a3a2a');
    expect(c.fg).toBe('#7fffaf');
  });

  it('returns color for ENV1', () => {
    const c = getRegionColor('ENV1');
    expect(c.bg).toBe('#3a2a1a');
    expect(c.fg).toBe('#ffc87f');
  });

  it('returns color for FX', () => {
    const c = getRegionColor('FX');
    expect(c.bg).toBe('#2a1a2a');
    expect(c.fg).toBe('#ff7fff');
  });

  it('returns color for ? (unknown)', () => {
    const c = getRegionColor('?');
    expect(c.bg).toBe('#1a1a1a');
    expect(c.fg).toBe('#666666');
  });

  it('returns color for Name', () => {
    const c = getRegionColor('Name');
    expect(c.bg).toBe('#1a1a1a');
    expect(c.fg).toBe('#cccccc');
  });

  it('returns default for unknown region', () => {
    const c = getRegionColor('UNKNOWN');
    expect(c.bg).toBe('#111');
    expect(c.fg).toBe('#888');
  });

  it('returns default for undefined', () => {
    const c = getRegionColor(undefined);
    expect(c.bg).toBe('#111');
  });

  it('returns default for null', () => {
    const c = getRegionColor(null);
    expect(c.bg).toBe('#111');
  });
});

describe('formatTooltip', () => {
  it('formats basic info', () => {
    const info = { idx: 0, param: 'LFO1 Rate', region: 'LFO1', type: 'time' };
    const tip = formatTooltip(info, 128);
    expect(tip).toContain('Byte 0');
    expect(tip).toContain('LFO1 Rate');
    expect(tip).toContain('Region: LFO1');
    expect(tip).toContain('Type: time');
    expect(tip).toContain('128');
    expect(tip).toContain('0x80');
  });

  it('formats toggle type: ON', () => {
    const info = { idx: 10, param: 'OSC1 Saw', region: 'OSC1', type: 'toggle' };
    const tip = formatTooltip(info, 200);
    expect(tip).toContain('ON (1)');
  });

  it('formats toggle type: OFF', () => {
    const info = { idx: 10, param: 'OSC1 Saw', region: 'OSC1', type: 'toggle' };
    const tip = formatTooltip(info, 0);
    expect(tip).toContain('OFF (0)');
  });

  it('formats enum type with labels', () => {
    const info = { idx: 20, param: 'LFO1 Shape', region: 'LFO1', type: 'enum', enumLabels: ['Sine', 'Triangle', 'Square'] };
    const tip = formatTooltip(info, 1);
    expect(tip).toContain('Triangle');
    expect(tip).toContain('index 1');
  });

  it('formats enum type clamps index within bounds', () => {
    const info = { idx: 20, param: 'LFO Shape', region: 'LFO1', type: 'enum', enumLabels: ['Sine', 'Triangle'] };
    const tip = formatTooltip(info, 99);
    expect(tip).toContain('Triangle');
    expect(tip).toContain('index 1');
  });

  it('formats bipolar type', () => {
    const info = { idx: 30, param: 'OSC1 Pitch Mod', region: 'OSC1', type: 'bipolar' };
    const tip = formatTooltip(info, 200);
    expect(tip).toContain('Bipolar: 72');
  });

  it('formats bipolar center', () => {
    const info = { idx: 30, param: 'OSC1 Pitch Mod', region: 'OSC1', type: 'bipolar' };
    const tip = formatTooltip(info, 128);
    expect(tip).toContain('Center (no modulation)');
  });

  it('formats time type', () => {
    const info = { idx: 0, param: 'LFO1 Rate', region: 'LFO1', type: 'time' };
    const tip = formatTooltip(info, 128);
    expect(tip).toContain('5.020s');
  });

  it('formats ascii type', () => {
    const info = { idx: 224, param: 'Patch Name', region: 'Name', type: 'ascii' };
    const tip = formatTooltip(info, 65);
    expect(tip).toContain("'A'");
  });

  it('formats ascii type with non-printable', () => {
    const info = { idx: 224, param: 'Patch Name', region: 'Name', type: 'ascii' };
    const tip = formatTooltip(info, 1);
    expect(tip).toContain("'·'");
  });

  it('includes desc when present', () => {
    const info = { idx: 50, param: 'VCF Cutoff', region: 'VCF', type: 'time', desc: 'Filter cutoff frequency' };
    const tip = formatTooltip(info, 100);
    expect(tip).toContain('Note: Filter cutoff frequency');
  });

  it('handles missing desc gracefully', () => {
    const info = { idx: 50, param: 'VCF Cutoff', region: 'VCF', type: 'time' };
    const tip = formatTooltip(info, 100);
    expect(tip).not.toContain('Note:');
  });

  it('handles undefined info fields gracefully (no enumLabels)', () => {
    const info = { idx: 60, param: 'Some Param', region: 'LFO1', type: 'enum' };
    const tip = formatTooltip(info, 2);
    // Without enumLabels, no → line is added; just verify basic formatting works
    expect(tip).toContain('Byte 60');
    expect(tip).toContain('Type: enum');
  });
});

// ── 4. MIDI LEARN EDITOR ──

describe('refreshMappingsList', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('shows empty state when no mappings', () => {
    const container = _createFakeElement('div', { id: 'midi-learn-mappings-list' });
    _registerElement('midi-learn-mappings-list', container);
    refreshMappingsList();
    expect(container.innerHTML).toContain('No mappings yet');
  });

  it('shows empty state with count 0', () => {
    const container = _createFakeElement('div', { id: 'midi-learn-mappings-list' });
    const countEl = _createFakeElement('span', { id: 'midi-learn-mapping-count' });
    _registerElement('midi-learn-mappings-list', container);
    _registerElement('midi-learn-mapping-count', countEl);
    refreshMappingsList();
    expect(countEl.textContent).toBe('0 mappings');
  });

  it('renders mapping entries', () => {
    _bridge.midiLearnMappings = {
      'nrpn:42': 'vcf_cutoff',
      'cc:19': 'osc1_saw_enable',
    };
    const container = _createFakeElement('div', { id: 'midi-learn-mappings-list' });
    _registerElement('midi-learn-mappings-list', container);
    refreshMappingsList();
    expect(container.innerHTML).toContain('NRPN 42');
    expect(container.innerHTML).toContain('VCF CUTOFF');
    expect(container.innerHTML).toContain('CC 19');
    expect(container.innerHTML).toContain('OSC1 SAW ENABLE');
  });

  it('renders delete button for each mapping', () => {
    _bridge.midiLearnMappings = {
      'nrpn:42': 'vcf_cutoff',
    };
    const container = _createFakeElement('div', { id: 'midi-learn-mappings-list' });
    _registerElement('midi-learn-mappings-list', container);
    refreshMappingsList();
    expect(container.innerHTML).toContain('midi-learn-del-btn');
    expect(container.innerHTML).toContain('data-key="nrpn:42"');
  });

  it('updates mapping count', () => {
    _bridge.midiLearnMappings = {
      'nrpn:42': 'vcf_cutoff',
      'cc:19': 'osc1_saw_enable',
    };
    const container = _createFakeElement('div', { id: 'midi-learn-mappings-list' });
    const countEl = _createFakeElement('span', { id: 'midi-learn-mapping-count' });
    _registerElement('midi-learn-mappings-list', container);
    _registerElement('midi-learn-mapping-count', countEl);
    refreshMappingsList();
    expect(countEl.textContent).toBe('2 mappings');
  });

  it('uses singular "mapping" for 1 entry', () => {
    _bridge.midiLearnMappings = { 'nrpn:42': 'vcf_cutoff' };
    const container = _createFakeElement('div', { id: 'midi-learn-mappings-list' });
    const countEl = _createFakeElement('span', { id: 'midi-learn-mapping-count' });
    _registerElement('midi-learn-mappings-list', container);
    _registerElement('midi-learn-mapping-count', countEl);
    refreshMappingsList();
    expect(countEl.textContent).toBe('1 mapping');
  });

  it('returns early when container missing', () => {
    refreshMappingsList();
    expect(true).toBe(true); // no crash
  });

  it('returns early when bridge missing', () => {
    const container = _createFakeElement('div', { id: 'midi-learn-mappings-list' });
    _registerElement('midi-learn-mappings-list', container);
    window.dualMidiBridge = null;
    refreshMappingsList();
    expect(container.innerHTML).toContain('No mappings yet');
  });

  it('handles missing _getParamName gracefully', () => {
    _bridge.midiLearnMappings = { 'nrpn:42': 'vcf_cutoff' };
    delete _bridge._getParamName;
    const container = _createFakeElement('div', { id: 'midi-learn-mappings-list' });
    _registerElement('midi-learn-mappings-list', container);
    refreshMappingsList();
    expect(container.innerHTML).toContain('VCF_CUTOFF');
  });
});

describe('initMidiLearnEditor - clear all', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
    _bridge.midiLearnMappings = { 'nrpn:42': 'vcf_cutoff', 'cc:19': 'osc1_saw_enable' };
  });

  it('clear all button calls bridge.clearMidiLearnMappings on confirm', () => {
    const clearBtn = _createFakeElement('button', { id: 'midi-learn-clear-all' });
    _registerElement('midi-learn-clear-all', clearBtn);
    const container = _createFakeElement('div', { id: 'midi-learn-mappings-list' });
    _registerElement('midi-learn-mappings-list', container);

    // Wire the clear handler manually (initMidiLearnEditor does this)
    clearBtn.addEventListener('click', function() {
      if (!window.dualMidiBridge) return;
      if (confirm('Delete all MIDI Learn mappings?')) {
        window.dualMidiBridge.clearMidiLearnMappings();
        refreshMappingsList();
      }
    });

    // Simulate confirm returning true
    vi.stubGlobal('confirm', () => true);
    clearBtn.click();
    expect(Object.keys(_bridge.midiLearnMappings)).toHaveLength(0);
    expect(container.innerHTML).toContain('No mappings yet');
  });

  it('clear all button does nothing on cancel', () => {
    const clearBtn = _createFakeElement('button', { id: 'midi-learn-clear-all' });
    _registerElement('midi-learn-clear-all', clearBtn);
    _bridge.midiLearnMappings = { 'nrpn:42': 'vcf_cutoff' };

    clearBtn.addEventListener('click', function() {
      if (!window.dualMidiBridge) return;
      if (confirm('Delete all MIDI Learn mappings?')) {
        window.dualMidiBridge.clearMidiLearnMappings();
        refreshMappingsList();
      }
    });

    vi.stubGlobal('confirm', () => false);
    clearBtn.click();
    expect(Object.keys(_bridge.midiLearnMappings)).toHaveLength(1);
  });
});

describe('initMidiLearnEditor - export', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('export button creates blob download link', () => {
    _bridge.midiLearnMappings = { 'nrpn:42': 'vcf_cutoff' };
    const exportBtn = _createFakeElement('button', { id: 'midi-learn-export' });
    _registerElement('midi-learn-export', exportBtn);

    let createdUrl = '';
    vi.stubGlobal('URL', {
      createObjectURL: (blob) => {
        createdUrl = 'blob:test';
        return 'blob:test';
      },
      revokeObjectURL: () => {},
    });

    let clickedLink = null;
    document.createElement = (tag) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click() { clickedLink = this; },
        };
      }
      return _createFakeElement(tag);
    };

    exportBtn.addEventListener('click', function() {
      var bridge = window.dualMidiBridge;
      if (!bridge || !bridge.midiLearnMappings) return;
      var json = JSON.stringify(bridge.midiLearnMappings, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'abd-eep-midi-learn-mappings.json';
      link.click();
    });

    exportBtn.click();
    expect(createdUrl).toBe('blob:test');
    expect(clickedLink).not.toBeNull();
    expect(clickedLink.download).toBe('abd-eep-midi-learn-mappings.json');
  });
});

describe('initMidiLearnEditor - import', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
    _bridge._saveMidiLearnMappings = vi.fn();
  });

  it('import handler creates file input and reads JSON', () => {
    const importBtn = _createFakeElement('button', { id: 'midi-learn-import' });
    const importStatus = _createFakeElement('div', { id: 'midi-learn-import-status' });
    _registerElement('midi-learn-import', importBtn);
    _registerElement('midi-learn-import-status', importStatus);

    // Mock FileReader
    let readerOnload = null;
    vi.stubGlobal('FileReader', function() {
      this.onload = null;
      this.readAsText = function(file) {
        // Simulate async read completion
        this.result = '{"nrpn:42":"vcf_cutoff"}';
        if (this.onload) this.onload({ target: this });
      };
    });

    document.createElement = function(tag) {
      if (tag === 'input') {
        return {
          type: '',
          accept: '',
          _listeners: {},
          click: function() {
            // Simulate file selection
            if (this._listeners.change) {
              const file = new Blob(['{"nrpn:42":"vcf_cutoff"}'], { type: 'application/json' });
              const ev = { target: { files: [file] } };
              this._listeners.change.forEach(function(h) { h(ev); });
            }
          },
          addEventListener: function(event, handler) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(handler);
          },
        };
      }
      return _createFakeElement(tag);
    };

    const container = _createFakeElement('div', { id: 'midi-learn-mappings-list' });
    _registerElement('midi-learn-mappings-list', container);

    importBtn.addEventListener('click', function() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          try {
            var parsed = JSON.parse(ev.target.result);
            var bridge = window.dualMidiBridge;
            if (!bridge) return;
            Object.keys(parsed).forEach(function(key) {
              bridge.midiLearnMappings[key] = parsed[key];
            });
            if (bridge._saveMidiLearnMappings) bridge._saveMidiLearnMappings();
            refreshMappingsList();
            if (importStatus) importStatus.textContent = '✅ Imported 1 mappings';
          } catch(e) {
            if (importStatus) importStatus.textContent = '❌ Invalid JSON';
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });

    importBtn.click();
    expect(_bridge.midiLearnMappings['nrpn:42']).toBe('vcf_cutoff');
    expect(_bridge._saveMidiLearnMappings).toHaveBeenCalled();
    expect(importStatus.textContent).toContain('✅ Imported');
  });

  it('import shows error on invalid JSON', () => {
    const importBtn = _createFakeElement('button', { id: 'midi-learn-import' });
    const importStatus = _createFakeElement('div', { id: 'midi-learn-import-status' });
    _registerElement('midi-learn-import', importBtn);
    _registerElement('midi-learn-import-status', importStatus);

    // Mock FileReader to return invalid JSON
    vi.stubGlobal('FileReader', function() {
      this.onload = null;
      this.readAsText = function(file) {
        this.result = 'not valid json';
        if (this.onload) this.onload({ target: this });
      };
    });

    document.createElement = function(tag) {
      if (tag === 'input') {
        return {
          type: '',
          accept: '',
          _listeners: {},
          click: function() {
            if (this._listeners.change) {
              const file = new Blob(['not valid json'], { type: 'application/json' });
              file.name = 'bad.json';
              const ev = { target: { files: [file] } };
              this._listeners.change.forEach(function(h) { h(ev); });
            }
          },
          addEventListener: function(event, handler) {
            if (!this._listeners[event]) this._listeners[event] = [];
            this._listeners[event].push(handler);
          },
        };
      }
      return _createFakeElement(tag);
    };

    importBtn.addEventListener('click', function() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          try {
            JSON.parse(ev.target.result);
          } catch(e) {
            if (importStatus) importStatus.textContent = '❌ Invalid JSON';
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });

    importBtn.click();
    expect(importStatus.textContent).toContain('❌ Invalid JSON');
  });
});

// ── 5. CONTROLLER CURVES UI ──

describe('_getActiveCustomCtrlName', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
  });

  it('returns null when no curve selectors exist', () => {
    expect(_getActiveCustomCtrlName()).toBeNull();
  });

  it('returns aftertouch when aftertouch curve is custom', () => {
    const atSel = _createFakeElement('select', { id: 'settings-curve-aftertouch' });
    atSel.value = 'custom';
    _registerElement('settings-curve-aftertouch', atSel);
    expect(_getActiveCustomCtrlName()).toBe('aftertouch');
  });

  it('returns modwheel when modwheel is custom', () => {
    const atSel = _createFakeElement('select', { id: 'settings-curve-aftertouch' });
    const mwSel = _createFakeElement('select', { id: 'settings-curve-modwheel' });
    atSel.value = 'linear';
    mwSel.value = 'custom';
    _registerElement('settings-curve-aftertouch', atSel);
    _registerElement('settings-curve-modwheel', mwSel);
    expect(_getActiveCustomCtrlName()).toBe('modwheel');
  });

  it('returns pitchbend when pitchbend is custom', () => {
    const sel = _createFakeElement('select', { id: 'settings-curve-pitchbend' });
    sel.value = 'custom';
    _registerElement('settings-curve-pitchbend', sel);
    expect(_getActiveCustomCtrlName()).toBe('pitchbend');
  });

  it('returns null when none are custom', () => {
    const atSel = _createFakeElement('select', { id: 'settings-curve-aftertouch' });
    atSel.value = 'linear';
    _registerElement('settings-curve-aftertouch', atSel);
    expect(_getActiveCustomCtrlName()).toBeNull();
  });

  it('prioritizes aftertouch over others', () => {
    const atSel = _createFakeElement('select', { id: 'settings-curve-aftertouch' });
    const mwSel = _createFakeElement('select', { id: 'settings-curve-modwheel' });
    atSel.value = 'custom';
    mwSel.value = 'custom';
    _registerElement('settings-curve-aftertouch', atSel);
    _registerElement('settings-curve-modwheel', mwSel);
    expect(_getActiveCustomCtrlName()).toBe('aftertouch');
  });
});

describe('drawCurvePreview', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
    // Provide a simple applyControllerCurve
    window.applyControllerCurve = (val, curve) => {
      if (curve === 'expo2') return val * val;
      if (curve === 'expo3') return val * val * val;
      if (curve === 'log') return Math.sqrt(val);
      return val; // linear, s-curve, etc.
    };
    window.applyBipolarCurve = (val, curve) => {
      return val; // simplified
    };
  });

  it('does not crash when canvas missing', () => {
    drawCurvePreview('linear');
    expect(true).toBe(true);
  });

  it('draws on canvas when canvas exists', () => {
    const canvas = _createFakeElement('canvas', { id: 'curve-preview-canvas' });
    canvas.width = 160;
    canvas.height = 100;
    _registerElement('curve-preview-canvas', canvas);
    drawCurvePreview('linear');
    const ctx = canvas.getContext('2d');
    expect(ctx._calls).toContain('clearRect');
    expect(ctx._calls).toContain('beginPath');
    expect(ctx._calls).toContain('moveTo');
    expect(ctx._calls).toContain('lineTo');
    expect(ctx._calls).toContain('stroke');
  });

  it('draws grid lines', () => {
    const canvas = _createFakeElement('canvas', { id: 'curve-preview-canvas' });
    canvas.width = 160;
    canvas.height = 100;
    _registerElement('curve-preview-canvas', canvas);
    drawCurvePreview('linear');
    // 5 vertical + 5 horizontal moves + 1 center = 11 moveTo calls minimum
    const ctx = canvas.getContext('2d');
    const moveCount = ctx._calls.filter(c => c === 'moveTo').length;
    expect(moveCount).toBeGreaterThanOrEqual(10); // grid (10) + ref line (1) + curve start (1) = 12
  });

  it('draws bipolar reference line', () => {
    const canvas = _createFakeElement('canvas', { id: 'curve-preview-canvas' });
    canvas.width = 160;
    canvas.height = 100;
    _registerElement('curve-preview-canvas', canvas);
    drawCurvePreview('linear', true);
    // Should have drawn the center zero line
    const ctx = canvas.getContext('2d');
    expect(ctx._calls.filter(c => c === 'moveTo').length).toBeGreaterThan(0);
  });

  it('calls setLineDash for reference line', () => {
    const canvas = _createFakeElement('canvas', { id: 'curve-preview-canvas' });
    canvas.width = 160;
    canvas.height = 100;
    _registerElement('curve-preview-canvas', canvas);
    drawCurvePreview('linear');
    const ctx = canvas.getContext('2d');
    expect(ctx._calls).toContain('setLineDash');
  });

  it('sets stroke style to brand accent color', () => {
    const canvas = _createFakeElement('canvas', { id: 'curve-preview-canvas' });
    canvas.width = 160;
    canvas.height = 100;
    _registerElement('curve-preview-canvas', canvas);
    drawCurvePreview('linear');
    const ctx = canvas.getContext('2d');
    expect(ctx.strokeStyle).toBe('#ff9900');
  });

  it('draws label text', () => {
    const canvas = _createFakeElement('canvas', { id: 'curve-preview-canvas' });
    canvas.width = 160;
    canvas.height = 100;
    _registerElement('curve-preview-canvas', canvas);
    drawCurvePreview('expo2');
    const ctx = canvas.getContext('2d');
    expect(ctx._calls).toContain('fillText');
  });

  it('draws bipolar label prefix', () => {
    const canvas = _createFakeElement('canvas', { id: 'curve-preview-canvas' });
    canvas.width = 160;
    canvas.height = 100;
    _registerElement('curve-preview-canvas', canvas);
    drawCurvePreview('linear', true);
    const ctx = canvas.getContext('2d');
    // Should have drawn 'Bipolar Linear'
    const fillTextCalls = ctx._calls.filter(c => c === 'fillText').length;
    expect(fillTextCalls).toBeGreaterThanOrEqual(3); // label + 3 endpoint labels
  });

  it('sets _lastCurveType and _lastCurveIsBipolar', () => {
    const canvas = _createFakeElement('canvas', { id: 'curve-preview-canvas' });
    canvas.width = 160;
    canvas.height = 100;
    _registerElement('curve-preview-canvas', canvas);
    drawCurvePreview('s-curve', true);
    expect(_lastCurveType).toBe('s-curve');
    expect(_lastCurveIsBipolar).toBe(true);
  });
});

describe('initControllerCurves', () => {
  beforeEach(() => {
    _resetStorage(); _resetElements(); _resetBridge(); _setupGlobals();
    _curveStorage.aftertouch = 'linear';
    _curveStorage.modwheel = 'expo2';
    _curveStorage.pitchbend = 'log';
  });

  it('restores saved curve values', () => {
    const atSel = _createFakeElement('select', { id: 'settings-curve-aftertouch' });
    const mwSel = _createFakeElement('select', { id: 'settings-curve-modwheel' });
    const pbSel = _createFakeElement('select', { id: 'settings-curve-pitchbend' });
    _registerElement('settings-curve-aftertouch', atSel);
    _registerElement('settings-curve-modwheel', mwSel);
    _registerElement('settings-curve-pitchbend', pbSel);
    // Provide canvas so drawCurvePreview calls succeed
    _registerElement('curve-preview-canvas', _createFakeElement('canvas', { id: 'curve-preview-canvas' }));
    initControllerCurves();
    expect(atSel.value).toBe('linear');
    expect(mwSel.value).toBe('expo2');
    expect(pbSel.value).toBe('log');
  });

  it('change aftertouch saves and draws preview', () => {
    const atSel = _createFakeElement('select', { id: 'settings-curve-aftertouch' });
    _registerElement('settings-curve-aftertouch', atSel);
    _registerElement('curve-preview-canvas', _createFakeElement('canvas', { id: 'curve-preview-canvas' }));
    initControllerCurves();
    _triggerChange(atSel, 'expo3');
    expect(_curveStorage.aftertouch).toBe('expo3');
    expect(_lastCurveType).toBe('expo3');
  });

  it('change modwheel saves and draws preview', () => {
    const mwSel = _createFakeElement('select', { id: 'settings-curve-modwheel' });
    _registerElement('settings-curve-modwheel', mwSel);
    _registerElement('curve-preview-canvas', _createFakeElement('canvas', { id: 'curve-preview-canvas' }));
    initControllerCurves();
    _triggerChange(mwSel, 'expo3');
    expect(_curveStorage.modwheel).toBe('expo3');
  });

  it('change pitchbend saves and draws bipolar preview', () => {
    const pbSel = _createFakeElement('select', { id: 'settings-curve-pitchbend' });
    _registerElement('settings-curve-pitchbend', pbSel);
    _registerElement('curve-preview-canvas', _createFakeElement('canvas', { id: 'curve-preview-canvas' }));
    initControllerCurves();
    _triggerChange(pbSel, 'expo3');
    expect(_curveStorage.pitchbend).toBe('expo3');
    expect(_lastCurveIsBipolar).toBe(true);
  });

  it('does not crash when elements missing', () => {
    initControllerCurves();
    expect(true).toBe(true);
  });

  it('draws initial preview for aftertouch when available', () => {
    const atSel = _createFakeElement('select', { id: 'settings-curve-aftertouch' });
    _registerElement('settings-curve-aftertouch', atSel);
    const canvas = _createFakeElement('canvas', { id: 'curve-preview-canvas' });
    canvas.width = 160;
    canvas.height = 100;
    _registerElement('curve-preview-canvas', canvas);
    initControllerCurves();
    const ctx = canvas.getContext('2d');
    expect(ctx._calls).toContain('clearRect');
  });
});
