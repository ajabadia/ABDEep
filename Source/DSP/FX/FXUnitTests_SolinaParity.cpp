/**
 * @purpose Paridad del Solina: el DualLFO commiteado y el modo Standard frente a lo que habia antes.
 * @classification Test
 *
 * =============================================================================
 * QUE ES ESTE FICHERO
 * =============================================================================
 *
 * `FXSolinaEnsemble` ya no tiene motor propio: el audio sale de
 * `abd::dsp::DspSolinaEnsemble` (ABDSharedCode/DspEffects), que tiene DOS modos.
 * Este test vigila los dos, y con dos reglas distintas porque los dos casos son
 * distintos:
 *
 *  - EL DUALLFO ES TRABAJO NUEVO, commiteado en 59c501e. Su sonido acaba de
 *    entrar y hay que fijarlo: `FrozenSolinaDualLFO`, mas abajo, es una copia
 *    LITERAL de esa rama y la comparacion es de CERO ULPS, muestra a muestra,
 *    canal por canal, en once ajustes. Si alguien toca la rama DualLFO del
 *    motor compartido, este test lo dice con el numero de muestra.
 *
 *  - EL MODO STANDARD SUSTITUYO al motor propio de ABDEep, y ahi el sonido NO
 *    tenia que cambiar: medido, no cambia (peor caso 1.587e-05, y la diferencia
 *    de nivel es 0.000 dB en los once ajustes). Ese residuo NO es ruido ni
 *    imprecision: es `sinf` de la CRT sustituido por `abd::dsp::sin`, que es un
 *    polinomio de Taylor propio y determinista. `FrozenSolinaEnsemble` es el
 *    motor que estaba en ABDEep antes del cambio, y el margen de abajo sale de
 *    medir las dos maquinas, no de lo que hiciera falta para que pasara.
 *
 * Por eso vive AQUI y no en ABDSharedCode: el modulo compartido no tiene el
 * efecto original a mano, y sin el no puede prometer nada contra lo de antes.
 * Es el mismo reparto que `FXUnitTests_ReverbParity.cpp` y
 * `FXUnitTests_BbdChorus.cpp`.
 *
 * =============================================================================
 * LAS PREGUNTAS Y POR QUE CADA UNA ESTA
 * =============================================================================
 *
 *  1. El DualLFO commiteado suena igual que su copia congelada. 0 ULPS.
 *  2. En DualLFO, rate y depth mueven el sonido (medido: 6.9e-01 y 5.7e-01).
 *  3. En DualLFO, feedback, spread y mix NO mueven nada, y es a proposito:
 *     la rama DualLFO no los lee. Medido: 0.000e+00 exacto. El test lo fija
 *     como esta el codigo commiteado hoy; si alguien los cablea, este test
 *     falla y hay que declarar el cambio aqui.
 *  4. El DualLFO suena distinto del Standard, en los once ajustes. Medido:
 *     el menor de todos es 0.2286, o sea que el selector de modo no esta muerto.
 *  5. El nivel del DualLFO sigue donde lo dejo la medicion: -14.29 dBFS, pico
 *     0.6008, correlacion L/R +0.996. ESTA es la capa que protege contra "las
 *     dos copias se rompen a la vez", incluido un cambio en `abd::dsp::sin`:
 *     por eso lleva tolerancia y no un hash de bits crudos.
 *  6. El DualLFO no deja ni NaN ni residuo en silencio. Medido: exactamente 0.
 *  7. El modo Standard suena igual que el motor viejo. Margen medido: nivel
 *     0.01 dB, muestra 2.0e-05.
 *  8. Los cinco mandos del Standard mueven de verdad. Medido: el mas flojo es
 *     feedback, con 4.9e-02.
 *  9. El tamano de bloque no cambia el audio. Medido: 0.000e+00 en los tres.
 * 10. `reset()`: el motor nuevo vuelve a fabrica Y recalcula el LFO; el viejo
 *     se quedaba con el `lfoInc` del ultimo mando (medido: 1.786e-01 de
 *     diferencia). El viejo lo era, el nuevo no: el test lo declara.
 *
 * =============================================================================
 * POR QUE NO LLEVA HASH CONGELADO DE BITS CRUDOS, A DIFERENCIA DE REVERBPARITY
 * =============================================================================
 *
 * ReverbParity congela ademas un hash FNV-1a por variante. Aqui no, y es una
 * decision, no un olvido: ese hash se mide con el mismo compilador que corre en
 * CI, y este fichero se ha medido con MSVC 14.51 (VS 18) mientras que CI corre
 * windows-2022 con VS 2022. Un hash de bits crudos congelado con un compilador
 * distinto del de CI deja el CI rojo por un motivo que no es de DSP y que quien
 * lo vea no puede reproducir. Lo que si protege contra "las dos copias se rompen
 * juntas" aqui son las CIFRAS de la pregunta 5: nivel, pico y correlacion, que
 * son estadisticas robustas a un cambio de codegen. Si se quiere el hash, se
 * mide desde un runner de CI y se pega aqui.
 *
 * =============================================================================
 * LO QUE ESTA CONGELADO A PROPOSITO Y NO ES UN FALLO
 * =============================================================================
 *
 *  - En DualLFO, feedback, spread y mix no hacen nada (pregunta 3). La rama
 *    ignora los tres mandos: es el motor commiteado.
 *  - El envoltorio de producto, `FXSolinaEnsemble`, NUNCA llama a `setMode`,
 *    asi que hoy el DualLFO no es alcanzable desde el producto: siempre corre
 *    en Standard. Este test fija el trabajo del motor para que el dia que se
 *    cable el modo, lo que se cable ya este medido.
 *  - `abd::dsp::sin` se usa en la copia congelada igual que en el motor. No se
 *    cambia por `sinf`: la primitiva de seno tiene sus propias pruebas bit a bit
 *    en DspCore, lo que aqui se congela es la logica del Solina, no el seno.
 *  - El motor viejo (`FrozenSolinaEnsemble`) tenia un `reset()` que no
 *    recalculaba `lfoInc`, asi que tras resetear el LFO seguia yendo al ultimo
 *    rate que se hubiera puesto. Se reproduce tal cual: es la verdad de antes.
 */

#include <JuceHeader.h>

#include "FXSolinaEnsemble.h"
#include "DspEffects/DspSolinaEnsemble.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <vector>

namespace ABD
{

namespace
{
    constexpr double kSampleRate = 48000.0;
    constexpr int    kBlock      = 4096;
}

//==============================================================================
/** El `jlimit` de JUCE, que la referencia vieja necesita y el producto ya no. */
static inline float refJLimit (float lo, float hi, float v) noexcept
{
    return v < lo ? lo : (v > hi ? hi : v);
}

/**
    COPIA LITERAL del motor que estaba en `FXSolinaEnsemble.{h,cpp}` antes de
    pasarlo al motor compartido. Sin JUCE, como toda referencia congelada: lo
    que se compara no puede depender del codigo bajo prueba.

    Lo unico que cambia respecto al original es `juce::jlimit` por `refJLimit`
    y el nombre de la clase, para no chocar con el envoltorio vivo. Ni el
    algoritmo, ni el orden de las operaciones, ni las constantes, ni el
    `reset()` que no recalcula `lfoInc`.
*/
class FrozenSolinaEnsemble
{
public:
    FrozenSolinaEnsemble() { reset(); }

    void prepare (double sr, int)
    {
        sampleRate = sr;

        // Buffer: ~20ms per tap (kBaseDelayMs + kMaxModMs + margin)
        int bufLen = (int) (sampleRate * 0.025);
        // Round up to power of two
        int pow2 = 1;
        while (pow2 < bufLen)
            pow2 <<= 1;
        delayMask = pow2 - 1;

        for (int t = 0; t < kNumTaps; ++t)
        {
            delayBufL[t].assign (pow2, 0.0f);
            delayBufR[t].assign (pow2, 0.0f);
        }
        delayWPos = 0;

        float rateHz = 0.2f + 7.8f * paramRate;
        lfoInc = (float) (2.0 * 3.14159265 * rateHz / sampleRate);

        feedbackL = 0.0f;
        feedbackR = 0.0f;

        for (int t = 0; t < kNumTaps; ++t)
            lfoPhase[t] = kPhaseOffsets[t];
    }

    void reset()
    {
        paramRate = 0.4f;
        paramDepth = 0.5f;
        paramFeedback = 0.3f;
        paramSpread = 0.6f;
        paramMix = 0.5f;

        for (int t = 0; t < kNumTaps; ++t)
        {
            if (! delayBufL[t].empty())
                std::fill (delayBufL[t].begin(), delayBufL[t].end(), 0.0f);
            if (! delayBufR[t].empty())
                std::fill (delayBufR[t].begin(), delayBufR[t].end(), 0.0f);
            lfoPhase[t] = kPhaseOffsets[t];
        }
        delayWPos = 0;
        feedbackL = 0.0f;
        feedbackR = 0.0f;
    }

    void setParameter (int index, float value)
    {
        float clamped = refJLimit (0.0f, 1.0f, value);
        switch (index)
        {
            case 0:
                paramRate = clamped;
                lfoInc = (float) (2.0 * 3.14159265 * (0.2 + 7.8 * clamped) / sampleRate);
                break;
            case 1: paramDepth = clamped; break;
            case 2: paramFeedback = clamped * 0.85f; break;
            case 3: paramSpread = clamped; break;
            case 4: paramMix = clamped; break;
            default: break;
        }
    }

    void process (const float* inL, const float* inR,
                  float* outL, float* outR,
                  int numSamples)
    {
        // Spread: maps 0-1 to stereo offset in degrees
        // 0 = all taps centered, 1 = taps spread 180 deg apart
        float spreadAngle = paramSpread * 3.14159265f;

        // Depth: 0-1 -> 0 - kMaxModMs
        float depthMs = paramDepth * kMaxModMs;
        float baseDelaySamples = kBaseDelayMs * 0.001f * (float) sampleRate;
        float maxModSamples = depthMs * 0.001f * (float) sampleRate;

        // Tap gains: equal power sum -> normalize
        // tap0=0.5, tap1=0.5, tap2=0.5 (sum ~ 1.5, normalize later)
        float tapGains[3] = { 0.55f, 0.55f, 0.55f };

        for (int s = 0; s < numSamples; ++s)
        {
            float dryL = inL[s];
            float dryR = inR[s];

            // Advance LFO phases (each tap has 120 deg offset)
            for (int t = 0; t < kNumTaps; ++t)
            {
                lfoPhase[t] += lfoInc;
                if (lfoPhase[t] > 2.0f * 3.14159265f)
                    lfoPhase[t] -= 2.0f * 3.14159265f;
            }

            // Sum 3 modulated taps for left and right
            float sumL = 0.0f;
            float sumR = 0.0f;

            for (int t = 0; t < kNumTaps; ++t)
            {
                float mod = sinf (lfoPhase[t]);
                float delaySamples = baseDelaySamples + mod * maxModSamples;
                if (delaySamples < 1.0f)
                    delaySamples = 1.0f;

                // Spread offsets L/R read positions
                float spreadOffsetL = spreadAngle * (float) (t - 1) * 0.3f;
                float spreadOffsetR = -spreadOffsetL;

                float delayedL = readDelay (delayBufL[t], delaySamples - spreadOffsetL * maxModSamples * 0.3f);
                float delayedR = readDelay (delayBufR[t], delaySamples + spreadOffsetR * maxModSamples * 0.3f);

                sumL += delayedL * tapGains[t];
                sumR += delayedR * tapGains[t];
            }

            // Normalize 3-tap sum
            float normFactor = 1.0f / (float) kNumTaps;
            sumL *= normFactor;
            sumR *= normFactor;

            // Input with feedback
            float inputL = dryL + feedbackL * paramFeedback;
            float inputR = dryR + feedbackR * paramFeedback;

            // Write to all 3 delay buffers (same input, different modulation reads)
            for (int t = 0; t < kNumTaps; ++t)
            {
                delayBufL[t][delayWPos] = inputL;
                delayBufR[t][delayWPos] = inputR;
            }
            delayWPos = (delayWPos + 1) & delayMask;

            // Update feedback
            feedbackL = sumL;
            feedbackR = sumR;

            // Mix dry/wet
            float wetL = sumL;
            float wetR = sumR;
            outL[s] = dryL * (1.0f - paramMix) + wetL * paramMix;
            outR[s] = dryR * (1.0f - paramMix) + wetR * paramMix;
        }
    }

private:
    static constexpr int   kNumTaps     = 3;
    static constexpr float kBaseDelayMs = 8.0f;
    static constexpr float kMaxModMs    = 5.0f;
    static constexpr float kPhaseOffsets[3] = { 0.0f, 2.0943951f, 4.1887902f };

    double sampleRate = 44100.0;

    float paramRate = 0.4f;
    float paramDepth = 0.5f;
    float paramFeedback = 0.3f;
    float paramSpread = 0.6f;
    float paramMix = 0.5f;

    std::vector<float> delayBufL[3];
    std::vector<float> delayBufR[3];
    int delayMask = 0;
    int delayWPos = 0;

    float feedbackL = 0.0f;
    float feedbackR = 0.0f;

    float lfoPhase[3] = { 0.0f, 0.0f, 0.0f };
    float lfoInc = 0.0f;

    static float hermite (float frac, float y0, float y1, float y2, float y3)
    {
        float c0 = y1;
        float c1 = 0.5f * (y2 - y0);
        float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
        float c3 = 0.5f * (y3 - y0) + 1.5f * (y1 - y2);
        return ((c3 * frac + c2) * frac + c1) * frac + c0;
    }

    float readDelay (const std::vector<float>& buf, float delaySamples) const
    {
        float readPos = (float) delayWPos - delaySamples;
        if (readPos < 0.0f)
            readPos += (float) (delayMask + 1);
        int i0 = (int) readPos;
        float frac = readPos - (float) i0;
        i0 &= delayMask;
        int i1 = (i0 + 1) & delayMask;
        int i2 = (i1 + 1) & delayMask;
        int i3 = (i2 + 1) & delayMask;
        return hermite (frac, buf[i0], buf[i1], buf[i2], buf[i3]);
    }
};

/**
    COPIA LITERAL de la rama DualLFO de `abd::dsp::DspSolinaEnsemble`, tal y
    como quedo commiteada en ABDSharedCode (59c501e). Reusa `abd::dsp::sin`,
    igual que el motor: el seno tiene sus propias pruebas bit a bit en DspCore,
    y lo que se congela aqui es la logica del Solina, no la primitiva.
*/
class FrozenSolinaDualLFO
{
public:
    static constexpr int kBufferSize = 8192;
    static constexpr int kBufferMask = kBufferSize - 1;

    void prepare (double sr) noexcept
    {
        sampleRate_ = (sr > 1000.0) ? sr : 44100.0;
        updateLFOIncrement();
        reset();
    }

    void reset() noexcept
    {
        paramRate_ = 0.4f;
        paramDepth_ = 0.5f;

        delayBufL_.fill (0.0f);
        delayBufR_.fill (0.0f);

        phaseSlow_ = 0.0f;
        phaseFast_ = 0.0f;
        delayWPos_ = 0;

        updateLFOIncrement();
    }

    void setRateNorm (float rateNorm) noexcept
    {
        paramRate_ = std::clamp (rateNorm, 0.0f, 1.0f);
        updateLFOIncrement();
    }

    void setDepthNorm (float depthNorm) noexcept
    {
        paramDepth_ = std::clamp (depthNorm, 0.0f, 1.0f);
    }

    inline void processSample (float& left, float& right) noexcept
    {
        const float dryL = left;
        const float dryR = right;

        constexpr float kPhase120 = 2.0943951f;
        constexpr float kPhase240 = 4.1887902f;

        phaseSlow_ += incSlow_;
        if (phaseSlow_ >= 6.2831853f) phaseSlow_ -= 6.2831853f;

        phaseFast_ += incFast_;
        if (phaseFast_ >= 6.2831853f) phaseFast_ -= 6.2831853f;

        const float mod1 = abd::dsp::sin (phaseSlow_) * 0.8f + abd::dsp::sin (phaseFast_) * 0.2f;
        const float mod2 = abd::dsp::sin (phaseSlow_ + kPhase120) * 0.8f + abd::dsp::sin (phaseFast_ + kPhase120) * 0.2f;
        const float mod3 = abd::dsp::sin (phaseSlow_ + kPhase240) * 0.8f + abd::dsp::sin (phaseFast_ + kPhase240) * 0.2f;

        const float baseDelaySamples = 0.015f * static_cast<float> (sampleRate_);
        const float modDepthSamples = 0.004f * static_cast<float> (sampleRate_) * paramDepth_;

        const float d1 = baseDelaySamples + (mod1 * modDepthSamples);
        const float d2 = baseDelaySamples + (mod2 * modDepthSamples);
        const float d3 = baseDelaySamples + (mod3 * modDepthSamples);

        // Escritura en buffer circular estatico
        delayBufL_[delayWPos_] = dryL;
        delayBufR_[delayWPos_] = dryR;

        // Lectura con interpolacion cubica Hermite de 4 puntos
        const float sL1 = readDelay (delayBufL_, d1);
        const float sL2 = readDelay (delayBufL_, d2);
        const float sL3 = readDelay (delayBufL_, d3);

        const float sR1 = readDelay (delayBufR_, d1);
        const float sR2 = readDelay (delayBufR_, d2);
        const float sR3 = readDelay (delayBufR_, d3);

        delayWPos_ = (delayWPos_ + 1) & kBufferMask;

        // Matriz estereo asimetrica contrafase (maxima apertura espacial)
        left  = 0.5f * dryL + 0.5f * (sL1 + sR2 - sL3);
        right = 0.5f * dryR + 0.5f * (sR1 + sL2 - sR3);
    }

    void process (const float* inL, const float* inR,
                  float* outL, float* outR,
                  int numSamples) noexcept
    {
        for (int s = 0; s < numSamples; ++s)
        {
            float l = inL[s];
            float r = inR[s];
            processSample (l, r);
            outL[s] = l;
            outR[s] = r;
        }
    }

private:
    void updateLFOIncrement() noexcept
    {
        // Dual LFO: slow nominal 0.5Hz, fast nominal 6.0Hz
        // Se escala ligeramente segun paramRate_ manteniendo la relacion 1:12
        const float rateScale = 0.5f + paramRate_; // 0.5x .. 1.5x
        const float slowHz = 0.5f * rateScale;
        const float fastHz = 6.0f * rateScale;
        incSlow_ = static_cast<float> (6.2831853f * slowHz / sampleRate_);
        incFast_ = static_cast<float> (6.2831853f * fastHz / sampleRate_);
    }

    static inline float hermite (float frac, float y0, float y1, float y2, float y3) noexcept
    {
        const float c0 = y1;
        const float c1 = 0.5f * (y2 - y0);
        const float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
        const float c3 = 0.5f * (y3 - y0) + 1.5f * (y1 - y2);
        return ((c3 * frac + c2) * frac + c1) * frac + c0;
    }

    inline float readDelay (const std::array<float, kBufferSize>& buf, float delaySamples) const noexcept
    {
        float readPos = static_cast<float> (delayWPos_) - delaySamples;
        if (readPos < 0.0f)
            readPos += static_cast<float> (kBufferSize);

        const int i0 = static_cast<int> (readPos) & kBufferMask;
        const float frac = readPos - static_cast<float> (static_cast<int> (readPos));
        const int i1 = (i0 + 1) & kBufferMask;
        const int i2 = (i0 + 2) & kBufferMask;
        const int i3 = (i0 + 3) & kBufferMask;

        return hermite (frac, buf[i0], buf[i1], buf[i2], buf[i3]);
    }

    double sampleRate_ = 44100.0;
    float paramRate_ = 0.4f;
    float paramDepth_ = 0.5f;

    std::array<float, kBufferSize> delayBufL_{};
    std::array<float, kBufferSize> delayBufR_{};
    int delayWPos_ = 0;

    float phaseSlow_ = 0.0f;
    float phaseFast_ = 0.0f;
    float incSlow_ = 0.0f;
    float incFast_ = 0.0f;
};

//==============================================================================
/** Utilidades de medicion. No son asserts: son las cifras que se imprimen. */
namespace
{
    struct Stereo { std::vector<float> l, r; };

    /** Dos senos a -12 dBFS, que es donde se decide el nivel de un efecto. */
    Stereo senalMusical()
    {
        Stereo s;
        s.l.resize (kBlock);
        s.r.resize (kBlock);
        for (int i = 0; i < kBlock; ++i)
        {
            const float t = (float) i / (float) kSampleRate;
            const float v = (float) (0.25 * (std::sin (2.0 * 3.14159265 * 220.0 * t)
                                            + 0.5 * std::sin (2.0 * 3.14159265 * 440.0 * t)));
            s.l[i] = v;
            s.r[i] = v * 0.9f;
        }
        return s;
    }

    Stereo silencio()
    {
        Stereo s;
        s.l.assign (kBlock, 0.0f);
        s.r.assign (kBlock, 0.0f);
        return s;
    }

    struct Cifras
    {
        double rms = 0.0, pico = 0.0, correlacion = 0.0;
    };

    static Cifras medir (const Stereo& x)
    {
        double sl = 0.0, sr = 0.0, sxy = 0.0, pico = 0.0;
        for (size_t i = 0; i < x.l.size(); ++i)
        {
            sl += (double) x.l[i] * x.l[i];
            sr += (double) x.r[i] * x.r[i];
            sxy += (double) x.l[i] * x.r[i];
            pico = std::max (pico, (double) std::max (std::abs (x.l[i]), std::abs (x.r[i])));
        }
        Cifras c;
        c.rms = std::sqrt (0.5 * (sl + sr) / (double) x.l.size());
        c.pico = pico;
        c.correlacion = (sl > 0.0 && sr > 0.0) ? sxy / std::sqrt (sl * sr) : 0.0;
        return c;
    }

    template <typename T>
    static Stereo render (T& fx, const Stereo& in, int bloques)
    {
        Stereo out;
        out.l.resize ((size_t) bloques * kBlock);
        out.r.resize ((size_t) bloques * kBlock);
        for (int b = 0; b < bloques; ++b)
            fx.process (in.l.data(), in.r.data(),
                        out.l.data() + (size_t) b * kBlock,
                        out.r.data() + (size_t) b * kBlock, kBlock);
        return out;
    }

    static double db (double v) { return 20.0 * std::log10 (v > 0.0 ? v : 1e-12); }

    /** Primera muestra que difiere, con los dos valores. Para el log del fallo. */
    struct Diferencia
    {
        bool  hay      = false;
        int   indice   = -1;
        float a        = 0.0f;
        float b        = 0.0f;
        double maxAbs  = 0.0;
    };

    static Diferencia primeraDiferencia (const Stereo& a, const Stereo& b)
    {
        Diferencia d;
        for (size_t i = 0; i < a.l.size(); ++i)
        {
            const double dl = std::abs ((double) a.l[i] - (double) b.l[i]);
            const double dr = std::abs ((double) a.r[i] - (double) b.r[i]);
            d.maxAbs = std::max (d.maxAbs, std::max (dl, dr));

            if (! d.hay && (a.l[i] != b.l[i] || a.r[i] != b.r[i]))
            {
                d.hay = true;
                d.indice = (int) i;
                d.a = (dl >= dr ? a.l[i] : a.r[i]);
                d.b = (dl >= dr ? b.l[i] : b.r[i]);
            }
        }
        return d;
    }

    static bool todosFinos (const Stereo& x)
    {
        for (size_t i = 0; i < x.l.size(); ++i)
            if (! std::isfinite (x.l[i]) || ! std::isfinite (x.r[i]))
                return false;
        return true;
    }

    /** Los once ajustes con los que se midio todo. Ritmo unico: si se anyade
        uno nuevo, las cifras de la cabecera hay que volver a medirlas. */
    struct Ajuste { const char* nombre; float rate, depth, fb, spread, mix; };

    static const Ajuste kAjustes[11] =
    {
        { "por defecto (0.4/0.5/0.3/0.6/0.5)", 0.4f, 0.5f, 0.3f, 0.6f, 0.5f },
        { "rate 0.0                        ", 0.0f, 0.5f, 0.3f, 0.6f, 0.5f },
        { "rate 1.0                        ", 1.0f, 0.5f, 0.3f, 0.6f, 0.5f },
        { "depth 1.0                       ", 0.4f, 1.0f, 0.3f, 0.6f, 0.5f },
        { "feedback 1.0                    ", 0.4f, 0.5f, 1.0f, 0.6f, 0.5f },
        { "spread 0.0                      ", 0.4f, 0.5f, 0.3f, 0.0f, 0.5f },
        { "spread 1.0                      ", 0.4f, 0.5f, 0.3f, 1.0f, 0.5f },
        { "mix 1.0 (solo mojado)           ", 0.4f, 0.5f, 0.3f, 0.6f, 1.0f },
        { "mix 0.0 (solo seco)             ", 0.4f, 0.5f, 0.3f, 0.6f, 0.0f },
        { "todos al maximo                 ", 1.0f, 1.0f, 1.0f, 1.0f, 1.0f },
        { "todos al minimo                 ", 0.0f, 0.0f, 0.0f, 0.0f, 0.0f },
    };

    /** El envoltorio vivo, que es lo que el producto instancia. */
    static void ponMandos (FXSolinaEnsemble& fx, const Ajuste& a)
    {
        fx.setParameter (0, a.rate);
        fx.setParameter (1, a.depth);
        fx.setParameter (2, a.fb);
        fx.setParameter (3, a.spread);
        fx.setParameter (4, a.mix);
    }

    static void ponMandos (FrozenSolinaEnsemble& fx, const Ajuste& a)
    {
        fx.setParameter (0, a.rate);
        fx.setParameter (1, a.depth);
        fx.setParameter (2, a.fb);
        fx.setParameter (3, a.spread);
        fx.setParameter (4, a.mix);
    }
}

//==============================================================================
class FXSolinaParityTests : public juce::UnitTest
{
public:
    FXSolinaParityTests() : juce::UnitTest ("FX Solina Parity (DualLFO + Standard)", "ABD") {}

    void runTest() override
    {
        dualLfoCommittedMatchesItsFrozenCopy();
        dualLfoKnobsMoveAndThreeAreDead();
        dualLfoSoundsDifferentFromStandard();
        dualLfoLevelStaysWhereItWasMeasured();
        dualLfoIsCleanInSilence();
        standardMatchesTheOldEngine();
        standardKnobsAllMove();
        blockSizeDoesNotChangeTheAudio();
        resetGoesBackToFactory();
    }

private:
    //==========================================================================
    void dualLfoCommittedMatchesItsFrozenCopy()
    {
        beginTest ("el DualLFO commiteado suena igual que su copia congelada (0 ULPS)");

        const Stereo in = senalMusical();

        double peor = 0.0;

        for (const auto& a : kAjustes)
        {
            FrozenSolinaDualLFO ref;
            ref.prepare (kSampleRate);
            ref.setRateNorm (a.rate);
            ref.setDepthNorm (a.depth);

            abd::dsp::DspSolinaEnsemble fx;
            fx.prepare (kSampleRate);
            fx.setMode (abd::dsp::DspSolinaEnsemble::Mode::DualLFO);
            fx.setRateNorm (a.rate);
            fx.setDepthNorm (a.depth);

            const Diferencia d = primeraDiferencia (render (ref, in, 40), render (fx, in, 40));
            peor = std::max (peor, d.maxAbs);

            if (d.hay)
            {
                expect (false, juce::String (a.nombre).trim() + ": la muestra " + juce::String (d.indice)
                               + " es " + juce::String (d.a) + " y deberia ser " + juce::String (d.b)
                               + " (diferencia maxima " + juce::String (d.maxAbs, 8) + ")");
            }
            else
            {
                expect (true, juce::String (a.nombre).trim() + ": 0 ULPS, identico bit a bit");
            }
        }

        // Se imprime aunque sea cero: que se vea el cero es el resultado.
        logMessage ("peor diferencia en " + juce::String ((int) (sizeof (kAjustes) / sizeof (kAjustes[0])))
                    + " ajustes: " + juce::String (peor, 8));
    }

    //==========================================================================
    void dualLfoKnobsMoveAndThreeAreDead()
    {
        beginTest ("en DualLFO, rate y depth mueven; feedback, spread y mix no leen");

        const Stereo in = senalMusical();

        auto duo = [&] (float rate, float depth, float fb, float spread, float mix)
        {
            abd::dsp::DspSolinaEnsemble fx;
            fx.prepare (kSampleRate);
            fx.setMode (abd::dsp::DspSolinaEnsemble::Mode::DualLFO);
            fx.setRateNorm (rate);
            fx.setDepthNorm (depth);
            fx.setFeedbackNorm (fb);
            fx.setSpreadNorm (spread);
            fx.setMixNorm (mix);
            return render (fx, in, 40);
        };

        {
            // Medido: 6.9e-01. El margen es dos ordenes por debajo.
            const Diferencia d = primeraDiferencia (duo (0.0f, 0.5f, 0.3f, 0.6f, 0.5f),
                                                    duo (1.0f, 0.5f, 0.3f, 0.6f, 0.5f));
            logMessage ("rate 0.0 vs 1.0: diferencia " + juce::String (d.maxAbs, 4));
            expect (d.maxAbs > 0.01, "el mando de rate mueve el sonido del DualLFO");
        }

        {
            // Medido: 5.7e-01.
            const Diferencia d = primeraDiferencia (duo (0.4f, 0.0f, 0.3f, 0.6f, 0.5f),
                                                    duo (0.4f, 1.0f, 0.3f, 0.6f, 0.5f));
            logMessage ("depth 0.0 vs 1.0: diferencia " + juce::String (d.maxAbs, 4));
            expect (d.maxAbs > 0.01, "el mando de profundidad mueve el sonido del DualLFO");
        }

        // Y los tres que la rama DualLFO NO lee. Medido: 0.000e+00 exacto en los
        // tres. Esto fija como esta el codigo commiteado hoy: si alguien los
        // cablea, el test falla y hay que declarar el cambio aqui, arriba, con
        // la medicion nueva.
        {
            const Diferencia d = primeraDiferencia (duo (0.4f, 0.5f, 0.0f, 0.6f, 0.5f),
                                                    duo (0.4f, 0.5f, 1.0f, 0.6f, 0.5f));
            logMessage ("feedback 0.0 vs 1.0: diferencia " + juce::String (d.maxAbs, 4));
            expect (! d.hay, "la rama DualLFO no lee el mando de feedback (medido: 0)");
        }

        {
            const Diferencia d = primeraDiferencia (duo (0.4f, 0.5f, 0.3f, 0.0f, 0.5f),
                                                    duo (0.4f, 0.5f, 0.3f, 1.0f, 0.5f));
            logMessage ("spread 0.0 vs 1.0: diferencia " + juce::String (d.maxAbs, 4));
            expect (! d.hay, "la rama DualLFO no lee el mando de spread (medido: 0)");
        }

        {
            const Diferencia d = primeraDiferencia (duo (0.4f, 0.5f, 0.3f, 0.6f, 0.0f),
                                                    duo (0.4f, 0.5f, 0.3f, 0.6f, 1.0f));
            logMessage ("mix 0.0 vs 1.0: diferencia " + juce::String (d.maxAbs, 4));
            expect (! d.hay, "la rama DualLFO no lee el mando de mix (medido: 0)");
        }
    }

    //==========================================================================
    void dualLfoSoundsDifferentFromStandard()
    {
        beginTest ("el DualLFO suena distinto del Standard: el selector no esta muerto");

        const Stereo in = senalMusical();

        for (const auto& a : kAjustes)
        {
            abd::dsp::DspSolinaEnsemble est;
            est.prepare (kSampleRate);
            est.setRateNorm (a.rate);
            est.setDepthNorm (a.depth);

            abd::dsp::DspSolinaEnsemble duo;
            duo.prepare (kSampleRate);
            duo.setMode (abd::dsp::DspSolinaEnsemble::Mode::DualLFO);
            duo.setRateNorm (a.rate);
            duo.setDepthNorm (a.depth);

            const Diferencia d = primeraDiferencia (render (est, in, 40), render (duo, in, 40));

            // Medido: el menor de los once ajustes es 0.2286 ("todos al
            // minimo"). El margen queda dos ordenes por debajo.
            if (d.maxAbs < 0.01)
                expect (false, juce::String (a.nombre).trim() + ": los dos modos dan lo mismo ("
                                   + juce::String (d.maxAbs, 4) + ")");
            else
                expect (true, juce::String (a.nombre).trim() + ": distinto, "
                                   + juce::String (d.maxAbs, 4));
        }
    }

    //==========================================================================
    void dualLfoLevelStaysWhereItWasMeasured()
    {
        beginTest ("el nivel del DualLFO sigue donde lo dejo la medicion");

        const Stereo in = senalMusical();

        abd::dsp::DspSolinaEnsemble fx;
        fx.prepare (kSampleRate);
        fx.setMode (abd::dsp::DspSolinaEnsemble::Mode::DualLFO);

        const Cifras c = medir (render (fx, in, 40));

        logMessage ("nivel " + juce::String (c.rms, 4) + " (" + juce::String (db (c.rms), 2)
                    + " dBFS), pico " + juce::String (c.pico, 4)
                    + ", correlacion " + juce::String (c.correlacion, 3));

        // Medido con los mandos de fabrica: -14.29 dBFS, pico 0.6008,
        // correlacion +0.996. Estas tres cifras son la capa que protege contra
        // "las dos copias se rompen a la vez": si el DualLFO cambia de nivel,
        // de pico o de apertura estereo, aqui falla aunque la copia congelada
        // siga de acuerdo con el motor.
        expect (std::abs (db (c.rms) - (-14.29)) < 0.5,
                "el nivel del DualLFO se ha movido: " + juce::String (db (c.rms), 2) + " dBFS");
        expect (std::abs (c.pico - 0.6008) < 0.05,
                "el pico del DualLFO se ha movido: " + juce::String (c.pico, 4));
        expect (std::abs (c.correlacion - 0.996) < 0.01,
                "la correlacion L/R del DualLFO se ha movido: " + juce::String (c.correlacion, 3));
    }

    //==========================================================================
    void dualLfoIsCleanInSilence()
    {
        beginTest ("el DualLFO no deja ni NaN ni residuo en silencio");

        const Stereo z = silencio();

        abd::dsp::DspSolinaEnsemble fx;
        fx.prepare (kSampleRate);
        fx.setMode (abd::dsp::DspSolinaEnsemble::Mode::DualLFO);

        const Stereo out = render (fx, z, 200);
        const Cifras c = medir (out);

        logMessage ("suelo " + juce::String (db (c.rms), 1) + " dBFS, pico " + juce::String (c.pico, 4));

        expect (todosFinos (out), "salida finita con entrada en silencio");
        // Medido: exactamente 0. El margen deja sitio para un redondeo, no para
        // un zumbido.
        expect (c.pico < 1.0e-6, "el DualLFO no deja residuo en silencio: " + juce::String (c.pico, 8));
    }

    //==========================================================================
    void standardMatchesTheOldEngine()
    {
        beginTest ("el modo Standard suena igual que el motor viejo (margen medido)");

        const Stereo in = senalMusical();

        double peorMuestra = 0.0;
        double peorNivel   = 0.0;

        for (const auto& a : kAjustes)
        {
            FrozenSolinaEnsemble ref;
            ref.prepare (kSampleRate, kBlock);
            ponMandos (ref, a);

            FXSolinaEnsemble fx;
            fx.prepare (kSampleRate, kBlock);
            ponMandos (fx, a);

            const Stereo antes = render (ref, in, 40);
            const Stereo ahora = render (fx, in, 40);

            const Diferencia d = primeraDiferencia (antes, ahora);
            const double nivel = db (medir (ahora).rms) - db (medir (antes).rms);

            peorMuestra = std::max (peorMuestra, d.maxAbs);
            peorNivel   = std::max (peorNivel, std::abs (nivel));

            // 8 decimales, no 4: el residuo de este modo es del orden de 1e-05,
            // y con 4 decimales el log imprimia un 0.0000 que esconde justo la
            // cifra que este fichero existe por mostrar.
            logMessage (juce::String (a.nombre).trim() + ": diferencia maxima "
                        + juce::String (d.maxAbs, 8) + ", nivel " + juce::String (nivel, 3) + " dB");
        }

        logMessage ("peor caso: muestra " + juce::String (peorMuestra, 8)
                    + ", nivel " + juce::String (peorNivel, 3) + " dB");

        // Medido con los once ajustes: peor muestra 1.587e-05, peor nivel
        // 0.000 dB. Ese residuo es `sinf` de la CRT contra `abd::dsp::sin`, que
        // es un polinomio propio. El margen queda por encima de lo medido y por
        // debajo de cualquier cambio de DSP que importe.
        expect (peorNivel < 0.01,
                "el nivel del modo Standard se ha movido " + juce::String (peorNivel, 4) + " dB");
        expect (peorMuestra < 2.0e-5,
                "el modo Standard se ha alejado del motor viejo: " + juce::String (peorMuestra, 8));
    }

    //==========================================================================
    void standardKnobsAllMove()
    {
        beginTest ("los cinco mandos del Standard mueven de verdad");

        const Stereo in = senalMusical();

        auto std_ = [&] (float rate, float depth, float fb, float spread, float mix)
        {
            FXSolinaEnsemble fx;
            fx.prepare (kSampleRate, kBlock);
            fx.setParameter (0, rate);
            fx.setParameter (1, depth);
            fx.setParameter (2, fb);
            fx.setParameter (3, spread);
            fx.setParameter (4, mix);
            return render (fx, in, 40);
        };

        // Medidos: rate 1.7e-01, depth 1.8e-01, feedback 4.9e-02,
        // spread 7.9e-02, mix 5.2e-01. El mas flojo, feedback, queda 48 veces
        // por encima del margen.
        struct Prueba { const char* nombre; double medida; const Stereo& a; const Stereo& b; };
        const Stereo r0 = std_ (0.0f, 0.5f, 0.3f, 0.6f, 0.5f);
        const Stereo r1 = std_ (1.0f, 0.5f, 0.3f, 0.6f, 0.5f);
        const Stereo d0 = std_ (0.4f, 0.0f, 0.3f, 0.6f, 0.5f);
        const Stereo d1 = std_ (0.4f, 1.0f, 0.3f, 0.6f, 0.5f);
        const Stereo f0 = std_ (0.4f, 0.5f, 0.0f, 0.6f, 0.5f);
        const Stereo f1 = std_ (0.4f, 0.5f, 1.0f, 0.6f, 0.5f);
        const Stereo s0 = std_ (0.4f, 0.5f, 0.3f, 0.0f, 0.5f);
        const Stereo s1 = std_ (0.4f, 0.5f, 0.3f, 1.0f, 0.5f);
        const Stereo m0 = std_ (0.4f, 0.5f, 0.3f, 0.6f, 0.0f);
        const Stereo m1 = std_ (0.4f, 0.5f, 0.3f, 0.6f, 1.0f);

        const Prueba pruebas[5] =
        {
            { "rate  ", 0.17, r0, r1 },
            { "depth ", 0.18, d0, d1 },
            { "fb    ", 0.049, f0, f1 },
            { "spread", 0.079, s0, s1 },
            { "mix   ", 0.52, m0, m1 },
        };

        for (const auto& p : pruebas)
        {
            const Diferencia d = primeraDiferencia (p.a, p.b);
            logMessage (juce::String (p.nombre).trim() + " 0.0 vs 1.0: " + juce::String (d.maxAbs, 4)
                        + " (medido " + juce::String (p.medida, 4) + ")");
            expect (d.maxAbs > 0.001,
                    juce::String (p.nombre).trim() + ": el mando no mueve el sonido");
        }
    }

    //==========================================================================
    void blockSizeDoesNotChangeTheAudio()
    {
        beginTest ("el tamano de bloque no cambia el audio");

        // Entrada unica de 8192 muestras, y la misma entrada con bloques de
        // 4096 y con bloques de 256. Medido: 0.000e+00 en los tres motores.
        Stereo entrada;
        entrada.l.resize (2 * kBlock);
        entrada.r.resize (2 * kBlock);
        const Stereo u = senalMusical();
        for (int rep = 0; rep < 2; ++rep)
            for (int i = 0; i < kBlock; ++i)
            {
                entrada.l[(size_t) rep * kBlock + i] = u.l[i];
                entrada.r[(size_t) rep * kBlock + i] = u.r[i];
            }

        auto procesa = [&] (auto& fx, int tam)
        {
            Stereo out;
            out.l.resize (entrada.l.size());
            out.r.resize (entrada.r.size());
            for (size_t hecho = 0; hecho < entrada.l.size(); hecho += (size_t) tam)
                fx.process (entrada.l.data() + hecho, entrada.r.data() + hecho,
                            out.l.data() + hecho, out.r.data() + hecho, tam);
            return out;
        };

        {
            FXSolinaEnsemble a, b;
            a.prepare (kSampleRate, kBlock);
            b.prepare (kSampleRate, kBlock);
            const Diferencia d = primeraDiferencia (procesa (a, kBlock), procesa (b, 256));
            logMessage ("Standard: " + juce::String (d.maxAbs, 4));
            expect (! d.hay, "el modo Standard no depende del tamano de bloque");
        }

        {
            abd::dsp::DspSolinaEnsemble a, b;
            a.prepare (kSampleRate);
            b.prepare (kSampleRate);
            a.setMode (abd::dsp::DspSolinaEnsemble::Mode::DualLFO);
            b.setMode (abd::dsp::DspSolinaEnsemble::Mode::DualLFO);
            const Diferencia d = primeraDiferencia (procesa (a, kBlock), procesa (b, 256));
            logMessage ("DualLFO: " + juce::String (d.maxAbs, 4));
            expect (! d.hay, "el DualLFO no depende del tamano de bloque");
        }

        {
            FrozenSolinaEnsemble a, b;
            a.prepare (kSampleRate, kBlock);
            b.prepare (kSampleRate, kBlock);
            const Diferencia d = primeraDiferencia (procesa (a, kBlock), procesa (b, 256));
            logMessage ("motor viejo: " + juce::String (d.maxAbs, 4));
            expect (! d.hay, "el motor viejo tampoco dependia del tamano de bloque");
        }
    }

    //==========================================================================
    void resetGoesBackToFactory()
    {
        beginTest ("reset(): el nuevo vuelve a fabrica y recalcula el LFO; el viejo no");

        const Stereo in = senalMusical();

        {
            // El motor nuevo: tras setRate(1.0) y reset, tiene que sonar igual
            // que recien preparado. `prepare()` acaba en `reset()`, asi que el
            // estado de fabrica ES el de reset, y reset restaura ademas el rate
            // y recalcula el LFO. Medido: 0.000e+00.
            FXSolinaEnsemble a, b;
            a.prepare (kSampleRate, kBlock);
            b.prepare (kSampleRate, kBlock);
            b.setParameter (0, 1.0f);
            b.reset();

            const Diferencia d = primeraDiferencia (render (a, in, 40), render (b, in, 40));
            logMessage ("motor nuevo: " + juce::String (d.maxAbs, 6));
            expect (! d.hay, "tras reset() el motor nuevo suena como recien preparado");
        }

        {
            // El viejo, en cambio, se quedaba con el lfoInc del ultimo rate:
            // reset() restauraba los mandos pero NO recalculaba el incremento
            // del LFO, asi que el sonido volvia a fabrica MENOS el rate, que se
            // quedaba yendo al ultimo valor puesto. Medido: 1.786e-01.
            FrozenSolinaEnsemble a, b;
            a.prepare (kSampleRate, kBlock);
            b.prepare (kSampleRate, kBlock);
            b.setParameter (0, 1.0f);
            b.reset();

            const Diferencia d = primeraDiferencia (render (a, in, 40), render (b, in, 40));
            logMessage ("motor viejo tras reset con rate 1.0: " + juce::String (d.maxAbs, 4));
            expect (d.hay,
                    "el motor viejo dejaba el LFO apuntando al ultimo rate tras reset(); "
                    "si este assert falla, la referencia congelada ya no es la verdad de antes");
        }
    }
};

static FXSolinaParityTests fxSolinaParityTests;

} // namespace ABD
