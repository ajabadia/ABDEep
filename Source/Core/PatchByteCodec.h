#pragma once

#include <algorithm>
#include <cstdint>

#include <JuceHeader.h>

#include "ParameterRegistry.gen.h"

namespace ABD
{
namespace PatchByteCodec
{

/**
 * Convierte un byte físico del preset DM12 (0-255) al valor normalizado 0-1
 * que espera el parámetro APVTS. Réplica exacta de registry.gen.js:29-35
 * (rawToNormalized): bipolar → Fórmula C por tramos (raw < 128 ? (raw/128)*0.5 : 0.5+((raw-128)/127)*0.5);
 * enum → raw/enumMax; value → raw/255. Los offsets sin entrada en el registro caen a raw/255.
 */
inline float rawToNormalized (std::uint16_t byteOffset, std::uint8_t raw) noexcept
{
    const auto* p = Registry::findParameterByOffset (byteOffset);
    if (p == nullptr)
        return static_cast<float> (raw) / 255.0f;

    switch (p->codecType)
    {
        case 1: // bipolar (Fórmula C por tramos / piecewise)
            if (raw < 128)
                return (static_cast<float> (raw) / 128.0f) * 0.5f;
            return 0.5f + ((static_cast<float> (raw) - 128.0f) / 127.0f) * 0.5f;
        case 2: // enum
            if (p->enumMax > 0)
                return std::min (1.0f, static_cast<float> (raw) / static_cast<float> (p->enumMax));
            return static_cast<float> (raw) / 255.0f;
        default: // value
            return static_cast<float> (raw) / 255.0f;
    }
}

} // namespace PatchByteCodec
} // namespace ABD

namespace ABD
{
namespace PatchByteCodec
{

/**
 * Escribe un patch DM12 completo (242 bytes) en la APVTS: recorre el registro
 * de parámetros, convierte cada byte físico a normalizado con rawToNormalized()
 * y lo mete en el parámetro homónimo vía getRawParameterValue().
 *
 * No toca el host (sin setValueNotifyingHost): el caller re-sincroniza el
 * motor con SynthEngine::updateParameters(), que es quien lee los raw values.
 * Devuelve el número de parámetros escritos (0 si el registro no coincide
 * con el árbol, p. ej. layout distinto).
 */
inline int applyToApvts (const std::uint8_t* patch242,
                         juce::AudioProcessorValueTreeState& apvts)
{
    jassert (patch242 != nullptr);
    if (patch242 == nullptr)
        return 0;

    int escritos = 0;
    for (const auto& p : Registry::kParameters)
    {
        if (p.byteOffset >= Registry::kByteMapSize)
            continue;

        const float normalizado = rawToNormalized (p.byteOffset, patch242[p.byteOffset]);
        if (auto* raw = apvts.getRawParameterValue (p.id))
        {
            raw->store (normalizado, std::memory_order_relaxed);
            ++escritos;
        }
    }
    return escritos;
}

} // namespace PatchByteCodec
} // namespace ABD
