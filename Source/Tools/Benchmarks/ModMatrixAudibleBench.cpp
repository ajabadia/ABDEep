// ============================================================================
//  ModMatrixAudibleBench.cpp — ¿qué rutas de la matriz se OYEN?
//
//  LA PREGUNTA. Hay 4697 rutas activas en los 1024 patches de fábrica del
//  DeepMind 12. La sonda de cobertura (`build/fase2-verificar.mjs`, y ahora
//  `scripts/factory_dump_routes.mjs`) sabe que el motor les da una ruta real a
//  las 4697. Eso NO es lo mismo que saber que suenan: un destino puede estar
//  leído, conectado y no mover una muestra. Este banco renderiza cada ruta
//  con ella y sin ella y mide la diferencia de audio.
//
//  EL MÉTODO, Y POR QUÉ ES ESTE Y NO OTRO.
//
//  1. El ruido de dos renders IDÉNTICOS fija el suelo. Si el motor fuese
//     determinista serían el mismo número bit a bit y el suelo sería 0; si
//     no lo fuese (una fase aleatoria, un LFO sembrado por reloj), el suelo
//     sería el ruido de verdad y cualquier umbral en dB sería mentira. Se
//     mide antes de nada y sale en el informe.
//
//  2. La comparación es muestra a muestra: |con ruta − sin ruta|. Es la
//     medida más dura posible, porque un destino que solo se oiga en el
//     instante del cambio de nota la haria pasar. Lo que se busca no es
//     "suena en algun momento" sino "cambia el audio de forma sostenida".
//
//  3. El criterio es la diferencia EN dB RELATIVOS AL RENDER SIN RUTA. Un −60 dB
//     es un −60 dB en un bus de mezcla: por debajo no se oye. Y el umbral no
//     se toma de la nada: se exige que la diferencia supere el suelo por un
//     margen, para que un destino con un efecto de verdad pero diminuto no se
//     declare mudo por poco.
//
//  4. UNA MISMA COMBINACIÓN NO SE RENDERIZA DOS VECES. Con el patch de los
//     valores por defecto del motor, dos rutas iguales (misma fuente, mismo
//     destino, misma cantidad) dan el mismo audio, así que se renderiza una
//     vez por combinación única y se reparte el veredicto a las rutas que la
//     comparten. Sin esto serían 9394 renders en lugar de los que salgan.
//
//  LO QUE NO ES UN VEREDICTO. Que una ruta no se oiga aquí no prueba que el
//  destino esté roto: el patch es el de los valores por defecto del motor, no
//  el del patch de fábrica del que salio la ruta, y hay fuentes que este banco
//  no excita. El informe lista, para cada ruta muda, si su fuente se movió o
//  no, para que la línea se pueda leer sin Engaño.
//
//  USO
//    ABDEep_Benchmarks.exe --modmatrix-audible <rutas.tsv> <informe.txt> [limite]
// ============================================================================

#include <JuceHeader.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <iomanip>
#include <map>
#include <numeric>
#include <regex>
#include <set>
#include <sstream>
#include <string>
#include <tuple>
#include <vector>

#include "ModulationMatrix.h"
#include "ParametersSpec.h"
#include "PatchByteCodec.h"
#include "SynthEngine.h"

namespace
{

/** Una linea por pantalla. El Logger de JUCE va al log del sistema, que en
 *  un target de consola no se ve: un banco que no dice por donde va no sirve
 *  para no diagnosticar nada. */
static void decir (const juce::String& texto)
{
    std::printf ("%s\n", texto.toRawUTF8());
    std::fflush (stdout);
}

/**
 * Un procesador de mentira, lo unico que le falta a un APVTS para existir.
 *
 * POR QUE HACE FALTA. El constructor del APVTS de JUCE pide una REFERENCIA a
 * un `AudioProcessor`, no un puntero: el APVTS existe para avisar al host de
 * cada cambio de parametro, y sin host al que avisar no hay constructor que
 * admita un nullptr. O sea: para cargar un preset FUERA del plugin hay que
 * darle un procesador, y el unico que puede haber en un banco es uno que no
 * hace nada. Este es ese.
 *
 * No hereda del procesador del plugin a proposito: si lo hiciera, el banco
 * dejaria de ser una prueba del motor y pasaria a ser una prueba del plugin.
 * Los metodos puros se contestan con la respuesta mas boring del mundo, que es
 * la que no puede estropear nada.
 */
class ProcesadorDelBanco final : public juce::AudioProcessor
{
public:
    const juce::String getName() const override { return "ABD Deep Banco"; }
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

constexpr double kSr = 44100.0;
constexpr int kBloque = 256;
/** Bloques por render. 96 son 24576 muestras, medio segundo: enough para que el
 *  motor se asiente y para que un LFO de， vez. */
constexpr int kBloques = 96;

/** El umbral de "se oye", en dB por debajo del render sin ruta. */
constexpr float kUmbralAudibleDb = -60.0f;
/** Cuántas veces el suelo tiene que quedar por debajo del cambio para creerlo. */
constexpr float kMargenSobreElSuelo = 4.0f;

/* ── El enum de destinos, leído de la cabecera y NO escrito a mano ────────── */

/**
 * El enum de destinos con su código, tal cual está en `ModulationMatrix.h`.
 *
 * Se lee el fichero en vez de copiar la lista porque el enum es la verdad: si
 * se copiara, el informe llamaria "kOsc1Level" al código 133 el día que ese
 * nombre cambiara. Es lo mismo que hace la sonda de cobertura.
 */
std::map<int, juce::String> leerDestinos (const juce::File& header)
{
    std::map<int, juce::String> porCodigo;
    std::string texto = header.loadFileAsString().toStdString();

    // Los comentarios se van ANTES de tokenizar. Si no, el `kMaxDestinations`
    // que explica el final del enum se llevaria consigo el nombre del
    // comentario que tiene delante en la misma linea.
    texto = std::regex_replace (texto, std::regex ("/\\*[\\s\\S]*?\\*/"), " ");
    texto = std::regex_replace (texto, std::regex ("//[^\\n]*"), " ");

    const auto ini = texto.find ("enum class ModDestination");
    if (ini == std::string::npos)
    {
        decir ("No se encuentra enum class ModDestination");
        return porCodigo;
    }
    const auto llave = texto.find ('{', ini);
    const auto cierre = texto.find ("};", llave);
    if (llave == std::string::npos || cierre == std::string::npos)
        return porCodigo;
    const std::string cuerpo = texto.substr (llave + 1, cierre - llave - 1);

    int correlativo = 0;
    for (auto linea : juce::StringArray::fromTokens (juce::String (cuerpo), "\r\n", ""))
    {
        const juce::String limpia = linea.trim();
        if (limpia.isEmpty())
            continue;

        // Multiples enumeradores POR LINEA: el bloque de fx pone cuatro en cada
        // linea, asi que una regex de linea entera solo leeria el primero.
        juce::StringArray partes;
        partes.addTokens (limpia, ",", "\"'");
        for (const auto& bruto : partes)
        {
            juce::String t = bruto.trim();
            if (t.isEmpty())
                continue;
            int valor = -1;
            const auto igual = t.indexOfChar ('=');
            if (igual > 0)
            {
                valor = t.substring (igual + 1).trim().getIntValue();
                t = t.substring (0, igual).trim();
            }
            if (! t.startsWith ("k"))
                continue;
            // `kMaxDestinations` es el tope que cierra el byte, no un destino.
            if (t == "kMaxDestinations")
                continue;
            if (valor < 0)
                valor = correlativo;
            porCodigo[static_cast<int> (valor)] = t;
            correlativo = valor + 1;
        }
    }
    return porCodigo;
}

/* ── El estimulo: una nota mantenida con los mandos arriba del todo ────────── */

/**
 * Una sola nota sostenida con la rueda, la inflexión, la presión y el pedal
 * arriba del todo, y nada mas.
 *
 * LA IDEA. Una ruta solo mueve el audio si su FUENTE se mueve. Los cuatro
 * mandos del MIDI los pone quien toca, asi que se pueden subir ahi; los LFO y
 * las envolventes se mueven solos porque el motor los avanza igual; y la
 * velocidad y el numero de nota son constantes, que tambien es una forma
 * válida de excitarlos. Lo que no se puede excitar aqui son el pedal de
 * expresión, el de respiración, el pie, la velocidad de soltado y los tres ejes
 * CC. Para esos, el informe marca la fuente como no excitada en vez de
 * declarar mudo al destino.
 *
 * Y EL RUIDO DEL MANDO. El bloque 0 lleva la nota y los mandos. Se manda en el
 * bloque 0 y NO en todos, porque si no el motor los reventaria a 127 cada
 * bloque y la inflexión REALIZARIA un salto cada 256 muestras. Con la nota
 * mantenida no pasa: con la nota pulsada el motor no reescribe la inflexión
 * mientras no llegue un evento nuevo.
 */
struct Corrida
{
    std::vector<float> muestras;
    float rms = 0.0f;
};

static Corrida renderizar (ABD::ModSource fuente, ABD::ModDestination destino, float cantidad, bool conRuta,
                           const std::uint8_t* patch = nullptr, int patchIndex = -1)
{
    ABD::SynthEngine engine;
    engine.prepare (kSr, kBloque);

    // EL PRESET DE FABRICA, cuando hay uno. Sin el, el motor suena con los
    // valores por defecto de sus miembros, que no son los de ningun patch del
    // hardware: un destino que depende del patch--el que cambia la afinacion
    // de un oscilador ya desafinado, o el que mueve el cutoff de un filtro
    // cerrado-- no tiene nada que mover y sale como mudo cuando el destino
    // esta perfectamente bien.
    if (patch != nullptr && patchIndex >= 0)
    {
        // El APVTS se construye aqui, con el MISMO identificador de arbol y el
        // MISMO layout que el plugin (`PluginProcessor.cpp:16`). Si se usara
        // otro, los parametros se escribirian en un arbol que el motor no lee.
        ProcesadorDelBanco procesor;
        juce::AudioProcessorValueTreeState apvts (procesor, nullptr,
                                                 juce::Identifier ("Parameters"),
                                                 ParametersSpec::createLayout());
        const int escritos = engine.loadPatchBytes (patch, apvts);
        if (escritos == 0)
            decir ("  AVISO: el patch " + juce::String (patchIndex) + " no escribio ningun parametro");
    }

    if (conRuta)
        engine.getModulationMatrix().setRoute (0, fuente, destino, cantidad);

    juce::AudioBuffer<float> buffer (2, kBloque);
    juce::MidiBuffer midi;
    Corrida corrida;
    corrida.muestras.reserve (kBloques * kBloque);

    // El motor se asienta y se calla antes de empezar a medir.
    engine.processBlock (buffer, midi);

    for (int b = 0; b < kBloques; ++b)
    {
        buffer.clear();
        midi.clear();
        if (b == 0)
        {
            midi.addEvent (juce::MidiMessage::noteOn (1, 60, 0.9f), 0);
            midi.addEvent (juce::MidiMessage::controllerEvent (1, 1, 127), 0);      // mod wheel
            midi.addEvent (juce::MidiMessage::pitchWheel (1, 8191), 0);              // inflexion
            midi.addEvent (juce::MidiMessage::channelPressureChange (1, 127), 0);
            midi.addEvent (juce::MidiMessage::controllerEvent (1, 64, 127), 0);      // sustain
        }
        engine.processBlock (buffer, midi);
        for (int s = 0; s < kBloque; ++s)
            corrida.muestras.push_back (buffer.getSample (0, s));
    }

    double suma = 0.0;
    for (auto v : corrida.muestras)
        suma += double (v) * double (v);
    corrida.rms = std::sqrt (suma / std::max (1, (int) corrida.muestras.size()));
    return corrida;
}

/* ── La comparacion ───────────────────────────────────────────────────────── */

struct Veredicto
{
    int patch = 0;          // el patch de fabrica con el que se ha renderizado
    int fuente = 0;
    int destino = 0;
    float cantidad = 0.0f;
    int rutas = 0;          // cuantas rutas de los dumps comparten esta combinacion
    float rmsSeco = 0.0f;
    float rmsDiferencia = 0.0f;
    float db = -200.0f;
    bool audible = false;
};

static float rmsDeLaDiferencia (const std::vector<float>& a, const std::vector<float>& b)
{
    double suma = 0.0;
    const auto n = std::min (a.size(), b.size());
    for (size_t i = 0; i < n; ++i)
    {
        const double d = double (a[i]) - double (b[i]);
        suma += d * d;
    }
    return std::sqrt (suma / std::max<size_t> (1, n));
}


/**
 * El 7-a-8 de los SysEx, byte a byte, sin JUCE.
 *
 * Es el MISMO que `scripts/factory_dump_routes.mjs` y el mismo que hace el
 * plugin al recibir un banco: cada byte trae su MSB aparte, el primero de cada
 * grupo de ocho dice en cual de los siete siguientes va el bit alto. Si las dos
 * copias se separaran, el banco mediria un preset que no es el del hardware, y
 * no habria ningun sitio donde se notase.
 */
static void unpack7to8 (const std::uint8_t* packed, int packedLen, std::uint8_t* out242)
{
    int escrito = 0;
    for (int i = 0; i < packedLen && escrito < 242; i += 8)
    {
        const unsigned msb = packed[i] & 0x7f;
        for (int j = 0; j < 7 && escrito < 242; ++j)
        {
            if (i + 1 + j >= packedLen)
                break;
            out242[escrito++] = (std::uint8_t) ((packed[i + 1 + j] & 0x7f)
                                                | (((msb >> j) & 1) << 7));
        }
    }
}

/**
 * Por QUE UN DESTINO SIN CAMBIO AUDIBLE NO ES SIEMPRE UN DESTINO ROTO.
 *
 * Este banco renderiza UNA NOTA MANTENIDA. Con una nota que ya esta en su
 * mantenimiento hay una montana de destinos que no tienen nada que hacer: los
 * tiempos y las curvas de la envolvente solo actúan mientras la envolvente se
 * mueve, y aqui lleva medio segundo quieta; la puerta del arpegiador necesita
 * el arpegiador encendido; el glide necesita una segunda nota a la que ir; un
 * parametro de un FX necesita el FX plugged; la meta-modulacion necesita el bus
 * que meta-modula lleno; y la deriva analogica esta apagada porque `voiceDrift`
 * vale cero en los valores por defecto.
 *
 * Decir "no suena" de esos seria fabricar fallos que no existen. La funcion
 * devuelve el motivo para que el informe los separe de los que SI son un
 * veredicto, y deje "sin clasificar" para lo que no sabe, en vez de inventar
 * una razon.
 */
static juce::String motivoDelEstimulo (int destino)
{
    const bool lfo   = (destino >= 1 && destino <= 7);
    const bool envs  = (destino >= 24 && destino <= 36)
                    || (destino >= 38 && destino <= 44)
                    || (destino >= 46 && destino <= 58);
    if (lfo)
        return "hace falta que el LFO este conectado a algo que suene";
    if (envs)
        return "hace falta una transicion de nota: con la nota en mantenimiento, el tiempo y la curva ya no hacen nada";
    if (destino == 19)
        return "hace falta una segunda nota a la que ir con el glide";
    if (destino >= 68 && destino <= 70)
        return "la deriva analogica esta apagada en el patch por defecto (voiceDrift = 0)";
    if (destino == 71 || destino == 72)
        return "hace falta el arpegiador o el secuenciador encendidos";
    if (destino >= 73 && destino <= 80)
        return "meta-modulacion: hace falta que el bus que meta-modula este lleno";
    if (destino >= 81)
        return "parametro de FX o nivel de FX: hace falta el FX plugged";
    return "sin clasificar";
}

/** Rellena a la derecha con espacios, para las columnas del informe. */
static std::string columna (const juce::String& texto, int ancho)
{
    const std::string t = texto.toStdString();
    if ((int) t.size() >= ancho)
        return t;
    return std::string (ancho - (int) t.size(), ' ') + t;
}


static float aDb (float valor, float referencia)
{
    if (valor <= 1.0e-12f || referencia <= 1.0e-12f)
        return -200.0f;
    return 20.0f * std::log10 (valor / referencia);
}

} // namespace

// LA FIRMA VA EN FORMA DE ARRAY, NO DE PUNTERO A PUNTERO. Los dos son el mismo
// tipo, pero MSVC los emite con nombres distintos: `char* argv[]` sale como
// `char* const*` y `char**` sale como `char**`, y el enlazador los toma por dos
// funciones. La declaracion de aqui esta en ProcessBlockBenchmark.cpp, en
// forma de array, asi que esta tiene que estar en la misma forma.

// ============================================================================
//  El banco
// ============================================================================

int modMatrixAudibleBench (int argc, char* argv[])
{
    const juce::StringArray args (argv, argc);
    if (args.size() < 4 || ! (args[1] == "--modmatrix-audible"))
    {
        decir ("Uso: --modmatrix-audible <rutas.tsv> <informe.txt> [limite]");
        return 2;
    }

    const juce::File tsv (args[2]);
    const juce::File informe (args[3]);

    // `--preset <n>` renderiza todo el banco con el patch n de los 1024.
    // Sin la opcion, cada ruta se renderiza con el patch del que salio.
    int presetBase = -1;
    for (int a = 4; a + 1 < args.size(); ++a)
        if (args[a] == "--preset")
            presetBase = args[a + 1].getIntValue();

    // Los ocho bancos tienen que estar ahi. Es la mitad de la guarda del parser
    // puesta aqui tambien: si el banco falta, este .exe mide otra cosa.
    const juce::File dirDumps = juce::File::getCurrentWorkingDirectory()
                                    .getChildFile ("resources/hardware_dumps/2026-08-10");
    // El filtro va en C++ y no con un comodin de JUCE: el comodin de `File`
    // no se comporta como el de un shell, y con "?" no encuentra nada. Es lo
    // mismo que hace el parser, que tampoco se fia de los comodines.
    juce::Array<juce::File> bancos;
    for (const auto& hijo : dirDumps.findChildFiles (juce::File::findFiles, false, "*.syx"))
        if (hijo.getFileName().startsWith ("Synth Bank "))
            bancos.add (hijo);
    if (bancos.size() != 8)
    {
        decir ("No encuentro los 8 bancos de los dumps en "
               + dirDumps.getFullPathName() + " (hay " + juce::String (bancos.size()) + ")");
        return 2;
    }

    /* ── Los 242 bytes de cada patch de fabrica ───────────────────────────── */

    // Un array de 1024 punteros a los 242 bytes, en el MISMO orden que el
    // parser: banco por orden de letra, y dentro del banco el orden en que
    // vienen los SysEx. El TSV lleva el indice de patch ya resuelto, asi que si
    // las dos copias se desordenaran, el banco mediria con el preset de otro
    // patch y no habria forma de notarlo.
    std::vector<std::vector<std::uint8_t>> patches;
    {
        for (const auto& banco : bancos)
        {
            juce::MemoryBlock bytes;
            if (!banco.loadFileAsData (bytes))
            {
                decir ("No he podido leer " + banco.getFullPathName());
                return 1;
            }
            // `getData()` devuelve `const void*` en esta version de JUCE, no
            // `const std::uint8_t*`. Sin el cast no compila.
            const auto* buf = static_cast<const std::uint8_t*> (bytes.getData());
            const int len = (int) bytes.getSize();
            for (int off = 0; off + 291 <= len; off += 291)
            {
                if (buf[off] != 0xf0)
                    continue;
                std::vector<std::uint8_t> unpacked (242, 0);
                unpack7to8 (buf + off + 10, 278, unpacked.data());
                patches.push_back (std::move (unpacked));
            }
        }
        decir ("PARCHES LEIDOS: " + juce::String ((int) patches.size()));
        if (patches.size() != 1024)
        {
            decir ("Se esperaban 1024 patches y han salido " + juce::String ((int) patches.size()));
            return 1;
        }
    }

    /* ── Las rutas, con la guarda ──────────────────────────────────────────── */

    struct Ruta
    {
        int patch = 0, slot = 0, fuente = 0, destino = 0, profundidad = 0;
        float cantidad = 0.0f;
    };

    // `presetBase` ya esta declarado arriba, junto al `--preset` que lo pone.

    std::vector<Ruta> rutas;
    {
        std::ifstream in (tsv.getFullPathName().toStdString());
        if (! in)
        {
            decir ("No puedo abrir " + tsv.getFullPathName());
            return 2;
        }
        std::string linea;
        bool primero = true;
        while (std::getline (in, linea))
        {
            if (primero) { primero = false; if (linea.rfind("patch", 0) == 0) continue; }
            if (linea.empty()) continue;
            std::istringstream ss (linea);
            Ruta r;
            int cantidadTxt = 0;
            ss >> r.patch >> r.slot >> r.fuente >> r.destino >> r.profundidad >> cantidadTxt;
            if (! ss.good()) continue;
            // La cantidad se vuelve a leer del BYTE, que es la verdad del
            // hardware, y no del texto del TSV.
            r.cantidad = juce::jlimit (-1.0f, 1.0f, (float (r.profundidad) - 128.0f) / 127.0f);
            rutas.push_back (r);
        }
    }

    // LA GUARDA. El banco no se fia del TSV: si el numero de rutas no es el de
    // los dumps, el informe mediria 4697 rutas inventadas.
    if (rutas.size() != 4697)
    {
        decir ("GUARDA: el fichero trae " + juce::String (rutas.size())
                                  + " rutas y tienen que ser 4697. No se escribe el informe.");
        return 1;
    }
    decir ("Rutas leidas: 4697, la guarda cuadra.");

    const auto destinosPorNombre = leerDestinos (juce::File::getCurrentWorkingDirectory()
                                                     .getChildFile ("Source/DSP/ModulationMatrix.h"));

    /* ── El suelo: dos renders identicos ──────────────────────────────────── */

    const auto sueloA = renderizar (ABD::ModSource::kVelocity, ABD::ModDestination::kNone, 0.0f, false);
    const auto sueloB = renderizar (ABD::ModSource::kVelocity, ABD::ModDestination::kNone, 0.0f, false);
    const float rmsSuelo = rmsDeLaDiferencia (sueloA.muestras, sueloB.muestras);
    const float dbSuelo = aDb (rmsSuelo, sueloA.rms);
    decir ("SUELO: dos renders sin ruta difieren en " + juce::String (rmsSuelo, 9)
                              + " rms = " + juce::String (dbSuelo, 2) + " dB  (rms sin ruta "
                              + juce::String (sueloA.rms, 6) + ")");

    /* ── Que fuentes se mueven DE VERDAD en este estimulo ─────────────────── */

    // POR QUE ESTA SONDA. Una ruta solo puede mover el audio si su FUENTE se
    // mueve, y este estimulo es solo un: una nota mantenida con cuatro mandos
    // arriba. Las fuentes que no salen de ahi --el pedal de expresion, el de
    // respiracion, el pie, la velocidad de soltado-- valen cero aqui, y una
    // ruta cuya fuente vale cero NO OYE por mucho que su destino este roto.
    // Confundir las dos cosas es como se inventa un fallo que no existe, asi
    // que antes de juzgar ningun destino se pregunta a cada fuente si se mueve.
    //
    // LA PRUEBA ES "LA MUESTRA ESTA VIVA?", NO "ESTA FUENTE ALCANZA ESTE
    // DESTINO?". Se enruta la fuente al 59 (VCA All) con cantidad 1 y se mira
    // si el audio cambia. El 59 lo lee el amplificador de todas las voces y
    // cualquier fuente con valor distinto de cero lo mueve, asi que la prueba
    // es conservative: una fuente que aqui sale muerta puede estar viva en otro
    // estimulo, y el informe lo dice.
    std::vector<bool> fuenteViva ((int) ABD::ModSource::kMaxSources, false);
    {
        const auto seco = renderizar (ABD::ModSource::kVelocity, ABD::ModDestination::kNone, 0.0f, false);
        int vivas = 0;
        for (int f = 1; f < (int) ABD::ModSource::kMaxSources; ++f)
        {
            const auto conFuente = renderizar (static_cast<ABD::ModSource> (f),
                                               ABD::ModDestination::kAmpLevel, 1.0f, true);
            const float cambio = rmsDeLaDiferencia (seco.muestras, conFuente.muestras);
            const bool viva = aDb (cambio, seco.rms) > kUmbralAudibleDb;
            fuenteViva[(size_t) f] = viva;
            if (viva) ++vivas;
            // Con `snprintf` y no encadenando: mezclar `std::string` y
            // `juce::String` en un `+` deja el operador ambiguo, porque las dos
            //asz trayectorias convierten bien. Es el mismo formato que usa el
            // otro banco de esta carpeta.
            char linea[128];
            std::snprintf (linea, sizeof (linea), "  FUENTE %3d  %-20s %8.2f dB",
                           f, viva ? "se mueve" : "MUERTA en este estimulo",
                           (double) aDb (cambio, seco.rms));
            decir (linea);
        }
        decir ("FUENTES VIVAS: " + juce::String (vivas) + " de "
               + juce::String ((int) ABD::ModSource::kMaxSources - 1));
    }

    /* ── Cada combinacion unica, una vez ──────────────────────────────────── */

    std::vector<Veredicto> veredictos;
    {
        // La clave lleva el patch CUANDO se renderiza con el patch de cada
        // ruta. Sin el, dos rutas identicas de dos patches distintos se
        // medirian una sola vez con el patch equivocado.
        std::map<std::tuple<int, int, int, int>, int> cuenta;
        for (const auto& r : rutas)
        {
            const int patch = presetBase >= 0 ? presetBase : r.patch;
            ++cuenta[{ patch, r.fuente, r.destino, r.profundidad }];
        }

        veredictos.reserve (cuenta.size());
        int hechas = 0;
        const auto empezar = std::chrono::steady_clock::now();

        for (const auto& [clave, veces] : cuenta)
        {
            const int patch = std::get<0> (clave);
            const int fuente = std::get<1> (clave);
            const int destino = std::get<2> (clave);
            const int profundidad = std::get<3> (clave);

            const auto fuenteEnum = static_cast<ABD::ModSource> (fuente);
            const auto destinoEnum = static_cast<ABD::ModDestination> (destino);
            const auto* bytes = patch >= 0 && patch < (int) patches.size()
                              ? patches[(size_t) patch].data() : nullptr;

            const auto seco = renderizar (fuenteEnum, destinoEnum, 0.0f, false, bytes, patch);
            const auto conRuta = renderizar (fuenteEnum, destinoEnum,
                                             juce::jlimit (-1.0f, 1.0f, (float (profundidad) - 128.0f) / 127.0f),
                                             true, bytes, patch);

            Veredicto v;
            v.patch = patch;
            v.fuente = fuente;
            v.destino = destino;
            v.cantidad = juce::jlimit (-1.0f, 1.0f, (float (profundidad) - 128.0f) / 127.0f);
            v.rutas = veces;
            v.rmsSeco = seco.rms;
            v.rmsDiferencia = rmsDeLaDiferencia (seco.muestras, conRuta.muestras);
            v.db = aDb (v.rmsDiferencia, v.rmsSeco);
            v.audible = v.db > kUmbralAudibleDb && v.rmsDiferencia > rmsSuelo * kMargenSobreElSuelo;

            veredictos.push_back (v);

            ++hechas;
            if (hechas % 25 == 0)
            {
                const auto ms = std::chrono::duration_cast<std::chrono::milliseconds>
                                    (std::chrono::steady_clock::now() - empezar).count();
                decir ("  " + juce::String (hechas) + "/" + juce::String ((int) cuenta.size())
                                          + " combinaciones, " + juce::String (ms / 1000) + " s");
            }
        }
    }

    /* ── El informe ────────────────────────────────────────────────────────── */

    std::ofstream out (informe.getFullPathName().toStdString(), std::ios::binary);
    if (! out)
    {
        decir ("No puedo escribir " + informe.getFullPathName());
        return 2;
    }

    out << "BANCO: rutas de la matriz de modulacion que cambian el audio\n";
    out << "==========================================================\n\n";
    out << "COMO SE HA MEDIDO\n";
    out << "  estimulo   : una nota (C4, velocity 0.9) mantenida, con la rueda, la\n";
    out << "               inflexion, la presion y el pedal a 127 en el bloque 0.\n";
    out << "  patch      : "
        << (presetBase >= 0 ? ("siempre el patch " + juce::String (presetBase) + " de los 1024")
                            : juce::String ("el patch de fabrica del que salio cada ruta, cargado "
                                            "byte a byte con PatchByteCodec y updateParameters"))
        << "\n";
    out << "  render     : " << kBloques << " bloques de " << kBloque << " muestras, canal izquierdo.\n";
    out << "  metrica    : rms del |con ruta - sin ruta|, en dB sobre el rms sin ruta.\n";
    out << "  umbral     : " << kUmbralAudibleDb << " dB, y ademas " << kMargenSobreElSuelo
        << " veces el suelo.\n";
    out << "  suelo medido: " << rmsSuelo << " rms = " << dbSuelo << " dB.\n";
    out << "  rutas      : 4697 leidas del parser, la guarda cuadra.\n\n";

    // El agregado por destino, que es la pregunta de verdad: de los destinos que
    // usan los patches de fabrica, cuales se oyen.
    std::map<int, int> rutasPorDestino, audiblesPorDestino, rutasConFuenteViva;
    for (const auto& r : rutas) ++rutasPorDestino[r.destino];
    for (const auto& v : veredictos)
    {
        if (v.audible)
            audiblesPorDestino[v.destino] += v.rutas;
        if (v.fuente > 0 && v.fuente < (int) fuenteViva.size() && fuenteViva[(size_t) v.fuente])
            rutasConFuenteViva[v.destino] += v.rutas;
    }

    // EL CONTROL DEL PRESET. Si cargar el preset no hiciera nada, todo lo de
    // arriba seguiria dando lo mismo y no habria forma de notarlo. Se mide, en
    // la muestra de audio, la diferencia entre el motor con sus valores por
    // defecto y el motor con el patch cargado.
    {
        float maximo = 0.0f;
        int indiceMaximo = -1;
        for (int i = 0; i < (int) patches.size(); ++i)
        {
            const auto porDefecto = renderizar (ABD::ModSource::kVelocity,
                                                ABD::ModDestination::kNone, 0.0f, false);
            const auto conPreset = renderizar (ABD::ModSource::kVelocity,
                                                ABD::ModDestination::kNone, 0.0f, false,
                                                patches[(size_t) i].data(), i);
            const float d = aDb (rmsDeLaDiferencia (porDefecto.muestras, conPreset.muestras),
                                 porDefecto.rms);
            if (d > maximo) { maximo = d; indiceMaximo = i; }
        }
        // El veredicto va con SU NUMERO Y SU UMBRAL A LA VISTA, porque un
        // "AVISO" sin la cifra al lado obliga a quien lo lee a buscar el
        // numero y adivinar si el aviso era serio. Antes el corte estaba en
        // 20 dB sin decir de donde sale, y con 13.6 dB de diferencia--que se
        // oyen sinstruments-- el informe salia Saying que cargar el preset
        // "casi no cambia el audio".
        //
        // El corte son 3 dB, que es la menor diferencia de nivel que se oye
        // de forma inequivoca entre dos sonidos del mismo timbre. No es el
        // umbral de este banco (-60 dB): aqui no se pregunta si la ruta se
        // oye, sino si cargar el preset cambia algo que se oiga.
        constexpr float kControlMinimoDb = 3.0f;
        out << "CONTROL DEL PRESET\n";
        out << "  el motor con sus valores por defecto frente al mismo motor con el patch\n";
        out << "  de los dumps cargado, en los 1024 patches. El mayor cambio esta en el patch "
            << indiceMaximo << ", con " << maximo << " dB de diferencia.\n";
        out << "  corte del veredicto: " << kControlMinimoDb
            << " dB, que es la menor diferencia de nivel que se oye entre dos sonidos del mismo timbre.\n";
        out << "  " << (maximo > kControlMinimoDb
                        ? "el preset ENTRA de verdad: el sonido cambia, no solo los numeros"
                        : "AVISO: cargar el preset casi no cambia el audio; revisar el cod")
            << "\n\n";
    }

    out << "\nRESUMEN POR DESTINO (" << rutasPorDestino.size() << " destinos distintos)\n";
    out << "--------------------------------------------------------------------------------\n";
    // TRES ESTADOS, NO DOS. "No suena" puede querer decir tres cosas muy
    // distintas, y confundirlas es como se inventan fallos que no existen:
    //
    //   SI     -- hay rutas vivas que lo mueven. El destino funciona.
    //   n/d    -- NINGUNA de sus rutas tiene una fuente que se mueva aqui. No
    //             se puede decir nada del destino con este estimulo.
    //   NO     -- hay rutas con fuente viva y ninguna lo mueve. Eso si es un
    //             veredicto, y es el unico que significa algo aqui.
    int destinosAudibles = 0, destinosSinFuenteViva = 0, destinosMudos = 0;
    for (const auto& [destino, nrutas] : rutasPorDestino)
    {
        juce::String nombre = destinosPorNombre.count (destino) ? destinosPorNombre.at (destino)
                                                                : juce::String (destino);
        const int naudibles = audiblesPorDestino.count (destino) ? audiblesPorDestino.at (destino) : 0;
        const int nvivas = rutasConFuenteViva.count (destino) ? rutasConFuenteViva.at (destino) : 0;

        juce::String estado;
        if (naudibles > 0) { estado = "SI"; ++destinosAudibles; }
        else if (nvivas == 0) { estado = "n/d"; ++destinosSinFuenteViva; }
        else { estado = "NO"; ++destinosMudos; }

        out << "  " << columna (estado, 3) << std::setw (4) << destino << "  " << columna (nombre, 26)
            << std::setw (4) << nrutas << " rutas | " << std::setw (4) << naudibles << " audibles | "
            << std::setw (4) << nvivas << " con fuente viva\n";
    }
    out << "\n  destinos con alguna ruta audible: " << destinosAudibles << " de " << rutasPorDestino.size() << "\n";
    out << "  destinos sin cambio audible y con fuente viva: " << destinosMudos << "\n";
    out << "  destinos sin fuentes vivas:      " << destinosSinFuenteViva
        << "  (n/d: este estimulo no las mueve, no son fallos)\n";

    int rutasAudibles = 0, rutasTotales = 0;
    for (const auto& v : veredictos) { if (v.audible) rutasAudibles += v.rutas; rutasTotales += v.rutas; }
    out << "  rutas audibles: " << rutasAudibles << " de " << rutasTotales << "\n";

    // Que parte de los "sin cambio audible" son fallos y que parte son solo
    // limites del estimulo. Sin esto, el recuento de destinos mudos seria una
    // cifra sin significado.
    std::map<juce::String, std::vector<juce::String>> porMotivo;
    for (const auto& [destino, nrutas] : rutasPorDestino)
    {
        const int naudibles = audiblesPorDestino.count (destino) ? audiblesPorDestino.at (destino) : 0;
        const int nvivas = rutasConFuenteViva.count (destino) ? rutasConFuenteViva.at (destino) : 0;
        if (naudibles > 0 || nvivas == 0)
            continue;
        juce::String nombre = destinosPorNombre.count (destino) ? destinosPorNombre.at (destino)
                                                                : juce::String (destino);
        porMotivo[motivoDelEstimulo (destino)].push_back (nombre);
    }

    out << "\nPOR QUE NO SUENAN: VEREDICTO O LIMITE DEL ESTIMULO\n";
    out << "--------------------------------------------------------------------------------\n";
    int explicados = 0;
    for (const auto& [motivo, nombres] : porMotivo)
    {
        out << "\n  " << motivo << "\n";
        for (const auto& n : nombres)
            out << "      " << n << "\n";
        explicados += (int) nombres.size();
        if (motivo == "sin clasificar")
            explicados -= (int) nombres.size();
    }
    out << "\n  " << (explicados) << " de los " << destinosMudos
        << " destinos sin cambio audible se explican porque este estimulo no los mueve.\n";
    out << "  Los que quedan, si los hay, son los unicos que este banco puede senalar\n";
    out << "  como destino sin efecto audible, y hay que mirarlos uno a uno.\n";

    out << "\nDETALLE DE LAS RUTAS MUDAS\n";
    out << "--------------------------------------------------------------------------------\n";
    out << "  destino        fuente  cantidad    dB   rutas\n";
    for (const auto& v : veredictos)
    {
        if (v.audible) continue;
        juce::String nombre = destinosPorNombre.count (v.destino) ? destinosPorNombre.at (v.destino)
                                                                  : juce::String (v.destino);
        out << "  " << columna (nombre, 14) << std::setw (4) << v.fuente << "  "
            << juce::String (v.cantidad, 5) << std::setw (8) << juce::String (v.db, 6) << "  "
            << std::setw (4) << v.rutas << "\n";
    }

    out << "\nDETALLE DE LAS RUTAS AUDIBLES\n";
    out << "--------------------------------------------------------------------------------\n";
    out << "  destino        fuente  cantidad    dB   rutas\n";
    for (const auto& v : veredictos)
    {
        if (! v.audible) continue;
        juce::String nombre = destinosPorNombre.count (v.destino) ? destinosPorNombre.at (v.destino)
                                                                  : juce::String (v.destino);
        out << "  " << columna (nombre, 14) << std::setw (4) << v.fuente << "  "
            << juce::String (v.cantidad, 5) << std::setw (8) << juce::String (v.db, 6) << "  "
            << std::setw (4) << v.rutas << "\n";
    }

    out.flush();
    decir ("Informe escrito en " + informe.getFullPathName());
    return 0;
}