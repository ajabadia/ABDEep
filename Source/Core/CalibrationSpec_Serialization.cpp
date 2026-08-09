#include "CalibrationSpec.h"

//==============================================================================
// specToValueTree — Serializa CalibrationSpec a ValueTree
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
    env.setProperty("maxTimeSec",       spec.transfer.envelopes.maxTimeSec, nullptr);
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

//==============================================================================
// valueTreeToSpec — Deserializa ValueTree a CalibrationSpec
//==============================================================================

static void valueTreeToSpec(const juce::ValueTree& vt, CalibrationSpec& spec)
{
    if (! vt.hasProperty("schemaVersion"))
        return;

    auto transfer = vt.getChildWithName("Transfer");
    if (transfer.isValid())
    {
        auto vcfNode = transfer.getChildWithName("VCF");
        if (vcfNode.isValid())
        {
            spec.transfer.vcfCutoff.minHz     = (float) vcfNode.getProperty("cutoffMinHz",     spec.transfer.vcfCutoff.minHz);
            spec.transfer.vcfCutoff.maxHz     = (float) vcfNode.getProperty("cutoffMaxHz",     spec.transfer.vcfCutoff.maxHz);
            spec.transfer.vcfCutoff.curveBase = (float) vcfNode.getProperty("cutoffCurveBase", spec.transfer.vcfCutoff.curveBase);
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

        auto hpfNode = transfer.getChildWithName("HPF");
        if (hpfNode.isValid())
        {
            spec.transfer.hpf.minHz         = (float) hpfNode.getProperty("minHz",         spec.transfer.hpf.minHz);
            spec.transfer.hpf.maxHz         = (float) hpfNode.getProperty("maxHz",         spec.transfer.hpf.maxHz);
            spec.transfer.hpf.modScaleHz    = (float) hpfNode.getProperty("modScaleHz",    spec.transfer.hpf.modScaleHz);
            spec.transfer.hpf.bassBoostGain = (float) hpfNode.getProperty("bassBoostGain", spec.transfer.hpf.bassBoostGain);
        }

        auto env = transfer.getChildWithName("Envelopes");
        if (env.isValid())
        {
            spec.transfer.envelopes.driftToTimeScale = (float) env.getProperty("driftToTimeScale", spec.transfer.envelopes.driftToTimeScale);
            spec.transfer.envelopes.maxTimeSec       = (float) env.getProperty("maxTimeSec",       spec.transfer.envelopes.maxTimeSec);
        }

        auto lfoNode = transfer.getChildWithName("LFO");
        if (lfoNode.isValid())
        {
            spec.transfer.lfo.rateScale = (float) lfoNode.getProperty("rateScale", spec.transfer.lfo.rateScale);
            spec.transfer.lfo.rateExp   = (float) lfoNode.getProperty("rateExp",   spec.transfer.lfo.rateExp);
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

//==============================================================================
// toXml — CalibrationSpec → XML string
//==============================================================================

juce::String CalibrationSpec::toXml() const
{
    return specToValueTree(*this).toXmlString();
}

//==============================================================================
// fromXml — XML string → CalibrationSpec con validacion
//==============================================================================

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

//==============================================================================
// fromXmlWithFallback — XML string con fallback
//==============================================================================

CalibrationSpec CalibrationSpec::fromXmlWithFallback(const juce::String& xml, CalibrationSpec fallback)
{
    juce::String error;
    auto spec = fromXml(xml, error);
    if (! error.isEmpty())
        return fallback;
    return spec;
}
