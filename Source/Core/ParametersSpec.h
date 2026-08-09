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

    // Category-specific spec providers (implemented in separate .cpp files)
    static std::vector<ParamInfo> getLfoSpecs();
    static std::vector<ParamInfo> getOscSpecs();
    static std::vector<ParamInfo> getVcfSpecs();
    static std::vector<ParamInfo> getEnvSpecs();
    static std::vector<ParamInfo> getVcaSpecs();
    static std::vector<ParamInfo> getVoiceSpecs();
    static std::vector<ParamInfo> getModMatrixSpecs();
    static std::vector<ParamInfo> getSeqSpecs();
    static std::vector<ParamInfo> getArpChordSpecs();
    static std::vector<ParamInfo> getFxSpecs();

    // Aggregator: concatenates all category specs
    static std::vector<ParamInfo> getSpecs();
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout();
};
