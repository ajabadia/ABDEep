#pragma once
#include "SynthCore/ControlSequencer.h"

namespace ABD
{
    /**
     * @brief Shim de compatibilidad para el ControlSequencer en ABDEep.
     * Hereda el motor canónico C++20 de abd::synth::ControlSequencer.
     */
    class ControlSequencer : public abd::synth::ControlSequencer
    {
    public:
        using abd::synth::ControlSequencer::ControlSequencer;
    };
}
