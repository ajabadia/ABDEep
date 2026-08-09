#include "LiveValidationViewComponent.h"

LiveValidationViewComponent::LiveValidationViewComponent (ABD::SynthEngine* sharedEngine)
    : synthEngine (sharedEngine)
{
    addAndMakeVisible (captureButton);
    captureButton.onClick = [this] { performValidation(); };

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
    table.getHeader().addColumn ("Param ID",     colParamId,        120);
    table.getHeader().addColumn ("Voice",         colVoice,          60);
    table.getHeader().addColumn ("Base DSP",      colBase,           90);
    table.getHeader().addColumn ("Effective DSP", colEffective,     100);
    table.getHeader().addColumn ("Expected",      colExpected,      100);
    table.getHeader().addColumn ("Delta",         colDelta,          70);
    table.getHeader().addColumn ("Tolerance",     colTolerance,      70);
    table.getHeader().addColumn ("Classification", colClassification, 110);
    table.getHeader().addColumn ("Notes",         colNotes,         150);
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
    captureButton.setBounds     (topArea.removeFromLeft (130).reduced (2));
    autoRefreshToggle.setBounds (topArea.removeFromLeft (150).reduced (2));
    noteOnButton.setBounds      (topArea.removeFromLeft (130).reduced (2));
    noteOffButton.setBounds     (topArea.removeFromLeft (110).reduced (2));
    panicButton.setBounds       (topArea.removeFromLeft (80).reduced (2));

    // Summary bar
    auto summaryArea = area.removeFromTop (30);
    statusLabel.setBounds (summaryArea.removeFromLeft (150));
    countsLabel.setBounds (summaryArea);

    table.setBounds (area);
}

void LiveValidationViewComponent::timerCallback()
{
    performValidation();
}
