/**
 * @purpose Data: Cache-to-byte mapping definitions for DeepMind 12 SysEx.
 * Each entry defines how a normalized parameter cache value maps to a
 * raw SysEx byte (0-255). Supports unipolar scaling (* scale), bipolar
 * conversion (bipolar: true), and special FX type clamping.
 * @purpose_en Cache-to-byte SysEx mapping table.
 */

(function() {
    const Logger = globalThis.Logger || console;

    /**
     * CACHE_MAP — ordered array of mapping entries.
     * Each entry: { byte, param, scale?, bipolar?, formula?, default? }
     *
     * - byte:       Target SysEx byte offset (0-245)
     * - param:      Cache key name in dualMidiBridge.parameterCache
     * - scale:      Multiplier for normalized value (default 255)
     * - bipolar:    If true, uses ((val*2-1)*127)+128 for bipolar centering
     * - formula:    'fxType' → Math.min(val, 1.0) * 56
     * - default:    Fallback value if param is undefined
     */
    window.CACHE_MAP = [

        // ── LFO 1 (bytes 0-6) ──
        { byte: 0,  param: 'lfo1_rate' },
        { byte: 1,  param: 'lfo1_delay' },
        { byte: 2,  param: 'lfo1_shape' },
        { byte: 3,  param: 'lfo1_key_sync' },
        { byte: 4,  param: 'lfo1_arp_sync' },
        { byte: 5,  param: 'lfo1_mono_mode' },
        { byte: 6,  param: 'lfo1_slew' },

        // ── LFO 2 (bytes 7-13) ──
        { byte: 7,  param: 'lfo2_rate' },
        { byte: 8,  param: 'lfo2_delay' },
        { byte: 9,  param: 'lfo2_shape' },
        { byte: 10, param: 'lfo2_key_sync' },
        { byte: 11, param: 'lfo2_arp_sync' },
        { byte: 12, param: 'lfo2_mono_mode' },
        { byte: 13, param: 'lfo2_slew' },

        // ── OSC 1 (bytes 14-25) — note byte 15 is OSC2 ──
        { byte: 14, param: 'osc1_range',          scale: 2 },
        { byte: 16, param: 'osc1_pwm_source',     scale: 23 },
        // Both osc2_pm_source and osc2_tpm_source map to byte 17 (last write wins)
        { byte: 17, param: 'osc2_pm_source',      scale: 23 },
        { byte: 17, param: 'osc2_tpm_source',     scale: 23 },
        { byte: 18, param: 'osc1_square_enable' },
        { byte: 19, param: 'osc1_saw_enable' },
        { byte: 20, param: 'osc_sync_enable' },
        { byte: 21, param: 'osc1_pitch_mod' },
        { byte: 22, param: 'osc1_pm_source',      scale: 23 },
        { byte: 23, param: 'osc1_lfo_aftertouch' },
        { byte: 24, param: 'osc1_lfo_modwheel' },
        { byte: 25, param: 'osc1_pwm_amount' },

        // ── OSC 2 (bytes 15, 26-32) ──
        { byte: 15, param: 'osc2_range',                scale: 2 },
        { byte: 26, param: 'osc2_level' },
        { byte: 27, param: 'osc2_pitch' },
        { byte: 28, param: 'osc2_tone_mod' },
        { byte: 29, param: 'osc2_pitch_mod' },
        { byte: 30, param: 'osc2_aftertouch_pitch' },
        { byte: 31, param: 'osc2_modwheel_pitch' },
        { byte: 32, param: 'osc2_pitch_mod_select',     scale: 6 },

        // ── Global / Noise (bytes 33-38) ──
        { byte: 33, param: 'noise_level' },
        { byte: 34, param: 'global_portamento' },
        { byte: 35, param: 'porta_mode',       scale: 13 },
        { byte: 36, param: 'pitch_bend_up' },
        { byte: 37, param: 'pitch_bend_down' },
        { byte: 38, param: 'osc1_pm_mode',     scale: 1 },

        // ── VCF (bytes 39-52, 245) ──
        { byte: 39, param: 'vcf_cutoff' },
        { byte: 40, param: 'hpf_cutoff' },
        { byte: 41, param: 'vcf_resonance' },
        { byte: 42, param: 'vcf_env_depth',        bipolar: true },
        { byte: 43, param: 'vcf_env_vel' },
        { byte: 44, param: 'vcf_pitch_bend' },
        { byte: 45, param: 'vcf_lfo_depth' },
        { byte: 46, param: 'vcf_lfo_select' },
        { byte: 47, param: 'vcf_aftertouch_lfo' },
        { byte: 48, param: 'vcf_modwheel_lfo' },
        { byte: 49, param: 'vcf_key_tracking' },
        { byte: 50, param: 'vcf_env_polarity' },
        { byte: 51, param: 'vcf_pole_mode' },
        { byte: 52, param: 'hpf_boost_enable' },
        { byte: 245, param: 'vcf_model',           scale: 2, default: 0 },

        // ── ENV 1 — VCA Envelope (bytes 53-61) ──
        { byte: 53, param: 'env1_attack' },
        { byte: 54, param: 'env1_decay' },
        { byte: 55, param: 'env1_sustain' },
        { byte: 56, param: 'env1_release' },
        { byte: 57, param: 'env1_trigger_mode',    scale: 4 },
        { byte: 58, param: 'env1_attack_curve' },
        { byte: 59, param: 'env1_decay_curve' },
        { byte: 60, param: 'env1_sustain_curve' },
        { byte: 61, param: 'env1_release_curve' },

        // ── ENV 2 — VCF Envelope (bytes 62-70) ──
        { byte: 62, param: 'env2_attack' },
        { byte: 63, param: 'env2_decay' },
        { byte: 64, param: 'env2_sustain' },
        { byte: 65, param: 'env2_release' },
        { byte: 66, param: 'env2_trigger_mode',    scale: 4 },
        { byte: 67, param: 'env2_attack_curve' },
        { byte: 68, param: 'env2_decay_curve' },
        { byte: 69, param: 'env2_sustain_curve' },
        { byte: 70, param: 'env2_release_curve' },

        // ── ENV 3 — Modulation Envelope (bytes 71-79) ──
        { byte: 71, param: 'env3_attack' },
        { byte: 72, param: 'env3_decay' },
        { byte: 73, param: 'env3_sustain' },
        { byte: 74, param: 'env3_release' },
        { byte: 75, param: 'env3_trigger_mode',    scale: 4 },
        { byte: 76, param: 'env3_attack_curve' },
        { byte: 77, param: 'env3_decay_curve' },
        { byte: 78, param: 'env3_sustain_curve' },
        { byte: 79, param: 'env3_release_curve' },

        // ── VCA (bytes 80-83) ──
        { byte: 80, param: 'vca_level' },
        { byte: 81, param: 'vca_env_depth' },
        { byte: 82, param: 'vca_vel_sens' },
        { byte: 83, param: 'vca_pan_spread' },

        // ── Voice / Performance (bytes 84-92) ──
        { byte: 84, param: 'note_priority',         scale: 2 },
        { byte: 85, param: 'voice_mode',            scale: 12 },
        { byte: 86, param: 'trigger_mode',          scale: 3 },
        { byte: 87, param: 'unison_detune' },
        { byte: 88, param: 'voice_drift' },
        { byte: 89, param: 'param_drift' },
        { byte: 90, param: 'drift_rate' },
        { byte: 91, param: 'porta_osc_bal',         bipolar: true },
        { byte: 92, param: 'osc_key_reset' },

        // ── ARP (bytes 155-164) ──
        { byte: 155, param: 'arp_enable' },
        { byte: 156, param: 'arp_mode',             scale: 10 },
        { byte: 157, param: 'arp_rate' },
        { byte: 158, param: 'arp_clock_divider',    scale: 12 },
        { byte: 159, param: 'arp_key_sync' },
        { byte: 160, param: 'arp_gate_time' },
        { byte: 161, param: 'arp_hold' },
        { byte: 162, param: 'arp_pattern',          scale: 64 },
        { byte: 163, param: 'arp_swing',            scale: 25 },
        { byte: 164, param: 'arp_octave',           scale: 3 },

        // ── SEQ (bytes 117-122) ──
        { byte: 117, param: 'seq_enable' },
        { byte: 118, param: 'seq_clock',            scale: 15 },
        { byte: 119, param: 'seq_length',           scale: 31 },
        { byte: 120, param: 'seq_swing',            scale: 25 },
        { byte: 121, param: 'seq_key_loop',         scale: 2 },
        { byte: 122, param: 'seq_slew_rate' },

        // ── FX Global (bytes 165, 222) ──
        { byte: 165, param: 'fx_routing',           scale: 9 },
        { byte: 222, param: 'fx_mode',              scale: 2 },

        // ── FX1 Type + Params (bytes 166-178, gain=218) ──
        { byte: 166, param: 'fx1_type',             formula: 'fxType' },
        { byte: 167, param: 'fx1_param1' },
        { byte: 168, param: 'fx1_param2' },
        { byte: 169, param: 'fx1_param3' },
        { byte: 170, param: 'fx1_param4' },
        { byte: 171, param: 'fx1_param5' },
        { byte: 172, param: 'fx1_param6' },
        { byte: 173, param: 'fx1_param7' },
        { byte: 174, param: 'fx1_param8' },
        { byte: 175, param: 'fx1_param9' },
        { byte: 176, param: 'fx1_param10' },
        { byte: 177, param: 'fx1_param11' },
        { byte: 178, param: 'fx1_param12' },
        { byte: 218, param: 'fx1_gain' },

        // ── FX2 Type + Params (bytes 179-191, gain=219) ──
        { byte: 179, param: 'fx2_type',             formula: 'fxType' },
        { byte: 180, param: 'fx2_param1' },
        { byte: 181, param: 'fx2_param2' },
        { byte: 182, param: 'fx2_param3' },
        { byte: 183, param: 'fx2_param4' },
        { byte: 184, param: 'fx2_param5' },
        { byte: 185, param: 'fx2_param6' },
        { byte: 186, param: 'fx2_param7' },
        { byte: 187, param: 'fx2_param8' },
        { byte: 188, param: 'fx2_param9' },
        { byte: 189, param: 'fx2_param10' },
        { byte: 190, param: 'fx2_param11' },
        { byte: 191, param: 'fx2_param12' },
        { byte: 219, param: 'fx2_gain' },

        // ── FX3 Type + Params (bytes 192-204, gain=220) ──
        { byte: 192, param: 'fx3_type',             formula: 'fxType' },
        { byte: 193, param: 'fx3_param1' },
        { byte: 194, param: 'fx3_param2' },
        { byte: 195, param: 'fx3_param3' },
        { byte: 196, param: 'fx3_param4' },
        { byte: 197, param: 'fx3_param5' },
        { byte: 198, param: 'fx3_param6' },
        { byte: 199, param: 'fx3_param7' },
        { byte: 200, param: 'fx3_param8' },
        { byte: 201, param: 'fx3_param9' },
        { byte: 202, param: 'fx3_param10' },
        { byte: 203, param: 'fx3_param11' },
        { byte: 204, param: 'fx3_param12' },
        { byte: 220, param: 'fx3_gain' },

        // ── FX4 Type + Params (bytes 205-217, gain=221) ──
        { byte: 205, param: 'fx4_type',             formula: 'fxType' },
        { byte: 206, param: 'fx4_param1' },
        { byte: 207, param: 'fx4_param2' },
        { byte: 208, param: 'fx4_param3' },
        { byte: 209, param: 'fx4_param4' },
        { byte: 210, param: 'fx4_param5' },
        { byte: 211, param: 'fx4_param6' },
        { byte: 212, param: 'fx4_param7' },
        { byte: 213, param: 'fx4_param8' },
        { byte: 214, param: 'fx4_param9' },
        { byte: 215, param: 'fx4_param10' },
        { byte: 216, param: 'fx4_param11' },
        { byte: 217, param: 'fx4_param12' },
        { byte: 221, param: 'fx4_gain' },

        // ── MOD MATRIX Slot 1 (bytes 93-95) ──
        { byte: 93,  param: 'mod_matrix_slot1_src',     scale: 22 },
        { byte: 94,  param: 'mod_matrix_slot1_dest',    scale: 129 },
        { byte: 95,  param: 'mod_matrix_slot1_depth',   bipolar: true },

        // ── MOD MATRIX Slot 2 (bytes 96-98) ──
        { byte: 96,  param: 'mod_matrix_slot2_src',     scale: 22 },
        { byte: 97,  param: 'mod_matrix_slot2_dest',    scale: 129 },
        { byte: 98,  param: 'mod_matrix_slot2_depth',   bipolar: true },

        // ── MOD MATRIX Slot 3 (bytes 99-101) ──
        { byte: 99,  param: 'mod_matrix_slot3_src',     scale: 22 },
        { byte: 100, param: 'mod_matrix_slot3_dest',    scale: 129 },
        { byte: 101, param: 'mod_matrix_slot3_depth',   bipolar: true },

        // ── MOD MATRIX Slot 4 (bytes 102-104) ──
        { byte: 102, param: 'mod_matrix_slot4_src',     scale: 22 },
        { byte: 103, param: 'mod_matrix_slot4_dest',    scale: 129 },
        { byte: 104, param: 'mod_matrix_slot4_depth',   bipolar: true },

        // ── MOD MATRIX Slot 5 (bytes 105-107) ──
        // ⚠️ Chord params (chord_enable, chord_type, etc.) are virtual (indices 300+)
        // and are NOT part of SysEx preset data. Do NOT map them here — they would
        // corrupt MOD MATRIX slots 5/6 which share these byte offsets.
        { byte: 105, param: 'mod_matrix_slot5_src',     scale: 22 },
        { byte: 106, param: 'mod_matrix_slot5_dest',    scale: 129 },
        { byte: 107, param: 'mod_matrix_slot5_depth',   bipolar: true },

        // ── MOD MATRIX Slot 6 (bytes 108-110) ──
        { byte: 108, param: 'mod_matrix_slot6_src',     scale: 22 },
        { byte: 109, param: 'mod_matrix_slot6_dest',    scale: 129 },
        { byte: 110, param: 'mod_matrix_slot6_depth',   bipolar: true },

        // ── MOD MATRIX Slot 7 (bytes 111-113) ──
        { byte: 111, param: 'mod_matrix_slot7_src',     scale: 22 },
        { byte: 112, param: 'mod_matrix_slot7_dest',    scale: 129 },
        { byte: 113, param: 'mod_matrix_slot7_depth',   bipolar: true },

        // ── MOD MATRIX Slot 8 (bytes 114-116) ──
        { byte: 114, param: 'mod_matrix_slot8_src',     scale: 22 },
        { byte: 115, param: 'mod_matrix_slot8_dest',    scale: 129 },
        { byte: 116, param: 'mod_matrix_slot8_depth',   bipolar: true },

    ];

    Logger.log('[CacheMapper] CACHE_MAP loaded (' + window.CACHE_MAP.length + ' entries)');
})();
