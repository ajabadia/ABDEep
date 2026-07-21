/**
 * Vitest tests for panel_controls_arp_seq_mod.js — ARP/Chord/PolyChord/SEQ panel bindings.
 *
 * Source:  WebUI/js/panel_controls_arp_seq_mod.js
 * Run:     npx vitest run WebUI/tests/panelControlsArpSeqMod.test.js
 *
 * Covers:
 *   - bindPanelArpControls      (ARP: toggle boxes, clock/velgate/mode/octave selects)
 *   - bindPanelChordControls    (Chord: enable box with poly_chord mutual excl., load/send)
 *   - bindPanelPolyChordControls (PolyChord: key/root/type selectors, reset, load/send)
 *   - bindPanelChordAndPolyCommon (Chord key/type LED rows sync + clicks)
 *   - bindPanelSeqControls      (SEQ: enable box, clock/length/keyloop selects, skip btn,
 *                                 _syncPanelSeqFromCache, _updatePanelStepVisual)
 *
 * Pattern: inline functions + fake DOM elements + vi.stubGlobal for bridge/templates/document
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Mock state
// ══════════════════════════════════════════════════════════════════

beforeEach(() => {
  vi.useFakeTimers();
  if (typeof global.window === 'undefined') {
    global.window = {};
  }
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

let _bridge = null;

function _makeBridge(cache) {
  return {
    parameterCache: cache || {},
    setParameter: vi.fn(),
    handleParameterChangeFromBackend: vi.fn(),
    requestMidiDump: vi.fn(),
    sendWebMidiParameter: vi.fn(),
  };
}

// ══════════════════════════════════════════════════════════════════
// Template generators
// ══════════════════════════════════════════════════════════════════

function _makeTemplateArp() {
  return function() {
    return '<div id="panel-arp-container">'
      + '<div id="panel-arp-enable-box" class="toggle-box" data-param="arp_enable"><div class="toggle-label">Arp</div></div>'
      + '<div id="panel-arp-hold-box" class="toggle-box" data-param="arp_hold"><div class="toggle-label">Hold</div></div>'
      + '<div id="panel-arp-keysync-box" class="toggle-box" data-param="arp_key_sync"><div class="toggle-label">Key Sync</div></div>'
      + '<select id="panel-arp-clock-select"><option>0</option><option>1</option></select>'
      + '<select id="panel-arp-velgate-select"><option>0</option><option>1</option><option>2</option></select>'
      + '<select id="panel-arp-mode-select"><option>0</option><option>1</option></select>'
      + '<select id="panel-arp-octave-select"><option>0</option><option>1</option><option>2</option><option>3</option></select>'
      + '</div>';
  };
}

function _makeTemplateChord() {
  return function() {
    return '<div id="panel-chord-enable-box" class="toggle-box" data-param="chord_enable"></div>'
      + '<div id="panel-chord-load-btn" class="btn">Load</div>'
      + '<div id="panel-chord-send-btn" class="btn">Send</div>'
      + '<div class="chord-key-led-row" data-val="0"><span class="shape-name">C</span></div>'
      + '<div class="chord-key-led-row" data-val="1"><span class="shape-name">C#</span></div>'
      + '<div class="chord-type-led-row" data-val="0"><span class="shape-name">Maj</span></div>'
      + '<div class="chord-type-led-row" data-val="1"><span class="shape-name">Min</span></div>';
  };
}

function _makeTemplatePolyChord() {
  return function() {
    return '<div id="panel-poly-chord-enable-box" class="toggle-box" data-param="poly_chord_enable"></div>'
      + '<div id="poly-selected-key-label">C</div>'
      + '<div id="poly-mapping-summary"></div>'
      + '<div id="panel-polychord-defaults-btn" class="btn">Defaults</div>'
      + '<div id="panel-polychord-load-btn" class="btn">Load</div>'
      + '<div id="panel-polychord-send-btn" class="btn">Send</div>'
      + '<div class="poly-key-select-row" data-keyidx="0"><span class="shape-name">C</span></div>'
      + '<div class="poly-key-select-row" data-keyidx="1"><span class="shape-name">C#</span></div>'
      + '<div class="poly-key-select-row" data-keyidx="2"><span class="shape-name">D</span></div>'
      + '<div class="poly-root-row" data-val="0"><span class="shape-name">Root 0</span></div>'
      + '<div class="poly-root-row" data-val="1"><span class="shape-name">Root 1</span></div>'
      + '<div class="poly-root-row" data-val="2"><span class="shape-name">Root 2</span></div>'
      + '<div class="poly-type-row" data-val="0"><span class="shape-name">Memory</span></div>'
      + '<div class="poly-type-row" data-val="1"><span class="shape-name">Major</span></div>'
      + '<div class="poly-type-row" data-val="2"><span class="shape-name">Minor</span></div>'
      + '<div class="chord-key-led-row" data-val="0"><span class="shape-name">C</span></div>'
      + '<div class="chord-key-led-row" data-val="1"><span class="shape-name">C#</span></div>'
      + '<div class="chord-type-led-row" data-val="0"><span class="shape-name">Maj</span></div>'
      + '<div class="chord-type-led-row" data-val="1"><span class="shape-name">Min</span></div>';
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
      get top() { return this._props.top; },
      set top(val) { this._props.top = val; },
      get height() { return this._props.height; },
      set height(val) { this._props.height = val; },
      get display() { return this._props.display; },
      set display(val) { this._props.display = val; },
      get background() { return this._props.background; },
      set background(val) { this._props.background = val; },
      get opacity() { return this._props.opacity; },
      set opacity(val) { this._props.opacity = val; },
      get borderTop() { return this._props.borderTop; },
      set borderTop(val) { this._props.borderTop = val; },
      get bottom() { return this._props.bottom; },
      set bottom(val) { this._props.bottom = val; },
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
    removeEventListener(event, handler) {
      if (this._listeners[event]) {
        this._listeners[event] = this._listeners[event].filter(h => h !== handler);
      }
    },
    dispatchEvent() {},
    appendChild(child) {
      this._children = this._children || [];
      this._children.push(child);
      if (child._parent != null) {child._parent = this;}
    },
    _children: [],
    _subElements: {},
    _selectorAll: {},
    querySelector(sel) { return this._subElements[sel] || null; },
    querySelectorAll(sel) { return this._selectorAll[sel] || []; },
    getBoundingClientRect() {
      return { top: 0, left: 0, width: 40, height: this.clientHeight || 100, bottom: this.clientHeight || 100, right: 40 };
    },
    _parent: null,
    options: [],
  };
  return el;
}

// ══════════════════════════════════════════════════════════════════
// Functions under test (extracted from panel_controls_arp_seq_mod.js)
// ══════════════════════════════════════════════════════════════════

function bindPanelArpControls(container, state, titleEl) {
    titleEl.innerText = 'Arpeggiator Settings';
    container.innerHTML = window.PANEL_TEMPLATES.ARP();

    const arpBox = document.getElementById('panel-arp-enable-box');
    if (arpBox) {
        arpBox.addEventListener('click', function() {
            const active = arpBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_enable', active ? 0.0 : 1.0);}
        });
    }

    const holdBox = document.getElementById('panel-arp-hold-box');
    if (holdBox) {
        holdBox.addEventListener('click', function() {
            const active = holdBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_hold', active ? 0.0 : 1.0);}
        });
    }

    const keySyncBox = document.getElementById('panel-arp-keysync-box');
    if (keySyncBox) {
        keySyncBox.addEventListener('click', function() {
            const active = keySyncBox.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_key_sync', active ? 0.0 : 1.0);}
        });
    }

    const selectClock = document.getElementById('panel-arp-clock-select');
    if (selectClock) {
        selectClock.addEventListener('change', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_clock_divider', parseInt(selectClock.value) / 12.0);}
        });
    }

    const selectVelGate = document.getElementById('panel-arp-velgate-select');
    if (selectVelGate) {
        selectVelGate.addEventListener('change', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_velocity_gate', parseInt(selectVelGate.value) / 2.0);}
        });
    }

    const selectMode = document.getElementById('panel-arp-mode-select');
    if (selectMode) {
        selectMode.addEventListener('change', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_mode', parseInt(selectMode.value) / 10.0);}
        });
    }

    const selectOctave = document.getElementById('panel-arp-octave-select');
    if (selectOctave) {
        selectOctave.addEventListener('change', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('arp_octave', parseInt(selectOctave.value) / 3.0);}
        });
    }
}

function bindPanelChordControls(container, state, titleEl) {
    titleEl.innerText = 'Chord Memory';
    container.innerHTML = window.PANEL_TEMPLATES.CHORD();

    if (window.dualMidiBridge) {
        window.dualMidiBridge.requestMidiDump('chord');
    }

    const chordBox = document.getElementById('panel-chord-enable-box');
    if (chordBox) {
        const isEnabled = window.dualMidiBridge && window.dualMidiBridge.parameterCache['chord_enable'] > 0.5;
        chordBox.classList.toggle('active', isEnabled);
        chordBox.addEventListener('click', function() {
            const active = chordBox.classList.contains('active');
            const nextVal = active ? 0.0 : 1.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('chord_enable', nextVal);
                window.dualMidiBridge.handleParameterChangeFromBackend('chord_enable', nextVal);
                if (nextVal > 0.5) {
                    window.dualMidiBridge.setParameter('poly_chord_enable', 0.0);
                    window.dualMidiBridge.handleParameterChangeFromBackend('poly_chord_enable', 0.0);
                }
            }
        });
    }

    const btnLoad = document.getElementById('panel-chord-load-btn');
    if (btnLoad) {
        btnLoad.addEventListener('click', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.requestMidiDump('chord');}
        });
    }

    const btnSend = document.getElementById('panel-chord-send-btn');
    if (btnSend) {
        btnSend.addEventListener('click', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.sendWebMidiParameter('chord_enable', window.dualMidiBridge.parameterCache['chord_enable'] || 0.0);}
        });
    }

    window.bindPanelChordAndPolyCommon(container);
}

function bindPanelPolyChordControls(container, state, titleEl) {
    titleEl.innerText = 'Poly Chord';
    container.innerHTML = window.PANEL_TEMPLATES.POLY_CHORD();

    if (typeof window._initPolyChordNotes === 'function') {
        window._initPolyChordNotes();
    }

    if (window.dualMidiBridge) {
        window.dualMidiBridge.requestMidiDump('polychord');
    }

    const polyChordBox = document.getElementById('panel-poly-chord-enable-box');
    if (polyChordBox) {
        const isEnabled = window.dualMidiBridge && window.dualMidiBridge.parameterCache['poly_chord_enable'] > 0.5;
        polyChordBox.classList.toggle('active', isEnabled);
        polyChordBox.addEventListener('click', function() {
            const active = polyChordBox.classList.contains('active');
            const nextVal = active ? 0.0 : 1.0;
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter('poly_chord_enable', nextVal);
                window.dualMidiBridge.handleParameterChangeFromBackend('poly_chord_enable', nextVal);
                if (nextVal > 0.5) {
                    window.dualMidiBridge.setParameter('chord_enable', 0.0);
                    window.dualMidiBridge.handleParameterChangeFromBackend('chord_enable', 0.0);
                }
            }
        });
    }

    let selectedKeyIdx = 0;
    const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const chordTypeNames = ['Memory','Major','Minor','Maj7','Min7','Dom7','Sus4','Pwr'];

    function _updatePolyAssignUI() {
        const bridge = window.dualMidiBridge;
        if (!bridge) {return;}
        const polyMap = bridge.parameterCache['poly_chord_map'];
        if (!polyMap) {return;}

        const keyLabel = document.getElementById('poly-selected-key-label');
        if (keyLabel) {keyLabel.textContent = noteNames[selectedKeyIdx];}

        container.querySelectorAll('.poly-key-select-row').forEach(function(row) {
            const idx = parseInt(row.getAttribute('data-keyidx'));
            row.classList.toggle('active', idx === selectedKeyIdx);
        });

        const currentChord = polyMap[selectedKeyIdx] || { rootKey: 0, chordType: 1 };
        container.querySelectorAll('.poly-root-row').forEach(function(row) {
            const r = parseInt(row.getAttribute('data-val'));
            row.classList.toggle('active', r === currentChord.rootKey);
        });
        container.querySelectorAll('.poly-type-row').forEach(function(row) {
            const t = parseInt(row.getAttribute('data-val'));
            row.classList.toggle('active', t === currentChord.chordType);
        });

        const summaryEl = document.getElementById('poly-mapping-summary');
        if (summaryEl) {
            let html = '';
            for (let i = 0; i < 12; i++) {
                const a = polyMap[i] || { rootKey: i, chordType: 1 };
                const typeName = chordTypeNames[a.chordType] || 'Major';
                html += '<div style="font-size:7px;color:var(--text-dim);padding:2px">' + noteNames[i] + ': ' + typeName + '</div>';
            }
            summaryEl.innerHTML = html;
        }
    }

    container.querySelectorAll('.poly-key-select-row').forEach(function(row) {
        row.addEventListener('click', function() {
            selectedKeyIdx = parseInt(row.getAttribute('data-keyidx'));
            _updatePolyAssignUI();
        });
    });

    container.querySelectorAll('.poly-root-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            const bridge = window.dualMidiBridge;
            if (!bridge) {return;}
            const polyMap = bridge.parameterCache['poly_chord_map'];
            if (!polyMap) {return;}
            if (!polyMap[selectedKeyIdx]) {polyMap[selectedKeyIdx] = { rootKey: 0, chordType: 1 };}
            polyMap[selectedKeyIdx].rootKey = val;
            _updatePolyAssignUI();
        });
    });

    container.querySelectorAll('.poly-type-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            const bridge = window.dualMidiBridge;
            if (!bridge) {return;}
            const polyMap = bridge.parameterCache['poly_chord_map'];
            if (!polyMap) {return;}
            if (!polyMap[selectedKeyIdx]) {polyMap[selectedKeyIdx] = { rootKey: 0, chordType: 1 };}
            polyMap[selectedKeyIdx].chordType = val;
            _updatePolyAssignUI();
        });
    });

    const resetBtn = document.getElementById('panel-polychord-defaults-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            const bridge = window.dualMidiBridge;
            if (!bridge) {return;}
            if (typeof window.POLY_CHORD_DEFAULTS !== 'undefined') {
                bridge.parameterCache['poly_chord_map'] = window.POLY_CHORD_DEFAULTS.map(function(a) {
                    return { rootKey: a.rootKey, chordType: a.chordType };
                });
            }
            _updatePolyAssignUI();
        });
    }

    const btnLoad = document.getElementById('panel-polychord-load-btn');
    if (btnLoad) {
        btnLoad.addEventListener('click', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.requestMidiDump('polychord');}
        });
    }

    const btnSend = document.getElementById('panel-polychord-send-btn');
    if (btnSend) {
        btnSend.addEventListener('click', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.sendWebMidiParameter('poly_chord_enable', window.dualMidiBridge.parameterCache['poly_chord_enable'] || 0.0);}
        });
    }

    window.bindPanelChordAndPolyCommon(container);
    setTimeout(_updatePolyAssignUI, 100);
}

function bindPanelChordAndPolyCommon(container) {
    if (window.dualMidiBridge) {
        const keyVal = Math.round((window.dualMidiBridge.parameterCache['chord_key'] || 0.0) * 11.0);
        const activeKeyRow = container.querySelector('.chord-key-led-row[data-val="' + keyVal + '"]');
        if (activeKeyRow) {
            container.querySelectorAll('.chord-key-led-row').forEach(function(r) { r.classList.remove('active'); });
            activeKeyRow.classList.add('active');
        }

        const typeVal = Math.round((window.dualMidiBridge.parameterCache['chord_type'] || 0.0) * 11.0);
        const activeTypeRow = container.querySelector('.chord-type-led-row[data-val="' + typeVal + '"]');
        if (activeTypeRow) {
            container.querySelectorAll('.chord-type-led-row').forEach(function(r) { r.classList.remove('active'); });
            activeTypeRow.classList.add('active');
        }
    }

    container.querySelectorAll('.chord-key-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.chord-key-led-row').forEach(function(r) { r.classList.remove('active'); });
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('chord_key', val / 11.0);}
        });
    });

    container.querySelectorAll('.chord-type-led-row').forEach(function(row) {
        row.addEventListener('click', function() {
            const val = parseInt(row.getAttribute('data-val'));
            container.querySelectorAll('.chord-type-led-row').forEach(function(r) { r.classList.remove('active'); });
            row.classList.add('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('chord_type', val / 11.0);}
        });
    });
}

function bindPanelSeqControls(container, state, titleEl) {
    let _panelSeqBadge = '';
    const _bridge_ = window.dualMidiBridge;
    if (_bridge_) {
        const _klNorm_ = _bridge_.parameterCache['seq_key_loop'] || 0;
        const _klVal_ = Math.round(_klNorm_ * 2);
        const _forced_ = _bridge_._seqEngine && _bridge_._seqEngine._forcedFreeRunning;
        let _badgeLabel_ = '', _badgeColor_ = '';
        if (_forced_) { _badgeLabel_ = 'FREE*'; _badgeColor_ = 'var(--accent-yellow)'; }
        else if (_klVal_ === 0) { _badgeLabel_ = 'FREE'; _badgeColor_ = 'var(--accent-green)'; }
        else if (_klVal_ === 1) { _badgeLabel_ = 'KEY'; _badgeColor_ = 'var(--accent-blue)'; }
        else { _badgeLabel_ = 'LOOP'; _badgeColor_ = 'var(--accent-teal)'; }
        let _badgeTooltip_ = '';
        if (_forced_) {
            _badgeTooltip_ = ' title="Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ"';
        }
        const _badgeCursor_ = _forced_ ? ';cursor:help' : '';
        _panelSeqBadge = ' <span style="color:' + _badgeColor_ + ';font-weight:bold;border:1px solid ' + _badgeColor_ + ';padding:0 5px;border-radius:3px;font-size:9px;vertical-align:middle' + _badgeCursor_ + '"' + _badgeTooltip_ + '>' + _badgeLabel_ + '</span>';
    }
    titleEl.innerHTML = 'Control Sequencer' + (window._seqSimMode ? ' \u26A1SIM' : '') + _panelSeqBadge;
    container.innerHTML = window.PANEL_TEMPLATES.SEQ();

    const stepsContainer = document.getElementById('panel-seq-steps-container');
    window._panelSeqValues = new Array(32).fill(0);
    window._panelSeqRaw = new Array(32).fill(128);

    if (stepsContainer) {
        stepsContainer.innerHTML = '';
        for (let psi = 0; psi < 32; psi++) {
            (function(stepIdx) {
                const stepWrap = document.createElement('div');
                stepWrap.style.cssText = 'position:relative;cursor:ns-resize;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;background:var(--bg-header);border-radius:1px;transition:box-shadow 0.12s ease,outline 0.12s ease;';
                if (stepIdx >= 16) {stepWrap.style.gridRow = '2';}

                const zLine = document.createElement('div');
                zLine.style.cssText = 'position:absolute;left:0;right:0;bottom:50%;height:1px;background:rgba(255,255,255,0.08);z-index:1;pointer-events:none;';
                stepWrap.appendChild(zLine);

                const fillBar = document.createElement('div');
                fillBar.className = 'panel-seq-fill';
                fillBar.style.cssText = 'width:100%;position:absolute;bottom:50%;height:0%;background:var(--accent-pink);border-radius:1px;pointer-events:none;';
                stepWrap.appendChild(fillBar);

                const skipBadge = document.createElement('div');
                skipBadge.className = 'panel-seq-skip';
                skipBadge.style.cssText = 'position:absolute;top:1px;left:50%;transform:translateX(-50%);font-size:6px;font-weight:bold;color:var(--color-danger);background:rgba(255,0,0,0.12);padding:0 2px;border-radius:1px;display:none;pointer-events:none;white-space:nowrap;letter-spacing:0.5px;';
                skipBadge.textContent = 'SKIP';
                stepWrap.appendChild(skipBadge);

                const numLabel = document.createElement('div');
                numLabel.className = 'panel-seq-num';
                numLabel.style.cssText = 'position:absolute;bottom:1px;left:50%;transform:translateX(-50%);font-size:5px;color:var(--text-faint);pointer-events:none;line-height:1;';
                numLabel.textContent = String(stepIdx + 1);
                stepWrap.appendChild(numLabel);

                let _isEditing = false;
                stepWrap.addEventListener('dblclick', function(e) {
                    const idx = stepIdx;
                    window._panelLastSeqStep = idx;
                    window._panelSeqValues[idx] = 0;
                    window._panelSeqRaw[idx] = 128;
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), 0.5);
                    }
                    if (typeof window._updatePanelStepVisual === 'function') {
                        window._updatePanelStepVisual(idx);
                    }
                    e.preventDefault();
                    e.stopPropagation();
                });
                stepWrap.addEventListener('mousedown', function(e) {
                    _isEditing = true;
                    window._panelLastSeqStep = stepIdx;
                    const idx = stepIdx;
                    const wraps = stepsContainer ? stepsContainer.children : [];
                    if (idx < 0 || idx >= wraps.length) {return;}
                    const wrap = wraps[idx];
                    const rect = wrap.getBoundingClientRect();
                    const h = rect.height;
                    if (h <= 0) {return;}
                    let relY = 1.0 - (e.clientY - rect.top) / h;
                    relY = Math.max(0, Math.min(1, relY));
                    let bipolar = Math.round((relY * 255) - 128);
                    if (Math.abs(bipolar) <= 2) {bipolar = 0;}
                    window._panelSeqValues[idx] = bipolar;
                    const rawByte = Math.max(0, Math.min(255, bipolar + 128));
                    window._panelSeqRaw[idx] = rawByte;
                    const normalized = Math.max(0, Math.min(1, rawByte / 255.0));
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), normalized);
                    }
                    window._updatePanelStepVisual(idx);
                    e.preventDefault();

                    function _onMove(ev) {
                        if (!_isEditing) {return;}
                        const idx2 = stepIdx;
                        const wraps2 = stepsContainer ? stepsContainer.children : [];
                        if (idx2 < 0 || idx2 >= wraps2.length) {return;}
                        const wrap2 = wraps2[idx2];
                        const rect2 = wrap2.getBoundingClientRect();
                        const h2 = rect2.height;
                        if (h2 <= 0) {return;}
                        let relY2 = 1.0 - (ev.clientY - rect2.top) / h2;
                        relY2 = Math.max(0, Math.min(1, relY2));
                        let bipolar2 = Math.round((relY2 * 255) - 128);
                        if (Math.abs(bipolar2) <= 2) {bipolar2 = 0;}
                        window._panelSeqValues[idx2] = bipolar2;
                        const rawByte2 = Math.max(0, Math.min(255, bipolar2 + 128));
                        window._panelSeqRaw[idx2] = rawByte2;
                        const normalized2 = Math.max(0, Math.min(1, rawByte2 / 255.0));
                        if (window.dualMidiBridge) {
                            window.dualMidiBridge.setParameter('seq_step_' + (idx2 + 1), normalized2);
                        }
                        window._updatePanelStepVisual(idx2);
                    }
                    function _onUp() {
                        _isEditing = false;
                        document.removeEventListener('mousemove', _onMove);
                        document.removeEventListener('mouseup', _onUp);
                    }
                    document.addEventListener('mousemove', _onMove);
                    document.addEventListener('mouseup', _onUp);
                });

                let _touchId = null;
                stepWrap.addEventListener('touchstart', function(e) {
                    if (e.touches.length !== 1) {return;}
                    _touchId = e.changedTouches[0].identifier;
                    _isEditing = true;
                    window._panelLastSeqStep = stepIdx;
                    const idx = stepIdx;
                    const wraps = stepsContainer ? stepsContainer.children : [];
                    if (idx < 0 || idx >= wraps.length) {return;}
                    const wrap = wraps[idx];
                    const rect = wrap.getBoundingClientRect();
                    const h = rect.height;
                    if (h <= 0) {return;}
                    let relY = 1.0 - (e.touches[0].clientY - rect.top) / h;
                    relY = Math.max(0, Math.min(1, relY));
                    let bipolar = Math.round((relY * 255) - 128);
                    if (Math.abs(bipolar) <= 2) {bipolar = 0;}
                    window._panelSeqValues[idx] = bipolar;
                    const rawByte = Math.max(0, Math.min(255, bipolar + 128));
                    window._panelSeqRaw[idx] = rawByte;
                    const normalized = Math.max(0, Math.min(1, rawByte / 255.0));
                    if (window.dualMidiBridge) {
                        window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), normalized);
                    }
                    window._updatePanelStepVisual(idx);

                    function _onTouchMove(ev) {
                        if (!_isEditing) {return;}
                        let touch = null;
                        for (let ti = 0; ti < ev.touches.length; ti++) {
                            if (ev.touches[ti].identifier === _touchId) {
                                touch = ev.touches[ti];
                                break;
                            }
                        }
                        if (!touch) {return;}
                        const idx2 = stepIdx;
                        const wraps2 = stepsContainer ? stepsContainer.children : [];
                        if (idx2 < 0 || idx2 >= wraps2.length) {return;}
                        const wrap2 = wraps2[idx2];
                        const rect2 = wrap2.getBoundingClientRect();
                        const h2 = rect2.height;
                        if (h2 <= 0) {return;}
                        let relY2 = 1.0 - (touch.clientY - rect2.top) / h2;
                        relY2 = Math.max(0, Math.min(1, relY2));
                        let bipolar2 = Math.round((relY2 * 255) - 128);
                        if (Math.abs(bipolar2) <= 2) {bipolar2 = 0;}
                        window._panelSeqValues[idx2] = bipolar2;
                        const rawByte2 = Math.max(0, Math.min(255, bipolar2 + 128));
                        window._panelSeqRaw[idx2] = rawByte2;
                        const normalized2 = Math.max(0, Math.min(1, rawByte2 / 255.0));
                        if (window.dualMidiBridge) {
                            window.dualMidiBridge.setParameter('seq_step_' + (idx2 + 1), normalized2);
                        }
                        window._updatePanelStepVisual(idx2);
                        ev.preventDefault();
                    }
                    function _onTouchEnd() {
                        _isEditing = false;
                        _touchId = null;
                        document.removeEventListener('touchmove', _onTouchMove);
                        document.removeEventListener('touchend', _onTouchEnd);
                    }
                    document.addEventListener('touchmove', _onTouchMove, { passive: false });
                    document.addEventListener('touchend', _onTouchEnd, { passive: false });
                }, { passive: false });

                stepWrap.addEventListener('mouseenter', (function(idx) {
                    return function() {
                        const lcdText = document.getElementById('lcd-text');
                        if (!lcdText) {return;}
                        const v = window._panelSeqValues ? window._panelSeqValues[idx] : 0;
                        const r = window._panelSeqRaw ? window._panelSeqRaw[idx] : 128;
                        const isSkip = r === 0;
                        const sign = v >= 0 ? '+' : '';
                        const valStr = isSkip ? 'SKIP' : sign + v;
                        lcdText.innerHTML = '<span style=\"font-size:10px; opacity:0.6;\">CONTROL SEQ PANEL</span><br>'
                            + '<strong>STEP ' + (idx + 1) + ' VALUE</strong><br>'
                            + '<span style=\"font-size:15px; color:var(--accent-pink);\">' + valStr + ' (raw:' + r + ')</span>';
                        if (typeof window.setLcdParamDisplayTimer === 'function') {window.setLcdParamDisplayTimer(lcdText);}
                    };
                })(stepIdx));

                stepsContainer.appendChild(stepWrap);
            })(psi);
        }
    }

    window._updatePanelStepVisual = function(idx) {
        const wraps = stepsContainer ? stepsContainer.children : [];
        if (idx < 0 || idx >= wraps.length) {return;}
        const wrap = wraps[idx];
        const val = window._panelSeqValues[idx];
        const raw = window._panelSeqRaw[idx];
        if (val === undefined || raw === undefined) {return;}
        const fillBar = wrap.querySelector('.panel-seq-fill');
        const skipBadge = wrap.querySelector('.panel-seq-skip');
        const numLabel = wrap.querySelector('.panel-seq-num');
        const lenSel = document.getElementById('panel-seq-length-select');
        const activeLen = lenSel ? (parseInt(lenSel.value) + 2) : 16;
        const isActive = idx < activeLen;
        const isSkip = raw === 0;

        const signStr = val >= 0 ? '+' : '';
        wrap.title = isSkip
            ? 'Step ' + (idx + 1) + ': SKIP (raw: ' + raw + ')'
            : 'Step ' + (idx + 1) + ': ' + signStr + val + ' (raw: ' + raw + ')';

        if (skipBadge) {skipBadge.style.display = isSkip ? 'block' : 'none';}
        if (numLabel) {
            numLabel.style.color = isActive ? 'var(--text-faint)' : 'var(--text-dim)';
            numLabel.style.opacity = isActive ? '1' : '0.3';
        }
        wrap.style.opacity = isActive ? '1' : '0.3';

        if (fillBar) {
            if (isSkip) {
                fillBar.style.height = '0%';
                fillBar.style.background = 'transparent';
                fillBar.style.borderTop = '1px dashed var(--color-danger)';
            } else if (val >= 0) {
                var pct = Math.min(50, (val / 127) * 50);
                fillBar.style.bottom = '50%';
                fillBar.style.height = pct + '%';
                fillBar.style.background = 'var(--accent-pink)';
                fillBar.style.borderTop = 'none';
            } else {
                var pct = Math.min(50, (Math.abs(val) / 128) * 50);
                fillBar.style.bottom = (50 - pct) + '%';
                fillBar.style.height = pct + '%';
                fillBar.style.background = 'color-mix(in srgb, var(--accent-pink) 40%, #000)';
                fillBar.style.borderTop = 'none';
            }
        }
    };

    function _syncPanelSeqFromCache() {
        const bridge = window.dualMidiBridge;
        if (!bridge) {return;}
        for (let si = 0; si < 32; si++) {
            const paramId = 'seq_step_' + (si + 1);
            const norm = bridge.parameterCache[paramId];
            if (norm !== undefined) {
                const rawByte = Math.round(norm * 255);
                window._panelSeqRaw[si] = rawByte;
                window._panelSeqValues[si] = rawByte === 0 ? 0 : rawByte - 128;
                window._updatePanelStepVisual(si);
            }
        }
    }
    _syncPanelSeqFromCache();

    const seqBox = document.getElementById('panel-seq-enable-box');
    if (seqBox) {
        const enVal = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_enable'] : 0;
        seqBox.classList.toggle('active', enVal > 0.5);
        seqBox.addEventListener('click', function() {
            const active = this.classList.contains('active');
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_enable', active ? 0.0 : 1.0);}
        });
    }

    const openModalBtn = document.getElementById('panel-seq-open-modal-btn');
    if (openModalBtn) {
        openModalBtn.addEventListener('click', function() {
            const backdrop = document.getElementById('seq-modal-backdrop');
            if (backdrop) {
                backdrop.style.display = 'flex';
                if (typeof window.syncSeqModalUIFromState === 'function') {
                    window.syncSeqModalUIFromState();
                }
            }
        });
    }

    const clockSel = document.getElementById('panel-seq-clock-select');
    if (clockSel) {
        const cv = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_clock'] || 0 : 0;
        clockSel.value = Math.round(cv * 15);
        clockSel.addEventListener('change', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_clock', parseInt(this.value) / 15.0);}
        });
    }

    const lenSel = document.getElementById('panel-seq-length-select');
    if (lenSel) {
        const lv = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_length'] || 0 : 0;
        lenSel.value = Math.round(lv * 31);
        lenSel.addEventListener('change', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_length', parseInt(this.value) / 31.0);}
            for (let si2 = 0; si2 < 32; si2++) {window._updatePanelStepVisual(si2);}
        });
    }

    const klSel = document.getElementById('panel-seq-keyloop-select');
    if (klSel) {
        const kv = window.dualMidiBridge ? window.dualMidiBridge.parameterCache['seq_key_loop'] || 0 : 0;
        klSel.value = Math.round(kv * 2);
        klSel.addEventListener('change', function() {
            if (window.dualMidiBridge) {window.dualMidiBridge.setParameter('seq_key_loop', parseInt(this.value) / 2.0);}
            const _bridge_ = window.dualMidiBridge;
            if (_bridge_ && titleEl) {
                const _klv_ = Math.round((_bridge_.parameterCache['seq_key_loop'] || 0) * 2);
                const _frc_ = _bridge_._seqEngine && _bridge_._seqEngine._forcedFreeRunning;
                let _lb_ = '', _lc_ = '';
                if (_frc_) { _lb_ = 'FREE*'; _lc_ = 'var(--accent-yellow)'; }
                else if (_klv_ === 0) { _lb_ = 'FREE'; _lc_ = 'var(--accent-green)'; }
                else if (_klv_ === 1) { _lb_ = 'KEY'; _lc_ = 'var(--accent-blue)'; }
                else { _lb_ = 'LOOP'; _lc_ = 'var(--accent-teal)'; }
                let _klTooltip_ = '';
                if (_frc_) {
                    _klTooltip_ = ' title="Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ"';
                }
                const _klCursor_ = _frc_ ? ';cursor:help' : '';
                const _nwBadge_ = ' <span style="color:' + _lc_ + ';font-weight:bold;border:1px solid ' + _lc_ + ';padding:0 5px;border-radius:3px;font-size:9px;vertical-align:middle' + _klCursor_ + '"' + _klTooltip_ + '>' + _lb_ + '</span>';
                titleEl.innerHTML = 'Control Sequencer' + (window._seqSimMode ? ' \u26A1SIM' : '') + _nwBadge_;
            }
        });
    }

    const skipBtn = document.getElementById('panel-seq-skip-btn');
    if (skipBtn) {
        skipBtn.addEventListener('click', function() {
            const idx = typeof window._panelLastSeqStep === 'number' ? window._panelLastSeqStep : 0;
            const currentRaw = window._panelSeqRaw && window._panelSeqRaw[idx];
            if (currentRaw === 0) {
                window._panelSeqValues[idx] = 0;
                window._panelSeqRaw[idx] = 128;
                if (window.dualMidiBridge) {
                    window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), 0.5);
                }
            } else {
                window._panelSeqValues[idx] = -128;
                window._panelSeqRaw[idx] = 0;
                if (window.dualMidiBridge) {
                    window.dualMidiBridge.setParameter('seq_step_' + (idx + 1), 0.0);
                }
            }
            window._updatePanelStepVisual(idx);
        });
    }
}

// ══════════════════════════════════════════════════════════════════
// Test helpers
// ══════════════════════════════════════════════════════════════════

function _createFakeDocArp() {
  const lcdEl = _createFakeEl('div', { id: 'lcd-text' });
  const mockDoc = {
    getElementById: function(id) {
      if (id === 'lcd-text') {return lcdEl;}
      // For ARP elements that are created dynamically by createElement in the source
      // We'll handle them in the test-specific setup
      return null;
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createElement: function(tag) {
      // For SEQ panel dynamic DOM creation
      return _createFakeEl(tag);
    },
  };
  return { lcdEl: lcdEl, mockDoc: mockDoc };
}

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelArpControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelArpControls', () => {
  let container, state, titleEl, mockDoc, arpBox, holdBox, keysyncBox, clockSel, velgateSel, modeSel, octaveSel;

  beforeEach(() => {
    container = _createFakeEl('div');
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({});

    // Create ARP DOM elements
    arpBox = _createFakeEl('div', { id: 'panel-arp-enable-box' });
    arpBox.classList.add('toggle-box');
    holdBox = _createFakeEl('div', { id: 'panel-arp-hold-box' });
    holdBox.classList.add('toggle-box');
    keysyncBox = _createFakeEl('div', { id: 'panel-arp-keysync-box' });
    keysyncBox.classList.add('toggle-box');
    clockSel = _createFakeEl('select', { id: 'panel-arp-clock-select' });
    clockSel.options = [{ value: '0' }, { value: '1' }, { value: '2' }];
    velgateSel = _createFakeEl('select', { id: 'panel-arp-velgate-select' });
    velgateSel.options = [{ value: '0' }, { value: '1' }, { value: '2' }];
    modeSel = _createFakeEl('select', { id: 'panel-arp-mode-select' });
    modeSel.options = [{ value: '0' }, { value: '1' }, { value: '5' }, { value: '10' }];
    octaveSel = _createFakeEl('select', { id: 'panel-arp-octave-select' });
    octaveSel.options = [{ value: '0' }, { value: '1' }, { value: '2' }, { value: '3' }];

    mockDoc = {
      getElementById: function(id) {
        if (id === 'panel-arp-enable-box') {return arpBox;}
        if (id === 'panel-arp-hold-box') {return holdBox;}
        if (id === 'panel-arp-keysync-box') {return keysyncBox;}
        if (id === 'panel-arp-clock-select') {return clockSel;}
        if (id === 'panel-arp-velgate-select') {return velgateSel;}
        if (id === 'panel-arp-mode-select') {return modeSel;}
        if (id === 'panel-arp-octave-select') {return octaveSel;}
        return null;
      },
      addEventListener: vi.fn(),
    };

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { ARP: _makeTemplateArp() },
    });
    vi.stubGlobal('document', mockDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets title to "Arpeggiator Settings"', () => {
    bindPanelArpControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('Arpeggiator Settings');
  });

  it('sets container.innerHTML from PANEL_TEMPLATES.ARP', () => {
    bindPanelArpControls(container, state, titleEl);
    expect(container.innerHTML).toContain('panel-arp-container');
    expect(container.innerHTML).toContain('panel-arp-enable-box');
  });

  // ── Toggle boxes ──

  it('registers click on arp-enable-box', () => {
    bindPanelArpControls(container, state, titleEl);
    expect(arpBox._listeners['click']).toBeDefined();
  });

  it('clicking inactive arp-box calls setParameter with 1.0', () => {
    bindPanelArpControls(container, state, titleEl);
    arpBox._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('arp_enable', 1.0);
  });

  it('clicking active arp-box calls setParameter with 0.0', () => {
    bindPanelArpControls(container, state, titleEl);
    arpBox.classList.add('active');
    arpBox._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('arp_enable', 0.0);
  });

  it('registers click on hold-box', () => {
    bindPanelArpControls(container, state, titleEl);
    expect(holdBox._listeners['click']).toBeDefined();
  });

  it('clicking hold-box toggles arp_hold', () => {
    bindPanelArpControls(container, state, titleEl);
    holdBox._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('arp_hold', 1.0);
  });

  it('registers click on keysync-box', () => {
    bindPanelArpControls(container, state, titleEl);
    expect(keysyncBox._listeners['click']).toBeDefined();
  });

  it('clicking keysync-box toggles arp_key_sync', () => {
    bindPanelArpControls(container, state, titleEl);
    keysyncBox._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('arp_key_sync', 1.0);
  });

  it('toggles do not crash without bridge', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { ARP: _makeTemplateArp() },
    });
    bindPanelArpControls(container, state, titleEl);
    expect(function() { arpBox._listeners['click'][0](); }).not.toThrow();
    expect(function() { holdBox._listeners['click'][0](); }).not.toThrow();
    expect(function() { keysyncBox._listeners['click'][0](); }).not.toThrow();
  });

  // ── Selects ──

  it('registers change on clock-select', () => {
    bindPanelArpControls(container, state, titleEl);
    expect(clockSel._listeners['change']).toBeDefined();
  });

  it('change on clock-select calls setParameter with value/12', () => {
    bindPanelArpControls(container, state, titleEl);
    clockSel.value = '6';
    clockSel._listeners['change'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('arp_clock_divider', 6.0 / 12.0);
  });

  it('registers change on velgate-select', () => {
    bindPanelArpControls(container, state, titleEl);
    expect(velgateSel._listeners['change']).toBeDefined();
  });

  it('change on velgate-select calls setParameter with value/2', () => {
    bindPanelArpControls(container, state, titleEl);
    velgateSel.value = '1';
    velgateSel._listeners['change'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('arp_velocity_gate', 1.0 / 2.0);
  });

  it('registers change on mode-select', () => {
    bindPanelArpControls(container, state, titleEl);
    expect(modeSel._listeners['change']).toBeDefined();
  });

  it('change on mode-select calls setParameter with value/10', () => {
    bindPanelArpControls(container, state, titleEl);
    modeSel.value = '5';
    modeSel._listeners['change'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('arp_mode', 5.0 / 10.0);
  });

  it('registers change on octave-select', () => {
    bindPanelArpControls(container, state, titleEl);
    expect(octaveSel._listeners['change']).toBeDefined();
  });

  it('change on octave-select calls setParameter with value/3', () => {
    bindPanelArpControls(container, state, titleEl);
    octaveSel.value = '2';
    octaveSel._listeners['change'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('arp_octave', 2.0 / 3.0);
  });

  it('selects do not crash without bridge', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { ARP: _makeTemplateArp() },
    });
    bindPanelArpControls(container, state, titleEl);
    expect(function() { clockSel._listeners['change'][0](); }).not.toThrow();
    expect(function() { velgateSel._listeners['change'][0](); }).not.toThrow();
  });

  it('gracefully handles missing toggle-box in DOM', () => {
    mockDoc.getElementById = function() { return null; };
    expect(function() { bindPanelArpControls(container, state, titleEl); }).not.toThrow();
  });

  it('gracefully handles missing select in DOM', () => {
    mockDoc.getElementById = function() { return null; };
    expect(function() { bindPanelArpControls(container, state, titleEl); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelChordControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelChordControls', () => {
  let container, state, titleEl, chordBox, btnLoad, btnSend, mockDoc;

  beforeEach(() => {
    container = _createFakeEl('div');
    // Add chord/type key rows (needed by bindPanelChordAndPolyCommon)
    const keyRow0 = _createFakeEl('div', { 'data-val': '0' });
    keyRow0.classList.add('chord-key-led-row');
    const keyRow1 = _createFakeEl('div', { 'data-val': '1' });
    keyRow1.classList.add('chord-key-led-row');
    const typeRow0 = _createFakeEl('div', { 'data-val': '0' });
    typeRow0.classList.add('chord-type-led-row');
    const typeRow1 = _createFakeEl('div', { 'data-val': '1' });
    typeRow1.classList.add('chord-type-led-row');
    container._selectorAll['.chord-key-led-row'] = [keyRow0, keyRow1];
    container._selectorAll['.chord-type-led-row'] = [typeRow0, typeRow1];
    container._subElements['.chord-key-led-row[data-val="0"]'] = keyRow0;
    container._subElements['.chord-key-led-row[data-val="1"]'] = keyRow1;
    container._subElements['.chord-type-led-row[data-val="0"]'] = typeRow0;
    container._subElements['.chord-type-led-row[data-val="1"]'] = typeRow1;

    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({ 'chord_enable': 0.0 });

    chordBox = _createFakeEl('div', { id: 'panel-chord-enable-box' });
    btnLoad = _createFakeEl('button', { id: 'panel-chord-load-btn' });
    btnSend = _createFakeEl('button', { id: 'panel-chord-send-btn' });

    mockDoc = {
      getElementById: function(id) {
        if (id === 'panel-chord-enable-box') {return chordBox;}
        if (id === 'panel-chord-load-btn') {return btnLoad;}
        if (id === 'panel-chord-send-btn') {return btnSend;}
        return null;
      },
      addEventListener: vi.fn(),
    };

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { CHORD: _makeTemplateChord() },
      bindPanelChordAndPolyCommon: function(c) { /* stub */ },
    });
    vi.stubGlobal('document', mockDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets title to "Chord Memory"', () => {
    bindPanelChordControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('Chord Memory');
  });

  it('sets container.innerHTML from PANEL_TEMPLATES.CHORD', () => {
    bindPanelChordControls(container, state, titleEl);
    expect(container.innerHTML).toContain('chord-enable-box');
  });

  it('calls requestMidiDump on bind', () => {
    bindPanelChordControls(container, state, titleEl);
    expect(_bridge.requestMidiDump).toHaveBeenCalledWith('chord');
  });

  it('registers click on chord-box', () => {
    bindPanelChordControls(container, state, titleEl);
    expect(chordBox._listeners['click']).toBeDefined();
  });

  it('chord-box not active when cache is 0', () => {
    bindPanelChordControls(container, state, titleEl);
    expect(chordBox.classList.contains('active')).toBe(false);
  });

  it('chord-box active when cache > 0.5', () => {
    _bridge.parameterCache['chord_enable'] = 1.0;
    bindPanelChordControls(container, state, titleEl);
    expect(chordBox.classList.contains('active')).toBe(true);
  });

  it('clicking inactive chord-box enables chord and disables poly_chord', () => {
    bindPanelChordControls(container, state, titleEl);
    chordBox._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('chord_enable', 1.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('chord_enable', 1.0);
    // Should also disable poly_chord when enabling chord
    expect(_bridge.setParameter).toHaveBeenCalledWith('poly_chord_enable', 0.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('poly_chord_enable', 0.0);
  });

  it('clicking active chord-box disables chord (does NOT touch poly_chord)', () => {
    _bridge.parameterCache['chord_enable'] = 1.0;
    bindPanelChordControls(container, state, titleEl);
    chordBox.classList.add('active');
    chordBox._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('chord_enable', 0.0);
    // poly_chord_enable should NOT be set when disabling chord
    expect(_bridge.setParameter).not.toHaveBeenCalledWith('poly_chord_enable', expect.anything());
  });

  it('clicking chord-box does not crash without bridge', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { CHORD: _makeTemplateChord() },
      bindPanelChordAndPolyCommon: function() {},
    });
    bindPanelChordControls(container, state, titleEl);
    expect(function() { chordBox._listeners['click'][0](); }).not.toThrow();
  });

  it('registers click on load-btn', () => {
    bindPanelChordControls(container, state, titleEl);
    expect(btnLoad._listeners['click']).toBeDefined();
  });

  it('clicking load-btn calls requestMidiDump', () => {
    bindPanelChordControls(container, state, titleEl);
    btnLoad._listeners['click'][0]();
    expect(_bridge.requestMidiDump).toHaveBeenCalledWith('chord');
  });

  it('registers click on send-btn', () => {
    bindPanelChordControls(container, state, titleEl);
    expect(btnSend._listeners['click']).toBeDefined();
  });

  it('clicking send-btn calls sendWebMidiParameter', () => {
    bindPanelChordControls(container, state, titleEl);
    btnSend._listeners['click'][0]();
    expect(_bridge.sendWebMidiParameter).toHaveBeenCalledWith('chord_enable', 0.0);
  });

  it('handles missing chord-box in DOM', () => {
    mockDoc.getElementById = function(id) {
      if (id === 'panel-chord-load-btn' || id === 'panel-chord-send-btn') {return _createFakeEl('button', { id: id });}
      return null;
    };
    expect(function() { bindPanelChordControls(container, state, titleEl); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelChordAndPolyCommon
// ══════════════════════════════════════════════════════════════════

describe('bindPanelChordAndPolyCommon', () => {
  let container, mockDoc;

  beforeEach(() => {
    container = _createFakeEl('div');
    const keyRow0 = _createFakeEl('div', { 'data-val': '0' });
    keyRow0.classList.add('chord-key-led-row');
    const keyRow1 = _createFakeEl('div', { 'data-val': '1' });
    keyRow1.classList.add('chord-key-led-row');
    const typeRow0 = _createFakeEl('div', { 'data-val': '0' });
    typeRow0.classList.add('chord-type-led-row');
    const typeRow1 = _createFakeEl('div', { 'data-val': '1' });
    typeRow1.classList.add('chord-type-led-row');

    container._selectorAll['.chord-key-led-row'] = [keyRow0, keyRow1];
    container._selectorAll['.chord-type-led-row'] = [typeRow0, typeRow1];
    container._subElements['.chord-key-led-row[data-val="0"]'] = keyRow0;
    container._subElements['.chord-key-led-row[data-val="1"]'] = keyRow1;
    container._subElements['.chord-type-led-row[data-val="0"]'] = typeRow0;
    container._subElements['.chord-type-led-row[data-val="1"]'] = typeRow1;

    _bridge = _makeBridge({ 'chord_key': 0.5 / 11.0, 'chord_type': 0.5 / 11.0 });

    mockDoc = { addEventListener: vi.fn() };

    vi.stubGlobal('window', { dualMidiBridge: _bridge });
    vi.stubGlobal('document', mockDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('registers click listeners on chord-key-led-rows', () => {
    bindPanelChordAndPolyCommon(container);
    const rows = container._selectorAll['.chord-key-led-row'];
    rows.forEach(function(r) {
      expect(r._listeners['click']).toBeDefined();
    });
  });

  it('clicking chord-key-led-row calls setParameter with data-val/11', () => {
    bindPanelChordAndPolyCommon(container);
    const rows = container._selectorAll['.chord-key-led-row'];
    rows[1]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('chord_key', 1.0 / 11.0);
  });

  it('clicking chord-key-led-row toggles active class', () => {
    bindPanelChordAndPolyCommon(container);
    const rows = container._selectorAll['.chord-key-led-row'];
    rows[0].classList.add('active');
    rows[1]._listeners['click'][0]();
    expect(rows[0].classList.contains('active')).toBe(false);
    expect(rows[1].classList.contains('active')).toBe(true);
  });

  it('registers click listeners on chord-type-led-rows', () => {
    bindPanelChordAndPolyCommon(container);
    const rows = container._selectorAll['.chord-type-led-row'];
    rows.forEach(function(r) {
      expect(r._listeners['click']).toBeDefined();
    });
  });

  it('clicking chord-type-led-row calls setParameter with data-val/11', () => {
    bindPanelChordAndPolyCommon(container);
    const rows = container._selectorAll['.chord-type-led-row'];
    rows[1]._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('chord_type', 1.0 / 11.0);
  });

  it('synchronizes chord_key from cache on bind', () => {
    _bridge.parameterCache['chord_key'] = 0.5;
    const vals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    // Add more rows to support higher val ranges
    container._selectorAll['.chord-key-led-row'] = vals.map(function(v) {
      const row = _createFakeEl('div', { 'data-val': String(v) });
      row.classList.add('chord-key-led-row');
      container._subElements['.chord-key-led-row[data-val="' + v + '"]'] = row;
      return row;
    });
    // chord_key = 0.5 → Math.round(0.5 * 11) = Math.round(5.5) = 6
    _bridge.parameterCache['chord_key'] = 0.5;
    bindPanelChordAndPolyCommon(container);
    const rows = container._selectorAll['.chord-key-led-row'];
    rows.forEach(function(r, i) {
      expect(r.classList.contains('active')).toBe(i === 6);
    });
  });

  it('does nothing without bridge', () => {
    vi.stubGlobal('window', { dualMidiBridge: null });
    expect(function() { bindPanelChordAndPolyCommon(container); }).not.toThrow();
  });

  it('does not crash when no chord-key rows in DOM', () => {
    container._selectorAll['.chord-key-led-row'] = [];
    container._selectorAll['.chord-type-led-row'] = [];
    expect(function() { bindPanelChordAndPolyCommon(container); }).not.toThrow();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelPolyChordControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelPolyChordControls', () => {
  let container, state, titleEl, mockDoc, polyChordBox;

  beforeEach(() => {
    container = _createFakeEl('div');
    // Add chord-key/type rows needed by bindPanelChordAndPolyCommon
    const keyRow0 = _createFakeEl('div', { 'data-val': '0' });
    keyRow0.classList.add('chord-key-led-row');
    const keyRow1 = _createFakeEl('div', { 'data-val': '1' });
    keyRow1.classList.add('chord-key-led-row');
    const typeRow0 = _createFakeEl('div', { 'data-val': '0' });
    typeRow0.classList.add('chord-type-led-row');
    const typeRow1 = _createFakeEl('div', { 'data-val': '1' });
    typeRow1.classList.add('chord-type-led-row');
    container._selectorAll['.chord-key-led-row'] = [keyRow0, keyRow1];
    container._selectorAll['.chord-type-led-row'] = [typeRow0, typeRow1];
    container._subElements['.chord-key-led-row[data-val="0"]'] = keyRow0;
    container._subElements['.chord-key-led-row[data-val="1"]'] = keyRow1;
    container._subElements['.chord-type-led-row[data-val="0"]'] = typeRow0;
    container._subElements['.chord-type-led-row[data-val="1"]'] = typeRow1;

    // Add poly rows
    const keySelectRows = [];
    for (let ki = 0; ki < 12; ki++) {
      var row = _createFakeEl('div', { 'data-keyidx': String(ki) });
      row.classList.add('poly-key-select-row');
      keySelectRows.push(row);
    }
    container._selectorAll['.poly-key-select-row'] = keySelectRows;

    const rootRows = [];
    for (let ri = 0; ri < 12; ri++) {
      var row = _createFakeEl('div', { 'data-val': String(ri) });
      row.classList.add('poly-root-row');
      rootRows.push(row);
    }
    container._selectorAll['.poly-root-row'] = rootRows;

    const typeRows = [];
    for (let ti = 0; ti < 8; ti++) {
      var row = _createFakeEl('div', { 'data-val': String(ti) });
      row.classList.add('poly-type-row');
      typeRows.push(row);
    }
    container._selectorAll['.poly-type-row'] = typeRows;

    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({ 'poly_chord_enable': 0.0, 'poly_chord_map': [] });

    polyChordBox = _createFakeEl('div', { id: 'panel-poly-chord-enable-box' });
    const keyLabel = _createFakeEl('div', { id: 'poly-selected-key-label' });
    const mappingSummary = _createFakeEl('div', { id: 'poly-mapping-summary' });
    const resetBtn = _createFakeEl('button', { id: 'panel-polychord-defaults-btn' });
    const loadBtn = _createFakeEl('button', { id: 'panel-polychord-load-btn' });
    const sendBtn = _createFakeEl('button', { id: 'panel-polychord-send-btn' });

    mockDoc = {
      getElementById: function(id) {
        if (id === 'panel-poly-chord-enable-box') {return polyChordBox;}
        if (id === 'poly-selected-key-label') {return keyLabel;}
        if (id === 'poly-mapping-summary') {return mappingSummary;}
        if (id === 'panel-polychord-defaults-btn') {return resetBtn;}
        if (id === 'panel-polychord-load-btn') {return loadBtn;}
        if (id === 'panel-polychord-send-btn') {return sendBtn;}
        return null;
      },
      addEventListener: vi.fn(),
    };

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { POLY_CHORD: _makeTemplatePolyChord() },
      bindPanelChordAndPolyCommon: function() {},
      _initPolyChordNotes: vi.fn(),
    });
    vi.stubGlobal('document', mockDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets title to "Poly Chord"', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    expect(titleEl.innerText).toBe('Poly Chord');
  });

  it('sets container.innerHTML from PANEL_TEMPLATES.POLY_CHORD', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    expect(container.innerHTML).toContain('poly-chord-enable-box');
  });

  it('calls _initPolyChordNotes', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    expect(window._initPolyChordNotes).toHaveBeenCalled();
  });

  it('calls requestMidiDump for polychord', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    expect(_bridge.requestMidiDump).toHaveBeenCalledWith('polychord');
  });

  it('poly-chord-box not active when cache is 0', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    expect(polyChordBox.classList.contains('active')).toBe(false);
  });

  it('poly-chord-box active when cache > 0.5', () => {
    _bridge.parameterCache['poly_chord_enable'] = 1.0;
    bindPanelPolyChordControls(container, state, titleEl);
    expect(polyChordBox.classList.contains('active')).toBe(true);
  });

  it('clicking poly-chord-box enables poly_chord and disables chord', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    polyChordBox._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('poly_chord_enable', 1.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('poly_chord_enable', 1.0);
    // Should disable chord when enabling poly_chord
    expect(_bridge.setParameter).toHaveBeenCalledWith('chord_enable', 0.0);
    expect(_bridge.handleParameterChangeFromBackend).toHaveBeenCalledWith('chord_enable', 0.0);
  });

  it('clicking active poly-chord-box disables poly_chord', () => {
    _bridge.parameterCache['poly_chord_enable'] = 1.0;
    bindPanelPolyChordControls(container, state, titleEl);
    polyChordBox.classList.add('active');
    polyChordBox._listeners['click'][0]();
    expect(_bridge.setParameter).toHaveBeenCalledWith('poly_chord_enable', 0.0);
    // chord_enable should NOT be set when disabling poly_chord
    expect(_bridge.setParameter).not.toHaveBeenCalledWith('chord_enable', expect.anything());
  });

  // ── Poly key select rows ──

  it('registers click on poly-key-select-rows', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    const rows = container._selectorAll['.poly-key-select-row'];
    rows.forEach(function(r) {
      expect(r._listeners['click']).toBeDefined();
    });
  });

  it('clicking poly-key-select-row updates key label', () => {
    _bridge.parameterCache['poly_chord_map'] = [{ rootKey: 0, chordType: 0 }];
    bindPanelPolyChordControls(container, state, titleEl);
    const rows = container._selectorAll['.poly-key-select-row'];
    rows[5]._listeners['click'][0]();
    const keyLabel = document.getElementById('poly-selected-key-label');
    expect(keyLabel.textContent).toBe('F'); // noteNames[5] = 'F'
  });

  // ── Poly root rows ──

  it('registers click on poly-root-rows', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    const rows = container._selectorAll['.poly-root-row'];
    rows.forEach(function(r) {
      expect(r._listeners['click']).toBeDefined();
    });
  });

  it('clicking poly-root-row updates poly_chord_map rootKey', () => {
    _bridge.parameterCache['poly_chord_map'] = [{ rootKey: 0, chordType: 1 }];
    bindPanelPolyChordControls(container, state, titleEl);
    const keyRows = container._selectorAll['.poly-key-select-row'];
    keyRows[0]._listeners['click'][0](); // Select key 0
    const rootRows = container._selectorAll['.poly-root-row'];
    rootRows[3]._listeners['click'][0](); // Set rootKey=3
    expect(_bridge.parameterCache['poly_chord_map'][0].rootKey).toBe(3);
  });

  // ── Poly type rows ──

  it('registers click on poly-type-rows', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    const rows = container._selectorAll['.poly-type-row'];
    rows.forEach(function(r) {
      expect(r._listeners['click']).toBeDefined();
    });
  });

  it('clicking poly-type-row updates poly_chord_map chordType', () => {
    _bridge.parameterCache['poly_chord_map'] = [{ rootKey: 0, chordType: 1 }];
    bindPanelPolyChordControls(container, state, titleEl);
    const keyRows = container._selectorAll['.poly-key-select-row'];
    keyRows[0]._listeners['click'][0](); // Select key 0
    const typeRows = container._selectorAll['.poly-type-row'];
    typeRows[2]._listeners['click'][0](); // Set chordType=2
    expect(_bridge.parameterCache['poly_chord_map'][0].chordType).toBe(2);
  });

  // ── Load/Send buttons ──

  it('registers click on load-btn', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    const btn = document.getElementById('panel-polychord-load-btn');
    expect(btn._listeners['click']).toBeDefined();
  });

  it('clicking load-btn calls requestMidiDump', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    const btn = document.getElementById('panel-polychord-load-btn');
    btn._listeners['click'][0]();
    expect(_bridge.requestMidiDump).toHaveBeenCalledWith('polychord');
  });

  it('clicking send-btn calls sendWebMidiParameter', () => {
    bindPanelPolyChordControls(container, state, titleEl);
    const btn = document.getElementById('panel-polychord-send-btn');
    btn._listeners['click'][0]();
    expect(_bridge.sendWebMidiParameter).toHaveBeenCalledWith('poly_chord_enable', 0.0);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: bindPanelSeqControls
// ══════════════════════════════════════════════════════════════════

describe('bindPanelSeqControls', () => {
  let container, state, titleEl, mockDoc, seqBox, clockSel, lenSel, klSel, skipBtn, openModalBtn, backdrop, stepsContainer, lcdEl;

  beforeEach(() => {
    container = _createFakeEl('div');
    titleEl = _createFakeEl('h3', { id: 'panel-title' });
    state = {};
    _bridge = _makeBridge({
      'seq_key_loop': 0.0,
      'seq_enable': 0.0,
      'seq_clock': 0.0,
      'seq_length': 0.0,
    });

    lcdEl = _createFakeEl('div', { id: 'lcd-text' });
    seqBox = _createFakeEl('div', { id: 'panel-seq-enable-box' });
    openModalBtn = _createFakeEl('button', { id: 'panel-seq-open-modal-btn' });
    backdrop = _createFakeEl('div', { id: 'seq-modal-backdrop' });
    clockSel = _createFakeEl('select', { id: 'panel-seq-clock-select' });
    clockSel.options = [];
    for (let ci = 0; ci < 16; ci++) {clockSel.options.push(_createFakeEl('option'));}
    lenSel = _createFakeEl('select', { id: 'panel-seq-length-select' });
    lenSel.options = [];
    for (let li = 0; li < 32; li++) {lenSel.options.push(_createFakeEl('option'));}
    klSel = _createFakeEl('select', { id: 'panel-seq-keyloop-select' });
    klSel.options = [];
    for (let ki = 0; ki < 3; ki++) {klSel.options.push(_createFakeEl('option'));}
    skipBtn = _createFakeEl('button', { id: 'panel-seq-skip-btn' });
    stepsContainer = _createFakeEl('div', { id: 'panel-seq-steps-container' });
    stepsContainer.appendChild = vi.fn(function(child) {
      this._children = this._children || [];
      this._children.push(child);
    });

    // Simulate the structure that bindPanelSeqControls creates
    stepsContainer.children = [];
    stepsContainer.innerHTML = '';

    mockDoc = {
      getElementById: function(id) {
        if (id === 'panel-seq-enable-box') {return seqBox;}
        if (id === 'panel-seq-open-modal-btn') {return openModalBtn;}
        if (id === 'seq-modal-backdrop') {return backdrop;}
        if (id === 'panel-seq-clock-select') {return clockSel;}
        if (id === 'panel-seq-length-select') {return lenSel;}
        if (id === 'panel-seq-keyloop-select') {return klSel;}
        if (id === 'panel-seq-skip-btn') {return skipBtn;}
        if (id === 'panel-seq-steps-container') {return stepsContainer;}
        if (id === 'lcd-text') {return lcdEl;}
        return null;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      createElement: function(tag) {
        const el = _createFakeEl(tag);
        el.appendChild = function(child) {
          this._children = this._children || [];
          this._children.push(child);
        };
        el.querySelector = function(sel) {
          if (sel === '.panel-seq-fill') {return this.__fillBar || null;}
          if (sel === '.panel-seq-skip') {return this.__skipBadge || null;}
          if (sel === '.panel-seq-num') {return this.__numLabel || null;}
          return this._subElements[sel] || null;
        };
        el.__fillBar = null;
        el.__skipBadge = null;
        el.__numLabel = null;
        return el;
      },
    };

    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { SEQ: function() { return '<div id="panel-seq-steps-container"></div>'; } },
      _seqSimMode: false,
      _panelSeqValues: [],
      _panelSeqRaw: [],
      _panelLastSeqStep: 0,
      _updatePanelStepVisual: vi.fn(),
      setLcdParamDisplayTimer: vi.fn(),
    });
    vi.stubGlobal('document', mockDoc);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Title ──

  it('sets title to "Control Sequencer"', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(titleEl.innerHTML).toContain('Control Sequencer');
  });

  it('sets title with FREE badge when seq_key_loop=0', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(titleEl.innerHTML).toContain('FREE');
  });

  it('sets title with KEY badge when seq_key_loop=0.5', () => {
    _bridge.parameterCache['seq_key_loop'] = 0.5;
    bindPanelSeqControls(container, state, titleEl);
    expect(titleEl.innerHTML).toContain('KEY');
  });

  it('sets title with LOOP badge when seq_key_loop=1.0', () => {
    _bridge.parameterCache['seq_key_loop'] = 1.0;
    bindPanelSeqControls(container, state, titleEl);
    expect(titleEl.innerHTML).toContain('LOOP');
  });

  it('includes SIM badge when _seqSimMode is true', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      PANEL_TEMPLATES: { SEQ: function() { return '<div id="panel-seq-steps-container"></div>'; } },
      _seqSimMode: true,
      _panelSeqValues: [],
      _panelSeqRaw: [],
      setLcdParamDisplayTimer: vi.fn(),
    });
    bindPanelSeqControls(container, state, titleEl);
    expect(titleEl.innerHTML).toContain('\u26A1SIM');
  });

  // ── innerHTML ──

  it('sets container.innerHTML from PANEL_TEMPLATES.SEQ', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(container.innerHTML).toContain('panel-seq-steps-container');
  });

  // ── window._panelSeqValues / _panelSeqRaw initialization ──

  it('initializes _panelSeqValues as 32 zeros', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(window._panelSeqValues.length).toBe(32);
    expect(window._panelSeqValues.every(function(v) { return v === 0; })).toBe(true);
  });

  it('initializes _panelSeqRaw as 32 values of 128', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(window._panelSeqRaw.length).toBe(32);
    expect(window._panelSeqRaw.every(function(v) { return v === 128; })).toBe(true);
  });

  // ── _updatePanelStepVisual as window function ──

  it('sets _updatePanelStepVisual on window', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(typeof window._updatePanelStepVisual).toBe('function');
  });

  // ── Seq enable box ──

  it('registers click on seq-enable-box', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(seqBox._listeners['click']).toBeDefined();
  });

  it('seq-enable-box not active when cache is 0', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(seqBox.classList.contains('active')).toBe(false);
  });

  it('seq-enable-box active when cache > 0.5', () => {
    _bridge.parameterCache['seq_enable'] = 1.0;
    bindPanelSeqControls(container, state, titleEl);
    expect(seqBox.classList.contains('active')).toBe(true);
  });

  it('clicking seq-enable-box toggles seq_enable', () => {
    bindPanelSeqControls(container, state, titleEl);
    seqBox._listeners['click'][0].call(seqBox);
    expect(_bridge.setParameter).toHaveBeenCalledWith('seq_enable', 1.0);
  });

  it('clicking active seq-enable-box disables seq_enable', () => {
    _bridge.parameterCache['seq_enable'] = 1.0;
    bindPanelSeqControls(container, state, titleEl);
    seqBox.classList.add('active');
    seqBox._listeners['click'][0].call(seqBox);
    expect(_bridge.setParameter).toHaveBeenCalledWith('seq_enable', 0.0);
  });

  // ── Open modal button ──

  it('registers click on open-modal-btn', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(openModalBtn._listeners['click']).toBeDefined();
  });

  it('clicking open-modal-btn shows backdrop', () => {
    bindPanelSeqControls(container, state, titleEl);
    openModalBtn._listeners['click'][0]();
    expect(backdrop.style.display).toBe('flex');
  });

  it('clicking open-modal-btn works when backdrop is missing', () => {
    // Remove backdrop from mock document
    const origGet = mockDoc.getElementById.bind(mockDoc);
    mockDoc.getElementById = function(id) {
      if (id === 'seq-modal-backdrop') {return null;}
      return origGet(id);
    };
    bindPanelSeqControls(container, state, titleEl);
    openModalBtn._listeners['click'][0]();
    expect(true).toBe(true); // Should not throw
  });

  // ── Clock select ──

  it('registers change on clock-select', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(clockSel._listeners['change']).toBeDefined();
  });

  it('change on clock-select calls setParameter', () => {
    bindPanelSeqControls(container, state, titleEl);
    clockSel.value = '5';
    clockSel._listeners['change'][0].call(clockSel);
    expect(_bridge.setParameter).toHaveBeenCalledWith('seq_clock', 5.0 / 15.0);
  });

  // ── Length select ──

  it('registers change on length-select', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(lenSel._listeners['change']).toBeDefined();
  });

  it('change on length-select calls setParameter', () => {
    bindPanelSeqControls(container, state, titleEl);
    lenSel.value = '10';
    lenSel._listeners['change'][0].call(lenSel);
    expect(_bridge.setParameter).toHaveBeenCalledWith('seq_length', 10.0 / 31.0);
  });

  it('change on length-select calls _updatePanelStepVisual for all steps', () => {
    bindPanelSeqControls(container, state, titleEl);
    let callCount = 0;
    const origFn = window._updatePanelStepVisual;
    window._updatePanelStepVisual = function() { callCount++; };
    lenSel.value = '5';
    lenSel._listeners['change'][0].call(lenSel);
    expect(callCount).toBe(32);
    window._updatePanelStepVisual = origFn;
  });

  // ── Key loop select ──

  it('registers change on keyloop-select', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(klSel._listeners['change']).toBeDefined();
  });

  it('change on keyloop-select calls setParameter', () => {
    bindPanelSeqControls(container, state, titleEl);
    klSel.value = '1';
    klSel._listeners['change'][0].call(klSel);
    expect(_bridge.setParameter).toHaveBeenCalledWith('seq_key_loop', 1.0 / 2.0);
  });

  it('change on keyloop-select updates title badge', () => {
    bindPanelSeqControls(container, state, titleEl);
    // The handler reads cache AFTER setParameter, but since setParameter is a mock
    // that doesn't update cache, we update cache before to simulate the state
    _bridge.parameterCache['seq_key_loop'] = 1.0;
    klSel.value = '2';
    klSel._listeners['change'][0].call(klSel);
    expect(titleEl.innerHTML).toContain('LOOP');
  });

  // ── Skip button ──

  it('registers click on skip-btn', () => {
    bindPanelSeqControls(container, state, titleEl);
    expect(skipBtn._listeners['click']).toBeDefined();
  });

  it('skip-btn toggles raw value between 128 and 0', () => {
    bindPanelSeqControls(container, state, titleEl);
    // Ensure _panelLastSeqStep set and stepsContainer can be queried
    window._panelLastSeqStep = 0;
    // Default: raw[0]=128
    skipBtn._listeners['click'][0]();
    expect(window._panelSeqRaw[0]).toBe(0);
    expect(window._panelSeqValues[0]).toBe(-128);
    expect(_bridge.setParameter).toHaveBeenCalledWith('seq_step_1', 0.0);

    // Click again to toggle back
    skipBtn._listeners['click'][0]();
    expect(window._panelSeqRaw[0]).toBe(128);
    expect(window._panelSeqValues[0]).toBe(0);
    expect(_bridge.setParameter).toHaveBeenCalledWith('seq_step_1', 0.5);
  });

  // ── _syncPanelSeqFromCache (called on bind) ──

  it('syncs panel seq values from cache on bind', () => {
    // _syncPanelSeqFromCache is called during bind and calls _updatePanelStepVisual
    // which accesses stepsContainer.children. Our mock stepsContainer needs children defined.
    // Make _updatePanelStepVisual a no-op to avoid DOM access
    _bridge.parameterCache['seq_step_1'] = 0.0;
    _bridge.parameterCache['seq_step_2'] = 0.5;
    _bridge.parameterCache['seq_step_3'] = 1.0;
    bindPanelSeqControls(container, state, titleEl);
    // seq_step_1: raw=0, val=0 (raw===0 → val=0)
    expect(window._panelSeqRaw[0]).toBe(0);
    expect(window._panelSeqValues[0]).toBe(0);
    // seq_step_2: raw=128, val=0 (128-128=0)
    expect(window._panelSeqRaw[1]).toBe(128);
    expect(window._panelSeqValues[1]).toBe(0);
    // seq_step_3: raw=255, val=127 (255-128=127)
    expect(window._panelSeqRaw[2]).toBe(255);
    expect(window._panelSeqValues[2]).toBe(127);
  });

  // ── No-bridge edge cases ──

  it('sets plain title when bridge is null', () => {
    vi.stubGlobal('window', {
      dualMidiBridge: null,
      PANEL_TEMPLATES: { SEQ: function() { return '<div id="panel-seq-steps-container"></div>'; } },
      _seqSimMode: false,
      _panelSeqValues: [],
      _panelSeqRaw: [],
      setLcdParamDisplayTimer: vi.fn(),
    });
    bindPanelSeqControls(container, state, titleEl);
    expect(titleEl.innerHTML).toBe('Control Sequencer');
  });

  it('does not crash when all DOM elements are missing', () => {
    mockDoc.getElementById = function() { return null; };
    expect(function() { bindPanelSeqControls(container, state, titleEl); }).not.toThrow();
  });
});
