#pragma once

#include <JuceHeader.h>

class ParametersSpec
{
public:
    struct ParamInfo
    {
        juce::String id;
        juce::String name;
        juce::String block;
        juce::String type;
        float minValue = 0.0f;
        float maxValue = 1.0f;
        float defaultValue = 0.0f;
        int midiCC = -1;
        int midiNRPN = -1;
        juce::StringArray options;
    };

    static std::vector<ParamInfo> getSpecs();
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout();
};
