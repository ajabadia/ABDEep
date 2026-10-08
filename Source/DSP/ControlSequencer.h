#pragma once
#include <cstdint>

namespace ABD
{
    /**
     * El secuenciador de control del DeepMind 12, portado al motor.
     *
     * POR QUE ESTA CLASE EXISTE. El destino 72 de la matriz ("Seq Slew" --
     * "Control sequencer slew rate") estaba declarado y sin nada que modular,
     * y la fuente ya estaba en el enum de la matriz (`ModSource::
     * kControlSequencer`) sin que nadie la escribiera jamas: se podia elegir
     * "Ctrl Seq" como origen de una ruta y el valor era siempre cero. Veintiuna
     * rutas de los 1024 presets de fabrica apuntan al 72.
     *
     * LO QUE DICE EL MANUAL (arp-sequencer.md) Y SE IMPLEMENTA AQUI:
     *
     *   - es una FUENTE DE MODULACION, no un secuenciador de notas: sus pasos
     *     son bipolares y se enrutan a cualquier destino por la matriz;
     *   - el paso vale 1-255 y se decodifica como `valor - 128` (128 = cero);
     *   - la longitud va de 1 a 32 pasos (el byte 0-31 es la longitud menos uno);
     *   - el divisor de reloj tiene dieciseis valores confirmados por NRPN, y
     *     dividen el mismo BPM maestro que el arpegiador;
     *   - el swing va de 50% (0) a 75% (25);
     *   - los modos de reloj son tres: bucle, reinicio con la tecla, o ambos;
     *   - el slew suaviza el salto entre pasos: 0 es salto seco y 255 un
     *     gliding lentisimo. Es justo lo que modula el destino 72.
     */
    class ControlSequencer
    {
    public:
        ControlSequencer() = default;

        void prepare(double sampleRate);

        void setEnabled(bool on)     { enabled = on; }
        /** 0-15, el rango confirmado por NRPN (manual: el resto va por menu). */
        void setClockDivider(int div){ clockDivider = div < 0 ? 0 : (div > 15 ? 15 : div); }
        /** Pasos activos: 1 a 32. */
        void setLength(int steps)    { length = steps < 1 ? 1 : (steps > 32 ? 32 : steps); }
        /** Swing normalizado 0..1: 0 = recto (50%), 1 = maximo (75%). */
        void setSwing(float swing)   { swingAmount = swing < 0.0f ? 0.0f : (swing > 1.0f ? 1.0f : swing); }
        /** 0 = bucle, 1 = reinicia con la tecla y no buclea, 2 = las dos. */
        void setKeyLoopMode(int mode){ keyLoopMode = mode < 0 ? 0 : (mode > 2 ? 2 : mode); }
        /** Velocidad del glide, normalizada 0..1. El 72 se le suma encima. */
        void setSlewRate(float rate) { slewRate = (rate < 0.0f) ? 0.0f : (rate > 1.0f ? 1.0f : rate); }
        /** Cuanto le mete la matriz al slew, aparte del mando. */
        void setSlewModulation(float m) { slewMod = m; }

        /** Paso de 1 a 32, en bipolar: -1 a +1 (el byte 0 es un -1 aqui). */
        void setStep(int stepOneBased, float bipolar);

        /**
         * Tempo: el BPM maestro, que el arpegiador ya tiene. De aqui sale la
         * duracion del paso con el divisor de esta tabla.
         */
        void setMasterBpm(float bpm) { masterBpm = bpm < 20.0f ? 20.0f : bpm; }

        void reset();     // el "key sync": volver al primer paso

        /** El valor bipolar de esta muestra, ya con el slew aplicado. */
        float nextSample();

        bool isEnabled() const { return enabled; }
        int  getCurrentStep() const { return stepIndex; }

        /** Los multiplicadores del manual, en uso para los tests. */
        static float quartersPerStep(int clockDivider);

    private:
        bool  enabled = false;
        int   clockDivider = 13;     // 1/16, el valor por defecto del manual
        int   length = 1;
        int   keyLoopMode = 0;
        float swingAmount = 0.0f;
        float slewRate = 0.0f;
        float slewMod = 0.0f;
        float masterBpm = 120.0f;

        double sampleRate = 44100.0;
        double samplesPerStep = 22050.0;
        double phase = 0.0;
        int    stepIndex = 0;
        bool   corrio = false;        // el modo "no buclea": ya dio su pasada

        float steps[32] = {};
        float currentValue = 0.0f;
        float targetValue = 0.0f;
    };
}
