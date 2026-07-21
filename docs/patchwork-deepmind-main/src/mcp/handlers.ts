import { resolveParamAlias } from '../deepmind/params/aliases.js';
import { encodeNormalizedToNrpnValue } from '../deepmind/params/codec.js';
import { getParamSpec, hasParamSpec, type DeepMindParamSpec } from '../deepmind/params/param-spec.js';
import { NRPN_SPECS } from '../deepmind/nrpn-spec.js';
import { getParamInfo } from '../deepmind/params/registry.js';
import { FX_TYPE_VALUE_MAP, listDecodedFieldSpecs } from '../deepmind/decoded-patch-map.js';
import { patchEditBuffer, snapshotEditBuffer } from '../deepmind/snapshot.js';
import { getDeepMindTransport } from '../deepmind/transport.js';

function resolveParamOrThrow(input: string): string {
  // Rule: exact spec match wins, else deterministic alias, else reject.
  if (hasParamSpec(input)) return input;
  const alias = resolveParamAlias(input);
  if (alias && hasParamSpec(alias)) return alias;
  throw new Error(`Unsupported param: ${input}`);
}

export type ValueInput = { value?: number; rawValue?: number; label?: string };

/**
 * Resolve a value input (normalized, raw integer, or enum label) to the raw
 * NRPN value to send and a human-readable display string.
 * Exported for testing.
 */
export function resolveNrpnValue(
  resolved: string,
  spec: DeepMindParamSpec,
  input: ValueInput,
): { nrpnValue: number; displayValue: string } {
  const provided = [input.value !== undefined, input.rawValue !== undefined, input.label !== undefined].filter(
    Boolean,
  ).length;
  if (provided !== 1) {
    throw new Error('Provide exactly one of: value (normalized 0..1), rawValue (raw integer), or label (enum string)');
  }

  const info = getParamInfo(resolved);
  const specRawMax = spec.rawMax ?? 255;
  const effectiveRawMax =
    info?.decoded?.rawMax !== undefined ? Math.min(info.decoded.rawMax, specRawMax) : specRawMax;

  if (input.label !== undefined) {
    if (!info?.enum) throw new Error(`Param ${resolved} is not an enum — cannot use label`);
    const match = info.enum.values.find((v) => v.label.toLowerCase() === input.label!.toLowerCase());
    if (!match) {
      const valid = info.enum.values.map((v) => v.label).join(', ');
      throw new Error(`Unknown label "${input.label}" for ${resolved}. Valid: ${valid}`);
    }
    return { nrpnValue: match.value, displayValue: `"${match.label}" (raw ${match.value})` };
  }

  if (input.rawValue !== undefined) {
    const rawMin = spec.rawMin ?? 0;
    const raw = Math.round(input.rawValue);
    if (raw < rawMin || raw > effectiveRawMax) {
      throw new Error(`rawValue ${raw} out of range ${rawMin}..${effectiveRawMax} for ${resolved}`);
    }
    return { nrpnValue: raw, displayValue: `raw ${raw}` };
  }

  // Normalized value — scale against effective (decoded) rawMax, not bit-width default
  const nrpnValue = encodeNormalizedToNrpnValue(spec, input.value!, effectiveRawMax);
  return { nrpnValue, displayValue: input.value!.toFixed(3) };
}


export async function handleDescribeNrpn(params: { query?: string }): Promise<{
  success: boolean;
  count: number;
  items: Array<{ nrpn: number; msb: number; lsb: number; name: string; range: string; notes?: string }>;
  resources?: string[];
}> {
  const q = params.query?.trim().toLowerCase();
  const filtered = q
    ? NRPN_SPECS.filter((s) => {
        const hay = `${s.name} ${s.range} ${s.notes ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
    : [...NRPN_SPECS];

  const items = filtered
    .map((s) => {
      const msb = (s.nrpn >> 7) & 0x7f;
      const lsb = s.nrpn & 0x7f;
      return { nrpn: s.nrpn, msb, lsb, name: s.name, range: s.range, notes: s.notes };
    })
    .sort((a, b) => a.nrpn - b.nrpn);

  return {
    success: true,
    count: items.length,
    items,
    resources: ['deepmind12://references/deepmind_nrpn'],
  };
}

export async function handleDescribeParam(params: { param: string }): Promise<{
  success: boolean;
  inputParam: string;
  resolvedParam: string;
  resources?: string[];
  paramSpec?: {
    nrpn: { msb: number; lsb: number };
    kind: string;
    rawMin: number;
    rawMax: number;
    normalizedMin: number;
    normalizedMax: number;
  };
  decodedField?: {
    offset: number;
    kind: string;
    rawMin: number;
    rawMax: number;
    normalizedMin: number;
    normalizedMax: number;
    ui?: { abbr?: string; name?: string; index?: number };
    value?: {
      units?: string;
      min?: number;
      max?: number;
      modDestination?: boolean;
      displayBuckets?: Array<{ rawMin: number; rawMax: number; label: string }>;
    };
    notes?: string;
    condition?: { field: string; equals: number };
  };
  enum?: {
    count: number;
    values: Array<{ value: number; label: string }>;
  };
}> {
  const info = getParamInfo(params.param);
  if (!info) {
    throw new Error(`Unknown param: ${params.param}`);
  }

  const resources: string[] = ['deepmind12://capabilities/param-description'];

  return {
    success: true,
    inputParam: params.param,
    resolvedParam: info.name,
    resources,
    paramSpec: info.settable
      ? {
          nrpn: info.settable.nrpn,
          kind: info.settable.kind,
          rawMin: info.settable.rawMin,
          rawMax: info.settable.rawMax,
          normalizedMin: info.settable.normalizedMin,
          normalizedMax: info.settable.normalizedMax,
        }
      : undefined,
    decodedField: info.decoded
      ? {
          offset: info.decoded.offset,
          kind: info.decoded.kind,
          rawMin: info.decoded.rawMin,
          rawMax: info.decoded.rawMax,
          normalizedMin: info.decoded.normalizedMin,
          normalizedMax: info.decoded.normalizedMax,
          ui: info.decoded.ui,
          value: info.decoded.value,
          notes: info.decoded.notes,
          condition: info.decoded.condition,
        }
      : undefined,
    enum: info.enum
      ? {
          count: info.enum.values.length,
          values: info.enum.values,
        }
      : undefined,
  };
}

export async function handleSetParam(params: {
  param: string;
  value?: number;
  rawValue?: number;
  label?: string;
  synthId?: string;
}): Promise<{ success: boolean; message: string; resolvedParam?: string }> {
  const resolved = resolveParamOrThrow(params.param);
  const spec = getParamSpec(resolved);
  const { nrpnValue, displayValue } = resolveNrpnValue(resolved, spec, params);

  const transport = await getDeepMindTransport();
  transport.nrpn.send(spec.nrpn, nrpnValue, { enableAddressCaching: true });

  return {
    success: true,
    resolvedParam: resolved,
    message: `Set ${resolved} to ${displayValue} (NRPN ${spec.nrpn.msb}/${spec.nrpn.lsb} -> ${nrpnValue})`,
  };
}

export async function handleSetParams(params: {
  params: Array<{ param: string; value?: number; rawValue?: number; label?: string }>;
  synthId?: string;
}): Promise<{ success: boolean; message: string; resolvedCount: number }> {
  const transport = await getDeepMindTransport();

  const resolved = params.params.map((p) => {
    const resolvedName = resolveParamOrThrow(p.param);
    const spec = getParamSpec(resolvedName);
    const { nrpnValue } = resolveNrpnValue(resolvedName, spec, p);
    return { spec, nrpnValue, param: resolvedName };
  });

  // Sort by NRPN address to maximize the benefit of address caching.
  resolved.sort((a, b) => (a.spec.nrpn.msb - b.spec.nrpn.msb) || (a.spec.nrpn.lsb - b.spec.nrpn.lsb));

  for (const item of resolved) {
    transport.nrpn.send(item.spec.nrpn, item.nrpnValue, { enableAddressCaching: true });
  }

  return {
    success: true,
    resolvedCount: resolved.length,
    message: `Applied ${resolved.length} params via NRPN`,
  };
}

export async function handleSnapshotState(_params: { synthId?: string }): Promise<{
  success: boolean;
  message: string;
  state?: unknown;
  sysex?: unknown;
}> {
  const transport = await getDeepMindTransport();

  const timeoutMsRaw = process.env.SNAPSHOT_TIMEOUT_MS;
  const timeoutMs = timeoutMsRaw ? Number(timeoutMsRaw) : 15000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid SNAPSHOT_TIMEOUT_MS: ${timeoutMsRaw}`);
  }

  const snapshot = await snapshotEditBuffer({
    port: transport.port,
    deviceId: transport.deviceId,
    timeoutMs,
  });

  const includeSysex = (_params as { includeSysex?: boolean }).includeSysex ?? false;
  const includeBytes = (_params as { includeBytes?: boolean }).includeBytes ?? true;

  const bytes = Buffer.from(snapshot.decodedTrimmedBase64, 'base64');

  return {
    success: true,
    message: `Captured edit-buffer snapshot (decoded ${snapshot.meta.decodedLength} bytes, trimmed ${snapshot.meta.decodedTrimmedLength} bytes)`,
    state: {
      meta: snapshot.meta,
      params: snapshot.derived ?? {},
      ...(includeBytes ? { editBufferBytes: Array.from(bytes.values()) } : {}),
    },
    ...(includeSysex
      ? {
          sysex: {
            rawSysexBase64: snapshot.rawSysexBase64,
            decodedPayloadBase64: snapshot.decodedPayloadBase64,
            decodedTrimmedBase64: snapshot.decodedTrimmedBase64,
          },
        }
      : {}),
  };
}

export async function handleSendNrpn(params: {
  nrpn: number;
  value: number;
  synthId?: string;
}): Promise<{ success: boolean; message: string }> {
  const transport = await getDeepMindTransport();
  
  // Convert NRPN number to MSB/LSB
  const msb = (params.nrpn >> 7) & 0x7F;
  const lsb = params.nrpn & 0x7F;
  
  transport.nrpn.send({ msb, lsb }, params.value, { enableAddressCaching: false });
  
  return {
    success: true,
    message: `Sent NRPN ${params.nrpn} (MSB ${msb}, LSB ${lsb}) with value ${params.value}`,
  };
}

export async function handleDescribeFxType(params: { type?: string | number }): Promise<{
  success: boolean;
  type?: string;
  typeValue?: number;
  paramCount?: number;
  params?: Array<{
    index: number | undefined;
    key: string;
    settableName: string;
    abbr: string | undefined;
    fullName: string | undefined;
    units: string | undefined;
    displayMin: number | undefined;
    displayMax: number | undefined;
    rawMax: number | undefined;
    modDestination: boolean | undefined;
    enum: Array<{ rawValue: number; label: string }> | undefined;
    notes: string | undefined;
  }>;
  usage?: string;
  availableTypes?: Array<{ typeValue: number; name: string }>;
}> {
  // No type argument → list all available effect types
  if (params.type === undefined || params.type === null || params.type === '') {
    const availableTypes = Object.entries(FX_TYPE_VALUE_MAP)
      .filter(([k]) => Number(k) > 0)
      .map(([k, v]) => ({ typeValue: Number(k), name: v }))
      .sort((a, b) => a.typeValue - b.typeValue);
    return { success: true, availableTypes };
  }

  // Resolve type value from name or number
  let typeValue: number;
  let typeName: string;

  if (typeof params.type === 'number' || /^\d+$/.test(String(params.type))) {
    typeValue = Number(params.type);
    typeName = FX_TYPE_VALUE_MAP[typeValue] ?? `Unknown(${typeValue})`;
  } else {
    const nameToSearch = String(params.type).toLowerCase();
    const entry = Object.entries(FX_TYPE_VALUE_MAP).find(([, v]) => v.toLowerCase() === nameToSearch);
    if (!entry) {
      const available = Object.values(FX_TYPE_VALUE_MAP).join(', ');
      throw new Error(`Unknown FX type: "${params.type}". Available: ${available}`);
    }
    typeValue = Number(entry[0]);
    typeName = entry[1];
  }

  // Slot 1 is canonical — all slots share identical param schemas
  const specs = listDecodedFieldSpecs().filter(
    (s) => s.condition?.field === 'fx1.type' && s.condition.equals === typeValue,
  );

  if (specs.length === 0) {
    throw new Error(
      `No typed params found for FX type ${typeValue} (${typeName}). The effect may not be mapped yet.`,
    );
  }

  const paramList = specs.map((s) => {
    // s.name = "fx1.chorus.speed" → key = "speed", settableName = "fxN.chorus.speed"
    const parts = s.name.split('.');
    const key = parts.slice(2).join('.');
    const settableName = `fxN.${parts.slice(1).join('.')}`;
    return {
      index: s.ui?.index,
      key,
      settableName,
      abbr: s.ui?.abbr,
      fullName: s.ui?.name,
      units: s.value?.units,
      displayMin: s.value?.min,
      displayMax: s.value?.max,
      rawMax: s.value?.rawMax,
      modDestination: s.value?.modDestination,
      enum: s.valueMap
        ? Object.entries(s.valueMap).map(([k, v]) => ({ rawValue: Number(k), label: v }))
        : undefined,
      notes: s.notes,
    };
  });

  const exampleName = `fx1.${specs[0].name.split('.').slice(1).join('.')}`;
  return {
    success: true,
    type: typeName,
    typeValue,
    paramCount: specs.length,
    params: paramList,
    usage: `Replace N in settableName with slot number 1–4. E.g. "${exampleName}"`,
  };
}

export async function handlePatchEditBuffer(params: {
  patches: Array<{ offset: number; value: number }>;
  synthId?: string;
}): Promise<{ success: boolean; message: string; modifiedCount: number }> {
  const transport = await getDeepMindTransport();

  const timeoutMsRaw = process.env.SNAPSHOT_TIMEOUT_MS;
  const timeoutMs = timeoutMsRaw ? Number(timeoutMsRaw) : 15000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid SNAPSHOT_TIMEOUT_MS: ${timeoutMsRaw}`);
  }

  const patchMap = new Map<number, number>();
  for (const p of params.patches) {
    patchMap.set(p.offset, p.value);
  }

  const result = await patchEditBuffer({
    port: transport.port,
    deviceId: transport.deviceId,
    timeoutMs,
    patches: patchMap,
  });

  return {
    success: true,
    modifiedCount: result.modifiedCount,
    message: `Patched ${result.modifiedCount} byte(s) in edit buffer (${result.decodedLength} bytes total) via sysex`,
  };
}

