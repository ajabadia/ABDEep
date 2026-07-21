/**
 * DeepMind parameter alias resolution.
 *
 * Deterministic: exact-match mapping for common synonyms.
 * Non-goal: fuzzy matching.
 */

function normalizeKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

const ALIASES: Record<string, string> = {
  // Filter / VCF
  'filter.frequency': 'filter.cutoff',
  'filter.freq': 'filter.cutoff',
  'vcf.cutoff': 'filter.cutoff',
  'vcf.frequency': 'filter.cutoff',
  'vcf.freq': 'filter.cutoff',
  'vcf.resonance': 'filter.resonance',
  'vcf.res': 'filter.resonance',

  // Amp envelope
  'amp_env.attack': 'env.amp.attack',
  'amp_env.decay': 'env.amp.decay',
  'amp_env.sustain': 'env.amp.sustain',
  'amp_env.release': 'env.amp.release',

  'amp.env.attack': 'env.amp.attack',
  'amp.env.decay': 'env.amp.decay',
  'amp.env.sustain': 'env.amp.sustain',
  'amp.env.release': 'env.amp.release',

  // Filter envelope
  'filter_env.attack': 'env.filter.attack',
  'filter_env.decay': 'env.filter.decay',
  'filter_env.sustain': 'env.filter.sustain',
  'filter_env.release': 'env.filter.release',
  // Normalized form when '_' becomes '.'
  'filter.env.attack': 'env.filter.attack',
  'filter.env.decay': 'env.filter.decay',
  'filter.env.sustain': 'env.filter.sustain',
  'filter.env.release': 'env.filter.release',

  // FX mix
  'fx.wet': 'fx.mix',
  'fx.drywet': 'fx.mix',
  'fx.dry.wet': 'fx.mix',

  // FX output gain
  'fx1.gain': 'fx1.outputGain',
  'fx2.gain': 'fx2.outputGain',
  'fx3.gain': 'fx3.outputGain',
  'fx4.gain': 'fx4.outputGain',
};

export function resolveParamAlias(input: string): string | null {
  const normalized = normalizeKey(input);
  return ALIASES[normalized] ?? null;
}
