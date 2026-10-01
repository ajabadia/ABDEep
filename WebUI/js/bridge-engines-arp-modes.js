/**
 * @purpose Algoritmos de cálculo de paso del arpegiador por modo.
 * Extraído de bridge-engines-arp.js _arpStep.
 * @purpose_en Arpeggiator step calculation per mode — pure logic, no bridge state.
 */

/**
 * Calcula el índice de nota y offset de octava para un paso del arpegiador.
 * Función pura — no depende del estado del bridge.
 * @param {number} mode - Modo de arpegio (0-9)
 * @param {number} stepIndex - Índice de paso actual
 * @param {number} heldLength - Número de notas sostenidas
 * @param {number} arpOctave - Rango de octavas (0-4)
 * @returns {{ noteIdx: number, octaveOffset: number }} Nota y offset calculados
 */
function _arpCalcStep(mode, stepIndex, heldLength, arpOctave) {
    let noteIdx = 0;
    let octaveOffset = 0;

    switch (mode) {
        case 0: // UP
            noteIdx = stepIndex % heldLength;
            octaveOffset = Math.floor(stepIndex / heldLength) * 12;
            break;
        case 1: // DOWN
            noteIdx = (heldLength - 1) - (stepIndex % heldLength);
            octaveOffset = Math.floor(stepIndex / heldLength) * 12;
            break;
        case 2: // UP-DOWN
const cycleLen = heldLength * 2 - (heldLength > 1 ? 2 : 1);
const pos = stepIndex % cycleLen;
            if (pos < heldLength) {
                noteIdx = pos;
            } else {
                noteIdx = cycleLen - pos;
            }
            octaveOffset = Math.floor(stepIndex / cycleLen) * 12;
            break;
        case 3: // UP-INV
            noteIdx = stepIndex % heldLength;
            octaveOffset = Math.floor(stepIndex / heldLength) * 12;
            break;
        case 4: // DOWN-INV
            noteIdx = (heldLength - 1) - (stepIndex % heldLength);
            octaveOffset = Math.floor(stepIndex / heldLength) * 12;
            break;
        case 5: // UP-DN-INV
const cycleLen2 = heldLength * 2 - (heldLength > 1 ? 2 : 1);
const pos2 = stepIndex % cycleLen2;
            if (pos2 < heldLength) {
                noteIdx = pos2;
            } else {
                noteIdx = cycleLen2 - pos2;
            }
            octaveOffset = Math.floor(stepIndex / cycleLen2) * 12;
            break;
        case 6: // UP-ALT
            noteIdx = stepIndex % heldLength;
            octaveOffset = (Math.floor(stepIndex / heldLength) % 2) * 12;
            break;
        case 7: // DOWN-ALT
            noteIdx = (heldLength - 1) - (stepIndex % heldLength);
            octaveOffset = (Math.floor(stepIndex / heldLength) % 2) * 12;
            break;
        case 8: // RANDOM
            noteIdx = Math.floor(Math.random() * heldLength);
            octaveOffset = Math.floor(Math.random() * (arpOctave + 1)) * 12;
            break;
        case 9: // AS-PLAYED
            noteIdx = stepIndex % heldLength;
            octaveOffset = Math.floor(stepIndex / heldLength) * 12;
            break;
        default:
            noteIdx = stepIndex % heldLength;
    }

    // NOTA: El clamping de octava y reset de stepIndex se maneja en _arpStep (bridge-engines-arp.js)
    // para mantener la lógica de reinicio del patrón completa.

    return { noteIdx: noteIdx, octaveOffset: octaveOffset };
}

// Exponer globalmente
if (typeof window !== 'undefined') {
    window._arpCalcStep = _arpCalcStep;
}
if (typeof global !== 'undefined') {
    global._arpCalcStep = _arpCalcStep;
}

/** Velocidad de SALIDA de la nota arpegiada en modo Gate.
 *
    El hardware tiene este byte (112, «Arp Velocity Gate») y no tiene forma de
    tocar fuerte sin que el arp suene más fuerte: por eso existe el modo. El
    valor 100 es el que ya usa `pianoNoteOn` cuando no recibe velocidad
    (`velocity || 100`), así que no es un número inventado: es la velocidad neutra
    del propio puente. */
const ARP_VEL_GATE = 100;

/**
 * Calcula la velocidad con la que debe sonar la nota de UN paso del arpegiador.
 *
 * El parámetro `arp_velocity_gate` (enum `Gate` / `Velocity` / `Seq`, byte 112
 * del preset real) lived declarado en el spec y pintado por el panel y el modal,
 * pero ningún motor lo miraba: el arpegiador sonaba siempre con la velocidad de
 * la tecla. El selector prometía tres modos y no ejecutaba ninguno.
 *
 * Función pura, como `_arpCalcStep`: no toca el bridge, no lee `parameterCache`,
 * no muta nada. El modo llega ya mapeado a índice de enum (0/1/2).
 *
 * - **Gate (0)** — velocidad constante. Es el modo en el que el arp NO te hace
 *   caso a la fuerza con la que toques: todas las notas suenan igual. Es lo que
 *   hace un arpegio de caja de ritmos, y es el que tenía que hacer el selector.
 * - **Velocity (1)** — la salida sigue a la tecla. Es lo que hacía el motor
 *   siempre, sin mirar el parámetro; ahora es lo que dice la opción.
 * - **Seq (2)** — rampa por el patrón: sube y baja a lo largo de las notas
 *   sostenidas, en vez de copiar la velocidad de cada una. Es el modo que hace
 *   que el mismo acorde suene distinto cada vuelta.
 *
 * @param {number} mode - Modo de velocidad (0 Gate, 1 Velocity, 2 Seq)
 * @param {number} playedVelocity - Velocidad con la que se tocó la nota (0-127)
 * @param {number} noteIdx - Índice de la nota sostenida que toca este paso
 * @param {number} heldLength - Número de notas sostenidas
 * @returns {number} Velocidad de salida (1-127)
 */
function _arpVelocityFor(mode, playedVelocity, noteIdx, heldLength) {
    let velocity;

    switch (mode) {
        case 1: // VELOCITY — la salida es la de la tecla
            velocity = playedVelocity;
            break;
        case 2: { // SEQ — rampa triangular sobre las notas sostenidas
            const n = Math.max(1, heldLength);
            const period = n * 2 - (n > 1 ? 2 : 1);
            const pos = Math.max(0, noteIdx) % period;
            const fase = pos < n ? pos : period - pos;
            // De 40 a 127: fuerte abajo, suave arriba. Con una sola nota la rampa
            // es degenerada, y entonces se queda con la velocidad de la tecla.
            velocity = (n > 1)
                ? Math.round(127 - (fase / (n - 1)) * 87)
                : playedVelocity;
            break;
        }
        case 0: // GATE — constante, la velocidad neutra del puente
        default:
            velocity = ARP_VEL_GATE;
            break;
    }

    // Acota siempre a 1-127: un noteOn con 0 es silencio, y por encima de 127 es
    // basura que cada driver MIDI redondea a su manera.
    return Math.max(1, Math.min(127, Math.round(velocity)));
}

// Exponer globalmente (mismo patrón que _arpCalcStep).
if (typeof window !== 'undefined') {
    window._arpVelocityFor = _arpVelocityFor;
}
if (typeof global !== 'undefined') {
    global._arpVelocityFor = _arpVelocityFor;
}

/** Longitud de la rejilla de patrones del arpegiador (32 pasos). */
const ARP_PATTERN_STEPS = 32;

/**
 * Normaliza un patrón de pasos a un array de ARP_PATTERN_STEPS booleanos.
 *
 * Lo que llega del editor (`stepEditor.getSteps()`) o del almacenamiento de
 * presets es un array de booleanos de longitud variable: uno guardado con otra
 * rejilla puede venir corto. Un patrón corto que se indexara
 * directo daría `undefined` en los pasos que falten, que es falsy y apagaría
 * notas que el usuario Encendió.
 *
 * @param {unknown} steps
 * @returns {boolean[]|null} Array de 32 booleanos, o `null` si no hay patrón
 */
function _arpNormalizePattern(steps) {
    if (!Array.isArray(steps)) {return null;}
    const out = new Array(ARP_PATTERN_STEPS);
    for (let i = 0; i < ARP_PATTERN_STEPS; i++) {
        out[i] = !!steps[i];
    }
    return out;
}

/**
 * Decide si un paso del arpegiador debe sonar, según el patrón activo.
 *
 * El patrón es una máscara de 32 pasos sobre el ciclo del arpegiador: el paso
 * `stepIndex % 32` suena si su casilla está encendida. Es la misma rejilla de 32
 * barras que el editor pinta, y los mismos datos que el botón Save guarda.
 *
 * Sin patrón (null) devuelve `true` siempre: es el caso por defecto y no puede
 * cambiar lo que sonaba antes de que esto existiera.
 *
 * Función pura, como las otras dos del fichero.
 *
 * @param {boolean[]|null} pattern - Patrón normalizado, o null
 * @param {number} stepIndex - Índice de paso del arpegiador
 * @returns {boolean}
 */
function _arpStepEnabled(pattern, stepIndex) {
    if (!pattern) {return true;}
    const pos = ((Math.floor(stepIndex) % ARP_PATTERN_STEPS) + ARP_PATTERN_STEPS) % ARP_PATTERN_STEPS;
    return pattern[pos];
}

// Exponer globalmente (mismo patrón que _arpCalcStep).
if (typeof window !== 'undefined') {
    window._arpNormalizePattern = _arpNormalizePattern;
    window._arpStepEnabled = _arpStepEnabled;
}
if (typeof global !== 'undefined') {
    global._arpNormalizePattern = _arpNormalizePattern;
    global._arpStepEnabled = _arpStepEnabled;
}
