/**
 * @purpose Built-in FX presets data and HTML escaping helper.
 * Extracted from effects_presets.js — pure data + pure utility function.
 */

const DEFAULT_FX_PRESETS = [
    // ── Existing presets (types 0–35) ──────────────────────────────────────
    {
        name: 'Lush Chorus-D',
        slot: 1,
        type: 29 / 56.0,
        gain: 1.0,
        params: [0.35, 0.40, 0.50, 0.20, 0.80, 0.10, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
        created: 1720000000000
    },
    {
        name: 'Stereo Delay PingPong',
        slot: 1,
        type: 22 / 56.0,
        gain: 0.8,
        params: [0.50, 0.75, 0.45, 0.30, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
        created: 1720000000001
    },
    {
        name: 'TC Deep Reverb Hall',
        slot: 1,
        type: 2 / 56.0,
        gain: 0.9,
        params: [0.15, 0.70, 0.80, 0.50, 0.35, 0.60, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
        created: 1720000000002
    },
    {
        name: 'Vintage Room Ambience',
        slot: 1,
        type: 4 / 56.0,
        gain: 1.0,
        params: [0.05, 0.35, 0.40, 0.60, 0.50, 0.50, 0.10, 0.90, 0.50, 0.50, 0.50, 0.50],
        created: 1720000000003
    },
    {
        name: 'Lush Stereo Phaser',
        slot: 1,
        type: 31 / 56.0,
        gain: 1.0,
        params: [0.20, 0.65, 0.40, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50],
        created: 1720000000004
    },
    // ── Advanced FX presets (types 36–56) ──────────────────────────────────
    // --- BBD Chorus (36) ---
    { name: 'Juno-106 Chorus I',    slot: 1, type: 36 / 56.0, gain: 1.0,  params: [0.05, 0.00, 0.00, 0.00, 0.65, 0.80, 0.45, 0.50, 0.50, 0.50, 0.50, 0.50], created: 1720000000010 },
    { name: 'Slow BBD Swirl',       slot: 1, type: 36 / 56.0, gain: 0.95, params: [0.10, 0.00, 0.00, 0.00, 0.55, 0.75, 0.35, 0.25, 0.50, 0.50, 0.50, 0.50], created: 1720000000011 },
    { name: 'Ensemble Triple',      slot: 1, type: 36 / 56.0, gain: 0.85, params: [0.08, 0.00, 0.00, 0.00, 0.70, 0.85, 0.60, 0.70, 0.50, 0.50, 0.50, 0.50], created: 1720000000012 },
    // --- Solina Ensemble (37) ---
    { name: 'Solina String Pad',    slot: 1, type: 37 / 56.0, gain: 1.0,  params: [0.00, 0.00, 0.00, 0.00, 0.60, 0.90, 0.40, 0.60, 0.50, 0.50, 0.50, 0.50], created: 1720000000020 },
    { name: 'Orchestral Warmth',    slot: 1, type: 37 / 56.0, gain: 0.9,  params: [0.00, 0.00, 0.00, 0.00, 0.55, 0.80, 0.30, 0.40, 0.50, 0.50, 0.50, 0.50], created: 1720000000021 },
    // --- Ring Modulator (38) ---
    { name: 'Bell Tone Metallic',   slot: 1, type: 38 / 56.0, gain: 0.75, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.70, 0.80, 0.20, 0.50, 0.50, 0.50, 0.50], created: 1720000000030 },
    { name: 'Alien Texture',        slot: 1, type: 38 / 56.0, gain: 0.70, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.65, 0.30, 0.90, 0.50, 0.50, 0.50, 0.50], created: 1720000000031 },
    // --- Space Echo (39) ---
    { name: 'RE-201 Dub Echo',      slot: 1, type: 39 / 56.0, gain: 0.85, params: [0.10, 0.60, 0.50, 0.30, 0.50, 0.70, 0.40, 0.80, 0.50, 0.50, 0.50, 0.50], created: 1720000000040 },
    { name: 'Tape Slap-Back',       slot: 1, type: 39 / 56.0, gain: 0.90, params: [0.02, 0.25, 0.15, 0.20, 0.50, 0.65, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50], created: 1720000000041 },
    { name: 'Self-Oscillate Trips', slot: 1, type: 39 / 56.0, gain: 0.80, params: [0.15, 0.80, 0.60, 0.40, 0.50, 0.90, 0.60, 0.95, 0.50, 0.50, 0.50, 0.50], created: 1720000000042 },
    // --- Tape Delay (40) ---
    { name: 'Warm Tape Echo',       slot: 1, type: 40 / 56.0, gain: 0.85, params: [0.05, 0.50, 0.35, 0.25, 0.50, 0.70, 0.45, 0.60, 0.50, 0.50, 0.50, 0.50], created: 1720000000050 },
    { name: 'Lo-Fi Degraded Tape',  slot: 1, type: 40 / 56.0, gain: 0.80, params: [0.05, 0.40, 0.30, 0.15, 0.50, 0.60, 0.80, 0.70, 0.50, 0.50, 0.50, 0.50], created: 1720000000051 },
    { name: 'Precision Tape',       slot: 1, type: 40 / 56.0, gain: 0.90, params: [0.03, 0.35, 0.25, 0.10, 0.50, 0.60, 0.20, 0.30, 0.50, 0.50, 0.50, 0.50], created: 1720000000052 },
    // --- Shimmer Delay (41) ---
    { name: 'Space Shimmer Cath.',  slot: 1, type: 41 / 56.0, gain: 0.80, params: [0.10, 0.85, 0.80, 0.50, 0.50, 0.75, 0.50, 0.40, 0.50, 0.50, 0.50, 0.50], created: 1720000000060 },
    { name: 'Ethereal Float',       slot: 1, type: 41 / 56.0, gain: 0.75, params: [0.20, 0.90, 0.90, 0.60, 0.50, 0.70, 0.35, 0.30, 0.50, 0.50, 0.50, 0.50], created: 1720000000061 },
    { name: 'Dark Shimmer',         slot: 1, type: 41 / 56.0, gain: 0.85, params: [0.15, 0.80, 0.75, 0.80, 0.50, 0.80, 0.55, 0.45, 0.50, 0.50, 0.50, 0.50], created: 1720000000062 },
    // --- Granular Delay (42) ---
    { name: 'Granular Frozen Sky',  slot: 1, type: 42 / 56.0, gain: 0.80, params: [0.10, 0.70, 0.85, 0.40, 0.50, 0.75, 0.70, 0.60, 0.50, 0.50, 0.50, 0.50], created: 1720000000070 },
    { name: 'Micro Grain Rain',     slot: 1, type: 42 / 56.0, gain: 0.85, params: [0.05, 0.60, 0.50, 0.30, 0.50, 0.65, 0.90, 0.80, 0.50, 0.50, 0.50, 0.50], created: 1720000000071 },
    { name: 'Pitch Scatter',        slot: 1, type: 42 / 56.0, gain: 0.75, params: [0.15, 0.65, 0.70, 0.35, 0.50, 0.70, 0.50, 0.90, 0.50, 0.50, 0.50, 0.50], created: 1720000000072 },
    // --- Pattern Freeze (43) ---
    { name: 'Rhythmic Stutter',     slot: 1, type: 43 / 56.0, gain: 0.80, params: [0.05, 0.30, 0.00, 0.00, 0.50, 0.60, 0.70, 0.50, 0.50, 0.50, 0.50, 0.50], created: 1720000000080 },
    { name: 'Evolving Texture',     slot: 1, type: 43 / 56.0, gain: 0.75, params: [0.20, 0.80, 0.50, 0.40, 0.50, 0.55, 0.60, 0.70, 0.50, 0.50, 0.50, 0.50], created: 1720000000081 },
    // --- Duck Delay (44) ---
    { name: 'Vocal Clarity Delay',  slot: 1, type: 44 / 56.0, gain: 0.85, params: [0.05, 0.40, 0.30, 0.25, 0.50, 0.65, 0.80, 0.40, 0.50, 0.50, 0.50, 0.50], created: 1720000000090 },
    { name: 'Pluck Duck Echo',      slot: 1, type: 44 / 56.0, gain: 0.90, params: [0.03, 0.30, 0.20, 0.15, 0.50, 0.60, 0.90, 0.30, 0.50, 0.50, 0.50, 0.50], created: 1720000000091 },
    { name: 'Ambient Duck',         slot: 1, type: 44 / 56.0, gain: 0.80, params: [0.15, 0.65, 0.55, 0.40, 0.50, 0.70, 0.70, 0.50, 0.50, 0.50, 0.50, 0.50], created: 1720000000092 },
    // --- Spectral Delay (45) ---
    { name: 'Spectral Blur',        slot: 1, type: 45 / 56.0, gain: 0.80, params: [0.10, 0.70, 0.60, 0.45, 0.80, 0.65, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50], created: 1720000000100 },
    { name: 'Freq Split Echo',      slot: 1, type: 45 / 56.0, gain: 0.85, params: [0.08, 0.55, 0.45, 0.30, 0.70, 0.60, 0.40, 0.70, 0.50, 0.50, 0.50, 0.50], created: 1720000000101 },
    // --- Frequency Shifter (46) ---
    { name: 'Metallic Ring',        slot: 1, type: 46 / 56.0, gain: 0.75, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.70, 0.65, 0.30, 0.50, 0.50, 0.50, 0.50], created: 1720000000110 },
    { name: 'Alien Sweep',          slot: 1, type: 46 / 56.0, gain: 0.70, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.65, 0.20, 0.85, 0.50, 0.50, 0.50, 0.50], created: 1720000000111 },
    // --- Harmonic Resonator (47) ---
    { name: 'Acoustic Body',        slot: 1, type: 47 / 56.0, gain: 0.85, params: [0.00, 0.35, 0.45, 0.20, 0.50, 0.60, 0.55, 0.40, 0.50, 0.50, 0.50, 0.50], created: 1720000000120 },
    { name: 'Harmonic Bloom',       slot: 1, type: 47 / 56.0, gain: 0.80, params: [0.10, 0.50, 0.60, 0.35, 0.50, 0.55, 0.40, 0.60, 0.50, 0.50, 0.50, 0.50], created: 1720000000121 },
    // --- Combulator (48) ---
    { name: 'Metallic Comb',        slot: 1, type: 48 / 56.0, gain: 0.80, params: [0.02, 0.30, 0.40, 0.15, 0.50, 0.65, 0.60, 0.70, 0.50, 0.50, 0.50, 0.50], created: 1720000000130 },
    { name: 'Resonant Modal',       slot: 1, type: 48 / 56.0, gain: 0.85, params: [0.05, 0.40, 0.50, 0.25, 0.50, 0.70, 0.45, 0.55, 0.50, 0.50, 0.50, 0.50], created: 1720000000131 },
    // --- MB Vocoder (49) ---
    { name: 'Classic Robot Voice',  slot: 1, type: 49 / 56.0, gain: 0.80, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.75, 0.80, 0.20, 0.50, 0.50, 0.50, 0.50], created: 1720000000140 },
    { name: 'Whisper Synth',        slot: 1, type: 49 / 56.0, gain: 0.85, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.70, 0.50, 0.50, 0.50, 0.50, 0.50, 0.50], created: 1720000000141 },
    { name: 'Metallic Vocoder',     slot: 1, type: 49 / 56.0, gain: 0.75, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.65, 0.90, 0.35, 0.50, 0.50, 0.50, 0.50], created: 1720000000142 },
    // --- OS Distortion (50) ---
    { name: 'Warm Saturation',      slot: 1, type: 50 / 56.0, gain: 0.75, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.60, 0.35, 0.40, 0.50, 0.50, 0.50, 0.50], created: 1720000000150 },
    { name: 'Crunch Guitar Amp',    slot: 1, type: 50 / 56.0, gain: 0.70, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.55, 0.70, 0.60, 0.50, 0.50, 0.50, 0.50], created: 1720000000151 },
    { name: 'Brickwall Limiter',    slot: 1, type: 50 / 56.0, gain: 0.80, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.65, 0.90, 0.25, 0.50, 0.50, 0.50, 0.50], created: 1720000000152 },
    // --- WaveShaper (51) ---
    { name: 'Soft Tanh Clip',       slot: 1, type: 51 / 56.0, gain: 0.80, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.70, 0.30, 0.30, 0.50, 0.50, 0.50, 0.50], created: 1720000000160 },
    { name: 'Hard Bit Crush',       slot: 1, type: 51 / 56.0, gain: 0.70, params: [0.00, 0.00, 0.00, 0.00, 0.50, 0.60, 0.85, 0.75, 0.50, 0.50, 0.50, 0.50], created: 1720000000161 },
    // --- FDN Reverb (52) ---
    { name: 'Dense Hall FDN',       slot: 1, type: 52 / 56.0, gain: 0.85, params: [0.10, 0.85, 0.90, 0.50, 0.75, 0.70, 0.45, 0.40, 0.50, 0.50, 0.50, 0.50], created: 1720000000170 },
    { name: 'Plate Diffuse',        slot: 1, type: 52 / 56.0, gain: 0.90, params: [0.05, 0.60, 0.50, 0.35, 0.90, 0.65, 0.35, 0.30, 0.50, 0.50, 0.50, 0.50], created: 1720000000171 },
    // --- Zita Reverb (53) ---
    { name: 'Clean Hall Zita',      slot: 1, type: 53 / 56.0, gain: 0.90, params: [0.05, 0.80, 0.85, 0.40, 0.50, 0.75, 0.40, 0.35, 0.50, 0.50, 0.50, 0.50], created: 1720000000180 },
    { name: 'Cathedral Long Tail',  slot: 1, type: 53 / 56.0, gain: 0.85, params: [0.15, 0.95, 0.95, 0.60, 0.50, 0.80, 0.50, 0.45, 0.50, 0.50, 0.50, 0.50], created: 1720000000181 },
    // --- Nimbus (54) ---
    { name: 'Nimbus Freeze',        slot: 1, type: 54 / 56.0, gain: 0.80, params: [0.15, 0.70, 0.80, 0.50, 0.50, 0.70, 0.60, 0.50, 0.50, 0.50, 0.50, 0.50], created: 1720000000190 },
    // --- Bonsai (55) ---
    { name: 'Lo-Fi Bonsai',         slot: 1, type: 55 / 56.0, gain: 0.80, params: [0.05, 0.40, 0.35, 0.20, 0.50, 0.60, 0.75, 0.80, 0.50, 0.50, 0.50, 0.50], created: 1720000000200 },
    // --- TreeMonster (56) ---
    { name: 'Treemonster Drift',    slot: 1, type: 56 / 56.0, gain: 0.75, params: [0.10, 0.50, 0.60, 0.30, 0.50, 0.55, 0.50, 0.70, 0.50, 0.50, 0.50, 0.50], created: 1720000000210 }
];

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

// Export to globalThis for cross-file access
globalThis.DEFAULT_FX_PRESETS = DEFAULT_FX_PRESETS;
globalThis.escapeHtml = escapeHtml;

// Node.js exports for tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEFAULT_FX_PRESETS, escapeHtml };
}
