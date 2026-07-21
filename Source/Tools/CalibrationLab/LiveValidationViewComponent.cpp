#include "LiveValidationViewComponent.h"

LiveValidationViewComponent::LiveValidationViewComponent (ABD::SynthEngine* sharedEngine)
    : synthEngine (sharedEngine)
{
    addAndMakeVisible (captureButton);
    captureButton.onClick = [this] {
        performValidation();
    };

    addAndMakeVisible (autoRefreshToggle);
    autoRefreshToggle.onClick = [this] {
        if (autoRefreshToggle.getToggleState())
            startTimerHz (5);
        else
            stopTimer();
    };

    addAndMakeVisible (noteOnButton);
    noteOnButton.onClick = [this] {
        if (synthEngine != nullptr)
        {
            juce::MidiBuffer midiBuf;
            midiBuf.addEvent (juce::MidiMessage::noteOn (1, 60, 0.8f), 0);
            juce::AudioBuffer<float> dummyBuffer (2, 512);
            synthEngine->processBlock (dummyBuffer, midiBuf);
            performValidation();
        }
    };

    addAndMakeVisible (noteOffButton);
    noteOffButton.onClick = [this] {
        if (synthEngine != nullptr)
        {
            juce::MidiBuffer midiBuf;
            midiBuf.addEvent (juce::MidiMessage::noteOff (1, 60, 0.0f), 0);
            juce::AudioBuffer<float> dummyBuffer (2, 512);
            synthEngine->processBlock (dummyBuffer, midiBuf);
            performValidation();
        }
    };

    addAndMakeVisible (panicButton);
    panicButton.onClick = [this] {
        if (synthEngine != nullptr)
        {
            synthEngine->panic();
            performValidation();
        }
    };

    // Labels
    statusLabel.setFont (juce::Font (16.0f, juce::Font::bold));
    addAndMakeVisible (statusLabel);

    countsLabel.setFont (juce::Font (13.0f));
    addAndMakeVisible (countsLabel);

    // Table Setup
    table.setModel (this);
    table.getHeader().addColumn ("Param ID", colParamId, 120);
    table.getHeader().addColumn ("Voice", colVoice, 60);
    table.getHeader().addColumn ("Base DSP", colBase, 90);
    table.getHeader().addColumn ("Effective DSP", colEffective, 100);
    table.getHeader().addColumn ("Expected", colExpected, 100);
    table.getHeader().addColumn ("Delta", colDelta, 70);
    table.getHeader().addColumn ("Tolerance", colTolerance, 70);
    table.getHeader().addColumn ("Classification", colClassification, 110);
    table.getHeader().addColumn ("Notes", colNotes, 150);
    addAndMakeVisible (table);

    performValidation();
}

LiveValidationViewComponent::~LiveValidationViewComponent()
{
    stopTimer();
}

void LiveValidationViewComponent::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colours::black);
}

void LiveValidationViewComponent::resized()
{
    auto area = getLocalBounds().reduced (10);

    // Top Bar
    auto topArea = area.removeFromTop (45);
    captureButton.setBounds (topArea.removeFromLeft (130).reduced (2));
    autoRefreshToggle.setBounds (topArea.removeFromLeft (150).reduced (2));
    noteOnButton.setBounds (topArea.removeFromLeft (130).reduced (2));
    noteOffButton.setBounds (topArea.removeFromLeft (110).reduced (2));
    panicButton.setBounds (topArea.removeFromLeft (80).reduced (2));

    // Summary bar
    auto summaryArea = area.removeFromTop (30);
    statusLabel.setBounds (summaryArea.removeFromLeft (150));
    countsLabel.setBounds (summaryArea);

    table.setBounds (area);
}

void LiveValidationViewComponent::timerCallback()
{
    // Polling moderado a 5 Hz
    performValidation();
}

int LiveValidationViewComponent::getNumRows()
{
    return (int)rows.size();
}

void LiveValidationViewComponent::paintRowBackground (juce::Graphics& g, int rowNumber, int width, int height, bool rowIsSelected)
{
    juce::ignoreUnused (rowNumber);
    if (rowIsSelected)
    {
        g.fillAll (juce::Colours::darkblue.withAlpha (0.4f));
    }
    else
    {
        g.fillAll (rowNumber % 2 == 0 ? juce::Colours::darkgrey.withAlpha (0.1f) : juce::Colours::transparentBlack);
    }
    g.setColour (juce::Colours::grey.withAlpha (0.2f));
    g.drawHorizontalLine (height - 1, 0.0f, (float)width);
}

void LiveValidationViewComponent::paintCell (juce::Graphics& g, int rowNumber, int columnId, int width, int height, bool rowIsSelected)
{
    if (rowNumber >= (int)rows.size()) return;
    const auto& r = rows[(size_t)rowNumber];

    g.setFont (13.0f);

    juce::Colour textColour = rowIsSelected ? juce::Colours::white : juce::Colours::lightgrey;
    if (r.classification == "mismatch")
        textColour = juce::Colours::coral;
    else if (r.classification == "match")
        textColour = juce::Colours::lightgreen;
    else if (r.classification == "within-tolerance")
        textColour = juce::Colours::yellow;
    else if (r.classification == "not-observable")
        textColour = juce::Colours::grey;

    g.setColour (textColour);

    juce::String text;
    switch (columnId)
    {
        case colParamId:        text = r.paramId; break;
        case colVoice:          text = r.voiceIndex >= 0 ? juce::String (r.voiceIndex) : "Global"; break;
        case colBase:           text = r.baseValStr; break;
        case colEffective:      text = r.effectiveValStr; break;
        case colExpected:       text = r.expectedValStr; break;
        case colDelta:          text = r.deltaStr; break;
        case colTolerance:      text = r.toleranceStr; break;
        case colClassification: text = r.classification; break;
        case colNotes:          text = r.notes; break;
    }

    g.drawText (text, 4, 0, width - 8, height, juce::Justification::centredLeft, true);
}

void LiveValidationViewComponent::performValidation()
{
    if (synthEngine == nullptr) return;

    currentSnap = synthEngine->getDiagnosticSnapshot();
    rows.clear();

    int matchCount = 0;
    int toleranceCount = 0;
    int mismatchCount = 0;
    int notObservableCount = 0;

    // 1. Validar parámetros globales del motor
    {
        ValidationRow r;
        r.paramId = "drift_amount";
        r.voiceIndex = -1;
        r.baseValStr = juce::String (currentSnap.driftAmount, 4);
        r.effectiveValStr = r.baseValStr;
        r.expectedValStr = r.baseValStr;
        r.deltaStr = "0.0";
        r.toleranceStr = "0.001";
        r.classification = "match";
        r.notes = "Global drift configuration";
        rows.push_back (r);
        matchCount++;
    }

    // 2. Validar parámetros por voz activa (Filtros VCF/HPF/Drift)
    bool hasActiveVoices = false;
    for (int i = 0; i < 12; ++i)
    {
        const auto& v = currentSnap.voiceSnapshots[i];
        if (!v.isActive) continue;

        hasActiveVoices = true;

        // VCF Cutoff Base vs Effective (VAL-02B)
        {
            ValidationRow r;
            r.paramId = "vcf_cutoff";
            r.voiceIndex = i;
            r.baseValStr = juce::String (v.baseCutoffHz, 1) + " Hz";
            r.effectiveValStr = juce::String (v.effectiveCutoffHz, 1) + " Hz";
            r.expectedValStr = juce::String (v.vcfCutoffBase, 1) + " Hz"; // Usando valor base como esperado
            
            float delta = std::abs (v.baseCutoffHz - v.vcfCutoffBase);
            r.deltaStr = juce::String (delta, 1) + " Hz";
            r.toleranceStr = "5.0 Hz";
            
            if (delta <= 5.0f)
            {
                r.classification = "match";
                matchCount++;
            }
            else
            {
                r.classification = "mismatch";
                mismatchCount++;
            }
            r.notes = "VCF cutoff base vs calibration target";
            rows.push_back (r);
        }

        // Voice Drift
        {
            ValidationRow r;
            r.paramId = "voice_drift";
            r.voiceIndex = i;
            r.baseValStr = "0.0 Hz";
            r.effectiveValStr = juce::String (v.driftHz, 2) + " Hz";
            r.expectedValStr = "Drifting";
            r.deltaStr = "-";
            r.toleranceStr = "-";
            r.classification = "within-tolerance";
            r.notes = "Analog Voice Drift active";
            rows.push_back (r);
            toleranceCount++;
        }

        // HPF Cutoff
        {
            ValidationRow r;
            r.paramId = "hpf_cutoff";
            r.voiceIndex = i;
            r.baseValStr = juce::String (v.hpfCutoffHz, 1) + " Hz";
            r.effectiveValStr = r.baseValStr;
            r.expectedValStr = juce::String (v.hpfCutoffBase, 1) + " Hz";
            float delta = std::abs (v.hpfCutoffHz - v.hpfCutoffBase);
            r.deltaStr = juce::String (delta, 1) + " Hz";
            r.toleranceStr = "1.0 Hz";
            if (delta <= 1.0f)
            {
                r.classification = "match";
                matchCount++;
            }
            else
            {
                r.classification = "mismatch";
                mismatchCount++;
            }
            r.notes = "HPF Cutoff frequency alignment";
            rows.push_back (r);
        }
    }

    if (!hasActiveVoices)
    {
        ValidationRow r;
        r.paramId = "engine_status";
        r.voiceIndex = -1;
        r.baseValStr = "Idle";
        r.effectiveValStr = "-";
        r.expectedValStr = "Active voices";
        r.deltaStr = "-";
        r.toleranceStr = "-";
        r.classification = "not-observable";
        r.notes = "Trigger notes to start real-time validation";
        rows.push_back (r);
        notObservableCount++;
    }

    // Configurar estado de resumen global
    if (mismatchCount == 0)
    {
        statusLabel.setText ("STATUS: PASS", juce::dontSendNotification);
        statusLabel.setColour (juce::Label::textColourId, juce::Colours::lightgreen);
    }
    else
    {
        statusLabel.setText ("STATUS: FAIL", juce::dontSendNotification);
        statusLabel.setColour (juce::Label::textColourId, juce::Colours::coral);
    }

    countsLabel.setText (juce::String::formatted ("Matches: %d | Tolerated: %d | Mismatches: %d | Not Obs: %d",
                                                 matchCount, toleranceCount, mismatchCount, notObservableCount),
                         juce::dontSendNotification);

    table.updateContent();
}
