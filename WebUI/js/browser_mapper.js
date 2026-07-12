/**
 * @purpose Maps raw SysEx payload bytes to normalized UI parameters, sending staggered updates to the C++ DSP engine.
 * @purpose_en SysEx byte-to-parameter mapper.
 */

function triggerMidiDump(patch) {
    if (window._exitCompareMode && typeof window._exitCompareMode === 'function') {
        window._exitCompareMode();
    }
    console.log("[triggerMidiDump] Cargando preset:", patch.name);
    
    if (window.dualMidiBridge) {
        if (typeof window.dualMidiBridge._resetNrpnCache === 'function') {
            window.dualMidiBridge._resetNrpnCache();
        } else {
            window.dualMidiBridge._lastNrpnMsb = null;
            window.dualMidiBridge._lastNrpnLsb = null;
            window.dualMidiBridge._lastNrpnValue = null;
            window.dualMidiBridge._lastNrpnByte = null;
            window.dualMidiBridge._nrpnInMsb = null;
            window.dualMidiBridge._nrpnInLsb = null;
            window.dualMidiBridge._nrpnInDataMsb = 0;
            window.dualMidiBridge._nrpnInTimestamp = 0;
        }
    }
    
    const lcdText = document.getElementById('lcd-text');
    if (lcdText) lcdText.innerText = patch.name.toUpperCase();

    if (window.dualMidiBridge && window.dualMidiBridge.midiOutput) {
        const packedPayload = window.pack8to7(patch.unpackedBytes);
        const sysexMessage = new Uint8Array(291);
        sysexMessage[0] = 0xF0;
        sysexMessage[1] = 0x00;
        sysexMessage[2] = 0x20;
        sysexMessage[3] = 0x32;
        sysexMessage[4] = 0x20;
        sysexMessage[5] = 0x7F;
        sysexMessage[6] = 0x02;
        sysexMessage[7] = 0x07;
        sysexMessage.set(packedPayload, 8);
        sysexMessage[290] = 0xF7;
        window.dualMidiBridge.midiOutput.send(sysexMessage);
    }

    const b = patch.unpackedBytes;
    
    const norm = (val, min, max) => Math.max(0, Math.min(1, (val - min) / (max - min)));
    const byteToSec = (byteVal) => byteVal === 0 ? 0.0 : (byteVal / 255.0);
    
    const mappings = {
        // LFO 1
        "lfo1_rate": b[0] / 255.0,
        "lfo1_delay": b[1] / 255.0,
        "lfo1_shape": b[2] / 255.0,
        "lfo1_key_sync": b[3] > 0 ? 1.0 : 0.0,
        "lfo1_arp_sync": b[4] > 0 ? 1.0 : 0.0,
        "lfo1_mono_mode": b[5] / 255.0,
        "lfo1_slew": b[6] / 255.0,

        // LFO 2
        "lfo2_rate": b[7] / 255.0,
        "lfo2_delay": b[8] / 255.0,
        "lfo2_shape": b[9] / 255.0,
        "lfo2_key_sync": b[10] > 0 ? 1.0 : 0.0,
        "lfo2_arp_sync": b[11] > 0 ? 1.0 : 0.0,
        "lfo2_mono_mode": b[12] / 255.0,
        "lfo2_slew": b[13] / 255.0,

        // OSC 1
        "osc1_range": norm(b[14], 0, 2),
        "osc1_pwm_source": b[16] ? Math.min(1, b[16] / 23.0) : 0.0,
        "osc2_pm_source": b[17] ? Math.min(1, b[17] / 23.0) : 0.0,
        "osc2_tpm_source": b[17] ? Math.min(1, b[17] / 23.0) : 0.0,
        "osc1_square_enable": b[18] > 0 ? 1.0 : 0.0,
        "osc1_saw_enable": b[19] > 0 ? 1.0 : 0.0,
        "osc_sync_enable": b[20] > 0 ? 1.0 : 0.0,
        "osc1_pitch_mod": b[21] / 255.0,
        "osc1_pm_source": b[22] ? Math.min(1, b[22] / 23.0) : 0.0,
        "osc1_lfo_aftertouch": b[23] / 255.0,
        "osc1_lfo_modwheel": b[24] / 255.0,
        "osc1_pwm_amount": b[25] / 255.0,

        // OSC 2
        "osc2_range": norm(b[15], 0, 2),
        "osc2_level": b[26] / 255.0,
        "osc2_pitch": b[27] / 255.0,
        "osc2_tone_mod": b[28] / 255.0,
        "osc2_pitch_mod": b[29] / 255.0,
        "osc2_aftertouch_pitch": b[30] / 255.0,
        "osc2_modwheel_pitch": b[31] / 255.0,
        "osc2_pitch_mod_select": b[32] ? Math.min(1, b[32] / 6.0) : 0.0,

        "noise_level": b[33] / 255.0,

        // Portamento / Pitch Bend
        "global_portamento": b[34] / 255.0,
        "porta_mode": b[35] ? Math.min(1, b[35] / 13.0) : 0.0,
        "pitch_bend_up": b[36] / 255.0,
        "pitch_bend_down": b[37] / 255.0,
        "osc1_pm_mode": b[38] > 0 ? 1.0 : 0.0,

        // VCF
        "vcf_cutoff": b[39] / 255.0,
        "hpf_cutoff": norm(20.0 + (b[40] / 255.0) * 1980.0, 20.0, 2000.0),
        "vcf_resonance": b[41] / 255.0,
        "vcf_env_depth": norm((b[42] - 128) / 127.0, -1.0, 1.0),
        "vcf_env_vel": b[43] / 255.0,
        "vcf_pitch_bend": b[44] / 255.0,
        "vcf_lfo_depth": b[45] / 255.0,
        "vcf_lfo_select": b[46] > 0 ? 1.0 : 0.0,
        "vcf_aftertouch_lfo": b[47] / 255.0,
        "vcf_modwheel_lfo": b[48] / 255.0,
        "vcf_key_tracking": b[49] / 255.0,
        "vcf_env_polarity": b[50] > 0 ? 1.0 : 0.0,
        "vcf_pole_mode": b[51] > 0 ? 1.0 : 0.0,
        "hpf_boost_enable": b[52] > 0 ? 1.0 : 0.0,

        // ENV 1
        "env1_attack": byteToSec(b[53]),
        "env1_decay": byteToSec(b[54]),
        "env1_sustain": b[55] / 255.0,
        "env1_release": byteToSec(b[56]),
        "env1_trigger_mode": b[57] ? Math.min(1, b[57] / 4.0) : 0.0,
        "env1_attack_curve": b[58] / 255.0,
        "env1_decay_curve": b[59] / 255.0,
        "env1_sustain_curve": b[60] / 255.0,
        "env1_release_curve": b[61] / 255.0,

        // ENV 2
        "env2_attack": byteToSec(b[62]),
        "env2_decay": byteToSec(b[63]),
        "env2_sustain": b[64] / 255.0,
        "env2_release": byteToSec(b[65]),
        "env2_trigger_mode": b[66] ? Math.min(1, b[66] / 4.0) : 0.0,
        "env2_attack_curve": b[67] / 255.0,
        "env2_decay_curve": b[68] / 255.0,
        "env2_sustain_curve": b[69] / 255.0,
        "env2_release_curve": b[70] / 255.0,

        // ENV 3
        "env3_attack": byteToSec(b[71]),
        "env3_decay": byteToSec(b[72]),
        "env3_sustain": b[73] / 255.0,
        "env3_release": byteToSec(b[74]),
        "env3_trigger_mode": b[75] ? Math.min(1, b[75] / 4.0) : 0.0,
        "env3_attack_curve": b[76] / 255.0,
        "env3_decay_curve": b[77] / 255.0,
        "env3_sustain_curve": b[78] / 255.0,
        "env3_release_curve": b[79] / 255.0,

        // VCA
        "vca_level": b[80] / 255.0,
        "vca_env_depth": b[81] / 255.0,
        "vca_vel_sens": b[82] / 255.0,
        "vca_pan_spread": b[83] / 255.0,

        // Voice
        "note_priority": norm(b[84], 0, 2),
        "voice_mode": norm(b[85], 0, 12),
        "trigger_mode": norm(b[86], 0, 3),
        "unison_detune": b[87] / 255.0,
        "voice_drift": b[88] / 255.0,
        "osc_drift": b[88] / 255.0,
        "param_drift": b[89] / 255.0,
        "drift_rate": b[90] / 255.0,
        "porta_osc_bal": norm((b[91] - 128) / 127.0, -1.0, 1.0),
        "osc_key_reset": b[92] > 0 ? 1.0 : 0.0,

        // FX Routing
        "fx_routing": b[165] ? Math.min(1, b[165] / 9.0) : 0.0,
        "fx_mode": b[222] ? Math.min(1, b[222] / 2.0) : 0.0,

        // FX1
        "fx1_type": b[166] ? Math.min(1, b[166] / 35.0) : 0.0,
        "fx1_param1": (b[167] !== undefined ? b[167] : 128) / 255.0,
        "fx1_param2": (b[168] !== undefined ? b[168] : 128) / 255.0,
        "fx1_param3": (b[169] !== undefined ? b[169] : 128) / 255.0,
        "fx1_param4": (b[170] !== undefined ? b[170] : 128) / 255.0,
        "fx1_param5": (b[171] !== undefined ? b[171] : 128) / 255.0,
        "fx1_param6": (b[172] !== undefined ? b[172] : 128) / 255.0,
        "fx1_param7": (b[173] !== undefined ? b[173] : 128) / 255.0,
        "fx1_param8": (b[174] !== undefined ? b[174] : 128) / 255.0,
        "fx1_param9": (b[175] !== undefined ? b[175] : 128) / 255.0,
        "fx1_param10": (b[176] !== undefined ? b[176] : 128) / 255.0,
        "fx1_param11": (b[177] !== undefined ? b[177] : 128) / 255.0,
        "fx1_param12": (b[178] !== undefined ? b[178] : 128) / 255.0,
        "fx1_gain": b[218] !== undefined ? b[218] / 255.0 : 1.0,

        // FX2
        "fx2_type": b[179] ? Math.min(1, b[179] / 35.0) : 0.0,
        "fx2_param1": (b[180] !== undefined ? b[180] : 128) / 255.0,
        "fx2_param2": (b[181] !== undefined ? b[181] : 128) / 255.0,
        "fx2_param3": (b[182] !== undefined ? b[182] : 128) / 255.0,
        "fx2_param4": (b[183] !== undefined ? b[183] : 128) / 255.0,
        "fx2_param5": (b[184] !== undefined ? b[184] : 128) / 255.0,
        "fx2_param6": (b[185] !== undefined ? b[185] : 128) / 255.0,
        "fx2_param7": (b[186] !== undefined ? b[186] : 128) / 255.0,
        "fx2_param8": (b[187] !== undefined ? b[187] : 128) / 255.0,
        "fx2_param9": (b[188] !== undefined ? b[188] : 128) / 255.0,
        "fx2_param10": (b[189] !== undefined ? b[189] : 128) / 255.0,
        "fx2_param11": (b[190] !== undefined ? b[190] : 128) / 255.0,
        "fx2_param12": (b[191] !== undefined ? b[191] : 128) / 255.0,
        "fx2_gain": b[219] !== undefined ? b[219] / 255.0 : 1.0,

        // FX3
        "fx3_type": b[192] ? Math.min(1, b[192] / 35.0) : 0.0,
        "fx3_param1": (b[193] !== undefined ? b[193] : 128) / 255.0,
        "fx3_param2": (b[194] !== undefined ? b[194] : 128) / 255.0,
        "fx3_param3": (b[195] !== undefined ? b[195] : 128) / 255.0,
        "fx3_param4": (b[196] !== undefined ? b[196] : 128) / 255.0,
        "fx3_param5": (b[197] !== undefined ? b[197] : 128) / 255.0,
        "fx3_param6": (b[198] !== undefined ? b[198] : 128) / 255.0,
        "fx3_param7": (b[199] !== undefined ? b[199] : 128) / 255.0,
        "fx3_param8": (b[200] !== undefined ? b[200] : 128) / 255.0,
        "fx3_param9": (b[201] !== undefined ? b[201] : 128) / 255.0,
        "fx3_param10": (b[202] !== undefined ? b[202] : 128) / 255.0,
        "fx3_param11": (b[203] !== undefined ? b[203] : 128) / 255.0,
        "fx3_param12": (b[204] !== undefined ? b[204] : 128) / 255.0,
        "fx3_gain": b[220] !== undefined ? b[220] / 255.0 : 1.0,

        // FX4
        "fx4_type": b[205] ? Math.min(1, b[205] / 35.0) : 0.0,
        "fx4_param1": (b[206] !== undefined ? b[206] : 128) / 255.0,
        "fx4_param2": (b[207] !== undefined ? b[207] : 128) / 255.0,
        "fx4_param3": (b[208] !== undefined ? b[208] : 128) / 255.0,
        "fx4_param4": (b[209] !== undefined ? b[209] : 128) / 255.0,
        "fx4_param5": (b[210] !== undefined ? b[210] : 128) / 255.0,
        "fx4_param6": (b[211] !== undefined ? b[211] : 128) / 255.0,
        "fx4_param7": (b[212] !== undefined ? b[212] : 128) / 255.0,
        "fx4_param8": (b[213] !== undefined ? b[213] : 128) / 255.0,
        "fx4_param9": (b[214] !== undefined ? b[214] : 128) / 255.0,
        "fx4_param10": (b[215] !== undefined ? b[215] : 128) / 255.0,
        "fx4_param11": (b[216] !== undefined ? b[216] : 128) / 255.0,
        "fx4_param12": (b[217] !== undefined ? b[217] : 128) / 255.0,
        "fx4_gain": b[221] !== undefined ? b[221] / 255.0 : 1.0,

        // ARP
        "arp_enable": b[155] > 0 ? 1.0 : 0.0,
        "arp_mode": b[156] ? Math.min(1, b[156] / 10.0) : 0.0,
        "arp_rate": b[157] / 255.0,
        "arp_clock_divider": b[158] ? Math.min(1, b[158] / 12.0) : 0.0,
        "arp_key_sync": b[159] > 0 ? 1.0 : 0.0,
        "arp_gate_time": b[160] / 255.0,
        "arp_gate": b[160] / 255.0,
        "arp_hold": b[161] > 0 ? 1.0 : 0.0,
        "arp_pattern": b[162] ? Math.min(1, b[162] / 64.0) : 0.0,
        "arp_swing": b[163] !== undefined ? Math.min(1, b[163] / 25.0) : 0.5,
        "arp_octave": b[164] ? Math.min(1, b[164] / 5.0) : 0.0,

        // SEQ
        "seq_enable": b[117] > 0 ? 1.0 : 0.0,
        "seq_clock": b[118] ? Math.min(1, b[118] / 15.0) : 0.0,
        "seq_length": b[119] ? Math.min(1, b[119] / 31.0) : 0.0,
        "seq_swing": b[120] !== undefined ? Math.min(1, b[120] / 25.0) : 0.5,
        "seq_key_loop": b[121] ? Math.min(1, b[121] / 2.0) : 0.0,
        "seq_slew_rate": b[122] !== undefined ? b[122] / 255.0 : 0.0,
        "seq_step_1": b[123] / 255.0, "seq_step_2": b[124] / 255.0, "seq_step_3": b[125] / 255.0, "seq_step_4": b[126] / 255.0, "seq_step_5": b[127] / 255.0,
        "seq_step_6": b[128] / 255.0, "seq_step_7": b[129] / 255.0, "seq_step_8": b[130] / 255.0, "seq_step_9": b[131] / 255.0, "seq_step_10": b[132] / 255.0,
        "seq_step_11": b[133] / 255.0, "seq_step_12": b[134] / 255.0, "seq_step_13": b[135] / 255.0, "seq_step_14": b[136] / 255.0, "seq_step_15": b[137] / 255.0,
        "seq_step_16": b[138] / 255.0, "seq_step_17": b[139] / 255.0, "seq_step_18": b[140] / 255.0, "seq_step_19": b[141] / 255.0, "seq_step_20": b[142] / 255.0,
        "seq_step_21": b[143] / 255.0, "seq_step_22": b[144] / 255.0, "seq_step_23": b[145] / 255.0, "seq_step_24": b[146] / 255.0, "seq_step_25": b[147] / 255.0,
        "seq_step_26": b[148] / 255.0, "seq_step_27": b[149] / 255.0, "seq_step_28": b[150] / 255.0, "seq_step_29": b[151] / 255.0, "seq_step_30": b[152] / 255.0,
        "seq_step_31": b[153] / 255.0, "seq_step_32": b[154] / 255.0,
        "chord_enable": b[105] > 0 ? 1.0 : 0.0,
        "poly_chord_enable": b[106] > 0 ? 1.0 : 0.0,
        "chord_key": norm(b[107], 0, 11),
        "chord_type": norm(b[108], 0, 11),

        // MODULATION MATRIX
        "mod_matrix_slot1_src": b[93] ? Math.min(1, b[93] / 22.0) : 0.0,
        "mod_matrix_slot1_dest": b[94] ? Math.min(1, b[94] / 129.0) : 0.0,
        "mod_matrix_slot1_depth": norm((b[95] - 128) / 127.0, -1.0, 1.0),
        "mod_matrix_slot2_src": b[96] ? Math.min(1, b[96] / 22.0) : 0.0,
        "mod_matrix_slot2_dest": b[97] ? Math.min(1, b[97] / 129.0) : 0.0,
        "mod_matrix_slot2_depth": norm((b[98] - 128) / 127.0, -1.0, 1.0),
        "mod_matrix_slot3_src": b[99] ? Math.min(1, b[99] / 22.0) : 0.0,
        "mod_matrix_slot3_dest": b[100] ? Math.min(1, b[100] / 129.0) : 0.0,
        "mod_matrix_slot3_depth": norm((b[101] - 128) / 127.0, -1.0, 1.0),
        "mod_matrix_slot4_src": b[102] ? Math.min(1, b[102] / 22.0) : 0.0,
        "mod_matrix_slot4_dest": b[103] ? Math.min(1, b[103] / 129.0) : 0.0,
        "mod_matrix_slot4_depth": norm((b[104] - 128) / 127.0, -1.0, 1.0),
        "mod_matrix_slot5_src": b[105] ? Math.min(1, b[105] / 22.0) : 0.0,
        "mod_matrix_slot5_dest": b[106] ? Math.min(1, b[106] / 129.0) : 0.0,
        "mod_matrix_slot5_depth": norm((b[107] - 128) / 127.0, -1.0, 1.0),
        "mod_matrix_slot6_src": b[108] ? Math.min(1, b[108] / 22.0) : 0.0,
        "mod_matrix_slot6_dest": b[109] ? Math.min(1, b[109] / 129.0) : 0.0,
        "mod_matrix_slot6_depth": norm((b[110] - 128) / 127.0, -1.0, 1.0),
        "mod_matrix_slot7_src": b[111] ? Math.min(1, b[111] / 22.0) : 0.0,
        "mod_matrix_slot7_dest": b[112] ? Math.min(1, b[112] / 129.0) : 0.0,
        "mod_matrix_slot7_depth": norm((b[113] - 128) / 127.0, -1.0, 1.0),
        "mod_matrix_slot8_src": b[114] ? Math.min(1, b[114] / 22.0) : 0.0,
        "mod_matrix_slot8_dest": b[115] ? Math.min(1, b[115] / 129.0) : 0.0,
        "mod_matrix_slot8_depth": norm((b[116] - 128) / 127.0, -1.0, 1.0)
    };

    const paramEntries = Object.entries(mappings);
    paramEntries.forEach(([paramId, rawVal]) => {
        try {
            const val = Math.max(0, Math.min(1, rawVal));
            if (window.dualMidiBridge) {
                window.dualMidiBridge.parameterCache[paramId] = val;
                window.dualMidiBridge.onParameterChangedCallbacks.forEach(cb => {
                    try { cb(paramId, val); } catch (e) {}
                });
            }
        } catch (e) {
            console.warn("[triggerMidiDump] Error actualizando UI para", paramId, e);
        }
    });
    
    try {
        var savedVcaMode = localStorage.getItem('abd-eep-vca-mode');
        if (savedVcaMode && window.dualMidiBridge) {
            var vcaVal = savedVcaMode === 'ballsy' ? 1.0 : 0.0;
            window.dualMidiBridge.parameterCache['vca_mode'] = vcaVal;
            window.dualMidiBridge.onParameterChangedCallbacks.forEach(function(cb) {
                try { cb('vca_mode', vcaVal); } catch(e) {}
            });
        }
    } catch(e) {}

    if (window.dualMidiBridge && window.dualMidiBridge.isJuce && window.dualMidiBridge._ready) {
        paramEntries.forEach(([paramId, rawVal], index) => {
            const val = Math.max(0, Math.min(1, rawVal));
            setTimeout(() => {
                try {
                    window.dualMidiBridge.setParameter(paramId, val);
                } catch (e) {
                    console.warn("[triggerMidiDump] Error setParameter", paramId, e);
                }
            }, index * 5);
        });
        setTimeout(() => {
            try {
                var _vca = window.dualMidiBridge.parameterCache['vca_mode'] || 0.0;
                window.dualMidiBridge.setParameter('vca_mode', _vca);
            } catch (e) {
                console.warn("[triggerMidiDump] Error setParameter vca_mode", e);
            }
        }, paramEntries.length * 5 + 10);
        console.log('[triggerMidiDump] Enviando ' + paramEntries.length + ' parámetros + vca_mode al backend C++ (escalonados)');
    }

    window._lastUnpackedBytes = patch.unpackedBytes;
    window._lastPresetName = patch.name;

    try {
        if (typeof window.updateLfoSlidersFromCurrentPreset === 'function') window.updateLfoSlidersFromCurrentPreset();
        if (typeof window.updateEnvSlidersFromCurrentPreset === 'function') window.updateEnvSlidersFromCurrentPreset();
        if (typeof window.updateOscSlidersFromCurrentPreset === 'function') window.updateOscSlidersFromCurrentPreset();
        if (typeof updateSysExMonitor === 'function') updateSysExMonitor(patch.unpackedBytes);
    } catch (e) {
        console.warn("[triggerMidiDump] Error en slider updates", e);
    }
}

window.triggerMidiDump = triggerMidiDump;
