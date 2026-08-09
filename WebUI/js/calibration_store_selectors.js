// WebUI/js/calibration_store_selectors.js
// Pure selector functions extracted from calibration_store.js (createCalibrationStore factory)
// Each function takes state (or specific data) and returns derived data — no side effects, no closure.
// Depends on: calibration_store_utils.js (for deepClone, nowIso, classifyRow, CRITICAL_PARAM_IDS, etc.)

/* eslint-disable no-unused-vars */

// ────────────────────────────────────────────────────────────
// Diagnostic snapshot selectors
// ────────────────────────────────────────────────────────────

function getSelectedVoiceSnapshot(state) {
  const snap = state.diagnosticSnapshot;
  if (!snap || !Array.isArray(snap.voices)) {return null;}
  return snap.voices[state.selectedVoiceIndex] || null;
}

function getCurrentWorkflowItem(state) {
  const idx = state.workflowSession.currentIndex;
  return state.bankRunItems[idx] || null;
}

function buildEngineRows(snap) {
  if (!snap) {return [];}
  return [
    { key: 'pitchBend', label: 'Pitch Bend', value: snap.engine.pitchBend },
    { key: 'modWheel', label: 'Mod Wheel', value: snap.engine.modWheel },
    { key: 'aftertouch', label: 'Aftertouch', value: snap.engine.aftertouch },
    { key: 'sustainPedal', label: 'Sustain Pedal', value: snap.engine.sustainPedal },
    { key: 'peakLevel', label: 'Peak Level', value: snap.engine.peakLevel },
  ];
}

function buildEffectiveRows(voice) {
  if (!voice) {return [];}

  const rows = [
    {
      module: 'VCF',
      key: 'effectiveCutoffHz',
      label: 'VCF Effective Cutoff',
      value: voice.effectiveCutoffHz,
      supported: voice.effectiveCutoffHz !== null,
      contractVerified: true,
    },
    {
      module: 'VCF',
      key: 'resonance',
      label: 'VCF Resonance',
      value: voice.resonance,
      supported: voice.resonance !== null,
      contractVerified: true,
    },
    {
      module: 'HPF',
      key: 'hpfCutoffHz',
      label: 'HPF Cutoff',
      value: voice.hpfCutoffHz,
      supported: voice.hpfCutoffHz !== null,
      contractVerified: true,
    },
    {
      module: 'HPF',
      key: 'hpfBassBoostActive',
      label: 'HPF Bass Boost',
      value: voice.hpfBassBoostActive,
      supported: true,
      contractVerified: true,
    },
    {
      module: 'Drift',
      key: 'driftOsc1Pitch',
      label: 'Drift OSC1 Pitch',
      value: voice.driftOsc1Pitch,
      supported: voice.driftOsc1Pitch !== null,
      contractVerified: true,
    },
    {
      module: 'Drift',
      key: 'driftOsc2Pitch',
      label: 'Drift OSC2 Pitch',
      value: voice.driftOsc2Pitch,
      supported: voice.driftOsc2Pitch !== null,
      contractVerified: true,
    },
    {
      module: 'Drift',
      key: 'driftVcfCutoff',
      label: 'Drift VCF Cutoff',
      value: voice.driftVcfCutoff,
      supported: voice.driftVcfCutoff !== null,
      contractVerified: true,
    },
    {
      module: 'Drift',
      key: 'driftVcfResonance',
      label: 'Drift VCF Resonance',
      value: voice.driftVcfResonance,
      supported: voice.driftVcfResonance !== null,
      contractVerified: true,
    },
    {
      module: 'Drift',
      key: 'driftEnvTime',
      label: 'Drift Env Time',
      value: voice.driftEnvTime,
      supported: voice.driftEnvTime !== null,
      contractVerified: true,
    },
  ];

  return rows.filter((row) => row.supported);
}

function buildVoiceSummaryRows(voice) {
  if (!voice) {return [];}

  return [
    { key: 'active', label: 'Active', value: voice.active },
    { key: 'midiNote', label: 'MIDI Note', value: voice.midiNote },
    { key: 'velocity', label: 'Velocity', value: voice.velocity },
    { key: 'detuneSemitones', label: 'Detune', value: voice.detuneSemitones },
    { key: 'panPosition', label: 'Pan Base', value: voice.panPosition },
    { key: 'panEffective', label: 'Pan Effective', value: voice.panEffective },
    { key: 'modPan', label: 'Pan Mod', value: voice.modPan },
    { key: 'modOsc1DetuneSemitones', label: 'OSC1 Mod Detune', value: voice.modOsc1DetuneSemitones },
    { key: 'modOsc2DetuneSemitones', label: 'OSC2 Mod Detune', value: voice.modOsc2DetuneSemitones },
  ];
}

// ────────────────────────────────────────────────────────────
// Param trace selector
// ────────────────────────────────────────────────────────────

function buildParamTrace(paramId, state, paramVoiceMap, _classifyRowFn) {
  const paramIdLower = (paramId || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  const mapping = (paramVoiceMap || {})[paramIdLower];
  const voice = getSelectedVoiceSnapshot(state);
  const engine = state.diagnosticSnapshot?.engine || {};

  const trace = {
    paramId: paramIdLower,
    label: mapping?.label || paramIdLower,
    module: mapping?.module || null,
    intermediate: mapping?.intermediate || false,
    patchValue: null,
    liveValue: null,
    liveVoice: voice ? { ...voice } : null,
    engineState: engine,
    derivedContributions: [],
  };

  if (mapping?.voiceField && voice) {
    trace.liveValue = voice[mapping.voiceField];
  }

  if (paramIdLower === 'vcfenvdepth' && voice) {
    trace.liveValue = voice.env1Value;
    trace.derivedContributions.push(
      { key: 'cutoffFromEnv', value: voice.cutoffFromEnv, unit: 'Hz' },
      { key: 'cutoffFromLfo', value: voice.cutoffFromLfo, unit: 'Hz' },
      { key: 'cutoffFromDrift', value: voice.cutoffFromDrift, unit: 'Hz' },
      { key: 'cutoffFromKeytrack', value: voice.cutoffFromKeytrack, unit: 'Hz' },
    );
  }

  if (paramIdLower === 'vcfpolemode' && voice) {
    trace.liveValue = voice.resonance !== null ? '4-pole (default)' : 'n/a';
  }

  return trace;
}

// ────────────────────────────────────────────────────────────
// Validation summary selector
// ────────────────────────────────────────────────────────────

function buildValidationSummary(state, maps, critParams, classifyRowFn) {
  const patchA = state.selectedPatchA;
  const patchB = state.selectedPatchB;

  const empty = {
    total: 0,
    exact: 0,
    aliasShared: 0,
    stub: 0,
    mismatch: 0,
    info: 0,
    criticalWarnings: [],
  };

  if (!patchA || !patchB) {return empty;}

  const bytesA = Array.isArray(patchA.unpackedBytes) ? patchA.unpackedBytes : [];
  const bytesB = Array.isArray(patchB.unpackedBytes) ? patchB.unpackedBytes : [];
  const paramToByteOffset = maps?.paramToByteOffset || {};
  const byteOffsetToParamIds = maps?.byteOffsetToParamIds || {};

  const summary = { ...empty };
  const seenOffsets = new Set();

  Object.entries(paramToByteOffset).forEach(([paramId, offset]) => {
    if (seenOffsets.has(offset)) {return;}
    seenOffsets.add(offset);

    const rawA = Number.isFinite(bytesA[offset]) ? bytesA[offset] : null;
    const rawB = Number.isFinite(bytesB[offset]) ? bytesB[offset] : null;
    const classifyFn = typeof classifyRowFn === 'function' ? classifyRowFn : (typeof window._classifyPatchDiffRow === 'function' ? window._classifyPatchDiffRow : () => 'exact');
    const badge = classifyFn(paramId, rawA, rawB);
    summary.total++;
    if (badge === 'exact') {summary.exact++;}
    else if (badge === 'alias-shared') {summary.aliasShared++;}
    else if (badge === 'stub') {summary.stub++;}
    else if (badge === 'mismatch') {summary.mismatch++;}
    else {summary.info++;}

    if ((badge === 'stub' || badge === 'mismatch') && (critParams || new Set()).has(paramId)) {
      summary.criticalWarnings.push({
        paramId,
        offset,
        badge,
        rawA,
        rawB,
      });
    }
  });

  return summary;
}

// Export to globalThis for cross-file access (browser <script> + Node.js/Vitest)
globalThis.getSelectedVoiceSnapshot = getSelectedVoiceSnapshot;
globalThis.getCurrentWorkflowItem = getCurrentWorkflowItem;
globalThis.buildEngineRows = buildEngineRows;
globalThis.buildEffectiveRows = buildEffectiveRows;
globalThis.buildVoiceSummaryRows = buildVoiceSummaryRows;
globalThis.buildParamTrace = buildParamTrace;
globalThis.buildValidationSummary = buildValidationSummary;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSelectedVoiceSnapshot,
    getCurrentWorkflowItem,
    buildEngineRows,
    buildEffectiveRows,
    buildVoiceSummaryRows,
    buildParamTrace,
    buildValidationSummary,
  };
}
