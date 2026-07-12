/**
 * Tests for WebUI/js/edit_cache_mapper.js — Cache-to-byte mapping with scaling and bipolar conversion
 *
 * Strategy: extracted mapping function with DI. Tests cover:
 * - set() helper (clamp, round, NaN guard)
 * - Unipolar scaling (param * 255, param * 22, etc.)
 * - Bipolar conversion ((val*2-1)*127 + 128)
 * - All parameter groups: LFO, OSC, VCF, ENV, VCA, FX, ARP, SEQ, MOD MATRIX
 */

// ===== Global stubs =====
globalThis.window = globalThis.window || {};

// ===== Extracted Source =====

function updateUnpackedBytesFromCache(unpackedBytes, cache) {
    if (!cache) return;

    var set = function(idx, val) {
        if (val !== undefined && val !== null && !isNaN(val)) {
            unpackedBytes[idx] = Math.round(Math.max(0, Math.min(255, val)));
        }
    };

    // LFO 1 (bytes 0-6)
    set(0, cache["lfo1_rate"] * 255);
    set(1, cache["lfo1_delay"] * 255);
    set(2, cache["lfo1_shape"] * 255);
    set(3, cache["lfo1_key_sync"] * 255);
    set(4, cache["lfo1_arp_sync"] * 255);
    set(5, cache["lfo1_mono_mode"] * 255);
    set(6, cache["lfo1_slew"] * 255);

    // LFO 2 (bytes 7-13)
    set(7, cache["lfo2_rate"] * 255);
    set(8, cache["lfo2_delay"] * 255);
    set(9, cache["lfo2_shape"] * 255);
    set(10, cache["lfo2_key_sync"] * 255);
    set(11, cache["lfo2_arp_sync"] * 255);
    set(12, cache["lfo2_mono_mode"] * 255);
    set(13, cache["lfo2_slew"] * 255);

    // OSC 1 (bytes 14-25) — note byte 15 is OSC2
    set(14, cache["osc1_range"] * 2);
    set(16, cache["osc1_pwm_source"] * 23);
    set(18, cache["osc1_square_enable"] * 255);
    set(19, cache["osc1_saw_enable"] * 255);
    set(20, cache["osc_sync_enable"] * 255);
    set(21, cache["osc1_pitch_mod"] * 255);
    set(22, cache["osc1_pm_source"] * 23);
    set(23, cache["osc1_lfo_aftertouch"] * 255);
    set(24, cache["osc1_lfo_modwheel"] * 255);
    set(25, cache["osc1_pwm_amount"] * 255);

    // OSC 2 (bytes 15, 26-32)
    set(15, cache["osc2_range"] * 2);
    set(26, cache["osc2_level"] * 255);
    set(27, cache["osc2_pitch"] * 255);
    set(28, cache["osc2_tone_mod"] * 255);
    set(29, cache["osc2_pitch_mod"] * 255);
    set(30, cache["osc2_aftertouch_pitch"] * 255);
    set(31, cache["osc2_modwheel_pitch"] * 255);

    // Global / Noise / Portamento
    set(33, cache["noise_level"] * 255);
    set(34, cache["global_portamento"] * 255);
    set(35, cache["porta_mode"] * 13);
    set(36, cache["pitch_bend_up"] * 255);
    set(37, cache["pitch_bend_down"] * 255);
    set(38, cache["osc1_pm_mode"] * 1);

    // VCF (bytes 39-52)
    set(39, cache["vcf_cutoff"] * 255);
    set(40, cache["hpf_cutoff"] * 255);
    set(41, cache["vcf_resonance"] * 255);
    if (cache["vcf_env_depth"] !== undefined) {
        set(42, ((cache["vcf_env_depth"] * 2 - 1) * 127) + 128);
    }
    set(43, cache["vcf_env_vel"] * 255);
    set(44, cache["vcf_pitch_bend"] * 255);
    set(45, cache["vcf_lfo_depth"] * 255);
    set(46, cache["vcf_lfo_select"] * 255);
    set(47, cache["vcf_aftertouch_lfo"] * 255);
    set(48, cache["vcf_modwheel_lfo"] * 255);
    set(49, cache["vcf_key_tracking"] * 255);
    set(50, cache["vcf_env_polarity"] * 255);
    set(51, cache["vcf_pole_mode"] * 255);
    set(52, cache["hpf_boost_enable"] * 255);

    // ENV 1-3 (bytes 53-79)
    for (var e = 1; e <= 3; e++) {
        var base = e === 1 ? 53 : (e === 2 ? 62 : 71);
        set(base,     cache["env" + e + "_attack"] * 255);
        set(base + 1, cache["env" + e + "_decay"] * 255);
        set(base + 2, cache["env" + e + "_sustain"] * 255);
        set(base + 3, cache["env" + e + "_release"] * 255);
        set(base + 4, cache["env" + e + "_trigger_mode"] * 4);
        set(base + 5, cache["env" + e + "_attack_curve"] * 255);
        set(base + 6, cache["env" + e + "_decay_curve"] * 255);
        set(base + 7, cache["env" + e + "_sustain_curve"] * 255);
        set(base + 8, cache["env" + e + "_release_curve"] * 255);
    }

    // VCA (bytes 80-83)
    set(80, cache["vca_level"] * 255);
    set(81, cache["vca_env_depth"] * 255);
    set(82, cache["vca_vel_sens"] * 255);
    set(83, cache["vca_pan_spread"] * 255);

    // Voice / Performance (bytes 84-92)
    set(84, cache["note_priority"] * 2);
    set(85, cache["voice_mode"] * 12);
    set(86, cache["trigger_mode"] * 3);
    set(87, cache["unison_detune"] * 255);
    set(88, cache["voice_drift"] * 255);
    set(89, cache["param_drift"] * 255);
    set(90, cache["drift_rate"] * 255);
    if (cache["porta_osc_bal"] !== undefined) {
        set(91, ((cache["porta_osc_bal"] * 2 - 1) * 127) + 128);
    }
    set(92, cache["osc_key_reset"] * 255);

    // ARP (bytes 155-164)
    set(155, cache["arp_enable"] * 255);
    set(156, cache["arp_mode"] * 10);
    set(157, cache["arp_rate"] * 255);
    set(158, cache["arp_clock_divider"] * 12);
    set(159, cache["arp_key_sync"] * 255);
    set(160, cache["arp_gate_time"] * 255);
    set(161, cache["arp_hold"] * 255);
    set(162, cache["arp_pattern"] * 64);
    set(163, cache["arp_swing"] * 25);
    set(164, cache["arp_octave"] * 3);

    // SEQ (bytes 117-122)
    set(117, cache["seq_enable"] * 255);
    set(118, cache["seq_clock"] * 15);
    set(119, cache["seq_length"] * 31);
    set(120, cache["seq_swing"] * 25);
    set(121, cache["seq_key_loop"] * 2);
    set(122, cache["seq_slew_rate"] * 255);

    // Chord (bytes 105-108)
    set(105, cache["chord_enable"] * 255);
    set(106, cache["poly_chord_enable"] * 255);
    set(107, cache["chord_key"] * 11);
    set(108, cache["chord_type"] * 11);

    // FX Routing (bytes 165, 222)
    set(165, cache["fx_routing"] * 9);
    set(222, cache["fx_mode"] * 2);

    // FX Slots 1-4 (type + 12 params + gain)
    for (var f = 1; f <= 4; f++) {
        var typeBase = f === 1 ? 166 : (f === 2 ? 179 : (f === 3 ? 192 : 205));
        var gainIdx = f === 1 ? 218 : (f === 2 ? 219 : (f === 3 ? 220 : 221));
        set(typeBase, cache["fx" + f + "_type"] * 35);
        for (var p = 1; p <= 12; p++) {
            set(typeBase + p, cache["fx" + f + "_param" + p] * 255);
        }
        set(gainIdx, cache["fx" + f + "_gain"] * 255);
    }

    // MOD MATRIX Slots 1-8
    for (var s = 1; s <= 8; s++) {
        var srcIdx = 93 + (s - 1) * 3;
        var destIdx = 94 + (s - 1) * 3;
        var depthIdx = 95 + (s - 1) * 3;
        set(srcIdx, cache["mod_matrix_slot" + s + "_src"] * 22);
        set(destIdx, cache["mod_matrix_slot" + s + "_dest"] * 129);
        if (cache["mod_matrix_slot" + s + "_depth"] !== undefined) {
            set(depthIdx, ((cache["mod_matrix_slot" + s + "_depth"] * 2 - 1) * 127) + 128);
        }
    }
}

// ===== Tests =====

describe('set() helper — clamping and guards', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('sets a normal value', function() {
        updateUnpackedBytesFromCache(bytes, { "lfo1_rate": 0.5 });
        expect(bytes[0]).toBe(128); // 0.5 * 255 = 127.5 → round to 128
    });

    it('clamps values below 0 to 0', function() {
        updateUnpackedBytesFromCache(bytes, { "lfo1_rate": -0.1 });
        expect(bytes[0]).toBe(0);
    });

    it('clamps values above 255 to 255', function() {
        updateUnpackedBytesFromCache(bytes, { "lfo1_rate": 2.0 });
        expect(bytes[0]).toBe(255);
    });

    it('rounds to nearest integer', function() {
        updateUnpackedBytesFromCache(bytes, { "lfo1_delay": 0.333 });
        expect(bytes[1]).toBe(85); // 0.333 * 255 = 84.915 → round to 85
    });

    it('skips undefined values (byte unchanged)', function() {
        bytes[0] = 42;
        updateUnpackedBytesFromCache(bytes, {}); // no lfo1_rate
        expect(bytes[0]).toBe(42);
    });

    it('writes 0 for null values (null * 255 = 0)', function() {
        bytes[0] = 99;
        updateUnpackedBytesFromCache(bytes, { "lfo1_rate": null });
        // null * 255 = 0 in JS, so set(0, 0) writes 0
        expect(bytes[0]).toBe(0);
    });

    it('skips NaN values', function() {
        bytes[0] = 77;
        updateUnpackedBytesFromCache(bytes, { "lfo1_rate": NaN });
        expect(bytes[0]).toBe(77);
    });
});

describe('LFO bytes (0-13)', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('maps lfo1_rate to byte 0', function() {
        updateUnpackedBytesFromCache(bytes, { "lfo1_rate": 1.0 });
        expect(bytes[0]).toBe(255);
    });

    it('maps lfo1_shape to byte 2', function() {
        updateUnpackedBytesFromCache(bytes, { "lfo1_shape": 0.5 });
        expect(bytes[2]).toBe(128);
    });

    it('maps lfo2_rate to byte 7', function() {
        updateUnpackedBytesFromCache(bytes, { "lfo2_rate": 0.5 });
        expect(bytes[7]).toBe(128);
    });

    it('maps lfo2_shape to byte 9', function() {
        updateUnpackedBytesFromCache(bytes, { "lfo2_shape": 0.5 });
        expect(bytes[9]).toBe(128);
    });

    it('LFO1 occupies bytes 0-6 and LFO2 bytes 7-13', function() {
        var cache = {};
        for (var i = 1; i <= 2; i++) {
            cache["lfo" + i + "_rate"] = 0.5;
            cache["lfo" + i + "_delay"] = 0.5;
            cache["lfo" + i + "_shape"] = 0.5;
            cache["lfo" + i + "_key_sync"] = 0.5;
            cache["lfo" + i + "_arp_sync"] = 0.5;
            cache["lfo" + i + "_mono_mode"] = 0.5;
            cache["lfo" + i + "_slew"] = 0.5;
        }
        updateUnpackedBytesFromCache(bytes, cache);
        for (var j = 0; j <= 13; j++) {
            expect(bytes[j]).toBe(128);
        }
    });
});

describe('OSC bytes (14-32)', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('osc1_range * 2 → byte 14', function() {
        updateUnpackedBytesFromCache(bytes, { "osc1_range": 1.0 });
        expect(bytes[14]).toBe(2); // 1.0 * 2 = 2
    });

    it('osc2_range * 2 → byte 15', function() {
        updateUnpackedBytesFromCache(bytes, { "osc2_range": 2.0 });
        expect(bytes[15]).toBe(4); // 2.0 * 2 = 4, but max 255, so 4
    });

    it('osc1_pitch_mod → byte 21', function() {
        updateUnpackedBytesFromCache(bytes, { "osc1_pitch_mod": 0.5 });
        expect(bytes[21]).toBe(128);
    });

    it('osc1_pm_source * 23 → byte 22', function() {
        updateUnpackedBytesFromCache(bytes, { "osc1_pm_source": 0.5 });
        expect(bytes[22]).toBe(12); // 0.5 * 23 = 11.5 → round 12
    });

    it('osc2_level → byte 26', function() {
        updateUnpackedBytesFromCache(bytes, { "osc2_level": 0.5 });
        expect(bytes[26]).toBe(128);
    });

    it('osc2_pitch_mod → byte 29', function() {
        updateUnpackedBytesFromCache(bytes, { "osc2_pitch_mod": 0.8 });
        expect(bytes[29]).toBe(204); // 0.8 * 255 = 204
    });

    it('osc2_pitch → byte 27 (0.5 = center)', function() {
        updateUnpackedBytesFromCache(bytes, { "osc2_pitch": 0.5 });
        expect(bytes[27]).toBe(128);
    });
});

describe('VCF bytes (39-52) — including bipolar conversion', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('vcf_cutoff → byte 39', function() {
        updateUnpackedBytesFromCache(bytes, { "vcf_cutoff": 1.0 });
        expect(bytes[39]).toBe(255);
    });

    it('vcf_resonance → byte 41', function() {
        updateUnpackedBytesFromCache(bytes, { "vcf_resonance": 0.5 });
        expect(bytes[41]).toBe(128);
    });

    it('vcf_env_depth bipolar: 0.0 → -1.0 → -127 + 128 = 1', function() {
        updateUnpackedBytesFromCache(bytes, { "vcf_env_depth": 0.0 });
        // ((0.0 * 2 - 1) * 127) + 128 = (-1 * 127) + 128 = 1
        expect(bytes[42]).toBe(1);
    });

    it('vcf_env_depth bipolar: 0.5 → 0.0 → 0 + 128 = 128', function() {
        updateUnpackedBytesFromCache(bytes, { "vcf_env_depth": 0.5 });
        // ((0.5 * 2 - 1) * 127) + 128 = (0 * 127) + 128 = 128
        expect(bytes[42]).toBe(128);
    });

    it('vcf_env_depth bipolar: 1.0 → 1.0 → 127 + 128 = 255', function() {
        updateUnpackedBytesFromCache(bytes, { "vcf_env_depth": 1.0 });
        // ((1.0 * 2 - 1) * 127) + 128 = (1 * 127) + 128 = 255
        expect(bytes[42]).toBe(255);
    });

    it('skips vcf_env_depth if undefined', function() {
        bytes[42] = 100;
        updateUnpackedBytesFromCache(bytes, { "vcf_cutoff": 0.5 });
        expect(bytes[42]).toBe(100);
    });
});

describe('ENV bytes (53-79) — 3 envelopes × 9 bytes each', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('maps env1_attack → byte 53', function() {
        updateUnpackedBytesFromCache(bytes, { "env1_attack": 0.5 });
        expect(bytes[53]).toBe(128);
    });

    it('maps env1_trigger_mode * 4 → byte 57', function() {
        updateUnpackedBytesFromCache(bytes, { "env1_trigger_mode": 1.0 });
        expect(bytes[57]).toBe(4); // 1.0 * 4 = 4
    });

    it('maps env2_sustain → byte 64 (base 62 + 2)', function() {
        updateUnpackedBytesFromCache(bytes, { "env2_sustain": 0.8 });
        expect(bytes[64]).toBe(204);
    });

    it('maps env3_release → byte 74 (base 71 + 3)', function() {
        updateUnpackedBytesFromCache(bytes, { "env3_release": 0.3 });
        expect(bytes[74]).toBe(77); // 0.3 * 255 = 76.5 → round to 77
    });

    it('env3 trigger mode is clamped to *4', function() {
        updateUnpackedBytesFromCache(bytes, { "env3_trigger_mode": 2.0 });
        expect(bytes[75]).toBe(8); // 2.0 * 4 = 8, clamped to 255 → 8
    });
});

describe('VCA bytes (80-83)', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('maps vca_level → byte 80', function() {
        updateUnpackedBytesFromCache(bytes, { "vca_level": 0.5 });
        expect(bytes[80]).toBe(128);
    });

    it('maps vca_env_depth → byte 81', function() {
        updateUnpackedBytesFromCache(bytes, { "vca_env_depth": 0.8 });
        expect(bytes[81]).toBe(204);
    });

    it('maps vca_pan_spread → byte 83', function() {
        updateUnpackedBytesFromCache(bytes, { "vca_pan_spread": 0.0 });
        expect(bytes[83]).toBe(0);
    });
});

describe('Voice / Performance bytes (84-92) — including bipolar osc_bal', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('note_priority * 2 → byte 84', function() {
        updateUnpackedBytesFromCache(bytes, { "note_priority": 1.0 });
        expect(bytes[84]).toBe(2);
    });

    it('voice_mode * 12 → byte 85', function() {
        updateUnpackedBytesFromCache(bytes, { "voice_mode": 0.5 });
        expect(bytes[85]).toBe(6); // 0.5 * 12 = 6
    });

    it('trigger_mode * 3 → byte 86', function() {
        updateUnpackedBytesFromCache(bytes, { "trigger_mode": 0.333 });
        expect(bytes[86]).toBe(1); // 0.333 * 3 = 0.999 → round 1
    });

    it('porta_osc_bal bipolar: 0.0 → byte 91 = 1', function() {
        updateUnpackedBytesFromCache(bytes, { "porta_osc_bal": 0.0 });
        expect(bytes[91]).toBe(1);
    });

    it('porta_osc_bal bipolar: 1.0 → byte 91 = 255', function() {
        updateUnpackedBytesFromCache(bytes, { "porta_osc_bal": 1.0 });
        expect(bytes[91]).toBe(255);
    });

    it('porta_osc_bal skipped if undefined', function() {
        bytes[91] = 128;
        updateUnpackedBytesFromCache(bytes, { "voice_drift": 0.5 });
        expect(bytes[91]).toBe(128);
    });
});

describe('ARP bytes (155-164)', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('maps arp_enable → byte 155', function() {
        updateUnpackedBytesFromCache(bytes, { "arp_enable": 1.0 });
        expect(bytes[155]).toBe(255);
    });

    it('arp_mode * 10 → byte 156', function() {
        updateUnpackedBytesFromCache(bytes, { "arp_mode": 0.5 });
        expect(bytes[156]).toBe(5); // 0.5 * 10 = 5
    });

    it('arp_swing * 25 → byte 163', function() {
        updateUnpackedBytesFromCache(bytes, { "arp_swing": 0.5 });
        expect(bytes[163]).toBe(13); // 0.5 * 25 = 12.5 → round 13
    });

    it('arp_pattern * 64 → byte 162', function() {
        updateUnpackedBytesFromCache(bytes, { "arp_pattern": 0.5 });
        expect(bytes[162]).toBe(32); // 0.5 * 64 = 32
    });
});

describe('SEQ bytes (117-122)', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('seq_enable → byte 117', function() {
        updateUnpackedBytesFromCache(bytes, { "seq_enable": 1.0 });
        expect(bytes[117]).toBe(255);
    });

    it('seq_clock * 15 → byte 118', function() {
        updateUnpackedBytesFromCache(bytes, { "seq_clock": 0.5 });
        expect(bytes[118]).toBe(8); // 0.5 * 15 = 7.5 → round 8
    });

    it('seq_length * 31 → byte 119', function() {
        updateUnpackedBytesFromCache(bytes, { "seq_length": 1.0 });
        expect(bytes[119]).toBe(31);
    });

    it('seq_key_loop * 2 → byte 121', function() {
        updateUnpackedBytesFromCache(bytes, { "seq_key_loop": 1.0 });
        expect(bytes[121]).toBe(2);
    });
});

describe('FX bytes — all 4 slots (type + 12 params + gain)', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('maps fx1_type * 35 → byte 166', function() {
        updateUnpackedBytesFromCache(bytes, { "fx1_type": 0.5 });
        expect(bytes[166]).toBe(18); // 0.5 * 35 = 17.5 → round 18
    });

    it('maps fx1_gain → byte 218', function() {
        updateUnpackedBytesFromCache(bytes, { "fx1_gain": 0.5 });
        expect(bytes[218]).toBe(128);
    });

    it('maps fx2_type → byte 179, fx2_gain → byte 219', function() {
        updateUnpackedBytesFromCache(bytes, { "fx2_type": 0.5, "fx2_gain": 0.5 });
        expect(bytes[179]).toBe(18);
        expect(bytes[219]).toBe(128);
    });

    it('maps fx3_type → byte 192, fx3_gain → byte 220', function() {
        updateUnpackedBytesFromCache(bytes, { "fx3_type": 0.5, "fx3_gain": 0.5 });
        expect(bytes[192]).toBe(18);
        expect(bytes[220]).toBe(128);
    });

    it('maps fx4_type → byte 205, fx4_gain → byte 221', function() {
        updateUnpackedBytesFromCache(bytes, { "fx4_type": 0.5, "fx4_gain": 0.5 });
        expect(bytes[205]).toBe(18);
        expect(bytes[221]).toBe(128);
    });

    it('maps all 12 params for each FX slot', function() {
        var cache = {};
        for (var f = 1; f <= 4; f++) {
            for (var p = 1; p <= 12; p++) {
                cache["fx" + f + "_param" + p] = p / 12.0;
            }
        }
        updateUnpackedBytesFromCache(bytes, cache);
        // Spot-check: fx1_param12 → byte 178, fx4_param1 → byte 206
        expect(bytes[178]).toBe(255); // 12/12 * 255 = 255
        expect(bytes[206]).toBe(21);  // 1/12 * 255 = 21.25 → round 21
    });
});

describe('MOD MATRIX bytes — 8 slots (src*22, dest*129, depth bipolar)', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('mod_matrix_slot1_src * 22 → byte 93', function() {
        updateUnpackedBytesFromCache(bytes, { "mod_matrix_slot1_src": 0.5 });
        expect(bytes[93]).toBe(11); // 0.5 * 22 = 11
    });

    it('mod_matrix_slot1_dest * 129 → byte 94', function() {
        updateUnpackedBytesFromCache(bytes, { "mod_matrix_slot1_dest": 0.5 });
        expect(bytes[94]).toBe(65); // 0.5 * 129 = 64.5 → round 65
    });

    it('mod_matrix_slot1_depth bipolar: 0.0 → byte 95 = 1', function() {
        updateUnpackedBytesFromCache(bytes, { "mod_matrix_slot1_depth": 0.0 });
        expect(bytes[95]).toBe(1);
    });

    it('mod_matrix_slot1_depth bipolar: 0.5 → byte 95 = 128', function() {
        updateUnpackedBytesFromCache(bytes, { "mod_matrix_slot1_depth": 0.5 });
        expect(bytes[95]).toBe(128);
    });

    it('mod_matrix_slot1_depth bipolar: 1.0 → byte 95 = 255', function() {
        updateUnpackedBytesFromCache(bytes, { "mod_matrix_slot1_depth": 1.0 });
        expect(bytes[95]).toBe(255);
    });

    it('all 8 slots occupy bytes 93-116 with 3-byte stride', function() {
        var cache = {};
        for (var s = 1; s <= 8; s++) {
            cache["mod_matrix_slot" + s + "_src"] = s / 22.0;
            cache["mod_matrix_slot" + s + "_dest"] = s / 129.0;
            cache["mod_matrix_slot" + s + "_depth"] = 0.5;
        }
        updateUnpackedBytesFromCache(bytes, cache);
        for (var i = 0; i < 8; i++) {
            var base = 93 + i * 3;
            expect(bytes[base]).toBe(i + 1);       // src: round(s * 22 / 22) = s
            expect(bytes[base + 1]).toBe(i + 1);   // dest: round(s * 129 / 129) = s
            expect(bytes[base + 2]).toBe(128);     // depth: bipolar 0.5 → 128
        }
    });

    it('skips depth if undefined', function() {
        bytes[95] = 77;
        updateUnpackedBytesFromCache(bytes, { "mod_matrix_slot1_src": 0.5, "mod_matrix_slot1_dest": 0.5 });
        expect(bytes[95]).toBe(77);
    });
});

describe('Chord bytes (105-108)', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('chord_enable → byte 105', function() {
        updateUnpackedBytesFromCache(bytes, { "chord_enable": 1.0 });
        expect(bytes[105]).toBe(255);
    });

    it('chord_key * 11 → byte 107', function() {
        updateUnpackedBytesFromCache(bytes, { "chord_key": 0.5 });
        expect(bytes[107]).toBe(6); // 0.5 * 11 = 5.5 → round 6
    });

    it('chord_type * 11 → byte 108', function() {
        updateUnpackedBytesFromCache(bytes, { "chord_type": 0.5 });
        expect(bytes[108]).toBe(6);
    });
});

describe('FX routing bytes', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('fx_routing * 9 → byte 165', function() {
        updateUnpackedBytesFromCache(bytes, { "fx_routing": 1.0 });
        expect(bytes[165]).toBe(9);
    });

    it('fx_mode * 2 → byte 222', function() {
        updateUnpackedBytesFromCache(bytes, { "fx_mode": 0.5 });
        expect(bytes[222]).toBe(1);
    });
});

describe('edge cases — null/empty cache', function() {
    var bytes;

    beforeEach(function() {
        bytes = new Uint8Array(256);
    });

    it('does nothing when cache is null', function() {
        bytes[0] = 42;
        updateUnpackedBytesFromCache(bytes, null);
        expect(bytes[0]).toBe(42);
    });

    it('does nothing when cache is undefined', function() {
        bytes[0] = 42;
        updateUnpackedBytesFromCache(bytes, undefined);
        expect(bytes[0]).toBe(42);
    });

    it('leaves all bytes at default 0 with empty cache', function() {
        updateUnpackedBytesFromCache(bytes, {});
        for (var i = 0; i < 256; i++) {
            expect(bytes[i]).toBe(0);
        }
    });
});
