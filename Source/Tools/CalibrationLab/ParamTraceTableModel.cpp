#include "ParamTraceTableModel.h"

ParamTraceTableModel::ParamTraceTableModel()
{
    // Reconstruir con stubs iniciales vacíos
    VoiceDiagnosticSnapshot dummyVoice;
    EngineDiagnosticSnapshot dummyEngine;
    rebuildRows (dummyVoice, dummyEngine);
}

void ParamTraceTableModel::updateData (const VoiceDiagnosticSnapshot& snapshot, const EngineDiagnosticSnapshot& engineSnap)
{
    const juce::ScopedLock sl (dataLock);
    rebuildRows (snapshot, engineSnap);
}

int ParamTraceTableModel::getNumRows()
{
    const juce::ScopedLock sl (dataLock);
    return (int)rows.size();
}

void ParamTraceTableModel::paintRowBackground (juce::Graphics& g, int rowNumber, int width, int height, bool rowIsSelected)
{
    juce::ignoreUnused (rowNumber);
    if (rowIsSelected)
    {
        g.fillAll (juce::Colours::darkblue.withAlpha (0.4f));
    }
    else
    {
        g.fillAll (rowNumber % 2 == 0 ? juce::Colours::darkgrey.withAlpha (0.1f) : juce::Colours::transparentBlack);
    }
    g.setColour (juce::Colours::grey.withAlpha (0.2f));
    g.drawHorizontalLine (height - 1, 0.0f, (float)width);
}

void ParamTraceTableModel::paintCell (juce::Graphics& g, int rowNumber, int columnId, int width, int height, bool rowIsSelected)
{
    const juce::ScopedLock sl (dataLock);
    if (rowNumber >= (int)rows.size()) return;

    const auto& row = rows[(size_t)rowNumber];
    g.setColour (rowIsSelected ? juce::Colours::white : juce::Colours::lightgrey);
    g.setFont (13.0f);

    juce::String text;
    switch (columnId)
    {
        case colParamId:      text = row.paramId; break;
        case colOffset:       text = row.byteOffset >= 0 ? juce::String (row.byteOffset) : "-"; break;
        case colRaw:          text = row.rawValueStr; break;
        case colNormalized:   text = row.normalizedStr; break;
        case colDspBase:      text = row.dspBaseStr; break;
        case colDspEffective: text = row.dspEffectiveStr; break;
        case colDerived:      text = row.isDerived ? "YES" : "NO"; break;
    }

    if (columnId == colDerived && row.isDerived)
        g.setColour (juce::Colours::yellow);

    g.drawText (text, 4, 0, width - 8, height, juce::Justification::centredLeft, true);
}

juce::Component* ParamTraceTableModel::refreshComponentForCell (int rowNumber, int columnId, bool isRowSelected, juce::Component* existingComponentToUpdate)
{
    juce::ignoreUnused (rowNumber, columnId, isRowSelected);
    return existingComponentToUpdate; // Sin widgets personalizados por ahora
}

void ParamTraceTableModel::rebuildRows (const VoiceDiagnosticSnapshot& v, const EngineDiagnosticSnapshot& e)
{
    rows.clear();

    // 1. VCF Cutoff (Byte 39)
    {
        ParamRow r;
        r.paramId = "vcf_cutoff";
        r.name = "VCF Cutoff";
        r.byteOffset = 39;
        r.rawValueStr = v.isActive ? "Derived" : "-";
        r.normalizedStr = v.isActive ? juce::String (v.baseCutoffHz > 0 ? std::log(v.baseCutoffHz / 50.0f) / std::log(400.0f) : 0.0f, 4) : "-";
        r.dspBaseStr = v.isActive ? juce::String (v.baseCutoffHz, 1) + " Hz" : "-";
        r.dspEffectiveStr = v.isActive ? juce::String (v.effectiveCutoffHz, 1) + " Hz" : "-";
        r.isDerived = true;
        rows.push_back (r);
    }

    // 2. VCF Resonance (Byte 41)
    {
        ParamRow r;
        r.paramId = "vcf_resonance";
        r.name = "VCF Resonance";
        r.byteOffset = 41;
        r.rawValueStr = v.isActive ? "Derived" : "-";
        r.normalizedStr = v.isActive ? juce::String (v.resonance, 4) : "-";
        r.dspBaseStr = v.isActive ? juce::String (v.resonance, 4) : "-";
        r.dspEffectiveStr = v.isActive ? juce::String (v.resonance, 4) : "-";
        r.isDerived = false;
        rows.push_back (r);
    }

    // 3. VCF Env Depth Bipolar (Byte 42)
    {
        ParamRow r;
        r.paramId = "vcf_env_depth";
        r.name = "VCF Env Depth";
        r.byteOffset = 42;
        r.rawValueStr = v.isActive ? "Derived" : "-";
        r.normalizedStr = v.isActive ? juce::String (v.envDepthSign, 4) : "-";
        r.dspBaseStr = v.isActive ? juce::String (v.envDepthSign, 4) : "-";
        r.dspEffectiveStr = v.isActive ? juce::String (v.env1Value, 4) : "-";
        r.isDerived = false;
        rows.push_back (r);
    }

    // 4. HPF Cutoff (Byte 40)
    {
        ParamRow r;
        r.paramId = "hpf_cutoff";
        r.name = "HPF Cutoff";
        r.byteOffset = 40;
        r.rawValueStr = v.isActive ? "Derived" : "-";
        r.normalizedStr = v.isActive ? juce::String (v.hpfCutoffHz / 500.0f, 4) : "-";
        r.dspBaseStr = v.isActive ? juce::String (v.hpfCutoffHz, 1) + " Hz" : "-";
        r.dspEffectiveStr = v.isActive ? juce::String (v.hpfCutoffHz, 1) + " Hz" : "-";
        r.isDerived = false;
        rows.push_back (r);
    }

    // 5. Analog Drift
    {
        ParamRow r;
        r.paramId = "voice_drift";
        r.name = "Voice Drift";
        r.byteOffset = 88;
        r.rawValueStr = "-";
        r.normalizedStr = juce::String (e.driftAmount, 4);
        r.dspBaseStr = juce::String (e.driftAmount, 4);
        r.dspEffectiveStr = v.isActive ? juce::String (v.driftHz, 2) + " Hz" : "-";
        r.isDerived = true;
        rows.push_back (r);
    }
}
