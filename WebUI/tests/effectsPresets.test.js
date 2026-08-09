import { describe, it, expect, beforeEach} from 'vitest';
/**
 * Tests for WebUI/js/effects_presets.js — FX preset CRUD in localStorage
 *
 * Strategy: extracted functions with localStorage stub. Tests cover save, load, delete,
 * apply, default presets, escapeHtml, and findMatchingFxPresetName.
 */

// ===== Global stubs =====
let fxStore = {};
const mockLS = {
    getItem: function(k) { return fxStore[k] !== undefined ? fxStore[k] : null; },
    setItem: function(k, v) { fxStore[k] = String(v); },
    removeItem: function(k) { delete fxStore[k]; },
    clear: function() { fxStore = {}; }
};
globalThis.localStorage = mockLS;
globalThis.window = globalThis.window || {};
globalThis.window.FX_TYPE_NAMES = globalThis.window.FX_TYPE_NAMES || [];
globalThis.window._fxPresetFilterMode = 'active';
globalThis.document = globalThis.document || { getElementById: function() { return null; } };

// ===== Extracted Source =====

const DEFAULT_FX_PRESETS = [
    // ── Existing presets (types 0–35) ──────────────────────────────────────
    { name: 'Lush Chorus-D',    slot: 1, type: 29/56.0, gain: 1.0, params: [0.35,0.40,0.50,0.20,0.80,0.10,0.50,0.50,0.50,0.50,0.50,0.50], created: 1720000000000 },
    { name: 'Stereo Delay PingPong', slot: 1, type: 22/56.0, gain: 0.8, params: [0.50,0.75,0.45,0.30,0.50,0.50,0.50,0.50,0.50,0.50,0.50,0.50], created: 1720000000001 },
    { name: 'TC Deep Reverb Hall',  slot: 1, type: 2/56.0,  gain: 0.9, params: [0.15,0.70,0.80,0.50,0.35,0.60,0.50,0.50,0.50,0.50,0.50,0.50], created: 1720000000002 },
    { name: 'Vintage Room Ambience', slot: 1, type: 4/56.0, gain: 1.0, params: [0.05,0.35,0.40,0.60,0.50,0.50,0.10,0.90,0.50,0.50,0.50,0.50], created: 1720000000003 },
    { name: 'Lush Stereo Phaser',  slot: 1, type: 31/56.0, gain: 1.0, params: [0.20,0.65,0.40,0.50,0.50,0.50,0.50,0.50,0.50,0.50,0.50,0.50], created: 1720000000004 },
    // ── Advanced FX presets (types 36–56) ──────────────────────────────────
    { name: 'Juno-106 Chorus I',    slot: 1, type: 36/56.0, gain: 1.0,  params: [0.05,0.00,0.00,0.00,0.65,0.80,0.45,0.50,0.50,0.50,0.50,0.50], created: 1720000000010 },
    { name: 'Slow BBD Swirl',       slot: 1, type: 36/56.0, gain: 0.95, params: [0.10,0.00,0.00,0.00,0.55,0.75,0.35,0.25,0.50,0.50,0.50,0.50], created: 1720000000011 },
    { name: 'Ensemble Triple',      slot: 1, type: 36/56.0, gain: 0.85, params: [0.08,0.00,0.00,0.00,0.70,0.85,0.60,0.70,0.50,0.50,0.50,0.50], created: 1720000000012 },
    { name: 'Solina String Pad',    slot: 1, type: 37/56.0, gain: 1.0,  params: [0.00,0.00,0.00,0.00,0.60,0.90,0.40,0.60,0.50,0.50,0.50,0.50], created: 1720000000020 },
    { name: 'Orchestral Warmth',    slot: 1, type: 37/56.0, gain: 0.9,  params: [0.00,0.00,0.00,0.00,0.55,0.80,0.30,0.40,0.50,0.50,0.50,0.50], created: 1720000000021 },
    { name: 'Bell Tone Metallic',   slot: 1, type: 38/56.0, gain: 0.75, params: [0.00,0.00,0.00,0.00,0.50,0.70,0.80,0.20,0.50,0.50,0.50,0.50], created: 1720000000030 },
    { name: 'Alien Texture',        slot: 1, type: 38/56.0, gain: 0.70, params: [0.00,0.00,0.00,0.00,0.50,0.65,0.30,0.90,0.50,0.50,0.50,0.50], created: 1720000000031 },
    { name: 'RE-201 Dub Echo',      slot: 1, type: 39/56.0, gain: 0.85, params: [0.10,0.60,0.50,0.30,0.50,0.70,0.40,0.80,0.50,0.50,0.50,0.50], created: 1720000000040 },
    { name: 'Tape Slap-Back',       slot: 1, type: 39/56.0, gain: 0.90, params: [0.02,0.25,0.15,0.20,0.50,0.65,0.50,0.50,0.50,0.50,0.50,0.50], created: 1720000000041 },
    { name: 'Self-Oscillate Trips', slot: 1, type: 39/56.0, gain: 0.80, params: [0.15,0.80,0.60,0.40,0.50,0.90,0.60,0.95,0.50,0.50,0.50,0.50], created: 1720000000042 },
    { name: 'Warm Tape Echo',       slot: 1, type: 40/56.0, gain: 0.85, params: [0.05,0.50,0.35,0.25,0.50,0.70,0.45,0.60,0.50,0.50,0.50,0.50], created: 1720000000050 },
    { name: 'Lo-Fi Degraded Tape',  slot: 1, type: 40/56.0, gain: 0.80, params: [0.05,0.40,0.30,0.15,0.50,0.60,0.80,0.70,0.50,0.50,0.50,0.50], created: 1720000000051 },
    { name: 'Precision Tape',       slot: 1, type: 40/56.0, gain: 0.90, params: [0.03,0.35,0.25,0.10,0.50,0.60,0.20,0.30,0.50,0.50,0.50,0.50], created: 1720000000052 },
    { name: 'Space Shimmer Cath.',  slot: 1, type: 41/56.0, gain: 0.80, params: [0.10,0.85,0.80,0.50,0.50,0.75,0.50,0.40,0.50,0.50,0.50,0.50], created: 1720000000060 },
    { name: 'Ethereal Float',       slot: 1, type: 41/56.0, gain: 0.75, params: [0.20,0.90,0.90,0.60,0.50,0.70,0.35,0.30,0.50,0.50,0.50,0.50], created: 1720000000061 },
    { name: 'Dark Shimmer',         slot: 1, type: 41/56.0, gain: 0.85, params: [0.15,0.80,0.75,0.80,0.50,0.80,0.55,0.45,0.50,0.50,0.50,0.50], created: 1720000000062 },
    { name: 'Granular Frozen Sky',  slot: 1, type: 42/56.0, gain: 0.80, params: [0.10,0.70,0.85,0.40,0.50,0.75,0.70,0.60,0.50,0.50,0.50,0.50], created: 1720000000070 },
    { name: 'Micro Grain Rain',     slot: 1, type: 42/56.0, gain: 0.85, params: [0.05,0.60,0.50,0.30,0.50,0.65,0.90,0.80,0.50,0.50,0.50,0.50], created: 1720000000071 },
    { name: 'Pitch Scatter',        slot: 1, type: 42/56.0, gain: 0.75, params: [0.15,0.65,0.70,0.35,0.50,0.70,0.50,0.90,0.50,0.50,0.50,0.50], created: 1720000000072 },
    { name: 'Rhythmic Stutter',     slot: 1, type: 43/56.0, gain: 0.80, params: [0.05,0.30,0.00,0.00,0.50,0.60,0.70,0.50,0.50,0.50,0.50,0.50], created: 1720000000080 },
    { name: 'Evolving Texture',     slot: 1, type: 43/56.0, gain: 0.75, params: [0.20,0.80,0.50,0.40,0.50,0.55,0.60,0.70,0.50,0.50,0.50,0.50], created: 1720000000081 },
    { name: 'Vocal Clarity Delay',  slot: 1, type: 44/56.0, gain: 0.85, params: [0.05,0.40,0.30,0.25,0.50,0.65,0.80,0.40,0.50,0.50,0.50,0.50], created: 1720000000090 },
    { name: 'Pluck Duck Echo',      slot: 1, type: 44/56.0, gain: 0.90, params: [0.03,0.30,0.20,0.15,0.50,0.60,0.90,0.30,0.50,0.50,0.50,0.50], created: 1720000000091 },
    { name: 'Ambient Duck',         slot: 1, type: 44/56.0, gain: 0.80, params: [0.15,0.65,0.55,0.40,0.50,0.70,0.70,0.50,0.50,0.50,0.50,0.50], created: 1720000000092 },
    { name: 'Spectral Blur',        slot: 1, type: 45/56.0, gain: 0.80, params: [0.10,0.70,0.60,0.45,0.80,0.65,0.50,0.50,0.50,0.50,0.50,0.50], created: 1720000000100 },
    { name: 'Freq Split Echo',      slot: 1, type: 45/56.0, gain: 0.85, params: [0.08,0.55,0.45,0.30,0.70,0.60,0.40,0.70,0.50,0.50,0.50,0.50], created: 1720000000101 },
    { name: 'Metallic Ring',        slot: 1, type: 46/56.0, gain: 0.75, params: [0.00,0.00,0.00,0.00,0.50,0.70,0.65,0.30,0.50,0.50,0.50,0.50], created: 1720000000110 },
    { name: 'Alien Sweep',          slot: 1, type: 46/56.0, gain: 0.70, params: [0.00,0.00,0.00,0.00,0.50,0.65,0.20,0.85,0.50,0.50,0.50,0.50], created: 1720000000111 },
    { name: 'Acoustic Body',        slot: 1, type: 47/56.0, gain: 0.85, params: [0.00,0.35,0.45,0.20,0.50,0.60,0.55,0.40,0.50,0.50,0.50,0.50], created: 1720000000120 },
    { name: 'Harmonic Bloom',       slot: 1, type: 47/56.0, gain: 0.80, params: [0.10,0.50,0.60,0.35,0.50,0.55,0.40,0.60,0.50,0.50,0.50,0.50], created: 1720000000121 },
    { name: 'Metallic Comb',        slot: 1, type: 48/56.0, gain: 0.80, params: [0.02,0.30,0.40,0.15,0.50,0.65,0.60,0.70,0.50,0.50,0.50,0.50], created: 1720000000130 },
    { name: 'Resonant Modal',       slot: 1, type: 48/56.0, gain: 0.85, params: [0.05,0.40,0.50,0.25,0.50,0.70,0.45,0.55,0.50,0.50,0.50,0.50], created: 1720000000131 },
    { name: 'Classic Robot Voice',  slot: 1, type: 49/56.0, gain: 0.80, params: [0.00,0.00,0.00,0.00,0.50,0.75,0.80,0.20,0.50,0.50,0.50,0.50], created: 1720000000140 },
    { name: 'Whisper Synth',        slot: 1, type: 49/56.0, gain: 0.85, params: [0.00,0.00,0.00,0.00,0.50,0.70,0.50,0.50,0.50,0.50,0.50,0.50], created: 1720000000141 },
    { name: 'Metallic Vocoder',     slot: 1, type: 49/56.0, gain: 0.75, params: [0.00,0.00,0.00,0.00,0.50,0.65,0.90,0.35,0.50,0.50,0.50,0.50], created: 1720000000142 },
    { name: 'Warm Saturation',      slot: 1, type: 50/56.0, gain: 0.75, params: [0.00,0.00,0.00,0.00,0.50,0.60,0.35,0.40,0.50,0.50,0.50,0.50], created: 1720000000150 },
    { name: 'Crunch Guitar Amp',    slot: 1, type: 50/56.0, gain: 0.70, params: [0.00,0.00,0.00,0.00,0.50,0.55,0.70,0.60,0.50,0.50,0.50,0.50], created: 1720000000151 },
    { name: 'Brickwall Limiter',    slot: 1, type: 50/56.0, gain: 0.80, params: [0.00,0.00,0.00,0.00,0.50,0.65,0.90,0.25,0.50,0.50,0.50,0.50], created: 1720000000152 },
    { name: 'Soft Tanh Clip',       slot: 1, type: 51/56.0, gain: 0.80, params: [0.00,0.00,0.00,0.00,0.50,0.70,0.30,0.30,0.50,0.50,0.50,0.50], created: 1720000000160 },
    { name: 'Hard Bit Crush',       slot: 1, type: 51/56.0, gain: 0.70, params: [0.00,0.00,0.00,0.00,0.50,0.60,0.85,0.75,0.50,0.50,0.50,0.50], created: 1720000000161 },
    { name: 'Dense Hall FDN',       slot: 1, type: 52/56.0, gain: 0.85, params: [0.10,0.85,0.90,0.50,0.75,0.70,0.45,0.40,0.50,0.50,0.50,0.50], created: 1720000000170 },
    { name: 'Plate Diffuse',        slot: 1, type: 52/56.0, gain: 0.90, params: [0.05,0.60,0.50,0.35,0.90,0.65,0.35,0.30,0.50,0.50,0.50,0.50], created: 1720000000171 },
    { name: 'Clean Hall Zita',      slot: 1, type: 53/56.0, gain: 0.90, params: [0.05,0.80,0.85,0.40,0.50,0.75,0.40,0.35,0.50,0.50,0.50,0.50], created: 1720000000180 },
    { name: 'Cathedral Long Tail',  slot: 1, type: 53/56.0, gain: 0.85, params: [0.15,0.95,0.95,0.60,0.50,0.80,0.50,0.45,0.50,0.50,0.50,0.50], created: 1720000000181 },
    { name: 'Nimbus Freeze',        slot: 1, type: 54/56.0, gain: 0.80, params: [0.15,0.70,0.80,0.50,0.50,0.70,0.60,0.50,0.50,0.50,0.50,0.50], created: 1720000000190 },
    { name: 'Lo-Fi Bonsai',         slot: 1, type: 55/56.0, gain: 0.80, params: [0.05,0.40,0.35,0.20,0.50,0.60,0.75,0.80,0.50,0.50,0.50,0.50], created: 1720000000200 },
    { name: 'Treemonster Drift',    slot: 1, type: 56/56.0, gain: 0.75, params: [0.10,0.50,0.60,0.30,0.50,0.55,0.50,0.70,0.50,0.50,0.50,0.50], created: 1720000000210 }
];

function loadAllFxPresets(storage) {
    storage = storage || {};
    try {
        const raw = storage.getItem('abd-eep-fx-presets');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {return parsed;}
        } else {
            storage.setItem('abd-eep-fx-presets', JSON.stringify(DEFAULT_FX_PRESETS));
            return JSON.parse(JSON.stringify(DEFAULT_FX_PRESETS));
        }
    } catch (e) {}
    return [];
}

function saveFxPreset(presetName, slotNumber, readParamFn, storage) {
    storage = storage || {};
    readParamFn = readParamFn || function() { return 0.5; };
    if (!presetName || presetName.trim() === '') {return { success: false, reason: 'empty-name' };}
    const cleanName = presetName.trim().replace(/[<>\"'&]/g, '');
    if (!cleanName) {return { success: false, reason: 'invalid-name' };}
    slotNumber = slotNumber || 1;

    const preset = {
        name: cleanName,
        slot: slotNumber,
        type: readParamFn('fx' + slotNumber + '_type', slotNumber === 1 ? 166 : (slotNumber === 2 ? 179 : (slotNumber === 3 ? 192 : 205)), 0.0),
        params: [],
        created: Date.now()
    };
    for (let i = 1; i <= 12; i++) {
        const offsetStart = slotNumber === 1 ? 167 : (slotNumber === 2 ? 180 : (slotNumber === 3 ? 193 : 206));
        preset.params.push(readParamFn('fx' + slotNumber + '_param' + i, offsetStart + i - 1, 0.5));
    }
    preset.gain = readParamFn('fx' + slotNumber + '_gain', slotNumber === 1 ? 218 : (slotNumber === 2 ? 219 : (slotNumber === 3 ? 220 : 221)), 1.0);

    const allPresets = loadAllFxPresets(storage);
    let existingIdx = -1;
    for (let j = 0; j < allPresets.length; j++) {
        if (allPresets[j].name === cleanName) { existingIdx = j; break; }
    }
    if (existingIdx >= 0) {
        allPresets[existingIdx] = preset;
    } else {
        allPresets.push(preset);
    }
    storage.setItem('abd-eep-fx-presets', JSON.stringify(allPresets));
    return { success: true, preset: preset };
}

function deleteFxPreset(presetName, storage) {
    storage = storage || {};
    const allPresets = loadAllFxPresets(storage);
    const filtered = [];
    for (let i = 0; i < allPresets.length; i++) {
        if (allPresets[i].name !== presetName) {
            filtered.push(allPresets[i]);
        }
    }
    if (filtered.length !== allPresets.length) {
        storage.setItem('abd-eep-fx-presets', JSON.stringify(filtered));
        return { deleted: true, remaining: filtered.length };
    }
    return { deleted: false, remaining: allPresets.length };
}

function applyFxPreset(presetData, slotNumber, bridge, setGainSliderPos) {
    slotNumber = slotNumber || 1;
    bridge = bridge || { setParameter: function() {} };
    setGainSliderPos = setGainSliderPos || function() {};
    const setCalls = [];

    bridge.setParameter = function(id, val) { setCalls.push([id, val]); };

    bridge.setParameter('fx' + slotNumber + '_type', presetData.type);
    for (let i = 0; i < 12 && i < presetData.params.length; i++) {
        bridge.setParameter('fx' + slotNumber + '_param' + (i + 1), presetData.params[i]);
    }
    if (presetData.gain !== undefined) {
        bridge.setParameter('fx' + slotNumber + '_gain', presetData.gain);
    }

    return setCalls;
}

function findMatchingFxPresetName(type, gain, params, storage, factoryPresets) {
    storage = storage || {};
    factoryPresets = factoryPresets || [];
    if (type === 0.0) {return 'Bypass';}

    const searchPresets = function(presets) {
        for (let i = 0; i < presets.length; i++) {
            const p = presets[i];
            if (Math.round(p.type * 56) === Math.round(type * 56)) {
                let match = true;
                if (Math.abs(p.gain - gain) > 0.03) {match = false;}
                for (let j = 0; j < 12 && j < p.params.length; j++) {
                    if (Math.abs(p.params[j] - params[j]) > 0.03) { match = false; break; }
                }
                if (match) {return p.name;}
            }
        }
        return null;
    };

    const userPresets = loadAllFxPresets(storage);
    const found = searchPresets(userPresets);
    if (found) {return found;}
    return searchPresets(factoryPresets);
}

function escapeHtml(str) {
    // Espejo del canónico consolidado (dom_sanitize.js): null/undefined → ''
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

function extractAndSaveNewPresetsFromBank(bankName, patches, storage, factoryFxPresets, factorySeqPresets, _loadUserSeqPresetsFn, _saveUserSeqPresetsFn) {
    if (!Array.isArray(patches)) {return { fxCount: 0, seqCount: 0 };}
    
    const userFxPresets = loadAllFxPresets(storage);
    const userSeqPresets = _loadUserSeqPresetsFn() || [];
    let newFxCount = 0;
    let newSeqCount = 0;
    const FX_TYPE_NAMES_MOCK = [
      'Bypass', 'Ambience', 'tcDeepVerb', 'RoomRev', 'VintageRoom', 'HallReverb',
      'ChamberRev', 'Plate Reverb', 'Rich Plate', 'Gated Reverb', 'Reverse Reverb',
      'ChorusRev', 'DelayRev', 'FlangerRev', 'MidasEQ', 'Enhancer', 'FairComp',
      'MBDistortion', 'RackAmp', 'Edison', 'AutoPan/Trem', 'NoiseGate', 'Delay',
      '3Tap Delay', '4Tap Delay', 'T-RayDelay', 'DecimatorDelay', 'ModDlyRev',
      'Stereo Chorus', 'Chorus-D', 'Stereo Flanger', 'Stereo Phaser', 'Mood Filter',
      'Dual Pitch', 'Vintage Pitch', 'Rotary Speaker'
    ];

    patches.forEach(function(patch) {
        if (!patch || !patch.unpackedBytes) {return;}
        const b = patch.unpackedBytes;
        
        const fxSlots = [
            { id: 1, typeByte: 166, paramStart: 167, gainByte: 218 },
            { id: 2, typeByte: 179, paramStart: 180, gainByte: 219 },
            { id: 3, typeByte: 192, paramStart: 193, gainByte: 220 },
            { id: 4, typeByte: 205, paramStart: 206, gainByte: 221 }
        ];

        fxSlots.forEach(function(slot) {
            const typeVal = b[slot.typeByte];
            if (typeVal > 0 && typeVal < 36) {
                const typeName = FX_TYPE_NAMES_MOCK[typeVal];
                const typeValNorm = typeVal / 56.0;
                const gain = b[slot.gainByte] / 255.0;
                const params = [];
                for (let p = 0; p < 12; p++) {
                    params.push(b[slot.paramStart + p] / 255.0);
                }

                let alreadyExists = false;
                if (factoryFxPresets) {
                    for (let i = 0; i < factoryFxPresets.length; i++) {
                        const fp = factoryFxPresets[i];
                        if (Math.round(fp.type * 56) === typeVal) {
let match = true;
                            if (Math.abs(fp.gain - gain) > 0.03) {match = false;}
                            for (let j = 0; j < 12; j++) {
                                if (Math.abs(fp.params[j] - params[j]) > 0.03) {
                                    match = false;
                                    break;
                                }
                            }
                            if (match) { alreadyExists = true; break; }
                        }
                    }
                }
                if (!alreadyExists) {
                    for (let i = 0; i < userFxPresets.length; i++) {
                        const up = userFxPresets[i];
                        if (Math.round(up.type * 56) === typeVal) {
let match = true;
                            if (Math.abs(up.gain - gain) > 0.03) {match = false;}
                            for (let j = 0; j < 12; j++) {
                                if (Math.abs(up.params[j] - params[j]) > 0.03) {
                                    match = false;
                                    break;
                                }
                            }
                            if (match) { alreadyExists = true; break; }
                        }
                    }
                }

                if (!alreadyExists) {
                    const presetName = typeName + ' (' + patch.name + ')';
                    userFxPresets.push({
                        name: presetName,
                        slot: slot.id,
                        type: typeValNorm,
                        gain: gain,
                        params: params,
                        created: Date.now()
                    });
                    newFxCount++;
                }
            }
        });

        const steps = [];
        let max = 0;
        let min = 255;
        let isZero = true;
        for (let s = 0; s < 32; s++) {
            const val = b[123 + s];
            steps.push(val);
            if (val !== 128) {isZero = false;}
            if (val > max) {max = val;}
            if (val < min) {min = val;}
        }

        if (!isZero && (max - min) >= 15) {
            let alreadyExists = false;
            if (factorySeqPresets) {
                for (let i = 0; i < factorySeqPresets.length; i++) {
                    const fp = factorySeqPresets[i];
let match = true;
                    for (let j = 0; j < 32; j++) {
                        if (Math.abs(fp.steps[j] - steps[j]) > 5) {
                            match = false;
                            break;
                        }
                    }
                    if (match) { alreadyExists = true; break; }
                }
            }
            if (!alreadyExists) {
                for (let i = 0; i < userSeqPresets.length; i++) {
                    const up = userSeqPresets[i];
let match = true;
                    for (let j = 0; j < 32; j++) {
                        if (Math.abs(up.steps[j] - steps[j]) > 5) {
                            match = false;
                            break;
                        }
                    }
                    if (match) { alreadyExists = true; break; }
                }
            }

            if (!alreadyExists) {
                const presetName = patch.name + ' Seq';
                userSeqPresets.push({
                    name: presetName,
                    steps: steps
                });
                newSeqCount++;
            }
        }
    });

    if (newFxCount > 0) {
        storage.setItem('abd-eep-fx-presets', JSON.stringify(userFxPresets));
    }
    if (newSeqCount > 0) {
        _saveUserSeqPresetsFn(userSeqPresets);
    }

    return { fxCount: newFxCount, seqCount: newSeqCount };
}

function getFilteredPresetIndices(allPresets, filterMode, activeType) {
    const displayIndices = [];
    if (filterMode === 'active' && activeType >= 0) {
        for (let i = allPresets.length - 1; i >= 0; i--) {
            if (Math.round(allPresets[i].type * 56) === activeType) {displayIndices.push(i);}
        }
    } else {
        for (let i = allPresets.length - 1; i >= 0; i--) {displayIndices.push(i);}
    }
    return displayIndices;
}

// ===== Tests =====

describe('DEFAULT_FX_PRESETS — built-in presets', function() {
    it('has 52 default presets', function() {
        expect(DEFAULT_FX_PRESETS.length).toBe(52);
    });

    it('each preset has name, slot, type, gain, params, created', function() {
        DEFAULT_FX_PRESETS.forEach(function(p) {
            expect(typeof p.name).toBe('string');
            expect(p.slot).toBe(1);
            expect(p.type).toBeGreaterThan(0);
            expect(p.params.length).toBe(12);
            expect(typeof p.created).toBe('number');
        });
    });

    it('Lush Chorus-D is first', function() {
        expect(DEFAULT_FX_PRESETS[0].name).toBe('Lush Chorus-D');
    });
});

describe('escapeHtml', function() {
    it('escapes & to &amp;', function() {
        expect(escapeHtml('a&b')).toBe('a&amp;b');
    });

    it('escapes < to &lt;', function() {
        expect(escapeHtml('<tag>')).toBe('&lt;tag&gt;');
    });

    it('escapes double quotes', function() {
        expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
    });

    it('escapes single quotes', function() {
        expect(escapeHtml("it's")).toBe('it&#039;s');
    });

    it('handles plain text without modification', function() {
        expect(escapeHtml('Hello World')).toBe('Hello World');
    });

    it('handles empty string', function() {
        expect(escapeHtml('')).toBe('');
    });

    it('handles all special chars together', function() {
        expect(escapeHtml('<b>"Hi & \'Lo\'</b>')).toBe('&lt;b&gt;&quot;Hi &amp; &#039;Lo&#039;&lt;/b&gt;');
    });
});

describe('loadAllFxPresets — localStorage loading', function() {
    beforeEach(function() {
        fxStore = {};
    });

    it('returns DEFAULT_FX_PRESETS when storage is empty (first run)', function() {
        const result = loadAllFxPresets(mockLS);
        expect(result.length).toBe(52);
        expect(result[0].name).toBe('Lush Chorus-D');
        // Also saves defaults to storage
        expect(mockLS.getItem('abd-eep-fx-presets')).toBeDefined();
    });

    it('returns saved presets from storage', function() {
        const customPresets = [{ name: 'Custom', slot: 1, type: 0.5, gain: 1.0, params: [0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5], created: 100 }];
        mockLS.setItem('abd-eep-fx-presets', JSON.stringify(customPresets));
        const result = loadAllFxPresets(mockLS);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Custom');
    });

    it('returns empty array on corrupt JSON', function() {
        mockLS.setItem('abd-eep-fx-presets', 'not-valid-json{{{');
        const result = loadAllFxPresets(mockLS);
        expect(result).toEqual([]);
    });

    it('returns empty array on non-array JSON', function() {
        mockLS.setItem('abd-eep-fx-presets', '{"a":1}');
        const result = loadAllFxPresets(mockLS);
        expect(result).toEqual([]);
    });
});

describe('saveFxPreset — saving with CRUD', function() {
    beforeEach(function() {
        fxStore = {};
        // Trigger default initialization
        loadAllFxPresets(mockLS);
    });

    it('returns failure for empty name', function() {
        const result = saveFxPreset('', 1, function() { return 0.5; }, mockLS);
        expect(result.success).toBe(false);
    });

    it('returns failure for whitespace-only name', function() {
        const result = saveFxPreset('   ', 1, function() { return 0.5; }, mockLS);
        expect(result.success).toBe(false);
    });

    it('saves a new preset', function() {
        const readFn = function() { return 0.5; };
        const result = saveFxPreset('My Awesome Reverb', 1, readFn, mockLS);
        expect(result.success).toBe(true);
        expect(result.preset.name).toBe('My Awesome Reverb');
        expect(result.preset.slot).toBe(1);
        expect(result.preset.params.length).toBe(12);
    });

    it('updates existing preset with same name', function() {
        const readFn = function() { return 0.5; };
        saveFxPreset('My Preset', 1, readFn, mockLS);
        saveFxPreset('My Preset', 2, readFn, mockLS);
        const allPresets = loadAllFxPresets(mockLS);
        // Should be 53 total (52 defaults + 1 unique, updated in-place)
        expect(allPresets.length).toBe(53);
        let found = false;
        for (let i = 0; i < allPresets.length; i++) {
            if (allPresets[i].name === 'My Preset') {
                expect(allPresets[i].slot).toBe(2);
                found = true;
            }
        }
        expect(found).toBe(true);
    });

    it('sanitizes HTML tags from name', function() {
        const readFn = function() { return 0.5; };
        const result = saveFxPreset('<script>alert("xss")</script>', 1, readFn, mockLS);
        expect(result.preset.name).not.toContain('<');
        expect(result.preset.name).not.toContain('>');
    });

    it('reads type, then 12 params (in loop), then gain', function() {
        const callLog = [];
        const readFn = function(id, offset, def) {
            callLog.push(id);
            return 0.3;
        };
        saveFxPreset('Test', 1, readFn, mockLS);
        // Order: fx1_type (#0), fx1_param1..fx1_param12 (#1..#12), fx1_gain (#13)
        expect(callLog.length).toBe(14);
        expect(callLog[0]).toBe('fx1_type');
        expect(callLog[1]).toBe('fx1_param1');
        expect(callLog[12]).toBe('fx1_param12');
        expect(callLog[13]).toBe('fx1_gain');
    });

    it('supports slots 2, 3, 4 with correct offsets', function() {
        const callLog = [];
        const readFn = function(id, offset, def) {
            callLog.push({ id: id, offset: offset });
            return 0.3;
        };
        saveFxPreset('FX2 Test', 2, readFn, mockLS);
        // Slot 2: type offset 179, param offset start 180, gain offset 219
        // Order: type (#0), then 12 params (#1..#12), gain (#13)
        expect(callLog[0].offset).toBe(179); // type
        expect(callLog[1].offset).toBe(180); // param1
        expect(callLog[12].offset).toBe(191); // param12
        expect(callLog[13].offset).toBe(219); // gain
    });
});

describe('deleteFxPreset', function() {
    beforeEach(function() {
        fxStore = {};
        loadAllFxPresets(mockLS); // Load defaults
    });

    it('deletes a preset by name', function() {
        const result = deleteFxPreset('Lush Chorus-D', mockLS);
        expect(result.deleted).toBe(true);
        expect(result.remaining).toBe(51);
        const presets = loadAllFxPresets(mockLS);
        expect(presets.length).toBe(51);
        expect(presets[0].name).toBe('Stereo Delay PingPong');
    });

    it('returns deleted=false for non-existent name', function() {
        const result = deleteFxPreset('NonExistent', mockLS);
        expect(result.deleted).toBe(false);
        expect(result.remaining).toBe(52);
    });
});

describe('applyFxPreset — applies preset to bridge', function() {
    it('sets type, 12 params, and gain', function() {
        const preset = { name: 'Test', type: 0.5, gain: 0.8, params: [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1.0,0.11,0.22] };
        const calls = applyFxPreset(preset, 1, { setParameter: function() {} });
        expect(calls.length).toBe(14); // type + 12 params + gain
        expect(calls[0]).toEqual(['fx1_type', 0.5]);
        expect(calls[1]).toEqual(['fx1_param1', 0.1]);
        expect(calls[12]).toEqual(['fx1_param12', 0.22]);
        expect(calls[13]).toEqual(['fx1_gain', 0.8]);
    });

    it('applies to specified slot', function() {
        const preset = { name: 'Test', type: 0.3, gain: 0.5, params: [] };
        const calls = applyFxPreset(preset, 3);
        expect(calls[0]).toEqual(['fx3_type', 0.3]);
        expect(calls[calls.length - 1]).toEqual(['fx3_gain', 0.5]);
    });

    it('handles short params array (less than 12)', function() {
        const preset = { name: 'Test', type: 0.5, gain: 1.0, params: [0.1, 0.2] };
        const calls = applyFxPreset(preset, 1);
        // Only sets param1 and param2 (2 params), then gain
        expect(calls.length).toBe(4); // type + 2 params + gain
    });

    it('handles missing gain gracefully', function() {
        const preset = { name: 'NoGain', type: 0.5, params: [] };
        const calls = applyFxPreset(preset, 1);
        expect(calls.length).toBe(1); // only type, no gain set
    });
});

describe('findMatchingFxPresetName', function() {
    beforeEach(function() {
        fxStore = {};
    });

    it('returns "Bypass" for type 0.0', function() {
        expect(findMatchingFxPresetName(0.0, 1.0, [])).toBe('Bypass');
    });

    it('matches a default preset by type, gain, and params', function() {
        // Lush Chorus-D: type=29/56≈0.5179, gain=1.0, params=[0.35,0.40,0.50,...]
        const matchType = 29 / 56.0;
        const matchParams = [0.35, 0.40, 0.50, 0.20, 0.80, 0.10, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50];
        // Need to load defaults first
        loadAllFxPresets(mockLS);
        const result = findMatchingFxPresetName(matchType, 1.0, matchParams, mockLS, []);
        expect(result).toBe('Lush Chorus-D');
    });

    it('returns null when no match found', function() {
        loadAllFxPresets(mockLS);
        const result = findMatchingFxPresetName(0.99, 1.0, [], mockLS, []);
        expect(result).toBeNull();
    });

    it('filters by gain tolerance (±0.03)', function() {
        loadAllFxPresets(mockLS);
        const matchType = 29 / 56.0;
        const matchParams = [0.35, 0.40, 0.50, 0.20, 0.80, 0.10, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50];
        // gain 0.9 doesn't match 1.0 within ±0.03
        const result = findMatchingFxPresetName(matchType, 0.9, matchParams, mockLS, []);
        expect(result).toBeNull();
    });

    it('searches factory presets after user presets', function() {
        const factoryPresets = [
            { name: 'Factory Reverb', type: 10/56.0, gain: 0.8, params: [0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5] }
        ];
        loadAllFxPresets(mockLS);
        const result = findMatchingFxPresetName(10/56.0, 0.8,
            [0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5],
            mockLS, factoryPresets);
        expect(result).toBe('Factory Reverb');
    });
});

describe('extractAndSaveNewPresetsFromBank', function() {
    let localStore;
    let userSeqPresets;
    let mockStorage;
    let loadUserSeqFn;
    let saveUserSeqFn;

    beforeEach(function() {
        localStore = {};
        userSeqPresets = [];
        mockStorage = {
            getItem: function(k) { return localStore[k] || null; },
            setItem: function(k, v) { localStore[k] = String(v); }
        };
        loadUserSeqFn = function() { return userSeqPresets; };
        saveUserSeqFn = function(p) { userSeqPresets = p; };
    });

    it('does nothing for empty patches list', function() {
        const result = extractAndSaveNewPresetsFromBank('Bank Test', [], mockStorage, [], [], loadUserSeqFn, saveUserSeqFn);
        expect(result.fxCount).toBe(0);
        expect(result.seqCount).toBe(0);
    });

    it('extracts new FX presets and Sequencer patterns from patches', function() {
        // Create a mock patch with active Ambience (type 1) and sequencer steps
        const mockBytes = new Uint8Array(242);
        mockBytes[166] = 1; // FX1 type = 1 (Ambience)
        mockBytes[218] = 255; // FX1 gain = 1.0 (255)
        for (let p = 0; p < 12; p++) {mockBytes[167 + p] = 100;} // param values

        // Non-zero sequencer steps (offsets 123 to 154)
        for (let s = 0; s < 32; s++) {mockBytes[123 + s] = s * 5;} // variable steps (max-min > 15)

        const patches = [
            { name: 'MyPatch', unpackedBytes: mockBytes }
        ];

        const result = extractAndSaveNewPresetsFromBank('Bank Test', patches, mockStorage, [], [], loadUserSeqFn, saveUserSeqFn);
        expect(result.fxCount).toBe(1);
        expect(result.seqCount).toBe(1);

        // Check that presets were saved in storage
        const savedFx = JSON.parse(localStore['abd-eep-fx-presets']);
        expect(savedFx[savedFx.length - 1].name).toBe('Ambience (MyPatch)');
        expect(userSeqPresets[0].name).toBe('MyPatch Seq');
    });

    it('does not duplicate existing factory or user presets', function() {
        const mockBytes = new Uint8Array(242);
        mockBytes[166] = 1;
        mockBytes[218] = 255;
        for (let p = 0; p < 12; p++) {mockBytes[167 + p] = 100;}

        const patches = [
            { name: 'MyPatch', unpackedBytes: mockBytes }
        ];

        // 1. First run extracts it
        const result = extractAndSaveNewPresetsFromBank('Bank Test', patches, mockStorage, [], [], loadUserSeqFn, saveUserSeqFn);
        expect(result.fxCount).toBe(1);

        // 2. Second run detects it already exists in user presets
        const result2 = extractAndSaveNewPresetsFromBank('Bank Test', patches, mockStorage, [], [], loadUserSeqFn, saveUserSeqFn);
        expect(result2.fxCount).toBe(0);
    });
});

describe('getFilteredPresetIndices — filter logic', function() {
    it('returns all 52 presets in reverse order when filterMode is "all"', function() {
        const indices = getFilteredPresetIndices(DEFAULT_FX_PRESETS, 'all', -1);
        expect(indices.length).toBe(52);
        expect(indices[0]).toBe(51);
        expect(indices[51]).toBe(0);
    });

    it('returns only type-29 presets (Lush Chorus-D) when activeType=29', function() {
        const indices = getFilteredPresetIndices(DEFAULT_FX_PRESETS, 'active', 29);
        expect(indices.length).toBe(1);
        expect(DEFAULT_FX_PRESETS[indices[0]].name).toBe('Lush Chorus-D');
    });

    it('returns only type-36 presets (Juno-106 Chorus I, Slow BBD Swirl, Ensemble Triple)', function() {
        const indices = getFilteredPresetIndices(DEFAULT_FX_PRESETS, 'active', 36);
        expect(indices.length).toBe(3);
        const names = indices.map(function(i) { return DEFAULT_FX_PRESETS[i].name; });
        expect(names).toContain('Juno-106 Chorus I');
        expect(names).toContain('Slow BBD Swirl');
        expect(names).toContain('Ensemble Triple');
    });

    it('returns empty when activeType has no matching presets', function() {
        const indices = getFilteredPresetIndices(DEFAULT_FX_PRESETS, 'active', 99);
        expect(indices.length).toBe(0);
    });

    it('returns all when filterMode is "all" regardless of activeType', function() {
        const indices = getFilteredPresetIndices(DEFAULT_FX_PRESETS, 'all', 29);
        expect(indices.length).toBe(52);
    });

    it('returns all when filterMode is "active" but activeType is -1', function() {
        const indices = getFilteredPresetIndices(DEFAULT_FX_PRESETS, 'active', -1);
        expect(indices.length).toBe(52);
    });

    it('returns only type-53 presets (Clean Hall Zita, Cathedral Long Tail)', function() {
        const indices = getFilteredPresetIndices(DEFAULT_FX_PRESETS, 'active', 53);
        expect(indices.length).toBe(2);
        const names = indices.map(function(i) { return DEFAULT_FX_PRESETS[i].name; });
        expect(names).toContain('Clean Hall Zita');
        expect(names).toContain('Cathedral Long Tail');
    });

    it('preserves reverse order within filtered results', function() {
        const indices = getFilteredPresetIndices(DEFAULT_FX_PRESETS, 'active', 39);
        expect(indices.length).toBe(3);
        expect(DEFAULT_FX_PRESETS[indices[0]].name).toBe('Self-Oscillate Trips');
        expect(DEFAULT_FX_PRESETS[indices[1]].name).toBe('Tape Slap-Back');
        expect(DEFAULT_FX_PRESETS[indices[2]].name).toBe('RE-201 Dub Echo');
    });
});
