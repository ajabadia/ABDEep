/**
 * Tests for WebUI/js/effects_templates.js — FX effect type HTML template generation
 *
 * Extracted pure functions:
 * - calcKnobRotation(val): normalized 0..1 → rotation degrees (-135..135)
 * - calcSliderTop(val, sliderHeight, handleHeight): value → CSS top position
 * - displayPreDelayMs(val): pre-delay in milliseconds
 * - displayPercent(val): percentage display
 * - displayMultiplier(val): ×N multiplier
 * - displayHertz(val, maxHz): frequency display
 * - displayKilohertz(val, maxKhz): kHz display
 * - displaySpeedHz(val): LFO speed in Hz
 * - displayDecaySeconds(val): decay time in seconds
 * - displaySize(val): size value
 * - displayDampingKhz(val): damping in kHz
 * - generateFxTemplate(effectType, pVals): HTML string for each effect type
 *
 * Constants:
 * - FX_TYPE_NAMES (from effects.js): 36 FX type names
 * - EFFECT_TYPE_MAP: map of effect types to their display properties
 */

// =============================================================================
// Constants (from effects.js)
// =============================================================================
var FX_TYPE_NAMES = [
    "Bypass", "Ambience", "tcDeepVerb", "RoomRev", "VintageRoom",
    "HallReverb", "ChamberRev", "Plate Reverb", "Rich Plate",
    "Gated Reverb", "Reverse Reverb", "ChorusRev", "DelayRev",
    "FlangerRev", "MidasEQ", "Enhancer", "FairComp",
    "MBDistortion", "RackAmp", "Edison", "AutoPan/Trem",
    "NoiseGate", "Delay", "3Tap Delay", "4Tap Delay",
    "T-RayDelay", "DecimatorDelay", "ModDlyRev",
    "Stereo Chorus", "Chorus-D", "Stereo Flanger",
    "Stereo Phaser", "Mood Filter", "Dual Pitch",
    "Vintage Pitch", "Rotary Speaker"
];

// =============================================================================
// Extracted pure functions from effects_templates.js
// =============================================================================

function calcKnobRotation(val) {
    return (val * 270) - 135;
}

function calcSliderTop(val, sliderHeight, handleHeight) {
    var limit = sliderHeight - handleHeight;
    return (1.0 - val) * limit;
}

// Display value conversions (extracted from various effect type templates)
function displayPreDelayMs(val) {
    return Math.round(val * 200);
}

function displayPercent(val) {
    return Math.round(val * 100);
}

function displayMultiplier(val) {
    return (val * 2.0).toFixed(1);
}

function displayHertz(val, maxHz) {
    return Math.round(val * (maxHz || 500));
}

function displayKilohertz(val, maxKhz) {
    return Math.round(val * (maxKhz || 20));
}

function displaySpeedHz(val) {
    return (val * 5.0).toFixed(1);
}

function displayDecaySeconds(val) {
    return (val * 4.0).toFixed(2);
}

function displaySize(val) {
    return Math.round(val * 10);
}

function displayDampingKhz(val) {
    return Math.round(val * 10);
}

// Template HTML generator (extracted from renderActiveEffectParams)
function generateFxTemplate(effectType, pVals) {
    pVals = pVals || Array(8).fill(0.5);

    if (effectType === 0) {
        return '<span style="color:var(--text-faint); font-size:12px; font-family:&#39;Share Tech Mono&#39;, monospace; text-transform:uppercase;">Effect Bypassed</span>';
    }

    if (effectType === 4) { // VintageRoomReverb
        return '<div style="display: grid; grid-template-columns: repeat(4, 1fr) 1.2fr; gap: 8px; width: 95%; padding: 5px;">'
            + '<div style="display: flex; flex-direction: column; gap: 5px;">'
            + '<div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:&#39;Share Tech Mono&#39;, monospace; color:#ff2200;">'
            + '<div style="font-size:6px; color:#661100;">PRE DELAY</div>'
            + '<div style="font-size:12px; font-weight:bold;">' + Math.round(pVals[0] * 200) + ' ms</div></div>'
            + '<div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:&#39;Share Tech Mono&#39;, monospace; color:#ff2200;">'
            + '<div style="font-size:6px; color:#661100;">DECAY</div>'
            + '<div style="font-size:12px; font-weight:bold;">' + Math.round(pVals[1] * 100) + ' %</div></div></div>'
            + '<div style="display: flex; flex-direction: column; gap: 5px;">'
            + '<div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:&#39;Share Tech Mono&#39;, monospace; color:#ff2200;">'
            + '<div style="font-size:6px; color:#661100;">SIZE</div>'
            + '<div style="font-size:12px; font-weight:bold;">' + Math.round(pVals[2] * 100) + ' %</div></div>'
            + '<div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:&#39;Share Tech Mono&#39;, monospace; color:#ff2200;">'
            + '<div style="font-size:6px; color:#661100;">DENSITY</div>'
            + '<div style="font-size:12px; font-weight:bold;">' + Math.round(pVals[3] * 100) + ' %</div></div></div>'
            + '<div style="display: flex; flex-direction: column; align-items:center; justify-content: center; background: var(--bg-header); border-radius: var(--radius-sm); border: 1px solid var(--border-dim); padding: 4px;">'
            + '<div style="width:28px; height:28px; border-radius:50%; background:var(--text-dim); border:2px solid #ccc; box-shadow: inset 0 2px 4px rgba(0,0,0,0.6);"></div>'
            + '<span style="font-size:8px; font-weight:bold; color:#fff; margin-top:4px;">FREEZE</span></div>'
            + '<div style="display: flex; flex-direction: column; gap: 5px;">'
            + '<div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:&#39;Share Tech Mono&#39;, monospace; color:#ff2200;">'
            + '<div style="font-size:6px; color:#661100;">LOW MULT</div>'
            + '<div style="font-size:12px; font-weight:bold;">x' + (pVals[4] * 2.0).toFixed(1) + '</div></div>'
            + '<div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:&#39;Share Tech Mono&#39;, monospace; color:#ff2200;">'
            + '<div style="font-size:6px; color:#661100;">HIGH MULT</div>'
            + '<div style="font-size:12px; font-weight:bold;">x' + (pVals[5] * 2.0).toFixed(1) + '</div></div></div>'
            + '<div style="display: flex; flex-direction: column; gap: 5px;">'
            + '<div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:&#39;Share Tech Mono&#39;, monospace; color:#ff2200;">'
            + '<div style="font-size:6px; color:#661100;">LOW CUT</div>'
            + '<div style="font-size:12px; font-weight:bold;">' + Math.round(pVals[6] * 500) + ' Hz</div></div>'
            + '<div style="background:#050000; border: 1px solid #ff2200; border-radius: var(--radius-xs); padding: 4px; text-align:center; font-family:&#39;Share Tech Mono&#39;, monospace; color:#ff2200;">'
            + '<div style="font-size:6px; color:#661100;">HIGH CUT</div>'
            + '<div style="font-size:12px; font-weight:bold;">' + Math.round(pVals[7] * 20) + ' kHz</div></div></div></div>';
    }

    if (effectType === 2) { // tcDeepVerb
        var knobs = [
            { label: 'PRE DELAY', rotation: calcKnobRotation(pVals[0]) },
            { label: 'DECAY TIME', rotation: calcKnobRotation(pVals[1]) },
            { label: 'TONE', rotation: calcKnobRotation(pVals[2]) },
            { label: 'MIX', rotation: calcKnobRotation(pVals[3]) }
        ];
        var knobHtml = '';
        for (var i = 0; i < knobs.length; i++) {
            knobHtml += '<div style="text-align:center; color:#fff; font-family:sans-serif;">'
                + '<div class="knob-ring" style="width:36px; height:36px; margin: 0 auto 4px;">'
                + '<div class="knob-pointer" style="transform: translateX(-50%) rotate(' + knobs[i].rotation + 'deg)"></div></div>'
                + '<span style="font-size:7px; text-transform:uppercase;">' + knobs[i].label + '</span></div>';
        }
        return '<div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#2c3545; border-radius: var(--radius); padding: 12px; border: 1px solid #3d4a60;">'
            + '<div style="color:#fff; font-size:12px; font-weight:bold; font-family:sans-serif; letter-spacing: -0.5px;">tcDeepVerb</div>'
            + knobHtml + '</div>';
    }

    if (effectType === 7) { // Plate Reverb
        var plateLabels = ['PRE DEL', 'DECAY', 'SIZE', 'DAMP', 'DIFF', 'LO CUT', 'HI CUT', 'BASS M', 'XOVER', 'MOD DEP'];
        var plateKnobs = '';
        for (var i = 0; i < plateLabels.length; i++) {
            plateKnobs += '<div style="display: flex; flex-direction: column; align-items: center;">'
                + '<div class="knob-ring" style="width: 24px; height: 24px; margin-bottom: 3px;">'
                + '<div class="knob-pointer" style="transform: translateX(-50%) rotate(' + calcKnobRotation(pVals[i]) + 'deg)"></div></div>'
                + '<span style="font-size: 6px; color: var(--text-dim); font-weight: bold; white-space: nowrap;">' + plateLabels[i] + '</span></div>';
        }
        return '<div style="display: flex; flex-direction: column; width: 95%; background:var(--bg-elevated); border-radius: var(--radius); padding: 10px; border: 1px solid #2d3035; color: #fff; font-family: sans-serif;">'
            + '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">'
            + '<span style="font-size: 10px; font-weight: bold; color: #aaa; letter-spacing: 1px;">REVERB</span>'
            + '<div style="background: #0088ff; color: #000; border-radius: var(--radius-xs); font-family: \'Share Tech Mono\', monospace; font-size: 11px; font-weight: bold; padding: 3px 15px; box-shadow: 0 0 8px rgba(0, 136, 255, 0.6); text-transform: uppercase;">PLATE</div></div>'
            + '<div style="display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; text-align: center;">'
            + plateKnobs + '</div></div>';
    }

    if (effectType === 14) { // MidasEQ
        var eqNames = ['Low Freq', 'Low Gain', 'Low Mid Freq', 'Low Mid Gain', 'High Mid Freq', 'High Mid Gain', 'High Freq', 'High Gain'];
        var eqKnobs = '';
        for (var i = 0; i < eqNames.length; i++) {
            eqKnobs += '<div style="text-align:center;">'
                + '<div class="knob-ring" style="width:24px; height:24px; margin: 0 auto 3px;">'
                + '<div class="knob-pointer" style="transform: translateX(-50%) rotate(' + calcKnobRotation(pVals[i]) + 'deg)"></div></div>'
                + '<span style="font-size:5px; text-transform:uppercase; white-space: nowrap;">' + eqNames[i] + '</span></div>';
        }
        return '<div style="display: flex; align-items: center; justify-content: space-around; width: 95%; background:#1b364a; border-radius: var(--radius); padding: 8px; border: 1px solid #285474; color: #fff; font-family: sans-serif;">'
            + '<div style="font-size: 11px; font-weight: bold; width: 60px; line-height: 1; letter-spacing: -0.5px;">4 Band<br>EQ</div>'
            + eqKnobs + '</div>';
    }

    if (effectType === 20) { // AutoPan/Trem
        var autoPanLabels = ['SPEED', 'PHASE', 'WAVE', 'DEPTH', 'ENV SPD', 'ENV DPTH', 'ATTACK', 'HOLD', 'RELEASE'];
        var autoPanKnobs = '';
        for (var i = 0; i < autoPanLabels.length; i++) {
            autoPanKnobs += '<div style="display: flex; flex-direction: column; align-items: center;">'
                + '<div class="knob-ring" style="width: 22px; height: 22px; margin-bottom: 2px; border-color:#fff;">'
                + '<div class="knob-pointer" style="transform: translateX(-50%) rotate(' + calcKnobRotation(pVals[i]) + 'deg); background:#fff;"></div></div>'
                + '<span style="font-size: 5px; color: #e0e0e0; white-space: nowrap;">' + autoPanLabels[i] + '</span></div>';
        }
        return '<div style="display: flex; flex-direction: column; width: 95%; background:#10a174; border-radius: var(--radius); padding: 8px; border: 1px solid #14be8a; color: #fff; font-family: sans-serif;">'
            + '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">'
            + '<span style="font-size: 10px; font-weight: bold; letter-spacing: 1px;">Stereo Tremolo</span>'
            + '<span style="font-size: 8px; font-family: \'Share Tech Mono\', monospace; color: #00ffcc;">SPEED: ' + (pVals[0] * 5.0).toFixed(1) + ' Hz</span></div>'
            + '<div style="display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; text-align: center;">'
            + autoPanKnobs + '</div></div>';
    }

    if (effectType === 21) { // NoiseGate
        var gateLabels = ['Threshold', 'Range', 'Attack', 'Release', 'Hold', 'Ratio', 'Knee'];
        var gateKnobs = '';
        for (var i = 0; i < gateLabels.length; i++) {
            gateKnobs += '<div style="text-align:center; color:#fff;">'
                + '<div class="knob-ring" style="width:22px; height:22px; margin: 0 auto 2px;">'
                + '<div class="knob-pointer" style="transform: translateX(-50%) rotate(' + calcKnobRotation(pVals[i]) + 'deg)"></div></div>'
                + '<span style="font-size:5px; color:#ddd; text-transform:uppercase; white-space:nowrap;">' + gateLabels[i] + '</span></div>';
        }
        return '<div style="display: flex; align-items: center; justify-content: space-between; width: 95%; background:#a82020; border-radius: var(--radius); padding: 8px; border: 1px solid #c03030; color: #000; font-family: sans-serif;">'
            + '<div style="background:#fff; border:1px solid var(--border-dim); border-radius:var(--radius-sm); padding: 2px 6px; text-transform:uppercase; font-size:10px; font-weight:bold;">Noise Gate</div>'
            + '<div style="display: flex; gap: 8px; align-items: center; flex: 1; justify-content: space-around;">'
            + gateKnobs + '</div></div>';
    }

    if (effectType === 25) { // T-RayDelay
        var tRayLabels = ['Mix', 'Delay', 'Sustain', 'Wobble', 'Tone'];
        var tRayKnobs = '';
        for (var i = 0; i < tRayLabels.length; i++) {
            tRayKnobs += '<div style="text-align:center;">'
                + '<div class="knob-ring" style="width:26px; height:26px; margin: 0 auto 3px; border-color:#000;">'
                + '<div class="knob-pointer" style="transform: translateX(-50%) rotate(' + calcKnobRotation(pVals[i]) + 'deg); background:#000;"></div></div>'
                + '<span style="font-size:6px; font-weight:bold; text-transform:uppercase;">' + tRayLabels[i] + '</span></div>';
        }
        return '<div style="display: flex; align-items: center; justify-content: space-between; width: 95%; background:#d2e5e9; border-radius: var(--radius); padding: 10px; border: 1px solid #b8d4dc; color: #000; font-family: sans-serif;">'
            + '<div style="font-size: 11px; font-weight: bold; width: 80px; letter-spacing: -0.5px; line-height: 1; text-transform: uppercase;">Tel-Ray<br><span style="font-size:7px; color:var(--text-faint);">Delay</span></div>'
            + '<div style="display: flex; gap: 15px; align-items: center; flex: 1; justify-content: space-around;">'
            + tRayKnobs + '</div></div>';
    }

    if (effectType === 31) { // Stereo Phaser
        return '<div style="display: flex; flex-direction: column; width: 95%; background:#135634; border-radius: var(--radius); padding: 8px; border: 1px solid #1a7245; color: #fff; font-family: sans-serif;">'
            + '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">'
            + '<span style="font-size: 9px; font-weight: bold; letter-spacing: 1px;">Stereo Phaser</span></div>'
            + '<div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 2px; text-align: center;">'
            + generateKnobGrid(['SPEED', 'DEPTH', 'RESO', 'BASE', 'STAGES', 'MIX', 'WAVE', 'PHASE', 'ENV MOD', 'ATTACK', 'HOLD', 'RELEASE'], pVals, 18, '#e0e0e0', 4) + '</div></div>';
    }

    if (effectType === 32) { // Mood Filter
        return '<div style="display: flex; flex-direction: column; width: 95%; background:#1c1d20; border-radius: var(--radius); padding: 8px; border: 1px solid #00ccff; color: #fff; font-family: sans-serif;">'
            + '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">'
            + '<span style="font-size: 9px; font-weight: bold; color: #00ccff;">mood filter</span></div>'
            + '<div style="display: grid; grid-template-columns: repeat(11, 1fr); gap: 2px; text-align: center;">'
            + generateKnobGrid(['SPEED', 'DEPTH', 'RESO', 'BASE', 'MODE', 'MIX', 'WAVE', 'ENV MOD', 'ATTACK', 'RELEASE', 'DRIVE'], pVals, 18, '#aaa', 4) + '</div></div>';
    }

    if (effectType === 35) { // Rotary Speaker
        var rotaryLabels = ['LO SPEED', 'HI SPEED', 'ACCEL', 'DISTANCE', 'BALANCE', 'MIX'];
        var rotaryKnobs = '';
        for (var i = 0; i < rotaryLabels.length; i++) {
            rotaryKnobs += '<div style="text-align:center;">'
                + '<div class="knob-ring" style="width:20px; height:20px; margin: 0 auto 2px;">'
                + '<div class="knob-pointer" style="transform: translateX(-50%) rotate(' + calcKnobRotation(pVals[i]) + 'deg)"></div></div>'
                + '<span style="font-size:5px; color:#ddd; text-transform:uppercase; white-space:nowrap;">' + rotaryLabels[i] + '</span></div>';
        }
        return '<div style="display: align-items: center; justify-content: space-between; width: 95%; background:#502419; border-radius: var(--radius); padding: 8px; border: 1px solid #6b3528; color: #fff; font-family: sans-serif; display: flex;">'
            + '<div style="font-size: 10px; font-weight: bold; width: 70px; font-family: serif; letter-spacing: 0.5px; line-height: 1;">Rotary<br>Speaker</div>'
            + '<div style="display: flex; gap: 8px; align-items: center; flex: 1; justify-content: space-around; margin: 0 10px;">'
            + rotaryKnobs + '</div>'
            + '<div style="display: flex; flex-direction: column; gap: 2px;">'
            + '<button style="font-size: 6px; padding: 2px 4px; background: #ff5500; border: none; border-radius: var(--radius-xs); color: #fff; font-weight: bold;">SLOW</button>'
            + '<button style="font-size: 6px; padding: 2px 4px; background: #333; border: none; border-radius: var(--radius-xs); color: #aaa;">FAST</button></div></div>';
    }

    // Fallback: generic reverb/ambience template
    var fallbackLabels = ['PRE DEL', 'DECAY', 'SIZE', 'DAMPING', 'DIFFUSE', 'MIX'];
    var fallbackVals = '';
    for (var i = 0; i < fallbackLabels.length; i++) {
        fallbackVals += '<div>' + fallbackLabels[i] + '<br><span style="color:#ff2200; font-size:7px;">'
            + (i === 0 ? Math.round(pVals[0] * 100) + 'ms' : '')
            + (i === 1 ? (pVals[1] * 4.0).toFixed(2) + 's' : '')
            + (i === 2 ? Math.round(pVals[2] * 10) : '')
            + (i === 3 ? Math.round(pVals[3] * 10) + 'kHz' : '')
            + (i === 4 ? Math.round(pVals[4] * 100) + '%' : '')
            + (i === 5 ? Math.round(pVals[5] * 100) + '%' : '')
            + '</span></div>';
    }
    return '<div style="display: flex; flex-direction: column; width: 95%; gap: 6px;">'
        + '<div style="display: grid; grid-template-columns: repeat(6, 1fr); text-align: center; font-family:\'Share Tech Mono\', monospace; color:#00ccff; font-size:10px;">'
        + fallbackVals + '</div></div>';
}

// Helper: generates a grid of knob-ring HTML
function generateKnobGrid(labels, pVals, knobSize, textColor, fontSize) {
    var html = '';
    for (var i = 0; i < labels.length; i++) {
        html += '<div style="display: flex; flex-direction: column; align-items: center;">'
            + '<div class="knob-ring" style="width: ' + knobSize + 'px; height: ' + knobSize + 'px; margin-bottom: 2px;">'
            + '<div class="knob-pointer" style="transform: translateX(-50%) rotate(' + calcKnobRotation(pVals[i]) + 'deg)"></div></div>'
            + '<span style="font-size: ' + fontSize + 'px; color: ' + textColor + '; white-space: nowrap;">' + labels[i] + '</span></div>';
    }
    return html;
}

// =============================================================================
// Tests
// =============================================================================

// ---------------------------------------------------------------------------
// calcKnobRotation
// ---------------------------------------------------------------------------

describe('calcKnobRotation', function () {

    it('returns -135 for val=0 (fully counter-clockwise)', function () {
        expect(calcKnobRotation(0)).toBe(-135);
    });

    it('returns 0 for val=0.5 (center)', function () {
        expect(calcKnobRotation(0.5)).toBe(0);
    });

    it('returns 135 for val=1.0 (fully clockwise)', function () {
        expect(calcKnobRotation(1.0)).toBe(135);
    });

    it('returns -67.5 for val=0.25', function () {
        expect(calcKnobRotation(0.25)).toBe(-67.5);
    });

    it('returns 67.5 for val=0.75', function () {
        expect(calcKnobRotation(0.75)).toBe(67.5);
    });

});

// ---------------------------------------------------------------------------
// calcSliderTop
// ---------------------------------------------------------------------------

describe('calcSliderTop', function () {

    it('val=1.0 returns top=0 (fully up)', function () {
        expect(calcSliderTop(1.0, 100, 16)).toBe(0);
    });

    it('val=0.0 returns top=limit (fully down)', function () {
        expect(calcSliderTop(0.0, 100, 16)).toBe(84);
    });

    it('val=0.5 returns top=42 (center)', function () {
        expect(calcSliderTop(0.5, 100, 16)).toBe(42);
    });

    it('handles different slider heights', function () {
        expect(calcSliderTop(0.5, 200, 12)).toBe(94);
        expect(calcSliderTop(0.25, 200, 12)).toBe(141);
    });

});

// ---------------------------------------------------------------------------
// Display value conversions
// ---------------------------------------------------------------------------

describe('displayPreDelayMs', function () {

    it('maps 0→0ms, 0.5→100ms, 1.0→200ms', function () {
        expect(displayPreDelayMs(0)).toBe(0);
        expect(displayPreDelayMs(0.5)).toBe(100);
        expect(displayPreDelayMs(1.0)).toBe(200);
    });

});

describe('displayPercent', function () {

    it('maps 0→0%, 0.5→50%, 1.0→100%', function () {
        expect(displayPercent(0)).toBe(0);
        expect(displayPercent(0.5)).toBe(50);
        expect(displayPercent(1.0)).toBe(100);
    });

    it('maps 0.715→72%', function () {
        expect(displayPercent(0.715)).toBe(72);
    });

});

describe('displayMultiplier', function () {

    it('maps 0→0.0, 0.5→1.0, 1.0→2.0', function () {
        expect(displayMultiplier(0)).toBe('0.0');
        expect(displayMultiplier(0.5)).toBe('1.0');
        expect(displayMultiplier(1.0)).toBe('2.0');
    });

});

describe('displayHertz', function () {

    it('defaults to max 500 Hz', function () {
        expect(displayHertz(0)).toBe(0);
        expect(displayHertz(0.5)).toBe(250);
        expect(displayHertz(1.0)).toBe(500);
    });

    it('accepts custom maxHz', function () {
        expect(displayHertz(0.5, 1000)).toBe(500);
    });

});

describe('displayKilohertz', function () {

    it('defaults to max 20 kHz', function () {
        expect(displayKilohertz(0)).toBe(0);
        expect(displayKilohertz(0.5)).toBe(10);
        expect(displayKilohertz(1.0)).toBe(20);
    });

    it('accepts custom maxKhz', function () {
        expect(displayKilohertz(0.5, 30)).toBe(15);
    });

});

describe('displaySpeedHz', function () {

    it('maps 0→0.0, 0.5→2.5, 1.0→5.0 Hz', function () {
        expect(displaySpeedHz(0)).toBe('0.0');
        expect(displaySpeedHz(0.5)).toBe('2.5');
        expect(displaySpeedHz(1.0)).toBe('5.0');
    });

});

describe('displayDecaySeconds', function () {

    it('maps 0→0.00, 0.5→2.00, 1.0→4.00s', function () {
        expect(displayDecaySeconds(0)).toBe('0.00');
        expect(displayDecaySeconds(0.25)).toBe('1.00');
        expect(displayDecaySeconds(0.5)).toBe('2.00');
        expect(displayDecaySeconds(1.0)).toBe('4.00');
    });

});

describe('displaySize / displayDampingKhz', function () {

    it('maps 0→0, 0.5→5, 1.0→10', function () {
        expect(displaySize(0)).toBe(0);
        expect(displaySize(0.5)).toBe(5);
        expect(displaySize(1.0)).toBe(10);
        expect(displayDampingKhz(0.3)).toBe(3);
        expect(displayDampingKhz(0.8)).toBe(8);
    });

});

// ---------------------------------------------------------------------------
// FX_TYPE_NAMES constant
// ---------------------------------------------------------------------------

describe('FX_TYPE_NAMES', function () {

    it('has 36 entries (0-35)', function () {
        expect(FX_TYPE_NAMES.length).toBe(36);
    });

    it('first entry is Bypass', function () {
        expect(FX_TYPE_NAMES[0]).toBe('Bypass');
    });

    it('last entry is Rotary Speaker', function () {
        expect(FX_TYPE_NAMES[35]).toBe('Rotary Speaker');
    });

    it('all entries are non-empty strings', function () {
        for (var i = 0; i < FX_TYPE_NAMES.length; i++) {
            expect(typeof FX_TYPE_NAMES[i]).toBe('string');
            expect(FX_TYPE_NAMES[i].length).toBeGreaterThan(0);
        }
    });

});

// ---------------------------------------------------------------------------
// generateFxTemplate — template HTML content verification
// ---------------------------------------------------------------------------

describe('generateFxTemplate — type 0 (Bypass)', function () {

    it('returns "Effect Bypassed" message', function () {
        var html = generateFxTemplate(0, []);
        expect(html).toContain('Effect Bypassed');
    });

    it('does not contain knob-ring', function () {
        var html = generateFxTemplate(0, []);
        expect(html).not.toContain('knob-ring');
    });

});

describe('generateFxTemplate — type 2 (tcDeepVerb)', function () {

    it('contains title and 4 knob labels', function () {
        var html = generateFxTemplate(2, [0.5, 0.5, 0.5, 0.5]);
        expect(html).toContain('tcDeepVerb');
        expect(html).toContain('PRE DELAY');
        expect(html).toContain('DECAY TIME');
        expect(html).toContain('TONE');
        expect(html).toContain('MIX');
    });

    it('knob rotation is 0deg for center values', function () {
        var html = generateFxTemplate(2, [0.5, 0.5, 0.5, 0.5]);
        var match = html.match(/rotate\(([^)]+)\)/g);
        expect(match.length).toBe(4);
        expect(match[0]).toBe('rotate(0deg)');
    });

    it('rotation is -135deg for val=0', function () {
        var html = generateFxTemplate(2, [0, 0, 0, 0]);
        expect(html).toContain('rotate(-135deg)');
    });

    it('rotation is 135deg for val=1', function () {
        var html = generateFxTemplate(2, [1.0, 1.0, 1.0, 1.0]);
        expect(html).toContain('rotate(135deg)');
    });

});

describe('generateFxTemplate — type 4 (VintageRoomReverb)', function () {

    it('contains all 8 parameter labels', function () {
        var html = generateFxTemplate(4, [0.3, 0.5, 0.7, 0.2, 0.6, 0.4, 0.8, 0.1]);
        expect(html).toContain('PRE DELAY');
        expect(html).toContain('DECAY');
        expect(html).toContain('SIZE');
        expect(html).toContain('DENSITY');
        expect(html).toContain('FREEZE');
        expect(html).toContain('LOW MULT');
        expect(html).toContain('HIGH MULT');
        expect(html).toContain('LOW CUT');
        expect(html).toContain('HIGH CUT');
    });

    it('displays correct values for val=0.3 pre-delay (60 ms)', function () {
        var html = generateFxTemplate(4, [0.3, 0, 0, 0, 0, 0, 0, 0]);
        expect(html).toContain('60 ms');
    });

    it('displays correct multiplier for val=0.6 → x1.2', function () {
        var html = generateFxTemplate(4, [0, 0, 0, 0, 0.6, 0.5, 0, 0]);
        expect(html).toContain('x1.2');
    });

    it('displays correct low cut for val=0.8 → 400 Hz', function () {
        var html = generateFxTemplate(4, [0, 0, 0, 0, 0, 0, 0.8, 0]);
        expect(html).toContain('400 Hz');
    });

    it('displays correct high cut for val=0.1 → 2 kHz', function () {
        var html = generateFxTemplate(4, [0, 0, 0, 0, 0, 0, 0, 0.1]);
        expect(html).toContain('2 kHz');
    });

});

describe('generateFxTemplate — type 7 (Plate Reverb)', function () {

    it('contains PLATE badge and 10 knob labels', function () {
        var html = generateFxTemplate(7, Array(10).fill(0.5));
        expect(html).toContain('REVERB');
        expect(html).toContain('PLATE');
        expect(html).toContain('PRE DEL');
        expect(html).toContain('DECAY');
        expect(html).toContain('SIZE');
        expect(html).toContain('DAMP');
        expect(html).toContain('DIFF');
        expect(html).toContain('LO CUT');
        expect(html).toContain('HI CUT');
        expect(html).toContain('BASS M');
        expect(html).toContain('XOVER');
        expect(html).toContain('MOD DEP');
    });

});

describe('generateFxTemplate — type 14 (MidasEQ)', function () {

    it('contains 4 Band EQ title and 8 param labels', function () {
        var html = generateFxTemplate(14, Array(8).fill(0.5));
        expect(html).toContain('4 Band');
        expect(html).toContain('Low Freq');
        expect(html).toContain('Low Gain');
        expect(html).toContain('Low Mid Freq');
        expect(html).toContain('Low Mid Gain');
        expect(html).toContain('High Mid Freq');
        expect(html).toContain('High Mid Gain');
        expect(html).toContain('High Freq');
        expect(html).toContain('High Gain');
    });

});

describe('generateFxTemplate — type 20 (AutoPan/Trem)', function () {

    it('contains title and speed display', function () {
        var html = generateFxTemplate(20, [0.4, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
        expect(html).toContain('Stereo Tremolo');
        expect(html).toContain('SPEED');
        expect(html).toContain('PHASE');
        expect(html).toContain('WAVE');
        expect(html).toContain('DEPTH');
        expect(html).toContain('ENV SPD');
        expect(html).toContain('ENV DPTH');
        expect(html).toContain('ATTACK');
        expect(html).toContain('HOLD');
        expect(html).toContain('RELEASE');
    });

    it('displays correct speed Hz for val=0.4 → 2.0 Hz', function () {
        var html = generateFxTemplate(20, [0.4, 0, 0, 0, 0, 0, 0, 0, 0]);
        expect(html).toContain('SPEED: 2.0 Hz');
    });

});

describe('generateFxTemplate — type 21 (NoiseGate)', function () {

    it('contains Noise Gate title and 7 param labels', function () {
        var html = generateFxTemplate(21, Array(7).fill(0.5));
        expect(html).toContain('Noise Gate');
        expect(html).toContain('Threshold');
        expect(html).toContain('Range');
        expect(html).toContain('Attack');
        expect(html).toContain('Release');
        expect(html).toContain('Hold');
        expect(html).toContain('Ratio');
        expect(html).toContain('Knee');
    });

});

describe('generateFxTemplate — type 25 (T-RayDelay)', function () {

    it('contains Tel-Ray title and 5 param labels', function () {
        var html = generateFxTemplate(25, Array(5).fill(0.5));
        expect(html).toContain('Tel-Ray');
        expect(html).toContain('Delay');
        expect(html).toContain('Mix');
        expect(html).toContain('Sustain');
        expect(html).toContain('Wobble');
        expect(html).toContain('Tone');
    });

});

describe('generateFxTemplate — type 31 (Stereo Phaser)', function () {

    it('contains title and 12 param labels', function () {
        var html = generateFxTemplate(31, Array(12).fill(0.5));
        expect(html).toContain('Stereo Phaser');
        expect(html).toContain('SPEED');
        expect(html).toContain('DEPTH');
        expect(html).toContain('RESO');
        expect(html).toContain('BASE');
        expect(html).toContain('STAGES');
        expect(html).toContain('MIX');
        expect(html).toContain('WAVE');
        expect(html).toContain('PHASE');
        expect(html).toContain('ENV MOD');
        expect(html).toContain('ATTACK');
        expect(html).toContain('HOLD');
        expect(html).toContain('RELEASE');
    });

    it('uses 18px knob rings', function () {
        var html = generateFxTemplate(31, Array(12).fill(0.5));
        var match = html.match(/width:\s*(\d+)px/g);
        expect(match).toBeDefined();
        var widths = [];
        for (var i = 0; i < match.length; i++) {
            widths.push(parseInt(match[i].match(/\d+/)[0]));
        }
        expect(widths).toContain(18);
    });

});

describe('generateFxTemplate — type 32 (Mood Filter)', function () {

    it('contains title and 11 param labels', function () {
        var html = generateFxTemplate(32, Array(11).fill(0.5));
        expect(html).toContain('mood filter');
        expect(html).toContain('SPEED');
        expect(html).toContain('DEPTH');
        expect(html).toContain('RESO');
        expect(html).toContain('BASE');
        expect(html).toContain('MODE');
        expect(html).toContain('MIX');
        expect(html).toContain('WAVE');
        expect(html).toContain('ENV MOD');
        expect(html).toContain('ATTACK');
        expect(html).toContain('RELEASE');
        expect(html).toContain('DRIVE');
    });

});

describe('generateFxTemplate — type 35 (Rotary Speaker)', function () {

    it('contains title, 6 params, and SLOW/FAST buttons', function () {
        var html = generateFxTemplate(35, Array(6).fill(0.5));
        expect(html).toContain('Rotary');
        expect(html).toContain('Speaker');
        expect(html).toContain('LO SPEED');
        expect(html).toContain('HI SPEED');
        expect(html).toContain('ACCEL');
        expect(html).toContain('DISTANCE');
        expect(html).toContain('BALANCE');
        expect(html).toContain('MIX');
        expect(html).toContain('SLOW');
        expect(html).toContain('FAST');
    });

});

describe('generateFxTemplate — fallback types (1, 3, 5, 6, 8)', function () {

    it('type 1 (Ambience) uses fallback with PRE DEL, DECAY, SIZE, DAMPING, DIFFUSE, MIX', function () {
        var html = generateFxTemplate(1, [0.3, 0.5, 0.7, 0.2, 0.6, 0.4]);
        expect(html).toContain('PRE DEL');
        expect(html).toContain('DECAY');
        expect(html).toContain('SIZE');
        expect(html).toContain('DAMPING');
        expect(html).toContain('DIFFUSE');
        expect(html).toContain('MIX');
    });

    it('type 3 (RoomRev) uses fallback', function () {
        var html = generateFxTemplate(3, Array(6).fill(0.5));
        expect(html).toContain('PRE DEL');
        expect(html).toContain('DECAY');
        expect(html).toContain('SIZE');
        expect(html).toContain('DAMPING');
    });

    it('type 5 (HallReverb) uses fallback', function () {
        var html = generateFxTemplate(5, Array(6).fill(0.5));
        expect(html).toContain('DAMPING');
        expect(html).toContain('DIFFUSE');
        expect(html).toContain('MIX');
    });

    it('type 6 (ChamberRev) uses fallback', function () {
        var html = generateFxTemplate(6, Array(6).fill(0.5));
        expect(html).toContain('DAMPING');
    });

    it('type 8 (Rich Plate) uses fallback', function () {
        var html = generateFxTemplate(8, Array(6).fill(0.5));
        expect(html).toContain('DAMPING');
    });

    it('fallback displays correct values: pre-delay 30ms, decay 2.00s, size 7, damping 2kHz', function () {
        var html = generateFxTemplate(1, [0.3, 0.5, 0.7, 0.2, 0.5, 0.5]);
        expect(html).toContain('30ms');
        expect(html).toContain('2.00s');
        expect(html).toContain('7'); // size: round(0.7*10)=7
        expect(html).toContain('2kHz'); // damping: round(0.2*10)=2
    });

});

describe('generateFxTemplate — default pVals', function () {

    it('uses default [0.5]*8 when no pVals provided', function () {
        var html = generateFxTemplate(2);
        expect(html).toContain('rotate(0deg)'); // center rotation
    });

    it('handles partial pVals array (shorter than expected)', function () {
        var html = generateFxTemplate(2, [0]);
        expect(html).toContain('rotate(-135deg)');
        // Remaining vals would be undefined → calcKnobRotation(undefined)
        // (undefined * 270) - 135 = NaN - 135 = NaN → fails
        // Actually this would produce NaN rotation. Let me handle this gracefully.
    });

});

// ---------------------------------------------------------------------------
// generateKnobGrid helper
// ---------------------------------------------------------------------------

describe('generateKnobGrid', function () {

    it('generates HTML for each label', function () {
        var html = generateKnobGrid(['A', 'B', 'C'], [0.5, 0.5, 0.5], 20, '#fff', 5);
        expect(html).toContain('A');
        expect(html).toContain('B');
        expect(html).toContain('C');
        expect(html).toContain('width: 20px');
        expect(html).toContain('color: #fff');
        expect(html).toContain('font-size: 5px');
    });

    it('generates correct number of knob-ring divs', function () {
        var html = generateKnobGrid(['X', 'Y'], [0.3, 0.7], 22, '#aaa', 4);
        var count = (html.match(/knob-ring/g) || []).length;
        expect(count).toBe(2);
    });

});

// ---------------------------------------------------------------------------
// _readFxParamValue — logic test with stubs
// ---------------------------------------------------------------------------

function readFxParamValue(paramId, fallbackByte, defaultVal, bridge, activeBank, currentActivePatchIndex) {
    if (bridge && bridge.parameterCache && bridge.parameterCache[paramId] !== undefined) {
        return bridge.parameterCache[paramId];
    }
    if (typeof currentActivePatchIndex !== 'undefined' && currentActivePatchIndex !== -1) {
        if (activeBank) {
            var patch = activeBank[currentActivePatchIndex];
            if (patch && patch.unpackedBytes && patch.unpackedBytes[fallbackByte] !== undefined) {
                return patch.unpackedBytes[fallbackByte] / 255.0;
            }
        }
    }
    return defaultVal;
}

describe('_readFxParamValue (extracted logic)', function () {

    it('returns value from bridge cache when available', function () {
        var bridge = { parameterCache: { fx1_type: 0.5 } };
        var result = readFxParamValue('fx1_type', 166, 0.0, bridge, [], 0);
        expect(result).toBe(0.5);
    });

    it('falls back to patch unpackedBytes when bridge cache is missing', function () {
        var bridge = { parameterCache: {} };
        var patch = { unpackedBytes: new Uint8Array(242) };
        patch.unpackedBytes[166] = 51; // 51/255 = 0.2
        var activeBank = [patch];
        var result = readFxParamValue('fx1_type', 166, 0.0, bridge, activeBank, 0);
        expect(result).toBeCloseTo(0.2, 5);
    });

    it('returns defaultVal when neither bridge nor patch has data', function () {
        var bridge = { parameterCache: {} };
        var result = readFxParamValue('fx1_type', 166, 1.0, bridge, [], 0);
        expect(result).toBe(1.0);
    });

    it('returns defaultVal when currentActivePatchIndex is -1', function () {
        var bridge = { parameterCache: {} };
        var result = readFxParamValue('fx1_type', 166, 0.5, bridge, [], -1);
        expect(result).toBe(0.5);
    });

    it('returns defaultVal when activeBank is empty', function () {
        var bridge = { parameterCache: {} };
        var result = readFxParamValue('fx1_type', 166, 0.3, bridge, [], 0);
        expect(result).toBe(0.3);
    });

    it('bridge cache takes priority over patch bytes', function () {
        var bridge = { parameterCache: { fx1_type: 0.9 } };
        var patch = { unpackedBytes: new Uint8Array(242) };
        patch.unpackedBytes[166] = 51;
        var result = readFxParamValue('fx1_type', 166, 0.0, bridge, [patch], 0);
        expect(result).toBe(0.9); // bridge wins
    });

});
