#pragma once

#include <JuceHeader.h>

/**
 * CalibrationSpec v1 — Reduced calibration contract for ABDEep.
 *
 * Scope: Transfer/mapping calibration + voice voicing calibration only.
 * Excluded: Internal DSP model constants (ZDF stability, soft-clip, resonance curves).
 *
 * Rule: "If it describes how we translate a musical/hardware value to an
 *        audible response, it goes here. If it describes how we keep the
 *        algorithm stable or characterful internally, it does NOT go here."
 *
 * Thread safety: The effective calibration is resolved once per audio block
 * in SynthEngine and propagated as an immutable snapshot to SynthVoice.
 * Mutations from the UI/WebUI only take effect on the next block boundary.
 */
struct CalibrationSpec
{
    static constexpr int kSchemaVersion = 1;

    //==============================================================================
    // TransferCalibration: mapping between semantic/domain values and audible units
    //==============================================================================
    struct TransferCalibration
    {
        struct
        {
            float minHz       = 50.0f;    // SynthVoice.cpp:576 — low end of log sweep
            float maxHz       = 20000.0f; // derived: minHz * curveBase^1 = 20000
            float curveBase   = 400.0f;   // SynthVoice.cpp:576 — ratio max/min
        } vcfCutoff;

        struct
        {
            float referenceHz = 261.63f;  // SynthVoice.cpp:579 — C4 (Middle C)
            float amountScale = 1.0f;     // multiplier on (freq1 - referenceHz) * vcfKeyTrack
        } vcfKeytrack;

        struct
        {
            float cutoffScale = 0.3f;     // SynthVoice.cpp:559 — pitch bend -> VCF attenuation
        } vcfPitchBend;

        struct
        {
            float minHz         = 10.0f;    // SynthVoice.cpp:610 — hard floor
            float maxHz         = 10000.0f; // SynthVoice.cpp:610 — hard ceiling
            float modScaleHz    = 500.0f;   // SynthVoice.cpp:610 — mod matrix depth -> Hz
            float bassBoostGain = 1.0f;     // JunoHPF.h:140 — default bass boost gain
        } hpf;

        struct
        {
            float driftToTimeScale = 0.3f;  // SynthVoice.cpp:312 — env time drift scaling
            float minTimeSec       = 0.002f; // SynthEngine.cpp:148 — minimum envelope time (2ms)
            float exponentialBase  = 32768.0f; // SynthEngine.cpp:148 — 2^15, 16-bit timer limit
        } envelopes;

        struct
        {
            float rateScale = 0.041f;  // magic number scale multiplier
            float rateExp   = 7.3747f; // magic number exponent coefficient
        } lfo;
    } transfer;

    //==============================================================================
    // VoiceCalibration: perceptual voicing parameters (high-level, interpretable)
    //==============================================================================
    struct VoiceCalibration
    {
        float staticPitchCentsRange    = 3.0f;  // SynthVoice.cpp:21  — ±1.5 cents per voice
        float staticCutoffNormRange    = 0.06f; // SynthVoice.cpp:25  — ±3% of normalized cutoff
        float staticResNormRange       = 0.04f; // SynthVoice.cpp:28  — ±2% of resonance
        float staticEnvTimeNormRange   = 0.16f; // SynthVoice.cpp:31  — ±8% of envelope time
        float cutoffDriftScale         = 1.0f;  // SynthVoice.cpp:565 — drift -> cutoff (full)
        float resonanceDriftScale      = 0.5f;  // SynthVoice.cpp:566 — drift -> resonance (halved)
    } voice;

    //==============================================================================
    // Factory defaults — must produce identical sound to current hardcoded values
    //==============================================================================
    static CalibrationSpec factoryDefaults()
    {
        return {};  // all fields have inline defaults matching current code
    }

    /** Retorna la ruta del archivo de calibración activa guardada por defecto en el sistema */
    static juce::File getDefaultCalibrationFile();

    //==============================================================================
    // XML serialization (internal format uses ValueTree ↔ XML)
    //==============================================================================
    juce::String toXml() const;
    static CalibrationSpec fromXml(const juce::String& xml, juce::String& errorOut);
    static CalibrationSpec fromXmlWithFallback(const juce::String& xml, CalibrationSpec fallback);

    //==============================================================================
    // Diff — returns field-by-field difference between two calibrations
    //==============================================================================
    struct FieldDiff
    {
        juce::String path;       // e.g. "transfer.vcfCutoff.minHz"
        float oldValue = 0.0f;
        float newValue = 0.0f;
    };

    static juce::Array<FieldDiff> diff(const CalibrationSpec& a, const CalibrationSpec& b);

    //==============================================================================
    // Validation — clamp all fields to safe ranges
    //==============================================================================
    void validate();  // clamps all fields to safe min/max

    //==============================================================================
    // Equality — exact bitwise comparison (for change detection)
    //==============================================================================
    bool operator==(const CalibrationSpec& other) const;
    bool operator!=(const CalibrationSpec& other) const { return !(*this == other); }
};
