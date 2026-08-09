/**
 * Unit tests for panel_oscilloscope.js filter overlay functions:
 *   - _calcFilterResponse(freqHz, cutoffHz, res, type, poles)
 *
 * These functions are extracted from the source file and tested in isolation.
 *
 * Run with: npx vitest run WebUI/tests/scopeFilterOverlay.test.js
 */

import { describe, it, expect } from 'vitest';

// ══════════════════════════════════════════════════════════════════
// Extracted from panel_oscilloscope.js
// ══════════════════════════════════════════════════════════════════

/**
 * Calculates the filter response for a given frequency.
 * @param {number} freqHz  Frequency to evaluate
 * @param {number} cutoffHz  Cutoff frequency
 * @param {number} res  Resonance (0-1)
 * @param {number} type  0=LP, 1=BP, 2=HP
 * @param {number} poles 0=24dB/4pole, 1=12dB/2pole
 * @returns {number} 0 (fully attenuated) to 1 (no attenuation)
 */
function _calcFilterResponse(freqHz, cutoffHz, res, type, poles) {
  if (cutoffHz <= 0) {return (type === 2) ? 1 : 0;}

  const ratio = freqHz / cutoffHz;
  const slope = (poles === 0) ? 4 : 2; // 24dB = 4th order, 12dB = 2nd order

  let response;
  if (type === 0) {
    // Low Pass: 1 / (1 + (ratio)^(2*slope))
    response = 1 / (1 + Math.pow(ratio, 2 * slope));
  } else if (type === 2) {
    // High Pass: 1 / (1 + (1/ratio)^(2*slope))
    response = 1 / (1 + Math.pow(1 / Math.max(ratio, 0.001), 2 * slope));
  } else {
    // Band Pass: 2*ratio / (1 + ratio^2) — peaks at 1.0 at center frequency
    response = Math.max(0, 2 * ratio / (1 + ratio * ratio));
  }

  // Resonance peak at cutoff
  if (res > 0.01 && type !== 1) {
    const peakWidth = 1 + res * 5;
    const peakGain = 1 + res * 2.5;
    const peak = peakGain / (1 + Math.pow((freqHz / cutoffHz - 1) * peakWidth, 2));
    response = Math.min(1, response + (peak - 1) * res * 0.6);
  }

  return Math.max(0, Math.min(1, response));
}

// ══════════════════════════════════════════════════════════════════
// Helpers: convert normalized cutoff (0-1) to Hz
// ══════════════════════════════════════════════════════════════════

function cutoffNormToHz(norm) {
  return 20 * Math.pow(1000, norm);
}

function hzToNormX(hz) {
  return Math.log(hz / 20) / Math.log(20000 / 20);
}

// ══════════════════════════════════════════════════════════════════
// Tests: _calcFilterResponse — Low Pass (type=0)
// ══════════════════════════════════════════════════════════════════

describe('_calcFilterResponse — Low Pass (type=0)', () => {
  const cutoff = 1000; // 1kHz
  const res = 0;

  it('passes frequencies well below cutoff (response ≈ 1)', () => {
    expect(_calcFilterResponse(100, cutoff, res, 0, 0)).toBeGreaterThan(0.99);
    expect(_calcFilterResponse(100, cutoff, res, 0, 1)).toBeGreaterThan(0.99);
  });

  it('attenuates frequencies well above cutoff (response ≈ 0)', () => {
    expect(_calcFilterResponse(10000, cutoff, res, 0, 0)).toBeLessThan(0.01);
    expect(_calcFilterResponse(10000, cutoff, res, 0, 1)).toBeLessThan(0.01);
  });

  it('has response of 0.5 at cutoff (ratio=1)', () => {
    // 1/(1+1^(2*4)) = 1/(1+1) = 0.5 for 24dB
    expect(_calcFilterResponse(cutoff, cutoff, res, 0, 0)).toBeCloseTo(0.5, 4);
    // 1/(1+1^(2*2)) = 1/(1+1) = 0.5 for 12dB
    expect(_calcFilterResponse(cutoff, cutoff, res, 0, 1)).toBeCloseTo(0.5, 4);
  });

  it('has steeper rolloff for 24dB (4-pole) vs 12dB (2-pole)', () => {
    const resp24 = _calcFilterResponse(2000, cutoff, res, 0, 0); // 2x cutoff
    const resp12 = _calcFilterResponse(2000, cutoff, res, 0, 1);
    // 24dB should attenuate more at 2x cutoff
    expect(resp24).toBeLessThan(resp12);
  });

  it('is monotonic decreasing', () => {
    let prev = 1;
    for (let f = 10; f <= 20000; f *= 2) {
      const r = _calcFilterResponse(f, cutoff, res, 0, 0);
      expect(r).toBeLessThanOrEqual(prev + 0.001); // Allow tiny FP imprecision
      prev = r;
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _calcFilterResponse — High Pass (type=2)
// ══════════════════════════════════════════════════════════════════

describe('_calcFilterResponse — High Pass (type=2)', () => {
  const cutoff = 1000;
  const res = 0;

  it('attenuates frequencies well below cutoff (response ≈ 0)', () => {
    expect(_calcFilterResponse(50, cutoff, res, 2, 0)).toBeLessThan(0.01);
    expect(_calcFilterResponse(50, cutoff, res, 2, 1)).toBeLessThan(0.01);
  });

  it('passes frequencies well above cutoff (response ≈ 1)', () => {
    expect(_calcFilterResponse(10000, cutoff, res, 2, 0)).toBeGreaterThan(0.99);
    expect(_calcFilterResponse(10000, cutoff, res, 2, 1)).toBeGreaterThan(0.99);
  });

  it('has response of 0.5 at cutoff (ratio=1)', () => {
    expect(_calcFilterResponse(cutoff, cutoff, res, 2, 0)).toBeCloseTo(0.5, 4);
    expect(_calcFilterResponse(cutoff, cutoff, res, 2, 1)).toBeCloseTo(0.5, 4);
  });

  it('has steeper rolloff for 24dB below cutoff', () => {
    const resp24 = _calcFilterResponse(500, cutoff, res, 2, 0); // 0.5x cutoff
    const resp12 = _calcFilterResponse(500, cutoff, res, 2, 1);
    expect(resp24).toBeLessThan(resp12);
  });

  it('is monotonic increasing', () => {
    let prev = 1;
    for (let f = 20000; f >= 10; f /= 2) {
      const r = _calcFilterResponse(f, cutoff, res, 2, 0);
      expect(r).toBeLessThanOrEqual(prev + 0.001);
      prev = r;
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _calcFilterResponse — Band Pass (type=1)
// ══════════════════════════════════════════════════════════════════

describe('_calcFilterResponse — Band Pass (type=1)', () => {
  const center = 1000;
  const res = 0;

  it('peaks at 1.0 at center frequency', () => {
    expect(_calcFilterResponse(center, center, res, 1, 0)).toBeCloseTo(1.0, 4);
  });

  it('attenuates at 0.5x center', () => {
    const r = _calcFilterResponse(500, center, res, 1, 0);
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(0.9);
  });

  it('attenuates at 2x center', () => {
    const r = _calcFilterResponse(2000, center, res, 1, 0);
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(0.9);
  });

  it('approachs 0 at extremes', () => {
    expect(_calcFilterResponse(10, center, res, 1, 0)).toBeLessThan(0.05);
    // BP decays as 2*ratio/(1+ratio^2), needs ratio > 100 to get below 0.02
    expect(_calcFilterResponse(100000, center, res, 1, 0)).toBeLessThan(0.02);
  });

  it('is symmetric on log scale', () => {
    // 500Hz and 2000Hz should have same response (both 1 octave away)
    const low = _calcFilterResponse(500, center, res, 1, 0);
    const high = _calcFilterResponse(2000, center, res, 1, 0);
    expect(Math.abs(low - high)).toBeLessThan(0.01);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _calcFilterResponse — Resonance peak
// ══════════════════════════════════════════════════════════════════

describe('_calcFilterResponse — Resonance peak', () => {
  const cutoff = 1000;

  it('adds a peak at cutoff when resonance > 0 (LP)', () => {
    const noRes = _calcFilterResponse(cutoff, cutoff, 0, 0, 0);
    const withRes = _calcFilterResponse(cutoff, cutoff, 0.5, 0, 0);
    expect(withRes).toBeGreaterThan(noRes);
  });

  it('adds a peak at cutoff when resonance > 0 (HP)', () => {
    const noRes = _calcFilterResponse(cutoff, cutoff, 0, 2, 0);
    const withRes = _calcFilterResponse(cutoff, cutoff, 0.5, 2, 0);
    expect(withRes).toBeGreaterThan(noRes);
  });

  it('does NOT add resonance peak for BP (type 1)', () => {
    const noRes = _calcFilterResponse(cutoff, cutoff, 0, 1, 0);
    const withRes = _calcFilterResponse(cutoff, cutoff, 0.5, 1, 0);
    // BP already peaks at 1.0, resonance should not exceed 1.0
    expect(withRes).toBeLessThanOrEqual(1.0);
    expect(withRes).toBeCloseTo(noRes, 1);
  });

  it('peak height increases with resonance value', () => {
    const lowRes = _calcFilterResponse(cutoff, cutoff, 0.25, 0, 0);
    const highRes = _calcFilterResponse(cutoff, cutoff, 0.75, 0, 0);
    expect(highRes).toBeGreaterThan(lowRes);
  });

  it('is clamped to max 1.0', () => {
    const r = _calcFilterResponse(cutoff, cutoff, 1.0, 0, 0);
    expect(r).toBeLessThanOrEqual(1.0);
  });

  it('is clamped to min 0.0', () => {
    const r = _calcFilterResponse(999999, cutoff, 0, 0, 0);
    expect(r).toBeGreaterThanOrEqual(0.0);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: _calcFilterResponse — Edge cases
// ══════════════════════════════════════════════════════════════════

describe('_calcFilterResponse — Edge cases', () => {
  it('handles cutoffHz=0: LP returns 0, HP returns 1', () => {
    expect(_calcFilterResponse(100, 0, 0, 0, 0)).toBe(0);
    expect(_calcFilterResponse(100, 0, 0, 2, 0)).toBe(1);
  });

  it('handles cutoffHz=0 for BP', () => {
    expect(_calcFilterResponse(100, 0, 0, 1, 0)).toBe(0);
  });

  it('handles freqHz=0 for HP (via Math.max anti-division)', () => {
    // freqHz=0 → ratio=0 → 1/0 is prevented by Math.max(ratio, 0.001)
    expect(function() {
      _calcFilterResponse(0, 1000, 0, 2, 0);
    }).not.toThrow();
  });

  it('handles very large ratio values for LP', () => {
    // freqHz >> cutoffHz → ratio very large → response ≈ 0
    const r = _calcFilterResponse(1e9, 20, 0, 0, 0);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(0.001);
  });

  it('handles freqHz equal to cutoffHz for all 3 types', () => {
    const lp = _calcFilterResponse(500, 500, 0, 0, 0);
    const bp = _calcFilterResponse(500, 500, 0, 1, 0);
    const hp = _calcFilterResponse(500, 500, 0, 2, 0);
    expect(lp).toBeCloseTo(0.5, 4);
    expect(bp).toBeCloseTo(1.0, 4);
    expect(hp).toBeCloseTo(0.5, 4);
  });
});

// ══════════════════════════════════════════════════════════════════
// Tests: cutoff frequency mapping
// ══════════════════════════════════════════════════════════════════

describe('Cutoff frequency mapping', () => {
  it('maps norm=0 to 20Hz', () => {
    expect(cutoffNormToHz(0)).toBeCloseTo(20, 0);
  });

  it('maps norm=0.5 to ~632Hz', () => {
    const hz = cutoffNormToHz(0.5);
    expect(hz).toBeGreaterThan(600);
    expect(hz).toBeLessThan(650);
  });

  it('maps norm=1 to 20000Hz', () => {
    expect(cutoffNormToHz(1)).toBeCloseTo(20000, 0);
  });

  it('maps norm=0.25 to ~112Hz', () => {
    const hz = cutoffNormToHz(0.25);
    expect(hz).toBeGreaterThan(100);
    expect(hz).toBeLessThan(130);
  });

  it('maps norm=0.75 to ~3560Hz', () => {
    const hz = cutoffNormToHz(0.75);
    expect(hz).toBeGreaterThan(3000);
    expect(hz).toBeLessThan(4000);
  });

  it('hzToNormX is inverse of cutoffNormToHz', () => {
    for (let norm = 0.1; norm <= 0.9; norm += 0.2) {
      const hz = cutoffNormToHz(norm);
      const back = hzToNormX(hz);
      expect(Math.abs(back - norm)).toBeLessThan(0.01);
    }
  });
});
