#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "ParametersSpec.h"
#include "Core/PatchByteCodec.h"
#include "Core/BankFileReader.h"
#include "ParameterRegistry.gen.h"
#if DEEP_TARGET_MODEL >= 2
#include "Core/CalibrationSpec.h"
#endif
#include <iostream>

ABDEepAudioProcessor::ABDEepAudioProcessor()
    : AudioProcessor (BusesProperties()
                      .withInput  ("Input",  juce::AudioChannelSet::stereo(), true)
                      .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      apvts (*this, &undoManager, "Parameters", ParametersSpec::createLayout()),
      patchController (apvts,
                       [this] (const juce::String& name) { setPresetName (name); })
{
#if JucePlugin_Build_Standalone
    // Check for --run-unit-tests flag
    auto args = juce::JUCEApplication::getCommandLineParameterArray();
    for (const auto& arg : args)
    {
        if (arg == "--run-unit-tests" || arg == "-t")
        {
            juce::UnitTestRunner runner;
            runner.setAssertOnFailure (false);
            std::cout << "\n=== ABD Eep Unit Tests ===\n\n";
            runner.runAllTests();
            
            auto totalTests = runner.getNumResults();
            int passed = 0, failed = 0;
            for (int i = 0; i < totalTests; ++i)
                if (auto* result = runner.getResult (i))
                {
                    passed += result->passes;
                    failed += result->failures;
                }
            
            std::cout << "\n=== Summary: " << passed << " passed, " << failed << " failed (" << totalTests << " suites) ===\n";
            
            if (failed > 0)
                std::_Exit (1);  // Immediate exit with failure code
            
            if (auto* app = juce::JUCEApplication::getInstance())
                app->systemRequestedQuit();
            
            return;
        }
    }
#endif

#if DEEP_TARGET_MODEL >= 2
    // Cargar calibración personalizada por defecto si existe en el disco
    auto calibFile = CalibrationSpec::getDefaultCalibrationFile();
    if (calibFile.existsAsFile())
    {
        juce::String jsonText = calibFile.loadFileAsString();
        synthEngine.loadCalibrationFromJson (jsonText);
    }
#endif
}

ABDEepAudioProcessor::~ABDEepAudioProcessor()
{
}

const juce::String ABDEepAudioProcessor::getName() const
{
    return JucePlugin_Name;
}

bool ABDEepAudioProcessor::acceptsMidi() const
{
    return true;
}

bool ABDEepAudioProcessor::producesMidi() const
{
    return true;
}

bool ABDEepAudioProcessor::isMidiEffect() const
{
    return false;
}

double ABDEepAudioProcessor::getTailLengthSeconds() const
{
    // El motor tiene delays de hasta ~4.6s (FXMultiTapDelay) y reverbs con cola larga.
    // 5.0s cubre el caso peor: multi-tap delay al máximo + feedback + reverb tail.
    return 5.0;
}

void ABDEepAudioProcessor::setPresetName (const juce::String& newName)
{
    if (currentPresetName != newName)
    {
        currentPresetName = newName;
        updateHostDisplay (juce::AudioProcessor::ChangeDetails().withProgramChanged (true));
    }
}

int ABDEepAudioProcessor::getNumPrograms()
{
    return 1024; // 8 banks × 128 programs
}

int ABDEepAudioProcessor::getCurrentProgram()
{
    int bank = patchController.getCurrentBank();
    int prog = patchController.getCurrentProgram();
    return bank * 128 + prog;
}

void ABDEepAudioProcessor::setCurrentProgram (int index)
{
    if (index < 0 || index >= 1024)
        return;
    int bank = index / 128;
    int prog = index % 128;
    patchController.scheduleApply (bank, prog);
}

const juce::String ABDEepAudioProcessor::getProgramName (int index)
{
    if (index < 0 || index >= 1024)
        return {};
    int bank = index / 128;
    int prog = index % 128;
    char letter = 'A' + bank;
    if (!patchController.isBankLoaded (bank))
        return juce::String ("Bank ") + letter + " Patch " + juce::String (prog + 1) + " (not loaded)";
    auto& bankData = patchController.getBankData (bank);
    juce::String name = bankData.names[prog];
    return juce::String ("Bank ") + letter + " Patch " + juce::String (prog + 1) + (name.isEmpty() ? "" : " " + name);
}

void ABDEepAudioProcessor::changeProgramName (int index, const juce::String& newName)
{
    juce::ignoreUnused (index);
    setPresetName (newName);
}

void ABDEepAudioProcessor::prepareToPlay (double sampleRate, int samplesPerBlock)
{
    synthEngine.prepare (sampleRate, samplesPerBlock);
    audioABRecorder.prepare (sampleRate, samplesPerBlock, getTotalNumInputChannels(), getTotalNumOutputChannels());

    // Reportar latencia al DAW (0 por ahora — sin oversampling interno)
    setLatencySamples (0);

    isPrepared = true;
}

void ABDEepAudioProcessor::releaseResources()
{
    isPrepared = false;
}

bool ABDEepAudioProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
     && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

    return true;
}

void ABDEepAudioProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    juce::ScopedNoDenormals noDenormals;

    // Guarda temprana: engine no preparado o buffers vacíos
    if (!isPrepared || buffer.getNumSamples() == 0 || getTotalNumOutputChannels() == 0)
        return;

    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    // Si el grabador de audio A/B está activo, capturar las muestras del buffer de entrada física (hardware input)
    if (audioABRecorder.isRunning())
    {
        audioABRecorder.processHardwareInput (buffer, buffer.getNumSamples());
    }

    // Agregar eventos encolados desde el hilo de UI
    {
        const juce::ScopedLock sl (midiQueueLock);
        if (! midiQueue.isEmpty())
        {
            midiMessages.addEvents (midiQueue, 0, -1, 0);
            midiQueue.clear();
        }
    }

    // Procesar Program Change / Bank Select del buffer MIDI entrante
    patchController.offerMidi (midiMessages);

    // Actualizar parámetros de control y síntesis
    synthEngine.updateParameters (apvts);

    // Renderizar audio a través del motor polifónico
    synthEngine.processBlock (buffer, midiMessages);
}

bool ABDEepAudioProcessor::hasEditor() const
{
    return true;
}

juce::AudioProcessorEditor* ABDEepAudioProcessor::createEditor()
{
    return new ABDEepAudioProcessorEditor (*this);
}

void ABDEepAudioProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();
    state.setProperty ("presetName", currentPresetName, nullptr);
    state.setProperty ("version", 1, nullptr);
    state.setProperty ("pc_bank", patchController.getCurrentBank(), nullptr);
    state.setProperty ("pc_program", patchController.getCurrentProgram(), nullptr);
    std::unique_ptr<juce::XmlElement> xml (state.createXml());
    copyXmlToBinary (*xml, destData);
}

void ABDEepAudioProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xmlState (getXmlFromBinary (data, sizeInBytes));
    if (xmlState != nullptr)
    {
        if (xmlState->hasTagName (apvts.state.getType()))
        {
            auto newState = juce::ValueTree::fromXml (*xmlState);

            // Leer versión del esquema con fallback a 0 para proyectos anteriores
            int schemaVersion = newState.getProperty ("version", 0);
            juce::ignoreUnused (schemaVersion);

            if (newState.hasProperty ("presetName"))
                currentPresetName = newState.getProperty ("presetName").toString();

            // Restaurar metadata de banco/programa (NO reaplicar patch: el APVTS restaurado ya tiene el sonido)
            int restoredBank = -1, restoredProg = -1;
            if (newState.hasProperty ("pc_bank"))
            {
                restoredBank = newState.getProperty ("pc_bank");
                restoredProg = newState.hasProperty ("pc_program") ? newState.getProperty ("pc_program") : 0;
                patchController.getMidiMap().setCurrentBank (restoredBank);
                // NO scheduleApply: el APVTS restaurado ya contiene el estado sonoro completo
            }

            apvts.replaceState (newState);
            updateHostDisplay (juce::AudioProcessor::ChangeDetails().withProgramChanged (true));

            // Notificar al editor (WebUI) con banco/programa restaurados para sincronizar UI
            if (onStateRestored != nullptr)
                onStateRestored (restoredBank, restoredProg);
        }
    }
}

void ABDEepAudioProcessor::processBlockBypassed (juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
{
    // Guarda temprana
    if (!isPrepared || buffer.getNumSamples() == 0 || getTotalNumOutputChannels() == 0)
        return;

    // En bypass: silenciar todas las voces activas (stuck notes) y limpiar
    // la cola MIDI para evitar que notas encoladas suenen al salir del bypass.
    // Llamada incondicional cada bloque — panic() es ligera (12 voces + memsets)
    // y es necesario si el host desvypatea y revypatea con nuevas notas entre sesiones.
    synthEngine.panic();
    // Reiniciar controladores MIDI globales (pitch bend, mod wheel, aftertouch,
    // sustain pedal) para evitar saltos de modulación al salir del bypass.
    synthEngine.resetMidiControllers();
    clearMidiQueue();

    // En bypass: limpiar canales de salida extra, el audio pasa limpio
    auto totalNumInputChannels  = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear (i, 0, buffer.getNumSamples());

    // No procesar síntesis ni efectos — solo pasar el audio de entrada directamente
}

// Inicialización para standalone/plugin por JUCE
juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new ABDEepAudioProcessor();
}
