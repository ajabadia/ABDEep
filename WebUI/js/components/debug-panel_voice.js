/**
 * @purpose Debug panel: voice state reading from bridge/cache.
 * Extracted from debug-panel.js for modularization.
 * @classification UI Component Submodule
 */

/**
 * Read voice state from bridge and parameter cache.
 * Returns a structured object with all voice/controller/chord data.
 * @param {object} bridge - dualMidiBridge instance
 * @param {object} cache - bridge.parameterCache
 * @param {object|null} raw - raw voice state from bridge.getVoiceState() (or null)
 * @returns {{voiceMode:number, voicesPerNote:number, voices:Array, activeCount:number, ...}}
 */
window.debugReadVoiceState = function (bridge, cache, raw) {
    const voiceMode = Math.min(12, Math.max(0, Math.round((cache['voice_mode'] || 0) * 12)));
    const voicesPerNote = (window.DEBUG_VOICES_PER_MODE && window.DEBUG_VOICES_PER_MODE[voiceMode]) || 1;

    let activeCount = 0;
    let voices = [];
    let dataSource = '';
    let polyChordHeldCount = 0;
    let peakLevel = 0.0;
    const detuneVal = ((cache['unison_detune'] || 0) * 50.0).toFixed(1) + ' ¢';
    const panVal = Math.round((cache['vca_pan_spread'] || 0) * 100) + '%';
    const chordOn = (cache['chord_enable'] || 0) > 0.5;
    const polyChordOn = (cache['poly_chord_enable'] || 0) > 0.5;
    const chordTypeIdx = Math.min(11, Math.max(0, Math.round((cache['chord_type'] || 0) * 11)));
    const chordTypeName = (window.DEBUG_CHORD_TYPE_NAMES && window.DEBUG_CHORD_TYPE_NAMES[chordTypeIdx]) || '—';

    // Controller values from cache/raw
    let ctrlPitchBend = 0.0;
    let ctrlModWheel = 0.0;
    let ctrlAftertouch = 0.0;
    let ctrlSustainPedal = 0.0;

    if (bridge && bridge.isJuce) {
        dataSource = 'C++ Engine';
        if (raw) {
            peakLevel = raw.peakLevel !== undefined ? raw.peakLevel : 0.0;
        }
        if (raw && raw.voices && Array.isArray(raw.voices)) {
            const voiceArray = raw.voices;
            polyChordHeldCount = raw.polyChordNoteCount !== undefined ? raw.polyChordNoteCount : 0;
            ctrlPitchBend = raw.pitchBend !== undefined ? raw.pitchBend : 0.0;
            ctrlModWheel = raw.modWheel !== undefined ? raw.modWheel : 0.0;
            ctrlAftertouch = raw.aftertouch !== undefined ? raw.aftertouch : 0.0;
            ctrlSustainPedal = raw.sustainPedal !== undefined ? raw.sustainPedal : 0.0;

            for (let i = 0; i < voiceArray.length; i++) {
                const v = voiceArray[i];
                const detuneCents = (v.detuneSemitones || 0) * 100.0;
                const panPos = v.panPosition || 0.5;
                const panSpread = v.voicePanSpread || 0;
                const basePan = 0.5 + (panPos - 0.5) * panSpread;
                const modOsc1DC = (v.modOsc1DetuneSemitones || 0) * 100.0;
                const modOsc2DC = (v.modOsc2DetuneSemitones || 0) * 100.0;
                const modPan = v.modPan !== undefined ? v.modPan : basePan;
                const modVcfHz = v.modVcfCutoffHz || 0;
                if (v.active) { activeCount++; }
                voices.push({
                    voiceIndex: i,
                    active: v.active || false,
                    midiNote: v.active ? (v.midiNote || -1) : -1,
                    detuneCents: detuneCents,
                    basePan: basePan,
                    panOutput: modPan,
                    panRaw: panPos,
                    modOsc1DetuneCents: modOsc1DC,
                    modOsc2DetuneCents: modOsc2DC,
                    modVcfCutoffHz: modVcfHz
                });
            }
        } else {
            for (let i2 = 0; i2 < 12; i2++) {
                voices.push({ voiceIndex: i2, active: false, midiNote: -1, detuneCents: 0, panOutput: 0.5, panRaw: 0.5 });
            }
        }
    } else {
        dataSource = 'Theoretical';
        const unisonDetune = cache['unison_detune'] || 0;
        const vcaPanSpread = cache['vca_pan_spread'] || 0;

        if (typeof window.calculateUnisonParams === 'function') {
            voices = window.calculateUnisonParams(voiceMode, unisonDetune, vcaPanSpread);
        }
        ctrlModWheel = cache['mod_wheel'] !== undefined ? cache['mod_wheel'] : 0.0;
        ctrlAftertouch = cache['aftertouch'] !== undefined ? cache['aftertouch'] : 0.0;
    }

    // Apply controller curves
    if (typeof window.applyControllerCurve === 'function') {
        ctrlAftertouch = window.applyControllerCurve(ctrlAftertouch, window.getControllerCurve('aftertouch'));
        ctrlModWheel = window.applyControllerCurve(ctrlModWheel, window.getControllerCurve('modwheel'));
    }

    // Build chord status strings
    let chordStatus = '—';
    let polyChordStatus = '—';
    if (chordOn || polyChordOn) {
        if (chordOn) {
            chordStatus = '<span style="color:var(--accent-green)">● ON</span> ' + chordTypeName;
        }
        if (polyChordOn) {
            if (polyChordHeldCount > 0) {
                polyChordStatus = '<span style="color:var(--accent-blue)">● ' + polyChordHeldCount + '</span> ' + chordTypeName;
            } else {
                polyChordStatus = '<span style="color:var(--accent-blue)">● ON</span> ' + chordTypeName;
            }
        }
    }

    return {
        voiceMode: voiceMode,
        voicesPerNote: voicesPerNote,
        voices: voices,
        activeCount: activeCount,
        voiceCount: voices.length,
        dataSource: dataSource,
        peakLevel: peakLevel,
        detuneVal: detuneVal,
        panVal: panVal,
        chordOn: chordOn,
        polyChordOn: polyChordOn,
        chordStatus: chordStatus,
        polyChordStatus: polyChordStatus,
        chordTypeName: chordTypeName,
        ctrlPitchBend: ctrlPitchBend,
        ctrlModWheel: ctrlModWheel,
        ctrlAftertouch: ctrlAftertouch,
        ctrlSustainPedal: ctrlSustainPedal,
        polyChordHeldCount: polyChordHeldCount,
        voiceModeName: (window.DEBUG_VOICE_MODE_NAMES && window.DEBUG_VOICE_MODE_NAMES[voiceMode]) || 'Poly'
    };
};

/**
 * Smooth a VU peak level with attack/release coefficients.
 * Returns { smoothed, lastTime } for next call.
 * @param {number} peakLevel - raw peak level (0-1)
 * @param {number} smoothed - previous smoothed value
 * @param {number} lastTime - previous timestamp (ms)
 * @returns {{smoothed:number, lastTime:number, dt:number}}
 */
window.debugSmoothVU = function (peakLevel, smoothed, lastTime) {
    const now = Date.now();
    const dt = Math.min(100, Math.max(1, now - lastTime));
    const VU_ATTACK_MS = 5;
    const VU_RELEASE_MS = 300;

    if (peakLevel > smoothed) {
        const attackCoeff = Math.exp(-dt / VU_ATTACK_MS);
        smoothed = smoothed * attackCoeff + peakLevel * (1 - attackCoeff);
    } else {
        const releaseCoeff = Math.exp(-dt / VU_RELEASE_MS);
        smoothed = peakLevel + (smoothed - peakLevel) * releaseCoeff;
    }
    if (smoothed < 0.001) { smoothed = 0.0; }

    return { smoothed: smoothed, lastTime: now, dt: dt };
};
