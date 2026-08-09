/**
 * @purpose SysEx operations for AudioAB Validation: file loading, test preset generation,
 * hardware pull, and MIDI transmission with overwrite confirmation.
 */
#include "AudioABValidationViewComponent.h"
#include "Core/MidiTranslationEngine.h"

void AudioABValidationViewComponent::chooseSysExFile()
{
    juce::File currentFile(__FILE__);
    juce::File defaultDir = currentFile.getParentDirectory().getParentDirectory()
        .getParentDirectory().getChildFile("resources").getChildFile("banks");

    fileChooser = std::make_unique<juce::FileChooser>(
        "Select Test Preset SysEx file",
        defaultDir.exists() ? defaultDir : juce::File::getSpecialLocation(juce::File::userHomeDirectory),
        "*.syx");

    fileChooser->launchAsync(juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
        [this](const juce::FileChooser& chooser)
        {
            auto file = chooser.getResult();
            if (!file.existsAsFile())
                return;

            juce::MemoryBlock mb;
            if (!file.loadFileAsData(mb))
            {
                testPatchLabel.setText("ERROR: Could not load SysEx file.", juce::dontSendNotification);
                runAutomatedButton.setEnabled(false);
                return;
            }

            const uint8_t* rawData = static_cast<const uint8_t*>(mb.getData());
            size_t size = mb.getSize();

            if (size <= 8 || rawData[0] != 0xF0)
            {
                testPatchLabel.setText("ERROR: Invalid or corrupt SysEx file.", juce::dontSendNotification);
                runAutomatedButton.setEnabled(false);
                testPatchLoaded = false;
                return;
            }

            auto unpacked = MidiTranslationEngine::unpackDeepMindSysEx(rawData + 8, size - 8);
            if (unpacked.getSize() < 242)
            {
                testPatchLabel.setText("ERROR: Invalid or corrupt SysEx file.", juce::dontSendNotification);
                runAutomatedButton.setEnabled(false);
                testPatchLoaded = false;
                return;
            }

            unpacked.copyTo(testPatchBytes.data(), 0, 242);
            testSysExFile = file;
            testPatchLoaded = true;

            char nameBuf[17];
            std::memcpy(nameBuf, testPatchBytes.data() + 224, 16);
            nameBuf[16] = '\0';
            juce::String patchName(nameBuf);
            patchName = patchName.trim();

            testPatchLabel.setText("Selected Test Patch: [" + patchName + "] (File: " + file.getFileName() + ")", juce::dontSendNotification);
            runAutomatedButton.setEnabled(true);
            addLog("Patch loaded successfully for testing.");
            addLog("Name: " + patchName);
            addLog("Source: " + file.getFullPathName());

            std::vector<uint8_t> syxVec(rawData, rawData + size);
            sendSysExToHardware(syxVec, patchName);
        });
}

void AudioABValidationViewComponent::generateTestSysEx()
{
    // Build basic raw preset (242 bytes unpacked)
    std::array<uint8_t, 242> rawBytes;
    std::fill(rawBytes.begin(), rawBytes.end(), 0);

    rawBytes[0] = 1;     // DCO1 Saw
    rawBytes[1] = 0;     // DCO1 Square (Off)
    rawBytes[3] = 255;   // DCO1 LFO depth
    rawBytes[4] = 0;     // DCO1 Env depth
    rawBytes[8] = 255;   // VCF Cutoff (fully open)
    rawBytes[9] = 0;     // VCF Resonance (no self-oscillation)
    rawBytes[18] = 0;    // Attack (instant)
    rawBytes[19] = 0;    // Decay
    rawBytes[20] = 255;  // Sustain (max)
    rawBytes[21] = 120;  // Release

    juce::String nameStr = "CALIB_TEST_RAW";
    for (int i = 0; i < 16; ++i)
        rawBytes[224 + i] = (i < nameStr.length()) ? static_cast<uint8_t>(nameStr[i]) : ' ';

    // Pack 242 raw bytes to 7-bit SysEx payload
    auto packBlock = [](const uint8_t* src, int count, std::vector<uint8_t>& dest)
    {
        uint8_t msbByte = 0;
        std::vector<uint8_t> low7Bytes;
        for (int j = 0; j < count; ++j)
        {
            uint8_t b = src[j];
            msbByte |= ((b >> 7) & 0x01) << j;
            low7Bytes.push_back(b & 0x7F);
        }
        dest.push_back(msbByte & 0x7F);
        dest.insert(dest.end(), low7Bytes.begin(), low7Bytes.end());
    };

    std::vector<uint8_t> packedPayload;
    for (size_t i = 0; i < 238; i += 7)
        packBlock(rawBytes.data() + i, 7, packedPayload);
    packBlock(rawBytes.data() + 238, 4, packedPayload);

    // Build full SysEx with DeepMind header
    std::vector<uint8_t> syxData;
    syxData.push_back(0xF0); // Start of SysEx
    syxData.push_back(0x00); syxData.push_back(0x20); syxData.push_back(0x32); // Behringer
    syxData.push_back(0x20); // DeepMind model
    syxData.push_back(0x00); // Device ID
    syxData.push_back(0x02); // Edit Buffer Dump
    syxData.push_back(0x00); // Subtype
    syxData.insert(syxData.end(), packedPayload.begin(), packedPayload.end());
    syxData.push_back(0xF7);

    // Save dialog
    fileChooser = std::make_unique<juce::FileChooser>(
        "Save Generated Test Preset",
        juce::File::getSpecialLocation(juce::File::userDocumentsDirectory).getChildFile("ABDEep"),
        "*.syx");

    fileChooser->launchAsync(juce::FileBrowserComponent::saveMode | juce::FileBrowserComponent::canSelectFiles,
        [this, rawBytes, syxData](const juce::FileChooser& chooser) mutable
        {
            auto file = chooser.getResult();
            if (file == juce::File()) return;
            if (file.getFileExtension() != ".syx")
                file = file.withFileExtension(".syx");
            if (!file.getParentDirectory().exists())
                file.getParentDirectory().createDirectory();

            juce::MemoryBlock mb(syxData.data(), syxData.size());
            if (!file.replaceWithData(mb.getData(), mb.getSize()))
                return;

            std::copy(rawBytes.begin(), rawBytes.end(), testPatchBytes.begin());
            testSysExFile = file;
            testPatchLoaded = true;

            testPatchLabel.setText("Selected Test Patch: [CALIB_TEST_RAW] (File: " + file.getFileName() + ")", juce::dontSendNotification);
            runAutomatedButton.setEnabled(true);
            addLog("Basic preset generated and loaded successfully.");
            addLog("Name: CALIB_TEST_RAW");
            addLog("Path: " + file.getFullPathName());
            sendSysExToHardware(syxData, "CALIB_TEST_RAW");
        });
}

void AudioABValidationViewComponent::pullSysExFromHardware()
{
    auto* activeMidiOutput = (deviceManager != nullptr) ? deviceManager->getDefaultMidiOutput() : nullptr;
    if (activeMidiOutput == nullptr)
    {
        juce::AlertWindow::showMessageBoxAsync(juce::AlertWindow::WarningIcon, "MIDI Error",
            "No active MIDI Output port selected in settings.", "OK");
        return;
    }

    addLog("Requesting Edit Buffer Dump from hardware...");
    {
        const juce::ScopedLock sl(midiLock);
        sysExReceived = false;
    }

    auto dumpRequest = MidiTranslationEngine::createEditBufferDumpRequest();
    activeMidiOutput->sendMessageNow(dumpRequest);

    for (int i = 0; i < 50; ++i)
    {
        juce::Thread::sleep(10);
        bool received = false;
        juce::MidiMessage msg;
        {
            const juce::ScopedLock sl(midiLock);
            received = sysExReceived;
            msg = lastReceivedSysEx;
        }
        if (!received) continue;

        const uint8_t* rawData = msg.getSysExData();
        size_t size = (size_t)msg.getSysExDataSize();
        if (size > 8)
        {
            auto unpacked = MidiTranslationEngine::unpackDeepMindSysEx(rawData + 7, size - 8);
            if (unpacked.getSize() >= 242)
            {
                unpacked.copyTo(testPatchBytes.data(), 0, 242);
                testPatchLoaded = true;

                char nameBuf[17];
                std::memcpy(nameBuf, testPatchBytes.data() + 224, 16);
                nameBuf[16] = '\0';
                juce::String patchName(nameBuf);
                patchName = patchName.trim();

                testPatchLabel.setText("Selected Test Patch: [" + patchName + "] (Pulled from Hardware)", juce::dontSendNotification);
                runAutomatedButton.setEnabled(true);
                addLog("Preset retrieved from hardware.");
                addLog("Name: " + patchName);
                return;
            }
        }
    }

    juce::AlertWindow::showMessageBoxAsync(juce::AlertWindow::WarningIcon, "MIDI Timeout",
        "Hardware did not respond to Dump request. Check MIDI connections.", "OK");
}

void AudioABValidationViewComponent::sendSysExToHardware(const std::vector<uint8_t>& syxData, const juce::String& newPatchName)
{
    auto* activeMidiOutput = (deviceManager != nullptr) ? deviceManager->getDefaultMidiOutput() : nullptr;
    if (activeMidiOutput == nullptr)
        return;

    // Read current patch name from hardware for warning
    {
        const juce::ScopedLock sl(midiLock);
        sysExReceived = false;
    }

    auto dumpRequest = MidiTranslationEngine::createEditBufferDumpRequest();
    activeMidiOutput->sendMessageNow(dumpRequest);

    juce::String currentHardwarePatchName = "Active Edit Buffer";
    for (int i = 0; i < 25; ++i)
    {
        juce::Thread::sleep(10);
        bool received = false;
        juce::MidiMessage msg;
        {
            const juce::ScopedLock sl(midiLock);
            received = sysExReceived;
            msg = lastReceivedSysEx;
        }
        if (!received) continue;

        size_t size = (size_t)msg.getSysExDataSize();
        if (size > 8)
        {
            auto unpacked = MidiTranslationEngine::unpackDeepMindSysEx(msg.getSysExData() + 7, size - 8);
            if (unpacked.getSize() >= 242)
            {
                char nameBuf[17];
                std::memcpy(nameBuf, static_cast<const uint8_t*>(unpacked.getData()) + 224, 16);
                nameBuf[16] = '\0';
                currentHardwarePatchName = juce::String(nameBuf).trim();
                break;
            }
        }
    }

    // Confirmation dialog before overwriting
    juce::AlertWindow::showOkCancelBox(juce::AlertWindow::QuestionIcon,
        "Overwrite Hardware Preset",
        "You are about to overwrite the preset '" + currentHardwarePatchName
        + "' currently loaded on your synth with test preset '" + newPatchName + "'.\n\nProceed with MIDI transmission?",
        "Transmit preset", "Cancel", nullptr,
        juce::ModalCallbackFunction::create([this, activeMidiOutput, syxData, newPatchName](int result)
        {
            if (result != 0)
            {
                juce::MidiMessage msg(syxData.data(), (int)syxData.size());
                activeMidiOutput->sendMessageNow(msg);
                addLog("Preset '" + newPatchName + "' transmitted via MIDI successfully.");
            }
            else
            {
                addLog("MIDI transmission cancelled. Hardware may be out of sync.");
            }
        }));
}
