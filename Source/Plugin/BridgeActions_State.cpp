#include "BridgeActions.h"
#include "PluginProcessor.h"
#include "Core/DiagnosticSnapshots.h"

namespace BridgeActions {

void getSynthState (ABDEepAudioProcessor& audioProcessor,
                   const juce::Array<juce::var>& args,
                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    juce::DynamicObject::Ptr stateObj = new juce::DynamicObject();
    
    auto& apvts = audioProcessor.getAPVTS();
    auto state = apvts.copyState();
    
    for (int i = 0; i < state.getNumChildren(); ++i)
    {
        auto child = state.getChild(i);
        juce::String paramID = child.getProperty("id").toString();
        if (auto* param = apvts.getParameter(paramID))
        {
            stateObj->setProperty(paramID, (double)param->getValue());
        }
    }

    stateObj->setProperty("presetName", audioProcessor.getPresetName());
    
    completion (juce::var (stateObj.get()));
}

void setPresetName (ABDEepAudioProcessor& audioProcessor,
                   const juce::Array<juce::var>& args,
                   juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 1)
    {
        juce::String name = args[0].toString();
        audioProcessor.setPresetName(name);
    }
    completion (juce::var::undefined());
}

void getVoiceState (ABDEepAudioProcessor& audioProcessor,
                    const juce::Array<juce::var>& args,
                    juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    auto& engine = audioProcessor.getSynthEngine();
    completion (engine.getVoiceState());
}

void getAudioWaveform (ABDEepAudioProcessor& audioProcessor,
                       const juce::Array<juce::var>& args,
                       juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    auto& engine = audioProcessor.getSynthEngine();
    completion (engine.getAudioWaveform());
}

void getDiagnosticSnapshot (ABDEepAudioProcessor& audioProcessor,
                            const juce::Array<juce::var>& args,
                            juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    auto& engine = audioProcessor.getSynthEngine();
    auto snap = engine.getDiagnosticSnapshot();
    
    juce::DynamicObject::Ptr root = new juce::DynamicObject();
    root->setProperty ("diagnosticSchemaVersion", 1);
    root->setProperty ("vcfOversample", snap.vcfOversample);
    root->setProperty ("vcfVoicingMode", snap.vcfVoicingMode);
    root->setProperty ("driftAmount", (double)snap.driftAmount);
    
    root->setProperty ("pitchBend", (double)snap.pitchBend);
    root->setProperty ("modWheel", (double)snap.modWheel);
    root->setProperty ("aftertouch", (double)snap.aftertouch);
    root->setProperty ("sustainPedal", (double)snap.sustainPedal);
    root->setProperty ("peakLevel", (double)snap.peakLevel);
    root->setProperty ("voiceMode", snap.voiceMode);
    root->setProperty ("polyChordNoteCount", snap.polyChordNoteCount);
    
    root->setProperty ("timestamp", (double)snap.timestamp);
    root->setProperty ("blockCounter", (double)snap.blockCounter);
    
    juce::Array<juce::var> voiceArr;
    for (int i = 0; i < 12; ++i)
    {
        const auto& v = snap.voiceSnapshots[i];
        juce::DynamicObject::Ptr vo = new juce::DynamicObject();
        vo->setProperty ("voiceIndex", v.voiceIndex);
        vo->setProperty ("isActive", v.isActive);
        vo->setProperty ("noteNumber", (double)v.noteNumber);
        vo->setProperty ("velocity", (double)v.velocity);
        
        vo->setProperty ("detuneSemitonesBase", (double)v.detuneSemitonesBase);
        vo->setProperty ("detuneSemitonesEffective", (double)v.detuneSemitonesEffective);
        vo->setProperty ("panBase", (double)v.panBase);
        vo->setProperty ("panEffective", (double)v.panEffective);
        
        vo->setProperty ("baseCutoffHz", (double)v.baseCutoffHz);
        vo->setProperty ("effectiveCutoffHz", (double)v.effectiveCutoffHz);
        vo->setProperty ("resonance", (double)v.resonance);
        vo->setProperty ("envDepthSign", (double)v.envDepthSign);
        vo->setProperty ("keytrackHz", (double)v.keytrackHz);
        vo->setProperty ("hpfCutoffHz", (double)v.hpfCutoffHz);
        
        vo->setProperty ("vcfCutoffBase", (double)v.vcfCutoffBase);
        vo->setProperty ("vcfCutoffEffectiveHz", (double)v.vcfCutoffEffectiveHz);
        vo->setProperty ("vcfResonanceBase", (double)v.vcfResonanceBase);
        vo->setProperty ("vcfResonanceEffective", (double)v.vcfResonanceEffective);
        vo->setProperty ("hpfCutoffBase", (double)v.hpfCutoffBase);
        
        vo->setProperty ("lfo1Value", (double)v.lfo1Value);
        vo->setProperty ("lfo2Value", (double)v.lfo2Value);
        vo->setProperty ("env1Value", (double)v.env1Value);
        vo->setProperty ("env2Value", (double)v.env2Value);
        vo->setProperty ("driftHz", (double)v.driftHz);
        
        vo->setProperty ("cutoffFromEnv", (double)v.cutoffFromEnv);
        vo->setProperty ("cutoffFromLfo", (double)v.cutoffFromLfo);
        vo->setProperty ("cutoffFromDrift", (double)v.cutoffFromDrift);
        vo->setProperty ("cutoffFromKeytrack", (double)v.cutoffFromKeytrack);
        
        vo->setProperty ("envStage", v.envStage);
        vo->setProperty ("sourceTag", v.sourceTag);
        vo->setProperty ("flags", (int)v.flags);
        
        voiceArr.add (juce::var (vo.get()));
    }
    
    root->setProperty ("voiceSnapshots", voiceArr);
    completion (juce::var (root.get()));
}

} // namespace BridgeActions
