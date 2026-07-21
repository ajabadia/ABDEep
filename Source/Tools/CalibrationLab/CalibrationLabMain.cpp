#include <JuceHeader.h>
#include "CalibrationLabWindow.h"

class CalibrationLabApplication : public juce::JUCEApplication
{
public:
    CalibrationLabApplication() {}

    const juce::String getApplicationName() override       { return "ABD Eep Calibration Lab"; }
    const juce::String getApplicationVersion() override    { return "0.1.0"; }
    bool moreThanOneInstanceAllowed() override             { return true; }

    void initialise (const juce::String& commandLine) override
    {
        juce::ignoreUnused (commandLine);
        mainWindow = std::make_unique<CalibrationLabWindow> (getApplicationName());
    }

    void shutdown() override
    {
        mainWindow = nullptr;
    }

    void systemRequestedQuit() override
    {
        quit();
    }

    void anotherInstanceStarted (const juce::String& commandLine) override
    {
        juce::ignoreUnused (commandLine);
    }

private:
    std::unique_ptr<CalibrationLabWindow> mainWindow;
};

START_JUCE_APPLICATION (CalibrationLabApplication)
