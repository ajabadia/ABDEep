// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

/**
 * @purpose Generates musical random presets within safe bounds for the synthesizer.
 * @purpose_en Musical random patch generator.
 */

document.addEventListener('DOMContentLoaded', () => {
    const randBtn = document.getElementById('random-preset-btn');
    if (randBtn) {
        randBtn.addEventListener('click', () => {
            Logger.log('[RandomGenerator] Generando patch aleatorio musical...');
            
            // 1. Elegir un arquetipo musical aleatorio
            const archetypes = ['pad', 'lead', 'bass', 'brass', 'keys'];
            const type = archetypes[Math.floor(Math.random() * archetypes.length)];

            // 2. Efectos musicales seguros (evitar Pitch Shifters extremos, RingMod o Vocoder en aleatorio)
            const musicalFxTypes = [0, 1, 2, 3, 4, 10, 11, 13, 14, 17, 18, 20, 22, 27, 30, 37, 40]; // Reverbs, Chorus, Delays, EQ
            const pickFx = () => {
                const id = musicalFxTypes[Math.floor(Math.random() * musicalFxTypes.length)];
                return id / 56.0;
            };

            const musicalRanges = {
                // OSCs: Garantizar al menos un oscilador activado
                'osc1_saw_enable': (type === 'bass' || type === 'lead' || Math.random() > 0.4) ? 1.0 : 0.0,
                'osc1_square_enable': Math.random() > 0.5 ? 1.0 : 0.0,
                'osc1_pwm_amount': 0.1 + Math.random() * 0.4,
                'osc1_pitch_mod': Math.random() * 0.05, // Modulación sutil de afinación (afinación limpia)
                'osc1_range': type === 'bass' ? 0.0 : (type === 'lead' || type === 'keys' ? 0.5 : Math.floor(Math.random() * 3) / 2.0),
                'osc1_pm_source': 0.0, // PM desactivado por defecto en random para evitar ruidos de disonancia
                'osc1_pwm_source': Math.random() > 0.5 ? 0.2 : 0.0,
                'osc1_pm_mode': 0.0,
                'osc1_lfo_aftertouch': Math.random() * 0.1,
                'osc1_lfo_modwheel': Math.random() * 0.1,

                'osc2_pitch': 0.5, // Octava fundamental estable por defecto
                'osc2_tone_mod': Math.random() * 0.4,
                'osc2_level': type === 'bass' ? 0.3 : 0.5 + Math.random() * 0.4,
                'osc2_pitch_mod': Math.random() * 0.05,
                'osc2_range': type === 'bass' ? 0.0 : 0.5,
                'osc2_pm_source': 0.0,
                'osc2_tpm_source': 0.0,
                'osc2_aftertouch_pitch': 0.0,
                'osc2_modwheel_pitch': Math.random() * 0.1,
                'osc2_pitch_mod_select': 0.0,

                'osc_sync_enable': Math.random() > 0.85 ? 1.0 : 0.0,
                'noise_level': type === 'percussion' ? 0.3 : Math.random() * 0.05, // Ruido muy bajo

                // Portamento / Performance
                'global_portamento': type === 'lead' && Math.random() > 0.5 ? Math.random() * 0.2 : 0.0,
                'porta_mode': 0.0,
                'pitch_bend_up': 0.5,
                'pitch_bend_down': 0.5,

                // HPF / VCF (Filtro musical bien calibrado)
                'hpf_cutoff': 0.0, // HPF desactivado para no quitar graves
                'hpf_boost_enable': 0.0,

                'vcf_cutoff': type === 'pad' ? 0.3 + Math.random() * 0.3 : 0.4 + Math.random() * 0.4,
                'vcf_resonance': Math.random() * 0.4, // Resonancia moderada (evitar auto-oscilación chillona)
                'vcf_env_depth': 0.3 + Math.random() * 0.4,
                'vcf_env_vel': 0.2 + Math.random() * 0.3,
                'vcf_pitch_bend': 0.5,
                'vcf_lfo_depth': Math.random() * 0.15, // LFO sutil en filtro
                'vcf_lfo_select': 0.0,
                'vcf_aftertouch_lfo': Math.random() * 0.2,
                'vcf_modwheel_lfo': Math.random() * 0.2,
                'vcf_key_tracking': 0.3 + Math.random() * 0.4,
                'vcf_pole_mode': Math.random() > 0.5 ? 1.0 : 0.0,
                'vcf_env_polarity': 1.0,

                // VCA
                'vca_level': 0.8,
                'vca_mode': 0.0, // Siempre controlado por ENV 1 para evitar tonos continuos sin soltar
                'vca_env_depth': 1.0,
                'vca_vel_sens': 0.3 + Math.random() * 0.3,
                'vca_pan_spread': Math.random() * 0.3,

                // ENV 1 (VCA Envelope Musical)
                'env1_attack': type === 'pad' ? 0.3 + Math.random() * 0.4 : (type === 'keys' || type === 'bass' ? 0.01 : Math.random() * 0.1),
                'env1_decay': 0.2 + Math.random() * 0.4,
                'env1_sustain': type === 'pad' || type === 'brass' ? 0.7 + Math.random() * 0.3 : (type === 'bass' ? 0.4 : 0.5),
                'env1_release': type === 'pad' ? 0.4 + Math.random() * 0.4 : 0.15 + Math.random() * 0.25,
                'env1_trigger_mode': 0.0,
                'env1_attack_curve': 0.5,
                'env1_decay_curve': 0.5,
                'env1_sustain_curve': 0.5,
                'env1_release_curve': 0.5,

                // ENV 2 (VCF Envelope Musical)
                'env2_attack': type === 'pad' ? 0.2 + Math.random() * 0.4 : 0.01 + Math.random() * 0.1,
                'env2_decay': 0.2 + Math.random() * 0.5,
                'env2_sustain': type === 'pad' ? 0.4 + Math.random() * 0.4 : Math.random() * 0.5,
                'env2_release': 0.15 + Math.random() * 0.3,
                'env2_trigger_mode': 0.0,
                'env2_attack_curve': 0.5,
                'env2_decay_curve': 0.5,
                'env2_sustain_curve': 0.5,
                'env2_release_curve': 0.5,

                // ENV 3 (MOD)
                'env3_attack': 0.1,
                'env3_decay': 0.3,
                'env3_sustain': 0.5,
                'env3_release': 0.3,
                'env3_trigger_mode': 0.0,
                'env3_attack_curve': 0.5,
                'env3_decay_curve': 0.5,
                'env3_sustain_curve': 0.5,
                'env3_release_curve': 0.5,

                // LFOs (Velocidades musicales lentas/moderadas)
                'lfo1_rate': 0.1 + Math.random() * 0.3, // Evitar LFOs de 50Hz que suenan a FM/efectos de ciencia ficción
                'lfo1_delay': 0.0,
                'lfo1_shape': Math.random() > 0.3 ? 0.0 : 0.166, // Seno o Triángulo predominantemente
                'lfo1_key_sync': 1.0,
                'lfo1_arp_sync': 0.0,
                'lfo1_mono_mode': 0.0,
                'lfo1_slew': 0.0,
                'lfo2_rate': 0.1 + Math.random() * 0.3,
                'lfo2_delay': 0.0,
                'lfo2_shape': 0.0,
                'lfo2_key_sync': 1.0,
                'lfo2_arp_sync': 0.0,
                'lfo2_mono_mode': 0.0,
                'lfo2_slew': 0.0,

                // Voice / Unison / Drift
                'note_priority': 1.0,
                'voice_mode': type === 'bass' || type === 'lead' ? (Math.random() > 0.5 ? 1.0 : 0.0) : 0.0, // Mono/Poly según tipo
                'trigger_mode': 0.0,
                'unison_detune': Math.random() * 0.25, // Detune musical analógico leve
                'voice_drift': 0.1 + Math.random() * 0.2, // Vintage drift natural
                'param_drift': 0.1,
                'drift_rate': 0.5,
                'porta_osc_bal': 0.5,
                'osc_key_reset': 0.0,
                'osc_drift': 0.1,

                // Desactivar Arp/Seq/Chord por defecto al generar un patch base aleatorio
                'arp_rate': 0.4,
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

                // FX Globales Musicales
                'fx_routing': 0.0,
                'fx_mode': 0.0, // Insert mode
                'fx1_type': pickFx(), // Selección de FX de lista musical segura (Chorus, Reverb, Delay)
                'fx1_gain': 0.3 + Math.random() * 0.3,
                'fx1_param1': 0.5,
                'fx1_param2': 0.5,
                'fx1_param3': 0.5,
                'fx2_type': 0.0, // Solo 1 efecto para evitar barro sonoro
                'fx2_gain': 0.0,
                'fx2_param1': 0.5,
                'fx2_param2': 0.5,
                'fx3_type': 0.0,
                'fx3_gain': 0.0,
                'fx3_param1': 0.5,
                'fx4_type': 0.0,
                'fx4_gain': 0.0,
                'fx4_param1': 0.5,
            };

            // MODULATION MATRIX: Máximo 2 ruteos moderados para mantener estabilidad musical
            const maxModSlots = (window.appMode === 'advanced') ? 32 : 8;
            for (let s = 1; s <= maxModSlots; s++) {
                if (s <= 2 && Math.random() > 0.5) {
                    // Ruteos musicales clásicos (ej. LFO1 -> Cutoff o Velocity -> Env Depth)
                    musicalRanges['mod_matrix_slot' + s + '_src'] = 0.1; 
                    musicalRanges['mod_matrix_slot' + s + '_dest'] = 0.2;
                    musicalRanges['mod_matrix_slot' + s + '_depth'] = 0.1 + Math.random() * 0.3;
                } else {
                    musicalRanges['mod_matrix_slot' + s + '_src'] = 0.0;
                    musicalRanges['mod_matrix_slot' + s + '_dest'] = 0.0;
                    musicalRanges['mod_matrix_slot' + s + '_depth'] = 0.5; // Neutral
                }
            }

            if (getBridge()) {
                for (const paramId in musicalRanges) {
                    getBridge().setParameter(paramId, musicalRanges[paramId]);
                    getBridge().handleParameterChangeFromBackend(paramId, musicalRanges[paramId]);
                }
            }
        });
    }
});
