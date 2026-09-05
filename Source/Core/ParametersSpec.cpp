/**
 * @purpose Especificacion consolidada de parametros SysEx / NRPN del emulador DeepMind 12.
 * Concatena todas las funciones de categoria (ParametersSpec_*.cpp) en un solo vector.
 * @purpose_en Consolidates parameters SysEx / NRPN specifications for Behringer DeepMind 12 emulator.
 */
#include "ParametersSpec.h"

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getSpecs()
{
    std::vector<ParamInfo> specs;

    auto append = [&specs](const std::vector<ParamInfo>& src) {
        specs.insert(specs.end(), src.begin(), src.end());
    };

    append(getLfoSpecs());
    append(getOscSpecs());
    append(getVcfSpecs());
    append(getEnvSpecs());
    append(getVcaSpecs());
    append(getVoiceSpecs());
    append(getModMatrixSpecs());
    append(getSeqSpecs());
    append(getArpChordSpecs());
    append(getFxSpecs());

    return specs;
}

juce::AudioProcessorValueTreeState::ParameterLayout ParametersSpec::createLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    for (const auto& s : getSpecs())
    {
        if (s.type == "bool")
        {
            juce::StringArray boolOptions = { "Off", "On" };
            layout.add(std::make_unique<juce::AudioParameterChoice>(
                juce::ParameterID{ s.id, 1 }, s.name,
                boolOptions,
                s.defaultValue > 0.5f ? 1 : 0));
        }
        else if (s.type == "enum")
        {
            juce::StringArray opts = s.options;
            if (opts.isEmpty())
                opts = { "Off", "On" };

            layout.add(std::make_unique<juce::AudioParameterChoice>(
                juce::ParameterID{ s.id, 1 }, s.name,
                opts,
                static_cast<int>(s.defaultValue)));
        }
        else
        {
            layout.add(std::make_unique<juce::AudioParameterFloat>(
                juce::ParameterID{ s.id, 1 }, s.name,
                juce::NormalisableRange<float>(s.minValue, s.maxValue),
                s.defaultValue));
        }
    }

    // Global setting: protect unsaved edits from being overwritten by Program Change
    layout.add(std::make_unique<juce::AudioParameterBool>(
        juce::ParameterID{ "protect_unsaved_edits", 1 }, "Protect Unsaved Edits",
        false));

    // Runtime state: patch has been edited since last load (cleared on patch load, set on user edit)
    // Not exposed to UI, not persistent in presets
    layout.add(std::make_unique<juce::AudioParameterBool>(
        juce::ParameterID{ "patch_dirty", 1 }, "Patch Dirty",
        false));

    // Global MIDI channel filter for Program Change / Bank Select (0 = omni, 1-16 = specific channel)
    layout.add(std::make_unique<juce::AudioParameterChoice>(
        juce::ParameterID{ "midi_channel", 1 }, "MIDI Channel",
        juce::StringArray{ "Omni", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16" },
        0));

    return layout;
}
