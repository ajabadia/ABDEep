/**
 * generate_parity_fixture.js — Fase: Paridad C++ ↔ JS del Program Dump de 291 bytes.
 *
 * Emite schemas/parity_program_dump_291.json: el mensaje SysEx canónico de 291 bytes
 * que buildSingleSysex (WebUI/js/browser_packer.js) produce para un patch
 * determinista de 242 bytes, con una cabecera explícita (deviceId/bank/program).
 *
 * Este fixture es la fuente de verdad compartida del test de paridad:
 *   - C++  : MidiTranslationEngine::createProgramDumpSysex debe emitir EXACTAMENTE
 *            estos bytes para el mismo patch + cabecera (ver SynthEngineUnitTests_CalSpec.cpp).
 *   - JS   : buildSingleSysex debe emitir EXACTAMENTE estos bytes (ver parityProgramDump.test.js).
 *
 * Uso:
 *   node scripts/generate_parity_fixture.js            # regenera el fixture
 *   node scripts/generate_parity_fixture.js --check    # solo verifica que el commiteado está al día
 *
 * NOTA: la fórmula del patch (patch[i] = (i*37 + 11) & 0xFF) y la cabecera
 * (deviceId=0x7F, bank=2, program=10) DEBEN coincidir con las del test C++
 * (SynthEngineUnitTests_CalSpec.cpp) y con las del test JS (parityProgramDump.test.js).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'schemas', 'parity_program_dump_291.json');

// ── Parámetros de paridad (compartidos con los tests C++ y JS) ──
const PATCH_FORMULA = 'patch[i] = (i * 37 + 11) & 0xFF para i en [0, 242)';
const HEADER = { deviceId: 0x7F, bank: 2, program: 10 };

function buildPatch() {
    const patch = new Uint8Array(242);
    for (let i = 0; i < 242; i++) {
        patch[i] = (i * 37 + 11) & 0xFF;
    }
    return patch;
}

function toHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Carga browser_packer.js real en un sandbox window (patrón de registry_generator.js)
function loadBrowserPacker() {
    const code = fs.readFileSync(path.join(ROOT, 'WebUI', 'js', 'browser_packer.js'), 'utf8');
    const sandbox = { window: {} };
    const fn = new Function('window', code + '\n;return window;');
    return fn(sandbox.window);
}

function computeFixture() {
    const win = loadBrowserPacker();
    const patch = buildPatch();
    const syx = win.buildSingleSysex({ unpackedBytes: patch }, HEADER.bank, HEADER.program, HEADER.deviceId);
    if (syx.length !== 291) {
        throw new Error('buildSingleSysex no emitió 291 bytes (emitió ' + syx.length + ')');
    }
    return {
        schemaVersion: 1,
        description: 'Parity fixture: createProgramDumpSysex (C++) y buildSingleSysex (JS) deben emitir exactamente los mismos 291 bytes para el mismo patch de 242 bytes.',
        patchFormula: PATCH_FORMULA,
        header: HEADER,
        patchHex: toHex(patch),
        expected291Hex: toHex(syx),
        generatedAt: new Date().toISOString(),
        source: 'WebUI/js/browser_packer.js::buildSingleSysex (generado por scripts/generate_parity_fixture.js)',
    };
}

function main() {
    const checkOnly = process.argv.includes('--check');
    const fixture = computeFixture();

    if (checkOnly) {
        if (!fs.existsSync(OUT)) {
            console.error('FIXTURE MISSING: ' + OUT);
            process.exit(1);
        }
        const committed = JSON.parse(fs.readFileSync(OUT, 'utf8'));
        const contentSame =
            committed.patchHex === fixture.patchHex &&
            committed.expected291Hex === fixture.expected291Hex &&
            JSON.stringify(committed.header) === JSON.stringify(fixture.header);
        if (!contentSame) {
            console.error('FIXTURE STALE: el fixture commiteado no coincide con la salida actual de buildSingleSysex. Ejecuta: node scripts/generate_parity_fixture.js');
            process.exit(1);
        }
        console.log('[parity] OK — fixture al día (291 bytes, ' + fixture.expected291Hex.length / 2 + ' bytes)');
        return;
    }

    const out = JSON.stringify(fixture, null, 2) + '\n';
    fs.writeFileSync(OUT, out, 'utf8');
    console.log('[parity] Fixture escrito en ' + path.relative(ROOT, OUT));
    console.log('[parity] patchHex      = ' + fixture.patchHex);
    console.log('[parity] expected291   = ' + fixture.expected291Hex);
    console.log('[parity] longitud      = ' + fixture.expected291Hex.length / 2 + ' bytes');
}

main();
