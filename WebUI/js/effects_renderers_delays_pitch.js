/**
 * @purpose Delays and Pitch category effect HTML renderers (types 22, 23, 24, 25, 33, 34, 35).
 * Extracted from effects_templates_renderers.js.
 * Each renderer takes (pVals[, effectType][, selectedSlot]) and returns an HTML string.
 */

// ── Delays — Stereo (22), 3-Tap (23), 4-Tap (24) ──

window._renderFXDelay = function(pVals, effectType) {
    const theme = window._fxThemeStyle(effectType);
    const title = effectType === 22 ? 'Stereo Delay' : (effectType === 23 ? '3-Tap Delay' : '4-Tap Delay');
    const delayKnobs = effectType === 22 ? ['TIME', 'PATTERN', 'FEED HC', 'FEEDBACK', 'XFEED', 'LO CUT', 'HI CUT'] :
                       (effectType === 23 ? ['TIME L', 'TIME R', 'TIME C', 'FEED L', 'FEED R', 'FEED C', 'LO CUT'] :
                                            ['TIME 1', 'TIME 2', 'TIME 3', 'TIME 4', 'FEED 1', 'FEED 2', 'FEED 3', 'FEED 4']);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 9px; font-weight: bold; letter-spacing: 1px;">${title}</span>
            </div>
            <div style="display: flex; gap: 8px; justify-content: space-around; text-align: center;">
                ${delayKnobs.map((name, idx) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div class="knob-ring" style="width: 20px; height: 20px; margin-bottom: 2px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size: 5px; color: #aaa; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

// ── T-Ray Delay (type 25) ──

window._renderFXTRayDelay = function(pVals) {
    const theme = window._fxThemeStyle(25);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; align-items: center; justify-content: space-between; width: 95%; border-radius: var(--radius); padding: 10px; font-family: sans-serif;">
            <div style="font-size: 11px; font-weight: bold; width: 80px; letter-spacing: -0.5px; line-height: 1; text-transform: uppercase;">Tel-Ray<br><span style="font-size:7px; color:var(--text-faint);">Delay</span></div>
            <div style="display: flex; gap: 15px; align-items: center; flex: 1; justify-content: space-around;">
                ${['Mix', 'Delay', 'Sustain', 'Wobble', 'Tone'].map((name, idx) => `
                    <div style="text-align:center;">
                        <div class="knob-ring" style="width:26px; height:26px; margin: 0 auto 3px; border-color:#000;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#000;"></div>
                        </div>
                        <span style="font-size:6px; font-weight:bold; text-transform:uppercase;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

// ── Pitch — Dual (33), Vintage (34) ──

window._renderFXPitch = function(pVals, effectType) {
    const theme = window._fxThemeStyle(effectType);
    const title = effectType === 33 ? 'DUAL PITCH' : 'VINTAGE PITCH';
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 9px; font-weight: bold; letter-spacing: 1px;">${title}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(11, 1fr); gap: 2px; text-align: center;">
                ${['HI CUT', 'SEMI 1', 'CENT 1', 'DELAY 1', 'GAIN 1', 'PAN 1', 'SEMI 2', 'CENT 2', 'DELAY 2', 'GAIN 2', 'PAN 2'].map((name, idx) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div class="knob-ring" style="width: 18px; height: 18px; margin-bottom: 2px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size: 4px; color: #bbb; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

// ── Rotary Speaker (type 35) ──

window._renderFXRotarySpeaker = function(pVals) {
    const theme = window._fxThemeStyle(35);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; align-items: center; justify-content: space-between; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="font-size: 10px; font-weight: bold; width: 70px; font-family: serif; letter-spacing: 0.5px; line-height: 1;">Rotary<br>Speaker</div>
            <div style="display: flex; gap: 8px; align-items: center; flex: 1; justify-content: space-around; margin: 0 10px;">
                ${['LO SPEED', 'HI SPEED', 'ACCEL', 'DISTANCE', 'BALANCE', 'MIX'].map((name, idx) => `
                    <div style="text-align:center;">
                        <div class="knob-ring" style="width:20px; height:20px; margin: 0 auto 2px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size:5px; color:#ddd; text-transform:uppercase; white-space:nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <button style="font-size: 6px; padding: 2px 4px; background: #ff5500; border: none; border-radius: var(--radius-xs); color: #fff; font-weight: bold;">SLOW</button>
                <button style="font-size: 6px; padding: 2px 4px; background: #333; border: none; border-radius: var(--radius-xs); color: #aaa;">FAST</button>
            </div>
        </div>
    `;
};
