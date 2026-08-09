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

    int SynthEngine::findFreeVoice()
    {
        // 1. Buscar una voz completamente inactiva (Stage::kIdle)
        for (int i = 0; i < kNumVoices; ++i)
        {
            if (!voices[i].isActive())
                return i;
        }

        // 2. Si no hay inactivas, priorizar el robo de voces que ya estén en fase de Release
        int bestReleaseVoice = -1;
        for (int i = 0; i < kNumVoices; ++i)
        {
            if (voices[i].isActive() && voices[i].env1VCA.getCurrentStage() == Envelope::Stage::kRelease)
            {
                bestReleaseVoice = i;
                break;
            }
        }
        if (bestReleaseVoice >= 0)
            return bestReleaseVoice;

        // 3. Si todas las voces están sostenidas físicamente (Attack/Decay/Sustain),
        // robamos usando round-robin para distribuir el robo de voz de forma rotatoria
        static int lastStolenVoice = 0;
        lastStolenVoice = (lastStolenVoice + 1) % kNumVoices;
        return lastStolenVoice;
    }
}
