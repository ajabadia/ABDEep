/**
 * @purpose Montaje del keybed COMPARTIDO de la suite (@abdsynths/midi-keyb) en
 * ABDEep: configuracion "full experience" (marfil por tecla, desplazamiento por
 * pitch bend, display de presion, color de LED por modo) + el enrutado de notas
 * del host (bridge JUCE o simulador, arp/seq, chord memory) y las ruedas de
 * Pitch/Mod y los botones de octava del chasis.
 * @purpose_en ABDEep mount of the shared keyboard component.
 *
 * Es el UNICO modulo ESM de la app (el WebView2 de JUCE 8 sirve ESM); el resto
 * de la UI son scripts clasicos que siguen llamando a
 * window.initKeyboardAndWheels() en DOMContentLoaded (los modulos son deferred,
 * asi que la funcion ya existe cuando el evento dispara).
 *
 * El keybed propio que vivia aqui (creacion de teclas, listeners, presion) lo
 * sustituye el componente compartido; lo que queda es el CABLEADO del host.
 */
import { createKeyboard } from '@abdsynths/midi-keyb';
import '@abdsynths/midi-keyb/keyboard.css';

let keyboardInstance = null;

/** Bridge canonico (bridge-dual.js). */
function bridge() {
    return typeof getBridge === 'function' ? getBridge() : null;
}

/**
 * Curva de velocity del host (Settings > Velocity, en localStorage). El
 * componente entrega la velocity cruda por posicion Y y la curva se aplica aqui
 * en cada nota, para que cambiar el ajuste no exija recrear el keybed.
 */
function hostVelocityCurve(rawVelocity) {
    let curve = 'normal';
    try {
        curve = localStorage.getItem('abd-eep-velocity-curve') || 'normal';
    } catch (e) { /* almacenamiento bloqueado: curva neutra */ }

    let velocity = rawVelocity;
    if (curve === 'soft') { velocity = rawVelocity * rawVelocity; }
    else if (curve === 'hard') { velocity = Math.sqrt(rawVelocity); }
    else if (curve === 'linear') { velocity = rawVelocity; }
    else if (curve === 'fixed') { velocity = 100 / 127; }
    return Math.max(0.01, Math.min(1.0, velocity));
}

/**
 * Estado de presion (aftertouch / modwheel / pitchbend) que el componente pinta
 * sobre las teclas mantenidas. Mismo origen que el viejo keyboard_pressure.js:
 * el estado de voces del bridge nativo o el cache de parametros del simulador,
 * con las curvas de control del host aplicadas.
 */
function readPressureState() {
    const b = bridge();
    let aftertouch = 0.0;
    let modWheel = 0.0;
    let pitchBend = 0.0;

    if (b) {
        if (b.isJuce) {
            if (b._lastVoiceStateRaw) {
                aftertouch = b._lastVoiceStateRaw.aftertouch !== undefined ? b._lastVoiceStateRaw.aftertouch : 0.0;
                modWheel = b._lastVoiceStateRaw.modWheel !== undefined ? b._lastVoiceStateRaw.modWheel : 0.0;
                pitchBend = b._lastVoiceStateRaw.pitchBend !== undefined ? b._lastVoiceStateRaw.pitchBend : 0.0;
            }
        } else if (b.parameterCache) {
            aftertouch = b.parameterCache['aftertouch'] !== undefined ? b.parameterCache['aftertouch'] : 0.0;
            modWheel = b.parameterCache['mod_wheel'] !== undefined ? b.parameterCache['mod_wheel'] : 0.0;
        }
    }

    aftertouch = Math.max(0, Math.min(1, aftertouch));
    modWheel = Math.max(0, Math.min(1, modWheel));
    pitchBend = Math.max(-1, Math.min(1, pitchBend));

    if (typeof window.applyControllerCurve === 'function' && typeof window.getControllerCurve === 'function') {
        aftertouch = window.applyControllerCurve(aftertouch, window.getControllerCurve('aftertouch'));
        modWheel = window.applyControllerCurve(modWheel, window.getControllerCurve('modwheel'));
    }
    if (typeof window.applyBipolarCurve === 'function' && typeof window.getControllerCurve === 'function') {
        pitchBend = window.applyBipolarCurve(pitchBend, window.getControllerCurve('pitchbend'));
    }

    return { aftertouch, modWheel, pitchBend };
}

/** Ruedas de octava del chasis: el componente es el dueno del desplazamiento. */
function syncOctaveShift() {
    const octave = (keyboardInstance && typeof keyboardInstance.getOctave === 'function')
        ? keyboardInstance.getOctave() : 0;
    const semitones = octave * 12;
    window._currentOctaveShift = semitones;

    const up = document.getElementById('oct-up-btn');
    const down = document.getElementById('oct-down-btn');
    if (typeof window._renderOctaveButtons === 'function') {
        window._renderOctaveButtons(up, down, semitones);
    }
    if (typeof window._updateOctaveLcd === 'function') {
        window._updateOctaveLcd(semitones);
    }
}

function setupHostOctaveButtons() {
    const up = document.getElementById('oct-up-btn');
    const down = document.getElementById('oct-down-btn');

    if (up) {
        up.addEventListener('click', () => {
            keyboardInstance.setOctave(keyboardInstance.getOctave() + 1);
            syncOctaveShift();
        });
    }
    if (down) {
        down.addEventListener('click', () => {
            keyboardInstance.setOctave(keyboardInstance.getOctave() - 1);
            syncOctaveShift();
        });
    }
    syncOctaveShift();
}

/**
 * Ruedas PITCH/MOD del chasis (sprites y slots del KeyboardSection). No son las
 * del componente compartido: ABDEep las mando por MIDI directo al bridge.
 */
function setupHostWheels() {
    const setupWheel = (wheelId, isPitch) => {
        const slot = document.getElementById(wheelId);
        if (!slot) { return; }
        const wheel = slot.querySelector('.wheel');
        if (!wheel) { return; }
        let isMoving = false;

        const updateWheel = (clientY) => {
            const rect = slot.getBoundingClientRect();
            let pct = 1.0 - (clientY - rect.top) / rect.height;
            pct = Math.max(0, Math.min(1, pct));

            const wheelHeight = 40;
            const pos = (1.0 - pct) * (rect.height - wheelHeight);
            wheel.style.bottom = (rect.height - wheelHeight - pos) + 'px';

            const b = bridge();
            if (b && b.midiOutput) {
                const statusByte = (isPitch ? 0xE0 : 0xB0) | (b.midiChannel - 1);
                if (isPitch) {
                    const bendVal = Math.round(pct * 16383);
                    const lsb = bendVal & 0x7F;
                    const msb = (bendVal >> 7) & 0x7F;
                    b.midiOutput.send([statusByte, lsb, msb]);
                } else {
                    const modVal = Math.round(pct * 127);
                    b.midiOutput.send([statusByte, 1, modVal]);
                }
            }
        };

        const rectCenterY = (el) => {
            const r = el.getBoundingClientRect();
            return r.top + (r.height / 2);
        };

        slot.addEventListener('pointerdown', (e) => {
            isMoving = true;
            slot.setPointerCapture(e.pointerId);
            updateWheel(e.clientY);
        });

        slot.addEventListener('pointermove', (e) => {
            if (isMoving) { updateWheel(e.clientY); }
        });

        slot.addEventListener('pointerup', () => {
            isMoving = false;
            if (isPitch) {
                updateWheel(rectCenterY(slot));
            }
        });
    };

    setupWheel('wheel-pitch', true);
    setupWheel('wheel-mod', false);
}

/**
 * Monta el keybed compartido sobre #piano-keyboard (franja de 185px del
 * KeyboardSection). Sin contenedor no hay keybed: el componente devuelve su
 * stub de no-op, asi que se evita llamarlo.
 */
function initKeyboardAndWheels() {
    if (keyboardInstance) { return; }
    const container = document.getElementById('piano-keyboard');
    if (!container) { return; }

    keyboardInstance = createKeyboard({
        containerId: 'piano-keyboard',
        onNoteOn: (note, velocity) => {
            const b = bridge();
            if (!b) { return; }
            const curvedVelocity = hostVelocityCurve(velocity);

            if (b._seqEngine && (b.parameterCache['seq_enable'] || 0) > 0.5) {
                b._seqEngine.addHeldNote(note, curvedVelocity);
            }

            if (typeof window._playPolyChordMemory === 'function') {
                const polyHandled = window._playPolyChordMemory(note, curvedVelocity);
                if (polyHandled) { return; }
            }

            if (typeof window._playChordMemory === 'function') {
                const handled = window._playChordMemory(note, curvedVelocity);
                if (handled) { return; }
            }

            if (b._arpEngine && (b.parameterCache['arp_enable'] || 0) > 0.5) {
                b._arpEngine.addHeldNote(note, curvedVelocity);
                return;
            }

            b.pianoNoteOn(note, curvedVelocity);
        },
        onNoteOff: (note) => {
            const b = bridge();
            if (!b) { return; }

            if (b._seqEngine && (b.parameterCache['seq_enable'] || 0) > 0.5) {
                b._seqEngine.removeHeldNote(note);
            }

            if (typeof window._stopPolyChordMemory === 'function') {
                window._stopPolyChordMemory(note);
            }
            if (typeof window._stopChordMemory === 'function') {
                window._stopChordMemory(note);
            }

            if (b._arpEngine && (b.parameterCache['arp_enable'] || 0) > 0.5) {
                b._arpEngine.removeHeldNote(note);
                return;
            }

            b.pianoNoteOff(note);
        },
        onPanic: () => {
            const b = bridge();
            if (b && typeof b.panic === 'function') { b.panic(); }
        },
        onOctaveChange: () => { syncOctaveShift(); },
        config: {
            numOctaves: 4,
            startNote: 36,            // C2, el rango de siempre del keybed ABDEep
            fixedOctaves: true,       // el layout no depende del ancho disponible
            maxOctaveShift: 3,        // los botones del chasis llegan a +/-3 octavas
            velocitySource: 'yPosition',
            velocityCurve: 'linear',  // la curva del host se aplica en onNoteOn
            enablePressureDisplay: true,
            enablePitchBendDisplace: true,
            enableIvoryTexture: true,
            enableQwerty: true,
            enableTouch: true,
            enableResizeObserver: false,
            // El chord memory de ABDEep es del MOTOR (parametros chord_*), no del
            // componente; y no se genera aftertouch tactil (el host solo refleja
            // el del bridge): ambas cosas quedan como estaban.
            enableChordMemory: false,
            enableAftertouch: false,
            getLedColor: () => (typeof window._resolveKeyLedColor === 'function'
                ? window._resolveKeyLedColor(bridge())
                : 'var(--brand-accent)'),
            getPressureState: readPressureState,
        },
    });

    window.__kbd = keyboardInstance;
    window.__abdKeyboard = keyboardInstance;

    setupHostOctaveButtons();
    setupHostWheels();
}

window.initKeyboardAndWheels = initKeyboardAndWheels;
/**
 * Nota MIDI del keybed en el LCD del Programmer (lo usa el bridge al hacer echo
 * del note-on del proprio keybed).
 */
window._showKeyboardNoteOnLcd = function (midiNote, velocity) {
    const b = bridge();
    if (b && typeof b._showNoteOnLcd === 'function') {
        b._showNoteOnLcd(midiNote, velocity);
    }
};
