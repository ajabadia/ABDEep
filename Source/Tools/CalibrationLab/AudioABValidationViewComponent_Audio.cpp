/**
 * @purpose Audio I/O callbacks, MIDI handling, automated test cycle,
 * and local software reference rendering for AudioAB Validation.
 */
#include "AudioABValidationViewComponent.h"
#include "DSP/SynthEngine.h"
#include "Core/PatchDiffTypes.h"
#include "Core/MidiTranslationEngine.h"

void AudioABValidationViewComponent::handleIncomingMidiMessage(juce::MidiInput* /*source*/, const juce::MidiMessage& message)
{
    if (message.isSysEx())
    {
        const juce::ScopedLock sl(midiLock);
        sysExReceived = true;
        lastReceivedSysEx = message;
    }
}

void AudioABValidationViewComponent::audioDeviceAboutToStart(juce::AudioIODevice* device)
{
    if (device != nullptr)
        currentSampleRate = device->getCurrentSampleRate();
}

void AudioABValidationViewComponent::audioDeviceStopped()
{
}

void AudioABValidationViewComponent::audioDeviceIOCallbackWithContext(
    const float* const* inputChannelData, int numInputChannels,
    float* const* /*outputChannelData*/, int /*numOutputChannels*/,
    int numSamples, const juce::AudioIODeviceCallbackContext& /*context*/)
{
    if (!isRecording || numInputChannels <= 0 || inputChannelData == nullptr)
        return;

    int samplesToCopy = std::min(numSamples, maxRecordingSamples - samplesRecorded);
    if (samplesToCopy <= 0)
        return;

    recordedBuffer.copyFrom(0, samplesRecorded, inputChannelData[0], samplesToCopy);

    if (numInputChannels > 1 && inputChannelData[1] != nullptr && recordedBuffer.getNumChannels() > 1)
        recordedBuffer.copyFrom(1, samplesRecorded, inputChannelData[1], samplesToCopy);
    else if (recordedBuffer.getNumChannels() > 1)
        recordedBuffer.copyFrom(1, samplesRecorded, inputChannelData[0], samplesToCopy);

    samplesRecorded += samplesToCopy;

    if (samplesRecorded >= maxRecordingSamples)
    {
        isRecording = false;
        juce::MessageManager::callAsync([this] { stopRecordingAndCompare(); });
    }
}

void AudioABValidationViewComponent::startAutomatedTest()
{
    consoleLog.clear();
    addLog("=== STARTING AUTOMATED TEST CYCLE ===");

    if (deviceManager == nullptr)
    {
        addLog("ERROR: DeviceManager not available.");
        return;
    }

    auto* activeMidiOutput = deviceManager->getDefaultMidiOutput();
    if (activeMidiOutput == nullptr)
    {
        addLog("ERROR: Select an active MIDI output port in Settings.");
        return;
    }

    // 1. Initial handshake
    addLog("Verifying target hardware...");
    {
        const juce::ScopedLock sl(midiLock);
        sysExReceived = false;
    }

    juce::MidiMessage dumpRequest = MidiTranslationEngine::createEditBufferDumpRequest();
    activeMidiOutput->sendMessageNow(dumpRequest);

    int waitMs = 0;
    bool success = false;
    while (waitMs < 1500)
    {
        juce::Thread::sleep(50);
        waitMs += 50;
        const juce::ScopedLock sl(midiLock);
        if (sysExReceived)
        {
            success = true;
            addLog("  -> MIDI connection validated. Hardware parameters ready.");
            break;
        }
    }

    if (!success)
    {
        addLog("ERROR: Hardware did not respond to MIDI handshake. Operation cancelled.");
        return;
    }

    // Step 1: Validate Parameter Contract
    addLog("Validating parameter match (Step 1: Patch Contract)...");

    juce::MidiMessage rxSysEx;
    {
        const juce::ScopedLock sl(midiLock);
        rxSysEx = lastReceivedSysEx;
    }

    const uint8_t* rawData = rxSysEx.getSysExData();
    int dataSize = rxSysEx.getSysExDataSize();

    if (dataSize > 7)
    {
        // getSysExData() excluye F0/F7. Respuesta edit buffer (cmd 0x04): cabecera
        // física de 8 bytes -> payload en offset +7; program dump (cmd 0x02):
        // cabecera física de 10 bytes -> payload en offset +9.
        const int headerLen = (dataSize > 6 && rawData[5] == 0x02) ? 9 : 7;
        auto hardwareUnpacked = MidiTranslationEngine::unpackDeepMindSysEx(rawData + headerLen, dataSize - headerLen);

        std::array<uint8_t, 242> dspParams;
        std::array<uint8_t, 242> hardwareParams;
        std::fill(dspParams.begin(), dspParams.end(), 0);
        std::fill(hardwareParams.begin(), hardwareParams.end(), 0);

        if (hardwareUnpacked.getSize() >= 242)
        {
            hardwareUnpacked.copyTo(hardwareParams.data(), 0, 242);
            dspParams = testPatchBytes;

            auto diffReport = PatchDiffEngine::diffSemanticParams(dspParams, hardwareParams);

            if (!diffReport.semanticDiffs.empty())
            {
                addLog("ERROR: Parameter discrepancies detected between hardware and test patch.");
                addLog("Load the same SysEx patch on your synthesizer before continuing:");
                for (const auto& diff : diffReport.semanticDiffs)
                    addLog("  * " + diff.paramId + " - Expected: " + diff.semanticValA + " | HW: " + diff.semanticValB);
                return;
            }
            else
            {
                addLog("  -> Parameter contract validated [OK]. No differences found.");
            }
        }
    }

    // 2. Prepare recording buffer (2.5 seconds total)
    currentSampleRate = (deviceManager->getCurrentAudioDevice() != nullptr)
        ? deviceManager->getCurrentAudioDevice()->getCurrentSampleRate()
        : 44100.0;

    maxRecordingSamples = (int)(currentSampleRate * 2.5);
    samplesRecorded = 0;
    recordedBuffer.setSize(2, maxRecordingSamples);
    recordedBuffer.clear();

    addLog("Starting physical audio capture at " + juce::String(currentSampleRate, 1) + " Hz...");
    isRecording = true;

    // 3. Send MIDI note-on to hardware
    auto noteOn = juce::MidiMessage::noteOn(1, 60, (juce::uint8)100);
    activeMidiOutput->sendMessageNow(noteOn);
}

void AudioABValidationViewComponent::renderLocalSoftwareReference()
{
    addLog("Rendering local SynthEngine software reference...");

    juce::File outputDir = juce::File::getSpecialLocation(juce::File::userDocumentsDirectory)
        .getChildFile("ABDEep_CalibrationRuns");
    outputDir.createDirectory();

    refFile = outputDir.getChildFile("standalone_reference.wav");
    capFile = outputDir.getChildFile("standalone_capture.wav");
    refFileLabel.setText(refFile.getFileName(), juce::dontSendNotification);
    capFileLabel.setText(capFile.getFileName(), juce::dontSendNotification);

    ABD::SynthEngine localEngine;
    localEngine.prepare(currentSampleRate, 512);

    auto calib = ABD::SynthEngine::getFactoryDefaults();
    calib.transfer.lfo.rateScale = 0.041f * calibrationFactor;
    localEngine.loadCalibrationFromJson(calib.toXml());

    juce::AudioBuffer<float> renderBuf(2, maxRecordingSamples);
    renderBuf.clear();

    juce::MidiBuffer midi;
    midi.addEvent(juce::MidiMessage::noteOn(1, 60, 0.8f), 0);
    midi.addEvent(juce::MidiMessage::noteOff(1, 60, 0.0f), (int)(currentSampleRate * 2.0));

    int blockSize = 512;
    int writePos = 0;
    while (writePos < maxRecordingSamples)
    {
        int toProcess = std::min(blockSize, maxRecordingSamples - writePos);
        juce::AudioBuffer<float> block(2, toProcess);
        block.clear();

        juce::MidiBuffer blockMidi;
        for (const auto meta : midi)
        {
            if (meta.samplePosition >= writePos && meta.samplePosition < writePos + toProcess)
                blockMidi.addEvent(meta.getMessage(), meta.samplePosition - writePos);
        }

        localEngine.processBlock(block, blockMidi);
        renderBuf.copyFrom(0, writePos, block, 0, 0, toProcess);
        renderBuf.copyFrom(1, writePos, block, 1, 0, toProcess);
        writePos += toProcess;
    }

    juce::WavAudioFormat wavFormat;
    if (auto writer = std::unique_ptr<juce::AudioFormatWriter>(
            wavFormat.createWriterFor(new juce::FileOutputStream(refFile), currentSampleRate, 2, 24, {}, 0)))
    {
        writer->writeFromAudioSampleBuffer(renderBuf, 0, maxRecordingSamples);
    }
}

void AudioABValidationViewComponent::stopRecordingAndCompare()
{
    addLog("Recording complete. Turning off hardware note...");

    if (deviceManager != nullptr)
    {
        if (auto* activeMidiOutput = deviceManager->getDefaultMidiOutput())
        {
            auto noteOff = juce::MidiMessage::noteOff(1, 60);
            activeMidiOutput->sendMessageNow(noteOff);
        }
    }

    // Write capture WAV
    juce::WavAudioFormat wavFormat;
    if (auto writer = std::unique_ptr<juce::AudioFormatWriter>(
            wavFormat.createWriterFor(new juce::FileOutputStream(capFile), currentSampleRate, 2, 24, {}, 0)))
    {
        writer->writeFromAudioSampleBuffer(recordedBuffer, 0, maxRecordingSamples);
    }

    renderLocalSoftwareReference();
    runAcousticalComparison();
}
