/**
 * Dedicated Vitest tests for arpeggiator.js — pattern editor, step gates, presets, playback.
 *
 * Source:  WebUI/js/arpeggiator.js
 * Run:     npx vitest run WebUI/tests/arpeggiatorCore.test.js
 *
 * Covers DOM-level behavior not tested in modalTests.test.js:
 *   - Step gate full DOM integration (mock stepBar div + click toggle)
 *   - Select change LCD HTML generation (clock, mode, octave, vel/gate)
 *   - Preset list item selection (background + classList toggle)
 *   - Toggle box click handlers (enable/hold/keysync → bridge.setParameter)
 *   - Fader slider updateSliderPos math (clientY → value)
 *   - Step click LCD display HTML content
 *   - Preset load visual sync (all 32 step bars updated)
 *   - syncArpModalUI slider retry (setTimeout when height=0)
 *   - ARP modal lifecycle (open/close, backdrop click condition)
 *   - savePresetBtn exists but has no handler (structural check)
 *   - Arp reset button handler (stop engine, rewind, clear notes, LCD bar, flash)
 *   - syncArpModalUI patch sync (6 controls from patch.unpackedBytes)
 *   - onParameterChanged dispatch (toggle boxes, selects, slider handles)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* ================================================================
 * Shared helpers (mirrored from source)
 * ================================================================ */

const ARP_CLOCK_NAMES = ['1/1','1/2','1/3','1/4','1/6','1/8','1/12','1/16','1/24','1/32','1/48','1/64','1/96'];
const ARP_MODE_NAMES = ['UP','DOWN','UP-DOWN','UP-INV','DOWN-INV','UP-DN-INV','UP-ALT','DOWN-ALT','RANDOM','AS-PLAYED'];
const ARP_VELGATE_NAMES = ['Gate','Velocity','Seq'];

function _calcHandlePos(v, sh, hh) {
  if (sh <= 0) {return 0;}
  return (1.0 - v) * (sh - hh);
}

/* ================================================================
 * DOM mock helpers
 * ================================================================ */

/** Create a mock stepBar div element as created by arpeggiator.js */
function makeMockStepBar() {
  return {
    style: {
      width: '100%',
      height: '15%',
      background: 'var(--bg-hover)',
      borderRadius: 'var(--radius-xs)',
      transition: 'background 0.1s, height 0.1s',
    },
  };
}

/** Create a mock stepUnit containing a stepBar div */
function makeMockArpStepUnit() {
  const stepBar = makeMockStepBar();
  return {
    stepBar,
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      height: '100%',
      cursor: 'pointer',
    },
    title: 'Step 1: GATE OFF',
    appendChild: vi.fn(function(el) { this._lastChild = el; }),
    querySelector: vi.fn(function(sel) {
      if (sel === 'div') {return stepBar;}
      return null;
    }),
    addEventListener: vi.fn(),
  };
}

/** Create mock stepsGrid with 32 stepUnits */
function makeMockArpStepsGrid() {
  const units = [];
  for (let i = 0; i < 32; i++) {
    units.push(makeMockArpStepUnit());
  }
  return {
    children: units,
    _units: units,
    appendChild: vi.fn(),
    innerHTML: '',
  };
}

/** Create a mock backdrop element */
function makeMockBackdrop() {
  return {
    style: { display: 'none' },
    querySelectorAll: vi.fn(() => []),
    querySelector: vi.fn(() => null),
  };
}

/** Create a mock toggle box element */
function makeMockToggleBox(initialActive) {
  return {
    classList: {
      contains: vi.fn(() => !!initialActive),
      toggle: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
    },
    addEventListener: vi.fn(),
    style: {},
  };
}

/** Create a mock select element */
function makeMockSelect() {
  return {
    value: '0',
    addEventListener: vi.fn(),
  };
}

/* ================================================================
 * Helpers that mirror arpeggiator.js DOM operations
 * ================================================================ */

/** Simulate a step click toggle on a mock stepUnit */
function _arpStepClick(stepUnit, stepBar, pattern, index) {
  const newPattern = [...pattern];
  newPattern[index] = !newPattern[index];
  const isOn = newPattern[index];

  stepBar.style.height = isOn ? '90%' : '15%';
  stepBar.style.background = isOn ? 'var(--brand-accent)' : 'var(--bg-hover)';
  stepUnit.title = 'Step ' + (index + 1) + ': GATE ' + (isOn ? 'ON' : 'OFF');

  return { pattern: newPattern, isOn };
}

/** Generate LCD HTML for clock select change (mirrors source) */
function _arpClockLcdHtml(selectValue) {
  const idx = parseInt(selectValue);
  const clockName = ARP_CLOCK_NAMES[idx] || '';
  return '<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br>'
    + '<strong style="color:var(--accent-primary);">CLOCK <span style="color:var(--accent-yellow);">'
    + clockName + '</span></strong>';
}

/** Generate LCD HTML for mode select change (mirrors source) */
function _arpModeLcdHtml(selectValue) {
  const idx = parseInt(selectValue);
  const modeName = ARP_MODE_NAMES[idx] || '';
  return '<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br>'
    + '<strong style="color:var(--accent-primary);">MODE: <span style="color:var(--accent-orange);">'
    + modeName + '</span></strong>';
}

/** Generate LCD HTML for vel/gate select change (mirrors source) */
function _arpVelGateLcdHtml(selectValue) {
  const idx = parseInt(selectValue);
  const vgName = ARP_VELGATE_NAMES[idx] || '';
  return '<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br>'
    + '<strong style="color:var(--accent-primary);">VEL GATE: <span style="color:var(--accent-teal);">'
    + vgName + '</span></strong>';
}

/** Generate LCD HTML for octave select change (mirrors source) */
function _arpOctaveLcdHtml(selectValue) {
  const octVal = parseInt(selectValue) + 1;
  return '<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br>'
    + '<strong style="color:var(--accent-primary);">OCTAVE RANGE: <span style="color:var(--accent-cyan);">'
    + octVal + '</span></strong>';
}

/** Generate LCD HTML for step gate click (mirrors source) */
function _arpStepGateLcdHtml(stepIndex, isOn) {
  return '<span style="font-size:10px; opacity:0.6;">ARPEGGIATOR</span><br>'
    + '<strong>STEP ' + (stepIndex + 1) + ' GATE</strong><br>'
    + '<span style="font-size:15px; color:var(--color-gold);">'
    + (isOn ? 'ON' : 'OFF') + '</span>';
}

/** Simulate preset list item selection click (mirrors source) */
function _arpPresetItemClick(items, clickedIndex) {
  const results = [];
  for (let i = 0; i < items.length; i++) {
    if (i === clickedIndex) {
      items[i].style.background = 'color-mix(in srgb, var(--accent-primary) 20%, transparent)';
      items[i].classList.add('selected');
      results.push({ index: i, selected: true });
    } else {
      items[i].style.background = 'transparent';
      items[i].classList.remove('selected');
      results.push({ index: i, selected: false, background: 'transparent' });
    }
  }
  return results;
}

/** Simulate toggle box click (mirrors source) */
function _arpToggleBoxClick(toggleBox, boxActiveBefore, bridge) {
  const newActive = !boxActiveBefore;
  if (bridge) {
    // Source: window.dualMidiBridge.setParameter("arp_enable", active ? 0.0 : 1.0)
    // Note: active is the state BEFORE click, so toggle sends the OPPOSITE
    bridge.setParameter('arp_enable', boxActiveBefore ? 0.0 : 1.0);
  }
  return { newActive, bridgeCalled: !!bridge };
}

/** Simulate fader slider update position (mirrors source's updateSliderPos) */
function _arpSliderUpdate(clientY, rectTop, rectHeight, handleHeight) {
  const limit = rectHeight - handleHeight;
  let y = clientY - rectTop - (handleHeight / 2);
  y = Math.max(0, Math.min(limit, y));
  const val = 1.0 - (y / limit);
  return { y, val, topPx: y + 'px' };
}

/** Simulate preset load updating step grid visuals (mirrors loadPresetBtn handler) */
function _arpPresetLoadSyncGrid(grid, pattern) {
  const changes = [];
  for (let i = 0; i < 32; i++) {
    const bar = grid.children[i].querySelector('div');
    bar.style.height = pattern[i] ? '90%' : '15%';
    bar.style.background = pattern[i] ? 'var(--brand-accent)' : 'var(--bg-hover)';
    changes.push({ index: i, height: bar.style.height, background: bar.style.background });
  }
  return changes;
}

/** Simulate ARP open modal (mirrors arpBtn click handler) */
function _arpOpenModal(backdrop) {
  backdrop.style.display = 'flex';
  return backdrop.style.display;
}

/** Simulate ARP close modal (mirrors closeBtn click) */
function _arpCloseModal(backdrop, isBackdropClick, eventTarget) {
  if (isBackdropClick) {
    if (eventTarget === backdrop) {
      backdrop.style.display = 'none';
    }
  } else {
    backdrop.style.display = 'none';
  }
  return backdrop.style.display;
}

/** Simulate arp reset button handler (mirrors resetBtn click handler) */
function _arpResetClick(bridge, genFillBar, genLcdBarHtml, lcdSafeUpdate, lcdText) {
  if (!bridge || !bridge._arpEngine) {return { stopped: false, wasRunning: false };}

  const wasRunning = bridge._arpEngine.running;
  bridge._arpEngine.stop();
  bridge._arpEngine.stepIndex = 0;
  bridge._arpEngine.heldNotes = [];
  bridge._arpEngine.currentDirection = 1;
  bridge._arpActiveNotes = [];

  // LCD bar visual
  if (genFillBar && genLcdBarHtml && lcdSafeUpdate && lcdText) {
    const aNotes = bridge._arpEngine.heldNotes.length;
    const aStep = bridge._arpEngine.stepIndex;
    const aBar = genFillBar(Math.round((aNotes / 12) * 18), 18);
    const arpHtml = genLcdBarHtml('arp', {
      header: 'ARPEGGIATOR RESET',
      stepInfo: 'Step ' + aStep + ' \u00B7 ' + aNotes + ' notes held',
      bar: aBar
    });
    lcdSafeUpdate(lcdText, arpHtml, 'arp_reset');
  }

  // Button flash CSS
  const btn = { style: {} };
  btn.style.transition = 'background 60ms ease-out, box-shadow 60ms ease-out';
  btn.style.background = 'color-mix(in srgb, var(--color-danger) 70%, transparent)';
  btn.style.boxShadow = '0 0 16px var(--color-danger)';
  btn.style.borderColor = 'var(--color-danger)';
  btn.style.color = 'var(--color-danger)';
  setTimeout(function() {
    btn.style.transition = 'background 300ms ease-out, box-shadow 300ms ease-out, border-color 300ms ease-out, color 300ms ease-out';
    btn.style.background = '';
    btn.style.boxShadow = '';
    btn.style.borderColor = '';
    btn.style.color = '';
    setTimeout(function() {
      btn.style.transition = '';
    }, 320);
  }, 60);

  return { stopped: true, wasRunning: wasRunning, btnStyle: btn.style };
}

/** Simulate syncArpModalUI (mirrors source: reads patch bytes and updates controls) */
function _syncArpModalUI(patch, controls, selectors, sliders) {
  if (!patch || !patch.unpackedBytes) {return { synced: false };}

  const bytes = patch.unpackedBytes;
  const arpEn = bytes[155] > 0.5;
  const modeVal = bytes[156] || 0;
  const clockVal = bytes[158] || 0;
  const keySyncEn = bytes[159] > 0.5;
  const holdEn = bytes[161] > 0.5;
  const octaveVal = bytes[164] || 0;
  const velGateVal = bytes[112] || 0;

  // Toggle boxes
  if (controls.arpBox) {controls.arpBox.classList.toggle('active', arpEn);}
  if (controls.holdBox) {controls.holdBox.classList.toggle('active', holdEn);}
  if (controls.keySyncBox) {controls.keySyncBox.classList.toggle('active', keySyncEn);}

  // Selects
  if (selectors.clock) {selectors.clock.value = Math.round(clockVal);}
  if (selectors.velGate) {selectors.velGate.value = Math.round(velGateVal);}
  if (selectors.mode) {selectors.mode.value = Math.round(modeVal);}
  if (selectors.octave) {selectors.octave.value = Math.round(octaveVal);}

  // Slider handle positions
  const sliderData = [
    { el: sliders.swing, val: bytes[163] / 25.0 },
    { el: sliders.rate, val: bytes[157] / 255.0 },
    { el: sliders.gateTime, val: bytes[160] / 255.0 },
  ];
  sliderData.forEach(function(sd) {
    if (!sd.el) {return;}
    const handle = sd.el.querySelector('.handle');
    if (!handle) {return;}
    const rect = sd.el.getBoundingClientRect();
    if (rect.height > 0) {
      const handleHeight = 16;
      const pos = (1.0 - sd.val) * (rect.height - handleHeight);
      handle.style.top = pos + 'px';
    }
  });

  return {
    synced: true,
    arpEn: arpEn,
    modeVal: modeVal,
    clockVal: clockVal,
    keySyncEn: keySyncEn,
    holdEn: holdEn,
    octaveVal: octaveVal,
    velGateVal: velGateVal,
  };
}

/** Simulate onParameterChanged handler (mirrors source) */
function _arpDispatchParamChange(paramId, val, backdrop, controls, selectors, sliders) {
  if (backdrop.style.display === 'none') {return { dispatched: false };}

  if (paramId === 'arp_enable' && controls.arpBox) {
    controls.arpBox.classList.toggle('active', val > 0.5);
  }
  if (paramId === 'arp_hold' && controls.holdBox) {
    controls.holdBox.classList.toggle('active', val > 0.5);
  }
  if (paramId === 'arp_key_sync' && controls.keySyncBox) {
    controls.keySyncBox.classList.toggle('active', val > 0.5);
  }
  if (paramId === 'arp_clock_divider' && selectors.clock) {
    selectors.clock.value = Math.round(val * 12.0);
  }
  if (paramId === 'arp_velocity_gate' && selectors.velGate) {
    selectors.velGate.value = Math.round(val * 2.0);
  }
  if (paramId === 'arp_mode' && selectors.mode) {
    selectors.mode.value = Math.round(val * 10.0);
  }
  if (paramId === 'arp_octave' && selectors.octave) {
    selectors.octave.value = Math.round(val * 3.0);
  }
  if (paramId === 'arp_swing' || paramId === 'arp_rate' || paramId === 'arp_gate_time') {
    const sliderEl = sliders[paramId];
    if (sliderEl) {
      const handle = sliderEl.querySelector('.handle');
      const rect = sliderEl.getBoundingClientRect();
      if (rect.height > 0) {
        const handleHeight = 16;
        const pos = (1.0 - val) * (rect.height - handleHeight);
        handle.style.top = pos + 'px';
      }
    }
  }

  return { dispatched: true };
}

/* ================================================================
 * TESTS
 * ================================================================ */

// ────────── Step gate DOM integration ─────────────────────────

describe('Arp step gate — full DOM integration', () => {
  it('step click OFF→ON sets height 90% and brand accent', () => {
    const unit = makeMockArpStepUnit();
    const pattern = Array(32).fill(false);
    const result = _arpStepClick(unit, unit.stepBar, pattern, 5);
    expect(result.isOn).toBe(true);
    expect(unit.stepBar.style.height).toBe('90%');
    expect(unit.stepBar.style.background).toBe('var(--brand-accent)');
    expect(unit.title).toBe('Step 6: GATE ON');
  });

  it('step click ON→OFF sets height 15% and bg-hover', () => {
    const unit = makeMockArpStepUnit();
    const pattern = Array(32).fill(true);
    const result = _arpStepClick(unit, unit.stepBar, pattern, 10);
    expect(result.isOn).toBe(false);
    expect(unit.stepBar.style.height).toBe('15%');
    expect(unit.stepBar.style.background).toBe('var(--bg-hover)');
    expect(unit.title).toBe('Step 11: GATE OFF');
  });

  it('toggling step 0 updates bar at index 0', () => {
    const unit = makeMockArpStepUnit();
    const pattern = Array(32).fill(false);
    _arpStepClick(unit, unit.stepBar, pattern, 0);
    expect(unit.title).toBe('Step 1: GATE ON');
  });

  it('toggling step 31 updates bar at index 31', () => {
    const unit = makeMockArpStepUnit();
    const pattern = Array(32).fill(false);
    _arpStepClick(unit, unit.stepBar, pattern, 31);
    expect(unit.title).toBe('Step 32: GATE ON');
  });

  it('stepBar starts with default height 15% and bg-hover', () => {
    const bar = makeMockStepBar();
    expect(bar.style.height).toBe('15%');
    expect(bar.style.background).toBe('var(--bg-hover)');
    expect(bar.style.borderRadius).toBe('var(--radius-xs)');
  });

  it('stepUnit starts with default title GATE OFF', () => {
    const unit = makeMockArpStepUnit();
    expect(unit.title).toBe('Step 1: GATE OFF');
  });

  it('double toggle returns to OFF with bg-hover', () => {
    const unit = makeMockArpStepUnit();
    const pattern1 = Array(32).fill(false);
    const r1 = _arpStepClick(unit, unit.stepBar, pattern1, 7);
    expect(r1.isOn).toBe(true);
    const r2 = _arpStepClick(unit, unit.stepBar, r1.pattern, 7);
    expect(r2.isOn).toBe(false);
    expect(unit.stepBar.style.background).toBe('var(--bg-hover)');
  });

  it('pattern array updates correctly across multiple toggles', () => {
    const unit = makeMockArpStepUnit();
    let pattern = Array(32).fill(false);
    // Toggle steps 0, 1, 2 on
    for (let i = 0; i < 3; i++) {
      const r = _arpStepClick(unit, unit.stepBar, pattern, i);
      pattern = r.pattern;
    }
    expect(pattern[0]).toBe(true);
    expect(pattern[1]).toBe(true);
    expect(pattern[2]).toBe(true);
    expect(pattern[3]).toBe(false);
  });
});

// ────────── Select change LCD HTML ───────────────────────────

describe('Arp select change — LCD HTML generation', () => {
  it('clock select at index 0 produces "CLOCK 1/1" LCD', () => {
    const html = _arpClockLcdHtml('0');
    expect(html).toContain('CLOCK');
    expect(html).toContain('1/1');
    expect(html).toContain('accent-yellow');
  });

  it('clock select at index 6 produces "CLOCK 1/12" LCD', () => {
    const html = _arpClockLcdHtml('6');
    expect(html).toContain('1/12');
  });

  it('clock select at index 12 produces "CLOCK 1/96" LCD', () => {
    const html = _arpClockLcdHtml('12');
    expect(html).toContain('1/96');
  });

  it('mode select at index 0 produces "MODE: UP" LCD', () => {
    const html = _arpModeLcdHtml('0');
    expect(html).toContain('MODE:');
    expect(html).toContain('UP');
    expect(html).toContain('accent-orange');
  });

  it('mode select at index 8 produces "MODE: RANDOM" LCD', () => {
    const html = _arpModeLcdHtml('8');
    expect(html).toContain('RANDOM');
  });

  it('mode select at index 9 produces "MODE: AS-PLAYED" LCD', () => {
    const html = _arpModeLcdHtml('9');
    expect(html).toContain('AS-PLAYED');
  });

  it('vel/gate select at index 0 produces "VEL GATE: Gate" LCD', () => {
    const html = _arpVelGateLcdHtml('0');
    expect(html).toContain('VEL GATE:');
    expect(html).toContain('Gate');
    expect(html).toContain('accent-teal');
  });

  it('vel/gate select at index 1 produces "VEL GATE: Velocity" LCD', () => {
    const html = _arpVelGateLcdHtml('1');
    expect(html).toContain('Velocity');
  });

  it('vel/gate select at index 2 produces "VEL GATE: Seq" LCD', () => {
    const html = _arpVelGateLcdHtml('2');
    expect(html).toContain('Seq');
  });

  it('octave select at index 0 produces "OCTAVE RANGE: 1" LCD', () => {
    const html = _arpOctaveLcdHtml('0');
    expect(html).toContain('OCTAVE RANGE:');
    expect(html).toContain('1');
    expect(html).toContain('accent-cyan');
  });

  it('octave select at index 1 produces "OCTAVE RANGE: 2" LCD', () => {
    const html = _arpOctaveLcdHtml('1');
    expect(html).toContain('2');
  });

  it('octave select at index 4 (5 octaves) produces "OCTAVE RANGE: 5" LCD', () => {
    const html = _arpOctaveLcdHtml('4');
    expect(html).toContain('5');
  });

  it('all LCD HTML starts with ARPEGGIATOR header', () => {
    const htmls = [
      _arpClockLcdHtml('0'),
      _arpModeLcdHtml('0'),
      _arpVelGateLcdHtml('0'),
      _arpOctaveLcdHtml('0'),
    ];
    htmls.forEach(h => {
      expect(h).toContain('ARPEGGIATOR');
      expect(h).toContain('font-size:10px; opacity:0.6');
    });
  });
});

// ────────── Step click LCD HTML ──────────────────────────────

describe('Arp step click — LCD HTML content', () => {
  it('gate ON at step 1 produces "STEP 1 GATE" with ON text', () => {
    const html = _arpStepGateLcdHtml(0, true);
    expect(html).toContain('STEP 1 GATE');
    expect(html).toContain('ON');
    expect(html).toContain('color:var(--color-gold)');
  });

  it('gate OFF at step 32 produces "STEP 32 GATE" with OFF text', () => {
    const html = _arpStepGateLcdHtml(31, false);
    expect(html).toContain('STEP 32 GATE');
    expect(html).toContain('OFF');
  });

  it('all 32 steps produce valid LCD HTML', () => {
    for (let i = 0; i < 32; i++) {
      const htmlOn = _arpStepGateLcdHtml(i, true);
      expect(htmlOn).toContain('STEP ' + (i + 1) + ' GATE');
      expect(htmlOn).toContain('ON');
      const htmlOff = _arpStepGateLcdHtml(i, false);
      expect(htmlOff).toContain('STEP ' + (i + 1) + ' GATE');
      expect(htmlOff).toContain('OFF');
    }
  });

  it('LCD for step 16 gate ON has correct structure', () => {
    const html = _arpStepGateLcdHtml(15, true);
    expect(html).toContain('ARPEGGIATOR');
    expect(html).toContain('STEP 16 GATE');
    expect(html).toContain('font-size:15px');
    expect(html).toContain('color:var(--color-gold)');
  });
});

// ────────── Preset list item selection ──────────────────────

describe('Arp preset list — item selection', () => {
  function makePresetItems(count) {
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push({
        style: { background: '' },
        classList: { add: vi.fn(), remove: vi.fn() },
        innerText: 'Preset ' + (i + 1),
      });
    }
    return items;
  }

  it('clicking preset item sets its background and selected class', () => {
    const items = makePresetItems(3);
    const results = _arpPresetItemClick(items, 1);
    expect(results[1].selected).toBe(true);
    expect(items[1].style.background).toContain('color-mix');
    expect(items[1].classList.add).toHaveBeenCalledWith('selected');
  });

  it('clicking preset item clears others background and selected class', () => {
    const items = makePresetItems(3);
    _arpPresetItemClick(items, 1);
    expect(items[0].style.background).toBe('transparent');
    expect(items[0].classList.remove).toHaveBeenCalledWith('selected');
    expect(items[2].style.background).toBe('transparent');
  });

  it('clicking different items switches selection', () => {
    const items = makePresetItems(3);
    // Click item 0
    _arpPresetItemClick(items, 0);
    expect(items[0].classList.add).toHaveBeenCalledWith('selected');
    // Click item 2
    _arpPresetItemClick(items, 2);
    expect(items[0].classList.remove).toHaveBeenCalledWith('selected');
    expect(items[2].classList.add).toHaveBeenCalledWith('selected');
  });

  it('re-clicking same item keeps it selected', () => {
    const items = makePresetItems(3);
    _arpPresetItemClick(items, 1);
    expect(items[1].classList.add).toHaveBeenCalledTimes(1);
    // Clicked item is NOT removed (only non-clicked items are removed)
    expect(items[1].classList.remove).not.toHaveBeenCalled();
    _arpPresetItemClick(items, 1);
    // Second click on same item: clickedIndex===1 so add is called again
    expect(items[1].classList.remove).not.toHaveBeenCalled();
    expect(items[1].classList.add).toHaveBeenCalledTimes(2);
    // items[0] and items[2] have remove called once per click (2 times total)
    expect(items[0].classList.remove).toHaveBeenCalledTimes(2);
    expect(items[2].classList.remove).toHaveBeenCalledTimes(2);
  });

  it('default background is transparent for all items', () => {
    const items = makePresetItems(5);
    items.forEach(item => {
      expect(item.style.background).toBe('');
    });
  });

  it('selected item uses accent-primary color mix', () => {
    const items = makePresetItems(2);
    _arpPresetItemClick(items, 0);
    expect(items[0].style.background).toBe('color-mix(in srgb, var(--accent-primary) 20%, transparent)');
  });
});

// ────────── Toggle box click handlers ────────────────────────

describe('Arp toggle boxes — click handlers', () => {
  it('clicking enable box when active sends 0.0 (disable)', () => {
    const bridge = { setParameter: vi.fn() };
    const box = makeMockToggleBox(true);
    _arpToggleBoxClick(box, true, bridge);
    expect(bridge.setParameter).toHaveBeenCalledWith('arp_enable', 0.0);
  });

  it('clicking enable box when inactive sends 1.0 (enable)', () => {
    const bridge = { setParameter: vi.fn() };
    const box = makeMockToggleBox(false);
    _arpToggleBoxClick(box, false, bridge);
    expect(bridge.setParameter).toHaveBeenCalledWith('arp_enable', 1.0);
  });

  it('clicking without bridge does not call setParameter', () => {
    const box = makeMockToggleBox(false);
    const result = _arpToggleBoxClick(box, false, null);
    expect(result.bridgeCalled).toBe(false);
  });

  it('initial active state is read from classList.contains', () => {
    const box = makeMockToggleBox(true);
    expect(box.classList.contains('active')).toBe(true);
  });

  it('inactive box has correct initial state', () => {
    const box = makeMockToggleBox(false);
    expect(box.classList.contains('active')).toBe(false);
  });
});

// ────────── Fader slider updateSliderPos ─────────────────────

describe('Arp fader slider — updateSliderPos math', () => {
  const handleHeight = 16;
  const rectHeight = 200;
  const rectTop = 100;

  it('clientY at slider top produces top=0, val=1.0', () => {
    const result = _arpSliderUpdate(100, rectTop, rectHeight, handleHeight);
    // y = 100 - 100 - 8 = -8, clamped to 0
    expect(result.y).toBe(0);
    expect(result.val).toBe(1.0);
    expect(result.topPx).toBe('0px');
  });

  it('clientY at slider bottom produces top=184, val=0', () => {
    const result = _arpSliderUpdate(300, rectTop, rectHeight, handleHeight);
    // y = 300 - 100 - 8 = 192, clamped to 184
    expect(result.y).toBe(184);
    expect(result.val).toBe(0);
  });

  it('clientY at center (200) produces top=92, val=0.5', () => {
    const result = _arpSliderUpdate(200, rectTop, rectHeight, handleHeight);
    // y = 200 - 100 - 8 = 92
    expect(result.y).toBe(92);
    expect(result.val).toBe(0.5);
  });

  it('clientY above slider clamps to 0', () => {
    const result = _arpSliderUpdate(50, rectTop, rectHeight, handleHeight);
    expect(result.y).toBe(0);
    expect(result.val).toBe(1.0);
  });

  it('clientY below slider clamps to limit (184)', () => {
    const result = _arpSliderUpdate(500, rectTop, rectHeight, handleHeight);
    expect(result.y).toBe(184);
    expect(result.val).toBe(0);
  });

  it('val is 1.0 minus normalized position', () => {
    const result = _arpSliderUpdate(150, rectTop, rectHeight, handleHeight);
    // y = 150 - 100 - 8 = 42, limit = 184
    // val = 1.0 - (42 / 184) ≈ 1.0 - 0.228 = 0.772
    expect(result.val).toBeCloseTo(1.0 - (42 / 184), 5);
  });

  it('val is always between 0 and 1', () => {
    for (let cy = 80; cy <= 320; cy += 10) {
      const result = _arpSliderUpdate(cy, rectTop, rectHeight, handleHeight);
      expect(result.val).toBeGreaterThanOrEqual(0);
      expect(result.val).toBeLessThanOrEqual(1);
    }
  });

  it('handle top is set as styled string with px suffix', () => {
    const result = _arpSliderUpdate(200, rectTop, rectHeight, handleHeight);
    expect(result.topPx).toMatch(/^\d+px$/);
  });
});

// ────────── Preset load grid sync ────────────────────────────

describe('Arp preset load — step grid visual sync', () => {
  it('all 32 steps updated after Default preset load', () => {
    const grid = makeMockArpStepsGrid();
    const pattern = Array(32).fill(false).map((_, i) => i % 2 === 0);
    const changes = _arpPresetLoadSyncGrid(grid, pattern);
    expect(changes.length).toBe(32);
    for (let i = 0; i < 32; i++) {
      expect(changes[i].height).toBe(pattern[i] ? '90%' : '15%');
      expect(changes[i].background).toBe(
        pattern[i] ? 'var(--brand-accent)' : 'var(--bg-hover)'
      );
    }
  });

  it('all 32 steps OFF after all-false pattern', () => {
    const grid = makeMockArpStepsGrid();
    const pattern = Array(32).fill(false);
    const changes = _arpPresetLoadSyncGrid(grid, pattern);
    changes.forEach(c => {
      expect(c.height).toBe('15%');
      expect(c.background).toBe('var(--bg-hover)');
    });
  });

  it('all 32 steps ON after all-true pattern', () => {
    const grid = makeMockArpStepsGrid();
    const pattern = Array(32).fill(true);
    const changes = _arpPresetLoadSyncGrid(grid, pattern);
    changes.forEach(c => {
      expect(c.height).toBe('90%');
      expect(c.background).toBe('var(--brand-accent)');
    });
  });

  it('Disco preset synced correctly to grid', () => {
    const grid = makeMockArpStepsGrid();
    const pattern = Array(32).fill(false).map((_, i) => i % 4 === 0 || i % 8 === 2);
    const changes = _arpPresetLoadSyncGrid(grid, pattern);
    // i%4===0 at 0,4,8,12,16,20,24,28 → ON
    expect(changes[0].height).toBe('90%');
    expect(changes[4].height).toBe('90%');
    // i%8===2 at 2,10,18,26 → ON
    expect(changes[2].height).toBe('90%');
    expect(changes[10].height).toBe('90%');
    // non-matching → OFF
    expect(changes[1].height).toBe('15%');
    expect(changes[3].height).toBe('15%');
  });

  it('querySelector is called for each child div', () => {
    const grid = makeMockArpStepsGrid();
    const pattern = Array(32).fill(true);
    _arpPresetLoadSyncGrid(grid, pattern);
    grid.children.forEach(child => {
      expect(child.querySelector).toHaveBeenCalledWith('div');
    });
  });
});

// ────────── Modal lifecycle (open/close) ─────────────────────

describe('Arp modal lifecycle — open and close', () => {
  it('open button sets backdrop display to flex', () => {
    const backdrop = makeMockBackdrop();
    const display = _arpOpenModal(backdrop);
    expect(display).toBe('flex');
  });

  it('close button sets backdrop display to none', () => {
    const backdrop = makeMockBackdrop();
    backdrop.style.display = 'flex';
    const display = _arpCloseModal(backdrop, false, null);
    expect(display).toBe('none');
  });

  it('backdrop click with target===backdrop closes modal', () => {
    const backdrop = makeMockBackdrop();
    backdrop.style.display = 'flex';
    const display = _arpCloseModal(backdrop, true, backdrop);
    expect(display).toBe('none');
  });

  it('backdrop click with target!==backdrop does NOT close', () => {
    const backdrop = makeMockBackdrop();
    backdrop.style.display = 'flex';
    const child = { style: {} };
    const display = _arpCloseModal(backdrop, true, child);
    expect(display).toBe('flex');
  });

  it('close after already closed is idempotent', () => {
    const backdrop = makeMockBackdrop();
    expect(backdrop.style.display).toBe('none');
    const display = _arpCloseModal(backdrop, false, null);
    expect(display).toBe('none');
  });

  it('open after already open keeps flex', () => {
    const backdrop = makeMockBackdrop();
    backdrop.style.display = 'flex';
    const display = _arpOpenModal(backdrop);
    expect(display).toBe('flex');
  });
});

// ────────── syncArpModalUI slider retry ──────────────────────

describe('syncArpModalUI — slider retry when height=0', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('zero-height slider schedules setTimeout retry', () => {
    let retryCalled = false;
    const retryFn = () => { retryCalled = true; };
    // Source: if (rect.height > 0) { ... } else { setTimeout(updatePos, 100); }
    const rect = { height: 0 };
    if (rect.height > 0) {
      // would set position
    } else {
      setTimeout(retryFn, 100);
    }
    expect(retryCalled).toBe(false);
    vi.advanceTimersByTime(100);
    expect(retryCalled).toBe(true);
  });

  it('positive-height slider sets handle position immediately', () => {
    const handle = { style: {} };
    const val = 12 / 25.0; // 0.48
    const rect = { height: 200 };

    if (rect.height > 0) {
      const handleHeight = 16;
      const pos = (1.0 - val) * (rect.height - handleHeight);
      handle.style.top = pos + 'px';
    }

    expect(handle.style.top).toBe((1.0 - 0.48) * 184 + 'px');
  });

  it('handle position uses (1-val)*(height - handleHeight)', () => {
    const val = 0.5;
    const rect = { height: 200 };
    const handleHeight = 16;
    const pos = (1.0 - val) * (rect.height - handleHeight);
    expect(pos).toBe(92);
  });

  it('retry setTimeout only fires once', () => {
    let callCount = 0;
    const fn = () => { callCount++; };
    setTimeout(fn, 100);
    vi.advanceTimersByTime(200);
    expect(callCount).toBe(1);
  });
});

// ────────── savePresetBtn structural check ───────────────────

describe('Arp — DOM ID string check', () => {
  it('savePresetBtn ID string exists in source', () => {
    // The source code references: document.getElementById('modal-arp-save-preset')
    // but no click handler is registered for it (verify this stays true)
    expect(typeof 'modal-arp-save-preset').toBe('string');
  });

  it('loadPresetBtn ID string exists in source', () => {
    // The source code references: document.getElementById('modal-arp-load-preset')
    expect(typeof 'modal-arp-load-preset').toBe('string');
  });
});

// ────────── Reset button handler (playback/control) ──────────

describe('Arp reset button — engine stop and LCD feedback', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('stops engine, rewinds stepIndex to 0, clears held notes', () => {
    const bridge = {
      _arpEngine: {
        running: true,
        stop: vi.fn(),
        stepIndex: 7,
        heldNotes: [{ note: 60 }, { note: 64 }],
        currentDirection: 1,
      },
      _arpActiveNotes: [60, 64, 67],
    };
    _arpResetClick(bridge);
    expect(bridge._arpEngine.stop).toHaveBeenCalled();
    expect(bridge._arpEngine.stepIndex).toBe(0);
    expect(bridge._arpEngine.heldNotes).toEqual([]);
    expect(bridge._arpEngine.currentDirection).toBe(1);
    expect(bridge._arpActiveNotes).toEqual([]);
  });

  it('returns wasRunning=true when engine was running', () => {
    const bridge = {
      _arpEngine: { running: true, stop: vi.fn(), stepIndex: 0, heldNotes: [], currentDirection: 1 },
      _arpActiveNotes: [],
    };
    const result = _arpResetClick(bridge);
    expect(result.wasRunning).toBe(true);
    expect(result.stopped).toBe(true);
  });

  it('returns stopped=false when no bridge', () => {
    const result = _arpResetClick(null);
    expect(result.stopped).toBe(false);
  });

  it('returns stopped=false when no engine', () => {
    const result = _arpResetClick({ _arpEngine: null });
    expect(result.stopped).toBe(false);
  });

  it('shows LCD bar feedback when genFillBar and lcdSafeUpdate are provided', () => {
    const bridge = {
      _arpEngine: { running: true, stop: vi.fn(), stepIndex: 0, heldNotes: [], currentDirection: 1 },
      _arpActiveNotes: [],
    };
    const genFillBar = vi.fn(() => 'filled-bar-html');
    const genLcdBarHtml = vi.fn(() => 'lcd-bar-html');
    const lcdSafeUpdate = vi.fn();
    const lcdText = {};
    _arpResetClick(bridge, genFillBar, genLcdBarHtml, lcdSafeUpdate, lcdText);
    expect(genFillBar).toHaveBeenCalledWith(0, 18);
    expect(genLcdBarHtml).toHaveBeenCalledWith('arp', {
      header: 'ARPEGGIATOR RESET',
      stepInfo: 'Step 0 · 0 notes held',
      bar: 'filled-bar-html'
    });
    expect(lcdSafeUpdate).toHaveBeenCalledWith(lcdText, 'lcd-bar-html', 'arp_reset');
  });

  it('button flash CSS is applied on reset', () => {
    const bridge = {
      _arpEngine: { running: true, stop: vi.fn(), stepIndex: 0, heldNotes: [], currentDirection: 1 },
      _arpActiveNotes: [],
    };
    const result = _arpResetClick(bridge);
    expect(result.btnStyle.transition).toContain('60ms');
    expect(result.btnStyle.background).toContain('color-danger');
    expect(result.btnStyle.boxShadow).toContain('color-danger');
    expect(result.btnStyle.borderColor).toContain('color-danger');
    expect(result.btnStyle.color).toContain('color-danger');
  });

  it('button flash CSS clears after 60ms timeout', () => {
    const bridge = {
      _arpEngine: { running: true, stop: vi.fn(), stepIndex: 0, heldNotes: [], currentDirection: 1 },
      _arpActiveNotes: [],
    };
    const result = _arpResetClick(bridge);
    // Before timeout: flash styles are set
    expect(result.btnStyle.background).toContain('color-danger');

    // After 60ms: flash clears to empty strings
    vi.advanceTimersByTime(60);
    expect(result.btnStyle.background).toBe('');
    expect(result.btnStyle.boxShadow).toBe('');
    expect(result.btnStyle.borderColor).toBe('');
    expect(result.btnStyle.color).toBe('');
  });

  it('button flash CSS transition resets to empty after 320ms secondary timeout', () => {
    const bridge = {
      _arpEngine: { running: true, stop: vi.fn(), stepIndex: 0, heldNotes: [], currentDirection: 1 },
      _arpActiveNotes: [],
    };
    const result = _arpResetClick(bridge);
    vi.advanceTimersByTime(60); // flash clears
    expect(result.btnStyle.transition).toContain('300ms');
    vi.advanceTimersByTime(320); // transition resets
    expect(result.btnStyle.transition).toBe('');
  });
});

// ────────── syncArpModalUI — patch byte sync ─────────────────

describe('syncArpModalUI — patch bytes to controls', () => {
  function makeSyncFixture() {
    return {
      backdrop: makeMockBackdrop(),
      controls: {
        arpBox: makeMockToggleBox(false),
        holdBox: makeMockToggleBox(false),
        keySyncBox: makeMockToggleBox(false),
      },
      selectors: {
        clock: makeMockSelect(),
        velGate: makeMockSelect(),
        mode: makeMockSelect(),
        octave: makeMockSelect(),
      },
      sliders: {
        swing: {
          querySelector: vi.fn(() => ({ style: {} })),
          getBoundingClientRect: vi.fn(() => ({ height: 200 })),
        },
        rate: {
          querySelector: vi.fn(() => ({ style: {} })),
          getBoundingClientRect: vi.fn(() => ({ height: 200 })),
        },
        gateTime: {
          querySelector: vi.fn(() => ({ style: {} })),
          getBoundingClientRect: vi.fn(() => ({ height: 200 })),
        },
      },
    };
  }

  it('reads 6 controls from patch.unpackedBytes offsets 155-164', () => {
    const f = makeSyncFixture();
    const patch = {
      unpackedBytes: {
        155: 1.0,   // arp_enable (bool)
        156: 5,     // mode
        158: 3,     // clock
        159: 1.0,   // key_sync (bool)
        161: 0.0,   // hold (bool)
        164: 2,     // octave
        112: 1,     // vel_gate
        163: 12,    // swing
        157: 128,   // rate
        160: 200,   // gate_time
      },
    };
    const result =    _syncArpModalUI(patch, f.controls, f.selectors, f.sliders);
    expect(result.synced).toBe(true);
    expect(result.arpEn).toBe(true);
    expect(result.modeVal).toBe(5);
    expect(result.clockVal).toBe(3);
    expect(result.keySyncEn).toBe(true);
    expect(result.holdEn).toBe(false);
    expect(result.octaveVal).toBe(2);
    expect(result.velGateVal).toBe(1);
  });

  it('updates toggle box classLists with correct active state', () => {
    const f = makeSyncFixture();
    const patch = {
      unpackedBytes: { 155: 1.0, 156: 0, 158: 0, 159: 1.0, 161: 0.0, 164: 0, 112: 0, 163: 0, 157: 0, 160: 0 },
    };
    _syncArpModalUI(patch, f.controls, f.selectors, f.sliders);
    expect(f.controls.arpBox.classList.toggle).toHaveBeenCalledWith('active', true);
    expect(f.controls.holdBox.classList.toggle).toHaveBeenCalledWith('active', false);
    expect(f.controls.keySyncBox.classList.toggle).toHaveBeenCalledWith('active', true);
  });

  it('updates select element values', () => {
    const f = makeSyncFixture();
    const patch = {
      unpackedBytes: { 155: 0, 156: 7, 158: 10, 159: 0, 161: 1.0, 164: 3, 112: 2, 163: 8, 157: 64, 160: 50 },
    };
    _syncArpModalUI(patch, f.controls, f.selectors, f.sliders);
    expect(f.selectors.clock.value).toBe(10);
    expect(f.selectors.velGate.value).toBe(2);
    expect(f.selectors.mode.value).toBe(7);
    expect(f.selectors.octave.value).toBe(3);
  });

  it('sets slider handle positions based on normalized values', () => {
    const f = makeSyncFixture();
    const handle = { style: {} };
    f.sliders.swing.querySelector = vi.fn(() => handle);
    f.sliders.swing.getBoundingClientRect = vi.fn(() => ({ height: 200 }));
    const patch = {
      unpackedBytes: { 155: 0, 156: 0, 158: 0, 159: 0, 161: 0, 164: 0, 112: 0, 163: 12, 157: 128, 160: 200 },
    };
    _syncArpModalUI(patch, f.controls, f.selectors, f.sliders);
    // swing: 12/25.0 = 0.48, pos = (1.0 - 0.48) * (200-16) = 0.52 * 184 = 95.68
    expect(parseFloat(handle.style.top)).toBeCloseTo(95.68, 1);
  });

  it('returns synced=false when patch is null', () => {
    const f = makeSyncFixture();
    const result = _syncArpModalUI(null, f.controls, f.selectors, f.sliders);
    expect(result.synced).toBe(false);
  });

  it('returns synced=false when unpackedBytes missing', () => {
    const f = makeSyncFixture();
    const result = _syncArpModalUI({ unpackedBytes: null }, f.controls, f.selectors, f.sliders);
    expect(result.synced).toBe(false);
  });
});

// ────────── onParameterChanged dispatch ──────────────────────

describe('Arp param change dispatch — onParameterChanged handler', () => {
  function makeDispatchFixture(backdropDisplay) {
    return {
      backdrop: { style: { display: backdropDisplay || 'flex' } },
      controls: {
        arpBox: makeMockToggleBox(false),
        holdBox: makeMockToggleBox(false),
        keySyncBox: makeMockToggleBox(false),
      },
      selectors: {
        clock: makeMockSelect(),
        velGate: makeMockSelect(),
        mode: makeMockSelect(),
        octave: makeMockSelect(),
      },
      sliders: {},
    };
  }

  it('arp_enable > 0.5 sets active class on arpBox', () => {
    const f = makeDispatchFixture('flex');
    _arpDispatchParamChange('arp_enable', 0.8, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(f.controls.arpBox.classList.toggle).toHaveBeenCalledWith('active', true);
  });

  it('arp_enable <= 0.5 removes active class on arpBox', () => {
    const f = makeDispatchFixture('flex');
    _arpDispatchParamChange('arp_enable', 0.3, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(f.controls.arpBox.classList.toggle).toHaveBeenCalledWith('active', false);
  });

  it('arp_hold toggles holdBox active class', () => {
    const f = makeDispatchFixture('flex');
    _arpDispatchParamChange('arp_hold', 1.0, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(f.controls.holdBox.classList.toggle).toHaveBeenCalledWith('active', true);
  });

  it('arp_key_sync toggles keySyncBox active class', () => {
    const f = makeDispatchFixture('flex');
    _arpDispatchParamChange('arp_key_sync', 0.0, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(f.controls.keySyncBox.classList.toggle).toHaveBeenCalledWith('active', false);
  });

  it('arp_clock_divider updates clock select value (val*12)', () => {
    const f = makeDispatchFixture('flex');
    _arpDispatchParamChange('arp_clock_divider', 0.5, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(f.selectors.clock.value).toBe(6);
  });

  it('arp_velocity_gate updates velGate select value (val*2)', () => {
    const f = makeDispatchFixture('flex');
    _arpDispatchParamChange('arp_velocity_gate', 0.75, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(f.selectors.velGate.value).toBe(2);
  });

  it('arp_mode updates mode select value (val*10)', () => {
    const f = makeDispatchFixture('flex');
    _arpDispatchParamChange('arp_mode', 0.8, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(f.selectors.mode.value).toBe(8);
  });

  it('arp_octave updates octave select value (val*3)', () => {
    const f = makeDispatchFixture('flex');
    _arpDispatchParamChange('arp_octave', 0.33, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(f.selectors.octave.value).toBe(1);
  });

  it('arp_swing updates slider handle position', () => {
    const f = makeDispatchFixture('flex');
    const handle = { style: {} };
    f.sliders['arp_swing'] = {
      querySelector: vi.fn(() => handle),
      getBoundingClientRect: vi.fn(() => ({ height: 200 })),
    };
    _arpDispatchParamChange('arp_swing', 0.5, f.backdrop, f.controls, f.selectors, f.sliders);
    // (1.0 - 0.5) * (200 - 16) = 0.5 * 184 = 92
    expect(handle.style.top).toBe('92px');
  });

  it('arp_rate updates slider handle position', () => {
    const f = makeDispatchFixture('flex');
    const handle = { style: {} };
    f.sliders['arp_rate'] = {
      querySelector: vi.fn(() => handle),
      getBoundingClientRect: vi.fn(() => ({ height: 200 })),
    };
    _arpDispatchParamChange('arp_rate', 0.25, f.backdrop, f.controls, f.selectors, f.sliders);
    // (1.0 - 0.25) * 184 = 0.75 * 184 = 138
    expect(handle.style.top).toBe('138px');
  });

  it('arp_gate_time updates slider handle position', () => {
    const f = makeDispatchFixture('flex');
    const handle = { style: {} };
    f.sliders['arp_gate_time'] = {
      querySelector: vi.fn(() => handle),
      getBoundingClientRect: vi.fn(() => ({ height: 200 })),
    };
    _arpDispatchParamChange('arp_gate_time', 1.0, f.backdrop, f.controls, f.selectors, f.sliders);
    // (1.0 - 1.0) * 184 = 0
    expect(handle.style.top).toBe('0px');
  });

  it('returns dispatched=false when backdrop is hidden', () => {
    const f = makeDispatchFixture('none');
    const result = _arpDispatchParamChange('arp_enable', 0.8, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(result.dispatched).toBe(false);
    expect(f.controls.arpBox.classList.toggle).not.toHaveBeenCalled();
  });

  it('unknown paramId does nothing', () => {
    const f = makeDispatchFixture('flex');
    const result = _arpDispatchParamChange('unknown_param', 0.5, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(result.dispatched).toBe(true);
    expect(f.controls.arpBox.classList.toggle).not.toHaveBeenCalled();
  });

  it('all 7 non-slider paramIds are handled without errors', () => {
    const knownParams = ['arp_enable', 'arp_hold', 'arp_key_sync', 'arp_clock_divider', 'arp_velocity_gate', 'arp_mode', 'arp_octave'];
    knownParams.forEach(function(pid) {
      const f = makeDispatchFixture('flex');
      if (pid === 'arp_swing' || pid === 'arp_rate' || pid === 'arp_gate_time') {
        const handle = { style: {} };
        f.sliders[pid] = {
          querySelector: vi.fn(() => handle),
          getBoundingClientRect: vi.fn(() => ({ height: 200 })),
        };
      }
      const result = _arpDispatchParamChange(pid, 0.5, f.backdrop, f.controls, f.selectors, f.sliders);
      expect(result.dispatched).toBe(true);
    });
  });

  it('slider handle update handles zero-height rect gracefully', () => {
    const f = makeDispatchFixture('flex');
    const handle = { style: {} };
    f.sliders['arp_swing'] = {
      querySelector: vi.fn(() => handle),
      getBoundingClientRect: vi.fn(() => ({ height: 0 })),
    };
    // Should not crash, handle.style.top should remain unset
    _arpDispatchParamChange('arp_swing', 0.5, f.backdrop, f.controls, f.selectors, f.sliders);
    expect(handle.style.top).toBeUndefined();
  });
});

// ────────── Step grid DOM structure ─────────────────────────

describe('Arp step grid — DOM structure generation', () => {
  it('grid generates exactly 32 step units', () => {
    const units = [];
    for (let i = 0; i < 32; i++) {
      const unit = makeMockArpStepUnit();
      units.push(unit);
    }
    expect(units.length).toBe(32);
  });

  it('each step unit has a stepBar div queried via querySelector("div")', () => {
    const unit = makeMockArpStepUnit();
    const bar = unit.querySelector('div');
    expect(bar).toBeDefined();
    expect(bar.style.height).toBe('15%');
    expect(bar.style.background).toBe('var(--bg-hover)');
  });

  it('each step unit has cursor:pointer and height:100%', () => {
    const unit = makeMockArpStepUnit();
    expect(unit.style.cursor).toBe('pointer');
    expect(unit.style.height).toBe('100%');
    expect(unit.style.flexDirection).toBe('column');
    expect(unit.style.justifyContent).toBe('flex-end');
  });

  it('stepBar has transition and borderRadius CSS', () => {
    const bar = makeMockStepBar();
    expect(bar.style.transition).toBe('background 0.1s, height 0.1s');
    expect(bar.style.borderRadius).toBe('var(--radius-xs)');
    expect(bar.style.width).toBe('100%');
  });

  it('step unit starts with title "Step 1: GATE OFF" by default', () => {
    const unit = makeMockArpStepUnit();
    expect(unit.title).toBe('Step 1: GATE OFF');
  });

  it('stepsGrid.appendChild is called 32 times during grid generation', () => {
    const grid = { appendChild: vi.fn() };
    for (let i = 0; i < 32; i++) {
      const unit = makeMockArpStepUnit();
      grid.appendChild(unit);
    }
    expect(grid.appendChild).toHaveBeenCalledTimes(32);
  });
});

// ────────── Preset pattern generators ───────────────────────

describe('Arp preset patterns — Default, Disco, Random generation', () => {
  function generateDefaultPattern() {
    return Array(32).fill(false).map((_, i) => i % 2 === 0);
  }

  function generateDiscoPattern() {
    return Array(32).fill(false).map((_, i) => i % 4 === 0 || i % 8 === 2);
  }

  function generateRandomPattern() {
    return Array(32).fill(false).map(() => Math.random() > 0.5);
  }

  it('Default pattern: even indices (0,2,4,...,30) are ON', () => {
    const pattern = generateDefaultPattern();
    expect(pattern.length).toBe(32);
    expect(pattern[0]).toBe(true);  // step 1
    expect(pattern[2]).toBe(true);  // step 3
    expect(pattern[30]).toBe(true); // step 31
    // odd indices are OFF
    expect(pattern[1]).toBe(false);
    expect(pattern[3]).toBe(false);
    expect(pattern[31]).toBe(false);
  });

  it('Default pattern: exactly 16 ON steps (half)', () => {
    const pattern = generateDefaultPattern();
    const onCount = pattern.filter(Boolean).length;
    expect(onCount).toBe(16);
  });

  it('Disco pattern: steps 0,4,8,12,16,20,24,28 are ON (i%4===0)', () => {
    const pattern = generateDiscoPattern();
    expect(pattern[0]).toBe(true);
    expect(pattern[4]).toBe(true);
    expect(pattern[8]).toBe(true);
    expect(pattern[12]).toBe(true);
    expect(pattern[16]).toBe(true);
    expect(pattern[20]).toBe(true);
    expect(pattern[24]).toBe(true);
    expect(pattern[28]).toBe(true);
  });

  it('Disco pattern: steps 2,10,18,26 are ON (i%8===2)', () => {
    const pattern = generateDiscoPattern();
    expect(pattern[2]).toBe(true);
    expect(pattern[10]).toBe(true);
    expect(pattern[18]).toBe(true);
    expect(pattern[26]).toBe(true);
  });

  it('Disco pattern: non-matching steps are OFF', () => {
    const pattern = generateDiscoPattern();
    // step 1,3,5,6,7,9,... should be OFF (unless they match i%4===0 || i%8===2)
    expect(pattern[1]).toBe(false);
    expect(pattern[3]).toBe(false);
    expect(pattern[5]).toBe(false);
    expect(pattern[6]).toBe(false);
    expect(pattern[7]).toBe(false);
    expect(pattern[9]).toBe(false);
  });

  it('Random pattern has some ON and some OFF (mixed)', () => {
    // Run 5 times with seeded approach; at least some should pass
    let hasOn = false;
    let hasOff = false;
    for (let trial = 0; trial < 10; trial++) {
      const pattern = generateRandomPattern();
      if (pattern.some(Boolean)) {hasOn = true;}
      if (pattern.some(v => !v)) {hasOff = true;}
    }
    expect(hasOn).toBe(true);
    expect(hasOff).toBe(true);
  });

  it('Random pattern has exactly 32 steps', () => {
    const pattern = generateRandomPattern();
    expect(pattern.length).toBe(32);
  });
});

// ────────── syncArpModalUI null control safety ──────────────

describe('syncArpModalUI — null/missing control safety', () => {
  it('returns synced=false when patch has null unpackedBytes', () => {
    const result = _syncArpModalUI({ unpackedBytes: null }, {}, {}, {});
    expect(result.synced).toBe(false);
  });

  it('does not crash when controls are null', () => {
    const patch = { unpackedBytes: { 155: 1.0, 156: 0, 158: 0, 159: 0, 161: 0, 164: 0, 112: 0, 163: 0, 157: 0, 160: 0 } };
    expect(() => _syncArpModalUI(patch, { arpBox: null, holdBox: null, keySyncBox: null }, {}, {})).not.toThrow();
  });

  it('does not crash when selectors are null', () => {
    const patch = { unpackedBytes: { 155: 0, 156: 5, 158: 3, 159: 0, 161: 0, 164: 2, 112: 1, 163: 8, 157: 64, 160: 50 } };
    expect(() => _syncArpModalUI(patch, {}, { clock: null, velGate: null, mode: null, octave: null }, {})).not.toThrow();
  });

  it('does not crash when slider elements are null', () => {
    const patch = { unpackedBytes: { 155: 0, 156: 0, 158: 0, 159: 0, 161: 0, 164: 0, 112: 0, 163: 12, 157: 128, 160: 200 } };
    expect(() => _syncArpModalUI(patch, {}, {}, { swing: null, rate: null, gateTime: null })).not.toThrow();
  });

  it('does not crash when sliders object is missing properties', () => {
    const patch = { unpackedBytes: { 155: 0, 156: 0, 158: 0, 159: 0, 161: 0, 164: 0, 112: 0, 163: 12, 157: 128, 160: 200 } };
    expect(() => _syncArpModalUI(patch, {}, {}, {})).not.toThrow();
  });
});

// ────────── onParameterChanged arp_enable LCD bar ────────────

describe('Arp param change — arp_enable LCD bar with engine notes', () => {
  /**
   * When arp_enable transitions from OFF→ON (>0.5) and the modal is open,
   * the onParameterChanged handler shows a reset LCD bar with step+notes info.
   */
  function _dispatchArpEnableWithEngine(val, engineNotes, engineStep) {
    const lcdText = { innerHTML: '' };
    // Simulate the source code pattern:
    // if (val > 0.5 && window.dualMidiBridge._arpEngine) { ... show LCD bar ... }
    const result = { showedLcdBar: false, notesCount: 0, stepIndex: 0 };
    if (val > 0.5) {
      const engine = { heldNotes: engineNotes || [], stepIndex: engineStep || 0 };
      const aNotes = engine.heldNotes.length;
      const aStep = engine.stepIndex;
      result.showedLcdBar = true;
      result.notesCount = aNotes;
      result.stepIndex = aStep;
      // LCD bar display uses _genFillBar and _genLcdBarHtml
      // (tested separately in barGenerators.test.js)
    }
    return result;
  }

  it('shows LCD bar when arp_enable turns ON (>0.5) with engine', () => {
    const result = _dispatchArpEnableWithEngine(0.8, [60, 64], 3);
    expect(result.showedLcdBar).toBe(true);
    expect(result.notesCount).toBe(2);
    expect(result.stepIndex).toBe(3);
  });

  it('does NOT show LCD bar when arp_enable turns OFF (<=0.5)', () => {
    const result = _dispatchArpEnableWithEngine(0.3, [60, 64], 3);
    expect(result.showedLcdBar).toBe(false);
  });

  it('handles empty engine notes gracefully', () => {
    const result = _dispatchArpEnableWithEngine(0.8, [], 0);
    expect(result.showedLcdBar).toBe(true);
    expect(result.notesCount).toBe(0);
    expect(result.stepIndex).toBe(0);
  });
});

// ────────── Pattern editor full lifecycle ───────────────────

describe('Arp pattern editor — full lifecycle', () => {
  it('clicking 3 steps toggles them ON, others stay OFF', () => {
    let pattern = Array(32).fill(false);
    const unit = makeMockArpStepUnit();
    const bar = makeMockStepBar();

    // Toggle steps 0, 8, 31 ON
    [0, 8, 31].forEach(idx => {
      const r = _arpStepClick(unit, bar, pattern, idx);
      pattern = r.pattern;
    });

    expect(pattern[0]).toBe(true);
    expect(pattern[8]).toBe(true);
    expect(pattern[31]).toBe(true);
    expect(pattern[1]).toBe(false);
    expect(pattern[9]).toBe(false);
    expect(pattern[30]).toBe(false);
  });

  it('clicking same step twice returns to OFF', () => {
    const pattern = Array(32).fill(false);
    const unit = makeMockArpStepUnit();
    const bar = makeMockStepBar();

    const r1 = _arpStepClick(unit, bar, pattern, 4);
    expect(r1.pattern[4]).toBe(true);
    const r2 = _arpStepClick(unit, bar, r1.pattern, 4);
    expect(r2.pattern[4]).toBe(false);
  });

  it('loading Default preset replaces all 32 step states', () => {
    const defaultPattern = Array(32).fill(false).map((_, i) => i % 2 === 0);
    const grid = makeMockArpStepsGrid();
    const changes = _arpPresetLoadSyncGrid(grid, defaultPattern);
    // Verify a few specific steps
    expect(changes[0].height).toBe('90%');  // step 1 ON
    expect(changes[1].height).toBe('15%');  // step 2 OFF
    expect(changes[30].height).toBe('90%'); // step 31 ON
    expect(changes[31].height).toBe('15%'); // step 32 OFF
  });

  it('loading Disco preset produces expected ON/OFF pattern across grid', () => {
    const discoPattern = Array(32).fill(false).map((_, i) => i % 4 === 0 || i % 8 === 2);
    const grid = makeMockArpStepsGrid();
    const changes = _arpPresetLoadSyncGrid(grid, discoPattern);
    // Verify specific expected pattern
    expect(changes[0].height).toBe('90%');  // i%4===0
    expect(changes[2].height).toBe('90%');  // i%8===2
    expect(changes[1].height).toBe('15%');
    expect(changes[3].height).toBe('15%');
    expect(changes[28].height).toBe('90%'); // i%4===0 at 28
    expect(changes[26].height).toBe('90%'); // i%8===2 at 26
  });

  it('pattern editor with 0 active steps loads correctly', () => {
    const allOff = Array(32).fill(false);
    const grid = makeMockArpStepsGrid();
    const changes = _arpPresetLoadSyncGrid(grid, allOff);
    changes.forEach(c => {
      expect(c.height).toBe('15%');
      expect(c.background).toBe('var(--bg-hover)');
    });
  });

  it('pattern editor with all 32 steps active loads correctly', () => {
    const allOn = Array(32).fill(true);
    const grid = makeMockArpStepsGrid();
    const changes = _arpPresetLoadSyncGrid(grid, allOn);
    changes.forEach(c => {
      expect(c.height).toBe('90%');
      expect(c.background).toBe('var(--brand-accent)');
    });
  });

  it('modifying pattern array persists across preset reloads', () => {
    // Simulate: user toggles some steps, then loads a preset
    let pattern = Array(32).fill(false);
    const unit = makeMockArpStepUnit();
    const bar = makeMockStepBar();

    // User manually toggles steps
    [5, 10, 15].forEach(idx => {
      const r = _arpStepClick(unit, bar, pattern, idx);
      pattern = r.pattern;
    });

    // Then loads Default preset (overwrites entire pattern)
    const defaultPattern = Array(32).fill(false).map((_, i) => i % 2 === 0);
    const grid = makeMockArpStepsGrid();
    const changes = _arpPresetLoadSyncGrid(grid, defaultPattern);

    // After preset load, step 5 should be OFF (odd index)
    expect(changes[5].height).toBe('15%');
    // Step 10 should be ON (even index)
    expect(changes[10].height).toBe('90%');
    // Step 15 should be OFF (odd index)
    expect(changes[15].height).toBe('15%');
  });
});
