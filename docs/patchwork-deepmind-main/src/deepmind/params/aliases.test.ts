import { describe, expect, it } from 'vitest';
import { resolveParamAlias } from './aliases.js';

describe('DeepMind param aliases', () => {
  it('maps filter frequency synonyms to cutoff', () => {
    expect(resolveParamAlias('filter.frequency')).toBe('filter.cutoff');
    expect(resolveParamAlias('FILTER_FREQ')).toBe('filter.cutoff');
    expect(resolveParamAlias('vcf.cutoff')).toBe('filter.cutoff');
  });

  it('maps envelope synonyms deterministically', () => {
    expect(resolveParamAlias('amp_env.attack')).toBe('env.amp.attack');
    expect(resolveParamAlias('filter_env.release')).toBe('env.filter.release');
  });

  it('returns null when no mapping exists', () => {
    expect(resolveParamAlias('osc.wave')).toBeNull();
  });
});
