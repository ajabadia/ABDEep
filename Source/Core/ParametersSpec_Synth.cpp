/**
 * @purpose Parameter specs: LFO, OSC, VCF, ENV, VCA — core synth engine categories.
 * Each function returns a sub-vector consumed by ParametersSpec::getSpecs().
 */
#include "ParametersSpec.h"

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getLfoSpecs()
{
    return {
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
    };
}

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getOscSpecs()
{
    return {
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

        // OSC GENERAL
        { "noise_level", "Noise Level", "oscilador", "float", 0.0f, 1.0f, 0.0f, 27, 33, {} },
        { "sub_level", "Sub Osc Level", "oscilador", "float", 0.0f, 1.0f, 0.0f, -1, 224, {} },
    };
}

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getVcfSpecs()
{
    return {
        // VCF (Manual: LSB 39-52)
        { "vcf_cutoff", "VCF Cutoff", "filtro", "float", 0.0f, 1.0f, 1.0f, 29, 39, {} },
        { "hpf_cutoff", "HPF Cutoff", "filtro", "float", 20.0f, 2000.0f, 20.0f, 35, 40, {} },
        { "vcf_resonance", "VCF Resonance", "filtro", "float", 0.0f, 1.0f, 0.0f, 30, 41, {} },
        { "vcf_env_depth", "VCF Envelope Depth", "filtro", "float", 0.0f, 1.0f, 0.5f, 31, 42, {} },
        { "vcf_env_vel", "VCF Env Velocity", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 43, {} },
        { "vcf_pitch_bend", "VCF Pitch Bend", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 44, {} },
        { "vcf_lfo_depth", "VCF LFO Depth", "filtro", "float", 0.0f, 1.0f, 0.0f, 33, 45, {} },
        { "vcf_lfo_select", "VCF LFO Select", "filtro", "enum", 0.0f, 1.0f, 0.0f, -1, 46, { "LFO 1", "LFO 2" } },
        { "vcf_aftertouch_lfo", "VCF Aftertouch > LFO", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 47, {} },
        { "vcf_modwheel_lfo", "VCF Mod Wheel > LFO", "filtro", "float", 0.0f, 1.0f, 0.0f, -1, 48, {} },
        { "vcf_key_tracking", "VCF Key Tracking", "filtro", "float", 0.0f, 1.0f, 0.0f, 34, 49, {} },
        { "vcf_env_polarity", "VCF Env Polarity", "filtro", "enum", 0.0f, 1.0f, 1.0f, -1, 50, { "Inverted", "Normal" } },
        { "vcf_pole_mode", "VCF Pole Mode", "filtro", "enum", 0.0f, 1.0f, 0.0f, -1, 51, { "4-Pole (24dB)", "2-Pole (12dB)" } },
#if DEEP_TARGET_MODEL >= 2
        { "vcf_oversample", "VCF Oversample", "filtro", "enum", 0.0f, 2.0f, 0.0f, -1, -1, { "1x (Off)", "2x", "4x" } },
        { "vcf_model", "VCF Model", "filtro", "enum", 0.0f, 2.0f, 0.0f, -1, 245, { "DM12 OTA", "Moog Ladder", "Korg MS-20" } },
        { "vcf_moog_submode", "Moog Filter Type", "filtro", "enum", 0.0f, 2.0f, 0.0f, -1, 246, { "Lowpass", "Bandpass", "Highpass" } },
        { "vcf_korg_submode", "Korg Filter Type", "filtro", "enum", 0.0f, 1.0f, 0.0f, -1, 247, { "K35 Lowpass", "K35 Highpass" } },
#endif
        { "vcf_voicing_mode", "VCF Voicing Mode", "filtro", "enum", 0.0f, 1.0f, 0.0f, -1, -1, { "DeepMind", "Juno-106" } },
        { "hpf_boost_enable", "HPF Bass Boost", "filtro", "bool", 0.0f, 1.0f, 0.0f, -1, 52, {} },
        { "hpf_bass_boost_gain", "HPF Bass Boost Gain", "filtro", "float", 0.1f, 3.0f, 1.0f, -1, -1, {} },
    };
}

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getEnvSpecs()
{
    return {
        // ENVELOPE 1 - VCA Envelope (Manual: LSB 53-61)
        { "env1_attack",  "Env1 Attack",  "envelope", "float", 0.0f, 1.0f, 0.01f, 37, 53, {} },
        { "env1_decay",   "Env1 Decay",   "envelope", "float", 0.0f, 1.0f, 0.3f,  39, 54, {} },
        { "env1_sustain", "Env1 Sustain", "envelope", "float", 0.0f, 1.0f, 0.8f,  40, 55, {} },
        { "env1_release", "Env1 Release", "envelope", "float", 0.0f, 1.0f, 0.3f,  41, 56, {} },
        { "env1_trigger_mode", "Env1 Trigger Mode", "envelope", "enum", 0.0f, 4.0f, 0.0f, -1, 57, { "Key", "LFO 1", "LFO 2", "Loop", "Seq" } },
        { "env1_attack_curve", "Env1 Attack Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 58, {} },
        { "env1_decay_curve", "Env1 Decay Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 59, {} },
        { "env1_sustain_curve", "Env1 Sustain Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 60, {} },
        { "env1_release_curve", "Env1 Release Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 61, {} },

        // ENVELOPE 2 - VCF Envelope (Manual: LSB 62-70)
        { "env2_attack",  "Env2 Attack",  "envelope", "float", 0.0f, 1.0f, 0.01f, 42, 62, {} },
        { "env2_decay",   "Env2 Decay",   "envelope", "float", 0.0f, 1.0f, 0.3f,  43, 63, {} },
        { "env2_sustain", "Env2 Sustain", "envelope", "float", 0.0f, 1.0f, 0.5f,  44, 64, {} },
        { "env2_release", "Env2 Release", "envelope", "float", 0.0f, 1.0f, 0.3f,  45, 65, {} },
        { "env2_trigger_mode", "Env2 Trigger Mode", "envelope", "enum", 0.0f, 4.0f, 0.0f, -1, 66, { "Key", "LFO 1", "LFO 2", "Loop", "Seq" } },
        { "env2_attack_curve", "Env2 Attack Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 67, {} },
        { "env2_decay_curve", "Env2 Decay Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 68, {} },
        { "env2_sustain_curve", "Env2 Sustain Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 69, {} },
        { "env2_release_curve", "Env2 Release Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 70, {} },

        // ENVELOPE 3 - Mod Envelope (Manual: LSB 71-79)
        { "env3_attack",  "Env3 Attack",  "envelope", "float", 0.0f, 1.0f, 0.01f, 46, 71, {} },
        { "env3_decay",   "Env3 Decay",   "envelope", "float", 0.0f, 1.0f, 0.3f,  47, 72, {} },
        { "env3_sustain", "Env3 Sustain", "envelope", "float", 0.0f, 1.0f, 0.0f,  48, 73, {} },
        { "env3_release", "Env3 Release", "envelope", "float", 0.0f, 1.0f, 0.3f,  49, 74, {} },
        { "env3_trigger_mode", "Env3 Trigger Mode", "envelope", "enum", 0.0f, 4.0f, 0.0f, -1, 75, { "Key", "LFO 1", "LFO 2", "Loop", "Seq" } },
        { "env3_attack_curve", "Env3 Attack Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 76, {} },
        { "env3_decay_curve", "Env3 Decay Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 77, {} },
        { "env3_sustain_curve", "Env3 Sustain Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 78, {} },
        { "env3_release_curve", "Env3 Release Curve", "envelope", "float", 0.0f, 1.0f, 0.5f, -1, 79, {} },
    };
}

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getVcaSpecs()
{
    return {
        // VCA (Manual: LSB 80-83)
        { "vca_level", "VCA Level", "amplificador", "float", 0.0f, 1.0f, 0.8f, 36, 80, {} },
        { "vca_env_depth", "VCA Env Depth", "amplificador", "float", 0.0f, 1.0f, 1.0f, -1, 81, {} },
        { "vca_vel_sens", "VCA Vel Sens", "amplificador", "float", 0.0f, 1.0f, 0.5f, -1, 82, {} },
        { "vca_pan_spread", "VCA Pan Spread", "amplificador", "float", 0.0f, 1.0f, 0.0f, -1, 83, {} },
        { "vca_mode", "VCA Mode", "amplificador", "enum", 0.0f, 1.0f, 0.0f, -1, -1, { "Transparent", "Ballsy" } },
    };
}
