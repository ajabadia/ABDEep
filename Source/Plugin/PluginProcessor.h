#pragma once

#include <JuceHeader.h>
#include "DSP/SynthEngine.h"
#include "Calibration/AudioABRecorder.h"

class ABDEepAudioProcessor : public juce::AudioProcessor
{
public:
    ABDEepAudioProcessor();
    ~ABDEepAudioProcessor() override;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override;

    const juce::String getName() const override;
    bool acceptsMidi() const override;
    bool producesMidi() const override;
    bool isMidiEffect() const override;
    double getTailLengthSeconds() const override;

    int getNumPrograms() override;
    int getCurrentProgram() override;
    void setCurrentProgram (int index) override;
    const juce::String getProgramName (int index) override;
    void changeProgramName (int index, const juce::String& newName) override;

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState& getAPVTS() { return apvts; }
    ABD::SynthEngine& getSynthEngine() { return synthEngine; }
    AudioABRecorder& getAudioABRecorder() { return audioABRecorder; }

    void queueMidiMessage (const juce::MidiMessage& msg)
    {
        const juce::ScopedLock sl (midiQueueLock);
        midiQueue.addEvent (msg, 0);
    }

    void clearMidiQueue()
    {
        const juce::ScopedLock sl (midiQueueLock);
        midiQueue.clear();
    }

private:
    juce::AudioProcessorValueTreeState apvts;
    juce::MidiBuffer midiQueue;
    juce::CriticalSection midiQueueLock;
    ABD::SynthEngine synthEngine;
    AudioABRecorder audioABRecorder;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ABDEepAudioProcessor)
};
