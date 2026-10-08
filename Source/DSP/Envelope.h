#pragma once
#include "SynthCore/EnvelopeAnalog.h"

namespace ABD
{
    /**
     * @brief Shim de compatibilidad para Envelope en ABDEep.
     * Hereda el motor canónico C++20 de abd::synth::EnvelopeAnalog.
     */
    class Envelope : public abd::synth::EnvelopeAnalog
    {
    public:
        using abd::synth::EnvelopeAnalog::EnvelopeAnalog;
        using Stage = abd::synth::EnvelopeAnalog::Stage;
    };
}
