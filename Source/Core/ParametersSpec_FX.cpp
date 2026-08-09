/**
 * @purpose Parameter specs: FX Engine — routing, 4 slots (type + 12 params + gain), mode, feedback, send.
 */
#include "ParametersSpec.h"

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getFxSpecs()
{
    return {
        // EFFECTS ENGINE (Manual: MSB=1, LSB 165-222)
        { "fx_routing", "FX Routing Mode", "effects", "enum", 0.0f, 9.0f, 0.0f, -1, 165, { "Series", "Parallel Pairs", "Series Chain", "Full Parallel", "Dual Series Parallel", "Series Split Mid", "Parallel Pairs Series", "Series Chain + Parallel", "Parallel Front Series", "Series with Feedback" } },
        { "fx1_type", "FX1 Type", "effects", "enum", 0.0f, 49.0f, 1.0f, -1, 166, { "Bypass", "HallReverb", "Plate Reverb", "Rich Plate", "Ambience", "Gated Reverb", "Reverse Reverb", "RackAmp", "Mood Filter", "Stereo Phaser", "Stereo Chorus", "Stereo Flanger", "ModDlyRev", "Delay", "3Tap Delay", "4Tap Delay", "Rotary Speaker", "Chorus-D", "Enhancer", "Edison", "AutoPan/Trem", "T-RayDelay", "tcDeepVerb", "flangVerb", "chorusVerb", "delayVerb", "ChamberRev", "RoomRev", "VintageRoom", "Dual Pitch", "MidasEQ", "FairComp", "MBDistortion", "NoiseGate", "DecimatorDelay", "Vintage Pitch", "RolandBBDChorus", "SolinaEnsemble", "RingModulator", "SpaceEchoRE201", "AnalogTapeDelay", "ShimmerDelay", "GranularDelay", "PatternFreeze", "DuckingDelay", "SpectralDelay", "FreqShifter", "HarmonicResonator", "Combulator", "Vocoder" } },
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

        { "fx2_type", "FX2 Type", "effects", "enum", 0.0f, 49.0f, 4.0f, -1, 179, { "Bypass", "HallReverb", "Plate Reverb", "Rich Plate", "Ambience", "Gated Reverb", "Reverse Reverb", "RackAmp", "Mood Filter", "Stereo Phaser", "Stereo Chorus", "Stereo Flanger", "ModDlyRev", "Delay", "3Tap Delay", "4Tap Delay", "Rotary Speaker", "Chorus-D", "Enhancer", "Edison", "AutoPan/Trem", "T-RayDelay", "tcDeepVerb", "flangVerb", "chorusVerb", "delayVerb", "ChamberRev", "RoomRev", "VintageRoom", "Dual Pitch", "MidasEQ", "FairComp", "MBDistortion", "NoiseGate", "DecimatorDelay", "Vintage Pitch", "RolandBBDChorus", "SolinaEnsemble", "RingModulator", "SpaceEchoRE201", "AnalogTapeDelay", "ShimmerDelay", "GranularDelay", "PatternFreeze", "DuckingDelay", "SpectralDelay", "FreqShifter", "HarmonicResonator", "Combulator", "Vocoder" } },
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

        { "fx3_type", "FX3 Type", "effects", "enum", 0.0f, 49.0f, 0.0f, -1, 192, { "Bypass", "HallReverb", "Plate Reverb", "Rich Plate", "Ambience", "Gated Reverb", "Reverse Reverb", "RackAmp", "Mood Filter", "Stereo Phaser", "Stereo Chorus", "Stereo Flanger", "ModDlyRev", "Delay", "3Tap Delay", "4Tap Delay", "Rotary Speaker", "Chorus-D", "Enhancer", "Edison", "AutoPan/Trem", "T-RayDelay", "tcDeepVerb", "flangVerb", "chorusVerb", "delayVerb", "ChamberRev", "RoomRev", "VintageRoom", "Dual Pitch", "MidasEQ", "FairComp", "MBDistortion", "NoiseGate", "DecimatorDelay", "Vintage Pitch", "RolandBBDChorus", "SolinaEnsemble", "RingModulator", "SpaceEchoRE201", "AnalogTapeDelay", "ShimmerDelay", "GranularDelay", "PatternFreeze", "DuckingDelay", "SpectralDelay", "FreqShifter", "HarmonicResonator", "Combulator", "Vocoder" } },
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

        { "fx4_type", "FX4 Type", "effects", "enum", 0.0f, 49.0f, 0.0f, -1, 205, { "Bypass", "HallReverb", "Plate Reverb", "Rich Plate", "Ambience", "Gated Reverb", "Reverse Reverb", "RackAmp", "Mood Filter", "Stereo Phaser", "Stereo Chorus", "Stereo Flanger", "ModDlyRev", "Delay", "3Tap Delay", "4Tap Delay", "Rotary Speaker", "Chorus-D", "Enhancer", "Edison", "AutoPan/Trem", "T-RayDelay", "tcDeepVerb", "flangVerb", "chorusVerb", "delayVerb", "ChamberRev", "RoomRev", "VintageRoom", "Dual Pitch", "MidasEQ", "FairComp", "MBDistortion", "NoiseGate", "DecimatorDelay", "Vintage Pitch", "RolandBBDChorus", "SolinaEnsemble", "RingModulator", "SpaceEchoRE201", "AnalogTapeDelay", "ShimmerDelay", "GranularDelay", "PatternFreeze", "DuckingDelay", "SpectralDelay", "FreqShifter", "HarmonicResonator", "Combulator", "Vocoder" } },
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

        // FX Send Level for Send mode
        { "fx_send_level", "FX Send Level", "effects", "float", 0.0f, 1.0f, 0.5f, -1, 225, {} },

        // FX mix params (kept for UI compatibility)
        { "fx1_mix", "FX1 Mix", "effects", "float", 0.0f, 1.0f, 1.0f, -1, -1, {} },
        { "fx2_mix", "FX2 Mix", "effects", "float", 0.0f, 1.0f, 1.0f, -1, -1, {} },
        { "fx3_mix", "FX3 Mix", "effects", "float", 0.0f, 1.0f, 1.0f, -1, -1, {} },
        { "fx4_mix", "FX4 Mix", "effects", "float", 0.0f, 1.0f, 1.0f, -1, -1, {} },
    };
}
