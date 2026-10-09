#pragma once

#include "FXBase.h"
#include <DspEffects/DspBonsai.h>

namespace ABD
{
    /**
     * @brief FXBonsai: Lo-fi pitch processor with degradation and micro-granulation.
     *
     * ==============================================================================
     * DOCUMENTACIÓN DE HARDWARE Y FIDELIDAD DSP:
     * ==============================================================================
     * 1. HARDWARE EMULADO:
     *    - Procesador lo-fi vintage de cinta y degradación digital
     *      (DeepMind 12 Type 55 / Chase Bliss Generation Loss / Surge Bonsai).
     *    - Transposición tonal por interpolación en anillo (-12 a +12 semitonos).
     *    - Modulación de wow tipo cinta analógica con LFO sinusoidal (0.5 - 3.5 Hz).
     *    - Decimación de tasa de muestreo mediante circuito sample-and-hold.
     *    - Cuantización continua de profundidad de bits (24 bits hasta 3 bits).
     *    - Etapa de saturación no lineal (tanh normalizado) con control Drive.
     *
     * 2. DIAGNÓSTICO DE FIDELIDAD:
     *    - Totalmente desacoplado en el motor puro `abd::dsp::DspBonsai` (C++20, 100% RT-Safe).
     *
     * 3. LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *    - Modelar ruido de cinta analógica (hiss), flutter de alta frecuencia y dropouts aleatorios.
     *    - Añadir filtro de paso de banda RC de pre-énfasis característico de grabadoras de casete.
     * ==============================================================================
     *
     * Parameters:
     *   0: Pitch    (0-1, -12 to +12 semitones)
     *   1: LoFi     (0-1, bit depth reduction + sample rate reduction)
     *   2: Drive    (0-1, saturation amount)
     *   3: Wow      (0-1, pitch modulation depth)
     *   4: Mix      (0-1, dry/wet mix)
     */
    class FXBonsai : public FXBase
    {
    public:
        FXBonsai();
        ~FXBonsai() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 5; }
        juce::String getEffectName() const override { return "Bonsai"; }

    private:
        abd::dsp::DspBonsai engine;
    };
}
