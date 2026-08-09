#include "SynthEngine.h"
#include <algorithm>
#include <cstring>

namespace ABD
{
    void SynthEngine::triggerChordForRoot(int rootNote, int numChordNotes, const int* intervals, float velocity)
    {
        int voicesPerNote = getVoicesPerNote(voiceMode);

        for (int iv = 0; iv < numChordNotes && intervals[iv] >= 0; ++iv)
        {
            int chordNote = std::clamp(rootNote + intervals[iv], 0, 127);

            for (int v = 0; v < voicesPerNote; ++v)
            {
                int voiceIdx = findFreeVoice();
                if (voiceIdx < 0 || voiceIdx >= kNumVoices)
                    break;

                float detuneST = 0.0f;
                float panPos = 0.5f;
                if (voicesPerNote > 1)
                    getUnisonParams(v, voicesPerNote, detuneST, panPos);

                voices[voiceIdx].unisonDetuneSemitones = detuneST;
                voices[voiceIdx].unisonPanPosition = panPos;
                if (voices[voiceIdx].isActive())
                    voices[voiceIdx].stopNote(true);
                voices[voiceIdx].startNote(chordNote, velocity, (float)voiceIdx / (float)(kNumVoices - 1));
                voices[voiceIdx].setRootNote(rootNote);

                voices[voiceIdx].setExternalModulation(ModSource::kPitchBend, currentPitchBend);
                voices[voiceIdx].setExternalModulation(ModSource::kModWheel, currentModWheel);
                voices[voiceIdx].setExternalModulation(ModSource::kKeyPressure, currentAftertouch);
                voices[voiceIdx].setExternalModulation(ModSource::kSustainPedal, currentSustainPedal);
            }
        }
    }

    void SynthEngine::triggerNote(int midiNoteNumber, float velocity)
    {
        // --- Chord Memory / Poly Chord expansion ---
        if (chordEnable || polyChordEnable)
        {
            int numChordNotes = 0;
            const int* intervals = getChordIntervals(chordType, numChordNotes);
            
            if (polyChordEnable)
            {
                // Poly Chord: acumular notas raíz
                if (polyChordNoteCount < kMaxChordNotes)
                {
                    bool alreadyHeld = false;
                    for (int h = 0; h < polyChordNoteCount; ++h)
                    {
                        if (polyChordHeldNotes[h] == midiNoteNumber)
                        {
                            alreadyHeld = true;
                            break;
                        }
                    }
                    if (!alreadyHeld)
                    {
                        polyChordHeldNotes[polyChordNoteCount++] = midiNoteNumber;
                    }
                }

                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive())
                        voices[i].stopNote(true);
                }

                for (int h = 0; h < polyChordNoteCount; ++h)
                {
                    triggerChordForRoot(polyChordHeldNotes[h], numChordNotes, intervals, velocity);
                }
            }
            else
            {
                if (voiceMode >= 6 && voiceMode <= 10)
                {
                    for (int i = 0; i < kNumVoices; ++i)
                    {
                        if (voices[i].isActive())
                            voices[i].stopNote(true);
                    }
                }
                triggerChordForRoot(midiNoteNumber, numChordNotes, intervals, velocity);
            }
            
            pendingNoteOnNote.store(midiNoteNumber, std::memory_order_release);
            pendingNoteOnVel.store(velocity, std::memory_order_release);

            DBG("[SynthEngine] triggerNote (Chord): note=" + juce::String(midiNoteNumber)
                + " type=" + juce::String(chordType)
                + " notes=" + juce::String(numChordNotes)
                + " poly=" + juce::String(polyChordNoteCount));
            return;
        }

        // --- Normal note trigger (no chord) ---
        int voicesPerNote = getVoicesPerNote(voiceMode);

        if (voiceMode >= 6 && voiceMode <= 10)
        {
            bool alreadyHeld = false;
            for (int h = 0; h < monoHeldNoteCount; ++h)
            {
                if (monoHeldNotes[h] == midiNoteNumber)
                {
                    alreadyHeld = true;
                    break;
                }
            }
            if (!alreadyHeld && monoHeldNoteCount < 12)
                monoHeldNotes[monoHeldNoteCount++] = midiNoteNumber;

            bool shouldPlay = true;
            if (notePriority == 0 && monoHeldNoteCount > 1)
            {
                for (int h = 0; h < monoHeldNoteCount; ++h)
                {
                    if (monoHeldNotes[h] < midiNoteNumber)
                    {
                        shouldPlay = false;
                        break;
                    }
                }
            }
            else if (notePriority == 1 && monoHeldNoteCount > 1)
            {
                for (int h = 0; h < monoHeldNoteCount; ++h)
                {
                    if (monoHeldNotes[h] > midiNoteNumber)
                    {
                        shouldPlay = false;
                        break;
                    }
                }
            }

            if (shouldPlay)
            {
                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive())
                        voices[i].stopNote(true);
                }
            }
            else
            {
                monoHeldNoteCount--;
                return;
            }
        }

        DBG("[SynthEngine] triggerNote: note=" + juce::String(midiNoteNumber)
            + " vel=" + juce::String(velocity)
            + " mode=" + juce::String(voiceMode)
            + " stack=" + juce::String(voicesPerNote));

        pendingNoteOnNote.store(midiNoteNumber, std::memory_order_release);
        pendingNoteOnVel.store(velocity, std::memory_order_release);

        for (int v = 0; v < voicesPerNote; ++v)
        {
            int voiceIdx = findFreeVoice();
            if (voiceIdx < 0 || voiceIdx >= kNumVoices)
                break;

            float voiceNormalized = (float)voiceIdx / (float)(kNumVoices - 1);
            float detuneST = 0.0f;
            float panPos = 0.5f;
            if (voicesPerNote > 1)
                getUnisonParams(v, voicesPerNote, detuneST, panPos);

            voices[voiceIdx].unisonDetuneSemitones = detuneST;
            voices[voiceIdx].unisonPanPosition = panPos;
            if (voices[voiceIdx].isActive())
                voices[voiceIdx].stopNote(true);
            voices[voiceIdx].startNote(midiNoteNumber, velocity, voiceNormalized);
            voices[voiceIdx].setRootNote(midiNoteNumber);

            voices[voiceIdx].setExternalModulation(ModSource::kPitchBend, currentPitchBend);
            voices[voiceIdx].setExternalModulation(ModSource::kModWheel, currentModWheel);
            voices[voiceIdx].setExternalModulation(ModSource::kKeyPressure, currentAftertouch);
            voices[voiceIdx].setExternalModulation(ModSource::kSustainPedal, currentSustainPedal);
        }
    }

    void SynthEngine::releaseNote(int midiNoteNumber)
    {
        // Sustain pedal latch: a key released while the pedal is down does NOT
        // enter its release phase — the envelope stays at sustain. The note is
        // remembered and released when the pedal goes up (releaseSustainLatchedNotes).
        if (currentSustainPedal >= 0.5f)
        {
            bool anyVoiceActive = false;
            for (int i = 0; i < kNumVoices; ++i)
            {
                if (voices[i].isActive() && voices[i].getRootNote() == midiNoteNumber)
                {
                    anyVoiceActive = true;
                    break;
                }
            }
            if (anyVoiceActive && !isSustainLatched(midiNoteNumber) && sustainLatchCount < 128)
                sustainLatchedNotes[sustainLatchCount++] = midiNoteNumber;
            return;
        }

        if (polyChordEnable)
        {
            for (int h = 0; h < polyChordNoteCount; ++h)
            {
                if (polyChordHeldNotes[h] == midiNoteNumber)
                {
                    for (int r = h; r < polyChordNoteCount - 1; ++r)
                        polyChordHeldNotes[r] = polyChordHeldNotes[r + 1];
                    polyChordNoteCount--;
                    break;
                }
            }

            if (polyChordNoteCount == 0)
            {
                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive())
                        voices[i].stopNote(false);
                }
            }
            else
            {
                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive() && voices[i].getRootNote() == midiNoteNumber)
                        voices[i].stopNote(false);
                }
            }
            return;
        }

        // Mono mode
        if (voiceMode >= 6 && voiceMode <= 10)
        {
            for (int h = 0; h < monoHeldNoteCount; ++h)
            {
                if (monoHeldNotes[h] == midiNoteNumber)
                {
                    for (int r = h; r < monoHeldNoteCount - 1; ++r)
                        monoHeldNotes[r] = monoHeldNotes[r + 1];
                    monoHeldNoteCount--;
                    break;
                }
            }

            if (monoHeldNoteCount > 0)
            {
                int nextNote = monoHeldNotes[0];
                if (notePriority == 1)
                {
                    for (int h = 1; h < monoHeldNoteCount; ++h)
                        if (monoHeldNotes[h] > nextNote) nextNote = monoHeldNotes[h];
                }
                else if (notePriority == 0)
                {
                    for (int h = 1; h < monoHeldNoteCount; ++h)
                        if (monoHeldNotes[h] < nextNote) nextNote = monoHeldNotes[h];
                }
                else
                {
                    nextNote = monoHeldNotes[monoHeldNoteCount - 1];
                }

                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive())
                        voices[i].stopNote(true);
                }
                triggerNote(nextNote, 0.8f);
                return;
            }

            for (int i = 0; i < kNumVoices; ++i)
            {
                if (voices[i].isActive())
                    voices[i].stopNote(false);
            }
            return;
        }

        // Emitir note-off para la UI web
        pendingNoteOffNote.store(midiNoteNumber, std::memory_order_release);

        // Poly mode: liberar voces cuya nota raíz coincide con la nota liberada
        for (int i = 0; i < kNumVoices; ++i)
        {
            if (voices[i].isActive() && voices[i].getRootNote() == midiNoteNumber)
            {
                voices[i].stopNote(false);
            }
        }
    }

    bool SynthEngine::isSustainLatched(int midiNoteNumber) const
    {
        for (int i = 0; i < sustainLatchCount; ++i)
        {
            if (sustainLatchedNotes[i] == midiNoteNumber)
                return true;
        }
        return false;
    }

    void SynthEngine::releaseSustainLatchedNotes()
    {
        const int count = sustainLatchCount;
        sustainLatchCount = 0;
        for (int i = 0; i < count; ++i)
            releaseNote(sustainLatchedNotes[i]);
    }
}
