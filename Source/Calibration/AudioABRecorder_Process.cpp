/**
 * @purpose Audio A/B recording kernel: hardware input capture and software synth rendering.
 * Extracted from AudioABRecorder.cpp to separate streaming/recording from lifecycle/IO.
 */
#include "AudioABRecorder.h"

void AudioABRecorder::processHardwareInput(const juce::AudioBuffer<float>& inputBuffer, int numSamples)
{
    if (!running)
        return;

    int totalSamples = hardwareBuffer.getNumSamples();
    int samplesToCopy = std::min(numSamples, totalSamples - hardwareWritePos);

    if (samplesToCopy > 0)
    {
        for (int ch = 0; ch < currentConfig.numChannels; ++ch)
        {
            int srcCh = ch % inputBuffer.getNumChannels();
            hardwareBuffer.copyFrom(ch, hardwareWritePos, inputBuffer, srcCh, 0, samplesToCopy);
        }
        hardwareWritePos += samplesToCopy;
    }
}

bool AudioABRecorder::renderSoftwareReference(ABD::SynthEngine& engine)
{
    if (!running)
        return false;

    int totalSamples = softwareBuffer.getNumSamples();

    // Build MIDI buffer for the note
    juce::MidiBuffer midiEvents;
    midiEvents.addEvent(juce::MidiMessage::noteOn(1, currentConfig.midiNote, (juce::uint8)currentConfig.velocity), 0);

    int noteOffSample = (int)(currentConfig.noteDurationSec * currentConfig.sampleRate);
    if (noteOffSample < totalSamples)
    {
        midiEvents.addEvent(juce::MidiMessage::noteOff(1, currentConfig.midiNote), noteOffSample);
    }

    // Render in blocks onto the software engine
    int blockSize = 512;
    int processedSamples = 0;

    juce::AudioBuffer<float> tempBlockBuffer(currentConfig.numChannels, blockSize);

    while (processedSamples < totalSamples)
    {
        int chunk = std::min(blockSize, totalSamples - processedSamples);
        tempBlockBuffer.setSize(currentConfig.numChannels, chunk, false, true, true);
        tempBlockBuffer.clear();

        // Extract MIDI events for this sample range
        juce::MidiBuffer blockMidi;
        int nextEventSample;
        juce::MidiBuffer::Iterator it(midiEvents);
        it.setNextSamplePosition(processedSamples);

        juce::MidiMessage m;
        while (it.getNextEvent(m, nextEventSample))
        {
            if (nextEventSample >= processedSamples + chunk)
                break;
            blockMidi.addEvent(m, nextEventSample - processedSamples);
        }

        // Render block through engine
        engine.processBlock(tempBlockBuffer, blockMidi);

        // Accumulate into software buffer
        for (int ch = 0; ch < currentConfig.numChannels; ++ch)
        {
            softwareBuffer.copyFrom(ch, processedSamples, tempBlockBuffer, ch, 0, chunk);
        }

        processedSamples += chunk;
    }

    return true;
}
