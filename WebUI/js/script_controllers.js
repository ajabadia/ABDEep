/**
 * @purpose Wheels/pressure/VU telemetry overlay controller — orchestration RAF loop.
 * Wheel overlays → script_controllers_wheels.js
 * LED pulse → script_controllers_leds.js
 * LCD core (LcdQueue, fade timing, lcdFadeUpdate, lcdSafeUpdate) → script_lcd_core.js
 * @lastUpdated 2026-07-25
 */

// Global telemetry loop coordinator
document.addEventListener('DOMContentLoaded', () => {
    const _ctrlEls = {};
    function _getCtrlEl(id) {
        if (!_ctrlEls[id]) {_ctrlEls[id] = document.getElementById(id);}
        return _ctrlEls[id];
    }

    // Typewriter animation state for patch name display
    window._twText = null;
    window._twBank = '';
    let _twStart = 0;
    let _twActive = false;
    const _TW_CHAR_MS = 65;

    // Crossfade state for SEQ step transitions on LCD
    let _seqPrevStep = -1;
    let _seqFadeOldHtml = '';
    let _seqFadeStart = 0;
    let _seqFadeActive = false;

    function _updateCtrlOverlay(_timestamp) {
        const bridge = window.dualMidiBridge;
        if (!bridge) {
            requestAnimationFrame(_updateCtrlOverlay);
            return;
        }

        let pb = 0.0, mw = 0.0, at = 0.0;

        if (bridge.isJuce && bridge._lastVoiceStateRaw) {
            pb = bridge._lastVoiceStateRaw.pitchBend !== undefined ? bridge._lastVoiceStateRaw.pitchBend : 0.0;
            mw = bridge._lastVoiceStateRaw.modWheel !== undefined ? bridge._lastVoiceStateRaw.modWheel : 0.0;
            at = bridge._lastVoiceStateRaw.aftertouch !== undefined ? bridge._lastVoiceStateRaw.aftertouch : 0.0;
        }

        pb = Math.max(-1, Math.min(1, pb));
        mw = Math.max(0, Math.min(1, mw));
        at = Math.max(0, Math.min(1, at));

        if (typeof window.applyControllerCurve === 'function') {
            at = window.applyControllerCurve(at, window.getControllerCurve('aftertouch'));
            mw = window.applyControllerCurve(mw, window.getControllerCurve('modwheel'));
            pb = typeof window.applyBipolarCurve === 'function'
                ? window.applyBipolarCurve(pb, window.getControllerCurve('pitchbend'))
                : pb;
        }

        // Update wheel overlays (Pitch Bend, Mod Wheel, Aftertouch fill bars)
        if (typeof window._updateWheelOverlays === 'function') {
            window._updateWheelOverlays(pb, mw, at);
        }

        // VU Meter
        const rawPeak = bridge.isJuce && bridge._lastVoiceStateRaw
            ? (bridge._lastVoiceStateRaw.peakLevel !== undefined ? bridge._lastVoiceStateRaw.peakLevel : 0.0)
            : 0.0;
        const peakLevel = typeof window._updateVuMeter === 'function'
            ? window._updateVuMeter(rawPeak)
            : 0.0;

        // ── LCD Telemetry ──
        const lcdText = _getCtrlEl('lcd-text');
        if (lcdText) {
            const queueMsg = window.LcdQueue.getActive();
            if (queueMsg && queueMsg.priority < 2 && !lcdText._lcdFading) {
                lcdText._ctrlLcdRestore = null;
                lcdText.style.removeProperty('transition');
                lcdText.style.opacity = '1';
                if (lcdText.innerHTML !== queueMsg.content) {
                    lcdText.innerHTML = queueMsg.content;
                }
            } else {
                const hasPb = Math.abs(pb) > 0.01;
                const hasAt = at > 0.01;
                const hasMw = mw > 0.01;
                const isSeqRunning = !hasPb && !hasAt && !hasMw && (bridge.parameterCache['seq_enable'] || 0) > 0.5 && typeof bridge.parameterCache['seq_current_step'] !== 'undefined';
                const hasVu = !hasPb && !hasAt && !hasMw && !isSeqRunning && peakLevel > 0.001;

                if (hasPb || hasAt || hasMw) {
                    if (lcdText._ctrlLcdFadeTimer) {
                        clearTimeout(lcdText._ctrlLcdFadeTimer);
                        lcdText._ctrlLcdFadeTimer = null;
                    }
                    lcdText.style.removeProperty('transition');
                    lcdText.style.opacity = '1';
                    if (!lcdText._ctrlLcdRestore) {
                        lcdText._ctrlLcdRestore = lcdText.innerHTML;
                    }
                    if (typeof window._buildWheelLcdHtml === 'function') {
                        lcdText.innerHTML = window._buildWheelLcdHtml(pb, mw, at);
                    }
                } else if (hasVu) {
                    if (lcdText._ctrlLcdFadeTimer) {
                        clearTimeout(lcdText._ctrlLcdFadeTimer);
                        lcdText._ctrlLcdFadeTimer = null;
                    }
                    lcdText.style.removeProperty('transition');
                    lcdText.style.opacity = '1';
                    if (!lcdText._ctrlLcdRestore) {
                        lcdText._ctrlLcdRestore = lcdText.innerHTML;
                    }
                    if (typeof window._buildVuLcdHtml === 'function') {
                        lcdText.innerHTML = window._buildVuLcdHtml(peakLevel);
                    }
                } else if (isSeqRunning) {
                    if (lcdText._ctrlLcdFadeTimer) {
                        clearTimeout(lcdText._ctrlLcdFadeTimer);
                        lcdText._ctrlLcdFadeTimer = null;
                    }
                    if (!lcdText._ctrlLcdRestore) {
                        lcdText._ctrlLcdRestore = lcdText.innerHTML;
                    }

                    // Track SEQ step changes for crossfade
                    const _currentSeqStep_ = bridge.parameterCache['seq_current_step'];
                    if (_currentSeqStep_ !== _seqPrevStep && _seqPrevStep !== -1) {
                        _seqFadeOldHtml = lcdText.innerHTML;
                        _seqFadeStart = Date.now();
                        _seqFadeActive = true;
                    }
                    _seqPrevStep = _currentSeqStep_;

                    let seqHtml;
                    if (window._seqDebugMode) {
                        if (typeof window._buildSeqDebugLcdHtml === 'function') {
                            seqHtml = window._buildSeqDebugLcdHtml(bridge);
                        } else {
                            seqHtml = '';
                        }
                    } else {
                        const seqModeBadge = typeof window._resolveSeqModeBadge === 'function'
                            ? window._resolveSeqModeBadge(bridge)
                            : '';
                        if (typeof window._buildSeqLcdHtml === 'function') {
                            seqHtml = window._buildSeqLcdHtml(bridge, seqModeBadge);
                        } else {
                            seqHtml = '';
                        }
                    }

                    if (_seqFadeActive) {
                        const fadeElapsed_ = Date.now() - _seqFadeStart;
                        const fadeHalf_ = 0;
                        if (fadeElapsed_ < fadeHalf_) {
                            const fadeOutOp_ = 1.0 - (fadeElapsed_ / fadeHalf_);
                            lcdText.innerHTML = _seqFadeOldHtml;
                            lcdText.style.opacity = String(Math.max(0, fadeOutOp_));
                        } else if (fadeElapsed_ < fadeHalf_ * 2) {
                            const fadeInOp_ = (fadeElapsed_ - fadeHalf_) / fadeHalf_;
                            lcdText.innerHTML = seqHtml;
                            lcdText.style.opacity = String(Math.min(1, fadeInOp_));
                        } else {
                            _seqFadeActive = false;
                            lcdText.innerHTML = seqHtml;
                            lcdText.style.removeProperty('transition');
                            lcdText.style.opacity = '1';
                        }
                    } else {
                        lcdText.style.removeProperty('transition');
                        lcdText.style.opacity = '1';
                        lcdText.innerHTML = seqHtml;
                    }
                } else if (lcdText._ctrlLcdRestore) {
                    if (typeof window._handleLcdFadeRestore === 'function') {
                        window._handleLcdFadeRestore(lcdText);
                    }
                } else {
                    if (typeof window._buildPatchNameLcdHtml === 'function') {
                        const pnResult = window._buildPatchNameLcdHtml(window._seqDebugMode || false);
                        if (pnResult.type === 'typewriter') {
                            // Typewriter animation: RAF-per-frame character reveal
                            if (!_twActive) {
                                _twActive = true;
                                _twStart = Date.now();
                            }
                            const elapsed_ = Date.now() - _twStart;
                            const charsToShow_ = Math.min(pnResult.twText.length, Math.max(1, Math.floor(elapsed_ / _TW_CHAR_MS)));
                            const revealed_ = pnResult.twText.substring(0, charsToShow_);
                            const isDone_ = charsToShow_ >= pnResult.twText.length;

                            if (isDone_) {
                                window._twText = null;
                                _twActive = false;
                                window._twBank = '';
                            }

                            const cursor_ = isDone_ ? '' : '<span class="lcd-cursor">_</span>';
                            lcdText.innerHTML = '<span class="lcd-text-xl">' + revealed_ + cursor_ + '</span>' + pnResult.debugBadge + '<br><span class="lcd-text-sub">' + pnResult.twBank.toUpperCase() + '</span>';
                        } else {
                            lcdText.innerHTML = pnResult.html;
                        }
                    }
                }
            }
        }

        // Update LCD glow pulse on SEQ step changes
        if (typeof window._updateLcdGlowPulse === 'function') {
            window._updateLcdGlowPulse(bridge);
        }

        requestAnimationFrame(_updateCtrlOverlay);
    }
    requestAnimationFrame(_updateCtrlOverlay);
});
