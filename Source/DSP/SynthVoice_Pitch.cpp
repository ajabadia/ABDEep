#include "SynthVoice.h"
#include <cmath>

namespace ABD
{

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

float SynthVoice::processOscillatorSection(const ModulationMatrix& matrix,
                                            int sampleIndex,
                                            const float* globalLfo1,
                                            const float* globalLfo2,
                                            float driftOsc1, float driftOsc2,
                                            float& freq1, float& freq2)
{
    // 1. Resolver modulaciones de Pitch desde la matriz
    float osc1PitchMod = matrix.getModulationValue(ModDestination::kOsc1Pitch, modSources) * 12.0f;
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

    // 2. Pitch base de la nota + Pitch Bend externo (rango asimétrico configurable)
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
    lastModOsc1DetuneSemitones = pitchBendAmount + osc1PitchMod + osc1DriftSemitones
                                 + unisonDetuneSemitones + globalTuneSemitones;
    lastModOsc2DetuneSemitones = pitchBendAmount + params.osc2Pitch + osc2PitchMod
                                 + osc2DriftSemitones + unisonDetuneSemitones + globalTuneSemitones;

    // 3. Portamento / Glide: interpolar pitch nota a nota
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
            float direction = (targetPortaPitch > currentPortaPitch) ? 1.0f : -1.0f;
            currentPortaPitch += direction * glideRate;
        }
        else
        {
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
    float balNorm = juce::jlimit(-1.0f, 1.0f, params.portaOscBal / 127.0f);
    float osc1GlideAmount = (balNorm + 1.0f) * 0.5f;
    float osc2GlideAmount = 1.0f - osc1GlideAmount;

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
    freq1 = 440.0f * std::pow(2.0f, (osc1Note - 69.0f) / 12.0f);
    freq2 = 440.0f * std::pow(2.0f, (osc2Note - 69.0f) / 12.0f);

    lastCalculatedFreq1 = freq1;

    osc1.setFrequency(freq1);
    osc2.setFrequency(freq2);

    // 4. Modulación PWM en OSC1 (con selección de fuente)
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

    // 5. Modulación Tone Mod en OSC2 (con selección de fuente)
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
    osc2.setModulationValue((int)Oscillator::ModulationDestination::kToneMod,
                            std::clamp(toneModBase + toneModModulation + toneMod, 0.0f, 1.0f));

    // 6. Configurar actividad de osciladores y generar muestras
    osc1.setSawActive(params.osc1SawEnable);
    osc1.setSquareActive(params.osc1PulseEnable);

    float osc1VolMod = matrix.getModulationValue(ModDestination::kOsc1Level, modSources);
    float osc2VolMod = matrix.getModulationValue(ModDestination::kOsc2Level, modSources);
    float noiseVolMod = matrix.getModulationValue(ModDestination::kNoiseLevel, modSources);
    float subVolMod = matrix.getModulationValue(ModDestination::kSubOscLevel, modSources);

    float osc1Sample = osc1.nextSample() * std::clamp(1.0f + osc1VolMod, 0.0f, 1.0f);
    float osc2Sample = osc2.nextSample() * std::clamp(params.osc2Level + osc2VolMod, 0.0f, 1.0f);

    // Sub Oscillator: onda cuadrada 1 octava abajo
    subPhase += freq1 * (0.5f * invSampleRate);
    if (subPhase >= 1.0) subPhase -= 1.0;
    float subSample = (subPhase < 0.5) ? 1.0f : -1.0f;
    subSample *= std::clamp(params.subLevel + subVolMod, 0.0f, 1.0f);

    // Hard Sync: detectar wrap de fase de OSC1 (Master) y resetear OSC2 (Slave)
    if (params.oscSync)
    {
        double osc1Phase = osc1.getPhase();
        if (osc1Phase < prevOsc1Phase)
            osc2.resetPhase();
        prevOsc1Phase = osc1Phase;
    }

    // Generador de ruido simple (LCG determinista por voz, sin std::rand() global)
    noiseSeed = noiseSeed * 1664525u + 1013904223u;
    float noiseSample = (-1.0f + 2.0f * ((float)(noiseSeed & 0xFFFF) / 65535.0f))
                        * std::clamp(params.noiseLevel + noiseVolMod, 0.0f, 1.0f);

    return osc1Sample + osc2Sample + subSample + noiseSample;
}

} // namespace ABD
