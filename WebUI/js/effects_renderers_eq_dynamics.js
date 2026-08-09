/**
 * @purpose EQ/Dynamics category effect HTML renderers (types 14, 15, 16, 17).
 * Extracted from effects_templates_renderers.js.
 * Each renderer takes (pVals[, effectType][, selectedSlot]) and returns an HTML string.
 */

// ── MidasEQ (type 14) ──

window._renderFXMidasEQ = function(pVals) {
    const theme = window._fxThemeStyle(14);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; align-items: center; justify-content: space-around; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="font-size: 11px; font-weight: bold; width: 60px; line-height: 1; letter-spacing: -0.5px;">4 Band<br>EQ</div>
            ${['Low Freq', 'Low Gain', 'Low Mid Freq', 'Low Mid Gain', 'High Mid Freq', 'High Mid Gain', 'High Freq', 'High Gain'].map((name, idx) => `
                <div style="text-align:center;">
                    <div class="knob-ring" style="width:24px; height:24px; margin: 0 auto 3px;">
                        <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                    </div>
                    <span style="font-size:5px; text-transform:uppercase; white-space: nowrap;">${name}</span>
                </div>
            `).join('')}
        </div>
    `;
};

// ── Enhancer (type 15) ──

window._renderFXEnhancer = function(pVals) {
    const theme = window._fxThemeStyle(15);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; align-items: center; justify-content: space-around; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="font-size: 10px; font-weight: bold; width: 80px; font-style: italic; line-height: 1;">Stereo<br>Enhancer</div>
            <div style="text-align:center;">
                <div style="width:16px; height:16px; background:#eee; border:1px solid #555; border-radius:var(--radius-xs); margin: 0 auto 3px; cursor:pointer;"></div>
                <span style="font-size:5px; font-weight:bold;">SOLO</span>
            </div>
            ${['Out Gain', 'Spread', 'Bass Gain', 'Bass Freq', 'Mid Gain', 'Mid Q', 'Hi Gain', 'Hi Freq'].map((name, idx) => `
                <div style="text-align:center;">
                    <div class="knob-ring" style="width:24px; height:24px; margin: 0 auto 3px; border-color:#000;">
                        <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#000;"></div>
                    </div>
                    <span style="font-size:5px; font-weight:bold; text-transform:uppercase; white-space: nowrap;">${name}</span>
                </div>
            `).join('')}
        </div>
    `;
};

// ── FairComp (type 16) ──

window._renderFXFairComp = function(pVals) {
    const theme = window._fxThemeStyle(16);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; border-radius: var(--radius); padding: 10px; font-family: sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 10px; font-weight: bold; color: #fff; letter-spacing: 1px;">FAIR COMPRESSOR</span>
                <div style="display: flex; gap: 3px; align-items:center;">
                    <span style="font-size: 6px; color:var(--text-dim);">Mode Selection:</span>
                    <div style="background:#111; display:flex; padding: 1px; border:1px solid var(--border-dim); border-radius:var(--radius-xs);">
                        <div style="font-size:6px; padding:1px 3px; background:var(--border-dim);">ST</div>
                        <div style="font-size:6px; padding:1px 3px; color:#666;">DUA</div>
                        <div style="font-size:6px; padding:1px 3px; color:#666;">M/S</div>
                    </div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; text-align: center;">
                ${['Input Gain', 'Threshold L/M', 'Time L/M', 'DC Bias L/M', 'Output Gain', 'Bias Bal', 'Input Gain R/S', 'Threshold R/S', 'Time R/S', 'DC Bias R/S', 'Output Gain R/S'].map((name, idx) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div class="knob-ring" style="width: 24px; height: 24px; margin-bottom: 2px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size: 5px; color: #aaa; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

// ── MBDistortion (type 17) ──

window._renderFXMBDistortion = function(pVals) {
    const theme = window._fxThemeStyle(17);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 6px; letter-spacing: 2px;">MULTIBAND DISTORTION</div>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; text-align: center;">
                ${['INPUT GAIN', 'DIST TYPE', 'LOW BAND', 'LOW DRIVE', 'XOVER 1', 'MID BAND', 'MID DRIVE', 'XOVER 2', 'HIGH BAND', 'HIGH DRIVE', 'CABINET', 'OUTPUT GAIN'].map((name, idx) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div class="knob-ring" style="width: 22px; height: 22px; margin-bottom: 2px; border-color:#fff;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#fff;"></div>
                        </div>
                        <span style="font-size: 5px; color: #e0e0e0; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};
