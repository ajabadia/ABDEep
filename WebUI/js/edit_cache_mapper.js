/**
 * @purpose Maps parameter cache values back into raw unpacked Behringer DeepMind 12 SysEx payload bytes.
 * @purpose_en Parameter Cache to SysEx bytes mapper.
 */

window.updateUnpackedBytesFromCache = function(unpackedBytes) {
    if (!window.dualMidiBridge) {return;}
    const cache = window.dualMidiBridge.parameterCache;

    const set = (idx, val) => {
        if (val !== undefined && val !== null && !isNaN(val)) {
            unpackedBytes[idx] = Math.round(Math.max(0, Math.min(255, val)));
        }
    };

    // LFO 1 (bytes 0-6)
    set(0, cache['lfo1_rate'] * 255);
    set(1, cache['lfo1_delay'] * 255);
    set(2, cache['lfo1_shape'] * 255);
    set(3, cache['lfo1_key_sync'] * 255);
    set(4, cache['lfo1_arp_sync'] * 255);
    set(5, cache['lfo1_mono_mode'] * 255);
    set(6, cache['lfo1_slew'] * 255);

    // LFO 2 (bytes 7-13)
    set(7, cache['lfo2_rate'] * 255);
    set(8, cache['lfo2_delay'] * 255);
    set(9, cache['lfo2_shape'] * 255);
    set(10, cache['lfo2_key_sync'] * 255);
    set(11, cache['lfo2_arp_sync'] * 255);
    set(12, cache['lfo2_mono_mode'] * 255);
    set(13, cache['lfo2_slew'] * 255);

    // OSC 1 (bytes 14-25)
    set(14, cache['osc1_range'] * 2);
    set(16, cache['osc1_pwm_source'] * 23);
    set(17, cache['osc2_pm_source'] * 23);
    set(17, cache['osc2_tpm_source'] * 23);
    set(18, cache['osc1_square_enable'] * 255);
    set(19, cache['osc1_saw_enable'] * 255);
    set(20, cache['osc_sync_enable'] * 255);
    set(21, cache['osc1_pitch_mod'] * 255);
    set(22, cache['osc1_pm_source'] * 23);
    set(23, cache['osc1_lfo_aftertouch'] * 255);
    set(24, cache['osc1_lfo_modwheel'] * 255);
    set(25, cache['osc1_pwm_amount'] * 255);

    // OSC 2 (bytes 15, 26-32)
    set(15, cache['osc2_range'] * 2);
    set(26, cache['osc2_level'] * 255);
    set(27, cache['osc2_pitch'] * 255);
    set(28, cache['osc2_tone_mod'] * 255);
    set(29, cache['osc2_pitch_mod'] * 255);
    set(30, cache['osc2_aftertouch_pitch'] * 255);
    set(31, cache['osc2_modwheel_pitch'] * 255);
    set(32, cache['osc2_pitch_mod_select'] * 6);

    // Global / Noise
    set(33, cache['noise_level'] * 255);

    // Portamento / Pitch Bend / Misc (bytes 34-38)
    set(34, cache['global_portamento'] * 255);
    set(35, cache['porta_mode'] * 13);
    set(36, cache['pitch_bend_up'] * 255);
    set(37, cache['pitch_bend_down'] * 255);
    set(38, cache['osc1_pm_mode'] * 1);

    // VCF (bytes 39-52)
    set(39, cache['vcf_cutoff'] * 255);
    set(40, cache['hpf_cutoff'] * 255);
    set(41, cache['vcf_resonance'] * 255);
    if (cache['vcf_env_depth'] !== undefined) {
        set(42, ((cache['vcf_env_depth'] * 2 - 1) * 127) + 128);
    }
    set(43, cache['vcf_env_vel'] * 255);
    set(44, cache['vcf_pitch_bend'] * 255);
    set(45, cache['vcf_lfo_depth'] * 255);
    set(46, cache['vcf_lfo_select'] * 255);
    set(47, cache['vcf_aftertouch_lfo'] * 255);
    set(48, cache['vcf_modwheel_lfo'] * 255);
    set(49, cache['vcf_key_tracking'] * 255);
    set(50, cache['vcf_env_polarity'] * 255);
    set(51, cache['vcf_pole_mode'] * 255);
    set(52, cache['hpf_boost_enable'] * 255);

    // ENV 1 - VCA Envelope (bytes 53-61)
    set(53, cache['env1_attack'] * 255);
    set(54, cache['env1_decay'] * 255);
    set(55, cache['env1_sustain'] * 255);
    set(56, cache['env1_release'] * 255);
    set(57, cache['env1_trigger_mode'] * 4);
    set(58, cache['env1_attack_curve'] * 255);
    set(59, cache['env1_decay_curve'] * 255);
    set(60, cache['env1_sustain_curve'] * 255);
    set(61, cache['env1_release_curve'] * 255);

    // ENV 2 - VCF Envelope (bytes 62-70)
    set(62, cache['env2_attack'] * 255);
    set(63, cache['env2_decay'] * 255);
    set(64, cache['env2_sustain'] * 255);
    set(65, cache['env2_release'] * 255);
    set(66, cache['env2_trigger_mode'] * 4);
    set(67, cache['env2_attack_curve'] * 255);
    set(68, cache['env2_decay_curve'] * 255);
    set(69, cache['env2_sustain_curve'] * 255);
    set(70, cache['env2_release_curve'] * 255);

    // ENV 3 - Mod Envelope (bytes 71-79)
    set(71, cache['env3_attack'] * 255);
    set(72, cache['env3_decay'] * 255);
    set(73, cache['env3_sustain'] * 255);
    set(74, cache['env3_release'] * 255);
    set(75, cache['env3_trigger_mode'] * 4);
    set(76, cache['env3_attack_curve'] * 255);
    set(77, cache['env3_decay_curve'] * 255);
    set(78, cache['env3_sustain_curve'] * 255);
    set(79, cache['env3_release_curve'] * 255);

    // VCA (bytes 80-83)
    set(80, cache['vca_level'] * 255);
    set(81, cache['vca_env_depth'] * 255);
    set(82, cache['vca_vel_sens'] * 255);
    set(83, cache['vca_pan_spread'] * 255);

    // Voice / Performance (bytes 84-92)
    set(84, cache['note_priority'] * 2);
    set(85, cache['voice_mode'] * 12);
    set(86, cache['trigger_mode'] * 3);
    set(87, cache['unison_detune'] * 255);
    set(88, cache['voice_drift'] * 255);
    set(89, cache['param_drift'] * 255);
    set(90, cache['drift_rate'] * 255);
    if (cache['porta_osc_bal'] !== undefined) {
        set(91, ((cache['porta_osc_bal'] * 2 - 1) * 127) + 128);
    }
    set(92, cache['osc_key_reset'] * 255);

    // FX Global (bytes 165, 222)
    set(165, cache['fx_routing'] * 9);
    set(222, cache['fx_mode'] * 2);

    // FX1 Type + Params (bytes 166-178, gain=218)
    set(166, cache['fx1_type'] * 35);
    set(167, cache['fx1_param1'] * 255);
    set(168, cache['fx1_param2'] * 255);
    set(169, cache['fx1_param3'] * 255);
    set(170, cache['fx1_param4'] * 255);
    set(171, cache['fx1_param5'] * 255);
    set(172, cache['fx1_param6'] * 255);
    set(173, cache['fx1_param7'] * 255);
    set(174, cache['fx1_param8'] * 255);
    set(175, cache['fx1_param9'] * 255);
    set(176, cache['fx1_param10'] * 255);
    set(177, cache['fx1_param11'] * 255);
    set(178, cache['fx1_param12'] * 255);
    set(218, cache['fx1_gain'] * 255);

    // FX2 Type + Params (bytes 179-191, gain=219)
    set(179, cache['fx2_type'] * 35);
    set(180, cache['fx2_param1'] * 255);
    set(181, cache['fx2_param2'] * 255);
    set(182, cache['fx2_param3'] * 255);
    set(183, cache['fx2_param4'] * 255);
    set(184, cache['fx2_param5'] * 255);
    set(185, cache['fx2_param6'] * 255);
    set(186, cache['fx2_param7'] * 255);
    set(187, cache['fx2_param8'] * 255);
    set(188, cache['fx2_param9'] * 255);
    set(189, cache['fx2_param10'] * 255);
    set(190, cache['fx2_param11'] * 255);
    set(191, cache['fx2_param12'] * 255);
    set(219, cache['fx2_gain'] * 255);

    // FX3 Type + Params (bytes 192-204, gain=220)
    set(192, cache['fx3_type'] * 35);
    set(193, cache['fx3_param1'] * 255);
    set(194, cache['fx3_param2'] * 255);
    set(195, cache['fx3_param3'] * 255);
    set(196, cache['fx3_param4'] * 255);
    set(197, cache['fx3_param5'] * 255);
    set(198, cache['fx3_param6'] * 255);
    set(199, cache['fx3_param7'] * 255);
    set(200, cache['fx3_param8'] * 255);
    set(201, cache['fx3_param9'] * 255);
    set(202, cache['fx3_param10'] * 255);
    set(203, cache['fx3_param11'] * 255);
    set(204, cache['fx3_param12'] * 255);
    set(220, cache['fx3_gain'] * 255);

    // FX4 Type + Params (bytes 205-217, gain=221)
    set(205, cache['fx4_type'] * 35);
    set(206, cache['fx4_param1'] * 255);
    set(207, cache['fx4_param2'] * 255);
    set(208, cache['fx4_param3'] * 255);
    set(209, cache['fx4_param4'] * 255);
    set(210, cache['fx4_param5'] * 255);
    set(211, cache['fx4_param6'] * 255);
    set(212, cache['fx4_param7'] * 255);
    set(213, cache['fx4_param8'] * 255);
    set(214, cache['fx4_param9'] * 255);
    set(215, cache['fx4_param10'] * 255);
    set(216, cache['fx4_param11'] * 255);
    set(217, cache['fx4_param12'] * 255);
    set(221, cache['fx4_gain'] * 255);

    // ARP
    set(155, cache['arp_enable'] * 255);
    set(156, cache['arp_mode'] * 10);
    set(157, cache['arp_rate'] * 255);
    set(158, cache['arp_clock_divider'] * 12);
    set(159, cache['arp_key_sync'] * 255);
    set(160, cache['arp_gate_time'] * 255);
    set(161, cache['arp_hold'] * 255);
    set(162, cache['arp_pattern'] * 64);
    set(163, cache['arp_swing'] * 25);
    set(164, cache['arp_octave'] * 3);

    // SEQ
    set(117, cache['seq_enable'] * 255);
    set(118, cache['seq_clock'] * 15);
    set(119, cache['seq_length'] * 31);
    set(120, cache['seq_swing'] * 25);
    set(121, cache['seq_key_loop'] * 2);
    set(122, cache['seq_slew_rate'] * 255);
    // Chord params are virtual (indices 300+) — not part of SysEx preset data.
    // Do NOT write them here to avoid corrupting mod_matrix slots 5/6 (bytes 105-108).

    // MODULATION MATRIX
    set(93, cache['mod_matrix_slot1_src'] * 22);
    set(94, cache['mod_matrix_slot1_dest'] * 129);
    if (cache['mod_matrix_slot1_depth'] !== undefined) {
        set(95, ((cache['mod_matrix_slot1_depth'] * 2 - 1) * 127) + 128);
    }

    set(96, cache['mod_matrix_slot2_src'] * 22);
    set(97, cache['mod_matrix_slot2_dest'] * 129);
    if (cache['mod_matrix_slot2_depth'] !== undefined) {
        set(98, ((cache['mod_matrix_slot2_depth'] * 2 - 1) * 127) + 128);
    }

    set(99, cache['mod_matrix_slot3_src'] * 22);
    set(100, cache['mod_matrix_slot3_dest'] * 129);
    if (cache['mod_matrix_slot3_depth'] !== undefined) {
        set(101, ((cache['mod_matrix_slot3_depth'] * 2 - 1) * 127) + 128);
    }

    set(102, cache['mod_matrix_slot4_src'] * 22);
    set(103, cache['mod_matrix_slot4_dest'] * 129);
    if (cache['mod_matrix_slot4_depth'] !== undefined) {
        set(104, ((cache['mod_matrix_slot4_depth'] * 2 - 1) * 127) + 128);
    }

    set(105, cache['mod_matrix_slot5_src'] * 22);
    set(106, cache['mod_matrix_slot5_dest'] * 129);
    if (cache['mod_matrix_slot5_depth'] !== undefined) {
        set(107, ((cache['mod_matrix_slot5_depth'] * 2 - 1) * 127) + 128);
    }

    set(108, cache['mod_matrix_slot6_src'] * 22);
    set(109, cache['mod_matrix_slot6_dest'] * 129);
    if (cache['mod_matrix_slot6_depth'] !== undefined) {
        set(110, ((cache['mod_matrix_slot6_depth'] * 2 - 1) * 127) + 128);
    }

    set(111, cache['mod_matrix_slot7_src'] * 22);
    set(112, cache['mod_matrix_slot7_dest'] * 129);
    if (cache['mod_matrix_slot7_depth'] !== undefined) {
        set(113, ((cache['mod_matrix_slot7_depth'] * 2 - 1) * 127) + 128);
    }

    set(114, cache['mod_matrix_slot8_src'] * 22);
    set(115, cache['mod_matrix_slot8_dest'] * 129);
    if (cache['mod_matrix_slot8_depth'] !== undefined) {
        set(116, ((cache['mod_matrix_slot8_depth'] * 2 - 1) * 127) + 128);
    }
};
