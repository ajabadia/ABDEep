export type NrpnSpec = {
  /** NRPN number (0..240), where MSB = nrpn >> 7 and LSB = nrpn & 0x7f */
  nrpn: number;
  /** Human-friendly name (stable) */
  name: string;
  /** Range hint in raw units (usually 0..255) */
  range: string;
  /** Notes for LLM reasoning / safety */
  notes?: string;
};

// Curated list of commonly-used + recently-reverse-engineered NRPNs.
// This is intentionally small and can grow over time.
export const NRPN_SPECS: readonly NrpnSpec[] = [
  { nrpn: 0, name: 'lfo1.rate', range: '0–255', notes: 'LFO 1 rate (meaning depends on sync mode).' },
  { nrpn: 7, name: 'lfo2.rate', range: '0–255', notes: 'LFO 2 rate (meaning depends on sync mode).' },

  { nrpn: 39, name: 'filter.cutoff', range: '0–255', notes: 'Lower = darker, higher = brighter.' },
  { nrpn: 41, name: 'filter.resonance', range: '0–255', notes: 'Higher emphasizes cutoff; can whistle at high values.' },

  { nrpn: 53, name: 'env.amp.attack', range: '0–255', notes: 'Higher = slower attack (pad-like).' },
  { nrpn: 54, name: 'env.amp.decay', range: '0–255' },
  { nrpn: 55, name: 'env.amp.sustain', range: '0–255' },
  { nrpn: 56, name: 'env.amp.release', range: '0–255', notes: 'Higher = longer tail.' },

  { nrpn: 62, name: 'env.filter.attack', range: '0–255' },
  { nrpn: 63, name: 'env.filter.decay', range: '0–255' },
  { nrpn: 64, name: 'env.filter.sustain', range: '0–255' },
  { nrpn: 65, name: 'env.filter.release', range: '0–255' },

  { nrpn: 165, name: 'fx.routing', range: '0–9', notes: 'Connection mode M-1..M-10 (valueMap lives in decoded snapshot).' },
  { nrpn: 166, name: 'fx1.type', range: '0–35', notes: 'FX type enum (not ordered like manual list).' },
  {
    nrpn: 167,
    name: 'fx1.params.1-12',
    range: '0–255',
    notes:
      'Per-effect. Param meaning depends on fx1.type; see decoded snapshot fields fx1.<effect>.<key> when type matches.',
  },
  { nrpn: 179, name: 'fx2.type', range: '0–35' },
  { nrpn: 180, name: 'fx2.params.1-12', range: '0–255', notes: 'Per-effect; meaning depends on fx2.type.' },
  { nrpn: 192, name: 'fx3.type', range: '0–35' },
  { nrpn: 193, name: 'fx3.params.1-12', range: '0–255', notes: 'Per-effect; meaning depends on fx3.type.' },
  { nrpn: 205, name: 'fx4.type', range: '0–35' },
  { nrpn: 206, name: 'fx4.params.1-12', range: '0–255', notes: 'Per-effect; meaning depends on fx4.type.' },
  { nrpn: 218, name: 'fx1.outputGain', range: '0–150' },
  { nrpn: 219, name: 'fx2.outputGain', range: '0–150' },
  { nrpn: 220, name: 'fx3.outputGain', range: '0–150' },
  { nrpn: 221, name: 'fx4.outputGain', range: '0–150' },
  { nrpn: 222, name: 'fx.mode', range: '0–255', notes: 'Enum pending (Insert/Send/Bypass).' },
];
