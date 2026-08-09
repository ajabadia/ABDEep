/**
 * @purpose Modulation category effect HTML renderers (types 18, 19, 20, 21, 31, 32).
 * Extracted from effects_templates_renderers.js.
 * Each renderer takes (pVals[, effectType][, selectedSlot]) and returns an HTML string.
 */

// ── RackAmp (type 18) ──

window._renderFXRackAmp = function(pVals) {
    const theme = window._fxThemeStyle(18);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; align-items: center; justify-content: space-around; width: 95%; border-radius: var(--radius); padding: 10px; font-family: sans-serif;">
            <div style="font-size: 12px; font-weight: bold; font-style: italic; width: 80px; letter-spacing: 1px;">Rackamp</div>
            ${['Preamp', 'Buzz', 'Punch', 'Crunch', 'Drive', 'Level', 'Low', 'High'].map((name, idx) => `
                <div style="text-align:center;">
                    <div class="knob-ring" style="width:26px; height:26px; margin: 0 auto 3px;">
                        <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                    </div>
                    <span style="font-size:6px; color:#aaa; text-transform:uppercase;">${name}</span>
                </div>
            `).join('')}
            <div style="text-align:center;">
                <div style="width:14px; height:14px; border-radius:50%; background:#00ff66; border:1px solid #fff; margin: 0 auto 3px; box-shadow: 0 0 6px #00ff66;"></div>
                <span style="font-size:5px; font-weight:bold;">CABINET</span>
            </div>
        </div>
    `;
};

// ── Edison (type 19) ──

window._renderFXEdison = function(pVals) {
    const theme = window._fxThemeStyle(19);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; align-items: center; justify-content: space-around; width: 95%; border-radius: var(--radius); padding: 10px; font-family: sans-serif;">
            <div style="font-size: 10px; font-weight: bold; width: 80px; letter-spacing: -0.5px; line-height: 1;">EDISON<br>EX1+</div>
            <div style="text-align:center;">
                <div style="width:12px; height:12px; background:#ffcc00; border:1px solid #000; margin: 0 auto 3px;"></div>
                <span style="font-size:5px; font-weight:bold;">M/S IN</span>
            </div>
            ${['St Spread', 'LMF Spread', 'Balance', 'Center Dist', 'Output Gain'].map((name, idx) => `
                <div style="text-align:center;">
                    <div class="knob-ring" style="width:26px; height:26px; margin: 0 auto 3px; border-color:#000;">
                        <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#000;"></div>
                    </div>
                    <span style="font-size:6px; font-weight:bold; text-transform:uppercase; white-space: nowrap;">${name}</span>
                </div>
            `).join('')}
            <div style="text-align:center;">
                <div style="width:12px; height:12px; background:var(--border-dim); border:1px solid #000; margin: 0 auto 3px;"></div>
                <span style="font-size:5px; font-weight:bold;">M/S OUT</span>
            </div>
        </div>
    `;
};

// ── AutoPan / Tremolo (type 20) ──

window._renderFXAutoPan = function(pVals) {
    const theme = window._fxThemeStyle(20);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 10px; font-weight: bold; letter-spacing: 1px;">Stereo Tremolo</span>
                <span style="font-size: 8px; font-family: 'Share Tech Mono', monospace; color: #00ffcc;">SPEED: ${(pVals[0] * 5.0).toFixed(1)} Hz</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; text-align: center;">
                ${['SPEED', 'PHASE', 'WAVE', 'DEPTH', 'ENV SPD', 'ENV DPTH', 'ATTACK', 'HOLD', 'RELEASE'].map((name, idx) => `
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

// ── NoiseGate (type 21) ──

window._renderFXNoiseGate = function(pVals) {
    const theme = window._fxThemeStyle(21);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; align-items: center; justify-content: space-between; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="background:#fff; border:1px solid var(--border-dim); border-radius:var(--radius-sm); padding: 2px 6px; text-transform:uppercase; font-size:10px; font-weight:bold;">Noise Gate</div>
            <div style="display: flex; gap: 8px; align-items: center; flex: 1; justify-content: space-around;">
                ${['Threshold', 'Range', 'Attack', 'Release', 'Hold', 'Ratio', 'Knee'].map((name, idx) => `
                    <div style="text-align:center; color:#fff;">
                        <div class="knob-ring" style="width:22px; height:22px; margin: 0 auto 2px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size:5px; color:#ddd; text-transform:uppercase; white-space:nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

// ── Stereo Phaser (type 31) ──

window._renderFXStereoPhaser = function(pVals) {
    const theme = window._fxThemeStyle(31);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 9px; font-weight: bold; letter-spacing: 1px;">Stereo Phaser</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; text-align: center;">
                ${['SPEED', 'DEPTH', 'RESO', 'BASE', 'STAGES', 'MIX', 'WAVE', 'PHASE', 'ENV MOD', 'ATTACK', 'HOLD', 'RELEASE'].map((name, idx) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div class="knob-ring" style="width: 18px; height: 18px; margin-bottom: 2px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size: 4px; color: #e0e0e0; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

// ── Mood Filter (type 32) ──

window._renderFXMoodFilter = function(pVals) {
    const theme = window._fxThemeStyle(32);
    return `
        <div class="fx-theme-custom" style="${theme} display: flex; flex-direction: column; width: 95%; border-radius: var(--radius); padding: 8px; font-family: sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 9px; font-weight: bold; color: #00ccff;">mood filter</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(11, 1fr); gap: 2px; text-align: center;">
                ${['SPEED', 'DEPTH', 'RESO', 'BASE', 'MODE', 'MIX', 'WAVE', 'ENV MOD', 'ATTACK', 'RELEASE', 'DRIVE'].map((name, idx) => `
                    <div style="display: flex; flex-direction: column; align-items: center;">
                        <div class="knob-ring" style="width: 18px; height: 18px; margin-bottom: 2px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size: 4px; color: #aaa; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};
