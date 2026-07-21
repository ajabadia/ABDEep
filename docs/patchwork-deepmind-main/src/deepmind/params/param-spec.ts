import { listDecodedFieldSpecs, type DecodedFieldSpec } from '../decoded-patch-map.js';

export type ParamKind = 'u8';

export type DeepMindParamSpec = {
  name: string;
  nrpn: { msb: number; lsb: number };
  kind: ParamKind;
  /** Optional raw bounds for non-0..255 u8 parameters (e.g., 0..150). */
  rawMin?: number;
  rawMax?: number;
};

/**
 * Hand-tuned overrides for params whose NRPN range differs from the
 * default 0..255 (e.g., FX output gains are 0..150).
 */
const PARAM_OVERRIDES: Record<string, Pick<DeepMindParamSpec, 'rawMin' | 'rawMax'>> = {
  'fx1.outputGain': { rawMin: 0, rawMax: 150 },
  'fx2.outputGain': { rawMin: 0, rawMax: 150 },
  'fx3.outputGain': { rawMin: 0, rawMax: 150 },
  'fx4.outputGain': { rawMin: 0, rawMax: 150 },
  'arp.swing': { rawMin: 0, rawMax: 25 },
  'arp.octaves': { rawMin: 0, rawMax: 5 },
  'pitchBend.upDepth': { rawMin: 0, rawMax: 24 },
  'pitchBend.downDepth': { rawMin: 0, rawMax: 24 },
};

function offsetToNrpn(offset: number): { msb: number; lsb: number } {
  return { msb: (offset >> 7) & 0x7f, lsb: offset & 0x7f };
}

function buildParamSpecs(): Record<string, DeepMindParamSpec> {
  const specs: Record<string, DeepMindParamSpec> = {};

  for (const field of listDecodedFieldSpecs()) {
    // Only u8 fields are sendable as NRPN values today.
    if (field.kind.type !== 'u8') continue;

    const override = PARAM_OVERRIDES[field.name];

    // Auto-derive rawMax from valueMap for enum params (e.g., arp.mode 0-10)
    // so normalized 0..1 maps to the actual valid range, not 0..255.
    let inferredMax: number | undefined;
    if (!override?.rawMax && field.valueMap) {
      const keys = Object.keys(field.valueMap).map(Number);
      if (keys.length > 0) {
        inferredMax = Math.max(...keys);
      }
    }

    specs[field.name] = {
      name: field.name,
      nrpn: offsetToNrpn(field.offset),
      kind: 'u8',
      ...(inferredMax !== undefined ? { rawMax: inferredMax } : {}),
      ...override,
    };
  }

  return specs;
}

// Auto-generated from DECODED_EDIT_BUFFER_MAP: every u8 decoded field
// becomes a settable param via set_param / set_params.
export const PARAM_SPECS: Record<string, DeepMindParamSpec> = buildParamSpecs();

export function hasParamSpec(name: string): boolean {
  return name in PARAM_SPECS;
}

export function getParamSpec(name: string): DeepMindParamSpec {
  const spec = PARAM_SPECS[name];
  if (!spec) {
    throw new Error(`Unsupported param: ${name}`);
  }
  return spec;
}
