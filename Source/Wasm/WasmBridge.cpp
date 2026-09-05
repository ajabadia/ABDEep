#include "WasmBridge.h"
#include "ParameterRegistry.gen.h"

#include <array>
#include <atomic>
#include <cmath>
#include <string_view>

// ============================================================================
// Fase 5 (plan v3.2 §3.2) — Lookup por índice, cero búsquedas dinámicas.
//
// El mock de AudioProcessorValueTreeState ya NO almacena los valores en mapas
// string→value: usa un std::array plano cuyo índice es el enum ParameterIndex
// generado en build-time (ParameterRegistry.gen.h). La resolución id→slot solo
// ocurre en hilo de control (wasm_set_parameter) o bajo cambio de parámetro;
// el hot path (wasm_process_audio) NO resuelve cadenas en estado estable.
// ============================================================================
namespace
{
    // Parámetros internos del motor que SynthEngine::updateParameters lee por id
    // pero que NO forman parte del registro de presets (los 235 del registry).
    // Se les asignan slots fijos justo después del registro para mantener el
    // acceso O(1) por índice. (Ver SynthEngine_Parameters.cpp / FXEngine.cpp.)
    constexpr std::size_t kInternalParamCount = 10;
    constexpr const char* kInternalParamIds[kInternalParamCount] = {
        "global_tune", "global_volume", "hpf_bass_boost_gain", "master_softclip_bypass",
        "master_softclip_headroom", "sub_level", "transpose", "vca_mode",
        "vcf_oversample", "vcf_voicing_mode"
    };

    constexpr std::size_t kValueStoreSize = ABD::Registry::kParameterCount + kInternalParamCount;
    constexpr std::size_t kNoSlot = static_cast<std::size_t>(-1);

    std::array<std::atomic<float>, kValueStoreSize> gValueStore{};
    std::array<juce::AudioParameterChoice, kValueStoreSize> gChoiceStore{};

    // Resuelve id → slot del store (registro primero, luego parámetros internos).
    // Cero asignaciones: compara string_view sobre el UTF-8 de la juce::String.
    std::size_t resolveSlot(const juce::String& id) noexcept
    {
        const char* utf8 = id.toRawUTF8();
        const std::string_view sv(utf8 != nullptr ? utf8 : "");
        if (const auto* entry = ABD::Registry::findParameterById(sv))
            return static_cast<std::size_t>(entry->index);
        for (std::size_t i = 0; i < kInternalParamCount; ++i)
            if (sv == kInternalParamIds[i])
                return ABD::Registry::kParameterCount + i;
        return kNoSlot;
    }
}

namespace juce
{
    // Define the methods declared in wasm_compat.h — storage respaldado por el
    // registro (std::array + ParameterIndex), sin mapas dinámicos (Fase 5 §3.2).
    std::atomic<float>* AudioProcessorValueTreeState::getRawParameterValue(const juce::String& id) noexcept
    {
        const std::size_t slot = resolveSlot(id);
        return (slot != kNoSlot) ? &gValueStore[slot] : nullptr;
    }

    RangedAudioParameter* AudioProcessorValueTreeState::getParameter(const juce::String& id) noexcept
    {
        const std::size_t slot = resolveSlot(id);
        if (slot == kNoSlot)
            return nullptr;

        float rawVal = gValueStore[slot].load(std::memory_order_relaxed);

        if (slot < ABD::Registry::kParameterCount)
        {
            const auto& entry = ABD::Registry::kParameters[slot];
            if (entry.codecType == 2) // Enum
            {
                rawVal = std::round(rawVal * static_cast<float>(entry.enumMax));
            }
        }
        else
        {
            // Internal parameters: desnormalize enums
            if (id == "vcf_oversample")
            {
                rawVal = std::round(rawVal * 2.0f);
            }
            else if (id == "vca_mode")
            {
                rawVal = std::round(rawVal * 1.0f);
            }
        }

        gChoiceStore[slot].value.store(rawVal, std::memory_order_relaxed);
        return &gChoiceStore[slot];
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

    // true cuando un wasm_set_parameter* escribió desde el último bloque: permite
    // saltar updateParameters() (y sus resoluciones id→slot) en estado estable.
    static std::atomic<bool> gParamsDirty{false};

    // ModelCapabilities (Fase 5 §1.1): 0 = dm12_hardware, 1 = abyssmind_pro.
    // El DSP WASM compila con EEP_MODE_ENHANCED/DEEP_TARGET_MODEL=2, así que el
    // modelo por defecto es abyssmind_pro.
    static std::atomic<int> gModelIndex{1};

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

    void resetParameterStore()
    {
        for (auto& v : gValueStore) v.store(0.0f, std::memory_order_release);
        for (auto& c : gChoiceStore) c.value.store(0.0f, std::memory_order_release);
        gParamsDirty.store(false, std::memory_order_release);
    }
}

extern "C" {

WASM_EXPORT void wasm_init_engine(double sampleRate, int blockSize)
{
    gSampleRate = sampleRate > 0.0 ? sampleRate : 44100.0;
    gBlockSize = blockSize > 0 ? blockSize : 512;
    gInitialized = false;
    resetParameterStore();   // reserva fija: estado limpio en cada init
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

    // Sincronizar parámetros SOLO si un wasm_set_parameter* escribió desde el
    // último bloque — cero lookups por string en el hilo de audio en estado
    // estable (Fase 5 §3.2: acceso por índice, no por cadena). El exchange con
    // memory_order_acquire hace happens-before con los stores release de los
    // setters: los valores escritos en hilo de control son visibles aquí.
    if (gSynthEngine && gAPVTS && gParamsDirty.exchange(false, std::memory_order_acquire))
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
    if (!paramId) return;

    // Resolución id→slot en hilo de control (nunca en el audio). El hot path
    // indexado es wasm_set_parameter_index (Fase 5 §3.2).
    const juce::String id(paramId);
    const std::size_t slot = resolveSlot(id);
    if (slot == kNoSlot)
        return;
    gValueStore[slot].store(value, std::memory_order_release);
    gParamsDirty.store(true, std::memory_order_release);
}

WASM_EXPORT void wasm_set_parameter_index(int paramIndex, float value)
{
    ensureEngineInitialized();
    if (paramIndex < 0 || paramIndex >= static_cast<int>(ABD::Registry::kParameterCount))
        return;
    gValueStore[static_cast<std::size_t>(paramIndex)].store(value, std::memory_order_release);
    gParamsDirty.store(true, std::memory_order_release);
}

WASM_EXPORT float wasm_get_parameter_index(int paramIndex)
{
    if (paramIndex < 0 || paramIndex >= static_cast<int>(ABD::Registry::kParameterCount))
        return 0.0f;
    return gValueStore[static_cast<std::size_t>(paramIndex)].load(std::memory_order_relaxed);
}

WASM_EXPORT void wasm_set_model(int model)
{
    gModelIndex.store((model == 0) ? 0 : 1, std::memory_order_relaxed);
}

WASM_EXPORT int wasm_get_model()
{
    return gModelIndex.load(std::memory_order_relaxed);
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
