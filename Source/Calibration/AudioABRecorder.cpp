// Source/Calibration/AudioABRecorder.cpp
#include "AudioABRecorder.h"

AudioABRecorder::AudioABRecorder()
{
}

AudioABRecorder::~AudioABRecorder()
{
}

void AudioABRecorder::prepare(double sampleRate_, int maxBlockSize_, int numInputChannels_, int numOutputChannels_)
{
    this->sampleRate = sampleRate_;
    this->maxBlockSize = maxBlockSize_;
    this->numInputChannels = numInputChannels_;
    this->numOutputChannels = numOutputChannels_;
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

    // Crear carpeta del run
    if (!outputRoot.exists())
        outputRoot.createDirectory();

    currentRunDir = outputRoot.getChildFile(currentConfig.runId);
    if (!currentRunDir.exists())
        currentRunDir.createDirectory();

    // Reservar espacio en buffers
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
            // Mapear canal de entrada de hardware al buffer
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
    
    // Crear un MidiBuffer para el render
    juce::MidiBuffer midiEvents;
    midiEvents.addEvent(juce::MidiMessage::noteOn(1, currentConfig.midiNote, (juce::uint8)currentConfig.velocity), 0);
    
    int noteOffSample = (int)(currentConfig.noteDurationSec * currentConfig.sampleRate);
    if (noteOffSample < totalSamples)
    {
        midiEvents.addEvent(juce::MidiMessage::noteOff(1, currentConfig.midiNote), noteOffSample);
    }

    // Renderizar directamente en bloques sobre el motor software
    int blockSize = 512;
    int processedSamples = 0;

    juce::AudioBuffer<float> tempBlockBuffer(currentConfig.numChannels, blockSize);

    while (processedSamples < totalSamples)
    {
        int chunk = std::min(blockSize, totalSamples - processedSamples);
        tempBlockBuffer.setSize(currentConfig.numChannels, chunk, false, true, true);
        tempBlockBuffer.clear();

        // Extraer eventos MIDI de este rango de muestras
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

        // Renderizar bloque en el engine
        engine.processBlock(tempBlockBuffer, blockMidi);

        // Copiar al buffer acumulado de software
        for (int ch = 0; ch < currentConfig.numChannels; ++ch)
        {
            softwareBuffer.copyFrom(ch, processedSamples, tempBlockBuffer, ch, 0, chunk);
        }

        processedSamples += chunk;
    }

    return true;
}

bool AudioABRecorder::finishRun(AudioABRunResult& result)
{
    if (!running)
        return false;

    running = false;

    // Guardar WAVs
    juce::File hwWavFile = currentRunDir.getChildFile("hardware.wav");
    juce::File swWavFile = currentRunDir.getChildFile("software.wav");

    bool hwWriteOk = writeWav(hwWavFile, hardwareBuffer, currentConfig.sampleRate, currentConfig.bitDepth);
    bool swWriteOk = writeWav(swWavFile, softwareBuffer, currentConfig.sampleRate, currentConfig.bitDepth);

    if (!hwWriteOk || !swWriteOk)
    {
        result.ok = false;
        result.error = "Error al escribir archivos WAV.";
        return false;
    }

    // ConstruirTakeInfo
    result.runId = currentConfig.runId;
    result.patchName = currentConfig.patchName;
    result.startedAt = startedAt;
    result.outputDir = currentRunDir;
    result.hardwareTake = buildTakeInfo("hardware", hwWavFile, hardwareBuffer, currentConfig.sampleRate);
    result.softwareTake = buildTakeInfo("software", swWavFile, softwareBuffer, currentConfig.sampleRate);
    result.manifestFile = currentRunDir.getChildFile("audio_ab_manifest.json");

    bool manifestOk = writeManifest(result, patchSnapshotJson);
    if (!manifestOk)
    {
        result.ok = false;
        result.error = "Error al escribir manifest.json.";
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

bool AudioABRecorder::writeWav(const juce::File& file, const juce::AudioBuffer<float>& buffer, double sampleRate, int bitDepth)
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

    // El stream de salida ahora es propiedad del writer
    fileStream.release();

    return writer->writeFromAudioSampleBuffer(buffer, 0, buffer.getNumSamples());
}

AudioABTakeInfo AudioABRecorder::buildTakeInfo(const juce::String& kind, const juce::File& wavFile, const juce::AudioBuffer<float>& buffer, double sampleRate) const
{
    AudioABTakeInfo info;
    info.kind = kind;
    info.wavFile = wavFile;
    info.numSamples = buffer.getNumSamples();
    info.sampleRate = sampleRate;
    info.numChannels = buffer.getNumChannels();
    info.durationSec = (double)info.numSamples / sampleRate;

    // Calcular peak y RMS
    float peak = 0.0f;
    double sumSquares = 0.0;
    
    for (int ch = 0; ch < buffer.getNumChannels(); ++ch)
    {
        float p = buffer.getMagnitude(ch, 0, buffer.getNumSamples());
        if (p > peak)
            peak = p;

        const float* readPtr = buffer.getReadPointer(ch);
        for (int i = 0; i < buffer.getNumSamples(); ++i)
        {
            sumSquares += readPtr[i] * readPtr[i];
        }
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

    // Engine settings
    juce::DynamicObject::Ptr engine = new juce::DynamicObject();
    engine->setProperty("sample_rate", currentConfig.sampleRate);
    engine->setProperty("bit_depth", currentConfig.bitDepth);
    engine->setProperty("channels", currentConfig.numChannels);
    engine->setProperty("note", currentConfig.midiNote);
    engine->setProperty("velocity", currentConfig.velocity);
    engine->setProperty("note_duration_sec", currentConfig.noteDurationSec);
    engine->setProperty("tail_duration_sec", currentConfig.tailDurationSec);
    root->setProperty("engine", engine.get());

    // Files
    juce::DynamicObject::Ptr files = new juce::DynamicObject();
    files->setProperty("hardware_wav", result.hardwareTake.wavFile.getFileName());
    files->setProperty("software_wav", result.softwareTake.wavFile.getFileName());
    files->setProperty("patch_snapshot_json", "patch_snapshot.json");
    root->setProperty("files", files.get());

    // Hardware stats
    juce::DynamicObject::Ptr hw = new juce::DynamicObject();
    hw->setProperty("num_samples", (int64)result.hardwareTake.numSamples);
    hw->setProperty("duration_sec", result.hardwareTake.durationSec);
    hw->setProperty("peak_dbfs", result.hardwareTake.peakDbfs);
    hw->setProperty("rms_dbfs", result.hardwareTake.rmsDbfs);
    root->setProperty("hardware", hw.get());

    // Software stats
    juce::DynamicObject::Ptr sw = new juce::DynamicObject();
    sw->setProperty("num_samples", (int64)result.softwareTake.numSamples);
    sw->setProperty("duration_sec", result.softwareTake.durationSec);
    sw->setProperty("peak_dbfs", result.softwareTake.peakDbfs);
    sw->setProperty("rms_dbfs", result.softwareTake.rmsDbfs);
    root->setProperty("software", sw.get());

    // Comparison stub
    juce::DynamicObject::Ptr comparison = new juce::DynamicObject();
    comparison->setProperty("status", "pending");
    comparison->setProperty("latency_offset_samples", juce::var());
    comparison->setProperty("rms_delta_db", juce::var());
    comparison->setProperty("spectral_distance", juce::var());
    root->setProperty("comparison", comparison.get());

    // Escribir manifest
    juce::var rootVar(root.get());
    juce::String jsonStr = juce::JSON::toString(rootVar);
    
    result.manifestFile.deleteFile();
    if (!result.manifestFile.appendText(jsonStr))
        return false;

    // Escribir snapshot JSON
    juce::File snapFile = currentRunDir.getChildFile("patch_snapshot.json");
    snapFile.deleteFile();
    return snapFile.appendText(snapshotJson);
}
