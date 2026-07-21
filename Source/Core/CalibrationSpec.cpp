#include "CalibrationSpec.h"

//==============================================================================
// JSON serialization
//==============================================================================

static juce::ValueTree specToValueTree(const CalibrationSpec& spec)
{
    juce::ValueTree vt("CalibrationSpec");

    vt.setProperty("schemaVersion", spec.kSchemaVersion, nullptr);

    // Transfer
    auto transfer = juce::ValueTree("Transfer");
    auto vcf = juce::ValueTree("VCF");
    vcf.setProperty("cutoffMinHz",      spec.transfer.vcfCutoff.minHz, nullptr);
    vcf.setProperty("cutoffMaxHz",      spec.transfer.vcfCutoff.maxHz, nullptr);
    vcf.setProperty("cutoffCurveBase",  spec.transfer.vcfCutoff.curveBase, nullptr);
    transfer.addChild(vcf, -1, nullptr);

    auto keytrack = juce::ValueTree("Keytrack");
    keytrack.setProperty("referenceHz", spec.transfer.vcfKeytrack.referenceHz, nullptr);
    keytrack.setProperty("amountScale", spec.transfer.vcfKeytrack.amountScale, nullptr);
    transfer.addChild(keytrack, -1, nullptr);

    auto pb = juce::ValueTree("PitchBend");
    pb.setProperty("cutoffScale", spec.transfer.vcfPitchBend.cutoffScale, nullptr);
    transfer.addChild(pb, -1, nullptr);

    auto hpf = juce::ValueTree("HPF");
    hpf.setProperty("minHz",         spec.transfer.hpf.minHz, nullptr);
    hpf.setProperty("maxHz",         spec.transfer.hpf.maxHz, nullptr);
    hpf.setProperty("modScaleHz",    spec.transfer.hpf.modScaleHz, nullptr);
    hpf.setProperty("bassBoostGain", spec.transfer.hpf.bassBoostGain, nullptr);
    transfer.addChild(hpf, -1, nullptr);

    auto env = juce::ValueTree("Envelopes");
    env.setProperty("driftToTimeScale", spec.transfer.envelopes.driftToTimeScale, nullptr);
    env.setProperty("minTimeSec",       spec.transfer.envelopes.minTimeSec, nullptr);
    env.setProperty("exponentialBase",  spec.transfer.envelopes.exponentialBase, nullptr);
    transfer.addChild(env, -1, nullptr);

    auto lfoVal = juce::ValueTree("LFO");
    lfoVal.setProperty("rateScale",      spec.transfer.lfo.rateScale, nullptr);
    lfoVal.setProperty("rateExp",        spec.transfer.lfo.rateExp, nullptr);
    transfer.addChild(lfoVal, -1, nullptr);

    vt.addChild(transfer, -1, nullptr);

    // Voice
    auto voice = juce::ValueTree("Voice");
    voice.setProperty("staticPitchCentsRange",  spec.voice.staticPitchCentsRange, nullptr);
    voice.setProperty("staticCutoffNormRange",  spec.voice.staticCutoffNormRange, nullptr);
    voice.setProperty("staticResNormRange",     spec.voice.staticResNormRange, nullptr);
    voice.setProperty("staticEnvTimeNormRange", spec.voice.staticEnvTimeNormRange, nullptr);
    voice.setProperty("cutoffDriftScale",       spec.voice.cutoffDriftScale, nullptr);
    voice.setProperty("resonanceDriftScale",    spec.voice.resonanceDriftScale, nullptr);
    vt.addChild(voice, -1, nullptr);

    return vt;
}

static void valueTreeToSpec(const juce::ValueTree& vt, CalibrationSpec& spec)
{
    if (! vt.hasProperty("schemaVersion"))
        return;

    auto transfer = vt.getChildWithName("Transfer");
    if (transfer.isValid())
    {
        auto vcf = transfer.getChildWithName("VCF");
        if (vcf.isValid())
        {
            spec.transfer.vcfCutoff.minHz     = (float) vcf.getProperty("cutoffMinHz",     spec.transfer.vcfCutoff.minHz);
            spec.transfer.vcfCutoff.maxHz     = (float) vcf.getProperty("cutoffMaxHz",     spec.transfer.vcfCutoff.maxHz);
            spec.transfer.vcfCutoff.curveBase = (float) vcf.getProperty("cutoffCurveBase", spec.transfer.vcfCutoff.curveBase);
        }

        auto keytrack = transfer.getChildWithName("Keytrack");
        if (keytrack.isValid())
        {
            spec.transfer.vcfKeytrack.referenceHz = (float) keytrack.getProperty("referenceHz", spec.transfer.vcfKeytrack.referenceHz);
            spec.transfer.vcfKeytrack.amountScale = (float) keytrack.getProperty("amountScale", spec.transfer.vcfKeytrack.amountScale);
        }

        auto pb = transfer.getChildWithName("PitchBend");
        if (pb.isValid())
            spec.transfer.vcfPitchBend.cutoffScale = (float) pb.getProperty("cutoffScale", spec.transfer.vcfPitchBend.cutoffScale);

        auto hpf = transfer.getChildWithName("HPF");
        if (hpf.isValid())
        {
            spec.transfer.hpf.minHz         = (float) hpf.getProperty("minHz",         spec.transfer.hpf.minHz);
            spec.transfer.hpf.maxHz         = (float) hpf.getProperty("maxHz",         spec.transfer.hpf.maxHz);
            spec.transfer.hpf.modScaleHz    = (float) hpf.getProperty("modScaleHz",    spec.transfer.hpf.modScaleHz);
            spec.transfer.hpf.bassBoostGain = (float) hpf.getProperty("bassBoostGain", spec.transfer.hpf.bassBoostGain);
        }

        auto env = transfer.getChildWithName("Envelopes");
        if (env.isValid())
        {
            spec.transfer.envelopes.driftToTimeScale = (float) env.getProperty("driftToTimeScale", spec.transfer.envelopes.driftToTimeScale);
            spec.transfer.envelopes.minTimeSec       = (float) env.getProperty("minTimeSec",       spec.transfer.envelopes.minTimeSec);
            spec.transfer.envelopes.exponentialBase  = (float) env.getProperty("exponentialBase",  spec.transfer.envelopes.exponentialBase);
        }

        auto lfoVal = transfer.getChildWithName("LFO");
        if (lfoVal.isValid())
        {
            spec.transfer.lfo.rateScale = (float) lfoVal.getProperty("rateScale", spec.transfer.lfo.rateScale);
            spec.transfer.lfo.rateExp   = (float) lfoVal.getProperty("rateExp",   spec.transfer.lfo.rateExp);
        }
    }

    auto voice = vt.getChildWithName("Voice");
    if (voice.isValid())
    {
        spec.voice.staticPitchCentsRange  = (float) voice.getProperty("staticPitchCentsRange",  spec.voice.staticPitchCentsRange);
        spec.voice.staticCutoffNormRange  = (float) voice.getProperty("staticCutoffNormRange",  spec.voice.staticCutoffNormRange);
        spec.voice.staticResNormRange     = (float) voice.getProperty("staticResNormRange",     spec.voice.staticResNormRange);
        spec.voice.staticEnvTimeNormRange = (float) voice.getProperty("staticEnvTimeNormRange", spec.voice.staticEnvTimeNormRange);
        spec.voice.cutoffDriftScale       = (float) voice.getProperty("cutoffDriftScale",       spec.voice.cutoffDriftScale);
        spec.voice.resonanceDriftScale    = (float) voice.getProperty("resonanceDriftScale",    spec.voice.resonanceDriftScale);
    }
}

juce::String CalibrationSpec::toXml() const
{
    return specToValueTree(*this).toXmlString();
}

CalibrationSpec CalibrationSpec::fromXml(const juce::String& xml, juce::String& errorOut)
{
    CalibrationSpec spec;

    auto xmlDoc = juce::XmlDocument::parse(xml);
    if (xmlDoc == nullptr)
    {
        errorOut = "Invalid XML";
        return spec;
    }

    auto vt = juce::ValueTree::fromXml(*xmlDoc);
    if (! vt.isValid() || vt.getType().toString() != "CalibrationSpec")
    {
        errorOut = "Invalid CalibrationSpec XML structure";
        return spec;
    }

    int version = (int) vt.getProperty("schemaVersion", 0);
    if (version < 1 || version > kSchemaVersion)
    {
        errorOut = "Unsupported schemaVersion: " + juce::String(version);
        return spec;
    }

    valueTreeToSpec(vt, spec);
    spec.validate();
    errorOut = {};
    return spec;
}

CalibrationSpec CalibrationSpec::fromXmlWithFallback(const juce::String& xml, CalibrationSpec fallback)
{
    juce::String error;
    auto spec = fromXml(xml, error);
    if (! error.isEmpty())
        return fallback;
    return spec;
}

//==============================================================================
// Diff
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
    check("transfer.envelopes.minTimeSec",       a.transfer.envelopes.minTimeSec,       b.transfer.envelopes.minTimeSec);
    check("transfer.envelopes.exponentialBase",  a.transfer.envelopes.exponentialBase,  b.transfer.envelopes.exponentialBase);
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
// Validation — clamp all fields to safe ranges
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
    clamp(transfer.envelopes.minTimeSec,       0.0001f, 0.1f);
    clamp(transfer.envelopes.exponentialBase,  100.0f,  65536.0f);

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
// Equality
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
        && eq(transfer.envelopes.minTimeSec,       o.transfer.envelopes.minTimeSec)
        && eq(transfer.envelopes.exponentialBase,  o.transfer.envelopes.exponentialBase)
        && eq(transfer.lfo.rateScale,              o.transfer.lfo.rateScale)
        && eq(transfer.lfo.rateExp,                o.transfer.lfo.rateExp)
        && eq(voice.staticPitchCentsRange,  o.voice.staticPitchCentsRange)
        && eq(voice.staticCutoffNormRange,  o.voice.staticCutoffNormRange)
        && eq(voice.staticResNormRange,     o.voice.staticResNormRange)
        && eq(voice.staticEnvTimeNormRange, o.voice.staticEnvTimeNormRange)
        && eq(voice.cutoffDriftScale,       o.voice.cutoffDriftScale)
        && eq(voice.resonanceDriftScale,    o.voice.resonanceDriftScale);
}

juce::File CalibrationSpec::getDefaultCalibrationFile()
{
    return juce::File::getSpecialLocation (juce::File::userDocumentsDirectory)
        .getChildFile ("ABDEep")
        .getChildFile ("calibration.json");
}
