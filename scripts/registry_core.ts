// registry_core.ts — Testable core logic for ABDEep parameter registry generation
// Imported by registry_generator.ts (build) and registry_core.test.ts (tests)

/** Supported parameter types in the canonical registry */
export type ParamType = 'value' | 'bipolar' | 'enum';

/** Parameter codec type from bridge mapping */
export type CodecType = 'value' | 'bipolar' | 'enum';

/** Parameter category based on byte offset */
export type ParamCategory = 'physical' | 'extended' | 'virtual';

/** Raw parameter from bridge param maps */
export interface BridgeParamMap {
  PARAM_TO_BYTE_OFFSET: Record<string, number>;
  PARAM_TO_CC: Record<string, number>;
  ENUM_BYTES: Record<string, number>;
  BIPOLAR_BYTES: Record<string, number> | number[];
  BYTE_OFFSET_TO_PARAM_IDS: Record<string, string[]>;
}

/** Raw parameter from byte map data */
export interface ByteMapEntry {
  idx: number;
  param: string;
  region: string;
  type: string;
  desc?: string;
  enumLabels?: string[];
  id?: string | null;
}

/** Raw parameter from legacy spec */
export interface SpecParam {
  id: string;
  name?: string;
  block?: string;
  type?: string;
  description?: string;
  options?: string[];
  min?: number;
  max?: number;
  default?: number | boolean | string;
  midi_cc?: number;
}

/** Normalized parameter with computed fields */
export interface NormalizedParam {
  id: string;
  byteOffset: number;
  category: ParamCategory;
  region: string;
  codecType: CodecType;
  byteMapType: string | null;
  enumMax: number | null;
  enumLabels: string[] | null;
  cc: number | null;
  legacyCC: number | null;
  ccConflict: boolean;
  name: string | null;
  desc: string | null;
  defaultValue: number | null;
  aliases: string[];
  cppName: string;
  index: number;
}

/** Canonical byte map entry for output */
export interface CanonicalByteMapEntry {
  idx: number;
  param: string;
  region: string;
  type: string;
  desc: string | null;
  enumLabels: string[] | null;
  id: string | null;
}

/** Spec-only parameter (legacy without byte mapping) */
export interface SpecOnlyParam {
  id: string;
  name: string | null;
  block: string | null;
  type: string | null;
  description: string | null;
  options: string[] | null;
}

/** Warning entry */
export interface WarningEntry {
  code: string;
  message: string;
}

/** Registry summary */
export interface RegistrySummary {
  total: number;
  physical: number;
  extended: number;
  virtual: number;
  aliasGroups: number;
  enumCount: number;
  bipolarCount: number;
  valueCount: number;
  ccCount: number;
  specOnlyCount: number;
  warningCount: number;
}

/** Complete registry output */
export interface ParameterRegistry {
  schemaVersion: 1;
  generatedAt: string;
  sourceHashes: {
    parametersSpec: string;
    bridgeParamMaps: string;
    byteMapData: string;
  };
  parameters: NormalizedParam[];
  byteMap: CanonicalByteMapEntry[];
  specOnly: SpecOnlyParam[];
  warnings: WarningEntry[];
  summary: RegistrySummary;
}

/** Validation result */
export interface ValidationResult {
  processed: NormalizedParam[];
  errors: string[];
  warnings: WarningEntry[];
  specOnly: SpecOnlyParam[];
  canonicalByteMap: CanonicalByteMapEntry[];
  summary: RegistrySummary;
  sourceHashes: Record<string, string>;
}

/** Known alias offsets (intentional NRPN sharing).
 *
 *  QUEDAN VACÍA A PROPÓSITO. Aquí hubo una lista de escapes (`{32, 88, 160}`) que
 *  llamaba «alias intencionales» a los tres: `osc2_pm_source`+`osc2_pitch_mod_select`
 *  (byte 32), `voice_drift`+`osc_drift` (88) y `arp_gate_time`+`arp_gate` (160).
 *  Eran exactamente los tres bytes con dos respuestas que el guard 2 tenía que
 *  cazar, y la lista los hacía pasar por buenos. Se ha quitado: un byte con dos
 *  ids no es un parámetro inactivo, es un byte con DOS RESPUESTAS — `findParameterByOffset`
 *  devuelve el primero que encuentra y el otro se vuelve un mando que no hace nada.
 *  Si un alias de verdad es necesario, se declara con su byte propio.
 */
export const KNOWN_ALIAS_OFFSETS = new Set<number>();

/** Reserved physical byte regions (patch name + payload tail) */
export const RESERVED_PHYSICAL_REGIONS = [
  { start: 223, end: 238, label: 'patch name (223-238)' },
  { start: 239, end: 241, label: 'payload tail (239-241)' },
] as const;

/** Convert param ID to PascalCase for C++ enum */
export function toPascalCase(id: string): string {
  return id
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** Format number as C++ float literal (e.g., 1.0 → "1.0f") */
export function formatCppFloat(val: number | null): string {
  if (val === null) return '-1.0f';
  const str = String(val);
  return str.includes('.') ? `${str}f` : `${str}.0f`;
}

/** Compute SHA-256 hash of content */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Normalize parameter type from legacy spec */
export function normalizeSpecType(type?: string): string {
  const aliases: Record<string, string> = {
    'bool': 'boolean',
    'int': 'integer',
    'float': 'continuous',
  };
  return aliases[type?.toLowerCase() || ''] || type || 'continuous';
}

/** Compute normalized default value (0..1) from spec metadata */
export function computeDefaultNormalized(specMeta: SpecParam | undefined): number | null {
  if (!specMeta) return null;

  // Boolean type
  if (specMeta.type === 'bool' || specMeta.type === 'boolean') {
    if (specMeta.default === true) return 1;
    if (specMeta.default === false) return 0;
    return null;
  }

  // Numeric default
  if (typeof specMeta.default === 'number') {
    if (
      typeof specMeta.min === 'number' &&
      typeof specMeta.max === 'number' &&
      specMeta.max > specMeta.min
    ) {
      return Math.min(1, Math.max(0, (specMeta.default - specMeta.min) / (specMeta.max - specMeta.min)));
    }
    return Math.min(1, Math.max(0, specMeta.default));
  }

  // Enum with string default
  if (
    (specMeta.type === 'enum' || specMeta.type === 'choice') &&
    Array.isArray(specMeta.options) &&
    typeof specMeta.default === 'string'
  ) {
    const idx = specMeta.options.indexOf(specMeta.default);
    if (idx >= 0 && specMeta.options.length > 1) {
      return idx / (specMeta.options.length - 1);
    }
  }

  return null;
}

/** Determine codec type from bridge mappings */
export function determineCodecType(
  byteOffset: number,
  enumBytes: Record<string, number>,
  bipolarBytes: Set<number>
): CodecType {
  if (Object.prototype.hasOwnProperty.call(enumBytes, String(byteOffset))) return 'enum';
  if (bipolarBytes.has(byteOffset)) return 'bipolar';
  return 'value';
}

/** Determine parameter category from byte offset */
export function determineCategory(byteOffset: number): ParamCategory {
  if (byteOffset >= 300) return 'virtual';
  if (byteOffset >= 242) return 'extended';
  return 'physical';
}

/** Validate parameter against reserved regions */
export function checkReservedRegions(
  id: string,
  byteOffset: number,
  errors: string[]
): boolean {
  if (byteOffset < 0 || byteOffset > 241) return true; // Only applies to physical bytes

  for (const region of RESERVED_PHYSICAL_REGIONS) {
    if (byteOffset >= region.start && byteOffset <= region.end) {
      errors.push(
        `RESERVED_BYTE_COLLISION: Param "${id}" (byteOffset=${byteOffset}) ` +
        `cae en región reservada ${region.label} — mover a virtual (>=300)`
      );
      return false;
    }
  }
  return true;
}

/**
 * Forma CANÓNICA de una fuente (hash estable ante formato/comentarios).
 *
 * El hash de cada fuente se calcula sobre su valor YA PARSEADO, serializado de forma
 * determinista — claves ordenadas, arrays en su orden, `Set` como array ordenado — y no
 * sobre los bytes del fichero, de modo que cambios de formato o comentarios no re-sellan
 * el registro. Se excluyen funciones y `undefined` (código, no datos de parámetros).
 * Ojo: sin el caso `Set`, JSON.stringify convertiría BIPOLAR_BYTES (un Set) en `{}`.
 *
 * Implementación de REFERENCIA; `scripts/registry_generator.js` replica la misma forma
 * (no puede importar TS porque corre bajo node plano desde CMake).
 */
export function canonicalizeSource(value: any): any {
  if (value instanceof Set) {
    return Array.from(value)
      .map(canonicalizeSource)
      .sort((a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0));
  }
  if (value instanceof Map) {
    return Array.from(value.entries())
      .map(([k, v]: [any, any]) => [k, canonicalizeSource(v)])
      .sort((a: any, b: any) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeSource);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v === undefined || typeof v === 'function') { continue; }
      out[key] = canonicalizeSource(v);
    }
    return out;
  }
  return value;
}

/** Id declarado por el host, sin byte: el guard 3 lo exige con su porqué. */
export interface SpecOnlyConsumer {
  id: string;
  porque: string;
}

/**
 * Parametros declarados por el host SIN byte en el mapa del puente, pero VIVOS.
 *
 * O los lee el motor por un id construido (`fx1_mix` sale de
 * `"fx" + String(s + 1) + "_mix"`, así que no aparece como literal en ningún
 * fichero), o son metadatos globales que la APVTS declara para que el host los
 * acepte y los guarde en el preset.
 *
 * No se escanea el motor para decidir esto: los ids construidos por prefijo no
 * existen como literal, así que un escaneo los daría por muertos —o peor, por
 * vivos y habría que mantener una lista de prefijos al día. La lista es
 * explícita, y el guard falla con lo que NO esté en ella.
 */
export const SPECONLY_CONSUMIDOS: SpecOnlyConsumer[] = [
  { id: 'fx1_mix', porque: 'FXEngine.cpp construye el id: "fx" + String(s + 1) + "_mix"' },
  { id: 'fx2_mix', porque: 'FXEngine.cpp construye el id: "fx" + String(s + 1) + "_mix"' },
  { id: 'fx3_mix', porque: 'FXEngine.cpp construye el id: "fx" + String(s + 1) + "_mix"' },
  { id: 'fx4_mix', porque: 'FXEngine.cpp construye el id: "fx" + String(s + 1) + "_mix"' },
  { id: 'global_volume', porque: 'global de la APVTS; lo aplica el host, no el motor' },
  { id: 'global_tune', porque: 'global de la APVTS; lo aplica el host, no el motor' },
  { id: 'transpose', porque: 'global de la APVTS; lo aplica el host, no el motor' },
  { id: 'master_softclip_bypass', porque: 'global de la APVTS; conmutador del host' },
  { id: 'master_softclip_headroom', porque: 'global de la APVTS; lo aplica el host' },
  { id: 'hpf_bass_boost_gain', porque: 'cabeza del filtro, no el conmutador on/off del byte 52' },
  { id: 'sub_level', porque: 'nivel del sub, sin byte en el mapa del puente' },
  { id: 'vca_mode', porque: 'modo del VCA, sin byte en el mapa del puente' },
  { id: 'vcf_oversample', porque: 'sobresampling, sin byte en el mapa del puente' },
  { id: 'arp_velocity_gate', porque: 'lo lee bridge-engines-arp.js vía _arpVelocityFor (Gate/Velocity/Seq)' },
];

/**
 * El spec que declara el host, leído de `Source/Core/ParametersSpec_*.cpp`.
 *
 * Por qué se lee el C++ y no el JSON: el spec que manda es el de la APVTS, y
 * `resources/parameters_spec.json` son 15 metadatos legacy del emulador. Un guard
 * que comparara el registro contra el JSON daría 220 falsos positivos; uno que no
 * compare nada no vigila nada. El JSON sigue siendo la fuente de METADATOS.
 *
 * El cuarto campo (el tipo) es la única clave de la línea y ancla el match, para
 * que una tabla de opciones con el mismo shape no se cuele como parámetro.
 */
const RE_SPEC_ENTRY =
  /\{\s*"([a-z0-9_]+)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([a-z]+)"/g;

/**
 * Extrae los ids declarados por el host de los ficheros `ParametersSpec*.cpp` de un
 * directorio. No lee ficheros: recibe su texto ya concatenado, para que el
 * llamante decida cómo recorrer el disco (y para que esto sea testeable).
 */
export function parseSpecCppIds(text: string): string[] {
  const ids: string[] = [];
  RE_SPEC_ENTRY.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_SPEC_ENTRY.exec(text)) !== null) {
    ids.push(m[1]);
  }
  return ids;
}

/**
 * El id declarado por el host al que se compara el registro.
 *
 * `declaredIds` es la lista de `parseSpecCppIds` sobre los ficheros concatenados.
 */
export function indexSpecCppIds(declaredIds: string[]): {
  set: Set<string>;
  duplicados: Array<[string, string]>;
} {
  const set = new Set<string>();
  const duplicados: Array<[string, string]> = [];
  for (const id of declaredIds) {
    if (set.has(id)) duplicados.push([id, id]);
    else set.add(id);
  }
  return { set, duplicados };
}

/** Validate raw parameters and produce normalized registry */
export async function validateAndBuildRegistry(
  bridge: BridgeParamMap,
  byteMap: ByteMapEntry[],
  spec: SpecParam[],
  /**
   * Ids que declara el host (los `ParametersSpec_*.cpp`). Sin esto los guards 1
   * y 3 no se pueden evaluar y no se avisa: es el estado anterior a este cambio,
   * no un fallo. Pasa la lista de `parseSpecCppIds`.
   */
  specCppIds?: string[]
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: WarningEntry[] = [];

  // Source hashes — sobre la forma CANÓNICA de cada fuente (no los bytes del fichero):
  // cambios de formato o comentarios no re-sellan el registro.
  const sourceHashes = {
    parametersSpec: await sha256(JSON.stringify(canonicalizeSource(spec))),
    bridgeParamMaps: await sha256(JSON.stringify(canonicalizeSource(bridge))),
    byteMapData: await sha256(JSON.stringify(canonicalizeSource(byteMap))),
  };

  // Extract bridge mappings
  const paramToOffset = bridge.PARAM_TO_BYTE_OFFSET || {};
  const paramToCC = bridge.PARAM_TO_CC || {};
  const enumBytes = bridge.ENUM_BYTES || {};
  const bipolarBytesRaw = bridge.BIPOLAR_BYTES || {};
  const bipolarBytes = Array.isArray(bipolarBytesRaw)
    ? new Set(bipolarBytesRaw.map(Number))
    : new Set(Object.keys(bipolarBytesRaw).map(Number));

  // Spec by ID for quick lookup
  const specById = new Map(spec.map(p => [p.id, p]));

  // Build alias groups from bridge
  const byOffset: Record<number, string[]> = {};
  for (const [id, offset] of Object.entries(paramToOffset)) {
    const byteOffset = Number(offset);
    if (!Number.isInteger(byteOffset) || byteOffset < 0 || byteOffset > 399) {
      errors.push(`OFFSET_RANGE: Param "${id}" tiene byteOffset inválido: ${offset}`);
      continue;
    }
    (byOffset[byteOffset] = byOffset[byteOffset] || []).push(id);
  }

  // ── GUARD 2: dos ids en el mismo byte ─────────────────────────────────
  // Antes esto descartaba los offsets de `KNOWN_ALIAS_OFFSETS`, una lista de
  // escapes que llegaba justo a los tres bytes con dos respuestas. Un byte con
  // dos ids no es un parámetro inactivo: `findParameterByOffset` devuelve el
  // primero que encuentra, así que el segundo se vuelve un mando que el usuario
  // puede mover y que no hace nada.
  for (const [offStr, ids] of Object.entries(byOffset)) {
    const off = Number(offStr);
    if (ids.length > 1 && !KNOWN_ALIAS_OFFSETS.has(off)) {
      errors.push(
        `NRPN_COLLISION: Byte ${off} compartido por ${ids.length} ids: ` +
        `${ids.join(', ')} — un byte, dos respuestas; dar a cada uno el suyo`
      );
    }
  }

  // ── GUARD 1: ningún id del registro puede estar fuera del spec del host ──
  // Un id en el mapa del puente que la APVTS no declara es una escritura sin
  // destino: el `PatchByteCodec` la acepta, el preset la serializa, y al abrirlo
  // el host no declara el parámetro, así que se pierde.
  const specCppSet = specCppIds ? new Set(specCppIds) : null;
  if (specCppSet) {
    for (const [id, offsetRaw] of Object.entries(paramToOffset)) {
      if (!specCppSet.has(id)) {
        errors.push(
          `REGISTRY_ID_NOT_IN_SPEC: Param "${id}" (byteOffset=${offsetRaw}) está en el ` +
          `mapa del puente pero el host NO lo declara en Source/Core/ParametersSpec_*.cpp ` +
          `— el byte se escribe, el preset lo guarda y al abrirlo el parámetro no existe`
        );
      }
    }
    // Y lo mismo por la otra puerta: PARAM_TO_CC. Un id que solo aparece ahí es
    // un CC que responde a un mando que el host no declara — el mismo defecto
    // que el de arriba, con el extra de que también se mueve desde el MIDI
    // externo. Sin byte legítimo están los globales de la APVTS (`global_volume`,
    // `global_tune`, `transpose`), y esos están en el spec, así que no necesitan
    // lista de escapes: basta con mirar dónde están declarados.
    const paramToCC = bridge.PARAM_TO_CC || {};
    for (const [id, cc] of Object.entries(paramToCC)) {
      if (!specCppSet.has(id)) {
        errors.push(
          `CC_ID_NOT_IN_SPEC: Param "${id}" (CC=${cc}) está en PARAM_TO_CC pero el host ` +
          `NO lo declara en Source/Core/ParametersSpec_*.cpp — un CC que mueve un ` +
          `parámetro que no existe`
        );
      }
    }
  }

  // Build normalized parameters
  const processed: NormalizedParam[] = [];
  let index = 0;

  for (const [id, offsetRaw] of Object.entries(paramToOffset)) {
    const byteOffset = Number(offsetRaw);
    const specMeta = specById.get(id);

    // Range check from legacy spec
    if (specMeta && typeof specMeta.min === 'number' && typeof specMeta.max === 'number' && specMeta.min >= specMeta.max) {
      errors.push(`RANGE_INCOMPATIBLE: Spec "${id}": min(${specMeta.min}) >= max(${specMeta.max})`);
      continue;
    }

    // Reserved region check
    checkReservedRegions(id, byteOffset, errors);

    const category = determineCategory(byteOffset);
    const isEnum = Object.prototype.hasOwnProperty.call(enumBytes, String(byteOffset));
    const codecType = determineCodecType(byteOffset, enumBytes, bipolarBytes);

    const bm = category === 'physical' && byteMap[byteOffset] ? byteMap[byteOffset] : null;
    const cc = paramToCC[id] !== undefined ? Number(paramToCC[id]) : null;
    const legacyCC = specMeta && specMeta.midi_cc !== undefined ? Number(specMeta.midi_cc) : null;
    const ccConflict = cc !== null && legacyCC !== null && cc !== legacyCC;

    if (ccConflict) {
      warnings.push({
        code: 'CC_LEGACY_DIVERGENCE',
        message: `Param "${id}": CC canónico=${cc} vs legacy=${legacyCC} (comparisonMode)`,
      });
    }

    const enumMax = isEnum ? Number(enumBytes[String(byteOffset)]) : null;
    if (isEnum && (!Number.isInteger(enumMax) || enumMax < 1)) {
      errors.push(`ENUM_MAX: Param "${id}" enum con ENUM_BYTES inválido: ${enumMax}`);
      continue;
    }

    const aliases = (byOffset[byteOffset] || []).filter(a => a !== id);
    const cppName = toPascalCase(id);

    processed.push({
      id,
      byteOffset,
      category,
      region: bm ? bm.region : (category === 'extended' ? 'Extended' : 'Virtual'),
      codecType,
      byteMapType: bm ? bm.type : null,
      enumMax,
      enumLabels: bm && bm.enumLabels ? bm.enumLabels : null,
      cc,
      legacyCC,
      ccConflict,
      name: specMeta?.name || bm?.param || null,
      desc: specMeta?.description || bm?.desc || null,
      defaultValue: computeDefaultNormalized(specMeta),
      aliases,
      cppName,
      index: index++,
    });
  }

  // Check C++ name collisions
  const cppNames = new Map<string, string>();
  for (const p of processed) {
    if (cppNames.has(p.cppName)) {
      errors.push(`CPP_NAME_COLLISION: cppName "${p.cppName}" colisiona entre "${cppNames.get(p.cppName)}" y "${p.id}"`);
    }
    cppNames.set(p.cppName, p.id);
  }

  // Spec-only parameters (legacy without byte mapping)
  // `hasOwnProperty` y no truthiness: un id en el byte 0 tiene valor 0, y `!0` es
  // `true`, así que el byte cero se contaría como spec-only.
  const specOnly: SpecOnlyParam[] = [];
  for (const p of spec) {
    if (!Object.prototype.hasOwnProperty.call(paramToOffset, p.id)) {
      specOnly.push({
        id: p.id,
        name: p.name || null,
        block: p.block || null,
        type: normalizeSpecType(p.type),
        description: p.description || null,
        options: p.options || null,
      });
    }
  }

  // ── GUARD 3: un spec-only que nadie consume es un error ──────────────────
  // No se escanea el motor: se compara contra la lista explícita de
  // `SPECONLY_CONSUMIDOS`. Se mide contra el spec del host (el de C++), que es
  // donde vive la verdad de qué declara el host.
  if (specCppIds) {
    const specOnlyDelHost = specCppIds.filter(
      (id) => !Object.prototype.hasOwnProperty.call(paramToOffset, id)
    );
    const consumidos = new Map(SPECONLY_CONSUMIDOS.map((c) => [c.id, c.porque]));
    for (const id of specOnlyDelHost) {
      if (!consumidos.has(id)) {
        errors.push(
          `SPECONLY_UNCONSUMED: Spec declara "${id}" pero no tiene byte en el mapa del ` +
          `puente y no está en SPECONLY_CONSUMIDOS — el host lo acepta y lo serializa, ` +
          `y no lo lee nadie (si está vivo, añadirlo a la lista con su porqué; si no, ` +
          `borrarlo del spec)`
        );
      }
    }
    // Una entrada de la lista que ya no aplica es deuda cerrada que alguien se
    // dejó olvidada. Aviso, no error: el fallo real lo vería el guard 1.
    for (const [id, porque] of consumidos) {
      if (!specOnlyDelHost.includes(id)) {
        warnings.push({
          code: 'SPECONLY_ALLOWLIST_STALE',
          message:
            `SPECONLY_CONSUMIDOS lista "${id}" pero ya no es spec-only ` +
            `(tiene byte, o ha desaparecido del spec) — quitarlo de la lista. Razón: ${porque}`,
        });
      }
    }
  }

  // Canonical byte map (242 physical bytes)
  const canonicalByteMap: CanonicalByteMapEntry[] = byteMap.map((bmEntry, idx) => {
    const ids = byOffset[idx] || null;
    return {
      idx: bmEntry.idx,
      param: bmEntry.param,
      region: bmEntry.region,
      type: bmEntry.type,
      desc: bmEntry.desc || null,
      enumLabels: bmEntry.enumLabels || null,
      id: ids && ids.length > 0 ? ids[0] : null,
    };
  });

  // Summary
  const aliasGroups = Object.values(byOffset).filter(ids => ids.length > 1).length;
  const summary: RegistrySummary = {
    total: processed.length,
    physical: processed.filter(e => e.category === 'physical').length,
    extended: processed.filter(e => e.category === 'extended').length,
    virtual: processed.filter(e => e.category === 'virtual').length,
    aliasGroups,
    enumCount: processed.filter(e => e.codecType === 'enum').length,
    bipolarCount: processed.filter(e => e.codecType === 'bipolar').length,
    valueCount: processed.filter(e => e.codecType === 'value').length,
    ccCount: processed.filter(e => e.cc !== null).length,
    specOnlyCount: specOnly.length,
    warningCount: warnings.length,
  };

  return {
    processed,
    errors,
    warnings,
    specOnly,
    canonicalByteMap,
    summary,
    sourceHashes,
  };
}

/** Generate registry.json output */
export function generateRegistryOutput(
  result: ValidationResult
): ParameterRegistry {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceHashes: result.sourceHashes,
    parameters: result.processed,
    byteMap: result.canonicalByteMap,
    specOnly: result.specOnly,
    warnings: result.warnings,
    summary: result.summary,
  };
}

/** Generate JavaScript output (UMD + ESM compatible) */
export function renderJs(registry: ParameterRegistry): string {
  const lines: string[] = [];

  lines.push('// AUTO-GENERATED BY registry_generator.ts — DO NOT EDIT MANUALLY');
  lines.push('/* eslint-disable */');
  lines.push('(function (root, factory) {');
  lines.push('  if (typeof module === "object" && module.exports) { module.exports = factory(); }');
  lines.push('  else if (typeof window !== "undefined") { window.ParameterRegistry = factory(); }');
  lines.push('  else { root.ParameterRegistry = factory(); }');
  lines.push('})(typeof self !== "undefined" ? self : this, function () {');
  lines.push('  var byId = {};');
  lines.push('  var byOffset = {};');
  lines.push(`  var parameters = ${JSON.stringify(registry.parameters)};`);
  lines.push('');
  lines.push('  parameters.forEach(function (p) { byId[p.id] = p; });');
  lines.push('  parameters.forEach(function (p) {');
  lines.push('    (byOffset[p.byteOffset] = byOffset[p.byteOffset] || []).push(p.id);');
  lines.push('  });');
  lines.push('');
  lines.push('  return {');
  lines.push(`    schemaVersion: 1,`);
  lines.push(`    generatedAt: ${JSON.stringify(registry.generatedAt)},`);
  lines.push(`    sourceHashes: ${JSON.stringify(registry.sourceHashes)},`);
  lines.push('    parameters: parameters,');
  lines.push(`    byteMap: ${JSON.stringify(registry.byteMap)},`);
  lines.push(`    specOnly: ${JSON.stringify(registry.specOnly)},`);
  lines.push(`    warnings: ${JSON.stringify(registry.warnings)},`);
  lines.push(`    summary: ${JSON.stringify(registry.summary)},`);
  lines.push('    byId: byId,');
  lines.push('    byOffset: byOffset,');
  lines.push('    rawToNormalized: function (byteOffset, rawValue) {');
  lines.push('      if (byteOffset === undefined) return 0;');
  lines.push('      var p = byOffset[byteOffset] && byOffset[byteOffset][0] ? byId[byOffset[byteOffset][0]] : null;');
  lines.push('      if (p && p.codecType === "bipolar") { return Math.max(0, Math.min(1, ((rawValue - 128) / 127 + 1) / 2)); }');
  lines.push('      if (p && p.codecType === "enum" && p.enumMax) { return Math.min(1, rawValue / p.enumMax); }');
  lines.push('      return rawValue / 255;');
  lines.push('    },');
  lines.push('    normalizedToRaw: function (byteOffset, normalizedValue) {');
  lines.push('      var p = byOffset[byteOffset] && byOffset[byteOffset][0] ? byId[byOffset[byteOffset][0]] : null;');
  lines.push('      if (p && p.codecType === "bipolar") { return Math.round(((normalizedValue * 2 - 1) * 127) + 128); }');
  lines.push('      if (p && p.codecType === "enum" && p.enumMax) { return Math.round(normalizedValue * p.enumMax); }');
  lines.push('      return Math.round(normalizedValue * 255);');
  lines.push('    }');
  lines.push('  };');
  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

/** Codec type to C++ integer */
function codecTypeId(t: CodecType): number {
  return t === 'bipolar' ? 1 : (t === 'enum' ? 2 : 0);
}

/** Escape string for C++ */
function escapeCpp(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Generate C++ header */
export function renderCppHeader(registry: ParameterRegistry): string {
  const L: string[] = [];

  L.push('// AUTO-GENERATED BY registry_generator.ts — DO NOT EDIT MANUALLY');
  L.push('#pragma once');
  L.push('');
  L.push('#include <array>');
  L.push('#include <cstdint>');
  L.push('#include <string_view>');
  L.push('');
  L.push('namespace ABD');
  L.push('{');
  L.push('namespace Registry');
  L.push('{');
  L.push('');
  L.push('// Indices generated at build-time (O(1) lookup by enum — invariant §3.2).');
  L.push('enum class ParameterIndex : std::uint16_t');
  L.push('{');
  for (const p of registry.parameters) {
    L.push(`    ${p.cppName} = ${p.index},`);
  }
  L.push('    kCount');
  L.push('};');
  L.push('');
  L.push('// codecType: 0 = value, 1 = bipolar, 2 = enum');
  L.push('struct ParameterEntry');
  L.push('{');
  L.push('    const char* id;');
  L.push('    std::uint16_t byteOffset;');
  L.push('    const char* region;');
  L.push('    std::uint8_t codecType;');
  L.push('    std::uint8_t cc;            // 0 = no mapping');
  L.push('    std::uint8_t enumMax;       // 0 = n/a');
  L.push('    float defaultValue;         // normalized 0..1; -1.0f = unknown');
  L.push('    ParameterIndex index;');
  L.push('};');
  L.push('');
  L.push(`inline constexpr std::size_t kParameterCount = ${registry.parameters.length};`);
  L.push(`inline constexpr std::size_t kByteMapSize = ${registry.byteMap.length};`);
  L.push('');
  L.push('extern const std::array<ParameterEntry, kParameterCount> kParameters;');
  L.push('extern const std::array<const char*, kByteMapSize> kByteMapParams;');
  L.push('');
  L.push('// Lookups for control thread / tests (never on audio thread).');
  L.push('inline const ParameterEntry* findParameterById (std::string_view id) noexcept');
  L.push('{');
  L.push('    for (const auto& p : kParameters)');
  L.push('        if (id == p.id)');
  L.push('            return &p;');
  L.push('    return nullptr;');
  L.push('}');
  L.push('');
  L.push('inline const ParameterEntry* findParameterByOffset (std::uint16_t byteOffset) noexcept');
  L.push('{');
  L.push('    for (const auto& p : kParameters)');
  L.push('        if (byteOffset == p.byteOffset)');
  L.push('            return &p;');
  L.push('    return nullptr;');
  L.push('}');
  L.push('');
  L.push('} // namespace Registry');
  L.push('} // namespace ABD');
  L.push('');

  return L.join('\n');
}

/** Generate C++ source */
export function renderCppSource(registry: ParameterRegistry): string {
  const L: string[] = [];

  L.push('// AUTO-GENERATED BY registry_generator.ts — DO NOT EDIT MANUALLY');
  L.push('#include "ParameterRegistry.gen.h"');
  L.push('');
  L.push('namespace ABD');
  L.push('{');
  L.push('namespace Registry');
  L.push('{');
  L.push('');
  L.push('const std::array<ParameterEntry, kParameterCount> kParameters = {{');
  for (const p of registry.parameters) {
    const def = formatCppFloat(p.defaultValue);
    L.push(`    { "${p.id}", ${p.byteOffset}, "${p.region}", ${codecTypeId(p.codecType)}, ` +
      `${p.cc === null ? 0 : p.cc}, ${p.enumMax === null ? 0 : p.enumMax}, ` +
      `${def}, ParameterIndex::${p.cppName} },`);
  }
  L.push('}};');
  L.push('');
  L.push('const std::array<const char*, kByteMapSize> kByteMapParams = {{');
  for (const b of registry.byteMap) {
    L.push(`    "${escapeCpp(b.param)}",`);
  }
  L.push('}};');
  L.push('');
  L.push('} // namespace Registry');
  L.push('} // namespace ABD');
  L.push('');

  return L.join('\n');
}