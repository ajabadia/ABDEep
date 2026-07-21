/**
 * Vitest tests for panel_controls_lfo_vca.js — LFO and VCA panel binding functions.
 *
 * Source:  WebUI/js/panel_controls_lfo_vca.js
 * Run:     npx vitest run WebUI/tests/panelControlsLfoVca.test.js
 *
 * Covers:
 *   - bindPanelLfoControls  (LFO panel: shape-led-row shape clicks, toggle-box clicks,
 *                             rate label update from arp_sync, LCD hovers on ctrl-units,
 *                             toggle-boxes, and shape-led-rows)
 *   - bindPanelVcaControls  (VCA panel: vca_mode transparent/ballsy buttons, LCD hovers)
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
    handleParameterChangeFromBackend: vi.fn(),
  };
}

function _makeTemplateLFO() {
  return function(prefix) {
    return '<div class="shape-led-row" data-shape="0" data-param="' + prefix + 'shape"><span class="shape-name">Sine</span></div>'
      + '<div class="shape-led-row" data-shape="1" data-param="' + prefix + 'shape"><span class="shape-name">Triangle</span></div>'
      + '<div class="shape-led-row" data-shape="2" data-param="' + prefix + 'shape"><span class="shape-name">Square</span></div>'
      + '<div class="shape-led-row" data-shape="3" data-param="' + prefix + 'shape"><span class="shape-name">Ramp Up</span></div>'
      + '<div class="shape-led-row" data-shape="4" data-param="' + prefix + 'shape"><span class="shape-name">Ramp Down</span></div>'
      + '<div class="shape-led-row" data-shape="5" data-param="' + prefix + 'shape"><span class="shape-name">Smp&amp;Hold</span></div>'
      + '<div class="shape-led-row" data-shape="6" data-param="' + prefix + 'shape"><span class="shape-name">Smp&amp;Glide</span></div>'
      + '<div class="toggle-box" data-param="' + prefix + 'key_sync"><div class="toggle-label">Key Sync</div></div>'
      + '<div class="toggle-box" data-param="' + prefix + 'arp_sync"><div class="toggle-label">Arp Sync</div></div>'
      + '<div class="toggle-box" data-param="' + prefix + 'mono_mode"><div class="toggle-label">Mono</div></div>'
      + '<div class="ctrl-unit" data-param="' + prefix + 'rate"><div class="label">Rate</div></div>'
      + '<div class="ctrl-unit" data-param="' + prefix + 'delay"><div class="label">Delay</div></div>'
      + '<div class="ctrl-unit" data-param="' + prefix + 'slew"><div class="label">Slew</div></div>';
  };
}

function _makeTemplateVCA() {
  return '<div class="ctrl-unit" data-param="vca_level"><div class="label">Level</div></div>'
    + '<div class="ctrl-unit" data-param="vca_env_depth"><div class="label">Env Depth</div></div>'
    + '<div class="ctrl-unit" data-param="vca_vel_sens"><div class="label">Vel Sens</div></div>'
    + '<div class="ctrl-unit" data-param="vca_pan_spread"><div class="label">Pan Spread</div></div>'
    + '<div class="toggle-box" data-param="vca_env_depth"><div class="toggle-label">Env Depth</div></div>'
    + '<div class="toggle-box" data-param="vca_vel_sens"><div class="toggle-label">Vel Sens</div></div>';
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
      add(c) { if (!this._classes.includes(c)) {this._classes.push(c);} },
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
      if (!this._listeners[event]) {this._listeners[event] = [];}
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
        if (this._attrs[attr] !== undefined) {return this;}
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
// Functions under test (extracted from panel_controls_lfo_vca.js)
// ══════════════════════════════════════════════════════════════════

function bindPanelLfoControls(container, state, titleEl) {
    const lfoSelectBtn = document.getElementById('lfo-select-btn');
    if (lfoSelectBtn) {
        state.panelActiveLfo = lfoSelectBtn.innerText.includes('LFO 2') ? 2 : 1;
    }

    titleEl.innerText = 'LFO ' + (state.panelActiveLfo || 1) + ' Editor';
    const prefix = 'lfo' + (state.panelActiveLfo || 1) + '_';
    container.innerHTML = window.PANEL_TEMPLATES.LFO(prefix);

    if (window.dualMidiBridge) {
        const arpSyncVal = window.dualMidiBridge.parameterCache[prefix + 'arp_sync'] || 0;
        const rateLabel = container.querySelector('[data-param="' + prefix + 'rate"] .label');
        if (rateLabel) {
            rateLabel.innerText = arpSyncVal > 0.5 ? 'Clock Div' : 'Rate';
        }
    }

    container.querySelectorAll('.shape-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const shapeVal = parseInt(row.getAttribute('data-shape'));
            const paramId = row.getAttribute('data-param');
            container.querySelectorAll('.shape-led-row').forEach(function(r) { r.classList.remove('active'); });
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter(paramId, shapeVal / 6.0);}
        });
    });

    container.querySelectorAll('.toggle-box').forEach(function(box) {
        box.addEventListener('click', function() {
            const paramId = box.getAttribute('data-param');
            const isCurrentlyActive = box.classList.toggle('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter(paramId, isCurrentlyActive ? 1.0 : 0.0);}
        });
    });

    // LCD hovers: ctrl-units
    container.querySelectorAll('.ctrl-unit[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const lbl = this.querySelector('.label');
            const name = lbl ? lbl.textContent.trim() : pid;
            const pct = typeof v === 'number' ? Math.round(v * 100) : 0;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">LFO ' + (state.panelActiveLfo || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + pct + '%</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });

    // LCD hovers: toggle-boxes
    container.querySelectorAll('.toggle-box[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const lbl = this.querySelector('.toggle-label');
            const name = lbl ? lbl.textContent.trim() : pid;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">LFO ' + (state.panelActiveLfo || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });

    // LCD hovers: shape-led-rows
    container.querySelectorAll('.shape-led-row[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const nameEl = this.querySelector('.shape-name');
            const name = nameEl ? nameEl.textContent.trim() : pid;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">LFO ' + (state.panelActiveLfo || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
}

function bindPanelVcaControls(container, state, titleEl) {
    titleEl.innerText = 'VCA Editor';
    container.innerHTML = window.PANEL_TEMPLATES.VCA();

    const btnTransparent = document.getElementById('panel-vca-mode-transparent');
    const btnBallsy = document.getElementById('panel-vca-mode-ballsy');

    if (btnTransparent && btnBallsy) {
        btnTransparent.addEventListener('click', function() {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vca_mode', 0.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vca_mode', 0.0);
            }
        });
        btnBallsy.addEventListener('click', function() {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vca_mode', 1.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vca_mode', 1.0);
            }
        });
    }

    // LCD hovers: ctrl-units
    container.querySelectorAll('.ctrl-unit[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const lbl = this.querySelector('.label');
            const name = lbl ? lbl.textContent.trim() : pid;
            const pct = typeof v === 'number' ? Math.round(v * 100) : 0;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">VCA PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + pct + '%</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });

    // LCD hovers: toggle-boxes
    container.querySelectorAll('.toggle-box[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const lbl = this.querySelector('.toggle-label');
            const name = lbl ? lbl.textContent.trim() : pid;
            lcd.innerHTML = '<span style="font-size:10px;opacity:0.6;">VCA PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style="font-size:15px;color:var(--accent-pink);">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
}

// ══════════════════════════════════════════════════════════════════
// Helper: build LFO container with fake DOM elements
// ══════════════════════════════════════════════════════════════════

function _makeLfoContainer(prefix) {
  const cont = _createFakeEl('div');
  cont._selectorAll = {};

  // Shape LED rows (7 shapes for LFO)
  const shapeRows = [];
  const shapeDefs = [
    { shape: 0, name: 'Sine' },
    { shape: 1, name: 'Triangle' },
    { shape: 2, name: 'Square' },
    { shape: 3, name: 'Ramp Up' },
    { shape: 4, name: 'Ramp Down' },
    { shape: 5, name: 'Smp&Hold' },
    { shape: 6, name: 'Smp&Glide' },
  ];
  shapeDefs.forEach(function(def) {
    const row = _createFakeEl('div', { 'data-shape': String(def.shape), 'data-param': prefix + 'shape' });
    row.classList.add('shape-led-row');
    const nameEl = _createFakeEl('span');
    nameEl.classList.add('shape-name');
    nameEl.textContent = def.name;
    row._subElements['.shape-name'] = nameEl;
    shapeRows.push(row);
  });
  cont._selectorAll['.shape-led-row'] = shapeRows;

  // Toggle boxes
  const toggleBoxes = [];
  const toggleDefs = [
    { param: 'key_sync', label: 'Key Sync' },
    { param: 'arp_sync', label: 'Arp Sync' },
    { param: 'mono_mode', label: 'Mono' },
  ];
  toggleDefs.forEach(function(def) {
    const box = _createFakeEl('div', { 'data-param': prefix + def.param });
    box.classList.add('toggle-box');
    const label = _createFakeEl('div');
    label.classList.add('toggle-label');
    label.textContent = def.label;
    box._subElements['.toggle-label'] = label;
    toggleBoxes.push(box);
  });
  cont._selectorAll['.toggle-box'] = toggleBoxes;

  // Ctrl units (rate, delay, slew)
  const ctrlUnits = [];
  const ctrlDefs = [
    { param: 'rate', label: 'Rate' },
    { param: 'delay', label: 'Delay' },
    { param: 'slew', label: 'Slew' },
  ];
  ctrlDefs.forEach(function(def) {
    const unit = _createFakeEl('div', { 'data-param': prefix + def.param });
    unit.classList.add('ctrl-unit');
    const label = _createFakeEl('div');
    label.classList.add('label');
    label.textContent = def.label;
    unit._subElements['.label'] = label;
    ctrlUnits.push(unit);
  });
  cont._selectorAll['.ctrl-unit[data-param]'] = ctrlUnits;

  // Rate label (for arp_sync rate label update via querySelector)
  const rateLabel = _createFakeEl('div');
  rateLabel.classList.add('label');
  rateLabel.innerText = 'Rate';
  const rateContainer = _createFakeEl('div', { 'data-param': prefix + 'rate' });
  rateContainer._subElements['.label'] = rateLabel;
  cont._subElements['[data-param="' + prefix + 'rate"] .label'] = rateLabel;
  cont._subElements['[data-param="' + prefix + 'rate"]'] = rateContainer;

  // Toggle-boxes with data-param (for LCD hover)
  const toggleWithParam = [];
  toggleDefs.forEach(function(def) {
    const box = _createFakeEl('div', { 'data-param': prefix + def.param });
    box.classList.add('toggle-box');
    const label = _createFakeEl('div');
    label.classList.add('toggle-label');
    label.textContent = def.label;
    box._subElements['.toggle-label'] = label;
    toggleWithParam.push(box);
  });
  cont._selectorAll['.toggle-box[data-param]'] = toggleWithParam;

  // Shape-led-rows with data-param (for LCD hover on shape rows)
  const shapeWithParam = [];
  shapeDefs.forEach(function(def) {
    const row = _createFakeEl('div', { 'data-shape': String(def.shape), 'data-param': prefix + 'shape' });
    row.classList.add('shape-led-row');
    row._subElements['.shape-name'] = _createFakeEl('span');
    row._subElements['.shape-name'].textContent = def.name;
    shapeWithParam.push(row);
  });
  cont._selectorAll['.shape-led-row[data-param]'] = shapeWithParam;

  return cont;
}

// ══════════════════════════════════════════════════════════════════
// Helper: build VCA container with fake DOM elements
// ══════════════════════════════════════════════════════════════════

function _makeVcaContainer() {
  const cont = _createFakeEl('div');
  cont._selectorAll = {};

  // Ctrl units
  const ctrlUnits = [];
  const ctrlDefs = [
    { param: 'vca_level', label: 'Level' },
    { param: 'vca_env_depth', label: 'Env Depth' },
    { param: 'vca_vel_sens', label: 'Vel Sens' },
    { param: 'vca_pan_spread', label: 'Pan Spread' },
  ];
  ctrlDefs.forEach(function(def) {
    const unit = _createFakeEl('div', { 'data-param': def.param });
    unit.classList.add('ctrl-unit');
    const label = _createFakeEl('div');
    label.classList.add('label');
    label.textContent = def.label;
    unit._subElements['.label'] = label;
    ctrlUnits.push(unit);
  });
  cont._selectorAll['.ctrl-unit[data-param]'] = ctrlUnits;

  // Toggle boxes with data-param
  const toggleBoxes = [];
  const toggleDefs = [
    { param: 'vca_env_depth', label: 'Env Depth' },
    { param: 'vca_vel_sens', label: 'Vel Sens' },
  ];
  toggleDefs.forEach(function(def) {
    const box = _createFakeEl('div', { 'data-param': def.param });
    box.classList.add('toggle-box');
    const label = _createFakeEl('div');
    label.classList.add('toggle-label');
    label.textContent = def.label;
    box._subElements['.toggle-label'] = label;
    toggleBoxes.push(box);
  });
  cont._selectorAll['.toggle-box[data-param]'] = toggleBoxes;

  return cont;
}

// ══════════════════════════════════════════════════════════════════
// Shared helpers for LCD hover tests
// ══════════════════════════════════════════════════════════════════

function _setupLfoDoc() {
  const lcdEl = _createFakeEl('div', { id: 'lcd-text' });
  const lfoSelectBtn = _createFakeEl('button', { id: 'lfo-select-btn' });
  lfoSelectBtn.innerText = 'LFO 1';

  const mockDoc = {
    getElementById: function(id) {
      if (id === 'lcd-text') {return lcdEl;}
      if (id === 'lfo-select-btn') {return lfoSelectBtn;}
      return null;
    },
    addEventListener: vi.fn(),
  };
  return { lcdEl: lcdEl, lfoSelectBtn: lfoSelectBtn, mockDoc: mockDoc };
}

function _setupVcaDoc() {
  const lcdEl = _createFakeEl('div', { id: 'lcd-text' });
  const btnTransparent = _createFakeEl('button', { id: 'panel-vca-mode-transparent' });
  btnTransparent.innerText = 'Transparent';
  const btnBallsy = _createFakeEl('button', { id: 'panel-vca-mode-ballsy' });
  btnBallsy.innerText = 'Ballsy';

  const mockDoc = {
    getElementById: function(id) {
      if (id === 'lcd-text') {return lcdEl;}
      if (id === 'panel-vca-mode-transparent') {return btnTransparent;}
      if (id === 'panel-vca-mode-ballsy') {return btnBallsy;}
      return null;
    },
    addEventListener: vi.fn(),
  };
  return { lcdEl: lcdEl, btnTransparent: btnTransparent, btnBallsy: btnBallsy, mockDoc: mockDoc };
}

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelLfoControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelLfoControls', () => {
  let container, state, titleEl, lfoDoc;

  beforeEach(() => {
    container = _makeLfoContainer('lfo1_');
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({ 'lfo1_shape': 2.0 / 6.0 });

    lfoDoc = _setupLfoDoc();

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { LFO: _makeTemplateLFO() },
      setLcdParamDisplayTimer: vi.fn(),
      formatParamValue: vi.fn(function(pid, val) {
        if (val === 0) {return 'OFF';}
        return Math.round(val * 100) + '%';
      }),
    });

    vi.stubGlobal('document', lfoDoc.mockDoc);
  });

  // ── panelActiveLfo detection from lfo-select-btn text ──

  it('detects panelActiveLfo=1 when button says \"LFO 1\"', () => {
    lfoDoc.lfoSelectBtn.innerText = 'LFO 1';
    bindPanelLfoControls(container, state, titleEl);
    expect(state.panelActiveLfo).toBe(1);
  });

  it('detects panelActiveLfo=2 when button says \"LFO 2\"', () => {
    lfoDoc.lfoSelectBtn.innerText = 'LFO 2';
    bindPanelLfoControls(container, state, titleEl);
    expect(state.panelActiveLfo).toBe(2);
  });

  it('uses fallback LFO 1 when lfo-select-btn is missing from DOM', () => {
    vi.stubGlobal('document', {
      getElementById: function() { return null; },
      addEventListener: vi.fn(),
    });
    bindPanelLfoControls(container, state, titleEl);
    // panelActiveLfo remains undefined from the button detection,
    // but title should use fallback LFO 1
    expect(titleEl.innerText).toBe('LFO 1 Editor');
  });

  // ── Title ──

  it('sets title to \"LFO 1 Editor\" when panelActiveLfo=1', () => {
    bindPanelLfoControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('LFO 1 Editor');
  });

  it('sets title to \"LFO 2 Editor\" when button says LFO 2', () => {
    lfoDoc.lfoSelectBtn.innerText = 'LFO 2';
    bindPanelLfoControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('LFO 2 Editor');
  });

  // ── innerHTML ──

  it('sets container.innerHTML from PANEL_TEMPLATES.LFO with prefix', () => {
    bindPanelLfoControls(container, state, titleEl);
    expect(container.innerHTML).toContain('lfo1_shape');
    expect(container.innerHTML).toContain('lfo1_key_sync');
    expect(container.innerHTML).toContain('lfo1_arp_sync');
  });

  it('uses lfo2_ prefix when panelActiveLfo=2', () => {
    lfoDoc.lfoSelectBtn.innerText = 'LFO 2';
    bindPanelLfoControls(container, state, titleEl);
    expect(container.innerHTML).toContain('lfo2_shape');
  });

  // ── Rate label update from arp_sync cache ──

  it('updates rate label to \"Clock Div\" when arp_sync > 0.5', () => {
    _bridge.parameterCache['lfo1_arp_sync'] = 1.0;
    bindPanelLfoControls(container, state, titleEl);
    const rateLabel = container._subElements['[data-param="lfo1_rate"] .label'];
    expect(rateLabel.innerText).toBe('Clock Div');
  });

  it('keeps rate label as \"Rate\" when arp_sync <= 0.5', () => {
    _bridge.parameterCache['lfo1_arp_sync'] = 0.0;
    bindPanelLfoControls(container, state, titleEl);
    const rateLabel = container._subElements['[data-param="lfo1_rate"] .label'];
    expect(rateLabel.innerText).toBe('Rate');
  });

  it('keeps rate label as \"Rate\" when arp_sync is not in cache', () => {
    delete _bridge.parameterCache['lfo1_arp_sync'];
    bindPanelLfoControls(container, state, titleEl);
    const rateLabel = container._subElements['[data-param="lfo1_rate"] .label'];
    expect(rateLabel.innerText).toBe('Rate');
  });

  it('does not crash updating rate label when rate container is missing', () => {
    // Remove the rate sub-element
    delete container._subElements['[data-param="lfo1_rate"] .label'];
    _bridge.parameterCache['lfo1_arp_sync'] = 1.0;
    expect(function() { bindPanelLfoControls(container, state, titleEl); }).not.toThrow();
  });

  it('does not update rate label when bridge is undefined', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { LFO: _makeTemplateLFO() },
    });
    const rateLabel = container._subElements['[data-param="lfo1_rate"] .label'];
    rateLabel.innerText = 'Rate';
    bindPanelLfoControls(container, state, titleEl);
    expect(rateLabel.innerText).toBe('Rate');
  });

  // ── Event listeners: shape-led-row clicks (shape selection) ──

  it('registers click listeners on all shape-led-rows', () => {
    bindPanelLfoControls(container, state, titleEl);
    const rows = container._selectorAll['.shape-led-row'];
    rows.forEach(function(row) {
      expect(row._listeners['click']).toBeDefined();
      expect(row._listeners['click'].length).toBe(1);
    });
  });

  it('clicking a shape row removes active from all rows and activates clicked one', () => {
    bindPanelLfoControls(container, state, titleEl);
    const rows = container._selectorAll['.shape-led-row'];
    rows[0].classList.add('active');

    // Click row at index 3 (Ramp Up, shapeVal=3)
    rows[3]._listeners['click'][0]();

    rows.forEach(function(row, i) {
      expect(row.classList.contains('active')).toBe(i === 3);
    });
  });

  it('clicking shape row calls setParameter with shapeVal/6.0', () => {
    bindPanelLfoControls(container, state, titleEl);
    const rows = container._selectorAll['.shape-led-row'];

    // Click row at index 6 (Smp&Glide, shapeVal=6 → 6/6.0 = 1.0)
    rows[6]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('lfo1_shape', 1.0);

    // Click row at index 0 (Sine, shapeVal=0 → 0/6.0 = 0)
    rows[0]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('lfo1_shape', 0.0);
  });

  it('does NOT crash clicking shape row when bridge is undefined', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { LFO: _makeTemplateLFO() },
    });
    bindPanelLfoControls(container, state, titleEl);
    const rows = container._selectorAll['.shape-led-row'];

    expect(function() { rows[0]._listeners['click'][0](); }).not.toThrow();
  });

  // ── Event listeners: toggle-box clicks ──

  it('registers click listeners on all toggle-boxes', () => {
    bindPanelLfoControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box'];
    boxes.forEach(function(box) {
      expect(box._listeners['click']).toBeDefined();
      expect(box._listeners['click'].length).toBe(1);
    });
  });

  it('clicking inactive toggle-box activates it and calls setParameter with 1.0', () => {
    bindPanelLfoControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box'];

    // Click first toggle box (key_sync) — inactive → becomes active
    boxes[0]._listeners['click'][0]();

    expect(boxes[0].classList.contains('active')).toBe(true);
    expect(_bridge.setParameter).toHaveBeenCalledWith('lfo1_key_sync', 1.0);
  });

  it('clicking active toggle-box deactivates it and calls setParameter with 0.0', () => {
    bindPanelLfoControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box'];

    // Activate first, then click again to deactivate
    boxes[0].classList.add('active');
    boxes[0]._listeners['click'][0]();

    expect(boxes[0].classList.contains('active')).toBe(false);
    expect(_bridge.setParameter).toHaveBeenCalledWith('lfo1_key_sync', 0.0);
  });

  it('does NOT crash clicking toggle-box when bridge is undefined', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { LFO: _makeTemplateLFO() },
    });
    bindPanelLfoControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box'];

    expect(function() { boxes[0]._listeners['click'][0](); }).not.toThrow();
  });

  // ── LCD hovers: ctrl-units ──

  it('registers mouseenter on ctrl-units', () => {
    bindPanelLfoControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];
    units.forEach(function(unit) {
      expect(unit._listeners['mouseenter']).toBeDefined();
    });
  });

  it('mouseenter on ctrl-unit updates lcd-text with param info (percentage)', () => {
    _bridge.parameterCache['lfo1_delay'] = 0.75;
    bindPanelLfoControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];

    // Find delay unit (index 1) — skip rate at index 0 (which has extra entries from the sub-element setup)
    let delayUnit = null;
    units.forEach(function(u) {
      if (u.getAttribute('data-param') === 'lfo1_delay') {delayUnit = u;}
    });

    const fn = delayUnit._listeners['mouseenter'][0];
    fn.call(delayUnit, { currentTarget: delayUnit });

    expect(lfoDoc.lcdEl.innerHTML).toContain('LFO 1 PANEL');
    expect(lfoDoc.lcdEl.innerHTML).toContain('DELAY');
    expect(lfoDoc.lcdEl.innerHTML).toContain('75%');
  });

  it('mouseenter on ctrl-unit handles missing cache value (uses 0)', () => {
    bindPanelLfoControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];

    let delayUnit = null;
    units.forEach(function(u) {
      if (u.getAttribute('data-param') === 'lfo1_delay') {delayUnit = u;}
    });

    const fn = delayUnit._listeners['mouseenter'][0];
    fn.call(delayUnit, { currentTarget: delayUnit });

    expect(lfoDoc.lcdEl.innerHTML).toContain('0%');
  });

  it('mouseenter on ctrl-unit works without bridge', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { LFO: _makeTemplateLFO() },
      formatParamValue: function() { return '0%'; },
    });
    bindPanelLfoControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];

    let delayUnit = null;
    units.forEach(function(u) {
      if (u.getAttribute('data-param') === 'lfo1_delay') {delayUnit = u;}
    });

    const fn = delayUnit._listeners['mouseenter'][0];
    fn.call(delayUnit, { currentTarget: delayUnit });

    expect(lfoDoc.lcdEl.innerHTML).toContain('0%');
  });

  it('calls setLcdParamDisplayTimer from ctrl-unit hover', () => {
    bindPanelLfoControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];

    let delayUnit = null;
    units.forEach(function(u) {
      if (u.getAttribute('data-param') === 'lfo1_delay') {delayUnit = u;}
    });

    const fn = delayUnit._listeners['mouseenter'][0];
    fn.call(delayUnit, { currentTarget: delayUnit });

    expect(window.setLcdParamDisplayTimer).toHaveBeenCalledWith(lfoDoc.lcdEl);
  });

  it('does not crash when lcd-text is missing from DOM', () => {
    vi.stubGlobal('document', {
      getElementById: function() { return null; },
      addEventListener: vi.fn(),
    });
    bindPanelLfoControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];

    let delayUnit = null;
    units.forEach(function(u) {
      if (u.getAttribute('data-param') === 'lfo1_delay') {delayUnit = u;}
    });

    const fn = delayUnit._listeners['mouseenter'][0];
    expect(function() { fn.call(delayUnit, { currentTarget: delayUnit }); }).not.toThrow();
  });

  // ── LCD hovers: toggle-boxes ──

  it('registers mouseenter on toggle-boxes with data-param', () => {
    bindPanelLfoControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box[data-param]'];
    boxes.forEach(function(box) {
      expect(box._listeners['mouseenter']).toBeDefined();
    });
  });

  it('mouseenter on toggle-box uses formatParamValue', () => {
    _bridge.parameterCache['lfo1_key_sync'] = 1.0;
    bindPanelLfoControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box[data-param]'];

    const fn = boxes[0]._listeners['mouseenter'][0];
    fn.call(boxes[0], { currentTarget: boxes[0] });

    expect(lfoDoc.lcdEl.innerHTML).toContain('LFO 1 PANEL');
    expect(lfoDoc.lcdEl.innerHTML).toContain('KEY SYNC');
    expect(window.formatParamValue).toHaveBeenCalledWith('lfo1_key_sync', 1.0);
  });

  // ── LCD hovers: shape-led-rows ──

  it('registers mouseenter on shape-led-rows with data-param', () => {
    bindPanelLfoControls(container, state, titleEl);
    const rows = container._selectorAll['.shape-led-row[data-param]'];
    rows.forEach(function(row) {
      expect(row._listeners['mouseenter']).toBeDefined();
    });
  });

  it('mouseenter on shape-led-row uses formatParamValue', () => {
    _bridge.parameterCache['lfo1_shape'] = 3.0 / 6.0;
    bindPanelLfoControls(container, state, titleEl);
    const rows = container._selectorAll['.shape-led-row[data-param]'];

    const fn = rows[0]._listeners['mouseenter'][0];
    fn.call(rows[0], { currentTarget: rows[0] });

    expect(lfoDoc.lcdEl.innerHTML).toContain('LFO 1 PANEL');
    expect(window.formatParamValue).toHaveBeenCalled();
  });

  // ── LFO 2 mode ──

  it('shows LFO 2 PANEL in LCD when panelActiveLfo=2', () => {
    lfoDoc.lfoSelectBtn.innerText = 'LFO 2';
    // Rebuild container with lfo2_ prefix so the elements have correct data-params
    const container2 = _makeLfoContainer('lfo2_');
    _bridge.parameterCache['lfo2_delay'] = 0.5;
    bindPanelLfoControls(container2, state, titleEl);

    expect(titleEl.innerText).toBe('LFO 2 Editor');

    // LCD hover on a ctrl-unit — content goes to lfoDoc.lcdEl (the stubbed document)
    const units = container2._selectorAll['.ctrl-unit[data-param]'];
    let delayUnit = null;
    units.forEach(function(u) {
      if (u.getAttribute('data-param') === 'lfo2_delay') {delayUnit = u;}
    });
    expect(delayUnit).not.toBeNull();
    const fn = delayUnit._listeners['mouseenter'][0];
    fn.call(delayUnit, { currentTarget: delayUnit });
    expect(lfoDoc.lcdEl.innerHTML).toContain('LFO 2 PANEL');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelVcaControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelVcaControls', () => {
  let container, state, titleEl, vcaDoc;

  beforeEach(() => {
    container = _makeVcaContainer();
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({ 'vca_level': 0.8 });

    vcaDoc = _setupVcaDoc();

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { VCA: _makeTemplateVCA },
      setLcdParamDisplayTimer: vi.fn(),
      formatParamValue: vi.fn(function(pid, val) {
        if (val === 0) {return 'OFF';}
        return Math.round(val * 100) + '%';
      }),
    });

    vi.stubGlobal('document', vcaDoc.mockDoc);
  });

  // ── Title ──

  it('sets title to \"VCA Editor\"', () => {
    bindPanelVcaControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('VCA Editor');
  });

  // ── innerHTML ──

  it('sets container.innerHTML from PANEL_TEMPLATES.VCA', () => {
    bindPanelVcaControls(container, state, titleEl);
    expect(container.innerHTML).toContain('vca_level');
    expect(container.innerHTML).toContain('vca_env_depth');
  });

  // ── VCA mode buttons ──

  it('registers click listener on transparent button', () => {
    bindPanelVcaControls(container, state, titleEl);
    expect(vcaDoc.btnTransparent._listeners['click']).toBeDefined();
  });

  it('registers click listener on ballsy button', () => {
    bindPanelVcaControls(container, state, titleEl);
    expect(vcaDoc.btnBallsy._listeners['click']).toBeDefined();
  });

  it('clicking transparent button sets vca_mode=0.0 on both setParameter and handleParameterChangeFromBackend', () => {
    bindPanelVcaControls(container, state, titleEl);
    vcaDoc.btnTransparent._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('vca_mode', 0.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('vca_mode', 0.0);
  });

  it('clicking ballsy button sets vca_mode=1.0 on both bridge methods', () => {
    bindPanelVcaControls(container, state, titleEl);
    vcaDoc.btnBallsy._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('vca_mode', 1.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('vca_mode', 1.0);
  });

  it('clicking vca mode buttons does not crash without bridge', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { VCA: _makeTemplateVCA },
    });
    bindPanelVcaControls(container, state, titleEl);
    expect(function() { vcaDoc.btnTransparent._listeners['click'][0](); }).not.toThrow();
    expect(function() { vcaDoc.btnBallsy._listeners['click'][0](); }).not.toThrow();
  });

  it('does not crash when vca mode buttons are missing from DOM', () => {
    vi.stubGlobal('document', {
      getElementById: function() { return null; },
      addEventListener: vi.fn(),
    });
    expect(function() { bindPanelVcaControls(container, state, titleEl); }).not.toThrow();
  });

  // ── LCD hovers: ctrl-units ──

  it('registers mouseenter on ctrl-units', () => {
    bindPanelVcaControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];
    units.forEach(function(unit) {
      expect(unit._listeners['mouseenter']).toBeDefined();
    });
  });

  it('mouseenter on ctrl-unit updates lcd-text with VCA PANEL and percentage', () => {
    _bridge.parameterCache['vca_level'] = 0.8;
    bindPanelVcaControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];

    // Find vca_level unit (index 0)
    const fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });

    expect(vcaDoc.lcdEl.innerHTML).toContain('VCA PANEL');
    expect(vcaDoc.lcdEl.innerHTML).toContain('LEVEL');
    expect(vcaDoc.lcdEl.innerHTML).toContain('80%');
  });

  it('mouseenter on ctrl-unit handles missing cache value', () => {
    bindPanelVcaControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];

    const fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });

    expect(vcaDoc.lcdEl.innerHTML).toContain('0%');
  });

  it('calls setLcdParamDisplayTimer from ctrl-unit hover', () => {
    bindPanelVcaControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];

    const fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });

    expect(window.setLcdParamDisplayTimer).toHaveBeenCalledWith(vcaDoc.lcdEl);
  });

  it('does not crash when lcd-text is missing (VCA ctrl-unit hover)', () => {
    vi.stubGlobal('document', {
      getElementById: function() { return null; },
      addEventListener: vi.fn(),
    });
    bindPanelVcaControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];

    const fn = units[0]._listeners['mouseenter'][0];
    expect(function() { fn.call(units[0], { currentTarget: units[0] }); }).not.toThrow();
  });

  // ── LCD hovers: toggle-boxes ──

  it('registers mouseenter on toggle-boxes with data-param', () => {
    bindPanelVcaControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box[data-param]'];
    boxes.forEach(function(box) {
      expect(box._listeners['mouseenter']).toBeDefined();
    });
  });

  it('mouseenter on toggle-box uses formatParamValue', () => {
    _bridge.parameterCache['vca_env_depth'] = 0.5;
    bindPanelVcaControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box[data-param]'];

    const fn = boxes[0]._listeners['mouseenter'][0];
    fn.call(boxes[0], { currentTarget: boxes[0] });

    expect(vcaDoc.lcdEl.innerHTML).toContain('VCA PANEL');
    expect(window.formatParamValue).toHaveBeenCalledWith('vca_env_depth', 0.5);
  });
});
