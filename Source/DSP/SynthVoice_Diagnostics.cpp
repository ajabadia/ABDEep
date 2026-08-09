#include "SynthVoice.h"
#include "DSPHelpers.h"
#include <cmath>
#if DEEP_TARGET_MODEL >= 2
#include "../Core/CalibrationSpec.h"
#endif

namespace ABD
{
    void SynthVoice::initializeVoicePersonality(int voiceSlotIndex)
    {
        DSP::LCG rng((uint32_t)(voiceSlotIndex * 7919 + 104729));

        noiseSeed = (uint32_t)(voiceSlotIndex * 104729 + 524287);

        staticPitchOffset1 = (rng.next() - 0.5f) * 3.0f;
        staticPitchOffset2 = (rng.next() - 0.5f) * 3.0f;
        staticCutoffOffset = (rng.next() - 0.5f) * 0.06f;
        staticResOffset = (rng.next() - 0.5f) * 0.04f;
        staticEnvTimeOffset = (rng.next() - 0.5f) * 0.16f;
    }

    VoiceDiagnosticSnapshot SynthVoice::getDiagnosticSnapshot(int voiceIdx) const
    {
        VoiceDiagnosticSnapshot snapshot;
        snapshot.voiceIndex = voiceIdx;
        snapshot.isActive = isActive();
        snapshot.noteNumber = currentMidiNote >= 0 ? (float)currentMidiNote : 0.0f;
        snapshot.velocity = noteVelocity;
        
        snapshot.detuneSemitonesBase = unisonDetuneSemitones;
        snapshot.detuneSemitonesEffective = unisonDetuneSemitones + lastModOsc1DetuneSemitones;
        snapshot.panBase = unisonPanPosition;
        snapshot.panEffective = lastModPan;
        
        snapshot.baseCutoffHz = lastBaseCutoffHz;
        snapshot.effectiveCutoffHz = lastEffectiveCutoffHz;
        snapshot.resonance = lastVcfResonance;
        snapshot.envDepthSign = lastEnvDepthSign;
        snapshot.keytrackHz = lastKeytrackHz;
        snapshot.hpfCutoffHz = lastHpfCutoffHz;
        
        snapshot.vcfCutoffBase = lastBaseCutoffHz;
        snapshot.vcfCutoffEffectiveHz = lastEffectiveCutoffHz;
        snapshot.vcfResonanceBase = lastVcfResonance;
        snapshot.vcfResonanceEffective = lastVcfResonance;
        snapshot.hpfCutoffBase = lastHpfCutoffHz;
        
        snapshot.lfo1Value = lastLfo1Value;
        snapshot.lfo2Value = lastLfo2Value;
        snapshot.env1Value = lastEnv1Value;
        snapshot.env2Value = lastEnv2Value;
        snapshot.driftHz = lastDriftHz;
        
        snapshot.cutoffFromEnv = lastCutoffFromEnv;
        snapshot.cutoffFromLfo = lastCutoffFromLfo;
        snapshot.cutoffFromDrift = lastCutoffFromDrift;
        snapshot.cutoffFromKeytrack = lastCutoffFromKeytrack;
        
        snapshot.envStage = 0;
        snapshot.sourceTag = 0;
        snapshot.flags = 0;
        
        return snapshot;
    }

    float SynthVoice::getCurrentOscFreqHz() const noexcept
    {
        return lastCalculatedFreq1;
    }

    void SynthVoice::setPortamentoTimeNormalized (float norm)
    {
        params.portaTime = norm;
    }

    void SynthVoice::setPortamentoModeRaw (int rawMode)
    {
        params.portaMode = rawMode;
    }

    void SynthVoice::setOscSyncEnabled (bool enabled)
    {
        params.oscSync = enabled;
    }

    void SynthVoice::setOsc2Pitch (float pitch)
    {
        params.osc2Pitch = pitch;
    }

    void SynthVoice::setOsc2Level (float level)
    {
        params.osc2Level = level;
    }
}
