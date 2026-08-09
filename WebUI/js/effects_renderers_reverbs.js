/**
 * @purpose Reverb category effect HTML renderers (types 2, 4, 7, 9, 10, 11, 12, 13).
 * Extracted from effects_templates_renderers.js.
 * Each renderer takes (pVals[, effectType][, selectedSlot]) and returns an HTML string.
 */

// ── VintageRoomReverb (type 4) ──

window._renderFXVintageRoomReverb = function(pVals) {
    const theme = window._fxThemeStyle(4);
    return `
        <div style="${theme} display: grid; grid-template-columns: repeat(4, 1fr) 1.2fr; gap: 8px; width: 95%; padding: 5px;">
            <div style="display: flex; flex-direction: column; gap: 5px;">
                <div class="fx-value-box">
                    <div class="fx-value-box-label txt-6">PRE DELAY</div>
                    <div class="txt-12 txt-bold">${Math.round(pVals[0] * 200)} ms</div>
                </div>
                <div class="fx-value-box">
                    <div class="fx-value-box-label txt-6">DECAY</div>
                    <div class="txt-12 txt-bold">${Math.round(pVals[1] * 100)} %</div>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 5px;">
                <div class="fx-value-box">
                    <div class="fx-value-box-label txt-6">SIZE</div>
                    <div class="txt-12 txt-bold">${Math.round(pVals[2] * 100)} %</div>
                </div>
                <div class="fx-value-box">
                    <div class="fx-value-box-label txt-6">DENSITY</div>
                    <div class="txt-12 txt-bold">${Math.round(pVals[3] * 100)} %</div>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; align-items:center; justify-content: center; background: var(--bg-header); border-radius: var(--radius-sm); border: 1px solid var(--border-dim); padding: 4px;">
                <div style="width:28px; height:28px; border-radius:50%; background:var(--text-dim); border:2px solid #ccc; box-shadow: inset 0 2px 4px rgba(0,0,0,0.6);"></div>
                <span style="font-size:8px; font-weight:bold; color:#fff; margin-top:4px;">FREEZE</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 5px;">
                <div class="fx-value-box">
                    <div class="fx-value-box-label txt-6">LOW MULT</div>
                    <div class="txt-12 txt-bold">x${(pVals[4] * 2.0).toFixed(1)}</div>
                </div>
                <div class="fx-value-box">
                    <div class="fx-value-box-label txt-6">HIGH MULT</div>
                    <div class="txt-12 txt-bold">x${(pVals[5] * 2.0).toFixed(1)}</div>
                </div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 5px;">
                <div class="fx-value-box">
                    <div class="fx-value-box-label txt-6">LOW CUT</div>
                    <div class="txt-12 txt-bold">${Math.round(pVals[6] * 500)} Hz</div>
                </div>
                <div class="fx-value-box">
                    <div class="fx-value-box-label txt-6">HIGH CUT</div>
                    <div class="txt-12 txt-bold">${Math.round(pVals[7] * 20)} kHz</div>
                </div>
            </div>
        </div>
    `;
};

// ── tcDeepVerb (type 2) ──

window._renderFXTcDeepVerb = function(pVals) {
    const theme = window._fxThemeStyle(2);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; align-items: center; justify-content: space-around; width: 95%; border-radius: var(--radius); padding: 12px;">
            <div style="color:#fff; font-size:12px; font-weight:bold; font-family:sans-serif; letter-spacing: -0.5px;">tcDeepVerb</div>
            <div style="text-align:center; color:#fff; font-family:sans-serif;">
                <div class="knob-ring" style="width:36px; height:36px; margin: 0 auto 4px;">
                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[0] * 270) - 135}deg)"></div>
                </div>
                <span style="font-size:7px; text-transform:uppercase;">PRE DELAY</span>
            </div>
            <div style="text-align:center; color:#fff; font-family:sans-serif;">
                <div class="knob-ring" style="width:36px; height:36px; margin: 0 auto 4px;">
                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[1] * 270) - 135}deg)"></div>
                </div>
                <span style="font-size:7px; text-transform:uppercase;">DECAY TIME</span>
            </div>
            <div style="text-align:center; color:#fff; font-family:sans-serif;">
                <div class="knob-ring" style="width:36px; height:36px; margin: 0 auto 4px;">
                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[2] * 270) - 135}deg)"></div>
                </div>
                <span style="font-size:7px; text-transform:uppercase;">TONE</span>
            </div>
            <div style="text-align:center; color:#fff; font-family:sans-serif;">
                <div class="knob-ring" style="width:36px; height:36px; margin: 0 auto 4px;">
                    <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[3] * 270) - 135}deg)"></div>
                </div>
                <span style="font-size:7px; text-transform:uppercase;">MIX</span>
            </div>
        </div>
    `;
};

// ── Plate Reverb (type 7) ──

window._renderFXPlateReverb = function(pVals) {
    const theme = window._fxThemeStyle(7);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; border-radius: var(--radius); padding: 10px; font-family: sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 10px; font-weight: bold; color: #aaa; letter-spacing: 1px;">REVERB</span>
                <div style="background: #0088ff; color: #000; border-radius: var(--radius-xs); font-family: 'Share Tech Mono', monospace; font-size: 11px; font-weight: bold; padding: 3px 15px; box-shadow: 0 0 8px rgba(0, 136, 255, 0.6); text-transform: uppercase;">PLATE</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; text-align: center;">
                ${['PRE DEL', 'DECAY', 'SIZE', 'DAMP', 'DIFF', 'LO CUT', 'HI CUT', 'BASS M', 'XOVER', 'MOD DEP'].map((name, idx) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div class="knob-ring" style="width: 24px; height: 24px; margin-bottom: 3px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size: 6px; color: var(--text-dim); font-weight: bold; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

// ── Gated / Reverse Reverb (types 9, 10) ──

window._renderFXGatedReverse = function(pVals, effectType) {
    const theme = window._fxThemeStyle(effectType);
    const title = effectType === 9 ? 'GATED' : 'REVERSE';
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; border-radius: var(--radius); padding: 10px; font-family: sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 10px; font-weight: bold; color: #aaa; letter-spacing: 1px;">REVERB</span>
                <div style="background: #00ff66; color: #000; border-radius: var(--radius-xs); font-family: 'Share Tech Mono', monospace; font-size: 11px; font-weight: bold; padding: 3px 15px; box-shadow: 0 0 8px rgba(0, 255, 102, 0.6); text-transform: uppercase;">${title}</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; text-align: center;">
                ${['PRE DEL', 'DECAY', 'ATTACK', 'DENSITY', 'SPREAD', 'LO CUT', 'HI CUT', 'HI S G', 'DIFF'].map((name, idx) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div class="knob-ring" style="width: 26px; height: 26px; margin-bottom: 3px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size: 6px; color: var(--text-dim); font-weight: bold; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

// ── Dual FX — Chorus+Chamber (11), Delay+Chamber (12), Flanger+Chamber (13) ──

window._renderFXDualFX = function(pVals, effectType) {
    const theme = window._fxThemeStyle(effectType);
    let title = 'CHORUS AND CHAMBER';
    if (effectType === 12) {title = 'DELAY AND CHAMBER';}
    if (effectType === 13) {title = 'FLANGER AND CHAMBER';}

    const leftKnobs = effectType === 11 ? ['SPEED', 'DEPTH', 'DELAY', 'PHASE', 'WAVE'] :
                      (effectType === 12 ? ['TIME', 'PATTERN', 'FEED HC', 'FEEDBACK', 'XFEED'] :
                                           ['SPEED', 'DEPTH', 'DELAY', 'PHASE', 'FEED']);

    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 8px; font-weight: bold; color: var(--text-dim);">DUAL FX</span>
                <div style="background: #0088ff; color: #000; border-radius: var(--radius-xs); font-family: 'Share Tech Mono', monospace; font-size: 9px; font-weight: bold; padding: 2px 10px; box-shadow: 0 0 6px rgba(0, 136, 255, 0.5); text-transform: uppercase;">${title}</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; text-align: center;">
                ${leftKnobs.map((name, idx) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div class="knob-ring" style="width: 22px; height: 22px; margin-bottom: 2px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size: 5px; color: #00ccff; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
                ${['PREDELAY', 'DECAY', 'SIZE', 'DAMPING'].map((name, idx) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div class="knob-ring" style="width: 22px; height: 22px; margin-bottom: 2px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[5+idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size: 5px; color: #ff5500; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};
