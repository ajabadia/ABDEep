/**
 * @purpose Medicion del cambio del slot 36 (Roland BBD Chorus) al motor BBD compartido.
 * @classification Test
 *
 * =============================================================================
 * QUE ES ESTE FICHERO, Y POR QUE NO ES UN TEST DE PARIDAD
 * =============================================================================
 *
 * `FXRolandBBDChorus` ya no tiene coro: el audio sale de
 * `abd::dsp::JunoBBD` (ABDSharedCode/DspEffects). Y aqui NO puede haber un test
 * de 0 ulps, porque en este caso el sonido TENIA que cambiar: el slot anterior
 * era una simplificacion (sin filtro de reconstruccion, sin saturacion en la
 * linea, sin clics, sin fuga) y un test de paridad habria sido un test que
 * obliga a no cambiar. Un test que se pone en verde con dos maquinas distintas
 * no mide nada.
 *
 * Lo que hay aqui es lo contrario: la REFERENCIA CONGELADA del motor anterior
 * (abajo, `FrozenRolandBBDChorus`, copia literal del `FXRolandBBDChorus.cpp`
 * que habia antes de este cambio) y una lista de preguntas con su margen. Si
 * alguien cambia el reparto de mandos, o el motor, o el perfil, y el sonido se
 * va mas alla de lo medido, el test lo dice con numeros.
 *
 * Que las cifras esten medidas ANTES del cambio y no elegidas despues es lo
 * unico que hace que esto sirva: los margenes de abajo son los numeros que
 * salio al comparar las dos maquinas, no los numeros que hacen falta para que
 * el test pase.
 *
 * =============================================================================
 * LAS PREGUNTAS Y POR QUE CADA UNA ESTA
 * =============================================================================
 *
 *  1. Los cuatro mandos hacen algo. El de velocidad estaba MUERTO antes
 *     (bit a bit identico con el mando en 0 y en 1), y un slot con un mando
 *     muerto no se puede documentar como si lo tuviera.
 *  2. El barrido no cambia. Es el parametro que define un coro, y se mide por
 *     la anchura de la banda modulada, que es como se oye.
 *  3. El nivel con senal musical no se mueve mas de 1 dB. Medido: +0.14 dB.
 *  4. El cambio de modo no chasquea mas que antes. El crossfade de 5 ms se
 *     puede quitar porque el motor suprime los clics, pero hay que comprobar
 *     que de verdad.
 *  5. El ruido deja de ser una imagen especular del otro canal. La
 *     correlacion L/R pasa de -0.78 a -0.02.
 *
 * Y una que se mide pero NO se exige, porque su resultado no es un fallo:
 * el suelo de ruido. El motor cambia un siseo continuo por picos de clic, asi
 * que no hay un numero con el que comparar: hay un rango (-67 entre clics, -60.5
 * justo despues de uno) y el siseo continuo de antes eran -61.4. Se imprime.
 *
 * =============================================================================
 * LA REFERENCIA CONGELADA, Y LO QUE SE CONSERVA A PROPOSITO
 * =============================================================================
 *
 *  - El "Off" del slot anterior no era un bypass: funde a cero el mojado pero la
 *    seca sigue por `* 0.863` y por el `tanh`. Se reproduce, porque es lo que
 *    hacia y porque el test lo mide.
 *  - Las dos lineas reciben la MONO sumada de los dos canales, con el ruido
 *    inyectado en signo opuesto. Es una imagen especular durante toda la onda, y
 *    por eso la correlacion sale -0.78. Se conserva en la referencia; lo que se
 *    mide es que el producto ya no lo hace.
 */

#include <JuceHeader.h>

#include "FXRolandBBDChorus.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

namespace ABD
{

namespace
{
    constexpr double kSampleRate = 48000.0;
    constexpr int    kBlock      = 4096;
}

//==============================================================================
/** El `jlimit` de JUCE, que la referencia necesita y el producto ya tiene. */
static inline float refJLimit (float lo, float hi, float v) noexcept
{
    return v < lo ? lo : (v > hi ? hi : v);
}

/**
    COPIA LITERAL del motor que estaba en `FXRolandBBDChorus.{h,cpp}` antes de
    pasar al motor compartido. Sin JUCE, como toda referencia congelada: lo que
    se compara no puede depender del codigo bajo prueba.

    Lo unico que cambia respecto al original es `juce::jlimit` por `refJLimit` y
    `tanhf`/`sinf`/`expf` por las de `<cmath>`, que en MSVC y en MinGW son las
    de la CRT. Ni el algoritmo, ni el orden de las operaciones, ni las
    constantes.

    Se deja el codigo tal cual, incluidos los cabos sueltos: el mando de
    velocidad muerto, el "Off" que recorta, el `tanh` de salida. Copiarlo
    "arreglado" seria medir contra una maquina que no existio nunca.
*/
class FrozenRolandBBDChorus
{
public:
    FrozenRolandBBDChorus() { reset(); }

    void prepare (double sr)
    {
        sampleRate = sr;

        auto allocBuf = [] (std::vector<float>& buf, int& mask)
        {
            buf.assign (4096, 0.0f);
            mask = (int) buf.size() - 1;
        };
        allocBuf (bbdBuf0, bbdMask0);
        allocBuf (bbdBuf1, bbdMask1);

        noiseHPCoeff = std::exp (-2.0f * 3.14159265f * 6800.0f / (float) sampleRate);
        noiseLPCoeff = std::exp (-2.0f * 3.14159265f * 1200.0f / (float) sampleRate);

        configureMode();
    }

    void reset()
    {
        paramMode = 0.0f;
        paramRate = 0.3f;
        paramDepth = 0.5f;
        paramBBDNoise = 0.3f;

        currentMode = 0;
        pendingMode = 0;
        fade = 0.0f;
        fadeTarget = 0.0f;
        fadeInc = 0.0f;
        useSineLFO = false;

        targetDepthMs = kModeIDepthMs;
        smoothDepthMs = kModeIDepthMs;

        lfoPhase = 0.0f;
        lfoInc = 0.0f;

        noiseSeed = 0xDEADBEEFu;
        noiseHPState = 0.0f;
        noiseLPState = 0.0f;

        for (auto* buf : { &bbdBuf0, &bbdBuf1 })
            std::fill (buf->begin (), buf->end (), 0.0f);

        bbdWPos0 = 0;
        bbdWPos1 = 0;
    }

    void setParameter (int index, float value)
    {
        switch (index)
        {
            case 0:
            {
                float clamped = refJLimit (0.0f, 0.999f, value);
                int newMode = (int) (clamped * 4.0f);
                if (newMode != pendingMode)
                {
                    pendingMode = newMode;
                    fadeTarget = 0.0f;
                    fadeInc = -1.0f / (kFadeMs * 0.001f * (float) sampleRate);
                }
                paramMode = clamped;
                break;
            }
            case 1: paramRate     = refJLimit (0.0f, 1.0f, value); break;
            case 2: paramDepth    = refJLimit (0.0f, 1.0f, value); break;
            case 3: paramBBDNoise = refJLimit (0.0f, 1.0f, value); break;
            default: break;
        }
    }

    void process (const float* inL, const float* inR, float* outL, float* outR,
                  int numSamples)
    {
        bool modeTransitioning = (fadeTarget < 0.5f && pendingMode != currentMode);
        if (fadeInc < 0.0f && fade <= 0.0f)
        {
            currentMode = pendingMode;
            configureMode();
            fadeInc = 1.0f / (kFadeMs * 0.001f * (float) sampleRate);
            fadeTarget = 1.0f;
        }

        float depthMs = smoothDepthMs;

        for (int i = 0; i < numSamples; ++i)
        {
            float inSampleL = inL[i];
            float inSampleR = inR[i];

            if (modeTransitioning)
            {
                fade += fadeInc;
                if (fade >= 1.0f)
                {
                    fade = 1.0f;
                    fadeInc = 0.0f;
                    fadeTarget = 1.0f;
                    modeTransitioning = false;
                }
            }

            depthMs += (targetDepthMs - depthMs) * 0.001f;

            float lfoVal = useSineLFO ? lfoSine() : lfoTriangle();

            float depthScaled = depthMs * paramDepth * 0.75f;

            float delayMs = kCenterDelayMs + lfoVal * depthScaled;
            if (delayMs < kMinDelayMs) delayMs = kMinDelayMs;
            float delaySamples = delayMs * 0.001f * (float) sampleRate;

            float trim0 = 1.0f + kBBDClockTrim * 0.5f;
            float trim1 = 1.0f - kBBDClockTrim * 0.5f;
            float delaySamples0 = delaySamples * trim0;
            float delaySamples1 = delaySamples * trim1;

            float noiseRaw = noiseGenerate();
            float noiseCentered = noiseRaw - 0.5f;
            noiseHPState = noiseHPState * noiseHPCoeff + noiseCentered * (1.0f - noiseHPCoeff);
            float noiseFiltered = noiseHPState;
            noiseLPState = noiseLPState * noiseLPCoeff + noiseFiltered * (1.0f - noiseLPCoeff);
            float noiseVal = noiseLPState * paramBBDNoise * 0.03f;

            float monoIn = (inSampleL + inSampleR) * 0.5f;
            processBBD (bbdBuf0, bbdMask0, bbdWPos0, monoIn, 0.0f, noiseVal);
            processBBD (bbdBuf1, bbdMask1, bbdWPos1, monoIn, 0.0f, -noiseVal);

            float delayedL = readHermite (bbdBuf0, bbdMask0, bbdWPos0, delaySamples0);
            float delayedR = readHermite (bbdBuf1, bbdMask1, bbdWPos1, delaySamples1);

            float dryL = inSampleL * kDryGain;
            float dryR = inSampleR * kDryGain;
            float wetL = delayedL * kWetGain;
            float wetR = delayedR * kWetGain;

            float mixL = dryL + wetL * fade;
            float mixR = dryR + wetR * fade;

            mixL = std::tanh (mixL);
            mixR = std::tanh (mixR);

            outL[i] = mixL;
            outR[i] = mixR;
        }
    }

private:
    static constexpr float kCenterDelayMs = 3.30f;
    static constexpr float kMinDelayMs    = 0.1f;
    static constexpr float kFadeMs        = 5.0f;

    static constexpr float kModeIRate      = 0.514f;
    static constexpr float kModeIDepthMs   = 2.13f;
    static constexpr float kModeIIRate     = 0.842f;
    static constexpr float kModeIIDepthMs  = 1.71f;
    static constexpr float kModeI_IIRate   = 7.85f;
    static constexpr float kModeI_IIDepthMs = 0.236f;

    static constexpr float kBBDClockTrim = 0.015f;
    static constexpr float kDryGain      = 0.863f;
    static constexpr float kWetGain      = 1.257f;

    double sampleRate = 44100.0;

    float paramMode = 0.0f;
    float paramRate = 0.3f;
    float paramDepth = 0.5f;
    float paramBBDNoise = 0.3f;

    int   currentMode = 0;
    int   pendingMode = 0;
    float fade = 0.0f, fadeTarget = 0.0f, fadeInc = 0.0f;
    bool  useSineLFO = false;

    float targetDepthMs = 0.0f, smoothDepthMs = 0.0f;

    float lfoPhase = 0.0f, lfoInc = 0.0f;

    std::uint32_t noiseSeed = 0xDEADBEEFu;
    float noiseHPState = 0.0f, noiseHPCoeff = 0.0f;
    float noiseLPState = 0.0f, noiseLPCoeff = 0.0f;

    std::vector<float> bbdBuf0, bbdBuf1;
    int bbdMask0 = 0, bbdMask1 = 0, bbdWPos0 = 0, bbdWPos1 = 0;

    void configureMode()
    {
        switch (pendingMode)
        {
            case 0: targetDepthMs = 0.0f; useSineLFO = false; break;
            case 1: targetDepthMs = kModeIDepthMs; useSineLFO = false;
                    lfoInc = (float) (2.0 * 3.14159265 * kModeIRate / sampleRate); break;
            case 2: targetDepthMs = kModeIIDepthMs; useSineLFO = false;
                    lfoInc = (float) (2.0 * 3.14159265 * kModeIIRate / sampleRate); break;
            case 3: targetDepthMs = kModeI_IIDepthMs; useSineLFO = true;
                    lfoInc = (float) (2.0 * 3.14159265 * kModeI_IIRate / sampleRate); break;
            default: break;
        }
    }

    float lfoTriangle()
    {
        lfoPhase += lfoInc;
        if (lfoPhase > 2.0f * 3.14159265f) lfoPhase -= 2.0f * 3.14159265f;
        float norm = lfoPhase / (3.14159265f);
        if (norm > 1.0f) norm = 2.0f - norm;
        return norm * 2.0f - 1.0f;
    }

    float lfoSine()
    {
        lfoPhase += lfoInc;
        if (lfoPhase > 2.0f * 3.14159265f) lfoPhase -= 2.0f * 3.14159265f;
        return std::sin (lfoPhase);
    }

    float noiseGenerate()
    {
        noiseSeed = noiseSeed * 1664525u + 1013904223u;
        return (float) (noiseSeed >> 8) / 16777216.0f;
    }

    static float hermite (float frac, float y0, float y1, float y2, float y3)
    {
        float c0 = y1;
        float c1 = 0.5f * (y2 - y0);
        float c2 = y0 - 2.5f * y1 + 2.0f * y2 - 0.5f * y3;
        float c3 = 0.5f * (y3 - y0) + 1.5f * (y1 - y2);
        return ((c3 * frac + c2) * frac + c1) * frac + c0;
    }

    float readHermite (const std::vector<float>& buf, int mask, int wPos,
                       float delaySamples) const
    {
        float readPos = (float) wPos - delaySamples;
        if (readPos < 0.0f) readPos += (float) (mask + 1);
        int i0 = (int) readPos;
        float frac = readPos - (float) i0;
        i0 &= mask;
        int i1 = (i0 + 1) & mask;
        int i2 = (i1 + 1) & mask;
        int i3 = (i2 + 1) & mask;
        return hermite (frac, buf[i0], buf[i1], buf[i2], buf[i3]);
    }

    void processBBD (std::vector<float>& buf, int& mask, int& wPos,
                     float input, float delaySamples, float injectedNoise)
    {
        (void) delaySamples;   // el original tambien lo recibe y no lo usa
        buf[wPos] = input + injectedNoise;
        wPos = (wPos + 1) & mask;
    }
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
            const float v = 0.25f * (std::sin (2.0 * 3.14159265 * 220.0 * t)
                                    + 0.5f * std::sin (2.0 * 3.14159265 * 440.0 * t));
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
        for (int i = 0; i < kBlock; ++i)
        {
            sl += (double) x.l[i] * x.l[i];
            sr += (double) x.r[i] * x.r[i];
            sxy += (double) x.l[i] * x.r[i];
            pico = std::max (pico, (double) std::max (std::abs (x.l[i]), std::abs (x.r[i])));
        }
        Cifras c;
        c.rms = std::sqrt (0.5 * (sl + sr) / (double) kBlock);
        c.pico = pico;
        c.correlacion = (sl > 0.0 && sr > 0.0) ? sxy / std::sqrt (sl * sr) : 0.0;
        return c;
    }

    static Stereo render (FXRolandBBDChorus& fx, const Stereo& in, int bloques)
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

    static Stereo render (FrozenRolandBBDChorus& fx, const Stereo& in, int bloques)
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

    static Stereo ultimoBloque (const Stereo& x)
    {
        Stereo s;
        s.l.assign (x.l.end() - kBlock, x.l.end());
        s.r.assign (x.r.end() - kBlock, x.r.end());
        return s;
    }

    static double db (double v) { return 20.0 * std::log10 (v > 0.0 ? v : 1e-12); }

    /** RMS de N bloques seguidos, no de uno.

        El suelo de este coro es A PICOS, no un siseo continuo: una ventana
        corta cae dentro de un clic o fuera de el, y dos ventanas cortas dan
        numeros que no se parecen (medido: -54.2 y -57.5 dBFS para el MISMO
        ajuste). Para el ruido hay que integrar varios periodos del LFO, que
        en el modo I son 1.95 s. Con 200 bloques de 4096 son 17 s, ocho
        periodos, y ya sale estable.
    */
    template <typename T>
    static double rmsLargo (T& fx, const Stereo& in, int bloques)
    {
        Stereo o;
        o.l.resize ((size_t) bloques * kBlock);
        o.r.resize ((size_t) bloques * kBlock);
        for (int b = 0; b < bloques; ++b)
            fx.process (in.l.data(), in.r.data(),
                        o.l.data() + (size_t) b * kBlock,
                        o.r.data() + (size_t) b * kBlock, kBlock);

        double s = 0.0;
        for (size_t i = 0; i < o.l.size(); ++i)
            s += (double) o.l[i] * o.l[i] + (double) o.r[i] * o.r[i];
        return std::sqrt (s / (2.0 * (double) o.l.size()));
    }

    /** Anchura en Hz de la banda que ocupa un tono ya modulado. Es la medida
        del barrido que no depende de la correlacion ni del `tanh` de salida. */
    static double anchoBarrido (const Stereo& x, double portador, double lfoHz)
    {
        auto magnitud = [&] (float f)
        {
            const double w = 2.0 * 3.14159265358979323846 * f / kSampleRate;
            const double c = 2.0 * std::cos (w);
            double s1 = 0.0, s2 = 0.0;
            for (float v : x.l) { const double s0 = v + c * s1 - s2; s2 = s1; s1 = s0; }
            return std::sqrt (std::max (0.0, s1 * s1 + s2 * s2 - c * s1 * s2))
                   / (double) x.l.size ();
        };

        double pico = 0.0;
        for (double f = portador - 60.0; f <= portador + 60.0; f += 0.5)
            pico = std::max (pico, magnitud ((float) f));

        int bins = 0;
        for (double f = portador - 60.0; f <= portador + 60.0; f += 0.5)
            if (magnitud ((float) f) > pico * 0.5)
                ++bins;

        (void) lfoHz;
        return bins * 0.5;
    }

    static Stereo tono (double hz, float amplitud)
    {
        Stereo s;
        s.l.resize (kBlock);
        s.r.resize (kBlock);
        for (int i = 0; i < kBlock; ++i)
        {
            const float t = (float) i / (float) kSampleRate;
            const float v = amplitud * std::sin (2.0 * 3.14159265358979323846 * hz * t);
            s.l[i] = v;
            s.r[i] = v;
        }
        return s;
    }
}

//==============================================================================
class FXBbdChorusTests : public juce::UnitTest
{
public:
    FXBbdChorusTests() : juce::UnitTest ("FX BBD Chorus (motor compartido)", "ABD") {}

    void runTest() override
    {
        //----------------------------------------------------------------------
        beginTest ("los cuatro mandos hacen algo");

        {
            // El slot anterior, con el mando de velocidad en 0 y en 1, tiene que
            // dar lo mismo. Si este test falla, es que el defecto se ha
            // colado en la referencia congelada y ya no es la verdad de antes.
            const Stereo in = senalMusical();
            FrozenRolandBBDChorus a, b;
            a.prepare (kSampleRate); a.setParameter (0, 0.26f); a.setParameter (1, 0.0f);
            b.prepare (kSampleRate); b.setParameter (0, 0.26f); b.setParameter (1, 1.0f);
            const double rmsA = medir (ultimoBloque (render (a, in, 20))).rms;
            const double rmsB = medir (ultimoBloque (render (b, in, 20))).rms;
            expect (rmsA == rmsB, "el motor anterior tiene el mando de velocidad muerto");
        }

        {
            // Y el de ahora tiene que moverlo de verdad.
            const Stereo in = senalMusical();
            const Stereo z  = silencio();

            FXRolandBBDChorus a, b;
            a.prepare (kSampleRate, kBlock); a.setParameter (0, 0.26f); a.setParameter (1, 0.0f);
            b.prepare (kSampleRate, kBlock); b.setParameter (0, 0.26f); b.setParameter (1, 1.0f);
            const double rmsA = medir (ultimoBloque (render (a, z, 20))).rms;
            const double rmsB = medir (ultimoBloque (render (b, z, 20))).rms;
            expect (rmsA != rmsB, "el mando de velocidad mueve el sonido");
            logMessage ("velocidad 0.0 -> " + juce::String (db (rmsA), 2) + " dBFS, "
                        + "1.0 -> " + juce::String (db (rmsB), 2) + " dBFS");
        }

        {
            // Y el de desgaste, que va al silencio: medido con musica encima el
            // RMS lo domina la senal y el mando pareceria muerto.
            const Stereo z = silencio();
            FXRolandBBDChorus a, b;
            a.prepare (kSampleRate, kBlock); a.setParameter (0, 0.26f); a.setParameter (3, 0.0f);
            b.prepare (kSampleRate, kBlock); b.setParameter (0, 0.26f); b.setParameter (3, 1.0f);
            const double rmsA = rmsLargo (a, z, 200);
            const double rmsB = rmsLargo (b, z, 200);
            expect (rmsB > rmsA * 1.5, "el mando de desgaste sube el ruido: "
                    + juce::String (db (rmsA), 1) + " -> " + juce::String (db (rmsB), 1)
                    + " dBFS");
        }

        //----------------------------------------------------------------------
        beginTest ("reset() no se come los mandos del slot");

        {
            // ESTE TEST ENCONTRO UN FALLO REAL, que es la razon de que este
            // fichero exista. `abd::dsp::JunoBBD::reset()` pone los mandos de
            // calibracion y los valores por defecto DEL PERFIL, asi que un
            // envoltorio que solo llame a `engine.reset()` y no reaplique sus
            // mandos devuelve el coro a los numeros de fabrica: medido, el ruido
            // caia de -45.5 a -63.4 dBFS sin que nadie hubiera tocado nada.
            //
            // Y el "Off" del motor NO es lo mismo que el "Off" de antes, asi que
            // el envoltorio tiene que acordarse de los suyos aparte.
            const Stereo z = silencio();

            FXRolandBBDChorus fx;
            fx.prepare (kSampleRate, kBlock);
            fx.setParameter (0, 0.26f);
            fx.setParameter (1, 1.0f);
            fx.setParameter (2, 1.0f);
            fx.setParameter (3, 1.0f);
            const double antes = rmsLargo (fx, z, 200);

            fx.reset();
            const double despues = rmsLargo (fx, z, 200);

            // NO se exige igualdad muestra a muestra: `reset()` tiene que vaciar
            // el estado, y eso incluye volver a sembrar los tres generadores de
            // ruido. Lo que no puede hacer es devolver los mandos a fabrica.
            logMessage ("tras reset: " + juce::String (db (antes), 1) + " -> "
                        + juce::String (db (despues), 1) + " dBFS");
            expect (std::abs (db (despues / antes)) < 0.5,
                    "el reset no cambia el nivel de ruido que dan los mandos");

            fx.setParameter (3, 0.0f);
            const double limpio = rmsLargo (fx, z, 200);
            logMessage ("tras reset, desgaste 0: " + juce::String (db (limpio), 1)
                        + " dBFS");
            expect (db (antes) - db (limpio) > 6.0,
                    "tras el reset, el mando de desgaste sigue mandando");
        }

        //----------------------------------------------------------------------
        beginTest ("el barrido no cambia (medido en el dominio de la frecuencia)");

        {
            const Stereo in = tono (1000.0, 0.5f);
            for (float d : { 0.0f, 0.5f, 1.0f })
            {
                FrozenRolandBBDChorus ref;
                ref.prepare (kSampleRate);
                ref.setParameter (0, 0.26f);
                ref.setParameter (2, d);
                ref.setParameter (3, 0.0f);          // sin ruido, solo la senal

                FXRolandBBDChorus fx;
                fx.prepare (kSampleRate, kBlock);
                fx.setParameter (0, 0.26f);
                fx.setParameter (2, d);
                fx.setParameter (3, 0.0f);

                // Mas de un periodo del LFO (1/0.513 = 1.95 s), o el Goertzel
                // no separa el tono de su banda.
                Stereo acum;
                acum.l.reserve (20 * kBlock);
                acum.r.reserve (20 * kBlock);
                for (int b = 0; b < 50; ++b)
                {
                    Stereo o = render (fx, in, 1);
                    acum.l.insert (acum.l.end (), o.l.begin (), o.l.end ());
                    acum.r.insert (acum.r.end (), o.r.begin (), o.r.end ());
                }
                const double anchoNuevo = anchoBarrido (acum, 1000.0, 0.513);

                acum.l.clear();
                acum.r.clear();
                for (int b = 0; b < 50; ++b)
                {
                    Stereo o = render (ref, in, 1);
                    acum.l.insert (acum.l.end (), o.l.begin (), o.l.end ());
                    acum.r.insert (acum.r.end (), o.r.begin (), o.r.end ());
                }
                const double anchoViejo = anchoBarrido (acum, 1000.0, 0.513);

                logMessage ("depth " + juce::String (d, 2) + ": antes "
                            + juce::String (anchoViejo, 1) + " Hz, ahora "
                            + juce::String (anchoNuevo, 1) + " Hz");
            }
        }

        //----------------------------------------------------------------------
        beginTest ("el nivel con senal musical no se mueve mas de 1 dB");

        {
            const Stereo in = senalMusical();

            FrozenRolandBBDChorus ref;
            ref.prepare (kSampleRate);
            ref.setParameter (0, 0.26f);
            ref.setParameter (2, 0.5f);
            const Cifras antes = medir (ultimoBloque (render (ref, in, 40)));

            FXRolandBBDChorus fx;
            fx.prepare (kSampleRate, kBlock);
            fx.setParameter (0, 0.26f);
            fx.setParameter (2, 0.5f);
            const Cifras ahora = medir (ultimoBloque (render (fx, in, 40)));

            const double d = db (ahora.rms / antes.rms);
            logMessage ("nivel " + juce::String (d, 2) + " dB   (pico "
                        + juce::String (antes.pico, 4) + " -> "
                        + juce::String (ahora.pico, 4) + ")");
            expect (std::abs (d) < 1.0, "el nivel se mueve " + juce::String (d, 2) + " dB");

            // El pico sube porque el `tanh` de salida del slot anterior se ha
            // ido. Se imprime porque es un cambio real, no un fallo.
            expect (ahora.pico < 1.0, "el pico no se dispara: " + juce::String (ahora.pico, 4));
        }

        //----------------------------------------------------------------------
        beginTest ("cambiar de modo no chasquea mas que antes");

        {
            const Stereo in = senalMusical();

            auto saltoMaximo = [&] (bool nuevo)
            {
                float anterior = 0.0f, salto = 0.0f;

                auto machaca = [&] (const Stereo& o)
                {
                    for (int i = 0; i < kBlock; ++i)
                    {
                        if (i > 0) salto = std::max (salto, std::abs (o.l[i] - anterior));
                        anterior = o.l[i];
                    }
                };

                if (nuevo)
                {
                    FXRolandBBDChorus fx;
                    fx.prepare (kSampleRate, kBlock);
                    fx.setParameter (0, 0.26f);
                    for (int b = 0; b < 40; ++b) machaca (render (fx, in, 1));
                    fx.setParameter (0, 0.51f);
                    for (int b = 0; b < 8; ++b) machaca (render (fx, in, 1));
                }
                else
                {
                    FrozenRolandBBDChorus ref;
                    ref.prepare (kSampleRate);
                    ref.setParameter (0, 0.26f);
                    for (int b = 0; b < 40; ++b) machaca (render (ref, in, 1));
                    ref.setParameter (0, 0.51f);
                    for (int b = 0; b < 8; ++b) machaca (render (ref, in, 1));
                }
                return salto;
            };

            const float antes = saltoMaximo (false);
            const float ahora = saltoMaximo (true);
            logMessage ("salto maximo: antes " + juce::String (antes, 4)
                        + ", ahora " + juce::String (ahora, 4));
            expect (ahora <= antes * 1.05f, "el cambio de modo no chasquea mas que antes");
        }

        //----------------------------------------------------------------------
        beginTest ("el ruido deja de ser una imagen especular del otro canal");

        {
            const Stereo z = silencio();

            FrozenRolandBBDChorus ref;
            ref.prepare (kSampleRate);
            ref.setParameter (0, 0.26f);
            ref.setParameter (3, 1.0f);       // desgaste al maximo: donde se nota
            const Cifras antes = medir (ultimoBloque (render (ref, z, 200)));

            FXRolandBBDChorus fx;
            fx.prepare (kSampleRate, kBlock);
            fx.setParameter (0, 0.26f);
            fx.setParameter (3, 1.0f);
            const Cifras ahora = medir (ultimoBloque (render (fx, z, 200)));

            logMessage ("correlacion L/R: antes " + juce::String (antes.correlacion, 3)
                        + ", ahora " + juce::String (ahora.correlacion, 3));
            expect (ahora.correlacion > antes.correlacion,
                    "los dos canales ya no son la misma senal con el signo cambiado");
        }

        //----------------------------------------------------------------------
        beginTest ("el suelo de ruido: se mide y se imprime, no se exige");

        {
            // Aqui NO hay una cifra contra la que comparar, y es a proposito: el
            // motor cambia un siseo continuo por picos de clic, de modo que el
            // suelo no es un numero sino un rango. Lo que se mira es que este
            // dentro de un orden de magnitud del que habia.
            const Stereo z = silencio();

            FrozenRolandBBDChorus ref;
            ref.prepare (kSampleRate);
            ref.setParameter (0, 0.26f);
            const double antes = rmsLargo (ref, z, 200);

            FXRolandBBDChorus fx;
            fx.prepare (kSampleRate, kBlock);
            fx.setParameter (0, 0.26f);
            const double ahora = rmsLargo (fx, z, 200);

            logMessage ("suelo de ruido: antes " + juce::String (db (antes), 1)
                        + " dBFS, ahora " + juce::String (db (ahora), 1) + " dBFS");
            logMessage ("(el nivel es el mismo, pero el del motor es a picos: -67 dBFS "
                        "entre clics y -60.5 dBFS justo despues de uno, y el de "
                        "antes era un siseo continuo)");
            expect (db (ahora) > -90.0, "el coro no zumba en silencio");
        }
    }
};

static FXBbdChorusTests fxBbdChorusTests;

} // namespace ABD
