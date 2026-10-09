#pragma once

#include "FXBase.h"
#include <DspEffects/DspEdison.h>

namespace ABD
{
    /**
     * @brief FXEdison: Procesador estéreo / imagen / distorsión M/S (Edison EX1).
     *
     * ==============================================================================
     * DOCUMENTACIÓN DE HARDWARE Y FIDELIDAD DSP:
     * ==============================================================================
     * 1. HARDWARE EMULADO:
     *    - Behringer / Klark Teknik Edison EX1 (Psychoacoustic Stereo Image Processor).
     *    - Basado en el efecto DeepMind 12 (type=19).
     *    - Opera indistintamente en dominios Estéreo estándar o Mid/Side (M/S).
     *    - Aplica modulación espacial mediante:
     *      * StSpread: Expansión o colapso mono del canal Side.
     *      * LMFSpread: Crossover low-pass (~300 Hz) sobre el canal Side para
     *        evitar cancelaciones de fase y desparrame en graves, manteniendo el
     *        sub-bass centrado y abriendo los medios-agudos.
     *      * Center Distortion (CntrDist): Saturación armónica suave simétrica (tanh)
     *        aplicada selectivamente al canal central (Mid) para realzar presencia,
     *        calidez y cuerpo sin ensuciar los extremos laterales.
     *      * Balance y Output Gain: Compensación de nivel y paneo L/R post-matriz.
     *
     * 2. DIAGNÓSTICO DE FIDELIDAD:
     *    - Matriz M/S analítica exacta: M = (L+R)/2, S = (L-R)/2.
     *    - Modelo no lineal de centro verificado contra el DSP del DeepMind 12.
     *    - Motor desacoplado y delegado en `abd::dsp::DspEdison` (C++20 puro, 100% RT-Safe).
     *
     * 3. LÍNEAS DE INVESTIGACIÓN PENDIENTES:
     *    - Modelar la curva de respuesta analógica dependiente de frecuencia de los
     *      transformadores de aislamiento del hardware analógico Edison original.
     *    - Añadir modelado de desbalance y correlación de fase dinámica mediante detector RMS.
     * ==============================================================================
     *
     * Parámetros:
     *   0: On        (0=OFF, 1=ON)
     *   1: InMode    (0=ST, 1=M/S)
     *   2: OutMode   (0=ST, 1=M/S)
     *   3: StSpread  (0-1, -50 a +50, ancho estéreo)
     *   4: LMFSpread (0-1, -50 a +50, spread low-mid)
     *   5: Balance   (0-1, -50 a +50, balance L/R)
     *   6: CntrDist  (0-1, -50 a +50, distorsión central)
     *   7: Gain      (0-1, -12dB a +12dB)
     */
    class FXEdison : public FXBase
    {
    public:
        FXEdison();
        ~FXEdison() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 8; }
        juce::String getEffectName() const override { return "Edison EX1"; }

    private:
        abd::dsp::DspEdison engine;
    };
}
