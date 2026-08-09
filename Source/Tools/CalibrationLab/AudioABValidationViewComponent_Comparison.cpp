/**
 * @purpose Audio A/B file selection, acoustical comparison, calibration slider,
 * and visual comparison viewer for AudioAB Validation.
 */
#include "AudioABValidationViewComponent.h"
#include "Calibration/AudioABComparator.h"
#include "Calibration/AudioABVerdictEngine.h"
#include "AudioABVisualizerComponent.h"
#include "Core/MidiTranslationEngine.h"

void AudioABValidationViewComponent::chooseReferenceFile()
{
    fileChooser = std::make_unique<juce::FileChooser>(
        "Select Reference WAV file",
        juce::File::getSpecialLocation(juce::File::userHomeDirectory),
        "*.wav");

    fileChooser->launchAsync(juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
        [this](const juce::FileChooser& chooser)
        {
            auto file = chooser.getResult();
            if (!file.existsAsFile()) return;
            refFile = file;
            refFileLabel.setText(refFile.getFileName(), juce::dontSendNotification);
            compareButton.setEnabled(refFile.existsAsFile() && capFile.existsAsFile());
        });
}

void AudioABValidationViewComponent::chooseCaptureFile()
{
    fileChooser = std::make_unique<juce::FileChooser>(
        "Select Capture WAV file",
        juce::File::getSpecialLocation(juce::File::userHomeDirectory),
        "*.wav");

    fileChooser->launchAsync(juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
        [this](const juce::FileChooser& chooser)
        {
            auto file = chooser.getResult();
            if (!file.existsAsFile()) return;
            capFile = file;
            capFileLabel.setText(capFile.getFileName(), juce::dontSendNotification);
            compareButton.setEnabled(refFile.existsAsFile() && capFile.existsAsFile());
        });
}

void AudioABValidationViewComponent::runAcousticalComparison()
{
    consoleLog.clear();
    addLog("Starting native acoustical validation (Phase 5D)...");

    // 1. Validate physical hardware connection via SysEx handshake
    bool midiVerificationSuccess = false;
    if (deviceManager != nullptr)
    {
        auto* activeMidiOutput = deviceManager->getDefaultMidiOutput();
        if (activeMidiOutput != nullptr)
        {
            addLog("Verifying MIDI hardware connection...");
            {
                const juce::ScopedLock sl(midiLock);
                sysExReceived = false;
            }

            juce::MidiMessage dumpRequest = MidiTranslationEngine::createEditBufferDumpRequest();
            activeMidiOutput->sendMessageNow(dumpRequest);

            int waitMs = 0;
            while (waitMs < 1500)
            {
                juce::Thread::sleep(50);
                waitMs += 50;
                const juce::ScopedLock sl(midiLock);
                if (sysExReceived)
                {
                    midiVerificationSuccess = true;
                    addLog("  -> MIDI connection established. Hardware responsive.");
                    break;
                }
            }

            if (!midiVerificationSuccess)
            {
                addLog("ERROR: Hardware did not respond to dump request (MIDI timeout 1500ms).");
                addLog("Ensure the synthesizer is powered on and connected.");
                return;
            }
        }
        else
        {
            addLog("WARNING: No active MIDI output port configured.");
            addLog("Proceeding with offline acoustical comparison, skipping hardware validation.");
        }
    }

    addLog("Reference: " + refFile.getFullPathName());
    addLog("Capture: " + capFile.getFullPathName());

    juce::AudioFormatManager formatManager;
    formatManager.registerBasicFormats();

    std::unique_ptr<juce::AudioFormatReader> refReader(formatManager.createReaderFor(refFile));
    std::unique_ptr<juce::AudioFormatReader> capReader(formatManager.createReaderFor(capFile));

    if (refReader == nullptr || capReader == nullptr)
    {
        addLog("ERROR: Could not decode WAV files.");
        return;
    }

    AudioABSignal refSignal;
    refSignal.sourceId = "reference";
    refSignal.sampleRate = refReader->sampleRate;
    refSignal.numChannels = (int)refReader->numChannels;
    refSignal.originalNumSamples = refReader->lengthInSamples;
    refSignal.filePath = refFile.getFullPathName();
    refSignal.buffer.setSize(refSignal.numChannels, (int)refSignal.originalNumSamples);
    refReader->read(&refSignal.buffer, 0, (int)refSignal.originalNumSamples, 0, true, true);

    AudioABSignal capSignal;
    capSignal.sourceId = "capture";
    capSignal.sampleRate = capReader->sampleRate;
    capSignal.numChannels = (int)capReader->numChannels;
    capSignal.originalNumSamples = capReader->lengthInSamples;
    capSignal.filePath = capFile.getFullPathName();
    capSignal.buffer.setSize(capSignal.numChannels, (int)capSignal.originalNumSamples);
    capReader->read(&capSignal.buffer, 0, (int)capSignal.originalNumSamples, 0, true, true);

    AudioABRunContext context;
    context.runId = "standalone-diagnostic-" + juce::String(juce::Time::currentTimeMillis());

    AudioABComparatorConfig config;
    config.trimLeadingSilence = trimSilenceToggle.getToggleState();
    config.trimTrailingSilence = trimSilenceToggle.getToggleState();
    config.normalizeGain = normalizeGainToggle.getToggleState();
    config.forceMonoForAnalysis = true;
    config.enableCrossCorrelation = true;

    refAudioBuffer = refSignal.buffer;
    capAudioBuffer = capSignal.buffer;
    showVisualizerButton.setEnabled(true);

    AudioABComparator comparator;
    auto result = comparator.compare(refSignal, capSignal, context, config);

    AudioABVerdictEngine verdictEngine;
    AudioABVerdictTolerances tolerances;
    auto verdict = verdictEngine.evaluate(result, tolerances, testPatchBytes);

    addLog("---------------------------------------------------------");
    addLog("COMPARISON RESULT:");
    addLog("  Status: " + result.status);
    addLog("  Reason Code: " + result.reasonCode);
    addLog("---------------------------------------------------------");

    if (result.status == "error")
    {
        addLog("VERDICT: [FAIL] - Contractual failure.");
        for (const auto& err : result.errors)
            addLog("  * Error: " + err);
        return;
    }

    addLog("ACOUSTICAL VERDICT: [" + verdict.level.toUpperCase() + "]");
    addLog("  Reason Code: " + verdict.reasonCode);
    if (!verdict.triggeredRules.isEmpty())
    {
        addLog("  Broken rules:");
        for (const auto& rule : verdict.triggeredRules)
            addLog("    * " + rule);
    }

    addLog("---------------------------------------------------------");
    addLog("TEMPORAL METRICS:");
    addLog("  Peak Delta: " + juce::String(result.time.peakDeltaDb, 2) + " dB");
    addLog("  RMS Delta: " + juce::String(result.time.rmsDeltaDb, 2) + " dB");
    addLog("  RMSE: " + juce::String(result.time.rmse, 5));
    addLog("  Residual RMS: " + juce::String(result.time.residualRmsDbfs, 1) + " dBFS");
    addLog("PHASE ALIGNMENT:");
    addLog("  Sample Offset: " + juce::String(result.alignment.sampleOffset) + " samples");
    addLog("  Time Offset: " + juce::String(result.alignment.timeOffsetMs, 2) + " ms");
    addLog("  Correlation Peak: " + juce::String(result.alignment.correlationPeak, 4));
    addLog("SPECTRAL DIFFERENCES (STFT):");
    addLog("  Log Mag Mean Abs Diff: " + juce::String(result.spectral.logMagMeanAbsDiffDb, 2) + " dB");
    addLog("  Low Band: " + juce::String(result.spectral.lowBandDeltaDb, 2) + " dB");
    addLog("  Mid Band: " + juce::String(result.spectral.midBandDeltaDb, 2) + " dB");
    addLog("  High Band: " + juce::String(result.spectral.highBandDeltaDb, 2) + " dB");
}

void AudioABValidationViewComponent::sliderValueChanged(juce::Slider* slider)
{
    if (slider == &calibrationSlider)
    {
        calibrationFactor = (float)calibrationSlider.getValue();
        addLog("LFO calibration factor adjusted to: " + juce::String(calibrationFactor, 2) + "x");

        if (refFile.existsAsFile() && capFile.existsAsFile())
        {
            renderLocalSoftwareReference();
            runAcousticalComparison();
        }
    }
}

void AudioABValidationViewComponent::showVisualizer()
{
    auto* window = new AudioABVisualizerWindow(refAudioBuffer, capAudioBuffer);
    juce::ignoreUnused(window);
}
