#include "AudioABValidationViewComponent.h"
#include "DSP/SynthEngine.h"
#include "Core/PatchDiffTypes.h"
#include "Core/MidiTranslationEngine.h"

AudioABValidationViewComponent::AudioABValidationViewComponent (juce::AudioDeviceManager* deviceManagerToUse, ABD::SynthEngine* engineToUse)
    : deviceManager (deviceManagerToUse),
      synthEngine (engineToUse)
{
    if (deviceManager != nullptr)
    {
        deviceManager->addMidiInputCallback (juce::String(), this);
        deviceManager->addAudioCallback (this);
    }

    addAndMakeVisible (runAutomatedButton);
    runAutomatedButton.onClick = [this] { startAutomatedTest(); };
    runAutomatedButton.setColour (juce::TextButton::buttonColourId, juce::Colours::darkred);
    runAutomatedButton.setEnabled (false);

    // SysEx Loading Setup
    addAndMakeVisible (loadSysExButton);
    loadSysExButton.onClick = [this] { chooseSysExFile(); };
    addAndMakeVisible (generateSysExButton);
    generateSysExButton.onClick = [this] { generateTestSysEx(); };
    generateSysExButton.setColour (juce::TextButton::buttonColourId, juce::Colours::darkgrey.withAlpha(0.6f));
    addAndMakeVisible (pullSysExButton);
    pullSysExButton.onClick = [this] { pullSysExFromHardware(); };
    pullSysExButton.setColour (juce::TextButton::buttonColourId, juce::Colours::darkblue);
    addAndMakeVisible (testPatchLabel);
    testPatchLabel.setFont (juce::Font (12.0f, juce::Font::italic));

    // Calibration Slider Setup
    addAndMakeVisible (calibrationSlider);
    calibrationSlider.setRange (0.8, 1.2, 0.01);
    calibrationSlider.setValue (1.0);
    calibrationSlider.setSliderStyle (juce::Slider::LinearHorizontal);
    calibrationSlider.setTextBoxStyle (juce::Slider::TextBoxRight, false, 80, 20);
    calibrationSlider.addListener (this);

    addAndMakeVisible (calibrationLabel);
    calibrationLabel.setFont (juce::Font (12.0f, juce::Font::plain));

    addAndMakeVisible (loadRefButton);
    loadRefButton.onClick = [this] { chooseReferenceFile(); };

    addAndMakeVisible (loadCapButton);
    loadCapButton.onClick = [this] { chooseCaptureFile(); };

    addAndMakeVisible (compareButton);
    compareButton.onClick = [this] { runAcousticalComparison(); };
    compareButton.setEnabled (false);

    addAndMakeVisible (showVisualizerButton);
    showVisualizerButton.onClick = [this] { showVisualizer(); };
    showVisualizerButton.setEnabled (false);
    showVisualizerButton.setColour (juce::TextButton::buttonColourId, juce::Colours::darkblue);

    // Toggles
    trimSilenceToggle.setToggleState (true, juce::dontSendNotification);
    addAndMakeVisible (trimSilenceToggle);

    normalizeGainToggle.setToggleState (false, juce::dontSendNotification);
    addAndMakeVisible (normalizeGainToggle);

    // Labels
    refFileLabel.setText ("No reference file selected", juce::dontSendNotification);
    refFileLabel.setFont (juce::Font (12.0f, juce::Font::italic));
    addAndMakeVisible (refFileLabel);

    capFileLabel.setText ("No capture file selected", juce::dontSendNotification);
    capFileLabel.setFont (juce::Font (12.0f, juce::Font::italic));
    addAndMakeVisible (capFileLabel);

    // Console
    consoleLog.setMultiLine (true);
    consoleLog.setReadOnly (true);
    consoleLog.setScrollbarsShown (true);
    consoleLog.setCaretVisible (false);
    consoleLog.setFont (juce::Font ("Share Tech Mono", 12.0f, juce::Font::plain));
    consoleLog.setColour (juce::TextEditor::backgroundColourId, juce::Colours::black);
    consoleLog.setTextToShowWhenEmpty ("Calibration Lab Diagnostics Console\nSelect Reference & Capture WAV files to begin validation.", juce::Colours::grey);
    addAndMakeVisible (consoleLog);
}

void AudioABValidationViewComponent::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void AudioABValidationViewComponent::resized()
{
    auto area = getLocalBounds().reduced (10);

    // Configuración area (ampliado para la fila de SysEx)
    auto configArea = area.removeFromTop (200);

    auto rowSysEx = configArea.removeFromTop (35);
    loadSysExButton.setBounds (rowSysEx.removeFromLeft (160).reduced (2));
    generateSysExButton.setBounds (rowSysEx.removeFromLeft (180).reduced (2));
    pullSysExButton.setBounds (rowSysEx.removeFromLeft (180).reduced (2));
    testPatchLabel.setBounds (rowSysEx.reduced (2));

    auto row0 = configArea.removeFromTop (30);
    runAutomatedButton.setBounds (row0.reduced (2));

    auto rowSlider = configArea.removeFromTop (30);
    calibrationLabel.setBounds (rowSlider.removeFromLeft (250).reduced (2));
    calibrationSlider.setBounds (rowSlider.reduced (2));

    auto row1 = configArea.removeFromTop (30);
    loadRefButton.setBounds (row1.removeFromLeft (160).reduced (2));
    refFileLabel.setBounds (row1.reduced (2));

    auto row2 = configArea.removeFromTop (30);
    loadCapButton.setBounds (row2.removeFromLeft (160).reduced (2));
    capFileLabel.setBounds (row2.reduced (2));

    auto row3 = configArea.removeFromTop (35);
    trimSilenceToggle.setBounds (row3.removeFromLeft (200).reduced (2));
    normalizeGainToggle.setBounds (row3.removeFromLeft (120).reduced (2));
    compareButton.setBounds (row3.removeFromLeft (180).reduced (2));
    showVisualizerButton.setBounds (row3.reduced (2));

    area.removeFromTop (10);
    consoleLog.setBounds (area);
}

void AudioABValidationViewComponent::chooseReferenceFile()
{
    fileChooser = std::make_unique<juce::FileChooser> (
        "Select Reference WAV file",
        juce::File::getSpecialLocation (juce::File::userHomeDirectory),
        "*.wav"
    );

    fileChooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
        [this] (const juce::FileChooser& chooser)
        {
            auto file = chooser.getResult();
            if (file.existsAsFile())
            {
                refFile = file;
                refFileLabel.setText (refFile.getFileName(), juce::dontSendNotification);
                compareButton.setEnabled (refFile.existsAsFile() && capFile.existsAsFile());
            }
        }
    );
}

void AudioABValidationViewComponent::chooseCaptureFile()
{
    fileChooser = std::make_unique<juce::FileChooser> (
        "Select Capture WAV file",
        juce::File::getSpecialLocation (juce::File::userHomeDirectory),
        "*.wav"
    );

    fileChooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
        [this] (const juce::FileChooser& chooser)
        {
            auto file = chooser.getResult();
            if (file.existsAsFile())
            {
                capFile = file;
                capFileLabel.setText (capFile.getFileName(), juce::dontSendNotification);
                compareButton.setEnabled (refFile.existsAsFile() && capFile.existsAsFile());
            }
        }
    );
}

void AudioABValidationViewComponent::chooseSysExFile()
{
    // Buscar por defecto en la carpeta de recursos de bancos del proyecto
    juce::File currentFile (__FILE__);
    juce::File defaultDir = currentFile.getParentDirectory().getParentDirectory().getParentDirectory().getChildFile ("resources").getChildFile ("banks");

    fileChooser = std::make_unique<juce::FileChooser> (
        "Select Test Preset SysEx file",
        defaultDir.exists() ? defaultDir : juce::File::getSpecialLocation (juce::File::userHomeDirectory),
        "*.syx"
    );

    fileChooser->launchAsync (juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
        [this] (const juce::FileChooser& chooser)
        {
            auto file = chooser.getResult();
            if (file.existsAsFile())
            {
                juce::MemoryBlock mb;
                if (file.loadFileAsData (mb))
                {
                    // Parsear el SysEx
                    const uint8_t* rawData = static_cast<const uint8_t*> (mb.getData());
                    size_t size = mb.getSize();

                    // El dump suele arrancar con F0 00 20 32... 
                    // Omitimos la cabecera de SysEx del DeepMind/Eep (8 bytes) y desempaquetamos los datos de 7 bits empaquetados
                    if (size > 8 && rawData[0] == 0xF0)
                    {
                        auto unpacked = MidiTranslationEngine::unpackDeepMindSysEx (rawData + 8, size - 8);
                        
                        if (unpacked.getSize() >= 242)
                        {
                            unpacked.copyTo (testPatchBytes.data(), 0, 242);
                            testSysExFile = file;
                            testPatchLoaded = true;

                            // Extraer el nombre del patch (los ultimos 16 bytes del buffer desempaquetado)
                            char nameBuf[17];
                            std::memcpy (nameBuf, testPatchBytes.data() + 224, 16);
                            nameBuf[16] = '\0';
                            juce::String patchName (nameBuf);
                            patchName = patchName.trim();

                            testPatchLabel.setText ("Selected Test Patch: [" + patchName + "] (File: " + file.getFileName() + ")", juce::dontSendNotification);
                            runAutomatedButton.setEnabled (true);
                            
                            addLog ("Patch cargado con éxito para testeo.");
                            addLog ("Nombre: " + patchName);
                            addLog ("Origen: " + file.getFullPathName());

                            // Auto-enviar al hardware
                            std::vector<uint8_t> syxVec (rawData, rawData + size);
                            sendSysExToHardware (syxVec, patchName);
                            return;
                        }
                    }
                }
                
                testPatchLabel.setText ("ERROR: Invalid or corrupt SysEx file.", juce::dontSendNotification);
                runAutomatedButton.setEnabled (false);
                testPatchLoaded = false;
            }
        }
    );
}

void AudioABValidationViewComponent::runAcousticalComparison()
{
    consoleLog.clear();
    addLog ("Iniciando validación acústica nativa (Fase 5D)...");

    // 1. Validar conexión física del hardware mediante handshake SysEx
    bool midiVerificationSuccess = false;
    if (deviceManager != nullptr)
    {
        auto* activeMidiOutput = deviceManager->getDefaultMidiOutput();
        if (activeMidiOutput != nullptr)
        {
            addLog ("Verificando conexión con el hardware MIDI...");
            
            // Limpiar flag anterior
            {
                const juce::ScopedLock sl (midiLock);
                sysExReceived = false;
            }

            // Enviar Edit Buffer Dump Request
            juce::MidiMessage dumpRequest = MidiTranslationEngine::createEditBufferDumpRequest();
            activeMidiOutput->sendMessageNow (dumpRequest);

            // Esperar con un timeout de 1.5 segundos
            int waitMs = 0;
            const int timeoutMs = 1500;
            const int sleepStepMs = 50;

            while (waitMs < timeoutMs)
            {
                juce::Thread::sleep (sleepStepMs);
                waitMs += sleepStepMs;

                const juce::ScopedLock sl (midiLock);
                if (sysExReceived)
                {
                    midiVerificationSuccess = true;
                    addLog ("  -> Conexión MIDI establecida. Hardware respondiente.");
                    break;
                }
            }

            if (!midiVerificationSuccess)
            {
                addLog ("ERROR: El hardware físico no respondió a la solicitud de volcado (Midi Timeout 1500ms).");
                addLog ("Asegúrese de que el sintetizador esté encendido y conectado a los puertos seleccionados.");
                return;
            }
        }
        else
        {
            addLog ("ADVERTENCIA: No hay ningún puerto MIDI de salida activo configurado.");
            addLog ("Se procede a la comparación acústica offline omitiendo la validación física de hardware.");
        }
    }

    addLog ("Referencia: " + refFile.getFullPathName());
    addLog ("Captura: " + capFile.getFullPathName());

    juce::AudioFormatManager formatManager;
    formatManager.registerBasicFormats();

    std::unique_ptr<juce::AudioFormatReader> refReader (formatManager.createReaderFor (refFile));
    std::unique_ptr<juce::AudioFormatReader> capReader (formatManager.createReaderFor (capFile));

    if (refReader == nullptr || capReader == nullptr)
    {
        addLog ("ERROR: No se pudo instanciar el descodificador para los ficheros WAV.");
        return;
    }

    // Configurar señales
    AudioABSignal refSignal;
    refSignal.sourceId = "reference";
    refSignal.sampleRate = refReader->sampleRate;
    refSignal.numChannels = (int)refReader->numChannels;
    refSignal.originalNumSamples = refReader->lengthInSamples;
    refSignal.filePath = refFile.getFullPathName();
    refSignal.buffer.setSize (refSignal.numChannels, (int)refSignal.originalNumSamples);
    refReader->read (&refSignal.buffer, 0, (int)refSignal.originalNumSamples, 0, true, true);

    AudioABSignal capSignal;
    capSignal.sourceId = "capture";
    capSignal.sampleRate = capReader->sampleRate;
    capSignal.numChannels = (int)capReader->numChannels;
    capSignal.originalNumSamples = capReader->lengthInSamples;
    capSignal.filePath = capFile.getFullPathName();
    capSignal.buffer.setSize (capSignal.numChannels, (int)capSignal.originalNumSamples);
    capReader->read (&capSignal.buffer, 0, (int)capSignal.originalNumSamples, 0, true, true);

    AudioABRunContext context;
    context.runId = "standalone-diagnostic-" + juce::String (juce::Time::currentTimeMillis());

    AudioABComparatorConfig config;
    config.trimLeadingSilence = trimSilenceToggle.getToggleState();
    config.trimTrailingSilence = trimSilenceToggle.getToggleState();
    config.normalizeGain = normalizeGainToggle.getToggleState();
    config.forceMonoForAnalysis = true;
    config.enableCrossCorrelation = true;

    // Guardar copias locales para la comparación visual
    refAudioBuffer = refSignal.buffer;
    capAudioBuffer = capSignal.buffer;
    showVisualizerButton.setEnabled (true);

    // Correr Comparación
    AudioABComparator comparator;
    auto result = comparator.compare (refSignal, capSignal, context, config);

    // Correr Veredicto
    AudioABVerdictEngine verdictEngine;
    AudioABVerdictTolerances tolerances;
    auto verdict = verdictEngine.evaluate (result, tolerances, testPatchBytes);

    // Reportar resultados
    addLog ("---------------------------------------------------------");
    addLog ("RESULTADO DE COMPARACIÓN:");
    addLog ("  Status: " + result.status);
    addLog ("  Reason Code: " + result.reasonCode);
    addLog ("---------------------------------------------------------");
    
    if (result.status == "error")
    {
        addLog ("VEREDICTO: [FAIL] - Fallo contractual.");
        for (const auto& err : result.errors)
            addLog ("  * Error: " + err);
        return;
    }

    addLog ("VEREDICTO ACÚSTICO: [" + verdict.level.toUpperCase() + "]");
    addLog ("  Reason Code: " + verdict.reasonCode);
    
    if (!verdict.triggeredRules.isEmpty())
    {
        addLog ("  Reglas rotas:");
        for (const auto& rule : verdict.triggeredRules)
            addLog ("    * " + rule);
    }

    addLog ("---------------------------------------------------------");
    addLog ("MÉTRICAS TEMPORALES:");
    addLog ("  Peak Delta: " + juce::String (result.time.peakDeltaDb, 2) + " dB");
    addLog ("  RMS Delta: " + juce::String (result.time.rmsDeltaDb, 2) + " dB");
    addLog ("  RMSE: " + juce::String (result.time.rmse, 5));
    addLog ("  Residual RMS: " + juce::String (result.time.residualRmsDbfs, 1) + " dBFS");

    addLog ("ALINEACIÓN DE FASE:");
    addLog ("  Sample Offset: " + juce::String (result.alignment.sampleOffset) + " samples");
    addLog ("  Time Offset: " + juce::String (result.alignment.timeOffsetMs, 2) + " ms");
    addLog ("  Correlation Peak: " + juce::String (result.alignment.correlationPeak, 4));

    addLog ("DIFERENCIAS ESPECTRALES (STFT):");
    addLog ("  Log Mag Mean Abs Diff: " + juce::String (result.spectral.logMagMeanAbsDiffDb, 2) + " dB");
    addLog ("  Banda Baja: " + juce::String (result.spectral.lowBandDeltaDb, 2) + " dB");
    addLog ("  Banda Media: " + juce::String (result.spectral.midBandDeltaDb, 2) + " dB");
    addLog ("  Banda Alta: " + juce::String (result.spectral.highBandDeltaDb, 2) + " dB");
}

void AudioABValidationViewComponent::addLog (const juce::String& message)
{
    consoleLog.insertTextAtCaret (message + "\n");
}

AudioABValidationViewComponent::~AudioABValidationViewComponent()
{
    if (deviceManager != nullptr)
    {
        deviceManager->removeMidiInputCallback (juce::String(), this);
        deviceManager->removeAudioCallback (this);
    }
}

void AudioABValidationViewComponent::handleIncomingMidiMessage (juce::MidiInput* /*source*/, const juce::MidiMessage& message)
{
    if (message.isSysEx())
    {
        const juce::ScopedLock sl (midiLock);
        sysExReceived = true;
        lastReceivedSysEx = message;
    }
}

void AudioABValidationViewComponent::audioDeviceAboutToStart (juce::AudioIODevice* device)
{
    if (device != nullptr)
        currentSampleRate = device->getCurrentSampleRate();
}

void AudioABValidationViewComponent::audioDeviceStopped()
{
}

void AudioABValidationViewComponent::audioDeviceIOCallbackWithContext (const float* const* inputChannelData, int numInputChannels,
                                                                   float* const* /*outputChannelData*/, int /*numOutputChannels*/,
                                                                   int numSamples, const juce::AudioIODeviceCallbackContext& /*context*/)
{
    if (!isRecording)
        return;

    // Solo grabar de entrada mono/estereo física si los canales de entrada estan disponibles
    if (numInputChannels > 0 && inputChannelData != nullptr)
    {
        int samplesToCopy = std::min (numSamples, maxRecordingSamples - samplesRecorded);
        if (samplesToCopy > 0)
        {
            // Copiar canal izquierdo
            recordedBuffer.copyFrom (0, samplesRecorded, inputChannelData[0], samplesToCopy);
            
            // Copiar canal derecho (o clonar izquierdo si es mono)
            if (numInputChannels > 1 && inputChannelData[1] != nullptr && recordedBuffer.getNumChannels() > 1)
                recordedBuffer.copyFrom (1, samplesRecorded, inputChannelData[1], samplesToCopy);
            else if (recordedBuffer.getNumChannels() > 1)
                recordedBuffer.copyFrom (1, samplesRecorded, inputChannelData[0], samplesToCopy);

            samplesRecorded += samplesToCopy;

            if (samplesRecorded >= maxRecordingSamples)
            {
                isRecording = false;
                
                // Disparar procesamiento asíncrono en la UI thread
                juce::MessageManager::callAsync ([this] { stopRecordingAndCompare(); });
            }
        }
    }
}

void AudioABValidationViewComponent::startAutomatedTest()
{
    consoleLog.clear();
    addLog ("=== INICIANDO CICLO DE TEST AUTOMATIZADO ===");

    if (deviceManager == nullptr)
    {
        addLog ("ERROR: DeviceManager no disponible.");
        return;
    }

    auto* activeMidiOutput = deviceManager->getDefaultMidiOutput();
    if (activeMidiOutput == nullptr)
    {
        addLog ("ERROR: Debe seleccionar un puerto MIDI de salida activo en Settings para controlar el hardware.");
        return;
    }

    // 1. Handshake inicial
    addLog ("Verificando hardware de destino...");
    {
        const juce::ScopedLock sl (midiLock);
        sysExReceived = false;
    }

    juce::MidiMessage dumpRequest = MidiTranslationEngine::createEditBufferDumpRequest();
    activeMidiOutput->sendMessageNow (dumpRequest);

    // Espera activa (1.5s timeout)
    int waitMs = 0;
    bool success = false;
    while (waitMs < 1500)
    {
        juce::Thread::sleep (50);
        waitMs += 50;
        const juce::ScopedLock sl (midiLock);
        if (sysExReceived)
        {
            success = true;
            addLog ("  -> Conexión MIDI validada. Parámetros del hardware listos.");
            break;
        }
    }

    if (!success)
    {
        addLog ("ERROR: El hardware no responde al handshake MIDI. Operación cancelada.");
        return;
    }

    // Paso 1: Validar Contrato de Parámetros
    addLog ("Validando concordancia de parámetros (Paso 1: Patch Contract)...");
    
    juce::MidiMessage rxSysEx;
    {
        const juce::ScopedLock sl (midiLock);
        rxSysEx = lastReceivedSysEx;
    }

    // Desempaquetar SysEx
    const uint8_t* rawData = rxSysEx.getSysExData();
    int dataSize = rxSysEx.getSysExDataSize();
    
    // El dump del edit buffer suele tener la cabecera SysEx (8 bytes) + datos empaquetados + F7 final.
    // Omitimos la cabecera (8 bytes) para desempaquetar la payload.
    if (dataSize > 8)
    {
        auto hardwareUnpacked = MidiTranslationEngine::unpackDeepMindSysEx (rawData + 8, dataSize - 8);
        
        // Cargar el patch actual en memoria del DSP local (simulada o real)
        std::array<uint8_t, 242> dspParams;
        std::array<uint8_t, 242> hardwareParams;

        std::fill (dspParams.begin(), dspParams.end(), 0);
        std::fill (hardwareParams.begin(), hardwareParams.end(), 0);

        // Copiar los datos del hardware si son del tamaño esperado
        if (hardwareUnpacked.getSize() >= 242)
        {
            hardwareUnpacked.copyTo (hardwareParams.data(), 0, 242);

            // Contrastar contra el patch de prueba conocido cargado en la UI (el punto de partida)
            dspParams = testPatchBytes; 
            
            // Comparar
            auto diffReport = PatchDiffEngine::diffSemanticParams (dspParams, hardwareParams);
            
            if (! diffReport.semanticDiffs.empty())
            {
                addLog ("ERROR: Se han detectado discrepancias en los parámetros cargados.");
                addLog ("El hardware físico difiere del Patch de prueba conocido:");
                for (const auto& diff : diffReport.semanticDiffs)
                {
                    addLog ("  * " + diff.paramId + " - Creado/SysEx: " + diff.semanticValA + 
                            " | Hardware: " + diff.semanticValB);
                }
                addLog ("Asegúrese de cargar el mismo patch SysEx en su sintetizador antes de continuar.");
                return;
            }
            else
            {
                addLog ("  -> Contrato de parámetros validado [OK]. No se encontraron diferencias.");
            }
        }
    }

    // 2. Preparar buffer de grabación (2.5 segundos de duración total)
    currentSampleRate = deviceManager->getCurrentAudioDevice() != nullptr ? 
                        deviceManager->getCurrentAudioDevice()->getCurrentSampleRate() : 44100.0;
    
    maxRecordingSamples = (int)(currentSampleRate * 2.5); // Nota (2.0s) + Cola (0.5s)
    samplesRecorded = 0;
    recordedBuffer.setSize (2, maxRecordingSamples);
    recordedBuffer.clear();

    addLog ("Iniciando captura física de audio a " + juce::String (currentSampleRate, 1) + " Hz...");
    
    // Activar grabador en el audio callback
    isRecording = true;

    // 3. Disparar nota MIDI en el hardware físico
    auto noteOn = juce::MidiMessage::noteOn (1, 60, (juce::uint8)100);
    activeMidiOutput->sendMessageNow (noteOn);

    // Dormir hilo de UI brevemente para simular el paso del tiempo de forma asíncrona
    // La grabación real ocurre de forma no-bloqueante en audioDeviceIOCallback.
}

void AudioABValidationViewComponent::renderLocalSoftwareReference()
{
    addLog ("Renderizando referencia software del SynthEngine local...");
    
    // Configurar paths locales en la carpeta temporal de artifacts
    juce::File outputDir = juce::File::getSpecialLocation (juce::File::userDocumentsDirectory)
                            .getChildFile ("ABDEep_CalibrationRuns");
    outputDir.createDirectory();

    refFile = outputDir.getChildFile ("standalone_reference.wav");
    capFile = outputDir.getChildFile ("standalone_capture.wav");

    refFileLabel.setText (refFile.getFileName(), juce::dontSendNotification);
    capFileLabel.setText (capFile.getFileName(), juce::dontSendNotification);

    // Instanciar motor local
    ABD::SynthEngine localEngine;
    localEngine.prepare (currentSampleRate, 512);

    // Cargar especificaciones de calibración modificadas por el slider
    auto calib = ABD::SynthEngine::getFactoryDefaults();
    calib.transfer.lfo.rateScale = 0.041f * calibrationFactor; // Escalamos la constante según el factor
    localEngine.loadCalibrationFromJson (calib.toXml());

    // Renderizar buffer local
    juce::AudioBuffer<float> renderBuf (2, maxRecordingSamples);
    renderBuf.clear();

    juce::MidiBuffer midi;
    midi.addEvent (juce::MidiMessage::noteOn (1, 60, 0.8f), 0);
    midi.addEvent (juce::MidiMessage::noteOff (1, 60, 0.0f), (int)(currentSampleRate * 2.0));

    int blockSize = 512;
    int writePos = 0;
    while (writePos < maxRecordingSamples)
    {
        int toProcess = std::min (blockSize, maxRecordingSamples - writePos);
        juce::AudioBuffer<float> block (2, toProcess);
        block.clear();
        
        juce::MidiBuffer blockMidi;
        for (const auto meta : midi)
        {
            if (meta.samplePosition >= writePos && meta.samplePosition < writePos + toProcess)
                blockMidi.addEvent (meta.getMessage(), meta.samplePosition - writePos);
        }

        localEngine.processBlock (block, blockMidi);
        renderBuf.copyFrom (0, writePos, block, 0, 0, toProcess);
        renderBuf.copyFrom (1, writePos, block, 1, 0, toProcess);

        writePos += toProcess;
    }

    // Escribir a WAV de referencia
    juce::WavAudioFormat wavFormat;
    if (auto writer = std::unique_ptr<juce::AudioFormatWriter> (
            wavFormat.createWriterFor (new juce::FileOutputStream (refFile), currentSampleRate, 2, 24, {}, 0)))
    {
        writer->writeFromAudioSampleBuffer (renderBuf, 0, maxRecordingSamples);
    }
}

void AudioABValidationViewComponent::stopRecordingAndCompare()
{
    addLog ("Grabación finalizada. Apagando nota en hardware...");
    
    // Apagar nota en el hardware
    if (deviceManager != nullptr)
    {
        if (auto* activeMidiOutput = deviceManager->getDefaultMidiOutput())
        {
            auto noteOff = juce::MidiMessage::noteOff (1, 60);
            activeMidiOutput->sendMessageNow (noteOff);
        }
    }

    // Escribir WAV de captura
    juce::WavAudioFormat wavFormat;
    if (auto writer = std::unique_ptr<juce::AudioFormatWriter> (
            wavFormat.createWriterFor (new juce::FileOutputStream (capFile), currentSampleRate, 2, 24, {}, 0)))
    {
        writer->writeFromAudioSampleBuffer (recordedBuffer, 0, maxRecordingSamples);
    }

    // Renderizar referencia software local
    renderLocalSoftwareReference();

    // Ejecutar comparación
    runAcousticalComparison();
}

void AudioABValidationViewComponent::sliderValueChanged (juce::Slider* slider)
{
    if (slider == &calibrationSlider)
    {
        calibrationFactor = (float)calibrationSlider.getValue();
        addLog ("Factor de calibración LFO ajustado a: " + juce::String (calibrationFactor, 2) + "x");
        
        // Si ya hay archivos listos, re-renderizar y volver a comparar de forma inmediata
        if (refFile.existsAsFile() && capFile.existsAsFile())
        {
            renderLocalSoftwareReference();
            runAcousticalComparison();
        }
    }
}

#include "AudioABVisualizerComponent.h"

void AudioABValidationViewComponent::showVisualizer()
{
    // Abrir ventana emergente nativa pasándole copias de los buffers actuales
    auto* window = new AudioABVisualizerWindow (refAudioBuffer, capAudioBuffer);
    juce::ignoreUnused (window);
}

void AudioABValidationViewComponent::generateTestSysEx()
{
    // 1. Inicializar preset básico en memoria (242 bytes desempaquetados)
    std::array<uint8_t, 242> rawBytes;
    std::fill (rawBytes.begin(), rawBytes.end(), 0);

    // DCO 1 Diente de Sierra = ON (CC o NRPN offset en el mapeo)
    // Mapeado simplificado del DeepMind 12:
    // DCO1 Sawtooth: Param index 0 = On
    rawBytes[0] = 1;     // DCO1 Saw
    rawBytes[1] = 0;     // DCO1 Square (Off)
    rawBytes[3] = 255;   // DCO1 LFO depth (0)
    rawBytes[4] = 0;     // DCO1 Env depth (0)
    rawBytes[8] = 255;   // VCF Cutoff Frequency (255 = Abierto del todo)
    rawBytes[9] = 0;     // VCF Resonance (0 = Sin auto-oscilación para calibración de base)
    
    // Env VCA (ADSR Gate mode o envolvente simple)
    rawBytes[18] = 0;    // Attack Time (0 = Instantáneo)
    rawBytes[19] = 0;    // Decay Time (0)
    rawBytes[20] = 255;  // Sustain Level (255 = Nivel máximo sostenido)
    rawBytes[21] = 120;  // Release Time (120 = Decaimiento medio al soltar)

    // Escribir nombre del patch en los últimos 16 bytes (224 a 239)
    juce::String nameStr = "CALIB_TEST_RAW";
    for (int i = 0; i < 16; ++i)
    {
        if (i < nameStr.length())
            rawBytes[224 + i] = static_cast<uint8_t> (nameStr[i]);
        else
            rawBytes[224 + i] = ' ';
    }

    // 2. Empaquetar a 7-bits (Midi SysEx DeepMind 12)
    // 34 bloques de 7 bytes = 238 bytes (ocupan 34 * 8 = 272 bytes empaquetados)
    // 1 bloque final de 4 bytes = 4 bytes (ocupa 1 MSB + 4 datos = 5 bytes empaquetados)
    // Total payload = 277 bytes.
    std::vector<uint8_t> packedPayload;
    
    // Bloques completos
    for (size_t i = 0; i < 238; i += 7)
    {
        uint8_t msbByte = 0;
        std::vector<uint8_t> low7Bytes;

        for (int j = 0; j < 7; ++j)
        {
            uint8_t b = rawBytes[i + j];
            uint8_t msb = (b >> 7) & 0x01;
            msbByte |= (msb << j);
            low7Bytes.push_back (b & 0x7F);
        }

        packedPayload.push_back (msbByte & 0x7F);
        for (auto b7 : low7Bytes)
            packedPayload.push_back (b7);
    }

    // Bloque final incompleto (4 bytes)
    {
        uint8_t msbByte = 0;
        std::vector<uint8_t> low7Bytes;

        for (int j = 0; j < 4; ++j)
        {
            uint8_t b = rawBytes[238 + j];
            uint8_t msb = (b >> 7) & 0x01;
            msbByte |= (msb << j);
            low7Bytes.push_back (b & 0x7F);
        }

        packedPayload.push_back (msbByte & 0x7F);
        for (auto b7 : low7Bytes)
            packedPayload.push_back (b7);
    }

    // 3. Montar mensaje SysEx final con cabecera DeepMind (8 bytes) y fin de SysEx (0xF7)
    std::vector<uint8_t> syxData;
    syxData.push_back (0xF0); // Start of SysEx
    syxData.push_back (0x00); // Manufacturer ID 1
    syxData.push_back (0x20); // Manufacturer ID 2
    syxData.push_back (0x32); // Manufacturer ID 3 (Behringer)
    syxData.push_back (0x20); // Model ID (DeepMind)
    syxData.push_back (0x00); // Device ID (0)
    syxData.push_back (0x02); // Message Type: Edit Buffer Dump / Program Dump
    syxData.push_back (0x00); // Subtype/Bank

    for (auto b : packedPayload)
    {
        syxData.push_back (b);
    }
    syxData.push_back (0xF7); // End of SysEx

    // 4. Preguntar al usuario dónde guardar el fichero
    fileChooser = std::make_unique<juce::FileChooser> (
        "Save Generated Test Preset",
        juce::File::getSpecialLocation (juce::File::userDocumentsDirectory).getChildFile ("ABDEep"),
        "*.syx"
    );

    fileChooser->launchAsync (juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles,
        [this, rawBytes, syxData] (const juce::FileChooser& chooser) mutable
        {
            auto file = chooser.getResult();
            if (file != juce::File())
            {
                if (file.getFileExtension() != ".syx")
                    file = file.withFileExtension (".syx");

                // Crear directorios si no existen
                if (! file.getParentDirectory().exists())
                    file.getParentDirectory().createDirectory();

                juce::MemoryBlock mb (syxData.data(), syxData.size());
                if (file.replaceWithData (mb.getData(), mb.getSize()))
                {
                    // Cargar inmediatamente
                    std::copy (rawBytes.begin(), rawBytes.end(), testPatchBytes.begin());
                    testSysExFile = file;
                    testPatchLoaded = true;

                    testPatchLabel.setText ("Selected Test Patch: [CALIB_TEST_RAW] (File: " + file.getFileName() + ")", juce::dontSendNotification);
                    runAutomatedButton.setEnabled (true);

                    addLog ("---------------------------------------------------------");
                    addLog ("Preset básico generado y cargado con éxito.");
                    addLog ("Nombre: CALIB_TEST_RAW");
                    addLog ("Ruta: " + file.getFullPathName());

                    // Auto-enviar al hardware
                    sendSysExToHardware (syxData, "CALIB_TEST_RAW");
                }
            }
        }
    );
}

void AudioABValidationViewComponent::pullSysExFromHardware()
{
    auto* activeMidiOutput = deviceManager->getDefaultMidiOutput();
    if (activeMidiOutput == nullptr)
    {
        juce::AlertWindow::showMessageBoxAsync (juce::AlertWindow::WarningIcon, "Error MIDI", "No hay ningún puerto MIDI Output activo seleccionado en los ajustes.", "OK");
        return;
    }

    addLog ("Enviando solicitud de Edit Buffer Dump al hardware...");
    {
        const juce::ScopedLock sl (midiLock);
        sysExReceived = false;
    }

    auto dumpRequest = MidiTranslationEngine::createEditBufferDumpRequest();
    activeMidiOutput->sendMessageNow (dumpRequest);

    // Esperar respuesta MIDI en un bucle asíncrono corto (hasta 500 ms)
    for (int i = 0; i < 50; ++i)
    {
        juce::Thread::sleep (10);
        
        bool received = false;
        juce::MidiMessage msg;
        {
            const juce::ScopedLock sl (midiLock);
            received = sysExReceived;
            msg = lastReceivedSysEx;
        }

        if (received)
        {
            const uint8_t* rawData = msg.getSysExData();
            size_t size = (size_t) msg.getSysExDataSize();

            // Omitir cabecera (7 bytes en getSysExData sin F0) y el F7 final (1 byte)
            if (size > 8)
            {
                auto unpacked = MidiTranslationEngine::unpackDeepMindSysEx (rawData + 7, size - 8);
                if (unpacked.getSize() >= 242)
                {
                    unpacked.copyTo (testPatchBytes.data(), 0, 242);
                    testPatchLoaded = true;

                    char nameBuf[17];
                    std::memcpy (nameBuf, testPatchBytes.data() + 224, 16);
                    nameBuf[16] = '\0';
                    juce::String patchName (nameBuf);
                    patchName = patchName.trim();

                    testPatchLabel.setText ("Selected Test Patch: [" + patchName + "] (Pulled from Hardware)", juce::dontSendNotification);
                    runAutomatedButton.setEnabled (true);

                    addLog ("---------------------------------------------------------");
                    addLog ("Preset recuperado con éxito desde el hardware físico.");
                    addLog ("Nombre: " + patchName);
                    return;
                }
            }
        }
    }

    juce::AlertWindow::showMessageBoxAsync (juce::AlertWindow::WarningIcon, "Timeout MIDI", "El hardware de destino no respondió a la solicitud de Dump. Verifique las conexiones MIDI IN/OUT.", "OK");
}

void AudioABValidationViewComponent::sendSysExToHardware (const std::vector<uint8_t>& syxData, const juce::String& newPatchName)
{
    auto* activeMidiOutput = deviceManager->getDefaultMidiOutput();
    if (activeMidiOutput == nullptr)
        return; // Sin MIDI de salida no se puede transmitir

    // 1. Preguntar nombre del patch actual en el hardware para advertencia
    {
        const juce::ScopedLock sl (midiLock);
        sysExReceived = false;
    }

    auto dumpRequest = MidiTranslationEngine::createEditBufferDumpRequest();
    activeMidiOutput->sendMessageNow (dumpRequest);

    juce::String currentHardwarePatchName = "Active Edit Buffer";

    // Esperar respuesta corta para extraer el nombre
    for (int i = 0; i < 25; ++i)
    {
        juce::Thread::sleep (10);
        bool received = false;
        juce::MidiMessage msg;
        {
            const juce::ScopedLock sl (midiLock);
            received = sysExReceived;
            msg = lastReceivedSysEx;
        }

        if (received)
        {
            size_t size = (size_t) msg.getSysExDataSize();
            if (size > 8)
            {
                auto unpacked = MidiTranslationEngine::unpackDeepMindSysEx (msg.getSysExData() + 7, size - 8);
                if (unpacked.getSize() >= 242)
                {
                    char nameBuf[17];
                    std::memcpy (nameBuf, static_cast<const uint8_t*>(unpacked.getData()) + 224, 16);
                    nameBuf[16] = '\0';
                    currentHardwarePatchName = juce::String (nameBuf).trim();
                    break;
                }
            }
        }
    }

    // 2. Lanzar alerta emergente para confirmar sobreescritura
    juce::AlertWindow::showOkCancelBox (
        juce::AlertWindow::QuestionIcon,
        "Sustituir preset en Hardware",
        "Estás a punto de sobreescribir el preset '" + currentHardwarePatchName + "' actualmente cargado en tu sintetizador físico por el preset de test '" + newPatchName + "'.\n\n¿Quieres proceder con la transmisión MIDI?",
        "Transmitir preset",
        "Cancelar",
        nullptr,
        juce::ModalCallbackFunction::create ([this, activeMidiOutput, syxData, newPatchName] (int result)
        {
            if (result != 0) // Pulsó OK/Transmitir
            {
                juce::MidiMessage msg (syxData.data(), (int)syxData.size());
                activeMidiOutput->sendMessageNow (msg);
                addLog ("Preset '" + newPatchName + "' transmitido por MIDI al hardware con éxito.");
            }
            else
            {
                addLog ("Transmisión MIDI cancelada por el usuario. El hardware físico podría no estar sincronizado.");
            }
        })
    );
}
