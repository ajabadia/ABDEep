/**
 * @purpose Controls programmer LCD priorities, fade animations, and wheels/pressure/VU telemetry overlays.
 * @purpose_en Wheel, Pressure and VU overlays controller with LCD prioritizer.
 */

// LCD Priority Queue
window.LcdQueue = {
    _messages: {},
    _expiryTimers: {},

    push: function(id, content, priority, options) {
        options = options || {};
        this._messages[id] = {
            content: content,
            priority: priority,
            timestamp: Date.now()
        };
        if (this._expiryTimers[id]) {
            clearTimeout(this._expiryTimers[id]);
        }
        var duration = (options.duration !== undefined) ? options.duration : 2000;
        if (duration !== null) {
            var self = this;
            this._expiryTimers[id] = setTimeout(function() {
                delete self._messages[id];
                delete self._expiryTimers[id];
            }, duration);
        }
    },

    getActive: function() {
        var best = null;
        for (var id in this._messages) {
            var m = this._messages[id];
            if (!best || m.priority < best.priority) {
                best = m;
            }
        }
        return best;
    },

    clear: function() {
        for (var id in this._expiryTimers) {
            clearTimeout(this._expiryTimers[id]);
        }
        this._messages = {};
        this._expiryTimers = {};
    }
};

window._LCD_FADE_OUT_EASING = "cubic-bezier(0.4, 0.0, 1.0, 1.0)";
window._LCD_FADE_IN_EASING = "cubic-bezier(0.0, 0.0, 0.2, 1.0)";

window.getLcdFadeTiming = function() {
    const speed = localStorage.getItem('abd-eep-fade-speed') || 'normal';
    switch (speed) {
        case 'off':    return { out:0, swap:0, in:0, cleanup:0, outR:0, swapR:0, inR:0, cleanupR:0 };
        case 'fast':   return { out:60, swap:70, in:60, cleanup:80, outR:80, swapR:90, inR:80, cleanupR:100 };
        case 'normal': return { out:100, swap:110, in:100, cleanup:130, outR:150, swapR:160, inR:150, cleanupR:180 };
        case 'slow':   return { out:220, swap:230, in:220, cleanup:250, outR:300, swapR:320, inR:300, cleanupR:350 };
        default:       return { out:100, swap:110, in:100, cleanup:130, outR:150, swapR:160, inR:150, cleanupR:180 };
    }
};

let _lcdLastParam = null;

window.lcdFadeUpdate = function(lcdEl, html, paramId) {
    if (lcdEl._ctrlLcdFadeTimer) {
        clearTimeout(lcdEl._ctrlLcdFadeTimer);
        lcdEl._ctrlLcdFadeTimer = null;
    }
    var contentId = 'param_' + (paramId || 'generic');
    
    // Read user timeout preference
    var saved = localStorage.getItem('abd-eep-lcd-timeout');
    var timeoutMs = 2000;
    if (saved !== null) {
        timeoutMs = saved === 'off' ? null : (parseInt(saved, 10) || 2000);
    }

    if (paramId && paramId === _lcdLastParam) {
        lcdEl.style.removeProperty('transition');
        lcdEl.style.opacity = '1';
        lcdEl.innerHTML = html;
        window.LcdQueue.push(contentId, html, 1, {
            duration: timeoutMs !== null ? timeoutMs : null
        });
        return;
    }
    _lcdLastParam = paramId;
    lcdEl._lcdFading = true;
    window.LcdQueue.push(contentId, html, 1, {
        duration: timeoutMs !== null ? timeoutMs : null
    });
    const t = window.getLcdFadeTiming();
    if (t.out === 0) {
        lcdEl._lcdFading = false;
        lcdEl.style.removeProperty('transition');
        lcdEl.style.opacity = '1';
        lcdEl.innerHTML = html;
        return;
    }
    lcdEl.style.transition = 'opacity ' + t.out + 'ms ' + window._LCD_FADE_OUT_EASING;
    lcdEl.style.opacity = '0';
    lcdEl._ctrlLcdFadeTimer = setTimeout(() => {
        if (lcdEl._ctrlLcdFadeTimer === null) return;
        lcdEl._ctrlLcdFadeTimer = null;
        lcdEl.innerHTML = html;
        lcdEl.style.transition = 'opacity ' + t.in + 'ms ' + window._LCD_FADE_IN_EASING;
        lcdEl.style.opacity = '1';
        lcdEl._lcdFading = false;
        setTimeout(() => {
            lcdEl.style.removeProperty('transition');
            lcdEl.style.removeProperty('opacity');
        }, t.cleanup);
    }, t.swap);
};

window.lcdSafeUpdate = function(lcdEl, html, paramId, options) {
    options = options || {};
    if (typeof window.lcdFadeUpdate === 'function' && options.useQueue !== false) {
        window.lcdFadeUpdate(lcdEl, html, paramId);
    } else {
        if (lcdEl._ctrlLcdFadeTimer) {
            clearTimeout(lcdEl._ctrlLcdFadeTimer);
            lcdEl._ctrlLcdFadeTimer = null;
        }
        lcdEl._lcdFading = false;
        lcdEl.style.removeProperty('transition');
        lcdEl.style.opacity = '1';
        lcdEl.innerHTML = html;
    }
};

// Global telemetry loop coordinator
document.addEventListener('DOMContentLoaded', () => {
    const _ctrlEls = {};
    function _getCtrlEl(id) {
        if (!_ctrlEls[id]) _ctrlEls[id] = document.getElementById(id);
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

    // Glow pulse on SEQ step changes
    let _seqGlowPulse = 0;
    let _seqGlowLastStep = -1;

    // VU ballistics state
    let _vuSmoothed = 0.0;
    let _vuLastTime = Date.now();

    function _updateCtrlOverlay(timestamp) {
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

        const pbFill = _getCtrlEl('ctrl-o-pb-fill');
        const pbVal = _getCtrlEl('ctrl-o-pb-val');
        if (pbFill) {
            const center = 50;
            const left = pb >= 0 ? center : center + pb * 50;
            const width = Math.abs(pb) * 50;
            pbFill.style.left = left + '%';
            pbFill.style.width = width + '%';
            pbFill.style.background = pb >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
        }
        if (pbVal) {
            const st = pb * 2.0;
            pbVal.textContent = (st >= 0 ? '+' : '') + st.toFixed(2);
            pbVal.style.color = pb >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
        }

        const mwFill = _getCtrlEl('ctrl-o-mw-fill');
        const mwVal = _getCtrlEl('ctrl-o-mw-val');
        if (mwFill) {
            mwFill.style.width = Math.round(mw * 100) + '%';
            mwFill.style.background = mw > 0.01 ? 'var(--accent-blue)' : 'var(--text-faint)';
        }
        if (mwVal) {
            mwVal.textContent = Math.round(mw * 100) + '%';
            mwVal.style.color = mw > 0.01 ? 'var(--accent-blue)' : 'var(--text-faint)';
        }

        const atFill = _getCtrlEl('ctrl-o-at-fill');
        const atVal = _getCtrlEl('ctrl-o-at-val');
        if (atFill) {
            atFill.style.width = Math.round(at * 100) + '%';
            atFill.style.background = at > 0.01 ? 'var(--accent-orange)' : 'var(--text-faint)';
        }
        if (atVal) {
            atVal.textContent = Math.round(at * 100) + '%';
            atVal.style.color = at > 0.01 ? 'var(--accent-orange)' : 'var(--text-faint)';
        }

        const VU_ATTACK_MS = 5;
        const VU_RELEASE_MS = 300;
        let rawPeak = 0.0;
        if (bridge.isJuce && bridge._lastVoiceStateRaw) {
            rawPeak = bridge._lastVoiceStateRaw.peakLevel !== undefined ? bridge._lastVoiceStateRaw.peakLevel : 0.0;
        }
        rawPeak = Math.max(0, Math.min(1, rawPeak));
        
        const now = Date.now();
        const dt = Math.min(100, Math.max(1, now - _vuLastTime));
        _vuLastTime = now;
        if (rawPeak > _vuSmoothed) {
            const attackCoeff = Math.exp(-dt / VU_ATTACK_MS);
            _vuSmoothed = _vuSmoothed * attackCoeff + rawPeak * (1 - attackCoeff);
        } else {
            const releaseCoeff = Math.exp(-dt / VU_RELEASE_MS);
            _vuSmoothed = rawPeak + (_vuSmoothed - rawPeak) * releaseCoeff;
        }
        if (_vuSmoothed < 0.001) _vuSmoothed = 0.0;
        const peakLevel = _vuSmoothed;

        const lcdText = _getCtrlEl('lcd-text');
        if (lcdText) {
            var queueMsg = window.LcdQueue.getActive();
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
                    let lcdContent = '';
                    if (hasPb) {
                        const st = (pb * 2.0).toFixed(2);
                        const pbColor = pb >= 0 ? 'var(--accent-green)' : 'var(--accent-pink)';
                        const pbRaw = Math.round((pb + 1) * 8191.5);
                        const center = 10;
                        const fillLen = Math.round(Math.abs(pb) * center);
                        const leftBar = pb >= 0
                            ? window._genFillBar(0, center)
                            : window._genFillBar(fillLen, center);
                        const rightBar = pb < 0
                            ? window._genFillBar(0, center)
                            : window._genFillBar(fillLen, center);
                        const centerMarker = '\u2502';
                        lcdContent += `<span style="font-size:10px; opacity:0.6;">WHEEL</span><br>`
                            + `<strong style="color:${pbColor};">PITCH BEND</strong><br>`
                            + `<span style="font-size:16px; color:${pbColor};">${pb >= 0 ? '+' : ''}${st} st</span><br>`
                            + window._genBarHtml(leftBar + centerMarker + rightBar, { letterSpacing: '0', suffix: '<span style="font-size:7px; color:var(--text-faint);"> ' + pbRaw + '</span>' });
                    }
                    if (hasPb && (hasAt || hasMw)) {
                        lcdContent += `<br>`;
                    }
                    if (hasAt) {
                        const atPct = Math.round(at * 100);
                        const barLen = Math.round(at * 20);
                        lcdContent += `<span style="font-size:10px; opacity:0.6;">CHANNEL PRESSURE</span><br>`
                            + `<strong style="color:var(--accent-orange);">AFTERTOUCH</strong><br>`
                            + `<span style="font-size:16px; color:var(--accent-orange);">${atPct}%</span><br>`
                            + window._genBarHtml(window._genFillBar(barLen, 20));
                    }
                    if ((hasPb || hasAt) && hasMw) {
                        lcdContent += `<br>`;
                    }
                    if (hasMw) {
                        const mwPct = Math.round(mw * 100);
                        const barLen = Math.round(mw * 20);
                        lcdContent += `<span style="font-size:10px; opacity:0.6;">MODULATION</span><br>`
                            + `<strong style="color:var(--accent-blue);">MOD WHEEL</strong><br>`
                            + `<span style="font-size:16px; color:var(--accent-blue);">${mwPct}%</span><br>`
                            + window._genBarHtml(window._genFillBar(barLen, 20));
                    }
                    lcdText.innerHTML = lcdContent;
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
                    let vuColor = 'var(--text-faint)';
                    if (peakLevel < 0.001) vuColor = 'var(--text-faint)';
                    else if (peakLevel < 0.06) vuColor = 'var(--accent-green)';
                    else if (peakLevel < 0.5) vuColor = 'var(--accent-yellow)';
                    else if (peakLevel < 0.7) vuColor = 'var(--accent-orange)';
                    else vuColor = 'var(--color-danger)';
                    const db = peakLevel < 0.0001 ? '-\u221E' : (20.0 * Math.log10(peakLevel)).toFixed(1);
                    const barLen = Math.round(peakLevel * 24);
                    lcdText.innerHTML = `<span style="font-size:10px; opacity:0.6;">OUTPUT LEVEL</span><br>`
                        + `<span style="font-size:14px; color:${vuColor};">${db} dB</span><br>`
                        + window._genBarHtml(window._genFillBar(barLen, 24), { color: vuColor })
                        + (peakLevel > 0.9 ? `<br><span style="font-size:10px; color:var(--color-danger); font-weight:bold;">CLIP!</span>` : '');
                } else if (isSeqRunning) {
                    if (lcdText._ctrlLcdFadeTimer) {
                        clearTimeout(lcdText._ctrlLcdFadeTimer);
                        lcdText._ctrlLcdFadeTimer = null;
                    }
                    if (!lcdText._ctrlLcdRestore) {
                        lcdText._ctrlLcdRestore = lcdText.innerHTML;
                    }
                    
                    var _currentSeqStep_ = bridge.parameterCache['seq_current_step'];
                    if (_currentSeqStep_ !== _seqPrevStep && _seqPrevStep !== -1) {
                        _seqFadeOldHtml = lcdText.innerHTML;
                        _seqFadeStart = Date.now();
                        _seqFadeActive = true;
                    }
                    _seqPrevStep = _currentSeqStep_;
                    
                    if (window._seqDebugMode) {
                        var seqDebugHtml = '<span style="font-size:9px; opacity:0.6;">SEQ DEBUG <span style="color:var(--color-danger);">●</span></span><br>';
                        var _clockNames_ = ['1/32','1/16T','1/32D','1/16','1/8T','1/16D','1/8','1/4T','1/8D','1/4','1/2T','1/4D','1/2','1/1T','1/2D','1/1'];
                        var _clockVal_ = Math.round((bridge.parameterCache['seq_clock'] || 0) * 15);
                        var _clockLabel_ = _clockNames_[_clockVal_] || '1/8';
                        var _bpm_ = 20 + (bridge.parameterCache['arp_rate'] || 0.5) * 220;
                        var _divider_ = [2, 8/3, 3, 4, 16/3, 6, 8, 12, 16, 24, 32][_clockVal_] || 4;
                        var _baseMs_ = (60000 / _bpm_) / _divider_;
                        var _swingNorm_ = bridge.parameterCache['seq_swing'] || 0;
                        var _swingFactor_ = _swingNorm_ * 0.5;
                        var _evenMs_ = Math.round(_baseMs_ * (1 + _swingFactor_));
                        var _oddMs_ = Math.round(_baseMs_ * (1 - _swingFactor_));
                        var _seqDestName_ = '';
                        try {
                            for (var _ms_ = 1; _ms_ <= 8; _ms_++) {
                                var _src_ = bridge.parameterCache['mod_matrix_slot' + _ms_ + '_src'];
                                if (_src_ !== undefined && Math.round(_src_ * 22) === 14) {
                                    var _dest_ = bridge.parameterCache['mod_matrix_slot' + _ms_ + '_dest'];
                                    if (_dest_ !== undefined) {
                                        var _destIdx_ = Math.round(_dest_ * 129);
                                        _seqDestName_ = (typeof FULL_MOD_DESTINATIONS !== 'undefined' && FULL_MOD_DESTINATIONS[_destIdx_])
                                            ? FULL_MOD_DESTINATIONS[_destIdx_]
                                            : 'Dest ' + _destIdx_;
                                    }
                                    break;
                                }
                            }
                        } catch(e) {}
                        seqDebugHtml += '<span style="display:block;font-size:7px;color:var(--text-dim);margin-bottom:2px">'
                            + '<span style="color:var(--accent-pink);">' + _clockLabel_ + '</span> '
                            + Math.round(_bpm_) + ' BPM '
                            + '<span style="opacity:0.6">|</span> ' + Math.round(_baseMs_) + 'ms/step'
                            + (_swingNorm_ > 0.001 ? ' <span style="opacity:0.5">(even:</span><span style="color:var(--accent-yellow);opacity:0.8">' + _evenMs_ + '</span><span style="opacity:0.5"> odd:</span><span style="color:var(--accent-cyan);opacity:0.8">' + _oddMs_ + '</span><span style="opacity:0.5">ms)</span>' : '')
                            + (_seqDestName_ ? ' <span style="opacity:0.6">|</span> <span style="color:var(--accent-pink);opacity:0.8">→</span><span style="color:var(--accent-cyan);font-weight:bold;opacity:0.9">' + _seqDestName_ + '</span>' : '')
                            + '</span>';
                        var _slewNorm_ = bridge.parameterCache['seq_slew_rate'] || 0;
                        if (_slewNorm_ > 0.001) {
                            var _slewPct_ = Math.round(_slewNorm_ * 100);
                            var _slewRaw_ = Math.round(_slewNorm_ * 255);
                            var _slewK_ = _slewNorm_ * 0.5;
                            var _slewSteps_ = _slewK_ > 0.01 ? Math.round(Math.log(0.1) / Math.log(1 - _slewK_)) : 0;
                            var _slewMs_ = Math.round(_slewSteps_ * _baseMs_);
                            seqDebugHtml += '<span style="display:block;font-size:6px;color:var(--text-dim);margin-bottom:1px;opacity:0.7">'
                                + 'Slew: <span style="color:var(--accent-orange);">' + _slewPct_ + '%</span>'
                                + ' <span style="opacity:0.4">(raw:' + _slewRaw_ + ')</span>'
                                + ' <span style="opacity:0.6">|</span> <span style="opacity:0.5">smoothing:</span><span style="color:var(--accent-yellow);opacity:0.8">~' + _slewMs_ + 'ms</span>'
                                + ' <span style="opacity:0.4">(' + _slewSteps_ + ' steps to 90%)</span>'
                                + '</span>';
                        }
                        var _debugSeqLen_ = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
                        seqDebugHtml += '<span style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;font-size:6.5px;font-family:monospace;color:var(--text-faint);line-height:1.3">';
                        var _activeStep_ = bridge.parameterCache['seq_current_step'];
                        for (var di = 0; di < _debugSeqLen_; di++) {
                            var isActiveCell_ = _activeStep_ !== undefined && di === _activeStep_;
                            var paramId = 'seq_step_' + (di + 1);
                            var norm = bridge.parameterCache[paramId];
                            var raw = norm !== undefined ? Math.round(norm * 255) : 128;
                            var bip = raw === 0 ? -128 : raw - 128;
                            var num = (di + 1) < 10 ? '0' + (di + 1) : '' + (di + 1);
                            var isSkip = raw === 0;
                            var valStr = isSkip ? '<span style="color:var(--color-danger)">SKIP</span>' : (bip >= 0 ? '+' + bip : '' + bip);
                            var color = isSkip ? 'var(--color-danger)' : (bip > 0 ? 'var(--accent-pink)' : (bip < 0 ? 'var(--text-dim)' : 'var(--text-faint)'));
                            var rawStr = isSkip ? '000' : (raw < 100 ? '0' : '') + (raw < 10 ? '0' : '') + raw;
                            var ccVal = norm !== undefined ? Math.round(norm * 127) : 64;
                            var ccStr = isSkip ? '00' : (ccVal < 100 ? '0' : '') + (ccVal < 10 ? '0' : '') + ccVal;
                            var ccColor = color;
                            var ccTitle = '';
                            if (!isSkip) {
                                if (ccVal >= 127) { ccColor = 'var(--color-danger)'; ccTitle = ' title="⚠ SATURATION"'; }
                                else if (ccVal >= 125) { ccColor = 'var(--accent-orange)'; ccTitle = ' title="⚠ Near saturation"'; }
                                else if (ccVal >= 120) { ccColor = 'var(--accent-yellow)'; ccTitle = ' title="⚠ Approaching saturation"'; }
                            }
                            if (isActiveCell_) {
                                seqDebugHtml += '<span style="color:var(--text-primary);background:color-mix(in srgb,var(--accent-pink) 18%,transparent);outline:1px solid color-mix(in srgb,var(--accent-pink) 40%,transparent)">▶' + num + ':' + valStr + '(' + rawStr + '/<span style="color:' + ccColor + '"' + ccTitle + '>' + ccStr + '</span>)</span>';
                            } else {
                                seqDebugHtml += '<span style="color:' + color + '">' + num + ':' + valStr + '(' + rawStr + '/<span style="color:' + ccColor + '"' + ccTitle + '>' + ccStr + '</span>)</span>';
                            }
                        }
                        seqDebugHtml += '</span>';
                        lcdText.innerHTML = seqDebugHtml;
                        return;
                    }
                    
                    const seqStep = bridge.parameterCache['seq_current_step'];
                    const seqVal = bridge.parameterCache['seq_current_value'] || 0.5;
                    const seqLen = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
                    const seqEn = (bridge.parameterCache['seq_enable'] || 0) > 0.5;
                    const seqSkip = (bridge.parameterCache['seq_current_step_skip'] || 0) > 0.5;
                    const bipVal = (seqVal * 2.0) - 1.0;
                    const barHalf = 12;
                    const fillLen = Math.round(Math.abs(bipVal) * barHalf);
                    const leftBar = bipVal >= 0
                        ? window._genFillBar(0, barHalf)
                        : window._genFillBar(fillLen, barHalf);
                    const rightBar = bipVal < 0
                        ? window._genFillBar(0, barHalf)
                        : window._genFillBar(fillLen, barHalf);
                    const centerMarker = '\u2502';
                    const stepBarLen = Math.min(seqLen, 24);
                    const stepDot = seqStep < stepBarLen ? seqStep : (seqStep % stepBarLen);
                    const stepBar = window._genPosBar(stepDot, stepBarLen);
                    const seqColor = 'var(--accent-pink)';
                    const seqRawVal = Math.round(seqVal * 255);
                    var _seqKeyLoopVal = Math.round((bridge.parameterCache['seq_key_loop'] || 0) * 2);
                    var _seqModeBadge = '';
                    if (bridge._seqEngine && bridge._seqEngine._forcedFreeRunning) {
                        _seqModeBadge = ' <span style="color:var(--accent-yellow);font-weight:bold;font-size:8px;cursor:help" title="Key Sync desactivado automáticamente — no había teclas presionadas al activar SEQ">FREE*</span>';
                    } else if (_seqKeyLoopVal === 0) {
                        _seqModeBadge = ' <span style="color:var(--accent-green);font-size:8px;">FREE</span>';
                    } else if (_seqKeyLoopVal === 1) {
                        _seqModeBadge = ' <span style="color:var(--accent-blue);font-size:8px;">KEY</span>';
                    } else if (_seqKeyLoopVal === 2) {
                        _seqModeBadge = ' <span style="color:var(--accent-teal);font-size:8px;">LOOP</span>';
                    }
                    var seqHtml = '';
                    if (seqSkip) {
                        const centerBar = '\u2591'.repeat(12) + '\u2502' + '\u2591'.repeat(12);
                        seqHtml = `<span style="font-size:10px; opacity:0.6;">CONTROL SEQ ${seqEn ? '\u25B6' : '\u25A0'}${_seqModeBadge}</span><br>`
                            + `<strong style="color:${seqColor};">STEP ${seqStep + 1} / ${seqLen} <span style="color:var(--color-danger);font-weight:bold;font-size:9px;">SKIP</span></strong><br>`
                            + window._genBarHtml(centerBar, { letterSpacing: '0' })
                            + `<span style="font-size:8px; color:var(--color-danger); margin-left:4px;"> -- (raw:${seqRawVal})</span><br>`
                            + window._genBarHtml(stepBar, { color: seqColor });
                    } else {
                        const seqExactVal = Math.round(bipVal * 127);
                        const seqValStr = seqExactVal >= 0 ? '+' + seqExactVal : String(seqExactVal);
                        seqHtml = `<span style="font-size:10px; opacity:0.6;">CONTROL SEQ ${seqEn ? '\u25B6' : '\u25A0'}${_seqModeBadge}</span><br>`
                            + `<strong style="color:${seqColor};">STEP ${seqStep + 1} / ${seqLen}</strong><br>`
                            + `<span style="font-size:8px; letter-spacing:0; color:var(--text-faint);">${leftBar}${centerMarker}${rightBar}</span>`
                            + `<span style="font-size:8px; color:${seqColor}; margin-left:4px;"> ${seqValStr} (raw:${seqRawVal})</span><br>`
                            + window._genBarHtml(stepBar, { color: seqColor });
                    }
                    
                    if (_seqFadeActive) {
                        var fadeElapsed_ = Date.now() - _seqFadeStart;
                        var fadeHalf_ = 40;
                        if (fadeElapsed_ < fadeHalf_) {
                            var fadeOutOp_ = 1.0 - (fadeElapsed_ / fadeHalf_);
                            lcdText.innerHTML = _seqFadeOldHtml;
                            lcdText.style.opacity = String(Math.max(0, fadeOutOp_));
                        } else if (fadeElapsed_ < fadeHalf_ * 2) {
                            var fadeInOp_ = (fadeElapsed_ - fadeHalf_) / fadeHalf_;
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
                    const restoreHtml = lcdText._ctrlLcdRestore;
                    lcdText._ctrlLcdRestore = null;
                    if (lcdText._ctrlLcdFadeTimer) {
                        clearTimeout(lcdText._ctrlLcdFadeTimer);
                    }
                    const rt = window.getLcdFadeTiming();
                    if (rt.outR === 0) {
                        if (lcdText._ctrlLcdFadeTimer) clearTimeout(lcdText._ctrlLcdFadeTimer);
                        lcdText._ctrlLcdFadeTimer = null;
                        lcdText.innerHTML = restoreHtml;
                        lcdText.style.removeProperty('transition');
                        lcdText.style.opacity = '1';
                    } else {
                        lcdText.style.transition = 'opacity ' + rt.outR + 'ms ' + window._LCD_FADE_OUT_EASING;
                        lcdText.style.opacity = '0';
                        lcdText._ctrlLcdFadeTimer = setTimeout(() => {
                            lcdText._ctrlLcdFadeTimer = null;
                            if (lcdText._ctrlLcdRestore !== null) return;
                            lcdText.innerHTML = restoreHtml;
                            lcdText.style.transition = 'opacity ' + rt.inR + 'ms ' + window._LCD_FADE_IN_EASING;
                            lcdText.style.opacity = '1';
                            setTimeout(() => {
                                lcdText.style.removeProperty('transition');
                                lcdText.style.removeProperty('opacity');
                            }, rt.cleanupR);
                        }, rt.swapR);
                    }
                } else {
                    var basePatchName_ = bridge && bridge.parameterCache && bridge.parameterCache['patch_name']
                        ? bridge.parameterCache['patch_name']
                        : 'INITIAL PATCH';
                    var baseBankName_ = window.currentActiveBank || '';
                    var debugBadge_ = window._seqDebugMode ? '<span style="float:right;font-size:6px;color:var(--color-danger);border:1px solid var(--color-danger);padding:0 2px;border-radius:1px;line-height:10px;">DBG</span>' : '';
                    
                    if (window._twText) {
                        if (!_twActive) {
                            _twActive = true;
                            _twStart = Date.now();
                        }
                        var elapsed_ = Date.now() - _twStart;
                        var charsToShow_ = Math.min(window._twText.length, Math.max(1, Math.floor(elapsed_ / _TW_CHAR_MS)));
                        var revealed_ = window._twText.substring(0, charsToShow_);
                        var isDone_ = charsToShow_ >= window._twText.length;
                        
                        if (isDone_) {
                            window._twText = null;
                            _twActive = false;
                            window._twBank = '';
                        }
                        
                        var cursor_ = isDone_ ? '' : '<span class="lcd-cursor">_</span>';
                        lcdText.innerHTML = '<span style="font-size:16px;color:var(--text-primary);letter-spacing:1px;">' + revealed_ + cursor_ + '</span>' + debugBadge_ + '<br><span style="font-size:7px;color:var(--text-faint);letter-spacing:0.5px;">' + window._twBank.toUpperCase() + '</span>';
                    } else {
                        lcdText.innerHTML = '<span style="font-size:16px;color:var(--text-primary);letter-spacing:1px;">' + basePatchName_.toUpperCase() + '</span>' + debugBadge_ + '<br><span style="font-size:7px;color:var(--text-faint);letter-spacing:0.5px;">' + baseBankName_.toUpperCase() + '</span>';
                    }
                }
            }
        }

        var _glowEl_ = document.getElementById('lcd-glow-pulse');
        if (_glowEl_) {
            var _gSeqEn_ = bridge.parameterCache && (bridge.parameterCache['seq_enable'] || 0) > 0.5;
            var _gStep_ = bridge.parameterCache ? bridge.parameterCache['seq_current_step'] : undefined;
            var _gStepChanged_ = _gStep_ !== undefined && _gStep_ !== _seqGlowLastStep;
            if (_gStepChanged_) {
                _seqGlowLastStep = _gStep_;
                _seqGlowPulse = Date.now();
            }
            if (_gSeqEn_ && _gStep_ !== undefined) {
                var _gAge_ = Date.now() - _seqGlowPulse;
                var _gDur_ = 400;
                if (_gAge_ < _gDur_) {
                    var _gInt_ = 1.0 - (_gAge_ / _gDur_);
                    var _gSize_ = 2 + _gInt_ * 4;
                    _glowEl_.style.boxShadow = '0 0 ' + _gSize_.toFixed(1) + 'px color-mix(in srgb, var(--accent-pink) 40%, transparent)';
                } else if (_glowEl_.style.boxShadow) {
                    _glowEl_.style.boxShadow = '';
                }
            } else if (_glowEl_.style.boxShadow) {
                _glowEl_.style.boxShadow = '';
            }
        }

        requestAnimationFrame(_updateCtrlOverlay);
    }
    requestAnimationFrame(_updateCtrlOverlay);
});
