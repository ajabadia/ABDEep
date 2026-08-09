/**
 * @purpose Parameter specs: Voice mode, Performance, Portamento, Global, Special slots.
 */
#include "ParametersSpec.h"

std::vector<ParametersSpec::ParamInfo> ParametersSpec::getVoiceSpecs()
{
    return {
        // PORTAMENTO / PERFORMANCE (Manual: LSB 34-37)
        { "global_portamento", "Global Portamento", "performance", "float", 0.0f, 1.0f, 0.0f, 5, 34, {} },
        { "porta_mode", "Porta Mode", "performance", "enum", 0.0f, 13.0f, 0.0f, -1, 35, { "Normal", "Fingered", "Fix-Rate", "Fix-Fing", "Exp", "Exp-Fing", "Fixed+2", "Fixed-2", "Fixed+5", "Fixed-5", "Fixed+12", "Fixed-12", "Fixed+24", "Fixed-24" } },
        { "pitch_bend_up", "Pitch Bend Up", "performance", "float", 0.0f, 24.0f, 2.0f, -1, 36, {} },
        { "pitch_bend_down", "Pitch Bend Down", "performance", "float", 0.0f, 24.0f, 2.0f, -1, 37, {} },

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

        // GLOBAL (no direct NRPN equivalent)
        { "global_volume", "Global Volume", "performance", "float", 0.0f, 1.0f, 0.8f, 7, -1, {} },
        { "master_softclip_bypass", "Master Soft Clip Bypass", "performance", "bool", 0.0f, 1.0f, 0.0f, -1, -1, {} },
        { "master_softclip_headroom", "Master Soft Clip Headroom", "performance", "float", 0.0f, 1.0f, 0.0f, -1, -1, {} },
        { "global_tune", "Global Tune", "performance", "float", -128.0f, 127.0f, 0.0f, -1, -1, {} },
        { "transpose", "Transpose", "performance", "float", -48.0f, 48.0f, 0.0f, -1, -1, {} },
        { "osc_drift", "OSC Drift", "performance", "float", 0.0f, 1.0f, 0.0f, -1, -1, {} },

        // Special Emulator Slots (no NRPN)
        { "slot_a_type", "Slot A Osc Type", "custom", "enum", 0.0f, 1.0f, 0.0f, -1, -1, { "OSC1_Style", "OSC2_Style" } },
        { "slot_b_type", "Slot B Osc Type", "custom", "enum", 0.0f, 1.0f, 1.0f, -1, -1, { "OSC1_Style", "OSC2_Style" } },
    };
}
