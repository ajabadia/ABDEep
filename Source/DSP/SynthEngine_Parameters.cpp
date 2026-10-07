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

            // Envelopes: el motor consume DOMINIO (segundos), no normalizado. El
            // mapeo raw*maxTimeSec y las curvas viven en el spec de conversion; aqui
            // solo se pide el valor fisico. Bit-exacto con el mapeo anterior.
            voices[i].env1VCA.setParameters(
                domainOf("env1_attack", getFloat("env1_attack")),
                domainOf("env1_decay", getFloat("env1_decay")),
                getFloat("env1_sustain"),
                domainOf("env1_release", getFloat("env1_release"))
            );
            voices[i].env1VCA.setCurves(
                domainOf("env1_attack_curve", getFloat("env1_attack_curve")),
                domainOf("env1_decay_curve", getFloat("env1_decay_curve")),
                domainOf("env1_sustain_curve", getFloat("env1_sustain_curve")),
                domainOf("env1_release_curve", getFloat("env1_release_curve"))
            );

            voices[i].env2VCF.setParameters(
                domainOf("env2_attack", getFloat("env2_attack")),
                domainOf("env2_decay", getFloat("env2_decay")),
                getFloat("env2_sustain"),
                domainOf("env2_release", getFloat("env2_release"))
            );
            voices[i].env2VCF.setCurves(
                domainOf("env2_attack_curve", getFloat("env2_attack_curve")),
                domainOf("env2_decay_curve", getFloat("env2_decay_curve")),
                domainOf("env2_sustain_curve", getFloat("env2_sustain_curve")),
                domainOf("env2_release_curve", getFloat("env2_release_curve"))
            );

            voices[i].env3MOD.setParameters(
                domainOf("env3_attack", getFloat("env3_attack")),
                domainOf("env3_decay", getFloat("env3_decay")),
                getFloat("env3_sustain"),
                domainOf("env3_release", getFloat("env3_release"))
            );
            voices[i].env3MOD.setCurves(
                domainOf("env3_attack_curve", getFloat("env3_attack_curve")),
                domainOf("env3_decay_curve", getFloat("env3_decay_curve")),
                domainOf("env3_sustain_curve", getFloat("env3_sustain_curve")),
                domainOf("env3_release_curve", getFloat("env3_release_curve"))
            );

            // LFOs: rate y delay son DOMINIO (Hz, s) que da la capa de traduccion.
            // El rate del modelo Enhanced viene del spec (0.035*e^(7.5t)); el modelo
            // Classic conserva su propia curva porque el spec se sembro del Enhanced.
#if DEEP_TARGET_MODEL >= 2
            const float lfo1RateHz = domainOf("lfo1_rate", getFloat("lfo1_rate"));
            const float lfo2RateHz = domainOf("lfo2_rate", getFloat("lfo2_rate"));
#else
            static constexpr float kDefaultRateScale = 0.041f;
            static constexpr float kDefaultRateExp   = 7.3747f;
            const float lfo1RateHz = kDefaultRateScale * std::exp(kDefaultRateExp * getFloat("lfo1_rate"));
            const float lfo2RateHz = kDefaultRateScale * std::exp(kDefaultRateExp * getFloat("lfo2_rate"));
#endif
            const float lfo1DelaySec = domainOf("lfo1_delay", getFloat("lfo1_delay"));
            const float lfo2DelaySec = domainOf("lfo2_delay", getFloat("lfo2_delay"));

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

        // LFOs globales: mismo DOMINIO (Hz, s) que las voces, desde el spec.
#if DEEP_TARGET_MODEL >= 2
        const float globalLfo1RateHz = domainOf("lfo1_rate", getFloat("lfo1_rate"));
        const float globalLfo2RateHz = domainOf("lfo2_rate", getFloat("lfo2_rate"));
#else
        static constexpr float kDefaultRateScale = 0.041f;
        static constexpr float kDefaultRateExp   = 7.3747f;
        const float globalLfo1RateHz = kDefaultRateScale * std::exp(kDefaultRateExp * getFloat("lfo1_rate"));
        const float globalLfo2RateHz = kDefaultRateScale * std::exp(kDefaultRateExp * getFloat("lfo2_rate"));
#endif
        const float globalLfo1DelaySec = domainOf("lfo1_delay", getFloat("lfo1_delay"));
        const float globalLfo2DelaySec = domainOf("lfo2_delay", getFloat("lfo2_delay"));

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
        unisonDetuneBase = getFloat("unison_detune");
        unisonDetune = unisonDetuneBase;
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

        // ── ARP/SEQ ────────────────────────────────────────────────────────
        // El BPM maestro. OJO CON LAS UNIDADES: `arp_rate` esta declarado en el
        // APVTS como float de 20.0 a 275.0 (`ParametersSpec_SeqArp.cpp`), o sea
        // que getFloat YA DEVUELVE BPM y no un valor normalizado 0-1. El byte
        // de 0-255 es lo que se mapea a ese rango, y es el mismo rango que da el
        // manual (arp-sequencer.md:19). Por eso la cuenta de abajo divide por
        // sesenta tal cual, y por eso el sync de los LFO puede recibirlo directo.
        masterBpm = std::max(20.0f, getFloat("arp_rate"));

        // Multiplicadores = negras por pulso (1 / ratio de nota). Tabla hardware arp-sequencer.md:44-60.
        static const float clockMultipliers[13] = {
            0.5f, 2.0f / 3.0f, 0.75f, 1.0f, 4.0f / 3.0f, 1.5f, 2.0f,
            8.0f / 3.0f, 3.0f, 4.0f, 6.0f, 8.0f, 12.0f
        };
        const int arpClockDiv = std::clamp(getInt("arp_clock_divider"), 0, 12);
        arpClockHz = (masterBpm / 60.0f) * clockMultipliers[arpClockDiv];
        arpClockHz = std::max(arpClockHz, 0.01f);

        // Propagar arpClockHz a todas las voces
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].arpClockHz = arpClockHz;

        // El arpegiador. El gate del panel se guarda aparte porque la matriz le
        // suma encima muestra a bloque en `processBlock` (destino 71).
        // El gate del panel llega en 0-255 y el arpegiador lo quiere en 0-1:
        // el manual dice que 128 es medio paso, y 128/255 es esa mitad.
        arpGateBase = getFloat("arp_gate_time") / 255.0f;
        arpeggiator.setEnabled(getBool("arp_enable"));
        arpeggiator.setMode(getInt("arp_mode"));
        arpeggiator.setStepRateHz(arpClockHz);
        arpeggiator.setGate(arpGateBase);
        arpeggiator.setHold(getBool("arp_hold"));
        arpeggiator.setKeySync(getBool("arp_key_sync"));
        arpeggiator.setOctaves(getInt("arp_octave") + 1);   // el byte va de 0 a 3 = 1 a 4 octavas
        arpeggiator.setSwing(getFloat("arp_swing") / 25.0f);   // el mando va de 0 a 25

        // El secuenciador de control (NRPN 117-154).
        controlSequencer.setEnabled(getBool("seq_enable"));
        controlSequencer.setClockDivider(getInt("seq_clock"));
        controlSequencer.setLength(getInt("seq_length") + 1);   // el byte va de 0 a 31 = 1 a 32 pasos
        controlSequencer.setSwing(getFloat("seq_swing") / 25.0f);   // el mando va de 0 a 25
        controlSequencer.setKeyLoopMode(getInt("seq_key_loop"));
        controlSequencer.setSlewRate(getFloat("seq_slew_rate") / 255.0f);   // el mando va de 0 a 255
        controlSequencer.setMasterBpm(masterBpm);

        // Los 32 pasos. En el APVTS estan declarados como float de -1.0 a 1.0,
        // que es justo el bipolar del manual (`valor - 128`), asi que getFloat
        // lo devuelve como va y no hay que convertirlo otra vez.
        static const char* kNombresPaso[32] = {
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
            float lfo1SyncHz = SynthEngine::lfoArpSyncHzFromRate(getFloat("lfo1_rate"), masterBpm);
            float lfo2SyncHz = SynthEngine::lfoArpSyncHzFromRate(getFloat("lfo2_rate"), masterBpm);
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

            // El byte de destino se castea tal cual porque SU VALOR ES EL
            // CÓDIGO del destino (ver `ModDestination`), y por eso hay que
            // mirarlo antes de mirar nada más.
            //
            // Y POR QUÉ HAY QUE COMPROBARLO. El enum tiene más entradas que
            // códigos del byte: detrás de 132 hay tres capacidades del motor que
            // el manual no da como destino de modulación (nivel del oscilador
            // 1, nivel del sub-oscilador y seguimiento de teclado del filtro).
            // Sin esta comprobación, un parche con un destino corrupto —o un
            // destino escrito a mano por encima de 132— caería en una de las tres
            // y modularía algo que el usuario no eligió. El bus se apaga en vez
            // de sonar lo que no es.
            //
            // Lo mismo con la fuente: `getModulationValue` ya se salta los
            // índices que no son fuente válida, pero un valor fuera de rango
            // aquí significa un parche roto y conviene que no llegue al bus.
            const ModDestination destino = (destVal >= 0 && destVal < static_cast<int>(ModDestination::kMaxDestinations))
                                             ? static_cast<ModDestination>(destVal)
                                             : ModDestination::kNone;

            const ModSource fuente = (srcVal >= 0 && srcVal < static_cast<int>(ModSource::kMaxSources))
                                          ? static_cast<ModSource>(srcVal)
                                          : ModSource::kNone;

            modMatrix.setRoute(slot, fuente, destino, amount);
        }

        // Actualizar FX Engine
        fxEngine.updateParameters(apvts);
    }
}
