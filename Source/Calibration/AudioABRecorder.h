// Source/Calibration/AudioABRecorder.h
#pragma once

#include <JuceHeader.h>
#include "DSP/SynthEngine.h"

struct AudioABRunConfig
{
    juce::String runId;
    juce::String patchName;
    int midiNote = 48;          // C3
    int velocity = 100;         // 1..127
    double noteDurationSec = 2.0;
    double tailDurationSec = 0.5;
    double sampleRate = 44100.0;
    int bitDepth = 24;
    int numChannels = 2;
    int deviceInputChannels = 2;
};

struct AudioABTakeInfo
{
    juce::String kind;          // "hardware" | "software"
    juce::File wavFile;
    int64 numSamples = 0;
    double sampleRate = 44100.0;
    int numChannels = 2;
    double durationSec = 0.0;
    double peakDbfs = 0.0;
    double rmsDbfs = 0.0;
};

struct AudioABRunResult
{
    juce::String runId;
    juce::String patchName;
    juce::Time startedAt;
    juce::File outputDir;
    AudioABTakeInfo hardwareTake;
    AudioABTakeInfo softwareTake;
    juce::File manifestFile;
    bool ok = false;
    juce::String error;
};

class AudioABRecorder
{
public:
    AudioABRecorder();
    ~AudioABRecorder();

    void prepare(double sampleRate, int maxBlockSize, int numInputChannels, int numOutputChannels);
    void setOutputRoot(const juce::File& rootDir);

    bool beginRun(const AudioABRunConfig& config, const juce::String& patchSnapshotJson);
    void processHardwareInput(const juce::AudioBuffer<float>& inputBuffer, int numSamples);
    bool renderSoftwareReference(ABD::SynthEngine& engine);
    bool finishRun(AudioABRunResult& result);
    void abortRun();

    bool isRunning() const noexcept;

private:
    AudioABRunConfig currentConfig;
    juce::File outputRoot;
    juce::File currentRunDir;

    double sampleRate = 44100.0;
    int maxBlockSize = 512;
    int numInputChannels = 2;
    int numOutputChannels = 2;

    juce::AudioBuffer<float> hardwareBuffer;
    juce::AudioBuffer<float> softwareBuffer;
    int hardwareWritePos = 0;
    juce::String patchSnapshotJson;
    juce::Time startedAt;
    bool running = false;

    bool writeWav(const juce::File& file, const juce::AudioBuffer<float>& buffer,
                  double sampleRate, int bitDepth);
    AudioABTakeInfo buildTakeInfo(const juce::String& kind,
                                  const juce::File& wavFile,
                                  const juce::AudioBuffer<float>& buffer,
                                  double sampleRate) const;
    bool writeManifest(const AudioABRunResult& result, const juce::String& patchSnapshotJson) const;
};
