/**
 * @purpose AudioABValidation UI — lifecycle and layout.
 * File selection + comparison logic is in AudioABValidationViewComponent_Comparison.cpp.
 * SysEx operations are in AudioABValidationViewComponent_SysEx.cpp.
 * Audio callbacks + automated test are in AudioABValidationViewComponent_Audio.cpp.
 */
#include "AudioABValidationViewComponent.h"

AudioABValidationViewComponent::AudioABValidationViewComponent(
    juce::AudioDeviceManager* deviceManagerToUse, ABD::SynthEngine* engineToUse)
    : deviceManager(deviceManagerToUse), synthEngine(engineToUse)
{
    if (deviceManager != nullptr)
    {
        deviceManager->addMidiInputCallback(juce::String(), this);
        deviceManager->addAudioCallback(this);
    }

    // Automated Test Button
    addAndMakeVisible(runAutomatedButton);
    runAutomatedButton.onClick = [this] { startAutomatedTest(); };
    runAutomatedButton.setColour(juce::TextButton::buttonColourId, juce::Colours::darkred);
    runAutomatedButton.setEnabled(false);

    // SysEx Buttons
    addAndMakeVisible(loadSysExButton);
    loadSysExButton.onClick = [this] { chooseSysExFile(); };

    addAndMakeVisible(generateSysExButton);
    generateSysExButton.onClick = [this] { generateTestSysEx(); };
    generateSysExButton.setColour(juce::TextButton::buttonColourId, juce::Colours::darkgrey.withAlpha(0.6f));

    addAndMakeVisible(pullSysExButton);
    pullSysExButton.onClick = [this] { pullSysExFromHardware(); };
    pullSysExButton.setColour(juce::TextButton::buttonColourId, juce::Colours::darkblue);

    addAndMakeVisible(testPatchLabel);
    testPatchLabel.setFont(juce::Font(12.0f, juce::Font::italic));

    // Calibration Slider
    addAndMakeVisible(calibrationSlider);
    calibrationSlider.setRange(0.8, 1.2, 0.01);
    calibrationSlider.setValue(1.0);
    calibrationSlider.setSliderStyle(juce::Slider::LinearHorizontal);
    calibrationSlider.setTextBoxStyle(juce::Slider::TextBoxRight, false, 80, 20);
    calibrationSlider.addListener(this);

    addAndMakeVisible(calibrationLabel);
    calibrationLabel.setFont(juce::Font(12.0f, juce::Font::plain));

    // Comparison Buttons
    addAndMakeVisible(loadRefButton);
    loadRefButton.onClick = [this] { chooseReferenceFile(); };

    addAndMakeVisible(loadCapButton);
    loadCapButton.onClick = [this] { chooseCaptureFile(); };

    addAndMakeVisible(compareButton);
    compareButton.onClick = [this] { runAcousticalComparison(); };
    compareButton.setEnabled(false);

    addAndMakeVisible(showVisualizerButton);
    showVisualizerButton.onClick = [this] { showVisualizer(); };
    showVisualizerButton.setEnabled(false);
    showVisualizerButton.setColour(juce::TextButton::buttonColourId, juce::Colours::darkblue);

    // Toggles
    trimSilenceToggle.setToggleState(true, juce::dontSendNotification);
    addAndMakeVisible(trimSilenceToggle);

    normalizeGainToggle.setToggleState(false, juce::dontSendNotification);
    addAndMakeVisible(normalizeGainToggle);

    // File Labels
    refFileLabel.setText("No reference file selected", juce::dontSendNotification);
    refFileLabel.setFont(juce::Font(12.0f, juce::Font::italic));
    addAndMakeVisible(refFileLabel);

    capFileLabel.setText("No capture file selected", juce::dontSendNotification);
    capFileLabel.setFont(juce::Font(12.0f, juce::Font::italic));
    addAndMakeVisible(capFileLabel);

    // Console
    consoleLog.setMultiLine(true);
    consoleLog.setReadOnly(true);
    consoleLog.setScrollbarsShown(true);
    consoleLog.setCaretVisible(false);
    consoleLog.setFont(juce::Font("Share Tech Mono", 12.0f, juce::Font::plain));
    consoleLog.setColour(juce::TextEditor::backgroundColourId, juce::Colours::black);
    consoleLog.setTextToShowWhenEmpty(
        "Calibration Lab Diagnostics Console\nSelect Reference & Capture WAV files to begin validation.",
        juce::Colours::grey);
    addAndMakeVisible(consoleLog);
}

AudioABValidationViewComponent::~AudioABValidationViewComponent()
{
    if (deviceManager != nullptr)
    {
        deviceManager->removeMidiInputCallback(juce::String(), this);
        deviceManager->removeAudioCallback(this);
    }
}

void AudioABValidationViewComponent::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colours::black);
}

void AudioABValidationViewComponent::resized()
{
    auto area = getLocalBounds().reduced(10);
    auto configArea = area.removeFromTop(200);

    // SysEx row
    auto rowSysEx = configArea.removeFromTop(35);
    loadSysExButton.setBounds(rowSysEx.removeFromLeft(160).reduced(2));
    generateSysExButton.setBounds(rowSysEx.removeFromLeft(180).reduced(2));
    pullSysExButton.setBounds(rowSysEx.removeFromLeft(180).reduced(2));
    testPatchLabel.setBounds(rowSysEx.reduced(2));

    // Automated test
    runAutomatedButton.setBounds(configArea.removeFromTop(30).reduced(2));

    // Calibration slider
    auto rowSlider = configArea.removeFromTop(30);
    calibrationLabel.setBounds(rowSlider.removeFromLeft(250).reduced(2));
    calibrationSlider.setBounds(rowSlider.reduced(2));

    // Reference + Capture file rows
    auto row1 = configArea.removeFromTop(30);
    loadRefButton.setBounds(row1.removeFromLeft(160).reduced(2));
    refFileLabel.setBounds(row1.reduced(2));

    auto row2 = configArea.removeFromTop(30);
    loadCapButton.setBounds(row2.removeFromLeft(160).reduced(2));
    capFileLabel.setBounds(row2.reduced(2));

    // Compare row with toggles
    auto row3 = configArea.removeFromTop(35);
    trimSilenceToggle.setBounds(row3.removeFromLeft(200).reduced(2));
    normalizeGainToggle.setBounds(row3.removeFromLeft(120).reduced(2));
    compareButton.setBounds(row3.removeFromLeft(180).reduced(2));
    showVisualizerButton.setBounds(row3.reduced(2));

    area.removeFromTop(10);
    consoleLog.setBounds(area);
}

void AudioABValidationViewComponent::addLog(const juce::String& message)
{
    consoleLog.insertTextAtCaret(message + "\n");
}
