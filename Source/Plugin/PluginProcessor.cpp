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

    // Inicialización transversal de ABDShared::AutoUpdater
    ABDShared::AutoUpdaterConfig updaterConfig;
    updaterConfig.currentVersion = JucePlugin_VersionString;
    updaterConfig.repoOwner = "ajabadia";
    updaterConfig.repoName = "ABDSynths";
    updaterConfig.appName = "ABDEep";
    updaterConfig.userAgent = juce::String ("ABDEep-AutoUpdater/") + JucePlugin_VersionString;
    updaterConfig.checkOnStartup = false;
    updaterConfig.assetNames.windows = "ABDEep-windows-x64.zip";
    autoUpdater = std::make_unique<ABDShared::AutoUpdater> (updaterConfig);
}

ABDEepAudioProcessor::~ABDEepAudioProcessor()
{
    autoUpdater.reset();
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
    // Si todos los slots FX están en bypass o el motor FX está en modo Bypass,
    // basta 50 ms para el de-click de voces; con efectos activos se reportan 5.0 s
    // (cubre FXMultiTapDelay ~4.6 s + feedback + reverb tail).
    return synthEngine.getFXEngine().hasActiveEffects() ? 5.0 : 0.05;
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

    // Agregar eventos encolados desde el hilo de UI (100% lock-free SPSC ring buffer)
    {
        const int numReady = midiFifo.getNumReady();
        if (numReady > 0)
        {
            const auto scope = midiFifo.read (numReady);
            for (int i = 0; i < scope.blockSize1; ++i)
            {
                const auto& pkt = midiRingBuffer[static_cast<size_t> (scope.startIndex1 + i)];
                if (pkt.size > 0)
                    midiMessages.addEvent (pkt.data, pkt.size, 0);
            }
            for (int i = 0; i < scope.blockSize2; ++i)
            {
                const auto& pkt = midiRingBuffer[static_cast<size_t> (scope.startIndex2 + i)];
                if (pkt.size > 0)
                    midiMessages.addEvent (pkt.data, pkt.size, 0);
            }
        }
    }

    // Sincronizar tempo y transporte (BPM, isPlaying, ppqPosition) con el DAW (juce::AudioPlayHead)
    if (auto* playHead = getPlayHead())
    {
        if (auto posInfo = playHead->getPosition())
        {
            const float bpm = posInfo->getBpm().hasValue() ? static_cast<float> (*posInfo->getBpm()) : 0.0f;
            const bool isPlaying = posInfo->getIsPlaying();
            const double ppq = posInfo->getPpqPosition().hasValue() ? *posInfo->getPpqPosition() : 0.0;
            synthEngine.setHostTransport (bpm, isPlaying, ppq);
        }
        else
        {
            synthEngine.setHostTransport (0.0f, false, 0.0);
        }
    }
    else
    {
        synthEngine.setHostTransport (0.0f, false, 0.0);
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
    state.setProperty ("midiLearnJson", getMidiLearnState(), nullptr);
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

            if (newState.hasProperty ("midiLearnJson"))
                setMidiLearnState (newState.getProperty ("midiLearnJson").toString());

            // Restaurar metadata de banco/programa (NO reaplicar patch: el APVTS restaurado ya tiene el sonido)
            int restoredBank = -1, restoredProg = -1;
            if (newState.hasProperty ("pc_bank"))
            {
                restoredBank = newState.getProperty ("pc_bank");
                restoredProg = newState.hasProperty ("pc_program") ? static_cast<int> (newState.getProperty ("pc_program")) : 0;
                patchController.getMidiMap().setCurrentBank (restoredBank);
                // NO scheduleApply: el APVTS restaurado ya contiene el estado sonoro completo
            }

            apvts.replaceState (newState);

            // Sanitización defensiva anti-NaN/Inf (estándar ABDNeural): garantiza que un
            // proyecto DAW corrupto nunca inyecte NaN, Inf o valores fuera de [0, 1] al DSP.
            for (auto* param : getParameters())
            {
                if (auto* rangedParam = dynamic_cast<juce::RangedAudioParameter*> (param))
                {
                    const float normVal = rangedParam->getValue();
                    if (! std::isfinite (normVal) || normVal < 0.0f || normVal > 1.0f)
                        rangedParam->setValueNotifyingHost (rangedParam->getDefaultValue());
                }
            }

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
