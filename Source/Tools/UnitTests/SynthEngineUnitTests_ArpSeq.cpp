/**
 * @purpose Unit tests for SynthEngine DSP: los destinos 71 ("Arp Gate") y 72
 *          ("Seq Slew") de la matriz de modulacion, medidos sobre lo que
 *          hacen y no sobre el numero interno que les pasa el motor.
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"
#include "ModulationMatrix.h"
#include "Arpeggiator.h"
#include "ControlSequencer.h"

#include <algorithm>
#include <cmath>

namespace ABD
{

static constexpr double kSr = 44100.0;
static constexpr int    kBloque = 256;

/** El paso del arpegiador a 8 Hz, en muestras. */
static constexpr int kSamplesPorPaso = (int) (kSr / 8.0);   // 5512

/**
 * Una corrida completa del destino 71, con los dos numeros que de verdad
 * importan y que son de dos piezas distintas del motor.
 */
struct CorridaDel71
{
    float gate = -1.0f;     // la puerta que el MOTOR leyo de la matriz
    int   samples = 0;      // lo que dura la nota, en muestras, con ESA puerta
    int   sampleOn = -1;
    int   sampleOff = -1;
};

/**
 * CUANDO SE MIDE LA PUERTA Y CUANDO SE MIDE LA DURACION, Y POR QUE NO A LA VEZ.
 *
 * El motor consume el 71 en `SynthEngine::processBlock`, que escribe la puerta
 * con `arpeggiator.setGate (jlimit (0, 1, arpGateBase + gateMod))`. O sea, la
 * matriz decide un numero y el arpegiador lo convierte en samples al programar
 * el apagado de cada nota. Un solo recorrido no puede ver las dos cosas: dentro
 * de `processBlock` el arpegiador genera sus propios eventos y el test no los
 * ve, asi que la nota se le escapa.
 *
 * Por eso el recorrido es en dos tramos y los dos usan codigo real:
 *
 *   1. El motor entero, con su matriz: se lee la puerta que ha dejado. Eso
 *      demuestra que la ruta LLEGA.
 *   2. Esa misma puerta, pasada a un arpegiador que solo lleva este test: se
 *      mide de note-on a note-off. Eso demuestra que la puerta MUEVE el reloj.
 *
 * Y la afirmacion que junta las dos es la que importa: menos puerta, menos
 * nota, y con la cuenta exacta que dice la fraccion de paso.
 */

/** El arpegiador del panel, con la puerta que se le pase. Sin motor alrededor. */
static int medirNotaConGate (float gate, int* sampleOn, int* sampleOff)
{
    Arpeggiator solo;
    solo.setEnabled (true);
    solo.setMode (0);            // Up
    solo.setSwing (0.0f);
    solo.setHold (false);
    solo.setKeySync (false);
    solo.setOctaves (1);
    solo.setStepRateHz (8.0f);
    solo.prepare (kSr);
    solo.setGate (gate);
    solo.noteOn (60, 0.9f);

    int duration = 0;
    for (int b = 0; b < 400 && duration == 0; ++b)   // 400 bloques = 102400 muestras
    {
        juce::MidiBuffer salida;
        solo.generate (salida, kBloque);

        for (const auto meta : salida)
        {
            const auto msg = meta.getMessage();
            if (msg.getNoteNumber() != 60)
                continue;

            if (msg.isNoteOn() && *sampleOn < 0)
            {
                *sampleOn = b * kBloque + meta.samplePosition;
            }
            else if (msg.isNoteOff() && *sampleOn >= 0)
            {
                *sampleOff = b * kBloque + meta.samplePosition;
                duration = *sampleOff - *sampleOn;
            }
        }
    }
    return duration;
}

/**
 * Una corrida del 71 de punta a punta.
 *
 * `pitchWheel` es el valor CRUDO del mensaje (0 = abajo del todo, 8192 =
 * centro, 16383 = arriba del todo), porque lo que hay que mover es la fuente
 * bipolar que el motor publica en `arpCommonSources[kPitchBend]`.
 *
 * Y VA UN BLOQUE POR DELANTE POR UNA RAZON DEL PROPIO MOTOR: la puerta se
 * calcula antes de que `processBlock` mire el MIDI del bloque, asi que el giro
 * del bloque N todavía no vale para la puerta del bloque N.
 */
static CorridaDel71 corrida71 (float gateBase, float amount, int pitchWheel, bool conRuta)
{
    CorridaDel71 r;

    SynthEngine engine;
    engine.prepare (kSr, kBloque);

    if (conRuta)
        engine.getModulationMatrix().setRoute (0, ModSource::kPitchBend,
                                              ModDestination::kArpGate, amount);

    engine.setArpGateBase (gateBase);
    auto& arp = engine.getArpeggiator();
    arp.setEnabled (true);
    arp.setMode (0);
    arp.setSwing (0.0f);
    arp.setOctaves (1);
    arp.setStepRateHz (8.0f);
    arp.prepare (kSr);
    arp.setGate (gateBase);

    juce::AudioBuffer<float> buffer (2, kBloque);
    juce::MidiBuffer midi;

    // El primer bloque solo lleva el giro: fija la fuente bipolar.
    if (pitchWheel != 8192)
    {
        buffer.clear();
        midi.clear();
        midi.addEvent (juce::MidiMessage::pitchWheel (1, (int) pitchWheel), 0);
        engine.processBlock (buffer, midi);
    }

    // Y este es el bloque cuya puerta se mide: el motor ya la ha escrito.
    buffer.clear();
    midi.clear();
    engine.processBlock (buffer, midi);
    r.gate = engine.getArpeggiator().getGate();

    r.samples = medirNotaConGate (r.gate, &r.sampleOn, &r.sampleOff);
    return r;
}

/**
 * Cuando llega el secuenciador al otro lado del salto entre dos pasos.
 *
 * El umbral es 0.0, el punto medio entre +1 y -1, o sea el 90 % del recorrido.
 * Con el slew en cero el valor salta en la primera muestra del segundo paso; con
 * el 72 puesto tarda, y `samples` mide esa espera.
 *
 * Y EL UMBRAL EN 0 NO SE CONFUNDE CON LA RAMPA INICIAL: al arrancar el
 * secuenciador sube de 0 hacia +1, asi que el unico tramo por debajo de cero es
 * justo el que se quiere medir.
 */
struct GlideDelSeq
{
    bool llegaron = false;
    int  samples = 0;
    int  totalMuestras = 0;
};

/** El secuenciador, con dos pasos que saltan de +1 a -1 y vuelta. */
static void prepararSecuenciador (SynthEngine& engine)
{
    auto& seq = engine.getControlSequencer();
    seq.setEnabled (true);
    seq.setClockDivider (13);    // 1/16
    seq.setLength (2);
    seq.setSwing (0.0f);
    seq.setKeyLoopMode (0);
    seq.setSlewRate (0.0f);      // el panel en cero: salto seco
    seq.setMasterBpm (120.0f);
    seq.setStep (1, +1.0f);
    seq.setStep (2, -1.0f);
}

static GlideDelSeq medirGlide (float amount, float modWheel, bool conRuta)
{
    GlideDelSeq r;

    SynthEngine engine;
    engine.prepare (kSr, kBloque);

    if (conRuta)
        engine.getModulationMatrix().setRoute (0, ModSource::kModWheel,
                                              ModDestination::kSeqSlew, amount);

    prepararSecuenciador (engine);

    // La rueda de mod va en el PRIMER bloque del bucle de medicion, no en uno
    // aparte: si se contara aparte, el origen de `absolutas` quedaria un bloque
    // por delante de donde arranca el reloj del secuenciador y todas las medidas
    // saldrían desplazadas justo eso.

    juce::AudioBuffer<float> buffer (2, kBloque);
    juce::MidiBuffer midi;
    int absolutas = 0;

    for (int b = 0; b < 120000 / kBloque; ++b)
    {
        buffer.clear();
        midi.clear();
        if (b == 0)
            midi.addEvent (juce::MidiMessage::controllerEvent (1, 1, (int) modWheel), 0);
        engine.processBlock (buffer, midi);

        const auto& seq = engine.getControlSeqBuffer();
        for (int s = 0; s < kBloque; ++s)
            if (seq[s] < 0.0f && !r.llegaron)
            {
                r.llegaron = true;
                r.samples = absolutas + s;
            }

        absolutas += kBloque;
        r.totalMuestras = absolutas;
    }

    return r;
}

/** La envolvente del motor por muestra: el valor absoluto de cada muestra. */
struct Envio
{
    juce::Array<float> muestras;
};

/**
 * LO QUE SUENA, Y NO LO QUE CUENTA.
 *
 * Las pruebas de arriba miran el reloj: cuando sale el note-off del arpegiador y
 * cuando cruza el secuenciador. Eso prueba que el destino mueve el reloj, no que
 * se oiga. Estas dos cierran el circulo por el otro lado: leen el BUFFER DE
 * AUDIO del motor, que es lo que sale por el jack.
 */

/**
 * Corre el motor `bloques` veces y deja el audio de la izquierda. La nota entra
 * en el primer bloque y no se suelta nunca: una voz que suena de continuo es la
 * que deja medir el nivel sin que la envolvente de la propia nota se mezcle.
 */
static Envio correrMotor (SynthEngine& engine, int bloques, int nota)
{
    Envio r;
    r.muestras.ensureStorageAllocated (bloques * kBloque);

    juce::AudioBuffer<float> buffer (2, kBloque);
    juce::MidiBuffer midi;

    for (int b = 0; b < bloques; ++b)
    {
        buffer.clear();
        midi.clear();
        if (b == 0)
            midi.addEvent (juce::MidiMessage::noteOn (1, nota, 0.9f), 0);
        engine.processBlock (buffer, midi);

        for (int s = 0; s < kBloque; ++s)
            r.muestras.add (std::abs (buffer.getSample (0, s)));
    }
    return r;
}

/**
 * El maximo absoluto de cada Ventana de 4096 muestras, en una sola linea.
 *
 * NO ES UNA ASERCION, es una traza para leer a ojo cuando una medicion sale
 * rara: con la sierra de 261 Hz del motor, un maximo por ventana deja ver la
 * forma de la envolvente sin despeinar el contenido de la onda.
 */
static juce::String trazaEnvolvente (const Envio& e, int ventanas, int desde = 0)
{
    juce::String linea;
    for (int v = 0; v < ventanas; ++v)
    {
        const int ini = desde + v * 4096;
        if (ini >= e.muestras.size())
            break;
        float maximo = 0.0f;
        for (int i = ini; i < std::min (ini + 4096, e.muestras.size()); ++i)
            maximo = std::max (maximo, e.muestras[i]);
        linea << juce::String (maximo, 3) << " ";
    }
    return linea;
}

/** El PICO o el SUELO de la envolvente: el maximo o el minimo del maximo de
 * cada ventana de 4096 muestras, contando desde `desde`.
 *
 * ES LA MEDIDA DEL GLIDE, Y VA AL REVES QUE LA DE LA PUERTA. Un salto seco
 * lleva el amplificador a cero digital; un glide no, porque va pasando por los
 * valores intermedios y nunca llega. Por eso lo que se compara entre las dos
 * corridas del 72 no es cuando empieza a bajar el audio, sino CUANTO SE APARTA
 * DE SILENCIO: el suelo. Y el maximo por ventana es lo que hace falta para que
 * la medida sea del amplificador y no del diente de la sierra de 261 Hz.
 */
static float nivelEnvolvente (const Envio& e, bool elMaximo, int desde = 0, int ventanas = 1000)
{
    float nivel = elMaximo ? 0.0f : 1.0e9f;
    int vistas = 0;
    for (int ini = desde; ini < e.muestras.size() && vistas < ventanas; ini += 4096, ++vistas)
    {
        float maximo = 0.0f;
        for (int i = ini; i < std::min (ini + 4096, e.muestras.size()); ++i)
            maximo = std::max (maximo, e.muestras[i]);
        nivel = elMaximo ? std::max (nivel, maximo) : std::min (nivel, maximo);
    }
    return vistas > 0 ? nivel : 0.0f;
}

/**
 * La primera muestra a la que el audio BAJA Y SE QUEDA por debajo del `fraccion`
 * de su nivel inicial durante al menos `minimo` muestras seguidas.
 *
 * POR QUE "SE QUEDA" Y NO "LA PRIMERA QUE CAE". El motor suena una sierra de
 * 261 Hz, y de una sierra una sola muestra siempre cae por debajo del 20 % del
 * pico en el valle del diente: el valle dura unas 34 muestras de cada periodo de
 * 169. Buscando la primera muestra suelta, lo que se mide es el primer diente
 * de la onda, no la envolvente: daba 1207 en las dos corridas, antes incluso del
 * primer paso del secuenciador, y por eso no distinguia el glide de nada. Con
 * `minimo` por encima de un periodo entero, lo unico que puede cruzar el umbral
 * es el amplificador bajando de verdad.
 */
static int primeraCaida (const Envio& e, float fraccion, int minimo = 512)
{
    if (e.muestras.size() < 2000)
        return -1;

    float nivel = 0.0f;
    for (int i = 800; i < 1200; ++i)
        nivel = std::max (nivel, e.muestras[i]);
    if (nivel <= 0.0f)
        return -1;

    const float umbral = nivel * fraccion;
    int actual = 0;
    for (int i = 1200; i < e.muestras.size(); ++i)
    {
        if (e.muestras[i] < umbral)
        {
            if (++actual == minimo)
                return i - minimo + 1;
        }
        else
        {
            actual = 0;
        }
    }
    return -1;
}

/**
 * La tira mas larga de muestras por debajo de `fraccion` del pico, contando
 * solo a partir de `desde` para no medir el ataque de la primera nota.
 *
 * LO QUE SE MIDE ES EL ANCHO DEL HUECO, NO SU FONDO. Con cualquier puerta
 * menor que uno el arpegiador deja un hueco entre notas, y en ese hueco el
 * amplificador se va a cero tanto con puerta 0.8 como con 0.2: el fondo no
 * distingue nada. Lo que distingue una puerta de otra es CUANTO DURA el hueco,
 * porque la nota se apaga proporcionalmente antes.
 */
static int huecoMasLargo (const Envio& e, float fraccion, int desde = 12000)
{
    float pico = 0.0f;
    for (int i = desde; i < e.muestras.size(); ++i)
        pico = std::max (pico, e.muestras[i]);
    if (pico <= 0.0f)
        return -1;

    const float umbral = pico * fraccion;
    int mejor = 0, actual = 0;
    for (int i = desde; i < e.muestras.size(); ++i)
    {
        if (e.muestras[i] < umbral)
        {
            ++actual;
            mejor = std::max (mejor, actual);
        }
        else
        {
            actual = 0;
        }
    }
    return mejor;
}

class SynthEngineArpSeqUnitTests : public juce::UnitTest
{
public:
    SynthEngineArpSeqUnitTests() : juce::UnitTest("SynthEngine ARP/SEQ Matrix Tests", "ABD") {}

    void runTest() override
    {
        // Lo que dura la nota cuando el paso es el CORTO (indice par) y el
        // swing esta en cero: la mitad del paso. La duracion fraccionaria se
        // redondea al entero que usa `Arpeggiator::generate`.
        const auto samplesDeGate = [] (float gate)
        {
            // 5512.5 a 44.1 kHz y 8 Hz, y el paso CORTO (indice par) son la
            // mitad: 2756.25. En doble, porque truncar a entero antes de
            // multiplicar por la puerta displace el resultado en una muestra.
            const double duracion = (kSr / 8.0) * 0.5;
            return (int) std::lround (duracion * (double) gate);
        };

        //==============================================================================
        beginTest("Destino 71: la ruta que cierra el pitch ACORTA la nota del arpegiador");
        {
            // Panel en 0.8 y el 71 restandolo hacia abajo. El tope es 1.0, asi que
            // con amount 0.4 todavia queda puerta (0.4) y la nota se apaga antes
            // de tiempo en vez de desaparecer. El "0 = silencio" del manual NO es
            // lo que se mide aqui, y por algo: con la puerta en cero el
            // arpegiador no programa ningun apagado y la nota llega hasta el paso
            // siguiente, que es mas larga, no muda.
            const auto sinRuta  = corrida71 (0.8f, 0.0f, 0, false);
            const auto amount020 = corrida71 (0.8f, 0.2f, 0, true);
            const auto amount040 = corrida71 (0.8f, 0.4f, 0, true);

            // 1. LA RUTA LLEGA. La puerta del motor es la del panel mas el 71.
            expectWithinAbsoluteError (sinRuta.gate, 0.8f, 0.0001f,
                "sin ruta la puerta deberia ser la del panel");
            expectWithinAbsoluteError (amount020.gate, 0.6f, 0.0001f,
                "con amount 0.2 la puerta deberia bajar a 0.6");
            expectWithinAbsoluteError (amount040.gate, 0.4f, 0.0001f,
                "con amount 0.4 la puerta deberia bajar a 0.4");

            // 2. LA PUERTA MUEVE EL RELOJ. Y con la cuenta exacta, mas el
            // retraso de un bloque que tiene la cuenta atras del apagado: el
            // apagado se descuenta a partir del FINAL del bloque en el que se
            // programa, no desde `pos`, asi que cae `kBloque` muestras mas tarde.
            expect (sinRuta.samples > 0 && amount020.samples > 0 && amount040.samples > 0,
                "las tres corridas deben medir una nota entera");
            expectEquals (sinRuta.samples,  samplesDeGate (0.8f) + kBloque,
                "sin ruta la nota deberia durar el 80 % de la mitad del paso, mas un bloque");
            expectEquals (amount020.samples, samplesDeGate (0.6f) + kBloque,
                "con amount 0.2 la nota deberia durar el 60 % de la mitad del paso, mas un bloque");
            expectEquals (amount040.samples, samplesDeGate (0.4f) + kBloque,
                "con amount 0.4 la nota deberia durar el 40 % de la mitad del paso, mas un bloque");

            // 3. Y LA ORDEN, que es lo que hace que la prueba mida el efecto y
            //    no un numero que cuadre por casualidad.
            expect (amount040.samples < amount020.samples,
                "mas modulacion negativa debe dar una nota MAS CORTA ("
                + juce::String (amount040.samples) + " vs " + juce::String (amount020.samples) + ")");
            expect (amount020.samples < sinRuta.samples,
                "cualquier modulacion negativa debe acortar la nota ("
                + juce::String (amount020.samples) + " vs " + juce::String (sinRuta.samples) + ")");

            logMessage ("Arp Gate: sin ruta puerta " + juce::String (sinRuta.gate, 4)
                      + " nota " + juce::String (sinRuta.samples)
                      + " | amount 0.2 puerta " + juce::String (amount020.gate, 4)
                      + " nota " + juce::String (amount020.samples)
                      + " | amount 0.4 puerta " + juce::String (amount040.gate, 4)
                      + " nota " + juce::String (amount040.samples));
        }

        //==============================================================================
        beginTest("Destino 71: el signo tambien se nota (abajo acorta, arriba alarga)");
        {
            const auto abajo  = corrida71 (0.8f, 0.2f, 0, true);        // fuente -1
            const auto centro = corrida71 (0.8f, 0.0f, 8192, true);    // fuente 0
            const auto arriba = corrida71 (0.8f, 0.2f, 16383, true);   // fuente +1

            expectWithinAbsoluteError (abajo.gate, 0.6f, 0.0001f,
                "con la fuente abajo la puerta deberia bajar a 0.6");
            expectWithinAbsoluteError (centro.gate, 0.8f, 0.0001f,
                "con la fuente al centro la puerta deberia quedar en la del panel");
            // Arriba el 0.2 del mando lleva 0.8 + 0.2 al tope de 1.0.
            expectWithinAbsoluteError (arriba.gate, 1.0f, 0.0001f,
                "con la fuente arriba la puerta deberia quedarse en el tope de 1.0");

            expect (abajo.samples < centro.samples,
                "con la fuente abajo la nota debe ser mas corta que sin modulacion ("
                + juce::String (abajo.samples) + " vs " + juce::String (centro.samples) + ")");
            expect (arriba.samples > centro.samples,
                "con la fuente arriba la nota debe ser mas larga que sin modulacion ("
                + juce::String (arriba.samples) + " vs " + juce::String (centro.samples) + ")");

            // Con la puerta en 1.0 la nota llena el paso entero, y la apaga el
            // RETRIGERO del paso siguiente, no el apagado del gate: los dos caen
            // en la misma marca y el retrigero va antes en la cola de eventos.
            const int marcaDelPaso = (int) std::lround ((kSr / 8.0) * 0.5);
            expect (std::abs (arriba.samples - marcaDelPaso) <= 2,
                "con la fuente arriba la nota deberia llenar el paso corto entero hasta su marca ("
                + juce::String (arriba.samples) + " vs " + juce::String (marcaDelPaso) + ")");

            logMessage ("Arp Gate por signo: abajo " + juce::String (abajo.samples)
                      + ", centro " + juce::String (centro.samples)
                      + ", arriba " + juce::String (arriba.samples) + " muestras");
        }

        //==============================================================================
        beginTest("El arpegiador no deja notas colgadas cuando se sueltan todas");
        {
            // Con la puerta abierta del todo el apagado del gate cae en la marca
            // del paso siguiente, casi tres mil muestras despues. Si mientras
            // tanto se sueltan todas las notas, ese apagado tiene que llegar
            // IGUAL: si `allNotesOff` vaciara la lista de pendientes sin
            // emitirlos, la nota se quedaria encendida para siempre y no habria
            // ningun note-off en todo el ciclo.
            Arpeggiator arp;
            arp.setEnabled (true);
            arp.setMode (0);
            arp.setSwing (0.0f);
            arp.setOctaves (1);
            arp.setStepRateHz (8.0f);
            arp.prepare (kSr);
            arp.setGate (1.0f);

            arp.noteOn (60, 0.9f);

            juce::MidiBuffer primero;
            arp.generate (primero, kBloque);
            expect (primero.getNumEvents() > 0, "el primer bloque deberia encender la nota");

            arp.allNotesOff();

            juce::MidiBuffer tras;
            arp.generate (tras, kBloque);

            bool hayApagado = false;
            for (const auto meta : tras)
                if (meta.getMessage().isNoteOff() && meta.getMessage().getNoteNumber() == 60)
                    hayApagado = true;

            expect (hayApagado,
                "tras un allNotesOff tiene que salir el note-off de la nota pendiente");
            expectEquals (arp.getHeldCount(), 0, "no debe quedar ninguna nota retenida");

            // Y el arpegiador se queda mudo de verdad: en los diez bloques
            // siguientes no emite ni un solo evento.
            int eventos = 0;
            for (int b = 0; b < 10; ++b)
            {
                juce::MidiBuffer m;
                arp.generate (m, kBloque);
                eventos += m.getNumEvents();
            }
            expectEquals (eventos, 0, "sin notas retenidas el arpegiador deberia callarse");
        }

        //==============================================================================
        beginTest("Destino 72: la ruta que abre la rueda ALARGA el glide del secuenciador");
        {
            const auto sinSlew = medirGlide (0.0f, 0.0f, false);
            const auto medio    = medirGlide (0.5f, 127.0f, true);
            const auto tope     = medirGlide (1.0f, 127.0f, true);

            expect (sinSlew.llegaron, "sin slew el secuenciador tiene que cruzar el cero");
            expect (medio.llegaron, "con slew 0.5 tiene que llegar dentro de la ventana");
            expect (tope.llegaron, "con slew 1.0 tambien tiene que llegar dentro de la ventana");

            if (sinSlew.llegaron && medio.llegaron)
            {
                // Sin slew el salto es seco: el valor cae por debajo de cero en
                // la primera muestra del SEGUNDO paso. El primer paso dura la
                // mitad (swing recto), y el swing reparte el par, asi que el
                // segundo paso empieza en la mitad de un paso completo.
                const int segundoPaso = kSamplesPorPaso / 2;
                expect (std::abs (sinSlew.samples - segundoPaso) <= kBloque,
                    "sin slew el cruce deberia caer en el segundo paso ("
                    + juce::String (sinSlew.samples) + " vs " + juce::String (segundoPaso) + ")");

                // Y el glide de verdad. El tau del tope es un valor ELEGIDO (ver
                // `ControlSequencer::nextSample`), asi que no se comprueba contra
                // un numero exacto, sino contra un orden de magnitud y contra
                // que mas slew glide mas.
                // Y el glide de verdad. NO se comprueba contra el modelo
                // exponencial porque la constante de tiempo del tope es un valor
                // ELEGIDO (ver `ControlSequencer::nextSample`: "un segundo por
                // paso el tope ya es audiblemente un glide largo"), no algo que
                // venga del manual. Lo que si se comprueba es lo que se pide:
                // que la ruta ALARGA el glide, y mas cuanto mas profundo.
                expect (medio.samples - sinSlew.samples > 5000,
                    "slew 0.5 deberia retrasar el cruce mas de 5000 muestras ("
                    + juce::String (medio.samples - sinSlew.samples) + ")");
                expect (medio.samples > sinSlew.samples,
                    "cualquier slew positivo tiene que alargar el glide");
            }

            if (tope.llegaron)
                expect (tope.samples > medio.samples * 2,
                    "slew 1.0 deberia tardar mas del doble que slew 0.5 ("
                    + juce::String (tope.samples) + " vs " + juce::String (medio.samples) + ")");

            logMessage ("Seq Slew: seco en " + juce::String (sinSlew.samples)
                      + " muestras, slew 0.5 en " + juce::String (medio.samples)
                      + ", slew 1.0 en " + juce::String (tope.samples)
                      + " (ventana " + juce::String (tope.totalMuestras) + ")");
        }

        //==============================================================================
        beginTest("Destino 72: el glide es monotonico con la profundidad de la ruta");
        {
            const auto casiCero = medirGlide (0.1f, 127.0f, true);
            const auto medio    = medirGlide (0.5f, 127.0f, true);

            expect (casiCero.llegaron && medio.llegaron,
                    "las dos profundidades tienen que llegar dentro de la ventana");
            if (casiCero.llegaron && medio.llegaron)
                expect (medio.samples > casiCero.samples,
                    "mas profundidad de ruta debe alargar el glide ("
                    + juce::String (medio.samples) + " vs " + juce::String (casiCero.samples) + ")");

            logMessage ("Seq Slew monotono: 0.1 -> " + juce::String (casiCero.samples)
                      + " muestras, 0.5 -> " + juce::String (medio.samples));
        }

        //==============================================================================
        //==============================================================================
        beginTest("SONIDO: el 72 se oye, no solo se cuenta");
        {
            // La fuente del secuenciador se enruta al nivel del amplificador (59),
            // "VCA gain for all voices". Con los pasos en -1 y +1 la voz se abre y
            // se cierra del todo, porque el 59 se recorta a 0-1 y en el negativo el
            // amplificador queda mudo. Sin glide el salto es de una muestra; con el
            // 72 puesto el mismo salto tarda decenas de miles. Lo que se mide aqui
            // es cuando BAJA EL AUDIO, no cuando baja el valor del secuenciador.
            auto correr = [] (bool conRutaSlew, float amount)
            {
                SynthEngine engine;
                engine.prepare (kSr, kBloque);

                engine.getModulationMatrix().setRoute (0, ModSource::kControlSequencer,
                                                      ModDestination::kAmpLevel, 1.0f);
                if (conRutaSlew)
                    engine.getModulationMatrix().setRoute (1, ModSource::kModWheel,
                                                          ModDestination::kSeqSlew, amount);

                prepararSecuenciador (engine);
                // POSITIVO primero. Al reves la nota arrancaba ya muda, porque el
                // primer paso del secuenciador es el que suena al empezar: la voz
                // se abria en la marca del primer salto y no habia con que medir
                // una CAIDA, sino una subida.
                engine.getControlSequencer().setStep (1, +1.0f);
                engine.getControlSequencer().setStep (2, -1.0f);

                // La rueda de mod va en el primer bloque: el 72 se lee antes que
                // el MIDI del bloque, asi que su valor tarda uno en asentarse.
                juce::AudioBuffer<float> buffer (2, kBloque);
                buffer.clear();
                juce::MidiBuffer midi;
                midi.addEvent (juce::MidiMessage::controllerEvent (1, 1, conRutaSlew ? 127 : 0), 0);
                engine.processBlock (buffer, midi);

                return correrMotor (engine, 400, 60);
            };

            const auto seco    = correr (false, 0.0f);
            const auto glisado = correr (true, 0.5f);

            logMessage ("SONIDO Seq Slew seco    : " + trazaEnvolvente (seco, 26));
            logMessage ("SONIDO Seq Slew glisado : " + trazaEnvolvente (glisado, 26));

            // El -1 del glide es el resultado, no un fallo de la medicion: quiere
            // decir que el audio NUNCA se queda 512 muestras seguidas por debajo
            // del 20 %. Sin ruta se queda desde la muestra 2534 y no vuelve a
            // subir hasta el paso siguiente; con el glide se desliza y no
            // descarga nunca. Se deja en el log porque es el mismo hecho que
            // miden las tres aserciones de abajo, contado de otra manera.
            const int caidaSeco = primeraCaida (seco, 0.2f);
            const int caidaGli  = primeraCaida (glisado, 0.2f);
            logMessage ("SONIDO Seq Slew: el audio se queda bajo el 20 % en la muestra "
                      + juce::String (caidaSeco) + " sin ruta y en la "
                      + juce::String (caidaGli) + " con slew 0.5 (-1 = nunca se queda ahi)");

            // LO QUE SE MIDE ES EL SUELO DE LA ENVOLVENTE, NO CUANDO EMPIEZA A
            // BAJAR.
            //
            // El 72 hace que el secuenciador se deslice en vez de saltar: el
            // slew es un polo exponencial de tau = s segundos, y con la rueda a
            // 0.5 el objetivo se persigue peldaño a peldaño en vez de alcanzarse
            // de una vez. Al amplificador eso le llega como una rampa lenta que
            // se queda a medio camino entre el nivel del paso 1 y el del paso 2,
            // y por eso NUNCA LLEGA A CERRARSE. Sin ruta el mismo paso 2 lo
            // baja a cero digital en una muestra.
            //
            // O sea, la firma de un glide en el audio no es "tarda mas en
            // callarse" (eso solo es cierto con un salto lento de verdad) sino
            // "no llega a callarse". Y la traza de arriba lo ensena sin
            // discusion: sin ruta hay ventanas a 0.000, y con ruta el suelo es
            // 0.136 de un pico de 0.384, algo mas de un tercio del nivel.
            const float sueloSeco = nivelEnvolvente (seco, false);
            const float sueloGli  = nivelEnvolvente (glisado, false);
            const float picoSeco  = nivelEnvolvente (seco, true);

            const int tiraSeco = huecoMasLargo (seco, 0.2f);
            const int tiraGli  = huecoMasLargo (glisado, 0.2f);

            logMessage ("SONIDO Seq Slew: suelo de la envolvente "
                      + juce::String (sueloSeco, 9) + " sin ruta y "
                      + juce::String (sueloGli, 4) + " con slew 0.5; pico "
                      + juce::String (picoSeco, 4) + "; tira muda "
                      + juce::String (tiraSeco) + " y " + juce::String (tiraGli) + " muestras");

            // Sin ruta el amplificador se cierra DEL TODO. No sale un cero
            // EXACTO porque el nivel del amplificador va por un suavizado de
            // 1 ms (ampSmoothCoeff), y al final de la rampa queda un residuo
            // del orden de 1e-7: de -138 dB. La tolerancia es de una milima del
            // pico, o sea -60 dB, cuatro órdenes de magnitud por debajo de lo
            // que deja el glide y muy por debajo de lo que se oye. Ese silencio
            // es la prueba de que el 59 mueve de verdad el nivel; sin el, las
            // dos medidas siguientes no dirian nada.
            expect (sueloSeco < 0.001f * picoSeco,
                "sin ruta el paso 2 deberia cerrar el amplificador del todo, no dejarlo en "
                + juce::String (sueloSeco, 9));
            // Con el glide se queda por encima de un quinto del nivel y no baja
            // de ahi. Medido: 0.136 contra un pico de 0.384.
            expect (sueloGli > 0.2f * picoSeco,
                "con la ruta al 72 el amplificador deberia quedarse por encima de un quinto del nivel en vez de cerrarse (suelo "
                + juce::String (sueloGli, 4) + " contra un pico de " + juce::String (picoSeco, 4) + ")");
            // Y la cuenta de muestras mudas, que es lo mismo de otra manera:
            // 159 contra 8322, un factor de 52.
            expect (tiraGli < tiraSeco / 4,
                "con la ruta al 72 el AUDIO deberia pasar mucho menos tiempo en silencio ("
                + juce::String (tiraGli) + " contra " + juce::String (tiraSeco) + " muestras sin ruta)");
        }

        //==============================================================================
        beginTest("SONIDO: el 71 se oye, no solo se cuenta");
        {
            // Con el arpegiador sonando una sola nota retenida, una puerta corta
            // apaga la nota antes y el amplificador se va a cero antes del paso
            // siguiente: en el audio queda un hueco. Con la puerta larga la nota
            // sigue sonando cuando llega el paso, y el hueco es mucho mas
            // estrecho. Lo que se mide es el ANCHO de ese hueco, en el audio.
            //
            // EL PATCH NO ES EL DE FABRICA, Y HAY QUE DECIR POR QUE. El release
            // del amplificador de serie son 3 segundos (0.3 del mando por los 10 s
            // de escalado) y el paso del arpegiador dura 250 ms: con ese release
            // el amplificador no baja nunca antes del siguiente paso, y lo que
            // sale es un zumbido de voces solapadas en el que la puerta no se
            // puede OIR de ninguna manera. Por eso la envolvente va corta, que
            // es lo que hace cualquiera que componga un arpegio gateado, y por
            // eso el paso del arpegiador esta a 4 Hz: un cuarto de siglo de hueco
            // es ancho de sobra para que la diferencia se mida sin amplificar
            // nada.
            auto correr = [] (float amount)
            {
                SynthEngine engine;
                engine.prepare (kSr, kBloque);
                engine.setEnv1Times (0.005f, 0.05f, 0.8f, 0.02f);

                if (amount > 0.0f)
                    engine.getModulationMatrix().setRoute (0, ModSource::kPitchBend,
                                                          ModDestination::kArpGate, amount);

                engine.setArpGateBase (0.8f);
                auto& arp = engine.getArpeggiator();
                arp.setEnabled (true);
                arp.setMode (0);
                arp.setSwing (0.0f);
                arp.setOctaves (1);
                arp.setStepRateHz (4.0f);
                arp.prepare (kSr);
                arp.setGate (0.8f);

                // Solo la rueda, que es lo que el arpegiador no dispara. La nota
                // la pone `correrMotor` en su primer bloque; mandarla aqui
                // tambien la dispararia DOS veces, con dos voces sonando a la vez.
                juce::AudioBuffer<float> buffer (2, kBloque);
                juce::MidiBuffer midi;
                buffer.clear();
                midi.clear();
                midi.addEvent (juce::MidiMessage::pitchWheel (1, 0), 0);
                engine.processBlock (buffer, midi);

                return correrMotor (engine, 400, 60);
            };

            const auto puertaLarga = correr (0.0f);   // 0.8: la nota llena el paso
            const auto puertaCorta = correr (0.6f);   // 0.2: la nota se apaga antes

            const int huecoLargo = huecoMasLargo (puertaLarga, 0.2f);
            const int huecoCorto = huecoMasLargo (puertaCorta, 0.2f);

            logMessage ("SONIDO Arp Gate: hueco mas largo con puerta 0.8 = "
                      + juce::String (huecoLargo) + " muestras y con puerta 0.2 = "
                      + juce::String (huecoCorto));

            expect (huecoLargo > 0 && huecoCorto > 0,
                "las dos corridas deberian tener audio y al menos un hueco entre notas");
            // El paso dura 11025 muestras a 4 Hz. La puerta 0.8 deja el 20 % del
            // paso (2205 muestras) y la 0.2 el 80 % (8820), y el release se come
            // el mismo numero de muestras en las dos: la diferencia tiene que
            // ser de mas del triple, no de unas muestras.
            expect (huecoCorto > huecoLargo * 3,
                "con la puerta acortada el hueco entre notas deberia ser MAS DEL TRIPLE ("
                + juce::String (huecoCorto) + " contra " + juce::String (huecoLargo) + ")");
        }

        //==============================================================================
        beginTest("Arpegiador: UNA sola nota no tumba el proceso en ningun modo");
        {
            // POR QUE ESTE TEST EXISTE. Con una sola nota pulsada el pool del
            // arpegiador tiene n == 1, y los modos 2, 3, 4 y 5 calculan
            // `periodo = 2 * n - 2`, que vale CERO. `step % periodo` es una
            // division ENTERA: el proceso no devolvia un valor raro, MORIA con
            // 0xC0000094. Lo encontro el banco de pruebas al renderizar el patch
            // 25 de los dumps de fabrica, que lleva `arp_mode = 2`.
            //
            // No se puede comprobar el valor de salida porque no hay salida: la
            // asercion de este test es que el proceso sigue vivo. Si vuelve el
            // crash, la suite entera muere aqui y se nota.
            //
            // Se recorren los ONCE modos, no solo los cuatro del `periodo`,
            // porque el pool de una nota es un caso limite para todos y este
            // es el unico sitio donde se puede ver sin que se caiga antes.
            int notasDevueltas = 0;
            for (int modo = 0; modo <= 10; ++modo)
            {
                Arpeggiator solo;
                solo.setEnabled (true);
                solo.setMode (modo);
                solo.setSwing (0.0f);
                solo.setHold (false);
                solo.setKeySync (false);
                solo.setOctaves (1);
                solo.setStepRateHz (8.0f);
                solo.prepare (kSr);
                solo.setGate (0.8f);
                solo.noteOn (60, 0.9f);

                // 64 bloques son 16384 muestras, tres pasos a 8 Hz (5512
                // muestras cada uno). Con 8 bloques el arpegiador no llegaba ni
                // al primer paso y no emitia nada: el test pasaba sin comprobar
                // nada, que es peor que no tener test.
                // Los eventos se CUENTAN dentro del bucle de bloques. Sumarlos
                // despues solo contaria lo que quedo en el ultimo bloque, que
                // cae en mitad de una nota y no tiene por que tener nada.
                juce::MidiBuffer midi;
                int eventos = 0;
                for (int b = 0; b < 64; ++b)
                {
                    midi.clear();
                    solo.generate (midi, kBloque);
                    eventos += (int) midi.getNumEvents();
                }

                notasDevueltas += eventos;
            }

            expect (notasDevueltas > 0,
                "con una nota pulsada el arpegiador deberia emitir en algun modo, NO cero eventos");
        }

        //==============================================================================
        beginTest("Destino 72: sin ruta el glide no se mueve");
        {
            // La otra mitad del contrato: que el 72 depende de la ruta y no de
            // una constante olvidada en la clase. La rueda de mod al maximo SIN
            // ruta tiene que seguir dando el salto seco.
            const auto ruedaSinRuta = medirGlide (0.0f, 127.0f, false);
            const auto sinNada      = medirGlide (0.0f, 0.0f, false);

            expect (ruedaSinRuta.llegaron && sinNada.llegaron,
                    "las dos corridas secas deben cruzar el cero");
            if (ruedaSinRuta.llegaron && sinNada.llegaron)
                expect (std::abs (ruedaSinRuta.samples - sinNada.samples) <= kBloque,
                    "la rueda de mod sola no debe mover el glide: "
                    + juce::String (ruedaSinRuta.samples) + " vs " + juce::String (sinNada.samples));
        }
    }
};

static SynthEngineArpSeqUnitTests synthEngineArpSeqUnitTests;

} // namespace ABD