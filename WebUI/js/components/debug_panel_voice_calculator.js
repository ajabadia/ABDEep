/**
 * @purpose Handles voice modes mappings, note conversions, and theoretical unison parameters detune stack calculator.
 * @purpose_en Debug panel voice constants and theoretical parameters calculator.
 */

window.DEBUG_VOICE_MODE_NAMES = [
    "Poly", "Uni2", "Uni3", "Uni4", "Uni6", "Uni12",
    "Mono", "Mono2", "Mono3", "Mono4", "Mono6",
    "Poly6", "Poly8"
];

window.DEBUG_VOICES_PER_MODE = [1, 2, 3, 4, 6, 12, 1, 2, 3, 4, 6, 1, 1];

const DEBUG_NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
window.DEBUG_CHORD_TYPE_NAMES = ["Memory","Major","Minor","Maj7","Min7","Dom7","Sus4","Power","Aug","Dim","Sus2","7th"];

window.debugMidiNoteToName = function(note) {
    if (note < 0 || note > 127) return "—";
    const octave = Math.floor(note / 12) - 1;
    return DEBUG_NOTE_NAMES[note % 12] + octave;
};

window.calculateUnisonParams = function(voiceMode, unisonDetune, vcaPanSpread) {
    const totalVoices = window.DEBUG_VOICES_PER_MODE[voiceMode] || 1;
    if (totalVoices <= 1) return [];

    const maxDetuneCents = unisonDetune * 50.0;
    const results = [];

    for (let v = 0; v < totalVoices; v++) {
        let detuneCents;
        let panPos;

        if (totalVoices === 2) {
            detuneCents = v === 0 ? -maxDetuneCents : maxDetuneCents;
        } else {
            const step = 2.0 * maxDetuneCents / (totalVoices - 1);
            detuneCents = -maxDetuneCents + v * step;
        }

        panPos = totalVoices === 2 ? (v === 0 ? 0.0 : 1.0) : v / (totalVoices - 1);
        const basePan = 0.5 + (panPos - 0.5) * vcaPanSpread;

        results.push({ voiceIndex: v, detuneCents, panRaw: panPos, panOutput: basePan, active: false, midiNote: -1 });
    }
    return results;
};
