/**
 * wasm_compat.h — Global compatibility header for JUCE + Emscripten.
 */
#pragma once

#ifdef __EMSCRIPTEN__

// 1. Include emscripten and standard headers globally
#include <emscripten/emscripten.h>
#include <algorithm>
#include <iterator>
#include <cmath>
#include <map>
#include <string>
#include <atomic>
#include <memory>

// Forward decl of String to avoid full juce header dependencies inside wasm_compat.h
namespace juce
{
    class String;
    class RangedAudioParameter
    {
    public:
        virtual ~RangedAudioParameter() = default;
    };

    struct ParameterID
    {
        ParameterID() = default;
        // Accept constructors used in ParametersSpec
        ParameterID (const juce::String&, int) {}
        ParameterID (const char*, int) {}
    };

    class AudioParameterChoice : public RangedAudioParameter
    {
    public:
        AudioParameterChoice() = default;
        // Accept typical constructor signature
        template <typename... Args>
        AudioParameterChoice (Args&&...) {}

        int getIndex() const noexcept { return static_cast<int>(std::round(value.load())); }
        std::atomic<float> value{0.0f};
    };

    class AudioParameterFloat : public RangedAudioParameter
    {
    public:
        AudioParameterFloat() = default;
        // Accept typical constructor signatures
        template <typename... Args>
        AudioParameterFloat (Args&&...) {}

        std::atomic<float> value{0.0f};
    };

    class AudioProcessorValueTreeState
    {
    public:
        struct ParameterLayout
        {
            // Accept the .add(...) method used to populate the layout
            template <typename T>
            void add (T&&) {}
        };

        AudioProcessorValueTreeState() = default;
        ~AudioProcessorValueTreeState() = default;

        std::atomic<float>* getRawParameterValue(const juce::String& id) noexcept;
        RangedAudioParameter* getParameter(const juce::String& id) noexcept;

        std::map<std::string, std::atomic<float>> values;
        std::map<std::string, AudioParameterChoice> choices;
    };

    using uint32 = unsigned int;
    using int64 = long long;
    using uint8 = unsigned char;
    using uint16 = unsigned short;
}

// Bring standard JUCE integer types into the global namespace for compilation
using juce::uint32;
using juce::int64;
using juce::uint8;
using juce::uint16;

#endif
