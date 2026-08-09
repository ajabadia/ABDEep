// WebUI/js/calibration_store_validation.js
// Validation and compliance functions — extracted from calibration_store_utils.js
// Depends on: calibration_store_data.js (DEFAULT_CALIBRATION_SPEC, CRITICAL_PARAM_IDS)
// Depends on: calibration_store_utils.js (isObject)
// Depends on: calibration_store_normalize.js (normalizeSnapshot) — via resolveSpec

/* global isObject, DEFAULT_CALIBRATION_SPEC */

/* eslint-disable no-unused-vars */

/**
 * Classifies a param comparison into a badge type.
 * @param {string} paramId
 * @param {number|null} rawA
 * @param {number|null} rawB
 * @returns {'exact'|'alias-shared'|'stub'|'mismatch'|'info'}
 */
function classifyRow(paramId, rawA, rawB) {
  const STUB_PARAMS = new Set(['vcfpolemode', 'vcf_pole_mode']);
  const ALIAS_PARAMS = new Set(['voicedrift', 'oscdrift', 'voice_drift', 'osc_drift']);

  if (STUB_PARAMS.has(paramId)) { return 'stub'; }
  if (ALIAS_PARAMS.has(paramId)) { return 'alias-shared'; }
  if (rawA === null || rawB === null) { return 'info'; }
  if (rawA === rawB) { return 'exact'; }
  return 'mismatch';
}

function resolveSpec(spec) {
  if (isObject(spec) && isObject(spec.voice)) { return spec; }
  return DEFAULT_CALIBRATION_SPEC;
}

function validateLiveCompliance(snapshot, spec) {
  if (!isObject(snapshot) || !Array.isArray(snapshot.voices)) {
    return { compliant: false, voiceResults: [], totalCompliant: 0 };
  }
  const s = resolveSpec(spec);
  const sv = s.voice;
  const pitchRange = sv.staticPitchCentsRange / 2;
  const cutoffRange = sv.staticCutoffNormRange / 2;
  const resRange = sv.staticResNormRange / 2;
  const envRange = sv.staticEnvTimeNormRange / 2;

  const voiceResults = snapshot.voices.map(function(v, idx) {
    const checks = [];

    if (Number.isFinite(v.driftOsc1Pitch)) {
      checks.push({
        param: 'driftOsc1Pitch', label: 'OSC1 Pitch Drift',
        value: v.driftOsc1Pitch, specLimit: pitchRange, unit: 'cents',
        passed: Math.abs(v.driftOsc1Pitch) <= pitchRange,
      });
    }
    if (Number.isFinite(v.driftOsc2Pitch)) {
      checks.push({
        param: 'driftOsc2Pitch', label: 'OSC2 Pitch Drift',
        value: v.driftOsc2Pitch, specLimit: pitchRange, unit: 'cents',
        passed: Math.abs(v.driftOsc2Pitch) <= pitchRange,
      });
    }
    if (Number.isFinite(v.driftVcfCutoff)) {
      checks.push({
        param: 'driftVcfCutoff', label: 'VCF Cutoff Drift',
        value: v.driftVcfCutoff, specLimit: cutoffRange, unit: 'norm',
        passed: Math.abs(v.driftVcfCutoff) <= cutoffRange,
      });
    }
    if (Number.isFinite(v.driftVcfResonance)) {
      checks.push({
        param: 'driftVcfResonance', label: 'VCF Resonance Drift',
        value: v.driftVcfResonance, specLimit: resRange, unit: 'norm',
        passed: Math.abs(v.driftVcfResonance) <= resRange,
      });
    }
    if (Number.isFinite(v.driftEnvTime)) {
      checks.push({
        param: 'driftEnvTime', label: 'Env Time Drift',
        value: v.driftEnvTime, specLimit: envRange, unit: 'norm',
        passed: Math.abs(v.driftEnvTime) <= envRange,
      });
    }

    const active = v.active === true;
    const failedChecks = checks.filter(function(c) { return !c.passed; });
    const passed = !active || failedChecks.length === 0;

    return {
      voiceIndex: idx,
      active: active,
      midiNote: v.midiNote,
      velocity: v.velocity,
      passed: passed,
      checks: checks,
      failedCount: failedChecks.length,
    };
  });

  const totalCompliant = voiceResults.filter(function(r) { return r.passed; }).length;
  return {
    compliant: totalCompliant === voiceResults.length,
    voiceResults: voiceResults,
    totalCompliant: totalCompliant,
  };
}

// ── Exports ──
globalThis.classifyRow = classifyRow;
globalThis.resolveSpec = resolveSpec;
globalThis.validateLiveCompliance = validateLiveCompliance;

if (typeof window !== 'undefined') {
  window.validateLiveCompliance = validateLiveCompliance;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    classifyRow: classifyRow,
    resolveSpec: resolveSpec,
    validateLiveCompliance: validateLiveCompliance,
  };
}
