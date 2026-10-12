/**
 * @purpose Unit tests para los parametros de categoria "virtual"
 *          del registro (byteOffset 300-306), medidos POR AUDIO: se
 *          renderiza el motor a un buffer y se mide lo que sale, no
 *          lo que dice una variable interna.
 *
 *          Los seis parametros virtuales actuales:
 *            chord_enable (300), poly_chord_enable (301),
 *            chord_type (303), fx_feedback_gain (304),
 *            fx_send_level (305), vcf_voicing_mode (306).
 *
 *          chord_key (302) fue eliminado del registro: no corresponde
 *          al modelo del hardware DeepMind (ver test
 *          testChordKeyEliminado).
 *
 *          Los destinos 71 ("Arp Gate") y 72 ("Seq Slew") de la
 *          matriz de modulacion ya tienen su propia cobertura en
 *          SynthEngineUnitTests_ArpSeq.cpp: puerta medida de on a off
 *          y a traves del buffer de audio, y glide del secuenciador.
 *
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"
#include "ParametersSpec.h"

#include <algorithm>
#include <cmath>
#include <vector>

namespace ABD
{

static constexpr double kSr = 44100.0;
static constexpr int    kBloque = 256;

// Nota base de todas las corridas: Do4 (261.6 Hz).
static constexpr int kNota = 60;

//==============================================================================
// APVTS
//==============================================================================

/**
 * El motor NO tiene setters publicos para los parametros virtuales:
 * los lee de un APVTS en `updateParameters` (SynthEngine_Parameters.cpp).
 * Lo mismo el FX Engine, al que `SynthEngine::updateParameters` llama
 * al final. Por eso cada corrida construye su propio APVTS con el layout
 * real del plugin, escribe los valores y los empuja al motor con la
 * misma llamada que hace el procesador del plugin.
 *
 * En el layout los parametros "bool" y "enum" son AudioParameterChoice
 * (los bool son un choice de dos opciones, {"Off","On"}; ver
 * ParametersSpec::createLayout) y los "float" son AudioParameterFloat.
 * `setValueNotifyingHost` para los float, `operator=` (int) para los
 * choice, que es lo que redondea al entero y notifica al host.
 */
using ApvtsPtr = std::unique_ptr<juce::AudioProcessorValueTreeState>;

/**
 * El APVTS se ata a un AudioProcessor (su primer argumento es
 * una referencia, no un puntero). Este es el procesador mas
 * boring del mundo: no hace nada, la misma receta que
 * ProcesadorDelBanco en ModMatrixAudibleBench.cpp.
 */
class ProcesadorDePrueba final : public juce::AudioProcessor
{
public:
    const juce::String getName() const override { return "ABD VirtualParams Test"; }
    void prepareToPlay (double, int) override {}
    void releaseResources() override {}
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override {}
    bool isBusesLayoutSupported (const BusesLayout&) const override { return true; }
    juce::AudioProcessorEditor* createEditor() override { return nullptr; }
    bool hasEditor() const override { return false; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }
    int getNumPrograms() override { return 0; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}
    void getStateInformation (juce::MemoryBlock&) override {}
    void setStateInformation (const void*, int) override {}
    void reset() override {}
};

static ApvtsPtr nuevoApvts (juce::AudioProcessor& dueno)
{
    return std::make_unique<juce::AudioProcessorValueTreeState> (
        dueno, nullptr, "virtualParamsTests", ParametersSpec::createLayout());
}

static void ponerFloat (juce::AudioProcessorValueTreeState& apvts,
                         const char* id, float valor)
{
    if (auto* param = apvts.getParameter (id))
        param->setValueNotifyingHost (valor);
    else
        jassertfalse; // el id no esta en ParametersSpec
}

static void ponerEnum (juce::AudioProcessorValueTreeState& apvts,
                        const char* id, int indice)
{
    // Un choice se escribe con su operador= (int): la JUCE
    // convierte el indice a valor normalizado, lo notifica al
    // host y redondea al entero mas cercano (rango 0..n-1).
    if (auto* param = dynamic_cast<juce::AudioParameterChoice*> (apvts.getParameter (id)))
        *param = indice;
    else
        jassertfalse; // el id no es un choice en ParametersSpec
}

/** Empuja los valores del APVTS al motor y al FX Engine. */
static void aplicarParametros (SynthEngine& engine,
                                juce::AudioProcessorValueTreeState& apvts)
{
    engine.updateParameters (apvts);   // lee el motor Y el FX Engine
}

//==============================================================================
// Mediciones sobre el buffer de audio
//==============================================================================

/** Un evento MIDI en un bloque concreto de la corrida. */
struct EventoMidi
{
    int bloque;
    juce::MidiMessage msg;
};

static juce::MidiMessage notaOn (int nota)
{
    return juce::MidiMessage::noteOn (1, nota, (std::uint8_t) 100);
}

static juce::MidiMessage notaOff (int nota)
{
    return juce::MidiMessage::noteOff (1, nota);
}

/**
 * Corre el motor `bloques` veces, inyectando cada evento en su
 * bloque (posicion 0 del bloque). Devuelve el canal izquierdo.
 */
static juce::Array<float> render (SynthEngine& engine,
                                   const std::vector<EventoMidi>& eventos,
                                   int bloques)
{
    juce::Array<float> canal;
    canal.ensureStorageAllocated (bloques * kBloque);

    juce::AudioBuffer<float> buffer (2, kBloque);
    juce::MidiBuffer midi;

    size_t siguiente = 0;
    for (int b = 0; b < bloques; ++b)
    {
        buffer.clear();
        midi.clear();

        while (siguiente < eventos.size() && eventos[siguiente].bloque == b)
        {
            midi.addEvent (eventos[siguiente].msg, 0);
            ++siguiente;
        }

        engine.processBlock (buffer, midi);

        for (int s = 0; s < kBloque; ++s)
            canal.add (buffer.getSample (0, s));
    }

    return canal;
}

/** Energia (suma de cuadrados) entre dos muestras. */
static double energia (const juce::Array<float>& x, int desde, int hasta)
{
    double e = 0.0;
    const int fin = std::min (hasta, x.size());
    for (int i = std::max (0, desde); i < fin; ++i)
        e += (double) x[i] * (double) x[i];
    return e;
}

/**
 * Ventanas de medida. Toda corrida dura 4 segundos salvo que se
 * diga otra cosa.
 *
 *  - Nota sostenida: los dos primeros segundos. La nota entra en el
 *    bloque 0 y NO se suelta, asi que toda la ventana es el cuerpo
 *    de la nota (con envolvente de ataque y release a cero).
 *  - Cola temprana: muestras 1024..16384. La nota se suelta en el
 *    bloque 1 (muestra 256), asi que esta ventana esta ya en la
 *    cola, a 23-372 ms: donde todavia se oye la reverb.
 *  - Cola tardia: la segunda mitad de la corrida, a mas de un
 *    segundo de soltar la nota: donde solo quedan las repeticiones
 *    de un delay realimentado.
 */
static constexpr int kVentanaNotaDesde  = 0;
static constexpr int kVentanaNotaHasta  = (int) (kSr * 2.0);   // 88200
static constexpr int kBloquesNota       = kVentanaNotaHasta / kBloque;

static constexpr int kColaTempranaDesde = 1024;
static constexpr int kColaTempranaHasta = 16384;

static constexpr int kVentanaColaDesde  = (int) (kSr * 2.0);   // 88200
static constexpr int kVentanaColaHasta  = (int) (kSr * 4.0);   // 176400
static constexpr int kBloquesCola       = kVentanaColaHasta / kBloque;

//==============================================================================
// El test
//==============================================================================

class SynthEngineVirtualParamsUnitTests : public juce::UnitTest
{
public:
    SynthEngineVirtualParamsUnitTests()
        : juce::UnitTest ("SynthEngine virtual params (audio)", "ABD") {}

    void runTest() override
    {
        testChordEnable ();
        testPolyChordEnable ();
        testChordKeyEliminado ();
        testChordType ();
        testFxSendLevel ();
        testFxFeedbackGain ();
        testFxFeedbackGainStability ();
        testVcfVoicingMode ();
    }

private:
    // ========================================================================
    /** Una corrida: motor + APVTS. Se construye FRESCA para cada
     *  render, porque el motor es determinista (drift a cero y matriz
     *  de modulacion vacia por defecto) pero tiene estado que se
     *  arrastra entre renders sobre un mismo objeto: voces, filtros
     *  ZDF y, sobre todo, la cola del FX Engine. Con un motor fresco
     *  por corrida, dos corridas con los mismos parametros rinden
     *  exactamente lo mismo, y comparar dos configuraciones distintas
     *  mide solo lo que cambia el parametro, no la historia.
     *
     *  La configuracion base deja la señal SECA (FX en bypass) y la
     *  envolvente casi instantanea, que es lo que quieren los tests de
     *  acorde y voicing. Los tests de FX ponen su propio modo.
     */
    struct Corrida
    {
        SynthEngine engine;
        ProcesadorDePrueba dueno;   // antes que apvts: el APVTS
                                     // se ata a el y vive menos
        ApvtsPtr apvts;

        Corrida() : apvts (nuevoApvts (dueno))
        {
            engine.prepare (kSr, kBloque);

            // Envolvente corta: ataque casi nulo y release rapido, para
            // que la nota suene de inmediato y la cola que quede sea
            // del efecto y no de la envolvente.
            ponerFloat (*apvts, "env1_attack", 0.0f);
            ponerFloat (*apvts, "env1_release", 0.0f);

            // Filtro abierto: que no opaque las comparaciones de nivel.
            ponerFloat (*apvts, "vcf_cutoff", 1.0f);
            ponerFloat (*apvts, "vcf_resonance", 0.0f);

            // FX en bypass: senal seca de los osciladores, sin cola
            // de reverb ni saturacion coloreando la medida.
            ponerEnum (*apvts, "fx_mode", 2);

            // Imagen centrada. Con el valor por defecto del panel
            // (vca_pan_spread = 0) el abanico de voces se invierte y la
            // voz 1 se va toda al canal derecho (pan 1.0, ver
            // SynthVoice_Process.cpp:558): una nota sola en un motor
            // fresco sale MUDA por el canal izquierdo, que es el que
            // miden estos tests. Raw 128 (0.5) es "all voices center".
            ponerFloat (*apvts, "vca_pan_spread", 0.5f);

            aplicarParametros (engine, *apvts);
        }

        void aplicar() { aplicarParametros (engine, *apvts); }
    };

    // ========================================================================
    void testChordEnable()
    {
        beginTest ("chord_enable: una nota se expande a triada (mas energia)");

        // Una nota sola: una voz.
        Corrida simple;
        const auto notaSola = render (simple.engine, { { 0, notaOn (kNota) } }, kBloquesNota);
        const double energiaSimple = energia (notaSola, kVentanaNotaDesde, kVentanaNotaHasta);

        // Con chord_enable y una Major triada: {0, 4, 7}.
        Corrida conAcorde;
        ponerEnum (*conAcorde.apvts, "chord_enable", 1);
        ponerEnum (*conAcorde.apvts, "chord_type", 1);   // Major
        conAcorde.aplicar();

        const auto acorde = render (conAcorde.engine, { { 0, notaOn (kNota) } }, kBloquesNota);
        const double energiaAcorde = energia (acorde, kVentanaNotaDesde, kVentanaNotaHasta);

        // Tres voces en vez de una. No es exactamente x3 (las
        // frecuencias se suman en fase algunas veces y cancelan
        // otras), pero triplicar el numero de osciladores no puede
        // dejar el nivel igual.
        expect (energiaSimple > 0.0,
                "sin chord_enable la nota tiene que sonar");

        expect (energiaAcorde > energiaSimple * 1.8,
                "chord_enable deberia multiplicar la energia (3 voces): "
                + juce::String (energiaAcorde) + " vs "
                + juce::String (energiaSimple));
    }

    // ========================================================================
    void testPolyChordEnable()
    {
        beginTest ("poly_chord_enable: expande cada nota a acorde (solo, sin chord_enable)");

        // poly_chord_enable funciona solo: con chord_enable a cero,
        // una nota disparada en modo poly sigue expandiendose a la
        // triada del chord_type, porque el disparo pasa por
        // triggerChordForRoot (SynthEngine_MIDI.cpp:48).
        Corrida simple;
        const auto unaVoz = render (simple.engine, { { 0, notaOn (kNota) } }, kBloquesNota);
        const double energiaSimple = energia (unaVoz, kVentanaNotaDesde, kVentanaNotaHasta);

        Corrida poly;
        ponerEnum (*poly.apvts, "chord_enable", 0);
        ponerEnum (*poly.apvts, "poly_chord_enable", 1);
        ponerEnum (*poly.apvts, "chord_type", 1);   // Major, 3 notas
        poly.aplicar();

        const auto acorde = render (poly.engine, { { 0, notaOn (kNota) } }, kBloquesNota);
        const double energiaAcorde = energia (acorde, kVentanaNotaDesde, kVentanaNotaHasta);

        expect (energiaSimple > 0.0,
                "sin poly_chord_enable la nota tiene que sonar");

        expect (energiaAcorde > energiaSimple * 1.8,
                "poly_chord_enable deberia expandir la nota a 3 voces: "
                + juce::String (energiaAcorde) + " vs "
                + juce::String (energiaSimple));

        beginTest ("poly_chord_enable: soltar una raiz deja la otra sonando");

        /**
         * Dos raices (60 y 64). Al soltar la 60, su acorde
         * desaparece y solo queda el de 64 (SynthEngine_MIDI.cpp,
         * releaseNote con polyChordEnable: libera las voces cuya
         * nota RAIZ coincide). Con poly, la energia posterior al
         * release es la de un acorde de 3 voces; sin poly, la de
         * la nota 64 sola.
         */
        const std::vector<EventoMidi> eventos = {
            { 0, notaOn (60) },
            { 2, notaOn (64) },
            { 4, notaOff (60) }
        };

        Corrida conPoly;
        ponerEnum (*conPoly.apvts, "chord_enable", 0);
        ponerEnum (*conPoly.apvts, "poly_chord_enable", 1);
        ponerEnum (*conPoly.apvts, "chord_type", 1);
        conPoly.aplicar();

        const auto canalPoly = render (conPoly.engine, eventos, kBloquesCola);
        // Tras soltar la raiz 60 (bloque 4 = muestra 1024): el
        // acorde de 64 sigue a pleno.
        const double despuesPoly = energia (canalPoly, 2048, 8192);

        Corrida sinPoly;
        ponerEnum (*sinPoly.apvts, "chord_enable", 0);
        ponerEnum (*sinPoly.apvts, "poly_chord_enable", 0);
        sinPoly.aplicar();

        const auto canalSimple = render (sinPoly.engine, eventos, kBloquesCola);
        const double despuesSimple = energia (canalSimple, 2048, 8192);

        expect (despuesSimple > 0.0,
                "sin poly_chord_enable la nota 64 tiene que seguir sonando");

        expect (despuesPoly > despuesSimple * 1.8,
                "al soltar la raiz 60, el acorde de 64 (3 voces) deberia "
                "sonar mas que la nota sola: "
                + juce::String (despuesPoly) + " vs "
                + juce::String (despuesSimple));
    }

    // ========================================================================
    void testChordKeyEliminado()
    {
        beginTest ("chord_key: eliminado del registro (no es parametro del host)");

        /**
         * DECISION DE DISENO: `chord_key` fue eliminado del registro de
         * parametros (ParametersSpec, registry, bridge) porque no
         * corresponde al modelo del hardware DeepMind.
         *
         * El hardware tiene Chord Memory como memoria global sin chord_key
         * editable: la raiz es la nota que se pulsa al grabar, y el
         * acorde se transporta segun la nota que se toca despues.
         * Poly Chord es mapeo de teclas disparadoras (trigger keys), no
         * un parametro suelto de raiz.
         *
         * Este test confirma que chord_key ya no existe en el APVTS:
         * intentar acceder a el devuelve nullptr. El motor sigue
         * teniendo chordEnable/polyChordEnable/chordType como miembros
         * (leidos desde otros parametros del spec), pero chordKey como
         * parametro controlable fue eliminado.
         *
         * Si en el futuro se decide implementar tonalidad/raiz editable
         * como feature de software, este test se reescribira para medir
         * el cambio por audio.
         */
        // Usar el APVTS de una Corrida (que usa el layout real del host)
        Corrida c;
        if (auto* param = c.apvts->getParameter("chord_key"))
        {
            expect (false,
                    "chord_key deberia haber sido eliminado del registro: "
                    "el parametro sigue en el APVTS");
        }
        else
        {
            expect (true,
                    "chord_key fue eliminado del registro correctamente");
        }
    }

    // ========================================================================
    void testChordType()
    {
        beginTest ("chord_type: cada tipo rinde un acorde distinto");

        /**
         * La tabla de intervalos (SynthEngine_VoiceManager.cpp:9) da
         * formas distintas: Memory {0,4,7,12,16,19}, Major {0,4,7},
         * Minor {0,3,7}, Aug {0,4,8}, Dim {0,3,6}, Sus2 {0,2,7},
         * Sus4 {0,5,7}, 7th {0,4,7,10}. Se mide la forma de onda
         * completa: dos tipos distintos no pueden renderizar lo
         * mismo, porque al menos una de las notas del acorde cambia
         * de altura.
         */
        juce::Array<float> anterior;
        for (int tipo = 0; tipo <= 7; ++tipo)
        {
            Corrida c;
            ponerEnum (*c.apvts, "chord_enable", 1);
            ponerEnum (*c.apvts, "chord_type", tipo);
            c.aplicar();

            const auto actual = render (c.engine, { { 0, notaOn (kNota) } }, kBloquesCola);
            const double e = energia (actual, kVentanaNotaDesde, kVentanaNotaHasta);

            expect (e > 0.0,
                    "chord_type " + juce::String (tipo) + " tiene que sonar");

            if (tipo > 0)
            {
                double diferencia = 0.0;
                for (int i = 0; i < actual.size(); ++i)
                    diferencia += std::abs ((double) actual[i] - (double) anterior[i]);

                expect (diferencia > 1.0e-6,
                        "chord_type " + juce::String (tipo) + " deberia sonar "
                        "distinto del " + juce::String (tipo - 1)
                        + ": diferencia " + juce::String (diferencia));
            }

            anterior = actual;
        }

        beginTest ("chord_type: Memory es la version de seis notas");
        {
            // Memory {0,4,7,12,16,19} contra Major {0,4,7}: mas notas,
            // mas energia, y las dos comparten la triada.
            Corrida mayor;
            ponerEnum (*mayor.apvts, "chord_enable", 1);
            ponerEnum (*mayor.apvts, "chord_type", 1);   // Major
            mayor.aplicar();
            const auto mayorCanal = render (mayor.engine, { { 0, notaOn (kNota) } }, kBloquesCola);

            Corrida memoria;
            ponerEnum (*memoria.apvts, "chord_enable", 1);
            ponerEnum (*memoria.apvts, "chord_type", 0);   // Memory
            memoria.aplicar();
            const auto memoriaCanal = render (memoria.engine, { { 0, notaOn (kNota) } }, kBloquesCola);

            expect (energia (memoriaCanal, kVentanaNotaDesde, kVentanaNotaHasta)
                    > energia (mayorCanal, kVentanaNotaDesde, kVentanaNotaHasta) * 1.5,
                    "Memory (6 notas) deberia tener mas energia que Major (3)");
        }
    }

    // ========================================================================
    void testFxSendLevel()
    {
        beginTest ("fx_send_level: mueve la mezcla seco/humedo en modo Send");

        /**
         * FXEngine::process (FXEngine.cpp:133): en modo Send (fx_mode=1)
         * la salida es `seco * (1 - sendLevel) + procesado * sendLevel`.
         * Con FX1 a reverb y mix 1.0, un sendLevel alto deja mas cola
         * de reverb y menos seco; un sendLevel bajo, al reves.
         *
         * Se mide la cola temprana (muestras 1024..16384, tras el
         * note-off en la muestra 256): ahi ya no hay señal seca, así
         * que con send a 0 no queda nada y con send a 1 solo queda
         * lo que la reverb devuelve.
         */
        auto hacerCorrida = [] (float send)
        {
            Corrida c;
            ponerEnum (*c.apvts, "fx_mode", 1);        // Send
            ponerEnum (*c.apvts, "fx1_type", 1);       // HallReverb
            ponerEnum (*c.apvts, "fx2_type", 0);       // Bypass: la cola es solo de FX1
            ponerFloat (*c.apvts, "fx1_mix", 1.0f);    // todo wet dentro del slot
            ponerFloat (*c.apvts, "fx_send_level", send);
            c.aplicar();
            return render (c.engine,
                           { { 0, notaOn (kNota) }, { 1, notaOff (kNota) } },
                           kBloquesCola);
        };

        const auto seco = hacerCorrida (0.0f);
        const auto humedo = hacerCorrida (1.0f);

        const double colaSeco = energia (seco, kColaTempranaDesde, kColaTempranaHasta);
        const double colaHumedo = energia (humedo, kColaTempranaDesde, kColaTempranaHasta);

        expect (colaHumedo > colaSeco * 2.0,
                "send a 1.0 deberia dejar mas cola de reverb que send a 0.0: "
                + juce::String (colaHumedo) + " vs " + juce::String (colaSeco));

        // Y la cola es sonido de verdad, no ruido numerico: tiene que
        // estar muy por encima del suelo de una corrida sin nota, con
        // el mismo FX puesto.
        Corrida silencio;
        ponerEnum (*silencio.apvts, "fx_mode", 1);
        ponerEnum (*silencio.apvts, "fx1_type", 1);
        ponerEnum (*silencio.apvts, "fx2_type", 0);
        ponerFloat (*silencio.apvts, "fx1_mix", 1.0f);
        ponerFloat (*silencio.apvts, "fx_send_level", 1.0f);
        silencio.aplicar();

        const auto canalSilencio = render (silencio.engine, {}, kBloquesCola);
        const double piso = energia (canalSilencio, kColaTempranaDesde, kColaTempranaHasta);

        expect (colaHumedo > piso * 100.0,
                "la cola con send a 1.0 tiene que estar muy por encima del "
                "suelo del efecto: " + juce::String (colaHumedo) + " vs "
                + juce::String (piso));
    }

    // ========================================================================
    void testFxFeedbackGain()
    {
        beginTest ("fx_feedback_gain: realimenta la cadena en ruteo 9");

        /**
         * FXEngine::processSeriesWithFeedback (FXEngine_Routing.cpp):
         * con fx_routing=9 la salida de la cadena se mezcla a la
         * entrada del siguiente bloque con `fbGain`. A 0 la cadena es
         * series normal; a 0.5 la cola se alarga porque la salida se
         * realimenta.
         *
         * Hallazgo del engine: con fx1_type=Delay (feedback interno
         * 0.3), la ganancia de lazo total es fbGain x 1/(1-0.3) =
         * fbGain x 1.43, que con fbGain alto supera 1. La correccion
         * de processSeriesWithFeedback limita la señal de feedback a
         * ±1 antes de mezclarla, así que el lazo se satura en vez de
         * divergir (la regresion a fbGain = 1.0 es
         * testFxFeedbackGainStability). Este test mide el efecto
         * funcional: a 0.5 la cola se alarga.
         *
         * FX1 a delay (tipo 13) para que haya repeticiones que
         * realimentar, mix y gain a 1. La cola tardia (mas de un
         * segundo despues de soltar la nota) solo la sostiene la
         * realimentacion.
         */
        auto hacerCorrida = [] (float fb)
        {
            Corrida c;
            ponerEnum (*c.apvts, "fx_mode", 0);         // Insert: la cadena procesa el buffer
            ponerEnum (*c.apvts, "fx_routing", 9);     // Series with Feedback
            ponerEnum (*c.apvts, "fx1_type", 13);      // Delay
            ponerEnum (*c.apvts, "fx2_type", 0);       // Bypass: la realimentacion es de delay puro
            ponerFloat (*c.apvts, "fx1_mix", 1.0f);
            ponerFloat (*c.apvts, "fx1_gain", 1.0f);
            ponerFloat (*c.apvts, "fx_feedback_gain", fb);
            c.aplicar();
            return render (c.engine,
                           { { 0, notaOn (kNota) }, { 1, notaOff (kNota) } },
                           kBloquesCola);
        };

        const auto sinRealimentar = hacerCorrida (0.0f);
        const auto realimentado = hacerCorrida (0.5f);

        const double colaCero = energia (sinRealimentar, kVentanaColaDesde, kVentanaColaHasta);
        const double colaNueve = energia (realimentado, kVentanaColaDesde, kVentanaColaHasta);

        expect (colaNueve > colaCero * 2.0,
                "fbGain 0.5 deberia alargar la cola frente a 0.0: "
                + juce::String (colaNueve) + " vs " + juce::String (colaCero));
    }

    // ========================================================================
    void testFxFeedbackGainStability()
    {
        beginTest ("fx_feedback_gain: estabilidad a ganancia maxima");

        /**
         * Regresion de la inestabilidad de processSeriesWithFeedback
         * (FXEngine_Routing.cpp): con fx1_type=Delay el feedback
         * interno del delay (0.3) da una ganancia de cadena de
         * ~1/(1-0.3) ≈ 1.43, y con fx_feedback_gain a 1.0 (su
         * maximo) la ganancia de lazo total supera 1. Antes de la
         * correccion el lazo divergia exponencialmente a NaN; ahora
         * la señal de feedback se limita a ±1 antes de mezclarse,
         * así que el lazo se satura a un nivel sostenido.
         *
         * Se rueda a fbGain = 1.0 con un delay en la cadena, 4
         * segundos, y se verifica que TODAS las muestras sean
         * finitas (ni NaN ni Inf) y que la señal quede acotada.
         */
        Corrida c;
        ponerEnum (*c.apvts, "fx_mode", 0);         // Insert: la cadena procesa el buffer
        ponerEnum (*c.apvts, "fx_routing", 9);      // Series with Feedback
        ponerEnum (*c.apvts, "fx1_type", 13);       // Delay (feedback interno 0.3)
        ponerEnum (*c.apvts, "fx2_type", 0);        // Bypass
        ponerFloat (*c.apvts, "fx1_mix", 1.0f);
        ponerFloat (*c.apvts, "fx1_gain", 1.0f);
        ponerFloat (*c.apvts, "fx_feedback_gain", 1.0f);
        c.aplicar();

        const auto canal = render (c.engine,
                                   { { 0, notaOn (kNota) }, { 1, notaOff (kNota) } },
                                   kBloquesCola);

        int noFin = 0;
        float maxAbs = 0.0f;
        for (float v : canal)
        {
            if (!std::isfinite ((double) v))
                ++noFin;
            else
                maxAbs = std::max (maxAbs, std::abs (v));
        }

        expect (noFin == 0,
                "fbGain a 1.0 con delay no debe diverger a NaN/Inf: "
                + juce::String (noFin) + " muestras no finitas de "
                + juce::String (canal.size()));

        // Y el feedback sigue realimentando: la cola tardia
        // tiene energia (lazo sostenido), no es silencio.
        const double cola = energia (canal, kVentanaColaDesde, kVentanaColaHasta);
        expect (cola > 0.0,
                "la cola tardia con fbGain a 1.0 deberia tener energia: "
                + juce::String (cola));

        // Acotada: el limitador de feedback capa el lazo, la
        // señal se satura en vez de crecer sin control.
        expect (maxAbs < 8.0f,
                "la señal con fbGain a 1.0 debe quedar acotada (max "
                + juce::String (maxAbs) + ")");
    }

    // ========================================================================
    void testVcfVoicingMode()
    {
        beginTest ("vcf_voicing_mode: DeepMind y Juno-106 suenan distinto");

        /**
         * SynthVoice_Filter.cpp (activo en AMBOS modelos de target,
         * no esta dentro de `#if DEEP_TARGET_MODEL >= 2`):
         * `vcfVoicingMode` 0 = DeepMind, 1 = Juno-106, y cambia el
         * modo del filtro ZDF (JunoVCF_ZDF::setMode, JunoVCF_ZDF.cpp):
         * curva de resonancia, compensacion de ganancia y saturacion de
         * etapa distintos.
         *
         * Para que la diferencia se oiga hace falta resonancia: sin ella
         * los dos modos pasan la señal casi igual. Con resonancia alta
         * y cutoff medio, la compensacion de ganancia de DeepMind y su
         * saturacion de etapa separan las dos señales.
         */
        Corrida deepmind;
        ponerFloat (*deepmind.apvts, "vcf_cutoff", 0.35f);
        ponerFloat (*deepmind.apvts, "vcf_resonance", 0.85f);
        ponerEnum (*deepmind.apvts, "vcf_voicing_mode", 0);   // DeepMind
        deepmind.aplicar();

        const auto canalDeepMind = render (deepmind.engine, { { 0, notaOn (kNota) } }, kBloquesCola);
        const double energiaDeepMind = energia (canalDeepMind, kVentanaNotaDesde, kVentanaNotaHasta);

        Corrida juno;
        ponerFloat (*juno.apvts, "vcf_cutoff", 0.35f);
        ponerFloat (*juno.apvts, "vcf_resonance", 0.85f);
        ponerEnum (*juno.apvts, "vcf_voicing_mode", 1);   // Juno-106
        juno.aplicar();

        const auto canalJuno = render (juno.engine, { { 0, notaOn (kNota) } }, kBloquesCola);
        const double energiaJuno = energia (canalJuno, kVentanaNotaDesde, kVentanaNotaHasta);

        expect (energiaDeepMind > 0.0 && energiaJuno > 0.0,
                "los dos modos de voicing tienen que sonar");

        double diferencia = 0.0;
        for (int i = 0; i < canalDeepMind.size(); ++i)
            diferencia += std::abs ((double) canalDeepMind[i] - (double) canalJuno[i]);

        expect (diferencia > 1.0e-4,
                "DeepMind y Juno-106 deberian renderizar distinto: "
                "diferencia " + juce::String (diferencia));

        // Y la forma de onda no es solo un cambio de nivel: la energia
        // total tambien se separa (la compensacion de ganancia de
        // DeepMind reduce la salida con resonancia alta).
        expect (std::abs (energiaJuno - energiaDeepMind) > energiaDeepMind * 0.05,
                "la energia de los dos voicing deberia separarse: "
                + juce::String (energiaDeepMind) + " vs "
                + juce::String (energiaJuno));
    }
};

static SynthEngineVirtualParamsUnitTests synthEngineVirtualParamsUnitTests;

} // namespace ABD
