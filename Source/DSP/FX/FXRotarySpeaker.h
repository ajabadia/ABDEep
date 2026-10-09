#pragma once

#include "FXBase.h"
#include <DspEffects/DspRotarySpeaker.h>

namespace ABD
{
    /**
     * @brief FXRotarySpeaker: Emulación de cabina rotatoria mecánica Leslie 122.
     *
     * HARDWARE EMULADO:
     *   - Cabina rotatoria acústica Leslie 122 / 147 (DeepMind 12 FX Type 16), comúnmente
     *     emparejada con órganos Hammond B3 y sintetizadores analógicos.
     *   - Simulación física electromecánica:
     *     * Crossover acústico a ~800 Hz separando Horn (trompeta de agudos) y Rotor (tambor de graves).
     *     * Dos velocidades conmutables: LoSpeed (0.1 Hz a 4.0 Hz) y HiSpeed (2.0 Hz a 9.9 Hz).
     *     * Balística física inercial de aceleración y desaceleración continua (Accel).
     *     * Control de parada y marcha de motores mecánicos (Motor RUN / STOP).
     *     * Efecto Doppler estéreo por desplazamiento angular de las bocinas.
     *     * Tremolo espacial (modulación de amplitud en antifase de 180° entre L y R).
     *     * Balance acústico entre Horn y Rotor, y distancia microfónica virtual (Distance).
     *
     * DIAGNÓSTICO DE FIDELIDAD ACTUAL:
     *   - Motor subyacente delegado en `abd::dsp::DspRotarySpeaker` (100% RT-Safe, C++20 puro).
     *   - Modulación de retardo fraccional y filtro crossover sin memoria heap.
     *
     * LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *   - Reflexiones tempranas de la cavidad de madera de la cabina de resonancia.
     *   - Distorsión armónica producida por el amplificador a válvulas 6550 de la Leslie 122.
     */
    class FXRotarySpeaker : public FXBase
    {
    public:
        FXRotarySpeaker();
        ~FXRotarySpeaker() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 8; }
        juce::String getEffectName() const override { return "Rotary Speaker"; }

    private:
        abd::dsp::DspRotarySpeaker engine_;
    };
}
