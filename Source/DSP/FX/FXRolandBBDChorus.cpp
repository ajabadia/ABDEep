#include "FXRolandBBDChorus.h"

namespace ABD
{
    using Mode = abd::dsp::JunoBbdMode;
    using Profile = abd::dsp::JunoBbdJ106Profile;

    //--- Reparto de los cuatro mandos del slot ------------------------------//
    //
    // Los valores por defecto (0.0 / 0.3 / 0.5 / 0.3) son los que tenia el
    // slot, y estan elegidos para que el sonido por defecto no se mueva. Los
    // numeros de la maquina no se repiten aqui: salen del perfil.
    namespace
    {
        /** El 0.75 con el que el slot anterior limitaba el barrido. Se conserva
            porque el barrido medido (anchura de la banda modulada, 1.5-3 Hz en
            los dos) sale igual, y cambiarlo seria cambiar el coro sin motivo. */
        constexpr float kDepthScale = 0.75f;

        /** El mando de desgaste va de 0.25 a 1.0, no de 0 a 1. A 0 el motor se
            queda sin siseo, sin fuga y sin clics, que es un coro digital, y el
            slot 36 nunca estuvo tan limpio. */
        constexpr float kWearFloor = 0.25f;

        /** El 0.3 del mando de velocidad es la velocidad de fabrica del perfil,
            para que el valor por defecto suene como sonaba. A partir de ahi se
            abre una octava por lado. */
        constexpr float kRateAnchor = 0.3f;
    }

    FXRolandBBDChorus::FXRolandBBDChorus()
    {
        reset();
    }

    void FXRolandBBDChorus::prepare(double sampleRate, int /*samplesPerBlock*/)
    {
        engine.prepare(sampleRate);

        // El IC6 entero: seco 0.863 y mojado 1.257. Es lo que hace la maquina, y
        // es lo que reproduce el nivel del slot anterior con +0.04 dB medidos.
        engine.setMixerGains(Profile::value.gainDry, Profile::value.gainWet);
        engine.setMix(1.0f);

        // NO se vuelven a poner los valores por defecto del slot aqui: se reaplican
        // los que hay, que en el primer `prepare` son los de fabrica y en los
        // siguientes son los que haya puesto el usuario. `prepare()` tambien se
        // llama cuando cambia la frecuencia de muestreo, y en ese momento tirar
        // los mandos seria perder los ajustes a mitad de una sesion.
        applyAll();
    }

    void FXRolandBBDChorus::reset()
    {
        // OJO con el orden. `engine.reset()` pone los mandos de calibracion y los
        // valores por defecto DEL PERFIL, o sea que se come lo que este
        // envoltorio le haya pasado antes. Por eso el estado de audio se vacia
        // primero y los mandos del slot se reaplican despues desde la copia que
        // el envoltorio guarda. Al reves, un `reset()` en mitad de una nota
        // devuelve el coro a los numeros de fabrica.
        engine.reset();
        engine.setMixerGains(Profile::value.gainDry, Profile::value.gainWet);
        engine.setMix(1.0f);
        applyAll();
    }

    void FXRolandBBDChorus::applyAll()
    {
        applyMode();
        applyRate();
        engine.setDepth(paramDepth * kDepthScale);
        engine.setHissMultiplier(kWearFloor + (1.0f - kWearFloor) * paramWear);
    }

    void FXRolandBBDChorus::setParameter(int index, float value)
    {
        const float v = juce::jlimit(0.0f, 1.0f, value);

        switch (index)
        {
            case 0: // Mode: 0 = Off, 1 = I, 2 = II, 3 = I+II
            {
                const int mode = (int)(v * 3.999f);
                if (mode != currentMode)
                {
                    currentMode = mode;
                    applyMode();
                    // El LFO del motor es COMUNIDO por los dos canales, asi que
                    // cambiar de modo cambia su velocidad de fabrica y hay que
                    // reajustar el mando. Antes esto no hacia falta porque el
                    // mando de velocidad no existia.
                    applyRate();
                }
                break;
            }

            case 1: // Rate: alrededor de la velocidad de fabrica del modo
                paramRate = v;
                applyRate();
                break;

            case 2: // Depth
                paramDepth = v;
                engine.setDepth(paramDepth * kDepthScale);
                break;

            case 3: // Desgaste de la maquina (siseo + fuga + clics)
                paramWear = v;
                engine.setHissMultiplier(kWearFloor + (1.0f - kWearFloor) * paramWear);
                break;

            default: break;
        }
    }

    void FXRolandBBDChorus::applyMode()
    {
        switch (currentMode)
        {
            case 0:  engine.setMode(Mode::Off);       break;
            case 1:  engine.setMode(Mode::ChorusI);   break;
            case 2:  engine.setMode(Mode::ChorusII);  break;
            default: engine.setMode(Mode::ChorusBoth); break;
        }
    }

    void FXRolandBBDChorus::applyRate()
    {
        engine.setRate(modeFactoryRate(currentMode)
                       * std::pow(2.0f, (paramRate - kRateAnchor) * 2.0f));
    }

    float FXRolandBBDChorus::modeFactoryRate(int mode)
    {
        const auto& p = Profile::value;
        return mode == 2 ? p.rateII : (mode == 3 ? p.rateBoth : p.rateI);
    }

    void FXRolandBBDChorus::process(const float* inL, const float* inR,
                                    float* outL, float* outR,
                                    int numSamples)
    {
        // El motor procesa por MARCO y no por bloque, asi que da igual donde
        // corten los bloques: no hay estado a nivel de bloque.
        for (int i = 0; i < numSamples; ++i)
            engine.process(inL[i], inR[i], outL[i], outR[i]);
    }
}
