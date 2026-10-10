#pragma once
#include "SynthCore/LfoAnalog.h"

namespace ABD
{
    /**
     * @brief Shim de compatibilidad para el LFO en ABDEep.
     * Hereda el motor canónico C++20 de abd::synth::LfoAnalog.
     */
    class LFO : public abd::synth::LfoAnalog
    {
    public:
        using abd::synth::LfoAnalog::LfoAnalog;
        using Shape = abd::synth::LfoAnalog::Shape;
    };
}
