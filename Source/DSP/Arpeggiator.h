#pragma once
#include <cstdint>
#include <JuceHeader.h>

namespace ABD
{
    /**
     * El arpegiador del DeepMind 12, portado al motor.
     *
     * POR QUE ESTA CLASE EXISTE. El destino 71 de la matriz ("Arp Gate" --
     * "Arpeggiator gate time", comun a las doce voces) estaba declarado y sin
     * nada que modular: el arpegiador del proyecto vive en `WebUI/js/
     * arpeggiator.js`, que es interfaz, no motor, asi que el byte se guardaba y
     * no pasaba nada. Cincuenta rutas de los 1024 presets de fabrica apuntan ahi.
     *
     * LO QUE DICE EL MANUAL (arp-sequencer.md, pp. 40-58) Y SE IMPLEMENTA AQUI:
     *
     *   - once modos (0-10), cada uno con el orden que de la tabla de la pagina;
     *   - el divisor de reloj de trece valores, en negras por pulso;
     *   - el gate time: 0 = silencio, 128 = medio paso, 255 = paso completo, o
     *     sea una fraccion del paso, y es justo lo que modula el destino 71;
     *   - el swing: 0 = recto (50%), 25 = maximo (75%), retrasando el segundo
     *     nota de cada pareja;
     *   - hold: enclava las notas pulsadas y sigue sonando al soltarlas;
     *   - key sync: reinicia el ciclo al pulsar una tecla;
     *   - octavas: de 1 a 6, extendiendo el ciclo.
     *
     * LO QUE NO SE IMPLEMENTA, Y POR QUE. El manual tiene ademas una capa de
     * PATRONES (NRPN 162: 32 de fabrica y 32 de usuario) que superpone velocity
     * y gate por paso. Esos datos no estan en ningun sitio de este repositorio,
     * y escribirlos seria inventarlos. Sin capa de patrones el arpegiador hace
     * exactamente lo que el manual dice que hace con `arp.pattern` = None: "all
     * steps use the panel gate-time fader value and played velocity".
     */
    class Arpeggiator
    {
    public:
        /** Nota retenida por el arpegiador: numero MIDI y como se toco. */
        struct HeldNote
        {
            int   note = 0;
            float velocity = 0.0f;
        };

        Arpeggiator() = default;

        void prepare(double sampleRate);

        // --- Los mandos del panel (NRPN 155-164) -----------------------------

        void setEnabled(bool on)             { enabled = on; }
        void setMode(int mode)               { modeIndex = juce::jlimit(0, 10, mode); }
        /** Tasa de pulsos por segundo YA DIVIDIDA (la tabla del reloj va antes). */
        void setStepRateHz(float hz)         { stepRateHz = juce::jlimit(0.01f, 500.0f, hz); }
        /** Fraccion del paso que dura la nota: 0 = muda, 1 = paso entero. */
        void setGate(float gate)             { gateFraction = juce::jlimit(0.0f, 1.0f, gate); }
        void setHold(bool on)                { hold = on; }
        void setKeySync(bool on)             { keySync = on; }
        /** 0-5 del manual: 1 a 6 octavas. */
        void setOctaves(int octaves)         { octaveCount = juce::jlimit(1, 6, octaves); }
        /** Swing normalizado 0..1: 0 = recto (50%), 1 = maximo (75%). */
        void setSwing(float swing)           { swingAmount = juce::jlimit(0.0f, 1.0f, swing); }

        // --- Las notas que entran y salen ------------------------------------

        void noteOn(int note, float velocity);
        void noteOff(int note);
        void allNotesOff();

        bool isActive() const  { return enabled && heldCount > 0; }
        bool isEnabled() const { return enabled; }
        int  getMode() const   { return modeIndex; }
        int  getHeldCount() const { return heldCount; }

        /**
         * La fraccion del paso que dura la nota ahora mismo, 0-1.
         *
         * Es el valor que el destino 71 mueve: `SynthEngine::processBlock` hace
         * `arpeggiator.setGate (jlimit (0, 1, arpGateBase + gateMod))` una vez
         * por bloque. Leerlo es lo que permite medir el efecto de una ruta
         * sobre el reloj del arpegiador sin tener que adivinarlo.
         */
        float getGate() const { return gateFraction; }

        /**
         * Escribe en `out` los note-on y note-off de ESTE bloque, con la
         * posicion de muestra exacta a la que caen.
         *
         * Se emiten como mensajes de MIDI de verdad y no disparando voces, para
         * que el reparto de voces, el robo por fase de caida y el timing
         * sample-accurate sean los de siempre, sin un camino nuevo que pueda
         * desincronizarse del otro.
         */
        void generate(juce::MidiBuffer& out, int numSamples);

    private:
        /** Cuantas notas suenan a la vez como maximo en el modo Chord. */
        static constexpr int kMaxNotesPerStep = 8;
        /** Notas retenidas: la polifonia del hardware son doce, pero el enclavado
            (hold) puede acumular mas pulsadas si se sostiene el pedal. */
        static constexpr int kMaxHeld = 64;

        void buildPool();
        int  fillStepNotes(int step, HeldNote* out, int maxNotes);
        void apagarTodo(juce::MidiBuffer& out, int sample);
        void resetStepCounter();

        bool enabled = false;
        bool hold = false;
        bool keySync = false;

        int   modeIndex = 0;
        int   octaveCount = 1;
        float stepRateHz = 8.0f;
        float gateFraction = 0.5f;   // el manual: 128 de 255 = medio paso
        float swingAmount = 0.0f;

        double sampleRate = 44100.0;
        double stepSamples = 5512.5;     // se recalcula en prepare/setStepRateHz
        double samplesToNextStep = 0.0;
        int    stepIndex = 0;

        HeldNote held[kMaxHeld];
        int      heldCount = 0;

        /** Orden de pulsacion, para el modo "As Played" (9). */
        HeldNote playOrder[kMaxHeld];
        int      playCount = 0;

        /** Notas del ciclo actual, ya extendidas por octavas y ordenadas. */
        HeldNote pool[kMaxHeld * 6];
        int      poolCount = 0;

        /**
         * Note-offs programados por el gate: cuantas muestras quedan para que
         * salte. Se cuenta en muestras y no en posicion de bloque porque un
         * gate largo cae en un bloque posterior, y una posicion de bloque no
         * sobrevive al cambio.
         */
        struct PendingOff { int samplesLeft; int note; };
        static constexpr int kMaxPending = 32;
        PendingOff pending[kMaxPending];
        int        pendingCount = 0;

        /** La ultima nota que se ha encendido, para apagarla al soltar. */
        int sounding[kMaxNotesPerStep];
        int soundingCount = 0;

        /** El modo 8 es el unico que tira de un azar, y genera() no es const. */
        juce::Random random;
    };
}
