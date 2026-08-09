#include "CalibrationSpec.h"

//==============================================================================
// Diff — campo a campo entre dos calibraciones
//==============================================================================

juce::Array<CalibrationSpec::FieldDiff> CalibrationSpec::diff(const CalibrationSpec& a, const CalibrationSpec& b)
{
    juce::Array<FieldDiff> diffs;

    auto check = [&](const juce::String& path, float av, float bv)
    {
        if (std::abs(av - bv) > 1e-6f)
            diffs.add({ path, av, bv });
    };

    check("transfer.vcfCutoff.minHz",       a.transfer.vcfCutoff.minHz,       b.transfer.vcfCutoff.minHz);
    check("transfer.vcfCutoff.maxHz",       a.transfer.vcfCutoff.maxHz,       b.transfer.vcfCutoff.maxHz);
    check("transfer.vcfCutoff.curveBase",   a.transfer.vcfCutoff.curveBase,   b.transfer.vcfCutoff.curveBase);
    check("transfer.vcfKeytrack.referenceHz", a.transfer.vcfKeytrack.referenceHz, b.transfer.vcfKeytrack.referenceHz);
    check("transfer.vcfKeytrack.amountScale", a.transfer.vcfKeytrack.amountScale, b.transfer.vcfKeytrack.amountScale);
    check("transfer.vcfPitchBend.cutoffScale", a.transfer.vcfPitchBend.cutoffScale, b.transfer.vcfPitchBend.cutoffScale);
    check("transfer.hpf.minHz",             a.transfer.hpf.minHz,             b.transfer.hpf.minHz);
    check("transfer.hpf.maxHz",             a.transfer.hpf.maxHz,             b.transfer.hpf.maxHz);
    check("transfer.hpf.modScaleHz",        a.transfer.hpf.modScaleHz,        b.transfer.hpf.modScaleHz);
    check("transfer.hpf.bassBoostGain",     a.transfer.hpf.bassBoostGain,     b.transfer.hpf.bassBoostGain);
    check("transfer.envelopes.driftToTimeScale", a.transfer.envelopes.driftToTimeScale, b.transfer.envelopes.driftToTimeScale);
    check("transfer.envelopes.maxTimeSec",       a.transfer.envelopes.maxTimeSec,       b.transfer.envelopes.maxTimeSec);
    check("transfer.lfo.rateScale",              a.transfer.lfo.rateScale,              b.transfer.lfo.rateScale);
    check("transfer.lfo.rateExp",                a.transfer.lfo.rateExp,                b.transfer.lfo.rateExp);

    check("voice.staticPitchCentsRange",  a.voice.staticPitchCentsRange,  b.voice.staticPitchCentsRange);
    check("voice.staticCutoffNormRange",  a.voice.staticCutoffNormRange,  b.voice.staticCutoffNormRange);
    check("voice.staticResNormRange",     a.voice.staticResNormRange,     b.voice.staticResNormRange);
    check("voice.staticEnvTimeNormRange", a.voice.staticEnvTimeNormRange, b.voice.staticEnvTimeNormRange);
    check("voice.cutoffDriftScale",       a.voice.cutoffDriftScale,       b.voice.cutoffDriftScale);
    check("voice.resonanceDriftScale",    a.voice.resonanceDriftScale,    b.voice.resonanceDriftScale);

    return diffs;
}

//==============================================================================
// validate — Clamp todos los campos a rangos seguros
//==============================================================================

void CalibrationSpec::validate()
{
    auto clamp = [](float& v, float lo, float hi) { v = std::clamp(v, lo, hi); };

    // Transfer: VCF cutoff
    clamp(transfer.vcfCutoff.minHz,       10.0f,  200.0f);
    clamp(transfer.vcfCutoff.maxHz,       1000.0f, 40000.0f);
    clamp(transfer.vcfCutoff.curveBase,   50.0f,  2000.0f);

    // Transfer: keytrack
    clamp(transfer.vcfKeytrack.referenceHz, 100.0f, 500.0f);
    clamp(transfer.vcfKeytrack.amountScale, 0.0f,   5.0f);

    // Transfer: pitch bend
    clamp(transfer.vcfPitchBend.cutoffScale, 0.0f, 1.0f);

    // Transfer: HPF
    clamp(transfer.hpf.minHz,       1.0f,   200.0f);
    clamp(transfer.hpf.maxHz,       100.0f, 20000.0f);
    clamp(transfer.hpf.modScaleHz,  50.0f,  5000.0f);
    clamp(transfer.hpf.bassBoostGain, 0.1f, 3.0f);

    // Transfer: envelopes
    clamp(transfer.envelopes.driftToTimeScale, 0.0f, 1.0f);
    clamp(transfer.envelopes.maxTimeSec,       0.1f, 30.0f);

    // Transfer: LFO
    clamp(transfer.lfo.rateScale, 0.001f, 1.0f);
    clamp(transfer.lfo.rateExp,   1.0f,   20.0f);

    // Voice
    clamp(voice.staticPitchCentsRange,  0.0f,  20.0f);
    clamp(voice.staticCutoffNormRange,  0.0f,  0.5f);
    clamp(voice.staticResNormRange,     0.0f,  0.3f);
    clamp(voice.staticEnvTimeNormRange, 0.0f,  0.5f);
    clamp(voice.cutoffDriftScale,       0.0f,  5.0f);
    clamp(voice.resonanceDriftScale,    0.0f,  5.0f);
}

//==============================================================================
// operator== — Comparacion exacta bit a bit
//==============================================================================

bool CalibrationSpec::operator==(const CalibrationSpec& o) const
{
    auto eq = [](float a, float b) { return std::abs(a - b) < 1e-6f; };

    return eq(transfer.vcfCutoff.minHz,       o.transfer.vcfCutoff.minHz)
        && eq(transfer.vcfCutoff.maxHz,       o.transfer.vcfCutoff.maxHz)
        && eq(transfer.vcfCutoff.curveBase,   o.transfer.vcfCutoff.curveBase)
        && eq(transfer.vcfKeytrack.referenceHz, o.transfer.vcfKeytrack.referenceHz)
        && eq(transfer.vcfKeytrack.amountScale, o.transfer.vcfKeytrack.amountScale)
        && eq(transfer.vcfPitchBend.cutoffScale, o.transfer.vcfPitchBend.cutoffScale)
        && eq(transfer.hpf.minHz,             o.transfer.hpf.minHz)
        && eq(transfer.hpf.maxHz,             o.transfer.hpf.maxHz)
        && eq(transfer.hpf.modScaleHz,        o.transfer.hpf.modScaleHz)
        && eq(transfer.hpf.bassBoostGain,     o.transfer.hpf.bassBoostGain)
        && eq(transfer.envelopes.driftToTimeScale, o.transfer.envelopes.driftToTimeScale)
        && eq(transfer.envelopes.maxTimeSec,       o.transfer.envelopes.maxTimeSec)
        && eq(transfer.lfo.rateScale,              o.transfer.lfo.rateScale)
        && eq(transfer.lfo.rateExp,                o.transfer.lfo.rateExp)
        && eq(voice.staticPitchCentsRange,  o.voice.staticPitchCentsRange)
        && eq(voice.staticCutoffNormRange,  o.voice.staticCutoffNormRange)
        && eq(voice.staticResNormRange,     o.voice.staticResNormRange)
        && eq(voice.staticEnvTimeNormRange, o.voice.staticEnvTimeNormRange)
        && eq(voice.cutoffDriftScale,       o.voice.cutoffDriftScale)
        && eq(voice.resonanceDriftScale,    o.voice.resonanceDriftScale);
}

//==============================================================================
// getDefaultCalibrationFile — Ruta del archivo por defecto
//==============================================================================

juce::File CalibrationSpec::getDefaultCalibrationFile()
{
    return juce::File::getSpecialLocation (juce::File::userDocumentsDirectory)
        .getChildFile ("ABDEep")
        .getChildFile ("calibration.json");
}
