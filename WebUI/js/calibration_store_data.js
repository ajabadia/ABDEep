// WebUI/js/calibration_store_data.js
// Static data constants for Calibration Store — extracted from calibration_store_utils.js

/* eslint-disable no-unused-vars */

// ──────────────────────────────────────────────────────
// Static param-to-voice-field mapping (CL-07c)
// ──────────────────────────────────────────────────────
const PARAM_VOICE_MAP = {
  'vcfcutoff':         { voiceField: 'effectiveCutoffHz',      label: 'VCF Cutoff (Hz)',          module: 'VCF',  intermediate: false },
  'vcfresonance':      { voiceField: 'resonance',              label: 'VCF Resonance',            module: 'VCF',  intermediate: false },
  'vcfpolemode':       { voiceField: null,                     label: 'VCF Pole Mode',            module: 'VCF',  intermediate: true },
  'vcfenvdepth':       { voiceField: null,                     label: 'VCF Env Depth',            module: 'VCF',  intermediate: true },
  'hpfcutoff':         { voiceField: 'hpfCutoffHz',            label: 'HPF Cutoff (Hz)',          module: 'HPF',  intermediate: false },
  'voicedrift':        { voiceField: 'driftVcfCutoff',         label: 'Voice Drift → Cutoff',    module: 'Drift', intermediate: false },
  'voicedrift_res':    { voiceField: 'driftVcfResonance',      label: 'Voice Drift → Res',        module: 'Drift', intermediate: false },
  'voicedrift_env':    { voiceField: 'driftEnvTime',           label: 'Voice Drift → Env Time',   module: 'Drift', intermediate: false },
  'oscdrift':          { voiceField: 'driftOsc1Pitch',         label: 'OSC1 Drift Pitch',         module: 'Drift', intermediate: false },
  'osc2_drift':        { voiceField: 'driftOsc2Pitch',         label: 'OSC2 Drift Pitch',         module: 'Drift', intermediate: false },
  'detune':            { voiceField: 'detuneSemitones',        label: 'Detune (semitones)',       module: 'OSC',  intermediate: false },
  'pan':               { voiceField: 'panEffective',           label: 'Pan Effective',            module: 'OSC',  intermediate: false },
  'midinote':          { voiceField: 'midiNote',               label: 'MIDI Note',                module: 'Voice', intermediate: false },
  'velocity':          { voiceField: 'velocity',               label: 'Velocity',                 module: 'Voice', intermediate: false },
};

// ──────────────────────────────────────────────────────
// CRITICAL_PARAMS — used by both classifyRow/validation and buildStratifiedRun
// ──────────────────────────────────────────────────────
const CRITICAL_PARAM_IDS = new Set([
  'vcfcutoff', 'vcfresonance', 'vcfenvdepth', 'hpfcutoff',
  'vcfpolemode', 'voicedrift', 'oscdrift',
]);

// ──────────────────────────────────────────────────────
// DEFAULT_STATE — initial state for calibration store
// ──────────────────────────────────────────────────────
const DEFAULT_STATE = {
  diagnosticSnapshot: null,
  snapshotStatus: 'idle', // idle | loading | ready | error
  snapshotError: null,
  lastUpdatedAt: null,

  selectedPatchA: null,
  selectedPatchB: null,

  activeTab: 'raw', // raw | semantic | engine | effective
  selectedVoiceIndex: 0,
  selectedRowKey: null,

  filters: {
    showOnlyDifferences: false,
    showOnlyCritical: false,
    showOnlyAliases: false,
    search: '',
  },

  // CL-08: Stratified Bank Run
  bankRunConfig: {
    sourceScope: 'loaded',
    bankNames: [],
    categoryFilter: '',
    favoritesOnly: false,
    criticalOnly: false,
    sampleSize: 24,
    seed: 42,
  },
  bankRunItems: [],
  bankRunId: null,

  // CL-09: Workflow Session
  workflowSession: {
    runId: null,
    currentIndex: 0,
    startedAt: null,
    completedAt: null,
    itemStatuses: {},
    itemNotes: {},
  },

  // CL-10: Live Validation
  calibrationSpec: null,
  liveScanActive: false,
  complianceReport: null,
  liveScanTimerId: null,
};

// ──────────────────────────────────────────────────────
// DEFAULT_CALIBRATION_SPEC — default calibration spec
// ──────────────────────────────────────────────────────
const DEFAULT_CALIBRATION_SPEC = {
  schemaVersion: 1,
  voice: {
    staticPitchCentsRange: 3.0,
    staticCutoffNormRange: 0.06,
    staticResNormRange: 0.04,
    staticEnvTimeNormRange: 0.16,
    cutoffDriftScale: 1.0,
    resonanceDriftScale: 0.5,
  },
  transfer: {
    vcfCutoff: { minHz: 50, maxHz: 20000, curveBase: 400 },
    vcfKeytrack: { referenceHz: 261.63, amountScale: 1.0 },
    vcfPitchBend: { cutoffScale: 0.3 },
    hpf: { minHz: 10, maxHz: 10000, modScaleHz: 500, bassBoostGain: 1.0 },
    envelopes: { driftToTimeScale: 0.3, maxTimeSec: 10 },
    lfo: { rateScale: 0.041, rateExp: 7.3747 },
  },
};

// ── Exports ──
globalThis.PARAM_VOICE_MAP = PARAM_VOICE_MAP;
globalThis.CRITICAL_PARAM_IDS = CRITICAL_PARAM_IDS;
globalThis.DEFAULT_STATE = DEFAULT_STATE;
globalThis.DEFAULT_CALIBRATION_SPEC = DEFAULT_CALIBRATION_SPEC;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PARAM_VOICE_MAP, CRITICAL_PARAM_IDS,
    DEFAULT_STATE, DEFAULT_CALIBRATION_SPEC,
  };
}
