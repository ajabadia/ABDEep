/**
 * @purpose PANIC (All Notes Off) button, REQUEST FROM HW button, and reset timing counters.
 * @purpose_en Panic handler with SEQ/ARP reset, edit buffer request, and elapsed-time tooltips.
 */

// eslint-disable-next-line no-var
var Logger = globalThis.Logger || console;

// ── RESET COUNTERS ──
window._seqResetCount = 0;
window._arpResetCount = 0;
window._arpLastResetTime = null;
window._seqLastResetTime = null;

window._formatElapsedTime = function (timestamp) {
    if (timestamp === null) {return null;}
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 2) {return 'Just now';}
    if (elapsed < 60) {return elapsed + 's ago';}
    let mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    if (mins < 60) {return mins + 'm ' + secs + 's ago';}
    const hours = Math.floor(mins / 60);
    mins = mins % 60;
    return hours + 'h ' + mins + 'm ago';
};

window._updateResetTooltips = function () {
    const arpBtn = document.getElementById('modal-arp-reset-btn');
    const seqBtn = document.getElementById('modal-seq-reset-btn');
    const arpRel = window._formatElapsedTime(window._arpLastResetTime);
    const seqRel = window._formatElapsedTime(window._seqLastResetTime);
    if (arpBtn) {
        arpBtn.title = arpRel !== null
            ? 'Reset ARP engine \u2014 ' + arpRel + ' (#' + window._arpResetCount + ')'
            : 'Reset arpeggiator engine \u2014 stop, rewind to step 0, clear held notes';
    }
    if (seqBtn) {
        seqBtn.title = seqRel !== null
            ? 'Reset SEQ engine \u2014 ' + seqRel + ' (#' + window._seqResetCount + ')'
            : 'Reset sequencer engine \u2014 stop, rewind to step 0, clear held notes';
    }
};
setInterval(window._updateResetTooltips, 2000);

// ── INIT PANIC BUTTON ──
// eslint-disable-next-line no-unused-vars -- called from script.js via window.*
function initPanicButton() {
    const panicBtn = document.getElementById('programmer-panic-btn');
    if (!panicBtn) {return;}

    panicBtn.addEventListener('click', function () {
        if (typeof window.playKeyLedAnimation === 'function') {
            window.playKeyLedAnimation('panic');
        }
        const _pBtn_ = this;
        _pBtn_.classList.add('btn-panic', 'is-flashing');
        setTimeout(function () {
            _pBtn_.classList.remove('is-flashing');
        }, 380);

        const bridge = window.dualMidiBridge;
        if (!bridge) {
            alert('Bridge not initialized.');
            return;
        }

        let msgCount = 0;

        if (bridge.isJuce) {
            bridge.panic();
            msgCount = 1;
        } else if (bridge.midiOutput) {
            bridge._signalMidiActivity();
            for (let ch = 0; ch < 16; ch++) {
                const status = 0xB0 | ch;
                bridge.midiOutput.send([status, 123, 0]); // All Notes Off
                bridge.midiOutput.send([status, 120, 0]); // All Sound Off
                msgCount += 2;
            }
        }

        Logger.log('[Panic] Triggered panic routine. Sent ' + msgCount + ' messages/actions to stop notes.');

        let seqResetMsg = '';
        if (bridge._seqEngine) {
            const seqWasRunning = bridge._seqEngine.running;
            bridge._seqEngine.stop();
            bridge._seqEngine.stepIndex = 0;
            for (let si = 0; si < bridge._seqEngine.previousValues.length; si++) {
                bridge._seqEngine.previousValues[si] = 0;
            }
            bridge._seqEngine.heldNotes = [];
            if (seqWasRunning || (bridge.parameterCache['seq_enable'] || 0) > 0.5) {
                bridge._updateSeqEngine();
                const _seqNotesHeld_ = bridge._seqEngine.heldNotes.length;
                const _seqStepIdx_ = bridge._seqEngine.stepIndex;
                const _seqLen_ = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
                window._seqLastResetTime = Date.now();
                window._seqResetCount++;
                const _seqBar_ = window._genPosBar(Math.round((_seqStepIdx_ / Math.max(_seqLen_ - 1, 1)) * 18), 18);
                seqResetMsg = '<br>' + window._genLcdBarHtml('seq', {
                    decorated: true,
                    header: '\u2500\u2500\u2500 SEQ RESET #' + window._seqResetCount + ' \u2500\u2500\u2500',
                    stepInfo: 'Step ' + _seqStepIdx_ + ' \u00B7 ' + _seqNotesHeld_ + ' notes \u00B7 ' + _seqLen_ + ' steps',
                    bar: _seqBar_
                });
            }
        }

        let arpResetMsg = '';
        if (bridge._arpEngine) {
            const arpWasRunning = bridge._arpEngine.running;
            bridge._arpEngine.stop();
            bridge._arpEngine.stepIndex = 0;
            bridge._arpEngine.heldNotes = [];
            bridge._arpEngine.currentDirection = 1;
            bridge._arpActiveNotes = [];
            if (arpWasRunning || (bridge.parameterCache['arp_enable'] || 0) > 0.5) {
                const _arpNotesHeld_ = bridge._arpEngine.heldNotes.length;
                const _arpStepIdx_ = bridge._arpEngine.stepIndex;
                window._arpLastResetTime = Date.now();
                window._arpResetCount++;
                const _arpBar_ = window._genFillBar(Math.round((_arpNotesHeld_ / 12) * 18), 18);
                arpResetMsg = '<br>' + window._genLcdBarHtml('arp', {
                    decorated: true,
                    header: '\u2500\u2500\u2500 ARP RESET #' + window._arpResetCount + ' \u2500\u2500\u2500',
                    stepInfo: 'Step ' + _arpStepIdx_ + ' \u00B7 ' + _arpNotesHeld_ + ' notes held',
                    bar: _arpBar_
                });
            }
        }

        const lcdText = document.getElementById('lcd-text');
        if (lcdText) {
            const panicHtml = '<span class="lcd-label">\u26A0\uFE0F PANIC</span><br><strong class="lcd-color-danger">ALL NOTES OFF</strong><br><span class="lcd-sub">' + msgCount + ' MIDI messages sent</span>' + seqResetMsg + arpResetMsg;
            window.lcdSafeUpdate(lcdText, panicHtml);
        }
    });
}

// ── INIT REQUEST FROM HW ──
// eslint-disable-next-line no-unused-vars -- called from script.js via window.*
function initRequestHwButton() {
    const requestHwBtn = document.getElementById('programmer-request-hw-btn');
    if (!requestHwBtn) {return;}

    requestHwBtn.addEventListener('click', function () {
        const bridge = window.dualMidiBridge;
        if (!bridge) {
            alert('Bridge not initialized.');
            return;
        }
        const lcdText = document.getElementById('lcd-text');
        if (lcdText) {
            const html = '<span class="lcd-label">REQUESTING...</span><br><strong>EDIT BUFFER</strong>';
            window.lcdSafeUpdate(lcdText, html);
        }
        bridge.requestMidiDump('edit', 4000).then(function (response) {
            if (response) {
                Logger.log('[RequestHW] Edit buffer received:', response.length, 'bytes');
                if (lcdText) {
                    const okHtml = '<span class="lcd-color-green text-bold">\u2705 DUMP RECEIVED</span>';
                    window.lcdSafeUpdate(lcdText, okHtml);
                }
            } else {
                Logger.warn('[RequestHW] No response from hardware');
                if (lcdText) {
                    const failHtml = '<span class="lcd-color-danger text-bold">\u274C NO RESPONSE</span>';
                    window.lcdSafeUpdate(lcdText, failHtml);
                }
            }
        });
    });
}
