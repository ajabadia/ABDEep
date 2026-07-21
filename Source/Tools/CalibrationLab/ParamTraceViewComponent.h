#pragma once

#include <JuceHeader.h>
#include "DSP/SynthEngine.h"
#include "ParamTraceTableModel.h"

class ParamTraceViewComponent : public juce::Component,
                                public juce::Timer
{
public:
    ParamTraceViewComponent (ABD::SynthEngine* sharedEngine);
    ~ParamTraceViewComponent() override;

    void paint (juce::Graphics& g) override;
    void resized() override;

    // Timer interface
    void timerCallback() override;

private:
    ABD::SynthEngine* synthEngine = nullptr;

    // UI Components
    juce::ComboBox voiceSelector;
    juce::ToggleButton freezeToggle;
    
    juce::TableListBox table;
    ParamTraceTableModel tableModel;

    // Voice Detail Panel
    juce::GroupComponent detailGroup;
    juce::Label cutoffEnvLabel;
    juce::Label cutoffLfoLabel;
    juce::Label cutoffDriftLabel;
    juce::Label cutoffKeytrackLabel;

    int activeVoiceIndex = 0;
    bool isFrozen = false;

    void updateDetails (const VoiceDiagnosticSnapshot& voiceSnap);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ParamTraceViewComponent)
};
