/**
 * @purpose Tests for WebUI/js/script_randomizer.js — Random sound generator for the synthesizer.
 * @purpose_en Tests for the musical random patch generator function.
 * 
 * Source: DOMContentLoaded listener that generates random parameter values within safe musical
 *         bounds. The core logic is extracted as generateMusicalRanges(rng) where rng is a
 *         random function (default Math.random) injected for testability.
 *
 * Note: Tests use constant-RNG functions (e.g. () => 0.5) for reproducibility.
 *       All r() calls within the generator return the same value, so each parameter's
 *       output depends only on its expression formula and the constant seed value.
 *       This is simpler and more deterministic than cycleRng, which would require
 *       knowing the exact call index for each parameter.
 */

// =============================================================================
// Extracted functions (mirror the source's core logic)
// =============================================================================

/**
 * Generates a random set of parameter values within safe musical ranges.
 * @param {function} rng - Random number generator (0..1), default Math.random
 * @returns {object} Parameter ID → normalized value map
 */
function generateMusicalRanges(rng) {
    if (typeof rng !== 'function') {rng = Math.random;}
    const r = rng;
    return {
        // OSCs
        'osc1_saw_enable': r() > 0.3 ? 1.0 : 0.0,
        'osc1_square_enable': r() > 0.5 ? 1.0 : 0.0,
        'osc1_pwm_amount': 0.2 + r() * 0.6,
        'osc1_pitch_mod': r() * 0.3,
        'osc1_range': Math.floor(r() * 3) / 2.0,
        'osc1_pm_source': r() > 0.4 ? Math.floor(r() * 23) / 23.0 : 0.0,
        'osc1_pwm_source': r() > 0.5 ? Math.floor(r() * 23) / 23.0 : 0.0,
        'osc1_pm_mode': r() > 0.3 ? 1.0 : 0.0,
        'osc1_lfo_aftertouch': r() * 0.3,
        'osc1_lfo_modwheel': r() * 0.3,

        'osc2_pitch': 0.3 + r() * 0.4,
        'osc2_tone_mod': r() * 0.8,
        'osc2_level': 0.2 + r() * 0.7,
        'osc2_pitch_mod': r() * 0.3,
        'osc2_range': Math.floor(r() * 3) / 2.0,
        'osc2_pm_source': r() > 0.4 ? Math.floor(r() * 23) / 23.0 : 0.0,
        'osc2_tpm_source': r() > 0.4 ? Math.floor(r() * 23) / 23.0 : 0.0,
        'osc2_aftertouch_pitch': r() * 0.3,
        'osc2_modwheel_pitch': r() * 0.3,
        'osc2_pitch_mod_select': Math.floor(r() * 7) / 6.0,

        'osc_sync_enable': r() > 0.8 ? 1.0 : 0.0,
        'noise_level': r() * 0.2,

        // Portamento / Performance
        'global_portamento': r() * 0.5,
        'porta_mode': r(),
        'pitch_bend_up': 0.5,
        'pitch_bend_down': 0.5,

        // HPF / VCF
        'hpf_cutoff': r() * 0.3,
        'hpf_boost_enable': r() > 0.7 ? 1.0 : 0.0,

        'vcf_cutoff': 0.3 + r() * 0.6,
        'vcf_resonance': r() * 0.7,
        'vcf_env_depth': 0.3 + r() * 0.5,
        'vcf_env_vel': r() * 0.5,
        'vcf_pitch_bend': r() * 0.5,
        'vcf_lfo_depth': r() * 0.4,
        'vcf_lfo_select': r() > 0.5 ? 1.0 : 0.0,
        'vcf_aftertouch_lfo': r() * 0.3,
        'vcf_modwheel_lfo': r() * 0.3,
        'vcf_key_tracking': r() * 0.6,
        'vcf_pole_mode': r() > 0.5 ? 1.0 : 0.0,
        'vcf_env_polarity': 1.0,

        // VCA
        'vca_level': 0.7 + r() * 0.3,
        'vca_mode': r() > 0.8 ? 1.0 : 0.0,
        'vca_env_depth': 1.0,
        'vca_vel_sens': r() * 0.4,
        'vca_pan_spread': 0.0,

        // ENV 1 (VCA)
        'env1_attack': r() * 0.15,
        'env1_decay': 0.1 + r() * 0.5,
        'env1_sustain': 0.5 + r() * 0.5,
        'env1_release': 0.1 + r() * 0.6,
        'env1_trigger_mode': 0.0,
        'env1_attack_curve': 0.5,
        'env1_decay_curve': 0.5,
        'env1_sustain_curve': 0.5,
        'env1_release_curve': 0.5,

        // ENV 2 (VCF)
        'env2_attack': r() * 0.4,
        'env2_decay': 0.1 + r() * 0.7,
        'env2_sustain': r() * 0.8,
        'env2_release': 0.1 + r() * 0.8,
        'env2_trigger_mode': 0.0,
        'env2_attack_curve': 0.5,
        'env2_decay_curve': 0.5,
        'env2_sustain_curve': 0.5,
        'env2_release_curve': 0.5,

        // ENV 3 (MOD)
        'env3_attack': r(),
        'env3_decay': r(),
        'env3_sustain': r(),
        'env3_release': r(),
        'env3_trigger_mode': 0.0,
        'env3_attack_curve': 0.5,
        'env3_decay_curve': 0.5,
        'env3_sustain_curve': 0.5,
        'env3_release_curve': 0.5,

        // LFOs
        'lfo1_rate': r() * 0.6,
        'lfo1_delay': r() * 0.4,
        'lfo1_shape': Math.floor(r() * 7) / 6.0,
        'lfo1_key_sync': r() > 0.2 ? 1.0 : 0.0,
        'lfo1_arp_sync': r() > 0.7 ? 1.0 : 0.0,
        'lfo1_mono_mode': r() > 0.6 ? 1.0 : 0.0,
        'lfo1_slew': r() * 0.3,
        'lfo2_rate': r() * 0.6,
        'lfo2_delay': r() * 0.4,
        'lfo2_shape': Math.floor(r() * 7) / 6.0,
        'lfo2_key_sync': r() > 0.2 ? 1.0 : 0.0,
        'lfo2_arp_sync': r() > 0.7 ? 1.0 : 0.0,
        'lfo2_mono_mode': r() > 0.6 ? 1.0 : 0.0,
        'lfo2_slew': r() * 0.3,

        // Voice / Unison
        'note_priority': 1.0,
        'voice_mode': 0.0,
        'trigger_mode': 0.0,
        'unison_detune': r() * 0.5,
        'voice_drift': r() * 0.3,
        'param_drift': r() * 0.3,
        'drift_rate': 0.5,
        'porta_osc_bal': 0.5,
        'osc_key_reset': 0.0,
        'osc_drift': r() * 0.3,

        // Arp / Seq / Chord
        'arp_rate': 0.3 + r() * 0.4,
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
        'mod_matrix_slot1_src': r() > 0.3 ? Math.floor(r() * 22) / 22.0 : 0.0,
        'mod_matrix_slot1_dest': Math.floor(r() * 130) / 129.0,
        'mod_matrix_slot1_depth': r() > 0.3 ? r() : 0.5,
        'mod_matrix_slot2_src': r() > 0.3 ? Math.floor(r() * 22) / 22.0 : 0.0,
        'mod_matrix_slot2_dest': Math.floor(r() * 130) / 129.0,
        'mod_matrix_slot2_depth': r() > 0.3 ? r() : 0.5,
        'mod_matrix_slot3_src': r() > 0.3 ? Math.floor(r() * 22) / 22.0 : 0.0,
        'mod_matrix_slot3_dest': Math.floor(r() * 130) / 129.0,
        'mod_matrix_slot3_depth': r() > 0.3 ? r() : 0.5,
        'mod_matrix_slot4_src': r() > 0.3 ? Math.floor(r() * 22) / 22.0 : 0.0,
        'mod_matrix_slot4_dest': Math.floor(r() * 130) / 129.0,
        'mod_matrix_slot4_depth': r() > 0.3 ? r() : 0.5,
        'mod_matrix_slot5_src': r() > 0.3 ? Math.floor(r() * 22) / 22.0 : 0.0,
        'mod_matrix_slot5_dest': Math.floor(r() * 130) / 129.0,
        'mod_matrix_slot5_depth': r() > 0.3 ? r() : 0.5,
        'mod_matrix_slot6_src': r() > 0.3 ? Math.floor(r() * 22) / 22.0 : 0.0,
        'mod_matrix_slot6_dest': Math.floor(r() * 130) / 129.0,
        'mod_matrix_slot6_depth': r() > 0.3 ? r() : 0.5,
        'mod_matrix_slot7_src': r() > 0.3 ? Math.floor(r() * 22) / 22.0 : 0.0,
        'mod_matrix_slot7_dest': Math.floor(r() * 130) / 129.0,
        'mod_matrix_slot7_depth': r() > 0.3 ? r() : 0.5,
        'mod_matrix_slot8_src': r() > 0.3 ? Math.floor(r() * 22) / 22.0 : 0.0,
        'mod_matrix_slot8_dest': Math.floor(r() * 130) / 129.0,
        'mod_matrix_slot8_depth': r() > 0.3 ? r() : 0.5,

        // FX Global
        'fx_routing': Math.floor(r() * 6) / 5.0,
        'fx_mode': Math.floor(r() * 3) / 2.0,
        'fx1_type': r() > 0.2 ? Math.floor(r() * 34) / 34.0 : 0.0,
        'fx1_gain': 0.5 + r() * 0.5,
        'fx1_param1': r(),
        'fx1_param2': r(),
        'fx1_param3': r(),
        'fx2_type': r() > 0.2 ? Math.floor(r() * 34) / 34.0 : 0.0,
        'fx2_gain': 0.5 + r() * 0.5,
        'fx2_param1': r(),
        'fx2_param2': r(),
        'fx3_type': r() > 0.2 ? Math.floor(r() * 34) / 34.0 : 0.0,
        'fx3_gain': 0.5 + r() * 0.5,
        'fx3_param1': r(),
        'fx4_type': r() > 0.2 ? Math.floor(r() * 34) / 34.0 : 0.0,
        'fx4_gain': 0.5 + r() * 0.5,
    };
}

// =============================================================================
// Category helpers for structure tests
// =============================================================================

const CATEGORIES = {
    'OSC 1': [
        'osc1_saw_enable', 'osc1_square_enable', 'osc1_pwm_amount', 'osc1_pitch_mod',
        'osc1_range', 'osc1_pm_source', 'osc1_pwm_source', 'osc1_pm_mode',
        'osc1_lfo_aftertouch', 'osc1_lfo_modwheel',
    ],
    'OSC 2': [
        'osc2_pitch', 'osc2_tone_mod', 'osc2_level', 'osc2_pitch_mod',
        'osc2_range', 'osc2_pm_source', 'osc2_tpm_source',
        'osc2_aftertouch_pitch', 'osc2_modwheel_pitch', 'osc2_pitch_mod_select',
    ],
    'OSC General': ['osc_sync_enable', 'noise_level'],
    'Performance': ['global_portamento', 'porta_mode', 'pitch_bend_up', 'pitch_bend_down'],
    'HPF / VCF': [
        'hpf_cutoff', 'hpf_boost_enable',
        'vcf_cutoff', 'vcf_resonance', 'vcf_env_depth', 'vcf_env_vel',
        'vcf_pitch_bend', 'vcf_lfo_depth', 'vcf_lfo_select',
        'vcf_aftertouch_lfo', 'vcf_modwheel_lfo', 'vcf_key_tracking',
        'vcf_pole_mode', 'vcf_env_polarity',
    ],
    'VCA': ['vca_level', 'vca_mode', 'vca_env_depth', 'vca_vel_sens', 'vca_pan_spread'],
    'ENV 1': ['env1_attack', 'env1_decay', 'env1_sustain', 'env1_release', 'env1_trigger_mode',
              'env1_attack_curve', 'env1_decay_curve', 'env1_sustain_curve', 'env1_release_curve'],
    'ENV 2': ['env2_attack', 'env2_decay', 'env2_sustain', 'env2_release', 'env2_trigger_mode',
              'env2_attack_curve', 'env2_decay_curve', 'env2_sustain_curve', 'env2_release_curve'],
    'ENV 3': ['env3_attack', 'env3_decay', 'env3_sustain', 'env3_release', 'env3_trigger_mode',
              'env3_attack_curve', 'env3_decay_curve', 'env3_sustain_curve', 'env3_release_curve'],
    'LFO 1': ['lfo1_rate', 'lfo1_delay', 'lfo1_shape', 'lfo1_key_sync',
              'lfo1_arp_sync', 'lfo1_mono_mode', 'lfo1_slew'],
    'LFO 2': ['lfo2_rate', 'lfo2_delay', 'lfo2_shape', 'lfo2_key_sync',
              'lfo2_arp_sync', 'lfo2_mono_mode', 'lfo2_slew'],
    'Voice / Unison': ['note_priority', 'voice_mode', 'trigger_mode', 'unison_detune',
                       'voice_drift', 'param_drift', 'drift_rate', 'porta_osc_bal',
                       'osc_key_reset', 'osc_drift'],
    'Arp / Seq / Chord': ['arp_rate', 'arp_gate', 'arp_enable', 'arp_hold', 'arp_key_sync',
                          'arp_clock_divider', 'arp_mode', 'arp_swing', 'arp_octave', 'arp_pattern',
                          'seq_enable', 'seq_clock', 'seq_length', 'seq_swing', 'seq_key_loop',
                          'seq_slew_rate', 'chord_enable', 'poly_chord_enable'],
    'Mod Matrix': [
        'mod_matrix_slot1_src', 'mod_matrix_slot1_dest', 'mod_matrix_slot1_depth',
        'mod_matrix_slot2_src', 'mod_matrix_slot2_dest', 'mod_matrix_slot2_depth',
        'mod_matrix_slot3_src', 'mod_matrix_slot3_dest', 'mod_matrix_slot3_depth',
        'mod_matrix_slot4_src', 'mod_matrix_slot4_dest', 'mod_matrix_slot4_depth',
        'mod_matrix_slot5_src', 'mod_matrix_slot5_dest', 'mod_matrix_slot5_depth',
        'mod_matrix_slot6_src', 'mod_matrix_slot6_dest', 'mod_matrix_slot6_depth',
        'mod_matrix_slot7_src', 'mod_matrix_slot7_dest', 'mod_matrix_slot7_depth',
        'mod_matrix_slot8_src', 'mod_matrix_slot8_dest', 'mod_matrix_slot8_depth',
    ],
    'FX': [
        'fx_routing', 'fx_mode',
        'fx1_type', 'fx1_gain', 'fx1_param1', 'fx1_param2', 'fx1_param3',
        'fx2_type', 'fx2_gain', 'fx2_param1', 'fx2_param2',
        'fx3_type', 'fx3_gain', 'fx3_param1',
        'fx4_type', 'fx4_gain',
    ],
};

/** Total parameter count */
const TOTAL_PARAM_COUNT = Object.values(CATEGORIES).reduce(function(sum, arr) { return sum + arr.length; }, 0);

/** Flattened list of all expected param IDs */
const ALL_EXPECTED_KEYS = Object.values(CATEGORIES).flat();

// =============================================================================
// Tests
// =============================================================================

describe('generateMusicalRanges — structure', function() {
    const result = generateMusicalRanges(function() { return 0.5; });

    it('returns an object', function() {
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
    });

    it('contains all expected parameter keys', function() {
        const keys = Object.keys(result).sort();
        const expected = ALL_EXPECTED_KEYS.slice().sort();
        expect(keys).toEqual(expected);
    });

    it('has the expected total parameter count', function() {
        expect(Object.keys(result).length).toBe(TOTAL_PARAM_COUNT);
    });

    it('all parameter values are finite numbers', function() {
        for (const key in result) {
            if (result.hasOwnProperty(key)) {
                expect(typeof result[key]).toBe('number', key + ' is not a number');
                expect(Number.isFinite(result[key])).toBe(true, key + ' is not finite');
            }
        }
    });
});

describe('generateMusicalRanges — category param presence', function() {
    const result = generateMusicalRanges(function() { return 0.5; });

    for (const catName in CATEGORIES) {
        if (CATEGORIES.hasOwnProperty(catName)) {
            (function(category, ids) {
                it('has ' + ids.length + ' params in ' + category, function() {
                    for (let i = 0; i < ids.length; i++) {
                        expect(result).toHaveProperty(ids[i]);
                    }
                });
            })(catName, CATEGORIES[catName]);
        }
    }
});

describe('generateMusicalRanges — deterministic with seeded RNG', function() {
    it('produces identical results for same RNG function', function() {
        const rng = function() { return 0.5; };
        const result1 = generateMusicalRanges(rng);
        const result2 = generateMusicalRanges(rng);
        expect(result1).toEqual(result2);
    });

    it('produces different results for different RNG functions', function() {
        const resultA = generateMusicalRanges(function() { return 0.1; });
        const resultB = generateMusicalRanges(function() { return 0.9; });
        // osc1_saw_enable uses r() for threshold: 0.1 > 0.3 false, 0.9 > 0.3 true
        expect(resultA['osc1_saw_enable']).not.toBe(resultB['osc1_saw_enable']);
    });

    it('defaults to Math.random when no RNG provided', function() {
        const result = generateMusicalRanges();
        expect(typeof result).toBe('object');
        expect(Object.keys(result).length).toBeGreaterThan(0);
    });
});

describe('generateMusicalRanges — constant values (no random variation)', function() {
    const result = generateMusicalRanges(function() { return 0.0; });

    it('pitch_bend_up and pitch_bend_down are always 0.5', function() {
        expect(result['pitch_bend_up']).toBe(0.5);
        expect(result['pitch_bend_down']).toBe(0.5);
    });

    it('vcf_env_polarity is always 1.0', function() {
        expect(result['vcf_env_polarity']).toBe(1.0);
    });

    it('vca_env_depth is always 1.0', function() {
        expect(result['vca_env_depth']).toBe(1.0);
    });

    it('vca_pan_spread is always 0.0', function() {
        expect(result['vca_pan_spread']).toBe(0.0);
    });

    it('all env trigger modes are always 0.0', function() {
        expect(result['env1_trigger_mode']).toBe(0.0);
        expect(result['env2_trigger_mode']).toBe(0.0);
        expect(result['env3_trigger_mode']).toBe(0.0);
    });

    it('all env curve params are always 0.5', function() {
        const curveParams = [
            'env1_attack_curve', 'env1_decay_curve', 'env1_sustain_curve', 'env1_release_curve',
            'env2_attack_curve', 'env2_decay_curve', 'env2_sustain_curve', 'env2_release_curve',
            'env3_attack_curve', 'env3_decay_curve', 'env3_sustain_curve', 'env3_release_curve',
        ];
        for (let i = 0; i < curveParams.length; i++) {
            expect(result[curveParams[i]]).toBe(0.5);
        }
    });

    it('arp/seq/chord enable and related are always 0.0', function() {
        const disabledParams = [
            'arp_enable', 'arp_hold', 'arp_clock_divider', 'arp_mode',
            'arp_swing', 'arp_octave', 'arp_pattern',
            'seq_enable', 'seq_clock', 'seq_length', 'seq_swing',
            'seq_key_loop', 'seq_slew_rate', 'chord_enable', 'poly_chord_enable',
        ];
        for (let i = 0; i < disabledParams.length; i++) {
            expect(result[disabledParams[i]]).toBe(0.0);
        }
    });

    it('arp_gate is always 0.5', function() {
        expect(result['arp_gate']).toBe(0.5);
    });

    it('arp_key_sync is always 1.0', function() {
        expect(result['arp_key_sync']).toBe(1.0);
    });

    it('voice constants are correct', function() {
        expect(result['note_priority']).toBe(1.0);
        expect(result['voice_mode']).toBe(0.0);
        expect(result['trigger_mode']).toBe(0.0);
        expect(result['drift_rate']).toBe(0.5);
        expect(result['porta_osc_bal']).toBe(0.5);
        expect(result['osc_key_reset']).toBe(0.0);
    });
});

describe('generateMusicalRanges — value ranges with minimum RNG (returns 0.0)', function() {
    const result = generateMusicalRanges(function() { return 0.0; });

    it('OSC params at minimum', function() {
        expect(result['osc1_saw_enable']).toBe(0.0);  // 0 > 0.3 false
        expect(result['osc1_square_enable']).toBe(0.0); // 0 > 0.5 false
        expect(result['osc1_pwm_amount']).toBeCloseTo(0.2, 5);
        expect(result['osc1_pitch_mod']).toBe(0.0);
        expect(result['osc1_range']).toBe(0.0);  // floor(0)/2 = 0
        expect(result['osc1_pm_source']).toBe(0.0); // 0 > 0.4 false
        expect(result['osc1_pwm_source']).toBe(0.0); // 0 > 0.5 false
        expect(result['osc1_pm_mode']).toBe(0.0); // 0 > 0.3 false
        expect(result['osc1_lfo_aftertouch']).toBe(0.0);
        expect(result['osc1_lfo_modwheel']).toBe(0.0);

        expect(result['osc2_pitch']).toBeCloseTo(0.3, 5);
        expect(result['osc2_tone_mod']).toBe(0.0);
        expect(result['osc2_level']).toBeCloseTo(0.2, 5);
        expect(result['osc2_pitch_mod']).toBe(0.0);
        expect(result['osc2_range']).toBe(0.0);
        expect(result['osc2_pm_source']).toBe(0.0);
        expect(result['osc2_tpm_source']).toBe(0.0);
        expect(result['osc2_aftertouch_pitch']).toBe(0.0);
        expect(result['osc2_modwheel_pitch']).toBe(0.0);
        expect(result['osc2_pitch_mod_select']).toBe(0.0); // floor(0)/6 = 0

        expect(result['osc_sync_enable']).toBe(0.0); // 0 > 0.8 false
        expect(result['noise_level']).toBe(0.0);
    });

    it('Performance params at minimum', function() {
        expect(result['global_portamento']).toBe(0.0);
        expect(result['porta_mode']).toBe(0.0);
    });

    it('HPF/VCF params at minimum', function() {
        expect(result['hpf_cutoff']).toBe(0.0);
        expect(result['hpf_boost_enable']).toBe(0.0); // 0 > 0.7 false
        expect(result['vcf_cutoff']).toBeCloseTo(0.3, 5);
        expect(result['vcf_resonance']).toBe(0.0);
        expect(result['vcf_env_depth']).toBeCloseTo(0.3, 5);
        expect(result['vcf_env_vel']).toBe(0.0);
        expect(result['vcf_pitch_bend']).toBe(0.0);
        expect(result['vcf_lfo_depth']).toBe(0.0);
        expect(result['vcf_lfo_select']).toBe(0.0); // 0 > 0.5 false
        expect(result['vcf_aftertouch_lfo']).toBe(0.0);
        expect(result['vcf_modwheel_lfo']).toBe(0.0);
        expect(result['vcf_key_tracking']).toBe(0.0);
        expect(result['vcf_pole_mode']).toBe(0.0); // 0 > 0.5 false
    });

    it('VCA params at minimum', function() {
        expect(result['vca_level']).toBeCloseTo(0.7, 5);
        expect(result['vca_mode']).toBe(0.0); // 0 > 0.8 false
        expect(result['vca_vel_sens']).toBe(0.0);
    });

    it('ENV params at minimum', function() {
        expect(result['env1_attack']).toBe(0.0);
        expect(result['env1_decay']).toBeCloseTo(0.1, 5);
        expect(result['env1_sustain']).toBeCloseTo(0.5, 5);
        expect(result['env1_release']).toBeCloseTo(0.1, 5);

        expect(result['env2_attack']).toBe(0.0);
        expect(result['env2_decay']).toBeCloseTo(0.1, 5);
        expect(result['env2_sustain']).toBe(0.0);
        expect(result['env2_release']).toBeCloseTo(0.1, 5);

        expect(result['env3_attack']).toBe(0.0);
        expect(result['env3_decay']).toBe(0.0);
        expect(result['env3_sustain']).toBe(0.0);
        expect(result['env3_release']).toBe(0.0);
    });

    it('LFO params at minimum', function() {
        expect(result['lfo1_rate']).toBe(0.0);
        expect(result['lfo1_delay']).toBe(0.0);
        expect(result['lfo1_shape']).toBe(0.0); // floor(0)/6 = 0
        expect(result['lfo1_key_sync']).toBe(0.0);  // 0 > 0.2 false → 0.0
        expect(result['lfo1_arp_sync']).toBe(0.0);
        expect(result['lfo1_mono_mode']).toBe(0.0);
        expect(result['lfo1_slew']).toBe(0.0);
        expect(result['lfo2_rate']).toBe(0.0);
        expect(result['lfo2_delay']).toBe(0.0);
        expect(result['lfo2_shape']).toBe(0.0);
        expect(result['lfo2_key_sync']).toBe(0.0);
        expect(result['lfo2_arp_sync']).toBe(0.0);
        expect(result['lfo2_mono_mode']).toBe(0.0);
        expect(result['lfo2_slew']).toBe(0.0);
    });

    it('Voice (random) params at minimum', function() {
        expect(result['unison_detune']).toBe(0.0);
        expect(result['voice_drift']).toBe(0.0);
        expect(result['param_drift']).toBe(0.0);
        expect(result['osc_drift']).toBe(0.0);
    });

    it('Arp rate at minimum', function() {
        expect(result['arp_rate']).toBeCloseTo(0.3, 5);
    });

    it('Mod matrix params at minimum', function() {
        for (let slot = 1; slot <= 8; slot++) {
            expect(result['mod_matrix_slot' + slot + '_src']).toBe(0.0);
            expect(result['mod_matrix_slot' + slot + '_dest']).toBe(0.0);
            expect(result['mod_matrix_slot' + slot + '_depth']).toBe(0.5); // 0 > 0.3 false → 0.5
        }
    });

    it('FX params at minimum', function() {
        expect(result['fx_routing']).toBe(0.0);
        expect(result['fx_mode']).toBe(0.0);
        expect(result['fx1_type']).toBe(0.0); // 0 > 0.2 false
        expect(result['fx1_gain']).toBeCloseTo(0.5, 5);
        expect(result['fx1_param1']).toBe(0.0);
        expect(result['fx1_param2']).toBe(0.0);
        expect(result['fx1_param3']).toBe(0.0);
        expect(result['fx2_type']).toBe(0.0);
        expect(result['fx2_gain']).toBeCloseTo(0.5, 5);
        expect(result['fx2_param1']).toBe(0.0);
        expect(result['fx2_param2']).toBe(0.0);
        expect(result['fx3_type']).toBe(0.0);
        expect(result['fx3_gain']).toBeCloseTo(0.5, 5);
        expect(result['fx3_param1']).toBe(0.0);
        expect(result['fx4_type']).toBe(0.0);
        expect(result['fx4_gain']).toBeCloseTo(0.5, 5);
    });
});

describe('generateMusicalRanges — value ranges with near-max RNG (returns 0.999)', function() {
    // Note: Use 0.999 instead of 1.0 because Math.random() returns [0, 1).
    // With r=1.0, floor(r() * n) = floor(n) = n, which can produce values outside
    // the intended enum range. Near-max (0.999) matches real-world Math.random() behavior.
    const rng = function() { return 0.999; };
    const result = generateMusicalRanges(rng);

    it('OSC params at maximum', function() {
        expect(result['osc1_saw_enable']).toBe(1.0);  // 0.999 > 0.3 true
        expect(result['osc1_square_enable']).toBe(1.0); // 0.999 > 0.5 true
        // Floating-point: 0.2 + 0.999*0.6 ≈ 0.7994, tolerance 0.005
        expect(result['osc1_pwm_amount']).toBeCloseTo(0.8, 2);
        // 0.999*0.3 ≈ 0.2997, tolerance 0.005
        expect(result['osc1_pitch_mod']).toBeCloseTo(0.3, 2);
        expect(result['osc1_range']).toBe(1.0); // floor(0.999*3)/2 = 2/2 = 1.0 (exact)
        expect(result['osc1_pm_source']).toBe(22.0 / 23.0); // 0.999>0.4, floor(0.999*23)/23 = 22/23 (exact)
        expect(result['osc1_pwm_source']).toBe(22.0 / 23.0);
        expect(result['osc1_pm_mode']).toBe(1.0); // 0.999 > 0.3 true (exact)
        expect(result['osc1_lfo_aftertouch']).toBeCloseTo(0.3, 2);
        expect(result['osc1_lfo_modwheel']).toBeCloseTo(0.3, 2);

        expect(result['osc2_pitch']).toBeCloseTo(0.7, 2); // 0.3 + 0.999*0.4 ≈ 0.6996
        expect(result['osc2_tone_mod']).toBeCloseTo(0.8, 2);
        expect(result['osc2_level']).toBeCloseTo(0.9, 2); // 0.2 + 0.999*0.7 ≈ 0.8993
        expect(result['osc2_pitch_mod']).toBeCloseTo(0.3, 2);
        expect(result['osc2_range']).toBe(1.0);
        expect(result['osc2_pm_source']).toBe(22.0 / 23.0);
        expect(result['osc2_tpm_source']).toBe(22.0 / 23.0);
        expect(result['osc2_aftertouch_pitch']).toBeCloseTo(0.3, 2);
        expect(result['osc2_modwheel_pitch']).toBeCloseTo(0.3, 2);
        expect(result['osc2_pitch_mod_select']).toBe(1.0); // floor(0.999*7)/6 = 6/6 = 1.0 (exact)

        expect(result['osc_sync_enable']).toBe(1.0);  // 0.999 > 0.8 true (exact)
        expect(result['noise_level']).toBeCloseTo(0.2, 2);
    });

    it('HPF/VCF params at maximum', function() {
        expect(result['hpf_cutoff']).toBeCloseTo(0.3, 2);
        expect(result['hpf_boost_enable']).toBe(1.0);
        expect(result['vcf_cutoff']).toBeCloseTo(0.9, 2); // 0.3 + 0.999*0.6 ≈ 0.8994
        expect(result['vcf_resonance']).toBeCloseTo(0.7, 2);
        expect(result['vcf_env_depth']).toBeCloseTo(0.8, 2); // 0.3 + 0.999*0.5 ≈ 0.7995
        expect(result['vcf_env_vel']).toBeCloseTo(0.5, 2);
        expect(result['vcf_pitch_bend']).toBeCloseTo(0.5, 2);
        expect(result['vcf_lfo_depth']).toBeCloseTo(0.4, 2);
        expect(result['vcf_lfo_select']).toBe(1.0);
        expect(result['vcf_aftertouch_lfo']).toBeCloseTo(0.3, 2);
        expect(result['vcf_modwheel_lfo']).toBeCloseTo(0.3, 2);
        expect(result['vcf_key_tracking']).toBeCloseTo(0.6, 2);
        expect(result['vcf_pole_mode']).toBe(1.0);
    });

    it('VCA params at maximum', function() {
        // 0.7 + 0.999*0.3 ≈ 0.9997, not exactly 1.0
        expect(result['vca_level']).toBeCloseTo(1.0, 2);
        expect(result['vca_mode']).toBe(1.0); // 0.999 > 0.8 true (exact)
        expect(result['vca_vel_sens']).toBeCloseTo(0.4, 2);
    });

    it('ENV params at maximum', function() {
        expect(result['env1_attack']).toBeCloseTo(0.15, 2);
        expect(result['env1_decay']).toBeCloseTo(0.6, 2); // 0.1 + 0.999*0.5 ≈ 0.5995
        // 0.5 + 0.999*0.5 ≈ 0.9995, not exactly 1.0
        expect(result['env1_sustain']).toBeCloseTo(1.0, 2);
        expect(result['env1_release']).toBeCloseTo(0.7, 2); // 0.1 + 0.999*0.6 ≈ 0.6994

        expect(result['env2_attack']).toBeCloseTo(0.4, 2);
        expect(result['env2_decay']).toBeCloseTo(0.8, 2); // 0.1 + 0.999*0.7 ≈ 0.7993
        expect(result['env2_sustain']).toBeCloseTo(0.8, 2); // 0.999*0.8 ≈ 0.7992
        expect(result['env2_release']).toBeCloseTo(0.9, 2); // 0.1 + 0.999*0.8 ≈ 0.8992

        expect(result['env3_attack']).toBeCloseTo(1.0, 2);
        expect(result['env3_decay']).toBeCloseTo(1.0, 2);
        expect(result['env3_sustain']).toBeCloseTo(1.0, 2);
        expect(result['env3_release']).toBeCloseTo(1.0, 2);
    });

    it('LFO params at maximum', function() {
        expect(result['lfo1_rate']).toBeCloseTo(0.6, 2);
        expect(result['lfo1_delay']).toBeCloseTo(0.4, 2);
        expect(result['lfo1_shape']).toBe(1.0); // floor(0.999*7)/6 = 6/6 = 1.0 (exact)
        expect(result['lfo1_key_sync']).toBe(1.0);
        expect(result['lfo1_arp_sync']).toBe(1.0);
        expect(result['lfo1_mono_mode']).toBe(1.0);
        expect(result['lfo1_slew']).toBeCloseTo(0.3, 2);
        expect(result['lfo2_rate']).toBeCloseTo(0.6, 2);
        expect(result['lfo2_delay']).toBeCloseTo(0.4, 2);
        expect(result['lfo2_shape']).toBe(1.0);
        expect(result['lfo2_key_sync']).toBe(1.0);
        expect(result['lfo2_arp_sync']).toBe(1.0);
        expect(result['lfo2_mono_mode']).toBe(1.0);
        expect(result['lfo2_slew']).toBeCloseTo(0.3, 2);
    });

    it('Arp rate at maximum', function() {
        expect(result['arp_rate']).toBeCloseTo(0.7, 2); // 0.3 + 0.999*0.4 ≈ 0.6996
    });

    it('Mod matrix params at maximum', function() {
        for (let slot = 1; slot <= 8; slot++) {
            expect(result['mod_matrix_slot' + slot + '_src']).toBe(21.0 / 22.0); // floor(0.999*22)/22 = 21/22
            expect(result['mod_matrix_slot' + slot + '_dest']).toBe(1.0); // floor(0.999*130)/129 = 129/129 = 1.0
            expect(result['mod_matrix_slot' + slot + '_depth']).toBe(0.999); // 0.999 > 0.3 → true → r() = 0.999
        }
    });

    it('FX params at maximum', function() {
        expect(result['fx_routing']).toBe(1.0); // floor(0.999*6)/5 = 5/5 = 1.0 (exact)
        expect(result['fx_mode']).toBe(1.0); // floor(0.999*3)/2 = 2/2 = 1.0 (exact)
        expect(result['fx1_type']).toBe(33.0 / 34.0); // floor(0.999*34)/34 = 33/34 (exact)
        // 0.5 + 0.999*0.5 ≈ 0.9995, not exactly 1.0
        expect(result['fx1_gain']).toBeCloseTo(1.0, 2);
        expect(result['fx1_param1']).toBeCloseTo(1.0, 2);
        expect(result['fx1_param2']).toBeCloseTo(1.0, 2);
        expect(result['fx1_param3']).toBeCloseTo(1.0, 2);
    });
});

describe('generateMusicalRanges — enum quantization', function() {
    // Each test uses a constant RNG function, so every r() call returns the same value.
    // This gives us deterministic results for the mathematical formula.

    it('osc_range is quantized to 3 values (0, 0.5, 1.0)', function() {
        // With r=0: floor(0)/2 = 0
        expect(generateMusicalRanges(function() { return 0.0; })['osc1_range']).toBe(0.0);
        // With r=0.34: floor(1.02)/2 = 1/2 = 0.5  (osc1_range is call #4)
        expect(generateMusicalRanges(function() { return 0.34; })['osc1_range']).toBe(0.5);
        // With r=0.67: floor(2.01)/2 = 2/2 = 1.0
        expect(generateMusicalRanges(function() { return 0.67; })['osc1_range']).toBe(1.0);
    });

    it('lfo_shape is quantized to 7 values (0 to 1.0 in 1/6 steps)', function() {
        // With r=0.0: floor(0)/6 = 0
        expect(generateMusicalRanges(function() { return 0.0; })['lfo1_shape']).toBe(0.0);
        // With r=0.999: floor(6.993)/6 = 6/6 = 1.0
        expect(generateMusicalRanges(function() { return 0.999; })['lfo1_shape']).toBe(1.0);
        // With r=0.14: floor(0.98)/6 = 0/6 = 0 (still first bucket)
        expect(generateMusicalRanges(function() { return 0.14; })['lfo1_shape']).toBe(0.0);
        // With r=0.15: floor(1.05)/6 = 1/6 ≈ 0.1667
        expect(generateMusicalRanges(function() { return 0.15; })['lfo1_shape']).toBe(1.0 / 6.0);
    });

    it('mod matrix dest is quantized to 130 values (0 to 1.0 in 1/129 steps)', function() {
        // r=0 → floor(0)/129 = 0
        expect(generateMusicalRanges(function() { return 0.0; })['mod_matrix_slot1_dest']).toBe(0.0);
        // r=0.999 → floor(129.87)/129 = 129/129 = 1.0
        expect(generateMusicalRanges(function() { return 0.999; })['mod_matrix_slot1_dest']).toBe(1.0);
        // r=0.01 → floor(1.3)/129 = 1/129
        expect(generateMusicalRanges(function() { return 0.01; })['mod_matrix_slot1_dest']).toBe(1.0 / 129.0);
    });

    it('fx_routing is quantized to 6 values (0 to 1.0 in 0.2 steps)', function() {
        // r=0 → floor(0)/5 = 0
        expect(generateMusicalRanges(function() { return 0.0; })['fx_routing']).toBe(0.0);
        // r=0.999 → floor(5.994)/5 = 5/5 = 1.0
        expect(generateMusicalRanges(function() { return 0.999; })['fx_routing']).toBe(1.0);
        // r=0.2 → floor(1.2)/5 = 1/5 = 0.2
        expect(generateMusicalRanges(function() { return 0.2; })['fx_routing']).toBe(0.2);
    });

    it('pm_source (osc1, osc2) & tpm_source are quantized to 23 values (floor(r*23)/23) or 0 if threshold missed', function() {
        // Threshold for osc1_pm_source: 0.4
        // With r=0.5: 0.5 > 0.4 → true, floor(0.5*23)/23 = 11/23
        expect(generateMusicalRanges(function() { return 0.5; })['osc1_pm_source']).toBe(11.0 / 23.0);
        // With r=0.999: floor(0.999*23)/23 = 22/23
        expect(generateMusicalRanges(function() { return 0.999; })['osc1_pm_source']).toBe(22.0 / 23.0);
        // With r=0.0: 0 > 0.4 false → 0.0
        expect(generateMusicalRanges(function() { return 0.0; })['osc1_pm_source']).toBe(0.0);
        // Same for osc2_tpm_source (threshold 0.4)
        expect(generateMusicalRanges(function() { return 0.5; })['osc2_tpm_source']).toBe(11.0 / 23.0);
        expect(generateMusicalRanges(function() { return 0.0; })['osc2_tpm_source']).toBe(0.0);
    });
});

describe('generateMusicalRanges — toggle/boolean probability thresholds', function() {
    it('osc1_saw_enable: 70% ON (threshold > 0.3)', function() {
        expect(generateMusicalRanges(function() { return 0.3; })['osc1_saw_enable']).toBe(0.0); // 0.3 > 0.3? false
        expect(generateMusicalRanges(function() { return 0.300001; })['osc1_saw_enable']).toBe(1.0);
    });

    it('osc_sync_enable: 20% ON (threshold > 0.8)', function() {
        expect(generateMusicalRanges(function() { return 0.8; })['osc_sync_enable']).toBe(0.0);
        expect(generateMusicalRanges(function() { return 0.800001; })['osc_sync_enable']).toBe(1.0);
    });

    it('lfo1_key_sync: 80% ON (threshold > 0.2)', function() {
        expect(generateMusicalRanges(function() { return 0.2; })['lfo1_key_sync']).toBe(0.0);
        expect(generateMusicalRanges(function() { return 0.200001; })['lfo1_key_sync']).toBe(1.0);
    });

    it('vca_mode: 20% ON (threshold > 0.8)', function() {
        expect(generateMusicalRanges(function() { return 0.8; })['vca_mode']).toBe(0.0);
        expect(generateMusicalRanges(function() { return 0.800001; })['vca_mode']).toBe(1.0);
    });

    it('fx1_type: 80% ON (threshold > 0.2)', function() {
        expect(generateMusicalRanges(function() { return 0.2; })['fx1_type']).toBe(0.0); // 0.2 > 0.2? false
        // With r=0.5: 0.5 > 0.2 true, floor(0.5*34)/34 = 17/34 = 0.5
        expect(generateMusicalRanges(function() { return 0.5; })['fx1_type']).toBe(17.0 / 34.0);
        // With r=0.999: floor(0.999*34)/34 = 33/34
        expect(generateMusicalRanges(function() { return 0.999; })['fx1_type']).toBe(33.0 / 34.0);
    });

    it('lfo_shape (no threshold) returns direct quantized value', function() {
        // lfo1_shape has no threshold gate — always evaluates floor(r*7)/6
        expect(generateMusicalRanges(function() { return 0.0; })['lfo1_shape']).toBe(0.0);
        expect(generateMusicalRanges(function() { return 0.999; })['lfo1_shape']).toBe(1.0);
    });

    it('lfo1_mono_mode: 40% ON (threshold > 0.6)', function() {
        expect(generateMusicalRanges(function() { return 0.6; })['lfo1_mono_mode']).toBe(0.0);
        expect(generateMusicalRanges(function() { return 0.600001; })['lfo1_mono_mode']).toBe(1.0);
    });

    it('mod matrix src uses probability gate (threshold > 0.3) then quantization', function() {
        // With r=0.3 (at threshold): 0.3 > 0.3 false → 0.0
        expect(generateMusicalRanges(function() { return 0.3; })['mod_matrix_slot1_src']).toBe(0.0);
        // With r=0.300001: true → floor(0.300001*22)/22 = floor(6.6)/22 = 6/22
        expect(generateMusicalRanges(function() { return 0.300001; })['mod_matrix_slot1_src']).toBe(6.0 / 22.0);
        // With r=0.999: true → floor(0.999*22)/22 = 21/22
        expect(generateMusicalRanges(function() { return 0.999; })['mod_matrix_slot1_src']).toBe(21.0 / 22.0);
    });
});

describe('generateMusicalRanges — RNG call count', function() {
    it('consumes r() for each random expression in order', function() {
        const calls = [];
        const rng = function() {
            calls.push(calls.length);
            return 0.5;
        };
        generateMusicalRanges(rng);
        expect(calls.length).toBeGreaterThan(50);
        expect(calls[0]).toBe(0);
        expect(calls[1]).toBe(1);
    });
});

describe('generateMusicalRanges — multiple calls produce independent results', function() {
    it('generates different values on successive calls with different RNG', function() {
        const call1 = generateMusicalRanges(function() { return 0.1; });
        const call2 = generateMusicalRanges(function() { return 0.9; });
        // 0.1 > 0.3 false, 0.9 > 0.3 true
        expect(call1['osc1_saw_enable']).toBe(0.0);
        expect(call2['osc1_saw_enable']).toBe(1.0);
    });
});

describe('generateMusicalRanges — edge RNG boundary values', function() {
    it('handles r() returning 0 (minimum)', function() {
        const result = generateMusicalRanges(function() { return 0.0; });
        for (const key in result) {
            if (result.hasOwnProperty(key)) {
                expect(result[key]).toBeGreaterThanOrEqual(0.0, key + ' below 0');
            }
        }
    });

    it('handles r() returning near maximum (0.999)', function() {
        const result = generateMusicalRanges(function() { return 0.999; });
        // All values should be within valid normalized range [0, 1]
        for (const key in result) {
            if (result.hasOwnProperty(key)) {
                expect(result[key]).toBeGreaterThanOrEqual(0.0, key + ' below 0');
                expect(result[key]).toBeLessThanOrEqual(1.0, key + ' above 1 (got ' + result[key] + ')');
            }
        }
    });

    it('all enum-floored values stay within [0, 1] for practical RNG [0, 1)', function() {
        // Math.random() returns [0, 1). With r=0.999, floor(r * n) = n-1, giving (n-1)/(n-1) = 1.0.
        // Only r=1.0 exactly would give floor(n) = n, producing n/n = 1.0 for some formulas
        // or n/(n-1) > 1.0 for others (e.g., floor(1*3)/2 = 3/2 = 1.5).
        // This test verifies that with realistic r() range [0, 1), all values are [0, 1].
        const rng = function() { return 0.999; };
        const result = generateMusicalRanges(rng);
        for (const key in result) {
            if (result.hasOwnProperty(key)) {
                expect(result[key]).toBeGreaterThanOrEqual(0.0);
                expect(result[key]).toBeLessThanOrEqual(1.0, key + '=' + result[key] + ' exceeds 1.0');
            }
        }
    });
});
