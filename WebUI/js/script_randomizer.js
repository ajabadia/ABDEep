/**
 * @purpose Generates musical random presets within safe bounds for the synthesizer.
 * @purpose_en Musical random patch generator.
 */

document.addEventListener('DOMContentLoaded', () => {
    const randBtn = document.getElementById('random-preset-btn');
    if (randBtn) {
        randBtn.addEventListener('click', () => {
            console.log('[RandomGenerator] Generando patch aleatorio musical...');
            
            const musicalRanges = {
                // OSCs
                'osc1_saw_enable': Math.random() > 0.3 ? 1.0 : 0.0,
                'osc1_square_enable': Math.random() > 0.5 ? 1.0 : 0.0,
                'osc1_pwm_amount': 0.2 + Math.random() * 0.6,
                'osc1_pitch_mod': Math.random() * 0.3,
                'osc1_range': Math.floor(Math.random() * 3) / 2.0,
                'osc1_pm_source': Math.random() > 0.4 ? Math.floor(Math.random() * 7) / 6.0 : 0.0,
                'osc1_pwm_source': Math.random() > 0.5 ? Math.floor(Math.random() * 6) / 5.0 : 0.0,
                'osc1_pm_mode': Math.random() > 0.3 ? 1.0 : 0.0,
                'osc1_lfo_aftertouch': Math.random() * 0.3,
                'osc1_lfo_modwheel': Math.random() * 0.3,

                'osc2_pitch': 0.3 + Math.random() * 0.4,
                'osc2_tone_mod': Math.random() * 0.8,
                'osc2_level': 0.2 + Math.random() * 0.7,
                'osc2_pitch_mod': Math.random() * 0.3,
                'osc2_range': Math.floor(Math.random() * 3) / 2.0,
                'osc2_pm_source': Math.random() > 0.4 ? Math.floor(Math.random() * 7) / 6.0 : 0.0,
                'osc2_tpm_source': Math.random() > 0.4 ? Math.floor(Math.random() * 6) / 5.0 : 0.0,
                'osc2_aftertouch_pitch': Math.random() * 0.3,
                'osc2_modwheel_pitch': Math.random() * 0.3,
                'osc2_pitch_mod_select': Math.floor(Math.random() * 7) / 6.0,

                'osc_sync_enable': Math.random() > 0.8 ? 1.0 : 0.0,
                'noise_level': Math.random() * 0.2,

                // Portamento / Performance
                'global_portamento': Math.random() * 0.5,
                'porta_mode': Math.random(),
                'pitch_bend_up': 0.5,
                'pitch_bend_down': 0.5,

                // HPF / VCF
                'hpf_cutoff': Math.random() * 0.3,
                'hpf_boost_enable': Math.random() > 0.7 ? 1.0 : 0.0,

                'vcf_cutoff': 0.3 + Math.random() * 0.6,
                'vcf_resonance': Math.random() * 0.7,
                'vcf_env_depth': 0.3 + Math.random() * 0.5,
                'vcf_env_vel': Math.random() * 0.5,
                'vcf_pitch_bend': Math.random() * 0.5,
                'vcf_lfo_depth': Math.random() * 0.4,
                'vcf_lfo_select': Math.random() > 0.5 ? 1.0 : 0.0,
                'vcf_aftertouch_lfo': Math.random() * 0.3,
                'vcf_modwheel_lfo': Math.random() * 0.3,
                'vcf_key_tracking': Math.random() * 0.6,
                'vcf_pole_mode': Math.random() > 0.5 ? 1.0 : 0.0,
                'vcf_env_polarity': 1.0,

                // VCA
                'vca_level': 0.7 + Math.random() * 0.3,
                'vca_mode': Math.random() > 0.8 ? 1.0 : 0.0,
                'vca_env_depth': 1.0,
                'vca_vel_sens': Math.random() * 0.4,
                'vca_pan_spread': 0.0,

                // ENV 1 (VCA)
                'env1_attack': Math.random() * 0.15,
                'env1_decay': 0.1 + Math.random() * 0.5,
                'env1_sustain': 0.5 + Math.random() * 0.5,
                'env1_release': 0.1 + Math.random() * 0.6,
                'env1_trigger_mode': 0.0,
                'env1_attack_curve': 0.5,
                'env1_decay_curve': 0.5,
                'env1_sustain_curve': 0.5,
                'env1_release_curve': 0.5,

                // ENV 2 (VCF)
                'env2_attack': Math.random() * 0.4,
                'env2_decay': 0.1 + Math.random() * 0.7,
                'env2_sustain': Math.random() * 0.8,
                'env2_release': 0.1 + Math.random() * 0.8,
                'env2_trigger_mode': 0.0,
                'env2_attack_curve': 0.5,
                'env2_decay_curve': 0.5,
                'env2_sustain_curve': 0.5,
                'env2_release_curve': 0.5,

                // ENV 3 (MOD)
                'env3_attack': Math.random(),
                'env3_decay': Math.random(),
                'env3_sustain': Math.random(),
                'env3_release': Math.random(),
                'env3_trigger_mode': 0.0,
                'env3_attack_curve': 0.5,
                'env3_decay_curve': 0.5,
                'env3_sustain_curve': 0.5,
                'env3_release_curve': 0.5,

                // LFOs
                'lfo1_rate': Math.random() * 0.6,
                'lfo1_delay': Math.random() * 0.4,
                'lfo1_shape': Math.floor(Math.random() * 7) / 6.0,
                'lfo1_key_sync': Math.random() > 0.2 ? 1.0 : 0.0,
                'lfo1_arp_sync': Math.random() > 0.7 ? 1.0 : 0.0,
                'lfo1_mono_mode': Math.random() > 0.6 ? 1.0 : 0.0,
                'lfo1_slew': Math.random() * 0.3,
                'lfo2_rate': Math.random() * 0.6,
                'lfo2_delay': Math.random() * 0.4,
                'lfo2_shape': Math.floor(Math.random() * 7) / 6.0,
                'lfo2_key_sync': Math.random() > 0.2 ? 1.0 : 0.0,
                'lfo2_arp_sync': Math.random() > 0.7 ? 1.0 : 0.0,
                'lfo2_mono_mode': Math.random() > 0.6 ? 1.0 : 0.0,
                'lfo2_slew': Math.random() * 0.3,

                // Voice / Unison
                'note_priority': 1.0,
                'voice_mode': 0.0,
                'trigger_mode': 0.0,
                'unison_detune': Math.random() * 0.5,
                'voice_drift': Math.random() * 0.3,
                'param_drift': Math.random() * 0.3,
                'drift_rate': 0.5,
                'porta_osc_bal': 0.5,
                'osc_key_reset': 0.0,
                'osc_drift': Math.random() * 0.3,

                // Arp / Seq / Chord
                'arp_rate': 0.3 + Math.random() * 0.4,
                'arp_gate': 0.5,
                'arp_enable': 0.0,
                'arp_hold': 0.0,
                'arp_key_sync': 1.0,
                'arp_clock_divider': 0.0,
                'arp_mode': 0.0,
                'arp_swing': 0.0,
                'arp_octave': 0.0,
                'arp_pattern': 0.0,
                'seq_enable': 0.0,
                'seq_clock': 0.0,
                'seq_length': 0.0,
                'seq_swing': 0.0,
                'seq_key_loop': 0.0,
                'seq_slew_rate': 0.0,
                'chord_enable': 0.0,
                'poly_chord_enable': 0.0,

                // MODULATION MATRIX
                'mod_matrix_slot1_src': Math.random() > 0.3 ? Math.floor(Math.random() * 23) / 22.0 : 0.0,
                'mod_matrix_slot1_dest': Math.floor(Math.random() * 130) / 129.0,
                'mod_matrix_slot1_depth': Math.random() > 0.3 ? Math.random() : 0.5,
                'mod_matrix_slot2_src': Math.random() > 0.3 ? Math.floor(Math.random() * 23) / 22.0 : 0.0,
                'mod_matrix_slot2_dest': Math.floor(Math.random() * 130) / 129.0,
                'mod_matrix_slot2_depth': Math.random() > 0.3 ? Math.random() : 0.5,
                'mod_matrix_slot3_src': Math.random() > 0.3 ? Math.floor(Math.random() * 23) / 22.0 : 0.0,
                'mod_matrix_slot3_dest': Math.floor(Math.random() * 130) / 129.0,
                'mod_matrix_slot3_depth': Math.random() > 0.3 ? Math.random() : 0.5,
                'mod_matrix_slot4_src': Math.random() > 0.3 ? Math.floor(Math.random() * 23) / 22.0 : 0.0,
                'mod_matrix_slot4_dest': Math.floor(Math.random() * 130) / 129.0,
                'mod_matrix_slot4_depth': Math.random() > 0.3 ? Math.random() : 0.5,
                'mod_matrix_slot5_src': Math.random() > 0.3 ? Math.floor(Math.random() * 23) / 22.0 : 0.0,
                'mod_matrix_slot5_dest': Math.floor(Math.random() * 130) / 129.0,
                'mod_matrix_slot5_depth': Math.random() > 0.3 ? Math.random() : 0.5,
                'mod_matrix_slot6_src': Math.random() > 0.3 ? Math.floor(Math.random() * 23) / 22.0 : 0.0,
                'mod_matrix_slot6_dest': Math.floor(Math.random() * 130) / 129.0,
                'mod_matrix_slot6_depth': Math.random() > 0.3 ? Math.random() : 0.5,
                'mod_matrix_slot7_src': Math.random() > 0.3 ? Math.floor(Math.random() * 23) / 22.0 : 0.0,
                'mod_matrix_slot7_dest': Math.floor(Math.random() * 130) / 129.0,
                'mod_matrix_slot7_depth': Math.random() > 0.3 ? Math.random() : 0.5,
                'mod_matrix_slot8_src': Math.random() > 0.3 ? Math.floor(Math.random() * 23) / 22.0 : 0.0,
                'mod_matrix_slot8_dest': Math.floor(Math.random() * 130) / 129.0,
                'mod_matrix_slot8_depth': Math.random() > 0.3 ? Math.random() : 0.5,

                // FX Global
                'fx_routing': Math.floor(Math.random() * 10) / 9.0,
                'fx_mode': Math.floor(Math.random() * 3) / 2.0,
                'fx1_type': Math.random() > 0.2 ? Math.floor(Math.random() * 36) / 35.0 : 0.0,
                'fx1_gain': 0.5 + Math.random() * 0.5,
                'fx1_param1': Math.random(),
                'fx1_param2': Math.random(),
                'fx1_param3': Math.random(),
                'fx2_type': Math.random() > 0.2 ? Math.floor(Math.random() * 36) / 35.0 : 0.0,
                'fx2_gain': 0.5 + Math.random() * 0.5,
                'fx2_param1': Math.random(),
                'fx2_param2': Math.random(),
                'fx3_type': Math.random() > 0.2 ? Math.floor(Math.random() * 36) / 35.0 : 0.0,
                'fx3_gain': 0.5 + Math.random() * 0.5,
                'fx3_param1': Math.random(),
                'fx4_type': Math.random() > 0.2 ? Math.floor(Math.random() * 36) / 35.0 : 0.0,
                'fx4_gain': 0.5 + Math.random() * 0.5,
            };

            if (window.dualMidiBridge) {
                for (const paramId in musicalRanges) {
                    window.dualMidiBridge.setParameter(paramId, musicalRanges[paramId]);
                    window.dualMidiBridge.handleParameterChangeFromBackend(paramId, musicalRanges[paramId]);
                }
            }
        });
    }
});
