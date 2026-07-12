/**
 * @purpose Especificación consolidada de parámetros SysEx / NRPN del emulador DeepMind 12.
 * @purpose_en Consolidates parameters SysEx / NRPN specifications for Behringer DeepMind 12 emulator.
 * @classification Configuration data spec
 * @complexity Low
 * @lastUpdated 2026-07-08
 * @note NRPN values (midiNRPN) actualizados según el manual oficial del DeepMind 12 (págs 117-120).
 *       Los valores midiCC se mantienen de la especificación original.
 */
#include "ParametersSpec.h"

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getSpecs()
{
    std::vector<ParamInfo> specs = {
        // LFO 1 (Manual: LSB 0-6)
        { "lfo1_rate", "LFO1 Rate", "lfo", "float", 0.0f, 1.0f, 0.5f, 16, 0, {} },
        { "lfo1_delay", "LFO1 Delay", "lfo", "float", 0.0f, 1.0f, 0.0f, 17, 1, {} },
        { "lfo1_shape", "LFO1 Shape", "lfo", "enum", 0.0f, 6.0f, 0.0f, -1, 2, { "Sine", "Triangle", "Square", "Ramp Up", "Ramp Down", "Smp&Hold", "Smp&Glide" } },
        { "lfo1_key_sync", "LFO1 Key Sync", "lfo", "bool", 0.0f, 1.0f, 1.0f, -1, 3, {} },
        { "lfo1_arp_sync", "LFO1 Arp Sync", "lfo", "bool", 0.0f, 1.0f, 0.0f, -1, 4, {} },
        { "lfo1_mono_mode", "LFO1 Mono Mode", "lfo", "float", 0.0f, 1.0f, 0.0f, -1, 5, {} },
        { "lfo1_slew", "LFO1 Slew", "lfo", "float", 0.0f, 1.0f, 0.0f, -1, 6, {} },
        
        // LFO 2 (Manual: LSB 7-13)
        { "lfo2_rate", "LFO2 Rate", "lfo", "float", 0.0f, 1.0f, 0.5f, 18, 7, {} },
        { "lfo2_delay", "LFO2 Delay", "lfo", "float", 0.0f, 1.0f, 0.0f, 19, 8, {} },
        { "lfo2_shape", "LFO2 Shape", "lfo", "enum", 0.0f, 6.0f, 0.0f, -1, 9, { "Sine", "Triangle", "Square", "Ramp Up", "Ramp Down", "Smp&Hold", "Smp&Glide" } },
        { "lfo2_key_sync", "LFO2 Key Sync", "lfo", "bool", 0.0f, 1.0f, 1.0f, -1, 10, {} },
        { "lfo2_arp_sync", "LFO2 Arp Sync", "lfo", "bool", 0.0f, 1.0f, 0.0f, -1, 11, {} },
        { "lfo2_mono_mode", "LFO2 Mono Mode", "lfo", "float", 0.0f, 1.0f, 0.0f, -1, 12, {} },
        { "lfo2_slew", "LFO2 Slew", "lfo", "float", 0.0f, 1.0f, 0.0f, -1, 13, {} },
        // OSC 1 (Manual: LSB 14-25)
        { "osc1_range", "OSC1 Range", "oscilador", "enum", 0.0f, 2.0f, 1.0f, -1, 14, { "16'", "8'", "4'" } },
        { "osc1_pm_source", "OSC 1 PM Source", "oscilador", "enum", 0.0f, 6.0f, 0.0f, -1, 22, { "LFO 1", "LFO 2", "Env 1", "Env 2", "Env 3", "LFO 1 (Uni)", "LFO 2 (Uni)" } },
        { "osc1_pwm_source", "OSC 1 PWM Source", "oscilador", "enum", 0.0f, 5.0f, 0.0f, -1, 16, { "Manual", "LFO 1", "LFO 2", "Env 1", "Env 2", "Env 3" } },
        { "osc1_square_enable", "OSC1 Square Enable", "oscilador", "bool", 0.0f, 1.0f, 0.0f, -1, 18, {} },
        { "osc1_saw_enable", "OSC1 Saw Enable", "oscilador", "bool", 0.0f, 1.0f, 1.0f, -1, 19, {} },
        { "osc_sync_enable", "OSC Hard Sync", "oscilador", "bool", 0.0f, 1.0f, 0.0f, -1, 20, {} },
        { "osc1_pitch_mod", "OSC1 Pitch Mod", "oscilador", "float", 0.0f, 1.0f, 0.0f, 20, 21, {} },
        { "osc1_pm_mode", "OSC 1 PM Mode", "oscilador", "enum", 0.0f, 1.0f, 0.0f, -1, 38, { "OSC 1+2", "OSC 1" } },
        { "osc1_pwm_amount", "OSC1 PWM Amount", "oscilador", "float", 0.0f, 1.0f, 0.5f, 21, 25, {} },
        { "osc1_lfo_aftertouch", "OSC1 Aftertouch > Pitch Mod", "oscilador", "float", 0.0f, 1.0f, 0.0f, -1, 23, {} },
        { "osc1_lfo_modwheel", "OSC1 ModWheel > Pitch Mod", "oscilador", "float", 0.0f, 1.0f, 0.0f, -1, 24, {} },
 
        // OSC 2 (Manual: LSB 15, 17, 26-32)
        { "osc2_range", "OSC2 Range", "oscilador", "enum", 0.0f, 2.0f, 1.0f, -1, 15, { "16'", "8'", "4'" } },
        { "osc2_pm_source", "OSC 2 PM Source", "oscilador", "enum", 0.0f, 6.0f, 0.0f, -1, 32, { "LFO 1", "LFO 2", "Env 1", "Env 2", "Env 3", "LFO 1 (Uni)", "LFO 2 (Uni)" } },
        { "osc2_tpm_source", "OSC 2 Tone Mod Source", "oscilador", "enum", 0.0f, 5.0f, 0.0f, -1, 17, { "Manual", "LFO 1", "LFO 2", "Env 1", "Env 2", "Env 3" } },
        { "osc2_level", "OSC2 Level", "oscilador", "float", 0.0f, 1.0f, 0.5f, 26, 26, {} },
        { "osc2_pitch", "OSC2 Pitch", "oscilador", "float", -12.0f, 12.0f, 0.0f, 25, 27, {} },
        { "osc2_tone_mod", "OSC2 Tone Mod", "oscilador", "float", 0.0f, 1.0f, 0.0f, 24, 28, {} },
        { "osc2_pitch_mod", "OSC2 Pitch Mod", "oscilador", "float", 0.0f, 1.0f, 0.0f, 23, 29, {} },
        { "osc2_aftertouch_pitch", "OSC2 Aftertouch > Pitch Mod", "oscilador", "float", 0.0f, 1.0f, 0.0f, -1, 30, {} },
        { "osc2_modwheel_pitch", "OSC2 ModWheel > Pitch Mod", "oscilador", "float", 0.0f, 1.0f, 0.0f, -1, 31, {} },
        // osc2_pitch_mod_select: ELIMINADO - es duplicado de osc2_pm_source (NRPN 32)

        // OSC GENERAL (Manual: LSB 33)
        { "noise_level", "Noise Level", "oscilador", "float", 0.0f, 1.0f, 0.0f, 27, 33, {} },
        { "sub_level", "Sub Osc Level", "oscilador", "float", 0.0f, 1.0f, 0.0f, -1, 224, {} },
        
        // PORTAMENTO / PERFORMANCE (Manual: LSB 34-37)
        { "global_portamento", "Global Portamento", "performance", "float", 0.0f, 1.0f, 0.0f, 5, 34, {} },
        { "porta_mode", "Porta Mode", "performance", "enum", 0.0f, 13.0f, 0.0f, -1, 35, { "Normal", "Fingered", "Fix-Rate", "Fix-Fing", "Exp", "Exp-Fing", "Fixed+2", "Fixed-2", "Fixed+5", "Fixed-5", "Fixed+12", "Fixed-12", "Fixed+24", "Fixed-24" } },
        { "pitch_bend_up", "Pitch Bend Up", "performance", "float", 0.0f, 24.0f, 2.0f, -1, 36, {} },
        { "pitch_bend_down", "Pitch Bend Down", "performance", "float", 0.0f, 24.0f, 2.0f, -1, 37, {} },
        
        // VCF (Manual: LSB 39-52)
        { "vcf_cutoff", "VCF Cutoff", "filtro", "float", 0.0f, 1.0f, 1.0f, 29, 39, {} },
        { "hpf_cutoff", "HPF Cutoff", "filtro", "float", 20.0f, 2000.0f, 20.0f, 35, 40, {} },
        { "vcf_resonance", "VCF Resonance", "filtro", "float", 0.0f, 1.0f, 0.0f, 30, 41, {} },
        { "vcf_env_depth", "VCF Envelope Depth", "filtro", "float", -1.0f, 1.0f, 0.0f, 31, 42, {} },
        { "vcf_env_vel", "VCF Env Velocity", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 43, {} },
        { "vcf_pitch_bend", "VCF Pitch Bend", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 44, {} },
        { "vcf_lfo_depth", "VCF LFO Depth", "filtro", "float", 0.0f, 1.0f, 0.0f, 33, 45, {} },
        { "vcf_lfo_select", "VCF LFO Select", "filtro", "enum", 0.0f, 1.0f, 0.0f, -1, 46, { "LFO 1", "LFO 2" } },
        { "vcf_aftertouch_lfo", "VCF Aftertouch > LFO", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 47, {} },
        { "vcf_modwheel_lfo", "VCF Mod Wheel > LFO", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 48, {} },
        { "vcf_key_tracking", "VCF Key Tracking", "filtro", "float", 0.0f, 1.0f, 0.0f, 34, 49, {} },
        { "vcf_env_polarity", "VCF Env Polarity", "filtro", "enum", 0.0f, 1.0f, 1.0f, -1, 50, { "Inverted", "Normal" } },
        { "vcf_pole_mode", "VCF Pole Mode", "filtro", "enum", 0.0f, 1.0f, 0.0f, -1, 51, { "4-Pole (24dB)", "2-Pole (12dB)" } },
        { "hpf_boost_enable", "HPF Bass Boost", "filtro", "bool", 0.0f, 1.0f, 0.0f, -1, 52, {} },
        
        // ENVELOPE 1 - VCA Envelope (Manual: LSB 53-61)
        { "env1_attack",  "Env1 Attack",  "envelope", "float", 0.0f, 10.0f, 0.001f, 37, 53, {} },
        { "env1_decay",   "Env1 Decay",   "envelope", "float", 0.0f, 10.0f, 0.5f,   39, 54, {} },
        { "env1_sustain", "Env1 Sustain", "envelope", "float", 0.0f, 1.0f,  0.8f,   40, 55, {} },
        { "env1_release", "Env1 Release", "envelope", "float", 0.0f, 10.0f, 0.3f,   41, 56, {} },
        { "env1_trigger_mode", "Env1 Trigger Mode", "envelope", "enum", 0.0f, 4.0f, 0.0f, -1, 57, { "Key", "LFO 1", "LFO 2", "Loop", "Seq" } },
        { "env1_attack_curve", "Env1 Attack Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 58, {} },
        { "env1_decay_curve", "Env1 Decay Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 59, {} },
        { "env1_sustain_curve", "Env1 Sustain Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 60, {} },
        { "env1_release_curve", "Env1 Release Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 61, {} },

        // ENVELOPE 2 - VCF Envelope (Manual: LSB 62-70)
        { "env2_attack",  "Env2 Attack",  "envelope", "float", 0.0f, 10.0f, 0.001f, 42, 62, {} },
        { "env2_decay",   "Env2 Decay",   "envelope", "float", 0.0f, 10.0f, 0.5f,   43, 63, {} },
        { "env2_sustain", "Env2 Sustain", "envelope", "float", 0.0f, 1.0f,  0.5f,   44, 64, {} },
        { "env2_release", "Env2 Release", "envelope", "float", 0.0f, 10.0f, 0.3f,   45, 65, {} },
        { "env2_trigger_mode", "Env2 Trigger Mode", "envelope", "enum", 0.0f, 4.0f, 0.0f, -1, 66, { "Key", "LFO 1", "LFO 2", "Loop", "Seq" } },
        { "env2_attack_curve", "Env2 Attack Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 67, {} },
        { "env2_decay_curve", "Env2 Decay Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 68, {} },
        { "env2_sustain_curve", "Env2 Sustain Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 69, {} },
        { "env2_release_curve", "Env2 Release Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 70, {} },

        // ENVELOPE 3 - Mod Envelope (Manual: LSB 71-79)
        { "env3_attack",  "Env3 Attack",  "envelope", "float", 0.0f, 10.0f, 0.001f, 46, 71, {} },
        { "env3_decay",   "Env3 Decay",   "envelope", "float", 0.0f, 10.0f, 0.5f,   47, 72, {} },
        { "env3_sustain", "Env3 Sustain", "envelope", "float", 0.0f, 1.0f,  0.0f,   48, 73, {} },
        { "env3_release", "Env3 Release", "envelope", "float", 0.0f, 10.0f, 0.3f,   49, 74, {} },
        { "env3_trigger_mode", "Env3 Trigger Mode", "envelope", "enum", 0.0f, 4.0f, 0.0f, -1, 75, { "Key", "LFO 1", "LFO 2", "Loop", "Seq" } },
        { "env3_attack_curve", "Env3 Attack Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 76, {} },
        { "env3_decay_curve", "Env3 Decay Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 77, {} },
        { "env3_sustain_curve", "Env3 Sustain Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 78, {} },
        { "env3_release_curve", "Env3 Release Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 79, {} },

        // VCA (Manual: LSB 80-83)
        { "vca_level", "VCA Level", "amplificador", "float", 0.0f, 1.0f, 0.8f, 36, 80, {} },
        { "vca_env_depth", "VCA Env Depth", "amplificador", "float", 0.0f, 1.0f, 0.0f, -1, 81, {} },
        { "vca_vel_sens", "VCA Vel Sens", "amplificador", "float", 0.0f, 1.0f, 0.0f, -1, 82, {} },
        { "vca_pan_spread", "VCA Pan Spread", "amplificador", "float", 0.0f, 1.0f, 0.0f, -1, 83, {} },
        // vca_mode: NO tiene NRPN real. Mantenido sin midiNRPN para compatibilidad de UI.
        { "vca_mode", "VCA Mode", "amplificador", "enum", 0.0f, 1.0f, 0.0f, -1, -1, { "Transparent", "Ballsy" } },

        // VOICE MODE / PRIORITY (Manual: LSB 84-92)
        { "note_priority", "Note Priority", "performance", "enum", 0.0f, 2.0f, 0.0f, -1, 84, { "Lowest", "Highest", "Last" } },
        { "voice_mode", "Voice Mode", "unison", "enum", 0.0f, 12.0f, 0.0f, -1, 85, { "Poly", "Unison 2", "Unison 3", "Unison 4", "Unison 6", "Unison 12", "Mono", "Mono 2", "Mono 3", "Mono 4", "Mono 6", "Poly 6", "Poly 8" } },
        { "trigger_mode", "Trigger Mode", "performance", "enum", 0.0f, 3.0f, 0.0f, -1, 86, { "Mono", "Retrig", "Legato", "One-shot" } },
        { "unison_detune", "Unison Detune", "unison", "float", 0.0f, 1.0f, 0.0f, 28, 87, {} },
        { "voice_drift", "Voice Drift", "unison", "float", 0.0f, 1.0f, 0.0f, -1, 88, {} },
        { "param_drift", "Param Drift", "performance", "float", 0.0f, 1.0f, 0.0f, -1, 89, {} },
        { "drift_rate", "Drift Rate", "performance", "float", 0.0f, 1.0f, 0.0f, -1, 90, {} },
        { "porta_osc_bal", "Porta Osc Bal", "performance", "float", -128.0f, 127.0f, 0.0f, -1, 91, {} },
        { "osc_key_reset", "OSC Key Down Reset", "performance", "bool", 0.0f, 1.0f, 0.0f, -1, 92, {} },

        // GLOBAL (no direct NRPN equivalent - kept for compatibility)
        // global_tune, transpose: parámetros GLOBALES, no tienen NRPN de programa
        { "global_volume", "Global Volume", "performance", "float", 0.0f, 1.0f, 0.8f, 7, -1, {} },
        { "global_tune", "Global Tune", "performance", "float", -128.0f, 127.0f, 0.0f, -1, -1, {} },
        { "transpose", "Transpose", "performance", "float", -48.0f, 48.0f, 0.0f, -1, -1, {} },
        // osc_drift es alias de voice_drift (NRPN 88)
        { "osc_drift", "OSC Drift", "performance", "float", 0.0f, 1.0f, 0.0f, -1, -1, {} },

        // MODULATION MATRIX (Manual: LSB 93-116, src=0-22, dest=0-129, depth bipolar)
        { "mod_matrix_slot1_src", "Mod Slot 1 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 93, {} },
        { "mod_matrix_slot1_dest", "Mod Slot 1 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 94, {} },
        { "mod_matrix_slot1_depth", "Mod Slot 1 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 95, {} },

        { "mod_matrix_slot2_src", "Mod Slot 2 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 96, {} },
        { "mod_matrix_slot2_dest", "Mod Slot 2 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 97, {} },
        { "mod_matrix_slot2_depth", "Mod Slot 2 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 98, {} },

        { "mod_matrix_slot3_src", "Mod Slot 3 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 99, {} },
        { "mod_matrix_slot3_dest", "Mod Slot 3 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 100, {} },
        { "mod_matrix_slot3_depth", "Mod Slot 3 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 101, {} },

        { "mod_matrix_slot4_src", "Mod Slot 4 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 102, {} },
        { "mod_matrix_slot4_dest", "Mod Slot 4 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 103, {} },
        { "mod_matrix_slot4_depth", "Mod Slot 4 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 104, {} },

        { "mod_matrix_slot5_src", "Mod Slot 5 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 105, {} },
        { "mod_matrix_slot5_dest", "Mod Slot 5 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 106, {} },
        { "mod_matrix_slot5_depth", "Mod Slot 5 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 107, {} },

        { "mod_matrix_slot6_src", "Mod Slot 6 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 108, {} },
        { "mod_matrix_slot6_dest", "Mod Slot 6 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 109, {} },
        { "mod_matrix_slot6_depth", "Mod Slot 6 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 110, {} },

        { "mod_matrix_slot7_src", "Mod Slot 7 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 111, {} },
        { "mod_matrix_slot7_dest", "Mod Slot 7 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 112, {} },
        { "mod_matrix_slot7_depth", "Mod Slot 7 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 113, {} },

        { "mod_matrix_slot8_src", "Mod Slot 8 Source", "modmatrix", "enum", 0.0f, 22.0f, 0.0f, -1, 114, {} },
        { "mod_matrix_slot8_dest", "Mod Slot 8 Dest", "modmatrix", "enum", 0.0f, 129.0f, 0.0f, -1, 115, {} },
        { "mod_matrix_slot8_depth", "Mod Slot 8 Depth", "modmatrix", "float", -1.0f, 1.0f, 0.0f, -1, 116, {} },

        // CONTROL SEQUENCER (Manual: LSB 117-122)
        { "seq_enable", "Seq Enable", "sequencer", "bool", 0.0f, 1.0f, 0.0f, -1, 117, {} },
        { "seq_clock", "Seq Clock Rate", "sequencer", "enum", 0.0f, 15.0f, 3.0f, -1, 118, { "1/2", "3/8", "1/3", "1/4", "3/16", "1/6", "1/8", "1/12", "1/16", "1/24", "1/32", "1/48", "1/64", "1/96", "1/128", "1/192" } },
        { "seq_length", "Seq Length Steps", "sequencer", "enum", 0.0f, 31.0f, 14.0f, -1, 119, { "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32" } },
        { "seq_swing", "Seq Swing", "sequencer", "float", 0.0f, 25.0f, 0.0f, -1, 120, {} },
        { "seq_key_loop", "Seq Key Loop Mode", "sequencer", "enum", 0.0f, 2.0f, 0.0f, -1, 121, { "Loop Off", "Loop On", "Unused" } },
        { "seq_slew_rate", "Seq Slew Rate", "sequencer", "float", 0.0f, 255.0f, 0.0f, -1, 122, {} },

        // SEQ STEP VALUES (Manual: LSB 123-154, 32 pasos bipolares)
        { "seq_step_1", "Seq Step 1", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 123, {} },
        { "seq_step_2", "Seq Step 2", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 124, {} },
        { "seq_step_3", "Seq Step 3", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 125, {} },
        { "seq_step_4", "Seq Step 4", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 126, {} },
        { "seq_step_5", "Seq Step 5", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 127, {} },
        { "seq_step_6", "Seq Step 6", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 128, {} },
        { "seq_step_7", "Seq Step 7", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 129, {} },
        { "seq_step_8", "Seq Step 8", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 130, {} },
        { "seq_step_9", "Seq Step 9", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 131, {} },
        { "seq_step_10", "Seq Step 10", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 132, {} },
        { "seq_step_11", "Seq Step 11", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 133, {} },
        { "seq_step_12", "Seq Step 12", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 134, {} },
        { "seq_step_13", "Seq Step 13", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 135, {} },
        { "seq_step_14", "Seq Step 14", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 136, {} },
        { "seq_step_15", "Seq Step 15", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 137, {} },
        { "seq_step_16", "Seq Step 16", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 138, {} },
        { "seq_step_17", "Seq Step 17", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 139, {} },
        { "seq_step_18", "Seq Step 18", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 140, {} },
        { "seq_step_19", "Seq Step 19", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 141, {} },
        { "seq_step_20", "Seq Step 20", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 142, {} },
        { "seq_step_21", "Seq Step 21", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 143, {} },
        { "seq_step_22", "Seq Step 22", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 144, {} },
        { "seq_step_23", "Seq Step 23", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 145, {} },
        { "seq_step_24", "Seq Step 24", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 146, {} },
        { "seq_step_25", "Seq Step 25", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 147, {} },
        { "seq_step_26", "Seq Step 26", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 148, {} },
        { "seq_step_27", "Seq Step 27", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 149, {} },
        { "seq_step_28", "Seq Step 28", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 150, {} },
        { "seq_step_29", "Seq Step 29", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 151, {} },
        { "seq_step_30", "Seq Step 30", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 152, {} },
        { "seq_step_31", "Seq Step 31", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 153, {} },
        { "seq_step_32", "Seq Step 32", "sequencer", "float", -1.0f, 1.0f, 0.0f, -1, 154, {} },

        // ARPEGGIATOR (Manual: MSB=1, LSB 155-164)
        { "arp_enable", "Arp Enable", "arp", "bool", 0.0f, 1.0f, 0.0f, -1, 155, {} },
        { "arp_mode", "Arp Mode", "arp", "enum", 0.0f, 10.0f, 0.0f, -1, 156, { "Up", "Down", "Up-Down", "Up-Inv", "Down-Inv", "Up-Dn-Inv", "Up-Alt", "Down-Alt", "Random", "As-Played", "Chord" } },
        { "arp_rate", "Arp Rate BPM", "arp", "float", 20.0f, 275.0f, 120.0f, -1, 157, {} },
        { "arp_clock_divider", "Arp Clock Divider", "arp", "enum", 0.0f, 12.0f, 0.0f, -1, 158, { "1/1", "1/2", "1/3", "1/4", "1/6", "1/8", "1/12", "1/16", "1/24", "1/32", "1/48", "1/64", "1/96" } },
        { "arp_key_sync", "Arp Key Sync", "arp", "bool", 0.0f, 1.0f, 1.0f, -1, 159, {} },
        { "arp_gate_time", "Arp Gate Time", "arp", "float", 0.0f, 255.0f, 128.0f, -1, 160, {} },
        { "arp_hold", "Arp Hold", "arp", "bool", 0.0f, 1.0f, 0.0f, -1, 161, {} },
        { "arp_pattern", "Arp Pattern", "arp", "enum", 0.0f, 64.0f, 0.0f, -1, 162, { "None", "Preset 1", "Preset 2", "Preset 3", "Preset 4", "Preset 5", "Preset 6", "Preset 7", "Preset 8", "Preset 9", "Preset 10", "Preset 11", "Preset 12", "Preset 13", "Preset 14", "Preset 15", "Preset 16", "Preset 17", "Preset 18", "Preset 19", "Preset 20", "Preset 21", "Preset 22", "Preset 23", "Preset 24", "Preset 25", "Preset 26", "Preset 27", "Preset 28", "Preset 29", "Preset 30", "Preset 31", "Preset 32", "User 1", "User 2", "User 3", "User 4", "User 5", "User 6", "User 7", "User 8", "User 9", "User 10", "User 11", "User 12", "User 13", "User 14", "User 15", "User 16", "User 17", "User 18", "User 19", "User 20", "User 21", "User 22", "User 23", "User 24", "User 25", "User 26", "User 27", "User 28", "User 29", "User 30", "User 31", "User 32" } },
        { "arp_swing", "Arp Swing", "arp", "float", 0.0f, 25.0f, 0.0f, -1, 163, {} },
        { "arp_octave", "Arp Octave Range", "arp", "enum", 0.0f, 3.0f, 0.0f, -1, 164, { "1", "2", "3", "4" } },

        // CHORD MEMORY (not in manual NRPN table - kept for UI compatibility)
        // Nota: chord_enable/poly_chord_enable/chord_key/chord_type comparten bytes con mod_matrix slots 5 y 6
        //       (bytes 105-110 del buffer SysEx). Se mantienen con midiNRPN=-1 para no solapar.
        { "chord_enable", "Chord Memory Enable", "chord", "bool", 0.0f, 1.0f, 0.0f, -1, -1, {} },
        { "poly_chord_enable", "Poly Chord Enable", "chord", "bool", 0.0f, 1.0f, 0.0f, -1, -1, {} },
        { "chord_key", "Chord Root Key", "chord", "enum", 0.0f, 11.0f, 0.0f, -1, -1, { "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B" } },
        { "chord_type", "Chord Type / Mode", "chord", "enum", 0.0f, 7.0f, 0.0f, -1, -1, { "Memory", "Major", "Minor", "Aug", "Dim", "Sus2", "Sus4", "7th" } },
        // arp_velocity_gate: comparte byte 112 con mod_matrix_slot7_dest. Se mantiene sin NRPN.
        { "arp_velocity_gate", "Arp Velocity Gate Mode", "arp", "enum", 0.0f, 2.0f, 0.0f, -1, -1, { "Gate", "Velocity", "Seq" } },

        // Slots Especiales Emulador (no NRPN)
        { "slot_a_type", "Slot A Osc Type", "custom", "enum", 0.0f, 1.0f, 0.0f, -1, -1, { "OSC1_Style", "OSC2_Style" } },
        { "slot_b_type", "Slot B Osc Type", "custom", "enum", 0.0f, 1.0f, 1.0f, -1, -1, { "OSC1_Style", "OSC2_Style" } },

        // EFFECTS ENGINE (Manual: MSB=1, LSB 165-222)
        { "fx_routing", "FX Routing Mode", "effects", "enum", 0.0f, 9.0f, 0.0f, -1, 165, { "Series", "Parallel Pairs", "Series Chain", "Full Parallel", "Dual Series Parallel", "Series Split Mid", "Parallel Pairs Series", "Series Chain + Parallel", "Parallel Front Series", "Series with Feedback" } },
        { "fx1_type", "FX1 Type", "effects", "enum", 0.0f, 35.0f, 1.0f, -1, 166, { "Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker" } },
        { "fx1_param1", "FX1 Parameter 1", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 167, {} },
        { "fx1_param2", "FX1 Parameter 2", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 168, {} },
        { "fx1_param3", "FX1 Parameter 3", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 169, {} },
        { "fx1_param4", "FX1 Parameter 4", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 170, {} },
        { "fx1_param5", "FX1 Parameter 5", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 171, {} },
        { "fx1_param6", "FX1 Parameter 6", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 172, {} },
        { "fx1_param7", "FX1 Parameter 7", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 173, {} },
        { "fx1_param8", "FX1 Parameter 8", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 174, {} },
        { "fx1_param9", "FX1 Parameter 9", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 175, {} },
        { "fx1_param10", "FX1 Parameter 10", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 176, {} },
        { "fx1_param11", "FX1 Parameter 11", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 177, {} },
        { "fx1_param12", "FX1 Parameter 12", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 178, {} },

        { "fx2_type", "FX2 Type", "effects", "enum", 0.0f, 35.0f, 4.0f, -1, 179, { "Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker" } },
        { "fx2_param1", "FX2 Parameter 1", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 180, {} },
        { "fx2_param2", "FX2 Parameter 2", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 181, {} },
        { "fx2_param3", "FX2 Parameter 3", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 182, {} },
        { "fx2_param4", "FX2 Parameter 4", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 183, {} },
        { "fx2_param5", "FX2 Parameter 5", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 184, {} },
        { "fx2_param6", "FX2 Parameter 6", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 185, {} },
        { "fx2_param7", "FX2 Parameter 7", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 186, {} },
        { "fx2_param8", "FX2 Parameter 8", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 187, {} },
        { "fx2_param9", "FX2 Parameter 9", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 188, {} },
        { "fx2_param10", "FX2 Parameter 10", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 189, {} },
        { "fx2_param11", "FX2 Parameter 11", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 190, {} },
        { "fx2_param12", "FX2 Parameter 12", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 191, {} },

        { "fx3_type", "FX3 Type", "effects", "enum", 0.0f, 35.0f, 0.0f, -1, 192, { "Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker" } },
        { "fx3_param1", "FX3 Parameter 1", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 193, {} },
        { "fx3_param2", "FX3 Parameter 2", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 194, {} },
        { "fx3_param3", "FX3 Parameter 3", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 195, {} },
        { "fx3_param4", "FX3 Parameter 4", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 196, {} },
        { "fx3_param5", "FX3 Parameter 5", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 197, {} },
        { "fx3_param6", "FX3 Parameter 6", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 198, {} },
        { "fx3_param7", "FX3 Parameter 7", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 199, {} },
        { "fx3_param8", "FX3 Parameter 8", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 200, {} },
        { "fx3_param9", "FX3 Parameter 9", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 201, {} },
        { "fx3_param10", "FX3 Parameter 10", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 202, {} },
        { "fx3_param11", "FX3 Parameter 11", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 203, {} },
        { "fx3_param12", "FX3 Parameter 12", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 204, {} },

        { "fx4_type", "FX4 Type", "effects", "enum", 0.0f, 35.0f, 0.0f, -1, 205, { "Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom", "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate", "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev", "FlangerRev", "MidasEQ", "Enhancer", "FairComp", "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem", "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay", "T-RayDelay", "DecimatorDelay", "ModDlyRev", "Stereo Chorus", "Chorus-D", "Stereo Flanger", "Stereo Phaser", "Mood Filter", "Dual Pitch", "Vintage Pitch", "Rotary Speaker" } },
        { "fx4_param1", "FX4 Parameter 1", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 206, {} },
        { "fx4_param2", "FX4 Parameter 2", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 207, {} },
        { "fx4_param3", "FX4 Parameter 3", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 208, {} },
        { "fx4_param4", "FX4 Parameter 4", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 209, {} },
        { "fx4_param5", "FX4 Parameter 5", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 210, {} },
        { "fx4_param6", "FX4 Parameter 6", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 211, {} },
        { "fx4_param7", "FX4 Parameter 7", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 212, {} },
        { "fx4_param8", "FX4 Parameter 8", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 213, {} },
        { "fx4_param9", "FX4 Parameter 9", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 214, {} },
        { "fx4_param10", "FX4 Parameter 10", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 215, {} },
        { "fx4_param11", "FX4 Parameter 11", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 216, {} },
        { "fx4_param12", "FX4 Parameter 12", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 217, {} },

        { "fx1_gain", "FX1 Output Gain", "effects", "float", 0.0f, 1.0f, 1.0f, -1, 218, {} },
        { "fx2_gain", "FX2 Output Gain", "effects", "float", 0.0f, 1.0f, 1.0f, -1, 219, {} },
        { "fx3_gain", "FX3 Output Gain", "effects", "float", 0.0f, 1.0f, 1.0f, -1, 220, {} },
        { "fx4_gain", "FX4 Output Gain", "effects", "float", 0.0f, 1.0f, 1.0f, -1, 221, {} },

        { "fx_mode", "FX Mode", "effects", "enum", 0.0f, 2.0f, 0.0f, -1, 222, { "Insert", "Send", "Bypass" } },

        // FX Feedback Gain for Routing Mode 9 (no NRPN en hardware real)
        { "fx_feedback_gain", "FX Feedback Gain", "effects", "float", 0.0f, 1.0f, 0.3f, -1, 223, {} },

        // FX Send Level for Send mode (controls dry/wet blend)
        { "fx_send_level", "FX Send Level", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 225, {} },

        // FX mix params (kept for UI compatibility - not in manual NRPN table)
        // Nota: fx1_mix/fx2_mix/fx3_mix/fx4_mix/fx_page comparten bytes con el secuenciador (130, 141, 148, 151, 127)
        //       Se mantienen con midiNRPN=-1 para no solapar.
        { "fx1_mix", "FX1 Mix", "effects", "float", 0.0f, 1.0f, 0.5f, -1, -1, {} },
        { "fx2_mix", "FX2 Mix", "effects", "float", 0.0f, 1.0f, 0.5f, -1, -1, {} },
        { "fx3_mix", "FX3 Mix", "effects", "float", 0.0f, 1.0f, 0.5f, -1, -1, {} },
        { "fx4_mix", "FX4 Mix", "effects", "float", 0.0f, 1.0f, 0.5f, -1, -1, {} },
        { "fx_page", "FX Param Page", "effects", "enum", 0.0f, 1.0f, 0.0f, -1, -1, { "Page 1", "Page 2" } },
        // unison_voices: NRPN 86 es Envelope Trigger Mode. Se mantiene sin midiNRPN.
        { "unison_voices", "Unison Voices", "unison", "enum", 0.0f, 5.0f, 1.0f, -1, -1, { "Poly", "Unison 2", "Unison 3", "Unison 4", "Unison 6", "Unison 12" } }
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
