/**
 * @purpose Debug panel: UI rendering helpers for VU meter, controllers, and voice grid.
 * Extracted from debug-panel.js for modularization.
 * @classification UI Component Submodule
 */

/** Set textContent of an element by id */
window.debugSetText = function (id, txt) {
    const el = document.getElementById(id);
    if (el) { el.textContent = txt; }
};

/** Set innerHTML of an element by id */
window.debugSetHtml = function (id, html) {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = html; }
};

/**
 * Render VU meter from smoothed peak level.
 * Updates #vu-fill, #vu-val, #vu-clip.
 * @param {number} pct - smoothed VU level (0-1)
 * @param {number} rawPeak - raw peak level for clip detection
 * @param {object} clipState - { timer: number|null, ref: object for timer ref }
 * @returns {object} updated clipState
 */
window.debugRenderVU = function (pct, rawPeak, clipState) {
    clipState = clipState || {};
    const vuFill = document.getElementById('vu-fill');
    const vuVal = document.getElementById('vu-val');
    const vuClip = document.getElementById('vu-clip');

    if (vuFill) {
        const barW = Math.round(pct * 100);
        vuFill.style.width = barW + '%';
        if (pct < 0.001) {
            vuFill.style.background = 'var(--text-faint)';
        } else if (pct < 0.06) {
            vuFill.style.background = 'var(--accent-green)';
        } else if (pct < 0.5) {
            vuFill.style.background = 'var(--accent-yellow)';
        } else if (pct < 0.7) {
            vuFill.style.background = 'var(--accent-orange)';
        } else {
            vuFill.style.background = 'var(--color-danger)';
        }

        if (rawPeak > 0.9) {
            if (vuClip) { vuClip.style.opacity = '1'; }
            if (clipState.timer) {
                clearTimeout(clipState.timer);
                clipState.timer = null;
            }
        } else if (!clipState.timer) {
            clipState.timer = setTimeout(function () {
                if (vuClip) { vuClip.style.opacity = '0'; }
                clipState.timer = null;
            }, 500);
        }
    }

    if (vuVal) {
        if (pct < 0.0001) {
            vuVal.textContent = '-∞ dB';
        } else {
            const db = 20.0 * Math.log10(pct);
            vuVal.textContent = db.toFixed(1) + ' dB';
            vuVal.style.color = db > -6.0 ? 'var(--accent-orange)' : db > -3.0 ? 'var(--color-danger)' : 'var(--text-secondary)';
        }
    }

    return clipState;
};

/**
 * Render controller bars (pitch bend, mod wheel, aftertouch, sustain pedal).
 * @param {object} ctrl - { ctrlPitchBend, ctrlModWheel, ctrlAftertouch, ctrlSustainPedal }
 */
window.debugRenderControllers = function (ctrl) {
    // Pitch Bend (bipolar -1 to +1)
    const pbFill = document.getElementById('ctrl-pitchBend-fill');
    const pbVal = document.getElementById('ctrl-pitchBend-val');
    if (pbFill) {
        const pbPct = Math.max(-1, Math.min(1, ctrl.ctrlPitchBend));
        const center = 50;
        const pbLeft = pbPct >= 0 ? center : center + pbPct * 50;
        const pbWidth = Math.abs(pbPct) * 50;
        pbFill.style.left = pbLeft + '%';
        pbFill.style.width = pbWidth + '%';
        pbFill.style.background = pbPct >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
    }
    if (pbVal) {
        const semitones = ctrl.ctrlPitchBend * 2.0;
        pbVal.textContent = semitones.toFixed(2) + 'st';
        pbVal.style.color = ctrl.ctrlPitchBend >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
    }

    // Mod Wheel (unipolar 0-1)
    const mwFill = document.getElementById('ctrl-modWheel-fill');
    const mwVal = document.getElementById('ctrl-modWheel-val');
    if (mwFill) {
        const mwPct = Math.max(0, Math.min(1, ctrl.ctrlModWheel));
        mwFill.style.left = '0%';
        mwFill.style.width = Math.round(mwPct * 100) + '%';
        mwFill.style.background = mwPct > 0.01 ? 'var(--accent-blue)' : 'var(--text-faint)';
    }
    if (mwVal) {
        mwVal.textContent = Math.round(ctrl.ctrlModWheel * 100) + '%';
        mwVal.style.color = ctrl.ctrlModWheel > 0.01 ? 'var(--accent-blue)' : 'var(--text-faint)';
    }

    // Aftertouch (unipolar 0-1)
    const atFill = document.getElementById('ctrl-aftertouch-fill');
    const atVal = document.getElementById('ctrl-aftertouch-val');
    if (atFill) {
        const atPct = Math.max(0, Math.min(1, ctrl.ctrlAftertouch));
        atFill.style.left = '0%';
        atFill.style.width = Math.round(atPct * 100) + '%';
        atFill.style.background = atPct > 0.01 ? 'var(--accent-orange)' : 'var(--text-faint)';
    }
    if (atVal) {
        atVal.textContent = Math.round(ctrl.ctrlAftertouch * 100) + '%';
        atVal.style.color = ctrl.ctrlAftertouch > 0.01 ? 'var(--accent-orange)' : 'var(--text-faint)';
    }

    // Sustain Pedal (binary 0/1)
    const susFill = document.getElementById('ctrl-sustainPedal-fill');
    const susVal = document.getElementById('ctrl-sustainPedal-val');
    if (susFill) {
        const susPct = Math.max(0, Math.min(1, ctrl.ctrlSustainPedal));
        susFill.style.left = '0%';
        susFill.style.width = Math.round(susPct * 100) + '%';
        susFill.style.background = susPct > 0.5 ? 'var(--accent-green)' : 'var(--text-faint)';
    }
    if (susVal) {
        const isOn = ctrl.ctrlSustainPedal > 0.5;
        susVal.textContent = isOn ? 'ON' : 'OFF';
        susVal.style.color = isOn ? 'var(--accent-green)' : 'var(--text-faint)';
    }
};

/**
 * Build and set the voice grid HTML.
 * @param {Array} voices - array of voice objects
 * @param {number} voiceMode - current voice mode index
 */
window.debugRenderVoiceGrid = function (voices, voiceMode) {
    const grid = document.getElementById('debug-voice-grid');
    if (!grid) { return; }

    if (!voices || voices.length === 0) {
        const modeName = (window.DEBUG_VOICE_MODE_NAMES && window.DEBUG_VOICE_MODE_NAMES[voiceMode]) || 'Poly';
        grid.innerHTML = '<div class="debug-no-stack">' + modeName + ' mode — no voices</div>';
        return;
    }

    function fmtDetune(cents) {
        if (Math.abs(cents) < 0.1) { return '0.0¢'; }
        const s = cents >= 0 ? '+' : '';
        return s + cents.toFixed(1) + '¢';
    }

    let html = '';
    for (let i = 0; i < voices.length; i++) {
        const v = voices[i];
        if (!v.active) {
            html += '<div class="debug-voice-slot" style="opacity:0.35">'
                + '<div class="debug-voice-header">'
                + '<span class="debug-voice-idx">V' + v.voiceIndex + '</span>'
                + '<span style="flex:1;font-size:var(--text-2xs);color:var(--text-faint)">inactive</span>'
                + '</div></div>';
            continue;
        }

        const hasMod = v.modOsc1DetuneCents !== undefined
            && (Math.abs(v.modOsc1DetuneCents - v.detuneCents) > 0.5
                || Math.abs(v.modOsc2DetuneCents - v.detuneCents) > 0.5);
        const vcfHz = v.modVcfCutoffHz || 0;
        const vcfLabel = vcfHz >= 1000 ? (vcfHz / 1000).toFixed(1) + 'k' : Math.round(vcfHz) + ' Hz';
        const noteName = typeof window.debugMidiNoteToName === 'function' ? window.debugMidiNoteToName(v.midiNote) : '—';
        const panLabel = v.panOutput < 0.33 ? 'L' : v.panOutput > 0.67 ? 'R' : 'C';
        const panLeft = Math.round(v.panOutput * 100);
        const detunePct = Math.min(1.0, Math.abs(v.detuneCents) / 50.0);
        const barW = Math.round(detunePct * 100);
        const detuneBarStyle = v.detuneCents >= 0
            ? 'margin-left:50%;width:' + barW + '%;background:var(--accent-teal)'
            : 'margin-left:' + (50 - barW) + '%;width:' + barW + '%;background:var(--accent-pink)';

        html += '<div class="debug-voice-slot" style="border-left:3px solid var(--accent-green)">'
            + '<div class="debug-voice-header">'
            + '<span class="debug-voice-idx" style="color:var(--accent-green)">V' + v.voiceIndex + '</span>'
            + '<span style="font-size:var(--text-2xs);font-weight:700;font-family:\'Share Tech Mono\',monospace;color:var(--text-primary)">' + noteName + '</span>'
            + '<span style="font-size:var(--text-2xs);color:var(--text-dim)">N' + v.midiNote + '</span>'
            + '<span style="font-size:var(--text-2xs);font-weight:600;color:var(--text-faint)">base ' + fmtDetune(v.detuneCents) + '</span>'
            + '<span class="debug-voice-pan" style="color:var(--accent-blue)">' + panLabel + ' ' + Math.round(v.panOutput * 100) + '%</span>'
            + '<span style="font-size:var(--text-2xs);color:var(--accent-purple);font-weight:600;font-family:\'Share Tech Mono\',monospace">' + vcfLabel + '</span>'
            + '</div>'
            + (hasMod
                ? '<div style="display:flex;gap:6px;font-size:var(--text-2xs);font-family:\'Share Tech Mono\',monospace">'
                + '<span style="color:var(--accent-orange)">OSC1 ' + fmtDetune(v.modOsc1DetuneCents) + '</span>'
                + '<span style="color:var(--accent-yellow)">OSC2 ' + fmtDetune(v.modOsc2DetuneCents) + '</span>'
                + '<span style="margin-left:auto;color:var(--accent-blue)">pan ' + panLabel + ' ' + Math.round(v.panOutput * 100) + '%</span>'
                + '</div>'
                : '')
            + '<div class="debug-voice-bars">'
            + '<div class="debug-bar-track"><div class="debug-bar-fill" style="' + detuneBarStyle + '"></div><div class="debug-bar-center"></div></div>'
            + '<div class="debug-bar-track debug-bar-track-pan"><div class="debug-bar-fill" style="margin-left:' + panLeft + '%;width:4px;background:var(--accent-blue)"></div></div>'
            + '</div></div>';
    }
    grid.innerHTML = html;
};
