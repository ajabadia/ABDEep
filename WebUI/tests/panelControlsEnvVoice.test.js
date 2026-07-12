/**
 * Vitest tests for panel_controls_env_voice.js — ENV/Poly/Porta panel binding functions.
 *
 * Source:  WebUI/js/panel_controls_env_voice.js
 * Run:     npx vitest run WebUI/tests/panelControlsEnvVoice.test.js
 *
 * Covers:
 *   - bindPanelEnvControls  (ENV panel: shape-led-row trigger clicks, LCD hovers, title)
 *   - bindPanelPolyControls (POLY panel: select dropdown, priority/trigger LED rows, LCD hovers)
 *   - bindPanelPortaControls (PORTA panel: porta-mode, note-priority, trigger-mode LED rows)
 *
 * Pattern: inline functions + fake DOM elements + vi.stubGlobal for bridge/templates/document
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state
// ══════════════════════════════════════════════════════════════════

let _bridge = null;

function _makeBridge(cache) {
  return {
    parameterCache: cache || {},
    setParameter: vi.fn(),
  };
}

function _makeTemplate() {
  return function(prefix) {
    return '<div class="shape-led-row" data-trig="0" data-param="' + prefix + 'trigger_mode"><span class="shape-name">Key</span></div>'
      + '<div class="shape-led-row" data-trig="1" data-param="' + prefix + 'trigger_mode"><span class="shape-name">LFO 1</span></div>'
      + '<div class="shape-led-row" data-trig="2" data-param="' + prefix + 'trigger_mode"><span class="shape-name">LFO 2</span></div>'
      + '<div class="shape-led-row" data-trig="3" data-param="' + prefix + 'trigger_mode"><span class="shape-name">Loop</span></div>'
      + '<div class="shape-led-row" data-trig="4" data-param="' + prefix + 'trigger_mode"><span class="shape-name">Seq</span></div>'
      + '<div class="ctrl-unit" data-param="' + prefix + 'attack"><div class="label">Attack</div></div>'
      + '<div class="ctrl-unit" data-param="' + prefix + 'decay"><div class="label">Decay</div></div>'
      + '<div class="ctrl-unit" data-param="' + prefix + 'sustain"><div class="label">Sustain</div></div>'
      + '<div class="ctrl-unit" data-param="' + prefix + 'release"><div class="label">Release</div></div>'
      + '<div class="shape-led-row" data-param="' + prefix + 'attack_curve"><span class="shape-name">Attack Curve</span></div>'
      + '<div class="shape-led-row" data-param="' + prefix + 'decay_curve"><span class="shape-name">Decay Curve</span></div>'
      + '<div class="shape-led-row" data-param="' + prefix + 'release_curve"><span class="shape-name">Release Curve</span></div>';
  };
}

function _makeTemplatePoly() {
  var html = '<select id="panel-poly-mode-select" data-param="voice_mode">';
  for (var i = 0; i < 13; i++) html += '<option value="' + i + '">Mode ' + i + '</option>';
  html += '</select>';
  html += '<div class="priority-led-row" data-val="0" data-param="note_priority"><span class="shape-name">Lowest</span></div>'
    + '<div class="priority-led-row" data-val="1" data-param="note_priority"><span class="shape-name">Highest</span></div>'
    + '<div class="priority-led-row" data-val="2" data-param="note_priority"><span class="shape-name">Last</span></div>'
    + '<div class="trigger-led-row" data-val="0" data-param="trigger_mode"><span class="shape-name">Normal</span></div>'
    + '<div class="trigger-led-row" data-val="1" data-param="trigger_mode"><span class="shape-name">Single</span></div>'
    + '<div class="trigger-led-row" data-val="2" data-param="trigger_mode"><span class="shape-name">Multi</span></div>'
    + '<div class="trigger-led-row" data-val="3" data-param="trigger_mode"><span class="shape-name">One-Shot</span></div>'
    + '<div class="ctrl-unit" data-param="voice_mode"><div class="label">Voice Mode</div></div>'
    + '<div class="ctrl-unit" data-param="unison_detune"><div class="label">Unison Detune</div></div>'
    + '<div class="shape-led-row" data-param="note_priority"><span class="shape-name">Note Priority</span></div>'
    + '<div class="shape-led-row" data-param="trigger_mode"><span class="shape-name">Trigger Mode</span></div>'
    + '<select data-param="unison_detune"><option>0</option><option>1</option><option>2</option></select>';
  return html;
}

function _makeTemplatePorta() {
  return '<div class="porta-mode-led-row" data-val="0"><span class="shape-name">Normal</span></div>'
    + '<div class="porta-mode-led-row" data-val="1"><span class="shape-name">Fingered</span></div>'
    + '<div class="porta-mode-led-row" data-val="2"><span class="shape-name">Fix-Rate</span></div>'
    + '<div class="note-priority-led-row" data-val="0" data-param="note_priority"><span class="shape-name">Lowest</span></div>'
    + '<div class="note-priority-led-row" data-val="1" data-param="note_priority"><span class="shape-name">Highest</span></div>'
    + '<div class="note-priority-led-row" data-val="2" data-param="note_priority"><span class="shape-name">Last</span></div>'
    + '<div class="trigger-mode-led-row" data-val="0" data-param="trigger_mode"><span class="shape-name">Normal</span></div>'
    + '<div class="trigger-mode-led-row" data-val="1" data-param="trigger_mode"><span class="shape-name">Single</span></div>'
    + '<div class="trigger-mode-led-row" data-val="2" data-param="trigger_mode"><span class="shape-name">Multi</span></div>'
    + '<div class="trigger-mode-led-row" data-val="3" data-param="trigger_mode"><span class="shape-name">One-Shot</span></div>';
}

// ══════════════════════════════════════════════════════════════════
// Fake DOM element factory
// ══════════════════════════════════════════════════════════════════

function _createFakeEl(tag, attrs) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    id: (attrs && attrs.id) || '',
    _attrs: attrs || {},
    _listeners: {},
    value: '',
    textContent: '',
    innerHTML: '',
    innerText: '',
    checked: false,
    title: '',
    style: {
      _props: {},
      removeProperty(prop) { delete this._props[prop]; },
      get top() { return this._props.top; },
      set top(val) { this._props.top = val; },
      get height() { return this._props.height; },
      set height(val) { this._props.height = val; },
      get display() { return this._props.display; },
      set display(val) { this._props.display = val; },
      setProperty(prop, val) { this._props[prop] = val; },
    },
    dataset: {},
    classList: {
      _classes: [],
      add(c) { if (!this._classes.includes(c)) this._classes.push(c); },
      remove(c) { this._classes = this._classes.filter(x => x !== c); },
      contains(c) { return this._classes.includes(c); },
      toggle(c, force) {
        if (force === true) { this.add(c); return true; }
        if (force === false) { this.remove(c); return false; }
        return this.contains(c) ? (this.remove(c), false) : (this.add(c), true);
      },
    },
    clientHeight: 100,
    getAttribute(name) { return this._attrs[name] || null; },
    setAttribute(name, val) { this._attrs[name] = val; },
    hasAttribute(name) { return name in this._attrs; },
    addEventListener(event, handler) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(handler);
    },
    removeEventListener() {},
    dispatchEvent() {},
    appendChild(child) { this._children = this._children || []; this._children.push(child); },
    _children: [],
    _subElements: {},
    _selectorAll: {},
    querySelector(sel) { return this._subElements[sel] || null; },
    querySelectorAll(sel) { return this._selectorAll[sel] || []; },
    closest(sel) {
      if (sel && sel.startsWith('[') && sel.endsWith(']')) {
        const attr = sel.slice(1, -1);
        if (this._attrs[attr] !== undefined) return this;
        return this._parent && this._parent._attrs && this._parent._attrs[attr] !== undefined ? this._parent : null;
      }
      return null;
    },
    getBoundingClientRect() {
      return { top: 0, left: 0, width: 40, height: this.clientHeight || 100, bottom: this.clientHeight || 100, right: 40 };
    },
    _parent: null,
    options: [],
  };
  return el;
}

// ══════════════════════════════════════════════════════════════════
// Functions under test (extracted from panel_controls_env_voice.js)
// ══════════════════════════════════════════════════════════════════

function bindPanelEnvControls(container, state, titleEl) {
    const prefix = 'env' + state.panelActiveEnv + '_';
    const envName = state.panelActiveEnv === 1 ? 'VCA' : (state.panelActiveEnv === 2 ? 'VCF' : 'MOD');
    titleEl.innerText = envName + ' Env Editor';

    container.innerHTML = window.PANEL_TEMPLATES.ENV(prefix);

    container.querySelectorAll('.shape-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const trigVal = parseInt(row.getAttribute('data-trig'));
            const paramId = row.getAttribute('data-param');
            container.querySelectorAll('.shape-led-row').forEach(function(r) { r.classList.remove('active'); });
            row.classList.add('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter(paramId, trigVal / 4.0);
        });
    });

    // LCD hovers: ctrl-units
    container.querySelectorAll('.ctrl-unit[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var lcd = document.getElementById('lcd-text');
            if (!lcd) return;
            var pid = this.getAttribute('data-param');
            var bridge = window.dualMidiBridge;
            var v = bridge ? bridge.parameterCache[pid] : 0;
            var lbl = this.querySelector('.label');
            var name = lbl ? lbl.textContent.trim() : pid;
            var pct = typeof v === 'number' ? Math.round(v * 100) : 0;
            var envName2 = state.panelActiveEnv === 1 ? 'VCA' : (state.panelActiveEnv === 2 ? 'VCF' : 'MOD');
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">' + envName2 + ' ENV PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + pct + '%</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcd);
        });
    });

    // LCD hovers: shape-led-rows
    container.querySelectorAll('.shape-led-row[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var lcd = document.getElementById('lcd-text');
            if (!lcd) return;
            var pid = this.getAttribute('data-param');
            var bridge = window.dualMidiBridge;
            var v = bridge ? bridge.parameterCache[pid] : 0;
            var nameEl = this.querySelector('.shape-name');
            var name2 = nameEl ? nameEl.textContent.trim() : pid;
            var envName2 = state.panelActiveEnv === 1 ? 'VCA' : (state.panelActiveEnv === 2 ? 'VCF' : 'MOD');
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">' + envName2 + ' ENV PANEL</span><br>'
                + '<strong>' + name2.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcd);
        });
    });
}

function bindPanelPolyControls(container, state, titleEl) {
    titleEl.innerText = 'Polyphony & Unison';
    container.innerHTML = window.PANEL_TEMPLATES.POLY();

    var selectPolyMode = document.getElementById('panel-poly-mode-select');
    if (selectPolyMode) {
        selectPolyMode.addEventListener('change', function() {
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter('voice_mode', parseInt(selectPolyMode.value) / 12.0);
        });
    }

    container.querySelectorAll('.priority-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            const paramId = row.getAttribute('data-param');
            container.querySelectorAll('.priority-led-row').forEach(function(r) { r.classList.remove('active'); });
            row.classList.add('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter(paramId, val / 2.0);
        });
    });

    container.querySelectorAll('.trigger-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            const paramId = row.getAttribute('data-param');
            container.querySelectorAll('.trigger-led-row').forEach(function(r) { r.classList.remove('active'); });
            row.classList.add('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter(paramId, val / 3.0);
        });
    });

    // LCD hovers: ctrl-units
    container.querySelectorAll('.ctrl-unit[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var lcd = document.getElementById('lcd-text');
            if (!lcd) return;
            var pid = this.getAttribute('data-param');
            var bridge = window.dualMidiBridge;
            var v = bridge ? bridge.parameterCache[pid] : 0;
            var lbl = this.querySelector('.label');
            var name = lbl ? lbl.textContent.trim() : pid;
            var pct = typeof v === 'number' ? Math.round(v * 100) : 0;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">POLY PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + pct + '%</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcd);
        });
    });

    // LCD hovers: shape-led-rows
    container.querySelectorAll('.shape-led-row[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var lcd = document.getElementById('lcd-text');
            if (!lcd) return;
            var pid = this.getAttribute('data-param');
            var bridge = window.dualMidiBridge;
            var v = bridge ? bridge.parameterCache[pid] : 0;
            var nameEl = this.querySelector('.shape-name');
            var name = nameEl ? nameEl.textContent.trim() : pid;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">POLY PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcd);
        });
    });

    // LCD hovers: select elements
    container.querySelectorAll('select[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            var lcd = document.getElementById('lcd-text');
            if (!lcd) return;
            var pid = this.getAttribute('data-param');
            var bridge = window.dualMidiBridge;
            var v = bridge ? bridge.parameterCache[pid] : 0;
            var opts = this.options;
            var idx = Math.round(v * (opts.length - 1));
            var selectedText = opts[idx] ? opts[idx].textContent.trim() : pid;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">POLY PANEL</span><br>'
                + '<strong>' + pid.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + selectedText + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') window.setLcdParamDisplayTimer(lcd);
        });
    });
}

function bindPanelPortaControls(container, state, titleEl) {
    titleEl.innerText = 'Glide & Voice Settings';
    container.innerHTML = window.PANEL_TEMPLATES.PORTA();

    container.querySelectorAll('.porta-mode-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.porta-mode-led-row').forEach(function(r) { r.classList.remove('active'); });
            row.classList.add('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter('porta_mode', val / 9.0);
        });
    });

    container.querySelectorAll('.note-priority-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.note-priority-led-row').forEach(function(r) { r.classList.remove('active'); });
            row.classList.add('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter('note_priority', val / 2.0);
        });
    });

    container.querySelectorAll('.trigger-mode-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.trigger-mode-led-row').forEach(function(r) { r.classList.remove('active'); });
            row.classList.add('active');
            if (window.dualMidiBridge) window.dualMidiBridge.setParameter('trigger_mode', val / 3.0);
        });
    });
}

// Instead of building from HTML, we build elements manually using _createFakeEl.
// The best approach for this test file: create elements manually using _createFakeEl
// and arrange them into _selectorAll for each query call.

function _makeEnvContainer(prefix) {
  const cont = _createFakeEl('div');
  cont._selectorAll = {};

  // Shape LED rows (trigger rows)
  var shapeRows = [];
  var triggerDefs = [
    { trig: 0, name: 'Key' },
    { trig: 1, name: 'LFO 1' },
    { trig: 2, name: 'LFO 2' },
    { trig: 3, name: 'Loop' },
    { trig: 4, name: 'Seq' },
  ];
  triggerDefs.forEach(function(def) {
    var row = _createFakeEl('div', { 'data-trig': String(def.trig), 'data-param': prefix + 'trigger_mode' });
    row.classList.add('shape-led-row');
    var nameEl = _createFakeEl('span');
    nameEl.classList.add('shape-name');
    nameEl.textContent = def.name;
    row._subElements['.shape-name'] = nameEl;
    shapeRows.push(row);
  });

  // Add curve rows
  var curveRows = ['attack_curve', 'decay_curve', 'release_curve'];
  curveRows.forEach(function(pid) {
    var row = _createFakeEl('div', { 'data-param': prefix + pid });
    row.classList.add('shape-led-row');
    var nameEl = _createFakeEl('span');
    nameEl.classList.add('shape-name');
    nameEl.textContent = pid.replace('_', ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    row._subElements['.shape-name'] = nameEl;
    shapeRows.push(row);
  });

  cont._selectorAll['.shape-led-row'] = shapeRows;

  // Ctrl units
  var ctrlUnits = [];
  var paramDefs = ['attack', 'decay', 'sustain', 'release'];
  paramDefs.forEach(function(pid) {
    var unit = _createFakeEl('div', { 'data-param': prefix + pid });
    unit.classList.add('ctrl-unit');
    var label = _createFakeEl('div');
    label.classList.add('label');
    label.textContent = pid.charAt(0).toUpperCase() + pid.slice(1);
    unit._subElements['.label'] = label;
    ctrlUnits.push(unit);
  });
  cont._selectorAll['.ctrl-unit[data-param]'] = ctrlUnits;

  // Shape-led-rows with data-param (for LCD hover)
  var shapeWithParam = [];
  triggerDefs.forEach(function(def) {
    var row = _createFakeEl('div', { 'data-trig': String(def.trig), 'data-param': prefix + 'trigger_mode' });
    row.classList.add('shape-led-row');
    row._subElements['.shape-name'] = _createFakeEl('span');
    row._subElements['.shape-name'].textContent = def.name;
    shapeWithParam.push(row);
  });
  curveRows.forEach(function(pid) {
    var row = _createFakeEl('div', { 'data-param': prefix + pid });
    row.classList.add('shape-led-row');
    row._subElements['.shape-name'] = _createFakeEl('span');
    row._subElements['.shape-name'].textContent = pid;
    shapeWithParam.push(row);
  });
  cont._selectorAll['.shape-led-row[data-param]'] = shapeWithParam;

  return cont;
}

function _makePolyContainer() {
  const cont = _createFakeEl('div');
  cont._selectorAll = {};

  // Priority LED rows
  var priorityRows = [];
  [0, 1, 2].forEach(function(val) {
    var row = _createFakeEl('div', { 'data-val': String(val), 'data-param': 'note_priority' });
    row.classList.add('priority-led-row');
    var nameEl = _createFakeEl('span');
    nameEl.classList.add('shape-name');
    nameEl.textContent = ['Lowest', 'Highest', 'Last'][val];
    row._subElements['.shape-name'] = nameEl;
    priorityRows.push(row);
  });
  cont._selectorAll['.priority-led-row'] = priorityRows;

  // Trigger LED rows
  var triggerRows = [];
  [0, 1, 2, 3].forEach(function(val) {
    var row = _createFakeEl('div', { 'data-val': String(val), 'data-param': 'trigger_mode' });
    row.classList.add('trigger-led-row');
    var nameEl = _createFakeEl('span');
    nameEl.classList.add('shape-name');
    nameEl.textContent = ['Normal', 'Single', 'Multi', 'One-Shot'][val];
    row._subElements['.shape-name'] = nameEl;
    triggerRows.push(row);
  });
  cont._selectorAll['.trigger-led-row'] = triggerRows;

  // Ctrl units
  var ctrlUnits = [];
  ['voice_mode', 'unison_detune'].forEach(function(pid) {
    var unit = _createFakeEl('div', { 'data-param': pid });
    unit.classList.add('ctrl-unit');
    var label = _createFakeEl('div');
    label.classList.add('label');
    label.textContent = pid;
    unit._subElements['.label'] = label;
    ctrlUnits.push(unit);
  });
  cont._selectorAll['.ctrl-unit[data-param]'] = ctrlUnits;

  // Shape-led-rows with data-param
  var shapeWithParam = [];
  ['note_priority', 'trigger_mode'].forEach(function(pid) {
    var row = _createFakeEl('div', { 'data-param': pid });
    row.classList.add('shape-led-row');
    row._subElements['.shape-name'] = _createFakeEl('span');
    row._subElements['.shape-name'].textContent = pid;
    shapeWithParam.push(row);
  });
  cont._selectorAll['.shape-led-row[data-param]'] = shapeWithParam;

  // Select with data-param
  var sel = _createFakeEl('select', { 'data-param': 'unison_detune' });
  sel.options = [];
  for (var i = 0; i < 3; i++) {
    var opt = _createFakeEl('option');
    opt.value = String(i);
    opt.textContent = String(i);
    sel.options.push(opt);
  }
  cont._selectorAll['select[data-param]'] = [sel];

  return cont;
}

function _makePortaContainer() {
  const cont = _createFakeEl('div');
  cont._selectorAll = {};

  // Porta mode LED rows
  var portaRows = [];
  for (var i = 0; i < 3; i++) {
    var row = _createFakeEl('div', { 'data-val': String(i) });
    row.classList.add('porta-mode-led-row');
    portaRows.push(row);
  }
  cont._selectorAll['.porta-mode-led-row'] = portaRows;

  // Note priority LED rows
  var npRows = [];
  [0, 1, 2].forEach(function(val) {
    var row = _createFakeEl('div', { 'data-val': String(val), 'data-param': 'note_priority' });
    row.classList.add('note-priority-led-row');
    npRows.push(row);
  });
  cont._selectorAll['.note-priority-led-row'] = npRows;

  // Trigger mode LED rows
  var tmRows = [];
  [0, 1, 2, 3].forEach(function(val) {
    var row = _createFakeEl('div', { 'data-val': String(val), 'data-param': 'trigger_mode' });
    row.classList.add('trigger-mode-led-row');
    tmRows.push(row);
  });
  cont._selectorAll['.trigger-mode-led-row'] = tmRows;

  return cont;
}

// ══════════════════════════════════════════════════════════════════
// Shared helpers for LCD hover tests
// ══════════════════════════════════════════════════════════════════

function _setupLcdDoc() {
  var lcdEl = _createFakeEl('div', { id: 'lcd-text' });
  var selectPolyMode = _createFakeEl('select', { id: 'panel-poly-mode-select' });
  selectPolyMode.options = [];
  for (var i = 0; i < 13; i++) {
    var opt = _createFakeEl('option');
    opt.value = String(i);
    opt.textContent = 'Mode ' + i;
    selectPolyMode.options.push(opt);
  }

  var mockDoc = {
    getElementById: function(id) {
      if (id === 'lcd-text') return lcdEl;
      if (id === 'panel-poly-mode-select') return selectPolyMode;
      return null;
    },
    addEventListener: vi.fn(),
  };
  return { lcdEl: lcdEl, selectPolyMode: selectPolyMode, mockDoc: mockDoc };
}

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelEnvControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelEnvControls', () => {
  let container, state, titleEl, lcdDoc;

  beforeEach(() => {
    container = _makeEnvContainer('env1_');
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = { panelActiveEnv: 1 };
    _bridge = _makeBridge({ 'env1_trigger_mode': 2.0 / 4.0 });

    lcdDoc = _setupLcdDoc();

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { ENV: _makeTemplate() },
      setLcdParamDisplayTimer: vi.fn(),
      formatParamValue: vi.fn(function(pid, val) {
        if (val === 0) return 'OFF';
        return Math.round(val * 100) + '%';
      }),
    });

    vi.stubGlobal('document', lcdDoc.mockDoc);
  });

  // ── Title ──

  it('sets title to "VCA Env Editor" when panelActiveEnv=1', () => {
    state.panelActiveEnv = 1;
    bindPanelEnvControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('VCA Env Editor');
  });

  it('sets title to "VCF Env Editor" when panelActiveEnv=2', () => {
    state.panelActiveEnv = 2;
    bindPanelEnvControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('VCF Env Editor');
  });

  it('sets title to "MOD Env Editor" when panelActiveEnv=3', () => {
    state.panelActiveEnv = 3;
    bindPanelEnvControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('MOD Env Editor');
  });

  // ── innerHTML ──

  it('sets container.innerHTML from PANEL_TEMPLATES.ENV with prefix', () => {
    bindPanelEnvControls(container, state, titleEl);
    expect(container.innerHTML).toContain('env1_trigger_mode');
    expect(container.innerHTML).toContain('env1_attack');
    expect(container.innerHTML).toContain('env1_decay');
  });

  it('uses env2_ prefix when panelActiveEnv=2', () => {
    state.panelActiveEnv = 2;
    bindPanelEnvControls(container, state, titleEl);
    expect(container.innerHTML).toContain('env2_trigger_mode');
  });

  // ── Event listeners: shape-led-row clicks (trigger mode) ──

  it('registers click listeners on all shape-led-rows', () => {
    bindPanelEnvControls(container, state, titleEl);
    var rows = container._selectorAll['.shape-led-row'];
    rows.forEach(function(row) {
      expect(row._listeners['click']).toBeDefined();
      expect(row._listeners['click'].length).toBe(1);
    });
  });

  it('clicking a trigger row removes active from all rows and activates clicked one', () => {
    bindPanelEnvControls(container, state, titleEl);
    var rows = container._selectorAll['.shape-led-row'];
    rows[0].classList.add('active');

    // Click row at index 2 (LFO 2, trigVal=2)
    rows[2]._listeners['click'][0]();

    rows.forEach(function(row, i) {
      expect(row.classList.contains('active')).toBe(i === 2);
    });
  });

  it('clicking trigger row calls setParameter with trigVal/4.0', () => {
    bindPanelEnvControls(container, state, titleEl);
    var rows = container._selectorAll['.shape-led-row'];

    // Click row at index 4 (Seq, trigVal=4 → 4/4.0 = 1.0)
    rows[4]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('env1_trigger_mode', 1.0);

    // Click row at index 0 (Key, trigVal=0 → 0/4.0 = 0)
    rows[0]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('env1_trigger_mode', 0.0);
  });

  it('does NOT crash clicking trigger row when bridge is undefined', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { ENV: _makeTemplate() },
    });
    bindPanelEnvControls(container, state, titleEl);
    var rows = container._selectorAll['.shape-led-row'];

    expect(function() { rows[0]._listeners['click'][0](); }).not.toThrow();
  });

  // ── LCD hovers: ctrl-units ──

  it('registers mouseenter on ctrl-units', () => {
    bindPanelEnvControls(container, state, titleEl);
    var units = container._selectorAll['.ctrl-unit[data-param]'];
    units.forEach(function(unit) {
      expect(unit._listeners['mouseenter']).toBeDefined();
    });
  });

  it('mouseenter on ctrl-unit updates lcd-text with param info', () => {
    _bridge.parameterCache['env1_attack'] = 0.5;
    bindPanelEnvControls(container, state, titleEl);
    var units = container._selectorAll['.ctrl-unit[data-param]'];

    // Mouse enter on attack unit — use .call() to bind `this` to the element
    var fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });

    expect(lcdDoc.lcdEl.innerHTML).toContain('VCA ENV PANEL');
    expect(lcdDoc.lcdEl.innerHTML).toContain('ATTACK');
    expect(lcdDoc.lcdEl.innerHTML).toContain('50%');
  });

  it('mouseenter on ctrl-unit handles missing cache value (uses 0)', () => {
    bindPanelEnvControls(container, state, titleEl);
    var units = container._selectorAll['.ctrl-unit[data-param]'];

    var fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });

    expect(lcdDoc.lcdEl.innerHTML).toContain('0%');
  });

  it('mouseenter on ctrl-unit works without bridge (uses 0)', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { ENV: _makeTemplate() },
      formatParamValue: function() { return '0%'; },
    });
    bindPanelEnvControls(container, state, titleEl);
    var units = container._selectorAll['.ctrl-unit[data-param]'];

    var fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });

    expect(lcdDoc.lcdEl.innerHTML).toContain('0%');
  });

  it('calls setLcdParamDisplayTimer from ctrl-unit hover', () => {
    bindPanelEnvControls(container, state, titleEl);
    var units = container._selectorAll['.ctrl-unit[data-param]'];

    var fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });

    expect(window.setLcdParamDisplayTimer).toHaveBeenCalledWith(lcdDoc.lcdEl);
  });

  it('does not crash when lcd-text is missing from DOM', () => {
    vi.stubGlobal('document', {
      getElementById: function() { return null; },
      addEventListener: vi.fn(),
    });
    bindPanelEnvControls(container, state, titleEl);
    var units = container._selectorAll['.ctrl-unit[data-param]'];

    var fn = units[0]._listeners['mouseenter'][0];
    expect(function() { fn.call(units[0], { currentTarget: units[0] }); }).not.toThrow();
  });

  // ── LCD hovers: shape-led-rows ──

  it('registers mouseenter on shape-led-rows with data-param', () => {
    bindPanelEnvControls(container, state, titleEl);
    var rows = container._selectorAll['.shape-led-row[data-param]'];
    rows.forEach(function(row) {
      expect(row._listeners['mouseenter']).toBeDefined();
    });
  });

  it('mouseenter on shape-led-row uses formatParamValue', () => {
    _bridge.parameterCache['env1_attack_curve'] = 0.5;
    bindPanelEnvControls(container, state, titleEl);
    var rows = container._selectorAll['.shape-led-row[data-param]'];

    // Row for attack_curve
    rows.forEach(function(row) {
      if (row.getAttribute('data-param') === 'env1_attack_curve') {
        var fn = row._listeners['mouseenter'][0];
        fn.call(row, { currentTarget: row });
      }
    });

    expect(lcdDoc.lcdEl.innerHTML).toContain('VCA ENV PANEL');
    expect(window.formatParamValue).toHaveBeenCalledWith('env1_attack_curve', 0.5);
  });

  // ── Multiple env modes ──

  it('uses correct env name in LCD for panelActiveEnv=2 (VCF)', () => {
    state.panelActiveEnv = 2;
    bindPanelEnvControls(container, state, titleEl);
    var units = container._selectorAll['.ctrl-unit[data-param]'];

    var fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });

    expect(lcdDoc.lcdEl.innerHTML).toContain('VCF ENV PANEL');
  });

  it('uses correct env name in LCD for panelActiveEnv=3 (MOD)', () => {
    state.panelActiveEnv = 3;
    bindPanelEnvControls(container, state, titleEl);
    var units = container._selectorAll['.ctrl-unit[data-param]'];

    var fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });

    expect(lcdDoc.lcdEl.innerHTML).toContain('MOD ENV PANEL');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelPolyControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelPolyControls', () => {
  let container, state, titleEl, lcdDoc;

  beforeEach(() => {
    container = _makePolyContainer();
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({ 'note_priority': 1.0 / 2.0, 'trigger_mode': 2.0 / 3.0 });

    lcdDoc = _setupLcdDoc();

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { POLY: _makeTemplatePoly },
      setLcdParamDisplayTimer: vi.fn(),
      formatParamValue: vi.fn(function(pid, val) {
        if (typeof val !== 'number') return '0%';
        return Math.round(val * 100) + '%';
      }),
    });

    vi.stubGlobal('document', lcdDoc.mockDoc);
  });

  // ── Title ──

  it('sets title to "Polyphony & Unison"', () => {
    bindPanelPolyControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('Polyphony & Unison');
  });

  // ── innerHTML ──

  it('sets container.innerHTML from PANEL_TEMPLATES.POLY', () => {
    bindPanelPolyControls(container, state, titleEl);
    expect(container.innerHTML).toContain('priority-led-row');
  });

  // ── Select change handler ──

  it('registers change listener on panel-poly-mode-select', () => {
    bindPanelPolyControls(container, state, titleEl);
    expect(lcdDoc.selectPolyMode._listeners['change']).toBeDefined();
  });

  it('change event on poly mode select calls setParameter with value/12', () => {
    bindPanelPolyControls(container, state, titleEl);
    lcdDoc.selectPolyMode.value = '3';
    lcdDoc.selectPolyMode._listeners['change'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('voice_mode', 3 / 12.0);
  });

  it('change event does not crash when bridge is null', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { POLY: _makeTemplatePoly },
    });
    bindPanelPolyControls(container, state, titleEl);
    expect(function() { lcdDoc.selectPolyMode._listeners['change'][0](); }).not.toThrow();
  });

  // ── Priority LED rows ──

  it('registers click listeners on all priority-led-rows', () => {
    bindPanelPolyControls(container, state, titleEl);
    var rows = container._selectorAll['.priority-led-row'];
    rows.forEach(function(row) {
      expect(row._listeners['click']).toBeDefined();
    });
  });

  it('clicking priority row activates it and deactivates others', () => {
    bindPanelPolyControls(container, state, titleEl);
    var rows = container._selectorAll['.priority-led-row'];
    rows[0].classList.add('active');

    rows[2]._listeners['click'][0]();

    rows.forEach(function(row, i) {
      expect(row.classList.contains('active')).toBe(i === 2);
    });
  });

  it('clicking priority row calls setParameter with data-val/2.0', () => {
    bindPanelPolyControls(container, state, titleEl);
    var rows = container._selectorAll['.priority-led-row'];

    rows[1]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('note_priority', 1.0 / 2.0);

    rows[0]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('note_priority', 0.0);
  });

  // ── Trigger LED rows ──

  it('registers click listeners on all trigger-led-rows', () => {
    bindPanelPolyControls(container, state, titleEl);
    var rows = container._selectorAll['.trigger-led-row'];
    rows.forEach(function(row) {
      expect(row._listeners['click']).toBeDefined();
    });
  });

  it('clicking trigger row calls setParameter with data-val/3.0', () => {
    bindPanelPolyControls(container, state, titleEl);
    var rows = container._selectorAll['.trigger-led-row'];

    rows[3]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('trigger_mode', 3.0 / 3.0);

    rows[1]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('trigger_mode', 1.0 / 3.0);
  });

  // ── LCD hovers: ctrl-units ──

  it('registers mouseenter on ctrl-units', () => {
    bindPanelPolyControls(container, state, titleEl);
    var units = container._selectorAll['.ctrl-unit[data-param]'];
    units.forEach(function(unit) {
      expect(unit._listeners['mouseenter']).toBeDefined();
    });
  });

  it('mouseenter on ctrl-unit updates lcd with poly label and percentage', () => {
    _bridge.parameterCache['voice_mode'] = 0.5;
    bindPanelPolyControls(container, state, titleEl);
    var units = container._selectorAll['.ctrl-unit[data-param]'];

    var fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });

    expect(lcdDoc.lcdEl.innerHTML).toContain('POLY PANEL');
    expect(lcdDoc.lcdEl.innerHTML).toContain('VOICE_MODE');
    expect(lcdDoc.lcdEl.innerHTML).toContain('50%');
  });

  // ── LCD hovers: shape-led-rows ──

  it('registers mouseenter on shape-led-rows with data-param', () => {
    bindPanelPolyControls(container, state, titleEl);
    var rows = container._selectorAll['.shape-led-row[data-param]'];
    rows.forEach(function(row) {
      expect(row._listeners['mouseenter']).toBeDefined();
    });
  });

  it('mouseenter on shape-led-row uses formatParamValue', () => {
    _bridge.parameterCache['note_priority'] = 0.5;
    bindPanelPolyControls(container, state, titleEl);
    var rows = container._selectorAll['.shape-led-row[data-param]'];

    var fn = rows[0]._listeners['mouseenter'][0];
    fn.call(rows[0], { currentTarget: rows[0] });

    expect(lcdDoc.lcdEl.innerHTML).toContain('POLY PANEL');
    expect(window.formatParamValue).toHaveBeenCalled();
  });

  // ── LCD hovers: select elements ──

  it('registers mouseenter on select[data-param]', () => {
    bindPanelPolyControls(container, state, titleEl);
    var selects = container._selectorAll['select[data-param]'];
    selects.forEach(function(sel) {
      expect(sel._listeners['mouseenter']).toBeDefined();
    });
  });

  it('mouseenter on select shows selected option text in LCD', () => {
    _bridge.parameterCache['unison_detune'] = 0.5;
    bindPanelPolyControls(container, state, titleEl);
    var selects = container._selectorAll['select[data-param]'];

    var fn = selects[0]._listeners['mouseenter'][0];
    fn.call(selects[0], { currentTarget: selects[0] });

    // val=0.5, opts.length=3, idx=Math.round(0.5*2)=1, selectedText options[1].textContent='1'
    expect(lcdDoc.lcdEl.innerHTML).toContain('POLY PANEL');
    expect(lcdDoc.lcdEl.innerHTML).toContain('UNISON_DETUNE');
    expect(lcdDoc.lcdEl.innerHTML).toContain('>1<');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelPortaControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelPortaControls', () => {
  let container, state, titleEl;

  beforeEach(() => {
    container = _makePortaContainer();
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({});

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { PORTA: _makeTemplatePorta },
    });
  });

  // ── Title ──

  it('sets title to "Glide & Voice Settings"', () => {
    bindPanelPortaControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('Glide & Voice Settings');
  });

  // ── innerHTML ──

  it('sets container.innerHTML from PANEL_TEMPLATES.PORTA', () => {
    bindPanelPortaControls(container, state, titleEl);
    expect(container.innerHTML).toContain('porta-mode-led-row');
  });

  // ── Porta mode LED rows ──

  it('registers click listeners on all porta-mode-led-rows', () => {
    bindPanelPortaControls(container, state, titleEl);
    var rows = container._selectorAll['.porta-mode-led-row'];
    rows.forEach(function(row) {
      expect(row._listeners['click']).toBeDefined();
    });
  });

  it('clicking porta-mode row activates it and deactivates others', () => {
    bindPanelPortaControls(container, state, titleEl);
    var rows = container._selectorAll['.porta-mode-led-row'];
    rows[0].classList.add('active');

    rows[1]._listeners['click'][0]();

    rows.forEach(function(row, i) {
      expect(row.classList.contains('active')).toBe(i === 1);
    });
  });

  it('clicking porta-mode row calls setParameter with data-val/9.0', () => {
    bindPanelPortaControls(container, state, titleEl);
    var rows = container._selectorAll['.porta-mode-led-row'];

    rows[2]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('porta_mode', 2.0 / 9.0);

    rows[0]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('porta_mode', 0.0);
  });

  it('clicking porta-mode row does not crash without bridge', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { PORTA: _makeTemplatePorta },
    });
    bindPanelPortaControls(container, state, titleEl);
    var rows = container._selectorAll['.porta-mode-led-row'];

    expect(function() { rows[0]._listeners['click'][0](); }).not.toThrow();
  });

  // ── Note priority LED rows ──

  it('registers click listeners on all note-priority-led-rows', () => {
    bindPanelPortaControls(container, state, titleEl);
    var rows = container._selectorAll['.note-priority-led-row'];
    rows.forEach(function(row) {
      expect(row._listeners['click']).toBeDefined();
    });
  });

  it('clicking note-priority row calls setParameter with data-val/2.0', () => {
    bindPanelPortaControls(container, state, titleEl);
    var rows = container._selectorAll['.note-priority-led-row'];

    rows[1]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('note_priority', 1.0 / 2.0);
  });

  it('clicking note-priority row activates it and deactivates others', () => {
    bindPanelPortaControls(container, state, titleEl);
    var rows = container._selectorAll['.note-priority-led-row'];
    rows[0].classList.add('active');

    rows[2]._listeners['click'][0]();

    rows.forEach(function(row, i) {
      expect(row.classList.contains('active')).toBe(i === 2);
    });
  });

  // ── Trigger mode LED rows ──

  it('registers click listeners on all trigger-mode-led-rows', () => {
    bindPanelPortaControls(container, state, titleEl);
    var rows = container._selectorAll['.trigger-mode-led-row'];
    rows.forEach(function(row) {
      expect(row._listeners['click']).toBeDefined();
    });
  });

  it('clicking trigger-mode row calls setParameter with data-val/3.0', () => {
    bindPanelPortaControls(container, state, titleEl);
    var rows = container._selectorAll['.trigger-mode-led-row'];

    rows[3]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('trigger_mode', 3.0 / 3.0);
  });

  it('clicking trigger-mode row activates it and deactivates others', () => {
    bindPanelPortaControls(container, state, titleEl);
    var rows = container._selectorAll['.trigger-mode-led-row'];
    rows[0].classList.add('active');

    rows[2]._listeners['click'][0]();

    rows.forEach(function(row, i) {
      expect(row.classList.contains('active')).toBe(i === 2);
    });
  });

  // ── Edge cases ──

  it('handles all-empty container (no LED rows)', () => {
    container._selectorAll = {};
    expect(function() { bindPanelPortaControls(container, state, titleEl); }).not.toThrow();
  });
});
