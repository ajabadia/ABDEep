#pragma once

#include <JuceHeader.h>

class CalibrationLabWindow : public juce::DocumentWindow
{
public:
    CalibrationLabWindow (juce::String name);
    ~CalibrationLabWindow() override;

    void closeButtonPressed() override;

private:
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (CalibrationLabWindow)
};
