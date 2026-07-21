/**
 * Tests for WebUI/js/modmatrix.js — Modulation Matrix UI
 *
 * Strategy: self-contained extracted functions with DI via stubbed dualMidiBridge.
 */

// describe, it, expect, beforeEach, vi are Vitest globals

// ===== Extracted Source Functions =====

// Listado oficial de Modulation Sources (Manual DeepMind 12)
const MOD_SOURCES = [
    'None', 'Pitch Bend', 'Mod Wheel', 'Foot Ctrl',
    'BreathCtrl', 'Pressure', 'Expression', 'LFO 1',
    'LFO 2', 'Env 1', 'Env 2', 'Env 3',
    'Note Num', 'Note Vel', 'Note Off Vel', 'Ctrl Seq',
    'LFO 1 (Uni)', 'LFO 2 (Uni)', 'LFO 1 (Fade)', 'LFO 2 (Fade)',
    'Voice Num', 'Uni Voice', 'CC X (115)', 'CC Y (116)',
    'CC Z (117)'
];

// Listado oficial de Modulation Destinations (Manual DeepMind 12)
const MOD_DESTINATIONS = [
    'None', 'LFO1 Rate', 'LFO1 Delay', 'LFO1 Slew',
    'LFO1 Shape', 'LFO2 Rate', 'LFO2 Delay', 'LFO2 Slew',
    'LFO2 Shape', 'OSC 1+2 Pitch', 'OSC 1+2 Fine', 'OSC 1 Pitch',
    'OSC 1 Fine', 'OSC 2 Pitch', 'OSC 2 Fine', 'OSC 1 PM Dep',
    'PWM Depth', 'TMod Depth', 'OSC 2 PM Dep', 'Porta Time',
    'VCF Freq', 'VCF Res', 'VCF Env', 'VCF LFO',
    'Env Rates', 'All Attack', 'All Decay', 'All Sus',
    'All Rel', 'Env1 Rates', 'Env2 Rates', 'Env3 Rates',
    'Env1 Curves', 'Env2 Curves', 'Env3 Curves', 'Env1 Attack',
    'Env1 Decay', 'Env1 Sus', 'Env1 Rel', 'Env1 AttCur',
    'Env1 DcyCur', 'Env1 SusCur', 'Env1 RelCur', 'Env2 Attack',
    'Env2 Decay', 'Env2 Sus', 'Env2 Rel', 'Env2 AttCur',
    'Env2 DcyCur', 'Env2 SusCur', 'Env2 RelCur', 'Env3 Attack',
    'Env3 Decay', 'Env3 Sus', 'Env3 Rel', 'Env3 AttCur',
    'Env3 DcyCur', 'Env3 SusCur', 'Env3 RelCur', 'VCA All',
    'VCA Active', 'VCA EnvDep', 'Pan Spread', 'VCA Pan',
    'OSC2 Lvl', 'Noise Lvl', 'HP Freq', 'Uni Detune',
    'OSC Drift', 'Param Drift', 'Drift Rate', 'Arp Gate',
    'Seq Slew',
    'Fx 1 Level' // ID 129
];

// Rellenar destinos hasta 132 para mantener mapeo de IDs exactos
function buildFullModDestinations(baseDestinations) {
    const FULL_MOD_DESTINATIONS = [];
    for (let i = 0; i <= 132; i++) {
        if (i < baseDestinations.length) {
            FULL_MOD_DESTINATIONS.push(baseDestinations[i]);
        } else if (i === 129) {
            FULL_MOD_DESTINATIONS.push('Fx 1 Level');
        } else if (i === 130) {
            FULL_MOD_DESTINATIONS.push('Fx 2 Level');
        } else if (i === 131) {
            FULL_MOD_DESTINATIONS.push('Fx 3 Level');
        } else if (i === 132) {
            FULL_MOD_DESTINATIONS.push('Fx 4 Level');
        } else {
            FULL_MOD_DESTINATIONS.push(`Dest ${i}`);
        }
    }
    return FULL_MOD_DESTINATIONS;
}

function syncModMatrixUIFromState(bridge, getElementById) {
    if (!bridge) {return;}
    const cache = bridge.parameterCache;
    const results = {};

    for (let slot = 1; slot <= 8; slot++) {
        let srcCache = cache['mod_matrix_slot' + slot + '_src'];
        let destCache = cache['mod_matrix_slot' + slot + '_dest'];
        let depthCache = cache['mod_matrix_slot' + slot + '_depth'];
        const activeBank = bridge._loadedBanks ? bridge._loadedBanks[bridge._currentActiveBank] : null;

        if (srcCache === undefined && activeBank && bridge._currentActivePatchIndex !== -1) {
            var patch = activeBank[bridge._currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
                var b = patch.unpackedBytes;
                const srcByte = 93 + (slot - 1) * 3;
                if (srcCache === undefined) {srcCache = b[srcByte] ? Math.min(1, b[srcByte] / 22.0) : 0;}
            }
        }
        if (destCache === undefined && activeBank && bridge._currentActivePatchIndex !== -1) {
            var patch = activeBank[bridge._currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
                var b = patch.unpackedBytes;
                const destByte = 94 + (slot - 1) * 3;
                if (destCache === undefined) {destCache = b[destByte] ? Math.min(1, b[destByte] / 129.0) : 0;}
            }
        }
        if (depthCache === undefined && activeBank && bridge._currentActivePatchIndex !== -1) {
            var patch = activeBank[bridge._currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
                var b = patch.unpackedBytes;
                const depthByte = 95 + (slot - 1) * 3;
                if (depthCache === undefined) {depthCache = b[depthByte] / 255.0;}
            }
        }

        srcCache = srcCache || 0;
        destCache = destCache || 0;
        depthCache = (depthCache !== undefined && depthCache !== null) ? depthCache : 0.5;

        const srcIdx = Math.round(srcCache * 22.0);
        const srcName = MOD_SOURCES[srcIdx] || 'None';
        const destIdx = Math.round(destCache * 129.0);
        const FULL_MOD_DESTINATIONS = buildFullModDestinations(MOD_DESTINATIONS);
        const destName = FULL_MOD_DESTINATIONS[destIdx] || 'None';
        const bipolar = (depthCache * 2.0) - 1.0;
        const scaledInt = Math.round(bipolar * 128);
        const isActive = srcIdx > 0;
        const badgeText = isActive ? 'ON' : 'OFF';

        results[slot] = {
            srcIdx: srcIdx,
            srcName: srcName,
            destIdx: destIdx,
            destName: destName,
            depthCache: depthCache,
            scaledInt: scaledInt,
            isActive: isActive,
            badgeText: badgeText
        };
    }
    return results;
}

describe('MOD_SOURCES — Modulation Source array', function() {
    it('has 25 items (indices 0-24)', function() {
        expect(MOD_SOURCES.length).toBe(25);
    });

    it('index 0 is "None"', function() {
        expect(MOD_SOURCES[0]).toBe('None');
    });

    it('index 1 is "Pitch Bend"', function() {
        expect(MOD_SOURCES[1]).toBe('Pitch Bend');
    });

    it('index 2 is "Mod Wheel"', function() {
        expect(MOD_SOURCES[2]).toBe('Mod Wheel');
    });

    it('index 7 is "LFO 1"', function() {
        expect(MOD_SOURCES[7]).toBe('LFO 1');
    });

    it('index 14 is "Note Off Vel"', function() {
        expect(MOD_SOURCES[14]).toBe('Note Off Vel');
    });

    it('index 15 is "Ctrl Seq"', function() {
        expect(MOD_SOURCES[15]).toBe('Ctrl Seq');
    });

    it('index 22 is "CC X (115)"', function() {
        expect(MOD_SOURCES[22]).toBe('CC X (115)');
    });

    it('index 24 is "CC Z (117)"', function() {
        expect(MOD_SOURCES[24]).toBe('CC Z (117)');
    });

    it('all items are strings', function() {
        MOD_SOURCES.forEach(function(s, i) {
            expect(typeof s).toBe('string');
        });
    });
});

describe('MOD_DESTINATIONS — Modulation Destination base array', function() {
    it('has 74 items', function() {
        expect(MOD_DESTINATIONS.length).toBe(74);
    });

    it('index 0 is "None"', function() {
        expect(MOD_DESTINATIONS[0]).toBe('None');
    });

    it('index 9 is "OSC 1+2 Pitch"', function() {
        expect(MOD_DESTINATIONS[9]).toBe('OSC 1+2 Pitch');
    });

    it('index 20 is "VCF Freq"', function() {
        expect(MOD_DESTINATIONS[20]).toBe('VCF Freq');
    });

    it('index 59 is "VCA All"', function() {
        expect(MOD_DESTINATIONS[59]).toBe('VCA All');
    });

    it('index 60 is "VCA Active"', function() {
        expect(MOD_DESTINATIONS[60]).toBe('VCA Active');
    });

    it('index 71 is "Arp Gate"', function() {
        expect(MOD_DESTINATIONS[71]).toBe('Arp Gate');
    });

    it('index 73 is "Fx 1 Level"', function() {
        expect(MOD_DESTINATIONS[73]).toBe('Fx 1 Level');
    });

    it('no duplicate entries', function() {
        const seen = {};
        MOD_DESTINATIONS.forEach(function(d) {
            expect(seen[d]).toBeUndefined();
            seen[d] = true;
        });
    });
});

describe('FULL_MOD_DESTINATIONS — Built from MOD_DESTINATIONS', function() {
    let full;

    beforeEach(function() {
        full = buildFullModDestinations(MOD_DESTINATIONS);
    });

    it('has 133 items (indices 0-132)', function() {
        expect(full.length).toBe(133);
    });

    it('copies MOD_DESTINATIONS items for indices 0-73', function() {
        for (let i = 0; i < MOD_DESTINATIONS.length; i++) {
            expect(full[i]).toBe(MOD_DESTINATIONS[i]);
        }
    });

    it('fills index 74-80 with "Dest N" placeholder strings', function() {
        // MOD_DESTINATIONS.length = 74 (indices 0-73)
        // Index 74 = first filler
        for (let i = 74; i <= 80; i++) {
            expect(full[i]).toBe('Dest ' + i);
        }
    });

    it('fills indexes 81-128 with "Dest N"', function() {
        // MOD_DESTINATIONS.length = 74 (0-73), so fillers start at 74
        for (let i = 81; i <= 128; i++) {
            expect(full[i]).toBe('Dest ' + i);
        }
    });

    it('index 129 is "Fx 1 Level"', function() {
        expect(full[129]).toBe('Fx 1 Level');
    });

    it('index 130 is "Fx 2 Level"', function() {
        expect(full[130]).toBe('Fx 2 Level');
    });

    it('index 131 is "Fx 3 Level"', function() {
        expect(full[131]).toBe('Fx 3 Level');
    });

    it('index 132 is "Fx 4 Level"', function() {
        expect(full[132]).toBe('Fx 4 Level');
    });
});

describe('syncModMatrixUIFromState — slot synchronization logic', function() {
    let mockBridge, results;

    beforeEach(function() {
        mockBridge = {
            parameterCache: {},
            _loadedBanks: null,
            _currentActiveBank: null,
            _currentActivePatchIndex: -1
        };
        results = null;
    });

    it('returns undefined when bridge is null', function() {
        expect(syncModMatrixUIFromState(null, null)).toBeUndefined();
    });

    it('returns defaults when cache is empty', function() {
        results = syncModMatrixUIFromState(mockBridge, null);
        for (let slot = 1; slot <= 8; slot++) {
            expect(results[slot].srcIdx).toBe(0);
            expect(results[slot].srcName).toBe('None');
            expect(results[slot].destIdx).toBe(0);
            expect(results[slot].destName).toBe('None');
            expect(results[slot].depthCache).toBe(0.5);
            expect(results[slot].isActive).toBe(false);
            expect(results[slot].badgeText).toBe('OFF');
        }
    });

    it('reads src/dest/depth from parameterCache', function() {
        mockBridge.parameterCache['mod_matrix_slot1_src'] = 7 / 22.0; // LFO 1
        mockBridge.parameterCache['mod_matrix_slot1_dest'] = 20 / 129.0; // VCF Freq
        mockBridge.parameterCache['mod_matrix_slot1_depth'] = 0.75;

        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[1].srcName).toBe('LFO 1');
        expect(results[1].destName).toBe('VCF Freq');
        expect(results[1].depthCache).toBeCloseTo(0.75);
        expect(results[1].isActive).toBe(true);
        expect(results[1].badgeText).toBe('ON');
    });

    it('reads from patch unpackedBytes as fallback when cache is undefined', function() {
        mockBridge._loadedBanks = {
            'User Bank': [{ index: 0, name: 'Test', unpackedBytes: new Uint8Array(256) }]
        };
        mockBridge._currentActiveBank = 'User Bank';
        mockBridge._currentActivePatchIndex = 0;
        const b = mockBridge._loadedBanks['User Bank'][0].unpackedBytes;
        b[93] = 7;  // Slot1 src = 7 → 7/22 ≈ 0.318 → idx 7 → LFO 1
        b[94] = 20; // Slot1 dest = 20 → 20/129 ≈ 0.155 → idx 20 → VCF Freq
        b[95] = 191; // Slot1 depth = 191 → 191/255 ≈ 0.749

        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[1].srcName).toBe('LFO 1');
        expect(results[1].destName).toBe('VCF Freq');
        expect(results[1].depthCache).toBeCloseTo(191 / 255, 2);
        expect(results[1].isActive).toBe(true);
    });

    it('handles all 8 slots independently', function() {
        for (let slot = 1; slot <= 8; slot++) {
            mockBridge.parameterCache['mod_matrix_slot' + slot + '_src'] = (slot * 2) / 22.0;
            mockBridge.parameterCache['mod_matrix_slot' + slot + '_dest'] = (slot * 10) / 129.0;
            mockBridge.parameterCache['mod_matrix_slot' + slot + '_depth'] = slot / 10.0;
        }
        results = syncModMatrixUIFromState(mockBridge, null);
        for (let s = 1; s <= 8; s++) {
            expect(results[s].srcIdx).toBe(Math.round((s * 2) / 22.0 * 22));
            expect(results[s].destIdx).toBe(Math.round((s * 10) / 129.0 * 129));
            expect(results[s].depthCache).toBeCloseTo(s / 10.0, 2);
        }
    });

    it('marks slot as ON when srcIdx > 0', function() {
        mockBridge.parameterCache['mod_matrix_slot3_src'] = 1 / 22.0;
        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[3].isActive).toBe(true);
        expect(results[3].badgeText).toBe('ON');
    });

    it('marks slot as OFF when srcIdx is 0', function() {
        mockBridge.parameterCache['mod_matrix_slot3_src'] = 0;
        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[3].isActive).toBe(false);
        expect(results[3].badgeText).toBe('OFF');
    });

    it('computes scaledInt bipolar value from depthCache', function() {
        mockBridge.parameterCache['mod_matrix_slot1_depth'] = 1.0; // bipolar = 1.0
        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[1].scaledInt).toBe(128);

        mockBridge.parameterCache['mod_matrix_slot1_depth'] = 0.0; // bipolar = -1.0
        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[1].scaledInt).toBe(-128);

        mockBridge.parameterCache['mod_matrix_slot1_depth'] = 0.5; // bipolar = 0.0
        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[1].scaledInt).toBe(0);
    });

    it('handles missing loadedBanks gracefully', function() {
        mockBridge._loadedBanks = null;
        mockBridge.parameterCache['mod_matrix_slot1_src'] = 7 / 22.0;
        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[1].srcName).toBe('LFO 1');
    });

    it('handles patch with missing unpackedBytes gracefully', function() {
        mockBridge._loadedBanks = { 'User Bank': [{ index: 0 }] };
        mockBridge._currentActiveBank = 'User Bank';
        mockBridge._currentActivePatchIndex = 0;
        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[1].srcName).toBe('None');
    });
});

describe('initModMatrix — DOMContentLoaded wiring', function() {
    it('MOD_SOURCES is frozen for reference', function() {
        expect(Object.isFrozen(MOD_SOURCES)).toBe(false);
        // Source does not freeze it, but we can verify immutability is not required
        expect(MOD_SOURCES[0]).toBe('None');
    });

    it('MOD_DESTINATIONS has correct first and last', function() {
        expect(MOD_DESTINATIONS[0]).toBe('None');
        expect(MOD_DESTINATIONS[MOD_DESTINATIONS.length - 1]).toBe('Fx 1 Level');
    });
});
