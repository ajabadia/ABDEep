#include "SynthEngine.h"
#include <algorithm>
#include <cstring>

namespace ABD
{
    // ========== Chord Intervals ==========
    // Intervalos en semitonos desde la tónica para cada tipo de acorde
    static const int kChordTable[8][6] = {
        { 0, 4, 7, 12, 16, 19 },  // 0 Memory
        { 0, 4, 7, -1, -1, -1 },  // 1 Major
        { 0, 3, 7, -1, -1, -1 },  // 2 Minor
        { 0, 4, 8, -1, -1, -1 },  // 3 Aug (major 3rd + aug 5th)
        { 0, 3, 6, -1, -1, -1 },  // 4 Dim (minor 3rd + dim 5th)
        { 0, 2, 7, -1, -1, -1 },  // 5 Sus2 (root + M2 + P5)
        { 0, 5, 7, -1, -1, -1 },  // 6 Sus4 (root + P4 + P5)
        { 0, 4, 7, 10, -1, -1 },  // 7 7th (major triad + m7)
    };

    const int* SynthEngine::getChordIntervals(int type, int& numNotes)
    {
        int idx = std::clamp(type, 0, 7);
        numNotes = 0;
        for (int i = 0; i < 6; ++i)
        {
            if (kChordTable[idx][i] < 0) break;
            numNotes++;
        }
        return kChordTable[idx];
    }

    // ========== Voice Mode Helpers ==========

    int SynthEngine::getVoicesPerNote(int mode)
    {
        switch (mode)
        {
            case 0:  return 1;   // Poly
            case 1:  return 2;   // Uni2
            case 2:  return 3;   // Uni3
            case 3:  return 4;   // Uni4
            case 4:  return 6;   // Uni6
            case 5:  return 12;  // Uni12
            case 6:  return 1;   // Mono
            case 7:  return 2;   // Mono2
            case 8:  return 3;   // Mono3
            case 9:  return 4;   // Mono4
            case 10: return 6;   // Mono6
            case 11: return 1;   // Poly6
            case 12: return 1;   // Poly8
            default: return 1;
        }
    }

    void SynthEngine::getUnisonParams(int voiceInGroup, int totalInGroup,
                                       float& detuneSemitones,
                                       float& panPosition) const
    {
        if (totalInGroup <= 1)
        {
            detuneSemitones = 0.0f;
            panPosition = 0.5f;
            return;
        }

        // Detune simétrico: ±0..±50 cents
        float maxDetuneCents = unisonDetune * 50.0f;
        if (totalInGroup == 2)
        {
            detuneSemitones = (voiceInGroup == 0) ? -maxDetuneCents / 100.0f
                                                   :  maxDetuneCents / 100.0f;
        }
        else
        {
            float step = 2.0f * maxDetuneCents / (float)(totalInGroup - 1);
            detuneSemitones = (-maxDetuneCents + (float)voiceInGroup * step) / 100.0f;
        }

        // Pan: spread uniforme a través del campo estéreo
        if (totalInGroup == 2)
        {
            panPosition = (voiceInGroup == 0) ? 0.0f : 1.0f;
        }
        else
        {
            panPosition = (float)voiceInGroup / (float)(totalInGroup - 1);
        }
    }

    // ========== Voice Allocation ==========
    // DRY transversal: la escalera de robo (nota repetida → libre → latch →
    // release por nivel → FIFO → RR) vive en abd::synth::VoiceAllocator
    // (ABDSharedCode::SynthCore), generalizada desde ABDMS2000 VoiceManager.
    // Aquí solo alimentamos la tabla de observación voice-agnóstica (StealHint)
    // y aplicamos el resultado; el módulo compartido no conoce JUCE ni SynthVoice.

    void SynthEngine::syncVoiceAllocatorHints()
    {
        for (int i = 0; i < kNumVoices; ++i)
        {
            const SynthVoice& v = voices[i];
            const bool active = v.isActive();
            abd::synth::StealHint& h = stealHints[static_cast<size_t>(i)];
            h.slotIndex = i;
            h.midiNote = v.getMidiNote();
            h.isVoiceActive = active;
            // Sustain-latch: nota key-released con pedal pisado (equivalente al
            // HOLD latch del MS2000). Sigue sonando y es candidata barata (tier 3).
            h.isLatched = active && isSustainLatched(h.midiNote);
            h.isKeyHeld = active && !v.isReleasing() && !h.isLatched;
            h.isReleasing = active && v.isReleasing();
            h.envelopeLevel = active ? v.getVcaEnvelopeLevel() : 0.0f;
            h.triggerStamp = voiceAlloc.getVoiceState(static_cast<size_t>(i)).noteOnTimestamp;
        }
    }

    void SynthEngine::commitAllocation(int slotIndex, int midiNote)
    {
        if (slotIndex < 0 || slotIndex >= kNumVoices) return;
        voiceAlloc.commitAllocation(slotIndex, midiNote);
        
        // Actualizar la StealHint correspondiente para reflejar el nuevo estado
        abd::synth::StealHint& h = stealHints[static_cast<size_t>(slotIndex)];
        h.slotIndex = slotIndex;
        h.midiNote = midiNote;
        h.isVoiceActive = true;
        h.isKeyHeld = true;  // La voz acaba de ser activada, está "key held" por defecto
        h.isLatched = false; // No está latchada (a menos que el pedal esté pisado, pero eso se maneja en syncVoiceAllocatorHints)
        h.isReleasing = false; // Acaba de comenzar, no está en release
        h.envelopeLevel = 0.0f; // El nivel de envolvente empieza en 0 (attack)
        h.triggerStamp = voiceAlloc.getVoiceState(static_cast<size_t>(slotIndex)).noteOnTimestamp;
    }

    void SynthEngine::markSlotReleased(int slotIndex)
    {
        if (slotIndex < 0 || slotIndex >= kNumVoices) return;
        voiceAlloc.markSlotReleased(slotIndex);
        
        // Actualizar la StealHint correspondiente para reflejar el nuevo estado
        abd::synth::StealHint& h = stealHints[static_cast<size_t>(slotIndex)];
        h.slotIndex = slotIndex;
        h.midiNote = -1;  // La nota se libera
        h.isVoiceActive = false; // La voz se libera
        h.isKeyHeld = false; // No está "key held" porque se liberó
        h.isLatched = false; // No está latchada
        h.isReleasing = false; // Se libera inmediatamente (no va a release)
        h.envelopeLevel = 0.0f; // El nivel de envolvente es 0 porque la voz se libera
        h.triggerStamp = 0; // El timestamp se resetea
    }

    int SynthEngine::findFreeVoice(int incomingNote)
    {
        syncVoiceAllocatorHints();
        return voiceAlloc.findVoiceToSteal(stealHints.data(), static_cast<size_t>(kNumVoices), incomingNote);
    }
}
