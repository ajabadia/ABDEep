/**
 * @purpose Bit-exact parity test for the reverb family migration to ABDSharedCode.
 * @classification Test
 *
 * =============================================================================
 * QUE ES ESTE FICHERO, Y POR QUE VIVE EN EL CONSUMIDOR
 * =============================================================================
 *
 * `FXSimpleReverb` ya no tiene reverberador: el audio sale de
 * `abd::dsp::SchroederReverb` (ABDSharedCode/DspEffects) y los numeros de cada
 * variante de `abd::dsp::ReverbProfile`. Este test es el que demuestra que eso
 * no ha cambiado ni una muestra.
 *
 * Y por eso vive AQUI y no en ABDSharedCode: el modulo compartido no tiene el
 * efecto original a mano, y sin el no puede prometer 0 ulps con nadie. El
 * consumidor si lo tenia, asi que el consumidor es quien compara. Es el mismo
 * reparto que hay en ABDNeural/Tests para `DspReverb` contra `juce::Reverb`.
 *
 * =============================================================================
 * COMO ESTA HECHO, Y POR QUE CON DOS CAPAS
 * =============================================================================
 *
 * CAPA 1 — PARIDAD ESTRUCTURAL. `FrozenSchroederReverb`, mas abajo, es una copia
 * LITERAL del kernel que estaba en `FXSimpleReverb.cpp` y
 * `FXSimpleReverb_Process.cpp` antes de la extraccion: mismos conbs, mismos
 * allpass, mismos `%`, mismo pre-retardo mono, mismo factor 0.2, misma
 * inversion solo del canal izquierdo. Se compara muestra a muestra, canal por
 * canal, con las DIEZ variantes, y la diferencia tiene que ser de CERO ULPS.
 *
 * No se toca. Si algun dia hay que cambiarlo, se cambia junto con el motivo
 * escrito, porque su unico trabajo es ser la verdad de antes.
 *
 * CAPA 2 — VALORES CONGELADOS. La capa 1 compara el codigo nuevo con el viejo,
 * asi que si los dos se rompen a la vez, los dos se rompen juntos y el test
 * pasa. Por eso ademas hay un hash FNV-1a CONGELADO por variante: si el
 * comportamiento cambia, aunque cambien las dos copias, el hash no cuadra.
 *
 * =============================================================================
 * LO QUE ESTA CONGELADO A PROPOSITO Y NO ES UN FALLO
 * =============================================================================
 *
 *  - El pre-retardo real es `segundos * sampleRate * 0.2`, no
 *    `segundos * sampleRate`: pedir 100 ms retrasa 20 ms. Es un descuido del
 *    efecto publicado y la paridad obliga a reproducirlo.
 *  - "Reverse" (id 6) niega el canal IZQUIERDO y no el derecho. No es una
 *    inversion de fase, es un efecto Haas.
 *  - Mover el mando de tamano o el de pre-retardo REDIMENSIONA los conbs y eso
 *    borra la cola. Girar un mando durante una nota deja la reverb en silencio.
 *  - LA EXCEPCION UNICA, y hay una: a `damping == 0` EXACTO las dos
 *    implementaciones NO suenan igual, y no por un descuido. El congelado usa
 *    `damp1 = damping, damp2 = 1 - damping`, o sea `damp1 = 0` y `damp2 = 1`, con
 *    lo que el estado del peine se queda parado y retiene un valor viejo; el
 *    modulo compartido lo arreglo (`damp1 = 1, damp2 = 0`, el estado pasa) y a
 *    ese arreglo lo vigila la mutacion 6 del banco de DspEffects. El barrido de
 *    mandos declara ese caso y lo comprueba, en vez de exigir 0 ULPS a dos
 *    cosas que se sabe que no pueden dar 0 ULPS. En todo lo demas, 0 ULPS.
 *
 * OJO CON LA CIFRA DE ULPS DE ESA EXCEPCION: sale del orden de los miles de
 * millones y NO es una explosion. Los dos valores de la peor muestra son del
 * orden de milésimas y además cambian de signo, y el mapa monótono de
 * `ulpDistance` mete un abismo entre el cero. Por eso el fallo enseña los dos
 * valores en crudo al lado.
 */

#include <JuceHeader.h>

#include "FXSimpleReverb.h"
#include "FXHybridReverb.h"
#include "FXFlanger.h"
#include "FXChorus.h"
#include "FXDelay.h"
#include "DspEffects/DspSchroederReverb.h"
#include "DspEffects/profiles/ReverbProfile.h"

#include <cstring>
#include <vector>

namespace ABD
{

//==============================================================================
/**
    Distancia en ULPS entre dos floats.

    Solo se usa para CONTAR la diferencia cuando la hay, que es cuando el test
    ya ha fallado. La asercion es de igualdad exacta, no de tolerancia: este
    audio es determinista y no hay ninguna razon para perdonar ni un ULP.
*/
static juce::int64 ulpDistance (float a, float b) noexcept
{
    juce::int32 ia = 0, ib = 0;
    std::memcpy (&ia, &a, sizeof (ia));
    std::memcpy (&ib, &b, sizeof (ib));

    // Mapeo monotonico: los negativos van al otro lado del cero, en orden.
    juce::int64 oa = ia, ob = ib;
    if (oa < 0) oa = 0x80000000LL - oa;
    if (ob < 0) ob = 0x80000000LL - ob;

    return oa > ob ? oa - ob : ob - oa;
}

//==============================================================================
/** Senal de prueba determinista. LCG propio, para que no dependa de nada. */
struct DeterministicSignal
{
    explicit DeterministicSignal (juce::uint32 seed) : state (seed) {}

    juce::uint32 nextInt() noexcept
    {
        state = state * 1664525u + 1013904223u;
        return state;
    }

    /** En [-1, 1), Correlacionado con el ultimo, y con caidas periodicas. */
    float nextFloat() noexcept
    {
        const float noise = static_cast<float> (nextInt() >> 9) * (1.0f / 8388608.0f) - 1.0f;

        return last * 0.6f + noise * 0.4f;
    }

    float last = 0.0f;
    juce::uint32 state;
};

/** Hash FNV-1a de 32 bits sobre los bits crudos de las muestras. */
struct SampleHash
{
    void add (float v) noexcept
    {
        juce::uint32 bits = 0;
        std::memcpy (&bits, &v, sizeof (bits));

        hash ^= bits;
        hash *= 16777619u;
    }

    juce::uint32 value() const noexcept { return hash; }

    juce::uint32 hash = 2166136261u;   // FNV offset basis
};

//==============================================================================
/**
    COPIA CONGELADA del kernel de reverb anterior a la extraccion.

    NO EDITAR. Es literalmente lo que habia en:
        ABDEep/Source/DSP/FX/FXSimpleReverb.cpp
        ABDEep/Source/DSP/FX/FXSimpleReverb_Process.cpp
    con la clase renombrada a `FrozenSchroederReverb` y los miembros privados
    expuestos por `struct`. Se conservan a proposito, sin "mejorar": el modulo
    compartido usa `if (++pos >= size) pos = 0` donde este usa `%`, y aunque los
    dos son equivalentes para `size >= 1`, cambiarlo aqui seria cambiar la
    referencia contra la que se mide.
*/
struct FrozenSchroederReverb
{
    int reverbType = 1;
    double sampleRate = 44100.0;

    float decay = 0.5f;
    float preDelayTime = 0.0f;
    float damping = 0.5f;
    float diffusion = 0.5f;
    float roomSize = 0.5f;

    /** Solo para que el barrido sepa SI ha caído en el extremo que es la
        unica divergencia conocida. No se usa para medir nada. */
    float getDamping() const noexcept { return damping; }
    float getDecay()   const noexcept { return decay; }

    juce::AudioSampleBuffer preDelayBuffer;
    int preDelaySamples = 0;
    int preDelayWritePos = 0;

    struct CombFilter
    {
        float* buffer = nullptr;
        int bufferSize = 0;
        int writePos = 0;
        float feedback = 0.5f;
        float damp1 = 0.5f;
        float damp2 = 0.5f;
        float filterState = 0.0f;
    };

    CombFilter combL[4], combR[4];

    struct AllPassFilter
    {
        float* buffer = nullptr;
        int bufferSize = 0;
        int writePos = 0;
        float gain = 0.5f;
    };

    AllPassFilter allpassL[3], allpassR[3];

    juce::AudioBuffer<float> combBufferL;
    juce::AudioBuffer<float> combBufferR;
    juce::AudioBuffer<float> allpassBufferL;
    juce::AudioBuffer<float> allpassBufferR;

    explicit FrozenSchroederReverb (int reverbTypeIn) : reverbType (reverbTypeIn)
    {
        setDefaultsForType (reverbType);
        reset();
    }

    void setDefaultsForType (int type)
    {
        switch (type)
        {
            case 1:  decay = 0.7f;  damping = 0.4f;  diffusion = 0.7f;  roomSize = 0.8f;  preDelayTime = 0.1f;  break;
            case 2:  decay = 0.6f;  damping = 0.3f;  diffusion = 0.8f;  roomSize = 0.5f;  preDelayTime = 0.05f; break;
            case 3:  decay = 0.75f; damping = 0.2f;  diffusion = 0.9f;  roomSize = 0.6f;  preDelayTime = 0.05f; break;
            case 4:  decay = 0.3f;  damping = 0.6f;  diffusion = 0.5f;  roomSize = 0.3f;  preDelayTime = 0.0f;  break;
            case 5:  decay = 0.2f;  damping = 0.8f;  diffusion = 0.3f;  roomSize = 0.4f;  preDelayTime = 0.0f;  break;
            case 6:  decay = -0.3f; damping = 0.9f;  diffusion = 0.2f;  roomSize = 0.7f;  preDelayTime = 0.15f; break;
            case 22: decay = 0.85f; damping = 0.3f;  diffusion = 0.8f;  roomSize = 0.9f;  preDelayTime = 0.1f;  break;
            case 26: decay = 0.5f;  damping = 0.5f;  diffusion = 0.6f;  roomSize = 0.6f;  preDelayTime = 0.05f; break;
            case 27: decay = 0.35f; damping = 0.6f;  diffusion = 0.4f;  roomSize = 0.4f;  preDelayTime = 0.02f; break;
            case 28: decay = 0.65f; damping = 0.35f; diffusion = 0.7f;  roomSize = 0.7f;  preDelayTime = 0.08f; break;
            default: decay = 0.5f;  damping = 0.5f;  diffusion = 0.5f;  roomSize = 0.5f;  preDelayTime = 0.05f; break;
        }
    }

    int numParametersForType (int type) const
    {
        switch (type)
        {
            case 1: case 2: case 3: case 26: case 27: case 28: return 12;
            case 4: case 5: return 10;
            case 6:  return 9;
            case 22: return 5;
            default: return 12;
        }
    }

    void prepare (double newSampleRate)
    {
        sampleRate = std::max (1.0, newSampleRate);

        updateFilters();

        int maxPreDelay = static_cast<int> (sampleRate * 0.2);
        preDelayBuffer.setSize (1, maxPreDelay);
        preDelayBuffer.clear();
        preDelayWritePos = 0;
    }

    void updateCombParams()
    {
        for (int i = 0; i < 4; ++i)
        {
            combL[i].feedback = (decay < 0) ? 0.3f : decay * 0.9f;
            combL[i].damp1 = damping;
            combL[i].damp2 = 1.0f - damping;
            combR[i].feedback = combL[i].feedback;
            combR[i].damp1 = damping;
            combR[i].damp2 = 1.0f - damping;
        }

        for (int i = 0; i < 3; ++i)
        {
            allpassL[i].gain = diffusion * 0.7f;
            allpassR[i].gain = diffusion * 0.7f;
        }
    }

    void updateFilters()
    {
        float sizeScale = 0.5f + roomSize;

        int combLen[4] =
        {
            static_cast<int> (sampleRate * 0.0297 * sizeScale),
            static_cast<int> (sampleRate * 0.0331 * sizeScale),
            static_cast<int> (sampleRate * 0.0378 * sizeScale),
            static_cast<int> (sampleRate * 0.0411 * sizeScale)
        };

        for (int i = 0; i < 4; ++i)
        {
            combLen[i] = std::max (1, combLen[i]);
            combLen[i] += (i * 7);
        }

        combBufferL.setSize (4, combLen[0] + combLen[1] + combLen[2] + combLen[3] + 10);
        combBufferL.clear();
        combBufferR.setSize (4, combLen[0] + combLen[1] + combLen[2] + combLen[3] + 10);
        combBufferR.clear();

        size_t offset = 0;
        for (int i = 0; i < 4; ++i)
        {
            combL[i].buffer = combBufferL.getWritePointer (0) + offset;
            combL[i].bufferSize = combLen[i];
            combL[i].writePos = 0;
            combL[i].feedback = (decay < 0) ? 0.3f : decay * 0.9f;
            combL[i].damp1 = damping;
            combL[i].damp2 = 1.0f - damping;
            combL[i].filterState = 0.0f;

            combR[i].buffer = combBufferR.getWritePointer (0) + offset;
            combR[i].bufferSize = combLen[i];
            combR[i].writePos = 0;
            combR[i].feedback = (decay < 0) ? 0.3f : decay * 0.9f;
            combR[i].damp1 = damping;
            combR[i].damp2 = 1.0f - damping;
            combR[i].filterState = 0.0f;

            offset += combLen[i];
        }

        int apLen[3] =
        {
            static_cast<int> (sampleRate * 0.0051 * sizeScale),
            static_cast<int> (sampleRate * 0.0068 * sizeScale),
            static_cast<int> (sampleRate * 0.0083 * sizeScale)
        };

        int apTotal = 0;
        for (int i = 0; i < 3; ++i) apTotal += std::max (1, apLen[i]);

        allpassBufferL.setSize (3, apTotal + 10);
        allpassBufferL.clear();
        allpassBufferR.setSize (3, apTotal + 10);
        allpassBufferR.clear();

        offset = 0;
        for (int i = 0; i < 3; ++i)
        {
            allpassL[i].buffer = allpassBufferL.getWritePointer (0) + offset;
            allpassL[i].bufferSize = std::max (1, apLen[i]);
            allpassL[i].writePos = 0;
            allpassL[i].gain = diffusion * 0.7f;

            allpassR[i].buffer = allpassBufferR.getWritePointer (0) + offset;
            allpassR[i].bufferSize = std::max (1, apLen[i]);
            allpassR[i].writePos = 0;
            allpassR[i].gain = diffusion * 0.7f;

            offset += std::max (1, apLen[i]);
        }

        preDelaySamples = static_cast<int> (preDelayTime * sampleRate * 0.2);
        preDelaySamples = std::clamp (preDelaySamples, 0, static_cast<int> (sampleRate * 0.2));
    }

    void reset()
    {
        combBufferL.clear();
        combBufferR.clear();
        allpassBufferL.clear();
        allpassBufferR.clear();
        preDelayBuffer.clear();
        preDelayWritePos = 0;

        for (int i = 0; i < 4; ++i)
        {
            combL[i].writePos = 0;
            combL[i].filterState = 0.0f;
            combR[i].writePos = 0;
            combR[i].filterState = 0.0f;
        }

        for (int i = 0; i < 3; ++i)
        {
            allpassL[i].writePos = 0;
            allpassR[i].writePos = 0;
        }
    }

    float processComb (CombFilter& comb, float input)
    {
        int readPos = comb.writePos;
        float output = comb.buffer[readPos];

        comb.filterState = output * comb.damp1 + comb.filterState * comb.damp2;
        comb.buffer[comb.writePos] = input + comb.filterState * comb.feedback;
        comb.writePos = (comb.writePos + 1) % comb.bufferSize;

        return output;
    }

    float processAllPass (AllPassFilter& ap, float input)
    {
        int readPos = ap.writePos;
        float bufOut = ap.buffer[readPos];
        float output = -input + bufOut;
        ap.buffer[ap.writePos] = input + bufOut * ap.gain;
        ap.writePos = (ap.writePos + 1) % ap.bufferSize;
        return output;
    }

    void setParameter (int index, float value)
    {
        value = std::clamp (value, 0.0f, 1.0f);
        if (index >= numParametersForType (reverbType))
            return;

        const int type = reverbType;

        switch (type)
        {
            case 1: case 2: case 3: case 4: case 26: case 27: case 28:
                switch (index)
                {
                    case 0: preDelayTime = value; updateFilters(); break;
                    case 1: decay = value; updateCombParams(); break;
                    case 2: roomSize = value; updateFilters(); break;
                    case 3: damping = value; updateCombParams(); break;
                    case 4: diffusion = value; updateCombParams(); break;
                    default: break;
                }
                break;

            case 5:
                switch (index)
                {
                    case 0: preDelayTime = value; updateFilters(); break;
                    case 1: decay = value; updateCombParams(); break;
                    case 9: diffusion = value; updateCombParams(); break;
                    default: break;
                }
                break;

            case 6:
                switch (index)
                {
                    case 0: preDelayTime = value; updateFilters(); break;
                    case 1: decay = value; updateCombParams(); break;
                    case 3: diffusion = value; updateCombParams(); break;
                    default: break;
                }
                break;

            case 22:
                switch (index)
                {
                    case 1: decay = value; updateCombParams(); break;
                    case 3: preDelayTime = value; updateFilters(); break;
                    default: break;
                }
                break;

            default:
                break;
        }
    }

    void process (const float* inL, const float* inR,
                  float* outL, float* outR,
                  int numSamples)
    {
        for (int s = 0; s < numSamples; ++s)
        {
            float wetL = inL[s];
            float wetR = inR[s];

            if (preDelaySamples > 0)
            {
                int preDelayReadPos = preDelayWritePos - preDelaySamples;
                if (preDelayReadPos < 0)
                    preDelayReadPos += static_cast<int> (sampleRate * 0.2);

                float* preData = preDelayBuffer.getWritePointer (0);
                wetL = preData[preDelayReadPos];
                wetR = preData[preDelayReadPos];
                preData[preDelayWritePos] = (inL[s] + inR[s]) * 0.5f;
                preDelayWritePos = (preDelayWritePos + 1) % static_cast<int> (sampleRate * 0.2);
            }

            if (reverbType == 6)
                wetL = -wetL;

            float combSumL = 0.0f, combSumR = 0.0f;
            for (int i = 0; i < 4; ++i)
            {
                combSumL += processComb (combL[i], wetL);
                combSumR += processComb (combR[i], wetR);
            }
            combSumL *= 0.25f;
            combSumR *= 0.25f;

            for (int i = 0; i < 3; ++i)
            {
                combSumL = processAllPass (allpassL[i], combSumL);
                combSumR = processAllPass (allpassR[i], combSumR);
            }

            float reverbScale = (decay < 0) ? 0.5f : decay * 0.7f + 0.3f;

            outL[s] = combSumL * reverbScale;
            outR[s] = combSumR * reverbScale;
        }
    }
};

//==============================================================================
/** Las diez variantes, en el mismo orden que reparte `FXSlot_Factory`. */
struct ReverbVariant { int id; const char* name; juce::uint32 goldenHash; };

// Hashes congelados: FNV-1a de 32 bits sobre 9600 muestras por canal, con la
// senal determinista de abajo y los mandos de fabrica (sin tocar). Son lo que
// HACIA el efecto antes de la extraccion, calculado sobre la copia congelada.
static const ReverbVariant kReverbVariants[10] =
{
    {  1, "Hall",       2132374611u },
    {  2, "Plate",      1134545953u },
    {  3, "Rich Plate", 4054799533u },
    {  4, "Ambience",    656422065u },
    {  5, "Gated",       259132359u },
    {  6, "Reverse",    3210558055u },
    { 22, "Deep Verb",  3559794245u },
    { 26, "Chamber",    4278927235u },
    { 27, "Room",       2990123187u },
    { 28, "Vintage",    2372139259u }
};

static constexpr double kParitySampleRate = 44100.0;
static constexpr int    kParityBlock      = 256;
static constexpr int    kParitySamples    = 9600;

class FXReverbParityTests : public juce::UnitTest
{
public:
    FXReverbParityTests() : juce::UnitTest("FX Reverb Parity (ABDSharedCode)", "ABD") {}

    void runTest() override
    {
        parityAllVariantsAtDefaults();
        parityAllVariantsWithParameterSweeps();
        parityIsIndependentOfBlockSize();
        parityCoversTheHybridReverbs();
        hybridReverbKnobsReachTheirOwnControl();
        hybridReverbControlsAreNotInterchangeable();
        goldenHashesAreFrozen();
    }

private:
    //==========================================================================
    /**
        Lanza las dos implementaciones con la MISMA senal y compara.

        Devuelve la maxima diferencia en ULPS entre las dos, que tiene que ser
        cero. Se comparan los cuatro canales de golpe (L y R de cada una) y en
        cuanto aparece una diferencia se guardan las muestras para que el fallo
        diga QUE ha cambiado y no solo QUE ha cambiado.
    */
    struct Comparison
    {
        juce::int64 maxUlp = 0;
        int worstSample = -1;
        bool leftDiffers = false;
        bool rightDiffers = false;

        /** Las dos muestras en la PEOR DIFERENCIA, Y DE QUE CANAL.

            El canal va dentro porque comparar los dos con `max` y luego
            ensenar la IZQUIERDA a pelo es como sale un fallo que dice "live 0
            contra congelado 0" al lado de millones de ULPS: la diferencia era
            de la derecha, donde los dos son opuestos, y se ensenaba la
            izquierda, donde son identicos. Eso es justo el ruido que este
            mensaje existe para quitar, asi que el canal se elige con la misma
            comparacion que elige la muestra. */
        bool  worstIsRight = false;
        float worstLive    = 0.0f;
        float worstFrozen  = 0.0f;
    };

    static Comparison compare (FXSimpleReverb& live, FrozenSchroederReverb& frozen,
                               const std::vector<float>& inL, const std::vector<float>& inR)
    {
        Comparison result;

        const int numSamples = static_cast<int> (inL.size());

        std::vector<float> liveL (numSamples), liveR (numSamples);
        std::vector<float> frozenL (numSamples), frozenR (numSamples);

        for (int pos = 0; pos < numSamples; pos += kParityBlock)
        {
            const int block = std::min (kParityBlock, numSamples - pos);

            live.process   (inL.data() + pos, inR.data() + pos,
                            liveL.data() + pos, liveR.data() + pos, block);
            frozen.process (inL.data() + pos, inR.data() + pos,
                            frozenL.data() + pos, frozenR.data() + pos, block);
        }

        for (int s = 0; s < numSamples; ++s)
        {
            const juce::int64 ulpL = ulpDistance (liveL[s], frozenL[s]);
            const juce::int64 ulpR = ulpDistance (liveR[s], frozenR[s]);

            if (ulpL != 0) result.leftDiffers = true;
            if (ulpR != 0) result.rightDiffers = true;

            const juce::int64 worst = std::max (ulpL, ulpR);

            if (worst > result.maxUlp)
            {
                result.maxUlp = worst;
                result.worstSample = s;

                // EL PEOR DE LOS DOS, no el izquierdo por costumbre.
                result.worstIsRight = ulpR > ulpL;
                result.worstLive    = (result.worstIsRight ? liveR[s]    : liveL[s]);
                result.worstFrozen  = (result.worstIsRight ? frozenR[s] : frozenL[s]);
            }
        }

        return result;
    }

    //==============================================================================
    /** El fallo, SIEMPRE con los mismos datos.

        Cuantos ULPS, en que muestra, de que canal, los dos valores en crudo y
        que canales difieren. Estaba escrito dos veces, una en cada sitio, y las
        dos no decian lo mismo: la de los mandos de fabrica no ensinaba los
        valores, que es justo lo que resulto del otro dia. Un solo sitio, una
        sola forma, y si falta un dato se ve al anadirlo. */
    static juce::String describe (const Comparison& r)
    {
        return juce::String (r.maxUlp) + " ULPS de diferencia, la peor en la muestra "
             + juce::String (r.worstSample) + " del canal "
             + (r.worstIsRight ? "derecho" : "izquierdo")
             + " -- live " + juce::String (r.worstLive, 9)
             + " contra congelado " + juce::String (r.worstFrozen, 9)
             + (r.leftDiffers && r.rightDiffers ? " (difieren los dos canales)"
                : r.leftDiffers  ? " (difiere solo el izquierdo)"
                : r.rightDiffers ? " (difiere solo el derecho)"
                : "");
    }

    /** La misma senal para las dos, siempre, sinJUCE ni azar. */
    struct TestSignal
    {
        std::vector<float> left;
        std::vector<float> right;
    };

    static TestSignal makeSignal (juce::uint32 seed, int numSamples)
    {
        TestSignal signal;
        signal.left.resize (numSamples);
        signal.right.resize (numSamples);

        DeterministicSignal gen (seed);
        float lastL = 0.0f, lastR = 0.0f;

        for (int s = 0; s < numSamples; ++s)
        {
            lastL = lastL * 0.6f + gen.nextFloat() * 0.4f;
            lastR = lastR * 0.6f + gen.nextFloat() * 0.4f;

            signal.left[s]  = lastL;
            signal.right[s] = lastR;

            // Un impulso cada 977 muestras, para que el transitorio se vea a
            // simple vista cuando algo falle.
            if (s % 977 == 0)
                signal.left[s] += 0.5f;
        }

        return signal;
    }

    //==========================================================================
    /** CAPA 1a: las diez variantes con los mandos de fabrica, sin tocar nada. */
    void parityAllVariantsAtDefaults()
    {
        beginTest ("Reverb: las diez variantes suenan igual que antes (0 ULPS)");

        const auto signal = makeSignal (0x5eed1234u, kParitySamples);

        for (const auto& variant : kReverbVariants)
        {
            FXSimpleReverb live (variant.id);
            FrozenSchroederReverb frozen (variant.id);

            live.prepare (kParitySampleRate, kParityBlock);
            frozen.prepare (kParitySampleRate);

            const auto result = compare (live, frozen, signal.left, signal.right);

            const juce::String where = juce::String (variant.name) + " (id "
                                    + juce::String (variant.id) + ")";

            if (result.maxUlp != 0)
                expect (false, where + ": " + describe (result));
            else
                expect (true, where + ": 0 ULPS, identico bit a bit");
        }
    }

    //==========================================================================
    /**
        CAPA 1b: las diez variantes moviendo mandos.

        Esta es la capa que mas importa. Los mandos del panel NO tocan el motor
        por el camino corto: mapped 0 y 2 recalculan longitudes (y borran la
        cola), 1, 3 y 4 recalculan coeficientes, y ademas cada variante tiene su
        propio reparto. Si el mapeo se equivoca en un signo o en un indice, aqui
        se ve.
    */
    void parityAllVariantsWithParameterSweeps()
    {
        beginTest ("Reverb: barrido de mandos igual que antes (0 ULPS, salvo la amortiguacion a 0)");

        const auto signal = makeSignal (0x0badc0deu, kParitySamples);

        for (const auto& variant : kReverbVariants)
        {
            FXSimpleReverb live (variant.id);
            FrozenSchroederReverb frozen (variant.id);

            live.prepare (kParitySampleRate, kParityBlock);
            frozen.prepare (kParitySampleRate);

            // Un recorrido determinista por los mandos de la variante. Se
            // escriben a MANOS alternando las dos implementaciones, y se
            // incluyen los tres finales (0, 1 y 0.5) porque los extremos son
            // donde un mapeo mal puesto se delata: un retardo de 0 vacia la
            // cola y uno de 1 la alarga.
            for (int pass = 0; pass < 3; ++pass)
            {
                const float values[3] = { 0.0f, 1.0f, 0.5f };

                for (int p = 0; p < live.getNumParameters(); ++p)
                {
                    const float value = values[(p + pass) % 3];

                    live.setParameter   (p, value);
                    frozen.setParameter (p, value);
                }

                // Despues de cada pasada se comprueba: a mitad del recorrido el
                // estado ya no es el de fabrica, y mover un mando de tamano
                // DESPUES de uno de difusion tiene que sonar igual en las dos.
                const auto result = compare (live, frozen, signal.left, signal.right);

                const juce::String where = juce::String (variant.name) + " (id "
                                        + juce::String (variant.id) + ") pasada "
                                        + juce::String (pass);

                // ------------------------------------------------------------------
                // LA EXCEPCION UNICA, Y POR QUE ES LA AMORTIGUACION A CERO.
                //
                // El barrido escribe a proposito los tres finales, y en la pasada
                // 0 el mando 3 cae en 0.0. A `damping == 0` EXACTO las dos
                // implementaciones hacen cosas distintas y no por un descuido: el
                // congelado usa `damp1 = damping, damp2 = 1 - damping`, o sea
                // `damp1 = 0` y `damp2 = 1`, con lo que el estado del peine se
                // queda PARADO y se aginge un valor viejo. El modulo compartido
                // lo arreglo —`damp1 = 1, damp2 = 0`, el estado pasa— y ese
                // arreglo es el que vigila la mutacion 6 del banco de DspEffects.
                // Aqui entonces TIENEN que sonar distinto.
                //
                // QUE NO ES EL DECAY, Y SE SABE POR EL DISCRIMINANTE: en esa misma
                // pasada 0 el mando 1 pone `decay = 1.0`, y las variantes que
                // exponen `decay` pero NO exponen `damping` en el indice 3 (la 5
                // entre otras) NO divergen. Si fuera el decay, caerian tambien.
                //
                // Y QUE LA CIFRA EN ULPS NO ES LO QUE PARECE. En la peor muestra
                // los dos valores son 1,9e-4 y -2,4e-3: la diferencia real es de
                // milésimas y ademas cambia de signo. El numero enorme sale solo
                // porque el mapa monótonico de `ulpDistance` mete un abismo entre
                // el negativo y el positivo. Por eso el mensaje enseña los dos
                // valores en crudo: leer "dos mil millones de ULPs" sin ellos hace
                // pensar en una explosion, y no la hay.
                //
                // Que antes esto se caiga no era cobertura, era ruido. Ahora la
                // excepcion se DECLARA, y si alguien deshace el arreglo de la
                // amortiguacion, esta comprobacion se pone roja.
                // ------------------------------------------------------------------
                const bool dampingAlExtremo = (frozen.getDamping() == 0.0f);

                if (dampingAlExtremo)
                {
                    const juce::String medidas =
                          "live " + juce::String (result.worstLive, 9)
                        + " contra congelado " + juce::String (result.worstFrozen, 9)
                        + " (cambio de signo: de ahi el numero de ULPS)";

                    if (result.maxUlp == 0)
                        expect (false, where + ": con damping en 0 exacto las dos "
                                + "implementaciones suenan IGUALES, osea que el "
                                + "arreglo de la amortiguacion a cero ya no esta");
                    else
                        expect (true, where + ": divergencia CONOCIDA por el arreglo "
                                + "de la amortiguacion a 0, " + medidas);
                }
                else if (result.maxUlp != 0)
                    expect (false, where + ": " + describe (result));
                else
                    expect (true, where + ": 0 ULPS, identico bit a bit");
            }
        }
    }

    //==========================================================================
    /**
        El estado cruza de bloque a bloque, asi que el tamano de bloque no puede
        cambiar ni una muestra. Esto no lo hacia el codigo nuevo: es una
        propiedad que se pierde en cuanto alguien mete un `reset` por bloque, y
        esta es la unica vez que se comprueba de forma explicita.
    */
    void parityIsIndependentOfBlockSize()
    {
        beginTest ("Reverb: el tamano de bloque no cambia el audio");

        const auto signal = makeSignal (0x1234abcdu, kParitySamples);

        // Bloques de 1, 7, 64, 256, 1000 y el bloque entero. El 1 es el caso
        // limite: obliga a que el estado sobreviva a 9600 vueltas de bloque.
        const int blockSizes[] = { 1, 7, 64, 256, 1000, kParitySamples };
        constexpr int numBlockSizes = 6;

        std::vector<float> referenceL (kParitySamples);
        std::vector<float> referenceR (kParitySamples);

        for (const auto& variant : kReverbVariants)
        {
            for (int b = 0; b < numBlockSizes; ++b)
            {
                const int blockSize = blockSizes[b];

                FXSimpleReverb live (variant.id);
                live.prepare (kParitySampleRate, blockSize);

                std::vector<float> outL (kParitySamples), outR (kParitySamples);

                for (int pos = 0; pos < kParitySamples; pos += blockSize)
                {
                    const int n = std::min (blockSize, kParitySamples - pos);

                    live.process (signal.left.data() + pos, signal.right.data() + pos,
                                  outL.data() + pos, outR.data() + pos, n);
                }

                if (b == 0)
                {
                    referenceL = outL;
                    referenceR = outR;
                }
                else
                {
                    bool same = true;

                    for (int s = 0; s < kParitySamples; ++s)
                        if (outL[s] != referenceL[s] || outR[s] != referenceR[s])
                        {
                            same = false;
                            break;
                        }

                    expect (same, juce::String (variant.name) + ": el bloque de "
                            + juce::String (blockSize)
                            + " no da el mismo audio que el de 1 muestra");
                }
            }
        }
    }

    //==========================================================================
    /**
        `FXHybridReverb` (ids 23, 24, 25) envuelve a `FXSimpleReverb(1)`, asi
        que cualquier cambio en el motor se le oye. Va con su propia referencia
        congelada porque los hibridos tienen un wet/dry encima que no tiene el
        reverb solo.
    */
    void parityCoversTheHybridReverbs()
    {
        beginTest ("Reverb: los hibridos 23/24/25 siguen sonando");

        const auto signal = makeSignal (0xfeed0001u, kParitySamples);

        for (int type = 23; type <= 25; ++type)
        {
            FXHybridReverb hybrid (type);
            hybrid.prepare (kParitySampleRate, kParityBlock);

            // Los mandos, en el orden del panel.
            for (int p = 0; p < hybrid.getNumParameters(); ++p)
                hybrid.setParameter (p, (p * 37 % 101) / 100.0f);

            std::vector<float> outL (kParitySamples), outR (kParitySamples);

            for (int pos = 0; pos < kParitySamples; pos += kParityBlock)
            {
                const int n = std::min (kParityBlock, kParitySamples - pos);

                hybrid.process (signal.left.data() + pos, signal.right.data() + pos,
                                outL.data() + pos, outR.data() + pos, n);
            }

            bool finite = true;
            float peak = 0.0f;

            for (int s = 0; s < kParitySamples; ++s)
            {
                if (! std::isfinite (outL[s]) || ! std::isfinite (outR[s]))
                    finite = false;

                peak = std::max (peak, std::max (std::abs (outL[s]), std::abs (outR[s])));
            }

            // No se puede comparar muestra a muestra contra una referencia
            // congelada sin duplicar aqui los tres hibridos enteros. Lo que si se
            // comprueba es que siguen sonando y que el wet/dry sigue mezclando
            // los dos lados: un pico de 0 seria el sintoma de que el motor
            // murio, y un pico disparado seria que el mix dejo de existir.
            expect (finite, "hibrido " + juce::String (type) + ": salida no finita");
            expect (peak > 1.0e-4f,
                    "hibrido " + juce::String (type) + ": salida muda");
            expect (peak < 2.0f, "hibrido " + juce::String (type) + ": pico fuera de rango");
        }
    }

    //==========================================================================
    /**
        LOS CINCO MANDOS DE LA REVERB DEL HIBRIDO, UNO POR UNO.

        `FXHybridReverb` reparte sus doce mandos: 0-5 al modulador (flanger,
        chorus o delay) y 6-11 a la reverb, que es un `FXSimpleReverb(1)`. Los
        cinco de la reverb van en el MISMO orden que los de una Hall, asi que el
        reparto correcto es el de identidad: 6->0 preDelay, 7->1 decay, 8->2
        size, 9->3 damping y 10->4 diffusion.

        Y NO LO ESTABAN: iban 6->1, 7->0, 8->4, 9->2 y 10->3. Cuatro de los
        cinco knobs acababan en un control que no era el suyo, y el de tamano
        --que es el que mas se nota, porque `setSize` redimensiona los conbs y
        borra la cola-- movia la difusion.

        Se comprueba con AUDIO, no leyendo el `switch`. Para cada knob se monta
        la cadena que el hibrido DEBERIA tener --modulador, reverb con el reparto
        de arriba, y el wet/dry del final-- con la copia congelada del motor, y
        se compara muestra a muestra con lo que hace el hibrido de verdad. Si
        alguien vuelve a cruzar dos cables, el fallo dice cuantos ULPS, en que
        muestra y EN QUE CONTROL HA IDO EL KNOB DE VERDAD.
    */

    /** El primer mando de la reverb del hibrido: el 6. */
    static constexpr int kHybridReverbFirstKnob = 6;

    /** Cuantos mandos tiene la reverb del hibrido: cinco, del 6 al 10. */
    static constexpr int kHybridReverbKnobs = 5;

    /**
        El reparto correcto, escrito de forma explicita aunque sea el de
        identidad. Es la especificacion del test: si algun dia cambia, el fallo
        tiene que decir que se cambio a proposito.
    */
    static constexpr int kHybridReverbKnobToControl[kHybridReverbKnobs] = { 0, 1, 2, 3, 4 };

    /** Como se llama cada mando del panel, para que el fallo diga cual fallo. */
    static constexpr const char* kHybridReverbKnobName[kHybridReverbKnobs] =
        { "preDelay", "decay", "size", "damping", "loCut" };

    /** Y como se llama cada control del motor, que no es el mismo nombre. */
    static constexpr const char* kHybridReverbControlName[kHybridReverbKnobs] =
        { "preDelay", "decay", "size (roomSize)", "damping", "diffusion" };

    /**
        Valor base de cada mando: cinco numeros distintos y ninguno ni en 0 ni
        en 1.

        Distintos porque el cruce viejo se notaba precisamente en que dos knobs
        acababan con el MISMO numero en el motor. Si los cinco fueran iguales,
        el hibrido con los cables cruzados daria el mismo estado que el bien
        cableado, y este test pasaria sin comprobar nada. Ni 0 ni 1 porque los
        extremos son los casos raros: size en 0 deja los conbs en su longitud
        minima y preDelay en 0 vacia la cola entera.
    */
    static constexpr float kHybridReverbBaseline[kHybridReverbKnobs] =
        { 0.31f, 0.42f, 0.53f, 0.64f, 0.75f };

    /** Los dos extremos con los que se mueve cada knob en la prueba. */
    static constexpr float kHybridReverbLow  = 0.08f;
    static constexpr float kHybridReverbHigh = 0.93f;

    /** Los seis mandos del modulador, fijos: lo que se prueba es la reverb. */
    static constexpr float kHybridModulatorKnobs[6] = { 0.22f, 0.68f, 0.41f,
                                                        0.85f, 0.29f, 0.63f };

    //==========================================================================
    /**
        El modulador del hibrido, montado igual que lo monta `FXHybridReverb`.

        OJO: esto DUPLICA el reparto 0-5 de `FXHybridReverb::setParameter`, y a
        proposito. El hibrido mete un flanger, un chorus o un delay entre la
        entrada y la reverb, y la copia congelada no sabe hacer eso: si el
        modulador no se replica aqui, la referencia y el hibrido reciben senales
        distintas y el test no mide el reparto de los knobs. Si el reparto del
        MODULADOR cambia, este test falla tambien, y el mensaje lo dice.

        Lo que se prueba aqui, los knobs 6-10, no se toca al arreglar eso.
    */
    struct HybridModulator
    {
        int type;

        FXFlanger flanger;
        FXChorus  chorus;
        FXDelay   delay;

        explicit HybridModulator (int typeIn) : type (typeIn) {}

        void prepare()
        {
            flanger.prepare (kParitySampleRate, kParityBlock);
            chorus.prepare  (kParitySampleRate, kParityBlock);
            delay.prepare   (kParitySampleRate, kParityBlock);
        }

        void setKnob (int knob, float value)
        {
            switch (type)
            {
                case 23:
                    switch (knob)
                    {
                        case 0: flanger.setParameter (0, value); break;
                        case 1: flanger.setParameter (1, value); break;
                        case 2: flanger.setParameter (3, value); break;
                        case 4: flanger.setParameter (2, value); break;
                        default: break;
                    }
                    break;

                case 24:
                    switch (knob)
                    {
                        case 0: chorus.setParameter (0, value); break;
                        case 1: chorus.setParameter (1, value); break;
                        case 4: chorus.setParameter (2, value); break;
                        default: break;
                    }
                    break;

                default:
                    switch (knob)
                    {
                        case 0: delay.setParameter (1, value);
                                delay.setParameter (2, value); break;
                        case 3: delay.setParameter (3, value); break;
                        case 5: delay.setParameter (0, value); break;
                        default: break;
                    }
                    break;
            }
        }

        void process (const float* inL, const float* inR,
                      float* outL, float* outR, int numSamples)
        {
            if (type == 23)      flanger.process (inL, inR, outL, outR, numSamples);
            else if (type == 24) chorus.process  (inL, inR, outL, outR, numSamples);
            else                 delay.process   (inL, inR, outL, outR, numSamples);
        }
    };

    /** Corre algo en bloques de `kParityBlock`, que es como se llama a todo. */
    template <typename Fn>
    static void runInBlocks (Fn&& fn)
    {
        for (int pos = 0; pos < kParitySamples; pos += kParityBlock)
            fn (pos, std::min (kParityBlock, kParitySamples - pos));
    }

    /** El hibrido de verdad, con mix a 1 para que se vea la reverb sin mezcla. */
    static void runLiveHybrid (int type, const float* reverbKnobValues,
                               const std::vector<float>& inL, const std::vector<float>& inR,
                               std::vector<float>& outL, std::vector<float>& outR)
    {
        FXHybridReverb hybrid (type);
        hybrid.prepare (kParitySampleRate, kParityBlock);

        for (int p = 0; p < 6; ++p)
            hybrid.setParameter (p, kHybridModulatorKnobs[p]);

        for (int p = 0; p < kHybridReverbKnobs; ++p)
            hybrid.setParameter (kHybridReverbFirstKnob + p, reverbKnobValues[p]);

        // Mix a 1: `in * (1 - mix)` es un cero exacto, asi que lo que sale es la
        // reverb pelada. Es la unica forma de mirar lo que hay antes del wet/dry.
        hybrid.setParameter (11, 1.0f);

        runInBlocks ([&] (int pos, int n)
        {
            hybrid.process (inL.data() + pos, inR.data() + pos,
                            outL.data() + pos, outR.data() + pos, n);
        });
    }

    /**
        La cadena que el hibrido deberia tener, con el motor congelado.

        `knobToControl` va como parametro y no como constante porque el
        diagnostico de un fallo prueba las cinco redirecciones posibles de un
        knob para poder decir en que control fue de verdad.
    */
    static void runReferenceHybrid (int type, const int* knobToControl,
                                    const float* reverbKnobValues,
                                    const std::vector<float>& inL, const std::vector<float>& inR,
                                    std::vector<float>& outL, std::vector<float>& outR)
    {
        const int numSamples = static_cast<int> (inL.size());

        // 1. El modulador, con los seis primeros knobs del hibrido.
        HybridModulator modulator (type);
        modulator.prepare();

        for (int p = 0; p < 6; ++p)
            modulator.setKnob (p, kHybridModulatorKnobs[p]);

        std::vector<float> modL (numSamples), modR (numSamples);

        runInBlocks ([&] (int pos, int n)
        {
            modulator.process (inL.data() + pos, inR.data() + pos,
                               modL.data() + pos, modR.data() + pos, n);
        });

        // 2. La reverb, que es una Hall con el reparto que se supone correcto.
        FrozenSchroederReverb frozen (1);
        frozen.prepare (kParitySampleRate);

        for (int p = 0; p < kHybridReverbKnobs; ++p)
            frozen.setParameter (knobToControl[p], reverbKnobValues[p]);

        std::vector<float> revL (numSamples), revR (numSamples);

        runInBlocks ([&] (int pos, int n)
        {
            frozen.process (modL.data() + pos, modR.data() + pos,
                            revL.data() + pos, revR.data() + pos, n);
        });

        // 3. El wet/dry del final del `process` del hibrido, con el mismo mix.
        constexpr float mix = 1.0f;

        for (int s = 0; s < numSamples; ++s)
        {
            outL[s] = inL[s] * (1.0f - mix) + revL[s] * mix;
            outR[s] = inR[s] * (1.0f - mix) + revR[s] * mix;
        }
    }

    /** Diferencia en ULPS entre dos pares estéreo, con la peor muestra. */
    struct BufferComparison
    {
        juce::int64 maxUlp = 0;
        int worstSample = -1;
    };

    static BufferComparison compareStereo (const std::vector<float>& aL, const std::vector<float>& aR,
                                          const std::vector<float>& bL, const std::vector<float>& bR)
    {
        BufferComparison result;

        for (int s = 0; s < static_cast<int> (aL.size()); ++s)
        {
            const juce::int64 worst = std::max (ulpDistance (aL[s], bL[s]),
                                                ulpDistance (aR[s], bR[s]));

            if (worst > result.maxUlp)
            {
                result.maxUlp = worst;
                result.worstSample = s;
            }
        }

        return result;
    }

    void hybridReverbKnobsReachTheirOwnControl()
    {
        beginTest ("Reverb: los cinco knobs del hibrido llegan a su control");

        const auto signal = makeSignal (0xfeed0002u, kParitySamples);

        for (int type = 23; type <= 25; ++type)
        {
            for (int knob = 0; knob < kHybridReverbKnobs; ++knob)
            {
                for (int end = 0; end < 2; ++end)
                {
                    float knobValues[kHybridReverbKnobs];

                    for (int p = 0; p < kHybridReverbKnobs; ++p)
                        knobValues[p] = kHybridReverbBaseline[p];

                    knobValues[knob] = end == 0 ? kHybridReverbLow : kHybridReverbHigh;

                    std::vector<float> liveL (kParitySamples), liveR (kParitySamples);
                    std::vector<float> refL  (kParitySamples), refR  (kParitySamples);

                    runLiveHybrid    (type, knobValues, signal.left, signal.right, liveL, liveR);
                    runReferenceHybrid (type, kHybridReverbKnobToControl, knobValues,
                                        signal.left, signal.right, refL, refR);

                    const auto result = compareStereo (liveL, liveR, refL, refR);

                    const juce::String where = "hibrido " + juce::String (type) + ": el knob "
                        + juce::String (kHybridReverbKnobName[knob]) + " ("
                        + juce::String (kHybridReverbFirstKnob + knob) + ") a "
                        + juce::String (knobValues[knob], 2);

                    if (result.maxUlp != 0)
                    {
                        // DIAGNOSTICO, y solo cuando ya ha fallado: en que control
                        // ha ido el knob de verdad? Se prueban las cinco
                        // redirecciones y si ninguna encaja, es que hay mas de un
                        // knob cruzado. Asi el fallo dice donde esta el cable y no
                        // solo que el cable esta mal.
                        int landedOn = -1;

                        for (int candidate = 0; candidate < kHybridReverbKnobs; ++candidate)
                        {
                            int table[kHybridReverbKnobs];

                            for (int p = 0; p < kHybridReverbKnobs; ++p)
                                table[p] = kHybridReverbKnobToControl[p];

                            table[knob] = candidate;

                            std::vector<float> probeL (kParitySamples), probeR (kParitySamples);
                            runReferenceHybrid (type, table, knobValues,
                                                signal.left, signal.right, probeL, probeR);

                            if (compareStereo (liveL, liveR, probeL, probeR).maxUlp == 0)
                            {
                                landedOn = candidate;
                                break;
                            }
                        }

                        expect (false, where + ": " + juce::String (result.maxUlp)
                                + " ULPS de diferencia, la peor en la muestra "
                                + juce::String (result.worstSample) + ". Deberia mover "
                                + juce::String (kHybridReverbControlName
                                    [kHybridReverbKnobToControl[knob]])
                                + (landedOn >= 0
                                    ? juce::String (" y ha movido ") + kHybridReverbControlName[landedOn]
                                    : juce::String (", y no encaja con ninguno de los cinco controles")));
                    }
                    else
                    {
                        expect (true, where + ": 0 ULPS, llega a "
                                + juce::String (kHybridReverbControlName
                                    [kHybridReverbKnobToControl[knob]]));
                    }
                }
            }
        }
    }

    //==========================================================================
    /**
        LOS CINCO CONTROLES NO SON INTERCAMBIABLES.

        El cruce viejo no era un caos: eran cuatro knobs moviendo controles
        ajenos, y dos de ellos (size y damping) se DPIERON de un control que si
        tiene sentido oir. Eso es lo que lo hacia pasar desapercibido: dos knobs
        que suenan a "algo raro" en vez de a "no suena".

        Asi que ademas de comprobar que cada knob va a su control, se comprueba
        que los cinco controles suenan DISTINTOS entre si. Si dos controles
        distintos llegaran a dar el mismo audio, el test de arriba pasaria sin
        comprobar nada, y un cruce de cables volveria a colarse por debajo.
    */
    void hybridReverbControlsAreNotInterchangeable()
    {
        beginTest ("Reverb: los cinco controles del hibrido no suenan igual");

        const auto signal = makeSignal (0xfeed0003u, kParitySamples);

        for (int type = 23; type <= 25; ++type)
        {
            for (int i = 0; i < kHybridReverbKnobs; ++i)
            {
                for (int j = i + 1; j < kHybridReverbKnobs; ++j)
                {
                    float straight[kHybridReverbKnobs], swapped[kHybridReverbKnobs];

                    for (int p = 0; p < kHybridReverbKnobs; ++p)
                    {
                        straight[p] = kHybridReverbBaseline[p];
                        swapped[p]  = kHybridReverbBaseline[p];
                    }

                    straight[i] = kHybridReverbLow;   straight[j] = kHybridReverbHigh;
                    swapped[i]  = kHybridReverbHigh;  swapped[j] = kHybridReverbLow;

                    std::vector<float> straightL (kParitySamples), straightR (kParitySamples);
                    std::vector<float> swappedL  (kParitySamples), swappedR  (kParitySamples);

                    runReferenceHybrid (type, kHybridReverbKnobToControl, straight,
                                        signal.left, signal.right, straightL, straightR);
                    runReferenceHybrid (type, kHybridReverbKnobToControl, swapped,
                                        signal.left, signal.right, swappedL, swappedR);

                    const auto result = compareStereo (straightL, straightR, swappedL, swappedR);

                    expect (result.maxUlp != 0,
                             "hibrido " + juce::String (type) + ": los controles "
                             + juce::String (kHybridReverbControlName[i]) + " y "
                             + juce::String (kHybridReverbControlName[j])
                             + " suenan igual: el reparto de los knobs no se puede"
                               " comprobar con ellos y este test pasa porno comprobar nada");
                }
            }
        }
    }

    //==========================================================================
    /**
        CAPA 2: los hashes congelados.

        Comprueba el resultado CONTRA UN NUMERO, no contra otra implementacion.
        Es lo que salva el dia si un dia cambian a la vez el motor compartido y
        la copia de referencia: los dos seguirian cuadrando entre si, y esto no.

        Y EL HASH SE CALCULA SOBRE LA COPIA CONGELADA, no sobre `FXSimpleReverb`.
        Es deliberado, y al reves seria tautologia: si el hash lo genera el
        codigo nuevo, basta cambiar el codigo nuevo y regenerar el numero para
        que el test vuelva a pasar. Calculandolo sobre la referencia, el numero
        significa "esto es lo que hacia el efecto ORIGINAL", y la implementacion
        nueva solo tiene que acertar.
    */
    void goldenHashesAreFrozen()
    {
        beginTest ("Reverb: las diez variantes mantienen su hash congelado");

        const auto signal = makeSignal (0x5eed1234u, kParitySamples);

        for (const auto& variant : kReverbVariants)
        {
            FrozenSchroederReverb frozen (variant.id);
            frozen.prepare (kParitySampleRate);

            std::vector<float> outL (kParitySamples), outR (kParitySamples);

            for (int pos = 0; pos < kParitySamples; pos += kParityBlock)
            {
                const int n = std::min (kParityBlock, kParitySamples - pos);

                frozen.process (signal.left.data() + pos, signal.right.data() + pos,
                                outL.data() + pos, outR.data() + pos, n);
            }

            SampleHash hasher;
            for (int s = 0; s < kParitySamples; ++s)
            {
                hasher.add (outL[s]);
                hasher.add (outR[s]);
            }

            if (variant.goldenHash == 0)
            {
                // Hash sin rellenar: avisa por el log en vez de dejar pasar en
                // silencio. En cuanto se rellenen, esta rama no se vuelve a ver.
                logMessage ("HASH PENDIENTE " + juce::String (variant.name) + " (id "
                            + juce::String (variant.id) + ") = "
                            + juce::String (hasher.value()));
                expect (false, "hash congelado sin rellenar para "
                        + juce::String (variant.name));
            }
            else
            {
                expect (hasher.value() == variant.goldenHash,
                        juce::String (variant.name) + ": el hash es "
                        + juce::String ((juce::int64) hasher.value())
                        + " y deberia ser " + juce::String ((juce::int64) variant.goldenHash));
            }
        }
    }
};

static FXReverbParityTests fxReverbParityTests;

} // namespace ABD
