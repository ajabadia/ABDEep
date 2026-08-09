/**
 * @purpose LCD content builders for the telemetry overlay (Wheel/VU/PatchName/Fade).
 * SEQ builders extracted to script_controllers_lcd_seq.js.
 * @classification Module/Controllers/LCD
 * @lastUpdated 2026-07-29
 */

/** Build LCD HTML for Pitch Bend, Aftertouch, Mod Wheel display */
window._buildWheelLcdHtml = function(pb, mw, at) {
    let lcdContent = '';
    if (Math.abs(pb) > 0.01) {
        const st = (pb * 2.0).toFixed(2);
        const pbClass = pb >= 0 ? 'lcd-color-green' : 'lcd-color-pink';
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
        lcdContent += '<span class="lcd-label">WHEEL</span><br>'
            + '<strong class="' + pbClass + '">PITCH BEND</strong><br>'
            + '<span class="lcd-text-xl ' + pbClass + '">' + (pb >= 0 ? '+' : '') + st + ' st</span><br>'
            + window._genBarHtml(leftBar + centerMarker + rightBar, { letterSpacing: '0', suffix: '<span class="lcd-text-sub"> ' + pbRaw + '</span>' });
    }
    if (Math.abs(pb) > 0.01 && (at > 0.01 || mw > 0.01)) {
        lcdContent += '<br>';
    }
    if (at > 0.01) {
        const atPct = Math.round(at * 100);
        const barLen = Math.round(at * 20);
        lcdContent += '<span class="lcd-label">CHANNEL PRESSURE</span><br>'
            + '<strong class="lcd-color-orange">AFTERTOUCH</strong><br>'
            + '<span class="lcd-text-xl lcd-color-orange">' + atPct + '%</span><br>'
            + window._genBarHtml(window._genFillBar(barLen, 20));
    }
    if ((Math.abs(pb) > 0.01 || at > 0.01) && mw > 0.01) {
        lcdContent += '<br>';
    }
    if (mw > 0.01) {
        const mwPct = Math.round(mw * 100);
        const barLen = Math.round(mw * 20);
        lcdContent += '<span class="lcd-label">MODULATION</span><br>'
            + '<strong class="lcd-color-blue">MOD WHEEL</strong><br>'
            + '<span class="lcd-text-xl lcd-color-blue">' + mwPct + '%</span><br>'
            + window._genBarHtml(window._genFillBar(barLen, 20));
    }
    return lcdContent;
};

/** Build LCD HTML for VU meter display */
window._buildVuLcdHtml = function(peakLevel) {
    let vuColor = 'var(--text-faint)';
    let vuClass = 'lcd-color-faint';
    if (peakLevel < 0.001) {vuColor = 'var(--text-faint)'; vuClass = 'lcd-color-faint';}
    else if (peakLevel < 0.06) {vuColor = 'var(--accent-green)'; vuClass = 'lcd-color-green';}
    else if (peakLevel < 0.5) {vuColor = 'var(--accent-yellow)'; vuClass = 'lcd-color-yellow';}
    else if (peakLevel < 0.7) {vuColor = 'var(--accent-orange)'; vuClass = 'lcd-color-orange';}
    else {vuColor = 'var(--color-danger)'; vuClass = 'lcd-color-red';}
    const db = peakLevel < 0.0001 ? '-\u221E' : (20.0 * Math.log10(peakLevel)).toFixed(1);
    const barLen = Math.round(peakLevel * 24);
    return '<span class="lcd-label">OUTPUT LEVEL</span><br>'
        + '<span class="lcd-text-lg ' + vuClass + '">' + db + ' dB</span><br>'
        + window._genBarHtml(window._genFillBar(barLen, 24), { color: vuColor })
        + (peakLevel > 0.9 ? '<br><span class="lcd-clip-badge">CLIP!</span>' : '');
};

/** Delegate SEQ LCD builders to extracted module */
// Functions _buildSeqDebugLcdHtml, _buildSeqLcdHtml, _resolveSeqModeBadge
// have been extracted to script_controllers_lcd_seq.js (loaded before this file).

/** Build LCD HTML for patch name display (with typewriter animation support) */
window._buildPatchNameLcdHtml = function(seqDebugMode) {
    const activeBank = window.loadedBanks && window.loadedBanks[window.currentActiveBank];
    const activePatch = activeBank && activeBank[window.currentActivePatchIndex];
    const bridge = getBridge();
    const basePatchName_ = activePatch ? activePatch.name
        : (bridge && bridge.parameterCache && bridge.parameterCache['patch_name']
            ? bridge.parameterCache['patch_name'] : 'INITIAL PATCH');
    const baseBankName_ = window.currentActiveBank || '';
    const debugBadge_ = seqDebugMode ? '<span class="lcd-dbg-badge">DBG</span>' : '';

    if (window._twText) {
        return { type: 'typewriter', html: '', twText: window._twText, twBank: window._twBank, debugBadge: debugBadge_ };
    } else {
        // Fase 3 (§4.1): patch name y bank name son datos externos → escapar antes de innerHTML
        let _pnHtml_;
        const _pnUpper_ = escapeHtml(basePatchName_).toUpperCase();
        if (basePatchName_.length > 10) {
            const _scrollDur_ = Math.max(4, basePatchName_.length * 0.5);
            _pnHtml_ = '<div class="lcd-scroll-container"><span class="lcd-scroll-text animate" style="animation-duration:' + _scrollDur_.toFixed(1) + 's;">' + _pnUpper_ + '</span></div>';
        } else {
            _pnHtml_ = '<span class="lcd-text-xl">' + _pnUpper_ + '</span>';
        }
        return { type: 'static', html: _pnHtml_ + debugBadge_ + '<br><span class="lcd-text-sub">' + escapeHtml(baseBankName_).toUpperCase() + '</span>' };
    }
};

/** Handle LCD fade restore with timer management */
window._handleLcdFadeRestore = function(lcdText) {
    const restoreHtml = lcdText._ctrlLcdRestore;
    lcdText._ctrlLcdRestore = null;
    if (lcdText._ctrlLcdFadeTimer) {
        clearTimeout(lcdText._ctrlLcdFadeTimer);
    }
    const rt = window.getLcdFadeTiming();
    if (rt.outR === 0) {
        if (lcdText._ctrlLcdFadeTimer) {clearTimeout(lcdText._ctrlLcdFadeTimer);}
        lcdText._ctrlLcdFadeTimer = null;
        lcdText.innerHTML = restoreHtml;
        lcdText.style.removeProperty('transition');
        lcdText.style.opacity = '1';
    } else {
        lcdText.style.transition = 'opacity ' + rt.outR + 'ms ' + window._LCD_FADE_OUT_EASING;
        lcdText.style.opacity = '0';
        lcdText._ctrlLcdFadeTimer = setTimeout(() => {
            lcdText._ctrlLcdFadeTimer = null;
            if (lcdText._ctrlLcdRestore !== null) {return;}
            lcdText.innerHTML = restoreHtml;
            lcdText.style.transition = 'opacity ' + rt.inR + 'ms ' + window._LCD_FADE_IN_EASING;
            lcdText.style.opacity = '1';
            setTimeout(() => {
                lcdText.style.removeProperty('transition');
                lcdText.style.removeProperty('opacity');
            }, rt.cleanupR);
        }, rt.swapR);
    }
};
