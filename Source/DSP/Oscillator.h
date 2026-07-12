#pragma once

namespace ABD
{
    /**
     * Interfaz base abstracta para todos los tipos de osciladores.
     * Permite que el motor sea extensible a nuevos tipos en el futuro.
     */
    class Oscillator
    {
    public:
        virtual ~Oscillator() = default;

        /**
         * Inicializa o actualiza la frecuencia de muestreo de renderizado.
         */
        virtual void prepare(double sampleRate) = 0;

        /**
         * Configura la frecuencia fundamental base del oscilador en Hz.
         */
        virtual void setFrequency(double hz) = 0;

        /**
         * Permite inyectar valores de modulación física o matricial directamente.
         * 
         * @param destination ID genérico de destino de modulación
         * @param value Valor flotante normalizado o bipolar
         */
        virtual void setModulationValue(int destination, float value) = 0;

        /**
         * Procesa y devuelve la siguiente muestra de audio calculada.
         */
        virtual float nextSample() = 0;

        /**
         * Reinicia la fase del oscilador a 0 (para Hard Sync).
         */
        virtual void resetPhase() = 0;

        /**
         * Retorna la fase actual del oscilador en rango [0, 1).
         */
        virtual double getPhase() const = 0;

        // IDs genéricos de destinos de modulación comunes
        enum ModulationDestination
        {
            kPitchMod = 0,
            kPWM,
            kToneMod
        };
    };
}
