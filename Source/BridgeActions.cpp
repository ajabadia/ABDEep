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
        juce::File resourcesDir = currentFile.getParentDirectory().getParentDirectory().getChildFile ("resources");
        juce::File factoryDir = resourcesDir.getChildFile ("Factory Banks V1.1.2");
        juce::File syxFile = factoryDir.getChildFile ("Synth Bank " + bankLetter + ".syx");
        
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

} // namespace BridgeActions
