#include "FXSlot.h"
#include <algorithm>

namespace ABD
{
    FXSlot::FXSlot()
    {
        std::fill(std::begin(params), std::end(params), 0.5f);
    }

    void FXSlot::prepare(double newSampleRate, int samplesPerBlock)
    {
        lastSampleRate = newSampleRate;
        lastSamplesPerBlock = samplesPerBlock;
        if (effect)
            effect->prepare(newSampleRate, samplesPerBlock);
        buffersPrepared = false;
    }

    void FXSlot::prepareBuffers(int numChannels, int numSamples)
    {
        if (buffersPrepared && wetBuffer.getNumSamples() >= numSamples
            && wetBuffer.getNumChannels() >= numChannels)
            return; // Ya preparado y suficientemente grande
        
        wetBuffer.setSize(numChannels, numSamples, false, false, true);
        buffersPrepared = true;
    }

    void FXSlot::setType(int newType)
    {
        newType = std::clamp(newType, 0, 56);
        if (newType == type && effect)
            return; // Mismo tipo, no recrear
        
        type = newType;
        
        if (type == 0)
        {
            effect.reset(); // Bypass
            return;
        }
        
        effect = createEffect(type);
        if (effect)
        {
            effect->prepare(lastSampleRate, lastSamplesPerBlock); // Auto-prepare with stored values
            syncParameters();
        }
    }

    void FXSlot::setParameter(int index, float value)
    {
        if (index >= 0 && index < 12)
        {
            params[index] = std::clamp(value, 0.0f, 1.0f);
            if (effect && index < effect->getNumParameters())
                effect->setParameter(index, params[index]);
        }
    }

    void FXSlot::setGain(float newGain)
    {
        gain = std::clamp(newGain, 0.0f, 1.0f);
    }

    void FXSlot::setMix(float newMix)
    {
        mix = std::clamp(newMix, 0.0f, 1.0f);
    }

    void FXSlot::process(juce::AudioBuffer<float>& buffer, int numSamples)
    {
        if (!isActive())
            return;
        
        int numChannels = std::min(buffer.getNumChannels(), 2);
        if (numChannels == 0) return;
        
        // Usar buffer pre-alocado (evita alocaciones en audio thread)
        prepareBuffers(numChannels, numSamples);
        wetBuffer.clear();
        
        // `Fx N Parameters`: los parametros que el EFECTO declara modulables,
        // con la cantidad de la matriz. Va ANTES de procesar, porque el efecto
        // recibe un bloque entero de una vez.
        //
        // Y POR QUE ES UNA CONSTANTE POR BLOQUE Y NO MUESTRA A MUESTRA. Porque
        // `FXBase::process` recibe el bloque entero: aplicar el parametro dentro
        // del bucle de mezcla llegaria tarde (el efecto ya ha leido sus
        // parametros) y aplicarlo antes, en cada muestra, solo haria que el
        // ultimo valor valiera para todo el bloque. Con bloques de 128 muestras
        // a 48 kHz son 2,7 ms, un 1,3% del periodo de un LFO de 5 Hz: no se
        // oye. Si algun dia hace falta muestra a muestra, el sitio es un
        // virtual de `FXBase` que sume la modulacion dentro del efecto, no
        // esto.
        //
        // Y EL VALOR BASE NO SE TOCA. Se escribe en el efecto, no en `params[]`:
        // si se escribiera en `params[]`, la modulacion se acumularia bloque a
        // bloque y el parametro se iria de la mano.
        //
        // Y SE ESCRIBE SIEMPRE, TAMBIEN CON CANTIDAD CERO. Esto no es
        // optimizar de mas, es lo que hace que SOLTAR la modulacion devuelva el
        // sonido a donde estaba: con la cantidad a cero lo que se escribe es
        // `params[idx]`, o sea el valor base, y el efecto vuelve a el. La
        // version anterior solo escribia cuando habia cantidad, asi que al
        // bajar la profundidad a cero --o al borrar la ruta-- el efecto se
        // quedaba clavado en el ultimo valor modulated que vio, que es un
        // mando que ya no responde a nada.
        //
        // Con un efecto que no declara nada el bucle no llega a correr: lo
        // unico que se paga es la llamada virtual, una por bloque.
        if (effect)
        {
            int indices[8] = {};
            const int n = effect->getModulationParams(indices, 8);

            for (int i = 0; i < n; ++i)
            {
                const int idx = indices[i];

                if (idx >= 0 && idx < 12)
                    effect->setParameter(idx, std::clamp(params[idx] + paramMod, 0.0f, 1.0f));
            }
        }
        
        const float* inL = buffer.getReadPointer(0);
        const float* inR = (numChannels > 1) ? buffer.getReadPointer(1) : buffer.getReadPointer(0);
        float* outL = wetBuffer.getWritePointer(0);
        float* outR = (numChannels > 1) ? wetBuffer.getWritePointer(1) : wetBuffer.getWritePointer(0);
        
        // Procesar el efecto
        effect->process(inL, inR, outL, outR, numSamples);
        
        // Aplicar ganancia y mezcla wet/dry
        for (int ch = 0; ch < numChannels; ++ch)
        {
            const float* dry = buffer.getReadPointer(ch);
            float* wet = wetBuffer.getWritePointer(ch);
            float* out = buffer.getWritePointer(ch);
            
            for (int s = 0; s < numSamples; ++s)
            {
                // `Fx N Level` entra AQUI, y no antes, porque este es el punto
                // donde el nivel se aplica de verdad. Va muestra a muestra, que
                // es lo que hace que un LFO en la ganancia no de escalones: el
                // mismo bucle que ya recorre el bloque, sin trabajo nuevo.
                const float nivel = gain * (1.0f + (levelMod != nullptr ? levelMod[s] : 0.0f));

                out[s] = dry[s] * (1.0f - mix) + wet[s] * mix * std::max(0.0f, nivel);
            }
        }
    }

    void FXSlot::setModulatorInput(const float* modL, const float* modR, int numSamples)
    {
        if (effect)
            effect->setModulatorInput(modL, modR, numSamples);
    }

    void FXSlot::setMatrixModulation(const float* level, float paramAmount, int numSamples)
    {
        // El puntero se guarda, no se copia: el motor lo rellena en su propio
        // bucle muestra a muestra, y copiarlo aqui seria trabajar en el hilo de
        // audio por algo que ya existe. El llamante garantiza que `level` tiene
        // al menos `numSamples` elementos, que es lo mismo que garantiza ya con
        // `setModulatorInput`.
        (void)numSamples;

        // `level` YA LLEVA la cantidad dentro: el motor escribe en el buffer lo
        // que devuelve `getModulationValue`, que es fuente por profundidad. Por
        // eso aqui no se multiplica otra vez por nada, y por eso el puntero a
        // nullptr es el unico "no modular".
        //
        // Y POR QUE SON DOS CANTIDADES Y NO UNA. Porque `Fx N Level` y `Fx N
        // Parameters` son DOS destinos: les puede llegar la modulacion de fuentes
        // distintas, con profundidades distintas, y si un solo numero las
        // atara. Un LFO en el nivel con un LFO en el feedback es el caso normal.
        levelMod = level;
        paramMod = paramAmount;
    }

    void FXSlot::reset()
    {
        if (effect)
            effect->reset();
    }

    void FXSlot::syncParameters()
    {
        if (!effect) return;
        int numParams = std::min(12, effect->getNumParameters());
        for (int i = 0; i < numParams; ++i)
            effect->setParameter(i, params[i]);
    }


}
