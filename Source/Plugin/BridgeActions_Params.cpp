#include "BridgeActions.h"
#include "PluginProcessor.h"

namespace BridgeActions {

void setParameter (ABDEepAudioProcessor& audioProcessor,
                  const juce::Array<juce::var>& args,
                  juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 2)
    {
        juce::String paramID = args[0].toString();
        float val = static_cast<float> (args[1]);
        
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

} // namespace BridgeActions
