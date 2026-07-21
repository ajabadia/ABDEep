import { describe, expect, it } from 'vitest';

import { getParamSpec } from '../deepmind/params/param-spec.js';
import { resolveNrpnValue } from './handlers.js';

describe('resolveNrpnValue', () => {
  // --- label mode ---

  it('resolves enum label to correct raw value', () => {
    const spec = getParamSpec('env.amp.triggerMode');
    const result = resolveNrpnValue('env.amp.triggerMode', spec, { label: 'Loop' });
    expect(result.nrpnValue).toBe(3);
    expect(result.displayValue).toContain('Loop');
  });

  it('label matching is case-insensitive', () => {
    const spec = getParamSpec('env.amp.triggerMode');
    const result = resolveNrpnValue('env.amp.triggerMode', spec, { label: 'lfo 1' });
    expect(result.nrpnValue).toBe(1);
  });

  it('throws on unknown label', () => {
    const spec = getParamSpec('env.amp.triggerMode');
    expect(() => resolveNrpnValue('env.amp.triggerMode', spec, { label: 'Bogus' })).toThrow(/Unknown label "Bogus"/);
  });

  it('throws when label used on non-enum param', () => {
    const spec = getParamSpec('filter.cutoff');
    expect(() => resolveNrpnValue('filter.cutoff', spec, { label: 'something' })).toThrow(/not an enum/);
  });

  // --- rawValue mode ---

  it('passes rawValue through as nrpnValue', () => {
    const spec = getParamSpec('env.amp.triggerMode');
    const result = resolveNrpnValue('env.amp.triggerMode', spec, { rawValue: 3 });
    expect(result.nrpnValue).toBe(3);
  });

  it('rounds fractional rawValue', () => {
    const spec = getParamSpec('filter.cutoff');
    const result = resolveNrpnValue('filter.cutoff', spec, { rawValue: 127.6 });
    expect(result.nrpnValue).toBe(128);
  });

  it('throws on out-of-range rawValue', () => {
    const spec = getParamSpec('env.amp.triggerMode'); // rawMax=4
    expect(() => resolveNrpnValue('env.amp.triggerMode', spec, { rawValue: 5 })).toThrow(/out of range/);
  });

  // --- normalized value mode ---

  it('encodes normalized value using codec', () => {
    const spec = getParamSpec('filter.cutoff'); // rawMax=255
    const result = resolveNrpnValue('filter.cutoff', spec, { value: 0.5 });
    expect(result.nrpnValue).toBe(128); // Math.round(0.5 * 255)
  });

  // --- validation ---

  it('throws when no value provided', () => {
    const spec = getParamSpec('filter.cutoff');
    expect(() => resolveNrpnValue('filter.cutoff', spec, {})).toThrow(/Provide exactly one/);
  });

  it('throws when multiple values provided', () => {
    const spec = getParamSpec('filter.cutoff');
    expect(() => resolveNrpnValue('filter.cutoff', spec, { value: 0.5, rawValue: 128 })).toThrow(
      /Provide exactly one/,
    );
  });

  // --- decoded rawMax bridge (FX params with synth-clamped ceilings) ---

  it('rawValue: rejects values above decoded rawMax even when spec rawMax is 255', () => {
    // rackAmp.drive live-confirmed: synth clamps at raw 40; spec is u8 (0..255)
    const spec = getParamSpec('fx1.rackAmp.drive');
    expect(() => resolveNrpnValue('fx1.rackAmp.drive', spec, { rawValue: 41 })).toThrow(
      /out of range 0\.\.40/,
    );
  });

  it('rawValue: accepts the decoded rawMax ceiling itself', () => {
    const spec = getParamSpec('fx1.rackAmp.drive');
    const result = resolveNrpnValue('fx1.rackAmp.drive', spec, { rawValue: 40 });
    expect(result.nrpnValue).toBe(40);
  });

  it('normalized value: value=1.0 maps to decoded rawMax (40), not spec rawMax (255)', () => {
    const spec = getParamSpec('fx1.rackAmp.drive');
    const result = resolveNrpnValue('fx1.rackAmp.drive', spec, { value: 1.0 });
    expect(result.nrpnValue).toBe(40);
  });

  it('normalized value: value=0.5 scales against decoded rawMax', () => {
    const spec = getParamSpec('fx1.rackAmp.drive'); // decoded rawMax=40
    const result = resolveNrpnValue('fx1.rackAmp.drive', spec, { value: 0.5 });
    expect(result.nrpnValue).toBe(20); // Math.round(0.5 * 40)
  });

  it('normalized value: params without decoded rawMax still use spec rawMax', () => {
    const spec = getParamSpec('filter.cutoff'); // no decoded rawMax override
    const result = resolveNrpnValue('filter.cutoff', spec, { value: 0.5 });
    expect(result.nrpnValue).toBe(128); // Math.round(0.5 * 255)
  });
});
