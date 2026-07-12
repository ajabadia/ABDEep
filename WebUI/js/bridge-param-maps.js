/**
 * @purpose Mapas de parámetros estáticos y funciones de conversión raw↔normalized para el DualMidiBridge.
 * @purpose_en Static parameter maps and raw↔normalized conversion helpers for DualMidiBridge.
 * @classification Data Configuration
 * @complexity Low
 */

window.BRIDGE_PARAM_MAPS = (function() {

    // Conjunto de bytes bipolares (centro=0, raw=128)
    var BIPOLAR_BYTES = new Set([42, 83, 91, 95, 98, 101, 104, 107, 110, 113, 116, 123, 124, 125, 126, 127,
        128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143,
        144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154
    ]);

    // Mapa de bytes enum: byteOffset → rango máximo
    var ENUM_BYTES = {
        2: 6, 3: 1, 4: 1, 9: 6, 10: 1, 11: 1, 14: 2, 15: 2, 16: 5, 17: 5, 18: 1, 19: 1, 20: 1, 22: 6, 32: 6,
        35: 9, 38: 1, 46: 1, 50: 1, 51: 1, 52: 1,
        57: 4, 66: 4, 75: 4, 84: 2, 85: 12, 86: 3, 92: 1,
        117: 1, 118: 15, 119: 31, 121: 2, 155: 1, 156: 10, 158: 12, 159: 1, 161: 1, 162: 64, 164: 3, 165: 9,
        166: 35, 179: 35, 192: 35, 205: 35, 222: 2
    };

    // Mapa: paramId → byteOffset
    var PARAM_TO_BYTE_OFFSET = {
        "lfo1_rate": 0, "lfo1_delay": 1, "lfo1_shape": 2, "lfo1_key_sync": 3,
        "lfo1_arp_sync": 4, "lfo1_mono_mode": 5, "lfo1_slew": 6,
        "lfo2_rate": 7, "lfo2_delay": 8, "lfo2_shape": 9, "lfo2_key_sync": 10,
        "lfo2_arp_sync": 11, "lfo2_mono_mode": 12, "lfo2_slew": 13,
        "osc1_range": 14, "osc2_range": 15,
        "osc1_pwm_source": 16, "osc2_pm_source": 32, "osc2_tpm_source": 17,
        "osc1_square_enable": 18, "osc1_saw_enable": 19, "osc_sync_enable": 20,
        "osc1_pitch_mod": 21, "osc1_pm_source": 22,
        "osc1_lfo_aftertouch": 23, "osc1_lfo_modwheel": 24, "osc1_pwm_amount": 25,
        "osc2_level": 26, "osc2_pitch": 27, "osc2_tone_mod": 28, "osc2_pitch_mod": 29,
        "osc2_aftertouch_pitch": 30, "osc2_modwheel_pitch": 31, "osc2_pitch_mod_select": 32,
        "noise_level": 33,
        "global_portamento": 34, "porta_mode": 35,
        "pitch_bend_up": 36, "pitch_bend_down": 37, "osc1_pm_mode": 38,
        "vcf_cutoff": 39, "hpf_cutoff": 40, "vcf_resonance": 41, "vcf_env_depth": 42,
        "vcf_env_vel": 43, "vcf_pitch_bend": 44, "vcf_lfo_depth": 45,
        "vcf_lfo_select": 46, "vcf_aftertouch_lfo": 47, "vcf_modwheel_lfo": 48,
        "vcf_key_tracking": 49, "vcf_env_polarity": 50, "vcf_pole_mode": 51, "hpf_boost_enable": 52,
        "env1_attack": 53, "env1_decay": 54, "env1_sustain": 55, "env1_release": 56,
        "env1_trigger_mode": 57, "env1_attack_curve": 58, "env1_decay_curve": 59,
        "env1_sustain_curve": 60, "env1_release_curve": 61,
        "env2_attack": 62, "env2_decay": 63, "env2_sustain": 64, "env2_release": 65,
        "env2_trigger_mode": 66, "env2_attack_curve": 67, "env2_decay_curve": 68,
        "env2_sustain_curve": 69, "env2_release_curve": 70,
        "env3_attack": 71, "env3_decay": 72, "env3_sustain": 73, "env3_release": 74,
        "env3_trigger_mode": 75, "env3_attack_curve": 76, "env3_decay_curve": 77,
        "env3_sustain_curve": 78, "env3_release_curve": 79,
        "vca_level": 80, "vca_env_depth": 81, "vca_vel_sens": 82, "vca_pan_spread": 83,
        "note_priority": 84, "voice_mode": 85, "trigger_mode": 86,
        "unison_detune": 87, "voice_drift": 88, "osc_drift": 88,
        "param_drift": 89, "drift_rate": 90, "porta_osc_bal": 91, "osc_key_reset": 92,
        "mod_matrix_slot1_src": 93, "mod_matrix_slot1_dest": 94, "mod_matrix_slot1_depth": 95,
        "mod_matrix_slot2_src": 96, "mod_matrix_slot2_dest": 97, "mod_matrix_slot2_depth": 98,
        "mod_matrix_slot3_src": 99, "mod_matrix_slot3_dest": 100, "mod_matrix_slot3_depth": 101,
        "mod_matrix_slot4_src": 102, "mod_matrix_slot4_dest": 103, "mod_matrix_slot4_depth": 104,
        "mod_matrix_slot5_src": 105, "mod_matrix_slot5_dest": 106, "mod_matrix_slot5_depth": 107,
        "mod_matrix_slot6_src": 108, "mod_matrix_slot6_dest": 109, "mod_matrix_slot6_depth": 110,
        "mod_matrix_slot7_src": 111, "mod_matrix_slot7_dest": 112, "mod_matrix_slot7_depth": 113,
        "mod_matrix_slot8_src": 114, "mod_matrix_slot8_dest": 115, "mod_matrix_slot8_depth": 116,
        "seq_enable": 117, "seq_clock": 118, "seq_length": 119,
        "seq_swing": 120, "seq_key_loop": 121, "seq_slew_rate": 122,
        "seq_step_1": 123, "seq_step_2": 124, "seq_step_3": 125, "seq_step_4": 126, "seq_step_5": 127,
        "seq_step_6": 128, "seq_step_7": 129, "seq_step_8": 130, "seq_step_9": 131, "seq_step_10": 132,
        "seq_step_11": 133, "seq_step_12": 134, "seq_step_13": 135, "seq_step_14": 136, "seq_step_15": 137,
        "seq_step_16": 138, "seq_step_17": 139, "seq_step_18": 140, "seq_step_19": 141, "seq_step_20": 142,
        "seq_step_21": 143, "seq_step_22": 144, "seq_step_23": 145, "seq_step_24": 146, "seq_step_25": 147,
        "seq_step_26": 148, "seq_step_27": 149, "seq_step_28": 150, "seq_step_29": 151, "seq_step_30": 152,
        "seq_step_31": 153, "seq_step_32": 154,
        "chord_enable": 105, "poly_chord_enable": 106, "chord_key": 107, "chord_type": 108,
        "arp_enable": 155, "arp_mode": 156, "arp_rate": 157, "arp_clock_divider": 158,
        "arp_key_sync": 159, "arp_gate_time": 160, "arp_gate": 160,
        "arp_hold": 161, "arp_pattern": 162, "arp_swing": 163, "arp_octave": 164,
        "fx_routing": 165,
        "fx1_type": 166, "fx1_param1": 167, "fx1_param2": 168, "fx1_param3": 169,
        "fx1_param4": 170, "fx1_param5": 171, "fx1_param6": 172, "fx1_param7": 173,
        "fx1_param8": 174, "fx1_param9": 175, "fx1_param10": 176, "fx1_param11": 177, "fx1_param12": 178,
        "fx2_type": 179, "fx2_param1": 180, "fx2_param2": 181, "fx2_param3": 182,
        "fx2_param4": 183, "fx2_param5": 184, "fx2_param6": 185, "fx2_param7": 186,
        "fx2_param8": 187, "fx2_param9": 188, "fx2_param10": 189, "fx2_param11": 190, "fx2_param12": 191,
        "fx3_type": 192, "fx3_param1": 193, "fx3_param2": 194, "fx3_param3": 195,
        "fx3_param4": 196, "fx3_param5": 197, "fx3_param6": 198, "fx3_param7": 199,
        "fx3_param8": 200, "fx3_param9": 201, "fx3_param10": 202, "fx3_param11": 203, "fx3_param12": 204,
        "fx4_type": 205, "fx4_param1": 206, "fx4_param2": 207, "fx4_param3": 208,
        "fx4_param4": 209, "fx4_param5": 210, "fx4_param6": 211, "fx4_param7": 212,
        "fx4_param8": 213, "fx4_param9": 214, "fx4_param10": 215, "fx4_param11": 216, "fx4_param12": 217,
        "fx1_gain": 218, "fx2_gain": 219, "fx3_gain": 220, "fx4_gain": 221,
        "fx_mode": 222,
        "fx_feedback_gain": 223,
        "fx_send_level": 225
    };

    // Mapa: paramId → MIDI CC
    var PARAM_TO_CC = {
        "lfo1_rate": 16, "lfo1_delay": 17,
        "osc1_pitch_mod": 20, "osc1_pwm_amount": 21,
        "osc2_pitch_mod": 23, "osc2_tone_mod": 24, "osc2_pitch": 25, "osc2_level": 26,
        "noise_level": 27,
        "global_portamento": 5,
        "vcf_cutoff": 29, "vcf_resonance": 30, "vcf_env_depth": 31,
        "vcf_lfo_depth": 33, "vcf_key_tracking": 34, "hpf_cutoff": 35,
        "vca_level": 36,
        "env1_attack": 37, "env1_decay": 39, "env1_sustain": 40, "env1_release": 41,
        "env2_attack": 42, "env2_decay": 43, "env2_sustain": 44, "env2_release": 45,
        "env3_attack": 46, "env3_decay": 47, "env3_sustain": 48, "env3_release": 49,
        "unison_detune": 28,
        "arp_rate": 12, "arp_gate_time": 13, "arp_gate": 13,
        "global_volume": 7,
        "global_tune": 81,
        "transpose": 82
    };

    // Mapa inverso: byteOffset → [paramId, ...]
    function buildReverseMap() {
        var map = {};
        for (var paramId in PARAM_TO_BYTE_OFFSET) {
            if (PARAM_TO_BYTE_OFFSET.hasOwnProperty(paramId)) {
                var byteOff = PARAM_TO_BYTE_OFFSET[paramId];
                if (!map[byteOff]) map[byteOff] = [];
                if (map[byteOff].indexOf(paramId) === -1) {
                    map[byteOff].push(paramId);
                }
            }
        }
        return map;
    }

    var BYTE_OFFSET_TO_PARAM_IDS = buildReverseMap();

    return {
        BIPOLAR_BYTES: BIPOLAR_BYTES,
        ENUM_BYTES: ENUM_BYTES,
        PARAM_TO_BYTE_OFFSET: PARAM_TO_BYTE_OFFSET,
        PARAM_TO_CC: PARAM_TO_CC,
        BYTE_OFFSET_TO_PARAM_IDS: BYTE_OFFSET_TO_PARAM_IDS,

        /** Convierte valor raw (0-255) a normalized (0-1). Maneja bipolares y enums. */
        rawToNormalized: function(byteOffset, rawValue) {
            if (BIPOLAR_BYTES.has(byteOffset)) {
                return Math.max(0, Math.min(1, ((rawValue - 128) / 127.0 + 1) / 2));
            }
            if (ENUM_BYTES[byteOffset] !== undefined) {
                return Math.min(1, rawValue / ENUM_BYTES[byteOffset]);
            }
            return rawValue / 255.0;
        },

        /** Convierte valor normalized (0-1) a raw (0-255). Maneja bipolares y enums. */
        normalizedToRaw: function(byteOffset, normalizedValue) {
            if (BIPOLAR_BYTES.has(byteOffset)) {
                var val = ((normalizedValue * 2.0) - 1.0) * 127.0;
                return Math.round(val + 128);
            }
            if (ENUM_BYTES[byteOffset] !== undefined) {
                return Math.round(normalizedValue * ENUM_BYTES[byteOffset]);
            }
            return Math.round(normalizedValue * 255.0);
        }
    };
})();
