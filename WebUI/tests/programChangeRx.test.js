/**
 * programChangeRx.test.js — handler MIDI Program Change / Bank Select
 * (WebUI/js/program_change_rx.js).
 *
 * Carga el archivo REAL en un sandbox (cualquier SyntaxError hace fallar el
 * suite — regresión del bug "'" : ''' que dejaba el handler muerto en el
 * navegador) y verifica:
 *   1) exports (_onProgramChanged, _onBankLoadFailed, _onStateRestored)
 *   2) rechazo de argumentos inválidos (sin cambio de estado)
 *   3) path fallback sin banco cargado (globals + LCD)
 *   4) path completo con banco cargado (renderPatchesForBank, bind, monitor, LCD)
 *   5) alert en _onBankLoadFailed
 *   6) _onStateRestored: no-op sin args, reenvío con args
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const FILE = path.join(ROOT, 'WebUI', 'js', 'program_change_rx.js');

/** Elemento DOM mínimo con innerHTML/innerText/style. */
function makeEl(initial) {
    const el = {
        innerHTML: '',
        innerText: '',
        style: { display: '' },
    };
    Object.assign(el, initial || {});
    return el;
}

/** Carga program_change_rx.js real en un sandbox; devuelve window + hooks. */
function loadRx() {
    const code = fs.readFileSync(FILE, 'utf8');
    const warned = [];
    const alerted = [];
    const elements = {};
    const win = {
        console: {
            log: () => {},
            warn: (msg) => warned.push(String(msg)),
            error: () => {},
        },
        alert: (msg) => alerted.push(String(msg)),
    };
    const document = {
        getElementById: (id) => elements[id] || (elements[id] = makeEl()),
    };
    // eslint-disable-next-line no-new-func
    const fn = new Function('window', 'document', 'alert', 'console', code + '\n;return window;');
    const result = fn(win, document, win.alert, win.console);
    return { win: result, elements, warned, alerted };
}

describe('program_change_rx.js — exports', () => {
    it('carga sin SyntaxError y define los 3 handlers globales', () => {
        const { win } = loadRx();
        expect(typeof win._onProgramChanged).toBe('function');
        expect(typeof win._onBankLoadFailed).toBe('function');
        expect(typeof win._onStateRestored).toBe('function');
    });
});

describe('_onProgramChanged — validación', () => {
    it('rechaza banco inválido y prog no entero sin tocar el estado', () => {
        const { win, warned } = loadRx();
        win.currentActiveBank = 'Factory Bank A';
        win.currentActivePatchIndex = 0;
        win._onProgramChanged('ZZ', 'not-a-number');
        expect(win.currentActiveBank).toBe('Factory Bank A');
        expect(win.currentActivePatchIndex).toBe(0);
        expect(warned.length).toBe(1);
        expect(warned[0]).toContain('ignorado');

        win._onProgramChanged('A', 200); // idx >= 128
        expect(win.currentActiveBank).toBe('Factory Bank A');
        expect(win.currentActivePatchIndex).toBe(0);
    });

    it('path fallback sin banco cargado: actualiza globals y LCD fallback', () => {
        const { win, elements } = loadRx();
        win._onProgramChanged('A', 5);
        expect(win.currentActiveBank).toBe('Factory Bank A');
        expect(win.currentActivePatchIndex).toBe(5);
        const lcd = elements['lcd-text'];
        expect(lcd.innerHTML).toContain('Bank A Patch 6');
        expect(lcd.innerHTML).toContain('Factory Bank A');
    });

    it('path completo con banco cargado: sincroniza UI, bind y monitor', () => {
        const { win, elements } = loadRx();
        win.loadedBanks = {
            'Factory Bank B': { 7: { name: 'TEST PATCH B7', unpackedBytes: [1, 2] } },
        };
        const rendered = [];
        let bound = false;
        let monitor = false;
        win.renderPatchesForBank = (bankName) => rendered.push(bankName);
        win.bindAllPanelControls = () => { bound = true; };
        win.updateSysExMonitor = (bytes) => { monitor = bytes.length > 0; };

        win._onProgramChanged('b', 7); // minúscula → normaliza
        expect(win.currentActiveBank).toBe('Factory Bank B');
        expect(win.currentActivePatchIndex).toBe(7);
        expect(rendered).toEqual(['Factory Bank B']);
        expect(bound).toBe(true);
        expect(monitor).toBe(true);
        expect(elements['lcd-text'].innerHTML).toContain('TEST PATCH B7');
        expect(elements['sysex-active-patch-label'].innerText).toContain('TEST PATCH B7');
    });

    it('escapado HTML del nombre de patch (XSS)', () => {
        const { win, elements } = loadRx();
        win.loadedBanks = {
            'Factory Bank A': { 0: { name: '<img src=x onerror=alert(1)>', unpackedBytes: [0] } },
        };
        win.renderPatchesForBank = () => {};
        win.bindAllPanelControls = () => {};
        win.updateSysExMonitor = () => {};
        win._onProgramChanged('A', 0);
        const lcd = elements['lcd-text'].innerHTML;
        // El nombre se escapa y luego se pasa a toUpperCase() en el LCD
        expect(lcd).not.toContain('<img');
        expect(lcd).toMatch(/&lt;img/i);
    });
});

describe('_onBankLoadFailed / _onStateRestored', () => {
    it('_onBankLoadFailed muestra alert con banco y razón', () => {
        const { win, alerted } = loadRx();
        win._onBankLoadFailed('c', 'SIMULATED FAILURE');
        expect(alerted.length).toBe(1);
        expect(alerted[0]).toContain('Factory Bank C');
        expect(alerted[0]).toContain('SIMULATED FAILURE');
    });

    it('_onStateRestored: no-op sin args, reenvía con args', () => {
        const { win } = loadRx();
        win._onProgramChanged('B', 7);
        win._onStateRestored(undefined, undefined);
        expect(win.currentActiveBank).toBe('Factory Bank B');
        expect(win.currentActivePatchIndex).toBe(7);

        win._onStateRestored('D', 12);
        expect(win.currentActiveBank).toBe('Factory Bank D');
        expect(win.currentActivePatchIndex).toBe(12);
    });
});