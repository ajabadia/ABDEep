#pragma once
#include "SynthCore/Arpeggiator.h"

// Forward declaration para wrapper de compatibilidad con JUCE
namespace juce
{
    class MidiBuffer;
}

namespace ABD
{
    /**
     * @brief Shim de compatibilidad para el Arpeggiator del DeepMind 12 en ABDEep.
     * Hereda el motor C++20 puro de abd::synth::Arpeggiator y provee la sobrecarga
     * de conveniencia para consumidores de JUCE (SynthEngine y suites de prueba).
     */
    class Arpeggiator : public abd::synth::Arpeggiator
    {
    public:
        using abd::synth::Arpeggiator::Arpeggiator;

        // Evita el name hiding en C++: expone la plantilla base junto a la sobrecarga JUCE
        using abd::synth::Arpeggiator::generate;

        /** Escribe en out los note-on y note-off de este bloque (adaptador JUCE). */
        void generate(juce::MidiBuffer& out, int numSamples);
    };

    // Alias de conveniencia a nivel de namespace para compatibilidad hacia atrás
    using NoteEvent = Arpeggiator::NoteEvent;
    using FastRng   = Arpeggiator::FastRng;
}
