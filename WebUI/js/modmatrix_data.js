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
//
// SOLO EL BLOQUE DE SINTESIS, 0-72. Lo de 73 en adelante se anade debajo, con
// su propia cuenta, porque cada tramo tiene un nombre y un reparto distintos.
//
// Esta lista no lleva ningun nombre de fx. Antes el ultimo era `Fx 1 Level` en
// el 73, con el comentario `// ID 129`: el nombre era el del 129 pero vivia en
// el 73, que es el bug entero resumido en dos lineas.
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
    'Seq Slew'
];

// ── El reparto de 73 en adelante, y por que cambia ───────────────────
//
// EL MANUAL REPARTE SUS 132 DESTINOS ASI:
//   0        ninguno
//   1- 8     LFO 1 y LFO 2
//   9-19     osciladores y portamento
//   20-23    filtro
//   24-58    las tres envolventes
//   59-63    amplificador
//   64-72    comunes a todas las voces
//   73-80    META-MODULACION: la profundidad de cada uno de los ocho buses
//   81-128   los parametros de los cuatro huecos de efecto, doce por hueco
//   129-132  el nivel de salida de los cuatro huecos de efecto
//
// Y SON 133 ENTRADAS, 0-132, que es lo que el manual llama "132 destinos" mas el
// cero de "ninguno". El byte de destino llega a 129, asi que 130, 131 y 132
// quedan con nombre pero no son direccionables: es lo que hace el hardware y no
// se inventa un codigo que el byte no trae.
//
// LO QUE HABIA ANTES Y POR QUE ESTABA MAL. El bloque del bus de fx estaba en
// 74-81, un destino de parametros y otro de nivel por hueco. Salio de mover el
// nombre del 129 --donde el propio codigo decia que estaba, con el comentario
// `Fx 1 Level // ID 129`-- al 78, y de repartir los otros siete a su lado para
// que encajara con un enum que ya decia 74. La tabla seguia al codigo y el
// codigo a la tabla, y el circulo cerrado no decia nada del hardware. Ademas
// dejaba `Fx 1 Level` DOS veces, en el 73 y en el 78.
//
// LO QUE SI LO DICE, Y MEDIDO. Los 1024 presets de fabrica que hay commiteados
// ejercen los ocho valores de 73 a 80, todos, desde fuentes que el interprete
// mueve con la mano --rueda de modulacion, LFO 1, Aftertouch, velocity de nota
// suelta-- y NINGUNO de ellos aparece con la profundidad en el centro. Ese es
// el patron de mover la profundidad de un bus, no el de tocar un efecto. Y
// ejercen 81 a 128 repartidos en cuatro bloques de doce, con el primero
// completo de doce de doce, que no sale por casualidad. La cuenta esta en
// `build/fase2-medir.mjs` y el guard que la vuelve a medir es
// `WebUI/tests/modMatrixTables.test.js`.
//
// EL NUMERO DEL ENUM ES EL DEL BYTE. El motor castea el byte crudo
// (`static_cast<ModDestination>`), asi que lo que hay aqui y lo que hay en
// `Source/DSP/ModulationMatrix.h` tienen que ser la MISMA tabla, no dos que se
// parecen.
const META_MOD_DESTINATIONS = {
    73: 'Mod 1 Depth', 74: 'Mod 2 Depth', 75: 'Mod 3 Depth', 76: 'Mod 4 Depth',
    77: 'Mod 5 Depth', 78: 'Mod 6 Depth', 79: 'Mod 7 Depth', 80: 'Mod 8 Depth'
};

const FX_LEVEL_DESTINATIONS = {
    129: 'FX 1 Level', 130: 'FX 2 Level', 131: 'FX 3 Level', 132: 'FX 4 Level'
};

const FX_PARAMS_FIRST_CODE = 81;
const FX_PARAMS_PER_SLOT = 12;

// El nombre del parametro `p` (de 1 a 12) del hueco `h` (de 1 a 4) sale de la
// cuenta del manual: el codigo es `80 + (h - 1) * 12 + p`. Los numeros viven
// aqui y en `ModulationMatrix.h`, y los dos sitios se cruzan en
// `WebUI/tests/modMatrixTables.test.js` para que no se separen en silencio.
function fxParamDestinationName(slot, param) {
    return 'FX ' + slot + ' Param ' + param;
}

const FULL_MOD_DESTINATIONS = (function buildFullDestinations() {
    const arr = [];
    for (let i = 0; i <= 132; i++) {
        if (i < MOD_DESTINATIONS.length) {
            arr.push(MOD_DESTINATIONS[i]);
        } else if (Object.prototype.hasOwnProperty.call(META_MOD_DESTINATIONS, i)) {
            arr.push(META_MOD_DESTINATIONS[i]);
        } else if (i >= FX_PARAMS_FIRST_CODE
                   && i < FX_PARAMS_FIRST_CODE + 4 * FX_PARAMS_PER_SLOT) {
            const cero = i - FX_PARAMS_FIRST_CODE;
            const hueco = Math.floor(cero / FX_PARAMS_PER_SLOT) + 1;
            arr.push(fxParamDestinationName(hueco, cero % FX_PARAMS_PER_SLOT + 1));
        } else if (Object.prototype.hasOwnProperty.call(FX_LEVEL_DESTINATIONS, i)) {
            arr.push(FX_LEVEL_DESTINATIONS[i]);
        } else {
            // Un hueco sin evidencia de etiqueta se queda como `Dest N`. Una
            // etiqueta honesta vale mas que una inventada: si el manual no dice
            // que hay ahi, el nombre honesto es el numero.
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
    // 9-19 son OSCILADORES y PORTAMENTO (9-18 los Family 1 y el 19 es
    // 'Porta Time'), 20-23 el VCF. El 19 estaba entre ambos rangos y caia sin
    // familia: la vista del grafo lo pintaba rosa, esta lo dejaba en --text-dim.
    if (idx >= 9 && idx <= 19) {return 'var(--accent-blue)';}
    if (idx >= 20 && idx <= 23) {return 'var(--accent-pink)';}
    if (idx >= 24 && idx <= 62) {return 'var(--accent-green)';}
    if (idx === 63 || idx === 64) {return 'var(--color-gold)';}
    // 65-72 son los comunes que faltan (nivel del ruido, HPF, unison, drift,
    // arpegiador y secuenciador). Antes caian en el relleno de --text-dim.
    if (idx >= 65 && idx <= 72) {return 'var(--color-gold)';}
    // 73-80 es la META-MODULACION: un bus que no suena, sino que mueve la
    // profundidad de otro. `--accent-red` es el unico acento que no es familia
    // de ningun otro bloque, asi que no confunde con los FX de al lado.
    if (idx >= 73 && idx <= 80) {return 'var(--accent-red)';}
    // 81-132 es la zona de efectos: doce parametros por hueco y el nivel de
    // cada hueco. `--accent-red` tambien, porque es la misma familia: lo que
    // suena por el rack.
    if (idx >= 81 && idx <= 132) {return 'var(--accent-red)';}
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
globalThis.META_MOD_DESTINATIONS = META_MOD_DESTINATIONS;
globalThis.FX_LEVEL_DESTINATIONS = FX_LEVEL_DESTINATIONS;
globalThis.FX_PARAMS_FIRST_CODE = FX_PARAMS_FIRST_CODE;
globalThis.FX_PARAMS_PER_SLOT = FX_PARAMS_PER_SLOT;
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
        META_MOD_DESTINATIONS,
        FX_LEVEL_DESTINATIONS,
        FX_PARAMS_FIRST_CODE,
        FX_PARAMS_PER_SLOT,
        MOD_BLOCKS,
        compactModMatrix,
        getSrcCategoryColor,
        getDestCategoryColor,
        updateSliderFill,
        applyButtonColor,
    };
}