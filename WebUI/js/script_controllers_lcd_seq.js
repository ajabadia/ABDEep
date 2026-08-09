/**
 * @purpose LCD content builders for SEQ telemetry overlay (debug + normal + mode badge).
 * Extracted from script_controllers_lcd.js LCD SEQ section.
 * @classification Module/Controllers/LCD/SEQ
 * @lastUpdated 2026-07-29
 */

/* global FULL_MOD_DESTINATIONS */

/** Build LCD HTML for SEQ debug mode */
window._buildSeqDebugLcdHtml = function(bridge) {
    let seqDebugHtml = '<span class=\"lcd-seq-debug-header\">SEQ DEBUG <span class=\"lcd-color-red\">\u25CF</span></span><br>';
    const _clockNames_ = ['1/2', '3/8', '1/3', '1/4', '3/16', '1/6', '1/8', '1/12', '1/16', '1/24', '1/32', '1/48', '1/64', '1/96', '1/128', '1/192'];
    const _clockVal_ = Math.round((bridge.parameterCache['seq_clock'] || 0) * 15);
    const _clockLabel_ = _clockNames_[_clockVal_] || '1/8';
    const _bpm_ = 20 + (bridge.parameterCache['arp_rate'] || 0.5) * 220;
    const _divider_ = [2, 8/3, 3, 4, 16/3, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192][_clockVal_] || 4;
    const _baseMs_ = (60000 / _bpm_) / _divider_;
    const _swingNorm_ = bridge.parameterCache['seq_swing'] || 0;
    const _swingFactor_ = _swingNorm_ * 0.5;
    const _evenMs_ = Math.round(_baseMs_ * (1 + _swingFactor_));
    const _oddMs_ = Math.round(_baseMs_ * (1 - _swingFactor_));
    let _seqDestName_ = '';
    try {
        for (let _ms_ = 1; _ms_ <= 8; _ms_++) {
            const _src_ = bridge.parameterCache['mod_matrix_slot' + _ms_ + '_src'];
            if (_src_ !== undefined && Math.round(_src_ * 22) === 14) {
                const _dest_ = bridge.parameterCache['mod_matrix_slot' + _ms_ + '_dest'];
                if (_dest_ !== undefined) {
                    const _destIdx_ = Math.round(_dest_ * 129);
                    _seqDestName_ = (typeof FULL_MOD_DESTINATIONS !== 'undefined' && FULL_MOD_DESTINATIONS[_destIdx_])
                        ? FULL_MOD_DESTINATIONS[_destIdx_]
                        : 'Dest ' + _destIdx_;
                }
                break;
            }
        }
    } catch(e) {}
    seqDebugHtml += '<span class=\"lcd-seq-debug-info\">'
        + '<span class=\"lcd-color-pink\">' + _clockLabel_ + '</span> '
        + Math.round(_bpm_) + ' BPM '
        + '<span class=\"op-60\">|</span> ' + Math.round(_baseMs_) + 'ms/step'
        + (_swingNorm_ > 0.001 ? ' <span class=\"op-50\">(even:</span><span class=\"lcd-color-yellow op-80\">' + _evenMs_ + '</span><span class=\"op-50\"> odd:</span><span class=\"lcd-color-cyan op-80\">' + _oddMs_ + '</span><span class=\"op-50\">ms)</span>' : '')
        + (_seqDestName_ ? ' <span class=\"op-60\">|</span> <span class=\"lcd-color-pink op-80\">\u2192</span><span class=\"lcd-color-cyan text-bold op-90\">' + _seqDestName_ + '</span>' : '')
        + '</span>';
    const _slewNorm_ = bridge.parameterCache['seq_slew_rate'] || 0;
    if (_slewNorm_ > 0.001) {
        const _slewPct_ = Math.round(_slewNorm_ * 100);
        const _slewRaw_ = Math.round(_slewNorm_ * 255);
        const _slewK_ = _slewNorm_ * 0.5;
        const _slewSteps_ = _slewK_ > 0.01 ? Math.round(Math.log(0.1) / Math.log(1 - _slewK_)) : 0;
        const _slewMs_ = Math.round(_slewSteps_ * _baseMs_);
        seqDebugHtml += '<span class=\"lcd-seq-slew-info\">'
            + 'Slew: <span class=\"lcd-color-orange\">' + _slewPct_ + '%</span>'
            + ' <span class=\"op-40\">(raw:' + _slewRaw_ + ')</span>'
            + ' <span class=\"op-60\">|</span> <span class=\"op-50\">smoothing:</span><span class=\"lcd-color-yellow op-80\">~' + _slewMs_ + 'ms</span>'
            + ' <span class=\"op-40\">(' + _slewSteps_ + ' steps to 90%)</span>'
            + '</span>';
    }
    const _debugSeqLen_ = Math.round((bridge.parameterCache['seq_length'] || 0) * 31) + 2;
    seqDebugHtml += '<span class=\"lcd-seq-debug-grid\">';
    const _activeStep_ = bridge.parameterCache['seq_current_step'];
    for (let di = 0; di < _debugSeqLen_; di++) {
        const isActiveCell_ = _activeStep_ !== undefined && di === _activeStep_;
        const paramId = 'seq_step_' + (di + 1);
        const norm = bridge.parameterCache[paramId];
        const raw = norm !== undefined ? Math.round(norm * 255) : 128;
        const bip = raw === 0 ? -128 : raw - 128;
        const num = (di + 1) < 10 ? '0' + (di + 1) : '' + (di + 1);
        const isSkip = raw === 0;
        const valStr = isSkip ? '<span class=\"lcd-color-red\">SKIP</span>' : (bip >= 0 ? '+' + bip : '' + bip);
        const colorClass = isSkip ? 'lcd-color-red' : (bip > 0 ? 'lcd-color-pink' : (bip < 0 ? 'text-dim' : 'text-faint'));
        const rawStr = isSkip ? '000' : (raw < 100 ? '0' : '') + (raw < 10 ? '0' : '') + raw;
        const ccVal = norm !== undefined ? Math.round(norm * 127) : 64;
        const ccStr = isSkip ? '00' : (ccVal < 100 ? '0' : '') + (ccVal < 10 ? '0' : '') + ccVal;
        let ccColorClass = colorClass;
        let ccTitle = '';
        if (!isSkip) {
            if (ccVal >= 127) { ccColorClass = 'lcd-color-red'; ccTitle = ' title=\"\u26A0 SATURATION\"'; }
            else if (ccVal >= 125) { ccColorClass = 'lcd-color-orange'; ccTitle = ' title=\"\u26A0 Near saturation\"'; }
            else if (ccVal >= 120) { ccColorClass = 'lcd-color-yellow'; ccTitle = ' title=\"\u26A0 Approaching saturation\"'; }
        }
        if (isActiveCell_) {
            seqDebugHtml += '<span class=\"lcd-seq-debug-cell-active\">\u25B6' + num + ':' + valStr + '(' + rawStr + '/<span class=\"' + ccColorClass + '\"' + ccTitle + '>' + ccStr + '</span>)</span>';
        } else {
            seqDebugHtml += '<span class=\"' + colorClass + '\">' + num + ':' + valStr + '(' + rawStr + '/<span class=\"' + ccColorClass + '\"' + ccTitle + '>' + ccStr + '</span>)</span>';
        }
    }
    seqDebugHtml += '</span>';
    return seqDebugHtml;
};

/** Build LCD HTML for normal SEQ (non-debug) step display */
window._buildSeqLcdHtml = function(bridge, seqModeBadge) {
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
    if (seqSkip) {
        const centerBar = '\u2591'.repeat(12) + '\u2502' + '\u2591'.repeat(12);
        return '<span class=\"lcd-label\">CONTROL SEQ ' + (seqEn ? '\u25B6' : '\u25A0') + seqModeBadge + '</span><br>'
            + '<strong class=\"lcd-color-pink\">STEP ' + (seqStep + 1) + ' / ' + seqLen + ' <span class=\"lcd-seq-skip-text\">SKIP</span></strong><br>'
            + window._genBarHtml(centerBar, { letterSpacing: '0' })
            + '<span class=\"lcd-seq-val-skip\"> -- (raw:' + seqRawVal + ')</span><br>'
            + window._genBarHtml(stepBar, { color: seqColor });
    } else {
        const seqExactVal = Math.round(bipVal * 127);
        const seqValStr = seqExactVal >= 0 ? '+' + seqExactVal : String(seqExactVal);
        return '<span class=\"lcd-label\">CONTROL SEQ ' + (seqEn ? '\u25B6' : '\u25A0') + seqModeBadge + '</span><br>'
            + '<strong class=\"lcd-color-pink\">STEP ' + (seqStep + 1) + ' / ' + seqLen + '</strong><br>'
            + '<span class=\"lcd-seq-bars\">' + leftBar + centerMarker + rightBar + '</span>'
            + '<span class=\"lcd-seq-val-norm\"> ' + seqValStr + ' (raw:' + seqRawVal + ')</span><br>'
            + window._genBarHtml(stepBar, { color: seqColor });
    }
};

/** Resolve SEQ mode badge string based on key loop mode */
window._resolveSeqModeBadge = function(bridge) {
    const _seqKeyLoopVal = Math.round((bridge.parameterCache['seq_key_loop'] || 0) * 2);
    if (bridge._seqEngine && bridge._seqEngine._forcedFreeRunning) {
        return ' <span class=\"lcd-seq-mode-badge-free-forced\" title=\"Key Sync desactivado autom\u00E1ticamente \u2014 no hab\u00EDa teclas presionadas al activar SEQ\">FREE*</span>';
    } else if (_seqKeyLoopVal === 0) {
        return ' <span class=\"lcd-seq-mode-badge-free\">FREE</span>';
    } else if (_seqKeyLoopVal === 1) {
        return ' <span class=\"lcd-seq-mode-badge-key\">KEY</span>';
    } else if (_seqKeyLoopVal === 2) {
        return ' <span class=\"lcd-seq-mode-badge-loop\">LOOP</span>';
    }
    return '';
};
