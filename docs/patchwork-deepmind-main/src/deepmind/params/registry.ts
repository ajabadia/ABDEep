import { getDecodedFieldSpec, listDecodedFieldSpecs, type DecodedFieldSpec } from '../decoded-patch-map.js';
import { resolveParamAlias } from './aliases.js';
import { getParamSpec, hasParamSpec, PARAM_SPECS, type DeepMindParamSpec } from './param-spec.js';

export type ParamEnumEntry = { value: number; label: string };

export type ParamSettableInfo = {
  nrpn: { msb: number; lsb: number };
  kind: DeepMindParamSpec['kind'];
  rawMin: number;
  rawMax: number;
  normalizedMin: number;
  normalizedMax: number;
};

export type ParamDecodedInfo = {
  offset: number;
  kind: DecodedFieldSpec['kind']['type'];
  rawMin: number;
  rawMax: number;
  normalizedMin: number;
  normalizedMax: number;
  ui?: DecodedFieldSpec['ui'];
  value?: DecodedFieldSpec['value'];
  notes?: string;
  condition?: { field: string; equals: number };
};

export type ParamInfo = {
  /** Canonical name used by the system. */
  name: string;
  /** Whether the param is settable via set_param/set_params (curated NRPN param-spec table). */
  settable?: ParamSettableInfo;
  /** Whether the param is decodable from edit-buffer snapshots. */
  decoded?: ParamDecodedInfo;
  /** Enum-like labels for raw values, when known. */
  enum?: { values: ParamEnumEntry[] };
};

function enumFromValueMap(valueMap: Record<number, string> | undefined): ParamEnumEntry[] | undefined {
  if (!valueMap) return undefined;
  const values = Object.entries(valueMap)
    .map(([k, label]) => ({ value: Number(k), label }))
    .filter((v) => Number.isFinite(v.value))
    .sort((a, b) => a.value - b.value);
  return values;
}

function settableInfo(spec: DeepMindParamSpec): ParamSettableInfo {
  const rawMin = spec.rawMin ?? 0;
  const rawMax = spec.rawMax ?? 255;
  return {
    nrpn: spec.nrpn,
    kind: spec.kind,
    rawMin,
    rawMax,
    normalizedMin: 0,
    normalizedMax: 1,
  };
}

function decodedInfo(spec: DecodedFieldSpec): ParamDecodedInfo {
  let rawMax: number;
  switch (spec.kind.type) {
    case 'u7':
      rawMax = 127;
      break;
    case 'u8':
      rawMax = 255;
      break;
    case 'u14_be':
      rawMax = 16383;
      break;
    default: {
      const _exhaustive: never = spec.kind;
      throw new Error(`Unsupported decoded kind: ${JSON.stringify(_exhaustive)}`);
    }
  }

  // Prefer the explicit usable rawMax from value metadata over the bit-width default.
  const effectiveRawMax = spec.value?.rawMax ?? rawMax;

  return {
    offset: spec.offset,
    kind: spec.kind.type,
    rawMin: 0,
    rawMax: effectiveRawMax,
    normalizedMin: 0,
    normalizedMax: 1,
    ui: spec.ui,
    value: spec.value,
    notes: spec.notes,
    condition: spec.condition,
  };
}

function buildParamInfo(name: string): ParamInfo {
  const decodedSpec = getDecodedFieldSpec(name);
  const spec = hasParamSpec(name) ? getParamSpec(name) : undefined;

  return {
    name,
    settable: spec ? settableInfo(spec) : undefined,
    decoded: decodedSpec ? decodedInfo(decodedSpec) : undefined,
    enum: decodedSpec?.valueMap ? { values: enumFromValueMap(decodedSpec.valueMap) ?? [] } : undefined,
  };
}

let _index: Map<string, ParamInfo> | null = null;

function getIndex(): Map<string, ParamInfo> {
  if (_index) return _index;

  const index = new Map<string, ParamInfo>();

  // Start with all decoded fields (broad surface area).
  for (const s of listDecodedFieldSpecs()) {
    index.set(s.name, buildParamInfo(s.name));
  }

  // Add settable-only params not present in decoded map.
  // NOTE: Param-spec is intentionally small right now, so iterating keys is fine.
  for (const name of Object.keys(PARAM_SPECS)) {
    if (!index.has(name)) index.set(name, buildParamInfo(name));
  }

  _index = index;
  return index;
}

export function resolveParamNameForInfo(input: string): string | null {
  const raw = input.trim();
  const idx = getIndex();
  if (idx.has(raw)) return raw;

  const alias = resolveParamAlias(raw);
  if (alias && idx.has(alias)) return alias;

  return null;
}

export function getParamInfo(input: string): ParamInfo | null {
  const resolved = resolveParamNameForInfo(input);
  if (!resolved) return null;
  return getIndex().get(resolved) ?? null;
}

export function listParamInfos(): ParamInfo[] {
  return [...getIndex().values()];
}
