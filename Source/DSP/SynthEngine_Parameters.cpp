#include "SynthEngine.h"
#include <algorithm>

namespace ABD
{
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

    void SynthEngine::updateParameters(juce::AudioProcessorValueTreeState& apvts)
    {
        // Lambda auxiliar para leer floats
        auto getFloat = [&](const juce::String& id) -> float {
            if (auto* param = apvts.getRawParameterValue(id))
                return param->load();
            jassertfalse; // Parámetro no encontrado — revisar ParametersSpec
            return 0.0f;
        };

        // Lambda auxiliar para leer bools
        auto getBool = [&](const juce::String& id) -> bool {
            if (auto* param = apvts.getRawParameterValue(id))
                return param->load() > 0.5f;
            jassertfalse; // Parámetro no encontrado — revisar ParametersSpec
            return false;
        };

        // Lambda auxiliar para leer enums (AudioParameterChoice)
        auto getInt = [&](const juce::String& id) -> int {
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

        // Actualizar parámetros comunes para todas las voces
        for (int i = 0; i < kNumVoices; ++i)
        {
            auto& p = voices[i].params;

            // OSC 1
            p.osc1SawEnable = getBool("osc1_saw_enable");
            p.osc1PulseEnable = getBool("osc1_square_enable");
            p.osc1PwmAmount = getFloat("osc1_pwm_amount");
            p.osc1Range = getInt("osc1_range");
            p.osc1PitchMod = getFloat("osc1_pitch_mod");
            p.osc1PmSource = std::clamp(getInt("osc1_pm_source"), 0, 6);
            p.osc1PwmSource = std::clamp(getInt("osc1_pwm_source"), 0, 5);
            p.osc1PmMode = std::clamp(getInt("osc1_pm_mode"), 0, 1);
            p.osc1LfoAftertouch = getFloat("osc1_lfo_aftertouch");
            p.osc1LfoModwheel = getFloat("osc1_lfo_modwheel");

            // OSC 2
            p.osc2Pitch = getFloat("osc2_pitch");
            p.osc2ToneMod = getFloat("osc2_tone_mod");
            p.osc2Level = getFloat("osc2_level");
            p.osc2PitchMod = getFloat("osc2_pitch_mod");
            p.osc2Range = getInt("osc2_range");
            p.osc2PmSource = std::clamp(getInt("osc2_pm_source"), 0, 6);
            p.osc2TpmSource = std::clamp(getInt("osc2_tpm_source"), 0, 5);
            p.osc2AftertouchPitch = getFloat("osc2_aftertouch_pitch");
            p.osc2ModwheelPitch = getFloat("osc2_modwheel_pitch");

            // Global/Noise/Sub
            p.oscSync = getBool("osc_sync_enable");
            p.noiseLevel = getFloat("noise_level");
            p.subLevel = getFloat("sub_level");

            // VCF
            p.vcfCutoff = getFloat("vcf_cutoff");
            p.vcfResonance = getFloat("vcf_resonance");
            p.vcfPoleMode = getInt("vcf_pole_mode");
            p.vcfOversample = std::clamp(getInt("vcf_oversample"), 0, 2);
#if DEEP_TARGET_MODEL >= 2
            p.vcfModel = std::clamp(getInt("vcf_model"), 0, 2);
            p.vcfMoogSubMode = std::clamp(getInt("vcf_moog_submode"), 0, 2);
            p.vcfKorgSubMode = std::clamp(getInt("vcf_korg_submode"), 0, 1);
#endif
            p.vcfVoicingMode = getInt("vcf_voicing_mode");
            p.vcfEnvDepth = getFloat("vcf_env_depth");
            p.vcfEnvVel = getFloat("vcf_env_vel");
            p.vcfLfoDepth = getFloat("vcf_lfo_depth");
            p.vcfLfoSelect = getInt("vcf_lfo_select");
            p.vcfEnvPolarity = getInt("vcf_env_polarity");
            p.vcfKeyTrack = getFloat("vcf_key_tracking");
            p.vcfPitchBend = getFloat("vcf_pitch_bend");
            p.vcfAftertouchLfo = getFloat("vcf_aftertouch_lfo");
            p.vcfModwheelLfo = getFloat("vcf_modwheel_lfo");

            // HPF (params con rango físico: cutoff 20-2000 Hz, bass boost gain 0.1-3.0)
            p.hpfCutoff = getFloat("hpf_cutoff");
            p.hpfBassBoost = getBool("hpf_boost_enable");
            p.hpfBassBoostGain = getFloat("hpf_bass_boost_gain");

            // VCA
            p.vcaLevel = getFloat("vca_level");
            p.vcaMode = getInt("vca_mode");
            p.vcaEnvDepth = getFloat("vca_env_depth");
            p.vcaVelSens = getFloat("vca_vel_sens");

            // Analog Drift
            p.voiceDrift = getFloat("voice_drift");
            p.paramDrift = getFloat("param_drift");
            p.driftRate = getFloat("drift_rate");

            // Sincronizar drift engine de cada voz
            voices[i].drift.setDriftParams(p.voiceDrift, p.paramDrift, p.driftRate);

            // Sincronizar Envelopes con mapeo lineal físico (hardware DM12: raw/255*10 = 0-10s)
#if DEEP_TARGET_MODEL >= 2
            const auto& cal = activeCalibration;
#else
            struct { struct { struct { float maxTimeSec; } envelopes;
                               struct { float rateScale, rateExp; } lfo; } transfer; } cal;
            cal.transfer.envelopes.maxTimeSec = 10.0f;
            cal.transfer.lfo = { 0.041f, 7.3747f };
#endif
            auto mapEnvTime = [&cal](float rawVal) -> float {
                float normVal = juce::jlimit(0.0f, 1.0f, rawVal);
                return normVal * cal.transfer.envelopes.maxTimeSec;
            };

            voices[i].env1VCA.setParameters(
                mapEnvTime(getFloat("env1_attack")),
                mapEnvTime(getFloat("env1_decay")),
                getFloat("env1_sustain"),
                mapEnvTime(getFloat("env1_release"))
            );
            voices[i].env1VCA.setCurves(
                (getFloat("env1_attack_curve") - 0.5f) * 2.0f,
                (getFloat("env1_decay_curve") - 0.5f) * 2.0f,
                (getFloat("env1_sustain_curve") - 0.5f) * 2.0f,
                (getFloat("env1_release_curve") - 0.5f) * 2.0f
            );

            voices[i].env2VCF.setParameters(
                mapEnvTime(getFloat("env2_attack")),
                mapEnvTime(getFloat("env2_decay")),
                getFloat("env2_sustain"),
                mapEnvTime(getFloat("env2_release"))
            );
            voices[i].env2VCF.setCurves(
                (getFloat("env2_attack_curve") - 0.5f) * 2.0f,
                (getFloat("env2_decay_curve") - 0.5f) * 2.0f,
                (getFloat("env2_sustain_curve") - 0.5f) * 2.0f,
                (getFloat("env2_release_curve") - 0.5f) * 2.0f
            );

            voices[i].env3MOD.setParameters(
                mapEnvTime(getFloat("env3_attack")),
                mapEnvTime(getFloat("env3_decay")),
                getFloat("env3_sustain"),
                mapEnvTime(getFloat("env3_release"))
            );
            voices[i].env3MOD.setCurves(
                (getFloat("env3_attack_curve") - 0.5f) * 2.0f,
                (getFloat("env3_decay_curve") - 0.5f) * 2.0f,
                (getFloat("env3_sustain_curve") - 0.5f) * 2.0f,
                (getFloat("env3_release_curve") - 0.5f) * 2.0f
            );

            // Sincronizar LFOs con mapeo físico real (DeepMind 12 specs)
#if DEEP_TARGET_MODEL >= 2
            float lfo1RateHz = activeCalibration.transfer.lfo.rateScale * std::exp(activeCalibration.transfer.lfo.rateExp * getFloat("lfo1_rate"));
            float lfo1DelaySec = getFloat("lfo1_delay") * 6.59f;
            float lfo2RateHz = activeCalibration.transfer.lfo.rateScale * std::exp(activeCalibration.transfer.lfo.rateExp * getFloat("lfo2_rate"));
            float lfo2DelaySec = getFloat("lfo2_delay") * 6.59f;
#else
            static constexpr float kDefaultRateScale = 0.041f;
            static constexpr float kDefaultRateExp   = 7.3747f;
            float lfo1RateHz = kDefaultRateScale * std::exp(kDefaultRateExp * getFloat("lfo1_rate"));
            float lfo1DelaySec = getFloat("lfo1_delay") * 6.59f;
            float lfo2RateHz = kDefaultRateScale * std::exp(kDefaultRateExp * getFloat("lfo2_rate"));
            float lfo2DelaySec = getFloat("lfo2_delay") * 6.59f;
#endif

            voices[i].lfo1.setRate(lfo1RateHz);
            voices[i].lfo1.setDelay(lfo1DelaySec);
            voices[i].lfo1.setSlew(getFloat("lfo1_slew"));
            voices[i].lfo1.setShape(getInt("lfo1_shape"));
            voices[i].lfo1.setKeySync(getBool("lfo1_key_sync"));

            voices[i].lfo2.setRate(lfo2RateHz);
            voices[i].lfo2.setDelay(lfo2DelaySec);
            voices[i].lfo2.setSlew(getFloat("lfo2_slew"));
            voices[i].lfo2.setShape(getInt("lfo2_shape"));
            voices[i].lfo2.setKeySync(getBool("lfo2_key_sync"));
        }

        // Leer modo Mono/Spread para LFOs globales
        lfo1MonoMode = getFloat("lfo1_mono_mode");
        lfo2MonoMode = getFloat("lfo2_mono_mode");

        // Calcular mapeo físico para LFOs globales
#if DEEP_TARGET_MODEL >= 2
        float globalLfo1RateHz = activeCalibration.transfer.lfo.rateScale * std::exp(activeCalibration.transfer.lfo.rateExp * getFloat("lfo1_rate"));
        float globalLfo1DelaySec = getFloat("lfo1_delay") * 6.59f;
        float globalLfo2RateHz = activeCalibration.transfer.lfo.rateScale * std::exp(activeCalibration.transfer.lfo.rateExp * getFloat("lfo2_rate"));
        float globalLfo2DelaySec = getFloat("lfo2_delay") * 6.59f;
#else
        static constexpr float kDefaultRateScale = 0.041f;
        static constexpr float kDefaultRateExp   = 7.3747f;
        float globalLfo1RateHz = kDefaultRateScale * std::exp(kDefaultRateExp * getFloat("lfo1_rate"));
        float globalLfo1DelaySec = getFloat("lfo1_delay") * 6.59f;
        float globalLfo2RateHz = kDefaultRateScale * std::exp(kDefaultRateExp * getFloat("lfo2_rate"));
        float globalLfo2DelaySec = getFloat("lfo2_delay") * 6.59f;
#endif

        // Sincronizar LFOs globales con los mismos parámetros que las voces
        globalLfo1.setRate(globalLfo1RateHz);
        globalLfo1.setDelay(globalLfo1DelaySec);
        globalLfo1.setSlew(getFloat("lfo1_slew"));
        globalLfo1.setShape(getInt("lfo1_shape"));
        globalLfo1.setKeySync(getBool("lfo1_key_sync"));

        globalLfo2.setRate(globalLfo2RateHz);
        globalLfo2.setDelay(globalLfo2DelaySec);
        globalLfo2.setSlew(getFloat("lfo2_slew"));
        globalLfo2.setShape(getInt("lfo2_shape"));
        globalLfo2.setKeySync(getBool("lfo2_key_sync"));

        // Configurar el modo Mono/Spread en cada voz
        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].lfo1MonoMode = lfo1MonoMode;
            voices[i].lfo2MonoMode = lfo2MonoMode;
        }

        // Leer parámetros de Voice Mode y Unison
        voiceMode = std::clamp(getInt("voice_mode"), 0, 12);
        unisonDetune = getFloat("unison_detune");
        vcaPanSpread = getFloat("vca_pan_spread");

        // Propagar vcaPanSpread a todas las voces
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].voicePanSpread = vcaPanSpread;

        // Leer parámetros de Chord Memory
        chordEnable = getBool("chord_enable");
        polyChordEnable = getBool("poly_chord_enable");
        chordKey = std::clamp(getInt("chord_key"), 0, 11);
        chordType = std::clamp(getInt("chord_type"), 0, 7);
        
        if (!polyChordEnable)
        {
            // Si Poly Chord se desactiva, limpiar el acumulador de notas
            polyChordNoteCount = 0;
            std::memset(polyChordHeldNotes, 0, sizeof(polyChordHeldNotes));
        }

        // Leer Transpose & Global Tune
        transposeSemitones = (int)std::round(getFloat("transpose"));
        globalTuneCents = getFloat("global_tune");

        // Propagar globalTuneCents a todas las voces
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].globalTuneCents = globalTuneCents;

        // Master Gain — permite boost hasta 2x (para presets que necesiten ganancia extra)
        globalVolume = std::clamp(getFloat("global_volume"), 0.0f, 2.0f);

        // Global HPF (post-VCA) — base física del cutoff y bass boost del módulo HPF
        globalHpfCutoffHz = getFloat("hpf_cutoff");
        globalHpfBassBoost = getBool("hpf_boost_enable");
        globalHpfBassBoostGain = getFloat("hpf_bass_boost_gain");

        // Master Soft-Clip — bypass y headroom configurable (0..1 → 0..6 dB)
        masterSoftclipBypass = getBool("master_softclip_bypass");
        masterSoftclipHeadroom = std::clamp(getFloat("master_softclip_headroom"), 0.0f, 1.0f);

        // Leer parámetros del arpegiador para Arp Sync de LFOs
        float arpRate = getFloat("arp_rate");
        int arpClockDiv = std::clamp(getInt("arp_clock_divider"), 0, 12);
        // Multiplicadores = negras por pulso (1 / ratio de nota). Tabla hardware arp-sequencer.md:44-60.
        static const float clockMultipliers[13] = {
            0.5f, 2.0f / 3.0f, 0.75f, 1.0f, 4.0f / 3.0f, 1.5f, 2.0f,
            8.0f / 3.0f, 3.0f, 4.0f, 6.0f, 8.0f, 12.0f
        };
        arpClockHz = (arpRate / 60.0f) * clockMultipliers[arpClockDiv];
        arpClockHz = std::max(arpClockHz, 0.01f);

        // Propagar arpClockHz a todas las voces
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].arpClockHz = arpClockHz;

        // Leer Note Priority, Trigger Mode y Pitch Bend Range
        notePriority = std::clamp(getInt("note_priority"), 0, 2);
        float pitchBendUp = getFloat("pitch_bend_up");
        float pitchBendDown = getFloat("pitch_bend_down");
        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].params.triggerMode = std::clamp(getInt("trigger_mode"), 0, 3);
            voices[i].params.oscKeyReset = getBool("osc_key_reset");
            voices[i].params.pitchBendUp = pitchBendUp;
            voices[i].params.pitchBendDown = pitchBendDown;
            voices[i].params.env1TriggerMode = std::clamp(getInt("env1_trigger_mode"), 0, 4);
            voices[i].params.env2TriggerMode = std::clamp(getInt("env2_trigger_mode"), 0, 4);
            voices[i].params.env3TriggerMode = std::clamp(getInt("env3_trigger_mode"), 0, 4);
            voices[i].params.lfo1ArpSync = getBool("lfo1_arp_sync");
            voices[i].params.lfo2ArpSync = getBool("lfo2_arp_sync");
        }

        // Verificar si alguna voz tiene arp sync activo — tras asignar lfo1ArpSync/lfo2ArpSync,
        // para no quedarnos una update por detrás (stale timing).
        arpSyncActive = false;
        for (int i = 0; i < kNumVoices && !arpSyncActive; ++i)
            arpSyncActive = voices[i].params.lfo1ArpSync || voices[i].params.lfo2ArpSync;

        // LFO Arp Sync: derivar frecuencias desde la tabla de Clock Divide del hardware
        // (docs lfos.md:23-48), basada en el Master BPM, no en el reloj de arp.
        if (arpSyncActive)
        {
            float lfo1SyncHz = SynthEngine::lfoArpSyncHzFromRate(getFloat("lfo1_rate"), arpRate);
            float lfo2SyncHz = SynthEngine::lfoArpSyncHzFromRate(getFloat("lfo2_rate"), arpRate);
            globalLfo1ArpSyncHz = lfo1SyncHz;
            globalLfo2ArpSyncHz = lfo2SyncHz;
            for (int i = 0; i < kNumVoices; ++i)
            {
                voices[i].lfo1ArpSyncHz = lfo1SyncHz;
                voices[i].lfo2ArpSyncHz = lfo2SyncHz;
            }
        }
        else
        {
            globalLfo1ArpSyncHz = 1.0f;
            globalLfo2ArpSyncHz = 1.0f;
            for (int i = 0; i < kNumVoices; ++i)
            {
                voices[i].lfo1ArpSyncHz = 1.0f;
                voices[i].lfo2ArpSyncHz = 1.0f;
            }
        }

        // Leer y propagar parámetros de Portamento / Glide
        globalPortamentoTime = getFloat("global_portamento");
        portaMode = std::clamp(getInt("porta_mode"), 0, 13);
        portaOscBal = getFloat("porta_osc_bal");
        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].params.portaTime = globalPortamentoTime;
            voices[i].params.portaMode = portaMode;
            voices[i].params.portaOscBal = portaOscBal;
        }

        // Actualizar ruteos de la Mod Matrix desde la APVTS (8 Slots)
        for (int slot = 0; slot < ModulationMatrix::kNumSlots; ++slot)
        {
            juce::String prefix = "mod_matrix_slot" + juce::String(slot + 1);
            int srcVal = getInt(prefix + "_src");
            int destVal = getInt(prefix + "_dest");
            float amount = getFloat(prefix + "_depth");

            modMatrix.setRoute(slot, 
                               static_cast<ModSource>(srcVal), 
                               static_cast<ModDestination>(destVal), 
                               amount);
        }

        // Actualizar FX Engine
        fxEngine.updateParameters(apvts);
    }
}
