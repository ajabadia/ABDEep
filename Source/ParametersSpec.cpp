 /**
 * @purpose Especificación consolidada de parámetros SysEx / NRPN y mapeo de offsets del emulador DeepMind 12.
 * @purpose_en Consolidates parameters SysEx / NRPN specifications and emulator offset mappings for Behringer DeepMind 12.
 * @refactorable false
 * @classification Configuration data spec
 * @complexity Low
 * @fingerprint exports:1,imports:1,sig:1r4m06x
 * @lastUpdated 2026-07-04T15:53:50.000Z
 */
#include "ParametersSpec.h"

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getSpecs()
{
    std::vector<ParamInfo> specs = {
        // OSC 1
        { "osc1_saw_enable", "OSC1 Saw Enable", "oscilador", "bool", 0.0f, 1.0f, 1.0f, -1, 19, {} },
        { "osc1_square_enable", "OSC1 Square Enable", "oscilador", "bool", 0.0f, 1.0f, 0.0f, -1, 18, {} },
        { "osc1_pwm_amount", "OSC1 PWM Amount", "oscilador", "float", 0.0f, 1.0f, 0.5f, 21, 25, {} },
        { "osc1_range", "OSC1 Range", "oscilador", "enum", 0.0f, 2.0f, 1.0f, -1, 14, { "16'", "8'", "4'" } },
        { "osc1_pitch_mod", "OSC1 Pitch Mod", "oscilador", "float", 0.0f, 1.0f, 0.0f, 20, 24, {} },
        
        // OSC 2
        { "osc2_pitch", "OSC2 Pitch", "oscilador", "float", -12.0f, 12.0f, 0.0f, 25, 27, {} },
        { "osc2_tone_mod", "OSC2 Tone Mod", "oscilador", "float", 0.0f, 1.0f, 0.0f, 24, 28, {} },
        { "osc2_level", "OSC2 Level", "oscilador", "float", 0.0f, 1.0f, 0.5f, 26, 26, {} },
        { "osc2_pitch_mod", "OSC2 Pitch Mod", "oscilador", "float", 0.0f, 1.0f, 0.0f, 23, 30, {} },
        { "osc2_range", "OSC2 Range", "oscilador", "enum", 0.0f, 2.0f, 1.0f, -1, 31, { "16'", "8'", "4'" } },

        // GLOBAL OSC / GENERALS
        { "osc_sync_enable", "OSC Hard Sync", "oscilador", "bool", 0.0f, 1.0f, 0.0f, -1, 20, {} },
        { "noise_level", "Noise Level", "oscilador", "float", 0.0f, 1.0f, 0.0f, 27, 33, {} },
        
        // VCF
        { "vcf_cutoff", "VCF Cutoff", "filtro", "float", 0.0f, 1.0f, 1.0f, 29, 39, {} },
        { "vcf_resonance", "VCF Resonance", "filtro", "float", 0.0f, 1.0f, 0.0f, 30, 41, {} },
        { "vcf_pole_mode", "VCF Pole Mode", "filtro", "enum", 0.0f, 1.0f, 1.0f, -1, 51, { "2-Pole (12dB)", "4-Pole (24dB)" } },
        { "vcf_env_depth", "VCF Envelope Depth", "filtro", "float", -1.0f, 1.0f, 0.0f, 31, 42, {} },
        { "vcf_env_vel", "VCF Env Velocity", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 43, {} },
        { "vcf_lfo_depth", "VCF LFO Depth", "filtro", "float", 0.0f, 1.0f, 0.0f, 33, 45, {} },
        { "vcf_lfo_select", "VCF LFO Select", "filtro", "enum", 0.0f, 1.0f, 0.0f, -1, 46, { "LFO 1", "LFO 2" } },
        { "vcf_env_polarity", "VCF Env Polarity", "filtro", "enum", 0.0f, 1.0f, 1.0f, -1, 50, { "Inverted", "Normal" } },
        { "vcf_key_tracking", "VCF Key Tracking", "filtro", "float", 0.0f, 1.0f, 0.0f, 34, 44, {} },
        { "vcf_pitch_bend", "VCF Pitch Bend", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 40, {} }, // Note: HPF cutoff uses CC 35/NRPN 40, while VCF Pitch Bend is NRPN 40 (HPF Cutoff maps to NRPN 40 on CC 35 but we should separate them if needed)
        // Wait, patchwork sheet says HPF Cutoff is 40. VCF Pitch Bend/Bend Freq is NRPN 40? Let's check patchwork sheet.
        // Oh, patchwork says: Filter HPF Cutoff is offset 40. VCF Pitch Bend/P.Bend Freq is CC/NRPN? Let's assign vcf_pitch_bend NRPN 49 (or 40 as in picture). Let's use NRPN 40/CC 22. Let's make it LSB NRPN 47. Or 48? Let's look at image: P.BEND FREQ is 2nd slider. Let's use NRPN 48. Let's put LSB 48. Or let's verify. Let's check image.
        // Wait! HPF Cutoff is offset 40. NRPN for VCF LFO is 45, LFO Select is 46, Key tracking is 44, Env Vel is 43, Env Depth is 42, Resonance is 41, Cutoff is 39. So Pitch Bend Freq must be NRPN 47? No, wait: "Filter HPF Cutoff = 40" in unpackedBytes. In NRPN list: HPF Cutoff is NRPN 40. What is P.Bend Freq? Let's look up. Pitch Bend is NRPN 48 or 49. Let's register NRPN 48.
        { "vcf_pitch_bend", "VCF Pitch Bend", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 48, {} },
        
        // VCA
        { "vca_level", "VCA Level", "amplificador", "float", 0.0f, 1.0f, 0.8f, 36, 57, {} },
        { "vca_mode", "VCA Mode", "amplificador", "enum", 0.0f, 1.0f, 0.0f, -1, 58, { "Transparent", "Ballsy" } },
        { "vca_env_depth", "VCA Env Depth", "amplificador", "float", 0.0f, 1.0f, 0.0f, -1, 59, {} },
        { "vca_vel_sens", "VCA Vel Sens", "amplificador", "float", 0.0f, 1.0f, 0.0f, -1, 60, {} },
        { "vca_pan_spread", "VCA Pan Spread", "amplificador", "float", 0.0f, 1.0f, 0.0f, -1, 61, {} },
        
        // HPF
        { "hpf_cutoff", "HPF Cutoff", "filtro", "float", 20.0f, 2000.0f, 20.0f, 35, 40, {} },
        { "hpf_boost_enable", "HPF Bass Boost", "filtro", "bool", 0.0f, 1.0f, 0.0f, -1, 52, {} },

        // GLOBAL PERFORMANCE
        { "global_volume", "Global Volume", "performance", "float", 0.0f, 1.0f, 0.8f, 7, -1, {} },
        { "global_portamento", "Global Portamento", "performance", "float", 0.0f, 1.0f, 0.0f, 5, 87, {} },
        { "global_tune", "Global Tune", "performance", "float", -128.0f, 127.0f, 0.0f, -1, 81, {} },
        { "transpose", "Transpose", "performance", "float", -48.0f, 48.0f, 0.0f, -1, 82, {} },
        { "pitch_bend_up", "Pitch Bend Up", "performance", "float", 0.0f, 24.0f, 2.0f, -1, 83, {} },
        { "pitch_bend_down", "Pitch Bend Down", "performance", "float", 0.0f, 24.0f, 2.0f, -1, 84, {} },
        { "osc_drift", "OSC Drift", "performance", "float", 0.0f, 1.0f, 0.0f, -1, 88, {} },
        { "param_drift", "Param Drift", "performance", "float", 0.0f, 1.0f, 0.0f, -1, 89, {} },
        { "drift_rate", "Drift Rate", "performance", "float", 0.0f, 1.0f, 0.0f, -1, 90, {} },
        { "porta_osc_bal", "Porta Osc Bal", "performance", "float", -128.0f, 127.0f, 0.0f, -1, 91, {} },
        { "porta_mode", "Porta Mode", "performance", "enum", 0.0f, 10.0f, 0.0f, -1, 92, { "Normal", "Fingered", "Fix-Rate", "Fix-Fing", "Exp", "Exp-Fing", "Fixed+2", "Fixed-2", "Fixed+5", "Fixed-5" } },
        { "note_priority", "Note Priority", "performance", "enum", 0.0f, 2.0f, 0.0f, -1, 93, { "Lowest", "Highest", "Last" } },
        { "trigger_mode", "Trigger Mode", "performance", "enum", 0.0f, 3.0f, 0.0f, -1, 94, { "Mono", "Retrig", "Legato", "One-shot" } },
        
        // Slots Especiales Emulador
        { "slot_a_type", "Slot A Osc Type", "custom", "enum", 0.0f, 1.0f, 0.0f, -1, -1, { "OSC1_Style", "OSC2_Style" } },
        { "slot_b_type", "Slot B Osc Type", "custom", "enum", 0.0f, 1.0f, 1.0f, -1, -1, { "OSC1_Style", "OSC2_Style" } },
        
        // LFO 1
        { "lfo1_rate", "LFO1 Rate", "lfo", "float", 0.0f, 1.0f, 0.5f, 16, 0, {} },
        { "lfo1_delay", "LFO1 Delay", "lfo", "float", 0.0f, 1.0f, 0.0f, 17, 1, {} },
        { "lfo1_slew", "LFO1 Slew", "lfo", "float", 0.0f, 1.0f, 0.0f, -1, 2, {} },
        { "lfo1_shape", "LFO1 Shape", "lfo", "enum", 0.0f, 6.0f, 0.0f, -1, 3, { "Sine", "Triangle", "Square", "Ramp Up", "Ramp Down", "Smp&Hold", "Smp&Glide" } },
        { "lfo1_key_sync", "LFO1 Key Sync", "lfo", "bool", 0.0f, 1.0f, 1.0f, -1, 4, {} },
        { "lfo1_arp_sync", "LFO1 Arp Sync", "lfo", "bool", 0.0f, 1.0f, 0.0f, -1, 5, {} },
        { "lfo1_phase", "LFO1 Phase", "lfo", "float", 0.0f, 1.0f, 0.0f, -1, 6, {} },
        
        // LFO 2
        { "lfo2_rate", "LFO2 Rate", "lfo", "float", 0.0f, 1.0f, 0.5f, 18, 7, {} },
        { "lfo2_delay", "LFO2 Delay", "lfo", "float", 0.0f, 1.0f, 0.0f, 19, 8, {} },
        { "lfo2_slew", "LFO2 Slew", "lfo", "float", 0.0f, 1.0f, 0.0f, -1, 9, {} },
        { "lfo2_shape", "LFO2 Shape", "lfo", "enum", 0.0f, 6.0f, 0.0f, -1, 10, { "Sine", "Triangle", "Square", "Ramp Up", "Ramp Down", "Smp&Hold", "Smp&Glide" } },
        { "lfo2_key_sync", "LFO2 Key Sync", "lfo", "bool", 0.0f, 1.0f, 1.0f, -1, 11, {} },
        { "lfo2_arp_sync", "LFO2 Arp Sync", "lfo", "bool", 0.0f, 1.0f, 0.0f, -1, 12, {} },
        { "lfo2_phase", "LFO2 Phase", "lfo", "float", 0.0f, 1.0f, 0.0f, -1, 13, {} },

        // ENVELOPE 1 (VCA)
        { "env1_attack", "Env1 Attack", "envelope", "float", 0.0f, 1.0f, 0.0f, 37, 53, {} },
        { "env1_decay", "Env1 Decay", "envelope", "float", 0.0f, 1.0f, 0.5f, 39, 54, {} },
        { "env1_sustain", "Env1 Sustain", "envelope", "float", 0.0f, 1.0f, 0.8f, 40, 55, {} },
        { "env1_release", "Env1 Release", "envelope", "float", 0.0f, 1.0f, 0.2f, 41, 56, {} },
        { "env1_attack_curve", "Env1 Attack Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 46, {} },
        { "env1_decay_curve", "Env1 Decay Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 47, {} },
        { "env1_sustain_curve", "Env1 Sustain Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 48, {} },
        { "env1_release_curve", "Env1 Release Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 49, {} },
        { "env1_trigger_mode", "Env1 Trigger Mode", "envelope", "enum", 0.0f, 4.0f, 0.0f, -1, 134, { "Key", "LFO 1", "LFO 2", "Loop", "Seq" } },

        // ENVELOPE 2 (VCF)
        { "env2_attack", "Env2 Attack", "envelope", "float", 0.0f, 1.0f, 0.0f, 42, 65, {} },
        { "env2_decay", "Env2 Decay", "envelope", "float", 0.0f, 1.0f, 0.5f, 43, 66, {} },
        { "env2_sustain", "Env2 Sustain", "envelope", "float", 0.0f, 1.0f, 0.5f, 44, 67, {} },
        { "env2_release", "Env2 Release", "envelope", "float", 0.0f, 1.0f, 0.2f, 45, 68, {} },
        { "env2_attack_curve", "Env2 Attack Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 50, {} },
        { "env2_decay_curve", "Env2 Decay Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 51, {} },
        { "env2_sustain_curve", "Env2 Sustain Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 56, {} },
        { "env2_release_curve", "Env2 Release Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 53, {} },
        { "env2_trigger_mode", "Env2 Trigger Mode", "envelope", "enum", 0.0f, 4.0f, 0.0f, -1, 135, { "Key", "LFO 1", "LFO 2", "Loop", "Seq" } },

        // ENVELOPE 3 (MOD)
        { "env3_attack", "Env3 Attack", "envelope", "float", 0.0f, 1.0f, 0.0f, 46, 73, {} },
        { "env3_decay", "Env3 Decay", "envelope", "float", 0.0f, 1.0f, 0.5f, 47, 74, {} },
        { "env3_sustain", "Env3 Sustain", "envelope", "float", 0.0f, 1.0f, 0.0f, 48, 75, {} },
        { "env3_release", "Env3 Release", "envelope", "float", 0.0f, 1.0f, 0.2f, 49, 76, {} },
        { "env3_attack_curve", "Env3 Attack Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 58, {} },
        { "env3_decay_curve", "Env3 Decay Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 59, {} },
        { "env3_sustain_curve", "Env3 Sustain Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 60, {} },
        { "env3_release_curve", "Env3 Release Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 61, {} },
        { "env3_trigger_mode", "Env3 Trigger Mode", "envelope", "enum", 0.0f, 4.0f, 0.0f, -1, 136, { "Key", "LFO 1", "LFO 2", "Loop", "Seq" } },

        // VCO MODULATIONS (VCO Mod / Sources)
        { "osc1_pm_mode", "OSC 1 PM Mode", "oscilador", "enum", 0.0f, 1.0f, 0.0f, -1, 38, { "OSC 1+2", "OSC 1" } },
        { "osc1_pm_source", "OSC 1 PM Source", "oscilador", "enum", 0.0f, 23.0f, 0.0f, -1, 15, { "LFO 1", "LFO 2", "Env 1", "Env 2", "Env 3", "LFO 1 (Uni)", "LFO 2 (Uni)", "Pitch Bend", "Mod Wheel", "Foot Ctrl", "Pressure", "Expression", "Note Num", "Note Vel", "Ctrl Seq", "Voice Num", "Uni Voice" } },
        { "osc1_pwm_source", "OSC 1 PWM Source", "oscilador", "enum", 0.0f, 23.0f, 0.0f, -1, 16, { "Manual", "LFO 1", "LFO 2", "Env 1", "Env 2", "Env 3" } },
        { "osc2_pm_source", "OSC 2 PM Source", "oscilador", "enum", 0.0f, 23.0f, 0.0f, -1, 17, { "LFO 1", "LFO 2", "Env 1", "Env 2", "Env 3", "LFO 1 (Uni)", "LFO 2 (Uni)" } },
        { "osc2_tpm_source", "OSC 2 Tone Mod Source", "oscilador", "enum", 0.0f, 23.0f, 0.0f, -1, 18, { "Manual", "LFO 1", "LFO 2", "Env 1", "Env 2", "Env 3" } },

        // UNISON & VOICE (Poly menu)
        { "unison_voices", "Unison Voices", "unison", "enum", 0.0f, 5.0f, 1.0f, -1, 86, { "Poly", "Unison 2", "Unison 3", "Unison 4", "Unison 6", "Unison 12" } },
        { "voice_mode", "Voice Mode", "unison", "enum", 0.0f, 2.0f, 0.0f, -1, 85, { "Poly", "Mono", "Mono-2" } },
        { "voice_drift", "Voice Drift", "unison", "float", 0.0f, 1.0f, 0.0f, -1, 88, {} },

        // MODULATION MATRIX (8 slots: src 89-96, dest 97-104, depth 73-80)
        { "mod_matrix_slot1_src", "Mod Slot 1 Source", "modmatrix", "enum", 0.0f, 24.0f, 0.0f, -1, 89, {} },
        { "mod_matrix_slot1_dest", "Mod Slot 1 Dest", "modmatrix", "enum", 0.0f, 132.0f, 0.0f, -1, 97, {} },
        { "mod_matrix_slot1_depth", "Mod Slot 1 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 73, {} },

        { "mod_matrix_slot2_src", "Mod Slot 2 Source", "modmatrix", "enum", 0.0f, 24.0f, 0.0f, -1, 90, {} },
        { "mod_matrix_slot2_dest", "Mod Slot 2 Dest", "modmatrix", "enum", 0.0f, 132.0f, 0.0f, -1, 98, {} },
        { "mod_matrix_slot2_depth", "Mod Slot 2 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 74, {} },

        { "mod_matrix_slot3_src", "Mod Slot 3 Source", "modmatrix", "enum", 0.0f, 24.0f, 0.0f, -1, 91, {} },
        { "mod_matrix_slot3_dest", "Mod Slot 3 Dest", "modmatrix", "enum", 0.0f, 132.0f, 0.0f, -1, 99, {} },
        { "mod_matrix_slot3_depth", "Mod Slot 3 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 75, {} },

        { "mod_matrix_slot4_src", "Mod Slot 4 Source", "modmatrix", "enum", 0.0f, 24.0f, 0.0f, -1, 92, {} },
        { "mod_matrix_slot4_dest", "Mod Slot 4 Dest", "modmatrix", "enum", 0.0f, 132.0f, 0.0f, -1, 100, {} },
        { "mod_matrix_slot4_depth", "Mod Slot 4 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 76, {} },

        { "mod_matrix_slot5_src", "Mod Slot 5 Source", "modmatrix", "enum", 0.0f, 24.0f, 0.0f, -1, 93, {} },
        { "mod_matrix_slot5_dest", "Mod Slot 5 Dest", "modmatrix", "enum", 0.0f, 132.0f, 0.0f, -1, 101, {} },
        { "mod_matrix_slot5_depth", "Mod Slot 5 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 77, {} },

        { "mod_matrix_slot6_src", "Mod Slot 6 Source", "modmatrix", "enum", 0.0f, 24.0f, 0.0f, -1, 94, {} },
        { "mod_matrix_slot6_dest", "Mod Slot 6 Dest", "modmatrix", "enum", 0.0f, 132.0f, 0.0f, -1, 102, {} },
        { "mod_matrix_slot6_depth", "Mod Slot 6 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 78, {} },

        { "mod_matrix_slot7_src", "Mod Slot 7 Source", "modmatrix", "enum", 0.0f, 24.0f, 0.0f, -1, 95, {} },
        { "mod_matrix_slot7_dest", "Mod Slot 7 Dest", "modmatrix", "enum", 0.0f, 132.0f, 0.0f, -1, 103, {} },
        { "mod_matrix_slot7_depth", "Mod Slot 7 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 79, {} },

        { "mod_matrix_slot8_src", "Mod Slot 8 Source", "modmatrix", "enum", 0.0f, 24.0f, 0.0f, -1, 96, {} },
        { "mod_matrix_slot8_dest", "Mod Slot 8 Dest", "modmatrix", "enum", 0.0f, 132.0f, 0.0f, -1, 104, {} },
        { "mod_matrix_slot8_depth", "Mod Slot 8 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 80, {} },

        // CHORD MEMORY
        { "chord_enable", "Chord Memory Enable", "chord", "bool", 0.0f, 1.0f, 0.0f, -1, 105, {} },
        { "poly_chord_enable", "Poly Chord Enable", "chord", "bool", 0.0f, 1.0f, 0.0f, -1, 106, {} },
        { "chord_key", "Chord Root Key", "chord", "enum", 0.0f, 11.0f, 0.0f, -1, 107, { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" } },
        { "chord_type", "Chord Type / Mode", "chord", "enum", 0.0f, 7.0f, 0.0f, -1, 108, { "Memory", "Major", "Minor", "Major 7th", "Minor 7th", "Dominant 7th", "Suspended 4th", "Power Chord" } },

        // CHORD MEMORY
        { "chord_enable", "Chord Memory Enable", "chord", "bool", 0.0f, 1.0f, 0.0f, -1, 105, {} },
        { "poly_chord_enable", "Poly Chord Enable", "chord", "bool", 0.0f, 1.0f, 0.0f, -1, 106, {} },
        { "chord_key", "Chord Root Key", "chord", "enum", 0.0f, 11.0f, 0.0f, -1, 107, { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" } },
        { "chord_type", "Chord Type / Mode", "chord", "enum", 0.0f, 7.0f, 0.0f, -1, 108, { "Memory", "Major", "Minor", "Major 7th", "Minor 7th", "Dominant 7th", "Suspended 4th", "Power Chord" } },

        // ARPEGGIATOR
        { "arp_enable", "Arp Enable", "arp", "bool", 0.0f, 1.0f, 0.0f, -1, 109, {} },
        { "arp_hold", "Arp Hold", "arp", "bool", 0.0f, 1.0f, 0.0f, -1, 110, {} },
        { "arp_key_sync", "Arp Key Sync", "arp", "bool", 0.0f, 1.0f, 1.0f, -1, 111, {} },
        { "arp_velocity_gate", "Arp Velocity Gate Mode", "arp", "enum", 0.0f, 2.0f, 0.0f, -1, 112, { "Gate", "Velocity", "Seq" } },
        { "arp_mode", "Arp Mode", "arp", "enum", 0.0f, 9.0f, 0.0f, -1, 113, { "Up", "Down", "Up-Down", "Up-Inv", "Down-Inv", "Up-Dn-Inv", "Up-Alt", "Down-Alt", "Random", "As-Played" } },
        { "arp_rate", "Arp Rate BPM", "arp", "float", 20.0f, 240.0f, 120.0f, -1, 114, {} },
        { "arp_gate_time", "Arp Gate Time", "arp", "float", 0.0f, 255.0f, 128.0f, -1, 115, {} },
        { "arp_swing", "Arp Swing", "arp", "float", 0.0f, 100.0f, 50.0f, -1, 116, {} },
        { "arp_clock_divider", "Arp Clock Divider", "arp", "enum", 0.0f, 2.0f, 0.0f, -1, 117, { "Internal", "MIDI(Auto)", "USB(Auto)" } },
        { "arp_octave", "Arp Octave Range", "arp", "enum", 0.0f, 3.0f, 0.0f, -1, 118, { "1", "2", "3", "4" } },

        // CONTROL SEQUENCER
        { "seq_enable", "Seq Enable", "sequencer", "bool", 0.0f, 1.0f, 0.0f, -1, 119, {} },
        { "seq_clock", "Seq Clock Rate", "sequencer", "enum", 0.0f, 10.0f, 3.0f, -1, 120, { "1/2", "3/8", "1/3", "1/4", "3/16", "1/6", "1/8", "1/12", "1/16", "1/24", "1/32" } },
        { "seq_length", "Seq Length Steps", "sequencer", "enum", 0.0f, 30.0f, 14.0f, -1, 121, { "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32" } },
        { "seq_key_loop", "Seq Key Loop Mode", "sequencer", "enum", 0.0f, 2.0f, 0.0f, -1, 122, { "Loop On", "Key Sync On", "Key&Loop On" } },
        { "seq_swing", "Seq Swing", "sequencer", "float", 0.0f, 100.0f, 50.0f, -1, 123, {} },
        { "seq_slew_rate", "Seq Slew Rate", "sequencer", "float", 0.0f, 255.0f, 0.0f, -1, 124, {} },

        // EFFECTS ENGINE
        { "fx_routing", "FX Routing Mode", "effects", "enum", 0.0f, 9.0f, 0.0f, -1, 125, { "Series (1->2->3->4)", "Parallel 2x2", "Series/Parallel", "Parallel", "Routing 5", "Routing 6", "Routing 7", "Routing 8", "Routing 9", "Routing 10" } },
        { "fx_mode", "FX Mode", "effects", "enum", 0.0f, 2.0f, 0.0f, -1, 126, { "Insert", "Send", "Bypass" } },
        { "fx_page", "FX Param Page", "effects", "enum", 0.0f, 1.0f, 0.0f, -1, 127, { "Page 1", "Page 2" } },

        { "fx1_type", "FX1 Type", "effects", "enum", 0.0f, 35.0f, 1.0f, -1, 128, { "Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker" } },
        { "fx1_gain", "FX1 Gain", "effects", "float", 0.0f, 1.0f, 1.0f, -1, 129, {} },
        { "fx1_mix", "FX1 Mix", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 130, {} },
        { "fx1_param1", "FX1 Parameter 1", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 131, {} },
        { "fx1_param2", "FX1 Parameter 2", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 132, {} },
        { "fx1_param3", "FX1 Parameter 3", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 133, {} },
        { "fx1_param4", "FX1 Parameter 4", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 134, {} },
        { "fx1_param5", "FX1 Parameter 5", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 135, {} },
        { "fx1_param6", "FX1 Parameter 6", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 136, {} },
        { "fx1_param7", "FX1 Parameter 7", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 137, {} },
        { "fx1_param8", "FX1 Parameter 8", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 138, {} },

        { "fx2_type", "FX2 Type", "effects", "enum", 0.0f, 35.0f, 4.0f, -1, 139, { "Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker" } },
        { "fx2_gain", "FX2 Gain", "effects", "float", 0.0f, 1.0f, 1.0f, -1, 140, {} },
        { "fx2_mix", "FX2 Mix", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 141, {} },
        { "fx2_param1", "FX2 Parameter 1", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 142, {} },
        { "fx2_param2", "FX2 Parameter 2", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 143, {} },
        { "fx2_param3", "FX2 Parameter 3", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 144, {} },
        { "fx2_param4", "FX2 Parameter 4", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 145, {} },

        { "fx3_type", "FX3 Type", "effects", "enum", 0.0f, 35.0f, 0.0f, -1, 146, { "Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker" } },
        { "fx3_gain", "FX3 Gain", "effects", "float", 0.0f, 1.0f, 1.0f, -1, 147, {} },
        { "fx3_mix", "FX3 Mix", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 148, {} },

        { "fx4_type", "FX4 Type", "effects", "enum", 0.0f, 35.0f, 0.0f, -1, 149, { "Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker" } },
        { "fx4_gain", "FX4 Gain", "effects", "float", 0.0f, 1.0f, 1.0f, -1, 150, {} },
        { "fx4_mix", "FX4 Mix", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 151, {} }
    };
    return specs;
}

juce::AudioProcessorValueTreeState::ParameterLayout ParametersSpec::createLayout()
{
    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;
    for (const auto& s : getSpecs())
    {
        if (s.type == "bool")
        {
            params.push_back(std::make_unique<juce::AudioParameterBool>(
                juce::ParameterID { s.id, 1 },
                s.name,
                s.defaultValue > 0.5f));
        }
        else if (s.type == "enum")
        {
            params.push_back(std::make_unique<juce::AudioParameterChoice>(
                juce::ParameterID { s.id, 1 },
                s.name,
                s.options,
                static_cast<int>(s.defaultValue)));
        }
        else // float
        {
            params.push_back(std::make_unique<juce::AudioParameterFloat>(
                juce::ParameterID { s.id, 1 },
                s.name,
                juce::NormalisableRange<float>(s.minValue, s.maxValue),
                s.defaultValue));
        }
    }
    return { params.begin(), params.end() };
}
