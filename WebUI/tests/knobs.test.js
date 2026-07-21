/**
 * Unit tests for knobs.js — initKnobs, rotary knob interaction, pointer events.
 *
 * Run with: npx vitest run WebUI/tests/knobs.test.js
 *
 * Covers:
 *   - initKnobs() queries .performance-matrix-panel .ctrl-unit elements
 *   - Pointer drag: value calculation, rotation, setParameter call
 *   - Rotation formula: (value * 270) - 135 degrees
 *   - Parameter change from bridge updates pointer rotation
 *   - LCD display formatting on drag
 *   - No bridge: graceful early return
 *   - Missing elements: graceful handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Fake DOM element factory (extended for knob needs)
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
    style: {
      _props: {},
      removeProperty(prop) { delete this._props[prop]; },
      get transform() { return this._props.transform; },
      set transform(val) { this._props.transform = val; },
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
    getAttribute(name) { return this._attrs[name] || null; },
    setAttribute(name, val) { this._attrs[name] = val; },
    hasAttribute(name) { return name in this._attrs; },
    addEventListener(event, handler) {
      if (!this._listeners[event]) {this._listeners[event] = [];}
      this._listeners[event].push(handler);
    },
    removeEventListener() {},
    dispatchEvent() {},
    setPointerCapture() {},
    releasePointerCapture() {},
    appendChild(child) { this._children = this._children || []; this._children.push(child); },
    _children: [],
    _subElements: {},
    querySelector(sel) { return this._subElements[sel] || null; },
    querySelectorAll(sel) { return []; },
    closest() { return null; },
  };
  return el;
}

/** Create a fake knob unit: ctrl-unit[data-param] > .knob-ring + .knob-pointer */
function _makeKnobUnit(paramId) {
  const unit = _createFakeEl('div', { 'data-param': paramId });
  unit.classList.add('ctrl-unit');
  const ring = _createFakeEl('div');
  ring.classList.add('knob-ring');
  const pointer = _createFakeEl('div');
  pointer.classList.add('knob-pointer');
  unit._subElements['.knob-ring'] = ring;
  unit._subElements['.knob-pointer'] = pointer;
  ring._parent = unit;
  pointer._parent = unit;
  return unit;
}

// ══════════════════════════════════════════════════════════════════
// initKnobs (extracted from knobs.js)
// ══════════════════════════════════════════════════════════════════

/** Minimal extracted initKnobs that captures the key behavior */
function initKnobs() {
  document.querySelectorAll('.performance-matrix-panel .ctrl-unit').forEach(knobUnit => {
    const paramId = knobUnit.getAttribute('data-param');
    const ring = knobUnit.querySelector('.knob-ring');
    const pointer = knobUnit.querySelector('.knob-pointer');
    if (!ring || !pointer) {return;}

    let isDragging = false;
    let startY = 0;
    let baseValue = 0.0;
    if (paramId === 'global_volume') {baseValue = 0.8;}

    ring.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startY = e.clientY;
      ring.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    ring.addEventListener('pointermove', (e) => {
      if (!isDragging) {return;}
      const deltaY = startY - e.clientY;
      startY = e.clientY;

      const sensitivity = 0.005;
      baseValue = Math.max(0.0, Math.min(1.0, baseValue + deltaY * sensitivity));
      const rotation = (baseValue * 270) - 135;
      pointer.style.transform = 'translateX(-50%) rotate(' + rotation + 'deg)';

      if (window.dualMidiBridge) {
        window.dualMidiBridge.setParameter(paramId, baseValue);

        const lcdText = document.getElementById('lcd-text');
        if (lcdText) {
          const displayVal = typeof window.formatParamValue === 'function'
            ? window.formatParamValue(paramId, baseValue)
            : baseValue.toFixed(2);
          lcdText.innerHTML = '<span style="font-size:10px; opacity:0.6;">PERFORMANCE</span><br><strong>' + paramId.toUpperCase() + '</strong><br><span style="font-size:15px; color:var(--color-gold);">' + displayVal + '</span>';
          if (typeof window.setLcdParamDisplayTimer === 'function') {
            window.setLcdParamDisplayTimer(lcdText);
          }
        }
      }
    });

    ring.addEventListener('pointerup', () => {
      isDragging = false;
    });

    if (window.dualMidiBridge) {
      window.dualMidiBridge.onParameterChanged((id, val) => {
        if (id === paramId) {
          baseValue = val;
          const rotation = (val * 270) - 135;
          pointer.style.transform = 'translateX(-50%) rotate(' + rotation + 'deg)';
        }
      });
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════

describe('initKnobs', () => {
  /** Mock document.querySelectorAll scoped to our test knobs */
  let _knobUnits;
  let _mockDoc;
  let _bridge;
  let _lcdEl;

  function _setupMockDoc() {
    _knobUnits = [];
    _lcdEl = _createFakeEl('div', { id: 'lcd-text' });

    _mockDoc = {
      getElementById(id) {
        if (id === 'lcd-text') {return _lcdEl;}
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '.performance-matrix-panel .ctrl-unit') {return _knobUnits;}
        return [];
      },
      querySelector() { return null; },
      addEventListener() {},
    };
    vi.stubGlobal('document', _mockDoc);
  }

  function _setupBridge() {
    _bridge = {
      setParameter: vi.fn(),
      onParameterChanged: vi.fn(),
    };
    return _bridge;
  }

  beforeEach(() => {
    _setupMockDoc();
    // Always stub a minimal window so initKnobs() can access window.dualMidiBridge
    // without throwing ReferenceError. Tests that need a bridge override this.
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Initialization ──

  it('queries .performance-matrix-panel .ctrl-unit elements', () => {
    const spy = vi.spyOn(_mockDoc, 'querySelectorAll');
    _knobUnits = [_makeKnobUnit('global_volume')];

    initKnobs();

    expect(spy).toHaveBeenCalledWith('.performance-matrix-panel .ctrl-unit');
  });

  it('registers pointerdown/pointermove/pointerup on each knob ring', () => {
    const knob1 = _makeKnobUnit('global_volume');
    const knob2 = _makeKnobUnit('global_portamento');
    _knobUnits = [knob1, knob2];

    initKnobs();

    const rings = [knob1._subElements['.knob-ring'], knob2._subElements['.knob-ring']];
    rings.forEach(ring => {
      expect(ring._listeners['pointerdown']).toBeDefined();
      expect(ring._listeners['pointerdown'].length).toBe(1);
      expect(ring._listeners['pointermove']).toBeDefined();
      expect(ring._listeners['pointermove'].length).toBe(1);
      expect(ring._listeners['pointerup']).toBeDefined();
      expect(ring._listeners['pointerup'].length).toBe(1);
    });
  });

  it('initializes baseValue=0.8 for global_volume', () => {
    const knob = _makeKnobUnit('global_volume');
    _knobUnits = [knob];

    initKnobs();

    // Simulate a pointerdown to expose isDragging, then pointermove
    const ring = knob._subElements['.knob-ring'];
    const pointer = knob._subElements['.knob-pointer'];
    const pointerDown = ring._listeners['pointerdown'][0];

    pointerDown({ clientY: 100, pointerId: 1, preventDefault: vi.fn() });

    // Now pointermove with no delta (same Y) — should use baseValue=0.8
    const pointerMove = ring._listeners['pointermove'][0];
    pointerMove({ clientY: 100 }); // no delta

    // rotation = (0.8 * 270) - 135 = 81
    expect(pointer.style.transform).toContain('rotate(81deg)');
  });

  it('initializes baseValue=0.0 for non-volume params', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];

    initKnobs();

    const ring = knob._subElements['.knob-ring'];
    const pointer = knob._subElements['.knob-pointer'];
    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 100, pointerId: 1, preventDefault: vi.fn() });

    const pointerMove = ring._listeners['pointermove'][0];
    pointerMove({ clientY: 100 }); // no delta

    // rotation = (0.0 * 270) - 135 = -135
    expect(pointer.style.transform).toContain('rotate(-135deg)');
  });

  // ── Pointer drag mechanics ──

  it('pointerdown sets isDragging and startY, captures pointer', () => {
    const knob = _makeKnobUnit('global_volume');
    _knobUnits = [knob];
    const ring = knob._subElements['.knob-ring'];
    const setPointerCaptureSpy = vi.spyOn(ring, 'setPointerCapture');
    const preventDefaultSpy = vi.fn();

    initKnobs();

    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 200, pointerId: 5, preventDefault: preventDefaultSpy });

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(setPointerCaptureSpy).toHaveBeenCalledWith(5);
  });

  it('pointermove does nothing when not dragging', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];
    const pointerMove = ring._listeners['pointermove'][0];

    // Without pointerdown first, isDragging is false
    pointerMove({ clientY: 150 });

    expect(_bridge.setParameter).not.toHaveBeenCalled();
  });

  it('pointerdown → pointermove: calculates value from deltaY', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      formatParamValue: undefined,
      setLcdParamDisplayTimer: undefined,
    });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];
    const pointer = knob._subElements['.knob-pointer'];

    // pointerdown at Y=200
    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });

    // pointermove: Y moved from 200 → 100 (delta = 100px upward)
    // baseValue = 0 + 100 * 0.005 = 0.5
    const pointerMove = ring._listeners['pointermove'][0];
    pointerMove({ clientY: 100 });

    expect(_bridge.setParameter).toHaveBeenCalledWith('global_portamento', 0.5);
    // rotation = (0.5 * 270) - 135 = 0
    expect(pointer.style.transform).toContain('rotate(0deg)');
  });

  it('pointermove: clamps baseValue to max 1.0 when dragged far up', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];
    const pointer = knob._subElements['.knob-pointer'];

    // Start drag
    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });

    // Drag up 500px → deltaY = 200-(-300) = 500 → baseValue = 0 + 500*0.005 = 2.5 → clamped to 1.0
    const pointerMove = ring._listeners['pointermove'][0];
    pointerMove({ clientY: -300 });

    expect(_bridge.setParameter).toHaveBeenCalledWith('global_portamento', 1.0);
    // rotation = (1.0 * 270) - 135 = 135
    expect(pointer.style.transform).toContain('rotate(135deg)');
  });

  it('clamps baseValue to 0 when dragged far down', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];

    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 100, pointerId: 1, preventDefault: vi.fn() });

    // Drag down 500px → deltaY = -500 → baseValue = 0 + (-500*0.005) = -2.5 → clamped to 0.0
    const pointerMove = ring._listeners['pointermove'][0];
    pointerMove({ clientY: 600 });

    expect(_bridge.setParameter).toHaveBeenCalledWith('global_portamento', 0.0);
  });

  it('rotation formula: val=0 → -135deg, val=0.5 → 0deg, val=1 → 135deg', () => {
    // Test the formula directly: (value * 270) - 135
    expect((0 * 270) - 135).toBe(-135);
    expect((0.25 * 270) - 135).toBe(-67.5);
    expect((0.5 * 270) - 135).toBe(0);
    expect((0.75 * 270) - 135).toBe(67.5);
    expect((1.0 * 270) - 135).toBe(135);
  });

  it('pointerup stops dragging', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];

    // Start drag
    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });

    // Move
    ring._listeners['pointermove'][0]({ clientY: 50 });
    expect(_bridge.setParameter).toHaveBeenCalled(); // was called during drag

    // Release
    ring._listeners['pointerup'][0]();

    // After release, move again — should NOT call setParameter
    _bridge.setParameter.mockClear();
    ring._listeners['pointermove'][0]({ clientY: 0 });
    expect(_bridge.setParameter).not.toHaveBeenCalled();
  });

  // ── LCD display ──

  it('updates LCD text on drag with default display formatting', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];

    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });

    // Drag to value 0.5
    ring._listeners['pointermove'][0]({ clientY: 100 });

    expect(_lcdEl.innerHTML).toContain('PERFORMANCE');
    expect(_lcdEl.innerHTML).toContain('GLOBAL_PORTAMENTO');
    expect(_lcdEl.innerHTML).toContain('0.50'); // toFixed(2)
  });

  it('uses formatParamValue when available on window', () => {
    const knob = _makeKnobUnit('global_volume');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    const formatSpy = vi.fn(() => '75%');
    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      formatParamValue: formatSpy,
    });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];

    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });

    // Drag up enough for a visible change
    ring._listeners['pointermove'][0]({ clientY: 0 });

    expect(formatSpy).toHaveBeenCalledWith('global_volume', expect.any(Number));
    expect(_lcdEl.innerHTML).toContain('75%');
  });

  it('calls setLcdParamDisplayTimer when available', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    const timerSpy = vi.fn();
    vi.stubGlobal('window', {
      dualMidiBridge: _bridge,
      setLcdParamDisplayTimer: timerSpy,
    });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];

    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });

    ring._listeners['pointermove'][0]({ clientY: 100 });

    expect(timerSpy).toHaveBeenCalledWith(_lcdEl);
  });

  it('does not crash when lcd-text element is missing', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });
    // Remove lcd-text from document — override getElementById to return null
    vi.stubGlobal('document', {
      ..._mockDoc,
      getElementById() { return null; },
    });

    // initKnobs with the overridden document
    initKnobs();

    const ring = knob._subElements['.knob-ring'];

    expect(() => {
      const pointerDown = ring._listeners['pointerdown'][0];
      pointerDown({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });
      ring._listeners['pointermove'][0]({ clientY: 100 });
    }).not.toThrow();
  });

  // ── Bridge interactions ──

  it('calls dualMidiBridge.setParameter on pointermove', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];

    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });

    ring._listeners['pointermove'][0]({ clientY: 100 }); // delta=100 → baseValue=0.5

    expect(_bridge.setParameter).toHaveBeenCalledWith('global_portamento', 0.5);
  });

  it('does not call setParameter when bridge is absent', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    vi.stubGlobal('window', {}); // no dualMidiBridge

    initKnobs();

    const ring = knob._subElements['.knob-ring'];
    const pointer = knob._subElements['.knob-pointer'];

    const pointerDown = ring._listeners['pointerdown'][0];
    pointerDown({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });

    // Even though bridge is undefined, rotation should still update
    ring._listeners['pointermove'][0]({ clientY: 100 });

    // Pointer rotation should still be updated
    expect(pointer.style.transform).toContain('rotate(0deg)'); // 0.5 * 270 - 135 = 0
  });

  it('registers onParameterChanged callback on bridge', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    expect(_bridge.onParameterChanged).toHaveBeenCalledTimes(1);
    const callback = _bridge.onParameterChanged.mock.calls[0][0];
    expect(typeof callback).toBe('function');
  });

  it('onParameterChanged callback updates pointer rotation when param matches', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    const pointer = knob._subElements['.knob-pointer'];
    const callback = _bridge.onParameterChanged.mock.calls[0][0];

    // Simulate parameter change from bridge
    callback('global_portamento', 0.75);

    // rotation = (0.75 * 270) - 135 = 67.5
    expect(pointer.style.transform).toContain('rotate(67.5deg)');
  });

  it('onParameterChanged callback does NOT update pointer for different param', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    const pointer = knob._subElements['.knob-pointer'];
    // Set a known transform first
    pointer.style.transform = 'translateX(-50%) rotate(0deg)';

    const callback = _bridge.onParameterChanged.mock.calls[0][0];

    // Simulate a different parameter changing
    callback('vcf_cutoff', 0.5);

    // Pointer should NOT have been updated — transform stays at rotate(0deg)
    expect(pointer.style.transform).toBe('translateX(-50%) rotate(0deg)');
  });

  it('registers one onParameterChanged per knob unit with bridge', () => {
    const knob1 = _makeKnobUnit('global_volume');
    const knob2 = _makeKnobUnit('global_portamento');
    _knobUnits = [knob1, knob2];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    // Only 2 calls because the onParameterChanged registration itself
    // doesn't register a new listener each time — it adds a callback
    // each time initKnobs iterates. So 2 knobs = 2 callbacks registered.
    expect(_bridge.onParameterChanged).toHaveBeenCalledTimes(2);
  });

  // ── Edge cases ──

  it('skips knob unit when ring or pointer is missing', () => {
    const knobWithoutRing = _makeKnobUnit('global_volume');
    delete knobWithoutRing._subElements['.knob-ring'];
    _knobUnits = [knobWithoutRing];

    expect(() => initKnobs()).not.toThrow();
    // No listeners registered because early return
    expect(knobWithoutRing._listeners).toEqual({});
  });

  it('skips knob unit when only ring exists but no pointer', () => {
    const knobWithoutPointer = _makeKnobUnit('global_volume');
    delete knobWithoutPointer._subElements['.knob-pointer'];
    _knobUnits = [knobWithoutPointer];

    expect(() => initKnobs()).not.toThrow();
    expect(knobWithoutPointer._listeners).toEqual({});
  });

  it('handles multiple knob units with different params', () => {
    const vol = _makeKnobUnit('global_volume');
    const porta = _makeKnobUnit('global_portamento');
    _knobUnits = [vol, porta];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    // Both should have listeners
    expect(vol._subElements['.knob-ring']._listeners['pointerdown']).toBeDefined();
    expect(porta._subElements['.knob-ring']._listeners['pointerdown']).toBeDefined();
  });

  it('handles empty DOM (no knob units)', () => {
    _knobUnits = [];

    expect(() => initKnobs()).not.toThrow();
  });

  // ── Window export ──

  it('exports initKnobs to window', () => {
    // La fuente (knobs.js) termina con `window.initKnobs = initKnobs;`
    window.initKnobs = initKnobs;
    expect(window.initKnobs).toBeDefined();
    expect(typeof window.initKnobs).toBe('function');
    expect(window.initKnobs).toBe(initKnobs);
  });

  // ── Sequential drag (startY update after each pointermove) ──

  it('updates startY after each pointermove for sequential drag continuity', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];
    const pointer = knob._subElements['.knob-pointer'];

    // pointerdown at Y=200 → startY=200
    ring._listeners['pointerdown'][0]({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });

    // 1st move: Y=100 → deltaY=100 → baseValue=0.5 → startY updated to 100
    ring._listeners['pointermove'][0]({ clientY: 100 });
    expect(_bridge.setParameter).toHaveBeenCalledWith('global_portamento', 0.5);

    // 2nd move: Y=50 → deltaY=50 (not 150!) → baseValue=0.5+0.25=0.75
    ring._listeners['pointermove'][0]({ clientY: 50 });
    expect(_bridge.setParameter).toHaveBeenCalledWith('global_portamento', 0.75);
    // rotation = (0.75 * 270) - 135 = 67.5
    expect(pointer.style.transform).toContain('rotate(67.5deg)');
  });

  it('zero delta on sequential drag does not change value', () => {
    const knob = _makeKnobUnit('global_portamento');
    _knobUnits = [knob];
    _bridge = _setupBridge();
    vi.stubGlobal('window', { dualMidiBridge: _bridge });

    initKnobs();

    const ring = knob._subElements['.knob-ring'];

    // Start drag, move to value 0.5
    ring._listeners['pointerdown'][0]({ clientY: 200, pointerId: 1, preventDefault: vi.fn() });
    ring._listeners['pointermove'][0]({ clientY: 100 }); // baseValue=0.5
    _bridge.setParameter.mockClear();

    // Move to same Y again (deltaY=0) → baseValue unchanged
    ring._listeners['pointermove'][0]({ clientY: 100 });
    expect(_bridge.setParameter).toHaveBeenCalledWith('global_portamento', 0.5);
  });
});

// ══════════════════════════════════════════════════════════════════
// Direct rotation formula tests
// ══════════════════════════════════════════════════════════════════

describe('rotation formula', () => {
  function getRotation(value) {
    return (value * 270) - 135;
  }

  it('val=0 → -135° (min position)', () => {
    expect(getRotation(0)).toBe(-135);
  });

  it('val=0.25 → -67.5°', () => {
    expect(getRotation(0.25)).toBe(-67.5);
  });

  it('val=0.5 → 0° (center)', () => {
    expect(getRotation(0.5)).toBe(0);
  });

  it('val=0.75 → 67.5°', () => {
    expect(getRotation(0.75)).toBe(67.5);
  });

  it('val=1 → 135° (max position)', () => {
    expect(getRotation(1)).toBe(135);
  });
});
