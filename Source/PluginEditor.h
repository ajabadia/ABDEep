#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"

class ABDEepAudioProcessorEditor  : public juce::AudioProcessorEditor
{
public:
    ABDEepAudioProcessorEditor (ABDEepAudioProcessor&);
    ~ABDEepAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    ABDEepAudioProcessor& audioProcessor;
    std::unique_ptr<juce::WebBrowserComponent> webComponent;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ABDEepAudioProcessorEditor)
};
