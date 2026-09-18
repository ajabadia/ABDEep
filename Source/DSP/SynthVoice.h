#pragma once

#include <JuceHeader.h>
#include "OSC1.h"
#include "OSC2.h"
#include "Envelope.h"
#include "LFO.h"
#include "Filter.h"
#include "ModulationMatrix.h"
#include "DriftEngine.h"
#if DEEP_TARGET_MODEL >= 2
#include "MoogLadderVCF.h"
#include "KorgMS20VCF.h"
#endif
#include "../Core/CalibrationSpec.h"
#include "Core/DiagnosticSnapshots.h"

namespace ABD
{
    /**
     * SynthVoice representa una sola voz del sintetizador DeepMind (monofónica/polifónica).
     * Administra sus propios generadores de sonido, moduladores y filtros.
     */
    class SynthVoice
    {
    public:
        SynthVoice();
        ~SynthVoice() = default;

        void prepare(double sampleRate);
        void initializeVoicePersonality(int voiceSlotIndex);
        
        void startNote(int midiNoteNumber, float velocity, float voiceIndexNormalized);
        void stopNote(bool force = false);
        
        bool isActive() const { return env1VCA.isActive(); }
        int getMidiNote() const { return currentMidiNote; }
        int getRootNote() const { return rootNoteTriggered; }
        void setRootNote(int note) { rootNoteTriggered = note; }
        /** Envelope VCA en fase de Release (tier de robo por fase de caída). */
        bool isReleasing() const { return env1VCA.getCurrentStage() == Envelope::Stage::kRelease; }
        /** Nivel actual de la envolvente VCA (robo de la voz más cercana al silencio). */
        float getVcaEnvelopeLevel() const { return env1VCA.getCurrentLevel(); }

        /** Set immutable calibration snapshot for this block (called by SynthEngine) */
        void setCalibration(const CalibrationSpec* cal) { calibration = cal; }

        // Modulación externa (ModWheel, Aftertouch, PitchBend, etc.)
        void setExternalModulation(ModSource source, float value);

        // Configurar modo Mono/Spread para LFOs
        float lfo1MonoMode = 0.0f;  // normalized 0-1 (0=Poly, ~0.004=Mono, 0.008-1.0=Spread)
        float lfo2MonoMode = 0.0f;

        // Global Tune: offset en cents aplicado a ambos osciladores (propagado desde SynthEngine)
        float globalTuneCents = 0.0f;

        // Unison stacking — set before startNote()
        float unisonDetuneSemitones = 0.0f;  // detune offset for this voice in the stack
        float unisonPanPosition = 0.5f;      // 0=left, 0.5=center, 1.0=right
        float voicePanSpread = 0.0f;          // from VCA Pan Spread (0=centered, 1=full spread)

        // Portamento / Glide state
        float currentPortaPitch = 0.0f;       // current interpolated pitch (MIDI note + fraction)
        float targetPortaPitch = 0.0f;        // target MIDI note number (integer)
        float portaBasePitch = 0.0f;          // starting pitch at trigger time
        bool portaActive = false;             // true while glide is in progress

        // Hard Sync state
        double prevOsc1Phase = 0.0;           // previous sample's OSC1 phase (for wrap detection)

        // LFO trigger mode state (zero-crossing detection for envelope retrigger)
        float prevLfo1Sample = 0.0f;          // previous sample's LFO1 output (for zero-crossing detection)
        float prevLfo2Sample = 0.0f;          // previous sample's LFO2 output (for zero-crossing detection)

        // Arpeggiator clock frequency for LFO Arp Sync (propagated from SynthEngine)
        float arpClockHz = 1.0f;

        // LFO Arp Sync rates desde la tabla de Clock Divide del hardware (por-LFO, distintos entre sí)
        float lfo1ArpSyncHz = 1.0f;
        float lfo2ArpSyncHz = 1.0f;

        // Instantaneous modulated values (updated every sample in process sample)
        // Read from getVoiceState() in SynthEngine for real-time debug
        float lastModOsc1DetuneSemitones = 0.0f;  // total pitch modulation for OSC1 (pitchBend + pitchMod + drift + unison)
        float lastModOsc2DetuneSemitones = 0.0f;  // total pitch modulation for OSC2 (pitchBend + osc2Pitch + pitchMod + drift + unison)
        float lastModPan = 0.5f;                   // final pan value after modulation matrix
        float lastModVcfCutoffHz = 1000.0f;         // final VCF cutoff in Hz after all modulations

        // Procesamiento de un bloque de audio
        void process(juce::AudioBuffer<float>& outputBuffer, int startSample, int numSamples,
                     const ModulationMatrix& matrix,
                     const float* globalLfo1Buffer = nullptr,
                     const float* globalLfo2Buffer = nullptr,
                     float engineLfo1MonoMode = -1.0f,
                     float engineLfo2MonoMode = -1.0f);

        VoiceDiagnosticSnapshot getDiagnosticSnapshot(int voiceIndex) const;

        float getCurrentOscFreqHz() const noexcept;
        void setPortamentoTimeNormalized (float norm);
        void setPortamentoModeRaw (int rawMode);
        void setOscSyncEnabled (bool enabled);
        void setOsc2Pitch (float pitch);
        void setOsc2Level (float level);

    private:
        // Parámetros de calibración para el filtro (extraídos del CalibrationSpec)
        struct FilterCalibrationParams {
            float vcfMinHz, vcfCurveBase;
            float keytrackRefHz, keytrackAmountScale;
            float pitchBendCutoffScale;
            float hpfMinHz, hpfMaxHz, hpfModScaleHz;
            float cutoffDriftScale, resonanceDriftScale;
        };

        // Helpers extraídos de processSample para división modular
        // (SynthVoice_Pitch.cpp) — pitch modulation, portamento, osc generation
        float processOscillatorSection(const ModulationMatrix& matrix, int sampleIndex,
                                        const float* globalLfo1, const float* globalLfo2,
                                        float driftOsc1, float driftOsc2,
                                        float& freq1, float& freq2);

        // (SynthVoice_Filter.cpp) — VCF + HPF filtering con switching de modelo
        float processFilterSection(const ModulationMatrix& matrix, float combinedOsc, float freq1,
                                   float driftCutoff, float driftResonance, float velocityValue,
                                   const FilterCalibrationParams& cal);

        // (SynthVoice_VCA.cpp) — VCA amplification (Transparent / Ballsy)
        float processVCASection(float finalFiltered, float velocityValue,
                                const ModulationMatrix& matrix);

   
        double sampleRate = 44100.0;
        double invSampleRate = 0.0;  // cached 1/sampleRate (avoid per-sample division)
        float cutoffSmoothCoeff = 0.05f;  // per-sample coeff, recomputed in prepare() from DAW SR
        float ampSmoothCoeff = 0.05f;     // per-sample coeff, recomputed in prepare() from DAW SR
        // Cutoff/amp smoothing time constant in seconds. Legacy per-sample coeff
        // was 0.05 @ 44.1 kHz: tau = -1/(ln(1-0.05)·44100) = 0.0004421 s.
        static constexpr float kSmoothTauSec = 0.00044208f;
        int currentMidiNote = -1;
        int lastMidiNote = -1;  // preserved across force-stops (for portamento glide)
        int rootNoteTriggered = -1;  // root MIDI note that triggered this voice (for chord/poly release)
        float noteVelocity = 0.0f;
        float voiceIndex = 0.0f;

        // --- Voice personality: static tolerances (set once at init) ---
        float staticPitchOffset1 = 0.0f;   // cents, per-voice tuning tolerance
        float staticPitchOffset2 = 0.0f;   // cents
        float staticCutoffOffset = 0.0f;   // normalized -1..+1
        float staticResOffset = 0.0f;      // normalized -1..+1
        float staticEnvTimeOffset = 0.0f;  // normalized -1..+1

        // Per-voice white noise LCG seed (deterministic, no global std::rand())
        uint32_t noiseSeed = 0u;

        // Cached filter config (only update VCF when params change)
        int lastPoleMode = -1;
        int lastOversample = -1;
        int lastVcfVoicingMode = -1;
#if DEEP_TARGET_MODEL >= 2
        int lastVcfModel = -1;
        int lastMoogSubMode = -1;
        int lastKorgSubMode = -1;
#endif

        // Calibration snapshot (immutable per-block, set by SynthEngine)
        const CalibrationSpec* calibration = nullptr;

        // Módulos DSP
        OSC1 osc1;
        OSC2 osc2;
        VCF vcf;
#if DEEP_TARGET_MODEL >= 2
        MoogLadderVCF moogVcf;
        KorgMS20VCF korgVcf;
        int cachedVcfModel = 0;   // 0=OTA, 1=Moog, 2=Korg (tracks params.vcfModel)
#endif

        Envelope env1VCA;
        Envelope env2VCF;
        Envelope env3MOD;

        LFO lfo1;
        LFO lfo2;
        DriftEngine drift;

        // Sub Oscillator state (square wave, 1 octave below)
        double subPhase = 0.0;

        // Parameter smoothing & Voice Stealing anti-click
        float smoothedCutoffLvl = 1.0f;
        float smoothedAmpLevel = 1.0f;
        float stealingFadeGain = 1.0f;  // 1.0 normal, decrements to 0.0 when stolen

        // Caches for the per-sample cutoff pow(): the exp-smoothed cutoff level
        // (coeff 0.05) converges to a constant, so std::pow only needs to be
        // re-evaluated while it is still moving beyond epsilon.
        float lastSmoothedCutoffLvl = -1.0f;
        float lastCutoffHz = 0.0f;
        float lastCalVcfMinHz = 0.0f;
        float lastCalVcfCurveBase = 1.0f;
        // Diagnostic base-cutoff pow() cache (recomputed only when its inputs change)
        float lastDiagVcfMinHz = 0.0f;
        float lastDiagVcfCurveBase = 1.0f;
        float lastDiagVcfCutoff = -1.0f;

        // Valores instantáneos de las fuentes de modulación (24 fuentes)
        float modSources[(int)ModSource::kMaxSources];

        // Parámetros base del sintetizador (sincronizados desde el Engine)
        struct VoiceParams
        {
            // OSC
            bool osc1SawEnable = true;
            bool osc1PulseEnable = false;
            float osc1PwmAmount = 0.5f;
            int osc1Range = 1; // 0=16', 1=8', 2=4'
            float osc1PitchMod = 0.0f;
            int osc1PmSource = 0;         // 0-6: LFO1, LFO2, Env1, Env2, Env3, LFO1Uni, LFO2Uni
            int osc1PwmSource = 0;        // 0-5: Manual, LFO1, LFO2, Env1, Env2, Env3
            int osc1PmMode = 0;           // 0=OSC1+2, 1=OSC1 Only
            float osc1LfoAftertouch = 0.0f; // 0-1: depth for aftertouch → pitch mod
            float osc1LfoModwheel = 0.0f;   // 0-1: depth for mod wheel → pitch mod

            float osc2Pitch = 0.0f;
            float osc2ToneMod = 0.0f;
            float osc2Level = 0.5f;
            float osc2PitchMod = 0.0f;
            int osc2Range = 1;
            int osc2PmSource = 0;         // 0-6: LFO1, LFO2, Env1, Env2, Env3, LFO1Uni, LFO2Uni
            int osc2TpmSource = 0;        // 0-5: Manual, LFO1, LFO2, Env1, Env2, Env3
            float osc2AftertouchPitch = 0.0f; // 0-1: depth for aftertouch → pitch mod
            float osc2ModwheelPitch = 0.0f;   // 0-1: depth for mod wheel → pitch mod

            bool oscSync = false;
            float noiseLevel = 0.0f;
            float subLevel = 0.0f;   // 0-1, Sub Oscillator level (square wave, 1 octave down)

            // Filtros
            float vcfCutoff = 1.0f;
            float vcfResonance = 0.0f;
#if DEEP_TARGET_MODEL >= 2
            int vcfModel = 0;        // 0=DM12 OTA, 1=Moog Ladder, 2=Korg MS-20
            int vcfMoogSubMode = 0;  // 0=LP, 1=BP, 2=HP (Moog sub-type)
            int vcfKorgSubMode = 0;  // 0=K35 LP, 1=K35 HP (Korg sub-type)
#endif
            int vcfPoleMode = 1; // 24dB
            int vcfOversample = 1; // 1x/2x/4x oversampling
            int vcfVoicingMode = 0; // 0=DeepMind, 1=Juno106
            float vcfEnvDepth = 0.5f;
            float vcfEnvVel = 0.0f;
            float vcfLfoDepth = 0.0f;
            int vcfLfoSelect = 0;
            int vcfEnvPolarity = 1; // Normal
            float vcfKeyTrack = 0.0f;
            float vcfPitchBend = 0.0f;
            float vcfAftertouchLfo = 0.0f;  // 0-1: aftertouch → LFO depth on cutoff
            float vcfModwheelLfo = 0.0f;     // 0-1: mod wheel → LFO depth on cutoff

            float hpfCutoff = 20.0f;
            bool hpfBassBoost = false;
            float hpfBassBoostGain = 1.0f;

            // VCA
            float vcaLevel = 0.8f;
            int vcaMode = 0; // Transparent
            float vcaEnvDepth = 1.0f;
            float vcaVelSens = 0.0f;

            // Analog Drift
            float voiceDrift = 0.0f;  // 0-1, pitch instability
            float paramDrift = 0.0f;  // 0-1, filter/env instability
            float driftRate = 0.0f;   // 0-1, speed of drift fluctuations

            // Portamento / Glide
            float portaTime = 0.0f;   // 0-1, glide time
            int portaMode = 0;         // 0-9, mode selector
            float portaOscBal = 0.0f;  // -128..127, OSC1/OSC2 balance during glide

            // Pitch Bend Range (semitonos)
            float pitchBendUp = 2.0f;   // 0-24, max upward bend
            float pitchBendDown = 2.0f; // 0-24, max downward bend

            // Trigger Mode & Key Reset
            int triggerMode = 0;       // 0=Mono, 1=Retrig, 2=Legato, 3=One-shot
            bool oscKeyReset = false;  // reset oscillator phase on key down

            // Envelope trigger modes (0=Key, 1=LFO1, 2=LFO2, 3=Loop, 4=Seq)
            int env1TriggerMode = 0;   // ENV1 (VCA) trigger mode
            int env2TriggerMode = 0;   // ENV2 (VCF) trigger mode
            int env3TriggerMode = 0;   // ENV3 (MOD) trigger mode

            // LFO Arp Sync
            bool lfo1ArpSync = false;  // LFO1 sync to arpeggiator clock
            bool lfo2ArpSync = false;  // LFO2 sync to arpeggiator clock
        } params;

        // Variables para diagnóstico (Diagnostic Trace)
        float lastBaseCutoffHz = 0.0f;
        float lastEffectiveCutoffHz = 0.0f;
        float lastVcfResonance = 0.0f;
        float lastEnvDepthSign = 0.0f;
        float lastKeytrackHz = 0.0f;
        float lastHpfCutoffHz = 0.0f;
        
        float lastLfo1Value = 0.0f;
        float lastLfo2Value = 0.0f;
        float lastEnv1Value = 0.0f;
        float lastEnv2Value = 0.0f;
        float lastDriftHz = 0.0f;
        float lastCalculatedFreq1 = 440.0f;
        
        float lastCutoffFromEnv = 0.0f;
        float lastCutoffFromLfo = 0.0f;
        float lastCutoffFromDrift = 0.0f;
        float lastCutoffFromKeytrack = 0.0f;

        friend class SynthEngine;
        friend class SynthEngineRapidSweepTests;

        void updateModulationSources(int sampleIndex = 0,
                                      const float* globalLfo1 = nullptr,
                                      const float* globalLfo2 = nullptr);
        float processSample(const ModulationMatrix& matrix,
                            int sampleIndex = 0,
                            const float* globalLfo1 = nullptr,
                            const float* globalLfo2 = nullptr);
    };
}
