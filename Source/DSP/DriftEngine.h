#pragma once

#include <SynthCore/DriftEngine.h>

namespace ABD
{
    /**
     * @brief Shim de compatibilidad sobre abd::synth::DriftEngine.
     * Mantiene la interfaz y namespace local de ABDEep intactos.
     */
    using DriftEngine = abd::synth::DriftEngine;
}
