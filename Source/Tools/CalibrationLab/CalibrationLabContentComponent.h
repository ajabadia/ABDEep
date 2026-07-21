#pragma once

#include <JuceHeader.h>
#include "DSP/SynthEngine.h"
#include "ParamTraceViewComponent.h"
#include "PatchDiffViewComponent.h"
#include "RoundTripViewComponent.h"
#include "LiveValidationViewComponent.h"
#include "AudioABValidationViewComponent.h"
#include "CalibrationEditorViewComponent.h"

class CalibrationLabContentComponent : public juce::Component
{
public:
    CalibrationLabContentComponent();
    ~CalibrationLabContentComponent() override = default;

    void paint (juce::Graphics& g) override;
    void resized() override;

private:
    std::unique_ptr<ABD::SynthEngine> synthEngine;
    juce::AudioDeviceManager deviceManager;

    // Componentes de la interfaz
    juce::Label titleLabel;
    juce::TextButton settingsButton { "Audio/MIDI Settings..." };
    juce::TabbedComponent tabbedComponent { juce::TabbedButtonBar::TabsAtTop };

    // Sub-paneles para cada pestaña
    std::unique_ptr<ParamTraceViewComponent> traceView;
    std::unique_ptr<PatchDiffViewComponent> diffView;
    std::unique_ptr<RoundTripViewComponent> roundTripView;
    std::unique_ptr<LiveValidationViewComponent> liveValidationView;
    std::unique_ptr<AudioABValidationViewComponent> audioABView;
    std::unique_ptr<CalibrationEditorViewComponent> calibEditorView;

    void openSettingsWindow();

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CalibrationLabContentComponent)
};
