/**
 * @purpose Contratos de fidelidad FX vs hardware DeepMind 12 (docs/deepmind_fx.md).
 *   Revisión de módulos: tipos documentados disponibles (1-35) y contratos de
 *   comportamiento por familia — delay, reverb, distorsión, dinámica, auto-pan.
 * @classification Test
 */

#include <JuceHeader.h>
#include "FXSlot.h"
#include "FXBase.h"
#include "FXDelay.h"
#include "FXSimpleReverb.h"
#include "FXSimpleComp.h"
#include "FXNoiseGate.h"
#include "FXAutoPan.h"
#include "FXWaveShaper.h"
#include <cmath>
#include <algorithm>

namespace ABD
{

namespace
{
    // Goertzel bin power at a single frequency — measures a harmonic's energy.
    static double goertzelPower(const float* data, int n, double freqHz, double sampleRate)
    {
        const double w  = 2.0 * juce::MathConstants<double>::pi * freqHz / sampleRate;
        const double c  = 2.0 * std::cos(w);
        double s1 = 0.0, s2 = 0.0;
        for (int i = 0; i < n; ++i)
        {
            const double s0 = data[i] + c * s1 - s2;
            s2 = s1;
            s1 = s0;
        }
        return s1 * s1 + s2 * s2 - c * s1 * s2;
    }

    static float rmsOf(const float* data, int n)
    {
        double acc = 0.0;
        for (int i = 0; i < n; ++i)
            acc += (double)data[i] * (double)data[i];
        return (float)std::sqrt(acc / (double)std::max(n, 1));
    }

    static float energyOf(const float* data, int n)
    {
        double acc = 0.0;
        for (int i = 0; i < n; ++i)
            acc += std::abs((double)data[i]);
        return (float)acc;
    }

    // Render an input buffer (stereo) through an FXSlot in 256-sample blocks.
    static void renderThroughSlot(FXSlot& slot, const juce::AudioBuffer<float>& in,
                                  juce::AudioBuffer<float>& out, int len)
    {
        juce::AudioBuffer<float> block(2, 256);
        for (int pos = 0; pos < len; pos += 256)
        {
            const int n = std::min(256, len - pos);
            block.clear();
            for (int ch = 0; ch < 2; ++ch)
                for (int s = 0; s < n; ++s)
                    block.setSample(ch, s, in.getSample(ch, pos + s));
            slot.process(block, n);
            for (int ch = 0; ch < 2; ++ch)
                for (int s = 0; s < n; ++s)
                    out.setSample(ch, pos + s, block.getSample(ch, s));
        }
    }

    static void fillSine(juce::AudioBuffer<float>& buf, int len, float amp, double freqHz, double sampleRate)
    {
        for (int s = 0; s < len; ++s)
        {
            const float v = amp * (float)std::sin(6.28318530718 * freqHz * (double)s / sampleRate);
            buf.setSample(0, s, v);
            buf.setSample(1, s, v);
        }
    }
}

class FXFidelityUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;

    FXFidelityUnitTests() : juce::UnitTest("FX Fidelity Contracts (hardware)", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest("Hardware type-ID coverage — every documented DM12 type (1-35) is available");
        {
            // Contrato estructural vs docs/deepmind_fx.md (lista interna "FX Type N"):
            // la factory debe instanciar un efecto para cada tipo documentado del hardware.
            for (int type = 1; type <= 35; ++type)
            {
                FXSlot slot;
                slot.setType(type);
                slot.prepare(kTestSampleRate, 256);
                expect(slot.isActive(), "DM12 hardware FX type " + juce::String(type)
                        + " must instantiate (docs/deepmind_fx.md)");
            }
        }

        //==============================================================================
        beginTest("Hardware param-count coverage — getNumParameters() matches docs for types 1-35");
        {
            // Contrato estructural vs docs/deepmind_fx.md: el número de parámetros que
            // cada efecto interno declara debe coincidir con el nº de filas de su tabla
            // de parámetros en la documentación del hardware (hasta 12 params por tipo).
            const int docCounts[36] = {
                0,  // unused
                12, 12, 12, 10, 10, 9,   // 1-6  reverb
                9,                        // 7    RackAmp
                12, 12, 11, 12, 12,       // 8-12 MoodFilter, Phaser, Chorus, Flanger, ModDelayRev
                12, 12, 12,               // 13-15 Delay, 3Tap, 4Tap
                8,  7,  9,  8,  9,  5,    // 16-21 Rotary, Chorus-D, Enhancer, Edison, AutoPan, TapeDelay
                5,                        // 22   DeepVerb
                12, 12, 12,               // 23-25 flangVerb, chorusVerb, delayVerb
                12, 12, 12,               // 26-28 Chamber, Room, Vintage
                12, 11, 12, 12, 8, 12, 12 // 29-35 dualPitch, MidasEQ, fairComp, mulBndDist, noiseGate, decimDelay, vintgPitch
            };

            for (int type = 1; type <= 35; ++type)
            {
                FXSlot slot;
                slot.setType(type);
                FXBase* effect = slot.getEffect();
                if (effect == nullptr)
                    continue;

                const int actual   = effect->getNumParameters();
                const int expected = docCounts[type];
                expect(actual == expected,
                       "DM12 FX type " + juce::String(type) + " must expose "
                       + juce::String(expected) + " params (docs/deepmind_fx.md), got "
                       + juce::String(actual));
            }
        }

        //==============================================================================
        beginTest("Delay family — impulse is delayed, never feed-through");
        {
            // Contrato: un delay nunca deja pasar la entrada; el impulso solo reaparece
            // transcurrido el tiempo de retardo. (type 13 = Delay, docs/deepmind_fx.md)
            constexpr int kLen = 120000;                 // 2.72 s — cubre delay máx (2 s)
            constexpr int kDelaySamp = 88200;            // 2000 ms @ 44.1 kHz
            constexpr int kBlockSamp = 256;

            juce::AudioBuffer<float> in(2, kLen);
            juce::AudioBuffer<float> out(2, kLen);
            in.clear();
            out.clear();
            in.setSample(0, 0, 1.0f);
            in.setSample(1, 0, 1.0f);

            FXSlot slot;
            slot.setType(13);
            slot.prepare(kTestSampleRate, kBlockSamp);
            slot.setParameter(1, 1.0f);    // time = 2000 ms
            slot.setParameter(2, 0.0f);    // mode = ST (L/R independiente)
            slot.setParameter(9, 0.0f);    // feedL = 0
            slot.setParameter(10, 0.0f);   // feedR = 0
            slot.setMix(1.0f);            // 100% wet — nada de feed-through
            slot.setGain(1.0f);

            renderThroughSlot(slot, in, out, kLen);

            const float before = energyOf(out.getReadPointer(0), kDelaySamp - 2000);
            const float around = energyOf(out.getReadPointer(0) + (kDelaySamp - 2000), 4000);

            expect(before < 1e-4f, "Delay must not feed through before the delay time (before="
                   + juce::String(before, 6) + ")");
            expect(around > 0.5f, "Delay impulse must reappear at the delay time (around="
                   + juce::String(around, 6) + ")");
        }

        //==============================================================================
        beginTest("Reverb family — impulse produces a dense, decaying tail");
        {
            // Contrato: la reverb (type 1 = Hall) no es un delay simple; tras el impulso
            // produce una cola densa y decreciente, no un eco único.
            constexpr int kLen = 200000;                 // ~4.5 s
            constexpr int kBlockSamp = 256;

            juce::AudioBuffer<float> in(2, kLen);
            juce::AudioBuffer<float> out(2, kLen);
            in.clear();
            out.clear();
            in.setSample(0, 0, 1.0f);
            in.setSample(1, 0, 1.0f);

            FXSlot slot;
            slot.setType(1);                              // Hall
            slot.prepare(kTestSampleRate, kBlockSamp);
            slot.setParameter(1, 1.0f);                   // decay largo
            slot.setParameter(0, 0.0f);                   // pre-delay 0
            slot.setParameter(3, 0.3f);                   // damping suave
            slot.setMix(1.0f);
            slot.setGain(1.0f);

            renderThroughSlot(slot, in, out, kLen);

            const float* d = out.getReadPointer(0);
            const float tailEarly = energyOf(d + 10000, 90000);       // 10000..100000
            const float tailLate  = energyOf(d + 100000, 100000);     // 100000..200000
            const float peakAmp   = [&]() {
                float m = 0.0f;
                for (int s = 10000; s < 200000; ++s) m = std::max(m, std::abs(d[s]));
                return m;
            }();

            // Cola larga: energía mucho después del impulso
            expect(tailEarly > 1.0f, "Reverb must sustain a tail after the input (earlyTail="
                   + juce::String(tailEarly, 4) + ")");
            expect(tailLate > 0.05f, "Reverb tail must still be audible at ~2.3 s (lateTail="
                   + juce::String(tailLate, 4) + ")");
            // Decaimiento monótono aproximado
            expect(tailEarly > tailLate, "Reverb tail must decay over time (early="
                   + juce::String(tailEarly, 4) + " late=" + juce::String(tailLate, 4) + ")");
            // Denso: cientos de muestras activas a lo largo de 4.3 s — no es un eco único.
            // (Un delay puro apenas superaría la decena de muestras por encima del pico.)
            const float tailPeak = peakAmp;
            int active = 0;
            for (int s = 10000; s < 200000; ++s)
                if (std::abs(d[s]) > tailPeak * 0.01f) ++active;
            expect(active > 25000, "Reverb tail must be dense, not a single echo (active="
                   + juce::String(active) + " of 190000, peak=" + juce::String(tailPeak, 4) + ")");
            // El pico de cola es menor que el pico del impulso (pasa por combs, no directo)
            expect(peakAmp < 1.5f, "Reverb tail peak must stay bounded (peak="
                   + juce::String(peakAmp, 4) + ")");
        }

        //==============================================================================
        beginTest("Distortion family — sine gains harmonics at high drive");
        {
            // Contrato: un waveshaper (type 51) con drive alto multiplica el contenido
            // armónico total (bins 2f..5f relativo a la fundamental) frente a drive bajo.
            constexpr int kLen = 44100;                  // 1 s
            constexpr int kBlockSamp = 256;
            constexpr double kFundHz = 440.0;

            juce::AudioBuffer<float> in(2, kLen);
            fillSine(in, kLen, 0.5f, kFundHz, kTestSampleRate);

            // Ratio armónico autocontenido: suma de bins (2f..5f) relativo a la fundamental.
            auto renderDistortionRatio = [&](float drive) -> double {
                juce::AudioBuffer<float> out(2, kLen);
                out.clear();
                FXSlot slot;
                slot.setType(51);
                slot.prepare(kTestSampleRate, kBlockSamp);
                slot.setParameter(2, drive);
                slot.setParameter(0, 0.5f);
                slot.setParameter(4, 1.0f);
                slot.setMix(1.0f);
                slot.setGain(1.0f);
                renderThroughSlot(slot, in, out, kLen);
                constexpr int kSteady = 22050;
                const float* w = out.getReadPointer(0) + kSteady;
                const int n = kLen - kSteady;
                const double f1 = goertzelPower(w, n, 440.0, kTestSampleRate);
                const double f2 = goertzelPower(w, n, 880.0, kTestSampleRate);
                const double f3 = goertzelPower(w, n, 1320.0, kTestSampleRate);
                const double f4 = goertzelPower(w, n, 1760.0, kTestSampleRate);
                const double f5 = goertzelPower(w, n, 2200.0, kTestSampleRate);
                logMessage("  drive=" + juce::String(drive, 3)
                           + " f1=" + juce::String(f1, 2)
                           + " f2=" + juce::String(f2, 2)
                           + " f3=" + juce::String(f3, 2)
                           + " f4=" + juce::String(f4, 2)
                           + " f5=" + juce::String(f5, 2));
                return (f2 + f3 + f4 + f5) / f1;
            };

            const double ratioLow  = renderDistortionRatio(0.05f);
            const double ratioHigh = renderDistortionRatio(1.0f);

            expect(ratioHigh > ratioLow * 3.0,
                   "harmonic content must grow with drive (ratioLow=" + juce::String(ratioLow, 6)
                   + " ratioHigh=" + juce::String(ratioHigh, 6) + ")");
        }

        //==============================================================================
        beginTest("Dynamics — compressor applies gain reduction on loud signal");
        {
            // Contrato: un compresor (type 31) en modo Dual reduce el nivel de una señal
            // fuerte cuando el umbral está por debajo de la envolvente.
            constexpr int kLen = 44100;
            constexpr int kBlockSamp = 256;

            juce::AudioBuffer<float> in(2, kLen);
            fillSine(in, kLen, 0.5f, 220.0, kTestSampleRate);

            FXSlot slot;
            slot.setType(31);                              // Fair Comp
            slot.prepare(kTestSampleRate, kBlockSamp);
            slot.setParameter(0, 0.6f);                    // compMode = 2 (Dual)
            slot.setParameter(1, 1.0f);                    // input gain (unit)
            slot.setParameter(2, 0.2f);                    // threshold bajo → comprime
            slot.setParameter(4, 0.5f);                    // ratio ≈ 10.5:1
            slot.setParameter(5, 0.5f);                    // output gain (≈ -6 dB)
            slot.setMix(1.0f);
            slot.setGain(1.0f);

            juce::AudioBuffer<float> out(2, kLen);
            out.clear();
            renderThroughSlot(slot, in, out, kLen);

            const float inRms  = rmsOf(in.getReadPointer(0), kLen);
            const float outRms = rmsOf(out.getReadPointer(0), kLen);

            expect(outRms < inRms * 0.9f,
                   "Compressor must reduce loud-signal level (inRms=" + juce::String(inRms, 5)
                   + " outRms=" + juce::String(outRms, 5) + ")");
            expect(std::isfinite(outRms), "Compressor output must stay finite");
        }

        //==============================================================================
        beginTest("Dynamics — noise gate suppresses signal below threshold");
        {
            constexpr int kLen = 44100;
            constexpr int kBlockSamp = 256;

            juce::AudioBuffer<float> in(2, kLen);
            fillSine(in, kLen, 0.005f, 220.0, kTestSampleRate);   // señal débil (ruido)

            FXSlot slot;
            slot.setType(33);                              // Noise Gate
            slot.prepare(kTestSampleRate, kBlockSamp);
            slot.setParameter(0, 0.6f);                    // threshold ≈ -36 dB → señal pasa por debajo
            slot.setParameter(1, 0.5f);                    // range profundo (-50 dB floor)
            slot.setParameter(2, 0.05f);                   // attack rápido
            slot.setParameter(3, 0.0f);                    // release mín. (2 ms) → cierre completo
            slot.setParameter(7, 0.0f);                    // power = ON (default param 0.5 → OFF)
            slot.setMix(1.0f);
            slot.setGain(1.0f);

            juce::AudioBuffer<float> out(2, kLen);
            out.clear();
            renderThroughSlot(slot, in, out, kLen);

            // Medir la segunda mitad (gate ya cerrado tras attack/release)
            const int half = kLen / 2;
            const float inRms  = rmsOf(in.getReadPointer(0) + half, kLen - half);
            const float outRms = rmsOf(out.getReadPointer(0) + half, kLen - half);

            expect(outRms < inRms * 0.2f,
                   "Noise gate must suppress sub-threshold signal (inRms=" + juce::String(inRms, 6)
                   + " outRms=" + juce::String(outRms, 6) + ")");
        }

        //==============================================================================
        beginTest("Auto Pan — stereo LFO moves energy between L and R");
        {
            // Contrato: con depth y phase estéreo, una entrada mono debe desplazarse
            // entre canales: |L-R| alcanza valores altos, y ambos canales tienen energía.
            constexpr int kLen = 88200;                    // 2 s
            constexpr int kBlockSamp = 256;

            juce::AudioBuffer<float> in(2, kLen);
            fillSine(in, kLen, 0.5f, 220.0, kTestSampleRate);

            FXSlot slot;
            slot.setType(20);                              // Auto Pan
            slot.prepare(kTestSampleRate, kBlockSamp);
            slot.setParameter(0, 1.0f);                    // speed = 5 Hz
            slot.setParameter(1, 0.5f);                    // phase estéreo 90°
            slot.setParameter(2, 0.5f);                    // onda senoidal
            slot.setParameter(3, 1.0f);                    // depth = 100%
            slot.setMix(1.0f);
            slot.setGain(1.0f);

            juce::AudioBuffer<float> out(2, kLen);
            out.clear();
            renderThroughSlot(slot, in, out, kLen);

            const float* l = out.getReadPointer(0);
            const float* r = out.getReadPointer(1);
            const int start = kLen / 2;                    // estado estable
            float maxDiff = 0.0f;
            for (int s = start; s < kLen; ++s)
                maxDiff = std::max(maxDiff, std::abs(l[s] - r[s]));

            const float rmsL = rmsOf(l + start, kLen - start);
            const float rmsR = rmsOf(r + start, kLen - start);

            expect(maxDiff > 0.3f, "Auto Pan must swing energy across channels (max|L-R|="
                   + juce::String(maxDiff, 4) + ")");
            expect(rmsL > 0.05f && rmsR > 0.05f, "Both channels must carry energy (rmsL="
                   + juce::String(rmsL, 4) + " rmsR=" + juce::String(rmsR, 4) + ")");
        }
    }
};

static FXFidelityUnitTests fxFidelityUnitTests;

} // namespace ABD
