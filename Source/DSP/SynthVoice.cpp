#include "SynthVoice.h"
#include <cmath>
#if DEEP_TARGET_MODEL >= 2
#include "../Core/CalibrationSpec.h"
#endif

namespace ABD
{
    SynthVoice::SynthVoice()
    {
        std::fill(std::begin(modSources), std::end(modSources), 0.0f);
    }

    void SynthVoice::initializeVoicePersonality(int voiceSlotIndex)
    {
        // Deterministic per-voice LCG: no global std::rand() pollution
        uint32_t seed = (uint32_t)(voiceSlotIndex * 7919 + 104729);
        auto nextRand = [&]() -> float {
            seed = seed * 1664525u + 1013904223u;
            return (float)(seed & 0xFFFF) / 65535.0f; // 0..1
        };

        // Pitch: ±1.5 cents — enough for voice personality without detuning
        staticPitchOffset1 = (nextRand() - 0.5f) * 3.0f;
        staticPitchOffset2 = (nextRand() - 0.5f) * 3.0f;

        // Cutoff: ±3% of normalized range
        staticCutoffOffset = (nextRand() - 0.5f) * 0.06f;

        // Resonance: ±2%
        staticResOffset = (nextRand() - 0.5f) * 0.04f;

        // Env time: ±8%
        staticEnvTimeOffset = (nextRand() - 0.5f) * 0.16f;
    }

    void SynthVoice::prepare(double newSampleRate)
    {
        sampleRate = newSampleRate;
        osc1.prepare(sampleRate);
        osc2.prepare(sampleRate);
        vcf.prepare(sampleRate);
        hpf.prepare(sampleRate);
        env1VCA.setSampleRate(sampleRate);
        env2VCF.setSampleRate(sampleRate);
        env3MOD.setSampleRate(sampleRate);
        lfo1.setSampleRate(sampleRate);
        lfo2.setSampleRate(sampleRate);
        drift.setSampleRate(sampleRate);
    }

    // ========== Internal: calculate glide rate from portaTime and portaMode ==========
    static float calcGlideRate(float portaTime, int portaMode, float intervalSemitones, float sampleRate)
    {
        // portaTime=0 → instant (rate=1.0). portaTime=1 → tau=5s exponential glide
        if (portaTime <= 0.0f)
            return 1.0f;

        float tau = portaTime * 5.0f; // time constant: 0→0s, 1→5s

        bool isFixRate = (portaMode == 2 || portaMode == 3
                       || portaMode == 6 || portaMode == 7
                       || portaMode == 8 || portaMode == 9);

        if (isFixRate)
        {
            // Linear interpolation: constant semitones per sample
            // Normalized so a 12-semitone interval takes tau seconds
            float ratePerSample = 12.0f / (tau * sampleRate);
            return ratePerSample;
        }

        // Exponential modes (0,1,4,5): rate is multiplier on remaining distance
        float rate = 1.0f - std::exp(-1.0f / (tau * sampleRate));

        // Exp modes (4, 5): quadratic curve for exponential feel (starts slow, ends fast)
        if (portaMode == 4 || portaMode == 5)
            rate = rate * rate;

        return rate;
    }

    void SynthVoice::startNote(int midiNoteNumber, float velocity, float voiceIndexNormalized)
    {
        // Usar currentMidiNote si es válido (legato normal), o lastMidiNote (preservado por force-stop)
        float previousPitch = ((float)currentMidiNote >= 0.0f)
            ? (float)currentMidiNote
            : (float)lastMidiNote;
        bool wasActive = isActive();

        // Preservar para futuros force-stops antes de sobrescribir
        lastMidiNote = currentMidiNote;
        currentMidiNote = midiNoteNumber;
        noteVelocity = velocity;
        voiceIndex = voiceIndexNormalized;

        // --- Portamento / Glide initialization ---
        targetPortaPitch = (float)midiNoteNumber;

        bool hadPreviousNote = (previousPitch >= 0.0f);   // hubo nota anterior (incluso si force-stopped)
        bool isLegato = hadPreviousNote && wasActive;       // legato si la voz sigue activa
        bool isFingeredMode = (params.portaMode == 1 || params.portaMode == 3 || params.portaMode == 5);

        if (params.portaTime <= 0.0f || !hadPreviousNote)
        {
            // Sin nota anterior: salto directo (no puede glidear hacia ningún lado)
            currentPortaPitch = targetPortaPitch;
            portaActive = false;
        }
        else if (isFingeredMode && !isLegato)
        {
            // Fingered + staccato: salto directo (glide solo en legato)
            currentPortaPitch = targetPortaPitch;
            portaActive = false;
        }
        else
        {
            // Normal / Fix-Rate / Exp / Fingered+Legato: glide desde la nota anterior
            currentPortaPitch = previousPitch;
            // Fixed+N pre-glide offset
            if (params.portaMode == 6)      currentPortaPitch += 2.0f;
            else if (params.portaMode == 7) currentPortaPitch -= 2.0f;
            else if (params.portaMode == 8) currentPortaPitch += 5.0f;
            else if (params.portaMode == 9) currentPortaPitch -= 5.0f;
            else if (params.portaMode == 10) currentPortaPitch += 12.0f;
            else if (params.portaMode == 11) currentPortaPitch -= 12.0f;
            else if (params.portaMode == 12) currentPortaPitch += 24.0f;
            else if (params.portaMode == 13) currentPortaPitch -= 24.0f;
            portaActive = true;
        }

        // Trigger Mode: Legato mode doesn't retrigger envelopes on overlapping notes
        // Retrig mode always retriggers (even on legato), same as Mono mode
        // Mono mode: standard retrigger (current behavior)
        bool doTriggerEnvs = true;
        if (params.triggerMode == 2 && isLegato)      // Legato mode + legato note: don't retrigger
            doTriggerEnvs = false;

        if (doTriggerEnvs)
        {
            env1VCA.trigger();
            env2VCF.trigger();
            env3MOD.trigger();
        }

        // Resetear estado de zero-crossing de LFOs para esta nota
        prevLfo1Sample = 0.0f;
        prevLfo2Sample = 0.0f;

        // En modo Poly (mono_mode=0), resetear LFOs normalmente.
        // En Mono (raw=1), el LFO local no avanza — usa valor global.
        // En Spread (raw>=2), fijar offset de fase inicial por voz.
        int rawLfo1MM = std::min(255, std::max(0, (int)std::round(lfo1MonoMode * 255.0f)));
        int rawLfo2MM = std::min(255, std::max(0, (int)std::round(lfo2MonoMode * 255.0f)));
        
        if (rawLfo1MM == 0)
            lfo1.trigger();
        else if (rawLfo1MM >= 2)
        {
            // Spread: offset de fase por voz, setPhase ya normaliza a [0,1)
            float spreadRaw = (float)(rawLfo1MM - 1) / 254.0f;
            double spreadCycles = spreadRaw * 4.0;
            lfo1.setPhase(voiceIndex * spreadCycles);
        }
        
        if (rawLfo2MM == 0)
            lfo2.trigger();
        else if (rawLfo2MM >= 2)
        {
            float spreadRaw = (float)(rawLfo2MM - 1) / 254.0f;
            double spreadCycles = spreadRaw * 4.0;
            lfo2.setPhase(voiceIndex * spreadCycles);
        }

        // OSC Key Down Reset: reiniciar fase de osciladores al presionar tecla
        if (params.oscKeyReset)
        {
            osc1.resetPhase();
            osc2.resetPhase();
            subPhase = 0.0;
        }

        prevOsc1Phase = osc1.getPhase();

        // Inicializar drift analógico para esta nota
        drift.resetForNote(voiceIndex);

        modSources[(int)ModSource::kNoteNumber] = (float)midiNoteNumber / 127.0f;
        modSources[(int)ModSource::kVelocity] = velocity;
        modSources[(int)ModSource::kVoiceNumber] = voiceIndex;
    }

    void SynthVoice::stopNote(bool force)
    {
        if (force)
        {
            // Preservar la nota antes de limpiar (necesario para Portamento en modo Mono)
            lastMidiNote = currentMidiNote;
            env1VCA.reset();
            env2VCF.reset();
            env3MOD.reset();
            currentMidiNote = -1;
        }
        else
        {
            // One-shot mode: ignore note-off, let envelope complete full cycle
            if (params.triggerMode != 3)
            {
                env1VCA.release();
                env2VCF.release();
                env3MOD.release();
            }
        }
    }

    void SynthVoice::setExternalModulation(ModSource source, float value)
    {
        int idx = (int)source;
        if (idx >= 0 && idx < (int)ModSource::kMaxSources)
        {
            modSources[idx] = value;
        }
    }

    void SynthVoice::updateModulationSources(int sampleIndex,
                                              const float* globalLfo1,
                                              const float* globalLfo2)
    {
        // Arp Sync: si está activo, override del rate del LFO con el clock del arpegiador
        if (params.lfo1ArpSync)
            lfo1.setRate(arpClockHz);

        // 1. Decidir LFO1: local o global según mono_mode
        //    raw=0 → Poly (LFO local independiente, comportamiento por defecto)
        //    raw=1 → Mono (usa valor del LFO global — misma salida para todas las voces)
        //    raw≥2 → Spread (LFO local con offset de fase inicial fijado en startNote)
        int rawLfo1MM = std::min(255, std::max(0, (int)std::round(lfo1MonoMode * 255.0f)));
        if (rawLfo1MM == 0)
        {
            modSources[(int)ModSource::kLFO1] = lfo1.nextSample();
        }
        else if (rawLfo1MM == 1 && globalLfo1 != nullptr)
        {
            // Mono: usar el valor precalculado del LFO global (mismo para todas las voces)
            modSources[(int)ModSource::kLFO1] = globalLfo1[sampleIndex];
        }
        else
        {
            // Spread: el offset de fase ya se fijó en startNote, solo avanzar
            modSources[(int)ModSource::kLFO1] = lfo1.nextSample();
        }
        modSources[(int)ModSource::kLFO1Uni] = modSources[(int)ModSource::kLFO1] * 0.5f + 0.5f;

        // Arp Sync para LFO2
        if (params.lfo2ArpSync)
            lfo2.setRate(arpClockHz);

        // 2. Decidir LFO2: mismo esquema que LFO1
        int rawLfo2MM = std::min(255, std::max(0, (int)std::round(lfo2MonoMode * 255.0f)));
        if (rawLfo2MM == 0)
        {
            modSources[(int)ModSource::kLFO2] = lfo2.nextSample();
        }
        else if (rawLfo2MM == 1 && globalLfo2 != nullptr)
        {
            modSources[(int)ModSource::kLFO2] = globalLfo2[sampleIndex];
        }
        else
        {
            modSources[(int)ModSource::kLFO2] = lfo2.nextSample();
        }
        modSources[(int)ModSource::kLFO2Uni] = modSources[(int)ModSource::kLFO2] * 0.5f + 0.5f;

        // Detectar zero-crossing de LFOs para re-trigger de envolventes
        // (LFO trigger modes 1=LFO1, 2=LFO2)
        float lfo1Sample = modSources[(int)ModSource::kLFO1];
        float lfo2Sample = modSources[(int)ModSource::kLFO2];

        if (prevLfo1Sample < 0.0f && lfo1Sample >= 0.0f)
        {
            if (params.env1TriggerMode == 1) env1VCA.trigger();
            if (params.env2TriggerMode == 1) env2VCF.trigger();
            if (params.env3TriggerMode == 1) env3MOD.trigger();
        }
        if (prevLfo2Sample < 0.0f && lfo2Sample >= 0.0f)
        {
            if (params.env1TriggerMode == 2) env1VCA.trigger();
            if (params.env2TriggerMode == 2) env2VCF.trigger();
            if (params.env3TriggerMode == 2) env3MOD.trigger();
        }
        prevLfo1Sample = lfo1Sample;
        prevLfo2Sample = lfo2Sample;

        // 4. Avanzar drift analógico una muestra
        drift.nextSample();

        modSources[(int)ModSource::kEnv1VCA] = env1VCA.nextSample();
        modSources[(int)ModSource::kEnv2VCF] = env2VCF.nextSample();
        modSources[(int)ModSource::kEnv3MOD] = env3MOD.nextSample();
    }

    float SynthVoice::processSample(const ModulationMatrix& matrix,
                                     int sampleIndex,
                                     const float* globalLfo1,
                                     const float* globalLfo2)
    {
        // Immutable calibration for this block (set by SynthEngine per-block)
#if DEEP_TARGET_MODEL >= 2
        static const CalibrationSpec kDefaultCal = CalibrationSpec::factoryDefaults();
        const auto& cal = (calibration != nullptr) ? *calibration : kDefaultCal;
#else
        struct FallbackCal {
            struct { struct { float minHz, maxHz, curveBase; } vcfCutoff;
                     struct { float referenceHz, amountScale; } vcfKeytrack;
                     struct { float cutoffScale; } vcfPitchBend;
                     struct { float minHz, maxHz, modScaleHz, bassBoostGain; } hpf;
                     struct { float driftToTimeScale, minTimeSec, exponentialBase; } envelopes;
                     struct { float rateScale, rateExp; } lfo; } transfer;
            struct { float staticPitchCentsRange, staticCutoffNormRange, staticResNormRange,
                          staticEnvTimeNormRange, cutoffDriftScale, resonanceDriftScale; } voice;
        };
        static const FallbackCal cal = {
            { { 50.f, 20000.f, 400.f },
              { 261.63f, 1.f },
              { 0.3f },
              { 40.f, 2000.f, 18000.f, 12.f },
              { 0.3f, 0.002f, 32768.f },
              { 0.041f, 7.3747f } },
            { 1.5f, 0.03f, 0.02f, 0.08f, 1.f, 1.f }
        };
#endif

        // 0. Obtener valores de drift analógico para esta muestra (dynamic + static)
        float driftOsc1 = drift.getOsc1PitchDrift() + staticPitchOffset1;
        float driftOsc2 = drift.getOsc2PitchDrift() + staticPitchOffset2;
        float driftCutoff = drift.getVcfCutoffDrift() + staticCutoffOffset;
        float driftResonance = drift.getVcfResonanceDrift() + staticResOffset;

        // 1. Aplicar envTimeDrift a las envolventes antes de avanzar
        //    El drift escala la velocidad: ±30% máximo cuando paramDrift=1.0
        float driftEnvScale = 1.0f + (drift.getEnvTimeDrift() + staticEnvTimeOffset) * cal.transfer.envelopes.driftToTimeScale;
        env1VCA.setTimeScale(driftEnvScale);
        env2VCF.setTimeScale(driftEnvScale);
        env3MOD.setTimeScale(driftEnvScale);

        // Sincronizar loop mode desde params (puede cambiar mid-note vía updateParameters)
        env1VCA.setLoopMode(params.env1TriggerMode == 3);
        env2VCF.setLoopMode(params.env2TriggerMode == 3);
        env3MOD.setLoopMode(params.env3TriggerMode == 3);

        // 2. Actualizar envolventes y LFOs (con soporte Mono/Spread)
        updateModulationSources(sampleIndex, globalLfo1, globalLfo2);

        // 2. Resolver modulaciones de Pitch
        float osc1PitchMod = matrix.getModulationValue(ModDestination::kOsc1Pitch, modSources) * 12.0f; // +-1 octava
        float osc2PitchMod = matrix.getModulationValue(ModDestination::kOsc2Pitch, modSources) * 12.0f;

        // --- Dedicated OSC1 pitch modulation (osc1_pm_source + osc1_pitch_mod) ---
        float osc1DedicatedPitchSrc = 0.0f;
        switch (params.osc1PmSource)
        {
            case 0:  osc1DedicatedPitchSrc = modSources[(int)ModSource::kLFO1];    break;
            case 1:  osc1DedicatedPitchSrc = modSources[(int)ModSource::kLFO2];    break;
            case 2:  osc1DedicatedPitchSrc = modSources[(int)ModSource::kEnv1VCA]; break;
            case 3:  osc1DedicatedPitchSrc = modSources[(int)ModSource::kEnv2VCF]; break;
            case 4:  osc1DedicatedPitchSrc = modSources[(int)ModSource::kEnv3MOD]; break;
            case 5:  osc1DedicatedPitchSrc = modSources[(int)ModSource::kLFO1Uni]; break;
            case 6:  osc1DedicatedPitchSrc = modSources[(int)ModSource::kLFO2Uni]; break;
            default: break;
        }
        float osc1DedicatedPitchMod = osc1DedicatedPitchSrc * params.osc1PitchMod * 12.0f;

        // Aftertouch → Pitch Mod (depth scaled by osc1_lfo_aftertouch)
        float aftertouchPitchMod = params.osc1LfoAftertouch * modSources[(int)ModSource::kKeyPressure] * 12.0f;

        // Mod Wheel → Pitch Mod (depth scaled by osc1_lfo_modwheel)
        float modWheelPitchMod = params.osc1LfoModwheel * modSources[(int)ModSource::kModWheel] * 12.0f;

        // osc1_pm_mode: 0=OSC1+2 (apply extra mod to both), 1=OSC1 Only
        float osc1ExtraPitchMod = osc1DedicatedPitchMod + aftertouchPitchMod + modWheelPitchMod;
        float osc2ExtraPitchMod = (params.osc1PmMode == 0) ? osc1ExtraPitchMod : 0.0f;

        osc1PitchMod += osc1ExtraPitchMod;
        osc2PitchMod += osc2ExtraPitchMod;

        // --- Dedicated OSC2 pitch modulation (osc2_pm_source + osc2_pitch_mod) ---
        float osc2DedicatedPitchSrc = 0.0f;
        switch (params.osc2PmSource)
        {
            case 0:  osc2DedicatedPitchSrc = modSources[(int)ModSource::kLFO1];    break;
            case 1:  osc2DedicatedPitchSrc = modSources[(int)ModSource::kLFO2];    break;
            case 2:  osc2DedicatedPitchSrc = modSources[(int)ModSource::kEnv1VCA]; break;
            case 3:  osc2DedicatedPitchSrc = modSources[(int)ModSource::kEnv2VCF]; break;
            case 4:  osc2DedicatedPitchSrc = modSources[(int)ModSource::kEnv3MOD]; break;
            case 5:  osc2DedicatedPitchSrc = modSources[(int)ModSource::kLFO1Uni]; break;
            case 6:  osc2DedicatedPitchSrc = modSources[(int)ModSource::kLFO2Uni]; break;
            default: break;
        }
        float osc2DedicatedPitchMod = osc2DedicatedPitchSrc * params.osc2PitchMod * 12.0f;

        // Aftertouch → Pitch Mod for OSC2 (depth scaled by osc2_aftertouch_pitch)
        float osc2AftertouchPitchMod = params.osc2AftertouchPitch * modSources[(int)ModSource::kKeyPressure] * 12.0f;

        // Mod Wheel → Pitch Mod for OSC2 (depth scaled by osc2_modwheel_pitch)
        float osc2ModwheelPitchMod = params.osc2ModwheelPitch * modSources[(int)ModSource::kModWheel] * 12.0f;

        osc2PitchMod += osc2DedicatedPitchMod + osc2AftertouchPitchMod + osc2ModwheelPitchMod;

        // Pitch base de la nota + Portamento / Pitch Bend externo (rango asimétrico configurable)
        float rawPitchBend = modSources[(int)ModSource::kPitchBend]; // -1..1
        float pitchBendAmount = (rawPitchBend >= 0.0f)
            ? rawPitchBend * params.pitchBendUp
            : rawPitchBend * params.pitchBendDown;

        // Drift analógico: convertir cents drift a semitonos (100 cents = 1 semitono)
        float osc1DriftSemitones = driftOsc1 / 100.0f;
        float osc2DriftSemitones = driftOsc2 / 100.0f;

        // Global Tune (cents → semitonos) aplicado a ambos osciladores
        float globalTuneSemitones = globalTuneCents / 100.0f;

        // Almacenar valores modulados instantáneos para el DebugPanel
        lastModOsc1DetuneSemitones = pitchBendAmount + osc1PitchMod + osc1DriftSemitones + unisonDetuneSemitones + globalTuneSemitones;
        lastModOsc2DetuneSemitones = pitchBendAmount + params.osc2Pitch + osc2PitchMod + osc2DriftSemitones + unisonDetuneSemitones + globalTuneSemitones;

        // --- Portamento / Glide: interpolar pitch nota a nota ---
        float portaBasePitch = (float)currentMidiNote;
        if (portaActive)
        {
            float interval = std::abs(targetPortaPitch - currentPortaPitch);
            float glideRate = calcGlideRate(params.portaTime, params.portaMode, interval, (float)sampleRate);

            bool isFixRate = (params.portaMode == 2 || params.portaMode == 3
                           || params.portaMode == 6 || params.portaMode == 7
                           || params.portaMode == 8 || params.portaMode == 9);

            if (isFixRate)
            {
                // Linear: constant semitones per sample regardless of interval
                float direction = (targetPortaPitch > currentPortaPitch) ? 1.0f : -1.0f;
                currentPortaPitch += direction * glideRate;
            }
            else
            {
                // Exponential: rate is multiplier on remaining distance
                currentPortaPitch += (targetPortaPitch - currentPortaPitch) * glideRate;
            }

            if (std::abs(currentPortaPitch - targetPortaPitch) < 0.001f)
            {
                currentPortaPitch = targetPortaPitch;
                portaActive = false;
            }
            portaBasePitch = currentPortaPitch;
        }
        else
        {
            currentPortaPitch = targetPortaPitch;
        }

        // Oscillator balance during glide (porta_osc_bal)
        // -128 = only OSC2 glides, 0 = both glide, +127 = only OSC1 glides
        float balNorm = std::clamp(params.portaOscBal / 127.0f, -1.0f, 1.0f);
        float osc1GlideAmount = (balNorm + 1.0f) * 0.5f;    // -1→0.0, 0→0.5, +1→1.0
        float osc2GlideAmount = 1.0f - osc1GlideAmount;     // 1.0→0.0

        // Manual lerp (C++17 compatible): result = a + (b - a) * t
        auto manualLerp = [](float a, float b, float t) { return a + (b - a) * t; };

        float osc1EffectivePitch = portaActive
            ? manualLerp(targetPortaPitch, portaBasePitch, osc1GlideAmount)
            : (float)currentMidiNote;
        float osc2EffectivePitch = portaActive
            ? manualLerp(targetPortaPitch, portaBasePitch, osc2GlideAmount)
            : (float)currentMidiNote;

        float osc1Note = osc1EffectivePitch + lastModOsc1DetuneSemitones;
        float osc2Note = osc2EffectivePitch + lastModOsc2DetuneSemitones;

        // Ajuste de rango (16', 8', 4')
        if (params.osc1Range == 0) osc1Note -= 12.0f;
        else if (params.osc1Range == 2) osc1Note += 12.0f;

        if (params.osc2Range == 0) osc2Note -= 12.0f;
        else if (params.osc2Range == 2) osc2Note += 12.0f;

        // Frecuencia final en Hz
        float freq1 = 440.0f * std::pow(2.0f, (osc1Note - 69.0f) / 12.0f);
        float freq2 = 440.0f * std::pow(2.0f, (osc2Note - 69.0f) / 12.0f);

        lastCalculatedFreq1 = freq1;

        osc1.setFrequency(freq1);
        osc2.setFrequency(freq2);

        // 3. Modulación PWM en OSC1 (con selección de fuente)
        float pwmSourceValue = 0.0f;
        if (params.osc1PwmSource > 0)
        {
            switch (params.osc1PwmSource)
            {
                case 1:  pwmSourceValue = modSources[(int)ModSource::kLFO1];    break;
                case 2:  pwmSourceValue = modSources[(int)ModSource::kLFO2];    break;
                case 3:  pwmSourceValue = modSources[(int)ModSource::kEnv1VCA]; break;
                case 4:  pwmSourceValue = modSources[(int)ModSource::kEnv2VCF]; break;
                case 5:  pwmSourceValue = modSources[(int)ModSource::kEnv3MOD]; break;
                default: break;
            }
        }
        float pwmMod = matrix.getModulationValue(ModDestination::kOsc1SquareWidth, modSources);
        float pwmBase = (params.osc1PwmSource == 0) ? params.osc1PwmAmount : 0.5f;
        float pwmModulation = (params.osc1PwmSource > 0) ? pwmSourceValue * params.osc1PwmAmount * 0.5f : 0.0f;
        float pwmTotal = std::clamp(pwmBase + pwmModulation + pwmMod, 0.01f, 0.99f);
        osc1.setModulationValue((int)Oscillator::ModulationDestination::kPWM, pwmTotal);

        // Modulación Tone Mod en OSC2 (con selección de fuente)
        float toneModSourceValue = 0.0f;
        if (params.osc2TpmSource > 0)
        {
            switch (params.osc2TpmSource)
            {
                case 1:  toneModSourceValue = modSources[(int)ModSource::kLFO1];    break;
                case 2:  toneModSourceValue = modSources[(int)ModSource::kLFO2];    break;
                case 3:  toneModSourceValue = modSources[(int)ModSource::kEnv1VCA]; break;
                case 4:  toneModSourceValue = modSources[(int)ModSource::kEnv2VCF]; break;
                case 5:  toneModSourceValue = modSources[(int)ModSource::kEnv3MOD]; break;
                default: break;
            }
        }
        float toneMod = matrix.getModulationValue(ModDestination::kOsc2ToneMod, modSources);
        float toneModBase = (params.osc2TpmSource == 0) ? params.osc2ToneMod : 0.0f;
        float toneModModulation = (params.osc2TpmSource > 0) ? toneModSourceValue * params.osc2ToneMod * 0.5f : 0.0f;
        osc2.setModulationValue((int)Oscillator::ModulationDestination::kToneMod, std::clamp(toneModBase + toneModModulation + toneMod, 0.0f, 1.0f));

        // Configuración de actividad de osciladores
        osc1.setSawActive(params.osc1SawEnable);
        osc1.setSquareActive(params.osc1PulseEnable);

        // Generar muestras de osciladores
        float osc1VolMod = matrix.getModulationValue(ModDestination::kOsc1Level, modSources);
        float osc2VolMod = matrix.getModulationValue(ModDestination::kOsc2Level, modSources);
        float noiseVolMod = matrix.getModulationValue(ModDestination::kNoiseLevel, modSources);
        float subVolMod = matrix.getModulationValue(ModDestination::kSubOscLevel, modSources);

        float osc1Sample = osc1.nextSample() * std::clamp(1.0f + osc1VolMod, 0.0f, 1.0f);
        float osc2Sample = osc2.nextSample() * std::clamp(params.osc2Level + osc2VolMod, 0.0f, 1.0f);

        // --- Sub Oscillator: onda cuadrada 1 octava abajo ---
        // La frecuencia es la mitad de osc1 (freq1 / 2 = una octava abajo)
        subPhase += (freq1 * 0.5) / sampleRate;
        if (subPhase >= 1.0) subPhase -= 1.0;
        float subSample = (subPhase < 0.5) ? 1.0f : -1.0f;
        subSample *= std::clamp(params.subLevel + subVolMod, 0.0f, 1.0f);

        // --- Hard Sync: detectar wrap de fase de OSC1 (Master) y resetear OSC2 (Slave) ---
        if (params.oscSync)
        {
            double osc1Phase = osc1.getPhase();
            // Phase wrapped: fase anterior > fase actual tras nextSample()
            if (osc1Phase < prevOsc1Phase)
                osc2.resetPhase();
            prevOsc1Phase = osc1Phase;
        }

        // Generador de ruido simple
        float noiseSample = (-1.0f + 2.0f * ((float)std::rand() / (float)RAND_MAX)) * std::clamp(params.noiseLevel + noiseVolMod, 0.0f, 1.0f);

        // Option B: Inject test tone before VCF
        float combinedOsc = osc1Sample + osc2Sample + subSample + noiseSample;

        // 4. Filtrado VCF Pasa-Bajos
        float vcfCutoffMod = matrix.getModulationValue(ModDestination::kFilterCutoff, modSources);
        
        // Sumar modulación física de envolvente interna de JUCE si existe
        float env2Value = modSources[(int)ModSource::kEnv2VCF];
        
        // VCF Env Velocity Sensitivity: la velocity escala la profundidad del envelope VCF
        float velocityValue = modSources[(int)ModSource::kVelocity];

        // vcfEnvDepth es bipolar: 0.0=−100%, 0.5=0% (centro), 1.0=+100%
        // Convertir a signed [-1,+1] antes de aplicar polarity toggle
        const float signedEnvDepth = (params.vcfEnvDepth - 0.5f) * 2.0f;
        // Polaridad: Normal=+1, Inverted=−1 (botón INVERT del hardware)
        float polarityScale = (params.vcfEnvPolarity == 1) ? 1.0f : -1.0f;
        float effectiveEnvDepth = signedEnvDepth * polarityScale;
        float velScaledEnvDepth = effectiveEnvDepth * (1.0f - params.vcfEnvVel + params.vcfEnvVel * velocityValue);
        
        // VCF Pitch Bend Depth: el pitch bend modula el cutoff
        float pitchBendValue = modSources[(int)ModSource::kPitchBend];
        float pitchBendCutoffMod = pitchBendValue * params.vcfPitchBend * cal.transfer.vcfPitchBend.cutoffScale;
        
        float lfoCutoffDepth = params.vcfLfoDepth;
        float lfoValue = (params.vcfLfoSelect == 0) ? modSources[(int)ModSource::kLFO1] : modSources[(int)ModSource::kLFO2];

        // Drift analógico del filtro: pequeña fluctuación en cutoff y resonancia
        float cutoffDriftMod = driftCutoff * params.paramDrift * cal.voice.cutoffDriftScale;
        float resonanceDriftMod = driftResonance * params.paramDrift * cal.voice.resonanceDriftScale;

        // LFO depth modulado por Aftertouch y Mod Wheel
        float lfoDepthFromAftertouch = params.vcfAftertouchLfo * modSources[(int)ModSource::kKeyPressure];
        float lfoDepthFromModwheel = params.vcfModwheelLfo * modSources[(int)ModSource::kModWheel];
        float totalLfoDepth = lfoCutoffDepth + lfoDepthFromAftertouch + lfoDepthFromModwheel;

        // Mapeo musical logarítmico del Cutoff (calibrado)
        float cutoffLvl = params.vcfCutoff + vcfCutoffMod + (env2Value * velScaledEnvDepth) + (lfoValue * totalLfoDepth) + pitchBendCutoffMod + cutoffDriftMod;
        cutoffLvl = std::clamp(cutoffLvl, 0.0f, 1.0f);
        float cutoffHz = cal.transfer.vcfCutoff.minHz * std::pow(cal.transfer.vcfCutoff.curveBase, cutoffLvl);

        // Keytracking del filtro
        float keyTrackHz = (freq1 - cal.transfer.vcfKeytrack.referenceHz) * params.vcfKeyTrack * cal.transfer.vcfKeytrack.amountScale;
        cutoffHz = std::clamp(cutoffHz + keyTrackHz, 10.0f, (float)(sampleRate * 0.45));
        // Almacenar cutoff modulado para el DebugPanel
        lastModVcfCutoffHz = cutoffHz;

        // Only update pole mode / oversample / voicing mode when params change (not per-sample)
        if (params.vcfPoleMode != lastPoleMode)
        {
            vcf.setPoleMode(params.vcfPoleMode);
            lastPoleMode = params.vcfPoleMode;
        }
#if DEEP_TARGET_MODEL >= 2
        int effectiveOversample = params.vcfOversample == 0 ? 1 : params.vcfOversample == 1 ? 2 : 4;
        if (effectiveOversample != lastOversample)
        {
            vcf.setOversample(effectiveOversample);
            lastOversample = effectiveOversample;
        }
#endif
        if (params.vcfVoicingMode != lastVcfVoicingMode)
        {
            vcf.setMode(params.vcfVoicingMode == 0 ? JunoVCF_ZDF::Mode::DeepMind : JunoVCF_ZDF::Mode::Juno106);
            lastVcfVoicingMode = params.vcfVoicingMode;
        }
        vcf.setCutoff(cutoffHz);
        
        float filterResMod = matrix.getModulationValue(ModDestination::kFilterResonance, modSources);
        vcf.setResonance(std::clamp(params.vcfResonance + filterResMod + resonanceDriftMod, 0.0f, 1.0f));

        float filtered = vcf.process(combinedOsc);

        // 5. Filtrado HPF Pasa-Altos
        float hpfCutoffMod = matrix.getModulationValue(ModDestination::kFilterHPFCutoff, modSources);
        float hpfCutoffHz = std::clamp(params.hpfCutoff + hpfCutoffMod * cal.transfer.hpf.modScaleHz, cal.transfer.hpf.minHz, cal.transfer.hpf.maxHz);
        hpf.setCutoff(hpfCutoffHz);
        hpf.setBassBoostActive(params.hpfBassBoost);
        hpf.setBassBoostGain(params.hpfBassBoostGain);

        // Store diagnostic intermediate values
        lastBaseCutoffHz = 50.0f * std::pow(400.0f, params.vcfCutoff);
        lastEffectiveCutoffHz = cutoffHz;
        lastVcfResonance = std::clamp(params.vcfResonance + filterResMod + resonanceDriftMod, 0.0f, 1.0f);
        lastEnvDepthSign = effectiveEnvDepth;
        lastKeytrackHz = keyTrackHz;
        lastHpfCutoffHz = hpfCutoffHz;
        lastLfo1Value = modSources[(int)ModSource::kLFO1];
        lastLfo2Value = modSources[(int)ModSource::kLFO2];
        lastEnv1Value = modSources[(int)ModSource::kEnv1VCA];
        lastEnv2Value = env2Value;
        lastDriftHz = cutoffDriftMod;
        lastCutoffFromEnv = env2Value * velScaledEnvDepth;
        lastCutoffFromLfo = lfoValue * totalLfoDepth;
        lastCutoffFromDrift = cutoffDriftMod;
        lastCutoffFromKeytrack = keyTrackHz;

        float finalFiltered = hpf.process(filtered);

        // 6. Amplificación VCA final
        float ampLevelMod = matrix.getModulationValue(ModDestination::kAmpLevel, modSources);
        float vcaEnvelopeValue = modSources[(int)ModSource::kEnv1VCA];
        
        // VCA Env Depth: escala cuánto afecta la envolvente al nivel
        //   depth=0: sin envolvente (sonido continuo al nivel base)
        //   depth=1: envolvente controla completamente el nivel
        float envScaled = 1.0f - params.vcaEnvDepth + params.vcaEnvDepth * vcaEnvelopeValue;
        
        // VCA Velocity Sensitivity: la velocity escala el nivel VCA
        //   velSens=0: sin efecto de velocity
        //   velSens=1: velocity controla completamente el nivel
        float velScale = 1.0f - params.vcaVelSens + params.vcaVelSens * velocityValue;
        
        float ampLevel = (params.vcaLevel + ampLevelMod) * envScaled * velScale;
        ampLevel = std::clamp(ampLevel, 0.0f, 1.0f);

        // Modo Ballsy / Transparent
        if (params.vcaMode == 1)
        {
            // --- Ballsy: Analog VCA saturation con carácter valve/tube ---
            // Modelo de saturación analógica en una sola etapa:
            //   1. Pre-drive variable según ampLevel
            //   2. Asymmetric bias para armónicos pares (tube warmth)
            //   3. Soft makeup gain para compensar compresión de la saturación

            float drive = (finalFiltered * ampLevel) * (1.0f + ampLevel);
            // Asymmetry: pequeña asimetría proporcional al nivel para armónicos pares
            float asymmetry = drive * 0.04f * ampLevel;
            float shaped = std::tanh(drive + asymmetry);
            // Makeup gain suave: cuando el tanh aplana la señal, la restaurar ligeramente
            float makeup = 1.0f + (1.0f - std::abs(shaped)) * 0.3f * ampLevel;
            return shaped * makeup;
        }
        
        // --- Transparent: amplificación lineal limpia ---
        return finalFiltered * ampLevel;
    }

    void SynthVoice::process(juce::AudioBuffer<float>& outputBuffer, int startSample, int numSamples,
                              const ModulationMatrix& matrix,
                              const float* engineGlobalLfo1,
                              const float* engineGlobalLfo2,
                              float engineLfo1MonoMode,
                              float engineLfo2MonoMode)
    {
        if (!isActive())
            return;

        // Sincronizar modo Mono/Spread desde el Engine (si se proporcionó)
        if (engineLfo1MonoMode >= 0.0f) lfo1MonoMode = engineLfo1MonoMode;
        if (engineLfo2MonoMode >= 0.0f) lfo2MonoMode = engineLfo2MonoMode;

        // Escribir en el buffer estéreo sumando las muestras
        for (int sample = 0; sample < numSamples; ++sample)
        {
            float s = processSample(matrix, sample, engineGlobalLfo1, engineGlobalLfo2);
            
            // Panorámica: base desde Unison stacking + modulaciones
            float basePan = 0.5f + (unisonPanPosition - 0.5f) * voicePanSpread;
            float panMod = matrix.getModulationValue(ModDestination::kAmpPan, modSources);
            float pan = std::clamp(basePan + panMod, 0.0f, 1.0f);
            // Almacenar pan modulado para el DebugPanel
            lastModPan = pan;

            outputBuffer.addSample(0, startSample + sample, s * (1.0f - pan));
            outputBuffer.addSample(1, startSample + sample, s * pan);
        }

        // Si la envolvente VCA terminó, invalidar la nota
        // Loop mode (env1TriggerMode==3): la envolvente nunca termina mientras
        // se mantenga la nota, por lo que no se invalida automáticamente.
        if (!env1VCA.isActive())
        {
            currentMidiNote = -1;
        }
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
        
        snapshot.envStage = 0; // Se puede mapear al estado real de envolvente si se requiere
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
