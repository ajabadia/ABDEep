#pragma once

#include <JuceHeader.h>
#include <WebView2Bridge/JuceWebView2Component.h>
#include "PluginProcessor.h"

class ABDEepAudioProcessorEditor  : public juce::AudioProcessorEditor,
                                     private juce::Timer
{
public:
    ABDEepAudioProcessorEditor (ABDEepAudioProcessor&);
    ~ABDEepAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;

    ABDEepAudioProcessor& audioProcessor;
    std::unique_ptr<abd::webview2::JuceWebView2Component> webComponent;
    juce::String lastActiveNotesJSON;
    juce::String lastVoiceStatesJSON;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ABDEepAudioProcessorEditor)
};
