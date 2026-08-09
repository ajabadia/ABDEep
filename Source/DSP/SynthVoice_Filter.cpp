#include "SynthVoice.h"
#include "DSPHelpers.h"
#include <cmath>
#if DEEP_TARGET_MODEL >= 2
#include "MoogLadderVCF.h"
#include "KorgMS20VCF.h"
#endif

namespace ABD
{

float SynthVoice::processFilterSection(const ModulationMatrix& matrix, float combinedOsc, float freq1,
                                       float driftCutoff, float driftResonance, float velocityValue,
                                       const FilterCalibrationParams& cal)
{
    // 1. Resolver modulación de cutoff VCF
    float vcfCutoffMod = matrix.getModulationValue(ModDestination::kFilterCutoff, modSources);

    float env2Value = modSources[(int)ModSource::kEnv2VCF];

    // VCF Env Velocity Sensitivity: la velocity escala la profundidad del envelope VCF

    // vcfEnvDepth es bipolar: 0.0=−100%, 0.5=0% (centro), 1.0=+100%
    // Convertir a signed [-1,+1] antes de aplicar polarity toggle
    const float signedEnvDepth = (params.vcfEnvDepth - 0.5f) * 2.0f;
    // Polaridad: Normal=+1, Inverted=−1 (botón INVERT del hardware)
    float polarityScale = (params.vcfEnvPolarity == 1) ? 1.0f : -1.0f;
    float effectiveEnvDepth = signedEnvDepth * polarityScale;
    float velScaledEnvDepth = effectiveEnvDepth * (1.0f - params.vcfEnvVel + params.vcfEnvVel * velocityValue);

    // VCF Pitch Bend Depth: el pitch bend modula el cutoff
    float pitchBendValue = modSources[(int)ModSource::kPitchBend];
    float pitchBendCutoffMod = pitchBendValue * params.vcfPitchBend * cal.pitchBendCutoffScale;

    float lfoCutoffDepth = params.vcfLfoDepth;
    float lfoValue = (params.vcfLfoSelect == 0) ? modSources[(int)ModSource::kLFO1] : modSources[(int)ModSource::kLFO2];

    // Drift analógico del filtro: pequeña fluctuación en cutoff y resonancia
    float cutoffDriftMod = driftCutoff * params.paramDrift * cal.cutoffDriftScale;
    float resonanceDriftMod = driftResonance * params.paramDrift * cal.resonanceDriftScale;

    // LFO depth modulado por Aftertouch y Mod Wheel
    float lfoDepthFromAftertouch = params.vcfAftertouchLfo * modSources[(int)ModSource::kKeyPressure];
    float lfoDepthFromModwheel = params.vcfModwheelLfo * modSources[(int)ModSource::kModWheel];
    float totalLfoDepth = lfoCutoffDepth + lfoDepthFromAftertouch + lfoDepthFromModwheel;

    // Mapeo musical logarítmico del Cutoff (calibrado)
    float targetCutoffLvl = params.vcfCutoff + vcfCutoffMod
                           + (env2Value * velScaledEnvDepth)
                           + (lfoValue * totalLfoDepth)
                           + pitchBendCutoffMod + cutoffDriftMod;
    targetCutoffLvl = std::clamp(targetCutoffLvl, 0.0f, 1.0f);

    // Exponential smoothing on cutoff level (SR-normalized coeff, ~1ms at 44.1 kHz)
    // Prevents zipper noise on fast slider moves while preserving modulation sharpness
    smoothedCutoffLvl += (targetCutoffLvl - smoothedCutoffLvl) * cutoffSmoothCoeff;
    float cutoffHz;
    if (cal.vcfMinHz == lastCalVcfMinHz && cal.vcfCurveBase == lastCalVcfCurveBase
        && std::abs(smoothedCutoffLvl - lastSmoothedCutoffLvl) < 1.0e-5f)
    {
        cutoffHz = lastCutoffHz;  // steady state — reuse cached pow()
    }
    else
    {
        cutoffHz = cal.vcfMinHz * ABD::DSP::fastExp2(smoothedCutoffLvl * std::log2(cal.vcfCurveBase));
        lastCutoffHz = cutoffHz;
        lastSmoothedCutoffLvl = smoothedCutoffLvl;
        lastCalVcfMinHz = cal.vcfMinHz;
        lastCalVcfCurveBase = cal.vcfCurveBase;
    }

    // Keytracking del filtro: 1:1 por octava (multiplicativo, pivota en middle C).
    // El cutoff escala por el ratio de la nota tocada frente a la referencia:
    // una octava arriba duplica el cutoff, una octava abajo lo divide. La
    // forma aditiva anterior (cutoff + Hz) subestimaba el tracking en agudos.
    float keyTrackRatio = ABD::DSP::filterKeyTrackRatio(freq1, cal.keytrackRefHz,
                                                        params.vcfKeyTrack * cal.keytrackAmountScale);
    float keyTrackHz = cutoffHz * (keyTrackRatio - 1.0f);
    cutoffHz = std::clamp(cutoffHz * keyTrackRatio, 10.0f, (float)(sampleRate * 0.45));
    // Almacenar cutoff modulado para el DebugPanel
    lastModVcfCutoffHz = cutoffHz;

    // 2. Sincronizar modos/parámetros del VCF (solo si cambiaron)
#if DEEP_TARGET_MODEL >= 2
    int activeModel = params.vcfModel;
#else
    int activeModel = 0;
    juce::ignoreUnused(activeModel);
#endif
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
#if DEEP_TARGET_MODEL >= 2
    // VCF Model switching: update cached model and propagate settings to the correct filter
    if (activeModel != lastVcfModel)
    {
        // When switching model: clear state of all filters
        vcf.prepare(sampleRate);
        moogVcf.prepare(sampleRate);
        korgVcf.prepare(sampleRate);
        lastVcfModel = activeModel;
    }
    // Sub-mode change: reset the affected filter's state (avoids z1 discontinuity pops)
    if (params.vcfMoogSubMode != lastMoogSubMode)
    {
        moogVcf.prepare(sampleRate);
        lastMoogSubMode = params.vcfMoogSubMode;
    }
    if (params.vcfKorgSubMode != lastKorgSubMode)
    {
        korgVcf.prepare(sampleRate);
        lastKorgSubMode = params.vcfKorgSubMode;
    }
#endif

    // 3. Resolver resonancia
    float filterResMod = matrix.getModulationValue(ModDestination::kFilterResonance, modSources);
    float effectiveRes = std::clamp(params.vcfResonance + filterResMod + resonanceDriftMod, 0.0f, 1.0f);

    // 4. Aplicar cutoff + resonance al modelo de filtro activo
#if DEEP_TARGET_MODEL >= 2
    switch (activeModel)
    {
        case 1:  // Moog Ladder
            moogVcf.setCutoff(cutoffHz);
            moogVcf.setResonance(effectiveRes);
            moogVcf.setPoleMode(params.vcfPoleMode);
            moogVcf.setSubMode(params.vcfMoogSubMode);
            break;
        case 2:  // Korg MS-20
            korgVcf.setCutoff(cutoffHz);
            korgVcf.setResonance(effectiveRes);
            korgVcf.setPoleMode(params.vcfPoleMode);
            korgVcf.setSubMode(params.vcfKorgSubMode);
            break;
        default: // DM12 OTA
            vcf.setCutoff(cutoffHz);
            vcf.setResonance(effectiveRes);
            break;
    }
#else
    vcf.setCutoff(cutoffHz);
    vcf.setResonance(effectiveRes);
#endif

    // 5. Procesar a través del modelo de filtro activo
#if DEEP_TARGET_MODEL >= 2
    float filtered;
    switch (activeModel)
    {
        case 1:  filtered = moogVcf.process(combinedOsc);  break;
        case 2:  filtered = korgVcf.process(combinedOsc);  break;
        default: filtered = vcf.process(combinedOsc);       break;
    }
#else
    float filtered = vcf.process(combinedOsc);
#endif

    // 6. HPF (diagnóstico). El filtrado HPF real se aplica en el bus global del
    //    motor, post-VCA y post-suma de voces (hardware: VCF → VCA → SUM → HPF → FX,
    //    destino de modulación "common"). Aquí solo se resuelve el cutoff para el
    //    DebugPanel / Calibration Lab.
    float hpfCutoffMod = matrix.getModulationValue(ModDestination::kFilterHPFCutoff, modSources);
    float hpfCutoffHz = std::clamp(params.hpfCutoff + hpfCutoffMod * cal.hpfModScaleHz,
                                    cal.hpfMinHz, cal.hpfMaxHz);

    // 7. Almacenar valores de diagnóstico intermedios
    if (cal.vcfMinHz != lastDiagVcfMinHz || cal.vcfCurveBase != lastDiagVcfCurveBase
        || params.vcfCutoff != lastDiagVcfCutoff)
    {
        lastBaseCutoffHz = cal.vcfMinHz * ABD::DSP::fastExp2(params.vcfCutoff * std::log2(cal.vcfCurveBase));
        lastDiagVcfMinHz = cal.vcfMinHz;
        lastDiagVcfCurveBase = cal.vcfCurveBase;
        lastDiagVcfCutoff = params.vcfCutoff;
    }
    lastEffectiveCutoffHz = cutoffHz;
    lastVcfResonance = effectiveRes;
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

    return filtered;
}

} // namespace ABD
