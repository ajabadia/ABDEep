#pragma once

#include <JuceHeader.h>
#include "DSP/SynthEngine.h"

class CalibrationEditorViewComponent : public juce::Component
{
public:
    CalibrationEditorViewComponent (ABD::SynthEngine* sharedEngine);
    ~CalibrationEditorViewComponent() override = default;

    void paint (juce::Graphics& g) override;
    void resized() override;

private:
    ABD::SynthEngine* synthEngine = nullptr;

    struct ParamControl
    {
        juce::String jsonPath;
        juce::String groupName;
        double defaultVal = 0.0;
        std::unique_ptr<juce::Label> groupHeaderLabel; // NULL si no es cabecera de grupo
        std::unique_ptr<juce::Label> label;
        std::unique_ptr<juce::Slider> slider;
        std::unique_ptr<juce::TextButton> resetButton;
        std::unique_ptr<juce::Label> valueLabel;
    };

    std::vector<std::unique_ptr<ParamControl>> paramControls;

    juce::Viewport viewport;
    juce::Component viewportContent;
    juce::TooltipWindow tooltipWindow { this };

    juce::TextButton loadJsonButton { "Load JSON Settings..." };
    juce::TextButton saveJsonButton { "Save JSON Settings..." };
    juce::TextButton saveToDefaultButton { "Save as Default Config" };
    juce::TextButton restoreDefaultsButton { "Restore Factory Defaults" };

    std::unique_ptr<juce::FileChooser> fileChooser;

    void buildControlsFromSpec();
    void updateEngineCalibration();
    void loadSettingsFromFile();
    void saveSettingsToFile();
    void saveToDefault();
    void restoreDefaults();
    void applySliderColouring (ParamControl* ctrl);

    // Helper recursivo para aplanar el JSON y crear controles
    void parseJsonObjectRecursively (const juce::var& obj, const juce::String& currentPath);

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CalibrationEditorViewComponent)
};
