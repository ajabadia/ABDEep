#include "ControlSequencer.h"
#include <algorithm>
#include <cmath>

namespace ABD
{
    //==============================================================================
    /**
     * NEGRAS POR PASO de cada divisor de reloj del manual (arp-sequencer.md:85-109).
     *
     * La tabla del manual da el valor como razon en notas enteras --"Four whole
     * notes", "Sixteenth note"-- y aqui se convierte a negras, que es la unidad
     * con la que se trabaja: una negra dura 60/BPM segundos, y un paso de R
     * notas enteras son 4R negras.
     *
     * SOLO LOS DIEZSEIS PRIMEROS. El manual lista veinte y anota que el NRPN
     * llega a quince: "The NRPN range is 0-15 but the manual lists 20 entries".
     * Los cuatro de mas no tienen byte, asi que no se inventa su codigo.
     */
    float ControlSequencer::quartersPerStep(int div)
    {
        static const float quarters[16] = {
            16.0f,       // 0   4 notas enteras
            12.0f,       // 1   3 notas enteras
            8.0f,        // 2   2 notas enteras
            4.0f,        // 3   1 nota entera
            2.0f,        // 4   1/2
            1.5f,        // 5   3/8 (negra con puntillo)
            4.0f / 3.0f, // 6   1/3
            1.0f,        // 7   1/4
            0.75f,       // 8   3/16
            2.0f / 3.0f, // 9   1/6
            0.5f,        // 10  1/8
            0.375f,      // 11  3/32
            1.0f / 3.0f, // 12  1/12
            0.25f,       // 13  1/16 (el valor por defecto)
            3.0f / 16.0f,// 14  3/64
            1.0f / 6.0f  // 15  1/24
        };
        return quarters[div < 0 ? 0 : (div > 15 ? 15 : div)];
    }

    //==============================================================================
    void ControlSequencer::prepare(double rate)
    {
        sampleRate = rate > 0.0 ? rate : 44100.0;
        phase = 0.0;
        stepIndex = 0;
        corrio = false;
        // Y ARRANCA EN EL VALOR DE SU PASO. `targetValue` se inicializa a cero
        // como miembro, y solo se reescribe cuando la cabeza de pasos avanza: sin
        // esta linea el secuenciador se callaba un paso entero, hasta que el
        // primer salto, con el paso 1 puesto en el panel. Y el glide no servia
        // de nada durante ese primer paso, porque no habia de donde glidear.
        targetValue = steps[0];
        currentValue = steps[0];
        samplesPerStep = quartersPerStep(clockDivider) * 60.0 / masterBpm * sampleRate;
    }

    //==============================================================================
    void ControlSequencer::setStep(int stepOneBased, float bipolar)
    {
        if (stepOneBased < 1 || stepOneBased > 32)
            return;
        steps[stepOneBased - 1] = bipolar < -1.0f ? -1.0f : (bipolar > 1.0f ? 1.0f : bipolar);

        // EDITAR EL PASO POR EL QUE VA LA CABEZA SE NOTA YA. El objetivo solo
        // se refrescaba al dar la vuelta, con lo que cambiar un paso desde el
        // panel no cambiaba nada hasta el siguiente ciclo. El valor actual NO se
        // toca: de eso se encarga el glide, que es justamente lo que modula el
        // destino 72.
        if (stepOneBased - 1 == stepIndex)
            targetValue = steps[stepIndex];
    }

    //==============================================================================
    void ControlSequencer::reset()
    {
        stepIndex = 0;
        phase = 0.0;
        corrio = false;
        // El "key sync" vuelve al primer paso, asi que el objetivo tambien: si
        // no, el primer paso tras el reset sale con el valor del anterior.
        targetValue = steps[0];
    }

    //==============================================================================
    float ControlSequencer::nextSample()
    {
        if (!enabled)
        {
            currentValue = 0.0f;
            targetValue = 0.0f;
            return 0.0f;
        }

        const double duracionBase = quartersPerStep(clockDivider) * 60.0 / masterBpm * sampleRate;

        // El swing reparte el paso: una mitad larga y otra corta que suman el
        // paso entero. Con 0 las dos valen la mitad.
        const double r = 0.5 + 0.25 * (double) swingAmount;
        const double duracion = duracionBase * ((stepIndex % 2 == 0) ? r : (2.0 - r));

        phase += 1.0;
        if (phase >= duracion)
        {
            phase = 0.0;
            ++stepIndex;

            if (stepIndex >= length)
            {
                // Modo 1 del manual: "Key Sync On -- restarts on key press, does
                // NOT loop (plays once)". En el 0 y el 2 vuelve al primero.
                if (keyLoopMode == 1 && corrio)
                {
                    targetValue = 0.0f;
                }
                else
                {
                    stepIndex = 0;
                }
                corrio = true;
            }

            targetValue = steps[stepIndex];
        }

        // EL SLEW, QUE ES LO QUE MODULA EL DESTINO 72. El mando y la matriz se
        // suman antes de recortar, igual que los demas destinos de nivel.
        const float s = std::clamp(slewRate + slewMod, 0.0f, 1.0f);

        if (s <= 0.0f)
        {
            // 0 = salto seco, el equivalente a S&H del manual.
            currentValue = targetValue;
        }
        else
        {
            // La constante de tiempo del tope es un valor ELEGIDO, no del
            // manual: este solo dice que 255 es "very slow glides" y que
            // altos valores se acercan a la forma de un LFO. A un segundo por
            // paso el tope ya es audiblemente un glide largo sin ser un arrastre.
            const float tau = s * 1.0f;                       // segundos
            const float coef = 1.0f - std::exp(-1.0f / (float)(tau * sampleRate));
            currentValue += (targetValue - currentValue) * coef;
        }

        return currentValue;
    }
}
