// WebUI/js/calibration_store_normalize.js
// Snapshot normalization functions — extracted from calibration_store_utils.js
// Depends on: calibration_store_utils.js (isObject, nowIso)

/* global isObject, nowIso */

/* eslint-disable no-unused-vars */

function normalizeVoice(voice, index) {
  const v = isObject(voice) ? voice : {};
  return {
    index,
    active: v.isActive === true || !!v.active,
    midiNote: Number.isFinite(v.midiNote) ? v.midiNote
      : (Number.isFinite(v.noteNumber) ? v.noteNumber : -1),
    velocity: Number.isFinite(v.velocity) ? v.velocity : 0,

    detuneSemitones: Number.isFinite(v.detuneSemitones) ? v.detuneSemitones
      : (Number.isFinite(v.detuneSemitonesEffective) ? v.detuneSemitonesEffective : 0),
    panPosition: Number.isFinite(v.panPosition) ? v.panPosition
      : (Number.isFinite(v.panBase) ? v.panBase : 0.5),
    panEffective: Number.isFinite(v.panEffective) ? v.panEffective
      : (Number.isFinite(v.panBase) ? v.panBase : 0.5),
    voicePanSpread: Number.isFinite(v.voicePanSpread) ? v.voicePanSpread : 0,

    modOsc1DetuneSemitones: Number.isFinite(v.modOsc1DetuneSemitones) ? v.modOsc1DetuneSemitones : 0,
    modOsc2DetuneSemitones: Number.isFinite(v.modOsc2DetuneSemitones) ? v.modOsc2DetuneSemitones : 0,
    modPan: Number.isFinite(v.modPan) ? v.modPan : 0,

    baseCutoffHz: Number.isFinite(v.baseCutoffHz) ? v.baseCutoffHz : null,
    effectiveCutoffHz: Number.isFinite(v.effectiveCutoffHz) ? v.effectiveCutoffHz : null,
    resonance: Number.isFinite(v.resonance) ? v.resonance : null,
    hpfCutoffHz: Number.isFinite(v.hpfCutoffHz) ? v.hpfCutoffHz : null,
    hpfBassBoostActive: v.hpfBassBoostActive === true,

    lfo1Value: Number.isFinite(v.lfo1Value) ? v.lfo1Value : null,
    lfo2Value: Number.isFinite(v.lfo2Value) ? v.lfo2Value : null,
    env1Value: Number.isFinite(v.env1Value) ? v.env1Value : null,
    env2Value: Number.isFinite(v.env2Value) ? v.env2Value : null,
    driftHz: Number.isFinite(v.driftHz) ? v.driftHz : null,

    cutoffFromEnv: Number.isFinite(v.cutoffFromEnv) ? v.cutoffFromEnv : null,
    cutoffFromLfo: Number.isFinite(v.cutoffFromLfo) ? v.cutoffFromLfo : null,
    cutoffFromDrift: Number.isFinite(v.cutoffFromDrift) ? v.cutoffFromDrift : null,
    cutoffFromKeytrack: Number.isFinite(v.cutoffFromKeytrack) ? v.cutoffFromKeytrack : null,

    envStage: Number.isFinite(v.envStage) ? v.envStage : null,
    sourceTag: Number.isFinite(v.sourceTag) ? v.sourceTag : null,

    driftOsc1Pitch: Number.isFinite(v.driftOsc1Pitch) ? v.driftOsc1Pitch : null,
    driftOsc2Pitch: Number.isFinite(v.driftOsc2Pitch) ? v.driftOsc2Pitch : null,
    driftVcfCutoff: Number.isFinite(v.driftVcfCutoff) ? v.driftVcfCutoff : null,
    driftVcfResonance: Number.isFinite(v.driftVcfResonance) ? v.driftVcfResonance : null,
    driftEnvTime: Number.isFinite(v.driftEnvTime) ? v.driftEnvTime : null,
  };
}

function normalizeSnapshot(raw) {
  if (!isObject(raw)) {
    throw new Error('Diagnostic snapshot inv\u00E1lido: payload no es objeto');
  }

  const schemaVersion = raw.diagnosticSchemaVersion;
  if (schemaVersion !== 1) {
    throw new Error('diagnosticSchemaVersion no soportado: ' + schemaVersion);
  }

  const voicesRaw = Array.isArray(raw.voices) ? raw.voices
    : (Array.isArray(raw.voiceSnapshots) ? raw.voiceSnapshots : []);
  const voices = voicesRaw.map(function(voice, index) { return normalizeVoice(voice, index); });

  return {
    diagnosticSchemaVersion: 1,
    capturedAt: raw.capturedAt || nowIso(),

    engine: {
      vcfOversample: Number.isFinite(raw.vcfOversample) ? raw.vcfOversample : 0,
      vcfVoicingMode: Number.isFinite(raw.vcfVoicingMode) ? raw.vcfVoicingMode : 0,
      driftAmount: Number.isFinite(raw.driftAmount) ? raw.driftAmount : 0,
      voiceMode: Number.isFinite(raw.voiceMode) ? raw.voiceMode : 0,
      polyChordNoteCount: Number.isFinite(raw.polyChordNoteCount) ? raw.polyChordNoteCount : 0,
      pitchBend: Number.isFinite(raw.pitchBend) ? raw.pitchBend : 0,
      modWheel: Number.isFinite(raw.modWheel) ? raw.modWheel : 0,
      aftertouch: Number.isFinite(raw.aftertouch) ? raw.aftertouch : 0,
      sustainPedal: Number.isFinite(raw.sustainPedal) ? raw.sustainPedal : 0,
      peakLevel: Number.isFinite(raw.peakLevel) ? raw.peakLevel : 0,
    },

    voices: voices,
  };
}

// ── Exports ──
globalThis.normalizeVoice = normalizeVoice;
globalThis.normalizeSnapshot = normalizeSnapshot;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    normalizeVoice: normalizeVoice,
    normalizeSnapshot: normalizeSnapshot,
  };
}
