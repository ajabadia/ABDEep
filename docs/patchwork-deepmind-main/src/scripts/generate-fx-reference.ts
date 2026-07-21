import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DecodedValueMeta } from '../deepmind/decoded-patch-map.js';
import { FX_TYPE_VALUE_MAP } from '../deepmind/decoded-patch-map.js';
import {
  HALL_REV_PARAM_KEYS,
  HALL_REV_UI_BY_KEY,
  HALL_REV_VALUE_BY_KEY,
  PLATE_REV_PARAM_KEYS,
  PLATE_REV_UI_BY_KEY,
  PLATE_REV_VALUE_BY_KEY,
  RICH_PLT_REV_PARAM_KEYS,
  RICH_PLT_REV_UI_BY_KEY,
  RICH_PLT_REV_VALUE_BY_KEY,
  AMB_VERB_PARAM_KEYS,
  AMB_VERB_UI_BY_KEY,
  AMB_VERB_VALUE_BY_KEY,
  GATED_REV_PARAM_KEYS,
  GATED_REV_UI_BY_KEY,
  GATED_REV_VALUE_BY_KEY,
  GATED_REV_NOTES_BY_KEY,
  REVERSE_REV_PARAM_KEYS,
  REVERSE_REV_UI_BY_KEY,
  REVERSE_REV_VALUE_BY_KEY,
  REVERSE_REV_NOTES_BY_KEY,
  CHAMBER_REV_PARAM_KEYS,
  CHAMBER_REV_UI_BY_KEY,
  CHAMBER_REV_VALUE_BY_KEY,
  ROOM_REV_PARAM_KEYS,
  ROOM_REV_UI_BY_KEY,
  ROOM_REV_VALUE_BY_KEY,
  VINTAGE_REV_PARAM_KEYS,
  VINTAGE_REV_UI_BY_KEY,
  VINTAGE_REV_VALUE_BY_KEY,
  VINTAGE_REV_FREEZE_VALUE_MAP,
  TC_DEEP_RVRB_PARAM_KEYS,
  TC_DEEP_RVRB_PRESET_VALUE_MAP,
  TC_DEEP_RVRB_UI_BY_KEY,
  TC_DEEP_RVRB_VALUE_BY_KEY,
  FLANG_VERB_PARAM_KEYS,
  FLANG_VERB_UI_BY_KEY,
  FLANG_VERB_VALUE_BY_KEY,
  FLANG_VERB_SPEED_SYNC_VALUE_MAP,
  FLANG_VERB_NOTES_BY_KEY,
  CHORUS_VERB_PARAM_KEYS,
  CHORUS_VERB_UI_BY_KEY,
  CHORUS_VERB_VALUE_BY_KEY,
  CHORUS_VERB_SPEED_SYNC_VALUE_MAP,
  CHORUS_VERB_NOTES_BY_KEY,
  DELAY_VERB_PARAM_KEYS,
  DELAY_VERB_UI_BY_KEY,
  DELAY_VERB_VALUE_BY_KEY,
  DELAY_VERB_PATTERN_VALUE_MAP,
  DELAY_VERB_NOTES_BY_KEY,
  MOD_DLYT_REV_PARAM_KEYS,
  MOD_DLYT_REV_UI_BY_KEY,
  MOD_DLYT_REV_VALUE_BY_KEY,
  MOD_DLYT_REV_VALUE_MAP_BY_KEY,
  MOD_DLYT_REV_NOTES_BY_KEY,
  DELAY_PARAM_KEYS,
  DELAY_UI_BY_KEY,
  DELAY_VALUE_BY_KEY,
  DELAY_VALUE_MAP_BY_KEY,
  DELAY_NOTES_BY_KEY,
  THREE_TAP_DELAY_PARAM_KEYS,
  THREE_TAP_DELAY_UI_BY_KEY,
  THREE_TAP_DELAY_VALUE_BY_KEY,
  THREE_TAP_DELAY_VALUE_MAP_BY_KEY,
  THREE_TAP_DELAY_NOTES_BY_KEY,
  FOUR_TAP_DELAY_PARAM_KEYS,
  FOUR_TAP_DELAY_UI_BY_KEY,
  FOUR_TAP_DELAY_VALUE_BY_KEY,
  FOUR_TAP_DELAY_VALUE_MAP_BY_KEY,
  FOUR_TAP_DELAY_NOTES_BY_KEY,
  T_RAY_DELAY_PARAM_KEYS,
  T_RAY_DELAY_UI_BY_KEY,
  T_RAY_DELAY_VALUE_BY_KEY,
  T_RAY_DELAY_NOTES_BY_KEY,
  DECIM_DELAY_PARAM_KEYS,
  DECIM_DELAY_UI_BY_KEY,
  DECIM_DELAY_VALUE_BY_KEY,
  DECIM_DELAY_VALUE_MAP_BY_KEY,
  DECIM_DELAY_NOTES_BY_KEY,
  CHORUS_PARAM_KEYS,
  CHORUS_UI_BY_KEY,
  CHORUS_VALUE_BY_KEY,
  CHORUS_SPEED_SYNC_VALUE_MAP,
  CHORUS_NOTES_BY_KEY,
  CHORUS_D_PARAM_KEYS,
  FLANGER_PARAM_KEYS,
  FLANGER_UI_BY_KEY,
  FLANGER_VALUE_BY_KEY,
  FLANGER_SPEED_SYNC_VALUE_MAP,
  FLANGER_NOTES_BY_KEY,
  PHASER_PARAM_KEYS,
  PHASER_UI_BY_KEY,
  PHASER_VALUE_BY_KEY,
  PHASER_SPEED_SYNC_VALUE_MAP,
  PHASER_NOTES_BY_KEY,
  AUTO_PAN_PARAM_KEYS,
  AUTO_PAN_UI_BY_KEY,
  AUTO_PAN_VALUE_BY_KEY,
  AUTO_PAN_SPEED_SYNC_VALUE_MAP,
  AUTO_PAN_NOTES_BY_KEY,
  ROTARY_SPKR_PARAM_KEYS,
  ROTARY_SPKR_UI_BY_KEY,
  ROTARY_SPKR_VALUE_BY_KEY,
  ROTARY_SPKR_VALUE_MAP_BY_KEY,
  ROTARY_SPKR_NOTES_BY_KEY,
  MIDAS_EQ_PARAM_KEYS,
  MIDAS_EQ_UI_BY_KEY,
  MIDAS_EQ_VALUE_BY_KEY,
  MIDAS_EQ_VALUE_MAP_BY_KEY,
  MIDAS_EQ_NOTES_BY_KEY,
  FAIR_COMP_PARAM_KEYS,
  FAIR_COMP_UI_BY_KEY,
  FAIR_COMP_VALUE_BY_KEY,
  FAIR_COMP_VALUE_MAP_BY_KEY,
  FAIR_COMP_NOTES_BY_KEY,
  MUL_BND_DIST_PARAM_KEYS,
  MUL_BND_DIST_UI_BY_KEY,
  MUL_BND_DIST_VALUE_BY_KEY,
  MUL_BND_DIST_VALUE_MAP_BY_KEY,
  MUL_BND_DIST_NOTES_BY_KEY,
  NOISE_GATE_PARAM_KEYS,
  NOISE_GATE_UI_BY_KEY,
  NOISE_GATE_VALUE_BY_KEY,
  NOISE_GATE_VALUE_MAP_BY_KEY,
  NOISE_GATE_NOTES_BY_KEY,
  ENHANCER_PARAM_KEYS,
  DUAL_PITCH_PARAM_KEYS,
  DUAL_PITCH_UI_BY_KEY,
  DUAL_PITCH_VALUE_BY_KEY,
  DUAL_PITCH_VALUE_MAP_BY_KEY,
  DUAL_PITCH_NOTES_BY_KEY,
  VINTG_PITCH_PARAM_KEYS,
  VINTG_PITCH_UI_BY_KEY,
  VINTG_PITCH_VALUE_BY_KEY,
  VINTG_PITCH_VALUE_MAP_BY_KEY,
  VINTG_PITCH_NOTES_BY_KEY,
  MOOD_FILTER_PARAM_KEYS,
  MOOD_FILTER_UI_BY_KEY,
  MOOD_FILTER_VALUE_BY_KEY,
  MOOD_FILTER_VALUE_MAP_BY_KEY,
  MOOD_FILTER_NOTES_BY_KEY,
  RACK_AMP_PARAM_KEYS,
  EDISON_EX1_PARAM_KEYS,
} from '../deepmind/fx/index.js';

type UiMeta = { abbr?: string; name?: string };
type EffectDoc = {
  typeValue: number;
  typedPrefix: string;
  category: 'Reverb' | 'Delay' | 'Creative' | 'Processing' | 'Modulation' | 'Combo';
  paramKeys: readonly string[];
  uiByKey?: Record<string, UiMeta>;
  valueByKey?: Record<string, DecodedValueMeta>;
  valueMapByKey?: Record<string, Record<number, string>>;
  notesByKey?: Record<string, string>;
};

function formatDisplayBuckets(buckets: NonNullable<DecodedValueMeta['displayBuckets']>): string {
  return buckets
    .map((bucket) => `${bucket.rawMin}${bucket.rawMin === bucket.rawMax ? '' : `-${bucket.rawMax}`}=${bucket.label}`)
    .join(', ');
}

const MANUAL_EFFECTS = [
  ['TC-DeepVRB', 'Reverb'],
  ['AmbVerb', 'Reverb'],
  ['RoomRev', 'Reverb'],
  ['VintageRev', 'Reverb'],
  ['HallRev', 'Reverb'],
  ['ChamberRev', 'Reverb'],
  ['PlateRev', 'Reverb'],
  ['RichPltRev', 'Reverb'],
  ['GatedRev', 'Reverb'],
  ['Reverse', 'Reverb'],
  ['ChorusVerb', 'Processing'],
  ['DelayVerb', 'Processing'],
  ['FlangVerb', 'Processing'],
  ['MidasEQ', 'Processing'],
  ['Enhancer', 'Processing'],
  ['FairComp', 'Processing'],
  ['MulBndDist', 'Processing'],
  ['RackAmp', 'Processing'],
  ['EdisonEX1', 'Processing'],
  ['Auto Pan', 'Processing'],
  ['NoiseGate', 'Processing'],
  ['Delay', 'Delay'],
  ['3-Tap Delay', 'Delay'],
  ['4-Tap Delay', 'Delay'],
  ['T-RayDelay', 'Delay'],
  ['DecimDelay', 'Delay'],
  ['ModDlyRev', 'Delay'],
  ['Chorus', 'Creative'],
  ['Chorus D', 'Creative'],
  ['Flanger', 'Creative'],
  ['Phaser', 'Creative'],
  ['Mood Filter', 'Creative'],
  ['DualPitch', 'Creative'],
  ['Vintage Pitch', 'Creative'],
  ['RotarySpkr', 'Creative'],
] as const;

const EFFECT_DOCS: EffectDoc[] = [
  { typeValue: 1, typedPrefix: 'hallRev', category: 'Reverb', paramKeys: HALL_REV_PARAM_KEYS, uiByKey: HALL_REV_UI_BY_KEY, valueByKey: HALL_REV_VALUE_BY_KEY },
  { typeValue: 2, typedPrefix: 'plateRev', category: 'Reverb', paramKeys: PLATE_REV_PARAM_KEYS, uiByKey: PLATE_REV_UI_BY_KEY, valueByKey: PLATE_REV_VALUE_BY_KEY },
  { typeValue: 3, typedPrefix: 'richPltRev', category: 'Reverb', paramKeys: RICH_PLT_REV_PARAM_KEYS, uiByKey: RICH_PLT_REV_UI_BY_KEY, valueByKey: RICH_PLT_REV_VALUE_BY_KEY },
  { typeValue: 4, typedPrefix: 'ambVerb', category: 'Reverb', paramKeys: AMB_VERB_PARAM_KEYS, uiByKey: AMB_VERB_UI_BY_KEY, valueByKey: AMB_VERB_VALUE_BY_KEY },
  { typeValue: 5, typedPrefix: 'gatedRev', category: 'Reverb', paramKeys: GATED_REV_PARAM_KEYS, uiByKey: GATED_REV_UI_BY_KEY, valueByKey: GATED_REV_VALUE_BY_KEY, notesByKey: GATED_REV_NOTES_BY_KEY },
  { typeValue: 6, typedPrefix: 'reverseRev', category: 'Reverb', paramKeys: REVERSE_REV_PARAM_KEYS, uiByKey: REVERSE_REV_UI_BY_KEY, valueByKey: REVERSE_REV_VALUE_BY_KEY, notesByKey: REVERSE_REV_NOTES_BY_KEY },
  { typeValue: 7, typedPrefix: 'rackAmp', category: 'Processing', paramKeys: RACK_AMP_PARAM_KEYS },
  { typeValue: 8, typedPrefix: 'moodFilter', category: 'Creative', paramKeys: MOOD_FILTER_PARAM_KEYS, uiByKey: MOOD_FILTER_UI_BY_KEY, valueByKey: MOOD_FILTER_VALUE_BY_KEY, valueMapByKey: MOOD_FILTER_VALUE_MAP_BY_KEY, notesByKey: MOOD_FILTER_NOTES_BY_KEY },
  { typeValue: 9, typedPrefix: 'phaser', category: 'Modulation', paramKeys: PHASER_PARAM_KEYS, uiByKey: PHASER_UI_BY_KEY, valueByKey: PHASER_VALUE_BY_KEY, valueMapByKey: { speed: PHASER_SPEED_SYNC_VALUE_MAP }, notesByKey: PHASER_NOTES_BY_KEY },
  { typeValue: 10, typedPrefix: 'chorus', category: 'Modulation', paramKeys: CHORUS_PARAM_KEYS, uiByKey: CHORUS_UI_BY_KEY, valueByKey: CHORUS_VALUE_BY_KEY, valueMapByKey: { speed: CHORUS_SPEED_SYNC_VALUE_MAP }, notesByKey: CHORUS_NOTES_BY_KEY },
  { typeValue: 11, typedPrefix: 'flanger', category: 'Modulation', paramKeys: FLANGER_PARAM_KEYS, uiByKey: FLANGER_UI_BY_KEY, valueByKey: FLANGER_VALUE_BY_KEY, valueMapByKey: { speed: FLANGER_SPEED_SYNC_VALUE_MAP }, notesByKey: FLANGER_NOTES_BY_KEY },
  { typeValue: 12, typedPrefix: 'modDlytRev', category: 'Combo', paramKeys: MOD_DLYT_REV_PARAM_KEYS, uiByKey: MOD_DLYT_REV_UI_BY_KEY, valueByKey: MOD_DLYT_REV_VALUE_BY_KEY, valueMapByKey: MOD_DLYT_REV_VALUE_MAP_BY_KEY, notesByKey: MOD_DLYT_REV_NOTES_BY_KEY },
  { typeValue: 13, typedPrefix: 'delay', category: 'Delay', paramKeys: DELAY_PARAM_KEYS, uiByKey: DELAY_UI_BY_KEY, valueByKey: DELAY_VALUE_BY_KEY, valueMapByKey: DELAY_VALUE_MAP_BY_KEY, notesByKey: DELAY_NOTES_BY_KEY },
  { typeValue: 14, typedPrefix: 'threeTapDelay', category: 'Delay', paramKeys: THREE_TAP_DELAY_PARAM_KEYS, uiByKey: THREE_TAP_DELAY_UI_BY_KEY, valueByKey: THREE_TAP_DELAY_VALUE_BY_KEY, valueMapByKey: THREE_TAP_DELAY_VALUE_MAP_BY_KEY, notesByKey: THREE_TAP_DELAY_NOTES_BY_KEY },
  { typeValue: 15, typedPrefix: 'fourTapDelay', category: 'Delay', paramKeys: FOUR_TAP_DELAY_PARAM_KEYS, uiByKey: FOUR_TAP_DELAY_UI_BY_KEY, valueByKey: FOUR_TAP_DELAY_VALUE_BY_KEY, valueMapByKey: FOUR_TAP_DELAY_VALUE_MAP_BY_KEY, notesByKey: FOUR_TAP_DELAY_NOTES_BY_KEY },
  { typeValue: 16, typedPrefix: 'rotarySpkr', category: 'Modulation', paramKeys: ROTARY_SPKR_PARAM_KEYS, uiByKey: ROTARY_SPKR_UI_BY_KEY, valueByKey: ROTARY_SPKR_VALUE_BY_KEY, valueMapByKey: ROTARY_SPKR_VALUE_MAP_BY_KEY, notesByKey: ROTARY_SPKR_NOTES_BY_KEY },
  { typeValue: 17, typedPrefix: 'chorusD', category: 'Modulation', paramKeys: CHORUS_D_PARAM_KEYS },
  { typeValue: 18, typedPrefix: 'enhancer', category: 'Processing', paramKeys: ENHANCER_PARAM_KEYS },
  { typeValue: 19, typedPrefix: 'edisonEx1', category: 'Processing', paramKeys: EDISON_EX1_PARAM_KEYS },
  { typeValue: 20, typedPrefix: 'autoPan', category: 'Processing', paramKeys: AUTO_PAN_PARAM_KEYS, uiByKey: AUTO_PAN_UI_BY_KEY, valueByKey: AUTO_PAN_VALUE_BY_KEY, valueMapByKey: { speed: AUTO_PAN_SPEED_SYNC_VALUE_MAP }, notesByKey: AUTO_PAN_NOTES_BY_KEY },
  { typeValue: 21, typedPrefix: 'tRayDelay', category: 'Delay', paramKeys: T_RAY_DELAY_PARAM_KEYS, uiByKey: T_RAY_DELAY_UI_BY_KEY, valueByKey: T_RAY_DELAY_VALUE_BY_KEY, notesByKey: T_RAY_DELAY_NOTES_BY_KEY },
  { typeValue: 22, typedPrefix: 'tcDeepRvrb', category: 'Reverb', paramKeys: TC_DEEP_RVRB_PARAM_KEYS, uiByKey: TC_DEEP_RVRB_UI_BY_KEY, valueByKey: TC_DEEP_RVRB_VALUE_BY_KEY, valueMapByKey: { preset: TC_DEEP_RVRB_PRESET_VALUE_MAP } },
  { typeValue: 23, typedPrefix: 'flangVerb', category: 'Combo', paramKeys: FLANG_VERB_PARAM_KEYS, uiByKey: FLANG_VERB_UI_BY_KEY, valueByKey: FLANG_VERB_VALUE_BY_KEY, valueMapByKey: { speed: FLANG_VERB_SPEED_SYNC_VALUE_MAP }, notesByKey: FLANG_VERB_NOTES_BY_KEY },
  { typeValue: 24, typedPrefix: 'chorusVerb', category: 'Combo', paramKeys: CHORUS_VERB_PARAM_KEYS, uiByKey: CHORUS_VERB_UI_BY_KEY, valueByKey: CHORUS_VERB_VALUE_BY_KEY, valueMapByKey: { speed: CHORUS_VERB_SPEED_SYNC_VALUE_MAP }, notesByKey: CHORUS_VERB_NOTES_BY_KEY },
  { typeValue: 25, typedPrefix: 'delayVerb', category: 'Combo', paramKeys: DELAY_VERB_PARAM_KEYS, uiByKey: DELAY_VERB_UI_BY_KEY, valueByKey: DELAY_VERB_VALUE_BY_KEY, valueMapByKey: { pattern: DELAY_VERB_PATTERN_VALUE_MAP }, notesByKey: DELAY_VERB_NOTES_BY_KEY },
  { typeValue: 26, typedPrefix: 'chamberRev', category: 'Reverb', paramKeys: CHAMBER_REV_PARAM_KEYS, uiByKey: CHAMBER_REV_UI_BY_KEY, valueByKey: CHAMBER_REV_VALUE_BY_KEY },
  { typeValue: 27, typedPrefix: 'roomRev', category: 'Reverb', paramKeys: ROOM_REV_PARAM_KEYS, uiByKey: ROOM_REV_UI_BY_KEY, valueByKey: ROOM_REV_VALUE_BY_KEY },
  { typeValue: 28, typedPrefix: 'vintageRev', category: 'Reverb', paramKeys: VINTAGE_REV_PARAM_KEYS, uiByKey: VINTAGE_REV_UI_BY_KEY, valueByKey: VINTAGE_REV_VALUE_BY_KEY, valueMapByKey: { freeze: VINTAGE_REV_FREEZE_VALUE_MAP } },
  { typeValue: 29, typedPrefix: 'dualPitch', category: 'Creative', paramKeys: DUAL_PITCH_PARAM_KEYS, uiByKey: DUAL_PITCH_UI_BY_KEY, valueByKey: DUAL_PITCH_VALUE_BY_KEY, valueMapByKey: DUAL_PITCH_VALUE_MAP_BY_KEY, notesByKey: DUAL_PITCH_NOTES_BY_KEY },
  { typeValue: 30, typedPrefix: 'midasEQ', category: 'Processing', paramKeys: MIDAS_EQ_PARAM_KEYS, uiByKey: MIDAS_EQ_UI_BY_KEY, valueByKey: MIDAS_EQ_VALUE_BY_KEY, valueMapByKey: MIDAS_EQ_VALUE_MAP_BY_KEY, notesByKey: MIDAS_EQ_NOTES_BY_KEY },
  { typeValue: 31, typedPrefix: 'fairComp', category: 'Processing', paramKeys: FAIR_COMP_PARAM_KEYS, uiByKey: FAIR_COMP_UI_BY_KEY, valueByKey: FAIR_COMP_VALUE_BY_KEY, valueMapByKey: FAIR_COMP_VALUE_MAP_BY_KEY, notesByKey: FAIR_COMP_NOTES_BY_KEY },
  { typeValue: 32, typedPrefix: 'mulBndDist', category: 'Processing', paramKeys: MUL_BND_DIST_PARAM_KEYS, uiByKey: MUL_BND_DIST_UI_BY_KEY, valueByKey: MUL_BND_DIST_VALUE_BY_KEY, valueMapByKey: MUL_BND_DIST_VALUE_MAP_BY_KEY, notesByKey: MUL_BND_DIST_NOTES_BY_KEY },
  { typeValue: 33, typedPrefix: 'noiseGate', category: 'Processing', paramKeys: NOISE_GATE_PARAM_KEYS, uiByKey: NOISE_GATE_UI_BY_KEY, valueByKey: NOISE_GATE_VALUE_BY_KEY, valueMapByKey: NOISE_GATE_VALUE_MAP_BY_KEY, notesByKey: NOISE_GATE_NOTES_BY_KEY },
  { typeValue: 34, typedPrefix: 'decimDelay', category: 'Delay', paramKeys: DECIM_DELAY_PARAM_KEYS, uiByKey: DECIM_DELAY_UI_BY_KEY, valueByKey: DECIM_DELAY_VALUE_BY_KEY, valueMapByKey: DECIM_DELAY_VALUE_MAP_BY_KEY, notesByKey: DECIM_DELAY_NOTES_BY_KEY },
  { typeValue: 35, typedPrefix: 'vintgPitch', category: 'Creative', paramKeys: VINTG_PITCH_PARAM_KEYS, uiByKey: VINTG_PITCH_UI_BY_KEY, valueByKey: VINTG_PITCH_VALUE_BY_KEY, valueMapByKey: VINTG_PITCH_VALUE_MAP_BY_KEY, notesByKey: VINTG_PITCH_NOTES_BY_KEY },
];

function formatNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : `${value}`;
}

function formatEnumMap(valueMap: Record<number, string>): string {
  return Object.entries(valueMap)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([value, label]) => `${value}=${label}`)
    .join(', ');
}

function renderManualEffectsTable(): string {
  const rows = MANUAL_EFFECTS.map(([name, category], index) => `| ${index + 1} | ${name} | ${category} |`);
  return [
    '| Manual index | Manual name | Category |',
    '|-----------:|-------------|----------|',
    ...rows,
  ].join('\n');
}

function renderEffectSection(effect: EffectDoc): string {
  const effectName = FX_TYPE_VALUE_MAP[effect.typeValue] ?? `Type${effect.typeValue}`;
  const rows = effect.paramKeys.map((key, index) => {
    const ui = effect.uiByKey?.[key] ?? {};
    const value = effect.valueByKey?.[key];
    const noteParts: string[] = [];
    if (value?.modDestination) noteParts.push('Mod Matrix destination');
    const enumMap = effect.valueMapByKey?.[key];
    if (enumMap) noteParts.push(`Enum: ${formatEnumMap(enumMap)}`);
    if (value?.displayBuckets?.length) noteParts.push(`Display buckets: ${formatDisplayBuckets(value.displayBuckets)}`);
    const notes = effect.notesByKey?.[key];
    if (notes) noteParts.push(notes);
    return `| ${index + 1} | \`${key}\` | ${ui.abbr ?? '—'} | ${ui.name ?? '—'} | ${value?.units ?? '—'} | ${value?.min !== undefined ? formatNumber(value.min) : '—'} | ${value?.max !== undefined ? formatNumber(value.max) : '—'} | ${noteParts.join('; ') || '—'} |`;
  });

  return [
    `## FX Type ${effect.typeValue} — ${effectName}`,
    '',
    `- Type value: \`${effect.typeValue}\``,
    `- Category: ${effect.category}`,
    `- Typed prefix: \`fxN.${effect.typedPrefix}.*\``,
    '',
    '| Param | Key | UI Abbr | UI Name | Units | Min | Max | Notes |',
    '|------:|-----|---------|---------|-------|-----|-----|-------|',
    ...rows,
    '',
  ].join('\n');
}

function renderDocument(): string {
  const sections = EFFECT_DOCS
    .sort((a, b) => a.typeValue - b.typeValue)
    .map((effect) => renderEffectSection(effect))
    .join('\n');

  return [
    '# DeepMind 12 FX Reference (Patchwork/MCP)',
    '',
    '<!-- Generated by src/scripts/generate-fx-reference.ts. Do not hand-edit. -->',
    '',
    'This document is intended for AI reasoning and human debugging.',
    '',
    'It describes:',
    '- FX type numbers',
    '- the typed derived snapshot key prefixes used by `decoded-patch-map.ts`',
    '- the per-type parameter ordering',
    '- UI abbreviations/names and display ranges when that metadata exists in source',
    '',
    '## Conventions',
    '',
    '- The DeepMind has 4 FX blocks (`fx1`..`fx4`).',
    '- Each FX block exposes raw params as `fxN.param.1` .. `fxN.param.12`.',
    '- When `fxN.type` matches a known effect type, the snapshot also exposes typed derived fields.',
    '- Typed fields are normalized to `0..1` and may include UI metadata and display ranges.',
    '',
    '### Parameter ordering',
    '',
    '- `param.1` corresponds to the first key listed for a type, `param.2` to the second, and so on.',
    '',
    '## Manual Effects List (order only)',
    '',
    'This is the manual order and category grouping. Internal `fxN.type` values differ and must be treated separately.',
    '',
    renderManualEffectsTable(),
    '',
    '## Internal FX Types',
    '',
    sections.trimEnd(),
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRootDir = path.resolve(moduleDir, '../..');
  const outputPath = path.resolve(repoRootDir, 'references/deepmind_fx.md');
  await writeFile(outputPath, renderDocument(), 'utf8');
  console.log(`Wrote ${outputPath}`);
}

await main();