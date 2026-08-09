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
