#pragma once

#include <JuceHeader.h>
#include "DSP/SynthEngine.h"
#include "Core/DiagnosticSnapshots.h"

class LiveValidationViewComponent : public juce::Component,
                                    public juce::TableListBoxModel,
                                    public juce::Timer
{
public:
    LiveValidationViewComponent (ABD::SynthEngine* sharedEngine);
    ~LiveValidationViewComponent() override;

    void paint (juce::Graphics& g) override;
    void resized() override;

    // Timer interface
    void timerCallback() override;

    // Métodos de TableListBoxModel
    int getNumRows() override;
    void paintRowBackground (juce::Graphics& g, int rowNumber, int width, int height, bool rowIsSelected) override;
    void paintCell (juce::Graphics& g, int rowNumber, int columnId, int width, int height, bool rowIsSelected) override;

    enum ColumnIds
    {
        colParamId = 1,
        colVoice,
        colBase,
        colEffective,
        colExpected,
        colDelta,
        colTolerance,
        colClassification,
        colNotes
    };

private:
    ABD::SynthEngine* synthEngine = nullptr;

    juce::TextButton captureButton { "Capture Snapshot" };
    juce::ToggleButton autoRefreshToggle { "Auto Refresh (5 Hz)" };
    
    juce::TextButton noteOnButton { "Send Note On (C4)" };
    juce::TextButton noteOffButton { "Send Note Off" };
    juce::TextButton panicButton { "Panic" };

    juce::Label statusLabel;
    juce::Label countsLabel;

    juce::TableListBox table;

    struct ValidationRow
    {
        juce::String paramId;
        int voiceIndex = -1;
        juce::String baseValStr;
        juce::String effectiveValStr;
        juce::String expectedValStr;
        juce::String deltaStr;
        juce::String toleranceStr;
        juce::String classification; // "match", "within-tolerance", "mismatch", "not-observable"
        juce::String notes;
    };

    std::vector<ValidationRow> rows;
    EngineDiagnosticSnapshot currentSnap;

    void performValidation();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (LiveValidationViewComponent)
};
