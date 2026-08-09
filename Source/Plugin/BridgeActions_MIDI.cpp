#include "BridgeActions.h"
#include "PluginProcessor.h"
#include "MidiTranslationEngine.h"

namespace BridgeActions {

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

void pianoNoteOn (ABDEepAudioProcessor& audioProcessor,
                 const juce::Array<juce::var>& args,
                 juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    if (args.size() >= 2)
    {
        int note = (int) args[0];
        float velocity = (float) args[1];
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

void panic (ABDEepAudioProcessor& audioProcessor,
            const juce::Array<juce::var>& args,
            juce::WebBrowserComponent::NativeFunctionCompletion completion)
{
    juce::ignoreUnused (args);
    
    // 1. Limpiar cola de MIDI pendiente del procesador de audio
    audioProcessor.clearMidiQueue();
    
    // 2. Ejecutar panic físico en el motor
    auto& engine = audioProcessor.getSynthEngine();
    engine.panic();
    
    completion (juce::var::undefined());
}

} // namespace BridgeActions
