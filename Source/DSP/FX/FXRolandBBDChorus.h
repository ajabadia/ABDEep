#pragma once

#include "FXBase.h"

namespace ABD
{
    /**
     * FXRolandBBDChorus: Chorus estéreo estilo Roland Juno-106 BBD.
     *
     * Basado en el modelo KR106Chorus adaptado con:
     *   - Líneas BBD con interpolación Hermite de 4 puntos
     *   - LFO triangular (modos I/II) y seno (modo I+II)
     *   - Inyección de ruido BBD (charge-transfer efficiency)
     *   - Fase antiphase L/R sobre líneas BBD duales
     *   - 3 modos: I (0.5Hz, ±2.13ms), II (0.84Hz, ±1.71ms), I+II (7.85Hz, ±0.24ms)
     *
     * Simplificado de KR106Chorus: sin ClickRing, sin BBDClick, sin clock-rate gain modulation.
     *
     * Parámetros:
     *   0: Mode      (0-0.99 → 0=Off, 1=I, 2=II, 3=I+II)
     *   1: Rate      (0-1, escala por modo)
     *   2: Depth     (0-1, escala por modo)
     *   3: BBD Noise (0-1, amplitud del ruido inyectado)
     */
    class FXRolandBBDChorus : public FXBase
    {
    public:
        FXRolandBBDChorus();
        ~FXRolandBBDChorus() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 4; }
        juce::String getEffectName() const override { return "Roland BBD Chorus"; }

    private:
        double sampleRate = 44100.0;

        // Parámetros
        float paramMode = 0.0f;       // 0-0.99 → mode 0-3
        float paramRate = 0.3f;       // 0-1
        float paramDepth = 0.5f;      // 0-1
        float paramBBDNoise = 0.3f;   // 0-1

        // Estado del modo
        int currentMode = 0;
        int pendingMode = 0;
        float fade = 0.0f;
        float fadeTarget = 0.0f;
        float fadeInc = 0.0f;
        float useSineLFO = false;

        // Parámetros suavizados por modo
        float targetDepthMs = 0.0f;
        float smoothDepthMs = 0.0f;

        // LFO
        float lfoPhase = 0.0f;
        float lfoInc = 0.0f;

        // Constantes por modo (calibradas de hardware KR106)
        static constexpr float kCenterDelayMs = 3.30f;
        static constexpr float kMinDelayMs = 0.1f;
        static constexpr float kFadeMs = 5.0f;

        // Modo I: ~0.514 Hz, ±2.13 ms
        static constexpr float kModeIRate = 0.514f;
        static constexpr float kModeIDepthMs = 2.13f;
        // Modo II: ~0.842 Hz, ±1.71 ms
        static constexpr float kModeIIRate = 0.842f;
        static constexpr float kModeIIDepthMs = 1.71f;
        // Modo I+II: ~7.85 Hz, ±0.236 ms
        static constexpr float kModeI_IIRate = 7.85f;
        static constexpr float kModeI_IIDepthMs = 0.236f;

        // Per-BBD clock trim (±1.5% → diferencia entre líneas)
        static constexpr float kBBDClockTrim = 0.015f;

        // Ganancias dry/wet del mixer IC6
        static constexpr float kDryGain = 0.863f;
        static constexpr float kWetGain = 1.257f;

        // BBD noise
        uint32_t noiseSeed = 0xDEADBEEFu;
        float noiseHPState = 0.0f;
        float noiseHPCoeff = 0.0f;
        float noiseLPState = 0.0f;
        float noiseLPCoeff = 0.0f;

        // BBD delay lines (power-of-two ring buffers con Hermite)
        std::vector<float> bbdBuf0;
        std::vector<float> bbdBuf1;
        int bbdMask0 = 0;
        int bbdMask1 = 0;
        int bbdWPos0 = 0;
        int bbdWPos1 = 0;

        void configureMode();
        float lfoTriangle();
        float lfoSine();
        float noiseGenerate();
        static float hermite(float frac, float y0, float y1, float y2, float y3);
        float readHermite(const std::vector<float>& buf, int mask, int wPos, float delaySamples) const;
        void processBBD(std::vector<float>& buf, int& mask, int& wPos,
                        float input, float delaySamples, float injectedNoise);
    };
}
