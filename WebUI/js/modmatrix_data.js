/* --- ABDEEP MODULATION MATRIX DATA ---
   Static arrays (source/destination lists) and pure helper functions for the Mod Matrix UI.
   Extracted from modmatrix.js — data only, no closure state or DOM access.
   Depends on: nothing.
*/

// ── Modulation Sources (Manual DeepMind 12) ───────────────────
const MOD_SOURCES = [
    'None', 'Pitch Bend', 'Mod Wheel', 'Foot Ctrl',
    'BreathCtrl', 'Pressure', 'Expression', 'LFO 1',
    'LFO 2', 'Env 1', 'Env 2', 'Env 3',
    'Note Num', 'Note Vel', 'Note Off Vel', 'Ctrl Seq',
    'LFO 1 (Uni)', 'LFO 2 (Uni)', 'LFO 1 (Fade)', 'LFO 2 (Fade)',
    'Voice Num', 'Uni Voice', 'CC X (115)', 'CC Y (116)',
    'CC Z (117)'
];

// ── Modulation Destinations (Manual DeepMind 12) ──────────────
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

// ── Full destinations (padded to index 132) ───────────────────
const FULL_MOD_DESTINATIONS = (function buildFullDestinations() {
    const arr = [];
    for (let i = 0; i <= 132; i++) {
        if (i < MOD_DESTINATIONS.length) {
            arr.push(MOD_DESTINATIONS[i]);
        } else if (i === 129) {
            arr.push('Fx 1 Level');
        } else if (i === 130) {
            arr.push('Fx 2 Level');
        } else if (i === 131) {
            arr.push('Fx 3 Level');
        } else if (i === 132) {
            arr.push('Fx 4 Level');
        } else {
            arr.push('Dest ' + i);
        }
    }
    return arr;
})();

// ── Category Color Helpers ──────────────────────────────────

/** Get category color for a Modulation Source index */
function getSrcCategoryColor(idx) {
    if (idx === 0) {return null;}
    if (idx >= 1 && idx <= 6) {return 'var(--accent-blue)';}
    if (idx === 7 || idx === 8 || (idx >= 16 && idx <= 19)) {return 'var(--accent-teal)';}
    if (idx >= 9 && idx <= 11) {return 'var(--accent-green)';}
    if (idx >= 12 && idx <= 14) {return 'var(--color-gold)';}
    return 'var(--accent-pink)';
}

/** Get category color for a Modulation Destination index */
function getDestCategoryColor(idx) {
    if (idx === 0) {return null;}
    if (idx >= 1 && idx <= 8) {return 'var(--accent-teal)';}
    if (idx >= 9 && idx <= 18) {return 'var(--accent-blue)';}
    if (idx >= 20 && idx <= 23) {return 'var(--accent-pink)';}
    if (idx >= 24 && idx <= 62) {return 'var(--accent-green)';}
    if (idx === 63 || idx === 64) {return 'var(--color-gold)';}
    return 'var(--text-dim)';
}

/** Update bipolar slider fill divs from normalized depth (0-1) */
function updateSliderFill(slider, pct) {
    const posFill = slider.querySelector('.fill.pos');
    const negFill = slider.querySelector('.fill.neg');
    if (!posFill || !negFill) {return;}
    if (pct > 0.5) {
        const posWidth = ((pct - 0.5) * 2) * 100;
        posFill.style.width = posWidth.toFixed(1) + '%';
        negFill.style.width = '0';
    } else if (pct < 0.5) {
        const negWidth = ((0.5 - pct) * 2) * 100;
        negFill.style.width = negWidth.toFixed(1) + '%';
        posFill.style.width = '0';
    } else {
        posFill.style.width = '0';
        negFill.style.width = '0';
    }
}

/** Apply category color to a source/dest button */
function applyButtonColor(btn, color) {
    if (color) {
        btn.style.borderColor = color;
        btn.style.color = color;
    } else {
        btn.style.borderColor = '';
        btn.style.color = '';
    }
}

// ── ModMatrix Blocks & Compact Helper (AbyssMind Pro) ─────────────────
const MOD_BLOCKS = [
    { id: 1, label: 'Block 1 (1–8)', range: [1, 8] },
    { id: 2, label: 'Block 2 (9–16)', range: [9, 16] },
    { id: 3, label: 'Block 3 (17–24)', range: [17, 24] },
    { id: 4, label: 'Block 4 (25–32)', range: [25, 32] }
];

/** Reorders active modulation slots to eliminate gaps and shift all active routes to the first slots */
function compactModMatrix(state) {
    if (!state) { return 0; }
    const slots = [];
    const maxSlots = 32;
    for (let i = 1; i <= maxSlots; i++) {
        const src = state[`mod_matrix_slot${i}_src`] || 0;
        const dest = state[`mod_matrix_slot${i}_dest`] || 0;
        const depth = state[`mod_matrix_slot${i}_depth`] !== undefined ? state[`mod_matrix_slot${i}_depth`] : 0.5;
        if (src !== 0 || dest !== 0) {
            slots.push({ src, dest, depth });
        }
    }
    const sendParamToSynth = (typeof window !== 'undefined' && window.sendParamToSynth) ? window.sendParamToSynth : function() {};
    for (let i = 1; i <= maxSlots; i++) {
        const active = slots[i - 1] || { src: 0, dest: 0, depth: 0.5 };
        state[`mod_matrix_slot${i}_src`] = active.src;
        state[`mod_matrix_slot${i}_dest`] = active.dest;
        state[`mod_matrix_slot${i}_depth`] = active.depth;
        sendParamToSynth(`mod_matrix_slot${i}_src`, active.src);
        sendParamToSynth(`mod_matrix_slot${i}_dest`, active.dest);
        sendParamToSynth(`mod_matrix_slot${i}_depth`, active.depth);
    }
    return slots.length;
}

// ── Exports ─────────────────────────────────────────────────
globalThis.MOD_SOURCES = MOD_SOURCES;
globalThis.MOD_DESTINATIONS = MOD_DESTINATIONS;
globalThis.FULL_MOD_DESTINATIONS = FULL_MOD_DESTINATIONS;
globalThis.MOD_BLOCKS = MOD_BLOCKS;
globalThis.compactModMatrix = compactModMatrix;
globalThis.getSrcCategoryColor = getSrcCategoryColor;
globalThis.getDestCategoryColor = getDestCategoryColor;
globalThis.updateSliderFill = updateSliderFill;
globalThis.applyButtonColor = applyButtonColor;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MOD_SOURCES,
        MOD_DESTINATIONS,
        FULL_MOD_DESTINATIONS,
        MOD_BLOCKS,
        compactModMatrix,
        getSrcCategoryColor,
        getDestCategoryColor,
        updateSliderFill,
        applyButtonColor,
    };
}

