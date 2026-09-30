#include "FXSimpleReverb.h"
#include <algorithm>
#include <cmath>

/**
 * @purpose FXSimpleReverb lifecycle, parameter, and filter setup methods.
 *
 * ESTE FICHERO NO TIENE DSP. Todo el audio sale de `abd::dsp::SchroederReverb`,
 * en ABDSharedCode/DspEffects/DspSchroederReverb.h, que es una copia literal del
 * kernel que estaba aqui antes de la extraccion. Lo que queda es la traduccion
 * de los doce mandos normalizados del panel a los cinco controles del motor.
 *
 * La paridad bit a bit de esa traduccion la comprueba
 * `FXUnitTests_ReverbParity.cpp`, contra una copia congelada del kernel viejo.
 * Ese test es la red: si aqui se cambia un signo, un orden o un factor, falla.
 */

namespace ABD
{
    FXSimpleReverb::FXSimpleReverb(int reverbTypeIn)
        : reverbType (reverbTypeIn),
          variant (abd::dsp::ReverbProfile::findOrFallback (reverbTypeIn))
    {
        // Valores de fabrica de la variante. Antes salian de un `switch` con
        // diez casos; ahora salen de una tabla, que es justo lo que se queria
        // ganar al mover el motor: cambiar de fuente fue cambiar la tabla.
        decay         = variant->decay;
        damping       = variant->damping;
        diffusion     = variant->diffusion;
        roomSize      = variant->roomSize;
        preDelayTime  = variant->preDelaySeconds;

        // El motor nace a 44.1 kHz porque es su unico constructor posible, pero
        // el host llama a `prepare` antes de que suene nada, asi que las
        // longitudes definitivas se fijan ahi. Lo que si hay que hacer aqui es
        // el `setInvertLeft`: es lo unico del perfil que no se deduce de los
        // cinco numeros (un decay negativo NO implica invertir el izquierdo), y
        // sin esto la variante Reverse saldria sin su decorrelacion.
        engine.setInvertLeft (variant->invertLeft);
        engine.setDecay (decay);
        engine.setDamping (damping);
        engine.setDiffusion (diffusion);
        engine.setGeometry (roomSize, preDelayTime);

        reset();
    }

    juce::String FXSimpleReverb::getEffectName() const
    {
        return juce::String (variant->name);
    }

    void FXSimpleReverb::prepare(double newSampleRate, int samplesPerBlock)
    {
        (void) samplesPerBlock;
        engine.prepare (std::max (1.0, newSampleRate));

        // `prepare` del motor ya redimensiona, coeficienta y limpia con los
        // numeros que tenga cacheados. Se vuelven a aplicar los cinco para
        // fijarlos: el motor recien construido trae sus propios valores por
        // defecto (0.5 / 0.5 / 0.5 / 0.5 / 0.0), no los de la variante.
        engine.setInvertLeft (variant->invertLeft);
        engine.setDecay (decay);
        engine.setDamping (damping);
        engine.setDiffusion (diffusion);
        engine.setGeometry (roomSize, preDelayTime);
    }

    void FXSimpleReverb::updateCombParams()
    {
        // Los tres coeficientes van juntos al motor. El motor recalcula los
        // tres grupos (conbs y allpass) en cuanto se le toca cualquiera, asi que
        // llamarlo tres veces es lo mismo que llamarlo una con los cinco numeros
        // puestos: el estado final es identico.
        engine.setDecay (decay);
        engine.setDamping (damping);
        engine.setDiffusion (diffusion);
    }

    void FXSimpleReverb::updateFilters()
    {
        // Longitudes de conbs y de allpass, y pre-retardo: todo lo que depende
        // de la geometria va en una sola llamada, que es lo que hace el
        // `updateFilters` del original. Con `roomSize` y `preDelayTime` sueltos
        // habria dos reconstrucciones en vez de una (mismo audio, el doble de
        // trabajo de copiar buffers).
        engine.setGeometry (roomSize, preDelayTime);
    }

    int FXSimpleReverb::getNumParameters() const
    {
        return variant->numParameters;
    }

    void FXSimpleReverb::setParameter(int index, float value)
    {
        value = std::clamp (value, 0.0f, 1.0f);
        if (index >= getNumParameters())
            return;

        // Reparto mando -> control. Lo decide `ReverbProfile`, no este fichero:
        // cada variante tiene su propio orden (el hardware del DeepMind 12 no
        // es igual en las diez) y el -1 significa que ese mando no mueve nada
        // de este motor. Los mandos sin equivalente interno (mix, loCut, hiCut,
        // bassMult, spread, shape, spin, mod, tailGain, attack, density, rise,
        // preset, tone...) no aparecen aqui, y por eso no hacen nada: es lo que
        // llevaba anos haciendo el original.
        if (index == variant->paramIndexPreDelay)
        {
            preDelayTime = value;
            updateFilters();
        }
        else if (index == variant->paramIndexDecay)
        {
            decay = value;
            updateCombParams();
        }
        else if (index == variant->paramIndexRoomSize)
        {
            roomSize = value;
            updateFilters();
        }
        else if (index == variant->paramIndexDamping)
        {
            damping = value;
            updateCombParams();
        }
        else if (index == variant->paramIndexDiffusion)
        {
            diffusion = value;
            updateCombParams();
        }
    }

    void FXSimpleReverb::reset()
    {
        engine.reset();
    }

    void FXSimpleReverb::process (const float* inL, const float* inR,
                                  float* outL, float* outR,
                                  int numSamples)
    {
        // 100% wet (the FXSlot handles dry/wet mix). El motor es por MARCO
        // stereo y no por canal porque su pre-retardo es mono: se escribe una
        // vez por muestra con la media de L y R. Iterar aqui es lo que hace que
        // se escriba una vez y no dos (ver la cabecera del motor).
        for (int s = 0; s < numSamples; ++s)
            engine.processFrame (inL[s], inR[s], outL[s], outR[s]);
    }

} // namespace ABD
