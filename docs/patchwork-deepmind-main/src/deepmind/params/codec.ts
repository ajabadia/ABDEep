import type { DeepMindParamSpec } from './param-spec.js';

export function encodeNormalizedToNrpnValue(spec: DeepMindParamSpec, normalized: number, effectiveRawMax?: number): number {
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    throw new Error(`Value must be normalized 0..1 (got ${normalized})`);
  }

  switch (spec.kind) {
    case 'u8': {
      const rawMin = spec.rawMin ?? 0;
      const rawMax = effectiveRawMax ?? spec.rawMax ?? 255;
      if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax) || rawMin < 0 || rawMax > 255 || rawMin > rawMax) {
        throw new Error(`Invalid raw range for ${spec.name}: ${rawMin}..${rawMax}`);
      }
      const raw = Math.round(rawMin + normalized * (rawMax - rawMin));
      return Math.max(rawMin, Math.min(rawMax, raw));
    }
    default: {
      const _exhaustive: never = spec.kind;
      throw new Error(`Unsupported param kind: ${String(_exhaustive)}`);
    }
  }
}
