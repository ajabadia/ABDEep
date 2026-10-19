#pragma once

#include <array>
#include <cstring>
#include <functional>
#include <memory>
#include <JuceHeader.h>
#include <AutoUpdater/AutoUpdater.h>
#include "DSP/SynthEngine.h"
#include "Calibration/AudioABRecorder.h"
#include "Plugin/PatchController.h"

class ABDEepAudioProcessor : public juce::AudioProcessor
{
public:
    ABDEepAudioProcessor();
    ~ABDEepAudioProcessor() override;

    void prepareToPlay (double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;
    void processBlockBypassed (juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

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

    juce::UndoManager* getUndoManager() { return &undoManager; }
    juce::AudioProcessorValueTreeState& getAPVTS() { return apvts; }
    ABD::SynthEngine& getSynthEngine() { return synthEngine; }
    AudioABRecorder& getAudioABRecorder() { return audioABRecorder; }
    ABDShared::AutoUpdater* getAutoUpdater() noexcept { return autoUpdater.get(); }

    juce::String getPresetName() const { return currentPresetName; }
    void setPresetName (const juce::String& newName);

    juce::String getMidiLearnState() const
    {
        const juce::ScopedLock sl (midiLearnLock);
        return midiLearnJson;
    }

    void setMidiLearnState (const juce::String& json)
    {
        const juce::ScopedLock sl (midiLearnLock);
        midiLearnJson = json;
    }

    ABD::PatchController& getPatchController() { return patchController; }

    void queueMidiMessage (const juce::MidiMessage& msg) noexcept
    {
        const int rawSize = msg.getRawDataSize();
        if (rawSize <= 0 || rawSize > QueuedMidiPacket::kMaxBytes)
            return;

        const auto scope = midiFifo.write (1);
        if (scope.blockSize1 > 0)
        {
            auto& pkt = midiRingBuffer[static_cast<size_t> (scope.startIndex1)];
            pkt.size = rawSize;
            std::memcpy (pkt.data, msg.getRawData(), static_cast<size_t> (rawSize));
        }
        else if (scope.blockSize2 > 0)
        {
            auto& pkt = midiRingBuffer[static_cast<size_t> (scope.startIndex2)];
            pkt.size = rawSize;
            std::memcpy (pkt.data, msg.getRawData(), static_cast<size_t> (rawSize));
        }
    }

    void clearMidiQueue() noexcept
    {
        midiFifo.reset();
    }

    // Callback invoked after restoring DAW session state (setStateInformation)
    // Used by PluginEditor to refresh the WebUI when a project is loaded
    // Arguments: bankIdx (0-7, or -1 if none), progIdx (0-127, or -1 if none)
    std::function<void(int, int)> onStateRestored;

private:
    struct QueuedMidiPacket
    {
        static constexpr int kMaxBytes = 320; // Soporta notas/CC (3B) y dumps SysEx DeepMind (291B)
        int size = 0;
        uint8_t data[kMaxBytes] {};
    };

    static constexpr int kMidiQueueCapacity = 256;
    juce::AbstractFifo midiFifo { kMidiQueueCapacity };
    std::array<QueuedMidiPacket, kMidiQueueCapacity> midiRingBuffer {};

    juce::UndoManager undoManager;
    juce::AudioProcessorValueTreeState apvts;
    mutable juce::CriticalSection midiLearnLock;
    juce::String midiLearnJson = "{}";
    ABD::SynthEngine synthEngine;
    AudioABRecorder audioABRecorder;
    ABD::PatchController patchController;
    std::unique_ptr<ABDShared::AutoUpdater> autoUpdater;
    juce::String currentPresetName = "Default";
    bool isPrepared = false;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (ABDEepAudioProcessor)
};
