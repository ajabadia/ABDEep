/**
 * @purpose Blink loop for ARP/SEQ/Chord/PolyChord panel buttons via requestAnimationFrame.
 * @purpose_en Tempo-synced button blink animations for arpeggiator, sequencer, chord memory and poly chord indicators.
 */

// ── INIT BLINK LOOP ──
// eslint-disable-next-line no-unused-vars -- called from script.js via window.*
function initBlinkLoop() {
    const arpBtnEl = document.getElementById('programmer-arp-btn');
    if (arpBtnEl) { arpBtnEl.classList.add('panel-btn', 'accent-primary'); }
    const seqBtnEl = document.getElementById('programmer-seq-btn');
    if (seqBtnEl) { seqBtnEl.classList.add('panel-btn', 'accent-pink', 'seq-btn'); }
    const chordBtnEl = document.getElementById('programmer-chord-btn');
    if (chordBtnEl) { chordBtnEl.classList.add('panel-btn', 'accent-green'); }
    const polychordBtnEl = document.getElementById('programmer-polychord-btn');
    if (polychordBtnEl) { polychordBtnEl.classList.add('panel-btn', 'accent-blue'); }

    function setButtonInactive(el, _mixColor, _accentColor) {
        if (!el) {return;}
        el.classList.remove('is-active', 'blink-on', 'blink-off', 'is-pulse', 'is-running', 'is-idle');
        el.classList.add('is-inactive');
    }

    function runBlinkLoop(timestamp) {
        let isArpOn = false;
        let isSeqOn = false;
        let isChordMemOn = false;
        let isPolyChordOn = false;

        if (window.dualMidiBridge && window.dualMidiBridge.parameterCache) {
            isArpOn = window.dualMidiBridge.parameterCache['arp_enable'] > 0.5;
            isSeqOn = window.dualMidiBridge.parameterCache['seq_enable'] > 0.5;
            isChordMemOn = window.dualMidiBridge.parameterCache['chord_enable'] > 0.5;
            isPolyChordOn = window.dualMidiBridge.parameterCache['poly_chord_enable'] > 0.5;
        }

        if (!isArpOn && !isSeqOn && !isChordMemOn && !isPolyChordOn) {
            setButtonInactive(arpBtnEl);
            setButtonInactive(seqBtnEl);
            setButtonInactive(chordBtnEl);
            setButtonInactive(polychordBtnEl);
            requestAnimationFrame(runBlinkLoop);
            return;
        }

        let bpm = 120;
        if (window.dualMidiBridge && window.dualMidiBridge.parameterCache) {
            const arpRateVal = window.dualMidiBridge.parameterCache['arp_rate'];
            if (typeof arpRateVal !== 'undefined') {
                bpm = 20 + arpRateVal * 220;
            }
        }

        const periodMs = 60000 / bpm;
        const blinkStateSlow = Math.floor(timestamp / (periodMs / 2)) % 2 === 0;

        if (arpBtnEl) {
            if (isArpOn) {
                arpBtnEl.classList.remove('is-inactive');
                arpBtnEl.classList.add('is-active', blinkStateSlow ? 'blink-on' : 'blink-off');
            } else {
                setButtonInactive(arpBtnEl);
            }
        }

        if (seqBtnEl) {
            if (isSeqOn) {
                if (window._lastSeqStep === undefined) {window._lastSeqStep = -1;}
                const currentSeqStep = window.dualMidiBridge && window.dualMidiBridge.parameterCache
                    ? window.dualMidiBridge.parameterCache['seq_current_step']
                    : undefined;
                const seqStepChanged = currentSeqStep !== undefined && currentSeqStep !== window._lastSeqStep;
                if (seqStepChanged) {
                    window._lastSeqStep = currentSeqStep;
                    window._seqPulseTime = timestamp;
                }

                const seqPulseAge = timestamp - (window._seqPulseTime || 0);
                const seqStepPulseMs = 200;
                const isEngRunning = window.dualMidiBridge && window.dualMidiBridge._seqEngine
                    ? window.dualMidiBridge._seqEngine.running
                    : false;

                seqBtnEl.classList.remove('is-inactive');
                if (seqPulseAge < seqStepPulseMs && isEngRunning) {
                    const pulseFade = seqPulseAge / seqStepPulseMs;
                    const brightness = 60 - pulseFade * 35;
                    const glowSize = 14 - pulseFade * 10;
                    seqBtnEl.style.setProperty('--seq-brightness', brightness.toFixed(0) + '%');
                    seqBtnEl.style.setProperty('--seq-glow', glowSize.toFixed(1) + 'px');
                    seqBtnEl.classList.remove('is-running', 'is-idle');
                    seqBtnEl.classList.add('is-pulse');
                } else if (isEngRunning) {
                    seqBtnEl.classList.remove('is-pulse', 'is-idle');
                    seqBtnEl.classList.add('is-running');
                } else {
                    seqBtnEl.classList.remove('is-pulse', 'is-running');
                    seqBtnEl.classList.add('is-idle');
                }
            } else {
                setButtonInactive(seqBtnEl);
            }
        }

        if (chordBtnEl) {
            if (isChordMemOn) {
                chordBtnEl.classList.remove('is-inactive');
                chordBtnEl.classList.add('is-active', blinkStateSlow ? 'blink-on' : 'blink-off');
            } else {
                setButtonInactive(chordBtnEl);
            }
        }

        if (polychordBtnEl) {
            if (isPolyChordOn) {
                polychordBtnEl.classList.remove('is-inactive');
                polychordBtnEl.classList.add('is-active', blinkStateSlow ? 'blink-on' : 'blink-off');
            } else {
                setButtonInactive(polychordBtnEl);
            }
        }

        requestAnimationFrame(runBlinkLoop);
    }
    requestAnimationFrame(runBlinkLoop);
}
