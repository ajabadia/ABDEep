#include "SynthEngine.h"
#include <map>
#include <cstring>

namespace ABD
{
    void SynthEngine::updateVoiceSnapshot()
    {
        const int readIdx  = activeTelemetryIndex.load(std::memory_order_relaxed);
        const int writeIdx = 1 - readIdx;
        auto& buf = telemetryBuffers[writeIdx];

        for (int i = 0; i < kNumVoices; ++i)
        {
            auto& src = voices[i];
            auto& dst = buf.voiceSnapshots[i];
            dst.active = src.isActive();
            dst.midiNote = src.isActive() ? src.getMidiNote() : -1;
            dst.velocity = src.isActive() ? src.noteVelocity : 0.0f;
            dst.detuneSemitones = src.unisonDetuneSemitones;
            dst.panPosition = src.unisonPanPosition;
            dst.voicePanSpread = src.voicePanSpread;
            dst.modOsc1DetuneSemitones = src.lastModOsc1DetuneSemitones;
            dst.modOsc2DetuneSemitones = src.lastModOsc2DetuneSemitones;
            dst.modPan = src.lastModPan;
            dst.modVcfCutoffHz = src.lastModVcfCutoffHz;
        }
        buf.snapPitchBend = currentPitchBend;
        buf.snapModWheel = currentModWheel;
        buf.snapAftertouch = currentAftertouch;
        buf.snapSustainPedal = currentSustainPedal;
        buf.snapPeakLevel = currentPeakLevel;
        buf.polyChordNoteCount = polyChordNoteCount;

        auto& diag = buf.diagnosticSnapshot;
        diag.blockCounter = telemetryBuffers[readIdx].diagnosticSnapshot.blockCounter + 1;
        diag.timestamp = (uint64_t)juce::Time::currentTimeMillis();
        diag.vcfOversample = voices[0].params.vcfOversample;
        diag.vcfVoicingMode = voices[0].params.vcfVoicingMode;
        diag.driftAmount = voices[0].params.paramDrift;

        diag.pitchBend = buf.snapPitchBend;
        diag.modWheel = buf.snapModWheel;
        diag.aftertouch = buf.snapAftertouch;
        diag.sustainPedal = buf.snapSustainPedal;
        diag.peakLevel = buf.snapPeakLevel;
        diag.voiceMode = voiceMode;

        diag.polyChordNoteCount = polyChordNoteCount;

        for (int i = 0; i < kNumVoices; ++i)
        {
            diag.voiceSnapshots[i] = voices[i].getDiagnosticSnapshot(i);
        }

        auto& shared = buf.sharedSnapshot;
        shared.vuLeft = currentPeakLevel;
        shared.vuRight = currentPeakLevel;
        shared.peakLeft = currentPeakLevel;
        shared.peakRight = currentPeakLevel;
        uint32_t activeCount = 0;
        for (int i = 0; i < kNumVoices; ++i)
        {
            const bool act = buf.voiceSnapshots[i].active;
            shared.voiceActive[static_cast<size_t>(i)] = act;
            shared.voiceNote[static_cast<size_t>(i)] = act && buf.voiceSnapshots[i].midiNote >= 0
                ? static_cast<uint8_t>(buf.voiceSnapshots[i].midiNote) : 0u;
            shared.voiceVelocity[static_cast<size_t>(i)] = buf.voiceSnapshots[i].velocity;
            shared.voiceEnvelopeAmp[static_cast<size_t>(i)] = voices[i].getVcaEnvelopeLevel();
            shared.voiceEnvelopeFilter[static_cast<size_t>(i)] = voices[i].getVcfEnvelopeLevel();
            if (act)
                ++activeCount;
        }
        shared.activeVoiceCount = activeCount;
        shared.currentArpStep = 0;
        shared.currentModSeqStep = controlSequencer.getCurrentStep();
        shared.isArpActive = arpeggiator.isActive();
        shared.isModSeqActive = controlSequencer.isEnabled();

        activeTelemetryIndex.store(writeIdx, std::memory_order_release);
    }

    EngineDiagnosticSnapshot SynthEngine::getDiagnosticSnapshot() const
    {
        const int idx = activeTelemetryIndex.load(std::memory_order_acquire);
        auto snapshot = telemetryBuffers[idx].diagnosticSnapshot;
#if DEEP_TARGET_MODEL >= 2
        // Serialización XML fuera del audio thread (invariante de tiempo real §3 del plan v3.2):
        // updateVoiceSnapshot() actualiza solo datos numéricos por bloque; el XML de
        // calibración se construye aquí, en el hilo de control.
        snapshot.activeCalibrationJson = getCalibrationJson();
#endif
        return snapshot;
    }

    juce::var SynthEngine::getVoiceState() const
    {
        const int idx = activeTelemetryIndex.load(std::memory_order_acquire);
        const auto& buf = telemetryBuffers[idx];

        juce::Array<juce::var> arr;
        for (int i = 0; i < kNumVoices; ++i)
        {
            const auto& snap = buf.voiceSnapshots[i];
            auto* obj = new juce::DynamicObject();
            obj->setProperty("index", i);
            obj->setProperty("active", snap.active);
            obj->setProperty("midiNote", snap.active ? snap.midiNote : -1);
            obj->setProperty("detuneSemitones", (double)snap.detuneSemitones);
            obj->setProperty("panPosition", (double)snap.panPosition);
            obj->setProperty("voicePanSpread", (double)snap.voicePanSpread);
            obj->setProperty("modOsc1DetuneSemitones", (double)snap.modOsc1DetuneSemitones);
            obj->setProperty("modOsc2DetuneSemitones", (double)snap.modOsc2DetuneSemitones);
            obj->setProperty("modPan", (double)snap.modPan);
            obj->setProperty("modVcfCutoffHz", (double)snap.modVcfCutoffHz);
            arr.add(juce::var(obj));
        }

        auto* result = new juce::DynamicObject();
        result->setProperty("voices", juce::var(arr));
        result->setProperty("polyChordNoteCount", buf.polyChordNoteCount);
        result->setProperty("pitchBend", (double)buf.snapPitchBend);
        result->setProperty("modWheel", (double)buf.snapModWheel);
        result->setProperty("aftertouch", (double)buf.snapAftertouch);
        result->setProperty("sustainPedal", (double)buf.snapSustainPedal);
        result->setProperty("peakLevel", (double)buf.snapPeakLevel);
        return juce::var(result);
    }

    juce::var SynthEngine::getAudioWaveform() const
    {
        juce::Array<juce::var> samples;
        const int writePos = audioCaptureWritePos.load(std::memory_order_acquire);
        for (int i = 0; i < kAudioCaptureSize; ++i)
        {
            int idx = (writePos + i) % kAudioCaptureSize;
            samples.add ((double) audioCaptureBuffer[idx * 2]);
        }
        return juce::var (samples);
    }

    void SynthEngine::panic()
    {
        const juce::SpinLock::ScopedTryLockType processTryLock(engineProcessSpinLock);
        if (!processTryLock.isLocked())
        {
            pendingPanic.store(true, std::memory_order_release);
            return;
        }

        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].stopNote (true);
        }
        voiceAlloc.reset();
        arpeggiator.allNotesOff();

        std::memset (polyChordHeldNotes, 0, sizeof (polyChordHeldNotes));
        polyChordNoteCount = 0;

        std::memset (monoHeldNotes, 0, sizeof (monoHeldNotes));
        monoHeldNoteCount = 0;

        sustainLatchCount = 0;
        currentPeakLevel = 0.0f;

        for (int b = 0; b < 2; ++b)
        {
            telemetryBuffers[b].polyChordNoteCount = 0;
            telemetryBuffers[b].snapPeakLevel = 0.0f;
            for (int i = 0; i < kNumVoices; ++i)
            {
                telemetryBuffers[b].voiceSnapshots[i].active = false;
                telemetryBuffers[b].voiceSnapshots[i].midiNote = -1;
            }
        }
    }

    void SynthEngine::resetMidiControllers()
    {
        const juce::SpinLock::ScopedLockType processLock(engineProcessSpinLock);

        currentPitchBend = 0.0f;
        currentModWheel = 0.0f;
        currentAftertouch = 0.0f;
        currentSustainPedal = 0.0f;
        currentFootController = 0.0f;
        currentBreathController = 0.0f;
        currentExpressionPedal = 0.0f;
        sustainLatchCount = 0;

        // Propagar a todas las voces activas para que el cambio tenga efecto inmediato
        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].setExternalModulation (ModSource::kPitchBend, 0.0f);
            voices[i].setExternalModulation (ModSource::kModWheel, 0.0f);
            voices[i].setExternalModulation (ModSource::kKeyPressure, 0.0f);
            voices[i].setExternalModulation (ModSource::kSustainPedal, 0.0f);
            voices[i].setExternalModulation (ModSource::kFootController, 0.0f);
            voices[i].setExternalModulation (ModSource::kBreathController, 0.0f);
            voices[i].setExternalModulation (ModSource::kExpressionPedal, 0.0f);
        }
    }

    juce::String SynthEngine::getActiveNotesJSON() const
    {
        const int idx = activeTelemetryIndex.load(std::memory_order_acquire);
        const auto& buf = telemetryBuffers[idx];

        std::map<int, float> uniqueNotes;
        for (int i = 0; i < kNumVoices; ++i)
        {
            const auto& snap = buf.voiceSnapshots[i];
            if (snap.active)
            {
                auto it = uniqueNotes.find (snap.midiNote);
                if (it == uniqueNotes.end())
                    uniqueNotes[snap.midiNote] = snap.velocity;
                else if (snap.velocity > it->second)
                    it->second = snap.velocity;
            }
        }

        juce::String json = "[";
        bool first = true;
        for (auto& [note, vel] : uniqueNotes)
        {
            if (!first) json += ",";
            json += "[" + juce::String (note) + "," + juce::String (vel, 4) + "]";
            first = false;
        }
        json += "]";
        return json;
    }

//==============================================================================
// Calibration
//==============================================================================

#if DEEP_TARGET_MODEL >= 2
    bool SynthEngine::loadCalibrationFromJson(const juce::String& json)
    {
        juce::String error;
        auto spec = CalibrationSpec::fromXml(json, error);
        if (! error.isEmpty())
            return false;

        spec.validate();
        const juce::ScopedLock sl (calibrationLock);
        const int writeIdx = 1 - activeCalibrationIndex.load (std::memory_order_relaxed);
        calibrationBuffers[writeIdx] = spec;
        activeCalibrationIndex.store (writeIdx, std::memory_order_release);
        return true;
    }

    juce::String SynthEngine::getCalibrationJson() const
    {
        const juce::ScopedLock sl (calibrationLock);
        const int readIdx = activeCalibrationIndex.load (std::memory_order_acquire);
        return calibrationBuffers[readIdx].toXml();
    }
#else
    bool SynthEngine::loadCalibrationFromJson(const juce::String&) { return false; }
    juce::String SynthEngine::getCalibrationJson() const { return {}; }
#endif
}
