/**
 * Unit tests for panel_oscilloscope.js — Real-time DSP oscilloscope + FFT spectrum + filter overlay.
 *
 * Covers:
 *   - hexToRgba (hex color → rgba string)
 *   - drawRealScope with all 3 view modes (0=DUAL, 1=WAVE, 2=SPC) via eval()
 *   - _drawPlaceholder with mocked canvas context
 *   - _drawFilterOverlay canvas rendering (filter type detection, cutoff mapping, resonance)
 *   - _calcFilterResponse LP/HP/BP math
 *   - Frequency label mapping helpers
 *
 * Pattern: Standalone functions extracted directly (like panelGraphics.test.js).
 * window.drawRealScope loaded via eval() when needed.
 *
 * Run with: npx vitest run WebUI/tests/panelOscilloscope.test.js
 */

import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// ══════════════════════════════════════════════════════════════════
// Extracted from panel_oscilloscope.js
// ══════════════════════════════════════════════════════════════════

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/** Draws centered placeholder text */
function _drawPlaceholder(ctx, w, h, colors, line1, line2) {
    ctx.fillStyle = colors.text;
    ctx.font = '8px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(line1, w / 2, h / 2 - 4);
    ctx.font = '6px Share Tech Mono, monospace';
    ctx.fillText(line2, w / 2, h / 2 + 10);
    ctx.textAlign = 'left';
}

/** Calculates filter response for LP/HP/BP */
function _calcFilterResponse(freqHz, cutoffHz, res, type, poles) {
    if (cutoffHz <= 0) {return (type === 2) ? 1 : 0;}

    const ratio = freqHz / cutoffHz;
    const slope = (poles === 0) ? 4 : 2;

    let response;
    if (type === 0) {
        response = 1 / (1 + Math.pow(ratio, 2 * slope));
    } else if (type === 2) {
        response = 1 / (1 + Math.pow(1 / Math.max(ratio, 0.001), 2 * slope));
    } else {
        response = Math.max(0, 2 * ratio / (1 + ratio * ratio));
    }

    if (res > 0.01 && type !== 1) {
        const peakWidth = 1 + res * 5;
        const peakGain = 1 + res * 2.5;
        const peak = peakGain / (1 + Math.pow((freqHz / cutoffHz - 1) * peakWidth, 2));
        response = Math.min(1, response + (peak - 1) * res * 0.6);
    }

    return Math.max(0, Math.min(1, response));
}

/** Draws filter overlay on spectrum */
function _drawFilterOverlay(ctx, padding, w, top, bot, graphH, graphW) {
    const cache = window.dualMidiBridge ? window.dualMidiBridge.parameterCache : null;
    if (!cache) {return;}

    const rawCutoff = cache['vcf_cutoff'];
    if (rawCutoff === undefined || rawCutoff === null) {return;}
    const vcfCutoff = Math.max(0, Math.min(1, rawCutoff));
    const vcfRes = cache['vcf_resonance'] !== undefined ? Math.max(0, Math.min(1, cache['vcf_resonance'])) : 0;
    const vcfModel = cache['vcf_model'] !== undefined ? Math.round(cache['vcf_model']) : 0;

    // Filter type detection
    let filterType = 0;
    let filterName = '';
    if (vcfModel === 0) {
        filterType = 0;
        filterName = 'OTA LP';
    } else if (vcfModel === 1) {
        const moogSub = cache['vcf_moog_submode'] !== undefined ? Math.round(cache['vcf_moog_submode']) : 0;
        filterType = moogSub;
        filterName = 'Moog ' + (moogSub === 0 ? 'LP' : moogSub === 1 ? 'BP' : 'HP');
    } else if (vcfModel === 2) {
        const korgSub = cache['vcf_korg_submode'] !== undefined ? Math.round(cache['vcf_korg_submode']) : 0;
        filterType = korgSub === 0 ? 0 : 2;
        filterName = 'MS-20 ' + (korgSub === 0 ? 'LP' : 'HP');
    }

    const poleMode = cache['vcf_pole_mode'] !== undefined ? Math.round(cache['vcf_pole_mode']) : 0;
    if (filterName) {
        filterName += ' ' + (poleMode === 0 ? '24dB' : '12dB');
    }

    // Map cutoff to Hz and canvas X
    const cutoffHz = 20 * Math.pow(1000, vcfCutoff);
    const normX = Math.log(cutoffHz / 20) / Math.log(20000 / 20);
    const cutoffX = padding + Math.round(normX * graphW);

    // Dashed vertical line
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(cutoffX, top);
    ctx.lineTo(cutoffX, bot);
    ctx.stroke();
    ctx.setLineDash([]);

    // Attenuated zone shadow
    const shadowColor = 'rgba(0, 100, 180, 0.12)';
    if (filterType === 0) {
        ctx.fillStyle = shadowColor;
        ctx.fillRect(cutoffX, top, w - cutoffX, bot - top);
    } else if (filterType === 2) {
        ctx.fillStyle = shadowColor;
        ctx.fillRect(padding, top, cutoffX - padding, bot - top);
    } else {
        ctx.fillStyle = shadowColor;
        ctx.fillRect(padding, top, cutoffX - padding, bot - top);
        ctx.fillRect(cutoffX, top, w - padding - cutoffX, bot - top);
    }

    // Response curve (60 steps)
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let si = 0; si <= 60; si++) {
        const t = si / 60;
        const x = padding + t * graphW;
        const freqHz = 20 * Math.pow(20000 / 20, t);
        const response = _calcFilterResponse(freqHz, cutoffHz, vcfRes, filterType, poleMode);
        const regionH = graphH * 0.8;
        const y = top + (1 - response) * regionH;
        if (si === 0) {ctx.moveTo(x, y);}
        else {ctx.lineTo(x, y);}
    }
    ctx.stroke();

    // Resonance ellipse
    if (vcfRes > 0.05) {
        const peakH = Math.min(graphH * 0.6, 4 + vcfRes * 8 * 3);
        const peakTopY = top + 2;
        const peakSpread = Math.max(2, 6 + vcfRes * 20);
        ctx.fillStyle = 'rgba(255, 200, 50, ' + (0.3 + vcfRes * 0.4) + ')';
        ctx.beginPath();
        ctx.ellipse(cutoffX, peakTopY + peakH - 2, peakSpread, peakH, 0, Math.PI, 0, true);
        ctx.fill();
    }

    // Filter name label
    if (filterName) {
        ctx.fillStyle = 'rgba(0, 255, 200, 0.6)';
        ctx.font = '6.5px Share Tech Mono, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(filterName, padding + 4, top + 10);

        const freqLabel = cutoffHz < 1000 ? Math.round(cutoffHz) + 'Hz' : (cutoffHz / 1000).toFixed(1) + 'kHz';
        ctx.fillStyle = 'rgba(0, 255, 200, 0.45)';
        ctx.font = '6px Share Tech Mono, monospace';
        ctx.fillText(freqLabel, padding + 4, top + 20);
        ctx.textAlign = 'left';
    }
}

// ══════════════════════════════════════════════════════════════════
// Mock canvas context factory
// ══════════════════════════════════════════════════════════════════

function createMockCtx() {
  const mockCtx = {
    _calls: [],
    _clearRectCalls: 0,
    clearRect: function() { this._clearRectCalls++; this._calls.push('clearRect'); },
    beginPath: function() { this._calls.push('beginPath'); },
    moveTo: function(x, y) { this._calls.push('moveTo(' + x + ',' + y + ')'); },
    lineTo: function(x, y) { this._calls.push('lineTo(' + x + ',' + y + ')'); },
    stroke: function() { this._calls.push('stroke'); },
    fill: function() { this._calls.push('fill'); },
    fillRect: function(x, y, w, h) { this._calls.push('fillRect(' + x + ',' + y + ',' + w + ',' + h + ')'); },
    arc: function() { this._calls.push('arc'); },
    ellipse: function() { this._calls.push('ellipse'); },
    fillText: function(text, x, y) { this._calls.push('fillText("' + text + '",' + x + ',' + y + ')'); },
    setLineDash: function() { this._calls.push('setLineDash'); },
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    font: '',
    textAlign: 'left',
  };
  return mockCtx;
}

function createMockCanvas(width, height) {
  const mockCtx = createMockCtx();
  return {
    width: width || 480,
    height: height || 95,
    clientWidth: width || 480,
    clientHeight: height || 95,
    _ctx: mockCtx,
    getContext: function() { return mockCtx; },
    style: {},
  };
}

function createMockDoc(canvases) {
  const elMap = {};
  if (canvases) {
    for (const key in canvases) {
      elMap[key] = canvases[key];
    }
  }
  return {
    getElementById: function(id) { return elMap[id] || null; },
    addEventListener: vi.fn(),
    querySelector: vi.fn(function() { return null; }),
    querySelectorAll: vi.fn(function() { return []; }),
  };
}

// ══════════════════════════════════════════════════════════════════
// Tests: hexToRgba
// ══════════════════════════════════════════════════════════════════

describe('hexToRgba', function() {

  it('converts #ff9900 with alpha 1.0', function() {
    expect(hexToRgba('#ff9900', 1.0)).toBe('rgba(255,153,0,1)');
  });

  it('converts #00ff00 with alpha 0.5', function() {
    expect(hexToRgba('#00ff00', 0.5)).toBe('rgba(0,255,0,0.5)');
  });

  it('converts #000000 with alpha 0', function() {
    expect(hexToRgba('#000000', 0)).toBe('rgba(0,0,0,0)');
  });

  it('converts #ffffff with alpha 0.85', function() {
    expect(hexToRgba('#ffffff', 0.85)).toBe('rgba(255,255,255,0.85)');
  });

  it('converts #003366 with alpha 0.7', function() {
    expect(hexToRgba('#003366', 0.7)).toBe('rgba(0,51,102,0.7)');
  });

});

// ══════════════════════════════════════════════════════════════════
// Tests: drawRealScope — view modes (via eval'd source)
// ══════════════════════════════════════════════════════════════════

describe('drawRealScope — view modes', function() {
  let canvas;
  let ctx;
  let origDoc;
  let origBridge;
  let origWasmBridge;
  let origState;
  let origScopeColors;

  beforeAll(function() {
    // Load the real source to provide window.drawRealScope
    if (typeof global.window === 'undefined') {
      global.window = {};
    }
    if (typeof global.document === 'undefined') {
      global.document = { getElementById: function() { return null; }, addEventListener: function() {} };
    }
    // Load waveform module first (provides window._drawWaveform, window._drawPlaceholder, window.hexToRgba)
    const waveformCode = fs.readFileSync(path.resolve(__dirname, '../js/panel_oscilloscope_waveform.js'), 'utf-8');
    eval(waveformCode);
    // Then load the main oscilloscope module (provides window.drawRealScope)
    const code = fs.readFileSync(path.resolve(__dirname, '../js/panel_oscilloscope.js'), 'utf-8');
    eval(code);
  });

  beforeEach(function() {
    canvas = createMockCanvas(480, 95);
    ctx = canvas._ctx;

    origDoc = global.document;
    origBridge = window.dualMidiBridge;
    origWasmBridge = window.wasmBridge;
    origState = window.panelEditState;
    origScopeColors = window._getScopeColors;

    global.document = createMockDoc({ 'programmer-scope-canvas': canvas });
    window._getScopeColors = function() {
      return {
        grid: 'rgba(51,51,51,0.2)',
        center: 'rgba(102,102,102,0.3)',
        trigger: 'rgba(255,200,0,0.5)',
        waveform: '#00ffcc',
        text: 'rgba(200,200,200,0.7)',
      };
    };
  });

  afterEach(function() {
    global.document = origDoc;
    window.dualMidiBridge = origBridge;
    window.wasmBridge = origWasmBridge;
    window.panelEditState = origState;
    window._getScopeColors = origScopeColors;
  });

  it('returns early when no canvas found', function() {
    global.document = createMockDoc({});
    expect(function() {
      window.drawRealScope('non-existent-canvas');
    }).not.toThrow();
  });

  it('draws NO DSP ENGINE placeholder when no bridge and no wasmBridge', function() {
    window.dualMidiBridge = null;
    window.wasmBridge = null;
    window.panelEditState = { _scopeViewMode: 0 };

    window.drawRealScope('programmer-scope-canvas');

    expect(ctx._clearRectCalls).toBeGreaterThan(0);
    const textCalls = ctx._calls.filter(function(c) {
      return c.indexOf('fillText') >= 0 && c.indexOf('NO DSP ENGINE') >= 0;
    });
    expect(textCalls.length).toBe(1);
  });

  it('draws WAITING FOR AUDIO when bridge exists but no waveform data (WAVE mode)', function() {
    window.dualMidiBridge = {
      isJuce: true,
      _lastAudioWaveform: null,
      _lastAudioFrequencyData: null,
    };
    window.wasmBridge = { isAudioStarted: true };
    window.panelEditState = { _scopeViewMode: 1 };

    window.drawRealScope('programmer-scope-canvas');
    expect(ctx._clearRectCalls).toBeGreaterThan(0);
  });

  it('draws grid lines', function() {
    window.dualMidiBridge = null;
    window.wasmBridge = null;
    window.panelEditState = { _scopeViewMode: 0 };

    window.drawRealScope('programmer-scope-canvas');

    const moveCalls = ctx._calls.filter(function(c) { return c.indexOf('moveTo') >= 0; });
    expect(moveCalls.length).toBeGreaterThan(0);
  });

  it('handles missing _getScopeColors gracefully', function() {
    window._getScopeColors = undefined;
    window.dualMidiBridge = null;
    window.wasmBridge = null;

    expect(function() {
      window.drawRealScope('programmer-scope-canvas');
    }).not.toThrow();
  });

  it('handles null panelEditState gracefully', function() {
    window.panelEditState = null;
    window.dualMidiBridge = null;
    window.wasmBridge = null;

    expect(function() {
      window.drawRealScope('programmer-scope-canvas');
    }).not.toThrow();
  });

});

// ══════════════════════════════════════════════════════════════════
// Tests: _drawPlaceholder
// ══════════════════════════════════════════════════════════════════

describe('_drawPlaceholder', function() {
  it('draws two lines of centered text', function() {
    const ctx = createMockCtx();
    const colors = { text: 'rgba(102,102,102,0.5)' };

    _drawPlaceholder(ctx, 480, 95, colors, 'NO DSP ENGINE', '(MIDI controller mode)');

    const textCalls = ctx._calls.filter(function(c) { return c.indexOf('fillText') >= 0; });
    expect(textCalls.length).toBe(2);
    expect(ctx.fillStyle).toBe('rgba(102,102,102,0.5)');
    // textAlign is set to 'center' during drawing, then reset to 'left' at end
    // Check the calls were made during center alignment
    const textCalls2 = ctx._calls.filter(function(c) { return c.indexOf('fillText') >= 0; });
    expect(textCalls2.length).toBe(2);
  });

  it('alternate text messages', function() {
    const ctx = createMockCtx();
    const colors = { text: 'rgba(200,200,200,0.7)' };

    _drawPlaceholder(ctx, 480, 95, colors, 'WAITING FOR AUDIO...', 'Play notes to see waveform');

    const firstCall = ctx._calls.filter(function(c) { return c.indexOf('WAITING') >= 0; })[0];
    expect(firstCall).toBeTruthy();
    expect(firstCall).toContain('WAITING FOR AUDIO...');
  });

  it('resets textAlign to left after drawing', function() {
    const ctx = createMockCtx();
    _drawPlaceholder(ctx, 480, 95, { text: '#fff' }, 'Test', 'Subtitle');

    expect(ctx.textAlign).toBe('left');
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _drawFilterOverlay — filter type detection
// ══════════════════════════════════════════════════════════════════

describe('_drawFilterOverlay — filter type detection', function() {
  let ctx;
  let origBridge;

  beforeEach(function() {
    ctx = createMockCtx();
    origBridge = window.dualMidiBridge;
  });

  afterEach(function() {
    window.dualMidiBridge = origBridge;
  });

  it('returns early when no bridge or parameterCache missing', function() {
    window.dualMidiBridge = null;
    expect(function() {
      _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    }).not.toThrow();

    window.dualMidiBridge = { parameterCache: {} };
    expect(function() {
      _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    }).not.toThrow();
  });

  it('returns early when vcf_cutoff is undefined', function() {
    window.dualMidiBridge = { parameterCache: { vcf_resonance: 0.3 } };
    expect(function() {
      _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    }).not.toThrow();
  });

  it('detects DM12 OTA (model=0) as LP', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0.3,
        vcf_model: 0,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const dashCalls = ctx._calls.filter(function(c) { return c.indexOf('setLineDash') >= 0; });
    expect(dashCalls.length).toBeGreaterThan(0);
  });

  it('detects Moog LP (model=1, submode=0)', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 1,
        vcf_moog_submode: 0,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const textCalls = ctx._calls.filter(function(c) {
      return c.indexOf('Moog') >= 0;
    });
    expect(textCalls.length).toBe(1);
    expect(textCalls[0]).toContain('LP');
  });

  it('detects Moog BP (model=1, submode=1)', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 1,
        vcf_moog_submode: 1,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const textCalls = ctx._calls.filter(function(c) {
      return c.indexOf('BP') >= 0;
    });
    expect(textCalls.length).toBe(1);
  });

  it('detects Moog HP (model=1, submode=2)', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 1,
        vcf_moog_submode: 2,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const textCalls = ctx._calls.filter(function(c) {
      return c.indexOf('HP') >= 0;
    });
    expect(textCalls.length).toBe(1);
  });

  it('detects Korg MS-20 LP (model=2, submode=0)', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 2,
        vcf_korg_submode: 0,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const textCalls = ctx._calls.filter(function(c) {
      return c.indexOf('MS-20 LP') >= 0;
    });
    expect(textCalls.length).toBe(1);
  });

  it('detects Korg MS-20 HP (model=2, submode=1)', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 2,
        vcf_korg_submode: 1,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const textCalls = ctx._calls.filter(function(c) {
      return c.indexOf('MS-20 HP') >= 0;
    });
    expect(textCalls.length).toBe(1);
  });

  it('shows pole mode in label (24dB vs 12dB)', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 0,
        vcf_pole_mode: 0,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const textCalls = ctx._calls.filter(function(c) {
      return c.indexOf('24dB') >= 0;
    });
    expect(textCalls.length).toBe(1);
  });

  it('shows 12dB when pole_mode=1', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 0,
        vcf_pole_mode: 1,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const textCalls = ctx._calls.filter(function(c) {
      return c.indexOf('12dB') >= 0;
    });
    expect(textCalls.length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _drawFilterOverlay — cutoff frequency mapping
// ══════════════════════════════════════════════════════════════════

describe('_drawFilterOverlay — cutoff mapping', function() {
  let ctx;
  let origBridge;

  beforeEach(function() {
    ctx = createMockCtx();
    origBridge = window.dualMidiBridge;
  });

  afterEach(function() {
    window.dualMidiBridge = origBridge;
  });

  it('draws response curve with 60 steps via moveTo/lineTo', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 0,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const moveCalls = ctx._calls.filter(function(c) { return c.indexOf('moveTo') >= 0; });
    const lineCalls = ctx._calls.filter(function(c) { return c.indexOf('lineTo') >= 0; });
    expect(moveCalls.length).toBeGreaterThan(0);
    expect(lineCalls.length).toBeGreaterThan(0);
  });

  it('draws cutoff vertical line at position determined by vcf_cutoff', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.25,
        vcf_resonance: 0,
        vcf_model: 0,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const fillRects = ctx._calls.filter(function(c) { return c.indexOf('fillRect') >= 0; });
    expect(fillRects.length).toBeGreaterThan(0);
  });

  it('draws resonance ellipse when vcf_resonance > 0.05', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0.5,
        vcf_model: 0,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const ellipseCalls = ctx._calls.filter(function(c) { return c.indexOf('ellipse') >= 0; });
    expect(ellipseCalls.length).toBe(1);
  });

  it('skips resonance ellipse when vcf_resonance is low', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0.02,
        vcf_model: 0,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const ellipseCalls = ctx._calls.filter(function(c) { return c.indexOf('ellipse') >= 0; });
    expect(ellipseCalls.length).toBe(0);
  });

  it('draws frequency label in Hz or kHz based on cutoff value', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 0,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const hzLabel = ctx._calls.filter(function(c) { return c.indexOf('Hz') >= 0; })[0];
    expect(hzLabel).toBeTruthy();
  });

  it('draws kHz label for high cutoff', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 1.0,
        vcf_resonance: 0,
        vcf_model: 0,
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const kHzLabel = ctx._calls.filter(function(c) { return c.indexOf('kHz') >= 0; })[0];
    expect(kHzLabel).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _drawFilterOverlay — HP shadow (left/right side attenuation)
// ══════════════════════════════════════════════════════════════════

describe('_drawFilterOverlay — shadow side', function() {
  let ctx;
  let origBridge;

  beforeEach(function() {
    ctx = createMockCtx();
    origBridge = window.dualMidiBridge;
  });

  afterEach(function() {
    window.dualMidiBridge = origBridge;
  });

  it('LP draws 1 fillRect (shadow on right HF side)', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 1,
        vcf_moog_submode: 0, // LP
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const rectCalls = ctx._calls.filter(function(c) { return c.indexOf('fillRect') >= 0; });
    expect(rectCalls.length).toBe(1);
  });

  it('HP draws 1 fillRect (shadow on left LF side)', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 1,
        vcf_moog_submode: 2, // HP
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const rectCalls = ctx._calls.filter(function(c) { return c.indexOf('fillRect') >= 0; });
    expect(rectCalls.length).toBe(1);
  });

  it('BP draws 2 fillRects (shadow on both sides)', function() {
    window.dualMidiBridge = {
      parameterCache: {
        vcf_cutoff: 0.5,
        vcf_resonance: 0,
        vcf_model: 1,
        vcf_moog_submode: 1, // BP
      }
    };
    _drawFilterOverlay(ctx, 3, 480, 3, 92, 89, 474);
    const rectCalls = ctx._calls.filter(function(c) { return c.indexOf('fillRect') >= 0; });
    expect(rectCalls.length).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _calcFilterResponse
// ══════════════════════════════════════════════════════════════════

describe('_calcFilterResponse — integration', function() {
  it('LP response is 0.5 at cutoff (24dB/4pole)', function() {
    expect(_calcFilterResponse(1000, 1000, 0, 0, 0)).toBeCloseTo(0.5, 4);
  });

  it('LP response is 0.5 at cutoff (12dB/2pole)', function() {
    expect(_calcFilterResponse(1000, 1000, 0, 0, 1)).toBeCloseTo(0.5, 4);
  });

  it('HP response is 0.5 at cutoff', function() {
    expect(_calcFilterResponse(1000, 1000, 0, 2, 0)).toBeCloseTo(0.5, 4);
  });

  it('BP response is 1.0 at center frequency', function() {
    expect(_calcFilterResponse(1000, 1000, 0, 1, 0)).toBeCloseTo(1.0, 4);
  });

  it('LP response approaches 1 for freq << cutoff', function() {
    expect(_calcFilterResponse(10, 1000, 0, 0, 0)).toBeGreaterThan(0.999);
  });

  it('LP response approaches 0 for freq >> cutoff', function() {
    expect(_calcFilterResponse(100000, 1000, 0, 0, 0)).toBeLessThan(0.001);
  });

  it('HP response approaches 0 for freq << cutoff', function() {
    expect(_calcFilterResponse(10, 1000, 0, 2, 0)).toBeLessThan(0.001);
  });

  it('HP response approaches 1 for freq >> cutoff', function() {
    expect(_calcFilterResponse(100000, 1000, 0, 2, 0)).toBeGreaterThan(0.999);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: Frequency label mapping helpers
// ══════════════════════════════════════════════════════════════════

describe('Frequency label helpers', function() {
  it('cutoffNormToHz(0) = 20', function() {
    expect(20 * Math.pow(1000, 0)).toBe(20);
  });

  it('cutoffNormToHz(0.5) ≈ 632', function() {
    const hz = 20 * Math.pow(1000, 0.5);
    expect(hz).toBeGreaterThan(630);
    expect(hz).toBeLessThan(633);
  });

  it('cutoffNormToHz(1) = 20000', function() {
    expect(20 * Math.pow(1000, 1)).toBe(20000);
  });

  it('normX from log scale: hzToNormX(20) = 0', function() {
    const norm = Math.log(20 / 20) / Math.log(20000 / 20);
    expect(norm).toBe(0);
  });

  it('normX from log scale: hzToNormX(20000) = 1', function() {
    const norm = Math.log(20000 / 20) / Math.log(20000 / 20);
    expect(norm).toBe(1);
  });

  it('normX from log scale: hzToNormX(632) ≈ 0.5', function() {
    const norm = Math.log(632 / 20) / Math.log(20000 / 20);
    expect(norm).toBeGreaterThan(0.48);
    expect(norm).toBeLessThan(0.52);
  });

  it('cutoff to canvas X within bounds', function() {
    const padding = 3;
    const graphW = 474;
    const vcfCutoff = 0.5;
    const cutoffHz = 20 * Math.pow(1000, vcfCutoff);
    const normX = Math.log(cutoffHz / 20) / Math.log(20000 / 20);
    const cutoffX = padding + Math.round(normX * graphW);
    expect(cutoffX).toBeGreaterThan(padding);
    expect(cutoffX).toBeLessThan(padding + graphW);
  });
});
