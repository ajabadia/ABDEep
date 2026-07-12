#pragma once

#include <JuceHeader.h>
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
    std::unique_ptr<juce::WebBrowserComponent> webComponent;
    juce::String lastActiveNotesJSON;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ABDEepAudioProcessorEditor)
};
