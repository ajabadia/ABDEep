#include "CalibrationLabContentComponent.h"

CalibrationLabContentComponent::CalibrationLabContentComponent()
{
    // 0. Inicializar el motor de audio por defecto
    deviceManager.initialiseWithDefaultDevices (2, 2);

    // 1. Inicializar el motor de síntesis local
    synthEngine = std::make_unique<ABD::SynthEngine>();
    synthEngine->prepare (44100.0, 512);

    // Activar una nota de prueba para que la Voz 0 esté activa
    juce::MidiBuffer midiBuf;
    midiBuf.addEvent (juce::MidiMessage::noteOn (1, 60, 0.8f), 0);
    juce::AudioBuffer<float> dummyBuffer (2, 512);
    synthEngine->processBlock (dummyBuffer, midiBuf);

    // 2. Título principal y botón de settings
    titleLabel.setText ("ABD Eep Calibration Lab - Diagnostics Console", juce::dontSendNotification);
    titleLabel.setFont (juce::Font (18.0f, juce::Font::bold));
    addAndMakeVisible (titleLabel);

    settingsButton.onClick = [this] { openSettingsWindow(); };
    addAndMakeVisible (settingsButton);

    // 3. Inicializar sub-vistas
    traceView = std::make_unique<ParamTraceViewComponent> (synthEngine.get());
    diffView = std::make_unique<PatchDiffViewComponent>();
    roundTripView = std::make_unique<RoundTripViewComponent>();
    liveValidationView = std::make_unique<LiveValidationViewComponent> (synthEngine.get());
    audioABView = std::make_unique<AudioABValidationViewComponent> (&deviceManager, synthEngine.get());
    calibEditorView = std::make_unique<CalibrationEditorViewComponent> (synthEngine.get());

    // 4. Configurar TabbedComponent
    tabbedComponent.addTab ("Param Trace", juce::Colours::transparentBlack, traceView.get(), false);
    tabbedComponent.addTab ("Patch Diff", juce::Colours::transparentBlack, diffView.get(), false);
    tabbedComponent.addTab ("Round-Trip", juce::Colours::transparentBlack, roundTripView.get(), false);
    tabbedComponent.addTab ("Live Validation", juce::Colours::transparentBlack, liveValidationView.get(), false);
    tabbedComponent.addTab ("Audio A/B", juce::Colours::transparentBlack, audioABView.get(), false);
    tabbedComponent.addTab ("Calibration Editor", juce::Colours::transparentBlack, calibEditorView.get(), false);
    
    addAndMakeVisible (tabbedComponent);
}

void CalibrationLabContentComponent::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void CalibrationLabContentComponent::resized()
{
    auto area = getLocalBounds().reduced (10);
    
    // Top Bar
    auto topArea = area.removeFromTop (40);
    settingsButton.setBounds (topArea.removeFromRight (150).reduced (2));
    titleLabel.setBounds (topArea);

    // Tabbed Component takes the rest of the window
    tabbedComponent.setBounds (area);
}

void CalibrationLabContentComponent::openSettingsWindow()
{
    // Crear y mostrar un panel flotante de configuración de dispositivos de JUCE
    auto* selector = new juce::AudioDeviceSelectorComponent (
        deviceManager,
        0, 256, // Min/Max entrada
        0, 256, // Min/Max salida
        true,   // MIDI de entrada
        true,   // MIDI de salida
        true,   // Canales individuales
        false   // Usar sliders
    );

    selector->setSize (500, 450);

    juce::DialogWindow::LaunchOptions dialog;
    dialog.content.setOwned (selector);
    dialog.dialogTitle = "Audio/MIDI Settings";
    dialog.dialogBackgroundColour = getLookAndFeel().findColour (juce::ResizableWindow::backgroundColourId);
    dialog.escapeKeyTriggersCloseButton = true;
    dialog.useNativeTitleBar = true;
    dialog.resizable = false;

    dialog.launchAsync();
}
