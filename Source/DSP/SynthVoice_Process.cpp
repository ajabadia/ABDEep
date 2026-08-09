#include "SynthVoice.h"
#include <cmath>
#if DEEP_TARGET_MODEL >= 2
#include "../Core/CalibrationSpec.h"
#endif

namespace ABD
{

void SynthVoice::updateModulationSources(int sampleIndex,
                                          const float* globalLfo1,
                                          const float* globalLfo2)
{
    // Arp Sync: si está activo, override del rate del LFO con la división de la tabla de Clock Divide
    if (params.lfo1ArpSync)
        lfo1.setRate(lfo1ArpSyncHz);

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

    // Arp Sync para LFO2 (tabla de Clock Divide, rate propio)
    if (params.lfo2ArpSync)
        lfo2.setRate(lfo2ArpSyncHz);

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
                 struct { float driftToTimeScale, maxTimeSec; } envelopes;
                 struct { float rateScale, rateExp; } lfo; } transfer;
        struct { float staticPitchCentsRange, staticCutoffNormRange, staticResNormRange,
                      staticEnvTimeNormRange, cutoffDriftScale, resonanceDriftScale; } voice;
    };
    static const FallbackCal cal = {
        { { 50.f, 20000.f, 400.f },
          { 261.63f, 1.f },
          { 0.3f },
          { 40.f, 2000.f, 18000.f, 12.f },
          { 0.3f, 10.f },
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
    float driftEnvScale = 1.0f + (drift.getEnvTimeDrift() + staticEnvTimeOffset) * cal.transfer.envelopes.driftToTimeScale;
    env1VCA.setTimeScale(driftEnvScale);
    env2VCF.setTimeScale(driftEnvScale);
    env3MOD.setTimeScale(driftEnvScale);

    // Sincronizar loop mode desde params (puede cambiar mid-note vía updateParameters)
    env1VCA.setLoopMode(params.env1TriggerMode == 3);
    env2VCF.setLoopMode(params.env2TriggerMode == 3);
    env3MOD.setLoopMode(params.env3TriggerMode == 3);

    // One-shot (voice.envelopeTriggerMode==3): decay → release directo (sin sustain)
    bool oneShotMode = params.triggerMode == 3;
    env1VCA.setBypassSustain(oneShotMode);
    env2VCF.setBypassSustain(oneShotMode);
    env3MOD.setBypassSustain(oneShotMode);

    // 2. Actualizar envolventes y LFOs (con soporte Mono/Spread)
    updateModulationSources(sampleIndex, globalLfo1, globalLfo2);

    float velocityValue = modSources[(int)ModSource::kVelocity];

    // Extraer parámetros de calibración para el filtro en un struct común
    FilterCalibrationParams calF;
#if DEEP_TARGET_MODEL >= 2
    calF.vcfMinHz = cal.transfer.vcfCutoff.minHz;
    calF.vcfCurveBase = cal.transfer.vcfCutoff.curveBase;
    calF.keytrackRefHz = cal.transfer.vcfKeytrack.referenceHz;
    calF.keytrackAmountScale = cal.transfer.vcfKeytrack.amountScale;
    calF.pitchBendCutoffScale = cal.transfer.vcfPitchBend.cutoffScale;
    calF.hpfMinHz = cal.transfer.hpf.minHz;
    calF.hpfMaxHz = cal.transfer.hpf.maxHz;
    calF.hpfModScaleHz = cal.transfer.hpf.modScaleHz;
    calF.cutoffDriftScale = cal.voice.cutoffDriftScale;
    calF.resonanceDriftScale = cal.voice.resonanceDriftScale;
#else
    calF.vcfMinHz = 50.0f;
    calF.vcfCurveBase = 400.0f;
    calF.keytrackRefHz = 261.63f;
    calF.keytrackAmountScale = 1.0f;
    calF.pitchBendCutoffScale = 0.3f;
    calF.hpfMinHz = 40.0f;
    calF.hpfMaxHz = 2000.0f;
    calF.hpfModScaleHz = 18000.0f;
    calF.cutoffDriftScale = 1.0f;
    calF.resonanceDriftScale = 1.0f;
#endif

    // 3. Oscillator section: pitch modulación, portamento, generación de osciladores
    float freq1, freq2;
    float combinedOsc = processOscillatorSection(matrix, sampleIndex, globalLfo1, globalLfo2, driftOsc1, driftOsc2, freq1, freq2);

    // 4. Filter section: VCF + HPF con switching de modelo
    float filtered = processFilterSection(matrix, combinedOsc, freq1,
                                           driftCutoff, driftResonance, velocityValue, calF);

    // 5. VCA section: amplificación final (Transparent / Ballsy)
    return processVCASection(filtered, velocityValue, matrix);
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
        // startSample offsetea el índice de los buffers LFO globales: con render
        // segmentado (sample-accurate MIDI) la voz procesa tramos [startSample, ...),
        // por lo que el índice absoluto es startSample + sample.
        float s = processSample(matrix, startSample + sample, engineGlobalLfo1, engineGlobalLfo2);
        
        // Panorámica: base desde Unison stacking + modulaciones
        float basePan = 0.5f + (unisonPanPosition - 0.5f) * voicePanSpread;
        float panMod = matrix.getModulationValue(ModDestination::kAmpPan, modSources);
        float pan = std::clamp(basePan + panMod, 0.0f, 1.0f);
        // Almacenar pan modulado para el DebugPanel
        lastModPan = pan;

        outputBuffer.addSample(0, startSample + sample, s * (1.0f - pan));
        outputBuffer.addSample(1, startSample + sample, s * pan);
    }

    // Si la envolvente VCA terminó (Stage::kIdle), invalidar la nota para liberar la voz
    if (!env1VCA.isActive())
    {
        currentMidiNote = -1;
    }
}

} // namespace ABD
