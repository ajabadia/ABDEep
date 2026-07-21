#pragma once

#include <cstdint>

struct VoiceDiagnosticSnapshot
{
    int voiceIndex = -1;
    bool isActive = false;
    float noteNumber = 0.0f;
    float velocity = 0.0f;
    
    // Detuning y Pan
    float detuneSemitonesBase = 0.0f;
    float detuneSemitonesEffective = 0.0f;
    float panBase = 0.0f;
    float panEffective = 0.0f;
    
    // Filtro VCF/HPF
    float baseCutoffHz = 0.0f;
    float effectiveCutoffHz = 0.0f;
    float resonance = 0.0f;
    float envDepthSign = 0.0f;
    float keytrackHz = 0.0f;
    float hpfCutoffHz = 0.0f;
    
    float vcfCutoffBase = 0.0f;
    float vcfCutoffEffectiveHz = 0.0f;
    float vcfResonanceBase = 0.0f;
    float vcfResonanceEffective = 0.0f;
    float hpfCutoffBase = 0.0f;
    
    // Moduladores y LFO
    float lfo1Value = 0.0f;
    float lfo2Value = 0.0f;
    float env1Value = 0.0f;
    float env2Value = 0.0f;
    float driftHz = 0.0f;
    
    // Contribuciones intermedias al Cutoff
    float cutoffFromEnv = 0.0f;
    float cutoffFromLfo = 0.0f;
    float cutoffFromDrift = 0.0f;
    float cutoffFromKeytrack = 0.0f;
    
    int envStage = 0;
    
    // Identificador y estado
    int32_t sourceTag = 0;
    uint32_t flags = 0; // bits para freezeActive, deterministicCapture, etc.
};

struct EngineDiagnosticSnapshot
{
    VoiceDiagnosticSnapshot voiceSnapshots[12];
    int vcfOversample = 0;
    int vcfVoicingMode = 0;
    float driftAmount = 0.0f;
    
    float pitchBend = 0.0f;
    float modWheel = 0.0f;
    float aftertouch = 0.0f;
    float sustainPedal = 0.0f;
    float peakLevel = 0.0f;
    int voiceMode = 0;
    int polyChordNoteCount = 0;
    
    uint64_t timestamp = 0;
    uint64_t blockCounter = 0;
    juce::String activeCalibrationJson;
};
