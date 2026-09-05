#pragma once

#include <algorithm>
#include <cstdint>

#include "ParameterRegistry.gen.h"

namespace ABD
{
namespace PatchByteCodec
{

/**
 * Convierte un byte físico del preset DM12 (0-255) al valor normalizado 0-1
 * que espera el parámetro APVTS. Réplica exacta de registry.gen.js:29-35
 * (rawToNormalized): bipolar → ((raw-128)/127+1)/2 saturado; enum → raw/enumMax;
 * value → raw/255. Los offsets sin entrada en el registro caen a raw/255.
 */
inline float rawToNormalized (std::uint16_t byteOffset, std::uint8_t raw) noexcept
{
    const auto* p = Registry::findParameterByOffset (byteOffset);
    if (p == nullptr)
        return static_cast<float> (raw) / 255.0f;

    switch (p->codecType)
    {
        case 1: // bipolar
        {
            const float v = ((static_cast<float> (raw) - 128.0f) / 127.0f + 1.0f) / 2.0f;
            return std::clamp (v, 0.0f, 1.0f);
        }
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
