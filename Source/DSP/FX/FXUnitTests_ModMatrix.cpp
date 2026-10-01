/**
 * @purpose El bus de fx en la matriz de modulacion: los ocho destinos que le
 *          da el manual, y que el motor lea de verdad.
 * @classification Test
 *
 * QUE COMPRUEBA, Y POR QUE HACE FALTA ESTE FICHERO.
 *
 * Antes los destinos de fx ESTABAN DECLARADOS Y NO SE LEIAN. El enum tenia
 * doce (`kFx1Level`..`kFx4Param2`) y `getModulationValue` no se llamaba para
 * ninguno: la ruta se podia elegir, el byte se guardaba y no pasaba nada. Un
 * destino que no hace nada no es un destino, es una mentira en un desplegable.
 *
 * Ademas el numero no era el del manual: el bloque vivia en 36-47 y el byte de
 * destino ES el manual, asi que el motor ejecutaba otra ruta de la que el
 * usuario habia elegido. Los ocho van ahora en 74-81, con el MISMO codigo en el
 * enum y en la tabla de la WebUI, y este fichero ata las dos mitades:
 *
 *   1. que los codigos del enum sean los del manual, uno a uno, y distintos;
 *   2. que una ruta a un destino de fx devuelva un numero;
 *   3. que `Fx N Level` mueva la ganancia del hueco MUESTRA A MUESTRA;
 *   4. que `Fx N Parameters` llegue al retardo de verdad --midiendo cuando
 *      vuelve el impulso-- y que NO se acumule bloque a bloque.
 *
 * Y POR QUE EL RETARDO SE MIDE POR EL AUDIO Y NO POR UN GETTER. Porque no hay
 * getter: `FXBase` expone `setParameter` y no `getParameter`, y anadirlo solo
 * para un test es ensuciar la API de todos los efectos para poder mirar por un
 * agujero. El sonido no tiene agujero: si el retardo vuelve mas tarde, el
 * tiempo ha cambiado.
 */

#include <JuceHeader.h>
#include "FXSlot.h"
#include "FXEngine.h"
#include "FXDelay.h"
#include "FXBase.h"
#include "ModulationMatrix.h"

namespace ABD
{

class FXModMatrixUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;
    static constexpr int   kBlock = 256;

    /** Bloque grande para MEDIR un retardo. El mapeo del tiempo es cuadrático
        (`1 + 1999 * t^2` ms), asi que 0,1 son 21 ms y 0,15 son 46 ms: 4096
        muestras a 44,1 kHz son 93 ms, y el impulso vuelve DENTRO del bloque en
        los dos casos. Con 2048 (46 ms) el retardo base no cabia y no se podia
        ni medir. */
    static constexpr int   kBloqueRetardo = 4096;

    FXModMatrixUnitTests() : juce::UnitTest ("FX bus in the modulation matrix", "ABD") {}

    void runTest() override
    {
        //==============================================================================
        beginTest ("the eight FX destinations are numbered as the manual numbers them");

        // El byte de destino es el manual, y el motor lo castea tal cual
        // (`static_cast<ModDestination>`). Si el enum y la tabla se separan, el
        // usuario elige una ruta y suena otra, y no hay nada que lo detecte.
        // Este test es ese "nada".
        expectEquals (static_cast<int> (ModDestination::kFx1Parameters), 74);
        expectEquals (static_cast<int> (ModDestination::kFx2Parameters), 75);
        expectEquals (static_cast<int> (ModDestination::kFx3Parameters), 76);
        expectEquals (static_cast<int> (ModDestination::kFx4Parameters), 77);
        expectEquals (static_cast<int> (ModDestination::kFx1Level),     78);
        expectEquals (static_cast<int> (ModDestination::kFx2Level),     79);
        expectEquals (static_cast<int> (ModDestination::kFx3Level),     80);
        expectEquals (static_cast<int> (ModDestination::kFx4Level),     81);

        // Y el tope tiene que COBRARSELOS: es el codigo del ultimo mas uno, y lo
        // usa el barrido de destinos (`SynthEngineUnitTests_RapidSweep`). Si
        // bajara a 48, el barrido ni miraria el bloque de fx y pasaria todo
        // esto sin haber leido un solo destino de fx.
        expect ((int) ModDestination::kMaxDestinations
                    > static_cast<int> (ModDestination::kFx4Level));

        // Y los ocho son DISTINTOS: un destino repetido son dos nombres para lo
        // mismo, que es el fallo que ya se corrigio una vez con la tabla del
        // grafo, donde `Fx1` caia en un indice donde no hay byte.
        const ModDestination losOcho[8] = {
            ModDestination::kFx1Parameters, ModDestination::kFx2Parameters,
            ModDestination::kFx3Parameters, ModDestination::kFx4Parameters,
            ModDestination::kFx1Level,     ModDestination::kFx2Level,
            ModDestination::kFx3Level,     ModDestination::kFx4Level
        };

        for (int i = 0; i < 8; ++i)
            for (int j = i + 1; j < 8; ++j)
                expect (losOcho[i] != losOcho[j],
                        "Two FX destinations share a code, so one of them is unreachable");

        logMessage ("FX destinations: 74-81, eight distinct codes");
        //==============================================================================
        beginTest ("a route to an FX destination now returns a value");

        {
            // Lo mas pequena que se puede perder: un destino que se puede
            // elegir y del que sale un numero. Antes esto no se podia ni
            // escribir, porque no habia ningun enum con estos nombres.
            ModulationMatrix matrix;
            float fuentes[(int) ModSource::kMaxSources] = {};
            fuentes[(int) ModSource::kLFO1] = 0.5f;

            matrix.setRoute (0, ModSource::kLFO1, ModDestination::kFx1Level, 0.8f);

            expectWithinAbsoluteError (
                matrix.getModulationValue (ModDestination::kFx1Level, fuentes),
                0.4f, 0.001f, "Fx 1 Level should return source * amount");

            matrix.setRoute (1, ModSource::kLFO1, ModDestination::kFx1Parameters, 0.5f);

            expectWithinAbsoluteError (
                matrix.getModulationValue (ModDestination::kFx1Parameters, fuentes),
                0.25f, 0.001f, "Fx 1 Parameters should return source * amount");
        }

        logMessage ("Modulation reaches the eight FX destinations");
        //==============================================================================
        beginTest ("Fx N Level moves the slot gain, sample by sample");

        {
            // DOS huecos, no uno llamado dos veces. Un efecto tiene estado (la
            // linea de retardo), asi que procesar el mismo hueco dos veces compara
            // el bloque uno con el bloque dos de la misma historia, que no es lo
            // que se quiere: se quiere el MISMO bloque con y sin modulacion.
            FXSlot sinMod, conMod;

            for (FXSlot* s : { &sinMod, &conMod })
            {
                s->setType (13);   // Delay
                s->prepare (kTestSampleRate, kBlock);
                s->setMix (1.0f);  // todo wet, para que la ganancia se vea
                s->setGain (1.0f);

                // Y UN RETARDO QUE SE PUEDA MEDIR EN 256 MUESTRAS. Con los
                // parametros por defecto el tiempo es 0,5 -> 500 ms -> 22.000
                // muestras, y un bloque de 256 sale entero en silencio: no hay
                // nada que comparar. A 0 el tiempo son 1 ms, 44 muestras, y el
                // retardo ya ha empezado a sonar cuando acaba el bloque.
                retardoMedible (*s);
            }

            // Y SOLO NIVEL: la cantidad de parametros va a 0 a proposito. Si
            // tambien modulase el tiempo, los dos huecos tendrian retardos
            // distintos y compararlos no diria nada del nivel.
            juce::Array<float> nivel = constante (kBlock, -0.5f);
            conMod.setMatrixModulation (nivel.getRawDataPointer(), 0.0f, kBlock);

            // Los dos bloques de salida se rellenan CON LA MISMA funcion, que es
            // la garantia de que la entrada es identica: comparar el mismo
            // buffer con y sin modulacion no necesita un `copyFrom` ni un buffer
            // mas, y `copyFrom` tiene una firma que ha cambiado entre versiones
            // de JUCE.
            juce::AudioBuffer<float> salidaSin (1, kBlock), salidaCon (1, kBlock);
            llenarTono (salidaSin, 220.0);
            llenarTono (salidaCon, 220.0);

            sinMod.process (salidaSin, kBlock);
            conMod.process (salidaCon, kBlock);

            float picoSin = 0.0f, picoCon = 0.0f;

            // Muestra a muestra, no un pico: el nivel es un factor, y si lo es
            // de verdad then cada muestra con modulacion es la mitad de la misma
            // muestra sin ella. Comparar picos perdona de mas.
            for (int s = 0; s < kBlock; ++s)
            {
                const float sinModS = salidaSin.getSample (0, s);
                const float conModS = salidaCon.getSample (0, s);

                picoSin = juce::jmax (picoSin, std::fabs (sinModS));
                picoCon = juce::jmax (picoCon, std::fabs (conModS));

                expectWithinAbsoluteError (conModS, sinModS * 0.5f, 1.0e-6f,
                                            "Fx N Level at -0.5 should halve every sample");
            }

            expect (picoSin > 1.0e-4f, "the slot with no modulation should make sound");
            expect (picoCon > 1.0e-4f, "the modulated slot should make sound too");
        }

        logMessage ("Fx N Level reaches the gain, per sample");
        //==============================================================================
        beginTest ("the delay declares its time and BOTH feedbacks");

        {
            FXDelay delay;
            delay.prepare (kTestSampleRate, kBlock);

            int indice[4] = {};
            const int n = delay.getModulationParams (indice, 4);

            // Tres, no dos: el tiempo y los feedbacks de los DOS canales. Un
            // retardo con el feedback solo en el izquierdo no es un retardo, es
            // un retardo cojo, asi que el destino UNO del manual los mueve
            // juntos.
            expectEquals (n, 3);
            expectEquals (indice[0], 1);   // tiempo
            expectEquals (indice[1], 9);   // feedback L
            expectEquals (indice[2], 10);  // feedback R
        }

        logMessage ("Delay declares time + feedback L + feedback R");
        //==============================================================================
        beginTest ("Fx N Parameters lengthens the delay instead of adding up");

        {
            // Se mide CUANDO VUELVE EL IMPULSO. Sin getter de parametros, el
            // sonido es la unica forma de mirar lo que ha hecho el efecto, y es
            // la que de verdad le importa al usuario.
            //
            // Y LOS DOS TIEMPOS TIENEN QUE CABER EN EL BLOQUE. El mapeo del
            // retardo es cuadratico, `1 + 1999 * t^2` ms, asi que un 0,2 son 81
            // ms: 3570 muestras, mas que un bloque de 2048. El impulso se
            // escribia y el bloque se acababa antes de que volviera, y "no ha
            // vuelto" se parece mucho a "no funciona". A 0,1 son 21 ms y a 0,15
            // son 46 ms: los dos dentro de las 4096 muestras del bloque.
            const float base = 0.1f;       // ~21 ms
            const float cantidad = 0.05f;  // lo sube a ~46 ms

            const int sinMod  = retardoDeImpulso (nullptr, 0.0f, base);
            const int conMod  = retardoDeImpulso (nullptr, cantidad, base);

            expect (sinMod > 0, "the impulse should come back at all");
            expect (conMod > sinMod,
                    "Fx N Parameters with a positive amount should make the delay LONGER, "
                    "not shorter and not the same");

            // Y LO QUE NO PUEDE PASAR: que la modulacion se ACUMULE. El valor
            // base vive en `params[]` y la modulacion se suma al escribir en el
            // efecto; si se escribiera en `params[]`, cada bloque sumaria 0,05 y
            // el retardo se iria de la mano. Este es el fallo que hace que un
            // modulo tenga que usar la modulacion con miedo.
            FXSlot slot;
            slot.setType (13);
            slot.prepare (kTestSampleRate, kBloqueRetardo);
            slot.setMix (1.0f);
            retardoMedible (slot, base);

            juce::Array<float> nivel = constante (kBloqueRetardo, 0.0f);
            slot.setMatrixModulation (nivel.getRawDataPointer(), cantidad, kBloqueRetardo);

            int primera = 0;
            juce::AudioBuffer<float> buffer (1, kBloqueRetardo);

            for (int bloque = 0; bloque < 4; ++bloque)
            {
                buffer.clear();
                buffer.setSample (0, 0, 1.0f);
                slot.process (buffer, kBloqueRetardo);

                const int llegada = primeraLlegada (buffer);

                if (bloque == 0)
                {
                    primera = llegada;
                    expect (llegada > sinMod,
                            "the first block with modulation should already be longer");
                }
                else
                {
                    expectEquals (llegada, primera,
                                   "the modulated delay must not grow block after block");
                }
            }

            // Y SOLTAR la modulacion devuelve el retardo a su base. Que el
            // destino "se apague" sin dejar el efecto movido es parte del
            // contrato: si no, mover el mando de profundidad a cero no devuelve
            // el sonido a donde estaba.
            slot.setMatrixModulation (nullptr, 0.0f, kBloqueRetardo);

            buffer.clear();
            buffer.setSample (0, 0, 1.0f);
            slot.process (buffer, kBloqueRetardo);

            expectEquals (primeraLlegada (buffer), sinMod,
                          "with no modulation the delay should go back to its base time");
        }

        logMessage ("Fx N Parameters reaches the delay, and does not accumulate");
        //==============================================================================
        beginTest ("an effect that declares no modifiable params is left alone");

        {
            // El valor por defecto de `getModulationParams` es NINGUNO, y tiene
            // que serlo. Un efecto que no ha decidido que parametros se mueven
            // no puede verlos moverse porque si, y con esto se comprueba que la
            // cantidad llega al hueco y el hueco no la reparte a ningun lado.
            //
            // Dos huecos por el mismo motivo que antes: una reverb tiene cola, y
            // comparar dos bloques seguidos del mismo hueco compara dos momentos
            // distintos de una historia.
            FXSlot sinMod, conMod;

            for (FXSlot* s : { &sinMod, &conMod })
            {
                s->setType (2);   // Plate: reverb, que no declara ninguno
                s->prepare (kTestSampleRate, kBlock);
                s->setMix (1.0f);
                s->setParameter (0, 0.5f);
            }

            juce::Array<float> nivel = constante (kBlock, 0.0f);
            conMod.setMatrixModulation (nivel.getRawDataPointer(), +0.4f, kBlock);
            // El 0,4 de aqui es la CANTIDAD DE PARAMETROS, no la del nivel: el
            // buffer va a cero porque este test no modula el nivel, que ya tiene
            // su test propio arriba.

            juce::AudioBuffer<float> salidaSin (1, kBlock), salidaCon (1, kBlock);
            llenarTono (salidaSin, 220.0);
            llenarTono (salidaCon, 220.0);

            sinMod.process (salidaSin, kBlock);
            conMod.process (salidaCon, kBlock);

            for (int s = 0; s < kBlock; ++s)
            {
                expect (std::isfinite (salidaCon.getSample (0, s)),
                        "a slot with no declared params should still produce finite audio");

                // Y el sonido es el MISMO muestra a muestra: sin declaracion, la
                // cantidad no llega a ningun parametro y la reverb suena igual
                // que sin ella.
                expectWithinAbsoluteError (salidaCon.getSample (0, s), salidaSin.getSample (0, s),
                                            1.0e-6f,
                                            "an effect that declares no modifiable params must not change");
            }
        }

        logMessage ("Effects without declared params are left alone");
    }

private:
    //==============================================================================
    /** Un array de `n` muestras todas iguales a `valor`.

        Y POR QUE EXISTE ESTA FUNCION Y NO UN `juce::Array<float> a (n, valor)`
        EN LA LLAMADA. Porque ESA FORMA NO HACE ESO. En esta version de JUCE
        `juce::Array` no tiene constructor de `(tamano, valor)`: lo que pilla es
        el variadico de elementos, y `Array<float> a (256, -0.5f)` compila sin
        queja y construye un array de DOS elementos, `{256.0f, -0.5f}`. No da
        error, da basura: al pasarle el puntero a `setMatrixModulation` la
        muestra 0 multiplicaba la ganancia por 257 y las demas leian memoria de
        mas, y el sintoma --"la modulacion de nivel no hace nada y ademas el
        retardo se desboca"-- no señala ni al array ni a la linea que lo crea.

        Por eso el truncamiento se hace aqui y en ningun otro sitio, con el
        nombre de la cosa puesta. */
    static juce::Array<float> constante (int n, float valor)
    {
        juce::Array<float> a;
        a.resize (n);
        a.fill (valor);
        return a;
    }

    //==============================================================================
    /** Deja un hueco con un retardo que se pueda MEDIR en un bloque corto y que
        no realimente.

        Tres cosas, y las tres hacen falta:
          - el TIEMPO a 0 (1 ms, 44 muestras): a 0,5 el retardo son 500 ms y un
            bloque de 256 sale entero en silencio;
          - el MODO a 0 (esterreo sin cruce): el 0,5 por defecto es modo X, que
            se cruza entre canales y con un solo canal writes y lee el mismo
            puntero;
          - los FEEDBACK a 0: el lazo escribe `seco + lpf * fb`, y con fb
            distinto de cero lo que se mide ya no es el tiempo sino la cola.

        Con esto el retardo es un cable: lo que entra sale `delaySamples` mas
        tarde y con el mismo valor. */
    static void retardoMedible (FXSlot& slot, float tiempo = 0.0f)
    {
        slot.setParameter (2, 0.0f);   // ST, sin cruce de canales
        slot.setParameter (1, tiempo);  // 0 -> 1 ms -> 44 muestras
        slot.setParameter (9, 0.0f);   // feedback L
        slot.setParameter (10, 0.0f);  // feedback R
    }

    //==============================================================================
    /** Rellena un buffer con un tono, para que un efecto tenga algo que
        processar. Un bloque en silencio no sirve: un retardo con la entrada muda
        no da pico y "la ganancia ha bajado a la mitad" no se puede comprobar
        contra nada.

        Rellena el buffer del llamante y no lo devuelve, porque devolver un
        `AudioBuffer` por valor es copiar el bloque entero. */
    static void llenarTono (juce::AudioBuffer<float>& buffer, double hz)
    {
        for (int s = 0; s < buffer.getNumSamples(); ++s)
        {
            const double fase = 2.0 * 3.14159265358979323846 * hz * s / kTestSampleRate;
            buffer.setSample (0, s, (float) std::sin (fase) * 0.5f);
        }
    }

    /** La primera muestra EN LA QUE se oye algo, en muestras. Un impulso al 0 y
        el retardo devuelve la primera repeticion; se busca por encima del 25% del
        pico del bloque, que es la primera llegada y no la cola.

        El 25% y no un 5% porque el feedback se modula tambien y las repeticiones
        llegan a un 5% del impulso: con un umbral del 5% la busqueda rozaba el
        eco, y un numero que depende de cuanto mida el umbral no mide un retardo,
        mide el umbral. */
    static int primeraLlegada (const juce::AudioBuffer<float>& buffer)
    {
        float pico = 0.0f;

        for (int s = 0; s < buffer.getNumSamples(); ++s)
            pico = juce::jmax (pico, std::fabs (buffer.getSample (0, s)));

        if (pico < 1.0e-6f)
            return -1;

        const float umbral = pico * 0.25f;

        for (int s = 1; s < buffer.getNumSamples(); ++s)
            if (std::fabs (buffer.getSample (0, s)) >= umbral)
                return s;

        return -1;
    }

    /** Retardo de un impulso, en muestras, con una cantidad de modulacion
        cualquiera. `nivel` a nullptr es "sin modular". */
    static int retardoDeImpulso (const float* nivel, float cantidad, float base)
    {
        FXSlot slot;
        slot.setType (13);   // Delay
        slot.prepare (kTestSampleRate, kBloqueRetardo);
        slot.setMix (1.0f);
        retardoMedible (slot, base);

        juce::AudioBuffer<float> buffer (1, kBloqueRetardo);
        buffer.clear();
        buffer.setSample (0, 0, 1.0f);

        slot.setMatrixModulation (nivel, cantidad, kBloqueRetardo);
        slot.process (buffer, kBloqueRetardo);

        return primeraLlegada (buffer);
    }
};

static FXModMatrixUnitTests fxModMatrixUnitTests;

} // namespace ABD
