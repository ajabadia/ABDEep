import { describe, it, expect, beforeEach} from 'vitest';
/**
 * Tests for WebUI/js/modmatrix.js — Modulation Matrix UI
 *
 * Strategy: self-contained extracted functions with DI via stubbed dualMidiBridge.
 */

// describe, it, expect, beforeEach, vi are Vitest globals

// ===== Extracted Source Functions =====

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// Y POR QUE LAS TABLAS SE LEEN DEL FICHERO REAL Y NO SE COPIAN AQUI. Este
// fichero guarda una copia de `MOD_SOURCES` y `MOD_DESTINATIONS` para no
// depender del DOM, y esa copia es una SEGUNDA VERDAD: se queda vieja en
// silencio. Todas vez que el dato real cambio, estos tests siguieron en verde
// afirmando `index 73 is "Fx 1 Level"` sobre una tabla que ya no existe, y el
// guard que si vigila la tabla de verdad (`modMatrixTables.test.js`) no podia
// verlo porque aqui no se mira la de verdad.
//
// El sandbox carga los dos ficheros en el MISMO orden que `index.html`: la
// vista de grafos primero, porque sus accesores leen la tabla del dato.
function loadMatrixTables() {
    const sandbox = { window: {}, console: { warn() {} } };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    sandbox.module = undefined;   // se carga como script clasico, no como modulo
    vm.createContext(sandbox);
    vm.runInContext(
        fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'components', 'mod-matrix-canvas_data.js'), 'utf8'),
        sandbox,
    );
    vm.runInContext(
        fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'modmatrix_data.js'), 'utf8'),
        sandbox,
    );
    return sandbox;
}

const matrices = loadMatrixTables();
const MOD_SOURCES = matrices.MOD_SOURCES;
const MOD_DESTINATIONS = matrices.MOD_DESTINATIONS;
const FULL_MOD_DESTINATIONS = matrices.FULL_MOD_DESTINATIONS;

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
const patch = activeBank[bridge._currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
const b = patch.unpackedBytes;
                const srcByte = 93 + (slot - 1) * 3;
                if (srcCache === undefined) {srcCache = b[srcByte] ? Math.min(1, b[srcByte] / 22.0) : 0;}
            }
        }
        if (destCache === undefined && activeBank && bridge._currentActivePatchIndex !== -1) {
const patch = activeBank[bridge._currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
const b = patch.unpackedBytes;
                const destByte = 94 + (slot - 1) * 3;
                if (destCache === undefined) {destCache = b[destByte] ? Math.min(1, b[destByte] / 129.0) : 0;}
            }
        }
        if (depthCache === undefined && activeBank && bridge._currentActivePatchIndex !== -1) {
const patch = activeBank[bridge._currentActivePatchIndex];
            if (patch && patch.unpackedBytes) {
const b = patch.unpackedBytes;
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
    it('cubre el rango de fuentes que declara el byte', function() {
        // `docs/sysex_format.md`: el byte 93 (Mod Slot 1 Source) va de 0 a 22.
        // Antes este test afirmaba 25 (indices 0-24), un numero que no sale de
        // ningun sitio: el hardware de fabrica solo ejerce 0-19.
        expect(MOD_SOURCES.length).toBeGreaterThanOrEqual(23);
        expect(MOD_SOURCES[0]).toBe('None');
        expect(MOD_SOURCES[22]).toBeDefined();
    });

    it('index 0 is "None"', function() {
        expect(MOD_SOURCES[0]).toBe('None');
    });

    // El orden de esta tabla es el del enum `ModSource` del motor, que es el que
    // suena: `SynthEngine_Parameters.cpp` castea el byte crudo al enum, asi que
    // el indice N de la tabla tiene que ser el codigo N del motor o la UI miente
    // sobre lo que hace el motor.
    //
    // Estas aserciones afirmaban el orden ANTERIOR (Pitch Bend en 1, Mod Wheel en
    // 2, LFO 1 en 7) y situaban `CC Z` en el indice 24 — que el byte no alcanza,
    // porque el byte 93 (Mod Slot 1 Source) va de 0 a 22. Eran restos de la tabla
    // de 25 entradas anterior a la renumeracion, no una medida: un indice que el
    // cable no puede pedir no puede ser el correcto.
    it('index 1 is "LFO 1" (el codigo 1 del motor)', function() {
        expect(MOD_SOURCES[1]).toBe('LFO 1');
    });

    it('index 2 is "LFO 2"', function() {
        expect(MOD_SOURCES[2]).toBe('LFO 2');
    });

    it('index 7 is "Env 3"', function() {
        expect(MOD_SOURCES[7]).toBe('Env 3');
    });

    it('index 14 is "Foot Ctrl"', function() {
        expect(MOD_SOURCES[14]).toBe('Foot Ctrl');
    });

    it('index 15 is "Expression"', function() {
        expect(MOD_SOURCES[15]).toBe('Expression');
    });

    it('index 22 is "CC Z (117)", el ultimo codigo que el byte alcanza', function() {
        expect(MOD_SOURCES[22]).toBe('CC Z (117)');
    });

    it('la tabla no pasa del byte: no hay indice 24', function() {
        expect(MOD_SOURCES.length).toBe(23);
        expect(MOD_SOURCES[24]).toBeUndefined();
    });

    it('all items are strings', function() {
        MOD_SOURCES.forEach(function(s, i) {
            expect(typeof s).toBe('string');
        });
    });
});

describe('MOD_DESTINATIONS — Modulation Destination base array', function() {
    it('has 73 items (the synthesis block, 0-72)', function() {
        // 73, no 74. El bloque de sintesis del manual acaba en el 72 ('Seq
        // Slew'); lo que hay de 73 en adelante es meta-modulacion y efectos, y
        // lo anade `FULL_MOD_DESTINATIONS` con su propia cuenta.
        expect(MOD_DESTINATIONS.length).toBe(73);
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

    it('el ultimo es "Seq Slew" en el 72, y el 73 ya no es de esta lista', function() {
        // El 73 fue `Fx 1 Level` con el comentario `// ID 129`: el nombre del
        // 129 viviendo en el 73. Ese nombre es el del 129 y solo del 129.
        expect(MOD_DESTINATIONS[72]).toBe('Seq Slew');
        expect(MOD_DESTINATIONS[73]).toBeUndefined();
    });

    it('no duplicate entries', function() {
        const seen = {};
        MOD_DESTINATIONS.forEach(function(d) {
            expect(seen[d]).toBeUndefined();
            seen[d] = true;
        });
    });
});

describe('FULL_MOD_DESTINATIONS — el rango entero del byte de destino', function() {
    const full = FULL_MOD_DESTINATIONS;

    it('has 133 items (indices 0-132)', function() {
        expect(full.length).toBe(133);
    });

    it('copies MOD_DESTINATIONS items for indices 0-72', function() {
        for (let i = 0; i < MOD_DESTINATIONS.length; i++) {
            expect(full[i]).toBe(MOD_DESTINATIONS[i]);
        }
    });

    it('73-80 son la profundidad de los ocho buses', function() {
        // Antes eran ocho rellenos `Dest N`: el bloque de fx de ocho destinos
        // ocupaba justo aqui y el 73 era `Fx 1 Level`, el nombre del 129.
        for (let i = 73; i <= 80; i++) {
            expect(full[i]).toBe('Mod ' + (i - 72) + ' Depth');
        }
    });

    it('81-128 son los cuarenta y ocho parametros de efecto, por la cuenta del manual', function() {
        // El codigo NO se lee de la tabla: se cuenta como lo cuenta el manual,
        // `80 + (hueco - 1) * 12 + parametro`. Si alguien cambia el 12 por otro
        // numero en el enum, este test lo ve.
        let contados = 0;
        for (let hueco = 1; hueco <= 4; hueco++) {
            for (let param = 1; param <= 12; param++) {
                expect(full[80 + (hueco - 1) * 12 + param]).toBe(
                    'FX ' + hueco + ' Param ' + param,
                );
                contados++;
            }
        }
        expect(contados).toBe(48);
    });

    it('129-132 son los cuatro niveles de hueco', function() {
        expect(full[129]).toBe('FX 1 Level');
        expect(full[130]).toBe('FX 2 Level');
        expect(full[131]).toBe('FX 3 Level');
        expect(full[132]).toBe('FX 4 Level');
    });

    it('ningun codigo se queda con el nombre de relleno `Dest N`', function() {
        // La regla del plan: lo que el manual no nombre se queda como `Dest N`,
        // y con la guia de parametros encima no queda ni uno. Si manana se
        // anaden codigos sin nombre, este falla con el codigo en vez de dejar que
        // `Dest N` llegue a la lista sin que nadie mire.
        const rellenos = full
            .map(function(nombre, codigo) {
                return nombre === 'Dest ' + codigo ? codigo : -1;
            })
            .filter(function(codigo) {
                return codigo >= 0;
            });
        expect(rellenos).toEqual([]);
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
        mockBridge.parameterCache['mod_matrix_slot1_src'] = 7 / 22.0; // codigo 7 = Env 3
        mockBridge.parameterCache['mod_matrix_slot1_dest'] = 20 / 129.0; // VCF Freq
        mockBridge.parameterCache['mod_matrix_slot1_depth'] = 0.75;

        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[1].srcName).toBe('Env 3');
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
        b[93] = 7;  // Slot1 src = 7 → 7/22 ≈ 0.318 → idx 7 → Env 3 (codigo 7 del motor)
        b[94] = 20; // Slot1 dest = 20 → 20/129 ≈ 0.155 → idx 20 → VCF Freq
        b[95] = 191; // Slot1 depth = 191 → 191/255 ≈ 0.749

        results = syncModMatrixUIFromState(mockBridge, null);
        expect(results[1].srcName).toBe('Env 3');
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
        expect(results[1].srcName).toBe('Env 3');
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
        // El ultimo del bloque de sintesis es el 72. El `Fx 1 Level` de antes
        // vivia en el 73 con el comentario `// ID 129`, y ese nombre es el del
        // 129: en la tabla entera esta en el 129, y solo ahi.
        expect(MOD_DESTINATIONS[0]).toBe('None');
        expect(MOD_DESTINATIONS[MOD_DESTINATIONS.length - 1]).toBe('Seq Slew');
        expect(FULL_MOD_DESTINATIONS[129]).toBe('FX 1 Level');
    });
});
