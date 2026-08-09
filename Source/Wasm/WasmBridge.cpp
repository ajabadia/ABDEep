#include "WasmBridge.h"
#include <cmath>

namespace juce
{
    // Define the methods declared in wasm_compat.h
    std::atomic<float>* AudioProcessorValueTreeState::getRawParameterValue(const juce::String& id) noexcept
    {
        auto stdStr = id.toStdString();
        return &values[stdStr];
    }

    RangedAudioParameter* AudioProcessorValueTreeState::getParameter(const juce::String& id) noexcept
    {
        auto stdStr = id.toStdString();
        choices[stdStr].value.store(values[stdStr].load());
        return &choices[stdStr];
    }
}

namespace
{
    static std::unique_ptr<ABD::SynthEngine> gSynthEngine;
    static std::unique_ptr<juce::AudioProcessorValueTreeState> gAPVTS;
    static juce::AudioBuffer<float> gAudioBuffer;
    static juce::MidiBuffer gMidiBuffer;
    static double gSampleRate = 44100.0;
    static int gBlockSize = 512;
    static bool gInitialized = false;

    void ensureEngineInitialized()
    {
        if (!gInitialized)
        {
            gSynthEngine = std::make_unique<ABD::SynthEngine>();
            gAPVTS = std::make_unique<juce::AudioProcessorValueTreeState>();

            gSynthEngine->prepare(gSampleRate, gBlockSize);
            gAudioBuffer.setSize(2, gBlockSize);
            gMidiBuffer.clear();
            gInitialized = true;
        }
    }
}

extern "C" {

WASM_EXPORT void wasm_init_engine(double sampleRate, int blockSize)
{
    gSampleRate = sampleRate > 0.0 ? sampleRate : 44100.0;
    gBlockSize = blockSize > 0 ? blockSize : 512;
    gInitialized = false;
    ensureEngineInitialized();
}

WASM_EXPORT void wasm_process_audio(float* outL, float* outR, int numSamples)
{
    ensureEngineInitialized();
    if (!outL || !outR || numSamples <= 0) return;

    if (gAudioBuffer.getNumSamples() < numSamples)
    {
        gAudioBuffer.setSize(2, numSamples, false, false, true);
    }

    gAudioBuffer.clear();
    
    // Sync parameters from APVTS mock to SynthEngine before processing the block
    if (gSynthEngine && gAPVTS)
    {
        gSynthEngine->updateParameters(*gAPVTS);
    }

    gSynthEngine->processBlock(gAudioBuffer, gMidiBuffer);
    gMidiBuffer.clear();

    const float* srcL = gAudioBuffer.getReadPointer(0);
    const float* srcR = gAudioBuffer.getReadPointer(1);

    std::memcpy(outL, srcL, static_cast<size_t>(numSamples) * sizeof(float));
    std::memcpy(outR, srcR, static_cast<size_t>(numSamples) * sizeof(float));
}

WASM_EXPORT void wasm_set_parameter(const char* paramId, float value)
{
    ensureEngineInitialized();
    if (!paramId || !gAPVTS) return;

    // Direct parameter sync via our mock APVTS raw parameter values map
    if (auto* param = gAPVTS->getRawParameterValue(paramId))
    {
        param->store(value);
    }
}

WASM_EXPORT void wasm_note_on(int midiNote, float velocity)
{
    ensureEngineInitialized();
    const uint8_t velByte = static_cast<uint8_t>(juce::jlimit(0, 127, static_cast<int>(velocity * 127.0f)));
    const uint8_t noteByte = static_cast<uint8_t>(juce::jlimit(0, 127, midiNote));
    gMidiBuffer.addEvent(juce::MidiMessage::noteOn(1, noteByte, velByte), 0);
}

WASM_EXPORT void wasm_note_off(int midiNote)
{
    ensureEngineInitialized();
    const uint8_t noteByte = static_cast<uint8_t>(juce::jlimit(0, 127, midiNote));
    gMidiBuffer.addEvent(juce::MidiMessage::noteOff(1, noteByte, 0.0f), 0);
}

WASM_EXPORT void wasm_pitch_bend(float value)
{
    ensureEngineInitialized();
    const int bendVal = juce::jlimit(0, 16383, static_cast<int>((value * 0.5f + 0.5f) * 16383.0f));
    gMidiBuffer.addEvent(juce::MidiMessage::pitchWheel(1, bendVal), 0);
}

WASM_EXPORT void wasm_panic()
{
    if (gSynthEngine)
    {
        gSynthEngine->panic();
    }
}

}
