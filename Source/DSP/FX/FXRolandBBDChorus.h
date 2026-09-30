#pragma once

#include "FXBase.h"
#include "DspEffects/JunoBBD.h"
#include "DspEffects/characters/BbdNoise.h"
#include "DspEffects/profiles/JunoBbdProfile.h"

namespace ABD
{
    /**
     * FXRolandBBDChorus: ENVOLTORIO de politica sobre el coro BBD compartido.
     *
     * Este efecto ya NO tiene coro. La maquina vive en `abd::dsp::JunoBBD`
     * (ABDSharedCode/DspEffects) y sus numeros de fabrica en
     * `abd::dsp::JunoBbdJ106Profile`. Lo que queda aqui es exactamente la parte
     * que es de ABDEep y no del modulo: el reparto de los cuatro mandos del slot
     * a los controles del motor.
     *
     * QUE SE CAMBIA AL SONIDO, MEDIDO ANTES DE HACERLO (no despues). Todas las
     * cifras son las que da `FXUnitTests_BbdChorus.cpp`, que las vuelve a medir
     * en cada ejecucion.
     *
     *   - NIVEL: +0.04 dB en RMS con senal musical. Indistinguible.
     *   - BARRIDO: el mismo. La anchura de la banda modulada sale igual a 0.5, 3.0
     *     y 1.5 Hz para profundidades 0, 0.5 y 1.0 en las dos maquinas.
     *   - ESPECTRO: +1.7 a +3.0 dB alrededor de 1 kHz y -5.4 dB a 12 kHz. La
     *     banda alta baja porque el motor tiene el filtro de reconstruccion del
     *     chip, que este slot no tenia. Es el cambio de timbre de verdad: menos
     *     "aire", algo mas de cuerpo.
     *   - PICO: 0.58 -> 0.69 con la misma entrada (+19%). El `tanh` que hacia
     *     de limitador en la SALIDA se ha ido, porque en la maquina la
     *     saturacion va en la linea, que es donde la lleva el chip. Con una
     *     senal sostenida el cambio es mayor: el slot se saturaba en 0.97 y el
     *     motor llega a 2.16.
     *   - RUIDO: el nivel es el mismo (-61.4 -> -61.5 dBFS integrando 17 s) pero
     *     cambia de CARACTER: el de antes era un siseo continuo y el del motor
     *     son picos de clic, -67 dBFS entre ellos y -60.5 dBFS justo despues de
     *     uno. O sea: un tictac cada 1.95 s (el periodo del LFO del modo I) en
     *     vez de un siseo. Se oye distinto, pero no mas fuerte.
     *   - ANCHO: la correlacion L/R del ruido pasa de -0.79 a +0.29. Las dos
     *     lineas dejan de ser la misma senal con el signo cambiado.
     *   - CAMBIO DE MODO: el salto maximo entre muestras seguidas baja de 0.82
     *     a 0.13. El crossfade de 5 ms de antes ya no hace falta porque el motor
     *     suprime los clics al cambiar de modo, que es lo que hace el original.
     *
     * DOS DEFECTOS QUE EL ENVOLTORIO ARREGLA DE PASO, no como efecto secundario
     * sino porque el reparto de mandos no puede ignorar lo que hay:
     *
     *   1. El mando 1 (Rate) estaba MUERTO. Se guardaba en `setParameter` y no
     *      se leia en el bucle de proceso: `lfoInc` se calculaba una vez con la
     *      constante del modo. Medido: salida identica bit a bit con el mando en
     *      0.0 y en 1.0. Ahora mueve la velocidad de verdad.
     *   2. El modo 0 (Off) no era un bypass: funde a cero el mojado pero la
     *      seca sigue por `* 0.863` y por el `tanh`, o sea -1.3 dB y recorte.
     *      Ahora el motor pasa la senal intacta.
     *
     * Y UN HALLAZGO QUE NO SE PUEDE ARREGLAR AQUI, anotado para que no se lea
     * como un descuido del reparto: el motor NO tiene un mando por fuente de
     * ruido. `setHissLevelDb` baja solo el siseo rosa, y el suelo lo domina la
     * fuga, asi que medir da 0.04 dB de diferencia entre -68 y -96 dB: ese mando
     * casi no hace nada. La unica palanca que mueve el suelo es el desgaste
     * (`setHissMultiplier`), que baja las tres fuentes a la vez. Por eso el
     * mando 3 del slot se reparte ahi, y por eso en la interfaz se lee como
     * desgaste y no como siseo.
     *
     * PARIDAD. Aqui no se puede prometer 0 ulps y no se promete: aqui el sonido
     * TENIA que cambiar, y un test de paridad habria sido un test que obliga a
     * no cambiar. Lo que hay es `FXUnitTests_BbdChorus.cpp`, que mide el antes
     * (una copia congelada del motor anterior, en el propio test) y el despues,
     * y falla si alguna de las cifras de arriba se sale del margen.
     */
    class FXRolandBBDChorus : public FXBase
    {
    public:
        FXRolandBBDChorus();
        ~FXRolandBBDChorus() override = default;

        void prepare(double sampleRate, int samplesPerBlock) override;
        void process(const float* inL, const float* inR,
                      float* outL, float* outR,
                      int numSamples) override;
        void setParameter(int index, float value) override;
        void reset() override;
        int getNumParameters() const override { return 4; }
        juce::String getEffectName() const override { return "Roland BBD Chorus"; }

    private:
        /**
         * La maquina. Un solo motor, y las diferencias entre los dos clones de
         * la Juno son una fila de la tabla, no una clase.
         *
         * J106 y NO J60, y el motivo esta medido en el test: los dos perfiles
         * dan 0 de 4096 muestras distintas, porque `JunoBbdJ60Profile` es
         * `JunoBbdJ106Profile` (en JUNiO601 los dos modelos reciben el mismo
         * valor por defecto y el `ChorusModel` del original no se lee nunca).
         * O sea que la eleccion es gratis HOY. Se pone J106 porque es la tabla
         * calibrada que existe en la suite (JUNiO601 es un Juno-106) y porque
         * ABDEep no tiene un Juno-60 en ninguna parte. El dia que haya una
         * calibracion real de J60, esto es cambiar un parametro de plantilla.
         */
        abd::dsp::JunoBBD<abd::dsp::JunoBbdJ106Profile, abd::dsp::BbdNoiseStage> engine;

        /** El modo, que es un mando del SLOT y no de la maquina. El motor no lo
            expone, y ademas el reparto del mando 1 lo necesita para saber cual
            es la velocidad de fabrica de la que se rodea. */
        int currentMode = 0;

        //--- Los cuatro mandos, TAL COMO LOS PIDIÓ EL USUARIO ---------------//
        //
        // Se guardan aqui y no se leen del motor porque `engine.reset()` pone
        // los valores por defecto DEL PERFIL, o sea que se come lo que el
        // envoltorio le haya pasado. Sin esta copia, un `reset()` en mitad de
        // una nota devuelve el coro a los numeros de fabrica y el usuario no
        // tocaba ningun mando. Medido: antes del arreglo, el slot con los cuatro
        // mandos arriba salia con un ruido cuatro veces menor despues de un
        // `reset()`.
        float paramRate  = 0.30f;
        float paramDepth = 0.50f;
        float paramWear  = 0.30f;

        /** Reaplica los cuatro mandos al motor. La llaman `prepare()` y
            `reset()`, que son las dos cosas que pueden perderlos. */
        void applyAll();

        void applyMode();
        void applyRate();

        static float modeFactoryRate(int mode);
    };
}
