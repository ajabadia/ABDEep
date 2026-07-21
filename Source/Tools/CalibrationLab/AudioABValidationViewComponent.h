#pragma once

#include <JuceHeader.h>
#include "Calibration/AudioABComparator.h"
#include "Calibration/AudioABVerdictEngine.h"

namespace ABD { class SynthEngine; }

class AudioABValidationViewComponent : public juce::Component,
                                       public juce::MidiInputCallback,
                                       public juce::AudioIODeviceCallback,
                                       public juce::Slider::Listener
{
public:
    AudioABValidationViewComponent (juce::AudioDeviceManager* deviceManagerToUse, ABD::SynthEngine* engineToUse);
    ~AudioABValidationViewComponent() override;

    void paint (juce::Graphics& g) override;
    void resized() override;

    // Callback de MIDI
    void handleIncomingMidiMessage (juce::MidiInput* source, const juce::MidiMessage& message) override;

    // Callback de Audio
    void audioDeviceAboutToStart (juce::AudioIODevice* device) override;
    void audioDeviceStopped() override;
    void audioDeviceIOCallbackWithContext (const float* const* inputChannelData, int numInputChannels,
                                           float* const* outputChannelData, int numOutputChannels,
                                           int numSamples, const juce::AudioIODeviceCallbackContext& context) override;

    // Callback de Slider
    void sliderValueChanged (juce::Slider* slider) override;

private:
    void chooseReferenceFile();
    void chooseCaptureFile();
    void runAcousticalComparison();
    void addLog (const juce::String& message);

    // Controles
    juce::TextButton loadRefButton { "Load Reference WAV..." };
    juce::TextButton loadCapButton { "Load Capture WAV..." };
    juce::TextButton compareButton { "Run Acoustical Comparison" };

    juce::ToggleButton trimSilenceToggle { "Trim Silence (Leading/Trailing)" };
    juce::ToggleButton normalizeGainToggle { "Normalize Gain" };

    juce::Label refFileLabel;
    juce::Label capFileLabel;

    // Report Console View
    juce::TextEditor consoleLog;

    // Ficheros seleccionados
    juce::File refFile;
    juce::File capFile;

    std::unique_ptr<juce::FileChooser> fileChooser;
    juce::AudioDeviceManager* deviceManager = nullptr;

    // SysEx test files
    juce::TextButton loadSysExButton { "Load Test Preset SysEx..." };
    juce::TextButton generateSysExButton { "Generate Basic Test SysEx..." };
    juce::TextButton pullSysExButton { "Pull SysEx from Hardware" };
    juce::Label testPatchLabel { "TestPatchName", "No test patch loaded (Select SysEx to start)" };
    std::array<uint8_t, 242> testPatchBytes;
    bool testPatchLoaded = false;
    juce::File testSysExFile;

    void chooseSysExFile();
    void generateTestSysEx();
    void pullSysExFromHardware();
    void sendSysExToHardware (const std::vector<uint8_t>& syxData, const juce::String& newPatchName);

    // Automated loop execution variables
    juce::TextButton runAutomatedButton { "Run Automated Test Cycle" };
    juce::Slider calibrationSlider;
    juce::Label calibrationLabel { "CalibFactor", "DSP LFO Speed Multiplier Calibration:" };
    float calibrationFactor = 1.0f;

    bool isRecording = false;
    int samplesRecorded = 0;
    int maxRecordingSamples = 0;
    double currentSampleRate = 44100.0;
    juce::AudioBuffer<float> recordedBuffer;

    juce::AudioBuffer<float> refAudioBuffer;
    juce::AudioBuffer<float> capAudioBuffer;

    juce::TextButton showVisualizerButton { "Show Visual Comparison..." };
    void showVisualizer();

    void startAutomatedTest();
    void renderLocalSoftwareReference();
    void stopRecordingAndCompare();

    // SysEx handshake variables
    juce::CriticalSection midiLock;
    bool sysExReceived = false;
    juce::MidiMessage lastReceivedSysEx;
    ABD::SynthEngine* synthEngine = nullptr;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (AudioABValidationViewComponent)
};
