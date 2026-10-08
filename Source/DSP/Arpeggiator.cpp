#include "Arpeggiator.h"

#include <algorithm>
#include <cmath>
#include <numeric>

namespace ABD
{
    //==============================================================================
    void Arpeggiator::prepare(double rate)
    {
        sampleRate = rate > 0.0 ? rate : 44100.0;
        stepSamples = sampleRate / stepRateHz;
        samplesToNextStep = 0.0;
        stepIndex = 0;
        heldCount = 0;
        playCount = 0;
        poolCount = 0;
        pendingCount = 0;
        soundingCount = 0;
    }

    //==============================================================================
    void Arpeggiator::noteOn(int note, float velocity)
    {
        // Una nota repetida no duplica la entrada: si el mismo numero vuelve a
        // pulsar, lo que se actualiza es la velocidad, no el orden del ciclo.
        for (int i = 0; i < heldCount; ++i)
        {
            if (held[i].note == note)
            {
                held[i].velocity = velocity;
                goto anadida;
            }
        }

        if (heldCount >= kMaxHeld)
            return;

        held[heldCount] = { note, velocity };
        ++heldCount;

    anadida:
        playOrder[playCount < kMaxHeld ? playCount : kMaxHeld - 1] = { note, velocity };
        if (playCount < kMaxHeld)
            ++playCount;

        // KEY SYNC (NRPN 159): pulsar una tecla devuelve el ciclo al primer
        // paso. Es lo que hace el interruptor del panel y no lo hace el reloj.
        if (keySync)
            resetStepCounter();

        buildPool();
    }

    //==============================================================================
    void Arpeggiator::noteOff(int note)
    {
        // Con HOLD enclavado, soltar la tecla no quita la nota del ciclo: sigue
        // sonando. Es lo que hace el interruptor TAP/HOLD del panel.
        if (!hold)
        {
            for (int i = 0; i < heldCount; ++i)
            {
                if (held[i].note == note)
                {
                    held[i] = held[heldCount - 1];
                    --heldCount;
                    break;
                }
            }
        }

        for (int i = 0; i < playCount; ++i)
        {
            if (playOrder[i].note == note)
            {
                playOrder[i] = playOrder[playCount - 1];
                --playCount;
                break;
            }
        }

        buildPool();

        if (heldCount == 0)
            resetStepCounter();
    }

    //==============================================================================
    void Arpeggiator::allNotesOff()
    {
        // SOLO LA LISTA DE NOTAS. Lo que este sonando y lo que el gate tenga
        // pendiente NO se toca aqui: los apagados los emite `generate()` a traves
        // de `apagarTodo` en el bloque siguiente, cuando ve que no queda ninguna
        // nota retenida. Vaciar esos contadores desde aqui sin emitir nada
        // dejaba notas colgadas: se perdia el apagado y no volvia a llegar.
        heldCount = 0;
        playCount = 0;
        poolCount = 0;
        resetStepCounter();
    }

    //==============================================================================
    void Arpeggiator::resetStepCounter()
    {
        stepIndex = 0;
        samplesToNextStep = 0.0;
    }

    //==============================================================================
    /**
     * El conjunto de notas que recorre el ciclo: las retenidas, ordenadas por
     * numero de nota y extendidas por las octavas del panel.
     *
     * Se recalcula en cada `noteOn`/`noteOff` y no en cada paso, que es cuando
     * cambia el conjunto. El orden es el de la tabla de modos del manual
     * (arp-sequencer.md:30-42), y no el de pulsacion: "As Played" (9) es el
     * unico que usa `playOrder`.
     */
    void Arpeggiator::buildPool()
    {
        poolCount = 0;
        if (heldCount <= 0)
            return;

        HeldNote ordenadas[kMaxHeld];
        std::copy(held, held + heldCount, ordenadas);
        std::sort(ordenadas, ordenadas + heldCount,
                  [] (const HeldNote& a, const HeldNote& b) { return a.note < b.note; });

        const int cap = (int) std::size(pool);
        for (int o = 0; o < octaveCount; ++o)
        {
            for (int i = 0; i < heldCount && poolCount < cap; ++i)
            {
                if (ordenadas[i].note + 12 * o > 127)
                    continue;   // el byte MIDI no da para octavas por encima de la maxima
                pool[poolCount++] = { ordenadas[i].note + 12 * o, ordenadas[i].velocity };
            }
        }
    }

    //==============================================================================
    /**
     * Las notas de UN paso, en el orden que le toca a este modo.
     *
     * Los once modos salen de la tabla del manual (arp-sequencer.md:30-42). Lo
     * que se conserva aqui es lo que el manual define con precision: el recorrido
     * y, en los modos de alternancia, que se alterna el extremo mas bajo con el
     * mas alto y ahi sigue. Las inversiones (3, 4, 5) delatan que el acorde se
     * pone al derecho y luego se le da la vuelta; aqui se hacen reflejando el
     * orden, que es lo unico que se puede reconstruir sin el acorde original.
     *
     * El 8 es el unico que tira de un azar, y por eso `generate` no es `const`.
     */
    int Arpeggiator::fillStepNotes(int step, HeldNote* out, int maxNotes)
    {
        const int n = poolCount;
        if (n <= 0)
            return 0;

        const int cap = (std::min) (maxNotes, kMaxNotesPerStep);
        // El pool ya va de menor a mayor, asi que el indice ES el orden.
        const auto delPool = [&] (int i) { return pool[i]; };

        // UN ACORDE DE UNA SOLA NOTA. `periodo` es `2*n - 2`, que con una
        // sola nota vale CERO, y `step % periodo` es una division entera: el
        // proceso muere con 0xC0000094. No es un caso raro ni exotico, es el
        // arpegio de UNA nota, que es lo que hace un patch con arp_mode = 2 y
        // una sola tecla pulsada. Con una nota no hay hacia donde subir ni
        // bajar, asi que todos los modos quedaln en la misma nota y lo unico
        // que se puede decir de ellos es que la reproducen.
        if (n == 1)
        {
            for (int i = 0; i < cap; ++i)
                out[i] = delPool (0);
            return (std::min) (n, cap);
        }

        switch (modeIndex)
        {
            case 0:     // Up: de menor a mayor, y vuelta a empezar.
            case 10:    // Chord: todas a la vez, que es "menor a mayor" todo junto.
                if (modeIndex == 10)
                {
                    const int cuantas = (std::min) (n, cap);
                    for (int i = 0; i < cuantas; ++i)
                        out[i] = delPool (i);
                    return cuantas;
                }
                out[0] = delPool (step % n);
                return 1;

            case 1:     // Down: de mayor a menor.
                out[0] = delPool (n - 1 - (step % n));
                return 1;

            case 2:     // Up&Down: sube y baja SIN repetir los extremos.
            {
                const int periodo = 2 * n - 2;
                const int p = (step % periodo) % periodo;
                out[0] = delPool (p < n ? p : periodo - p);
                return 1;
            }

            case 3:     // Up Inv: sube, y luego el acorde invertido vuelve a subir.
            case 5:     // Up&Down Inv: sube y baja atravesando las inversiones.
            {
                const int periodo = 2 * n - 2;
                const int p = (step % periodo) % periodo;
                const int indice = (modeIndex == 3) ? (step / periodo) % 2
                                                    : (p < n ? p : periodo - p);
                out[0] = delPool (indice % n);
                return 1;
            }

            case 4:     // Down Inv: baja, y luego la segunda inversion baja una octava.
            {
                const int periodo = 2 * n - 2;
                const int p = (step % periodo) % periodo;
                const int base = (p < n) ? (n - 1 - p) : (p - n + 1);
                out[0] = delPool (base % n);
                return 1;
            }

            case 6:     // Up Alt: el mas bajo, el mas alto, y ahi sigue.
                out[0] = delPool (((step % 2) == 0) ? (step / 2) % n
                                                  : (n - 1 - (step / 2) % n));
                return 1;

            case 7:     // Down Alt: el mas alto, el mas bajo, y ahi sigue.
                out[0] = delPool (((step % 2) == 0) ? (n - 1 - (step / 2) % n)
                                                  : (step / 2) % n);
                return 1;

            case 8:     // Random: el unico modo con azar.
                out[0] = delPool (random.nextInt (n));
                return 1;

            case 9:     // As Played: el orden de pulsacion, no el de nota.
            default:
            {
                if (playCount <= 0)
                {
                    out[0] = delPool (step % n);
                    return 1;
                }
                const int i = step % playCount;
                out[0] = { playOrder[i].note, playOrder[i].velocity };
                return 1;
            }
        }
    }

    //==============================================================================
    /**
     * Apaga lo que este sonando y lo que el gate tenga pendiente.
     *
     * EL APAGADO CUENTA ATRAS, NO UNA POSICION. Un gate de un paso largo puede
     * caer en un bloque que ya no es este: con posiciones absolutas dentro del
     * bloque, esa nota se queda colgada para siempre. Con "muestras que faltan"
     * el apagado sobrevive al limite del bloque y cae en la muestra exacta.
     */
    void Arpeggiator::apagarTodo(juce::MidiBuffer& out, int sample)
    {
        for (int i = 0; i < pendingCount; ++i)
            out.addEvent(juce::MidiMessage::noteOff(1, pending[i].note, 0.0f), sample);
        pendingCount = 0;

        for (int i = 0; i < soundingCount; ++i)
            out.addEvent(juce::MidiMessage::noteOff(1, sounding[i], 0.0f), sample);

        soundingCount = 0;
    }

    //==============================================================================
    void Arpeggiator::generate(juce::MidiBuffer& out, int numSamples)
    {
        if (numSamples <= 0)
            return;

        // Primero lo pendiente del bloque anterior: si cae aqui, se emite, y si
        // no, se descuenta y sigue esperando.
        int quedan = 0;
        for (int i = 0; i < pendingCount; ++i)
        {
            pending[i].samplesLeft -= numSamples;
            if (pending[i].samplesLeft >= 0)
            {
                pending[quedan++] = pending[i];
            }
            else
            {
                const int sample = numSamples + pending[i].samplesLeft;   // ya va mirando
                out.addEvent(juce::MidiMessage::noteOff(1, pending[i].note, 0.0f), sample);
                for (int k = 0; k < soundingCount; ++k)
                    if (sounding[k] == pending[i].note)
                    {
                        sounding[k] = sounding[soundingCount - 1];
                        --soundingCount;
                        break;
                    }
            }
        }
        pendingCount = quedan;

        if (!enabled || heldCount == 0)
        {
            if (soundingCount > 0)
                apagarTodo(out, 0);
            if (heldCount == 0)
                resetStepCounter();
            return;
        }

        stepSamples = sampleRate / stepRateHz;

        // El swing reparte el paso entre las dos notas de la pareja: una dura la
        // parte larga y la otra la corta, y las dos suman un paso entero. Con
        // swing 0 las dos mitades valen 0,5.
        const double r = 0.5 + 0.25 * (double) swingAmount;

        // LAS MARCAS DE PASO, QUE ANTES NO SE CONTABAN.
        //
        // `samplesToNextStep` son las muestras que faltan para la siguiente
        // marca. Antes era un acumulador de duraciones que se rellenaba al
        // final del bucle pero no se consultaba NUNCA, con lo que el bucle
        // emitia un paso en su primera vuelta siempre: uno por bloque de audio
        // en vez de uno por paso. A 8 Hz un paso son 5512.5 muestras y con
        // bloques de 256 el arpegio iba veintiuna veces mas rapido que el
        // tempo, y el apagado que programa el gate caia siempre despues del
        // retrigero del paso siguiente, que lo dejaba sin oir. O sea, el
        // destino 71 no se podia notar, y no era cosa de la matriz sino de
        // este reloj.
        //
        // La cuenta va en muestras, no en posicion de bloque, porque la
        // duracion de un paso es fraccionaria (a 8 Hz el paso corto son 2756.25
        // muestras) y si se redondeara en cada bloque los restos se sumarian
        // hasta mover el tempo. El epsilon del suelo es para que un resto
        // justo entero no produzca una vuelta de bucle de paso cero.
        static constexpr double kRedondeo = 1e-9;

        int    pos      = 0;
        double restante = samplesToNextStep;

        while (restante <= (double) (numSamples - pos))
        {
            // La marca cae dentro de este bloque (o justo en su borde).
            const double suelo = std::floor (restante + kRedondeo);
            pos      += (int) suelo;
            restante -= suelo;

            HeldNote notas[kMaxNotesPerStep];
            const int cuantas = fillStepNotes(stepIndex, notas, kMaxNotesPerStep);

            // Lo que dura ESTE paso: par si el indice es par, impar si no.
            const double duracion = stepSamples * ((stepIndex % 2 == 0) ? r : (2.0 - r));

            for (int i = 0; i < cuantas; ++i)
            {
                // Si la misma nota sigue sonando, se apaga antes: es un
                // retrigero, no una voz encima de otra.
                for (int k = 0; k < soundingCount; ++k)
                    if (sounding[k] == notas[i].note)
                        out.addEvent(juce::MidiMessage::noteOff(1, notas[i].note, 0.0f), pos);

                out.addEvent(juce::MidiMessage::noteOn(1, notas[i].note, notas[i].velocity), pos);

                if (soundingCount < kMaxNotesPerStep)
                    sounding[soundingCount++] = notas[i].note;

                // El gate es la fraccion del paso que dura la nota. Con 0 no se
                // programa ningun apagado: es el "0 = silence" del manual.
                if (gateFraction > 0.0f && pendingCount < kMaxPending)
                    // La cuenta atras va desde HOY: `pos` es donde empieza el
                    // paso y el apagado cae `duracion * gate` muestras despues.
                    pending[pendingCount++] =
                        { pos + (int) std::lround (duracion * gateFraction), notas[i].note };
            }

            // La marca siguiente cae `duracion` muestras despues de donde
            // empieza ESTA. Si cabe en lo que queda del bloque, el bucle la
            // recoge; si no, se queda guardada para la llamada que venga.
            restante = duracion;
            ++stepIndex;
        }

        // Y lo que se guarda para la llamada siguiente es la distancia que le
        // queda a la marca DESDE EL FINAL DE ESTE bloque, que es de donde
        // arranca la cuenta de la llamada siguiente. `restante` es la distancia
        // desde `pos`, asi que aqui se descuenta el trozo de bloque que queda
        // por recorrer: sin esto la cuenta no avanzaba en los bloques en los
        // que no cabia ninguna marca y el arpegiador se callaba a partir del
        // primer paso.
        samplesToNextStep = restante - (double) (numSamples - pos);
    }
}