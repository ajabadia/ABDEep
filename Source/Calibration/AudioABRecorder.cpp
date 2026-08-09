/**
 * @purpose Audio A/B Recorder: lifecycle, file I/O, analysis, and manifest writing.
 * Audio streaming methods (processHardwareInput, renderSoftwareReference) are
 * in AudioABRecorder_Process.cpp.
 */
#include "AudioABRecorder.h"

AudioABRecorder::AudioABRecorder() {}
AudioABRecorder::~AudioABRecorder() {}

void AudioABRecorder::prepare(double sampleRate_, int maxBlockSize_,
                               int numInputChannels_, int numOutputChannels_)
{
    (void)maxBlockSize_;
    (void)numOutputChannels_;
    sampleRate = sampleRate_;
    maxBlockSize = maxBlockSize_;
    numInputChannels = numInputChannels_;
    numOutputChannels = numOutputChannels_;
}

void AudioABRecorder::setOutputRoot(const juce::File& rootDir)
{
    outputRoot = rootDir;
}

bool AudioABRecorder::beginRun(const AudioABRunConfig& config, const juce::String& snapshotJson)
{
    if (running)
        return false;

    currentConfig = config;
    patchSnapshotJson = snapshotJson;
    startedAt = juce::Time::getCurrentTime();

    if (!outputRoot.exists())
        outputRoot.createDirectory();

    currentRunDir = outputRoot.getChildFile(currentConfig.runId);
    if (!currentRunDir.exists())
        currentRunDir.createDirectory();

    double totalDuration = currentConfig.noteDurationSec + currentConfig.tailDurationSec;
    int totalSamples = (int)(totalDuration * currentConfig.sampleRate);

    hardwareBuffer.setSize(currentConfig.numChannels, totalSamples);
    hardwareBuffer.clear();
    hardwareWritePos = 0;

    softwareBuffer.setSize(currentConfig.numChannels, totalSamples);
    softwareBuffer.clear();

    running = true;
    return true;
}

bool AudioABRecorder::finishRun(AudioABRunResult& result)
{
    if (!running)
        return false;

    running = false;

    juce::File hwWavFile = currentRunDir.getChildFile("hardware.wav");
    juce::File swWavFile = currentRunDir.getChildFile("software.wav");

    bool hwWriteOk = writeWav(hwWavFile, hardwareBuffer, currentConfig.sampleRate, currentConfig.bitDepth);
    bool swWriteOk = writeWav(swWavFile, softwareBuffer, currentConfig.sampleRate, currentConfig.bitDepth);

    if (!hwWriteOk || !swWriteOk)
    {
        result.ok = false;
        result.error = "Error writing WAV files.";
        return false;
    }

    result.runId = currentConfig.runId;
    result.patchName = currentConfig.patchName;
    result.startedAt = startedAt;
    result.outputDir = currentRunDir;
    result.hardwareTake = buildTakeInfo("hardware", hwWavFile, hardwareBuffer, currentConfig.sampleRate);
    result.softwareTake = buildTakeInfo("software", swWavFile, softwareBuffer, currentConfig.sampleRate);
    result.manifestFile = currentRunDir.getChildFile("audio_ab_manifest.json");

    if (!writeManifest(result, patchSnapshotJson))
    {
        result.ok = false;
        result.error = "Error writing manifest.json.";
        return false;
    }

    result.ok = true;
    return true;
}

void AudioABRecorder::abortRun()
{
    running = false;
}

bool AudioABRecorder::isRunning() const noexcept
{
    return running;
}

// ---- File I/O and analysis helpers ----

bool AudioABRecorder::writeWav(const juce::File& file, const juce::AudioBuffer<float>& buffer,
                                double sampleRate, int bitDepth)
{
    file.deleteFile();

    std::unique_ptr<juce::FileOutputStream> fileStream(file.createOutputStream());
    if (fileStream == nullptr)
        return false;

    juce::WavAudioFormat wavFormat;
    std::unique_ptr<juce::AudioFormatWriter> writer(wavFormat.createWriterFor(
        fileStream.get(), sampleRate, buffer.getNumChannels(), bitDepth, {}, 0
    ));

    if (writer == nullptr)
        return false;

    fileStream.release(); // writer now owns the stream
    return writer->writeFromAudioSampleBuffer(buffer, 0, buffer.getNumSamples());
}

AudioABTakeInfo AudioABRecorder::buildTakeInfo(const juce::String& kind,
                                                const juce::File& wavFile,
                                                const juce::AudioBuffer<float>& buffer,
                                                double sampleRate) const
{
    AudioABTakeInfo info;
    info.kind = kind;
    info.wavFile = wavFile;
    info.numSamples = buffer.getNumSamples();
    info.sampleRate = sampleRate;
    info.numChannels = buffer.getNumChannels();
    info.durationSec = (double)info.numSamples / sampleRate;

    // Compute peak and RMS across all channels
    float peak = 0.0f;
    double sumSquares = 0.0;

    for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
    {
        float p = buffer.getMagnitude(ch, 0, buffer.getNumSamples());
        if (p > peak)
            peak = p;

        const float* readPtr = buffer.getReadPointer(ch);
        for (int i = 0; i < buffer.getNumSamples(); ++i)
            sumSquares += readPtr[i] * readPtr[i];
    }

    double rms = std::sqrt(sumSquares / (buffer.getNumSamples() * buffer.getNumChannels()));
    info.peakDbfs = juce::Decibels::gainToDecibels(peak);
    info.rmsDbfs = juce::Decibels::gainToDecibels((float)rms);

    return info;
}

bool AudioABRecorder::writeManifest(const AudioABRunResult& result, const juce::String& snapshotJson) const
{
    juce::DynamicObject::Ptr root = new juce::DynamicObject();
    root->setProperty("schema_version", "1.0.0");
    root->setProperty("run_id", result.runId);
    root->setProperty("patch_name", result.patchName);
    root->setProperty("started_at_utc", result.startedAt.toString(true, true));

    juce::DynamicObject::Ptr engine = new juce::DynamicObject();
    engine->setProperty("sample_rate", currentConfig.sampleRate);
    engine->setProperty("bit_depth", currentConfig.bitDepth);
    engine->setProperty("channels", currentConfig.numChannels);
    engine->setProperty("note", currentConfig.midiNote);
    engine->setProperty("velocity", currentConfig.velocity);
    engine->setProperty("note_duration_sec", currentConfig.noteDurationSec);
    engine->setProperty("tail_duration_sec", currentConfig.tailDurationSec);
    root->setProperty("engine", engine.get());

    juce::DynamicObject::Ptr files = new juce::DynamicObject();
    files->setProperty("hardware_wav", result.hardwareTake.wavFile.getFileName());
    files->setProperty("software_wav", result.softwareTake.wavFile.getFileName());
    files->setProperty("patch_snapshot_json", "patch_snapshot.json");
    root->setProperty("files", files.get());

    auto addTakeStats = [](juce::DynamicObject* obj, const AudioABTakeInfo& take)
    {
        obj->setProperty("num_samples", (int64)take.numSamples);
        obj->setProperty("duration_sec", take.durationSec);
        obj->setProperty("peak_dbfs", take.peakDbfs);
        obj->setProperty("rms_dbfs", take.rmsDbfs);
    };

    juce::DynamicObject::Ptr hw = new juce::DynamicObject();
    addTakeStats(hw.get(), result.hardwareTake);
    root->setProperty("hardware", hw.get());

    juce::DynamicObject::Ptr sw = new juce::DynamicObject();
    addTakeStats(sw.get(), result.softwareTake);
    root->setProperty("software", sw.get());

    juce::DynamicObject::Ptr comparison = new juce::DynamicObject();
    comparison->setProperty("status", "pending");
    comparison->setProperty("latency_offset_samples", juce::var());
    comparison->setProperty("rms_delta_db", juce::var());
    comparison->setProperty("spectral_distance", juce::var());
    root->setProperty("comparison", comparison.get());

    juce::var rootVar(root.get());
    juce::String jsonStr = juce::JSON::toString(rootVar);

    result.manifestFile.deleteFile();
    if (!result.manifestFile.appendText(jsonStr))
        return false;

    juce::File snapFile = currentRunDir.getChildFile("patch_snapshot.json");
    snapFile.deleteFile();
    return snapFile.appendText(snapshotJson);
}
