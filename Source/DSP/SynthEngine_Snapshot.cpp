#include "SynthEngine.h"
#include <map>
#include <cstring>

namespace ABD
{
    void SynthEngine::updateVoiceSnapshot()
    {
        const juce::ScopedLock sl(voiceStateLock);
        for (int i = 0; i < kNumVoices; ++i)
        {
            auto& src = voices[i];
            auto& dst = voiceSnapshots[i];
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
        snapPitchBend = currentPitchBend;
        snapModWheel = currentModWheel;
        snapAftertouch = currentAftertouch;
        snapSustainPedal = currentSustainPedal;
        snapPeakLevel = currentPeakLevel;

        currentDiagnosticSnapshot.blockCounter++;
        currentDiagnosticSnapshot.timestamp = (uint64_t)juce::Time::currentTimeMillis();
        currentDiagnosticSnapshot.vcfOversample = voices[0].params.vcfOversample;
        currentDiagnosticSnapshot.vcfVoicingMode = voices[0].params.vcfVoicingMode;
        currentDiagnosticSnapshot.driftAmount = voices[0].params.paramDrift;
        
        currentDiagnosticSnapshot.pitchBend = snapPitchBend;
        currentDiagnosticSnapshot.modWheel = snapModWheel;
        currentDiagnosticSnapshot.aftertouch = snapAftertouch;
        currentDiagnosticSnapshot.sustainPedal = snapSustainPedal;
        currentDiagnosticSnapshot.peakLevel = snapPeakLevel;
        currentDiagnosticSnapshot.voiceMode = voiceMode;
        
        int activeNotesCount = 0;
        for (int i = 0; i < kNumVoices; ++i)
        {
            if (voices[i].isActive())
                activeNotesCount++;
        }
        currentDiagnosticSnapshot.polyChordNoteCount = activeNotesCount;

        for (int i = 0; i < kNumVoices; ++i)
        {
            currentDiagnosticSnapshot.voiceSnapshots[i] = voices[i].getDiagnosticSnapshot(i);
        }
    }

    EngineDiagnosticSnapshot SynthEngine::getDiagnosticSnapshot() const
    {
        const juce::ScopedLock sl(voiceStateLock);
        auto snapshot = currentDiagnosticSnapshot;
#if DEEP_TARGET_MODEL >= 2
        // Serialización XML fuera del audio thread (invariante de tiempo real §3 del plan v3.2):
        // updateVoiceSnapshot() actualiza solo datos numéricos por bloque; el JSON de
        // calibración se construye aquí, en el hilo de control, bajo su propio lock.
        {
            const juce::ScopedLock calLock(calibrationLock);
            snapshot.activeCalibrationJson = activeCalibration.toXml();
        }
#endif
        return snapshot;
    }

    juce::var SynthEngine::getVoiceState() const
    {
        juce::Array<juce::var> arr;
        int polyCount = 0;
        {
            const juce::ScopedLock sl(voiceStateLock);
            for (int i = 0; i < kNumVoices; ++i)
            {
                auto& snap = voiceSnapshots[i];
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
            polyCount = polyChordNoteCount;
        }
        double snapPb = 0.0, snapMw = 0.0, snapAt = 0.0, snapSus = 0.0, snapPeak = 0.0;
        {
            const juce::ScopedLock sl(voiceStateLock);
            snapPb = (double)snapPitchBend;
            snapMw = (double)snapModWheel;
            snapAt = (double)snapAftertouch;
            snapSus = (double)snapSustainPedal;
            snapPeak = (double)snapPeakLevel;
        }
        auto* result = new juce::DynamicObject();
        result->setProperty("voices", juce::var(arr));
        result->setProperty("polyChordNoteCount", polyCount);
        result->setProperty("pitchBend", snapPb);
        result->setProperty("modWheel", snapMw);
        result->setProperty("aftertouch", snapAt);
        result->setProperty("sustainPedal", snapSus);
        result->setProperty("peakLevel", snapPeak);
        return juce::var(result);
    }

    juce::var SynthEngine::getAudioWaveform() const
    {
        juce::Array<juce::var> samples;
        for (int i = 0; i < kAudioCaptureSize; ++i)
        {
            int idx = (audioCaptureWritePos + i) % kAudioCaptureSize;
            samples.add ((double) audioCaptureBuffer[idx * 2]);
        }
        return juce::var (samples);
    }

    void SynthEngine::panic()
    {
        const juce::ScopedLock sl (voiceStateLock);
        
        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].stopNote (true);
        }
        
        std::memset (polyChordHeldNotes, 0, sizeof (polyChordHeldNotes));
        polyChordNoteCount = 0;
        
        std::memset (monoHeldNotes, 0, sizeof (monoHeldNotes));
        monoHeldNoteCount = 0;
        
        currentPeakLevel = 0.0f;
    }

    void SynthEngine::resetMidiControllers()
    {
        const juce::ScopedLock sl (voiceStateLock);

        currentPitchBend = 0.0f;
        currentModWheel = 0.0f;
        currentAftertouch = 0.0f;
        currentSustainPedal = 0.0f;
        sustainLatchCount = 0;

        // Propagar a todas las voces activas para que el cambio tenga efecto inmediato
        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].setExternalModulation (ModSource::kPitchBend, 0.0f);
            voices[i].setExternalModulation (ModSource::kModWheel, 0.0f);
            voices[i].setExternalModulation (ModSource::kKeyPressure, 0.0f);
            voices[i].setExternalModulation (ModSource::kSustainPedal, 0.0f);
        }
    }

    juce::String SynthEngine::getActiveNotesJSON() const
    {
        juce::Array<juce::var> notesArr;
        {
            const juce::ScopedLock sl (voiceStateLock);
            for (int i = 0; i < kNumVoices; ++i)
            {
                if (voiceSnapshots[i].active)
                {
                    auto* pair = new juce::DynamicObject();
                    pair->setProperty ("n", voiceSnapshots[i].midiNote);
                    pair->setProperty ("v", (double) voiceSnapshots[i].velocity);
                    notesArr.add (juce::var (pair));
                }
            }
        }

        std::map<int, float> uniqueNotes;
        for (auto& item : notesArr)
        {
            auto* obj = item.getDynamicObject();
            int n = (int) obj->getProperty ("n");
            float v = (float) obj->getProperty ("v");
            auto it = uniqueNotes.find (n);
            if (it == uniqueNotes.end())
                uniqueNotes[n] = v;
            else if (v > it->second)
                it->second = v;
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

        const juce::ScopedLock sl (calibrationLock);
        pendingCalibration = spec;
        return true;
    }

    juce::String SynthEngine::getCalibrationJson() const
    {
        const juce::ScopedLock sl (calibrationLock);
        return activeCalibration.toXml();
    }
#else
    bool SynthEngine::loadCalibrationFromJson(const juce::String&) { return false; }
    juce::String SynthEngine::getCalibrationJson() const { return {}; }
#endif
}
