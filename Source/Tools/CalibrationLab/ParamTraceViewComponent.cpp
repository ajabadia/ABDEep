#include "ParamTraceViewComponent.h"

ParamTraceViewComponent::ParamTraceViewComponent (ABD::SynthEngine* sharedEngine)
    : synthEngine (sharedEngine)
{
    // 1. Selector de Voz (Voz 0 - 11)
    voiceSelector.addItemList ({"Voice 0", "Voice 1", "Voice 2", "Voice 3", "Voice 4", "Voice 5",
                                "Voice 6", "Voice 7", "Voice 8", "Voice 9", "Voice 10", "Voice 11"}, 1);
    voiceSelector.setSelectedId (1);
    voiceSelector.onChange = [this] {
        activeVoiceIndex = voiceSelector.getSelectedItemIndex();
    };
    addAndMakeVisible (voiceSelector);

    // 2. Botón de Freeze (Congelar UI)
    freezeToggle.setButtonText ("Freeze UI");
    freezeToggle.onClick = [this] {
        isFrozen = freezeToggle.getToggleState();
    };
    addAndMakeVisible (freezeToggle);

    // 3. Configurar Tabla
    table.setModel (&tableModel);
    table.getHeader().addColumn ("Param ID", ParamTraceTableModel::colParamId, 130);
    table.getHeader().addColumn ("Offset", ParamTraceTableModel::colOffset, 60);
    table.getHeader().addColumn ("Raw Val", ParamTraceTableModel::colRaw, 80);
    table.getHeader().addColumn ("Normalized", ParamTraceTableModel::colNormalized, 100);
    table.getHeader().addColumn ("DSP Base", ParamTraceTableModel::colDspBase, 100);
    table.getHeader().addColumn ("DSP Effective", ParamTraceTableModel::colDspEffective, 100);
    table.getHeader().addColumn ("Derived", ParamTraceTableModel::colDerived, 70);
    addAndMakeVisible (table);

    // 4. Panel de Detalles de Modulación
    detailGroup.setText ("VCF Cutoff Modulation Contributions");
    addAndMakeVisible (detailGroup);

    cutoffEnvLabel.setText ("Env Contribution: - Hz", juce::dontSendNotification);
    cutoffLfoLabel.setText ("LFO Contribution: - Hz", juce::dontSendNotification);
    cutoffDriftLabel.setText ("Drift Contribution: - Hz", juce::dontSendNotification);
    cutoffKeytrackLabel.setText ("Keytrack Contribution: - Hz", juce::dontSendNotification);

    addAndMakeVisible (cutoffEnvLabel);
    addAndMakeVisible (cutoffLfoLabel);
    addAndMakeVisible (cutoffDriftLabel);
    addAndMakeVisible (cutoffKeytrackLabel);

    // 5. Iniciar Timer para refresco a 30 FPS (aprox 33ms)
    startTimerHz (30);
}

ParamTraceViewComponent::~ParamTraceViewComponent()
{
    stopTimer();
}

void ParamTraceViewComponent::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void ParamTraceViewComponent::resized()
{
    auto area = getLocalBounds().reduced (10);
    
    // Top Bar
    auto topArea = area.removeFromTop (40);
    voiceSelector.setBounds (topArea.removeFromRight (120).reduced (2));
    freezeToggle.setBounds (topArea.removeFromRight (100).reduced (2));

    // Bottom Detail Panel
    auto bottomArea = area.removeFromBottom (140);
    detailGroup.setBounds (bottomArea);
    
    auto detailBounds = bottomArea.reduced (15);
    auto col1 = detailBounds.removeFromLeft (detailBounds.getWidth() / 2);
    
    cutoffEnvLabel.setBounds (col1.removeFromTop (35));
    cutoffLfoLabel.setBounds (col1.removeFromTop (35));
    
    cutoffDriftLabel.setBounds (detailBounds.removeFromTop (35));
    cutoffKeytrackLabel.setBounds (detailBounds.removeFromTop (35));

    // Center Table
    area.removeFromBottom (10);
    table.setBounds (area);
}

void ParamTraceViewComponent::timerCallback()
{
    if (synthEngine == nullptr)
        return;

    // Procesar bloques de audio ficticios para mantener vivos los LFOs
    juce::AudioBuffer<float> dummyBuffer (2, 512);
    juce::MidiBuffer dummyMidi;
    synthEngine->processBlock (dummyBuffer, dummyMidi);

    if (isFrozen)
        return;

    auto engineSnap = synthEngine->getDiagnosticSnapshot();
    if (activeVoiceIndex >= 0 && activeVoiceIndex < 12)
    {
        const auto& voiceSnap = engineSnap.voiceSnapshots[activeVoiceIndex];
        tableModel.updateData (voiceSnap, engineSnap);
        updateDetails (voiceSnap);
    }
    table.updateContent();
    table.repaint();
}

void ParamTraceViewComponent::updateDetails (const VoiceDiagnosticSnapshot& v)
{
    if (!v.isActive)
    {
        cutoffEnvLabel.setText ("Env Contribution: -", juce::dontSendNotification);
        cutoffLfoLabel.setText ("LFO Contribution: -", juce::dontSendNotification);
        cutoffDriftLabel.setText ("Drift Contribution: -", juce::dontSendNotification);
        cutoffKeytrackLabel.setText ("Keytrack Contribution: -", juce::dontSendNotification);
        return;
    }

    cutoffEnvLabel.setText ("Env Contribution: " + juce::String (v.cutoffFromEnv, 1) + " Hz", juce::dontSendNotification);
    cutoffLfoLabel.setText ("LFO Contribution: " + juce::String (v.cutoffFromLfo, 1) + " Hz", juce::dontSendNotification);
    cutoffDriftLabel.setText ("Drift Contribution: " + juce::String (v.cutoffFromDrift, 2) + " Hz", juce::dontSendNotification);
    cutoffKeytrackLabel.setText ("Keytrack Contribution: " + juce::String (v.cutoffFromKeytrack, 1) + " Hz", juce::dontSendNotification);
}
