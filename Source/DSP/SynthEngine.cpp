#include "SynthEngine.h"
#include <algorithm>
#include <cstring>
#include <map>

namespace ABD
{
    SynthEngine::SynthEngine()
    {
        std::memset(polyChordHeldNotes, 0, sizeof(polyChordHeldNotes));
    }

    void SynthEngine::prepare(double newSampleRate, int newSamplesPerBlock)
    {
        sampleRate = newSampleRate;
        samplesPerBlock = newSamplesPerBlock;

        for (int i = 0; i < kNumVoices; ++i)
        {
            voices[i].prepare(sampleRate);
        }

        // Preparar LFOs globales
        globalLfo1.setSampleRate(sampleRate);
        globalLfo2.setSampleRate(sampleRate);
        globalLfo1Buffer.resize(samplesPerBlock);
        globalLfo2Buffer.resize(samplesPerBlock);

        // Preparar FX Engine
        fxEngine.prepare(sampleRate, samplesPerBlock);
    }

    void SynthEngine::updateParameters(juce::AudioProcessorValueTreeState& apvts)
    {
        // Lambda auxiliar para leer floats
        auto getFloat = [&](const juce::String& id) -> float {
            if (auto* param = apvts.getRawParameterValue(id))
                return param->load();
            return 0.0f;
        };

        // Lambda auxiliar para leer bools
        auto getBool = [&](const juce::String& id) -> bool {
            if (auto* param = apvts.getRawParameterValue(id))
                return param->load() > 0.5f;
            return false;
        };

        // Lambda auxiliar para leer enums (AudioParameterChoice)
        auto getInt = [&](const juce::String& id) -> int {
            if (auto* param = apvts.getParameter(id))
                if (auto* choice = dynamic_cast<juce::AudioParameterChoice*>(param))
                    return choice->getIndex();
            return 0;
        };

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
            p.vcfPoleMode = getInt("vcf_pole_mode"); // 0=4-Pole(24dB), 1=2-Pole(12dB) — labels ya coinciden con Filter.cpp
            p.vcfEnvDepth = getFloat("vcf_env_depth");
            p.vcfEnvVel = getFloat("vcf_env_vel");
            p.vcfLfoDepth = getFloat("vcf_lfo_depth");
            p.vcfLfoSelect = getInt("vcf_lfo_select");
            p.vcfEnvPolarity = getInt("vcf_env_polarity");
            p.vcfKeyTrack = getFloat("vcf_key_tracking");
            p.vcfPitchBend = getFloat("vcf_pitch_bend");
            p.vcfAftertouchLfo = getFloat("vcf_aftertouch_lfo");
            p.vcfModwheelLfo = getFloat("vcf_modwheel_lfo");

            // HPF
            p.hpfCutoff = getFloat("hpf_cutoff");
            p.hpfBassBoost = getBool("hpf_boost_enable");

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

            // Sincronizar Envelopes de forma directa
            voices[i].env1VCA.setParameters(
                getFloat("env1_attack"),
                getFloat("env1_decay"),
                getFloat("env1_sustain"),
                getFloat("env1_release")
            );
            voices[i].env1VCA.setCurves(
                getFloat("env1_attack_curve"),
                getFloat("env1_decay_curve"),
                getFloat("env1_sustain_curve"),
                getFloat("env1_release_curve")
            );

            voices[i].env2VCF.setParameters(
                getFloat("env2_attack"),
                getFloat("env2_decay"),
                getFloat("env2_sustain"),
                getFloat("env2_release")
            );
            voices[i].env2VCF.setCurves(
                getFloat("env2_attack_curve"),
                getFloat("env2_decay_curve"),
                getFloat("env2_sustain_curve"),
                getFloat("env2_release_curve")
            );

            voices[i].env3MOD.setParameters(
                getFloat("env3_attack"),
                getFloat("env3_decay"),
                getFloat("env3_sustain"),
                getFloat("env3_release")
            );
            voices[i].env3MOD.setCurves(
                getFloat("env3_attack_curve"),
                getFloat("env3_decay_curve"),
                getFloat("env3_sustain_curve"),
                getFloat("env3_release_curve")
            );

            // Sincronizar LFOs
            voices[i].lfo1.setRate(getFloat("lfo1_rate"));
            voices[i].lfo1.setDelay(getFloat("lfo1_delay"));
            voices[i].lfo1.setSlew(getFloat("lfo1_slew"));
            voices[i].lfo1.setShape(getInt("lfo1_shape"));
            voices[i].lfo1.setKeySync(getBool("lfo1_key_sync"));

            voices[i].lfo2.setRate(getFloat("lfo2_rate"));
            voices[i].lfo2.setDelay(getFloat("lfo2_delay"));
            voices[i].lfo2.setSlew(getFloat("lfo2_slew"));
            voices[i].lfo2.setShape(getInt("lfo2_shape"));
            voices[i].lfo2.setKeySync(getBool("lfo2_key_sync"));
        }

        // Leer modo Mono/Spread para LFOs globales
        lfo1MonoMode = getFloat("lfo1_mono_mode");
        lfo2MonoMode = getFloat("lfo2_mono_mode");

        // Sincronizar LFOs globales con los mismos parámetros que las voces
        globalLfo1.setRate(getFloat("lfo1_rate"));
        globalLfo1.setDelay(getFloat("lfo1_delay"));
        globalLfo1.setSlew(getFloat("lfo1_slew"));
        globalLfo1.setShape(getInt("lfo1_shape"));
        globalLfo1.setKeySync(getBool("lfo1_key_sync"));

        globalLfo2.setRate(getFloat("lfo2_rate"));
        globalLfo2.setDelay(getFloat("lfo2_delay"));
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
        transposeSemitones = (int)std::round(getFloat("transpose") * 96.0f - 48.0f);
        globalTuneCents = getFloat("global_tune") * 255.0f - 128.0f;

        // Propagar globalTuneCents a todas las voces
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].globalTuneCents = globalTuneCents;

        // Master Gain
        globalVolume = std::clamp(getFloat("global_volume"), 0.0f, 1.0f);

        // Leer parámetros del arpegiador para Arp Sync de LFOs
        float arpRate = getFloat("arp_rate");               // 20-275 BPM
        int arpClockDiv = std::clamp(getInt("arp_clock_divider"), 0, 12);
        // Mapa de multiplicadores: cuántos ticks de reloj por negra para cada división
        static const float clockMultipliers[13] = {
            0.25f, 0.5f, 0.75f, 1.0f, 1.5f, 2.0f, 3.0f,
            4.0f, 6.0f, 8.0f, 12.0f, 16.0f, 24.0f
        };
        arpClockHz = (arpRate / 60.0f) * clockMultipliers[arpClockDiv];
        arpClockHz = std::max(arpClockHz, 0.01f); // evitar división por cero

        // Propagar arpClockHz a todas las voces
        for (int i = 0; i < kNumVoices; ++i)
            voices[i].arpClockHz = arpClockHz;

        // Verificar si alguna voz tiene arp sync activo (para global LFOs en Mono mode)
        arpSyncActive = false;
        for (int i = 0; i < kNumVoices && !arpSyncActive; ++i)
            arpSyncActive = voices[i].params.lfo1ArpSync || voices[i].params.lfo2ArpSync;

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

    // ========== Chord Intervals ==========
    // Intervalos en semitonos desde la tónica para cada tipo de acorde
    static const int kChordTable[8][6] = {
        { 0, 4, 7, 12, 16, 19 },  // 0 Memory
        { 0, 4, 7, -1, -1, -1 },  // 1 Major
        { 0, 3, 7, -1, -1, -1 },  // 2 Minor
        { 0, 4, 8, -1, -1, -1 },  // 3 Aug (major 3rd + aug 5th)
        { 0, 3, 6, -1, -1, -1 },  // 4 Dim (minor 3rd + dim 5th)
        { 0, 2, 7, -1, -1, -1 },  // 5 Sus2 (root + M2 + P5)
        { 0, 5, 7, -1, -1, -1 },  // 6 Sus4 (root + P4 + P5)
        { 0, 4, 7, 10, -1, -1 },  // 7 7th (major triad + m7)
    };

    const int* SynthEngine::getChordIntervals(int type, int& numNotes)
    {
        int idx = std::clamp(type, 0, 7);
        numNotes = 0;
        for (int i = 0; i < 6; ++i)
        {
            if (kChordTable[idx][i] < 0) break;
            numNotes++;
        }
        return kChordTable[idx];
    }

    // ========== Voice Mode Helpers ==========

    int SynthEngine::getVoicesPerNote(int mode)
    {
        switch (mode)
        {
            case 0:  return 1;   // Poly
            case 1:  return 2;   // Uni2
            case 2:  return 3;   // Uni3
            case 3:  return 4;   // Uni4
            case 4:  return 6;   // Uni6
            case 5:  return 12;  // Uni12
            case 6:  return 1;   // Mono
            case 7:  return 2;   // Mono2
            case 8:  return 3;   // Mono3
            case 9:  return 4;   // Mono4
            case 10: return 6;   // Mono6
            case 11: return 1;   // Poly6
            case 12: return 1;   // Poly8
            default: return 1;
        }
    }

    void SynthEngine::getUnisonParams(int voiceInGroup, int totalInGroup,
                                       float& detuneSemitones,
                                       float& panPosition) const
    {
        if (totalInGroup <= 1)
        {
            detuneSemitones = 0.0f;
            panPosition = 0.5f;
            return;
        }

        // Detune simétrico: ±0..±50 cents
        float maxDetuneCents = unisonDetune * 50.0f;
        if (totalInGroup == 2)
        {
            detuneSemitones = (voiceInGroup == 0) ? -maxDetuneCents / 100.0f
                                                   :  maxDetuneCents / 100.0f;
        }
        else
        {
            float step = 2.0f * maxDetuneCents / (float)(totalInGroup - 1);
            detuneSemitones = (-maxDetuneCents + (float)voiceInGroup * step) / 100.0f;
        }

        // Pan: spread uniforme a través del campo estéreo
        if (totalInGroup == 2)
        {
            panPosition = (voiceInGroup == 0) ? 0.0f : 1.0f;
        }
        else
        {
            panPosition = (float)voiceInGroup / (float)(totalInGroup - 1);
        }
    }

    // ========== Chord Helpers ==========

    void SynthEngine::triggerChordForRoot(int rootNote, int numChordNotes, const int* intervals, float velocity)
    {
        int voicesPerNote = getVoicesPerNote(voiceMode);
        // Nota: con acordes grandes (6 notas) + Unison stacking (ej. Uni3 = 18 voces)
        // el límite de 12 voces totales causará voice stealing. El chord aún suena
        // pero con menos voces apiladas de las solicitadas.

        for (int iv = 0; iv < numChordNotes && intervals[iv] >= 0; ++iv)
        {
            int chordNote = std::clamp(rootNote + intervals[iv], 0, 127);

            for (int v = 0; v < voicesPerNote; ++v)
            {
                int voiceIdx = findFreeVoice();
                if (voiceIdx < 0 || voiceIdx >= kNumVoices)
                    break;

                float voiceNormalized = (float)voiceIdx / (float)(kNumVoices - 1);

                float detuneST = 0.0f;
                float panPos = 0.5f;
                if (voicesPerNote > 1)
                    getUnisonParams(v, voicesPerNote, detuneST, panPos);

                voices[voiceIdx].unisonDetuneSemitones = detuneST;
                voices[voiceIdx].unisonPanPosition = panPos;
                voices[voiceIdx].startNote(chordNote, velocity, voiceNormalized);

                voices[voiceIdx].setExternalModulation(ModSource::kPitchBend, currentPitchBend);
                voices[voiceIdx].setExternalModulation(ModSource::kModWheel, currentModWheel);
                voices[voiceIdx].setExternalModulation(ModSource::kKeyPressure, currentAftertouch);
                voices[voiceIdx].setExternalModulation(ModSource::kSustainPedal, currentSustainPedal);
            }
        }
    }

    // ========== Voice Allocation ==========

    int SynthEngine::findFreeVoice()
    {
        for (int i = 0; i < kNumVoices; ++i)
        {
            if (!voices[i].isActive())
                return i;
        }
        return 0; // steal oldest
    }

    void SynthEngine::triggerNote(int midiNoteNumber, float velocity)
    {
        // --- Chord Memory / Poly Chord expansion ---
        if (chordEnable || polyChordEnable)
        {
            int numChordNotes = 0;
            const int* intervals = getChordIntervals(chordType, numChordNotes);
            
            if (polyChordEnable)
            {
                // Poly Chord: acumular notas raíz
                if (polyChordNoteCount < kMaxChordNotes)
                {
                    // Verificar que la nota no esté ya en el acumulador
                    bool alreadyHeld = false;
                    for (int h = 0; h < polyChordNoteCount; ++h)
                    {
                        if (polyChordHeldNotes[h] == midiNoteNumber)
                        {
                            alreadyHeld = true;
                            break;
                        }
                    }
                    if (!alreadyHeld)
                    {
                        polyChordHeldNotes[polyChordNoteCount++] = midiNoteNumber;
                    }
                }

                // Forzar release de todas las voces anteriores del Poly Chord
                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive())
                        voices[i].stopNote(true);
                }

                // Re-trigger el acorde completo con todas las raíces acumuladas
                for (int h = 0; h < polyChordNoteCount; ++h)
                {
                    triggerChordForRoot(polyChordHeldNotes[h], numChordNotes, intervals, velocity);
                }
            }
            else
            {
                // Chord Memory simple: expandir la nota única en acorde
                if (voiceMode >= 6 && voiceMode <= 10)
                {
                    // Mono: force-stop todas las voces anteriores
                    for (int i = 0; i < kNumVoices; ++i)
                    {
                        if (voices[i].isActive())
                            voices[i].stopNote(true);
                    }
                }
                triggerChordForRoot(midiNoteNumber, numChordNotes, intervals, velocity);
            }
            
            // Emitir note-on para la UI web
            pendingNoteOnNote.store(midiNoteNumber, std::memory_order_release);
            pendingNoteOnVel.store(velocity, std::memory_order_release);

            DBG("[SynthEngine] triggerNote (Chord): note=" + juce::String(midiNoteNumber)
                + " type=" + juce::String(chordType)
                + " notes=" + juce::String(numChordNotes)
                + " poly=" + juce::String(polyChordNoteCount));
            return;
        }

        // --- Normal note trigger (no chord) ---
        int voicesPerNote = getVoicesPerNote(voiceMode);

        // En modos Mono: aplicar note_priority y forzar stop
        if (voiceMode >= 6 && voiceMode <= 10)
        {
            // Track held notes for priority decisions
            bool alreadyHeld = false;
            for (int h = 0; h < monoHeldNoteCount; ++h)
            {
                if (monoHeldNotes[h] == midiNoteNumber)
                {
                    alreadyHeld = true;
                    break;
                }
            }
            if (!alreadyHeld && monoHeldNoteCount < 12)
                monoHeldNotes[monoHeldNoteCount++] = midiNoteNumber;

            // Priority filtering: decide if this note should actually play
            bool shouldPlay = true;
            if (notePriority == 0 && monoHeldNoteCount > 1) // Lowest
            {
                // Only play if this note is the lowest held
                for (int h = 0; h < monoHeldNoteCount; ++h)
                {
                    if (monoHeldNotes[h] < midiNoteNumber)
                    {
                        shouldPlay = false; // A lower note is held
                        break;
                    }
                }
            }
            else if (notePriority == 1 && monoHeldNoteCount > 1) // Highest
            {
                // Only play if this note is the highest held
                for (int h = 0; h < monoHeldNoteCount; ++h)
                {
                    if (monoHeldNotes[h] > midiNoteNumber)
                    {
                        shouldPlay = false; // A higher note is held
                        break;
                    }
                }
            }
            // Last priority (2): always play (current default behavior)

            if (shouldPlay)
            {
                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive())
                        voices[i].stopNote(true);
                }
            }
            else
            {
                // Remove just-added note from tracker (was added before priority check)
                monoHeldNoteCount--;
                return; // Don't trigger, lower/higher priority note is already held
            }
        }

        DBG("[SynthEngine] triggerNote: note=" + juce::String(midiNoteNumber)
            + " vel=" + juce::String(velocity)
            + " mode=" + juce::String(voiceMode)
            + " stack=" + juce::String(voicesPerNote));

        // Emitir note-on para la UI web
        pendingNoteOnNote.store(midiNoteNumber, std::memory_order_release);
        pendingNoteOnVel.store(velocity, std::memory_order_release);

        // Apilar N voces para esta nota
        for (int v = 0; v < voicesPerNote; ++v)
        {
            int voiceIdx = findFreeVoice();
            if (voiceIdx < 0 || voiceIdx >= kNumVoices)
                break;

            float voiceNormalized = (float)voiceIdx / (float)(kNumVoices - 1);

            // Calcular detune y pan para esta voz dentro del grupo
            float detuneST = 0.0f;
            float panPos = 0.5f;
            if (voicesPerNote > 1)
                getUnisonParams(v, voicesPerNote, detuneST, panPos);

            voices[voiceIdx].unisonDetuneSemitones = detuneST;
            voices[voiceIdx].unisonPanPosition = panPos;
            voices[voiceIdx].startNote(midiNoteNumber, velocity, voiceNormalized);

            voices[voiceIdx].setExternalModulation(ModSource::kPitchBend, currentPitchBend);
            voices[voiceIdx].setExternalModulation(ModSource::kModWheel, currentModWheel);
            voices[voiceIdx].setExternalModulation(ModSource::kKeyPressure, currentAftertouch);
            voices[voiceIdx].setExternalModulation(ModSource::kSustainPedal, currentSustainPedal);
        }
    }

    void SynthEngine::releaseNote(int midiNoteNumber)
    {
        if (polyChordEnable)
        {
            // Poly Chord: remover la nota del acumulador
            for (int h = 0; h < polyChordNoteCount; ++h)
            {
                if (polyChordHeldNotes[h] == midiNoteNumber)
                {
                    // Desplazar el resto del array hacia la izquierda
                    for (int r = h; r < polyChordNoteCount - 1; ++r)
                        polyChordHeldNotes[r] = polyChordHeldNotes[r + 1];
                    polyChordNoteCount--;
                    break;
                }
            }

            // Si no quedan notas en el Poly Chord, liberar todas las voces
            if (polyChordNoteCount == 0)
            {
                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive())
                        voices[i].stopNote(false);
                }
                return;
            }
        }

        // Mono mode: remove from held notes tracker
        if (voiceMode >= 6 && voiceMode <= 10)
        {
            for (int h = 0; h < monoHeldNoteCount; ++h)
            {
                if (monoHeldNotes[h] == midiNoteNumber)
                {
                    for (int r = h; r < monoHeldNoteCount - 1; ++r)
                        monoHeldNotes[r] = monoHeldNotes[r + 1];
                    monoHeldNoteCount--;
                    break;
                }
            }

            // Si aún quedan notas sostenidas, snap a la siguiente prioridad
            if (monoHeldNoteCount > 0)
            {
                int nextNote = monoHeldNotes[0];
                if (notePriority == 1) // Highest
                {
                    for (int h = 1; h < monoHeldNoteCount; ++h)
                        if (monoHeldNotes[h] > nextNote) nextNote = monoHeldNotes[h];
                }
                else // Lowest (0) or Last (2): use the last element as next note
                {
                    // For Lowest, find the minimum
                    if (notePriority == 0)
                    {
                        for (int h = 1; h < monoHeldNoteCount; ++h)
                            if (monoHeldNotes[h] < nextNote) nextNote = monoHeldNotes[h];
                    }
                    else // Last: the most recently added note is at the end
                    {
                        nextNote = monoHeldNotes[monoHeldNoteCount - 1];
                    }
                }

                // Re-trigger the correct priority note on the active voice
                for (int i = 0; i < kNumVoices; ++i)
                {
                    if (voices[i].isActive())
                        voices[i].stopNote(true);
                }
                triggerNote(nextNote, 0.8f); // Default velocity for priority snap
                return;
            }

            // No held notes left: release normally
            for (int i = 0; i < kNumVoices; ++i)
            {
                if (voices[i].isActive())
                    voices[i].stopNote(false);
            }
            return;
        }

        // Emitir note-off para la UI web
        pendingNoteOffNote.store(midiNoteNumber, std::memory_order_release);

        // Poly mode: liberar voces que coinciden con esta nota MIDI
        for (int i = 0; i < kNumVoices; ++i)
        {
            if (voices[i].getMidiNote() == midiNoteNumber)
            {
                voices[i].stopNote(false);
            }
        }
    }

    void SynthEngine::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midiMessages)
    {
        // 0. Pre-calcular buffers de LFO global para todo el bloque
        const int numSamples = buffer.getNumSamples();
        if (numSamples != globalLfo1Buffer.size())
        {
            globalLfo1Buffer.resize(numSamples);
            globalLfo2Buffer.resize(numSamples);
        }

        // Aplicar arp sync a LFOs globales solo si alguna voz lo tiene activo
        if (arpSyncActive)
        {
            globalLfo1.setRate(arpClockHz);
            globalLfo2.setRate(arpClockHz);
        }

        // Avanzar LFOs globales muestra a muestra para todo el bloque
        for (int s = 0; s < numSamples; ++s)
        {
            globalLfo1Buffer.set(s, globalLfo1.nextSample());
            globalLfo2Buffer.set(s, globalLfo2.nextSample());
        }

        // 1. Limpiar buffer de salida de audio del plugin
        buffer.clear();

        // 2. Procesar eventos MIDI entrantes en orden cronológico
        for (const auto metadata : midiMessages)
        {
            auto msg = metadata.getMessage();
            int samplePosition = metadata.samplePosition;

            if (msg.isNoteOn())
            {
                int transposedNote = std::clamp(msg.getNoteNumber() + transposeSemitones, 0, 127);
                triggerNote(transposedNote, msg.getFloatVelocity());
            }
            else if (msg.isNoteOff())
            {
                int transposedNote = std::clamp(msg.getNoteNumber() + transposeSemitones, 0, 127);
                releaseNote(transposedNote);
            }
            else if (msg.isPitchWheel())
            {
                // Mapear Pitch Wheel a bipolar [-1.0f, 1.0f]
                currentPitchBend = (float)msg.getPitchWheelValue() / 8192.0f - 1.0f;
                for (int i = 0; i < kNumVoices; ++i)
                    voices[i].setExternalModulation(ModSource::kPitchBend, currentPitchBend);
            }
            else if (msg.isController())
            {
                int ccNum = msg.getControllerNumber();
                float ccVal = (float)msg.getControllerValue() / 127.0f;

                if (ccNum == 1) // Mod Wheel
                {
                    currentModWheel = ccVal;
                    for (int i = 0; i < kNumVoices; ++i)
                        voices[i].setExternalModulation(ModSource::kModWheel, currentModWheel);
                }
                else if (ccNum == 64) // Sustain Pedal
                {
                    currentSustainPedal = ccVal;
                    for (int i = 0; i < kNumVoices; ++i)
                        voices[i].setExternalModulation(ModSource::kSustainPedal, currentSustainPedal);
                }
            }
            else if (msg.isChannelPressure()) // Aftertouch
            {
                currentAftertouch = (float)msg.getChannelPressureValue() / 127.0f;
                for (int i = 0; i < kNumVoices; ++i)
                    voices[i].setExternalModulation(ModSource::kKeyPressure, currentAftertouch);
            }
        }

        // 3. Pasamos los buffers de LFO global a cada voz (para modo Mono/Spread)
        //    y renderizamos cada voz activa sumándola en el buffer de salida
        int activeCount = 0;
        for (int i = 0; i < kNumVoices; ++i)
        {
            if (voices[i].isActive()) activeCount++;
            voices[i].process(buffer, 0, numSamples, modMatrix,
                              globalLfo1Buffer.getRawDataPointer(),
                              globalLfo2Buffer.getRawDataPointer(),
                              lfo1MonoMode, lfo2MonoMode);
        }
        
        // Medir nivel de salida (VU Meter para DebugPanel)
        currentPeakLevel = 0.0f;
        if (activeCount > 0)
        {
            currentPeakLevel = buffer.getMagnitude(0, numSamples);
            static int dbgCounter = 0;
            if (++dbgCounter % 100 == 0)
                DBG("[SynthEngine] Active voices: " + juce::String(activeCount) + " peakLevel: " + juce::String(currentPeakLevel, 6));
        }

        // Procesar FX Engine (post-voices, pre-master gain)
        fxEngine.process(buffer);

        // Aplicar Master Gain (global_volume) a todo el buffer de salida
        if (globalVolume < 1.0f)
        {
            buffer.applyGain(globalVolume);
        }

        // 4. Capturar muestras de audio para el osciloscopio en tiempo real
        {
            const int numCh = juce::jmin(2, buffer.getNumChannels());
            for (int s = 0; s < numSamples; ++s)
            {
                for (int ch = 0; ch < numCh; ++ch)
                    audioCaptureBuffer[audioCaptureWritePos * 2 + ch] = buffer.getSample(ch, s);
                audioCaptureWritePos = (audioCaptureWritePos + 1) % kAudioCaptureSize;
            }
        }

        // 5. Copiar snapshot de estado de voces para el DebugPanel (bajo lock rápido)
        updateVoiceSnapshot();
    }

    void SynthEngine::updateVoiceSnapshot()
    {
        const juce::ScopedLock sl(voiceStateLock);
        for (int i = 0; i < kNumVoices; ++i)
        {
            auto& src = voices[i];
            auto& dst = voiceSnapshots[i];
            dst.active = src.isActive();
            dst.midiNote = src.isActive() ? src.getMidiNote() : -1;
            dst.velocity = src.isActive() ? src.noteVelocity : 0.0f;
            dst.detuneSemitones = src.unisonDetuneSemitones;
            dst.panPosition = src.unisonPanPosition;
            dst.voicePanSpread = src.voicePanSpread;
            dst.modOsc1DetuneSemitones = src.lastModOsc1DetuneSemitones;
            dst.modOsc2DetuneSemitones = src.lastModOsc2DetuneSemitones;
            dst.modPan = src.lastModPan;
            dst.modVcfCutoffHz = src.lastModVcfCutoffHz;
        }
        // Global controller snapshot
        snapPitchBend = currentPitchBend;
        snapModWheel = currentModWheel;
        snapAftertouch = currentAftertouch;
        snapSustainPedal = currentSustainPedal;
        // Peak level (VU Meter)
        snapPeakLevel = currentPeakLevel;
    }

    juce::var SynthEngine::getVoiceState() const
    {
        juce::Array<juce::var> arr;
        int polyCount = 0;
        {
            const juce::ScopedLock sl(voiceStateLock);
            for (int i = 0; i < kNumVoices; ++i)
            {
                auto& snap = voiceSnapshots[i];
                auto* obj = new juce::DynamicObject();
                obj->setProperty("index", i);
                obj->setProperty("active", snap.active);
                obj->setProperty("midiNote", snap.active ? snap.midiNote : -1);
                obj->setProperty("detuneSemitones", (double)snap.detuneSemitones);
                obj->setProperty("panPosition", (double)snap.panPosition);
                obj->setProperty("voicePanSpread", (double)snap.voicePanSpread);
                obj->setProperty("modOsc1DetuneSemitones", (double)snap.modOsc1DetuneSemitones);
                obj->setProperty("modOsc2DetuneSemitones", (double)snap.modOsc2DetuneSemitones);
                obj->setProperty("modPan", (double)snap.modPan);
                obj->setProperty("modVcfCutoffHz", (double)snap.modVcfCutoffHz);
                arr.add(juce::var(obj));
            }
            // Leer polyChordNoteCount bajo el mismo lock para consistencia
            polyCount = polyChordNoteCount;
        }
        double snapPb = 0.0, snapMw = 0.0, snapAt = 0.0, snapSus = 0.0, snapPeak = 0.0;
        {
            const juce::ScopedLock sl(voiceStateLock);
            snapPb = (double)snapPitchBend;
            snapMw = (double)snapModWheel;
            snapAt = (double)snapAftertouch;
            snapSus = (double)snapSustainPedal;
            snapPeak = (double)snapPeakLevel;
        }
        auto* result = new juce::DynamicObject();
        result->setProperty("voices", juce::var(arr));
        result->setProperty("polyChordNoteCount", polyCount);
        result->setProperty("pitchBend", snapPb);
        result->setProperty("modWheel", snapMw);
        result->setProperty("aftertouch", snapAt);
        result->setProperty("sustainPedal", snapSus);
        result->setProperty("peakLevel", snapPeak);
        return juce::var(result);
    }

juce::var SynthEngine::getAudioWaveform() const
{
    juce::Array<juce::var> samples;
    // Nota: data race benigno — el audio thread escribe audioCaptureBuffer sin lock.
    // Para un osciloscopio en tiempo real, perder o leer una muestra parcial
    // en transición es visualmente imperceptible.
    for (int i = 0; i < kAudioCaptureSize; ++i)
    {
        int idx = (audioCaptureWritePos + i) % kAudioCaptureSize;
        samples.add ((double) audioCaptureBuffer[idx * 2]); // canal izquierdo
    }
    return juce::var (samples);
}

juce::String SynthEngine::getActiveNotesJSON() const
{
    juce::Array<juce::var> notesArr;
    {
        const juce::ScopedLock sl (voiceStateLock);
        for (int i = 0; i < kNumVoices; ++i)
        {
            if (voiceSnapshots[i].active)
            {
                auto* pair = new juce::DynamicObject();
                pair->setProperty ("n", voiceSnapshots[i].midiNote);
                pair->setProperty ("v", (double) voiceSnapshots[i].velocity);
                notesArr.add (juce::var (pair));
            }
        }
    }

    // Deduplicate (same MIDI note may occupy multiple voices via Unison stacking)
    // Keep the highest velocity for each unique note.
    std::map<int, float> uniqueNotes;
    for (auto& item : notesArr)
    {
        auto* obj = item.getDynamicObject();
        int n = (int) obj->getProperty ("n");
        float v = (float) obj->getProperty ("v");
        auto it = uniqueNotes.find (n);
        if (it == uniqueNotes.end())
            uniqueNotes[n] = v;
        else if (v > it->second)
            it->second = v;
    }

    // Build JSON: [[note, vel], [note, vel], ...] sorted by note number
    juce::String json = "[";
    bool first = true;
    for (auto& [note, vel] : uniqueNotes)
    {
        if (!first) json += ",";
        json += "[" + juce::String (note) + "," + juce::String (vel, 4) + "]";
        first = false;
    }
    json += "]";
    return json;
}
}
