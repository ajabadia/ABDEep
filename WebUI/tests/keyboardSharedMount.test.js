/**
 * ABDEep monta el keybed COMPARTIDO (@abdsynths/midi-keyb).
 *
 * El WebUI de ABDEep no tiene jsdom en devDependencies, asi que el contrato
 * FUNCIONAL (montaje, 49 teclas, franja con altura) lo cubre el propio paquete
 * compartido en tests/host-strip-height.test.js. Aqui queda el contrato de
 * MONTAJE del host, que es el que se rompio durante anos: la dependencia estaba
 * declarada y el keybed era propio.
 *
 *   1. js/keyboard.js (unico ESM de la app) importa el paquete y monta
 *      createKeyboard sobre #piano-keyboard con fixedOctaves (4 octavas desde
 *      C2 = 49 teclas, las de siempre) y el cableado del host intacto.
 *   2. No queda keybed propio: ni creacion de teclas, ni bucle de presion, ni
 *      referencias al contenedor viejo; los modulos que quedan leen las clases
 *      del componente (.kbd-*) y su API.
 *   3. La franja del KeyboardSection da altura DEFINIDA (185px) al contenedor.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const webui = (rel) => path.join(ROOT, 'WebUI', rel);

function read(rel) {
    return fs.readFileSync(webui(rel), 'utf8');
}

/** Todos los .js bajo WebUI/js (el keybed y sus modulos). */
function jsFiles(dir = webui('js')) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) { return jsFiles(abs); }
        return e.isFile() && e.name.endsWith('.js') ? [abs] : [];
    });
}

describe('montaje del keybed compartido', () => {
    const kbdJs = read('js/keyboard.js');
    const sectionJs = read('js/components/keyboard-section.js');
    const kbdCss = read('css/keyboard.css');
    const html = read('index.html');

    it('importa el componente compartido y monta createKeyboard', () => {
        expect(kbdJs).toContain("import { createKeyboard } from '@abdsynths/midi-keyb';");
        expect(kbdJs).toContain("import '@abdsynths/midi-keyb/keyboard.css';");
        expect(kbdJs).toContain('createKeyboard({');
        expect(kbdJs).toContain("containerId: 'piano-keyboard',");
        // El rango del host viaja en la config (no se re-acomoda por ancho).
        expect(kbdJs).toContain('numOctaves: 4,');
        expect(kbdJs).toContain('startNote: 36,');
        expect(kbdJs).toContain('fixedOctaves: true,');
    });

    it('conserva el cableado del host (bridge, ruedas, octava, LED, presion)', () => {
        expect(kbdJs).toContain('b.pianoNoteOn(note, curvedVelocity)');
        expect(kbdJs).toContain('b.pianoNoteOff(note)');
        expect(kbdJs).toContain('window._playChordMemory');
        expect(kbdJs).toContain('window._playPolyChordMemory');
        expect(kbdJs).toContain("setupWheel('wheel-pitch', true)");
        expect(kbdJs).toContain('keyboardInstance.setOctave(');
        expect(kbdJs).toContain('getLedColor:');
        expect(kbdJs).toContain('getPressureState: readPressureState');
        expect(kbdJs).toContain('window.initKeyboardAndWheels = initKeyboardAndWheels;');
    });

    it('el keybed propio ya no existe', () => {
        expect(fs.existsSync(webui('js/keyboard_pressure.js'))).toBe(false);
        const sources = jsFiles().map((abs) => fs.readFileSync(abs, 'utf8')).join('\n');
        expect(sources).not.toContain('ivory-keys-bed');
        expect(sources).not.toContain('_createKeyElement');
        expect(sources).not.toContain("classList.add('pushed')");
        expect(sources).not.toContain('--key-led-color');
    });

    it('los modulos que quedan leen el keybed compartido', () => {
        expect(read('js/keyboard_led_animations.js')).toContain('.kbd-white-key, .kbd-black-key');
        expect(read('js/keyboard_led_animations.js')).toContain('--kbd-led-color');
        expect(read('js/keyboard_active_notes.js')).toContain("'#piano-keyboard [data-note]'");
        expect(read('js/keyboard_active_notes.js')).toContain('kbd.getOctave()');
        expect(read('js/keyboard_chord_memory.js')).toContain('kbd.getActiveNotes()');
    });

    it('la franja del KeyboardSection da altura definida al contenedor', () => {
        expect(sectionJs).toContain('<div id="piano-keyboard"></div>');
        expect(kbdCss).toMatch(/\.keyboard-container \{[^}]*height: 185px/);
        expect(kbdCss).toMatch(/\.keyboard-container > #piano-keyboard \{[^}]*height: 100%/);
        // El keybed se carga como modulo (los modulos son deferred: la funcion ya
        // existe cuando script.js inicializa).
        expect(html).toContain('<script type="module" src="js/keyboard.js"></script>');
        expect(html).not.toContain('js/keyboard_pressure.js');
    });
});
