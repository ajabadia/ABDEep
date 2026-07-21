/**
 * Vitest tests for panel_controls_osc_vcf.js — OSC/HPF/VCF panel binding functions.
 *
 * Source:  WebUI/js/panel_controls_osc_vcf.js
 * Run:     npx vitest run WebUI/tests/panelControlsOscVcf.test.js
 *
 * Covers:
 *   - bindPanelOscControls   (OSC1: toggles, pmod/pwm selects, range/pmode LED rows, LCD;
 *                             OSC2: sync-box, pmod/tpm selects, range LED rows, LCD)
 *   - bindPanelHpfControls   (HPF: boost off/on buttons, LCD hovers)
 *   - bindPanelVcfControls   (VCF: pole 2/4, polarity norm/inv, LFO src 1/2, LCD hovers)
 *
 * Pattern: inline functions + fake DOM + vi.stubGlobal for bridge/templates/document
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

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

// ══════════════════════════════════════════════════════════════════
// Template generators
// ══════════════════════════════════════════════════════════════════

function _makeTemplateOsc1() {
  return function() {
    return '<div id="panel-osc1-container">'
      + '<div class="toggle-box" data-param="osc1_saw_enable"><div class="toggle-label">Saw</div></div>'
      + '<div class="toggle-box" data-param="osc1_square_enable"><div class="toggle-label">Square</div></div>'
      + '<div class="osc1-range-led-row" data-val="0"><span class="shape-name">16</span></div>'
      + '<div class="osc1-range-led-row" data-val="1"><span class="shape-name">8</span></div>'
      + '<div class="osc1-range-led-row" data-val="2"><span class="shape-name">4</span></div>'
      + '<div class="osc1-pmode-led-row" data-val="0"><span class="shape-name">OSC 1+2</span></div>'
      + '<div class="osc1-pmode-led-row" data-val="1"><span class="shape-name">OSC 1</span></div>'
      + '<select id="panel-osc1-pmod-src-select"><option>0</option><option>1</option></select>'
      + '<select id="panel-osc1-pwm-src-select"><option>0</option><option>1</option></select>'
      + '<div class="ctrl-unit" data-param="osc1_pwm_amount"><div class="label">PWM Amt</div></div>'
      + '<div class="ctrl-unit" data-param="osc1_pitch_mod"><div class="label">Pitch Mod</div></div>'
      + '</div>';
  };
}

function _makeTemplateOsc2() {
  return function() {
    return '<div id="panel-osc2-container">'
      + '<div id="panel-osc-sync-box" class="toggle-box" data-param="osc_sync_enable"><div class="toggle-label">Sync</div></div>'
      + '<div class="osc2-range-led-row" data-val="0"><span class="shape-name">16</span></div>'
      + '<div class="osc2-range-led-row" data-val="1"><span class="shape-name">8</span></div>'
      + '<div class="osc2-range-led-row" data-val="2"><span class="shape-name">4</span></div>'
      + '<select id="panel-osc2-pmod-src-select"><option>0</option><option>1</option></select>'
      + '<select id="panel-osc2-tpm-src-select"><option>0</option><option>1</option></select>'
      + '<div class="ctrl-unit" data-param="osc2_level"><div class="label">Level</div></div>'
      + '<div class="ctrl-unit" data-param="osc2_pitch"><div class="label">Pitch</div></div>'
      + '</div>';
  };
}

function _makeTemplateHpf() {
  return function() {
    return '<div id="panel-hpf-container">'
      + '<div id="panel-hpf-boost-off" class="btn">Off</div>'
      + '<div id="panel-hpf-boost-on" class="btn">On</div>'
      + '<div class="ctrl-unit" data-param="hpf_cutoff"><div class="label">Cutoff</div></div>'
      + '<div class="toggle-box" data-param="hpf_boost_enable"><div class="toggle-label">Boost</div></div>'
      + '</div>';
  };
}

function _makeTemplateVcf() {
  return function() {
    return '<div id="panel-vcf-container">'
      + '<div id="panel-vcf-pole-2" class="btn">2-Pole</div>'
      + '<div id="panel-vcf-pole-4" class="btn">4-Pole</div>'
      + '<div id="panel-vcf-pol-normal" class="btn">Normal</div>'
      + '<div id="panel-vcf-pol-inverted" class="btn">Inverted</div>'
      + '<div id="panel-vcf-lfosrc-1" class="btn">LFO 1</div>'
      + '<div id="panel-vcf-lfosrc-2" class="btn">LFO 2</div>'
      + '<div class="ctrl-unit" data-param="vcf_cutoff"><div class="label">Cutoff</div></div>'
      + '<div class="ctrl-unit" data-param="vcf_resonance"><div class="label">Resonance</div></div>'
      + '<div class="toggle-box" data-param="vcf_env_depth"><div class="toggle-label">Env Depth</div></div>'
      + '</div>';
  };
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
      setProperty(prop, val) { this._props[prop] = val; },
      get display() { return this._props.display; },
      set display(val) { this._props.display = val; },
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
    dispatchEvent() {},
    _subElements: {},
    _selectorAll: {},
    querySelector(sel) { return this._subElements[sel] || null; },
    querySelectorAll(sel) { return this._selectorAll[sel] || []; },
    options: [],
  };
  return el;
}

// ══════════════════════════════════════════════════════════════════
// Functions under test (extracted from panel_controls_osc_vcf.js)
// ══════════════════════════════════════════════════════════════════

function bindPanelOscControls(container, state, titleEl) {
    const oscSelectBtn = document.getElementById('osc-select-btn');
    if (oscSelectBtn) {
        state.panelActiveOsc = oscSelectBtn.innerText.includes('OSC 2') ? 2 : 1;
    }

    titleEl.innerText = 'OSC ' + (state.panelActiveOsc || 1) + ' Editor';

    if (state.panelActiveOsc === 1) {
        container.innerHTML = window.PANEL_TEMPLATES.OSC1();

        container.querySelectorAll('.toggle-box').forEach(function(box) {
            box.addEventListener('click', function() {
                const paramId = box.getAttribute('data-param');
                const isCurrentlyActive = box.classList.toggle('active');
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter(paramId, isCurrentlyActive ? 1.0 : 0.0);}
            });
        });

        const selectPmod = document.getElementById('panel-osc1-pmod-src-select');
        if (selectPmod) {
            selectPmod.addEventListener('change', function() {
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc1_pm_source', parseInt(selectPmod.value) / 6.0);}
            });
        }

        const selectPwm = document.getElementById('panel-osc1-pwm-src-select');
        if (selectPwm) {
            selectPwm.addEventListener('change', function() {
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc1_pwm_source', parseInt(selectPwm.value) / 5.0);}
            });
        }

        container.querySelectorAll('.osc1-range-led-row').forEach(function(row) {
            row.addEventListener('click', function() {
                const val = parseInt(row.getAttribute('data-val'));
                container.querySelectorAll('.osc1-range-led-row').forEach(function(r) { r.classList.remove('active'); });
                row.classList.add('active');
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc1_range', val / 2.0);}
            });
        });

        container.querySelectorAll('.osc1-pmode-led-row').forEach(function(row) {
            row.addEventListener('click', function() {
                const val = parseInt(row.getAttribute('data-val'));
                container.querySelectorAll('.osc1-pmode-led-row').forEach(function(r) { r.classList.remove('active'); });
                row.classList.add('active');
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc1_pm_mode', val / 1.0);}
            });
        });

    } else {
        container.innerHTML = window.PANEL_TEMPLATES.OSC2();

        const btnSync = document.getElementById('panel-osc-sync-box');
        if (btnSync) {
            btnSync.addEventListener('click', function() {
                const active = btnSync.classList.toggle('active');
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc_sync_enable', active ? 1.0 : 0.0);}
            });
        }

        const selectOsc2Pmod = document.getElementById('panel-osc2-pmod-src-select');
        if (selectOsc2Pmod) {
            selectOsc2Pmod.addEventListener('change', function() {
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc2_pm_source', parseInt(selectOsc2Pmod.value) / 6.0);}
            });
        }

        const selectOsc2Tmod = document.getElementById('panel-osc2-tpm-src-select');
        if (selectOsc2Tmod) {
            selectOsc2Tmod.addEventListener('change', function() {
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc2_tpm_source', parseInt(selectOsc2Tmod.value) / 5.0);}
            });
        }

        container.querySelectorAll('.osc2-range-led-row').forEach(function(row) {
            row.addEventListener('click', function() {
                const val = parseInt(row.getAttribute('data-val'));
                container.querySelectorAll('.osc2-range-led-row').forEach(function(r) { r.classList.remove('active'); });
                row.classList.add('active');
                if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('osc2_range', val / 2.0);}
            });
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
            lcd.innerHTML = '<span style=\"font-size:10px;opacity:0.6;\">OSC ' + (state.panelActiveOsc || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + pct + '%</span>';
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
            lcd.innerHTML = '<span style=\"font-size:10px;opacity:0.6;\">OSC ' + (state.panelActiveOsc || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + window.formatParamValue(pid, v) + '</span>';
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
            lcd.innerHTML = '<span style=\"font-size:10px;opacity:0.6;\">OSC ' + (state.panelActiveOsc || 1) + ' PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });

    // LCD hovers: select elements
    container.querySelectorAll('select[data-param]').forEach(function(el) {
        el.addEventListener('mouseenter', function() {
            const lcd = document.getElementById('lcd-text');
            if (!lcd) {return;}
            const pid = this.getAttribute('data-param');
            const bridge = window.dualMidiBridge;
            const v = bridge ? bridge.parameterCache[pid] : 0;
            const opts = this.options;
            const idx = Math.round(v * (opts.length - 1));
            const selectedText = opts[idx] ? opts[idx].textContent.trim() : pid;
            lcd.innerHTML = '<span style=\"font-size:10px;opacity:0.6;\">OSC ' + (state.panelActiveOsc || 1) + ' PANEL</span><br>'
                + '<strong>' + pid.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + selectedText + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
}

function bindPanelHpfControls(container, state, titleEl) {
    titleEl.innerText = 'HPF Editor';
    container.innerHTML = window.PANEL_TEMPLATES.HPF();

    const btnBoostOff = document.getElementById('panel-hpf-boost-off');
    const btnBoostOn = document.getElementById('panel-hpf-boost-on');

    if (btnBoostOff && btnBoostOn) {
        btnBoostOff.addEventListener('click', function() {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('hpf_boost_enable', 0.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('hpf_boost_enable', 0.0);
            }
        });
        btnBoostOn.addEventListener('click', function() {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('hpf_boost_enable', 1.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('hpf_boost_enable', 1.0);
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
            lcd.innerHTML = '<span style=\"font-size:10px;opacity:0.6;\">HPF PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + pct + '%</span>';
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
            lcd.innerHTML = '<span style=\"font-size:10px;opacity:0.6;\">HPF PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
}

function bindPanelVcfControls(container, state, titleEl) {
    titleEl.innerText = 'VCF Filter Editor';
    container.innerHTML = window.PANEL_TEMPLATES.VCF();

    const btnPole2 = document.getElementById('panel-vcf-pole-2');
    const btnPole4 = document.getElementById('panel-vcf-pole-4');
    if (btnPole2 && btnPole4) {
        btnPole2.addEventListener('click', function() {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_pole_mode', 0.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_pole_mode', 0.0);
            }
        });
        btnPole4.addEventListener('click', function() {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_pole_mode', 1.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_pole_mode', 1.0);
            }
        });
    }

    const btnPolNorm = document.getElementById('panel-vcf-pol-normal');
    const btnPolInv = document.getElementById('panel-vcf-pol-inverted');
    if (btnPolNorm && btnPolInv) {
        btnPolNorm.addEventListener('click', function() {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_env_polarity', 1.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_env_polarity', 1.0);
            }
        });
        btnPolInv.addEventListener('click', function() {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_env_polarity', 0.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_env_polarity', 0.0);
            }
        });
    }

    const btnLfoSrc1 = document.getElementById('panel-vcf-lfosrc-1');
    const btnLfoSrc2 = document.getElementById('panel-vcf-lfosrc-2');
    if (btnLfoSrc1 && btnLfoSrc2) {
        btnLfoSrc1.addEventListener('click', function() {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_lfo_select', 0.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_lfo_select', 0.0);
            }
        });
        btnLfoSrc2.addEventListener('click', function() {
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('vcf_lfo_select', 1.0);
                window.dualMidiBridge.handleParameterChangeFromBackend('vcf_lfo_select', 1.0);
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
            lcd.innerHTML = '<span style=\"font-size:10px;opacity:0.6;\">VCF FILTER PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + pct + '%</span>';
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
            lcd.innerHTML = '<span style=\"font-size:10px;opacity:0.6;\">VCF FILTER PANEL</span><br>'
                + '<strong>' + name.toUpperCase() + '</strong><br>'
                + '<span style=\"font-size:15px;color:var(--accent-pink);\">' + window.formatParamValue(pid, v) + '</span>';
            if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcd);}
        });
    });
}

// ══════════════════════════════════════════════════════════════════
// Helpers: build containers with fake DOM elements
// ══════════════════════════════════════════════════════════════════

function _makeOsc1Container() {
  const cont = _createFakeEl('div');
  cont._selectorAll = {};

  // Toggle boxes
  const toggleDefs = [
    { param: 'osc1_saw_enable', label: 'Saw' },
    { param: 'osc1_square_enable', label: 'Square' },
  ];
  const toggles = [];
  toggleDefs.forEach(function(def) {
    const box = _createFakeEl('div', { 'data-param': def.param });
    box.classList.add('toggle-box');
    const lbl = _createFakeEl('div');
    lbl.classList.add('toggle-label');
    lbl.textContent = def.label;
    box._subElements['.toggle-label'] = lbl;
    toggles.push(box);
  });
  cont._selectorAll['.toggle-box'] = toggles;

  // Range LED rows
  const rangeRows = [];
  [0, 1, 2].forEach(function(v) {
    const row = _createFakeEl('div', { 'data-val': String(v) });
    row.classList.add('osc1-range-led-row');
    rangeRows.push(row);
  });
  cont._selectorAll['.osc1-range-led-row'] = rangeRows;

  // PMode LED rows
  const pmodeRows = [];
  [0, 1].forEach(function(v) {
    const row = _createFakeEl('div', { 'data-val': String(v) });
    row.classList.add('osc1-pmode-led-row');
    pmodeRows.push(row);
  });
  cont._selectorAll['.osc1-pmode-led-row'] = pmodeRows;

  // Ctrl units
  const ctrlDefs = [
    { param: 'osc1_pwm_amount', label: 'PWM Amt' },
    { param: 'osc1_pitch_mod', label: 'Pitch Mod' },
  ];
  const ctrlUnits = [];
  ctrlDefs.forEach(function(def) {
    const unit = _createFakeEl('div', { 'data-param': def.param });
    unit.classList.add('ctrl-unit');
    const lbl = _createFakeEl('div');
    lbl.classList.add('label');
    lbl.textContent = def.label;
    unit._subElements['.label'] = lbl;
    ctrlUnits.push(unit);
  });
  cont._selectorAll['.ctrl-unit[data-param]'] = ctrlUnits;

  // Toggle-boxes with data-param (for LCD)
  const toggleWithParam = [];
  toggleDefs.forEach(function(def) {
    const box = _createFakeEl('div', { 'data-param': def.param });
    box.classList.add('toggle-box');
    box._subElements['.toggle-label'] = _createFakeEl('div');
    box._subElements['.toggle-label'].textContent = def.label;
    toggleWithParam.push(box);
  });
  cont._selectorAll['.toggle-box[data-param]'] = toggleWithParam;

  // Shape-led-rows with data-param (empty for OSC1)
  cont._selectorAll['.shape-led-row[data-param]'] = [];

  // Selects with data-param
  const selectPmod = _createFakeEl('select', { 'data-param': 'osc1_pm_source' });
  selectPmod.options = [{ textContent: 'LFO 1' }, { textContent: 'LFO 2' }];
  const selectPwm = _createFakeEl('select', { 'data-param': 'osc1_pwm_source' });
  selectPwm.options = [{ textContent: 'Manual' }, { textContent: 'LFO 1' }];
  cont._selectorAll['select[data-param]'] = [selectPmod, selectPwm];

  return cont;
}

function _makeOsc2Container() {
  const cont = _createFakeEl('div');
  cont._selectorAll = {};

  // Range LED rows
  const rangeRows = [];
  [0, 1, 2].forEach(function(v) {
    const row = _createFakeEl('div', { 'data-val': String(v) });
    row.classList.add('osc2-range-led-row');
    rangeRows.push(row);
  });
  cont._selectorAll['.osc2-range-led-row'] = rangeRows;

  // Ctrl units
  const ctrlDefs = [
    { param: 'osc2_level', label: 'Level' },
    { param: 'osc2_pitch', label: 'Pitch' },
  ];
  const ctrlUnits = [];
  ctrlDefs.forEach(function(def) {
    const unit = _createFakeEl('div', { 'data-param': def.param });
    unit.classList.add('ctrl-unit');
    const lbl = _createFakeEl('div');
    lbl.classList.add('label');
    lbl.textContent = def.label;
    unit._subElements['.label'] = lbl;
    ctrlUnits.push(unit);
  });
  cont._selectorAll['.ctrl-unit[data-param]'] = ctrlUnits;

  // Toggle-boxes with data-param (empty for OSC2 in this setup)
  cont._selectorAll['.toggle-box[data-param]'] = [];

  // Shape-led-rows with data-param (empty for OSC2)
  cont._selectorAll['.shape-led-row[data-param]'] = [];

  // Selects with data-param
  const selectPmod = _createFakeEl('select', { 'data-param': 'osc2_pm_source' });
  selectPmod.options = [{ textContent: 'LFO 1' }, { textContent: 'LFO 2' }];
  const selectTpm = _createFakeEl('select', { 'data-param': 'osc2_tpm_source' });
  selectTpm.options = [{ textContent: 'Manual' }, { textContent: 'LFO 1' }];
  cont._selectorAll['select[data-param]'] = [selectPmod, selectTpm];

  return cont;
}

function _makeHpfContainer() {
  const cont = _createFakeEl('div');
  cont._selectorAll = {};

  // Ctrl units
  const ctrlDefs = [
    { param: 'hpf_cutoff', label: 'Cutoff' },
  ];
  const ctrlUnits = [];
  ctrlDefs.forEach(function(def) {
    const unit = _createFakeEl('div', { 'data-param': def.param });
    unit.classList.add('ctrl-unit');
    const lbl = _createFakeEl('div');
    lbl.classList.add('label');
    lbl.textContent = def.label;
    unit._subElements['.label'] = lbl;
    ctrlUnits.push(unit);
  });
  cont._selectorAll['.ctrl-unit[data-param]'] = ctrlUnits;

  // Toggle-boxes with data-param
  const toggleBox = _createFakeEl('div', { 'data-param': 'hpf_boost_enable' });
  toggleBox.classList.add('toggle-box');
  toggleBox._subElements['.toggle-label'] = _createFakeEl('div');
  toggleBox._subElements['.toggle-label'].textContent = 'Boost';
  cont._selectorAll['.toggle-box[data-param]'] = [toggleBox];

  return cont;
}

function _makeVcfContainer() {
  const cont = _createFakeEl('div');
  cont._selectorAll = {};

  // Ctrl units
  const ctrlDefs = [
    { param: 'vcf_cutoff', label: 'Cutoff' },
    { param: 'vcf_resonance', label: 'Resonance' },
  ];
  const ctrlUnits = [];
  ctrlDefs.forEach(function(def) {
    const unit = _createFakeEl('div', { 'data-param': def.param });
    unit.classList.add('ctrl-unit');
    const lbl = _createFakeEl('div');
    lbl.classList.add('label');
    lbl.textContent = def.label;
    unit._subElements['.label'] = lbl;
    ctrlUnits.push(unit);
  });
  cont._selectorAll['.ctrl-unit[data-param]'] = ctrlUnits;

  // Toggle-boxes with data-param
  const toggleBox = _createFakeEl('div', { 'data-param': 'vcf_env_depth' });
  toggleBox.classList.add('toggle-box');
  toggleBox._subElements['.toggle-label'] = _createFakeEl('div');
  toggleBox._subElements['.toggle-label'].textContent = 'Env Depth';
  cont._selectorAll['.toggle-box[data-param]'] = [toggleBox];

  return cont;
}

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelOscControls — OSC 1
// ══════════════════════════════════════════════════════════════════

describe('bindPanelOscControls — OSC1', () => {
  let container, state, titleEl, mockDoc, selectPmod, selectPwm, lcdEl;

  beforeEach(() => {
    container = _makeOsc1Container();
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({ 'osc1_saw_enable': 1.0 });

    lcdEl = _createFakeEl('div', { id: 'lcd-text' });
    const oscSelectBtn = _createFakeEl('button', { id: 'osc-select-btn' });
    oscSelectBtn.innerText = 'OSC 1';
    selectPmod = _createFakeEl('select', { id: 'panel-osc1-pmod-src-select' });
    selectPmod.options = [{ value: '0' }, { value: '1' }, { value: '2' }, { value: '3' }];
    selectPwm = _createFakeEl('select', { id: 'panel-osc1-pwm-src-select' });
    selectPwm.options = [{ value: '0' }, { value: '1' }, { value: '2' }];

    mockDoc = {
      getElementById: function(id) {
        if (id === 'osc-select-btn') {return oscSelectBtn;}
        if (id === 'lcd-text') {return lcdEl;}
        if (id === 'panel-osc1-pmod-src-select') {return selectPmod;}
        if (id === 'panel-osc1-pwm-src-select') {return selectPwm;}
        return null;
      },
      addEventListener: vi.fn(),
    };

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { OSC1: _makeTemplateOsc1(), OSC2: _makeTemplateOsc2() },
      setLcdParamDisplayTimer: vi.fn(),
      formatParamValue: vi.fn(function(pid, val) {
        if (val === 0) {return 'OFF';}
        return Math.round(val * 100) + '%';
      }),
    });
    vi.stubGlobal('document', mockDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Detection & Title ──

  it('detects panelActiveOsc=1 when button says OSC 1', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(state.panelActiveOsc).toBe(1);
  });

  it('sets title to "OSC 1 Editor"', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('OSC 1 Editor');
  });

  // ── innerHTML ──

  it('sets container.innerHTML from PANEL_TEMPLATES.OSC1', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(container.innerHTML).toContain('panel-osc1-container');
  });

  // ── Toggle boxes ──

  it('registers click on toggle-boxes', () => {
    bindPanelOscControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box'];
    boxes.forEach(function(box) {
      expect(box._listeners['click']).toBeDefined();
    });
  });

  it('clicking toggle-box calls setParameter', () => {
    bindPanelOscControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box'];
    boxes[0]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc1_saw_enable', 1.0);
  });

  it('clicking active toggle-box calls setParameter with 0.0', () => {
    bindPanelOscControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box'];
    boxes[0].classList.add('active');
    boxes[0]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc1_saw_enable', 0.0);
  });

  it('toggles do not crash without bridge', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { OSC1: _makeTemplateOsc1() },
    });
    bindPanelOscControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box'];
    expect(function() { boxes[0]._listeners['click'][0](); }).not.toThrow();
  });

  // ── Selects ──

  it('registers change on pmod-select', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(selectPmod._listeners['change']).toBeDefined();
  });

  it('change on pmod-select calls setParameter with value/6', () => {
    bindPanelOscControls(container, state, titleEl);
    selectPmod.value = '3';
    selectPmod._listeners['change'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc1_pm_source', 3.0 / 6.0);
  });

  it('registers change on pwm-select', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(selectPwm._listeners['change']).toBeDefined();
  });

  it('change on pwm-select calls setParameter with value/5', () => {
    bindPanelOscControls(container, state, titleEl);
    selectPwm.value = '2';
    selectPwm._listeners['change'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc1_pwm_source', 2.0 / 5.0);
  });

  // ── Range LED rows ──

  it('registers click on osc1-range-led-rows', () => {
    bindPanelOscControls(container, state, titleEl);
    const rows = container._selectorAll['.osc1-range-led-row'];
    rows.forEach(function(r) { expect(r._listeners['click']).toBeDefined(); });
  });

  it('clicking range row toggles active and calls setParameter with data-val/2', () => {
    bindPanelOscControls(container, state, titleEl);
    const rows = container._selectorAll['.osc1-range-led-row'];
    rows[2]._listeners['click'][0]();
    expect(rows[0].classList.contains('active')).toBe(false);
    expect(rows[2].classList.contains('active')).toBe(true);
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc1_range', 2.0 / 2.0);
  });

  // ── PMode LED rows ──

  it('registers click on osc1-pmode-led-rows', () => {
    bindPanelOscControls(container, state, titleEl);
    const rows = container._selectorAll['.osc1-pmode-led-row'];
    rows.forEach(function(r) { expect(r._listeners['click']).toBeDefined(); });
  });

  it('clicking pmode row calls setParameter with data-val/1', () => {
    bindPanelOscControls(container, state, titleEl);
    const rows = container._selectorAll['.osc1-pmode-led-row'];
    rows[1]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc1_pm_mode', 1.0);
  });

  // ── LCD hovers: ctrl-units ──

  it('registers mouseenter on ctrl-units', () => {
    bindPanelOscControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];
    units.forEach(function(u) { expect(u._listeners['mouseenter']).toBeDefined(); });
  });

  it('mouseenter on ctrl-unit shows OSC 1 PANEL + percentage', () => {
    _bridge.parameterCache['osc1_pwm_amount'] = 0.5;
    bindPanelOscControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];
    const fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });
    expect(lcdEl.innerHTML).toContain('OSC 1 PANEL');
    expect(lcdEl.innerHTML).toContain('50%');
  });

  it('calls setLcdParamDisplayTimer from ctrl-unit hover', () => {
    _bridge.parameterCache['osc1_pwm_amount'] = 0.5;
    bindPanelOscControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];
    const fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });
    expect(window.setLcdParamDisplayTimer).toHaveBeenCalledWith(lcdEl);
  });

  it('mouseenter on ctrl-unit does not crash without lcd-text', () => {
    vi.stubGlobal('document', { getElementById: function() { return null; }, addEventListener: vi.fn() });
    bindPanelOscControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];
    const fn = units[0]._listeners['mouseenter'][0];
    expect(function() { fn.call(units[0], { currentTarget: units[0] }); }).not.toThrow();
  });

  // ── LCD hovers: toggle-boxes ──

  it('registers mouseenter on toggle-boxes with data-param', () => {
    bindPanelOscControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box[data-param]'];
    boxes.forEach(function(b) { expect(b._listeners['mouseenter']).toBeDefined(); });
  });

  it('mouseenter on toggle-box uses formatParamValue', () => {
    _bridge.parameterCache['osc1_saw_enable'] = 1.0;
    bindPanelOscControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box[data-param]'];
    const fn = boxes[0]._listeners['mouseenter'][0];
    fn.call(boxes[0], { currentTarget: boxes[0] });
    expect(lcdEl.innerHTML).toContain('OSC 1 PANEL');
    expect(window.formatParamValue).toHaveBeenCalledWith('osc1_saw_enable', 1.0);
  });

  // ── LCD hovers: selects ──

  it('registers mouseenter on selects with data-param', () => {
    bindPanelOscControls(container, state, titleEl);
    const selects = container._selectorAll['select[data-param]'];
    selects.forEach(function(s) { expect(s._listeners['mouseenter']).toBeDefined(); });
  });

  it('mouseenter on select shows selected option text', () => {
    _bridge.parameterCache['osc1_pm_source'] = 0.0; // idx = Math.round(0 * 1) = 0
    bindPanelOscControls(container, state, titleEl);
    const selects = container._selectorAll['select[data-param]'];
    const fn = selects[0]._listeners['mouseenter'][0];
    fn.call(selects[0], { currentTarget: selects[0] });
    expect(lcdEl.innerHTML).toContain('OSC 1 PANEL');
    expect(lcdEl.innerHTML).toContain('LFO 1');
  });

  // ── Edge cases ──

  it('handles missing osc-select-btn', () => {
    mockDoc.getElementById = function(id) {
      if (id === 'lcd-text') {return lcdEl;}
      return null;
    };
    bindPanelOscControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('OSC 1 Editor');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelOscControls — OSC 2
// ══════════════════════════════════════════════════════════════════

describe('bindPanelOscControls — OSC2', () => {
  let container, state, titleEl, mockDoc, btnSync, selectOsc2Pmod, selectOsc2Tmod, lcdEl;

  beforeEach(() => {
    container = _makeOsc2Container();
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({ 'osc_sync_enable': 0.0 });

    lcdEl = _createFakeEl('div', { id: 'lcd-text' });
    const oscSelectBtn = _createFakeEl('button', { id: 'osc-select-btn' });
    oscSelectBtn.innerText = 'OSC 2';
    btnSync = _createFakeEl('div', { id: 'panel-osc-sync-box' });
    btnSync.classList.add('toggle-box');
    selectOsc2Pmod = _createFakeEl('select', { id: 'panel-osc2-pmod-src-select' });
    selectOsc2Pmod.options = [{ value: '0' }, { value: '1' }, { value: '2' }, { value: '3' }];
    selectOsc2Tmod = _createFakeEl('select', { id: 'panel-osc2-tpm-src-select' });
    selectOsc2Tmod.options = [{ value: '0' }, { value: '1' }, { value: '2' }];

    mockDoc = {
      getElementById: function(id) {
        if (id === 'osc-select-btn') {return oscSelectBtn;}
        if (id === 'lcd-text') {return lcdEl;}
        if (id === 'panel-osc-sync-box') {return btnSync;}
        if (id === 'panel-osc2-pmod-src-select') {return selectOsc2Pmod;}
        if (id === 'panel-osc2-tpm-src-select') {return selectOsc2Tmod;}
        return null;
      },
      addEventListener: vi.fn(),
    };

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { OSC1: _makeTemplateOsc1(), OSC2: _makeTemplateOsc2() },
      setLcdParamDisplayTimer: vi.fn(),
      formatParamValue: vi.fn(function(pid, val) {
        if (val === 0) {return 'OFF';}
        return Math.round(val * 100) + '%';
      }),
    });
    vi.stubGlobal('document', mockDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects panelActiveOsc=2 when button says OSC 2', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(state.panelActiveOsc).toBe(2);
  });

  it('sets title to "OSC 2 Editor"', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('OSC 2 Editor');
  });

  it('sets container.innerHTML from PANEL_TEMPLATES.OSC2', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(container.innerHTML).toContain('panel-osc2-container');
  });

  // ── Sync box ──

  it('registers click on sync-box', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(btnSync._listeners['click']).toBeDefined();
  });

  it('clicking sync-box toggles osc_sync_enable', () => {
    bindPanelOscControls(container, state, titleEl);
    btnSync._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc_sync_enable', 1.0);
  });

  it('clicking active sync-box disables', () => {
    bindPanelOscControls(container, state, titleEl);
    btnSync.classList.add('active');
    btnSync._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc_sync_enable', 0.0);
  });

  // ── Selects ──

  it('registers change on osc2-pmod-select', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(selectOsc2Pmod._listeners['change']).toBeDefined();
  });

  it('change on osc2-pmod calls setParameter with value/6', () => {
    bindPanelOscControls(container, state, titleEl);
    selectOsc2Pmod.value = '3';
    selectOsc2Pmod._listeners['change'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc2_pm_source', 3.0 / 6.0);
  });

  it('registers change on osc2-tpm-select', () => {
    bindPanelOscControls(container, state, titleEl);
    expect(selectOsc2Tmod._listeners['change']).toBeDefined();
  });

  it('change on osc2-tpm calls setParameter with value/5', () => {
    bindPanelOscControls(container, state, titleEl);
    selectOsc2Tmod.value = '2';
    selectOsc2Tmod._listeners['change'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc2_tpm_source', 2.0 / 5.0);
  });

  // ── Range LED rows ──

  it('registers click on osc2-range-led-rows', () => {
    bindPanelOscControls(container, state, titleEl);
    const rows = container._selectorAll['.osc2-range-led-row'];
    rows.forEach(function(r) { expect(r._listeners['click']).toBeDefined(); });
  });

  it('clicking osc2 range row calls setParameter with data-val/2', () => {
    bindPanelOscControls(container, state, titleEl);
    const rows = container._selectorAll['.osc2-range-led-row'];
    rows[1]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('osc2_range', 1.0 / 2.0);
  });

  // ── LCD hovers: ctrl-units ──

  it('mouseenter on ctrl-unit shows OSC 2 PANEL', () => {
    _bridge.parameterCache['osc2_level'] = 0.8;
    bindPanelOscControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];
    const fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });
    expect(lcdEl.innerHTML).toContain('OSC 2 PANEL');
    expect(lcdEl.innerHTML).toContain('80%');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelHpfControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelHpfControls', () => {
  let container, state, titleEl, mockDoc, btnBoostOff, btnBoostOn, lcdEl;

  beforeEach(() => {
    container = _makeHpfContainer();
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({ 'hpf_cutoff': 0.3 });

    lcdEl = _createFakeEl('div', { id: 'lcd-text' });
    btnBoostOff = _createFakeEl('button', { id: 'panel-hpf-boost-off' });
    btnBoostOn = _createFakeEl('button', { id: 'panel-hpf-boost-on' });

    mockDoc = {
      getElementById: function(id) {
        if (id === 'lcd-text') {return lcdEl;}
        if (id === 'panel-hpf-boost-off') {return btnBoostOff;}
        if (id === 'panel-hpf-boost-on') {return btnBoostOn;}
        return null;
      },
      addEventListener: vi.fn(),
    };

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { HPF: _makeTemplateHpf() },
      setLcdParamDisplayTimer: vi.fn(),
      formatParamValue: vi.fn(function(pid, val) {
        if (val === 0) {return 'OFF';}
        return Math.round(val * 100) + '%';
      }),
    });
    vi.stubGlobal('document', mockDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets title to "HPF Editor"', () => {
    bindPanelHpfControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('HPF Editor');
  });

  it('sets container.innerHTML from PANEL_TEMPLATES.HPF', () => {
    bindPanelHpfControls(container, state, titleEl);
    expect(container.innerHTML).toContain('panel-hpf-container');
  });

  it('registers click on boost-off button', () => {
    bindPanelHpfControls(container, state, titleEl);
    expect(btnBoostOff._listeners['click']).toBeDefined();
  });

  it('clicking boost-off sets hpf_boost_enable=0.0', () => {
    bindPanelHpfControls(container, state, titleEl);
    btnBoostOff._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('hpf_boost_enable', 0.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('hpf_boost_enable', 0.0);
  });

  it('clicking boost-on sets hpf_boost_enable=1.0', () => {
    bindPanelHpfControls(container, state, titleEl);
    btnBoostOn._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('hpf_boost_enable', 1.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('hpf_boost_enable', 1.0);
  });

  it('buttons do not crash without bridge', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { HPF: _makeTemplateHpf() },
    });
    bindPanelHpfControls(container, state, titleEl);
    expect(function() { btnBoostOff._listeners['click'][0](); }).not.toThrow();
    expect(function() { btnBoostOn._listeners['click'][0](); }).not.toThrow();
  });

  it('does not crash when buttons are missing from DOM', () => {
    mockDoc.getElementById = function(id) { if (id === 'lcd-text') {return lcdEl;} return null; };
    expect(function() { bindPanelHpfControls(container, state, titleEl); }).not.toThrow();
  });

  // ── LCD hovers ──

  it('mouseenter on ctrl-unit shows HPF PANEL + percentage', () => {
    _bridge.parameterCache['hpf_cutoff'] = 0.3;
    bindPanelHpfControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];
    const fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });
    expect(lcdEl.innerHTML).toContain('HPF PANEL');
    expect(lcdEl.innerHTML).toContain('30%');
  });

  it('mouseenter on toggle-box uses formatParamValue', () => {
    _bridge.parameterCache['hpf_boost_enable'] = 1.0;
    bindPanelHpfControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box[data-param]'];
    const fn = boxes[0]._listeners['mouseenter'][0];
    fn.call(boxes[0], { currentTarget: boxes[0] });
    expect(lcdEl.innerHTML).toContain('HPF PANEL');
    expect(window.formatParamValue).toHaveBeenCalledWith('hpf_boost_enable', 1.0);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelVcfControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelVcfControls', () => {
  let container, state, titleEl, mockDoc, btnPole2, btnPole4, btnPolNorm, btnPolInv, btnLfoSrc1, btnLfoSrc2, lcdEl;

  beforeEach(() => {
    container = _makeVcfContainer();
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({ 'vcf_cutoff': 0.7 });

    lcdEl = _createFakeEl('div', { id: 'lcd-text' });
    btnPole2 = _createFakeEl('button', { id: 'panel-vcf-pole-2' });
    btnPole4 = _createFakeEl('button', { id: 'panel-vcf-pole-4' });
    btnPolNorm = _createFakeEl('button', { id: 'panel-vcf-pol-normal' });
    btnPolInv = _createFakeEl('button', { id: 'panel-vcf-pol-inverted' });
    btnLfoSrc1 = _createFakeEl('button', { id: 'panel-vcf-lfosrc-1' });
    btnLfoSrc2 = _createFakeEl('button', { id: 'panel-vcf-lfosrc-2' });

    mockDoc = {
      getElementById: function(id) {
        if (id === 'lcd-text') {return lcdEl;}
        if (id === 'panel-vcf-pole-2') {return btnPole2;}
        if (id === 'panel-vcf-pole-4') {return btnPole4;}
        if (id === 'panel-vcf-pol-normal') {return btnPolNorm;}
        if (id === 'panel-vcf-pol-inverted') {return btnPolInv;}
        if (id === 'panel-vcf-lfosrc-1') {return btnLfoSrc1;}
        if (id === 'panel-vcf-lfosrc-2') {return btnLfoSrc2;}
        return null;
      },
      addEventListener: vi.fn(),
    };

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { VCF: _makeTemplateVcf() },
      setLcdParamDisplayTimer: vi.fn(),
      formatParamValue: vi.fn(function(pid, val) {
        if (val === 0) {return 'OFF';}
        return Math.round(val * 100) + '%';
      }),
    });
    vi.stubGlobal('document', mockDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets title to "VCF Filter Editor"', () => {
    bindPanelVcfControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('VCF Filter Editor');
  });

  it('sets container.innerHTML from PANEL_TEMPLATES.VCF', () => {
    bindPanelVcfControls(container, state, titleEl);
    expect(container.innerHTML).toContain('panel-vcf-container');
  });

  // ── Pole buttons ──

  it('registers click on pole-2 button', () => {
    bindPanelVcfControls(container, state, titleEl);
    expect(btnPole2._listeners['click']).toBeDefined();
  });

  it('clicking pole-2 sets vcf_pole_mode=0.0', () => {
    bindPanelVcfControls(container, state, titleEl);
    btnPole2._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('vcf_pole_mode', 0.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('vcf_pole_mode', 0.0);
  });

  it('clicking pole-4 sets vcf_pole_mode=1.0', () => {
    bindPanelVcfControls(container, state, titleEl);
    btnPole4._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('vcf_pole_mode', 1.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('vcf_pole_mode', 1.0);
  });

  // ── Polarity buttons ──

  it('registers click on polarity normal button', () => {
    bindPanelVcfControls(container, state, titleEl);
    expect(btnPolNorm._listeners['click']).toBeDefined();
  });

  it('clicking normal polarity sets vcf_env_polarity=1.0', () => {
    bindPanelVcfControls(container, state, titleEl);
    btnPolNorm._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('vcf_env_polarity', 1.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('vcf_env_polarity', 1.0);
  });

  it('clicking inverted polarity sets vcf_env_polarity=0.0', () => {
    bindPanelVcfControls(container, state, titleEl);
    btnPolInv._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('vcf_env_polarity', 0.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('vcf_env_polarity', 0.0);
  });

  // ── LFO Source buttons ──

  it('registers click on lfo-src-1 button', () => {
    bindPanelVcfControls(container, state, titleEl);
    expect(btnLfoSrc1._listeners['click']).toBeDefined();
  });

  it('clicking lfo-src-1 sets vcf_lfo_select=0.0', () => {
    bindPanelVcfControls(container, state, titleEl);
    btnLfoSrc1._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('vcf_lfo_select', 0.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('vcf_lfo_select', 0.0);
  });

  it('clicking lfo-src-2 sets vcf_lfo_select=1.0', () => {
    bindPanelVcfControls(container, state, titleEl);
    btnLfoSrc2._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('vcf_lfo_select', 1.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('vcf_lfo_select', 1.0);
  });

  // ── No-bridge ──

  it('buttons do not crash without bridge', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { VCF: _makeTemplateVcf() },
    });
    bindPanelVcfControls(container, state, titleEl);
    expect(function() { btnPole2._listeners['click'][0](); }).not.toThrow();
    expect(function() { btnPolNorm._listeners['click'][0](); }).not.toThrow();
    expect(function() { btnLfoSrc1._listeners['click'][0](); }).not.toThrow();
  });

  it('does not crash when all buttons are missing from DOM', () => {
    mockDoc.getElementById = function(id) { if (id === 'lcd-text') {return lcdEl;} return null; };
    expect(function() { bindPanelVcfControls(container, state, titleEl); }).not.toThrow();
  });

  // ── LCD hovers ──

  it('mouseenter on ctrl-unit shows VCF FILTER PANEL + percentage', () => {
    _bridge.parameterCache['vcf_cutoff'] = 0.7;
    bindPanelVcfControls(container, state, titleEl);
    const units = container._selectorAll['.ctrl-unit[data-param]'];
    const fn = units[0]._listeners['mouseenter'][0];
    fn.call(units[0], { currentTarget: units[0] });
    expect(lcdEl.innerHTML).toContain('VCF FILTER PANEL');
    expect(lcdEl.innerHTML).toContain('70%');
  });

  it('mouseenter on toggle-box uses formatParamValue', () => {
    _bridge.parameterCache['vcf_env_depth'] = 0.5;
    bindPanelVcfControls(container, state, titleEl);
    const boxes = container._selectorAll['.toggle-box[data-param]'];
    const fn = boxes[0]._listeners['mouseenter'][0];
    fn.call(boxes[0], { currentTarget: boxes[0] });
    expect(lcdEl.innerHTML).toContain('VCF FILTER PANEL');
    expect(window.formatParamValue).toHaveBeenCalledWith('vcf_env_depth', 0.5);
  });
});
