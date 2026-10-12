/** @purpose Unit tests de audio para los destinos mecánicos de la matriz de
 *          modulación que todavía no tenían cobertura por audio: se monta una
 *          ruta simple ModWheel → destino y se mide que el motor cambia su
 *          salida, midiendo energía sobre el buffer de audio.
 *
 *          Los destinos 71 (Arp Gate) y 72 (Seq Slew) ya tienen su propia
 *          cobertura en SynthEngineUnitTests_ArpSeq.cpp; este fichero cubre
 *          distintos.
 *
 * @classification Test
 */
#include <JuceHeader.h>
#include "SynthEngine.h"
#include "ModulationMatrix.h"

namespace ABD
{

class SynthEngineModDestinosMecanicosAudioUnitTests : public juce::UnitTest
{
public:
    static constexpr double kTestSampleRate = 44100.0;
    static constexpr int    kBlock         = 512;
    static constexpr int    kBloques       = 20;   // ~22 ms por nota sostenida

    SynthEngineModDestinosMecanicosAudioUnitTests()
        : juce::UnitTest ("SynthEngine mod destinos mecánicos (audio)", "ABD") {}

    void runTest() override
    {
        // Medir energía total (canales L+R) en la cola del bloque, saltando el
        // ataque, para que cada destino se juzgue por lo que escucha el motor.
        auto energiaCola = [&](const juce::AudioBuffer<float>& buf) -> double
        {
            constexpr int desde = kBlock / 2;
            constexpr int hasta = kBlock;
            double e = 0.0;
            for (int s = desde; s < hasta; ++s)
            {
                e += (double) buf.getSample(0, s) * (double) buf.getSample(0, s)
                   + (double) buf.getSample(1, s) * (double) buf.getSample(1, s);
            }
            return e;
        };

        // Renderizado de una nota con una ruta ModWheel → destino dada.
        // `wheelArriba` indica si el CC1 (ModWheel) parte al 127 (ruta activa)
        // o al 0 (ruta inactiva).
        auto renderConRuta = [&](ModDestination destino, float cantidad,
                                  bool wheelArriba) -> double
        {
            SynthEngine engine;
            engine.prepare (kTestSampleRate, kBlock);

            auto& mod = engine.getModulationMatrix();
            mod.clear();
            mod.setRoute (0, ModSource::kModWheel, destino, cantidad);

            juce::AudioBuffer<float> buf (2, kBlock);
            juce::MidiBuffer midi;
            midi.addEvent (juce::MidiMessage::noteOn (1, 60, 0.9f), 0);
            if (wheelArriba)
                midi.addEvent (juce::MidiMessage::controllerEvent (1, 1, 127), 0);

            engine.processBlock (buf, midi);
            return energiaCola (buf);
        };

        // =====================================================================
        beginTest ("kNoiseLevel (65): ModWheel alza el nivel de ruido del motor");
        {
            // Destino 65 = Noise Level. Al subir la ruta, el motor añade ruido
            // al output y la energia medida debe subir.
            const double conRuta = renderConRuta (ModDestination::kNoiseLevel, 1.0f, true);
            const double sinRuta = renderConRuta (ModDestination::kNoiseLevel, 0.0f, false);

            expect (conRuta > sinRuta * 1.1,
                    "ruta ModWheel→NoiseLevel debe subir la energia: "
                    + juce::String (conRuta, 6) + " vs " + juce::String (sinRuta, 6));
            expect (conRuta > 0.0,
                    "ruta ModWheel→NoiseLevel con ruta activa debe sonar: "
                    + juce::String (conRuta, 6));
        }

        // =====================================================================
        beginTest ("kFilterCutoff (20): ModWheel abre el VCF y el motor sube la energia");
        {
            // Destino 20 = VCF Freq. Por defecto el motor parte con el filtro ya
            // abierto (vcfCutoff = 1.0), con lo que un amount positivo de ModWheel no
            // sube la energia_medida porque el filtro ya no puede abrirse mas. Para que
            // el test mida un salto de energia real, preparamos el motor con el filtro
            // cerrado (vcfCutoff = 0.0) en todas las voces y reseteamos el smoothed
            // cutoff para que no suavice desde un estado ya abierto; asi, al subir el
            // wheel con la ruta activa, el filtro se abre y la energia sube respecto a
            // la ruta inactiva.
            auto renderConRutaConFiltroCerrado = [&](float cantidad, bool wheelArriba) -> double
            {
                SynthEngine engine;
                engine.prepare (kTestSampleRate, kBlock);

                // Filtro cerrado de forma artificial para que la ruta tenga margen de
                // apertura y la medicion sea audible.
                engine.setVcfCutoff (0.0f);

                auto& mod = engine.getModulationMatrix();
                mod.clear();
                mod.setRoute (0, ModSource::kModWheel, ModDestination::kFilterCutoff, cantidad);

                juce::AudioBuffer<float> buf (2, kBlock);
                juce::MidiBuffer midi;
                midi.addEvent (juce::MidiMessage::noteOn (1, 60, 0.9f), 0);
                if (wheelArriba)
                    midi.addEvent (juce::MidiMessage::controllerEvent (1, 1, 127), 0);

                engine.processBlock (buf, midi);
                return energiaCola (buf);
            };

            const double conRuta = renderConRutaConFiltroCerrado (1.0f, true);
            const double sinRuta = renderConRutaConFiltroCerrado (0.0f, false);

            expect (conRuta > sinRuta * 1.1,
                    "ruta ModWheel→FilterCutoff con filtro cerrado inicial debe abrirlo y subir la energia: "
                    + juce::String (conRuta, 6) + " vs " + juce::String (sinRuta, 6));
            expect (conRuta > 0.0,
                    "ruta ModWheel→FilterCutoff con ruta activa debe sonar: "
                    + juce::String (conRuta, 6));
        }

        // =====================================================================
        beginTest ("kFilterHPFCutoff (66): ModWheel sube el HPF y el motor pierde bajos");
        {
            // Destino 66 = HP Freq. Con amount positivo, al subir el wheel el HPF sube y
            // el motor atenua los bajos, por lo que la energia medida en cola baja
            // respecto a la ruta inactiva.
            const double conRuta = renderConRuta (ModDestination::kFilterHPFCutoff, 1.0f, true);
            const double sinRuta = renderConRuta (ModDestination::kFilterHPFCutoff, 0.0f, false);

            expect (conRuta > 0.0,
                    "ruta ModWheel→FilterHPFCutoff con ruta activa debe sonar: "
                    + juce::String (conRuta, 6));
            expect (sinRuta > 0.0,
                    "ruta ModWheel→FilterHPFCutoff sin ruta tambien debe sonar el motor: "
                    + juce::String (sinRuta, 6));
            expect (conRuta < sinRuta,
                    "ruta ModWheel→FilterHPFCutoff al subir el HPF debe atenuar bajos: "
                    + juce::String (conRuta, 6) + " vs " + juce::String (sinRuta, 6));
        }

        // =====================================================================
        beginTest ("kOsc2Level (14): ModWheel sube el nivel del OSC2 y la energia aumenta");
        {
            // Destino 14 = OSC2 Level. Ruta con amount positivo: al subir el wheel
            // sube el nivel del OSC2 y la energia sube.
            const double conRuta = renderConRuta (ModDestination::kOsc2Level, 1.0f, true);
            const double sinRuta = renderConRuta (ModDestination::kOsc2Level, 0.0f, false);

            expect (conRuta > sinRuta * 1.1,
                    "ruta ModWheel→Osc2Level debe subir el nivel del OSC2 y subir la energia: "
                    + juce::String (conRuta, 6) + " vs " + juce::String (sinRuta, 6));
            expect (conRuta > 0.0,
                    "ruta ModWheel→Osc2Level con ruta activa debe sonar: "
                    + juce::String (conRuta, 6));
        }

        // =====================================================================
        beginTest ("kSubOscLevel (67): ModWheel sube el Sub Oscilador y la energia aumenta");
        {
            // Destino 67 = Sub Osc Level. Ruta con amount positivo: al subir el wheel
            // sube el sub oscilador y la energia sube.
            const double conRuta = renderConRuta (ModDestination::kSubOscLevel, 1.0f, true);
            const double sinRuta = renderConRuta (ModDestination::kSubOscLevel, 0.0f, false);

            expect (conRuta > sinRuta * 1.1,
                    "ruta ModWheel→SubOscLevel debe subir el sub oscilador y subir la energia: "
                    + juce::String (conRuta, 6) + " vs " + juce::String (sinRuta, 6));
            expect (conRuta > 0.0,
                    "ruta ModWheel→SubOscLevel con ruta activa debe sonar: "
                    + juce::String (conRuta, 6));
        }
    }
};

static SynthEngineModDestinosMecanicosAudioUnitTests synthEngineModDestinosMecanicosAudioUnitTests;

} // namespace ABD
