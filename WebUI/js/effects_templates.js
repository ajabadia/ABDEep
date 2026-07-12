/**
 * @purpose Generates specialized HTML templates for the 35 DeepMind 12 effect types and controls dial drag/rotation logic.
 * @purpose_en Effects HTML template layouts and dial rotation services.
 */

function _readFxParamValue(paramId, fallbackByte, defaultVal) {
    const bridge = window.dualMidiBridge;
    if (bridge && bridge.parameterCache && bridge.parameterCache[paramId] !== undefined) {
        return bridge.parameterCache[paramId];
    }
    if (typeof window.currentActivePatchIndex !== 'undefined' && window.currentActivePatchIndex !== -1) {
        const activeBank = window.loadedBanks[window.currentActiveBank];
        if (activeBank) {
            const patch = activeBank[window.currentActivePatchIndex];
            if (patch && patch.unpackedBytes && patch.unpackedBytes[fallbackByte] !== undefined) {
                return patch.unpackedBytes[fallbackByte] / 255.0;
            }
        }
    }
    return defaultVal;
}
window._readFxParamValue = _readFxParamValue;

function renderActiveEffectParams() {
    const dynamicArea = document.getElementById('fx-dynamic-editor-area');
    const activeSlotLabel = document.getElementById('fx-screen-active-slot');
    if (!dynamicArea) return;

    const selectedSlot = window._selectedFxSlot || 1;
    const typeSelect = document.querySelector(`.fx-type-select[data-slot="${selectedSlot}"]`);
    if (!typeSelect) return;
    const effectType = parseInt(typeSelect.value);

    const offsetStart = selectedSlot === 1 ? 167 : (selectedSlot === 2 ? 180 : (selectedSlot === 3 ? 193 : 206));

    if (activeSlotLabel) {
        const offsetGain = selectedSlot === 1 ? 218 : (selectedSlot === 2 ? 219 : (selectedSlot === 3 ? 220 : 221));
        const gainVal = _readFxParamValue(`fx${selectedSlot}_gain`, offsetGain, 1.0);
        const paramsAll = [];
        for (let p = 1; p <= 12; p++) {
            paramsAll.push(_readFxParamValue(`fx${selectedSlot}_param${p}`, offsetStart + p - 1, 0.5));
        }
        let displayName = window.FX_TYPE_NAMES[effectType] || 'Bypass';
        if (effectType > 0 && typeof window.findMatchingFxPresetName === 'function') {
            const matchedName = window.findMatchingFxPresetName(effectType / 35.0, gainVal, paramsAll);
            if (matchedName) {
                displayName = matchedName;
            }
        }
        activeSlotLabel.innerText = `Slot: FX${selectedSlot} (${displayName})`;
    }

    let pVals = Array(8).fill(0.5);
    for (let i = 0; i < 8; i++) {
        pVals[i] = _readFxParamValue(`fx${selectedSlot}_param${i+1}`, offsetStart + i, 0.5);
    }

    dynamicArea.innerHTML = '';
    
    if (effectType === 0) { // BYPASS
        dynamicArea.innerHTML = `<span style="color:var(--text-faint); font-size:12px; font-family:'Share Tech Mono', monospace; text-transform:uppercase;">Effect Bypassed</span>`;
        return;
    }

    let templateHtml = '';

    if (effectType === 4) { // VintageRoomReverb
        templateHtml = `
            <div style="display: grid; grid-template-columns: repeat(4, 1fr) 1.2fr; gap: 8px; width: 95%; padding: 5px;">
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                        <div style="font-size:6px; color:#661100;">PRE DELAY</div>
                        <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[0] * 200)} ms</div>
                    </div>
                    <div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                        <div style="font-size:6px; color:#661100;">DECAY</div>
                        <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[1] * 100)} %</div>
                    </div>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                        <div style="font-size:6px; color:#661100;">SIZE</div>
                        <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[2] * 100)} %</div>
                    </div>
                    <div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                        <div style="font-size:6px; color:#661100;">DENSITY</div>
                        <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[3] * 100)} %</div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; align-items:center; justify-content: center; background: var(--bg-header); border-radius: var(--radius-sm); border: 1px solid var(--border-dim); padding: 4px;">
                    <div style="width:28px; height:28px; border-radius:50%; background:var(--text-dim); border:2px solid #ccc; box-shadow: inset 0 2px 4px rgba(0,0,0,0.6);"></div>
                    <span style="font-size:8px; font-weight:bold; color:#fff; margin-top:4px;">FREEZE</span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                        <div style="font-size:6px; color:#661100;">LOW MULT</div>
                        <div style="font-size:12px; font-weight:bold;">x${(pVals[4] * 2.0).toFixed(1)}</div>
                    </div>
                    <div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                        <div style="font-size:6px; color:#661100;">HIGH MULT</div>
                        <div style="font-size:12px; font-weight:bold;">x${(pVals[5] * 2.0).toFixed(1)}</div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 5px;">
                    <div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                        <div style="font-size:6px; color:#661100;">LOW CUT</div>
                        <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[6] * 500)} Hz</div>
                    </div>
                    <div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:'Share Tech Mono', monospace; color:#ff2200;">
                        <div style="font-size:6px; color:#661100;">HIGH CUT</div>
                        <div style="font-size:12px; font-weight:bold;">${Math.round(pVals[7] * 20)} kHz</div>
                    </div>
                </div>
            </div>
        `;
    } else if (effectType === 2) { // tcDeepVerb
        templateHtml = `
            <div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#2c3545; border-radius: var(--radius); padding: 12px; border: 1px solid #3d4a60;">
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
    } else if (effectType === 7) { // Plate Reverb
        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; background:var(--bg-elevated); border-radius: var(--radius); padding: 10px; border: 1px solid #2d3035; color: #fff; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 10px; font-weight: bold; color: #aaa; letter-spacing: 1px;">REVERB</span>
                    <div style="background: #0088ff; color: #000; border-radius: var(--radius-xs); font-family: 'Share Tech Mono', monospace; font-size: 11px; font-weight: bold; padding: 3px 15px; box-shadow: 0 0 8px rgba(0, 136, 255, 0.6); text-transform: uppercase;">PLATE</div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; text-align: center;">
                    ${["PRE DEL", "DECAY", "SIZE", "DAMP", "DIFF", "LO CUT", "HI CUT", "BASS M", "XOVER", "MOD DEP"].map((name, idx) => `
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
    } else if (effectType === 11 || effectType === 12 || effectType === 13) {
        let title = "CHORUS AND CHAMBER";
        if (effectType === 12) title = "DELAY AND CHAMBER";
        if (effectType === 13) title = "FLANGER AND CHAMBER";

        const leftKnobs = effectType === 11 ? ["SPEED", "DEPTH", "DELAY", "PHASE", "WAVE"] :
                          (effectType === 12 ? ["TIME", "PATTERN", "FEED HC", "FEEDBACK", "XFEED"] :
                                               ["SPEED", "DEPTH", "DELAY", "PHASE", "FEED"]);

        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; background:var(--bg-elevated); border-radius: var(--radius); padding: 8px; border: 1px solid #2d3035; color: #fff; font-family: sans-serif;">
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
                    ${["PREDELAY", "DECAY", "SIZE", "DAMPING"].map((name, idx) => `
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
    } else if (effectType === 14) { // MidasEQ
        templateHtml = `
            <div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#1b364a; border-radius: var(--radius); padding: 8px; border: 1px solid #285474; color: #fff; font-family: sans-serif;">
                <div style="font-size: 11px; font-weight: bold; width: 60px; line-height: 1; letter-spacing: -0.5px;">4 Band<br>EQ</div>
                ${["Low Freq", "Low Gain", "Low Mid Freq", "Low Mid Gain", "High Mid Freq", "High Mid Gain", "High Freq", "High Gain"].map((name, idx) => `
                    <div style="text-align:center;">
                        <div class="knob-ring" style="width:24px; height:24px; margin: 0 auto 3px;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg)"></div>
                        </div>
                        <span style="font-size:5px; text-transform:uppercase; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (effectType === 15) { // Enhancer
        templateHtml = `
            <div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#c2a15f; border-radius: var(--radius); padding: 8px; border: 1px solid #d4b87e; color: #000; font-family: sans-serif;">
                <div style="font-size: 10px; font-weight: bold; width: 80px; font-style: italic; line-height: 1;">Stereo<br>Enhancer</div>
                <div style="text-align:center;">
                    <div style="width:16px; height:16px; background:#eee; border:1px solid #555; border-radius:var(--radius-xs); margin: 0 auto 3px; cursor:pointer;"></div>
                    <span style="font-size:5px; font-weight:bold;">SOLO</span>
                </div>
                ${["Out Gain", "Spread", "Bass Gain", "Bass Freq", "Mid Gain", "Mid Q", "Hi Gain", "Hi Freq"].map((name, idx) => `
                    <div style="text-align:center;">
                        <div class="knob-ring" style="width:24px; height:24px; margin: 0 auto 3px; border-color:#000;">
                            <div class="knob-pointer" style="transform: translateX(-50%) rotate(${(pVals[idx] * 270) - 135}deg); background:#000;"></div>
                        </div>
                        <span style="font-size:5px; font-weight:bold; text-transform:uppercase; white-space: nowrap;">${name}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (effectType === 16) { // FairComp
        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; background:#202830; border-radius: var(--radius); padding: 10px; border: 1px solid #303b47; color: #fff; font-family: sans-serif;">
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
                    ${["Input Gain", "Threshold L/M", "Time L/M", "DC Bias L/M", "Output Gain", "Bias Bal", "Input Gain R/S", "Threshold R/S", "Time R/S", "DC Bias R/S", "Output Gain R/S"].map((name, idx) => `
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
    } else if (effectType === 17) { // MBDistortion
        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; background:#4d6d63; border-radius: var(--radius); padding: 8px; border: 1px solid #5a7f73; color: #fff; font-family: sans-serif;">
                <div style="text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 6px; letter-spacing: 2px;">MULTIBAND DISTORTION</div>
                <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; text-align: center;">
                    ${["INPUT GAIN", "DIST TYPE", "LOW BAND", "LOW DRIVE", "XOVER 1", "MID BAND", "MID DRIVE", "XOVER 2", "HIGH BAND", "HIGH DRIVE", "CABINET", "OUTPUT GAIN"].map((name, idx) => `
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
    } else if (effectType === 18) { // RackAmp
        templateHtml = `
            <div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#333; border-radius: var(--radius); padding: 10px; border: 1px solid var(--border-dim); color: #fff; font-family: sans-serif;">
                <div style="font-size: 12px; font-weight: bold; font-style: italic; width: 80px; letter-spacing: 1px;">Rackamp</div>
                ${["Preamp", "Buzz", "Punch", "Crunch", "Drive", "Level", "Low", "High"].map((name, idx) => `
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
    } else if (effectType === 19) { // Edison
        templateHtml = `
            <div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#e0e0e0; border-radius: var(--radius); padding: 10px; border: 1px solid #ccc; color: #000; font-family: sans-serif;">
                <div style="font-size: 10px; font-weight: bold; width: 80px; letter-spacing: -0.5px; line-height: 1;">EDISON<br>EX1+</div>
                <div style="text-align:center;">
                    <div style="width:12px; height:12px; background:#ffcc00; border:1px solid #000; margin: 0 auto 3px;"></div>
                    <span style="font-size:5px; font-weight:bold;">M/S IN</span>
                </div>
                ${["St Spread", "LMF Spread", "Balance", "Center Dist", "Output Gain"].map((name, idx) => `
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
    } else if (effectType === 20) { // AutoPan/Trem
        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; background:#10a174; border-radius: var(--radius); padding: 8px; border: 1px solid #14be8a; color: #fff; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 10px; font-weight: bold; letter-spacing: 1px;">Stereo Tremolo</span>
                    <span style="font-size: 8px; font-family: 'Share Tech Mono', monospace; color: #00ffcc;">SPEED: ${(pVals[0] * 5.0).toFixed(1)} Hz</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; text-align: center;">
                    ${["SPEED", "PHASE", "WAVE", "DEPTH", "ENV SPD", "ENV DPTH", "ATTACK", "HOLD", "RELEASE"].map((name, idx) => `
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
    } else if (effectType === 21) { // NoiseGate
        templateHtml = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 95%; background:#a82020; border-radius: var(--radius); padding: 8px; border: 1px solid #c03030; color: #000; font-family: sans-serif;">
                <div style="background:#fff; border:1px solid var(--border-dim); border-radius:var(--radius-sm); padding: 2px 6px; text-transform:uppercase; font-size:10px; font-weight:bold;">Noise Gate</div>
                <div style="display: flex; gap: 8px; align-items: center; flex: 1; justify-content: space-around;">
                    ${["Threshold", "Range", "Attack", "Release", "Hold", "Ratio", "Knee"].map((name, idx) => `
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
    } else if (effectType === 22 || effectType === 23 || effectType === 24) { // Delays
        const title = effectType === 22 ? "Stereo Delay" : (effectType === 23 ? "3-Tap Delay" : "4-Tap Delay");
        const delayKnobs = effectType === 22 ? ["TIME", "PATTERN", "FEED HC", "FEEDBACK", "XFEED", "LO CUT", "HI CUT"] :
                           (effectType === 23 ? ["TIME L", "TIME R", "TIME C", "FEED L", "FEED R", "FEED C", "LO CUT"] :
                                                ["TIME 1", "TIME 2", "TIME 3", "TIME 4", "FEED 1", "FEED 2", "FEED 3", "FEED 4"]);
        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; background:#1c2430; border-radius: var(--radius); padding: 8px; border: 1px solid #2d3848; color: #fff; font-family: sans-serif;">
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
    } else if (effectType === 25) { // T-RayDelay
        templateHtml = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 95%; background:#d2e5e9; border-radius: var(--radius); padding: 10px; border: 1px solid #b8d4dc; color: #000; font-family: sans-serif;">
                <div style="font-size: 11px; font-weight: bold; width: 80px; letter-spacing: -0.5px; line-height: 1; text-transform: uppercase;">Tel-Ray<br><span style="font-size:7px; color:var(--text-faint);">Delay</span></div>
                <div style="display: flex; gap: 15px; align-items: center; flex: 1; justify-content: space-around;">
                    ${["Mix", "Delay", "Sustain", "Wobble", "Tone"].map((name, idx) => `
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
    } else if (effectType === 31) { // Stereo Phaser
        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; background:#135634; border-radius: var(--radius); padding: 8px; border: 1px solid #1a7245; color: #fff; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 9px; font-weight: bold; letter-spacing: 1px;">Stereo Phaser</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; text-align: center;">
                    ${["SPEED", "DEPTH", "RESO", "BASE", "STAGES", "MIX", "WAVE", "PHASE", "ENV MOD", "ATTACK", "HOLD", "RELEASE"].map((name, idx) => `
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
    } else if (effectType === 32) { // Mood Filter
        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; background:#1c1d20; border-radius: var(--radius); padding: 8px; border: 1px solid #00ccff; color: #fff; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 9px; font-weight: bold; color: #00ccff;">mood filter</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(11, 1fr); gap: 2px; text-align: center;">
                    ${["SPEED", "DEPTH", "RESO", "BASE", "MODE", "MIX", "WAVE", "ENV MOD", "ATTACK", "RELEASE", "DRIVE"].map((name, idx) => `
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
    } else if (effectType === 33 || effectType === 34) {
        const title = effectType === 33 ? "DUAL PITCH" : "VINTAGE PITCH";
        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; background:#25272b; border-radius: var(--radius); padding: 8px; border: 1px solid #3d4147; color: #fff; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-size: 9px; font-weight: bold; letter-spacing: 1px;">${title}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(11, 1fr); gap: 2px; text-align: center;">
                    ${["HI CUT", "SEMI 1", "CENT 1", "DELAY 1", "GAIN 1", "PAN 1", "SEMI 2", "CENT 2", "DELAY 2", "GAIN 2", "PAN 2"].map((name, idx) => `
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
    } else if (effectType === 35) { // Rotary Speaker
        templateHtml = `
            <div style="display: align-items: center; justify-content: space-between; width: 95%; background:#502419; border-radius: var(--radius); padding: 8px; border: 1px solid #6b3528; color: #fff; font-family: sans-serif; display: flex;">
                <div style="font-size: 10px; font-weight: bold; width: 70px; font-family: serif; letter-spacing: 0.5px; line-height: 1;">Rotary<br>Speaker</div>
                <div style="display: flex; gap: 8px; align-items: center; flex: 1; justify-content: space-around; margin: 0 10px;">
                    ${["LO SPEED", "HI SPEED", "ACCEL", "DISTANCE", "BALANCE", "MIX"].map((name, idx) => `
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
    } else if (effectType === 9 || effectType === 10) {
        const title = effectType === 9 ? "GATED" : "REVERSE";
        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; background:var(--bg-elevated); border-radius: var(--radius); padding: 10px; border: 1px solid #2d3035; color: #fff; font-family: sans-serif;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 10px; font-weight: bold; color: #aaa; letter-spacing: 1px;">REVERB</span>
                    <div style="background: #00ff66; color: #000; border-radius: var(--radius-xs); font-family: 'Share Tech Mono', monospace; font-size: 11px; font-weight: bold; padding: 3px 15px; box-shadow: 0 0 8px rgba(0, 255, 102, 0.6); text-transform: uppercase;">${title}</div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; text-align: center;">
                    ${["PRE DEL", "DECAY", "ATTACK", "DENSITY", "SPREAD", "LO CUT", "HI CUT", "HI S G", "DIFF"].map((name, idx) => `
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
    } else {
        let typeName = "AMBIENCE";
        if (effectType === 3) typeName = "ROOM REV";
        if (effectType === 5) typeName = "HALL REV";
        if (effectType === 6) typeName = "CHAMBER";
        if (effectType === 8) typeName = "RICH PLATE";

        templateHtml = `
            <div style="display: flex; flex-direction: column; width: 95%; gap: 6px;">
                <div style="display: grid; grid-template-columns: repeat(6, 1fr); text-align: center; font-family:'Share Tech Mono', monospace; color:#00ccff; font-size:10px;">
                    <div>PRE DEL<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[0] * 100)}ms</span></div>
                    <div>DECAY<br><span style="color:#ff2200; font-size:7px;">${(pVals[1] * 4.0).toFixed(2)}s</span></div>
                    <div>SIZE<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[2] * 10)}</span></div>
                    <div>DAMPING<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[3] * 10)}kHz</span></div>
                    <div>DIFFUSE<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[4] * 100)}%</span></div>
                    <div>MIX<br><span style="color:#ff2200; font-size:7px;">${Math.round(pVals[5] * 100)}%</span></div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(6, 1fr); justify-items: center; align-items: center;">
                    ${Array(6).fill(0).map((_, idx) => `
                        <div class="ctrl-unit" data-param="fx${selectedSlot}_param${idx+1}" style="align-items: center; display: flex; flex-direction: column;">
                            <div class="v-slider" style="height: 80px;">
                                <div class="track"></div>
                                <div class="handle" style="top: ${(1.0 - pVals[idx]) * 64}px;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    dynamicArea.innerHTML = templateHtml;

    dynamicArea.querySelectorAll('.v-slider').forEach((slider, idx) => {
        const handle = slider.querySelector('.handle');
        let isDragging = false;
        
        const updateVal = (clientY) => {
            const rect = slider.getBoundingClientRect();
            const handleHeight = 16;
            const limit = rect.height - handleHeight;
            let y = clientY - rect.top - (handleHeight / 2);
            y = Math.max(0, Math.min(limit, y));
            handle.style.top = y + 'px';

            const val = 1.0 - (y / limit);
            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(`fx${selectedSlot}_param${idx+1}`, val);
            }
        };

        function onSliderMove(e) {
            if (isDragging) updateVal(e.clientY);
        }
        function onSliderEnd() {
            isDragging = false;
            window.removeEventListener('mousemove', onSliderMove);
            window.removeEventListener('mouseup', onSliderEnd);
        }
        slider.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateVal(e.clientY);
            e.preventDefault();
            e.stopPropagation();
            window.addEventListener('mousemove', onSliderMove);
            window.addEventListener('mouseup', onSliderEnd);
        });
    });

    dynamicArea.querySelectorAll('.knob-ring').forEach((knob, idx) => {
        const pointer = knob.querySelector('.knob-pointer');
        let isDragging = false;
        let startY = 0;
        let startVal = 0.5;

        if (pVals && pVals[idx] !== undefined) {
            startVal = pVals[idx];
        }

        function onKnobMove(e) {
            if (!isDragging) return;
            const dy = startY - e.clientY;
            let val = startVal + (dy / 150.0);
            val = Math.max(0.0, Math.min(1.0, val));
            
            if (pointer) {
                pointer.style.transform = `translateX(-50%) rotate(${(val * 270) - 135}deg)`;
            }

            if (window.dualMidiBridge) {
                window.dualMidiBridge.setParameter(`fx${selectedSlot}_param${idx+1}`, val);
            }
        }
        function onKnobEnd(e) {
            if (isDragging) {
                isDragging = false;
                const dy = startY - e.clientY;
                let val = startVal + (dy / 150.0);
                startVal = Math.max(0.0, Math.min(1.0, val));
            }
            window.removeEventListener('mousemove', onKnobMove);
            window.removeEventListener('mouseup', onKnobEnd);
        }
        knob.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            e.preventDefault();
            e.stopPropagation();
            window.addEventListener('mousemove', onKnobMove);
            window.addEventListener('mouseup', onKnobEnd);
        });
    });
}
window.renderActiveEffectParams = renderActiveEffectParams;
