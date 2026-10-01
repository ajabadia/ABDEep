#include "FXHybridReverb.h"
#include <algorithm>

namespace ABD
{
    FXHybridReverb::FXHybridReverb(int typeVal) : type(typeVal)
    {
        reverb = std::make_unique<FXSimpleReverb>(1); // Hall
        
        if (type == 23)
            flanger = std::make_unique<FXFlanger>();
        else if (type == 24)
            chorus = std::make_unique<FXChorus>();
        else if (type == 25)
            delay = std::make_unique<FXDelay>();
        
        reset();
    }

    void FXHybridReverb::prepare(double sampleRate, int samplesPerBlock)
    {
        reverb->prepare(sampleRate, samplesPerBlock);
        
        if (flanger)  flanger->prepare(sampleRate, samplesPerBlock);
        if (chorus)   chorus->prepare(sampleRate, samplesPerBlock);
        if (delay)    delay->prepare(sampleRate, samplesPerBlock);

        tempBuffer.setSize(2, samplesPerBlock, false, false, true);
    }

    void FXHybridReverb::setParameter(int index, float value)
    {
        value = std::clamp(value, 0.0f, 1.0f);
        
        // Parámetros 0-5: Modulación / Delay
        if (index < 6)
        {
            if (type == 23 && flanger) // flangVerb
            {
                switch (index)
                {
                    case 0: flanger->setParameter(0, value); break; // speed
                    case 1: flanger->setParameter(1, value); break; // depth
                    case 2: flanger->setParameter(3, value); break; // delay -> base delay
                    case 4: flanger->setParameter(2, value); break; // feed -> feedback
                }
            }
            else if (type == 24 && chorus) // chorusVerb
            {
                switch (index)
                {
                    case 0: chorus->setParameter(0, value); break; // speed
                    case 1: chorus->setParameter(1, value); break; // depth
                    case 4: chorus->setParameter(2, value); break; // wave -> feedback
                }
            }
            else if (type == 25 && delay) // delayVerb
            {
                switch (index)
                {
                    case 0: // time
                        delay->setParameter(1, value); // time left
                        delay->setParameter(2, value); // time right
                        break;
                    case 3: delay->setParameter(3, value); break; // feedback
                    case 5: delay->setParameter(0, value); break; // balance -> delay mix
                }
            }
        }
        // Parámetros 6-11: Reverb
        //
        // El bloque de reverb del hibrido esta en el MISMO orden que los cinco
        // primeros mandos de un Hall (`FXSimpleReverb(1)`): preDelay, decay,
        // size, damping y --el quinto-- lo que en la Hall seria diffusion. O sea
        // que el mando 6 va al 0, el 7 al 1, y asi hasta el 10 al 4.
        //
        // ESTO ESTUVO CRUZADO. El reparto anterior mandaba 6->1, 7->0, 8->4,
        // 9->2 y 10->3, o sea que preDelay movia el decay, decay movia el
        // pre-retardo, size movia la difusion, damping movia el tamano y loCut
        // movia el damping: cuatro de los cinco knobs acababan en un control que
        // no era el suyo. El de tamano es ademas el que mas se nota, porque
        // `setSize` redimensiona los conbs y borra la cola, asi que el mando de
        // size estaba haciendo eso cada vez que se movia.
        //
        // OJO: el quinto mando del panel es loCut, que el motor no tiene (el
        // motor no tiene ni loCut ni hiCut). Sigue yendo a diffusion, que es lo
        // que hacia el reparto viejo y la unica manera de que el quinto mando
        // no se quede muerto. El wet/dry de este efecto NO es el del mando 11
        // de la reverb: el 11 es el mix del hibrido entero, que se mezcla al
        // final de `process`.
        else
        {
            switch (index)
            {
                case 6:  reverb->setParameter(0, value); break; // preDelay
                case 7:  reverb->setParameter(1, value); break; // decay
                case 8:  reverb->setParameter(2, value); break; // size    -> roomSize
                case 9:  reverb->setParameter(3, value); break; // damping
                case 10: reverb->setParameter(4, value); break; // loCut    -> diffusion
                case 11: mix = value; break;                    // mix
            }
        }
    }

    void FXHybridReverb::reset()
    {
        reverb->reset();
        if (flanger)  flanger->reset();
        if (chorus)   chorus->reset();
        if (delay)    delay->reset();
        tempBuffer.clear();
    }

    juce::String FXHybridReverb::getEffectName() const
    {
        if (type == 23) return "FlangVerb";
        if (type == 24) return "ChorusVerb";
        if (type == 25) return "DelayVerb";
        return "HybridReverb";
    }

    void FXHybridReverb::process(const float* inL, const float* inR,
                                 float* outL, float* outR, int numSamples)
    {
        // Asegurar que el buffer temporal sea lo suficientemente grande
        if (tempBuffer.getNumSamples() < numSamples)
            tempBuffer.setSize(2, numSamples, false, false, true);

        float* tempL = tempBuffer.getWritePointer(0);
        float* tempR = tempBuffer.getWritePointer(1);

        // 1. Procesar Modulador / Delay primero
        if (flanger)
            flanger->process(inL, inR, tempL, tempR, numSamples);
        else if (chorus)
            chorus->process(inL, inR, tempL, tempR, numSamples);
        else if (delay)
            delay->process(inL, inR, tempL, tempR, numSamples);
        else
        {
            std::copy(inL, inL + numSamples, tempL);
            std::copy(inR, inR + numSamples, tempR);
        }

        // 2. Procesar Reverb sobre la salida del modulador
        reverb->process(tempL, tempR, outL, outR, numSamples);

        // 3. Mezclar Dry/Wet final del efecto híbrido
        for (int s = 0; s < numSamples; ++s)
        {
            outL[s] = inL[s] * (1.0f - mix) + outL[s] * mix;
            outR[s] = inR[s] * (1.0f - mix) + outR[s] * mix;
        }
    }
}
