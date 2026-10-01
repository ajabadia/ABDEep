#pragma once

#include <JuceHeader.h>

namespace ABD
{
    /**
     * Interfaz base abstracta para todos los efectos del FX Engine.
     * Cada efecto concreto (Delay, Reverb, Chorus, etc.) hereda de esta clase
     * e implementa los métodos virtuales puros.
     */
    class FXBase
    {
    public:
        virtual ~FXBase() = default;

        /** Inicializa el efecto con la frecuencia de muestreo y tamaño de bloque */
        virtual void prepare(double sampleRate, int samplesPerBlock) = 0;

        /**
         * Procesa un bloque de audio estéreo.
         * @param inL  Buffer de entrada canal izquierdo
         * @param inR  Buffer de entrada canal derecho
         * @param outL Buffer de salida canal izquierdo
         * @param outR Buffer de salida canal derecho
         * @param numSamples Número de muestras a procesar
         */
        virtual void process(const float* inL, const float* inR,
                              float* outL, float* outR,
                              int numSamples) = 0;

        /**
         * Configura un parámetro del efecto por índice.
         * @param index Índice del parámetro (0..getNumParameters()-1)
         * @param value Valor normalizado 0..1
         */
        virtual void setParameter(int index, float value) = 0;

        /** Reinicia el estado interno del efecto (para nota nueva o bypass) */
        virtual void reset() = 0;

        /** Retorna el número de parámetros que tiene este efecto */
        virtual int getNumParameters() const = 0;

        /**
         * Los índices de parámetro que el destino `Fx N Parameters` de la
         * matriz de modulación mueve en este efecto.
         *
         * POR QUE LO DICE EL EFECTO Y NO EL BUS. El manual del hardware da UN
         * destino por hueco (`Fx 1 Parameters`), así que el bus no puede decidir
         * a qué parámetros se modulan: lo que se modula en `Fx 1` y en `Fx 4` no
         * tiene por qué ser lo mismo, porque lo que hay en el hueco es un efecto
         * distinto. Lo sabe el efecto, y por eso lo declara.
         *
         * POR QUE UNA LISTA Y NO UN PAR. Porque el retardo necesita tres: el
         * tiempo y los dos feedbacks, que van en índices distintos. Fijar dos
         * huecos en el bus obligaría a elegir cuál de los dos feedbacks se
         * modula, y la respuesta es los dos.
         *
         * Por defecto NO DECLARA NINGUNO (devuelve 0): un efecto que no dice
         * cuáles son no tiene sus parámetros movidos, y es lo único honesto
         * mientras no se decida para cada familia. El primero que lo declara es
         * `FXDelay`, con el tiempo y el feedback.
         *
         * @param indices  Buffer del llamante, a rellenar con los índices
         * @param maxCount Cuántos caben en `indices`
         * @return Cuántos índices se han escrito (0 = ninguno modulable)
         */
        virtual int getModulationParams(int* indices, int maxCount) const
        {
            (void)indices; (void)maxCount;
            return 0;
        }

        /** Retorna el nombre del tipo de efecto (para debugging) */
        virtual juce::String getEffectName() const = 0;

        /**
         * Proporciona una señal de modulador externo al efecto (opcional).
         * Usado por FXVocoder para recibir sidechain/mic input.
         * @param modL  Buffer del modulador canal izquierdo (o nullptr si no disponible)
         * @param modR  Buffer del modulador canal derecho (o nullptr si no disponible)
         * @param numSamples Número de muestras del modulador
         */
        virtual void setModulatorInput(const float* modL, const float* modR, int numSamples)
        {
            (void)modL; (void)modR; (void)numSamples;
        }
    };
}
