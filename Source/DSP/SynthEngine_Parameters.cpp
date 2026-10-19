#include "SynthEngine.h"
#include <algorithm>

// El códec de bytes del preset. Vive en Core porque lo usan tambien el
// plugin (PatchController) y el banco de pruebas, y por eso no puede
// depender de que se haya cargado el plugin.
#include "PatchByteCodec.h"

// La capa de traduccion wire <-> dominio. El motor consume DOMINIO: los numeros
// magicos (raw/255*10, 0.035*e^(7.5t), *6.59f) ya no viven aqui, viven en el spec
// versionado (schemas/parameter-conversion.json) y llegan por este header.
#include "ParameterConversion.gen.h"

namespace ABD
{
namespace
{
    // Dado un id del spec de conversion y el valor 0..1 que entrega la APVTS,
    // devuelve el valor fisico (segundos, Hz) que usa el DSP. Cambiar "como se
    // traduce" es cambiar el spec, no este fichero.
    //
    // findConversionById es de hilo de control: se llama desde updateParameters()
    // (bloque de parametros, no bucle de muestra), nunca por muestra.
    float domainOf (const char* id, float normalizedValue) noexcept
    {
        if (const auto* e = Registry::Conversion::findConversionById (id))
            return Registry::Conversion::normalizedToDomain (*e, normalizedValue);
        return normalizedValue;
    }
}

    float SynthEngine::lfoArpSyncHzFromRate(float rateNorm, float bpm)
    {
        // Tabla de Clock Divide del hardware DM12 (docs lfos.md:23-48): 20 divisiones
        // mapeadas a raw byte 8..255. El sync se deriva del Master BPM, no del reloj de arp.
        static const float clockDivisions[20] = {
            4.0f, 3.0f, 2.0f, 1.0f, 0.5f, 3.0f / 8.0f, 1.0f / 3.0f, 1.0f / 4.0f,
            3.0f / 16.0f, 1.0f / 6.0f, 1.0f / 8.0f, 3.0f / 32.0f, 1.0f / 12.0f,
            1.0f / 16.0f, 3.0f / 64.0f, 1.0f / 24.0f, 1.0f / 32.0f,
            3.0f / 128.0f, 1.0f / 48.0f, 1.0f / 64.0f
        };
        static const int tableSize = (int)(sizeof(clockDivisions) / sizeof(clockDivisions[0]));

        // Normalizar rateNorm → raw byte hardware (0..255), clampeado al rango de la tabla (8..255)
        int raw = std::clamp((int)(rateNorm * 255.0f + 0.5f), 8, 255);
        int index = std::min((int)((raw - 8) / 247.0f * (tableSize - 1) + 0.5f), tableSize - 1);
        const float division = clockDivisions[index];

        // El LFO completa un ciclo cada 'division' (en notas enteras) → division*4 negras.
        // frecuencia (Hz) = (bpm/60) / (division*4)
        return std::max(bpm, 20.0f) / 60.0f / (division * 4.0f);
    }

    //==============================================================================
    // Test/diagnostic hooks (benchmarks) — espejan los targets de updateParameters()
    //==============================================================================

    void SynthEngine::setVoiceMode(int mode)
    {
        voiceMode = std::clamp(mode, 0, 12);
    }

    void SynthEngine::setEnv1Times(float attack, float decay, float sustain, float release)
    {
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].env1VCA.setParameters(attack, decay, sustain, release);
    }

    void SynthEngine::setUnisonDetune(float detune)
    {
        unisonDetune = juce::jlimit(0.0f, 1.0f, detune);
    }

    void SynthEngine::setVcaPanSpread(float spread)
    {
        vcaPanSpread = juce::jlimit(0.0f, 1.0f, spread);
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].voicePanSpread = vcaPanSpread;
    }

    void SynthEngine::setVcfModel(int model)
    {
#if DEEP_TARGET_MODEL >= 2
        const int m = std::clamp(model, 0, 2);
        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].params.vcfModel = m;
            voices[i].cachedVcfModel = m;
        }
#else
        juce::ignoreUnused(model);
#endif
    }

    void SynthEngine::setVcfOversample(int oversample)
    {
        const int os = std::clamp(oversample, 0, 2);
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].params.vcfOversample = os;
    }

    void SynthEngine::setVcfCutoff(float cutoff)
    {
        const float c = juce::jlimit(0.0f, 1.0f, cutoff);
        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].params.vcfCutoff = c;
            voices[i].smoothedCutoffLvl = c;
        }
    }

    int SynthEngine::loadPatchBytes (const std::uint8_t* patch242,
                                     juce::AudioProcessorValueTreeState& apvts)
    {
        jassert (patch242 != nullptr);
        if (patch242 == nullptr)
            return 0;

        const int escritos = PatchByteCodec::applyToApvts (patch242, apvts);
        updateParameters (apvts);
        return escritos;
    }

    void SynthEngine::updateParameters(juce::AudioProcessorValueTreeState& apvts)
    {
        // Lambda auxiliar para leer floats
        auto getFloat = [&](const char* id) -> float {
            if (auto* param = apvts.getRawParameterValue(id))
                return param->load();
            jassertfalse; // Parámetro no encontrado — revisar ParametersSpec
            return 0.0f;
        };

        // Lambda auxiliar para leer bools
        auto getBool = [&](const char* id) -> bool {
            if (auto* param = apvts.getRawParameterValue(id))
                return param->load() > 0.5f;
            jassertfalse; // Parámetro no encontrado — revisar ParametersSpec
            return false;
        };

        // Lambda auxiliar para leer enums (raw parameter value almacena el índice discreto en JUCE 8)
        auto getInt = [&](const char* id) -> int {
            if (auto* raw = apvts.getRawParameterValue(id))
                return static_cast<int>(std::round(raw->load()));
            if (auto* param = apvts.getParameter(id))
                if (auto* choice = dynamic_cast<juce::AudioParameterChoice*>(param))
                    return choice->getIndex();
            return 0;
        };

        // One-shot diagnostic: confirm updateParameters runs and params are readable
        // NOTA: Solo se imprime en Debug builds — cero I/O en hilo de audio en Release
#if JUCE_DEBUG
        {
            static bool logged = false;
            if (!logged)
            {
                logged = true;
                auto* cutoffP = apvts.getRawParameterValue("vcf_cutoff");
                auto* vcaP = apvts.getRawParameterValue("vca_level");
                auto* volP = apvts.getRawParameterValue("global_volume");
                DBG("[DSP] updateParameters FIRST CALL:"
                    + juce::String(" vcf_cutoff raw=" + juce::String(cutoffP ? cutoffP->load() : -1.0f))
                    + " vca_level raw=" + juce::String(vcaP ? vcaP->load() : -1.0f)
                    + " global_volume raw=" + juce::String(volP ? volP->load() : -1.0f));
            }
        }
#endif

        // Leer parámetros comunes una sola vez fuera del bucle de las 12 voces
        SynthVoice::VoiceParams commonParams;

        // OSC 1
        commonParams.osc1SawEnable       = getBool("osc1_saw_enable");
        commonParams.osc1PulseEnable     = getBool("osc1_square_enable");
        commonParams.osc1PwmAmount       = getFloat("osc1_pwm_amount");
        commonParams.osc1Range           = getInt("osc1_range");
        commonParams.osc1PitchMod        = getFloat("osc1_pitch_mod");
        commonParams.osc1PmSource        = std::clamp(getInt("osc1_pm_source"), 0, 6);
        commonParams.osc1PwmSource       = std::clamp(getInt("osc1_pwm_source"), 0, 5);
        commonParams.osc1PmMode          = std::clamp(getInt("osc1_pm_mode"), 0, 1);
        commonParams.osc1LfoAftertouch   = getFloat("osc1_lfo_aftertouch");
        commonParams.osc1LfoModwheel     = getFloat("osc1_lfo_modwheel");

        // OSC 2
        commonParams.osc2Pitch           = getFloat("osc2_pitch");
        commonParams.osc2ToneMod         = getFloat("osc2_tone_mod");
        commonParams.osc2Level           = getFloat("osc2_level");
        commonParams.osc2PitchMod        = getFloat("osc2_pitch_mod");
        commonParams.osc2Range           = getInt("osc2_range");
        commonParams.osc2PmSource        = std::clamp(getInt("osc2_pm_source"), 0, 6);
        commonParams.osc2TpmSource       = std::clamp(getInt("osc2_tpm_source"), 0, 5);
        commonParams.osc2AftertouchPitch = getFloat("osc2_aftertouch_pitch");
        commonParams.osc2ModwheelPitch   = getFloat("osc2_modwheel_pitch");

        // Global/Noise/Sub
        commonParams.oscSync             = getBool("osc_sync_enable");
        commonParams.noiseLevel          = getFloat("noise_level");
        commonParams.subLevel            = getFloat("sub_level");

        // VCF
        commonParams.vcfCutoff           = getFloat("vcf_cutoff");
        commonParams.vcfResonance        = getFloat("vcf_resonance");
        commonParams.vcfPoleMode         = getInt("vcf_pole_mode");
#if DEEP_TARGET_MODEL >= 2
        commonParams.vcfOversample       = std::clamp(getInt("vcf_oversample"), 0, 2);
        commonParams.vcfModel            = std::clamp(getInt("vcf_model"), 0, 2);
        commonParams.vcfMoogSubMode      = std::clamp(getInt("vcf_moog_submode"), 0, 2);
        commonParams.vcfKorgSubMode      = std::clamp(getInt("vcf_korg_submode"), 0, 1);
#endif
        commonParams.vcfVoicingMode      = getInt("vcf_voicing_mode");
        commonParams.vcfEnvDepth         = getFloat("vcf_env_depth");
        commonParams.vcfEnvVel           = getFloat("vcf_env_vel");
        commonParams.vcfLfoDepth         = getFloat("vcf_lfo_depth");
        commonParams.vcfLfoSelect        = getInt("vcf_lfo_select");
        commonParams.vcfEnvPolarity      = getInt("vcf_env_polarity");
        commonParams.vcfKeyTrack         = getFloat("vcf_key_tracking");
        commonParams.vcfPitchBend        = getFloat("vcf_pitch_bend");
        commonParams.vcfAftertouchLfo    = getFloat("vcf_aftertouch_lfo");
        commonParams.vcfModwheelLfo      = getFloat("vcf_modwheel_lfo");

        // HPF (params con rango físico: cutoff 20-2000 Hz, bass boost gain 0.1-3.0)
        commonParams.hpfCutoff           = getFloat("hpf_cutoff");
        commonParams.hpfBassBoost        = getBool("hpf_boost_enable");
        commonParams.hpfBassBoostGain    = getFloat("hpf_bass_boost_gain");

        // VCA
        commonParams.vcaLevel            = getFloat("vca_level");
        commonParams.vcaMode             = getInt("vca_mode");
        commonParams.vcaEnvDepth         = getFloat("vca_env_depth");
        commonParams.vcaVelSens          = getFloat("vca_vel_sens");

        // Analog Drift
        commonParams.voiceDrift          = getFloat("voice_drift");
        commonParams.paramDrift          = getFloat("param_drift");
        commonParams.driftRate           = getFloat("drift_rate");

        // Trigger Mode, Key Reset, Pitch Bend Range & LFO Arp Sync
        commonParams.triggerMode         = std::clamp(getInt("trigger_mode"), 0, 3);
        commonParams.oscKeyReset         = getBool("osc_key_reset");
        commonParams.pitchBendUp         = getFloat("pitch_bend_up");
        commonParams.pitchBendDown       = getFloat("pitch_bend_down");
        commonParams.env1TriggerMode     = std::clamp(getInt("env1_trigger_mode"), 0, 4);
        commonParams.env2TriggerMode     = std::clamp(getInt("env2_trigger_mode"), 0, 4);
        commonParams.env3TriggerMode     = std::clamp(getInt("env3_trigger_mode"), 0, 4);
        commonParams.lfo1ArpSync         = getBool("lfo1_arp_sync");
        commonParams.lfo2ArpSync         = getBool("lfo2_arp_sync");

        // Portamento / Glide
        globalPortamentoTime             = getFloat("global_portamento");
        portaMode                        = std::clamp(getInt("porta_mode"), 0, 13);
        portaOscBal                      = getFloat("porta_osc_bal");
        commonParams.portaTime           = globalPortamentoTime;
        commonParams.portaMode           = portaMode;
        commonParams.portaOscBal         = portaOscBal;

        // Envelopes: el hardware DeepMind 12 utiliza una curva exponencial pronunciada
        // para los tiempos de Attack, Decay y Release (0..255 -> ~1 ms .. 10 s, con
        // raw=113 ~ 140 ms y raw=128 ~ 220 ms en lugar de 4.4 s / 5.0 s lineales).
        auto envTimeSec = [](float paramIdTimeSec) noexcept -> float {
            const float t = std::clamp(paramIdTimeSec / 10.0f, 0.0f, 1.0f);
            return 0.005f * (std::exp(7.601f * t) - 1.0f);
        };

        const float env1Att  = envTimeSec(domainOf("env1_attack", getFloat("env1_attack")));
        const float env1Dec  = envTimeSec(domainOf("env1_decay", getFloat("env1_decay")));
        const float env1Sus  = getFloat("env1_sustain");
        const float env1Rel  = envTimeSec(domainOf("env1_release", getFloat("env1_release")));
        const float env1AttC = domainOf("env1_attack_curve", getFloat("env1_attack_curve"));
        const float env1DecC = domainOf("env1_decay_curve", getFloat("env1_decay_curve"));
        const float env1SusC = domainOf("env1_sustain_curve", getFloat("env1_sustain_curve"));
        const float env1RelC = domainOf("env1_release_curve", getFloat("env1_release_curve"));

        const float env2Att  = envTimeSec(domainOf("env2_attack", getFloat("env2_attack")));
        const float env2Dec  = envTimeSec(domainOf("env2_decay", getFloat("env2_decay")));
        const float env2Sus  = getFloat("env2_sustain");
        const float env2Rel  = envTimeSec(domainOf("env2_release", getFloat("env2_release")));
        const float env2AttC = domainOf("env2_attack_curve", getFloat("env2_attack_curve"));
        const float env2DecC = domainOf("env2_decay_curve", getFloat("env2_decay_curve"));
        const float env2SusC = domainOf("env2_sustain_curve", getFloat("env2_sustain_curve"));
        const float env2RelC = domainOf("env2_release_curve", getFloat("env2_release_curve"));

        const float env3Att  = envTimeSec(domainOf("env3_attack", getFloat("env3_attack")));
        const float env3Dec  = envTimeSec(domainOf("env3_decay", getFloat("env3_decay")));
        const float env3Sus  = getFloat("env3_sustain");
        const float env3Rel  = envTimeSec(domainOf("env3_release", getFloat("env3_release")));
        const float env3AttC = domainOf("env3_attack_curve", getFloat("env3_attack_curve"));
        const float env3DecC = domainOf("env3_decay_curve", getFloat("env3_decay_curve"));
        const float env3SusC = domainOf("env3_sustain_curve", getFloat("env3_sustain_curve"));
        const float env3RelC = domainOf("env3_release_curve", getFloat("env3_release_curve"));

        // LFOs: rate y delay son DOMINIO (Hz, s) que da la capa de traduccion.
        // El rate del modelo Enhanced viene del spec (0.035*e^(7.5t)); el modelo
        // Classic conserva su propia curva porque el spec se sembro del Enhanced.
        const float rawLfo1Rate = getFloat("lfo1_rate");
        const float rawLfo2Rate = getFloat("lfo2_rate");
#if DEEP_TARGET_MODEL >= 2
        const float lfo1RateHz = domainOf("lfo1_rate", rawLfo1Rate);
        const float lfo2RateHz = domainOf("lfo2_rate", rawLfo2Rate);
#else
        static constexpr float kDefaultRateScale = 0.041f;
        static constexpr float kDefaultRateExp   = 7.3747f;
        const float lfo1RateHz = kDefaultRateScale * std::exp(kDefaultRateExp * rawLfo1Rate);
        const float lfo2RateHz = kDefaultRateScale * std::exp(kDefaultRateExp * rawLfo2Rate);
#endif
        const float lfo1DelaySec = domainOf("lfo1_delay", getFloat("lfo1_delay"));
        const float lfo2DelaySec = domainOf("lfo2_delay", getFloat("lfo2_delay"));
        const float lfo1SlewVal  = getFloat("lfo1_slew");
        const float lfo2SlewVal  = getFloat("lfo2_slew");
        const int   lfo1ShapeVal = getInt("lfo1_shape");
        const int   lfo2ShapeVal = getInt("lfo2_shape");
        const bool  lfo1KeySync  = getBool("lfo1_key_sync");
        const bool  lfo2KeySync  = getBool("lfo2_key_sync");

        // Leer modo Mono/Spread para LFOs globales
        lfo1MonoMode = getFloat("lfo1_mono_mode");
        lfo2MonoMode = getFloat("lfo2_mono_mode");

        // Sincronizar LFOs globales con los mismos parámetros que las voces
        globalLfo1.setRate(lfo1RateHz);
        globalLfo1.setDelay(lfo1DelaySec);
        globalLfo1.setSlew(lfo1SlewVal);
        globalLfo1.setShape(lfo1ShapeVal);
        globalLfo1.setKeySync(lfo1KeySync);

        globalLfo2.setRate(lfo2RateHz);
        globalLfo2.setDelay(lfo2DelaySec);
        globalLfo2.setSlew(lfo2SlewVal);
        globalLfo2.setShape(lfo2ShapeVal);
        globalLfo2.setKeySync(lfo2KeySync);

        // Leer parámetros de Voice Mode y Unison
        voiceMode        = std::clamp(getInt("voice_mode"), 0, 12);
        unisonDetuneBase = getFloat("unison_detune");
        unisonDetune     = unisonDetuneBase;
        vcaPanSpread     = getFloat("vca_pan_spread");

        // Leer parámetros de Chord Memory (`chord_key` no forma parte del registro del host)
        chordEnable     = getBool("chord_enable");
        polyChordEnable = getBool("poly_chord_enable");
        chordType       = std::clamp(getInt("chord_type"), 0, 7);
        
        if (!polyChordEnable)
        {
            // Si Poly Chord se desactiva, limpiar el acumulador de notas
            polyChordNoteCount = 0;
            std::memset(polyChordHeldNotes, 0, sizeof(polyChordHeldNotes));
        }

        // Leer Transpose & Global Tune
        transposeSemitones = (int)std::round(getFloat("transpose"));
        globalTuneCents    = getFloat("global_tune");

        // Master Gain — permite boost hasta 2x (para presets que necesiten ganancia extra)
        globalVolume = std::clamp(getFloat("global_volume"), 0.0f, 2.0f);

        // Global HPF (post-VCA) — base física del cutoff y bass boost del módulo HPF
        globalHpfCutoffHz      = commonParams.hpfCutoff;
        globalHpfBassBoost     = commonParams.hpfBassBoost;
        globalHpfBassBoostGain = commonParams.hpfBassBoostGain;

        // Master Soft-Clip — bypass y headroom configurable (0..1 → 0..6 dB)
        masterSoftclipBypass   = getBool("master_softclip_bypass");
        masterSoftclipHeadroom = std::clamp(getFloat("master_softclip_headroom"), 0.0f, 1.0f);

        // ── ARP/SEQ ────────────────────────────────────────────────────────
        // El BPM maestro. OJO CON LAS UNIDADES: `arp_rate` esta declarado en el
        // APVTS como float de 20.0 a 275.0 (`ParametersSpec_SeqArp.cpp`), o sea
        // que getFloat YA DEVUELVE BPM y no un valor normalizado 0-1. El byte
        // de 0-255 es lo que se mapea a ese rango, y es el mismo rango que da el
        // manual (arp-sequencer.md:19). Por eso la cuenta de abajo divide por
        // sesenta tal cual, y por eso el sync de los LFO puede recibirlo directo.
        // Si el host DAW reporta un BPM válido vía AudioPlayHead (hostBpm en [20, 400]),
        // se sincroniza el reloj maestro con el tempo del proyecto DAW.
        const float internalBpm = std::max(20.0f, getFloat("arp_rate"));
        masterBpm = (hostBpm >= 20.0f && hostBpm <= 400.0f) ? hostBpm : internalBpm;

        // Multiplicadores = negras por pulso (1 / ratio de nota). Tabla hardware arp-sequencer.md:44-60.
        static const float clockMultipliers[13] = {
            0.5f, 2.0f / 3.0f, 0.75f, 1.0f, 4.0f / 3.0f, 1.5f, 2.0f,
            8.0f / 3.0f, 3.0f, 4.0f, 6.0f, 8.0f, 12.0f
        };
        const int arpClockDiv = std::clamp(getInt("arp_clock_divider"), 0, 12);
        arpClockHz = (masterBpm / 60.0f) * clockMultipliers[arpClockDiv];
        arpClockHz = std::max(arpClockHz, 0.01f);

        // El arpegiador. El gate del panel se guarda aparte porque la matriz le
        // suma encima muestra a bloque en `processBlock` (destino 71).
        arpGateBase = std::clamp(getFloat("arp_gate_time") / 255.0f, 0.0f, 1.0f);
        arpeggiator.setEnabled(getBool("arp_enable"));
        arpeggiator.setMode(getInt("arp_mode"));
        arpeggiator.setStepRateHz(arpClockHz);
        arpeggiator.setGate(arpGateBase);
        arpeggiator.setHold(getBool("arp_hold"));
        arpeggiator.setKeySync(getBool("arp_key_sync"));
        arpeggiator.setOctaves(getInt("arp_octave") + 1);   // el byte va de 0 a 3 = 1 a 4 octavas
        arpeggiator.setSwing(std::clamp(getFloat("arp_swing") / 25.0f, 0.0f, 1.0f));

        // El secuenciador de control (NRPN 117-154).
        controlSequencer.setEnabled(getBool("seq_enable"));
        controlSequencer.setClockDivider(getInt("seq_clock"));
        controlSequencer.setLength(getInt("seq_length") + 1);   // el byte va de 0 a 31 = 1 a 32 pasos
        controlSequencer.setSwing(std::clamp(getFloat("seq_swing") / 25.0f, 0.0f, 1.0f));
        controlSequencer.setKeyLoopMode(getInt("seq_key_loop"));
        controlSequencer.setSlewRate(std::clamp(getFloat("seq_slew_rate") / 255.0f, 0.0f, 1.0f));
        controlSequencer.setMasterBpm(masterBpm);

        // Los 32 pasos. En el APVTS estan declarados como float de -1.0 a 1.0,
        // que es justo el bipolar del manual (`valor - 128`), asi que getFloat
        // lo devuelve como va y no hay que convertirlo otra vez.
        static constexpr const char* kNombresPaso[32] = {
            "seq_step_1",  "seq_step_2",  "seq_step_3",  "seq_step_4",
            "seq_step_5",  "seq_step_6",  "seq_step_7",  "seq_step_8",
            "seq_step_9",  "seq_step_10", "seq_step_11", "seq_step_12",
            "seq_step_13", "seq_step_14", "seq_step_15", "seq_step_16",
            "seq_step_17", "seq_step_18", "seq_step_19", "seq_step_20",
            "seq_step_21", "seq_step_22", "seq_step_23", "seq_step_24",
            "seq_step_25", "seq_step_26", "seq_step_27", "seq_step_28",
            "seq_step_29", "seq_step_30", "seq_step_31", "seq_step_32"
        };
        for (int p = 0; p < 32; ++p)
            controlSequencer.setStep(p + 1, getFloat(kNombresPaso[p]));

        // Leer Note Priority
        notePriority = std::clamp(getInt("note_priority"), 0, 2);

        // Verificar si alguna voz tiene arp sync activo
        arpSyncActive = commonParams.lfo1ArpSync || commonParams.lfo2ArpSync;

        // LFO Arp Sync: derivar frecuencias desde la tabla de Clock Divide del hardware
        // (docs lfos.md:23-48), basada en el Master BPM, no en el reloj de arp.
        if (arpSyncActive)
        {
            globalLfo1ArpSyncHz = SynthEngine::lfoArpSyncHzFromRate(rawLfo1Rate, masterBpm);
            globalLfo2ArpSyncHz = SynthEngine::lfoArpSyncHzFromRate(rawLfo2Rate, masterBpm);
        }
        else
        {
            globalLfo1ArpSyncHz = 1.0f;
            globalLfo2ArpSyncHz = 1.0f;
        }

        // Propagar parámetros precalculados a las 12 voces
        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].params          = commonParams;
            voices[i].lfo1MonoMode    = lfo1MonoMode;
            voices[i].lfo2MonoMode    = lfo2MonoMode;
            voices[i].voicePanSpread  = vcaPanSpread;
            voices[i].globalTuneCents = globalTuneCents;
            voices[i].arpClockHz      = arpClockHz;
            voices[i].lfo1ArpSyncHz   = globalLfo1ArpSyncHz;
            voices[i].lfo2ArpSyncHz   = globalLfo2ArpSyncHz;

            voices[i].drift.setDriftParams(commonParams.voiceDrift, commonParams.paramDrift, commonParams.driftRate);

            voices[i].env1VCA.setParameters(env1Att, env1Dec, env1Sus, env1Rel);
            voices[i].env1VCA.setCurves(env1AttC, env1DecC, env1SusC, env1RelC);
            voices[i].env2VCF.setParameters(env2Att, env2Dec, env2Sus, env2Rel);
            voices[i].env2VCF.setCurves(env2AttC, env2DecC, env2SusC, env2RelC);
            voices[i].env3MOD.setParameters(env3Att, env3Dec, env3Sus, env3Rel);
            voices[i].env3MOD.setCurves(env3AttC, env3DecC, env3SusC, env3RelC);

            voices[i].lfo1.setRate(lfo1RateHz);
            voices[i].lfo1.setDelay(lfo1DelaySec);
            voices[i].lfo1.setSlew(lfo1SlewVal);
            voices[i].lfo1.setShape(lfo1ShapeVal);
            voices[i].lfo1.setKeySync(lfo1KeySync);

            voices[i].lfo2.setRate(lfo2RateHz);
            voices[i].lfo2.setDelay(lfo2DelaySec);
            voices[i].lfo2.setSlew(lfo2SlewVal);
            voices[i].lfo2.setShape(lfo2ShapeVal);
            voices[i].lfo2.setKeySync(lfo2KeySync);
        }

        // Traducción de índices oficiales del hardware / WebUI (MOD_SOURCES 0..24
        // y FULL_MOD_DESTINATIONS 0..132 + extendidos >=133) a los enums internos
        // ModSource y ModDestination del motor DSP.
        auto mapHwSourceToModSource = [](int hwSrc) noexcept -> ModSource
        {
            switch (hwSrc)
            {
                case 0:  return ModSource::kNone;
                case 1:  return ModSource::kPitchBend;
                case 2:  return ModSource::kModWheel;
                case 3:  return ModSource::kFootController;
                case 4:  return ModSource::kBreathController;
                case 5:  return ModSource::kKeyPressure;
                case 6:  return ModSource::kExpressionPedal;
                case 7:  return ModSource::kLFO1;
                case 8:  return ModSource::kLFO2;
                case 9:  return ModSource::kEnv1VCA;
                case 10: return ModSource::kEnv2VCF;
                case 11: return ModSource::kEnv3MOD;
                case 12: return ModSource::kNoteNumber;
                case 13: return ModSource::kVelocity;
                case 14: return ModSource::kReleaseVelocity;
                case 15: return ModSource::kControlSequencer;
                case 16: return ModSource::kLFO1Uni;
                case 17: return ModSource::kLFO2Uni;
                case 18: return ModSource::kLFO1; // LFO 1 (Fade)
                case 19: return ModSource::kLFO2; // LFO 2 (Fade)
                case 20: return ModSource::kVoiceNumber;
                case 21: return ModSource::kVoiceNumber; // Uni Voice
                case 22: return ModSource::kCC_X;
                case 23: return ModSource::kCC_Y;
                case 24: return ModSource::kCC_Z;
                default: return ModSource::kNone;
            }
        };

        auto mapHwDestToModDestination = [](int hwDest) noexcept -> ModDestination
        {
            switch (hwDest)
            {
                case 0:  return ModDestination::kNone;
                // LFO 1 & 2 (1-8)
                case 1:  return ModDestination::kLfo1Rate;
                case 2:  return ModDestination::kLfo1Delay;
                case 3:  return ModDestination::kLfo1Slew;
                case 5:  return ModDestination::kLfo2Rate;
                case 6:  return ModDestination::kLfo2Delay;
                case 7:  return ModDestination::kLfo2Slew;
                // OSC & Porta (9-19)
                case 9:  case 10: case 11: case 12:
                    return ModDestination::kOsc1Pitch;
                case 13: case 14:
                    return ModDestination::kOsc2Pitch;
                case 16: return ModDestination::kOsc1SquareWidth;
                case 17: return ModDestination::kOsc2ToneMod;
                // VCF (20-23)
                case 20: return ModDestination::kFilterCutoff;
                case 21: return ModDestination::kFilterResonance;
                case 22: return ModDestination::kFilterEnvDepth;
                case 23: return ModDestination::kFilterLfoDepth;
                // Envelopes (24-58)
                case 25: case 35: return ModDestination::kEnv1Attack;
                case 26: case 36: return ModDestination::kEnv1Decay;
                case 27: case 37: return ModDestination::kEnv1Sustain;
                case 28: case 38: return ModDestination::kEnv1Release;
                case 43: return ModDestination::kEnv2Attack;
                case 44: return ModDestination::kEnv2Decay;
                case 45: return ModDestination::kEnv2Sustain;
                case 46: return ModDestination::kEnv2Release;
                case 51: return ModDestination::kEnv3Attack;
                case 52: return ModDestination::kEnv3Decay;
                case 53: return ModDestination::kEnv3Sustain;
                case 54: return ModDestination::kEnv3Release;
                // VCA & Common (59-72)
                case 59: case 60: return ModDestination::kAmpLevel;
                case 62: return ModDestination::kAmpPanSpread;
                case 63: return ModDestination::kAmpPan;
                case 64: return ModDestination::kOsc2Level;
                case 65: return ModDestination::kNoiseLevel;
                case 66: return ModDestination::kFilterHPFCutoff;
                case 71: return ModDestination::kArpGate;
                case 72: return ModDestination::kSeqSlew;
                // FX 1..4 Parameters (81-128) & Levels (129-132)
                default:
                    if (hwDest >= 81 && hwDest <= 92)   return ModDestination::kFx1Parameters;
                    if (hwDest >= 93 && hwDest <= 104)  return ModDestination::kFx2Parameters;
                    if (hwDest >= 105 && hwDest <= 116) return ModDestination::kFx3Parameters;
                    if (hwDest >= 117 && hwDest <= 128) return ModDestination::kFx4Parameters;
                    if (hwDest == 129) return ModDestination::kFx1Level;
                    if (hwDest == 130) return ModDestination::kFx2Level;
                    if (hwDest == 131) return ModDestination::kFx3Level;
                    if (hwDest == 132) return ModDestination::kFx4Level;
#if DEEP_TARGET_MODEL >= 2
                    // Destinos extendidos de AbyssMind Pro (>= 133)
                    if (hwDest == 133) return ModDestination::kOsc1Level;
                    if (hwDest == 134) return ModDestination::kSubOscLevel;
                    if (hwDest == 135) return ModDestination::kFilterKeyTrack;
#endif
                    return ModDestination::kNone;
            }
        };

        // Tablas estáticas sin asignaciones dinámicas para los 32 slots de la Mod Matrix
        static constexpr const char* kSlotSrcIds[32] = {
            "mod_matrix_slot1_src",  "mod_matrix_slot2_src",  "mod_matrix_slot3_src",  "mod_matrix_slot4_src",
            "mod_matrix_slot5_src",  "mod_matrix_slot6_src",  "mod_matrix_slot7_src",  "mod_matrix_slot8_src",
            "mod_matrix_slot9_src",  "mod_matrix_slot10_src", "mod_matrix_slot11_src", "mod_matrix_slot12_src",
            "mod_matrix_slot13_src", "mod_matrix_slot14_src", "mod_matrix_slot15_src", "mod_matrix_slot16_src",
            "mod_matrix_slot17_src", "mod_matrix_slot18_src", "mod_matrix_slot19_src", "mod_matrix_slot20_src",
            "mod_matrix_slot21_src", "mod_matrix_slot22_src", "mod_matrix_slot23_src", "mod_matrix_slot24_src",
            "mod_matrix_slot25_src", "mod_matrix_slot26_src", "mod_matrix_slot27_src", "mod_matrix_slot28_src",
            "mod_matrix_slot29_src", "mod_matrix_slot30_src", "mod_matrix_slot31_src", "mod_matrix_slot32_src"
        };
        static constexpr const char* kSlotDestIds[32] = {
            "mod_matrix_slot1_dest",  "mod_matrix_slot2_dest",  "mod_matrix_slot3_dest",  "mod_matrix_slot4_dest",
            "mod_matrix_slot5_dest",  "mod_matrix_slot6_dest",  "mod_matrix_slot7_dest",  "mod_matrix_slot8_dest",
            "mod_matrix_slot9_dest",  "mod_matrix_slot10_dest", "mod_matrix_slot11_dest", "mod_matrix_slot12_dest",
            "mod_matrix_slot13_dest", "mod_matrix_slot14_dest", "mod_matrix_slot15_dest", "mod_matrix_slot16_dest",
            "mod_matrix_slot17_dest", "mod_matrix_slot18_dest", "mod_matrix_slot19_dest", "mod_matrix_slot20_dest",
            "mod_matrix_slot21_dest", "mod_matrix_slot22_dest", "mod_matrix_slot23_dest", "mod_matrix_slot24_dest",
            "mod_matrix_slot25_dest", "mod_matrix_slot26_dest", "mod_matrix_slot27_dest", "mod_matrix_slot28_dest",
            "mod_matrix_slot29_dest", "mod_matrix_slot30_dest", "mod_matrix_slot31_dest", "mod_matrix_slot32_dest"
        };
        static constexpr const char* kSlotDepthIds[32] = {
            "mod_matrix_slot1_depth",  "mod_matrix_slot2_depth",  "mod_matrix_slot3_depth",  "mod_matrix_slot4_depth",
            "mod_matrix_slot5_depth",  "mod_matrix_slot6_depth",  "mod_matrix_slot7_depth",  "mod_matrix_slot8_depth",
            "mod_matrix_slot9_depth",  "mod_matrix_slot10_depth", "mod_matrix_slot11_depth", "mod_matrix_slot12_depth",
            "mod_matrix_slot13_depth", "mod_matrix_slot14_depth", "mod_matrix_slot15_depth", "mod_matrix_slot16_depth",
            "mod_matrix_slot17_depth", "mod_matrix_slot18_depth", "mod_matrix_slot19_depth", "mod_matrix_slot20_depth",
            "mod_matrix_slot21_depth", "mod_matrix_slot22_depth", "mod_matrix_slot23_depth", "mod_matrix_slot24_depth",
            "mod_matrix_slot25_depth", "mod_matrix_slot26_depth", "mod_matrix_slot27_depth", "mod_matrix_slot28_depth",
            "mod_matrix_slot29_depth", "mod_matrix_slot30_depth", "mod_matrix_slot31_depth", "mod_matrix_slot32_depth"
        };

        // Actualizar ruteos de la Mod Matrix desde la APVTS (8 Slots en DM12, 32 en AbyssMind Pro)
        for (int slot = 0; slot < ModulationMatrix::kNumSlots; ++slot)
        {
            int srcVal   = getInt(kSlotSrcIds[slot]);
            int destVal  = getInt(kSlotDestIds[slot]);
            float amount = getFloat(kSlotDepthIds[slot]);

            const ModSource fuente       = mapHwSourceToModSource(srcVal);
            const ModDestination destino = mapHwDestToModDestination(destVal);

            modMatrix.setRoute(slot, fuente, destino, amount);
        }

        // Actualizar FX Engine
        fxEngine.updateParameters(apvts);
    }
}
