#pragma once

#include <JuceHeader.h>

class ABDEepAudioProcessor;

namespace BridgeActions {

void setParameter (ABDEepAudioProcessor& audioProcessor,
                  const juce::Array<juce::var>& args,
                  juce::WebBrowserComponent::NativeFunctionCompletion completion);

void beginGesture (ABDEepAudioProcessor& audioProcessor,
                  const juce::Array<juce::var>& args,
                  juce::WebBrowserComponent::NativeFunctionCompletion completion);

void endGesture (ABDEepAudioProcessor& audioProcessor,
                const juce::Array<juce::var>& args,
                juce::WebBrowserComponent::NativeFunctionCompletion completion);

void getSynthState (ABDEepAudioProcessor& audioProcessor,
                   const juce::Array<juce::var>& args,
                   juce::WebBrowserComponent::NativeFunctionCompletion completion);

void requestMidiDump (ABDEepAudioProcessor& audioProcessor,
                     const juce::Array<juce::var>& args,
                     juce::WebBrowserComponent::NativeFunctionCompletion completion);

void readFactoryBankFile (ABDEepAudioProcessor& audioProcessor,
                         const juce::Array<juce::var>& args,
                         juce::WebBrowserComponent::NativeFunctionCompletion completion);

void pianoNoteOn (ABDEepAudioProcessor& audioProcessor,
                 const juce::Array<juce::var>& args,
                 juce::WebBrowserComponent::NativeFunctionCompletion completion);

void pianoNoteOff (ABDEepAudioProcessor& audioProcessor,
                  const juce::Array<juce::var>& args,
                  juce::WebBrowserComponent::NativeFunctionCompletion completion);

void getVoiceState (ABDEepAudioProcessor& audioProcessor,
                    const juce::Array<juce::var>& args,
                    juce::WebBrowserComponent::NativeFunctionCompletion completion);

void getAudioWaveform (ABDEepAudioProcessor& audioProcessor,
                       const juce::Array<juce::var>& args,
                       juce::WebBrowserComponent::NativeFunctionCompletion completion);

} // namespace BridgeActions
