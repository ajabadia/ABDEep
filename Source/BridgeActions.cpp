#include "BridgeActions.h"
#include "PluginProcessor.h"
#include "MidiTranslationEngine.h"

namespace BridgeActions {

void setParameter (ABDEepAudioProcessor& audioProcessor,
                  const juce::Array<juce::var>& args,
                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 2)
    {
        juce::String paramID = args[0].toString();
        float val = static_cast<float> (args[1]);
        
        DBG("BridgeActions::setParameter: " + paramID + " = " + juce::String(val));
        
        if (auto* param = audioProcessor.getAPVTS().getParameter (paramID))
        {
            param->setValueNotifyingHost (val);
            completion (juce::var::undefined());
        }
        else
        {
            completion ({});
        }
    }
    else
    {
        completion ({});
    }
}

void beginGesture (ABDEepAudioProcessor& audioProcessor,
                  const juce::Array<juce::var>& args,
                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 1)
    {
        juce::String paramID = args[0].toString();
        if (auto* param = audioProcessor.getAPVTS().getParameter (paramID))
            param->beginChangeGesture();
    }
    completion (juce::var::undefined());
}

void endGesture (ABDEepAudioProcessor& audioProcessor,
                const juce::Array<juce::var>& args,
                juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 1)
    {
        juce::String paramID = args[0].toString();
        if (auto* param = audioProcessor.getAPVTS().getParameter (paramID))
            param->endChangeGesture();
    }
    completion (juce::var::undefined());
}

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
    
    completion (juce::var (stateObj.get()));
}

void requestMidiDump (ABDEepAudioProcessor& audioProcessor,
                     const juce::Array<juce::var>& args,
                     juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 1)
    {
        juce::String type = args[0].toString();
        juce::MidiMessage msg;
        
        if (type == "edit")
            msg = MidiTranslationEngine::createEditBufferDumpRequest();
        else if (type == "global")
            msg = MidiTranslationEngine::createGlobalParameterDumpRequest();
        
        if (msg.getRawDataSize() > 0)
        {
            audioProcessor.queueMidiMessage (msg);
            completion (juce::var::undefined());
            return;
        }
    }
    completion ({});
}

void readFactoryBankFile (ABDEepAudioProcessor& audioProcessor,
                         const juce::Array<juce::var>& args,
                         juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (audioProcessor);
    if (args.size() >= 1)
    {
        juce::String bankLetter = args[0].toString().toUpperCase();
        juce::File currentFile (__FILE__);
        juce::File resourcesDir = currentFile.getParentDirectory().getParentDirectory().getChildFile ("resources").getChildFile ("banks");
        juce::File factoryDir = resourcesDir.getChildFile ("Factory Banks V1.1.2");
        juce::File syxFile = factoryDir.getChildFile ("Synth Bank " + bankLetter + ".syx");
        
        DBG("[readFactoryBankFile] Bank=" + bankLetter + " Path=" + syxFile.getFullPathName() + " Exists=" + juce::String((int)syxFile.existsAsFile()));
        
        if (syxFile.existsAsFile())
        {
            juce::MemoryBlock mb;
            syxFile.loadFileAsData (mb);
            
            // Convert to hex string to return securely to Javascript
            juce::String hexStr = juce::String::toHexString (mb.getData(), (int) mb.getSize());
            completion (juce::var (hexStr));
            return;
        }
    }
    completion ({});
}

void pianoNoteOn (ABDEepAudioProcessor& audioProcessor,
                 const juce::Array<juce::var>& args,
                 juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    DBG("[BridgeActions] pianoNoteOn called with " + juce::String(args.size()) + " args");
    if (args.size() >= 2)
    {
        int note = (int) args[0];
        float velocity = (float) args[1];
        DBG("[BridgeActions] pianoNoteOn: note=" + juce::String(note) + " vel=" + juce::String(velocity));
        auto msg = juce::MidiMessage::noteOn (1, note, (juce::uint8) juce::jlimit (0, 127, juce::roundToInt (velocity * 127.0f)));
        audioProcessor.queueMidiMessage (msg);
    }
    completion (juce::var::undefined());
}

void pianoNoteOff (ABDEepAudioProcessor& audioProcessor,
                  const juce::Array<juce::var>& args,
                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 1)
    {
        int note = (int) args[0];
        auto msg = juce::MidiMessage::noteOff (1, note);
        audioProcessor.queueMidiMessage (msg);
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

} // namespace BridgeActions
