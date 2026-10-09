#pragma once

#include "FXBase.h"
#include <DspEffects/DspAnalogTapeDelay.h>

namespace ABD
{
    /**
     * @brief FXAnalogTapeDelay: Retardo de cinta analógica vintage con saturación y wow/flutter.
     *
     * HARDWARE EMULADO:
     *   - Eco de cinta analógico vintage de bobina abierta (DeepMind 12 FX Type 40),
     *     inspirado en el Roland RE-201 Space Echo y el Watkins Copicat.
     *   - Parámetros:
     *     * Mix: Balance Dry/Wet (0 a 100%).
     *     * Time: Tiempo de retardo variable de 50 ms a 1200 ms.
     *     * Feedback: Regeneración de repeticiones (0 a 95%).
     *     * Wobble: Inestabilidad mecánica y arrastre de motor (wow & flutter).
     *     * Saturation: Saturación no lineal suave de la cinta magnética.
     *     * Tone: Amortiguación de agudos en las repeticiones (800 Hz a 18 kHz).
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor delegado en `abd::dsp::DspAnalogTapeDelay` (100% RT-Safe, C++20 puro).
     *   - Búfer circular estático de 65536 muestras con bitmasking rápido, cero heap.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Emulación de desgaste mecánico de cinta por fricción continua.
     */
    class FXAnalogTapeDelay : public FXBase
    {
    public:
        FXAnalogTapeDelay();
        ~FXAnalogTapeDelay() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 6; }
        juce::String getEffectName() const override { return "Analog Tape Delay"; }

    private:
        abd::dsp::DspAnalogTapeDelay engine_;
    };
}
